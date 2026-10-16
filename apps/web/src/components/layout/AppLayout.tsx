import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { Outlet } from 'react-router-dom';

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex relative selection:bg-cyan-500 selection:text-white overflow-hidden">
      {/* Ambient Atmospheric Lighting Elements */}
      <div className="fixed top-[-10%] right-[-5%] w-[650px] h-[650px] rounded-full bg-gradient-to-br from-indigo-600/12 via-purple-600/8 to-transparent blur-[140px] pointer-events-none -z-0" />
      <div className="fixed bottom-[-15%] left-[15%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-cyan-600/10 via-teal-600/6 to-transparent blur-[140px] pointer-events-none -z-0" />
      <div className="fixed inset-0 bg-mesh-radial pointer-events-none opacity-60 -z-0" />

      {/* Sidebar */}
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 relative z-10 ${
          collapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <TopNavbar />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
