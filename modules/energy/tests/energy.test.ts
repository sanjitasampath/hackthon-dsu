import { describe, it, expect } from 'vitest';
import {
  calculateKwh,
  calculateEnergySavings,
  evaluateClassroomEnergy,
  evaluateAuditoriumEnergy,
  evaluateCorridorEnergy,
  evaluateLaboratoryEnergy,
  ClassroomState,
  AuditoriumState,
  CorridorState,
  LaboratoryState
} from '../src/index.js';

describe('Energy Engine Pure Math Calculations', () => {
  it('calculates kWh as kW * hours', () => {
    expect(calculateKwh(5, 2)).toBe(10);
    expect(calculateKwh(2.5, 4)).toBe(10);
    expect(calculateKwh(0, 10)).toBe(0);
    expect(calculateKwh(5, 0)).toBe(0);
    expect(calculateKwh(-5, 2)).toBe(0);
  });

  it('calculates baseline vs optimized savings, percentage and tariff cost', () => {
    const res = calculateEnergySavings({
      baselineKw: 10,
      optimizedKw: 6,
      durationHours: 2,
      tariffPerKwh: 0.14
    });

    // 10 kW * 2h = 20 kWh baseline
    // 6 kW * 2h = 12 kWh optimized
    // 8 kWh saved
    expect(res.energyBaselineKwh).toBe(20);
    expect(res.energyOptimizedKwh).toBe(12);
    expect(res.energySavedKwh).toBe(8);
    // (8 / 20) * 100 = 40%
    expect(res.savingsPercent).toBe(40);
    // 8 kWh * $0.14 = $1.12
    expect(res.costSavedUsd).toBe(1.12);
    expect(res.label).toBe('simulated_estimate');
  });

  it('handles zero baseline gracefully without divide by zero', () => {
    const res = calculateEnergySavings({
      baselineKw: 0,
      optimizedKw: 0,
      durationHours: 2,
      tariffPerKwh: 0.14
    });

    expect(res.energyBaselineKwh).toBe(0);
    expect(res.energySavedKwh).toBe(0);
    expect(res.savingsPercent).toBe(0);
    expect(res.costSavedUsd).toBe(0);
  });

  it('never shows negative savings as positive when optimized exceeds baseline', () => {
    const res = calculateEnergySavings({
      baselineKw: 5,
      optimizedKw: 8, // Consumption surge
      durationHours: 1,
      tariffPerKwh: 0.14
    });

    expect(res.energySavedKwh).toBe(0);
    expect(res.savingsPercent).toBe(0);
    expect(res.costSavedUsd).toBe(0);
  });
});

describe('Classroom Energy Decision Logic & Grace Period Enforcement', () => {
  const baseDevices = [
    { id: 'c_lights', name: 'Troffer Lights', powerRatingKw: 1.0, criticality: 'eligible' as const, isSimulatedOn: true, canAutoShutdown: true },
    { id: 'c_hvac', name: 'VRF Unit', powerRatingKw: 2.0, criticality: 'eligible' as const, isSimulatedOn: true, canAutoShutdown: true },
    { id: 'c_emerg', name: 'Emergency Light', powerRatingKw: 0.05, criticality: 'safety_critical' as const, isSimulatedOn: true, canAutoShutdown: false }
  ];

  it('keeps loads ON when a scheduled class is ongoing with occupants', () => {
    const state: ClassroomState = {
      locationId: 'CLASSROOM_101',
      timetableScheduled: true,
      occupancyCount: 25,
      occupancyDataStatus: 'valid',
      minutesSinceLastOccupied: 0,
      gracePeriodMinutes: 5,
      manualOverrideActive: false,
      devices: baseDevices
    };

    const decision = evaluateClassroomEnergy(state);
    expect(decision.action).toBe('keep_on');
    expect(decision.powerCurrentKw).toBe(3.05);
    expect(decision.eligibleLoadsSwitchedOff).toHaveLength(0);
  });

  it('keeps loads ON when class ended on timetable but students are still studying', () => {
    const state: ClassroomState = {
      locationId: 'CLASSROOM_101',
      timetableScheduled: false,
      occupancyCount: 8,
      occupancyDataStatus: 'valid',
      minutesSinceLastOccupied: 0,
      gracePeriodMinutes: 5,
      manualOverrideActive: false,
      devices: baseDevices
    };

    const decision = evaluateClassroomEnergy(state);
    expect(decision.action).toBe('keep_on');
    expect(decision.powerCurrentKw).toBe(3.05);
  });

  it('enforces grace period: does NOT shut down loads when vacant for only 2 mins (< 5 min grace)', () => {
    const state: ClassroomState = {
      locationId: 'CLASSROOM_101',
      timetableScheduled: false,
      occupancyCount: 0,
      occupancyDataStatus: 'valid',
      minutesSinceLastOccupied: 2, // 2 mins < 5 mins
      gracePeriodMinutes: 5,
      manualOverrideActive: false,
      devices: baseDevices
    };

    const decision = evaluateClassroomEnergy(state);
    expect(decision.action).toBe('wait_grace_period');
    expect(decision.powerCurrentKw).toBe(3.05);
    expect(decision.eligibleLoadsSwitchedOff).toHaveLength(0);
    expect(decision.explanation).toContain('Active grace period running');
  });

  it('switches off eligible loads once vacancy meets or exceeds full grace period (e.g. 6 mins >= 5 min)', () => {
    const state: ClassroomState = {
      locationId: 'CLASSROOM_101',
      timetableScheduled: false,
      occupancyCount: 0,
      occupancyDataStatus: 'valid',
      minutesSinceLastOccupied: 6, // 6 mins > 5 mins
      gracePeriodMinutes: 5,
      manualOverrideActive: false,
      devices: baseDevices
    };

    const decision = evaluateClassroomEnergy(state);
    expect(decision.action).toBe('switch_off');
    // Eligible loads off: Troffer Lights (1.0) + VRF Unit (2.0)
    // Safety critical preserved: Emergency Light (0.05)
    expect(decision.powerCurrentKw).toBe(0.05);
    expect(decision.estimatedSavedKw).toBe(3.0);
    expect(decision.eligibleLoadsSwitchedOff).toEqual(['Troffer Lights', 'VRF Unit']);
    expect(decision.essentialLoadsProtected).toEqual(['Emergency Light']);
    expect(decision.alertRequired).toBe(true);
  });

  it('respects authorized manual override regardless of vacancy', () => {
    const state: ClassroomState = {
      locationId: 'CLASSROOM_101',
      timetableScheduled: false,
      occupancyCount: 0,
      occupancyDataStatus: 'valid',
      minutesSinceLastOccupied: 30, // Way past grace period
      gracePeriodMinutes: 5,
      manualOverrideActive: true, // Staff override
      devices: baseDevices
    };

    const decision = evaluateClassroomEnergy(state);
    expect(decision.action).toBe('override_active');
    expect(decision.powerCurrentKw).toBe(3.05);
    expect(decision.eligibleLoadsSwitchedOff).toHaveLength(0);
  });

  it('NEVER auto-shuts down when occupancy telemetry is stale or missing, requests manual review', () => {
    const staleState: ClassroomState = {
      locationId: 'CLASSROOM_101',
      timetableScheduled: false,
      occupancyCount: 0,
      occupancyDataStatus: 'stale', // Unreliable sensor
      minutesSinceLastOccupied: 20,
      gracePeriodMinutes: 5,
      manualOverrideActive: false,
      devices: baseDevices
    };

    const decision = evaluateClassroomEnergy(staleState);
    expect(decision.action).toBe('manual_review_required');
    expect(decision.powerCurrentKw).toBe(3.05); // Remains powered for safety
    expect(decision.eligibleLoadsSwitchedOff).toHaveLength(0);
    expect(decision.alertRequired).toBe(true);
    expect(decision.alertSeverity).toBe('warning');
  });
});

describe('Auditorium, Corridor and Laboratory Logic Invariants', () => {
  it('protects auditorium emergency lighting during staged shutdown and handles entry/exit counts', () => {
    const state: AuditoriumState = {
      locationId: 'AUDITORIUM_01',
      eventScheduled: false,
      occupancyCount: 0,
      occupancyDataStatus: 'valid',
      entryCount: 300,
      exitCount: 300, // Equal counts NOT proof of empty!
      verifiedEmptyByStaff: false,
      minutesSinceLastOccupied: 15,
      gracePeriodMinutes: 10,
      shutdownStageMinutes: 10,
      staffOverrideActive: false,
      devices: [
        { id: 'aud_stage', name: 'Stage Spots', powerRatingKw: 4.0, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
        { id: 'aud_hvac', name: 'Main HVAC', powerRatingKw: 10.0, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
        { id: 'aud_exit', name: 'Exit Signs', powerRatingKw: 0.2, criticality: 'safety_critical', isSimulatedOn: true, canAutoShutdown: false }
      ]
    };

    const decision = evaluateAuditoriumEnergy(state);
    // At 15 mins (between 10m grace and 20m full), Stage 1 staged shutdown triggers
    expect(decision.action).toBe('staged_shutdown');
    expect(decision.eligibleLoadsSwitchedOff).toContain('Stage Spots');
    expect(decision.essentialLoadsProtected).toContain('Exit Signs');
  });

  it('dims corridor to safe standby level during vacancy, never total blackout', () => {
    const state: CorridorState = {
      locationId: 'CORRIDOR_A1',
      motionDetected: false,
      motionSensorDataStatus: 'valid',
      consecutiveMotionReadings: 0,
      daylightLux: 200,
      daylightSensorDataStatus: 'valid',
      daylightHysteresisThreshold: 350,
      vacancyTimeoutMinutes: 3,
      minutesSinceLastMotion: 5, // Timeout exceeded
      safeStandbyLevelPercent: 25,
      devices: [
        { id: 'cor_lights', name: 'Corridor Troffers', powerRatingKw: 1.0, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
        { id: 'cor_emerg', name: 'Emergency Pathway', powerRatingKw: 0.1, criticality: 'safety_critical', isSimulatedOn: true, canAutoShutdown: false }
      ]
    };

    const decision = evaluateCorridorEnergy(state);
    expect(decision.action).toBe('dim_to_standby');
    // Standby: 0.1 + (1.0 * 0.25) = 0.35 kW
    expect(decision.powerCurrentKw).toBe(0.35);
    expect(decision.essentialLoadsProtected).toContain('Emergency Pathway');
  });

  it('never auto-shuts down laboratory process-critical equipment', () => {
    const state: LaboratoryState = {
      locationId: 'LAB_PHY_01',
      occupied: false,
      occupancyDataStatus: 'valid',
      activeExperiment: false,
      minutesSinceLastOccupied: 45,
      gracePeriodMinutes: 15,
      devices: [
        { id: 'phy_fume_hood', name: 'VAV Fume Hood', powerRatingKw: 2.5, criticality: 'essential', isSimulatedOn: true, canAutoShutdown: false },
        { id: 'phy_cryo', name: 'Cryocooler', powerRatingKw: 3.0, criticality: 'essential', isSimulatedOn: true, canAutoShutdown: false },
        { id: 'phy_lights', name: 'Room Lights', powerRatingKw: 0.8, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true }
      ]
    };

    const decision = evaluateLaboratoryEnergy(state);
    expect(decision.action).toBe('switch_off');
    // Fume hood and cryocooler stay ON (2.5 + 3.0 = 5.5 kW)
    expect(decision.powerCurrentKw).toBe(5.5);
    expect(decision.essentialLoadsProtected).toEqual(['VAV Fume Hood', 'Cryocooler']);
    expect(decision.eligibleLoadsSwitchedOff).toContain('Room Lights');
  });
});
