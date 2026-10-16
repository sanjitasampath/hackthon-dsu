import React, { useState } from 'react';
import { CampusIncident } from '@ecosphere/shared';
import { CheckCircle, ShieldCheck, X } from 'lucide-react';

interface Props {
  incident: CampusIncident | null;
  isOpen: boolean;
  onClose: () => void;
  onVerify: (payload: { verifiedBy: string; notes: string; freshReading?: any }) => Promise<void>;
}

export const VerificationModal: React.FC<Props> = ({ incident, isOpen, onClose, onVerify }) => {
  const [inspectorName, setInspectorName] = useState('Staff Engineer Sarah Jenkins (ID #FAC-409)');
  const [inspectionNote, setInspectionNote] = useState('');
  const [freshReadingValue, setFreshReadingValue] = useState<string>('');
  const [useFreshReading, setUseFreshReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !incident) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (inspectionNote.trim().length < 5) {
      setError('A documented inspection note of at least 5 characters is required for audited verification.');
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
        verifiedBy: inspectorName.trim(),
        notes: inspectionNote.trim()
      };

      if (useFreshReading && freshReadingValue !== '') {
        payload.freshReading = {
          value: Number(freshReadingValue),
          unit: incident.unit,
          data_status: 'valid'
        };
      }

      await onVerify(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to verify incident');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-navy-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-navy-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Audited Incident Resolution</h3>
              <p className="text-xs text-slate-400">Document physical inspection or valid telemetry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-lg bg-navy-950 border border-slate-800 text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Incident:</span>
              <span className="font-mono text-cyan-400 font-bold">{incident.incident_id}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Location:</span>
              <span className="text-white">{incident.location_id}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Current Issue:</span>
              <span className="text-rose-400 font-medium">{incident.title}</span>
            </div>
          </div>

          <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200 leading-relaxed">
            <span className="font-bold text-amber-300">Invariant Enforced:</span> Clicking "Resolve" alone only marks an incident as unverified. Permanent resolution requires a certified inspection note or a fresh valid reading.
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Inspector Name & Staff ID
            </label>
            <input
              type="text"
              required
              value={inspectorName}
              onChange={e => setInspectorName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-navy-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Documented Physical Inspection Findings
            </label>
            <textarea
              required
              rows={3}
              value={inspectionNote}
              onChange={e => setInspectionNote(e.target.value)}
              placeholder="e.g. Visually inspected room. All occupants departed, auxiliary air conditioning safely shutdown, door locked."
              className="w-full px-3 py-2 text-sm bg-navy-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400 placeholder:text-slate-600"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={useFreshReading}
                onChange={e => setUseFreshReading(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Attach verified fresh telemetry reading</span>
            </label>

            {useFreshReading && (
              <div className="mt-2 pl-6">
                <input
                  type="number"
                  step="any"
                  value={freshReadingValue}
                  onChange={e => setFreshReadingValue(e.target.value)}
                  placeholder={`Fresh normalized reading (${incident.unit})`}
                  className="w-full px-3 py-1.5 text-sm bg-navy-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-900/40 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {loading ? 'Verifying...' : 'Confirm & Mark Verified Resolved'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
