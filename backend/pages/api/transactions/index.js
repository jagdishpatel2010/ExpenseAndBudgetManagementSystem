/**
 * GET  /api/transactions  - list the user's transactions with filters/search.
 * POST /api/transactions  - create an income or expense record.
 *
 * Every query is scoped to req.user.id so a user can only ever see their own
 * data (object-level access control). Filters are applied with parameterized
 * SQL only - no string interpolation of user input.
 *
 * Supported query params on GET:
 *   type       income|expense
 *   categoryId numeric category filter
 *   from, to   ISO dates (inclusive range on txn_date)
 *   q          free-text search across note and txn_ref
 *   page,limit pagination (defaults page=1, limit=50, max 200)
 */
const db = require('../../../lib/bootstrap');
const { tx } = require('../../../lib/db');
const { handler, sendSuccess, sendError, methodGuard, clientIp } = require('../../../lib/http');
const { requireAuth } = require('../../../lib/auth');
const { recordChange } = require('../../../lib/audit');
const { transactionSchema, formatZodError } = require('../../../lib/validation');
const { generateTxnRef } = require('../../../lib/txref');
const { evaluateAndNotify, monthKey } = require('../../../lib/budget');
const logger = require('../../../lib/logger');

/** Build the filtered list query from validated query params. */
function listTransactions(userId, query) {
  const clauses = ['t.user_id = ?'];
  const params = [userId];

  if (query.type === 'income' || query.type === 'expense') {
    clauses.push('t.type = ?');
    params.push(query.type);
  }
  if (query.categoryId && /^\d+$/.test(String(query.categoryId))) {
    clauses.push('t.category_id = ?');
    params.push(Number(query.categoryId));
  }
  if (query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) {
    clauses.push('t.txn_date >= ?');
    params.push(query.from);
  }
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
    clauses.push('t.txn_date <= ?');
    params.push(query.to);
  }
  if (query.q && String(query.q).trim().length > 0) {
    // Parameterized LIKE search over note and reference.
    clauses.push('(t.note LIKE ? OR t.txn_ref LIKE ?)');
    const like = `%${String(query.q).trim()}%`;
    params.push(like, like);
  }

  // Pagination with safe bounds.
  const page = Math.max(parseInt(query.page || '1', 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '50', 10) || 50, 1), 200);
  const offset = (page - 1) * limit;

  const where = clauses.join(' AND ');

  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM transactions t WHERE ${where}`)
    .get(...params).n;

  const rows = db
    .prepare(
      `SELECT t.id, t.txn_ref AS txnRef, t.type, t.amount, t.note,
              t.txn_date AS date, t.category_id AS categoryId,
              c.name AS categoryName, c.icon AS categoryIcon,
              t.created_at AS createdAt, t.updated_at AS updatedAt
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
        WHERE ${where}
        ORDER BY t.txn_date DESC, t.id DESC
        LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return { rows, total, page, limit };
}

export default handler(
  requireAuth(async (req, res) => {
    if (!methodGuard(req, res, ['GET', 'POST'])) return;

    if (req.method === 'GET') {
      const result = listTransactions(req.user.id, req.query);
      sendSuccess(res, {
        transactions: result.rows,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: Math.ceil(result.total / result.limit),
        },
      });
      return;
    }

    // ---- POST: create a transaction ----
    const parsed = transactionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
      return;
    }
    const { type, amount, note, date } = parsed.data;
    const categoryId = parsed.data.categoryId ?? null;

    // If a category is supplied, verify it is usable by this user
    // (either a global predefined category or one the user owns).
    if (categoryId !== null) {
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

    const txnRef = generateTxnRef();

    const created = tx(() => {
      const result = db
        .prepare(
          `INSERT INTO transactions (txn_ref, user_id, category_id, type, amount, note, txn_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(txnRef, req.user.id, categoryId, type, amount, note || '', date);
      const id = Number(result.lastInsertRowid);
      const row = db
        .prepare('SELECT * FROM transactions WHERE id = ?')
        .get(id);
      recordChange({
        entityType: 'transaction',
        entityId: id,
        operation: 'CREATE',
        after: row,
        actor: { id: req.user.id, email: req.user.email },
        sourceIp: clientIp(req),
      });
      return row;
    });

    // After an expense, re-evaluate the category budget and raise an alert
    // notification if the user is approaching or has exceeded their budget.
    let alert = null;
    if (type === 'expense' && categoryId !== null) {
      alert = evaluateAndNotify(req.user.id, categoryId, monthKey(date));
    }

    logger.info('transaction_created', {
      user_id: req.user.id,
      txnRef,
      type,
    });
    sendSuccess(res, { transaction: created, alert }, 201);
  })
);
