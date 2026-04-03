const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Middleware - admin only
const adminOnly = async (req, res, next) => {
  const user = await pool.query('SELECT role FROM users WHERE id=$1', [req.userId]);
  if (user.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// Get team overview dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const user = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId]);
    const u = user.rows[0];
    const userId = u.id;
    const orgId = u.org_id;

    // Get all user IDs in scope (org members or just this user)
    let scopeUserIds = [userId];
    if (orgId) {
      const orgUsers = await pool.query('SELECT id FROM users WHERE org_id=$1', [orgId]);
      scopeUserIds = orgUsers.rows.map(r => r.id);
    }

    const members = await pool.query(`
      SELECT 
        u.id, u.email, u.full_name, u.role, u.created_at,
        COUNT(DISTINCT l.id) as leads_created,
        COUNT(DISTINCT p.id) as playbooks_generated,
        COUNT(DISTINCT CASE WHEN l.created_at > NOW() - INTERVAL '7 days' THEN l.id END) as leads_this_week,
        COUNT(DISTINCT CASE WHEN p.generated_at > NOW() - INTERVAL '7 days' THEN p.id END) as playbooks_this_week,
        COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'done' AND se.touchpoint != 'zoho_note_added') as touchpoints_completed
      FROM users u
      LEFT JOIN leads l ON l.user_id = u.id
      LEFT JOIN playbooks p ON p.user_id = u.id
      LEFT JOIN sequence_events se ON se.user_id = u.id
      WHERE u.id = ANY($1)
      GROUP BY u.id
      ORDER BY playbooks_generated DESC
    `, [scopeUserIds]);

    const stats = await pool.query(`
      SELECT
        COUNT(DISTINCT l.id) as total_leads,
        COUNT(DISTINCT p.id) as total_playbooks,
        COUNT(DISTINCT ll.id) as total_lists,
        COUNT(DISTINCT CASE WHEN l.created_at > NOW() - INTERVAL '7 days' THEN l.id END) as leads_this_week,
        COUNT(DISTINCT CASE WHEN p.generated_at > NOW() - INTERVAL '7 days' THEN p.id END) as playbooks_this_week,
        COUNT(DISTINCT CASE WHEN l.icp_score >= 70 THEN l.id END) as high_score_leads,
        ROUND(AVG(l.icp_score)) as avg_icp_score,
        COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'done' AND se.touchpoint != 'zoho_note_added') as touchpoints_completed
      FROM users u
      LEFT JOIN leads l ON l.user_id = u.id
      LEFT JOIN playbooks p ON p.user_id = u.id
      LEFT JOIN lead_lists ll ON ll.user_id = u.id
      LEFT JOIN sequence_events se ON se.user_id = u.id
      WHERE u.id = ANY($1)
    `, [scopeUserIds]);

    const activity = await pool.query(`
      SELECT 'playbook' as type, u.full_name as user_name, l.full_name as lead_name, l.company, p.generated_at as timestamp
      FROM playbooks p
      JOIN leads l ON l.id = p.lead_id
      JOIN users u ON u.id = p.user_id
      WHERE u.id = ANY($1)
      UNION ALL
      SELECT 'sequence' as type, u.full_name as user_name, l.full_name as lead_name, l.company, se.completed_at as timestamp
      FROM sequence_events se
      JOIN leads l ON l.id = se.lead_id
      JOIN users u ON u.id = se.user_id
      WHERE u.id = ANY($1) AND se.status = 'done' AND se.completed_at IS NOT NULL AND se.touchpoint != 'zoho_note_added'
      ORDER BY timestamp DESC
      LIMIT 20
    `, [scopeUserIds]);

    const topLeads = await pool.query(`
      SELECT l.full_name, l.company, l.title, l.icp_score, l.icp_reason, l.status, u.full_name as owner
      FROM leads l
      JOIN users u ON u.id = l.user_id
      WHERE u.id = ANY($1) AND l.icp_score IS NOT NULL
      ORDER BY l.icp_score DESC LIMIT 10
    `, [scopeUserIds]);

    res.json({ stats: stats.rows[0], members: members.rows, activity: activity.rows, topLeads: topLeads.rows });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Change a member's role
router.put('/members/:memberId/role', auth, adminOnly, async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const user = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = user.rows[0]?.org_id;
    // Make sure target member is in same org
    const target = await pool.query('SELECT * FROM users WHERE id=$1 AND org_id=$2', [req.params.memberId, orgId]);
    if (!target.rows.length) return res.status(404).json({ error: 'Member not found' });
    await pool.query('UPDATE users SET role=$1 WHERE id=$2', [role, req.params.memberId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
