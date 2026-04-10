const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const usaspending = require('../services/usaspending');

/**
 * GET /api/spending/by-agency
 * Get spending by agency for a fiscal year
 */
router.get('/by-agency', auth, async (req, res) => {
  try {
    const { fiscalYear, limit = 20 } = req.query;
    const fy = parseInt(fiscalYear) || new Date().getFullYear();

    const raw = await usaspending.getSpendingByAgency({
      fiscalYear: fy,
      limit: parseInt(limit),
    });

    // Normalize field names for frontend consumption
    let results = (raw.results || []).map(r => ({
      name: r.name || r.agency_name || r.description || 'Unknown',
      amount: parseFloat(r.aggregated_amount || r.total_obligations || r.amount || 0),
      count: parseInt(r.transaction_count || r.count || 0),
    }));

    // If external API returned empty, try to derive from local opportunities data
    if (results.length === 0) {
      try {
        const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
        const orgId = userR.rows[0]?.org_id;
        const oppR = await pool.query(
          `SELECT agency, COUNT(*) as count, COALESCE(SUM(value_max), 0) as total
           FROM opportunities WHERE org_id=$1 AND agency IS NOT NULL
           GROUP BY agency ORDER BY total DESC LIMIT 20`,
          [orgId]
        );
        results = (oppR.rows || []).map(r => ({
          name: r.agency || 'Unknown',
          amount: parseFloat(r.total) || 0,
          count: parseInt(r.count) || 0,
        }));
      } catch (e) {
        console.warn('Fallback agency query failed:', e.message);
      }
    }

    res.json({
      success: true,
      agencies: results,
      total: raw.total || results.length,
    });
  } catch (err) {
    console.error('GET /spending/by-agency error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/spending/by-naics
 * Get spending by NAICS code
 */
router.get('/by-naics', auth, async (req, res) => {
  try {
    const { fiscalYear, naics, limit = 20 } = req.query;
    const fy = parseInt(fiscalYear) || new Date().getFullYear();

    const raw = await usaspending.getSpendingByNaics({
      fiscalYear: fy,
      naics: naics || null,
      limit: parseInt(limit),
    });

    // Normalize field names for frontend consumption
    let results = (raw.results || []).map(r => ({
      code: r.code || r.naics_code || '',
      name: r.name || r.description || 'Unknown',
      amount: parseFloat(r.aggregated_amount || r.total_obligations || r.amount || 0),
      count: parseInt(r.transaction_count || r.count || 0),
    }));

    // If external API returned empty, try to derive from local opportunities data
    if (results.length === 0) {
      try {
        const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
        const orgId = userR.rows[0]?.org_id;
        const oppR = await pool.query(
          `SELECT naics_code, COUNT(*) as count, COALESCE(SUM(value_max), 0) as total
           FROM opportunities WHERE org_id=$1 AND naics_code IS NOT NULL AND naics_code != ''
           GROUP BY naics_code ORDER BY total DESC LIMIT 20`,
          [orgId]
        );
        results = (oppR.rows || []).map(r => ({
          code: r.naics_code || '',
          name: r.naics_code || 'Unknown',
          amount: parseFloat(r.total) || 0,
          count: parseInt(r.count) || 0,
        }));
      } catch (e) {
        console.warn('Fallback NAICS query failed:', e.message);
      }
    }

    res.json({
      success: true,
      naics: results,
      total: raw.total || results.length,
    });
  } catch (err) {
    console.error('GET /spending/by-naics error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/spending/trends
 * Get spending trends across multiple fiscal years
 */
router.get('/trends', auth, async (req, res) => {
  try {
    const { agency, naics, years = 5 } = req.query;

    const results = await usaspending.getSpendingTrends({
      agency,
      naics,
      years: parseInt(years),
    });

    // Normalize — trends is already an array of { year, amount } from the service
    res.json({
      success: true,
      trends: Array.isArray(results) ? results : [],
    });
  } catch (err) {
    console.error('GET /spending/trends error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/spending/refresh
 * Force refresh cached spending data (clears in-memory cache)
 */
router.get('/refresh', auth, async (req, res) => {
  try {
    usaspending.cacheManager.clear();

    res.json({
      success: true,
      message: 'Cache cleared, next requests will fetch fresh data',
    });
  } catch (err) {
    console.error('GET /spending/refresh error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
