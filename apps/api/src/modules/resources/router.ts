import { Router, Request, Response } from 'express';
import { db } from '../../db.js';
import {
  Room,
  RoomSchedule,
  calculateAllSpaceUtilizations,
  generateResourceOptimizationRecommendations,
  identifyUnusedTimeBlocks,
  summarizeResourceStats,
  DayOfWeek
} from '@ecosphere/resources';

export const resourceRouter = Router();

function mapRoomRow(row: any): Room {
  return {
    room_id: row.room_id,
    name: row.name,
    building: row.building,
    floor: row.floor,
    capacity: row.capacity,
    room_type: row.room_type,
    has_projector: Boolean(row.has_projector),
    has_computers: Boolean(row.has_computers),
    base_hvac_kw: row.base_hvac_kw,
    lighting_kw: row.lighting_kw
  };
}

function mapScheduleRow(row: any): RoomSchedule {
  return {
    id: row.id,
    room_id: row.room_id,
    course_code: row.course_code,
    course_title: row.course_title,
    day_of_week: row.day_of_week,
    start_time: row.start_time,
    end_time: row.end_time,
    duration_hours: row.duration_hours,
    enrolled_count: row.enrolled_count,
    actual_attendance: row.actual_attendance,
    hvac_active: Boolean(row.hvac_active),
    lighting_active: Boolean(row.lighting_active),
    status: row.status,
    data_provenance: row.data_provenance
  };
}

// GET /api/resources/rooms
resourceRouter.get('/rooms', (_req: Request, res: Response) => {
  try {
    const roomRows = db.prepare('SELECT * FROM campus_rooms ORDER BY building, floor, name').all();
    const rooms = roomRows.map(mapRoomRow);
    const scheduleRows = db.prepare('SELECT * FROM room_schedules').all();
    const schedules = scheduleRows.map(mapScheduleRow);

    const utilizations = calculateAllSpaceUtilizations(rooms, schedules);
    const utilMap = new Map(utilizations.map(u => [u.room_id, u]));

    const responseRooms = rooms.map(room => ({
      ...room,
      utilization: utilMap.get(room.room_id)
    }));

    res.json({ success: true, rooms: responseRooms });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/resources/schedules
resourceRouter.get('/schedules', (req: Request, res: Response) => {
  try {
    const { day_of_week, room_id } = req.query;
    let query = 'SELECT * FROM room_schedules WHERE 1=1';
    const params: any[] = [];

    if (day_of_week) {
      query += ' AND day_of_week = ?';
      params.push(day_of_week);
    }
    if (room_id) {
      query += ' AND room_id = ?';
      params.push(room_id);
    }
    query += ' ORDER BY day_of_week, start_time';

    const rows = db.prepare(query).all(...params);
    const schedules = rows.map(mapScheduleRow);

    res.json({ success: true, schedules });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/resources/recommendations
resourceRouter.get('/recommendations', (_req: Request, res: Response) => {
  try {
    const roomRows = db.prepare('SELECT * FROM campus_rooms').all();
    const rooms = roomRows.map(mapRoomRow);
    const scheduleRows = db.prepare('SELECT * FROM room_schedules').all();
    const schedules = scheduleRows.map(mapScheduleRow);

    const recommendations = generateResourceOptimizationRecommendations(rooms, schedules);

    // Sync with database recommendations table
    const upsert = db.prepare(`
      INSERT OR REPLACE INTO resource_recommendations (
        id, recommendation_type, priority, source_schedule_id, source_room_id, target_room_id,
        title, description, current_capacity, target_capacity, attendees,
        estimated_energy_saved_kwh, estimated_cost_saved_usd, estimated_co2_kg_saved, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of recommendations) {
      // Check existing status
      const existing = db.prepare('SELECT status FROM resource_recommendations WHERE id = ?').get(r.id) as { status: string } | undefined;
      const statusToSave = existing ? existing.status : r.status;
      r.status = statusToSave as any;

      upsert.run(
        r.id, r.recommendation_type, r.priority, r.source_schedule_id, r.source_room_id, r.target_room_id,
        r.title, r.description, r.current_capacity, r.target_capacity, r.attendees,
        r.estimated_energy_saved_kwh, r.estimated_cost_saved_usd, r.estimated_co2_kg_saved, r.status
      );
    }

    res.json({ success: true, recommendations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/resources/reallocate
resourceRouter.post('/reallocate', (req: Request, res: Response) => {
  try {
    const { schedule_id, target_room_id, recommendation_id } = req.body;

    if (!schedule_id || !target_room_id) {
      return res.status(400).json({ success: false, error: 'schedule_id and target_room_id are required.' });
    }

    const scheduleRow = db.prepare('SELECT * FROM room_schedules WHERE id = ?').get(schedule_id);
    if (!scheduleRow) {
      return res.status(404).json({ success: false, error: `Schedule ${schedule_id} not found.` });
    }
    const schedule = mapScheduleRow(scheduleRow);

    const targetRoomRow = db.prepare('SELECT * FROM campus_rooms WHERE room_id = ?').get(target_room_id);
    if (!targetRoomRow) {
      return res.status(404).json({ success: false, error: `Target room ${target_room_id} not found.` });
    }
    const targetRoom = mapRoomRow(targetRoomRow);

    const prevRoomId = schedule.room_id;

    // Apply reallocation in DB
    db.prepare(`
      UPDATE room_schedules
      SET room_id = ?, status = 'reallocated'
      WHERE id = ?
    `).run(target_room_id, schedule_id);

    // Mark recommendation as applied if passed
    if (recommendation_id) {
      db.prepare(`
        UPDATE resource_recommendations
        SET status = 'applied'
        WHERE id = ?
      `).run(recommendation_id);
    }

    // Record audit event
    const eventId = `evt_realloc_${Date.now()}`;
    db.prepare(`
      INSERT INTO campus_events (
        event_id, module, location_id, zone_type, asset_id, issue_type, current_value, unit,
        severity, timestamp, data_status, data_source, recommended_action, verification_status, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      'energy',
      target_room_id,
      targetRoom.room_type,
      target_room_id,
      'resource_reallocation_applied',
      schedule.actual_attendance,
      'students',
      'info',
      new Date().toISOString(),
      'valid',
      'manual',
      `Reallocated course ${schedule.course_code} from ${prevRoomId} to ${targetRoom.name} (${targetRoom.room_id})`,
      'verified',
      JSON.stringify({ from_room: prevRoomId, to_room: target_room_id, course: schedule.course_code })
    );

    res.json({
      success: true,
      message: `Successfully reallocated ${schedule.course_code} from ${prevRoomId} to ${targetRoom.name}`,
      schedule: {
        ...schedule,
        room_id: target_room_id,
        status: 'reallocated'
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/resources/unused-blocks
resourceRouter.get('/unused-blocks', (req: Request, res: Response) => {
  try {
    const day = (req.query.day_of_week as DayOfWeek) || 'Monday';
    const roomRows = db.prepare('SELECT * FROM campus_rooms').all();
    const rooms = roomRows.map(mapRoomRow);
    const scheduleRows = db.prepare('SELECT * FROM room_schedules').all();
    const schedules = scheduleRows.map(mapScheduleRow);

    const unusedBlocks = identifyUnusedTimeBlocks(rooms, schedules, day);

    res.json({ success: true, day_of_week: day, unused_blocks: unusedBlocks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/resources/summary
resourceRouter.get('/summary', (req: Request, res: Response) => {
  try {
    const day = (req.query.day_of_week as DayOfWeek) || 'Monday';
    const roomRows = db.prepare('SELECT * FROM campus_rooms').all();
    const rooms = roomRows.map(mapRoomRow);
    const scheduleRows = db.prepare('SELECT * FROM room_schedules').all();
    const schedules = scheduleRows.map(mapScheduleRow);

    const recommendations = generateResourceOptimizationRecommendations(rooms, schedules);
    const unusedBlocks = identifyUnusedTimeBlocks(rooms, schedules, day);
    const stats = summarizeResourceStats(rooms, schedules, recommendations, unusedBlocks);

    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/resources/simulate-schedule
resourceRouter.post('/simulate-schedule', (req: Request, res: Response) => {
  try {
    const { schedule_id, actual_attendance } = req.body;

    if (!schedule_id || actual_attendance === undefined) {
      return res.status(400).json({ success: false, error: 'schedule_id and actual_attendance are required.' });
    }

    db.prepare(`
      UPDATE room_schedules
      SET actual_attendance = ?, data_provenance = 'simulated'
      WHERE id = ?
    `).run(Number(actual_attendance), schedule_id);

    const updatedRow = db.prepare('SELECT * FROM room_schedules WHERE id = ?').get(schedule_id);
    const schedule = mapScheduleRow(updatedRow);

    res.json({ success: true, schedule });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
