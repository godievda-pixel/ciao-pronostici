# Ciao, Web! v23.2 Core Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TEST-only v23.2 multi-competition core—competition metadata, canonical match normalization, inclusion rules, Tournament Engine selectors, and a browser-safe module entry—without replacing any working v23.1 screen.

**Architecture:** Keep the existing v23.1 HTML patch as the visible TEST UI while introducing a modular v23.2 core under `cloudflare-test/src/v23.2/`. The same ES modules are imported directly by Node tests and copied unchanged to `dist/v23.2/` for browser `type="module"` loading, avoiding duplicated business logic and avoiding a new bundler dependency. This milestone does not connect a new upstream provider yet; it establishes the exact normalized contract that the subsequent API/source plan must feed.

**Tech Stack:** JavaScript ES modules, Node.js 22 built-in test runner, Cloudflare Workers Static Assets, existing custom `scripts/build.mjs`, GitHub Actions `Ciao TEST check`.

**Spec:** `docs/superpowers/specs/2026-09-01-ciao-web-v23-2-multitournament-design.md`

## Global Constraints

- Work only on branch `develop` and TEST worker `ciao-web-app-test`.
- Production `ciao-web-app` remains unchanged until explicit acceptance.
- Existing v23.1 favorite-club card and `Кальчо сегодня` behavior must not regress.
- Competition keys are exactly `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`.
- Serie A and Coppa Italia include every match; UCL, UEL and UECL include only matches with at least one Italian club.
- Match status is exactly one of `scheduled`, `live`, `finished`, `postponed`, `cancelled`.
- `predictionDeadline` is authoritative for prediction locking; LIVE polling never decides whether a prediction is open.
- Async hydration must not remount existing v23.1 UI, reset scroll, or change card geometry.
- This milestone exposes core logic only; it does not switch Matches, Predictions, Rankings, Home or Match Center to v23.2 data.

---

## File Structure Locked by This Plan

- `cloudflare-test/src/v23.2/competition-config.mjs` — immutable competition metadata and theme/navigation configuration.
- `cloudflare-test/src/v23.2/match-normalizer.mjs` — canonical team/match normalization, status mapping and inclusion rule.
- `cloudflare-test/src/v23.2/tournament-engine.mjs` — pure selectors over already-normalized matches.
- `cloudflare-test/src/v23.2/index.mjs` — browser entry that exposes the tested core as `globalThis.CiaoV232Core` and performs no rendering.
- `cloudflare-test/test/v23-2-competition-config.test.mjs` — competition config contract.
- `cloudflare-test/test/v23-2-normalizer.test.mjs` — canonical model, stable IDs and Italian-club filtering.
- `cloudflare-test/test/v23-2-engine.test.mjs` — chronological/stage/round/favorite/prediction selectors.
- `cloudflare-test/test/v23-2-build.test.mjs` — build copies browser modules and injects one module entry without altering v23.1 runtime.
- `cloudflare-test/scripts/build.mjs` — copy v23.2 modules to Static Assets and inject the inert module entry.
- `.github/workflows/ciao-test-check.yml` — include v23.2 source paths in the existing TEST verification trigger only if path filtering requires it; because all files are under `cloudflare-test/**`, no workflow behavior change is expected.

---

### Task 1: Competition Configuration Contract

**Files:**
- Create: `cloudflare-test/src/v23.2/competition-config.mjs`
- Create: `cloudflare-test/test/v23-2-competition-config.test.mjs`

**Interfaces:**
- Consumes: no earlier task.
- Produces: `COMPETITION_KEYS`, `COMPETITIONS`, `getCompetitionConfig(key)`.

- [ ] **Step 1: Write the failing configuration test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPETITION_KEYS,
  COMPETITIONS,
  getCompetitionConfig,
} from '../src/v23.2/competition-config.mjs';

test('v23.2 defines exactly five competition configs', () => {
  assert.deepEqual(COMPETITION_KEYS, [
    'serie_a',
    'coppa_italia',
    'ucl',
    'uel',
    'uecl',
  ]);
  assert.equal(Object.keys(COMPETITIONS).length, 5);
});

test('competition themes and navigation models are stable', () => {
  assert.deepEqual(getCompetitionConfig('serie_a'), {
    key: 'serie_a', title: 'Serie A', shortTitle: 'Serie A', theme: 'serie-a', navigation: 'rounds', european: false,
  });
  assert.equal(getCompetitionConfig('coppa_italia').navigation, 'stages');
  assert.equal(getCompetitionConfig('ucl').theme, 'champions');
  assert.equal(getCompetitionConfig('uel').theme, 'europa');
  assert.equal(getCompetitionConfig('uecl').theme, 'conference');
  assert.throws(() => getCompetitionConfig('unknown'), /Unknown competition/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run from `cloudflare-test`:

```bash
node --test test/v23-2-competition-config.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/v23.2/competition-config.mjs`.

- [ ] **Step 3: Implement the immutable competition config**

```js
export const COMPETITION_KEYS = Object.freeze([
  'serie_a',
  'coppa_italia',
  'ucl',
  'uel',
  'uecl',
]);

export const COMPETITIONS = Object.freeze({
  serie_a: Object.freeze({ key: 'serie_a', title: 'Serie A', shortTitle: 'Serie A', theme: 'serie-a', navigation: 'rounds', european: false }),
  coppa_italia: Object.freeze({ key: 'coppa_italia', title: 'Coppa Italia', shortTitle: 'Кубок', theme: 'coppa', navigation: 'stages', european: false }),
  ucl: Object.freeze({ key: 'ucl', title: 'Champions League', shortTitle: 'ЛЧ', theme: 'champions', navigation: 'stages', european: true }),
  uel: Object.freeze({ key: 'uel', title: 'Europa League', shortTitle: 'ЛЕ', theme: 'europa', navigation: 'stages', european: true }),
  uecl: Object.freeze({ key: 'uecl', title: 'Conference League', shortTitle: 'ЛК', theme: 'conference', navigation: 'stages', european: true }),
});

export function getCompetitionConfig(key) {
  const config = COMPETITIONS[key];
  if (!config) throw new Error(`Unknown competition: ${key}`);
  return config;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
node --test test/v23-2-competition-config.test.mjs
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.2/competition-config.mjs cloudflare-test/test/v23-2-competition-config.test.mjs
git commit -m "feat: add v23.2 competition config"
```

---

### Task 2: Canonical Match Normalizer and Inclusion Rules

**Files:**
- Create: `cloudflare-test/src/v23.2/match-normalizer.mjs`
- Create: `cloudflare-test/test/v23-2-normalizer.test.mjs`

**Interfaces:**
- Consumes: `getCompetitionConfig(key)` from Task 1.
- Produces: `MATCH_STATUSES`, `normalizeTeam(raw)`, `normalizeMatch(raw, competition)`, `shouldIncludeMatch(match)`.
- Canonical `matchId` type: string `${competition}:${sourceId}` so IDs cannot collide between competitions.

- [ ] **Step 1: Write failing normalizer tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMatch,
  shouldIncludeMatch,
} from '../src/v23.2/match-normalizer.mjs';

const raw = {
  id: 101,
  season: '2026/27',
  stage: 'League phase',
  round: 1,
  kickoff_at: '2026-09-15T19:00:00Z',
  status: 'NS',
  home: { id: 10, name: 'Inter', country: 'Italy', logo: 'inter.png' },
  away: { id: 20, name: 'Arsenal', country: 'England', logo: 'arsenal.png' },
  home_score: null,
  away_score: null,
  prediction_deadline: '2026-09-15T18:59:59Z',
  version: 'feed-7',
};

test('normalizes a match to the canonical v23.2 shape', () => {
  const match = normalizeMatch(raw, 'ucl');
  assert.equal(match.matchId, 'ucl:101');
  assert.equal(match.competition, 'ucl');
  assert.equal(match.status, 'scheduled');
  assert.equal(match.homeTeam.countryCode, 'ITA');
  assert.equal(match.awayTeam.countryCode, 'ENG');
  assert.equal(match.predictionDeadline, '2026-09-15T18:59:59Z');
  assert.deepEqual(Object.keys(match), [
    'matchId','competition','season','stage','round','kickoffAt','status','minute',
    'homeTeam','awayTeam','homeScore','awayScore','aggregateScore','leg','venue',
    'predictionDeadline','rawVersion',
  ]);
});

test('includes every domestic match and only Italian-club European matches', () => {
  assert.equal(shouldIncludeMatch(normalizeMatch(raw, 'serie_a')), true);
  assert.equal(shouldIncludeMatch(normalizeMatch(raw, 'coppa_italia')), true);
  assert.equal(shouldIncludeMatch(normalizeMatch(raw, 'ucl')), true);

  const foreign = normalizeMatch({
    ...raw,
    id: 102,
    home: { id: 30, name: 'Real Madrid', country: 'Spain' },
    away: { id: 40, name: 'Bayern', country: 'Germany' },
  }, 'ucl');
  assert.equal(shouldIncludeMatch(foreign), false);
});

test('maps provider statuses into the exact finite status set', () => {
  assert.equal(normalizeMatch({ ...raw, status: 'LIVE', minute: 67 }, 'ucl').status, 'live');
  assert.equal(normalizeMatch({ ...raw, status: 'FT' }, 'ucl').status, 'finished');
  assert.equal(normalizeMatch({ ...raw, status: 'PST' }, 'ucl').status, 'postponed');
  assert.equal(normalizeMatch({ ...raw, status: 'CANC' }, 'ucl').status, 'cancelled');
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
node --test test/v23-2-normalizer.test.mjs
```

Expected: FAIL because `match-normalizer.mjs` does not exist.

- [ ] **Step 3: Implement team/country/status normalization**

Use these exact mappings in `match-normalizer.mjs`:

```js
import { getCompetitionConfig } from './competition-config.mjs';

export const MATCH_STATUSES = Object.freeze([
  'scheduled', 'live', 'finished', 'postponed', 'cancelled',
]);

const STATUS_MAP = Object.freeze({
  NS: 'scheduled', SCHEDULED: 'scheduled', TIMED: 'scheduled',
  LIVE: 'live', '1H': 'live', HT: 'live', '2H': 'live', ET: 'live', PEN_LIVE: 'live',
  FT: 'finished', AET: 'finished', PEN: 'finished', FINISHED: 'finished',
  PST: 'postponed', POSTPONED: 'postponed',
  CANC: 'cancelled', CANCELLED: 'cancelled',
});

const COUNTRY_CODES = Object.freeze({
  italy: 'ITA', italia: 'ITA',
  england: 'ENG', spain: 'ESP', germany: 'GER', france: 'FRA', portugal: 'POR',
});

function text(value) { return String(value ?? '').trim(); }
function numberOrNull(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }

export function normalizeTeam(raw = {}) {
  const country = text(raw.country || raw.country_name);
  return Object.freeze({
    id: text(raw.id || raw.team_id),
    name: text(raw.name || raw.team_name) || '—',
    countryCode: text(raw.country_code).toUpperCase() || COUNTRY_CODES[country.toLowerCase()] || '',
    crestUrl: text(raw.logo || raw.crest || raw.crest_url),
  });
}

export function normalizeMatch(raw, competition) {
  getCompetitionConfig(competition);
  const sourceId = text(raw?.id ?? raw?.match_id);
  if (!sourceId) throw new Error('Match source id is required');
  const kickoffAt = text(raw.kickoffAt || raw.kickoff_at || raw.utcDate);
  const predictionDeadline = text(raw.predictionDeadline || raw.prediction_deadline || kickoffAt);
  const providerStatus = text(raw.status).toUpperCase();
  const status = STATUS_MAP[providerStatus] || 'scheduled';

  return Object.freeze({
    matchId: `${competition}:${sourceId}`,
    competition,
    season: text(raw.season),
    stage: text(raw.stage || raw.phase),
    round: raw.round ?? raw.round_number ?? null,
    kickoffAt,
    status,
    minute: status === 'live' ? numberOrNull(raw.minute) : null,
    homeTeam: normalizeTeam(raw.home || raw.homeTeam),
    awayTeam: normalizeTeam(raw.away || raw.awayTeam),
    homeScore: numberOrNull(raw.homeScore ?? raw.home_score),
    awayScore: numberOrNull(raw.awayScore ?? raw.away_score),
    aggregateScore: raw.aggregateScore ?? raw.aggregate_score ?? null,
    leg: raw.leg ?? null,
    venue: text(raw.venue),
    predictionDeadline,
    rawVersion: text(raw.rawVersion || raw.version),
  });
}

export function shouldIncludeMatch(match) {
  const config = getCompetitionConfig(match.competition);
  if (!config.european) return true;
  return match.homeTeam.countryCode === 'ITA' || match.awayTeam.countryCode === 'ITA';
}
```

- [ ] **Step 4: Run focused tests and all core tests**

```bash
node --test test/v23-2-normalizer.test.mjs test/v23-2-competition-config.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.2/match-normalizer.mjs cloudflare-test/test/v23-2-normalizer.test.mjs
git commit -m "feat: normalize v23.2 competition matches"
```

---

### Task 3: Tournament Engine Pure Selectors

**Files:**
- Create: `cloudflare-test/src/v23.2/tournament-engine.mjs`
- Create: `cloudflare-test/test/v23-2-engine.test.mjs`

**Interfaces:**
- Consumes canonical normalized match objects from Task 2.
- Produces `sortChronologically(matches)`, `matchesForCompetition(matches,key)`, `groupForCompetition(matches,key)`, `availablePredictions(matches,now)`, `nextMatchForTeam(matches,teamId,now)`.

- [ ] **Step 1: Write failing engine tests with a fixed clock**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMatch } from '../src/v23.2/match-normalizer.mjs';
import {
  sortChronologically,
  matchesForCompetition,
  groupForCompetition,
  availablePredictions,
  nextMatchForTeam,
} from '../src/v23.2/tournament-engine.mjs';

const m = (id, competition, kickoff, extra = {}) => normalizeMatch({
  id, season: '2026/27', kickoff_at: kickoff, status: 'NS',
  home: { id: extra.homeId || 10, name: extra.homeName || 'Inter', country: 'Italy' },
  away: { id: extra.awayId || 20, name: extra.awayName || 'Opponent', country: extra.awayCountry || 'England' },
  round: extra.round ?? 1, stage: extra.stage || '',
  prediction_deadline: extra.deadline || kickoff,
}, competition);

const matches = [
  m(3, 'ucl', '2026-09-20T19:00:00Z', { stage: 'League phase' }),
  m(1, 'serie_a', '2026-09-05T18:45:00Z', { round: 3 }),
  m(2, 'coppa_italia', '2026-09-10T19:00:00Z', { stage: '1/16' }),
];

test('selectors preserve one chronological source of truth', () => {
  assert.deepEqual(sortChronologically(matches).map(x => x.matchId), [
    'serie_a:1', 'coppa_italia:2', 'ucl:3',
  ]);
  assert.deepEqual(matchesForCompetition(matches, 'ucl').map(x => x.matchId), ['ucl:3']);
});

test('league groups by round while cups group by stage', () => {
  assert.equal(groupForCompetition(matches, 'serie_a')[0].key, '3');
  assert.equal(groupForCompetition(matches, 'coppa_italia')[0].key, '1/16');
});

test('prediction availability uses predictionDeadline rather than match status', () => {
  const now = Date.parse('2026-09-05T18:00:00Z');
  assert.deepEqual(availablePredictions(matches, now).map(x => x.matchId), [
    'serie_a:1', 'coppa_italia:2', 'ucl:3',
  ]);
});

test('favorite team next match scans every included competition', () => {
  const now = Date.parse('2026-09-01T00:00:00Z');
  assert.equal(nextMatchForTeam(matches, '10', now).matchId, 'serie_a:1');
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test test/v23-2-engine.test.mjs
```

Expected: FAIL because `tournament-engine.mjs` does not exist.

- [ ] **Step 3: Implement selectors without DOM or network access**

```js
import { getCompetitionConfig } from './competition-config.mjs';

export function sortChronologically(matches) {
  return [...matches].sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt));
}

export function matchesForCompetition(matches, key) {
  getCompetitionConfig(key);
  return sortChronologically(matches.filter(match => match.competition === key));
}

export function groupForCompetition(matches, key) {
  const config = getCompetitionConfig(key);
  const selected = matchesForCompetition(matches, key);
  const groups = new Map();
  for (const match of selected) {
    const rawKey = config.navigation === 'rounds' ? match.round : match.stage;
    const groupKey = String(rawKey ?? '');
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(match);
  }
  return [...groups.entries()].map(([groupKey, groupMatches]) => ({
    key: groupKey,
    matches: sortChronologically(groupMatches),
  }));
}

export function availablePredictions(matches, now = Date.now()) {
  return sortChronologically(matches.filter(match => {
    if (match.status === 'finished' || match.status === 'cancelled') return false;
    const deadline = Date.parse(match.predictionDeadline);
    return Number.isFinite(deadline) && deadline > now;
  }));
}

export function nextMatchForTeam(matches, teamId, now = Date.now()) {
  const wanted = String(teamId);
  return sortChronologically(matches).find(match =>
    Date.parse(match.kickoffAt) >= now &&
    (match.homeTeam.id === wanted || match.awayTeam.id === wanted)
  ) || null;
}
```

- [ ] **Step 4: Run the engine suite and entire v23.2 unit suite**

```bash
node --test test/v23-2-*.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.2/tournament-engine.mjs cloudflare-test/test/v23-2-engine.test.mjs
git commit -m "feat: add v23.2 tournament selectors"
```

---

### Task 4: Browser Entry With Zero UI Side Effects

**Files:**
- Create: `cloudflare-test/src/v23.2/index.mjs`
- Extend: `cloudflare-test/test/v23-2-engine.test.mjs`

**Interfaces:**
- Consumes all Task 1–3 exports.
- Produces browser global `globalThis.CiaoV232Core`.
- Must not call `render`, mutate DOM, fetch network data, start timers, or attach MutationObservers.

- [ ] **Step 1: Add a failing browser-entry contract test**

```js
import { readFile } from 'node:fs/promises';

test('v23.2 browser entry exposes core only and has no rendering side effects', async () => {
  const source = await readFile(new URL('../src/v23.2/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /globalThis\.CiaoV232Core/);
  assert.doesNotMatch(source, /document\.|MutationObserver|setInterval|setTimeout|fetch\(/);

  delete globalThis.CiaoV232Core;
  await import(`../src/v23.2/index.mjs?test=${Date.now()}`);
  assert.equal(globalThis.CiaoV232Core.version, '23.2-core');
  assert.equal(globalThis.CiaoV232Core.competitions.length, 5);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test test/v23-2-engine.test.mjs
```

Expected: FAIL because `src/v23.2/index.mjs` does not exist.

- [ ] **Step 3: Implement the inert browser entry**

```js
import { COMPETITION_KEYS, COMPETITIONS, getCompetitionConfig } from './competition-config.mjs';
import { normalizeMatch, normalizeTeam, shouldIncludeMatch } from './match-normalizer.mjs';
import {
  sortChronologically,
  matchesForCompetition,
  groupForCompetition,
  availablePredictions,
  nextMatchForTeam,
} from './tournament-engine.mjs';

globalThis.CiaoV232Core = Object.freeze({
  version: '23.2-core',
  competitions: COMPETITION_KEYS,
  competitionConfig: COMPETITIONS,
  getCompetitionConfig,
  normalizeMatch,
  normalizeTeam,
  shouldIncludeMatch,
  sortChronologically,
  matchesForCompetition,
  groupForCompetition,
  availablePredictions,
  nextMatchForTeam,
});
```

- [ ] **Step 4: Run all v23.2 unit tests**

```bash
node --test test/v23-2-*.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.2/index.mjs cloudflare-test/test/v23-2-engine.test.mjs
git commit -m "feat: expose inert v23.2 browser core"
```

---

### Task 5: Copy v23.2 Modules Into TEST Static Assets

**Files:**
- Modify: `cloudflare-test/scripts/build.mjs`
- Create: `cloudflare-test/test/v23-2-build.test.mjs`

**Interfaces:**
- Consumes `src/v23.2/*.mjs` from Tasks 1–4.
- Produces `dist/v23.2/*.mjs` plus one `<script type="module" id="ciao-v232-core" src="/v23.2/index.mjs"></script>` in TEST HTML.
- Existing `applyScheduleSourcePatch`, `applyFavoriteHtmlSourcePatch`, v23.1 CSS and v23.1 runtime remain authoritative and unchanged in behavior.

- [ ] **Step 1: Write failing build-helper tests**

Add exported helpers `injectV232Entry(html)` and `copyV232Modules()` and test them:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { injectV232Entry, copyV232Modules } from '../scripts/build.mjs';

test('injects one inert v23.2 module entry', () => {
  const html = '<html><body><div id="ciao-miniapp-root"></div></body></html>';
  const first = injectV232Entry(html);
  const second = injectV232Entry(first);
  assert.equal(first, second);
  assert.match(first, /type="module" id="ciao-v232-core" src="\/v23\.2\/index\.mjs"/);
});

test('copies v23.2 browser modules to dist', async () => {
  await copyV232Modules();
  const entry = await readFile(new URL('../dist/v23.2/index.mjs', import.meta.url), 'utf8');
  const engine = await readFile(new URL('../dist/v23.2/tournament-engine.mjs', import.meta.url), 'utf8');
  assert.match(entry, /CiaoV232Core/);
  assert.match(engine, /availablePredictions/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test test/v23-2-build.test.mjs
```

Expected: FAIL because the two helpers are not exported.

- [ ] **Step 3: Extend `scripts/build.mjs` with module copy and injection**

Change the fs import to:

```js
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
```

Add paths:

```js
const v232SourceDir = resolve(root, 'src/v23.2');
const v232OutDir = resolve(root, 'dist/v23.2');
```

Add helpers:

```js
export function injectV232Entry(input) {
  const html = String(input);
  if (html.includes('id="ciao-v232-core"')) return html;
  if (!/<\/body>/i.test(html)) throw new Error('v23.2 module entry requires body anchor');
  return html.replace(
    /<\/body>/i,
    '<script type="module" id="ciao-v232-core" src="/v23.2/index.mjs"></script>\n</body>',
  );
}

export async function copyV232Modules() {
  await mkdir(v232OutDir, { recursive: true });
  const files = (await readdir(v232SourceDir)).filter(name => name.endsWith('.mjs'));
  for (const name of files) {
    await copyFile(resolve(v232SourceDir, name), resolve(v232OutDir, name));
  }
  return files.sort();
}
```

In `build()`, after writing/copy preparation and before the final `writeFile`, do:

```js
await copyV232Modules();
const html = injectV232Entry(applyPatch(favoritePatched, css, js));
```

Keep the existing v23.1 source patches before this call.

- [ ] **Step 4: Run focused build tests**

```bash
node --test test/v23-2-build.test.mjs test/build.test.mjs test/home-match-links.test.mjs test/favorite-fallback.test.mjs
```

Expected: all PASS; existing v23.1 regression tests remain green.

- [ ] **Step 5: Run the real TEST build**

```bash
npm run build
```

Expected: command exits 0; `dist/index.html` contains both `ciao-web-github-test-runtime` and `ciao-v232-core`; `dist/v23.2/index.mjs` exists.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-test/scripts/build.mjs cloudflare-test/test/v23-2-build.test.mjs
git commit -m "build: ship v23.2 core beside v23.1"
```

---

### Task 6: Full Regression Gate and Milestone Marker

**Files:**
- Modify: `cloudflare-test/README.md`
- No application behavior files unless verification exposes a regression.

**Interfaces:**
- Consumes the complete Task 1–5 milestone.
- Produces a documented green checkpoint for the next API/source implementation plan.

- [ ] **Step 1: Run the complete test suite**

```bash
npm test
```

Expected: every existing v23.1 test and every `v23-2-*.test.mjs` test PASS.

- [ ] **Step 2: Build the complete TEST artifact**

```bash
npm run build
```

Expected: exit 0 and JSON result with `ok: true` from `scripts/build.mjs`.

- [ ] **Step 3: Verify the produced HTML has no v23.2 screen switch**

Run:

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');if(!h.includes('ciao-v232-core'))process.exit(1);if(h.includes('data-cw232-screen'))process.exit(2);console.log('v23.2 core loaded, v23.1 UI still authoritative')"
```

Expected output:

```text
v23.2 core loaded, v23.1 UI still authoritative
```

- [ ] **Step 4: Update README milestone note**

Append exactly:

```markdown
## v23.2 migration checkpoint

The v23.2 competition model and Tournament Engine are loaded in TEST as inert ES modules under `/v23.2/`. v23.1 remains the visible UI until the next migration milestone explicitly switches a screen.
```

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/README.md
git commit -m "docs: mark v23.2 core checkpoint"
```

- [ ] **Step 6: Verify GitHub Actions**

Open the `Ciao TEST check` run for the final `develop` commit and confirm both steps are green:

```text
Test — success
Build TEST artifact — success
```

Do not claim the visual TEST app changed; this milestone is intentionally invisible to users.

---

## Follow-on Plans After This Milestone

The following plans are separate because they each have their own data/storage or UI failure modes and must produce an independently reviewable TEST checkpoint:

1. `v23.2 API/source integration` — repo-manage the normalized TEST API contract, connect real Serie A/Coppa/UCL/UEL/UECL data, server cache and `dataVersion` without changing Production API.
2. `v23.2 Matches` — five competition landing/detail screens, themes, stage/round navigation, route-state restoration and Match Center links.
3. `v23.2 Predictions` — all-available feed, five competition screens, quick prediction states and competition-aware persistence while preserving the existing scoring formula.
4. `v23.2 Rankings` — five competition tables, derived overall ranking, snapshots, movement and participant profile.
5. `v23.2 Home + Match Center cutover` — favorite club across competitions, unified Today, ranking/prediction summary, one themed Match Center and final TEST acceptance suite.

The next plan must not be written against guessed provider routes. During execution of this core milestone, inspect the existing `ciao-web-api` contract through the TEST service binding and record the concrete upstream/API shapes before writing the API/source integration plan.
