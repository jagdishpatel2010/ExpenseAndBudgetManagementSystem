/**
 * SQLite database access layer.
 *
 * Uses Node's built-in `node:sqlite` module (stable in Node 22+), which needs
 * no native compilation. A single shared connection serves the whole backend.
 * The `node:sqlite` API is synchronous, which keeps API route code simple.
 *
 * Security notes:
 * - All callers MUST use parameterized statements (`?` placeholders). Never
 *   build SQL by string concatenation with user input.
 * - Foreign keys are enforced so orphan rows cannot be created.
 *
 * A small `tx(fn)` helper wraps a function in BEGIN/COMMIT/ROLLBACK so the
 * audit record and the data change always commit together (Audit Trail skill).
 */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const logger = require('./logger');

// Resolve the database file path from env, defaulting to ./data/expense.db.
const DB_FILE = process.env.DATABASE_FILE || './data/expense.db';
const ABSOLUTE_DB_PATH = path.isAbsolute(DB_FILE)
  ? DB_FILE
  : path.join(process.cwd(), DB_FILE);

// Ensure the parent directory exists before opening the database.
const dbDir = path.dirname(ABSOLUTE_DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Reuse a single connection across hot reloads in dev (Next.js re-imports).
let db;
if (!global.__expenseDb) {
  db = new DatabaseSync(ABSOLUTE_DB_PATH);
  // WAL improves concurrent read/write performance for an embedded DB.
  db.exec('PRAGMA journal_mode = WAL;');
  // Enforce referential integrity (off by default in SQLite).
  db.exec('PRAGMA foreign_keys = ON;');
  global.__expenseDb = db;
  logger.info('database_connected', { path: ABSOLUTE_DB_PATH });
} else {
  db = global.__expenseDb;
}

/**
 * Run `fn` inside a single database transaction. Commits on success, rolls
 * back on any thrown error, then re-throws so the caller can handle it.
 * @template T
 * @param {() => T} fn Work to perform atomically.
 * @returns {T} Whatever `fn` returns.
 */
function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = db;
module.exports.ABSOLUTE_DB_PATH = ABSOLUTE_DB_PATH;
module.exports.tx = tx;
