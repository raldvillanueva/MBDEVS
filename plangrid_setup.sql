-- =====================================================================
-- Add PlanGrid, beside Plus Code.
-- Run this ENTIRE file once in the Supabase SQL Editor, BEFORE the
-- frontend deploy finishes. Safe to re-run.
--
-- Until it has run, saving a record fails with "column plangrid does not
-- exist" — the form sends the field whether the column is there or not.
-- The file is small and fast; run it as soon as the code is pushed.
--
-- Every sector's pair of tables, Pending included: a record carries the
-- value from Pending through to Field Orders, and promote_pending_order
-- copies only the columns both tables share. A column on one side and not
-- the other would be silently dropped on the way across.
-- =====================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'field_orders',  'field_orders_manila',  'field_orders_pasig',
    'field_orders_balintawak', 'field_orders_ami',
    'pending_orders', 'pending_orders_manila', 'pending_orders_pasig',
    'pending_orders_balintawak', 'pending_orders_ami'
  ] loop
    execute format('alter table public.%I add column if not exists plangrid text', t);
  end loop;
end $$;

-- The pull endpoint's view is SELECT *, which freezes its column list at
-- creation — so it has to be rebuilt to carry the new column.
drop view if exists public.all_field_orders;
create view public.all_field_orders as
  select 'rizal'::text      as sector, * from public.field_orders
  union all
  select 'manila'::text     as sector, * from public.field_orders_manila
  union all
  select 'pasig'::text      as sector, * from public.field_orders_pasig
  union all
  select 'balintawak'::text as sector, * from public.field_orders_balintawak
  union all
  select 'ami'::text        as sector, * from public.field_orders_ami;

revoke all on public.all_field_orders from anon, authenticated;

notify pgrst, 'reload schema';

-- Check: ten rows, one per table.
select table_name
from information_schema.columns
where table_schema = 'public' and column_name = 'plangrid'
order by table_name;
