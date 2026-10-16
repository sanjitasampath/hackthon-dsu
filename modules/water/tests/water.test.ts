import { describe, it, expect } from 'vitest';
import {
  litersToCubicMeters,
  lpmToLitersPerHour,
  calculateTankFillPercentage,
  calculateWaterCost,
  isMinimumNightFlowWindow,
  assessAcousticLeak
} from '../src/calculations.js';
import {
  evaluateWaterMeter,
  evaluateWaterTank,
  DEFAULT_WATER_THRESHOLDS
} from '../src/engine.js';
import { WaterMeter, WaterTank } from '../src/types.js';

describe('Water Engine Pure Calculations', () => {
  it('converts liters to cubic meters accurately', () => {
    expect(litersToCubicMeters(2500)).toBe(2.5);
    expect(litersToCubicMeters(0)).toBe(0);
  });

  it('converts LPM to liters per hour', () => {
    expect(lpmToLitersPerHour(10)).toBe(600);
    expect(lpmToLitersPerHour(0.5)).toBe(30);
  });

  it('calculates tank fill percentage safely without divide by zero', () => {
    expect(calculateTankFillPercentage(25000, 50000)).toBe(50);
    expect(calculateTankFillPercentage(0, 50000)).toBe(0);
    expect(calculateTankFillPercentage(60000, 50000)).toBe(100);
    expect(calculateTankFillPercentage(100, 0)).toBe(0);
  });

  it('computes water cost based on municipal tariff', () => {
    // 10,000 Liters at $1.85 / 1000L = $18.50
    expect(calculateWaterCost(10000, 1.85)).toBe(18.5);
  });

  it('identifies campus minimum night flow window between 01:00 and 05:00', () => {
    expect(isMinimumNightFlowWindow(2)).toBe(true);
    expect(isMinimumNightFlowWindow(4)).toBe(true);
    expect(isMinimumNightFlowWindow(14)).toBe(false);
    expect(isMinimumNightFlowWindow(23)).toBe(false);
  });

  it('detects acoustic anomalies and scales confidence', () => {
    const normal = assessAcousticLeak(25, 52);
    expect(normal.isAnomaly).toBe(false);

    const leak = assessAcousticLeak(58, 52);
    expect(leak.isAnomaly).toBe(true);
    expect(leak.confidence).toBeGreaterThanOrEqual(70);
  });
});

describe('Water Decision Engine Invariants', () => {
  const baseMeter: WaterMeter = {
    meter_id: 'WM_CANTEEN_01',
    location_id: 'CANTEEN_01',
    name: 'Canteen Kitchen Main Supply',
    meter_type: 'main_feed',
    flow_rate_lpm: 18.5,
    pressure_psi: 55.0,
    daily_consumption_liters: 4200,
    baseline_night_flow_lpm: 1.5,
    leak_acoustic_db: 28,
    status: 'normal',
    data_status: 'valid',
    data_source: 'simulated',
    last_updated: new Date().toISOString()
  };

  it('evaluates normal operating state accurately', () => {
    const decision = evaluateWaterMeter(baseMeter, 14);
    expect(decision.status).toBe('normal');
    expect(decision.severity).toBe('info');
    expect(decision.leakDetected).toBe(false);
  });

  it('flags offline status without false leaks when sensor data is invalid or missing', () => {
    const corruptMeter: WaterMeter = { ...baseMeter, data_status: 'invalid' };
    const decision = evaluateWaterMeter(corruptMeter, 14);
    expect(decision.status).toBe('offline');
    expect(decision.severity).toBe('warning');
    expect(decision.leakDetected).toBe(false);
  });

  it('triggers critical_burst when flow is massive and line pressure collapses', () => {
    const burstMeter: WaterMeter = {
      ...baseMeter,
      flow_rate_lpm: 120.0, // >= 90
      pressure_psi: 24.0 // <= 32
    };
    const decision = evaluateWaterMeter(burstMeter, 14);
    expect(decision.status).toBe('critical_burst');
    expect(decision.severity).toBe('critical');
    expect(decision.leakDetected).toBe(true);
    expect(decision.leakType).toBe('sudden_burst_drop');
    expect(decision.recommendedAction).toContain('EMERGENCY SHUTOFF');
  });

  it('detects acoustic pinhole leak when acoustic sensor exceeds threshold', () => {
    const pinholeMeter: WaterMeter = {
      ...baseMeter,
      leak_acoustic_db: 58.0 // >= 52 dB
    };
    const decision = evaluateWaterMeter(pinholeMeter, 14);
    expect(decision.status).toBe('leak_suspected');
    expect(decision.severity).toBe('warning');
    expect(decision.leakDetected).toBe(true);
    expect(decision.leakType).toBe('acoustic_pinhole');
  });

  it('detects minimum night flow anomaly during 01:00-05:00 window', () => {
    const nightAnomalyMeter: WaterMeter = {
      ...baseMeter,
      baseline_night_flow_lpm: 1.0,
      flow_rate_lpm: 5.5 // > 1.0 * 2.2 (2.2 LPM threshold)
    };
    const decision = evaluateWaterMeter(nightAnomalyMeter, 2); // 2 AM
    expect(decision.status).toBe('leak_suspected');
    expect(decision.leakDetected).toBe(true);
    expect(decision.leakType).toBe('night_flow_anomaly');
  });

  it('evaluates water storage tank conditions', () => {
    const tank: WaterTank = {
      tank_id: 'TANK_RAINWATER_01',
      location_id: 'ACADEMIC_BLOCK_01',
      name: 'Academic Rainwater Harvesting Tank',
      type: 'rainwater_harvesting',
      capacity_liters: 50000,
      current_volume_liters: 4500,
      fill_percentage: 9,
      inflow_rate_lpm: 0,
      outflow_rate_lpm: 20,
      water_quality_index: 90,
      status: 'critical_empty',
      last_updated: new Date().toISOString()
    };

    const emptyEval = evaluateWaterTank(tank);
    expect(emptyEval.status).toBe('critical_empty');
    expect(emptyEval.severity).toBe('critical');

    const optimalTank: WaterTank = { ...tank, fill_percentage: 75 };
    const optEval = evaluateWaterTank(optimalTank);
    expect(optEval.status).toBe('optimal');
    expect(optEval.severity).toBe('info');

    const overflowTank: WaterTank = { ...tank, fill_percentage: 99, inflow_rate_lpm: 45 };
    const overflowEval = evaluateWaterTank(overflowTank);
    expect(overflowEval.status).toBe('overflow_risk');
    expect(overflowEval.severity).toBe('warning');
  });
});
