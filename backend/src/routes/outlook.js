const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const axios = require('axios');

const CLIENT_ID = process.env.OUTLOOK_CLIENT_ID;
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.APP_URL
  ? `${process.env.APP_URL}/api/outlook/callback`
  : 'https://prospectforge-production-1f99.up.railway.app/api/outlook/callback';

// Start OAuth flow
router.get('/connect', auth, async (req, res) => {
  if (!CLIENT_ID) return res.status(400).json({ error: 'Outlook not configured. Add OUTLOOK_CLIENT_ID to environment variables.' });
  const state = Buffer.from(JSON.stringify({ userId: req.userId })).toString('base64');
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=offline_access%20Mail.Send%20Mail.ReadWrite&state=${state}`;
  res.json({ url: authUrl });
});

// OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect('/team?outlook=error');
  try {
    let userId;
    if (state) { try { userId = JSON.parse(Buffer.from(state, 'base64').toString()).userId; } catch (e) {} }

    const tokenRes = await axios.post(
      `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { refresh_token, access_token } = tokenRes.data;

    // Get user email from Microsoft Graph
    const meRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const outlookEmail = meRes.data.mail || meRes.data.userPrincipalName;

    if (userId) {
      await pool.query(
        'UPDATE users SET outlook_refresh_token=$1, outlook_email=$2 WHERE id=$3',
        [refresh_token, outlookEmail, userId]
      );
    }
    res.redirect('/team?outlook=connected');
  } catch (err) {
    console.error('Outlook callback error:', err.response?.data || err.message);
    res.redirect('/team?outlook=error');
  }
});

// Send email via Outlook
router.post('/send', auth, async (req, res) => {
  const { to, subject, body } = req.body;
  try {
    const user = await pool.query('SELECT outlook_refresh_token FROM users WHERE id=$1', [req.userId]);
    const refreshToken = user.rows[0]?.outlook_refresh_token;
    if (!refreshToken) return res.status(400).json({ error: 'Outlook not connected' });

    // Get fresh access token
    const tokenRes = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    await axios.post(
      'https://graph.microsoft.com/v1.0/me/sendMail',
      {
        message: {
          subject,
          body: { contentType: 'Text', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        }
      },
      { headers: { Authorization: `Bearer ${tokenRes.data.access_token}`, 'Content-Type': 'application/json' } }
    );

    // Log as sequence event if leadId provided
    if (req.body.leadId && req.body.touchpoint) {
      await pool.query(
        `INSERT INTO sequence_events (lead_id, user_id, touchpoint, status, notes, completed_at)
         VALUES ($1,$2,$3,'done',$4,NOW())
         ON CONFLICT DO NOTHING`,
        [req.body.leadId, req.userId, req.body.touchpoint, `Sent via Outlook to ${to}`]
      );
      await pool.query("UPDATE leads SET status='done' WHERE id=$1", [req.body.leadId]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Outlook send error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to send email via Outlook' });
  }
});

// Status check
router.get('/status', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT outlook_refresh_token, outlook_email FROM users WHERE id=$1', [req.userId]);
    const u = result.rows[0];
    res.json({ connected: !!u?.outlook_refresh_token, email: u?.outlook_email });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
