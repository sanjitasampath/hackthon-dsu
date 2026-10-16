// EcoSphere AI - Shared Types & Contracts

export type ModuleId = 'energy' | 'waste' | 'water' | 'resource_optimization' | 'system';

export type SeverityLevel = 'info' | 'warning' | 'critical';

export type DataStatus = 'valid' | 'stale' | 'missing' | 'invalid';

export type DataSource = 'simulated' | 'sensor' | 'manual' | 'model';

export type VerificationStatus = 'pending' | 'verified' | 'unverified' | 'not_applicable';

export type IncidentStatus = 
  | 'open' 
  | 'acknowledged' 
  | 'in_progress' 
  | 'resolved_unverified' 
  | 'verified_resolved';

export interface CampusEvent {
  event_id: string;
  module: ModuleId;
  location_id: string;
  zone_type: string;
  asset_id: string;
  issue_type: string;
  current_value: number;
  unit: string;
  severity: SeverityLevel;
  timestamp: string; // ISO-8601
  data_status: DataStatus;
  data_source: DataSource;
  recommended_action: string;
  verification_status: VerificationStatus;
  details: Record<string, unknown>;
}

export interface CampusIncident {
  incident_id: string;
  module: ModuleId;
  location_id: string;
  asset_id: string;
  issue_type: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  status: IncidentStatus;
  first_seen_timestamp: string;
  last_seen_timestamp: string;
  event_count: number;
  current_value: number;
  unit: string;
  recommended_action: string;
  resolution_notes?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  data_source: DataSource;
  data_status: DataStatus;
}

export interface CampusLocation {
  location_id: string;
  name: string;
  zone_type: string;
  description: string;
  activeSeverity?: 'info' | 'warning' | 'critical' | 'healthy';
  coordinates: {
    x: number; // Percentage or SVG coordinate
    y: number;
    width: number;
    height: number;
  };
}

export const SHARED_CAMPUS_LOCATIONS: CampusLocation[] = [
  {
    location_id: 'CLASSROOM_101',
    name: 'Classroom 101 (Lecture Hall)',
    zone_type: 'classroom',
    description: 'Smart lecture hall with occupancy & lighting control',
    coordinates: { x: 80, y: 120, width: 140, height: 110 }
  },
  {
    location_id: 'CLASSROOM_102',
    name: 'Classroom 102 (Seminar Room)',
    zone_type: 'classroom',
    description: 'Seminar classroom with scheduled lectures',
    coordinates: { x: 240, y: 120, width: 140, height: 110 }
  },
  {
    location_id: 'AUDITORIUM_01',
    name: 'Main Auditorium',
    zone_type: 'auditorium',
    description: '600-seat multi-purpose hall with staged load control',
    coordinates: { x: 420, y: 100, width: 180, height: 150 }
  },
  {
    location_id: 'CORRIDOR_A1',
    name: 'Corridor A1 (Academic Wing)',
    zone_type: 'corridor',
    description: 'High-traffic corridor with daylight dimming & motion sensing',
    coordinates: { x: 80, y: 250, width: 300, height: 45 }
  },
  {
    location_id: 'LAB_CS_01',
    name: 'Computer Science Lab 1',
    zone_type: 'laboratory',
    description: 'Workstations, monitors, and compute cluster',
    coordinates: { x: 80, y: 320, width: 150, height: 120 }
  },
  {
    location_id: 'LAB_PHY_01',
    name: 'Physics Research Lab',
    zone_type: 'laboratory',
    description: 'Sensitive experimental equipment with protected circuits',
    coordinates: { x: 250, y: 320, width: 150, height: 120 }
  },
  {
    location_id: 'CANTEEN_01',
    name: 'Central Dining Hall',
    zone_type: 'dining',
    description: 'Food court and dining area with high organic waste output',
    coordinates: { x: 640, y: 100, width: 160, height: 140 }
  },
  {
    location_id: 'LIBRARY_01',
    name: 'Central Library',
    zone_type: 'study',
    description: 'Multi-floor study area with paper/cardboard collection',
    coordinates: { x: 440, y: 280, width: 180, height: 150 }
  },
  {
    location_id: 'HOSTEL_01',
    name: 'Hostel Block A',
    zone_type: 'residential',
    description: 'Student residence cluster with 24/7 power & waste collection',
    coordinates: { x: 650, y: 280, width: 160, height: 150 }
  },
  {
    location_id: 'SPORTS_01',
    name: 'Indoor Sports Complex',
    zone_type: 'recreational',
    description: 'Gymnasium and arena with high intermittent loads',
    coordinates: { x: 830, y: 100, width: 140, height: 140 }
  },
  {
    location_id: 'ACADEMIC_BLOCK_01',
    name: 'Academic Block 01',
    zone_type: 'academic',
    description: 'Multi-department faculty and administrative complex',
    coordinates: { x: 830, y: 280, width: 140, height: 150 }
  }
];

export interface SustainabilityReport {
  id: string;
  report_type: 'daily' | 'weekly';
  generated_at: string;
  generator_type: 'rule_based' | 'model_generated';
  model_name?: string;
  title: string;
  executive_summary: string;
  energy_summary: {
    total_consumed_kwh: number;
    total_saved_kwh: number;
    cost_saved_usd: number;
    savings_percent: number;
    active_inefficiencies_count: number;
    confirmed_findings: string[];
    potential_explanations: string[];
  };
  waste_summary: {
    total_bins_monitored: number;
    critical_bins_count: number;
    approaching_bins_count: number;
    completed_collections_count: number;
    top_waste_categories: Array<{ category: string; count: number }>;
    confirmed_findings: string[];
    potential_explanations: string[];
  };
  incident_summary: {
    total_incidents: number;
    critical_incidents: number;
    resolved_verified_count: number;
    pending_verification_count: number;
  };
  actionable_recommendations: Array<{
    priority: SeverityLevel;
    location_id: string;
    recommendation: string;
    category: 'energy' | 'waste' | 'general';
  }>;
}
