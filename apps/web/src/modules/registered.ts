// apps/web/src/modules/registered.ts
import { registerAppModule, AppModuleDefinition } from './registry';
import { EnergyPage } from '../pages/EnergyPage';
import { WastePage } from '../pages/WastePage';
import { WaterPage } from '../pages/WaterPage';
import { ResourcePage } from '../pages/ResourcePage';
import { Zap, Trash2, Droplet, Sliders } from 'lucide-react';
import React from 'react';

export const energyAppModule: AppModuleDefinition = {
  id: 'energy',
  name: 'Energy Efficiency',
  route: '/energy',
  icon: Zap,
  installed: true,
  navOrder: 10,
  component: EnergyPage,
  description: 'Pure-function decision engine for classrooms, auditoriums, corridors and labs'
};

export const wasteAppModule: AppModuleDefinition = {
  id: 'waste',
  name: 'EcoSort AI (Waste)',
  route: '/waste',
  icon: Trash2,
  installed: true,
  navOrder: 20,
  component: WastePage,
  description: 'Ultrasonic bin monitoring, AI segregation and prioritized custodial collection'
};

export const waterAppModule: AppModuleDefinition = {
  id: 'water',
  name: 'Water Management',
  route: '/water',
  icon: Droplet,
  installed: true,
  navOrder: 30,
  component: WaterPage,
  description: 'Acoustic leak detection, flow metering, minimum night flow analytics, and rainwater cisterns'
};

export const resourceOptimizationAppModule: AppModuleDefinition = {
  id: 'resource_optimization',
  name: 'Resource Optimization',
  route: '/resources',
  icon: Sliders,
  installed: true,
  navOrder: 40,
  component: ResourcePage,
  description: 'Classroom capacity rebalancing, timetable optimization, and wing HVAC setback automation'
};

// Register all modules into the registry
registerAppModule(energyAppModule);
registerAppModule(wasteAppModule);
registerAppModule(waterAppModule);
registerAppModule(resourceOptimizationAppModule);

export { registeredModules } from './registry';
