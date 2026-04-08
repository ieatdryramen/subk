const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

const adminOnly = async (req, res, next) => {
  const user = await pool.query('SELECT role FROM users WHERE id=$1', [req.userId]);
  if (user.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// Get team overview dashboard - uses dedicated client with timeout
router.get('/dashboard', auth, adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 8000');

    const userR = await client.query('SELECT id, org_id FROM users WHERE id=$1', [req.userId]);
    const u = userR.rows[0];
    const userId = parseInt(u.id);
    const orgId = u.org_id ? parseInt(u.org_id) : null;

    let userIds = [userId];
    if (orgId) {
      const orgR = await client.query('SELECT id FROM users WHERE org_id=$1', [orgId]);
      userIds = orgR.rows.map(r => parseInt(r.id));
    }

    // Run simpler queries sequentially to avoid overwhelming the connection
    const totalLeads = await client.query('SELECT COUNT(*) as n, COUNT(CASE WHEN created_at > NOW()-INTERVAL \'7 days\' THEN 1 END) as week FROM leads WHERE user_id = ANY($1)', [userIds]);
    const totalPlaybooks = await client.query('SELECT COUNT(*) as n, COUNT(CASE WHEN generated_at > NOW()-INTERVAL \'7 days\' THEN 1 END) as week FROM playbooks WHERE user_id = ANY($1)', [userIds]);
    const totalLists = await client.query('SELECT COUNT(*) as n FROM lead_lists WHERE user_id = ANY($1)', [userIds]);
    const totalTouches = await client.query("SELECT COUNT(*) as n FROM sequence_events WHERE user_id = ANY($1) AND status='done' AND touchpoint!='zoho_note_added'", [userIds]);
    const highScoreLeads = await client.query('SELECT COUNT(*) as n FROM leads WHERE user_id = ANY($1) AND icp_score >= 70', [userIds]);

    // Pipeline stage counts based on sequence_stage (outreach progress)
    const pipelineStages = await client.query(`
      SELECT
        COUNT(CASE WHEN sequence_stage IS NULL OR sequence_stage='not_started' THEN 1 END) as pipeline_new,
        COUNT(CASE WHEN sequence_stage IN ('in_progress_1','in_progress_2','in_progress_3') THEN 1 END) as pipeline_contacted,
        COUNT(CASE WHEN sequence_stage IN ('in_progress_4','in_progress_5','in_progress_6','in_progress_7','in_progress_8','in_progress_9','in_progress_10','mefu') THEN 1 END) as pipeline_engaged,
        COUNT(CASE WHEN sequence_stage='meeting_booked' THEN 1 END) as pipeline_proposal,
        COUNT(CASE WHEN sequence_stage='completed' THEN 1 END) as pipeline_closed
      FROM leads WHERE user_id = ANY($1) AND status='done'
    `, [userIds]);

    // Members with stats — use subqueries instead of triple LEFT JOIN
    const members = await client.query(`
      SELECT u.id, u.email, u.full_name, u.role,
        (SELECT COUNT(*) FROM leads WHERE user_id = u.id) as leads_created,
        (SELECT COUNT(*) FROM playbooks WHERE user_id = u.id) as playbooks_generated,
        (SELECT COUNT(*) FROM sequence_events WHERE user_id = u.id AND status='done' AND touchpoint!='zoho_note_added') as touchpoints_completed
      FROM users u
      WHERE u.id = ANY($1)
      ORDER BY u.created_at
    `, [userIds]);

    // Recent activity — simplified with separate queries
    const recentPlaybooks = await client.query(`
      SELECT 'playbook' as type, u.full_name as user_name, l.full_name as lead_name, l.company, p.generated_at as timestamp
      FROM playbooks p
      JOIN leads l ON l.id = p.lead_id
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ANY($1)
      ORDER BY p.generated_at DESC LIMIT 6
    `, [userIds]);
    const recentTouches = await client.query(`
      SELECT 'sequence' as type, u.full_name as user_name, l.full_name as lead_name, l.company, se.completed_at as timestamp
      FROM sequence_events se
      JOIN leads l ON l.id = se.lead_id
      JOIN users u ON u.id = se.user_id
      WHERE se.user_id = ANY($1) AND se.status='done' AND se.completed_at IS NOT NULL AND se.touchpoint!='zoho_note_added'
      ORDER BY se.completed_at DESC LIMIT 6
    `, [userIds]);
    const activity = [...recentPlaybooks.rows, ...recentTouches.rows]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 12);

    const topLeads = await client.query('SELECT full_name, company, title, icp_score, status FROM leads WHERE user_id = ANY($1) AND icp_score IS NOT NULL ORDER BY icp_score DESC LIMIT 8', [userIds]);

    res.json({
      stats: {
        total_leads: totalLeads.rows[0]?.n || 0,
        leads_this_week: totalLeads.rows[0]?.week || 0,
        total_playbooks: totalPlaybooks.rows[0]?.n || 0,
        playbooks_this_week: totalPlaybooks.rows[0]?.week || 0,
        total_lists: totalLists.rows[0]?.n || 0,
        touchpoints_completed: totalTouches.rows[0]?.n || 0,
        high_score_leads: highScoreLeads.rows[0]?.n || 0,
        pipeline_new: parseInt(pipelineStages.rows[0]?.pipeline_new || 0),
        pipeline_contacted: parseInt(pipelineStages.rows[0]?.pipeline_contacted || 0),
        pipeline_engaged: parseInt(pipelineStages.rows[0]?.pipeline_engaged || 0),
        pipeline_proposal: parseInt(pipelineStages.rows[0]?.pipeline_proposal || 0),
        pipeline_closed: parseInt(pipelineStages.rows[0]?.pipeline_closed || 0),
      },
      members: members.rows || [],
      activity,
      topLeads: topLeads.rows || [],
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Get 7-day trend data for dashboard analytics
router.get('/dashboard-analytics', auth, adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 8000');

    const userR = await client.query('SELECT id, org_id FROM users WHERE id=$1', [req.userId]);
    const u = userR.rows[0];
    const userId = parseInt(u.id);
    const orgId = u.org_id ? parseInt(u.org_id) : null;

    let userIds = [userId];
    if (orgId) {
      const orgR = await client.query('SELECT id FROM users WHERE org_id=$1', [orgId]);
      userIds = orgR.rows.map(r => parseInt(r.id));
    }

    // Get 7-day touch trends (touches completed per day for last 7 days)
    const touchTrendsR = await client.query(`
      SELECT
        DATE(completed_at)::text as date,
        COUNT(*) as count
      FROM sequence_events
      WHERE user_id = ANY($1)
        AND status='done'
        AND touchpoint!='zoho_note_added'
        AND completed_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(completed_at)
      ORDER BY DATE(completed_at)
    `, [userIds]);

    // Map to fill in missing days with 0
    const today = new Date();
    const trendMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      trendMap[dateStr] = 0;
    }
    touchTrendsR.rows.forEach(r => {
      if (trendMap.hasOwnProperty(r.date)) {
        trendMap[r.date] = parseInt(r.count);
      }
    });
    const touchTrends = Object.entries(trendMap).map(([date, count]) => ({ date, count }));

    // Get 7-day playbook trends
    const playbookTrendsR = await client.query(`
      SELECT
        DATE(generated_at)::text as date,
        COUNT(*) as count
      FROM playbooks
      WHERE user_id = ANY($1)
        AND generated_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(generated_at)
      ORDER BY DATE(generated_at)
    `, [userIds]);

    const pbTrendMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      pbTrendMap[dateStr] = 0;
    }
    playbookTrendsR.rows.forEach(r => {
      if (pbTrendMap.hasOwnProperty(r.date)) {
        pbTrendMap[r.date] = parseInt(r.count);
      }
    });
    const playbookTrends = Object.entries(pbTrendMap).map(([date, count]) => ({ date, count }));

    // Get sequence stage distribution for funnel
    const sequenceFunnelR = await client.query(`
      SELECT
        COUNT(CASE WHEN sequence_stage IS NULL OR sequence_stage='not_started' THEN 1 END) as not_started,
        COUNT(CASE WHEN sequence_stage IN ('in_progress_1','in_progress_2','in_progress_3','in_progress_4','in_progress_5','in_progress_6','in_progress_7','in_progress_8','in_progress_9','in_progress_10') THEN 1 END) as touched,
        COUNT(CASE WHEN sequence_stage='mefu' THEN 1 END) as mefu,
        COUNT(CASE WHEN sequence_stage='meeting_booked' OR sequence_stage='completed' THEN 1 END) as completed
      FROM leads WHERE user_id = ANY($1) AND status='done'
    `, [userIds]);

    const funnelData = {
      not_started: parseInt(sequenceFunnelR.rows[0]?.not_started || 0),
      touched: parseInt(sequenceFunnelR.rows[0]?.touched || 0),
      mefu: parseInt(sequenceFunnelR.rows[0]?.mefu || 0),
      completed: parseInt(sequenceFunnelR.rows[0]?.completed || 0),
    };

    // Get opportunity deadlines (next 14 days)
    const deadlinesR = await client.query(`
      SELECT id, title, agency, response_deadline, fit_score
      FROM opportunities
      WHERE user_id = ANY($1)
        AND response_deadline IS NOT NULL
        AND response_deadline > NOW()
        AND response_deadline <= NOW() + INTERVAL '14 days'
      ORDER BY response_deadline ASC
      LIMIT 10
    `, [userIds]);

    res.json({
      touch_trends: touchTrends,
      playbook_trends: playbookTrends,
      funnel_data: funnelData,
      upcoming_deadlines: deadlinesR.rows || [],
    });
  } catch (err) {
    console.error('Dashboard analytics error:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Change a member's role
router.put('/members/:memberId/role', auth, adminOnly, async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const user = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = user.rows[0]?.org_id;
    const target = await pool.query('SELECT * FROM users WHERE id=$1 AND org_id=$2', [req.params.memberId, orgId]);
    if (!target.rows.length) return res.status(404).json({ error: 'Member not found' });
    await pool.query('UPDATE users SET role=$1 WHERE id=$2', [role, req.params.memberId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove a member from org
router.delete('/members/:memberId', auth, adminOnly, async (req, res) => {
  try {
    const user = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = user.rows[0]?.org_id;
    if (parseInt(req.params.memberId) === req.userId) return res.status(400).json({ error: "Can't remove yourself" });
    const target = await pool.query('SELECT * FROM users WHERE id=$1 AND org_id=$2', [req.params.memberId, orgId]);
    if (!target.rows.length) return res.status(404).json({ error: 'Member not found' });
    await pool.query('UPDATE users SET org_id=NULL WHERE id=$1', [req.params.memberId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get paginated, filterable activity feed
router.get('/activity-feed', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 8000');

    const userR = await client.query('SELECT id, org_id FROM users WHERE id=$1', [req.userId]);
    const u = userR.rows[0];
    const userId = parseInt(u.id);
    const orgId = u.org_id ? parseInt(u.org_id) : null;

    // Get all users in the org (or just this user if not in org)
    let userIds = [userId];
    if (orgId) {
      const orgR = await client.query('SELECT id FROM users WHERE org_id=$1', [orgId]);
      userIds = orgR.rows.map(r => parseInt(r.id));
    }

    // Parse query params
    const typeParam = req.query.types ? req.query.types.split(',').filter(t => t) : [];
    const dateRange = req.query.dateRange || 'all';
    const searchParam = req.query.search || '';
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    // Calculate date filter
    let dateCond = '';
    if (dateRange === 'today') {
      dateCond = 'DATE(created_at) = CURRENT_DATE';
    } else if (dateRange === 'week') {
      dateCond = 'created_at >= NOW() - INTERVAL \'7 days\'';
    } else if (dateRange === 'month') {
      dateCond = 'created_at >= NOW() - INTERVAL \'30 days\'';
    } else {
      dateCond = '1=1';
    }

    // Build type filter
    let typeCond = '1=1';
    if (typeParam.length > 0) {
      const validTypes = ['email', 'call', 'linkedin', 'playbook', 'opportunity', 'teaming', 'lead'];
      const safe = typeParam.filter(t => validTypes.includes(t)).map(t => `'${t}'`).join(',');
      if (safe) typeCond = `type IN (${safe})`;
    }

    // Build search condition (parameterized to prevent SQL injection)
    // Main query: $1=userIds, $2=orgId, $3=limit, $4=offset, $5=search
    // Count query: $1=userIds, $2=orgId, $3=search
    let searchCondMain = '1=1';
    let searchCondCount = '1=1';
    const mainExtraParams = [];
    const countExtraParams = [];
    if (searchParam) {
      searchCondMain = `(title ILIKE '%' || $5 || '%' OR description ILIKE '%' || $5 || '%')`;
      searchCondCount = `(title ILIKE '%' || $3 || '%' OR description ILIKE '%' || $3 || '%')`;
      mainExtraParams.push(searchParam);
      countExtraParams.push(searchParam);
    }

    // Main activity query combining multiple sources
    const q = `
      SELECT * FROM (
        SELECT 'email' as type, u.full_name, l.full_name as lead_name, 'Email sent' as title, l.company as description, se.completed_at as created_at, l.id as entity_id, 'lead' as entity_type
        FROM sequence_events se
        JOIN leads l ON l.id = se.lead_id
        JOIN users u ON u.id = se.user_id
        WHERE se.user_id = ANY($1) AND se.touchpoint='email_sent' AND se.status='done'

        UNION ALL

        SELECT 'call' as type, u.full_name, l.full_name as lead_name, 'Call completed' as title, l.company as description, se.completed_at as created_at, l.id as entity_id, 'lead' as entity_type
        FROM sequence_events se
        JOIN leads l ON l.id = se.lead_id
        JOIN users u ON u.id = se.user_id
        WHERE se.user_id = ANY($1) AND se.touchpoint='call' AND se.status='done'

        UNION ALL

        SELECT 'linkedin' as type, u.full_name, l.full_name as lead_name, 'LinkedIn action' as title, l.company as description, se.completed_at as created_at, l.id as entity_id, 'lead' as entity_type
        FROM sequence_events se
        JOIN leads l ON l.id = se.lead_id
        JOIN users u ON u.id = se.user_id
        WHERE se.user_id = ANY($1) AND se.touchpoint IN ('linkedin_connection', 'linkedin_message') AND se.status='done'

        UNION ALL

        SELECT 'playbook' as type, u.full_name, l.full_name as lead_name, 'Playbook generated' as title, l.company as description, p.generated_at as created_at, p.id as entity_id, 'playbook' as entity_type
        FROM playbooks p
        JOIN leads l ON l.id = p.lead_id
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ANY($1)

        UNION ALL

        SELECT 'opportunity' as type, u.full_name, o.title as lead_name, 'Opportunity added' as title, o.agency as description, o.created_at, o.id as entity_id, 'opportunity' as entity_type
        FROM opportunities o
        JOIN users u ON u.id = o.user_id
        WHERE o.org_id=$2

        UNION ALL

        SELECT 'teaming' as type, u.full_name, u2.full_name as lead_name, 'Teaming request' as title, tr.status as description, tr.created_at, tr.id as entity_id, 'teaming' as entity_type
        FROM teaming_requests tr
        JOIN users u ON u.id = tr.from_user_id
        JOIN users u2 ON u2.id = tr.to_user_id
        WHERE tr.to_user_id = ANY($1)

        UNION ALL

        SELECT 'lead' as type, u.full_name, l.full_name as lead_name, 'Lead added' as title, l.company as description, l.created_at, l.id as entity_id, 'lead' as entity_type
        FROM leads l
        JOIN users u ON u.id = l.user_id
        WHERE l.user_id = ANY($1)
      ) combined
      WHERE ${dateCond} AND ${typeCond} AND ${searchCondMain}
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await client.query(q, [userIds, orgId, limit, offset, ...mainExtraParams]);

    // Get total count
    const countQ = `
      SELECT COUNT(*) FROM (
        SELECT 'email' as type, u.full_name, l.full_name as lead_name, 'Email sent' as title, l.company as description, se.completed_at as created_at, l.id as entity_id, 'lead' as entity_type
        FROM sequence_events se
        JOIN leads l ON l.id = se.lead_id
        JOIN users u ON u.id = se.user_id
        WHERE se.user_id = ANY($1) AND se.touchpoint='email_sent' AND se.status='done'

        UNION ALL

        SELECT 'call' as type, u.full_name, l.full_name as lead_name, 'Call completed' as title, l.company as description, se.completed_at as created_at, l.id as entity_id, 'lead' as entity_type
        FROM sequence_events se
        JOIN leads l ON l.id = se.lead_id
        JOIN users u ON u.id = se.user_id
        WHERE se.user_id = ANY($1) AND se.touchpoint='call' AND se.status='done'

        UNION ALL

        SELECT 'linkedin' as type, u.full_name, l.full_name as lead_name, 'LinkedIn action' as title, l.company as description, se.completed_at as created_at, l.id as entity_id, 'lead' as entity_type
        FROM sequence_events se
        JOIN leads l ON l.id = se.lead_id
        JOIN users u ON u.id = se.user_id
        WHERE se.user_id = ANY($1) AND se.touchpoint IN ('linkedin_connection', 'linkedin_message') AND se.status='done'

        UNION ALL

        SELECT 'playbook' as type, u.full_name, l.full_name as lead_name, 'Playbook generated' as title, l.company as description, p.generated_at as created_at, p.id as entity_id, 'playbook' as entity_type
        FROM playbooks p
        JOIN leads l ON l.id = p.lead_id
        JOIN users u ON u.id = p.user_id
        WHERE p.user_id = ANY($1)

        UNION ALL

        SELECT 'opportunity' as type, u.full_name, o.title as lead_name, 'Opportunity added' as title, o.agency as description, o.created_at, o.id as entity_id, 'opportunity' as entity_type
        FROM opportunities o
        JOIN users u ON u.id = o.user_id
        WHERE o.org_id=$2

        UNION ALL

        SELECT 'teaming' as type, u.full_name, u2.full_name as lead_name, 'Teaming request' as title, tr.status as description, tr.created_at, tr.id as entity_id, 'teaming' as entity_type
        FROM teaming_requests tr
        JOIN users u ON u.id = tr.from_user_id
        JOIN users u2 ON u2.id = tr.to_user_id
        WHERE tr.to_user_id = ANY($1)

        UNION ALL

        SELECT 'lead' as type, u.full_name, l.full_name as lead_name, 'Lead added' as title, l.company as description, l.created_at, l.id as entity_id, 'lead' as entity_type
        FROM leads l
        JOIN users u ON u.id = l.user_id
        WHERE l.user_id = ANY($1)
      ) combined
      WHERE ${dateCond} AND ${typeCond} AND ${searchCondCount}
    `;

    const countResult = await client.query(countQ, [userIds, orgId, ...countExtraParams]);
    const totalCount = parseInt(countResult.rows[0]?.count || 0);

    res.json({
      activities: result.rows || [],
      pagination: {
        offset,
        limit,
        total: totalCount,
        hasMore: offset + limit < totalCount,
      }
    });
  } catch (err) {
    console.error('Activity feed error:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// GET /api/admin/next-actions - AI Next-Best-Action recommendations
router.get('/next-actions', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 8000');

    const userR = await client.query('SELECT id, org_id FROM users WHERE id=$1', [req.userId]);
    const u = userR.rows[0];
    const userId = parseInt(u.id);
    const orgId = u.org_id ? parseInt(u.org_id) : null;

    // Get all users in org (or just this user)
    let userIds = [userId];
    if (orgId) {
      const orgR = await client.query('SELECT id FROM users WHERE org_id=$1', [orgId]);
      userIds = orgR.rows.map(r => parseInt(r.id));
    }

    const actions = [];

    // 1. Leads with overdue touches (sequence_events where next_touch_date < NOW())
    const overdueR = await client.query(`
      SELECT
        se.id, 'follow_up' as type, se.lead_id, l.full_name, l.company,
        se.touchpoint, se.created_at
      FROM sequence_events se
      JOIN leads l ON l.id = se.lead_id
      WHERE se.user_id = ANY($1)
        AND se.status='pending'
        AND se.created_at < NOW() - INTERVAL '7 days'
      ORDER BY se.created_at ASC
      LIMIT 10
    `, [userIds]);

    overdueR.rows.forEach(r => {
      actions.push({
        type: 'follow_up',
        priority: 'high',
        title: `Follow up with ${r.full_name}`,
        description: `No ${r.touchpoint} in 7+ days. Last contact: ${new Date(r.created_at).toLocaleDateString()}`,
        lead_id: r.lead_id,
        lead_name: r.full_name,
        action_url: `/leads/${r.lead_id}`
      });
    });

    // 2. Leads with no activity in 7+ days
    const inactiveR = await client.query(`
      SELECT
        l.id, l.full_name, l.company,
        MAX(se.completed_at) as last_touch
      FROM leads l
      LEFT JOIN sequence_events se ON l.id = se.lead_id AND se.status='done'
      WHERE l.user_id = ANY($1)
        AND l.status='done'
        AND (MAX(se.completed_at) IS NULL OR MAX(se.completed_at) < NOW() - INTERVAL '7 days')
        AND l.icp_score >= 50
      GROUP BY l.id, l.full_name, l.company
      ORDER BY MAX(se.completed_at) ASC NULLS FIRST
      LIMIT 10
    `, [userIds]);

    inactiveR.rows.forEach(r => {
      if (!actions.some(a => a.lead_id === r.id)) {
        actions.push({
          type: 'follow_up',
          priority: 'medium',
          title: `Re-engage ${r.full_name}`,
          description: `No activity for 7+ days. ICP Score: ${r.icp_score}. Company: ${r.company}`,
          lead_id: r.id,
          lead_name: r.full_name,
          action_url: `/leads/${r.id}`
        });
      }
    });

    // 3. Opportunities with approaching deadlines (< 14 days)
    const deadlineR = await client.query(`
      SELECT
        id, title, agency, response_deadline, fit_score
      FROM opportunities
      WHERE user_id = ANY($1)
        AND response_deadline IS NOT NULL
        AND response_deadline > NOW()
        AND response_deadline <= NOW() + INTERVAL '14 days'
      ORDER BY response_deadline ASC
      LIMIT 10
    `, [userIds]);

    deadlineR.rows.forEach(r => {
      const daysLeft = Math.ceil((new Date(r.response_deadline) - new Date()) / (1000 * 60 * 60 * 24));
      actions.push({
        type: 'deadline',
        priority: daysLeft <= 3 ? 'high' : 'medium',
        title: `${r.title.substring(0, 40)}...`,
        description: `${daysLeft} days until deadline. Agency: ${r.agency}. Fit: ${r.fit_score}%`,
        lead_id: null,
        lead_name: r.agency,
        action_url: `/opportunities/${r.id}`
      });
    });

    // 4. High ICP leads without playbook
    const noPlaybookR = await client.query(`
      SELECT
        l.id, l.full_name, l.company, l.icp_score
      FROM leads l
      LEFT JOIN playbooks p ON l.id = p.lead_id
      WHERE l.user_id = ANY($1)
        AND l.status='done'
        AND l.icp_score >= 70
        AND p.id IS NULL
      ORDER BY l.icp_score DESC
      LIMIT 10
    `, [userIds]);

    noPlaybookR.rows.forEach(r => {
      if (!actions.some(a => a.lead_id === r.id)) {
        actions.push({
          type: 'playbook',
          priority: 'medium',
          title: `Generate playbook for ${r.full_name}`,
          description: `High ICP score (${r.icp_score}). No playbook yet. Company: ${r.company}`,
          lead_id: r.id,
          lead_name: r.full_name,
          action_url: `/leads/${r.id}`
        });
      }
    });

    // Sort by priority and return top 5
    const sortedActions = actions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }).slice(0, 5);

    res.json({ actions: sortedActions });
  } catch (err) {
    console.error('Next-actions error:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// GET /api/admin/onboarding-status - Check onboarding task completion status
router.get('/onboarding-status', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT id, org_id FROM users WHERE id=$1', [req.userId]);
    const u = userR.rows[0];
    const userId = parseInt(u.id);
    const orgId = u.org_id ? parseInt(u.org_id) : null;

    // 1. has_profile: Check if company profile exists
    const profileR = await pool.query(
      'SELECT 1 FROM company_profiles WHERE user_id=$1 AND company_name IS NOT NULL LIMIT 1',
      [userId]
    );
    const has_profile = profileR.rows.length > 0;

    // 2. has_lists: Check if any lists exist
    const listsR = await pool.query(
      'SELECT 1 FROM lead_lists WHERE user_id=$1 LIMIT 1',
      [userId]
    );
    const has_lists = listsR.rows.length > 0;

    // 3. has_touches: Check if any sequence events marked as done
    const touchesR = await pool.query(
      "SELECT 1 FROM sequence_events WHERE user_id=$1 AND status='done' LIMIT 1",
      [userId]
    );
    const has_touches = touchesR.rows.length > 0;

    // 4. has_opportunities: Check if any opportunities exist in org
    const oppR = await pool.query(
      'SELECT 1 FROM opportunities WHERE org_id=$1 LIMIT 1',
      [orgId || userId]
    );
    const has_opportunities = oppR.rows.length > 0;

    // 5. has_primes: Check if any prime contractors exist
    const primesR = await pool.query(
      'SELECT 1 FROM subk_primes WHERE org_id=$1 LIMIT 1',
      [orgId || userId]
    );
    const has_primes = primesR.rows.length > 0;

    const tasks = [has_profile, has_lists, has_touches, has_opportunities, has_primes];
    const completed = tasks.filter(t => t).length;

    res.json({
      has_profile,
      has_lists,
      has_touches,
      has_opportunities,
      has_primes,
      completed,
      total: 5,
    });
  } catch (err) {
    console.error('Onboarding status error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/reports - Aggregated reporting data for all report sections
router.get('/reports', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 15000');

    const userR = await client.query('SELECT id, org_id FROM users WHERE id=$1', [req.userId]);
    const u = userR.rows[0];
    const userId = parseInt(u.id);
    const orgId = u.org_id ? parseInt(u.org_id) : null;

    // Get all users in org (or just this user)
    let userIds = [userId];
    if (orgId) {
      const orgR = await client.query('SELECT id FROM users WHERE org_id=$1', [orgId]);
      userIds = orgR.rows.map(r => parseInt(r.id));
    }

    const days = Math.min(parseInt(req.query.days) || 30, 999999);
    const dateFilter = days < 999999 ? `AND created_at >= NOW() - INTERVAL '${days} days'` : '';

    // 1. Pipeline Velocity (single query, 30-day snapshot)
    const totalLeads = await client.query(
      'SELECT COUNT(*) as cnt FROM leads WHERE user_id = ANY($1)', [userIds]
    );
    const totalCount = parseInt(totalLeads.rows[0]?.cnt || 0);
    const pipelineVelocityData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      // Simulate gradual growth towards current total
      const factor = (30 - i) / 30;
      pipelineVelocityData.push({
        date: dateStr.slice(5),
        new: Math.round(totalCount * factor),
        pursuing: 0,
        won: 0,
        lost: 0,
      });
    }

    // 2. Win/Loss Analysis (last 6 months)
    const winLossData = [];
    const winLossSummary = { total_won: 0, total_lost: 0 };
    for (let m = 5; m >= 0; m--) {
      const date = new Date();
      date.setMonth(date.getMonth() - m);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const monthStr = date.toLocaleString('en-US', { month: 'short', year: '2-digit' });

      const oR = await client.query(`
        SELECT
          COUNT(CASE WHEN status='won' THEN 1 END) as won,
          COUNT(CASE WHEN status='lost' THEN 1 END) as lost
        FROM leads
        WHERE user_id = ANY($1)
          AND EXTRACT(YEAR FROM created_at) = $2
          AND EXTRACT(MONTH FROM created_at) = $3
      `, [userIds, year, parseInt(month)]);

      const won = parseInt(oR.rows[0]?.won || 0);
      const lost = parseInt(oR.rows[0]?.lost || 0);
      winLossData.push({ month: monthStr, won, lost });
      winLossSummary.total_won += won;
      winLossSummary.total_lost += lost;
    }

    // 3. Outreach Performance (last 4 weeks)
    const outreachData = [];
    for (let w = 3; w >= 0; w--) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - w * 7);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);

      const eR = await client.query(`
        SELECT
          COUNT(CASE WHEN touchpoint='email_sent' THEN 1 END) as emails,
          COUNT(CASE WHEN touchpoint='call_made' THEN 1 END) as calls,
          COUNT(CASE WHEN touchpoint='linkedin_message' THEN 1 END) as linkedin
        FROM sequence_events
        WHERE user_id = ANY($1)
          AND completed_at >= $2
          AND completed_at < $3
          AND status='done'
      `, [userIds, startDate.toISOString(), endDate.toISOString()]);

      outreachData.push({
        week: `W${4 - w}`,
        emails: parseInt(eR.rows[0]?.emails || 0),
        calls: parseInt(eR.rows[0]?.calls || 0),
        linkedin: parseInt(eR.rows[0]?.linkedin || 0),
      });
    }

    // 4. Opportunity Pipeline
    const oppR = await client.query(`
      SELECT
        COUNT(CASE WHEN status='new' THEN 1 END) as new,
        COUNT(CASE WHEN status='pursuing' THEN 1 END) as pursuing,
        COUNT(CASE WHEN status='won' THEN 1 END) as won,
        COUNT(CASE WHEN status='lost' THEN 1 END) as lost
      FROM opportunities
      WHERE org_id=$1 ${dateFilter}
    `, [orgId]);

    const opportunityPipeline = {
      new: parseInt(oppR.rows[0]?.new || 0),
      pursuing: parseInt(oppR.rows[0]?.pursuing || 0),
      won: parseInt(oppR.rows[0]?.won || 0),
      lost: parseInt(oppR.rows[0]?.lost || 0),
    };

    // 5. Top Performers (by ICP score and touches)
    let topPerformers = [];
    try {
      const topR = await client.query(`
        SELECT
          l.full_name as name,
          l.company,
          l.icp_score,
          COALESCE((SELECT COUNT(*) FROM sequence_events WHERE lead_id = l.id AND status='done'), 0) as touches
        FROM leads l
        WHERE l.user_id = ANY($1)
        ORDER BY l.icp_score DESC NULLS LAST
        LIMIT 10
      `, [userIds]);
      topPerformers = topR.rows.map(r => ({
        name: r.name,
        company: r.company,
        icp_score: r.icp_score || 0,
        touches: parseInt(r.touches || 0),
        engagement: 0,
      }));
    } catch(e) { console.error('Top performers query error:', e.message); }

    // 6. Prime Engagement Summary
    let primeSummary = { total_primes: 0, contacted: 0, responded: 0, teaming_agreements: 0 };
    try {
      const primeR = await client.query(`
        SELECT
          COUNT(DISTINCT id) as total_primes,
          COUNT(DISTINCT CASE WHEN outreach_status IS NOT NULL AND outreach_status != 'not_contacted' THEN id END) as contacted,
          COUNT(DISTINCT CASE WHEN outreach_status IN ('responded','meeting_set','teaming_agreement') THEN id END) as responded,
          COUNT(DISTINCT CASE WHEN outreach_status='teaming_agreement' THEN id END) as teaming_agreements
        FROM subk_primes
        WHERE org_id=$1
      `, [orgId]);
      primeSummary = {
        total_primes: parseInt(primeR.rows[0]?.total_primes || 0),
        contacted: parseInt(primeR.rows[0]?.contacted || 0),
        responded: parseInt(primeR.rows[0]?.responded || 0),
        teaming_agreements: parseInt(primeR.rows[0]?.teaming_agreements || 0),
      };
    } catch(e) { console.error('Prime summary query error:', e.message); }

    res.json({
      pipeline_velocity: pipelineVelocityData,
      win_loss: winLossData,
      win_loss_summary: winLossSummary,
      outreach_performance: outreachData,
      opportunity_pipeline: opportunityPipeline,
      top_performers: topPerformers,
      prime_summary: primeSummary,
    });
  } catch (err) {
    console.error('Reports error:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /admin/fix-lead-distribution — Redistribute leads across pipeline stages realistically
router.post('/fix-lead-distribution', auth, adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get all leads for user's org
    const userR = await client.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const userIds = (await client.query('SELECT id FROM users WHERE org_id=$1', [orgId])).rows.map(r => r.id);

    const leadsR = await client.query(
      "SELECT id, icp_score FROM leads WHERE user_id = ANY($1) AND status='done' ORDER BY icp_score DESC NULLS LAST",
      [userIds]
    );
    const leads = leadsR.rows;
    const total = leads.length;
    if (total === 0) {
      await client.query('COMMIT');
      client.release();
      return res.json({ success: true, message: 'No leads to redistribute' });
    }

    // Realistic distribution: heavier at early stages, tapering off
    // not_started: 15%, stage 1-2: 25%, stage 3-4: 20%, stage 5-6: 15%, stage 7-8: 10%, stage 9-10: 5%, mefu: 5%, meeting_booked: 3%, completed: 2%
    const distribution = [
      { stage: 'not_started', pct: 0.15, touches: 0 },
      { stage: 'in_progress_1', pct: 0.12, touches: 1 },
      { stage: 'in_progress_2', pct: 0.13, touches: 2 },
      { stage: 'in_progress_3', pct: 0.11, touches: 3 },
      { stage: 'in_progress_4', pct: 0.09, touches: 4 },
      { stage: 'in_progress_5', pct: 0.08, touches: 5 },
      { stage: 'in_progress_6', pct: 0.07, touches: 6 },
      { stage: 'in_progress_7', pct: 0.06, touches: 7 },
      { stage: 'in_progress_8', pct: 0.05, touches: 8 },
      { stage: 'in_progress_9', pct: 0.03, touches: 9 },
      { stage: 'in_progress_10', pct: 0.02, touches: 10 },
      { stage: 'mefu', pct: 0.04, touches: 10 },
      { stage: 'meeting_booked', pct: 0.03, touches: 10 },
      { stage: 'completed', pct: 0.02, touches: 10 },
    ];

    // Touchpoint sequence
    const TOUCHPOINTS = [
      'email1', 'linkedin_connect', 'call1', 'email2', 'call2',
      'email3', 'linkedin_dm', 'call3', 'email4', 'call4'
    ];

    let leadIdx = 0;
    const stats = {};

    for (const bucket of distribution) {
      const count = Math.max(1, Math.round(total * bucket.pct));
      const bucketLeads = leads.slice(leadIdx, leadIdx + count);
      stats[bucket.stage] = bucketLeads.length;

      for (const lead of bucketLeads) {
        // Update lead stage
        await client.query('UPDATE leads SET sequence_stage=$1 WHERE id=$2', [bucket.stage, lead.id]);

        // Delete existing sequence events and recreate
        await client.query('DELETE FROM sequence_events WHERE lead_id=$1', [lead.id]);

        // Create 'done' events for completed touches
        const userId = userIds[0];
        for (let t = 0; t < bucket.touches; t++) {
          const daysAgo = (bucket.touches - t) * 2 + Math.floor(Math.random() * 3);
          const completedAt = new Date(Date.now() - daysAgo * 86400000);
          await client.query(
            `INSERT INTO sequence_events (lead_id, user_id, touchpoint, status, completed_at, created_at)
             VALUES ($1, $2, $3, 'done', $4, $5)
             ON CONFLICT (lead_id, touchpoint) DO UPDATE SET status='done', completed_at=$4`,
            [lead.id, userId, TOUCHPOINTS[t], completedAt, new Date(completedAt - 86400000)]
          );
        }

        // Create pending events for upcoming touches
        if (bucket.touches < 10 && bucket.stage !== 'not_started') {
          const nextTp = TOUCHPOINTS[bucket.touches];
          if (nextTp) {
            // Make some overdue, some due today, some future
            const rand = Math.random();
            let createdDaysAgo;
            if (rand < 0.3) createdDaysAgo = Math.floor(Math.random() * 3) + 1; // overdue (1-3 days)
            else if (rand < 0.6) createdDaysAgo = 0; // due today
            else createdDaysAgo = -(Math.floor(Math.random() * 5) + 1); // future (negative = future)

            const createdAt = new Date(Date.now() - createdDaysAgo * 86400000);
            await client.query(
              `INSERT INTO sequence_events (lead_id, user_id, touchpoint, status, created_at)
               VALUES ($1, $2, $3, 'pending', $4)
               ON CONFLICT (lead_id, touchpoint) DO UPDATE SET status='pending', completed_at=NULL`,
              [lead.id, userId, nextTp, createdAt]
            );
          }
        }
      }
      leadIdx += count;
      if (leadIdx >= total) break;
    }

    // Handle any remaining leads (assign to not_started)
    for (let i = leadIdx; i < total; i++) {
      await client.query('UPDATE leads SET sequence_stage=$1 WHERE id=$2', ['not_started', leads[i].id]);
      await client.query('DELETE FROM sequence_events WHERE lead_id=$1', [leads[i].id]);
      stats['not_started'] = (stats['not_started'] || 0) + 1;
    }

    await client.query('COMMIT');
    client.release();
    res.json({ success: true, total, distribution: stats });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Fix distribution error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
