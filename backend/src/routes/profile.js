const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM company_profiles WHERE user_id=$1', [req.userId]);
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  const {
    name, product, value_props, icp, target_titles, tone, objections,
    sender_name, sender_role, custom_tone, website_url,
    // GovCon-specific
    legacy_system, compliance_focus, workflow_pains, buyer_personas, migration_notes, govcon_mode,
  } = req.body;

  try {
    const exists = await pool.query('SELECT id FROM company_profiles WHERE user_id=$1', [req.userId]);
    let result;
    if (exists.rows.length) {
      result = await pool.query(
        `UPDATE company_profiles SET
          name=$1, product=$2, value_props=$3, icp=$4, target_titles=$5, tone=$6,
          objections=$7, sender_name=$8, sender_role=$9, custom_tone=$10, website_url=$11,
          legacy_system=$12, compliance_focus=$13, workflow_pains=$14, buyer_personas=$15,
          migration_notes=$16, govcon_mode=$17, updated_at=NOW()
         WHERE user_id=$18 RETURNING *`,
        [name, product, value_props, icp, target_titles, tone, objections, sender_name, sender_role,
         custom_tone, website_url, legacy_system, compliance_focus, workflow_pains, buyer_personas,
         migration_notes, govcon_mode, req.userId]
      );
    } else {
      result = await pool.query(
        `INSERT INTO company_profiles
          (user_id, name, product, value_props, icp, target_titles, tone, objections,
           sender_name, sender_role, custom_tone, website_url,
           legacy_system, compliance_focus, workflow_pains, buyer_personas, migration_notes, govcon_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
        [req.userId, name, product, value_props, icp, target_titles, tone, objections, sender_name,
         sender_role, custom_tone, website_url, legacy_system, compliance_focus, workflow_pains,
         buyer_personas, migration_notes, govcon_mode]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
