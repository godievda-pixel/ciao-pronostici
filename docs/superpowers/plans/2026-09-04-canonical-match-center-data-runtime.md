# Canonical Match Center Data + Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one canonical Match Center data contract and one standalone Match Center runtime for Serie A, Coppa Italia, UCL, UEL and UECL, with no legacy UI ownership.

**Architecture:** Provider-specific data is normalized behind a repository boundary, then consumed by one store and one standalone `#ciao-match-center` view. Existing BSD/legacy parsers may temporarily feed canonical providers, but may not render DOM or dispatch UI events.

**Tech Stack:** JavaScript ES modules, Cloudflare Worker, Node `node:test`, Wrangler 4.127.1.

**Spec:** `docs/superpowers/specs/2026-09-04-canonical-match-center-redesign.md`

## Global Constraints

- TEST/develop only; Production/main remains untouched until manual approval.
- Ciao, Web! is Premium Blue outside Match Center.
- Match Center has one runtime architecture but five full competition themes.
- Legacy UI DOM/events/navigation may not participate after cutover.
- No CSS hiding may be used as the ownership fix.
- TDD: each task begins with a failing test and ends with a focused commit.

---

## File structure

- Create `cloudflare-test/src/v23.3/match-center-contract.mjs`: canonical validators/normalizers and section names.
- Create `cloudflare-test/src/v23.3/match-center-providers.mjs`: provider selection and normalization adapters.
- Create `cloudflare-test/src/v23.3/match-center-repository.mjs`: frontend/API repository facade.
- Create `cloudflare-test/src/v23.3/match-center-store.mjs`: only state/lifecycle/polling owner.
- Create `cloudflare-test/src/v23.3/match-center-view.mjs`: standalone renderer for `#ciao-match-center`.
- Create `cloudflare-test/src/v23.3/match-center-themes.mjs`: five full Match Center theme token sets.
- Modify `cloudflare-test/src/worker.js`: canonical API route implementation.
- Modify `cloudflare-test/src/v23.3/data-client.mjs`: canonical API client facade.
- Test in new focused files under `cloudflare-test/test/`.

### Task 1: Canonical Match Center contract

**Files:**
- Create: `cloudflare-test/src/v23.3/match-center-contract.mjs`
- Test: `cloudflare-test/test/v23-3-round39-match-center-contract.test.mjs`

**Interfaces:**
- Produces: `MATCH_CENTER_SECTIONS`, `normalizeCanonicalBase(input, competition, matchId)`, `normalizeCanonicalSection(section, input)`, `isCanonicalBase(value)`.

- [ ] **Step 1: Write the failing contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH_CENTER_SECTIONS,
  normalizeCanonicalBase,
  isCanonicalBase,
} from '../src/v23.3/match-center-contract.mjs';

test('all supported matches normalize to one canonical base shape', () => {
  const base = normalizeCanonicalBase({
    status:'scheduled', kickoffAt:'2026-09-12T18:00:00Z',
    homeTeam:{ id:'1', name:'Inter', crestUrl:'https://cdn/inter.png' },
    awayTeam:{ id:'2', name:'Milan', crestUrl:'https://cdn/milan.png' },
    coverage:{ overview:true, stats:true, events:true, lineups:false, players:false },
  }, 'serie_a', 'serie_a:42');
  assert.equal(base.competition, 'serie_a');
  assert.equal(base.matchId, 'serie_a:42');
  assert.equal(base.homeTeam.name, 'Inter');
  assert.equal(base.score.home, null);
  assert.deepEqual(MATCH_CENTER_SECTIONS, ['overview','stats','events','lineups','players']);
  assert.equal(isCanonicalBase(base), true);
});
```

- [ ] **Step 2: Run RED**

Run: `cd cloudflare-test && node --test test/v23-3-round39-match-center-contract.test.mjs`

Expected: FAIL because `match-center-contract.mjs` does not exist.

- [ ] **Step 3: Implement minimal contract module**

The module must normalize `competition`, `matchId`, `status`, `kickoffAt`, `homeTeam`, `awayTeam`, `score:{home,away}`, `venue`, `referee`, `coverage`, `updatedAt`; missing optional values become `null`/`false`, not provider-specific aliases.

- [ ] **Step 4: Run GREEN**

Run the same test; expected PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: define canonical match center contract"`

### Task 2: Canonical competition providers on the Worker

**Files:**
- Create: `cloudflare-test/src/v23.3/match-center-providers.mjs`
- Modify: `cloudflare-test/src/worker.js`
- Test: `cloudflare-test/test/v23-3-round39-match-center-providers.test.mjs`
- Test: `cloudflare-test/test/v23-3-round39-match-center-worker.test.mjs`

**Interfaces:**
- Consumes: `normalizeCanonicalBase`, `normalizeCanonicalSection`.
- Produces: `createMatchCenterProviders(deps)`, whose `.loadBase({competition,matchId,request,env})` and `.loadSection({competition,matchId,section,request,env})` return canonical data.

- [ ] **Step 1: Write failing provider tests** covering Serie A and one UEFA competition, asserting that both return identical field names and never return legacy DOM/event data.
- [ ] **Step 2: Run RED** with `node --test test/v23-3-round39-match-center-providers.test.mjs`.
- [ ] **Step 3: Implement provider selection**: Serie A may use existing schedule/legacy parsing internally; Coppa/UCL/UEL/UECL may use BSD helpers; all outputs pass through the canonical normalizers.
- [ ] **Step 4: Write failing Worker route test** for canonical routes:

```js
GET /api/v23.3/match-center?competition=ucl&match_id=ucl:123
GET /api/v23.3/match-center?competition=ucl&match_id=ucl:123&section=stats
```

Assert `{ok:true,data:{competition,matchId,match,...}}` for base and `{ok:true,data:{competition,matchId,section,coverage,available,data}}` for sections.
- [ ] **Step 5: Update `worker.js`** so `handleV23_3MatchCenter` delegates to the provider registry instead of branching UI-era behavior directly in the handler.
- [ ] **Step 6: Run both tests GREEN**.
- [ ] **Step 7: Commit**: `git commit -m "feat: add canonical match center providers"`.

### Task 3: Repository and client cache boundary

**Files:**
- Create: `cloudflare-test/src/v23.3/match-center-repository.mjs`
- Modify: `cloudflare-test/src/v23.3/data-client.mjs`
- Test: `cloudflare-test/test/v23-3-round39-match-center-repository.test.mjs`

**Interfaces:**
- Produces `createMatchCenterRepository({ loadBase, loadSection })` with `base(competition,matchId,{force})` and `section(competition,matchId,section,{force,status})`.

- [ ] **Step 1: Write RED tests** verifying request dedupe, force refresh, section validation, and that two callers for the same inflight resource share one promise.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement repository** over existing `loadMatchCenterBase` / `loadMatchCenterSection`; keep cache concerns here, not in the view/store.
- [ ] **Step 4: Run GREEN**.
- [ ] **Step 5: Commit**: `git commit -m "feat: isolate match center repository"`.

### Task 4: Single MatchCenterStore lifecycle

**Files:**
- Create: `cloudflare-test/src/v23.3/match-center-store.mjs`
- Test: `cloudflare-test/test/v23-3-round39-match-center-store.test.mjs`

**Interfaces:**
- Consumes repository from Task 3.
- Produces `createMatchCenterStore({repository, now, setTimer, clearTimer, documentRef})` with `open(target)`, `close()`, `setActiveTab(tab)`, `retryBase()`, `retrySection(tab)`, `subscribe(listener)`, `getState()`.

- [ ] **Step 1: Write RED lifecycle tests** for open/base reveal state, lazy section loading, stale generation ignored, A→B match switch, live polling at ~15s, polling stop on finished/close, document hidden pause.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement store** with a monotonically increasing request generation. Every async completion must compare its captured generation before mutating state.
- [ ] **Step 4: Run GREEN**.
- [ ] **Step 5: Commit**: `git commit -m "feat: add single match center store"`.

### Task 5: Standalone view and five theme definitions

**Files:**
- Create: `cloudflare-test/src/v23.3/match-center-themes.mjs`
- Create: `cloudflare-test/src/v23.3/match-center-view.mjs`
- Test: `cloudflare-test/test/v23-3-round39-match-center-view.test.mjs`
- Test: `cloudflare-test/test/v23-3-round39-match-center-themes.test.mjs`

**Interfaces:**
- Produces `matchCenterThemeFor(competition)` and `installMatchCenterView({documentRef,store})`.

- [ ] **Step 1: Write RED theme test** asserting five distinct token maps for `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`, with common required keys `mcBg`, `mcSurface`, `mcBorder`, `mcAccent`, `mcAccent2`, `mcGlow`, `mcText`, `mcMuted`.
- [ ] **Step 2: Write RED DOM ownership test** asserting the rendered root id is exactly `ciao-match-center` and output does not contain `cw232-competition__head`, legacy `matchCenterHtml` markers, `ciao-v232-matches-overlay`, or legacy back controls.
- [ ] **Step 3: Run RED**.
- [ ] **Step 4: Implement themes** according to spec: Serie A premium blue; Coppa dark red/green; UCL midnight blue/violet; UEL graphite/orange; UECL green-black.
- [ ] **Step 5: Implement view** as one standalone fixed screen. Before base data is ready it renders only a tournament-branded transition/loading surface; after base data arrives it atomically renders toolbar, competition identity, teams, score/status, tabs and section frame.
- [ ] **Step 6: Run GREEN**.
- [ ] **Step 7: Run plan-1 regression suite**:

`cd cloudflare-test && node --test test/v23-3-round39-match-center-*.test.mjs`

Expected: all PASS.
- [ ] **Step 8: Commit**: `git commit -m "feat: build canonical standalone match center"`.

## Plan 1 acceptance

- All five competition families return one canonical contract.
- One store owns network lifecycle and polling.
- One standalone view owns Match Center DOM.
- No legacy UI event/DOM is required to render a match.
- Existing public routing is not cut over yet; that is Plan 2.