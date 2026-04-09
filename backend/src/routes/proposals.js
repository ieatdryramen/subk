const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { aiLimiter } = require('../middleware/rateLimiter');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Get all proposals for user's org, ordered by deadline ASC
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const r = await pool.query(
      'SELECT * FROM proposals WHERE org_id=$1 ORDER BY deadline ASC NULLS LAST, created_at DESC',
      [orgId]
    );
    res.json({ proposals: r.rows });
  } catch (err) {
    console.error('GET /proposals error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a new proposal
router.post('/', auth, async (req, res) => {
  try {
    const { opportunity_id, title, status, deadline, team_members, sections, estimated_value } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const result = await pool.query(
      `INSERT INTO proposals (org_id, user_id, opportunity_id, title, status, deadline, team_members, sections, estimated_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        orgId,
        req.userId,
        opportunity_id || null,
        title,
        status || 'drafting',
        deadline || null,
        JSON.stringify(team_members || []),
        JSON.stringify(sections || []),
        estimated_value || 0,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /proposals error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single proposal with details
router.get('/:id', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const r = await pool.query(
      'SELECT * FROM proposals WHERE id=$1 AND org_id=$2',
      [req.params.id, orgId]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json(r.rows[0]);
  } catch (err) {
    console.error('GET /proposals/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update proposal (status, sections progress, etc.)
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, sections, notes, team_members, estimated_value } = req.body;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Verify ownership
    const checkR = await pool.query(
      'SELECT * FROM proposals WHERE id=$1 AND org_id=$2',
      [req.params.id, orgId]
    );

    if (checkR.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = checkR.rows[0];
    const updatedStatus = status !== undefined ? status : proposal.status;
    const updatedSections = sections !== undefined ? JSON.stringify(sections) : proposal.sections;
    const updatedNotes = notes !== undefined ? notes : proposal.notes;
    const updatedTeamMembers = team_members !== undefined ? JSON.stringify(team_members) : proposal.team_members;
    const updatedValue = estimated_value !== undefined ? estimated_value : proposal.estimated_value;

    const result = await pool.query(
      `UPDATE proposals SET status=$1, sections=$2, notes=$3, team_members=$4, estimated_value=$5, updated_at=NOW()
       WHERE id=$6 AND org_id=$7
       RETURNING *`,
      [updatedStatus, updatedSections, updatedNotes, updatedTeamMembers, updatedValue, req.params.id, orgId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /proposals/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/proposals/:id/sections
 * Update specific proposal sections with AI-generated or edited content
 */
router.put('/:id/sections', auth, async (req, res) => {
  try {
    const { sections } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({ error: 'sections must be an array' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Verify ownership
    const checkR = await pool.query(
      'SELECT * FROM proposals WHERE id=$1 AND org_id=$2',
      [req.params.id, orgId]
    );

    if (checkR.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = checkR.rows[0];
    const currentSections = proposal.sections ? JSON.parse(proposal.sections) : [];

    // Merge new sections with existing ones
    const updatedSections = currentSections.map(s => {
      const newSection = sections.find(ns => ns.name === s.name);
      return newSection || s;
    });

    // Add any new sections that weren't in the original list
    for (const newSection of sections) {
      if (!currentSections.find(s => s.name === newSection.name)) {
        updatedSections.push(newSection);
      }
    }

    const result = await pool.query(
      `UPDATE proposals SET sections=$1, updated_at=NOW()
       WHERE id=$2 AND org_id=$3
       RETURNING *`,
      [JSON.stringify(updatedSections), req.params.id, orgId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /proposals/:id/sections error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/proposals/:id/generate-draft
 * Generate AI proposal section draft using Claude
 * Body: { section: 'executive_summary' | 'technical_approach' | 'management_approach' | 'past_performance' }
 */
router.post('/:id/generate-draft', aiLimiter, auth, async (req, res) => {
  try {
    const { section } = req.body;

    if (!section) {
      return res.status(400).json({ error: 'section is required' });
    }

    const validSections = ['executive_summary', 'technical_approach', 'management_approach', 'past_performance'];
    if (!validSections.includes(section)) {
      return res.status(400).json({ error: `section must be one of: ${validSections.join(', ')}` });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Get proposal and linked opportunity
    const propR = await pool.query(
      'SELECT * FROM proposals WHERE id=$1 AND org_id=$2',
      [req.params.id, orgId]
    );

    if (propR.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = propR.rows[0];
    const opportunityId = proposal.opportunity_id;

    // Gather context for AI
    let context = '';

    if (opportunityId) {
      const oppR = await pool.query(
        'SELECT * FROM opportunities WHERE id=$1',
        [opportunityId]
      );
      if (oppR.rows.length > 0) {
        const opp = oppR.rows[0];
        context += `Opportunity: ${opp.title}\n`;
        context += `Agency: ${opp.agency}\n`;
        context += `Description: ${opp.description || 'N/A'}\n`;
      }
    }

    // Get company profile
    const companyR = await pool.query(
      'SELECT * FROM company_profiles WHERE org_id=$1 LIMIT 1',
      [orgId]
    );
    if (companyR.rows.length > 0) {
      const company = companyR.rows[0];
      context += `Company: ${company.name}\n`;
      context += `Products/Services: ${company.product || 'N/A'}\n`;
      context += `Value Propositions: ${company.value_props || 'N/A'}\n`;
    }

    // Get sub profile if applicable
    const subR = await pool.query(
      'SELECT * FROM sub_profiles WHERE user_id=$1 LIMIT 1',
      [req.userId]
    );
    if (subR.rows.length > 0) {
      const sub = subR.rows[0];
      context += `Subcontractor Capabilities: ${sub.capabilities || 'N/A'}\n`;
    }

    // Get past performance
    const ppR = await pool.query(
      'SELECT * FROM past_performance WHERE user_id=$1 LIMIT 3',
      [req.userId]
    );
    if (ppR.rows.length > 0) {
      context += `Past Performance:\n`;
      for (const pp of ppR.rows) {
        context += `- ${pp.contract_title} (${pp.agency}): $${pp.award_amount} (${pp.period_start} to ${pp.period_end})\n`;
      }
    }

    // Build prompt based on section type
    let sectionPrompt = '';
    switch (section) {
      case 'executive_summary':
        sectionPrompt = `Write a compelling executive summary for a government proposal. Keep it to 2-3 paragraphs. Focus on value delivered and how the company's solution uniquely addresses the customer's needs.`;
        break;
      case 'technical_approach':
        sectionPrompt = `Write a detailed technical approach section explaining how the proposed solution will be implemented. Include methodology, key technical decisions, and risk mitigation strategies.`;
        break;
      case 'management_approach':
        sectionPrompt = `Write a management approach section outlining organizational structure, roles and responsibilities, staffing plan, and project management methodology.`;
        break;
      case 'past_performance':
        sectionPrompt = `Write a past performance narrative highlighting relevant previous contracts demonstrating capability to deliver this type of work.`;
        break;
    }

    const prompt = `You are an expert government proposal writer. Based on the following context, ${sectionPrompt}

Context:
${context}

Generate the proposal section. Write in professional, formal language appropriate for government proposals. Be specific and quantifiable where possible.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const draft = message.content[0].type === 'text' ? message.content[0].text : '';

    res.json({
      success: true,
      draft,
      section,
    });
  } catch (err) {
    console.error('POST /proposals/:id/generate-draft error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
