-- FieldFace production hardening migration.
-- Apply after the existing schema and verify on a staging database first.

alter table public.employers add column if not exists timezone text not null default 'Africa/Johannesburg';
alter table public.employers add column if not exists schedule_path text;
alter table public.employers add column if not exists schedule_name text;
alter table public.employers add column if not exists schedule_content_type text;
alter table public.employers add column if not exists schedule_updated_at timestamptz;
alter table public.employers add column if not exists support_whatsapp text;
alter table public.employers add column if not exists support_phone text;
alter table public.employers add column if not exists support_email text;
alter table public.employers add column if not exists company_code text;
update public.employers set company_code = 'FF-' || upper(substr(replace(id::text, '-', ''), 1, 8)) where company_code is null;
create unique index if not exists employers_company_code_idx on public.employers(company_code);
with ranked as (select id, 'FF-' || upper(left(coalesce(nullif(regexp_replace(name, '[^A-Za-z0-9]', '', 'g'), ''), 'CO'), 5)) || lpad(row_number() over (order by created_at, id)::text, 2, '0') as new_code from public.employers) update public.employers e set company_code = r.new_code from ranked r where e.id = r.id and e.company_code ~ '^FF-[0-9A-F]{8}$';
alter table public.admin_users add column if not exists username text;
alter table public.admin_users add column if not exists password_hash text;
alter table public.admin_users drop constraint if exists admin_users_id_fkey;
alter table public.admin_users add column if not exists activation_code_hash text;
alter table public.admin_users add column if not exists activation_expires_at timestamptz;
alter table public.employees alter column password_hash drop not null;
alter table public.employees add column if not exists activation_code_hash text;
alter table public.employees add column if not exists activation_expires_at timestamptz;
alter table public.platform_admins add column if not exists support_whatsapp text;
alter table public.platform_admins add column if not exists support_phone text;
alter table public.platform_admins add column if not exists support_email text;
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type text not null default 'annual',
  start_date date not null,
  end_date date not null,
  reason text not null,
  status text not null default 'pending',
  manager_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.leave_requests add column if not exists leave_type text not null default 'annual';
create index if not exists leave_requests_employer_status_idx on public.leave_requests(employer_id, status, start_date);
create table if not exists public.sick_notes (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  content_type text not null,
  note_date date,
  employee_comment text,
  status text not null default 'submitted',
  manager_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sick_notes_employer_status_idx on public.sick_notes(employer_id, status, created_at);
alter table public.time_entries add column if not exists clock_action_id uuid;
alter table public.time_entries add column if not exists captured_at timestamptz;
alter table public.time_entries add column if not exists synced_at timestamptz not null default now();
alter table public.payslips add column if not exists status text not null default 'draft';
alter table public.payslips add column if not exists finalized_at timestamptz;
alter table public.payslips add column if not exists finalized_by uuid;

create unique index if not exists employees_employer_code_unique on public.employees(employer_id, employee_code);
create unique index if not exists time_entries_employee_action_unique on public.time_entries(employee_id, clock_action_id) where clock_action_id is not null;
create index if not exists time_entries_employer_occurred_idx on public.time_entries(occurred_at desc);
create index if not exists payslips_employer_period_idx on public.payslips(employer_id, period_year, period_month);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_id uuid,
  employer_id uuid references public.employers(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_employer_created_idx on public.audit_logs(employer_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);

alter table public.audit_logs enable row level security;
