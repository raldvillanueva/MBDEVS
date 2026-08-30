-- =====================================================================
-- Outbound API for the partner team.
--
--   Real-time  : row change -> Database Webhook -> "fo-relay" Edge
--                Function -> HTTPS POST to the partner endpoint.
--   Backfill   : "field-orders" Edge Function reads the all_field_orders
--                view (initial load + reconciliation of missed events).
--
-- Run this ENTIRE file once in the Supabase SQL Editor, AFTER
-- sector_tables_setup.sql. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. updated_at, so edits can be reconciled.
--
--    The tables only had created_at, which means a consumer can spot new
--    records but cannot tell that an existing one was edited. Real-time
--    push mostly covers that, but any event lost while the partner is
--    down is unrecoverable without this column.
--
--    The app never writes it — the trigger maintains it.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'field_orders', 'field_orders_manila',
    'field_orders_pasig', 'field_orders_balintawak'
  ] loop
    execute format(
      'alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
  end loop;
end $$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'field_orders', 'field_orders_manila',
    'field_orders_pasig', 'field_orders_balintawak'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. One view over the four sector tables.
--
--    Records are split per sector (see sector_tables_setup.sql), which
--    is right for the app but wrong for an integration — the partner
--    should not have to know our table layout, or call four endpoints
--    and stitch the results together. The view adds the sector as a
--    real column, since it is otherwise implied only by the table name.
-- ---------------------------------------------------------------------
-- Dropped and recreated rather than "create or replace": the column list
-- is fixed when the view is built, so any column added to the tables later
-- means re-running this block.
drop view if exists public.all_field_orders;
create view public.all_field_orders as
  select 'rizal'::text      as sector, * from public.field_orders
  union all
  select 'manila'::text     as sector, * from public.field_orders_manila
  union all
  select 'pasig'::text      as sector, * from public.field_orders_pasig
  union all
  select 'balintawak'::text as sector, * from public.field_orders_balintawak;

-- The Edge Functions read this with the service role. No grant to
-- "authenticated" or "anon": the partner never touches the DB directly.
revoke all on public.all_field_orders from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Failed deliveries.
--
--    Database Webhooks are fire-and-forget: if the partner endpoint is
--    down or slow, that change is gone. Every failure lands here so it
--    can be replayed, instead of turning into a silent gap nobody
--    notices for weeks.
-- ---------------------------------------------------------------------
create table if not exists public.relay_failures (
  id          uuid primary key default gen_random_uuid(),
  sector      text,
  event_type  text,
  payload     jsonb not null,
  error       text,
  created_at  timestamptz not null default now(),
  replayed_at timestamptz
);

alter table public.relay_failures enable row level security;

-- Admins can review the backlog in the SQL editor / dashboard. The Edge
-- Function writes with the service role, which bypasses RLS.
drop policy if exists "relay_failures_select_admin" on public.relay_failures;
create policy "relay_failures_select_admin" on public.relay_failures
  for select to authenticated using (public.is_admin());

-- Outstanding deliveries:
--   select * from public.relay_failures where replayed_at is null order by created_at;

-- ---------------------------------------------------------------------
-- 4. Fire a request at the relay function on every row change.
--
--    This calls pg_net directly instead of going through Supabase's
--    "Database Webhooks" UI. Same mechanism underneath — that feature is
--    a wrapper around pg_net — but it needs no dashboard toggle, and the
--    payload is built here so it matches the Edge Function exactly.
--
--    Replace REPLACE_WITH_RELAY_SECRET with the RELAY_SECRET you set on
--    the Edge Function. It is what stops anyone else POSTing fake events.
--
--    NOTE: the secret sits in the function body, readable by anyone with
--    database access. Rotate it if that group changes.
-- ---------------------------------------------------------------------
create extension if not exists pg_net;

create or replace function public.relay_field_order_change()
returns trigger
language plpgsql
-- SECURITY DEFINER so the call runs as the owner: ordinary staff accounts
-- have no rights on the net schema, and without this their saves would
-- fail on the trigger rather than the relay simply not firing.
security definer
set search_path = public, pg_temp
as $fn$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type',       tg_op,
    'table',      tg_table_name,
    'schema',     tg_table_schema,
    'record',     case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    'old_record', case when tg_op = 'INSERT' then null else to_jsonb(old) end
  );

  -- pg_net queues the request and returns immediately, so a slow or
  -- unreachable partner can never hold up a save in the app.
  perform net.http_post(
    url := 'https://ofgggclyliouuocgoovj.functions.supabase.co/fo-relay',
    body := payload,
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-relay-secret', 'REPLACE_WITH_RELAY_SECRET'
    ),
    timeout_milliseconds := 5000
  );

  return null;  -- AFTER trigger: return value is ignored
end;
$fn$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'field_orders', 'field_orders_manila',
    'field_orders_pasig', 'field_orders_balintawak'
  ] loop
    execute format('drop trigger if exists fo_relay on public.%I', t);
    execute format(
      'create trigger fo_relay
         after insert or update or delete on public.%I
         for each row execute function public.relay_field_order_change()', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
