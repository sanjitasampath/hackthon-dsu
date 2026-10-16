// apps/api/src/modules/energy/router.ts
import { Router } from 'express';
import {
  evaluateClassroomEnergy,
  evaluateAuditoriumEnergy,
  evaluateCorridorEnergy,
  evaluateLaboratoryEnergy,
  calculateEnergySavings,
  buildEnergyAuditRecord,
  ClassroomState,
  AuditoriumState,
  CorridorState,
  LaboratoryState,
  EnergyAuditRecord
} from '@ecosphere/energy';
import { db } from '../../db.js';
import { processEventForIncident } from '../../services/incidentService.js';

export const router = Router();

// GET /api/energy/zones: Get current simulated states for all zones
router.get('/zones', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM energy_zones').all() as Array<{
      zone_id: string;
      location_id: string;
      zone_type: string;
      state_json: string;
      last_updated: string;
    }>;

    const zones = rows.map(r => {
      const state = JSON.parse(r.state_json);
      let decision;
      if (r.zone_type === 'classroom') {
        decision = evaluateClassroomEnergy(state as ClassroomState);
      } else if (r.zone_type === 'auditorium') {
        decision = evaluateAuditoriumEnergy(state as AuditoriumState);
      } else if (r.zone_type === 'corridor') {
        decision = evaluateCorridorEnergy(state as CorridorState);
      } else if (r.zone_type === 'laboratory') {
        decision = evaluateLaboratoryEnergy(state as LaboratoryState);
      }

      const savings = calculateEnergySavings({
        baselineKw: decision?.powerBaselineKw || 0,
        optimizedKw: decision?.powerCurrentKw || 0,
        durationHours: 1, // hourly rate
        tariffPerKwh: 0.14 // $0.14 per kWh configurable tariff
      });

      return {
        zoneId: r.zone_id,
        locationId: r.location_id,
        zoneType: r.zone_type,
        state,
        decision,
        savings,
        lastUpdated: r.last_updated
      };
    });

    res.json({ success: true, zones });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/energy/simulate: Interactive control simulation to update zone inputs
router.post('/simulate', (req, res) => {
  try {
    const { locationId, stateUpdate } = req.body;
    if (!locationId || !stateUpdate) {
      return res.status(400).json({ success: false, error: 'locationId and stateUpdate are required.' });
    }

    const row = db.prepare('SELECT * FROM energy_zones WHERE location_id = ?').get(locationId) as {
      zone_id: string;
      location_id: string;
      zone_type: string;
      state_json: string;
    } | undefined;

    if (!row) {
      return res.status(404).json({ success: false, error: 'Zone not found for location: ' + locationId });
    }

    const currentState = JSON.parse(row.state_json);
    const updatedState = { ...currentState, ...stateUpdate };

    // Run pure domain evaluation
    let decision;
    let occupancy = 0;
    if (row.zone_type === 'classroom') {
      decision = evaluateClassroomEnergy(updatedState as ClassroomState);
      occupancy = updatedState.occupancyCount || 0;
    } else if (row.zone_type === 'auditorium') {
      decision = evaluateAuditoriumEnergy(updatedState as AuditoriumState);
      occupancy = updatedState.occupancyCount || 0;
    } else if (row.zone_type === 'corridor') {
      decision = evaluateCorridorEnergy(updatedState as CorridorState);
      occupancy = updatedState.motionDetected ? 5 : 0;
    } else if (row.zone_type === 'laboratory') {
      decision = evaluateLaboratoryEnergy(updatedState as LaboratoryState);
      occupancy = updatedState.occupied ? 12 : 0;
    }

    if (!decision) {
      return res.status(500).json({ success: false, error: 'Failed to evaluate energy decision.' });
    }

    const now = new Date().toISOString();

    // Persist updated zone state
    db.prepare('UPDATE energy_zones SET state_json = ?, last_updated = ? WHERE location_id = ?').run(
      JSON.stringify(updatedState),
      now,
      locationId
    );

    // Build audit record & campus event
    const auditRecord = buildEnergyAuditRecord({
      locationId: row.location_id,
      zoneType: row.zone_type as any,
      occupancy,
      decision,
      energyKwh: decision.powerCurrentKw, // 1h equivalent
      dataStatus: updatedState.occupancyDataStatus || updatedState.motionSensorDataStatus || 'valid',
      dataSource: 'simulated'
    });

    // Save audit record to DB
    db.prepare(`
      INSERT INTO energy_audit_records (
        record_id, module, location_id, zone_type, timestamp, occupancy,
        power_kw, energy_kwh, eligible_loads, essential_equipment, alert,
        recommendation, data_source, data_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditRecord.record_id,
      auditRecord.module,
      auditRecord.location_id,
      auditRecord.zone_type,
      auditRecord.timestamp,
      auditRecord.occupancy,
      auditRecord.power_kw,
      auditRecord.energy_kwh,
      JSON.stringify(auditRecord.eligible_loads),
      JSON.stringify(auditRecord.essential_equipment),
      auditRecord.alert,
      auditRecord.recommendation,
      auditRecord.data_source,
      auditRecord.data_status
    );

    // If an alert or event is generated, ingest into shared events and process incident deduplication
    let createdIncident = null;
    if (auditRecord.shared_event) {
      const ev = auditRecord.shared_event;
      db.prepare(`
        INSERT INTO campus_events (
          event_id, module, location_id, zone_type, asset_id, issue_type,
          current_value, unit, severity, timestamp, data_status, data_source,
          recommended_action, verification_status, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ev.event_id,
        ev.module,
        ev.location_id,
        ev.zone_type,
        ev.asset_id,
        ev.issue_type,
        ev.current_value,
        ev.unit,
        ev.severity,
        ev.timestamp,
        ev.data_status,
        ev.data_source,
        ev.recommended_action,
        ev.verification_status,
        JSON.stringify(ev.details)
      );

      const incidentResult = processEventForIncident(ev);
      createdIncident = incidentResult.incident;
    }

    const savings = calculateEnergySavings({
      baselineKw: decision.powerBaselineKw,
      optimizedKw: decision.powerCurrentKw,
      durationHours: 1,
      tariffPerKwh: 0.14
    });

    res.json({
      success: true,
      zone: {
        locationId,
        zoneType: row.zone_type,
        state: updatedState,
        decision,
        savings
      },
      auditRecord,
      incident: createdIncident
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/energy/records: Fetch audit log / export records
router.get('/records', (req, res) => {
  try {
    const { location_id, limit = 50 } = req.query;
    let query = 'SELECT * FROM energy_audit_records';
    const params: any[] = [];

    if (location_id) {
      query += ' WHERE location_id = ?';
      params.push(location_id);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(Number(limit));

    const rows = db.prepare(query).all(...params) as any[];

    const records = rows.map(r => ({
      record_id: r.record_id,
      module: r.module,
      location_id: r.location_id,
      zone_type: r.zone_type,
      timestamp: r.timestamp,
      occupancy: r.occupancy,
      power_kw: r.power_kw,
      energy_kwh: r.energy_kwh,
      eligible_loads: JSON.parse(r.eligible_loads || '[]'),
      essential_equipment: JSON.parse(r.essential_equipment || '[]'),
      alert: r.alert,
      recommendation: r.recommendation,
      data_source: r.data_source,
      data_status: r.data_status
    }));

    res.json({ success: true, records });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
