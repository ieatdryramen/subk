const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const axios = require('axios');

// Save Slack webhook URL for org
router.post('/configure', auth, async (req, res) => {
  const { webhook_url } = req.body;
  if (!webhook_url?.startsWith('https://hooks.slack.com/')) {
    return res.status(400).json({ error: 'Invalid Slack webhook URL' });
  }
  try {
    const user = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = user.rows[0]?.org_id;
    if (!orgId) return res.status(400).json({ error: 'No organization' });
    await pool.query('UPDATE organizations SET slack_webhook=$1 WHERE id=$2', [webhook_url, orgId]);
    // Test it
    await axios.post(webhook_url, { text: '✅ ProspectForge connected to Slack!' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save or test webhook' });
  }
});

router.get('/status', auth, async (req, res) => {
  try {
    const user = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = user.rows[0]?.org_id;
    if (!orgId) return res.json({ connected: false });
    const org = await pool.query('SELECT slack_webhook FROM organizations WHERE id=$1', [orgId]);
    res.json({ connected: !!org.rows[0]?.slack_webhook });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a Slack notification (called internally)
const sendSlackNotification = async (orgId, message) => {
  try {
    const org = await pool.query('SELECT slack_webhook FROM organizations WHERE id=$1', [orgId]);
    const webhook = org.rows[0]?.slack_webhook;
    if (!webhook) return;
    await axios.post(webhook, { text: message });
  } catch (err) {
    console.error('Slack notification failed:', err.message);
  }
};

module.exports = router;
module.exports.sendSlackNotification = sendSlackNotification;
