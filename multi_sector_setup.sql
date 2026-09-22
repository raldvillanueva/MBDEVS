-- =====================================================================
-- Let an account be allowed into several sectors, not just one.
-- Run this ENTIRE file once in the Supabase SQL Editor. Safe to re-run.
--
-- profiles.sector held a single name. profiles.sectors holds a list, so
-- somebody can cover Rizal and Pasig without needing two accounts.
--
--   NULL   unrestricted — every sector, same as an empty box list
--   {...}  exactly these sectors and no others
--
-- The old `sector` column is left in place on purpose. Dropping it now
-- would break the previous frontend the moment this runs, and Vercel
-- deploys on its own schedule — so it stays as dead weight until the new
-- build is live. Nothing reads it after this.
-- =====================================================================

alter table public.profiles
  add column if not exists sectors text[];

-- Anything already assigned to one sector keeps exactly that access.
update public.profiles
   set sectors = array[sector]
 where sector is not null
   and sectors is null;

-- <@ is "contained by": every element must be a real sector. An empty
-- array is rejected because "allowed into nothing" is not a state worth
-- having — unrestricted is NULL, and no access is a deactivated account.
alter table public.profiles
  drop constraint if exists profiles_sectors_check;
alter table public.profiles
  add constraint profiles_sectors_check
  check (
    sectors is null
    or (
      array_length(sectors, 1) > 0
      and sectors <@ array['rizal', 'manila', 'pasig', 'balintawak', 'ami']::text[]
    )
  );

notify pgrst, 'reload schema';

-- Check: each account with a restriction should now list it.
select username, full_name, sector as old_single, sectors as allowed
from public.profiles
order by username;
