-- Company-configured deductions and immutable payslip deduction snapshots.
create table if not exists public.company_deductions (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  name text not null,
  type text not null check (type in ('fixed', 'percentage')),
  amount numeric(10,2) not null check (amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists company_deductions_employer_idx on public.company_deductions(employer_id, active);
alter table public.company_deductions add column if not exists scope text not null default 'all';
create table if not exists public.company_deduction_employees (
  deduction_id uuid not null references public.company_deductions(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  primary key (deduction_id, employee_id)
);
alter table public.payslips add column if not exists deduction_details jsonb not null default '[]'::jsonb;
