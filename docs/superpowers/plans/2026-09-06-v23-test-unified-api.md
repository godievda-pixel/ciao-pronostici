# v23 TEST Unified API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `v23-test` a fully isolated, testable release candidate using one TEST Supabase API and one TEST Cloudflare Worker, with zero Production Supabase runtime references.

**Architecture:** Reuse the existing modular action/domain/BSD-provider code from the v23 candidate, but expose it through a new `ciao-v23-api` that performs Telegram auth, TEST user sync, Serie A prediction writes/standings, and Match Center locally instead of proxying the old v6→v5→v4 chain. Create only the minimal TEST schema and reference seed needed by v23. Rewrite legacy HTML Production Supabase references during TEST build and fail the build if any remain.

**Tech Stack:** Supabase Postgres + Edge Functions, Node.js 22, Cloudflare Workers/Wrangler 4, Telegram Mini App, BSD Football API v2.

**Spec:** `docs/superpowers/specs/2026-09-06-v23-test-environment-design.md`

## Global Constraints
- Never modify `main`, `ciao-web-app`, or Production Supabase during this plan.
- TEST branch: `v23-test`.
- TEST Supabase: `lcnwccnkkxaosxnfvjvr`.
- TEST Worker: `ciao-web-v23-test`.
- Canonical TEST backend: `ciao-v23-api`.
- No Production user-generated rows are copied to TEST.
- Prediction scoring remains `5 / 3 / 2 / 0`; deadline remains 15 minutes.
- Built TEST artifact must contain zero occurrences of `dkefzepiiudehhzbbrjn`.

---

### Task 1: Lock the new contract with failing tests
**Files:**
- Create: `cloudflare-production/test/v23-test-environment.test.mjs`
- Create: `cloudflare-production/test/v23-api-source.test.mjs`

- [ ] Add assertions that `CURRENT_API.core` ends in `/ciao-v23-api`, origin is TEST Supabase, Wrangler name is `ciao-web-v23-test`, and build helpers remove Production Supabase refs.
- [ ] Add source-contract assertions that `supabase/functions/ciao-v23-api/index.ts` exists, exposes all seven modular actions, and contains no legacy core proxy URLs.
- [ ] Run CI/checks and confirm RED because the new API/config does not exist yet.

### Task 2: Build the unified TEST backend
**Files:**
- Create: `supabase/functions/ciao-v23-api/index.ts`
- Create/copy and adapt: `modular-actions.mjs`, `modular-domain.mjs`, `bsd-modular-provider.mjs`, `modular-runtime.mjs`

- [ ] Reuse the existing seven-action router/domain behavior.
- [ ] Implement Telegram `initData` validation and `@CiaoCalcio` membership check in `index.ts`.
- [ ] Create/update TEST `cp_users` from Telegram identity without changing Telegram ID.
- [ ] Replace `legacyPost` with local `serie_a_table` and `save_predictions` implementations.
- [ ] Replace `matchCenterPost` with direct BSD Match Center loading using `cp_matches.bsd_event_id`.
- [ ] Allow CORS from `https://ciao-web-v23-test.ciao-web.workers.dev`.
- [ ] Run targeted tests until GREEN.

### Task 3: Create minimal TEST schema and safe reference seed
**Files:**
- Create: `supabase-v23-test/migrations/20260906_v23_unified_test.sql`
- Create: `docs/superpowers/artifacts/v23-test-backend-manifest.md`

- [ ] Create `cp_users`, `cp_teams`, `cp_rounds`, `cp_matches`, `cp_predictions`, `cp_competition_predictions`, `cp_scoring_rules` with required keys/constraints/indexes.
- [ ] Copy only non-user reference rows for teams, rounds, matches, and scoring rules from Production.
- [ ] Apply migration to TEST with `apply_migration`.
- [ ] Verify `cp_users`, `cp_predictions`, `cp_competition_predictions` counts are zero before Telegram smoke.
- [ ] Deploy `ciao-v23-api` to TEST; do not deploy the old core chain.

### Task 4: Isolate the TEST frontend and build
**Files:**
- Modify: `cloudflare-production/src/modular/data/api-contract.mjs`
- Modify: `cloudflare-production/wrangler.jsonc`
- Modify: `cloudflare-production/scripts/build.mjs`

- [ ] Point `CURRENT_API` to TEST Supabase and `ciao-v23-api`.
- [ ] Rename Worker target to `ciao-web-v23-test` on `v23-test` only.
- [ ] Rewrite Production Supabase origin to TEST origin in the fetched legacy HTML before modular injection.
- [ ] Throw during build if the result still contains `dkefzepiiudehhzbbrjn`.
- [ ] Run full tests, build, build probe, and Wrangler dry-run.

### Task 5: Manual secrets/Cloudflare gate and Telegram acceptance
- [ ] Configure TEST-only `TELEGRAM_BOT_TOKEN` and `BSD_API_KEY` in Supabase Dashboard; never send values through chat/Git.
- [ ] Verify `ciao-v23-api` health and authenticated TEST write isolation.
- [ ] Create the Cloudflare Worker from branch `v23-test` with root `cloudflare-production`.
- [ ] Replace old TEST Telegram entry with `🧪 Ciao v23 TEST` pointing to the new Worker URL.
- [ ] User performs full Telegram smoke. Fix defects only on `v23-test`.
- [ ] Stop before any Production promotion until explicit user approval.
