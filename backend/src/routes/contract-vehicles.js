const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');

/**
 * GET /api/contract-vehicles
 * List vehicles for org
 */
router.get('/', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const r = await pool.query(
      `SELECT * FROM contract_vehicles WHERE org_id=$1 ORDER BY created_at DESC`,
      [orgId]
    );

    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('GET /contract-vehicles error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/contract-vehicles
 * Add a vehicle
 */
router.post('/', auth, async (req, res) => {
  try {
    const {
      name,
      vehicle_type,
      contract_number,
      agency,
      ceiling_value,
      current_value = 0,
      start_date,
      end_date,
      option_years = 0,
      naics_codes = [],
      status = 'active',
      notes,
    } = req.body;

    if (!name || !vehicle_type) {
      return res.status(400).json({ error: 'Name and vehicle_type are required' });
    }

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    const result = await pool.query(
      `INSERT INTO contract_vehicles
       (org_id, name, vehicle_type, contract_number, agency, ceiling_value, current_value,
        start_date, end_date, option_years, naics_codes, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        orgId,
        name,
        vehicle_type,
        contract_number,
        agency,
        ceiling_value,
        current_value,
        start_date,
        end_date,
        option_years,
        JSON.stringify(naics_codes),
        status,
        notes,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /contract-vehicles error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/contract-vehicles/:id
 * Update a vehicle
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      vehicle_type,
      contract_number,
      agency,
      ceiling_value,
      current_value,
      start_date,
      end_date,
      option_years,
      naics_codes,
      status,
      notes,
    } = req.body;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Verify ownership
    const vehicleR = await pool.query(
      `SELECT id FROM contract_vehicles WHERE id=$1 AND org_id=$2`,
      [id, orgId]
    );

    if (vehicleR.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const result = await pool.query(
      `UPDATE contract_vehicles
       SET name=$1, vehicle_type=$2, contract_number=$3, agency=$4, ceiling_value=$5,
           current_value=$6, start_date=$7, end_date=$8, option_years=$9,
           naics_codes=$10, status=$11, notes=$12, updated_at=NOW()
       WHERE id=$13 AND org_id=$14
       RETURNING *`,
      [
        name,
        vehicle_type,
        contract_number,
        agency,
        ceiling_value,
        current_value,
        start_date,
        end_date,
        option_years,
        JSON.stringify(naics_codes || []),
        status,
        notes,
        id,
        orgId,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PUT /contract-vehicles/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/contract-vehicles/:id
 * Delete a vehicle
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
      `DELETE FROM contract_vehicles WHERE id=$1 AND org_id=$2 RETURNING *`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('DELETE /contract-vehicles/:id error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/contract-vehicles/match/:opportunityId
 * Suggest matching vehicles for an opportunity
 */
router.get('/match/:opportunityId', auth, async (req, res) => {
  try {
    const { opportunityId } = req.params;

    const userR = await pool.query('SELECT org_id FROM users WHERE id=$1', [req.userId]);
    const orgId = userR.rows[0]?.org_id;

    if (!orgId) {
      return res.status(400).json({ error: 'User not in an organization' });
    }

    // Get opportunity to find matching NAICS codes
    const oppR = await pool.query(
      `SELECT naics_code, value_max FROM opportunities WHERE id=$1 AND org_id=$2`,
      [opportunityId, orgId]
    );

    if (oppR.rows.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const opp = oppR.rows[0];
    const naicsCode = opp.naics_code;
    const oppValue = opp.value_max;

    // Find vehicles that:
    // 1. Have matching NAICS codes
    // 2. Have sufficient ceiling value remaining
    // 3. Are active
    const vehicles = await pool.query(
      `SELECT *,
              (ceiling_value - COALESCE(current_value, 0)) as remaining_ceiling
       FROM contract_vehicles
       WHERE org_id=$1
         AND status='active'
         AND (naics_codes::text LIKE $2 OR naics_codes::text = '[]')
         AND (ceiling_value - COALESCE(current_value, 0)) >= $3
       ORDER BY remaining_ceiling DESC`,
      [orgId, `%${naicsCode}%`, oppValue || 0]
    );

    res.json({ success: true, data: vehicles.rows });
  } catch (err) {
    console.error('GET /contract-vehicles/match/:opportunityId error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
