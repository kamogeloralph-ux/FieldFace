-- Store the employee position used on payslips.
alter table public.employees add column if not exists position text not null default 'general_worker';
