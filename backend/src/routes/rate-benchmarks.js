const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Market data: GSA Schedule rates by category, level, and region
const MARKET_RATES = {
  'Project Manager': {
    Junior: { 'DC': 85, 'Remote': 80, 'Other': 75 },
    Mid: { 'DC': 125, 'Remote': 120, 'Other': 110 },
    Senior: { 'DC': 165, 'Remote': 155, 'Other': 145 },
  },
  'Software Engineer': {
    Junior: { 'DC': 95, 'Remote': 90, 'Other': 85 },
    Mid: { 'DC': 140, 'Remote': 135, 'Other': 125 },
    Senior: { 'DC': 185, 'Remote': 175, 'Other': 160 },
  },
  'Systems Administrator': {
    Junior: { 'DC': 75, 'Remote': 70, 'Other': 65 },
    Mid: { 'DC': 110, 'Remote': 105, 'Other': 95 },
    Senior: { 'DC': 145, 'Remote': 135, 'Other': 125 },
  },
  'Business Analyst': {
    Junior: { 'DC': 80, 'Remote': 75, 'Other': 70 },
    Mid: { 'DC': 120, 'Remote': 115, 'Other': 105 },
    Senior: { 'DC': 160, 'Remote': 150, 'Other': 140 },
  },
  'Cybersecurity Analyst': {
    Junior: { 'DC': 105, 'Remote': 100, 'Other': 95 },
    Mid: { 'DC': 155, 'Remote': 150, 'Other': 140 },
    Senior: { 'DC': 210, 'Remote': 200, 'Other': 185 },
  },
  'Data Scientist': {
    Junior: { 'DC': 110, 'Remote': 105, 'Other': 100 },
    Mid: { 'DC': 160, 'Remote': 155, 'Other': 145 },
    Senior: { 'DC': 220, 'Remote': 210, 'Other': 195 },
  },
  'Help Desk': {
    Junior: { 'DC': 45, 'Remote': 42, 'Other': 40 },
    Mid: { 'DC': 65, 'Remote': 62, 'Other': 58 },
    Senior: { 'DC': 85, 'Remote': 80, 'Other': 75 },
  },
  'Network Engineer': {
    Junior: { 'DC': 90, 'Remote': 85, 'Other': 80 },
    Mid: { 'DC': 135, 'Remote': 130, 'Other': 120 },
    Senior: { 'DC': 180, 'Remote': 170, 'Other': 155 },
  },
  'Cloud Architect': {
    Junior: { 'DC': 115, 'Remote': 110, 'Other': 105 },
    Mid: { 'DC': 170, 'Remote': 165, 'Other': 155 },
    Senior: { 'DC': 230, 'Remote': 220, 'Other': 205 },
  },
  'DevOps Engineer': {
    Junior: { 'DC': 105, 'Remote': 100, 'Other': 95 },
    Mid: { 'DC': 155, 'Remote': 150, 'Other': 140 },
    Senior: { 'DC': 210, 'Remote': 200, 'Other': 185 },
  },
};

// List saved benchmarks for org
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const r = await pool.query(
      'SELECT * FROM rate_benchmarks WHERE org_id=$1 ORDER BY category ASC, experience_level DESC, region ASC',
      [orgId]
    );
    res.json({ benchmarks: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save a rate benchmark entry
router.post('/', auth, async (req, res) => {
  try {
    const { category, rate, region, experience_level, source } = req.body;
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const r = await pool.query(
      `INSERT INTO rate_benchmarks (org_id, category, rate, region, experience_level, source)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [orgId, category, rate, region, experience_level, source]
    );
    res.status(201).json({ benchmark: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get market average rates by labor category
router.get('/market-data', auth, async (req, res) => {
  try {
    // Transform market data into API response
    const marketData = Object.entries(MARKET_RATES).map(([category, levels]) => {
      const rates = [];
      Object.entries(levels).forEach(([level, regions]) => {
        Object.entries(regions).forEach(([region, rate]) => {
          rates.push({ level, region, rate });
        });
      });
      return { category, rates };
    });
    res.json({ marketData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Compare org's rates vs market
router.get('/compare', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const benchmarksR = await pool.query(
      'SELECT * FROM rate_benchmarks WHERE org_id=$1',
      [orgId]
    );
    const benchmarks = benchmarksR.rows;

    // Build comparison results
    const comparisons = [];
    const categories = Object.keys(MARKET_RATES);

    for (const category of categories) {
      const orgRates = benchmarks.filter(b => b.category === category);

      if (orgRates.length > 0) {
        for (const orgRate of orgRates) {
          const marketRate = MARKET_RATES[category]?.[orgRate.experience_level]?.[orgRate.region];
          if (marketRate) {
            const delta = orgRate.rate - marketRate;
            const status = delta > 5 ? 'above' : delta < -5 ? 'below' : 'competitive';
            comparisons.push({
              category,
              level: orgRate.experience_level,
              region: orgRate.region,
              orgRate: parseFloat(orgRate.rate),
              marketRate,
              delta,
              status,
            });
          }
        }
      }
    }

    res.json({ comparisons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
