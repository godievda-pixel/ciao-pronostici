# Ciao, Web! v23 isolated TEST environment

## Goal

Create a fully isolated Telegram/Cloudflare/Supabase test environment for v23 while Production remains on stable v22.5.

TEST must be disposable and must never be required for Production to function.

## Environment split

### Production
- Branch: `main`
- Worker: `ciao-web-app`
- Supabase project: `dkefzepiiudehhzbbrjn`
- Release: stable v22.5
- Production remains untouched while v23 is tested.

### v23 TEST
- Branch: `v23-test`
- Initial source commit: `f4aeca50c5449ea350ec5f3fadf788ca4a039c5f`
- Worker: `ciao-web-v23-test`
- Supabase project: `lcnwccnkkxaosxnfvjvr` (`Ciao, Web!`)
- Canonical backend Edge Function: `ciao-v23-api`
- Public Worker URL: `https://ciao-web-v23-test.ciao-web.workers.dev/`
- Telegram button: `🧪 Ciao v23 TEST`

## Why the backend changes

The v23 frontend sends the actions `modular_matches`, `modular_standings`, `modular_favorite`, `modular_predictions`, `modular_save_predictions`, `modular_ranking`, and `modular_match_center`.

The Edge Function version that had actually been deployed to Production did not expose that complete contract: it proxied through `ciao-core-api-fast-v5` -> `ciao-core-api-fast-v4` -> `ciao-core-api-fast`, where the modular actions ended as `Unknown action`. The repository candidate already contains modular domain/provider/runtime modules, but its entrypoint still depends on that legacy chain for authentication, Serie A writes/standings, and Serie A Match Center.

TEST therefore does not copy the old function chain. It introduces one canonical `ciao-v23-api` which implements the v23 contract directly.

## Unified `ciao-v23-api`

The TEST backend has one public API entrypoint. It reuses/refactors the repository's existing modular action router, domain helpers, and BSD provider rather than introducing a second frontend contract.

Responsibilities:
- validate Telegram Mini App `initData` using `TELEGRAM_BOT_TOKEN`;
- enforce the existing `@CiaoCalcio` subscription gate;
- create/update the TEST user in `cp_users` using the stable Telegram ID while synchronizing mutable Telegram profile fields;
- serve Serie A matches from TEST reference tables;
- serve Coppa Italia/UCL/UEL/UECL data from BSD Football API v2;
- serve standings for all supported table competitions;
- load/save TEST predictions with the existing 15-minute deadline and `5 / 3 / 2 / 0` scoring contract;
- combine Serie A and external-competition points for the v23 ranking scopes;
- serve Match Center for all five competitions, using BSD directly instead of a separate old function chain;
- return the exact `{ ok:true, data:<payload> }` envelope expected by the v23 client.

No request from `ciao-v23-api` may call `ciao-core-api-fast-v5`, `ciao-core-api-fast-v4`, `ciao-core-api-fast`, or Production Supabase.

## TEST database

The TEST project starts with no Production user rows. Create only the minimum v23 schema:
- `cp_users` — TEST-generated users;
- `cp_teams` — non-user Serie A reference data;
- `cp_rounds` — non-user Serie A reference data;
- `cp_matches` — non-user Serie A schedule/result reference data including BSD event mapping where available;
- `cp_predictions` — TEST-generated Serie A predictions;
- `cp_competition_predictions` — TEST-generated Coppa/UCL/UEL/UECL predictions;
- `cp_scoring_rules` — static scoring reference row.

Reference data may be copied from Production only for teams, rounds, matches, and scoring rules. Do not copy Production users, predictions, favorites, rankings, notification state, telemetry, tokens, private settings, or auth-linked rows.

TEST writes must land only in `lcnwccnkkxaosxnfvjvr`.

## Secrets

Secrets are configured only in the TEST Supabase project and are never committed to Git:
- `TELEGRAM_BOT_TOKEN`
- `BSD_API_KEY`

Built-in Supabase project URL/service credentials remain project-scoped. Secret values are never pasted into repository files or release artifacts.

## Frontend and Cloudflare isolation

On `v23-test`:
- `cloudflare-production/wrangler.jsonc` targets only `ciao-web-v23-test`;
- the v23 API contract points only to `https://lcnwccnkkxaosxnfvjvr.supabase.co/functions/v1/ciao-v23-api`;
- the build may still use the known v22.5 HTML as the visual/legacy source, but before publication every occurrence of the Production Supabase origin must be rewritten to the TEST origin;
- a build gate must fail if the built `dist` contains the Production project ref `dkefzepiiudehhzbbrjn`.

This is necessary because older legacy HTML can contain hard-coded Supabase endpoints even when the new modular client is correctly configured.

Cloudflare Workers Builds settings:
- Repository: `godievda-pixel/ciao-pronostici`
- Branch: `v23-test`
- Root directory: `cloudflare-production`
- Build command: `npm test && npm run build`
- Deploy command: `npm run deploy`
- Worker name: `ciao-web-v23-test`

The first Worker connection is a one-time manual Cloudflare Dashboard step because no Cloudflare management credential is available in this chat.

## Telegram button

After the new Worker URL is verified, replace the obsolete TEST entry with:

`🧪 Ciao v23 TEST`

It targets only `https://ciao-web-v23-test.ciao-web.workers.dev/`. The normal `⚽ Открыть Ciao, Web!` button remains unchanged.

## Verification gate

Before TEST is handed to the user:
1. TEST Supabase is `ACTIVE_HEALTHY`.
2. Minimum schema exists and TEST user/prediction tables start without Production user data.
3. `ciao-v23-api` is deployed and exposes the complete seven-action modular contract.
4. Authenticated smoke proves a TEST user can be created only in TEST.
5. v23 API contract and Wrangler identity point only to TEST.
6. `npm test` passes on `v23-test`.
7. `npm run build` passes.
8. `npm run probe:build` and applicable API smoke pass.
9. `npx wrangler deploy --dry-run` passes and identifies `ciao-web-v23-test`.
10. `dist` contains no `dkefzepiiudehhzbbrjn` reference.
11. Cloudflare TEST deployment succeeds and serves the v23 artifact.
12. Production `main`, `ciao-web-app`, and Production Supabase remain unchanged.

The user then performs the real Telegram smoke on `🧪 Ciao v23 TEST`: Главная, Прогнозы, Рейтинг, Матчи, Таблицы, Профиль, all five Match Center competitions, visible Back, Telegram/system Back, state restoration, TEST prediction save, profile sync, and favorite club.

Any defects are fixed only on `v23-test`.

## Promotion rule

Automated tests alone never authorize Production publication. Promotion requires green automated verification, successful real Telegram smoke by the user, and explicit user approval.

At promotion time Production receives a clean tested v23 release. No TEST code is merged to `main` before that approval.

## Rollback rule

Production rollback remains independent of TEST. The `v23-test` history is preserved even if a future Production v23 release is rolled back.