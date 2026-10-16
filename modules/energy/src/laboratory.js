/**
 * Pure function: Evaluates laboratory energy logic.
 * Invariants:
 * - Essential / process-critical equipment (fume hoods, biosafety cabinets, server compute, chillers)
 *   are NEVER auto-shut-down under any condition.
 * - Idle-controllable equipment (e.g. peripheral monitors, idle lab PCs) can be put into sleep mode.
 * - Any equipment with unknown status or uncalibrated readings is flagged for immediate review.
 */
export function evaluateLaboratoryEnergy(state) {
    const { occupied, occupancyDataStatus, activeExperiment, devices, minutesSinceLastOccupied, gracePeriodMinutes } = state;
    const baselineKw = devices.reduce((sum, d) => sum + d.powerRatingKw, 0);
    const essentialLoads = devices.filter(d => d.criticality === 'essential' || d.criticality === 'safety_critical');
    const idleControllableLoads = devices.filter(d => d.criticality === 'idle_controllable');
    const standardLightingLoads = devices.filter(d => d.criticality === 'eligible');
    // Rule 1: Unknown device status detection
    const unknownDevices = devices.filter(d => d.statusUnknown === true);
    if (unknownDevices.length > 0) {
        return {
            action: 'manual_review_required',
            explanation: `Telemetry warning: ${unknownDevices.length} research device(s) have unverified status (${unknownDevices.map(d => d.name).join(', ')}). Automated shutoff disabled to protect sensitive ongoing experiments.`,
            eligibleLoadsSwitchedOff: [],
            essentialLoadsProtected: devices.map(d => d.name),
            powerCurrentKw: baselineKw,
            powerBaselineKw: baselineKw,
            estimatedSavedKw: 0,
            alertRequired: true,
            alertSeverity: 'warning',
            alertIssueType: 'unverified_lab_equipment_status',
            recommendedAction: 'Lab manager must audit device telemetry calibration before automation can resume.'
        };
    }
    // Rule 2: Occupancy data status check
    if (occupancyDataStatus !== 'valid') {
        return {
            action: 'manual_review_required',
            explanation: `Lab occupancy telemetry flagged as '${occupancyDataStatus}'. Safety lockout engaged: laboratory environmental systems maintained.`,
            eligibleLoadsSwitchedOff: [],
            essentialLoadsProtected: devices.map(d => d.name),
            powerCurrentKw: baselineKw,
            powerBaselineKw: baselineKw,
            estimatedSavedKw: 0,
            alertRequired: true,
            alertSeverity: 'warning',
            alertIssueType: 'unreliable_lab_occupancy',
            recommendedAction: 'Verify physical presence and room sensor health.'
        };
    }
    // Rule 3: Lab occupied OR active long-running experiment registered
    if (occupied || activeExperiment) {
        const reason = occupied ? 'Researchers present' : 'Automated long-term experiment in progress';
        return {
            action: 'keep_on',
            explanation: `${reason}. All research equipment, ventilation, and workspace illumination maintained at standard operating levels.`,
            eligibleLoadsSwitchedOff: [],
            essentialLoadsProtected: essentialLoads.map(d => d.name),
            powerCurrentKw: baselineKw,
            powerBaselineKw: baselineKw,
            estimatedSavedKw: 0,
            alertRequired: false
        };
    }
    // Rule 4: Vacant within grace period
    if (minutesSinceLastOccupied < gracePeriodMinutes) {
        return {
            action: 'wait_grace_period',
            explanation: `Lab vacant for ${minutesSinceLastOccupied} min (grace period: ${gracePeriodMinutes} min). All loads maintained during grace window.`,
            eligibleLoadsSwitchedOff: [],
            essentialLoadsProtected: essentialLoads.map(d => d.name),
            powerCurrentKw: baselineKw,
            powerBaselineKw: baselineKw,
            estimatedSavedKw: 0,
            alertRequired: false
        };
    }
    // Rule 5: Vacant beyond grace period -> Power down standard room lights and put idle monitors to sleep.
    // CRITICAL: Essential process-critical equipment stays 100% powered!
    const offEligibleNames = standardLightingLoads.map(d => d.name);
    const sleepIdleNames = idleControllableLoads.map(d => d.name);
    const allManagedNames = [...offEligibleNames, ...sleepIdleNames];
    const offKw = standardLightingLoads.reduce((sum, d) => sum + d.powerRatingKw, 0);
    const idleSavedKw = idleControllableLoads.reduce((sum, d) => sum + d.powerRatingKw * 0.85, 0); // 85% reduction in deep sleep
    const totalSavedKw = Number((offKw + idleSavedKw).toFixed(3));
    const currentKw = Number((baselineKw - totalSavedKw).toFixed(3));
    return {
        action: 'switch_off',
        explanation: `Lab vacant for ${minutesSinceLastOccupied} min. General room lighting switched off; ${idleControllableLoads.length} workstation display(s) placed into low-power sleep. Fume hoods, safety vents, and process equipment protected.`,
        eligibleLoadsSwitchedOff: allManagedNames,
        essentialLoadsProtected: essentialLoads.map(d => d.name),
        powerCurrentKw: currentKw,
        powerBaselineKw: baselineKw,
        estimatedSavedKw: totalSavedKw,
        alertRequired: true,
        alertSeverity: 'info',
        alertIssueType: 'lab_idle_loads_optimized',
        recommendedAction: 'Simulated eco-mode active. Essential experiment loads untouched.'
    };
}
