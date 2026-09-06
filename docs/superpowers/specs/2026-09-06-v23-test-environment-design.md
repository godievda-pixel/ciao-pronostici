# Ciao, Web! v23 isolated TEST environment

## Goal

Create a brand-new isolated Telegram/Cloudflare/Supabase test environment for the current v23 candidate while keeping Production on the stable v22.5 release.

The test environment must be disposable and must never be required for Production to function.

## Environment split

### Production
- Branch: `main`
- Worker: existing `ciao-web-app`
- Supabase project: `dkefzepiiudehhzbbrjn`
- Release: stable v22.5
- Production remains untouched while v23 is tested.

### v23 TEST
- Branch: `v23-test`
- Worker: `ciao-web-v23-test`
- Supabase project: `lcnwccnkkxaosxnfvjvr` (`Ciao, Web!`)
- Public URL: `https://ciao-web-v23-test.ciao-web.workers.dev/`
- Telegram button label: `🧪 Ciao v23 TEST`
- The old TEST Worker/button is not reused.

## Source of v23

The initial `v23-test` branch is created from the current v23 candidate at `feature/main-modular-app-rework` / commit `f4aeca50c5449ea350ec5f3fadf788ca4a039c5f`.

This preserves the exact candidate that was tested in Production before rollback. Subsequent fixes are made only on `v23-test` until the user approves the complete Telegram smoke.

## Cloudflare layout

For the first TEST milestone, reuse the existing `cloudflare-production` application directory from the v23 candidate, but change its test-branch Wrangler identity from `ciao-web-app` to `ciao-web-v23-test`.

This keeps the TEST artifact identical to the v23 candidate except for the Worker identity and prevents accidental writes to Production Worker configuration.

Cloudflare Workers Builds settings:
- Repository: `godievda-pixel/ciao-pronostici`
- Branch: `v23-test`
- Root directory: `cloudflare-production`
- Build command: `npm test && npm run build`
- Deploy command: `npm run deploy`
- Worker name: `ciao-web-v23-test`

The first Worker connection may require one manual Cloudflare Dashboard step because no Cloudflare management credential is currently available to ChatGPT.

## Supabase TEST backend

Use the existing non-production Supabase project `lcnwccnkkxaosxnfvjvr` as the dedicated v23 TEST backend.

Rules:
- Production Supabase `dkefzepiiudehhzbbrjn` is never used for TEST writes.
- TEST receives the database schema and only the Edge Functions required by v23.
- Production user-generated data is not copied into TEST: no real predictions, user profiles, ranking rows tied to real users, private tokens, or notification state.
- Reference/static data may be recreated or seeded when required for functional testing.
- TEST Telegram users may create isolated TEST profiles, predictions, favorite-club settings, and ranking state inside `lcnwccnkkxaosxnfvjvr`.
- Secrets and provider credentials are configured separately in TEST; they are never copied into Git.
- Every v23 client API URL must point to `lcnwccnkkxaosxnfvjvr` before the TEST button is enabled.

The initial migration should prefer the smallest schema/function subset required by current v23 rather than cloning unrelated Supabase functions from the production project.

## Telegram button

After the new Worker has a live `workers.dev` URL, replace the old TEST entry with a new button:

`🧪 Ciao v23 TEST`

The button must target only the new `ciao-web-v23-test` URL. The normal `⚽ Открыть Ciao, Web!` button continues to point to Production v22.5.

The repository currently does not contain the Telegram button definition, so updating the button is treated as a separate one-time Telegram configuration step after the Worker URL is verified.

## Verification gate

Before the new TEST URL is given to the user:
1. Supabase TEST project is `ACTIVE_HEALTHY`.
2. Required v23 TEST schema/functions are deployed to `lcnwccnkkxaosxnfvjvr`.
3. v23 API contract points only to TEST Supabase.
4. `npm test` passes on `v23-test`.
5. `npm run build` passes on `v23-test`.
6. `npx wrangler deploy --dry-run` passes.
7. Cloudflare TEST deployment succeeds.
8. TEST URL serves the v23 artifact.
9. Write smoke proves test predictions/profile changes stay in TEST Supabase.
10. Production `main`, `ciao-web-app`, and Supabase production remain unchanged.

After deployment, the user performs the real Telegram smoke on `🧪 Ciao v23 TEST`.

Required manual areas:
- Главная
- Прогнозы
- Рейтинг
- Матчи
- Таблицы
- Профиль
- Match Center for all supported competitions
- visible Back
- Telegram/system Back
- state restoration after Back
- save prediction in TEST
- Telegram profile sync in TEST

Any defects found during this smoke are fixed only on `v23-test`.

## Promotion rule

No v23 code is promoted to `main` merely because automated tests pass.

Promotion requires:
1. automated verification green on `v23-test`;
2. successful real Telegram smoke by the user;
3. explicit user approval to publish v23 to Production.

At promotion time, Production receives a clean v23 release rather than another unverified overlay change.

## Rollback rule

Production rollback remains independent of TEST. If a future Production v23 release fails, `main` can be returned to the last known-good Production tree without deleting the `v23-test` history.
