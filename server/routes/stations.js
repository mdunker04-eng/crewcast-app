// ═══════════════════════════════════════════════════════
// CrewCast — Station Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool } = require('../db');

const router = express.Router();

// Default stations scraped from Center Grove Orchard website
const DEFAULT_STATIONS = [
  { name: 'Admission / Ticketing', description: 'Front gate entry and ticket sales' },
  { name: 'Country Store', description: 'Retail shop — jams, pies, gifts' },
  { name: 'Apple Picking', description: 'U-Pick apple orchard area' },
  { name: 'Pumpkin Patch', description: 'Pick-your-own pumpkins' },
  { name: 'Corn Maze', description: 'Corn maze supervision and assistance' },
  { name: 'Hayride / Tractor Ride', description: 'Tractor-pulled wagon rides' },
  { name: 'Food Stand', description: 'Burgers, grilled cheese, walking tacos' },
  { name: 'Apple Goods / Bakery', description: 'Apple cider, donuts, pies, applesauce' },
  { name: 'Jumping Pillow', description: 'Inflatable jumping pillow area' },
  { name: 'Super Slide', description: 'Giant slide attraction' },
  { name: 'Farm Animals / Petting Zoo', description: 'Animal area and goat races' },
  { name: 'Pedal Tractors / Go-Carts', description: 'Pedal-powered vehicles for kids' },
  { name: 'Train Ride', description: 'Train ride around the farm' },
  { name: 'Apple Slingshot', description: 'Apple slingshot activity' },
  { name: 'Corn Pool', description: 'Corn kernel play area for kids' },
  { name: 'Sunflower Meadow', description: 'Sunflower field photo area' },
  { name: 'Storybook Land', description: 'Themed character walk-through' },
  { name: 'Schoolhouse', description: 'One-room schoolhouse attraction' },
  { name: 'Fire Pit Area', description: 'Group fire pit rentals' },
  { name: 'Parking / Shuttle', description: 'Parking lot and shuttle service' },
];

// ── GET /api/stations ──
// List all stations for the business
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM stations WHERE business_id = $1 ORDER BY sort_order, name',
      [req.user.businessId]
    );
    res.json(rows);
  } catch (err) {
    console.error('List stations error:', err);
    res.status(500).json({ error: 'Failed to list stations' });
  }
});

// ── GET /api/stations/defaults ──
// Get the pre-populated default station list (no auth needed for setup)
router.get('/defaults', authenticate, (req, res) => {
  res.json(DEFAULT_STATIONS);
});

// ── POST /api/stations ──
// Add a single station (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, openTime, closeTime, arriveEarlyMinutes } = req.body;
    if (!name) return res.status(400).json({ error: 'Station name required' });

    const { rows } = await pool.query(`
      INSERT INTO stations (business_id, name, description, open_time, close_time, arrive_early_minutes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      req.user.businessId,
      name.trim(),
      description || null,
      openTime || '09:00',
      closeTime || '17:00',
      arriveEarlyMinutes || 15
    ]);

    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Station already exists' });
    }
    console.error('Add station error:', err);
    res.status(500).json({ error: 'Failed to add station' });
  }
});

// ── POST /api/stations/bulk ──
// Bulk import stations (admin) — used during initial setup
router.post('/bulk', authenticate, requireAdmin, async (req, res) => {
  try {
    const { stations } = req.body;
    if (!Array.isArray(stations)) {
      return res.status(400).json({ error: 'Expected array of stations' });
    }

    const client = await pool.connect();
    let added = 0;
    let skipped = 0;

    try {
      await client.query('BEGIN');
      for (let i = 0; i < stations.length; i++) {
        const s = stations[i];
        try {
          await client.query(`
            INSERT INTO stations (business_id, name, description, open_time, close_time, arrive_early_minutes, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            req.user.businessId,
            s.name.trim(),
            s.description || null,
            s.openTime || '09:00',
            s.closeTime || '17:00',
            s.arriveEarlyMinutes || 15,
            i
          ]);
          added++;
        } catch (e) {
          if (e.code === '23505') { skipped++; }
          else throw e;
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ added, skipped });
  } catch (err) {
    console.error('Bulk add stations error:', err);
    res.status(500).json({ error: 'Failed to bulk add stations' });
  }
});

// ── PUT /api/stations/:id ──
// Update a station (admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, openTime, closeTime, arriveEarlyMinutes, active } = req.body;

    const { rows } = await pool.query(
      'SELECT * FROM stations WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Station not found' });

    const { rows: updated } = await pool.query(`
      UPDATE stations SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        open_time = COALESCE($3, open_time),
        close_time = COALESCE($4, close_time),
        arrive_early_minutes = COALESCE($5, arrive_early_minutes),
        active = COALESCE($6, active)
      WHERE id = $7
      RETURNING *
    `, [
      name || null,
      description || null,
      openTime || null,
      closeTime || null,
      arriveEarlyMinutes != null ? arriveEarlyMinutes : null,
      active != null ? active : null,
      req.params.id
    ]);

    res.json(updated[0]);
  } catch (err) {
    console.error('Update station error:', err);
    res.status(500).json({ error: 'Failed to update station' });
  }
});

// ── DELETE /api/stations/:id ──
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM stations WHERE id = $1 AND business_id = $2',
      [req.params.id, req.user.businessId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Delete station error:', err);
    res.status(500).json({ error: 'Failed to delete station' });
  }
});

module.exports = router;
