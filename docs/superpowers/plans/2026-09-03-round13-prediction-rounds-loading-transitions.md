# Round 13 Prediction Rounds, Loading and Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five mobile regressions from the latest TEST screenshots: Serie A round navigation, duplicate UEFA locks, fake ranking participant during loading, one-frame Matches overlay transition artifact, and cropped tournament tabs in Tables.

**Architecture:** Keep the existing v23.3 architecture. Fix data at the canonical prediction source so Serie A exposes the full schedule, reuse the existing round-navigation model for Serie A, keep one lock affordance per future round, make Ranking loading neutral until identity/ranking data is available, make Matches overlay transitions synchronous/opaque, and shorten only the Tables tournament labels while preserving full tournament titles elsewhere.

**Tech Stack:** JavaScript ES modules, Node test runner, Cloudflare Worker/Durable Objects, existing v23.2/v23.3 DOM runtimes.

**Spec:** User screenshots and requirements from 2026-09-03 Round 13.

## Global Constraints

- TEST/develop only; do not touch `main` or Production.
- Preserve existing UEFA sequential round lock backend enforcement.
- Preserve current Serie A crest enrichment and canonical match IDs.
- Preserve bottom navigation and TEST reset guards.
- Use TDD: every production change requires a failing regression test first.

---

### Task 1: Serie A exposes round navigation and future rounds

**Files:**
- Modify: `cloudflare-test/src/v23.3/prediction-match-resolver.mjs`
- Modify: `cloudflare-test/src/v23.3/prediction-service.mjs`
- Modify: `cloudflare-test/src/v23.3/predictions-ui.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round13.test.mjs`

- [ ] Write tests proving full Serie A schedule survives state enrichment and that round tabs are rendered for Serie A.
- [ ] Verify RED.
- [ ] Merge stable selected-round data into the full schedule instead of discarding all other rounds.
- [ ] Extend sequential round gate/navigation to Serie A while keeping existing UEFA behavior.
- [ ] Verify targeted tests GREEN.

### Task 2: One lock icon per future round

**Files:**
- Modify: `cloudflare-test/src/v23.3/predictions-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/round11-performance-themes.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round13.test.mjs`

- [ ] Write a regression test that fails while both inline `🔒` and CSS `::after` are present.
- [ ] Verify RED.
- [ ] Keep the lock in markup and remove the duplicate CSS-generated glyph.
- [ ] Verify GREEN.

### Task 3: Neutral Ranking loading screen

**Files:**
- Modify: `cloudflare-test/src/v23.3/ranking-ui.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round13.test.mjs`

- [ ] Write test proving first uncached load does not render the real participant hero with `me = null`.
- [ ] Verify RED.
- [ ] Add a neutral fixed-geometry loading hero/shell and swap to the participant hero only after cached or fetched ranking data exists.
- [ ] Verify GREEN.

### Task 4: Remove one-frame Matches transition artifact

**Files:**
- Modify: `cloudflare-test/src/v23.2/matches-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round13.test.mjs`

- [ ] Write tests proving nav transitions are not deferred and Match Center `open()` does not call `scrollTo(0,0)`.
- [ ] Verify RED.
- [ ] Make nav overlay state synchronous and keep the overlay background explicitly opaque during hub/competition swaps.
- [ ] Remove forced Match Center scroll reset; preserve stable frame patching from Round 12.
- [ ] Verify GREEN.

### Task 5: Compact Tables tournament tabs

**Files:**
- Modify: `cloudflare-test/src/v23.3/tables-ui.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round13.test.mjs`

- [ ] Write render test proving table selector labels are `Серия А`, `ЛЧ`, `ЛЕ`, `ЛК`.
- [ ] Verify RED.
- [ ] Add table-specific short labels while preserving full competition titles in table content/header.
- [ ] Verify GREEN.

### Task 6: Full verification and TEST deployment

- [ ] Run targeted Round 13 tests.
- [ ] Run full `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npx wrangler deploy --dry-run`.
- [ ] Run API/prediction/reset/BSD contracts.
- [ ] Review diff for TEST-only scope.
- [ ] Merge only to `develop` after GREEN.
- [ ] Verify post-merge GitHub CI and live TEST probe.
