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

    const results = await usaspending.getSpendingByAgency({
      fiscalYear: fy,
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: results,
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

    const results = await usaspending.getSpendingByNaics({
      fiscalYear: fy,
      naics: naics || null,
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: results,
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

    res.json({
      success: true,
      data: results,
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
