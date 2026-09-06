-- Isolated schema for Ciao, Web! v23 TEST only.
-- No Production user-generated rows are copied into this database.

create table if not exists public.cp_teams (
  id bigserial primary key,
  name text not null,
  short_name text not null,
  custom_emoji_id text,
  custom_emoji_index integer,
  api_football_team_id bigint,
  bsd_team_id bigint unique
);

create unique index if not exists cp_teams_name_key on public.cp_teams(name);

create table if not exists public.cp_rounds (
  id bigserial primary key,
  number integer not null unique check (number > 0),
  nominal_date date not null
);

create table if not exists public.cp_matches (
  id bigserial primary key,
  round_id bigint not null,
  home_team_id bigint not null,
  away_team_id bigint not null,
  kickoff_at timestamptz,
  schedule_status text not null default 'scheduled',
  home_score integer check (home_score is null or home_score between 0 and 99),
  away_score integer check (away_score is null or away_score between 0 and 99),
  is_finished boolean not null default false,
  api_football_fixture_id bigint,
  live_status text,
  live_elapsed integer,
  live_updated_at timestamptz,
  result_source text,
  result_locked boolean not null default false,
  bsd_event_id bigint unique,
  live_phase text,
  constraint cp_matches_round_fk foreign key (round_id) references public.cp_rounds(id) on delete restrict,
  constraint cp_matches_home_team_fk foreign key (home_team_id) references public.cp_teams(id) on delete restrict,
  constraint cp_matches_away_team_fk foreign key (away_team_id) references public.cp_teams(id) on delete restrict,
  constraint cp_matches_unique_fixture unique (round_id, home_team_id, away_team_id),
  constraint cp_matches_distinct_teams check (home_team_id <> away_team_id)
);

create index if not exists cp_matches_kickoff_idx on public.cp_matches(kickoff_at);
create index if not exists cp_matches_round_idx on public.cp_matches(round_id);

create table if not exists public.cp_users (
  id bigserial primary key,
  telegram_id bigint not null unique,
  username text,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_admin boolean not null default false,
  deadline_reminders_enabled boolean not null default true,
  favorite_team_id bigint,
  lineup_notifications_enabled boolean not null default false,
  kickoff_notifications_enabled boolean not null default false,
  result_notifications_enabled boolean not null default false,
  constraint cp_users_favorite_team_fk foreign key (favorite_team_id) references public.cp_teams(id) on delete set null
);

create table if not exists public.cp_predictions (
  id bigserial primary key,
  user_id bigint not null,
  match_id bigint not null,
  home_score integer not null check (home_score between 0 and 20),
  away_score integer not null check (away_score between 0 and 20),
  points integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  base_points integer,
  constraint cp_predictions_user_fk foreign key (user_id) references public.cp_users(id) on delete cascade,
  constraint cp_predictions_match_fk foreign key (match_id) references public.cp_matches(id) on delete cascade,
  constraint cp_predictions_unique unique (user_id, match_id)
);

create index if not exists cp_predictions_user_idx on public.cp_predictions(user_id);
create index if not exists cp_predictions_match_idx on public.cp_predictions(match_id);

create table if not exists public.cp_competition_predictions (
  id bigserial primary key,
  user_id bigint not null references public.cp_users(id) on delete cascade,
  match_id text not null,
  competition text not null check (competition in ('coppa_italia','ucl','uel','uecl')),
  season text not null,
  predicted_home smallint not null check (predicted_home between 0 and 20),
  predicted_away smallint not null check (predicted_away between 0 and 20),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locked_at timestamptz not null,
  points integer,
  result_type text,
  final_home smallint,
  final_away smallint,
  result_fingerprint text,
  scored_at timestamptz,
  constraint cp_competition_predictions_user_match_key unique (user_id, match_id),
  constraint cp_competition_predictions_identity_check check (match_id like competition || ':%')
);

create index if not exists cp_competition_predictions_user_idx
  on public.cp_competition_predictions(user_id);
create index if not exists cp_competition_predictions_competition_idx
  on public.cp_competition_predictions(competition);
create index if not exists cp_competition_predictions_locked_idx
  on public.cp_competition_predictions(locked_at);

create table if not exists public.cp_scoring_rules (
  id integer primary key default 1 check (id = 1),
  exact_score integer not null default 5,
  correct_goal_difference integer not null default 3,
  correct_outcome integer not null default 2,
  miss integer not null default 0,
  bonus_multiplier integer not null default 1 check (bonus_multiplier >= 1)
);

insert into public.cp_scoring_rules (
  id, exact_score, correct_goal_difference, correct_outcome, miss, bonus_multiplier
) values (1, 5, 3, 2, 0, 1)
on conflict (id) do update set
  exact_score = excluded.exact_score,
  correct_goal_difference = excluded.correct_goal_difference,
  correct_outcome = excluded.correct_outcome,
  miss = excluded.miss,
  bonus_multiplier = excluded.bonus_multiplier;

-- Browser clients never write directly to these TEST user tables.
-- The service-role Edge Function is the only write owner.
alter table public.cp_users enable row level security;
alter table public.cp_predictions enable row level security;
alter table public.cp_competition_predictions enable row level security;
