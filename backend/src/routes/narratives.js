const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Get all narratives for org
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const r = await pool.query(
      'SELECT * FROM past_performance_narratives WHERE org_id=$1 ORDER BY created_at DESC',
      [orgId]
    );
    res.json({ narratives: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate a narrative using AI
router.post('/generate', auth, async (req, res) => {
  try {
    const { contractName, agency, period, value, description, outcomes, targetOpportunityId } = req.body;
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Build prompt for narrative generation
    const prompt = `You are a federal government contracting expert. Generate a professional past performance narrative for the following contract:

Contract Name: ${contractName}
Agency: ${agency}
Period of Performance: ${period}
Contract Value: ${value}
Description: ${description}
Outcomes/Results: ${outcomes}

The narrative should:
- Follow standard government format (approximately 300-400 words)
- Highlight key accomplishments and results
- Demonstrate relevance to federal contracting
- Use professional, formal language
- Include specific metrics where possible
- Be formatted as a paragraph (not bulleted)

Generate the narrative:`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const generatedText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Save narrative to database
    const r = await pool.query(
      `INSERT INTO past_performance_narratives (org_id, user_id, title, content, opportunity_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
      [orgId, req.userId, contractName, generatedText, targetOpportunityId || null]
    );

    res.status(201).json({
      narrative: r.rows[0],
      generated_text: generatedText,
    });
  } catch (err) {
    console.error('Narrative generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save/create a narrative
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, opportunityId } = req.body;
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const r = await pool.query(
      `INSERT INTO past_performance_narratives (org_id, user_id, title, content, opportunity_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
      [orgId, req.userId, title, content, opportunityId || null]
    );

    res.status(201).json({ narrative: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a narrative
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content } = req.body;
    const narrativeId = parseInt(req.params.id, 10);

    // Verify ownership
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const userOrgId = userR.rows[0]?.org_id;

    const nR = await pool.query('SELECT org_id FROM past_performance_narratives WHERE id=$1', [narrativeId]);
    if (nR.rows.length === 0) return res.status(404).json({ error: 'Narrative not found' });
    if (nR.rows[0].org_id !== userOrgId) return res.status(403).json({ error: 'Unauthorized' });

    const r = await pool.query(
      `UPDATE past_performance_narratives SET title=$1, content=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
      [title, content, narrativeId]
    );

    res.json({ narrative: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a narrative
router.delete('/:id', auth, async (req, res) => {
  try {
    const narrativeId = parseInt(req.params.id, 10);

    // Verify ownership
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const userOrgId = userR.rows[0]?.org_id;

    const nR = await pool.query('SELECT org_id FROM past_performance_narratives WHERE id=$1', [narrativeId]);
    if (nR.rows.length === 0) return res.status(404).json({ error: 'Narrative not found' });
    if (nR.rows[0].org_id !== userOrgId) return res.status(403).json({ error: 'Unauthorized' });

    await pool.query('DELETE FROM past_performance_narratives WHERE id=$1', [narrativeId]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
