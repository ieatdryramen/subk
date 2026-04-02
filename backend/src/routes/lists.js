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
      `SELECT ll.*, 
              COUNT(l.id) as lead_count,
              COUNT(CASE WHEN l.status = 'done' THEN 1 END) as done_count
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
      `SELECT l.*, p.research, p.email1, p.email2, p.email3, p.email4, 
              p.linkedin, p.call_opener, p.objection_handling, p.callbacks, p.generated_at
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
      // Handle all common ZoomInfo and CRM export column formats
      const firstName = row['First Name'] || row['first_name'] || row['FirstName'] || '';
      const lastName = row['Last Name'] || row['last_name'] || row['LastName'] || '';
      const name = (
        row['Full Name'] || row['full_name'] || row['Name'] || row['name'] ||
        row['Contact Name'] || row['Person Name'] || row['Contact'] ||
        (`${firstName} ${lastName}`.trim())
      ) || '';
      const company = row['Company'] || row['company'] || row['Company Name'] || row['Account Name'] || row['Organization'] || '';
      const title = row['Title'] || row['title'] || row['Job Title'] || row['Position'] || row['Role'] || row['role'] || '';
      const email = row['Email'] || row['email'] || row['Email Address'] || row['Work Email'] || '';
      const phone = row['Phone'] || row['phone'] || row['Mobile Phone'] || row['Direct Phone'] || row['Phone Number'] || '';
      const linkedin = row['LinkedIn'] || row['linkedin'] || row['LinkedIn URL'] || row['Person Linkedin Url'] || row['LinkedIn Profile'] || '';
      const notes = row['Notes'] || row['notes'] || '';
      if (!name && !company && !email) continue;
      const r = await pool.query(
        'INSERT INTO leads (list_id, user_id, full_name, company, title, email, phone, linkedin, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
        [req.params.id, req.userId, name, company, title, email, phone, linkedin, notes]
      );
      inserted.push(r.rows[0]);
    }
    res.json({ imported: inserted.length, leads: inserted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'CSV parse error: ' + err.message });
  }
});

// Fix missing names from email addresses (one-time utility)
router.post('/:listId/fix-names', auth, async (req, res) => {
  try {
    const leads = await pool.query(
      "SELECT id, email FROM leads WHERE list_id=$1 AND (full_name IS NULL OR full_name = '')",
      [req.params.listId]
    );
    let fixed = 0;
    for (const lead of leads.rows) {
      if (lead.email) {
        const prefix = lead.email.split('@')[0];
        // Skip if it looks like initials only (e.g. "bgillan", "ckantor")
        // Try to split on dots/underscores/hyphens first
        const parts = prefix.split(/[._-]/);
        let emailName = '';
        if (parts.length >= 2) {
          // Has separator - likely firstname.lastname format
          emailName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ').trim();
        } else if (prefix.length > 3) {
          // Single token - capitalize first letter only
          emailName = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
        }
        if (emailName && emailName.length > 1) {
          await pool.query('UPDATE leads SET full_name=$1 WHERE id=$2', [emailName, lead.id]);
          fixed++;
        }
      }
    }
    res.json({ fixed, total: leads.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

