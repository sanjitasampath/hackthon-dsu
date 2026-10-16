// apps/api/src/modules/waste/router.ts
import { Router } from 'express';
import {
  evaluateBinStatus,
  calculateUltrasonicFillPercentage,
  calculateTaskPriority,
  getCampusDisposalRule,
  mapBinToCampusEvent,
  SmartBin,
  WasteCategory,
  CollectionTask
} from '@ecosphere/waste';
import { db } from '../../db.js';
import { processEventForIncident } from '../../services/incidentService.js';

export const router = Router();

// GET /api/waste/bins: Retrieve all smart bins with real-time status
router.get('/bins', (req, res) => {
  try {
    const bins = db.prepare('SELECT * FROM smart_bins ORDER BY fill_percentage DESC').all() as SmartBin[];
    res.json({ success: true, bins });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/waste/simulate: Demo controls to raise/lower fill level (labelled DEMO DATA)
router.post('/simulate', (req, res) => {
  try {
    const { bin_id, fill_percentage, data_status = 'valid' } = req.body;
    if (!bin_id || fill_percentage === undefined) {
      return res.status(400).json({ success: false, error: 'bin_id and fill_percentage are required.' });
    }

    const bin = db.prepare('SELECT * FROM smart_bins WHERE bin_id = ?').get(bin_id) as SmartBin | undefined;
    if (!bin) {
      return res.status(404).json({ success: false, error: 'Bin not found' });
    }

    const clampedFill = Math.max(0, Math.min(100, Number(fill_percentage)));
    const status = evaluateBinStatus(clampedFill);
    const now = new Date().toISOString();
    const distance_cm = Number(((1 - clampedFill / 100) * 100).toFixed(1));

    // Update bin
    db.prepare(`
      UPDATE smart_bins
      SET fill_percentage = ?,
          status = ?,
          data_status = ?,
          last_updated = ?,
          distance_cm = ?
      WHERE bin_id = ?
    `).run(clampedFill, status, data_status, now, distance_cm, bin_id);

    const updatedBin = db.prepare('SELECT * FROM smart_bins WHERE bin_id = ?').get(bin_id) as SmartBin;

    // Check if CampusEvent should be generated
    const event = mapBinToCampusEvent(updatedBin);
    let createdIncident = null;

    if (event) {
      db.prepare(`
        INSERT INTO campus_events (
          event_id, module, location_id, zone_type, asset_id, issue_type,
          current_value, unit, severity, timestamp, data_status, data_source,
          recommended_action, verification_status, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.event_id,
        event.module,
        event.location_id,
        event.zone_type,
        event.asset_id,
        event.issue_type,
        event.current_value,
        event.unit,
        event.severity,
        event.timestamp,
        event.data_status,
        'simulated',
        event.recommended_action,
        event.verification_status,
        JSON.stringify(event.details)
      );

      const incidentResult = processEventForIncident(event);
      createdIncident = incidentResult.incident;
    }

    // Auto-create or recommend task if fill >= 85 and no active task exists
    if (updatedBin.fill_percentage >= 85) {
      const activeTasks = db.prepare(`
        SELECT * FROM collection_tasks
        WHERE bin_id = ? AND status IN ('pending', 'assigned', 'in_progress', 'needs_verification')
      `).all(bin_id) as CollectionTask[];

      if (activeTasks.length === 0) {
        const priorityInfo = calculateTaskPriority(updatedBin, 4);
        const taskId = `task_${bin_id}_${Date.now()}`;
        db.prepare(`
          INSERT INTO collection_tasks (
            task_id, bin_id, location, priority, priority_score, reason,
            created_at, assigned_to, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          taskId,
          bin_id,
          updatedBin.location_name,
          priorityInfo.priority,
          priorityInfo.score,
          priorityInfo.reason,
          now,
          'Unassigned (Auto-Generated)',
          'pending'
        );
      }
    }

    res.json({ success: true, bin: updatedBin, incident: createdIncident });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/waste/sensor-readings: Real ESP32 + Ultrasonic sensor HTTP interface
router.post('/sensor-readings', (req, res) => {
  try {
    const {
      bin_id,
      distance_cm,
      total_depth_cm = 100,
      sensor_token,
      timestamp
    } = req.body;

    if (!bin_id || distance_cm === undefined) {
      return res.status(400).json({
        success: false,
        error: 'bin_id and distance_cm are required fields from ESP32 payload.'
      });
    }

    const bin = db.prepare('SELECT * FROM smart_bins WHERE bin_id = ?').get(bin_id) as SmartBin | undefined;
    if (!bin) {
      return res.status(404).json({ success: false, error: `Bin ID ${bin_id} not registered in campus twin database.` });
    }

    const { fillPercentage, isValid, reason } = calculateUltrasonicFillPercentage({
      distanceCm: Number(distance_cm),
      totalDepthCm: Number(total_depth_cm)
    });

    const data_status = isValid ? 'valid' : 'invalid';
    const status = evaluateBinStatus(fillPercentage);
    const now = timestamp || new Date().toISOString();

    db.prepare(`
      UPDATE smart_bins
      SET fill_percentage = ?,
          status = ?,
          data_status = ?,
          last_updated = ?,
          distance_cm = ?
      WHERE bin_id = ?
    `).run(fillPercentage, status, data_status, now, Number(distance_cm), bin_id);

    const updatedBin = db.prepare('SELECT * FROM smart_bins WHERE bin_id = ?').get(bin_id) as SmartBin;

    // Record Event
    const event = mapBinToCampusEvent(updatedBin);
    if (event) {
      event.data_source = 'sensor'; // Label as real sensor
      db.prepare(`
        INSERT INTO campus_events (
          event_id, module, location_id, zone_type, asset_id, issue_type,
          current_value, unit, severity, timestamp, data_status, data_source,
          recommended_action, verification_status, details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.event_id,
        event.module,
        event.location_id,
        event.zone_type,
        event.asset_id,
        event.issue_type,
        event.current_value,
        event.unit,
        event.severity,
        event.timestamp,
        event.data_status,
        event.data_source,
        event.recommended_action,
        event.verification_status,
        JSON.stringify(event.details)
      );

      processEventForIncident(event);
    }

    res.json({
      success: true,
      data_status,
      fill_percentage: fillPercentage,
      status,
      reason
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/waste/classify: Image classification with server-side Gemini Vision or graceful model status
router.post('/classify', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 payload is required for segregation classification.' });
    }

    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey || geminiKey.trim() === '') {
      return res.status(200).json({
        success: false,
        modelAvailable: false,
        error: 'GEMINI_API_KEY is not configured in server environment (.env). In accordance with GLOBAL RULES, predictions are NEVER fabricated, hardcoded, or faked.',
        setupGuide: 'To enable real-time Gemini Vision waste segregation, obtain an API key from Google AI Studio and configure GEMINI_API_KEY in apps/api/.env.'
      });
    }

    // Call real Gemini 1.5 Flash Vision
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

    const prompt = `
Analyze this waste item image for university campus recycling segregation.
Identify the material category strictly as one of:
- organic
- paper_cardboard
- plastic
- metal
- glass
- other_uncertain

Return a strictly valid JSON object matching:
{
  "category": "organic" | "paper_cardboard" | "plastic" | "metal" | "glass" | "other_uncertain",
  "confidence": number between 0.0 and 1.0,
  "description": "short description of the item"
}
`;

    const apiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64
                }
              }
            ]
          }
        ],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!apiRes.ok) {
      throw new Error(`Gemini Vision API error HTTP ${apiRes.status}`);
    }

    const apiJson = await apiRes.json();
    const resultText = apiJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      throw new Error('No classification output from Gemini Vision model.');
    }

    const parsed = JSON.parse(resultText);
    const category: WasteCategory = parsed.category || 'other_uncertain';
    const confidence = Number(parsed.confidence || 0.85);
    const reviewRequired = confidence < 0.65;
    const disposalGuideline = getCampusDisposalRule(category);

    const recordId = `cls_${Date.now()}`;
    const now = new Date().toISOString();

    // Persist classification in history
    db.prepare(`
      INSERT INTO waste_classifications (
        id, timestamp, predicted_category, confidence, review_required,
        model_type, disposal_guideline
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      recordId,
      now,
      category,
      confidence,
      reviewRequired ? 1 : 0,
      'gemini-1.5-flash-vision',
      disposalGuideline
    );

    res.json({
      success: true,
      modelAvailable: true,
      classification: {
        id: recordId,
        category,
        confidence,
        reviewRequired,
        campusDisposalGuideline: disposalGuideline,
        itemDescription: parsed.description,
        modelType: 'gemini_vision',
        modelDetails: 'Gemini 1.5 Flash Vision'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: `Computer vision inference error: ${error.message}`
    });
  }
});

// GET /api/waste/history: Classification history & manual correction records
router.get('/history', (req, res) => {
  try {
    const history = db.prepare('SELECT * FROM waste_classifications ORDER BY timestamp DESC LIMIT 50').all();
    res.json({ success: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/waste/history/:id/correct: Manual correction of model classification
router.patch('/history/:id/correct', (req, res) => {
  try {
    const { id } = req.params;
    const { correctedCategory } = req.body;

    if (!correctedCategory) {
      return res.status(400).json({ success: false, error: 'correctedCategory is required' });
    }

    db.prepare(`
      UPDATE waste_classifications
      SET manual_corrected_category = ?,
          review_required = 0
      WHERE id = ?
    `).run(correctedCategory, id);

    res.json({ success: true, message: 'Classification updated with manual verification.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Collection Tasks Endpoints
router.get('/collection-tasks', (req, res) => {
  try {
    const tasks = db.prepare('SELECT * FROM collection_tasks ORDER BY priority_score DESC, created_at DESC').all();
    res.json({ success: true, tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/collection-tasks', (req, res) => {
  try {
    const { bin_id, assigned_to = 'Unassigned' } = req.body;
    const bin = db.prepare('SELECT * FROM smart_bins WHERE bin_id = ?').get(bin_id) as SmartBin | undefined;
    if (!bin) {
      return res.status(404).json({ success: false, error: 'Bin not found' });
    }

    const priorityInfo = calculateTaskPriority(bin, 2);
    const taskId = `task_${bin_id}_${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO collection_tasks (
        task_id, bin_id, location, priority, priority_score, reason,
        created_at, assigned_to, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      bin_id,
      bin.location_name,
      priorityInfo.priority,
      priorityInfo.score,
      priorityInfo.reason,
      now,
      assigned_to,
      'pending'
    );

    const task = db.prepare('SELECT * FROM collection_tasks WHERE task_id = ?').get(taskId);
    res.json({ success: true, task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/collection-tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigned_to, verification_notes } = req.body;

    const task = db.prepare('SELECT * FROM collection_tasks WHERE task_id = ?').get(id) as CollectionTask | undefined;
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Invariant: "Completed" moves to needs_verification;
    // only a fresh valid reading or documented inspection confirms final resolution!
    let nextStatus = status || task.status;
    let resolvedAt = task.resolved_at;

    if (status === 'completed') {
      nextStatus = 'needs_verification';
    } else if (status === 'verified_resolved') {
      if (!verification_notes || verification_notes.trim().length < 5) {
        return res.status(400).json({
          success: false,
          error: 'Verification requires a documented inspection note confirming physical emptying of the bin.'
        });
      }
      nextStatus = 'completed';
      resolvedAt = new Date().toISOString();

      // Automatically reset bin fill level upon verified completion!
      db.prepare(`
        UPDATE smart_bins
        SET fill_percentage = 5,
            status = 'normal',
            data_status = 'valid',
            last_updated = ?
        WHERE bin_id = ?
      `).run(resolvedAt, task.bin_id);
    }

    db.prepare(`
      UPDATE collection_tasks
      SET status = ?,
          assigned_to = COALESCE(?, assigned_to),
          verification_notes = COALESCE(?, verification_notes),
          resolved_at = ?
      WHERE task_id = ?
    `).run(
      nextStatus,
      assigned_to || null,
      verification_notes || null,
      resolvedAt || null,
      id
    );

    const updated = db.prepare('SELECT * FROM collection_tasks WHERE task_id = ?').get(id);
    res.json({ success: true, task: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/waste/events: Filtered waste events conforming to shared schema
router.get('/events', (req, res) => {
  try {
    const events = db.prepare("SELECT * FROM campus_events WHERE module = 'waste' ORDER BY timestamp DESC LIMIT 50").all();
    res.json({ success: true, events });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
