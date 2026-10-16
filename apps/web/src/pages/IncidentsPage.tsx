import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { CampusIncident, IncidentStatus, SeverityLevel } from '@ecosphere/shared';
import { StatusBadge } from '../components/common/StatusBadge';
import { DataSourceBadge } from '../components/common/DataSourceBadge';
import { VerificationModal } from '../components/common/VerificationModal';
import {
  AlertTriangle,
  CheckCircle,
  Filter,
  RefreshCw,
  Search,
  MapPin,
  Clock,
  Layers,
  ChevronRight
} from 'lucide-react';

export const IncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<CampusIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [verifyingIncident, setVerifyingIncident] = useState<CampusIncident | null>(null);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const res = await api.getIncidents();
      setIncidents(res.incidents);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const handleStatusTransition = async (incidentId: string, nextStatus: string) => {
    try {
      await api.updateIncidentStatus(incidentId, nextStatus);
      await fetchIncidents();
    } catch (err: any) {
      alert(`Error updating incident: ${err.message}`);
    }
  };

  const handleVerifyIncident = async (payload: { verifiedBy: string; notes: string; freshReading?: any }) => {
    if (!verifyingIncident) return;
    try {
      await api.verifyIncident(verifyingIncident.incident_id, payload);
      await fetchIncidents();
      setVerifyingIncident(null);
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    }
  };

  const filteredIncidents = incidents.filter(inc => {
    if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
    if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
    if (moduleFilter !== 'all' && inc.module !== moduleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        inc.title.toLowerCase().includes(q) ||
        inc.location_id.toLowerCase().includes(q) ||
        inc.issue_type.toLowerCase().includes(q) ||
        inc.incident_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Campus Incidents Hub</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/70 border border-rose-500/40 text-rose-300">
              Strict Deduplication & Lifecycle
            </span>
            <DataSourceBadge source="simulated" status="valid" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Incidents deduplicated by (module, location_id, asset_id, issue_type). Invariant: Resolution requires documented inspection or fresh valid reading.
          </p>
        </div>

        <button
          onClick={fetchIncidents}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-navy-900 border border-slate-700 hover:border-cyan-500/50 text-cyan-300 transition-all shadow"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-navy-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, location, issue..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-navy-950 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full text-xs">
            {/* Status Pills */}
            <div className="flex items-center gap-1 bg-navy-950 p-1 rounded-lg border border-slate-800">
              {['all', 'open', 'acknowledged', 'in_progress', 'resolved_unverified', 'verified_resolved'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                    statusFilter === st
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st.replace(/_/g, ' ').toUpperCase()}
                </button>
              ))}
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1 bg-navy-950 p-1 rounded-lg border border-slate-800">
              {['all', 'critical', 'warning', 'info'].map(sev => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                    severityFilter === sev
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sev.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        {filteredIncidents.length === 0 ? (
          <div className="text-center py-16 bg-navy-900 border border-slate-800 rounded-2xl text-slate-500 text-sm">
            No campus incidents match the selected filters.
          </div>
        ) : (
          filteredIncidents.map(inc => (
            <div
              key={inc.incident_id}
              className="bg-navy-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-xl transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge type="severity" value={inc.severity} />
                    <span className="font-mono text-xs font-bold text-cyan-400">{inc.incident_id}</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="font-mono text-xs text-purple-300 uppercase bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                      {inc.module}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {inc.location_id}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white tracking-wide">{inc.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge type="status" value={inc.status} />
                  <DataSourceBadge source={inc.data_source} status={inc.data_status} />
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-navy-950/70 p-3 rounded-xl border border-slate-800">
                {inc.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-navy-950/40 p-3 rounded-xl border border-slate-800/80 font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Current Telemetry</span>
                  <span className="font-bold text-white text-sm">{inc.current_value} {inc.unit}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Deduplicated Events</span>
                  <span className="font-bold text-cyan-400 text-sm">{inc.event_count} updates aggregated</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block uppercase">Last Observed</span>
                  <span className="text-slate-300 text-xs">{new Date(inc.last_seen_timestamp).toLocaleTimeString()}</span>
                </div>
              </div>

              {inc.resolution_notes && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs space-y-1">
                  <span className="text-emerald-400 font-bold uppercase text-[10px] block">
                    Certified Resolution Inspection Note:
                  </span>
                  <p className="text-slate-200">{inc.resolution_notes}</p>
                  <div className="text-[10px] text-slate-400 pt-1">
                    Verified by <span className="text-emerald-300">{inc.verified_by}</span> at {new Date(inc.verified_at || '').toLocaleString()}
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
                <span className="text-slate-400">
                  Recommended Action: <span className="text-slate-200">{inc.recommended_action}</span>
                </span>

                <div className="flex items-center gap-2">
                  {inc.status === 'open' && (
                    <button
                      onClick={() => handleStatusTransition(inc.incident_id, 'acknowledged')}
                      className="px-3 py-1.5 bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-600/40 rounded-lg text-xs font-semibold"
                    >
                      Acknowledge
                    </button>
                  )}
                  {inc.status === 'acknowledged' && (
                    <button
                      onClick={() => handleStatusTransition(inc.incident_id, 'in_progress')}
                      className="px-3 py-1.5 bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-600/40 rounded-lg text-xs font-semibold"
                    >
                      Mark In Progress
                    </button>
                  )}
                  {(inc.status === 'in_progress' || inc.status === 'open' || inc.status === 'acknowledged') && (
                    <button
                      onClick={() => handleStatusTransition(inc.incident_id, 'resolved_unverified')}
                      className="px-3 py-1.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-600/40 rounded-lg text-xs font-semibold"
                    >
                      Resolve (Unverified)
                    </button>
                  )}
                  {inc.status === 'resolved_unverified' && (
                    <button
                      onClick={() => setVerifyingIncident(inc)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Verify with Inspection Note
                    </button>
                  )}
                  {inc.status === 'verified_resolved' && (
                    <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Verified Closed
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Verification Invariant Modal */}
      <VerificationModal
        incident={verifyingIncident}
        isOpen={!!verifyingIncident}
        onClose={() => setVerifyingIncident(null)}
        onVerify={handleVerifyIncident}
      />
    </div>
  );
};
