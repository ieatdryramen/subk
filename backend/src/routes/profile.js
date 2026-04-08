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
      company_phone: userProfile?.company_phone || orgProfile?.company_phone || '',
      company_email: userProfile?.company_email || orgProfile?.company_email || '',
      company_address: userProfile?.company_address || orgProfile?.company_address || '',
      cage_code: userProfile?.cage_code || orgProfile?.cage_code || '',
      uei: userProfile?.uei || orgProfile?.uei || '',
      duns: userProfile?.duns || orgProfile?.duns || '',
      naics_codes: userProfile?.naics_codes || orgProfile?.naics_codes || '',
      certifications: userProfile?.certifications || orgProfile?.certifications || '[]',
      core_capabilities: userProfile?.core_capabilities || orgProfile?.core_capabilities || '',
      past_performance: userProfile?.past_performance || orgProfile?.past_performance || '',
      differentiators: userProfile?.differentiators || orgProfile?.differentiators || '',
      team_members: userProfile?.team_members || orgProfile?.team_members || '[]',
      is_admin: isAdmin,
    };

    res.json(merged);
  } catch (err) {
    console.error('Profile GET error:', err.message);
    res.status(500).json({ error: 'Server error' });
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
    const sender_name = (req.body.sender_name || '').trim();
    const sender_role = req.body.sender_role || 'AE';
    const tone = req.body.tone || '';
    const custom_tone = req.body.custom_tone || '';
    const email_signature = req.body.email_signature || '';
    const company_phone = req.body.company_phone || '';
    const company_email = req.body.company_email || '';
    const company_address = req.body.company_address || '';
    const cage_code = req.body.cage_code || '';
    const uei = req.body.uei || '';
    const duns = req.body.duns || '';
    const naics_codes = req.body.naics_codes || '';
    const certifications = req.body.certifications || '[]';
    const core_capabilities = req.body.core_capabilities || '';
    const past_performance = req.body.past_performance || '';
    const differentiators = req.body.differentiators || '';
    const team_members = req.body.team_members || '[]';

    // Save org-level profile if admin
    if (isAdmin && orgId) {
      await pool.query(
        `INSERT INTO company_profiles (org_id, name, product, value_props, icp, target_titles, objections, website_url,
          company_phone, company_email, company_address, cage_code, uei, duns, naics_codes, certifications,
          core_capabilities, past_performance, differentiators, team_members)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (org_id) DO UPDATE SET
           name=$2, product=$3, value_props=$4, icp=$5, target_titles=$6, objections=$7, website_url=$8,
           company_phone=$9, company_email=$10, company_address=$11, cage_code=$12, uei=$13, duns=$14,
           naics_codes=$15, certifications=$16, core_capabilities=$17, past_performance=$18, differentiators=$19,
           team_members=$20, updated_at=NOW()`,
        [orgId, name, product, value_props, icp, target_titles, objections, website_url,
         company_phone, company_email, company_address, cage_code, uei, duns, naics_codes, certifications,
         core_capabilities, past_performance, differentiators, team_members]
      ).catch(async () => {
        const exists = await pool.query('SELECT id FROM company_profiles WHERE org_id=$1', [orgId]);
        if (exists.rows.length) {
          await pool.query(
            `UPDATE company_profiles SET name=$1, product=$2, value_props=$3, icp=$4,
             target_titles=$5, objections=$6, website_url=$7, company_phone=$8, company_email=$9,
             company_address=$10, cage_code=$11, uei=$12, duns=$13, naics_codes=$14, certifications=$15,
             core_capabilities=$16, past_performance=$17, differentiators=$18, team_members=$19, updated_at=NOW()
             WHERE org_id=$20`,
            [name, product, value_props, icp, target_titles, objections, website_url, company_phone, company_email,
             company_address, cage_code, uei, duns, naics_codes, certifications, core_capabilities, past_performance,
             differentiators, team_members, orgId]
          );
        } else {
          await pool.query(
            `INSERT INTO company_profiles (org_id, name, product, value_props, icp, target_titles, objections, website_url,
              company_phone, company_email, company_address, cage_code, uei, duns, naics_codes, certifications,
              core_capabilities, past_performance, differentiators, team_members)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
            [orgId, name, product, value_props, icp, target_titles, objections, website_url,
             company_phone, company_email, company_address, cage_code, uei, duns, naics_codes, certifications,
             core_capabilities, past_performance, differentiators, team_members]
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
          target_titles=$9, objections=$10, website_url=$11, email_signature=$12,
          company_phone=$13, company_email=$14, company_address=$15, cage_code=$16, uei=$17, duns=$18,
          naics_codes=$19, certifications=$20, core_capabilities=$21, past_performance=$22,
          differentiators=$23, team_members=$24, updated_at=NOW()
         WHERE user_id=$25`,
        [sender_name, sender_role, tone, custom_tone,
         name, product, value_props, icp,
         target_titles, objections, website_url, email_signature,
         company_phone, company_email, company_address, cage_code, uei, duns,
         naics_codes, certifications, core_capabilities, past_performance, differentiators, team_members,
         req.userId]
      );
    } else {
      await pool.query(
        `INSERT INTO company_profiles
          (user_id, sender_name, sender_role, tone, custom_tone,
           name, product, value_props, icp, target_titles, objections, website_url, email_signature,
           company_phone, company_email, company_address, cage_code, uei, duns, naics_codes, certifications,
           core_capabilities, past_performance, differentiators, team_members)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
        [req.userId, sender_name, sender_role, tone, custom_tone,
         name, product, value_props, icp, target_titles, objections, website_url, email_signature,
         company_phone, company_email, company_address, cage_code, uei, duns, naics_codes, certifications,
         core_capabilities, past_performance, differentiators, team_members]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Profile POST error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
