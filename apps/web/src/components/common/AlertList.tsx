import React, { useState } from 'react';
import { CampusEvent, SeverityLevel } from '@ecosphere/shared';
import { StatusBadge } from './StatusBadge';
import { DataSourceBadge } from './DataSourceBadge';
import { AlertTriangle, Clock, MapPin } from 'lucide-react';

interface Props {
  events: CampusEvent[];
  onSelectEvent?: (event: CampusEvent) => void;
  maxItems?: number;
  showFilters?: boolean;
}

export const AlertList: React.FC<Props> = ({
  events,
  onSelectEvent,
  maxItems = 10,
  showFilters = true
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');

  const filteredEvents = events.filter(e => {
    if (selectedSeverity !== 'all' && e.severity !== selectedSeverity) return false;
    if (selectedModule !== 'all' && e.module !== selectedModule) return false;
    return true;
  }).slice(0, maxItems);

  return (
    <div className="space-y-3">
      {showFilters && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 mr-1">Severity:</span>
            {['all', 'critical', 'warning', 'info'].map(sev => (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`px-2 py-0.5 rounded text-xs transition-all ${
                  selectedSeverity === sev
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 mr-1">Module:</span>
            {['all', 'energy', 'waste'].map(mod => (
              <button
                key={mod}
                onClick={() => setSelectedModule(mod)}
                className={`px-2 py-0.5 rounded text-xs transition-all ${
                  selectedModule === mod
                    ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mod.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredEvents.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No campus alerts matching active criteria.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredEvents.map(ev => {
            const dateStr = new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div
                key={ev.event_id}
                onClick={() => onSelectEvent?.(ev)}
                className={`p-3.5 rounded-lg border bg-navy-950/60 border-slate-800 hover:border-slate-700 transition-all ${
                  onSelectEvent ? 'cursor-pointer hover:bg-navy-900/80' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge type="severity" value={ev.severity} />
                    <span className="text-xs font-mono uppercase text-slate-400 px-1.5 py-0.5 rounded bg-slate-800/80">
                      {ev.module}
                    </span>
                  </div>
                  <DataSourceBadge source={ev.data_source} status={ev.data_status} />
                </div>

                <div className="mt-2">
                  <h4 className="text-sm font-semibold text-white tracking-wide flex items-center gap-1.5">
                    <AlertTriangle className={`w-3.5 h-3.5 ${
                      ev.severity === 'critical' ? 'text-rose-400' : ev.severity === 'warning' ? 'text-amber-400' : 'text-cyan-400'
                    }`} />
                    {ev.issue_type.replace(/_/g, ' ').toUpperCase()}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {ev.recommended_action}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/50">
                  <span className="flex items-center gap-1 font-mono text-cyan-300">
                    <MapPin className="w-3 h-3 text-slate-500" />
                    {ev.location_id}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {dateStr}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
