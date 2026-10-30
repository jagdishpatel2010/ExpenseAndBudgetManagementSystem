/**
 * GET /api/admin/activity  (admin only)
 *
 * Returns recent SYSTEM-LEVEL activity from the audit log for monitoring.
 * To respect user privacy, the detailed before/after value snapshots for
 * transaction and budget entities are stripped out here - admins can see THAT
 * a change happened (entity type, operation, actor, time) for monitoring and
 * error investigation, but NOT the private financial values involved.
 */
const db = require('../../../lib/bootstrap');
const { handler, sendSuccess, methodGuard } = require('../../../lib/http');
const { requireAdmin } = require('../../../lib/auth');

// Entity types whose detailed values are private and must be withheld.
const PRIVATE_ENTITIES = new Set(['transaction', 'budget']);

export default handler(
  requireAdmin(async (req, res) => {
    if (!methodGuard(req, res, ['GET'])) return;

    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 200);

    const rows = db
      .prepare(
        `SELECT id, entity_type AS entityType, entity_id AS entityId,
                operation, changed_by AS changedBy, source_ip AS sourceIp,
                changed_at AS changedAt, changed_data AS changedData
           FROM audit_log
          ORDER BY changed_at DESC, id DESC
          LIMIT ?`
      )
      .all(limit);

    // Redact private financial detail; keep the metadata useful for monitoring.
    const sanitized = rows.map((r) => {
      const base = {
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        operation: r.operation,
        changedBy: r.changedBy,
        sourceIp: r.sourceIp,
        changedAt: r.changedAt,
      };
      if (PRIVATE_ENTITIES.has(r.entityType)) {
        base.detail = '[hidden for user privacy]';
      } else {
        // Non-private entities (e.g. predefined categories, users meta) can
        // show their change payload for administration.
        base.detail = JSON.parse(r.changedData);
      }
      return base;
    });

    sendSuccess(res, { activity: sanitized });
  })
);
