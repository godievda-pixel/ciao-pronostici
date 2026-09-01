# Ciao, Web! v23.2 Core Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TEST-only v23.2 multi-competition core—competition metadata, canonical match normalization, inclusion rules, Tournament Engine selectors, and a browser-safe module entry—without replacing any working v23.1 screen.

**Architecture:** Keep the existing v23.1 HTML patch as the visible TEST UI while introducing modular v23.2 ES modules under `cloudflare-test/src/v23.2/`. Node tests import those modules directly; the custom build copies the same modules unchanged to `dist/v23.2/` and loads only the inert `index.mjs` entry with `type="module"`. This milestone establishes the contract for the later real-data API plan and deliberately does not guess provider routes.

**Tech Stack:** JavaScript ES modules, Node.js 22 built-in test runner, Cloudflare Workers Static Assets, existing `cloudflare-test/scripts/build.mjs`, GitHub Actions `Ciao TEST check`.

**Spec:** `docs/superpowers/specs/2026-09-01-ciao-web-v23-2-multitournament-design.md`

## Global Constraints

- Work only on `develop` and `ciao-web-app-test`.
- Production `ciao-web-app` remains unchanged until explicit acceptance.
- Existing v23.1 favorite-club card and `Кальчо сегодня` behavior must remain green.
- Competition keys are exactly `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`.
- Serie A and Coppa Italia include every match; UCL, UEL and UECL include only matches with at least one Italian club.
- Match status is exactly one of `scheduled`, `live`, `finished`, `postponed`, `cancelled`.
- `predictionDeadline` is authoritative for prediction locking; LIVE polling never decides whether a prediction is open.
- Async hydration must not remount the v23.1 UI, reset scroll, or change card geometry.
- This milestone exposes core logic only. It does not switch Matches, Predictions, Rankings, Home or Match Center to v23.2 data.

---

## File Structure Locked by This Plan

- `cloudflare-test/src/v23.2/competition-config.mjs` — immutable competition/theme/navigation metadata.
- `cloudflare-test/src/v23.2/match-normalizer.mjs` — canonical team/match normalization and inclusion rule.
- `cloudflare-test/src/v23.2/tournament-engine.mjs` — pure selectors over normalized matches.
- `cloudflare-test/src/v23.2/index.mjs` — inert browser entry exposing `globalThis.CiaoV232Core`.
- `cloudflare-test/test/v23-2-competition-config.test.mjs` — config contract.
- `cloudflare-test/test/v23-2-normalizer.test.mjs` — canonical model, stable IDs and Italian-club filtering.
- `cloudflare-test/test/v23-2-engine.test.mjs` — chronological/group/favorite/prediction selectors.
- `cloudflare-test/test/v23-2-build.test.mjs` — module copy/injection and v23.1 coexistence.
- `cloudflare-test/scripts/build.mjs` — copy v23.2 modules and inject the inert module entry after the existing v23.1 patch.
- `cloudflare-test/README.md` — checkpoint note after the milestone is green.

---

### Task 1: Competition Configuration Contract

**Files:**
- Create: `cloudflare-test/src/v23.2/competition-config.mjs`
- Create: `cloudflare-test/test/v23-2-competition-config.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `COMPETITION_KEYS`, `COMPETITIONS`, `getCompetitionConfig(key)`.

- [ ] **Step 1: Write the failing configuration test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPETITION_KEYS, COMPETITIONS, getCompetitionConfig } from '../src/v23.2/competition-config.mjs';

test('v23.2 defines exactly five competition configs', () => {
  assert.deepEqual(COMPETITION_KEYS, ['serie_a','coppa_italia','ucl','uel','uecl']);
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

- [ ] **Step 2: Run test to verify RED**

```bash
cd cloudflare-test
node --test test/v23-2-competition-config.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the immutable competition config**

```js
export const COMPETITION_KEYS = Object.freeze(['serie_a','coppa_italia','ucl','uel','uecl']);

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

- [ ] **Step 4: Run test to verify GREEN**

```bash
node --test test/v23-2-competition-config.test.mjs
```

Expected: 2 PASS.

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
- Consumes: `getCompetitionConfig(key)`.
- Produces: `MATCH_STATUSES`, `normalizeTeam(raw)`, `normalizeMatch(raw, competition)`, `shouldIncludeMatch(match)`.
- Canonical `matchId`: string `${competition}:${sourceId}`.

- [ ] **Step 1: Write failing normalizer tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMatch, shouldIncludeMatch } from '../src/v23.2/match-normalizer.mjs';

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
  assert.equal(match.homeScore, null);
  assert.equal(match.awayScore, null);
  assert.equal(match.predictionDeadline, '2026-09-15T18:59:59Z');
  assert.deepEqual(Object.keys(match), [
    'matchId','competition','season','stage','round','kickoffAt','status','minute',
    'homeTeam','awayTeam','homeScore','awayScore','aggregateScore','leg','venue',
    'predictionDeadline','rawVersion',
  ]);
});

test('includes all domestic matches and only Italian-club European matches', () => {
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

- [ ] **Step 2: Run test to verify RED**

```bash
node --test test/v23-2-normalizer.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement team/country/status normalization**

```js
import { getCompetitionConfig } from './competition-config.mjs';

export const MATCH_STATUSES = Object.freeze(['scheduled','live','finished','postponed','cancelled']);

const STATUS_MAP = Object.freeze({
  NS: 'scheduled', SCHEDULED: 'scheduled', TIMED: 'scheduled',
  LIVE: 'live', '1H': 'live', HT: 'live', '2H': 'live', ET: 'live', PEN_LIVE: 'live',
  FT: 'finished', AET: 'finished', PEN: 'finished', FINISHED: 'finished',
  PST: 'postponed', POSTPONED: 'postponed',
  CANC: 'cancelled', CANCELLED: 'cancelled',
});

const COUNTRY_CODES = Object.freeze({
  italy: 'ITA', italia: 'ITA', england: 'ENG', spain: 'ESP', germany: 'GER', france: 'FRA', portugal: 'POR',
});

function text(value) { return String(value ?? '').trim(); }
function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeTeam(raw = {}) {
  const country = text(raw.country || raw.country_name);
  return Object.freeze({
    id: text(raw.id ?? raw.team_id),
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

- [ ] **Step 4: Run focused tests to verify GREEN**

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
- Consumes: canonical normalized match objects.
- Produces: `sortChronologically(matches)`, `matchesForCompetition(matches,key)`, `groupForCompetition(matches,key)`, `availablePredictions(matches,now)`, `nextMatchForTeam(matches,teamId,now)`.

- [ ] **Step 1: Write failing engine tests with a fixed clock**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMatch } from '../src/v23.2/match-normalizer.mjs';
import { sortChronologically, matchesForCompetition, groupForCompetition, availablePredictions, nextMatchForTeam } from '../src/v23.2/tournament-engine.mjs';

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
  assert.deepEqual(sortChronologically(matches).map(x => x.matchId), ['serie_a:1','coppa_italia:2','ucl:3']);
  assert.deepEqual(matchesForCompetition(matches, 'ucl').map(x => x.matchId), ['ucl:3']);
});

test('league groups by round while cups group by stage', () => {
  assert.equal(groupForCompetition(matches, 'serie_a')[0].key, '3');
  assert.equal(groupForCompetition(matches, 'coppa_italia')[0].key, '1/16');
});

test('prediction availability uses predictionDeadline rather than match status', () => {
  const now = Date.parse('2026-09-05T18:00:00Z');
  assert.deepEqual(availablePredictions(matches, now).map(x => x.matchId), ['serie_a:1','coppa_italia:2','ucl:3']);
});

test('favorite team next match scans every competition', () => {
  assert.equal(nextMatchForTeam(matches, '10', Date.parse('2026-09-01T00:00:00Z')).matchId, 'serie_a:1');
});
```

- [ ] **Step 2: Run test to verify RED**

```bash
node --test test/v23-2-engine.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement selectors without DOM/network access**

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
  const groups = new Map();
  for (const match of matchesForCompetition(matches, key)) {
    const rawKey = config.navigation === 'rounds' ? match.round : match.stage;
    const groupKey = String(rawKey ?? '');
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(match);
  }
  return [...groups.entries()].map(([groupKey, groupMatches]) => ({ key: groupKey, matches: sortChronologically(groupMatches) }));
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

- [ ] **Step 4: Run the whole v23.2 unit suite**

```bash
node --test test/v23-2-*.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.2/tournament-engine.mjs cloudflare-test/test/v23-2-engine.test.mjs
git commit -m "feat: add v23.2 tournament selectors"
```

---

### Task 4: Browser Entry With Zero UI Side Effects

**Files:**
- Create: `cloudflare-test/src/v23.2/index.mjs`
- Modify: `cloudflare-test/test/v23-2-engine.test.mjs`

**Interfaces:**
- Consumes: all Task 1–3 exports.
- Produces: `globalThis.CiaoV232Core`.
- Side effects allowed: assigning that one global only.

- [ ] **Step 1: Add failing browser-entry test**

```js
import { readFile } from 'node:fs/promises';

test('browser entry exposes core only and has no rendering side effects', async () => {
  const source = await readFile(new URL('../src/v23.2/index.mjs', import.meta.url), 'utf8');
  assert.match(source, /globalThis\.CiaoV232Core/);
  assert.doesNotMatch(source, /document\.|MutationObserver|setInterval|setTimeout|fetch\(/);
  delete globalThis.CiaoV232Core;
  await import(`../src/v23.2/index.mjs?test=${Date.now()}`);
  assert.equal(globalThis.CiaoV232Core.version, '23.2-core');
  assert.equal(globalThis.CiaoV232Core.competitions.length, 5);
});
```

- [ ] **Step 2: Run test to verify RED**

```bash
node --test test/v23-2-engine.test.mjs
```

Expected: FAIL because `index.mjs` does not exist.

- [ ] **Step 3: Implement the inert entry**

```js
import { COMPETITION_KEYS, COMPETITIONS, getCompetitionConfig } from './competition-config.mjs';
import { normalizeMatch, normalizeTeam, shouldIncludeMatch } from './match-normalizer.mjs';
import { sortChronologically, matchesForCompetition, groupForCompetition, availablePredictions, nextMatchForTeam } from './tournament-engine.mjs';

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

- [ ] **Step 4: Run v23.2 tests to verify GREEN**

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

### Task 5: Ship the Core Beside v23.1

**Files:**
- Modify: `cloudflare-test/scripts/build.mjs`
- Create: `cloudflare-test/test/v23-2-build.test.mjs`

**Interfaces:**
- Consumes: `src/v23.2/*.mjs`.
- Produces: `dist/v23.2/*.mjs` and exactly one `<script type="module" id="ciao-v232-core" src="/v23.2/index.mjs"></script>`.
- Existing `applyScheduleSourcePatch`, `applyFavoriteHtmlSourcePatch`, v23.1 CSS and v23.1 JS remain authoritative.

- [ ] **Step 1: Write failing build tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { injectV232Entry, copyV232Modules } from '../scripts/build.mjs';

test('injects one inert v23.2 module entry', () => {
  const html = '<html><body><div id="ciao-miniapp-root"></div></body></html>';
  const first = injectV232Entry(html);
  assert.equal(injectV232Entry(first), first);
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

- [ ] **Step 2: Run test to verify RED**

```bash
node --test test/v23-2-build.test.mjs
```

Expected: FAIL because `injectV232Entry` and `copyV232Modules` are not exported.

- [ ] **Step 3: Add copy/injection helpers to `scripts/build.mjs`**

Change the fs import:

```js
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
```

Add:

```js
const v232SourceDir = resolve(root, 'src/v23.2');
const v232OutDir = resolve(root, 'dist/v23.2');

export function injectV232Entry(input) {
  const html = String(input);
  if (html.includes('id="ciao-v232-core"')) return html;
  if (!/<\/body>/i.test(html)) throw new Error('v23.2 module entry requires body anchor');
  return html.replace(/<\/body>/i, '<script type="module" id="ciao-v232-core" src="/v23.2/index.mjs"></script>\n</body>');
}

export async function copyV232Modules() {
  await mkdir(v232OutDir, { recursive: true });
  const files = (await readdir(v232SourceDir)).filter(name => name.endsWith('.mjs'));
  for (const name of files) await copyFile(resolve(v232SourceDir, name), resolve(v232OutDir, name));
  return files.sort();
}
```

Inside `build()` keep the current v23.1 patch sequence, then use:

```js
await copyV232Modules();
const html = injectV232Entry(applyPatch(favoritePatched, css, js));
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, html, 'utf8');
```

- [ ] **Step 4: Run focused build/regression tests**

```bash
node --test test/v23-2-build.test.mjs test/build.test.mjs test/home-match-links.test.mjs test/favorite-fallback.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Run real TEST build**

```bash
npm run build
```

Expected: exit 0; `dist/index.html` contains both `ciao-web-github-test-runtime` and `ciao-v232-core`; `dist/v23.2/index.mjs` exists.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-test/scripts/build.mjs cloudflare-test/test/v23-2-build.test.mjs
git commit -m "build: ship v23.2 core beside v23.1"
```

---

### Task 6: Full Regression Gate and Checkpoint

**Files:**
- Modify: `cloudflare-test/README.md`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: a documented green checkpoint for the real-data API/source plan.

- [ ] **Step 1: Run complete suite**

```bash
npm test
```

Expected: every existing v23.1 test and every v23.2 test PASS.

- [ ] **Step 2: Build complete artifact**

```bash
npm run build
```

Expected: exit 0 with the existing build JSON reporting `ok: true`.

- [ ] **Step 3: Prove v23.2 has not switched a screen**

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('dist/index.html','utf8');if(!h.includes('ciao-v232-core'))process.exit(1);if(h.includes('data-cw232-screen'))process.exit(2);console.log('v23.2 core loaded, v23.1 UI still authoritative')"
```

Expected:

```text
v23.2 core loaded, v23.1 UI still authoritative
```

- [ ] **Step 4: Append the checkpoint to README**

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

Confirm the final `Ciao TEST check` run on `develop` shows:

```text
Test — success
Build TEST artifact — success
```

Do not claim a visible Telegram TEST change at this milestone; the core is intentionally inert.

---

## Follow-on Plans

These remain separate implementation plans because they have independent data/storage/UI failure modes:

1. **API/source integration** — record the concrete current `ciao-web-api` contract, then connect real Serie A, Coppa Italia, UCL, UEL and UECL sources to the canonical model with server cache and `dataVersion`, without changing Production.
2. **Matches** — five themed competition screens, round/stage navigation, route-state restoration and Match Center links.
3. **Predictions** — all-available feed, five competition screens, quick prediction states and competition-aware persistence with the existing scoring formula.
4. **Rankings** — five competition rankings, derived overall ranking, snapshots, movement and participant profile.
5. **Home + Match Center cutover** — favorite club across competitions, unified Today, prediction/ranking summary, one themed Match Center and final TEST acceptance.

Before writing the API/source integration plan, execution of this core plan must inspect the real existing `ciao-web-api` responses through the TEST service binding. The next plan will use those observed route/field names instead of invented provider contracts.
