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


    // Build profile: org-level company context + user's personal name/role/tone
    const userResult = await pool.query('SELECT org_id, email, full_name FROM users WHERE id=$1', [req.userId]);
    const orgId = userResult.rows[0]?.org_id;
    const userEmail = userResult.rows[0]?.email || '';

    // Get org-level profile (the shared company context set by admin)
    let orgProfile = null;
    if (orgId) {
      const orgProfileResult = await pool.query(
        'SELECT * FROM company_profiles WHERE org_id=$1 ORDER BY updated_at DESC LIMIT 1', [orgId]
      );
      orgProfile = orgProfileResult.rows[0] || null;
    }

    // Get user's personal profile (name, role, tone)
    const userProfileResult = await pool.query(
      'SELECT * FROM company_profiles WHERE user_id=$1', [req.userId]
    );
    const userProfile = userProfileResult.rows[0] || null;

    // Merge: org context is the base, user personal settings override name/role/tone
    const profile = {
      ...(orgProfile || {}),
      ...(userProfile || {}),
      // Always use the org-level product context if available
      name: orgProfile?.name || userProfile?.name || 'SumX AI',
      product: orgProfile?.product || userProfile?.product || '',
      value_props: orgProfile?.value_props || userProfile?.value_props || '',
      icp: orgProfile?.icp || userProfile?.icp || '',
      target_titles: orgProfile?.target_titles || userProfile?.target_titles || '',
      objections: orgProfile?.objections || userProfile?.objections || '',
      // User-specific overrides
      sender_name: userProfile?.sender_name || userResult.rows[0]?.full_name || 'Your rep',
      sender_role: userProfile?.sender_role || 'AE',
      tone: userProfile?.tone || orgProfile?.tone || 'direct and confident',
      custom_tone: userProfile?.custom_tone || orgProfile?.custom_tone || '',
    };

    if (!orgProfile && !userProfile) return res.status(400).json({ error: 'No company profile found. Set up your profile first.' });

    // Check usage limit
    
    // Whitelist internal domains - unlimited access
    const whitelistedDomains = ['sumxai.com', 'sumx.ai'];
    const emailDomain = userEmail.split('@')[1]?.toLowerCase();
    const isWhitelisted = whitelistedDomains.includes(emailDomain);

    if (orgId && !isWhitelisted) {
      const org = await pool.query('SELECT playbooks_used, playbooks_limit, plan FROM organizations WHERE id=$1', [orgId]);
      const o = org.rows[0];
      if (o && (o.playbooks_used || 0) >= (o.playbooks_limit || 10)) {
        return res.status(403).json({ 
          error: `Playbook limit reached (${o.playbooks_used}/${o.playbooks_limit}). Upgrade your plan to continue.`,
          upgrade: true
        });
      }
      if (orgId) await pool.query('UPDATE organizations SET playbooks_used = playbooks_used + 1 WHERE id=$1', [orgId]);
    }

    await pool.query('UPDATE leads SET status=$1 WHERE id=$2', ['generating', lead.id]);

    let playbook;
    try {
      playbook = await generatePlaybook(lead, profile);
    } catch (genErr) {
      await pool.query('UPDATE leads SET status=$1 WHERE id=$2', ['error', lead.id]);
      return res.status(500).json({ error: genErr.message });
    }

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
    await pool.query('UPDATE leads SET status=$1 WHERE id=$2', ['error', req.params.leadId]).catch(()=>{});
    res.status(500).json({ error: err.message });
  }
});

// Generate playbooks for all leads in a list - with concurrency control
router.post('/generate-list/:listId', auth, async (req, res) => {
  try {
    const leadsResult = await pool.query(
      'SELECT * FROM leads WHERE list_id=$1 AND user_id=$2 ORDER BY icp_score DESC NULLS LAST, id ASC',
      [req.params.listId, req.userId]
    );
    const leads = leadsResult.rows;
    if (!leads.length) return res.status(400).json({ error: 'No leads in list' });


    // Build profile: org-level company context + user's personal name/role/tone
    const userResult = await pool.query('SELECT org_id, email, full_name FROM users WHERE id=$1', [req.userId]);
    const orgId = userResult.rows[0]?.org_id;
    const userEmail = userResult.rows[0]?.email || '';

    // Get org-level profile (the shared company context set by admin)
    let orgProfile = null;
    if (orgId) {
      const orgProfileResult = await pool.query(
        'SELECT * FROM company_profiles WHERE org_id=$1 ORDER BY updated_at DESC LIMIT 1', [orgId]
      );
      orgProfile = orgProfileResult.rows[0] || null;
    }

    // Get user's personal profile (name, role, tone)
    const userProfileResult = await pool.query(
      'SELECT * FROM company_profiles WHERE user_id=$1', [req.userId]
    );
    const userProfile = userProfileResult.rows[0] || null;

    // Merge: org context is the base, user personal settings override name/role/tone
    const profile = {
      ...(orgProfile || {}),
      ...(userProfile || {}),
      // Always use the org-level product context if available
      name: orgProfile?.name || userProfile?.name || 'SumX AI',
      product: orgProfile?.product || userProfile?.product || '',
      value_props: orgProfile?.value_props || userProfile?.value_props || '',
      icp: orgProfile?.icp || userProfile?.icp || '',
      target_titles: orgProfile?.target_titles || userProfile?.target_titles || '',
      objections: orgProfile?.objections || userProfile?.objections || '',
      // User-specific overrides
      sender_name: userProfile?.sender_name || userResult.rows[0]?.full_name || 'Your rep',
      sender_role: userProfile?.sender_role || 'AE',
      tone: userProfile?.tone || orgProfile?.tone || 'direct and confident',
      custom_tone: userProfile?.custom_tone || orgProfile?.custom_tone || '',
    };

    if (!orgProfile && !userProfile) return res.status(400).json({ error: 'No company profile found' });

    res.json({ message: 'Generation started', total: leads.length });

    // Process 2 at a time to balance speed vs cost
    const CONCURRENCY = 2;
    for (let i = 0; i < leads.length; i += CONCURRENCY) {
      const batch = leads.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (lead) => {
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
          console.error(`Failed lead ${lead.id}:`, err.message);
          await pool.query('UPDATE leads SET status=$1 WHERE id=$2', ['error', lead.id]);
        }
      }));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Cancel generation for a lead
router.post('/cancel/:leadId', auth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE leads SET status='pending' WHERE id=$1 AND user_id=$2 AND status='generating'",
      [req.params.leadId, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel all generating leads in a list
router.post('/cancel-list/:listId', auth, async (req, res) => {
  try {
    await pool.query(
      "UPDATE leads SET status='pending' WHERE list_id=$1 AND user_id=$2 AND status='generating'",
      [req.params.listId, req.userId]
    );
    res.json({ success: true });
  } catch (err) {
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

