# Premium Blue + Atomic Loading + Cleanup/Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Premium Blue the sole global application theme, remove destructive Prediction/Ranking loading states, polish Tables, and verify the canonical Match Center cutover on deployed TEST before any Production discussion.

**Architecture:** `app-theme.mjs` owns global shell/surface tokens. Competition styling outside Match Center becomes accent-only. Predictions and Ranking keep completed data while refreshing; first-load uses one coherent branded state. Legacy Round page-wide theme/loading ownership is retired only after equivalent useful geometry is moved into canonical component CSS.

**Tech Stack:** JavaScript ES modules, CSS injected by modules, Node `node:test`, Cloudflare build/Workers/Wrangler.

**Spec:** `docs/superpowers/specs/2026-09-04-canonical-match-center-redesign.md`

## Global Constraints

- Depends on Plans 1 and 2.
- Ciao, Web! global screens are Premium Blue for every selected tournament.
- Competition color is an accent outside Match Center.
- Match Center keeps five full tournament themes.
- Ready content must not be destructively cleared during refresh.
- Production/main remains untouched.

---

## File structure

- Modify `cloudflare-test/src/v23.3/app-theme.mjs`: canonical global/surface/accent tokens.
- Modify `cloudflare-test/src/v23.3/predictions-ui.mjs`: stale-while-revalidate state and canonical Premium Blue component classes.
- Modify `cloudflare-test/src/v23.3/ranking-ui.mjs`: stale-while-revalidate state and one first-load surface.
- Modify `cloudflare-test/src/v23.3/tables-ui.mjs`: larger crests and premium qualification markers.
- Modify/retire `cloudflare-test/src/v23.3/round11-performance-themes.mjs`: no page-wide competition backgrounds.
- Modify `cloudflare-test/src/v23.3/boot-gate.mjs` only if required to wait for actual initial-route readiness.
- Modify `cloudflare-test/src/v23.3/index.mjs`: only canonical retained theme/loading modules imported.
- Add `cloudflare-test/scripts/probe-round39-deployment.mjs` and workflow invocation.

### Task 1: Canonical global Premium Blue ownership

**Files:**
- Modify: `cloudflare-test/src/v23.3/app-theme.mjs`
- Modify: `cloudflare-test/src/v23.3/round11-performance-themes.mjs`
- Test: `cloudflare-test/test/v23-3-round39-premium-blue.test.mjs`

**Interfaces:**
- `APP_THEME_TOKENS` remains global source of truth.
- Add `competitionAccentFor(key)` or equivalent accent-only mapping consumed by Predictions/Ranking/Tables.

- [ ] **Step 1: Write RED test** asserting that Predictions and Ranking page backgrounds resolve from `--cw-app-bg`/`--cw-app-bg-deep` independent of `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`, and that Round 11 no longer contains page-wide `.content:has(...theme...)` background ownership.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Move competition identity to accent tokens only** and delete old page-wide tournament background rules. Preserve useful fixed geometry rules only if they still have no competing ownership.
- [ ] **Step 4: Run GREEN**.
- [ ] **Step 5: Commit**: `git commit -m "refactor: make premium blue the global theme owner"`.

### Task 2: Predictions stale-while-revalidate

**Files:**
- Modify: `cloudflare-test/src/v23.3/predictions-ui.mjs`
- Test: `cloudflare-test/test/v23-3-round39-predictions-loading.test.mjs`

**Interfaces:**
- UI state distinguishes `initialLoading` from `refreshing` while retaining `currentData`.

- [ ] **Step 1: Write RED test**: render ready Serie A predictions, switch to UEL, hold the UEL promise unresolved, assert existing ready cards remain in output/state and only a compact refreshing indicator changes; resolve UEL and assert one atomic replacement.
- [ ] **Step 2: Write RED first-load test** asserting no multi-card skeleton list is rendered when there is no previous data; instead one branded loading surface is produced.
- [ ] **Step 3: Run RED**.
- [ ] **Step 4: Implement SWR state** with request-generation protection so rapid competition switches cannot apply stale results.
- [ ] **Step 5: Run GREEN**.
- [ ] **Step 6: Commit**: `git commit -m "feat: make predictions refresh atomically"`.

### Task 3: Ranking stale-while-revalidate and no loading jank

**Files:**
- Modify: `cloudflare-test/src/v23.3/ranking-ui.mjs`
- Test: `cloudflare-test/test/v23-3-round39-ranking-loading.test.mjs`

**Interfaces:**
- Same state semantics as Predictions: ready data persists during refresh.

- [ ] **Step 1: Write RED test**: render Overall ranking, switch to UEL with pending request, assert existing leaderboard remains visible and no large placeholder rows replace it.
- [ ] **Step 2: Write RED first-load test** for one coherent branded loading card/surface.
- [ ] **Step 3: Run RED**.
- [ ] **Step 4: Implement atomic refresh** without MutationObserver-driven networking.
- [ ] **Step 5: Run GREEN** and include existing favorite-club/profile regression tests.
- [ ] **Step 6: Commit**: `git commit -m "feat: make ranking refresh atomically"`.

### Task 4: Tables premium qualification treatment

**Files:**
- Modify: `cloudflare-test/src/v23.3/tables-ui.mjs`
- Test: `cloudflare-test/test/v23-3-round39-tables-premium.test.mjs`

**Interfaces:**
- Keep compact columns `# / Команда / И / РМ / О`.

- [ ] **Step 1: Write RED structural/CSS test** requiring team crest target size 36–40px and qualification classes such as `cw233-zone--ucl`, `cw233-zone--uel`, `cw233-zone--uecl`, `cw233-zone--relegation` to apply both a restrained row tint and position marker treatment, not only `border-left`.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement premium zone styling**: subtle full-row tint + compact illuminated position marker; retain high contrast and compact geometry.
- [ ] **Step 4: Run GREEN**.
- [ ] **Step 5: Commit**: `git commit -m "style: polish premium standings zones"`.

### Task 5: Boot gate waits for real initial-route readiness

**Files:**
- Modify: `cloudflare-test/src/v23.3/boot-gate.mjs` only if current contract is insufficient.
- Modify relevant initial route module to emit a route-ready signal if needed.
- Test: `cloudflare-test/test/v23-3-round39-initial-route-ready.test.mjs`

**Interfaces:**
- Gate opens on actual healthy initial route readiness; timeout/error fallback still prevents permanent blank screen.

- [ ] **Step 1: Write RED test** that `ciao-v233-ready` alone does not expose an incomplete route if Home/initial data is still pending; gate releases after explicit route-ready state, with bounded fallback on failure.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement minimal readiness handshake** without waiting for every non-visible subsystem.
- [ ] **Step 4: Run GREEN**.
- [ ] **Step 5: Commit**: `git commit -m "fix: reveal app only when initial route is ready"`.

### Task 6: Legacy theme/loading cleanup

**Files:**
- Modify: `cloudflare-test/src/v23.3/index.mjs`
- Modify old Round theme/loading modules only to remove imports/ownership made obsolete by Tasks 1–5.
- Update genuinely obsolete tests.
- Test: `cloudflare-test/test/v23-3-round39-runtime-ownership.test.mjs`

**Interfaces:**
- Runtime ownership list is explicit and auditable.

- [ ] **Step 1: Write RED ownership test** asserting no imported module owns page-wide competition backgrounds, Match Center lifecycle, or DOM-driven network refresh.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Remove obsolete imports and duplicate ownership code**, preserving unrelated fixes still required by other screens.
- [ ] **Step 4: Run all focused Round 39 tests GREEN**.
- [ ] **Step 5: Run full suite**: `cd cloudflare-test && npm test`.
- [ ] **Step 6: Commit**: `git commit -m "refactor: retire obsolete runtime ownership layers"`.

### Task 7: Build, deployment probes and TEST gate

**Files:**
- Create: `cloudflare-test/scripts/probe-round39-deployment.mjs`
- Modify: `.github/workflows/ciao-test-check.yml`
- Modify probe tests if the repository validates script content.

**Interfaces:**
- Probe exits non-zero if deployed TEST violates canonical ownership/contract markers.

- [ ] **Step 1: Write RED probe test** for required assertions: canonical API reachable; canonical Match Center marker present; no legacy UI event/owner marker in built runtime; Premium Blue global owner marker present; five Match Center themes present.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement deployment probe and wire it into TEST workflow** after deployment.
- [ ] **Step 4: Run local verification commands**:

```bash
cd cloudflare-test
npm test
npm run build
npx wrangler deploy --dry-run
npm run inspect:api-contract
npm run probe:predictions
npm run probe:reset
```

Expected: all exit 0.
- [ ] **Step 5: Open PR to `develop` and wait for full CI GREEN**.
- [ ] **Step 6: Review changed files for accidental `main`/Production modifications and legacy fallback reintroduction**.
- [ ] **Step 7: Merge only after GREEN and then verify post-merge deploy workflow/probe**.

## Manual acceptance after deployed TEST

GREEN automation is not completion. Manually verify on real TEST:

- Serie A Match Center: unique premium-blue tournament design, no parent header/frame, Back works.
- Coppa Italia: distinct dark Italian theme, no inherited blue wrapper, Back works.
- UCL: distinct midnight/violet theme.
- UEL: distinct graphite/orange theme.
- UECL: distinct green-black theme.
- Open matches from Home, Matches and Predictions and verify exact restoration.
- Predictions and Ranking remain Premium Blue for every tournament filter and do not flash malformed skeleton screens.
- Tables retain compact five-column layout, larger crests and premium qualification markers.

Production remains untouched until the user explicitly approves the deployed TEST result.