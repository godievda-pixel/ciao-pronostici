# Canonical Match Center Routing + Hard Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every Match Center entry point through one source-aware router and remove legacy Match Center UI ownership in one hard TEST cutover.

**Architecture:** A canonical router captures a reconstructable source-screen snapshot before opening the standalone Match Center from Plan 1. Back closes the canonical screen and restores exactly that snapshot; old Serie A/external legacy UI routes, listeners and close interceptors are disabled rather than hidden.

**Tech Stack:** JavaScript ES modules, DOM events, Node `node:test`, existing v23.2/v23.3 navigation surfaces.

**Spec:** `docs/superpowers/specs/2026-09-04-canonical-match-center-redesign.md`

## Global Constraints

- Depends on Plan 1's `createMatchCenterStore` and `installMatchCenterView`.
- TEST/develop only; no Production/main changes.
- All entry points use one router.
- Back must be deterministic; blind `history.back()` is not the source of truth.
- No legacy UI fallback after cutover.
- No CSS hiding as an ownership mechanism.

---

## File structure

- Create `cloudflare-test/src/v23.3/screen-snapshot.mjs`: normalized source-screen snapshot schema/capture/restore helpers.
- Create `cloudflare-test/src/v23.3/match-center-router.mjs`: open/back orchestration.
- Modify `cloudflare-test/src/v23.3/match-center-links.mjs`: entry links call router only.
- Modify `cloudflare-test/src/v23.3/home-integration.mjs`: Home entries emit canonical targets/source snapshots.
- Modify `cloudflare-test/src/v23.2/matches-ui.mjs`: expose stable competition/stage state restoration API; do not own Match Center.
- Modify `cloudflare-test/src/v23.3/predictions-ui.mjs`: expose prediction route snapshot/restore.
- Modify `cloudflare-test/src/v23.2/profile-integration.mjs` and `cloudflare-test/src/v23.3/predictor-profile-ui.mjs` only where a match link exists.
- Modify `cloudflare-test/src/v23.3/index.mjs`: install canonical router/view/store and stop importing legacy Match Center UI owners.
- Modify build source patches if they still inject legacy Match Center listeners.
- Add focused routing/cutover tests.

### Task 1: Source snapshot schema

**Files:**
- Create: `cloudflare-test/src/v23.3/screen-snapshot.mjs`
- Test: `cloudflare-test/test/v23-3-round39-screen-snapshot.test.mjs`

**Interfaces:**
- Produces `normalizeScreenSnapshot(input)`, `captureScreenSnapshot({documentRef,sourceScreen,...})`, `restoreScreenSnapshot(snapshot, adapters)`.

- [ ] **Step 1: Write RED test** asserting snapshots preserve `sourceScreen`, `competition`, `stageOrRound`, `filter`, `mode`, `selectedTeam`, `profileId`, and finite non-negative `scrollY` while stripping unknown mutable objects.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement immutable normalized snapshots** with explicit supported source screens: `home`, `matches`, `predictions`, `club-profile`, `predictor-profile`.
- [ ] **Step 4: Run GREEN**.
- [ ] **Step 5: Commit**: `git commit -m "feat: define screen restoration snapshots"`.

### Task 2: MatchCenterRouter

**Files:**
- Create: `cloudflare-test/src/v23.3/match-center-router.mjs`
- Test: `cloudflare-test/test/v23-3-round39-match-center-router.test.mjs`

**Interfaces:**
- Consumes: `store.open/close`, `normalizeScreenSnapshot`, source adapters.
- Produces `createMatchCenterRouter({store,captureSource,restoreSource})` with `open({competition,matchId,initialMatch,source})`, `back()`, `getCurrentSource()`.

- [ ] **Step 1: Write RED tests** for Home→Match→Back, Predictions→Match→Back, Matches Serie A/UCL/Coppa→Match→Back, club profile→Match→Back, A→back→B→back snapshot isolation.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement router** so every `open` captures/freezes a fresh source snapshot before `store.open`; `back` closes store first, then restores the captured source exactly once and clears it.
- [ ] **Step 4: Run GREEN**.
- [ ] **Step 5: Commit**: `git commit -m "feat: add source-aware match center router"`.

### Task 3: Surface restoration adapters

**Files:**
- Modify: `cloudflare-test/src/v23.2/matches-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/predictions-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/home-integration.mjs`
- Modify: `cloudflare-test/src/v23.2/profile-integration.mjs`
- Modify: `cloudflare-test/src/v23.3/predictor-profile-ui.mjs`
- Test: `cloudflare-test/test/v23-3-round39-source-restoration.test.mjs`

**Interfaces:**
- Matches adapter: `snapshotMatchesRoute()` / `restoreMatchesRoute(snapshot)`.
- Predictions adapter: `snapshotPredictionRoute()` / `restorePredictionRoute(snapshot)`.
- Home/profile adapters restore their own screen id + scroll.

- [ ] **Step 1: Write RED tests** that restoration returns to same tournament and stage/round in Matches, same competition/mode/filter in Predictions, and same profile id for profile sources.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Add small explicit snapshot/restore APIs** to each existing surface; do not make the router inspect private DOM implementation details beyond the adapter boundary.
- [ ] **Step 4: Run GREEN**.
- [ ] **Step 5: Commit**: `git commit -m "feat: restore source screens after match center"`.

### Task 4: Route every match link through canonical router

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-links.mjs`
- Modify relevant match-card renderers only to provide canonical `competition` + `matchId` data attributes if missing.
- Test: `cloudflare-test/test/v23-3-round39-match-entrypoints.test.mjs`

**Interfaces:**
- All entrypoints call only `MatchCenterRouter.open(target)`.

- [ ] **Step 1: Write RED test** that clicks/selectors from Home, Predictions, Matches and profile resolve to canonical targets and do not dispatch `ciao-v233-open-serie-a-match` or `ciao-v233-open-external-legacy-match`.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Replace entrypoint delegation** with canonical router calls.
- [ ] **Step 4: Run GREEN**.
- [ ] **Step 5: Commit**: `git commit -m "refactor: route all matches through canonical match center"`.

### Task 5: Hard cutover and legacy UI ownership removal

**Files:**
- Modify: `cloudflare-test/src/v23.3/index.mjs`
- Modify: `cloudflare-test/scripts/build.mjs` and/or exact source-patch files that inject old Match Center behavior.
- Stop importing as UI owners: `legacy-match-center-theme.mjs`, `match-center-lifecycle.mjs`, `serie-a-legacy-bridge.mjs`, Match Center portions of `round31-match-center-stability.mjs`, `round35-match-center-overview-fixes.mjs`, `round37-runtime.mjs` where applicable.
- Test: `cloudflare-test/test/v23-3-round39-no-legacy-match-center-runtime.test.mjs`
- Update only genuinely obsolete legacy regression expectations.

**Interfaces:**
- Runtime installation path becomes canonical store + view + router only.

- [ ] **Step 1: Write RED no-legacy-runtime test** scanning `src/v23.3/index.mjs` and built artifact contract for forbidden UI ownership strings/events/imports.

Minimum forbidden runtime UI triggers:

```text
ciao-v233-open-external-legacy-match
ciao-v233-open-serie-a-match
openExternalLegacyMatchCenter(
legacy closeMatchCenter interception
```

- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Remove legacy UI imports/listeners/build injections**. Data parsing imports may remain only behind Plan 1 provider modules.
- [ ] **Step 4: Update obsolete tests** to assert canonical ownership rather than CSS hiding/legacy fallback.
- [ ] **Step 5: Run focused GREEN**:

`cd cloudflare-test && node --test test/v23-3-round39-*.test.mjs`

- [ ] **Step 6: Run complete test suite**:

`cd cloudflare-test && npm test`

Expected: all PASS.
- [ ] **Step 7: Commit**: `git commit -m "refactor: cut over to canonical match center runtime"`.

## Plan 2 acceptance

- Every match entry point uses one router.
- Back restoration passes the full source matrix.
- Parent Matches DOM is not the Match Center layout owner.
- Legacy Serie A/external Match Center UI events are unnecessary and disabled.
- No fallback to legacy UI exists if canonical loading fails.