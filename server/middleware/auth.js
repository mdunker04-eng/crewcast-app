// ═══════════════════════════════════════════════════════
// CrewCast — Auth Middleware
// ═══════════════════════════════════════════════════════

const db = require('../db');

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const session = db.prepare(`
    SELECT s.*, e.id as emp_id, e.first_name, e.last_name, e.phone,
           e.role, e.business_id, e.active, b.name as business_name, b.slug as business_slug
    FROM sessions s
    JOIN employees e ON s.employee_id = e.id
    JOIN businesses b ON e.business_id = b.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token);

  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  req.user = {
    id: session.emp_id,
    firstName: session.first_name,
    lastName: session.last_name,
    phone: session.phone,
    role: session.role,
    businessId: session.business_id,
    businessName: session.business_name,
    businessSlug: session.business_slug,
    active: session.active,
  };

  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
