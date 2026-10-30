/**
 * GET /api/admin/stats  (admin only)
 *
 * Returns application USAGE statistics only - deliberately aggregate and
 * anonymous. Per the privacy requirement, administrators must NOT have access
 * to any individual user's personal transaction details, so this endpoint
 * exposes only system-wide counts and totals, never per-user spending rows,
 * notes, or category breakdowns attributable to a named person.
 */
const db = require('../../../lib/bootstrap');
const { handler, sendSuccess, methodGuard } = require('../../../lib/http');
const { requireAdmin } = require('../../../lib/auth');

export default handler(
  requireAdmin(async (req, res) => {
    if (!methodGuard(req, res, ['GET'])) return;

    const userCount = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'user'").get().n;
    const adminCount = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;

    // Aggregate, non-attributable counts only.
    const totalTransactions = db
      .prepare('SELECT COUNT(*) AS n FROM transactions').get().n;
    const totalBudgets = db.prepare('SELECT COUNT(*) AS n FROM budgets').get().n;
    const predefinedCategories = db
      .prepare('SELECT COUNT(*) AS n FROM categories WHERE user_id IS NULL').get().n;
    const customCategories = db
      .prepare('SELECT COUNT(*) AS n FROM categories WHERE user_id IS NOT NULL').get().n;
    const openSupport = db
      .prepare("SELECT COUNT(*) AS n FROM support_requests WHERE status = 'open'").get().n;

    // New user signups over the last 7 days (count only, no identities).
    const signupsLast7Days = db
      .prepare(
        "SELECT COUNT(*) AS n FROM users WHERE created_at >= datetime('now','-7 days')"
      )
      .get().n;

    sendSuccess(res, {
      users: { total: userCount, admins: adminCount, signupsLast7Days },
      activity: { totalTransactions, totalBudgets },
      categories: { predefined: predefinedCategories, custom: customCategories },
      support: { open: openSupport },
      note: 'Aggregate usage metrics only. Individual transaction details are private to each user.',
    });
  })
);
