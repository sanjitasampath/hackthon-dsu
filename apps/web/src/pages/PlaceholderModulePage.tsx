import React from 'react';
import { LucideIcon, AlertCircle, PackageCheck, ExternalLink } from 'lucide-react';

interface Props {
  moduleName: string;
  icon: LucideIcon;
  plannedFeatures: string[];
}

export const PlaceholderModulePage: React.FC<Props> = ({ moduleName, icon: Icon, plannedFeatures }) => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="bg-navy-900 border border-slate-800 rounded-2xl p-8 shadow-xl text-center relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-cyan-500/10 blur-3xl pointer-events-none" />

        <div className="inline-flex p-4 rounded-2xl bg-navy-800 border border-slate-700 text-cyan-400 mb-5">
          <Icon className="w-10 h-10" />
        </div>

        <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/70 border border-amber-500/40 text-amber-300 mb-3">
          Module not installed
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight">{moduleName}</h1>
        <p className="mt-2 text-sm text-slate-400 max-w-lg mx-auto">
          This domain is part of the EcoSphere pluggable campus registry. Core module contracts and database schema are ready for activation.
        </p>

        <div className="mt-8 text-left bg-navy-950/80 border border-slate-800/80 rounded-xl p-5 max-w-xl mx-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-emerald-400" />
            Planned Module Capabilities
          </h3>
          <ul className="space-y-2 text-xs text-slate-300">
            {plannedFeatures.map((feat, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-cyan-400 mt-0.5">•</span>
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-cyan-400" />
            Zero disruption to Energy & Waste engines
          </span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
          >
            Review docs/ADDING_A_MODULE.md
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
