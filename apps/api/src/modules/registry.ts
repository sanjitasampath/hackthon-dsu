// apps/api/src/modules/registry.ts
import { Router } from 'express';
import Database from 'better-sqlite3';

export interface ModuleApiDefinition {
  id: string;
  name: string;
  apiPrefix: string;
  router: Router;
  onInit?: (db: Database.Database) => Promise<void> | void;
}

export const activeApiModules: ModuleApiDefinition[] = [];

export function registerApiModule(moduleDef: ModuleApiDefinition) {
  // Prevent duplicate registration
  const exists = activeApiModules.some(m => m.id === moduleDef.id);
  if (!exists) {
    activeApiModules.push(moduleDef);
  }
}
