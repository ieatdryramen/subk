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
    contract_min, contract_max, set_aside_prefs, state, is_public, tagline
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
         is_public=$14, tagline=$15, updated_at=NOW()
         WHERE user_id=$16 RETURNING *`,
        [company_name, website_url, naics_codes, cage_code, uei, certifications, past_performance,
         capabilities, target_agencies, contract_min, contract_max, set_aside_prefs, state,
         is_public || false, tagline || '', req.userId]
      );
    } else {
      result = await pool.query(
        `INSERT INTO sub_profiles (user_id, org_id, company_name, website_url, naics_codes, cage_code, uei,
         certifications, past_performance, capabilities, target_agencies, contract_min, contract_max, set_aside_prefs, state,
         is_public, tagline)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
        [req.userId, org_id, company_name, website_url, naics_codes, cage_code, uei, certifications,
         past_performance, capabilities, target_agencies, contract_min, contract_max, set_aside_prefs, state,
         is_public || false, tagline || '']
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
