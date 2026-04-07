// ═══════════════════════════════════════════════════════
// CrewCast — Station Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { pool } = require('../db');

const router = express.Router();

// ══════════════════════════════════════
// INDUSTRY TEMPLATES
// Each template: { label, icon, description, stations[] }
// ══════════════════════════════════════
const INDUSTRY_TEMPLATES = {
  'agritourism': {
    label: 'Agritourism / Orchard / Farm',
    icon: '🌾',
    description: 'Apple orchards, pumpkin patches, corn mazes, farm attractions',
    categories: ['Guest Services', 'Food & Beverage', 'Attractions & Activities', 'Agriculture & Outdoors', 'Facilities & Operations'],
    stations: [
      { name: 'Admission / Ticketing', description: 'Front gate entry and ticket sales', minStaff: 8, maxStaff: 15 },
      { name: 'Country Store', description: 'Retail shop — jams, pies, gifts', minStaff: 6, maxStaff: 12 },
      { name: 'Apple Picking', description: 'U-Pick apple orchard area', minStaff: 10, maxStaff: 20 },
      { name: 'Pumpkin Patch', description: 'Pick-your-own pumpkins', minStaff: 8, maxStaff: 15 },
      { name: 'Corn Maze', description: 'Corn maze supervision and assistance', minStaff: 5, maxStaff: 10 },
      { name: 'Hayride / Tractor Ride', description: 'Tractor-pulled wagon rides', minStaff: 6, maxStaff: 12 },
      { name: 'Food Stand', description: 'Burgers, grilled cheese, walking tacos', minStaff: 12, maxStaff: 25 },
      { name: 'Apple Goods / Bakery', description: 'Apple cider, donuts, pies, applesauce', minStaff: 8, maxStaff: 15 },
      { name: 'Jumping Pillow', description: 'Inflatable jumping pillow area', minStaff: 4, maxStaff: 8 },
      { name: 'Super Slide', description: 'Giant slide attraction', minStaff: 4, maxStaff: 8 },
      { name: 'Farm Animals / Petting Zoo', description: 'Animal area and goat races', minStaff: 6, maxStaff: 12 },
      { name: 'Pedal Tractors / Go-Carts', description: 'Pedal-powered vehicles for kids', minStaff: 5, maxStaff: 10 },
      { name: 'Train Ride', description: 'Train ride around the farm', minStaff: 4, maxStaff: 8 },
      { name: 'Apple Slingshot', description: 'Apple slingshot activity', minStaff: 3, maxStaff: 6 },
      { name: 'Corn Pool', description: 'Corn kernel play area for kids', minStaff: 4, maxStaff: 8 },
      { name: 'Sunflower Meadow', description: 'Sunflower field photo area', minStaff: 3, maxStaff: 6 },
      { name: 'Parking / Shuttle', description: 'Parking lot and shuttle service', minStaff: 10, maxStaff: 20 },
    ],
  },
  'restaurant': {
    label: 'Restaurant / Bar',
    icon: '🍽️',
    description: 'Full-service restaurants, fast casual, bars, cafes',
    categories: ['Front of House', 'Back of House', 'Bar', 'Management'],
    stations: [
      { name: 'Host / Greeter', description: 'Seating guests and managing waitlist', minStaff: 1, maxStaff: 2 },
      { name: 'Server Section A', description: 'Dining room section A', minStaff: 2, maxStaff: 4 },
      { name: 'Server Section B', description: 'Dining room section B', minStaff: 2, maxStaff: 4 },
      { name: 'Server Section C', description: 'Patio / overflow section', minStaff: 1, maxStaff: 3 },
      { name: 'Busser', description: 'Table clearing and reset', minStaff: 1, maxStaff: 3 },
      { name: 'Bartender', description: 'Bar service and cocktails', minStaff: 1, maxStaff: 3 },
      { name: 'Barback', description: 'Bar stocking and support', minStaff: 1, maxStaff: 2 },
      { name: 'Grill / Sauté', description: 'Grill and sauté station', minStaff: 1, maxStaff: 3 },
      { name: 'Prep Cook', description: 'Food preparation and mise en place', minStaff: 1, maxStaff: 3 },
      { name: 'Fry Station', description: 'Deep fryer and fried items', minStaff: 1, maxStaff: 2 },
      { name: 'Expo / Plating', description: 'Order assembly and quality check', minStaff: 1, maxStaff: 2 },
      { name: 'Dishwasher', description: 'Dish pit and sanitation', minStaff: 1, maxStaff: 2 },
      { name: 'Takeout / Delivery', description: 'Online orders and delivery prep', minStaff: 1, maxStaff: 2 },
    ],
  },
  'brewery': {
    label: 'Brewery / Winery / Taproom',
    icon: '🍺',
    description: 'Breweries, wineries, taprooms, tasting rooms',
    categories: ['Taproom', 'Kitchen', 'Production', 'Events'],
    stations: [
      { name: 'Taproom Bar', description: 'Main bar service and pours', minStaff: 2, maxStaff: 5 },
      { name: 'Tasting Room', description: 'Guided tastings and flights', minStaff: 1, maxStaff: 3 },
      { name: 'Outdoor Patio', description: 'Outdoor seating service', minStaff: 1, maxStaff: 4 },
      { name: 'Kitchen', description: 'Food prep and service', minStaff: 2, maxStaff: 5 },
      { name: 'Host / Door', description: 'Entry, ID checks, seating', minStaff: 1, maxStaff: 2 },
      { name: 'Merch / Retail', description: 'Merchandise and bottle sales', minStaff: 1, maxStaff: 2 },
      { name: 'Brewing / Production', description: 'Brew operations and cellar', minStaff: 1, maxStaff: 3 },
      { name: 'Events / Private Area', description: 'Private events and rental space', minStaff: 1, maxStaff: 4 },
      { name: 'Barback', description: 'Stocking, glassware, kegs', minStaff: 1, maxStaff: 2 },
      { name: 'Food Truck / Window', description: 'Outside food service window', minStaff: 1, maxStaff: 3 },
    ],
  },
  'landscaping': {
    label: 'Landscaping / Lawn Care',
    icon: '🌿',
    description: 'Landscaping companies, lawn care, hardscaping, snow removal',
    categories: ['Mowing Crews', 'Landscaping', 'Hardscape', 'Operations'],
    stations: [
      { name: 'Mowing Crew A', description: 'Residential mowing route A', minStaff: 2, maxStaff: 4 },
      { name: 'Mowing Crew B', description: 'Residential mowing route B', minStaff: 2, maxStaff: 4 },
      { name: 'Commercial Crew', description: 'Commercial property maintenance', minStaff: 3, maxStaff: 6 },
      { name: 'Landscaping Install', description: 'New landscape installations', minStaff: 3, maxStaff: 6 },
      { name: 'Hardscape Crew', description: 'Patios, retaining walls, pavers', minStaff: 2, maxStaff: 5 },
      { name: 'Irrigation', description: 'Irrigation install and repair', minStaff: 1, maxStaff: 3 },
      { name: 'Tree / Shrub Care', description: 'Pruning, trimming, tree work', minStaff: 2, maxStaff: 4 },
      { name: 'Mulch / Cleanup', description: 'Mulching, leaf removal, cleanup', minStaff: 2, maxStaff: 4 },
      { name: 'Equipment Maintenance', description: 'Shop — equipment repair and prep', minStaff: 1, maxStaff: 2 },
      { name: 'Snow Removal', description: 'Plowing, salting, shoveling (seasonal)', minStaff: 3, maxStaff: 8 },
    ],
  },
  'retail': {
    label: 'Retail Store',
    icon: '🛍️',
    description: 'Retail shops, boutiques, convenience stores',
    categories: ['Sales Floor', 'Stockroom', 'Management'],
    stations: [
      { name: 'Cashier / Register', description: 'Point of sale and checkout', minStaff: 1, maxStaff: 4 },
      { name: 'Sales Floor', description: 'Customer assistance and merchandising', minStaff: 2, maxStaff: 6 },
      { name: 'Fitting Room', description: 'Fitting room attendant', minStaff: 1, maxStaff: 2 },
      { name: 'Stockroom', description: 'Receiving, organizing, restocking', minStaff: 1, maxStaff: 3 },
      { name: 'Customer Service', description: 'Returns, exchanges, inquiries', minStaff: 1, maxStaff: 2 },
      { name: 'Visual / Displays', description: 'Window displays and floor sets', minStaff: 1, maxStaff: 2 },
      { name: 'Online Orders', description: 'BOPIS, ship-from-store', minStaff: 1, maxStaff: 2 },
      { name: 'Loss Prevention', description: 'Security and loss prevention', minStaff: 1, maxStaff: 2 },
    ],
  },
  'events': {
    label: 'Events / Venues',
    icon: '🎪',
    description: 'Event venues, wedding barns, concert halls, festivals',
    categories: ['Guest Services', 'Food & Beverage', 'Production', 'Operations'],
    stations: [
      { name: 'Box Office / Check-In', description: 'Ticket scanning and guest check-in', minStaff: 2, maxStaff: 6 },
      { name: 'Bar Service', description: 'Beverage service stations', minStaff: 2, maxStaff: 6 },
      { name: 'Catering / Food', description: 'Food service and buffet management', minStaff: 3, maxStaff: 8 },
      { name: 'A/V / Sound', description: 'Audio-visual and sound engineering', minStaff: 1, maxStaff: 3 },
      { name: 'Stage / Production', description: 'Stage management and setup', minStaff: 2, maxStaff: 5 },
      { name: 'Security', description: 'Venue security and crowd control', minStaff: 2, maxStaff: 8 },
      { name: 'Valet / Parking', description: 'Parking and valet service', minStaff: 2, maxStaff: 6 },
      { name: 'Setup / Teardown', description: 'Event setup and breakdown crew', minStaff: 3, maxStaff: 8 },
      { name: 'Guest Services', description: 'Information, VIP, coat check', minStaff: 1, maxStaff: 3 },
      { name: 'Cleaning', description: 'Venue cleaning and restroom checks', minStaff: 2, maxStaff: 4 },
    ],
  },
  'hotel': {
    label: 'Hotel / Hospitality',
    icon: '🏨',
    description: 'Hotels, resorts, bed & breakfasts',
    categories: ['Front Desk', 'Housekeeping', 'Food & Beverage', 'Maintenance'],
    stations: [
      { name: 'Front Desk', description: 'Check-in, check-out, guest inquiries', minStaff: 1, maxStaff: 3 },
      { name: 'Concierge', description: 'Guest services and local recommendations', minStaff: 1, maxStaff: 2 },
      { name: 'Housekeeping Rooms', description: 'Room cleaning and turnover', minStaff: 3, maxStaff: 10 },
      { name: 'Housekeeping Public', description: 'Lobby, hallways, common areas', minStaff: 1, maxStaff: 3 },
      { name: 'Laundry', description: 'Linen and laundry operations', minStaff: 1, maxStaff: 3 },
      { name: 'Breakfast / Restaurant', description: 'Breakfast service or restaurant', minStaff: 2, maxStaff: 5 },
      { name: 'Pool / Spa', description: 'Pool area and spa attendant', minStaff: 1, maxStaff: 3 },
      { name: 'Maintenance', description: 'Building repairs and upkeep', minStaff: 1, maxStaff: 3 },
      { name: 'Bellhop / Valet', description: 'Luggage, valet, guest transport', minStaff: 1, maxStaff: 3 },
      { name: 'Night Audit', description: 'Overnight front desk and accounting', minStaff: 1, maxStaff: 2 },
    ],
  },
  'gym': {
    label: 'Gym / Fitness Center',
    icon: '💪',
    description: 'Gyms, CrossFit boxes, yoga studios, fitness centers',
    categories: ['Front Desk', 'Training', 'Classes', 'Maintenance'],
    stations: [
      { name: 'Front Desk', description: 'Member check-in and sales', minStaff: 1, maxStaff: 3 },
      { name: 'Personal Training', description: 'One-on-one and small group training', minStaff: 1, maxStaff: 4 },
      { name: 'Group Fitness', description: 'Group class instruction', minStaff: 1, maxStaff: 3 },
      { name: 'Floor Attendant', description: 'Equipment assistance and safety', minStaff: 1, maxStaff: 3 },
      { name: 'Childcare', description: 'Kids club / childcare area', minStaff: 1, maxStaff: 3 },
      { name: 'Pool / Aquatics', description: 'Pool supervision and swim lessons', minStaff: 1, maxStaff: 3 },
      { name: 'Smoothie Bar', description: 'Juice bar and nutrition counter', minStaff: 1, maxStaff: 2 },
      { name: 'Cleaning / Maintenance', description: 'Equipment cleaning and facility upkeep', minStaff: 1, maxStaff: 2 },
    ],
  },
};

// Legacy alias for Center Grove
const DEFAULT_STATIONS = INDUSTRY_TEMPLATES.agritourism.stations.map(s => ({
  name: s.name, description: s.description, staffNeeded: s.maxStaff,
}));

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

// ── GET /api/stations/defaults?type=restaurant ──
// Get pre-populated station list for a business type
router.get('/defaults', authenticate, async (req, res) => {
  try {
    const type = req.query.type;
    // If a template type was requested, return that template
    if (type && INDUSTRY_TEMPLATES[type]) {
      return res.json(INDUSTRY_TEMPLATES[type].stations);
    }
    // Check if this is the Center Grove business (legacy)
    const { rows } = await pool.query(
      'SELECT slug FROM businesses WHERE id = $1',
      [req.user.businessId]
    );
    const slug = rows[0]?.slug || '';
    if (slug === 'center-grove' || slug === 'centergrovecider') {
      return res.json(DEFAULT_STATIONS);
    }
    res.json([]);
  } catch (err) {
    res.json([]);
  }
});

// ── GET /api/stations/templates ──
// List all available industry templates (for wizard)
router.get('/templates', authenticate, async (req, res) => {
  const list = Object.entries(INDUSTRY_TEMPLATES).map(([key, t]) => ({
    id: key,
    label: t.label,
    icon: t.icon,
    description: t.description,
    stationCount: t.stations.length,
    categories: t.categories,
  }));
  res.json(list);
});

// ── POST /api/stations ──
// Add a single station (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, openTime, closeTime, arriveEarlyMinutes, staffNeeded, minStaff, maxStaff } = req.body;
    if (!name) return res.status(400).json({ error: 'Station name required' });

    const maxVal = maxStaff || staffNeeded || 5;
    const minVal = minStaff || Math.max(1, Math.round(maxVal * 0.5));

    const { rows } = await pool.query(`
      INSERT INTO stations (business_id, name, description, open_time, close_time, arrive_early_minutes, staff_needed, min_staff, max_staff)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      req.user.businessId,
      name.trim(),
      description || null,
      openTime || '09:00',
      closeTime || '17:00',
      arriveEarlyMinutes || 15,
      maxVal,
      minVal,
      maxVal
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
          const bMaxVal = s.maxStaff || s.staffNeeded || 5;
          const bMinVal = s.minStaff || Math.max(1, Math.round(bMaxVal * 0.5));
          await client.query(`
            INSERT INTO stations (business_id, name, description, open_time, close_time, arrive_early_minutes, staff_needed, min_staff, max_staff, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            req.user.businessId,
            s.name.trim(),
            s.description || null,
            s.openTime || '09:00',
            s.closeTime || '17:00',
            s.arriveEarlyMinutes || 15,
            bMaxVal,
            bMinVal,
            bMaxVal,
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

// ══════════════════════════════════════
// BUSINESS SETTINGS (stored in businesses.settings JSON column)
// ══════════════════════════════════════

// ── GET /api/stations/features (public feature flags for employees) ──
router.get('/features', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT settings FROM businesses WHERE id = $1',
      [req.user.businessId]
    );
    const s = JSON.parse(rows[0]?.settings || '{}');
    res.json({
      allowSwaps: s.allowSwaps !== false,
      employeeRankStations: s.employeeRankStations !== false,
      employeeSetAvailability: s.employeeSetAvailability !== false,
      employeeRequestDaysOff: s.employeeRequestDaysOff || false,
    });
  } catch (err) {
    console.error('Get features error:', err);
    res.json({ allowSwaps: true, employeeRankStations: true, employeeSetAvailability: true });
  }
});

// ── GET /api/stations/settings ──
router.get('/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT settings FROM businesses WHERE id = $1',
      [req.user.businessId]
    );
    const settings = JSON.parse(rows[0]?.settings || '{}');
    res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// ── PUT /api/stations/settings ──
router.put('/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT settings FROM businesses WHERE id = $1',
      [req.user.businessId]
    );
    const existing = JSON.parse(rows[0]?.settings || '{}');
    const merged = { ...existing, ...req.body };

    await pool.query(
      'UPDATE businesses SET settings = $1 WHERE id = $2',
      [JSON.stringify(merged), req.user.businessId]
    );
    res.json(merged);
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ── PUT /api/stations/:id ──
// Update a station (admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, openTime, closeTime, arriveEarlyMinutes, staffNeeded, minStaff, maxStaff, active } = req.body;

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
        min_staff = COALESCE($7, min_staff),
        max_staff = COALESCE($8, max_staff),
        active = COALESCE($9, active)
      WHERE id = $10
      RETURNING *
    `, [
      name || null,
      description || null,
      openTime || null,
      closeTime || null,
      arriveEarlyMinutes != null ? arriveEarlyMinutes : null,
      maxStaff != null ? maxStaff : (staffNeeded != null ? staffNeeded : null),
      minStaff != null ? minStaff : null,
      maxStaff != null ? maxStaff : (staffNeeded != null ? staffNeeded : null),
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
