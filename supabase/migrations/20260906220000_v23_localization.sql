create table if not exists public.cp_team_localizations (
  provider_team_id text primary key,
  name_ru text not null,
  genitive_ru text,
  dative_ru text,
  prepositional_ru text,
  aliases_ru text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.cp_team_localizations enable row level security;

comment on table public.cp_team_localizations is
  'Versioned Russian team localization registry for standalone Ciao v23.';
comment on column public.cp_team_localizations.provider_team_id is
  'Stable BSD provider team id. Operational identifier, not a secret.';
