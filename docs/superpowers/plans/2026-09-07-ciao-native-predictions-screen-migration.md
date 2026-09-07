# Ciao Native Predictions Screen Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stacked prediction HTML/runtime patches with one module-owned `PredictionsScreen` while keeping the existing second bottom-nav button in exactly the same place and preserving all other production tabs.

**Architecture:** First freeze the accepted v22.5 shell as a tracked local build input without changing behavior. Then add a dedicated predictions model/data/controller/view module set plus one static stylesheet, prove it behind a canary query switch, route only `button[data-tab="mine"]` to that native screen, and finally delete the prediction-specific injector stack. Existing Matches, Worker API, Supabase backends, Telegram launcher/cache-buster, and non-Predictions tabs remain intact.

**Tech Stack:** Cloudflare Workers + Static Assets, browser ES modules, vanilla JS/CSS, Node.js `node:test`, Supabase Edge Functions (`ciao-core-api-fast-v4`, `ciao-external-predictions`).

**Spec:** `docs/superpowers/specs/2026-09-07-ciao-native-predictions-screen-migration-design.md`

## Global Constraints

- Bottom navigation remains exactly `Главная | Прогнозы | Рейтинг | Матчи | Таблицы | Профиль`.
- The second bottom-nav button keeps its current icon, label, order, and `data-tab="mine"` target.
- Do not redesign Главная, Рейтинг, Матчи, Таблицы, or Профиль.
- Do not move `stable` until explicit visual approval.
- No x2. Scoring remains `5 / 3 / 2 / 0`.
- Prediction deadline remains 15 minutes before kickoff.
- UEFA future rounds remain visible but disabled, with no emoji lock and no CSS-drawn lock.
- Round N+1 opens only after every match of round N is finished.
- Only real LIVE is red `#E7072E`; `ПЕРЕРЫВ`, `ДОП. ВРЕМЯ`, and `ПЕНАЛЬТИ` use neutral status styling.
- Predictions refresh every 15 seconds only while the native screen is visible. Drafts, selected tournament/mode/stage, vertical scroll, and stage-chip horizontal scroll must survive refresh.
- No Predictions module may overwrite legacy `predict()`, `mine()`, `render()`, `bind()`, or `saveAll()`.
- No Predictions module may create a `MutationObserver` to rewrite legacy markup.
- Keep Telegram delivery path and HTML cache behavior: launcher → cache-busted Cloudflare URL → Worker-first HTML with `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.

---

### Task 1: Make the accepted v22.5 shell a tracked local build input

**Files:**
- Create: `cloudflare-production/src/app-shell.html`
- Modify: `cloudflare-production/scripts/build.mjs`
- Modify: `cloudflare-production/test/build.test.mjs`

**Interfaces:**
- Consumes once: `https://dkefzepiiudehhzbbrjn.supabase.co/storage/v1/object/public/ciao-miniapp/migration/v22-5-resolved-no-x2.html`.
- Produces: `APP_SHELL_PATH` and `loadAppShell()`; every later production build reads the tracked file and performs no remote release fetch.

- [ ] **Step 1: Add the failing local-shell test**

Add to `test/build.test.mjs`:

```js
import { readFile } from 'node:fs/promises';

test('production build uses tracked app shell instead of remote release HTML', async () => {
  assert.equal(typeof productionBuild.loadAppShell, 'function');
  assert.equal('RELEASE_SOURCE_URL' in productionBuild, false);
  const shell = await productionBuild.loadAppShell();
  const tracked = await readFile(new URL('../src/app-shell.html', import.meta.url), 'utf8');
  assert.equal(shell, tracked);
  assert.match(shell, /ciao-prod-no-x2-20260903/);
});
```

- [ ] **Step 2: Run RED**

```bash
cd cloudflare-production
node --test test/build.test.mjs
```

Expected: FAIL because `loadAppShell` and `src/app-shell.html` do not exist and the build still exports/uses `RELEASE_SOURCE_URL`.

- [ ] **Step 3: Snapshot the exact accepted base into the repository**

```bash
cd cloudflare-production
node --input-type=module -e "import{writeFile}from'node:fs/promises';const u='https://dkefzepiiudehhzbbrjn.supabase.co/storage/v1/object/public/ciao-miniapp/migration/v22-5-resolved-no-x2.html';const r=await fetch(u,{headers:{'cache-control':'no-cache'}});if(!r.ok)throw new Error('HTTP '+r.status);await writeFile('src/app-shell.html',await r.text(),'utf8')"
```

Then run:

```bash
node --input-type=module -e "import{readFile}from'node:fs/promises';const s=await readFile('src/app-shell.html','utf8');if(!s.includes('ciao-prod-no-x2-20260903'))process.exit(1);console.log(s.length)"
```

Expected: exits 0 and prints a non-zero length.

- [ ] **Step 4: Switch `build.mjs` to the tracked file**

Use:

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
  await mkdir(resolve(distDir, 'releases'), { recursive: true });
  await writeFile(resolve(distDir, 'index.html'), rootHtml, 'utf8');
  await writeFile(releaseOut, release, 'utf8');
  return { ok: true, entry: 'dist/index.html', release: 'dist/releases/v22-5.html', bytes: Buffer.byteLength(release) };
}
```

Delete `RELEASE_SOURCE_URL` and the release `fetch()` path. Keep the existing injector order unchanged in this task so behavior stays identical.

- [ ] **Step 5: Run GREEN baseline**

```bash
npm test
npm run build
```

Expected: existing suite passes and both `dist/index.html` and `dist/releases/v22-5.html` are produced.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-production/src/app-shell.html cloudflare-production/scripts/build.mjs cloudflare-production/test/build.test.mjs
git commit -m "refactor: track production app shell locally"
```

---

### Task 2: Add one Predictions domain model and one backend client

**Files:**
- Create: `cloudflare-production/src/predictions/model.mjs`
- Create: `cloudflare-production/src/predictions/data-client.mjs`
- Create: `cloudflare-production/test/predictions-model.test.mjs`
- Create: `cloudflare-production/test/predictions-data-client.test.mjs`
- Reuse: `cloudflare-production/src/matches/competition-config.mjs`

**Interfaces:**
- `groupPredictionMatches(matches)` → ordered stage groups.
- `previousLeagueRoundLabel(stageKey)` → `1-го тура`, `2-го тура`, etc.
- `isStageLocked(group)` → boolean.
- `predictionStatus(match)` → `{ text, tone }`.
- `predictionCardView(match, draft)` → card view-model.
- `createPredictionsDataClient({ fetchImpl, getInitData })` → `{ loadSerieAState, saveSerieAPredictions, loadExternalState, saveExternalPredictions }`.

- [ ] **Step 1: Write model RED tests**

Create `test/predictions-model.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previousLeagueRoundLabel,
  isStageLocked,
  predictionStatus,
  predictionCardView,
} from '../src/predictions/model.mjs';

test('previous-round copy derives from selected UEFA round', () => {
  assert.equal(previousLeagueRoundLabel('league-2'), '1-го тура');
  assert.equal(previousLeagueRoundLabel('league-3'), '2-го тура');
  assert.equal(previousLeagueRoundLabel('league-4'), '3-го тура');
  assert.equal(previousLeagueRoundLabel('league-8'), '7-го тура');
});

test('future stage is locked from backend flags without lock glyph state', () => {
  assert.equal(isStageLocked({ matches: [{ stage_locked: true }, { stage_locked: true }] }), true);
  assert.equal(isStageLocked({ matches: [{ stage_locked: false }, { stage_locked: false }] }), false);
});

test('only real live gets live tone', () => {
  assert.deepEqual(predictionStatus({ status: 'live', minute: 86 }), { text: 'LIVE · 86′', tone: 'live' });
  assert.deepEqual(predictionStatus({ status: 'halftime' }), { text: 'ПЕРЕРЫВ', tone: 'neutral' });
  assert.deepEqual(predictionStatus({ status: 'extra_time' }), { text: 'ДОП. ВРЕМЯ', tone: 'neutral' });
  assert.deepEqual(predictionStatus({ status: 'penalties' }), { text: 'ПЕНАЛЬТИ', tone: 'neutral' });
});

test('missing prediction has compact primary score text', () => {
  const vm = predictionCardView({ prediction: null, status: 'scheduled' }, null);
  assert.equal(vm.predictionText, '— : —');
  assert.equal(vm.predictionMissing, true);
  assert.equal(vm.predictionMissingLabel, 'Прогноз не сделан');
});
```

- [ ] **Step 2: Run model RED**

```bash
node --test test/predictions-model.test.mjs
```

Expected: FAIL because `model.mjs` does not exist.

- [ ] **Step 3: Implement the model helpers**

Use a single previous-round helper:

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

`predictionCardView()` must never use `Прогноз не сделан` as the primary score text.

- [ ] **Step 4: Write exact data-client RED tests**

Create `test/predictions-data-client.test.mjs` with a helper that records every request and returns `{ ok:true, data:{} }`. Assert:

```js
const calls = [];
const client = createPredictionsDataClient({
  getInitData: () => 'telegram-init',
  fetchImpl: async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
  },
});

await client.loadExternalState('uel');
assert.equal(calls[0].body.action, 'state');
assert.equal(calls[0].body.competition, 'uel');
assert.equal(calls[0].init.headers['x-telegram-init-data'], 'telegram-init');

calls.length = 0;
await client.saveExternalPredictions('uel', [{ match_id:'uel:123', home_score:1, away_score:0 }]);
assert.deepEqual(calls[0].body, {
  action: 'save_predictions',
  competition: 'uel',
  predictions: [{ match_id:'uel:123', home_score:1, away_score:0 }],
});

calls.length = 0;
await client.loadSerieAState(3);
assert.deepEqual(calls[0].body, { action:'state', round:3 });

calls.length = 0;
await client.saveSerieAPredictions(3, [{ match_id:99, home_score:2, away_score:1 }]);
assert.deepEqual(calls[0].body, {
  action:'save_predictions',
  round:3,
  predictions:[{ match_id:99, home_score:2, away_score:1 }],
});
```

- [ ] **Step 5: Run data-client RED**

```bash
node --test test/predictions-data-client.test.mjs
```

Expected: FAIL because `data-client.mjs` does not exist.

- [ ] **Step 6: Implement the data client**

Use fixed endpoints:

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

Implement the four methods with the exact request bodies asserted above.

- [ ] **Step 7: Run GREEN**

```bash
node --test test/predictions-model.test.mjs test/predictions-data-client.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add cloudflare-production/src/predictions/model.mjs cloudflare-production/src/predictions/data-client.mjs cloudflare-production/test/predictions-model.test.mjs cloudflare-production/test/predictions-data-client.test.mjs
git commit -m "feat: add native predictions model and data client"
```

---

### Task 3: Add one Predictions controller for state, drafts, and 15-second refresh

**Files:**
- Create: `cloudflare-production/src/predictions/controller.mjs`
- Create: `cloudflare-production/test/predictions-controller.test.mjs`

**Interfaces:**
- Consumes: Task 2 data client/model.
- Produces: `createPredictionsController({ dataClient, render, setTimer, clearTimer, documentRef })` returning `open`, `close`, `openHub`, `openCompetition`, `setMode`, `setStage`, `adjustScore`, `save`, `refresh`, `snapshot`, `isOpen`.

- [ ] **Step 1: Write controller RED tests**

Use a fake data client whose `loadExternalState()` returns a deterministic payload. Assert all four behaviors explicitly:

```js
await controller.openCompetition('uel');
controller.setStage('league-3');
controller.setMode('mine');
let snap = controller.snapshot();
assert.equal(snap.competition, 'uel');
assert.equal(snap.stageKey, 'league-3');
assert.equal(snap.mode, 'mine');

controller.setMode('edit');
controller.adjustScore('uel:123', 'h', 1);
await controller.refresh();
snap = controller.snapshot();
assert.deepEqual(snap.drafts.get('uel:123'), { h:1, a:0 });

const p1 = controller.refresh();
const p2 = controller.refresh();
assert.equal(p1, p2);
await p1;

controller.close();
assert.equal(controller.isOpen(), false);
assert.equal(clearedTimerIds.includes(lastScheduledTimerId), true);
```

- [ ] **Step 2: Run RED**

```bash
node --test test/predictions-controller.test.mjs
```

Expected: FAIL because `controller.mjs` does not exist.

- [ ] **Step 3: Implement one authoritative state object**

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

`setMode()` changes only `mode`. `adjustScore()` clamps each score to `0..20` and updates only `drafts`.

- [ ] **Step 4: Implement one in-flight refresh and one timer**

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

function refresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
  return refreshPromise;
}
```

On `visibilitychange`: hidden cancels timer; visible while open calls `refresh()` immediately then schedules again.

- [ ] **Step 5: Run GREEN**

```bash
node --test test/predictions-controller.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-production/src/predictions/controller.mjs cloudflare-production/test/predictions-controller.test.mjs
git commit -m "feat: add native predictions controller"
```

---

### Task 4: Render the native screen and style it from one static CSS file

**Files:**
- Create: `cloudflare-production/src/predictions/view.mjs`
- Create: `cloudflare-production/src/predictions/predictions-screen.css`
- Create: `cloudflare-production/test/predictions-view.test.mjs`

**Interfaces:**
- Consumes: controller snapshot and Task 2 model helpers.
- Produces: `renderPredictionsView(snapshot)` and static `.cw-pred-native-*` styles.

- [ ] **Step 1: Write view RED tests for every current visual bug**

```js
const hub = renderPredictionsView(hubFixture());
assert.equal((hub.match(/data-pred-competition=/g) || []).length, 5);
assert.doesNotMatch(hub, /data-pred-mode=/);

const tournament = renderPredictionsView(competitionFixture({ mode:'mine', selectedStage:'league-4', locked:true }));
assert.match(tournament, /data-pred-mode="edit"/);
assert.match(tournament, /data-pred-mode="mine"/);
assert.match(tournament, /после завершения 3-го тура/);
assert.doesNotMatch(tournament, /🔒|🔐/);

const mine = renderPredictionsView(mineFixture({ prediction:null }));
assert.match(mine, />— : —</);
assert.match(mine, />Прогноз не сделан</);
assert.doesNotMatch(mine, /<b>Прогноз не сделан<\/b>/);

const live = renderPredictionsView(statusFixture('live'));
const half = renderPredictionsView(statusFixture('halftime'));
assert.match(live, /cw-pred-native-status--live/);
assert.doesNotMatch(half, /cw-pred-native-status--live/);
```

- [ ] **Step 2: Run RED**

```bash
node --test test/predictions-view.test.mjs
```

Expected: FAIL because `view.mjs` is missing.

- [ ] **Step 3: Implement one render tree**

The tournament view must always render in this order:

```html
<section class="cw-pred-native-screen" data-theme="europa">
  <header class="cw-pred-native-header"></header>
  <div class="cw-pred-native-modes"></div>
  <div class="cw-pred-native-stages"></div>
  <div class="cw-pred-native-stage-heading"></div>
  <div class="cw-pred-native-cards"></div>
  <div class="cw-pred-native-savebar"></div>
</section>
```

The hub renders only the five tournament cards and scoring note. It does not render the mode switch.

- [ ] **Step 4: Make locked round chips plain muted disabled buttons**

Locked chip markup:

```html
<button type="button" class="cw-pred-native-stage is-disabled" data-pred-stage="league-4" disabled aria-disabled="true">4</button>
```

No `::before`, `::after`, lock icon, emoji, or lock SVG is permitted for this state.

- [ ] **Step 5: Add the owned mount geometry and My Predictions geometry to static CSS**

```css
#ciao-native-predictions-root{
  position:fixed;
  inset:0 0 calc(78px + env(safe-area-inset-bottom,0px)) 0;
  z-index:42;
  overflow-y:auto;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
  background:#07101f;
}
#ciao-native-predictions-root[hidden]{display:none!important}

.cw-pred-native-matchline{
  display:grid;
  grid-template-columns:minmax(0,1fr) 96px minmax(0,1fr);
  align-items:center;
  gap:10px;
}
.cw-pred-native-prediction{min-width:0;text-align:center}
.cw-pred-native-prediction strong{display:block;white-space:nowrap;font-size:20px;line-height:1}
.cw-pred-native-prediction small{display:block;margin-top:5px;font-size:9px;line-height:1.15;color:rgba(255,255,255,.48)}
.cw-pred-native-team-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
```

This bottom inset preserves the existing bottom nav as the visible navigation authority.

- [ ] **Step 6: Add LIVE styling only in static CSS**

```css
.cw-pred-native-status--live{
  background:#E7072E;
  color:#fff;
  border-color:#E7072E;
  box-shadow:0 0 16px rgba(231,7,46,.28);
}
```

Do not create `<style>` elements from JavaScript.

- [ ] **Step 7: Run GREEN**

```bash
node --test test/predictions-view.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add cloudflare-production/src/predictions/view.mjs cloudflare-production/src/predictions/predictions-screen.css cloudflare-production/test/predictions-view.test.mjs
git commit -m "feat: render native predictions screen"
```

---

### Task 5: Mount the native screen on the existing second nav button

**Files:**
- Create: `cloudflare-production/src/predictions/predictions-screen.mjs`
- Create: `cloudflare-production/test/predictions-screen.test.mjs`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces: `installPredictionsScreen(documentRef, options)` and `globalThis.CiaoPredictionsScreen = { open, close, refresh, isOpen }`.

- [ ] **Step 1: Write integration RED tests**

Use a fake document with buttons `data-tab="mine"` and `data-tab="table"`. Assert:

```js
const legacy = {
  predict: globalThis.predict,
  mine: globalThis.mine,
  render: globalThis.render,
  bind: globalThis.bind,
  saveAll: globalThis.saveAll,
};
const screen = installPredictionsScreen(fakeDocument, { enabled:true });

fakeDocument.clickNav('mine');
await fakeDocument.flushDeferred();
assert.equal(screen.isOpen(), true);

fakeDocument.clickNav('table');
await fakeDocument.flushDeferred();
assert.equal(screen.isOpen(), false);

assert.equal(globalThis.predict, legacy.predict);
assert.equal(globalThis.mine, legacy.mine);
assert.equal(globalThis.render, legacy.render);
assert.equal(globalThis.bind, legacy.bind);
assert.equal(globalThis.saveAll, legacy.saveAll);
assert.equal(fakeDocument.mutationObserverConstructCount, 0);
```

- [ ] **Step 2: Run RED**

```bash
node --test test/predictions-screen.test.mjs
```

Expected: FAIL because installer does not exist.

- [ ] **Step 3: Create one dedicated mount**

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

- [ ] **Step 4: Use one delegated nav listener without rewriting nav DOM**

For `button[data-tab]`, defer until the legacy handler updates its own active state, then:

```js
if (nav.dataset.tab === 'mine') controller.open();
else controller.close();
```

Do not call `preventDefault()` for bottom-nav buttons. Do not change nav text, icon, order, class names, or `data-tab`.

- [ ] **Step 5: Keep all native interactions inside the owned mount**

Only handle `target.closest()` results inside `mount` for:

```text
data-pred-competition
data-pred-mode
data-pred-stage
data-pred-delta
data-pred-action="save"
data-pred-action="retry"
data-pred-action="back"
```

- [ ] **Step 6: Preserve local scroll without touching `window` scroll**

Before owned re-render:

```js
const top = mount.scrollTop;
const stageLeft = mount.querySelector('.cw-pred-native-stages')?.scrollLeft ?? 0;
mount.innerHTML = renderPredictionsView(controller.snapshot());
mount.scrollTop = top;
mount.querySelector('.cw-pred-native-stages')?.scrollTo?.({ left: stageLeft, behavior:'instant' });
```

Do not call `window.scrollBy()` and do not restore legacy page anchors.

- [ ] **Step 7: Run GREEN**

```bash
node --test test/predictions-screen.test.mjs test/predictions-controller.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add cloudflare-production/src/predictions/predictions-screen.mjs cloudflare-production/test/predictions-screen.test.mjs
git commit -m "feat: mount native predictions on existing nav tab"
```

---

### Task 6: Ship native Predictions behind a canary, then switch and remove the injector stack

**Files:**
- Modify: `cloudflare-production/src/app-shell.html`
- Modify: `cloudflare-production/scripts/build.mjs`
- Modify: `cloudflare-production/scripts/global-refresh-runtime.mjs`
- Modify: `cloudflare-production/test/build.test.mjs`
- Delete after canary passes:
  - `cloudflare-production/scripts/multitournament-predictions-runtime.mjs`
  - `cloudflare-production/scripts/multitournament-predictions-theme.mjs`
  - `cloudflare-production/scripts/prediction-stage-lock-ui.mjs`
  - `cloudflare-production/scripts/prediction-live-scroll-polish.mjs`
  - `cloudflare-production/scripts/prediction-mine-stage-polish.mjs`
  - prediction behavior in `cloudflare-production/scripts/home-predictions-nav-fix.mjs`
- Delete after canary passes:
  - `cloudflare-production/test/multitournament-predictions-runtime.test.mjs`
  - `cloudflare-production/test/multitournament-predictions-theme.test.mjs`
  - `cloudflare-production/test/prediction-stage-lock-ui.test.mjs`
  - `cloudflare-production/test/prediction-live-scroll-polish.test.mjs`
  - `cloudflare-production/test/prediction-mine-stage-polish.test.mjs`
  - `cloudflare-production/test/home-predictions-nav-fix.test.mjs` after its nav-label assertions move to `build.test.mjs`.

**Interfaces:**
- Produces static assets under `/predictions/`.
- Canary switch: `?native_predictions=1` only until visual proof.
- Final switch: native enabled by default; old prediction injectors absent from active build.

- [ ] **Step 1: Add RED build assertions for native static assets**

```js
await productionBuild.build();
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
assert.match(html, /predictions\/predictions-screen\.css/);
assert.match(html, /type="module"[^>]+predictions\/predictions-screen\.mjs/);
await stat(new URL('../dist/predictions/predictions-screen.mjs', import.meta.url));
await stat(new URL('../dist/predictions/predictions-screen.css', import.meta.url));
```

Run `node --test test/build.test.mjs`; expected RED.

- [ ] **Step 2: Add explicit static entries to the tracked shell**

Before `</head>`:

```html
<link rel="stylesheet" href="/predictions/predictions-screen.css">
```

Before `</body>`:

```html
<script type="module" src="/predictions/predictions-screen.mjs"></script>
```

These entries must live in `src/app-shell.html`; `build.mjs` must not inject them.

- [ ] **Step 3: Copy `src/predictions/` unchanged into `dist/predictions/`**

Implement recursive copy with `readdir(...,{withFileTypes:true})`, `mkdir`, and `copyFile`. Browser module imports remain relative and unbundled.

- [ ] **Step 4: Enable canary only**

In `predictions-screen.mjs`:

```js
function nativePredictionsEnabled(locationRef = globalThis.location) {
  return new URLSearchParams(locationRef?.search || '').get('native_predictions') === '1';
}

if (typeof document !== 'undefined' && nativePredictionsEnabled()) {
  globalThis.CiaoPredictionsScreen = installPredictionsScreen(document);
}
```

Run:

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 5: Verify canary through the real launcher**

Open with `?native_predictions=1` and verify all of the following before proceeding:

```text
second bottom nav button unchanged
hub has five tournaments
mode switch appears only inside a tournament
4th UEFA round says after completion of 3rd round
no lock glyphs/drawings
My Predictions shows large — : — and small Прогноз не сделан
only LIVE pill is red
31 seconds of refresh do not reset draft or jump scroll
switching mode preserves tournament and stage
```

If any item fails, stop here and fix the native module; do not touch the old injector stack.

- [ ] **Step 6: Add RED assertion that prediction injectors are forbidden**

Replace the old marker-order test with:

```js
const buildSource = await readFile(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
for (const token of [
  'multitournament-predictions-runtime',
  'multitournament-predictions-theme',
  'prediction-stage-lock-ui',
  'prediction-live-scroll-polish',
  'prediction-mine-stage-polish',
  'injectMultitournamentPredictionsPatch',
  'injectPredictionStageLockUiPatch',
]) {
  assert.doesNotMatch(buildSource, new RegExp(token));
}
```

Run `node --test test/build.test.mjs`; expected RED while old imports remain.

- [ ] **Step 7: Switch native Predictions on by default**

Replace the canary guard with:

```js
if (typeof document !== 'undefined') {
  globalThis.CiaoPredictionsScreen = installPredictionsScreen(document);
}
```

- [ ] **Step 8: Remove old prediction-specific build layers**

Delete all listed prediction injector imports/calls. Before deleting `home-predictions-nav-fix.mjs`, make the tracked shell itself contain the final static labels `Главная` for `data-tab="predict"` and `Прогнозы` for `data-tab="mine"`. Add build-test assertions for both labels.

Keep unrelated BSD crest, Matches runtime/theme, and other non-Predictions layers.

- [ ] **Step 9: Prevent the legacy global scheduler from double-refreshing hidden Predictions**

In `global-refresh-runtime.mjs` add exactly one guard at dispatch time:

```js
if (tab === 'mine' && globalThis.CiaoPredictionsScreen?.isOpen?.()) return;
```

The native controller owns its own 15-second timer.

- [ ] **Step 10: Delete obsolete prediction patch tests and files**

Keep `stage-gate.test.mjs` and all external backend tests; they validate server-side behavior that remains authoritative.

- [ ] **Step 11: Run the full native-only gate**

```bash
npm test
npm run build
rg "ciao-prod-multitournament-predictions|ciao-prod-prediction-stage-lock-ui|ciao-prod-prediction-live-scroll-polish|ciao-prod-prediction-mine-stage-polish" dist src scripts
rg "MutationObserver|__cwPred|predict=function|mine=function" src/predictions
```

Expected: tests/build PASS; both `rg` commands return no matches.

- [ ] **Step 12: Commit**

```bash
git add -A cloudflare-production
git commit -m "refactor: replace prediction patch stack with native screen"
```

---

### Task 7: Production verification and visual acceptance gate

**Files:**
- Do not create UI patch files in this task.
- Keep: `cloudflare-production/test/telegram-launch-chain.test.mjs`
- Keep: `cloudflare-production/test/html-cache-control.test.mjs`
- Keep: `cloudflare-production/test/stage-gate.test.mjs`
- Keep: all external prediction backend tests.

**Interfaces:**
- Consumes: native-only build from Task 6.
- Produces: fresh evidence for production correctness and a user visual-approval checkpoint.

- [ ] **Step 1: Run fresh CI-equivalent verification**

```bash
cd cloudflare-production
npm test
npm run build
```

Record the exact pass count and build result from this run.

- [ ] **Step 2: Verify the real delivery chain**

Through the launcher, verify:

```text
launcher health = 200
two consecutive launcher opens have different ?v= values
Cloudflare destination HTML = 200
Cache-Control = no-store, no-cache, must-revalidate, max-age=0
```

- [ ] **Step 3: Verify native assets return 200**

```text
/predictions/predictions-screen.mjs
/predictions/predictions-screen.css
/predictions/controller.mjs
/predictions/model.mjs
/predictions/data-client.mjs
/predictions/view.mjs
```

- [ ] **Step 4: Verify backend contracts remain healthy**

```text
ciao-core-api-fast-v4 = 200
ciao-external-predictions GET health = 200
external UEFA state still exposes stage_locked and prediction_stage_key
external match ids remain canonical strings such as uel:123
```

- [ ] **Step 5: Perform the exact Telegram Mini App visual regression**

1. Open **Прогнозы** from the existing second bottom button.
2. Confirm the bottom button itself is unchanged.
3. Confirm hub has five tournaments and no top-level mode switch.
4. Open Лига Европы; confirm `Прогнозы | Мои прогнозы` is inside the tournament.
5. Select 4th round; confirm chip is muted without lock and copy says `Прогнозы на этот тур откроются после завершения 3-го тура`.
6. Open **Мои прогнозы**; confirm missing prediction uses large `— : —` and small `Прогноз не сделан` with no collision.
7. Open a real live match; confirm only `LIVE · N′` is red.
8. Change an editable prediction, wait at least 31 seconds, and confirm two refresh cycles do not reset the draft or move the visible card.
9. Switch `Прогнозы → Мои прогнозы → Прогнозы`; confirm tournament and stage remain selected.
10. Switch to Главная, Матчи, Рейтинг, Таблицы, Профиль; confirm those screens are unchanged.

- [ ] **Step 6: Stop at the acceptance gate**

Do not move `stable`. Report the production commit and ask for explicit visual approval. Promote `stable` only after the user says the production version is accepted.

---

## Self-Review

- **Spec coverage:** tracked shell, one module-owned screen, existing nav button, Serie A/external data paths, UEFA gating, compact My Predictions, red LIVE, 15-second refresh, no MutationObserver/global overrides, delivery/cache path, removal of all prediction injectors, tests, canary rollout, and stable gate are all mapped to tasks.
- **Placeholder scan:** no `TODO`, `TBD`, “implement later”, comment-only test bodies, or unnamed validation steps remain.
- **Type consistency:** production competition keys remain `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`; external API actions remain exactly `state` and `save_predictions`; canonical external IDs remain strings such as `uel:123`; controller methods named in Task 3 are the methods used by the installer and rollout tasks.
