import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EnergyAuditRecord } from '@ecosphere/energy';
import { MetricCard } from '../components/common/MetricCard';
import { ChartCard } from '../components/common/ChartCard';
import { DataSourceBadge } from '../components/common/DataSourceBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  Zap,
  DollarSign,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Download,
  Clock,
  Users,
  Sun,
  Activity,
  Sliders,
  CheckCircle2,
  Lock
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export const EnergyPage: React.FC = () => {
  const [zones, setZones] = useState<any[]>([]);
  const [records, setRecords] = useState<EnergyAuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('CLASSROOM_101');
  const [activeTab, setActiveTab] = useState<'simulation' | 'audit' | 'loads'>('simulation');

  const fetchEnergyData = async () => {
    try {
      setLoading(true);
      const [zonesRes, recordsRes] = await Promise.all([
        api.getEnergyZones(),
        api.getEnergyRecords()
      ]);
      setZones(zonesRes.zones);
      setRecords(recordsRes.records);
    } catch (err) {
      console.error('Failed to load energy telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnergyData();
  }, []);

  const currentZone = zones.find(z => z.locationId === selectedZoneId) || zones[0];

  const handleSimulateUpdate = async (locationId: string, stateUpdate: Record<string, any>) => {
    try {
      const res = await api.simulateEnergy(locationId, stateUpdate);
      setZones(prev => prev.map(z => (z.locationId === locationId ? res.zone : z)));
      // Prepend to audit records
      if (res.auditRecord) {
        setRecords(prev => [res.auditRecord, ...prev]);
      }
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    }
  };

  const handleExportJson = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(records, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `ecosphere_energy_audit_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Aggregated totals
  const totalCurrentKw = zones.reduce((sum, z) => sum + (z.decision?.powerCurrentKw || 0), 0);
  const totalBaselineKw = zones.reduce((sum, z) => sum + (z.decision?.powerBaselineKw || 0), 0);
  const totalSavedKw = Math.max(0, totalBaselineKw - totalCurrentKw);
  const totalCostSaved = Number((totalSavedKw * 0.14).toFixed(2));
  const overallSavingsPercent = totalBaselineKw > 0 ? Number(((totalSavedKw / totalBaselineKw) * 100).toFixed(1)) : 0;

  // Chart data
  const chartData = zones.map(z => ({
    name: z.locationId.replace(/_/g, ' '),
    baseline: Number((z.decision?.powerBaselineKw || 0).toFixed(2)),
    optimized: Number((z.decision?.powerCurrentKw || 0).toFixed(2)),
    saved: Number((z.decision?.estimatedSavedKw || 0).toFixed(2))
  }));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Campus Energy Efficiency Engine</h1>
            <DataSourceBadge source="simulated" status="valid" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic pure-function load decision engine. Timetable grace periods, debounced daylight harvesting & protected safety circuits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-navy-900 border border-slate-700 hover:border-cyan-500/50 text-cyan-300 transition-all shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit JSON</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Load"
          value={totalCurrentKw.toFixed(2)}
          unit="kW"
          subtext={`Baseline: ${totalBaselineKw.toFixed(2)} kW`}
          icon={Zap}
          iconColor="text-cyan-400"
          dataSource="simulated"
        />
        <MetricCard
          title="Simulated Power Saved"
          value={totalSavedKw.toFixed(2)}
          unit="kW"
          subtext={`${overallSavingsPercent}% reduction vs unmanaged`}
          icon={TrendingDown}
          iconColor="text-emerald-400"
          dataSource="simulated"
        />
        <MetricCard
          title="Cost Avoidance Rate"
          value={`$${totalCostSaved}`}
          unit="/ hr"
          subtext="Configured tariff: $0.14 / kWh"
          icon={DollarSign}
          iconColor="text-teal-400"
          dataSource="simulated"
        />
        <MetricCard
          title="Protected Circuits"
          value="100%"
          unit="Active"
          subtext="Emergency & research equipment locked"
          icon={ShieldCheck}
          iconColor="text-purple-400"
          dataSource="simulated"
        />
      </div>

      {/* Comparison Chart */}
      <ChartCard
        title="Baseline vs. Optimized Power Profile Across Monitored Campus Zones"
        subtitle="Recalculated in real-time from active zone sensor simulations. All values labelled as simulated estimates."
        dataSource="simulated"
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e294b" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} angle={-15} textAnchor="end" />
              <YAxis stroke="#64748b" fontSize={11} unit=" kW" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#334155', borderRadius: '8px' }}
                itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="baseline" name="Unmanaged Baseline (kW)" fill="#475569" radius={[4, 4, 0, 0]} />
              <Bar dataKey="optimized" name="EcoSphere Optimized (kW)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saved" name="Estimated Saved (kW)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Zone Selector and Interactive Simulation Panel */}
      <div className="glass-panel p-6 space-y-6">
        {/* Zone Selector Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Interactive Zone Simulation
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {zones.map(z => (
              <button
                key={z.locationId}
                onClick={() => setSelectedZoneId(z.locationId)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                  selectedZoneId === z.locationId
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border border-cyan-400/40 shadow-glow-cyan'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/60'
                }`}
              >
                {z.locationId}
              </button>
            ))}
          </div>
        </div>

        {/* Current Zone Content */}
        {currentZone && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 6 cols: Dedicated Zone Controls */}
            <div className="lg:col-span-6 glass-card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white">{currentZone.locationId}</h3>
                  <span className="text-xs font-mono uppercase text-cyan-400 font-semibold">{currentZone.zoneType} Controller</span>
                </div>
                <DataSourceBadge source="simulated" status={currentZone.state?.occupancyDataStatus || 'valid'} />
              </div>

              {/* Classroom Specific Controls */}
              {currentZone.zoneType === 'classroom' && (
                <div className="space-y-4 text-xs">
                  {/* Timetable Toggle */}
                  <div className="flex items-center justify-between p-3 bg-navy-900 rounded-lg border border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-200 block">Timetable Schedule</span>
                      <span className="text-slate-400 text-[11px]">Is a class officially booked now?</span>
                    </div>
                    <button
                      onClick={() => handleSimulateUpdate(currentZone.locationId, {
                        timetableScheduled: !currentZone.state.timetableScheduled
                      })}
                      className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                        currentZone.state.timetableScheduled
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {currentZone.state.timetableScheduled ? 'CLASS SCHEDULED' : 'NO SCHEDULED CLASS'}
                    </button>
                  </div>

                  {/* Occupancy Slider */}
                  <div className="p-3 bg-navy-900 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        Occupants in Room
                      </span>
                      <span className="font-mono font-bold text-cyan-300 text-sm">
                        {currentZone.state.occupancyCount} students
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      value={currentZone.state.occupancyCount}
                      onChange={e => handleSimulateUpdate(currentZone.locationId, {
                        occupancyCount: Number(e.target.value)
                      })}
                      className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0 (Vacant)</span>
                      <span>30</span>
                      <span>60 (Capacity)</span>
                    </div>
                  </div>

                  {/* Minutes Since Last Occupied */}
                  <div className="p-3 bg-navy-900 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Elapsed Vacancy Time
                      </span>
                      <span className="font-mono font-bold text-amber-300 text-sm">
                        {currentZone.state.minutesSinceLastOccupied} min (Grace: {currentZone.state.gracePeriodMinutes} min)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={currentZone.state.minutesSinceLastOccupied}
                      onChange={e => handleSimulateUpdate(currentZone.locationId, {
                        minutesSinceLastOccupied: Number(e.target.value)
                      })}
                      className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0 min</span>
                      <span>5 min (Enforced Grace)</span>
                      <span>20 min</span>
                    </div>
                  </div>

                  {/* Manual Override & Telemetry Status */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-navy-900 rounded-lg border border-slate-800">
                      <span className="block text-[11px] font-semibold text-slate-300 mb-1.5">Manual Override</span>
                      <button
                        onClick={() => handleSimulateUpdate(currentZone.locationId, {
                          manualOverrideActive: !currentZone.state.manualOverrideActive
                        })}
                        className={`w-full py-1.5 rounded text-[11px] font-bold ${
                          currentZone.state.manualOverrideActive
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {currentZone.state.manualOverrideActive ? 'OVERRIDE ON' : 'AUTO CONTROL'}
                      </button>
                    </div>

                    <div className="p-3 bg-navy-900 rounded-lg border border-slate-800">
                      <span className="block text-[11px] font-semibold text-slate-300 mb-1.5">Telemetry Status</span>
                      <select
                        value={currentZone.state.occupancyDataStatus}
                        onChange={e => handleSimulateUpdate(currentZone.locationId, {
                          occupancyDataStatus: e.target.value
                        })}
                        className="w-full px-2 py-1 text-xs bg-navy-950 border border-slate-700 rounded text-slate-200 focus:outline-none"
                      >
                        <option value="valid">Valid Telemetry</option>
                        <option value="stale">Stale Reading</option>
                        <option value="missing">Missing Packet</option>
                        <option value="invalid">Invalid Sensor</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Auditorium Controls */}
              {currentZone.zoneType === 'auditorium' && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3 bg-navy-900 rounded-lg border border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-200 block">Scheduled Event</span>
                      <span className="text-slate-400 text-[11px]">Live performance or assembly</span>
                    </div>
                    <button
                      onClick={() => handleSimulateUpdate(currentZone.locationId, {
                        eventScheduled: !currentZone.state.eventScheduled
                      })}
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        currentZone.state.eventScheduled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {currentZone.state.eventScheduled ? 'EVENT ACTIVE' : 'NO EVENT'}
                    </button>
                  </div>

                  <div className="p-3 bg-navy-900 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">Elapsed Vacancy Time</span>
                      <span className="font-mono text-amber-300 font-bold">{currentZone.state.minutesSinceLastOccupied} min</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="35"
                      value={currentZone.state.minutesSinceLastOccupied}
                      onChange={e => handleSimulateUpdate(currentZone.locationId, {
                        minutesSinceLastOccupied: Number(e.target.value)
                      })}
                      className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>0m</span>
                      <span>10m Grace</span>
                      <span>20m Stage 1</span>
                      <span>30m Full Off</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-navy-900 rounded-lg border border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-200 block">Usher Verification</span>
                      <span className="text-slate-400 text-[11px]">Staff verified hall empty</span>
                    </div>
                    <button
                      onClick={() => handleSimulateUpdate(currentZone.locationId, {
                        verifiedEmptyByStaff: !currentZone.state.verifiedEmptyByStaff
                      })}
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        currentZone.state.verifiedEmptyByStaff ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {currentZone.state.verifiedEmptyByStaff ? 'VERIFIED EMPTY' : 'UNVERIFIED'}
                    </button>
                  </div>
                </div>
              )}

              {/* Corridor Controls */}
              {currentZone.zoneType === 'corridor' && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3 bg-navy-900 rounded-lg border border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-200 block">PIR Motion Detected</span>
                      <span className="text-slate-400 text-[11px]">Debounced pedestrian motion</span>
                    </div>
                    <button
                      onClick={() => handleSimulateUpdate(currentZone.locationId, {
                        motionDetected: !currentZone.state.motionDetected
                      })}
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        currentZone.state.motionDetected ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {currentZone.state.motionDetected ? 'MOTION ACTIVE' : 'NO MOTION'}
                    </button>
                  </div>

                  <div className="p-3 bg-navy-900 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-yellow-400" />
                        Ambient Daylight Level
                      </span>
                      <span className="font-mono text-yellow-300 font-bold">{currentZone.state.daylightLux} lux</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="800"
                      value={currentZone.state.daylightLux}
                      onChange={e => handleSimulateUpdate(currentZone.locationId, {
                        daylightLux: Number(e.target.value)
                      })}
                      className="w-full accent-yellow-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>50 lux (Night)</span>
                      <span>350 lux (Threshold)</span>
                      <span>800 lux (Sunlit)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Laboratory Controls */}
              {currentZone.zoneType === 'laboratory' && (
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between p-3 bg-navy-900 rounded-lg border border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-200 block">Lab Occupancy</span>
                      <span className="text-slate-400 text-[11px]">Researchers or students active</span>
                    </div>
                    <button
                      onClick={() => handleSimulateUpdate(currentZone.locationId, {
                        occupied: !currentZone.state.occupied
                      })}
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        currentZone.state.occupied ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {currentZone.state.occupied ? 'OCCUPIED' : 'VACANT'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-navy-900 rounded-lg border border-slate-800">
                    <div>
                      <span className="font-semibold text-slate-200 block">Active Experiment Registered</span>
                      <span className="text-slate-400 text-[11px]">Long-running compute / cryocooler</span>
                    </div>
                    <button
                      onClick={() => handleSimulateUpdate(currentZone.locationId, {
                        activeExperiment: !currentZone.state.activeExperiment
                      })}
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        currentZone.state.activeExperiment ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {currentZone.state.activeExperiment ? 'EXPERIMENT ACTIVE' : 'NO EXPERIMENT'}
                    </button>
                  </div>

                  <div className="p-3 bg-navy-900 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">Elapsed Vacancy Time</span>
                      <span className="font-mono text-amber-300 font-bold">{currentZone.state.minutesSinceLastOccupied} min</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      value={currentZone.state.minutesSinceLastOccupied}
                      onChange={e => handleSimulateUpdate(currentZone.locationId, {
                        minutesSinceLastOccupied: Number(e.target.value)
                      })}
                      className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right 6 cols: Pure Decision Output & Protected Circuits */}
            <div className="lg:col-span-6 glass-card p-6 space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Engine Decision Output
                </h3>
                <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-cyan-950/70 text-cyan-300 border border-cyan-500/40 shadow-sm">
                  {currentZone.decision?.action?.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>

              {/* Decision Explanation Card */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 text-xs space-y-2 shadow-inner">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Plain-Language Reasoning
                </span>
                <p className="text-white text-xs leading-relaxed font-medium">
                  {currentZone.decision?.explanation}
                </p>
              </div>

              {/* Instant Power Metrics */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-navy-900 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Current Load</span>
                  <span className="text-lg font-bold text-white font-mono">
                    {currentZone.decision?.powerCurrentKw?.toFixed(2)} kW
                  </span>
                </div>
                <div className="p-3 bg-navy-900 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Baseline Load</span>
                  <span className="text-lg font-bold text-slate-300 font-mono">
                    {currentZone.decision?.powerBaselineKw?.toFixed(2)} kW
                  </span>
                </div>
                <div className="p-3 bg-navy-900 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase block">Power Saved</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    {currentZone.decision?.estimatedSavedKw?.toFixed(2)} kW
                  </span>
                </div>
              </div>

              {/* Circuits Breakdown */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Circuit Status & Protection
                </h4>

                {/* Protected Loads */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-purple-400" />
                    Essential & Safety Circuits (Protected)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentZone.decision?.essentialLoadsProtected?.map((name: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[11px] bg-purple-950/70 border border-purple-500/30 text-purple-200">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Switched Off Loads */}
                {currentZone.decision?.eligibleLoadsSwitchedOff?.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Switched Off in Simulation (Power Saved)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentZone.decision?.eligibleLoadsSwitchedOff?.map((name: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-[11px] bg-emerald-950/70 border border-emerald-500/30 text-emerald-200">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="bg-navy-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Audited Energy Log & State Records
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">{records.length} records logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-navy-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Location ID</th>
                <th className="p-3">Zone Type</th>
                <th className="p-3">Load (kW)</th>
                <th className="p-3">Status</th>
                <th className="p-3">Decision / Recommendation</th>
                <th className="p-3">Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {records.slice(0, 10).map(rec => (
                <tr key={rec.record_id} className="hover:bg-navy-850">
                  <td className="p-3 text-slate-400 text-[11px]">
                    {new Date(rec.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-3 text-cyan-400 font-bold">{rec.location_id}</td>
                  <td className="p-3 text-slate-300 uppercase">{rec.zone_type}</td>
                  <td className="p-3 text-white font-bold">{rec.power_kw.toFixed(2)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      rec.alert ? 'bg-rose-950 text-rose-300 border border-rose-500/30' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {rec.alert ? 'ALERT' : 'OPTIMAL'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 font-sans text-xs max-w-xs truncate">
                    {rec.recommendation}
                  </td>
                  <td className="p-3">
                    <DataSourceBadge source={rec.data_source} status={rec.data_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
