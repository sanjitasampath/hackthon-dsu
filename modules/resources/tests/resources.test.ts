import { describe, it, expect } from 'vitest';
import {
  calculateRoomUtilization,
  evaluateUtilizationStatus,
  calculateWastedPower,
  calculateReallocationSavings,
  findUnoccupiedIntervals,
  calculateAllSpaceUtilizations,
  generateResourceOptimizationRecommendations,
  identifyUnusedTimeBlocks,
  summarizeResourceStats,
  Room,
  RoomSchedule
} from '../src/index.js';

describe('Resource Optimization Pure Calculations', () => {
  it('calculates room utilization percentage accurately', () => {
    expect(calculateRoomUtilization(100, 75)).toBe(75);
    expect(calculateRoomUtilization(150, 30)).toBe(20);
    expect(calculateRoomUtilization(0, 10)).toBe(0);
    expect(calculateRoomUtilization(50, -5)).toBe(0);
    expect(calculateRoomUtilization(40, 48)).toBe(120);
  });

  it('evaluates utilization status based on established institutional thresholds', () => {
    expect(evaluateUtilizationStatus(85)).toBe('optimal');
    expect(evaluateUtilizationStatus(75)).toBe('optimal');
    expect(evaluateUtilizationStatus(55)).toBe('moderate');
    expect(evaluateUtilizationStatus(40)).toBe('moderate');
    expect(evaluateUtilizationStatus(39)).toBe('severely_underutilized');
    expect(evaluateUtilizationStatus(15)).toBe('severely_underutilized');
    expect(evaluateUtilizationStatus(105)).toBe('overcrowded');
  });

  it('calculates wasted power from unoccupied seats', () => {
    // 100 capacity, 20 attendance, 10 kW HVAC, 2 kW lighting -> 80% wasted
    const { wastedKw, wastedPercent } = calculateWastedPower(100, 20, 10, 2);
    expect(wastedPercent).toBe(80);
    expect(wastedKw).toBe(9.6);
  });

  it('calculates reallocation energy and cost savings', () => {
    // Source: 16 kW + 2 kW = 18 kW
    // Target: 4 kW + 0.5 kW = 4.5 kW
    // Delta: 13.5 kW * 2 hrs = 27 kWh
    // Cost at $0.14 = $3.78
    const savings = calculateReallocationSavings(16, 2, 4, 0.5, 2, 0.14);
    expect(savings.energySavedKwh).toBe(27);
    expect(savings.costSavedUsd).toBe(3.78);
    expect(savings.co2KgSaved).toBe(11.34);
  });

  it('detects unoccupied time gaps during operational hours', () => {
    const schedules = [
      { start: '09:00', end: '11:00' },
      { start: '13:00', end: '15:00' }
    ];
    const gaps = findUnoccupiedIntervals(schedules, '08:00', '18:00');
    expect(gaps).toHaveLength(3);
    // Gap 1: 08:00 - 09:00 (1.0 hr)
    expect(gaps[0]).toEqual({ start: '08:00', end: '09:00', durationHours: 1 });
    // Gap 2: 11:00 - 13:00 (2.0 hrs)
    expect(gaps[1]).toEqual({ start: '11:00', end: '13:00', durationHours: 2 });
    // Gap 3: 15:00 - 18:00 (3.0 hrs)
    expect(gaps[2]).toEqual({ start: '15:00', end: '18:00', durationHours: 3 });
  });
});

describe('Resource Optimization Engine', () => {
  const mockRooms: Room[] = [
    {
      room_id: 'LH-101',
      name: 'Main Lecture Hall 101',
      building: 'Academic Block A',
      floor: 1,
      capacity: 150,
      room_type: 'lecture_hall',
      has_projector: true,
      has_computers: false,
      base_hvac_kw: 16.5,
      lighting_kw: 2.5
    },
    {
      room_id: 'SR-201',
      name: 'Seminar Room 201',
      building: 'Academic Block A',
      floor: 2,
      capacity: 35,
      room_type: 'seminar',
      has_projector: true,
      has_computers: false,
      base_hvac_kw: 3.5,
      lighting_kw: 0.6
    },
    {
      room_id: 'CL-301',
      name: 'Computer Lab 301',
      building: 'Science & Tech Wing',
      floor: 3,
      capacity: 40,
      room_type: 'computer_lab',
      has_projector: true,
      has_computers: true,
      base_hvac_kw: 8.0,
      lighting_kw: 1.2
    }
  ];

  const mockSchedules: RoomSchedule[] = [
    {
      id: 'sched_env101',
      room_id: 'LH-101',
      course_code: 'ENV101',
      course_title: 'Introduction to Sustainability',
      day_of_week: 'Monday',
      start_time: '10:00',
      end_time: '12:00',
      duration_hours: 2,
      enrolled_count: 24,
      actual_attendance: 20, // Only 20 attendees in a 150-seat hall (13.3% utilization!)
      hvac_active: true,
      lighting_active: true,
      status: 'scheduled',
      data_provenance: 'sensor'
    },
    {
      id: 'sched_cs301',
      room_id: 'CL-301',
      course_code: 'CS301',
      course_title: 'Data Structures Lab',
      day_of_week: 'Monday',
      start_time: '10:00',
      end_time: '12:00',
      duration_hours: 2,
      enrolled_count: 36,
      actual_attendance: 34, // 34 in 40 capacity (85% optimal)
      hvac_active: true,
      lighting_active: true,
      status: 'scheduled',
      data_provenance: 'sensor'
    }
  ];

  it('computes space utilization stats across mock campus rooms', () => {
    const utilizations = calculateAllSpaceUtilizations(mockRooms, mockSchedules);
    expect(utilizations).toHaveLength(3);

    const lh = utilizations.find(u => u.room_id === 'LH-101')!;
    expect(lh.utilization_rate).toBe(13.3);
    expect(lh.status).toBe('severely_underutilized');
    expect(lh.seat_wastage).toBe(130);

    const cl = utilizations.find(u => u.room_id === 'CL-301')!;
    expect(cl.utilization_rate).toBe(85);
    expect(cl.status).toBe('optimal');
  });

  it('generates consolidation recommendations for severely underutilized large rooms', () => {
    const recs = generateResourceOptimizationRecommendations(mockRooms, mockSchedules);
    expect(recs.length).toBeGreaterThan(0);

    const lhReallocation = recs.find(r => r.source_room_id === 'LH-101');
    expect(lhReallocation).toBeDefined();
    expect(lhReallocation?.target_room_id).toBe('SR-201');
    expect(lhReallocation?.recommendation_type).toBe('reallocate_room');
    expect(lhReallocation?.estimated_energy_saved_kwh).toBeGreaterThan(20);
    expect(lhReallocation?.estimated_cost_saved_usd).toBeGreaterThan(2);
  });

  it('identifies unused time blocks for HVAC eco setback', () => {
    const unusedBlocks = identifyUnusedTimeBlocks(mockRooms, mockSchedules, 'Monday');
    expect(unusedBlocks.length).toBeGreaterThan(0);

    // LH-101 has class 10:00-12:00, so 08:00-10:00 and 12:00-18:00 should be unused
    const lhBlocks = unusedBlocks.filter(b => b.room_id === 'LH-101');
    expect(lhBlocks).toHaveLength(2);
    expect(lhBlocks[0].start_time).toBe('08:00');
    expect(lhBlocks[0].end_time).toBe('10:00');
    expect(lhBlocks[1].start_time).toBe('12:00');
    expect(lhBlocks[1].end_time).toBe('18:00');
  });

  it('summarizes resource stats accurately', () => {
    const recs = generateResourceOptimizationRecommendations(mockRooms, mockSchedules);
    const unusedBlocks = identifyUnusedTimeBlocks(mockRooms, mockSchedules, 'Monday');
    const stats = summarizeResourceStats(mockRooms, mockSchedules, recs, unusedBlocks);

    expect(stats.totalRooms).toBe(3);
    expect(stats.totalCapacity).toBe(225);
    expect(stats.potentialDailyEnergySavedKwh).toBeGreaterThan(0);
    expect(stats.activeRecommendationsCount).toBeGreaterThan(0);
  });
});
