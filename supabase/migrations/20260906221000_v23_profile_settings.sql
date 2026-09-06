-- Ciao v23 profile/settings compatibility layer.
-- Additive and idempotent: production data and existing columns remain untouched.

alter table public.cp_users
  add column if not exists deadline_reminders_enabled boolean not null default true,
  add column if not exists lineup_notifications_enabled boolean not null default false,
  add column if not exists kickoff_notifications_enabled boolean not null default false,
  add column if not exists result_notifications_enabled boolean not null default false;
