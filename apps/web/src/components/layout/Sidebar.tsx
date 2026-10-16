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
  Sparkles,
  Globe
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
      className={`fixed top-0 left-0 z-40 h-screen bg-[#070b14] border-r border-slate-800/90 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
        <NavLink to="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-teal-400 flex items-center justify-center text-navy-950 font-black shadow-lg shadow-cyan-500/20 shrink-0">
            <Globe className="w-5 h-5 text-navy-950" />
          </div>
          {!collapsed && (
            <div>
              <span className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
                EcoSphere <span className="text-cyan-400">AI</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
                CAMPUS DIGITAL TWIN
              </span>
            </div>
          )}
        </NavLink>

        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
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
            <span className="px-3 text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400 block mb-1">
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
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-navy-900'
                  }`
                }
                title={collapsed ? item.name : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* Modules Registry Nav */}
        <div className="space-y-1">
          {!collapsed && (
            <span className="px-3 text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400 block mb-1">
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
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-purple-500/15 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-navy-900'
                  }`
                }
                title={collapsed ? mod.name : undefined}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{mod.name}</span>}
                </div>
                {!collapsed && !mod.installed && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
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
        <div className="p-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 bg-navy-950/60">
          <div className="flex items-center justify-between">
            <span>Stack v1.0.0</span>
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              ONLINE
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
