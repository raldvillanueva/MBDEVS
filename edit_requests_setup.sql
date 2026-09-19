-- =====================================================================
-- Edit Requests. Run this ENTIRE file once in the Supabase SQL Editor.
-- Safe to re-run.
--
-- Field Orders now feeds another system on a daily automatic pull, so it
-- is no longer edited freely: an Encoder proposes a change here instead
-- of writing straight to field_orders, and an Admin/Super Admin approves
-- or rejects it from the Edit Requests page. Same shape as
-- deletion_requests (rbac_and_deletion_requests_setup.sql,
-- sector_tables_setup.sql) — one shared table across all four sectors,
-- a sector column rather than a foreign key (per-sector tables mean a
-- Manila/Pasig/Balintawak request can never satisfy a
-- field_orders(id) constraint), Admin-only to resolve.
--
-- changes holds only the fields actually changed, as
-- {"field_name": {"old": <value>, "new": <value>}, ...} — not a full
-- copy of the record. Approving applies just those fields to the real
-- row, so anything anyone else changed in between is left alone.
-- =====================================================================

create table if not exists public.edit_requests (
  id                uuid primary key default gen_random_uuid(),
  field_order_id    uuid,
  field_order_no    text,
  sector            text not null default 'rizal',
  requested_by      uuid references public.profiles(id),
  requested_by_name text,
  reason            text not null,
  changes           jsonb not null default '{}'::jsonb,
  status            text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  resolved_by       uuid references public.profiles(id)
);

alter table public.edit_requests enable row level security;

drop policy if exists "edit_requests_select" on public.edit_requests;
create policy "edit_requests_select" on public.edit_requests
  for select to authenticated
  using (public.can_manage() or requested_by = auth.uid());

drop policy if exists "edit_requests_insert_own" on public.edit_requests;
create policy "edit_requests_insert_own" on public.edit_requests
  for insert to authenticated
  with check (requested_by = auth.uid());

drop policy if exists "edit_requests_update_admin_only" on public.edit_requests;
create policy "edit_requests_update_admin_only" on public.edit_requests
  for update to authenticated
  using (public.can_manage())
  with check (public.can_manage());

-- No delete policy — like deletion_requests, this is an audit trail and
-- is never removed via the client.
