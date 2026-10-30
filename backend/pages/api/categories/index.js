/**
 * GET  /api/categories  - list categories available to the user.
 * POST /api/categories  - create a custom category owned by the user.
 *
 * "Available" categories are the global predefined ones (user_id IS NULL) plus
 * the user's own custom categories. Creating a category here always assigns it
 * to the current user; global predefined categories are managed by admins via
 * the /api/admin/categories endpoints.
 */
const db = require('../../../lib/bootstrap');
const { tx } = require('../../../lib/db');
const { handler, sendSuccess, sendError, methodGuard, clientIp } = require('../../../lib/http');
const { requireAuth } = require('../../../lib/auth');
const { recordChange } = require('../../../lib/audit');
const { categorySchema, formatZodError } = require('../../../lib/validation');

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['GET', 'POST'])) return;

    if (req.method === 'GET') {
      const rows = db
        .prepare(
          `SELECT id, name, type, icon, is_predefined AS isPredefined,
                  (user_id IS NOT NULL) AS isOwn
             FROM categories
            WHERE user_id IS NULL OR user_id = ?
            ORDER BY is_predefined DESC, name`
        )
        .all(req.user.id);
      // Optionally filter by type via ?type=expense|income
      const type = req.query.type;
      const filtered =
        type === 'income' || type === 'expense'
          ? rows.filter((r) => r.type === type)
          : rows;
      sendSuccess(res, { categories: filtered });
      return;
    }

    // ---- POST: create a user-owned category ----
    const parsed = categorySchema.safeParse(req.body || {});
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
      return;
    }
    const { name, type, icon } = parsed.data;

    // Prevent duplicate names within the user's own categories.
    const duplicate = db
      .prepare(
        'SELECT id FROM categories WHERE user_id = ? AND lower(name) = lower(?)'
      )
      .get(req.user.id, name);
    if (duplicate) {
      sendError(res, 409, 'You already have a category with this name');
      return;
    }

    const created = tx(() => {
      const result = db
        .prepare(
          'INSERT INTO categories (user_id, name, type, icon, is_predefined) VALUES (?, ?, ?, ?, 0)'
        )
        .run(req.user.id, name, type, icon || 'tag');
      const id = Number(result.lastInsertRowid);
      const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
      recordChange({
        entityType: 'category',
        entityId: id,
        operation: 'CREATE',
        after: row,
        actor: { id: req.user.id, email: req.user.email },
        sourceIp: clientIp(req),
      });
      return row;
    });

    sendSuccess(res, { category: created }, 201);
  })
);
