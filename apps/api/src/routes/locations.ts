// apps/api/src/routes/locations.ts
import { Router } from 'express';
import { SHARED_CAMPUS_LOCATIONS } from '@ecosphere/shared';
import { db } from '../db.js';

export const router = Router();

// GET /api/locations: Return shared campus locations with real-time active severity status
router.get('/', (req, res) => {
  try {
    // Find highest active severity for each location
    const activeIncidents = db.prepare(`
      SELECT location_id, severity, status
      FROM campus_incidents
      WHERE status IN ('open', 'acknowledged', 'in_progress', 'resolved_unverified')
    `).all() as Array<{ location_id: string; severity: 'info' | 'warning' | 'critical'; status: string }>;

    const locationSeverityMap: Record<string, 'info' | 'warning' | 'critical' | 'healthy'> = {};

    for (const loc of SHARED_CAMPUS_LOCATIONS) {
      locationSeverityMap[loc.location_id] = 'healthy';
    }

    for (const inc of activeIncidents) {
      const current = locationSeverityMap[inc.location_id];
      if (inc.severity === 'critical') {
        locationSeverityMap[inc.location_id] = 'critical';
      } else if (inc.severity === 'warning' && current !== 'critical') {
        locationSeverityMap[inc.location_id] = 'warning';
      } else if (inc.severity === 'info' && current === 'healthy') {
        locationSeverityMap[inc.location_id] = 'info';
      }
    }

    const locations = SHARED_CAMPUS_LOCATIONS.map(loc => ({
      ...loc,
      activeSeverity: locationSeverityMap[loc.location_id] || 'healthy'
    }));

    res.json({ success: true, locations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
