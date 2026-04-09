const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Search and match sub profiles for teaming
router.get('/', auth, async (req, res) => {
  try {
    const { naics, certifications, clearance, region } = req.query;

    // Get user's own org
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const userOrgId = userR.rows[0]?.org_id;

    // Build query
    let whereConditions = ['org_id != $1 AND is_public = true'];
    let paramIndex = 2;
    const params = [userOrgId];

    if (naics && naics.trim()) {
      const naicsArray = naics.split(',').map(n => n.trim());
      whereConditions.push(
        `(${naicsArray.map(() => `naics_codes ILIKE $${paramIndex++}`).join(' OR ')})`
      );
      naicsArray.forEach(n => params.push(`%${n}%`));
    }

    if (certifications && certifications.trim()) {
      const certArray = certifications.split(',').map(c => c.trim());
      whereConditions.push(
        `(${certArray.map(() => `certifications ILIKE $${paramIndex++}`).join(' OR ')})`
      );
      certArray.forEach(c => params.push(`%${c}%`));
    }

    if (region && region.trim()) {
      whereConditions.push(`state ILIKE $${paramIndex++}`);
      params.push(`%${region}%`);
    }

    const query = `SELECT * FROM sub_profiles WHERE ${whereConditions.join(' AND ')}`;
    const result = await pool.query(query, params);
    const candidates = result.rows;

    // Score each candidate
    const naicsArray = naics ? naics.split(',').map(n => n.trim()) : [];
    const certArray = certifications ? certifications.split(',').map(c => c.trim()) : [];

    const scored = candidates.map(sub => {
      let score = 0;
      const reasons = [];

      // NAICS matches: +25 per match
      naicsArray.forEach(naics => {
        if (sub.naics_codes && sub.naics_codes.includes(naics)) {
          score += 25;
          reasons.push(`NAICS ${naics} match`);
        }
      });

      // Certification matches: +20 per match
      certArray.forEach(cert => {
        if (sub.certifications && sub.certifications.includes(cert)) {
          score += 20;
          reasons.push(`${cert} certified`);
        }
      });

      // Clearance match: +15
      if (clearance && sub.capabilities && sub.capabilities.includes(clearance)) {
        score += 15;
        reasons.push(`${clearance} clearances available`);
      }

      // Region match: +10
      if (region && sub.state && sub.state.includes(region)) {
        score += 10;
        reasons.push(`Based in ${region}`);
      }

      return {
        ...sub,
        match_score: Math.min(100, score),
        match_reasons: reasons,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.match_score - a.match_score);

    res.json({ partners: scored, count: scored.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
