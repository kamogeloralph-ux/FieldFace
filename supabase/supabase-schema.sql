-- FieldFace database schema.
-- Run this once in the Supabase SQL editor (or via `pnpm db:push` using drizzle-kit).
-- All application reads/writes go through the Express/tRPC server using the
-- service role, so RLS below is defense-in-depth in case anything ever talks
-- to Supabase directly (e.g. client-side storage uploads).

create extension if not exists "pgcrypto";

create table if not exists public.employers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  contact_phone text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  employer_id uuid not null references public.employers(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'supervisor' check (role in ('owner', 'supervisor')),
  created_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null default 150,
  reference_photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  employee_code text not null,
  full_name text not null,
  id_number text,
  phone text,
  email text,
  pin_hash text not null,
  hourly_rate_weekday numeric(10, 2) not null,
  hourly_rate_weekend numeric(10, 2) not null,
  active boolean not null default true,
  self_service_gen_count integer not null default 0,
  self_service_gen_period text,
  created_at timestamptz not null default now(),
  unique (employer_id, employee_code)
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  entry_type text not null check (entry_type in ('clock_in', 'clock_out')),
  occurred_at timestamptz not null default now(),
  selfie_url text not null,
  latitude double precision not null,
  longitude double precision not null,
  distance_meters double precision not null,
  within_geofence boolean not null,
  gps_accuracy_meters double precision,
  created_at timestamptz not null default now()
);
create index if not exists time_entries_employee_idx on public.time_entries(employee_id, occurred_at desc);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  clock_in_entry_id uuid not null references public.time_entries(id),
  clock_out_entry_id uuid not null references public.time_entries(id),
  clock_in_at timestamptz not null,
  clock_out_at timestamptz not null,
  shift_date date not null,
  hours numeric(6, 2) not null,
  is_weekend boolean not null,
  both_within_geofence boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists shifts_employee_date_idx on public.shifts(employee_id, shift_date);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  employer_id uuid not null references public.employers(id) on delete cascade,
  period_year integer not null,
  period_month integer not null check (period_month between 1 and 12),
  weekday_hours numeric(8, 2) not null,
  weekend_hours numeric(8, 2) not null,
  total_hours numeric(8, 2) not null,
  hourly_rate_weekday numeric(10, 2) not null,
  hourly_rate_weekend numeric(10, 2) not null,
  gross_pay numeric(10, 2) not null,
  pdf_path text not null,
  generated_at timestamptz not null default now(),
  unique (employee_id, period_year, period_month)
);

-- ---------------------------------------------------------------------------
-- Storage buckets: selfies, site reference photos, generated payslip PDFs.
-- Kept private; the server issues short-lived signed URLs on demand.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('selfies', 'selfies', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('site-photos', 'site-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('payslips', 'payslips', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security. The server uses the service-role key (bypasses RLS)
-- for all normal application traffic, so these policies exist only to lock
-- the database down if anything is ever queried with the anon/authenticated
-- key directly (they deny everything by default).
-- ---------------------------------------------------------------------------
alter table public.employers enable row level security;
alter table public.admin_users enable row level security;
alter table public.sites enable row level security;
alter table public.employees enable row level security;
alter table public.time_entries enable row level security;
alter table public.shifts enable row level security;
alter table public.payslips enable row level security;
alter table public.platform_admins enable row level security;

drop policy if exists admin_read_own_employer on public.employers;
create policy admin_read_own_employer on public.employers for select to authenticated
  using (id in (select employer_id from public.admin_users where id = auth.uid()));

drop policy if exists admin_read_own_profile on public.admin_users;
create policy admin_read_own_profile on public.admin_users for select to authenticated
  using (id = auth.uid());

drop policy if exists admin_read_own_sites on public.sites;
create policy admin_read_own_sites on public.sites for select to authenticated
  using (employer_id in (select employer_id from public.admin_users where id = auth.uid()));

drop policy if exists admin_read_own_employees on public.employees;
create policy admin_read_own_employees on public.employees for select to authenticated
  using (employer_id in (select employer_id from public.admin_users where id = auth.uid()));

drop policy if exists platform_admins_read_own_profile on public.platform_admins;
create policy platform_admins_read_own_profile on public.platform_admins for select to authenticated
  using (id = auth.uid());

drop policy if exists payslips_read_authorized on public.payslips;
create policy payslips_read_authorized on public.payslips for select to authenticated
  using (
    exists (select 1 from public.platform_admins pa where pa.id = auth.uid())
    or exists (
      select 1 from public.admin_users au
      where au.id = auth.uid() and au.employer_id = payslips.employer_id
    )
  );

drop policy if exists shifts_read_authorized on public.shifts;
create policy shifts_read_authorized on public.shifts for select to authenticated
  using (
    exists (select 1 from public.platform_admins pa where pa.id = auth.uid())
    or exists (
      select 1
      from public.employees e
      join public.admin_users au on au.employer_id = e.employer_id
      where e.id = shifts.employee_id and au.id = auth.uid()
    )
  );

drop policy if exists time_entries_read_authorized on public.time_entries;
create policy time_entries_read_authorized on public.time_entries for select to authenticated
  using (
    exists (select 1 from public.platform_admins pa where pa.id = auth.uid())
    or exists (
      select 1
      from public.employees e
      join public.admin_users au on au.employer_id = e.employer_id
      where e.id = time_entries.employee_id and au.id = auth.uid()
    )
  );
