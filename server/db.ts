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
    `alter table public.employers add column if not exists tax_number text`,
    `alter table public.employers add column if not exists company_reg_number text`,
    `alter table public.employers add column if not exists uif_enabled boolean not null default false`,
    `alter table public.employers add column if not exists uif_employee_rate numeric(5,2) not null default 1.00`,
    `alter table public.employers add column if not exists uif_employer_rate numeric(5,2) not null default 1.00`,
    `alter table public.employers add column if not exists timezone text not null default 'Africa/Johannesburg'`,
    `alter table public.employees add column if not exists tax_number text`,
    `alter table public.time_entries add column if not exists clock_action_id uuid`,
    `alter table public.time_entries add column if not exists captured_at timestamptz`,
    `alter table public.time_entries add column if not exists synced_at timestamptz not null default now()`,
    `alter table public.payslips add column if not exists uif_deduction numeric(10,2) not null default 0`,
    `alter table public.payslips add column if not exists status text not null default 'draft'`,
    `alter table public.payslips add column if not exists finalized_at timestamptz`,
    `alter table public.payslips add column if not exists finalized_by uuid`,
    `create table if not exists public.platform_admins (id uuid primary key references auth.users(id) on delete cascade, full_name text not null, email text not null, created_at timestamptz not null default now())`,
    `create table if not exists public.audit_logs (id uuid primary key default gen_random_uuid(), actor_type text not null, actor_id uuid, employer_id uuid references public.employers(id) on delete set null, action text not null, entity_type text not null, entity_id uuid, metadata text, created_at timestamptz not null default now())`,
  ];
  for (const statement of statements) await db.execute(sql.raw(statement));
}
