const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

router.get('/', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM sub_profiles WHERE user_id=$1', [req.userId]);
    res.json(r.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  const {
    company_name, website_url, naics_codes, cage_code, uei,
    certifications, past_performance, capabilities, target_agencies,
    contract_min, contract_max, set_aside_prefs, state, is_public, tagline,
    company_description, founded_year, employee_count, annual_revenue, phone, email,
    differentiators, key_personnel
  } = req.body;

  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const org_id = userR.rows[0]?.org_id;
    const exists = await pool.query('SELECT id FROM sub_profiles WHERE user_id=$1', [req.userId]);

    let result;
    if (exists.rows.length) {
      result = await pool.query(
        `UPDATE sub_profiles SET company_name=$1, website_url=$2, naics_codes=$3, cage_code=$4, uei=$5,
         certifications=$6, past_performance=$7, capabilities=$8, target_agencies=$9,
         contract_min=$10, contract_max=$11, set_aside_prefs=$12, state=$13,
         is_public=$14, tagline=$15, company_description=$16, founded_year=$17, employee_count=$18,
         annual_revenue=$19, phone=$20, email=$21, differentiators=$22, key_personnel=$23,
         updated_at=NOW()
         WHERE user_id=$24 RETURNING *`,
        [company_name, website_url, naics_codes, cage_code, uei, certifications, past_performance,
         capabilities, target_agencies, contract_min, contract_max, set_aside_prefs, state,
         is_public || false, tagline || '', company_description || '', founded_year || null,
         employee_count || '', annual_revenue || '', phone || '', email || '', differentiators || '',
         JSON.stringify(key_personnel || []), req.userId]
      );
    } else {
      result = await pool.query(
        `INSERT INTO sub_profiles (user_id, org_id, company_name, website_url, naics_codes, cage_code, uei,
         certifications, past_performance, capabilities, target_agencies, contract_min, contract_max, set_aside_prefs, state,
         is_public, tagline, company_description, founded_year, employee_count, annual_revenue, phone, email,
         differentiators, key_personnel)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING *`,
        [req.userId, org_id, company_name, website_url, naics_codes, cage_code, uei, certifications,
         past_performance, capabilities, target_agencies, contract_min, contract_max, set_aside_prefs, state,
         is_public || false, tagline || '', company_description || '', founded_year || null,
         employee_count || '', annual_revenue || '', phone || '', email || '', differentiators || '',
         JSON.stringify(key_personnel || [])]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// POST /profile/parse-capstatement — upload PDF cap statement, extract profile fields
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/parse-capstatement', auth, async (req, res) => {
  const { pdf_base64, filename } = req.body;
  if (!pdf_base64) return res.status(400).json({ error: 'No PDF data provided' });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 }
          },
          {
            type: 'text',
            text: `Extract the following information from this capability statement and return ONLY a JSON object with these exact keys. If a field is not found, use empty string or empty array.

{
  "company_name": "full legal company name",
  "cage_code": "5-character CAGE code if present",
  "uei": "12-character UEI if present",
  "naics_codes": "comma-separated NAICS codes e.g. '541512, 541511'",
  "certifications": "comma-separated certs from: Small Business, 8(a), HUBZone, SDVOSB, VOSB, WOSB, EDWOSB, SDB",
  "capabilities": "paragraph describing core technical capabilities and services",
  "past_performance": "key past performance highlights, agency names, contract types",
  "target_agencies": "comma-separated agency names e.g. 'DoD, DHS, VA'",
  "website_url": "company website URL if present",
  "state": "two-letter state abbreviation of company headquarters",
  "contract_min": 0,
  "contract_max": 0
}

For contract_min and contract_max: look for contract size range or typical contract values. Use 0 if not found. Return integers in dollars.
Return ONLY the JSON object, no other text.`
          }
        ]
      }]
    });

    const text = response.content[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const extracted = JSON.parse(clean);

    res.json({ success: true, extracted });
  } catch (err) {
    console.error('Cap statement parse error:', err.message);
    res.status(500).json({ error: 'Failed to parse capability statement: ' + err.message });
  }
});

// POST /profile/lookup-uei — auto-populate from SAM.gov + USASpending
const { lookupByUEI } = require('../services/govdata');

router.post('/lookup-uei', auth, async (req, res) => {
  const { uei } = req.body;
  if (!uei?.trim()) return res.status(400).json({ error: 'UEI required' });

  try {
    // Check cache first
    const cached = await pool.query('SELECT data, cached_at FROM uei_cache WHERE uei=$1', [uei.trim()]);
    if (cached.rows.length) {
      const age = (Date.now() - new Date(cached.rows[0].cached_at)) / (1000 * 60 * 60 * 24);
      if (age < 7) return res.json({ ...cached.rows[0].data, fromCache: true });
    }

    const data = await lookupByUEI(uei.trim());

    // Cache it
    await pool.query(
      'INSERT INTO uei_cache (uei, data) VALUES ($1,$2) ON CONFLICT (uei) DO UPDATE SET data=$2, cached_at=NOW()',
      [uei.trim(), JSON.stringify(data)]
    );

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /profile/past-performance — get structured past performance records
router.get('/past-performance', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM past_performance WHERE user_id=$1 ORDER BY period_start DESC NULLS LAST, created_at DESC',
      [req.userId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /profile/past-performance — add a record
router.post('/past-performance', auth, async (req, res) => {
  const { contract_number, contract_title, agency, prime_or_sub, award_amount, period_start, period_end, naics_code, set_aside, description, relevance_tags } = req.body;
  try {
    const r = await pool.query(
      `INSERT INTO past_performance (user_id, contract_number, contract_title, agency, prime_or_sub, award_amount, period_start, period_end, naics_code, set_aside, description, relevance_tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.userId, contract_number, contract_title, agency, prime_or_sub || 'prime', award_amount, period_start, period_end, naics_code, set_aside, description, relevance_tags]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /profile/past-performance/:id
router.put('/past-performance/:id', auth, async (req, res) => {
  const { contract_number, contract_title, agency, prime_or_sub, award_amount, period_start, period_end, naics_code, set_aside, description, relevance_tags } = req.body;
  try {
    const r = await pool.query(
      `UPDATE past_performance SET contract_number=$1, contract_title=$2, agency=$3, prime_or_sub=$4, award_amount=$5, period_start=$6, period_end=$7, naics_code=$8, set_aside=$9, description=$10, relevance_tags=$11
       WHERE id=$12 AND user_id=$13 RETURNING *`,
      [contract_number, contract_title, agency, prime_or_sub, award_amount, period_start, period_end, naics_code, set_aside, description, relevance_tags, req.params.id, req.userId]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /profile/past-performance/:id
router.delete('/past-performance/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM past_performance WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /profile/import-awards — import USASpending awards as past performance records
router.post('/import-awards', auth, async (req, res) => {
  const { awards } = req.body;
  if (!awards?.length) return res.status(400).json({ error: 'No awards to import' });
  try {
    let imported = 0;
    for (const a of awards) {
      await pool.query(
        `INSERT INTO past_performance (user_id, contract_number, contract_title, agency, prime_or_sub, award_amount, period_start, period_end, naics_code, description)
         VALUES ($1,$2,$3,$4,'prime',$5,$6,$7,$8,$9)
         ON CONFLICT DO NOTHING`,
        [req.userId, a.awardId, a.description || a.awardId, a.agency, a.amount, a.startDate, a.endDate, a.naicsCode, a.description]
      ).catch(() => {});
      imported++;
    }
    res.json({ success: true, imported });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /profile/generate-capstmt — generate HTML capability statement from profile
router.post('/generate-capstmt', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM sub_profiles WHERE user_id=$1', [req.userId]);
    const profile = r.rows[0];
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const ppR = await pool.query(
      'SELECT * FROM past_performance WHERE user_id=$1 ORDER BY period_start DESC NULLS LAST, created_at DESC LIMIT 10',
      [req.userId]
    );
    const pastPerf = ppR.rows;

    let keyPersonnel = [];
    try {
      keyPersonnel = JSON.parse(profile.key_personnel || '[]');
    } catch (e) {
      keyPersonnel = [];
    }

    const certsList = profile.certifications ? profile.certifications.split(',').map(c => c.trim()).filter(Boolean) : [];
    const naicsList = profile.naics_codes ? profile.naics_codes.split(',').map(c => c.trim()).filter(Boolean) : [];

    const ppHtml = pastPerf.map(pp => `
      <div style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-left: 4px solid #14b8a6;">
        <div style="font-weight: bold; margin-bottom: 5px;">${pp.contract_title || pp.contract_number || 'Untitled Contract'}</div>
        <div style="font-size: 0.9em; color: #555; margin-bottom: 8px;">
          <strong>Agency:</strong> ${pp.agency || 'N/A'}
          ${pp.award_amount ? `| <strong>Value:</strong> $${(pp.award_amount / 1e6).toFixed(2)}M` : ''}
          <br/>
          <strong>Period:</strong> ${pp.period_start ? pp.period_start.split('T')[0] : 'N/A'}
          ${pp.period_end ? `– ${pp.period_end.split('T')[0]}` : ''}
          | <strong>Role:</strong> ${pp.prime_or_sub === 'prime' ? 'Prime Contractor' : 'Subcontractor'}
        </div>
        ${pp.description ? `<div style="font-size: 0.95em; line-height: 1.5;">${pp.description}</div>` : ''}
      </div>
    `).join('');

    const kpHtml = keyPersonnel.map(kp => `
      <div style="margin-bottom: 15px;">
        <div style="font-weight: bold; color: #333;">${kp.name || 'Unknown'}</div>
        <div style="font-size: 0.9em; color: #666; margin-bottom: 4px;">
          <strong>Title:</strong> ${kp.title || 'N/A'}
          ${kp.clearance ? `| <strong>Clearance:</strong> ${kp.clearance}` : ''}
        </div>
        ${kp.bio ? `<div style="font-size: 0.9em; color: #555; line-height: 1.4;">${kp.bio}</div>` : ''}
      </div>
    `).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Capability Statement - ${profile.company_name || 'Company'}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0; padding: 30px; background-color: #fff; }
    .header { border-bottom: 3px solid #14b8a6; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 2em; font-weight: bold; color: #1a1a1a; margin-bottom: 5px; }
    .tagline { font-size: 1.1em; color: #14b8a6; font-weight: 500; margin-bottom: 10px; }
    .contact-info { font-size: 0.9em; color: #666; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 1.3em; font-weight: bold; color: #14b8a6; border-bottom: 2px solid #14b8a6; padding-bottom: 10px; margin-bottom: 15px; }
    .section-content { line-height: 1.7; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .tag { display: inline-block; padding: 6px 12px; background-color: #e8f5f4; color: #14b8a6; border-radius: 20px; font-size: 0.9em; border: 1px solid #14b8a6; }
    .certifications { background-color: #f0fffe; padding: 15px; border-radius: 5px; }
    .cert-badge { display: inline-block; padding: 8px 14px; background-color: #14b8a6; color: white; border-radius: 5px; margin-right: 8px; margin-bottom: 8px; font-size: 0.9em; font-weight: 500; }
    .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 600px) { .two-column { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">${profile.company_name || 'Company Name'}</div>
    ${profile.tagline ? `<div class="tagline">${profile.tagline}</div>` : ''}
    <div class="contact-info">
      ${profile.email ? `<strong>Email:</strong> ${profile.email}<br/>` : ''}
      ${profile.phone ? `<strong>Phone:</strong> ${profile.phone}<br/>` : ''}
      ${profile.website_url ? `<strong>Website:</strong> <a href="${profile.website_url}" style="color: #14b8a6; text-decoration: none;">${profile.website_url}</a><br/>` : ''}
      ${profile.location ? `<strong>Location:</strong> ${profile.location}` : ''}
    </div>
  </div>

  ${profile.company_description ? `
  <div class="section">
    <div class="section-title">Company Overview</div>
    <div class="section-content">
      <p>${profile.company_description}</p>
      <div style="color: #666; font-size: 0.95em;">
        ${profile.founded_year ? `<strong>Founded:</strong> ${profile.founded_year}<br/>` : ''}
        ${profile.employee_count ? `<strong>Employees:</strong> ${profile.employee_count}<br/>` : ''}
        ${profile.annual_revenue ? `<strong>Annual Revenue:</strong> ${profile.annual_revenue}` : ''}
      </div>
    </div>
  </div>
  ` : ''}

  ${profile.capabilities ? `
  <div class="section">
    <div class="section-title">Core Capabilities</div>
    <div class="section-content">
      <p>${profile.capabilities}</p>
    </div>
  </div>
  ` : ''}

  ${profile.differentiators ? `
  <div class="section">
    <div class="section-title">Differentiators & Value Proposition</div>
    <div class="section-content">
      <p>${profile.differentiators}</p>
    </div>
  </div>
  ` : ''}

  ${naicsList.length > 0 ? `
  <div class="section">
    <div class="section-title">NAICS Codes</div>
    <div class="tag-list">
      ${naicsList.map(n => `<div class="tag">${n}</div>`).join('')}
    </div>
  </div>
  ` : ''}

  ${certsList.length > 0 ? `
  <div class="section">
    <div class="section-title">Certifications & Set-Asides</div>
    <div class="certifications">
      ${certsList.map(c => `<div class="cert-badge">${c}</div>`).join('')}
    </div>
  </div>
  ` : ''}

  ${pastPerf.length > 0 ? `
  <div class="section">
    <div class="section-title">Past Performance</div>
    <div class="section-content">
      ${ppHtml}
    </div>
  </div>
  ` : ''}

  ${keyPersonnel.length > 0 ? `
  <div class="section">
    <div class="section-title">Key Personnel</div>
    <div class="section-content">
      ${kpHtml}
    </div>
  </div>
  ` : ''}

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.85em; color: #999;">
    <p>Generated on ${new Date().toLocaleDateString()} | Confidential</p>
  </div>
</body>
</html>
    `;

    res.json({ success: true, html });
  } catch (err) {
    console.error('Cap statement generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate capability statement: ' + err.message });
  }
});

// POST /profile/share — generate shareable link
router.post('/share', auth, async (req, res) => {
  try {
    const crypto = require('crypto');
    const token = crypto.randomUUID();

    const r = await pool.query(
      'UPDATE sub_profiles SET share_token=$1 WHERE user_id=$2 RETURNING *',
      [token, req.userId]
    );

    if (!r.rows.length) return res.status(404).json({ error: 'Profile not found' });

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sub-share/${token}`;
    res.json({ success: true, shareUrl, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
