const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { searchOpportunities } = require('../services/govdata');
const { scoreOpportunity } = require('../services/ai');

// Get all opportunities for org
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Get total count
    const countR = await pool.query(
      'SELECT COUNT(*) as total FROM opportunities WHERE org_id=$1',
      [orgId]
    );
    const total = parseInt(countR.rows[0].total, 10);

    // Get paginated results
    const r = await pool.query(
      'SELECT * FROM opportunities WHERE org_id=$1 ORDER BY fit_score DESC NULLS LAST, posted_date DESC LIMIT $2 OFFSET $3',
      [orgId, limit, offset]
    );
    res.json({ opportunities: r.rows, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search live opportunities from SAM.gov + score them
router.post('/search', auth, async (req, res) => {
  const { naics_codes, keywords, agency, set_aside, save_search, search_name } = req.body;
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Check usage limits
    const orgR = await pool.query('SELECT * FROM organizations WHERE id=$1', [orgId]);
    const org = orgR.rows[0];
    if (org.searches_used >= org.searches_limit && org.plan === 'trial') {
      return res.status(402).json({ error: 'Search limit reached. Upgrade to continue.', upgrade: true });
    }

    // Fetch live data
    const opps = await searchOpportunities({ naics_codes, keywords, agency, set_aside });

    // Get sub profile for scoring
    const profileR = await pool.query('SELECT * FROM sub_profiles WHERE user_id=$1', [req.userId]);
    const subProfile = profileR.rows[0];

    // Score each opportunity
    const scored = await Promise.all(opps.map(async opp => {
      if (subProfile) {
        const score = await scoreOpportunity(opp, subProfile);
        return { ...opp, fit_score: score.score, fit_reason: score.reason };
      }
      return { ...opp, fit_score: null, fit_reason: null };
    }));

    // Sort by fit score
    scored.sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0));

    // Save search if requested
    let searchId = null;
    if (save_search && search_name) {
      const s = await pool.query(
        'INSERT INTO opportunity_searches (user_id, org_id, name, naics_codes, keywords, agency, set_aside) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [req.userId, orgId, search_name, naics_codes, keywords, agency, set_aside]
      );
      searchId = s.rows[0].id;

      // Save opportunities to DB
      for (const opp of scored) {
        await pool.query(
          `INSERT INTO opportunities (search_id, org_id, sam_notice_id, title, agency, sub_agency, naics_code, set_aside,
           posted_date, response_deadline, description, place_of_performance, primary_contact_name, primary_contact_email,
           solicitation_number, opportunity_url, fit_score, fit_reason)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (sam_notice_id) DO NOTHING`,
          [searchId, orgId, opp.sam_notice_id, opp.title, opp.agency, opp.sub_agency, opp.naics_code,
           opp.set_aside, opp.posted_date, opp.response_deadline, opp.description, opp.place_of_performance,
           opp.primary_contact_name, opp.primary_contact_email, opp.solicitation_number, opp.opportunity_url,
           opp.fit_score, opp.fit_reason]
        ).catch(() => {}); // ignore duplicate errors
      }

      // Increment usage
      await pool.query('UPDATE organizations SET searches_used=searches_used+1 WHERE id=$1', [orgId]);
    }

    res.json({ opportunities: scored, search_id: searchId, count: scored.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Debug: test SAM.gov API directly
router.get('/debug/sam-test', auth, async (req, res) => {
  const axios = require('axios');
  const SAM_API_KEY = process.env.SAM_API_KEY;
  try {
    const today = new Date();
    const ago90 = new Date(today - 90 * 24 * 60 * 60 * 1000);
    const fmt = d => `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
    const params = { api_key: SAM_API_KEY, limit: 5, offset: 0, postedFrom: fmt(ago90), postedTo: fmt(today) };
    console.log('SAM debug params:', JSON.stringify(params).replace(SAM_API_KEY, '***'));

    // Try multiple URL variants + entity API to check if key works at all
    const urls = [
      'https://api.sam.gov/prod/opportunities/v2/search',
      'https://api.sam.gov/opportunities/v2/search',
    ];
    // Also test entity API to see if key works there
    urls.push('https://api.sam.gov/entity-information/v3/entities?ueiSAM=ZQNHWAHG3BE7');
    const results = [];
    for (const url of urls) {
      try {
        const r2 = await axios.get(url, { params, timeout: 15000 });
        results.push({ url, status: r2.status, totalRecords: r2.data?.totalRecords, oppCount: r2.data?.opportunitiesData?.length || 0, keys: Object.keys(r2.data || {}), sample: r2.data?.opportunitiesData?.[0]?.title || null });
      } catch (e2) {
        results.push({
          url,
          error: e2.message,
          status: e2.response?.status,
          headers: e2.response?.headers ? { 'content-type': e2.response.headers['content-type'], 'x-ratelimit-remaining': e2.response.headers['x-ratelimit-remaining'], server: e2.response.headers['server'] } : null,
          body: typeof e2.response?.data === 'string' ? e2.response.data.substring(0, 300) : JSON.stringify(e2.response?.data)?.substring(0, 300)
        });
      }
    }
    res.json({
      results,
      hasApiKey: !!SAM_API_KEY,
      apiKeyPrefix: SAM_API_KEY ? SAM_API_KEY.substring(0, 8) + '...' : 'NOT SET',
      apiKeyLength: SAM_API_KEY?.length,
    });
  } catch (err) {
    res.json({
      error: err.message,
      status: err.response?.status,
      responseData: err.response?.data,
      hasApiKey: !!SAM_API_KEY,
      apiKeyPrefix: SAM_API_KEY ? SAM_API_KEY.substring(0, 8) + '...' : 'NOT SET',
    });
  }
});

// Update opportunity status
router.put('/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  try {
    await pool.query('UPDATE opportunities SET status=$1 WHERE id=$2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete opportunity
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM opportunities WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save/bookmark an opportunity
router.post('/save/:id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `INSERT INTO saved_opportunities (user_id, opportunity_id)
       VALUES ($1,$2)
       ON CONFLICT (user_id, opportunity_id) DO NOTHING
       RETURNING *`,
      [req.userId, req.params.id]
    );
    res.json(r.rows[0] || { user_id: req.userId, opportunity_id: req.params.id, saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unsave/unbookmark an opportunity
router.delete('/save/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM saved_opportunities WHERE user_id=$1 AND opportunity_id=$2',
      [req.userId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all saved opportunities for user
router.get('/saved', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    // Get total count
    const countR = await pool.query(
      `SELECT COUNT(*) as total FROM opportunities o
       JOIN saved_opportunities so ON so.opportunity_id = o.id
       WHERE so.user_id=$1`,
      [req.userId]
    );
    const total = parseInt(countR.rows[0].total, 10);

    // Get paginated results
    const r = await pool.query(
      `SELECT o.* FROM opportunities o
       JOIN saved_opportunities so ON so.opportunity_id = o.id
       WHERE so.user_id=$1
       ORDER BY so.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );
    res.json({ opportunities: r.rows, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /opportunities/export/csv — export opportunities as CSV
router.get('/export/csv', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const r = await pool.query('SELECT title, agency, naics_code, set_aside, fit_score, status, response_deadline, solicitation_number, place_of_performance, primary_contact_name, primary_contact_email, opportunity_url FROM opportunities WHERE org_id=$1 ORDER BY fit_score DESC NULLS LAST', [orgId]);

    const headers = ['Title', 'Agency', 'NAICS', 'Set-Aside', 'Fit Score', 'Status', 'Deadline', 'Solicitation #', 'Location', 'Contact Name', 'Contact Email', 'URL'];
    const rows = r.rows.map(o => [
      `"${(o.title||'').replace(/"/g, '""')}"`,
      `"${(o.agency||'').replace(/"/g, '""')}"`,
      o.naics_code || '',
      `"${(o.set_aside||'').replace(/"/g, '""')}"`,
      o.fit_score || '',
      o.status || 'new',
      o.response_deadline ? new Date(o.response_deadline).toISOString().split('T')[0] : '',
      o.solicitation_number || '',
      `"${(o.place_of_performance||'').replace(/"/g, '""')}"`,
      `"${(o.primary_contact_name||'').replace(/"/g, '""')}"`,
      o.primary_contact_email || '',
      o.opportunity_url || '',
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=subk-opportunities.csv');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
