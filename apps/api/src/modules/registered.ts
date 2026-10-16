// apps/api/src/modules/registered.ts
import { registerApiModule, ModuleApiDefinition } from './registry.js';
import { router as energyRouter } from './energy/router.js';
import { router as wasteRouter } from './waste/router.js';

export const energyModuleDefinition: ModuleApiDefinition = {
  id: 'energy',
  name: 'Energy Efficiency Engine',
  apiPrefix: '/api/energy',
  router: energyRouter
};

export const wasteModuleDefinition: ModuleApiDefinition = {
  id: 'waste',
  name: 'EcoSort AI Waste Management',
  apiPrefix: '/api/waste',
  router: wasteRouter
};

// Register all active modules
registerApiModule(energyModuleDefinition);
registerApiModule(wasteModuleDefinition);

export { activeApiModules } from './registry.js';
