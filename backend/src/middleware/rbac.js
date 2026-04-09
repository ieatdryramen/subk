const { pool } = require('../db');

/**
 * Role hierarchy and permissions matrix
 * admin:   full access — manage team, settings, all data
 * manager: team data (read), own data (CRUD), can view shared resources
 * analyst: own data (CRUD), read shared resources
 * viewer:  read-only access to own + shared resources
 */
const ROLE_HIERARCHY = { admin: 4, manager: 3, analyst: 2, viewer: 1 };

const PERMISSIONS = {
  // Resource: { action: minimum role level }
  admin_dashboard:    { read: 'admin' },
  admin_settings:     { read: 'admin', write: 'admin' },
  team_members:       { read: 'manager', write: 'admin' },
  leads:              { read: 'viewer', write: 'analyst' },
  lists:              { read: 'viewer', write: 'analyst' },
  playbooks:          { read: 'viewer', write: 'analyst' },
  proposals:          { read: 'viewer', write: 'analyst' },
  opportunities:      { read: 'viewer', write: 'analyst' },
  competitive_intel:  { read: 'viewer', write: 'analyst' },
  marketplace:        { read: 'viewer', write: 'analyst' },
  sub_profile:        { read: 'viewer', write: 'analyst' },
  notifications:      { read: 'viewer', write: 'analyst' },
  billing:            { read: 'admin', write: 'admin' },
  audit_logs:         { read: 'admin' },
  export:             { read: 'analyst' },
  settings:           { read: 'viewer', write: 'admin' },
};

/**
 * Check if a role meets the minimum required role
 */
function hasPermission(userRole, requiredRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || Infinity);
}

/**
 * Middleware factory: require specific permission for a resource+action
 * Usage: rbac('leads', 'write') or rbac('admin_dashboard', 'read')
 */
function rbac(resource, action = 'read') {
  return async (req, res, next) => {
    try {
      const userR = await pool.query('SELECT role FROM users WHERE id=$1', [req.userId]);
      const userRole = userR.rows[0]?.role || 'viewer';
      req.userRole = userRole;

      const perm = PERMISSIONS[resource];
      if (!perm || !perm[action]) {
        // No permission defined = deny by default
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!hasPermission(userRole, perm[action])) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (err) {
      console.error('[RBAC] Error:', err.message);
      res.status(500).json({ error: 'Server error' });
    }
  };
}

/**
 * Legacy adminOnly — equivalent to rbac('admin_dashboard', 'read')
 */
const adminOnly = async (req, res, next) => {
  const user = await pool.query('SELECT role FROM users WHERE id=$1', [req.userId]);
  if (user.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  req.userRole = 'admin';
  next();
};

module.exports = { rbac, adminOnly, hasPermission, PERMISSIONS, ROLE_HIERARCHY };
