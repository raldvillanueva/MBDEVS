-- =====================================================================
-- Per-sector tables. Run this ENTIRE file once in the Supabase SQL
-- Editor. Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- Model: every sector owns its own tables.
--   Rizal       -> field_orders            / pending_orders   (existing)
--   Manila      -> field_orders_manila     / pending_orders_manila
--   Pasig       -> field_orders_pasig      / pending_orders_pasig
--   Balintawak  -> field_orders_balintawak / pending_orders_balintawak
--
-- Rizal deliberately keeps the original table names: it already holds
-- every historical record (~8,156), and deletion_requests has a foreign
-- key pointing at field_orders(id). Renaming it would mean migrating
-- those rows and rebuilding that constraint for no functional gain.
--
-- LIKE ... INCLUDING ALL copies the column list, defaults, constraints
-- and indexes as they exist RIGHT NOW. It does NOT stay in sync: any
-- column added to field_orders later must be added to the three sector
-- tables too (see step 4).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Field order tables for the three new sectors
-- ---------------------------------------------------------------------
create table if not exists public.field_orders_manila     (like public.field_orders including all);
create table if not exists public.field_orders_pasig      (like public.field_orders including all);
create table if not exists public.field_orders_balintawak (like public.field_orders including all);

-- ---------------------------------------------------------------------
-- 2. Pending order tables for the three new sectors
-- ---------------------------------------------------------------------
create table if not exists public.pending_orders_manila     (like public.pending_orders including all);
create table if not exists public.pending_orders_pasig      (like public.pending_orders including all);
create table if not exists public.pending_orders_balintawak (like public.pending_orders including all);

-- ---------------------------------------------------------------------
-- 3. RLS — mirrors the policies already on field_orders/pending_orders:
--      field_orders_*  : everyone reads, admin writes
--      pending_orders_*: everyone reads AND inserts (staff fast encoding),
--                        admin updates/deletes
-- ---------------------------------------------------------------------
do $$
declare
  s text;
  t text;
begin
  foreach s in array array['manila', 'pasig', 'balintawak'] loop

    t := format('public.field_orders_%s', s);
    execute format('alter table %s enable row level security', t);
    execute format('drop policy if exists "fo_%s_select" on %s', s, t);
    execute format('create policy "fo_%s_select" on %s for select to authenticated using (true)', s, t);
    execute format('drop policy if exists "fo_%s_insert" on %s', s, t);
    execute format('create policy "fo_%s_insert" on %s for insert to authenticated with check (public.is_admin())', s, t);
    execute format('drop policy if exists "fo_%s_update" on %s', s, t);
    execute format('create policy "fo_%s_update" on %s for update to authenticated using (public.is_admin()) with check (public.is_admin())', s, t);
    execute format('drop policy if exists "fo_%s_delete" on %s', s, t);
    execute format('create policy "fo_%s_delete" on %s for delete to authenticated using (public.is_admin())', s, t);

    t := format('public.pending_orders_%s', s);
    execute format('alter table %s enable row level security', t);
    execute format('drop policy if exists "po_%s_select" on %s', s, t);
    execute format('create policy "po_%s_select" on %s for select to authenticated using (true)', s, t);
    execute format('drop policy if exists "po_%s_insert" on %s', s, t);
    execute format('create policy "po_%s_insert" on %s for insert to authenticated with check (true)', s, t);
    execute format('drop policy if exists "po_%s_update" on %s', s, t);
    execute format('create policy "po_%s_update" on %s for update to authenticated using (public.is_admin()) with check (public.is_admin())', s, t);
    execute format('drop policy if exists "po_%s_delete" on %s', s, t);
    execute format('create policy "po_%s_delete" on %s for delete to authenticated using (public.is_admin())', s, t);

  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. deletion_requests needs to know which sector a request came from,
--    otherwise an approved deletion cannot tell which table the record
--    lives in. Existing requests are all Rizal's.
--
--    The old field_order_id -> field_orders(id) foreign key only ever
--    matched Rizal rows, so it is dropped: a request against a Manila
--    record would otherwise be rejected outright.
-- ---------------------------------------------------------------------
alter table public.deletion_requests
  add column if not exists sector text not null default 'rizal';

alter table public.deletion_requests
  drop constraint if exists deletion_requests_field_order_id_fkey;

-- ---------------------------------------------------------------------
-- 5. Adding a column later? Apply it to all four sectors, e.g.:
--
--      alter table public.field_orders            add column if not exists foo text;
--      alter table public.field_orders_manila     add column if not exists foo text;
--      alter table public.field_orders_pasig      add column if not exists foo text;
--      alter table public.field_orders_balintawak add column if not exists foo text;
--
--    Missing one shows up in the app as
--    "Could not find the 'foo' column of '<table>' in the schema cache".
-- ---------------------------------------------------------------------

notify pgrst, 'reload schema';
