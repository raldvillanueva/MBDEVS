-- =====================================================================
-- Undo record_photos_setup.sql
-- =====================================================================
-- Photos were removed from the app: five pictures a record would have
-- filled the storage allowance after a few hundred records, which is not
-- a trade worth making for a system holding tens of thousands of them.
--
-- ONLY RUN THIS IF YOU RAN record_photos_setup.sql. If you never ran it,
-- there is nothing here to undo and nothing to do.
--
-- BEFORE RUNNING: empty the bucket from the Supabase dashboard first —
-- Storage -> record-photos -> select all -> delete. Deleting the rows in
-- SQL does not delete the files behind them, and they would sit there
-- counting against your allowance with nothing left pointing at them.
--
-- This drops the photos column. Any paths stored in it go with it, so if
-- pictures were attached and you might want them back, stop here.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The policies, then the bucket.
-- ---------------------------------------------------------------------
drop policy if exists "record photos readable by signed-in users" on storage.objects;
drop policy if exists "record photos uploaded by encoders"        on storage.objects;
drop policy if exists "record photos removed by encoders"         on storage.objects;

-- Refuses to run while files remain, which is the check that the bucket
-- was actually emptied first rather than a problem to work around.
delete from storage.buckets where id = 'record-photos';

-- ---------------------------------------------------------------------
-- 2. The column, from every sector's tables.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'field_orders',            'pending_orders',
    'field_orders_manila',     'pending_orders_manila',
    'field_orders_pasig',      'pending_orders_pasig',
    'field_orders_balintawak', 'pending_orders_balintawak',
    'field_orders_ami',        'pending_orders_ami'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I drop column if exists photos', t);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 3. Check. Both should come back 0.
-- ---------------------------------------------------------------------
select
  (select count(*) from storage.buckets where id = 'record-photos')         as bucket_left,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and column_name = 'photos'
       and table_name like any (array['field_orders%', 'pending_orders%'])) as columns_left;
