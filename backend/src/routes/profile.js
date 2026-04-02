const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// GET — return merged profile (org context + user personal)
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id, role FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    let orgProfile = null;
    if (orgId) {
      const orgR = await pool.query(
        'SELECT * FROM company_profiles WHERE org_id=$1 ORDER BY updated_at DESC LIMIT 1', [orgId]
      );
      orgProfile = orgR.rows[0] || null;
    }

    const userR2 = await pool.query('SELECT * FROM company_profiles WHERE user_id=$1', [req.userId]);
    const userProfile = userR2.rows[0] || null;

    // Return merged — org is base, user overrides personal fields
    const merged = {
      ...(orgProfile || {}),
      ...(userProfile || {}),
      name: orgProfile?.name || userProfile?.name || '',
      product: orgProfile?.product || userProfile?.product || '',
      value_props: orgProfile?.value_props || userProfile?.value_props || '',
      icp: orgProfile?.icp || userProfile?.icp || '',
      target_titles: orgProfile?.target_titles || userProfile?.target_titles || '',
      objections: orgProfile?.objections || userProfile?.objections || '',
      sender_name: userProfile?.sender_name || '',
      sender_role: userProfile?.sender_role || 'AE',
      tone: userProfile?.tone || orgProfile?.tone || '',
      custom_tone: userProfile?.custom_tone || '',
      website_url: orgProfile?.website_url || userProfile?.website_url || '',
      is_admin: userR.rows[0]?.role === 'admin',
    };

    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST — admins save org-level profile, members save personal settings only
router.post('/', auth, async (req, res) => {
  const {
    name, product, value_props, icp, target_titles, tone, objections,
    sender_name, sender_role, custom_tone, website_url,
  } = req.body;

  try {
    const userR = await pool.query('SELECT org_id, role FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const isAdmin = userR.rows[0]?.role === 'admin';

    // Admins save company-level context to the org profile
    if (isAdmin && orgId) {
      const orgExists = await pool.query(
        'SELECT id FROM company_profiles WHERE org_id=$1', [orgId]
      );
      if (orgExists.rows.length) {
        await pool.query(
          `UPDATE company_profiles SET
            name=$1, product=$2, value_props=$3, icp=$4, target_titles=$5,
            objections=$6, website_url=$7, updated_at=NOW()
           WHERE org_id=$8`,
          [name, product, value_props, icp, target_titles, objections, website_url, orgId]
        );
      } else {
        await pool.query(
          `INSERT INTO company_profiles (org_id, name, product, value_props, icp, target_titles, objections, website_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [orgId, name, product, value_props, icp, target_titles, objections, website_url]
        );
      }
    }

    // Everyone saves their personal settings (name, role, tone)
    const personalExists = await pool.query(
      'SELECT id FROM company_profiles WHERE user_id=$1', [req.userId]
    );
    let result;
    if (personalExists.rows.length) {
      result = await pool.query(
        `UPDATE company_profiles SET
          sender_name=$1, sender_role=$2, tone=$3, custom_tone=$4,
          name=$5, product=$6, value_props=$7, icp=$8, target_titles=$9,
          objections=$10, website_url=$11, updated_at=NOW()
         WHERE user_id=$12 RETURNING *`,
        [sender_name, sender_role, tone, custom_tone,
         name, product, value_props, icp, target_titles, objections, website_url,
         req.userId]
      );
    } else {
      result = await pool.query(
        `INSERT INTO company_profiles
          (user_id, sender_name, sender_role, tone, custom_tone,
           name, product, value_props, icp, target_titles, objections, website_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [req.userId, sender_name, sender_role, tone, custom_tone,
         name, product, value_props, icp, target_titles, objections, website_url]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Profile save error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
