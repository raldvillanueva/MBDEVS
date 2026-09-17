-- =====================================================================
-- Retire the Supervisor account type.
--
-- Run this in the Supabase SQL editor. Safe to re-run.
--
-- Supervisor sat between Admin and Encoder: everything an Admin could do
-- except permanently delete a record. With Admin and Super Admin both in
-- place that middle step stopped earning its keep, so it goes.
--
-- Existing Supervisors become Admins. That is a promotion, not a
-- sideways move — they gain permanent delete, which they did not have.
-- Step 1 prints who was changed; check that list.
--
-- ORDER MATTERS. The accounts move first, then the constraint that
-- would reject them is replaced, then the permission functions stop
-- naming a type nobody holds. Running step 3 first would strip those
-- accounts of every permission until step 1 caught up.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Move existing Supervisors to Admin.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id, email, full_name from public.profiles where account_type = 'supervisor'
  loop
    raise notice 'Supervisor -> Admin: % (%)', coalesce(r.full_name, '(no name)'), coalesce(r.email, r.id::text);
    n := n + 1;
  end loop;

  update public.profiles
     set account_type = 'admin',
         -- role travels with account_type; both were already 'admin' for a
         -- Supervisor, but set it explicitly so a half-migrated row cannot
         -- survive this.
         role = 'admin'
   where account_type = 'supervisor';

  raise notice '% account(s) moved.', n;
end $$;

-- ---------------------------------------------------------------------
-- 2. Stop accepting 'supervisor' as an account type.
-- ---------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('encoder', 'viewer', 'admin', 'super_admin'));

-- ---------------------------------------------------------------------
-- 3. Drop 'supervisor' from the permission functions.
--
--    These are the functions every RLS policy calls, so this is what
--    actually decides who can do what. Leaving the name in would be
--    harmless today but would quietly grant real permissions the moment
--    anyone set an account back to 'supervisor' by hand.
-- ---------------------------------------------------------------------
create or replace function public.can_encode()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.my_account_type() in ('encoder', 'admin', 'super_admin')
$$;

create or replace function public.can_manage()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.my_account_type() in ('admin', 'super_admin')
$$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 4. Check. Expect no 'supervisor' row, and the promoted accounts
--    showing as admin/admin.
-- ---------------------------------------------------------------------
select account_type, role, count(*) as accounts
from public.profiles
group by account_type, role
order by account_type;
