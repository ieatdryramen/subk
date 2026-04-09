const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const usaspending = require('../services/usaspending');

/**
 * GET /api/awards/search
 * Search awards by keyword, agency, NAICS, PSC, date range, amount
 */
router.get('/search', auth, async (req, res) => {
  try {
    const {
      keyword,
      agency,
      naics,
      psc,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      page = 1,
      limit = 25,
    } = req.query;

    // Fetch user's org_id for caching reference
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const dateRange = {};
    if (startDate) dateRange.start = startDate;
    if (endDate) dateRange.end = endDate;

    const results = await usaspending.searchAwards({
      keyword,
      agency,
      naics,
      psc,
      dateRange: Object.keys(dateRange).length > 0 ? dateRange : undefined,
      minAmount: minAmount ? parseInt(minAmount) : undefined,
      maxAmount: maxAmount ? parseInt(maxAmount) : undefined,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    // Cache in DB for future reference
    if (orgId && results.results.length > 0) {
      const cacheKey = `awards_${keyword || ''}_${agency || ''}_${naics || ''}_${psc || ''}_${page}_${limit}`;
      await pool.query(
        `INSERT INTO spending_cache (cache_key, data)
         VALUES ($1, $2)
         ON CONFLICT (cache_key) DO UPDATE SET
         data = $2, fetched_at = NOW(), expires_at = NOW() + INTERVAL '24 hours'`,
        [cacheKey, JSON.stringify(results)]
      ).catch(() => {});
    }

    res.json({
      success: true,
      data: results,
    });
  } catch (err) {
    console.error('GET /awards/search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/awards/contractor/:name
 * Search awards by contractor name
 */
router.get('/contractor/:name', auth, async (req, res) => {
  try {
    const { name } = req.params;
    const { page = 1, limit = 25 } = req.query;

    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Contractor name must be at least 2 characters' });
    }

    const results = await usaspending.searchAwards({
      keyword: name,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (err) {
    console.error('GET /awards/contractor/:name error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/awards/incumbent/:opportunityId
 * Look up incumbent contractor for an opportunity
 */
router.get('/incumbent/:opportunityId', auth, async (req, res) => {
  try {
    const { opportunityId } = req.params;

    // Get opportunity details
    const oppR = await pool.query(
      'SELECT agency, naics_code FROM opportunities WHERE id=$1',
      [opportunityId]
    );

    if (oppR.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const { agency, naics_code } = oppR.rows[0];

    // Search for recent awards in same agency + NAICS to identify incumbent
    const results = await usaspending.searchAwards({
      agency,
      naics,
      page: 1,
      limit: 10,
    });

    // Return most likely incumbent (first award in category)
    const incumbent = results.results.length > 0
      ? {
          contractor: results.results[0].recipient_name || 'Unknown',
          award: results.results[0],
          confidence: 'medium',
        }
      : null;

    res.json({
      success: true,
      data: {
        opportunity_id: opportunityId,
        incumbent,
      },
    });
  } catch (err) {
    console.error('GET /awards/incumbent/:opportunityId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
