const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/score-list/:listId', auth, async (req, res) => {
  try {
    const leadsResult = await pool.query(
      'SELECT * FROM leads WHERE list_id=$1 AND user_id=$2 ORDER BY id ASC',
      [req.params.listId, req.userId]
    );
    const leads = leadsResult.rows;
    if (!leads.length) return res.status(400).json({ error: 'No leads in list' });

    const profileResult = await pool.query('SELECT * FROM company_profiles WHERE user_id=$1', [req.userId]);
    if (!profileResult.rows.length) return res.status(400).json({ error: 'No company profile' });
    const profile = profileResult.rows[0];

    res.json({ message: 'Scoring started', total: leads.length });

    // Score in batches of 10
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
[{"score": 85, "reason": "VP-level title at a mid-market company that fits ICP exactly"}, ...]

Return ONLY the JSON array.`;

      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.content[0].text.trim().replace(/^```json|^```|```$/gm, '').trim();
      const scores = JSON.parse(text);

      for (let j = 0; j < batch.length; j++) {
        const s = scores[j];
        if (s) {
          await pool.query(
            'UPDATE leads SET icp_score=$1, icp_reason=$2 WHERE id=$3',
            [s.score, s.reason, batch[j].id]
          );
        }
      }
    }

    console.log(`Scored ${leads.length} leads for list ${req.params.listId}`);
  } catch (err) {
    console.error('Scoring error:', err);
  }
});

module.exports = router;
