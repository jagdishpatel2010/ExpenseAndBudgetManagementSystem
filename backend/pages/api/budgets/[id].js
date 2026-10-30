/**
 * DELETE /api/budgets/:id - remove a budget owned by the user.
 *
 * Scoped to req.user.id so a user can only delete their own budgets. The
 * deletion is audited with a before snapshot.
 */
const db = require('../../../lib/bootstrap');
const { tx } = require('../../../lib/db');
const { handler, sendSuccess, sendError, methodGuard, clientIp } = require('../../../lib/http');
const { requireAuth } = require('../../../lib/auth');
const { recordChange } = require('../../../lib/audit');

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['DELETE'])) return;

    const { id } = req.query;
    if (!/^\d+$/.test(String(id))) {
      sendError(res, 404, 'Budget not found');
      return;
    }

    const budget = db
      .prepare('SELECT * FROM budgets WHERE id = ? AND user_id = ?')
      .get(Number(id), req.user.id);
    if (!budget) {
      sendError(res, 404, 'Budget not found');
      return;
    }

    tx(() => {
      db.prepare('DELETE FROM budgets WHERE id = ?').run(budget.id);
      recordChange({
        entityType: 'budget',
        entityId: budget.id,
        operation: 'DELETE',
        before: budget,
        actor: { id: req.user.id, email: req.user.email },
        sourceIp: clientIp(req),
      });
    });

    sendSuccess(res, { message: 'Budget deleted' });
  })
);
