const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// GET /notifications — get all notifications for the user (last 50), ordered by created_at DESC
router.get('/', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Notifications error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /notifications/unread-count — returns { count: N } of unread notifications
router.get('/unread-count', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false',
      [req.userId]
    );
    const count = parseInt(r.rows[0].count);
    res.json({ count });
  } catch (err) {
    console.error('Unread count error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /notifications/:id/read — mark a notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2 RETURNING *',
      [req.params.id, req.userId]
    );
    if (!r.rows.length) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(r.rows[0]);
  } catch (err) {
    console.error('Mark read error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /notifications/read-all — mark all user's notifications as read
router.put('/read-all', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read=true WHERE user_id=$1 AND is_read=false',
      [req.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Read all error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
