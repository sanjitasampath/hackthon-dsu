# EcoSphere AI — Campus Digital Twin Deployment & Setup Guide

This guide documents environment setup, free AI model integration via OpenRouter, backend SQLite / Supabase configurations, and test procedures.

---

## 1. System Requirements & Architecture

- **Runtime:** Node.js v18.0.0 or higher (v20+ recommended)
- **Package Manager:** npm v9.0.0 or higher (workspaces enabled)
- **Default Database:** SQLite3 (`better-sqlite3` with WAL mode enabled at `apps/api/data/campus_twin.db`)
- **Cloud Database (Optional):** Supabase / PostgreSQL (DDL located in `supabase/schema.sql`)
- **Backend API:** Express + TypeScript (`apps/api` running on port 3001)
- **Frontend App:** React 18 + Vite + TailwindCSS (`apps/web` running on port 5173)

---

## 2. Environment Configuration

### Backend API (`apps/api/.env`)

```ini
PORT=3001
CORS_ORIGIN=http://localhost:5173

# OpenRouter Free Model Integration
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Text & Sustainability Intelligence (Strictly Free, Zero Token Cost)
OPENROUTER_TEXT_MODEL=liquid/lfm-2.5-2.6b:free

# Computer Vision & Waste Segregation (Strictly Free, Zero Token Cost)
OPENROUTER_VISION_MODEL=nvidia/nemotron-3.5-super-vl:free

# Google Gemini API Key (Optional secondary fallback)
GEMINI_API_KEY=
```

### Frontend Web (`apps/web/.env`)

```ini
VITE_API_URL=http://localhost:3001
```

---

## 3. Installation & Startup Commands

### Install All Workspace Dependencies
```bash
npm install
```

### Run Full Stack in Development Mode
Starts both the Express API (port 3001) and Vite dev server (port 5173) simultaneously:
```bash
npm run dev
```

### Run Services Individually
```bash
# Terminal 1: API Server with tsx hot-reloading
npm run dev:api

# Terminal 2: Web Client with Vite HMR
npm run dev:web
```

### Production Build
```bash
npm run build
```

---

## 4. Test Suite Execution

EcoSphere AI includes comprehensive Vitest unit and integration suites verifying all algorithmic invariants:

```bash
# Run all 52 monorepo tests across all packages:
npm test

# Run individual test suites:
npm run test:api        # API database & route integration (10 tests)
npm run test:energy     # Energy efficiency, grace periods & overrides (13 tests)
npm run test:waste      # Waste bin geometry, thresholds & task routing (6 tests)
npm run test:water      # Water burst detection, acoustic leaks & tanks (12 tests)
npm run test:resources  # Space utilization & room right-sizing (9 tests)
npm run test:web        # Frontend contracts & module registry (3 tests)
```

---

## 5. Free AI Models on OpenRouter

EcoSphere AI is configured to use **100% free models (`:free`)** via OpenRouter:

| Task | Model Identifier | Free Tier Limits | Inferred Latency | Capability |
| :--- | :--- | :--- | :--- | :--- |
| **Waste Computer Vision** | `nvidia/nemotron-3.5-super-vl:free` | Free | ~2.5s | Visual categorization of waste items (plastic, paper, metal, glass, organic) |
| **Sustainability Reporting** | `liquid/lfm-2.5-2.6b:free` | Free | ~0.8s | Deterministic synthesis of campus energy, water leaks, and space recommendations |

*Fallback Note:* If the OpenRouter API key is unavailable or the network is offline, the platform automatically fails over to its deterministic pure-function heuristic engines without breaking or halting.

---

## 6. Real-World Sensor Hardware Ingestion

### ESP32 Ultrasonic Smart Bin Distance Sensor
Smart bins ingest distance readings to compute fill percentages:
```bash
curl -X POST http://localhost:3001/api/waste/sensor-readings \
  -H "Content-Type: application/json" \
  -d '{
    "bin_id": "BIN_CANTEEN_ORG_01",
    "distance_cm": 15.0,
    "total_depth_cm": 100.0
  }'
```

### Water Flow Pulse & Acoustic Vibration Meters
Water sub-meters ingest live LPM and pipe vibration dB:
```bash
curl -X POST http://localhost:3001/api/water/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "meter_id": "WM_SPORTS_01",
    "flow_rate_lpm": 18.2,
    "pressure_psi": 42.0,
    "leak_acoustic_db": 58.5,
    "data_status": "valid"
  }'
```

### Room Timetable & Attendance Ingestion
Classroom seat sensors update attendance dynamically:
```bash
curl -X POST http://localhost:3001/api/resources/simulate-schedule \
  -H "Content-Type: application/json" \
  -d '{
    "schedule_id": "sched_mon_lh101_09",
    "actual_attendance": 22
  }'
```
