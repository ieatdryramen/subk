const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');
const { createRefreshToken, invalidateAllUserTokens } = require('./auth-helpers');
const { logAudit } = require('../middleware/audit');
const { loginLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const { validateRegister, validateLogin } = require('../middleware/validate');
const { generateCsrfToken } = require('../middleware/csrf');
const auth = require('../middleware/auth');

const ACCESS_TOKEN_EXPIRY = '2h';

// ── Helper: record login to login_history ──
async function recordLogin(userId, req, success) {
  try {
    await pool.query(
      `INSERT INTO login_history (user_id, ip_address, user_agent, success)
       VALUES ($1, $2, $3, $4)`,
      [userId, req.ip, (req.headers['user-agent'] || '').substring(0, 500), success]
    );
  } catch (err) {
    console.error('[LOGIN_HISTORY] Failed:', err.message);
  }
}

// ── Helper: detect suspicious login ──
async function checkSuspiciousLogin(userId, req) {
  try {
    const recent = await pool.query(
      `SELECT DISTINCT ip_address FROM login_history
       WHERE user_id=$1 AND success=true
       ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );
    const knownIps = recent.rows.map(r => r.ip_address);
    if (knownIps.length > 0 && !knownIps.includes(req.ip)) {
      // New IP detected — log warning
      console.warn(`[SECURITY] New IP login for user ${userId}: ${req.ip} (known: ${knownIps.join(', ')})`);
      await logAudit({
        userId,
        action: 'suspicious_login',
        resourceType: 'user',
        resourceId: userId,
        ipAddress: req.ip,
        details: { newIp: req.ip, knownIps, userAgent: req.headers['user-agent'] },
      });
      return true;
    }
  } catch (err) {
    console.error('[SUSPICIOUS_CHECK] Error:', err.message);
  }
  return false;
}

// ── POST /auth/register ──
router.post('/register', validateRegister, async (req, res) => {
  const { email, password, full_name, invite_code } = req.body;

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
    let role = 'admin'; // First user in org gets admin

    if (invite_code) {
      const org = await pool.query('SELECT id FROM organizations WHERE invite_code=$1', [invite_code]);
      if (!org.rows.length) return res.status(400).json({ error: 'Invalid invite code' });
      org_id = org.rows[0].id;
      role = 'analyst'; // Invited users default to analyst
    } else {
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

    const orgData = await pool.query('SELECT invite_code, name FROM organizations WHERE id=$1', [org_id]);
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = await createRefreshToken(user.id);
    const csrfToken = generateCsrfToken(user.id);

    await logAudit({ userId: user.id, action: 'create', resourceType: 'user', resourceId: user.id, ipAddress: req.ip, details: { email } });
    await recordLogin(user.id, req, true);

    res.json({ token, refreshToken, csrfToken, user: { ...user, onboarding_complete: false, org: orgData.rows[0] } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /auth/login ──
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    if (!user) {
      await logAudit({ userId: null, action: 'failed_auth', resourceType: 'user', ipAddress: req.ip, details: { email, reason: 'user_not_found' } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await recordLogin(user.id, req, false);
      await logAudit({ userId: user.id, action: 'failed_auth', resourceType: 'user', resourceId: user.id, ipAddress: req.ip, details: { reason: 'wrong_password' } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if 2FA is enabled
    if (user.two_fa_enabled) {
      // Issue a short-lived pending token (5 min) instead of full access
      const tempToken = jwt.sign({ userId: user.id, pending2fa: true }, process.env.JWT_SECRET, { expiresIn: '5m' });
      return res.json({ requires2fa: true, tempToken });
    }

    const orgData = user.org_id ? await pool.query('SELECT invite_code, name FROM organizations WHERE id=$1', [user.org_id]) : null;
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = await createRefreshToken(user.id);
    const csrfToken = generateCsrfToken(user.id);

    await recordLogin(user.id, req, true);
    await checkSuspiciousLogin(user.id, req);
    await logAudit({ userId: user.id, action: 'login', resourceType: 'user', resourceId: user.id, ipAddress: req.ip });

    res.json({
      token, refreshToken, csrfToken,
      user: { id: user.id, email: user.email, full_name: user.full_name, org_id: user.org_id, role: user.role, onboarding_complete: user.onboarding_complete || false, org: orgData?.rows[0] || null },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /auth/refresh ──
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
    await pool.query('DELETE FROM refresh_tokens WHERE id=$1', [rt.id]);
    const newAccessToken = jwt.sign({ userId: rt.user_id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const newRefreshToken = await createRefreshToken(rt.user_id);
    const csrfToken = generateCsrfToken(rt.user_id);

    res.json({ token: newAccessToken, refreshToken: newRefreshToken, csrfToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /auth/logout ──
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await pool.query('DELETE FROM refresh_tokens WHERE token=$1', [refreshToken]).catch(() => {});
  }
  // If authenticated, log it
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      await logAudit({ userId: decoded.userId, action: 'logout', resourceType: 'user', resourceId: decoded.userId, ipAddress: req.ip });
    }
  } catch {}
  res.json({ success: true });
});

// ── POST /auth/change-password ──
router.post('/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
  if (newPassword.length < 12) return res.status(400).json({ error: 'New password must be at least 12 characters' });

  // Validate complexity
  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must include uppercase, lowercase, number, and special character' });
  }

  try {
    const userR = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.userId]);
    if (!userR.rows.length) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, userR.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.userId]);

    // Invalidate ALL refresh tokens — force re-auth on all devices
    await invalidateAllUserTokens(req.userId);

    await logAudit({
      userId: req.userId, action: 'settings_change', resourceType: 'user',
      resourceId: req.userId, ipAddress: req.ip, details: { change: 'password_changed' },
    });

    // Issue a new token pair for current session
    const token = jwt.sign({ userId: req.userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = await createRefreshToken(req.userId);
    const csrfToken = generateCsrfToken(req.userId);

    res.json({ success: true, token, refreshToken, csrfToken, message: 'Password changed. All other sessions have been logged out.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /auth/csrf-token — Get a fresh CSRF token ──
router.get('/csrf-token', auth, (req, res) => {
  const csrfToken = generateCsrfToken(req.userId);
  res.json({ csrfToken });
});

router.post('/complete-onboarding', auth, async (req, res) => {
  try {
    await pool.query('UPDATE users SET onboarding_complete=true WHERE id=$1', [req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/org', auth, async (req, res) => {
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [req.userId]);
    const u = userRes.rows[0];

    if (!u.org_id) {
      const inviteCode = crypto.randomBytes(6).toString('hex');
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
