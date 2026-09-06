# Canonical Legacy Match Center Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production v23.1 `.mc-*` Match Center the single active Match Center in TEST for Serie A, Coppa Italia, Champions League, Europa League, and Conference League, with one click owner and tournament-specific themes/data adapters only.

**Architecture:** Keep the v23.1 legacy `openMatchCenter` / `matchCenterHtml` / `bindMatchCenter` runtime embedded in the fetched base HTML as the only visible Match Center runtime. `match-center-links.mjs` becomes the only click router; it normalizes all supported card shapes and calls `match-center.mjs`, which delegates Serie A to the existing v23.1 `openMatchCenter` event bridge and converts external competition data through `toSerieALegacyMatchCenterData()` before dispatching the existing external legacy event. Remove the Round51.2 bottom-drawer path and, after dependency proof, delete inactive secondary visual runtime files without touching worker-side canonical provider/contract modules that still serve `/api/v23.3/match-center`.

**Tech Stack:** JavaScript ES modules, Node.js `node:test`, Cloudflare Workers/Static Assets, source-patching of v23.1 base HTML, existing BSD and Ciao Web API providers.

**Spec:** `docs/superpowers/specs/2026-09-06-round51-canonical-match-center-cutover-design.md`

## Global Constraints

- `main` / production must not change during implementation or TEST verification.
- Base branch/rollback point remains `test/round51-2-match-center-fixes` at `b2aee439c70a870e88c1e4fa5ea25a73d14bdff4`.
- Serie A Match Center must remain visually and behaviorally the production v23.1 `.mc-*` implementation, not a new `cw239-*` or Round51 drawer layout.
- Coppa Italia, Champions League, Europa League, and Conference League must use the same `.mc-*` DOM/runtime; only theme and provider data differ.
- Exactly one document-level match click owner may open Match Center.
- No bottom drawer, snap state, second overlay runtime, or tournament-specific Match Center copies.
- Existing prediction controls must not be hijacked by Match Center routing.
- `round51-1-current-round.mjs` stays unless an explicit dependency scan proves it is Match Center-only.
- TDD order: failing focused test -> minimal code -> focused test green -> commit.
- Full `npm test` and `npm run build` must pass before TEST deployment verification.

---

## File Structure

### Stable runtime boundary

- `cloudflare-test/scripts/home-v23-3-source-patch.mjs` — patches fetched v23.1 HTML so Serie A and external competitions both enter the real legacy `matchCenterHtml()` / `bindMatchCenter()` flow.
- `cloudflare-test/src/v23.3/match-center-links.mjs` — the only document click owner and target normalizer.
- `cloudflare-test/src/v23.3/match-center.mjs` — one routing/data boundary: Serie A -> legacy v23.1 event; external -> canonical API -> legacy adapter -> same legacy shell.
- `cloudflare-test/src/v23.3/bsd-serie-a-legacy-adapter.mjs` — converts external canonical data to the proven v23.1 Match Center contract.
- `cloudflare-test/src/v23.3/legacy-match-center-theme.mjs` — CSS-only tournament theming for existing `.mc-*` DOM.
- `cloudflare-test/src/v23.3/match-center-lifecycle.mjs` — captures/restores source navigation and scroll; it must not own a visual runtime.
- `cloudflare-test/src/v23.3/data-client.mjs`, `match-center-contract.mjs`, `match-center-providers.mjs`, `worker.js` — stable worker/client data path retained for external Match Center data.

### Remove from active ownership, then delete after dependency proof

- `cloudflare-test/src/v23.3/round51-1-active-match-center-ui.mjs`
- `cloudflare-test/src/v23.3/round51-2-match-center-host.mjs`
- `cloudflare-test/src/v23.3/round51-2-match-center-links.mjs`
- `cloudflare-test/src/v23.3/round51-2-match-center-runtime.mjs`
- `cloudflare-test/src/v23.3/round51-2-match-center-view.mjs`

### Eligible for deletion only after stable-source dependency scan

- `cloudflare-test/src/v23.3/match-center-runtime.mjs`
- `cloudflare-test/src/v23.3/match-center-view.mjs`
- `cloudflare-test/src/v23.3/match-center-core.mjs`
- `cloudflare-test/src/v23.3/match-center-theme.mjs`
- Round51.2 Serie A recovery modules, only after required recovery logic is either proven unnecessary or moved into stable provider code.

### New regression artifacts

- `cloudflare-test/test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs`
- `cloudflare-test/scripts/probe-round52-canonical-legacy-match-center.mjs`

---

### Task 1: Lock the legacy v23.1 Match Center ownership contract

**Files:**
- Create: `cloudflare-test/test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs`
- Read only: `cloudflare-test/scripts/home-v23-3-source-patch.mjs`
- Read only: `cloudflare-test/src/v23.3/match-center-links.mjs`
- Read only: `cloudflare-test/src/v23.3/index.mjs`

**Interfaces:**
- Consumes: `applyHomeV233SourcePatch(input: string): string`
- Produces: regression requirements used by every following task.

- [ ] **Step 1: Write the failing ownership tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyHomeV233SourcePatch } from '../scripts/home-v23-3-source-patch.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Round 52 canonical router opens the legacy Match Center boundary, never Round51.2', async () => {
  const source = await read('../src/v23.3/match-center-links.mjs');
  assert.match(source, /from '\.\/match-center\.mjs'/);
  assert.doesNotMatch(source, /round51-2-match-center/);
  assert.doesNotMatch(source, /CiaoV2512MatchCenterRuntime/);
});

test('Round 52 active module list contains no Round51 Match Center visual owner', async () => {
  const source = await read('../src/v23.3/index.mjs');
  assert.doesNotMatch(source, /round51-1-active-match-center-ui/);
  assert.doesNotMatch(source, /round51-2-match-center/);
  assert.match(source, /round51-1-current-round/);
});

test('v23.1 source patch remains the rendered Match Center shell', () => {
  const fixture = `
const __cw231HomeHtml = () => '';
let predict;
const root = document.body;
const main = document.body;
let matchReturnTab='predict',matchViewId=null,matchCenterTab='overview',matchData=null,matchLoading=false,tab='predict';
function openMatchCenter(){}
function matchCenterHtml(d){ return String(d); }
function matchTabContent(){ return ''; }
function bindMatchCenter(){}
function closeMatchCenter(){}
function patchMatchCenter(){}
async function refreshMatchCenter(){}
function render(){}
predict = __cw231HomeHtml;
`;
  const patched = applyHomeV233SourcePatch(fixture);
  assert.match(patched, /ciao-v233-open-serie-a-match/);
  assert.match(patched, /ciao-v233-open-external-legacy-match/);
  assert.match(patched, /main\.innerHTML = matchCenterHtml\(matchData\)/);
  assert.match(patched, /bindMatchCenter\(\)/);
  assert.doesNotMatch(patched, /round51-2-bottom-drawer/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
cd cloudflare-test
node --test test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs
```

Expected: FAIL because `match-center-links.mjs` still routes to Round51.2 and `index.mjs` still imports `round51-1-active-match-center-ui.mjs`.

- [ ] **Step 3: Commit the red test**

```bash
git add cloudflare-test/test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs
git commit -m "test: lock canonical legacy Match Center ownership"
```

---

### Task 2: Restore one canonical match-link router

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-links.mjs`
- Test: `cloudflare-test/test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs`
- Test: `cloudflare-test/test/home-match-links.test.mjs`

**Interfaces:**
- Consumes: `openCanonicalMatchCenter(payload)` from `./match-center.mjs`
- Consumes: `getMatchBootstrap(competition, matchId)` from `./match-bootstrap-cache.mjs`
- Produces: `resolveCanonicalMatchTarget(target)` returning `{ competition, matchId, initialMatch?, source? }`
- Produces: `installCanonicalMatchLinks(documentRef, { open? })`

- [ ] **Step 1: Add resolver tests for all supported card shapes and prediction-control exclusions**

Cover these canonical keys:

```js
const cases = [
  ['serie_a', 'serie_a:10'],
  ['coppa_italia', 'coppa_italia:20'],
  ['ucl', 'ucl:30'],
  ['uel', 'uel:40'],
  ['uecl', 'uecl:50'],
];
```

The fake targets must cover:

```text
[data-cw233-match][data-cw233-competition]
[data-cw233-pred-card]
[data-cw232-profile-match][data-cw232-competition]
[data-cw232-match] inside [data-cw232-competition]
[data-cw231-action="match-center"] inside a match card
```

Also assert that `[data-cw231-action="predict"]`, `[data-cw233-delta]`, and `[data-cw233-save-all]` return `null`.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd cloudflare-test
node --test test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs test/home-match-links.test.mjs
```

- [ ] **Step 3: Replace the Round51.2 dependency with the canonical resolver**

Use this exact structure in `match-center-links.mjs`:

```js
import { openCanonicalMatchCenter } from './match-center.mjs';
import { getMatchBootstrap } from './match-bootstrap-cache.mjs';

const PREDICTION_CONTROL_SELECTOR = '[data-cw233-delta],[data-cw233-save-all],[data-cw231-action="predict"]';
const INTERACTIVE_SELECTOR = 'button,input,select,textarea,a,[data-cw233-pred-nav]';
const MATCH_CENTER_BUTTON_SELECTOR = '[data-cw231-action="match-center"]';

function text(value) {
  return String(value ?? '').trim();
}

function sourceForTarget(target, competition = '') {
  const key = text(competition);
  if (target?.closest?.('[data-cw233-pred-card]')) {
    return Object.freeze({ surface:'predictions', tab:'mine', competition:key });
  }
  if (target?.closest?.('[data-cw232-profile-match]')) {
    return Object.freeze({ surface:'club-profile', tab:'profile', competition:key });
  }
  if (target?.closest?.('#ciao-v232-matches-overlay') || target?.closest?.('[data-cw232-match]')) {
    return Object.freeze({ surface:'matches', tab:'calendar', competition:key });
  }
  return Object.freeze({ surface:'home', tab:'predict', competition:key });
}

function canonicalPair(competition, matchId, source = null) {
  const key = text(competition);
  const id = text(matchId);
  if (!key || !id || !id.startsWith(`${key}:`) || !id.slice(key.length + 1).trim()) return null;
  const initialMatch = getMatchBootstrap(key, id);
  return Object.freeze({
    competition:key,
    matchId:id,
    ...(initialMatch ? { initialMatch } : {}),
    ...(source ? { source } : {}),
  });
}

function pairFromCanonicalId(matchId, sourceTarget = null) {
  const id = text(matchId);
  const separator = id.indexOf(':');
  if (separator <= 0) return null;
  const competition = id.slice(0, separator);
  return canonicalPair(competition, id, sourceForTarget(sourceTarget, competition));
}

export function resolveCanonicalMatchTarget(target) {
  if (!target?.closest) return null;
  if (target.closest(PREDICTION_CONTROL_SELECTOR)) return null;

  const interactive = target.closest(INTERACTIVE_SELECTOR);
  const explicitMatchCenter = target.closest(MATCH_CENTER_BUTTON_SELECTOR);
  if (interactive && !explicitMatchCenter) return null;

  const canonical = target.closest('[data-cw233-match][data-cw233-competition]');
  if (canonical) {
    const competition = text(canonical.dataset?.cw233Competition);
    return canonicalPair(competition, canonical.dataset?.cw233Match, sourceForTarget(target, competition));
  }

  const predictionCard = target.closest('[data-cw233-pred-card]');
  if (predictionCard) return pairFromCanonicalId(predictionCard.dataset?.cw233PredCard, target);

  const profileCard = target.closest('[data-cw232-profile-match][data-cw232-competition]');
  if (profileCard) {
    const competition = text(profileCard.dataset?.cw232Competition);
    return canonicalPair(competition, profileCard.dataset?.cw232ProfileMatch, sourceForTarget(target, competition));
  }

  const scheduleCard = target.closest('[data-cw232-match]');
  if (!scheduleCard) return null;
  const competitionHost = scheduleCard.closest?.('[data-cw232-competition]');
  const competition = text(competitionHost?.dataset?.cw232Competition);
  return canonicalPair(competition, scheduleCard.dataset?.cw232Match, sourceForTarget(target, competition));
}
```

The click owner must be:

```js
export function installCanonicalMatchLinks(documentRef = globalThis.document, { open = openCanonicalMatchCenter } = {}) {
  if (!documentRef?.addEventListener || typeof open !== 'function') return null;

  const handler = event => {
    const payload = resolveCanonicalMatchTarget(event?.target);
    if (!payload) return;
    const source = globalThis.CiaoV233MatchCenterLifecycle?.capture?.(event?.target) || payload.source;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    void open({ ...payload, source });
  };

  documentRef.addEventListener('click', handler, true);
  return Object.freeze({
    handler,
    resolveCanonicalMatchTarget,
    disconnect() { documentRef.removeEventListener?.('click', handler, true); },
  });
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
cd cloudflare-test
node --test test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs test/home-match-links.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/match-center-links.mjs cloudflare-test/test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs cloudflare-test/test/home-match-links.test.mjs
git commit -m "fix: route all match links to legacy Match Center"
```

---

### Task 3: Make `match-center.mjs` a pure legacy runtime boundary

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center.mjs`
- Test: `cloudflare-test/test/v23-3-round19-legacy-match-center-runtime.test.mjs`
- Test: `cloudflare-test/test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs`

**Interfaces:**
- Consumes: `loadMatchCenterBase`, `loadMatchCenterSection`
- Consumes: `toSerieALegacyMatchCenterData(base, sections)`
- Produces: `openCanonicalMatchCenter({ competition, matchId, initialMatch? })`
- Produces: `loadExternalLegacyMatchCenter(competition, matchId, options)`
- Produces global refresh boundary: `CiaoV233ExternalLegacyMatchCenter`

- [ ] **Step 1: Add a failing test that forbids accidental secondary overlay installation**

```js
test('canonical boundary dispatches Serie A and external competitions to the v23.1 shell', async () => {
  const source = await read('../src/v23.3/match-center.mjs');
  assert.doesNotMatch(source, /installCanonicalMatchCenter\(/);
  assert.doesNotMatch(source, /match-center-core\.mjs/);
  assert.doesNotMatch(source, /match-center-runtime\.mjs/);
  assert.match(source, /ciao-v233-open-serie-a-match/);
  assert.match(source, /ciao-v233-open-external-legacy-match/);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd cloudflare-test
node --test test/v23-3-round19-legacy-match-center-runtime.test.mjs test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs
```

- [ ] **Step 3: Remove the Core dependency and add a small Serie A legacy dispatcher**

```js
import { loadMatchCenterBase, loadMatchCenterSection } from './data-client.mjs';
import { toSerieALegacyMatchCenterData } from './bsd-serie-a-cw20-adapter.mjs';

const EXTERNAL_SECTIONS = Object.freeze(['overview', 'stats', 'events', 'lineups', 'players']);
const SERIE_A_EVENT = 'ciao-v233-open-serie-a-match';
const EXTERNAL_EVENT = 'ciao-v233-open-external-legacy-match';

function serieALegacyId(matchId) {
  const value = String(matchId || '').trim();
  if (!value.startsWith('serie_a:')) return 0;
  const id = Number(value.slice('serie_a:'.length));
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function openSerieALegacyMatchCenter(payload = {}, target = globalThis) {
  const legacyId = serieALegacyId(payload.matchId);
  if (!legacyId) throw new Error('serie_a_legacy_match_id_required');
  const EventCtor = target?.CustomEvent || globalThis.CustomEvent;
  if (typeof target?.dispatchEvent !== 'function' || typeof EventCtor !== 'function') {
    throw new Error('serie_a_legacy_match_center_bridge_unavailable');
  }
  target.dispatchEvent(new EventCtor(SERIE_A_EVENT, {
    detail:{ matchId:String(payload.matchId), legacyId },
  }));
  return 'legacy';
}
```

Keep the existing external loader/refresh functions, then expose:

```js
export function openCanonicalMatchCenter(payload = {}) {
  const competition = String(payload?.competition || '').trim();
  if (competition === 'serie_a') return openSerieALegacyMatchCenter(payload);
  return openExternalLegacyMatchCenter(payload);
}
```

No function in this module may create `#ciao-v233-match-center-overlay`, `#ciao-v239-match-center-overlay`, or import a separate visual runtime.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
cd cloudflare-test
node --test test/v23-3-round19-legacy-match-center-runtime.test.mjs test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs
```

Update the old Round19 source assertion so it expects the local Serie A legacy dispatcher instead of `Core.openCanonicalMatchCenter`.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/match-center.mjs cloudflare-test/test/v23-3-round19-legacy-match-center-runtime.test.mjs cloudflare-test/test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs
git commit -m "refactor: make legacy Match Center the single runtime boundary"
```

---

### Task 4: Verify one `.mc-*` layout with five tournament themes

**Files:**
- Modify only on failing assertions: `cloudflare-test/src/v23.3/legacy-match-center-theme.mjs`
- Modify only on failing assertions: `cloudflare-test/scripts/home-v23-3-source-patch.mjs`
- Test: `cloudflare-test/test/v23-3-round19-legacy-match-center-runtime.test.mjs`
- Test: `cloudflare-test/test/v23-3-round22-final-match-center-themes.test.mjs`
- Test: `cloudflare-test/test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs`

**Interfaces:**
- Consumes DOM class: `#ciao-miniapp-root.match-center-open`
- Consumes competition marker: `data-cw233-mc-competition`
- Produces CSS variables for `.mc-shell`, `.mc-hero`, `.mc-tabs`, `.mc-section`, stats/events/lineups/player blocks.

- [ ] **Step 1: Add explicit five-theme assertions**

```js
for (const key of ['coppa_italia', 'ucl', 'uel', 'uecl']) {
  assert.match(themeSource, new RegExp(key));
}
assert.match(themeSource, /Serie A is the default legacy Match Center theme/);
assert.match(themeSource, /\.mc-shell/);
assert.match(themeSource, /\.mc-hero/);
assert.match(themeSource, /\.mc-tab\.active/);
assert.match(themeSource, /\.mc-section/);
assert.doesNotMatch(themeSource, /cw239-mc|cw512|bottom-drawer/i);
```

Also assert that external open sets `root.dataset.cw233McCompetition` and external close deletes it.

- [ ] **Step 2: Run theme tests**

```bash
cd cloudflare-test
node --test test/v23-3-round19-legacy-match-center-runtime.test.mjs test/v23-3-round22-final-match-center-themes.test.mjs test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs
```

Expected: PASS with existing theme CSS. If a test fails, change only theme variables/selectors; do not create new Match Center markup.

- [ ] **Step 3: If a key alias is missing, normalize only the mapping**

```js
export const LEGACY_MATCH_CENTER_THEME_KEYS = Object.freeze({
  coppa_italia:'coppa_italia',
  champions_league:'ucl',
  europa_league:'uel',
  conference_league:'uecl',
  ucl:'ucl',
  uel:'uel',
  uecl:'uecl',
});
```

- [ ] **Step 4: Re-run tests and commit changed files**

```bash
git add cloudflare-test/src/v23.3/legacy-match-center-theme.mjs cloudflare-test/scripts/home-v23-3-source-patch.mjs cloudflare-test/test/v23-3-round19-legacy-match-center-runtime.test.mjs cloudflare-test/test/v23-3-round22-final-match-center-themes.test.mjs cloudflare-test/test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs
git commit -m "test: lock shared Match Center tournament themes"
```

Stage only files that changed.

---

### Task 5: Lock external provider -> legacy adapter parity for every cup

**Files:**
- Modify only on failing contract tests: `cloudflare-test/src/v23.3/bsd-serie-a-legacy-adapter.mjs`
- Modify only if Round51 recovery is proven unnecessary: `cloudflare-test/src/v23.3/match-center-providers.mjs`
- Modify only on failing worker tests: `cloudflare-test/src/worker.js`
- Test: `cloudflare-test/test/v23-3-round19-legacy-match-center-runtime.test.mjs`
- Test: `cloudflare-test/test/v23-3-round45-match-center-data-completeness.test.mjs`
- Test: `cloudflare-test/test/v23-3-worker-data.test.mjs`

**Interfaces:**
- Worker route: `GET /api/v23.3/match-center?competition=<key>&match_id=<key:id>[&section=<section>]`
- External keys: `coppa_italia`, `ucl`, `uel`, `uecl`
- Canonical sections: `overview`, `stats`, `events`, `lineups`, `players`
- Legacy output: `{ match, detail, coverage, stats, incidents, lineups, player_stats, form, prediction_model, prediction_split }`

- [ ] **Step 1: Add table-driven adapter tests for all four external competitions**

```js
const externalCompetitions = ['coppa_italia', 'ucl', 'uel', 'uecl'];
for (const competition of externalCompetitions) {
  test(`${competition} returns the common legacy Match Center contract`, async () => {
    const matchId = `${competition}:7001`;
    const legacy = await loadExternalLegacyMatchCenter(competition, matchId, {
      loadBase: async () => ({ match:{ ...base, competition, matchId } }),
      loadSection: async (_competition, _matchId, section) => ({ data:sections[section] }),
    });
    assert.equal(legacy.competition, competition);
    assert.equal(legacy.match.id, matchId);
    assert.ok(legacy.stats);
    assert.ok(legacy.incidents);
    assert.ok(legacy.lineups);
    assert.ok(legacy.player_stats);
  });
}
```

- [ ] **Step 2: Run focused provider/worker tests**

```bash
cd cloudflare-test
node --test test/v23-3-round19-legacy-match-center-runtime.test.mjs test/v23-3-round45-match-center-data-completeness.test.mjs test/v23-3-worker-data.test.mjs
```

- [ ] **Step 3: If Round51.2 recovery imports can be removed, preserve the stable provider contract exactly**

The stable `createMatchCenterProviders` must retain equivalent logic:

```js
export function createMatchCenterProviders({
  loadSerieABase,
  loadSerieASection,
  loadExternalBase,
  loadExternalSection,
  loadUserPrediction = loadAuthoritativeUserPrediction,
} = {}) {
  async function loadBase({ competition, matchId, ...context } = {}) {
    const target = assertTarget(competition, matchId);
    const loader = target.competition === 'serie_a'
      ? requireLoader(loadSerieABase, 'serie_a_provider_unavailable')
      : requireLoader(loadExternalBase, 'external_provider_unavailable');
    const payload = await loader({ ...context, ...target });
    return normalizeCanonicalBase(unwrapMatch(payload), target.competition, target.matchId);
  }

  async function loadSection({ competition, matchId, section, ...context } = {}) {
    const target = assertTarget(competition, matchId);
    const canonicalSection = assertSection(section);
    const loader = target.competition === 'serie_a'
      ? requireLoader(loadSerieASection, 'serie_a_provider_unavailable')
      : requireLoader(loadExternalSection, 'external_provider_unavailable');
    const payload = await loader({ ...context, ...target, section:canonicalSection });
    const normalized = normalizeCanonicalSection(canonicalSection, unwrapSection(payload));

    if (canonicalSection !== 'overview' || normalized.available === false || !normalized.data) {
      return normalized;
    }

    let prediction = null;
    try {
      prediction = await loadUserPrediction({ ...context, ...target });
    } catch {}
    if (!prediction) return normalized;

    return Object.freeze({
      ...normalized,
      data:Object.freeze({ ...normalized.data, prediction }),
    });
  }

  return Object.freeze({ loadBase, loadSection });
}
```

Do not delete `match-center-contract.mjs` or the worker-side external provider route.

- [ ] **Step 4: Re-run focused tests and commit actual changes**

```bash
git add cloudflare-test/src/v23.3/bsd-serie-a-legacy-adapter.mjs cloudflare-test/src/v23.3/match-center-providers.mjs cloudflare-test/src/worker.js cloudflare-test/test/v23-3-round19-legacy-match-center-runtime.test.mjs cloudflare-test/test/v23-3-round45-match-center-data-completeness.test.mjs cloudflare-test/test/v23-3-worker-data.test.mjs
git commit -m "refactor: stabilize shared Match Center data adapters"
```

Stage only files that changed.

---

### Task 6: Remove Round51 visual ownership from the active build

**Files:**
- Modify: `cloudflare-test/src/v23.3/index.mjs`
- Delete: `cloudflare-test/src/v23.3/round51-1-active-match-center-ui.mjs`
- Delete: `cloudflare-test/src/v23.3/round51-2-match-center-host.mjs`
- Delete: `cloudflare-test/src/v23.3/round51-2-match-center-links.mjs`
- Delete: `cloudflare-test/src/v23.3/round51-2-match-center-runtime.mjs`
- Delete: `cloudflare-test/src/v23.3/round51-2-match-center-view.mjs`
- Keep: `cloudflare-test/src/v23.3/round51-1-current-round.mjs`
- Test: `cloudflare-test/test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs`

**Interfaces:**
- Produces active `CiaoV233` module graph with no Round51 Match Center visual owner.
- Preserves `round511CurrentRound` behavior.

- [ ] **Step 1: Run dependency scan before deletion**

```bash
grep -R "round51-2-match-center\|round51-1-active-match-center-ui" -n cloudflare-test/src cloudflare-test/scripts cloudflare-test/test .github || true
```

Expected before deletion: stable-source references are limited to current active imports/router and the files being removed. If another stable module imports one of these files, move the required non-UI logic into a stable module before deleting it.

- [ ] **Step 2: Remove only the Round51.1 visual import/property from `index.mjs`**

Keep:

```js
import './round51-1-current-round.mjs';
```

Remove:

```js
import './round51-1-active-match-center-ui.mjs';
```

and:

```js
round511ActiveMatchCenterUi: 'enabled',
```

Keep `round511CurrentRound`.

- [ ] **Step 3: Delete the five Round51 Match Center visual/runtime files**

```text
cloudflare-test/src/v23.3/round51-1-active-match-center-ui.mjs
cloudflare-test/src/v23.3/round51-2-match-center-host.mjs
cloudflare-test/src/v23.3/round51-2-match-center-links.mjs
cloudflare-test/src/v23.3/round51-2-match-center-runtime.mjs
cloudflare-test/src/v23.3/round51-2-match-center-view.mjs
```

- [ ] **Step 4: Delete tests whose only subject is the removed Round51 visual/runtime behavior**

```text
cloudflare-test/test/v23-3-round51-1-active-match-center-ui.test.mjs
cloudflare-test/test/v23-3-round51-2-match-center-host.test.mjs
cloudflare-test/test/v23-3-round51-2-match-center-runtime.test.mjs
cloudflare-test/test/v23-3-round51-2-match-center-view.test.mjs
```

Keep current-round and stable data tests.

- [ ] **Step 5: Run ownership/build tests**

```bash
cd cloudflare-test
node --test test/v23-3-round52-canonical-legacy-match-center-cutover.test.mjs test/v23-3-build.test.mjs test/v23-3-source-contract.test.mjs
```

- [ ] **Step 6: Commit**

```bash
git add -A cloudflare-test/src/v23.3 cloudflare-test/test
git diff --cached --stat
git commit -m "refactor: remove Round51 parallel Match Center"
```

Before commit, confirm `round51-1-current-round.mjs` is not in the deletion list.

---

### Task 7: Remove inactive cw239 overlay runtime only after proof

**Files:**
- Candidate delete: `cloudflare-test/src/v23.3/match-center-runtime.mjs`
- Candidate delete: `cloudflare-test/src/v23.3/match-center-view.mjs`
- Candidate delete: `cloudflare-test/src/v23.3/match-center-core.mjs`
- Candidate delete: `cloudflare-test/src/v23.3/match-center-theme.mjs`
- Candidate delete: tests whose only subject is the cw239 overlay runtime/view.

**Interfaces:**
- Produces no hidden secondary visual Match Center implementation in stable source.

- [ ] **Step 1: Prove stable runtime/view imports are gone**

```bash
grep -R "from './match-center-runtime\.mjs'\|from './match-center-view\.mjs'\|from './match-center-core\.mjs'\|from './match-center-theme\.mjs'" -n cloudflare-test/src/v23.3 cloudflare-test/scripts || true
```

Expected: no stable-source imports after Tasks 2-6.

- [ ] **Step 2: Delete only modules proven unused by stable source**

If the scan is empty for the four candidate visual modules, delete those four. Run a separate scan before deleting `match-center-repository.mjs` or `match-center-store.mjs`; retain either file if any stable source still imports it.

- [ ] **Step 3: Remove obsolete cw239-only tests**

```bash
grep -R "cw239-mc\|CiaoV239MatchCenterRuntime\|MATCH_CENTER_RUNTIME_ID" -n cloudflare-test/test || true
```

Delete tests only when their implementation subject was deleted. Preserve contract/provider/worker tests.

- [ ] **Step 4: Run full tests before cleanup commit**

```bash
cd cloudflare-test
npm test
```

Expected: PASS with zero missing-module imports.

- [ ] **Step 5: Commit**

```bash
git add -A cloudflare-test/src/v23.3 cloudflare-test/test
git commit -m "chore: remove inactive secondary Match Center UI stack"
```

---

### Task 8: Add a TEST deployment probe for all five competitions

**Files:**
- Create: `cloudflare-test/scripts/probe-round52-canonical-legacy-match-center.mjs`
- Test: `cloudflare-test/test/v23-3-probes.test.mjs`

**Interfaces:**
- Consumes: `TEST_URL`, `TELEGRAM_INIT_DATA`, `TEST_MATCH_SERIE_A`, `TEST_MATCH_COPPA_ITALIA`, `TEST_MATCH_UCL`, `TEST_MATCH_UEL`, `TEST_MATCH_UECL`.
- Produces non-zero process exit on failed health/static/API contract checks.

- [ ] **Step 1: Add a failing probe-presence test**

```js
for (const key of ['serie_a', 'coppa_italia', 'ucl', 'uel', 'uecl']) {
  assert.match(source, new RegExp(key));
}
assert.match(source, /\/healthz/);
assert.match(source, /\/api\/v23\.3\/match-center/);
```

- [ ] **Step 2: Run probe test and verify RED**

```bash
cd cloudflare-test
node --test test/v23-3-probes.test.mjs
```

Expected: FAIL because the probe file does not exist.

- [ ] **Step 3: Create the probe with explicit environment validation**

At startup require all environment variables:

```js
const required = [
  'TEST_URL',
  'TELEGRAM_INIT_DATA',
  'TEST_MATCH_SERIE_A',
  'TEST_MATCH_COPPA_ITALIA',
  'TEST_MATCH_UCL',
  'TEST_MATCH_UEL',
  'TEST_MATCH_UECL',
];
for (const key of required) {
  if (!String(process.env[key] || '').trim()) throw new Error(`missing_env:${key}`);
}
```

The probe must then:

1. GET `/healthz` and require `ok === true`.
2. GET `/` with a cache-busting query and require `ciao-v233` plus `cw233-single-legacy-match-center-r20`.
3. Reject HTML containing `round51-2-bottom-drawer`, `CiaoV2512MatchCenterRuntime`, or `ciao-v239-match-center-overlay`.
4. Request base `/api/v23.3/match-center` for each competition using the configured match id and `x-telegram-init-data` header.
5. Require `ok === true`, `data.match`, matching `competition`, and matching `matchId`.
6. For each external competition request `overview`, `stats`, `events`, `lineups`, `players`; `available:false` is valid, HTTP/API error is not.

- [ ] **Step 4: Run probe unit test and commit**

```bash
cd cloudflare-test
node --test test/v23-3-probes.test.mjs
git add scripts/probe-round52-canonical-legacy-match-center.mjs test/v23-3-probes.test.mjs
git commit -m "test: add canonical Match Center deployment probe"
```

---

### Task 9: Full CI, build, and TEST verification

**Files:**
- No production code changes expected.

**Interfaces:**
- Produces a verified TEST candidate; does not touch `main`.

- [ ] **Step 1: Run complete test suite**

```bash
cd cloudflare-test
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run production-equivalent TEST build**

```bash
cd cloudflare-test
npm run build
```

Expected: exit code 0 and `dist/index.html` produced from the v23.1 base with v23.3 patches.

- [ ] **Step 3: Inspect built output for single-owner invariants**

```bash
grep -n "cw233-single-legacy-match-center-r20\|ciao-v233-open-serie-a-match\|ciao-v233-open-external-legacy-match" dist/index.html
grep -n "round51-2-bottom-drawer\|CiaoV2512MatchCenterRuntime\|ciao-v239-match-center-overlay" dist/index.html && exit 1 || true
```

Expected: legacy markers present; secondary Match Center visual markers absent.

- [ ] **Step 4: Push implementation branch and wait for full GitHub CI**

Do not update `main`. All required workflow checks must be green before TEST deployment.

- [ ] **Step 5: Deploy only to the existing TEST target**

Use the repository's existing TEST deployment path for `ciao-web-app`. Do not change production routing.

- [ ] **Step 6: Run deployment probe with preconfigured environment**

```bash
cd cloudflare-test
node scripts/probe-round52-canonical-legacy-match-center.mjs
```

Expected: exit code 0 when the required `TEST_URL`, Telegram auth, and five TEST match ids are already present in the environment.

- [ ] **Step 7: Manual TEST acceptance pass**

For each of Serie A, Coppa Italia, Champions League, Europa League, Conference League verify:

```text
card click -> one Match Center opens
header/hero/tabs are the v23.1 .mc-* layout
correct teams and score
correct tournament theme
Overview / Stats / Events / Lineups / Players switch inside the same screen
Back returns to the exact previous surface and scroll position
no second overlay or drawer appears
no duplicate click/open occurs
prediction controls still edit/save predictions instead of opening Match Center
```

- [ ] **Step 8: Commit verification artifacts only if they changed**

```bash
git add cloudflare-test/test cloudflare-test/scripts
git commit -m "test: verify canonical Match Center cutover"
```

Do not merge or fast-forward `main` without separate explicit production approval.

---

## Plan Self-Review

### Spec coverage

- One click owner: Tasks 1-3, 6.
- One v23.1 Match Center runtime: Tasks 1, 3, 6, 7.
- Serie A parity with production/main: Tasks 1, 3, 4, 9.
- Shared UI for all cups: Tasks 3-5, 9.
- Tournament themes only: Task 4.
- Common provider/adapter contract: Task 5.
- No drawer/snap/parallel runtime: Tasks 1, 6, 7, 9.
- Back/source restoration: Tasks 2, 9.
- Full CI + per-competition TEST verification: Tasks 8-9.
- `main` untouched: Global Constraints and Task 9.

### Type/interface consistency

- Router payload is consistently `{ competition, matchId, initialMatch?, source? }`.
- Supported competition keys are consistently `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`.
- Legacy external event is consistently `ciao-v233-open-external-legacy-match`.
- Serie A legacy event is consistently `ciao-v233-open-serie-a-match`.
- Canonical section names are consistently `overview`, `stats`, `events`, `lineups`, `players`.

### Scope

This plan changes one subsystem: Match Center ownership/runtime/view routing. It deliberately preserves standings, predictions, rankings, current-round selection, and worker provider infrastructure except where required by the Match Center data boundary.
