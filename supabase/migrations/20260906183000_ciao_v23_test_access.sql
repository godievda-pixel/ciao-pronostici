create table if not exists public.cp_test_access (
  telegram_id bigint primary key,
  created_at timestamptz not null default now()
);

alter table public.cp_test_access enable row level security;

alter table public.cp_users
  drop constraint if exists cp_users_test_access_fk;

alter table public.cp_users
  add constraint cp_users_test_access_fk
  foreign key (telegram_id)
  references public.cp_test_access (telegram_id);
