// apps/api/src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';
import { router as locationsRouter } from './routes/locations.js';
import { router as eventsRouter } from './routes/events.js';
import { router as incidentsRouter } from './routes/incidents.js';
import { router as reportsRouter } from './routes/reports.js';
import { router as demoRouter } from './routes/demo.js';
import { activeApiModules } from './modules/registered.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDistPath = path.resolve(__dirname, '../../web/dist');

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

// Healthcheck & API Discovery
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'EcoSphere AI Campus Engine',
    timestamp: new Date().toISOString()
  });
});

app.get(['/api', '/api/'], (req, res) => {
  res.json({
    service: 'EcoSphere AI Campus Twin API',
    status: 'online',
    version: '1.0.0',
    documentation: 'Unified 4-Pillar Digital Twin Platform',
    endpoints: {
      health: '/api/health',
      locations: '/api/locations',
      incidents: '/api/incidents',
      events: '/api/events',
      reports: '/api/reports',
      energy: '/api/energy',
      waste: '/api/waste',
      water: '/api/water',
      resources: '/api/resources',
      demo: '/api/demo'
    }
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

// Check if production build of apps/web exists
const hasWebDist = fs.existsSync(webDistPath) && fs.existsSync(path.join(webDistPath, 'index.html'));

if (hasWebDist) {
  // Serve static assets from apps/web/dist
  app.use(express.static(webDistPath));
}

// Fallback handler for all non-API routes (SPA routing & root landing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: `API endpoint not found: ${req.method} ${req.path}`
    });
  }

  // If client specifically requests JSON from the root, return API info
  if (req.accepts('json') && !req.accepts('html')) {
    return res.json({
      service: 'EcoSphere AI Campus Twin API',
      status: 'online',
      message: 'Welcome to the EcoSphere AI Campus Twin API. For the web UI, open in browser or visit http://localhost:5173.'
    });
  }

  if (hasWebDist) {
    return res.sendFile(path.join(webDistPath, 'index.html'));
  }

  // Dev fallback with auto-redirect to Vite dev server at :5173
  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>EcoSphere AI - Campus Digital Twin</title>
      <meta http-equiv="refresh" content="2;url=http://localhost:5173/">
      <style>
        body { margin: 0; background: #070b14; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; }
        .card { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 20px; padding: 40px; max-width: 500px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
        h1 { font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 8px; }
        p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
        .btn { display: inline-block; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: #fff; text-decoration: none; font-weight: 700; padding: 12px 28px; border-radius: 12px; font-size: 14px; box-shadow: 0 10px 20px rgba(6, 182, 212, 0.3); transition: transform 0.2s; }
        .btn:hover { transform: translateY(-2px); }
        .status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #6ee7b7; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
        .dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="status"><span class="dot"></span>API Engine Active (Port 3001)</div>
        <h1>EcoSphere AI Digital Twin</h1>
        <p>The backend telemetry engine is active. The interactive campus dashboard is hosted on port 5173.</p>
        <a href="http://localhost:5173/" class="btn">Open Interactive Dashboard &rarr;</a>
      </div>
    </body>
    </html>
  `);
});

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
  if (hasWebDist) {
    console.log(`🌐 Serving production web bundle from ${webDistPath}`);
  }
});
