/**
 * GET    /api/transactions/:id  - fetch a single transaction (owner only).
 * PUT    /api/transactions/:id  - edit a transaction (owner only).
 * DELETE /api/transactions/:id  - delete a transaction (owner only).
 *
 * Every handler first loads the row scoped to req.user.id, so a user can never
 * read, edit or delete another user's transaction (object-level authorization).
 * Edits and deletes are audited with before/after snapshots, and budget alerts
 * are re-evaluated after changes that affect spending.
 */
const db = require('../../../lib/bootstrap');
const { tx } = require('../../../lib/db');
const { handler, sendSuccess, sendError, methodGuard, clientIp } = require('../../../lib/http');
const { requireAuth } = require('../../../lib/auth');
const { recordChange } = require('../../../lib/audit');
const { transactionUpdateSchema, formatZodError } = require('../../../lib/validation');
const { evaluateAndNotify, monthKey } = require('../../../lib/budget');
const logger = require('../../../lib/logger');

/** Load a transaction owned by the given user, or null. */
function getOwned(id, userId) {
  if (!/^\d+$/.test(String(id))) {
    return null;
  }
  return db
    .prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
    .get(Number(id), userId);
}

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['GET', 'PUT', 'DELETE'])) return;

    const { id } = req.query;
    const existing = getOwned(id, req.user.id);
    if (!existing) {
      // 404 (not 403) so we don't reveal whether the id exists for others.
      sendError(res, 404, 'Transaction not found');
      return;
    }

    // ---- GET ----
    if (req.method === 'GET') {
      const row = db
        .prepare(
          `SELECT t.id, t.txn_ref AS txnRef, t.type, t.amount, t.note,
                  t.txn_date AS date, t.category_id AS categoryId,
                  c.name AS categoryName, c.icon AS categoryIcon,
                  t.created_at AS createdAt, t.updated_at AS updatedAt
             FROM transactions t
             LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.id = ?`
        )
        .get(existing.id);
      sendSuccess(res, { transaction: row });
      return;
    }

    // ---- DELETE ----
    if (req.method === 'DELETE') {
      tx(() => {
        db.prepare('DELETE FROM transactions WHERE id = ?').run(existing.id);
        recordChange({
          entityType: 'transaction',
          entityId: existing.id,
          operation: 'DELETE',
          before: existing,
          actor: { id: req.user.id, email: req.user.email },
          sourceIp: clientIp(req),
        });
      });
      // Re-check the budget for the affected category/month.
      if (existing.type === 'expense' && existing.category_id) {
        evaluateAndNotify(req.user.id, existing.category_id, monthKey(existing.txn_date));
      }
      logger.info('transaction_deleted', { user_id: req.user.id, id: existing.id });
      sendSuccess(res, { message: 'Transaction deleted' });
      return;
    }

    // ---- PUT (edit) ----
    const parsed = transactionUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
      return;
    }

    // Merge supplied fields over the existing row.
    const type = parsed.data.type ?? existing.type;
    const amount = parsed.data.amount ?? existing.amount;
    const note = parsed.data.note ?? existing.note;
    const date = parsed.data.date ?? existing.txn_date;
    const categoryId =
      parsed.data.categoryId !== undefined
        ? parsed.data.categoryId
        : existing.category_id;

    // Validate the category belongs to the user (or is global) if set.
    if (categoryId !== null && categoryId !== undefined) {
      const category = db
        .prepare(
          'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)'
        )
        .get(categoryId, req.user.id);
      if (!category) {
        sendError(res, 400, 'Invalid category');
        return;
      }
    }

    const updated = tx(() => {
      db.prepare(
        `UPDATE transactions
            SET type = ?, amount = ?, note = ?, txn_date = ?, category_id = ?,
                updated_at = datetime('now')
          WHERE id = ?`
      ).run(type, amount, note || '', date, categoryId ?? null, existing.id);
      const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(existing.id);
      recordChange({
        entityType: 'transaction',
        entityId: existing.id,
        operation: 'UPDATE',
        before: existing,
        after: row,
        actor: { id: req.user.id, email: req.user.email },
        sourceIp: clientIp(req),
      });
      return row;
    });

    // Re-evaluate budgets for both the old and new category/month if expense.
    if (existing.type === 'expense' && existing.category_id) {
      evaluateAndNotify(req.user.id, existing.category_id, monthKey(existing.txn_date));
    }
    if (type === 'expense' && categoryId) {
      evaluateAndNotify(req.user.id, categoryId, monthKey(date));
    }

    logger.info('transaction_updated', { user_id: req.user.id, id: existing.id });
    sendSuccess(res, { transaction: updated });
  })
);
