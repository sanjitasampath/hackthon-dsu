/**
 * Pure function: Evaluates classroom energy control logic based on timetable,
 * verified occupancy, vacancy duration, manual override, and sensor data integrity.
 */
export function evaluateClassroomEnergy(state) {
    const { timetableScheduled, occupancyCount, occupancyDataStatus, minutesSinceLastOccupied, gracePeriodMinutes, manualOverrideActive, devices } = state;
    const baselineKw = devices.reduce((sum, d) => sum + d.powerRatingKw, 0);
    const essentialLoads = devices.filter(d => d.criticality === 'essential' || d.criticality === 'safety_critical');
    const eligibleLoads = devices.filter(d => d.criticality === 'eligible' || d.criticality === 'idle_controllable');
    // Rule 1: Check sensor data integrity
    // Occupancy data missing/stale/unreliable -> NEVER shut down automatically, request manual review
    if (occupancyDataStatus !== 'valid') {
        return {
            action: 'manual_review_required',
            explanation: `Occupancy sensor data is flagged as '${occupancyDataStatus}'. Automatic shutdown suspended to prevent disruption. Manual facility inspection required.`,
            eligibleLoadsSwitchedOff: [],
            essentialLoadsProtected: essentialLoads.map(d => d.name),
            powerCurrentKw: baselineKw,
            powerBaselineKw: baselineKw,
            estimatedSavedKw: 0,
            alertRequired: true,
            alertSeverity: 'warning',
            alertIssueType: 'unreliable_occupancy_telemetry',
            recommendedAction: 'Inspect classroom occupancy sensor hardware and verify physical occupancy before acting.'
        };
    }
    // Rule 2: Authorized manual override active -> respect it
    if (manualOverrideActive) {
        return {
            action: 'override_active',
            explanation: 'Authorized manual override is active. Automatic control suspended; all requested loads remain energized.',
            eligibleLoadsSwitchedOff: [],
            essentialLoadsProtected: essentialLoads.map(d => d.name),
            powerCurrentKw: baselineKw,
            powerBaselineKw: baselineKw,
            estimatedSavedKw: 0,
            alertRequired: false,
            recommendedAction: 'Monitor override expiration timestamp.'
        };
    }
    // Rule 3: Class ongoing (scheduled timetable + occupied or scheduled)
    if (timetableScheduled && occupancyCount > 0) {
        return {
            action: 'keep_on',
            explanation: `Scheduled class is active with ${occupancyCount} occupants present. All instructional and environmental loads maintained.`,
            eligibleLoadsSwitchedOff: [],
            essentialLoadsProtected: essentialLoads.map(d => d.name),
            powerCurrentKw: baselineKw,
            powerBaselineKw: baselineKw,
            estimatedSavedKw: 0,
            alertRequired: false
        };
    }
    // Rule 4: Class ended on timetable, but room is still occupied (e.g. students studying)
    if (!timetableScheduled && occupancyCount > 0) {
        return {
            action: 'keep_on',
            explanation: `No scheduled class on timetable, but room is occupied by ${occupancyCount} student(s)/faculty. Loads kept ON for active occupants.`,
            eligibleLoadsSwitchedOff: [],
            essentialLoadsProtected: essentialLoads.map(d => d.name),
            powerCurrentKw: baselineKw,
            powerBaselineKw: baselineKw,
            estimatedSavedKw: 0,
            alertRequired: false
        };
    }
    // Rule 5: Room is vacant (occupancyCount === 0)
    if (occupancyCount === 0) {
        // Vacant but within grace period
        if (minutesSinceLastOccupied < gracePeriodMinutes) {
            const remainingGrace = gracePeriodMinutes - minutesSinceLastOccupied;
            return {
                action: 'wait_grace_period',
                explanation: `Classroom is vacant. Active grace period running: ${minutesSinceLastOccupied} min elapsed of ${gracePeriodMinutes} min configured. Loads remain ON for temporary exits (${remainingGrace} min remaining).`,
                eligibleLoadsSwitchedOff: [],
                essentialLoadsProtected: essentialLoads.map(d => d.name),
                powerCurrentKw: baselineKw,
                powerBaselineKw: baselineKw,
                estimatedSavedKw: 0,
                alertRequired: false
            };
        }
        // Vacant through full grace period -> switch off eligible loads, protect essential circuits
        const essentialKw = essentialLoads.reduce((sum, d) => sum + d.powerRatingKw, 0);
        const savedKw = Number((baselineKw - essentialKw).toFixed(3));
        return {
            action: 'switch_off',
            explanation: `Classroom vacant for ${minutesSinceLastOccupied} min (exceeding ${gracePeriodMinutes} min grace period). Simulated automated shutdown of ${eligibleLoads.length} eligible non-essential load(s). Essential/safety circuits preserved.`,
            eligibleLoadsSwitchedOff: eligibleLoads.map(d => d.name),
            essentialLoadsProtected: essentialLoads.map(d => d.name),
            powerCurrentKw: essentialKw,
            powerBaselineKw: baselineKw,
            estimatedSavedKw: savedKw,
            alertRequired: true,
            alertSeverity: 'info',
            alertIssueType: 'unoccupied_power_waste_mitigated',
            recommendedAction: 'Simulated shutdown executed. Ensure physical doors are locked if end-of-day.'
        };
    }
    // Default fallback (e.g. scheduled but 0 occupants and 0 min elapsed)
    return {
        action: 'keep_on',
        explanation: 'Classroom operating under standard schedule profile.',
        eligibleLoadsSwitchedOff: [],
        essentialLoadsProtected: essentialLoads.map(d => d.name),
        powerCurrentKw: baselineKw,
        powerBaselineKw: baselineKw,
        estimatedSavedKw: 0,
        alertRequired: false
    };
}
