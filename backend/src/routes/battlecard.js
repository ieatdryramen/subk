const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/generate/:leadId', auth, async (req, res) => {
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
      'SELECT research FROM playbooks WHERE lead_id=$1', [lead.id]
    );
    const research = playbookResult.rows[0]?.research || '';

    const prompt = `You are a sales enablement expert creating a battlecard for a rep about to sell to ${lead.full_name} at ${lead.company}.

SELLER:
- Company: ${profile.name}
- Product: ${profile.product}
- Value props: ${profile.value_props}

PROSPECT RESEARCH:
${research}

PROSPECT:
- Name: ${lead.full_name}
- Title: ${lead.title}
- Company: ${lead.company}

Create a concise battlecard as a JSON object:
{
  "likely_incumbent": "What solution they are probably using today based on their company size, industry, and title. Be specific but don't name-drop unnecessarily.",
  "incumbent_weaknesses": "3-4 specific weaknesses or gaps in typical incumbent solutions for a company like theirs. Focus on pain points relevant to their role.",
  "our_strengths": "3-4 specific ways ${profile.name} wins against typical alternatives for this prospect's situation.",
  "landmines": "3 questions to ask that will reveal pain with their current solution. These should make them realize they have a problem.",
  "traps_to_avoid": "2-3 things NOT to say or do when selling to this person or company type.",
  "proof_points": "2-3 specific outcomes or metrics to reference that would resonate with this prospect's role and company.",
  "one_liner": "The single most compelling 15-word positioning statement for this specific prospect."
}

Return ONLY the JSON.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim().replace(/^```json|^```|```$/gm, '').trim();
    const battlecard = JSON.parse(text);
    res.json(battlecard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
