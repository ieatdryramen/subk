const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Get upcoming touches due today/this week based on sequence events
router.get('/due', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        l.id as lead_id,
        l.full_name,
        l.company,
        l.title,
        l.email,
        l.list_id,
        l.sequence_stage,
        l.icp_score,
        -- Figure out what touchpoint is next
        CASE
          WHEN NOT EXISTS (SELECT 1 FROM sequence_events se WHERE se.lead_id = l.id AND se.touchpoint = 'email1' AND se.status = 'done') THEN 'email1'
          WHEN NOT EXISTS (SELECT 1 FROM sequence_events se WHERE se.lead_id = l.id AND se.touchpoint = 'email2' AND se.status = 'done') THEN 'email2'
          WHEN NOT EXISTS (SELECT 1 FROM sequence_events se WHERE se.lead_id = l.id AND se.touchpoint = 'call' AND se.status = 'done') THEN 'call'
          WHEN NOT EXISTS (SELECT 1 FROM sequence_events se WHERE se.lead_id = l.id AND se.touchpoint = 'email3' AND se.status = 'done') THEN 'email3'
          WHEN NOT EXISTS (SELECT 1 FROM sequence_events se WHERE se.lead_id = l.id AND se.touchpoint = 'linkedin_dm' AND se.status = 'done') THEN 'linkedin_dm'
          WHEN NOT EXISTS (SELECT 1 FROM sequence_events se WHERE se.lead_id = l.id AND se.touchpoint = 'email4' AND se.status = 'done') THEN 'email4'
          ELSE 'completed'
        END as next_touch,
        -- Days since last touch
        COALESCE(
          (SELECT EXTRACT(DAY FROM NOW() - MAX(se.completed_at)) 
           FROM sequence_events se 
           WHERE se.lead_id = l.id AND se.status = 'done'),
          999
        ) as days_since_last_touch
      FROM leads l
      JOIN users u ON u.id = $1
      WHERE l.user_id = $1
        AND l.status = 'done'
        AND (l.sequence_stage IS NULL OR l.sequence_stage != 'completed')
      ORDER BY l.icp_score DESC NULLS LAST
      LIMIT 50
    `, [req.userId]);

    const TOUCH_DAYS = { email1: 0, email2: 3, call: 5, email3: 7, linkedin_dm: 10, email4: 14 };
    const TOUCH_LABELS = { 
      email1: 'Send Email 1', email2: 'Send Email 2', email3: 'Send Email 3', email4: 'Send Email 4 (Breakup)',
      call: 'Make a call', linkedin_dm: 'LinkedIn DM', completed: 'Sequence complete'
    };

    const leads = result.rows
      .filter(l => l.next_touch !== 'completed')
      .map(l => {
        const targetDays = TOUCH_DAYS[l.next_touch] ?? 0;
        const daysSince = parseFloat(l.days_since_last_touch);
        const daysOverdue = daysSince === 999 ? 0 : Math.floor(daysSince - targetDays);
        const isDue = daysOverdue >= 0;
        return {
          ...l,
          next_touch_label: TOUCH_LABELS[l.next_touch],
          days_overdue: daysOverdue,
          is_due: isDue,
          urgency: daysOverdue > 3 ? 'overdue' : isDue ? 'due' : 'upcoming'
        };
      })
      .filter(l => l.is_due || l.days_overdue > -3) // Show due + upcoming in 3 days
      .sort((a, b) => b.days_overdue - a.days_overdue);

    res.json(leads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load reminders' });
  }
});

// Get calendar data for a given month (touches + opportunity deadlines)
router.get('/calendar', auth, async (req, res) => {
  try {
    const monthStr = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Get all touches (sequence events) for this month
    const touchesResult = await pool.query(`
      SELECT
        se.id,
        se.lead_id,
        se.touchpoint,
        se.status,
        se.completed_at,
        se.created_at,
        l.full_name,
        l.company,
        CASE
          WHEN se.touchpoint LIKE 'email%' THEN 'email'
          WHEN se.touchpoint = 'call' THEN 'call'
          WHEN se.touchpoint LIKE '%linkedin%' THEN 'linkedin'
          ELSE 'other'
        END as touch_type
      FROM sequence_events se
      JOIN leads l ON se.lead_id = l.id
      WHERE se.user_id = $1
        AND se.status != 'done'
        AND se.created_at >= $2
        AND se.created_at < $3
      ORDER BY se.created_at ASC
    `, [req.userId, startDate, endDate]);

    // Get all opportunity deadlines for this month
    const opportunitiesResult = await pool.query(`
      SELECT
        o.id,
        o.title,
        o.agency,
        o.response_deadline,
        o.fit_score,
        o.opportunity_url
      FROM opportunities o
      WHERE o.org_id = (SELECT org_id FROM users WHERE id = $1)
        AND o.status IN ('new', 'tracking')
        AND o.response_deadline >= $2
        AND o.response_deadline < $3
      ORDER BY o.response_deadline ASC
    `, [req.userId, startDate, endDate]);

    // Group touches by date
    const touchesByDate = {};
    touchesResult.rows.forEach(touch => {
      const dateKey = new Date(touch.created_at).toISOString().split('T')[0];
      if (!touchesByDate[dateKey]) {
        touchesByDate[dateKey] = [];
      }
      touchesByDate[dateKey].push(touch);
    });

    // Group opportunities by date
    const opportunitiesByDate = {};
    opportunitiesResult.rows.forEach(opp => {
      const dateKey = new Date(opp.response_deadline).toISOString().split('T')[0];
      if (!opportunitiesByDate[dateKey]) {
        opportunitiesByDate[dateKey] = [];
      }
      opportunitiesByDate[dateKey].push(opp);
    });

    res.json({
      month: monthStr,
      touches: touchesByDate,
      opportunities: opportunitiesByDate,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load calendar' });
  }
});

// Get reminders summary (today + this week + upcoming)
router.get('/summary', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    // Get overdue touches
    const overdueResult = await pool.query(`
      SELECT COUNT(*) as count FROM sequence_events
      WHERE user_id = $1 AND status != 'done' AND created_at < $2
    `, [req.userId, today]);

    // Get today's touches
    const todayResult = await pool.query(`
      SELECT COUNT(*) as count FROM sequence_events
      WHERE user_id = $1 AND status != 'done' AND DATE(created_at) = $2
    `, [req.userId, today.toISOString().split('T')[0]]);

    // Get this week's touches
    const weekResult = await pool.query(`
      SELECT COUNT(*) as count FROM sequence_events
      WHERE user_id = $1 AND status != 'done' AND created_at >= $2 AND created_at < $3
    `, [req.userId, today, weekEnd]);

    // Get upcoming opportunities
    const oppsResult = await pool.query(`
      SELECT COUNT(*) as count FROM opportunities
      WHERE org_id = (SELECT org_id FROM users WHERE id = $1)
        AND status IN ('new', 'tracking')
        AND response_deadline > $2
    `, [req.userId, today]);

    res.json({
      overdue: parseInt(overdueResult.rows[0].count),
      today: parseInt(todayResult.rows[0].count),
      this_week: parseInt(weekResult.rows[0].count),
      upcoming_opportunities: parseInt(oppsResult.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

module.exports = router;
