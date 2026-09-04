# Round 27 Navigation Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every frame where the legacy Serie A calendar becomes visible while leaving the new Matches UI for another bottom-navigation tab.

**Architecture:** Keep the Matches overlay visible during navigation handoff. It may close only after the target tab has synchronously created a visible shell and dispatched a shared `ciao-v233-navigation-ready` event. Modern tabs dispatch readiness when their shell is shown; legacy-backed Home/Profile dispatch readiness in a microtask after their synchronous legacy render completes.

**Tech Stack:** JavaScript ES modules, Node test runner, GitHub Actions, Cloudflare Workers TEST.

**Spec:** User-approved Round 27 navigation handoff in project conversation.

## Global Constraints

- TEST only; never modify Production.
- Preserve match data/business logic.
- No timing-only `setTimeout`/`requestAnimationFrame` workaround for hiding Matches.
- Cover `Матчи → Главная / Прогнозы / Рейтинг / Таблицы / Профиль`.

---

### Task 1: Add failing navigation-handoff regression

**Files:**
- Create: `cloudflare-test/test/v23-3-round27-navigation-handoff.test.mjs`

- [ ] **Step 1:** Simulate the Matches overlay opened on `calendar`, click each non-calendar nav target, and assert the overlay remains visible until a `ciao-v233-navigation-ready` event for that exact tab arrives.
- [ ] **Step 2:** Run CI and verify RED because current `installMatchesUi()` immediately closes the overlay on non-calendar navigation.
- [ ] **Step 3:** Commit the test-only RED state.

### Task 2: Implement shared handoff contract

**Files:**
- Create: `cloudflare-test/src/v23.2/navigation-handoff.mjs`
- Modify: `cloudflare-test/src/v23.2/matches-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/navigation-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/predictions-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/ranking-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/tables-ui.mjs`

**Interfaces:**
- `NAVIGATION_READY_EVENT = 'ciao-v233-navigation-ready'`
- `dispatchNavigationReady(tab, documentRef)` dispatches `{detail:{tab}}`.
- `createNavigationHandoff({documentRef, overlay, close})` exposes `begin(tab)` and closes only on matching ready events.

- [ ] **Step 1:** Add shared event helper/controller.
- [ ] **Step 2:** Change Matches navigation away from `calendar` to begin handoff instead of hiding immediately when the overlay is visible.
- [ ] **Step 3:** Dispatch ready from Predictions (`mine`) after its first visible shell render.
- [ ] **Step 4:** Dispatch ready from Ranking (`table`) after its first visible shell render.
- [ ] **Step 5:** Dispatch ready from Tables (`seriea`) when its overlay is shown.
- [ ] **Step 6:** Dispatch ready for legacy-backed Home (`predict`) and Profile (`profile`) in a microtask after the click propagation has completed.
- [ ] **Step 7:** Run the Round 27 test, then the full suite and build.

### Task 3: TEST integration and live verification

**Files:**
- No Production files.

- [ ] **Step 1:** Open/refresh a TEST-only PR to `develop`.
- [ ] **Step 2:** Require full PR CI green.
- [ ] **Step 3:** Merge only after green.
- [ ] **Step 4:** Require post-merge TEST workflow and Cloudflare `ciao-web-app-test` build success.
