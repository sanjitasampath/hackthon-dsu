// modules/waste/src/types.ts
import { CampusEvent, DataStatus, DataSource, SeverityLevel } from '@ecosphere/shared';

export type WasteCategory = 
  | 'organic' 
  | 'paper_cardboard' 
  | 'plastic' 
  | 'metal' 
  | 'glass' 
  | 'other_uncertain';

export type BinFillStatus = 'normal' | 'approaching' | 'collection_recommended' | 'critical';

export type CollectionStatus = 'normal' | 'scheduled' | 'in_progress' | 'collected_unverified';

export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'needs_verification';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface SmartBin {
  bin_id: string;
  location_id: string;
  location_name: string;
  waste_category: WasteCategory;
  capacity_liters: number;
  fill_percentage: number;
  last_updated: string; // ISO-8601
  data_status: DataStatus; // valid | stale | missing | invalid
  collection_status: CollectionStatus;
  status: BinFillStatus;
  distance_cm?: number; // Raw sensor reading from ultrasonic
}

export interface BinThresholdConfig {
  normalMax: number; // default 69
  approachingMin: number; // default 70
  approachingMax: number; // default 84
  recommendedMin: number; // default 85
  recommendedMax: number; // default 94
  criticalMin: number; // default 95
}

export const DEFAULT_BIN_THRESHOLDS: BinThresholdConfig = {
  normalMax: 69,
  approachingMin: 70,
  approachingMax: 84,
  recommendedMin: 85,
  recommendedMax: 94,
  criticalMin: 95
};

export interface CollectionTask {
  task_id: string;
  bin_id: string;
  location: string;
  priority: TaskPriority;
  priority_score: number;
  reason: string;
  created_at: string;
  assigned_to: string;
  status: TaskStatus;
  verification_notes?: string;
  resolved_at?: string;
}

export interface WasteClassificationResult {
  category: WasteCategory;
  confidence: number; // 0.0 to 1.0
  campusDisposalGuideline: string;
  reviewRequired: boolean; // low confidence flag e.g. < 0.65
  modelType: 'gemini_vision' | 'transformers_client' | 'unclassified_fallback';
  modelDetails: string;
  itemDescription?: string;
  warningNote?: string;
}

export interface ClassificationRecord {
  id: string;
  timestamp: string;
  image_preview_url?: string;
  predicted_category: WasteCategory;
  confidence: number;
  review_required: boolean;
  manual_corrected_category?: WasteCategory | null;
  model_type: string;
  disposal_guideline: string;
}
