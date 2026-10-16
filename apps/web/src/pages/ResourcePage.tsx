import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import {
  Room,
  RoomSchedule,
  SpaceUtilization,
  ConsolidationRecommendation,
  UnusedTimeBlock,
  ResourceSummaryStats
} from '@ecosphere/resources';
import { MetricCard } from '../components/common/MetricCard';
import { ChartCard } from '../components/common/ChartCard';
import { DataSourceBadge } from '../components/common/DataSourceBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  LayoutGrid,
  Users,
  Zap,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Calendar,
  Clock,
  Sparkles,
  Building,
  Monitor,
  Projector,
  ChevronRight,
  ShieldAlert,
  Flame,
  Info
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

export const ResourcePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'recommendations' | 'timeline' | 'simulator'>('overview');
  const [rooms, setRooms] = useState<(Room & { utilization?: SpaceUtilization })[]>([]);
  const [schedules, setSchedules] = useState<RoomSchedule[]>([]);
  const [recommendations, setRecommendations] = useState<ConsolidationRecommendation[]>([]);
  const [unusedBlocks, setUnusedBlocks] = useState<UnusedTimeBlock[]>([]);
  const [stats, setStats] = useState<ResourceSummaryStats | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Simulation state
  const [simScheduleId, setSimScheduleId] = useState<string>('sched_mon_lh101_09');
  const [simAttendance, setSimAttendance] = useState<number>(22);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [applyingRecId, setApplyingRecId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [roomsRes, schedRes, recsRes, unusedRes, statsRes] = await Promise.all([
        api.getResourceRooms(),
        api.getResourceSchedules(selectedDay),
        api.getResourceRecommendations(),
        api.getUnusedTimeBlocks(selectedDay),
        api.getResourceSummary(selectedDay)
      ]);

      if (roomsRes.success) setRooms(roomsRes.rooms);
      if (schedRes.success) setSchedules(schedRes.schedules);
      if (recsRes.success) setRecommendations(recsRes.recommendations);
      if (unusedRes.success) setUnusedBlocks(unusedRes.unused_blocks);
      if (statsRes.success) setStats(statsRes.stats);
    } catch (err) {
      console.error('Failed to fetch resource management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDay]);

  const handleApplyReallocation = async (rec: ConsolidationRecommendation) => {
    try {
      setApplyingRecId(rec.id);
      await api.reallocateResource({
        schedule_id: rec.source_schedule_id,
        target_room_id: rec.target_room_id,
        recommendation_id: rec.id
      });
      await fetchData();
    } catch (err: any) {
      alert(`Reallocation error: ${err.message}`);
    } finally {
      setApplyingRecId(null);
    }
  };

  const handleSimulateAttendance = async () => {
    try {
      setSimMessage(null);
      const res = await api.simulateScheduleAttendance(simScheduleId, simAttendance);
      if (res.success) {
        setSimMessage(`Updated attendance for ${res.schedule.course_code} to ${res.schedule.actual_attendance} students.`);
        await fetchData();
      }
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    }
  };

  const filteredRooms = rooms.filter(r => {
    if (buildingFilter === 'all') return true;
    return r.building === buildingFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'optimal': return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
      case 'moderate': return 'text-amber-400 bg-amber-950/40 border-amber-500/30';
      case 'severely_underutilized': return 'text-rose-400 bg-rose-950/40 border-rose-500/30';
      case 'overcrowded': return 'text-purple-400 bg-purple-950/40 border-purple-500/30';
      default: return 'text-slate-400 bg-slate-900 border-slate-700';
    }
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  // Data for Utilization Bar Chart
  const utilizationChartData = filteredRooms.map(r => ({
    name: r.room_id,
    rate: r.utilization?.utilization_rate || 0,
    attendance: r.utilization?.actual_attendance || 0,
    capacity: r.capacity
  }));

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <LayoutGrid className="w-7 h-7 text-indigo-400" />
              Campus Space & Resource Optimization
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Timetable AI Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time occupancy correlation, room right-sizing recommendations, and wing HVAC setback automation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DataSourceBadge source="sensor" status="valid" />
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg bg-navy-900 border border-slate-700 hover:border-slate-600 text-slate-300 transition-colors disabled:opacity-50"
            title="Refresh resource telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Avg Space Utilization"
          value={`${stats?.averageUtilizationRate || 0}%`}
          subtext={`${stats?.totalCapacity || 555} total seats across ${stats?.totalRooms || 8} spaces`}
          icon={Users}
          iconColor="text-indigo-400"
          badgeText={stats && stats.averageUtilizationRate >= 70 ? "Optimal Target Met" : "Underutilized"}
          badgeColor={stats && stats.averageUtilizationRate >= 70 ? "emerald" : "amber"}
        />
        <MetricCard
          title="Wasted Seat-Hours"
          value={`${stats?.totalWastedSeatHours || 0} hrs`}
          subtext="Conditioned capacity with empty seats"
          icon={AlertTriangle}
          iconColor="text-amber-400"
          badgeText="Excess Idle Load"
          badgeColor="amber"
        />
        <MetricCard
          title="Daily Energy Reduction"
          value={`${stats?.potentialDailyEnergySavedKwh || 0} kWh`}
          subtext={`Est. $${stats?.potentialCostSavedUsd || 0}/day ($0.14/kWh)`}
          icon={Zap}
          iconColor="text-emerald-400"
          badgeText="Reallocation Savings"
          badgeColor="emerald"
        />
        <MetricCard
          title="Active Opportunities"
          value={`${stats?.activeRecommendationsCount || 0} Actions`}
          subtext={`${stats?.unusedTimeBlocksCount || 0} unoccupied time gaps detected`}
          icon={Sparkles}
          iconColor="text-purple-400"
          badgeText="AI Optimization"
          badgeColor="purple"
        />
      </div>

      {/* Navigation Tabs and Day of Week Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-navy-950/80 rounded-xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Space Utilization
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'recommendations'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Consolidations
            {recommendations.filter(r => r.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-400 text-navy-950 font-bold">
                {recommendations.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Unused Slots & Wing Setback
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'simulator'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Attendance Sandbox
          </button>
        </div>

        {/* Day Selector */}
        <div className="flex items-center gap-1 bg-navy-900/80 p-1 rounded-lg border border-slate-800">
          <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          {days.map(d => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                selectedDay === d
                  ? 'bg-indigo-600/80 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: SPACE UTILIZATION OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Building Filter & Utilization Summary Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-navy-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    Seat Utilization vs Room Capacity
                  </h3>
                  <p className="text-xs text-slate-400">Target institutional efficiency threshold is &gt;75%</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Building:</span>
                  <select
                    value={buildingFilter}
                    onChange={(e) => setBuildingFilter(e.target.value)}
                    className="bg-navy-950 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Buildings</option>
                    <option value="Academic Block A">Academic Block A</option>
                    <option value="Science & Tech Wing">Science & Tech Wing</option>
                  </select>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={utilizationChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                      formatter={(val: any, name: string) => [
                        `${val}%`,
                        name === 'rate' ? 'Utilization' : name
                      ]}
                    />
                    <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                      {utilizationChartData.map((entry, index) => {
                        const color = entry.rate >= 75 ? '#10b981' : entry.rate >= 40 ? '#f59e0b' : '#ef4444';
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Optimal (&gt;75%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Moderate (40-75%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Severely Underutilized (&lt;40%)
                </span>
              </div>
            </div>

            {/* Quick Reallocation Spotlight */}
            <div className="lg:col-span-4 bg-navy-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Top Consolidation Pick
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Highest kWh ROI
                  </span>
                </div>

                {recommendations.length > 0 ? (
                  <div className="p-3.5 rounded-xl bg-navy-950/80 border border-slate-800 space-y-3">
                    <div className="text-xs font-semibold text-slate-200">
                      {recommendations[0].title}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {recommendations[0].description}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Energy Saved</span>
                        <span className="font-bold text-emerald-400">+{recommendations[0].estimated_energy_saved_kwh} kWh</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Cost Avoided</span>
                        <span className="font-bold text-emerald-400">${recommendations[0].estimated_cost_saved_usd}/session</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleApplyReallocation(recommendations[0])}
                      disabled={recommendations[0].status === 'applied' || applyingRecId === recommendations[0].id}
                      className="w-full mt-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-900/40 disabled:opacity-50"
                    >
                      {recommendations[0].status === 'applied' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                          Reallocation Applied
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-3.5 h-3.5" />
                          1-Click Reallocate Space
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No active consolidation recommendations at this time.</p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>View all recommendation details</span>
                <button
                  onClick={() => setActiveTab('recommendations')}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                >
                  Explore <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Room Space Cards Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-400" />
                Campus Spaces Telemetry &amp; Capacity
              </h3>
              <span className="text-xs text-slate-400">Showing {filteredRooms.length} spaces</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredRooms.map(room => {
                const util = room.utilization;
                const rate = util?.utilization_rate || 0;
                const status = util?.status || 'moderate';
                const statusBadgeStyle = getStatusColor(status);

                return (
                  <div
                    key={room.room_id}
                    className="p-4 rounded-2xl bg-navy-900/60 backdrop-blur-md border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-xs font-bold text-indigo-400 block tracking-wider uppercase">
                            {room.room_id}
                          </span>
                          <h4 className="text-sm font-bold text-white leading-tight truncate max-w-[170px]" title={room.name}>
                            {room.name}
                          </h4>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {room.building} (Fl {room.floor})
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${statusBadgeStyle}`}>
                          {status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Equipment Tags */}
                      <div className="flex items-center gap-2 mt-2 mb-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 flex items-center gap-1 capitalize">
                          {room.room_type.replace('_', ' ')}
                        </span>
                        {room.has_projector && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 flex items-center gap-1" title="AV Projector Equipped">
                            <Projector className="w-2.5 h-2.5" /> AV
                          </span>
                        )}
                        {room.has_computers && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 flex items-center gap-1" title="Workstations">
                            <Monitor className="w-2.5 h-2.5" /> PC
                          </span>
                        )}
                      </div>

                      {/* Utilization Bar */}
                      <div className="space-y-1 my-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Utilization</span>
                          <span className="font-bold text-white">{rate}%</span>
                        </div>
                        <div className="w-full h-2 bg-navy-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              rate >= 75 ? 'bg-emerald-500' : rate >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, rate)}%` }}
                          />
                        </div>
                      </div>

                      {/* Metrics Key-Value */}
                      <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-slate-800/80">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Attendance / Cap</span>
                          <span className="font-semibold text-slate-200">
                            {util?.actual_attendance || 0} / {room.capacity}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Unused Seats</span>
                          <span className="font-semibold text-slate-200">
                            {util?.seat_wastage || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Base HVAC</span>
                          <span className="font-semibold text-slate-200">{room.base_hvac_kw} kW</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Wasted Power</span>
                          <span className="font-semibold text-amber-400">{util?.wasted_power_kw || 0} kW</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI CONSOLIDATION RECOMMENDATIONS */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          <div className="bg-navy-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Space Consolidation &amp; Right-Sizing Proposals
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Identifies classes with low attendance in oversized rooms and pairs them with optimal right-sized spaces during the same time slot.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {recommendations.length} Active Opportunities
              </span>
            </div>

            <div className="space-y-4">
              {recommendations.map(rec => {
                const sourceRoom = rooms.find(r => r.room_id === rec.source_room_id);
                const targetRoom = rooms.find(r => r.room_id === rec.target_room_id);

                return (
                  <div
                    key={rec.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      rec.status === 'applied'
                        ? 'bg-navy-950/40 border-emerald-500/30'
                        : 'bg-navy-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            rec.priority === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {rec.priority} Priority
                          </span>
                          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                            {rec.recommendation_type.replace('_', ' ')}
                          </span>
                          {rec.status === 'applied' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Reallocated in Production
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-white">{rec.title}</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{rec.description}</p>

                        {/* Room Migration Flow */}
                        <div className="flex items-center gap-3 pt-2 text-xs">
                          <div className="p-2 rounded-lg bg-navy-900 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Current Space</span>
                            <span className="font-bold text-white">{sourceRoom?.name || rec.source_room_id}</span>
                            <span className="text-[11px] text-rose-400 block">{rec.current_capacity} seats ({rec.attendees} attendees)</span>
                          </div>

                          <ArrowRight className="w-4 h-4 text-slate-500" />

                          <div className="p-2 rounded-lg bg-navy-900 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Proposed Right-Sized Space</span>
                            <span className="font-bold text-white">{targetRoom?.name || rec.target_room_id}</span>
                            <span className="text-[11px] text-emerald-400 block">{rec.target_capacity} seats (Right-Sized)</span>
                          </div>
                        </div>
                      </div>

                      {/* Savings Badges and Apply Action */}
                      <div className="flex flex-col sm:flex-row md:flex-col items-end justify-between gap-3 min-w-[200px]">
                        <div className="text-right space-y-1">
                          <div className="text-base font-black text-emerald-400 flex items-center justify-end gap-1">
                            <Zap className="w-4 h-4 text-emerald-400" />
                            +{rec.estimated_energy_saved_kwh} kWh
                          </div>
                          <div className="text-xs text-slate-400">
                            Avoids <span className="text-emerald-400 font-semibold">${rec.estimated_cost_saved_usd}</span> &amp; {rec.estimated_co2_kg_saved} kg CO₂
                          </div>
                        </div>

                        <button
                          onClick={() => handleApplyReallocation(rec)}
                          disabled={rec.status === 'applied' || applyingRecId === rec.id}
                          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40 disabled:opacity-50"
                        >
                          {rec.status === 'applied' ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                              Reallocation Active
                            </>
                          ) : (
                            <>
                              <ArrowRight className="w-4 h-4" />
                              Execute Reallocation
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: UNUSED TIME BLOCKS & WING SETBACK */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          <div className="bg-navy-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  Unoccupied Intervals &amp; Standby HVAC Setback Timeline
                </h3>
                <p className="text-xs text-slate-400">
                  Rooms with &gt;30 min gaps during campus hours (08:00 - 18:00) eligible for automated thermal setback.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {selectedDay} Operating Schedule
              </span>
            </div>

            <div className="space-y-3">
              {unusedBlocks.map((block, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-navy-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center font-bold text-slate-300 text-xs">
                      {block.duration_hours}h
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        {block.room_name} ({block.room_id})
                        <span className="text-[11px] text-slate-400 font-normal">in {block.building}</span>
                      </h4>
                      <span className="text-[11px] text-amber-400 font-mono mt-0.5 block">
                        Unoccupied from {block.start_time} to {block.end_time} ({block.duration_hours} hours continuous)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs sm:text-right">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Standby Load</span>
                      <span className="font-semibold text-slate-300">{block.idle_power_kw} kW</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Setback Potential</span>
                      <span className="font-bold text-emerald-400">+{block.savings_potential_kwh} kWh</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INTERACTIVE ATTENDANCE SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div className="bg-navy-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-5 shadow-xl max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Live Attendance Sandbox</h3>
                <p className="text-xs text-slate-400">
                  Simulate variations in student attendance to observe real-time room utilization shift and recommendation recomputation.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Select Target Academic Schedule:
                </label>
                <select
                  value={simScheduleId}
                  onChange={(e) => {
                    setSimScheduleId(e.target.value);
                    const s = schedules.find(sched => sched.id === e.target.value);
                    if (s) setSimAttendance(s.actual_attendance);
                  }}
                  className="w-full bg-navy-950 border border-slate-700 text-xs text-white rounded-xl p-3 focus:outline-none focus:border-indigo-500"
                >
                  {schedules.map(s => {
                    const r = rooms.find(rm => rm.room_id === s.room_id);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.course_code} - {s.course_title} ({s.room_id}, Cap: {r?.capacity || 0}, Current: {s.actual_attendance})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                  <span>Actual In-Person Attendance:</span>
                  <span className="text-indigo-400 font-bold">{simAttendance} Students</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="160"
                  value={simAttendance}
                  onChange={(e) => setSimAttendance(Number(e.target.value))}
                  className="w-full h-2 bg-navy-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>0 (Vacant)</span>
                  <span>40 (Seminar)</span>
                  <span>80 (Classroom)</span>
                  <span>160 (Full Lecture Hall)</span>
                </div>
              </div>

              {simMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {simMessage}
                </div>
              )}

              <button
                onClick={handleSimulateAttendance}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Inject Simulated Attendance &amp; Recalculate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
