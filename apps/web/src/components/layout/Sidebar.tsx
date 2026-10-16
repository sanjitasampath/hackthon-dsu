import React from 'react';
import { NavLink } from 'react-router-dom';
import { registeredModules } from '../../modules/registered';
import {
  LayoutDashboard,
  Layers,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Globe,
  Radio
} from 'lucide-react';

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<Props> = ({ collapsed, onToggleCollapse }) => {
  const coreNavItems = [
    { name: 'Overview', route: '/', icon: LayoutDashboard },
    { name: 'Digital Twin', route: '/twin', icon: Layers },
    { name: 'Incidents Hub', route: '/incidents', icon: AlertTriangle },
    { name: 'AI Reports', route: '/reports', icon: FileText }
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen bg-[#070b14]/90 backdrop-blur-xl border-r border-slate-800/80 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/70">
        <NavLink to="/" className="flex items-center gap-3 overflow-hidden group">
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-navy-950 font-black shadow-lg shadow-cyan-500/25 shrink-0 group-hover:scale-105 transition-transform">
            <Globe className="w-5 h-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#070b14] rounded-full animate-pulse" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5 leading-none">
                EcoSphere <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">AI</span>
              </span>
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mt-1">
                CAMPUS DIGITAL TWIN
              </span>
            </div>
          )}
        </NavLink>

        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent hover:border-slate-700/60 transition-all"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Core Twin Nav */}
        <div className="space-y-1">
          {!collapsed && (
            <span className="px-3 text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 block mb-1.5">
              Core Platform
            </span>
          )}
          {coreNavItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.route}
                to={item.route}
                end={item.route === '/'}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/15 via-indigo-500/10 to-transparent text-cyan-300 border border-cyan-500/30 shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r before:bg-cyan-400 before:shadow-glow-cyan'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 hover:border-slate-700/30 border border-transparent'
                  }`
                }
                title={collapsed ? item.name : undefined}
              >
                <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* Modules Registry Nav */}
        <div className="space-y-1">
          {!collapsed && (
            <span className="px-3 text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 block mb-1.5">
              Domain Modules
            </span>
          )}
          {registeredModules.map(mod => {
            const Icon = mod.icon;
            return (
              <NavLink
                key={mod.route}
                to={mod.route}
                className={({ isActive }) =>
                  `relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500/15 via-indigo-500/10 to-transparent text-purple-300 border border-purple-500/30 shadow-sm before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r before:bg-purple-400 before:shadow-glow-purple'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 hover:border-slate-700/30 border border-transparent'
                  }`
                }
                title={collapsed ? mod.name : undefined}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                  {!collapsed && <span className="truncate">{mod.name}</span>}
                </div>
                {!collapsed && !mod.installed && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                    N/A
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Footer Branding */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 bg-navy-950/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
              v1.0.0 IoT Mesh
            </span>
            <span className="text-emerald-400 flex items-center gap-1 font-semibold text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
              ACTIVE
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
