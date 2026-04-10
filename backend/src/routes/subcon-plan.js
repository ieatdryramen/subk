const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// List subcontracting plans for org
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const r = await pool.query(
      'SELECT * FROM subcon_plans WHERE org_id=$1 ORDER BY created_at DESC',
      [orgId]
    );
    res.json({ plans: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new subcontracting plan
router.post('/', auth, async (req, res) => {
  try {
    const { title, contract_value } = req.body;
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const val = parseFloat(contract_value) || 0;
    if (val < 0) return res.status(400).json({ error: 'Contract value cannot be negative' });

    const r = await pool.query(
      `INSERT INTO subcon_plans (org_id, title, contract_value, status)
       VALUES ($1, $2, $3, 'draft') RETURNING *`,
      [orgId, title, Math.abs(val)]
    );

    res.status(201).json({ plan: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a subcontracting plan
router.put('/:id', auth, async (req, res) => {
  try {
    const planId = parseInt(req.params.id, 10);
    const { title, contract_value, sb_goal_pct, sdb_goal_pct, wosb_goal_pct, hubzone_goal_pct, sdvosb_goal_pct, identified_subs, actuals, status } = req.body;

    // Verify ownership
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const userOrgId = userR.rows[0]?.org_id;

    const pR = await pool.query('SELECT org_id FROM subcon_plans WHERE id=$1', [planId]);
    if (pR.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
    if (pR.rows[0].org_id !== userOrgId) return res.status(403).json({ error: 'Unauthorized' });

    const updates = [];
    const values = [];
    let paramNum = 1;

    if (title !== undefined) {
      updates.push(`title=$${paramNum++}`);
      values.push(title);
    }
    if (contract_value !== undefined) {
      updates.push(`contract_value=$${paramNum++}`);
      values.push(contract_value);
    }
    if (sb_goal_pct !== undefined) {
      updates.push(`sb_goal_pct=$${paramNum++}`);
      values.push(sb_goal_pct);
    }
    if (sdb_goal_pct !== undefined) {
      updates.push(`sdb_goal_pct=$${paramNum++}`);
      values.push(sdb_goal_pct);
    }
    if (wosb_goal_pct !== undefined) {
      updates.push(`wosb_goal_pct=$${paramNum++}`);
      values.push(wosb_goal_pct);
    }
    if (hubzone_goal_pct !== undefined) {
      updates.push(`hubzone_goal_pct=$${paramNum++}`);
      values.push(hubzone_goal_pct);
    }
    if (sdvosb_goal_pct !== undefined) {
      updates.push(`sdvosb_goal_pct=$${paramNum++}`);
      values.push(sdvosb_goal_pct);
    }
    if (identified_subs !== undefined) {
      updates.push(`identified_subs=$${paramNum++}`);
      values.push(JSON.stringify(identified_subs));
    }
    if (actuals !== undefined) {
      updates.push(`actuals=$${paramNum++}`);
      values.push(JSON.stringify(actuals));
    }
    if (status !== undefined) {
      updates.push(`status=$${paramNum++}`);
      values.push(status);
    }

    updates.push(`updated_at=NOW()`);
    values.push(planId);

    if (updates.length <= 1) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const query = `UPDATE subcon_plans SET ${updates.join(', ')} WHERE id=$${paramNum} RETURNING *`;
    const result = await pool.query(query, values);

    res.json({ plan: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get goal percentages for a plan
router.get('/:id/goals', auth, async (req, res) => {
  try {
    const planId = parseInt(req.params.id, 10);

    const r = await pool.query(
      'SELECT contract_value, sb_goal_pct, sdb_goal_pct, wosb_goal_pct, hubzone_goal_pct, sdvosb_goal_pct FROM subcon_plans WHERE id=$1',
      [planId]
    );

    if (r.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

    const plan = r.rows[0];
    const contractValue = parseFloat(plan.contract_value) || 0;

    const goals = {
      SB: {
        percentage: parseFloat(plan.sb_goal_pct) || 23,
        dollar_amount: (contractValue * ((parseFloat(plan.sb_goal_pct) || 23) / 100)),
        description: 'Small Business (8(a), HUBZone, WOSB, or SDVOSB)',
      },
      SDB: {
        percentage: parseFloat(plan.sdb_goal_pct) || 5,
        dollar_amount: (contractValue * ((parseFloat(plan.sdb_goal_pct) || 5) / 100)),
        description: 'Small Disadvantaged Business',
      },
      WOSB: {
        percentage: parseFloat(plan.wosb_goal_pct) || 5,
        dollar_amount: (contractValue * ((parseFloat(plan.wosb_goal_pct) || 5) / 100)),
        description: 'Women-Owned Small Business',
      },
      HUBZone: {
        percentage: parseFloat(plan.hubzone_goal_pct) || 3,
        dollar_amount: (contractValue * ((parseFloat(plan.hubzone_goal_pct) || 3) / 100)),
        description: 'Historically Underutilized Business Zone',
      },
      SDVOSB: {
        percentage: parseFloat(plan.sdvosb_goal_pct) || 3,
        dollar_amount: (contractValue * ((parseFloat(plan.sdvosb_goal_pct) || 3) / 100)),
        description: 'Service-Disabled Veteran-Owned Small Business',
      },
    };

    res.json({ goals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate a subcontracting plan using AI
router.post('/:id/generate', auth, async (req, res) => {
  try {
    const planId = parseInt(req.params.id, 10);

    // Get plan data
    const r = await pool.query(
      'SELECT * FROM subcon_plans WHERE id=$1',
      [planId]
    );

    if (r.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

    const plan = r.rows[0];
    const subs = plan.identified_subs ? JSON.parse(plan.identified_subs) : [];

    // Build prompt
    const subsList = subs.map(s => `- ${s.company_name || s.name} (${s.certifications || 'General'}) - Estimated Value: $${s.estimated_value || 0}`).join('\n');

    const prompt = `You are a federal government contracting expert specializing in subcontracting plans per FAR 19.704. Generate a professional subcontracting plan based on this information:

Prime Contract Title: ${plan.title}
Contract Value: $${parseInt(plan.contract_value) || 0}
Small Business Goal: ${parseFloat(plan.sb_goal_pct) || 23}%
Small Disadvantaged Business Goal: ${parseFloat(plan.sdb_goal_pct) || 5}%
Women-Owned Small Business Goal: ${parseFloat(plan.wosb_goal_pct) || 5}%
HUBZone Goal: ${parseFloat(plan.hubzone_goal_pct) || 3}%
Service-Disabled VOSB Goal: ${parseFloat(plan.sdvosb_goal_pct) || 3}%

Identified Subcontractors:
${subsList || '(None identified yet)'}

Generate a comprehensive subcontracting plan that includes:
1. Executive Summary
2. Statement of goals and percentages
3. Outreach and recruitment efforts
4. Subcontractor identification (where applicable)
5. Implementation procedures
6. Monitoring and reporting

The plan should be professional, formal, and compliant with FAR 19.704 requirements. Format as a continuous narrative (not bulleted) approximately 400-500 words.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1536,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const generatedText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Update plan with generated text
    const updateR = await pool.query(
      'UPDATE subcon_plans SET plan_text=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [generatedText, planId]
    );

    res.json({
      plan: updateR.rows[0],
      generated_text: generatedText,
    });
  } catch (err) {
    console.error('Subcon plan generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
