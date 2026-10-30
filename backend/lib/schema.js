/**
 * Database schema definition and initialization.
 *
 * Exposes `initSchema(db)` which creates every table if it does not already
 * exist. The schema is split into clearly-named tables:
 *
 * - users          : accounts with hashed passwords and a role (user/admin)
 * - categories     : expense/income categories (global predefined + per user)
 * - transactions   : income & expense records with a unique transaction id
 * - budgets        : monthly budget per category per user
 * - notifications  : budget alerts and reminders per user
 * - support_requests: user support tickets handled by admins
 * - audit_log      : append-only audit trail of every data change (what/when/who)
 *
 * Audit Trail skill: `audit_log` is a dedicated, append-only table. The
 * application never updates or deletes rows from it.
 */

/**
 * Create all tables and indexes if they do not exist.
 * @param {import('better-sqlite3').Database} db Open database connection.
 */
function initSchema(db) {
  db.exec(`
    -- ---------- users ----------
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
      currency      TEXT    NOT NULL DEFAULT 'INR',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ---------- categories ----------
    -- user_id NULL  => global predefined category managed by admins.
    -- user_id SET   => a custom category owned by that user.
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER,
      name       TEXT    NOT NULL,
      type       TEXT    NOT NULL DEFAULT 'expense' CHECK (type IN ('expense','income')),
      icon       TEXT    NOT NULL DEFAULT 'tag',
      is_predefined INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ---------- transactions ----------
    CREATE TABLE IF NOT EXISTS transactions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      txn_ref        TEXT    NOT NULL UNIQUE,   -- unique human/machine transaction id
      user_id        INTEGER NOT NULL,
      category_id    INTEGER,
      type           TEXT    NOT NULL CHECK (type IN ('income','expense')),
      amount         REAL    NOT NULL CHECK (amount > 0),
      note           TEXT    NOT NULL DEFAULT '',
      txn_date       TEXT    NOT NULL,          -- ISO date (YYYY-MM-DD)
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    -- ---------- budgets ----------
    -- One budget per user, category, month (YYYY-MM).
    CREATE TABLE IF NOT EXISTS budgets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      month       TEXT    NOT NULL,             -- YYYY-MM
      amount      REAL    NOT NULL CHECK (amount >= 0),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, category_id, month),
      FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    -- ---------- notifications ----------
    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      title      TEXT    NOT NULL,
      body       TEXT    NOT NULL,
      type       TEXT    NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','danger')),
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ---------- support_requests ----------
    CREATE TABLE IF NOT EXISTS support_requests (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      subject    TEXT    NOT NULL,
      message    TEXT    NOT NULL,
      status     TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ---------- audit_log (append-only) ----------
    CREATE TABLE IF NOT EXISTS audit_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type    TEXT    NOT NULL,          -- e.g. 'transaction', 'budget'
      entity_id      TEXT    NOT NULL,
      operation      TEXT    NOT NULL CHECK (operation IN ('CREATE','UPDATE','DELETE')),
      changed_data   TEXT    NOT NULL,          -- JSON {before, after}
      changed_by_id  INTEGER,                   -- acting user id (NULL => system)
      changed_by     TEXT    NOT NULL,          -- email or 'system'
      source_ip      TEXT,
      changed_at     TEXT    NOT NULL DEFAULT (datetime('now'))  -- UTC
    );

    -- ---------- indexes ----------
    CREATE INDEX IF NOT EXISTS idx_txn_user_date  ON transactions(user_id, txn_date);
    CREATE INDEX IF NOT EXISTS idx_txn_user_type  ON transactions(user_id, type);
    CREATE INDEX IF NOT EXISTS idx_budget_user    ON budgets(user_id, month);
    CREATE INDEX IF NOT EXISTS idx_notif_user     ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_audit_entity   ON audit_log(entity_type, entity_id);
  `);
}

module.exports = { initSchema };
