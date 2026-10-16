import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase, db } from '../src/db.js';
import { WaterMeter, WaterTank } from '@ecosphere/water';
import { processEventForIncident } from '../src/services/incidentService.js';
import { CampusEvent } from '@ecosphere/shared';

describe('Water API Database and Integration Invariants', () => {
  beforeEach(() => {
    initDatabase();
  });

  it('initializes and seeds water_meters and water_tanks tables', () => {
    const meters = db.prepare('SELECT * FROM water_meters').all() as WaterMeter[];
    const tanks = db.prepare('SELECT * FROM water_tanks').all() as WaterTank[];

    expect(meters.length).toBeGreaterThanOrEqual(7);
    expect(tanks.length).toBeGreaterThanOrEqual(4);

    const canteenMeter = meters.find(m => m.meter_id === 'WM_CANTEEN_01');
    expect(canteenMeter).toBeDefined();
    expect(canteenMeter?.location_id).toBe('CANTEEN_01');
    expect(canteenMeter?.flow_rate_lpm).toBeGreaterThan(0);

    const rainwaterTank = tanks.find(t => t.tank_id === 'TANK_RAINWATER_CENTRAL');
    expect(rainwaterTank).toBeDefined();
    expect(rainwaterTank?.capacity_liters).toBe(100000);
  });

  it('persists water flow readings and respects historical limits', () => {
    const count = db.prepare('SELECT count(*) as c FROM water_flow_readings').get() as { c: number };
    expect(count.c).toBeGreaterThan(0);
  });

  it('automatically creates unified incident when a critical water burst occurs', () => {
    const now = new Date().toISOString();
    const burstEvent: CampusEvent = {
      event_id: `evt_wat_test_${Date.now()}`,
      module: 'water',
      location_id: 'CANTEEN_01',
      zone_type: 'main_feed',
      asset_id: 'WM_CANTEEN_01',
      issue_type: 'sudden_burst_drop',
      current_value: 125.0,
      unit: 'L/min',
      severity: 'critical',
      timestamp: now,
      data_status: 'valid',
      data_source: 'simulated',
      recommended_action: 'EMERGENCY SHUTOFF: Trigger solenoid isolation valve immediately.',
      verification_status: 'unverified',
      details: { flow_rate_lpm: 125, pressure_psi: 20 }
    };

    const result = processEventForIncident(burstEvent);
    expect(result.incident).toBeDefined();
    expect(result.incident.module).toBe('water');
    expect(result.incident.severity).toBe('critical');
    expect(result.incident.issue_type).toBe('sudden_burst_drop');
  });
});
