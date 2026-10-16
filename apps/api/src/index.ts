// apps/api/src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db.js';
import { router as locationsRouter } from './routes/locations.js';
import { router as eventsRouter } from './routes/events.js';
import { router as incidentsRouter } from './routes/incidents.js';
import { router as reportsRouter } from './routes/reports.js';
import { router as demoRouter } from './routes/demo.js';
import { activeApiModules } from './modules/registered.js';

dotenv.config();

// Initialize SQLite database tables and seed data
initDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for dev/presentation or configured origin
  credentials: true
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'EcoSphere AI Campus Engine',
    timestamp: new Date().toISOString()
  });
});

// Mount Shared Core Routes
app.use('/api/locations', locationsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/demo', demoRouter);

// Mount Modular Registered Routers dynamically
for (const mod of activeApiModules) {
  console.log(`Mounting module API: [${mod.name}] at ${mod.apiPrefix}`);
  app.use(mod.apiPrefix, mod.router);
}

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal campus engine server error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 EcoSphere AI Campus Twin API running on http://localhost:${PORT}`);
});
