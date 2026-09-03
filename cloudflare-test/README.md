# Ciao, Web! — permanent TEST Worker

This directory is the GitHub-managed TEST frontend for Ciao, Web!.

## Cloudflare Workers Builds settings

- Repository: `godievda-pixel/ciao-pronostici`
- Root directory: `cloudflare-test`
- Branch: `develop`
- Build command: `npm test && npm run build`
- Deploy command: `npm run deploy`
- Worker name: `ciao-web-app-test`

After the first successful deploy, Telegram TEST should permanently point to:

`https://ciao-web-app-test.ciao-web.workers.dev/`

Production `ciao-web-app` is intentionally not managed by this directory yet.

Build trigger: 2026-09-01T14:37+03:00

## v23.2 migration checkpoint

The v23.2 competition model and Tournament Engine are loaded in TEST as inert ES modules under `/v23.2/`. v23.1 remains the visible UI until the next migration milestone explicitly switches a screen.

## v23.3 prediction backend — TEST rollout

v23.3 predictions use the TEST-only SQLite Durable Object `PredictionLeague`. The active prediction season is `2026-27`. Production prediction storage and Production reset are not enabled by this rollout.

Run the deterministic gate before every TEST deployment:

```bash
cd cloudflare-test
npm install --no-audit --no-fund
npm test
npm run build
npx wrangler deploy --dry-run
npm run inspect:api-contract
npm run probe:predictions
npm run probe:reset
node scripts/probe-bsd-provider.mjs
```

The static prediction contract is expected to remain `REQUIRES_AUTHENTICATED_SMOKE` until a real authenticated TEST smoke is performed. That is intentional: ordinary CI must not write user prediction rows.

After the deterministic gate is green, deploy only the TEST Worker and verify it:

```bash
cd cloudflare-test
npx wrangler deploy
node scripts/probe-test-deployment.mjs
```

The deployed `/healthz` must report `prediction_backend: durable-object-sqlite`, `prediction_environment: test`, `prediction_season: 2026-27`, and `prediction_do_configured: true`. The deployment probe also requires an unauthenticated request to `/api/v23.3/predictions` to return `401 telegram_auth_required`.

### Authenticated TEST prediction smoke

Choose two **real, currently open** active-season match IDs from the deployed TEST `/api/v23.3/predictions/available?competition=all` response. The two fixtures must be from different competitions. Do not invent match IDs.

Provide the Telegram init data only in the authorized local/runtime environment; never commit it, paste it into workflow YAML, or store it in an artifact:

```bash
TEST_TELEGRAM_INIT_DATA='(authorized TEST Telegram init data)' \
TEST_PREDICTION_MATCH_A='ucl:<real-test-match-id>' \
TEST_PREDICTION_MATCH_B='serie_a:<real-test-match-id>' \
npm run smoke:predictions

PREDICTION_AUTH_SMOKE_INPUT=artifacts/v23-3-prediction-authenticated-smoke.json \
npm run probe:predictions
```

The authenticated smoke verifies a persistence round-trip with the same `prediction_id`, cross-competition isolation, a real server-side `409 prediction_locked` case, scoring parity, and that every HTTP request stayed on the TEST origin. The smoke does **not** call reset.

### TEST reset

Reset is a separate explicit cleanup action. It is never part of normal deploy, CI, or authenticated smoke. It is guarded by the exact TEST host, `CIAO_ENV=test`, active season/object identity, and the server-side `TEST_RESET_TOKEN` Wrangler secret.

Example explicit TEST-only call:

```bash
curl -X POST \
  -H "x-ciao-test-reset-token: $TEST_RESET_TOKEN" \
  https://ciao-web-app-test.ciao-web.workers.dev/api/v23.3/test/predictions/reset
```

A successful TEST reset must report all five stages as `ok: true`: `predictions`, `points`, `ranking`, `profiles`, and `caches`. Immediately re-run `/healthz`, the unauthenticated prediction guard, and one authenticated persistence round-trip after cleanup.

Never point this reset command at Production. The v23.3 reset contract keeps `canExecuteProductionReset: false` even after TEST reset verification.
