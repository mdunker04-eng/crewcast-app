// ═══════════════════════════════════════════════════════
// CrewCast — Database Setup (SQLite)
// ═══════════════════════════════════════════════════════

const Database = require('better-sqlite3');
const path = require('path');

// Use working directory for DB if the app directory doesn't support WAL
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'crewcast.db');
const db = new Database(DB_PATH);

// Try WAL mode, fall back to DELETE mode
try { db.pragma('journal_mode = WAL'); } catch (e) { db.pragma('journal_mode = DELETE'); }
db.pragma('foreign_keys = ON');

// ── Schema ──
db.exec(`
  -- Businesses (multi-tenant)
  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_name TEXT,
    owner_phone TEXT,
    owner_email TEXT,
    settings TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Employees
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    pin_hash TEXT,
    role TEXT DEFAULT 'employee',
    skills TEXT DEFAULT '{}',
    active INTEGER DEFAULT 1,
    invite_token TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(business_id, phone)
  );

  -- Schedules (a published week/event)
  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL REFERENCES businesses(id),
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Shifts (individual assignments)
  CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id),
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    station TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    responded_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Availability (employee marks which days they can work)
  CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    date TEXT NOT NULL,
    available INTEGER DEFAULT 1,
    start_time TEXT,
    end_time TEXT,
    notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
  );

  -- Swap Requests
  CREATE TABLE IF NOT EXISTS swap_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shift_id INTEGER NOT NULL REFERENCES shifts(id),
    requester_id INTEGER NOT NULL REFERENCES employees(id),
    target_id INTEGER REFERENCES employees(id),
    status TEXT DEFAULT 'open',
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
  );

  -- Push Notification Subscriptions
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    subscription TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Sessions (auth tokens)
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
