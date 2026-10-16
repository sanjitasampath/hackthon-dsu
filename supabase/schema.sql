-- =========================================================================
-- EcoSphere AI - Sustainable Campus Digital Twin Platform
-- Supabase / PostgreSQL Schema Definition & Seed Scripts
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Shared Campus Locations
CREATE TABLE IF NOT EXISTS campus_locations (
  location_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  building VARCHAR(100) NOT NULL,
  floor INT NOT NULL DEFAULT 1,
  zone_type VARCHAR(50) NOT NULL,
  coordinates JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Unified Events Stream
CREATE TABLE IF NOT EXISTS campus_events (
  event_id VARCHAR(100) PRIMARY KEY,
  module VARCHAR(50) NOT NULL,
  location_id VARCHAR(50) REFERENCES campus_locations(location_id),
  zone_type VARCHAR(50) NOT NULL,
  asset_id VARCHAR(100) NOT NULL,
  issue_type VARCHAR(100) NOT NULL,
  current_value NUMERIC(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('info', 'warning', 'critical')) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  data_status VARCHAR(20) CHECK (data_status IN ('valid', 'stale', 'missing', 'invalid')) NOT NULL,
  data_source VARCHAR(20) CHECK (data_source IN ('simulated', 'sensor', 'manual', 'model')) NOT NULL,
  recommended_action TEXT NOT NULL,
  verification_status VARCHAR(30) CHECK (verification_status IN ('pending', 'verified', 'unverified', 'not_applicable')) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_module ON campus_events(module);
CREATE INDEX IF NOT EXISTS idx_events_location ON campus_events(location_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON campus_events(timestamp DESC);

-- 3. Unified Incidents Lifecycle
CREATE TABLE IF NOT EXISTS campus_incidents (
  incident_id VARCHAR(100) PRIMARY KEY,
  module VARCHAR(50) NOT NULL,
  location_id VARCHAR(50) REFERENCES campus_locations(location_id),
  asset_id VARCHAR(100) NOT NULL,
  issue_type VARCHAR(100) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('info', 'warning', 'critical')) NOT NULL,
  status VARCHAR(30) CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved_unverified', 'verified_resolved')) NOT NULL DEFAULT 'open',
  first_seen_timestamp TIMESTAMPTZ NOT NULL,
  last_seen_timestamp TIMESTAMPTZ NOT NULL,
  occurrence_count INT NOT NULL DEFAULT 1,
  current_value NUMERIC(10,2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  recommended_action TEXT NOT NULL,
  assigned_to VARCHAR(100),
  verified_by VARCHAR(100),
  verification_notes TEXT,
  data_source VARCHAR(20) NOT NULL,
  data_status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Energy Efficiency Zones
CREATE TABLE IF NOT EXISTS energy_zones (
  zone_id VARCHAR(100) PRIMARY KEY,
  location_id VARCHAR(50) REFERENCES campus_locations(location_id),
  zone_type VARCHAR(50) NOT NULL,
  state_json JSONB NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL
);

-- 5. Smart Waste Bins
CREATE TABLE IF NOT EXISTS smart_bins (
  bin_id VARCHAR(100) PRIMARY KEY,
  location_id VARCHAR(50) REFERENCES campus_locations(location_id),
  waste_category VARCHAR(50) NOT NULL,
  fill_percentage INT NOT NULL CHECK (fill_percentage BETWEEN 0 AND 100),
  status VARCHAR(30) NOT NULL,
  last_collection_timestamp TIMESTAMPTZ,
  data_status VARCHAR(20) NOT NULL DEFAULT 'valid',
  sensor_type VARCHAR(50) NOT NULL DEFAULT 'ultrasonic',
  sensor_battery_percent INT DEFAULT 100,
  last_updated TIMESTAMPTZ NOT NULL
);

-- 6. Waste Collection Tasks
CREATE TABLE IF NOT EXISTS collection_tasks (
  id VARCHAR(100) PRIMARY KEY,
  bin_id VARCHAR(100) REFERENCES smart_bins(bin_id),
  priority_score NUMERIC(5,2) NOT NULL,
  urgency_level VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  assigned_to VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  verification_notes TEXT
);

-- 7. Waste Computer Vision Classifications
CREATE TABLE IF NOT EXISTS waste_classifications (
  id VARCHAR(100) PRIMARY KEY,
  image_hash VARCHAR(100),
  predicted_category VARCHAR(50) NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  review_required BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by VARCHAR(100),
  actual_category VARCHAR(50),
  model_name VARCHAR(100) NOT NULL,
  inference_latency_ms INT,
  item_description TEXT,
  disposal_guideline TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

-- 8. Water Management Meters
CREATE TABLE IF NOT EXISTS water_meters (
  meter_id VARCHAR(100) PRIMARY KEY,
  location_id VARCHAR(50) REFERENCES campus_locations(location_id),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  flow_rate_lpm NUMERIC(8,2) NOT NULL DEFAULT 0.0,
  pressure_psi NUMERIC(6,2) NOT NULL DEFAULT 45.0,
  daily_consumption_liters NUMERIC(12,2) NOT NULL DEFAULT 0.0,
  leak_acoustic_db NUMERIC(6,2) NOT NULL DEFAULT 22.0,
  status VARCHAR(30) NOT NULL DEFAULT 'normal',
  data_status VARCHAR(20) NOT NULL DEFAULT 'valid',
  last_updated TIMESTAMPTZ NOT NULL
);

-- 9. Water Storage Tanks
CREATE TABLE IF NOT EXISTS water_tanks (
  tank_id VARCHAR(100) PRIMARY KEY,
  location_id VARCHAR(50) REFERENCES campus_locations(location_id),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  capacity_liters NUMERIC(12,2) NOT NULL,
  current_volume_liters NUMERIC(12,2) NOT NULL,
  fill_percentage INT NOT NULL CHECK (fill_percentage BETWEEN 0 AND 100),
  inflow_rate_lpm NUMERIC(8,2) NOT NULL DEFAULT 0.0,
  outflow_rate_lpm NUMERIC(8,2) NOT NULL DEFAULT 0.0,
  water_quality_index NUMERIC(5,2) NOT NULL DEFAULT 92.0,
  status VARCHAR(30) NOT NULL DEFAULT 'optimal',
  last_updated TIMESTAMPTZ NOT NULL
);

-- 10. Water Flow Time-Series Readings
CREATE TABLE IF NOT EXISTS water_flow_readings (
  reading_id VARCHAR(100) PRIMARY KEY,
  meter_id VARCHAR(100) REFERENCES water_meters(meter_id),
  location_id VARCHAR(50) REFERENCES campus_locations(location_id),
  timestamp TIMESTAMPTZ NOT NULL,
  flow_rate_lpm NUMERIC(8,2) NOT NULL,
  pressure_psi NUMERIC(6,2) NOT NULL,
  cumulative_liters NUMERIC(12,2) NOT NULL
);

-- 11. Campus Rooms & Timetable Schedules
CREATE TABLE IF NOT EXISTS campus_rooms (
  room_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  building VARCHAR(100) NOT NULL,
  floor INT NOT NULL DEFAULT 1,
  capacity INT NOT NULL,
  room_type VARCHAR(50) NOT NULL,
  has_projector BOOLEAN NOT NULL DEFAULT TRUE,
  has_computers BOOLEAN NOT NULL DEFAULT FALSE,
  base_hvac_kw NUMERIC(6,2) NOT NULL,
  lighting_kw NUMERIC(6,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS room_schedules (
  id VARCHAR(100) PRIMARY KEY,
  room_id VARCHAR(50) REFERENCES campus_rooms(room_id),
  course_code VARCHAR(30) NOT NULL,
  course_title VARCHAR(150) NOT NULL,
  day_of_week VARCHAR(20) NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  duration_hours NUMERIC(4,2) NOT NULL,
  enrolled_count INT NOT NULL,
  actual_attendance INT NOT NULL,
  hvac_active BOOLEAN NOT NULL DEFAULT TRUE,
  lighting_active BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  data_provenance VARCHAR(30) NOT NULL DEFAULT 'sensor'
);

CREATE TABLE IF NOT EXISTS resource_recommendations (
  id VARCHAR(100) PRIMARY KEY,
  recommendation_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  source_schedule_id VARCHAR(100) REFERENCES room_schedules(id),
  source_room_id VARCHAR(50) REFERENCES campus_rooms(room_id),
  target_room_id VARCHAR(50) REFERENCES campus_rooms(room_id),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  current_capacity INT NOT NULL,
  target_capacity INT NOT NULL,
  attendees INT NOT NULL,
  estimated_energy_saved_kwh NUMERIC(8,2) NOT NULL,
  estimated_cost_saved_usd NUMERIC(8,2) NOT NULL,
  estimated_co2_kg_saved NUMERIC(8,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
);

-- 12. Sustainability Reports
CREATE TABLE IF NOT EXISTS sustainability_reports (
  id VARCHAR(100) PRIMARY KEY,
  report_type VARCHAR(30) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  generator_type VARCHAR(30) NOT NULL,
  model_name VARCHAR(100),
  title VARCHAR(200) NOT NULL,
  report_json JSONB NOT NULL
);

-- Enable Realtime for Events, Incidents, Water, and Bins
ALTER PUBLICATION supabase_realtime ADD TABLE campus_events;
ALTER PUBLICATION supabase_realtime ADD TABLE campus_incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE water_meters;
ALTER PUBLICATION supabase_realtime ADD TABLE smart_bins;
