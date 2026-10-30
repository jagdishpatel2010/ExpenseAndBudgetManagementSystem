/**
 * GET  /api/notifications       - list the user's notifications (newest first).
 * POST /api/notifications/read  (handled here via ?action=readAll) - mark all read.
 *
 * Budget alerts and reminders are created server-side by the budget module;
 * this endpoint lets the app display and manage them. Scoped to req.user.id.
 */
const db = require('../../../lib/bootstrap');
const { handler, sendSuccess, methodGuard } = require('../../../lib/http');
const { requireAuth } = require('../../../lib/auth');

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['GET', 'POST'])) return;

    if (req.method === 'POST') {
      // Mark every notification for this user as read.
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(
        req.user.id
      );
      sendSuccess(res, { message: 'All notifications marked as read' });
      return;
    }

    const rows = db
      .prepare(
        `SELECT id, title, body, type, is_read AS isRead, created_at AS createdAt
           FROM notifications
          WHERE user_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT 100`
      )
      .all(req.user.id);
    const unread = rows.filter((r) => r.isRead === 0).length;

    sendSuccess(res, { notifications: rows, unread });
  })
);
