import React from 'react';
import { LucideIcon } from 'lucide-react';
import { DataSourceBadge } from './DataSourceBadge';

interface Props {
  title: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon: LucideIcon;
  iconColor?: string;
  dataSource?: 'simulated' | 'sensor' | 'manual' | 'model';
  dataStatus?: 'valid' | 'stale' | 'missing' | 'invalid';
  badgeText?: string;
  badgeColor?: string;
  onClick?: () => void;
}

export const MetricCard: React.FC<Props> = ({
  title,
  value,
  unit,
  subtext,
  icon: Icon,
  iconColor = 'text-cyan-400',
  dataSource = 'simulated',
  dataStatus = 'valid',
  badgeText,
  badgeColor = 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30',
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className={`glass-card p-5 relative overflow-hidden transition-all duration-300 group ${
        onClick ? 'cursor-pointer hover:border-cyan-500/50 hover:shadow-glow-cyan' : ''
      }`}
    >
      {/* Ambient background soft glow */}
      <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-slate-700/10 blur-2xl group-hover:bg-cyan-500/10 transition-colors pointer-events-none" />

      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/70 shadow-inner group-hover:scale-105 transition-transform ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-300 transition-colors">
              {title}
            </h3>
            {badgeText && (
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
                {badgeText}
              </span>
            )}
          </div>
        </div>
        <DataSourceBadge source={dataSource} status={dataStatus} />
      </div>

      <div className="mt-4 flex items-baseline gap-2 relative z-10">
        <span className="text-3xl font-black text-white tracking-tight">{value}</span>
        {unit && <span className="text-xs font-semibold text-slate-400">{unit}</span>}
      </div>

      {subtext && (
        <p className="mt-2 text-xs text-slate-400/90 flex items-center gap-1.5 leading-snug relative z-10">
          {subtext}
        </p>
      )}
    </div>
  );
};
