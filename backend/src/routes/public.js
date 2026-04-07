const router = require('express').Router();
const { pool } = require('../db');

// GET /public/sub/:id — public vetting card (no auth required)
router.get('/sub/:id', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT sp.company_name, sp.naics_codes, sp.certifications, sp.capabilities,
             sp.target_agencies, sp.state, sp.tagline, sp.website_url, sp.cage_code, sp.uei,
             sp.uei_verified, sp.contract_min, sp.contract_max, sp.set_aside_prefs,
             u.full_name as contact_name
      FROM sub_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE sp.id = $1 AND sp.is_public = true
    `, [req.params.id]);

    if (!r.rows.length) return res.status(404).json({ error: 'Profile not found or not public' });

    // Also get past performance records (public summary)
    const pp = await pool.query(`
      SELECT contract_title, agency, prime_or_sub, award_amount, period_start, period_end, naics_code, description
      FROM past_performance pp
      JOIN sub_profiles sp ON sp.user_id = pp.user_id
      WHERE sp.id = $1 AND sp.is_public = true
      ORDER BY period_start DESC NULLS LAST
      LIMIT 10
    `, [req.params.id]);

    res.json({
      ...r.rows[0],
      past_performance: pp.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
