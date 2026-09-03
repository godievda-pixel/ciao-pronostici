# Ciao, Web! v23.3 Round 15 Final TEST Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining TEST theme/CLS regressions, make Predictions fully tournament-themed, and make the TEST prediction reset explicitly clear profile participant state before Production migration.

**Architecture:** Fix ownership at the source: Tables render their theme attributes directly from competition config, Predictions keep one persistent page shell and update only slots, Ranking uses its own stable shell without the legacy full-screen loading overlay, and the existing reset contract reports profile/participant clearing explicitly. No Production switch is part of this round.

**Tech Stack:** Browser ES modules, Node.js `node:test`, Cloudflare Workers + SQLite Durable Objects, GitHub Actions.

**Spec:** User-approved Round 15 requirements from the 2026-09-03 TEST review.

## Global Constraints
- Target `develop` and `ciao-web-app-test` only.
- Do not switch Production in Round 15.
- Preserve prediction scoring, locks, match feeds, and existing rankings semantics.
- Use RED → GREEN tests before each production-code behavior change.
- Keep TEST reset guarded by `TEST_RESET_TOKEN`; do not weaken reset authorization.

---

### Task 1: Make Tables theme state authoritative

**Files:**
- Modify: `cloudflare-test/src/v23.3/tables-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/round11-performance-themes.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round15.test.mjs`

- [ ] Add a failing test proving `renderTablesHub({selectedCompetition:'serie_a'})` carries `serie-a` theme even after a previous `uecl` render.
- [ ] Make `renderTablesHub` emit both `data-cw233-theme` and `data-cw233-round11-theme` from `getCompetitionConfig(selectedCompetition).theme`.
- [ ] Make Round 11 derive Tables theme from `data-cw233-tables-selected`/competition config mapping rather than copying stale decorator state.
- [ ] Run Round 15 test and Tables regressions.

### Task 2: Remove Predictions full-page rerenders and finish tournament themes

**Files:**
- Modify: `cloudflare-test/src/v23.3/predictions-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/round11-performance-themes.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round15.test.mjs`

- [ ] Add failing source/behavior tests proving Predictions owns one persistent shell instead of assigning `main.innerHTML` on each render.
- [ ] Add `ensurePredictionShell`, stable hero/tabs/filters/body/save slots, and patch only changed slot HTML/attributes.
- [ ] Preserve filter and main scroll naturally by keeping those nodes alive.
- [ ] Start prediction prefetch immediately when Telegram auth is already present; keep existing retries for late auth.
- [ ] Theme make/mine tabs, round tabs, +/- score buttons, cards and Save with the active tournament variables.
- [ ] Run prediction/Round 11/Round 13 tests.

### Task 3: Remove Ranking overlay jump and reduce redundant DOM writes

**Files:**
- Modify: `cloudflare-test/src/v23.3/ranking-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/round13-mobile-regressions.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round15.test.mjs`

- [ ] Add a failing test proving bottom-nav Ranking no longer shows the Round 13 full-screen overlay.
- [ ] Stop creating/showing that overlay; keep Ranking's native reserved skeleton inside its persistent shell.
- [ ] Update hero/content HTML only when markup actually changed.
- [ ] Prefetch overall ranking earlier and prefetch competition scopes after the first idle turn.
- [ ] Run ranking/Round 13 tests.

### Task 4: Make TEST reset explicitly clear profiles

**Files:**
- Modify: `cloudflare-test/src/v23.3/prediction-sql.mjs`
- Modify: `cloudflare-test/src/v23.3/prediction-league-do.mjs`
- Modify: reset contract tests/probe if required.
- Test: `cloudflare-test/test/v23-3-user-feedback-round15.test.mjs`

- [ ] Add a failing test proving `resetPredictionDomain` reports affected participant/profile rows.
- [ ] Return `participants` from SQL reset and expose a `profiles` stage from the Durable Object reset result.
- [ ] Preserve existing predictions/points/ranking/caches stages and TEST-only authorization.
- [ ] Run reset contract tests.

### Task 5: Full TEST verification

- [ ] Run full `npm test`.
- [ ] Run TEST build and Wrangler dry-run.
- [ ] Open PR to `develop` and review diff.
- [ ] Merge only after green CI.
- [ ] Verify Cloudflare TEST deployment/live probes after merge.
- [ ] Execute the existing privileged TEST reset only if `TEST_RESET_TOKEN` is available in an authorized runtime; otherwise leave the endpoint secure and report the single privileged action still required.
- [ ] Do not change Production/main in Round 15.
