import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  WaterMeter,
  WaterTank,
  WaterThresholdConfig,
  WaterDecisionOutput
} from '@ecosphere/water';
import { MetricCard } from '../components/common/MetricCard';
import { ChartCard } from '../components/common/ChartCard';
import { DataSourceBadge } from '../components/common/DataSourceBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  Droplet,
  Waves,
  AlertTriangle,
  Activity,
  Sliders,
  RefreshCw,
  Gauge,
  Volume2,
  DollarSign,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Info,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

export const WaterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'meters' | 'trends' | 'tanks' | 'thresholds'>('meters');
  const [meters, setMeters] = useState<(WaterMeter & { decision: WaterDecisionOutput })[]>([]);
  const [tanks, setTanks] = useState<(WaterTank & { evaluation: any })[]>([]);
  const [thresholds, setThresholds] = useState<WaterThresholdConfig | null>(null);
  const [readings, setReadings] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Simulation controls state
  const [selectedMeterId, setSelectedMeterId] = useState<string>('WM_SPORTS_01');
  const [simFlow, setSimFlow] = useState<number>(18.2);
  const [simPressure, setSimPressure] = useState<number>(42);
  const [simAcoustic, setSimAcoustic] = useState<number>(58.5);
  const [simDataStatus, setSimDataStatus] = useState<string>('valid');
  const [simulationMsg, setSimulationMsg] = useState<string | null>(null);

  // Threshold edit state
  const [tempThresholds, setTempThresholds] = useState<WaterThresholdConfig | null>(null);
  const [savingThresholds, setSavingThresholds] = useState(false);

  const fetchWaterData = async () => {
    try {
      setLoading(true);
      const [metersRes, tanksRes, thresholdsRes, readingsRes, analyticsRes] = await Promise.all([
        api.getWaterMeters(),
        api.getWaterTanks(),
        api.getWaterThresholds(),
        api.getWaterReadings(),
        api.getWaterAnalytics()
      ]);

      setMeters(metersRes.meters);
      setTanks(tanksRes.tanks);
      setThresholds(thresholdsRes.thresholds);
      setTempThresholds(thresholdsRes.thresholds);
      setReadings(readingsRes.readings);
      setAnalytics(analyticsRes.analytics);

      // Initialize simulator with selected meter if exists
      const target = metersRes.meters.find(m => m.meter_id === selectedMeterId) || metersRes.meters[0];
      if (target) {
        setSelectedMeterId(target.meter_id);
        setSimFlow(target.flow_rate_lpm);
        setSimPressure(target.pressure_psi);
        setSimAcoustic(target.leak_acoustic_db);
        setSimDataStatus(target.data_status);
      }
    } catch (err) {
      console.error('Failed to load water telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaterData();
  }, []);

  const handleSelectMeter = (meterId: string) => {
    setSelectedMeterId(meterId);
    const target = meters.find(m => m.meter_id === meterId);
    if (target) {
      setSimFlow(target.flow_rate_lpm);
      setSimPressure(target.pressure_psi);
      setSimAcoustic(target.leak_acoustic_db);
      setSimDataStatus(target.data_status);
      setSimulationMsg(null);
    }
  };

  const handleApplyPreset = (preset: 'normal' | 'pinhole' | 'burst' | 'flapper' | 'offline') => {
    const target = meters.find(m => m.meter_id === selectedMeterId);
    const baseFlow = target?.baseline_night_flow_lpm || 1.0;

    switch (preset) {
      case 'normal':
        setSimFlow(Number((baseFlow * 1.5).toFixed(1)));
        setSimPressure(54.0);
        setSimAcoustic(26.0);
        setSimDataStatus('valid');
        break;
      case 'pinhole':
        setSimFlow(Number((baseFlow + 3.5).toFixed(1)));
        setSimPressure(44.0);
        setSimAcoustic(62.0); // > 52 dB threshold
        setSimDataStatus('valid');
        break;
      case 'burst':
        setSimFlow(115.0); // >= 90 L/min
        setSimPressure(22.0); // <= 32 psi
        setSimAcoustic(74.0);
        setSimDataStatus('valid');
        break;
      case 'flapper':
        setSimFlow(9.6); // continuous restroom trickle >= 8
        setSimPressure(52.0);
        setSimAcoustic(32.0);
        setSimDataStatus('valid');
        break;
      case 'offline':
        setSimDataStatus('invalid');
        break;
    }
  };

  const handleSimulateSubmit = async () => {
    try {
      setSimulationMsg('Injecting telemetry and executing hydraulic decision engine...');
      const res = await api.simulateWaterMeter({
        meter_id: selectedMeterId,
        flow_rate_lpm: simFlow,
        pressure_psi: simPressure,
        leak_acoustic_db: simAcoustic,
        data_status: simDataStatus
      });

      setSimulationMsg(
        `Simulation applied: Status is now "${res.decision.status.toUpperCase()}". ${
          res.decision.leakDetected ? `🚨 Leak flagged (${res.decision.leakType})! Incident synchronized with Digital Twin.` : 'Nominal hydraulic parameters.'
        }`
      );

      await fetchWaterData();
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
      setSimulationMsg(null);
    }
  };

  const handleSaveThresholds = async () => {
    if (!tempThresholds) return;
    try {
      setSavingThresholds(true);
      const res = await api.updateWaterThresholds(tempThresholds);
      setThresholds(res.thresholds);
      alert('Hydraulic leak detection thresholds successfully updated.');
      await fetchWaterData();
    } catch (err: any) {
      alert(`Threshold update failed: ${err.message}`);
    } finally {
      setSavingThresholds(false);
    }
  };

  const handleSimulateTankFill = async (tankId: string, newFill: number) => {
    try {
      await api.simulateWaterTank({
        tank_id: tankId,
        fill_percentage: newFill
      });
      await fetchWaterData();
    } catch (err: any) {
      alert(`Tank simulation error: ${err.message}`);
    }
  };

  const currentMeter = meters.find(m => m.meter_id === selectedMeterId) || meters[0];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Droplet className="w-6 h-6 text-cyan-400" />
              Water Management & Leak Detection
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/70 border border-cyan-500/40 text-cyan-300">
              Acoustic HydroTwin
            </span>
            <DataSourceBadge source="simulated" status="valid" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time ultrasonic flow metering, minimum night flow (MNF) baseline tracking, acoustic sub-slab leak detection and rainwater cisterns.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchWaterData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white text-xs font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* Holistic Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Daily Water Consumption"
          value={analytics ? `${analytics.totalDailyConsumptionM3} m³` : '44.4 m³'}
          subtext={analytics ? `${analytics.totalDailyConsumptionLiters.toLocaleString()} Liters consumed today` : 'Loading...'}
          icon={Droplet}
          badgeText="Sub-metered"
          badgeColor="bg-emerald-950/70 text-emerald-300 border-emerald-500/40"
        />
        <MetricCard
          title="Live Campus Flow Rate"
          value={analytics ? `${analytics.currentFlowTotalLpm} L/min` : '118.1 L/min'}
          subtext="Aggregated across 7 feed lines"
          icon={Gauge}
          badgeText="Real-time"
          badgeColor="bg-cyan-950/70 text-cyan-300 border-cyan-500/40"
        />
        <MetricCard
          title="Active Pipe Leaks"
          value={analytics ? analytics.activeLeaksCount : '2'}
          subtext={analytics ? `Est. loss: $${analytics.estimatedDailyCostLossUsd}/day (${analytics.estimatedDailyLossLiters.toLocaleString()} L/day)` : 'Calculating...'}
          icon={AlertTriangle}
          badgeText={(analytics?.activeLeaksCount || 0) > 0 ? 'Action Required' : 'Normal'}
          badgeColor={(analytics?.activeLeaksCount || 0) > 0 ? 'bg-rose-950/80 text-rose-300 border-rose-500/50' : 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'}
        />
        <MetricCard
          title="Rainwater & Cistern Storage"
          value={analytics ? `${analytics.overallTankFillPercent}%` : '65%'}
          subtext={analytics ? `${(analytics.rainwaterHarvestedLiters / 1000).toFixed(1)} m³ rainwater harvested` : 'Harvesting active'}
          icon={Waves}
          badgeText="EcoStorage"
          badgeColor="bg-cyan-950/70 text-cyan-300 border-cyan-500/40"
        />
      </div>

      {/* Section Navigation Tabs Dock */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-glass text-xs">
        {[
          { id: 'meters', label: 'Sub-meter Network & Simulator', icon: Activity },
          { id: 'trends', label: 'Consumption Trends & Telemetry', icon: TrendingUp },
          { id: 'tanks', label: 'Storage Tanks & Rainwater', icon: Waves },
          { id: 'thresholds', label: 'Leak Threshold Invariants', icon: Sliders }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/40 border border-cyan-400/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Sub-meter Network & Simulator */}
      {activeTab === 'meters' && (
        <div className="space-y-6">
          {/* Active Meter Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {meters.map(meter => {
              const isSelected = meter.meter_id === selectedMeterId;
              const isLeak = meter.decision?.leakDetected;
              const isCritical = meter.status === 'critical_burst';

              return (
                <div
                  key={meter.meter_id}
                  onClick={() => handleSelectMeter(meter.meter_id)}
                  className={`glass-card p-5 cursor-pointer relative overflow-hidden transition-all duration-300 ${
                    isSelected
                      ? 'border-cyan-500/70 shadow-glow-cyan ring-1 ring-cyan-500/50 bg-gradient-to-b from-cyan-950/20 to-slate-900/90'
                      : 'hover:border-slate-700'
                  }`}
                >
                  {isLeak && (
                    <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
                      <div className={`text-[10px] font-black text-center py-1 transform rotate-45 translate-x-7 translate-y-3 shadow-lg ${
                        isCritical ? 'bg-gradient-to-r from-rose-600 to-red-500 text-white animate-pulse' : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold'
                      }`}>
                        {isCritical ? 'BURST' : 'LEAK'}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="text-sm font-bold text-white tracking-tight">{meter.name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-cyan-400 font-semibold">{meter.meter_id}</span>
                        <span>•</span>
                        <span>{meter.location_id}</span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      meter.status === 'normal'
                        ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/40'
                        : meter.status === 'critical_burst'
                        ? 'bg-rose-950/90 text-rose-300 border border-rose-500/60 animate-pulse'
                        : meter.status === 'abnormal_flow'
                        ? 'bg-orange-950/70 text-orange-300 border border-orange-500/40'
                        : 'bg-amber-950/70 text-amber-300 border border-amber-500/40'
                    }`}>
                      {meter.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-800/80 mb-3 bg-slate-950/70 rounded-xl p-2.5 shadow-inner">
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Flow Rate</div>
                      <div className="text-xs font-mono font-black text-white">{meter.flow_rate_lpm} L/min</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Pressure</div>
                      <div className="text-xs font-mono font-black text-white">{meter.pressure_psi} psi</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Acoustic</div>
                      <div className={`text-xs font-mono font-black ${meter.leak_acoustic_db >= 52 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {meter.leak_acoustic_db} dB
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {meter.decision?.explanation}
                  </div>

                  {meter.decision?.leakDetected && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-rose-400 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Loss: {meter.decision.estimatedLossLph} L/h
                      </span>
                      <span className="text-amber-400 font-mono text-[11px] font-bold bg-amber-950/50 px-2 py-0.5 rounded border border-amber-500/30">
                        ${meter.decision.estimatedCostLossPerDayUsd}/day
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dedicated Simulator Playground for Selected Meter */}
          <div className="glass-panel p-6 relative overflow-hidden space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Hydraulic Telemetry Simulator & Injection Control</h3>
                  <span className="text-xs text-cyan-300 font-mono">[{currentMeter?.name}]</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Simulate physical pipe dynamics, test acoustic detection algorithms, and observe immediate incident propagation.
                </p>
              </div>

              {/* Simulation Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 mr-1 font-semibold">Presets:</span>
                <button
                  onClick={() => handleApplyPreset('normal')}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition shadow-sm"
                >
                  Normal
                </button>
                <button
                  onClick={() => handleApplyPreset('pinhole')}
                  className="px-3 py-1 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-300 hover:bg-amber-900/70 text-xs font-bold transition shadow-sm"
                >
                  Pinhole Leak
                </button>
                <button
                  onClick={() => handleApplyPreset('burst')}
                  className="px-3 py-1 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-300 hover:bg-rose-900/70 text-xs font-bold transition shadow-sm"
                >
                  Pipe Burst
                </button>
                <button
                  onClick={() => handleApplyPreset('flapper')}
                  className="px-3 py-1 rounded-lg bg-orange-950/80 border border-orange-500/40 text-orange-300 hover:bg-orange-900/70 text-xs font-bold transition shadow-sm"
                >
                  Flapper Trickle
                </button>
                <button
                  onClick={() => handleApplyPreset('offline')}
                  className="px-2.5 py-1 rounded bg-slate-800/80 border border-slate-600 text-slate-300 hover:bg-slate-700 text-xs font-medium transition"
                >
                  Sensor Offline
                </button>
              </div>
            </div>

            {/* Slider Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Flow Rate (L/min)</span>
                  <span className="font-mono text-cyan-400 font-bold">{simFlow} L/min</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="140"
                  step="0.5"
                  value={simFlow}
                  onChange={e => setSimFlow(Number(e.target.value))}
                  className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>0 (Closed)</span>
                  <span>Baseline: {currentMeter?.baseline_night_flow_lpm}</span>
                  <span>140 (Heavy Main)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Line Pressure (psi)</span>
                  <span className="font-mono text-cyan-400 font-bold">{simPressure} psi</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="1"
                  value={simPressure}
                  onChange={e => setSimPressure(Number(e.target.value))}
                  className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span className="text-rose-400">&lt;32 (Drop)</span>
                  <span>Nominal: 45-60</span>
                  <span>80 (High)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Acoustic Vibration (dB)</span>
                  <span className={`font-mono font-bold ${simAcoustic >= 52 ? 'text-amber-400' : 'text-cyan-400'}`}>
                    {simAcoustic} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="80"
                  step="0.5"
                  value={simAcoustic}
                  onChange={e => setSimAcoustic(Number(e.target.value))}
                  className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>20 (Quiet)</span>
                  <span className="text-amber-400">&gt;=52 (Leak Threshold)</span>
                  <span className="text-rose-400">&gt;70 (Rupture)</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span>Sensor Integrity:</span>
                  <select
                    value={simDataStatus}
                    onChange={e => setSimDataStatus(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="valid">Valid (Normal Telemetry)</option>
                    <option value="stale">Stale (Delayed Gateway)</option>
                    <option value="missing">Missing (Offline)</option>
                    <option value="invalid">Invalid (Checksum Error)</option>
                  </select>
                </label>
              </div>

              <button
                onClick={handleSimulateSubmit}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/40"
              >
                <Activity className="w-3.5 h-3.5" />
                Apply Telemetry to HydroTwin
              </button>
            </div>

            {simulationMsg && (
              <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-cyan-500/40 text-xs text-cyan-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>{simulationMsg}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Consumption Trends & Telemetry */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <ChartCard
            title="12-Hour Water Flow & Pressure Telemetry"
            subtitle="Time-series flow dynamics (L/min) across campus supply lines"
          >
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={readings}>
                  <defs>
                    <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPressure" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="timestamp"
                    stroke="#64748b"
                    fontSize={11}
                    tickFormatter={ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                    labelFormatter={ts => new Date(ts).toLocaleString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="flow_rate_lpm"
                    name="Flow Rate (L/min)"
                    stroke="#06b6d4"
                    fillOpacity={1}
                    fill="url(#colorFlow)"
                  />
                  <Area
                    type="monotone"
                    dataKey="pressure_psi"
                    name="Pressure (psi)"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorPressure)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Daily Consumption Breakdown by Zone */}
          <ChartCard
            title="Campus Water Distribution Breakdown"
            subtitle="Cumulative daily consumption across all sub-metered facilities"
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meters}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="location_id" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  />
                  <Bar dataKey="daily_consumption_liters" name="Daily Liters" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      )}

      {/* Tab 3: Storage Tanks & Rainwater Harvesting */}
      {activeTab === 'tanks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tanks.map(tank => {
            const fill = tank.fill_percentage;
            const isLow = fill <= 25;
            const isFull = fill >= 95;

            return (
              <div
                key={tank.tank_id}
                className="glass-card p-6 space-y-4 hover:border-slate-700 transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">{tank.name}</h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Type: <span className="text-cyan-300 capitalize font-medium">{tank.type.replace(/_/g, ' ')}</span> • {tank.location_id}
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    tank.status === 'optimal'
                      ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                      : tank.status === 'low_reserve'
                      ? 'bg-amber-950/70 text-amber-300 border border-amber-500/40'
                      : tank.status === 'critical_empty'
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-500/50'
                      : 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/40'
                  }`}>
                    {tank.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Animated Tank Level Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">Reservoir Volume</span>
                    <span className="font-mono text-white font-black">
                      {tank.current_volume_liters.toLocaleString()} / {tank.capacity_liters.toLocaleString()} L ({fill}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-4 overflow-hidden p-0.5 border border-slate-800 shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLow ? 'bg-gradient-to-r from-rose-600 to-red-500' : isFull ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      }`}
                      style={{ width: `${fill}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 text-xs shadow-inner">
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">Inflow</div>
                    <div className="font-mono font-bold text-slate-200">{tank.inflow_rate_lpm} L/min</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">Outflow</div>
                    <div className="font-mono font-bold text-slate-200">{tank.outflow_rate_lpm} L/min</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-medium">Water Quality</div>
                    <div className="font-mono font-black text-emerald-400">{tank.water_quality_index}/100</div>
                  </div>
                </div>

                <div className="text-xs text-slate-300 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Automated Action</div>
                  <div className="leading-relaxed">{tank.evaluation?.action}</div>
                </div>

                {/* Simulation Control for Tank */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400 font-semibold">Simulate Level:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSimulateTankFill(tank.tank_id, 15)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold transition"
                    >
                      15% (Low)
                    </button>
                    <button
                      onClick={() => handleSimulateTankFill(tank.tank_id, 80)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold transition"
                    >
                      80% (Optimal)
                    </button>
                    <button
                      onClick={() => handleSimulateTankFill(tank.tank_id, 99)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold transition"
                    >
                      99% (Full)
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 4: Configurable Leak Thresholds */}
      {activeTab === 'thresholds' && tempThresholds && (
        <div className="glass-panel p-6 space-y-6 max-w-3xl">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              Hydraulic Invariants & Detection Sensitivity
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Configure parameters governing the Minimum Night Flow (MNF) multiplier, burst pressure collapse, and acoustic leak alarms.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-200 font-semibold">Minimum Night Flow (MNF) Anomaly Multiplier</span>
                <span className="font-mono text-cyan-400 font-bold">{tempThresholds.nightFlowLeakMultiplier}x baseline</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="4.0"
                step="0.1"
                value={tempThresholds.nightFlowLeakMultiplier}
                onChange={e => setTempThresholds({ ...tempThresholds, nightFlowLeakMultiplier: Number(e.target.value) })}
                className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2"
              />
              <span className="text-[11px] text-slate-500">
                Triggered during zero-occupancy window (01:00 - 05:00) when flow exceeds baseline × multiplier.
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-200 font-semibold">Acoustic Pipe Leak Vibration Threshold</span>
                <span className="font-mono text-cyan-400 font-bold">{tempThresholds.acousticLeakThresholdDb} dB</span>
              </div>
              <input
                type="range"
                min="40"
                max="75"
                step="1"
                value={tempThresholds.acousticLeakThresholdDb}
                onChange={e => setTempThresholds({ ...tempThresholds, acousticLeakThresholdDb: Number(e.target.value) })}
                className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2"
              />
              <span className="text-[11px] text-slate-500">
                Ultrasonic contact microphone reading signifying turbulent pinhole orifice jetting.
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-200 font-semibold">Critical Pipe Burst Flow Threshold</span>
                <span className="font-mono text-cyan-400 font-bold">{tempThresholds.maxBurstFlowLpm} L/min</span>
              </div>
              <input
                type="range"
                min="60"
                max="140"
                step="5"
                value={tempThresholds.maxBurstFlowLpm}
                onChange={e => setTempThresholds({ ...tempThresholds, maxBurstFlowLpm: Number(e.target.value) })}
                className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2"
              />
              <span className="text-[11px] text-slate-500">
                Catastrophic flow rate triggering immediate emergency solenoid valve shutdown recommendation.
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-200 font-semibold">Minimum Line Pressure Safety Floor</span>
                <span className="font-mono text-cyan-400 font-bold">{tempThresholds.minLinePressurePsi} psi</span>
              </div>
              <input
                type="range"
                min="20"
                max="45"
                step="1"
                value={tempThresholds.minLinePressurePsi}
                onChange={e => setTempThresholds({ ...tempThresholds, minLinePressurePsi: Number(e.target.value) })}
                className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2"
              />
              <span className="text-[11px] text-slate-500">
                Pressure level below which pipe rupture or main supply failure is diagnosed.
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-200 font-semibold">Municipal Water Tariff ($ per 1,000 Liters / m³)</span>
                <span className="font-mono text-cyan-400 font-bold">${tempThresholds.tariffPer1000LitersUsd} / m³</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.05"
                value={tempThresholds.tariffPer1000LitersUsd}
                onChange={e => setTempThresholds({ ...tempThresholds, tariffPer1000LitersUsd: Number(e.target.value) })}
                className="w-full accent-cyan-400 bg-slate-800 rounded-lg h-2"
              />
              <span className="text-[11px] text-slate-500">
                Utility billing rate used to compute financial losses caused by undetected leaks.
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              onClick={() => setTempThresholds(thresholds)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Reset to Defaults
            </button>
            <button
              onClick={handleSaveThresholds}
              disabled={savingThresholds}
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-lg shadow-cyan-900/30 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save Invariants
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
