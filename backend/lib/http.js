/**
 * HTTP helpers for API routes.
 *
 * Centralizes:
 * - consistent JSON success/error envelopes
 * - CORS handling for the React Native client
 * - a `handler` wrapper that catches unexpected errors so stack traces are
 *   logged server-side and NEVER leaked to the client.
 */

const logger = require('./logger');

/**
 * Apply permissive CORS headers. The mobile client runs on a different origin
 * (Expo dev server / device), so the API must allow cross-origin requests.
 * @param {import('next').NextApiResponse} res
 */
function applyCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/** Send a standardized success response. */
function sendSuccess(res, data = null, status = 200) {
  res.status(status).json({ success: true, data });
}

/** Send a standardized error response with a client-safe message. */
function sendError(res, status, message, details = undefined) {
  res.status(status).json({ success: false, error: message, details });
}

/**
 * Wrap an API handler with CORS, method OPTIONS short-circuit, and a top-level
 * try/catch. Unexpected errors are logged with full detail and returned to the
 * client as a generic message (no stack traces, no internal details).
 *
 * @param {(req, res) => Promise<void>|void} fn The route logic.
 * @returns {(req, res) => Promise<void>} Wrapped handler.
 */
function handler(fn) {
  return async (req, res) => {
    applyCors(res);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    try {
      await fn(req, res);
    } catch (err) {
      // Log full detail server-side only.
      logger.error('unhandled_api_error', {
        path: req.url,
        method: req.method,
        message: err.message,
        stack: err.stack,
      });
      if (!res.headersSent) {
        sendError(res, 500, 'An unexpected error occurred. Please try again.');
      }
    }
  };
}

/**
 * Enforce that the request uses one of the allowed HTTP methods.
 * @returns {boolean} true if allowed; otherwise sends 405 and returns false.
 */
function methodGuard(req, res, allowed) {
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    sendError(res, 405, `Method ${req.method} not allowed`);
    return false;
  }
  return true;
}

/** Extract the best-effort client IP for audit context. */
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.socket ? req.socket.remoteAddress : null;
}

module.exports = {
  applyCors,
  sendSuccess,
  sendError,
  handler,
  methodGuard,
  clientIp,
};
