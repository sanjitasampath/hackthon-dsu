// apps/api/src/routes/events.ts
import { Router } from 'express';
import { CampusEvent } from '@ecosphere/shared';
import { db } from '../db.js';
import { processEventForIncident } from '../services/incidentService.js';

export const router = Router();

// GET /api/events: Retrieve events with module, location, severity, and data_status filtering
router.get('/', (req, res) => {
  try {
    const { module, location_id, severity, data_status, limit = 50 } = req.query;

    let query = 'SELECT * FROM campus_events WHERE 1=1';
    const params: any[] = [];

    if (module) {
      query += ' AND module = ?';
      params.push(module);
    }
    if (location_id) {
      query += ' AND location_id = ?';
      params.push(location_id);
    }
    if (severity) {
      query += ' AND severity = ?';
      params.push(severity);
    }
    if (data_status) {
      query += ' AND data_status = ?';
      params.push(data_status);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(Number(limit));

    const rows = db.prepare(query).all(...params) as any[];

    const events = rows.map(r => ({
      ...r,
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details
    }));

    res.json({ success: true, events });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/events: Ingest a new event and process incident deduplication
router.post('/', (req, res) => {
  try {
    const event: CampusEvent = req.body;

    if (!event.event_id || !event.module || !event.location_id || !event.issue_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required CampusEvent fields (event_id, module, location_id, issue_type).'
      });
    }

    const timestamp = event.timestamp || new Date().toISOString();
    const data_status = event.data_status || 'valid';
    const data_source = event.data_source || 'simulated';
    const verification_status = event.verification_status || 'unverified';
    const detailsJson = JSON.stringify(event.details || {});

    db.prepare(`
      INSERT OR REPLACE INTO campus_events (
        event_id, module, location_id, zone_type, asset_id, issue_type,
        current_value, unit, severity, timestamp, data_status, data_source,
        recommended_action, verification_status, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.event_id,
      event.module,
      event.location_id,
      event.zone_type || 'general',
      event.asset_id || 'general',
      event.issue_type,
      event.current_value || 0,
      event.unit || '',
      event.severity || 'info',
      timestamp,
      data_status,
      data_source,
      event.recommended_action || '',
      verification_status,
      detailsJson
    );

    // Run incident deduplication pipeline
    const incidentResult = processEventForIncident(event);

    res.status(201).json({
      success: true,
      event,
      incident: incidentResult.incident,
      actionTaken: incidentResult.actionTaken
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
