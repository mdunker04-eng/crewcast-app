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
    // ── Time Tracking tables ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS time_entries (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        shift_id INTEGER REFERENCES shifts(id),
        station_id INTEGER REFERENCES stations(id),
        kiosk_id INTEGER,
        pay_role_id INTEGER,
        clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        clock_out TIMESTAMPTZ,
        clock_in_method VARCHAR(20) DEFAULT 'manual',
        tip_cash DECIMAL(10,2) DEFAULT 0,
        tip_card DECIMAL(10,2) DEFAULT 0,
        break_start TIMESTAMPTZ,
        break_end TIMESTAMPTZ,
        break_minutes INTEGER DEFAULT 0,
        edited_by INTEGER REFERENCES employees(id),
        edited_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS kiosks (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        station_id INTEGER REFERENCES stations(id),
        device_name VARCHAR(100) NOT NULL,
        pin_code VARCHAR(10),
        is_active BOOLEAN DEFAULT true,
        last_seen TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Pay Roles (restaurant: server, bartender, host, cook, etc.) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS pay_roles (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        name VARCHAR(100) NOT NULL,
        base_rate DECIMAL(10,2) NOT NULL,
        is_tipped BOOLEAN DEFAULT false,
        overtime_eligible BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(business_id, name)
      );
    `);

    // ── Tip Pool Rules ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS tip_pool_rules (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        name VARCHAR(100) NOT NULL,
        pool_percentage DECIMAL(5,2) DEFAULT 100,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS tip_pool_shares (
        id SERIAL PRIMARY KEY,
        rule_id INTEGER NOT NULL REFERENCES tip_pool_rules(id) ON DELETE CASCADE,
        pay_role_id INTEGER NOT NULL REFERENCES pay_roles(id),
        share_percentage DECIMAL(5,2) NOT NULL,
        UNIQUE(rule_id, pay_role_id)
      );
    `);

    // ── Break Compliance Config ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS break_rules (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL REFERENCES businesses(id),
        state_code VARCHAR(2) NOT NULL DEFAULT 'US',
        hours_before_break DECIMAL(4,2) DEFAULT 6,
        break_duration_minutes INTEGER DEFAULT 30,
        is_paid BOOLEAN DEFAULT false,
        active BOOLEAN DEFAULT true,
        UNIQUE(business_id, state_code)
      );
    `);

    // Migration: add restaurant columns to time_entries
    try {
      await client.query('ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS pay_role_id INTEGER');
      await client.query('ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS tip_cash DECIMAL(10,2) DEFAULT 0');
      await client.query('ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS tip_card DECIMAL(10,2) DEFAULT 0');
      await client.query('ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS break_start TIMESTAMPTZ');
      await client.query('ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS break_end TIMESTAMPTZ');
      await client.query('ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0');
    } catch (e) { /* columns may already exist */ }

    // Migration: add pay_role_id to employees (default role for scheduling)
    try {
      await client.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS default_pay_role_id INTEGER');
    } catch (e) { /* column may already exist */ }

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
            ['Front of House', '🍽️', 1],
            ['Back of House', '🔪', 2],
            ['Bar', '🍸', 3],
            ['Management', '📋', 4],
          ];
          for (const [name, icon, order] of cats) {
            await client.query(
              'INSERT INTO station_categories (business_id, name, icon, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (business_id, name) DO NOTHING',
              [biz.id, name, icon, order]
            );
          }

          // Auto-assign stations to categories
          const catMap = {
            'Front of House': ['Host', 'Greeter', 'Server', 'Busser', 'Food Runner', 'Takeout', 'Delivery', 'Cashier'],
            'Back of House': ['Grill', 'Sauté', 'Prep Cook', 'Fry Station', 'Expo', 'Plating', 'Dishwasher', 'Line Cook'],
            'Bar': ['Bartender', 'Barback', 'Bar'],
            'Management': ['Manager', 'Shift Lead', 'Floor Manager', 'Kitchen Manager'],
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
        ['Host / Greeter', 2], ['Server Section A', 4], ['Server Section B', 4],
        ['Server Section C', 3], ['Busser', 3], ['Bartender', 3],
        ['Barback', 2], ['Grill / Sauté', 3], ['Prep Cook', 3],
        ['Fry Station', 2], ['Expo / Plating', 2], ['Dishwasher', 2],
        ['Takeout / Delivery', 2]
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
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
