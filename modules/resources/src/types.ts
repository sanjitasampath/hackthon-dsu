export type RoomType = 'lecture_hall' | 'classroom' | 'computer_lab' | 'seminar';

export interface Room {
  room_id: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  room_type: RoomType;
  has_projector: boolean;
  has_computers: boolean;
  base_hvac_kw: number;
  lighting_kw: number;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
export type ScheduleStatus = 'scheduled' | 'in_session' | 'completed' | 'reallocated';
export type UtilizationStatus = 'optimal' | 'moderate' | 'severely_underutilized' | 'overcrowded';

export interface RoomSchedule {
  id: string;
  room_id: string;
  course_code: string;
  course_title: string;
  day_of_week: DayOfWeek;
  start_time: string; // 'HH:mm'
  end_time: string;   // 'HH:mm'
  duration_hours: number;
  enrolled_count: number;
  actual_attendance: number;
  hvac_active: boolean;
  lighting_active: boolean;
  status: ScheduleStatus;
  data_provenance: 'sensor' | 'simulated' | 'manual';
}

export interface SpaceUtilization {
  room_id: string;
  room_name: string;
  capacity: number;
  actual_attendance: number;
  utilization_rate: number; // 0 - 100%
  seat_wastage: number;     // capacity - attendance
  status: UtilizationStatus;
  wasted_power_kw: number;
}

export interface ConsolidationRecommendation {
  id: string;
  recommendation_type: 'reallocate_room' | 'merge_sections' | 'wing_shutdown';
  priority: 'high' | 'medium' | 'low';
  source_schedule_id: string;
  source_room_id: string;
  target_room_id: string;
  title: string;
  description: string;
  current_capacity: number;
  target_capacity: number;
  attendees: number;
  estimated_energy_saved_kwh: number;
  estimated_cost_saved_usd: number;
  estimated_co2_kg_saved: number;
  status: 'pending' | 'applied' | 'rejected';
}

export interface UnusedTimeBlock {
  room_id: string;
  room_name: string;
  building: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  duration_hours: number;
  idle_power_kw: number;
  savings_potential_kwh: number;
}

export interface ResourceSummaryStats {
  totalRooms: number;
  totalCapacity: number;
  averageUtilizationRate: number;
  totalWastedSeatHours: number;
  potentialDailyEnergySavedKwh: number;
  potentialCostSavedUsd: number;
  activeRecommendationsCount: number;
  unusedTimeBlocksCount: number;
}
