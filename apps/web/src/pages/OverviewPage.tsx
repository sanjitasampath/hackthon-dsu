import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { CampusEvent, CampusIncident, CampusLocation } from '@ecosphere/shared';
import { SmartBin } from '@ecosphere/waste';
import { MetricCard } from '../components/common/MetricCard';
import { ChartCard } from '../components/common/ChartCard';
import { AlertList } from '../components/common/AlertList';
import { StatusBadge } from '../components/common/StatusBadge';
import { DataSourceBadge } from '../components/common/DataSourceBadge';
import {
  Zap,
  Trash2,
  AlertTriangle,
  Activity,
  Layers,
  ArrowRight,
  TrendingDown,
  RefreshCw,
  MapPin,
  Clock
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
  const [loading, setLoading] = useState(true);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const [locRes, incRes, evtRes, binRes, zoneRes] = await Promise.all([
        api.getLocations(),
        api.getIncidents(),
        api.getEvents({ limit: 20 }),
        api.getWasteBins(),
        api.getEnergyZones()
      ]);

      setLocations(locRes.locations);
      setIncidents(incRes.incidents);
      setEvents(evtRes.events);
      setBins(binRes.bins);
      setEnergyZones(zoneRes.zones);
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
  const totalPowerKw = energyZones.reduce((sum, z) => sum + (z.decision?.powerCurrentKw || 0), 0);
  const totalBaselineKw = energyZones.reduce((sum, z) => sum + (z.decision?.powerBaselineKw || 0), 0);
  const totalPowerSaved = Math.max(0, totalBaselineKw - totalPowerKw);
  const highFillBins = bins.filter(b => b.fill_percentage >= 85);

  const energyChartData = energyZones.slice(0, 5).map(z => ({
    name: z.locationId.replace(/_/g, ' '),
    current: Number((z.decision?.powerCurrentKw || 0).toFixed(2)),
    saved: Number((z.decision?.estimatedSavedKw || 0).toFixed(2))
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Campus Overview Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/70 border border-cyan-500/40 text-cyan-300">
              Cross-Module Central State
            </span>
            <DataSourceBadge source="simulated" status="valid" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated digital twin intelligence spanning 11 campus locations, active energy load optimization & smart waste bins.
          </p>
        </div>

        <button
          onClick={fetchOverviewData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-navy-900 border border-slate-700 hover:border-cyan-500/50 text-cyan-300 transition-all shadow"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync State</span>
        </button>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Incidents"
          value={activeIncidents.length}
          unit="total"
          subtext={`${criticalIncidents.length} critical requiring action`}
          icon={AlertTriangle}
          iconColor="text-rose-400"
          dataSource="simulated"
        />
        <MetricCard
          title="Campus Power Load"
          value={totalPowerKw.toFixed(1)}
          unit="kW"
          subtext={`Saving ${totalPowerSaved.toFixed(1)} kW in real-time`}
          icon={Zap}
          iconColor="text-cyan-400"
          dataSource="simulated"
        />
        <MetricCard
          title="Bins Exceeding 85%"
          value={highFillBins.length}
          unit="bins"
          subtext={`${bins.length} smart bins active`}
          icon={Trash2}
          iconColor="text-amber-400"
          dataSource="simulated"
        />
        <MetricCard
          title="Sustainability Index"
          value="94.2"
          unit="/ 100"
          subtext="EcoSphere algorithm score"
          icon={Activity}
          iconColor="text-emerald-400"
          dataSource="simulated"
        />
      </div>

      {/* Two Column Layout: Digital Twin Teaser on Left, Active Incidents on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Digital Twin Mini Preview */}
        <div className="lg:col-span-7 bg-navy-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Digital Twin Campus Status
              </h3>
            </div>
            <Link
              to="/twin"
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
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
                      ? 'bg-rose-950/40 border-rose-500/50 hover:bg-rose-900/50'
                      : isWarn
                      ? 'bg-amber-950/40 border-amber-500/50 hover:bg-amber-900/50'
                      : 'bg-navy-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-slate-400">{loc.location_id}</span>
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
            <span className="text-[11px] font-mono uppercase text-slate-400 block mb-2">
              Active Zone Power vs Real-Time Savings (kW)
            </span>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={energyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e294b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} unit="kW" />
                  <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#334155' }} />
                  <Bar dataKey="current" name="Current Load (kW)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saved" name="Saved (kW)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Live Feed of Alerts & Events */}
        <div className="lg:col-span-5 bg-navy-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Cross-Module Incident Stream
              </h3>
            </div>
            <Link
              to="/incidents"
              className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
            >
              All Incidents <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <AlertList events={events} maxItems={5} showFilters={false} />
        </div>
      </div>
    </div>
  );
};
