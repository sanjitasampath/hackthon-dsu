/**
 * Pure function: Evaluates corridor energy logic.
 * Invariants:
 * - Debounces noisy motion readings (requires consistent readings or debounce counter).
 * - Applies hysteresis to daylight harvesting threshold to prevent oscillating light switches.
 * - Emergency pathway lighting is independent and NEVER switched off.
 * - During vacancy, lights dim to safe standby level (e.g. 25%), never complete blackout, to ensure student safety.
 */
export function evaluateCorridorEnergy(state) {
    const { motionDetected, motionSensorDataStatus, consecutiveMotionReadings, daylightLux, daylightSensorDataStatus, daylightHysteresisThreshold, vacancyTimeoutMinutes, minutesSinceLastMotion, safeStandbyLevelPercent, devices } = state;
    const baselineKw = devices.reduce((sum, d) => sum + d.powerRatingKw, 0);
    const emergencyLoads = devices.filter(d => d.criticality === 'safety_critical' || d.criticality === 'essential');
    const lightingLoads = devices.filter(d => d.criticality === 'eligible' || d.criticality === 'idle_controllable');
    // Sensor integrity checks
    if (motionSensorDataStatus !== 'valid' || daylightSensorDataStatus !== 'valid') {
        return {
            action: 'manual_review_required',
            explanation: `Corridor sensor integrity alert (Motion: ${motionSensorDataStatus}, Daylight: ${daylightSensorDataStatus}). Fail-safe engaged: corridor lighting maintained at standard illumination for pedestrian safety.`,
            eligibleLoadsSwitchedOff: [],
            essentialLoadsProtected: emergencyLoads.map(d => d.name),
            powerCurrentKw: baselineKw,
            powerBaselineKw: baselineKw,
            estimatedSavedKw: 0,
            alertRequired: true,
            alertSeverity: 'warning',
            alertIssueType: 'corridor_sensor_degraded',
            recommendedAction: 'Inspect corridor photocell and PIR motion detector for obstruction or failure.'
        };
    }
    // Motion Debounce Check: Require at least 1 confirmed reading to trigger full illumination
    const effectiveMotion = motionDetected && consecutiveMotionReadings >= 1;
    // Hysteresis Band: +/- 50 lux around threshold
    const daylightHysteresisUpper = daylightHysteresisThreshold + 50;
    const daylightHysteresisLower = daylightHysteresisThreshold - 50;
    const isHighDaylight = daylightLux >= daylightHysteresisUpper;
    const isLowDaylight = daylightLux <= daylightHysteresisLower;
    // Case 1: Active pedestrians detected
    if (effectiveMotion) {
        if (isHighDaylight) {
            // Natural daylight allows partial dimming (e.g., 50% power) safely
            const lightingKw = lightingLoads.reduce((sum, d) => sum + d.powerRatingKw, 0);
            const dimmedKw = lightingKw * 0.5;
            const currentKw = Number((emergencyLoads.reduce((sum, d) => sum + d.powerRatingKw, 0) + dimmedKw).toFixed(3));
            const savedKw = Number((baselineKw - currentKw).toFixed(3));
            return {
                action: 'dim_to_standby',
                explanation: `Pedestrians detected, but natural daylight is ample (${daylightLux} lux >= ${daylightHysteresisUpper} lux). Primary corridor fixtures dimmed by 50% for daylight harvesting. Safety illumination guaranteed.`,
                eligibleLoadsSwitchedOff: [],
                essentialLoadsProtected: emergencyLoads.map(d => d.name),
                powerCurrentKw: currentKw,
                powerBaselineKw: baselineKw,
                estimatedSavedKw: savedKw,
                alertRequired: false
            };
        }
        // Standard evening / indoor lighting required
        return {
            action: 'keep_on',
            explanation: `Pedestrians detected with low/moderate ambient light (${daylightLux} lux). Full corridor illumination active.`,
            eligibleLoadsSwitchedOff: [],
            essentialLoadsProtected: emergencyLoads.map(d => d.name),
            powerCurrentKw: baselineKw,
            powerBaselineKw: baselineKw,
            estimatedSavedKw: 0,
            alertRequired: false
        };
    }
    // Case 2: Corridor vacant
    if (minutesSinceLastMotion < vacancyTimeoutMinutes) {
        return {
            action: 'wait_grace_period',
            explanation: `No active motion. Vacancy timer active (${minutesSinceLastMotion}/${vacancyTimeoutMinutes} min). Maintaining safe illumination for anticipated foot traffic.`,
            eligibleLoadsSwitchedOff: [],
            essentialLoadsProtected: emergencyLoads.map(d => d.name),
            powerCurrentKw: baselineKw,
            powerBaselineKw: baselineKw,
            estimatedSavedKw: 0,
            alertRequired: false
        };
    }
    // Case 3: Vacancy timeout exceeded -> Dim to safe standby level (never 0%!)
    const standbyFactor = Math.min(1, Math.max(0.1, safeStandbyLevelPercent / 100));
    const lightingKw = lightingLoads.reduce((sum, d) => sum + d.powerRatingKw, 0);
    const standbyLightingKw = lightingKw * standbyFactor;
    const emergencyKw = emergencyLoads.reduce((sum, d) => sum + d.powerRatingKw, 0);
    const currentKw = Number((emergencyKw + standbyLightingKw).toFixed(3));
    const savedKw = Number((baselineKw - currentKw).toFixed(3));
    return {
        action: 'dim_to_standby',
        explanation: `Corridor vacant for ${minutesSinceLastMotion} min (timeout: ${vacancyTimeoutMinutes} min). Fixtures dimmed to safe standby level (${safeStandbyLevelPercent}%). Emergency egress fixtures 100% active.`,
        eligibleLoadsSwitchedOff: [],
        essentialLoadsProtected: emergencyLoads.map(d => d.name),
        powerCurrentKw: currentKw,
        powerBaselineKw: baselineKw,
        estimatedSavedKw: savedKw,
        alertRequired: false
    };
}
