-- =====================================================================
-- Add the AMI sector. Run this ENTIRE file once in the Supabase SQL
-- Editor. Safe to re-run.
--
-- AMI gets its own pair of tables like every other sector, and every
-- list that names the sector tables has to learn about them: RLS, the
-- updated_at trigger, the partner relay, the all_field_orders view, the
-- promote-from-pending function and the assigned-sector constraint.
-- Miss one and AMI half-works in a way that is hard to spot — records
-- save but never reach the partner, or an account cannot be assigned to
-- it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The tables.
--
--    LIKE copies the column list, defaults, constraints and indexes as
--    they are RIGHT NOW. It does not stay in sync, so a column added to
--    field_orders later has to be added here too — same caveat as the
--    other sectors (see sector_tables_setup.sql).
-- ---------------------------------------------------------------------
create table if not exists public.field_orders_ami  (like public.field_orders  including all);
create table if not exists public.pending_orders_ami (like public.pending_orders including all);

-- ---------------------------------------------------------------------
-- 2. RLS, matching role_permissions_setup.sql exactly.
--
--    A new table starts with no policies, and a table with RLS enabled
--    and no policy denies everything — so without this AMI would look
--    permanently empty rather than broken.
-- ---------------------------------------------------------------------
alter table public.field_orders_ami enable row level security;

drop policy if exists "fo_select" on public.field_orders_ami;
create policy "fo_select" on public.field_orders_ami
  for select to authenticated using (true);

drop policy if exists "fo_insert" on public.field_orders_ami;
create policy "fo_insert" on public.field_orders_ami
  for insert to authenticated with check (public.can_manage());

drop policy if exists "fo_update" on public.field_orders_ami;
create policy "fo_update" on public.field_orders_ami
  for update to authenticated using (public.can_manage()) with check (public.can_manage());

drop policy if exists "fo_delete" on public.field_orders_ami;
create policy "fo_delete" on public.field_orders_ami
  for delete to authenticated using (public.can_delete());

alter table public.pending_orders_ami enable row level security;

drop policy if exists "po_select" on public.pending_orders_ami;
create policy "po_select" on public.pending_orders_ami
  for select to authenticated using (true);

drop policy if exists "po_insert" on public.pending_orders_ami;
create policy "po_insert" on public.pending_orders_ami
  for insert to authenticated with check (public.can_encode());

drop policy if exists "po_update" on public.pending_orders_ami;
create policy "po_update" on public.pending_orders_ami
  for update to authenticated using (public.can_encode()) with check (public.can_encode());

drop policy if exists "po_delete" on public.pending_orders_ami;
create policy "po_delete" on public.pending_orders_ami
  for delete to authenticated using (public.can_manage());

-- ---------------------------------------------------------------------
-- 3. updated_at, and the trigger that maintains it.
--    LIKE copied the column if it already existed on field_orders, but
--    triggers are never copied by LIKE — they have to be recreated.
-- ---------------------------------------------------------------------
alter table public.field_orders_ami
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_updated_at on public.field_orders_ami;
create trigger set_updated_at
  before update on public.field_orders_ami
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. The partner relay, so AMI records push like every other sector's.
-- ---------------------------------------------------------------------
drop trigger if exists fo_relay on public.field_orders_ami;
create trigger fo_relay
  after insert or update or delete on public.field_orders_ami
  for each row execute function public.relay_field_order_change();

-- ---------------------------------------------------------------------
-- 5. The pull endpoint's view.
--
--    A view built with SELECT * freezes its column list at creation, so
--    this is dropped and rebuilt rather than replaced.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 6. Let an account be assigned to AMI.
-- ---------------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_sector_check;
alter table public.profiles
  add constraint profiles_sector_check
  check (sector is null or sector in ('rizal', 'manila', 'pasig', 'balintawak', 'ami'));

-- ---------------------------------------------------------------------
-- 7. Let a pending AMI record be sent to Field Orders.
--    The function maps a sector name to its two tables from a fixed
--    allowlist, so a sector it has not been told about is rejected.
-- ---------------------------------------------------------------------
create or replace function public.promote_pending_order(
  p_sector text,
  p_pending_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po_name text;
  v_fo_name text;
  v_cols    text;
  v_moved   int;
begin
  -- is not true rather than not(...): it is false for NULL as well as for
  -- false, so an anonymous caller is refused instead of waved through.
  if auth.uid() is null or public.can_encode() is not true then
    raise exception 'You do not have permission to send records to Field Orders'
      using errcode = '42501';
  end if;

  if p_sector = 'rizal' then
    v_po_name := 'pending_orders';
    v_fo_name := 'field_orders';
  elsif p_sector in ('manila', 'pasig', 'balintawak', 'ami') then
    v_po_name := 'pending_orders_' || p_sector;
    v_fo_name := 'field_orders_' || p_sector;
  else
    raise exception 'Unknown sector: %', p_sector using errcode = '22023';
  end if;

  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into v_cols
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = v_po_name
    and c.column_name not in ('id', 'created_at')
    and exists (
      select 1 from information_schema.columns f
      where f.table_schema = 'public'
        and f.table_name = v_fo_name
        and f.column_name = c.column_name
    );

  if v_cols is null then
    raise exception 'No shared columns between % and %', v_po_name, v_fo_name;
  end if;

  execute format(
    'insert into public.%I (%s) select %s from public.%I where id = %L',
    v_fo_name, v_cols, v_cols, v_po_name, p_pending_id
  );

  get diagnostics v_moved = row_count;

  if v_moved = 0 then
    raise exception 'That pending record no longer exists. Refresh and try again.'
      using errcode = 'P0002';
  end if;

  execute format('delete from public.%I where id = %L', v_po_name, p_pending_id);
end;
$$;

revoke all on function public.promote_pending_order(text, text) from public;
grant execute on function public.promote_pending_order(text, text) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 8. Check. Both AMI tables should appear, with RLS on.
-- ---------------------------------------------------------------------
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public' and tablename like '%_ami'
order by tablename;
