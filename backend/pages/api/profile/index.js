/**
 * GET  /api/profile  - fetch the current user's profile.
 * PUT  /api/profile  - update name and/or preferred currency.
 *
 * All operations are scoped to the authenticated user (req.user.id); a user
 * can never read or modify another user's profile. Updates are audited.
 */
const db = require('../../../lib/bootstrap');
const { tx } = require('../../../lib/db');
const { handler, sendSuccess, sendError, methodGuard, clientIp } = require('../../../lib/http');
const { requireAuth } = require('../../../lib/auth');
const { recordChange } = require('../../../lib/audit');
const { updateProfileSchema, formatZodError } = require('../../../lib/validation');

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['GET', 'PUT'])) return;

    if (req.method === 'GET') {
      const user = db
        .prepare('SELECT id, name, email, role, currency, created_at FROM users WHERE id = ?')
        .get(req.user.id);
      sendSuccess(res, { user });
      return;
    }

    // PUT - partial update of name/currency.
    const parsed = updateProfileSchema.safeParse(req.body || {});
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
      return;
    }

    const before = db
      .prepare('SELECT id, name, email, currency FROM users WHERE id = ?')
      .get(req.user.id);
    if (!before) {
      sendError(res, 404, 'User not found');
      return;
    }

    // Only overwrite fields the client actually supplied.
    const name = parsed.data.name ?? before.name;
    const currency = parsed.data.currency ?? before.currency;

    const after = tx(() => {
      db.prepare(
        "UPDATE users SET name = ?, currency = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(name, currency, req.user.id);
      const updated = db
        .prepare('SELECT id, name, email, role, currency FROM users WHERE id = ?')
        .get(req.user.id);
      recordChange({
        entityType: 'user',
        entityId: req.user.id,
        operation: 'UPDATE',
        before,
        after: updated,
        actor: { id: req.user.id, email: req.user.email },
        sourceIp: clientIp(req),
      });
      return updated;
    });

    sendSuccess(res, { user: after });
  })
);
