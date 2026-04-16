// ═══════════════════════════════════════════════════════
// CrewCast — Database Setup (PostgreSQL)
// ═══════════════════════════════════════════════════════

const { Pool } = require('pg');

// Railway sets DATABASE_URL automatically when you add Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Initialize Schema ──
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Businesses (multi-tenant)
      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        owner_name TEXT,
        owner_phone TEXT,
        owner_email TEXT,
        settings TEXT DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Employees
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        pin_hash TEXT,
        role TEXT DEFAULT 'employee',
        skills TEXT DEFAULT '{}',
        active BOOLEAN DEFAULT true,
        invite_token TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(business_id, phone)
      );

      -- Schedules (a published week/event)
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Shifts (individual assignments)
      CREATE TABLE IF NOT EXISTS shifts (
        id SERIAL PRIMARY KEY,
        schedule_id INTEGER NOT NULL REFERENCES schedules(id),
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        station TEXT,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        responded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Availability (employee marks which days they can work)
      CREATE TABLE IF NOT EXISTS availability (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        date TEXT NOT NULL,
        available BOOLEAN DEFAULT true,
        start_time TEXT,
        end_time TEXT,
        notes TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(employee_id, date)
      );

      -- Swap Requests
      CREATE TABLE IF NOT EXISTS swap_requests (
        id SERIAL PRIMARY KEY,
        shift_id INTEGER NOT NULL REFERENCES shifts(id),
        requester_id INTEGER NOT NULL REFERENCES employees(id),
        target_id INTEGER REFERENCES employees(id),
        status TEXT DEFAULT 'open',
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      );

      -- Push Notification Subscriptions
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        subscription TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Stations (staffed areas/activities)
      CREATE TABLE IF NOT EXISTS stations (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        name TEXT NOT NULL,
        description TEXT,
        open_time TEXT DEFAULT '09:00',
        close_time TEXT DEFAULT '17:00',
        arrive_early_minutes INTEGER DEFAULT 15,
        staff_needed INTEGER DEFAULT 5,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(business_id, name)
      );

      -- Employee Station Skills (which stations an employee is trained for)
      CREATE TABLE IF NOT EXISTS employee_stations (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
        skill_level TEXT DEFAULT 'trained',
        preferred BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(employee_id, station_id)
      );

      -- Sessions (auth tokens)
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Time Tracking tables (separated from main schema to safely handle
    //    pre-existing tables from the earlier QR badge commit e52923b) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        shift_id INTEGER REFERENCES shifts(id),
        station_id INTEGER REFERENCES stations(id),
        kiosk_id INTEGER,
        clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        clock_out TIMESTAMPTZ,
        clock_in_method VARCHAR(20) DEFAULT 'manual',
        edited_by INTEGER REFERENCES employees(id),
        edited_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Ensure columns exist even if table predates this commit
    await client.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS kiosk_id INTEGER`).catch(() => {});
    await client.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_in_method VARCHAR(20) DEFAULT 'manual'`).catch(() => {});
    await client.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS edited_by INTEGER REFERENCES employees(id)`).catch(() => {});
    await client.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ`).catch(() => {});
    await client.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => {});
    await client.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS client_punch_id TEXT`).catch(() => {});

    // Indexes — run AFTER column migration so referenced columns always exist
    await client.query(`CREATE INDEX IF NOT EXISTS idx_time_entries_business_date ON time_entries (business_id, clock_in)`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_time_entries_employee_open ON time_entries (employee_id, clock_out)`).catch(() => {});
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_client_punch
        ON time_entries (employee_id, client_punch_id)
        WHERE client_punch_id IS NOT NULL
    `).catch(() => {});

    await client.query(`
      CREATE TABLE IF NOT EXISTS kiosks (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        station_id INTEGER REFERENCES stations(id),
        device_name VARCHAR(100) NOT NULL,
        pin_code VARCHAR(10),
        is_active BOOLEAN DEFAULT true,
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Add staff_needed column if it doesn't exist (table may predate this column)
    await client.query(`
      ALTER TABLE stations ADD COLUMN IF NOT EXISTS staff_needed INTEGER DEFAULT 5
    `).catch(() => {});

    // Add decline_reason column to shifts (for tracking why employees declined)
    await client.query(`
      ALTER TABLE shifts ADD COLUMN IF NOT EXISTS decline_reason TEXT
    `).catch(() => {});

    // Add rank column to employee_stations for preference ordering
    await client.query(`
      ALTER TABLE employee_stations ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT 0
    `).catch(() => {});

    // Migration: add icon column to stations (emoji per station)
    await client.query(`ALTER TABLE stations ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT NULL`).catch(() => {});

    // Backfill station icons from name keywords
    const STATION_ICON_MAP = {
      'admission': '🎟️', 'ticket': '🎟️', 'gate': '🎟️',
      'tulip': '🌷', 'flower': '🌸',
      'animal': '🐣', 'petting': '🐣', 'goat': '🐐',
      'bottle': '🍼', 'feeding': '🍼',
      'corn pool': '🌽', 'corn maze': '🌽',
      'jumping': '🤸', 'pillow': '🤸', 'bounce': '🤸',
      'slide': '🛝',
      'train': '🚂', 'express': '🚂',
      'beeline': '🐝', 'honey': '🐝', 'zip': '🐝',
      'hayride': '🚜', 'tractor': '🚜',
      'bake': '🧁', 'bakery': '🧁', 'donut': '🧁',
      'store': '🏪', 'country store': '🏪', 'retail': '🏪', 'gift': '🏪',
      'cafe': '☕', 'coffee': '☕',
      'lemonade': '🍋', 'slush': '🍋',
      'strawberry': '🍓',
      'apple': '🍎', 'orchard': '🍎',
      'pumpkin': '🎃',
      'parking': '🅿️', 'shuttle': '🅿️',
      'grounds': '🔧', 'maint': '🔧', 'repair': '🔧',
      'float': '🔄', 'general': '🔄',
      'food': '🍔', 'kitchen': '🍔', 'grill': '🍔',
      'sunflower': '🌻',
      'slingshot': '🎯',
      'pedal': '🚗', 'go-cart': '🚗', 'cart': '🚗',
    };
    try {
      const { rows: unIconed } = await client.query(
        `SELECT id, name FROM stations WHERE icon IS NULL`
      );
      for (const st of unIconed) {
        const lower = st.name.toLowerCase();
        let icon = '📋';
        for (const [keyword, emoji] of Object.entries(STATION_ICON_MAP)) {
          if (lower.includes(keyword)) { icon = emoji; break; }
        }
        await client.query('UPDATE stations SET icon = $1 WHERE id = $2', [icon, st.id]);
      }
      if (unIconed.length > 0) console.log(`Backfilled icons for ${unIconed.length} stations`);
    } catch (e) { console.log('Station icon backfill note:', e.message); }

    console.log('Database schema initialized');

    // Migration: add min_staff / max_staff columns to stations
    try {
      await client.query('ALTER TABLE stations ADD COLUMN IF NOT EXISTS min_staff INTEGER DEFAULT 1');
      await client.query('ALTER TABLE stations ADD COLUMN IF NOT EXISTS max_staff INTEGER DEFAULT NULL');
      // Backfill: set max_staff from staff_needed where not yet set
      await client.query('UPDATE stations SET max_staff = staff_needed WHERE max_staff IS NULL AND staff_needed IS NOT NULL');
      // Backfill: set min_staff to roughly half of max_staff where still default
      await client.query('UPDATE stations SET min_staff = GREATEST(1, ROUND(max_staff * 0.5)) WHERE min_staff = 1 AND max_staff > 2');
    } catch (e) { console.log('min/max staff migration note:', e.message); }

    // Migration: per-station rating on employee_stations
    try {
      await client.query('ALTER TABLE employee_stations ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT NULL');
    } catch (e) { console.log('station rating col note:', e.message); }

    // Migration: add rating column to employees
    try {
      await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT NULL');
    } catch (e) { /* column may already exist */ }

    // Migration: station categories & category ratings
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS station_categories (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL REFERENCES businesses(id),
          name TEXT NOT NULL,
          icon TEXT DEFAULT '📋',
          sort_order INTEGER DEFAULT 0,
          UNIQUE(business_id, name)
        )
      `);
      await client.query(`
        ALTER TABLE stations ADD COLUMN IF NOT EXISTS category_id INTEGER
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS employee_category_ratings (
          id SERIAL PRIMARY KEY,
          employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          category_id INTEGER NOT NULL REFERENCES station_categories(id) ON DELETE CASCADE,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(employee_id, category_id)
        )
      `);
      console.log('Category tables ready');
    } catch (catTableErr) {
      console.log('Category tables migration note:', catTableErr.message);
    }

    // Seed default station categories for each business that doesn't have any
    try {
      const { rows: businesses } = await client.query('SELECT id FROM businesses');
      for (const biz of businesses) {
        const { rows: existing } = await client.query(
          'SELECT id FROM station_categories WHERE business_id = $1 LIMIT 1', [biz.id]
        );
        if (existing.length === 0) {
          const cats = [
            ['Guest Services', '🎟️', 1],
            ['Food & Beverage', '🍕', 2],
            ['Attractions & Activities', '🎢', 3],
            ['Agriculture & Outdoors', '🌾', 4],
            ['Facilities & Operations', '🔧', 5],
          ];
          for (const [name, icon, order] of cats) {
            await client.query(
              'INSERT INTO station_categories (business_id, name, icon, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, name) DO NOTHING',
              [biz.id, name, icon, order]
            );
          }

          // Auto-assign stations to categories
          const catMap = {
            'Guest Services': ['Admission', 'Ticketing', 'Country Store', 'Gift Shop', 'Parking', 'Shuttle', 'Admission/Front Gate'],
            'Food & Beverage': ['Food Stand', 'Bakery', 'Apple Goods', 'Cider Press', 'Taproom', 'Pie Barn'],
            'Attractions & Activities': ['Corn Maze', 'Hayride', 'Jumping Pillow', 'Super Slide', 'Train Ride', 'Apple Slingshot', 'Corn Pool', 'Pedal Tractors', 'Go-Carts', 'Playground'],
            'Agriculture & Outdoors': ['Apple Picking', 'Pumpkin Patch', 'Sunflower', 'Nature Trail', 'Farm Animals', 'Petting Zoo'],
            'Facilities & Operations': ['Potty Barn', 'Fire Pit', 'Storybook', 'Schoolhouse'],
          };
          const { rows: catRows } = await client.query(
            'SELECT id, name FROM station_categories WHERE business_id = $1', [biz.id]
          );
          const { rows: stationRows } = await client.query(
            'SELECT id, name FROM stations WHERE business_id = $1', [biz.id]
          );
          for (const cat of catRows) {
            const keywords = catMap[cat.name] || [];
            for (const station of stationRows) {
              if (keywords.some(kw => station.name.toLowerCase().includes(kw.toLowerCase()))) {
                await client.query(
                  'UPDATE stations SET category_id = $1 WHERE id = $2 AND category_id IS NULL',
                  [cat.id, station.id]
                );
              }
            }
          }
          console.log('Seeded categories for business', biz.id);
        }
      }
    } catch (catErr) {
      console.log('Category seed skipped:', catErr.message);
    }

    // One-time migration: update staff_needed for stations that still have default=5
    // This fixes stations imported before the staff_needed column had proper estimates
    try {
      const staffDefaults = [
        ['Admission / Ticketing', 15], ['Country Store', 12], ['Apple Picking', 20],
        ['Pumpkin Patch', 15], ['Corn Maze', 10], ['Hayride / Tractor Ride', 12],
        ['Food Stand', 25], ['Apple Goods / Bakery', 15], ['Jumping Pillow', 8],
        ['Super Slide', 8], ['Farm Animals / Petting Zoo', 12], ['Pedal Tractors / Go-Carts', 10],
        ['Train Ride', 8], ['Apple Slingshot', 6], ['Corn Pool', 8],
        ['Sunflower Meadow', 6], ['Storybook Land', 6], ['Schoolhouse', 4],
        ['Fire Pit Area', 8], ['Parking / Shuttle', 20], ['Potty Barn Attendant', 4]
      ];
      for (const [name, needed] of staffDefaults) {
        if (needed !== 5) {
          await client.query(
            'UPDATE stations SET staff_needed = $1 WHERE name = $2 AND staff_needed = 5',
            [needed, name]
          );
        }
      }
      console.log('Staff defaults migration complete');
    } catch (migErr) {
      console.log('Staff defaults migration skipped:', migErr.message);
    }

    // Migration: add time_blocks column to availability for split-shift support
    await client.query(`
      ALTER TABLE availability ADD COLUMN IF NOT EXISTS time_blocks TEXT DEFAULT NULL
    `).catch(() => {});

    // Backfill: ensure every active employee has a 3-star rating in every category
    try {
      const { rows: businesses } = await client.query('SELECT id FROM businesses');
      for (const biz of businesses) {
        const { rows: cats } = await client.query(
          'SELECT id FROM station_categories WHERE business_id = $1', [biz.id]
        );
        const { rows: emps } = await client.query(
          'SELECT id FROM employees WHERE business_id = $1 AND active = true', [biz.id]
        );
        if (cats.length > 0 && emps.length > 0) {
          let inserted = 0;
          for (const emp of emps) {
            for (const cat of cats) {
              const res = await client.query(
                'INSERT INTO employee_category_ratings (employee_id, category_id, rating) VALUES ($1, $2, 3) ON CONFLICT (employee_id, category_id) DO NOTHING',
                [emp.id, cat.id]
              );
              inserted += res.rowCount;
            }
          }
          if (inserted > 0) console.log(`Backfilled ${inserted} rating rows (3-star default) for business ${biz.id}`);
        }
      }
    } catch (ratingErr) {
      console.log('Rating backfill skipped:', ratingErr.message);
    }
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
