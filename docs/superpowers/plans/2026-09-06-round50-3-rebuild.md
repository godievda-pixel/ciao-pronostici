# Round 50.3 Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Round 50.3 from clean Round 50.2 as an isolated bottom-drawer Match Center with five user views and seamless stale-while-refresh behavior, then verify it through the TEST pipeline without touching Production.

**Architecture:** Keep all provider contracts and Round 50.2 enhancement behavior unchanged. Add one focused Round 50.3 presentation adapter that owns user-view tabs and pure drawer snap math, teach the canonical runtime to map user views to existing provider sections, and change the store only at the forced-refresh boundary so ready data remains renderable. The browser host remains the canonical host but changes from fullscreen overlay geometry to a bottom-anchored drawer; legacy lifecycle helpers stay available but canonical open/close no longer suspend the source surface.

**Tech Stack:** JavaScript ES modules, Node.js `node:test`, Cloudflare Workers/Wrangler 4.127.1, GitHub Actions / Cloudflare TEST build.

**Spec:** `docs/superpowers/specs/2026-09-06-round50-3-rebuild-design.md`

## Global Constraints

- Work only on `test/round50-3-rebuild` and later merge only to `develop`.
- Never modify `main`, Production, `ciao-web-app`, or `ciao-web-api` deployment configuration.
- Do not use Supabase.
- Do not add a provider/network `shots` section; canonical provider sections stay `overview`, `stats`, `events`, `lineups`, `players`.
- User tabs are exactly `Обзор`, `Составы`, `События`, `Статистика`, `Удары` in that order.
- `statistics -> stats` and `shots -> stats`; `players` stays internal and disappears from user navigation.
- Preserve all Round 50.2 behavior, including prediction enrichment, lineup disclosures, interactive shot markers, exact two-decimal selected-shot xG, crest fallback, and intentional empty states.
- The source page must remain visible while Match Center is open.
- Existing ready section content must remain visible during forced live refresh and after a failed background refresh.
- Run the full `npm test`, TEST build, Worker validation and deployed TEST probes before merge.

---

### Task 1: Round 50.3 presentation contracts and pure drawer model

**Files:**
- Create: `cloudflare-test/src/v23.3/round50-3-match-center-view.mjs`
- Create: `cloudflare-test/test/v23-3-round50-3-rebuild.test.mjs`

**Interfaces:**
- Produces: `ROUND503_VIEW_TABS` immutable view descriptors.
- Produces: `canonicalRound503ViewTab(value) -> 'overview'|'lineups'|'events'|'statistics'|'shots'`.
- Produces: `providerTabForRound503View(value) -> 'overview'|'lineups'|'events'|'stats'`.
- Produces: `round503SnapHeights(viewportHeight) -> { compact:number, standard:number, expanded:number }`.
- Produces: `resolveRound503Snap({ viewportHeight, currentHeight, deltaY }) -> { action:'snap'|'dismiss', snap?:'compact'|'standard'|'expanded', height?:number }`.
- Produces: `enhanceRound503MatchCenterView(html, state, viewState) -> string`.

- [ ] **Step 1: Write the failing contracts**

Create `cloudflare-test/test/v23-3-round50-3-rebuild.test.mjs` with imports from the not-yet-created module and assertions for:

```js
assert.deepEqual(ROUND503_VIEW_TABS.map(tab => [tab.key, tab.label]), [
  ['overview','Обзор'],
  ['lineups','Составы'],
  ['events','События'],
  ['statistics','Статистика'],
  ['shots','Удары'],
]);
assert.equal(providerTabForRound503View('statistics'), 'stats');
assert.equal(providerTabForRound503View('shots'), 'stats');
assert.equal(canonicalRound503ViewTab('unknown'), 'overview');

const snaps = round503SnapHeights(800);
assert.deepEqual(snaps, { compact:368, standard:624, expanded:752 });
assert.deepEqual(resolveRound503Snap({ viewportHeight:800, currentHeight:624, deltaY:-120 }), {
  action:'snap', snap:'expanded', height:752,
});
assert.equal(resolveRound503Snap({ viewportHeight:800, currentHeight:368, deltaY:120 }).action, 'dismiss');
```

Also build one ready `stats` state and assert the adapter renders five user tabs, hides the provider `players` tab, keeps stat groups in `statistics`, removes `[data-cw233-mc-shotmap]` from `statistics`, keeps the interactive shot map in `shots`, and removes general stat groups/pressure from `shots`.

- [ ] **Step 2: Run the focused test and verify RED**

Run in CI-equivalent package context:

```bash
cd cloudflare-test && node --test test/v23-3-round50-3-rebuild.test.mjs
```

Expected: FAIL because `round50-3-match-center-view.mjs` does not exist.

- [ ] **Step 3: Implement the minimal isolated adapter**

Implement the view constants/mapping and snap math without importing providers or store code. Use the already-rendered Round 50.2 HTML as input. Replace the existing canonical tab strip with the five Round 50.3 user tabs, carrying `data-cw239-tab` values for the user-view keys. For a provider `stats` state, filter only known balanced marked blocks:

```js
const ROUND503_VIEW_TABS = Object.freeze([
  { key:'overview', label:'Обзор', provider:'overview' },
  { key:'lineups', label:'Составы', provider:'lineups' },
  { key:'events', label:'События', provider:'events' },
  { key:'statistics', label:'Статистика', provider:'stats' },
  { key:'shots', label:'Удары', provider:'stats' },
]);
```

`statistics` removes the balanced element containing `data-cw233-mc-shotmap` and any selected-shot card; `shots` removes stat groups and pressure blocks while retaining the Round 50.2 interactive shot map/selected-shot detail. Do not change `round50-2-match-center-view.mjs`.

Snap targets are exactly 46%, 78%, and 94% of viewport height, rounded to integer pixels. Dismiss only from compact range on a deliberate downward drag of at least `max(84px, 12vh)`; otherwise snap to the nearest target.

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
cd cloudflare-test && node --test test/v23-3-round50-3-rebuild.test.mjs
```

Expected: PASS for view mapping, split rendering and pure snap contracts.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/round50-3-match-center-view.mjs cloudflare-test/test/v23-3-round50-3-rebuild.test.mjs
git commit -m "feat: rebuild Round 50.3 presentation contracts"
```

---

### Task 2: Seamless stale-while-refresh store behavior

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-store.mjs` inside `loadSection()` only.
- Extend test: `cloudflare-test/test/v23-3-round50-3-rebuild.test.mjs`

**Interfaces:**
- Consumes: existing `createMatchCenterStore(repository, options)` API unchanged.
- Produces: same store public API; only forced-refresh state transitions change when stale READY data already exists.

- [ ] **Step 1: Add failing stale-refresh tests**

Use a controllable deferred `repository.loadSection` and assert:

```js
await store.open({ competition:'serie_a', matchId:'serie_a:901' });
await store.setActiveTab('stats');
const stale = store.getState().sections.stats;
const refresh = store.retrySection('stats');
assert.equal(store.getState().sectionState.stats.status, 'ready');
assert.equal(store.getState().sections.stats, stale);
resolveFresh({ available:true, data:freshStats });
await refresh;
assert.equal(store.getState().sections.stats, freshStats);
```

Add a second case where forced refresh rejects after stale READY data exists and assert status remains `ready`, old data remains in `sections.stats`, and no blocking error replaces it. Keep an initial no-data failure test that still becomes `error`.

- [ ] **Step 2: Run focused test and verify RED**

```bash
cd cloudflare-test && node --test test/v23-3-round50-3-rebuild.test.mjs
```

Expected: FAIL because current `loadSection()` emits `loading` unconditionally and converts every rejection to `error`.

- [ ] **Step 3: Implement minimal store change**

At the beginning of `loadSection`, capture whether the target section is already READY with existing data:

```js
const staleReady = force
  && state.sectionState[section]?.status === 'ready'
  && state.sections[section] !== null;
```

Only emit transient `loading` when `staleReady` is false. On successful forced refresh, atomically replace section data and keep `ready`. On error with `staleReady === true`, leave the old section data and `ready` state intact; for all other failures retain existing error behavior. Do not change polling interval, provider names or public store signatures.

- [ ] **Step 4: Run focused test and existing store-related suite**

```bash
cd cloudflare-test && node --test test/v23-3-round50-3-rebuild.test.mjs test/v23-3-round50-2-match-center-ux-data-reliability.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/match-center-store.mjs cloudflare-test/test/v23-3-round50-3-rebuild.test.mjs
git commit -m "fix: keep Match Center content visible during refresh"
```

---

### Task 3: Canonical runtime user-view mapping without source suspension

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-runtime.mjs`
- Extend test: `cloudflare-test/test/v23-3-round50-3-rebuild.test.mjs`
- Keep unchanged: `cloudflare-test/src/v23.3/match-center-lifecycle.mjs`

**Interfaces:**
- Consumes: Task 1 `providerTabForRound503View()` and `enhanceRound503MatchCenterView()`.
- Produces: `createCanonicalMatchCenterRuntime()` public API unchanged.
- Produces: `runtime.selectTab(viewKey)` accepting Round 50.3 user-view keys.
- Produces: `viewState.activeViewTab` with default `overview`.

- [ ] **Step 1: Add failing runtime tests**

Create a runtime harness with spy `store.setActiveTab`, `host.render`, `suspendSource`, and `restoreSource`. Assert:

```js
runtime.open({ competition:'serie_a', matchId:'serie_a:901' });
assert.equal(suspendCalls, 0);
await runtime.selectTab('statistics');
assert.equal(lastProviderTab, 'stats');
const rendersBeforeShots = renderCount;
await runtime.selectTab('shots');
assert.equal(lastProviderTab, 'stats');
assert.ok(renderCount > rendersBeforeShots); // sibling view rerenders without a new provider contract
runtime.back();
assert.equal(restoreCalls, 0);
```

Assert `uiAction('shot','0')` affects selection only while `activeViewTab === 'shots'`, and leaving Shots clears selected-shot state. Assert existing Round 50.2 lineup UI actions still work.

- [ ] **Step 2: Run focused test and verify RED**

```bash
cd cloudflare-test && node --test test/v23-3-round50-3-rebuild.test.mjs
```

Expected: FAIL because current runtime treats tabs as provider keys and calls source suspension/restoration.

- [ ] **Step 3: Implement runtime mapping and enhancement pipeline**

Import Task 1 adapter functions. Extend default view state:

```js
function defaultViewState() {
  return {
    activeViewTab:'overview',
    selectedLineupTeam:'home',
    expandedLineupDisclosure:null,
    selectedShotIndex:null,
  };
}
```

Render in this order:

```js
const round502 = enhanceRound502MatchCenterView(renderMatchCenterView(state), state, viewState);
return enhanceRound503MatchCenterView(round502, state, viewState);
```

In `selectTab(viewKey)`, canonicalize the view key, map it to a provider key, update `viewState.activeViewTab`, reset view-specific transient state as needed, and call `store.setActiveTab(providerKey)` only when provider changes or must load. When `statistics <-> shots` keeps provider `stats`, call `renderCurrent()` so the visible sibling view changes immediately without a duplicate provider request.

Remove canonical calls to `suspendSource` and `restoreSource` from `open()`/`back()` and stop injecting them during installation. Keep lifecycle module/exports untouched for compatibility.

- [ ] **Step 4: Run Round 50.3 + Round 50.2 + lifecycle regression tests**

```bash
cd cloudflare-test && node --test \
  test/v23-3-round50-3-rebuild.test.mjs \
  test/v23-3-round50-2-match-center-ux-data-reliability.test.mjs \
  test/v23-3-round38-match-center-lifecycle.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/match-center-runtime.mjs cloudflare-test/test/v23-3-round50-3-rebuild.test.mjs
git commit -m "feat: map Round 50.3 views in canonical runtime"
```

---

### Task 4: Bottom-anchored browser host and drag controller

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-runtime.mjs`
- Extend test: `cloudflare-test/test/v23-3-round50-3-rebuild.test.mjs`
- Regression test: `cloudflare-test/test/v23-3-round49-premium-match-center-scroll-host.test.mjs`

**Interfaces:**
- Consumes: Task 1 snap functions.
- Produces: same `createBrowserMatchCenterHost(documentRef)` API plus internal drawer handle behavior.
- Host dataset: `data-match-center-snap="standard"` by default.

- [ ] **Step 1: Add failing browser-host tests**

Build a fake document/node that records styles and pointer listeners. Assert after `createBrowserMatchCenterHost(documentRef)`:

```js
assert.equal(host.node.style.position, 'fixed');
assert.equal(host.node.style.left, '0');
assert.equal(host.node.style.right, '0');
assert.equal(host.node.style.bottom, '0');
assert.notEqual(host.node.style.inset, '0');
assert.equal(host.node.dataset.matchCenterSnap, 'standard');
assert.match(host.node.style.height, /78/);
assert.equal(host.node.style.overflowY, 'auto');
```

Assert the rendered shell includes a dedicated handle marker, ordinary content does not initiate drag, upward handle drag snaps to expanded, downward drag snaps to compact, and deliberate downward drag from compact calls runtime back/dismiss. Keep scrollbar hiding assertions from Round 49 green.

- [ ] **Step 2: Run host tests and verify RED**

```bash
cd cloudflare-test && node --test \
  test/v23-3-round50-3-rebuild.test.mjs \
  test/v23-3-round49-premium-match-center-scroll-host.test.mjs
```

Expected: Round 50.3 host assertions FAIL against fullscreen `inset:0` host; Round 49 scrollbar assertions stay green.

- [ ] **Step 3: Implement bottom drawer geometry and handle-only drag**

Keep the existing host id and scrollbar style contract. Replace fullscreen geometry with bottom anchoring and standard-height default. Add the drawer handle in the 50.3 shell and bind pointer/touch drag only when the event originates from that handle. Use Task 1 pure snap resolver for release behavior; set `dataset.matchCenterSnap` and height atomically on snap. Do not add a page-covering backdrop and do not hide/suspend the source page.

- [ ] **Step 4: Run focused and regression tests**

```bash
cd cloudflare-test && node --test \
  test/v23-3-round50-3-rebuild.test.mjs \
  test/v23-3-round49-premium-match-center-scroll-host.test.mjs \
  test/v23-3-round50-2-match-center-ux-data-reliability.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/match-center-runtime.mjs cloudflare-test/test/v23-3-round50-3-rebuild.test.mjs
git commit -m "feat: rebuild Match Center as bottom drawer"
```

---

### Task 5: Full regression, TEST build, PR and deployment gate

**Files:**
- No feature files should change unless a failing regression exposes a real Round 50.3 defect.
- Update plan/spec only if implementation materially deviates from the approved contract.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: a green draft PR targeting `develop`, then a verified merge/deploy to TEST only.

- [ ] **Step 1: Run complete unit suite**

```bash
cd cloudflare-test && npm test
```

Expected: all tests PASS, including all pre-50.3 regressions.

- [ ] **Step 2: Build TEST artifact**

```bash
cd cloudflare-test && npm run build
```

Expected: successful TEST build with no Production mutation.

- [ ] **Step 3: Open/refresh draft PR to `develop` and inspect all checks**

PR title:

```text
TEST Round 50.3 rebuild: bottom drawer + seamless refresh
```

Body must explicitly state: rebuilt from clean Round 50.2, old PR #80 implementation not reused, target `develop` only, `main`/Production untouched.

Expected checks: unit Test, TEST build artifact, Worker bundle validation, deployed TEST probes, and Cloudflare Workers Build for `ciao-web-app-test` all green.

- [ ] **Step 4: Verify TEST deployment behavior**

After CI/Cloudflare deployment, probe the TEST Worker health/version endpoints used by `.github/workflows/ciao-test-check.yml` and open the TEST frontend. Verify Match Center opens as a bottom drawer, source content stays visible, all five tabs switch correctly, Statistics/Shots split correctly, and refresh does not flash the blocking section loader over stale content.

- [ ] **Step 5: Snapshot Production branch before merge**

Record `main` SHA immediately before merge. Do not update it.

- [ ] **Step 6: Mark PR ready and merge only to `develop` after every gate is green**

Use the repository merge mechanism for the verified PR. Never retarget to `main`.

- [ ] **Step 7: Verify post-merge TEST and Production immutability**

Confirm merged `develop` commit checks/Cloudflare TEST build are green, repeat TEST health/UI probes, and confirm `main` SHA exactly matches the pre-merge snapshot.

- [ ] **Step 8: Close/archive old PR #80 without merging it**

Add a short note that it was superseded by the clean Round 50.3 rebuild, then close it. Do not merge or cherry-pick its implementation.
