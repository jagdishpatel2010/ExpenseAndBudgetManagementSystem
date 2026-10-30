/**
 * GET  /api/admin/users  (admin only) - list accounts (metadata only).
 * POST /api/admin/users  (admin only) - create a new user or admin account.
 *
 * Privacy note (project requirement): this endpoint manages ACCOUNTS, not
 * financial data. It exposes only id, name, email, role and created date, and
 * NEVER a user's transactions, budgets, notes, or balances. Admins can create
 * logins and assign a role, but still cannot read anyone's personal spending.
 *
 * Security:
 * - Protected by `requireAdmin` (authenticated admin only).
 * - Passwords are bcrypt-hashed; plaintext is never stored or logged.
 * - Input is validated server-side with an allowlist zod schema (role is an
 *   enum, so only 'user'/'admin' are possible).
 * - Duplicate emails are rejected with a generic conflict message.
 * - Creation is recorded in the audit log with the acting admin as actor.
 */
const db = require('../../../lib/bootstrap');
const { tx } = require('../../../lib/db');
const { handler, sendSuccess, sendError, methodGuard, clientIp } = require('../../../lib/http');
const { requireAdmin, hashPassword } = require('../../../lib/auth');
const { recordChange } = require('../../../lib/audit');
const { adminCreateUserSchema, formatZodError } = require('../../../lib/validation');
const logger = require('../../../lib/logger');

export default handler(
  requireAdmin(async (req, res) => {
    if (!methodGuard(req, res, ['GET', 'POST'])) return;

    // ---- GET: list accounts (metadata only) ----
    if (req.method === 'GET') {
      const users = db
        .prepare(
          `SELECT id, name, email, role, created_at AS createdAt
             FROM users
            ORDER BY role DESC, created_at DESC`
        )
        .all();
      sendSuccess(res, { users });
      return;
    }

    // ---- POST: create a user/admin account ----
    const parsed = adminCreateUserSchema.safeParse(req.body || {});
    if (!parsed.success) {
      sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
      return;
    }
    const { name, email, password, role } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Reject duplicate emails (generic message - no account enumeration).
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(normalizedEmail);
    if (existing) {
      sendError(res, 409, 'An account with this email already exists');
      return;
    }

    const passwordHash = await hashPassword(password);

    // Insert + audit atomically so the trail cannot drift from the data.
    const created = tx(() => {
      const result = db
        .prepare(
          'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
        )
        .run(name, normalizedEmail, passwordHash, role);
      const id = Number(result.lastInsertRowid);
      const row = db
        .prepare('SELECT id, name, email, role, created_at AS createdAt FROM users WHERE id = ?')
        .get(id);
      recordChange({
        entityType: 'user',
        entityId: id,
        operation: 'CREATE',
        // Snapshot excludes the password hash; the audit service also redacts it.
        after: { id, name, email: normalizedEmail, role },
        actor: { id: req.user.id, email: req.user.email },
        sourceIp: clientIp(req),
      });
      return row;
    });

    logger.info('admin_created_user', {
      admin_id: req.user.id,
      new_user_id: created.id,
      role,
    });
    sendSuccess(res, { user: created }, 201);
  })
);
