/**
 * GET  /api/admin/support         (admin only) - list all support requests.
 * POST /api/admin/support?id=..   (admin only) - mark a request resolved.
 *
 * Admins manage support tickets here. Tickets contain only the subject and
 * message the user chose to share plus the user's email for follow-up; they do
 * NOT expose the user's transaction data, preserving the privacy requirement.
 */
const db = require('../../../lib/bootstrap');
const { handler, sendSuccess, sendError, methodGuard } = require('../../../lib/http');
const { requireAdmin } = require('../../../lib/auth');
const logger = require('../../../lib/logger');

export default handler(
  requireAdmin(async (req, res) => {
    if (!methodGuard(req, res, ['GET', 'POST'])) return;

    if (req.method === 'GET') {
      const rows = db
        .prepare(
          `SELECT s.id, s.subject, s.message, s.status, s.created_at AS createdAt,
                  u.email AS userEmail, u.name AS userName
             FROM support_requests s
             JOIN users u ON u.id = s.user_id
            ORDER BY s.status = 'open' DESC, s.created_at DESC`
        )
        .all();
      sendSuccess(res, { requests: rows });
      return;
    }

    // POST - resolve a ticket.
    const { id } = req.query;
    if (!/^\d+$/.test(String(id))) {
      sendError(res, 404, 'Support request not found');
      return;
    }
    const ticket = db
      .prepare('SELECT id FROM support_requests WHERE id = ?')
      .get(Number(id));
    if (!ticket) {
      sendError(res, 404, 'Support request not found');
      return;
    }
    db.prepare("UPDATE support_requests SET status = 'resolved' WHERE id = ?").run(
      ticket.id
    );
    logger.info('support_request_resolved', {
      admin_id: req.user.id,
      ticket_id: ticket.id,
    });
    sendSuccess(res, { message: 'Support request resolved' });
  })
);
