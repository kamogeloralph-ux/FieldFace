-- Store complete manager contact and identity details for company profiles.
alter table public.admin_users add column if not exists id_number text;
alter table public.admin_users add column if not exists phone text;
alter table public.admin_users add column if not exists physical_address text;
