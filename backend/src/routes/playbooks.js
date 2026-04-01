const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { generatePlaybook } = require('../services/ai');

// Generate playbook for a single lead
router.post('/generate/:leadId', auth, async (req, res) => {
  try {
    const leadResult = await pool.query(
      'SELECT * FROM leads WHERE id=$1 AND user_id=$2',
      [req.params.leadId, req.userId]
    );
    if (!leadResult.rows.length) return res.status(404).json({ error: 'Lead not found' });
    const lead = leadResult.rows[0];

    const profileResult = await pool.query(
      'SELECT * FROM company_profiles WHERE user_id=$1',
      [req.userId]
    );
    if (!profileResult.rows.length) return res.status(400).json({ error: 'No company profile found' });
    const profile = profileResult.rows[0];

    await pool.query('UPDATE leads SET status=$1 WHERE id=$2', ['generating', lead.id]);

    const playbook = await generatePlaybook(lead, profile);

    await pool.query('DELETE FROM playbooks WHERE lead_id=$1', [lead.id]);
    const result = await pool.query(
      `INSERT INTO playbooks (lead_id, user_id, research, email1, email2, email3, email4, linkedin, call_opener, objection_handling, callbacks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [lead.id, req.userId, playbook.research, playbook.email1, playbook.email2, playbook.email3,
       playbook.email4, playbook.linkedin, playbook.call_opener, playbook.objection_handling, playbook.callbacks]
    );

    await pool.query('UPDATE leads SET status=$1 WHERE id=$2', ['done', lead.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    await pool.query('UPDATE leads SET status=$1 WHERE id=$2', ['error', req.params.leadId]);
    res.status(500).json({ error: err.message });
  }
});

// Generate playbooks for all leads in a list
router.post('/generate-list/:listId', auth, async (req, res) => {
  try {
    const leadsResult = await pool.query(
      'SELECT * FROM leads WHERE list_id=$1 AND user_id=$2 ORDER BY id ASC',
      [req.params.listId, req.userId]
    );
    const leads = leadsResult.rows;
    if (!leads.length) return res.status(400).json({ error: 'No leads in list' });

    const profileResult = await pool.query(
      'SELECT * FROM company_profiles WHERE user_id=$1', [req.userId]
    );
    if (!profileResult.rows.length) return res.status(400).json({ error: 'No company profile found' });
    const profile = profileResult.rows[0];

    // Return immediately, process in background
    res.json({ message: 'Generation started', total: leads.length });

    for (const lead of leads) {
      try {
        await pool.query('UPDATE leads SET status=$1 WHERE id=$2', ['generating', lead.id]);
        const playbook = await generatePlaybook(lead, profile);
        await pool.query('DELETE FROM playbooks WHERE lead_id=$1', [lead.id]);
        await pool.query(
          `INSERT INTO playbooks (lead_id, user_id, research, email1, email2, email3, email4, linkedin, call_opener, objection_handling, callbacks)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [lead.id, req.userId, playbook.research, playbook.email1, playbook.email2, playbook.email3,
           playbook.email4, playbook.linkedin, playbook.call_opener, playbook.objection_handling, playbook.callbacks]
        );
        await pool.query('UPDATE leads SET status=$1 WHERE id=$2', ['done', lead.id]);
      } catch (err) {
        console.error(`Failed for lead ${lead.id}:`, err.message);
        await pool.query('UPDATE leads SET status=$1 WHERE id=$2', ['error', lead.id]);
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get playbook for a lead
router.get('/:leadId', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM playbooks WHERE lead_id=$1 AND user_id=$2',
      [req.params.leadId, req.userId]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
