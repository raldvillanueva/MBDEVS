-- =====================================================================
-- Sign in with a username (MB0001) instead of an email address.
--
-- Run this in the Supabase SQL editor. Safe to re-run.
--
-- Supabase Auth is email/password underneath and that does not change:
-- the auth-login function turns a username into the account's email
-- server-side, then signs in normally. The email stays on the profile
-- for OTP later, and is never handed back to the browser.
--
-- Step 2 prints the username it assigns to each existing account.
-- WRITE THOSE DOWN — they are how those people sign in from now on.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The column.
--
--    Usernames are compared case-insensitively (mb0001 and MB0001 are
--    the same person) so the unique index is on lower(username), not on
--    the raw value.
--
--    '@' is excluded because the login box accepts either a username or
--    an email and tells them apart by looking for one. A username
--    containing '@' would be unreachable.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or (length(username) between 3 and 32 and username !~ '[@[:space:]]'));

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- ---------------------------------------------------------------------
-- 2. Give every existing account a username.
--
--    Numbered by created_at so the oldest account is MB0001 and the
--    order is stable if this is ever re-run. Accounts that already have
--    one are left alone.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  n int;
begin
  -- Carry on from the highest MB#### already issued, so re-running this
  -- never hands out a number twice.
  select coalesce(max(substring(username from 3)::int), 0)
    into n
  from public.profiles
  where username ~ '^MB[0-9]{4}$';

  for r in
    select id, email, full_name
    from public.profiles
    where username is null
    order by created_at, id
  loop
    n := n + 1;
    update public.profiles
       set username = 'MB' || lpad(n::text, 4, '0')
     where id = r.id;

    raise notice 'MB% -> % (%)',
      lpad(n::text, 4, '0'),
      coalesce(r.full_name, '(no name)'),
      coalesce(r.email, r.id::text);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. The next username to suggest when creating an account.
--
--    Only signed-in Super Admins ever call this — it is a convenience
--    for the Create Account form, not part of signing in.
-- ---------------------------------------------------------------------
create or replace function public.next_username()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'MB' || lpad((
    coalesce(max(substring(username from 3)::int), 0) + 1
  )::text, 4, '0')
  from public.profiles
  where username ~ '^MB[0-9]{4}$'
$$;

revoke all on function public.next_username() from public;
grant execute on function public.next_username() to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 4. Check. Every account should have a username.
-- ---------------------------------------------------------------------
select username, full_name, email, account_type
from public.profiles
order by username;
