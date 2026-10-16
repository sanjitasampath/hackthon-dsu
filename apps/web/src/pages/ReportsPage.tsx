import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { SustainabilityReport } from '@ecosphere/shared';
import { MetricCard } from '../components/common/MetricCard';
import { DataSourceBadge } from '../components/common/DataSourceBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  FileText,
  Sparkles,
  Bot,
  RefreshCw,
  Zap,
  TrendingDown,
  Trash2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Calendar,
  Layers,
  Info
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<'daily' | 'weekly'>('daily');
  const [report, setReport] = useState<SustainabilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchReport = async (type: 'daily' | 'weekly') => {
    try {
      setLoading(true);
      const res = type === 'daily' ? await api.getDailyReport() : await api.getWeeklyReport();
      setReport(res.report);
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(reportType);
  }, [reportType]);

  const handleGenerateFresh = async () => {
    try {
      setGenerating(true);
      const res = await api.generateReport(reportType);
      setReport(res.report);
    } catch (err: any) {
      alert(`Report synthesis error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">AI Campus Sustainability Intelligence</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950/70 border border-purple-500/40 text-purple-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Executive Audit
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Server-side intelligence synthesis summarizing verified stored records only. Explicitly distinguishes confirmed data from hypotheses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Daily / Weekly Selector */}
          <div className="flex items-center gap-1 bg-navy-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setReportType('daily')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                reportType === 'daily'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Daily Preview
            </button>
            <button
              onClick={() => setReportType('weekly')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                reportType === 'weekly'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Weekly Preview
            </button>
          </div>

          <button
            onClick={handleGenerateFresh}
            disabled={generating}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-900/40 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            <span>Regenerate Audit</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-500 text-sm">
          Loading campus sustainability report...
        </div>
      ) : !report ? (
        <div className="py-24 text-center text-slate-500 text-sm">
          No report generated yet. Click "Regenerate Audit" to synthesize findings.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Provenance & Generator Banner */}
          <div className="bg-navy-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${
                report.generator_type === 'model_generated'
                  ? 'bg-purple-950 border-purple-500/40 text-purple-400'
                  : 'bg-cyan-950 border-cyan-500/40 text-cyan-400'
              }`}>
                {report.generator_type === 'model_generated' ? <Bot className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">{report.title}</h2>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${
                    report.generator_type === 'model_generated'
                      ? 'bg-purple-950/70 border-purple-500/40 text-purple-300'
                      : 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300'
                  }`}>
                    {report.generator_type === 'model_generated' ? 'MODEL GENERATED (GEMINI)' : 'RULE-BASED DETERMINISTIC ENGINE'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    Generated: {new Date(report.generated_at).toLocaleString()}
                  </span>
                  <span>•</span>
                  <span>Summarizing stored database records exclusively</span>
                </div>
              </div>
            </div>

            <DataSourceBadge source={report.generator_type === 'model_generated' ? 'model' : 'simulated'} status="valid" />
          </div>

          {/* Executive Summary */}
          <div className="bg-navy-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Executive Telemetry Synthesis
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed font-medium">
              {report.executive_summary}
            </p>
          </div>

          {/* Core Metric Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Estimated Campus Power"
              value={report.energy_summary.total_consumed_kwh}
              unit="kWh"
              subtext="Aggregated monitored circuits"
              icon={Zap}
              iconColor="text-cyan-400"
              dataSource="simulated"
            />
            <MetricCard
              title="Avoided Energy Waste"
              value={report.energy_summary.total_saved_kwh}
              unit="kWh"
              subtext={`${report.energy_summary.savings_percent}% reduction vs unmanaged`}
              icon={TrendingDown}
              iconColor="text-emerald-400"
              dataSource="simulated"
            />
            <MetricCard
              title="Cost Savings"
              value={`$${report.energy_summary.cost_saved_usd}`}
              unit="USD"
              subtext="At $0.14 / kWh baseline"
              icon={Zap}
              iconColor="text-teal-400"
              dataSource="simulated"
            />
            <MetricCard
              title="Critical Overflow Bins"
              value={report.waste_summary.critical_bins_count}
              unit="bins >= 95%"
              subtext={`${report.waste_summary.total_bins_monitored} total monitored bins`}
              icon={Trash2}
              iconColor="text-rose-400"
              dataSource="simulated"
            />
          </div>

          {/* CRITICAL REQUIREMENT: Confirmed Data vs Possible Explanations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Confirmed Findings Card */}
            <div className="bg-navy-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Confirmed Physical Findings (Measured Data)
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-emerald-300 mb-2">Energy Inefficiencies Verified:</h4>
                  <ul className="space-y-2">
                    {report.energy_summary.confirmed_findings.map((finding, idx) => (
                      <li key={idx} className="p-3 bg-navy-950 rounded-xl border border-slate-800 text-xs text-slate-200 flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5 font-bold">✓</span>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase text-emerald-300 mb-2">Waste Telemetry Verified:</h4>
                  <ul className="space-y-2">
                    {report.waste_summary.confirmed_findings.map((finding, idx) => (
                      <li key={idx} className="p-3 bg-navy-950 rounded-xl border border-slate-800 text-xs text-slate-200 flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5 font-bold">✓</span>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Possible Explanations Card */}
            <div className="bg-navy-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Potential Explanations (Hypotheses / Model Inferences)
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-amber-300 mb-2">Energy Hypotheses:</h4>
                  <ul className="space-y-2">
                    {report.energy_summary.potential_explanations.map((exp, idx) => (
                      <li key={idx} className="p-3 bg-navy-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-amber-400 mt-0.5 font-bold">?</span>
                        <span>{exp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase text-amber-300 mb-2">Waste Surge Hypotheses:</h4>
                  <ul className="space-y-2">
                    {report.waste_summary.potential_explanations.map((exp, idx) => (
                      <li key={idx} className="p-3 bg-navy-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-amber-400 mt-0.5 font-bold">?</span>
                        <span>{exp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="bg-navy-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Prioritized Actionable Sustainability Recommendations
              </h3>
            </div>

            <div className="space-y-3">
              {report.actionable_recommendations.map((rec, idx) => (
                <div key={idx} className="p-4 bg-navy-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge type="severity" value={rec.priority} />
                      <span className="font-mono text-xs font-bold text-cyan-400">{rec.location_id}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="font-mono text-xs text-slate-400 uppercase">{rec.category}</span>
                    </div>
                    <p className="text-xs text-slate-200 font-medium">{rec.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
