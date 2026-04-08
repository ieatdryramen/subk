const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Legacy GET /:leadId (keep for backwards compatibility)
router.get('/:leadId', auth, async (req, res) => {
  try {
    // Verify user owns this lead
    const leadCheck = await pool.query('SELECT id FROM leads WHERE id=$1 AND user_id=$2', [req.params.leadId, req.userId]);
    if (!leadCheck.rows.length) return res.status(403).json({ error: 'Access denied' });
    const result = await pool.query(
      'SELECT n.*, u.full_name as author FROM lead_notes n JOIN users u ON u.id=n.user_id WHERE n.lead_id=$1 ORDER BY n.created_at DESC',
      [req.params.leadId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Legacy POST /:leadId (keep for backwards compatibility)
router.post('/:leadId', auth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
  try {
    const result = await pool.query(
      'INSERT INTO lead_notes (lead_id, user_id, content) VALUES ($1,$2,$3) RETURNING *',
      [req.params.leadId, req.userId, content.trim()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Legacy DELETE /:leadId/:noteId
router.delete('/:leadId/:noteId', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM lead_notes WHERE id=$1 AND user_id=$2', [req.params.noteId, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// NEW: GET /lead/:leadId - Get all notes for a lead with user info
router.get('/lead/:leadId', auth, async (req, res) => {
  try {
    // Verify user owns this lead
    const leadCheck = await pool.query('SELECT id FROM leads WHERE id=$1 AND user_id=$2', [req.params.leadId, req.userId]);
    if (!leadCheck.rows.length) return res.status(403).json({ error: 'Access denied' });
    const result = await pool.query(
      `SELECT n.id, n.lead_id, n.content, n.note_type, n.created_at, n.updated_at,
              u.id as user_id, u.full_name as user_name, u.email as user_email
       FROM lead_notes n
       JOIN users u ON u.id=n.user_id
       WHERE n.lead_id=$1
       ORDER BY n.created_at DESC`,
      [req.params.leadId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// NEW: POST /lead/:leadId - Create a note with note_type
router.post('/lead/:leadId', auth, async (req, res) => {
  const { content, note_type } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
  const type = note_type || 'general';
  try {
    const result = await pool.query(
      `INSERT INTO lead_notes (lead_id, user_id, content, note_type)
       VALUES ($1,$2,$3,$4)
       RETURNING id, lead_id, content, note_type, created_at, updated_at, user_id`,
      [req.params.leadId, req.userId, content.trim(), type]
    );
    // Fetch user info to return with note
    const userResult = await pool.query(
      'SELECT id, full_name as user_name, email as user_email FROM users WHERE id=$1',
      [req.userId]
    );
    const note = result.rows[0];
    const user = userResult.rows[0];
    res.json({ ...note, user_name: user.user_name, user_email: user.user_email });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// NEW: GET /lead/:leadId/timeline - Unified timeline of notes + sequence_events
router.get('/lead/:leadId/timeline', auth, async (req, res) => {
  try {
    // Verify user owns this lead
    const leadCheck = await pool.query('SELECT id FROM leads WHERE id=$1 AND user_id=$2', [req.params.leadId, req.userId]);
    if (!leadCheck.rows.length) return res.status(403).json({ error: 'Access denied' });
    // Get notes
    const notesResult = await pool.query(
      `SELECT 'note' as type, n.id, n.content, n.note_type, n.created_at,
              u.full_name as user_name, u.email as user_email
       FROM lead_notes n
       JOIN users u ON u.id=n.user_id
       WHERE n.lead_id=$1`,
      [req.params.leadId]
    );

    // Get sequence events
    const eventsResult = await pool.query(
      `SELECT 'touch' as type, se.id, se.touchpoint, se.status, se.notes, se.completed_at as created_at,
              u.full_name as user_name, u.email as user_email
       FROM sequence_events se
       JOIN users u ON u.id=se.user_id
       WHERE se.lead_id=$1`,
      [req.params.leadId]
    );

    // Combine and sort by created_at DESC
    const items = [...notesResult.rows, ...eventsResult.rows].sort((a, b) =>
      new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
