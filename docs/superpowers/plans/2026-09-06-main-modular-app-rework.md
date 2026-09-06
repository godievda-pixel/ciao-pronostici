# Ciao, Web! Modular Production Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incrementally rebuild the requested production areas on a clean modular layer while keeping the current production experience unchanged everywhere else, retaining the current API/provider and existing scoring rules.

**Architecture:** Keep the current v22.5 production release as the visual/behavioral baseline. During build, inject a local ES-module layer and stylesheet into that release. The new layer has one router, one navigation-state owner, one Tournament Registry, one Data Service, one Live Engine and one shared Match Center. Migrated screens replace only their corresponding legacy surfaces. Existing non-targeted screens remain under the legacy runtime until explicitly migrated later.

**Tech Stack:** Cloudflare Workers/Static Assets, browser ES modules, vanilla CSS, Node 22 `node:test`, current `ciao-web-api`/current football provider contracts, Telegram WebApp init data, Wrangler 4.

**Spec:** `docs/superpowers/specs/2026-09-06-main-modular-app-rework-design.md`

## Global Constraints

- Work from `main` in a dedicated implementation branch. Do not commit feature work directly to `main`.
- Do not deploy `ciao-web-app` until the user explicitly approves production publication.
- Preserve `cloudflare-production/scripts/build.mjs` validation of the current v22.5 no-X2 baseline.
- Do not import or activate the old RoundXX TEST UI/runtime stack. Old TEST code may be consulted only to confirm API/data contracts.
- Keep the current API/provider. Do not introduce a new football-data vendor.
- Keep Telegram authentication and current prediction persistence/scoring semantics unchanged.
- Scoring rules remain identical for `Все`, `Италия`, and `Еврокубки`; only the included competitions differ.
- Exactly one Match Center component and one history/router owner are allowed.
- Browser/system Back and visible Match Center Back must share the same transition path.
- No navigation path may render an empty app shell.
- European match lists in the app include only Serie A clubs and exclude qualification.
- Coppa Italia match lists start at Round of 16; Coppa Italia is not added to `Таблицы` in this plan.
- Each task follows RED → GREEN → full regression → commit.

---

## Task 1: Lock the production baseline and inject the modular shell without changing visible behavior

**Files:**
- Modify: `cloudflare-production/scripts/build.mjs`
- Create: `cloudflare-production/src/modular/app.mjs`
- Create: `cloudflare-production/src/modular/app.css`
- Create: `cloudflare-production/test/modular-build.test.mjs`
- Keep green: `cloudflare-production/test/build.test.mjs`

**Purpose:** Establish a local modular entrypoint while continuing to serve the same fetched v22.5 release. The first modular build must be visually inert.

**Interfaces:**

```js
export function injectModularAssets(html) -> string
export async function copyModularAssets({ sourceDir, distDir }) -> void
```

The injected release must contain exactly one stylesheet and one module entry:

```html
<link rel="stylesheet" href="/modular/app.css" data-ciao-modular="main-v1">
<script type="module" src="/modular/app.mjs" data-ciao-modular="main-v1"></script>
```

- [ ] **Step 1: Write the failing build test**

Assert that a built production artifact:
- still contains `ciao-prod-no-x2-20260903`;
- contains one modular CSS link;
- contains one modular module script;
- copies `src/modular/app.mjs` and `app.css` to `dist/modular/`;
- does not contain any `round51`, `round50`, `cw239` or TEST Worker markers in the new modular assets.

- [ ] **Step 2: Verify RED**

```bash
cd cloudflare-production
npm test -- --test-name-pattern="modular build"
```

Expected: FAIL because no modular assets are injected yet.

- [ ] **Step 3: Implement the smallest build injection**

`app.mjs` must initially do only:

```js
export const MODULAR_BUILD = 'main-modular-v1';
document.documentElement.dataset.ciaoModular = MODULAR_BUILD;
```

`app.css` must not alter visible legacy styles yet.

- [ ] **Step 4: Verify GREEN and baseline regression**

```bash
npm test -- --test-name-pattern="modular build"
npm test
npm run build
```

Expected: all tests pass and the root artifact remains the v22.5 production UI plus the inert modular marker.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-production/scripts/build.mjs cloudflare-production/src/modular cloudflare-production/test/modular-build.test.mjs
git commit -m "feat: add inert modular production shell"
```

---

## Task 2: Observe and lock the current API/provider contract before building new screens

**Files:**
- Create: `cloudflare-production/scripts/probe-current-api.mjs`
- Create: `cloudflare-production/src/modular/data/api-contract.mjs`
- Create: `cloudflare-production/test/api-contract.test.mjs`
- Modify: `cloudflare-production/package.json`

**Purpose:** Preserve the user's requirement to keep the current API. Do not guess production endpoints from the discarded TEST architecture.

**Known production facts to verify:**
- Telegram init data remains the user auth source.
- Production currently permits the `ciao-web-app` origin against `ciao-core-api-fast-v4`.
- Existing Serie A, prediction, ranking and favorite-club behavior comes from the current v22.5 release/API.
- Current football-provider support for Coppa/UCL/UEL/UECL must be verified before UI wiring; provider identity must not change.

**Interfaces:**

```js
export function resolveTelegramInitData(root = globalThis) -> string
export function normalizeApiError(error) -> { code, status, message }
export const CURRENT_API = Object.freeze({ ...verified endpoints/capabilities... })
```

- [ ] **Step 1: Write a failing contract test**

Require `api-contract.mjs` to expose named capabilities rather than scattered URLs:

```js
assert.equal(typeof CURRENT_API.core, 'string');
assert.equal(CURRENT_API.capabilities.serieA, true);
assert.equal(CURRENT_API.capabilities.predictions, true);
assert.equal(CURRENT_API.capabilities.rankings, true);
assert.equal(CURRENT_API.capabilities.matchCenter, true);
assert.deepEqual(CURRENT_API.competitions, ['serie_a','coppa_italia','ucl','uel','uecl']);
```

- [ ] **Step 2: Add a read-only probe command**

Add to `package.json`:

```json
"probe:api": "node scripts/probe-current-api.mjs"
```

The probe may perform only GET/OPTIONS/read-only requests and source inspection. It must never save predictions, mutate profile data or expose API secrets.

- [ ] **Step 3: Run the probe against the actual production baseline**

```bash
npm run build
npm run probe:api
```

Record only stable endpoint/capability metadata in `api-contract.mjs`. Do not copy TEST hostnames such as `ciao-web-app-test`.

If any one of Coppa/UCL/UEL/UECL is unavailable through the current provider, stop implementation before Task 4 and resolve the existing-provider production binding; do not silently switch vendors.

- [ ] **Step 4: Verify contract test and CORS regression**

```bash
npm test -- --test-name-pattern="API contract|CORS"
npm test
```

- [ ] **Step 5: Commit**

```bash
git add cloudflare-production/scripts/probe-current-api.mjs cloudflare-production/src/modular/data/api-contract.mjs cloudflare-production/test/api-contract.test.mjs cloudflare-production/package.json
git commit -m "test: lock current production API contract"
```

---

## Task 3: Build Tournament Registry and canonical match selectors

**Files:**
- Create: `cloudflare-production/src/modular/core/tournament-registry.mjs`
- Create: `cloudflare-production/src/modular/data/match-normalizer.mjs`
- Create: `cloudflare-production/src/modular/data/selectors.mjs`
- Create: `cloudflare-production/test/tournament-registry.test.mjs`
- Create: `cloudflare-production/test/match-selectors.test.mjs`

**Canonical competition ids:**

```js
['serie_a', 'coppa_italia', 'ucl', 'uel', 'uecl']
```

**Canonical match model:**

```js
{
  id,
  competition,
  kickoffAt,
  status,
  minute,
  home: { id, name, crestUrl },
  away: { id, name, crestUrl },
  score: { home, away },
  round,
  stage,
  isQualification
}
```

**Required registry behavior:**
- Serie A theme: blue/calcio.
- Coppa Italia: red/green.
- UCL: dark blue/purple.
- UEL: orange/dark.
- UECL: green/dark.
- `tables: false` for Coppa Italia; true for Serie A/UCL/UEL/UECL.

**Pure selectors:**

```js
createSerieAClubIndex(standings) -> Set
involvesSerieAClub(match, clubIndex) -> boolean
selectNearestClubMatch(matches, clubIdentity, now) -> match | null
selectCalcioToday(matches, clubIndex, now) -> match[]
selectCompetitionFixtures(matches, competition, clubIndex) -> match[]
```

- [ ] **Step 1: Write RED registry tests** for all five ids, themes, labels and tables flags.
- [ ] **Step 2: Write RED selector tests** covering:
  - nearest future match across competitions;
  - local-calendar `today` matching;
  - one Serie A club in a UEFA match;
  - foreign-vs-foreign UEFA excluded from app fixture views;
  - qualification excluded;
  - Coppa rounds before 1/8 excluded;
  - Coppa 1/8, 1/4, 1/2 and final retained.
- [ ] **Step 3: Verify RED**

```bash
npm test -- --test-name-pattern="Tournament Registry|match selectors"
```

- [ ] **Step 4: Implement pure modules only**; no DOM, timers or network calls.
- [ ] **Step 5: Verify GREEN and full regression**

```bash
npm test -- --test-name-pattern="Tournament Registry|match selectors"
npm test
```

- [ ] **Step 6: Commit**

```bash
git add cloudflare-production/src/modular/core/tournament-registry.mjs cloudflare-production/src/modular/data/match-normalizer.mjs cloudflare-production/src/modular/data/selectors.mjs cloudflare-production/test/tournament-registry.test.mjs cloudflare-production/test/match-selectors.test.mjs
git commit -m "feat: add tournament registry and canonical selectors"
```

---

## Task 4: Add one Data Service and one Live Engine over the current API

**Files:**
- Create: `cloudflare-production/src/modular/data/api-client.mjs`
- Create: `cloudflare-production/src/modular/data/data-service.mjs`
- Create: `cloudflare-production/src/modular/core/live-engine.mjs`
- Create: `cloudflare-production/test/data-service.test.mjs`
- Create: `cloudflare-production/test/live-engine.test.mjs`

**Data Service interface:**

```js
createDataService({ apiClient }) => {
  loadMatches({ competition, from, to }),
  loadAllMatches({ from, to }),
  loadStandings(competition),
  loadFavoriteClub(),
  loadPredictions({ mode, competition }),
  loadRanking({ scope }),
  loadMatchCenter({ competition, matchId, section })
}
```

**Rules:**
- All browser calls pass Telegram init data through one client.
- One competition failure must not blank other competition results.
- Cache GET requests briefly; mutations invalidate relevant caches.
- No provider token is ever shipped into browser modules.

**Live Engine interface:**

```js
createLiveEngine({ refresh, intervalMs = 30000, retryMs = 15000 }) => {
  start(context),
  stop(),
  refreshNow(),
  subscribe(listener)
}
```

- [ ] **Step 1: Write RED Data Service tests** for isolated competition failure, normalized output and auth headers.
- [ ] **Step 2: Write RED Live Engine tests** for start/stop, single timer ownership, retry, stale-data retention and no polling after screen deactivation.
- [ ] **Step 3: Verify RED**.
- [ ] **Step 4: Implement the minimal shared services**.
- [ ] **Step 5: Verify GREEN and full regression**.
- [ ] **Step 6: Commit**

```bash
git add cloudflare-production/src/modular/data/api-client.mjs cloudflare-production/src/modular/data/data-service.mjs cloudflare-production/src/modular/core/live-engine.mjs cloudflare-production/test/data-service.test.mjs cloudflare-production/test/live-engine.test.mjs
git commit -m "feat: add shared data and live services"
```

---

## Task 5: Create the single Router/Navigation State before any Match Center replacement

**Files:**
- Create: `cloudflare-production/src/modular/core/navigation-state.mjs`
- Create: `cloudflare-production/src/modular/core/router.mjs`
- Create: `cloudflare-production/src/modular/core/dom-bridge.mjs`
- Create: `cloudflare-production/test/router.test.mjs`

**Route shape:**

```js
{
  screen: 'home' | 'favorite' | 'calcio' | 'predictions' | 'ranking' | 'matches' | 'tables' | 'match-center',
  subview: '',
  tournament: '',
  matchId: '',
  scrollY: 0,
  origin: null
}
```

**Router interface:**

```js
createRouter({ history, renderRoute, readScroll, restoreScroll, fallbackRoute }) => {
  navigate(route, { replace = false }),
  openMatchCenter({ competition, matchId }),
  back(),
  handlePopState(event),
  current()
}
```

**Hard behavior:** Render the destination first, then restore scroll. Invalid history state resolves to last valid top-level screen, otherwise Home.

- [ ] **Step 1: Write RED tests** for:
  - `Матчи → UCL → scrollY=740 → Match Center → Back`;
  - visible Back and `popstate` producing the same destination;
  - Predictions inner subview restoration;
  - invalid Match Center origin falling back to a valid screen;
  - no transition renders `null`/empty screen.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Implement Router and state serialization**.
- [ ] **Step 4: Verify GREEN and full regression**.
- [ ] **Step 5: Commit**.

---

## Task 6: Build the one shared Match Center and remove “Контекст Серии А” from the migrated flow

**Files:**
- Create: `cloudflare-production/src/modular/screens/match-center.mjs`
- Create: `cloudflare-production/src/modular/ui/match-center.css`
- Create: `cloudflare-production/test/match-center.test.mjs`
- Modify: `cloudflare-production/src/modular/app.mjs`

**Single tab contract:**

```js
[
  ['overview', 'Обзор'],
  ['stats', 'Статистика'],
  ['events', 'События'],
  ['lineups', 'Составы'],
  ['players', 'Игроки']
]
```

**Rules:**
- No `Контекст Серии А` tab or string in modular Match Center.
- Same renderer for all five competitions.
- Tournament Registry supplies theme tokens only; it does not choose a second Match Center implementation.
- Each section can fail independently without blanking the shell.
- Visible Back calls `router.back()` only.
- Match Center never adds its own `popstate` listener.

- [ ] **Step 1: Write RED contract tests** for all five competitions and exact five-tab structure.
- [ ] **Step 2: Write RED Back tests** proving only Router owns history.
- [ ] **Step 3: Verify RED**.
- [ ] **Step 4: Implement shared shell, lazy section loading and tournament theming**.
- [ ] **Step 5: Verify GREEN, then full regression**.
- [ ] **Step 6: Commit**.

---

## Task 7: Favorite club nearest match + “Кальчо сегодня” premium live cards

**Files:**
- Create: `cloudflare-production/src/modular/ui/match-card.mjs`
- Create: `cloudflare-production/src/modular/ui/empty-state.mjs`
- Create: `cloudflare-production/src/modular/screens/favorite-club.mjs`
- Create: `cloudflare-production/src/modular/screens/calcio-today.mjs`
- Create: `cloudflare-production/src/modular/ui/home-matches.css`
- Create: `cloudflare-production/test/favorite-calcio.test.mjs`
- Modify: `cloudflare-production/src/modular/app.mjs`

**Favorite club requirements:**
- exactly one chronologically nearest future fixture across all five competitions;
- crest for favorite club and opponent when available;
- competition/date/time visible;
- whole card has one click target and opens shared Match Center.

**Calcio today requirements:**
- only today's matches with at least one current Serie A club;
- all five supported competitions eligible;
- live status/score/minute updates from shared Live Engine;
- no upcoming fallback;
- exact empty copy: `Кальчо сегодня нет :(`.

- [ ] **Step 1: Write RED rendering/interaction tests** including Juventus-like favorite-club fixture example and full-card click.
- [ ] **Step 2: Write RED empty-state and live-update tests**.
- [ ] **Step 3: Verify RED**.
- [ ] **Step 4: Implement reusable premium match card plus both screens**.
- [ ] **Step 5: Verify GREEN and full regression**.
- [ ] **Step 6: Commit**.

---

## Task 8: Move prediction surface off Home and create “Прогнозы / Мои прогнозы” modes

**Files:**
- Create: `cloudflare-production/src/modular/data/prediction-bridge.mjs`
- Create: `cloudflare-production/src/modular/screens/predictions.mjs`
- Create: `cloudflare-production/src/modular/ui/predictions.css`
- Create: `cloudflare-production/test/predictions-migration.test.mjs`
- Modify: `cloudflare-production/src/modular/app.mjs`

**Hard rule:** Do not change scoring, deadline, persistence or save semantics in this task. Relocate/adapt the current prediction contract only.

**Screen state:**

```js
{ screen: 'predictions', subview: 'predictions' | 'mine' }
```

Default: `predictions`.

- [ ] **Step 1: Write RED tests** proving Home no longer owns prediction entry UI after modular mount.
- [ ] **Step 2: Write RED tests** for top-level label `Прогнозы`, two inner buttons and default `Прогнозы` state.
- [ ] **Step 3: Write RED regression tests** proving prediction payload/deadline/scoring fields pass through unchanged.
- [ ] **Step 4: Verify RED**.
- [ ] **Step 5: Implement bridge and screen** without duplicating persistence logic.
- [ ] **Step 6: Verify GREEN and full regression**.
- [ ] **Step 7: Commit**.

---

## Task 9: Replace “Таблица” with premium “Рейтинг” and three scopes

**Files:**
- Create: `cloudflare-production/src/modular/data/ranking-aggregator.mjs`
- Create: `cloudflare-production/src/modular/screens/ranking.mjs`
- Create: `cloudflare-production/src/modular/ui/ranking.css`
- Create: `cloudflare-production/test/ranking.test.mjs`
- Modify: `cloudflare-production/src/modular/app.mjs`

**Scopes:**

```js
const RANKING_SCOPES = {
  all: ['serie_a','coppa_italia','ucl','uel','uecl'],
  italy: ['serie_a','coppa_italia'],
  europe: ['ucl','uel','uecl']
};
```

Labels: `Все / Италия / Еврокубки`.

- [ ] **Step 1: Write RED aggregation tests** confirming the same scoring values are merely filtered/summed by competition membership.
- [ ] **Step 2: Write RED UI tests** for three buttons, top-3 treatment and current-user row.
- [ ] **Step 3: Verify RED**.
- [ ] **Step 4: Implement premium ranking without altering scorer logic**.
- [ ] **Step 5: Verify GREEN and full regression**.
- [ ] **Step 6: Commit**.

---

## Task 10: Completely rebuild “Матчи” as a tournament-first premium screen

**Files:**
- Create: `cloudflare-production/src/modular/ui/tournament-card.mjs`
- Create: `cloudflare-production/src/modular/screens/matches.mjs`
- Create: `cloudflare-production/src/modular/ui/matches.css`
- Create: `cloudflare-production/test/matches-screen.test.mjs`
- Modify: `cloudflare-production/src/modular/app.mjs`

**Entry experience:** five distinct premium tournament cards/buttons, not a plain tab row.

**Tournament fixture rules:**
- Serie A: current Serie A schedule.
- Coppa Italia: Round of 16 onward only.
- UCL/UEL/UECL: only fixtures involving current Serie A clubs; qualification excluded.
- Entire fixture card opens shared Match Center.
- Live fixtures update through shared Live Engine.

- [ ] **Step 1: Write RED tests** for five tournament entries and their Registry themes.
- [ ] **Step 2: Write RED fixture-filter tests** for Coppa stage and UEFA Serie-A-only/qualification rules.
- [ ] **Step 3: Write RED Router test** for tournament state + scroll restoration after Match Center Back.
- [ ] **Step 4: Verify RED**.
- [ ] **Step 5: Implement tournament-first screen and shared fixture list**.
- [ ] **Step 6: Verify GREEN and full regression**.
- [ ] **Step 7: Commit**.

---

## Task 11: Rename “Серия А” tables section to “Таблицы” and add European tables

**Files:**
- Create: `cloudflare-production/src/modular/screens/tables.mjs`
- Create: `cloudflare-production/src/modular/ui/tables.css`
- Create: `cloudflare-production/test/tables.test.mjs`
- Modify: `cloudflare-production/src/modular/app.mjs`

**Supported table views:**

```js
['serie_a', 'ucl', 'uel', 'uecl']
```

Coppa Italia must not appear.

- [ ] **Step 1: Write RED tests** for top-level label `Таблицы`, four supported views and absence of Coppa Italia.
- [ ] **Step 2: Write RED data tests** for normalized standing rows and per-tournament themes.
- [ ] **Step 3: Verify RED**.
- [ ] **Step 4: Implement one table structure with tournament theming**.
- [ ] **Step 5: Verify GREEN and full regression**.
- [ ] **Step 6: Commit**.

---

## Task 12: Integrate the modular screens with legacy production anchors without touching unrelated screens

**Files:**
- Create: `cloudflare-production/src/modular/core/legacy-surface-adapter.mjs`
- Create: `cloudflare-production/test/legacy-integration.test.mjs`
- Modify: `cloudflare-production/src/modular/app.mjs`
- Modify: `cloudflare-production/src/modular/app.css`

**Purpose:** Cut over only the approved surfaces and preserve everything else from v22.5.

**Migrated ownership:**
- favorite club upcoming card;
- `Кальчо сегодня`;
- `Прогнозы`;
- `Рейтинг`;
- `Матчи`;
- `Таблицы`;
- shared Match Center.

**Non-migrated ownership:** every other production section remains legacy-owned.

- [ ] **Step 1: Write RED source-anchor/integration tests** that fail safely if a required v22.5 host anchor disappears.
- [ ] **Step 2: Add idempotent mount/unmount ownership**; repeated navigation must not add duplicate event listeners or duplicate screens.
- [ ] **Step 3: Verify no RoundXX/TEST runtime is imported**.
- [ ] **Step 4: Run full tests and build**.

```bash
npm test
npm run build
```

- [ ] **Step 5: Commit**.

---

## Task 13: Production readiness, regression, Back-navigation matrix and dry-run only

**Files:**
- Create: `cloudflare-production/scripts/probe-production-build.mjs`
- Create: `cloudflare-production/test/production-regression.test.mjs`
- Create: `cloudflare-production/test/navigation-matrix.test.mjs`
- Modify: `cloudflare-production/package.json`

**Navigation matrix:**
- Favorite Club → Match Center → visible Back.
- Favorite Club → Match Center → system/browser Back.
- Кальчо сегодня → Match Center → both Back paths.
- Матчи → Serie A → Match Center → Back.
- Матчи → Coppa Italia → Match Center → Back.
- Матчи → UCL → Match Center → Back.
- Матчи → UEL → Match Center → Back.
- Матчи → UECL → Match Center → Back.
- Predictions subview → another screen → Back restores subview.
- Tables tournament → another screen → Back restores table selection.
- Invalid/stale history state → valid fallback, never empty shell.

**Regression matrix:**
- non-target production screens still exist and remain legacy-owned;
- production no-X2 patch remains present;
- prediction scoring/deadline unchanged;
- current provider identities unchanged;
- no TEST hostname or RoundXX UI/runtime marker in modular production assets.

- [ ] **Step 1: Add `probe:build`** to package scripts.
- [ ] **Step 2: Write RED/then GREEN navigation matrix tests**.
- [ ] **Step 3: Run the full verification suite**:

```bash
cd cloudflare-production
npm test
npm run build
npm run probe:api
npm run probe:build
npx wrangler deploy --dry-run
```

Expected: zero failed tests, successful build, API contract probe passes, build probe passes, Wrangler dry-run succeeds.

- [ ] **Step 4: Perform manual acceptance on a non-production local/preview artifact** for all seven changed product areas and all five Match Center themes. Confirm Back restores inner state and scroll.
- [ ] **Step 5: Commit readiness checks**.
- [ ] **Step 6: STOP. Do not merge to `main` and do not run real `wrangler deploy`. Ask the user for explicit production publication approval.**

---

## Implementation branch and checkpoint strategy

Start implementation from the approved design branch or a fresh implementation branch based on its latest commit:

```bash
git switch design/main-modular-app-rework
git switch -c feature/main-modular-app-rework
```

Recommended checkpoints:
1. Foundation ready after Tasks 1–5.
2. Shared Match Center ready after Task 6.
3. Home/favorite ready after Task 7.
4. Predictions + Ranking ready after Tasks 8–9.
5. Matches + Tables ready after Tasks 10–11.
6. Full integration ready after Tasks 12–13.

At every checkpoint, `main` and the live `ciao-web-app` remain unchanged.

## Definition of Done

The implementation is ready to ask for production deployment approval only when:
- the existing v22.5 production baseline still builds and its non-target screens are unchanged;
- the modular layer owns only the approved surfaces;
- one Router owns all migrated navigation/history;
- one shared Match Center serves Serie A, Coppa Italia, UCL, UEL and UECL;
- Match Center tabs are exactly `Обзор / Статистика / События / Составы / Игроки`;
- `Контекст Серии А` is absent;
- Favorite Club shows one nearest fixture across all five competitions and the full card opens Match Center;
- `Кальчо сегодня` includes today's supported matches with Serie A clubs and uses exact empty copy `Кальчо сегодня нет :(`;
- Home no longer hosts predictions;
- `Прогнозы` defaults to the `Прогнозы` subview and also provides `Мои прогнозы`;
- `Рейтинг` provides `Все / Италия / Еврокубки` with unchanged scoring;
- `Матчи` uses five tournament-first premium entries, Coppa starts at 1/8, UEFA views are Serie-A-club-only and exclude qualification;
- `Таблицы` contains Serie A/UCL/UEL/UECL and no Coppa Italia;
- live updates have one polling owner and retain last good data on refresh failure;
- visible Back and browser/system Back restore exact previous screen/subview/tournament/scroll state;
- no route can leave an empty screen;
- full tests, production build, API probe, build probe and Wrangler dry-run are green;
- no real production deployment has occurred without explicit user approval.
