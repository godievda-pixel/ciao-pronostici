# Round 50.3 Bottom Drawer + Seamless Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fullscreen canonical Match Center with a draggable bottom drawer, expose the approved five user tabs, split Statistics from Shots without changing provider contracts, and keep visible live content on screen during background refresh.

**Architecture:** Keep provider sections unchanged and add a presentation-level view-tab mapping where `shots` reuses `stats`. Runtime owns the active user view; store owns provider data and changes only stale-while-refresh semantics. A focused Round 50.3 view enhancer handles drawer markup/tab order and filters stats-vs-shots presentation after Round 50.2 polish.

**Tech Stack:** Node.js ESM, Cloudflare Worker TEST bundle, vanilla DOM/CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-05-round50-3-bottom-drawer-seamless-refresh-design.md`

## Global Constraints

- Work only on `test/round50-3-bottom-drawer` and target `develop`.
- Do not touch `main` or Production.
- Provider `MATCH_CENTER_SECTIONS` remains `overview`, `stats`, `events`, `lineups`, `players`.
- `shots` is a user-view alias backed by provider `stats`.
- Already visible section content must remain visible during forced live refresh.
- Preserve all Round 50.2 behavior.

---

### Task 1: RED contracts for seamless refresh and user-view tabs

**Files:**
- Create: `cloudflare-test/test/v23-3-round50-3-bottom-drawer-seamless-refresh.test.mjs`
- Read/Modify later: `cloudflare-test/src/v23.3/match-center-store.mjs`
- Read/Modify later: `cloudflare-test/src/v23.3/match-center-runtime.mjs`
- Read/Modify later: `cloudflare-test/src/v23.3/match-center-view.mjs`

**Interfaces:**
- Consumes: `createMatchCenterStore`, `createCanonicalMatchCenterRuntime`.
- Produces: regression contracts for stale-while-refresh and `overview,lineups,events,stats,shots` user navigation.

- [ ] **Step 1: Write failing store refresh tests**

Create a deferred repository section request, preload ready Overview data, force-refresh it, and assert no emitted snapshot has `overview.status === 'loading'` while stale Overview data exists. Add a second test where the forced refresh rejects and assert the old data remains with a renderable status.

- [ ] **Step 2: Write failing runtime/view-tab tests**

Assert the runtime exposes/selects user view `shots`, maps it to store/provider `stats`, and renders navigation in exact order `Обзор → Составы → События → Статистика → Удары` with no `Игроки` tab.

- [ ] **Step 3: Write failing Stats/Shots separation tests**

Using the same stats payload containing metrics, momentum and shots, assert `Статистика` contains stat rows/pressure but no shot map; assert `Удары` contains shot-map markers but no general stat groups.

- [ ] **Step 4: Run the Round 50.3 test file**

Run through CI after commit. Expected: failures specifically on transient loading, missing `shots` user view, old tab order, and unsplit Stats/Shots output.

- [ ] **Step 5: Commit RED**

Commit message: `test: define Round 50.3 drawer and seamless refresh contracts`.

### Task 2: Stale-while-refresh store semantics

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-store.mjs`
- Test: `cloudflare-test/test/v23-3-round50-3-bottom-drawer-seamless-refresh.test.mjs`

**Interfaces:**
- Consumes: existing `state.sections[key]` and `sectionState[key]`.
- Produces: `loadSection(tab,{force:true})` that keeps ready stale data renderable until replacement arrives.

- [ ] **Step 1: Detect stale renderable content before loading**

Compute a boolean from existing section data plus `ready` state before a force request.

- [ ] **Step 2: Emit loading only when no stale content exists**

Keep the existing loading transition for initial tab loads; skip it for background force refresh with ready data.

- [ ] **Step 3: Preserve stale data on refresh error**

When a forced refresh fails and stale data existed, retain section data and a renderable/ready status; only initial-load failures become `error`.

- [ ] **Step 4: Verify Round 50.3 store tests green**

Run the focused test through CI.

- [ ] **Step 5: Commit**

Commit message: `fix: keep Match Center content visible during live refresh`.

### Task 3: User-view tab model and Stats/Shots split

**Files:**
- Create: `cloudflare-test/src/v23.3/round50-3-match-center-view.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center-runtime.mjs`
- Modify minimally if required: `cloudflare-test/src/v23.3/match-center-view.mjs`
- Test: `cloudflare-test/test/v23-3-round50-3-bottom-drawer-seamless-refresh.test.mjs`

**Interfaces:**
- Produces `MATCH_CENTER_USER_TABS = ['overview','lineups','events','stats','shots']`.
- Produces mapping `providerTabForView('shots') === 'stats'`.
- Runtime view state gains `activeViewTab` while store `activeTab` stays provider-facing.

- [ ] **Step 1: Add pure view-tab mapping and tab markup**

Round 50.3 enhancer owns the exact labels/order and removes user-facing Players navigation.

- [ ] **Step 2: Make runtime select a user view before provider load**

For `shots`, set `activeViewTab='shots'`, then call `store.setActiveTab('stats')`. For ordinary views map one-to-one. If provider tab is already loaded, explicitly rerender so switching `stats ↔ shots` updates immediately without network work.

- [ ] **Step 3: Split the existing stats presentation**

After Round 50.2 enhancement: for `stats`, remove shot-map and selected-shot elements; for `shots`, keep interactive shot map/selected shot and remove stat groups plus pressure. Render intentional empty copy when the selected view has no relevant data.

- [ ] **Step 4: Preserve Round 50.2 interactions**

Ensure shot `uiAction` is allowed only while `activeViewTab === 'shots'`; lineup disclosure behavior remains unchanged.

- [ ] **Step 5: Run focused tests and commit**

Commit message: `feat: split Match Center statistics and shots views`.

### Task 4: Real bottom drawer host and gestures

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-runtime.mjs`
- Modify: `cloudflare-test/src/v23.3/round50-3-match-center-view.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center-lifecycle.mjs`
- Test: `cloudflare-test/test/v23-3-round50-3-bottom-drawer-seamless-refresh.test.mjs`

**Interfaces:**
- Round 50.3 enhancer produces `[data-cw503-drawer-shell]`, `[data-cw503-drawer-handle]`, and `[data-cw503-drawer-scroll]`.
- Export pure `resolveDrawerSnap(viewportHeight,height,deltaY)` for deterministic tests.
- Host stores snap state in `data-cw503-drawer-state` and adjusts height only through the drag handle.

- [ ] **Step 1: Write RED snap/markup tests**

Assert standard default, compact/standard/expanded thresholds, and close result for deliberate downward drag from compact range.

- [ ] **Step 2: Convert host geometry from fullscreen to bottom-anchored**

Use fixed `left:0;right:0;bottom:0`, capped height, rounded top corners, hidden outer overflow and a dedicated inner scroll region. No opaque full-screen layer is rendered above the drawer.

- [ ] **Step 3: Add pointer drag behavior on the handle only**

On pointer down capture start Y/height; on move update clamped height; on release call pure snap resolver and either set compact/standard/expanded state or `runtime.back()` for close.

- [ ] **Step 4: Stop suspending the source page for canonical Match Center**

Canonical runtime installation passes no-op suspend/restore hooks. `installMatchCenterLifecycle` no longer hides the source on canonical open events; legacy exported helpers remain for compatibility.

- [ ] **Step 5: Preserve drawer inner scroll across rerenders**

Host render reads/writes scrollTop from `[data-cw503-drawer-scroll]` rather than from the outer host.

- [ ] **Step 6: Run focused tests and commit**

Commit message: `feat: present canonical Match Center as bottom drawer`.

### Task 5: Full regression verification and TEST handoff

**Files:**
- Existing test/build workflow only.

**Interfaces:**
- Produces green `Ciao TEST check` evidence for the final PR head.

- [ ] **Step 1: Run full GitHub Actions `Ciao TEST check`**

Require `Test`, `Build TEST artifact`, `Validate TEST Worker bundle`, API contracts, BSD provider contract, and applicable Match Center probes to succeed.

- [ ] **Step 2: Inspect failures rather than masking them**

If an old contract conflicts with intentional Round 50.3 behavior, verify the old assumption against source/design before updating that test. Do not change source solely to satisfy a stale test.

- [ ] **Step 3: Re-run full CI after any correction**

Fresh final head must have a completed successful run before reporting completion.

- [ ] **Step 4: Keep PR targeted to `develop` only**

Do not merge into `main` and do not switch Production.
