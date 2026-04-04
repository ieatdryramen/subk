const router = require('express').Router();
const { pool } = require('../db');

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// Track email open
router.get('/open/:leadId/:touchpoint', async (req, res) => {
  try {
    const { leadId, touchpoint } = req.params;
    await pool.query(`
      INSERT INTO email_tracking (lead_id, touchpoint, opened_at, ip, user_agent)
      VALUES ($1, $2, NOW(), $3, $4)
      ON CONFLICT DO NOTHING
    `, [leadId, touchpoint, req.ip, req.headers['user-agent']]);
    // Update sequence event
    await pool.query(`
      UPDATE sequence_events SET opened_at = NOW() 
      WHERE lead_id=$1 AND touchpoint=$2 AND opened_at IS NULL
    `, [leadId, touchpoint]);
  } catch (err) {
    // Silent fail - never break email delivery
  }
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(PIXEL);
});

// Track link click
router.get('/click/:leadId/:touchpoint', async (req, res) => {
  const { url } = req.query;
  try {
    await pool.query(`
      UPDATE sequence_events SET clicked_at = NOW()
      WHERE lead_id=$1 AND touchpoint=$2 AND clicked_at IS NULL
    `, [req.params.leadId, req.params.touchpoint]);
  } catch (err) {}
  // Validate redirect URL to prevent open redirect
  if (url && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('/'))) {
    res.redirect(url);
  } else {
    res.redirect('/');
  }
});

module.exports = router;
