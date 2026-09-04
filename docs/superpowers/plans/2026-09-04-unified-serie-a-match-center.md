# Unified Serie A Match Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the proven Serie A Match Center renderer and interaction lifecycle for every match in TEST, changing only tournament theme and data adapter.

**Architecture:** Serie A keeps its existing legacy `openMatchCenter` path. Coppa Italia, Champions League, Europa League and Conference League load BSD canonical sections, adapt them once to the exact final Serie A/cw20 data contract, then enter the same legacy `matchCenterHtml` + `bindMatchCenter` + `patchMatchCenter` lifecycle. The separate canonical external overlay remains installed only as infrastructure for links but must not render external matches.

**Tech Stack:** Cloudflare Workers Static Assets, browser ES modules, Node test runner, existing v23.1 legacy Match Center embedded in the pinned TEST baseline.

**Spec:** User-approved direction in conversation on 2026-09-04: “Возьми за основу матч Центр Серии А поменяй визуальный стиль под турнир и устрой их во все матчи”.

## Global Constraints

- TEST only: `ciao-web-app-test`; Production must not be changed.
- One visual/interaction Match Center implementation for all five competitions.
- Serie A behavior must remain unchanged.
- External competition data comes from the existing authenticated BSD routes only.
- Tournament visual differences are limited to theme/accent and competition label.
- Tabs, tab click handling, overview/stats/events/lineups/players rendering and live refresh use the legacy Serie A runtime.

---

### Task 1: Lock one-renderer routing contract

**Files:**
- Modify: `cloudflare-test/test/v23-3-round19-legacy-match-center-runtime.test.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center-links.mjs` only if routing tests show an external overlay path remains reachable.

**Interfaces:**
- Consumes: canonical `{competition, matchId, initialMatch}` match link payloads.
- Produces: Serie A → original legacy delegation; all other competitions → `openExternalLegacyMatchCenter(payload)` and never `Core.openCanonicalMatchCenter(payload)`.

- [ ] **Step 1: Write failing routing tests**

```js
assert.equal(openPathFor('serie_a'), 'legacy-serie-a');
for (const competition of ['coppa_italia','champions_league','europa_league','conference_league']) {
  assert.equal(openPathFor(competition), 'legacy-external');
}
assert.doesNotMatch(matchCenterSource, /return Core\.openCanonicalMatchCenter\(payload\).*external/s);
```

- [ ] **Step 2: Run the Round 19 test file and confirm the new assertions fail before implementation.**

Run: `node --test test/v23-3-round19-legacy-match-center-runtime.test.mjs`
Expected: FAIL only on the newly added one-renderer routing assertions.

- [ ] **Step 3: Implement minimal routing changes** so no external competition can mount the canonical overlay renderer.

- [ ] **Step 4: Re-run the Round 19 test file.**

Expected: all tests in the file PASS.

- [ ] **Step 5: Commit the routing change.**

### Task 2: Match the exact final Serie A/cw20 contract and lifecycle

**Files:**
- Modify: `cloudflare-test/src/v23.3/bsd-serie-a-legacy-adapter.mjs`
- Modify: `cloudflare-test/scripts/home-v23-3-source-patch.mjs`
- Modify: `cloudflare-test/test/v23-3-round19-legacy-match-center-runtime.test.mjs`

**Interfaces:**
- Consumes: base + `overview`, `stats`, `events`, `lineups`, `players` canonical BSD sections.
- Produces: the exact data shapes read by final legacy `matchCenterHtml`, `matchTabContent`, cw20 overview/stats/events/lineups/players helpers, and final `refreshMatchCenter`.

- [ ] **Step 1: Add fixture assertions for final cw20 fields.**

```js
assert.equal(legacy.incidents.incidents[0].player.name, 'J. Pohjanpalo');
assert.equal(legacy.incidents.incidents[0].player_name, 'J. Pohjanpalo');
assert.equal(legacy.lineups.lineups.home.players[0].name, 'J. Pohjanpalo');
assert.equal(legacy.stats.stats.home.expected_goals, 2.57);
```

Add source-patch assertions proving the external bridge is injected after the last legacy `refreshMatchCenter=` override and calls the real `matchCenterHtml`, `bindMatchCenter` and `patchMatchCenter` functions.

- [ ] **Step 2: Run the Round 19 test file and confirm RED.**

- [ ] **Step 3: Fix the adapter only where the actual legacy contract differs.** Keep both string aliases (`player_name`, `assist_name`) and object fields (`player:{name}`, `assist:{name}`) when cw20 layers use both.

- [ ] **Step 4: Move the final external refresh wrapper to the end of the legacy runtime using a source insertion anchor after all cw20 refresh overrides.** Do not replace Serie A functions.

- [ ] **Step 5: Re-run the Round 19 tests and full `npm test`.**

Expected: 0 failures.

- [ ] **Step 6: Commit the contract/lifecycle change.**

### Task 3: Tournament theming, build gate and live TEST verification

**Files:**
- Modify: `cloudflare-test/scripts/home-v23-3-source-patch.mjs`
- Modify: `cloudflare-test/test/v23-3-round19-legacy-match-center-runtime.test.mjs`
- Modify: `cloudflare-test/test/build.test.mjs` or the existing TEST build marker test that validates injected source markers.

**Interfaces:**
- Consumes: external match context competition key.
- Produces: one legacy Match Center DOM with tournament theme marker/class and short `Статы` tab label for external tournaments; Serie A retains its current appearance.

- [ ] **Step 1: Add failing tests for competition theme ownership.**

```js
for (const competition of ['coppa_italia','champions_league','europa_league','conference_league']) {
  assert.match(patchedSource, /__cw233ExternalMatchContext\.competition/);
}
assert.match(patchedSource, /dataset\.competition/);
assert.match(patchedSource, /textContent = 'Статы'/);
```

- [ ] **Step 2: Run tests and confirm RED.**

- [ ] **Step 3: Apply a competition data attribute/class to the existing legacy Match Center root after `matchCenterHtml()` renders, and set theme CSS variables from the existing competition palette.** No alternate layout markup is allowed.

- [ ] **Step 4: Run full verification.**

Run from `cloudflare-test`:
`npm test`
`npm run build`
`npx wrangler deploy --dry-run`
`npm run inspect:api-contract`

Expected: every command exits 0.

- [ ] **Step 5: Verify the Cloudflare Workers Build for the exact head SHA succeeds and capture its Version ID.**

- [ ] **Step 6: After manual Promote, verify the public TEST root contains the one-renderer bridge marker and that the live Palermo–Mantova external match data still returns all five sections.**
