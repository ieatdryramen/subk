const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const usaspending = require('../services/usaspending');

/**
 * GET /api/forecast
 * List forecast opportunities for organization
 */
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const r = await pool.query(
      'SELECT * FROM forecast_opportunities WHERE org_id=$1 ORDER BY created_at DESC',
      [orgId]
    );

    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('GET /forecast error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/forecast
 * Manually add a forecast opportunity
 */
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      agency,
      naics_code,
      estimated_value_min,
      estimated_value_max,
      estimated_timeline,
      source,
      source_url,
      description,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const result = await pool.query(
      `INSERT INTO forecast_opportunities
       (org_id, title, agency, naics_code, estimated_value_min, estimated_value_max, estimated_timeline, source, source_url, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'forecast')
       RETURNING *`,
      [orgId, title, agency, naics_code, estimated_value_min, estimated_value_max, estimated_timeline, source, source_url, description]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /forecast error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/forecast/scan
 * Scan USASpending budget data for upcoming opportunities
 */
router.post('/scan', auth, async (req, res) => {
  try {
    let { agencies = [], naicsCodes = [], fiscalYear } = req.body;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Auto-populate NAICS codes from company profile if not provided
    if (naicsCodes.length === 0) {
      try {
        const profR = await pool.query('SELECT naics_codes FROM sub_profiles WHERE org_id=$1 LIMIT 1', [orgId]);
        if (profR.rows.length && profR.rows[0].naics_codes) {
          naicsCodes = profR.rows[0].naics_codes.split(',').map(c => c.trim()).filter(Boolean);
        }
      } catch (e) { /* ignore */ }
    }

    const year = fiscalYear || new Date().getFullYear();
    const opportunities = [];

    // Scan by agency if provided
    if (agencies.length > 0) {
      for (const agency of agencies) {
        const results = await usaspending.getSpendingByAgency({
          fiscalYear: year,
          limit: 50,
        });

        if (results.results && results.results.length > 0) {
          for (const award of results.results) {
            opportunities.push({
              title: award.description || `Opportunity from ${agency}`,
              agency,
              estimated_value_min: award.federal_action_obligation ? Math.floor(award.federal_action_obligation * 0.8) : null,
              estimated_value_max: award.federal_action_obligation ? Math.ceil(award.federal_action_obligation * 1.2) : null,
              estimated_timeline: `FY ${year}`,
              source: 'USASpending',
              source_url: award.url || null,
              description: award.description || null,
            });
          }
        }
      }
    }

    // Scan by NAICS if provided
    if (naicsCodes.length > 0) {
      for (const naics of naicsCodes) {
        const results = await usaspending.getSpendingByNaics({
          fiscalYear: year,
          naics,
          limit: 50,
        });

        if (results.results && results.results.length > 0) {
          for (const award of results.results) {
            opportunities.push({
              title: award.description || `Opportunity in NAICS ${naics}`,
              agency: award.agency_name || null,
              naics_code: naics,
              estimated_value_min: award.federal_action_obligation ? Math.floor(award.federal_action_obligation * 0.8) : null,
              estimated_value_max: award.federal_action_obligation ? Math.ceil(award.federal_action_obligation * 1.2) : null,
              estimated_timeline: `FY ${year}`,
              source: 'USASpending',
              source_url: award.url || null,
              description: award.description || null,
            });
          }
        }
      }
    }

    // Insert opportunities into DB
    const inserted = [];
    for (const opp of opportunities) {
      try {
        const r = await pool.query(
          `INSERT INTO forecast_opportunities
           (org_id, title, agency, naics_code, estimated_value_min, estimated_value_max, estimated_timeline, source, source_url, description, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'forecast')
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [
            orgId,
            opp.title,
            opp.agency,
            opp.naics_code,
            opp.estimated_value_min,
            opp.estimated_value_max,
            opp.estimated_timeline,
            opp.source,
            opp.source_url,
            opp.description,
          ]
        );
        if (r.rows.length > 0) {
          inserted.push(r.rows[0]);
        }
      } catch (e) {
        console.error('Error inserting forecast opportunity:', e.message);
      }
    }

    res.json({
      success: true,
      message: `Scanned ${opportunities.length} opportunities, inserted ${inserted.length}`,
      data: inserted,
    });
  } catch (err) {
    console.error('POST /forecast/scan error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/forecast/:id
 * Update forecast opportunity
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, agency, naics_code, estimated_value_min, estimated_value_max, estimated_timeline, status, description } = req.body;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Verify ownership
    const checkR = await pool.query(
      'SELECT * FROM forecast_opportunities WHERE id=$1 AND org_id=$2',
      [req.params.id, orgId]
    );

    if (checkR.rows.length === 0) {
      return res.status(404).json({ error: 'Forecast opportunity not found' });
    }

    const current = checkR.rows[0];
    const result = await pool.query(
      `UPDATE forecast_opportunities
       SET title=$1, agency=$2, naics_code=$3, estimated_value_min=$4, estimated_value_max=$5, estimated_timeline=$6, status=$7, description=$8
       WHERE id=$9 AND org_id=$10
       RETURNING *`,
      [
        title !== undefined ? title : current.title,
        agency !== undefined ? agency : current.agency,
        naics_code !== undefined ? naics_code : current.naics_code,
        estimated_value_min !== undefined ? estimated_value_min : current.estimated_value_min,
        estimated_value_max !== undefined ? estimated_value_max : current.estimated_value_max,
        estimated_timeline !== undefined ? estimated_timeline : current.estimated_timeline,
        status !== undefined ? status : current.status,
        description !== undefined ? description : current.description,
        req.params.id,
        orgId,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT /forecast/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/forecast/:id
 * Remove forecast opportunity
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const result = await pool.query(
      'DELETE FROM forecast_opportunities WHERE id=$1 AND org_id=$2 RETURNING *',
      [req.params.id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Forecast opportunity not found' });
    }

    res.json({ success: true, message: 'Forecast opportunity deleted' });
  } catch (err) {
    console.error('DELETE /forecast/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/forecast/agency-budgets
 * Get agency budget trends
 */
router.get('/agency-budgets', auth, async (req, res) => {
  try {
    const { agencies } = req.query;

    // Default to top agencies if none specified
    const agencyList = agencies
      ? agencies.split(',').map(a => a.trim())
      : ['DOD', 'HHS', 'DHS', 'VA', 'GSA'];
    const budgets = {};

    for (const agency of agencyList) {
      try {
        const budget = await usaspending.getAgencyBudget({ agencyCode: agency });
        budgets[agency] = budget;
      } catch (err) {
        console.error(`Error fetching budget for ${agency}:`, err.message);
        budgets[agency] = { agency_code: agency, budgetary_resources: [] };
      }
    }

    res.json({ success: true, data: budgets });
  } catch (err) {
    console.error('GET /forecast/agency-budgets error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
