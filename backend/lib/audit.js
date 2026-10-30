/**
 * Audit trail service (Audit Trail skill).
 *
 * Records every create/update/delete of business data into the dedicated,
 * append-only `audit_log` table. Each record answers three questions:
 *   - what changed : entity type, entity id, operation, before/after values
 *   - when         : UTC timestamp (datetime('now'))
 *   - who          : acting user id + stable identifier (email), or 'system'
 *
 * Sensitive fields are redacted before being stored.
 */

const db = require('./db');
const logger = require('./logger');

// Values for these keys must never be written to the audit table in the clear.
const SENSITIVE_FIELDS = new Set([
  'password',
  'password_hash',
  'token',
  'secret',
  'api_key',
]);

/**
 * Redact sensitive values from a snapshot before persisting it.
 * @param {object|null} snapshot Row snapshot or null.
 * @returns {object|null} Redacted copy.
 */
function redact(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return snapshot;
  }
  const clean = {};
  for (const [key, value] of Object.entries(snapshot)) {
    clean[key] = SENSITIVE_FIELDS.has(key.toLowerCase())
      ? '***REDACTED***'
      : value;
  }
  return clean;
}

/**
 * Append a single audit record.
 *
 * IMPORTANT: Call this inside the same better-sqlite3 transaction as the data
 * change so the audit trail can never drift from operational data.
 *
 * @param {object} params
 * @param {string} params.entityType  Logical entity name (e.g. 'transaction').
 * @param {string|number} params.entityId Identifier of the changed row.
 * @param {'CREATE'|'UPDATE'|'DELETE'} params.operation Operation performed.
 * @param {object|null} [params.before] Snapshot before the change.
 * @param {object|null} [params.after]  Snapshot after the change.
 * @param {object|null} [params.actor]  Acting user { id, email } or null.
 * @param {string|null} [params.sourceIp] Client IP when available.
 */
function recordChange({
  entityType,
  entityId,
  operation,
  before = null,
  after = null,
  actor = null,
  sourceIp = null,
}) {
  const changedData = JSON.stringify({
    before: redact(before),
    after: redact(after),
  });

  db.prepare(
    `INSERT INTO audit_log
       (entity_type, entity_id, operation, changed_data, changed_by_id, changed_by, source_ip)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entityType,
    String(entityId),
    operation,
    changedData,
    actor ? actor.id : null,
    actor ? actor.email : 'system',
    sourceIp
  );

  logger.info('audit_recorded', {
    entityType,
    entityId: String(entityId),
    operation,
    changed_by: actor ? actor.email : 'system',
  });
}

module.exports = { recordChange };
