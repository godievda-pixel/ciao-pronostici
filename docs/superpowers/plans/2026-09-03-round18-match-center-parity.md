# Round 18 Full Match Center Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium five-tab v23.3 Match Center with legacy Serie A functional parity for Serie A, Coppa Italia, Champions League, Europa League, and Conference League, while keeping Serie A on the proven legacy route until parity and visual TEST approval.

**Architecture:** Extend the current canonical Match Center from a flat snapshot into independently loadable canonical sections (`overview`, `stats`, `events`, `lineups`, `players`). Provider adapters normalize Serie A legacy data and BSD data into the same contract; the UI owns one stable shell and five tournament skins, lazy-loads sections, and refreshes only the active LIVE section. Serie A routing remains delegated to legacy behind an explicit parity gate until final visual approval.

**Tech Stack:** Cloudflare Workers, ES modules, Node.js `node:test`, existing v23.2 BSD provider, existing v23.3 Match Center/data client, legacy v21.5.4 Serie A Match Center source/build patches.

**Spec:** `docs/superpowers/specs/2026-09-03-round18-match-center-parity-design.md`

## Global Constraints

- Production `main` is not modified.
- Implementation and validation remain under `cloudflare-test` until explicitly approved.
- Serie A must continue to use the proven legacy Match Center until both automated parity and Telegram TEST visual review pass.
- Coppa Italia and UEFA feeds contain only configured matches involving Italian clubs.
- Never fabricate missing provider data.
- Keep one Match Center geometry for all five competitions; only the tournament skin changes.
- Do not replace the entire Match Center shell during tab changes or LIVE refreshes.
- Every implementation task follows RED → GREEN and ends with a reviewable commit.

---

### Task 1: Canonical section contract and coverage

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-snapshot.mjs`
- Create: `cloudflare-test/src/v23.3/match-center-sections.mjs`
- Create: `cloudflare-test/test/v23-3-round18-match-center-contract.test.mjs`

**Interfaces:**
- Produces: `canonicalCoverage(input) -> frozen coverage object`
- Produces: `canonicalMatchCenterBase(match, coverage) -> frozen base snapshot`
- Produces: `canonicalOverviewSection(input)`, `canonicalStatsSection(input)`, `canonicalEventsSection(input)`, `canonicalLineupsSection(input)`, `canonicalPlayersSection(input)`
- Existing `canonicalMatchCenterSnapshot()` remains backward-compatible during migration.

- [ ] **Step 1: Write failing coverage/base contract tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalCoverage,
  canonicalMatchCenterBase,
} from '../src/v23.3/match-center-sections.mjs';

test('Round 18 exposes explicit section coverage', () => {
  assert.deepEqual(canonicalCoverage({ stats:true, events:false }), {
    overview:false,
    stats:true,
    events:false,
    lineups:false,
    players:false,
    momentum:false,
    shotmap:false,
  });
});

test('Round 18 base snapshot carries stable match identity and coverage', () => {
  const base = canonicalMatchCenterBase({
    competition:'ucl',
    matchId:'ucl:77',
    status:'live',
    homeTeam:{ name:'Интер' },
    awayTeam:{ name:'Арсенал' },
  }, { overview:true, stats:true });
  assert.equal(base.matchId, 'ucl:77');
  assert.equal(base.coverage.overview, true);
  assert.equal(base.coverage.players, false);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
cd cloudflare-test
node --test test/v23-3-round18-match-center-contract.test.mjs
```

Expected: FAIL because `match-center-sections.mjs` does not exist.

- [ ] **Step 3: Implement canonical section normalizers**

Create focused normalizers with defensive `text()`, `list()`, numeric normalization, frozen return values, and explicit coverage defaults. Do not infer coverage only from array length.

- [ ] **Step 4: Add normalization tests for all five sections**

Tests must prove:

```js
canonicalOverviewSection({ venue:{ name:'San Siro', city:'Milano', capacity:75817 } });
canonicalStatsSection({ home:{ xg:1.4 }, away:{ xg:0.8 } });
canonicalEventsSection([{ type:'goal', minute:23, side:'home' }]);
canonicalLineupsSection({ home:{ formation:'3-5-2', starters:[] }, away:{} });
canonicalPlayersSection([{ playerId:9, rating:7.8, goals:1 }]);
```

- [ ] **Step 5: Run focused and full tests**

```bash
node --test test/v23-3-round18-match-center-contract.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/v23.3/match-center-snapshot.mjs src/v23.3/match-center-sections.mjs test/v23-3-round18-match-center-contract.test.mjs
git commit -m "feat: add Round 18 Match Center section contract"
```

---

### Task 2: Expand BSD detail adapter into canonical sections

**Files:**
- Modify: `cloudflare-test/src/v23.2/bsd-provider.mjs`
- Create: `cloudflare-test/src/v23.3/bsd-match-center-adapter.mjs`
- Create: `cloudflare-test/test/v23-3-round18-bsd-match-center-sections.test.mjs`

**Interfaces:**
- Consumes: canonical section normalizers from Task 1.
- Produces: `extractBsdCoverage(event) -> coverage`
- Produces: `adaptBsdMatchCenterSections(event) -> { coverage, overview, stats, events, lineups, players }`
- Produces/updates: `fetchBsdMatchCenterBase(args)` and `fetchBsdMatchCenterSection({ competition, matchId, section, apiKey, fetchImpl })`

- [ ] **Step 1: Write failing BSD adapter tests**

Test a representative event payload that includes nested stats, incidents, lineups, player stats, venue/referee, momentum, and shot map. Assert canonical keys and coverage flags.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-3-round18-bsd-match-center-sections.test.mjs
```

Expected: FAIL due to missing adapter exports.

- [ ] **Step 3: Implement provider-field extraction without fabricating data**

Normalize known aliases only. Unknown/missing provider fields remain absent and set coverage false.

- [ ] **Step 4: Split base and section fetch paths**

Reuse the existing BSD event resolution and eligibility checks. Avoid repeating league/season/event discovery when a resolved event is already available in the same request path.

- [ ] **Step 5: Prove Italian eligibility remains enforced**

Add a test where `Barcelona — Arsenal` returns `match_not_eligible`, while `Inter — Arsenal` is accepted.

- [ ] **Step 6: Run focused/full tests and commit**

```bash
node --test test/v23-3-round18-bsd-match-center-sections.test.mjs
npm test
git add src/v23.2/bsd-provider.mjs src/v23.3/bsd-match-center-adapter.mjs test/v23-3-round18-bsd-match-center-sections.test.mjs
git commit -m "feat: adapt BSD Match Center detail sections"
```

---

### Task 3: Section-aware Match Center API

**Files:**
- Modify: `cloudflare-test/src/worker.js`
- Modify: `cloudflare-test/src/v23.3/match-center-snapshot.mjs`
- Create: `cloudflare-test/test/v23-3-round18-match-center-api.test.mjs`

**Interfaces:**
- `GET /api/v23.3/match-center?competition=<c>&match_id=<id>` returns the fast base snapshot plus coverage.
- `GET /api/v23.3/match-center?competition=<c>&match_id=<id>&section=<overview|stats|events|lineups|players>` returns `{ matchId, competition, section, coverage, data }`.
- Existing callers without `section` remain valid.

- [ ] **Step 1: Write worker RED tests for base and section responses**

Verify base request does not require all detail sections and section request returns one canonical section.

- [ ] **Step 2: Write RED for section-local provider failure**

A failed `stats` detail must return a section-local error response without invalidating the base Match Center endpoint.

- [ ] **Step 3: Implement query validation and section dispatch**

Allow only the five public sections. Invalid section → HTTP 400 `invalid_match_center_section`.

- [ ] **Step 4: Preserve controlled eligibility errors**

Direct non-eligible external match → HTTP 404 `match_not_eligible`.

- [ ] **Step 5: Run worker tests/full tests and commit**

```bash
node --test test/v23-3-round18-match-center-api.test.mjs
npm test
git add src/worker.js src/v23.3/match-center-snapshot.mjs test/v23-3-round18-match-center-api.test.mjs
git commit -m "feat: add section-aware Match Center API"
```

---

### Task 4: Independent section cache, in-flight dedupe, and TTLs

**Files:**
- Modify: `cloudflare-test/src/v23.3/data-client.mjs`
- Create: `cloudflare-test/src/v23.3/match-center-section-cache.mjs`
- Create: `cloudflare-test/test/v23-3-round18-match-center-cache.test.mjs`

**Interfaces:**
- Produces: `loadMatchCenterBase(competition, matchId, options)`
- Produces: `loadMatchCenterSection(competition, matchId, section, options)`
- Cache key: `competition + matchId + section`
- Same in-flight section request must share one promise.

- [ ] **Step 1: RED tests for cache key isolation**

Prove `ucl:77/stats` and `ucl:77/events` do not overwrite each other.

- [ ] **Step 2: RED test for in-flight dedupe**

Two simultaneous `stats` requests call fetch once.

- [ ] **Step 3: RED test for status-aware TTL**

LIVE data expires before finished data.

- [ ] **Step 4: Implement bounded section cache**

Use an upper bound so repeated navigation cannot grow memory indefinitely.

- [ ] **Step 5: Run tests and commit**

```bash
node --test test/v23-3-round18-match-center-cache.test.mjs
npm test
git add src/v23.3/data-client.mjs src/v23.3/match-center-section-cache.mjs test/v23-3-round18-match-center-cache.test.mjs
git commit -m "perf: cache Match Center sections independently"
```

---

### Task 5: Stable five-tab premium Match Center shell and tournament skins

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-core.mjs`
- Create: `cloudflare-test/src/v23.3/match-center-theme.mjs`
- Create: `cloudflare-test/test/v23-3-round18-match-center-shell.test.mjs`

**Interfaces:**
- Produces: `MATCH_CENTER_TABS = ['overview','stats','events','lineups','players']`
- Produces: `matchCenterTheme(competition)` with CSS-variable palette.
- Match Center controller state gains `activeTab`, `sections`, and `sectionState` without removing legacy-compatible public open/close behavior.

- [ ] **Step 1: RED tests for the five fixed tabs**

Assert Russian labels `Обзор`, `Статистика`, `События`, `Составы`, `Игроки` exist for all competitions.

- [ ] **Step 2: RED tests for five distinct tournament themes**

Assert Serie A, Coppa, UCL, UEL, UECL produce different root theme keys and accent variables.

- [ ] **Step 3: Implement one persistent shell**

The hero, toolbar, competition label, and tabs are created once. A tab switch updates only active state and the detail slot.

- [ ] **Step 4: Implement stable loading/empty/error frames**

Keep fixed minimum geometry so changing from loading to content does not collapse the page.

- [ ] **Step 5: Run tests and commit**

```bash
node --test test/v23-3-round18-match-center-shell.test.mjs
npm test
git add src/v23.3/match-center-core.mjs src/v23.3/match-center-theme.mjs test/v23-3-round18-match-center-shell.test.mjs
git commit -m "feat: add premium five-tab Match Center shell"
```

---

### Task 6: Overview parity renderer

**Files:**
- Create: `cloudflare-test/src/v23.3/match-center-overview.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center-core.mjs`
- Create: `cloudflare-test/test/v23-3-round18-match-center-overview.test.mjs`

**Interfaces:**
- Produces: `renderMatchCenterOverview(section, context) -> html`
- Supports form, venue/city/capacity, referee, user prediction, prediction split, momentum, shotmap.

- [ ] **Step 1: RED tests for legacy overview parity markers**

Assert output has explicit regions for form, match info, predictions, momentum, and shot map when covered.

- [ ] **Step 2: RED tests for unavailable optional blocks**

Momentum/shotmap missing must not create fake charts.

- [ ] **Step 3: Implement overview renderer with tournament CSS variables**

Do not hardcode Serie A blue inside renderer; consume theme variables from the shell.

- [ ] **Step 4: Wire lazy overview load on open**

Hero is visible immediately; overview request starts after shell open.

- [ ] **Step 5: Run tests and commit**

```bash
node --test test/v23-3-round18-match-center-overview.test.mjs
npm test
git add src/v23.3/match-center-overview.mjs src/v23.3/match-center-core.mjs test/v23-3-round18-match-center-overview.test.mjs
git commit -m "feat: restore Match Center overview parity"
```

---

### Task 7: Statistics and events parity renderers

**Files:**
- Create: `cloudflare-test/src/v23.3/match-center-stats.mjs`
- Create: `cloudflare-test/src/v23.3/match-center-events.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center-core.mjs`
- Create: `cloudflare-test/test/v23-3-round18-match-center-stats-events.test.mjs`

**Interfaces:**
- `renderMatchCenterStats(section, context)`
- `renderMatchCenterEvents(section, context)`

- [ ] **Step 1: RED tests for all required statistics keys**

Test xG, possession, shots, shots on target, big chances, corners, fouls, offsides, cards, saves, pass accuracy, interceptions, tackles.

- [ ] **Step 2: RED tests for event chronology**

Test ordering by minute/added time, home/away placement, goals with score, assists, cards, substitutions, VAR, periods.

- [ ] **Step 3: Implement renderers using tournament accent variables**

Stats bars and event timeline inherit the active competition theme.

- [ ] **Step 4: Implement section-local retry/error state**

A stats failure must not replace hero/events/etc.

- [ ] **Step 5: Run tests and commit**

```bash
node --test test/v23-3-round18-match-center-stats-events.test.mjs
npm test
git add src/v23.3/match-center-stats.mjs src/v23.3/match-center-events.mjs src/v23.3/match-center-core.mjs test/v23-3-round18-match-center-stats-events.test.mjs
git commit -m "feat: restore Match Center stats and events parity"
```

---

### Task 8: Lineups and players parity renderers

**Files:**
- Create: `cloudflare-test/src/v23.3/match-center-lineups.mjs`
- Create: `cloudflare-test/src/v23.3/match-center-players.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center-core.mjs`
- Create: `cloudflare-test/test/v23-3-round18-match-center-lineups-players.test.mjs`

**Interfaces:**
- `renderMatchCenterLineups(section, context)`
- `renderMatchCenterPlayers(section, context)`

- [ ] **Step 1: RED tests for formation/starter/substitute normalization**

Prove `3-5-2`, `4-3-3`, and fallback positional grouping render without losing starters.

- [ ] **Step 2: RED tests for player ratings and metrics**

Verify rating, minutes, goals, assists, xG, xA, shots, key passes.

- [ ] **Step 3: Implement tactical pitch and substitutes**

Keep responsive mobile geometry and tournament accents.

- [ ] **Step 4: Implement players list and unavailable state**

No provider ratings → stable `Оценки игроков пока недоступны`, not an empty screen.

- [ ] **Step 5: Run tests and commit**

```bash
node --test test/v23-3-round18-match-center-lineups-players.test.mjs
npm test
git add src/v23.3/match-center-lineups.mjs src/v23.3/match-center-players.mjs src/v23.3/match-center-core.mjs test/v23-3-round18-match-center-lineups-players.test.mjs
git commit -m "feat: restore Match Center lineups and players parity"
```

---

### Task 9: LIVE reconciliation and Serie A parity adapter/gate

**Files:**
- Create: `cloudflare-test/src/v23.3/serie-a-match-center-adapter.mjs`
- Create: `cloudflare-test/src/v23.3/match-center-parity.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center-core.mjs`
- Modify: `cloudflare-test/src/v23.3/serie-a-legacy-bridge.mjs` only to expose/read data safely; do not switch routing.
- Create: `cloudflare-test/test/v23-3-round18-serie-a-parity.test.mjs`
- Create: `cloudflare-test/test/v23-3-round18-match-center-live.test.mjs`

**Interfaces:**
- Produces: `adaptSerieALegacyMatchCenter(raw) -> canonical base + sections`
- Produces: `evaluateSerieAParity(legacyFixture, canonicalFixture) -> { passed, missing[] }`
- LIVE controller refreshes `base + activeTab` only.

- [ ] **Step 1: RED test using a rich Serie A parity fixture**

Fixture must include all five tabs plus momentum/shotmap and predictions. Assert missing legacy blocks fail the gate.

- [ ] **Step 2: Implement Serie A adapter from existing legacy data semantics**

Map legacy `overview_meta`, `stats.stats`, `incidents.incidents`, `lineups.lineups`, `player_stats.player_stats`, prediction split, momentum, and shot map into the canonical section contract.

- [ ] **Step 3: Implement parity evaluator**

The evaluator explicitly checks hero, form, match info, predictions, momentum, shotmap, stats, events, lineups, players, and navigation/LIVE capability markers.

- [ ] **Step 4: RED/GREEN LIVE update test**

Verify a live tick refreshes only the active section and hero status without replacing the root shell node.

- [ ] **Step 5: Keep Serie A routing delegated to legacy**

Add a source-level regression assertion that `delegateSerieA()` remains active and no build patch rewrites legacy `openMatchCenter()` to v23.3.

- [ ] **Step 6: Run tests and commit**

```bash
node --test test/v23-3-round18-serie-a-parity.test.mjs test/v23-3-round18-match-center-live.test.mjs
npm test
git add src/v23.3/serie-a-match-center-adapter.mjs src/v23.3/match-center-parity.mjs src/v23.3/match-center-core.mjs src/v23.3/serie-a-legacy-bridge.mjs test/v23-3-round18-serie-a-parity.test.mjs test/v23-3-round18-match-center-live.test.mjs
git commit -m "feat: add Serie A Match Center parity gate"
```

---

### Task 10: Full TEST verification without switching Serie A

**Files:**
- Modify if required: `cloudflare-test/scripts/probe-test-deployment-v233.mjs`
- Create: `cloudflare-test/scripts/probe-round18-match-center.mjs`
- Modify: `.github/workflows/ciao-test-check.yml` only if necessary to run the new non-destructive probe.
- Test: existing full suite plus Round 18 tests.

**Interfaces:**
- Probe verifies module/build markers and safe public Match Center contract.
- Probe does not submit predictions, reset data, or mutate Production.

- [ ] **Step 1: Add RED deployment-contract probe test/marker**

Require Round 18 shell, five tabs, section contract marker, and explicit `serie_a_legacy_parity_gate` marker.

- [ ] **Step 2: Run complete local/CI verification commands**

```bash
cd cloudflare-test
npm test
npm run build
npx wrangler deploy --dry-run
npm run inspect:api-contract
node scripts/probe-prediction-contract.mjs
node scripts/probe-reset-contract.mjs
node scripts/probe-bsd-provider.mjs
```

Expected: all green; reset stays non-destructive/blocked as designed.

- [ ] **Step 3: Open a draft PR to `develop` and wait for Cloudflare TEST deployment**

Do not merge while visual review is pending.

- [ ] **Step 4: Run deployed TEST probes**

Verify Coppa/UCL/UEL/UECL Match Centers load the five-tab shell and section requests without exposing non-Italian-only fixtures.

- [ ] **Step 5: Telegram visual review gate**

Manually verify representative Italian-club matches in:

- Coppa Italia
- Champions League
- Europa League
- Conference League

Check all five tabs, tournament skin, loading stability, back behavior, and repeated-open cache behavior.

- [ ] **Step 6: Serie A parity review in shadow mode**

Use parity fixtures/diagnostics to compare legacy and canonical output, but keep the actual Serie A user route on legacy.

- [ ] **Step 7: Stop for explicit user approval before any Serie A route switch**

No commit may replace `delegateSerieA()` until the user explicitly approves the new Serie A Match Center after visual TEST review.

- [ ] **Step 8: Merge Round 18 to `develop` only after all non-Serie-A work is approved**

Then run post-merge GitHub CI + exact merge-SHA Cloudflare TEST deployment + deployed probes. `main` and Production remain untouched.

---

## Self-review

### Spec coverage

- Five functional tabs: Tasks 5–8.
- Overview/form/venue/referee/predictions/momentum/shotmap: Task 6.
- Full statistics: Task 7.
- Chronological events: Task 7.
- Formation/pitch/substitutes: Task 8.
- Player ratings/metrics: Task 8.
- Five tournament skins: Task 5.
- Explicit coverage and no fabricated data: Tasks 1–3.
- Lazy section loading/cache/in-flight dedupe: Tasks 3–5.
- LIVE active-section updates without root rerender: Task 9.
- Italian-club eligibility: Tasks 2–3 and Task 10 probes.
- Legacy Serie A safety gate: Tasks 9–10.
- Visual Telegram gate before Serie A migration: Task 10.

### Placeholder scan

No TODO/TBD/implement-later placeholders are permitted. Missing provider capabilities are represented by explicit coverage false/unavailable states, not deferred implementation placeholders.

### Type consistency

The plan uses the same canonical section names everywhere: `overview`, `stats`, `events`, `lineups`, `players`; the same coverage keys additionally include `momentum` and `shotmap`; cache/API/UI keys all use `competition + matchId + section`.
