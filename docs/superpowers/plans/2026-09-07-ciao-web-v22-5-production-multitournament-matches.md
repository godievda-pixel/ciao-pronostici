# Ciao, Web! v22.5 Production Multi-Tournament Matches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current production `Матчи` entry screen with a five-tournament hub and add BSD-backed Coppa Italia / UEFA calendars while preserving the current v22.5 Serie A behavior, visual language, club profiles and rollback path.

**Architecture:** Keep the resolved v22.5 release as the product shell. Add a small server-side Cloudflare Worker route for BSD-backed public match data, pure production match-normalization modules under `cloudflare-production/src/matches/`, and one build-time runtime patch that hooks the existing final v22.5 IIFE (`calendar`, `bind`, `refreshLive`, `openClubProfile`) instead of importing the old v23.2 frontend. Serie A continues to use its current schedule/live path; the new external competitions share one renderer styled from the existing Serie A scoreboard geometry.

**Tech Stack:** JavaScript ES modules, Node.js built-in test runner, Cloudflare Workers + Static Assets, BSD Football API v2, existing resolved v22.5 build-time injection.

**Spec:** `docs/superpowers/specs/2026-09-07-ciao-web-v22-5-production-multitournament-matches-design.md`

## Global Constraints

- Work on `main`; do not move `stable` during implementation or visual review.
- The immutable archival backup branch remains untouched.
- Current resolved v22.5 remains the production base; do not migrate the application to v23.x.
- Bottom labels become exactly `Прогноз`, `Прогнозы`, `Рейтинг`, `Матчи`, `Таблицы`, `Профиль`; only the three requested labels change.
- Tournament keys are exactly `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`.
- Serie A stays on its current production provider and existing match-center behavior.
- Coppa Italia shows Round of 32 (`1/16 финала`) and later only.
- UCL / UEL / UECL include only matches with at least one Italian club.
- External competition match cards never open Match Center.
- Only an Italian team that resolves to an existing production local club ID gets a clickable club-profile action; foreign clubs and unresolved clubs remain non-interactive rather than opening a broken profile.
- BSD team IDs are canonical for external competitions; BSD crest URLs remain `https://sports.bzzoiro.com/img/team/<id>/?bg=transparent`.
- No `custom_emoji_id`, Telegram emoji asset endpoint or `compat-v22-5-emoji.mjs` dependency may be added to the new path.
- `BSD_API_KEY` stays server-side. Browser JavaScript never receives it.
- External live refresh cadence is 30 seconds while the selected external tournament screen is visible; stale responses cannot overwrite newer state; refresh errors preserve the last good screen.
- No tournament logos, predictions for external tournaments, external tournament tables, foreign club profiles or external Match Center are part of this plan.

---

## File Structure Locked by This Plan

- `cloudflare-production/src/matches/competition-config.mjs` — competition labels, themes, aliases and stage ordering.
- `cloudflare-production/src/matches/normalizer.mjs` — canonical BSD team/match normalization, Italian detection, stage keys/labels and inclusion filters.
- `cloudflare-production/src/matches/bsd-provider.mjs` — BSD league/season/event fetching, pagination, date-range validation and safe upstream errors.
- `cloudflare-production/src/worker.js` — `/api/cw22/matches` and `/healthz`, final-response caching, Static Assets fallback.
- `cloudflare-production/scripts/multitournament-runtime.mjs` — build-time v22.5 runtime patch, hub/competition rendering, nav labels, UI state, live refresh and club-profile bridge.
- `cloudflare-production/scripts/build.mjs` — inject BSD crest patch first, multi-tournament runtime second, validate both.
- `cloudflare-production/wrangler.jsonc` — add Worker entrypoint + `ASSETS` binding and route `/api/*` through the Worker.
- `cloudflare-production/test/matches-core.test.mjs` — normalization, filtering and grouping tests.
- `cloudflare-production/test/bsd-provider.test.mjs` — BSD lookup / season fallback / pagination / diagnostics tests.
- `cloudflare-production/test/worker.test.mjs` — API boundary, secret gate, cache and Static Assets fallback.
- `cloudflare-production/test/multitournament-runtime.test.mjs` — hub markup, nav labels, themes, runtime state, interaction and stale-refresh behavior.
- `cloudflare-production/test/build.test.mjs` — final injection order and coexistence with current BSD crest patch.

---

### Task 1: Production Competition Contract and Stage Normalization

**Files:**
- Create: `cloudflare-production/src/matches/competition-config.mjs`
- Create: `cloudflare-production/src/matches/normalizer.mjs`
- Create: `cloudflare-production/test/matches-core.test.mjs`

**Interfaces:**
- Consumes: no production runtime globals.
- Produces:
  - `COMPETITION_KEYS: readonly string[]`
  - `getCompetitionConfig(key): CompetitionConfig`
  - `normalizeBsdEvent(event, competition, { italianTeamIds }): Match | null`
  - `groupMatches(matches, competition): MatchGroup[]`
  - `isExternalCompetition(key): boolean`
  - `isItalianTeam(team): boolean`

- [ ] **Step 1: Write RED tests for the exact competition contract**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPETITION_KEYS,
  getCompetitionConfig,
} from '../src/matches/competition-config.mjs';
import {
  normalizeBsdEvent,
  groupMatches,
} from '../src/matches/normalizer.mjs';

test('production matches defines the five approved tournaments in display order', () => {
  assert.deepEqual(COMPETITION_KEYS, ['serie_a','coppa_italia','ucl','uel','uecl']);
  assert.equal(getCompetitionConfig('serie_a').title, 'Серия А');
  assert.equal(getCompetitionConfig('coppa_italia').title, 'Кубок Италии');
  assert.equal(getCompetitionConfig('ucl').title, 'Лига Чемпионов');
  assert.equal(getCompetitionConfig('uel').title, 'Лига Европы');
  assert.equal(getCompetitionConfig('uecl').title, 'Лига Конференций');
});
```

Add fixtures covering scheduled, live, finished, postponed and cancelled BSD events. Assert a live fixture produces `status:'live'`, numeric `minute`, scores and BSD crest URLs.

Add Coppa fixtures with `Round of 64`, `Round of 32`, `Round of 16`, quarter-final, semi-final and final stage strings. Assert Round of 64 is rejected and the remaining groups are ordered `r32 -> r16 -> qf -> sf -> final` with labels `1/16 финала`, `1/8 финала`, `1/4 финала`, `1/2 финала`, `Финал`.

Add UCL fixtures where (a) neither club is Italian, (b) home is Italian, (c) away is Italian. Assert only (b) and (c) survive. Assert league-stage round 3 renders group label `Общий этап · 3 тур` and knockout groups sort after all league-stage rounds.

- [ ] **Step 2: Run tests and confirm RED**

```bash
cd cloudflare-production
node --test test/matches-core.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for the new production modules.

- [ ] **Step 3: Implement immutable competition metadata**

Use Russian UI titles and CSS theme keys:

```js
export const COMPETITION_KEYS = Object.freeze(['serie_a','coppa_italia','ucl','uel','uecl']);

export const COMPETITIONS = Object.freeze({
  serie_a: Object.freeze({ key:'serie_a', title:'Серия А', theme:'serie-a', external:false }),
  coppa_italia: Object.freeze({ key:'coppa_italia', title:'Кубок Италии', theme:'coppa', external:true }),
  ucl: Object.freeze({ key:'ucl', title:'Лига Чемпионов', theme:'champions', external:true }),
  uel: Object.freeze({ key:'uel', title:'Лига Европы', theme:'europa', external:true }),
  uecl: Object.freeze({ key:'uecl', title:'Лига Конференций', theme:'conference', external:true }),
});
```

The external league-name aliases used by the provider are:

```js
coppa_italia: ['Coppa Italia'],
ucl: ['Champions League','UEFA Champions League'],
uel: ['Europa League','UEFA Europa League'],
uecl: ['Conference League','UEFA Conference League'],
```

- [ ] **Step 4: Implement canonical team/match normalization**

Canonical team shape:

```js
{
  id: String(bsdId),
  name: preferredLocalizedName,
  countryCode: 'ITA' | otherCode | '',
  crestUrl: bsdId ? `https://sports.bzzoiro.com/img/team/${bsdId}/?bg=transparent` : '',
  isItalian: boolean,
}
```

Prefer provider Russian fields when present in this order: `name_ru`, `ru_name`, `localized_name?.ru`, then `name` / `team_name`. Never infer Italian status from the display name when provider ID/country metadata exists.

Canonical match shape:

```js
{
  matchId: `${competition}:${sourceId}`,
  sourceId: String(sourceId),
  competition,
  kickoffAt,
  status: 'scheduled'|'live'|'finished'|'postponed'|'cancelled',
  minute: number|null,
  stageKey,
  stageLabel,
  stageOrder,
  round: number|null,
  homeTeam,
  awayTeam,
  homeScore: number|null,
  awayScore: number|null,
}
```

Stage normalization recognizes case-insensitive aliases for `League Phase` / `League Stage`, `Knockout Phase Play-offs`, `Round of 32`, `Round of 16`, quarter-finals, semi-finals and final. Unrecognized external stages may be represented with a sanitized provider label, but Coppa Italia includes only recognized `r32`, `r16`, `qf`, `sf`, `final` stages.

- [ ] **Step 5: Run core tests and confirm GREEN**

```bash
node --test test/matches-core.test.mjs
```

Expected: all core tests PASS.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-production/src/matches/competition-config.mjs cloudflare-production/src/matches/normalizer.mjs cloudflare-production/test/matches-core.test.mjs
git commit -m "feat: add production tournament match model"
```

---

### Task 2: BSD Provider Rebuilt for Production

**Files:**
- Create: `cloudflare-production/src/matches/bsd-provider.mjs`
- Create: `cloudflare-production/test/bsd-provider.test.mjs`

**Interfaces:**
- Consumes: `normalizeBsdEvent()` and external competition metadata from Task 1.
- Produces:
  - `fetchBsdMatches({ competition, from, to, apiKey, fetchImpl }): Promise<Match[]>`
  - `BsdUpstreamError { stage, status, code }`
  - `BSD_BASE = 'https://sports.bzzoiro.com/api/v2'`

- [ ] **Step 1: Write failing provider tests from observed TEST behavior, not by copying TEST source**

Use deterministic `fetchImpl` fixtures. Test these exact behaviors:

1. `/leagues/` lookup accepts the configured aliases.
2. `/leagues/{id}/season/` nested `current_season.id` is accepted.
3. If that payload contains no ID, `/leagues/{id}/seasons/` is queried and `is_current:true` wins; otherwise newest year/ID wins.
4. `/events/` is requested with `league_id`, `season_id`, `date_from`, `date_to`, `limit=200`, `offset` and pagination continues until complete.
5. For UCL/UEL/UECL, `/teams/?country_code=IT` is used to build the Italian BSD-ID set before normalization.
6. Date ranges over 370 days fail before calling BSD.
7. An upstream 401 containing token/error detail throws `BsdUpstreamError('leagues', 401, 'authentication_failed')` without embedding response body or API key in the message.

- [ ] **Step 2: Verify RED**

```bash
node --test test/bsd-provider.test.mjs
```

Expected: FAIL because `bsd-provider.mjs` does not exist.

- [ ] **Step 3: Implement the production provider**

Use the same verified BSD endpoint strategy as TEST, but write the module independently. Requests send only:

```js
{
  accept: 'application/json',
  authorization: `Token ${apiKey}`,
  'cache-control': 'no-cache',
}
```

`fetchAll()` uses `limit=200`, increments `offset` by returned page length, and stops on short page or `count` exhaustion.

`fetchBsdMatches()` fetches events plus Italian-team IDs for European competitions, normalizes each event in isolation, drops malformed events instead of failing the tournament, then returns chronological matches.

- [ ] **Step 4: Verify GREEN and compare behavior to the old TEST fixtures**

```bash
node --test test/bsd-provider.test.mjs test/matches-core.test.mjs
```

Expected: all PASS. Then read, but do not copy wholesale, `cloudflare-test/test/v23-2-bsd-season-resolution.test.mjs` and `cloudflare-test/test/v23-2-bsd-error-diagnostics.test.mjs`; ensure equivalent edge cases are represented in the new production tests.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-production/src/matches/bsd-provider.mjs cloudflare-production/test/bsd-provider.test.mjs
git commit -m "feat: add production BSD matches provider"
```

---

### Task 3: Server-Side Production API Boundary

**Files:**
- Create: `cloudflare-production/src/worker.js`
- Modify: `cloudflare-production/wrangler.jsonc`
- Create: `cloudflare-production/test/worker.test.mjs`

**Interfaces:**
- Consumes: `fetchBsdMatches()` from Task 2 and `env.BSD_API_KEY`.
- Produces:
  - `GET /healthz`
  - `GET /api/cw22/matches?competition=<key>&from=YYYY-MM-DD&to=YYYY-MM-DD`
  - all other paths -> `env.ASSETS.fetch(request)`.

- [ ] **Step 1: Write RED Worker tests**

Test with a stub `env.ASSETS.fetch` and injected provider/fetch fixtures:

- `/healthz` returns `{ok:true,service:'ciao-web-app',matches_provider:'bsd-v2',bsd_configured:true|false}` without returning the secret.
- `/api/cw22/matches` rejects POST with 405.
- Missing/non-external competition returns 400.
- Missing `x-telegram-init-data` returns 401. This is a lightweight client gate, not a claim of full Telegram signature verification.
- Missing `BSD_API_KEY` returns 503 `{error:'bsd_api_key_missing'}`.
- Successful response shape is:

```js
{
  ok: true,
  data: {
    competition,
    from,
    to,
    provider: 'bsd-v2',
    matches: [...]
  }
}
```

- BSD errors return only `upstream_stage`, `upstream_status`, `upstream_code`.
- Non-API request is delegated unchanged to `ASSETS.fetch`.

- [ ] **Step 2: Verify RED**

```bash
node --test test/worker.test.mjs
```

Expected: FAIL because `src/worker.js` does not exist.

- [ ] **Step 3: Implement Worker routing with a short final-response cache**

Use `caches.default` when available. Cache key is the full URL only; do not include Telegram init data. Cache successful external match responses for 20 seconds so a 30-second browser refresh remains current without re-running all BSD league/season lookups per user.

Return `cache-control: private, max-age=0` to the browser; the internal Worker cache handles provider shielding.

- [ ] **Step 4: Change Wrangler from assets-only to Worker + Assets**

Exact target shape:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "ciao-web-app",
  "main": "src/worker.js",
  "compatibility_date": "2026-09-03",
  "workers_dev": true,
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "run_worker_first": ["/healthz", "/api/*"]
  }
}
```

Do not add `CIAO_WEB_API` service binding: the current v22.5 Serie A application already talks to its existing endpoints directly, and this Worker is only needed for the BSD secret boundary.

- [ ] **Step 5: Verify Worker tests and Wrangler syntax**

```bash
node --test test/worker.test.mjs
node --check src/worker.js
npx wrangler deploy --dry-run
```

Expected: tests PASS, syntax clean, dry-run builds successfully.

- [ ] **Step 6: Secret readiness gate**

Before the external UI is allowed to be considered deployable, confirm the production Worker has `BSD_API_KEY`. If it is absent, set it without committing the value:

```bash
cd cloudflare-production
npx wrangler secret put BSD_API_KEY
```

Then verify `/healthz` reports `bsd_configured:true`. Never put the value in Git, plan output, test fixtures beyond fake strings, HTML, Worker responses or logs.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-production/src/worker.js cloudflare-production/wrangler.jsonc cloudflare-production/test/worker.test.mjs
git commit -m "feat: proxy production tournament matches through BSD"
```

---

### Task 4: Runtime Hub, Navigation Labels and Unified Tournament Renderer

**Files:**
- Create: `cloudflare-production/scripts/multitournament-runtime.mjs`
- Create: `cloudflare-production/test/multitournament-runtime.test.mjs`

**Interfaces:**
- Consumes at build time: `BSD_TEAM_ID_BY_LOCAL_ID` from `scripts/bsd-crests.mjs` to embed a reverse BSD -> local profile map.
- Consumes inside v22.5 IIFE: `root`, `main`, `tab`, `calendar`, `bind`, `refreshLive`, `render`, `openClubProfile`, `initData`, `fmt`, and existing Serie A scoreboard CSS classes.
- Produces:
  - `MULTITOURNAMENT_PATCH_MARKER = 'ciao-prod-multitournament-matches-20260907'`
  - `multitournamentRuntimeSource()`
  - `injectMultitournamentPatch(html)`
  - `validateMultitournamentPatchedHtml(html)`.

- [ ] **Step 1: Write RED runtime-source tests**

Assert the generated source contains exactly these navigation assignments:

```js
[data-tab="mine"] .nav-label -> Прогнозы
[data-tab="table"] .nav-label -> Рейтинг
[data-tab="seriea"] .nav-label -> Таблицы
```

Assert `Прогноз` is not renamed.

Assert the hub renders exactly five `data-cwmt-competition` buttons, no hint/subtitle nodes, and the first Serie A card has `cwmt-tournament-card--wide` while the other four use the shared grid.

Assert theme selectors/classes exist for `serie-a`, `coppa`, `champions`, `europa`, `conference` and all use the same match-card markup function.

Assert external cards do not contain a match-center action/handler.

Assert the embedded reverse mapping resolves BSD 77 -> local 8, BSD 63 -> local 12, BSD 62 -> local 14.

- [ ] **Step 2: Verify RED**

```bash
node --test test/multitournament-runtime.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement runtime state without an overlay or second app shell**

The patch is injected inside the final v22.5 IIFE and captures the final existing calendar implementation:

```js
const __cwMtLegacyCalendar = calendar;
const __cwMtLegacyBind = bind;
const __cwMtLegacyRefreshLive = refreshLive;
let __cwMtCompetition = '';
let __cwMtStageKey = '';
let __cwMtPayload = null;
let __cwMtLoading = false;
let __cwMtError = '';
let __cwMtRequestVersion = 0;
```

`calendar` becomes:

```js
calendar = function(){
  if (!__cwMtCompetition) return __cwMtHubHtml();
  if (__cwMtCompetition === 'serie_a') {
    return __cwMtTournamentCover('serie_a') + __cwMtLegacyCalendar();
  }
  return __cwMtExternalCompetitionHtml();
};
```

This preserves the current full Serie A schedule, round switcher, live behavior and Match Center instead of reimplementing them.

- [ ] **Step 4: Implement the five-card premium hub**

CSS layout:

```css
.cwmt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.cwmt-tournament-card--wide{grid-column:1/-1}
@media(max-width:340px){.cwmt-grid{grid-template-columns:1fr}}
```

Cards contain only the Russian tournament name and arrow. Keep current app radii/typography; no tournament logo assets.

Theme covers use one structural class plus theme variables. Required visual directions:

```css
[data-cwmt-theme="serie-a"]{--cwmt-a:#3150ff;--cwmt-b:#0b2f88}
[data-cwmt-theme="coppa"]{--cwmt-a:#159457;--cwmt-b:#9f2435}
[data-cwmt-theme="champions"]{--cwmt-a:#3d4ec9;--cwmt-b:#33246f}
[data-cwmt-theme="europa"]{--cwmt-a:#e66a13;--cwmt-b:#3a1b08}
[data-cwmt-theme="conference"]{--cwmt-a:#28a968;--cwmt-b:#0b3b28}
```

Use them for the cover, active stage chip and small accents. Match-card geometry stays shared.

- [ ] **Step 5: Implement the external stage switcher and match cards using current Serie A structure**

Use the existing class vocabulary where safe (`rounds`, `round-chip`, `scoreboard-card`, `scoreboard-main`, `board-team`, `board-score`) plus `cwmt-*` scoping classes. Stage buttons use `data-cwmt-stage` rather than `data-round`, preventing the legacy Serie A `bind()` from treating them as league rounds.

For an external match card set `data-cwmt-match` but do not set a numeric `data-mid` that could be consumed by `openMatchCenter()`.

Before kickoff the center displays formatted kickoff time, not `— : —`. Live displays score plus `LIVE · 67′`; finished displays final score; postponed/cancelled display Russian status.

Italian club markup gets `data-cwmt-local-club="<localId>"` only when the BSD ID resolves through the embedded reverse map. Foreign/unresolved clubs use a non-button `div` with no pointer affordance.

- [ ] **Step 6: Wrap `bind()` after the legacy bind**

The wrapper must:

1. call `__cwMtLegacyBind()` first so all existing application features remain wired;
2. bind hub tournament buttons;
3. bind external stage chips;
4. bind back-to-hub and retry controls;
5. bind `[data-cwmt-local-club]` to `openClubProfile(Number(id))` with `stopPropagation()`;
6. never bind an external match card to `openMatchCenter`.

When another bottom nav tab is selected, reset external refresh timers but keep ordinary application navigation unchanged. Re-entering `Матчи` starts at the tournament hub, not at a previously selected external tournament.

- [ ] **Step 7: Verify GREEN**

```bash
node --test test/multitournament-runtime.test.mjs
node --check scripts/multitournament-runtime.mjs
```

Expected: all runtime tests PASS and syntax clean.

- [ ] **Step 8: Commit**

```bash
git add cloudflare-production/scripts/multitournament-runtime.mjs cloudflare-production/test/multitournament-runtime.test.mjs
git commit -m "feat: add production tournament matches UI"
```

---

### Task 5: External Data Loading, Stage Selection and Live Refresh

**Files:**
- Modify: `cloudflare-production/scripts/multitournament-runtime.mjs`
- Modify: `cloudflare-production/test/multitournament-runtime.test.mjs`

**Interfaces:**
- Consumes: `/api/cw22/matches` from Task 3.
- Produces internal runtime functions:
  - `__cwMtSeasonRange(now)`
  - `__cwMtLoadCompetition(key, { quiet=false })`
  - `__cwMtApplyPayload(version, payload)`
  - `__cwMtPatchVisibleMatches(nextPayload)`
  - `__cwMtStartRefresh()` / `__cwMtStopRefresh()`.

- [ ] **Step 1: Extend tests with deterministic async stale-response coverage**

Create two deferred promises. Start request A, then request B; resolve B first with score `2:1`, then A with old score `1:0`. Assert the runtime model remains `2:1`.

Add a test where the first load succeeds, the next quiet refresh rejects, and `__cwMtPayload` / rendered match HTML retain the successful data while an unobtrusive refresh error state may be recorded.

Add a test that changing stage from `league:2` to `league:3` followed by a refresh preserves `league:3` if that stage still exists.

- [ ] **Step 2: Verify the new tests fail for the expected missing refresh behavior**

```bash
node --test test/multitournament-runtime.test.mjs
```

Expected: FAIL on stale/preservation assertions.

- [ ] **Step 3: Implement browser API loading**

Season range is July 1 through June 30 around the current date, matching the verified TEST convention and staying under the provider's 370-day limit.

Request:

```js
const url = new URL('/api/cw22/matches', location.origin);
url.searchParams.set('competition', key);
url.searchParams.set('from', range.from);
url.searchParams.set('to', range.to);
const response = await fetch(url, {
  headers: {
    accept: 'application/json',
    'x-telegram-init-data': initData,
  },
  cache: 'no-store',
});
```

Initial load shows current-app-style skeleton cards. Failure shows a compact Russian message plus `Повторить`, without breaking bottom navigation.

- [ ] **Step 4: Implement 30-second live refresh**

Only refresh when:

```js
tab === 'calendar' &&
__cwMtCompetition &&
__cwMtCompetition !== 'serie_a' &&
!document.hidden
```

Use `setInterval(..., 30000)`. Increment `__cwMtRequestVersion` for every request; apply a response only when its captured version equals the current version and the selected competition is unchanged.

Quiet refresh patches only status/score/minute nodes identified by `data-cwmt-match`, avoiding `main.innerHTML` replacement. If grouping/stage membership changes materially (for example a newly available knockout stage), update the in-memory payload and re-render once while preserving selected stage when possible.

- [ ] **Step 5: Preserve the existing Serie A refresh path**

`refreshLive` wrapper:

```js
refreshLive = async function(){
  const result = await __cwMtLegacyRefreshLive();
  if (tab === 'calendar' && __cwMtCompetition && __cwMtCompetition !== 'serie_a') {
    // external refresh is owned by __cwMtStartRefresh; do not call Serie A Match Center APIs for these cards
  }
  return result;
};
```

Do not disable or modify the existing `__cw2013` / `__cw209` Serie A machinery.

- [ ] **Step 6: Verify GREEN**

```bash
node --test test/multitournament-runtime.test.mjs
```

Expected: stale response, error preservation, selected-stage preservation and normal UI tests all PASS.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-production/scripts/multitournament-runtime.mjs cloudflare-production/test/multitournament-runtime.test.mjs
git commit -m "feat: refresh external tournament scores live"
```

---

### Task 6: Build-Time Injection and Coexistence With BSD Crest Patch

**Files:**
- Modify: `cloudflare-production/scripts/build.mjs`
- Modify: `cloudflare-production/test/build.test.mjs`

**Interfaces:**
- Consumes: `injectBsdCrestPatch()` first and `injectMultitournamentPatch()` second.
- Produces: final resolved v22.5 HTML containing both markers exactly once.

- [ ] **Step 1: Add RED build assertions**

Extend `fixtureRelease()` tests to assert:

```js
const prepared = prepareReleaseHtml(fixtureRelease());
assert.match(prepared, /ciao-prod-bsd-crests-20260907/);
assert.match(prepared, /ciao-prod-multitournament-matches-20260907/);
assert.ok(
  prepared.indexOf('ciao-prod-bsd-crests-20260907') <
  prepared.indexOf('ciao-prod-multitournament-matches-20260907')
);
assert.match(prepared, /Прогнозы/);
assert.match(prepared, /Рейтинг/);
assert.match(prepared, /Таблицы/);
assert.doesNotMatch(prepared, /compat-v22-5-emoji\.mjs/);
```

Also run `prepareReleaseHtml()` twice and ensure neither patch duplicates.

- [ ] **Step 2: Verify RED**

```bash
node --test test/build.test.mjs
```

Expected: FAIL because multi-tournament injection is not wired.

- [ ] **Step 3: Update `prepareReleaseHtml()` in this exact order**

```js
const withCrests = injectBsdCrestPatch(source);
validateBsdCrestPatchedHtml(withCrests);
const release = injectMultitournamentPatch(withCrests);
validateMultitournamentPatchedHtml(release);
return release;
```

The order is mandatory because the tournament runtime may use the BSD crest helpers already injected into the same final IIFE.

- [ ] **Step 4: Run the complete production test and syntax suite**

```bash
node --check scripts/bsd-crests.mjs
node --check scripts/multitournament-runtime.mjs
node --check scripts/build.mjs
node --check src/worker.js
node --test test/*.test.mjs
npm run build
```

Expected: zero failures and a generated `dist/index.html` / `dist/releases/v22-5.html`.

- [ ] **Step 5: Inspect generated HTML contract before commit**

Confirm with a small Node assertion or grep:

- both markers exactly twice each (opening + closing comments);
- `52px` club-profile crest override remains present;
- `/api/cw22/matches` appears;
- all five Russian tournament titles appear;
- no `compat-v22-5-emoji.mjs` appears;
- no literal `BSD_API_KEY` value appears.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-production/scripts/build.mjs cloudflare-production/test/build.test.mjs
git commit -m "build: inject production multitournament matches"
```

---

### Task 7: Pre-Deployment Regression Gate

**Files:**
- No production feature files should change unless a failing regression test exposes a real issue.
- Test fixes must be committed together with the minimal production fix they require.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: evidence that `main` is deployable while `stable` is still unchanged.

- [ ] **Step 1: Verify repository refs before deployment**

Record:

```bash
git rev-parse main
git rev-parse stable
```

`stable` must still equal `0dc28fa382d7bbdafdd428616afb310cbfcbcb30` unless the user explicitly changed that workflow later.

- [ ] **Step 2: Run full local verification again from a clean checkout**

```bash
cd cloudflare-production
npm ci
node --check scripts/bsd-crests.mjs
node --check scripts/multitournament-runtime.mjs
node --check scripts/build.mjs
node --check src/worker.js
npm test
npm run build
npx wrangler deploy --dry-run
```

Do not reuse previous test output. This is the verification-before-completion run.

- [ ] **Step 3: Verify server boundary with deterministic Worker tests**

Explicitly confirm the tests cover:

- secret missing -> 503;
- invalid competition -> 400;
- empty Telegram header -> 401;
- BSD failure -> safe 502 diagnostics;
- one successful UCL response contains only Italian-involved fixtures;
- one successful Coppa response contains no pre-1/16 fixture;
- static root is still served through `ASSETS`.

- [ ] **Step 4: Commit any necessary regression fix, otherwise make no code-only checkpoint commit**

Every regression fix must run RED -> GREEN before commit.

---

### Task 8: Production Deployment and Acceptance Verification

**Files:**
- Deployment may be triggered by the existing `main` integration; change `DEPLOY_TRIGGER` only if the Cloudflare integration demonstrably requires a new repository change after the final verified commit.

**Interfaces:**
- Production URL: `https://ciao-web-app.ciao-web.workers.dev/`
- Health: `https://ciao-web-app.ciao-web.workers.dev/healthz`

- [ ] **Step 1: Confirm BSD secret before exposing the feature**

Fetch `/healthz`. Required result: HTTP 200 and `bsd_configured:true`. If false, stop acceptance; set `BSD_API_KEY` server-side first.

- [ ] **Step 2: Confirm deployed HTML, not only Git**

Production root must return 200 and contain:

- `ciao-prod-bsd-crests-20260907`;
- `ciao-prod-multitournament-matches-20260907`;
- the navigation copy `Прогнозы`, `Рейтинг`, `Таблицы`;
- tournament titles `Серия А`, `Кубок Италии`, `Лига Чемпионов`, `Лига Европы`, `Лига Конференций`;
- current club crest rule `width:52px!important;height:52px!important`.

- [ ] **Step 3: Exercise the external API for each external key**

Using a valid Telegram Mini App init-data header, request current-season ranges for `coppa_italia`, `ucl`, `uel`, `uecl`. Verify HTTP 200, `provider:'bsd-v2'`, chronological matches and BSD crest URLs.

For Coppa, inspect every returned `stageKey` and ensure no stage precedes `r32`. For each UEFA response, inspect every match and ensure `homeTeam.isItalian || awayTeam.isItalian` is true.

- [ ] **Step 4: Visual/mobile acceptance checklist in the real Mini App**

Check at normal mobile width and <=390px:

1. Bottom labels read `Прогноз`, `Прогнозы`, `Рейтинг`, `Матчи`, `Таблицы`, `Профиль` without horizontal page scroll.
2. `Матчи` opens the five-card hub.
3. Serie A card spans the row; the other four form a clean 2x2 grid when width permits.
4. No card has a small subtitle.
5. Each tournament has the approved cover palette while preserving one shared match-card design.
6. Serie A retains its current round switcher, schedule, live updates and Match Center.
7. Coppa starts at `1/16 финала`.
8. UEFA league phase shows labels such as `Общий этап · N тур`; knockout stages follow chronologically.
9. Live fixture shows current score, `LIVE` and minute when provided.
10. Finished fixture shows only final state; postponed/cancelled copy is Russian.
11. Italian club with a production profile opens that existing profile and retains the BSD crest.
12. Foreign club has no click/hover affordance.
13. External match card itself never opens Match Center.
14. Back-to-hub and bottom navigation remain stable after external API errors/retry.
15. `Прогнозы`, `Рейтинг`, `Таблицы`, `Профиль` still render their existing content.

- [ ] **Step 5: Verify live refresh without a naturally live match if necessary**

If no external match is live during deployment, rely on the deterministic runtime test that patches `1:0 @ 61′` to `2:1 @ 67′` without re-rendering the whole screen, and record that no live production fixture was available for visual observation. Do not fabricate live production data.

- [ ] **Step 6: Verify rollback refs again**

Confirm `stable` and `backup-stable-v22.5-2026-09-07` were not moved by implementation/deployment.

- [ ] **Step 7: Ask for the user's visual approval**

Do not promote `stable` automatically. After the user confirms the production version is good, move `stable` forward to the approved `main` commit in the existing workflow; keep the immutable backup branch unchanged.

---

## Self-Review Record

**Spec coverage:** Every approved requirement maps to a task: nav labels and hub (Task 4), unified themed design (Task 4), Serie A preservation (Tasks 4-5), Coppa cutoff and UEFA Italian filtering (Tasks 1-3), BSD crests and team identity (Tasks 1/4), Italian profile links and foreign non-links (Task 4), no external Match Center (Task 4), live/stale/error behavior (Task 5), server-side BSD secret (Task 3), build coexistence (Task 6), deployment and regression checks (Tasks 7-8), rollback/stable discipline (Tasks 7-8).

**Placeholder scan:** No `TBD`, `TODO`, “implement later”, unspecified error-handling step or unnamed test remains. The only conditional deployment step is the real secret-readiness gate, with its exact health condition and secret command specified.

**Type/interface consistency:** External competition keys, canonical match/team fields, Worker route `/api/cw22/matches`, runtime state names and BSD/local club mapping are consistent across tasks. The runtime never sends BSD IDs directly to `openClubProfile`; it converts only known BSD IDs to the existing local production club IDs.