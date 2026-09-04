# Round 37 Navigation, Ranking, Tables and Tournament Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Match Center back-navigation/viewport ownership, restore predictor profiles and favorite-club crests in Ranking, rebuild Tables in the compact production style, and make prediction match cards inherit the selected tournament theme.

**Architecture:** Fix state at the owning modules rather than adding global CSS-only patches. Match links capture the source surface before opening and Match Center close restores that source; Ranking receives a small legacy predictor-profile client/modal and stronger favorite-team normalization; Tables uses one compact standing renderer for all league competitions; Predictions uses CSS variables derived from the selected tournament instead of a hard-coded blue card background.

**Tech Stack:** Browser ES modules, Cloudflare Workers, Telegram WebApp initData, legacy `ciao-core-api-fast-v4`, Node.js `node:test`, GitHub Actions.

**Spec:** User screenshots and approved design direction from 2026-09-04 in project Даня.

## Global Constraints

- Work only on TEST/develop; do not modify `main` or Production.
- Preserve prediction scoring, competition data and Match Center data contracts.
- Keep Serie A Match Center visually identical to the stable legacy Match Center except for navigation ownership fixes.
- Use TDD: each runtime behavior gets a failing regression test before production code.
- Final verification requires targeted tests, full `npm test`, build, CI, merge to `develop`, and post-merge TEST probe.

---

### Task 1: Match Center source-aware back navigation and viewport ownership

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-links.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center.mjs`
- Modify: `cloudflare-test/src/v23.3/round35-match-center-overview-fixes.mjs`
- Test: `cloudflare-test/test/v23-3-round37-navigation-ranking-tables-themes.test.mjs`

**Interfaces:**
- Consumes: click targets from Home, Predictions, Matches, profile cards; canonical `{ competition, matchId }`.
- Produces: `source` metadata with `{ surface, tab, competition }` and a close event `ciao-v233-match-center-back`.
- Produces: root class `match-center-open` that hides the entire parent Matches overlay while a legacy Match Center owns the viewport.

- [ ] **Step 1: Write failing navigation tests**

```js
test('match target records the source surface', () => {
  const payload = resolveCanonicalMatchTarget(fakePredictionCard('coppa_italia:10'));
  assert.equal(payload.source.surface, 'predictions');
});

test('legacy Match Center close dispatches its remembered source', async () => {
  const events = [];
  const root = fakeEventRoot(events);
  rememberMatchCenterSource({ surface:'home', tab:'predict' });
  dispatchMatchCenterBack(root);
  assert.deepEqual(events.at(-1).detail, { surface:'home', tab:'predict' });
});
```

- [ ] **Step 2: Run the Round 37 test and confirm RED**

Run: `node --test test/v23-3-round37-navigation-ranking-tables-themes.test.mjs`
Expected: FAIL because source metadata/back dispatch helpers do not exist.

- [ ] **Step 3: Implement minimal source capture**

```js
function sourceForTarget(target) {
  if (target.closest('[data-cw233-pred-card]')) return { surface:'predictions', tab:'mine' };
  if (target.closest('#ciao-v232-matches-overlay')) return { surface:'matches', tab:'calendar' };
  if (target.closest('[data-cw232-profile-match]')) return { surface:'club-profile', tab:'profile' };
  return { surface:'home', tab:'predict' };
}
```

Attach this as `payload.source` in `resolveCanonicalMatchTarget` and remember it before routing into both Serie A legacy and external legacy Match Center.

- [ ] **Step 4: Implement close/back handoff**

Dispatch `ciao-v233-match-center-back` with the remembered source when the legacy `.mc-back` button closes. Restore the corresponding bottom-nav tab by clicking the existing `button[data-tab]` only after Match Center has released viewport ownership. For source `matches`, reopen the same competition screen instead of falling through to a blank/grey content shell.

- [ ] **Step 5: Make viewport ownership structural**

While the legacy Match Center is open, hide `#ciao-v232-matches-overlay` as a whole and clear the parent competition header from layout; on close remove `match-center-open` and restore the previous source. Do not rely on the existing Serie-A-only child-header selector.

- [ ] **Step 6: Run targeted tests and confirm GREEN**

Run: `node --test test/v23-3-round37-navigation-ranking-tables-themes.test.mjs test/v23-3-round35-match-center-diagnostics.test.mjs test/v23-3-round27-navigation-handoff.test.mjs`
Expected: PASS.

---

### Task 2: Restore favorite-club crests and predictor profiles in Ranking

**Files:**
- Modify: `cloudflare-test/src/v23.3/prediction-auth.mjs`
- Modify: `cloudflare-test/src/v23.3/ranking-ui.mjs`
- Create: `cloudflare-test/src/v23.3/predictor-profile-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/index.mjs`
- Test: `cloudflare-test/test/v23-3-round37-navigation-ranking-tables-themes.test.mjs`

**Interfaces:**
- `normalizeFavoriteTeam(source)` accepts nested and flattened favorite-team fields.
- Ranking rows render `data-cw233-predictor-id="<numeric telegram/core id>"`.
- `openPredictorProfile(id)` POSTs `{ action:'public_predictor', user_id:id }` to `/api/ciao-core-api-fast-v4` with Telegram initData and renders a modal.

- [ ] **Step 1: Write failing favorite-team normalization tests**

```js
test('favorite team normalization accepts flattened legacy fields', () => {
  assert.deepEqual(normalizeFavoriteTeam({
    favorite_team_id:7,
    favorite_team_name:'Милан',
    favorite_team_logo:'https://img.test/milan.png',
  }), {
    id:7,
    name:'Милан',
    crestUrl:'https://img.test/milan.png',
    customEmojiId:null,
  });
});
```

- [ ] **Step 2: Write failing Ranking profile contract tests**

Assert that ranking rows contain `data-cw233-predictor-id`, the new module POSTs `public_predictor`, and the module is imported by `index.mjs`.

- [ ] **Step 3: Run Round 37 test and confirm RED**

Run: `node --test test/v23-3-round37-navigation-ranking-tables-themes.test.mjs`
Expected: FAIL on flattened favorite-team data and missing predictor-profile runtime.

- [ ] **Step 4: Expand favorite-team normalization**

Resolve ID/name/logo from both nested `favorite_team` and flattened keys such as `favorite_team_id`, `favorite_team_name`, `favorite_team_logo`, `favorite_team_logo_url`, preserving current nested behavior.

- [ ] **Step 5: Make Ranking rows profile targets**

Parse the numeric suffix from `row.user_id` when it matches `telegram:<id>` and render it as `data-cw233-predictor-id`. Keep filter buttons and other controls excluded from profile opening.

- [ ] **Step 6: Add predictor profile modal**

Implement a self-contained overlay matching the existing premium modal language. Loading state appears immediately; success shows display name/username, favorite club, points/stat fields present in the legacy predictor payload, and recent predictions when present; error shows `Повторить`. Backdrop/close button closes without resetting the Ranking filters or scroll.

- [ ] **Step 7: Run targeted tests and confirm GREEN**

Run: `node --test test/v23-3-round37-navigation-ranking-tables-themes.test.mjs test/v23-3-round30-neutral-ranking-favorite-club-match-center.test.mjs`
Expected: PASS.

---

### Task 3: Rebuild tournament Tables in the compact production style

**Files:**
- Modify: `cloudflare-test/src/v23.3/tables-ui.mjs`
- Test: `cloudflare-test/test/v23-3-round37-navigation-ranking-tables-themes.test.mjs`

**Interfaces:**
- League competitions render columns `#`, `КОМАНДА`, `И`, `РМ`, `О` only.
- Serie A retains qualification/relegation side markers.
- `data-cw233-theme` remains the single competition-theme source.
- Coppa Italia keeps its knockout bracket instead of a league table.

- [ ] **Step 1: Write failing compact-table tests**

```js
test('league tables use the compact production columns', () => {
  const html = renderTablesHub({ selectedCompetition:'serie_a', data:{ rows:[sampleStanding] } });
  assert.match(html, /<th>#<\/th><th>Команда<\/th><th>И<\/th><th>РМ<\/th><th>О<\/th>/);
  assert.doesNotMatch(html, /<th>В<\/th>|<th>Н<\/th>|<th>П<\/th>|<th>Г<\/th>/);
});
```

Also assert each competition maps to its existing theme and does not introduce horizontal table overflow.

- [ ] **Step 2: Run Round 37 test and confirm RED**

Run: `node --test test/v23-3-round37-navigation-ranking-tables-themes.test.mjs`
Expected: FAIL because current renderer has nine columns.

- [ ] **Step 3: Replace league standing renderer**

Render the five compact columns, 30px crest, full team name with ellipsis only at extreme width, right-aligned points, centered played/goal-difference values, and position-zone marker using the same tournament semantics as the stable Serie A table.

- [ ] **Step 4: Apply per-tournament card/table surfaces**

Use `--r11a`, `--r11b`, `--r11soft`, `--r11line` from `data-cw233-theme`; keep the surface structure identical and change only tournament colors.

- [ ] **Step 5: Run targeted tests and confirm GREEN**

Run: `node --test test/v23-3-round37-navigation-ranking-tables-themes.test.mjs test/v23-3-tables-ui.test.mjs test/v23-3-round17-native-tables-ranking.test.mjs`
Expected: PASS.

---

### Task 4: Make prediction match cards inherit the selected tournament theme

**Files:**
- Modify: `cloudflare-test/src/v23.3/round11-performance-themes.mjs`
- Modify: `cloudflare-test/src/v23.3/predictions-ui.mjs` only if an explicit per-card theme attribute is required by tests.
- Test: `cloudflare-test/test/v23-3-round37-navigation-ranking-tables-themes.test.mjs`

**Interfaces:**
- Selected tournament already drives `data-cw233-round11-theme` / `data-cw233-prediction-theme`.
- Card surfaces use `--r11a`, `--r11b`, `--r11soft`, `--r11line`; no hard-coded Serie A blues remain in `.cw233-prediction-page .match`.

- [ ] **Step 1: Write failing theme test**

Assert that the `.match` background rule uses tournament variables and does not contain the current hard-coded `rgba(24,42,91` / `rgba(12,24,55` blue pair.

- [ ] **Step 2: Run Round 37 test and confirm RED**

Run: `node --test test/v23-3-round37-navigation-ranking-tables-themes.test.mjs`
Expected: FAIL on hard-coded blue prediction-card surface.

- [ ] **Step 3: Replace hard-coded card colors with variables**

Use a neutral dark base mixed with `--r11a`/`--r11b` for match background, border, score controls and active state; `all` remains neutral via the Round 30 override while competition filters use their mapped colors.

- [ ] **Step 4: Run targeted tests and confirm GREEN**

Run: `node --test test/v23-3-round37-navigation-ranking-tables-themes.test.mjs test/v23-3-user-feedback-round11.test.mjs test/v23-3-predictions-ui.test.mjs`
Expected: PASS.

---

### Task 5: Full verification and TEST handoff

**Files:**
- Test: all `cloudflare-test/test/*.test.mjs`
- Build: `cloudflare-test/scripts/build.mjs`

- [ ] **Step 1: Run full suite**

Run from `cloudflare-test`: `npm test`
Expected: zero failures.

- [ ] **Step 2: Build TEST assets**

Run: `npm run build`
Expected: successful v23.3 TEST build.

- [ ] **Step 3: Create PR to `develop` and require CI GREEN**

Do not target `main`.

- [ ] **Step 4: Merge to `develop` only**

Merge after CI is green and preserve the final tested head SHA.

- [ ] **Step 5: Verify deployed TEST**

Run the existing deployment probe for the merged SHA and confirm Match Center, Ranking, Tables and Predictions endpoints/UI markers are present. Production remains unchanged.
