import React from 'react';
import { SeverityLevel, IncidentStatus } from '@ecosphere/shared';

interface Props {
  type: 'severity' | 'status' | 'fill';
  value: SeverityLevel | IncidentStatus | string;
  className?: string;
}

export const StatusBadge: React.FC<Props> = ({ type, value, className = '' }) => {
  const getBadgeStyle = () => {
    if (type === 'severity') {
      switch (value) {
        case 'critical':
          return 'bg-rose-950/70 text-rose-300 border-rose-500/40';
        case 'warning':
          return 'bg-amber-950/70 text-amber-300 border-amber-500/40';
        case 'info':
          return 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40';
        case 'healthy':
        default:
          return 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40';
      }
    }

    if (type === 'status') {
      switch (value) {
        case 'open':
          return 'bg-rose-950/60 text-rose-300 border-rose-500/40';
        case 'acknowledged':
          return 'bg-amber-950/60 text-amber-300 border-amber-500/40';
        case 'in_progress':
          return 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40';
        case 'resolved_unverified':
          return 'bg-purple-950/60 text-purple-300 border-purple-500/40';
        case 'verified_resolved':
          return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40';
        default:
          return 'bg-slate-800 text-slate-300 border-slate-700';
      }
    }

    if (type === 'fill') {
      switch (value) {
        case 'critical':
          return 'bg-rose-950/80 text-rose-300 border-rose-500/40';
        case 'collection_recommended':
          return 'bg-orange-950/80 text-orange-300 border-orange-500/40';
        case 'approaching':
          return 'bg-amber-950/80 text-amber-300 border-amber-500/40';
        case 'normal':
        default:
          return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
      }
    }

    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  const formatText = (text: string) => {
    return text.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getBadgeStyle()} ${className}`}>
      {formatText(value)}
    </span>
  );
};
