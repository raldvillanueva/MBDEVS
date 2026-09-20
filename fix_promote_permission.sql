-- =====================================================================
-- SECURITY FIX. Run this in the Supabase SQL Editor now.
--
-- promote_pending_order's permission check did not stop an anonymous
-- caller. It read:
--
--     if not public.can_encode() then raise exception ...
--
-- can_encode() asks whether my_account_type() is in a list. With nobody
-- signed in, my_account_type() is NULL, and `NULL in (...)` is NULL, not
-- false. `not NULL` is NULL, and plpgsql treats an IF on NULL the same as
-- false — so the raise was skipped and the caller sailed past the guard.
--
-- The function is SECURITY DEFINER, so past that point it runs as the
-- owner and RLS no longer applies. Anyone who could reach the endpoint
-- and guess a pending record's id could move that record into
-- field_orders without being signed in.
--
-- Two changes, either of which would have been enough on its own:
--
--   1. The guard now demands a real TRUE, and a real signed-in user.
--   2. can_encode() and friends never return NULL again, so any other
--      `if not ...` written against them is safe by construction.
--
-- RLS was never affected. A policy needs a TRUE to allow a row, so a
-- NULL from these functions has always denied access there. This was
-- specific to the IF statement inside this function.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Make the capability helpers return a real boolean, never NULL.
-- ---------------------------------------------------------------------
create or replace function public.can_encode()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.my_account_type() in ('encoder', 'admin', 'super_admin'), false)
$$;

create or replace function public.can_manage()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.my_account_type() in ('admin', 'super_admin'), false)
$$;

create or replace function public.can_delete()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.my_account_type() in ('admin', 'super_admin'), false)
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.my_account_type() = 'super_admin', false)
$$;

-- ---------------------------------------------------------------------
-- 2. The guard itself: an explicit TRUE, and a signed-in caller.
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
  -- `is not true` rather than `not (...)`: it is false for NULL as well as
  -- for false, so an anonymous caller is refused instead of waved through.
  -- The auth.uid() check says the same thing a second way.
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

-- ---------------------------------------------------------------------
-- 3. And do not let anon reach it at all, so the guard above is the
--    second line of defence rather than the only one.
-- ---------------------------------------------------------------------
revoke all on function public.promote_pending_order(text, text) from public, anon;
grant execute on function public.promote_pending_order(text, text) to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 4. Check. All four should say false — this runs as nobody in the SQL
--    editor's eyes, which is exactly the case that used to slip through.
-- ---------------------------------------------------------------------
select
  public.can_encode()     as can_encode,
  public.can_manage()     as can_manage,
  public.can_delete()     as can_delete,
  public.is_super_admin() as is_super_admin;
