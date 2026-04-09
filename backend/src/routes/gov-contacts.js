const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

/**
 * GET /api/gov-contacts
 * List contacts for org
 */
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const r = await pool.query(
      `SELECT * FROM gov_contacts WHERE org_id=$1 ORDER BY name ASC`,
      [orgId]
    );

    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('GET /gov-contacts error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/gov-contacts/search?q=
 * Search contacts
 */
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const searchTerm = `%${q}%`;

    const r = await pool.query(
      `SELECT * FROM gov_contacts
       WHERE org_id=$1
         AND (name ILIKE $2 OR email ILIKE $2 OR agency ILIKE $2 OR title ILIKE $2)
       ORDER BY name ASC`,
      [orgId, searchTerm]
    );

    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('GET /gov-contacts/search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/gov-contacts
 * Add a contact
 */
router.post('/', auth, async (req, res) => {
  try {
    const {
      name,
      title,
      agency,
      office,
      email,
      phone,
      linkedin,
      notes,
      tags = [],
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const result = await pool.query(
      `INSERT INTO gov_contacts
       (org_id, name, title, agency, office, email, phone, linkedin, notes, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [orgId, name, title, agency, office, email, phone, linkedin, notes, JSON.stringify(tags)]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /gov-contacts error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/gov-contacts/:id
 * Update a contact
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      title,
      agency,
      office,
      email,
      phone,
      linkedin,
      notes,
      tags,
      interaction_count,
      last_interaction,
    } = req.body;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Verify ownership
    const contactR = await pool.query(
      `SELECT id FROM gov_contacts WHERE id=$1 AND org_id=$2`,
      [id, orgId]
    );

    if (contactR.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const result = await pool.query(
      `UPDATE gov_contacts
       SET name=$1, title=$2, agency=$3, office=$4, email=$5, phone=$6, linkedin=$7,
           notes=$8, tags=$9, interaction_count=$10, last_interaction=$11, updated_at=NOW()
       WHERE id=$12 AND org_id=$13
       RETURNING *`,
      [
        name,
        title,
        agency,
        office,
        email,
        phone,
        linkedin,
        notes,
        JSON.stringify(tags || []),
        interaction_count,
        last_interaction,
        id,
        orgId,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT /gov-contacts/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/gov-contacts/:id
 * Delete a contact
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
      `DELETE FROM gov_contacts WHERE id=$1 AND org_id=$2 RETURNING *`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('DELETE /gov-contacts/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
