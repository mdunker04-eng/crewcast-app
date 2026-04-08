// ═══════════════════════════════════════════════════════
// CrewCast — Auto-Seed
// Creates default business + admin if DB is empty
// Runs automatically on server startup
// ═══════════════════════════════════════════════════════

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

async function seed() {
  // Only seed if no businesses exist yet
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM businesses');
  if (parseInt(rows[0].count) > 0) {
    console.log('Database already has data — skipping seed');
    return;
  }

  console.log('Empty database detected — seeding default business...');

  // Use environment variables if set, otherwise fall back to Steve's defaults
  const businessName = process.env.SEED_BUSINESS_NAME || 'Demo Restaurant';
  const slug = process.env.SEED_BUSINESS_SLUG || 'demo-restaurant';
  const ownerName = process.env.SEED_OWNER_NAME || 'Owner';
  const ownerPhone = process.env.SEED_OWNER_PHONE || '(555) 000-0000';
  const pin = process.env.SEED_ADMIN_PIN || '1234';

  // Create business
  const { rows: bizRows } = await pool.query(`
    INSERT INTO businesses (name, slug, owner_name, owner_phone)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [businessName, slug, ownerName, ownerPhone]);

  const businessId = bizRows[0].id;

  // Create admin employee
  const pinHash = bcrypt.hashSync(pin, 10);
  const inviteToken = crypto.randomBytes(16).toString('hex');
  const [firstName, ...lastParts] = ownerName.split(' ');
  const lastName = lastParts.join(' ') || '';

  await pool.query(`
    INSERT INTO employees (business_id, first_name, last_name, phone, pin_hash, role, invite_token)
    VALUES ($1, $2, $3, $4, $5, 'admin', $6)
  `, [businessId, firstName, lastName, ownerPhone, pinHash, inviteToken]);

  console.log(`Seeded: ${businessName} with admin ${ownerName} (${ownerPhone})`);
}

module.exports = seed;
