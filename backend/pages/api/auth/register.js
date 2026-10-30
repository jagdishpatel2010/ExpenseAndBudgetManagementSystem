/**
 * POST /api/auth/register
 *
 * Registers a new end-user account. Steps:
 * 1. Validate the body with a zod schema (allowlist, strong password).
 * 2. Reject duplicate emails with a generic conflict message.
 * 3. Hash the password with bcrypt (never store plaintext).
 * 4. Insert the user and write an audit record in one transaction.
 * 5. Issue a JWT so the client is logged in immediately.
 *
 * New registrations are always role 'user'. Admins are provisioned via seed.
 */
const db = require('../../../lib/bootstrap');
const { tx } = require('../../../lib/db');
const { handler, sendSuccess, sendError, methodGuard, clientIp } = require('../../../lib/http');
const { hashPassword, issueToken } = require('../../../lib/auth');
const { recordChange } = require('../../../lib/audit');
const { registerSchema, formatZodError } = require('../../../lib/validation');
const logger = require('../../../lib/logger');

export default handler(async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;

  // Validate input server-side before any DB access.
  const parsed = registerSchema.safeParse(req.body || {});
  if (!parsed.success) {
    sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
    return;
  }
  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // Reject duplicates. Generic message avoids leaking which emails exist.
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(normalizedEmail);
  if (existing) {
    sendError(res, 409, 'An account with this email already exists');
    return;
  }

  const passwordHash = await hashPassword(password);

  // Insert + audit atomically so the audit trail never drifts.
  const userId = tx(() => {
    const result = db
      .prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
      )
      .run(name, normalizedEmail, passwordHash, 'user');
    const id = Number(result.lastInsertRowid);
    recordChange({
      entityType: 'user',
      entityId: id,
      operation: 'CREATE',
      after: { id, name, email: normalizedEmail, role: 'user' },
      actor: { id, email: normalizedEmail },
      sourceIp: clientIp(req),
    });
    return id;
  });

  const user = { id: userId, name, email: normalizedEmail, role: 'user' };
  const token = issueToken(user);

  logger.info('user_registered', { user_id: userId, email: normalizedEmail });
  sendSuccess(res, { token, user }, 201);
});
