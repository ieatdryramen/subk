const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');

router.post('/register', async (req, res) => {
  const { email, password, full_name, invite_code } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  // Enforce work email
  const personalDomains = ['gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','live.com','msn.com','protonmail.com','me.com'];
  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (!emailDomain || personalDomains.includes(emailDomain)) {
    return res.status(400).json({ error: 'Please use your work email address to sign up.' });
  }

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);

    let org_id = null;
    let role = 'admin';

    if (invite_code) {
      const org = await pool.query('SELECT id FROM organizations WHERE invite_code=$1', [invite_code]);
      if (!org.rows.length) return res.status(400).json({ error: 'Invalid invite code' });
      org_id = org.rows[0].id;
      role = 'member';
    } else {
      // Create new org for this user
      const inviteCode = crypto.randomBytes(6).toString('hex');
      const newOrg = await pool.query(
        'INSERT INTO organizations (name, invite_code) VALUES ($1, $2) RETURNING id',
        [full_name ? `${full_name}'s Team` : 'My Team', inviteCode]
      );
      org_id = newOrg.rows[0].id;
    }

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, full_name, org_id, role) VALUES ($1,$2,$3,$4,$5) RETURNING id, email, full_name, org_id, role',
      [email, hash, full_name, org_id, role]
    );
    const user = result.rows[0];

    // Get invite code for this org
    const orgData = await pool.query('SELECT invite_code, name FROM organizations WHERE id=$1', [org_id]);
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { ...user, org: orgData.rows[0] } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const orgData = user.org_id ? await pool.query('SELECT invite_code, name FROM organizations WHERE id=$1', [user.org_id]) : null;
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, org_id: user.org_id, role: user.role, org: orgData?.rows[0] || null } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/org', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId]);
    const u = user.rows[0];
    if (!u.org_id) return res.json({ members: [], invite_code: null });
    const members = await pool.query(
      'SELECT id, email, full_name, role, created_at FROM users WHERE org_id=$1 ORDER BY created_at ASC',
      [u.org_id]
    );
    const org = await pool.query('SELECT * FROM organizations WHERE id=$1', [u.org_id]);
    res.json({ members: members.rows, org: org.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
