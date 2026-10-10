# Trackaa: personal finance tracker (GH₵)

A mobile-first app for recording every cedi you earn and spend, across personal life and your businesses, in a few seconds.

```
trackaa/
├── backend/    Laravel 13 REST API (Sanctum token auth, SQLite / MySQL / Postgres)
└── frontend/   Next.js 15 + TypeScript + Tailwind v4 (installable PWA)
```

The frontend is a client-side app. It talks to the API with a bearer token. All money arithmetic happens in the API, in **integer pesewas** (GH₵ 1.00 = 100). Floats are never used.

---

## Run it locally

You need PHP 8.3+, Composer, and Node 20+.

### 1. API (terminal 1)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite      # SQLite is the default locally
php artisan migrate
php artisan serve                   # http://localhost:8000
```

Optional sample data, in a separate demo account (`demo@trackaa.test` / `password`):

```bash
php artisan db:seed --class=DemoSeeder
```

### 2. Web app (terminal 2)

```bash
cd frontend
npm install
cp .env.example .env.local          # NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm run dev                         # http://localhost:3000
```

Open http://localhost:3000, create an account, and tap **+**.

---

## Environment variables

### backend/.env

| Variable | Purpose |
| --- | --- |
| `APP_KEY` | Laravel key (`php artisan key:generate`) |
| `APP_URL` | Public URL of the API |
| `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | Database (`sqlite`, `mysql` or `pgsql`) |
| `FRONTEND_URL` | Frontend origin(s) allowed by CORS, comma-separated, e.g. `https://trackaa.vercel.app` |
| `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS` | Sends password-reset emails. Any SMTP provider works (Resend, Mailgun, Brevo, Gmail SMTP). Locally `MAIL_MAILER=log` writes the email to `storage/logs/laravel.log` |
| `CRON_SECRET` | Enables `/api/cron/reminders?token=…`, for hosts without a scheduler (Render free plan) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | *Optional.* Push-reminder keys. If unset, a key pair is generated automatically and stored in the database |

### frontend/.env.local

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API base URL including `/api`, e.g. `https://api.trackaa.com/api` |

No secrets live in the frontend. The only browser-side value is the public API URL.

---

## Deploying on Render (recommended)

The repo is ready for Render: one **free web service** runs the website and the API together (`Dockerfile` + `render.yaml`). You need two other free accounts: a database (Neon) and a pinger (cron-job.org).

### 1. Create the database (Neon, free, never expires)
Render's own free Postgres is deleted after 30 days, so use Neon (or a *paid* Render Postgres).
1. Sign up at neon.tech → **New project** (pick a region near your Render region, e.g. Frankfurt).
2. On the dashboard, open **Connect**, turn **off** "Connection pooling", and copy the connection string. It looks like `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.

*(Paid Render Postgres instead: create it in the same region, then copy its **Internal Database URL**.)*

### 2. Deploy the Blueprint
1. Push this code to your GitHub `main` branch.
2. Render dashboard → **New** → **Blueprint** → connect the `trackaa` repo → it reads `render.yaml`.
3. When asked for **`DB_URL`**, paste the connection string from step 1. `APP_KEY` and `CRON_SECRET` are generated for you.
4. **Apply**. The first build takes about 5–10 minutes. When it says *Live*, open `https://<your-service>.onrender.com`, create your account, and record a transaction.

Every start runs database migrations automatically. Every push to `main` redeploys.

### 3. Phone reminders (optional, cron-job.org, free)
Free Render services sleep after 15 minutes without visits. The first visit after that takes about a minute while the app wakes up; after that it's fast. That's fine for personal use. **A sleeping app can't send push reminders**, though; the in-app reminder banner still works.

For phone reminders, wake the app at reminder time instead of keeping it awake all day. A pinger every few minutes would also keep the Neon database awake 24/7, and that alone uses more than Neon's free monthly compute.
1. In Render → your service → **Environment**, copy the value of `CRON_SECRET`.
2. At cron-job.org → **Create cronjob**:
   - URL: `https://<your-service>.onrender.com/api/cron/reminders?token=<CRON_SECRET>`
   - Schedule: **custom**, at the reminder time **and 5 minutes later**, e.g. `0,5 20 * * *` for 20:00 and 20:05. The first call wakes the app (it may time out); the second sends.
   - Make sure the cron-job.org time zone matches yours (Ghana = UTC / GMT).

Everyone whose reminder time has passed and who hasn't reviewed today gets it on that run. If your friends pick different times, add one pair of runs per time. Or pick one shared time, say 20:00.

### 4. Password-reset emails (optional but recommended)
In Render → **Environment**, add your email provider's SMTP details, then **Save** (it redeploys). Resend and Brevo both have free tiers.

```
MAIL_MAILER=smtp
MAIL_HOST=...        MAIL_PORT=587
MAIL_USERNAME=...    MAIL_PASSWORD=...
MAIL_FROM_ADDRESS=you@yourdomain.com
```

### 5. On your phone
- Open the site and add it to your Home Screen. On iPhone: Share → *Add to Home Screen*.
- In Settings, turn on **Phone notifications**.

Push keys are created automatically and stored in the database. Set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` only if you want to manage them yourself.

### Custom domain (optional)
Render → service → **Settings → Custom Domains**. After adding one, set `APP_URL=https://yourdomain.com` in Environment.

### Other hosts
The same `Dockerfile` runs on any Docker host (Fly.io, Railway, a VPS). Set `APP_KEY`, `DB_CONNECTION=pgsql`, `DB_URL`, `APP_URL`, `APP_ENV=production` and `APP_DEBUG=false`. For reminders, either call `/api/cron/reminders?token=…` on a schedule, or run `php artisan schedule:run` every minute.

To host the website separately (e.g. on Vercel), build `frontend` with `NEXT_PUBLIC_API_URL=https://<api>/api` (output is static files in `frontend/out`) and set `FRONTEND_URL` on the API to the website's address.

## Testing

```bash
cd backend && php artisan test      # 28 feature tests
cd frontend && npm test && npm run lint && npx tsc --noEmit && npm run build
```

The backend tests cover:

- creating income and expenses
- editing (including changing the type) and deleting, with all totals updating
- past-dated transactions landing in the right day, week, month or custom range
- transfers never counting as income or expense, while moving account balances correctly
- filters by business, scope, type and search, plus the per-business summary
- daily subtotals
- duplicate-submit protection
- validation (zero amounts, a category that doesn't match the type)
- archived categories keeping their history
- **one user cannot read, edit or delete another user's data, or attach records to another user's accounts or categories**
- the password flows: forgot, reset (which signs out other devices) and change
- login sessions that expire after 90 days without use and extend themselves with use
- the server-side end-of-day review
- the CSV export
- category usage ranking
- automatic push keys
- budgets: overall and per-category, by scope, with daily, weekly and monthly breakdown and "safe to spend per day"
- goals: progress, required weekly and monthly saving, projected finish date
- insights: monthly cash flow, daily spending, weekday pattern, category changes vs last month
- statement import: auto-matching (same amount, within 3 days, a transaction used only once), transfers, record-from-statement, ignore, manual link, re-import replaces, privacy between users

`npm test` covers the statement parser on MTN MoMo layouts (amount, fees, e-levy, balance before/after), bank layouts (debit/credit) and signed-amount layouts, plus PDF table reconstruction.

The suite passes on both SQLite and PostgreSQL.

---

## How it works

### Data model (`backend/database/migrations/2026_10_09_000100_create_finance_tables.php`)

| Table | Key fields |
| --- | --- |
| `transactions` | `user_id`, `type` (income / expense / transfer), `amount` (bigint pesewas, > 0), `scope` (personal / business), `business_id?`, `category_id?` (null only for transfers), `account_id`, `to_account_id?` (transfers only), `description?`, `occurred_at`, `client_ref?` (idempotency key) |
| `accounts` | `user_id`, `name`, `account_type` (mobile_money / cash / bank / other), `opening_balance` (pesewas), `archived_at` |
| `businesses` | `user_id`, `name`, `archived_at` |
| `categories` | `user_id` (nullable, reserved for future shared defaults), `name`, `transaction_type`, `archived_at` |
| `push_subscriptions` | browser push endpoints for reminders |
| `users` | plus `timezone`, `reminder_enabled`, `reminder_time` |

New users get their own copy of the default categories, the businesses (MachineWura, MediaWura, SneakersInn, Paylead, Other) and the accounts (Mobile Money, Cash, Bank). That way each user can rename or archive them.

### Security

Supabase uses Row Level Security for this. This Laravel API does the same job in code:

- every query starts from `$request->user()->transactions()`, `->accounts()` and so on
- route-bound records go through `authorizeOwner()`, which returns 404 for anyone else's record
- every `account_id`, `category_id` and `business_id` in a write is validated with `exists ... where user_id = me`

Login and register are rate-limited.

### Numbers

- **Net cash flow** = income − expenses for the period, by `occurred_at`. Transfers are excluded.
- **Recorded balance** for an account = opening balance + income − expenses ± transfers. The UI says plainly that this is *not* your real MoMo or bank balance.
- Periods (today, week, month, custom) are calendar dates in the device's timezone, defaulting to Africa/Accra.

### Plan: budgets and goals

- **Monthly budget** for everything, personal or business, plus optional per-category budgets.
- Each budget is split into a **daily and weekly amount**. You also see what's left, a "safe to spend per day for the rest of the month" figure, today's and this week's spending against the daily and weekly amounts, and a pace marker showing where even spending would put you.
- Statuses are always shown with an icon and a label, never colour alone: *On track*, *Spending fast*, *Over budget*.
- **Goals** have a target and an optional date. Add or take out money, and see how much to put aside each week or month, your projected finish date at recent pace, and a progress chart with a table view.

### Insights

- One filter row (All / Personal / Business, a single business, and 3/6/12 months) controls everything on the page.
- Stat tiles show average daily spend, projected month spend, savings rate and usual monthly spend.
- A plain-language "What stands out" list.
- Charts: **Money in and out** by month (money in above the line, money out below, so it doesn't rely on red vs green, plus a net dot), **daily spending** against your daily budget line, and **spending by day of week**. Every chart has a Table view and keyboard/hover tooltips.
- Category changes vs the same point last month, and this month's biggest expenses.

### Reconcile (MoMo / bank statements)

1. Plan → Reconcile → Import. Pick the account and a statement file: **CSV, Excel (.xlsx) or PDF**. Password-protected PDFs are supported.
2. The file is **parsed in the browser**; only the transaction lines go to the server. Columns are detected automatically (MTN-style *AMOUNT / FEES / E-LEVY / BAL BEFORE / BAL AFTER*, bank-style *Debit / Credit*, or a signed amount), and you can fix them before importing. Fees and e-levy can become separate lines.
3. Each line is matched to a recorded transaction on that account with the same amount, within 3 days. You then see:
   - **Missing** (on the statement, not in Trackaa): add with one tap, link to something you recorded, or ignore.
   - **Only here** (in Trackaa, not on the statement).
   - **Matched**.
   - Statement vs recorded **totals and closing balance**.
4. Import one statement per account per month. Re-importing replaces it; deleting a statement never deletes transactions.

### Quick Add

- **Phones get a built-in number keypad**, so the system keyboard never covers the form. The amount stays pinned at the top and the keypad and Save at the bottom.
- **Categories are icon tiles, sorted by how often you've used them** in the last 90 days.
- Every new entry starts as **Expense**, so income is always a deliberate tap. Your last account, scope, business and category per type are remembered.
- On desktop you type the amount directly. Press **N** anywhere to open Quick Add, and **Enter** saves.
- Every submit carries a `client_ref` UUID, so a double tap or a network retry can't create duplicates.
- After saving, a toast offers **Undo**.
- **Offline**: with no connection, the transaction is kept on the phone and synced automatically when you're back online. The same `client_ref` makes the retry safe.

### API

All endpoints need a bearer token except the two auth routes.

```
POST   /api/auth/register  /api/auth/login  /api/auth/logout
GET    /api/me            PATCH /api/me              (name, timezone, reminder settings)
GET    /api/overview      ?scope=&business_id=&period=today|week|month|custom&from=&to=&tz=
GET    /api/transactions  ?q=&type=&scope=&business_id=&category_id=&account_id=&from=&to=&page=
POST   /api/transactions  PATCH/DELETE /api/transactions/{id}
GET|POST /api/accounts | /api/businesses | /api/categories   PATCH /{id} (rename, archived: true|false)
GET    /api/push/key      POST|DELETE /api/push/subscribe
```

---

## Known limitations

- **Push reminders need something to trigger them**: scheduled cron-job.org calls on Render (see above), or the Laravel scheduler elsewhere. On Render's free plan the app sleeps when idle, so the first visit after a quiet spell takes about a minute. On iPhone, Web Push also requires adding the app to the Home Screen (iOS 16.4+). Otherwise you get the in-app banner after your reminder time.
- **Password-reset emails need an SMTP provider** configured (`MAIL_*`).
- **Login tokens are kept in `localStorage`.** They expire after 90 days of not being used. Fine for a personal tool; for extra hardening, switch to cookie-based Sanctum SPA auth.
- **Offline**: new transactions are queued while offline. Editing or deleting an existing transaction still needs a connection.
- **Category type can't be changed after creation**, to keep past transactions consistent. Archive the category and create a new one instead.
- **Statement PDFs must contain text.** Scanned or photographed statements aren't read. CSV or Excel exports are the most reliable. Column detection is heuristic, so check the preview.
- **Goal contributions are tracked separately from transactions.** To record the money moving, also add a transfer to your savings account.
- **Deliberately out of scope**: receipt scanning, live bank or MoMo sync, multi-user businesses. The schema (per-user ownership, a separate transfers type, archivable reference data) leaves room for them.
