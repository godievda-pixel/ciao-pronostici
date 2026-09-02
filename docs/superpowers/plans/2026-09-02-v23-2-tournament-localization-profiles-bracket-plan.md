# Ciao Web v23.2 Tournament Localization, Profiles and Coppa Bracket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BSD-backed tournaments production-quality in TEST: deduplicated Coppa Italia, user-local kickoff times, Russian labels/team names, tournament fixtures in club profiles, and a Coppa playoff bracket.

**Architecture:** Keep BSD as the canonical source for Coppa/UCL/UEL/UECL and Serie A on the existing legacy path. Add focused v23.2 utilities for localization, deduplication, bracket derivation and profile merging; patch only the TEST build integration points. UI consumes the enriched canonical match model while raw provider IDs/timestamps remain unchanged.

**Tech Stack:** Cloudflare Workers, browser ES modules, Node 22 `node:test`, GitHub Actions, BSD Football API v2.

**Spec:** `docs/superpowers/specs/2026-09-02-v23-2-tournament-localization-profiles-bracket-design.md`

## Global Constraints

- Work only in `develop` until all tests and live TEST probes are GREEN.
- Production `ciao-web-app` must not change.
- BSD token remains server-side and is never logged or returned.
- Serie A stays on the existing verified `ciao-web-api` schedule path.
- Unknown team translations fall back to raw BSD names.
- Bracket must not invent unknown pairings; use `Соперник определяется`.
- Tournament times use the browser/device time zone; no forced `Europe/Rome` in v23.2.

---

### Task 1: Russian tournament/team labels and device-local kickoff time

**Files:**
- Create: `cloudflare-test/src/v23.2/team-registry.mjs`
- Modify: `cloudflare-test/src/v23.2/competition-config.mjs`
- Modify: `cloudflare-test/src/v23.2/bsd-adapter.mjs`
- Modify: `cloudflare-test/src/v23.2/matches-ui.mjs`
- Create: `cloudflare-test/test/v23-2-localization.test.mjs`

**Interfaces:**
- Produces `localizeTeam(team): canonicalTeam` and `russianTeamName(rawName): string`.
- `canonicalTeam` preserves `id`, `crestUrl`, `countryCode` and replaces only display `name` when a registry mapping exists.
- Tournament UI continues to consume canonical matches.

- [ ] **Step 1: Write failing localization/time tests**

```js
assert.equal(getCompetitionConfig('coppa_italia').title, 'Кубок Италии');
assert.equal(getCompetitionConfig('ucl').title, 'Лига Чемпионов');
assert.equal(getCompetitionConfig('uel').title, 'Лига Европы');
assert.equal(getCompetitionConfig('uecl').title, 'Лига Конференций');
assert.equal(russianTeamName('Internazionale'), 'Интер');
assert.equal(russianTeamName('SSC Napoli'), 'Наполи');
assert.equal(russianTeamName('Unknown FC'), 'Unknown FC');
assert.equal(source.includes("timeZone: 'Europe/Rome'"), false);
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- --test-name-pattern="localization|local time"`
Expected: FAIL because titles are still English, registry does not exist and Rome is hard-coded.

- [ ] **Step 3: Implement minimal registry + config + formatter change**

Registry shape:

```js
const TEAM_NAMES_RU = Object.freeze({
  'internazionale': 'Интер',
  'inter': 'Интер',
  'ssc napoli': 'Наполи',
  'napoli': 'Наполи',
  'as roma': 'Рома',
  'roma': 'Рома',
  'ac milan': 'Милан',
  'milan': 'Милан',
  'acf fiorentina': 'Фиорентина',
  'fiorentina': 'Фиорентина',
  'juventus': 'Ювентус',
  'atalanta': 'Аталанта',
  'lazio': 'Лацио',
  'bologna': 'Болонья',
});
```

Formatter must be:

```js
new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
}).format(new Date(time));
```

No `timeZone` option.

- [ ] **Step 4: Run full tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: localize v23.2 tournaments and kickoff times`

---

### Task 2: Coppa Italia canonical deduplication and live duplicate guard

**Files:**
- Create: `cloudflare-test/src/v23.2/match-deduper.mjs`
- Modify: `cloudflare-test/src/v23.2/bsd-provider.mjs`
- Create: `cloudflare-test/test/v23-2-coppa-dedup.test.mjs`
- Modify: `cloudflare-test/scripts/probe-test-deployment.mjs`

**Interfaces:**
- `dedupeMatches(matches): Match[]`
- Primary key: `matchId`.
- Secondary fingerprint: `competition|stage|kickoffAt|homeTeam.id/name|awayTeam.id/name`.

- [ ] **Step 1: Write Fiorentina-style duplicate RED test**

```js
const rows = [
  match({ matchId:'coppa_italia:1', home:'Фиорентина', away:'Торино' }),
  match({ matchId:'coppa_italia:2', home:'Фиорентина', away:'Торино' }),
];
assert.equal(dedupeMatches(rows).length, 1);
```

Use identical stage/kickoff/team identity but different event IDs.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --test-name-pattern="Coppa.*duplicate"`
Expected: FAIL because provider currently returns all adapted rows.

- [ ] **Step 3: Implement deduper and apply before API response**

```js
export function matchFingerprint(match) {
  const team = value => String(value?.id || value?.name || '').trim().toLowerCase();
  return [
    match.competition, match.stage || '', match.kickoffAt || '',
    team(match.homeTeam), team(match.awayTeam),
  ].join('|');
}
```

Keep first occurrence for both match ID and fingerprint.

- [ ] **Step 4: Extend live probe**

Probe `competition=coppa_italia`, assert HTTP 200 and no repeated fingerprints. Report duplicate fingerprints only, never auth material.

- [ ] **Step 5: Run full tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `fix: deduplicate Coppa Italia fixtures`

---

### Task 3: Coppa Italia internal tabs and playoff bracket model

**Files:**
- Create: `cloudflare-test/src/v23.2/coppa-bracket.mjs`
- Modify: `cloudflare-test/src/v23.2/matches-ui.mjs`
- Create: `cloudflare-test/test/v23-2-coppa-bracket.test.mjs`

**Interfaces:**
- `buildCoppaBracket(matches): { rounds: BracketRound[] }`
- `BracketRound = { key, title, matches: BracketMatch[] }`
- `BracketMatch = { id, homeLabel, awayLabel, kickoffAt, status, score, sourceIds }`

- [ ] **Step 1: Write RED tests for stage order and unresolved slots**

```js
assert.deepEqual(bracket.rounds.map(r => r.key), ['round_of_16','quarterfinal','semifinal','final']);
assert.equal(next.awayLabel, 'Победитель пары Милан — Лацио');
```

If linkage cannot be derived:

```js
assert.equal(unknown.homeLabel, 'Соперник определяется');
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- --test-name-pattern="Coppa bracket"`
Expected: FAIL because bracket module/tabs do not exist.

- [ ] **Step 3: Implement conservative bracket derivation**

Normalize known stage strings to ordered keys. Use real upcoming/resolved BSD fixtures as authoritative slots. Only generate `Победитель пары A — B` when the downstream fixture exposes a missing participant that can be linked to exactly one upstream tie; otherwise use `Соперник определяется`.

- [ ] **Step 4: Add `Матчи` / `Сетка Плей-офф` segmented controls**

Add `data-cw232-coppa-view="matches|bracket"`; default is `matches`. Capture-phase handler switches only the Coppa screen body without closing the overlay.

Bracket viewport CSS:

```css
.cw232-bracket-viewport{overflow-x:auto;max-width:100%;overscroll-behavior-x:contain}
.cw232-bracket{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,260px);gap:16px;min-width:max-content}
```

No styles may set document/root overflow-x wider than viewport.

- [ ] **Step 5: Run full tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add Coppa Italia playoff bracket`

---

### Task 4: Merge BSD tournament matches into existing club profiles

**Files:**
- Create: `cloudflare-test/src/v23.2/profile-matches.mjs`
- Modify: `cloudflare-test/scripts/build.mjs`
- Modify: `cloudflare-test/src/ui-v23.1.js` only if runtime bridge is required by the source patch
- Create: `cloudflare-test/test/v23-2-profile-matches.test.mjs`
- Modify: `cloudflare-test/test/build.test.mjs`

**Interfaces:**
- `matchesForClub(allCompetitionData, clubIdentity): Match[]`
- `mergeClubMatches(legacyMatches, tournamentMatches): Match[]`
- browser bridge exposes cached v23.2 tournament matches read-only to the patched legacy club calendar renderer.

- [ ] **Step 1: Write RED merge/identity tests**

```js
const merged = mergeClubMatches([serieAMatch], [uclInter, duplicateSerieA]);
assert.deepEqual(merged.map(x => x.competition), ['serie_a','ucl']);
assert.equal(matchesForClub(data, { name:'Интер' })[0].matchId, uclInter.matchId);
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- --test-name-pattern="club profile"`
Expected: FAIL because enrichment module/source patch does not exist.

- [ ] **Step 3: Implement cached tournament feed for profiles**

Reuse the same `/api/v23.2/matches` client. Cache per competition/season in browser memory. Match club by registry BSD ID first, normalized aliases second. On failure return legacy profile unchanged.

- [ ] **Step 4: Patch legacy club calendar renderer in TEST build**

`build.mjs` adds one idempotent marker, e.g. `cw232-profile-tournament-enrichment`, around the existing club calendar renderer. Render extra fixtures with competition label (`Кубок Италии`, `Лига Чемпионов`, etc.) and existing match-card visual language.

- [ ] **Step 5: Run build + tests**

Run: `npm test && npm run build`
Expected: PASS and built HTML contains exactly one enrichment marker.

- [ ] **Step 6: Commit**

Commit message: `feat: add tournament fixtures to club profiles`

---

### Task 5: Unknown-team reporting, complete live probes, TEST merge

**Files:**
- Modify: `cloudflare-test/scripts/probe-test-deployment.mjs`
- Modify: `cloudflare-test/scripts/probe-bsd-provider.mjs`
- Modify tests only if probe contract needs coverage.

**Interfaces:**
- Live report includes only competition counts, duplicate fingerprints, unknown raw team names and safe sample fixture metadata.

- [ ] **Step 1: Extend provider/live probes**

Assert:

```text
Coppa Italia: HTTP 200, duplicateFingerprints = []
UCL: HTTP 200, matchCount >= 1
UEL: HTTP 200, valid JSON
UECL: HTTP 200, valid JSON
health: matchesProvider = bsd-v2, bsdConfigured = true
```

Also print `unknownTeamNames` from current supported feeds so registry gaps are visible.

- [ ] **Step 2: Add profile integration live marker**

The public TEST HTML must include `cw232-profile-tournament-enrichment`. A safe fixture-level probe verifies that at least one known Italian club has a non-Serie-A tournament fixture available for profile matching.

- [ ] **Step 3: Run complete verification**

Run: `npm test && npm run build && node scripts/probe-bsd-provider.mjs && node scripts/probe-test-deployment.mjs`
Expected: all PASS.

- [ ] **Step 4: Review diff against spec**

Confirm no `Europe/Rome`, no ESPN runtime, no duplicate Coppa fingerprints, no secret output, and production files outside the TEST integration boundary are unchanged.

- [ ] **Step 5: Merge `develop` to `main` only after GREEN**

Create PR, verify Cloudflare `ciao-web-app-test` deployment comment/status, rerun live deployment probe on deployed version.

- [ ] **Step 6: Stop before production**

Report TEST results and wait for explicit production approval.
