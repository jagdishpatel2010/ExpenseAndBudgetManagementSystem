/**
 * Budget calculation and alert logic.
 *
 * Centralizes the rules that decide when a user is "approaching" or has
 * "exceeded" a category budget, and creates the corresponding notification.
 * Keeping this in one module ensures the dashboard, budget-status endpoint and
 * the transaction-create flow all compute alerts identically.
 */

const db = require('./db');
const logger = require('./logger');

// Percent of budget at which a warning alert is raised (default 80%).
const WARN_THRESHOLD = Number(process.env.BUDGET_WARN_THRESHOLD || 80);

/**
 * Compute the current month key (YYYY-MM) for a given ISO date string.
 * @param {string} isoDate e.g. '2026-10-27'
 */
function monthKey(isoDate) {
  return isoDate.slice(0, 7);
}

/**
 * Total expense spent by a user in a category for a given month.
 * @returns {number} Sum of expense amounts (0 when none).
 */
function spentInCategory(userId, categoryId, month) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS spent
         FROM transactions
        WHERE user_id = ?
          AND category_id = ?
          AND type = 'expense'
          AND substr(txn_date, 1, 7) = ?`
    )
    .get(userId, categoryId, month);
  return row.spent;
}

/**
 * Build the budget status for every budgeted category in a month.
 * @returns {Array<object>} Status rows with spent, budget, percent and state.
 */
function budgetStatus(userId, month) {
  const budgets = db
    .prepare(
      `SELECT b.id, b.category_id AS categoryId, b.amount AS budget,
              c.name AS categoryName, c.icon AS icon
         FROM budgets b
         JOIN categories c ON c.id = b.category_id
        WHERE b.user_id = ? AND b.month = ?
        ORDER BY c.name`
    )
    .all(userId, month);

  return budgets.map((b) => {
    const spent = spentInCategory(userId, b.categoryId, month);
    const percent = b.budget > 0 ? Math.round((spent / b.budget) * 100) : 0;
    let state = 'ok';
    if (spent > b.budget) {
      state = 'exceeded';
    } else if (percent >= WARN_THRESHOLD) {
      state = 'warning';
    }
    return {
      budgetId: b.id,
      categoryId: b.categoryId,
      categoryName: b.categoryName,
      icon: b.icon,
      budget: b.budget,
      spent,
      remaining: Math.max(b.budget - spent, 0),
      percent,
      state,
    };
  });
}

/**
 * Evaluate a user's budget for a category after a change and, if the spend is
 * approaching or exceeding the budget, create a notification. De-duplicates by
 * not raising the same alert twice in a row for the same category+month+state.
 *
 * @returns {object|null} The created notification row, or null if no alert.
 */
function evaluateAndNotify(userId, categoryId, month) {
  if (!categoryId) {
    return null;
  }
  const budget = db
    .prepare(
      `SELECT b.amount AS amount, c.name AS categoryName
         FROM budgets b JOIN categories c ON c.id = b.category_id
        WHERE b.user_id = ? AND b.category_id = ? AND b.month = ?`
    )
    .get(userId, categoryId, month);

  if (!budget || budget.amount <= 0) {
    return null;
  }

  const spent = spentInCategory(userId, categoryId, month);
  const percent = Math.round((spent / budget.amount) * 100);

  let type = null;
  let title = '';
  let body = '';
  if (spent > budget.amount) {
    type = 'danger';
    title = `Budget exceeded: ${budget.categoryName}`;
    body = `You have spent ₹${spent.toFixed(2)} of your ₹${budget.amount.toFixed(
      2
    )} ${budget.categoryName} budget for ${month} (${percent}%).`;
  } else if (percent >= WARN_THRESHOLD) {
    type = 'warning';
    title = `Approaching budget: ${budget.categoryName}`;
    body = `You have used ${percent}% (₹${spent.toFixed(2)}) of your ₹${budget.amount.toFixed(
      2
    )} ${budget.categoryName} budget for ${month}.`;
  }

  if (!type) {
    return null;
  }

  // De-dupe: skip if an identical alert already exists for this month.
  const existing = db
    .prepare(
      `SELECT id FROM notifications
        WHERE user_id = ? AND title = ? AND substr(created_at,1,7) = ?`
    )
    .get(userId, title, month);
  if (existing) {
    return null;
  }

  const result = db
    .prepare(
      `INSERT INTO notifications (user_id, title, body, type)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId, title, body, type);

  logger.info('budget_alert_created', {
    user_id: userId,
    categoryId,
    month,
    state: type,
    percent,
  });

  return db
    .prepare('SELECT * FROM notifications WHERE id = ?')
    .get(result.lastInsertRowid);
}

module.exports = {
  WARN_THRESHOLD,
  monthKey,
  spentInCategory,
  budgetStatus,
  evaluateAndNotify,
};
