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

      -- Sessions (auth tokens)
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES employees(id),
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('Database schema initialized');

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
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
