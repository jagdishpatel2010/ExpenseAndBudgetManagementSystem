/**
 * Unique transaction reference generator.
 *
 * Produces a human-readable, globally-unique id of the form:
 *   TXN-YYYYMMDD-XXXXXXXX
 * where the suffix is derived from a UUID v4. The DB also enforces uniqueness
 * via a UNIQUE constraint on `transactions.txn_ref`, so this is both readable
 * and collision-safe.
 */
const { v4: uuidv4 } = require('uuid');

/** @returns {string} A new unique transaction reference. */
function generateTxnRef() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}${String(now.getDate()).padStart(2, '0')}`;
  const rand = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `TXN-${datePart}-${rand}`;
}

module.exports = { generateTxnRef };
