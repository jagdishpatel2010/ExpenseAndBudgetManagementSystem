/**
 * Structured application logger.
 *
 * Responsibilities:
 * - Emit JSON-structured log lines so they can be parsed by log tooling.
 * - NEVER write secrets, passwords or tokens to the logs. Any structured
 *   payload is passed through `sanitize` which redacts sensitive keys.
 *
 * This is intentionally dependency-free (console based) to keep the demo
 * backend lightweight, while still following the "log every state change,
 * never log secrets" rules.
 */

// Field names whose values must be redacted before they are ever logged.
const SENSITIVE_FIELDS = new Set([
  'password',
  'password1',
  'password2',
  'confirmpassword',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'jwt_secret',
  'apikey',
  'api_key',
]);

/**
 * Recursively replace sensitive values with '***' so they never reach logs.
 * @param {unknown} data Arbitrary value (object, array or primitive).
 * @returns {unknown} A sanitized copy safe for logging.
 */
function sanitize(data) {
  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item));
  }
  if (data && typeof data === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(data)) {
      clean[key] = SENSITIVE_FIELDS.has(key.toLowerCase())
        ? '***'
        : sanitize(value);
    }
    return clean;
  }
  return data;
}

/**
 * Write a single structured log line.
 * @param {string} level Log level (info, warn, error, debug).
 * @param {string} message Human readable event message.
 * @param {object} [context] Optional structured context; sanitized first.
 */
function write(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitize(context),
  };
  // Route errors/warnings to stderr, everything else to stdout.
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

const logger = {
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
  debug: (message, context) => {
    // Guard debug payload construction behind an env flag to avoid overhead.
    if (process.env.LOG_LEVEL === 'debug') {
      write('debug', message, context);
    }
  },
  sanitize,
};

module.exports = logger;
