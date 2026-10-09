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
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | *Optional.* Enables phone push reminders. Generate with `php artisan webpush:vapid` |

### frontend/.env.local

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API base URL including `/api`, e.g. `https://api.trackaa.com/api` |

No secrets live in the frontend. The only browser-side value is the public API URL.

---

## Deploying

**Frontend → Vercel.** Import the repo, set **Root Directory** to `frontend`, add `NEXT_PUBLIC_API_URL`, and deploy.

**API → any PHP host** (Laravel Cloud, Forge, Railway, Render, a VPS). Set the root to `backend` and use MySQL or Postgres. Then:

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache
```

Set `APP_ENV=production`, `APP_DEBUG=false`, and `FRONTEND_URL` to your Vercel URL.

**Daily push reminders** need the Laravel scheduler running every minute:

```
* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
```

(Laravel Cloud and Forge have a toggle for this.) Without VAPID keys or the scheduler, the app falls back to an in-app reminder banner.

---

## Testing

```bash
cd backend && php artisan test      # 14 feature tests
cd frontend && npm run lint && npx tsc --noEmit && npm run build
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

### Quick Add

- The amount field is focused when the sheet opens.
- Your last type, account, scope, business and category are remembered on each device.
- The Enter key submits.
- Every submit carries a `client_ref` UUID, so a double tap or a network retry can't create duplicates.
- After saving, a toast offers **Undo**.

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

## Known limitations (v1)

- **Push reminders need setup**: VAPID keys plus the scheduler cron. On iPhone, Web Push only works once the app is added to the Home Screen (iOS 16.4+). Everywhere else you get the in-app banner after your reminder time.
- **The "reviewed today" flag is stored per device**, not on the server.
- **Auth tokens are kept in `localStorage` and don't expire** until you log out. Fine for a personal tool. For extra hardening, set `SANCTUM_EXPIRATION` or move to cookie-based Sanctum SPA auth.
- **No password reset or email verification flow yet.** Laravel has both built in when you want to add them.
- **Offline**: the app shell loads offline, but recording a transaction needs a connection. There's no offline queue yet.
- **Category type can't be changed after creation**, to keep past transactions consistent. Archive the category and create a new one instead.
- **Deliberately out of scope for v1**: budgets, reports, receipt scanning, bank or MoMo sync, multi-user businesses. The schema (per-user ownership, a separate transfers type, archivable reference data) leaves room for them.
