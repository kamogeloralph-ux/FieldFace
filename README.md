# FieldFace

A GPS + selfie-verified clock-in/out system for field and public works employees,
built for employers who don't have a clocking system yet.

- **Employee app** (`/`) — enter employee number + PIN, then clock in/out by taking a
  selfie at the supervisor-designated area. Both GPS location and the photo are
  captured and checked against a geofence around the site.
- **Company admin app** (`/company/login`) — manage employer details, worksites (with GPS
  point + reference photo of the designated spot), and employees (rates, PINs).
  Includes a live Daily Report dashboard and monthly PDF payslip generation.
- **Platform owner console** (`/admin/login`) — manage every company on FieldFace.

## Stack

React + Vite (two entry points: `client/index.html` for employees, `client/admin.html`
for admins) · Express + tRPC · Drizzle ORM · Supabase (Postgres, Storage, Auth) ·
pdfkit for payslip PDFs · node-cron for the monthly auto-generation job.

## 1. Create a Supabase project

1. Create a project at supabase.com.
2. In **Project Settings → Database**, copy the connection string (URI, "Session pooler"
   or direct connection both work) into `DATABASE_URL`.
3. In **Project Settings → API**, copy the Project URL and the `service_role` key into
   `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, and the Project URL + `anon` public key
   into `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
4. Copy `.env.example` to `.env` and fill in all of the above, plus a random
   `SESSION_SECRET` (e.g. `openssl rand -hex 32`).

## 2. Create the database schema

Open the Supabase SQL editor and run everything in `supabase/schema.sql`. This creates
all tables, the three storage buckets (`selfies`, `site-photos`, `payslips` — all
private), and baseline RLS policies.

(Alternative: `pnpm db:push` uses `drizzle/schema.ts` via drizzle-kit if you'd rather
manage migrations that way — the SQL file is the source of truth for storage buckets
and RLS either way, so run it at least once.)

## 3. Install and create your first supervisor login

```bash
pnpm install
```

In the Supabase dashboard, go to **Authentication → Users → Add user** and create the
first supervisor's email + password. Copy their User UID, then run:

```bash
pnpm seed "Your Company Name" "owner@yourcompany.com" "<user-uid-you-copied>"
```

This creates the employer record and links that login as the account **owner**.

## 4. Run it

```bash
pnpm dev
```

- Employee app: http://localhost:5173/
- Company admin app: http://localhost:5173/company/login
- Platform owner console: http://localhost:5173/admin/login

In the admin app: sign in → add a **Site** (use "Use my current location" while
standing at the designated spot, set a geofence radius, upload a reference photo of
where employees should stand) → add **Employees** (set hourly rates for weekday vs.
weekend, assign them to the site, set a starting PIN) → give employees their employee
code + PIN.

## How the numbers work

- Every clock-in/out is one `time_entries` row with the selfie, GPS point, distance
  from the site, and a `within_geofence` flag (recorded either way — it never blocks
  a clock-in, just flags it for the supervisor).
- The moment a clock-out is recorded, a `shifts` row is created with hours computed
  from the paired clock-in, and `is_weekend` set from the shift's calendar date
  (Saturday/Sunday by default — see `WEEKEND_DAYS` in `shared/const.ts` to change).
- The **Daily Report** page reads today's `time_entries` directly, live.
- **Payslips**: on the 1st of each month at 02:00, the server sums each employee's
  `shifts` for the month just ended into weekday/weekend hours, multiplies by their
  rates, renders a PDF (pdfkit), and stores it in the `payslips` bucket. Supervisors
  can also trigger this manually (or regenerate) from the Payslips page at any time.

## Notes / things to adapt before going to production

- **Employee identity**: employees log in with an employee number + PIN (no email needed — common
  for public works crews). Tax numbers are stored in employee details for payroll and payslips,
  not used for clock-in. PINs are bcrypt-hashed; the admin can reset one from the Employees page.
- **Geofence is a flag, not a hard block**: an out-of-range clock-in still succeeds
  (GPS is often noisy on site) but is clearly flagged on the Daily Report so a
  supervisor can follow up, rather than locking a legitimate worker out.
- **Currency**: payslips default to "R" (Rand) — change the `currency` default in
  `server/pdf/payslip.ts` if needed.
- This was scaffolded without a working `node_modules` install/build check in the
  authoring environment (no network access there) — run `pnpm install && pnpm check`
  after downloading to catch any dependency-version mismatches before deploying.
