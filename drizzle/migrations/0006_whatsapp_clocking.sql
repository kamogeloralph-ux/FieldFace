-- WhatsApp-based clock in/out.
--
-- Employees are matched to their employer by their personal WhatsApp number
-- (digits-only, matching Meta's `wa_id` format, e.g. "27821234567"). A selfie
-- sent to the company WhatsApp number is staged in whatsapp_pending_clocks
-- until the matching location pin arrives, at which point it becomes a normal
-- time_entries row (source = 'whatsapp') exactly like an in-app clock.

alter table public.employees add column if not exists whatsapp_number text;
-- Plain (non-partial) unique index: Postgres treats NULL <> NULL, so any
-- number of employees can still have no WhatsApp number linked yet.
create unique index if not exists employees_whatsapp_number_unique on public.employees(whatsapp_number);

alter table public.time_entries add column if not exists source text not null default 'app';

create table if not exists public.whatsapp_pending_clocks (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  employee_id uuid not null references public.employees(id) on delete cascade,
  selfie_path text not null,
  wa_message_id text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
