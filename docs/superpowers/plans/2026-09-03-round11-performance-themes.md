# Round 11 Performance + Tournament Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove residual glow, make Predictions/Ranking/Tables inherit each tournament's premium Match background, gate UEFA prediction rounds server-side, and substantially reduce loading latency/layout shift in Predictions and Ranking.

**Architecture:** Keep the current v23.3 modular patch architecture. Add one focused Round 11 runtime layer for visual theming/layout stability, move UEFA round eligibility into prediction-service/match-resolution code so UI cannot bypass it, and add request/cache/dedup logic to Prediction and Ranking clients without changing production/main/reset behavior.

**Tech Stack:** JavaScript ESM, Node test runner, Cloudflare Workers/Durable Objects, existing v23.2/v23.3 frontend runtime modules.

**Spec:** Approved Round 11 requirements in the project conversation on 2026-09-03.

## Global Constraints

- Work only in TEST/develop flow; `main`, Production and reset are untouched.
- Preserve existing Serie A legacy match IDs/results and current crest enrichment.
- UEFA predictions: only the nearest eligible round may accept writes; later rounds remain locked until the previous round is fully finished and reconciled.
- Keep mobile horizontal table scrolling and bottom navigation behavior intact.
- Full test suite, build, Wrangler dry-run, TEST deployment and post-deploy probe must pass before merge.

---

### Task 1: Capture Round 11 regressions with RED tests

**Files:**
- Create: `cloudflare-test/test/v23-3-user-feedback-round11.test.mjs`

**Interfaces:**
- Consumes: existing `prediction-service.mjs`, `predictions-ui.mjs`, `ranking-ui.mjs`, `round10-regression-fixes.mjs`.
- Produces: executable contract for tournament theme surfaces, UEFA round locks, request dedup/cache and no-glow styling.

- [ ] **Step 1:** Add failing tests proving Match cards/tabs no longer use tournament-colored drop glow.
- [ ] **Step 2:** Add failing tests proving Predictions, Ranking and Tables receive the selected competition theme/background.
- [ ] **Step 3:** Add failing service tests proving UEFA future rounds reject writes with `prediction_round_locked` until prior round reconciliation is complete.
- [ ] **Step 4:** Add failing UI/client tests proving Predictions and Ranking cache data and deduplicate in-flight GET requests instead of refetching on every tab render.
- [ ] **Step 5:** Run the Round 11 test file and verify failures correspond to missing implementation, not test defects.

### Task 2: Remove residual glow and share tournament ambience

**Files:**
- Create: `cloudflare-test/src/v23.3/round11-performance-themes.mjs`
- Modify: `cloudflare-test/src/v23.3/index.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round11.test.mjs`

**Interfaces:**
- Produces: `round11ThemeForCompetition(key)`, runtime synchronization of tournament theme attributes for Matches/Predictions/Ranking/Tables.

- [ ] **Step 1:** Define one theme palette per `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl` using the same ambience already approved in Matches.
- [ ] **Step 2:** Override Match tab/card shadows so only neutral depth remains; remove colored lower glow/orbs underneath cards/tabs.
- [ ] **Step 3:** Apply tournament background variables to Predictions, Ranking and Tables surfaces using data attributes rather than fixed blue styling.
- [ ] **Step 4:** Keep bottom nav contrast/readability and existing table horizontal scroll rules unchanged.
- [ ] **Step 5:** Import the Round 11 layer from `index.mjs` and run focused tests.

### Task 3: Server-side UEFA round gate

**Files:**
- Modify: `cloudflare-test/src/v23.3/prediction-match-resolver.mjs`
- Modify: `cloudflare-test/src/v23.3/prediction-service.mjs`
- Modify: `cloudflare-test/src/v23.3/prediction-league-do.mjs` only if reconciliation metadata needs an explicit read endpoint.
- Test: `cloudflare-test/test/v23-3-user-feedback-round11.test.mjs`
- Test: existing prediction service/league tests as needed.

**Interfaces:**
- Produces: deterministic `roundState`/`roundLocked` metadata for UEFA matches; write path throws `prediction_round_locked` for future rounds.

- [ ] **Step 1:** Derive UEFA league-stage round numbers from canonical match rows.
- [ ] **Step 2:** Determine the first unfinished/unreconciled eligible UEFA round from canonical matches plus stored reconciliation state.
- [ ] **Step 3:** Return future UEFA matches as `round_locked` from `/predictions/available` while leaving past predictions visible.
- [ ] **Step 4:** Revalidate the same rule inside `save()` before Durable Object write, so direct API calls cannot bypass the UI.
- [ ] **Step 5:** Expose a stable error code `prediction_round_locked` and add tests for UCL/UEL/UECL progression.

### Task 4: Predictions performance + stable rendering

**Files:**
- Modify: `cloudflare-test/src/v23.3/prediction-client.mjs`
- Modify: `cloudflare-test/src/v23.3/predictions-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/home-integration.mjs` for non-blocking prefetch if safe.
- Test: `cloudflare-test/test/v23-3-user-feedback-round11.test.mjs`

**Interfaces:**
- Produces: GET request cache/in-flight dedup keyed by endpoint/query; cached page state remains rendered during refresh; score button updates avoid full-page rerender.

- [ ] **Step 1:** Add short-TTL memory cache and in-flight promise dedup to prediction GET calls (`available`, `rankingMe` if retained).
- [ ] **Step 2:** Keep cached matches visible on open and background-refresh them; never clear root content during refresh.
- [ ] **Step 3:** Reserve stable geometry for hero/tabs/filters/cards/logos/savebar to suppress layout shift.
- [ ] **Step 4:** Update score controls/state labels in-place for +/- interactions instead of rebuilding the whole Predictions page.
- [ ] **Step 5:** Render UEFA future-round tabs as visible locked tabs with lock icon/copy; only eligible round accepts score interaction.
- [ ] **Step 6:** Add optional idle Home prefetch that never blocks Home rendering.

### Task 5: Ranking performance + cache

**Files:**
- Modify: `cloudflare-test/src/v23.3/prediction-client.mjs`
- Modify: `cloudflare-test/src/v23.3/ranking-ui.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round11.test.mjs`

**Interfaces:**
- Produces: cached overall/per-competition ranking payloads, cached current-user summary, in-flight dedup and content-only rerender on filter changes.

- [ ] **Step 1:** Add ranking GET cache/in-flight dedup keyed by scope/competition.
- [ ] **Step 2:** Preserve prior ranking rows while background refresh runs; do not replace the whole screen with skeletons on each switch.
- [ ] **Step 3:** Render user hero and navigation once; replace only ranking list content when data changes.
- [ ] **Step 4:** Ensure `rankingMe`/overall requests are not duplicated by render observers or repeated tab clicks.
- [ ] **Step 5:** Add stable skeleton dimensions for true cold starts only.

### Task 6: Full verification and TEST deployment

**Files:**
- Update tests only if an existing test explicitly encodes superseded behavior.

**Interfaces:**
- Produces: merge-ready Round 11 branch with evidence.

- [ ] **Step 1:** Run focused Round 11 tests.
- [ ] **Step 2:** Run full `npm test`; require zero failures.
- [ ] **Step 3:** Run `npm run build`.
- [ ] **Step 4:** Run `npx wrangler deploy --dry-run`.
- [ ] **Step 5:** Open a TEST-only PR to `develop`, verify Cloudflare Git Integration deploys the head successfully.
- [ ] **Step 6:** Review diff for accidental `main`/Production/reset changes.
- [ ] **Step 7:** Merge only to `develop` after green CI and verify the post-merge TEST probe is green.
