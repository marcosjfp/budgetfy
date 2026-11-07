# 💰 Budgetfy 1.0.0

A modern budget and expense management application designed for seamless group sharing and financial tracking.

## 🚀 Features

- **🔐 Secure Authentication**: User registration and login powered by JWT and bcrypt.
- **👥 Group Management**: Create shared groups to manage expenses with friends or family.
- **💸 Expense Tracking**: Easily add and categorize expenses within specific groups.
- **📊 Data Visualization**: Dynamic, interactive charts to visualize spending patterns using Recharts.
- **🤝 Settle up**: Per-group balances ("who owes whom") with a minimized set of suggested payments, recorded settle-up payments (cash, transfer, Pix…) and a cross-group "You owe / You are owed" summary on the Dashboard.
- **✉️ Member invites**: Admins add existing Budgetfy users to a group by email, with clear (translated) errors.
- **💱 Per-group currencies**: Each group has its own currency (BRL, USD, EUR, GBP), editable by admins. Dashboard totals are grouped per currency (no FX conversion).
- **🔎 Search, filters & CSV export**: Find transactions by text, category, payer, date range and status; export a group's expenses to CSV (localized headers, Excel-friendly UTF-8 BOM; `;` separator and decimal comma in Portuguese).
- **↩️ Undo on delete**: Deleting an expense shows an "Undo" toast for ~5 s before anything is sent to the server.
- **🙋 Profile & synced preferences**: Edit your display name; language, currency and theme are saved to your account and follow you across devices (localStorage is the offline fallback).
- **🌍 English & Português (Brasil)**: Full UI translation, locale-aware dates/numbers/currency, translated server errors.
- **✨ Modern UI/UX**: A responsive, accessible interface built with Tailwind CSS 4 and smooth animations from Motion.

## 🛠️ Tech Stack

### **Frontend**

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations**: [Motion](https://motion.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)

### **Backend**

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express](https://expressjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)

### **Security & Utilities**

- **Authentication**: JSON Web Tokens (JWT) & bcryptjs
- **Environment**: Dotenv for configuration
- **Development**: tsx for seamless TypeScript execution and Concurrently for running parallel processes

## 🏃 Getting Started

### **Prerequisites**

- **Node.js** (v18 or higher recommended)
- **PostgreSQL** instance (local or hosted)

### **Installation**

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd budgetfy
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Environment Setup:**
   Copy `.env.example` to `.env.local` and configure it (every variable is documented there):

   ```env
   DATABASE_URL=postgresql://your_user:your_password@localhost:5432/budgetfy
   JWT_SECRET=<output of: openssl rand -base64 48>
   FIREBASE_PROJECT_ID=your-firebase-project-id
   CORS_ORIGINS=http://localhost:3000
   ```

4. **Initialize Database:**
   Push the Drizzle schema to your PostgreSQL database:
   ```bash
   npm run db:push
   ```

### **Database migrations**

The schema lives in `server/schema.ts` (Drizzle). After pulling new code, update an existing database with:

```bash
npm run db:push
```

`drizzle.config.ts` uses `strict: true`, so drizzle-kit prints the SQL and asks for confirmation — review it before accepting. Changes so far (all additive and backward compatible; existing rows keep working):

| Change | Column / table | Default for existing data |
| :-- | :-- | :-- |
| Per-group currency | `groups.currency text` (nullable) | `NULL` = shown in each viewer's preferred currency (previous behaviour) |
| Synced preferences | `users.preferences jsonb` | `{}` |
| Linked Google account | `users.firebase_uid text unique` | `NULL` |
| Settle-up payments | new table `settlements (id, group_id, from_user, to_user, amount, date, note, created_by, created_at)` | — |

If you prefer to apply them by hand:

```sql
ALTER TABLE "groups" ADD COLUMN IF NOT EXISTS "currency" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferences" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firebase_uid" text;
ALTER TABLE "users" ADD CONSTRAINT "users_firebase_uid_unique" UNIQUE ("firebase_uid");
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "participants" jsonb;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_user_unique" UNIQUE ("group_id", "user_id");
CREATE TABLE IF NOT EXISTS "rate_limits" ("key" text PRIMARY KEY, "hits" integer NOT NULL, "reset_at" timestamptz NOT NULL);
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "created_by" text;
-- One-off: dates saved at midnight UTC by older versions showed a day early west of UTC; move them to midday.
UPDATE "expenses" SET "date" = "date" + interval '12 hours' WHERE ("date" AT TIME ZONE 'UTC')::time = '00:00:00';
UPDATE "expenses" SET "due_date" = "due_date" + interval '12 hours' WHERE "due_date" IS NOT NULL AND ("due_date" AT TIME ZONE 'UTC')::time = '00:00:00';
UPDATE "settlements" SET "date" = "date" + interval '12 hours' WHERE ("date" AT TIME ZONE 'UTC')::time = '00:00:00';
CREATE TABLE IF NOT EXISTS "settlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "from_user" text NOT NULL,
  "to_user" text NOT NULL,
  "amount" numeric NOT NULL,
  "date" timestamp with time zone DEFAULT now() NOT NULL,
  "note" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
```

The app degrades gracefully if the `settlements` table is missing (balances simply ignore payments), but run the migration before using Settle up.

### **Running the Application**

To start both the frontend (Vite) and backend (Express) servers simultaneously, run:

```bash
npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 🤝 How balances are calculated

Balances are derived on the client (`src/utils/settle.ts`) from expenses plus recorded payments, in integer cents:

- Only **paid** expenses create debts; **pending** bills are ignored until marked paid.
- **Equal** split: shared by the group's *current* members (same rule as the stats tiles; leftover cents go to the first members in a stable order). **Percentage/exact** splits use each expense's `splitDetails`.
- A payment "A paid B x" raises A's balance and lowers B's by x.
- Suggested payments use a greedy "largest debtor pays largest creditor" pass, which needs at most *n − 1* transfers.

## 🔌 API additions

| Method & path | Who | Body / response |
| :-- | :-- | :-- |
| `GET /api/groups/:id/settlements` | members | `[{ id, groupId, fromUser, toUser, amount, date, note, createdBy, createdAt }]` |
| `POST /api/groups/:id/settlements` | members for payments they're part of; admins for any | `{ fromUser, toUser, amount, date?, note? }` → 201 settlement |
| `DELETE /api/groups/:id/settlements/:settlementId` | whoever recorded it, or an admin | `{ ok: true }` |
| `GET /api/users/me` | signed in | `{ uid, displayName, email, photoURL, createdAt, preferences }` |
| `PATCH /api/users/me` | signed in | `{ displayName?, preferences?: { language?: 'en'\|'pt', currency?: 'BRL'\|'USD'\|'EUR'\|'GBP', theme?: 'light'\|'dark' } }` (preferences are merged) |
| `POST /api/groups` / `PATCH /api/groups/:id` | — | accept `currency` (omitted on PATCH = unchanged; on create defaults to the creator's saved preference) |
| `POST /api/groups/:id/members` | admins | now also returns the new `member` alongside `ok: true` |

New error codes: `SETTLEMENT_NOT_FOUND`, `INVALID_SETTLEMENT`. Group settings (`PATCH /api/groups/:id`) are now editable by any group **admin** (the owner is always an admin); deleting a group stays owner-only.

## 🔒 Security

- **Fail-fast configuration**: with `NODE_ENV=production` the API refuses to start if `JWT_SECRET` is missing or weak (< 32 chars / placeholder) or `FIREBASE_PROJECT_ID` is missing. There are no hard-coded secret or project fallbacks.
- **Authentication**: Budgetfy JWTs are HS256-pinned with issuer/audience checks and a configurable lifetime (`JWT_EXPIRES_IN`); Firebase ID tokens are verified with `firebase-admin`. Passwords are hashed with bcrypt (cost `BCRYPT_ROUNDS`, default 12) and must be 8+ characters with a letter and a number (max 72 bytes).
- **Authorization**: every `/api/groups/:id/...` route (including expenses) checks group membership; settings are admin-only and deletion is owner-only; member management is admin-only and the owner cannot be demoted or removed.
- **Input validation**: all bodies and route params are validated with [zod](https://zod.dev/); unknown fields are stripped (no mass assignment).
- **HTTP hardening**: `helmet` security headers, CORS restricted to `CORS_ORIGINS`, 100 kB JSON body limit, rate limiting (`express-rate-limit`) globally and stricter on login/register/email lookups. The strict limits keep their counters in Postgres (`rate_limits` table) so they hold across serverless instances. Set `TRUST_PROXY` behind a load balancer so limits apply per client IP.
- **Sessions**: login tokens carry `users.token_version`; **Preferences → Sign out of other devices** bumps it, which invalidates every other session.
- **Equal splits**: each equal-split expense stores its `participants` when created, so adding or removing members later doesn't change past balances.
- **Expense permissions**: only the person who added an expense (`created_by`), the person who paid it, or a group admin can edit or delete it (also for whole recurring series). Enforced on the server.
- **Recurring expenses**: `POST /api/groups/:id/expenses/series` with `{ expense, recurrence: { frequency, endDate } }` creates every occurrence on the server in one statement (up to 366; monthly/yearly keep the day, clamped to month end).
- **Dates**: calendar dates are sent as `YYYY-MM-DD` and stored at 12:00 UTC, so they show on the same day in every timezone from UTC-11 to UTC+11.
- **Errors**: a central handler returns `{ "error": string, "code": string }` (e.g. `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `NOT_A_MEMBER`, `RATE_LIMITED`) and never leaks stack traces or database errors.
- **`drop.ts`** wipes the database schema. It refuses to run with `NODE_ENV=production`, requires `--yes`, and only targets localhost unless `ALLOW_REMOTE_DROP=true`.
- **Firestore**: the app does not use Firestore; `firestore.rules` is locked down (members-only reads, no self-joining arbitrary groups).

## 📜 Available Scripts

| Script            | Description                                             |
| :---------------- | :------------------------------------------------------ |
| `npm run dev`     | Starts frontend and backend concurrently in watch mode. |
| `npm run build`   | Compiles the frontend application for production.       |
| `npm run db:push` | Synchronizes the Drizzle schema with the database.      |
| `npm run lint`    | Runs TypeScript type checking.                          |
| `npm run clean`   | Deletes the production `dist` directory.                |
| `npm run preview` | Locally previews the production build.                  |

---

Built by Marcos Fernandes for better financial management.

## ▲ Deploy to Vercel (free Hobby plan)

The repo is ready for Vercel: `vercel.json` builds the Vite frontend into `dist/` and serves the Express API as one serverless function (`api/index.ts`, which imports `server/index.ts`). Functions run in Frankfurt (`fra1`), next to the Neon database.

1. Import the GitHub repo in Vercel (framework: Vite; settings come from `vercel.json`).
2. Add environment variables for Production and Preview:
   - `DATABASE_URL`: Neon pooled connection string (`...-pooler...?sslmode=verify-full`)
   - `JWT_SECRET`: at least 32 random characters (`openssl rand -base64 48`)
   - `FIREBASE_PROJECT_ID`
   - `TRUST_PROXY=1`
   - `VITE_FIREBASE_API_KEY`: Firebase web key, for Google sign-in (also add the site's domain in Firebase → Authentication → Settings → Authorized domains)
   - `VITE_AMPLITUDE_API_KEY`: optional; analytics only loads after the user accepts the consent banner, and session replays mask all text
3. Run `npm run db:push` once against the database, then push to `main` to deploy.

`CORS_ORIGINS` is optional: the API always accepts requests from the site serving it. Login, sign-up and lookup limits are stored in Postgres, so they are shared by all function instances.

**Local development** uses a separate Neon branch (`dev`, a copy of the live data) via `DATABASE_URL` in `.env.local`; the live site's database is kept as `LIVE_DATABASE_URL` for migrations (`DATABASE_URL=$LIVE_DATABASE_URL npm run db:push`).
