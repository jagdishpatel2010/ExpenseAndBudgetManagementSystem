/**
 * GET  /api/admin/categories  (admin only) - list global predefined categories.
 * POST /api/admin/categories  (admin only) - create a global predefined category.
 *
 * Predefined categories have user_id NULL and are shared by all users. Only
 * administrators manage them. All changes are audited with the admin as actor.
 */
const db = require('../../../../lib/bootstrap');
const { tx } = require('../../../../lib/db');
const { handler, sendSuccess, sendError, methodGuard, clientIp } = require('../../../../lib/http');
const { requireAdmin } = require('../../../../lib/auth');
const { recordChange } = require('../../../../lib/audit');
const { categorySchema, formatZodError } = require('../../../../lib/validation');

export default handler(
  requireAdmin(async (req, res) => {
    if (!methodGuard(req, res, ['GET', 'POST'])) return;

    if (req.method === 'GET') {
      const rows = db
        .prepare(
          `SELECT id, name, type, icon, created_at AS createdAt
             FROM categories WHERE user_id IS NULL ORDER BY name`
        )
        .all();
      sendSuccess(res, { categories: rows });
      return;
    }

    const parsed = categorySchema.safeParse(req.body || {});
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
      return;
    }
    const { name, type, icon } = parsed.data;

    const duplicate = db
      .prepare('SELECT id FROM categories WHERE user_id IS NULL AND lower(name) = lower(?)')
      .get(name);
    if (duplicate) {
      sendError(res, 409, 'A predefined category with this name already exists');
      return;
    }

    const created = tx(() => {
      const result = db
        .prepare(
          'INSERT INTO categories (user_id, name, type, icon, is_predefined) VALUES (NULL, ?, ?, ?, 1)'
        )
        .run(name, type, icon || 'tag');
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
