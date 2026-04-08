const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const Anthropic = require('@anthropic-ai/sdk');
const { createNotification } = require('../services/notify');
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

    // Notify user that scoring completed (non-blocking)
    Promise.resolve().then(async () => {
      try {
        const listR = await pool.query('SELECT name FROM lists WHERE id=$1', [req.params.listId]);
        const listName = listR.rows[0]?.name || 'your list';
        await createNotification(
          req.userId,
          'scoring_complete',
          'ICP scoring completed',
          `Scored ${leads.length} leads in "${listName}"`,
          `/lists/${req.params.listId}`
        );
      } catch (e) { console.error('Notification creation error:', e.message); }
    });
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
    res.status(500).json({ error: 'Scoring failed — try again' });
  }
});

// Get pipeline health scores for all leads in user's pipeline
router.get('/pipeline-health', auth, async (req, res) => {
  try {
    // Get all leads for the user (across all lists)
    const leadsResult = await pool.query(`
      SELECT l.*, p.has_playbook
      FROM leads l
      LEFT JOIN (SELECT DISTINCT lead_id, true as has_playbook FROM playbooks) p ON l.id = p.lead_id
      WHERE l.user_id = $1
      ORDER BY l.id ASC
    `, [req.userId]);

    const leads = leadsResult.rows;

    // Get the most recent touch timestamps for each lead via sequence_events
    const touchTimestampsResult = await leads.length > 0 ? pool.query(`
      SELECT lead_id, MAX(completed_at) as last_touch_at
      FROM sequence_events
      WHERE user_id = $1 AND completed_at IS NOT NULL
      GROUP BY lead_id
    `, [req.userId]) : { rows: [] };

    const touchMap = {};
    touchTimestampsResult.rows.forEach(row => {
      touchMap[row.lead_id] = row.last_touch_at;
    });

    // Calculate scores
    const now = new Date();
    const healthScores = leads.map(lead => {
      const lastTouchAt = touchMap[lead.id];
      const daysSinceLastTouch = lastTouchAt
        ? Math.floor((now - new Date(lastTouchAt)) / (1000 * 60 * 60 * 24))
        : 999;

      // Calculate win probability (0-100)
      // Weights: icp_score (0.3), sequence_stage progress (0.25), days_since_last_touch (0.2 - decays), has_playbook (0.15), engagement_signals (0.1)
      let winProb = 0;

      // ICP score component (0.3 weight)
      const icpScore = lead.icp_score || 0;
      winProb += Math.min(100, icpScore) * 0.3;

      // Sequence stage progress (0.25 weight)
      const stageProgressMap = {
        'not_started': 0,
        'in_progress_1': 5, 'in_progress_2': 10, 'in_progress_3': 15,
        'in_progress_4': 20, 'in_progress_5': 25, 'in_progress_6': 30,
        'in_progress_7': 35, 'in_progress_8': 40, 'in_progress_9': 45,
        'in_progress_10': 50,
        'mefu': 60,
        'meeting_booked': 80,
        'completed': 100,
      };
      const stageProgress = stageProgressMap[lead.sequence_stage || 'not_started'] || 0;
      winProb += stageProgress * 0.25;

      // Days since last touch decay (0.2 weight)
      // Full points if touched in last 3 days, decays to 0 at 30+ days
      let touchDecay = 100;
      if (daysSinceLastTouch > 3) {
        touchDecay = Math.max(0, 100 - ((daysSinceLastTouch - 3) / 27) * 100);
      }
      winProb += touchDecay * 0.2;

      // Has playbook (0.15 weight)
      if (lead.has_playbook) {
        winProb += 100 * 0.15;
      }

      // Engagement signals (0.1 weight) - for now, simple signal if any touchpoints are done
      // In practice, could track opens, clicks, replies
      let engagementScore = 0;
      const stageStr = lead.sequence_stage || '';
      if (stageStr.includes('in_progress') || stageStr === 'mefu' || stageStr === 'meeting_booked' || stageStr === 'completed') {
        engagementScore = 50;
      }
      winProb += engagementScore * 0.1;

      winProb = Math.round(winProb);

      // Determine risk level
      let riskLevel = 'cold';
      if (winProb > 70) {
        riskLevel = 'hot';
      } else if (winProb >= 40) {
        riskLevel = 'warm';
      } else {
        riskLevel = 'cold';
      }

      // At-risk if no touch in 7+ days
      if (daysSinceLastTouch >= 7) {
        riskLevel = 'at_risk';
      }

      // Suggest action
      let suggestedAction = '';
      if (daysSinceLastTouch >= 7) {
        suggestedAction = `Follow up - no contact in ${daysSinceLastTouch} days`;
      } else if (winProb > 70) {
        suggestedAction = 'Ready for proposal';
      } else if (winProb >= 40) {
        suggestedAction = 'Continue sequence';
      } else if (winProb < 40 && !lead.has_playbook) {
        suggestedAction = 'Assign playbook';
      } else {
        suggestedAction = 'Schedule discovery call';
      }

      return {
        lead_id: lead.id,
        win_probability: winProb,
        risk_level: riskLevel,
        suggested_action: suggestedAction,
        days_since_touch: daysSinceLastTouch,
      };
    });

    res.json(healthScores);
  } catch (err) {
    console.error('Pipeline health error:', err);
    res.status(500).json({ error: 'Failed to compute pipeline health' });
  }
});

module.exports = router;
