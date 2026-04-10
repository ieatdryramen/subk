const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Standard compliance requirements
const COMPLIANCE_REQUIREMENTS = {
  FAR_DFARS: [
    { key: 'far-clauses', category: 'FAR/DFARS', name: 'FAR Flow-Down Clauses', description: 'Implementation of required FAR clauses in subcontracts' },
    { key: 'dfars-cyber', category: 'FAR/DFARS', name: 'DFARS Cybersecurity Requirements (7012)', description: 'DFARS 252.204-7012 cybersecurity controls' },
    { key: 'eicpac', category: 'FAR/DFARS', name: 'eICPAC Registration', description: 'Electronic Interchange of Cost and Price Analysis' },
  ],
  CMMC: [
    { key: 'cmmc-level1', category: 'CMMC', name: 'CMMC Level 1', description: 'Basic maturity in 14 security practices' },
    { key: 'cmmc-level2', category: 'CMMC', name: 'CMMC Level 2', description: 'Intermediate maturity in 23 security practices' },
    { key: 'cmmc-level3', category: 'CMMC', name: 'CMMC Level 3', description: 'Advanced maturity in 110+ security practices' },
  ],
  CUI: [
    { key: 'cui-controls', category: 'CUI', name: 'CUI Controls (NIST SP 800-171)', description: 'Protection of Controlled Unclassified Information' },
    { key: 'cui-flow-down', category: 'CUI', name: 'CUI Flow-Down Requirements', description: 'Cascade CUI requirements to subcontractors' },
  ],
  A508: [
    { key: 'section-508', category: 'Section 508', name: 'Section 508 Compliance', description: 'Accessibility requirements for information technology' },
  ],
  ITAR: [
    { key: 'itar-registration', category: 'ITAR', name: 'ITAR Registration', description: 'Directorate of Defense Trade Controls (DDTC) registration' },
    { key: 'itar-controls', category: 'ITAR', name: 'ITAR Controls Implementation', description: 'Technical data and defense article controls' },
  ],
  Registrations: [
    { key: 'sam-registration', category: 'Registrations', name: 'SAM.gov Registration', description: 'System for Award Management (SAM.gov) registration' },
    { key: 'cage-code', category: 'Registrations', name: 'CAGE Code Assignment', description: 'Commercial and Government Entity code' },
    { key: 'duns-number', category: 'Registrations', name: 'DUNS Number', description: 'Dun and Bradstreet DUNS number' },
    { key: 'uei', category: 'Registrations', name: 'UEI', description: 'Unique Entity Identifier' },
  ],
};

// Get all compliance status for org
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const r = await pool.query(
      `SELECT * FROM compliance_items WHERE org_id=$1 ORDER BY category ASC, requirement_key ASC`,
      [orgId]
    );

    // Build summary stats
    const items = r.rows;
    const statuses = { pending: 0, in_progress: 0, pass: 0, fail: 0, na: 0 };
    items.forEach(item => {
      if (statuses[item.status] !== undefined) statuses[item.status]++;
    });

    const total = items.length;
    const complete = total > 0 ? Math.round(((statuses.pass + statuses.na) / total) * 100) : 0;

    res.json({
      items,
      stats: { ...statuses, total, complete_percentage: complete }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get standard requirements list
router.get('/requirements', auth, async (req, res) => {
  try {
    const requirements = [];
    Object.entries(COMPLIANCE_REQUIREMENTS).forEach(([, reqs]) => {
      requirements.push(...reqs);
    });
    res.json({ requirements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save/update compliance items
router.post('/', auth, async (req, res) => {
  try {
    const { items } = req.body; // array of {requirement_key, category, status, expiration_date?, notes?}
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Clear existing items for this org
    await pool.query('DELETE FROM compliance_items WHERE org_id=$1', [orgId]);

    // Insert new items
    for (const item of items) {
      await pool.query(
        `INSERT INTO compliance_items (org_id, requirement_key, category, status, expiration_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orgId, item.requirement_key, item.category, item.status || 'pending', item.expiration_date || null, item.notes || null]
      );
    }

    res.status(201).json({ success: true, count: items.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a single compliance item (without deleting existing)
router.post('/item', auth, async (req, res) => {
  try {
    const { key, category, name, description, status, expiration_date, notes } = req.body;
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Upsert: if item with this key already exists, update it; otherwise insert
    const existing = await pool.query(
      'SELECT id FROM compliance_items WHERE org_id=$1 AND requirement_key=$2',
      [orgId, key]
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE compliance_items SET status=$1, expiration_date=$2, notes=$3, updated_at=NOW()
         WHERE id=$4 RETURNING *`,
        [status || 'pending', expiration_date || null, notes || null, existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO compliance_items (org_id, requirement_key, category, status, expiration_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [orgId, key, category, status || 'pending', expiration_date || null, notes || null]
      );
    }

    res.status(201).json({ success: true, item: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a specific compliance item
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, expiration_date, notes } = req.body;
    const itemId = parseInt(req.params.id, 10);

    // Get org_id for user
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const userOrgId = userR.rows[0]?.org_id;

    // Verify ownership
    const itemR = await pool.query('SELECT org_id FROM compliance_items WHERE id=$1', [itemId]);
    if (itemR.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    if (itemR.rows[0].org_id !== userOrgId) return res.status(403).json({ error: 'Unauthorized' });

    const r = await pool.query(
      `UPDATE compliance_items SET status=$1, expiration_date=$2, notes=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [status, expiration_date || null, notes || null, itemId]
    );

    res.json({ item: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
