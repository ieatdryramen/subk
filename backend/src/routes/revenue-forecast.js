const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

/**
 * GET /api/revenue-forecast
 * Get forecast data
 */
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Get capture items weighted by pwin
    const captureR = await pool.query(
      `SELECT title, estimated_value * (pwin::numeric / 100) as weighted_value, pwin, estimated_value
       FROM capture_items
       WHERE org_id=$1 AND estimated_value > 0
       ORDER BY estimated_value DESC`,
      [orgId]
    );

    // Get opportunities with values
    const oppR = await pool.query(
      `SELECT title, value_max, naics_code
       FROM opportunities
       WHERE org_id=$1 AND value_max > 0
       ORDER BY value_max DESC LIMIT 20`,
      [orgId]
    );

    // Get proposals with status
    const propR = await pool.query(
      `SELECT title, estimated_value, status
       FROM proposals
       WHERE org_id=$1 AND estimated_value > 0
       ORDER BY estimated_value DESC LIMIT 20`,
      [orgId]
    );

    // Calculate weighted pipeline
    let weightedPipeline = 0;
    const captures = captureR.rows || [];
    captures.forEach((item) => {
      weightedPipeline += parseFloat(item.weighted_value || 0);
    });

    // Get revenue entries
    const entriesR = await pool.query(
      `SELECT * FROM revenue_entries WHERE org_id=$1 ORDER BY month DESC`,
      [orgId]
    );

    res.json({
      success: true,
      data: {
        weighted_pipeline: Math.round(weightedPipeline),
        captures: captures.slice(0, 10),
        opportunities: oppR.rows,
        proposals: propR.rows,
        revenue_entries: entriesR.rows,
      },
    });
  } catch (err) {
    console.error('GET /revenue-forecast error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/revenue-forecast/scenarios
 * Get best/likely/worst case projections
 */
router.get('/scenarios', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Best case: sum of all pipeline opportunities
    const bestR = await pool.query(
      `SELECT COALESCE(SUM(value_max), 0) as total
       FROM opportunities
       WHERE org_id=$1`,
      [orgId]
    );

    const bestCase = parseInt(bestR.rows[0].total) || 0;

    // Likely case: weighted by pwin from capture items + submitted proposals
    const likelyR = await pool.query(
      `SELECT COALESCE(SUM(estimated_value * (pwin::numeric / 100)), 0) as total
       FROM capture_items
       WHERE org_id=$1`,
      [orgId]
    );

    const likelyCaseCapture = parseInt(likelyR.rows[0].total) || 0;

    // Add submitted/won proposals
    const submittedR = await pool.query(
      `SELECT COALESCE(SUM(estimated_value), 0) as total
       FROM proposals
       WHERE org_id=$1 AND status IN ('submitted', 'won')`,
      [orgId]
    );

    const likelyCase = likelyCaseCapture + parseInt(submittedR.rows[0].total);

    // Worst case: only awarded/won items
    const worstR = await pool.query(
      `SELECT COALESCE(SUM(estimated_value), 0) as total
       FROM proposals
       WHERE org_id=$1 AND status='won'`,
      [orgId]
    );

    const worstCase = parseInt(worstR.rows[0].total) || 0;

    res.json({
      success: true,
      data: {
        best_case: bestCase,
        likely_case: likelyCase,
        worst_case: worstCase,
        scenarios: [
          {
            name: 'Best Case',
            value: bestCase,
            description: 'All opportunities are won',
            color: '#10b981',
          },
          {
            name: 'Likely Case',
            value: likelyCase,
            description: 'Based on probability-weighted capture and submitted proposals',
            color: '#f59e0b',
          },
          {
            name: 'Worst Case',
            value: worstCase,
            description: 'Only confirmed/awarded opportunities',
            color: '#ef4444',
          },
        ],
      },
    });
  } catch (err) {
    console.error('GET /revenue-forecast/scenarios error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/revenue-forecast/manual
 * Add manual revenue entry
 */
router.post('/manual', auth, async (req, res) => {
  try {
    const { title, amount, month, source = 'manual', is_actual = false, notes } = req.body;

    if (!title || !amount || !month) {
      return res.status(400).json({ error: 'Title, amount, and month are required' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const result = await pool.query(
      `INSERT INTO revenue_entries
       (org_id, title, amount, month, source, is_actual, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [orgId, title, amount, month, source, is_actual, notes]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /revenue-forecast/manual error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/revenue-forecast/accuracy
 * Compare past forecasts to actuals
 */
router.get('/accuracy', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Get forecasted vs actual by month
    const r = await pool.query(
      `SELECT
         month,
         SUM(CASE WHEN is_actual=false THEN amount ELSE 0 END) as forecasted,
         SUM(CASE WHEN is_actual=true THEN amount ELSE 0 END) as actual
       FROM revenue_entries
       WHERE org_id=$1
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      [orgId]
    );

    const data = r.rows.map((row) => ({
      month: row.month,
      forecasted: parseInt(row.forecasted) || 0,
      actual: parseInt(row.actual) || 0,
      variance:
        parseInt(row.actual) - parseInt(row.forecasted) || 0,
      accuracy:
        parseInt(row.actual) > 0
          ? Math.round((parseInt(row.actual) / parseInt(row.forecasted)) * 100)
          : null,
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('GET /revenue-forecast/accuracy error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
