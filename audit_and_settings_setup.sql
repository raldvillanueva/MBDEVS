-- =====================================================================
-- Audit logs and system settings.
--
-- Run AFTER role_permissions_setup.sql and user_management_setup.sql.
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. audit_logs — who did what, and when.
--
--    Nothing currently records this. If a field order disappears there is
--    no way to say who removed it, and with five account types and
--    permanent deletes that is worth closing.
--
--    Written by the app rather than by triggers: the app knows the thing
--    a person recognises ("F25090604378"), where a trigger only sees a
--    uuid. The actor is pinned to auth.uid() by the insert policy, so a
--    client cannot log an action under someone else's name.
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles(id),
  actor_name   text,
  actor_email  text,
  action       text not null,
  sector       text,
  target_label text,
  target_id    uuid,
  details      jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx     on public.audit_logs (action);

alter table public.audit_logs enable row level security;

-- Reviewers read the log; everyone writes their own entries.
drop policy if exists "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select" on public.audit_logs
  for select to authenticated
  using (public.can_manage());

drop policy if exists "audit_logs_insert_own" on public.audit_logs;
create policy "audit_logs_insert_own" on public.audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid());

-- No update or delete policy, for the same reason deletion_requests has
-- none: a log that can be edited is not a log.

-- ---------------------------------------------------------------------
-- 2. app_settings — the values that were hardcoded.
--
--    Crew names and the overdue thresholds lived in JavaScript, so
--    changing a crew meant a developer and a deploy. They live here now.
--
--    One row per setting, value as jsonb so a setting can be a number or
--    a list without needing a new column each time.
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  label      text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.app_settings enable row level security;

-- Everyone reads: the crew list populates dropdowns for every account.
drop policy if exists "app_settings_select" on public.app_settings;
create policy "app_settings_select" on public.app_settings
  for select to authenticated using (true);

-- Only a Super Admin changes them — these are system-wide.
drop policy if exists "app_settings_write" on public.app_settings;
create policy "app_settings_write" on public.app_settings
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "app_settings_insert" on public.app_settings;
create policy "app_settings_insert" on public.app_settings
  for insert to authenticated
  with check (public.is_super_admin());

-- ---------------------------------------------------------------------
-- 3. Seed with what the code currently hardcodes, so nothing changes
--    behaviour on the day this runs.
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value, label) values
  (
    'crew_names',
    '["A. TOMADA","B. VERDARERO","C. BENIGNO","D. FABOL","E. VILLAREAL","J. BITAGO","J. J. SERRANO"]'::jsonb,
    'Crew names'
  ),
  (
    'overdue_warning_days',
    '10'::jsonb,
    'Overdue warning (days)'
  ),
  (
    'overdue_critical_days',
    '21'::jsonb,
    'Overdue critical (days)'
  )
on conflict (key) do nothing;

notify pgrst, 'reload schema';
