const { pool } = require('../db');

/**
 * Log an audit event. Call directly from route handlers for fine-grained control.
 * @param {Object} params
 * @param {number} params.userId - The user performing the action (null for unauthenticated)
 * @param {string} params.action - Action name: login, logout, create, update, delete, settings_change, failed_auth
 * @param {string} params.resourceType - Resource: user, lead, list, proposal, opportunity, settings, etc.
 * @param {number|string} [params.resourceId] - ID of the affected resource
 * @param {string} [params.ipAddress] - Client IP
 * @param {Object} [params.details] - Additional JSONB details
 */
async function logAudit({ userId, action, resourceType, resourceId = null, ipAddress = null, details = null }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, resourceType, resourceId, ipAddress, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    // Never let audit logging crash the request
    console.error('[AUDIT] Failed to log:', err.message);
  }
}

/**
 * Express middleware that auto-logs write operations.
 * Attach after auth middleware so req.userId is available.
 * For detailed logging, call logAudit() directly in route handlers instead.
 */
function auditMiddleware(resourceType) {
  return (req, res, next) => {
    // Only log state-changing methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    // Capture the original res.json to log after response
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Only log successful writes
      if (res.statusCode < 400) {
        const action = req.method === 'POST' ? 'create'
          : req.method === 'PUT' || req.method === 'PATCH' ? 'update'
          : req.method === 'DELETE' ? 'delete' : req.method.toLowerCase();

        logAudit({
          userId: req.userId || null,
          action,
          resourceType,
          resourceId: req.params.id || body?.id || null,
          ipAddress: req.ip,
          details: { method: req.method, path: req.path },
        });
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { logAudit, auditMiddleware };
