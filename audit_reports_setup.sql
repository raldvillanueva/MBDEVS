-- =====================================================================
-- Audit Reports feature setup. Run this ENTIRE file once in the
-- Supabase SQL Editor, after rbac_and_deletion_requests_setup.sql.
-- Safe to re-run (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS
-- throughout).
--
-- Scope (Prompt 1 — Encoding Account Audit Report):
--   * An Encoding account can generate an audit report containing the
--     same figures already shown on its Dashboard.
--   * The Encoding account submits the report.
--   * Supervisor / Admin / Super Admin accounts can view submitted
--     reports.
--
-- Role model note: profiles.role only distinguishes 'staff' (view-only)
-- from 'admin' (full access) at the RLS/permission level — that split
-- is untouched by this migration. Supervisor, Admin and Super Admin are
-- all `role = 'admin'` underneath (identical permissions for now, per
-- product decision) but get their own distinct pages in the app, and
-- Encoder/Viewer are both `role = 'staff'`. The new `account_type`
-- column below records *which* of the five is which, purely so the
-- frontend can route each to its own page — it does not change any RLS
-- policy. This mirrors the five account kinds already named in
-- CreateAccountModal.jsx.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles.account_type
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists account_type text
  check (account_type in ('encoder', 'viewer', 'admin', 'supervisor', 'super_admin'));

-- Backfill existing rows: every 'admin' becomes the plain 'admin' page,
-- every 'staff' becomes 'encoder' (the more common case). Reassign
-- specific accounts to 'viewer' / 'supervisor' / 'super_admin' by hand
-- afterwards, e.g.:
--   update public.profiles set account_type = 'super_admin' where id = '<uuid>';
update public.profiles
  set account_type = case when role = 'admin' then 'admin' else 'encoder' end
  where account_type is null;

-- ---------------------------------------------------------------------
-- 2. audit_reports table
-- ---------------------------------------------------------------------
create table if not exists public.audit_reports (
  id                uuid primary key default gen_random_uuid(),
  sector            text not null,
  date_from         date,
  date_to           date,
  stats             jsonb not null,
  generated_by      uuid references public.profiles(id),
  generated_by_name text,
  submitted_at      timestamptz not null default now()
);

alter table public.audit_reports enable row level security;

-- Encoding accounts see their own submitted reports; is_admin() covers
-- Admin/Supervisor/Super Admin equally, since all three are role='admin'.
drop policy if exists "audit_reports_select" on public.audit_reports;
create policy "audit_reports_select" on public.audit_reports
  for select to authenticated
  using (public.is_admin() or generated_by = auth.uid());

drop policy if exists "audit_reports_insert_own" on public.audit_reports;
create policy "audit_reports_insert_own" on public.audit_reports
  for insert to authenticated
  with check (generated_by = auth.uid());

-- No update/delete policy — a submitted report is an immutable audit
-- trail, same convention as deletion_requests.
