-- =====================================================================
-- Assigned Sector. Run this ENTIRE file once in the Supabase SQL
-- Editor. Safe to re-run.
--
-- profiles.sector says which single sector an account is restricted
-- to. NULL means unrestricted (the account can use every sector, same
-- as before this migration) — this matches the "(optional)" Assigned
-- Sector field already on the Create Account form.
--
-- This is enforced in the app (Sectors.jsx only offers the assigned
-- sector, Layout.jsx turns back any attempt to reach another one by
-- URL). It is NOT enforced per-row in the database: field_orders and
-- friends are already split one table per sector (see
-- sector_tables_setup.sql), so a restricted account only ever gets a
-- Supabase client pointed at its own sector's tables in the first
-- place — there is no shared table where an RLS check on this column
-- would add anything.
-- =====================================================================

alter table public.profiles
  add column if not exists sector text;

-- Keep it to a sector that actually exists. 'mbdevco' is deliberately
-- excluded: MBDEVCO is the read-only rollup every account can already
-- reach regardless of its assigned sector, not something to be assigned
-- into.
alter table public.profiles
  drop constraint if exists profiles_sector_check;
alter table public.profiles
  add constraint profiles_sector_check
  check (sector is null or sector in ('rizal', 'manila', 'pasig', 'balintawak'));

-- No RLS change needed: profiles_update (role_permissions_setup.sql)
-- already restricts every column on this table to a Super Admin, and
-- profiles_select already lets an account read its own row.
