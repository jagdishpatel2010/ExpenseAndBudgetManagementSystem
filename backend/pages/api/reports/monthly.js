/**
 * GET /api/reports/monthly?month=YYYY-MM&format=json|csv
 *
 * Produces a monthly expense/income report for the authenticated user.
 * - format=json (default): structured report with totals, per-category
 *   breakdown, budget comparison and the full transaction list.
 * - format=csv: a downloadable CSV of the month's transactions, suitable for
 *   the "export monthly report" requirement.
 *
 * All data is strictly scoped to req.user.id.
 */
const jwt = require('jsonwebtoken');
const db = require('../../../lib/bootstrap');
const { handler, sendSuccess, sendError, methodGuard } = require('../../../lib/http');
const { budgetStatus } = require('../../../lib/budget');

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Escape a value for safe inclusion in a CSV cell. */
function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  // Quote if the value contains comma, quote or newline; double embedded quotes.
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Resolve the authenticated user from either the Authorization header (normal
 * API calls) or a `token` query parameter. The query-param path exists only to
 * support the CSV download link, which is opened by the browser/OS and cannot
 * attach an Authorization header. The token is still a signed JWT and is
 * verified the same way.
 * @returns {{id:number,email:string,role:string}|null}
 */
function resolveUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, headerToken] = header.split(' ');
  const token =
    scheme === 'Bearer' && headerToken ? headerToken : req.query.token;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export default handler(async (req, res) => {
  if (!methodGuard(req, res, ['GET'])) return;

  const user = resolveUser(req);
  if (!user) {
    sendError(res, 401, 'Authentication required');
    return;
  }
  {
    const userId = user.id;
    const month =
      req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)
        ? req.query.month
        : currentMonth();
    const format = req.query.format === 'csv' ? 'csv' : 'json';

    const transactions = db
      .prepare(
        `SELECT t.txn_ref AS txnRef, t.txn_date AS date, t.type, t.amount,
                COALESCE(c.name,'Uncategorized') AS category, t.note
           FROM transactions t
           LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = ? AND substr(t.txn_date,1,7) = ?
          ORDER BY t.txn_date, t.id`
      )
      .all(userId, month);

    // ---- CSV export branch ----
    if (format === 'csv') {
      const header = ['Transaction ID', 'Date', 'Type', 'Category', 'Amount', 'Note'];
      const lines = [header.map(csvCell).join(',')];
      for (const t of transactions) {
        lines.push(
          [t.txnRef, t.date, t.type, t.category, t.amount, t.note]
            .map(csvCell)
            .join(',')
        );
      }
      const csv = lines.join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="expense-report-${month}.csv"`
      );
      res.status(200).send(csv);
      return;
    }

    // ---- JSON report branch ----
    const totals = transactions.reduce(
      (acc, t) => {
        if (t.type === 'income') acc.income += t.amount;
        else acc.expense += t.amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );

    const byCategory = db
      .prepare(
        `SELECT COALESCE(c.name,'Uncategorized') AS category,
                SUM(t.amount) AS total
           FROM transactions t
           LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = ? AND t.type = 'expense'
            AND substr(t.txn_date,1,7) = ?
          GROUP BY t.category_id
          ORDER BY total DESC`
      )
      .all(userId, month);

    sendSuccess(res, {
      month,
      generatedAt: new Date().toISOString(),
      totals: {
        income: totals.income,
        expense: totals.expense,
        balance: totals.income - totals.expense,
      },
      byCategory,
      budgets: budgetStatus(userId, month),
      transactions,
    });
  }
});
