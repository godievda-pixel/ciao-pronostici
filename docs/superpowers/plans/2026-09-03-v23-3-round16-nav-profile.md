# Round 16 Navigation/Profile Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining transition flashes, stabilize ranking/tables selectors, and make profile counters use the resettable v23.3 prediction domain.

**Architecture:** Fix state at the owning modules instead of adding another global observer layer. Matches removes the animated background handoff on back; Tables and Ranking render compact selector labels directly and preserve their DOM shells; profile stats are sourced from the canonical v23.3 ranking row so a prediction-domain reset yields zero consistently.

**Tech Stack:** Cloudflare Workers Static Assets, browser ES modules, Node.js `node:test`, Telegram WebApp.

**Spec:** User screenshots and requirements from 2026-09-03 in project Даня.

## Global Constraints

- Work only on `develop`/TEST until final verification.
- Do not modify `main` or Production.
- Preserve existing tournament data and scoring logic.
- Use TDD: RED before runtime changes.
- Final verification: full `npm test`, TEST build, Wrangler dry-run, deployed TEST probe.

---

### Task 1: Atomic Matches back transition

**Files:**
- Modify: `cloudflare-test/src/v23.3/round10-regression-fixes.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round16.test.mjs`

**Interfaces:**
- Consumes: `#ciao-v232-matches-overlay`, `data-cw232-action="hub"`.
- Produces: opaque, non-animated hub transition with no legacy Serie A frame exposed.

- [ ] Write a source-contract test asserting the Matches overlay has no `transition:background` and uses an immediate opaque base background for the hub state.
- [ ] Run the Round 16 test and confirm RED.
- [ ] Remove the background transition from the Round 10 theme CSS while preserving tournament gradients.
- [ ] Run the Round 16 test and confirm GREEN.

### Task 2: Stable compact Ranking and Tables selectors

**Files:**
- Modify: `cloudflare-test/src/v23.3/ranking-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/tables-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/round13-mobile-regressions.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round16.test.mjs`

**Interfaces:**
- Produces selector labels `Общий`, `Серия А`, `КИ`, `ЛЧ`, `ЛЕ`, `ЛК` in Ranking and `Серия А`, `ЛЧ`, `ЛЕ`, `ЛК`, `КИ` in Tables.
- Produces full section headings: `Общий рейтинг`, `Серия А`, `Кубок Италии`, `Лига Чемпионов`, `Лига Европы`, `Лига Конференций`.

- [ ] Write RED tests for compact button labels and full section titles.
- [ ] Write RED test asserting Tables renders compact labels directly rather than relying on a post-render DOM rewrite.
- [ ] Implement compact label/full title maps in Ranking and Tables.
- [ ] Make Ranking filters a fixed six-column mobile grid with no horizontal clipping.
- [ ] Keep the Tables selector shell stable during competition changes; update selected state in place and replace only content.
- [ ] Remove the now-redundant Round 13 post-render label mutation.
- [ ] Run Round 16 tests and confirm GREEN.

### Task 3: Prevent long-press Tables from revealing legacy Matches

**Files:**
- Modify: `cloudflare-test/src/v23.3/tables-ui.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round16.test.mjs`

**Interfaces:**
- Consumes bottom-nav `button[data-tab="seriea"]` pointerdown.
- Produces immediate visible Tables overlay using preserved/cached content or a stable Serie A skeleton before click/deferred loading.

- [ ] Write a RED source/DOM contract requiring a capture `pointerdown` handler for the Tables tab.
- [ ] Implement synchronous overlay reveal on Tables pointerdown without starting duplicate network requests.
- [ ] Preserve normal click handling for actual competition loading.
- [ ] Run Round 16 tests and confirm GREEN.

### Task 4: Canonical profile counters and reset view

**Files:**
- Modify: `cloudflare-test/src/v23.3/profile-rating-ui.mjs`
- Test: `cloudflare-test/test/v23-3-user-feedback-round16.test.mjs`

**Interfaces:**
- Consumes current v23.3 overall ranking row fields `points`, `exact_scores`, `correct_outcomes`, `scored_predictions`.
- Produces the four legacy Profile tiles from those fields in order: Очков, Точных счетов, Успешных исходов, Рассчитанных матчей.

- [ ] Write RED tests for a four-field profile stats mapper and zero fallback when the user has no ranking row.
- [ ] Replace the one-field points cache with a four-field canonical stats cache.
- [ ] Update all four profile tiles atomically from the current ranking row.
- [ ] Ensure missing/currently reset rows display four zeroes.
- [ ] Run Round 16 tests and confirm GREEN.

### Task 5: Verification and TEST handoff

**Files:**
- Test: all `cloudflare-test/test/*.test.mjs`

- [ ] Run full `npm test` and require zero failures.
- [ ] Run `npm run build`.
- [ ] Run `npx wrangler deploy --dry-run`.
- [ ] Open PR to `develop` and wait for full CI GREEN.
- [ ] Verify Cloudflare TEST deployment is for the exact final SHA.
- [ ] Merge only to `develop` and run post-merge live TEST probe.
- [ ] Close superseded draft PR #44 if Round 16 includes the final runtime behavior.
