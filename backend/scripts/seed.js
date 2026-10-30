/**
 * Database seed script.
 *
 * Usage: `npm run db:seed`
 *
 * Creates:
 * - the predefined (global) expense/income categories managed by admins
 * - an administrator account (credentials from .env)
 * - a sample user (Ananya Sharma) with demo transactions and budgets so the
 *   dashboard, charts and alerts have realistic Indian data to display.
 *
 * Idempotent: re-running will not create duplicate users or categories.
 */

require('./load-env');
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const { tx } = db;
const { initSchema } = require('../lib/schema');
const { v4: uuidv4 } = require('uuid');

initSchema(db);

// ---- Predefined global categories (user_id NULL, is_predefined = 1) ----
const PREDEFINED = [
  { name: 'Food & Dining', type: 'expense', icon: 'food' },
  { name: 'Travel', type: 'expense', icon: 'car' },
  { name: 'Education', type: 'expense', icon: 'school' },
  { name: 'Shopping', type: 'expense', icon: 'cart' },
  { name: 'Bills & Utilities', type: 'expense', icon: 'receipt' },
  { name: 'Groceries', type: 'expense', icon: 'basket' },
  { name: 'Health', type: 'expense', icon: 'heart' },
  { name: 'Entertainment', type: 'expense', icon: 'movie' },
  { name: 'Rent', type: 'expense', icon: 'home' },
  { name: 'Salary', type: 'income', icon: 'cash' },
  { name: 'Business', type: 'income', icon: 'briefcase' },
  { name: 'Other Income', type: 'income', icon: 'plus' },
];

const insertCategory = db.prepare(
  `INSERT INTO categories (user_id, name, type, icon, is_predefined)
   VALUES (NULL, ?, ?, ?, 1)`
);

tx(() => {
  for (const c of PREDEFINED) {
    const exists = db
      .prepare('SELECT id FROM categories WHERE name = ? AND user_id IS NULL')
      .get(c.name);
    if (!exists) {
      insertCategory.run(c.name, c.type, c.icon);
    }
  }
});

// ---- Admin account ----
const adminEmail = process.env.ADMIN_EMAIL || 'admin@expensebudget.in';
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
const adminName = process.env.ADMIN_NAME || 'Rajesh Kumar';

function ensureUser(name, email, password, role) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return existing.id;
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`
    )
    .run(name, email, hash, role);
  return result.lastInsertRowid;
}

ensureUser(adminName, adminEmail, adminPassword, 'admin');

// ---- Sample user with demo data (Indian names) ----
const sampleEmail = 'ananya.sharma@example.in';
const sampleUserId = ensureUser('Ananya Sharma', sampleEmail, 'User@12345', 'user');

// Map category names to ids for convenience.
function categoryId(name) {
  const row = db
    .prepare('SELECT id FROM categories WHERE name = ? AND user_id IS NULL')
    .get(name);
  return row ? row.id : null;
}

// Only seed demo transactions if this user currently has none.
const txnCount = db
  .prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id = ?')
  .get(sampleUserId).n;

if (txnCount === 0) {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const demoTxns = [
    { type: 'income', amount: 65000, cat: 'Salary', note: 'Monthly salary', day: '01' },
    { type: 'expense', amount: 15000, cat: 'Rent', note: 'Flat rent', day: '02' },
    { type: 'expense', amount: 3200, cat: 'Groceries', note: 'BigBasket order', day: '04' },
    { type: 'expense', amount: 850, cat: 'Food & Dining', note: 'Lunch with Priya', day: '06' },
    { type: 'expense', amount: 1200, cat: 'Travel', note: 'Ola cabs', day: '08' },
    { type: 'expense', amount: 2500, cat: 'Shopping', note: 'Myntra - kurta', day: '10' },
    { type: 'expense', amount: 999, cat: 'Bills & Utilities', note: 'Mobile recharge', day: '11' },
    { type: 'expense', amount: 1800, cat: 'Entertainment', note: 'Movie + dinner', day: '14' },
    { type: 'income', amount: 5000, cat: 'Business', note: 'Freelance project', day: '15' },
    { type: 'expense', amount: 4200, cat: 'Health', note: 'Pharmacy & checkup', day: '18' },
  ];

  const insertTxn = db.prepare(
    `INSERT INTO transactions (txn_ref, user_id, category_id, type, amount, note, txn_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  tx(() => {
    for (const t of demoTxns) {
      insertTxn.run(
        `TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
        sampleUserId,
        categoryId(t.cat),
        t.type,
        t.amount,
        t.note,
        `${ym}-${t.day}`
      );
    }
  });

  // Demo monthly budgets for the sample user.
  const demoBudgets = [
    { cat: 'Food & Dining', amount: 4000 },
    { cat: 'Travel', amount: 2000 },
    { cat: 'Shopping', amount: 3000 },
    { cat: 'Groceries', amount: 5000 },
    { cat: 'Entertainment', amount: 1500 },
  ];
  const insertBudget = db.prepare(
    `INSERT INTO budgets (user_id, category_id, month, amount) VALUES (?, ?, ?, ?)`
  );
  tx(() => {
    for (const b of demoBudgets) {
      insertBudget.run(sampleUserId, categoryId(b.cat), ym, b.amount);
    }
  });
}

// eslint-disable-next-line no-console
console.log('Seed complete.');
// eslint-disable-next-line no-console
console.log(`  Admin  : ${adminEmail} / ${adminPassword}`);
// eslint-disable-next-line no-console
console.log(`  Sample : ${sampleEmail} / User@12345`);
