/**
 * POST /api/profile/password
 *
 * Changes the authenticated user's password. Requires the current password to
 * be supplied and verified before setting the new one, so a stolen token alone
 * cannot silently change the password without knowing the old one.
 *
 * The audit record intentionally stores NO password values (they are redacted
 * by the audit service regardless); it only records that a change happened.
 */
const db = require('../../../lib/bootstrap');
const { tx } = require('../../../lib/db');
const { handler, sendSuccess, sendError, methodGuard, clientIp } = require('../../../lib/http');
const { requireAuth, verifyPassword, hashPassword } = require('../../../lib/auth');
const { recordChange } = require('../../../lib/audit');
const { changePasswordSchema, formatZodError } = require('../../../lib/validation');
const logger = require('../../../lib/logger');

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['POST'])) return;

    const parsed = changePasswordSchema.safeParse(req.body || {});
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
      return;
    }
    const { currentPassword, newPassword } = parsed.data;

    const user = db
      .prepare('SELECT id, email, password_hash FROM users WHERE id = ?')
      .get(req.user.id);
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      sendError(res, 400, 'Current password is incorrect');
      return;
    }

    const newHash = await hashPassword(newPassword);
    tx(() => {
      db.prepare(
        "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newHash, req.user.id);
      recordChange({
        entityType: 'user',
        entityId: req.user.id,
        operation: 'UPDATE',
        // Values are redacted by the audit service; we note the event only.
        before: { password_hash: '***' },
        after: { password_hash: '***' },
        actor: { id: req.user.id, email: req.user.email },
        sourceIp: clientIp(req),
      });
    });

    logger.info('password_changed', { user_id: req.user.id });
    sendSuccess(res, { message: 'Password updated successfully' });
  })
);
