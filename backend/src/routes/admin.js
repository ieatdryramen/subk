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

    // Get user IDs in scope
    let userIds = [userId];
    if (orgId) {
      const orgUsers = await pool.query('SELECT id FROM users WHERE org_id=$1', [orgId]);
      userIds = orgUsers.rows.map(r => r.id);
    }

    // Simple counts — one table at a time, fast
    const [leadsR, playbooksR, listsR, touchesR, membersR, activityR, topLeadsR] = await Promise.all([
      pool.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as this_week FROM leads WHERE user_id = ANY($1)`, [userIds]),
      pool.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN generated_at > NOW() - INTERVAL '7 days' THEN 1 END) as this_week FROM playbooks WHERE user_id = ANY($1)`, [userIds]),
      pool.query(`SELECT COUNT(*) as total FROM lead_lists WHERE user_id = ANY($1)`, [userIds]),
      pool.query(`SELECT COUNT(*) as total FROM sequence_events WHERE user_id = ANY($1) AND status='done' AND touchpoint != 'zoho_note_added'`, [userIds]),
      pool.query(`SELECT u.id, u.email, u.full_name, u.role,
        COUNT(DISTINCT l.id) as leads_created,
        COUNT(DISTINCT p.id) as playbooks_generated,
        COUNT(DISTINCT se.id) FILTER (WHERE se.status='done' AND se.touchpoint!='zoho_note_added') as touchpoints_completed
        FROM users u
        LEFT JOIN leads l ON l.user_id = u.id
        LEFT JOIN playbooks p ON p.user_id = u.id
        LEFT JOIN sequence_events se ON se.user_id = u.id
        WHERE u.id = ANY($1)
        GROUP BY u.id`, [userIds]),
      pool.query(`SELECT 'playbook' as type, u.full_name as user_name, l.full_name as lead_name, l.company, p.generated_at as timestamp
        FROM playbooks p JOIN leads l ON l.id=p.lead_id JOIN users u ON u.id=p.user_id
        WHERE p.user_id = ANY($1)
        UNION ALL
        SELECT 'sequence', u.full_name, l.full_name, l.company, se.completed_at
        FROM sequence_events se JOIN leads l ON l.id=se.lead_id JOIN users u ON u.id=se.user_id
        WHERE se.user_id = ANY($1) AND se.status='done' AND se.completed_at IS NOT NULL AND se.touchpoint!='zoho_note_added'
        ORDER BY timestamp DESC LIMIT 15`, [userIds]),
      pool.query(`SELECT l.full_name, l.company, l.title, l.icp_score, l.status FROM leads l WHERE l.user_id = ANY($1) AND l.icp_score IS NOT NULL ORDER BY l.icp_score DESC LIMIT 8`, [userIds]),
    ]);

    res.json({
      stats: {
        total_leads: leadsR.rows[0].total,
        leads_this_week: leadsR.rows[0].this_week,
        total_playbooks: playbooksR.rows[0].total,
        playbooks_this_week: playbooksR.rows[0].this_week,
        total_lists: listsR.rows[0].total,
        touchpoints_completed: touchesR.rows[0].total,
      },
      members: membersR.rows,
      activity: activityR.rows,
      topLeads: topLeadsR.rows,
    });
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
