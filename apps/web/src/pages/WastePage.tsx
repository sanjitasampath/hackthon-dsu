import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import { SmartBin, CollectionTask, ClassificationRecord } from '@ecosphere/waste';
import { MetricCard } from '../components/common/MetricCard';
import { ChartCard } from '../components/common/ChartCard';
import { DataSourceBadge } from '../components/common/DataSourceBadge';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  Trash2,
  AlertTriangle,
  Camera,
  CheckCircle,
  Clock,
  Sparkles,
  Upload,
  RefreshCw,
  Cpu,
  Layers,
  ArrowUpRight,
  TrendingUp,
  FileCheck,
  CheckCircle2,
  LayoutDashboard,
  BarChart3,
  Info
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const WastePage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'overview' | 'segregation' | 'bins' | 'collection' | 'analytics'>('overview');
  const [bins, setBins] = useState<SmartBin[]>([]);
  const [tasks, setTasks] = useState<CollectionTask[]>([]);
  const [history, setHistory] = useState<ClassificationRecord[]>([]);
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // AI Segregation State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [classificationResult, setClassificationResult] = useState<any>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [setupGuide, setSetupGuide] = useState<string | null>(null);
  const [correctingRecordId, setCorrectingRecordId] = useState<string | null>(null);
  const [manualCorrectionCategory, setManualCorrectionCategory] = useState<string>('plastic');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ESP32 Simulator State
  const [espBinId, setEspBinId] = useState('BIN_CANTEEN_ORG_01');
  const [espDistance, setEspDistance] = useState(12);
  const [espStatusMsg, setEspStatusMsg] = useState<string | null>(null);

  // Task Verification Modal State
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('Custodial staff emptied bin, bag replaced, ultrasonic reflector cleaned.');

  const fetchWasteData = async () => {
    try {
      setLoading(true);
      const [binsRes, tasksRes, histRes, modelInfoRes] = await Promise.all([
        api.getWasteBins(),
        api.getCollectionTasks(),
        api.getWasteHistory(),
        api.getWasteModelInfo().catch(() => ({ success: false, isTrained: false }))
      ]);
      setBins(binsRes.bins);
      setTasks(tasksRes.tasks);
      setHistory(histRes.history);
      if (modelInfoRes && modelInfoRes.success) {
        setModelInfo(modelInfoRes);
      }
    } catch (err) {
      console.error('Failed to load waste module telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWasteData();
  }, []);

  // Demo adjustment of bin fill level
  const handleSimulateFill = async (binId: string, fillChange: number) => {
    const targetBin = bins.find(b => b.bin_id === binId);
    if (!targetBin) return;
    const newFill = Math.max(0, Math.min(100, targetBin.fill_percentage + fillChange));

    try {
      await api.simulateWasteBin(binId, newFill, targetBin.data_status);
      await fetchWasteData();
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    }
  };

  const handleSetFillPreset = async (binId: string, presetFill: number) => {
    try {
      await api.simulateWasteBin(binId, presetFill, 'valid');
      await fetchWasteData();
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    }
  };

  // Handle Image Upload for Segregation
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
      setClassificationResult(null);
      setModelError(null);
      setSetupGuide(null);
    };
    reader.readAsDataURL(file);
  };

  // Curated Sample Images from Merged Waste Classification Dataset (MWCD)
  const sampleImages = [
    { name: 'Cardboard Box', url: '/samples/sample_cardboard.jpg', label: 'Cardboard' },
    { name: 'Plastic Bottle', url: '/samples/sample_plastic.jpg', label: 'Plastic' },
    { name: 'Organic Waste', url: '/samples/sample_organic.jpg', label: 'Organic' },
    { name: 'Aluminium Can', url: '/samples/sample_metal.jpg', label: 'Metal' },
    { name: 'Glass Bottle', url: '/samples/sample_glass.jpg', label: 'Glass' },
    { name: 'Battery Specimen', url: '/samples/sample_battery.jpg', label: 'Hazardous Battery' },
    { name: 'Paper Notes', url: '/samples/sample_paper.jpg', label: 'Paper' },
    { name: 'Textile Fabric', url: '/samples/sample_textile.jpg', label: 'Textile' },
    { name: 'General Trash', url: '/samples/sample_trash.jpg', label: 'Landfill Trash' }
  ];

  const handleSelectSample = async (sampleUrl: string) => {
    try {
      const res = await fetch(sampleUrl);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setClassificationResult(null);
        setModelError(null);
        setSetupGuide(null);
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      console.error('Failed to load sample image:', err);
    }
  };

  const handleClassifyImage = async () => {
    if (!selectedImage) return;

    try {
      setClassifying(true);
      setModelError(null);
      setSetupGuide(null);

      const res = await api.classifyWasteImage(selectedImage);

      if (!res.modelAvailable) {
        setModelError(res.error || 'Gemini Vision model is not configured.');
        setSetupGuide(res.setupGuide || null);
      } else {
        setClassificationResult(res.classification);
        await fetchWasteData();
      }
    } catch (err: any) {
      setModelError(err.message || 'Vision classification failed.');
    } finally {
      setClassifying(false);
    }
  };

  // Submit manual correction
  const handleCorrectClassification = async (id: string) => {
    try {
      await api.correctWasteClassification(id, manualCorrectionCategory);
      setCorrectingRecordId(null);
      await fetchWasteData();
    } catch (err: any) {
      alert(`Correction failed: ${err.message}`);
    }
  };

  // Send ESP32 ultrasonic reading
  const handleSendEsp32 = async () => {
    try {
      const res = await api.sendEsp32SensorReading({
        bin_id: espBinId,
        distance_cm: espDistance,
        total_depth_cm: 100
      });
      setEspStatusMsg(`ESP32 reading ingested: Distance ${espDistance}cm => Fill ${res.fill_percentage}% (${res.status})`);
      await fetchWasteData();
    } catch (err: any) {
      setEspStatusMsg(`ESP32 ingestion error: ${err.message}`);
    }
  };

  // Task actions
  const handleUpdateTaskStatus = async (taskId: string, nextStatus: string) => {
    try {
      await api.updateCollectionTask(taskId, { status: nextStatus });
      await fetchWasteData();
    } catch (err: any) {
      alert(`Task update error: ${err.message}`);
    }
  };

  const handleVerifyTask = async () => {
    if (!verifyingTaskId) return;
    try {
      await api.updateCollectionTask(verifyingTaskId, {
        status: 'verified_resolved',
        verification_notes: verificationNotes
      });
      setVerifyingTaskId(null);
      await fetchWasteData();
    } catch (err: any) {
      alert(`Task verification error: ${err.message}`);
    }
  };

  // Analytics computations
  const criticalBins = bins.filter(b => b.fill_percentage >= 95);
  const approachingBins = bins.filter(b => b.fill_percentage >= 70 && b.fill_percentage < 95);
  const totalCapacityLiters = bins.reduce((sum, b) => sum + b.capacity_liters, 0);

  const categoryCounts: Record<string, number> = {};
  for (const b of bins) {
    categoryCounts[b.waste_category] = (categoryCounts[b.waste_category] || 0) + 1;
  }
  const categoryData = Object.entries(categoryCounts).map(([cat, count]) => ({
    name: cat.replace(/_/g, ' '),
    value: count
  }));

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#64748b', '#06b6d4', '#a855f7'];

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">EcoSort AI — Waste Management</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 border border-purple-500/30 text-purple-300">
                  Campus Cleanliness Hub
                </span>
                <DataSourceBadge source="sensor" status="valid" />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time ultrasonic bin fill monitoring, prioritized custodial collection dispatch & AI segregation with verified disposal guidelines.
              </p>
            </div>
          </div>
        </div>

        {/* Section Navigation Tabs Dock */}
        <div className="flex flex-wrap gap-1 p-1 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-glass text-xs">
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'bins', label: 'Bin Monitoring', icon: Cpu },
            { id: 'segregation', label: 'AI Segregation', icon: Sparkles },
            { id: 'collection', label: 'Collections', icon: CheckCircle2 },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/40 border border-purple-400/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: OVERVIEW */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Monitored Smart Bins"
              value={bins.length}
              unit="units"
              subtext="Distributed across 6 campus hubs"
              icon={Trash2}
              iconColor="text-cyan-400"
              badgeText="Ultrasonic Active"
              badgeColor="bg-cyan-950/60 text-cyan-300 border-cyan-500/30"
              dataSource="sensor"
            />
            <MetricCard
              title="Critical Overflow Risk"
              value={criticalBins.length}
              unit="bins >= 95%"
              subtext={`${approachingBins.length} approaching (70-94%)`}
              icon={AlertTriangle}
              iconColor="text-rose-400"
              badgeText="Immediate Collection"
              badgeColor="bg-rose-950/60 text-rose-300 border-rose-500/30"
              dataSource="sensor"
            />
            <MetricCard
              title="Active Collection Tasks"
              value={tasks.filter(t => t.status !== 'completed').length}
              unit="dispatched"
              subtext={`${tasks.filter(t => t.status === 'needs_verification').length} pending verification`}
              icon={Clock}
              iconColor="text-amber-400"
              badgeText="Optimized Routes"
              badgeColor="bg-amber-950/60 text-amber-300 border-amber-500/30"
              dataSource="sensor"
            />
            <MetricCard
              title="Monitored Campus Volume"
              value={totalCapacityLiters}
              unit="Liters"
              subtext="Ultrasonic telemetry active"
              icon={Layers}
              iconColor="text-emerald-400"
              badgeText="Capacity Tracked"
              badgeColor="bg-emerald-950/60 text-emerald-300 border-emerald-500/30"
              dataSource="sensor"
            />
          </div>

          {/* Quick Highlight Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 glass-card p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Immediate Attention: High-Fill Bins (&ge; 85%)
                  </h3>
                </div>
                <button
                  onClick={() => setActiveSection('bins')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                >
                  View All Bins <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {bins.filter(b => b.fill_percentage >= 85).map(bin => (
                  <div key={bin.bin_id} className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{bin.bin_id}</span>
                        <StatusBadge type="fill" value={bin.status} />
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-purple-300 font-semibold border border-purple-500/20 capitalize">
                          {bin.waste_category.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleSetFillPreset(bin.bin_id, 10)}
                        className="px-3 py-1 text-xs font-bold bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                        title="Simulate Custodial Empty"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Empty Bin
                      </button>
                    </div>

                    {/* Progress Bar & Capacity */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-slate-400 text-[11px] truncate">{bin.location_name}</span>
                        <span className="font-mono font-black text-white text-sm">
                          {bin.fill_percentage}% <span className="text-[10px] text-slate-500 font-normal">({bin.capacity_liters}L)</span>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden bg-slate-900 border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            bin.fill_percentage >= 95
                              ? 'bg-gradient-to-r from-rose-500 to-red-400 animate-pulse'
                              : 'bg-gradient-to-r from-amber-500 to-rose-400'
                          }`}
                          style={{ width: `${bin.fill_percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 glass-card p-5 shadow-2xl space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      AI Segregation Quick Scanner
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveSection('segregation')}
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
                  >
                    Open Camera
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                  Classify any waste item instantly via OpenRouter Free Vision AI (<code className="text-purple-300 text-[11px]">nvidia/nemotron-3.5-super-vl:free</code>) with certified campus disposal rules.
                </p>

                {/* 1-Click Test Demo Samples directly on Overview */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    One-Click Demo Test Samples:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {sampleImages.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={async () => {
                          await handleSelectSample(s.url);
                          setActiveSection('segregation');
                        }}
                        className="p-1.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-purple-500/60 transition-all text-left group"
                      >
                        <img src={s.url} alt={s.name} className="w-full h-14 object-cover rounded-lg mb-1 group-hover:scale-105 transition-transform" />
                        <span className="text-[10px] font-bold text-slate-200 block truncate">{s.name}</span>
                        <span className="text-[9px] text-purple-400 block truncate">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveSection('segregation')}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/40"
              >
                <Camera className="w-4 h-4" />
                Launch Full Computer Vision Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: BIN MONITORING */}
      {activeSection === 'bins' && (
        <div className="space-y-6">
          <div className="glass-panel p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Live Bin Mesh & Ultrasonic Sensor Telemetry</h3>
                <p className="text-xs text-slate-400">
                  Thresholds: &lt;70% Normal • 70-84% Approaching • 85-94% Collection Recommended • &ge;95% Critical
                </p>
              </div>
            </div>
            <DataSourceBadge source="simulated" status="valid" />
          </div>

          {/* Bins Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {bins.map(bin => {
              const isCritical = bin.fill_percentage >= 95;
              const isWarning = bin.fill_percentage >= 70 && bin.fill_percentage < 95;

              return (
                <div
                  key={bin.bin_id}
                  className={`glass-card p-5 space-y-4 transition-all duration-300 ${
                    isCritical
                      ? 'border-rose-500/50 shadow-lg shadow-rose-950/40 bg-gradient-to-b from-rose-950/20 to-slate-900/80 ring-1 ring-rose-500/30'
                      : isWarning
                      ? 'border-amber-500/50 shadow-lg shadow-amber-950/30 bg-gradient-to-b from-amber-950/10 to-slate-900/80'
                      : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-cyan-400 tracking-wider">{bin.bin_id}</span>
                      <h4 className="text-sm font-bold text-white mt-0.5">{bin.location_name}</h4>
                      <span className="text-[11px] font-mono uppercase text-slate-400">
                        {bin.waste_category.replace(/_/g, ' ')} • {bin.capacity_liters}L
                      </span>
                    </div>
                    <StatusBadge type="fill" value={bin.status} />
                  </div>

                  {/* Visual Fill Gauge */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400 font-medium">Ultrasonic Fill Level</span>
                      <span className={`text-2xl font-black font-mono tracking-tight ${
                        isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {bin.fill_percentage}%
                      </span>
                    </div>

                    <div className="w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden p-0.5 shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCritical
                            ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-red-400 shadow-glow-rose animate-pulse'
                            : isWarning
                            ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                        style={{ width: `${bin.fill_percentage}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Sensor: {bin.distance_cm ?? 15} cm</span>
                      <span>Last sync: {new Date(bin.last_updated).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Demo Simulation Controls */}
                  <div className="pt-3 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-semibold">
                        Simulated Telemetry
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono">
                        Hardware Bypass
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                      <button
                        onClick={() => handleSimulateFill(bin.bin_id, -10)}
                        className="py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 text-center font-bold transition-all"
                      >
                        -10%
                      </button>
                      <button
                        onClick={() => handleSimulateFill(bin.bin_id, 10)}
                        className="py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 text-center font-bold transition-all"
                      >
                        +10%
                      </button>
                      <button
                        onClick={() => handleSetFillPreset(bin.bin_id, 96)}
                        className="py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 text-rose-300 text-center text-[10px] font-bold transition-all shadow-sm"
                      >
                        96% (Crit)
                      </button>
                      <button
                        onClick={() => handleSetFillPreset(bin.bin_id, 5)}
                        className="py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-center text-[10px] font-bold transition-all shadow-sm"
                      >
                        Empty
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ESP32 Hardware Integration Card */}
          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                ESP32 + Ultrasonic Sensor HTTP Interface (Hardware Integration)
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Real microcontrollers (ESP32 / Arduino with HC-SR04 ultrasonic transceiver) stream telemetry to <code className="text-cyan-300 bg-slate-950 px-2 py-0.5 rounded font-mono border border-slate-800">POST /api/waste/sensor-readings</code>. Telemetry calculates fill from distance and clamps physical anomalies.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-8 p-4 bg-slate-950/90 border border-slate-800/80 rounded-xl font-mono text-[11px] text-slate-300 space-y-1 overflow-x-auto shadow-inner">
                <span className="text-slate-500">// Example curl from ESP32 WiFi client:</span>
                <div className="text-cyan-400 font-semibold">
                  curl -X POST http://localhost:3001/api/waste/sensor-readings \
                </div>
                <div className="text-slate-300 pl-4">
                  -H "Content-Type: application/json" \
                </div>
                <div className="text-emerald-400 pl-4">
                  -d '{JSON.stringify({ bin_id: espBinId, distance_cm: espDistance, total_depth_cm: 100 })}'
                </div>
              </div>

              <div className="lg:col-span-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-3 shadow-glass">
                <span className="text-xs font-bold text-white block">Test ESP32 Packet Ingestion:</span>
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Target Bin</label>
                    <select
                      value={espBinId}
                      onChange={e => setEspBinId(e.target.value)}
                      className="w-full mt-1 p-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 font-mono text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    >
                      {bins.map(b => (
                        <option key={b.bin_id} value={b.bin_id}>{b.bin_id} ({b.location_name})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Measured Distance (cm)</label>
                    <input
                      type="number"
                      value={espDistance}
                      onChange={e => setEspDistance(Number(e.target.value))}
                      className="w-full mt-1 p-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 font-mono text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleSendEsp32}
                    className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-bold text-xs transition-all shadow-lg shadow-cyan-950/50"
                  >
                    Transmit Sensor Packet
                  </button>
                  {espStatusMsg && (
                    <div className="text-[10px] text-cyan-300 font-mono bg-cyan-950/60 p-2.5 rounded-lg border border-cyan-500/40">
                      {espStatusMsg}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: AI SEGREGATION */}
      {activeSection === 'segregation' && (
        <div className="space-y-6">
          {/* Custom Model Hero Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Active Edge Model
                  </span>
                  <span className="text-xs font-mono text-purple-300">
                    MobileNetV3 Transfer Learning
                  </span>
                </div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <span>Merged Waste Classification Dataset (MWCD) Vision Classifier</span>
                </h2>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Deep neural network trained locally on Apple Silicon M2 GPU over <strong className="text-white">35,168 specimen images</strong> across 9 distinct campus waste streams with inverse class weighting and real-time inference latency under 20ms.
                </p>
              </div>

              {/* Model Stat Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">Validation Acc</span>
                  <span className="text-sm font-black font-mono text-emerald-400">81.63%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">Macro F1</span>
                  <span className="text-sm font-black font-mono text-cyan-400">0.8172</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">Trained Classes</span>
                  <span className="text-sm font-black font-mono text-purple-400">9 Streams</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">Dataset Images</span>
                  <span className="text-sm font-black font-mono text-amber-400">35,168</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 6 cols: Upload / Sample selection */}
            <div className="lg:col-span-6 glass-card p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Computer Vision Segregation
                  </h3>
                </div>
                <DataSourceBadge source="model" status="valid" />
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700/80 hover:border-purple-500/80 bg-slate-950/70 hover:bg-slate-900/60 rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 space-y-3 group shadow-inner"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 group-hover:bg-purple-500/20 border border-purple-500/30 group-hover:scale-105 text-purple-400 mx-auto flex items-center justify-center transition-all shadow-glow-purple">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-purple-300 transition-colors">
                    Click or Drag Image to Inspect Specimen
                  </span>
                  <span className="text-[11px] text-slate-400">
                    High-res JPEG, PNG, or WebP stream
                  </span>
                </div>
              </div>

              {/* Sample Images Preset from MWCD Dataset */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    MWCD Dataset Specimens (9 Classes):
                  </span>
                  <span className="text-[10px] text-purple-400 font-mono">Instant Test</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {sampleImages.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectSample(s.url)}
                      className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-purple-500/60 hover:shadow-lg hover:shadow-purple-950/30 text-left transition-all group"
                    >
                      <img src={s.url} alt={s.name} className="w-full h-14 object-cover rounded-lg mb-1.5 group-hover:scale-105 transition-transform" />
                      <span className="text-[10px] font-bold text-slate-200 block truncate group-hover:text-purple-300">{s.name}</span>
                      <span className="text-[9px] text-purple-400 block truncate font-medium">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Preview & Classify Button */}
              {selectedImage && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="relative rounded-xl overflow-hidden border border-slate-700/80 max-h-56 flex items-center justify-center bg-black/60 shadow-inner">
                    <img src={selectedImage} alt="Selected waste" className="max-h-56 object-contain" />
                  </div>

                  <button
                    onClick={handleClassifyImage}
                    disabled={classifying}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black tracking-wide uppercase flex items-center justify-center gap-2 shadow-lg shadow-purple-900/50 transition-all disabled:opacity-50"
                  >
                    <Sparkles className={`w-4 h-4 ${classifying ? 'animate-spin' : ''}`} />
                    {classifying ? 'Evaluating Neural Classification...' : 'Classify Specimen via MWCD Model'}
                  </button>
                </div>
              )}
            </div>

            {/* Right 6 cols: AI Results & Campus Disposal Guidelines */}
            <div className="lg:col-span-6 glass-card p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  Classification Findings
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    MWCD MobileNetV3
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">81.6% Acc</span>
                </div>
              </div>

              {/* No classification yet */}
              {!classificationResult && !modelError && (
                <div className="text-center py-16 text-slate-400 text-xs space-y-3 bg-slate-950/40 rounded-2xl border border-dashed border-slate-800/80 p-8">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 text-slate-500 mx-auto flex items-center justify-center border border-slate-800">
                    <Sparkles className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="font-semibold text-slate-300">Select or upload a waste sample to trigger computer vision analysis.</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    The custom trained model classifies into 9 categories: Battery, Cardboard, Glass, Metal, Organic, Paper, Plastic, Textile, Trash.
                  </p>
                </div>
              )}

              {/* Model Error Notice */}
              {modelError && (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Computer Vision Provider Status</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{modelError}</p>
                  {setupGuide && (
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300">
                      {setupGuide}
                    </div>
                  )}
                </div>
              )}

              {/* Live Classification Result */}
              {classificationResult && (
                <div className="space-y-4">
                  <div className="p-5 bg-slate-950/80 border border-slate-800/90 rounded-2xl space-y-3 shadow-glass">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono uppercase text-slate-400 tracking-wider">Predicted Material</span>
                        {classificationResult.binColor && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {classificationResult.binColor}
                          </span>
                        )}
                      </div>
                      {classificationResult.inferenceTimeMs !== undefined && (
                        <span className="text-[10px] font-mono text-cyan-400">
                          {classificationResult.inferenceTimeMs}ms latency
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-white uppercase tracking-wide">
                        {classificationResult.predictedClass || classificationResult.category.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-mono font-black text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        {(classificationResult.confidence * 100).toFixed(1)}% Confidence
                      </span>
                    </div>

                    {/* Confidence Meter */}
                    <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-500 rounded-full transition-all duration-700"
                        style={{ width: `${classificationResult.confidence * 100}%` }}
                      />
                    </div>

                    {classificationResult.itemDescription && (
                      <p className="text-xs text-slate-200 font-medium italic pt-1">
                        "{classificationResult.itemDescription}"
                      </p>
                    )}
                  </div>

                  {/* 9-Class Probabilities Distribution */}
                  {classificationResult.classProbabilities && (
                    <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                          Model Probability Distribution (9 Classes)
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">Softmax Logits</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {Object.entries(classificationResult.classProbabilities as Record<string, number>).map(([cls, prob]) => {
                          const isTop = (classificationResult.predictedClass || classificationResult.category) === cls;
                          return (
                            <div key={cls} className={`p-1.5 rounded-lg border text-left ${isTop ? 'bg-purple-950/40 border-purple-500/60' : 'bg-slate-900/60 border-slate-800'}`}>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className={`capitalize font-semibold ${isTop ? 'text-purple-300 font-bold' : 'text-slate-400'}`}>{cls}</span>
                                <span className="font-mono text-slate-200">{(prob * 100).toFixed(1)}%</span>
                              </div>
                              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                                <div
                                  className={`h-full rounded-full ${isTop ? 'bg-purple-400' : 'bg-slate-600'}`}
                                  style={{ width: `${prob * 100}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Campus Disposal Guideline */}
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-2">
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      University Campus Disposal Instruction
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                      {classificationResult.campusDisposalGuideline}
                    </p>
                  </div>

                  {/* Low confidence review flag */}
                  {classificationResult.reviewRequired && (
                    <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs text-amber-300 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Low Confidence Threshold Flagged (&lt;65%)</span>
                      </div>
                      <p className="text-[11px] text-amber-200/90">
                        Manual review recommended to prevent recycling contamination.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Classification History Table */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Audited Classification History ({history.length})
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">Immutable Log</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {history.map(item => (
                    <div key={item.id} className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs flex items-center justify-between hover:border-slate-700 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white uppercase">{item.predicted_category.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] font-mono text-cyan-400 font-semibold">({(item.confidence * 100).toFixed(0)}%)</span>
                          {item.manual_corrected_category && (
                            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/30">
                              Corrected: {item.manual_corrected_category}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>

                      {/* Manual correction button */}
                      <div>
                        {correctingRecordId === item.id ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={manualCorrectionCategory}
                              onChange={e => setManualCorrectionCategory(e.target.value)}
                              className="text-[11px] bg-slate-900 border border-slate-700 rounded-lg text-slate-200 p-1 font-medium"
                            >
                              <option value="organic">Organic</option>
                              <option value="plastic">Plastic</option>
                              <option value="paper_cardboard">Paper</option>
                              <option value="metal">Metal</option>
                              <option value="glass">Glass</option>
                              <option value="other_uncertain">Other</option>
                            </select>
                            <button
                              onClick={() => handleCorrectClassification(item.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setCorrectingRecordId(item.id)}
                            className="text-[11px] text-slate-400 hover:text-cyan-300 font-semibold px-2 py-0.5 rounded hover:bg-slate-800/60 transition-colors"
                          >
                            Correct
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* SECTION 4: COLLECTION MANAGEMENT */}
      {activeSection === 'collection' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Transparent Priority Collection Queue
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Prioritized by Fill %, Zone Risk & Inactivity
              </span>
            </div>

            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No active collection tasks dispatched.
                </div>
              ) : (
                tasks.map(task => (
                  <div
                    key={task.task_id}
                    className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-3 shadow-glass"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <StatusBadge type="severity" value={task.priority} />
                        <span className="font-mono text-xs font-bold text-white">{task.bin_id}</span>
                        <span className="text-xs text-slate-400">• {task.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400">Priority Score:</span>
                        <span className="text-sm font-black font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                          {task.priority_score} pts
                        </span>
                        <StatusBadge type="status" value={task.status} />
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
                      <span className="text-slate-500 text-[10px] block font-mono uppercase font-bold">
                        Algorithmic Dispatch Rationale:
                      </span>
                      {task.reason}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
                      <span className="text-slate-400 text-[11px]">
                        Assigned Custodian: <span className="text-slate-200 font-bold">{task.assigned_to}</span>
                      </span>

                      {/* Task Status Progression */}
                      <div className="flex items-center gap-2">
                        {task.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateTaskStatus(task.task_id, 'in_progress')}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold shadow-md shadow-cyan-950/40 transition-all"
                          >
                            Dispatch Custodial Team
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <button
                            onClick={() => handleUpdateTaskStatus(task.task_id, 'completed')}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-purple-950/40 transition-all"
                          >
                            Mark Completed (Requires Verification)
                          </button>
                        )}
                        {task.status === 'needs_verification' && (
                          <button
                            onClick={() => setVerifyingTaskId(task.task_id)}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Verify Physical Cleanout
                          </button>
                        )}
                        {task.status === 'completed' && (
                          <span className="text-emerald-400 text-xs font-mono font-bold flex items-center gap-1 bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verified Resolved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: ANALYTICS */}
      {activeSection === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <ChartCard
                title="Smart Bin Fill Level Distribution Across Campus"
                subtitle="Monitored in real-time via ultrasonic sensors. Measured data only."
                dataSource="simulated"
              >
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={bins.map(b => ({
                        name: b.bin_id.replace('BIN_', '').slice(0, 10),
                        fill: b.fill_percentage
                      }))}
                      margin={{ top: 10, right: 20, left: -10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e294b" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={11} unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#334155', borderRadius: '12px' }} />
                      <Bar dataKey="fill" name="Fill Level (%)" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            <div className="lg:col-span-4">
              <ChartCard
                title="Waste Stream Categories"
                subtitle="Classification by segregated stream"
                dataSource="simulated"
              >
                <div className="h-64 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        fontSize={10}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#334155', borderRadius: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          </div>
        </div>
      )}

      {/* Task Verification Modal */}
      {verifyingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel w-full max-w-md p-6 shadow-2xl space-y-4 border border-slate-700">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Verify Collection Cleanout
            </h3>
            <p className="text-xs text-slate-300">
              In accordance with campus hygiene protocols, a task only transitions to verified complete with a documented inspection note confirming physical emptying of the bin.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Inspection Note
              </label>
              <textarea
                rows={3}
                value={verificationNotes}
                onChange={e => setVerificationNotes(e.target.value)}
                placeholder="e.g. Visual confirmation completed, bin emptied and sanitised."
                className="w-full p-3 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setVerifyingTaskId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyTask}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all"
              >
                Confirm Verified Cleanout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
