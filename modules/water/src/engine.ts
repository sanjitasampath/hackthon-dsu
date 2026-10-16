// modules/water/src/engine.ts
import {
  WaterMeter,
  WaterTank,
  WaterThresholdConfig,
  WaterDecisionOutput,
  WaterMeterStatus
} from './types.js';
import {
  estimateLeakLossPerHour,
  calculateWaterCost,
  isMinimumNightFlowWindow,
  assessAcousticLeak
} from './calculations.js';

export const DEFAULT_WATER_THRESHOLDS: WaterThresholdConfig = {
  nightFlowLeakMultiplier: 2.2, // 2.2x baseline night flow triggers suspected leak
  maxBurstFlowLpm: 90, // >= 90 L/min with low pressure triggers critical burst
  minLinePressurePsi: 32, // < 32 psi indicates significant pressure loss
  acousticLeakThresholdDb: 52, // >= 52 dB vibration indicates pipe rupture/pinhole
  tankLowReservePercent: 25, // < 25% tank capacity triggers low reserve warning
  tariffPer1000LitersUsd: 1.85 // Campus municipal water tariff ($1.85 / m3)
};

export function evaluateWaterMeter(
  meter: WaterMeter,
  hourOfDay: number = 14,
  config: WaterThresholdConfig = DEFAULT_WATER_THRESHOLDS
): WaterDecisionOutput {
  // Sensor failure / invalid data guard
  if (meter.data_status === 'missing' || meter.data_status === 'invalid' || meter.data_status === 'stale') {
    return {
      meterId: meter.meter_id,
      locationId: meter.location_id,
      status: 'offline',
      severity: 'warning',
      leakDetected: false,
      estimatedLossLph: 0,
      estimatedCostLossPerDayUsd: 0,
      confidence: 0,
      recommendedAction: 'Telemetry is stale or missing. Verify IoT flow sensor connection and battery telemetry.',
      explanation: `Sensor data status is '${meter.data_status}'. In accordance with integrity rules, leak decisions are never inferred from corrupted data.`
    };
  }

  // 1. Critical Pipe Burst Check (Abnormal high flow combined with severe pressure drop)
  if (meter.flow_rate_lpm >= config.maxBurstFlowLpm && meter.pressure_psi <= config.minLinePressurePsi) {
    const lossLph = estimateLeakLossPerHour(meter.flow_rate_lpm, meter.baseline_night_flow_lpm);
    const costPerDay = calculateWaterCost(lossLph * 24, config.tariffPer1000LitersUsd);
    return {
      meterId: meter.meter_id,
      locationId: meter.location_id,
      status: 'critical_burst',
      severity: 'critical',
      leakDetected: true,
      leakType: 'sudden_burst_drop',
      estimatedLossLph: lossLph,
      estimatedCostLossPerDayUsd: costPerDay,
      confidence: 96,
      recommendedAction: 'EMERGENCY SHUTOFF: Trigger motorized zone isolation valve immediately and dispatch emergency plumbing technicians.',
      explanation: `Critical hydraulic rupture: Flow rate (${meter.flow_rate_lpm} L/min) exceeds burst threshold (${config.maxBurstFlowLpm} L/min) while line pressure (${meter.pressure_psi} psi) collapsed below ${config.minLinePressurePsi} psi.`
    };
  }

  // 2. Acoustic Leak Detection (Ultrasonic sound signatures from pipe wall vibration)
  const acousticResult = assessAcousticLeak(meter.leak_acoustic_db, config.acousticLeakThresholdDb);
  if (acousticResult.isAnomaly) {
    const lossLph = estimateLeakLossPerHour(meter.flow_rate_lpm, meter.baseline_night_flow_lpm);
    const costPerDay = calculateWaterCost(lossLph * 24, config.tariffPer1000LitersUsd);
    return {
      meterId: meter.meter_id,
      locationId: meter.location_id,
      status: 'leak_suspected',
      severity: 'warning',
      leakDetected: true,
      leakType: 'acoustic_pinhole',
      estimatedLossLph: lossLph > 0 ? lossLph : 45.0, // estimated minimum pinhole loss
      estimatedCostLossPerDayUsd: costPerDay > 0 ? costPerDay : calculateWaterCost(45 * 24, config.tariffPer1000LitersUsd),
      confidence: acousticResult.confidence,
      recommendedAction: 'Acoustic sensor detected pipe wall vibration. Schedule ultrasonic leak inspection to locate underground fissure.',
      explanation: `Pipe wall vibration recorded at ${meter.leak_acoustic_db} dB (threshold: ${config.acousticLeakThresholdDb} dB). Consistent with pressurized pinhole orifice jetting.`
    };
  }

  // 3. Minimum Night Flow (MNF) Anomaly Check (during zero-occupancy night window)
  if (isMinimumNightFlowWindow(hourOfDay)) {
    const allowedNightFlow = meter.baseline_night_flow_lpm * config.nightFlowLeakMultiplier;
    if (meter.flow_rate_lpm > allowedNightFlow) {
      const lossLph = estimateLeakLossPerHour(meter.flow_rate_lpm, meter.baseline_night_flow_lpm);
      const costPerDay = calculateWaterCost(lossLph * 24, config.tariffPer1000LitersUsd);
      return {
        meterId: meter.meter_id,
        locationId: meter.location_id,
        status: 'leak_suspected',
        severity: 'warning',
        leakDetected: true,
        leakType: 'night_flow_anomaly',
        estimatedLossLph: lossLph,
        estimatedCostLossPerDayUsd: costPerDay,
        confidence: 88,
        recommendedAction: 'Audit zero-occupancy night flow. Inspect for running fixtures, stuck flushometers, or concealed sub-slab leaks.',
        explanation: `Night window flow of ${meter.flow_rate_lpm} L/min exceeds baseline multiplier limit of ${allowedNightFlow.toFixed(1)} L/min (${config.nightFlowLeakMultiplier}x baseline).`
      };
    }
  }

  // 4. Continuous Restroom Trickle Check
  if (meter.meter_type === 'restroom' && meter.flow_rate_lpm >= 8.0 && meter.pressure_psi >= config.minLinePressurePsi) {
    const lossLph = meter.flow_rate_lpm * 60;
    const costPerDay = calculateWaterCost(lossLph * 24, config.tariffPer1000LitersUsd);
    return {
      meterId: meter.meter_id,
      locationId: meter.location_id,
      status: 'abnormal_flow',
      severity: 'warning',
      leakDetected: true,
      leakType: 'continuous_restroom_flapper',
      estimatedLossLph: lossLph,
      estimatedCostLossPerDayUsd: costPerDay,
      confidence: 78,
      recommendedAction: 'Inspect restroom cistern flapper valves and automated flush sensors for continuous weeping.',
      explanation: `Continuous restroom feed of ${meter.flow_rate_lpm} L/min suggests toilet fixture seal failure.`
    };
  }

  // 5. Normal Nominal Operations
  return {
    meterId: meter.meter_id,
    locationId: meter.location_id,
    status: 'normal',
    severity: 'info',
    leakDetected: false,
    estimatedLossLph: 0,
    estimatedCostLossPerDayUsd: 0,
    confidence: 95,
    recommendedAction: 'Maintain scheduled preventative maintenance cycle.',
    explanation: `Nominal hydraulic parameters: Flow rate is ${meter.flow_rate_lpm} L/min at ${meter.pressure_psi} psi (Acoustic: ${meter.leak_acoustic_db} dB).`
  };
}

export function evaluateWaterTank(
  tank: WaterTank,
  config: WaterThresholdConfig = DEFAULT_WATER_THRESHOLDS
): { status: WaterTank['status']; severity: 'info' | 'warning' | 'critical'; action: string } {
  if (tank.fill_percentage <= 10) {
    return {
      status: 'critical_empty',
      severity: 'critical',
      action: 'Emergency low water volume (<10%). Start primary transfer pump and throttle non-essential irrigation supply.'
    };
  }
  if (tank.fill_percentage <= config.tankLowReservePercent) {
    return {
      status: 'low_reserve',
      severity: 'warning',
      action: `Tank reserve (${tank.fill_percentage}%) below buffer threshold (${config.tankLowReservePercent}%). Trigger scheduled refill cycle.`
    };
  }
  if (tank.fill_percentage >= 98 && tank.inflow_rate_lpm > 0) {
    return {
      status: 'overflow_risk',
      severity: 'warning',
      action: 'Tank capacity near 100% with ongoing inflow. Verify overflow cutoff sensor and close auto-inlet float valve.'
    };
  }
  return {
    status: 'optimal',
    severity: 'info',
    action: 'Water storage reserves within optimal operational bounds.'
  };
}
