// modules/water/src/types.ts
import { DataStatus, DataSource, SeverityLevel } from '@ecosphere/shared';

export type WaterMeterType = 'main_feed' | 'sub_feed' | 'restroom' | 'cooling_tower' | 'irrigation';

export type WaterMeterStatus = 'normal' | 'leak_suspected' | 'critical_burst' | 'abnormal_flow' | 'offline';

export type WaterTankType = 'overhead_potable' | 'ground_sump' | 'rainwater_harvesting' | 'recycled_greywater';

export type WaterTankStatus = 'optimal' | 'low_reserve' | 'critical_empty' | 'overflow_risk';

export type WaterLeakType = 
  | 'acoustic_pinhole' 
  | 'night_flow_anomaly' 
  | 'sudden_burst_drop' 
  | 'continuous_restroom_flapper' 
  | 'tank_overflow';

export interface WaterMeter {
  meter_id: string;
  location_id: string;
  name: string;
  meter_type: WaterMeterType;
  flow_rate_lpm: number; // Liters per minute
  pressure_psi: number; // Normal line pressure is 45-65 psi
  daily_consumption_liters: number;
  baseline_night_flow_lpm: number;
  leak_acoustic_db: number; // Acoustic sensor decibels (20-30dB ambient, 45-60dB pinhole, >70dB burst)
  status: WaterMeterStatus;
  data_status: DataStatus;
  data_source: DataSource;
  last_updated: string; // ISO-8601
}

export interface WaterTank {
  tank_id: string;
  location_id: string;
  name: string;
  type: WaterTankType;
  capacity_liters: number;
  current_volume_liters: number;
  fill_percentage: number;
  inflow_rate_lpm: number;
  outflow_rate_lpm: number;
  water_quality_index: number; // 0-100 score
  status: WaterTankStatus;
  last_updated: string;
}

export interface WaterThresholdConfig {
  nightFlowLeakMultiplier: number; // default: 2.2x baseline
  maxBurstFlowLpm: number; // default: 90 L/min
  minLinePressurePsi: number; // default: 32 psi
  acousticLeakThresholdDb: number; // default: 52 dB
  tankLowReservePercent: number; // default: 25%
  tariffPer1000LitersUsd: number; // default: $1.85 / 1000L ($1.85 / m3)
}

export interface WaterLeakAlert {
  alert_id: string;
  meter_id: string;
  location_id: string;
  leak_type: WaterLeakType;
  severity: SeverityLevel;
  flow_rate_lpm: number;
  pressure_psi: number;
  acoustic_db: number;
  estimated_loss_lph: number;
  estimated_hourly_cost_usd: number;
  confidence: number; // 0 - 100%
  description: string;
  recommended_action: string;
  detected_at: string;
}

export interface WaterDecisionOutput {
  meterId: string;
  locationId: string;
  status: WaterMeterStatus;
  severity: SeverityLevel;
  leakDetected: boolean;
  leakType?: WaterLeakType;
  estimatedLossLph: number;
  estimatedCostLossPerDayUsd: number;
  confidence: number;
  recommendedAction: string;
  explanation: string;
}
