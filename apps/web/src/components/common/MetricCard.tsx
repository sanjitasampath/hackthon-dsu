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
      className={`bg-navy-900/90 border border-slate-800/80 rounded-xl p-5 shadow-lg shadow-black/20 relative overflow-hidden transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-cyan-500/50 hover:bg-navy-850' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg bg-navy-800/80 border border-slate-700/60 ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
            {badgeText && (
              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${badgeColor}`}>
                {badgeText}
              </span>
            )}
          </div>
        </div>
        <DataSourceBadge source={dataSource} status={dataStatus} />
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-white tracking-tight">{value}</span>
        {unit && <span className="text-sm font-semibold text-slate-400">{unit}</span>}
      </div>

      {subtext && <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">{subtext}</p>}
    </div>
  );
};
