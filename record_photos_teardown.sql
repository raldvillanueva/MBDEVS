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
-- DELETE THE BUCKET FIRST, FROM THE DASHBOARD:
--   Storage -> record-photos -> the ... menu -> Delete bucket
--   (empty it first if it asks)
--
-- It cannot be done here. Supabase blocks deletes against the storage
-- tables in SQL on purpose — removing the rows would leave the actual
-- files behind, still counting against the allowance with nothing left
-- pointing at them. The Storage API deletes both, so the dashboard is
-- the way.
--
-- This drops the photos column. Any paths stored in it go with it, so if
-- pictures were attached and you might want them back, stop here.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The policies.
-- ---------------------------------------------------------------------
drop policy if exists "record photos readable by signed-in users" on storage.objects;
drop policy if exists "record photos uploaded by encoders"        on storage.objects;
drop policy if exists "record photos removed by encoders"         on storage.objects;

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
-- 3. Check.
-- ---------------------------------------------------------------------
-- columns_left should be 0. bucket_left should be 0 too — if it is 1,
-- the bucket is still there and wants deleting from the dashboard; this
-- is a read, so it is allowed.
select
  (select count(*) from storage.buckets where id = 'record-photos')         as bucket_left,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and column_name = 'photos'
       and table_name like any (array['field_orders%', 'pending_orders%'])) as columns_left;
