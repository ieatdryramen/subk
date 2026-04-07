const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { searchPrimeAwardees } = require('../services/govdata');
const { generatePrimeOutreach } = require('../services/ai');

// Get all tracked primes for org
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const r = await pool.query(
      'SELECT * FROM primes WHERE org_id=$1 ORDER BY fit_score DESC NULLS LAST, total_awards_value DESC',
      [orgId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search for prime awardees from USASpending
router.post('/search', auth, async (req, res) => {
  const { naics_codes, agency } = req.body;
  try {
    const primes = await searchPrimeAwardees({ naics_codes, agency });
    res.json(primes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export primes as CSV — MUST be before /:id routes to avoid path conflict
router.get('/export/csv', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const r = await pool.query('SELECT company_name, cage_code, uei, website, naics_codes, certifications, outreach_status, contact_name, contact_email, fit_score, total_awards_value FROM primes WHERE org_id=$1 ORDER BY fit_score DESC NULLS LAST', [orgId]);

    const headers = ['Company Name', 'CAGE Code', 'UEI', 'Website', 'NAICS Codes', 'Certifications', 'Outreach Status', 'Contact Name', 'Contact Email', 'Fit Score', 'Total Awards Value'];
    const rows = r.rows.map(p => [
      `"${(p.company_name||'').replace(/"/g, '""')}"`,
      p.cage_code || '',
      p.uei || '',
      p.website || '',
      `"${(p.naics_codes||'').replace(/"/g, '""')}"`,
      `"${(p.certifications||'').replace(/"/g, '""')}"`,
      p.outreach_status || 'not_contacted',
      `"${(p.contact_name||'').replace(/"/g, '""')}"`,
      p.contact_email || '',
      p.fit_score || '',
      p.total_awards_value || '',
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=subk-primes.csv');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Add a prime to track
router.post('/', auth, async (req, res) => {
  const { company_name, uei, cage_code, website, naics_codes, agency_focus, total_awards_value, award_count, recent_awards, size_category } = req.body;
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    const r = await pool.query(
      `INSERT INTO primes (org_id, company_name, uei, cage_code, website, naics_codes, agency_focus, total_awards_value, award_count, recent_awards, size_category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [orgId, company_name, uei, cage_code, website, naics_codes, agency_focus, total_awards_value, award_count, JSON.stringify(recent_awards || []), size_category]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate AI outreach for a prime
router.post('/:id/generate', auth, async (req, res) => {
  try {
    const primeR = await pool.query('SELECT * FROM primes WHERE id=$1', [req.params.id]);
    const prime = primeR.rows[0];
    if (!prime) return res.status(404).json({ error: 'Prime not found' });

    const profileR = await pool.query('SELECT * FROM sub_profiles WHERE user_id=$1', [req.userId]);
    const subProfile = profileR.rows[0];
    if (!subProfile) return res.status(400).json({ error: 'Complete your company profile first' });

    const result = await generatePrimeOutreach(prime, subProfile);

    await pool.query(
      `UPDATE primes SET research=$1, teaming_pitch=$2, email1=$3, email2=$4, email3=$5, call_opener=$6, updated_at=NOW()
       WHERE id=$7`,
      [result.research, result.teaming_pitch, result.email1, result.email2, result.email3, result.call_opener, req.params.id]
    );

    const updated = await pool.query('SELECT * FROM primes WHERE id=$1', [req.params.id]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update prime fields (status, contact info, notes)
router.put('/:id', auth, async (req, res) => {
  const { outreach_status, contact_name, contact_email, contact_title, notes, fit_score, fit_reason } = req.body;
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    await pool.query(
      `UPDATE primes SET outreach_status=COALESCE($1, outreach_status), contact_name=COALESCE($2, contact_name),
       contact_email=COALESCE($3, contact_email), contact_title=COALESCE($4, contact_title),
       notes=COALESCE($5, notes), fit_score=COALESCE($6, fit_score), fit_reason=COALESCE($7, fit_reason), updated_at=NOW()
       WHERE id=$8 AND org_id=$9`,
      [outreach_status, contact_name, contact_email, contact_title, notes, fit_score, fit_reason, req.params.id, orgId]
    );
    const r = await pool.query('SELECT * FROM primes WHERE id=$1 AND org_id=$2', [req.params.id, orgId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Prime not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a prime
router.delete('/:id', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;
    await pool.query('DELETE FROM primes WHERE id=$1 AND org_id=$2', [req.params.id, orgId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get outreach sequence for a prime
router.get('/:id/outreach', auth, async (req, res) => {
  const TOUCHPOINTS = [
    { key: 'email1', label: 'Email 1 (Day 1)', type: 'email' },
    { key: 'email2', label: 'Email 2 (Day 4)', type: 'email' },
    { key: 'linkedin_connect', label: 'LinkedIn Connect', type: 'linkedin' },
    { key: 'email3', label: 'Email 3 (Day 10)', type: 'email' },
    { key: 'call', label: 'Call Attempt', type: 'call' },
    { key: 'linkedin_dm', label: 'LinkedIn DM', type: 'linkedin' },
    { key: 'breakup', label: 'Breakup Email', type: 'email' },
  ];

  try {
    const events = await pool.query(
      'SELECT * FROM outreach_events WHERE prime_id=$1',
      [req.params.id]
    );
    const eventMap = {};
    events.rows.forEach(e => { eventMap[e.touchpoint] = e; });
    const sequence = TOUCHPOINTS.map(tp => ({
      ...tp,
      status: eventMap[tp.key]?.status || 'pending',
      notes: eventMap[tp.key]?.notes || '',
      completed_at: eventMap[tp.key]?.completed_at || null,
    }));
    res.json(sequence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark outreach touchpoint
router.post('/:id/outreach', auth, async (req, res) => {
  const { touchpoint, status, notes } = req.body;
  try {
    const existing = await pool.query(
      'SELECT id FROM outreach_events WHERE prime_id=$1 AND touchpoint=$2',
      [req.params.id, touchpoint]
    );
    if (existing.rows.length) {
      await pool.query(
        'UPDATE outreach_events SET status=$1, notes=$2, completed_at=$3 WHERE id=$4',
        [status, notes, status === 'done' ? new Date() : null, existing.rows[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO outreach_events (prime_id, user_id, touchpoint, status, notes, completed_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [req.params.id, req.userId, touchpoint, status, notes, status === 'done' ? new Date() : null]
      );
    }

    // Update outreach status on prime
    const doneCount = await pool.query(
      "SELECT COUNT(*) FROM outreach_events WHERE prime_id=$1 AND status='done'",
      [req.params.id]
    );
    const done = parseInt(doneCount.rows[0].count);
    const outreachStatus = done === 0 ? 'not_contacted' : done >= 5 ? 'sequence_complete' : 'in_sequence';
    await pool.query('UPDATE primes SET outreach_status=$1 WHERE id=$2', [outreachStatus, req.params.id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add note to prime
router.post('/:id/notes', auth, async (req, res) => {
  const { content } = req.body;
  try {
    const r = await pool.query(
      'INSERT INTO prime_notes (prime_id, user_id, content) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, req.userId, content]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/notes', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT pn.*, u.full_name FROM prime_notes pn JOIN users u ON u.id=pn.user_id WHERE pn.prime_id=$1 ORDER BY pn.created_at DESC',
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /primes/:id/start-sequence — mark prime as 'in_sequence' and create outreach_events
router.post('/:id/start-sequence', auth, async (req, res) => {
  try {
    const primeR = await pool.query('SELECT * FROM primes WHERE id=$1', [req.params.id]);
    if (!primeR.rows.length) {
      return res.status(404).json({ error: 'Prime not found' });
    }

    // Mark prime as in_sequence
    await pool.query(
      'UPDATE primes SET outreach_status=$1, updated_at=NOW() WHERE id=$2',
      ['in_sequence', req.params.id]
    );

    // Create outreach_events for email1 (today), email2 (+3 days), email3 (+7 days)
    const today = new Date();
    const touchpoints = [
      { touchpoint: 'email1', scheduled_date: today },
      { touchpoint: 'email2', scheduled_date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000) },
      { touchpoint: 'email3', scheduled_date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) },
    ];

    for (const tp of touchpoints) {
      // Check if already exists
      const existing = await pool.query(
        'SELECT id FROM outreach_events WHERE prime_id=$1 AND touchpoint=$2',
        [req.params.id, tp.touchpoint]
      );

      if (!existing.rows.length) {
        await pool.query(
          'INSERT INTO outreach_events (prime_id, user_id, touchpoint, status, created_at) VALUES ($1,$2,$3,$4,$5)',
          [req.params.id, req.userId, tp.touchpoint, 'pending', tp.scheduled_date]
        );
      }
    }

    const updated = await pool.query('SELECT * FROM primes WHERE id=$1', [req.params.id]);
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /primes/:id/complete-touchpoint — mark a specific touchpoint as completed
router.post('/:id/complete-touchpoint', auth, async (req, res) => {
  const { touchpoint } = req.body;
  try {
    const existing = await pool.query(
      'SELECT id FROM outreach_events WHERE prime_id=$1 AND touchpoint=$2',
      [req.params.id, touchpoint]
    );

    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Touchpoint not found' });
    }

    // Mark as completed
    await pool.query(
      'UPDATE outreach_events SET status=$1, completed_at=NOW() WHERE id=$2',
      ['done', existing.rows[0].id]
    );

    // Update prime outreach status based on completion count
    const doneCount = await pool.query(
      "SELECT COUNT(*) FROM outreach_events WHERE prime_id=$1 AND status='done'",
      [req.params.id]
    );
    const done = parseInt(doneCount.rows[0].count);
    const outreachStatus = done === 0 ? 'not_contacted' : done >= 3 ? 'sequence_complete' : 'in_sequence';
    await pool.query(
      'UPDATE primes SET outreach_status=$1 WHERE id=$2',
      [outreachStatus, req.params.id]
    );

    res.json({ success: true, touchpoint, outreach_status: outreachStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /primes/:id/sequence — get all outreach events for a prime
router.get('/:id/sequence', auth, async (req, res) => {
  try {
    const events = await pool.query(
      `SELECT id, prime_id, touchpoint, status, completed_at, created_at
       FROM outreach_events
       WHERE prime_id=$1
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    res.json(events.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
