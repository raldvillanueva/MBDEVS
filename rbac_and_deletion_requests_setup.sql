-- =====================================================================
-- RBAC + Deletion Requests setup. Run this ENTIRE file once in the
-- Supabase SQL Editor. Safe to re-run (uses IF NOT EXISTS / OR REPLACE
-- / DROP POLICY IF EXISTS throughout) EXCEPT step 8b below, which you
-- must confirm manually before running (see the comment there).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles table
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'staff' check (role in ('staff', 'admin')),
  full_name  text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------
-- 2. is_admin() — SECURITY DEFINER, avoids RLS self-recursion on
--    profiles. Any policy (on profiles OR any other table) that needs
--    to know "is the calling user an admin" calls this instead of
--    writing `exists (select 1 from profiles where ...)` inline,
--    because an inline subquery on profiles re-triggers profiles' own
--    RLS policies, which (if they also reference profiles) recurse.
--    SECURITY DEFINER makes this function run as its owner (bypassing
--    RLS entirely for this one lookup), breaking the cycle.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 3. profiles RLS policies
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- No INSERT policy: rows are created only by the trigger below
-- (SECURITY DEFINER) or the backfill statement. Client-side inserts
-- are denied by default (no matching policy = deny).

drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_update_admin_only" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. Auto-create a profile row when a new auth.users row is inserted
--    (covers accounts created via the Supabase Auth dashboard, since
--    there is no in-app signup UI).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'staff')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 5. Backfill profiles for accounts that already exist (the trigger
--    above only fires for FUTURE inserts). Everyone lands as 'staff'
--    by default — promote specific accounts to admin in step 6.
-- ---------------------------------------------------------------------
insert into public.profiles (id, role)
select id, 'staff' from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 6. Promote an account to admin (no signup UI exists to self-assign,
--    so this must be run manually per admin). Find the UUID first:
--
--      select id, email from auth.users;
--
--    Then run (uncomment and fill in the UUID):
--
--      update public.profiles set role = 'admin' where id = '<uuid-here>';
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 7. deletion_requests table
-- ---------------------------------------------------------------------
create table if not exists public.deletion_requests (
  id                uuid primary key default gen_random_uuid(),
  field_order_id    uuid references public.field_orders(id) on delete set null,
  field_order_no    text,
  requested_by      uuid references public.profiles(id),
  requested_by_name text,
  reason            text not null,
  status            text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  resolved_by       uuid references public.profiles(id)
);

alter table public.deletion_requests enable row level security;

drop policy if exists "deletion_requests_select" on public.deletion_requests;
create policy "deletion_requests_select" on public.deletion_requests
  for select to authenticated
  using (public.is_admin() or requested_by = auth.uid());

drop policy if exists "deletion_requests_insert_own" on public.deletion_requests;
create policy "deletion_requests_insert_own" on public.deletion_requests
  for insert to authenticated
  with check (requested_by = auth.uid());

drop policy if exists "deletion_requests_update_admin_only" on public.deletion_requests;
create policy "deletion_requests_update_admin_only" on public.deletion_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No delete policy — requests are an audit trail, never removed via the client.

-- ---------------------------------------------------------------------
-- 8a. field_orders: replace the permissive policy with the real matrix.
--     (Existing policy name per supabase_schema.sql is "Allow all".)
-- ---------------------------------------------------------------------
drop policy if exists "Allow all" on public.field_orders;

drop policy if exists "field_orders_select_all" on public.field_orders;
create policy "field_orders_select_all" on public.field_orders
  for select to authenticated using (true);

drop policy if exists "field_orders_insert_admin" on public.field_orders;
create policy "field_orders_insert_admin" on public.field_orders
  for insert to authenticated with check (public.is_admin());

drop policy if exists "field_orders_update_admin" on public.field_orders;
create policy "field_orders_update_admin" on public.field_orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "field_orders_delete_admin" on public.field_orders;
create policy "field_orders_delete_admin" on public.field_orders
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8b. pending_orders: SELECT for everyone, INSERT for everyone (staff
--     Fast Encoding + admin "Add to Pending"), UPDATE/DELETE admin-only.
--
--     IMPORTANT: pending_orders isn't defined in either existing .sql
--     file in this repo, so its current policy name is unknown. Before
--     running this block, run:
--
--       select policyname from pg_policies where tablename = 'pending_orders';
--
--     and replace "Allow all" below with whatever it actually returns
--     (it's very likely "Allow all", matching the other two tables, but
--     confirm before running).
-- ---------------------------------------------------------------------
drop policy if exists "Allow all" on public.pending_orders;

drop policy if exists "pending_orders_select_all" on public.pending_orders;
create policy "pending_orders_select_all" on public.pending_orders
  for select to authenticated using (true);

drop policy if exists "pending_orders_insert_all" on public.pending_orders;
create policy "pending_orders_insert_all" on public.pending_orders
  for insert to authenticated with check (true);

drop policy if exists "pending_orders_update_admin" on public.pending_orders;
create policy "pending_orders_update_admin" on public.pending_orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pending_orders_delete_admin" on public.pending_orders;
create policy "pending_orders_delete_admin" on public.pending_orders
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 9. new_work_orders: SELECT for everyone, INSERT/UPDATE/DELETE
--    admin-only. Existing policy name per new_work_orders_setup.sql
--    is "Allow all new work orders".
-- ---------------------------------------------------------------------
drop policy if exists "Allow all new work orders" on public.new_work_orders;

drop policy if exists "new_work_orders_select_all" on public.new_work_orders;
create policy "new_work_orders_select_all" on public.new_work_orders
  for select to authenticated using (true);

drop policy if exists "new_work_orders_insert_admin" on public.new_work_orders;
create policy "new_work_orders_insert_admin" on public.new_work_orders
  for insert to authenticated with check (public.is_admin());

drop policy if exists "new_work_orders_update_admin" on public.new_work_orders;
create policy "new_work_orders_update_admin" on public.new_work_orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "new_work_orders_delete_admin" on public.new_work_orders;
create policy "new_work_orders_delete_admin" on public.new_work_orders
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 10. Troubleshooting note (not executable): if any of the above
--     policies pass but requests still fail with
--     "permission denied for table X", the table-level GRANTs to the
--     authenticated role are missing (separate from RLS policies).
--     Fix with, e.g.:
--       GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_orders TO authenticated;
--     This normally isn't needed on Supabase (default privileges cover
--     it), but call it out since these tables were created ad hoc.
-- ---------------------------------------------------------------------
