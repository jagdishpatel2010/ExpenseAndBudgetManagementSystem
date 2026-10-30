# Smart Personal Expense & Budget Management System

A full-stack personal finance app that lets users record income and expenses,
categorize transactions, set monthly budgets, get budget alerts, visualize
spending, and export monthly reports.

- **Frontend:** React Native (Expo) — `mobile/`
- **Backend:** Next.js API Routes (REST) — `backend/`
- **Database:** SQLite (via Node's built-in `node:sqlite`)
- **Auth:** JWT (bcrypt-hashed passwords, role-based: `user` / `admin`)
- **Charts:** `react-native-chart-kit`

---

## Project structure

```
Expense And Budget Management/
├── backend/                 # Next.js API Routes + SQLite
│   ├── lib/                 # db, schema, auth, audit, logger, validation, budget, http
│   ├── pages/
│   │   ├── index.js         # API landing page
│   │   └── api/             # REST endpoints (auth, transactions, categories,
│   │                        #  budgets, summary, charts, reports, notifications,
│   │                        #  profile, support, admin/*)
│   ├── scripts/             # init-db.js, seed.js, load-env.js
│   ├── data/                # SQLite database file (created at runtime)
│   ├── .env                 # local config (JWT secret, admin seed, etc.)
│   └── .env.example
└── mobile/                  # Expo React Native app
    ├── App.js
    └── src/
        ├── api/             # client.js (fetch + JWT), services.js
        ├── components/      # shared UI (Button, Field, Card, etc.)
        ├── context/         # AuthContext
        ├── navigation/      # RootNavigator, MainTabs
        ├── screens/         # all app screens grouped by feature
        ├── utils/           # formatting helpers
        ├── config.js        # API base URL + currency (INR)
        └── theme.js         # design tokens
```

---

## Prerequisites

- **Node.js 22 or newer** (the backend uses the built-in `node:sqlite` module,
  which is available from Node 22+; this project was verified on Node 26).
- npm.
- For running the mobile app on a device: the **Expo Go** app (SDK 58), or an
  Android/iOS emulator.

> The mobile app targets **Expo SDK 58** (React Native 0.88). Expo Go only runs
> projects that match its own SDK version, so install the Expo Go build that
> reports SDK 58. If your Expo Go is a different SDK, run
> `npx expo install expo@^<that-sdk> && npx expo install --fix` to realign, or
> use a development build.

No native compiler is required — the backend uses `node:sqlite`, so there is no
`better-sqlite3`/node-gyp build step.

---

## 1. Backend setup

```bash
cd backend
npm install

# Create the SQLite schema and seed predefined categories + demo data
npm run db:seed

# Start the API (http://localhost:4000)
npm run dev
```

Environment variables live in `backend/.env` (see `.env.example`):

| Variable                | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `JWT_SECRET`            | Secret used to sign JWTs (required)            |
| `JWT_EXPIRES_IN`        | Access token lifetime in seconds (default 3600)|
| `DATABASE_FILE`         | SQLite file path (default `./data/expense.db`) |
| `BUDGET_WARN_THRESHOLD` | Percent of budget that triggers a warning (80) |
| `ADMIN_*`               | Seeded administrator account                   |

> For production, replace `JWT_SECRET` with a long random value and keep `.env`
> out of version control (it is already git-ignored).

### Seeded demo accounts

| Role  | Email                       | Password     |
| ----- | --------------------------- | ------------ |
| User  | `ananya.sharma@example.in`  | `User@12345` |
| Admin | `admin@expensebudget.in`    | `Admin@12345`|

The demo user is seeded with sample income/expense transactions and budgets so
the dashboard, charts and alerts have data immediately.

### Verify the backend

```bash
# Health check
curl http://localhost:4000/api/health
```

A production build can be verified with `npm run build`.

---

## 2. Mobile app setup

```bash
cd mobile
npm install
npm start          # then press 'w' for web, 'a' for Android, 'i' for iOS
```

### Pointing the app at the backend

`mobile/src/config.js` picks a sensible default per platform:

| Where you run the app            | API base URL used          |
| -------------------------------- | -------------------------- |
| Web / iOS simulator              | `http://localhost:4000`    |
| Android emulator                 | `http://10.0.2.2:4000`     |
| Physical device (Expo Go)        | set `EXPO_PUBLIC_API_URL`  |

For a physical device, start the app with your computer's LAN IP, e.g.:

```bash
# Windows PowerShell
$env:EXPO_PUBLIC_API_URL="http://192.168.1.50:4000"; npm start
```

Make sure the phone and computer are on the same network and the backend is
reachable at that address.

### Running on a physical phone with Expo Go

1. Ensure phone + computer are on the **same Wi-Fi**.
2. Start with your LAN IP so the phone can reach both Metro and the backend:
   ```bash
   # Windows PowerShell, from mobile/
   $env:EXPO_PUBLIC_API_URL="http://<your-LAN-IP>:4000"; npx expo start
   ```
   Find `<your-LAN-IP>` with `ipconfig` (the IPv4 address, e.g. 192.168.x.x).
3. If the phone cannot reach Metro over the LAN (common on corporate/guest
   Wi-Fi), start in tunnel mode: `npx expo start --tunnel`.
4. Scan the QR code with Expo Go.

### Performance tips (emulator or device)

The default `expo start` serves a **development** bundle, which is large and can
feel sluggish or appear to hang on a slow emulator. For a smooth demo, run the
app in production mode (minified, no dev overhead):

```bash
npx expo start --no-dev --minify
```

Also give the Android emulator enough RAM/CPU and enable hardware acceleration
(Haxm/Hyper-V) in Android Studio's AVD settings.

---

## Features mapped to the brief

| Requirement                               | Where                                             |
| ----------------------------------------- | ------------------------------------------------- |
| Register / login securely                 | `auth/register`, `auth/login`, JWT + bcrypt       |
| Record income & expenses                  | `transactions` (POST), Add Transaction screen     |
| Categorize transactions                   | `categories`, predefined + custom                 |
| Edit / delete transactions                | `transactions/[id]` (PUT/DELETE)                  |
| Unique transaction ID                     | `TXN-YYYYMMDD-XXXXXXXX` + UNIQUE constraint       |
| Monthly budgets per category              | `budgets` (upsert), Budget screen                 |
| Total income / expense / balance          | `summary`, Dashboard hero card                    |
| Daily / weekly / monthly summaries        | `summary`                                         |
| Spending charts                           | `charts`, Analysis screen (pie/line/bar)          |
| Budget approaching / exceeded alerts      | `lib/budget.js` + `notifications`                 |
| Search & filter (date/category/type)      | `transactions` query params, History screen       |
| Transaction history                       | History screen                                    |
| Export monthly report                     | `reports/monthly?format=csv`, Report screen       |
| Authentication & user-specific access     | per-user scoping on every query                   |
| Admin: usage stats, predefined categories | `admin/stats`, `admin/categories`                 |
| Admin privacy (no personal txn details)   | aggregates only; `admin/activity` hides detail    |

---

## Security, auditing & logging

- **Passwords** are bcrypt-hashed; plaintext is never stored or logged.
- **JWT** verification guards every protected route; `requireAdmin` enforces
  role-based access (regular users receive `403` on admin endpoints).
- **Per-user scoping:** every transaction/budget/notification query is scoped to
  the authenticated user id, so users can only access their own data.
- **Admin privacy:** admins see aggregate usage metrics only. The activity feed
  withholds the before/after values of transactions and budgets
  (`[hidden for user privacy]`).
- **Parameterized SQL** everywhere (no string interpolation of user input).
- **Input validation** with zod on every write endpoint; client errors are
  generic (no stack traces leaked).
- **Audit trail:** every create/update/delete writes an append-only row to
  `audit_log` (what / when / who) in the same transaction as the data change;
  sensitive fields are redacted.
- **Structured logging** that sanitizes secrets before output.

## Notes & trade-offs

- The mobile app stores the JWT in `AsyncStorage` so it also works on web. For a
  production device build, `expo-secure-store` is the more secure at-rest option.
- SQLite via `node:sqlite` keeps setup dependency-free and matches the brief's
  SQLite requirement. For higher concurrency, swap the `lib/db.js` layer for a
  client/server database.
- The CSV export link passes the JWT as a query parameter because a browser/OS
  "open URL" cannot attach an Authorization header; the token is still a signed
  JWT and is verified server-side.
