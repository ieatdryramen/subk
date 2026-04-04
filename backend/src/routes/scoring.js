const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const scoreLeads = async (leads, profile) => {
  const batchSize = 10;
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const prompt = `You are a B2B sales qualification expert. Score each lead against the ICP below.

ICP: ${profile.icp}
Target titles: ${profile.target_titles}
Product: ${profile.product}

Score each lead 1-100 based on how well they match the ICP. Consider: company size/type, title seniority and relevance, industry fit.

LEADS TO SCORE:
${batch.map((l, idx) => `${idx + 1}. Name: ${l.full_name || 'Unknown'} | Title: ${l.title || 'Unknown'} | Company: ${l.company || 'Unknown'}`).join('\n')}

Return a JSON array with exactly ${batch.length} objects in the same order:
[{"score": 85, "reason": "VP-level title at a mid-market GovCon company that fits ICP exactly"}, ...]

Return ONLY the JSON array.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim().replace(/^```json|^```|```$/gm, '').trim();
    let scores;
    try {
      scores = JSON.parse(text);
    } catch (parseErr) {
      console.error('ICP scoring JSON parse error:', text);
      continue; // Skip this batch, try next
    }

    for (let j = 0; j < batch.length; j++) {
      const s = scores[j];
      if (s) {
        // Validate score is a number between 1-100
        const score = Math.max(1, Math.min(100, Math.round(Number(s.score) || 50)));
        await pool.query(
          'UPDATE leads SET icp_score=$1, icp_reason=$2 WHERE id=$3',
          [score, s.reason || '', batch[j].id]
        );
      }
    }
  }
};

const getProfile = async (userId) => {
  // Use org profile merged with user profile (same as playbooks)
  const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [userId]);
  const orgId = userR.rows[0]?.org_id;
  let orgProfile = null;
  if (orgId) {
    const orgR = await pool.query('SELECT * FROM company_profiles WHERE org_id=$1 ORDER BY updated_at DESC LIMIT 1', [orgId]);
    orgProfile = orgR.rows[0] || null;
  }
  const userR2 = await pool.query('SELECT * FROM company_profiles WHERE user_id=$1', [userId]);
  const userProfile = userR2.rows[0] || null;
  return {
    icp: orgProfile?.icp || userProfile?.icp || '',
    target_titles: orgProfile?.target_titles || userProfile?.target_titles || '',
    product: orgProfile?.product || userProfile?.product || '',
  };
};

// Score all leads in a list
router.post('/score-list/:listId', auth, async (req, res) => {
  try {
    const leadsResult = await pool.query(
      'SELECT * FROM leads WHERE list_id=$1 AND user_id=$2 ORDER BY id ASC',
      [req.params.listId, req.userId]
    );
    const leads = leadsResult.rows;
    if (!leads.length) return res.status(400).json({ error: 'No leads in list' });

    const profile = await getProfile(req.userId);
    if (!profile.icp) return res.status(400).json({ error: 'No company profile found' });

    res.json({ message: 'Scoring started', total: leads.length });
    await scoreLeads(leads, profile);
    console.log(`Scored ${leads.length} leads for list ${req.params.listId}`);
  } catch (err) {
    console.error('Scoring error:', err);
  }
});

// Score a single lead
router.post('/score/:leadId', auth, async (req, res) => {
  try {
    const leadR = await pool.query('SELECT * FROM leads WHERE id=$1', [req.params.leadId]);
    if (!leadR.rows.length) return res.status(404).json({ error: 'Lead not found' });

    const profile = await getProfile(req.userId);
    if (!profile.icp) return res.status(400).json({ error: 'No company profile found' });

    await scoreLeads([leadR.rows[0]], profile);
    const updated = await pool.query('SELECT icp_score, icp_reason FROM leads WHERE id=$1', [req.params.leadId]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Single score error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
