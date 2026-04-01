const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { chatWithPlaybook } = require('../services/ai');

router.post('/:leadId', auth, async (req, res) => {
  const { messages } = req.body;
  try {
    const leadResult = await pool.query(
      `SELECT l.* FROM leads l
       JOIN users u ON u.id = $2
       WHERE l.id = $1 AND (
         l.user_id = $2 OR
         EXISTS (SELECT 1 FROM users lu WHERE lu.id = l.user_id AND lu.org_id = u.org_id AND u.org_id IS NOT NULL)
       )`, [req.params.leadId, req.userId]
    );
    if (!leadResult.rows.length) return res.status(404).json({ error: 'Lead not found' });
    const lead = leadResult.rows[0];

    const profileResult = await pool.query(
      'SELECT * FROM company_profiles WHERE user_id=$1', [req.userId]
    );
    if (!profileResult.rows.length) return res.status(400).json({ error: 'No company profile' });
    const profile = profileResult.rows[0];

    const playbookResult = await pool.query(
      'SELECT * FROM playbooks WHERE lead_id=$1 ORDER BY generated_at DESC LIMIT 1', [lead.id]
    );
    const playbook = playbookResult.rows[0] || null;

    const reply = await chatWithPlaybook(messages, lead, profile, playbook);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
