-- Company-configured hourly wage rates by employee position.
create table if not exists public.position_wage_rates (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  position text not null,
  hourly_rate_weekday numeric(10, 2) not null default 0,
  hourly_rate_weekend numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employer_id, position)
);
