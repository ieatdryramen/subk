const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { searchOpportunities } = require('../services/govdata');
const { scoreOpportunity } = require('../services/ai');

// GET /autosearch — list all auto-search configs for the user
router.get('/', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM opportunity_searches WHERE user_id=$1 AND auto_frequency IS NOT NULL ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /autosearch/enable/:searchId — enable auto-search for a saved search
router.post('/enable/:searchId', auth, async (req, res) => {
  const { frequency } = req.body; // 'daily' or 'weekly'
  try {
    // Verify search belongs to user
    const searchR = await pool.query(
      'SELECT * FROM opportunity_searches WHERE id=$1 AND user_id=$2',
      [req.params.searchId, req.userId]
    );
    if (!searchR.rows.length) {
      return res.status(404).json({ error: 'Search not found' });
    }

    if (!['daily', 'weekly'].includes(frequency)) {
      return res.status(400).json({ error: 'Frequency must be daily or weekly' });
    }

    await pool.query(
      'UPDATE opportunity_searches SET auto_frequency=$1, last_auto_run=NOW() WHERE id=$2',
      [frequency, req.params.searchId]
    );

    res.json({ success: true, search_id: req.params.searchId, auto_frequency: frequency });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /autosearch/disable/:searchId — disable auto-search
router.delete('/disable/:searchId', auth, async (req, res) => {
  try {
    // Verify search belongs to user
    const searchR = await pool.query(
      'SELECT * FROM opportunity_searches WHERE id=$1 AND user_id=$2',
      [req.params.searchId, req.userId]
    );
    if (!searchR.rows.length) {
      return res.status(404).json({ error: 'Search not found' });
    }

    await pool.query(
      'UPDATE opportunity_searches SET auto_frequency=NULL WHERE id=$1',
      [req.params.searchId]
    );

    res.json({ success: true, search_id: req.params.searchId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /autosearch/run/:searchId — manually trigger a re-run of a saved search
router.post('/run/:searchId', auth, async (req, res) => {
  try {
    // Get the saved search
    const searchR = await pool.query(
      'SELECT * FROM opportunity_searches WHERE id=$1 AND user_id=$2',
      [req.params.searchId, req.userId]
    );
    if (!searchR.rows.length) {
      return res.status(404).json({ error: 'Search not found' });
    }

    const search = searchR.rows[0];

    // Get sub profile for scoring
    const profileR = await pool.query('SELECT * FROM sub_profiles WHERE user_id=$1', [req.userId]);
    const subProfile = profileR.rows[0];

    // Re-run the search with saved parameters
    const opps = await searchOpportunities({
      naics_codes: search.naics_codes,
      keywords: search.keywords,
      agency: search.agency,
      set_aside: search.set_aside,
    });

    // Score each opportunity
    const scored = await Promise.all(opps.map(async opp => {
      if (subProfile) {
        const score = await scoreOpportunity(opp, subProfile);
        return { ...opp, fit_score: score.score, fit_reason: score.reason };
      }
      return { ...opp, fit_score: null, fit_reason: null };
    }));

    scored.sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0));

    // Save opportunities to DB
    for (const opp of scored) {
      await pool.query(
        `INSERT INTO opportunities (search_id, org_id, sam_notice_id, title, agency, sub_agency, naics_code, set_aside,
         posted_date, response_deadline, description, place_of_performance, primary_contact_name, primary_contact_email,
         solicitation_number, opportunity_url, fit_score, fit_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (sam_notice_id) DO NOTHING`,
        [search.id, search.org_id, opp.sam_notice_id, opp.title, opp.agency, opp.sub_agency, opp.naics_code,
         opp.set_aside, opp.posted_date, opp.response_deadline, opp.description, opp.place_of_performance,
         opp.primary_contact_name, opp.primary_contact_email, opp.solicitation_number, opp.opportunity_url,
         opp.fit_score, opp.fit_reason]
      ).catch(() => {}); // ignore duplicate errors
    }

    // Update last_auto_run
    await pool.query(
      'UPDATE opportunity_searches SET last_auto_run=NOW() WHERE id=$1',
      [req.params.searchId]
    );

    res.json({ success: true, search_id: req.params.searchId, opportunities_found: scored.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
