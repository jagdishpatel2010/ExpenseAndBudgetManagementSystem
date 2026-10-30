/**
 * Server-side input validation schemas (Security skill).
 *
 * All request bodies are validated with zod before they touch the database.
 * Validation uses allowlists (explicit shapes, enums, bounds) rather than
 * denylists. `parse` returns a typed object or throws a ZodError that the
 * caller converts into a 400 with field messages.
 */

const { z } = require('zod');

// ----- Auth -----
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  // Require a reasonably strong password.
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(1).max(100),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  currency: z.string().trim().min(1).max(8).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: z.string().min(8).max(100),
});

// ----- Admin: create user -----
// Like registration, but the admin may also assign a role. Role is an enum so
// only 'user' or 'admin' can ever be set (allowlist).
const adminCreateUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  role: z.enum(['user', 'admin']).default('user'),
});

// ----- Transactions -----
const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive().max(100000000),
  categoryId: z.number().int().positive().nullable().optional(),
  note: z.string().trim().max(240).optional().default(''),
  // ISO date YYYY-MM-DD
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

// Partial schema for updates (all fields optional).
const transactionUpdateSchema = transactionSchema.partial();

// ----- Categories -----
const categorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  type: z.enum(['income', 'expense']).default('expense'),
  icon: z.string().trim().max(40).optional().default('tag'),
});

// ----- Budgets -----
const budgetSchema = z.object({
  categoryId: z.number().int().positive(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  amount: z.number().nonnegative().max(100000000),
});

// ----- Support -----
const supportSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(5).max(2000),
});

/**
 * Convert a ZodError into a flat { field: message } map for the client.
 * @param {import('zod').ZodError} error
 */
function formatZodError(error) {
  const details = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    details[key] = issue.message;
  }
  return details;
}

module.exports = {
  registerSchema,
  loginSchema,
  adminCreateUserSchema,
  updateProfileSchema,
  changePasswordSchema,
  transactionSchema,
  transactionUpdateSchema,
  categorySchema,
  budgetSchema,
  supportSchema,
  formatZodError,
};
