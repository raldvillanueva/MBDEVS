-- =====================================================================
-- Make the Super Admin user pages show real accounts.
--
-- Run AFTER audit_reports_setup.sql and role_permissions_setup.sql.
-- Safe to re-run.
--
-- The pages listed sample rows because profiles has no email: addresses
-- live in auth.users, which the browser cannot read (that would need the
-- service role, which must never ship to a frontend). Copying the address
-- onto profiles at sign-up keeps it readable under normal RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles.email
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text;

-- Backfill from auth.users for accounts that already exist.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

-- ---------------------------------------------------------------------
-- 2. Keep it filled for new sign-ups.
--
--    Supersedes the version in role_permissions_setup.sql — same defaults,
--    plus the address.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, role, account_type, email)
  values (new.id, 'staff', 'encoder', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. An address change in Supabase Auth should follow through.
-- ---------------------------------------------------------------------
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- ---------------------------------------------------------------------
-- 4. Check what you have:
--
--      select email, full_name, role, account_type
--      from public.profiles order by account_type, email;
--
--    And to assign an account after creating its login in
--    Authentication -> Users:
--
--      update public.profiles
--      set role = 'admin', account_type = 'supervisor', full_name = 'Jessa Villanueva'
--      where email = 'jessa@example.com';
--
--    role     : 'admin' for Super Admin / Admin / Supervisor, 'staff' for
--               Encoder / Viewer. This is what RLS reads.
--    account_type : which of the five the account actually is.
-- ---------------------------------------------------------------------

notify pgrst, 'reload schema';
