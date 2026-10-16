import {
  Room,
  RoomSchedule,
  SpaceUtilization,
  ConsolidationRecommendation,
  UnusedTimeBlock,
  ResourceSummaryStats,
  DayOfWeek
} from './types.js';
import {
  calculateRoomUtilization,
  evaluateUtilizationStatus,
  calculateWastedPower,
  calculateReallocationSavings,
  findUnoccupiedIntervals,
  timeToMinutes
} from './calculations.js';

export function calculateAllSpaceUtilizations(
  rooms: Room[],
  schedules: RoomSchedule[]
): SpaceUtilization[] {
  const roomMap = new Map<string, Room>(rooms.map(r => [r.room_id, r]));

  return rooms.map(room => {
    // Find active or scheduled events for this room
    const roomSchedules = schedules.filter(s => s.room_id === room.room_id);
    const avgAttendance = roomSchedules.length > 0
      ? Math.round(roomSchedules.reduce((acc, s) => acc + s.actual_attendance, 0) / roomSchedules.length)
      : 0;

    const rate = calculateRoomUtilization(room.capacity, avgAttendance);
    const status = evaluateUtilizationStatus(rate);
    const { wastedKw } = calculateWastedPower(room.capacity, avgAttendance, room.base_hvac_kw, room.lighting_kw);

    return {
      room_id: room.room_id,
      room_name: room.name,
      capacity: room.capacity,
      actual_attendance: avgAttendance,
      utilization_rate: rate,
      seat_wastage: Math.max(0, room.capacity - avgAttendance),
      status,
      wasted_power_kw: wastedKw
    };
  });
}

export function generateResourceOptimizationRecommendations(
  rooms: Room[],
  schedules: RoomSchedule[]
): ConsolidationRecommendation[] {
  const recommendations: ConsolidationRecommendation[] = [];
  const roomMap = new Map<string, Room>(rooms.map(r => [r.room_id, r]));

  for (const schedule of schedules) {
    if (schedule.status === 'reallocated' || schedule.status === 'completed') continue;

    const sourceRoom = roomMap.get(schedule.room_id);
    if (!sourceRoom) continue;

    const utilRate = calculateRoomUtilization(sourceRoom.capacity, schedule.actual_attendance);

    // Rule 1: Room Reallocation for Severely Underutilized Large Rooms (< 45% utilization)
    if (utilRate < 45 && schedule.actual_attendance > 0 && sourceRoom.capacity >= 50) {
      // Find candidate rooms that:
      // 1. Have capacity sufficient for attendance + 20% margin
      // 2. Have smaller capacity than source room (at most 65% of source capacity)
      // 3. Are unoccupied during schedule.start_time - schedule.end_time on schedule.day_of_week
      // 4. Have required features
      const schedStartMin = timeToMinutes(schedule.start_time);
      const schedEndMin = timeToMinutes(schedule.end_time);

      const candidateRooms = rooms.filter(candidate => {
        if (candidate.room_id === sourceRoom.room_id) return false;
        if (candidate.capacity < schedule.actual_attendance * 1.15) return false; // Needs room for attendees
        if (candidate.capacity >= sourceRoom.capacity * 0.70) return false;      // Must yield meaningful reduction

        // Check if candidate room is free during that slot
        const conflictingSchedule = schedules.find(other =>
          other.room_id === candidate.room_id &&
          other.day_of_week === schedule.day_of_week &&
          other.status !== 'reallocated' &&
          other.status !== 'completed' &&
          !(schedEndMin <= timeToMinutes(other.start_time) || schedStartMin >= timeToMinutes(other.end_time))
        );

        return !conflictingSchedule;
      });

      // Sort candidate rooms by best fit (closest capacity to needed attendees)
      candidateRooms.sort((a, b) => a.capacity - b.capacity);

      if (candidateRooms.length > 0) {
        const targetRoom = candidateRooms[0];
        const savings = calculateReallocationSavings(
          sourceRoom.base_hvac_kw,
          sourceRoom.lighting_kw,
          targetRoom.base_hvac_kw,
          targetRoom.lighting_kw,
          schedule.duration_hours
        );

        recommendations.push({
          id: `rec_realloc_${schedule.id}`,
          recommendation_type: 'reallocate_room',
          priority: utilRate < 30 ? 'high' : 'medium',
          source_schedule_id: schedule.id,
          source_room_id: sourceRoom.room_id,
          target_room_id: targetRoom.room_id,
          title: `Reallocate ${schedule.course_code} from ${sourceRoom.name} to ${targetRoom.name}`,
          description: `Class attendance is ${schedule.actual_attendance} students in a ${sourceRoom.capacity}-seat hall (${utilRate}% utilized). Transferring to ${targetRoom.name} (${targetRoom.capacity} seats) right-sizes HVAC and saves ${savings.energySavedKwh} kWh per session.`,
          current_capacity: sourceRoom.capacity,
          target_capacity: targetRoom.capacity,
          attendees: schedule.actual_attendance,
          estimated_energy_saved_kwh: savings.energySavedKwh,
          estimated_cost_saved_usd: savings.costSavedUsd,
          estimated_co2_kg_saved: savings.co2KgSaved,
          status: 'pending'
        });
      }
    }
  }

  // Rule 2: Wing / Floor Setback Opportunity
  // If multiple rooms on the same floor/wing are unoccupied after 15:00
  const afternoonHoursSchedules = schedules.filter(s =>
    timeToMinutes(s.start_time) >= timeToMinutes('15:00') &&
    s.status !== 'reallocated'
  );

  const floorOccupancyMap = new Map<string, number>();
  for (const r of rooms) {
    const key = `${r.building}-Floor-${r.floor}`;
    floorOccupancyMap.set(key, 0);
  }

  for (const s of afternoonHoursSchedules) {
    const room = roomMap.get(s.room_id);
    if (room) {
      const key = `${room.building}-Floor-${room.floor}`;
      floorOccupancyMap.set(key, (floorOccupancyMap.get(key) || 0) + 1);
    }
  }

  for (const [floorKey, activeSessions] of floorOccupancyMap.entries()) {
    if (activeSessions === 1) {
      // Single isolated class keeping an entire floor HVAC running late afternoon
      const isolatedSchedule = afternoonHoursSchedules.find(s => {
        const room = roomMap.get(s.room_id);
        return room && `${room.building}-Floor-${room.floor}` === floorKey;
      });

      if (isolatedSchedule) {
        const sourceRoom = roomMap.get(isolatedSchedule.room_id);
        if (sourceRoom && !recommendations.some(r => r.source_schedule_id === isolatedSchedule.id)) {
          // Look for room on floor 1 or central hub with active HVAC
          const centralRoom = rooms.find(r =>
            r.floor === 1 &&
            r.capacity >= isolatedSchedule.actual_attendance * 1.15 &&
            r.room_id !== sourceRoom.room_id
          );

          if (centralRoom) {
            const savings = calculateReallocationSavings(
              sourceRoom.base_hvac_kw + 8.0, // Includes 8 kW floor chiller loop setback
              sourceRoom.lighting_kw,
              centralRoom.base_hvac_kw,
              centralRoom.lighting_kw,
              isolatedSchedule.duration_hours
            );

            recommendations.push({
              id: `rec_wing_setback_${floorKey.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              recommendation_type: 'wing_shutdown',
              priority: 'high',
              source_schedule_id: isolatedSchedule.id,
              source_room_id: sourceRoom.room_id,
              target_room_id: centralRoom.room_id,
              title: `Floor HVAC Setback: Consolidate ${floorKey} to Ground Floor`,
              description: `Only 1 room (${sourceRoom.name}) is scheduled on ${floorKey} after 15:00. Moving this class to ${centralRoom.name} enables total chiller and corridor lighting setback across the entire wing.`,
              current_capacity: sourceRoom.capacity,
              target_capacity: centralRoom.capacity,
              attendees: isolatedSchedule.actual_attendance,
              estimated_energy_saved_kwh: savings.energySavedKwh,
              estimated_cost_saved_usd: savings.costSavedUsd,
              estimated_co2_kg_saved: savings.co2KgSaved,
              status: 'pending'
            });
          }
        }
      }
    }
  }

  return recommendations;
}

export function identifyUnusedTimeBlocks(
  rooms: Room[],
  schedules: RoomSchedule[],
  dayOfWeek: DayOfWeek = 'Monday'
): UnusedTimeBlock[] {
  const unusedBlocks: UnusedTimeBlock[] = [];

  for (const room of rooms) {
    const daySchedules = schedules
      .filter(s => s.room_id === room.room_id && s.day_of_week === dayOfWeek && s.status !== 'reallocated')
      .map(s => ({ start: s.start_time, end: s.end_time }));

    const gaps = findUnoccupiedIntervals(daySchedules, '08:00', '18:00');

    for (const gap of gaps) {
      const idleKw = room.base_hvac_kw * 0.75 + room.lighting_kw; // Standby consumption if not scheduled
      const savingsPotential = Number((idleKw * gap.durationHours).toFixed(2));

      unusedBlocks.push({
        room_id: room.room_id,
        room_name: room.name,
        building: room.building,
        day_of_week: dayOfWeek,
        start_time: gap.start,
        end_time: gap.end,
        duration_hours: gap.durationHours,
        idle_power_kw: idleKw,
        savings_potential_kwh: savingsPotential
      });
    }
  }

  return unusedBlocks;
}

export function summarizeResourceStats(
  rooms: Room[],
  schedules: RoomSchedule[],
  recommendations: ConsolidationRecommendation[],
  unusedBlocks: UnusedTimeBlock[]
): ResourceSummaryStats {
  const totalRooms = rooms.length;
  const totalCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);

  const activeSchedules = schedules.filter(s => s.status !== 'reallocated');
  const totalAttendance = activeSchedules.reduce((acc, s) => acc + s.actual_attendance, 0);
  const totalAllocatedCapacity = activeSchedules.reduce((acc, s) => {
    const r = rooms.find(rm => rm.room_id === s.room_id);
    return acc + (r ? r.capacity : 0);
  }, 0);

  const averageUtilizationRate = totalAllocatedCapacity > 0
    ? Number(((totalAttendance / totalAllocatedCapacity) * 100).toFixed(1))
    : 0;

  const totalWastedSeatHours = activeSchedules.reduce((acc, s) => {
    const r = rooms.find(rm => rm.room_id === s.room_id);
    const capacity = r ? r.capacity : 0;
    const wastedSeats = Math.max(0, capacity - s.actual_attendance);
    return acc + (wastedSeats * s.duration_hours);
  }, 0);

  const potentialDailyEnergySavedKwh = Number(
    recommendations.reduce((acc, r) => acc + r.estimated_energy_saved_kwh, 0).toFixed(2)
  );

  const potentialCostSavedUsd = Number(
    recommendations.reduce((acc, r) => acc + r.estimated_cost_saved_usd, 0).toFixed(2)
  );

  return {
    totalRooms,
    totalCapacity,
    averageUtilizationRate,
    totalWastedSeatHours: Math.round(totalWastedSeatHours),
    potentialDailyEnergySavedKwh,
    potentialCostSavedUsd,
    activeRecommendationsCount: recommendations.filter(r => r.status === 'pending').length,
    unusedTimeBlocksCount: unusedBlocks.length
  };
}
