#!/usr/bin/env node
// ═══════════════════════════════════════════════════════
// CrewCast — Main Server
// PWA backend serving API + static frontend
// ═══════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const path = require('path');
const webpush = require('web-push');
const { initDB } = require('./db');
const seed = require('./seed');

// Permanent VAPID keys — ensures push subscriptions survive redeploys
const DEFAULT_VAPID_PUBLIC = 'BONZz4rX4iCg2OvUmvQU7qTSdZaxyMDqZhxOlCu0e8JwJ8hE4ma0-WphOC3gg3RwJOXRCXIwbR5dDIu7LrcGU78';
const DEFAULT_VAPID_PRIVATE = 'Min6NokXaAq1Qnt8cha_lpmPG3dwpQ65b8NhG_FAuQA';
if (!process.env.VAPID_PUBLIC_KEY) process.env.VAPID_PUBLIC_KEY = DEFAULT_VAPID_PUBLIC;
if (!process.env.VAPID_PRIVATE_KEY) process.env.VAPID_PRIVATE_KEY = DEFAULT_VAPID_PRIVATE;

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// ── API Routes ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/swaps', require('./routes/swaps'));
app.use('/api/push', require('./routes/push'));
app.use('/api/stations', require('./routes/stations'));
app.use('/api/time', require('./routes/time'));
app.use('/api/sms', require('./routes/sms'));

// ── Demo page ──
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'demo.html'));
});

// ── Invite link handler ──
// Serves the frontend, which reads the invite token from the URL
app.get('/invite/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── SPA fallback ──
// All other routes serve index.html (client-side routing)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Start (async — init DB, seed, then listen) ──
async function start() {
  try {
    // Initialize database schema
    await initDB();
    console.log('Database connected and schema ready');

    // Auto-seed if empty
    await seed();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n══════════════════════════════════════════`);
      console.log(`  CrewCast PWA Server`);
      console.log(`  http://localhost:${PORT}`);
      console.log(`══════════════════════════════════════════\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
