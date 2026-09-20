-- =====================================================================
-- Deactivate and archive accounts. Run this ENTIRE file once in the
-- Supabase SQL Editor. Safe to re-run.
--
-- Two timestamps rather than one status word, matching how field orders
-- already archive — and a timestamp says WHEN, which a status word does
-- not.
--
--   deactivated_at   cannot sign in. Still listed. Reversible.
--   archived_at      cannot sign in, and out of the everyday list.
--
-- Deleting an account is deliberately still not offered. profiles.id is
-- referenced by deletion_requests, edit_requests and audit_logs, and an
-- audit trail that loses the name of whoever acted is not an audit
-- trail. Archiving keeps the history intact and gets them out of the
-- way, which is what "remove this person" actually needs to mean.
-- =====================================================================

alter table public.profiles
  add column if not exists deactivated_at timestamptz;

alter table public.profiles
  add column if not exists archived_at timestamptz;

-- An archived account is by definition also deactivated. Enforcing it
-- here means no code path can produce an archived account that can still
-- sign in, however the row is written.
alter table public.profiles
  drop constraint if exists profiles_archived_implies_deactivated;
alter table public.profiles
  add constraint profiles_archived_implies_deactivated
  check (archived_at is null or deactivated_at is not null);

-- Finding the active accounts is the common read, so it gets the index.
create index if not exists profiles_active_idx
  on public.profiles (archived_at)
  where archived_at is null;

-- No policy change. profiles_update already restricts every column on
-- this table to a Super Admin, so these two are covered by the rule that
-- was already there.

notify pgrst, 'reload schema';

-- Check: every existing account should come back active, with both
-- timestamps empty.
select
  count(*)                                          as total,
  count(*) filter (where deactivated_at is null)    as active,
  count(*) filter (where deactivated_at is not null) as deactivated,
  count(*) filter (where archived_at is not null)   as archived
from public.profiles;
