const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { chatWithPlaybook, chatWithCoach } = require('../services/ai');

// ── Original ProspectForge lead-based chat ──
router.post('/:leadId(\\d+)', auth, async (req, res) => {
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
    console.error('Lead chat error:', err.message);
    res.status(500).json({ error: 'Chat failed — try again' });
  }
});

// ── Helper: fetch sub profile for current user ──
async function getSubProfile(userId) {
  const r = await pool.query(
    `SELECT sp.* FROM sub_profiles sp
     JOIN users u ON u.id = $1
     WHERE sp.user_id = $1 OR (sp.org_id = u.org_id AND u.org_id IS NOT NULL)
     LIMIT 1`, [userId]
  );
  return r.rows[0] || null;
}

// ── GovCon AI Coach: general chat ──
router.post('/general', auth, async (req, res) => {
  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'Messages required' });

  try {
    const subProfile = await getSubProfile(req.userId);
    const reply = await chatWithCoach(messages, { subProfile });
    res.json({ reply });
  } catch (err) {
    console.error('Coach chat error:', err.message);
    res.status(500).json({ error: 'AI Coach is temporarily unavailable — try again' });
  }
});

// ── GovCon AI Coach: opportunity-specific chat ──
router.post('/opportunity/:oppId', auth, async (req, res) => {
  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'Messages required' });

  try {
    const subProfile = await getSubProfile(req.userId);

    const oppR = await pool.query(
      `SELECT o.* FROM opportunities o
       JOIN users u ON u.id = $2
       WHERE o.id = $1 AND (o.org_id = u.org_id OR o.org_id IS NULL)`,
      [req.params.oppId, req.userId]
    );
    const opportunity = oppR.rows[0] || null;

    const reply = await chatWithCoach(messages, { subProfile, opportunity });
    res.json({ reply });
  } catch (err) {
    console.error('Opportunity chat error:', err.message);
    res.status(500).json({ error: 'AI Coach is temporarily unavailable — try again' });
  }
});

// ── GovCon AI Coach: prime-specific chat ──
router.post('/prime/:primeId', auth, async (req, res) => {
  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'Messages required' });

  try {
    const subProfile = await getSubProfile(req.userId);

    const primeR = await pool.query(
      `SELECT p.* FROM primes p
       JOIN users u ON u.id = $2
       WHERE p.id = $1 AND (p.org_id = u.org_id OR p.org_id IS NULL)`,
      [req.params.primeId, req.userId]
    );
    const prime = primeR.rows[0] || null;

    const reply = await chatWithCoach(messages, { subProfile, prime });
    res.json({ reply });
  } catch (err) {
    console.error('Prime chat error:', err.message);
    res.status(500).json({ error: 'AI Coach is temporarily unavailable — try again' });
  }
});

module.exports = router;
