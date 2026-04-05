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

module.exports = router;
