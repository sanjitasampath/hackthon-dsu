import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { CampusIncident, CampusLocation, CampusEvent } from '@ecosphere/shared';
import { SmartBin } from '@ecosphere/waste';
import { StatusBadge } from '../components/common/StatusBadge';
import { DataSourceBadge } from '../components/common/DataSourceBadge';
import { VerificationModal } from '../components/common/VerificationModal';
import {
  Layers,
  MapPin,
  X,
  AlertTriangle,
  Zap,
  Trash2,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DigitalTwinPage: React.FC = () => {
  const [locations, setLocations] = useState<CampusLocation[]>([]);
  const [incidents, setIncidents] = useState<CampusIncident[]>([]);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [bins, setBins] = useState<SmartBin[]>([]);
  const [energyZones, setEnergyZones] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>('AUDITORIUM_01');
  const [loading, setLoading] = useState(true);
  const [verifyingIncident, setVerifyingIncident] = useState<CampusIncident | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [locRes, incRes, evtRes, binRes, zoneRes] = await Promise.all([
        api.getLocations(),
        api.getIncidents(),
        api.getEvents({ limit: 100 }),
        api.getWasteBins(),
        api.getEnergyZones()
      ]);

      setLocations(locRes.locations);
      setIncidents(incRes.incidents);
      setEvents(evtRes.events);
      setBins(binRes.bins);
      setEnergyZones(zoneRes.zones);
    } catch (err) {
      console.error('Failed to load campus twin telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const selectedLocation = locations.find(l => l.location_id === selectedLocationId);
  const locationIncidents = incidents.filter(i => i.location_id === selectedLocationId);
  const locationEvents = events.filter(e => e.location_id === selectedLocationId);
  const locationBins = bins.filter(b => b.location_id === selectedLocationId);
  const locationZone = energyZones.find(z => z.locationId === selectedLocationId);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { fill: '#3b0d18', stroke: '#f43f5e', text: '#fda4af', glow: 'rgba(244, 63, 94, 0.4)' };
      case 'warning':
        return { fill: '#3b250d', stroke: '#f59e0b', text: '#fde68a', glow: 'rgba(245, 158, 11, 0.4)' };
      case 'info':
        return { fill: '#0c2738', stroke: '#06b6d4', text: '#a5f3fc', glow: 'rgba(6, 182, 212, 0.4)' };
      case 'healthy':
      default:
        return { fill: '#0a2e1d', stroke: '#10b981', text: '#a7f3d0', glow: 'rgba(16, 185, 129, 0.3)' };
    }
  };

  const handleStatusTransition = async (incidentId: string, nextStatus: string) => {
    try {
      await api.updateIncidentStatus(incidentId, nextStatus);
      await fetchData();
    } catch (err: any) {
      alert(`Error updating incident: ${err.message}`);
    }
  };

  const handleVerifyIncident = async (payload: { verifiedBy: string; notes: string; freshReading?: any }) => {
    if (!verifyingIncident) return;
    try {
      await api.verifyIncident(verifyingIncident.incident_id, payload);
      await fetchData();
      setVerifyingIncident(null);
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Campus Digital Twin</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/70 border border-cyan-500/40 text-cyan-300">
              Live Interactive Topology
            </span>
            <DataSourceBadge source="simulated" status="valid" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time SVG floorplan mapping 11 campus assets. Color-coded by worst active severity. Click any location to inspect telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-navy-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span>11 Locations Synced</span>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white bg-navy-900 border border-slate-800 hover:border-slate-700 rounded-lg transition-all"
            title="Refresh Twin Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid: SVG Map on Left, Inspection Drawer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SVG Canvas Map Card */}
        <div className="lg:col-span-8 bg-navy-900/90 border border-slate-800 rounded-2xl p-4 shadow-2xl relative overflow-hidden">
          {/* Map Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-2 border-b border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Campus Spatial Twin</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-rose-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 shadow-sm shadow-rose-500" /> Critical
              </span>
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shadow-sm shadow-amber-500" /> Warning
              </span>
              <span className="flex items-center gap-1.5 text-cyan-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500" /> Info
              </span>
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Healthy
              </span>
            </div>
          </div>

          {/* SVG Map Layout */}
          <div className="w-full aspect-[16/10] bg-[#070b14] rounded-xl border border-slate-800/90 relative overflow-hidden flex items-center justify-center p-2">
            <svg
              viewBox="0 0 1020 540"
              className="w-full h-full select-none"
              style={{ filter: 'drop-shadow(0px 8px 16px rgba(0,0,0,0.5))' }}
            >
              <defs>
                <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#131e36" strokeWidth="0.75" />
                </pattern>
                <linearGradient id="walkwayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#15213d" />
                  <stop offset="100%" stopColor="#0f192e" />
                </linearGradient>
              </defs>

              {/* Grid Background */}
              <rect width="1020" height="540" fill="url(#gridPattern)" />

              {/* Campus Roads and Walkways */}
              <path
                d="M 40 230 L 980 230 M 400 40 L 400 500 M 620 40 L 620 500 M 810 40 L 810 500"
                stroke="url(#walkwayGrad)"
                strokeWidth="28"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 40 230 L 980 230 M 400 40 L 400 500 M 620 40 L 620 500 M 810 40 L 810 500"
                stroke="#1e2e54"
                strokeWidth="1.5"
                strokeDasharray="6 6"
                fill="none"
              />

              {/* Central Courtyard Green Area */}
              <rect x="420" y="245" width="180" height="20" rx="8" fill="#0d2e20" stroke="#155e3b" strokeWidth="1" />
              <text x="510" y="259" fill="#34d399" fontSize="10" fontFamily="monospace" textAnchor="middle">
                CENTRAL SUSTAINABILITY QUAD
              </text>

              {/* Campus Locations Render */}
              {locations.map(loc => {
                const isSelected = loc.location_id === selectedLocationId;
                const colors = getSeverityColor(loc.activeSeverity || 'healthy');
                const { x, y, width, height } = loc.coordinates;

                return (
                  <g
                    key={loc.location_id}
                    onClick={() => setSelectedLocationId(loc.location_id)}
                    className="cursor-pointer transition-transform duration-200"
                    style={{ transformOrigin: `${x + width / 2}px ${y + height / 2}px` }}
                  >
                    {/* Shadow / selection halo */}
                    {isSelected && (
                      <rect
                        x={x - 6}
                        y={y - 6}
                        width={width + 12}
                        height={height + 12}
                        rx="14"
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="2.5"
                        strokeDasharray="4 4"
                        className="animate-pulse"
                      />
                    )}

                    {/* Building Body */}
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      rx="10"
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={isSelected ? '2.5' : '1.5'}
                      style={{
                        filter: loc.activeSeverity === 'critical' ? `drop-shadow(0 0 10px ${colors.glow})` : undefined
                      }}
                    />

                    {/* Status Pip */}
                    <circle
                      cx={x + width - 14}
                      cy={y + 14}
                      r="4.5"
                      fill={colors.stroke}
                      className={loc.activeSeverity === 'critical' ? 'animate-ping' : ''}
                    />
                    <circle
                      cx={x + width - 14}
                      cy={y + 14}
                      r="4.5"
                      fill={colors.stroke}
                    />

                    {/* Location ID Label */}
                    <text
                      x={x + 12}
                      y={y + 22}
                      fill={colors.text}
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {loc.location_id}
                    </text>

                    {/* Friendly Name */}
                    <text
                      x={x + 12}
                      y={y + 40}
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {loc.name.length > 20 ? loc.name.slice(0, 18) + '...' : loc.name}
                    </text>

                    {/* Zone Type Tag */}
                    <rect
                      x={x + 12}
                      y={y + height - 26}
                      width={width - 24}
                      height="16"
                      rx="4"
                      fill="#070b14"
                      stroke="#1e294b"
                      strokeWidth="0.8"
                    />
                    <text
                      x={x + width / 2}
                      y={y + height - 14}
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {loc.zone_type.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Side Panel: Location Inspection Drawer */}
        <div className="lg:col-span-4 bg-navy-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5">
          {selectedLocation ? (
            <>
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-base font-extrabold text-white tracking-wide">
                      {selectedLocation.name}
                    </h2>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-xs text-cyan-400 font-semibold">{selectedLocation.location_id}</span>
                    <span className="text-xs text-slate-500">•</span>
                    <span className="text-xs text-slate-400 uppercase font-medium">{selectedLocation.zone_type}</span>
                  </div>
                </div>
                <StatusBadge type="severity" value={selectedLocation.activeSeverity || 'healthy'} />
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-navy-950/70 p-3 rounded-lg border border-slate-800/80">
                {selectedLocation.description}
              </p>

              {/* Cross-Module Telemetry Snapshot */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  Live Module Telemetry
                </h3>

                {locationZone && (
                  <div className="p-3 bg-navy-950 border border-slate-800 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                        <Zap className="w-3 h-3" /> Energy Load
                      </span>
                      <span className="font-mono font-bold text-white">
                        {locationZone.decision?.powerCurrentKw?.toFixed(2)} kW
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Baseline: {locationZone.decision?.powerBaselineKw?.toFixed(2)} kW</span>
                      <span className="text-emerald-400">Est. Saved: {locationZone.savings?.energySavedKwh?.toFixed(2)} kWh</span>
                    </div>
                    <div className="text-[11px] text-slate-300 bg-navy-900/80 p-2 rounded border border-slate-800">
                      {locationZone.decision?.explanation}
                    </div>
                  </div>
                )}

                {locationBins.length > 0 && (
                  <div className="p-3 bg-navy-950 border border-slate-800 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1 text-purple-300 font-semibold">
                        <Trash2 className="w-3 h-3" /> Waste Bins ({locationBins.length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {locationBins.map(b => (
                        <div key={b.bin_id} className="flex items-center justify-between text-[11px] bg-navy-900 p-1.5 rounded">
                          <span className="font-mono text-slate-300">{b.waste_category.replace(/_/g, ' ')}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white font-mono">{b.fill_percentage}%</span>
                            <StatusBadge type="fill" value={b.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!locationZone && locationBins.length === 0 && (
                  <div className="p-3 bg-navy-950 border border-slate-800/80 rounded-lg text-xs text-slate-500 text-center">
                    No active energy or waste sensor telemetry mapped to this zone.
                  </div>
                )}
              </div>

              {/* Active Incidents */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    Active Incidents ({locationIncidents.length})
                  </h3>
                  <Link to="/incidents" className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                    All Incidents <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                </div>

                {locationIncidents.length === 0 ? (
                  <div className="text-xs text-emerald-400/80 bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-lg text-center">
                    ✓ Zero active incidents. All parameters operating normally.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {locationIncidents.map(inc => (
                      <div key={inc.incident_id} className="p-3 bg-navy-950 border border-slate-800 rounded-lg text-xs space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-semibold text-white leading-tight">{inc.title}</span>
                          <StatusBadge type="severity" value={inc.severity} />
                        </div>
                        <p className="text-[11px] text-slate-400">{inc.recommended_action}</p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                          <span className="text-slate-500">Status:</span>
                          <StatusBadge type="status" value={inc.status} />
                        </div>

                        {/* Lifecycle Action Buttons */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {inc.status === 'open' && (
                            <button
                              onClick={() => handleStatusTransition(inc.incident_id, 'acknowledged')}
                              className="px-2 py-1 bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-600/40 rounded text-[11px] font-semibold"
                            >
                              Acknowledge
                            </button>
                          )}
                          {inc.status === 'acknowledged' && (
                            <button
                              onClick={() => handleStatusTransition(inc.incident_id, 'in_progress')}
                              className="px-2 py-1 bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-600/40 rounded text-[11px] font-semibold"
                            >
                              Mark In Progress
                            </button>
                          )}
                          {(inc.status === 'in_progress' || inc.status === 'open' || inc.status === 'acknowledged') && (
                            <button
                              onClick={() => handleStatusTransition(inc.incident_id, 'resolved_unverified')}
                              className="px-2 py-1 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-600/40 rounded text-[11px] font-semibold"
                            >
                              Resolve (Unverified)
                            </button>
                          )}
                          {inc.status === 'resolved_unverified' && (
                            <button
                              onClick={() => setVerifyingIncident(inc)}
                              className="px-2 py-1 bg-emerald-900/80 hover:bg-emerald-700 text-emerald-200 border border-emerald-500/50 rounded text-[11px] font-semibold flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Verify & Close
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Raw Events */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Recent Telemetry Events ({locationEvents.length})
                </h3>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {locationEvents.slice(0, 5).map(ev => (
                    <div key={ev.event_id} className="p-2 bg-navy-950/60 rounded border border-slate-800 text-[11px] flex justify-between items-center">
                      <div>
                        <span className="font-mono text-cyan-400 uppercase">{ev.issue_type}</span>
                        <div className="text-slate-500 text-[10px]">{new Date(ev.timestamp).toLocaleTimeString()}</div>
                      </div>
                      <span className="font-mono text-white font-bold">{ev.current_value} {ev.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-sm">
              Select any campus location on the map to inspect live twin telemetry.
            </div>
          )}
        </div>
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
