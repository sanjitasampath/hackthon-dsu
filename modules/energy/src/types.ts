// modules/energy/src/types.ts
import { CampusEvent, DataStatus, DataSource, SeverityLevel } from '@ecosphere/shared';

export type ZoneType = 'classroom' | 'auditorium' | 'corridor' | 'laboratory';

export type LoadCriticality = 'essential' | 'eligible' | 'idle_controllable' | 'safety_critical';

export interface DeviceLoad {
  id: string;
  name: string;
  powerRatingKw: number; // Configurable power rating in kW
  criticality: LoadCriticality;
  isSimulatedOn: boolean;
  canAutoShutdown: boolean;
  statusUnknown?: boolean;
}

export type EnergyDecisionAction = 
  | 'keep_on' 
  | 'wait_grace_period' 
  | 'staged_shutdown' 
  | 'switch_off' 
  | 'manual_review_required' 
  | 'override_active' 
  | 'dim_to_standby';

export interface EnergyDecision {
  action: EnergyDecisionAction;
  explanation: string;
  eligibleLoadsSwitchedOff: string[];
  essentialLoadsProtected: string[];
  powerCurrentKw: number;
  powerBaselineKw: number;
  estimatedSavedKw: number;
  alertRequired: boolean;
  alertSeverity?: SeverityLevel;
  alertIssueType?: string;
  recommendedAction?: string;
}

// Classroom Input State
export interface ClassroomState {
  locationId: string;
  timetableScheduled: boolean;
  occupancyCount: number;
  occupancyDataStatus: DataStatus; // valid | stale | missing | invalid
  minutesSinceLastOccupied: number;
  gracePeriodMinutes: number; // default 5 min
  manualOverrideActive: boolean;
  manualOverrideExpiresAt?: string;
  devices: DeviceLoad[];
}

// Auditorium Input State
export interface AuditoriumState {
  locationId: string;
  eventScheduled: boolean;
  occupancyCount: number;
  occupancyDataStatus: DataStatus;
  entryCount?: number;
  exitCount?: number;
  verifiedEmptyByStaff: boolean;
  minutesSinceLastOccupied: number;
  gracePeriodMinutes: number; // default 10 min
  shutdownStageMinutes: number; // staged shutdown timing
  staffOverrideActive: boolean;
  devices: DeviceLoad[];
}

// Corridor Input State
export interface CorridorState {
  locationId: string;
  motionDetected: boolean;
  motionSensorDataStatus: DataStatus;
  consecutiveMotionReadings: number; // for debounce
  daylightLux: number; // ambient light in lux
  daylightSensorDataStatus: DataStatus;
  daylightHysteresisThreshold: number; // lux threshold e.g. 350 lux
  vacancyTimeoutMinutes: number; // e.g. 3 min
  minutesSinceLastMotion: number;
  safeStandbyLevelPercent: number; // e.g. 25% brightness for safety
  devices: DeviceLoad[];
}

// Laboratory Input State
export interface LaboratoryState {
  locationId: string;
  occupied: boolean;
  occupancyDataStatus: DataStatus;
  activeExperiment: boolean;
  devices: DeviceLoad[];
  minutesSinceLastOccupied: number;
  gracePeriodMinutes: number;
}

// General calculation results
export interface EnergyCalculationResult {
  powerCurrentKw: number;
  powerBaselineKw: number;
  energyBaselineKwh: number;
  energyOptimizedKwh: number;
  energySavedKwh: number;
  savingsPercent: number;
  costSavedUsd: number;
  tariffPerKwh: number;
  durationHours: number;
  label: 'simulated_estimate';
}

export interface EnergyAuditRecord {
  record_id: string;
  module: 'energy';
  location_id: string;
  zone_type: ZoneType;
  timestamp: string;
  occupancy: number;
  power_kw: number;
  energy_kwh: number;
  eligible_loads: string[];
  essential_equipment: string[];
  alert: string | null;
  recommendation: string;
  data_source: DataSource;
  data_status: DataStatus;
  shared_event?: CampusEvent;
}
