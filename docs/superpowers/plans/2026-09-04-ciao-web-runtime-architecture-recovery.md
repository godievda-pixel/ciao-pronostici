# Ciao, Web! Runtime Architecture Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace overlapping post-render patches with single runtime owners for Match Center lifecycle, ranking identity, shared premium-blue theming, direct compact standings, and first-paint readiness.

**Architecture:** Keep existing football-content renderers, but move lifecycle/data ownership to focused modules. Match Center gets one source-snapshot/restore owner; ranking renders identity/club assets in its first pass; tables render compact columns directly; app-wide premium blue becomes the base palette; Home is hidden behind a bounded readiness gate until usable.

**Tech Stack:** JavaScript ES modules, DOM APIs, Node `node:test`, Cloudflare Workers/Static Assets, Wrangler.

**Spec:** `docs/superpowers/specs/2026-09-04-ciao-web-runtime-architecture-recovery-design.md`

## Global Constraints

- Work only on `test/round38-architecture-recovery`, then merge to `develop` after verification.
- Do not update `main` or Production.
- Preserve existing football-data renderers and prediction/scoring behavior.
- No global MutationObserver may trigger network fetches.
- Premium deep blue is the application base; tournament colors are accents only.
- Every task follows RED → minimal GREEN → regression verification.

---

### Task 1: Single Match Center lifecycle owner

**Files:**
- Create: `cloudflare-test/src/v23.3/match-center-lifecycle.mjs`
- Modify: `cloudflare-test/src/v23.3/index.mjs`
- Modify: `cloudflare-test/src/v23.3/round31-match-center-stability.mjs`
- Modify: `cloudflare-test/src/v23.3/round37-runtime.mjs`
- Test: `cloudflare-test/test/v23-3-round38-match-center-lifecycle.test.mjs`

**Interfaces:**
- Produces: `captureMatchSource(documentRef, target) -> MatchSource`, `installMatchCenterLifecycle(documentRef, rootRef) -> { restore, disconnect }`.
- `MatchSource` shape: `{ surface, competition, navTab, scrollTop, matchesOverlayScrollTop }`.
- Consumes existing open events: `ciao-v233-open-serie-a-match`, `ciao-v233-open-external-legacy-match`.

- [ ] **Step 1: Write failing lifecycle tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureMatchSource } from '../src/v23.3/match-center-lifecycle.mjs';

test('captures matches source without guessing from Match Center state', () => {
  const target = {
    closest(selector) {
      if (selector.includes('[data-cw232-match]')) return { closest:() => ({ dataset:{ cw232Competition:'serie_a' } }) };
      return null;
    },
  };
  const source = captureMatchSource({ querySelector:() => null }, target);
  assert.equal(source.surface, 'matches');
  assert.equal(source.competition, 'serie_a');
});

test('round37 no longer owns Match Center back or parent overlay lifecycle', async () => {
  const source = await import('../src/v23.3/round37-runtime.mjs?round38-lifecycle');
  assert.equal('dispatchMatchCenterBack' in source, false);
  assert.equal('restoreMatchSource' in source, false);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `cd cloudflare-test && node --test test/v23-3-round38-match-center-lifecycle.test.mjs`

Expected: FAIL because `match-center-lifecycle.mjs` does not exist and Round 37 still exports lifecycle functions.

- [ ] **Step 3: Implement lifecycle source capture and restoration**

Create a focused module that records source before open, suspends `#ciao-v232-matches-overlay`, sets one ownership class on `html`, and restores source on `.mc-back` / canonical close. Do not render match content in this module.

Core contract:

```js
export function captureMatchSource(documentRef, target) {
  const matches = target?.closest?.('[data-cw232-match]');
  const prediction = target?.closest?.('[data-cw233-pred-card],.cw233-prediction-page [data-cw233-match]');
  const club = target?.closest?.('[data-cw232-profile-match]');
  const surface = matches ? 'matches' : prediction ? 'predictions' : club ? 'club-profile' : 'home';
  return Object.freeze({
    surface,
    competition:String(matches?.closest?.('[data-cw232-competition]')?.dataset?.cw232Competition || prediction?.dataset?.cw233Competition || club?.dataset?.cw232Competition || ''),
    navTab:surface === 'matches' ? 'calendar' : surface === 'predictions' ? 'mine' : surface === 'club-profile' ? 'profile' : 'predict',
    scrollTop:Number(documentRef?.querySelector?.('.content')?.scrollTop) || 0,
    matchesOverlayScrollTop:Number(documentRef?.getElementById?.('ciao-v232-matches-overlay')?.scrollTop) || 0,
  });
}
```

- [ ] **Step 4: Remove competing lifecycle code from Round 31 and Round 37**

Round 31 keeps external snapshot-signature refresh de-duplication only. Round 37 keeps prediction-card theming only until later tasks remove standings post-processing. Delete its back event, source memory, parent overlay suppression, and Match Center ownership CSS.

- [ ] **Step 5: Run lifecycle tests**

Run: `cd cloudflare-test && node --test test/v23-3-round38-match-center-lifecycle.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-test/src/v23.3/match-center-lifecycle.mjs cloudflare-test/src/v23.3/index.mjs cloudflare-test/src/v23.3/round31-match-center-stability.mjs cloudflare-test/src/v23.3/round37-runtime.mjs cloudflare-test/test/v23-3-round38-match-center-lifecycle.test.mjs
git commit -m "fix: centralize match center lifecycle"
```

---

### Task 2: Ranking data-first identity and profile performance

**Files:**
- Modify: `cloudflare-test/src/v23.3/ranking-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/predictor-profile-ui.mjs`
- Test: `cloudflare-test/test/v23-3-round38-ranking.test.mjs`

**Interfaces:**
- Produces from ranking module: `favoriteTeamAssetUrl(team) -> string`, `predictorIdFromRankingRow(row) -> number`, complete row markup with `data-cw233-predictor-id`.
- Predictor profile consumes only `data-cw233-predictor-id` and fetches `public_predictor` for the clicked row.

- [ ] **Step 1: Write failing ranking tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { favoriteTeamAssetUrl, predictorIdFromRankingRow } from '../src/v23.3/ranking-ui.mjs';

test('favorite team supports Telegram custom emoji without hydration pass', () => {
  assert.match(favoriteTeamAssetUrl({ custom_emoji_id:'12345' }), /asset=emoji&id=12345/);
});

test('predictor id is available to initial ranking render', () => {
  assert.equal(predictorIdFromRankingRow({ user_id:'telegram:42' }), 42);
});

test('profile UI contains no whole-document ranking MutationObserver hydration', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../src/v23.3/predictor-profile-ui.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /hydrateRankingPredictors/);
  assert.doesNotMatch(source, /observer\.observe\?\.\(documentRef\.documentElement/);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `cd cloudflare-test && node --test test/v23-3-round38-ranking.test.mjs`

Expected: FAIL because ranking renderer does not yet export/own these helpers and profile UI still hydrates via global observer.

- [ ] **Step 3: Move favorite-team normalization into ranking render path**

Use direct crest URL first, then `custom_emoji_id` via `/api/ciao-core-api-fast-v4?asset=emoji&id=...`. Row markup must include the asset immediately and include `data-cw233-predictor-id` when user ID is available.

- [ ] **Step 4: Reduce predictor-profile module to modal behavior**

Delete `hydrateRankingPredictors`, `scheduleHydrate`, ranking client usage, and MutationObserver. Keep delegated click/keydown handlers for already-rendered row IDs and modal open/close/retry behavior.

- [ ] **Step 5: Run focused tests**

Run: `cd cloudflare-test && node --test test/v23-3-round38-ranking.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-test/src/v23.3/ranking-ui.mjs cloudflare-test/src/v23.3/predictor-profile-ui.mjs cloudflare-test/test/v23-3-round38-ranking.test.mjs
git commit -m "fix: render ranking identities without observer hydration"
```

---

### Task 3: Shared premium-blue application theme

**Files:**
- Create: `cloudflare-test/src/v23.3/app-theme.mjs`
- Modify: `cloudflare-test/src/v23.3/index.mjs`
- Modify: `cloudflare-test/src/v23.3/predictions-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/ranking-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/tables-ui.mjs`
- Test: `cloudflare-test/test/v23-3-round38-theme.test.mjs`

**Interfaces:**
- Produces: `APP_THEME_TOKENS`, `installAppTheme(documentRef)`.
- Shared CSS variables: `--cw-app-bg`, `--cw-surface`, `--cw-surface-elevated`, `--cw-border`, `--cw-primary`, `--cw-primary-2`.

- [ ] **Step 1: Write failing token tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_THEME_TOKENS } from '../src/v23.3/app-theme.mjs';

test('premium blue is the app base palette', () => {
  assert.equal(APP_THEME_TOKENS.primary, '#315CFF');
  assert.equal(APP_THEME_TOKENS.primary2, '#1937DF');
  assert.match(APP_THEME_TOKENS.background, /^#0/);
});
```

- [ ] **Step 2: Run test and confirm RED**

Run: `cd cloudflare-test && node --test test/v23-3-round38-theme.test.mjs`

Expected: FAIL because app-theme module does not exist.

- [ ] **Step 3: Install shared theme before feature modules**

`index.mjs` imports `app-theme.mjs` first. The style targets root/background and primary surfaces, while tournament themes continue to set accent variables such as `--r11a` / `--r11b`; they must not replace the whole page background with tournament brown/orange/green.

- [ ] **Step 4: Replace hard-coded gray bases in Predictions, Ranking, and Tables with shared variables**

Keep competition accents on active controls/cards only. Ensure Profile remains visually compatible with the same deep-blue base.

- [ ] **Step 5: Run theme test and existing UI theme regressions**

Run: `cd cloudflare-test && node --test test/v23-3-round38-theme.test.mjs test/v23-3-round11-performance-themes.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-test/src/v23.3/app-theme.mjs cloudflare-test/src/v23.3/index.mjs cloudflare-test/src/v23.3/predictions-ui.mjs cloudflare-test/src/v23.3/ranking-ui.mjs cloudflare-test/src/v23.3/tables-ui.mjs cloudflare-test/test/v23-3-round38-theme.test.mjs
git commit -m "style: unify premium blue application theme"
```

---

### Task 4: Direct compact premium standings

**Files:**
- Modify: `cloudflare-test/src/v23.3/tables-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/round37-runtime.mjs`
- Test: `cloudflare-test/test/v23-3-round38-tables.test.mjs`

**Interfaces:**
- `renderStandingRows(rows, competition)` directly emits five columns: position, team, played, goalDifference, points.
- No consumer depends on Round 37 DOM column deletion after this task.

- [ ] **Step 1: Write failing source-render tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTablesHub } from '../src/v23.3/tables-ui.mjs';

test('standings are compact before mounting', () => {
  const html = renderTablesHub({ selectedCompetition:'serie_a', data:{ rows:[{ position:1, played:2, goalDifference:8, points:6, team:{ id:1, name:'Roma', crestUrl:'/roma.png' } }] } });
  assert.match(html, /<th>#<\/th><th>Команда<\/th><th>И<\/th><th>РМ<\/th><th>О<\/th>/);
  assert.doesNotMatch(html, /<th>В<\/th>|<th>Н<\/th>|<th>П<\/th>|<th>Г<\/th>/);
  assert.match(html, /width="36" height="36"/);
});
```

- [ ] **Step 2: Run focused test and confirm RED**

Run: `cd cloudflare-test && node --test test/v23-3-round38-tables.test.mjs`

Expected: FAIL because the renderer still emits nine columns and 30px crests.

- [ ] **Step 3: Render five columns directly and remove Round 37 compaction observer**

Remove `compactStandingTable`, the document MutationObserver used for compaction, and compact table post-processing from Round 37.

- [ ] **Step 4: Upgrade qualification/relegation zones**

Replace strip-only styling with row tint + position-cell badge/inset glow. Keep UCL/UEL/UECL/relegation semantic classes and legend.

- [ ] **Step 5: Run focused test**

Run: `cd cloudflare-test && node --test test/v23-3-round38-tables.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-test/src/v23.3/tables-ui.mjs cloudflare-test/src/v23.3/round37-runtime.mjs cloudflare-test/test/v23-3-round38-tables.test.mjs
git commit -m "style: render compact premium standings directly"
```

---

### Task 5: First-paint boot readiness gate

**Files:**
- Create: `cloudflare-test/src/v23.3/boot-gate.mjs`
- Modify: `cloudflare-test/src/v23.3/home-integration.mjs`
- Modify: `cloudflare-test/src/v23.3/index.mjs`
- Modify: `cloudflare-test/scripts/build.mjs`
- Test: `cloudflare-test/test/v23-3-round38-boot-gate.test.mjs`

**Interfaces:**
- Produces: `createBootGate({ documentRef, rootRef, timeoutMs }) -> { markNavigationReady, markHomeReady, release, state }`.
- Home dispatches `ciao-v233-home-settled` after first hydration success or recoverable failure.

- [ ] **Step 1: Write failing boot-gate tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBootGate } from '../src/v23.3/boot-gate.mjs';

test('gate releases only after navigation and home settle', () => {
  const gate = createBootGate({ documentRef:null, rootRef:null, timeoutMs:0, autoTimer:false });
  gate.markNavigationReady();
  assert.equal(gate.state().released, false);
  gate.markHomeReady();
  assert.equal(gate.state().released, true);
});
```

- [ ] **Step 2: Run focused test and confirm RED**

Run: `cd cloudflare-test && node --test test/v23-3-round38-boot-gate.test.mjs`

Expected: FAIL because boot gate does not exist.

- [ ] **Step 3: Implement early premium-blue boot gate**

Inject a minimal pre-module style/element from build output so incomplete Home cards never paint. `boot-gate.mjs` owns release; it removes the gate only after navigation + Home settle or a bounded timeout.

- [ ] **Step 4: Replace visible Home bootstrap cards with non-visible readiness state**

`home-integration.mjs` may keep an internal loading representation, but `html()` must not return fake match cards to the visible app while the boot gate is active. Dispatch settle exactly once after first `ensure()` finishes, including error finalization.

- [ ] **Step 5: Run focused test and build test**

Run: `cd cloudflare-test && node --test test/v23-3-round38-boot-gate.test.mjs test/build.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-test/src/v23.3/boot-gate.mjs cloudflare-test/src/v23.3/home-integration.mjs cloudflare-test/src/v23.3/index.mjs cloudflare-test/scripts/build.mjs cloudflare-test/test/v23-3-round38-boot-gate.test.mjs
git commit -m "fix: gate first paint until app is ready"
```

---

### Task 6: Integration cleanup, full verification, and TEST rollout

**Files:**
- Modify as needed only for integration regressions found by tests.
- Test: all `cloudflare-test/test/*.test.mjs`.

**Interfaces:**
- No new public interface. This task verifies the five prior deliverables together.

- [ ] **Step 1: Run full unit/regression suite**

Run: `cd cloudflare-test && npm test`

Expected: all tests PASS; no old Round 37 test may require removed post-render ownership. If an old test asserts superseded architecture, update that test to assert the new spec behavior rather than restoring obsolete code.

- [ ] **Step 2: Build TEST artifact**

Run: `cd cloudflare-test && npm run build`

Expected: exit 0 with generated `dist/index.html` and copied v23.3 modules.

- [ ] **Step 3: Run Wrangler validation and contract probes**

Run:

```bash
cd cloudflare-test
npx wrangler deploy --dry-run
npm run inspect:api-contract
npm run probe:predictions
npm run probe:reset
```

Expected: all commands exit 0.

- [ ] **Step 4: Review changed files**

Verify there is exactly one Match Center lifecycle owner, no ranking network fetch from MutationObserver, no post-render standings compactor, and boot gate has timeout fallback.

- [ ] **Step 5: Open PR to `develop`, review diff, and merge only after green CI**

PR title: `TEST Round 38: runtime architecture recovery`

PR body must call out: Match Center ownership/back restoration, ranking crest/profile performance, premium-blue base, direct compact standings, and first-paint gate. Explicitly state `main` / Production is untouched.

- [ ] **Step 6: Verify deployed TEST**

Live checks:
1. Open Serie A match from Matches → no parent Serie A header → back returns to Matches.
2. Open Milan–Benfica from Predictions → no Serie A header → back returns to Predictions and correct tournament.
3. Open match from Home → back returns to Home with no gray screen.
4. Ranking shows real favorite-club crests and opens predictor profile without visible lag/refetch loop.
5. Tables show larger crests and premium zone badges/tints.
6. Fresh app launch does not show empty placeholder Home cards before loaded content.

- [ ] **Step 7: Stop before Production**

Do not merge or fast-forward `main`. Report TEST result to the user for visual approval first.
