const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { apiLimiter, aiLimiter } = require('../middleware/rateLimiter');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: (process.env.ANTHROPIC_API_KEY || '').trim(),
});

/**
 * GET /api/market-research
 * List saved reports for org
 */
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const r = await pool.query(
      `SELECT mrr.*, u.full_name
       FROM market_research_reports mrr
       LEFT JOIN users u ON mrr.user_id = u.id
       WHERE mrr.org_id = $1
       ORDER BY mrr.created_at DESC`,
      [orgId]
    );

    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('GET /market-research error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/market-research/:id
 * Get a specific report
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
      `SELECT * FROM market_research_reports WHERE id=$1 AND org_id=$2`,
      [id, orgId]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    console.error('GET /market-research/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/market-research/generate
 * AI generates a market research report
 */
router.post('/generate', auth, aiLimiter, async (req, res) => {
  try {
    const { naics, agency, keywords } = req.body;

    if (!naics) {
      return res.status(400).json({ error: 'NAICS code is required' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Build context from spending and awards data
    let dataSnapshot = { naics, agency, keywords };

    try {
      // Try to fetch related data
      const spendingR = await pool.query(
        `SELECT agency, total_amount, contract_count FROM spending_cache
         WHERE cache_key LIKE $1 LIMIT 5`,
        [naics + '%']
      );
      if (spendingR.rows.length > 0) {
        dataSnapshot.spending_data = spendingR.rows;
      }

      const awardR = await pool.query(
        `SELECT agency, COUNT(*) as award_count, SUM(value_max) as total_value
         FROM opportunities
         WHERE naics_code=$1
         GROUP BY agency LIMIT 5`,
        [naics]
      );
      if (awardR.rows.length > 0) {
        dataSnapshot.award_data = awardR.rows;
      }
    } catch (e) {
      console.warn('Could not fetch spending/award data:', e.message);
    }

    // Generate report via Claude
    const prompt = `
You are a government contracting market research analyst. Generate a comprehensive market research report based on these inputs:

NAICS Code: ${naics}
Agency Focus: ${agency || 'All'}
Keywords: ${keywords || 'General'}

Please provide:
1. Market Overview - Size, growth trends, key players
2. Opportunity Analysis - Types of opportunities, typical contract values, common requirements
3. Competitive Landscape - Major prime contractors, competitive factors
4. Strategic Recommendations - How to position for success in this market
5. Key Agencies - Primary buyers and procurement processes
6. Challenges & Barriers - Compliance, certifications, past performance requirements

Format the response as a professional market research report with clear sections and actionable insights.
`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';

    // Save report
    const title = `Market Research: NAICS ${naics}${agency ? ` - ${agency}` : ''}`;

    const result = await pool.query(
      `INSERT INTO market_research_reports
       (org_id, user_id, title, naics, agency, content, data_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [orgId, req.userId, title, naics, agency || null, content, JSON.stringify(dataSnapshot)]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /market-research/generate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/market-research/:id
 * Delete a report
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const result = await pool.query(
      `DELETE FROM market_research_reports WHERE id=$1 AND org_id=$2 RETURNING *`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('DELETE /market-research/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
