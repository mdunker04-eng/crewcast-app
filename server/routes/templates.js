// ═══════════════════════════════════════════════════════
// CrewCast — Message Templates Routes
// ═══════════════════════════════════════════════════════

const express = require('express');
const { pool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

// Auto-extract {{variable}} names from a body
function extractVars(body) {
  const set = new Set();
  String(body || '').replace(/\{\{(\w+)\}\}/g, (_, k) => { set.add(k); return ''; });
  return Array.from(set);
}

// GET /api/message-templates
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, body, variables, created_at FROM message_templates
       WHERE business_id = $1 ORDER BY name`,
      [req.user.businessId]
    );
    res.json({ templates: rows });
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// POST /api/message-templates
router.post('/', async (req, res) => {
  try {
    const { name, body } = req.body;
    if (!name || !body) return res.status(400).json({ error: 'Name and body required' });
    const variables = extractVars(body);
    const { rows } = await pool.query(
      `INSERT INTO message_templates (business_id, name, body, variables)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, body, variables`,
      [req.user.businessId, name, body, JSON.stringify(variables)]
    );
    res.json({ template: rows[0] });
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/message-templates/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, body } = req.body;
    const variables = body != null ? JSON.stringify(extractVars(body)) : null;
    const { rows } = await pool.query(
      `UPDATE message_templates
       SET name = COALESCE($1, name),
           body = COALESCE($2, body),
           variables = COALESCE($3::jsonb, variables)
       WHERE id = $4 AND business_id = $5
       RETURNING id, name, body, variables`,
      [name, body, variables, req.params.id, req.user.businessId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ template: rows[0] });
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/message-templates/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM message_templates WHERE id = $1 AND business_id = $2`,
      [req.params.id, req.user.businessId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

module.exports = router;
