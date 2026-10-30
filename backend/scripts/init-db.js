/**
 * Standalone database initialization script.
 *
 * Usage: `npm run db:init`
 * Loads environment variables, opens the SQLite database and creates all
 * tables/indexes. Safe to run repeatedly (uses CREATE TABLE IF NOT EXISTS).
 */

require('./load-env');
const db = require('../lib/db');
const { initSchema } = require('../lib/schema');

initSchema(db);
// eslint-disable-next-line no-console
console.log('Database schema initialized at', db.ABSOLUTE_DB_PATH);
