// apps/api/src/routes/reports.ts
import { Router } from 'express';
import { generateSustainabilityReport, getLatestReport } from '../services/reportService.js';

export const router = Router();

// GET /api/reports/daily: Get latest daily report or generate one
router.get('/daily', async (req, res) => {
  try {
    let report = getLatestReport('daily');
    if (!report) {
      report = await generateSustainabilityReport('daily');
    }
    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/reports/weekly: Get latest weekly report or generate one
router.get('/weekly', async (req, res) => {
  try {
    let report = getLatestReport('weekly');
    if (!report) {
      report = await generateSustainabilityReport('weekly');
    }
    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/reports/generate: Trigger explicit generation
router.post('/generate', async (req, res) => {
  try {
    const { reportType = 'daily' } = req.body;
    const report = await generateSustainabilityReport(reportType as 'daily' | 'weekly');
    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
