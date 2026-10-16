// apps/api/src/modules/water/router.ts
import { Router } from 'express';
import {
  evaluateWaterMeter,
  evaluateWaterTank,
  DEFAULT_WATER_THRESHOLDS,
  WaterMeter,
  WaterTank,
  WaterThresholdConfig
} from '@ecosphere/water';
import { CampusEvent, SeverityLevel } from '@ecosphere/shared';
import { db } from '../../db.js';
import { processEventForIncident } from '../../services/incidentService.js';

export const router = Router();

// Helper to retrieve current thresholds
function getThresholds(): WaterThresholdConfig {
  const row = db.prepare('SELECT * FROM water_thresholds WHERE id = ?').get('global') as any;
  if (!row) return DEFAULT_WATER_THRESHOLDS;
  return {
    nightFlowLeakMultiplier: row.night_flow_leak_multiplier,
    maxBurstFlowLpm: row.max_burst_flow_lpm,
    minLinePressurePsi: row.min_line_pressure_psi,
    acousticLeakThresholdDb: row.acoustic_leak_threshold_db,
    tankLowReservePercent: row.tank_low_reserve_percent,
    tariffPer1000LitersUsd: row.tariff_per_1000_liters_usd
  };
}

// GET /api/water/meters: List all meters with live evaluation
router.get('/meters', (req, res) => {
  try {
    const meters = db.prepare('SELECT * FROM water_meters ORDER BY flow_rate_lpm DESC').all() as WaterMeter[];
    const thresholds = getThresholds();
    const currentHour = new Date().getHours();

    const evaluatedMeters = meters.map(meter => {
      const decision = evaluateWaterMeter(meter, currentHour, thresholds);
      return {
        ...meter,
        decision
      };
    });

    res.json({ success: true, meters: evaluatedMeters });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/water/tanks: List all storage tanks with evaluation
router.get('/tanks', (req, res) => {
  try {
    const tanks = db.prepare('SELECT * FROM water_tanks ORDER BY fill_percentage DESC').all() as WaterTank[];
    const thresholds = getThresholds();

    const evaluatedTanks = tanks.map(tank => {
      const evaluation = evaluateWaterTank(tank, thresholds);
      return {
        ...tank,
        evaluation
      };
    });

    res.json({ success: true, tanks: evaluatedTanks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/water/thresholds: Get configurable thresholds
router.get('/thresholds', (req, res) => {
  try {
    const thresholds = getThresholds();
    res.json({ success: true, thresholds });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/water/thresholds: Update configurable thresholds
router.put('/thresholds', (req, res) => {
  try {
    const {
      nightFlowLeakMultiplier,
      maxBurstFlowLpm,
      minLinePressurePsi,
      acousticLeakThresholdDb,
      tankLowReservePercent,
      tariffPer1000LitersUsd
    } = req.body;

    const current = getThresholds();
    const updated: WaterThresholdConfig = {
      nightFlowLeakMultiplier: nightFlowLeakMultiplier !== undefined ? Number(nightFlowLeakMultiplier) : current.nightFlowLeakMultiplier,
      maxBurstFlowLpm: maxBurstFlowLpm !== undefined ? Number(maxBurstFlowLpm) : current.maxBurstFlowLpm,
      minLinePressurePsi: minLinePressurePsi !== undefined ? Number(minLinePressurePsi) : current.minLinePressurePsi,
      acousticLeakThresholdDb: acousticLeakThresholdDb !== undefined ? Number(acousticLeakThresholdDb) : current.acousticLeakThresholdDb,
      tankLowReservePercent: tankLowReservePercent !== undefined ? Number(tankLowReservePercent) : current.tankLowReservePercent,
      tariffPer1000LitersUsd: tariffPer1000LitersUsd !== undefined ? Number(tariffPer1000LitersUsd) : current.tariffPer1000LitersUsd
    };

    db.prepare(`
      INSERT OR REPLACE INTO water_thresholds (
        id, night_flow_leak_multiplier, max_burst_flow_lpm, min_line_pressure_psi,
        acoustic_leak_threshold_db, tank_low_reserve_percent, tariff_per_1000_liters_usd
      ) VALUES ('global', ?, ?, ?, ?, ?, ?)
    `).run(
      updated.nightFlowLeakMultiplier,
      updated.maxBurstFlowLpm,
      updated.minLinePressurePsi,
      updated.acousticLeakThresholdDb,
      updated.tankLowReservePercent,
      updated.tariffPer1000LitersUsd
    );

    res.json({ success: true, thresholds: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/water/readings: Time-series readings for trend charts
router.get('/readings', (req, res) => {
  try {
    const { meter_id, limit = 50 } = req.query;
    let query = 'SELECT * FROM water_flow_readings';
    const params: any[] = [];

    if (meter_id) {
      query += ' WHERE meter_id = ?';
      params.push(meter_id);
    }

    query += ' ORDER BY timestamp ASC LIMIT ?';
    params.push(Number(limit));

    const readings = db.prepare(query).all(...params);
    res.json({ success: true, readings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/water/simulate: Interactive simulation of water flow, pressure and acoustic telemetry
router.post('/simulate', (req, res) => {
  try {
    const {
      meter_id,
      flow_rate_lpm,
      pressure_psi,
      leak_acoustic_db,
      data_status = 'valid'
    } = req.body;

    if (!meter_id) {
      return res.status(400).json({ success: false, error: 'meter_id is required' });
    }

    const meter = db.prepare('SELECT * FROM water_meters WHERE meter_id = ?').get(meter_id) as WaterMeter | undefined;
    if (!meter) {
      return res.status(404).json({ success: false, error: 'Water meter not found' });
    }

    const updatedFlow = flow_rate_lpm !== undefined ? Number(flow_rate_lpm) : meter.flow_rate_lpm;
    const updatedPressure = pressure_psi !== undefined ? Number(pressure_psi) : meter.pressure_psi;
    const updatedAcoustic = leak_acoustic_db !== undefined ? Number(leak_acoustic_db) : meter.leak_acoustic_db;
    const now = new Date().toISOString();
    const thresholds = getThresholds();
    const currentHour = new Date().getHours();

    const tempMeter: WaterMeter = {
      ...meter,
      flow_rate_lpm: updatedFlow,
      pressure_psi: updatedPressure,
      leak_acoustic_db: updatedAcoustic,
      data_status: data_status as any,
      last_updated: now
    };

    const decision = evaluateWaterMeter(tempMeter, currentHour, thresholds);

    // Update meter in DB
    db.prepare(`
      UPDATE water_meters
      SET flow_rate_lpm = ?,
          pressure_psi = ?,
          leak_acoustic_db = ?,
          status = ?,
          data_status = ?,
          last_updated = ?
      WHERE meter_id = ?
    `).run(updatedFlow, updatedPressure, updatedAcoustic, decision.status, data_status, now, meter_id);

    // Record historical reading
    db.prepare(`
      INSERT INTO water_flow_readings (reading_id, meter_id, location_id, timestamp, flow_rate_lpm, pressure_psi, cumulative_liters)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `rd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      meter_id,
      meter.location_id,
      now,
      updatedFlow,
      updatedPressure,
      meter.daily_consumption_liters
    );

    // If an anomaly or leak is flagged, publish CampusEvent and process through Incident Lifecycle
    let incident = null;
    if (decision.leakDetected && decision.severity !== 'info') {
      const eventId = `evt_wat_${Date.now()}`;
      const campusEvent: CampusEvent = {
        event_id: eventId,
        module: 'water',
        location_id: meter.location_id,
        zone_type: meter.meter_type,
        asset_id: meter.meter_id,
        issue_type: decision.leakType || 'pipe_leak',
        current_value: updatedFlow,
        unit: 'L/min',
        severity: decision.severity as SeverityLevel,
        timestamp: now,
        data_status: data_status as any,
        data_source: 'simulated',
        recommended_action: decision.recommendedAction,
        verification_status: 'unverified',
        details: {
          flow_rate_lpm: updatedFlow,
          pressure_psi: updatedPressure,
          leak_acoustic_db: updatedAcoustic,
          estimated_loss_lph: decision.estimatedLossLph,
          explanation: decision.explanation
        }
      };

      // Insert event into DB
      db.prepare(`
        INSERT OR REPLACE INTO campus_events (
          event_id, module, location_id, zone_type, asset_id, issue_type,
          current_value, unit, severity, timestamp, data_status, data_source,
          recommended_action, verification_status, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        campusEvent.event_id,
        campusEvent.module,
        campusEvent.location_id,
        campusEvent.zone_type,
        campusEvent.asset_id,
        campusEvent.issue_type,
        campusEvent.current_value,
        campusEvent.unit,
        campusEvent.severity,
        campusEvent.timestamp,
        campusEvent.data_status,
        campusEvent.data_source,
        campusEvent.recommended_action,
        campusEvent.verification_status,
        JSON.stringify(campusEvent.details)
      );

      // Process event into deduplicated incident lifecycle
      incident = processEventForIncident(campusEvent);
    }

    const finalMeter = db.prepare('SELECT * FROM water_meters WHERE meter_id = ?').get(meter_id) as WaterMeter;

    res.json({
      success: true,
      meter: {
        ...finalMeter,
        decision
      },
      decision,
      incident
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/water/simulate-tank: Simulate tank levels and inflow/outflow
router.post('/simulate-tank', (req, res) => {
  try {
    const { tank_id, fill_percentage, inflow_rate_lpm, outflow_rate_lpm } = req.body;
    if (!tank_id || fill_percentage === undefined) {
      return res.status(400).json({ success: false, error: 'tank_id and fill_percentage are required' });
    }

    const tank = db.prepare('SELECT * FROM water_tanks WHERE tank_id = ?').get(tank_id) as WaterTank | undefined;
    if (!tank) {
      return res.status(404).json({ success: false, error: 'Tank not found' });
    }

    const clampedFill = Math.max(0, Math.min(100, Number(fill_percentage)));
    const currentVol = Math.round((clampedFill / 100) * tank.capacity_liters);
    const inFlow = inflow_rate_lpm !== undefined ? Number(inflow_rate_lpm) : tank.inflow_rate_lpm;
    const outFlow = outflow_rate_lpm !== undefined ? Number(outflow_rate_lpm) : tank.outflow_rate_lpm;
    const now = new Date().toISOString();
    const thresholds = getThresholds();

    const tempTank: WaterTank = {
      ...tank,
      fill_percentage: clampedFill,
      current_volume_liters: currentVol,
      inflow_rate_lpm: inFlow,
      outflow_rate_lpm: outFlow,
      last_updated: now
    };

    const evaluation = evaluateWaterTank(tempTank, thresholds);

    db.prepare(`
      UPDATE water_tanks
      SET fill_percentage = ?,
          current_volume_liters = ?,
          inflow_rate_lpm = ?,
          outflow_rate_lpm = ?,
          status = ?,
          last_updated = ?
      WHERE tank_id = ?
    `).run(clampedFill, currentVol, inFlow, outFlow, evaluation.status, now, tank_id);

    const updated = db.prepare('SELECT * FROM water_tanks WHERE tank_id = ?').get(tank_id) as WaterTank;
    res.json({ success: true, tank: { ...updated, evaluation } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/water/analytics: Holistic campus water KPIs
router.get('/analytics', (req, res) => {
  try {
    const meters = db.prepare('SELECT * FROM water_meters').all() as WaterMeter[];
    const tanks = db.prepare('SELECT * FROM water_tanks').all() as WaterTank[];
    const thresholds = getThresholds();
    const currentHour = new Date().getHours();

    let totalDailyConsumption = 0;
    let currentFlowTotal = 0;
    let activeLeaks = 0;
    let estimatedDailyLossLiters = 0;

    meters.forEach(meter => {
      totalDailyConsumption += meter.daily_consumption_liters;
      currentFlowTotal += meter.flow_rate_lpm;
      const decision = evaluateWaterMeter(meter, currentHour, thresholds);
      if (decision.leakDetected) {
        activeLeaks += 1;
        estimatedDailyLossLiters += decision.estimatedLossLph * 24;
      }
    });

    let totalTankCapacity = 0;
    let totalTankVolume = 0;
    let rainwaterVolume = 0;

    tanks.forEach(tank => {
      totalTankCapacity += tank.capacity_liters;
      totalTankVolume += tank.current_volume_liters;
      if (tank.type === 'rainwater_harvesting') {
        rainwaterVolume += tank.current_volume_liters;
      }
    });

    const overallTankFill = totalTankCapacity > 0 ? Math.round((totalTankVolume / totalTankCapacity) * 100) : 0;
    const estimatedDailyCostLossUsd = Number(((estimatedDailyLossLiters / 1000) * thresholds.tariffPer1000LitersUsd).toFixed(2));

    res.json({
      success: true,
      analytics: {
        totalDailyConsumptionLiters: Math.round(totalDailyConsumption),
        totalDailyConsumptionM3: Number((totalDailyConsumption / 1000).toFixed(2)),
        currentFlowTotalLpm: Number(currentFlowTotal.toFixed(1)),
        activeLeaksCount: activeLeaks,
        estimatedDailyLossLiters: Math.round(estimatedDailyLossLiters),
        estimatedDailyCostLossUsd,
        totalTankCapacityLiters: totalTankCapacity,
        totalTankVolumeLiters: totalTankVolume,
        overallTankFillPercent: overallTankFill,
        rainwaterHarvestedLiters: rainwaterVolume,
        monitoredMetersCount: meters.length,
        monitoredTanksCount: tanks.length,
        tariffPer1000LitersUsd: thresholds.tariffPer1000LitersUsd
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
