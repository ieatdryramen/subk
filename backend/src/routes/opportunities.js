const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { searchOpportunities } = require('../services/govdata');
const { scoreOpportunity } = require('../services/ai');
const { createNotification } = require('../services/notify');

// Get all opportunities for org
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Get total count
    const countR = await pool.query(
      'SELECT COUNT(*) as total FROM opportunities WHERE org_id=$1',
      [orgId]
    );
    const total = parseInt(countR.rows[0].total, 10);

    // Get paginated results
    const r = await pool.query(
      'SELECT * FROM opportunities WHERE org_id=$1 ORDER BY fit_score DESC NULLS LAST, posted_date DESC LIMIT $2 OFFSET $3',
      [orgId, limit, offset]
    );
    res.json({ opportunities: r.rows, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recent opportunities for dashboard
router.get('/recent', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const result = await pool.query(
      `SELECT o.* FROM opportunities o
       JOIN opportunity_searches os ON o.search_id = os.id
       WHERE os.user_id = $1
       ORDER BY o.created_at DESC LIMIT $2`,
      [req.userId, limit]
    );
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM opportunities o
       JOIN opportunity_searches os ON o.search_id = os.id
       WHERE os.user_id = $1`,
      [req.userId]
    );
    res.json({ opportunities: result.rows, total: parseInt(countResult.rows[0].total) });
  } catch (err) {
    console.error('Recent opps error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search live opportunities from SAM.gov + score them
router.post('/search', auth, async (req, res) => {
  const { naics_codes, keywords, agency, set_aside, save_search, search_name } = req.body;
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Check usage limits
    const orgR = await pool.query('SELECT * FROM organizations WHERE id=$1', [orgId]);
    const org = orgR.rows[0];
    if (org.searches_used >= org.searches_limit && org.plan === 'trial') {
      return res.status(402).json({ error: 'Search limit reached. Upgrade to continue.', upgrade: true });
    }

    // Fetch live data from SAM.gov
    const samResult = await searchOpportunities({ naics_codes, keywords, agency, set_aside });
    const opps = samResult.opportunities || [];

    // If SAM.gov returned an error, pass it through but continue with any results we got
    const samError = samResult.error || null;

    // Get sub profile for scoring
    const profileR = await pool.query('SELECT * FROM sub_profiles WHERE user_id=$1', [req.userId]);
    const subProfile = profileR.rows[0];

    // Score each opportunity
    const scored = await Promise.all(opps.map(async opp => {
      if (subProfile) {
        try {
          const score = await scoreOpportunity(opp, subProfile);
          return { ...opp, fit_score: score.score, fit_reason: score.reason };
        } catch (scoreErr) {
          console.error('Scoring error:', scoreErr.message);
          return { ...opp, fit_score: null, fit_reason: null };
        }
      }
      return { ...opp, fit_score: null, fit_reason: null };
    }));

    // Sort by fit score
    scored.sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0));

    // Save search if requested
    let searchId = null;
    if (save_search && search_name) {
      const s = await pool.query(
        'INSERT INTO opportunity_searches (user_id, org_id, name, naics_codes, keywords, agency, set_aside) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [req.userId, orgId, search_name, naics_codes, keywords, agency, set_aside]
      );
      searchId = s.rows[0].id;

      // Save opportunities to DB
      for (const opp of scored) {
        await pool.query(
          `INSERT INTO opportunities (search_id, org_id, sam_notice_id, title, agency, sub_agency, naics_code, set_aside,
           posted_date, response_deadline, description, place_of_performance, primary_contact_name, primary_contact_email,
           solicitation_number, opportunity_url, fit_score, fit_reason)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (sam_notice_id) DO NOTHING`,
          [searchId, orgId, opp.sam_notice_id, opp.title, opp.agency, opp.sub_agency, opp.naics_code,
           opp.set_aside, opp.posted_date, opp.response_deadline, opp.description, opp.place_of_performance,
           opp.primary_contact_name, opp.primary_contact_email, opp.solicitation_number, opp.opportunity_url,
           opp.fit_score, opp.fit_reason]
        ).catch(() => {}); // ignore duplicate errors
      }

      // Increment usage
      await pool.query('UPDATE organizations SET searches_used=searches_used+1 WHERE id=$1', [orgId]);
    }

    // Notify user if high-fit opportunities found (fit_score >= 70) (non-blocking)
    const highFitCount = scored.filter(o => (o.fit_score || 0) >= 70).length;
    if (highFitCount > 0) {
      Promise.resolve().then(async () => {
        try {
          await createNotification(
            req.userId,
            'high_fit_opportunities',
            'High-fit opportunities found',
            `Found ${highFitCount} opportunity(ies) with fit score >= 70 from "${search_name || 'search'}"`,
            `/opportunities`
          );
        } catch (e) { console.error('Notification creation error:', e.message); }
      });
    }

    res.json({ opportunities: scored, search_id: searchId, count: scored.length, sam_error: samError });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update opportunity (status and other fields)
router.put('/:id', auth, async (req, res) => {
  const { status, ...otherFields } = req.body;
  try {
    const oppId = parseInt(req.params.id, 10);

    // Get org_id for user to ensure auth
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const userOrgId = userR.rows[0]?.org_id;

    // Check that opportunity belongs to user's org
    const oppR = await pool.query('SELECT org_id FROM opportunities WHERE id=$1', [oppId]);
    if (oppR.rows.length === 0) return res.status(404).json({ error: 'Opportunity not found' });
    if (oppR.rows[0].org_id !== userOrgId) return res.status(403).json({ error: 'Unauthorized' });

    // Build update query
    const updates = [];
    const values = [];
    let paramNum = 1;

    if (status !== undefined) {
      updates.push(`status=$${paramNum++}`);
      values.push(status);
    }

    // Add other updateable fields as needed
    for (const [key, value] of Object.entries(otherFields)) {
      if (['title', 'description', 'fit_score', 'notes'].includes(key)) {
        updates.push(`${key}=$${paramNum++}`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(oppId);
    const query = `UPDATE opportunities SET ${updates.join(', ')} WHERE id=$${paramNum} RETURNING *`;

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update opportunity status (legacy, kept for backward compatibility)
router.put('/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  try {
    await pool.query('UPDATE opportunities SET status=$1 WHERE id=$2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete opportunity
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM opportunities WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save/bookmark an opportunity
router.post('/save/:id', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `INSERT INTO saved_opportunities (user_id, opportunity_id)
       VALUES ($1,$2)
       ON CONFLICT (user_id, opportunity_id) DO NOTHING
       RETURNING *`,
      [req.userId, req.params.id]
    );
    res.json(r.rows[0] || { user_id: req.userId, opportunity_id: req.params.id, saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unsave/unbookmark an opportunity
router.delete('/save/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM saved_opportunities WHERE user_id=$1 AND opportunity_id=$2',
      [req.userId, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all saved opportunities for user
router.get('/saved', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    // Get total count
    const countR = await pool.query(
      `SELECT COUNT(*) as total FROM opportunities o
       JOIN saved_opportunities so ON so.opportunity_id = o.id
       WHERE so.user_id=$1`,
      [req.userId]
    );
    const total = parseInt(countR.rows[0].total, 10);

    // Get paginated results
    const r = await pool.query(
      `SELECT o.* FROM opportunities o
       JOIN saved_opportunities so ON so.opportunity_id = o.id
       WHERE so.user_id=$1
       ORDER BY so.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );
    res.json({ opportunities: r.rows, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /opportunities/export/csv — export opportunities as CSV
router.get('/export/csv', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const r = await pool.query('SELECT title, agency, naics_code, set_aside, fit_score, status, response_deadline, solicitation_number, place_of_performance, primary_contact_name, primary_contact_email, opportunity_url FROM opportunities WHERE org_id=$1 ORDER BY fit_score DESC NULLS LAST', [orgId]);

    const headers = ['Title', 'Agency', 'NAICS', 'Set-Aside', 'Fit Score', 'Status', 'Deadline', 'Solicitation #', 'Location', 'Contact Name', 'Contact Email', 'URL'];
    const rows = r.rows.map(o => [
      `"${(o.title||'').replace(/"/g, '""')}"`,
      `"${(o.agency||'').replace(/"/g, '""')}"`,
      o.naics_code || '',
      `"${(o.set_aside||'').replace(/"/g, '""')}"`,
      o.fit_score || '',
      o.status || 'new',
      o.response_deadline ? new Date(o.response_deadline).toISOString().split('T')[0] : '',
      o.solicitation_number || '',
      `"${(o.place_of_performance||'').replace(/"/g, '""')}"`,
      `"${(o.primary_contact_name||'').replace(/"/g, '""')}"`,
      o.primary_contact_email || '',
      o.opportunity_url || '',
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=subk-opportunities.csv');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get opportunities grouped by month for timeline visualization
router.get('/timeline', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Get opportunities from last 3 months to next 6 months
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const sixMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 6, 0);

    const r = await pool.query(
      `SELECT id, title, agency, response_deadline, status, value_min, value_max, fit_score
       FROM opportunities
       WHERE org_id=$1 AND response_deadline >= $2 AND response_deadline <= $3
       ORDER BY response_deadline ASC`,
      [orgId, threeMonthsAgo, sixMonthsAhead]
    );

    // Group by month
    const grouped = {};
    r.rows.forEach(opp => {
      if (!opp.response_deadline) return;
      const date = new Date(opp.response_deadline);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(opp);
    });

    res.json({ timeline: grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get next 10 upcoming deadlines
router.get('/upcoming', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const now = new Date();
    const r = await pool.query(
      `SELECT id, title, agency, response_deadline, status, value_min, value_max, fit_score
       FROM opportunities
       WHERE org_id=$1 AND response_deadline > $2 AND status IN ('new', 'pursuing', 'teaming')
       ORDER BY response_deadline ASC
       LIMIT 10`,
      [orgId, now]
    );

    res.json({ opportunities: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get opportunity detail with linked leads, notes, and activity
router.get('/:id/detail', auth, async (req, res) => {
  try {
    const oppId = parseInt(req.params.id, 10);

    // Get opportunity
    const oppR = await pool.query(
      'SELECT * FROM opportunities WHERE id=$1',
      [oppId]
    );
    if (oppR.rows.length === 0) return res.status(404).json({ error: 'Opportunity not found' });
    const opp = oppR.rows[0];

    // Get org_id for user to ensure auth
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const userOrgId = userR.rows[0]?.org_id;
    if (opp.org_id !== userOrgId) return res.status(403).json({ error: 'Unauthorized' });

    // Find linked leads by NAICS or agency match
    const leadsR = await pool.query(
      `SELECT l.*, COUNT(se.id) as activity_count
       FROM leads l
       LEFT JOIN sequence_events se ON se.lead_id=l.id
       WHERE l.user_id=$1 AND (
         l.company ILIKE $2 OR l.company ILIKE $3
       )
       GROUP BY l.id
       ORDER BY l.created_at DESC
       LIMIT 10`,
      [req.userId, `%${opp.agency || ''}%`, `%${opp.sub_agency || ''}%`]
    );

    // Count notes for this opportunity (using localStorage notes - we'll count from frontend)
    // Or query from a hypothetical opportunity_notes table if it exists
    const notesCount = 0; // Will be managed on frontend with localStorage

    // Get recent sequence events from linked leads
    const linkedLeadIds = leadsR.rows.map(l => l.id);
    let recentActivity = [];
    if (linkedLeadIds.length > 0) {
      const activityR = await pool.query(
        `SELECT se.*, l.full_name, l.company FROM sequence_events se
         JOIN leads l ON l.id=se.lead_id
         WHERE se.lead_id = ANY($1)
         ORDER BY se.created_at DESC
         LIMIT 5`,
        [linkedLeadIds]
      );
      recentActivity = activityR.rows;
    }

    // Estimate win probability based on factors
    const hasLinkedLeads = leadsR.rows.length > 0;
    const hasNotes = notesCount > 0;
    const daysUntilDeadline = opp.response_deadline
      ? Math.ceil((new Date(opp.response_deadline) - new Date()) / 86400000)
      : null;
    const isPursuing = opp.status === 'pursuing' || opp.status === 'teaming' || opp.status === 'submitted';

    // Simple win probability calculation (0-100)
    let winProb = 30; // Base
    if (hasLinkedLeads) winProb += 20;
    if (hasNotes) winProb += 15;
    if (isPursuing) winProb += 25;
    if (daysUntilDeadline && daysUntilDeadline > 30) winProb += 10;
    winProb = Math.min(100, winProb);

    res.json({
      opportunity: opp,
      linked_leads: leadsR.rows,
      notes_count: notesCount,
      recent_activity: recentActivity,
      win_probability: winProb
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /opportunities/rescore — Re-score all opportunities against current sub profile
router.post('/rescore', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Get sub profile
    const profileR = await pool.query('SELECT * FROM sub_profiles WHERE user_id=$1', [req.userId]);
    const subProfile = profileR.rows[0];
    if (!subProfile) return res.status(400).json({ error: 'No sub profile found. Complete your profile first.' });

    // Get all opportunities
    const oppsR = await pool.query('SELECT * FROM opportunities WHERE org_id=$1', [orgId]);
    const opps = oppsR.rows;

    let updated = 0;
    for (const opp of opps) {
      try {
        const score = await scoreOpportunity(opp, subProfile);
        await pool.query(
          'UPDATE opportunities SET fit_score=$1, fit_reason=$2 WHERE id=$3',
          [score.score, score.reason, opp.id]
        );
        updated++;
      } catch (e) {
        console.error(`Rescore failed for opp ${opp.id}:`, e.message);
      }
    }

    res.json({ success: true, updated, total: opps.length });
  } catch (err) {
    console.error('Rescore error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /opportunities/refresh — Refresh opportunities from SAM.gov for all active searches
router.post('/refresh', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Get all active saved searches for this user
    const searchesR = await pool.query(
      "SELECT * FROM opportunity_searches WHERE user_id=$1 AND status='active'",
      [req.userId]
    );
    const searches = searchesR.rows;
    if (searches.length === 0) {
      return res.json({ success: true, message: 'No active searches to refresh', added: 0, updated: 0 });
    }

    // Get sub profile for scoring
    const profileR = await pool.query('SELECT * FROM sub_profiles WHERE user_id=$1', [req.userId]);
    const subProfile = profileR.rows[0];

    let totalAdded = 0;
    let totalUpdated = 0;
    let samErrors = [];

    for (const search of searches) {
      try {
        const samResult = await searchOpportunities({
          naics_codes: search.naics_codes,
          keywords: search.keywords,
          agency: search.agency,
          set_aside: search.set_aside,
          limit: 50,
        });

        if (samResult.error) {
          samErrors.push(samResult.error);
          continue;
        }

        const opps = samResult.opportunities || [];
        for (const opp of opps) {
          // Score if we have a profile
          let fitScore = null;
          let fitReason = null;
          if (subProfile) {
            try {
              const score = await scoreOpportunity(opp, subProfile);
              fitScore = score.score;
              fitReason = score.reason;
            } catch (e) { /* scoring failed, save without score */ }
          }

          // Upsert: insert new or update existing
          const existing = await pool.query(
            'SELECT id FROM opportunities WHERE sam_notice_id=$1 AND org_id=$2',
            [opp.sam_notice_id, orgId]
          );

          if (existing.rows.length > 0) {
            // Update title, deadline, description if changed
            await pool.query(
              `UPDATE opportunities SET title=$1, response_deadline=COALESCE($2, response_deadline),
               description=COALESCE($3, description), set_aside=COALESCE($4, set_aside),
               fit_score=COALESCE($5, fit_score), fit_reason=COALESCE($6, fit_reason),
               updated_at=NOW()
               WHERE id=$7`,
              [opp.title, opp.response_deadline || null, opp.description, opp.set_aside,
               fitScore, fitReason, existing.rows[0].id]
            );
            totalUpdated++;
          } else {
            // Insert new opportunity
            await pool.query(
              `INSERT INTO opportunities (search_id, org_id, sam_notice_id, title, agency, sub_agency,
               naics_code, set_aside, posted_date, response_deadline, description, place_of_performance,
               primary_contact_name, primary_contact_email, solicitation_number, opportunity_url,
               fit_score, fit_reason, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'new')
               ON CONFLICT (sam_notice_id) DO NOTHING`,
              [search.id, orgId, opp.sam_notice_id, opp.title, opp.agency, opp.sub_agency,
               opp.naics_code, opp.set_aside, opp.posted_date, opp.response_deadline,
               opp.description, opp.place_of_performance, opp.primary_contact_name,
               opp.primary_contact_email, opp.solicitation_number, opp.opportunity_url,
               fitScore, fitReason]
            );
            totalAdded++;
          }
        }
      } catch (e) {
        console.error(`Refresh failed for search ${search.id}:`, e.message);
        samErrors.push(e.message);
      }
    }

    // Notify if new high-fit opportunities found
    if (totalAdded > 0) {
      Promise.resolve().then(async () => {
        try {
          await createNotification(
            req.userId,
            'refresh_complete',
            `SAM.gov refresh: ${totalAdded} new opportunities`,
            `Found ${totalAdded} new and updated ${totalUpdated} existing opportunities from SAM.gov.`,
            '/opportunities'
          );
        } catch (e) { /* non-fatal */ }
      });
    }

    res.json({
      success: true,
      searches_refreshed: searches.length,
      added: totalAdded,
      updated: totalUpdated,
      errors: samErrors.length > 0 ? samErrors : undefined,
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: err.message });
  }
});

// FEATURE 9: Calculate Pwin (probability of win) for an opportunity
router.get('/:id/pwin', auth, async (req, res) => {
  try {
    const oppId = parseInt(req.params.id, 10);

    // Get opportunity
    const oppR = await pool.query(
      `SELECT o.*, c.phase FROM opportunities o
       LEFT JOIN capture_items c ON c.opportunity_id = o.id
       WHERE o.id=$1`,
      [oppId]
    );
    if (oppR.rows.length === 0) return res.status(404).json({ error: 'Opportunity not found' });
    const opp = oppR.rows[0];

    // Get user org and sub profile
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const subR = await pool.query(
      'SELECT * FROM sub_profiles WHERE org_id=$1',
      [orgId]
    );
    const subProfile = subR.rows[0];

    // Get past performance count for org
    const ppR = await pool.query(
      'SELECT COUNT(*) as count FROM past_performance WHERE user_id=$1',
      [req.userId]
    );
    const ppCount = parseInt(ppR.rows[0]?.count || 0, 10);

    // Get teaming partners count
    const teamingR = await pool.query(
      `SELECT COUNT(DISTINCT from_user_id) as count FROM teaming_requests
       WHERE to_user_id=$1 AND status='accepted'`,
      [req.userId]
    );
    const teamingCount = parseInt(teamingR.rows[0]?.count || 0, 10);

    // Calculate Pwin
    const factors = [];
    let pwin = 0;

    // Base from fit_score (0-100 mapped to 5-30%)
    const fitBase = opp.fit_score ? Math.min(30, Math.max(5, (opp.fit_score / 100) * 30)) : 5;
    pwin += fitBase;
    factors.push({ name: 'Fit Score', score: Math.round(fitBase), description: `Org capabilities match: ${opp.fit_score || 0}%` });

    // +15% if past performance exists
    if (ppCount > 0) {
      pwin += 15;
      factors.push({ name: 'Past Performance', score: 15, description: `${ppCount} relevant past performance(s)` });
    }

    // +10% if capture item in advanced phase
    if (opp.phase && ['Capture', 'Proposal', 'Submit'].includes(opp.phase)) {
      pwin += 10;
      factors.push({ name: 'Capture Phase', score: 10, description: `In ${opp.phase} phase` });
    }

    // +10% if set-aside matches profile
    if (opp.set_aside && subProfile?.set_aside_prefs) {
      const prefs = subProfile.set_aside_prefs.split(',').map(s => s.trim());
      if (prefs.some(p => opp.set_aside.includes(p))) {
        pwin += 10;
        factors.push({ name: 'Set-Aside Match', score: 10, description: `Matches ${opp.set_aside}` });
      }
    }

    // +5% if teaming partners identified
    if (teamingCount > 0) {
      pwin += 5;
      factors.push({ name: 'Teaming Partners', score: 5, description: `${teamingCount} partner(s) identified` });
    }

    // Cap at 95%
    pwin = Math.min(95, Math.max(5, pwin));

    res.json({ pwin: Math.round(pwin), factors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
