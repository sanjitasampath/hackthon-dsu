import React from 'react';
import { DataSource, DataStatus } from '@ecosphere/shared';

interface Props {
  source?: DataSource | string;
  status?: DataStatus | string;
  className?: string;
}

export const DataSourceBadge: React.FC<Props> = ({ source = 'simulated', status = 'valid', className = '' }) => {
  const getSourceStyle = () => {
    switch (source) {
      case 'sensor':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30';
      case 'model':
        return 'bg-purple-950/60 text-purple-400 border-purple-500/30';
      case 'manual':
        return 'bg-amber-950/60 text-amber-400 border-amber-500/30';
      case 'simulated':
      default:
        return 'bg-cyan-950/60 text-cyan-400 border-cyan-500/30';
    }
  };

  const isDegraded = status !== 'valid';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border ${getSourceStyle()} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isDegraded ? 'bg-amber-400 animate-ping' : 'bg-current'}`} />
      <span>{source}</span>
      {isDegraded && (
        <span className="text-[10px] text-amber-300 font-bold ml-0.5 bg-amber-900/50 px-1 rounded">
          {status}
        </span>
      )}
    </span>
  );
};
