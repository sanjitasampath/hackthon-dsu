import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { registeredModules } from './modules/registered';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="twin" element={<DigitalTwinPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="reports" element={<ReportsPage />} />

          {/* Pluggable Dynamic Module Routes */}
          {registeredModules.map(mod => {
            const Component = mod.component;
            const pathName = mod.route.startsWith('/') ? mod.route.slice(1) : mod.route;
            return <Route key={mod.id} path={pathName} element={<Component />} />;
          })}

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
