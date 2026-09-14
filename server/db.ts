import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../drizzle/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

const client = postgres(process.env.DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });

/**
 * Keeps an existing deployment compatible with the current application schema.
 * The versioned migration remains the preferred release path; this bootstrap is
 * intentionally idempotent so a Railway restart cannot serve an incompatible
 * schema after a first deployment.
 */
export async function ensureProductionSchema() {
  const statements = [
    `alter table public.employers add column if not exists address text`,
    `alter table public.employers add column if not exists company_code text`,
    `update public.employers set company_code = 'FF-' || upper(substr(replace(id::text, '-', ''), 1, 8)) where company_code is null`,
    `create unique index if not exists employers_company_code_idx on public.employers(company_code)`,
    `with ranked as (select id, 'FF-' || upper(left(coalesce(nullif(regexp_replace(name, '[^A-Za-z0-9]', '', 'g'), ''), 'CO'), 5)) || lpad(row_number() over (order by created_at, id)::text, 2, '0') as new_code from public.employers) update public.employers e set company_code = r.new_code from ranked r where e.id = r.id and e.company_code ~ '^FF-[0-9A-F]{8}$'`,
    `alter table public.employers add column if not exists tax_number text`,
    `alter table public.employers add column if not exists company_reg_number text`,
    `alter table public.employers add column if not exists uif_enabled boolean not null default false`,
    `alter table public.employers add column if not exists uif_employee_rate numeric(5,2) not null default 1.00`,
    `alter table public.employers add column if not exists uif_employer_rate numeric(5,2) not null default 1.00`,
    `alter table public.employers add column if not exists timezone text not null default 'Africa/Johannesburg'`,
    `alter table public.employers add column if not exists schedule_path text`,
    `alter table public.employers add column if not exists schedule_name text`,
    `alter table public.employers add column if not exists schedule_content_type text`,
    `alter table public.employers add column if not exists schedule_updated_at timestamptz`,
    `alter table public.employers add column if not exists support_whatsapp text`,
    `alter table public.employers add column if not exists support_phone text`,
    `alter table public.employers add column if not exists support_email text`,
    `create table if not exists public.leave_requests (id uuid primary key default gen_random_uuid(), employer_id uuid not null references public.employers(id) on delete cascade, employee_id uuid not null references public.employees(id) on delete cascade, leave_type text not null default 'annual', start_date date not null, end_date date not null, reason text not null, status text not null default 'pending', manager_note text, reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now())`,
    `alter table public.leave_requests add column if not exists leave_type text not null default 'annual'`,
    `create index if not exists leave_requests_employer_status_idx on public.leave_requests(employer_id, status, start_date)`,
    `create table if not exists public.sick_notes (id uuid primary key default gen_random_uuid(), employer_id uuid not null references public.employers(id) on delete cascade, employee_id uuid not null references public.employees(id) on delete cascade, file_path text not null, file_name text not null, content_type text not null, note_date date, employee_comment text, status text not null default 'submitted', manager_note text, reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now())`,
    `create index if not exists sick_notes_employer_status_idx on public.sick_notes(employer_id, status, created_at)`,
    `alter table public.employees add column if not exists tax_number text`,
    `alter table public.employees add column if not exists position text not null default 'general_worker'`,
    `alter table public.employees alter column password_hash drop not null`,
    `alter table public.employees add column if not exists activation_code_hash text`,
    `alter table public.employees add column if not exists activation_expires_at timestamptz`,
    `alter table public.time_entries add column if not exists clock_action_id uuid`,
    `alter table public.time_entries add column if not exists captured_at timestamptz`,
    `alter table public.time_entries add column if not exists synced_at timestamptz not null default now()`,
    `alter table public.payslips add column if not exists uif_deduction numeric(10,2) not null default 0`,
    `alter table public.payslips add column if not exists status text not null default 'draft'`,
    `alter table public.payslips add column if not exists finalized_at timestamptz`,
    `alter table public.payslips add column if not exists finalized_by uuid`,
    `create table if not exists public.company_deductions (id uuid primary key default gen_random_uuid(), employer_id uuid not null references public.employers(id) on delete cascade, name text not null, type text not null, amount numeric(10,2) not null default 0, active boolean not null default true, created_at timestamptz not null default now())`,
    `alter table public.company_deductions add column if not exists scope text not null default 'all'`,
    `create table if not exists public.company_deduction_employees (deduction_id uuid not null references public.company_deductions(id) on delete cascade, employee_id uuid not null references public.employees(id) on delete cascade, primary key (deduction_id, employee_id))`,
    `alter table public.payslips add column if not exists deduction_details jsonb not null default '[]'::jsonb`,
    `create table if not exists public.platform_admins (id uuid primary key references auth.users(id) on delete cascade, full_name text not null, email text not null, created_at timestamptz not null default now())`,
    `alter table public.admin_users add column if not exists username text`,
    `alter table public.admin_users add column if not exists password_hash text`,
    `alter table public.admin_users add column if not exists id_number text`,
    `alter table public.admin_users add column if not exists phone text`,
    `alter table public.admin_users add column if not exists physical_address text`,
    `alter table public.admin_users drop constraint if exists admin_users_id_fkey`,
    `alter table public.admin_users add column if not exists activation_code_hash text`,
    `alter table public.admin_users add column if not exists activation_expires_at timestamptz`,
    `alter table public.platform_admins add column if not exists support_whatsapp text`,
    `alter table public.platform_admins add column if not exists support_phone text`,
    `alter table public.platform_admins add column if not exists support_email text`,
    `create table if not exists public.audit_logs (id uuid primary key default gen_random_uuid(), actor_type text not null, actor_id uuid, employer_id uuid references public.employers(id) on delete set null, action text not null, entity_type text not null, entity_id uuid, metadata text, created_at timestamptz not null default now())`,
  ];
  for (const statement of statements) await db.execute(sql.raw(statement));
}
