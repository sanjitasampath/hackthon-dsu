// apps/web/src/modules/registered.ts
import { registerAppModule, AppModuleDefinition } from './registry';
import { EnergyPage } from '../pages/EnergyPage';
import { WastePage } from '../pages/WastePage';
import { PlaceholderModulePage } from '../pages/PlaceholderModulePage';
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
  installed: false,
  navOrder: 30,
  component: () => React.createElement(PlaceholderModulePage, {
    moduleName: 'Water Management',
    icon: Droplet,
    plannedFeatures: [
      'Acoustic water pipe leak detection telemetry',
      'Smart meter flow rate anomaly identification',
      'Rainwater harvesting tank fill optimization',
      'Restroom automated fixture flush conservation'
    ]
  }),
  description: 'Placeholder module (Not installed)'
};

export const resourceOptimizationAppModule: AppModuleDefinition = {
  id: 'resource_optimization',
  name: 'Resource Optimization',
  route: '/resources',
  icon: Sliders,
  installed: false,
  navOrder: 40,
  component: () => React.createElement(PlaceholderModulePage, {
    moduleName: 'Resource Optimization',
    icon: Sliders,
    plannedFeatures: [
      'Campus vehicle fleet EV charging scheduling',
      'HVAC thermal mass storage pre-cooling',
      'Rooftop solar generation forecasting',
      'Classroom seat capacity utilization rebalancing'
    ]
  }),
  description: 'Placeholder module (Not installed)'
};

// Register all modules into the registry
registerAppModule(energyAppModule);
registerAppModule(wasteAppModule);
registerAppModule(waterAppModule);
registerAppModule(resourceOptimizationAppModule);

export { registeredModules } from './registry';
