-- =====================================================================
-- Let an Encoder send a pending record on to Field Orders.
--
-- Run this in the Supabase SQL editor. Safe to re-run.
--
-- Why a function instead of loosening fo_insert:
--
--   Opening "insert into field_orders" to can_encode() would let an
--   Encoder write anything into the live table from anywhere in the app
--   — the importer, a hand-built request — not just a record that has
--   been through the Pending form and its required-field checks. This
--   function is the one narrow door: it copies a row that is ALREADY in
--   Pending and nothing else. fo_insert stays shut.
--
-- It also fixes a real bug. The app used to insert into field_orders and
-- then delete from pending_orders as two separate calls. If the delete
-- failed, the record existed in both tables and would be sent twice.
-- Both statements live in this function, so they are one transaction:
-- either the record moves or nothing happens.
-- =====================================================================

create or replace function public.promote_pending_order(
  p_sector text,
  p_pending_id text
)
returns void
language plpgsql
security definer
-- security definer runs this as the owner, so search_path is pinned to
-- stop a caller-controlled path resolving these names somewhere else.
set search_path = public
as $$
declare
  v_po_name text;
  v_fo_name text;
  v_cols    text;
  v_moved   int;
begin
  -- The function runs as its owner, so it has to do its own permission
  -- check. Without this, being able to call it would be the same as
  -- having write access to field_orders.
  -- is not true rather than not(...): it is false for NULL as well as for
  -- false, so an anonymous caller is refused instead of waved through.
  if auth.uid() is null or public.can_encode() is not true then
    raise exception 'You do not have permission to send records to Field Orders'
      using errcode = '42501';
  end if;

  -- An allowlist, not string building: p_sector reaches a table name, so
  -- it can only ever be one of these four.
  if p_sector = 'rizal' then
    v_po_name := 'pending_orders';
    v_fo_name := 'field_orders';
  elsif p_sector in ('manila', 'pasig', 'balintawak') then
    v_po_name := 'pending_orders_' || p_sector;
    v_fo_name := 'field_orders_' || p_sector;
  else
    raise exception 'Unknown sector: %', p_sector using errcode = '22023';
  end if;

  -- Copy only the columns the two tables share. The sector tables were
  -- built with LIKE, which does not stay in sync, so a column present on
  -- one side and not the other must not break the move.
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

-- Callers are checked inside the function, so every signed-in account may
-- call it; an account without can_encode() is refused there.
revoke all on function public.promote_pending_order(text, text) from public;
grant execute on function public.promote_pending_order(text, text) to authenticated;

notify pgrst, 'reload schema';
