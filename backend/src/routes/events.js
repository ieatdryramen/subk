const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Common GovCon events to seed
const COMMON_EVENTS = [
  {
    title: 'PSC TechConnect 2026',
    event_type: 'conference',
    agency: 'Multiple',
    location: 'Arlington, VA',
    start_date: '2026-05-15',
    end_date: '2026-05-17',
    url: 'https://www.psccr.org/techconnect',
    description: 'Industry conference for professional services and technology contractors.',
    is_global: true,
  },
  {
    title: 'AFCEA TechNet Indo-Pacific',
    event_type: 'conference',
    agency: 'DoD',
    location: 'Honolulu, HI',
    start_date: '2026-06-09',
    end_date: '2026-06-11',
    url: 'https://www.afcea.org/',
    description: 'AFCEA conference focused on defense and intelligence information and cybersecurity.',
    is_global: true,
  },
  {
    title: 'GovConWire Summit',
    event_type: 'conference',
    agency: 'Multiple',
    location: 'Washington, DC',
    start_date: '2026-09-22',
    end_date: '2026-09-24',
    url: 'https://www.govconwire.com/',
    description: 'Premier government contracting industry summit.',
    is_global: true,
  },
  {
    title: 'Army Industrial Base Summit',
    event_type: 'industry_day',
    agency: 'Army',
    location: 'Washington, DC',
    start_date: '2026-07-12',
    end_date: '2026-07-12',
    url: 'https://www.army.mil/',
    description: 'Army-hosted industry day to meet with procurement officials.',
    is_global: true,
  },
  {
    title: 'Air Force Industry Day',
    event_type: 'industry_day',
    agency: 'Air Force',
    location: 'Arlington, VA',
    start_date: '2026-08-18',
    end_date: '2026-08-18',
    url: 'https://www.af.mil/',
    description: 'Opportunity to engage with Air Force buyers and program managers.',
    is_global: true,
  },
];

/**
 * GET /api/events
 * List events for org (including global events)
 */
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const r = await pool.query(
      `SELECT * FROM govcon_events
       WHERE org_id = $1 OR is_global = true
       ORDER BY start_date ASC`,
      [orgId]
    );

    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('GET /events error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/events/upcoming
 * Get upcoming events in next 90 days
 */
router.get('/upcoming', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const r = await pool.query(
      `SELECT * FROM govcon_events
       WHERE (org_id = $1 OR is_global = true)
         AND start_date >= CURRENT_DATE
         AND start_date <= CURRENT_DATE + INTERVAL '90 days'
       ORDER BY start_date ASC`,
      [orgId]
    );

    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('GET /events/upcoming error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/events
 * Create or add an event
 */
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      event_type,
      agency,
      location,
      start_date,
      end_date,
      url,
      description,
      rsvp_status = 'none',
      notes,
    } = req.body;

    if (!title || !start_date) {
      return res.status(400).json({ error: 'Title and start_date are required' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const result = await pool.query(
      `INSERT INTO govcon_events
       (org_id, title, event_type, agency, location, start_date, end_date, url, description, rsvp_status, notes, is_global)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
       RETURNING *`,
      [orgId, title, event_type, agency, location, start_date, end_date, url, description, rsvp_status, notes]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /events error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/events/:id
 * Update event (RSVP status, notes, etc)
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      event_type,
      agency,
      location,
      start_date,
      end_date,
      url,
      description,
      rsvp_status,
      notes,
    } = req.body;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Verify event belongs to org or is global
    const eventR = await pool.query(
      `SELECT * FROM govcon_events WHERE id=$1 AND (org_id=$2 OR is_global=true)`,
      [id, orgId]
    );

    if (eventR.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const result = await pool.query(
      `UPDATE govcon_events
       SET title=$1, event_type=$2, agency=$3, location=$4, start_date=$5, end_date=$6,
           url=$7, description=$8, rsvp_status=$9, notes=$10
       WHERE id=$11 AND org_id=$12
       RETURNING *`,
      [title, event_type, agency, location, start_date, end_date, url, description, rsvp_status, notes, id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Can only edit org-specific events' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT /events/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/events/:id
 * Delete event (org-specific events only)
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const result = await pool.query(
      `DELETE FROM govcon_events WHERE id=$1 AND org_id=$2 RETURNING *`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found or cannot delete global events' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('DELETE /events/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/events/seed
 * Seed org with common GovCon events
 */
router.post('/seed', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const seeded = [];
    for (const event of COMMON_EVENTS) {
      // Check if already exists
      const existing = await pool.query(
        `SELECT id FROM govcon_events WHERE org_id=$1 AND title=$2`,
        [orgId, event.title]
      );

      if (existing.rows.length === 0) {
        const result = await pool.query(
          `INSERT INTO govcon_events
           (org_id, title, event_type, agency, location, start_date, end_date, url, description, is_global)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
           RETURNING *`,
          [
            orgId,
            event.title,
            event.event_type,
            event.agency,
            event.location,
            event.start_date,
            event.end_date,
            event.url,
            event.description,
          ]
        );
        seeded.push(result.rows[0]);
      }
    }

    res.status(201).json({ success: true, message: `Seeded ${seeded.length} events`, data: seeded });
  } catch (err) {
    console.error('POST /events/seed error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
