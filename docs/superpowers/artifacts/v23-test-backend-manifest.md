# v23 TEST backend manifest

## Environment
- Supabase TEST project: `lcnwccnkkxaosxnfvjvr`
- Canonical Edge Function: `ciao-v23-api`
- Deployed function version: `1`
- Function status after deployment: `ACTIVE`
- Supabase JWT gate: disabled because `ciao-v23-api` validates Telegram Mini App `initData` itself and applies the `@CiaoCalcio` membership gate.
- Production Supabase `dkefzepiiudehhzbbrjn` is not a runtime dependency.

## Public API contract
`ciao-v23-api` owns exactly these modular actions:
- `modular_matches`
- `modular_standings`
- `modular_favorite`
- `modular_predictions`
- `modular_save_predictions`
- `modular_ranking`
- `modular_match_center`

It also exposes the minimum legacy actions required while the v23 candidate still uses the v22.5 HTML shell: `state`, `serie_a_table`, `save_predictions`, `prediction_rules`, `set_favorite_team`, and `toggle_reminders`.

## TEST schema
| Object | Classification | Initial state |
|---|---|---|
| `cp_users` | test-generated | 0 rows |
| `cp_predictions` | test-generated | 0 rows |
| `cp_competition_predictions` | test-generated | 0 rows |
| `cp_teams` | TEST reference cache, populated from BSD | 0 rows |
| `cp_rounds` | TEST reference cache, populated from BSD | 0 rows |
| `cp_matches` | TEST reference cache, populated from BSD | 0 rows |
| `cp_scoring_rules` | static reference | 1 row: `5 / 3 / 2 / 0`, multiplier `1` |

No Production users, predictions, favorites, rankings, notification state, telemetry, tokens, or private settings were copied.

## Data sources
- Football provider: BSD Football API v2.
- Serie A teams/rounds/matches are synchronized into TEST tables on demand from BSD and receive TEST-local IDs.
- Coppa Italia/UCL/UEL/UECL fixtures and Match Center data are loaded directly from BSD.
- All TEST user/profile/prediction writes land in `lcnwccnkkxaosxnfvjvr` only.

## Required TEST-only secrets
These are configured outside Git and must never be committed or pasted into chat:
- `TELEGRAM_BOT_TOKEN`
- `BSD_API_KEY`

Until those secrets are configured, unauthenticated GET health may work, but authenticated Telegram/API smoke is intentionally blocked.

## Deployment status
- [x] TEST Supabase restored and `ACTIVE_HEALTHY`
- [x] Minimal schema migration applied
- [x] User-generated tables verified empty before smoke
- [x] `ciao-v23-api` deployed as the only v23 Edge Function
- [ ] TEST-only Telegram/BSD secrets configured
- [ ] Authenticated API smoke passed
- [ ] Cloudflare TEST Worker created
- [ ] Telegram `🧪 Ciao v23 TEST` button connected
