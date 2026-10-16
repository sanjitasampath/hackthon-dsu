// apps/api/src/routes/demo.ts
import { Router } from 'express';
import { seedInitialDataIfEmpty } from '../db.js';

export const router = Router();

// POST /api/demo/reset: Reset all simulated sensors, bins, and events to clean demo state
router.post('/reset', (req, res) => {
  try {
    seedInitialDataIfEmpty(true);
    res.json({
      success: true,
      message: 'Demo state reset successfully. All simulated sensors, bins, and incidents reseeded to baseline.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
