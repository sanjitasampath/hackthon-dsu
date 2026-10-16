// modules/energy/src/index.ts
export * from './types.js';
export * from './calculations.js';
export * from './classroom.js';
export * from './auditorium.js';
export * from './corridor.js';
export * from './laboratory.js';
/**
 * Maps an energy evaluation result into a standardized CampusEvent conforming
 * to the shared contract in docs/SHARED_CONTRACT.md.
 */
export function createEnergyCampusEvent(params) {
    const { locationId, zoneType, decision, currentPowerKw, dataStatus = 'valid', dataSource = 'simulated' } = params;
    if (!decision.alertRequired && !decision.alertIssueType) {
        return null;
    }
    const issueType = decision.alertIssueType || 'energy_efficiency_event';
    const severity = decision.alertSeverity || 'info';
    return {
        event_id: `evt_energy_${locationId}_${Date.now()}`,
        module: 'energy',
        location_id: locationId,
        zone_type: zoneType,
        asset_id: `pwr_meter_${locationId.toLowerCase()}`,
        issue_type: issueType,
        current_value: Number(currentPowerKw.toFixed(3)),
        unit: 'kW',
        severity,
        timestamp: new Date().toISOString(),
        data_status: dataStatus,
        data_source: dataSource,
        recommended_action: decision.recommendedAction || 'Monitor power consumption profile.',
        verification_status: 'unverified',
        details: {
            action: decision.action,
            explanation: decision.explanation,
            powerBaselineKw: decision.powerBaselineKw,
            estimatedSavedKw: decision.estimatedSavedKw,
            eligibleLoadsSwitchedOff: decision.eligibleLoadsSwitchedOff,
            essentialLoadsProtected: decision.essentialLoadsProtected
        }
    };
}
/**
 * Builds an EnergyAuditRecord for JSON export and audit logs.
 */
export function buildEnergyAuditRecord(params) {
    const { locationId, zoneType, occupancy, decision, energyKwh, dataStatus = 'valid', dataSource = 'simulated' } = params;
    const sharedEvent = createEnergyCampusEvent({
        locationId,
        zoneType,
        decision,
        currentPowerKw: decision.powerCurrentKw,
        dataStatus,
        dataSource
    });
    return {
        record_id: `rec_en_${locationId}_${Date.now()}`,
        module: 'energy',
        location_id: locationId,
        zone_type: zoneType,
        timestamp: new Date().toISOString(),
        occupancy,
        power_kw: decision.powerCurrentKw,
        energy_kwh: energyKwh,
        eligible_loads: decision.eligibleLoadsSwitchedOff,
        essential_equipment: decision.essentialLoadsProtected,
        alert: decision.alertIssueType || null,
        recommendation: decision.recommendedAction || decision.explanation,
        data_source: dataSource,
        data_status: dataStatus,
        shared_event: sharedEvent || undefined
    };
}
