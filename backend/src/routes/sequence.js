const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// The 10-touch cadence: Email, LinkedIn, Call, Email, Call, Email, LinkedIn, Call, Email, Call -> MEFU
const DEFAULT_TOUCHPOINTS = [
  { key: 'email1',           label: 'Email 1',          type: 'email',    order: 1 },
  { key: 'linkedin_connect', label: 'LinkedIn Connect',  type: 'linkedin', order: 2 },
  { key: 'call1',            label: 'Call 1',            type: 'call',     order: 3 },
  { key: 'email2',           label: 'Email 2',           type: 'email',    order: 4 },
  { key: 'call2',            label: 'Call 2',            type: 'call',     order: 5 },
  { key: 'email3',           label: 'Email 3',           type: 'email',    order: 6 },
  { key: 'linkedin_dm',      label: 'LinkedIn DM',       type: 'linkedin', order: 7 },
  { key: 'call3',            label: 'Call 3',            type: 'call',     order: 8 },
  { key: 'email4',           label: 'Email 4',           type: 'email',    order: 9 },
  { key: 'call4',            label: 'Call 4',            type: 'call',     order: 10 },
];

// Add N business days to a date (Mon-Fri only)
const addBusinessDays = (date, days) => {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
};

// Is a date before today (overdue)?
const isOverdue = (date) => {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < today;
};

// Is a date today?
const isToday = (date) => {
  if (!date) return false;
  const today = new Date();
  const d = new Date(date);
  return d.toDateString() === today.toDateString();
};

const getOrgTouchpoints = async (orgId) => {
  if (!orgId) return DEFAULT_TOUCHPOINTS;
  const r = await pool.query('SELECT config FROM org_sequence_config WHERE org_id=$1', [orgId]);
  if (r.rows.length && r.rows[0].config) return r.rows[0].config;
  return DEFAULT_TOUCHPOINTS;
};

// GET /sequence/config
router.get('/config', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const tps = await getOrgTouchpoints(orgId);
    res.json(tps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /sequence/config
router.put('/config', auth, async (req, res) => {
  const { config } = req.body;
  if (!Array.isArray(config)) return res.status(400).json({ error: 'config must be array' });
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    if (!orgId) return res.status(400).json({ error: 'No org found' });
    await pool.query(
      `INSERT INTO org_sequence_config (org_id, config) VALUES ($1,$2)
       ON CONFLICT (org_id) DO UPDATE SET config=$2, updated_at=NOW()`,
      [orgId, JSON.stringify(config)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sequence/due/today — for the banner and action center
router.get('/due/today', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const TOUCHPOINTS = await getOrgTouchpoints(orgId);

    // Get all active leads for this user's org — exclude snoozed, not_interested, meeting_booked
    const leadsR = await pool.query(`
      SELECT l.id, l.full_name, l.company, l.list_id, l.icp_score, l.sequence_stage, l.engagement_status, l.snoozed_until
      FROM leads l
      JOIN users u ON u.id = $1
      WHERE l.status = 'done'
        AND (l.user_id = $1 OR (u.org_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM users lu WHERE lu.id = l.user_id AND lu.org_id = u.org_id
        )))
        AND (l.sequence_stage IS NULL OR l.sequence_stage NOT IN ('completed', 'meeting_booked'))
        AND (l.engagement_status IS NULL OR l.engagement_status NOT IN ('not_interested', 'meeting_booked'))
        AND (l.snoozed_until IS NULL OR l.snoozed_until < NOW())
      ORDER BY l.icp_score DESC NULLS LAST
    `, [req.userId]);

    const due = [];
    const overdue = [];

    // Batch-fetch all sequence events for all leads (fixes N+1 query)
    const leadIds = leadsR.rows.map(l => l.id);
    const allEventsR = leadIds.length
      ? await pool.query(
          'SELECT * FROM sequence_events WHERE lead_id = ANY($1) ORDER BY created_at ASC',
          [leadIds]
        )
      : { rows: [] };
    const eventsByLead = {};
    allEventsR.rows.forEach(e => {
      if (!eventsByLead[e.lead_id]) eventsByLead[e.lead_id] = [];
      eventsByLead[e.lead_id].push(e);
    });

    for (const lead of leadsR.rows) {
      const events = eventsByLead[lead.id] || [];
      const eventMap = {};
      events.forEach(e => { eventMap[e.touchpoint] = e; });

      // Find next pending touchpoint and its due date
      let lastCompletedDate = null;
      let nextTouch = null;

      for (let idx = 0; idx < TOUCHPOINTS.length; idx++) {
        const tp = TOUCHPOINTS[idx];
        const event = eventMap[tp.key];
        const status = event?.status || 'pending';

        if (status === 'done') {
          lastCompletedDate = event.completed_at;
          continue;
        }

        // This is the next pending touch
        let due_date = null;
        if (idx === 0) {
          due_date = new Date().toISOString(); // first touch always due
        } else if (lastCompletedDate) {
          due_date = addBusinessDays(lastCompletedDate, 1).toISOString();
        }

        if (due_date) {
          if (isOverdue(due_date)) {
            const daysAgo = Math.floor((new Date() - new Date(due_date)) / (1000 * 60 * 60 * 24));
            overdue.push({ ...lead, next_touch: tp.key, next_touch_label: tp.label, next_touch_type: tp.type, due_date, days_overdue: daysAgo, urgency: 'overdue' });
          } else if (isToday(due_date)) {
            due.push({ ...lead, next_touch: tp.key, next_touch_label: tp.label, next_touch_type: tp.type, due_date, days_overdue: 0, urgency: 'due' });
          }
        }
        nextTouch = tp;
        break;
      }

      // MEFU check
      if (!nextTouch && lead.sequence_stage === 'mefu') {
        const mefuEvent = eventMap['mefu'];
        const lastDone = events.filter(e => e.touchpoint !== 'mefu' && e.status === 'done').pop();
        let mefuDue = null;
        if (mefuEvent?.completed_at) {
          const next = new Date(mefuEvent.completed_at);
          next.setMonth(next.getMonth() + 1);
          mefuDue = next.toISOString();
        } else if (lastDone?.completed_at) {
          const next = new Date(lastDone.completed_at);
          next.setMonth(next.getMonth() + 1);
          mefuDue = next.toISOString();
        }
        if (mefuDue && isOverdue(mefuDue)) {
          overdue.push({ ...lead, next_touch: 'mefu', next_touch_label: 'Monthly Follow-Up', next_touch_type: 'email', due_date: mefuDue, days_overdue: Math.floor((new Date() - new Date(mefuDue)) / (1000 * 60 * 60 * 24)), urgency: 'overdue' });
        } else if (mefuDue && isToday(mefuDue)) {
          due.push({ ...lead, next_touch: 'mefu', next_touch_label: 'Monthly Follow-Up', next_touch_type: 'email', due_date: mefuDue, days_overdue: 0, urgency: 'due' });
        }
      }
    }

    res.json({ overdue, due, total: overdue.length + due.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sequence/:leadId — returns sequence with due dates calculated from completion dates
router.get('/:leadId', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const TOUCHPOINTS = await getOrgTouchpoints(orgId);

    const events = await pool.query(
      'SELECT * FROM sequence_events WHERE lead_id=$1 ORDER BY created_at ASC',
      [req.params.leadId]
    );
    const eventMap = {};
    events.rows.forEach(e => { eventMap[e.touchpoint] = e; });

    // Calculate due dates: each touch is due 1 business day after previous was completed
    let lastCompletedDate = null;
    const sequence = TOUCHPOINTS.map((tp, idx) => {
      const event = eventMap[tp.key];
      const status = event?.status || 'pending';
      const completed_at = event?.completed_at || null;

      // Due date calculation
      let due_date = null;
      if (idx === 0) {
        // First touch: due when lead was created (or now if no event)
        if (completed_at) {
          lastCompletedDate = completed_at;
        }
        due_date = completed_at ? null : new Date().toISOString();
      } else {
        if (lastCompletedDate) {
          due_date = addBusinessDays(lastCompletedDate, 1).toISOString();
        }
        if (completed_at) {
          lastCompletedDate = completed_at;
        }
      }

      const urgency = status === 'done' ? 'done' :
        (due_date && isOverdue(due_date)) ? 'overdue' :
        (due_date && isToday(due_date)) ? 'due' : 'upcoming';

      return {
        ...tp,
        status,
        notes: event?.notes || '',
        completed_at,
        event_id: event?.id || null,
        opened_at: event?.opened_at || null,
        clicked_at: event?.clicked_at || null,
        call_outcome: event?.call_outcome || null,
        due_date,
        urgency,
      };
    });

    // Check if all 10 done -> MEFU
    const allDone = sequence.every(tp => tp.status === 'done');
    const mefuEvent = eventMap['mefu'];
    if (allDone) {
      // Calculate next MEFU date
      const lastDone = sequence[sequence.length - 1]?.completed_at;
      let mefuDue = null;
      if (mefuEvent?.completed_at) {
        const next = new Date(mefuEvent.completed_at);
        next.setMonth(next.getMonth() + 1);
        mefuDue = next.toISOString();
      } else if (lastDone) {
        const next = new Date(lastDone);
        next.setMonth(next.getMonth() + 1);
        mefuDue = next.toISOString();
      }
      sequence.push({
        key: 'mefu', label: 'Monthly Follow-Up (MEFU)', type: 'email', order: 11,
        status: mefuEvent?.status || 'pending',
        notes: mefuEvent?.notes || '',
        completed_at: mefuEvent?.completed_at || null,
        due_date: mefuDue,
        urgency: mefuEvent?.status === 'done' ? 'due' : (mefuDue && isOverdue(mefuDue)) ? 'overdue' : (mefuDue && isToday(mefuDue)) ? 'due' : 'upcoming',
        is_mefu: true,
      });
    }

    res.json(sequence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sequence/:leadId/touch
router.post('/:leadId/touch', auth, async (req, res) => {
  const { touchpoint, status, notes, call_outcome } = req.body;
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const TOUCHPOINTS = await getOrgTouchpoints(orgId);

    // If marking done, backfill all prior pending touches first
    if (status === 'done') {
      const touchIdx = TOUCHPOINTS.findIndex(t => t.key === touchpoint);
      if (touchIdx > 0) {
        const priorTouches = TOUCHPOINTS.slice(0, touchIdx);
        for (let i = 0; i < priorTouches.length; i++) {
          const prior = priorTouches[i];
          const exists = await pool.query(
            "SELECT id, status FROM sequence_events WHERE lead_id=$1 AND touchpoint=$2",
            [req.params.leadId, prior.key]
          );
          if (!exists.rows.length || exists.rows[0].status !== 'done') {
            // Timestamp them sequentially, a minute apart, ending just before now
            const ts = new Date(Date.now() - ((touchIdx - i) * 60000));
            if (exists.rows.length) {
              await pool.query(
                `UPDATE sequence_events SET status='done', completed_at=$1 WHERE id=$2`,
                [ts, exists.rows[0].id]
              );
            } else {
              await pool.query(
                `INSERT INTO sequence_events (lead_id, user_id, touchpoint, status, notes, completed_at)
                 VALUES ($1,$2,$3,'done','',$4)`,
                [req.params.leadId, req.userId, prior.key, ts]
              );
            }
            // Log activity for each backfilled touch
            const actType = prior.type || 'email';
            await pool.query(
              `INSERT INTO activity_log (user_id, lead_id, activity_type, touchpoint, logged_at)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT DO NOTHING`,
              [req.userId, req.params.leadId, actType, prior.key, ts]
            ).catch(() => {});
          }
        }
      }
    }

    const existing = await pool.query(
      'SELECT id FROM sequence_events WHERE lead_id=$1 AND touchpoint=$2',
      [req.params.leadId, touchpoint]
    );

    let result;
    if (existing.rows.length) {
      result = await pool.query(
        `UPDATE sequence_events SET status=$1, notes=$2, completed_at=$3, call_outcome=$4 WHERE id=$5 RETURNING *`,
        [status, notes, status === 'done' ? new Date() : null, call_outcome || null, existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO sequence_events (lead_id, user_id, touchpoint, status, notes, completed_at, call_outcome)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.params.leadId, req.userId, touchpoint, status, notes, status === 'done' ? new Date() : null, call_outcome || null]
      );
    }

    // If meeting booked via call, update engagement status
    if (call_outcome === 'meeting_booked') {
      await pool.query(
        `UPDATE leads SET engagement_status='meeting_booked', meeting_booked_at=NOW(), sequence_stage='meeting_booked' WHERE id=$1`,
        [req.params.leadId]
      );
    }

    // Update sequence stage
    const doneCount = await pool.query(
      "SELECT COUNT(*) FROM sequence_events WHERE lead_id=$1 AND status='done' AND touchpoint != 'mefu'",
      [req.params.leadId]
    );
    const done = parseInt(doneCount.rows[0].count);
    let stage;
    if (done === 0) stage = 'not_started';
    else if (done >= 10) stage = 'mefu';
    else stage = `in_progress_${done}`;
    await pool.query('UPDATE leads SET sequence_stage=$1 WHERE id=$2', [stage, req.params.leadId]);

    // Log activity for goals tracking
    if (status === 'done') {
      const tpDef = DEFAULT_TOUCHPOINTS.find(t => t.key === touchpoint);
      const actType = tpDef?.type || (touchpoint === 'mefu' ? 'email' : 'email');
      await pool.query(
        `INSERT INTO activity_log (user_id, lead_id, activity_type, touchpoint, logged_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT DO NOTHING`,
        [req.userId, req.params.leadId, actType, touchpoint]
      ).catch(() => {}); // non-fatal
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /sequence/:leadId/stage
router.post('/:leadId/stage', auth, async (req, res) => {
  const { stage, field } = req.body;
  try {
    const col = field || 'sequence_stage';
    const allowed = ['sequence_stage', 'email_stage', 'call_stage', 'linkedin_stage'];
    if (!allowed.includes(col)) return res.status(400).json({ error: 'Invalid field' });
    await pool.query(`UPDATE leads SET ${col}=$1 WHERE id=$2`, [stage, req.params.leadId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;

