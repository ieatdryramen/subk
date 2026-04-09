const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

/**
 * GET /api/doc-collab/:proposalId/comments
 * List comments on a proposal
 */
router.get('/:proposalId/comments', auth, async (req, res) => {
  try {
    const { proposalId } = req.params;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Verify user has access to proposal
    const propR = await pool.query(
      `SELECT id FROM proposals WHERE id=$1 AND org_id=$2`,
      [proposalId, orgId]
    );

    if (propR.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const r = await pool.query(
      `SELECT dc.*, u.full_name, u.email
       FROM doc_comments dc
       LEFT JOIN users u ON dc.user_id = u.id
       WHERE dc.proposal_id = $1
       ORDER BY dc.created_at DESC`,
      [proposalId]
    );

    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('GET /doc-collab/:proposalId/comments error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/doc-collab/:proposalId/comments
 * Add a comment to a proposal
 */
router.post('/:proposalId/comments', auth, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { section, content } = req.body;

    if (!section || !content) {
      return res.status(400).json({ error: 'Section and content are required' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Verify user has access to proposal
    const propR = await pool.query(
      `SELECT id FROM proposals WHERE id=$1 AND org_id=$2`,
      [proposalId, orgId]
    );

    if (propR.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const result = await pool.query(
      `INSERT INTO doc_comments (proposal_id, user_id, section, content, resolved)
       VALUES ($1, $2, $3, $4, false)
       RETURNING *`,
      [proposalId, req.userId, section, content]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /doc-collab/:proposalId/comments error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/doc-collab/comments/:id
 * Delete a comment
 */
router.delete('/comments/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Verify user owns comment or is admin
    const commentR = await pool.query(
      `SELECT dc.id FROM doc_comments dc
       JOIN proposals p ON dc.proposal_id = p.id
       WHERE dc.id=$1 AND p.org_id=$2 AND (dc.user_id=$3 OR $4='admin')`,
      [id, orgId, req.userId, req.userRole]
    );

    if (commentR.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized or comment not found' });
    }

    const result = await pool.query(
      `DELETE FROM doc_comments WHERE id=$1 RETURNING *`,
      [id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('DELETE /doc-collab/comments/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/doc-collab/:proposalId/versions
 * List version history for a proposal
 */
router.get('/:proposalId/versions', auth, async (req, res) => {
  try {
    const { proposalId } = req.params;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Verify user has access to proposal
    const propR = await pool.query(
      `SELECT id FROM proposals WHERE id=$1 AND org_id=$2`,
      [proposalId, orgId]
    );

    if (propR.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const r = await pool.query(
      `SELECT dv.*, u.full_name, u.email
       FROM doc_versions dv
       LEFT JOIN users u ON dv.user_id = u.id
       WHERE dv.proposal_id = $1
       ORDER BY dv.version_number DESC`,
      [proposalId]
    );

    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('GET /doc-collab/:proposalId/versions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/doc-collab/:proposalId/versions
 * Save a version snapshot of the proposal
 */
router.post('/:proposalId/versions', auth, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { snapshot, change_summary } = req.body;

    if (!snapshot) {
      return res.status(400).json({ error: 'Snapshot is required' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Verify user has access to proposal
    const propR = await pool.query(
      `SELECT id FROM proposals WHERE id=$1 AND org_id=$2`,
      [proposalId, orgId]
    );

    if (propR.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Get next version number
    const versionR = await pool.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM doc_versions WHERE proposal_id=$1`,
      [proposalId]
    );

    const nextVersion = versionR.rows[0].next_version;

    const result = await pool.query(
      `INSERT INTO doc_versions (proposal_id, user_id, version_number, snapshot, change_summary)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [proposalId, req.userId, nextVersion, JSON.stringify(snapshot), change_summary || '']
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /doc-collab/:proposalId/versions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
