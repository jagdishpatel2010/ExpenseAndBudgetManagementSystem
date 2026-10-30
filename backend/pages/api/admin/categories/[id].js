/**
 * PUT    /api/admin/categories/:id  (admin only) - update a predefined category.
 * DELETE /api/admin/categories/:id  (admin only) - delete a predefined category.
 *
 * Operates only on global predefined categories (user_id IS NULL). Changes are
 * audited with the acting admin recorded as the actor.
 */
const db = require('../../../../lib/bootstrap');
const { tx } = require('../../../../lib/db');
const { handler, sendSuccess, sendError, methodGuard, clientIp } = require('../../../../lib/http');
const { requireAdmin } = require('../../../../lib/auth');
const { recordChange } = require('../../../../lib/audit');
const { categorySchema, formatZodError } = require('../../../../lib/validation');

export default handler(
  requireAdmin(async (req, res) => {
    if (!methodGuard(req, res, ['PUT', 'DELETE'])) return;

    const { id } = req.query;
    if (!/^\d+$/.test(String(id))) {
      sendError(res, 404, 'Category not found');
      return;
    }
    const category = db
      .prepare('SELECT * FROM categories WHERE id = ? AND user_id IS NULL')
      .get(Number(id));
    if (!category) {
      sendError(res, 404, 'Predefined category not found');
      return;
    }

    if (req.method === 'DELETE') {
      tx(() => {
        db.prepare('DELETE FROM categories WHERE id = ?').run(category.id);
        recordChange({
          entityType: 'category',
          entityId: category.id,
          operation: 'DELETE',
          before: category,
          actor: { id: req.user.id, email: req.user.email },
          sourceIp: clientIp(req),
        });
      });
      sendSuccess(res, { message: 'Predefined category deleted' });
      return;
    }

    const parsed = categorySchema.partial().safeParse(req.body || {});
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
      return;
    }
    const name = parsed.data.name ?? category.name;
    const type = parsed.data.type ?? category.type;
    const icon = parsed.data.icon ?? category.icon;

    const updated = tx(() => {
      db.prepare('UPDATE categories SET name = ?, type = ?, icon = ? WHERE id = ?').run(
        name,
        type,
        icon,
        category.id
      );
      const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(category.id);
      recordChange({
        entityType: 'category',
        entityId: category.id,
        operation: 'UPDATE',
        before: category,
        after: row,
        actor: { id: req.user.id, email: req.user.email },
        sourceIp: clientIp(req),
      });
      return row;
    });

    sendSuccess(res, { category: updated });
  })
);
