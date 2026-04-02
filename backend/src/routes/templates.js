const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Get all templates for org
router.get('/', auth, async (req, res) => {
  try {
    const user = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = user.rows[0]?.org_id;
    const result = await pool.query(
      `SELECT t.*, u.full_name as creator FROM email_templates t 
       JOIN users u ON u.id = t.user_id
       WHERE t.org_id=$1 OR t.user_id=$2 
       ORDER BY t.created_at DESC`,
      [orgId, req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save a template
router.post('/', auth, async (req, res) => {
  const { name, subject, body, touchpoint } = req.body;
  if (!name || !body) return res.status(400).json({ error: 'Name and body required' });
  try {
    const user = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = user.rows[0]?.org_id;
    const result = await pool.query(
      'INSERT INTO email_templates (user_id, org_id, name, subject, body, touchpoint) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.userId, orgId, name, subject, body, touchpoint]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a template
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM email_templates WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
