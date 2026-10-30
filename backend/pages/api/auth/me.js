/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's profile. Used by the mobile app on
 * startup to validate a stored token and restore the session. Protected by
 * `requireAuth`, which rejects missing/invalid/expired tokens with 401.
 */
const db = require('../../../lib/bootstrap');
const { handler, sendSuccess, sendError, methodGuard } = require('../../../lib/http');
const { requireAuth } = require('../../../lib/auth');

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['GET'])) return;

    const user = db
      .prepare('SELECT id, name, email, role, currency, created_at FROM users WHERE id = ?')
      .get(req.user.id);

    if (!user) {
      sendError(res, 404, 'User not found');
      return;
    }
    sendSuccess(res, { user });
  })
);
