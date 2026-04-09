const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

// FOIA request templates
const FOIA_TEMPLATES = {
  'competitor-proposals': {
    name: 'Competitor Proposals',
    description: 'Request proposals from competitors on federal contracts',
    template: `This Freedom of Information Act request seeks all proposals submitted by [COMPETITOR_NAME] to [AGENCY] for contract [CONTRACT_NUMBER] or opportunity [OPPORTUNITY_NUMBER] dated [DATE_RANGE].

Requested documents include:
- Technical proposals
- Management proposals
- Cost/pricing proposals
- Any clarifications or amendments

The information is requested in electronic format if available.`
  },
  'pricing-data': {
    name: 'Federal Pricing Data',
    description: 'Request pricing information on federal contracts',
    template: `This Freedom of Information Act request seeks pricing data submitted by [CONTRACTOR_NAME] to [AGENCY] for contract [CONTRACT_NUMBER] dated [DATE_RANGE].

Requested information includes:
- Proposed rates
- Cost estimates
- Labor categories and pricing
- Any cost reductions or adjustments

The information is requested in electronic format if available.`
  },
  'past-performance': {
    name: 'Past Performance Records',
    description: 'Request past performance data on contracts',
    template: `This Freedom of Information Act request seeks all past performance or performance evaluation information for contract [CONTRACT_NUMBER] performed by [CONTRACTOR_NAME] for [AGENCY].

Requested documents include:
- Performance evaluation reports
- Technical assessment reports
- Customer satisfaction surveys
- Lessons learned documentation

The information is requested in electronic format if available.`
  },
  'contract-mods': {
    name: 'Contract Modifications',
    description: 'Request contract modification records',
    template: `This Freedom of Information Act request seeks all contract modifications (amendments) for contract [CONTRACT_NUMBER] with [CONTRACTOR_NAME] dated [DATE_RANGE].

Requested documents include:
- All modification documents
- Justifications for modifications
- Cost changes and adjustments
- Statement of work changes

The information is requested in electronic format if available.`
  },
  'task-orders': {
    name: 'Task Order Records',
    description: 'Request task order and delivery order information',
    template: `This Freedom of Information Act request seeks all task orders and delivery orders issued under contract [CONTRACT_NUMBER] or IDIQ [IDIQ_NUMBER] dated [DATE_RANGE].

Requested documents include:
- All task/delivery order awards
- Scope of work statements
- Pricing information
- Contractor responses

The information is requested in electronic format if available.`
  },
};

// List FOIA requests for org
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const r = await pool.query(
      `SELECT * FROM foia_requests WHERE org_id=$1 ORDER BY created_at DESC`,
      [orgId]
    );

    // Build stats
    const statuses = { draft: 0, submitted: 0, processing: 0, completed: 0 };
    r.rows.forEach(req => {
      if (statuses[req.status] !== undefined) statuses[req.status]++;
    });

    res.json({
      requests: r.rows,
      stats: statuses,
      total: r.rows.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get FOIA templates
router.get('/templates', auth, async (req, res) => {
  try {
    const templates = Object.entries(FOIA_TEMPLATES).map(([key, value]) => ({
      id: key,
      ...value,
    }));
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new FOIA request
router.post('/', auth, async (req, res) => {
  try {
    const { title, agency, template_type, request_text, notes } = req.body;
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    const r = await pool.query(
      `INSERT INTO foia_requests (org_id, user_id, title, agency, template_type, request_text, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft') RETURNING *`,
      [orgId, req.userId, title, agency, template_type || null, request_text, notes || null]
    );

    res.status(201).json({ request: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update FOIA request
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, tracking_number, submitted_date, response_date, documents, notes } = req.body;
    const requestId = parseInt(req.params.id, 10);

    // Verify ownership
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const userOrgId = userR.rows[0]?.org_id;

    const fR = await pool.query('SELECT org_id FROM foia_requests WHERE id=$1', [requestId]);
    if (fR.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    if (fR.rows[0].org_id !== userOrgId) return res.status(403).json({ error: 'Unauthorized' });

    const updates = [];
    const values = [];
    let paramNum = 1;

    if (status !== undefined) {
      updates.push(`status=$${paramNum++}`);
      values.push(status);
    }
    if (tracking_number !== undefined) {
      updates.push(`tracking_number=$${paramNum++}`);
      values.push(tracking_number);
    }
    if (submitted_date !== undefined) {
      updates.push(`submitted_date=$${paramNum++}`);
      values.push(submitted_date);
    }
    if (response_date !== undefined) {
      updates.push(`response_date=$${paramNum++}`);
      values.push(response_date);
    }
    if (documents !== undefined) {
      updates.push(`documents=$${paramNum++}`);
      values.push(JSON.stringify(documents));
    }
    if (notes !== undefined) {
      updates.push(`notes=$${paramNum++}`);
      values.push(notes);
    }

    updates.push(`updated_at=NOW()`);
    values.push(requestId);

    if (updates.length <= 1) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const query = `UPDATE foia_requests SET ${updates.join(', ')} WHERE id=$${paramNum} RETURNING *`;
    const result = await pool.query(query, values);

    res.json({ request: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete FOIA request
router.delete('/:id', auth, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);

    // Verify ownership
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const userOrgId = userR.rows[0]?.org_id;

    const fR = await pool.query('SELECT org_id FROM foia_requests WHERE id=$1', [requestId]);
    if (fR.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    if (fR.rows[0].org_id !== userOrgId) return res.status(403).json({ error: 'Unauthorized' });

    await pool.query('DELETE FROM foia_requests WHERE id=$1', [requestId]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
