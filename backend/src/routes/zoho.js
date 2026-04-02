const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const axios = require('axios');

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || '1000.996Z1F3EGG6QI23O3DBDEHMXA8142U';
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || '2edd338a68ae0fb399dddd0289a61aafd03a04e453';
const REDIRECT_URI = 'https://prospectforge-production-1f99.up.railway.app/api/zoho/callback';

const getZohoToken = async (userId) => {
  const result = await pool.query(`
    SELECT cp.zoho_refresh_token FROM company_profiles cp
    JOIN users u ON (cp.user_id = u.id OR cp.org_id = u.org_id)
    WHERE u.id = $1 AND cp.zoho_refresh_token IS NOT NULL
    LIMIT 1
  `, [userId]);
  const refreshToken = result.rows[0]?.zoho_refresh_token;
  if (!refreshToken) throw new Error('Zoho not connected. Go to Team & Integrations to connect.');
  const res = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
    params: { refresh_token: refreshToken, client_id: ZOHO_CLIENT_ID, client_secret: ZOHO_CLIENT_SECRET, grant_type: 'refresh_token' }
  });
  if (!res.data.access_token) throw new Error('Failed to refresh Zoho token. Reconnect in Team & Integrations.');
  return res.data.access_token;
};

// Push a lead + playbook to Zoho CRM
router.post('/push/:leadId', auth, async (req, res) => {
  try {
    const leadResult = await pool.query(`
      SELECT l.* FROM leads l JOIN users u ON u.id = $2
      WHERE l.id = $1 AND (l.user_id = $2 OR EXISTS (
        SELECT 1 FROM users lu WHERE lu.id = l.user_id AND lu.org_id = u.org_id AND u.org_id IS NOT NULL
      ))`, [req.params.leadId, req.userId]);
    if (!leadResult.rows.length) return res.status(404).json({ error: 'Lead not found' });
    const lead = leadResult.rows[0];
    const playbookResult = await pool.query('SELECT * FROM playbooks WHERE lead_id=$1', [lead.id]);
    const playbook = playbookResult.rows[0];
    const token = await getZohoToken(req.userId);
    const headers = { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' };

    let contactId = lead.zoho_contact_id;
    if (!contactId && lead.email) {
      try {
        const search = await axios.get(`https://www.zohoapis.com/crm/v2/Contacts/search?email=${encodeURIComponent(lead.email)}`, { headers });
        if (search.data?.data?.length) contactId = search.data.data[0].id;
      } catch (e) {}
    }

    const nameParts = (lead.full_name || '').split(' ');
    const contactData = {
      First_Name: nameParts[0] || '',
      Last_Name: nameParts.slice(1).join(' ') || nameParts[0] || 'Unknown',
      Email: lead.email || '',
      Title: lead.title || '',
      Account_Name: lead.company || '',
    };

    if (contactId) {
      await axios.put(`https://www.zohoapis.com/crm/v2/Contacts/${contactId}`, { data: [contactData] }, { headers });
    } else {
      const createRes = await axios.post('https://www.zohoapis.com/crm/v2/Contacts', { data: [contactData] }, { headers });
      contactId = createRes.data?.data?.[0]?.details?.id;
      if (contactId) await pool.query('UPDATE leads SET zoho_contact_id=$1 WHERE id=$2', [contactId, lead.id]);
    }

    if (playbook && contactId) {
      const noteContent = `=== PROSPECTFORGE PLAYBOOK ===\nGenerated: ${new Date(playbook.generated_at).toLocaleDateString()}\n\n--- RESEARCH BRIEF ---\n${playbook.research || ''}\n\n--- EMAIL 1 (Day 1) ---\n${playbook.email1 || ''}\n\n--- EMAIL 2 (Day 3) ---\n${playbook.email2 || ''}\n\n--- EMAIL 3 (Day 7) ---\n${playbook.email3 || ''}\n\n--- EMAIL 4 (Day 14) ---\n${playbook.email4 || ''}\n\n--- LINKEDIN ---\n${playbook.linkedin || ''}\n\n--- CALL OPENER ---\n${playbook.call_opener || ''}\n\n--- OBJECTION HANDLING ---\n${playbook.objection_handling || ''}\n\n--- CALLBACKS ---\n${playbook.callbacks || ''}`.trim();
      await axios.post('https://www.zohoapis.com/crm/v2/Notes', {
        data: [{ Note_Title: `ProspectForge Playbook - ${new Date().toLocaleDateString()}`, Note_Content: noteContent, Parent_Id: contactId, $se_module: 'Contacts' }]
      }, { headers });
    }
    res.json({ success: true, contactId, message: `Pushed to Zoho${playbook ? ' with playbook note' : ''}` });
  } catch (err) {
    console.error('Zoho push error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// Send email via Zoho CRM (with open/click tracking)
router.post('/send-email/:leadId', auth, async (req, res) => {
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

    const token = await getZohoToken(req.userId);
    const headers = { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' };

    // Ensure contact exists in Zoho first
    let contactId = lead.zoho_contact_id;
    if (!contactId) {
      const nameParts = (lead.full_name || '').split(' ');
      const createRes = await axios.post('https://www.zohoapis.com/crm/v2/Contacts', {
        data: [{
          First_Name: nameParts[0] || '',
          Last_Name: nameParts.slice(1).join(' ') || nameParts[0] || 'Unknown',
          Email: lead.email,
          Title: lead.title || '',
          Account_Name: lead.company || '',
        }]
      }, { headers });
      contactId = createRes.data?.data?.[0]?.details?.id;
      if (contactId) await pool.query('UPDATE leads SET zoho_contact_id=$1 WHERE id=$2', [contactId, lead.id]);
    }

    if (!contactId) return res.status(400).json({ error: 'Could not find or create Zoho contact' });

    // Inject tracking pixel for open tracking
    const appUrl = process.env.APP_URL || 'https://prospectforge-production-1f99.up.railway.app';
    const trackingPixel = `\n\n<img src="${appUrl}/api/tracking/open/${lead.id}/${req.body.touchpoint || 'email'}" width="1" height="1" style="display:none" />`;
    const htmlBody = body.replace(/\n/g, '<br>') + trackingPixel;

    // Send via Zoho CRM email (tracks opens and clicks)
    await axios.post(`https://www.zohoapis.com/crm/v2/Contacts/${contactId}/actions/send_mail`, {
      data: [{
        from: { user_name: null, email: null },
        to: [{ user_name: lead.full_name || '', email: lead.email }],
        subject,
        content: htmlBody,
        mail_format: 'html',
        org_email: false,
      }]
    }, { headers });

    // Mark touchpoint as done in sequence tracker
    if (touchpoint) {
      await pool.query(`
        INSERT INTO sequence_events (lead_id, user_id, touchpoint, status, notes, completed_at)
        VALUES ($1,$2,$3,'done',$4,NOW())
        ON CONFLICT (lead_id, touchpoint) DO UPDATE SET status='done', notes=$4, completed_at=NOW()
      `, [lead.id, req.userId, touchpoint, `Sent via Zoho CRM to ${lead.email}`]);
    }

    res.json({ success: true, message: `Email sent to ${lead.email} via Zoho CRM with tracking` });
  } catch (err) {
    console.error('Zoho send error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

router.get('/connect', auth, async (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.userId })).toString('base64');
  const scope = 'ZohoCRM.modules.contacts.ALL,ZohoCRM.modules.notes.ALL,ZohoCRM.send_mail.CREATE';
  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?scope=${scope}&client_id=${ZOHO_CLIENT_ID}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;
  res.json({ url: authUrl });
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect('/team?zoho=error&reason=no_code');
  try {
    let userId;
    if (state) { try { userId = JSON.parse(Buffer.from(state, 'base64').toString()).userId; } catch (e) {} }
    const tokenRes = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: { code, client_id: ZOHO_CLIENT_ID, client_secret: ZOHO_CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }
    });
    const { refresh_token } = tokenRes.data;
    if (!refresh_token) return res.redirect('/team?zoho=error&reason=no_refresh_token');
    if (userId) {
      await pool.query('UPDATE company_profiles SET zoho_refresh_token=$1 WHERE user_id=$2', [refresh_token, userId]);
    } else {
      await pool.query('UPDATE company_profiles SET zoho_refresh_token=$1', [refresh_token]);
    }
    res.redirect('/team?zoho=connected');
  } catch (err) {
    console.error('Zoho callback error:', err.response?.data || err.message);
    res.redirect('/team?zoho=error');
  }
});

router.get('/status', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cp.zoho_refresh_token FROM company_profiles cp
      JOIN users u ON (cp.user_id = u.id OR cp.org_id = u.org_id)
      WHERE u.id = $1 AND cp.zoho_refresh_token IS NOT NULL LIMIT 1
    `, [req.userId]);
    res.json({ connected: !!result.rows[0]?.zoho_refresh_token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/disconnect', auth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userResult.rows[0]?.org_id;
    await pool.query(
      `UPDATE company_profiles SET zoho_refresh_token=NULL WHERE user_id=$1 OR org_id=$2`,
      [req.userId, orgId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

