// ═══════════════════════════════════════════════════════
// CrewCast — Schedule & Shift Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool } = require('../db');
const { notifyEmployee, notifyBusinessAdmins } = require('./push');

const router = express.Router();

// ══════════════════════════════════════
// SCHEDULES
// ══════════════════════════════════════

// ── GET /api/schedules ──
// List schedules for the business
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM shifts WHERE schedule_id = s.id) as total_shifts,
        (SELECT COUNT(*) FROM shifts WHERE schedule_id = s.id AND status = 'confirmed') as confirmed,
        (SELECT COUNT(*) FROM shifts WHERE schedule_id = s.id AND status = 'declined') as declined,
        (SELECT COUNT(*) FROM shifts WHERE schedule_id = s.id AND status = 'pending') as pending
      FROM schedules s
      WHERE s.business_id = $1
      ORDER BY s.start_date ASC
    `, [req.user.businessId]);

    res.json(rows);
  } catch (err) {
    console.error('List schedules error:', err);
    res.status(500).json({ error: 'Failed to list schedules' });
  }
});

// ── POST /api/schedules ──
// Create a new schedule (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, startDate, endDate, notes } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Name, start date, and end date required' });
    }

    const { rows } = await pool.query(`
      INSERT INTO schedules (business_id, name, start_date, end_date, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [req.user.businessId, name, startDate, endDate, notes || null]);

    res.json({ id: rows[0].id, name, startDate, endDate, status: 'draft' });
  } catch (err) {
    console.error('Create schedule error:', err);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// ── PUT /api/schedules/:id ──
// Update schedule (status, name, etc)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, status, notes } = req.body;
    const { rows } = await pool.query(
      'SELECT * FROM schedules WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Schedule not found' });

    const oldStatus = rows[0].status;

    await pool.query(`
      UPDATE schedules SET
        name = COALESCE($1, name),
        status = COALESCE($2, status),
        notes = COALESCE($3, notes)
      WHERE id = $4
    `, [name || null, status || null, notes || null, req.params.id]);

    // Auto-notify all assigned employees when schedule is published
    if (status === 'published' && oldStatus !== 'published') {
      try {
        const scheduleName = name || rows[0].name;
        const { rows: shiftRows } = await pool.query(
          'SELECT DISTINCT employee_id FROM shifts WHERE schedule_id = $1 AND employee_id IS NOT NULL',
          [req.params.id]
        );
        for (const row of shiftRows) {
          notifyEmployee(row.employee_id, '📅 New Schedule Posted', `${scheduleName} has been published. Check your shifts!`, `/employee/schedule`).catch(() => {});
        }
      } catch (e) { console.log('Publish notify error:', e.message); }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update schedule error:', err);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// ── DELETE /api/schedules/:id ──
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM shifts WHERE schedule_id = $1 AND schedule_id IN (SELECT id FROM schedules WHERE business_id = $2)',
      [req.params.id, req.user.businessId]
    );
    await pool.query(
      'DELETE FROM schedules WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Delete schedule error:', err);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// ══════════════════════════════════════
// SHIFTS
// ══════════════════════════════════════

// ── GET /api/schedules/:id/shifts ──
// Get all shifts for a schedule (admin sees all, employee sees own)
router.get('/:id/shifts', authenticate, async (req, res) => {
  try {
    const { rows: schedRows } = await pool.query(
      'SELECT * FROM schedules WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (schedRows.length === 0) return res.status(404).json({ error: 'Schedule not found' });

    let shifts;
    if (req.user.role === 'admin' || req.user.role === 'owner') {
      const { rows } = await pool.query(`
        SELECT sh.*, e.first_name, e.last_name, e.phone
        FROM shifts sh
        JOIN employees e ON sh.employee_id = e.id
        WHERE sh.schedule_id = $1
        ORDER BY sh.date, sh.start_time, e.last_name
      `, [req.params.id]);
      shifts = rows;
    } else {
      const { rows } = await pool.query(`
        SELECT sh.*, e.first_name, e.last_name
        FROM shifts sh
        JOIN employees e ON sh.employee_id = e.id
        WHERE sh.schedule_id = $1 AND sh.employee_id = $2
        ORDER BY sh.date, sh.start_time
      `, [req.params.id, req.user.id]);
      shifts = rows;
    }

    res.json({ schedule: schedRows[0], shifts });
  } catch (err) {
    console.error('Get shifts error:', err);
    res.status(500).json({ error: 'Failed to get shifts' });
  }
});

// ── POST /api/schedules/:id/shifts ──
// Add shifts to a schedule (admin)
router.post('/:id/shifts', authenticate, requireAdmin, async (req, res) => {
  try {
    const { shifts } = req.body;
    if (!Array.isArray(shifts)) {
      return res.status(400).json({ error: 'Expected array of shifts' });
    }

    const { rows: schedRows } = await pool.query(
      'SELECT * FROM schedules WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (schedRows.length === 0) return res.status(404).json({ error: 'Schedule not found' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const sh of shifts) {
        await client.query(`
          INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, station, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          req.params.id,
          sh.employeeId,
          sh.date,
          sh.startTime || '09:00',
          sh.endTime || '17:00',
          sh.station || null,
          sh.notes || null
        ]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ added: shifts.length });
  } catch (err) {
    console.error('Add shifts error:', err);
    res.status(500).json({ error: 'Failed to add shifts' });
  }
});

// ── DELETE /api/schedules/:scheduleId/shifts/:shiftId ──
// Remove a single shift (admin). Scoped to the caller's business.
router.delete('/:scheduleId/shifts/:shiftId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rowCount } = await pool.query(`
      DELETE FROM shifts sh
      USING schedules s
      WHERE sh.id = $1
        AND sh.schedule_id = s.id
        AND s.id = $2
        AND s.business_id = $3
    `, [req.params.shiftId, req.params.scheduleId, req.user.businessId]);
    if (rowCount === 0) return res.status(404).json({ error: 'Shift not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete shift error:', err);
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

// ── PUT /api/shifts/:id/respond ──
// Employee confirms or declines a shift
router.put('/:scheduleId/shifts/:shiftId/respond', authenticate, async (req, res) => {
  try {
    const { status, notes, decline_reason } = req.body;
    if (!['confirmed', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Status must be confirmed or declined' });
    }

    const { rows } = await pool.query(`
      SELECT sh.* FROM shifts sh
      JOIN schedules s ON sh.schedule_id = s.id
      WHERE sh.id = $1 AND sh.employee_id = $2 AND s.business_id = $3
    `, [req.params.shiftId, req.user.id, req.user.businessId]);

    if (rows.length === 0) return res.status(404).json({ error: 'Shift not found' });

    await pool.query(`
      UPDATE shifts SET status = $1, notes = COALESCE($2, notes),
        decline_reason = $3, responded_at = NOW()
      WHERE id = $4
    `, [status, notes || null, status === 'declined' ? (decline_reason || null) : null, req.params.shiftId]);

    // Adjust Reliability rating based on response
    try {
      const { rows: relCat } = await pool.query(
        "SELECT id FROM station_categories WHERE business_id = $1 AND name = 'Reliability'",
        [req.user.businessId]
      );
      if (relCat.length > 0) {
        const relCatId = relCat[0].id;
        const { rows: curRating } = await pool.query(
          'SELECT rating FROM employee_category_ratings WHERE employee_id = $1 AND category_id = $2',
          [req.user.id, relCatId]
        );
        let current = curRating.length > 0 ? curRating[0].rating : 3;
        if (status === 'confirmed' && current < 5) current++;
        else if (status === 'declined' && current > 1) current--;
        await pool.query(
          'INSERT INTO employee_category_ratings (employee_id, category_id, rating) VALUES ($1, $2, $3) ON CONFLICT (employee_id, category_id) DO UPDATE SET rating = $3, updated_at = NOW()',
          [req.user.id, relCatId, current]
        );
      }
    } catch (e) { /* non-critical */ }

    // Notify admins when an employee declines a shift
    if (status === 'declined') {
      try {
        const shift = rows[0];
        const empName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
        notifyBusinessAdmins(req.user.businessId,
          '⚠️ Shift Declined',
          `${empName} declined their ${shift.station || ''} shift on ${shift.date}`,
          `/admin/schedule/${shift.schedule_id}`
        ).catch(() => {});
      } catch (e) {}
    }

    res.json({ success: true, status });
  } catch (err) {
    console.error('Respond to shift error:', err);
    res.status(500).json({ error: 'Failed to respond to shift' });
  }
});

// ── GET /api/my-shifts ──
// Get all upcoming shifts for the logged-in employee
router.get('/my-shifts', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sh.*, s.name as schedule_name, s.status as schedule_status
      FROM shifts sh
      JOIN schedules s ON sh.schedule_id = s.id
      WHERE sh.employee_id = $1 AND s.business_id = $2 AND s.status = 'published'
        AND sh.date >= CURRENT_DATE::TEXT
      ORDER BY sh.date, sh.start_time
    `, [req.user.id, req.user.businessId]);

    res.json(rows);
  } catch (err) {
    console.error('My shifts error:', err);
    res.status(500).json({ error: 'Failed to get shifts' });
  }
});

// ══════════════════════════════════════
// AUTO-FILL — server-side smart scheduling
// ══════════════════════════════════════

router.post('/:id/auto-fill', authenticate, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    // ── 1. Validate schedule ──
    const { rows: schedRows } = await client.query(
      'SELECT * FROM schedules WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (schedRows.length === 0) return res.status(404).json({ error: 'Schedule not found' });

    const {
      dates,                          // ['2026-05-03', '2026-05-04', ...]
      stationOverrides = {},          // { stationName: scaledCount } (optional per-station override)
      totalStaff,                     // target total (optional, uses station defaults if omitted)
      floaterCount = 0,               // how many floaters per day
      skipExisting = true,            // don't overwrite manually-added shifts
      weights = {},                   // { preference: 40, skill: 35, fairness: 25 }
    } = req.body;

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'dates array required' });
    }

    // ── 2. Load business settings (defaults for weights) ──
    const { rows: bizRows } = await client.query(
      'SELECT settings FROM businesses WHERE id = $1', [req.user.businessId]
    );
    const bizSettings = JSON.parse(bizRows[0]?.settings || '{}');

    const w = {
      preference: weights.preference ?? bizSettings.autoFillWeightPreference ?? 40,
      skill:      weights.skill      ?? bizSettings.autoFillWeightSkill      ?? 35,
      fairness:   weights.fairness   ?? bizSettings.autoFillWeightFairness   ?? 25,
    };
    // Normalize to sum=100
    const wSum = w.preference + w.skill + w.fairness;
    if (wSum > 0) { w.preference /= wSum / 100; w.skill /= wSum / 100; w.fairness /= wSum / 100; }

    // ── 3. Load stations ──
    const { rows: stations } = await client.query(
      'SELECT * FROM stations WHERE business_id = $1 AND active = true ORDER BY sort_order, name',
      [req.user.businessId]
    );
    if (stations.length === 0) return res.status(400).json({ error: 'No active stations' });

    // Build station lookup
    const stationById = {};
    const stationByName = {};
    stations.forEach(s => { stationById[s.id] = s; stationByName[s.name] = s; });

    // ── 4. Load employees (active, non-admin) ──
    const { rows: employees } = await client.query(
      "SELECT id, first_name, last_name FROM employees WHERE business_id = $1 AND active = true AND role NOT IN ('admin', 'owner')",
      [req.user.businessId]
    );
    if (employees.length === 0) return res.status(400).json({ error: 'No active employees' });
    const empById = {};
    employees.forEach(e => { empById[e.id] = e; });

    // ── 5. Load employee-station data (training, preference, pinned, rating) ──
    const { rows: empStations } = await client.query(`
      SELECT es.employee_id, es.station_id, es.preferred, es.rank, es.pinned, es.rating, es.skill_level
      FROM employee_stations es
      JOIN employees e ON es.employee_id = e.id
      WHERE e.business_id = $1 AND e.active = true
    `, [req.user.businessId]);

    // Map: stationId -> [{ employeeId, preferred, rank, pinned, rating }]
    const stationEmpMap = {};
    // Map: employeeId -> [{ stationId, pinned, ... }]
    const empStationMap = {};
    empStations.forEach(es => {
      if (!stationEmpMap[es.station_id]) stationEmpMap[es.station_id] = [];
      stationEmpMap[es.station_id].push(es);
      if (!empStationMap[es.employee_id]) empStationMap[es.employee_id] = [];
      empStationMap[es.employee_id].push(es);
    });

    // ── 6. Load category ratings ──
    const { rows: catRatings } = await client.query(`
      SELECT ecr.employee_id, ecr.category_id, ecr.rating
      FROM employee_category_ratings ecr
      JOIN station_categories sc ON ecr.category_id = sc.id
      WHERE sc.business_id = $1
    `, [req.user.businessId]);
    // Map: employeeId -> { categoryId: rating }
    const empCatRatings = {};
    catRatings.forEach(cr => {
      if (!empCatRatings[cr.employee_id]) empCatRatings[cr.employee_id] = {};
      empCatRatings[cr.employee_id][cr.category_id] = cr.rating;
    });

    // ── 7. Load availability for all requested dates ──
    const { rows: availRows } = await client.query(`
      SELECT employee_id, date, available, start_time, end_time
      FROM availability
      WHERE employee_id IN (SELECT id FROM employees WHERE business_id = $1 AND active = true)
        AND date = ANY($2)
    `, [req.user.businessId, dates]);
    // Map: date -> { employeeId: { available, startTime, endTime } }
    const availMap = {};
    availRows.forEach(a => {
      if (!availMap[a.date]) availMap[a.date] = {};
      availMap[a.date][a.employee_id] = { available: a.available, startTime: a.start_time, endTime: a.end_time };
    });

    // ── 8. Load existing shifts for skip logic ──
    let existingShifts = {};
    if (skipExisting) {
      const { rows: exShifts } = await client.query(
        'SELECT employee_id, date, station FROM shifts WHERE schedule_id = $1',
        [req.params.id]
      );
      exShifts.forEach(s => {
        const key = `${s.date}|${s.employee_id}`;
        existingShifts[key] = true;
      });
    }

    // ── 9. Determine station staffing targets ──
    // If totalStaff provided, scale proportionally; otherwise use station defaults
    let stationTargets = []; // [{ station, needed }]
    const activeStations = stations.filter(s => {
      // Skip Float Pool pseudo-station from regular assignment
      if (s.name === 'Float Pool') return false;
      return true;
    });

    if (totalStaff && totalStaff > 0) {
      const defaultSum = activeStations.reduce((sum, s) => sum + (s.staff_needed || 1), 0);
      activeStations.forEach(s => {
        const override = stationOverrides[s.name];
        if (override !== undefined) {
          stationTargets.push({ station: s, needed: override });
        } else {
          let scaled = Math.round(((s.staff_needed || 1) / (defaultSum || 1)) * totalStaff);
          scaled = Math.max(s.min_staff || 1, Math.min(s.max_staff || scaled, scaled));
          stationTargets.push({ station: s, needed: scaled });
        }
      });
    } else {
      activeStations.forEach(s => {
        const override = stationOverrides[s.name];
        stationTargets.push({ station: s, needed: override !== undefined ? override : (s.staff_needed || 1) });
      });
    }

    // ── 10. Score function ──
    function scoreEmployee(empId, station) {
      const esData = (stationEmpMap[station.id] || []).find(es => es.employee_id === empId);

      let prefScore = 0;  // 0-100
      let skillScore = 50; // default middle
      let fairScore = 0;   // computed per-day

      if (esData) {
        // Preference: rank 1=100, 2=80, 3=60, 4+=40. preferred flag bonus +10
        if (esData.rank === 1) prefScore = 100;
        else if (esData.rank === 2) prefScore = 80;
        else if (esData.rank === 3) prefScore = 60;
        else if (esData.rank > 0) prefScore = 40;
        else prefScore = 20; // trained but no rank
        if (esData.preferred) prefScore = Math.min(100, prefScore + 10);

        // Skill: per-station rating (1-5) → 0-100. Fall back to category rating.
        if (esData.rating) {
          skillScore = esData.rating * 20; // 1→20, 5→100
        } else if (station.category_id && empCatRatings[empId]?.[station.category_id]) {
          skillScore = empCatRatings[empId][station.category_id] * 20;
        }
      } else {
        // Not trained for this station — low but not zero (allows fallback assignment)
        prefScore = 0;
        skillScore = 30;
      }

      return {
        preference: prefScore,
        skill: skillScore,
        // fairness is injected dynamically per-day
      };
    }

    // ── 11. Build shifts for each date ──
    const newShifts = [];
    const stats = { totalShifts: 0, byStation: {}, gaps: [], floaters: 0, skippedExisting: 0 };
    // Track cumulative hours for fairness across dates
    const empHoursAccum = {};
    employees.forEach(e => { empHoursAccum[e.id] = 0; });

    for (const date of dates) {
      const usedToday = new Set();
      const dayAvail = availMap[date] || {};

      // Check employee availability for this date
      function isAvailable(empId, station) {
        const a = dayAvail[empId];
        // If no availability record, treat as available (unknown = available by default)
        if (!a) return true;
        if (a.available === false) return false;
        // If they have time windows, check overlap with station hours
        if (a.startTime && a.endTime && station) {
          const empStart = a.startTime.replace(':', '');
          const empEnd = a.endTime.replace(':', '');
          const stStart = (station.open_time || '09:00').replace(':', '');
          const stEnd = (station.close_time || '17:00').replace(':', '');
          // Must overlap (employee available window intersects station hours)
          if (empEnd <= stStart || empStart >= stEnd) return false;
        }
        return true;
      }

      // Phase 1: Assign pinned employees first
      for (const target of stationTargets) {
        const pinned = (stationEmpMap[target.station.id] || []).filter(es => es.pinned && empById[es.employee_id]);
        for (const pin of pinned) {
          if (usedToday.has(pin.employee_id)) continue;
          if (!isAvailable(pin.employee_id, target.station)) continue;
          const existKey = `${date}|${pin.employee_id}`;
          if (skipExisting && existingShifts[existKey]) { stats.skippedExisting++; usedToday.add(pin.employee_id); continue; }

          newShifts.push({
            scheduleId: parseInt(req.params.id),
            employeeId: pin.employee_id,
            date,
            startTime: target.station.open_time || '09:00',
            endTime: target.station.close_time || '17:00',
            station: target.station.name,
          });
          usedToday.add(pin.employee_id);
          if (!stats.byStation[target.station.name]) stats.byStation[target.station.name] = 0;
          stats.byStation[target.station.name]++;

          // Track hours
          const hrs = calcHours(target.station.open_time || '09:00', target.station.close_time || '17:00');
          empHoursAccum[pin.employee_id] = (empHoursAccum[pin.employee_id] || 0) + hrs;
        }
      }

      // Phase 2: Fill remaining slots with weighted scoring
      for (const target of stationTargets) {
        const alreadyAssigned = newShifts.filter(s => s.date === date && s.station === target.station.name).length;
        let remaining = target.needed - alreadyAssigned;
        if (remaining <= 0) continue;

        // Get all candidates: available, not yet used today
        const candidates = employees
          .filter(e => !usedToday.has(e.id) && isAvailable(e.id, target.station))
          .map(e => {
            const scores = scoreEmployee(e.id, target.station);
            // Fairness: inverse of accumulated hours (fewer hours = higher score)
            const maxHours = Math.max(...Object.values(empHoursAccum), 1);
            const fairScore = maxHours > 0 ? (1 - (empHoursAccum[e.id] || 0) / maxHours) * 100 : 50;

            const total = (scores.preference * w.preference + scores.skill * w.skill + fairScore * w.fairness) / 100;
            return { emp: e, score: total, trained: (stationEmpMap[target.station.id] || []).some(es => es.employee_id === e.id) };
          })
          // Prefer trained employees, then sort by score
          .sort((a, b) => {
            if (a.trained !== b.trained) return b.trained - a.trained;
            return b.score - a.score;
          });

        for (const { emp } of candidates) {
          if (remaining <= 0) break;
          const existKey = `${date}|${emp.id}`;
          if (skipExisting && existingShifts[existKey]) { stats.skippedExisting++; usedToday.add(emp.id); continue; }

          newShifts.push({
            scheduleId: parseInt(req.params.id),
            employeeId: emp.id,
            date,
            startTime: target.station.open_time || '09:00',
            endTime: target.station.close_time || '17:00',
            station: target.station.name,
          });
          usedToday.add(emp.id);
          if (!stats.byStation[target.station.name]) stats.byStation[target.station.name] = 0;
          stats.byStation[target.station.name]++;
          remaining--;

          const hrs = calcHours(target.station.open_time || '09:00', target.station.close_time || '17:00');
          empHoursAccum[emp.id] = (empHoursAccum[emp.id] || 0) + hrs;
        }

        if (remaining > 0) {
          stats.gaps.push({ station: target.station.name, date, short: remaining });
        }
      }

      // Phase 3: Assign floaters (remaining available employees, up to floaterCount)
      if (floaterCount > 0) {
        const floaterCandidates = employees
          .filter(e => !usedToday.has(e.id) && isAvailable(e.id, null))
          .sort((a, b) => (empHoursAccum[a.id] || 0) - (empHoursAccum[b.id] || 0)); // fewest hours first

        let floatersAssigned = 0;
        for (const emp of floaterCandidates) {
          if (floatersAssigned >= floaterCount) break;
          const existKey = `${date}|${emp.id}`;
          if (skipExisting && existingShifts[existKey]) continue;

          newShifts.push({
            scheduleId: parseInt(req.params.id),
            employeeId: emp.id,
            date,
            startTime: bizSettings.defaultOpenTime || '09:00',
            endTime: bizSettings.defaultCloseTime || '17:00',
            station: 'Float Pool',
          });
          usedToday.add(emp.id);
          floatersAssigned++;
          stats.floaters++;

          const hrs = calcHours(bizSettings.defaultOpenTime || '09:00', bizSettings.defaultCloseTime || '17:00');
          empHoursAccum[emp.id] = (empHoursAccum[emp.id] || 0) + hrs;
        }
      }
    }

    // ── 12. Insert all shifts in a transaction ──
    stats.totalShifts = newShifts.length;
    if (newShifts.length > 0) {
      await client.query('BEGIN');
      try {
        // Ensure Float Pool station exists if we have floaters
        if (stats.floaters > 0) {
          await client.query(`
            INSERT INTO stations (business_id, name, description, icon, staff_needed, min_staff, max_staff, active)
            VALUES ($1, 'Float Pool', 'On-deck employees ready to cover no-shows', '🔄', 0, 0, 0, true)
            ON CONFLICT (business_id, name) DO NOTHING
          `, [req.user.businessId]);
        }

        for (const s of newShifts) {
          await client.query(`
            INSERT INTO shifts (schedule_id, employee_id, date, start_time, end_time, station, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'pending')
          `, [s.scheduleId, s.employeeId, s.date, s.startTime, s.endTime, s.station]);
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    res.json({
      success: true,
      stats: {
        totalShifts: stats.totalShifts,
        dates: dates.length,
        stations: Object.keys(stats.byStation).length,
        byStation: stats.byStation,
        gaps: stats.gaps,
        floaters: stats.floaters,
        skippedExisting: stats.skippedExisting,
        weights: w,
      }
    });

  } catch (err) {
    console.error('Auto-fill error:', err);
    res.status(500).json({ error: 'Auto-fill failed: ' + err.message });
  } finally {
    client.release();
  }
});

function calcHours(start, end) {
  const [sh, sm] = (start || '09:00').split(':').map(Number);
  const [eh, em] = (end || '17:00').split(':').map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

module.exports = router;
