// apps/api/src/services/incidentService.ts
import { CampusEvent, CampusIncident, IncidentStatus, SeverityLevel } from '@ecosphere/shared';
import { db } from '../db.js';

const SEVERITY_RANK: Record<SeverityLevel, number> = {
  info: 1,
  warning: 2,
  critical: 3
};

/**
 * Evaluates an ingested event, applies deduplication by:
 * (module, location_id, asset_id, issue_type) while an incident is active,
 * and updates or creates an incident.
 */
export function processEventForIncident(event: CampusEvent): {
  incident: CampusIncident;
  isNew: boolean;
  actionTaken: 'created' | 'updated_existing' | 'ignored_info';
} {
  // If event is info and doesn't warrant an incident, we record event only unless already active
  const activeStatuses = ['open', 'acknowledged', 'in_progress', 'resolved_unverified'];
  const placeholders = activeStatuses.map(() => '?').join(',');

  const query = `
    SELECT * FROM campus_incidents
    WHERE module = ? AND location_id = ? AND asset_id = ? AND issue_type = ?
      AND status IN (${placeholders})
    ORDER BY last_seen_timestamp DESC
    LIMIT 1
  `;

  const existing = db.prepare(query).get(
    event.module,
    event.location_id,
    event.asset_id,
    event.issue_type,
    ...activeStatuses
  ) as CampusIncident | undefined;

  const now = new Date().toISOString();

  if (existing) {
    // Incident already active: Deduplicate & update
    const currentSevRank = SEVERITY_RANK[existing.severity] || 1;
    const incomingSevRank = SEVERITY_RANK[event.severity] || 1;
    const highestSeverity: SeverityLevel = incomingSevRank > currentSevRank ? event.severity : existing.severity;

    const newEventCount = existing.event_count + 1;

    db.prepare(`
      UPDATE campus_incidents
      SET event_count = ?,
          last_seen_timestamp = ?,
          current_value = ?,
          severity = ?,
          data_status = ?,
          data_source = ?,
          recommended_action = ?
      WHERE incident_id = ?
    `).run(
      newEventCount,
      now,
      event.current_value,
      highestSeverity,
      event.data_status,
      event.data_source,
      event.recommended_action,
      existing.incident_id
    );

    const updated = db.prepare('SELECT * FROM campus_incidents WHERE incident_id = ?').get(existing.incident_id) as CampusIncident;

    return {
      incident: updated,
      isNew: false,
      actionTaken: 'updated_existing'
    };
  }

  // Create new incident
  const incidentId = `inc_${event.module}_${event.location_id.toLowerCase()}_${Date.now()}`;
  const title = generateIncidentTitle(event);
  const description = generateIncidentDescription(event);

  db.prepare(`
    INSERT INTO campus_incidents (
      incident_id, module, location_id, asset_id, issue_type, title,
      description, severity, status, first_seen_timestamp, last_seen_timestamp,
      event_count, current_value, unit, recommended_action, data_source, data_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    incidentId,
    event.module,
    event.location_id,
    event.asset_id,
    event.issue_type,
    title,
    description,
    event.severity,
    'open',
    event.timestamp || now,
    event.timestamp || now,
    1,
    event.current_value,
    event.unit,
    event.recommended_action,
    event.data_source,
    event.data_status
  );

  const created = db.prepare('SELECT * FROM campus_incidents WHERE incident_id = ?').get(incidentId) as CampusIncident;

  return {
    incident: created,
    isNew: true,
    actionTaken: 'created'
  };
}

/**
 * Transitions incident status through lifecycle:
 * open -> acknowledged -> in_progress -> resolved_unverified
 * Note: An incident CANNOT be moved directly to verified_resolved via this function!
 */
export function updateIncidentStatus(incidentId: string, targetStatus: IncidentStatus): {
  success: boolean;
  incident?: CampusIncident;
  error?: string;
} {
  const incident = db.prepare('SELECT * FROM campus_incidents WHERE incident_id = ?').get(incidentId) as CampusIncident | undefined;
  if (!incident) {
    return { success: false, error: 'Incident not found' };
  }

  // Strict invariant: verified_resolved requires verifyIncident()
  if (targetStatus === 'verified_resolved') {
    return {
      success: false,
      error: 'Cannot transition directly to verified_resolved. Verification requires a fresh valid sensor reading or a documented manual inspection note.'
    };
  }

  db.prepare(`
    UPDATE campus_incidents
    SET status = ?
    WHERE incident_id = ?
  `).run(targetStatus, incidentId);

  const updated = db.prepare('SELECT * FROM campus_incidents WHERE incident_id = ?').get(incidentId) as CampusIncident;
  return { success: true, incident: updated };
}

/**
 * Verifies and permanently resolves an incident.
 * Invariants:
 * - Requires either a documented manual inspection note, OR a fresh valid sensor reading.
 */
export function verifyAndResolveIncident(params: {
  incidentId: string;
  verifiedBy: string;
  notes: string;
  freshReading?: {
    value: number;
    unit: string;
    data_status: 'valid';
  };
}): { success: boolean; incident?: CampusIncident; error?: string } {
  const { incidentId, verifiedBy, notes, freshReading } = params;

  const incident = db.prepare('SELECT * FROM campus_incidents WHERE incident_id = ?').get(incidentId) as CampusIncident | undefined;
  if (!incident) {
    return { success: false, error: 'Incident not found' };
  }

  if (!notes || notes.trim().length < 5) {
    return { success: false, error: 'A documented manual inspection note (minimum 5 characters) is required for verification.' };
  }

  if (!verifiedBy || verifiedBy.trim().length === 0) {
    return { success: false, error: 'Verifier identifier (staff name / ID) is required.' };
  }

  const now = new Date().toISOString();
  let updatedValue = incident.current_value;
  let updatedUnit = incident.unit;
  let updatedDataStatus = incident.data_status;

  if (freshReading) {
    if (freshReading.data_status !== 'valid') {
      return { success: false, error: 'Verification reading must be marked as data_status: valid.' };
    }
    updatedValue = freshReading.value;
    updatedUnit = freshReading.unit;
    updatedDataStatus = 'valid';
  }

  db.prepare(`
    UPDATE campus_incidents
    SET status = 'verified_resolved',
        resolution_notes = ?,
        verified_by = ?,
        verified_at = ?,
        current_value = ?,
        unit = ?,
        data_status = ?
    WHERE incident_id = ?
  `).run(
    notes,
    verifiedBy,
    now,
    updatedValue,
    updatedUnit,
    updatedDataStatus,
    incidentId
  );

  const updated = db.prepare('SELECT * FROM campus_incidents WHERE incident_id = ?').get(incidentId) as CampusIncident;
  return { success: true, incident: updated };
}

function generateIncidentTitle(event: CampusEvent): string {
  const loc = event.location_id.replace(/_/g, ' ');
  const issue = event.issue_type.replace(/_/g, ' ');
  return `[${event.module.toUpperCase()}] ${issue.toUpperCase()} at ${loc}`;
}

function generateIncidentDescription(event: CampusEvent): string {
  return `Telemetry reading of ${event.current_value} ${event.unit} triggered severity ${event.severity} at ${event.location_id}. Action: ${event.recommended_action}`;
}
