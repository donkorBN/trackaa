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
| `SIGNUP_MODE` | `code` (default): every new account needs a single-use access code. `open`: anyone can sign up |
| `ADMIN_EMAILS` | Comma-separated emails that get the **Access codes** admin screen |
| `BUY_URL` | *Optional.* Where people buy a code (e.g. a Paystack payment page). Shown on the landing page and sign-up form |
| `PRICE_LABEL` | *Optional.* Shown next to the buy button, e.g. `GH₵ 50, one-time` (quote it in a `.env` file) |
| `FRONTEND_URL` | Frontend origin(s) allowed by CORS, comma-separated, e.g. `https://trackaa.vercel.app` |
| `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS` | Sends password-reset emails. Any SMTP provider works (Resend, Mailgun, Brevo, Gmail SMTP). Locally `MAIL_MAILER=log` writes the email to `storage/logs/laravel.log` |

### frontend/.env.local

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API base URL including `/api`, e.g. `https://api.trackaa.com/api` |

No secrets live in the frontend. The only browser-side value is the public API URL.

---

## Deploying on Render (recommended)

The repo is ready for Render: one **free web service** runs the website and the API together (`Dockerfile` + `render.yaml`). You also need a free database account (Neon). No pinger is needed.

### 1. Create the database (Neon, free, never expires)
Render's own free Postgres is deleted after 30 days, so use Neon (or a *paid* Render Postgres).
1. Sign up at neon.tech → **New project** (pick a region near your Render region, e.g. Frankfurt).
2. On the dashboard, open **Connect**, turn **off** "Connection pooling", and copy the connection string. It looks like `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.

*(Paid Render Postgres instead: create it in the same region, then copy its **Internal Database URL**.)*

### 2. Deploy the Blueprint
1. Push this code to your GitHub `main` branch.
2. Render dashboard → **New** → **Blueprint** → connect the `trackaa` repo → it reads `render.yaml`.
3. When asked for **`DB_URL`**, paste the connection string from step 1. `APP_KEY` is generated for you.
4. **Apply**. The first build takes about 5–10 minutes. When it says *Live*, open `https://<your-service>.onrender.com`, create your account, and record a transaction.

Every start runs database migrations automatically. Every push to `main` redeploys.

**Deploy only when tests pass:** the repo has a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs the backend tests on SQLite and PostgreSQL plus the frontend lint, typecheck, parser tests and build. In Render → your service → **Settings → Build & Deploy → Auto-Deploy**, choose **After CI Checks Pass**.

**Selling access:** sign-up needs a single-use access code (`SIGNUP_MODE=code`, the default). In Render → **Environment**:
1. Set `ADMIN_EMAILS` to your own login email. You'll get **Access codes** in Settings (and the desktop sidebar).
2. Set `BUY_URL` to where people pay (a Paystack payment page works with MoMo and cards) and `PRICE_LABEL` to the price.
3. In **Access codes**, create a batch. After each payment, send the buyer one code, or the **Link** button's sign-up link, which fills the code in for them.

Visitors who aren't logged in land on `/start`, a landing page made for ad traffic. Existing accounts are unaffected.

Free Render services sleep after 15 minutes without visits. The first visit after that takes about a minute while the app wakes up; after that it's fast. That's fine for personal use, so there's no need to keep it awake (a pinger would also keep Neon awake and use up its free compute). Once the app has been opened on a phone, it opens instantly from its offline copy and shows *Waking up the server…* while the API starts; anything saved meanwhile is kept and synced.

### 3. Password-reset emails (recommended)
Until this is set up, the *Forgot password* page says email isn't available instead of pretending to send a link. In Render → **Environment**, add your email provider's SMTP details, then **Save** (it redeploys). Resend and Brevo both have free tiers.

```
MAIL_MAILER=smtp
MAIL_HOST=...        MAIL_PORT=587
MAIL_USERNAME=...    MAIL_PASSWORD=...
MAIL_FROM_ADDRESS=you@yourdomain.com
```

### 4. On your phone
Open the site and add it to your Home Screen. On iPhone: Share → *Add to Home Screen*.

### Custom domain (optional)
Render → service → **Settings → Custom Domains**. After adding one, set `APP_URL=https://yourdomain.com` in Environment.

### Other hosts
The same `Dockerfile` runs on any Docker host (Fly.io, Railway, a VPS). Set `APP_KEY`, `DB_CONNECTION=pgsql`, `DB_URL`, `APP_URL`, `APP_ENV=production` and `APP_DEBUG=false`.

To host the website separately (e.g. on Vercel), build `frontend` with `NEXT_PUBLIC_API_URL=https://<api>/api` (output is static files in `frontend/out`) and set `FRONTEND_URL` on the API to the website's address.

## Testing

```bash
cd backend && php artisan test      # 36 feature tests
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
- access codes (single use, revoked codes rejected, sloppy typing accepted, admin-only management), account deletion (password required, everything removed, nobody else affected)
- business categories hidden for personal-only users and restored when a business is added, never touching ones the user archived or used
- the server-side end-of-day review
- the CSV export
- category usage ranking
- streaks, levels and badges; check-ins only for today or yesterday
- deleting accounts, businesses and categories only when unused (otherwise archive)
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
| `activity_days` | one row per day you logged something or checked in (`logged` / `checkin`); drives streaks |
| `users` | plus `timezone`, `last_reviewed_on` |

New users get their own copy of the default categories and accounts (Mobile Money, Cash, Bank), then a short **welcome** flow: switch off accounts they don't use, set opening balances, add their own businesses (or none, which hides every Personal/Business control), and optionally set a monthly budget. Everything can be renamed, archived, or deleted while unused.

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

- **On phones it's two roomy steps**: first the amount on a big built-in keypad (the system keyboard never opens), then the details: category tiles, plus pills for account, date, note and (if you have businesses) Personal/Business.
- **Categories are icon tiles, sorted by how often you've used them** in the last 90 days.
- Every new entry starts as **Expense**, so income is always a deliberate tap. Your last account, scope, business and category per type are remembered.
- On desktop you type the amount directly. Press **N** anywhere to open Quick Add, and **Enter** saves.
- Every submit carries a `client_ref` UUID, so a double tap or a network retry can't create duplicates.
- After saving, a success screen shows the amount and your streak, with **Undo**, **Add another** and **Done**. Phones get a little vibration; milestones get confetti.
- **Offline**: with no connection, the transaction is kept on the phone and synced automatically when you're back online. The same `client_ref` makes the retry safe.

### Streaks and badges

- A day counts when you record a transaction, or tap **"I spent nothing today"** (Today card or Today's review, for today or yesterday only).
- The flame chip shows your streak; tap it for your week, level (Newcomer → Cedi Sensei, by active days) and badges.
- New badges pop up once per device, batched together, and never on top of an open sheet.
- There are no notifications: the habit is opening the app when you spend.

### API

All endpoints need a bearer token except the two auth routes.

```
POST   /api/auth/register  /api/auth/login  /api/auth/logout
GET    /api/meta          (public: mail_enabled, access_code_required, buy_url, price_label)
GET    /api/me            PATCH /api/me              (name, timezone)    DELETE /api/me  { password }
GET    /api/overview      ?scope=&business_id=&period=today|week|month|custom&from=&to=&tz=
GET    /api/transactions  ?q=&type=&scope=&business_id=&category_id=&account_id=&from=&to=&page=
POST   /api/transactions  PATCH/DELETE /api/transactions/{id}
GET|POST /api/accounts | /api/businesses | /api/categories   PATCH|DELETE /{id} (rename, archived: true|false; delete only if unused)
GET    /api/progress      streak, week, level, badges
POST   /api/review        { date }  check in (today or yesterday)
GET    /api/admin/stats   GET|POST /api/admin/codes   PATCH /api/admin/codes/{id}   (admins only; 404 for everyone else)
```

---

## Known limitations

- **On Render's free plan the app sleeps when idle**, so the first visit after a quiet spell takes about a minute.
- **Password-reset emails need an SMTP provider** configured (`MAIL_*`); without one, the reset page says so.
- **Login tokens are kept in `localStorage`.** They expire after 90 days of not being used. Fine for a personal tool; for extra hardening, switch to cookie-based Sanctum SPA auth.
- **Offline**: new transactions are queued while offline. Editing or deleting an existing transaction still needs a connection.
- **Category type can't be changed after creation**, to keep past transactions consistent. Archive the category and create a new one instead.
- **Statement PDFs must contain text.** Scanned or photographed statements aren't read. CSV or Excel exports are the most reliable. Column detection is heuristic, so check the preview.
- **Goal contributions are tracked separately from transactions.** To record the money moving, also add a transfer to your savings account.
- **Deliberately out of scope**: receipt scanning, live bank or MoMo sync, multi-user businesses. The schema (per-user ownership, a separate transfers type, archivable reference data) leaves room for them.
