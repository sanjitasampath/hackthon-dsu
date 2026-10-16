import React, { useState } from 'react';
import { api } from '../../api/client';
import { RotateCcw, Activity, ShieldCheck, Check, Sparkles } from 'lucide-react';

interface Props {
  onRefreshAll?: () => void;
}

export const TopNavbar: React.FC<Props> = ({ onRefreshAll }) => {
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleResetDemoData = async () => {
    if (!window.confirm('Reset all simulated sensor streams, bins, and incidents to baseline demo state?')) {
      return;
    }

    try {
      setResetting(true);
      await api.resetDemoData();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
      if (onRefreshAll) {
        onRefreshAll();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <header className="h-16 bg-[#070b14]/75 backdrop-blur-xl border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Simulation State Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="font-bold tracking-wide">CAMPUS SIMULATION ACTIVE</span>
        </div>
        <span className="text-xs text-slate-600 hidden sm:inline">|</span>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>11 Shared Locations</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleResetDemoData}
          disabled={resetting}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 shadow-sm ${
            resetSuccess
              ? 'bg-emerald-950 border-emerald-500 text-emerald-300 shadow-glow-emerald'
              : 'bg-slate-900/80 border-slate-700/80 hover:border-amber-500/60 hover:bg-slate-800 text-slate-300 hover:text-white'
          }`}
          title="Reset all demo sensors and incidents to initial state"
        >
          {resetSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Reset Completed</span>
            </>
          ) : (
            <>
              <RotateCcw className={`w-3.5 h-3.5 text-amber-400 ${resetting ? 'animate-spin' : ''}`} />
              <span>Reset Demo State</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
