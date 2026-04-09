const crypto = require('crypto');

// CSRF token store — maps token to { userId, createdAt }
// In production, replace with Redis for multi-instance support
const csrfTokens = new Map();

// Clean expired tokens every 30 min
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24h
  for (const [token, meta] of csrfTokens) {
    if (now - meta.createdAt > maxAge) csrfTokens.delete(token);
  }
}, 30 * 60 * 1000);

// Generate a CSRF token for the current user
function generateCsrfToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, { userId, createdAt: Date.now() });
  return token;
}

// Middleware: validate CSRF token on state-changing requests
function csrfProtection(req, res, next) {
  // Skip safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  // Skip routes that don't need CSRF (webhooks, auth login/register/refresh)
  const skipPaths = ['/api/billing/webhook', '/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout', '/api/auth/complete-onboarding'];
  if (skipPaths.some(p => req.path.startsWith(p))) return next();

  const token = req.headers['x-csrf-token'];
  if (!token) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  const meta = csrfTokens.get(token);
  if (!meta) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  // Token must be < 24h old
  if (Date.now() - meta.createdAt > 24 * 60 * 60 * 1000) {
    csrfTokens.delete(token);
    return res.status(403).json({ error: 'CSRF token expired' });
  }

  // Token must belong to the requesting user (if authenticated)
  if (req.userId && meta.userId && meta.userId !== req.userId) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }

  next();
}

module.exports = { generateCsrfToken, csrfProtection, csrfTokens };
