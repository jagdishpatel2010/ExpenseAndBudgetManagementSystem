/**
 * GET  /api/support - list the current user's own support requests.
 * POST /api/support - create a new support request.
 *
 * Users only ever see their own tickets here. Admins review tickets through
 * the separate /api/admin/support endpoint.
 */
const db = require('../../lib/bootstrap');
const { handler, sendSuccess, sendError, methodGuard } = require('../../lib/http');
const { requireAuth } = require('../../lib/auth');
const { supportSchema, formatZodError } = require('../../lib/validation');
const logger = require('../../lib/logger');

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['GET', 'POST'])) return;

    if (req.method === 'GET') {
      const rows = db
        .prepare(
          `SELECT id, subject, message, status, created_at AS createdAt
             FROM support_requests WHERE user_id = ?
            ORDER BY created_at DESC`
        )
        .all(req.user.id);
      sendSuccess(res, { requests: rows });
      return;
    }

    const parsed = supportSchema.safeParse(req.body || {});
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
      return;
    }
    const { subject, message } = parsed.data;
    const result = db
      .prepare(
        'INSERT INTO support_requests (user_id, subject, message) VALUES (?, ?, ?)'
      )
      .run(req.user.id, subject, message);

    logger.info('support_request_created', {
      user_id: req.user.id,
      id: Number(result.lastInsertRowid),
    });
    sendSuccess(
      res,
      { request: { id: Number(result.lastInsertRowid), subject, message, status: 'open' } },
      201
    );
  })
);
