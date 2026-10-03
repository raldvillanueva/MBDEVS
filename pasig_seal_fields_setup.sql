-- =====================================================================
-- LCG and MCB seals — Pasig only
-- =====================================================================
-- Pasig records two further sets of seals on a newly installed meter
-- that the other sectors do not:
--
--   LCG (Others)   typically 5 to 10 seals used
--   MCB (Others)   typically 2 to 4 seals used
--
-- Several seals go in each, so these are free text and hold the numbers
-- as the crew writes them down, the same as the seal fields beside them.
--
-- Added only to Pasig's two tables. The other sectors never ask for
-- them, and a column standing empty on every row of four sectors is a
-- column someone will eventually wonder whether they were meant to fill
-- in. The app shows the fields for Pasig and leaves them out of every
-- save elsewhere, so nothing else is affected either way.
--
-- Run this once in the Supabase SQL editor. Safe to run again.
-- =====================================================================

do $$
declare
  t text;
begin
  foreach t in array array['field_orders_pasig', 'pending_orders_pasig']
  loop
    if to_regclass('public.' || t) is null then
      raise exception 'Table public.% not found — run sector_tables_setup.sql first', t;
    end if;
    execute format('alter table public.%I add column if not exists lcg_others text', t);
    execute format('alter table public.%I add column if not exists mcb_others text', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Check. Should come back 4: two columns on each of the two tables.
-- ---------------------------------------------------------------------
-- promote_pending_order copies whichever columns the two tables share,
-- so a Pasig record carries these to Field Orders on its own once both
-- sides have them. That is why they go on in the same run.
select count(*) as columns_added
from information_schema.columns
where table_schema = 'public'
  and table_name in ('field_orders_pasig', 'pending_orders_pasig')
  and column_name in ('lcg_others', 'mcb_others');
