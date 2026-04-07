const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

const adminOnly = async (req, res, next) => {
  const user = await pool.query('SELECT role FROM users WHERE id=$1', [req.userId]);
  if (user.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// Get team overview dashboard - uses dedicated client with timeout
router.get('/dashboard', auth, async (req, res) => {
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

    // Pipeline stage counts for funnel visualization
    const pipelineStages = await client.query(`
      SELECT
        COUNT(CASE WHEN status='new' OR status IS NULL THEN 1 END) as pipeline_new,
        COUNT(CASE WHEN status='contacted' THEN 1 END) as pipeline_contacted,
        COUNT(CASE WHEN status='engaged' THEN 1 END) as pipeline_engaged,
        COUNT(CASE WHEN status='proposal' THEN 1 END) as pipeline_proposal,
        COUNT(CASE WHEN status='closed' OR status='won' THEN 1 END) as pipeline_closed
      FROM leads WHERE user_id = ANY($1)
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

module.exports = router;
