const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// Get all proposals for user's org, ordered by deadline ASC
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const r = await pool.query(
      'SELECT * FROM proposals WHERE org_id=$1 ORDER BY deadline ASC NULLS LAST, created_at DESC',
      [orgId]
    );
    res.json({ proposals: r.rows });
  } catch (err) {
    console.error('GET /proposals error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a new proposal
router.post('/', auth, async (req, res) => {
  try {
    const { opportunity_id, title, status, deadline, team_members, sections, estimated_value } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const result = await pool.query(
      `INSERT INTO proposals (org_id, user_id, opportunity_id, title, status, deadline, team_members, sections, estimated_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        orgId,
        req.userId,
        opportunity_id || null,
        title,
        status || 'drafting',
        deadline || null,
        JSON.stringify(team_members || []),
        JSON.stringify(sections || []),
        estimated_value || 0,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /proposals error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single proposal with details
router.get('/:id', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const r = await pool.query(
      'SELECT * FROM proposals WHERE id=$1 AND org_id=$2',
      [req.params.id, orgId]
    );

    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json(r.rows[0]);
  } catch (err) {
    console.error('GET /proposals/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update proposal (status, sections progress, etc.)
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, sections, notes, team_members, estimated_value } = req.body;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    // Verify ownership
    const checkR = await pool.query(
      'SELECT * FROM proposals WHERE id=$1 AND org_id=$2',
      [req.params.id, orgId]
    );

    if (checkR.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = checkR.rows[0];
    const updatedStatus = status !== undefined ? status : proposal.status;
    const updatedSections = sections !== undefined ? JSON.stringify(sections) : proposal.sections;
    const updatedNotes = notes !== undefined ? notes : proposal.notes;
    const updatedTeamMembers = team_members !== undefined ? JSON.stringify(team_members) : proposal.team_members;
    const updatedValue = estimated_value !== undefined ? estimated_value : proposal.estimated_value;

    const result = await pool.query(
      `UPDATE proposals SET status=$1, sections=$2, notes=$3, team_members=$4, estimated_value=$5, updated_at=NOW()
       WHERE id=$6 AND org_id=$7
       RETURNING *`,
      [updatedStatus, updatedSections, updatedNotes, updatedTeamMembers, updatedValue, req.params.id, orgId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /proposals/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
