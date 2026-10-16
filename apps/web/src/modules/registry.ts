import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface AppModuleDefinition {
  id: string;
  name: string;
  route: string;
  icon: LucideIcon;
  installed: boolean;
  navOrder: number;
  component: React.ComponentType;
  description?: string;
}

export const registeredModules: AppModuleDefinition[] = [];

export function registerAppModule(mod: AppModuleDefinition) {
  const exists = registeredModules.some(m => m.id === mod.id);
  if (!exists) {
    registeredModules.push(mod);
    registeredModules.sort((a, b) => a.navOrder - b.navOrder);
  }
}
