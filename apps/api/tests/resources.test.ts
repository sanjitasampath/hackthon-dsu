import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase, db } from '../src/db.js';

describe('Resource API Database and Workflow Integration', () => {
  beforeEach(() => {
    initDatabase();
  });

  it('initializes and seeds campus_rooms and room_schedules tables', () => {
    const rooms = db.prepare('SELECT * FROM campus_rooms').all() as any[];
    const schedules = db.prepare('SELECT * FROM room_schedules').all() as any[];

    expect(rooms.length).toBeGreaterThanOrEqual(8);
    expect(schedules.length).toBeGreaterThanOrEqual(10);

    const mainHall = rooms.find(r => r.room_id === 'LH-101');
    expect(mainHall).toBeDefined();
    expect(mainHall.capacity).toBe(160);
    expect(mainHall.base_hvac_kw).toBe(18.0);

    const envClass = schedules.find(s => s.id === 'sched_mon_lh101_09');
    expect(envClass).toBeDefined();
    expect(envClass.course_code).toBe('ENV101');
    expect(envClass.actual_attendance).toBe(22);
  });

  it('supports schedule reallocation and emits an audit event', () => {
    const scheduleId = 'sched_mon_lh101_09';
    const targetRoomId = 'SR-201';

    // Apply reallocation
    db.prepare(`
      UPDATE room_schedules
      SET room_id = ?, status = 'reallocated'
      WHERE id = ?
    `).run(targetRoomId, scheduleId);

    const updated = db.prepare('SELECT * FROM room_schedules WHERE id = ?').get(scheduleId) as any;
    expect(updated.room_id).toBe('SR-201');
    expect(updated.status).toBe('reallocated');

    // Insert audit event
    const eventId = `evt_test_realloc_${Date.now()}`;
    db.prepare(`
      INSERT INTO campus_events (
        event_id, module, location_id, zone_type, asset_id, issue_type, current_value, unit,
        severity, timestamp, data_status, data_source, recommended_action, verification_status, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      'energy',
      'SR-201',
      'seminar',
      'SR-201',
      'resource_reallocation_applied',
      22,
      'students',
      'info',
      new Date().toISOString(),
      'valid',
      'manual',
      'Reallocated course ENV101 to SR-201',
      'verified',
      '{}'
    );

    const event = db.prepare('SELECT * FROM campus_events WHERE event_id = ?').get(eventId) as any;
    expect(event).toBeDefined();
    expect(event.location_id).toBe('SR-201');
  });

  it('updates schedule attendance dynamically during simulation', () => {
    const scheduleId = 'sched_mon_lh201_14';
    db.prepare(`
      UPDATE room_schedules
      SET actual_attendance = 115, data_provenance = 'simulated'
      WHERE id = ?
    `).run(scheduleId);

    const updated = db.prepare('SELECT * FROM room_schedules WHERE id = ?').get(scheduleId) as any;
    expect(updated.actual_attendance).toBe(115);
    expect(updated.data_provenance).toBe('simulated');
  });
});
