// ═══════════════════════════════════════════════════════
// CrewCast — Station Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool } = require('../db');

const router = express.Router();

// Default stations scraped from Center Grove Orchard website
// Default stations scraped from Center Grove Orchard website
// staffNeeded estimated for ~250 peak-day staff
const DEFAULT_STATIONS = [
  { name: 'Admission / Ticketing', description: 'Front gate entry and ticket sales', staffNeeded: 15 },
  { name: 'Country Store', description: 'Retail shop — jams, pies, gifts', staffNeeded: 12 },
  { name: 'Apple Picking', description: 'U-Pick apple orchard area', staffNeeded: 20 },
  { name: 'Pumpkin Patch', description: 'Pick-your-own pumpkins', staffNeeded: 15 },
  { name: 'Corn Maze', description: 'Corn maze supervision and assistance', staffNeeded: 10 },
  { name: 'Hayride / Tractor Ride', description: 'Tractor-pulled wagon rides', staffNeeded: 12 },
  { name: 'Food Stand', description: 'Burgers, grilled cheese, walking tacos', staffNeeded: 25 },
  { name: 'Apple Goods / Bakery', description: 'Apple cider, donuts, pies, applesauce', staffNeeded: 15 },
  { name: 'Jumping Pillow', description: 'Inflatable jumping pillow area', staffNeeded: 8 },
  { name: 'Super Slide', description: 'Giant slide attraction', staffNeeded: 8 },
  { name: 'Farm Animals / Petting Zoo', description: 'Animal area and goat races', staffNeeded: 12 },
  { name: 'Pedal Tractors / Go-Carts', description: 'Pedal-powered vehicles for kids', staffNeeded: 10 },
  { name: 'Train Ride', description: 'Train ride around the farm', staffNeeded: 8 },
  { name: 'Apple Slingshot', description: 'Apple slingshot activity', staffNeeded: 6 },
  { name: 'Corn Pool', description: 'Corn kernel play area for kids', staffNeeded: 8 },
  { name: 'Sunflower Meadow', description: 'Sunflower field photo area', staffNeeded: 6 },
  { name: 'Storybook Land', description: 'Themed character walk-through', staffNeeded: 6 },
  { name: 'Schoolhouse', description: 'One-room schoolhouse attraction', staffNeeded: 4 },
  { name: 'Fire Pit Area', description: 'Group fire pit rentals', staffNeeded: 8 },
  { name: 'Parking / Shuttle', description: 'Parking lot and shuttle service', staffNeeded: 20 },
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
// Get the pre-populated default station list
// Returns Center Grove defaults for that business, empty array for others
router.get('/defaults', authenticate, async (req, res) => {
  try {
    // Check if this is the Center Grove business
    const { rows } = await pool.query(
      'SELECT slug FROM businesses WHERE id = $1',
      [req.user.businessId]
    );
    const slug = rows[0]?.slug || '';
    if (slug === 'center-grove' || slug === 'centergrovecider') {
      return res.json(DEFAULT_STATIONS);
    }
    // Other businesses get an empty list — they'll use the blank setup
    res.json([]);
  } catch (err) {
    res.json([]);
  }
});

// ── POST /api/stations ──
// Add a single station (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, openTime, closeTime, arriveEarlyMinutes, staffNeeded } = req.body;
    if (!name) return res.status(400).json({ error: 'Station name required' });

    const { rows } = await pool.query(`
      INSERT INTO stations (business_id, name, description, open_time, close_time, arrive_early_minutes, staff_needed)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      req.user.businessId,
      name.trim(),
      description || null,
      openTime || '09:00',
      closeTime || '17:00',
      arriveEarlyMinutes || 15,
      staffNeeded || 5
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
            INSERT INTO stations (business_id, name, description, open_time, close_time, arrive_early_minutes, staff_needed, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            req.user.businessId,
            s.name.trim(),
            s.description || null,
            s.openTime || '09:00',
            s.closeTime || '17:00',
            s.arriveEarlyMinutes || 15,
            s.staffNeeded || 5,
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
    const { name, description, openTime, closeTime, arriveEarlyMinutes, staffNeeded, active } = req.body;

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
        staff_needed = COALESCE($6, staff_needed),
        active = COALESCE($7, active)
      WHERE id = $8
      RETURNING *
    `, [
      name || null,
      description || null,
      openTime || null,
      closeTime || null,
      arriveEarlyMinutes != null ? arriveEarlyMinutes : null,
      staffNeeded != null ? staffNeeded : null,
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
