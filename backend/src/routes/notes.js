const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

router.get('/:leadId', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT n.*, u.full_name as author FROM lead_notes n JOIN users u ON u.id=n.user_id WHERE n.lead_id=$1 ORDER BY n.created_at DESC',
      [req.params.leadId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:leadId/:noteId', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM lead_notes WHERE id=$1 AND user_id=$2', [req.params.noteId, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
