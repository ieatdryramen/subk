const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const axios = require('axios');

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || '1000.996Z1F3EGG6QI23O3DBDEHMXA8142U';
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || '2edd338a68ae0fb399dddd0289a61aafd03a04e453';
const REDIRECT_URI = 'https://prospectforge-production-1f99.up.railway.app/api/zoho/callback';

const getZohoToken = async (userId) => {
  // Get refresh token from user's org profile or their own profile
  const result = await pool.query(`
    SELECT cp.zoho_refresh_token FROM company_profiles cp
    JOIN users u ON (cp.user_id = u.id OR cp.org_id = u.org_id)
    WHERE u.id = $1 AND cp.zoho_refresh_token IS NOT NULL
    LIMIT 1
  `, [userId]);
  
  const refreshToken = result.rows[0]?.zoho_refresh_token;
  if (!refreshToken) throw new Error('Zoho not connected. Go to Team & Integrations to connect.');

  const res = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
    params: {
      refresh_token: refreshToken,
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }
  });
  if (!res.data.access_token) throw new Error('Failed to refresh Zoho token. Reconnect in Team & Integrations.');
  return res.data.access_token;
};

router.post('/push/:leadId', auth, async (req, res) => {
  try {
    // Find lead - check user's own leads OR leads in their org
    const leadResult = await pool.query(`
      SELECT l.* FROM leads l
      JOIN users u ON u.id = $2
      WHERE l.id = $1 AND (
        l.user_id = $2 OR
        EXISTS (
          SELECT 1 FROM users lu WHERE lu.id = l.user_id AND lu.org_id = u.org_id AND u.org_id IS NOT NULL
        )
      )
    `, [req.params.leadId, req.userId]);

    if (!leadResult.rows.length) return res.status(404).json({ error: 'Lead not found or access denied' });
    const lead = leadResult.rows[0];

    const playbookResult = await pool.query('SELECT * FROM playbooks WHERE lead_id=$1', [lead.id]);
    const playbook = playbookResult.rows[0];

    const token = await getZohoToken(req.userId);
    const headers = { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' };

    let contactId = lead.zoho_contact_id;

    if (!contactId && lead.email) {
      try {
        const search = await axios.get(
          `https://www.zohoapis.com/crm/v2/Contacts/search?email=${encodeURIComponent(lead.email)}`,
          { headers }
        );
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
      await axios.put(`https://www.zohoapis.com/crm/v2/Contacts/${contactId}`,
        { data: [contactData] }, { headers });
    } else {
      const createRes = await axios.post('https://www.zohoapis.com/crm/v2/Contacts',
        { data: [contactData] }, { headers });
      contactId = createRes.data?.data?.[0]?.details?.id;
      if (contactId) {
        await pool.query('UPDATE leads SET zoho_contact_id=$1 WHERE id=$2', [contactId, lead.id]);
      }
    }

    if (playbook && contactId) {
      const noteContent = `=== PROSPECTFORGE PLAYBOOK ===
Generated: ${new Date(playbook.generated_at).toLocaleDateString()}

--- RESEARCH BRIEF ---
${playbook.research || ''}

--- EMAIL 1 (Day 1) ---
${playbook.email1 || ''}

--- EMAIL 2 (Day 3) ---
${playbook.email2 || ''}

--- EMAIL 3 (Day 7) ---
${playbook.email3 || ''}

--- EMAIL 4 (Day 14) ---
${playbook.email4 || ''}

--- LINKEDIN ---
${playbook.linkedin || ''}

--- CALL OPENER ---
${playbook.call_opener || ''}

--- OBJECTION HANDLING ---
${playbook.objection_handling || ''}

--- CALLBACKS ---
${playbook.callbacks || ''}`.trim();

      await axios.post('https://www.zohoapis.com/crm/v2/Notes', {
        data: [{
          Note_Title: `ProspectForge Playbook - ${new Date().toLocaleDateString()}`,
          Note_Content: noteContent,
          Parent_Id: contactId,
          $se_module: 'Contacts',
        }]
      }, { headers });
    }

    res.json({ success: true, contactId, message: `Pushed to Zoho${playbook ? ' with playbook note' : ''}` });
  } catch (err) {
    console.error('Zoho push error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/connect', auth, async (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.userId })).toString('base64');
  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?scope=ZohoCRM.modules.contacts.ALL,ZohoCRM.modules.notes.ALL&client_id=${ZOHO_CLIENT_ID}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;
  res.json({ url: authUrl });
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect('/team?zoho=error&reason=no_code');
  try {
    let userId;
    if (state) {
      try { userId = JSON.parse(Buffer.from(state, 'base64').toString()).userId; } catch (e) {}
    }
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
      WHERE u.id = $1 AND cp.zoho_refresh_token IS NOT NULL
      LIMIT 1
    `, [req.userId]);
    res.json({ connected: !!result.rows[0]?.zoho_refresh_token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
