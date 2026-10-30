/**
 * Health-check endpoint.
 *
 * Returns a simple OK payload so the mobile app (and monitoring) can verify
 * the backend is reachable. Also ensures the database schema exists on first
 * hit, which makes local setup forgiving if `db:init` was not run manually.
 */
const { handler, sendSuccess } = require('../../lib/http');
const db = require('../../lib/db');
const { initSchema } = require('../../lib/schema');

// Ensure tables exist (idempotent) when the API process starts serving.
initSchema(db);

export default handler(async (req, res) => {
  sendSuccess(res, { status: 'ok', time: new Date().toISOString() });
});
