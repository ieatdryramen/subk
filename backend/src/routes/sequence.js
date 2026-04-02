const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

const DEFAULT_TOUCHPOINTS = [
  { key: 'email1', label: 'Email 1', day: 'Day 1', type: 'email' },
  { key: 'email2', label: 'Email 2', day: 'Day 3', type: 'email' },
  { key: 'linkedin_connect', label: 'LinkedIn Connect', day: 'Day 3', type: 'linkedin' },
  { key: 'email3', label: 'Email 3', day: 'Day 7', type: 'email' },
  { key: 'call', label: 'Call Attempt', day: 'Day 7', type: 'call' },
  { key: 'linkedin_dm', label: 'LinkedIn DM', day: 'Day 10', type: 'linkedin' },
  { key: 'email4', label: 'Email 4', day: 'Day 14', type: 'email' },
];

// Get org's touchpoint config (or defaults)
const getOrgTouchpoints = async (orgId) => {
  if (!orgId) return DEFAULT_TOUCHPOINTS;
  const r = await pool.query('SELECT config FROM org_sequence_config WHERE org_id=$1', [orgId]);
  if (r.rows.length && r.rows[0].config) return r.rows[0].config;
  return DEFAULT_TOUCHPOINTS;
};

// GET /sequence/config — get org's sequence order
router.get('/config', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const tps = await getOrgTouchpoints(orgId);
    res.json(tps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /sequence/config — save org's sequence order
router.put('/config', auth, async (req, res) => {
  const { config } = req.body;
  if (!Array.isArray(config)) return res.status(400).json({ error: 'config must be array' });
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    if (!orgId) return res.status(400).json({ error: 'No org found' });
    await pool.query(
      `INSERT INTO org_sequence_config (org_id, config) VALUES ($1,$2)
       ON CONFLICT (org_id) DO UPDATE SET config=$2, updated_at=NOW()`,
      [orgId, JSON.stringify(config)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sequence for a lead
router.get('/:leadId', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const TOUCHPOINTS = await getOrgTouchpoints(orgId);

    const events = await pool.query(
      'SELECT * FROM sequence_events WHERE lead_id=$1 ORDER BY created_at ASC',
      [req.params.leadId]
    );
    const eventMap = {};
    events.rows.forEach(e => { eventMap[e.touchpoint] = e; });

    const sequence = TOUCHPOINTS.map(tp => ({
      ...tp,
      status: eventMap[tp.key]?.status || 'pending',
      notes: eventMap[tp.key]?.notes || '',
      completed_at: eventMap[tp.key]?.completed_at || null,
      event_id: eventMap[tp.key]?.id || null,
      opened_at: eventMap[tp.key]?.opened_at || null,
      clicked_at: eventMap[tp.key]?.clicked_at || null,
    }));
    res.json(sequence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a touchpoint
router.post('/:leadId/touch', auth, async (req, res) => {
  const { touchpoint, status, notes } = req.body;
  try {
    const existing = await pool.query(
      'SELECT id FROM sequence_events WHERE lead_id=$1 AND touchpoint=$2',
      [req.params.leadId, touchpoint]
    );

    let result;
    if (existing.rows.length) {
      result = await pool.query(
        `UPDATE sequence_events SET status=$1, notes=$2, completed_at=$3 WHERE id=$4 RETURNING *`,
        [status, notes, status === 'done' ? new Date() : null, existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO sequence_events (lead_id, user_id, touchpoint, status, notes, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.params.leadId, req.userId, touchpoint, status, notes, status === 'done' ? new Date() : null]
      );
    }

    const doneCount = await pool.query(
      "SELECT COUNT(*) FROM sequence_events WHERE lead_id=$1 AND status='done'",
      [req.params.leadId]
    );
    const done = parseInt(doneCount.rows[0].count);
    const stage = done === 0 ? 'not_started' : done >= 7 ? 'completed' : `in_progress_${done}`;
    await pool.query('UPDATE leads SET sequence_stage=$1 WHERE id=$2', [stage, req.params.leadId]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Move lead to a specific stage
router.post('/:leadId/stage', auth, async (req, res) => {
  const { stage } = req.body;
  try {
    await pool.query('UPDATE leads SET sequence_stage=$1 WHERE id=$2', [stage, req.params.leadId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
