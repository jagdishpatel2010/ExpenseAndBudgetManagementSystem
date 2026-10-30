/**
 * Authentication & authorization helpers (Security skill).
 *
 * - Passwords are hashed with bcrypt (never stored or logged in plaintext).
 * - Access is granted via signed JWTs. The secret is read from the environment
 *   and the process refuses to start auth operations without it.
 * - `requireAuth` / `requireAdmin` wrap handlers to enforce authentication and
 *   role-based access control.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendError } = require('./http');
const logger = require('./logger');

// Fail fast if the signing secret is missing - never fall back to a default.
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN || '3600', 10);

if (!JWT_SECRET) {
  // This is a configuration error, surfaced loudly at import time.
  logger.error('config_error', { message: 'JWT_SECRET is not set' });
  throw new Error('JWT_SECRET environment variable is required');
}

/** Hash a plaintext password with bcrypt (cost factor 10). */
async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

/** Compare a plaintext password against a stored bcrypt hash. */
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/**
 * Issue a signed JWT for a user. The payload intentionally contains only
 * non-sensitive identifiers (no password, no PII beyond email/role).
 */
function issueToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify and decode a bearer token from the Authorization header.
 * @returns {object|null} Decoded payload, or null if missing/invalid/expired.
 */
function decodeFromRequest(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    // Invalid/expired token - do not leak details to the client.
    logger.warn('token_verification_failed', { reason: err.name });
    return null;
  }
}

/**
 * Higher-order wrapper enforcing authentication. On success, attaches
 * `req.user = { id, email, role, name }` and calls the inner handler.
 */
function requireAuth(fn) {
  return async (req, res) => {
    const payload = decodeFromRequest(req);
    if (!payload) {
      sendError(res, 401, 'Authentication required');
      return;
    }
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
    return fn(req, res);
  };
}

/**
 * Higher-order wrapper enforcing an authenticated admin. Non-admins receive
 * 403 so a regular user can never reach admin-only endpoints.
 */
function requireAdmin(fn) {
  return requireAuth(async (req, res) => {
    if (req.user.role !== 'admin') {
      logger.warn('admin_access_denied', { user_id: req.user.id });
      sendError(res, 403, 'Administrator access required');
      return;
    }
    return fn(req, res);
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  issueToken,
  decodeFromRequest,
  requireAuth,
  requireAdmin,
};
