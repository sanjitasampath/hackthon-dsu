// apps/web/src/api/client.ts
import { CampusEvent, CampusIncident, CampusLocation, SustainabilityReport } from '@ecosphere/shared';
import { EnergyAuditRecord } from '@ecosphere/energy';
import { SmartBin, CollectionTask, ClassificationRecord } from '@ecosphere/waste';
import { WaterMeter, WaterTank, WaterThresholdConfig, WaterDecisionOutput } from '@ecosphere/water';
import { Room, RoomSchedule, SpaceUtilization, ConsolidationRecommendation, UnusedTimeBlock, ResourceSummaryStats } from '@ecosphere/resources';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data;
}

export const api = {
  // Locations
  getLocations: () => request<{ success: boolean; locations: CampusLocation[] }>('/api/locations'),

  // Events
  getEvents: (params?: { module?: string; location_id?: string; severity?: string; data_status?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.module) search.set('module', params.module);
    if (params?.location_id) search.set('location_id', params.location_id);
    if (params?.severity) search.set('severity', params.severity);
    if (params?.data_status) search.set('data_status', params.data_status);
    if (params?.limit) search.set('limit', String(params.limit));
    return request<{ success: boolean; events: CampusEvent[] }>(`/api/events?${search.toString()}`);
  },

  postEvent: (event: Partial<CampusEvent>) => request<{ success: boolean; event: CampusEvent; incident: CampusIncident }>('/api/events', {
    method: 'POST',
    body: JSON.stringify(event)
  }),

  // Incidents
  getIncidents: (params?: { status?: string; module?: string; severity?: string; location_id?: string }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.module) search.set('module', params.module);
    if (params?.severity) search.set('severity', params.severity);
    if (params?.location_id) search.set('location_id', params.location_id);
    return request<{ success: boolean; incidents: CampusIncident[] }>(`/api/incidents?${search.toString()}`);
  },

  updateIncidentStatus: (id: string, status: string) => request<{ success: boolean; incident: CampusIncident }>(`/api/incidents/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),

  verifyIncident: (id: string, payload: { verifiedBy: string; notes: string; freshReading?: any }) =>
    request<{ success: boolean; incident: CampusIncident }>(`/api/incidents/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // Reports
  getDailyReport: () => request<{ success: boolean; report: SustainabilityReport }>('/api/reports/daily'),
  getWeeklyReport: () => request<{ success: boolean; report: SustainabilityReport }>('/api/reports/weekly'),
  generateReport: (reportType: 'daily' | 'weekly') => request<{ success: boolean; report: SustainabilityReport }>('/api/reports/generate', {
    method: 'POST',
    body: JSON.stringify({ reportType })
  }),

  // Energy
  getEnergyZones: () => request<{ success: boolean; zones: any[] }>('/api/energy/zones'),
  simulateEnergy: (locationId: string, stateUpdate: Record<string, any>) =>
    request<{ success: boolean; zone: any; auditRecord: EnergyAuditRecord; incident?: CampusIncident }>('/api/energy/simulate', {
      method: 'POST',
      body: JSON.stringify({ locationId, stateUpdate })
    }),
  getEnergyRecords: (location_id?: string) => {
    const q = location_id ? `?location_id=${location_id}` : '';
    return request<{ success: boolean; records: EnergyAuditRecord[] }>(`/api/energy/records${q}`);
  },

  // Waste
  getWasteBins: () => request<{ success: boolean; bins: SmartBin[] }>('/api/waste/bins'),
  simulateWasteBin: (bin_id: string, fill_percentage: number, data_status: string = 'valid') =>
    request<{ success: boolean; bin: SmartBin; incident?: CampusIncident }>('/api/waste/simulate', {
      method: 'POST',
      body: JSON.stringify({ bin_id, fill_percentage, data_status })
    }),
  sendEsp32SensorReading: (payload: { bin_id: string; distance_cm: number; total_depth_cm?: number }) =>
    request<{ success: boolean; fill_percentage: number; status: string; data_status: string }>('/api/waste/sensor-readings', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  classifyWasteImage: (imageBase64: string, mimeType?: string) =>
    request<{ success: boolean; modelAvailable: boolean; classification?: any; error?: string; setupGuide?: string }>('/api/waste/classify', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, mimeType })
    }),
  getWasteHistory: () => request<{ success: boolean; history: ClassificationRecord[] }>('/api/waste/history'),
  getWasteModelInfo: () => request<{
    success: boolean;
    isTrained: boolean;
    config: any;
    metrics: any;
    dataset: any;
  }>('/api/waste/model-info'),
  correctWasteClassification: (id: string, correctedCategory: string) =>
    request<{ success: boolean }>((`/api/waste/history/${id}/correct`), {
      method: 'PATCH',
      body: JSON.stringify({ correctedCategory })
    }),
  getCollectionTasks: () => request<{ success: boolean; tasks: CollectionTask[] }>('/api/waste/collection-tasks'),
  createCollectionTask: (bin_id: string, assigned_to?: string) =>
    request<{ success: boolean; task: CollectionTask }>('/api/waste/collection-tasks', {
      method: 'POST',
      body: JSON.stringify({ bin_id, assigned_to })
    }),
  updateCollectionTask: (id: string, payload: { status?: string; assigned_to?: string; verification_notes?: string }) =>
    request<{ success: boolean; task: CollectionTask }>(`/api/waste/collection-tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  // Water
  getWaterMeters: () => request<{ success: boolean; meters: (WaterMeter & { decision: WaterDecisionOutput })[] }>('/api/water/meters'),
  getWaterTanks: () => request<{ success: boolean; tanks: (WaterTank & { evaluation: any })[] }>('/api/water/tanks'),
  getWaterThresholds: () => request<{ success: boolean; thresholds: WaterThresholdConfig }>('/api/water/thresholds'),
  updateWaterThresholds: (thresholds: Partial<WaterThresholdConfig>) =>
    request<{ success: boolean; thresholds: WaterThresholdConfig }>('/api/water/thresholds', {
      method: 'PUT',
      body: JSON.stringify(thresholds)
    }),
  getWaterReadings: (meter_id?: string, limit: number = 50) => {
    const q = meter_id ? `?meter_id=${meter_id}&limit=${limit}` : `?limit=${limit}`;
    return request<{ success: boolean; readings: any[] }>(`/api/water/readings${q}`);
  },
  simulateWaterMeter: (payload: { meter_id: string; flow_rate_lpm?: number; pressure_psi?: number; leak_acoustic_db?: number; data_status?: string }) =>
    request<{ success: boolean; meter: any; decision: WaterDecisionOutput; incident?: CampusIncident }>('/api/water/simulate', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  simulateWaterTank: (payload: { tank_id: string; fill_percentage: number; inflow_rate_lpm?: number; outflow_rate_lpm?: number }) =>
    request<{ success: boolean; tank: any }>('/api/water/simulate-tank', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getWaterAnalytics: () => request<{ success: boolean; analytics: any }>('/api/water/analytics'),

  // Resources & Space Optimization
  getResourceRooms: () => request<{ success: boolean; rooms: (Room & { utilization?: SpaceUtilization })[] }>('/api/resources/rooms'),
  getResourceSchedules: (day_of_week?: string, room_id?: string) => {
    const params = new URLSearchParams();
    if (day_of_week) params.append('day_of_week', day_of_week);
    if (room_id) params.append('room_id', room_id);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ success: boolean; schedules: RoomSchedule[] }>(`/api/resources/schedules${qs}`);
  },
  getResourceRecommendations: () => request<{ success: boolean; recommendations: ConsolidationRecommendation[] }>('/api/resources/recommendations'),
  reallocateResource: (payload: { schedule_id: string; target_room_id: string; recommendation_id?: string }) =>
    request<{ success: boolean; message: string; schedule: RoomSchedule }>('/api/resources/reallocate', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getUnusedTimeBlocks: (day_of_week: string = 'Monday') =>
    request<{ success: boolean; day_of_week: string; unused_blocks: UnusedTimeBlock[] }>(`/api/resources/unused-blocks?day_of_week=${day_of_week}`),
  getResourceSummary: (day_of_week: string = 'Monday') =>
    request<{ success: boolean; stats: ResourceSummaryStats }>(`/api/resources/summary?day_of_week=${day_of_week}`),
  simulateScheduleAttendance: (schedule_id: string, actual_attendance: number) =>
    request<{ success: boolean; schedule: RoomSchedule }>('/api/resources/simulate-schedule', {
      method: 'POST',
      body: JSON.stringify({ schedule_id, actual_attendance })
    }),

  // Demo Reset
  resetDemoData: () => request<{ success: boolean; message: string }>('/api/demo/reset', {
    method: 'POST'
  })
};
