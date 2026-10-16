// apps/api/src/modules/registered.ts
import { registerApiModule, ModuleApiDefinition } from './registry.js';
import { router as energyRouter } from './energy/router.js';
import { router as wasteRouter } from './waste/router.js';
import { router as waterRouter } from './water/router.js';
import { resourceRouter } from './resources/router.js';

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

export const waterModuleDefinition: ModuleApiDefinition = {
  id: 'water',
  name: 'Water Management & Leak Detection',
  apiPrefix: '/api/water',
  router: waterRouter
};

export const resourceModuleDefinition: ModuleApiDefinition = {
  id: 'resources',
  name: 'Campus Space & Resource Optimization',
  apiPrefix: '/api/resources',
  router: resourceRouter
};

// Register all active modules
registerApiModule(energyModuleDefinition);
registerApiModule(wasteModuleDefinition);
registerApiModule(waterModuleDefinition);
registerApiModule(resourceModuleDefinition);

export { activeApiModules } from './registry.js';
