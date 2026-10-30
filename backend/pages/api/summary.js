/**
 * GET /api/summary
 *
 * Returns the financial overview for the dashboard:
 * - totalIncome, totalExpense, balance (all-time, scoped to the user)
 * - today / week / month totals for income and expense
 * - recent transactions (latest 5)
 *
 * Optional query param `month` (YYYY-MM) narrows the headline totals to that
 * month; by default it reports the current month for the periodic figures and
 * all-time for the running balance.
 */
const db = require('../../lib/bootstrap');
const { handler, sendSuccess, methodGuard } = require('../../lib/http');
const { requireAuth } = require('../../lib/auth');

/** Sum of amounts for a type within an optional inclusive date range. */
function sumByType(userId, type, fromDate, toDate) {
  let sql =
    "SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE user_id = ? AND type = ?";
  const params = [userId, type];
  if (fromDate) {
    sql += ' AND txn_date >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    sql += ' AND txn_date <= ?';
    params.push(toDate);
  }
  return db.prepare(sql).get(...params).total;
}

/** Return YYYY-MM-DD for a Date. */
function iso(date) {
  return date.toISOString().slice(0, 10);
}

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['GET'])) return;

    const userId = req.user.id;
    const now = new Date();
    const today = iso(now);

    // Start of the current week (Monday).
    const weekStart = new Date(now);
    const day = (weekStart.getDay() + 6) % 7; // 0 = Monday
    weekStart.setDate(weekStart.getDate() - day);

    // Start of the current month.
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // All-time running balance.
    const totalIncome = sumByType(userId, 'income');
    const totalExpense = sumByType(userId, 'expense');

    const payload = {
      balance: totalIncome - totalExpense,
      totalIncome,
      totalExpense,
      today: {
        income: sumByType(userId, 'income', today, today),
        expense: sumByType(userId, 'expense', today, today),
      },
      week: {
        income: sumByType(userId, 'income', iso(weekStart), today),
        expense: sumByType(userId, 'expense', iso(weekStart), today),
      },
      month: {
        income: sumByType(userId, 'income', iso(monthStart), today),
        expense: sumByType(userId, 'expense', iso(monthStart), today),
      },
      recent: db
        .prepare(
          `SELECT t.id, t.txn_ref AS txnRef, t.type, t.amount, t.note,
                  t.txn_date AS date, c.name AS categoryName, c.icon AS categoryIcon
             FROM transactions t
             LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = ?
            ORDER BY t.txn_date DESC, t.id DESC
            LIMIT 5`
        )
        .all(userId),
    };

    sendSuccess(res, payload);
  })
);
