// apps/api/src/db.ts
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SHARED_CAMPUS_LOCATIONS } from '@ecosphere/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'campus_twin.db');
export const db = new Database(dbPath);

// Enable WAL mode for high performance concurrent reads and writes
db.pragma('journal_mode = WAL');

export function initDatabase() {
  db.exec(`
    -- Shared Events table
    CREATE TABLE IF NOT EXISTS campus_events (
      event_id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      location_id TEXT NOT NULL,
      zone_type TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      current_value REAL NOT NULL,
      unit TEXT NOT NULL,
      severity TEXT CHECK(severity IN ('info', 'warning', 'critical')) NOT NULL,
      timestamp TEXT NOT NULL,
      data_status TEXT CHECK(data_status IN ('valid', 'stale', 'missing', 'invalid')) NOT NULL,
      data_source TEXT CHECK(data_source IN ('simulated', 'sensor', 'manual', 'model')) NOT NULL,
      recommended_action TEXT NOT NULL,
      verification_status TEXT CHECK(verification_status IN ('pending', 'verified', 'unverified', 'not_applicable')) NOT NULL,
      details TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_events_module ON campus_events(module);
    CREATE INDEX IF NOT EXISTS idx_events_location ON campus_events(location_id);
    CREATE INDEX IF NOT EXISTS idx_events_severity ON campus_events(severity);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON campus_events(timestamp);

    -- Shared Incidents table
    CREATE TABLE IF NOT EXISTS campus_incidents (
      incident_id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      location_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT CHECK(severity IN ('info', 'warning', 'critical')) NOT NULL,
      status TEXT CHECK(status IN ('open', 'acknowledged', 'in_progress', 'resolved_unverified', 'verified_resolved')) NOT NULL DEFAULT 'open',
      first_seen_timestamp TEXT NOT NULL,
      last_seen_timestamp TEXT NOT NULL,
      event_count INTEGER NOT NULL DEFAULT 1,
      current_value REAL NOT NULL,
      unit TEXT NOT NULL,
      recommended_action TEXT NOT NULL,
      resolution_notes TEXT,
      verified_by TEXT,
      verified_at TEXT,
      data_source TEXT NOT NULL,
      data_status TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_incidents_active ON campus_incidents(module, location_id, asset_id, issue_type, status);

    -- Energy Zone State Persistence
    CREATE TABLE IF NOT EXISTS energy_zones (
      zone_id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL UNIQUE,
      zone_type TEXT NOT NULL,
      state_json TEXT NOT NULL,
      last_updated TEXT NOT NULL
    );

    -- Energy Audit Records
    CREATE TABLE IF NOT EXISTS energy_audit_records (
      record_id TEXT PRIMARY KEY,
      module TEXT NOT NULL DEFAULT 'energy',
      location_id TEXT NOT NULL,
      zone_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      occupancy INTEGER NOT NULL,
      power_kw REAL NOT NULL,
      energy_kwh REAL NOT NULL,
      eligible_loads TEXT NOT NULL,
      essential_equipment TEXT NOT NULL,
      alert TEXT,
      recommendation TEXT NOT NULL,
      data_source TEXT NOT NULL,
      data_status TEXT NOT NULL
    );

    -- Waste Module: Smart Bins
    CREATE TABLE IF NOT EXISTS smart_bins (
      bin_id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      location_name TEXT NOT NULL,
      waste_category TEXT NOT NULL,
      capacity_liters INTEGER NOT NULL,
      fill_percentage INTEGER NOT NULL,
      last_updated TEXT NOT NULL,
      data_status TEXT NOT NULL,
      collection_status TEXT NOT NULL,
      status TEXT NOT NULL,
      distance_cm REAL
    );

    -- Waste Collection Tasks
    CREATE TABLE IF NOT EXISTS collection_tasks (
      task_id TEXT PRIMARY KEY,
      bin_id TEXT NOT NULL,
      location TEXT NOT NULL,
      priority TEXT NOT NULL,
      priority_score INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      status TEXT NOT NULL,
      verification_notes TEXT,
      resolved_at TEXT
    );

    -- Waste AI Classification Log
    CREATE TABLE IF NOT EXISTS waste_classifications (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      predicted_category TEXT NOT NULL,
      confidence REAL NOT NULL,
      review_required INTEGER NOT NULL,
      manual_corrected_category TEXT,
      model_type TEXT NOT NULL,
      disposal_guideline TEXT NOT NULL,
      image_preview_url TEXT
    );

    -- AI Sustainability Reports table
    CREATE TABLE IF NOT EXISTS sustainability_reports (
      id TEXT PRIMARY KEY,
      report_type TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      generator_type TEXT NOT NULL,
      model_name TEXT,
      title TEXT NOT NULL,
      report_json TEXT NOT NULL
    );

    -- Water Module Tables
    CREATE TABLE IF NOT EXISTS water_meters (
      meter_id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      name TEXT NOT NULL,
      meter_type TEXT NOT NULL,
      flow_rate_lpm REAL NOT NULL,
      pressure_psi REAL NOT NULL,
      daily_consumption_liters REAL NOT NULL,
      baseline_night_flow_lpm REAL NOT NULL,
      leak_acoustic_db REAL NOT NULL,
      status TEXT NOT NULL,
      data_status TEXT NOT NULL,
      data_source TEXT NOT NULL,
      last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS water_tanks (
      tank_id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      capacity_liters REAL NOT NULL,
      current_volume_liters REAL NOT NULL,
      fill_percentage INTEGER NOT NULL,
      inflow_rate_lpm REAL NOT NULL,
      outflow_rate_lpm REAL NOT NULL,
      water_quality_index REAL NOT NULL,
      status TEXT NOT NULL,
      last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS water_thresholds (
      id TEXT PRIMARY KEY DEFAULT 'global',
      night_flow_leak_multiplier REAL NOT NULL,
      max_burst_flow_lpm REAL NOT NULL,
      min_line_pressure_psi REAL NOT NULL,
      acoustic_leak_threshold_db REAL NOT NULL,
      tank_low_reserve_percent REAL NOT NULL,
      tariff_per_1000_liters_usd REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS water_flow_readings (
      reading_id TEXT PRIMARY KEY,
      meter_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      flow_rate_lpm REAL NOT NULL,
      pressure_psi REAL NOT NULL,
      cumulative_liters REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campus_rooms (
      room_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      building TEXT NOT NULL,
      floor INTEGER NOT NULL,
      capacity INTEGER NOT NULL,
      room_type TEXT NOT NULL,
      has_projector INTEGER NOT NULL,
      has_computers INTEGER NOT NULL,
      base_hvac_kw REAL NOT NULL,
      lighting_kw REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_schedules (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      course_code TEXT NOT NULL,
      course_title TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_hours REAL NOT NULL,
      enrolled_count INTEGER NOT NULL,
      actual_attendance INTEGER NOT NULL,
      hvac_active INTEGER NOT NULL,
      lighting_active INTEGER NOT NULL,
      status TEXT NOT NULL,
      data_provenance TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resource_recommendations (
      id TEXT PRIMARY KEY,
      recommendation_type TEXT NOT NULL,
      priority TEXT NOT NULL,
      source_schedule_id TEXT NOT NULL,
      source_room_id TEXT NOT NULL,
      target_room_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      current_capacity INTEGER NOT NULL,
      target_capacity INTEGER NOT NULL,
      attendees INTEGER NOT NULL,
      estimated_energy_saved_kwh REAL NOT NULL,
      estimated_cost_saved_usd REAL NOT NULL,
      estimated_co2_kg_saved REAL NOT NULL,
      status TEXT NOT NULL
    );
  `);

  seedInitialDataIfEmpty();
}

export function seedInitialDataIfEmpty(forceReset: boolean = false) {
  if (forceReset) {
    db.exec(`
      DELETE FROM campus_events;
      DELETE FROM campus_incidents;
      DELETE FROM energy_zones;
      DELETE FROM energy_audit_records;
      DELETE FROM smart_bins;
      DELETE FROM collection_tasks;
      DELETE FROM waste_classifications;
      DELETE FROM sustainability_reports;
      DELETE FROM water_meters;
      DELETE FROM water_tanks;
      DELETE FROM water_thresholds;
      DELETE FROM water_flow_readings;
      DELETE FROM campus_rooms;
      DELETE FROM room_schedules;
      DELETE FROM resource_recommendations;
    `);
  }

  const eventsCount = db.prepare('SELECT COUNT(*) as c FROM campus_events').get() as { c: number };
  const waterMetersCount = db.prepare('SELECT COUNT(*) as c FROM water_meters').get() as { c: number };
  const roomsCount = db.prepare('SELECT COUNT(*) as c FROM campus_rooms').get() as { c: number };
  const needsCoreSeed = eventsCount.c === 0 || forceReset;
  const needsWaterSeed = waterMetersCount.c === 0 || forceReset;
  const needsResourceSeed = roomsCount.c === 0 || forceReset;

  if (!needsCoreSeed && !needsWaterSeed && !needsResourceSeed) {
    return;
  }

  const now = new Date().toISOString();

  // 1. Seed Energy Zones
  const insertZone = db.prepare(`
    INSERT OR REPLACE INTO energy_zones (zone_id, location_id, zone_type, state_json, last_updated)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Classroom 101 - Vacant for 8 mins (> 5 min grace), loads can be turned off
  const classroom101State = {
    locationId: 'CLASSROOM_101',
    timetableScheduled: false,
    occupancyCount: 0,
    occupancyDataStatus: 'valid',
    minutesSinceLastOccupied: 8,
    gracePeriodMinutes: 5,
    manualOverrideActive: false,
    devices: [
      { id: 'c101_lights', name: 'Main Fluorescent Troffers (x12)', powerRatingKw: 0.96, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
      { id: 'c101_projector', name: 'Ceiling Laser Projector', powerRatingKw: 0.35, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
      { id: 'c101_hvac', name: 'Classroom VRF Split Unit', powerRatingKw: 2.40, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
      { id: 'c101_emergency', name: 'Emergency Exit Luminaire', powerRatingKw: 0.04, criticality: 'safety_critical', isSimulatedOn: true, canAutoShutdown: false }
    ]
  };

  // Classroom 102 - Scheduled lecture active
  const classroom102State = {
    locationId: 'CLASSROOM_102',
    timetableScheduled: true,
    occupancyCount: 38,
    occupancyDataStatus: 'valid',
    minutesSinceLastOccupied: 0,
    gracePeriodMinutes: 5,
    manualOverrideActive: false,
    devices: [
      { id: 'c102_lights', name: 'LED Panel Array', powerRatingKw: 0.65, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
      { id: 'c102_display', name: 'Interactive Smart Board', powerRatingKw: 0.28, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
      { id: 'c102_hvac', name: 'Classroom VRF Unit', powerRatingKw: 2.10, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
      { id: 'c102_emergency', name: 'Emergency Exit Luminaire', powerRatingKw: 0.04, criticality: 'safety_critical', isSimulatedOn: true, canAutoShutdown: false }
    ]
  };

  // Auditorium 01 - Event ended 25 min ago, Stage lights still left on!
  const auditorium01State = {
    locationId: 'AUDITORIUM_01',
    eventScheduled: false,
    occupancyCount: 0,
    occupancyDataStatus: 'valid',
    entryCount: 420,
    exitCount: 420,
    verifiedEmptyByStaff: false,
    minutesSinceLastOccupied: 25,
    gracePeriodMinutes: 10,
    shutdownStageMinutes: 10,
    staffOverrideActive: false,
    devices: [
      { id: 'aud_stage_rig', name: 'Moving Head Stage Spotlights & Rig', powerRatingKw: 4.80, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
      { id: 'aud_pa', name: 'Line Array PA Sound System', powerRatingKw: 1.60, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
      { id: 'aud_hvac', name: 'Auditorium Central Chilled Air Handler', powerRatingKw: 12.50, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
      { id: 'aud_fire_alarm', name: 'Central Fire Detection & Evac Beacon', powerRatingKw: 0.15, criticality: 'safety_critical', isSimulatedOn: true, canAutoShutdown: false },
      { id: 'aud_egress_lights', name: 'Illuminated Exit Pathways', powerRatingKw: 0.30, criticality: 'safety_critical', isSimulatedOn: true, canAutoShutdown: false }
    ]
  };

  // Corridor A1 - Ample daylight (520 lux), motion active, can harvest daylight
  const corridorA1State = {
    locationId: 'CORRIDOR_A1',
    motionDetected: true,
    motionSensorDataStatus: 'valid',
    consecutiveMotionReadings: 3,
    daylightLux: 520,
    daylightSensorDataStatus: 'valid',
    daylightHysteresisThreshold: 350,
    vacancyTimeoutMinutes: 3,
    minutesSinceLastMotion: 0,
    safeStandbyLevelPercent: 25,
    devices: [
      { id: 'cor_main_lights', name: 'Corridor Linear Troffer Run', powerRatingKw: 1.20, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
      { id: 'cor_emergency', name: 'Emergency Egress Battery Pack Lights', powerRatingKw: 0.12, criticality: 'safety_critical', isSimulatedOn: true, canAutoShutdown: false }
    ]
  };

  // Lab CS 01 - Idle displays left on after class
  const labCs01State = {
    locationId: 'LAB_CS_01',
    occupied: false,
    occupancyDataStatus: 'valid',
    activeExperiment: false,
    minutesSinceLastOccupied: 40,
    gracePeriodMinutes: 15,
    devices: [
      { id: 'lab_displays', name: '30x Student IPS Workstation Displays', powerRatingKw: 1.50, criticality: 'idle_controllable', isSimulatedOn: true, canAutoShutdown: true },
      { id: 'lab_lights', name: 'Lab Overhead Lighting Banks', powerRatingKw: 0.85, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true },
      { id: 'lab_cluster', name: 'Department Deep Learning Compute Node', powerRatingKw: 1.80, criticality: 'essential', isSimulatedOn: true, canAutoShutdown: false }
    ]
  };

  // Lab Physics 01 - Active cryogenic experiment, unverified sensor
  const labPhy01State = {
    locationId: 'LAB_PHY_01',
    occupied: false,
    occupancyDataStatus: 'valid',
    activeExperiment: true,
    minutesSinceLastOccupied: 10,
    gracePeriodMinutes: 15,
    devices: [
      { id: 'phy_fume_hood', name: 'Chemical Variable Air Volume Fume Hood', powerRatingKw: 2.20, criticality: 'essential', isSimulatedOn: true, canAutoShutdown: false },
      { id: 'phy_cryocooler', name: 'Liquid Nitrogen Cryocooler Loop', powerRatingKw: 3.50, criticality: 'essential', isSimulatedOn: true, canAutoShutdown: false },
      { id: 'phy_bench_power', name: 'General Workstation Bench Sockets', powerRatingKw: 0.60, criticality: 'eligible', isSimulatedOn: true, canAutoShutdown: true }
    ]
  };

  insertZone.run('zone_c101', 'CLASSROOM_101', 'classroom', JSON.stringify(classroom101State), now);
  insertZone.run('zone_c102', 'CLASSROOM_102', 'classroom', JSON.stringify(classroom102State), now);
  insertZone.run('zone_aud01', 'AUDITORIUM_01', 'auditorium', JSON.stringify(auditorium01State), now);
  insertZone.run('zone_corA1', 'CORRIDOR_A1', 'corridor', JSON.stringify(corridorA1State), now);
  insertZone.run('zone_labCs', 'LAB_CS_01', 'laboratory', JSON.stringify(labCs01State), now);
  insertZone.run('zone_labPhy', 'LAB_PHY_01', 'laboratory', JSON.stringify(labPhy01State), now);

  // 2. Seed 10 Smart Bins (distributed across campus locations)
  const insertBin = db.prepare(`
    INSERT OR REPLACE INTO smart_bins (
      bin_id, location_id, location_name, waste_category, capacity_liters,
      fill_percentage, last_updated, data_status, collection_status, status, distance_cm
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const demoBins = [
    { bin_id: 'BIN_CANTEEN_ORG_01', location_id: 'CANTEEN_01', location_name: 'Central Dining Hall - Tray Drop', waste_category: 'organic', capacity_liters: 240, fill: 96, status: 'critical', data_status: 'valid' },
    { bin_id: 'BIN_CANTEEN_PLS_01', location_id: 'CANTEEN_01', location_name: 'Central Dining Hall - Beverage Area', waste_category: 'plastic', capacity_liters: 180, fill: 88, status: 'collection_recommended', data_status: 'valid' },
    { bin_id: 'BIN_LIBRARY_PPR_01', location_id: 'LIBRARY_01', location_name: 'Central Library - Study Floor 1', waste_category: 'paper_cardboard', capacity_liters: 120, fill: 74, status: 'approaching', data_status: 'valid' },
    { bin_id: 'BIN_LIBRARY_GEN_01', location_id: 'LIBRARY_01', location_name: 'Central Library - Entrance Lobby', waste_category: 'other_uncertain', capacity_liters: 120, fill: 42, status: 'normal', data_status: 'valid' },
    { bin_id: 'BIN_ACAD_PPR_01', location_id: 'ACADEMIC_BLOCK_01', location_name: 'Academic Block 01 - Copier Station', waste_category: 'paper_cardboard', capacity_liters: 200, fill: 97, status: 'critical', data_status: 'valid' },
    { bin_id: 'BIN_HOSTEL_GEN_01', location_id: 'HOSTEL_01', location_name: 'Hostel Block A - Common Lounge', waste_category: 'other_uncertain', capacity_liters: 240, fill: 78, status: 'approaching', data_status: 'valid' },
    { bin_id: 'BIN_HOSTEL_PLS_01', location_id: 'HOSTEL_01', location_name: 'Hostel Block A - Laundry Entrance', waste_category: 'plastic', capacity_liters: 180, fill: 55, status: 'normal', data_status: 'valid' },
    { bin_id: 'BIN_AUD_MTL_01', location_id: 'AUDITORIUM_01', location_name: 'Main Auditorium - East Foyer', waste_category: 'metal', capacity_liters: 120, fill: 35, status: 'normal', data_status: 'valid' },
    { bin_id: 'BIN_SPORTS_PLS_01', location_id: 'SPORTS_01', location_name: 'Indoor Sports Complex - Gym Bleachers', waste_category: 'plastic', capacity_liters: 180, fill: 91, status: 'collection_recommended', data_status: 'valid' },
    { bin_id: 'BIN_SPORTS_GLS_01', location_id: 'SPORTS_01', location_name: 'Indoor Sports Complex - Juice Bar', waste_category: 'glass', capacity_liters: 120, fill: 20, status: 'normal', data_status: 'valid' }
  ];

  for (const b of demoBins) {
    const distance = Number(((1 - b.fill / 100) * 100).toFixed(1));
    insertBin.run(
      b.bin_id,
      b.location_id,
      b.location_name,
      b.waste_category,
      b.capacity_liters,
      b.fill,
      now,
      b.data_status,
      b.fill >= 85 ? 'scheduled' : 'normal',
      b.status,
      distance
    );
  }

  // 3. Seed Initial Campus Events conforming to SHARED_CONTRACT
  const insertEvent = db.prepare(`
    INSERT OR REPLACE INTO campus_events (
      event_id, module, location_id, zone_type, asset_id, issue_type,
      current_value, unit, severity, timestamp, data_status, data_source,
      recommended_action, verification_status, details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialEvents = [
    {
      event_id: 'evt_en_aud01_init',
      module: 'energy',
      location_id: 'AUDITORIUM_01',
      zone_type: 'auditorium',
      asset_id: 'pwr_meter_auditorium_01',
      issue_type: 'unoccupied_power_waste',
      current_value: 18.9,
      unit: 'kW',
      severity: 'critical',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      data_status: 'valid',
      data_source: 'simulated',
      recommended_action: 'Perform staged simulated shutdown of AV and HVAC circuits; verify aisles clear.',
      verification_status: 'unverified',
      details: JSON.stringify({ minutesVacant: 25, stageOffKw: 6.4, totalEligibleKw: 18.9 })
    },
    {
      event_id: 'evt_wst_canteen_init',
      module: 'waste',
      location_id: 'CANTEEN_01',
      zone_type: 'waste_collection_point',
      asset_id: 'BIN_CANTEEN_ORG_01',
      issue_type: 'bin_overflow_imminent',
      current_value: 96,
      unit: '%',
      severity: 'critical',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      data_status: 'valid',
      data_source: 'simulated',
      recommended_action: 'Dispatch rapid custodial collection immediately to prevent food waste spill.',
      verification_status: 'unverified',
      details: JSON.stringify({ category: 'organic', capacity_liters: 240 })
    },
    {
      event_id: 'evt_wst_acad_init',
      module: 'waste',
      location_id: 'ACADEMIC_BLOCK_01',
      zone_type: 'waste_collection_point',
      asset_id: 'BIN_ACAD_PPR_01',
      issue_type: 'bin_overflow_imminent',
      current_value: 97,
      unit: '%',
      severity: 'critical',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      data_status: 'valid',
      data_source: 'simulated',
      recommended_action: 'Empty paper recycling bin to prevent fire hazard and walkway obstruction.',
      verification_status: 'unverified',
      details: JSON.stringify({ category: 'paper_cardboard', capacity_liters: 200 })
    },
    {
      event_id: 'evt_en_c101_init',
      module: 'energy',
      location_id: 'CLASSROOM_101',
      zone_type: 'classroom',
      asset_id: 'pwr_meter_classroom_101',
      issue_type: 'unoccupied_power_waste_mitigated',
      current_value: 3.71,
      unit: 'kW',
      severity: 'warning',
      timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      data_status: 'valid',
      data_source: 'simulated',
      recommended_action: 'Automated 5-min grace window passed. Eligible lighting & HVAC switched off in simulation.',
      verification_status: 'unverified',
      details: JSON.stringify({ minutesVacant: 8, potentialSavingsKw: 3.67 })
    },
    {
      event_id: 'evt_wst_sports_init',
      module: 'waste',
      location_id: 'SPORTS_01',
      zone_type: 'waste_collection_point',
      asset_id: 'BIN_SPORTS_PLS_01',
      issue_type: 'bin_collection_recommended',
      current_value: 91,
      unit: '%',
      severity: 'warning',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      data_status: 'valid',
      data_source: 'simulated',
      recommended_action: 'Schedule plastics bin pickup prior to evening volleyball tournament.',
      verification_status: 'unverified',
      details: JSON.stringify({ category: 'plastic', capacity_liters: 180 })
    }
  ];

  for (const ev of initialEvents) {
    insertEvent.run(
      ev.event_id,
      ev.module,
      ev.location_id,
      ev.zone_type,
      ev.asset_id,
      ev.issue_type,
      ev.current_value,
      ev.unit,
      ev.severity,
      ev.timestamp,
      ev.data_status,
      ev.data_source,
      ev.recommended_action,
      ev.verification_status,
      ev.details
    );
  }

  // 4. Seed Deduplicated Incidents from Initial Events
  const insertIncident = db.prepare(`
    INSERT OR REPLACE INTO campus_incidents (
      incident_id, module, location_id, asset_id, issue_type, title,
      description, severity, status, first_seen_timestamp, last_seen_timestamp,
      event_count, current_value, unit, recommended_action, data_source, data_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertIncident.run(
    'inc_aud01_power',
    'energy',
    'AUDITORIUM_01',
    'pwr_meter_auditorium_01',
    'unoccupied_power_waste',
    'High Unoccupied Load in Main Auditorium',
    'Auditorium has been vacant for 25 minutes after event schedule, but 18.9 kW load (stage rig & HVAC) remains active.',
    'critical',
    'open',
    new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    now,
    3,
    18.9,
    'kW',
    'Perform staged simulated shutdown of AV and HVAC circuits; verify aisles clear.',
    'simulated',
    'valid'
  );

  insertIncident.run(
    'inc_canteen_bin_overflow',
    'waste',
    'CANTEEN_01',
    'BIN_CANTEEN_ORG_01',
    'bin_overflow_imminent',
    'Critical Organic Bin Fill at Central Dining Hall',
    'Compost bin is at 96% capacity during peak lunch hours. High risk of overflow.',
    'critical',
    'open',
    new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    now,
    2,
    96,
    '%',
    'Dispatch rapid custodial collection immediately to prevent food waste spill.',
    'simulated',
    'valid'
  );

  insertIncident.run(
    'inc_acad_bin_overflow',
    'waste',
    'ACADEMIC_BLOCK_01',
    'BIN_ACAD_PPR_01',
    'bin_overflow_imminent',
    'Critical Paper Recycling Bin Fill at Academic Block',
    'Paper bin at copier room reached 97% capacity. High fire hazard and clutter risk.',
    'critical',
    'acknowledged',
    new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    now,
    1,
    97,
    '%',
    'Empty paper recycling bin to prevent fire hazard and walkway obstruction.',
    'simulated',
    'valid'
  );

  insertIncident.run(
    'inc_c101_waste',
    'energy',
    'CLASSROOM_101',
    'pwr_meter_classroom_101',
    'unoccupied_power_waste_mitigated',
    'Classroom 101 Vacancy Optimization',
    'Classroom 101 vacant past 5 min grace period. Non-essential loads placed in simulated eco-standby.',
    'warning',
    'in_progress',
    new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    now,
    2,
    3.71,
    'kW',
    'Automated 5-min grace window passed. Verify classroom locked.',
    'simulated',
    'valid'
  );

  // 5. Seed Initial Collection Tasks
  const insertTask = db.prepare(`
    INSERT OR REPLACE INTO collection_tasks (
      task_id, bin_id, location, priority, priority_score, reason,
      created_at, assigned_to, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTask.run(
    'task_wst_canteen_01',
    'BIN_CANTEEN_ORG_01',
    'Central Dining Hall - Tray Drop',
    'critical',
    95,
    'Fill level: 96%; CRITICAL overflow threshold exceeded; Food service dining zone',
    new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    'Custodial Team A (Zone 1)',
    'in_progress'
  );

  insertTask.run(
    'task_wst_acad_01',
    'BIN_ACAD_PPR_01',
    'Academic Block 01 - Copier Station',
    'critical',
    96,
    'Fill level: 97%; CRITICAL overflow threshold exceeded; Copier room fire prevention',
    new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    'Custodial Team B (Zone 2)',
    'assigned'
  );

  // 6. Seed Sample Classification History
  const insertClassification = db.prepare(`
    INSERT OR REPLACE INTO waste_classifications (
      id, timestamp, predicted_category, confidence, review_required,
      manual_corrected_category, model_type, disposal_guideline, image_preview_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertClassification.run(
    'cls_001',
    new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    'plastic',
    0.94,
    0,
    null,
    'model',
    'Rinse bottles/containers and place in YELLOW Plastics Bin. Caps on.',
    'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?w=300'
  );

  insertClassification.run(
    'cls_002',
    new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    'paper_cardboard',
    0.89,
    0,
    null,
    'model',
    'Flatten boxes and deposit in BLUE Dry Recyclables Bins. Keep free of food grease/moisture.',
    'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=300'
  );

  insertClassification.run(
    'cls_003',
    new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    'other_uncertain',
    0.54,
    1,
    'metal',
    'model',
    'Deposit in GREY General Landfill Waste. Low confidence flagged for review.',
    'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=300'
  );

  // 7. Seed Water Module
  if (needsWaterSeed) {
    const insertWaterThresholds = db.prepare(`
      INSERT OR REPLACE INTO water_thresholds (
        id, night_flow_leak_multiplier, max_burst_flow_lpm, min_line_pressure_psi,
        acoustic_leak_threshold_db, tank_low_reserve_percent, tariff_per_1000_liters_usd
      ) VALUES ('global', 2.2, 90.0, 32.0, 52.0, 25.0, 1.85)
    `);
    insertWaterThresholds.run();

    // 8. Seed Water Meters
    const insertWaterMeter = db.prepare(`
      INSERT OR REPLACE INTO water_meters (
        meter_id, location_id, name, meter_type, flow_rate_lpm, pressure_psi,
        daily_consumption_liters, baseline_night_flow_lpm, leak_acoustic_db,
        status, data_status, data_source, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertWaterMeter.run('WM_CANTEEN_01', 'CANTEEN_01', 'Dining Hall & Kitchen Main Feed', 'main_feed', 24.5, 52.0, 8420, 1.5, 28.0, 'normal', 'valid', 'simulated', now);
    insertWaterMeter.run('WM_HOSTEL_01', 'HOSTEL_01', 'Hostel Block A Main Riser', 'main_feed', 38.0, 50.5, 14250, 3.2, 31.0, 'normal', 'valid', 'simulated', now);
    insertWaterMeter.run('WM_ACAD_01', 'ACADEMIC_BLOCK_01', 'Academic Block 01 Central Sub-meter', 'sub_feed', 12.0, 54.0, 4120, 0.8, 29.5, 'normal', 'valid', 'simulated', now);
    insertWaterMeter.run('WM_SPORTS_01', 'SPORTS_01', 'Sports Complex & Aquatic Center Supply', 'sub_feed', 18.2, 42.0, 6850, 1.0, 58.5, 'leak_suspected', 'valid', 'simulated', now);
    insertWaterMeter.run('WM_RESTROOM_C101', 'CLASSROOM_101', 'Classroom 101 Lecture Wing Restroom Line', 'restroom', 9.4, 51.0, 3200, 0.4, 34.0, 'abnormal_flow', 'valid', 'simulated', now);
    insertWaterMeter.run('WM_LAB_PHY_01', 'LAB_PHY_01', 'Physics Cryogenic & Chiller Return', 'cooling_tower', 16.0, 58.0, 5800, 12.0, 27.0, 'normal', 'valid', 'simulated', now);
    insertWaterMeter.run('WM_IRRIG_01', 'AUDITORIUM_01', 'Main Auditorium & Quad Lawn Irrigation', 'irrigation', 0.0, 55.0, 1800, 0.0, 22.0, 'normal', 'valid', 'simulated', now);

    // 9. Seed Water Tanks
    const insertWaterTank = db.prepare(`
      INSERT OR REPLACE INTO water_tanks (
        tank_id, location_id, name, type, capacity_liters, current_volume_liters,
        fill_percentage, inflow_rate_lpm, outflow_rate_lpm, water_quality_index,
        status, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertWaterTank.run('TANK_OVERHEAD_ACAD', 'ACADEMIC_BLOCK_01', 'Academic Block Overhead Tank', 'overhead_potable', 40000, 31200, 78, 45, 12, 95, 'optimal', now);
    insertWaterTank.run('TANK_RAINWATER_CENTRAL', 'LIBRARY_01', 'Central Rainwater Harvesting Cistern', 'rainwater_harvesting', 100000, 82500, 82, 0, 8, 92, 'optimal', now);
    insertWaterTank.run('TANK_HOSTEL_SUMP', 'HOSTEL_01', 'Hostel Ground Sump', 'ground_sump', 60000, 28500, 47, 50, 38, 94, 'optimal', now);
    insertWaterTank.run('TANK_CANTEEN_RECYCLED', 'CANTEEN_01', 'Canteen Greywater Reclamation Tank', 'recycled_greywater', 25000, 4500, 18, 15, 20, 81, 'low_reserve', now);

    // 10. Seed Water Historical Time-Series Readings (last 12 hours)
    const insertFlowReading = db.prepare(`
      INSERT OR REPLACE INTO water_flow_readings (
        reading_id, meter_id, location_id, timestamp, flow_rate_lpm, pressure_psi, cumulative_liters
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 12; i >= 0; i--) {
      const ts = new Date(Date.now() - i * 60 * 60 * 1000).toISOString();
      insertFlowReading.run(`rd_canteen_${i}`, 'WM_CANTEEN_01', 'CANTEEN_01', ts, Number((20 + Math.sin(i) * 5).toFixed(1)), 52.0, 8420 - i * 500);
      insertFlowReading.run(`rd_hostel_${i}`, 'WM_HOSTEL_01', 'HOSTEL_01', ts, Number((35 + Math.cos(i) * 8).toFixed(1)), 50.5, 14250 - i * 800);
      insertFlowReading.run(`rd_acad_${i}`, 'WM_ACAD_01', 'ACADEMIC_BLOCK_01', ts, Number((11 + Math.sin(i * 0.5) * 3).toFixed(1)), 54.0, 4120 - i * 250);
      insertFlowReading.run(`rd_sports_${i}`, 'WM_SPORTS_01', 'SPORTS_01', ts, 18.2, 42.0, 6850 - i * 400);
      insertFlowReading.run(`rd_restroom_${i}`, 'WM_RESTROOM_C101', 'CLASSROOM_101', ts, 9.4, 51.0, 3200 - i * 200);
    }

    // 11. Seed Initial Water Incidents & Events
    const insertWaterEvent = db.prepare(`
      INSERT OR REPLACE INTO campus_events (
        event_id, module, location_id, zone_type, asset_id, issue_type,
        current_value, unit, severity, timestamp, data_status, data_source,
        recommended_action, verification_status, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertWaterEvent.run(
      'evt_wat_sports_01',
      'water',
      'SPORTS_01',
      'recreational',
      'WM_SPORTS_01',
      'pipe_acoustic_pinhole_leak',
      58.5,
      'dB',
      'warning',
      new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      'valid',
      'simulated',
      'Schedule ultrasonic acoustic survey to pinpoint sub-slab fissure along sports complex perimeter feed.',
      'unverified',
      JSON.stringify({ flow_rate_lpm: 18.2, pressure_psi: 42.0, acoustic_db: 58.5, estimated_loss_lph: 55 })
    );

    insertWaterEvent.run(
      'evt_wat_c101_01',
      'water',
      'CLASSROOM_101',
      'classroom',
      'WM_RESTROOM_C101',
      'continuous_restroom_flapper_leak',
      9.4,
      'L/min',
      'warning',
      new Date(Date.now() - 48 * 60 * 1000).toISOString(),
      'valid',
      'simulated',
      'Inspect and overhaul lecture block restroom toilet flapper valve and automatic flush sensor.',
      'unverified',
      JSON.stringify({ flow_rate_lpm: 9.4, pressure_psi: 51.0, duration_minutes: 48, estimated_loss_lph: 564 })
    );

    const insertWaterIncident = db.prepare(`
      INSERT OR REPLACE INTO campus_incidents (
        incident_id, module, location_id, asset_id, issue_type, title, description,
        severity, status, first_seen_timestamp, last_seen_timestamp, event_count,
        current_value, unit, recommended_action, resolution_notes, verified_by, verified_at,
        data_source, data_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertWaterIncident.run(
      'inc_water_sports_acoustic',
      'water',
      'SPORTS_01',
      'WM_SPORTS_01',
      'pipe_acoustic_pinhole_leak',
      'Sub-slab Acoustic Pipe Leak Detected',
      'Ultrasonic vibration sensor on Sports Complex supply line registered 58.5 dB (threshold: 52 dB), consistent with a pressurized underground pipe fracture leaking ~55 L/h.',
      'warning',
      'open',
      new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      new Date().toISOString(),
      2,
      58.5,
      'dB',
      'Deploy acoustic correlator equipment to pinpoint sub-slab fissure and isolate valve WM_SPORTS_01 if pressure drops further.',
      null,
      null,
      null,
      'simulated',
      'valid'
    );

    insertWaterIncident.run(
      'inc_water_c101_restroom',
      'water',
      'CLASSROOM_101',
      'WM_RESTROOM_C101',
      'continuous_restroom_flapper_leak',
      'Continuous Restroom Flushometer Leak',
      'Restroom branch flow meter indicates unbroken 9.4 L/min flow for over 48 minutes, indicating toilet cistern seal degradation.',
      'warning',
      'in_progress',
      new Date(Date.now() - 48 * 60 * 1000).toISOString(),
      new Date().toISOString(),
      3,
      9.4,
      'L/min',
      'Inspect and replace worn toilet flapper gasket or adjust automatic flush sensor sensitivity.',
      null,
      null,
      null,
      'simulated',
      'valid'
    );
  }

  // 6. Seed Campus Rooms and Academic Schedules for Resource Optimization
  if (needsResourceSeed) {
    const insertRoom = db.prepare(`
      INSERT OR REPLACE INTO campus_rooms (
        room_id, name, building, floor, capacity, room_type, has_projector, has_computers, base_hvac_kw, lighting_kw
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const roomsData = [
      ['LH-101', 'Main Lecture Hall 101', 'Academic Block A', 1, 160, 'lecture_hall', 1, 0, 18.0, 3.0],
      ['LH-201', 'Science Lecture Hall 201', 'Science & Tech Wing', 2, 120, 'lecture_hall', 1, 0, 14.0, 2.2],
      ['CR-101', 'Smart Classroom 101', 'Academic Block A', 1, 60, 'classroom', 1, 0, 6.0, 1.0],
      ['CR-102', 'Smart Classroom 102', 'Academic Block A', 1, 60, 'classroom', 1, 0, 6.0, 1.0],
      ['SR-201', 'Seminar Room 201', 'Academic Block A', 2, 35, 'seminar', 1, 0, 3.5, 0.6],
      ['SR-202', 'Seminar Room 202', 'Academic Block A', 2, 35, 'seminar', 1, 0, 3.5, 0.6],
      ['CL-301', 'Computer Lab 301', 'Science & Tech Wing', 3, 45, 'computer_lab', 1, 1, 9.0, 1.5],
      ['CL-302', 'AI & Robotics Lab 302', 'Science & Tech Wing', 3, 40, 'computer_lab', 1, 1, 8.5, 1.4]
    ];

    for (const r of roomsData) {
      insertRoom.run(...r);
    }

    const insertSchedule = db.prepare(`
      INSERT OR REPLACE INTO room_schedules (
        id, room_id, course_code, course_title, day_of_week, start_time, end_time, duration_hours,
        enrolled_count, actual_attendance, hvac_active, lighting_active, status, data_provenance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const schedulesData = [
      ['sched_mon_lh101_09', 'LH-101', 'ENV101', 'Introduction to Sustainability', 'Monday', '09:00', '11:00', 2, 28, 22, 1, 1, 'scheduled', 'sensor'],
      ['sched_mon_cr101_09', 'CR-101', 'MATH105', 'Calculus for Engineers', 'Monday', '09:00', '10:30', 1.5, 54, 50, 1, 1, 'scheduled', 'sensor'],
      ['sched_mon_cl301_10', 'CL-301', 'CS301', 'Distributed Systems Lab', 'Monday', '10:00', '12:00', 2, 42, 38, 1, 1, 'scheduled', 'sensor'],
      ['sched_mon_lh201_14', 'LH-201', 'PHYS201', 'Thermodynamics & Energy Systems', 'Monday', '14:00', '16:00', 2, 30, 24, 1, 1, 'scheduled', 'sensor'],
      ['sched_mon_cl302_15', 'CL-302', 'ROB401', 'Advanced Robotics Seminar', 'Monday', '15:30', '17:30', 2, 18, 15, 1, 1, 'scheduled', 'sensor'],
      ['sched_tue_lh101_10', 'LH-101', 'ECON101', 'Principles of Economics', 'Tuesday', '10:00', '12:00', 2, 150, 142, 1, 1, 'scheduled', 'sensor'],
      ['sched_tue_sr201_11', 'SR-201', 'PHIL210', 'Environmental Ethics', 'Tuesday', '11:00', '12:30', 1.5, 30, 28, 1, 1, 'scheduled', 'sensor'],
      ['sched_wed_cr102_13', 'CR-102', 'ENG202', 'Technical Communications', 'Wednesday', '13:00', '15:00', 2, 24, 20, 1, 1, 'scheduled', 'sensor'],
      ['sched_thu_lh201_09', 'LH-201', 'CHEM101', 'General Chemistry Lecture', 'Thursday', '09:00', '11:00', 2, 115, 108, 1, 1, 'scheduled', 'sensor'],
      ['sched_fri_sr202_14', 'SR-202', 'URB350', 'Smart City Planning Workshop', 'Friday', '14:00', '16:00', 2, 32, 30, 1, 1, 'scheduled', 'sensor']
    ];

    for (const s of schedulesData) {
      insertSchedule.run(...s);
    }
  }
}

