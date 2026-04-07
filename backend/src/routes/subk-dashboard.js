const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// GET /dashboard/stats — aggregated dashboard stats for the user's org
router.get('/stats', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const [opps, highFit, primesR, deadlines, teamingReceived, teamingPending, pastPerf, profileR, marketplaceSubs] = await Promise.all([
      // Total opportunities tracked
      pool.query('SELECT COUNT(*) FROM opportunities WHERE org_id=$1', [orgId]),
      // High-fit opportunities (70+)
      pool.query('SELECT COUNT(*) FROM opportunities WHERE org_id=$1 AND fit_score >= 70', [orgId]),
      // Primes tracked
      pool.query('SELECT COUNT(*) FROM primes WHERE org_id=$1', [orgId]),
      // Deadlines within 14 days
      pool.query(`SELECT COUNT(*) FROM opportunities WHERE org_id=$1 AND response_deadline > NOW() AND response_deadline <= NOW() + INTERVAL '14 days'`, [orgId]),
      // Teaming requests received (all time)
      pool.query('SELECT COUNT(*) FROM teaming_requests WHERE to_user_id=$1', [req.userId]),
      // Pending teaming requests
      pool.query(`SELECT COUNT(*) FROM teaming_requests WHERE to_user_id=$1 AND status='pending'`, [req.userId]),
      // Past performance records
      pool.query('SELECT COUNT(*) FROM past_performance WHERE user_id=$1', [req.userId]),
      // Profile completeness
      pool.query('SELECT company_name, naics_codes, certifications, capabilities, uei, is_public FROM sub_profiles WHERE user_id=$1', [req.userId]),
      // Total public subs in marketplace
      pool.query('SELECT COUNT(*) FROM sub_profiles WHERE is_public=true'),
    ]);

    // Profile completeness calculation
    const profile = profileR.rows[0];
    let profileComplete = 0;
    if (profile) {
      const fields = ['company_name', 'naics_codes', 'certifications', 'capabilities', 'uei'];
      profileComplete = Math.round((fields.filter(f => profile[f] && String(profile[f]).trim()).length / fields.length) * 100);
    }

    res.json({
      opportunities: parseInt(opps.rows[0].count),
      high_fit: parseInt(highFit.rows[0].count),
      primes_tracked: parseInt(primesR.rows[0].count),
      deadlines_14d: parseInt(deadlines.rows[0].count),
      teaming_received: parseInt(teamingReceived.rows[0].count),
      teaming_pending: parseInt(teamingPending.rows[0].count),
      past_performance_count: parseInt(pastPerf.rows[0].count),
      profile_completeness: profileComplete,
      is_public: profile?.is_public || false,
      marketplace_subs: parseInt(marketplaceSubs.rows[0].count),
    });
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /dashboard/analytics — detailed analytics for opportunities, primes, and activity
router.get('/analytics', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Opportunity pipeline counts grouped by status
    const pipelineR = await pool.query(
      `SELECT status, COUNT(*) as count FROM opportunities WHERE org_id=$1 GROUP BY status ORDER BY status`,
      [orgId]
    );

    const opportunityPipeline = {};
    const statuses = ['new', 'reviewing', 'pursuing', 'teaming', 'submitted', 'won', 'lost', 'no_bid'];
    statuses.forEach(status => {
      opportunityPipeline[status] = 0;
    });
    pipelineR.rows.forEach(row => {
      if (opportunityPipeline.hasOwnProperty(row.status)) {
        opportunityPipeline[row.status] = parseInt(row.count);
      }
    });

    // Pipeline value (sum of value_max for pursuing or submitted)
    const pipelineValueR = await pool.query(
      `SELECT COALESCE(SUM(value_max), 0) as total FROM opportunities
       WHERE org_id=$1 AND status IN ('pursuing', 'submitted')`,
      [orgId]
    );
    const pipelineValue = parseInt(pipelineValueR.rows[0]?.total || 0);

    // Win rate: count won / (count won + count lost)
    const winRateR = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM opportunities WHERE org_id=$1 AND status='won') as won,
        (SELECT COUNT(*) FROM opportunities WHERE org_id=$1 AND status='lost') as lost`,
      [orgId]
    );
    const won = parseInt(winRateR.rows[0]?.won || 0);
    const lost = parseInt(winRateR.rows[0]?.lost || 0);
    const winRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0;

    // Average fit score
    const avgFitR = await pool.query(
      `SELECT COALESCE(AVG(fit_score), 0) as avg FROM opportunities WHERE org_id=$1 AND fit_score IS NOT NULL`,
      [orgId]
    );
    const avgFitScore = Math.round(parseInt(avgFitR.rows[0]?.avg || 0));

    // Prime outreach stats grouped by outreach_status
    const primeStatsR = await pool.query(
      `SELECT outreach_status, COUNT(*) as count FROM primes WHERE org_id=$1 GROUP BY outreach_status ORDER BY outreach_status`,
      [orgId]
    );
    const primeOutreachStats = {};
    primeStatsR.rows.forEach(row => {
      primeOutreachStats[row.outreach_status || 'not_contacted'] = parseInt(row.count);
    });

    // Last 5 saved searches with result count
    const searchesR = await pool.query(
      `SELECT os.id, os.name, os.created_at, COUNT(o.id) as result_count
       FROM opportunity_searches os
       LEFT JOIN opportunities o ON o.search_id = os.id
       WHERE os.user_id=$1
       GROUP BY os.id
       ORDER BY os.created_at DESC
       LIMIT 5`,
      [req.userId]
    );
    const searchHistory = searchesR.rows.map(s => ({
      id: s.id,
      name: s.name,
      date: s.created_at,
      result_count: parseInt(s.result_count),
    }));

    // Monthly activity: count of opportunities added per month (last 6 months)
    const monthlyR = await pool.query(
      `SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as count
       FROM opportunities
       WHERE org_id=$1 AND created_at >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month DESC`,
      [orgId]
    );
    const monthlyActivity = monthlyR.rows.map(row => ({
      month: row.month,
      count: parseInt(row.count),
    }));

    res.json({
      opportunity_pipeline: opportunityPipeline,
      pipeline_value: pipelineValue,
      win_rate: winRate,
      avg_fit_score: avgFitScore,
      prime_outreach_stats: primeOutreachStats,
      search_history: searchHistory,
      monthly_activity: monthlyActivity,
    });
  } catch (err) {
    console.error('Dashboard analytics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /dashboard/activity — recent activity for the user's org
router.get('/activity', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const [oppsR, primesR, teamingR] = await Promise.all([
      pool.query(`SELECT id, title, agency, status, created_at FROM opportunities WHERE org_id=$1 ORDER BY created_at DESC LIMIT 10`, [orgId]),
      pool.query(`SELECT id, company_name, outreach_status, created_at FROM primes WHERE org_id=$1 ORDER BY created_at DESC LIMIT 10`, [orgId]),
      pool.query(`SELECT tr.id, tr.status, tr.created_at, u.full_name as from_name FROM teaming_requests tr JOIN users u ON u.id=tr.from_user_id WHERE tr.to_user_id=$1 ORDER BY tr.created_at DESC LIMIT 5`, [req.userId]),
    ]);

    const activities = [
      ...oppsR.rows.map(o => ({ type: 'opportunity', title: `New opportunity: ${o.title?.substring(0,60)}`, description: o.agency, timestamp: o.created_at, link: '/opportunities' })),
      ...primesR.rows.map(p => ({ type: 'prime', title: `Tracking: ${p.company_name}`, description: p.outreach_status?.replace(/_/g, ' '), timestamp: p.created_at, link: '/primes' })),
      ...teamingR.rows.map(t => ({ type: 'teaming', title: `Teaming request from ${t.from_name || 'someone'}`, description: t.status, timestamp: t.created_at, link: '/teaming' })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 20);

    res.json(activities);
  } catch (err) {
    console.error('Activity feed error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
