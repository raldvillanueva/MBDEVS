-- =====================================================================
-- Real permission levels per account type.
--
-- Run this ENTIRE file once in the Supabase SQL Editor, AFTER
-- audit_reports_setup.sql (which adds profiles.account_type).
-- Safe to re-run.
--
-- Before this, `role` was the only thing policies looked at, and it has
-- just two values — so Admin and Supervisor were indistinguishable to the
-- database, and the difference existed only in which buttons the UI drew.
-- Hiding a button is not a permission: anyone could still delete through
-- the API. account_type now drives the policies, so the rules are actually
-- enforced.
--
--   Capability          Super Admin  Admin  Supervisor  Encoder  Viewer
--   read records             y         y        y          y       y
--   add / edit records       y         y        y          y       -
--   archive (reversible)     y         y        y          -       -
--   permanent delete         y         y        -          -       -
--   approve deletions        y         y        y          -       -
--   manage accounts          y         -        -          -       -
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Capability helpers.
--
--    All SECURITY DEFINER for the same reason is_admin() is: they read
--    profiles, and profiles has its own RLS, so a plain query here would
--    re-enter that policy and recurse.
-- ---------------------------------------------------------------------
create or replace function public.my_account_type()
returns text
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select account_type from public.profiles where id = auth.uid()
$$;

-- Add and edit records. Everyone except Viewer.
create or replace function public.can_encode()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select public.my_account_type() in ('encoder', 'supervisor', 'admin', 'super_admin')
$$;

-- Review, archive, approve deletion requests. Supervisor and up.
-- This is the old is_admin() line, now including Supervisor.
create or replace function public.can_manage()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select public.my_account_type() in ('supervisor', 'admin', 'super_admin')
$$;

-- Permanently destroy a record. Admin and up — this is the one thing a
-- Supervisor cannot do. Archiving stays available to them, and archiving
-- is reversible.
create or replace function public.can_delete()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select public.my_account_type() in ('admin', 'super_admin')
$$;

-- Account management.
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select public.my_account_type() = 'super_admin'
$$;

grant execute on function public.my_account_type() to authenticated;
grant execute on function public.can_encode()      to authenticated;
grant execute on function public.can_manage()      to authenticated;
grant execute on function public.can_delete()      to authenticated;
grant execute on function public.is_super_admin()  to authenticated;

-- ---------------------------------------------------------------------
-- 2. New accounts start as Encoder.
--
--    The original trigger set role only, leaving account_type null. Every
--    helper above returns false for null, so such an account could not
--    even encode — it would look like a broken login rather than a
--    permission decision.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, role, account_type)
  values (new.id, 'staff', 'encoder')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Anything already missing a type is an Encoder too.
update public.profiles
set account_type = case when role = 'admin' then 'admin' else 'encoder' end
where account_type is null;

-- ---------------------------------------------------------------------
-- 3. Field order tables — all four sectors.
--
--    insert/update: can_manage()  (Supervisor and up)
--    delete:        can_delete()  (Admin and up)  <- the real change
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'field_orders', 'field_orders_manila',
    'field_orders_pasig', 'field_orders_balintawak'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "fo_select" on public.%I', t);
    execute format('create policy "fo_select" on public.%I for select to authenticated using (true)', t);

    execute format('drop policy if exists "fo_insert" on public.%I', t);
    execute format('create policy "fo_insert" on public.%I for insert to authenticated with check (public.can_manage())', t);

    execute format('drop policy if exists "fo_update" on public.%I', t);
    execute format('create policy "fo_update" on public.%I for update to authenticated using (public.can_manage()) with check (public.can_manage())', t);

    execute format('drop policy if exists "fo_delete" on public.%I', t);
    execute format('create policy "fo_delete" on public.%I for delete to authenticated using (public.can_delete())', t);

    -- Retire the older policy names so two rules cannot both grant access.
    -- Postgres ORs policies together: leaving an is_admin() delete policy
    -- in place would hand Supervisors back the delete they just lost.
    execute format('drop policy if exists "field_orders_select_all" on public.%I', t);
    execute format('drop policy if exists "field_orders_insert_admin" on public.%I', t);
    execute format('drop policy if exists "field_orders_update_admin" on public.%I', t);
    execute format('drop policy if exists "field_orders_delete_admin" on public.%I', t);
    execute format('drop policy if exists "Allow all" on public.%I', t);
  end loop;

  -- The sector tables were created with their own policy names.
  foreach t in array array['manila', 'pasig', 'balintawak'] loop
    execute format('drop policy if exists "fo_%s_select" on public.field_orders_%s', t, t);
    execute format('drop policy if exists "fo_%s_insert" on public.field_orders_%s', t, t);
    execute format('drop policy if exists "fo_%s_update" on public.field_orders_%s', t, t);
    execute format('drop policy if exists "fo_%s_delete" on public.field_orders_%s', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Pending order tables — all four sectors.
--
--    Encoders live here: fast encoding inserts pending records. Viewers
--    must not, which the previous `with check (true)` allowed.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'pending_orders', 'pending_orders_manila',
    'pending_orders_pasig', 'pending_orders_balintawak'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "po_select" on public.%I', t);
    execute format('create policy "po_select" on public.%I for select to authenticated using (true)', t);

    execute format('drop policy if exists "po_insert" on public.%I', t);
    execute format('create policy "po_insert" on public.%I for insert to authenticated with check (public.can_encode())', t);

    execute format('drop policy if exists "po_update" on public.%I', t);
    execute format('create policy "po_update" on public.%I for update to authenticated using (public.can_encode()) with check (public.can_encode())', t);

    execute format('drop policy if exists "po_delete" on public.%I', t);
    execute format('create policy "po_delete" on public.%I for delete to authenticated using (public.can_manage())', t);

    execute format('drop policy if exists "pending_orders_select_all" on public.%I', t);
    execute format('drop policy if exists "pending_orders_insert_all" on public.%I', t);
    execute format('drop policy if exists "pending_orders_update_admin" on public.%I', t);
    execute format('drop policy if exists "pending_orders_delete_admin" on public.%I', t);
    execute format('drop policy if exists "Allow all" on public.%I', t);
  end loop;

  foreach t in array array['manila', 'pasig', 'balintawak'] loop
    execute format('drop policy if exists "po_%s_select" on public.pending_orders_%s', t, t);
    execute format('drop policy if exists "po_%s_insert" on public.pending_orders_%s', t, t);
    execute format('drop policy if exists "po_%s_update" on public.pending_orders_%s', t, t);
    execute format('drop policy if exists "po_%s_delete" on public.pending_orders_%s', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Deletion requests.
--
--    A Supervisor can approve one — approving is a review decision. The
--    actual delete it triggers still runs under that user, so a Supervisor
--    approving an "approve + delete" hits fo_delete and is refused. Decide
--    whether that is wanted before rolling this out: as written, only
--    Admin and up can complete a deletion end to end.
-- ---------------------------------------------------------------------
drop policy if exists "deletion_requests_select" on public.deletion_requests;
create policy "deletion_requests_select" on public.deletion_requests
  for select to authenticated
  using (public.can_manage() or requested_by = auth.uid());

drop policy if exists "deletion_requests_insert_own" on public.deletion_requests;
create policy "deletion_requests_insert_own" on public.deletion_requests
  for insert to authenticated
  with check (requested_by = auth.uid());

drop policy if exists "deletion_requests_update_admin_only" on public.deletion_requests;
drop policy if exists "deletion_requests_update" on public.deletion_requests;
create policy "deletion_requests_update" on public.deletion_requests
  for update to authenticated
  using (public.can_manage())
  with check (public.can_manage());

-- ---------------------------------------------------------------------
-- 6. Profiles — only a Super Admin changes who is who.
--
--    Previously any admin could edit any profile, which means any admin
--    could promote themselves or anyone else. That is the whole ballgame,
--    so it belongs to Super Admin alone.
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.can_manage());

drop policy if exists "profiles_update_admin_only" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------
-- 7. Audit reports — reviewers are Supervisor and up.
-- ---------------------------------------------------------------------
drop policy if exists "audit_reports_select" on public.audit_reports;
create policy "audit_reports_select" on public.audit_reports
  for select to authenticated
  using (public.can_manage() or generated_by = auth.uid());

-- ---------------------------------------------------------------------
-- 8. Assign your accounts. Find the UUIDs first:
--
--      select p.id, u.email, p.role, p.account_type
--      from public.profiles p join auth.users u on u.id = p.id;
--
--    Then set each one (role stays the coarse bucket the app still reads):
--
--      update public.profiles set role = 'admin', account_type = 'super_admin' where id = '...';
--      update public.profiles set role = 'admin', account_type = 'admin'       where id = '...';
--      update public.profiles set role = 'admin', account_type = 'supervisor'  where id = '...';
--      update public.profiles set role = 'staff', account_type = 'encoder'     where id = '...';
--      update public.profiles set role = 'staff', account_type = 'viewer'      where id = '...';
--
--    Careful: once profiles_update is Super Admin only, you can no longer
--    change these from the app as a plain admin. Set your Super Admin
--    account here first.
-- ---------------------------------------------------------------------

notify pgrst, 'reload schema';
