# Round 17 Canonical Match Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one canonical tournament-aware Match Center open from every eligible match surface, keep only Italian-club Coppa/UEFA matches, stabilize and theme Predictions, and make Tables/Ranking labels native instead of post-render mutations.

**Architecture:** Keep the existing canonical match identity (`competition`, `matchId`) as the system boundary. Move external-match eligibility into the shared normalized feed/provider path, normalize Serie A and BSD detail responses to one Match Center snapshot contract, then route every card through one capture handler and one Match Center controller. Predictions, Tables, and Ranking become owners of their own DOM/labels/themes so Round 16 no longer mutates them after render.

**Tech Stack:** Cloudflare Workers, ES modules, Node.js `node:test`, Telegram WebApp init data, Durable Object prediction backend, BSD Football v2 provider, legacy Serie A `CIAO_WEB_API` source.

**Spec:** `docs/superpowers/specs/2026-09-03-round17-canonical-match-center-design.md`

## Global Constraints

- TEST/develop only; do not modify `main` or Production until explicit approval after TEST acceptance.
- `coppa_italia`, `ucl`, `uel`, and `uecl` must expose only matches where `isItalianTeam(homeTeam) || isItalianTeam(awayTeam)` is true.
- Reuse `cloudflare-test/src/v23.2/italian-team.mjs`; do not create a second manual club list.
- Qualification/preliminary UEFA matches remain excluded by the existing `isUefaQualificationMatch()` rules.
- Match Center has one public route: `openCanonicalMatchCenter({ competition, matchId, initialMatch? })`.
- Prediction `+`, `-`, save, locked-round, and other form controls must never trigger Match Center navigation.
- Missing optional Match Center sections must hide locally; they must not fail the whole screen.
- Prediction scoring, deadline rules, rankings formula, reset semantics, and Production bindings are out of scope.
- Preserve current canonical match IDs and provider IDs.

---

## File Structure

### New files

- `cloudflare-test/src/v23.3/match-center-snapshot.mjs` — canonical snapshot normalization for Serie A/BSD data and optional detail sections.
- `cloudflare-test/src/v23.3/match-bootstrap-cache.mjs` — tiny in-memory bootstrap registry keyed by `competition|matchId` for instant Match Center first paint.
- `cloudflare-test/test/v23-3-round17-eligibility.test.mjs` — feed and direct Match Center eligibility tests.
- `cloudflare-test/test/v23-3-round17-match-center.test.mjs` — canonical snapshot, theme, bootstrap, routing, optional sections tests.
- `cloudflare-test/test/v23-3-round17-predictions.test.mjs` — stable shell, themed cards, control propagation, keyed update tests.
- `cloudflare-test/test/v23-3-round17-native-labels.test.mjs` — first-render compact labels/full titles and Round 16 cleanup tests.

### Modified files

- `cloudflare-test/src/v23.2/match-normalizer.mjs` — make Coppa use the same Italian-team eligibility predicate as UEFA.
- `cloudflare-test/src/v23.2/bsd-provider.mjs` — expose a canonical BSD Match Center snapshot and a controlled `match_not_eligible` failure.
- `cloudflare-test/src/v23.2/competition-config.mjs` — make Coppa `shortTitle: 'КИ'`.
- `cloudflare-test/src/v23.3/data-client.mjs` — Match Center cache + in-flight dedupe with status-aware TTL.
- `cloudflare-test/src/v23.3/match-center.mjs` — single themed stable shell, details slots, bootstrap-first controller behavior.
- `cloudflare-test/src/v23.3/match-center-links.mjs` — one capture router for every canonical match card and explicit interactive-control exclusions.
- `cloudflare-test/src/v23.3/home-integration.mjs` — register/render canonical identity + bootstrap data for Home/favorite cards.
- `cloudflare-test/src/v23.2/matches-ui.mjs` — register/render canonical identity + bootstrap data for Matches cards.
- `cloudflare-test/src/v23.3/predictions-ui.mjs` — stable keyed body updates, canonical Match Center targets, tournament-native CSS variables.
- `cloudflare-test/src/v23.3/tables-ui.mjs` — emit short selector text and full content heading directly.
- `cloudflare-test/src/v23.3/ranking-ui.mjs` — emit short selector text and full content heading directly.
- `cloudflare-test/src/v23.3/round16-runtime.mjs` — remove label/routing mutations now owned by native components; keep only still-needed compatibility behavior.
- `cloudflare-test/src/worker.js` — canonical Serie A + external Match Center endpoint and controlled eligibility response.
- `cloudflare-test/src/v23.3/index.mjs` — wire any new Round 17 modules/marker.
- `cloudflare-test/scripts/probe-test-deployment-v233.mjs` — assert Round 17 live markers instead of removed Round 16 mutation behavior.

---

### Task 1: Canonical Italian-club eligibility for external competitions

**Files:**
- Modify: `cloudflare-test/src/v23.2/match-normalizer.mjs`
- Modify: `cloudflare-test/src/v23.2/bsd-provider.mjs`
- Create: `cloudflare-test/test/v23-3-round17-eligibility.test.mjs`

**Interfaces:**
- Consumes: `isItalianTeam(team)` from `v23.2/italian-team.mjs`; existing `isUefaQualificationMatch(match)`.
- Produces: `shouldIncludeMatch(match): boolean` covering Coppa + UEFA; BSD direct snapshot rejects filtered matches with `BsdUpstreamError.code === 'match_not_eligible'`.

- [ ] **Step 1: Write failing eligibility tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldIncludeMatch } from '../src/v23.2/match-normalizer.mjs';

const team = (name, countryCode='') => ({ name, countryCode });
const match = (competition, homeTeam, awayTeam, extra={}) => ({
  competition, homeTeam, awayTeam, stage:'League Stage', round:1, ...extra,
});

test('Round 17 keeps UEFA match with an Italian club', () => {
  assert.equal(shouldIncludeMatch(match('ucl', team('Интер'), team('Арсенал'))), true);
});

test('Round 17 excludes UEFA match without an Italian club', () => {
  assert.equal(shouldIncludeMatch(match('ucl', team('Барселона'), team('Арсенал'))), false);
});

test('Round 17 applies the Italian predicate to Coppa Italia too', () => {
  assert.equal(shouldIncludeMatch(match('coppa_italia', team('Ювентус'), team('Милан'))), true);
  assert.equal(shouldIncludeMatch(match('coppa_italia', team('Арсенал'), team('Барселона'))), false);
});
```

- [ ] **Step 2: Run the new eligibility file and verify RED**

Run:

```bash
cd cloudflare-test
node --test test/v23-3-round17-eligibility.test.mjs
```

Expected: Coppa non-Italian case fails because `ITALIAN_ONLY_COMPETITIONS` currently excludes `coppa_italia`.

- [ ] **Step 3: Extend the shared eligibility set, without adding a club list**

Change the existing set to:

```js
const ITALIAN_ONLY_COMPETITIONS = new Set([
  'coppa_italia',
  'ucl',
  'uel',
  'uecl',
]);
```

Keep the existing order inside `shouldIncludeMatch()`:

```js
export function shouldIncludeMatch(match) {
  getCompetitionConfig(match.competition);
  if (isUefaQualificationMatch(match)) return false;
  if (!ITALIAN_ONLY_COMPETITIONS.has(match.competition)) return true;
  return isItalianTeam(match.homeTeam) || isItalianTeam(match.awayTeam);
}
```

- [ ] **Step 4: Add a direct BSD snapshot rejection test**

Use a fake `/events/:id/` payload with `Barcelona` vs `Arsenal`, call `fetchBsdMatchSnapshot`, and assert:

```js
await assert.rejects(
  () => fetchBsdMatchSnapshot({ competition:'ucl', matchId:'ucl:99', apiKey:'test', fetchImpl }),
  error => error?.code === 'match_not_eligible',
);
```

- [ ] **Step 5: Make BSD direct resolution distinguish filtered matches**

In `fetchBsdMatchSnapshot`, after adapting the single event:

```js
const adapted = adaptBsdEvents({ results:[event] }, competition);
const match = adapted[0];
if (!match) {
  throw new BsdUpstreamError('event', 404, 'match_not_eligible');
}
if (match.matchId !== `${competition}:${sourceId}`) {
  throw new BsdUpstreamError('event', 200, 'invalid_event');
}
return match;
```

- [ ] **Step 6: Run focused tests**

```bash
node --test test/v23-3-round17-eligibility.test.mjs test/v23-2-bsd-season-resolution.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/v23.2/match-normalizer.mjs src/v23.2/bsd-provider.mjs test/v23-3-round17-eligibility.test.mjs
git commit -m "feat: enforce Italian match eligibility canonically"
```

---

### Task 2: Define one canonical Match Center snapshot contract

**Files:**
- Create: `cloudflare-test/src/v23.3/match-center-snapshot.mjs`
- Modify: `cloudflare-test/src/v23.2/bsd-provider.mjs`
- Modify: `cloudflare-test/test/v23-3-round17-match-center.test.mjs`

**Interfaces:**
- Produces: `canonicalMatchCenterSnapshot(match, details = {}): Readonly<Snapshot>`.
- Produces: `extractBsdMatchDetails(event): { events, statistics, lineups, venue }`.
- Produces: `fetchBsdMatchCenterSnapshot({ competition, matchId, apiKey, fetchImpl }): Promise<Snapshot>`.
- Snapshot always contains `competition`, `matchId`, `homeTeam`, `awayTeam`, `kickoffAt`, `status`; optional arrays/objects are omitted or normalized to empty values rather than causing failure.

- [ ] **Step 1: Write RED snapshot tests**

Create tests that pass one canonical match plus partial details:

```js
const snapshot = canonicalMatchCenterSnapshot({
  competition:'uel', matchId:'uel:42', kickoffAt:'2026-09-10T19:00:00Z', status:'scheduled',
  homeTeam:{ name:'Рома', crestUrl:'roma.png' },
  awayTeam:{ name:'Арсенал', crestUrl:'arsenal.png' },
}, {
  events:[{ type:'goal', minute:31 }],
  statistics:null,
  lineups:undefined,
  venue:'Олимпико',
});
assert.equal(snapshot.competition, 'uel');
assert.equal(snapshot.venue, 'Олимпико');
assert.deepEqual(snapshot.events, [{ type:'goal', minute:31 }]);
assert.deepEqual(snapshot.statistics, []);
assert.deepEqual(snapshot.lineups, []);
```

Also test that malformed optional sections do not throw.

- [ ] **Step 2: Verify RED**

```bash
node --test test/v23-3-round17-match-center.test.mjs
```

Expected: module/function missing.

- [ ] **Step 3: Implement the snapshot normalizer**

Use a small focused module:

```js
function list(value) { return Array.isArray(value) ? value : []; }
function text(value) { return String(value ?? '').trim(); }

export function canonicalMatchCenterSnapshot(match = {}, details = {}) {
  return Object.freeze({
    competition:text(match.competition),
    matchId:text(match.matchId),
    homeTeam:match.homeTeam || null,
    awayTeam:match.awayTeam || null,
    kickoffAt:text(match.kickoffAt),
    status:text(match.status),
    minute:match.minute ?? null,
    homeScore:match.homeScore ?? null,
    awayScore:match.awayScore ?? null,
    round:match.round ?? null,
    stage:text(match.stage),
    venue:text(details.venue || match.venue),
    events:Object.freeze(list(details.events)),
    statistics:Object.freeze(list(details.statistics)),
    lineups:Object.freeze(list(details.lineups)),
    prediction:details.prediction || null,
    predictionDeadline:text(details.predictionDeadline || match.predictionDeadline),
  });
}
```

- [ ] **Step 4: Refactor BSD event loading once, then expose detailed snapshot**

In `bsd-provider.mjs`, extract the current event resolution from `fetchBsdMatchSnapshot` into an internal `fetchBsdEvent(...)`. Keep `fetchBsdMatchSnapshot()` as a compatibility wrapper. Add:

```js
export async function fetchBsdMatchCenterSnapshot(args) {
  const event = await fetchBsdEvent(args);
  const [match] = adaptBsdEvents({ results:[event] }, args.competition);
  if (!match) throw new BsdUpstreamError('event', 404, 'match_not_eligible');
  return canonicalMatchCenterSnapshot(match, extractBsdMatchDetails(event));
}
```

`extractBsdMatchDetails()` reads only provider fields already present on the returned event and normalizes unsupported fields to `[]`.

- [ ] **Step 5: Run focused provider + snapshot tests**

```bash
node --test test/v23-3-round17-match-center.test.mjs test/v23-2-bsd-error-diagnostics.test.mjs test/v23-2-bsd-season-resolution.test.mjs
```

Expected: PASS and existing BSD provider behavior preserved.

- [ ] **Step 6: Commit**

```bash
git add src/v23.3/match-center-snapshot.mjs src/v23.2/bsd-provider.mjs test/v23-3-round17-match-center.test.mjs
git commit -m "feat: add canonical match center snapshot"
```

---

### Task 3: Make `/api/v23.3/match-center` canonical for Serie A and external competitions

**Files:**
- Modify: `cloudflare-test/src/worker.js`
- Modify: `cloudflare-test/test/v23-3-round17-match-center.test.mjs`
- Modify: `cloudflare-test/test/v23-3-round17-eligibility.test.mjs`

**Interfaces:**
- Consumes: `fetchBsdMatchCenterSnapshot(...)` from Task 2.
- Produces: `GET /api/v23.3/match-center?competition=<key>&match_id=<canonical-id>` for all five competitions.
- Error contract: `404 { ok:false, error:'match_not_eligible' }` for filtered external matches.

- [ ] **Step 1: Add worker RED tests**

Add a test that requests `competition=serie_a&match_id=serie_a:123` and expects a 200 canonical snapshot when the fake legacy schedule contains ID `123`.

Add a test that stubs BSD with a non-Italian event and expects:

```js
assert.equal(response.status, 404);
assert.deepEqual(await response.json(), {
  ok:false,
  error:'match_not_eligible',
  competition:'ucl',
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test test/v23-3-round17-match-center.test.mjs test/v23-3-round17-eligibility.test.mjs
```

Expected: Serie A returns `competition_not_supported`; filtered BSD case is not yet mapped to 404.

- [ ] **Step 3: Add a legacy Serie A snapshot loader inside Worker**

Reuse the existing authenticated `LEGACY_SERIE_A_SCHEDULE` request and `adaptSerieASchedule(payload)`. Find the canonical `matchId` and normalize it:

```js
async function loadSerieAMatchCenterSnapshot(request, env, initData, matchId) {
  const schedule = await fetchSerieAScheduleForCrests(request, env, initData);
  const match = schedule?.matches?.find(item => item.matchId === matchId) || null;
  if (!match) return null;
  return canonicalMatchCenterSnapshot(match, { venue:match.venue });
}
```

Do not introduce a second Serie A ID scheme.

- [ ] **Step 4: Branch `handleV23_3MatchCenter` by canonical competition**

Implement:

```js
if (competition === 'serie_a') {
  const snapshot = await loadSerieAMatchCenterSnapshot(request, env, initData, matchId);
  if (!snapshot) return errorJson(404, { error:'match_not_found', competition });
  return Response.json({ ok:true, data:{ competition, provider:'ciao-web-api', match:snapshot } });
}
```

For external competitions use `fetchBsdMatchCenterSnapshot`. If `BsdUpstreamError.code === 'match_not_eligible'`, return controlled 404 instead of generic 502.

- [ ] **Step 5: Run worker/API-focused tests**

```bash
node --test test/v23-3-round17-match-center.test.mjs test/v23-3-round17-eligibility.test.mjs test/v23-2-api-contract-observer.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/worker.js test/v23-3-round17-match-center.test.mjs test/v23-3-round17-eligibility.test.mjs
git commit -m "feat: make match center endpoint canonical"
```

---

### Task 4: Bootstrap cache and status-aware Match Center client cache

**Files:**
- Create: `cloudflare-test/src/v23.3/match-bootstrap-cache.mjs`
- Modify: `cloudflare-test/src/v23.3/data-client.mjs`
- Modify: `cloudflare-test/test/v23-3-round17-match-center.test.mjs`

**Interfaces:**
- Produces: `rememberMatchBootstrap(match): void`.
- Produces: `getMatchBootstrap(competition, matchId): match|null`.
- `loadMatchCenterSnapshot(competition, matchId, { force? })` gains cache/in-flight dedupe but retains its existing call signature for current callers.

- [ ] **Step 1: Write RED cache tests**

Test bootstrap storage:

```js
rememberMatchBootstrap({ competition:'ucl', matchId:'ucl:8', homeTeam:{name:'Интер'} });
assert.equal(getMatchBootstrap('ucl','ucl:8')?.homeTeam?.name, 'Интер');
```

Test two simultaneous `loadMatchCenterSnapshot('ucl','ucl:8')` calls invoke `fetchImpl` exactly once.

Test a cached scheduled match returns without a network call before TTL expiry, while `{ force:true }` refreshes.

- [ ] **Step 2: Verify RED**

```bash
node --test test/v23-3-round17-match-center.test.mjs
```

- [ ] **Step 3: Implement bootstrap registry**

Use a bounded module-level `Map` keyed by `${competition}|${matchId}`. Store only canonical match bootstrap fields and cap it at 100 entries by deleting the oldest key after insertion.

- [ ] **Step 4: Add Match Center cache/in-flight maps to `data-client.mjs`**

Implement status-aware TTL selection after the first response:

```js
function matchCenterTtl(snapshot) {
  const status = String(snapshot?.match?.status || snapshot?.status || '').toLowerCase();
  if (status === 'live') return 10_000;
  if (status === 'finished') return 5 * 60_000;
  return 60_000;
}
```

Cache key must include fetch identity + Telegram init data + request path, matching the existing standings cache isolation pattern.

- [ ] **Step 5: Run cache tests**

```bash
node --test test/v23-3-round17-match-center.test.mjs test/v23-3-data-client-cache.test.mjs
```

If `v23-3-data-client-cache.test.mjs` does not exist, run the closest existing data-client test plus the Round 17 file; do not create a duplicate generic cache test suite.

- [ ] **Step 6: Commit**

```bash
git add src/v23.3/match-bootstrap-cache.mjs src/v23.3/data-client.mjs test/v23-3-round17-match-center.test.mjs
git commit -m "perf: cache canonical match center snapshots"
```

---

### Task 5: One stable themed Match Center renderer/controller

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center.mjs`
- Modify: `cloudflare-test/test/v23-3-round17-match-center.test.mjs`

**Interfaces:**
- Public API remains `openCanonicalMatchCenter({ competition, matchId, initialMatch? })`.
- Renderer supports `data-cw233-mc-theme` and stable detail slots for `events`, `lineups`, `statistics`, `venue`, `prediction`.
- `patchMatchCenterOverlay(overlay, state)` updates an existing shell rather than replacing it when identity is unchanged.

- [ ] **Step 1: Add RED renderer tests**

Assert all themes map correctly:

```js
assert.match(renderMatchCenter({ competition:'ucl', match:{ competition:'ucl', matchId:'ucl:1' } }), /data-cw233-mc-theme="champions"/);
assert.match(renderMatchCenter({ competition:'uel', match:{ competition:'uel', matchId:'uel:1' } }), /data-cw233-mc-theme="europa"/);
assert.match(renderMatchCenter({ competition:'uecl', match:{ competition:'uecl', matchId:'uecl:1' } }), /data-cw233-mc-theme="conference"/);
assert.match(renderMatchCenter({ competition:'coppa_italia', match:{ competition:'coppa_italia', matchId:'coppa_italia:1' } }), /data-cw233-mc-theme="coppa"/);
```

Add a test with empty `events/statistics/lineups` asserting no empty section heading is rendered.

Add a controller test where `initialMatch` is present: first emitted state must contain the bootstrap match before `loadSnapshot` resolves.

- [ ] **Step 2: Verify RED**

```bash
node --test test/v23-3-round17-match-center.test.mjs
```

- [ ] **Step 3: Add one theme map and CSS custom properties**

Use:

```js
const MATCH_CENTER_THEMES = Object.freeze({
  serie_a:'serie-a',
  coppa_italia:'coppa',
  ucl:'champions',
  uel:'europa',
  uecl:'conference',
});
```

Set `data-cw233-mc-theme` on the stable shell. Define per-theme CSS variables for background, border, accent, action, and soft-card colors. Avoid separate renderer branches.

- [ ] **Step 4: Add optional details slots**

Render only non-empty sections:

```js
const section = (title, body) => body
  ? `<section class="cw233-mc-detail"><h3>${esc(title)}</h3>${body}</section>`
  : '';
```

Events, lineups, statistics, venue, and prediction each generate empty string when unavailable.

- [ ] **Step 5: Preserve DOM identity on refresh**

Extend `patchMatchCenterOverlay()` to patch toolbar/board/detail slots for the same `competition + matchId`. Only build a new shell when opening a different canonical match.

- [ ] **Step 6: Run renderer/controller tests**

```bash
node --test test/v23-3-round17-match-center.test.mjs test/v23-3-match-center*.test.mjs
```

- [ ] **Step 7: Commit**

```bash
git add src/v23.3/match-center.mjs test/v23-3-round17-match-center.test.mjs
git commit -m "feat: unify themed match center UI"
```

---

### Task 6: Route every canonical match surface through one capture handler

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-links.mjs`
- Modify: `cloudflare-test/src/v23.3/home-integration.mjs`
- Modify: `cloudflare-test/src/v23.2/matches-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/predictions-ui.mjs`
- Modify: `cloudflare-test/test/home-match-links.test.mjs`
- Modify: `cloudflare-test/test/v23-3-round17-match-center.test.mjs`
- Modify: `cloudflare-test/test/v23-3-round17-predictions.test.mjs`

**Interfaces:**
- Consumes: `rememberMatchBootstrap(match)` / `getMatchBootstrap(...)` from Task 4.
- Produces: `resolveCanonicalMatchTarget(target)` recognizing `[data-cw233-competition][data-cw233-match]` plus existing v23.2 compatibility selectors.
- Produces: one capture click handler with explicit interactive-control exclusion.

- [ ] **Step 1: Write RED route tests**

Add fixtures for Home, Matches, Predictions, favorite card, and profile card. Each must resolve to the same shape:

```js
{ competition:'ucl', matchId:'ucl:44' }
```

Add control exclusions:

```js
for (const selector of [
  '[data-cw233-delta]',
  '[data-cw233-save-all]',
  '[data-cw233-pred-nav]',
  'button', 'input', 'select', 'textarea',
]) {
  // Event originating here must not call openCanonicalMatchCenter.
}
```

- [ ] **Step 2: Verify RED**

```bash
node --test test/home-match-links.test.mjs test/v23-3-round17-match-center.test.mjs test/v23-3-round17-predictions.test.mjs
```

- [ ] **Step 3: Generalize the canonical target resolver**

Prefer the new canonical selector first:

```js
const canonical = target.closest('[data-cw233-competition][data-cw233-match]');
if (canonical) return canonicalPair(
  canonical.dataset.cw233Competition,
  canonical.dataset.cw233Match,
);
```

Retain current v23.2 profile/schedule selectors only as compatibility fallback.

- [ ] **Step 4: Add interactive-control guard before resolving a match**

```js
const INTERACTIVE_SELECTOR = [
  'button', 'input', 'select', 'textarea', 'a',
  '[data-cw233-delta]', '[data-cw233-save-all]', '[data-cw233-pred-nav]',
].join(',');
if (event?.target?.closest?.(INTERACTIVE_SELECTOR)) return;
```

Do not stop propagation for ignored controls.

- [ ] **Step 5: Register bootstrap objects while each surface renders**

For every visible canonical card call `rememberMatchBootstrap(match)` before/while generating its HTML and emit:

```html
data-cw233-competition="ucl" data-cw233-match="ucl:44"
```

The router retrieves `initialMatch = getMatchBootstrap(competition, matchId)` and calls:

```js
void open({ competition, matchId, initialMatch });
```

- [ ] **Step 6: Run focused routing tests**

```bash
node --test test/home-match-links.test.mjs test/v23-3-round17-match-center.test.mjs test/v23-3-round17-predictions.test.mjs
```

Expected: all surfaces route canonically; controls do not route.

- [ ] **Step 7: Commit**

```bash
git add src/v23.3/match-center-links.mjs src/v23.3/home-integration.mjs src/v23.2/matches-ui.mjs src/v23.3/predictions-ui.mjs test/home-match-links.test.mjs test/v23-3-round17-match-center.test.mjs test/v23-3-round17-predictions.test.mjs
git commit -m "feat: route all match cards to canonical center"
```

---

### Task 7: Stabilize Predictions and theme cards/controls natively

**Files:**
- Modify: `cloudflare-test/src/v23.3/predictions-ui.mjs`
- Create: `cloudflare-test/test/v23-3-round17-predictions.test.mjs`

**Interfaces:**
- Keeps `.cw233-prediction-page` identity stable while active.
- Uses `data-cw233-pred-theme` with values `serie-a`, `coppa`, `champions`, `europa`, `conference`.
- Produces keyed card patch helper `patchPredictionMatchList(container, nextMatches, { mode, competition }): boolean`.

- [ ] **Step 1: Write RED stable-shell tests**

Use a fake DOM or existing project DOM harness to assert:

1. First open creates one `.cw233-prediction-page`.
2. Switching `activeFilter` does not replace that page node.
3. Updating one score calls `updatePredictionCard` and leaves sibling card identities unchanged.
4. Cached switch does not show `.cw233-prediction-loading` between two already-loaded competitions.

- [ ] **Step 2: Write RED theme tests**

Assert direct source/render contract for each competition:

```js
assert.equal(predictionThemeFor('serie_a'), 'serie-a');
assert.equal(predictionThemeFor('coppa_italia'), 'coppa');
assert.equal(predictionThemeFor('ucl'), 'champions');
assert.equal(predictionThemeFor('uel'), 'europa');
assert.equal(predictionThemeFor('uecl'), 'conference');
```

And assert theme variables style `.match`, `[data-cw233-delta]`, `.score-value`, `.cw233-pred-nav button[aria-selected="true"]`, and `[data-cw233-save-all]`.

- [ ] **Step 3: Verify RED**

```bash
node --test test/v23-3-round17-predictions.test.mjs
```

- [ ] **Step 4: Stop replacing Prediction body for same keyed list**

Keep the existing permanent shell. Replace broad `setHtmlIfChanged(body, bodyHtml)` for make-mode match lists with keyed reconciliation:

```js
export function patchPredictionMatchList(container, nextMatches, options) {
  const existing = new Map(
    [...container.querySelectorAll('[data-cw233-pred-card]')]
      .map(node => [node.dataset.cw233PredCard, node]),
  );
  // Reuse/move existing nodes by matchId; create only missing cards; remove stale cards.
}
```

For stage/round navigation, patch button selected/locked state rather than replacing the navigation node when group keys are unchanged.

- [ ] **Step 5: Keep cold loading at final geometry**

Render six fixed-height skeleton match cards only when there is no bootstrap/cache. Never clear existing matches to display skeleton during background refresh.

- [ ] **Step 6: Apply tournament theme from `predictions-ui.mjs` itself**

Set:

```js
page.dataset.cw233PredTheme = predictionThemeFor(activeFilter);
```

Add one CSS variable table in the Prediction-owned style block. Use variables in card border/background, active filters, round button, score controls, score value, dirty/saved accents, and save button.

- [ ] **Step 7: Preserve scroll and focus**

Before keyed reconciliation record active element and round-nav `scrollLeft`; restore only if the same node still exists. Do not call `scrollIntoView()`.

- [ ] **Step 8: Run Prediction tests**

```bash
node --test test/v23-3-round17-predictions.test.mjs test/v23-3-user-feedback-round11.test.mjs test/v23-3-user-feedback-round12.test.mjs test/v23-3-user-feedback-round13.test.mjs
```

Expected: PASS; no old performance regression reintroduced.

- [ ] **Step 9: Commit**

```bash
git add src/v23.3/predictions-ui.mjs test/v23-3-round17-predictions.test.mjs
git commit -m "perf: stabilize and theme predictions natively"
```

---

### Task 8: Make Tables/Ranking compact labels native and remove Round 16 mutations

**Files:**
- Modify: `cloudflare-test/src/v23.2/competition-config.mjs`
- Modify: `cloudflare-test/src/v23.3/tables-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/ranking-ui.mjs`
- Modify: `cloudflare-test/src/v23.3/round16-runtime.mjs`
- Create: `cloudflare-test/test/v23-3-round17-native-labels.test.mjs`

**Interfaces:**
- Tables selector labels: `Серия А`, `ЛЧ`, `ЛЕ`, `ЛК`, `КИ`.
- Ranking selector labels: `Общий`, `Серия А`, `КИ`, `ЛЧ`, `ЛЕ`, `ЛК`.
- Content headings use full competition titles.

- [ ] **Step 1: Write RED native-label tests**

```js
const tables = renderTablesHub({ selectedCompetition:'ucl', data:{ rows:[] } });
assert.match(tables, />ЛЧ<\/button>/);
assert.match(tables, /<p>Лига Чемпионов<\/p>/);
assert.doesNotMatch(tables, />Лига Чемпионов<\/button>/);

assert.equal(RANKING_FILTERS.find(x => x.key === 'coppa_italia')?.label, 'КИ');
assert.equal(rankingSectionTitle('coppa_italia'), 'Кубок Италии');
```

Also read `round16-runtime.mjs` as source and assert it no longer contains `patchTableLabels` or `patchRanking`.

- [ ] **Step 2: Verify RED**

```bash
node --test test/v23-3-round17-native-labels.test.mjs
```

- [ ] **Step 3: Make Coppa config short title canonical**

In `competition-config.mjs`:

```js
coppa_italia: Object.freeze({
  key:'coppa_italia',
  title:'Кубок Италии',
  shortTitle:'КИ',
  theme:'coppa',
  navigation:'stages',
  european:false,
}),
```

- [ ] **Step 4: Tables emits short label directly**

In `renderSelectors()` use `config.shortTitle || config.title`. Keep `renderTablesHub()` heading based on `config.title`; for Coppa use `Кубок Италии` as the heading, not `Сетка плей-офф`.

- [ ] **Step 5: Ranking stores short label and full title separately**

Set:

```js
export const RANKING_FILTERS = Object.freeze([
  { key:'overall', label:'Общий', title:'Общий рейтинг' },
  { key:'serie_a', label:'Серия А', title:'Серия А' },
  { key:'coppa_italia', label:'КИ', title:'Кубок Италии' },
  { key:'ucl', label:'ЛЧ', title:'Лига Чемпионов' },
  { key:'uel', label:'ЛЕ', title:'Лига Европы' },
  { key:'uecl', label:'ЛК', title:'Лига Конференций' },
]);
```

`rankingHtml()` reads `.title` for the section heading.

- [ ] **Step 6: Remove duplicate Round 16 label mutation**

Delete `patchTableLabels`, `patchRanking`, and their calls from `round16-runtime.mjs`. Keep only Round 16 behavior still required for back/overlay/profile compatibility and covered by existing tests.

- [ ] **Step 7: Run focused tests**

```bash
node --test test/v23-3-round17-native-labels.test.mjs test/v23-3-user-feedback-round16.test.mjs test/v23-2-competition-config.test.mjs
```

Expected: PASS after updating Round 16 tests to assert native ownership rather than post-render mutation.

- [ ] **Step 8: Commit**

```bash
git add src/v23.2/competition-config.mjs src/v23.3/tables-ui.mjs src/v23.3/ranking-ui.mjs src/v23.3/round16-runtime.mjs test/v23-3-round17-native-labels.test.mjs test/v23-3-user-feedback-round16.test.mjs
git commit -m "refactor: make tournament labels native"
```

---

### Task 9: Remove separate Serie A user-facing Match Center routing and wire Round 17 marker

**Files:**
- Modify: `cloudflare-test/src/v23.3/serie-a-legacy-bridge.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center-links.mjs`
- Modify: `cloudflare-test/src/v23.3/index.mjs`
- Modify: `cloudflare-test/test/v23-3-round17-match-center.test.mjs`

**Interfaces:**
- User-facing match taps for Serie A and external competitions all call `openCanonicalMatchCenter`.
- Legacy bridge can remain for unrelated Serie A page compatibility but must not intercept canonical match-card navigation.

- [ ] **Step 1: Add RED route-ownership test**

Read the legacy bridge source and assert no click handler delegates a Serie A canonical match card to a separate legacy match-detail path. Assert `index.mjs` exposes `round17CanonicalMatchCenter: 'enabled'`.

- [ ] **Step 2: Verify RED**

```bash
node --test test/v23-3-round17-match-center.test.mjs
```

- [ ] **Step 3: Remove only the legacy match-detail interception**

Keep back/header compatibility needed for the Serie A page, but canonical match cards must fall through to `match-center-links.mjs`.

- [ ] **Step 4: Add the Round 17 marker**

In `index.mjs` add the new module import if required and:

```js
round17CanonicalMatchCenter: 'enabled',
```

- [ ] **Step 5: Run Match Center + Serie A regression tests**

```bash
node --test test/v23-3-round17-match-center.test.mjs test/v23-3-user-feedback-round7.test.mjs test/v23-3-user-feedback-round9.test.mjs
```

- [ ] **Step 6: Commit**

```bash
git add src/v23.3/serie-a-legacy-bridge.mjs src/v23.3/match-center-links.mjs src/v23.3/index.mjs test/v23-3-round17-match-center.test.mjs
git commit -m "refactor: route Serie A through canonical match center"
```

---

### Task 10: Full regression, TEST contract probes, and deployment acceptance

**Files:**
- Modify: `cloudflare-test/scripts/probe-test-deployment-v233.mjs`
- Modify only if required by genuine contract changes: existing probe tests under `cloudflare-test/test/`

**Interfaces:**
- Live TEST probe proves Round 17 marker is deployed and removed Round 16 mutation strings are no longer required.

- [ ] **Step 1: Update deployed TEST marker assertions**

Probe the served app/module bundle for `round17CanonicalMatchCenter` and at least one native Round 17 marker from Match Center/Predictions. Remove assertions that require `patchTableLabels`/`patchRanking` or other deleted runtime mutation behavior.

- [ ] **Step 2: Run the complete local test suite**

```bash
cd cloudflare-test
npm test
```

Expected: `0 fail`. Record the exact pass count in the PR description; do not reuse an older count.

- [ ] **Step 3: Build TEST artifact**

```bash
npm run build
```

Expected: successful build.

- [ ] **Step 4: Validate Worker bundle**

```bash
npx wrangler deploy --dry-run
```

Expected: successful dry-run with no binding/config errors.

- [ ] **Step 5: Run contract probes**

```bash
npm run inspect:api-contract
node scripts/probe-prediction-contract.mjs
node scripts/probe-reset-contract.mjs
node scripts/probe-bsd-provider.mjs
```

Expected: all exit 0.

- [ ] **Step 6: Review scoped diff before merge**

```bash
git diff --stat develop...HEAD
git diff develop...HEAD -- cloudflare-test/src cloudflare-test/test cloudflare-test/scripts docs/superpowers
```

Reject unrelated Production/main/reset changes. Verify no secrets, tokens, or provider payload dumps are committed.

- [ ] **Step 7: Push PR and wait for exact-head CI + Cloudflare TEST deployment**

Do not merge based on an older SHA. Verify CI and Cloudflare both reference the current PR head.

- [ ] **Step 8: Mobile TEST acceptance**

Check in Telegram WebView:

1. Home Italian UEFA/Coppa match → canonical Match Center.
2. Matches Italian UEFA/Coppa match → same Match Center.
3. Predictions match body → same Match Center; `+/-` remain editing controls.
4. Serie A match → same canonical Match Center UI path.
5. Match Center colors: Serie A blue, Coppa red/green, UCL blue/violet, UEL orange/dark, UECL green/dark.
6. No non-Italian UEFA/Coppa match appears on Home/Matches/Predictions.
7. Predictions switch tournament/mode/round without visible page jump.
8. Tables first-render selectors are `Серия А · ЛЧ · ЛЕ · ЛК · КИ`; content title is full.
9. Ranking first-render selectors are `Общий · Серия А · КИ · ЛЧ · ЛЕ · ЛК`; content title is full.

- [ ] **Step 9: Merge to `develop` only after TEST acceptance**

Use the verified head SHA. Do not merge to `main` and do not switch Production.

- [ ] **Step 10: Post-merge verification**

Wait for `develop` push CI and live deployed TEST probes. If a probe fails, inspect whether the probe is stale before changing runtime, as established in earlier rounds.

- [ ] **Step 11: Commit probe changes if not already included**

```bash
git add scripts/probe-test-deployment-v233.mjs test
git commit -m "test: verify Round 17 TEST deployment"
```

---

## Self-Review

### Spec coverage

- Canonical Italian-only feed rule: Task 1 + Task 3.
- Direct Match Center eligibility protection: Task 1 + Task 3.
- One snapshot contract for Serie A/BSD: Task 2 + Task 3.
- One themed Match Center renderer: Task 5.
- Bootstrap-first/cached Match Center: Task 4 + Task 5.
- Match Center from every surface: Task 6 + Task 9.
- Prediction controls excluded from routing: Task 6.
- Stable Predictions and tournament card/control themes: Task 7.
- Native Tables/Ranking short labels and full headings: Task 8.
- Round 16 mutation cleanup: Task 8.
- TEST-only verification and no Production switch: Task 10.

### Placeholder scan

No `TODO`, `TBD`, “implement later”, unspecified validation, or “similar to” placeholders remain. Optional provider details are explicitly normalized to empty sections when unavailable.

### Interface consistency

- Public Match Center call remains `openCanonicalMatchCenter({ competition, matchId, initialMatch? })` throughout Tasks 4–9.
- Canonical identity stays `competition + matchId`; no alternate Serie A or BSD ID format is introduced.
- Bootstrap registry and data-client cache use the same canonical pair.
- Tables/Ranking use short selector labels but full titles from the owning components, so Round 16 no longer owns text mutation.
