const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

const adminOnly = async (req, res, next) => {
  const user = await pool.query('SELECT role FROM users WHERE id=$1', [req.userId]);
  if (user.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// GET /goals/my — current user's goals + today's actuals
router.get('/my', auth, async (req, res) => {
  try {
    const goalsR = await pool.query(
      'SELECT * FROM activity_goals WHERE user_id=$1',
      [req.userId]
    );
    const goals = goalsR.rows[0] || {
      daily_calls: 60, daily_emails: 100, daily_linkedin: 0,
      weekly_calls: 300, weekly_emails: 500, weekly_linkedin: 0,
      goal_mode: 'daily'
    };

    // Today's actuals
    const todayR = await pool.query(`
      SELECT activity_type, COUNT(*) as count
      FROM activity_log
      WHERE user_id=$1 AND logged_at >= CURRENT_DATE AND logged_at < CURRENT_DATE + INTERVAL '1 day'
      GROUP BY activity_type
    `, [req.userId]);
    const todayMap = {};
    todayR.rows.forEach(r => { todayMap[r.activity_type] = parseInt(r.count); });

    // This week's actuals (Mon-Sun)
    const weekR = await pool.query(`
      SELECT activity_type, COUNT(*) as count
      FROM activity_log
      WHERE user_id=$1
        AND logged_at >= date_trunc('week', CURRENT_DATE)
        AND logged_at < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
      GROUP BY activity_type
    `, [req.userId]);
    const weekMap = {};
    weekR.rows.forEach(r => { weekMap[r.activity_type] = parseInt(r.count); });

    res.json({
      goals,
      today: { calls: todayMap.call || 0, emails: todayMap.email || 0, linkedin: todayMap.linkedin || 0 },
      week: { calls: weekMap.call || 0, emails: weekMap.email || 0, linkedin: weekMap.linkedin || 0 },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /goals/my — update own goals
router.put('/my', auth, async (req, res) => {
  const { daily_calls, daily_emails, daily_linkedin, weekly_calls, weekly_emails, weekly_linkedin, goal_mode } = req.body;
  try {
    await pool.query(`
      INSERT INTO activity_goals (user_id, daily_calls, daily_emails, daily_linkedin, weekly_calls, weekly_emails, weekly_linkedin, goal_mode)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (user_id) DO UPDATE SET
        daily_calls=$2, daily_emails=$3, daily_linkedin=$4,
        weekly_calls=$5, weekly_emails=$6, weekly_linkedin=$7,
        goal_mode=$8, updated_at=NOW()
    `, [req.userId, daily_calls, daily_emails, daily_linkedin, weekly_calls, weekly_emails, weekly_linkedin, goal_mode]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /goals/team — admin: all members' goals + actuals
router.get('/team', auth, adminOnly, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    if (!orgId) return res.status(400).json({ error: 'No org' });

    const members = await pool.query(`
      SELECT u.id, u.full_name, u.email, u.role,
        COALESCE(g.daily_calls, 60) as daily_calls,
        COALESCE(g.daily_emails, 100) as daily_emails,
        COALESCE(g.daily_linkedin, 0) as daily_linkedin,
        COALESCE(g.weekly_calls, 300) as weekly_calls,
        COALESCE(g.weekly_emails, 500) as weekly_emails,
        COALESCE(g.weekly_linkedin, 0) as weekly_linkedin,
        COALESCE(g.goal_mode, 'daily') as goal_mode
      FROM users u
      LEFT JOIN activity_goals g ON g.user_id = u.id
      WHERE u.org_id = $1
      ORDER BY u.full_name
    `, [orgId]);

    // Get today's and this week's actuals for all members
    const memberIds = members.rows.map(m => m.id);
    const todayR = await pool.query(`
      SELECT user_id, activity_type, COUNT(*) as count
      FROM activity_log
      WHERE user_id = ANY($1)
        AND logged_at >= CURRENT_DATE AND logged_at < CURRENT_DATE + INTERVAL '1 day'
      GROUP BY user_id, activity_type
    `, [memberIds]);
    const weekR = await pool.query(`
      SELECT user_id, activity_type, COUNT(*) as count
      FROM activity_log
      WHERE user_id = ANY($1)
        AND logged_at >= date_trunc('week', CURRENT_DATE)
        AND logged_at < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
      GROUP BY user_id, activity_type
    `, [memberIds]);

    const todayByUser = {};
    todayR.rows.forEach(r => {
      if (!todayByUser[r.user_id]) todayByUser[r.user_id] = {};
      todayByUser[r.user_id][r.activity_type] = parseInt(r.count);
    });
    const weekByUser = {};
    weekR.rows.forEach(r => {
      if (!weekByUser[r.user_id]) weekByUser[r.user_id] = {};
      weekByUser[r.user_id][r.activity_type] = parseInt(r.count);
    });

    const result = members.rows.map(m => ({
      ...m,
      today: {
        calls: todayByUser[m.id]?.call || 0,
        emails: todayByUser[m.id]?.email || 0,
        linkedin: todayByUser[m.id]?.linkedin || 0,
      },
      week: {
        calls: weekByUser[m.id]?.call || 0,
        emails: weekByUser[m.id]?.email || 0,
        linkedin: weekByUser[m.id]?.linkedin || 0,
      },
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /goals/team/:userId — admin sets goals for a specific member
router.put('/team/:userId', auth, adminOnly, async (req, res) => {
  const { daily_calls, daily_emails, daily_linkedin, weekly_calls, weekly_emails, weekly_linkedin, goal_mode } = req.body;
  try {
    await pool.query(`
      INSERT INTO activity_goals (user_id, daily_calls, daily_emails, daily_linkedin, weekly_calls, weekly_emails, weekly_linkedin, goal_mode)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (user_id) DO UPDATE SET
        daily_calls=$2, daily_emails=$3, daily_linkedin=$4,
        weekly_calls=$5, weekly_emails=$6, weekly_linkedin=$7,
        goal_mode=$8, updated_at=NOW()
    `, [req.params.userId, daily_calls, daily_emails, daily_linkedin, weekly_calls, weekly_emails, weekly_linkedin, goal_mode]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /goals/log — manually log an activity (calls made outside the sequence tracker)
router.post('/log', auth, async (req, res) => {
  const { activity_type, count = 1 } = req.body;
  try {
    for (let i = 0; i < count; i++) {
      await pool.query(
        `INSERT INTO activity_log (user_id, activity_type, logged_at) VALUES ($1,$2,NOW())`,
        [req.userId, activity_type]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /goals/cleanup — one-time cleanup of backfill pollution in activity_log
router.post('/cleanup', auth, async (req, res) => {
  try {
    // The backfill ran on April 1 2026 and stamped all 157 leads × multiple touches
    // These are identifiable because: same user, same day, >50 entries, lead_id is set
    // Strategy: delete activity_log entries where we have >50 lead-based entries on any single day
    const result = await pool.query(`
      DELETE FROM activity_log
      WHERE user_id = $1
        AND lead_id IS NOT NULL
        AND DATE(logged_at) IN (
          SELECT DATE(logged_at) as log_date
          FROM activity_log
          WHERE user_id = $1 AND lead_id IS NOT NULL
          GROUP BY DATE(logged_at)
          HAVING COUNT(*) > 50
        )
    `, [req.userId]);
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
