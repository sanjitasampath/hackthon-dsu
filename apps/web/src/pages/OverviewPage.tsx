import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { CampusEvent, CampusIncident, CampusLocation } from '@ecosphere/shared';
import { SmartBin } from '@ecosphere/waste';
import { WaterMeter, WaterTank } from '@ecosphere/water';
import { ResourceSummaryStats } from '@ecosphere/resources';
import { MetricCard } from '../components/common/MetricCard';
import { AlertList } from '../components/common/AlertList';
import { DataSourceBadge } from '../components/common/DataSourceBadge';
import {
  Zap,
  Trash2,
  Droplet,
  Sliders,
  AlertTriangle,
  Activity,
  Layers,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  Building,
  Sparkles,
  CheckCircle2,
  Clock,
  Gauge
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export const OverviewPage: React.FC = () => {
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [incidents, setIncidents] = useState<CampusIncident[]>([]);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [bins, setBins] = useState<SmartBin[]>([]);
  const [energyZones, setEnergyZones] = useState<any[]>([]);
  const [waterMeters, setWaterMeters] = useState<WaterMeter[]>([]);
  const [waterTanks, setWaterTanks] = useState<WaterTank[]>([]);
  const [resourceStats, setResourceStats] = useState<ResourceSummaryStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const [locRes, incRes, evtRes, binRes, zoneRes, waterRes, tankRes, resRes] = await Promise.all([
        api.getLocations(),
        api.getIncidents(),
        api.getEvents({ limit: 20 }),
        api.getWasteBins(),
        api.getEnergyZones(),
        api.getWaterMeters().catch(() => ({ success: false, meters: [] })),
        api.getWaterTanks().catch(() => ({ success: false, tanks: [] })),
        api.getResourceSummary().catch(() => ({ success: false, stats: null }))
      ]);

      if (locRes.locations) setLocations(locRes.locations);
      if (incRes.incidents) setIncidents(incRes.incidents);
      if (evtRes.events) setEvents(evtRes.events);
      if (binRes.bins) setBins(binRes.bins);
      if (zoneRes.zones) setEnergyZones(zoneRes.zones);
      if (waterRes.success) setWaterMeters(waterRes.meters as any);
      if (tankRes.success) setWaterTanks(tankRes.tanks as any);
      if (resRes.success) setResourceStats(resRes.stats);
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const activeIncidents = incidents.filter(i => i.status !== 'verified_resolved');
  const criticalIncidents = activeIncidents.filter(i => i.severity === 'critical');

  // Energy calculations
  const totalPowerKw = energyZones.reduce((sum, z) => sum + (z.decision?.powerCurrentKw || 0), 0);
  const totalBaselineKw = energyZones.reduce((sum, z) => sum + (z.decision?.powerBaselineKw || 0), 0);
  const totalPowerSaved = Math.max(0, totalBaselineKw - totalPowerKw);

  // Water calculations
  const activeLeaksCount = waterMeters.filter(m => m.status === 'leak_suspected' || m.status === 'critical_burst' || m.status === 'abnormal_flow').length;
  const totalFlowLpm = waterMeters.reduce((sum, m) => sum + (m.flow_rate_lpm || 0), 0);

  // Waste calculations
  const highFillBins = bins.filter(b => b.fill_percentage >= 85);

  const energyChartData = energyZones.slice(0, 5).map(z => ({
    name: z.locationId.replace(/_/g, ' '),
    current: Number((z.decision?.powerCurrentKw || 0).toFixed(2)),
    saved: Number((z.decision?.estimatedSavedKw || 0).toFixed(2))
  }));

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight">Campus Overview Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950/70 border border-indigo-500/40 text-indigo-300">
              Unified 4-Pillar Digital Twin
            </span>
            <DataSourceBadge source="sensor" status="valid" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated digital twin telemetry spanning Energy, Water, Waste, and Space Utilization across 11 campus locations.
          </p>
        </div>

        <button
          onClick={fetchOverviewData}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-navy-900 border border-slate-700 hover:border-indigo-500/50 text-indigo-300 transition-all shadow-lg shadow-navy-950"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync All Telemetry</span>
        </button>
      </div>

      {/* Aggregate 4-Pillar Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Campus Energy Load"
          value={`${totalPowerKw.toFixed(1)} kW`}
          subtext={`Saving ${totalPowerSaved.toFixed(1)} kW in real-time`}
          icon={Zap}
          iconColor="text-amber-400"
          badgeText="Grace Period Active"
          badgeColor="emerald"
        />
        <MetricCard
          title="Water Flow & Leaks"
          value={`${totalFlowLpm.toFixed(1)} LPM`}
          subtext={`${activeLeaksCount} active leak alerts flagged`}
          icon={Droplet}
          iconColor="text-cyan-400"
          badgeText={activeLeaksCount > 0 ? "Anomaly Detected" : "Normal Pressure"}
          badgeColor={activeLeaksCount > 0 ? "rose" : "cyan"}
        />
        <MetricCard
          title="Waste Bin Criticals"
          value={`${highFillBins.length} Bins`}
          subtext={`${bins.length} total ultrasonic bins active`}
          icon={Trash2}
          iconColor="text-purple-400"
          badgeText={highFillBins.length > 0 ? "Collection Needed" : "Optimal"}
          badgeColor={highFillBins.length > 0 ? "purple" : "emerald"}
        />
        <MetricCard
          title="Space Utilization"
          value={`${resourceStats?.averageUtilizationRate || 57.1}%`}
          subtext={`${resourceStats?.activeRecommendationsCount || 4} right-sizing actions ready`}
          icon={Sliders}
          iconColor="text-indigo-400"
          badgeText="Timetable Optimization"
          badgeColor="blue"
        />
      </div>

      {/* 4 Pillar Quick Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/energy"
          className="glass-card p-5 group flex flex-col justify-between hover:border-amber-500/50 hover:shadow-glow-amber transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 group-hover:scale-110 transition-transform shadow-glow-amber">
                <Zap className="w-4 h-4" />
              </span>
              <span className="text-[10px] text-slate-500 font-mono font-bold tracking-wider">MODULE 01</span>
            </div>
            <h3 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
              Energy Efficiency Engine
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Classroom vacancy grace periods, corridor daylight harvesting, and auditorium occupancy counts.
            </p>
          </div>
          <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/80 text-xs font-bold text-amber-400">
            <span>Inspect Energy Zones</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </Link>

        <Link
          to="/water"
          className="glass-card p-5 group flex flex-col justify-between hover:border-cyan-500/50 hover:shadow-glow-cyan transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 group-hover:scale-110 transition-transform shadow-glow-cyan">
                <Droplet className="w-4 h-4" />
              </span>
              <span className="text-[10px] text-slate-500 font-mono font-bold tracking-wider">MODULE 02</span>
            </div>
            <h3 className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
              Water &amp; Leak Detection
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Acoustic vibration sensing, pipe burst pressure monitoring, and rainwater cistern reserves.
            </p>
          </div>
          <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/80 text-xs font-bold text-cyan-400">
            <span>Inspect Flow Network</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </Link>

        <Link
          to="/waste"
          className="glass-card p-5 group flex flex-col justify-between hover:border-purple-500/50 hover:shadow-glow-purple transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 group-hover:scale-110 transition-transform shadow-glow-purple">
                <Trash2 className="w-4 h-4" />
              </span>
              <span className="text-[10px] text-slate-500 font-mono font-bold tracking-wider">MODULE 03</span>
            </div>
            <h3 className="text-sm font-black text-white group-hover:text-purple-300 transition-colors">
              EcoSort AI Waste Engine
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              ESP32 ultrasonic bin fill tracking, dynamic collection routing, and free OpenRouter vision AI.
            </p>
          </div>
          <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/80 text-xs font-bold text-purple-400">
            <span>Inspect Smart Bins</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </Link>

        <Link
          to="/resources"
          className="glass-card p-5 group flex flex-col justify-between hover:border-indigo-500/50 hover:shadow-glass transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 group-hover:scale-110 transition-transform">
                <Sliders className="w-4 h-4" />
              </span>
              <span className="text-[10px] text-slate-500 font-mono font-bold tracking-wider">MODULE 04</span>
            </div>
            <h3 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors">
              Space &amp; Timetable Optimizer
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Classroom consolidation, low-attendance reallocations, and wing HVAC setback scheduling.
            </p>
          </div>
          <div className="flex items-center justify-between mt-5 pt-3 border-t border-slate-800/80 text-xs font-bold text-indigo-400">
            <span>Explore Consolidations</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Two Column Layout: Digital Twin Campus Grid on Left, Cross-Module Feed on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Digital Twin Mini Preview */}
        <div className="lg:col-span-7 glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Digital Twin Campus Status
              </h3>
            </div>
            <Link
              to="/twin"
              className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors"
            >
              Open Full Interactive Twin <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {locations.slice(0, 9).map(loc => {
              const isCrit = loc.activeSeverity === 'critical';
              const isWarn = loc.activeSeverity === 'warning';
              return (
                <Link
                  key={loc.location_id}
                  to="/twin"
                  className={`p-3 rounded-xl border transition-all text-left block ${
                    isCrit
                      ? 'bg-rose-950/40 border-rose-500/50 hover:bg-rose-900/50 shadow-sm shadow-rose-950/40'
                      : isWarn
                      ? 'bg-amber-950/40 border-amber-500/50 hover:bg-amber-900/50'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-slate-400 font-semibold">{loc.location_id}</span>
                    <span className={`w-2 h-2 rounded-full ${
                      isCrit ? 'bg-rose-500 animate-ping' : isWarn ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                  </div>
                  <h4 className="text-xs font-bold text-white truncate">{loc.name}</h4>
                  <span className="text-[10px] font-mono uppercase text-slate-500 mt-1 block">
                    {loc.zone_type}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Quick Chart */}
          <div className="pt-2">
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-2 font-semibold">
              Active Zone Power vs Real-Time Savings (kW)
            </span>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={energyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e294b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} unit="kW" />
                  <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#334155', borderRadius: '12px' }} />
                  <Bar dataKey="current" name="Current Load (kW)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saved" name="Saved (kW)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Live Feed of Alerts & Events */}
        <div className="lg:col-span-5 glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Cross-Module Incident Stream
              </h3>
            </div>
            <Link
              to="/incidents"
              className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 transition-colors"
            >
              All Incidents ({incidents.length}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <AlertList events={events} maxItems={6} showFilters={false} />
        </div>
      </div>
    </div>
  );
};
