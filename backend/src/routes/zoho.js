const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const axios = require('axios');

const getZohoToken = async (profile) => {
  if (!profile.zoho_refresh_token) throw new Error('Zoho not connected');
  const res = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
    params: {
      refresh_token: profile.zoho_refresh_token,
      client_id: profile.zoho_client_id || process.env.ZOHO_CLIENT_ID,
      client_secret: profile.zoho_client_secret || process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }
  });
  return res.data.access_token;
};

// Push a lead + playbook to Zoho CRM
router.post('/push/:leadId', auth, async (req, res) => {
  try {
    const leadResult = await pool.query(
      'SELECT * FROM leads WHERE id=$1 AND user_id=$2', [req.params.leadId, req.userId]
    );
    if (!leadResult.rows.length) return res.status(404).json({ error: 'Lead not found' });
    const lead = leadResult.rows[0];

    const profileResult = await pool.query(
      'SELECT * FROM company_profiles WHERE user_id=$1', [req.userId]
    );
    if (!profileResult.rows.length) return res.status(400).json({ error: 'No company profile' });
    const profile = profileResult.rows[0];

    const playbookResult = await pool.query(
      'SELECT * FROM playbooks WHERE lead_id=$1', [lead.id]
    );
    const playbook = playbookResult.rows[0];

    const token = await getZohoToken(profile);
    const headers = { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' };

    // Check if contact exists
    let contactId = lead.zoho_contact_id;

    if (!contactId) {
      // Search for existing contact by email
      if (lead.email) {
        const search = await axios.get(
          `https://www.zohoapis.com/crm/v2/Contacts/search?email=${encodeURIComponent(lead.email)}`,
          { headers }
        );
        if (search.data?.data?.length) contactId = search.data.data[0].id;
      }
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

    // Add playbook as a note
    if (playbook && contactId) {
      const noteContent = `
=== PROSPECTFORGE PLAYBOOK ===
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
${playbook.callbacks || ''}
`.trim();

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
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// OAuth callback
router.get('/callback', auth, async (req, res) => {
  const { code } = req.query;
  try {
    const profileResult = await pool.query('SELECT * FROM company_profiles WHERE user_id=$1', [req.userId]);
    if (!profileResult.rows.length) return res.status(400).json({ error: 'No profile' });
    const profile = profileResult.rows[0];

    const tokenRes = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
      params: {
        code,
        client_id: profile.zoho_client_id || process.env.ZOHO_CLIENT_ID,
        client_secret: profile.zoho_client_secret || process.env.ZOHO_CLIENT_SECRET,
        redirect_uri: `${process.env.APP_URL || 'https://prospectforge-production-1f99.up.railway.app'}/api/zoho/callback`,
        grant_type: 'authorization_code',
      }
    });

    const { refresh_token } = tokenRes.data;
    await pool.query('UPDATE company_profiles SET zoho_refresh_token=$1 WHERE user_id=$2', [refresh_token, req.userId]);
    res.redirect('/?zoho=connected');
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.redirect('/?zoho=error');
  }
});

// Connect status
router.get('/status', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT zoho_refresh_token FROM company_profiles WHERE user_id=$1', [req.userId]);
    res.json({ connected: !!result.rows[0]?.zoho_refresh_token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
