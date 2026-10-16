import React from 'react';
import { DataSourceBadge } from './DataSourceBadge';

interface Props {
  title: string;
  subtitle?: string;
  dataSource?: 'simulated' | 'sensor' | 'manual' | 'model';
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const ChartCard: React.FC<Props> = ({
  title,
  subtitle,
  dataSource = 'simulated',
  headerRight,
  children,
  className = ''
}) => {
  return (
    <div className={`bg-navy-900/90 border border-slate-800/80 rounded-xl p-5 shadow-lg shadow-black/20 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/60 gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-white tracking-wide">{title}</h3>
            <DataSourceBadge source={dataSource} />
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
};
