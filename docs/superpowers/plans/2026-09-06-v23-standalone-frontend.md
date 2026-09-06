# Ciao, Web! v23 Standalone Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy-overlaid TEST frontend with a genuinely standalone Telegram Mini App v23 that owns its HTML, DOM, router, state, localization, live updates and all five product sections.

**Architecture:** New code lives under `cloudflare-production/src/v23/` and is the only source copied into TEST `dist`. It uses vanilla ES modules and CSS, one router/state owner, one Telegram bridge, one API client and one live controller. The existing `src/modular/` code remains in Git history during implementation but is never imported by the new build.

**Tech Stack:** HTML5, CSS, JavaScript ES modules, Telegram Mini Apps WebApp API, Node 22 `node:test`, Cloudflare Workers Static Assets / Wrangler.

**Spec:** `docs/superpowers/specs/2026-09-06-v23-standalone-app-design.md`

**Dependency:** Complete `docs/superpowers/plans/2026-09-06-v23-backend-data.md` through its API contract gate, or provide deterministic mocked API fixtures with exactly the same contract while frontend work proceeds.

## Global Constraints

- The v23 build must not fetch, embed or transform `v22-5.html`.
- No import path may contain `src/modular`, `legacy-surface-adapter`, `dom-bridge`, or old release HTML.
- Exactly one router, one browser `popstate` listener, one Telegram BackButton owner, one live polling controller.
- Bottom navigation is exactly: `Главная`, `Прогнозы`, `Рейтинг`, `Матчи`, `Таблицы`.
- All user-facing team, tournament and stage names are Russian; no English fallback is rendered.
- Russian plural/case logic is centralized and tested for `1 / 2 / 5 / 11 / 21 / 22 / 25`.
- Match time is displayed in the user/device local timezone; API kickoff remains UTC.
- All European match surfaces only receive/display Italian-relevant UCL/UEL/UECL fixtures. European standings remain full.
- Coppa Italia match surfaces start at 1/8 final; Coppa Italia has no Tables screen.
- Match Center tabs are exactly `Обзор / Статистика / События / Составы / Игроки`.
- Last-good data stays visible on transient refresh failure.
- Production remains v22.5 throughout this plan.

---

## File Structure Locked by This Plan

Create under `cloudflare-production/src/v23/`:

```text
index.html
app.mjs
styles/
  tokens.css
  base.css
  shell.css
  components.css
  screens.css
core/
  router.mjs
  route-codec.mjs
  store.mjs
  telegram.mjs
  live-controller.mjs
  cache.mjs
data/
  api-client.mjs
  contracts.mjs
  selectors.mjs
locale/
  ru.mjs
  time.mjs
ui/
  bottom-nav.mjs
  match-card.mjs
  team-badge.mjs
  tournament-card.mjs
  status-state.mjs
  tabs.mjs
screens/
  home.mjs
  predictions.mjs
  ranking.mjs
  matches.mjs
  tables.mjs
  match-center.mjs
  profile-settings.mjs
```

Tests under `cloudflare-production/test/` use prefix `v23-standalone-`.

The build writes only `src/v23/**` into `dist/**`.

---

### Task 1: Replace build pipeline with standalone artifact

**Files:**
- Modify: `cloudflare-production/scripts/build.mjs`
- Modify: `cloudflare-production/scripts/probe-production-build.mjs`
- Test: `cloudflare-production/test/v23-standalone-build.test.mjs`
- Create: `cloudflare-production/src/v23/index.html`
- Create: `cloudflare-production/src/v23/app.mjs`
- Create: `cloudflare-production/src/v23/styles/tokens.css`
- Create: `cloudflare-production/src/v23/styles/base.css`

**Interfaces:**
- `build()` produces `dist/index.html` and static `/v23/*` assets without network-fetching a release artifact.

- [ ] **Step 1: Write a failing build test**

Test source and built HTML for these requirements:

```js
assert.doesNotMatch(buildSource, /RELEASE_SOURCE_URL|v22-5|injectModularAssets|legacy-surface-adapter/);
assert.match(indexHtml, /data-ciao-app="v23"/);
assert.match(indexHtml, /src="\/v23\/app\.mjs"/);
assert.doesNotMatch(indexHtml, /releases\/v22-5|data-ciao-modular/);
```

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-standalone-build.test.mjs
```

Expected: FAIL because current build downloads v22.5.

- [ ] **Step 3: Create minimal standalone HTML**

Use this structure:

```html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <title>Ciao, Web!</title>
  <link rel="stylesheet" href="/v23/styles/tokens.css">
  <link rel="stylesheet" href="/v23/styles/base.css">
  <link rel="stylesheet" href="/v23/styles/shell.css">
  <link rel="stylesheet" href="/v23/styles/components.css">
  <link rel="stylesheet" href="/v23/styles/screens.css">
</head>
<body data-ciao-app="v23">
  <div id="app"></div>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <script type="module" src="/v23/app.mjs"></script>
</body>
</html>
```

- [ ] **Step 4: Rewrite `build.mjs`**

Copy `src/v23/index.html` to `dist/index.html` and `src/v23` subdirectories to `dist/v23`; reject any built file containing production Supabase ref `dkefzepiiudehhzbbrjn` or `v22-5`.

- [ ] **Step 5: Update build probe**

Probe asserts standalone marker, TEST Worker name, no legacy markers, no production Supabase ref.

- [ ] **Step 6: Verify**

```bash
node --test test/v23-standalone-build.test.mjs
npm run build
npm run probe:build
npx wrangler deploy --dry-run
```

- [ ] **Step 7: Commit**

```bash
git add cloudflare-production/scripts/build.mjs cloudflare-production/scripts/probe-production-build.mjs cloudflare-production/src/v23 cloudflare-production/test/v23-standalone-build.test.mjs
git commit -m "feat: build standalone v23 app artifact"
```

---

### Task 2: Route codec, router and exact Back restoration

**Files:**
- Create: `cloudflare-production/src/v23/core/route-codec.mjs`
- Create: `cloudflare-production/src/v23/core/router.mjs`
- Test: `cloudflare-production/test/v23-standalone-router.test.mjs`

**Interfaces:**

Route object:

```js
{
  screen: 'matches',
  tournament: 'ucl',
  subview: null,
  matchId: null,
  section: null,
  scrollY: 428,
}
```

Methods:
- `parseRoute(urlOrPath)`
- `serializeRoute(route)`
- `createRouter({history,location,render,readScroll,restoreScroll,onBackAvailability})`
- router methods: `start()`, `navigate(next)`, `back()`, `replace(next)`, `current()`, `rememberSectionRoute(section, route)`, `sectionRoute(section)`.

- [ ] **Step 1: Write failing route tests**

Cover exact routes:

```text
/home
/predictions
/predictions/mine
/ranking/all
/ranking/italy
/ranking/europe
/matches/serie-a
/matches/coppa-italia
/matches/ucl
/matches/uel
/matches/uecl
/match/ucl/12345/events
/tables/serie-a
/tables/ucl
/tables/uel
/tables/uecl
```

Invalid routes must parse to `/home` fallback, never blank.

- [ ] **Step 2: Write Back restoration test**

Simulate:

```text
/matches/ucl at scroll 730
-> /match/ucl/12345/events
-> back
```

Assert returned route is `/matches/ucl` and `restoreScroll(730)` runs after render.

- [ ] **Step 3: Run RED**

```bash
node --test test/v23-standalone-router.test.mjs
```

- [ ] **Step 4: Implement one `popstate` owner**

Never call `history.pushState` from screen modules. Router is the only module permitted to mutate history.

- [ ] **Step 5: Verify + commit**

```bash
node --test test/v23-standalone-router.test.mjs
npm test
git add cloudflare-production/src/v23/core/route-codec.mjs cloudflare-production/src/v23/core/router.mjs cloudflare-production/test/v23-standalone-router.test.mjs
git commit -m "feat: add standalone v23 router"
```

---

### Task 3: Telegram bridge and single BackButton owner

**Files:**
- Create: `cloudflare-production/src/v23/core/telegram.mjs`
- Test: `cloudflare-production/test/v23-standalone-telegram.test.mjs`

**Interfaces:**
- `createTelegramBridge(windowRef)` returns:
  - `initData()`
  - `user()`
  - `ready()`
  - `expand()`
  - `setBackVisible(boolean)`
  - `onBack(handler)` returning unsubscribe
  - `safeArea()`

- [ ] **Step 1: Write tests with fake `Telegram.WebApp`**

Assert one `BackButton.onClick` registration, matching `offClick` unsubscribe, correct `initData`, and no crash outside Telegram for local tests.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-standalone-telegram.test.mjs
```

- [ ] **Step 3: Implement bridge**

`app.mjs` is the only place that wires Telegram back to `router.back()`.

- [ ] **Step 4: Verify + commit**

```bash
node --test test/v23-standalone-telegram.test.mjs
npm test
git add cloudflare-production/src/v23/core/telegram.mjs cloudflare-production/test/v23-standalone-telegram.test.mjs
git commit -m "feat: add v23 Telegram shell bridge"
```

---

### Task 4: Store, last-good cache and API client

**Files:**
- Create: `cloudflare-production/src/v23/core/store.mjs`
- Create: `cloudflare-production/src/v23/core/cache.mjs`
- Create: `cloudflare-production/src/v23/data/contracts.mjs`
- Create: `cloudflare-production/src/v23/data/api-client.mjs`
- Test: `cloudflare-production/test/v23-standalone-data.test.mjs`

**Interfaces:**
- `createStore(initial)` -> `get()`, `set(updater)`, `subscribe(listener)`.
- `createLastGoodCache()` -> `put(key,data,at)`, `get(key)`, `markError(key,error)`.
- `createApiClient({fetchImpl,endpoint,getInitData})` -> `call(action,payload,{signal})`.

- [ ] **Step 1: Write tests**

API client must POST JSON to TEST `ciao-v23-api`, set `x-telegram-init-data`, accept only `{ok:true,data,meta}`, normalize errors to `{code,message,status}` and never include raw HTML/body dumps.

Cache test: after success `A`, failed refresh leaves `A` available with error metadata.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-standalone-data.test.mjs
```

- [ ] **Step 3: Implement**

Keep endpoint in `contracts.mjs`:

```js
export const V23_API_URL = 'https://lcnwccnkkxaosxnfvjvr.supabase.co/functions/v1/ciao-v23-api';
```

Build probe already rejects production ref.

- [ ] **Step 4: Verify + commit**

```bash
node --test test/v23-standalone-data.test.mjs
npm test
git add cloudflare-production/src/v23/core/store.mjs cloudflare-production/src/v23/core/cache.mjs cloudflare-production/src/v23/data cloudflare-production/test/v23-standalone-data.test.mjs
git commit -m "feat: add v23 state and API data layer"
```

---

### Task 5: Russian grammar and local timezone formatters

**Files:**
- Create: `cloudflare-production/src/v23/locale/ru.mjs`
- Create: `cloudflare-production/src/v23/locale/time.mjs`
- Test: `cloudflare-production/test/v23-standalone-locale.test.mjs`

**Interfaces:**
- `pluralRu(n, one, few, many)`
- `pointsLabel(n)`, `matchesLabel(n)`, `predictionsLabel(n)`, `goalsLabel(n)`
- `competitionPhrase(id, form)` where form supports `name|in|genitive` for known competition phrases.
- `formatKickoff(utcIso, {now,timeZone,locale='ru-RU'})`
- `formatMatchDate(utcIso, options)`.

- [ ] **Step 1: Write grammar matrix**

For each of 1,2,5,11,21,22,25 assert correct forms:

```text
1 очко / 2 очка / 5 очков / 11 очков / 21 очко / 22 очка / 25 очков
1 матч / 2 матча / 5 матчей / 11 матчей / 21 матч / 22 матча / 25 матчей
1 прогноз / 2 прогноза / 5 прогнозов ...
1 гол / 2 гола / 5 голов ...
```

Competition phrase assertions include `в Серии А`, `в Кубке Италии`, `в Лиге чемпионов`, `в Лиге Европы`, `в Лиге конференций`.

- [ ] **Step 2: Write timezone test**

Same UTC kickoff must render different local clock times for `Europe/Berlin` and `Europe/Moscow`, while underlying ISO remains unchanged.

- [ ] **Step 3: Run RED**

```bash
node --test test/v23-standalone-locale.test.mjs
```

- [ ] **Step 4: Implement with `Intl.DateTimeFormat` and no manual GMT offsets**

Use `Сегодня`, `Завтра`, otherwise `D MMMM · HH:mm` in Russian.

- [ ] **Step 5: Verify + commit**

```bash
node --test test/v23-standalone-locale.test.mjs
npm test
git add cloudflare-production/src/v23/locale cloudflare-production/test/v23-standalone-locale.test.mjs
git commit -m "feat: add Russian grammar and local match time"
```

---

### Task 6: App shell and reusable premium design system

**Files:**
- Create: `cloudflare-production/src/v23/styles/shell.css`
- Create: `cloudflare-production/src/v23/styles/components.css`
- Create: `cloudflare-production/src/v23/styles/screens.css`
- Create: `cloudflare-production/src/v23/ui/bottom-nav.mjs`
- Create: `cloudflare-production/src/v23/ui/team-badge.mjs`
- Create: `cloudflare-production/src/v23/ui/match-card.mjs`
- Create: `cloudflare-production/src/v23/ui/tournament-card.mjs`
- Create: `cloudflare-production/src/v23/ui/status-state.mjs`
- Create: `cloudflare-production/src/v23/ui/tabs.mjs`
- Test: `cloudflare-production/test/v23-standalone-ui.test.mjs`

**Interfaces:**
- All renderers return DOM nodes or safe HTML generated only from escaped strings.
- Match Card emits semantic `data-action="open-match"` and canonical match ID; it does not navigate itself.

- [ ] **Step 1: Write UI contract tests**

Assert bottom nav has exactly five Russian labels and one active state. Match card includes localized club names, status/time and never provider English fields. Empty/error/skeleton states have stable `data-state` attributes.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-standalone-ui.test.mjs
```

- [ ] **Step 3: Implement CSS tokens**

Use CSS variables only for colors/radii/spacing. Direction: deep navy background, slightly lighter cards, white text, blue active accents, restrained borders/shadows. No hard-coded old v22.5 class names.

- [ ] **Step 4: Verify + commit**

```bash
node --test test/v23-standalone-ui.test.mjs
npm test
git add cloudflare-production/src/v23/styles cloudflare-production/src/v23/ui cloudflare-production/test/v23-standalone-ui.test.mjs
git commit -m "feat: add standalone v23 design system"
```

---

### Task 7: Home screen

**Files:**
- Create: `cloudflare-production/src/v23/screens/home.mjs`
- Create: `cloudflare-production/src/v23/data/selectors.mjs`
- Test: `cloudflare-production/test/v23-standalone-home.test.mjs`

**Interfaces:**
- `loadHome(api, cache, clock)` combines `bootstrap`, `favorite_next_match`, `calcio_today`.
- `renderHome(model)`.

- [ ] **Step 1: Write Home model/render tests**

Assert blocks:
- profile/avatar;
- points/rank/exact scores;
- favorite club;
- nearest match;
- `Кальчо сегодня`;
- live first;
- no predictions block.

Empty today copy must be exactly `Кальчо сегодня нет :(`.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-standalone-home.test.mjs
```

- [ ] **Step 3: Implement Home**

Nearest and today cards carry routes to Match Center. Failed refresh retains cache and displays inline `Не удалось обновить` without replacing content.

- [ ] **Step 4: Verify + commit**

```bash
node --test test/v23-standalone-home.test.mjs
npm test
git add cloudflare-production/src/v23/screens/home.mjs cloudflare-production/src/v23/data/selectors.mjs cloudflare-production/test/v23-standalone-home.test.mjs
git commit -m "feat: build standalone v23 home"
```

---

### Task 8: Predictions and My Predictions

**Files:**
- Create: `cloudflare-production/src/v23/screens/predictions.mjs`
- Test: `cloudflare-production/test/v23-standalone-predictions.test.mjs`

**Interfaces:**
- `loadPredictions({mode,competition})`
- `renderPredictions(model)`
- `savePrediction({competition,matchId,homeScore,awayScore})`.

- [ ] **Step 1: Write screen tests**

Assert subviews exactly `Прогнозы` and `Мои прогнозы`; filters exactly six options (`Все` + five competitions). Inputs accept integer 0–20 only. API closed response renders `Прогноз уже закрыт`; success renders `Прогноз сохранён` inline.

Mine card shows predicted score, final score when available, points with correct plural/case, and status.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-standalone-predictions.test.mjs
```

- [ ] **Step 3: Implement without client-side scoring authority**

Client may validate input range for UX, but it does not calculate awarded points or authoritative deadline.

- [ ] **Step 4: Verify + commit**

```bash
node --test test/v23-standalone-predictions.test.mjs
npm test
git add cloudflare-production/src/v23/screens/predictions.mjs cloudflare-production/test/v23-standalone-predictions.test.mjs
git commit -m "feat: build v23 predictions screens"
```

---

### Task 9: Ranking, Matches and Tables screens

**Files:**
- Create: `cloudflare-production/src/v23/screens/ranking.mjs`
- Create: `cloudflare-production/src/v23/screens/matches.mjs`
- Create: `cloudflare-production/src/v23/screens/tables.mjs`
- Test: `cloudflare-production/test/v23-standalone-sections.test.mjs`

**Interfaces:**
- Ranking scopes `all|italy|europe`.
- Matches tournament selection five competitions.
- Tables selection four competitions (no `coppa_italia`).

- [ ] **Step 1: Write Ranking tests**

Labels exactly `Все / Италия / Еврокубки`; current user visually marked; points grammar correct.

- [ ] **Step 2: Write Matches tests**

Tournament cards exactly five. Serie A groups by round. Coppa begins at `1/8 финала`. European fixtures fixture data contains only Italian-relevant matches and renderer never inserts hidden/noneligible fallback.

- [ ] **Step 3: Write Tables tests**

Tabs exactly `Серия А / Лига чемпионов / Лига Европы / Лига конференций`; full European standings fixture must render non-Italian teams too, all with Russian names.

- [ ] **Step 4: Run RED**

```bash
node --test test/v23-standalone-sections.test.mjs
```

- [ ] **Step 5: Implement and verify**

```bash
node --test test/v23-standalone-sections.test.mjs
npm test
```

- [ ] **Step 6: Commit**

```bash
git add cloudflare-production/src/v23/screens/ranking.mjs cloudflare-production/src/v23/screens/matches.mjs cloudflare-production/src/v23/screens/tables.mjs cloudflare-production/test/v23-standalone-sections.test.mjs
git commit -m "feat: build v23 ranking matches and tables"
```

---

### Task 10: Unified Match Center

**Files:**
- Create: `cloudflare-production/src/v23/screens/match-center.mjs`
- Test: `cloudflare-production/test/v23-standalone-match-center.test.mjs`

**Interfaces:**
- `loadMatchCenter({competition,matchId,section})`
- `renderMatchCenter(model)`.
- Sections map to API `overview|stats|events|lineups|players` and labels `Обзор|Статистика|События|Составы|Игроки`.

- [ ] **Step 1: Write tests for exact five tabs**

Assert no `Контекст Серии А`, no separate Serie A path/component.

- [ ] **Step 2: Write section rendering tests**

Overview: score/status/stadium/stage/time. Statistics: missing values omitted, not zeroed. Events: chronological goals/cards/subs/VAR. Lineups: starters/formation/bench/coach when present. Players: only actual provider stats.

- [ ] **Step 3: Run RED**

```bash
node --test test/v23-standalone-match-center.test.mjs
```

- [ ] **Step 4: Implement lazy section loading**

Opening Overview must not fetch stats/events/lineups/players. Changing tab requests only that section and caches last-good section data.

- [ ] **Step 5: Verify + commit**

```bash
node --test test/v23-standalone-match-center.test.mjs
npm test
git add cloudflare-production/src/v23/screens/match-center.mjs cloudflare-production/test/v23-standalone-match-center.test.mjs
git commit -m "feat: add unified standalone Match Center"
```

---

### Task 11: One live controller with last-good refresh

**Files:**
- Create: `cloudflare-production/src/v23/core/live-controller.mjs`
- Test: `cloudflare-production/test/v23-standalone-live.test.mjs`

**Interfaces:**
- `createLiveController({refresh,setTimer,clearTimer,intervalMs=30000})`.
- Methods: `start(context)`, `stop()`, `state()`.

- [ ] **Step 1: Write tests**

Assert only one timer exists; starting a different context cancels prior timer; stop removes timer; failed refresh retains last successful data and sets error; successful next refresh clears error.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-standalone-live.test.mjs
```

- [ ] **Step 3: Implement**

Home and Matches use list refresh. Match Center live view refreshes only current overview/active section. No screen creates its own interval.

- [ ] **Step 4: Verify + commit**

```bash
node --test test/v23-standalone-live.test.mjs
npm test
git add cloudflare-production/src/v23/core/live-controller.mjs cloudflare-production/test/v23-standalone-live.test.mjs
git commit -m "feat: add single v23 live controller"
```

---

### Task 12: Profile/settings/favorite screen and app composition

**Files:**
- Create: `cloudflare-production/src/v23/screens/profile-settings.mjs`
- Modify: `cloudflare-production/src/v23/app.mjs`
- Test: `cloudflare-production/test/v23-standalone-app.test.mjs`

**Interfaces:**
- Profile settings supports favorite Italian club and four notification flags.
- `createApp({documentRef,windowRef,api,telegram,clock})` owns event delegation, router, store, live controller.

- [ ] **Step 1: Write composition tests**

Assert `createApp().start()`:
- initializes Telegram once;
- registers one delegated click handler;
- starts one router;
- wires one Telegram Back callback;
- renders `/home` fallback;
- updates bottom nav active state on route change;
- restores last route for each bottom-nav section;
- never imports legacy modules.

- [ ] **Step 2: Write settings tests**

Favorite selector lists Italian clubs in Russian; saving setting calls `favorite_set`. Four notification toggles map to backend settings fields. Timezone is displayed as automatic/device-derived, not editable in first version.

- [ ] **Step 3: Run RED**

```bash
node --test test/v23-standalone-app.test.mjs
```

- [ ] **Step 4: Implement app composition**

Use event delegation based on `data-action`; components never attach global listeners independently.

- [ ] **Step 5: Delete build dependency on old modular frontend**

Do not necessarily delete `src/modular/` files yet, but verify they are unreachable from built asset graph. Add static test scanning `src/v23` imports and `dist` contents for `modular`, `legacy-surface-adapter`, `v22-5`.

- [ ] **Step 6: Run full verification**

```bash
npm test
npm run build
npm run probe:api
npm run probe:build
npx wrangler deploy --dry-run
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-production/src/v23/app.mjs cloudflare-production/src/v23/screens/profile-settings.mjs cloudflare-production/test/v23-standalone-app.test.mjs
git commit -m "feat: compose standalone Ciao v23 app"
```

---

### Task 13: Deploy to isolated TEST Worker and real Telegram smoke

**Files:**
- Modify only if necessary: `.github/workflows/main-modular-check.yml` (rename display name is optional; do not alter production deployment).

- [ ] **Step 1: Push `v23-test` and wait for `verify` success**

Required commands executed by CI:

```bash
npm test
npm run build
npm run probe:api
npm run probe:build
npx wrangler deploy --dry-run
```

- [ ] **Step 2: Confirm TEST deployment target**

Wrangler config must still name only `ciao-web-v23-test`.

- [ ] **Step 3: Open hidden Telegram TEST button**

Real-device/WebView checklist:

```text
Home loads as new design, not v22.5.
No legacy bottom bar/header appears.
Favorite nearest match opens Match Center and Back returns Home.
Calcio Today card opens Match Center and Back returns exact scroll.
Predictions / Mine switch correctly.
Ranking all/Italy/Europe switch correctly.
Matches five tournaments open correctly.
Tables four tournaments show correctly; European tables contain all teams.
Match Center has exactly five tabs.
System/Telegram Back equals UI Back behavior.
Times match device timezone.
No English team/tournament/stage labels are visible.
Transient network refresh error leaves last data visible.
```

- [ ] **Step 4: Capture defects as TEST-only follow-up commits**

Do not change `main` or production Worker during smoke fixes.

---

## Plan 2 Completion Gate

Frontend plan is complete only when:

- `dist/index.html` is standalone and contains no v22.5/legacy markers.
- All automated tests pass.
- One router/Back owner and one live controller are verified by tests.
- Five bottom sections and unified Match Center work in real Telegram TEST.
- User-visible football names/stages/tournaments are Russian only.
- Russian grammar matrix passes.
- User-local time is correct while deadlines stay server UTC-based.
- European match screens contain only Italian-relevant fixtures; European standings are complete.
- The user explicitly accepts the TEST behavior before any production-release work starts.

The next plan is `docs/superpowers/plans/2026-09-06-v23-notifications-release.md`.