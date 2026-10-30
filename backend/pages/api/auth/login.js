/**
 * POST /api/auth/login
 *
 * Authenticates a user by email + password and returns a JWT on success.
 * Security choices:
 * - Uses a single generic error ("Invalid email or password") for both
 *   unknown-email and wrong-password cases so attackers cannot enumerate
 *   which emails are registered.
 * - Compares passwords with bcrypt (constant-time within bcrypt).
 * - Never logs the password; only the email and outcome.
 */
const db = require('../../../lib/bootstrap');
const { handler, sendSuccess, sendError, methodGuard } = require('../../../lib/http');
const { verifyPassword, issueToken } = require('../../../lib/auth');
const { loginSchema, formatZodError } = require('../../../lib/validation');
const logger = require('../../../lib/logger');

export default handler(async (req, res) => {
  if (!methodGuard(req, res, ['POST'])) return;

  const parsed = loginSchema.safeParse(req.body || {});
  if (!parsed.success) {
    sendError(res, 400, 'Validation failed', formatZodError(parsed.error));
    return;
  }
  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const user = db
    .prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = ?')
    .get(normalizedEmail);

  // Generic failure for both missing user and bad password.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    logger.warn('login_failed', { email: normalizedEmail });
    sendError(res, 401, 'Invalid email or password');
    return;
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  const token = issueToken(safeUser);

  logger.info('login_success', { user_id: user.id, role: user.role });
  sendSuccess(res, { token, user: safeUser });
});
