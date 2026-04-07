const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { sendTeamingRequestNotification, sendInterestNotification } = require('../services/email');
const { createNotification } = require('../services/notify');

// GET /marketplace/subs — browse public sub profiles (visible to primes)
router.get('/subs', auth, async (req, res) => {
  try {
    const { naics, cert, state, q } = req.query;
    let where = ['sp.is_public = true'];
    const params = [];

    if (naics) { params.push(`%${naics}%`); where.push(`sp.naics_codes ILIKE $${params.length}`); }
    if (cert)  { params.push(`%${cert}%`);  where.push(`sp.certifications ILIKE $${params.length}`); }
    if (state) { params.push(state);         where.push(`sp.state = $${params.length}`); }
    if (q)     { params.push(`%${q}%`);      where.push(`(sp.capabilities ILIKE $${params.length} OR sp.company_name ILIKE $${params.length})`); }

    const r = await pool.query(`
      SELECT sp.id, sp.company_name, sp.naics_codes, sp.certifications, sp.capabilities,
             sp.target_agencies, sp.state, sp.tagline, sp.website_url,
             u.id as user_id, u.full_name
      FROM sub_profiles sp
      JOIN users u ON u.id = sp.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY sp.updated_at DESC LIMIT 50
    `, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /marketplace/opportunities — shared opportunities posted by primes
router.get('/opportunities', auth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT so.*, u.full_name as prime_name, pa.company_name as prime_company
      FROM shared_opportunities so
      JOIN users u ON u.id = so.prime_user_id
      LEFT JOIN prime_accounts pa ON pa.user_id = so.prime_user_id
      WHERE so.status = 'open'
        AND (so.response_deadline IS NULL OR so.response_deadline > NOW())
      ORDER BY so.created_at DESC LIMIT 50
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /marketplace/opportunities — prime posts a teaming opportunity
router.post('/opportunities', auth, async (req, res) => {
  const { title, description, naics_codes, set_aside, agency, response_deadline, value_min, value_max, roles_needed, requirements } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO shared_opportunities (prime_user_id, title, description, naics_codes, set_aside, agency, response_deadline, value_min, value_max, roles_needed, requirements)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.userId, title || null, description || null, naics_codes || null, set_aside || null, agency || null, response_deadline || null, value_min ? Number(value_min) : null, value_max ? Number(value_max) : null, roles_needed || null, requirements || null]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /marketplace/opportunities/:id/interest — sub expresses interest
router.post('/opportunities/:id/interest', auth, async (req, res) => {
  const { message } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO opportunity_interests (shared_opp_id, sub_user_id, message)
       VALUES ($1,$2,$3)
       ON CONFLICT (shared_opp_id, sub_user_id) DO UPDATE SET message=$3
       RETURNING *`,
      [req.params.id, req.userId, message]
    );

    // Notify the prime who posted this opportunity (non-blocking)
    Promise.resolve().then(async () => {
      try {
        const [opp, subUser, subProfile] = await Promise.all([
          pool.query('SELECT title, prime_user_id FROM shared_opportunities WHERE id=$1', [req.params.id]),
          pool.query('SELECT full_name, email FROM users WHERE id=$1', [req.userId]),
          pool.query('SELECT company_name FROM sub_profiles WHERE user_id=$1', [req.userId]),
        ]);
        const primeUserId = opp.rows[0]?.prime_user_id;
        if (primeUserId) {
          const primeUser = await pool.query('SELECT full_name, email FROM users WHERE id=$1', [primeUserId]);
          if (primeUser.rows[0]?.email) {
            sendInterestNotification({
              toEmail: primeUser.rows[0].email,
              toName: primeUser.rows[0].full_name,
              subName: subUser.rows[0]?.full_name || 'A sub',
              subCompany: subProfile.rows[0]?.company_name,
              opportunityTitle: opp.rows[0]?.title || 'Shared Opportunity',
              message,
            });
          }
          // Create in-app notification for prime
          await createNotification(
            primeUserId,
            'opportunity_interest',
            'Interest in your opportunity',
            `${subUser.rows[0]?.full_name || 'A subcontractor'} expressed interest in "${opp.rows[0]?.title || 'your opportunity'}"`,
            `/marketplace/opportunities/${req.params.id}/interests`
          ).catch(e => console.error('Notification creation error:', e.message));
        }
      } catch (e) { console.error('[EMAIL] interest notify error:', e.message); }
    });

    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /marketplace/opportunities/:id/interests — prime sees who's interested
router.get('/opportunities/:id/interests', auth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT oi.*, u.full_name, u.email, sp.company_name, sp.naics_codes, sp.certifications, sp.capabilities, sp.state
      FROM opportunity_interests oi
      JOIN users u ON u.id = oi.sub_user_id
      LEFT JOIN sub_profiles sp ON sp.user_id = oi.sub_user_id
      WHERE oi.shared_opp_id = $1
      ORDER BY oi.created_at DESC
    `, [req.params.id]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /marketplace/teaming — send a teaming request
router.post('/teaming', auth, async (req, res) => {
  const { to_user_id, opportunity_id, message, from_type } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO teaming_requests (from_user_id, to_user_id, opportunity_id, message, from_type)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.userId, to_user_id, opportunity_id, message, from_type || 'sub']
    );

    // Send email notification (non-blocking)
    Promise.resolve().then(async () => {
      try {
        const [fromUser, toUser, fromProfile] = await Promise.all([
          pool.query('SELECT full_name, email FROM users WHERE id=$1', [req.userId]),
          pool.query('SELECT full_name, email FROM users WHERE id=$1', [to_user_id]),
          pool.query('SELECT company_name FROM sub_profiles WHERE user_id=$1', [req.userId]),
        ]);
        if (toUser.rows[0]?.email) {
          sendTeamingRequestNotification({
            toEmail: toUser.rows[0].email,
            toName: toUser.rows[0].full_name,
            fromName: fromUser.rows[0]?.full_name || 'Someone',
            fromCompany: fromProfile.rows[0]?.company_name,
            message,
          });
        }
        // Create in-app notification for recipient
        await createNotification(
          to_user_id,
          'teaming_request',
          'Teaming request received',
          `${fromUser.rows[0]?.full_name || 'Someone'} sent you a teaming request`,
          `/marketplace/teaming`
        ).catch(e => console.error('Notification creation error:', e.message));
      } catch (e) { console.error('[EMAIL] teaming notify error:', e.message); }
    });

    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /marketplace/teaming — get my teaming requests (sent + received)
router.get('/teaming', auth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT tr.*, 
        fu.full_name as from_name, fu.email as from_email,
        tu.full_name as to_name, tu.email as to_email,
        fsp.company_name as from_company, tsp.company_name as to_company
      FROM teaming_requests tr
      JOIN users fu ON fu.id = tr.from_user_id
      JOIN users tu ON tu.id = tr.to_user_id
      LEFT JOIN sub_profiles fsp ON fsp.user_id = tr.from_user_id
      LEFT JOIN sub_profiles tsp ON tsp.user_id = tr.to_user_id
      WHERE tr.from_user_id = $1 OR tr.to_user_id = $1
      ORDER BY tr.created_at DESC
    `, [req.userId]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /marketplace/teaming/:id — update status (accept/decline)
router.patch('/teaming/:id', auth, async (req, res) => {
  const { status } = req.body;
  try {
    const r = await pool.query(
      `UPDATE teaming_requests SET status=$1, updated_at=NOW()
       WHERE id=$2 AND to_user_id=$3 RETURNING *`,
      [status, req.params.id, req.userId]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET/POST /marketplace/prime-profile — prime registers their profile
router.get('/prime-profile', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM prime_accounts WHERE user_id=$1', [req.userId]);
    res.json(r.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/prime-profile', auth, async (req, res) => {
  const { company_name, cage_code, uei, website, naics_codes, certifications, capabilities, agency_focus, teaming_needs, is_public } = req.body;
  try {
    const exists = await pool.query('SELECT id FROM prime_accounts WHERE user_id=$1', [req.userId]);
    let r;
    if (exists.rows.length) {
      r = await pool.query(
        `UPDATE prime_accounts SET company_name=$1, cage_code=$2, uei=$3, website=$4, naics_codes=$5,
         certifications=$6, capabilities=$7, agency_focus=$8, teaming_needs=$9, is_public=$10, updated_at=NOW()
         WHERE user_id=$11 RETURNING *`,
        [company_name, cage_code, uei, website, naics_codes, certifications, capabilities, agency_focus, teaming_needs, is_public ?? true, req.userId]
      );
    } else {
      r = await pool.query(
        `INSERT INTO prime_accounts (user_id, company_name, cage_code, uei, website, naics_codes, certifications, capabilities, agency_focus, teaming_needs, is_public)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [req.userId, company_name, cage_code, uei, website, naics_codes, certifications, capabilities, agency_focus, teaming_needs, is_public ?? true]
      );
    }
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
