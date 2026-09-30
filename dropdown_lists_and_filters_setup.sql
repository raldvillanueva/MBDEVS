-- =====================================================================
-- Dropdown Lists + Saved Filters.
--
-- Run this ENTIRE file once in the Supabase SQL Editor, AFTER
-- role_permissions_setup.sql and audit_and_settings_setup.sql.
-- Safe to re-run.
--
-- It only ADDS things: two new tables, a few functions and triggers.
-- No existing table, column, row or policy is changed or removed, so the
-- version of the app that is live right now keeps working exactly as it
-- did — it simply does not know these tables exist yet.
--
--   1. dropdown_options   the choices in the Job Description, Type of
--                         Meter, FO Type, For Batch and Billed Amount
--                         dropdowns. Edited by Admin and Super Admin from
--                         the Dropdown Lists page instead of in code.
--   2. Change log         every add / rename / hide / restore / sector
--                         change is written to audit_logs BY THE DATABASE,
--                         so the Super Admin sees who changed what even if
--                         the change did not come through the app.
--   3. Distinct values    lets the filters offer the values that are
--                         actually in the records, not only the list.
--   4. saved_filters      named filter sets, per sector, private unless
--                         an Admin / Super Admin shares them.
--   5. Two new columns    Submitted To and Date of Submitted, on every
--                         sector's Field Orders and Pending tables. They
--                         start empty; no existing value is touched.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Who may edit the lists: Admin and Super Admin.
-- ---------------------------------------------------------------------
create or replace function public.can_edit_lists()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(public.my_account_type() in ('admin', 'super_admin'), false)
$$;

grant execute on function public.can_edit_lists() to authenticated;


-- ---------------------------------------------------------------------
-- 1. dropdown_options
--
--    One row per choice. A choice is never deleted, only hidden
--    (active = false): records already using it keep their value, and it
--    can be brought back with one click.
--
--    sectors: NULL means "every sector". A list of sector keys limits the
--    choice to those sectors only (e.g. {ami}).
-- ---------------------------------------------------------------------
create table if not exists public.dropdown_options (
  id          uuid primary key default gen_random_uuid(),
  field       text not null,
  value       text not null,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  sectors     text[],
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) default auth.uid(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id)
);

alter table public.dropdown_options drop constraint if exists dropdown_options_field_check;
alter table public.dropdown_options add constraint dropdown_options_field_check
  check (field in ('job_description', 'type_of_meter', 'fo_type', 'for_batch', 'billed_amount', 'submitted_to'));

alter table public.dropdown_options drop constraint if exists dropdown_options_value_check;
alter table public.dropdown_options add constraint dropdown_options_value_check
  check (length(btrim(value)) between 1 and 100);

alter table public.dropdown_options drop constraint if exists dropdown_options_sectors_check;
alter table public.dropdown_options add constraint dropdown_options_sectors_check
  check (
    sectors is null
    or (cardinality(sectors) > 0
        and sectors <@ array['rizal', 'manila', 'pasig', 'balintawak', 'ami']::text[])
  );

-- "Replace" and "REPLACE " are the same choice.
create unique index if not exists dropdown_options_field_value_key
  on public.dropdown_options (field, upper(btrim(value)));

create index if not exists dropdown_options_field_idx
  on public.dropdown_options (field, sort_order);

-- Tidy the value before it is stored: trimmed, upper case like every
-- existing value, and a Billed Amount has to be a number.
create or replace function public.dropdown_options_before_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.value := upper(regexp_replace(btrim(new.value), '\s+', ' ', 'g'));

  if new.field = 'billed_amount' then
    if new.value !~ '^[0-9]+(\.[0-9]{1,2})?$' then
      raise exception 'Billed Amount must be a number, e.g. 172.45'
        using errcode = '22023';
    end if;
  end if;

  -- An empty sector list would hide the choice everywhere; that is what
  -- "hidden" is for, so store it as "every sector" instead.
  if new.sectors is not null and cardinality(new.sectors) = 0 then
    new.sectors := null;
  end if;

  if tg_op = 'UPDATE' then
    new.field      := old.field;       -- a choice cannot move to another list
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists dropdown_options_before_write on public.dropdown_options;
create trigger dropdown_options_before_write
  before insert or update on public.dropdown_options
  for each row execute function public.dropdown_options_before_write();

alter table public.dropdown_options enable row level security;

-- Everyone signed in reads: every form and filter needs the list.
drop policy if exists "dropdown_options_select" on public.dropdown_options;
create policy "dropdown_options_select" on public.dropdown_options
  for select to authenticated using (true);

drop policy if exists "dropdown_options_insert" on public.dropdown_options;
create policy "dropdown_options_insert" on public.dropdown_options
  for insert to authenticated with check (public.can_edit_lists());

drop policy if exists "dropdown_options_update" on public.dropdown_options;
create policy "dropdown_options_update" on public.dropdown_options
  for update to authenticated
  using (public.can_edit_lists())
  with check (public.can_edit_lists());

-- No delete policy on purpose: choices are hidden, never destroyed.


-- ---------------------------------------------------------------------
-- 2. Change log → audit_logs
--
--    Written by a trigger rather than by the page, so a change cannot
--    skip the log — and audit_logs has no update/delete policy, so an
--    entry cannot be removed afterwards either.
--
--    Pure re-ordering is not logged: dragging one item would otherwise
--    write a line for every item below it.
-- ---------------------------------------------------------------------
create or replace function public.dropdown_options_log_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_action  text;
  v_details jsonb;
  v_name    text;
  v_email   text;
begin
  if tg_op = 'INSERT' then
    v_action  := 'dropdown.added';
    v_details := jsonb_build_object('field', new.field, 'value', new.value, 'sectors', new.sectors);
  elsif old.value is distinct from new.value then
    v_action  := 'dropdown.renamed';
    v_details := jsonb_build_object('field', new.field, 'old', old.value, 'new', new.value);
  elsif old.active and not new.active then
    v_action  := 'dropdown.hidden';
    v_details := jsonb_build_object('field', new.field, 'value', new.value);
  elsif not old.active and new.active then
    v_action  := 'dropdown.restored';
    v_details := jsonb_build_object('field', new.field, 'value', new.value);
  elsif old.sectors is distinct from new.sectors then
    v_action  := 'dropdown.sectors_changed';
    v_details := jsonb_build_object('field', new.field, 'value', new.value,
                                    'old', old.sectors, 'new', new.sectors);
  else
    return new;   -- only the order moved
  end if;

  select p.full_name, p.email into v_name, v_email
  from public.profiles p where p.id = auth.uid();

  insert into public.audit_logs
    (actor_id, actor_name, actor_email, action, sector, target_label, target_id, details)
  values
    (auth.uid(), v_name, v_email, v_action, null, new.value, new.id, v_details);

  return new;
end;
$$;

drop trigger if exists dropdown_options_log_change on public.dropdown_options;
create trigger dropdown_options_log_change
  after insert or update on public.dropdown_options
  for each row execute function public.dropdown_options_log_change();


-- ---------------------------------------------------------------------
-- 3. Seed — everything the code offers today, in the same order, plus
--    the 18 new Job Descriptions. Nothing is replaced: values that were
--    in any form, filter or drawer are all kept.
--
--    The seed runs with the log trigger switched off, so installing this
--    does not fill the Audit Logs with 70 "added" lines.
-- ---------------------------------------------------------------------
alter table public.dropdown_options disable trigger dropdown_options_log_change;

insert into public.dropdown_options (field, value, sort_order, created_by)
select s.field, s.value, s.ord, null
from (values
  -- Job Description — existing
  ('job_description', 'REPLACE',                     10),
  ('job_description', 'REPLACE-EMC',                 20),
  ('job_description', 'REPLACE-EMX',                 30),
  ('job_description', 'RETIRE',                      40),
  ('job_description', 'RETIRE-EMC',                  50),
  ('job_description', 'RETIRE-EMC-WIRE',             60),
  ('job_description', 'REMOVE',                      70),
  -- Job Description — new
  ('job_description', 'BROKEN-SEAL',                 80),
  ('job_description', 'RE-SEALING OF LSG & GRILLS',  90),
  ('job_description', 'DISCONNECTION',              100),
  ('job_description', 'RECONNECTION',               110),
  ('job_description', 'EMPTY METER BASE',           120),
  ('job_description', 'MULTI METERING',             130),
  ('job_description', 'ENERGIZATION',               140),
  ('job_description', 'REPREL',                     150),
  ('job_description', 'ERC SAMPLING',               160),
  ('job_description', 'AMI',                        170),
  ('job_description', 'ASSIST TO REGULAR CREW',     180),
  ('job_description', 'BASKET-ENERGIZE',            190),
  ('job_description', 'INTERCHANGE',                200),
  ('job_description', 'MC/PU -REPLACE',             210),
  ('job_description', 'MC/PU -ENERGIZE',            220),
  ('job_description', 'MC/PU -RETIRE',              230),
  ('job_description', 'RETAIN METER',               240),
  ('job_description', 'ROLAND',                     250),

  -- Type of Meter
  ('type_of_meter', '12S',                10),
  ('type_of_meter', '12S ID METER',       20),
  ('type_of_meter', '1S',                 30),
  ('type_of_meter', '1S EMC L-G',         40),
  ('type_of_meter', '25S',                50),
  ('type_of_meter', '2S EMC L-G',         60),
  ('type_of_meter', '2S EMC L-L',         70),
  ('type_of_meter', '2S EMX',             80),
  ('type_of_meter', '2S ID',              90),
  ('type_of_meter', '2S ID METER',       100),
  ('type_of_meter', '2S ID METER/ERC',   110),
  ('type_of_meter', '2S PLAIN METER',    120),
  ('type_of_meter', '9S',                130),
  ('type_of_meter', 'EMX',               140),
  ('type_of_meter', 'ERC 2S PLAIN METER',150),
  ('type_of_meter', 'FOR REPLACE',       160),
  ('type_of_meter', 'KLOAD',             170),
  ('type_of_meter', 'RETURNED',          180),
  ('type_of_meter', '1S PLAIN METER',    190),
  ('type_of_meter', '3S PLAIN METER',    200),

  -- FO Type
  ('fo_type', 'CANCEL',               10),
  ('fo_type', 'CANCEL-EMC',           20),
  ('fo_type', 'CUT SERVICE ENTRANCE', 30),
  ('fo_type', 'ENERGIZED',            40),
  ('fo_type', 'REMOVE',               50),
  ('fo_type', 'REMOVE-EMC',           60),
  ('fo_type', 'REMOVE-EMC-WIRE',      70),
  ('fo_type', 'REPLACE',              80),
  ('fo_type', 'REPLACE-EMC',          90),
  ('fo_type', 'REPLACE-EMX',         100),
  ('fo_type', 'RETIRE',              110),

  -- For Batch
  ('for_batch', 'ALREADY BATCH',  10),
  ('for_batch', 'FOR BATCH',      20),
  ('for_batch', 'MISSING METER',  30),
  ('for_batch', 'OTHERS PENDING', 40),

  -- Billed Amount
  ('billed_amount', '0',        10),
  ('billed_amount', '172.45',   20),
  ('billed_amount', '253.43',   30),
  ('billed_amount', '344.9',    40),
  ('billed_amount', '383.22',   50),
  ('billed_amount', '574.83',   60),
  ('billed_amount', '766.44',   70),
  ('billed_amount', '958.05',   80),
  ('billed_amount', '1013.71',  90),
  ('billed_amount', '1689.61', 100)
) as s(field, value, ord)
on conflict (field, upper(btrim(value))) do nothing;

alter table public.dropdown_options enable trigger dropdown_options_log_change;


-- ---------------------------------------------------------------------
-- 4. Distinct values actually in the records.
--
--    The column filters list these next to the dropdown list, so an old
--    or imported value that is not on the list can still be filtered on.
--
--    security invoker: it runs as the caller, so the normal RLS on the
--    sector tables still applies. Sector and column come from allowlists
--    because they end up in a table / column name.
-- ---------------------------------------------------------------------
create or replace function public.field_order_distinct_values(
  p_sector   text,
  p_column   text,
  p_archived boolean default false
)
returns table (value text, n bigint)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_table text;
begin
  if p_sector = 'rizal' then
    v_table := 'field_orders';
  elsif p_sector in ('manila', 'pasig', 'balintawak', 'ami') then
    v_table := 'field_orders_' || p_sector;
  else
    raise exception 'Unknown sector: %', p_sector using errcode = '22023';
  end if;

  if p_column not in ('job_description', 'type_of_meter', 'fo_type', 'for_batch',
                      'billed_amount', 'status_crew', 'crew_name', 'fo_action',
                      'submitted_to') then
    raise exception 'Column not allowed: %', p_column using errcode = '22023';
  end if;

  -- fo_action exists on pending tables only in some installs.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = v_table and column_name = p_column
  ) then
    return;
  end if;

  return query execute format(
    'select %1$I::text as value, count(*) as n
       from public.%2$I
      where archived_at is %3$s null
      group by 1
      order by 1 nulls first
      limit 500',
    p_column, v_table, case when p_archived then 'not' else '' end
  );
end;
$$;

revoke all on function public.field_order_distinct_values(text, text, boolean) from public;
grant execute on function public.field_order_distinct_values(text, text, boolean) to authenticated;


-- ---------------------------------------------------------------------
-- 5. saved_filters
--
--    A named set of search + filters, belonging to one sector and one
--    page. Private to whoever saved it. An Admin / Super Admin can tick
--    "Share with this sector" so everyone working in that sector sees it.
-- ---------------------------------------------------------------------
create table if not exists public.saved_filters (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  owner_name  text,
  sector      text not null,
  page        text not null,
  name        text not null,
  config      jsonb not null default '{}'::jsonb,
  shared      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.saved_filters drop constraint if exists saved_filters_sector_check;
alter table public.saved_filters add constraint saved_filters_sector_check
  check (sector in ('rizal', 'manila', 'pasig', 'balintawak', 'ami'));

alter table public.saved_filters drop constraint if exists saved_filters_page_check;
alter table public.saved_filters add constraint saved_filters_page_check
  check (page in ('field_orders', 'pending', 'archived'));

alter table public.saved_filters drop constraint if exists saved_filters_name_check;
alter table public.saved_filters add constraint saved_filters_name_check
  check (length(btrim(name)) between 1 and 60);

create index if not exists saved_filters_lookup_idx
  on public.saved_filters (sector, page);

-- The owner never changes, and the name is kept tidy.
create or replace function public.saved_filters_before_write()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.name := btrim(new.name);
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    select coalesce(p.full_name, p.email) into new.owner_name
    from public.profiles p where p.id = auth.uid();
  else
    new.owner_id   := old.owner_id;
    new.owner_name := old.owner_name;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saved_filters_before_write on public.saved_filters;
create trigger saved_filters_before_write
  before insert or update on public.saved_filters
  for each row execute function public.saved_filters_before_write();

alter table public.saved_filters enable row level security;

-- Your own, plus anything shared.
drop policy if exists "saved_filters_select" on public.saved_filters;
create policy "saved_filters_select" on public.saved_filters
  for select to authenticated
  using (owner_id = auth.uid() or shared);

-- Anyone can save their own; only Admin / Super Admin can share.
drop policy if exists "saved_filters_insert" on public.saved_filters;
create policy "saved_filters_insert" on public.saved_filters
  for insert to authenticated
  with check (owner_id = auth.uid() and (not shared or public.can_edit_lists()));

-- Change your own; Admin / Super Admin can also tidy up shared ones.
drop policy if exists "saved_filters_update" on public.saved_filters;
create policy "saved_filters_update" on public.saved_filters
  for update to authenticated
  using (owner_id = auth.uid() or (shared and public.can_edit_lists()))
  with check (not shared or public.can_edit_lists());

drop policy if exists "saved_filters_delete" on public.saved_filters;
create policy "saved_filters_delete" on public.saved_filters
  for delete to authenticated
  using (owner_id = auth.uid() or (shared and public.can_edit_lists()));



-- ---------------------------------------------------------------------
-- 6. Submitted To / Date of Submitted
--
--    Added to every sector table that exists. Both start empty and are
--    optional, so nothing already saved changes and no form starts
--    demanding them. The app hides the two fields until these columns
--    exist, so it is fine if the code goes live before this runs.
--
--    Not added to the partner API (field-orders / fo-relay): what the
--    partner receives stays exactly as it is.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'field_orders', 'field_orders_manila', 'field_orders_pasig', 'field_orders_balintawak', 'field_orders_ami',
    'pending_orders', 'pending_orders_manila', 'pending_orders_pasig', 'pending_orders_balintawak', 'pending_orders_ami'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I add column if not exists submitted_to text', t);
      execute format('alter table public.%I add column if not exists date_submitted date', t);
    end if;
  end loop;
end $$;


notify pgrst, 'reload schema';
