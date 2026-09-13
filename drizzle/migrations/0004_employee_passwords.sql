-- Employee credentials are passwords, not numeric PINs.
alter table public.employees rename column pin_hash to password_hash;
