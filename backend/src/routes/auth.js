const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');

const ACCESS_TOKEN_EXPIRY = '2h';
const REFRESH_TOKEN_DAYS = 30;

// Generate a cryptographically random refresh token and store in DB
async function createRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
  return token;
}

router.post('/register', async (req, res) => {
  const { email, password, full_name, invite_code } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' });

  // Enforce password complexity
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    const missing = [];
    if (!hasUpper) missing.push('one uppercase letter');
    if (!hasLower) missing.push('one lowercase letter');
    if (!hasNumber) missing.push('one number');
    if (!hasSpecial) missing.push('one special character');
    return res.status(400).json({ error: `Password must include at least ${missing.join(', ')}` });
  }

  // Enforce work email
  const personalDomains = ['gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','live.com','msn.com','protonmail.com','me.com'];
  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (!emailDomain || personalDomains.includes(emailDomain)) {
    return res.status(400).json({ error: 'Please use your work email address to sign up.' });
  }

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(400).json({ error: 'Unable to create account. Please try again or contact support.' });
    const hash = await bcrypt.hash(password, 12);

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
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = await createRefreshToken(user.id);
    res.json({ token, refreshToken, user: { ...user, onboarding_complete: false, org: orgData.rows[0] } });
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
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = await createRefreshToken(user.id);
    res.json({ token, refreshToken, user: { id: user.id, email: user.email, full_name: user.full_name, org_id: user.org_id, role: user.role, onboarding_complete: user.onboarding_complete || false, org: orgData?.rows[0] || null } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Refresh access token using a valid refresh token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
  try {
    const result = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token=$1 AND expires_at > NOW()',
      [refreshToken]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const rt = result.rows[0];

    // Rotate: delete old token and issue new pair
    await pool.query('DELETE FROM refresh_tokens WHERE id=$1', [rt.id]);
    const newAccessToken = jwt.sign({ userId: rt.user_id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const newRefreshToken = await createRefreshToken(rt.user_id);

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout: delete refresh token server-side
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await pool.query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken]).catch(() => {});
  }
  res.json({ success: true });
});

router.post('/complete-onboarding', require('../middleware/auth'), async (req, res) => {
  try {
    await pool.query('UPDATE users SET onboarding_complete=true WHERE id=$1', [req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/org', require('../middleware/auth'), async (req, res) => {
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId]);
    const u = userRes.rows[0];

    // Auto-create org if user doesn't have one (legacy accounts)
    if (!u.org_id) {
      const inviteCode = require('crypto').randomBytes(6).toString('hex');
      const newOrg = await pool.query(
        'INSERT INTO organizations (name, invite_code) VALUES ($1, $2) RETURNING id',
        [(u.full_name ? u.full_name + "'s Team" : 'My Team'), inviteCode]
      );
      const orgId = newOrg.rows[0].id;
      await pool.query('UPDATE users SET org_id=$1, role=$2 WHERE id=$3', [orgId, 'admin', req.userId]);
      const org = await pool.query('SELECT * FROM organizations WHERE id=$1', [orgId]);
      return res.json({ members: [{ ...u, org_id: orgId, role: 'admin' }], org: org.rows[0] });
    }

    const members = await pool.query(
      'SELECT id, email, full_name, role, created_at FROM users WHERE org_id=$1 ORDER BY created_at ASC',
      [u.org_id]
    );
    const org = await pool.query('SELECT * FROM organizations WHERE id=$1', [u.org_id]);
    res.json({ members: members.rows, org: org.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
