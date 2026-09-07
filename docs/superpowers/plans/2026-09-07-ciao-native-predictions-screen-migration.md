# Ciao Native Predictions Screen Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stacked prediction HTML/runtime patches with one module-owned `PredictionsScreen` while keeping the existing second bottom-nav button in exactly the same place and preserving all other production tabs.

**Architecture:** First make the accepted v22.5 shell a tracked local build input without changing behavior. Then add a dedicated predictions data/model/controller/view module set and static CSS, enable it behind a canary switch, route only `button[data-tab="mine"]` to the native screen, and finally delete the prediction-specific injector stack. Existing Matches, Worker API, Supabase prediction backend, Telegram launcher/cache-buster, and non-Predictions tabs remain intact.

**Tech Stack:** Cloudflare Workers + Static Assets, browser ES modules, vanilla JS/CSS, Node.js `node:test`, Supabase Edge Functions (`ciao-core-api-fast-v4`, `ciao-external-predictions`).

**Spec:** `docs/superpowers/specs/2026-09-07-ciao-native-predictions-screen-migration-design.md`

## Global Constraints

- Bottom navigation remains exactly: `Главная | Прогнозы | Рейтинг | Матчи | Таблицы | Профиль`.
- The second bottom-nav button keeps its current icon, label, order, and `data-tab="mine"` click target.
- Do not redesign Главная, Рейтинг, Матчи, Таблицы, or Профиль.
- Do not move `stable` until explicit visual approval.
- Do not reintroduce x2; scoring remains `5 / 3 / 2 / 0`.
- Prediction deadline remains 15 minutes before kickoff.
- UEFA future rounds are visible but disabled; no lock emoji or lock drawing is rendered.
- Round N+1 opens only after every match of round N is finished.
- LIVE pill alone is red `#E7072E`; `ПЕРЕРЫВ`, `ДОП. ВРЕМЯ`, and `ПЕНАЛЬТИ` remain neutral-status pills.
- Predictions refresh cadence is 15 seconds only while the native screen is visible; drafts and scroll position must survive refresh.
- No Predictions module may overwrite legacy `predict()`, `mine()`, `render()`, `bind()`, or `saveAll()`.
- No Predictions module may create a `MutationObserver` to rewrite legacy markup.
- Keep Telegram delivery path and HTML cache behavior: launcher → cache-busted Cloudflare URL → Worker-first HTML with `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.

---

### Task 1: Make the v22.5 shell a tracked local production input

**Files:**
- Create: `cloudflare-production/src/app-shell.html`
- Modify: `cloudflare-production/scripts/build.mjs`
- Modify: `cloudflare-production/test/build.test.mjs`

**Interfaces:**
- Consumes: the current accepted source document at `https://dkefzepiiudehhzbbrjn.supabase.co/storage/v1/object/public/ciao-miniapp/migration/v22-5-resolved-no-x2.html` exactly once to create the tracked snapshot.
- Produces: `APP_SHELL_PATH` and `loadAppShell()` in `scripts/build.mjs`; all later build tasks use `src/app-shell.html` and never fetch a remote release document.

- [ ] **Step 1: Add a failing build test proving the shell must be local**

Replace the remote-source assumption in `test/build.test.mjs` with assertions like:

```js
import { readFile } from 'node:fs/promises';

 test('production build uses the tracked app shell instead of remote release HTML', async () => {
  assert.equal(typeof productionBuild.loadAppShell, 'function');
  assert.equal('RELEASE_SOURCE_URL' in productionBuild, false);
  const shell = await productionBuild.loadAppShell();
  assert.match(shell, /ciao-prod-no-x2-20260903/);
  const tracked = await readFile(new URL('../src/app-shell.html', import.meta.url), 'utf8');
  assert.equal(shell, tracked);
});
```

- [ ] **Step 2: Run the test and witness RED**

Run:

```bash
cd cloudflare-production
node --test test/build.test.mjs
```

Expected: FAIL because `loadAppShell` and `src/app-shell.html` do not exist and the build still exports/uses `RELEASE_SOURCE_URL`.

- [ ] **Step 3: Create the tracked snapshot**

Use Node so the snapshot is byte-for-byte UTF-8 and does not depend on curl availability:

```bash
cd cloudflare-production
node --input-type=module -e "import{writeFile}from'node:fs/promises';const u='https://dkefzepiiudehhzbbrjn.supabase.co/storage/v1/object/public/ciao-miniapp/migration/v22-5-resolved-no-x2.html';const r=await fetch(u,{headers:{'cache-control':'no-cache'}});if(!r.ok)throw new Error('HTTP '+r.status);await writeFile('src/app-shell.html',await r.text(),'utf8')"
```

Verify the tracked file contains `ciao-prod-no-x2-20260903` before committing it.

- [ ] **Step 4: Change `build.mjs` to read the tracked file**

Use this shape:

```js
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export const APP_SHELL_PATH = resolve(root, 'src/app-shell.html');

export async function loadAppShell() {
  return readFile(APP_SHELL_PATH, 'utf8');
}

export async function build() {
  const source = await loadAppShell();
  const release = prepareReleaseHtml(source);
  const rootHtml = rootHtmlFor({ release });
  // existing mkdir/writeFile calls stay unchanged
}
```

Delete the `RELEASE_SOURCE_URL` export and all production fetch logic from this build path. Keep the existing injector sequence unchanged in Task 1 so this commit is behavior-preserving.

- [ ] **Step 5: Run build tests and full baseline**

Run:

```bash
npm test
npm run build
```

Expected: all existing tests PASS and `dist/index.html` / `dist/releases/v22-5.html` still build successfully.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-production/src/app-shell.html cloudflare-production/scripts/build.mjs cloudflare-production/test/build.test.mjs
git commit -m "refactor: track production app shell locally"
```

---

### Task 2: Add the native Predictions domain model and backend client

**Files:**
- Create: `cloudflare-production/src/predictions/model.mjs`
- Create: `cloudflare-production/src/predictions/data-client.mjs`
- Create: `cloudflare-production/test/predictions-model.test.mjs`
- Create: `cloudflare-production/test/predictions-data-client.test.mjs`
- Reuse: `cloudflare-production/src/matches/competition-config.mjs`

**Interfaces:**
- Consumes: `getCompetitionConfig()` from `src/matches/competition-config.mjs`; Telegram init data from `globalThis.Telegram?.WebApp?.initData`; existing Supabase endpoints.
- Produces:
  - `groupPredictionMatches(matches)` → ordered stage groups.
  - `previousLeagueRoundLabel(stageKey)` → e.g. `3-го тура` for `league-4`.
  - `isStageLocked(group)` → boolean.
  - `predictionStatus(match)` → `{ text, tone }`.
  - `predictionCardView(match, draft)` → normalized card VM.
  - `createPredictionsDataClient({ fetchImpl, getInitData })` with `loadSerieAState`, `saveSerieAPredictions`, `loadExternalState`, `saveExternalPredictions`.

- [ ] **Step 1: Write failing model tests**

Create `test/predictions-model.test.mjs` with exact expectations:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previousLeagueRoundLabel,
  isStageLocked,
  predictionStatus,
  predictionCardView,
} from '../src/predictions/model.mjs';

test('previous round copy is derived from selected round', () => {
  assert.equal(previousLeagueRoundLabel('league-2'), '1-го тура');
  assert.equal(previousLeagueRoundLabel('league-3'), '2-го тура');
  assert.equal(previousLeagueRoundLabel('league-4'), '3-го тура');
  assert.equal(previousLeagueRoundLabel('league-8'), '7-го тура');
});

test('future stage is locked without requiring lock glyph metadata', () => {
  assert.equal(isStageLocked({ matches: [{ stage_locked: true }, { stage_locked: true }] }), true);
  assert.equal(isStageLocked({ matches: [{ stage_locked: false }] }), false);
});

test('only live is classified as red status', () => {
  assert.deepEqual(predictionStatus({ status: 'live', minute: 86 }), { text: 'LIVE · 86′', tone: 'live' });
  assert.deepEqual(predictionStatus({ status: 'halftime' }), { text: 'ПЕРЕРЫВ', tone: 'neutral' });
  assert.deepEqual(predictionStatus({ status: 'extra_time' }), { text: 'ДОП. ВРЕМЯ', tone: 'neutral' });
  assert.deepEqual(predictionStatus({ status: 'penalties' }), { text: 'ПЕНАЛЬТИ', tone: 'neutral' });
});

test('missing prediction uses compact score plus secondary copy', () => {
  const vm = predictionCardView({ prediction: null, status: 'scheduled' }, null);
  assert.equal(vm.predictionText, '— : —');
  assert.equal(vm.predictionMissing, true);
  assert.equal(vm.predictionMissingLabel, 'Прогноз не сделан');
});
```

- [ ] **Step 2: Run and witness RED**

```bash
node --test test/predictions-model.test.mjs
```

Expected: FAIL because `src/predictions/model.mjs` is missing.

- [ ] **Step 3: Implement the model helpers**

Core implementation must use one previous-round helper only:

```js
export function previousLeagueRoundLabel(stageKey) {
  const match = String(stageKey ?? '').match(/^league-(\d+)$/);
  const round = match ? Number(match[1]) : NaN;
  return Number.isFinite(round) && round > 1 ? `${round - 1}-го тура` : 'предыдущего тура';
}

export function isStageLocked(group) {
  const matches = Array.isArray(group?.matches) ? group.matches : [];
  return matches.length > 0 && matches.every(match => match?.stage_locked === true);
}

export function predictionStatus(match) {
  switch (String(match?.status ?? 'scheduled')) {
    case 'live': {
      const minute = Number(match?.minute);
      return { text: `LIVE${Number.isFinite(minute) ? ` · ${minute}′` : ''}`, tone: 'live' };
    }
    case 'halftime': return { text: 'ПЕРЕРЫВ', tone: 'neutral' };
    case 'extra_time': return { text: 'ДОП. ВРЕМЯ', tone: 'neutral' };
    case 'penalties': return { text: 'ПЕНАЛЬТИ', tone: 'neutral' };
    case 'finished': return { text: 'МАТЧ ЗАВЕРШЁН', tone: 'neutral' };
    case 'postponed': return { text: 'МАТЧ ПЕРЕНЕСЁН', tone: 'neutral' };
    case 'cancelled': return { text: 'МАТЧ ОТМЕНЁН', tone: 'neutral' };
    default: return { text: 'МАТЧ НЕ НАЧАЛСЯ', tone: 'neutral' };
  }
}
```

`predictionCardView()` must return the compact `— : —` primary text when `match.prediction` is absent; it must never return `Прогноз не сделан` as the large score text.

- [ ] **Step 4: Write failing data-client tests**

Use a mock fetch and assert exact request contracts:

```js
test('external state uses ciao-external-predictions state action', async () => {
  const calls = [];
  const client = createPredictionsDataClient({
    getInitData: () => 'telegram-init',
    fetchImpl: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ ok: true, data: { competition: 'uel', matches: [] } }), { status: 200 });
    },
  });
  await client.loadExternalState('uel');
  assert.equal(calls[0].body.action, 'state');
  assert.equal(calls[0].body.competition, 'uel');
  assert.equal(calls[0].init.headers['x-telegram-init-data'], 'telegram-init');
});

test('external save uses save_predictions and canonical string ids', async () => {
  // assert body === { action:'save_predictions', competition:'uel', predictions:[{match_id:'uel:123',home_score:1,away_score:0}] }
});
```

Serie A client tests must assert `action:'state'` and `action:'save_predictions'` against `ciao-core-api-fast-v4`.

- [ ] **Step 5: Implement `data-client.mjs`**

Use these fixed endpoints and helper:

```js
const CORE_API = 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-core-api-fast-v4';
const EXTERNAL_API = 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-external-predictions';

async function postJson(fetchImpl, getInitData, url, body) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-init-data': String(getInitData() || ''),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `HTTP ${response.status}`);
  return payload?.data ?? payload;
}
```

Expose:

```js
loadSerieAState(round)              // POST CORE_API {action:'state', ...(round ? {round} : {})}
saveSerieAPredictions(round, items) // POST CORE_API {action:'save_predictions',round,predictions:items}
loadExternalState(competition)      // POST EXTERNAL_API {action:'state',competition}
saveExternalPredictions(competition, items) // POST EXTERNAL_API {action:'save_predictions',competition,predictions:items}
```

- [ ] **Step 6: Run the focused tests**

```bash
node --test test/predictions-model.test.mjs test/predictions-data-client.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-production/src/predictions/model.mjs cloudflare-production/src/predictions/data-client.mjs cloudflare-production/test/predictions-model.test.mjs cloudflare-production/test/predictions-data-client.test.mjs
git commit -m "feat: add native predictions model and data client"
```

---

### Task 3: Add a single Predictions controller for state, drafts, mode, and stage

**Files:**
- Create: `cloudflare-production/src/predictions/controller.mjs`
- Create: `cloudflare-production/test/predictions-controller.test.mjs`

**Interfaces:**
- Consumes: Task 2 data client and model helpers.
- Produces: `createPredictionsController({ dataClient, render, now, setTimer, clearTimer, documentRef })` returning `open`, `close`, `openHub`, `openCompetition`, `setMode`, `setStage`, `adjustScore`, `save`, `refresh`, `snapshot`, `isOpen`.

- [ ] **Step 1: Write controller RED tests**

Cover these exact behaviors:

```js
test('mode switch preserves competition and selected stage', async () => {
  // openCompetition('uel'), setStage('league-3'), setMode('mine')
  // snapshot() remains {competition:'uel', stageKey:'league-3', mode:'mine'}
});

test('refresh preserves unsaved external draft', async () => {
  // draft uel:123 from 0:0 to 1:0, refresh payload, assert draft remains 1:0
});

test('only one refresh request may be in flight', async () => {
  // hold first promise, call refresh twice, assert loader called once
});

test('close cancels the 15 second timer', () => {
  // assert clearTimer receives active timer id
});
```

- [ ] **Step 2: Run and witness RED**

```bash
node --test test/predictions-controller.test.mjs
```

Expected: FAIL because controller module is missing.

- [ ] **Step 3: Implement one authoritative state object**

Use this initial structure and never mirror it into legacy globals:

```js
const state = {
  open: false,
  view: 'hub',
  competition: '',
  mode: 'edit',
  stageKey: '',
  serieRound: null,
  payload: null,
  drafts: new Map(),
  loading: false,
  saving: false,
  error: '',
};
```

`setMode()` must only change `state.mode`; it must not clear `competition`, `stageKey`, or drafts.

`adjustScore(matchId, side, delta)` must clamp scores to `[0,20]` and write only to `state.drafts`.

- [ ] **Step 4: Add the visible-only 15-second lifecycle**

Use one timer and one in-flight flag:

```js
const REFRESH_MS = 15000;
let timerId = null;
let refreshPromise = null;

function schedule() {
  if (!state.open || documentRef?.hidden || timerId != null) return;
  timerId = setTimer(async () => {
    timerId = null;
    await refresh();
    schedule();
  }, REFRESH_MS);
}
```

On `visibilitychange`: hidden → cancel timer; visible while open → `refresh()` immediately, then schedule again.

- [ ] **Step 5: Run focused tests**

```bash
node --test test/predictions-controller.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-production/src/predictions/controller.mjs cloudflare-production/test/predictions-controller.test.mjs
git commit -m "feat: add native predictions screen controller"
```

---

### Task 4: Build the native Predictions renderer and one static stylesheet

**Files:**
- Create: `cloudflare-production/src/predictions/view.mjs`
- Create: `cloudflare-production/src/predictions/predictions-screen.css`
- Create: `cloudflare-production/test/predictions-view.test.mjs`

**Interfaces:**
- Consumes: controller snapshots and Task 2 view-model helpers.
- Produces: `renderPredictionsView(snapshot)` returning the complete owned screen markup, and static CSS classes under `.cw-pred-native-*`.

- [ ] **Step 1: Write renderer RED tests for the exact bad cases seen in production**

```js
test('hub has five tournament buttons and no mode toggle', () => {
  const html = renderPredictionsView({ open:true, view:'hub', competitions:[/* five configs */] });
  assert.equal((html.match(/data-pred-competition=/g) || []).length, 5);
  assert.doesNotMatch(html, /data-pred-mode=/);
});

test('competition view embeds mode toggle inside tournament screen', () => {
  const html = renderPredictionsView(fixtureCompetition({ mode:'mine' }));
  assert.match(html, /data-pred-mode="edit"/);
  assert.match(html, /data-pred-mode="mine"/);
});

test('4th locked round says after 3rd round and renders no lock glyph', () => {
  const html = renderPredictionsView(fixtureCompetition({ selectedStage:'league-4', locked:true }));
  assert.match(html, /после завершения 3-го тура/);
  assert.doesNotMatch(html, /🔒|🔐|cwpred-stage-locked::before|cwpred-stage-locked::after/);
});

test('my predictions card keeps compact missing prediction', () => {
  const html = renderPredictionsView(fixtureMineCard({ prediction:null }));
  assert.match(html, />— : —</);
  assert.match(html, />Прогноз не сделан</);
  assert.doesNotMatch(html, /<b>Прогноз не сделан<\/b>/);
});

test('live pill has live class while halftime does not', () => {
  assert.match(renderPredictionsView(fixtureStatus('live')), /cw-pred-native-status--live/);
  assert.doesNotMatch(renderPredictionsView(fixtureStatus('halftime')), /cw-pred-native-status--live/);
});
```

- [ ] **Step 2: Run and witness RED**

```bash
node --test test/predictions-view.test.mjs
```

Expected: FAIL because renderer and CSS do not exist.

- [ ] **Step 3: Implement a single render tree**

The selected competition screen must render in this order:

```html
<section class="cw-pred-native-screen" data-theme="europa">
  <header class="cw-pred-native-header">…</header>
  <div class="cw-pred-native-modes">Прогнозы | Мои прогнозы</div>
  <div class="cw-pred-native-stages">…</div>
  <div class="cw-pred-native-stage-heading">…</div>
  <div class="cw-pred-native-cards">…</div>
  <div class="cw-pred-native-savebar">…</div>
</section>
```

No renderer function may query an existing `.cwpred-*`, `.mine-match`, or legacy prediction card to build its output.

- [ ] **Step 4: Implement symmetric My Predictions geometry in static CSS**

Use a stable three-column grid:

```css
.cw-pred-native-matchline{
  display:grid;
  grid-template-columns:minmax(0,1fr) 96px minmax(0,1fr);
  align-items:center;
  gap:10px;
}
.cw-pred-native-prediction{
  min-width:0;
  text-align:center;
}
.cw-pred-native-prediction strong{
  display:block;
  white-space:nowrap;
  font-size:20px;
  line-height:1;
}
.cw-pred-native-prediction small{
  display:block;
  margin-top:5px;
  font-size:9px;
  line-height:1.15;
  color:rgba(255,255,255,.48);
}
.cw-pred-native-team-name{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
```

- [ ] **Step 5: Implement LIVE styling only in the static CSS file**

```css
.cw-pred-native-status--live{
  background:#E7072E;
  color:#fff;
  border-color:#E7072E;
  box-shadow:0 0 16px rgba(231,7,46,.28);
}
```

Do not create `<style>` elements from JavaScript.

- [ ] **Step 6: Run renderer tests**

```bash
node --test test/predictions-view.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-production/src/predictions/view.mjs cloudflare-production/src/predictions/predictions-screen.css cloudflare-production/test/predictions-view.test.mjs
git commit -m "feat: render native predictions screen"
```

---

### Task 5: Install the native screen on the existing second nav button without touching legacy globals

**Files:**
- Create: `cloudflare-production/src/predictions/predictions-screen.mjs`
- Create: `cloudflare-production/test/predictions-screen.test.mjs`

**Interfaces:**
- Consumes: Tasks 2–4 modules.
- Produces: `installPredictionsScreen(documentRef, options)` and `globalThis.CiaoPredictionsScreen = { open, close, refresh, isOpen }`.

- [ ] **Step 1: Write navigation/controller integration RED tests**

Test with a minimal fake document/DOM adapter:

```js
test('existing data-tab mine opens native screen and other nav closes it', () => {
  // click button[data-tab="mine"] -> screen.isOpen() === true
  // click button[data-tab="table"] -> screen.isOpen() === false
});

test('installer does not overwrite legacy prediction globals', () => {
  const legacy = { predict(){}, mine(){}, render(){}, bind(){}, saveAll(){} };
  Object.assign(globalThis, legacy);
  installPredictionsScreen(fakeDocument, { enabled: true });
  for (const key of Object.keys(legacy)) assert.equal(globalThis[key], legacy[key]);
});

test('installer creates no MutationObserver', () => {
  let constructed = 0;
  const old = globalThis.MutationObserver;
  globalThis.MutationObserver = class { constructor(){ constructed += 1; } };
  installPredictionsScreen(fakeDocument, { enabled: true });
  assert.equal(constructed, 0);
  globalThis.MutationObserver = old;
});
```

- [ ] **Step 2: Run and witness RED**

```bash
node --test test/predictions-screen.test.mjs
```

Expected: FAIL because native screen installer does not exist.

- [ ] **Step 3: Implement a dedicated mount and event delegation**

The installer owns one mount only:

```js
const MOUNT_ID = 'ciao-native-predictions-root';

function ensureMount(documentRef) {
  let mount = documentRef.getElementById(MOUNT_ID);
  if (mount) return mount;
  mount = documentRef.createElement('section');
  mount.id = MOUNT_ID;
  mount.hidden = true;
  (documentRef.getElementById('ciao-miniapp-root') || documentRef.body).appendChild(mount);
  return mount;
}
```

Use one delegated click listener. For a `button[data-tab]`, defer until the legacy nav handler has updated its own active class, then:

```js
if (nav.dataset.tab === 'mine') controller.open();
else controller.close();
```

Do not `preventDefault()` for bottom navigation and do not rewrite nav labels or icons.

- [ ] **Step 4: Keep all screen interactions inside the owned mount**

Handle only `[data-pred-*]` controls found with `target.closest(...)` inside `mount`: tournament, mode, stage, score delta, save, retry, back.

- [ ] **Step 5: Make scroll preservation local and deterministic**

Before every owned re-render:

```js
const top = mount.scrollTop;
const stageBar = mount.querySelector('.cw-pred-native-stages');
const stageLeft = stageBar?.scrollLeft ?? 0;
mount.innerHTML = renderPredictionsView(snapshot);
mount.scrollTop = top;
mount.querySelector('.cw-pred-native-stages')?.scrollTo?.({ left: stageLeft, behavior: 'instant' });
```

Because the native screen is its own scroll container, do not call `window.scrollBy()` and do not try to restore legacy page anchors.

- [ ] **Step 6: Run integration tests**

```bash
node --test test/predictions-screen.test.mjs test/predictions-controller.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-production/src/predictions/predictions-screen.mjs cloudflare-production/test/predictions-screen.test.mjs
git commit -m "feat: mount native predictions on existing nav tab"
```

---

### Task 6: Ship native Predictions assets behind an internal canary switch

**Files:**
- Modify: `cloudflare-production/src/app-shell.html`
- Modify: `cloudflare-production/scripts/build.mjs`
- Modify: `cloudflare-production/test/build.test.mjs`
- Modify: `cloudflare-production/test/html-cache-control.test.mjs` only if asset routing coverage needs the new module/CSS paths.

**Interfaces:**
- Consumes: native Predictions files from Tasks 2–5.
- Produces: `/predictions/predictions-screen.mjs` module tree and `/predictions/predictions-screen.css` in `dist`; canary enablement via `?native_predictions=1` while default production behavior remains old Predictions until Task 7.

- [ ] **Step 1: Add a RED build test for native static assets**

```js
test('build ships native predictions as static module and css', async () => {
  await productionBuild.build();
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  assert.match(html, /predictions\/predictions-screen\.css/);
  assert.match(html, /type="module"[^>]+predictions\/predictions-screen\.mjs/);
  assert.equal(await stat(new URL('../dist/predictions/predictions-screen.mjs', import.meta.url)).then(()=>true), true);
  assert.equal(await stat(new URL('../dist/predictions/predictions-screen.css', import.meta.url)).then(()=>true), true);
});
```

- [ ] **Step 2: Run and witness RED**

```bash
node --test test/build.test.mjs
```

Expected: FAIL because the tracked shell has no static entries and build does not copy the Predictions directory.

- [ ] **Step 3: Add explicit static entries to the tracked shell**

Immediately before `</head>` add exactly:

```html
<link rel="stylesheet" href="/predictions/predictions-screen.css">
```

Immediately before `</body>` add exactly:

```html
<script type="module" src="/predictions/predictions-screen.mjs"></script>
```

These entries live permanently in `src/app-shell.html`; `build.mjs` must not string-inject them.

- [ ] **Step 4: Add the canary decision inside `predictions-screen.mjs`**

Default is off. Allow only the explicit query switch before Task 7:

```js
function nativePredictionsEnabled(locationRef = globalThis.location) {
  return new URLSearchParams(locationRef?.search || '').get('native_predictions') === '1';
}

if (typeof document !== 'undefined' && nativePredictionsEnabled()) {
  globalThis.CiaoPredictionsScreen = installPredictionsScreen(document);
}
```

- [ ] **Step 5: Copy the predictions directory in the build**

Add explicit recursive copy logic using `readdir(...,{withFileTypes:true})` and `copyFile`, preserving relative `.mjs` and `.css` names under `dist/predictions/`. Do not bundle or rewrite source text.

- [ ] **Step 6: Run clean test/build gate**

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 7: Verify canary in deployed production without switching normal users**

After Cloudflare deploy, open through launcher with `?native_predictions=1`. Verify:

- second bottom button is unchanged;
- hub has five tournaments;
- 4th UEFA round says `после завершения 3-го тура`;
- no lock glyphs;
- My Predictions uses `— : —` plus small copy;
- LIVE pill is red;
- 15-second refresh does not reset a draft or jump the native scroll container.

Do not proceed if any of these fail.

- [ ] **Step 8: Commit**

```bash
git add cloudflare-production/src/app-shell.html cloudflare-production/scripts/build.mjs cloudflare-production/src/predictions cloudflare-production/test/build.test.mjs
git commit -m "feat: ship native predictions behind canary"
```

---

### Task 7: Switch the existing Predictions tab to native and remove the prediction injector stack

**Files:**
- Modify: `cloudflare-production/src/predictions/predictions-screen.mjs`
- Modify: `cloudflare-production/scripts/build.mjs`
- Modify: `cloudflare-production/test/build.test.mjs`
- Delete: `cloudflare-production/scripts/multitournament-predictions-runtime.mjs`
- Delete: `cloudflare-production/scripts/multitournament-predictions-theme.mjs`
- Delete: `cloudflare-production/scripts/prediction-stage-lock-ui.mjs`
- Delete: `cloudflare-production/scripts/prediction-live-scroll-polish.mjs`
- Delete: `cloudflare-production/scripts/prediction-mine-stage-polish.mjs`
- Delete or split: `cloudflare-production/scripts/home-predictions-nav-fix.mjs`; no prediction behavior may remain in build-time patching.
- Delete obsolete tests:
  - `cloudflare-production/test/multitournament-predictions-runtime.test.mjs`
  - `cloudflare-production/test/multitournament-predictions-theme.test.mjs`
  - `cloudflare-production/test/prediction-stage-lock-ui.test.mjs`
  - `cloudflare-production/test/prediction-live-scroll-polish.test.mjs`
  - `cloudflare-production/test/prediction-mine-stage-polish.test.mjs`
  - `cloudflare-production/test/home-predictions-nav-fix.test.mjs` after its non-prediction assertions are moved to static-shell/build tests.

**Interfaces:**
- Consumes: canary-proven native screen.
- Produces: native Predictions enabled by default and a build that has zero imports/calls to the deleted prediction injectors.

- [ ] **Step 1: Change the build test from “markers present” to “injectors forbidden” and witness RED**

Replace the old marker-order test with:

```js
test('production build has no prediction injector stack', async () => {
  const source = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  const forbidden = [
    'multitournament-predictions-runtime',
    'multitournament-predictions-theme',
    'prediction-stage-lock-ui',
    'prediction-live-scroll-polish',
    'prediction-mine-stage-polish',
    'injectMultitournamentPredictionsPatch',
    'injectPredictionStageLockUiPatch',
  ];
  for (const token of forbidden) assert.doesNotMatch(source, new RegExp(token));
});
```

Run:

```bash
node --test test/build.test.mjs
```

Expected: FAIL because the current build still imports/invokes the old prediction layers.

- [ ] **Step 2: Enable native Predictions by default**

Replace the canary-only guard with:

```js
if (typeof document !== 'undefined') {
  globalThis.CiaoPredictionsScreen = installPredictionsScreen(document);
}
```

Keep `?native_predictions=0` out of the production design; rollback is Git/`stable`, not a permanent second UI implementation.

- [ ] **Step 3: Remove all prediction-specific imports/invocations from `build.mjs`**

The remaining production preparation order may still contain unrelated accepted layers such as BSD crests, Matches runtime/theme, and global refresh. It must not call any deleted Predictions injector.

If `home-predictions-nav-fix.mjs` contains the only source for the current `Главная` / `Прогнозы` bottom labels, copy those labels directly into tracked `src/app-shell.html` once and remove the runtime patch. The static shell must contain both labels before deleting the file.

- [ ] **Step 4: Prevent legacy global refresh from double-refreshing the hidden legacy mine view**

In `global-refresh-runtime.mjs`, add one narrow guard to its visible refresh dispatch:

```js
if (tab === 'mine' && globalThis.CiaoPredictionsScreen?.isOpen?.()) return;
```

The native screen owns its own 15-second refresh. Do not call its `refresh()` from the legacy scheduler as well.

- [ ] **Step 5: Delete obsolete injector files and their tests**

Delete exactly the files listed above. Keep `stage-gate.test.mjs` and external backend tests because they validate the server-side gate, which remains authoritative.

- [ ] **Step 6: Run the full production suite and build**

```bash
npm test
npm run build
```

Expected: PASS, with no deleted injector import resolution errors.

- [ ] **Step 7: Assert native-only invariants in the built HTML/source tree**

Check:

```bash
rg "ciao-prod-multitournament-predictions|ciao-prod-prediction-stage-lock-ui|ciao-prod-prediction-live-scroll-polish|ciao-prod-prediction-mine-stage-polish" dist src scripts
```

Expected: no matches in `dist`, `src`, or active `scripts`.

Also verify:

```bash
rg "MutationObserver|__cwPred|predict=function|mine=function" src/predictions
```

Expected: no matches.

- [ ] **Step 8: Commit**

```bash
git add -A cloudflare-production
git commit -m "refactor: replace prediction patch stack with native screen"
```

---

### Task 8: Production verification of data, delivery, refresh, and visual invariants

**Files:**
- Modify only tests if a production-only mismatch reveals a missing contract; do not add UI patch files.
- Keep: `cloudflare-production/test/telegram-launch-chain.test.mjs`
- Keep: `cloudflare-production/test/html-cache-control.test.mjs`
- Keep: `cloudflare-production/test/stage-gate.test.mjs`
- Keep: all external prediction backend tests.

**Interfaces:**
- Consumes: native-only production build from Task 7.
- Produces: evidence that production serves the current native screen through the actual Telegram path.

- [ ] **Step 1: Run fresh CI-equivalent verification**

```bash
cd cloudflare-production
npm test
npm run build
```

Record the exact pass count and build result. Do not claim success from an earlier run.

- [ ] **Step 2: Verify Cloudflare root and delivery headers**

Check through the real launcher destination that the final HTML returns:

```text
HTTP 200
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
```

Verify two launcher opens produce different `?v=` values.

- [ ] **Step 3: Verify native asset delivery**

Request and confirm HTTP 200 for:

```text
/predictions/predictions-screen.mjs
/predictions/predictions-screen.css
/predictions/controller.mjs
/predictions/model.mjs
/predictions/data-client.mjs
/predictions/view.mjs
```

- [ ] **Step 4: Verify backend health and current competition state**

Check:

```text
ciao-core-api-fast-v4 health/state path: 200
ciao-external-predictions GET health: 200
```

For external state, verify server payload still exposes `stage_locked` and `prediction_stage_key` for UEFA and canonical ids like `uel:<provider_event_id>`.

- [ ] **Step 5: Perform the exact visual regression sequence in Telegram Mini App**

1. Open **Прогнозы** from the existing second bottom button.
2. Confirm no top-level mode toggle on the five-tournament hub.
3. Open Лига Европы; confirm mode toggle is inside the tournament.
4. Select 4th round; confirm disabled chip has no lock glyph and note says `Прогнозы на этот тур откроются после завершения 3-го тура`.
5. Open **Мои прогнозы**; confirm missing prediction renders large `— : —` and small `Прогноз не сделан`, with no text collision.
6. Open a currently live match; confirm only the `LIVE · N′` pill is red.
7. Change an editable prediction, wait at least 31 seconds, and confirm two refresh cycles do not reset draft or move the visible card.
8. Switch `Прогнозы → Мои прогнозы → Прогнозы`; confirm tournament and stage remain selected.
9. Switch to Главная/Матчи/Рейтинг and confirm those tabs remain unchanged.

- [ ] **Step 6: Stop at visual acceptance gate**

Do **not** move `stable`. Report the production commit and ask for explicit user approval. Only after approval may a separate branch-ref action promote `stable`.

---

## Self-Review

- **Spec coverage:** tracked shell, one module-owned screen, existing nav button, data flow for Serie A/external competitions, UEFA gating, compact My Predictions, red LIVE, 15-second refresh, no MutationObserver/global overwrites, cache path, removal of old prediction injectors, tests, rollout, and stable gate are each mapped to a task.
- **Placeholder scan:** no `TODO`, `TBD`, “implement later”, or unnamed test/error-handling steps remain.
- **Type/interface consistency:** competition keys use the existing production values `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`; external API actions are exactly `state` and `save_predictions`; canonical external IDs remain strings such as `uel:123`; controller methods named in Task 3 are the methods used by Tasks 5–7.
