# EcoSphere AI - Shared Event & Incident Contract

## 1. Overview
This document defines the shared campus event and incident contract for EcoSphere AI. All modules (Energy, Waste, and future modules such as Water and Resource Optimization) conform to this contract to enable cross-module correlation, centralized Digital Twin visualization, unified incident management, and automated AI/rule-based sustainability reporting.

---

## 2. Shared Campus Locations
All modules reference stable, shared campus location identifiers. `location_id` is used across all events, incidents, metrics, and Digital Twin components (the deprecated term `zone_id` is strictly disallowed).

| Location ID | Name | Zone Type | Description |
|---|---|---|---|
| `CLASSROOM_101` | Lecture Hall 101 | classroom | Smart lecture hall with occupancy & lighting control |
| `CLASSROOM_102` | Seminar Room 102 | classroom | Seminar classroom with scheduled lectures |
| `AUDITORIUM_01` | Main Campus Auditorium | auditorium | 600-seat multi-purpose hall with staged load control |
| `CORRIDOR_A1` | Academic Wing Corridor A1 | corridor | High-traffic corridor with daylight dimming & motion sensing |
| `LAB_CS_01` | Computer Science Lab 1 | laboratory | Workstations, monitors, and compute cluster |
| `LAB_PHY_01` | Physics Research Lab | laboratory | Sensitive experimental equipment with protected circuits |
| `CANTEEN_01` | Central Dining Hall | dining | Food court and dining area with high organic waste output |
| `LIBRARY_01` | Central University Library | study | Multi-floor study area with paper/cardboard collection |
| `HOSTEL_01` | Student Residence Block A | residential | Dormitory cluster with 24/7 power & waste collection |
| `SPORTS_01` | Indoor Sports Complex | recreational | Gymnasium and arena |
| `ACADEMIC_BLOCK_01` | Science & Arts Complex | academic | Multi-department office and faculty complex |

---

## 3. Shared Event Schema

### 3.1 TypeScript Type Definition
```typescript
export type ModuleId = 'energy' | 'waste' | 'water' | 'resource_optimization' | 'system';

export type SeverityLevel = 'info' | 'warning' | 'critical';

export type DataStatus = 'valid' | 'stale' | 'missing' | 'invalid';

export type DataSource = 'simulated' | 'sensor' | 'manual' | 'model';

export type VerificationStatus = 'pending' | 'verified' | 'unverified' | 'not_applicable';

export interface CampusEvent {
  event_id: string; // UUID or deterministic hash
  module: ModuleId;
  location_id: string; // Stable campus location ID
  zone_type: string; // e.g. 'classroom', 'auditorium', 'corridor', 'laboratory', 'dining', etc.
  asset_id: string; // Identifier of specific load, sensor, bin, or circuit
  issue_type: string; // e.g. 'unoccupied_power_waste', 'bin_overflow_risk', 'stale_sensor_reading'
  current_value: number; // Measured or simulated magnitude
  unit: string; // e.g. 'kW', 'kWh', '%', 'ppm', 'liters'
  severity: SeverityLevel;
  timestamp: string; // ISO-8601 UTC
  data_status: DataStatus;
  data_source: DataSource;
  recommended_action: string;
  verification_status: VerificationStatus;
  details: Record<string, unknown>; // Module-specific payloads (stored as JSON)
}
```

### 3.2 SQLite Database Table Schema
```sql
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
```

---

## 4. Incidents System & Lifecycle

An **Incident** represents an ongoing, actionable issue aggregated from active campus events.

### 4.1 Deduplication Rule
Incidents are deduplicated by the composite key:
`(${module}, ${location_id}, ${asset_id}, ${issue_type})`

If an active incident (status in `open`, `acknowledged`, `in_progress`, `resolved_unverified`) exists for this key, any new or recurring event updates the existing incident:
- `current_value` is updated to the latest reading.
- `severity` is escalated if the new event is more severe.
- `event_count` increments.
- `last_event_timestamp` updates to the new event timestamp.
- Historical event IDs are appended.

### 4.2 Lifecycle State Machine
```
[ Event Arrives ]
       │
       ▼
    [ OPEN ] ──────────────► [ ACKNOWLEDGED ]
       │                            │
       └──────────────┬─────────────┘
                      ▼
               [ IN_PROGRESS ]
                      │
           (Click "Resolve" button)
                      ▼
           [ RESOLVED_UNVERIFIED ]
                      │
     ┌────────────────┴────────────────┐
     │ (Fresh valid sensor reading     │ (Documented manual
     │  confirming condition cleared)  │  inspection note)
     ▼                                 ▼
           [ VERIFIED_RESOLVED ]
```

### 4.3 Strict Verification Invariant
- Clicking "Resolve" alone in the UI **only** advances the incident to `resolved_unverified`.
- An incident transitions to `verified_resolved` **exclusively** when:
  1. A fresh reading with `data_status == 'valid'` confirms normal parameters, OR
  2. A documented manual inspection note is recorded with inspector ID/name and timestamp.

### 4.4 SQLite Incidents Table Schema
```sql
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

CREATE INDEX IF NOT EXISTS idx_incidents_composite 
ON campus_incidents(module, location_id, asset_id, issue_type, status);
```

---

## 5. API Endpoints

### 5.1 Events API
- `POST /api/events`: Ingest a single event or batch. Automatically evaluates deduplication against active incidents.
- `GET /api/events`: Query events with filters:
  - `?module=energy|waste`
  - `?location_id=CLASSROOM_101`
  - `?severity=info|warning|critical`
  - `?data_status=valid|stale|missing|invalid`
  - `?limit=50`

### 5.2 Incidents API
- `GET /api/incidents`: Retrieve active and resolved incidents.
- `PATCH /api/incidents/:id/status`: Update status (`acknowledged`, `in_progress`, `resolved_unverified`).
- `POST /api/incidents/:id/verify`: Transition to `verified_resolved` with either a verified reading payload or documented inspection note.

### 5.3 Campus Locations API
- `GET /api/locations`: Returns seed campus locations with coordinates for Digital Twin layout.

---

## 6. Global Rules Adherence
- **Data Provenance**: Every reading and event specifies `data_source` (`simulated`, `sensor`, `manual`, `model`).
- **Data Integrity**: Missing, stale, or invalid readings never default to 0; they trigger warning/critical alerts for manual inspection.
- **Simulated Control**: No real campus equipment is physically actuated; all controls are simulated.
