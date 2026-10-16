import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase, db } from '../src/db.js';
import {
  processEventForIncident,
  updateIncidentStatus,
  verifyAndResolveIncident
} from '../src/services/incidentService.js';
import { CampusEvent } from '@ecosphere/shared';

describe('Incident Deduplication & Strict Verification Rule Invariants', () => {
  beforeEach(() => {
    // Reset database to clean state
    initDatabase();
    db.exec(`
      DELETE FROM campus_incidents;
      DELETE FROM campus_events;
    `);
  });

  it('creates an open incident on the first active event', () => {
    const event: CampusEvent = {
      event_id: 'evt_test_1',
      module: 'energy',
      location_id: 'AUDITORIUM_01',
      zone_type: 'auditorium',
      asset_id: 'pwr_meter_auditorium_01',
      issue_type: 'unoccupied_power_waste',
      current_value: 18.5,
      unit: 'kW',
      severity: 'warning',
      timestamp: new Date().toISOString(),
      data_status: 'valid',
      data_source: 'simulated',
      recommended_action: 'Staged shutdown',
      verification_status: 'unverified',
      details: {}
    };

    const result = processEventForIncident(event);
    expect(result.actionTaken).toBe('created');
    expect(result.isNew).toBe(true);
    expect(result.incident.status).toBe('open');
    expect(result.incident.event_count).toBe(1);
    expect(result.incident.current_value).toBe(18.5);
    expect(result.incident.severity).toBe('warning');
  });

  it('deduplicates repeat events on (module, location_id, asset_id, issue_type) while active and increments event_count', () => {
    const event1: CampusEvent = {
      event_id: 'evt_test_repeat_1',
      module: 'waste',
      location_id: 'CANTEEN_01',
      zone_type: 'waste_collection_point',
      asset_id: 'BIN_CANTEEN_ORG_01',
      issue_type: 'bin_overflow_imminent',
      current_value: 88,
      unit: '%',
      severity: 'warning',
      timestamp: new Date(Date.now() - 10000).toISOString(),
      data_status: 'valid',
      data_source: 'simulated',
      recommended_action: 'Empty bin',
      verification_status: 'unverified',
      details: {}
    };

    const res1 = processEventForIncident(event1);
    expect(res1.actionTaken).toBe('created');

    // Recurring event with escalated severity (96% Critical)
    const event2: CampusEvent = {
      ...event1,
      event_id: 'evt_test_repeat_2',
      current_value: 96,
      severity: 'critical',
      timestamp: new Date().toISOString()
    };

    const res2 = processEventForIncident(event2);
    expect(res2.actionTaken).toBe('updated_existing');
    expect(res2.isNew).toBe(false);
    expect(res2.incident.incident_id).toBe(res1.incident.incident_id); // Identical deduplicated incident ID!
    expect(res2.incident.event_count).toBe(2);
    expect(res2.incident.current_value).toBe(96);
    expect(res2.incident.severity).toBe('critical'); // Escalated to critical!
  });

  it('strictly blocks direct transition to verified_resolved via standard status update', () => {
    const event: CampusEvent = {
      event_id: 'evt_verify_invariant',
      module: 'energy',
      location_id: 'CLASSROOM_101',
      zone_type: 'classroom',
      asset_id: 'pwr_meter_classroom_101',
      issue_type: 'unoccupied_power_waste',
      current_value: 4.2,
      unit: 'kW',
      severity: 'warning',
      timestamp: new Date().toISOString(),
      data_status: 'valid',
      data_source: 'simulated',
      recommended_action: 'Turn off lights',
      verification_status: 'unverified',
      details: {}
    };

    const { incident } = processEventForIncident(event);

    // Transitioning to acknowledged and in_progress works
    expect(updateIncidentStatus(incident.incident_id, 'acknowledged').success).toBe(true);
    expect(updateIncidentStatus(incident.incident_id, 'in_progress').success).toBe(true);
    expect(updateIncidentStatus(incident.incident_id, 'resolved_unverified').success).toBe(true);

    // DIRECT RESOLUTION TO verified_resolved IS BLOCKED
    const directVerifyResult = updateIncidentStatus(incident.incident_id, 'verified_resolved');
    expect(directVerifyResult.success).toBe(false);
    expect(directVerifyResult.error).toContain('Cannot transition directly to verified_resolved');
  });

  it('successfully transitions to verified_resolved ONLY with documented inspection note and inspector credentials', () => {
    const event: CampusEvent = {
      event_id: 'evt_full_lifecycle',
      module: 'waste',
      location_id: 'ACADEMIC_BLOCK_01',
      zone_type: 'waste_collection_point',
      asset_id: 'BIN_ACAD_PPR_01',
      issue_type: 'bin_overflow_imminent',
      current_value: 97,
      unit: '%',
      severity: 'critical',
      timestamp: new Date().toISOString(),
      data_status: 'valid',
      data_source: 'simulated',
      recommended_action: 'Custodial empty',
      verification_status: 'unverified',
      details: {}
    };

    const { incident } = processEventForIncident(event);

    // Clicking resolve alone moves only to resolved_unverified
    updateIncidentStatus(incident.incident_id, 'resolved_unverified');

    // Trying to verify with empty note fails
    const failRes = verifyAndResolveIncident({
      incidentId: incident.incident_id,
      verifiedBy: 'Officer Dave',
      notes: '' // Empty note
    });
    expect(failRes.success).toBe(false);

    // Verifying with documented inspection note succeeds
    const successRes = verifyAndResolveIncident({
      incidentId: incident.incident_id,
      verifiedBy: 'Lead Inspector Amanda Cruz (ID #FAC-881)',
      notes: 'Custodial staff physically emptied paper recycling bin, replaced liner, and reset sensor calibration.'
    });

    expect(successRes.success).toBe(true);
    expect(successRes.incident?.status).toBe('verified_resolved');
    expect(successRes.incident?.verified_by).toBe('Lead Inspector Amanda Cruz (ID #FAC-881)');
    expect(successRes.incident?.resolution_notes).toContain('Custodial staff physically emptied paper recycling bin');
    expect(successRes.incident?.verified_at).toBeDefined();
  });
});
