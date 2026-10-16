import { describe, it, expect } from 'vitest';
import {
  evaluateBinStatus,
  calculateUltrasonicFillPercentage,
  calculateTaskPriority,
  getCampusDisposalRule,
  SmartBin
} from '../src/index.js';

describe('Waste Engine Bin Threshold Classification', () => {
  it('correctly maps fill percentages according to global campus thresholds', () => {
    // < 70: Normal
    expect(evaluateBinStatus(0)).toBe('normal');
    expect(evaluateBinStatus(45)).toBe('normal');
    expect(evaluateBinStatus(69)).toBe('normal');

    // 70-84: Approaching
    expect(evaluateBinStatus(70)).toBe('approaching');
    expect(evaluateBinStatus(78)).toBe('approaching');
    expect(evaluateBinStatus(84)).toBe('approaching');

    // 85-94: Collection recommended
    expect(evaluateBinStatus(85)).toBe('collection_recommended');
    expect(evaluateBinStatus(90)).toBe('collection_recommended');
    expect(evaluateBinStatus(94)).toBe('collection_recommended');

    // >= 95: Critical
    expect(evaluateBinStatus(95)).toBe('critical');
    expect(evaluateBinStatus(98)).toBe('critical');
    expect(evaluateBinStatus(100)).toBe('critical');
  });
});

describe('Ultrasonic Sensor Geometry & Fill Calculations', () => {
  it('converts distance to fill percentage accurately', () => {
    // 100cm total depth, 5cm clearance -> 95cm usable
    // Distance 100cm (empty bin) -> 0% fill
    const empty = calculateUltrasonicFillPercentage({ distanceCm: 100, totalDepthCm: 100 });
    expect(empty.isValid).toBe(true);
    expect(empty.fillPercentage).toBe(0);

    // Distance 5cm (completely full) -> 100% fill
    const full = calculateUltrasonicFillPercentage({ distanceCm: 5, totalDepthCm: 100 });
    expect(full.isValid).toBe(true);
    expect(full.fillPercentage).toBe(100);

    // Midpoint distance ~ 52.5cm -> ~50% fill
    const mid = calculateUltrasonicFillPercentage({ distanceCm: 52.5, totalDepthCm: 100 });
    expect(mid.isValid).toBe(true);
    expect(mid.fillPercentage).toBe(50);
  });

  it('flags physical anomalies and open lids as invalid readings', () => {
    // Distance 200cm in a 100cm bin (displaced lid or missing bin)
    const anomaly = calculateUltrasonicFillPercentage({ distanceCm: 200, totalDepthCm: 100 });
    expect(anomaly.isValid).toBe(false);
    expect(anomaly.reason).toBeDefined();

    // Negative reading
    const negative = calculateUltrasonicFillPercentage({ distanceCm: -10, totalDepthCm: 100 });
    expect(negative.isValid).toBe(false);
  });
});

describe('Transparent Rule-Based Task Priority Scoring', () => {
  const dummyBin: SmartBin = {
    bin_id: 'BIN_CANTEEN_ORG_01',
    location_id: 'CANTEEN_01',
    location_name: 'Central Dining Hall',
    waste_category: 'organic',
    capacity_liters: 240,
    fill_percentage: 96,
    last_updated: new Date().toISOString(),
    data_status: 'valid',
    collection_status: 'scheduled',
    status: 'critical'
  };

  it('assigns critical priority to overflowing high-traffic canteen bin', () => {
    const priority = calculateTaskPriority(dummyBin, 6);
    expect(priority.priority).toBe('critical');
    expect(priority.score).toBeGreaterThanOrEqual(80);
    expect(priority.reason).toContain('CRITICAL overflow threshold');
    expect(priority.reason).toContain('Food service dining zone');
  });

  it('assigns lower priority to moderate residential bin', () => {
    const normalBin: SmartBin = {
      ...dummyBin,
      bin_id: 'BIN_HOSTEL_01',
      location_id: 'HOSTEL_01',
      fill_percentage: 40,
      status: 'normal'
    };
    const priority = calculateTaskPriority(normalBin, 1);
    expect(priority.priority).toBe('low');
    expect(priority.score).toBeLessThan(40);
  });
});

describe('Campus Disposal Rule Directory', () => {
  it('returns specific instructions for every waste category', () => {
    expect(getCampusDisposalRule('organic')).toContain('GREEN Compost Bins');
    expect(getCampusDisposalRule('paper_cardboard')).toContain('BLUE Dry Recyclables');
    expect(getCampusDisposalRule('plastic')).toContain('YELLOW Plastics');
    expect(getCampusDisposalRule('metal')).toContain('GREY Metals');
    expect(getCampusDisposalRule('glass')).toContain('Glass Receptacle');
  });
});
