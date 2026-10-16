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
      const [binsRes, tasksRes, histRes] = await Promise.all([
        api.getWasteBins(),
        api.getCollectionTasks(),
        api.getWasteHistory()
      ]);
      setBins(binsRes.bins);
      setTasks(tasksRes.tasks);
      setHistory(histRes.history);
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

  // Sample Images for Hackathon Demos
  const sampleImages = [
    { name: 'Plastic Bottle', url: 'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?w=400', label: 'Single-Use Bottle' },
    { name: 'Food/Banana Peel', url: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=400', label: 'Organic Peel' },
    { name: 'Cardboard Box', url: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=400', label: 'Shipping Box' },
    { name: 'Soda Can', url: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400', label: 'Aluminum Can' }
  ];

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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">EcoSort AI — Waste Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/70 border border-emerald-500/40 text-emerald-300">
              Campus Cleanliness Hub
            </span>
            <DataSourceBadge source="simulated" status="valid" />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time ultrasonic bin fill monitoring, prioritized custodial collection dispatch & AI segregation with verified disposal guidelines.
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex flex-wrap gap-1 bg-navy-950 p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'bins', label: 'Bin Monitoring' },
            { id: 'segregation', label: 'AI Segregation' },
            { id: 'collection', label: 'Collections' },
            { id: 'analytics', label: 'Analytics' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                activeSection === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
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
              dataSource="simulated"
            />
            <MetricCard
              title="Critical Overflow Risk"
              value={criticalBins.length}
              unit="bins >= 95%"
              subtext={`${approachingBins.length} approaching (70-94%)`}
              icon={AlertTriangle}
              iconColor="text-rose-400"
              dataSource="simulated"
            />
            <MetricCard
              title="Active Collection Tasks"
              value={tasks.filter(t => t.status !== 'completed').length}
              unit="dispatched"
              subtext={`${tasks.filter(t => t.status === 'needs_verification').length} pending verification`}
              icon={Clock}
              iconColor="text-amber-400"
              dataSource="simulated"
            />
            <MetricCard
              title="Monitored Campus Volume"
              value={totalCapacityLiters}
              unit="Liters"
              subtext="Ultrasonic telemetry active"
              icon={Layers}
              iconColor="text-emerald-400"
              dataSource="simulated"
            />
          </div>

          {/* Quick Highlight Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-navy-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
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
                  <div key={bin.bin_id} className="p-3.5 bg-navy-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{bin.bin_id}</span>
                        <StatusBadge type="fill" value={bin.status} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{bin.location_name}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-xl font-extrabold text-white font-mono">{bin.fill_percentage}%</span>
                        <div className="text-[10px] text-slate-500 font-mono">{bin.capacity_liters}L capacity</div>
                      </div>
                      <button
                        onClick={() => handleSetFillPreset(bin.bin_id, 10)}
                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-950 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 rounded"
                        title="Simulate Custodial Empty"
                      >
                        Empty Bin
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 bg-navy-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    AI Segregation Quick Link
                  </h3>
                </div>
                <button
                  onClick={() => setActiveSection('segregation')}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
                >
                  Open Camera
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-navy-950 p-3 rounded-lg border border-slate-800">
                Upload or capture an image of any waste item to classify it via Google Gemini Vision into Organic, Plastic, Paper, Metal, or Glass with certified campus disposal rules.
              </p>

              <button
                onClick={() => setActiveSection('segregation')}
                className="w-full py-2.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                <Camera className="w-4 h-4" />
                Launch EcoSort AI Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: BIN MONITORING */}
      {activeSection === 'bins' && (
        <div className="space-y-6">
          <div className="bg-navy-950 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Live Bin Mesh & Ultrasonic Sensor Telemetry</h3>
                <p className="text-xs text-slate-400">
                  Thresholds: &lt;70% Normal • 70-84% Approaching • 85-94% Collection Recommended • &gt;=95% Critical
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
                  className={`bg-navy-900 border rounded-2xl p-5 shadow-xl transition-all ${
                    isCritical
                      ? 'border-rose-500/50 bg-navy-900/90 shadow-rose-950/30'
                      : isWarning
                      ? 'border-amber-500/50'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-cyan-400">{bin.bin_id}</span>
                      <h4 className="text-sm font-bold text-white mt-0.5">{bin.location_name}</h4>
                      <span className="text-[11px] font-mono uppercase text-slate-400">
                        {bin.waste_category.replace(/_/g, ' ')} • {bin.capacity_liters}L
                      </span>
                    </div>
                    <StatusBadge type="fill" value={bin.status} />
                  </div>

                  {/* Visual Fill Gauge */}
                  <div className="mt-5 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400 font-medium">Fill Capacity</span>
                      <span className="text-2xl font-extrabold font-mono text-white tracking-tight">
                        {bin.fill_percentage}%
                      </span>
                    </div>

                    <div className="w-full h-3 bg-navy-950 rounded-full border border-slate-800 overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCritical
                            ? 'bg-rose-500 shadow-sm shadow-rose-500'
                            : isWarning
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
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
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                        Demo Controls (SIMULATED)
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                      <button
                        onClick={() => handleSimulateFill(bin.bin_id, -10)}
                        className="p-1 rounded bg-navy-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-center"
                      >
                        -10%
                      </button>
                      <button
                        onClick={() => handleSimulateFill(bin.bin_id, 10)}
                        className="p-1 rounded bg-navy-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-center"
                      >
                        +10%
                      </button>
                      <button
                        onClick={() => handleSetFillPreset(bin.bin_id, 96)}
                        className="p-1 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-center text-[10px]"
                      >
                        96% (Crit)
                      </button>
                      <button
                        onClick={() => handleSetFillPreset(bin.bin_id, 5)}
                        className="p-1 rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-center text-[10px]"
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
          <div className="bg-navy-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                ESP32 + Ultrasonic Sensor HTTP Interface (Hardware Integration)
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Real microcontrollers (ESP32 / Arduino with HC-SR04 ultrasonic transceiver) stream telemetry to <code className="text-cyan-300 bg-navy-950 px-1.5 py-0.5 rounded font-mono">POST /api/waste/sensor-readings</code>. Telemetry calculates fill from distance and clamps physical anomalies.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div className="lg:col-span-8 p-3 bg-navy-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 space-y-1 overflow-x-auto">
                <span className="text-slate-500">// Example curl from ESP32 WiFi client:</span>
                <div className="text-cyan-400">
                  curl -X POST http://localhost:3001/api/waste/sensor-readings \
                </div>
                <div className="text-slate-300 pl-4">
                  -H "Content-Type: application/json" \
                </div>
                <div className="text-emerald-400 pl-4">
                  -d '{JSON.stringify({ bin_id: espBinId, distance_cm: espDistance, total_depth_cm: 100 })}'
                </div>
              </div>

              <div className="lg:col-span-4 bg-navy-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white block">Test ESP32 Packet Ingestion:</span>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase">Target Bin</label>
                    <select
                      value={espBinId}
                      onChange={e => setEspBinId(e.target.value)}
                      className="w-full p-1.5 bg-navy-900 border border-slate-700 rounded text-slate-200 font-mono text-xs"
                    >
                      {bins.map(b => (
                        <option key={b.bin_id} value={b.bin_id}>{b.bin_id} ({b.location_name})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase">Measured Distance (cm)</label>
                    <input
                      type="number"
                      value={espDistance}
                      onChange={e => setEspDistance(Number(e.target.value))}
                      className="w-full p-1.5 bg-navy-900 border border-slate-700 rounded text-slate-200 font-mono text-xs"
                    />
                  </div>
                  <button
                    onClick={handleSendEsp32}
                    className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-semibold text-xs transition-all shadow"
                  >
                    Transmit Sensor Packet
                  </button>
                  {espStatusMsg && (
                    <div className="text-[10px] text-cyan-300 font-mono bg-cyan-950/50 p-2 rounded border border-cyan-500/30">
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 6 cols: Upload / Sample selection */}
            <div className="lg:col-span-6 bg-navy-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5">
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
                className="border-2 border-dashed border-slate-700 hover:border-purple-500/60 bg-navy-950/70 rounded-xl p-6 text-center cursor-pointer transition-all space-y-3"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-purple-950/60 border border-purple-500/40 text-purple-400 mx-auto flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-white block">Click or Drop Image to Inspect</span>
                  <span className="text-[11px] text-slate-400">JPEG, PNG, WebP supported</span>
                </div>
              </div>

              {/* Sample Images Preset for Instant Hackathon Testing */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Or Test with Demo Campus Waste Sample:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {sampleImages.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedImage(s.url);
                        setClassificationResult(null);
                        setModelError(null);
                      }}
                      className="p-2 rounded-lg bg-navy-950 border border-slate-800 hover:border-purple-500/50 text-left transition-all"
                    >
                      <img src={s.url} alt={s.name} className="w-full h-16 object-cover rounded mb-1.5" />
                      <span className="text-[11px] font-semibold text-slate-300 block truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Preview & Classify Button */}
              {selectedImage && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="relative rounded-xl overflow-hidden border border-slate-700 max-h-56 flex items-center justify-center bg-black">
                    <img src={selectedImage} alt="Selected waste" className="max-h-56 object-contain" />
                  </div>

                  <button
                    onClick={handleClassifyImage}
                    disabled={classifying}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 transition-all disabled:opacity-50"
                  >
                    <Sparkles className={`w-4 h-4 ${classifying ? 'animate-spin' : ''}`} />
                    {classifying ? 'Analyzing via Computer Vision...' : 'Classify Waste Item'}
                  </button>
                </div>
              )}
            </div>

            {/* Right 6 cols: AI Results & Campus Disposal Guidelines */}
            <div className="lg:col-span-6 bg-navy-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  Classification Findings
                </h3>
              </div>

              {/* No classification yet */}
              {!classificationResult && !modelError && (
                <div className="text-center py-16 text-slate-500 text-xs space-y-2">
                  <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
                  <p>Select or upload a waste sample to view real computer vision segregation.</p>
                  <p className="text-[11px] text-slate-600">Strict rule: One item classified does not verify an entire bin.</p>
                </div>
              )}

              {/* Model Not Configured / Setup Notice */}
              {modelError && (
                <div className="p-4 rounded-xl bg-navy-950 border border-amber-500/40 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Computer Vision Provider Status</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{modelError}</p>
                  {setupGuide && (
                    <div className="p-3 rounded-lg bg-navy-900 border border-slate-800 text-[11px] font-mono text-cyan-300">
                      {setupGuide}
                    </div>
                  )}
                </div>
              )}

              {/* Live Classification Result */}
              {classificationResult && (
                <div className="space-y-4">
                  <div className="p-4 bg-navy-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase text-slate-400">Identified Category</span>
                      <StatusBadge type="severity" value="healthy" />
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-white uppercase tracking-wide">
                        {classificationResult.category.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm font-mono font-bold text-cyan-400">
                        {(classificationResult.confidence * 100).toFixed(1)}% Confidence
                      </span>
                    </div>

                    {/* Confidence Meter */}
                    <div className="w-full h-2 bg-navy-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full"
                        style={{ width: `${classificationResult.confidence * 100}%` }}
                      />
                    </div>

                    {classificationResult.itemDescription && (
                      <p className="text-xs text-slate-300 font-medium">
                        "{classificationResult.itemDescription}"
                      </p>
                    )}
                  </div>

                  {/* Campus Disposal Guideline */}
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-2">
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Audited Classification History ({history.length})
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {history.map(item => (
                    <div key={item.id} className="p-2.5 bg-navy-950 rounded-lg border border-slate-800 text-xs flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white uppercase">{item.predicted_category.replace(/_/g, ' ')}</span>
                          <span className="text-[10px] font-mono text-cyan-400">({(item.confidence * 100).toFixed(0)}%)</span>
                          {item.manual_corrected_category && (
                            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/30">
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
                              className="text-[11px] bg-navy-900 border border-slate-700 rounded text-slate-200 p-1"
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
                              className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setCorrectingRecordId(item.id)}
                            className="text-[11px] text-slate-400 hover:text-cyan-300 font-medium"
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
          <div className="bg-navy-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
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
                    className="p-4 bg-navy-950 rounded-xl border border-slate-800 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <StatusBadge type="severity" value={task.priority} />
                        <span className="font-mono text-xs font-bold text-white">{task.bin_id}</span>
                        <span className="text-xs text-slate-400">• {task.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400">Priority Score:</span>
                        <span className="text-sm font-bold font-mono text-cyan-400">{task.priority_score} pts</span>
                        <StatusBadge type="status" value={task.status} />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-navy-900 border border-slate-800 text-xs text-slate-300">
                      <span className="text-slate-500 text-[10px] block font-mono uppercase">Transparent Algorithm Reason:</span>
                      {task.reason}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
                      <span className="text-slate-400 text-[11px]">
                        Assigned To: <span className="text-slate-200 font-semibold">{task.assigned_to}</span>
                      </span>

                      {/* Task Status Progression */}
                      <div className="flex items-center gap-2">
                        {task.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateTaskStatus(task.task_id, 'in_progress')}
                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
                          >
                            Dispatch Custodial Team
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <button
                            onClick={() => handleUpdateTaskStatus(task.task_id, 'completed')}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold"
                          >
                            Mark Completed (Requires Verification)
                          </button>
                        )}
                        {task.status === 'needs_verification' && (
                          <button
                            onClick={() => setVerifyingTaskId(task.task_id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Verify Physical Cleanout
                          </button>
                        )}
                        {task.status === 'completed' && (
                          <span className="text-emerald-400 text-xs font-mono font-semibold flex items-center gap-1">
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
                      <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#334155' }} />
                      <Bar dataKey="fill" name="Fill Level (%)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
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
                      <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#334155' }} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-navy-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Verify Collection Cleanout
            </h3>
            <p className="text-xs text-slate-300">
              In accordance with GLOBAL RULES, a task only transitions to verified complete with a documented inspection note confirming physical emptying of the bin.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                Inspection Note
              </label>
              <textarea
                rows={3}
                value={verificationNotes}
                onChange={e => setVerificationNotes(e.target.value)}
                className="w-full p-2.5 bg-navy-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setVerifyingTaskId(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyTask}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shadow"
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
