// modules/energy/src/auditorium.ts
import { AuditoriumState, EnergyDecision } from './types.js';

/**
 * Pure function: Evaluates auditorium energy control logic.
 * Invariants:
 * - Equal entry/exit counts are NOT definitive proof of an empty hall (turnstiles/sensors can miss or drift).
 * - Automatic full shutdown requires either verified empty by staff OR verified vacancy + full grace period.
 * - Staged shutdown: first AV/stage lighting, then ambient HVAC, while emergency lighting, fire alarm, and exit signs are strictly preserved.
 * - Staff override takes precedence.
 */
export function evaluateAuditoriumEnergy(state: AuditoriumState): EnergyDecision {
  const {
    eventScheduled,
    occupancyCount,
    occupancyDataStatus,
    entryCount,
    exitCount,
    verifiedEmptyByStaff,
    minutesSinceLastOccupied,
    gracePeriodMinutes,
    shutdownStageMinutes,
    staffOverrideActive,
    devices
  } = state;

  const baselineKw = devices.reduce((sum, d) => sum + d.powerRatingKw, 0);
  const safetyCriticalLoads = devices.filter(
    d => d.criticality === 'safety_critical' || d.criticality === 'essential'
  );
  const eligibleLoads = devices.filter(
    d => d.criticality === 'eligible' || d.criticality === 'idle_controllable'
  );

  // Rule 1: Check sensor data integrity
  if (occupancyDataStatus !== 'valid') {
    return {
      action: 'manual_review_required',
      explanation: `Auditorium occupancy telemetry is flagged as '${occupancyDataStatus}'. Large-venue automated shutdown halted; manual usher/staff check required.`,
      eligibleLoadsSwitchedOff: [],
      essentialLoadsProtected: safetyCriticalLoads.map(d => d.name),
      powerCurrentKw: baselineKw,
      powerBaselineKw: baselineKw,
      estimatedSavedKw: 0,
      alertRequired: true,
      alertSeverity: 'warning',
      alertIssueType: 'unreliable_auditorium_telemetry',
      recommendedAction: 'Dispatch usher to manually inspect auditorium aisles and verify clear status.'
    };
  }

  // Rule 2: Staff override
  if (staffOverrideActive) {
    return {
      action: 'override_active',
      explanation: 'Authorized staff override active for rehearsal, maintenance, or audio-visual testing. All circuits energized.',
      eligibleLoadsSwitchedOff: [],
      essentialLoadsProtected: safetyCriticalLoads.map(d => d.name),
      powerCurrentKw: baselineKw,
      powerBaselineKw: baselineKw,
      estimatedSavedKw: 0,
      alertRequired: false
    };
  }

  // Rule 3: Event scheduled or actively occupied
  if (eventScheduled || occupancyCount > 0) {
    return {
      action: 'keep_on',
      explanation: `Auditorium active (Event scheduled: ${eventScheduled ? 'Yes' : 'No'}, Detected occupants: ${occupancyCount}). Full stage, HVAC, and projection loads energized.`,
      eligibleLoadsSwitchedOff: [],
      essentialLoadsProtected: safetyCriticalLoads.map(d => d.name),
      powerCurrentKw: baselineKw,
      powerBaselineKw: baselineKw,
      estimatedSavedKw: 0,
      alertRequired: false
    };
  }

  // Rule 4: Turnstile discrepancy check (equal entry/exit counts are NOT conclusive proof of empty hall)
  let countNote = '';
  if (entryCount !== undefined && exitCount !== undefined) {
    if (entryCount === exitCount && !verifiedEmptyByStaff && minutesSinceLastOccupied < gracePeriodMinutes) {
      countNote = ' (Note: Entry and exit counts match at ' + entryCount + ', but physical verification is required before full shutdown).';
    }
  }

  // Rule 5: Vacant within grace period
  if (minutesSinceLastOccupied < gracePeriodMinutes && !verifiedEmptyByStaff) {
    return {
      action: 'wait_grace_period',
      explanation: `Auditorium event ended; 0 occupants detected. Grace period in progress (${minutesSinceLastOccupied}/${gracePeriodMinutes} min elapsed)${countNote}. Preserving HVAC and pathway lights.`,
      eligibleLoadsSwitchedOff: [],
      essentialLoadsProtected: safetyCriticalLoads.map(d => d.name),
      powerCurrentKw: baselineKw,
      powerBaselineKw: baselineKw,
      estimatedSavedKw: 0,
      alertRequired: false
    };
  }

  // Rule 6: Staged simulated shutdown
  // Stage 1: Stage lights & AV shut off first if beyond gracePeriodMinutes but before staged full completion
  const isFullShutdown = minutesSinceLastOccupied >= (gracePeriodMinutes + shutdownStageMinutes) || verifiedEmptyByStaff;

  if (!isFullShutdown) {
    // Stage 1 partial shutdown: Turn off stage spot/sound amplifiers, keep house lights & minimum ventilation
    const stageLoads = eligibleLoads.filter(d => d.name.toLowerCase().includes('stage') || d.name.toLowerCase().includes('projector') || d.name.toLowerCase().includes('av'));
    const stageOffNames = stageLoads.map(d => d.name);
    const stageOffKw = stageLoads.reduce((sum, d) => sum + d.powerRatingKw, 0);
    const activeKw = Number((baselineKw - stageOffKw).toFixed(3));

    return {
      action: 'staged_shutdown',
      explanation: `Auditorium entering Stage 1 shutdown (${minutesSinceLastOccupied} min vacant). Stage lighting and AV systems powered down. House HVAC and pathway lights remain on for remaining exit window.`,
      eligibleLoadsSwitchedOff: stageOffNames,
      essentialLoadsProtected: safetyCriticalLoads.map(d => d.name),
      powerCurrentKw: activeKw,
      powerBaselineKw: baselineKw,
      estimatedSavedKw: stageOffKw,
      alertRequired: false
    };
  }

  // Stage 2: Full simulated shutdown of all eligible loads
  const safetyKw = safetyCriticalLoads.reduce((sum, d) => sum + d.powerRatingKw, 0);
  const totalSavedKw = Number((baselineKw - safetyKw).toFixed(3));

  return {
    action: 'switch_off',
    explanation: `Auditorium cleared (${verifiedEmptyByStaff ? 'Verified by staff note' : minutesSinceLastOccupied + ' min vacancy elapsed'}). All eligible venue loads powered down. Exit signs, emergency egress lighting, and fire alarms permanently preserved.`,
    eligibleLoadsSwitchedOff: eligibleLoads.map(d => d.name),
    essentialLoadsProtected: safetyCriticalLoads.map(d => d.name),
    powerCurrentKw: safetyKw,
    powerBaselineKw: baselineKw,
    estimatedSavedKw: totalSavedKw,
    alertRequired: true,
    alertSeverity: 'info',
    alertIssueType: 'auditorium_loads_standby',
    recommendedAction: 'All main venue circuits placed in simulated eco-standby.'
  };
}
