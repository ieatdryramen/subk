const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Scoring weights for bid decision criteria (must sum to 100)
const SCORING_WEIGHTS = {
  'strategic_fit': 20,
  'technical_capability': 20,
  'past_performance': 15,
  'pricing_competitiveness': 15,
  'competition_level': 10,
  'timeline_feasibility': 10,
  'resource_availability': 10,
};

/**
 * GET /api/bid-decision
 * List past decisions for org
 */
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const r = await pool.query(
      `SELECT bd.*, u.full_name FROM bid_decisions bd
       LEFT JOIN users u ON bd.user_id = u.id
       WHERE bd.org_id=$1
       ORDER BY bd.created_at DESC`,
      [orgId]
    );

    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('GET /bid-decision error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/bid-decision/:id
 * Get decision details
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const r = await pool.query(
      `SELECT * FROM bid_decisions WHERE id=$1 AND org_id=$2`,
      [id, orgId]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Decision not found' });
    }

    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('GET /bid-decision/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/bid-decision
 * Create a new decision
 */
router.post('/', auth, async (req, res) => {
  try {
    const { opportunity_id, title, rationale } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Initialize criteria with default scores or use provided criteria
    const criteria = req.body.criteria || {
      strategic_fit: 3,
      technical_capability: 3,
      past_performance: 3,
      pricing_competitiveness: 3,
      competition_level: 3,
      timeline_feasibility: 3,
      resource_availability: 3,
    };

    // Calculate total score
    let totalScore = 0;
    for (const [key, weight] of Object.entries(SCORING_WEIGHTS)) {
      totalScore += ((criteria[key] || 3) / 5) * weight;
    }
    totalScore = Math.round(totalScore);

    // Determine recommendation
    const recommendation = totalScore > 70 ? 'bid' : totalScore >= 50 ? 'consider' : 'no_bid';

    const result = await pool.query(
      `INSERT INTO bid_decisions
       (org_id, user_id, opportunity_id, title, criteria, total_score, recommendation, rationale)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [orgId, req.userId, opportunity_id || null, title, JSON.stringify(criteria), totalScore, recommendation, rationale || '']
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /bid-decision error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/bid-decision/:id
 * Update decision
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { criteria, rationale, decision, decision_date } = req.body;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Verify ownership
    const decisionR = await pool.query(
      `SELECT id FROM bid_decisions WHERE id=$1 AND org_id=$2`,
      [id, orgId]
    );

    if (decisionR.rows.length === 0) {
      return res.status(404).json({ error: 'Decision not found' });
    }

    // Calculate score and recommendation if criteria provided
    let totalScore = null;
    let recommendation = null;

    if (criteria) {
      totalScore = calculateWeightedScore(criteria);
      recommendation = getRecommendation(totalScore);
    }

    const result = await pool.query(
      `UPDATE bid_decisions
       SET criteria=$1, total_score=$2, recommendation=$3, rationale=$4, decision=$5, decision_date=$6, updated_at=NOW()
       WHERE id=$7 AND org_id=$8
       RETURNING *`,
      [
        JSON.stringify(criteria || {}),
        totalScore,
        recommendation,
        rationale,
        decision,
        decision_date,
        id,
        orgId,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT /bid-decision/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/bid-decision/score
 * Calculate weighted score (no ID required — stateless calculation)
 */
router.post('/score', auth, async (req, res) => {
  try {
    const { criteria } = req.body;

    if (!criteria) {
      return res.status(400).json({ error: 'Criteria object is required' });
    }

    for (const [key, value] of Object.entries(criteria)) {
      if (typeof value !== 'number' || value < 1 || value > 5) {
        return res.status(400).json({ error: `${key} must be a number between 1 and 5` });
      }
    }

    const totalScore = calculateWeightedScore(criteria);
    const recommendation = getRecommendation(totalScore);

    const breakdown = {};
    for (const [criterion, score] of Object.entries(criteria)) {
      const weight = SCORING_WEIGHTS[criterion] || 0;
      breakdown[criterion] = { score, weight, weighted_points: (score / 5) * weight };
    }

    res.json({
      success: true,
      data: { total_score: totalScore, recommendation, breakdown, criteria },
    });
  } catch (err) {
    console.error('POST /bid-decision/score error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/bid-decision/:id/score
 * Calculate weighted score for a specific bid decision
 */
router.post('/:id/score', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { criteria } = req.body;

    if (!criteria) {
      return res.status(400).json({ error: 'Criteria object is required' });
    }

    // Validate that all criteria are 1-5
    for (const [key, value] of Object.entries(criteria)) {
      if (typeof value !== 'number' || value < 1 || value > 5) {
        return res.status(400).json({ error: `${key} must be a number between 1 and 5` });
      }
    }

    const totalScore = calculateWeightedScore(criteria);
    const recommendation = getRecommendation(totalScore);

    // Return scoring breakdown
    const breakdown = {};
    for (const [criterion, score] of Object.entries(criteria)) {
      const weight = SCORING_WEIGHTS[criterion] || 0;
      breakdown[criterion] = {
        score,
        weight,
        weighted_points: (score / 5) * weight,
      };
    }

    res.json({
      success: true,
      data: {
        total_score: totalScore,
        recommendation,
        breakdown,
        criteria,
      },
    });
  } catch (err) {
    console.error('POST /bid-decision/:id/score error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Helper: Calculate weighted score
 * Score is percentage (0-100) based on criteria weights
 */
function calculateWeightedScore(criteria) {
  let totalWeightedPoints = 0;
  let totalWeight = 0;

  for (const [criterion, score] of Object.entries(criteria)) {
    const weight = SCORING_WEIGHTS[criterion];
    if (weight) {
      totalWeightedPoints += (score / 5) * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((totalWeightedPoints / totalWeight) * 100);
}

/**
 * Helper: Get recommendation based on score
 * >70% = Bid, 50-70% = Consider, <50% = No-Bid
 */
function getRecommendation(score) {
  if (score > 70) return 'Bid';
  if (score >= 50) return 'Consider';
  return 'No-Bid';
}

module.exports = router;
