const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// GET /api/competitive/intel - Get all competitor intel entries for user's org
router.get('/intel', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ci.*, o.title as opportunity_title
       FROM competitive_intel ci
       LEFT JOIN opportunities o ON ci.opportunity_id = o.id
       WHERE ci.org_id = (SELECT org_id FROM users WHERE id=$1)
       ORDER BY ci.updated_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/competitive/intel - Create new entry
router.post('/intel', auth, async (req, res) => {
  const { competitor_name, opportunity_id, threat_level, notes, strengths, weaknesses, contract_value } = req.body;

  if (!competitor_name?.trim()) {
    return res.status(400).json({ error: 'Competitor name required' });
  }

  try {
    const user = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const org_id = user.rows[0]?.org_id;

    const result = await pool.query(
      `INSERT INTO competitive_intel
       (org_id, user_id, competitor_name, opportunity_id, threat_level, notes, strengths, weaknesses, contract_value, outcome)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [org_id, req.userId, competitor_name.trim(), opportunity_id || null,
       threat_level || 'medium', notes || null, strengths || null, weaknesses || null,
       contract_value || 0]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/competitive/intel/:id - Update entry
router.put('/intel/:id', auth, async (req, res) => {
  const { competitor_name, opportunity_id, threat_level, notes, strengths, weaknesses, contract_value, outcome } = req.body;

  try {
    const result = await pool.query(
      `UPDATE competitive_intel
       SET competitor_name = COALESCE($1, competitor_name),
           opportunity_id = COALESCE($2, opportunity_id),
           threat_level = COALESCE($3, threat_level),
           notes = COALESCE($4, notes),
           strengths = COALESCE($5, strengths),
           weaknesses = COALESCE($6, weaknesses),
           contract_value = COALESCE($7, contract_value),
           outcome = COALESCE($8, outcome),
           updated_at = NOW()
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [competitor_name, opportunity_id, threat_level, notes, strengths, weaknesses, contract_value, outcome, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/competitive/intel/:id - Delete entry
router.delete('/intel/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM competitive_intel WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/competitive/analysis - Get aggregate stats
router.get('/analysis', auth, async (req, res) => {
  try {
    const orgIdResult = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const org_id = orgIdResult.rows[0]?.org_id;

    if (!org_id) {
      return res.json({
        total_competitors: 0,
        high_threat_count: 0,
        win_rate: 0,
        top_competitor: null,
        competitor_list: []
      });
    }

    // Total unique competitors
    const totalResult = await pool.query(
      `SELECT COUNT(DISTINCT competitor_name) as count FROM competitive_intel WHERE org_id=$1`,
      [org_id]
    );

    // High threat count
    const threatResult = await pool.query(
      `SELECT COUNT(*) as count FROM competitive_intel WHERE org_id=$1 AND threat_level='high'`,
      [org_id]
    );

    // Win/loss outcomes with outcomes
    const outcomeResult = await pool.query(
      `SELECT outcome, COUNT(*) as count FROM competitive_intel
       WHERE org_id=$1 AND outcome IS NOT NULL AND outcome != 'pending'
       GROUP BY outcome`,
      [org_id]
    );

    let wins = 0, losses = 0;
    outcomeResult.rows.forEach(row => {
      if (row.outcome === 'won') wins = row.count;
      else if (row.outcome === 'lost') losses = row.count;
    });
    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

    // Top competitor by encounter count
    const topResult = await pool.query(
      `SELECT competitor_name, COUNT(*) as count
       FROM competitive_intel
       WHERE org_id=$1
       GROUP BY competitor_name
       ORDER BY count DESC
       LIMIT 1`,
      [org_id]
    );

    // Top 5 competitors for leaderboard
    const leaderboardResult = await pool.query(
      `SELECT competitor_name,
              COUNT(*) as encounter_count,
              SUM(CASE WHEN outcome='won' THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN outcome='lost' THEN 1 ELSE 0 END) as losses
       FROM competitive_intel
       WHERE org_id=$1
       GROUP BY competitor_name
       ORDER BY encounter_count DESC
       LIMIT 5`,
      [org_id]
    );

    res.json({
      total_competitors: parseInt(totalResult.rows[0]?.count) || 0,
      high_threat_count: parseInt(threatResult.rows[0]?.count) || 0,
      win_rate: winRate,
      top_competitor: topResult.rows[0] || null,
      competitor_list: leaderboardResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
