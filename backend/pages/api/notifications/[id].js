/**
 * POST   /api/notifications/:id  - mark a single notification as read.
 * DELETE /api/notifications/:id  - delete a notification.
 *
 * Both operations are scoped to the owner so a user cannot touch another
 * user's notifications.
 */
const db = require('../../../lib/bootstrap');
const { handler, sendSuccess, sendError, methodGuard } = require('../../../lib/http');
const { requireAuth } = require('../../../lib/auth');

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['POST', 'DELETE'])) return;

    const { id } = req.query;
    if (!/^\d+$/.test(String(id))) {
      sendError(res, 404, 'Notification not found');
      return;
    }
    const notif = db
      .prepare('SELECT id FROM notifications WHERE id = ? AND user_id = ?')
      .get(Number(id), req.user.id);
    if (!notif) {
      sendError(res, 404, 'Notification not found');
      return;
    }

    if (req.method === 'DELETE') {
      db.prepare('DELETE FROM notifications WHERE id = ?').run(notif.id);
      sendSuccess(res, { message: 'Notification deleted' });
      return;
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notif.id);
    sendSuccess(res, { message: 'Notification marked as read' });
  })
);
