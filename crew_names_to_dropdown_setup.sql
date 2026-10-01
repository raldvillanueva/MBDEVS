-- =====================================================================
-- Move Crew Names into Dropdown Lists.
-- Run this ENTIRE file once in the Supabase SQL Editor. Safe to re-run.
--
-- Crew names sat in app_settings as a plain list of strings: add and
-- remove, nothing else. Every other dropdown lives in dropdown_options,
-- where a value can be renamed, hidden and restored, reordered, limited
-- to certain sectors, and where every change is logged by the database
-- rather than by the page. This gives crew names the same treatment.
--
-- The names already saved are carried across, not re-typed. Nothing is
-- deleted: app_settings.crew_names is left exactly as it is, so a
-- frontend that has not been redeployed yet keeps reading it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Let the table hold crew names.
-- ---------------------------------------------------------------------
alter table public.dropdown_options
  drop constraint if exists dropdown_options_field_check;
alter table public.dropdown_options
  add constraint dropdown_options_field_check
  check (field in (
    'job_description', 'type_of_meter', 'fo_type', 'for_batch',
    'billed_amount', 'submitted_to', 'crew_name'
  ));

-- ---------------------------------------------------------------------
-- 2. Carry the saved names over, in the order they are already in.
--
--    The logging trigger is paused for this: it is a migration, not
--    somebody adding forty-four crews by hand, and the audit log should
--    read as what happened.
-- ---------------------------------------------------------------------
alter table public.dropdown_options disable trigger dropdown_options_log_change;

insert into public.dropdown_options (field, value, sort_order, created_by)
select
  'crew_name',
  trim(name.value),
  (name.ordinality * 10)::int,
  null
from public.app_settings s
cross join lateral jsonb_array_elements_text(s.value) with ordinality as name(value, ordinality)
where s.key = 'crew_names'
  and jsonb_typeof(s.value) = 'array'
  and trim(name.value) <> ''
on conflict do nothing;

alter table public.dropdown_options enable trigger dropdown_options_log_change;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 3. Check. Expect the same number of crew names as the General tab
--    was showing.
-- ---------------------------------------------------------------------
select count(*) as crew_names_moved
from public.dropdown_options
where field = 'crew_name';
