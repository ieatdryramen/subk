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
  const { name, product, value_props, icp, target_titles, tone, objections, sender_name, sender_role, custom_tone, website_url } = req.body;
  try {
    const exists = await pool.query('SELECT id FROM company_profiles WHERE user_id=$1', [req.userId]);
    let result;
    if (exists.rows.length) {
      result = await pool.query(
        `UPDATE company_profiles SET name=$1, product=$2, value_props=$3, icp=$4, target_titles=$5, tone=$6, objections=$7, sender_name=$8, sender_role=$9, custom_tone=$10, website_url=$11, updated_at=NOW()
         WHERE user_id=$12 RETURNING *`,
        [name, product, value_props, icp, target_titles, tone, objections, sender_name, sender_role, custom_tone, website_url, req.userId]
      );
    } else {
      result = await pool.query(
        `INSERT INTO company_profiles (user_id, name, product, value_props, icp, target_titles, tone, objections, sender_name, sender_role, custom_tone, website_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [req.userId, name, product, value_props, icp, target_titles, tone, objections, sender_name, sender_role, custom_tone, website_url]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
