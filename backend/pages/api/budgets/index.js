/**
 * GET  /api/budgets  - list budgets for the user (optionally a given month).
 * POST /api/budgets  - set (create or update) a monthly budget for a category.
 *
 * Budgets are unique per (user, category, month). POST performs an upsert:
 * if a budget already exists for that category+month it is updated, otherwise
 * a new one is created. All operations are scoped to the authenticated user
 * and audited. After setting a budget we re-evaluate alerts for that month.
 */
const db = require('../../../lib/bootstrap');
const { tx } = require('../../../lib/db');
const { handler, sendSuccess, sendError, methodGuard, clientIp } = require('../../../lib/http');
const { requireAuth } = require('../../../lib/auth');
const { recordChange } = require('../../../lib/audit');
const { budgetSchema, formatZodError } = require('../../../lib/validation');
const { evaluateAndNotify, budgetStatus } = require('../../../lib/budget');

/** Default month key (current month) when none is supplied. */
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['GET', 'POST'])) return;

    if (req.method === 'GET') {
      const month =
        req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)
          ? req.query.month
          : currentMonth();
      // budgetStatus merges budgets with actual spend + alert state.
      const status = budgetStatus(req.user.id, month);
      sendSuccess(res, { month, budgets: status });
      return;
    }

    // ---- POST: upsert a budget ----
    const parsed = budgetSchema.safeParse(req.body || {});
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
      return;
    }
    const { categoryId, month, amount } = parsed.data;

    // The category must be usable by this user (global or owned).
    const category = db
      .prepare(
        'SELECT id FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)'
      )
      .get(categoryId, req.user.id);
    if (!category) {
      sendError(res, 400, 'Invalid category');
      return;
    }

    const existing = db
      .prepare(
        'SELECT * FROM budgets WHERE user_id = ? AND category_id = ? AND month = ?'
      )
      .get(req.user.id, categoryId, month);

    const saved = tx(() => {
      if (existing) {
        db.prepare(
          "UPDATE budgets SET amount = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(amount, existing.id);
        const row = db.prepare('SELECT * FROM budgets WHERE id = ?').get(existing.id);
        recordChange({
          entityType: 'budget',
          entityId: existing.id,
          operation: 'UPDATE',
          before: existing,
          after: row,
          actor: { id: req.user.id, email: req.user.email },
          sourceIp: clientIp(req),
        });
        return row;
      }
      const result = db
        .prepare(
          'INSERT INTO budgets (user_id, category_id, month, amount) VALUES (?, ?, ?, ?)'
        )
        .run(req.user.id, categoryId, month, amount);
      const id = Number(result.lastInsertRowid);
      const row = db.prepare('SELECT * FROM budgets WHERE id = ?').get(id);
      recordChange({
        entityType: 'budget',
        entityId: id,
        operation: 'CREATE',
        after: row,
        actor: { id: req.user.id, email: req.user.email },
        sourceIp: clientIp(req),
      });
      return row;
    });

    // Raise an alert immediately if existing spend already breaches the budget.
    const alert = evaluateAndNotify(req.user.id, categoryId, month);

    sendSuccess(res, { budget: saved, alert }, existing ? 200 : 201);
  })
);
