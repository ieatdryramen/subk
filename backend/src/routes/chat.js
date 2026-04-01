const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { chatWithPlaybook } = require('../services/ai');

router.post('/:leadId', auth, async (req, res) => {
  const { messages } = req.body;
  try {
    const leadResult = await pool.query(
      'SELECT * FROM leads WHERE id=$1 AND user_id=$2', [req.params.leadId, req.userId]
    );
    if (!leadResult.rows.length) return res.status(404).json({ error: 'Lead not found' });
    const lead = leadResult.rows[0];

    const profileResult = await pool.query(
      'SELECT * FROM company_profiles WHERE user_id=$1', [req.userId]
    );
    if (!profileResult.rows.length) return res.status(400).json({ error: 'No company profile' });
    const profile = profileResult.rows[0];

    const playbookResult = await pool.query(
      'SELECT * FROM playbooks WHERE lead_id=$1', [lead.id]
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
