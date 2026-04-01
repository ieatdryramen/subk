const router = require('express').Router();
const auth = require('../middleware/auth');
const { pool } = require('../db');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const upload = multer({ storage: multer.memoryStorage() });

// Get all lists
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ll.*, COUNT(l.id) as lead_count 
       FROM lead_lists ll LEFT JOIN leads l ON l.list_id=ll.id 
       WHERE ll.user_id=$1 GROUP BY ll.id ORDER BY ll.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create list
router.post('/', auth, async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO lead_lists (user_id, name, description) VALUES ($1,$2,$3) RETURNING *',
      [req.userId, name, description]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete list
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM lead_lists WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get leads in list
router.get('/:id/leads', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, p.research, p.email1, p.email2, p.email3, p.linkedin, p.call_opener, p.objection_handling, p.callbacks, p.generated_at
       FROM leads l LEFT JOIN playbooks p ON p.lead_id=l.id
       WHERE l.list_id=$1 AND l.user_id=$2 ORDER BY l.created_at ASC`,
      [req.params.id, req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add leads manually
router.post('/:id/leads', auth, async (req, res) => {
  const { leads } = req.body;
  try {
    const inserted = [];
    for (const lead of leads) {
      const r = await pool.query(
        'INSERT INTO leads (list_id, user_id, full_name, company, title, email, linkedin, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [req.params.id, req.userId, lead.full_name, lead.company, lead.title, lead.email, lead.linkedin, lead.notes]
      );
      inserted.push(r.rows[0]);
    }
    res.json(inserted);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// CSV upload
router.post('/:id/import', auth, upload.single('file'), async (req, res) => {
  try {
    const content = req.file.buffer.toString('utf8');
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
    const inserted = [];
    for (const row of records) {
      const name = row.name || row.full_name || row['Full Name'] || '';
      const company = row.company || row.Company || '';
      const title = row.title || row.Title || row.role || '';
      const email = row.email || row.Email || '';
      const linkedin = row.linkedin || row.LinkedIn || '';
      const notes = row.notes || row.Notes || '';
      if (!name && !company) continue;
      const r = await pool.query(
        'INSERT INTO leads (list_id, user_id, full_name, company, title, email, linkedin, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [req.params.id, req.userId, name, company, title, email, linkedin, notes]
      );
      inserted.push(r.rows[0]);
    }
    res.json({ imported: inserted.length, leads: inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'CSV parse error: ' + err.message });
  }
});

// Delete lead
router.delete('/:listId/leads/:leadId', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM leads WHERE id=$1 AND user_id=$2', [req.params.leadId, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
