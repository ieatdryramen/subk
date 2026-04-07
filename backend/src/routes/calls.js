const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const axios = require('axios');

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;

const getZohoToken = async (userId) => {
  const result = await pool.query(`
    SELECT cp.zoho_refresh_token FROM company_profiles cp
    JOIN users u ON (cp.user_id = u.id OR cp.org_id = u.org_id)
    WHERE u.id = $1 AND cp.zoho_refresh_token IS NOT NULL LIMIT 1
  `, [userId]);
  const refreshToken = result.rows[0]?.zoho_refresh_token;
  if (!refreshToken) throw new Error('Zoho not connected');
  const res = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
    params: { refresh_token: refreshToken, client_id: ZOHO_CLIENT_ID, client_secret: ZOHO_CLIENT_SECRET, grant_type: 'refresh_token' }
  });
  if (!res.data.access_token) throw new Error('Failed to refresh Zoho token');
  return res.data.access_token;
};

// Get call history for a lead
router.get('/:leadId', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.full_name as caller FROM call_logs c
       JOIN users u ON u.id = c.user_id
       WHERE c.lead_id = $1 ORDER BY c.called_at DESC`,
      [req.params.leadId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Log a call (after making it) + sync to Zoho
router.post('/:leadId/log', auth, async (req, res) => {
  const { duration_seconds, outcome, notes, called_at } = req.body;
  // outcome: connected | voicemail | no_answer | busy | callback_requested
  try {
    const leadResult = await pool.query('SELECT * FROM leads WHERE id=$1', [req.params.leadId]);
    if (!leadResult.rows.length) return res.status(404).json({ error: 'Lead not found' });
    const lead = leadResult.rows[0];

    // Save call log locally
    const callResult = await pool.query(
      `INSERT INTO call_logs (lead_id, user_id, duration_seconds, outcome, notes, called_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [lead.id, req.userId, duration_seconds || 0, outcome || 'connected', notes || '', called_at || new Date()]
    );

    // Log activity for goals tracking (call logging is separate from the sequence cadence
    // which uses specific touchpoints like call1, call2, etc. managed via /sequence/:leadId/touch)
    await pool.query(
      `INSERT INTO activity_log (user_id, lead_id, activity_type, touchpoint, logged_at)
       VALUES ($1,$2,'call','call_log',NOW())`,
      [req.userId, lead.id]
    ).catch(() => {}); // non-fatal

    // Sync to Zoho if connected
    if (lead.zoho_contact_id) {
      try {
        const token = await getZohoToken(req.userId);
        const headers = { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' };

        const durationStr = duration_seconds
          ? `${Math.floor(duration_seconds / 60)}:${String(duration_seconds % 60).padStart(2, '0')} min`
          : 'Unknown';

        const outcomeLabels = {
          connected: 'Call Connected',
          voicemail: 'Left Voicemail',
          no_answer: 'No Answer',
          busy: 'Busy',
          callback_requested: 'Callback Requested',
        };

        // Log as a Zoho CRM call activity
        await axios.post('https://www.zohoapis.com/crm/v2/Calls', {
          data: [{
            Subject: `Call with ${lead.full_name || lead.email} — ${outcomeLabels[outcome] || outcome}`,
            Call_Type: 'Outbound',
            Call_Status: outcome === 'connected' ? 'Completed' : outcome === 'voicemail' ? 'Left Voicemail' : 'Not Connected',
            Call_Duration: durationStr,
            Description: notes || '',
            Who_Id: { id: lead.zoho_contact_id, module: 'Contacts' },
          }]
        }, { headers });
      } catch (zohoErr) {
        console.error('Zoho call sync error:', zohoErr.response?.data || zohoErr.message);
        // Don't fail the whole request if Zoho sync fails
      }
    }

    res.json({ success: true, call: callResult.rows[0] });
  } catch (err) {
    console.error('Call log error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
