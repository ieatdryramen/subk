const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// POST /engagement/:leadId/status — set engagement status
router.post('/:leadId/status', auth, async (req, res) => {
  const { status } = req.body; // active | responded | meeting_booked | not_interested | nurture
  const allowed = ['active', 'responded', 'meeting_booked', 'not_interested', 'nurture'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    // Verify user owns lead or is in same org
    const leadCheck = await pool.query(
      `SELECT l.id FROM leads l JOIN users u ON u.id = $2
       WHERE l.id = $1 AND (l.user_id = $2 OR (u.org_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM users lu WHERE lu.id = l.user_id AND lu.org_id = u.org_id
       )))`,
      [req.params.leadId, req.userId]
    );
    if (!leadCheck.rows.length) return res.status(403).json({ error: 'Access denied' });
    await pool.query(
      `UPDATE leads SET engagement_status=$1 ${status === 'meeting_booked' ? ', meeting_booked_at=NOW()' : ''} WHERE id=$2`,
      [status, req.params.leadId]
    );
    // If responded or meeting_booked, update sequence_stage
    if (status === 'meeting_booked') {
      await pool.query(`UPDATE leads SET sequence_stage='meeting_booked' WHERE id=$1`, [req.params.leadId]);
    }
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /engagement/:leadId/snooze — snooze until date
router.post('/:leadId/snooze', auth, async (req, res) => {
  const { days, until } = req.body;
  try {
    let snoozeDate;
    if (until) {
      snoozeDate = new Date(until);
    } else {
      snoozeDate = new Date();
      snoozeDate.setDate(snoozeDate.getDate() + (days || 7));
    }
    await pool.query(
      `UPDATE leads SET snoozed_until=$1, engagement_status='active' WHERE id=$2`,
      [snoozeDate, req.params.leadId]
    );
    res.json({ success: true, snoozed_until: snoozeDate });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /engagement/:leadId/snooze — unsnooze
router.delete('/:leadId/snooze', auth, async (req, res) => {
  try {
    await pool.query(`UPDATE leads SET snoozed_until=NULL WHERE id=$1`, [req.params.leadId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /engagement/:leadId/notes — get conversation notes
router.get('/:leadId/notes', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT cn.*, u.full_name as user_name 
       FROM conversation_notes cn 
       JOIN users u ON u.id = cn.user_id
       WHERE cn.lead_id=$1 ORDER BY cn.created_at DESC`,
      [req.params.leadId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /engagement/:leadId/notes — add conversation note
router.post('/:leadId/notes', auth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Note content required' });
  try {
    const r = await pool.query(
      `INSERT INTO conversation_notes (lead_id, user_id, content) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.leadId, req.userId, content.trim()]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /engagement/notes/:noteId — delete a note
router.delete('/notes/:noteId', auth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM conversation_notes WHERE id=$1 AND user_id=$2`, [req.params.noteId, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
