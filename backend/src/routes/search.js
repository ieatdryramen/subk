const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Global search across leads, opportunities, and primes
router.get('/', auth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ leads: [], opportunities: [], primes: [] });

  const pattern = `%${q}%`;

  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Search leads
    const leadsR = await pool.query(
      `SELECT l.id, l.full_name, l.company, l.title, l.email, l.icp_score, l.status, l.list_id,
              ll.name as list_name
       FROM leads l
       LEFT JOIN lead_lists ll ON l.list_id = ll.id
       WHERE l.user_id = $1
         AND (l.full_name ILIKE $2 OR l.company ILIKE $2 OR l.email ILIKE $2 OR l.title ILIKE $2)
       ORDER BY l.icp_score DESC NULLS LAST
       LIMIT 8`,
      [req.userId, pattern]
    );

    // Search opportunities
    const oppsR = await pool.query(
      `SELECT o.id, o.title, o.agency, o.set_aside, o.fit_score, o.response_deadline, o.naics_code, o.status
       FROM opportunities o
       WHERE o.org_id = $1
         AND (o.title ILIKE $2 OR o.agency ILIKE $2 OR o.solicitation_number ILIKE $2 OR o.description ILIKE $2)
       ORDER BY o.fit_score DESC NULLS LAST
       LIMIT 8`,
      [orgId, pattern]
    );

    // Search primes
    const primesR = await pool.query(
      `SELECT p.id, p.company_name, p.cage_code, p.agency_focus, p.fit_score, p.outreach_status,
              p.contact_name, p.contact_email
       FROM primes p
       WHERE p.org_id = $1
         AND (p.company_name ILIKE $2 OR p.cage_code ILIKE $2 OR p.contact_name ILIKE $2 OR p.agency_focus ILIKE $2)
       ORDER BY p.fit_score DESC NULLS LAST
       LIMIT 8`,
      [orgId, pattern]
    );

    res.json({
      leads: leadsR.rows,
      opportunities: oppsR.rows,
      primes: primesR.rows,
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
