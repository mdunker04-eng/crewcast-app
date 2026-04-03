#!/usr/bin/env node
// ═══════════════════════════════════════════════════════
// CrewCast — First-Time Setup
// Creates a business and admin account
// ═══════════════════════════════════════════════════════

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function setup() {
  console.log('\n══════════════════════════════════════════');
  console.log('  CrewCast — First-Time Setup');
  console.log('══════════════════════════════════════════\n');

  // Check if any business already exists
  const existing = db.prepare('SELECT COUNT(*) as count FROM businesses').get();
  if (existing.count > 0) {
    console.log('A business already exists. To add another, use the admin dashboard.\n');
    const businesses = db.prepare('SELECT * FROM businesses').all();
    businesses.forEach(b => console.log(`  - ${b.name} (${b.slug})`));
    console.log('');
    rl.close();
    return;
  }

  const businessName = await ask('Business name (e.g. "Center Grove Orchard"): ');
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const ownerName = await ask('Owner/admin name: ');
  const ownerPhone = await ask('Owner/admin phone: ');
  const pin = await ask('Set a 4-6 digit PIN for admin login: ');

  if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    console.log('\nPIN must be 4-6 digits. Please run setup again.\n');
    rl.close();
    return;
  }

  // Create business
  const biz = db.prepare(`
    INSERT INTO businesses (name, slug, owner_name, owner_phone)
    VALUES (?, ?, ?, ?)
  `).run(businessName, slug, ownerName, ownerPhone);

  // Create admin employee
  const pinHash = bcrypt.hashSync(pin, 10);
  const inviteToken = crypto.randomBytes(16).toString('hex');
  const [firstName, ...lastParts] = ownerName.split(' ');
  const lastName = lastParts.join(' ') || '';

  db.prepare(`
    INSERT INTO employees (business_id, first_name, last_name, phone, pin_hash, role, invite_token)
    VALUES (?, ?, ?, ?, ?, 'admin', ?)
  `).run(biz.lastInsertRowid, firstName, lastName, ownerPhone, pinHash, inviteToken);

  console.log('\n Setup complete!\n');
  console.log(`  Business: ${businessName}`);
  console.log(`  Admin: ${ownerName} (${ownerPhone})`);
  console.log(`  Login PIN: ${pin}`);
  console.log(`\n  Start the server: npm start`);
  console.log(`  Then open: http://localhost:${process.env.PORT || 3000}\n`);

  rl.close();
}

setup().catch(err => {
  console.error('Setup failed:', err);
  rl.close();
  process.exit(1);
});
