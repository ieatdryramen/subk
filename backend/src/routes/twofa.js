const router = require('express').Router();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const auth = require('../middleware/auth');
const { pool } = require('../db');
const { logAudit } = require('../middleware/audit');

// POST /api/auth/2fa/setup — Generate secret + QR code
router.post('/setup', auth, async (req, res) => {
  try {
    const userR = await pool.query('SELECT email, two_fa_enabled FROM users WHERE id=$1', [req.userId]);
    const user = userR.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.two_fa_enabled) return res.status(400).json({ error: '2FA is already enabled' });

    const secret = speakeasy.generateSecret({
      name: `SumX CRM (${user.email})`,
      issuer: 'SumX CRM',
    });

    // Store temp secret (not yet verified)
    await pool.query('UPDATE users SET two_fa_secret=$1 WHERE id=$2', [secret.base32, req.userId]);

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrDataUrl,
      otpauthUrl: secret.otpauth_url,
    });
  } catch (err) {
    console.error('2FA setup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/2fa/verify — Verify TOTP code and enable 2FA
router.post('/verify', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Verification code required' });

    const userR = await pool.query('SELECT two_fa_secret, two_fa_enabled FROM users WHERE id=$1', [req.userId]);
    const user = userR.rows[0];
    if (!user?.two_fa_secret) return res.status(400).json({ error: 'Run 2FA setup first' });
    if (user.two_fa_enabled) return res.status(400).json({ error: '2FA is already enabled' });

    const verified = speakeasy.totp.verify({
      secret: user.two_fa_secret,
      encoding: 'base32',
      token: code,
      window: 1, // Allow 1 step tolerance (30s each direction)
    });

    if (!verified) return res.status(400).json({ error: 'Invalid verification code' });

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      require('crypto').randomBytes(4).toString('hex')
    );
    const hashedBackups = backupCodes.map(c =>
      require('crypto').createHash('sha256').update(c).digest('hex')
    );

    await pool.query(
      'UPDATE users SET two_fa_enabled=true, two_fa_backup_codes=$1 WHERE id=$2',
      [JSON.stringify(hashedBackups), req.userId]
    );

    await logAudit({
      userId: req.userId,
      action: 'settings_change',
      resourceType: 'user',
      resourceId: req.userId,
      ipAddress: req.ip,
      details: { change: '2fa_enabled' },
    });

    res.json({ success: true, backupCodes });
  } catch (err) {
    console.error('2FA verify error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/2fa/disable — Disable 2FA (requires current code)
router.post('/disable', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Current 2FA code required to disable' });

    const userR = await pool.query('SELECT two_fa_secret, two_fa_enabled FROM users WHERE id=$1', [req.userId]);
    const user = userR.rows[0];
    if (!user?.two_fa_enabled) return res.status(400).json({ error: '2FA is not enabled' });

    const verified = speakeasy.totp.verify({
      secret: user.two_fa_secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) return res.status(400).json({ error: 'Invalid 2FA code' });

    await pool.query(
      'UPDATE users SET two_fa_enabled=false, two_fa_secret=NULL, two_fa_backup_codes=NULL WHERE id=$1',
      [req.userId]
    );

    await logAudit({
      userId: req.userId,
      action: 'settings_change',
      resourceType: 'user',
      resourceId: req.userId,
      ipAddress: req.ip,
      details: { change: '2fa_disabled' },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('2FA disable error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/2fa/validate — Validate TOTP during login (called from login flow)
router.post('/validate', async (req, res) => {
  // This is called after initial login credentials are verified
  // The frontend sends a temporary login token + 2FA code
  const { tempToken, code } = req.body;
  if (!tempToken || !code) return res.status(400).json({ error: 'Token and code required' });

  try {
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    if (!decoded.pending2fa) return res.status(400).json({ error: 'Not a 2FA pending token' });

    const userR = await pool.query('SELECT id, two_fa_secret, two_fa_backup_codes FROM users WHERE id=$1', [decoded.userId]);
    const user = userR.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Try TOTP first
    let verified = speakeasy.totp.verify({
      secret: user.two_fa_secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    // If TOTP fails, try backup codes
    if (!verified && user.two_fa_backup_codes) {
      const crypto = require('crypto');
      const hashedInput = crypto.createHash('sha256').update(code).digest('hex');
      const backups = JSON.parse(user.two_fa_backup_codes);
      const idx = backups.indexOf(hashedInput);
      if (idx !== -1) {
        verified = true;
        // Remove used backup code
        backups.splice(idx, 1);
        await pool.query('UPDATE users SET two_fa_backup_codes=$1 WHERE id=$2',
          [JSON.stringify(backups), user.id]);
      }
    }

    if (!verified) return res.status(401).json({ error: 'Invalid 2FA code' });

    // Issue real access + refresh tokens
    const { createRefreshToken } = require('./auth-helpers');
    const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '2h' });
    const refreshToken = await createRefreshToken(user.id);

    // Get full user data for response
    const fullUser = await pool.query(
      'SELECT id, email, full_name, org_id, role, onboarding_complete FROM users WHERE id=$1',
      [user.id]
    );
    const orgData = fullUser.rows[0].org_id
      ? await pool.query('SELECT invite_code, name FROM organizations WHERE id=$1', [fullUser.rows[0].org_id])
      : null;

    res.json({
      token: accessToken,
      refreshToken,
      user: { ...fullUser.rows[0], onboarding_complete: fullUser.rows[0].onboarding_complete || false, org: orgData?.rows[0] || null },
    });
  } catch (err) {
    console.error('2FA validate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
