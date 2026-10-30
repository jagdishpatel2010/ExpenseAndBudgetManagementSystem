/**
 * PUT    /api/categories/:id - rename/update a user-owned category.
 * DELETE /api/categories/:id - delete a user-owned category.
 *
 * Only categories the user owns (user_id = req.user.id) can be modified here.
 * Global predefined categories (user_id IS NULL) are protected: attempts to
 * edit or delete them are rejected with 403, since they are admin-managed.
 */
const db = require('../../../lib/bootstrap');
const { tx } = require('../../../lib/db');
const { handler, sendSuccess, sendError, methodGuard, clientIp } = require('../../../lib/http');
const { requireAuth } = require('../../../lib/auth');
const { recordChange } = require('../../../lib/audit');
const { categorySchema, formatZodError } = require('../../../lib/validation');

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['PUT', 'DELETE'])) return;

    const { id } = req.query;
    if (!/^\d+$/.test(String(id))) {
      sendError(res, 404, 'Category not found');
      return;
    }

    const category = db
      .prepare('SELECT * FROM categories WHERE id = ?')
      .get(Number(id));
    if (!category) {
      sendError(res, 404, 'Category not found');
      return;
    }
    // Protect global predefined categories from end-user modification.
    if (category.user_id === null || category.user_id !== req.user.id) {
      sendError(res, 403, 'You cannot modify this category');
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
      sendSuccess(res, { message: 'Category deleted' });
      return;
    }

    // ---- PUT ----
    const parsed = categorySchema.partial().safeParse(req.body || {});
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
      return;
    }
    const name = parsed.data.name ?? category.name;
    const type = parsed.data.type ?? category.type;
    const icon = parsed.data.icon ?? category.icon;

    const updated = tx(() => {
      db.prepare(
        'UPDATE categories SET name = ?, type = ?, icon = ? WHERE id = ?'
      ).run(name, type, icon, category.id);
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
