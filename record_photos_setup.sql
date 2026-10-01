-- =====================================================================
-- Photos on a record
-- =====================================================================
-- Up to five pictures can be attached to a field order or a pending
-- record. The files live in Supabase Storage; the record keeps only the
-- list of paths pointing at them.
--
-- The bucket is private. Nothing in it is reachable by URL alone — the
-- app asks for a short-lived signed link each time it shows a picture,
-- so a link that leaks stops working within the hour. These are photos
-- of customer premises and meters, which is not something to leave open
-- to anyone who guesses a filename.
--
-- Run this once in the Supabase SQL editor. Safe to run again.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The bucket.
-- ---------------------------------------------------------------------
-- 10 MB a file is generous: the app shrinks every picture to about
-- 1600px before it uploads, which lands well under 1 MB. The limit is
-- there to stop something unexpected, not to shape normal use.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'record-photos',
  'record-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 2. Who may do what with the files.
-- ---------------------------------------------------------------------
-- Anyone signed in can look. Only the people who may edit records can
-- add or remove a picture, which is the same line the records
-- themselves are drawn on.
drop policy if exists "record photos readable by signed-in users" on storage.objects;
create policy "record photos readable by signed-in users"
  on storage.objects for select
  using (bucket_id = 'record-photos' and auth.uid() is not null);

drop policy if exists "record photos uploaded by encoders" on storage.objects;
create policy "record photos uploaded by encoders"
  on storage.objects for insert
  with check (bucket_id = 'record-photos' and public.can_encode());

drop policy if exists "record photos removed by encoders" on storage.objects;
create policy "record photos removed by encoders"
  on storage.objects for delete
  using (bucket_id = 'record-photos' and public.can_encode());

-- ---------------------------------------------------------------------
-- 3. The column, on every sector's tables.
-- ---------------------------------------------------------------------
-- promote_pending_order copies whichever columns the two tables share,
-- so a record keeps its pictures on the way to Field Orders without
-- that function needing to know about them.
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
      execute format(
        'alter table public.%I add column if not exists photos text[] not null default ''{}''',
        t
      );
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 4. Check.
-- ---------------------------------------------------------------------
select
  (select count(*) from storage.buckets where id = 'record-photos')            as bucket,
  (select count(*) from storage.objects where bucket_id = 'record-photos')     as files_so_far,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and column_name = 'photos'
       and table_name like any (array['field_orders%', 'pending_orders%']))    as tables_with_column;
