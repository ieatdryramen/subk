const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Gate criteria by phase
const GATE_CRITERIA = {
  'lead': ['Funded?', 'Matches capabilities?', 'Worth pursuing?'],
  'qualify': ['Customer access?', 'Past performance?', 'Know incumbent?'],
  'capture': ['Solution defined?', 'Team identified?', 'Price competitive?'],
  'proposal': ['Compliant?', 'Reviewed?', 'Competitive?'],
  'submit': [],
  'award': [],
};

const PHASES = ['lead', 'qualify', 'capture', 'proposal', 'submit', 'award'];

/**
 * GET /api/capture
 * List all capture items for organization
 */
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const r = await pool.query(
      'SELECT * FROM capture_items WHERE org_id=$1 ORDER BY phase ASC, created_at DESC',
      [orgId]
    );

    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('GET /capture error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/capture
 * Create a new capture item
 */
router.post('/', auth, async (req, res) => {
  try {
    const { title, opportunity_id, phase = 'lead', pwin = 10, notes } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Initialize gate criteria based on phase
    const gateCriteria = GATE_CRITERIA[phase] || [];

    const result = await pool.query(
      `INSERT INTO capture_items
       (org_id, user_id, opportunity_id, title, phase, pwin, gate_criteria, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [orgId, req.userId, opportunity_id || null, title, phase, pwin, JSON.stringify(gateCriteria), notes]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /capture error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/capture/stats
 * Pipeline stats by phase (must be before /:id to avoid matching "stats" as an ID)
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const r = await pool.query(
      `SELECT
        phase,
        COUNT(*) as count,
        AVG(pwin) as avg_pwin,
        SUM(COALESCE((CASE WHEN go_no_go='go' THEN 1 ELSE 0 END), 0)) as go_count
       FROM capture_items
       WHERE org_id=$1
       GROUP BY phase
       ORDER BY ARRAY_POSITION(ARRAY['lead', 'qualify', 'capture', 'proposal', 'submit', 'award'], phase)`,
      [orgId]
    );

    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('GET /capture/stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/capture/:id
 * Get capture item details
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const r = await pool.query(
      'SELECT * FROM capture_items WHERE id=$1 AND org_id=$2',
      [req.params.id, orgId]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Capture item not found' });
    }

    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('GET /capture/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/capture/:id
 * Update capture item (phase, pwin, gate_criteria, milestones, notes)
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { phase, pwin, gate_criteria, milestones, notes, go_no_go } = req.body;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Verify ownership
    const checkR = await pool.query(
      'SELECT * FROM capture_items WHERE id=$1 AND org_id=$2',
      [req.params.id, orgId]
    );

    if (checkR.rows.length === 0) {
      return res.status(404).json({ error: 'Capture item not found' });
    }

    const current = checkR.rows[0];

    const result = await pool.query(
      `UPDATE capture_items
       SET phase=$1, pwin=$2, gate_criteria=$3, milestones=$4, notes=$5, go_no_go=$6, updated_at=NOW()
       WHERE id=$7 AND org_id=$8
       RETURNING *`,
      [
        phase !== undefined ? phase : current.phase,
        pwin !== undefined ? pwin : current.pwin,
        gate_criteria !== undefined ? JSON.stringify(gate_criteria) : current.gate_criteria,
        milestones !== undefined ? JSON.stringify(milestones) : current.milestones,
        notes !== undefined ? notes : current.notes,
        go_no_go !== undefined ? go_no_go : current.go_no_go,
        req.params.id,
        orgId,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT /capture/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/capture/:id/gate-review
 * Run gate review - check criteria and update phase if ready
 */
router.put('/:id/gate-review', auth, async (req, res) => {
  try {
    const { criteria_met } = req.body;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Get current capture item
    const checkR = await pool.query(
      'SELECT * FROM capture_items WHERE id=$1 AND org_id=$2',
      [req.params.id, orgId]
    );

    if (checkR.rows.length === 0) {
      return res.status(404).json({ error: 'Capture item not found' });
    }

    const current = checkR.rows[0];
    let newPhase = current.phase;
    let gatePass = false;

    // If criteria_met is true and we have criteria, advance to next phase
    if (criteria_met === true && current.phase !== 'award') {
      const currentPhaseIndex = PHASES.indexOf(current.phase);
      if (currentPhaseIndex < PHASES.length - 1) {
        newPhase = PHASES[currentPhaseIndex + 1];
        gatePass = true;
      }
    }

    const result = await pool.query(
      `UPDATE capture_items
       SET phase=$1, go_no_go=$2, updated_at=NOW()
       WHERE id=$3 AND org_id=$4
       RETURNING *`,
      [newPhase, gatePass ? 'go' : 'pending', req.params.id, orgId]
    );

    res.json({
      success: true,
      data: result.rows[0],
      gatePass,
      newPhase,
    });
  } catch (err) {
    console.error('PUT /capture/:id/gate-review error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/capture/:id
 * Delete capture item
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const result = await pool.query(
      'DELETE FROM capture_items WHERE id=$1 AND org_id=$2 RETURNING *',
      [req.params.id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Capture item not found' });
    }

    res.json({ success: true, message: 'Capture item deleted' });
  } catch (err) {
    console.error('DELETE /capture/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/capture/stats
 * Get pipeline stats by phase
 */
module.exports = router;
