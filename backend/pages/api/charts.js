/**
 * GET /api/charts
 *
 * Supplies aggregated data for the expense-analysis charts:
 * - byCategory : expense totals per category for a month (pie chart)
 * - dailyTrend : daily expense totals across a month (line/bar chart)
 * - monthlyTrend: income vs expense per month for the last 6 months
 *
 * Query param `month` (YYYY-MM) selects the month for the first two datasets;
 * defaults to the current month. All data is scoped to the authenticated user.
 */
const db = require('../../lib/bootstrap');
const { handler, sendSuccess, methodGuard } = require('../../lib/http');
const { requireAuth } = require('../../lib/auth');

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['GET'])) return;

    const userId = req.user.id;
    const month =
      req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)
        ? req.query.month
        : currentMonth();

    // Expense totals grouped by category for the selected month.
    const byCategory = db
      .prepare(
        `SELECT COALESCE(c.name, 'Uncategorized') AS category,
                COALESCE(c.icon, 'tag') AS icon,
                SUM(t.amount) AS total
           FROM transactions t
           LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = ? AND t.type = 'expense'
            AND substr(t.txn_date,1,7) = ?
          GROUP BY t.category_id
          ORDER BY total DESC`
      )
      .all(userId, month);

    // Daily expense totals within the selected month.
    const dailyTrend = db
      .prepare(
        `SELECT t.txn_date AS date, SUM(t.amount) AS total
           FROM transactions t
          WHERE t.user_id = ? AND t.type = 'expense'
            AND substr(t.txn_date,1,7) = ?
          GROUP BY t.txn_date
          ORDER BY t.txn_date`
      )
      .all(userId, month);

    // Income vs expense for the last 6 months.
    const monthlyTrend = db
      .prepare(
        `SELECT substr(txn_date,1,7) AS month,
                SUM(CASE WHEN type='income'  THEN amount ELSE 0 END) AS income,
                SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
           FROM transactions
          WHERE user_id = ?
          GROUP BY substr(txn_date,1,7)
          ORDER BY month DESC
          LIMIT 6`
      )
      .all(userId)
      .reverse();

    sendSuccess(res, { month, byCategory, dailyTrend, monthlyTrend });
  })
);
