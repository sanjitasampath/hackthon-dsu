# Guide: Adding a New Module to EcoSphere AI

EcoSphere AI is designed with a pluggable, modular architecture. Adding a new module (for example, Water Management, Resource Optimization, or Air Quality) **does NOT require editing any existing module's code**.

---

## 1. Module Contract Principles

Every module in EcoSphere AI must follow these architectural rules:
1. **Isolated Logic**: Core domain decisions must live in pure, testable functions (e.g. `/modules/<name>/src/`).
2. **Shared Contract Compliance**: Any telemetry, anomalies, or recommendations must map to the shared `CampusEvent` schema defined in `docs/SHARED_CONTRACT.md`.
3. **Location IDs**: Always use official shared campus location IDs (`CLASSROOM_101`, `CANTEEN_01`, etc.). Never invent custom IDs or use legacy keys like `zone_id`.
4. **Data Provenance**: Every metric and event must declare `data_source` (`simulated`, `sensor`, `manual`, `model`) and `data_status` (`valid`, `stale`, `missing`, `invalid`).
5. **No Direct Inter-Module Dependencies**: Modules communicate through the shared incident/event API and database tables, never by importing internal states of other modules.

---

## 2. Steps to Add a New Module

### Step 1: Create the Logic Package (`/modules/<module_name>`)
Create a new directory in `/modules/<module_name>`:
```
modules/<module_name>/
├── package.json
├── src/
│   ├── types.ts
│   ├── engine.ts       # Pure calculation and rule logic
│   └── index.ts
└── tests/
    └── engine.test.ts  # Vitest unit tests
```

Ensure all pure decision logic is separated from any HTTP or UI concerns.

### Step 2: Implement Backend API Router (`/apps/api/src/modules/<module_name>`)
Create the router in `apps/api/src/modules/<module_name>/router.ts`:
```typescript
import { Router } from 'express';
import { db } from '../../db.js';

export const router = Router();

router.get('/metrics', (req, res) => {
  // Return module-specific metrics
  res.json({ status: 'ok', data: [] });
});
```

Export a module registration object from `apps/api/src/modules/<module_name>/index.ts`:
```typescript
import { ModuleApiDefinition } from '../registry.js';
import { router } from './router.js';

export const moduleDefinition: ModuleApiDefinition = {
  id: 'water',
  name: 'Water Management',
  apiPrefix: '/api/water',
  router: router,
  onInit: async (db) => {
    // Run any module-specific table creation or seed migrations
  }
};
```

Register the module in `apps/api/src/modules/registered.ts` by adding it to the exported list:
```typescript
import { moduleDefinition as waterModule } from './water/index.js';

export const activeModules = [
  // ... existing modules
  waterModule
];
```

### Step 3: Implement Frontend UI & Route (`/apps/web/src/modules/<module_name>`)
Create the module view component in `apps/web/src/modules/<module_name>/index.tsx`:
```tsx
import React from 'react';
import { Droplet } from 'lucide-react';
import { AppModuleDefinition } from '../registry';

export const WaterPage: React.FC = () => {
  return (
    <div className="p-6 text-slate-100">
      <h1 className="text-2xl font-bold">Water Management</h1>
      {/* Module UI */}
    </div>
  );
};

export const waterModuleDefinition: AppModuleDefinition = {
  id: 'water',
  name: 'Water Management',
  route: '/water',
  icon: Droplet,
  installed: true, // Set to true when implemented
  navOrder: 30,
  component: WaterPage
};
```

Register it in `apps/web/src/modules/registered.ts`:
```typescript
import { waterModuleDefinition } from './water';

export const registeredModules = [
  // ... existing
  waterModuleDefinition
];
```

The app shell, sidebar navigation, dynamic routing, and digital twin cross-module queries will automatically pick up your new module!
