const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const axios = require('axios');

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_URI = 'https://prospectforge-production-1f99.up.railway.app/api/gmail/callback';

const getGmailToken = async (userId) => {
  const result = await pool.query('SELECT gmail_refresh_token FROM users WHERE id=$1', [userId]);
  const refreshToken = result.rows[0]?.gmail_refresh_token;
  if (!refreshToken) throw new Error('Gmail not connected');
  const res = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  if (!res.data.access_token) throw new Error('Failed to refresh Gmail token');
  return res.data.access_token;
};

router.get('/connect', auth, async (req, res) => {
  if (!CLIENT_ID) return res.status(400).json({ error: 'Gmail not configured. Add GMAIL_CLIENT_ID to environment variables.' });
  const state = Buffer.from(JSON.stringify({ userId: req.userId })).toString('base64');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/gmail.send&access_type=offline&prompt=consent&state=${state}`;
  res.json({ url: authUrl });
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect('/team?gmail=error');
  try {
    let userId;
    if (state) { try { userId = JSON.parse(Buffer.from(state, 'base64').toString()).userId; } catch (e) {} }
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
    });
    const { refresh_token, access_token } = tokenRes.data;
    const meRes = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    if (userId) {
      await pool.query('UPDATE users SET gmail_refresh_token=$1, gmail_email=$2 WHERE id=$3',
        [refresh_token, meRes.data.email, userId]);
    }
    res.redirect('/team?gmail=connected');
  } catch (err) {
    console.error('Gmail callback error:', err.response?.data || err.message);
    res.redirect('/team?gmail=error');
  }
});

router.post('/send/:leadId', auth, async (req, res) => {
  const { subject, body, touchpoint } = req.body;
  try {
    const leadResult = await pool.query(`
      SELECT l.* FROM leads l JOIN users u ON u.id = $2
      WHERE l.id = $1 AND (l.user_id = $2 OR EXISTS (
        SELECT 1 FROM users lu WHERE lu.id = l.user_id AND lu.org_id = u.org_id AND u.org_id IS NOT NULL
      ))`, [req.params.leadId, req.userId]);
    if (!leadResult.rows.length) return res.status(404).json({ error: 'Lead not found' });
    const lead = leadResult.rows[0];
    if (!lead.email) return res.status(400).json({ error: 'Lead has no email address' });

    const token = await getGmailToken(req.userId);

    // Build RFC 2822 email
    const email = [
      `To: ${lead.full_name || ''} <${lead.email}>`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\n');

    const encoded = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    await axios.post('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      { raw: encoded },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    // Mark touchpoint done
    if (touchpoint) {
      await pool.query(`
        INSERT INTO sequence_events (lead_id, user_id, touchpoint, status, notes, completed_at)
        VALUES ($1,$2,$3,'done',$4,NOW())
        ON CONFLICT (lead_id, touchpoint) DO UPDATE SET status='done', notes=$4, completed_at=NOW()
      `, [lead.id, req.userId, touchpoint, `Sent via Gmail to ${lead.email}`]);
    }

    res.json({ success: true, message: `Email sent to ${lead.email} via Gmail` });
  } catch (err) {
    console.error('Gmail send error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to send email via Gmail' });
  }
});

router.get('/status', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT gmail_refresh_token, gmail_email FROM users WHERE id=$1', [req.userId]);
    const u = result.rows[0];
    res.json({ connected: !!u?.gmail_refresh_token, email: u?.gmail_email });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/disconnect', auth, async (req, res) => {
  try {
    await pool.query('UPDATE users SET gmail_refresh_token=NULL, gmail_email=NULL WHERE id=$1', [req.userId]);
    res.json({ success: true, message: 'Gmail disconnected' });
  } catch (err) {
    console.error('Gmail disconnect error:', err.message);
    res.status(500).json({ error: 'Failed to disconnect Gmail' });
  }
});

module.exports = router;
