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
  `);

  seedInitialDataIfEmpty();
}

export function seedInitialDataIfEmpty(forceReset: boolean = false) {
  const eventsCount = db.prepare('SELECT COUNT(*) as c FROM campus_events').get() as { c: number };
  if (eventsCount.c > 0 && !forceReset) {
    return;
  }

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
    `);
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
}
