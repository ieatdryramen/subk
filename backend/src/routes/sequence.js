const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

const TOUCHPOINTS = [
  { key: 'email1', label: 'Email 1', day: 'Day 1' },
  { key: 'email2', label: 'Email 2', day: 'Day 3' },
  { key: 'linkedin_connect', label: 'LinkedIn Connect', day: 'Day 3' },
  { key: 'email3', label: 'Email 3', day: 'Day 7' },
  { key: 'call', label: 'Call Attempt', day: 'Day 7' },
  { key: 'linkedin_dm', label: 'LinkedIn DM', day: 'Day 10' },
  { key: 'email4', label: 'Email 4', day: 'Day 14' },
];

// Get sequence for a lead
router.get('/:leadId', auth, async (req, res) => {
  try {
    const events = await pool.query(
      'SELECT * FROM sequence_events WHERE lead_id=$1 ORDER BY created_at ASC',
      [req.params.leadId]
    );
    // Return all touchpoints with their status
    const eventMap = {};
    events.rows.forEach(e => { eventMap[e.touchpoint] = e; });
    
    const sequence = TOUCHPOINTS.map(tp => ({
      ...tp,
      status: eventMap[tp.key]?.status || 'pending',
      notes: eventMap[tp.key]?.notes || '',
      completed_at: eventMap[tp.key]?.completed_at || null,
      event_id: eventMap[tp.key]?.id || null,
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

    // Update lead's sequence stage
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
