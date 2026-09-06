# Round 51 Match Center Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clean Round 51 bottom-drawer Match Center on top of stable Round 50.2 without reusing failed Round 50.3 code or changing Production.

**Architecture:** Round 51 is an isolated presentation/runtime path. It reuses stable Round 50.2 repository, store, canonical renderer, and Round 50.2 enhancer, then adds a Round 51 store adapter, view adapter, drawer host, runtime, and router. Historical `match-center-runtime.mjs`, `match-center-lifecycle.mjs`, and `match-center-links.mjs` stay unchanged; the only existing-code cutover is `home-integration.mjs` installing the new Round 51 router.

**Tech Stack:** JavaScript ES modules, Node `node:test`, Cloudflare Workers Static Assets, Wrangler 4.127.1.

**Spec:** `docs/superpowers/specs/2026-09-06-round51-match-center-rebuild-design.md`

## Global Constraints

- Base branch is stable `develop` at `6dd6e91986e3934c34c6ac7f9fed7f0ad21f890a` (Round 50.2).
- Work only on `test/round51-match-center-rebuild` until verification is complete.
- Do not copy any source, runtime, lifecycle, test workaround, or compatibility patch from failed Round 50.3 branches.
- Do not modify `main`, `ciao-web-app`, or Production.
- Do not use Supabase.
- Do not change provider endpoints or canonical provider section names.
- Do not introduce a provider section named `shots`; both `statistics` and `shots` use canonical provider section `stats`.
- Historical Round 50.2 regression tests must remain unchanged and green.
- Historical `cloudflare-test/src/v23.3/match-center-runtime.mjs`, `match-center-lifecycle.mjs`, and `match-center-links.mjs` must remain unchanged.
- The source page must remain visible and intact during all normal Round 51 opens and closes.
- User tabs must be exactly `Обзор`, `Составы`, `События`, `Статистика`, `Удары` in that order.

---

## File Structure

**New files**

- `cloudflare-test/src/v23.3/round51-match-center-view.mjs` — user-view contract, provider mapping, statistics/shots filtering, drawer presentation wrapper.
- `cloudflare-test/src/v23.3/round51-match-center-host.mjs` — bottom drawer DOM host, snap geometry, handle-only drag, dismiss gesture.
- `cloudflare-test/src/v23.3/round51-match-center-store.mjs` — adapter over stable Round 50.2 store that preserves stale renderable data during refresh.
- `cloudflare-test/src/v23.3/round51-match-center-runtime.mjs` — isolated Round 51 runtime composing repository/store/view/host; owns view state and never imports source lifecycle.
- `cloudflare-test/src/v23.3/round51-match-center-links.mjs` — Round 51 document router and target/source metadata resolution; opens Round 51 runtime directly.
- `cloudflare-test/test/v23-3-round51-match-center-view.test.mjs` — tabs, provider mapping, statistics/shots filtering, Round 50.2 presentation parity.
- `cloudflare-test/test/v23-3-round51-match-center-host.test.mjs` — bottom anchoring, snap geometry, handle-only drag, dismiss contract.
- `cloudflare-test/test/v23-3-round51-match-center-store.test.mjs` — stale-ready refresh semantics.
- `cloudflare-test/test/v23-3-round51-match-center-runtime.test.mjs` — isolated runtime behavior, source preservation, tab mapping, lineup/shot state.
- `cloudflare-test/test/v23-3-round51-match-center-routing.test.mjs` — router cutover and all source surfaces.
- `cloudflare-test/scripts/probe-round51-match-center.mjs` — built-artifact/live TEST probe for Round 51 markers.
- `cloudflare-test/test/v23-3-round51-match-center-deployment.test.mjs` — validates probe/build wiring.

**Existing file changed**

- `cloudflare-test/src/v23.3/home-integration.mjs` — change only the Match Center router import from stable legacy router to Round 51 router. No other Home behavior changes.

---

### Task 1: Round 51 User View Contract

**Files:**
- Create: `cloudflare-test/src/v23.3/round51-match-center-view.mjs`
- Create: `cloudflare-test/test/v23-3-round51-match-center-view.test.mjs`
- Read-only dependency: `cloudflare-test/src/v23.3/round50-2-match-center-view.mjs`
- Read-only dependency: `cloudflare-test/src/v23.3/match-center-view.mjs`

**Interfaces:**
- Consumes: base HTML from `renderMatchCenterView(state)` after `enhanceRound502MatchCenterView(html, state, viewState)`.
- Produces: `ROUND51_VIEW_TABS`, `canonicalRound51ViewTab(value)`, `providerTabForRound51View(value)`, `enhanceRound51MatchCenterView(html, state, viewState)`.

- [ ] **Step 1: Write the failing contract tests**

Create tests that import the not-yet-created module and assert the exact five-view contract:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUND51_VIEW_TABS,
  canonicalRound51ViewTab,
  providerTabForRound51View,
  enhanceRound51MatchCenterView,
} from '../src/v23.3/round51-match-center-view.mjs';

test('Round 51 exposes the approved views in exact order', () => {
  assert.deepEqual(ROUND51_VIEW_TABS.map(({ key, label }) => [key, label]), [
    ['overview', 'Обзор'],
    ['lineups', 'Составы'],
    ['events', 'События'],
    ['statistics', 'Статистика'],
    ['shots', 'Удары'],
  ]);
});

test('Round 51 maps two user views onto the existing stats provider', () => {
  assert.equal(providerTabForRound51View('overview'), 'overview');
  assert.equal(providerTabForRound51View('lineups'), 'lineups');
  assert.equal(providerTabForRound51View('events'), 'events');
  assert.equal(providerTabForRound51View('statistics'), 'stats');
  assert.equal(providerTabForRound51View('shots'), 'stats');
  assert.equal(canonicalRound51ViewTab('bad-value'), 'overview');
});
```

Add a fixture containing primary stats, pressure, shot map, selected-shot content, and shot list. Assert `statistics` keeps primary stats/pressure but removes all shot-specific blocks; assert `shots` keeps markers/detail/list but removes long general-stat blocks.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd cloudflare-test
node --test test/v23-3-round51-match-center-view.test.mjs
```

Expected: FAIL because `round51-match-center-view.mjs` does not exist.

- [ ] **Step 3: Implement the minimal view module**

Create the module with this public contract:

```js
export const ROUND51_VIEW_TABS = Object.freeze([
  Object.freeze({ key:'overview', label:'Обзор' }),
  Object.freeze({ key:'lineups', label:'Составы' }),
  Object.freeze({ key:'events', label:'События' }),
  Object.freeze({ key:'statistics', label:'Статистика' }),
  Object.freeze({ key:'shots', label:'Удары' }),
]);

const VIEW_SET = new Set(ROUND51_VIEW_TABS.map(tab => tab.key));
const PROVIDER_BY_VIEW = Object.freeze({
  overview:'overview',
  lineups:'lineups',
  events:'events',
  statistics:'stats',
  shots:'stats',
});

export function canonicalRound51ViewTab(value) {
  const key = String(value || '').trim().toLowerCase();
  return VIEW_SET.has(key) ? key : 'overview';
}

export function providerTabForRound51View(value) {
  return PROVIDER_BY_VIEW[canonicalRound51ViewTab(value)];
}
```

Implement HTML transformation helpers locally in this new file. Replace the canonical provider nav with the approved five buttons while retaining `data-cw239-tab` for host delegation. For `statistics`, remove elements marked by `data-cw233-mc-shotmap`, `.cw502-selected-shot`, and `data-cw233-mc-shot-list`. For `shots`, remove the primary/general statistics and pressure blocks while preserving Round 50.2 shot marker attributes and selected-shot markup. Do not alter overview, lineups, or events content beyond tab navigation.

- [ ] **Step 4: Add Round 50.2 parity assertions**

In the same test file, render representative Round 50.2 lineup and shot HTML through the Round 51 adapter and assert these attributes survive:

```js
assert.match(html, /data-cw502-action="lineup-disclosure"/);
assert.match(html, /data-cw502-action="shot"/);
assert.match(html, /data-cw502-crest-fallback/);
assert.match(html, /xG 0\.20|0\.20/);
```

- [ ] **Step 5: Run focused tests GREEN**

```bash
cd cloudflare-test
node --test test/v23-3-round51-match-center-view.test.mjs
```

Expected: all Round 51 view tests PASS.

- [ ] **Step 6: Run the historical Round 50.2 test unchanged**

```bash
cd cloudflare-test
node --test test/v23-3-round50-2-match-center-ux-data-reliability.test.mjs
```

Expected: PASS with no changes to that test.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/src/v23.3/round51-match-center-view.mjs cloudflare-test/test/v23-3-round51-match-center-view.test.mjs
git commit -m "feat(test): add Round 51 Match Center view contract"
```

---

### Task 2: Isolated Bottom Drawer Host

**Files:**
- Create: `cloudflare-test/src/v23.3/round51-match-center-host.mjs`
- Create: `cloudflare-test/test/v23-3-round51-match-center-host.test.mjs`
- Read-only reference: `cloudflare-test/src/v23.3/match-center-runtime.mjs`

**Interfaces:**
- Consumes: runtime methods `back()`, `selectTab(tab)`, `retryBase()`, `retrySection(tab)`, `uiAction(action, value)`.
- Produces: `ROUND51_HOST_ID`, `round51SnapHeights(viewportHeight)`, `resolveRound51Snap(input)`, `createRound51MatchCenterHost(documentRef, options)`.

- [ ] **Step 1: Write geometry RED tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  round51SnapHeights,
  resolveRound51Snap,
} from '../src/v23.3/round51-match-center-host.mjs';

test('Round 51 snap heights are deterministic', () => {
  assert.deepEqual(round51SnapHeights(800), {
    compact:368,
    standard:624,
    expanded:752,
  });
});

test('Round 51 dismisses only a deliberate downward compact drag', () => {
  assert.deepEqual(resolveRound51Snap({ viewportHeight:800, snap:'standard', deltaY:-120 }), {
    action:'snap', snap:'expanded', height:752,
  });
  assert.deepEqual(resolveRound51Snap({ viewportHeight:800, snap:'compact', deltaY:120 }), {
    action:'dismiss',
  });
});
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
cd cloudflare-test
node --test test/v23-3-round51-match-center-host.test.mjs
```

Expected: FAIL because module is absent.

- [ ] **Step 3: Implement snap helpers**

Use 46/78/94 percent viewport targets and clamp to positive integers:

```js
export function round51SnapHeights(viewportHeight) {
  const viewport = Math.max(1, Number(viewportHeight) || 1);
  return Object.freeze({
    compact:Math.round(viewport * 0.46),
    standard:Math.round(viewport * 0.78),
    expanded:Math.round(viewport * 0.94),
  });
}
```

Use a meaningful drag threshold of `72px`. Upward from compact/standard advances one state; downward from expanded/standard retreats one state; downward from compact at or above threshold returns `{ action:'dismiss' }`; smaller drags return the current snap.

- [ ] **Step 4: Add DOM host contract tests**

Use a minimal fake document/node harness. Assert a newly-created host has:

```js
assert.equal(node.style.position, 'fixed');
assert.equal(node.style.bottom, '0px');
assert.equal(node.style.left, '0px');
assert.equal(node.style.right, '0px');
assert.notEqual(node.style.inset, '0');
assert.equal(node.dataset.cw51Snap, 'standard');
```

Assert the host injects a dedicated handle marked `data-cw51-drawer-handle`, internal scroll content marked `data-cw51-drawer-scroll`, and does not create a fullscreen backdrop that blocks the source page.

- [ ] **Step 5: Implement `createRound51MatchCenterHost`**

The host creates its own node `ciao-v251-match-center-drawer`. It uses fixed bottom anchoring, rounded top corners, `max-width` appropriate to the current miniapp width, `overflow:hidden`, and an internal scroll element. `render(html)` replaces only the internal scroll content, never the handle shell. `show()` starts at `standard`. `hide()` hides the drawer. `setSnap(name)` updates height and `data-cw51-snap`.

Pointer gesture ownership must start only when `event.target.closest('[data-cw51-drawer-handle]')` is inside the host. Do not initiate drawer dragging from content scroll or tabs. On resolved dismiss call `boundRuntime.back()`.

- [ ] **Step 6: Run focused tests GREEN**

```bash
cd cloudflare-test
node --test test/v23-3-round51-match-center-host.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/src/v23.3/round51-match-center-host.mjs cloudflare-test/test/v23-3-round51-match-center-host.test.mjs
git commit -m "feat(test): add isolated Round 51 bottom drawer host"
```

---

### Task 3: Seamless Refresh Store Adapter

**Files:**
- Create: `cloudflare-test/src/v23.3/round51-match-center-store.mjs`
- Create: `cloudflare-test/test/v23-3-round51-match-center-store.test.mjs`
- Read-only dependency: `cloudflare-test/src/v23.3/match-center-store.mjs`

**Interfaces:**
- Consumes: an already-created stable Round 50.2 store implementing `open`, `close`, `setActiveTab`, `retryBase`, `retrySection`, `subscribe`, `getState`.
- Produces: `createRound51MatchCenterStore({ store })` exposing the same interface and normalized snapshots.

- [ ] **Step 1: Write stale-refresh RED tests**

Build a fake underlying store that can emit a sequence for `stats`:

1. `ready` with stale stats data;
2. `loading` while the stale `sections.stats` value remains present;
3. either `ready` with fresh data or `error` while stale data remains present.

Assert the Round 51 adapter exposes phase 2 and stale-error phase 3 as renderable `ready` while retaining the same stale object, then exposes fresh data after success.

```js
assert.equal(adapter.getState().sectionState.stats.status, 'ready');
assert.equal(adapter.getState().sections.stats, staleStats);
```

Also assert an initial `error` with `sections.stats === null` remains `error`.

- [ ] **Step 2: Run focused test and verify RED**

```bash
cd cloudflare-test
node --test test/v23-3-round51-match-center-store.test.mjs
```

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement snapshot normalization**

Create a pure normalizer inside the new module:

```js
function normalizeSectionState(snapshot) {
  const sections = snapshot?.sections || {};
  const sectionState = snapshot?.sectionState || {};
  const normalized = {};
  for (const [key, entry] of Object.entries(sectionState)) {
    const hasRenderable = sections[key] !== null && sections[key] !== undefined;
    const staleTransition = hasRenderable && (entry?.status === 'loading' || entry?.status === 'error');
    normalized[key] = staleTransition
      ? { status:'ready', error:entry?.status === 'error' ? String(entry?.error || '') : '' }
      : { ...entry };
  }
  return { ...snapshot, sections:{ ...sections }, sectionState:normalized };
}
```

Wrap `subscribe` so listeners receive normalized snapshots. `getState()` returns normalized current state. All action methods delegate unchanged to the stable store. Do not change `match-center-store.mjs`.

- [ ] **Step 4: Run adapter and historical store tests GREEN**

```bash
cd cloudflare-test
node --test test/v23-3-round51-match-center-store.test.mjs test/v23-3-round39-match-center-store.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/round51-match-center-store.mjs cloudflare-test/test/v23-3-round51-match-center-store.test.mjs
git commit -m "feat(test): preserve stale Match Center data during Round 51 refresh"
```

---

### Task 4: Isolated Round 51 Runtime

**Files:**
- Create: `cloudflare-test/src/v23.3/round51-match-center-runtime.mjs`
- Create: `cloudflare-test/test/v23-3-round51-match-center-runtime.test.mjs`
- Read-only dependencies: `match-center-repository.mjs`, `match-center-store.mjs`, `match-center-view.mjs`, `round50-2-match-center-view.mjs`
- New dependencies: `round51-match-center-store.mjs`, `round51-match-center-view.mjs`, `round51-match-center-host.mjs`

**Interfaces:**
- Consumes: stable repository/store/renderer and new Round 51 adapters.
- Produces: `ROUND51_RUNTIME_BUILD`, `createRound51MatchCenterRuntime(options)`, `installRound51MatchCenterRuntime(documentRef, rootRef)`, `openRound51MatchCenter(payload)`.

- [ ] **Step 1: Write runtime RED tests**

Use fake store/host harnesses. Assert:

```js
await runtime.open({ competition:'serie_a', matchId:'serie_a:901', source:{ surface:'matches' } });
assert.deepEqual(runtime.currentSource(), { surface:'matches' });
assert.equal(host.snap, 'standard');

await runtime.selectTab('statistics');
assert.deepEqual(providerTabs, ['stats']);
assert.equal(runtime.currentViewState().activeViewTab, 'statistics');

await runtime.selectTab('shots');
assert.deepEqual(providerTabs, ['stats']);
assert.equal(runtime.currentViewState().activeViewTab, 'shots');

runtime.back();
assert.equal(host.hidden, true);
```

The harness must contain `suspendSource`/`restoreSource` spies that are **not passed** to Round 51 runtime because no such dependency exists. Add a source-page fake and assert open/back do not mutate it.

Add tests proving shot selection works only in `shots`, and lineup team/disclosure actions work only in `lineups`.

- [ ] **Step 2: Run focused test and verify RED**

```bash
cd cloudflare-test
node --test test/v23-3-round51-match-center-runtime.test.mjs
```

Expected: FAIL because runtime module is absent.

- [ ] **Step 3: Implement runtime state and provider mapping**

The new runtime owns:

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

`open(payload)` stores `payload.source` as metadata only, resets view state, sets host snap to `standard`, scrolls the drawer content to top, and delegates to store `open`.

`selectTab(viewTab)` canonicalizes the user view and maps it with `providerTabForRound51View`. If switching between `statistics` and `shots` while provider is already `stats`, update `activeViewTab` and re-render without issuing a duplicate provider request.

`back()` closes store and hides host only. It must not import or call `currentMatchSource`, `suspendMatchSource`, or `restoreMatchSource`.

- [ ] **Step 4: Compose stable renderer plus enhancers**

Use this order:

```js
const base = renderMatchCenterView(state);
const round502 = enhanceRound502MatchCenterView(base, state, viewState);
const round51 = enhanceRound51MatchCenterView(round502, state, viewState);
host.render(round51);
```

Use `createMatchCenterRepository()`, stable `createMatchCenterStore()`, then wrap it with `createRound51MatchCenterStore({ store:stableStore })` in `installRound51MatchCenterRuntime`.

- [ ] **Step 5: Run runtime plus Round 50.2 interaction tests GREEN**

```bash
cd cloudflare-test
node --test test/v23-3-round51-match-center-runtime.test.mjs test/v23-3-round50-2-match-center-ux-data-reliability.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-test/src/v23.3/round51-match-center-runtime.mjs cloudflare-test/test/v23-3-round51-match-center-runtime.test.mjs
git commit -m "feat(test): add isolated Round 51 Match Center runtime"
```

---

### Task 5: Round 51 Router Cutover Without Legacy Lifecycle Ownership

**Files:**
- Create: `cloudflare-test/src/v23.3/round51-match-center-links.mjs`
- Create: `cloudflare-test/test/v23-3-round51-match-center-routing.test.mjs`
- Modify: `cloudflare-test/src/v23.3/home-integration.mjs` — import line only.
- Read-only references: `match-bootstrap-cache.mjs`, `match-center-links.mjs`.

**Interfaces:**
- Consumes: `openRound51MatchCenter(payload)` and `getMatchBootstrap(competition, matchId)`.
- Produces: `resolveRound51MatchTarget(target)`, `installRound51MatchLinks(documentRef, { open })`.

- [ ] **Step 1: Write routing RED tests for every source surface**

Use fake targets for:

- Home canonical match card;
- Predictions card;
- Club profile match;
- Matches overlay schedule card.

Assert each resolves canonical `{ competition, matchId, source }`, with source surfaces `home`, `predictions`, `club-profile`, and `matches` respectively. Assert prediction controls and generic interactive elements are ignored.

Assert the installer calls only the injected Round 51 `open` function and does not dispatch either legacy lifecycle open event.

- [ ] **Step 2: Run focused test and verify RED**

```bash
cd cloudflare-test
node --test test/v23-3-round51-match-center-routing.test.mjs
```

Expected: FAIL because Round 51 links module is absent.

- [ ] **Step 3: Implement the isolated router**

Reimplement target resolution inside `round51-match-center-links.mjs` using stable selectors and `getMatchBootstrap`; do not import `match-center-links.mjs` or `match-center-runtime.mjs`.

The click handler must:

```js
const payload = resolveRound51MatchTarget(event?.target);
if (!payload) return;
event.preventDefault?.();
event.stopPropagation?.();
event.stopImmediatePropagation?.();
void open(payload);
```

No lifecycle capture is necessary. `source` is already derived as immutable metadata in the payload.

- [ ] **Step 4: Make the one-line Home cutover**

Change only:

```js
import { installCanonicalMatchLinks } from './match-center-links.mjs';
```

to:

```js
import { installRound51MatchLinks } from './round51-match-center-links.mjs';
```

and change the bottom installer call from `installCanonicalMatchLinks(globalThis.document)` to `installRound51MatchLinks(globalThis.document)`.

Do not change Home data loading/rendering code.

- [ ] **Step 5: Add source-preservation integration assertion**

In the routing test, construct a fake source page whose `hidden`, classes, and scroll positions are observed before and after router open/back. Assert all remain unchanged. Also read the historical modules and assert Round 51 runtime/router contain no `suspendMatchSource`, `restoreMatchSource`, `MATCH_CENTER_OWNER_CLASS`, or legacy open-event strings.

- [ ] **Step 6: Run routing, Home, and historical cutover tests GREEN**

```bash
cd cloudflare-test
node --test test/v23-3-round51-match-center-routing.test.mjs test/v23-3-home-integration.test.mjs test/v23-3-round39-match-center-cutover.test.mjs test/v23-3-round49-premium-match-center-integration.test.mjs
```

Expected: PASS. Historical tests remain unchanged because old router/runtime files are untouched.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/src/v23.3/round51-match-center-links.mjs cloudflare-test/src/v23.3/home-integration.mjs cloudflare-test/test/v23-3-round51-match-center-routing.test.mjs
git commit -m "feat(test): cut Match Center routing over to isolated Round 51"
```

---

### Task 6: Build, Probe, and Deployment Contract

**Files:**
- Create: `cloudflare-test/scripts/probe-round51-match-center.mjs`
- Create: `cloudflare-test/test/v23-3-round51-match-center-deployment.test.mjs`
- Read-only: `cloudflare-test/scripts/probe-round50-match-center.mjs`
- Read-only: `.github/workflows/ciao-test-check.yml`

**Interfaces:**
- Consumes: built TEST artifact and live TEST base URL supplied by existing probe conventions.
- Produces: explicit Round 51 artifact/live assertions.

- [ ] **Step 1: Write deployment RED tests**

Read the future probe script and built source expectations. Require markers:

```js
assert.match(source, /round51-match-center-runtime/);
assert.match(source, /ciao-v251-match-center-drawer/);
assert.match(source, /data-cw51-drawer-handle/);
assert.match(source, /Обзор/);
assert.match(source, /Составы/);
assert.match(source, /События/);
assert.match(source, /Статистика/);
assert.match(source, /Удары/);
assert.doesNotMatch(round51RuntimeSource, /suspendMatchSource|restoreMatchSource/);
```

- [ ] **Step 2: Run deployment test and verify RED**

```bash
cd cloudflare-test
node --test test/v23-3-round51-match-center-deployment.test.mjs
```

Expected: FAIL because the probe does not exist yet.

- [ ] **Step 3: Implement `probe-round51-match-center.mjs`**

Follow existing probe conventions. The probe must fail unless the built/live TEST response contains Round 51 runtime/host markers and the approved five tab labels. It must also verify the historical fullscreen host marker is not the active Round 51 host.

- [ ] **Step 4: Run the complete local test suite**

```bash
cd cloudflare-test
npm test
```

Expected: every historical and Round 51 test PASS.

- [ ] **Step 5: Build TEST artifact**

```bash
cd cloudflare-test
npm run build
```

Expected: exit code 0 and TEST artifact generated by the existing build pipeline.

- [ ] **Step 6: Run deployment/probe contract locally against the built artifact**

```bash
cd cloudflare-test
node --test test/v23-3-round51-match-center-deployment.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/scripts/probe-round51-match-center.mjs cloudflare-test/test/v23-3-round51-match-center-deployment.test.mjs
git commit -m "test: add Round 51 Match Center deployment probe"
```

---

### Task 7: Final Verification and TEST-Only Integration

**Files:**
- No new source files unless verification exposes a real defect; any fix returns to the relevant earlier TDD task.
- Review all branch changes against `develop`.

**Interfaces:**
- Produces: verified branch head ready for merge to `develop` and TEST deployment only.

- [ ] **Step 1: Verify branch scope**

```bash
git diff --name-status develop...HEAD
```

Expected: only Round 51 new modules/tests/probe, the Round 51 docs, and the narrow `home-integration.mjs` cutover. No Round 50.3 files and no modifications to historical runtime/lifecycle/router.

- [ ] **Step 2: Re-run full tests from the final HEAD**

```bash
cd cloudflare-test
npm test
```

Expected: PASS.

- [ ] **Step 3: Re-run final build from the same HEAD**

```bash
cd cloudflare-test
npm run build
```

Expected: PASS.

- [ ] **Step 4: Validate the Worker bundle with the existing CI workflow commands**

Run the exact validation commands from `.github/workflows/ciao-test-check.yml` for TEST build/bundle verification. Expected: PASS with no Production target.

- [ ] **Step 5: Open/update the Round 51 PR to `develop` and wait for fresh CI on the final HEAD**

Required checks: GitHub `Ciao TEST check` green on that exact commit. Do not merge a stale green result from an earlier commit.

- [ ] **Step 6: Review before merge**

Use the `superpowers:requesting-code-review` workflow. Reject merge if review finds lifecycle coupling, fullscreen ownership, historical-test edits, or provider contract changes.

- [ ] **Step 7: Merge only into `develop`**

After all checks are green, merge the Round 51 branch into `develop`. Do not update `main`.

- [ ] **Step 8: Verify Cloudflare TEST build/deployment**

Confirm the Cloudflare build for `ciao-web-app-test` is green and tied to the Round 51 `develop` merge commit. Do not touch `ciao-web-app`.

- [ ] **Step 9: Probe the live TEST endpoint**

Run:

```bash
cd cloudflare-test
node scripts/probe-round51-match-center.mjs
```

with the existing TEST endpoint environment convention. Required live behavior: bottom drawer present, `standard` default, source page visible, exact five tabs, no blocking refresh replacement.

- [ ] **Step 10: Browser verification**

Open the TEST app and verify at least one match from Home, Predictions, Matches, and Club Profile. For each source: open drawer, drag standard→expanded→compact, dismiss from compact, reopen, switch all five tabs, select a shot, expand a lineup disclosure, and confirm the underlying source surface remains where it was.

- [ ] **Step 11: Completion evidence**

Record final branch/merge SHA, full test result, build result, GitHub CI result, Cloudflare TEST result, and live probe result before claiming Round 51 complete. Production remains untouched.
