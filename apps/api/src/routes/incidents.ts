// apps/api/src/routes/incidents.ts
import { Router } from 'express';
import { db } from '../db.js';
import { updateIncidentStatus, verifyAndResolveIncident } from '../services/incidentService.js';

export const router = Router();

// GET /api/incidents: List incidents with filtering
router.get('/', (req, res) => {
  try {
    const { status, module, severity, location_id, limit = 50 } = req.query;

    let query = 'SELECT * FROM campus_incidents WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (module) {
      query += ' AND module = ?';
      params.push(module);
    }
    if (severity) {
      query += ' AND severity = ?';
      params.push(severity);
    }
    if (location_id) {
      query += ' AND location_id = ?';
      params.push(location_id);
    }

    query += ' ORDER BY last_seen_timestamp DESC LIMIT ?';
    params.push(Number(limit));

    const incidents = db.prepare(query).all(...params);
    res.json({ success: true, incidents });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/incidents/:id/status: Transition incident through lifecycle
router.patch('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required.' });
    }

    const result = updateIncidentStatus(id, status);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, incident: result.incident });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/incidents/:id/verify: Move to verified_resolved
router.post('/:id/verify', (req, res) => {
  try {
    const { id } = req.params;
    const { verifiedBy, notes, freshReading } = req.body;

    const result = verifyAndResolveIncident({
      incidentId: id,
      verifiedBy: verifiedBy || 'Facility Operations Lead',
      notes,
      freshReading
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, incident: result.incident });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
