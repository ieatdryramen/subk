const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id, role FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const isAdmin = userR.rows[0]?.role === 'admin';

    let orgProfile = null;
    if (orgId) {
      const orgR = await pool.query(
        'SELECT * FROM company_profiles WHERE org_id=$1 ORDER BY updated_at DESC LIMIT 1', [orgId]
      );
      orgProfile = orgR.rows[0] || null;
    }

    const userR2 = await pool.query('SELECT * FROM company_profiles WHERE user_id=$1', [req.userId]);
    const userProfile = userR2.rows[0] || null;

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
      email_signature: userProfile?.email_signature || '',
      is_admin: isAdmin,
    };

    res.json(merged);
  } catch (err) {
    console.error('Profile GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id, role FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const isAdmin = userR.rows[0]?.role === 'admin';

    const name = req.body.name || '';
    const product = req.body.product || '';
    const value_props = req.body.value_props || '';
    const icp = req.body.icp || '';
    const target_titles = req.body.target_titles || '';
    const objections = req.body.objections || '';
    const website_url = req.body.website_url || '';
    const sender_name = req.body.sender_name || '';
    const sender_role = req.body.sender_role || 'AE';
    const tone = req.body.tone || '';
    const custom_tone = req.body.custom_tone || '';
    const email_signature = req.body.email_signature || '';

    // Save org-level profile if admin
    if (isAdmin && orgId) {
      await pool.query(
        `INSERT INTO company_profiles (org_id, name, product, value_props, icp, target_titles, objections, website_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (org_id) DO UPDATE SET
           name=$2, product=$3, value_props=$4, icp=$5, target_titles=$6,
           objections=$7, website_url=$8, updated_at=NOW()`,
        [orgId, name, product, value_props, icp, target_titles, objections, website_url]
      ).catch(async () => {
        // org_id unique constraint may not exist yet — try update then insert
        const exists = await pool.query('SELECT id FROM company_profiles WHERE org_id=$1', [orgId]);
        if (exists.rows.length) {
          await pool.query(
            `UPDATE company_profiles SET name=$1, product=$2, value_props=$3, icp=$4,
             target_titles=$5, objections=$6, website_url=$7, updated_at=NOW() WHERE org_id=$8`,
            [name, product, value_props, icp, target_titles, objections, website_url, orgId]
          );
        } else {
          await pool.query(
            `INSERT INTO company_profiles (org_id, name, product, value_props, icp, target_titles, objections, website_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [orgId, name, product, value_props, icp, target_titles, objections, website_url]
          );
        }
      });
    }

    // Save personal profile (upsert by user_id)
    const existing = await pool.query('SELECT id FROM company_profiles WHERE user_id=$1', [req.userId]);
    if (existing.rows.length) {
      await pool.query(
        `UPDATE company_profiles SET
          sender_name=$1, sender_role=$2, tone=$3, custom_tone=$4,
          name=$5, product=$6, value_props=$7, icp=$8,
          target_titles=$9, objections=$10, website_url=$11, email_signature=$12, updated_at=NOW()
         WHERE user_id=$13`,
        [sender_name, sender_role, tone, custom_tone,
         name, product, value_props, icp,
         target_titles, objections, website_url, email_signature, req.userId]
      );
    } else {
      await pool.query(
        `INSERT INTO company_profiles
          (user_id, sender_name, sender_role, tone, custom_tone,
           name, product, value_props, icp, target_titles, objections, website_url, email_signature)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [req.userId, sender_name, sender_role, tone, custom_tone,
         name, product, value_props, icp, target_titles, objections, website_url, email_signature]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Profile POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
