// modules/waste/src/engine.ts
import { CampusEvent, SeverityLevel } from '@ecosphere/shared';
import {
  BinFillStatus,
  BinThresholdConfig,
  CollectionTask,
  DEFAULT_BIN_THRESHOLDS,
  SmartBin,
  TaskPriority,
  WasteCategory
} from './types.js';

/**
 * Pure function: Classifies bin fill percentage into status based on thresholds.
 * Rules:
 * <70: Normal
 * 70-84: Approaching
 * 85-94: Collection recommended
 * >=95: Critical
 */
export function evaluateBinStatus(
  fillPercentage: number,
  thresholds: BinThresholdConfig = DEFAULT_BIN_THRESHOLDS
): BinFillStatus {
  if (fillPercentage >= thresholds.criticalMin) {
    return 'critical';
  }
  if (fillPercentage >= thresholds.recommendedMin) {
    return 'collection_recommended';
  }
  if (fillPercentage >= thresholds.approachingMin) {
    return 'approaching';
  }
  return 'normal';
}

/**
 * Converts ultrasonic sensor distance (cm) into fill percentage (0-100%).
 * ultrasonic distance: distance from sensor mounted at top of bin down to the waste surface.
 * When bin is empty: distance ~ totalDepthCm (fill ~ 0%).
 * When bin is full: distance ~ minClearanceCm (fill ~ 100%).
 */
export function calculateUltrasonicFillPercentage(params: {
  distanceCm: number;
  totalDepthCm: number;
  minClearanceCm?: number;
}): { fillPercentage: number; isValid: boolean; reason?: string } {
  const { distanceCm, totalDepthCm, minClearanceCm = 5 } = params;

  if (distanceCm < 0 || totalDepthCm <= 0) {
    return { fillPercentage: 0, isValid: false, reason: 'Negative or invalid geometry reading' };
  }

  // Sensor reading beyond bin depth indicates open lid, sensor misalignment, or reflection error
  if (distanceCm > totalDepthCm * 1.25) {
    return { fillPercentage: 0, isValid: false, reason: 'Distance exceeds bin physical height (possible displaced lid)' };
  }

  // Clamped effective distance
  const clampedDistance = Math.max(minClearanceCm, Math.min(totalDepthCm, distanceCm));
  const usableDepth = totalDepthCm - minClearanceCm;

  if (usableDepth <= 0) {
    return { fillPercentage: 0, isValid: false, reason: 'Invalid usable depth parameter' };
  }

  // As distance shrinks, waste height rises
  const wasteHeight = totalDepthCm - clampedDistance;
  const rawPercentage = (wasteHeight / usableDepth) * 100;
  const fillPercentage = Math.round(Math.max(0, Math.min(100, rawPercentage)));

  return { fillPercentage, isValid: true };
}

/**
 * Transparent rule-based task priority calculation.
 * Factors:
 * - Fill % weight: 50%
 * - Time since last collection: 20%
 * - Location foot traffic (e.g. Canteen / Library / Hostels): 20%
 * - Severity multiplier: 10%
 */
export function calculateTaskPriority(
  bin: SmartBin,
  hoursSinceLastCollection: number = 0
): { priority: TaskPriority; score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Fill percentage contribution (0 - 50 pts)
  const fillScore = (bin.fill_percentage / 100) * 50;
  score += fillScore;
  reasons.push(`Fill level: ${bin.fill_percentage}% (${fillScore.toFixed(0)} pts)`);

  // 2. Threshold status boost
  if (bin.status === 'critical') {
    score += 35;
    reasons.push('CRITICAL overflow threshold exceeded (+35 pts)');
  } else if (bin.status === 'collection_recommended') {
    score += 20;
    reasons.push('Approaching maximum capacity (+20 pts)');
  } else if (bin.status === 'approaching') {
    score += 10;
    reasons.push('High volume threshold reached (+10 pts)');
  }

  // 3. Location criticality (high traffic food/residential areas accumulate faster)
  if (bin.location_id.includes('CANTEEN')) {
    score += 15;
    reasons.push('Food service dining zone - rapid accumulation hazard (+15 pts)');
  } else if (bin.location_id.includes('HOSTEL') || bin.location_id.includes('LIBRARY')) {
    score += 8;
    reasons.push('High student occupancy zone (+8 pts)');
  }

  // 4. Time decay (stale bins accumulate odor and hygiene concerns)
  if (hoursSinceLastCollection > 12) {
    const timeBoost = Math.min(15, Math.floor(hoursSinceLastCollection / 4));
    score += timeBoost;
    reasons.push(`Over ${hoursSinceLastCollection.toFixed(0)}h since last collection (+${timeBoost} pts)`);
  }

  const roundedScore = Math.round(score);

  let priority: TaskPriority = 'low';
  if (roundedScore >= 80 || bin.fill_percentage >= 95) {
    priority = 'critical';
  } else if (roundedScore >= 60 || bin.fill_percentage >= 85) {
    priority = 'high';
  } else if (roundedScore >= 40 || bin.fill_percentage >= 70) {
    priority = 'medium';
  }

  return {
    priority,
    score: roundedScore,
    reason: reasons.join('; ')
  };
}

/**
 * Campus disposal guideline dictionary.
 */
export function getCampusDisposalRule(category: WasteCategory): string {
  switch (category) {
    case 'organic':
      return 'Deposit in GREEN Compost Bins. Feeds campus anaerobic digester & landscape compost.';
    case 'paper_cardboard':
      return 'Flatten boxes and deposit in BLUE Dry Recyclables Bins. Keep free of food grease/moisture.';
    case 'plastic':
      return 'Rinse bottles/containers and place in YELLOW Plastics Bin. Caps on.';
    case 'metal':
      return 'Clean beverage cans and scrap foil into GREY Metals Bin for mechanical recycling.';
    case 'glass':
      return 'Place unbroken glass containers in TEAL Glass Receptacle. Broken glass must be safely wrapped.';
    case 'other_uncertain':
    default:
      return 'Deposit in GREY General Landfill Waste. If hazardous or electronic, route to E-Waste Station.';
  }
}

/**
 * Creates a shared CampusEvent from a SmartBin reading.
 */
export function mapBinToCampusEvent(bin: SmartBin): CampusEvent | null {
  if (bin.status === 'normal' && bin.data_status === 'valid') {
    return null;
  }

  let severity: SeverityLevel = 'info';
  let issueType = 'bin_fill_notice';
  let recommendation = 'Standard operational monitoring.';

  if (bin.data_status !== 'valid') {
    severity = 'warning';
    issueType = 'bin_sensor_telemetry_fault';
    recommendation = `Sensor telemetry marked as '${bin.data_status}'. Verify physical bin and ultrasonic transceiver.`;
  } else if (bin.status === 'critical') {
    severity = 'critical';
    issueType = 'bin_overflow_imminent';
    recommendation = 'Dispatch rapid custodial collection immediately to prevent campus litter and hygiene violation.';
  } else if (bin.status === 'collection_recommended') {
    severity = 'warning';
    issueType = 'bin_collection_recommended';
    recommendation = 'Schedule bin for next custodial cycle within 2 hours.';
  } else if (bin.status === 'approaching') {
    severity = 'info';
    issueType = 'bin_approaching_capacity';
    recommendation = 'Monitor fill trend during upcoming peak break.';
  }

  return {
    event_id: `evt_waste_${bin.bin_id}_${Date.now()}`,
    module: 'waste',
    location_id: bin.location_id,
    zone_type: 'waste_collection_point',
    asset_id: bin.bin_id,
    issue_type: issueType,
    current_value: bin.fill_percentage,
    unit: '%',
    severity,
    timestamp: new Date().toISOString(),
    data_status: bin.data_status,
    data_source: 'simulated',
    recommended_action: recommendation,
    verification_status: 'unverified',
    details: {
      waste_category: bin.waste_category,
      capacity_liters: bin.capacity_liters,
      collection_status: bin.collection_status,
      fill_status: bin.status
    }
  };
}
