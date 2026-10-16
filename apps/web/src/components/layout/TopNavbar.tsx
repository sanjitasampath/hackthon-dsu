import React, { useState } from 'react';
import { api } from '../../api/client';
import { RotateCcw, Activity, ShieldCheck, Check } from 'lucide-react';

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
    <header className="h-16 bg-navy-950/80 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Simulation State Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
          <span className="font-semibold tracking-wide">CAMPUS SIMULATION ACTIVE</span>
        </div>
        <span className="text-xs text-slate-500 hidden sm:inline">|</span>
        <span className="text-xs text-slate-400 font-mono hidden sm:inline">
          11 Shared Campus Locations
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleResetDemoData}
          disabled={resetting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            resetSuccess
              ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
              : 'bg-navy-900 border-slate-700 hover:border-amber-500/60 text-slate-300 hover:text-white shadow-sm'
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
              <span>Reset Demo Data</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
