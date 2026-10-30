/**
 * One-time schema bootstrap.
 *
 * Importing this module guarantees the database tables exist before any route
 * handler runs a query. It is safe to import from every API route because
 * `initSchema` uses CREATE TABLE IF NOT EXISTS and the work runs only once per
 * process (guarded by a module-level flag).
 */
const db = require('./db');
const { initSchema } = require('./schema');

if (!global.__schemaReady) {
  initSchema(db);
  global.__schemaReady = true;
}

module.exports = db;
