# Telegram Release Revision Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every production Cloudflare release automatically produce a content-derived Telegram Web App revision, and update Telegram only after the exact new HTML is confirmed live.

**Architecture:** The production build computes a 12-character SHA-256 revision from the final `dist/index.html`. GitHub Actions waits until the public Worker serves bytes with that same revision, then calls a narrow Supabase router endpoint that independently verifies the Worker hash before updating Telegram. Telegram propagation and the final launcher-to-Worker route are then verified end to end.

**Tech Stack:** Node.js 22, Node test runner, Cloudflare Workers/Wrangler, GitHub Actions, Supabase Edge Functions (Deno), Telegram Bot API.

**Spec:** `docs/superpowers/specs/2026-09-08-telegram-release-revision-design.md`

## Global Constraints

- Production Worker: `https://ciao-web-app.ciao-web.workers.dev/`.
- Telegram launcher base: `https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app`.
- Telegram router: `https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-pronostici-router`.
- Revision format: first 12 lowercase hexadecimal characters of SHA-256 over the exact final `dist/index.html` bytes.
- Cloudflare polling: every 10 seconds, maximum 5 minutes.
- Telegram propagation polling: every 5 seconds, maximum 2 minutes.
- Pull requests run tests/build only; they MUST NOT update Telegram.
- GitHub Actions MUST NOT receive `TELEGRAM_BOT_TOKEN`.
- The release-sync endpoint MUST NOT accept an arbitrary destination URL.
- Existing Mini App UI/runtime behavior is out of scope.
- Existing Cloudflare Git deployment remains the deployment mechanism.
- Existing rollback/stable-build behavior remains available.

---

### Task 1: Add deterministic production revision generation

**Files:**
- Create: `cloudflare-production/scripts/release-revision.mjs`
- Modify: `cloudflare-production/scripts/build.mjs`
- Create: `cloudflare-production/test/release-revision.test.mjs`
- Modify: `cloudflare-production/test/build.test.mjs`

**Interfaces:**
- Produces: `releaseRevision(input: string | Uint8Array): string`
- Produces: `isReleaseRevision(value: unknown): boolean`
- Produces build artifact: `cloudflare-production/dist/release-revision.txt`
- `build()` result gains `revision: string`.

- [ ] **Step 1: Write the failing unit tests for content hashing**

Create `cloudflare-production/test/release-revision.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseRevision, isReleaseRevision } from '../scripts/release-revision.mjs';

test('release revision is the first 12 lowercase hex chars of SHA-256', () => {
  assert.equal(releaseRevision('hello'), '2cf24dba5fb0');
  assert.match(releaseRevision('hello'), /^[0-9a-f]{12}$/);
});

test('release revision is deterministic and changes when bytes change', () => {
  const a = releaseRevision(new TextEncoder().encode('same'));
  const b = releaseRevision(new TextEncoder().encode('same'));
  const c = releaseRevision(new TextEncoder().encode('same!'));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('release revision validator accepts only 12 lowercase hex characters', () => {
  assert.equal(isReleaseRevision('e833e3ab9551'), true);
  assert.equal(isReleaseRevision('E833E3AB9551'), false);
  assert.equal(isReleaseRevision('e833e3ab955'), false);
  assert.equal(isReleaseRevision('e833e3ab95511'), false);
  assert.equal(isReleaseRevision('zz33e3ab9551'), false);
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run from `cloudflare-production`:

```bash
node --test test/release-revision.test.mjs
```

Expected: FAIL because `../scripts/release-revision.mjs` does not exist.

- [ ] **Step 3: Implement the minimal hashing helper**

Create `cloudflare-production/scripts/release-revision.mjs`:

```js
import { createHash } from 'node:crypto';

const REVISION_RE = /^[0-9a-f]{12}$/;

function asBuffer(input) {
  if (typeof input === 'string') return Buffer.from(input, 'utf8');
  if (input instanceof Uint8Array) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }
  throw new TypeError('release revision input must be a string or Uint8Array');
}

export function releaseRevision(input) {
  return createHash('sha256').update(asBuffer(input)).digest('hex').slice(0, 12);
}

export function isReleaseRevision(value) {
  return REVISION_RE.test(String(value ?? ''));
}
```

- [ ] **Step 4: Run the hashing test and verify GREEN**

```bash
node --test test/release-revision.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add a failing build-output regression test**

Extend `cloudflare-production/test/build.test.mjs` with a test around a new output helper:

```js
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { releaseRevision } from '../scripts/release-revision.mjs';

test('production output writes revision for the exact index.html bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ciao-release-'));
  try {
    const rootHtml = '<!doctype html><html><body>release</body></html>';
    const release = rootHtml;
    const result = await productionBuild.writeBuildOutputs({ outputDir: dir, rootHtml, release });
    const index = await readFile(join(dir, 'index.html'));
    const revisionFile = await readFile(join(dir, 'release-revision.txt'), 'utf8');
    const expected = releaseRevision(index);
    assert.equal(revisionFile, `${expected}\n`);
    assert.equal(result.revision, expected);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 6: Run only the build test and verify RED**

```bash
node --test test/build.test.mjs
```

Expected: FAIL because `writeBuildOutputs` is not exported.

- [ ] **Step 7: Add `writeBuildOutputs` and wire revision generation into `build()`**

In `cloudflare-production/scripts/build.mjs`:

```js
import { releaseRevision } from './release-revision.mjs';
```

Add:

```js
export async function writeBuildOutputs({ outputDir = distDir, rootHtml, release }) {
  const releasesDir = resolve(outputDir, 'releases');
  await mkdir(releasesDir, { recursive: true });
  await writeFile(resolve(outputDir, 'index.html'), rootHtml, 'utf8');
  await writeFile(resolve(releasesDir, 'v22-5.html'), release, 'utf8');
  const revision = releaseRevision(Buffer.from(rootHtml, 'utf8'));
  await writeFile(resolve(outputDir, 'release-revision.txt'), `${revision}\n`, 'utf8');
  return { revision };
}
```

Replace the direct output writes in `build()` with:

```js
const { revision } = await writeBuildOutputs({ rootHtml, release });
return {
  ok: true,
  entry: 'dist/index.html',
  release: 'dist/releases/v22-5.html',
  revision,
  bytes: Buffer.byteLength(release),
};
```

- [ ] **Step 8: Run targeted tests, then the full suite and build**

```bash
node --test test/release-revision.test.mjs test/build.test.mjs
npm test
npm run build
cat dist/release-revision.txt
```

Expected: all tests PASS; build exits 0; revision file contains exactly 12 lowercase hex characters plus newline.

- [ ] **Step 9: Commit Task 1**

```bash
git add cloudflare-production/scripts/release-revision.mjs cloudflare-production/scripts/build.mjs cloudflare-production/test/release-revision.test.mjs cloudflare-production/test/build.test.mjs
git commit -m "build: emit content-derived production revision"
```

---

### Task 2: Check the currently deployed Telegram router into source control

**Files:**
- Create: `supabase/functions/ciao-pronostici-router/index.ts`

**Interfaces:**
- Preserves the currently deployed router behavior before adding revision automation.
- No production deployment occurs in this task.

- [ ] **Step 1: Read the live `ciao-pronostici-router` Edge Function**

Use the connected Supabase function read for project `dkefzepiiudehhzbbrjn`, function `ciao-pronostici-router`, and capture its current `index.ts` exactly. The expected deployed baseline is router version 60 and currently uses the manually revised launcher URL ending in `?tg_rev=20260908-0525`.

- [ ] **Step 2: Create the tracked source file verbatim**

Write the exact returned `index.ts` to:

```text
supabase/functions/ciao-pronostici-router/index.ts
```

Do not refactor or change behavior in this commit.

- [ ] **Step 3: Verify the tracked source reproduces the deployed constants**

Confirm the tracked file contains all of these exact contracts:

```text
const APP_TEST_URL="https://ciao-web-app-test.ciao-web.workers.dev/";
const ADMIN_URL="https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-admin-web-v20";
const APP_URL="https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=20260908-0525";
```

Also confirm the webhook authentication check remains present:

```ts
if(req.headers.get("x-telegram-bot-api-secret-token")!==WEBHOOK_SECRET){
```

- [ ] **Step 4: Commit the deployed-source snapshot**

```bash
git add supabase/functions/ciao-pronostici-router/index.ts
git commit -m "chore: track deployed Telegram router source"
```

---

### Task 3: Add safe router-side release synchronization

**Files:**
- Create: `supabase/functions/ciao-pronostici-router/release-revision.mjs`
- Create: `supabase/functions/ciao-pronostici-router/release-sync.mjs`
- Modify: `supabase/functions/ciao-pronostici-router/index.ts`
- Create: `cloudflare-production/test/router-release-revision.test.mjs`

**Interfaces:**
- Produces: `isReleaseRevision(value): boolean`
- Produces: `contentRevision(input, cryptoImpl?): Promise<string>`
- Produces: `telegramAppUrl(revision): string`
- Produces: `synchronizeRelease({ requestedRevision, fetchWorkerHtml, setMenuButton, cryptoImpl }): Promise<{status:number, body:object}>`
- Adds GET endpoint: `/functions/v1/ciao-pronostici-router/release-sync?revision=<12hex>`.

- [ ] **Step 1: Write failing router-helper tests**

Create `cloudflare-production/test/router-release-revision.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  isReleaseRevision,
  contentRevision,
  telegramAppUrl,
} from '../../supabase/functions/ciao-pronostici-router/release-revision.mjs';
import { synchronizeRelease } from '../../supabase/functions/ciao-pronostici-router/release-sync.mjs';

test('router revision helper hashes content and builds only the fixed launcher URL', async () => {
  const revision = await contentRevision('hello', webcrypto);
  assert.equal(revision, '2cf24dba5fb0');
  assert.equal(isReleaseRevision(revision), true);
  assert.equal(
    telegramAppUrl(revision),
    'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=2cf24dba5fb0',
  );
  assert.throws(() => telegramAppUrl('https://evil.example/'), /invalid release revision/);
});

test('release sync refuses a live hash mismatch without touching Telegram', async () => {
  let menuCalls = 0;
  const result = await synchronizeRelease({
    requestedRevision: '2cf24dba5fb0',
    fetchWorkerHtml: async () => 'different',
    setMenuButton: async () => { menuCalls += 1; return { ok: true }; },
    cryptoImpl: webcrypto,
  });
  assert.equal(result.status, 409);
  assert.equal(menuCalls, 0);
});

test('release sync updates Telegram only when the fixed Worker bytes match', async () => {
  let receivedUrl = '';
  const result = await synchronizeRelease({
    requestedRevision: '2cf24dba5fb0',
    fetchWorkerHtml: async () => 'hello',
    setMenuButton: async (url) => { receivedUrl = url; return { ok: true, result: true }; },
    cryptoImpl: webcrypto,
  });
  assert.equal(result.status, 200);
  assert.equal(receivedUrl, 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=2cf24dba5fb0');
  assert.equal(result.body.live_revision, '2cf24dba5fb0');
});
```

- [ ] **Step 2: Run the router tests and verify RED**

From `cloudflare-production`:

```bash
node --test test/router-release-revision.test.mjs
```

Expected: FAIL because both router helper modules are absent.

- [ ] **Step 3: Implement the pure router revision helper**

Create `supabase/functions/ciao-pronostici-router/release-revision.mjs`:

```js
export const WORKER_URL = 'https://ciao-web-app.ciao-web.workers.dev/';
export const LAUNCHER_BASE_URL = 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app';

const REVISION_RE = /^[0-9a-f]{12}$/;

export function isReleaseRevision(value) {
  return REVISION_RE.test(String(value ?? ''));
}

export async function contentRevision(input, cryptoImpl = globalThis.crypto) {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : input instanceof Uint8Array
      ? input
      : new Uint8Array(input);
  const digest = new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', bytes));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

export function telegramAppUrl(revision) {
  if (!isReleaseRevision(revision)) throw new Error('invalid release revision');
  return `${LAUNCHER_BASE_URL}?tg_rev=${revision}`;
}
```

- [ ] **Step 4: Implement the testable release-sync core**

Create `supabase/functions/ciao-pronostici-router/release-sync.mjs`:

```js
import { contentRevision, isReleaseRevision, telegramAppUrl } from './release-revision.mjs';

export async function synchronizeRelease({
  requestedRevision,
  fetchWorkerHtml,
  setMenuButton,
  cryptoImpl = globalThis.crypto,
}) {
  if (!isReleaseRevision(requestedRevision)) {
    return { status: 400, body: { ok: false, error: 'invalid_revision' } };
  }

  const html = await fetchWorkerHtml();
  const liveRevision = await contentRevision(html, cryptoImpl);
  if (liveRevision !== requestedRevision) {
    return {
      status: 409,
      body: {
        ok: false,
        error: 'live_revision_mismatch',
        requested_revision: requestedRevision,
        live_revision: liveRevision,
      },
    };
  }

  const url = telegramAppUrl(requestedRevision);
  const telegram = await setMenuButton(url);
  if (!telegram?.ok) {
    return {
      status: 502,
      body: {
        ok: false,
        error: 'telegram_menu_update_failed',
        requested_revision: requestedRevision,
        live_revision: liveRevision,
        telegram_error: telegram?.description ?? null,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      requested_revision: requestedRevision,
      live_revision: liveRevision,
      web_app_url: url,
    },
  };
}
```

- [ ] **Step 5: Run router helper tests and verify GREEN**

```bash
node --test test/router-release-revision.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Wire the fixed Worker hashing into the router**

In `supabase/functions/ciao-pronostici-router/index.ts`, add imports:

```ts
import { WORKER_URL, contentRevision, telegramAppUrl } from './release-revision.mjs';
import { synchronizeRelease } from './release-sync.mjs';
```

Replace the manually versioned `APP_URL` constant with:

```ts
const APP_BASE_URL="https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app";
const INITIAL_RELEASE_REVISION="e833e3ab9551";
```

Add a small live-revision resolver with a 30-second in-memory cache:

```ts
let liveRevisionCache={revision:INITIAL_RELEASE_REVISION,at:0};

async function fetchWorkerHtml(){
  const url=new URL(WORKER_URL);
  url.searchParams.set("release_probe",String(Date.now()));
  const response=await fetch(url,{headers:{"cache-control":"no-cache"}});
  if(!response.ok)throw new Error(`worker_http_${response.status}`);
  return await response.text();
}

async function currentLiveRevision(force=false){
  if(!force&&liveRevisionCache.revision&&Date.now()-liveRevisionCache.at<30000){
    return liveRevisionCache.revision;
  }
  const html=await fetchWorkerHtml();
  const revision=await contentRevision(html);
  liveRevisionCache={revision,at:Date.now()};
  return revision;
}

async function currentTelegramAppUrl(){
  try{return telegramAppUrl(await currentLiveRevision(false));}
  catch{return telegramAppUrl(liveRevisionCache.revision||INITIAL_RELEASE_REVISION);}
}
```

Change inline keyboard creation from a static URL to an explicit URL argument:

```ts
const miniKb=(appUrl,admin=false)=>({
  inline_keyboard:[
    [{text:"⚽ Открыть Ciao, Web!",web_app:{url:appUrl}}],
    ...(admin?[[{text:"🧪 Ciao TEST",web_app:{url:APP_TEST_URL}}]]:[]),
  ],
});
```

Update `appOnly`:

```ts
async function appOnly(chat,telegramId){
  const appUrl=await currentTelegramAppUrl();
  const admin=await isAdmin(telegramId);
  return send(chat,"🇮🇹 <b>Ciao, Web!</b>\n\nЛига Прогнозов, матчи, live-статистика, таблица лучших прогнозистов.\nВсё о мире кальчо!",miniKb(appUrl,admin));
}
```

Keep webhook authentication unchanged.

- [ ] **Step 7: Add the narrow GET `/release-sync` route**

Before the existing generic GET response in `Deno.serve`, add:

```ts
if(req.method==="GET"&&url.pathname.endsWith("/release-sync")){
  const requestedRevision=String(url.searchParams.get("revision")??"");
  const result=await synchronizeRelease({
    requestedRevision,
    fetchWorkerHtml:()=>fetchWorkerHtml(),
    setMenuButton:(appUrl)=>tg("setChatMenuButton",{
      menu_button:{type:"web_app",text:"⚽ Ciao Web",web_app:{url:appUrl}},
    }),
  });
  if(result.status===200){
    liveRevisionCache={revision:requestedRevision,at:Date.now()};
  }
  return Response.json(result.body,{status:result.status});
}
```

Change `ensureMenu(force=false)` so that when it needs to write the menu it obtains `await currentTelegramAppUrl()` first and uses that exact URL.

- [ ] **Step 8: Add a source-level regression test for the router wiring**

Extend `cloudflare-production/test/router-release-revision.test.mjs`:

```js
import { readFileSync } from 'node:fs';

const routerSource = readFileSync(
  new URL('../../supabase/functions/ciao-pronostici-router/index.ts', import.meta.url),
  'utf8',
);

test('router exposes only revision-driven production synchronization', () => {
  assert.match(routerSource, /\/release-sync/);
  assert.match(routerSource, /WORKER_URL/);
  assert.match(routerSource, /currentLiveRevision/);
  assert.match(routerSource, /telegramAppUrl/);
  assert.doesNotMatch(routerSource, /release-sync[^\n]*url=/);
  assert.match(routerSource, /x-telegram-bot-api-secret-token/);
});
```

- [ ] **Step 9: Run the full test suite**

```bash
npm test
npm run build
```

Expected: PASS and build exits 0.

- [ ] **Step 10: Commit Task 3**

```bash
git add supabase/functions/ciao-pronostici-router/index.ts supabase/functions/ciao-pronostici-router/release-revision.mjs supabase/functions/ciao-pronostici-router/release-sync.mjs cloudflare-production/test/router-release-revision.test.mjs
git commit -m "feat: synchronize Telegram to verified live revision"
```

---

### Task 4: Implement the GitHub release gate as testable Node code

**Files:**
- Create: `cloudflare-production/scripts/release-gate.mjs`
- Create: `cloudflare-production/test/release-gate.test.mjs`
- Modify: `.github/workflows/ciao-production-check.yml`
- Create: `cloudflare-production/test/release-workflow.test.mjs`

**Interfaces:**
- `runReleaseGate(options?): Promise<{revision:string}>`
- Reads `dist/release-revision.txt`.
- Does not require GitHub secrets.

- [ ] **Step 1: Write failing release-gate behavior tests**

Create `cloudflare-production/test/release-gate.test.mjs` with fake `fetch` and `sleep` dependencies:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseRevision } from '../scripts/release-revision.mjs';
import { runReleaseGate } from '../scripts/release-gate.mjs';

function response(body, { status = 200, url = 'https://example.test/' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    async text(){ return typeof body === 'string' ? body : JSON.stringify(body); },
    async json(){ return typeof body === 'string' ? JSON.parse(body) : body; },
  };
}

test('release gate waits for matching Worker bytes before sync and Telegram propagation', async () => {
  const html = '<html>new</html>';
  const expected = releaseRevision(html);
  const calls = [];
  let workerChecks = 0;
  let menuChecks = 0;

  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).startsWith('https://ciao-web-app.ciao-web.workers.dev/')) {
      workerChecks += 1;
      return response(workerChecks === 1 ? '<html>old</html>' : html, { url: String(url) });
    }
    if (String(url).includes('/release-sync?revision=')) {
      return response({ ok: true, live_revision: expected, web_app_url: `https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=${expected}` });
    }
    if (String(url).includes('/ciao-telegram-entry-probe')) {
      menuChecks += 1;
      return response({ ok: true, menu_button: { web_app_url: menuChecks === 1 ? 'old' : `https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=${expected}` } });
    }
    if (String(url).startsWith('https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=')) {
      return response(html + ' Кальчо сегодня cw-home-profile-premium disabled aria-disabled="true" tabindex="-1"', {
        url: 'https://ciao-web-app.ciao-web.workers.dev/?v=1',
      });
    }
    throw new Error(`unexpected url ${url}`);
  };

  const result = await runReleaseGate({
    expectedRevision: expected,
    fetchImpl,
    sleep: async () => {},
    workerAttempts: 3,
    telegramAttempts: 3,
  });

  assert.equal(result.revision, expected);
  const syncAt = calls.findIndex(x => x.includes('/release-sync?revision='));
  const workerAt = calls.findIndex(x => x.startsWith('https://ciao-web-app.ciao-web.workers.dev/'));
  assert.ok(workerAt >= 0 && syncAt > workerAt);
  assert.equal(workerChecks, 2);
  assert.equal(menuChecks, 2);
});

test('release gate times out before Telegram sync when Worker bytes never match', async () => {
  const expected = releaseRevision('<html>new</html>');
  let syncCalls = 0;
  const fetchImpl = async (url) => {
    if (String(url).startsWith('https://ciao-web-app.ciao-web.workers.dev/')) return response('<html>old</html>');
    if (String(url).includes('/release-sync')) syncCalls += 1;
    throw new Error('unexpected fetch');
  };

  await assert.rejects(
    runReleaseGate({ expectedRevision: expected, fetchImpl, sleep: async () => {}, workerAttempts: 2 }),
    /Worker revision did not reach/,
  );
  assert.equal(syncCalls, 0);
});
```

- [ ] **Step 2: Run the release-gate tests and verify RED**

```bash
node --test test/release-gate.test.mjs
```

Expected: FAIL because `release-gate.mjs` does not exist.

- [ ] **Step 3: Implement `release-gate.mjs`**

Create `cloudflare-production/scripts/release-gate.mjs` with these fixed constants:

```js
import { readFile } from 'node:fs/promises';
import { releaseRevision, isReleaseRevision } from './release-revision.mjs';

export const WORKER_URL = 'https://ciao-web-app.ciao-web.workers.dev/';
export const ROUTER_SYNC_URL = 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-pronostici-router/release-sync';
export const TELEGRAM_PROBE_URL = 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-telegram-entry-probe';
export const LAUNCHER_BASE_URL = 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app';
export const REQUIRED_MARKERS = [
  'try{__cwHomePolishDom();__cwHomeBindPolish()}catch(_e){}',
  'Кальчо сегодня',
  'cw-home-profile-premium',
  'disabled aria-disabled="true" tabindex="-1"',
];
```

Implement the gate in this order:

```js
const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchText(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return { response, text: await response.text() };
}

export async function runReleaseGate({
  expectedRevision,
  fetchImpl = fetch,
  sleep = defaultSleep,
  workerAttempts = 30,
  telegramAttempts = 24,
} = {}) {
  const revision = String(expectedRevision ?? (await readFile(new URL('../dist/release-revision.txt', import.meta.url), 'utf8'))).trim();
  if (!isReleaseRevision(revision)) throw new Error(`invalid expected revision: ${revision}`);

  let workerMatched = false;
  for (let attempt = 1; attempt <= workerAttempts; attempt += 1) {
    const url = `${WORKER_URL}?release_probe=${revision}-${Date.now()}`;
    const { text } = await fetchText(fetchImpl, url);
    if (releaseRevision(text) === revision) { workerMatched = true; break; }
    if (attempt < workerAttempts) await sleep(10_000);
  }
  if (!workerMatched) throw new Error(`Worker revision did not reach ${revision}`);

  const sync = await fetchImpl(`${ROUTER_SYNC_URL}?revision=${revision}`, { headers: { 'cache-control': 'no-cache' } });
  const syncBody = await sync.json();
  if (!sync.ok || syncBody?.ok !== true || syncBody?.live_revision !== revision) {
    throw new Error(`Telegram release sync failed for ${revision}`);
  }

  const expectedMenuUrl = `${LAUNCHER_BASE_URL}?tg_rev=${revision}`;
  let menuMatched = false;
  for (let attempt = 1; attempt <= telegramAttempts; attempt += 1) {
    const probe = await fetchImpl(TELEGRAM_PROBE_URL, { headers: { 'cache-control': 'no-cache' } });
    if (!probe.ok) throw new Error(`Telegram probe HTTP ${probe.status}`);
    const body = await probe.json();
    if (body?.menu_button?.web_app_url === expectedMenuUrl) { menuMatched = true; break; }
    if (attempt < telegramAttempts) await sleep(5_000);
  }
  if (!menuMatched) throw new Error(`Telegram menu did not reach ${expectedMenuUrl}`);

  const finalResponse = await fetchImpl(expectedMenuUrl, { redirect: 'follow', headers: { 'cache-control': 'no-cache' } });
  if (!finalResponse.ok) throw new Error(`Telegram launcher HTTP ${finalResponse.status}`);
  if (!String(finalResponse.url).startsWith(WORKER_URL)) throw new Error(`Telegram launcher ended at unexpected URL: ${finalResponse.url}`);
  const finalHtml = await finalResponse.text();
  if (releaseRevision(finalHtml) !== revision) throw new Error('Telegram final HTML revision mismatch');
  for (const marker of REQUIRED_MARKERS) {
    if (!finalHtml.includes(marker)) throw new Error(`Telegram final HTML missing marker: ${marker}`);
  }
  return { revision };
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  runReleaseGate().then(result => console.log(JSON.stringify({ ok: true, ...result }))).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
```

When implementing the CLI guard, use the repository's existing `fileURLToPath/resolve` pattern if the literal `file://` comparison behaves differently on Windows runners.

- [ ] **Step 4: Run release-gate tests and verify GREEN**

```bash
node --test test/release-gate.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add a failing workflow-order regression test**

Create `cloudflare-production/test/release-workflow.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../../.github/workflows/ciao-production-check.yml', import.meta.url), 'utf8');

test('production workflow runs release gate only for pushes to main after build', () => {
  const buildAt = workflow.indexOf('name: Build');
  const releaseAt = workflow.indexOf('name: Synchronize Telegram release');
  assert.ok(buildAt >= 0);
  assert.ok(releaseAt > buildAt);
  assert.match(workflow, /if:\s*github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /node scripts\/release-gate\.mjs/);
});
```

- [ ] **Step 6: Run the workflow test and verify RED**

```bash
node --test test/release-workflow.test.mjs
```

Expected: FAIL because the synchronization step is absent.

- [ ] **Step 7: Add the push-only release gate to the existing production workflow**

Append after `Build` in `.github/workflows/ciao-production-check.yml`:

```yaml
      - name: Synchronize Telegram release
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: node scripts/release-gate.mjs
```

Do not add Telegram secrets. Keep PR behavior unchanged.

- [ ] **Step 8: Run all tests and build**

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

```bash
git add cloudflare-production/scripts/release-gate.mjs cloudflare-production/test/release-gate.test.mjs cloudflare-production/test/release-workflow.test.mjs .github/workflows/ciao-production-check.yml
git commit -m "ci: gate Telegram release on live Cloudflare revision"
```

---

### Task 5: Review, deploy the router safely, then merge the release pipeline

**Files:**
- Review all files changed by Tasks 1-4.
- No additional product/UI files should change.

**Interfaces:**
- Live Supabase router must support `/release-sync` before the GitHub workflow that calls it lands on `main`.

- [ ] **Step 1: Run fresh branch verification**

From `cloudflare-production`:

```bash
npm test
npm run build
REVISION="$(tr -d '\n' < dist/release-revision.txt)"
printf 'revision=%s\n' "$REVISION"
test "${#REVISION}" -eq 12
```

Expected: all tests PASS, build exits 0, revision is 12 lowercase hex characters.

- [ ] **Step 2: Review the branch diff against `main`**

The only expected areas are:

```text
.github/workflows/ciao-production-check.yml
cloudflare-production/scripts/build.mjs
cloudflare-production/scripts/release-revision.mjs
cloudflare-production/scripts/release-gate.mjs
cloudflare-production/test/*release*.test.mjs
cloudflare-production/test/build.test.mjs
supabase/functions/ciao-pronostici-router/index.ts
supabase/functions/ciao-pronostici-router/release-revision.mjs
supabase/functions/ciao-pronostici-router/release-sync.mjs
docs/superpowers/specs/2026-09-08-telegram-release-revision-design.md
docs/superpowers/plans/2026-09-08-telegram-release-revision-automation.md
```

Reject any unrelated Mini App UI/runtime changes.

- [ ] **Step 3: Deploy the source-controlled router before merging the workflow**

Deploy `supabase/functions/ciao-pronostici-router/index.ts` plus its two local `.mjs` modules to Supabase project `dkefzepiiudehhzbbrjn`, function `ciao-pronostici-router`, with `verify_jwt=false`.

Do not deploy any other Edge Function in this step.

- [ ] **Step 4: Verify router backward compatibility**

Freshly request:

```text
https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-pronostici-router
```

Expected JSON: `ok:true`, correct production launcher base, permanent test URL still `https://ciao-web-app-test.ciao-web.workers.dev/`, admin URL unchanged.

Also verify the webhook URL remains:

```text
https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-pronostici-router
```

- [ ] **Step 5: Exercise release-sync against the current live Worker revision**

Read the current live Worker root bytes, compute the same first-12 SHA-256 revision, then call:

```text
https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-pronostici-router/release-sync?revision=<CURRENT_LIVE_REVISION>
```

Expected: HTTP 200, `ok:true`, `requested_revision == live_revision`, `web_app_url` ends in `?tg_rev=<CURRENT_LIVE_REVISION>`.

Then poll `ciao-telegram-entry-probe` until it reports that exact menu URL. Allow up to 2 minutes.

- [ ] **Step 6: Open/review the PR and merge to `main` only after branch checks are green**

Use one PR from `feat/telegram-release-revision` to `main`. The PR description must state the release order:

```text
build -> wait for Cloudflare hash -> router release-sync -> Telegram propagation -> final HTML verification
```

- [ ] **Step 7: Verify the post-merge GitHub production workflow**

The `Ciao production check` run for the merged SHA must show:

```text
Install: success
Test: success
Build: success
Synchronize Telegram release: success
```

Do not treat Cloudflare's independent build success alone as sufficient.

- [ ] **Step 8: Verify the live Worker revision matches the merged build revision**

Obtain the expected revision from the merged workflow build and independently fetch the Worker root with a unique query. Compute SHA-256 first 12 characters and assert equality.

- [ ] **Step 9: Verify Telegram reports the same revision**

The Telegram menu URL must be exactly:

```text
https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=<EXPECTED_REVISION>
```

No timestamp-style revision is acceptable after this rollout.

- [ ] **Step 10: Verify the revised Telegram URL end to end**

Follow the exact revised menu URL with redirects enabled. Confirm:

```text
final host = ciao-web-app.ciao-web.workers.dev
final HTML revision = <EXPECTED_REVISION>
```

And confirm the current production markers are present:

```text
Кальчо сегодня
cw-home-profile-premium
disabled aria-disabled="true" tabindex="-1"
try{__cwHomePolishDom();__cwHomeBindPolish()}catch(_e){}
```

- [ ] **Step 11: Confirm rollback behavior with a dry reasoning check, not a production rollback**

Verify from code/tests that if Cloudflare later serves a prior stable `dist/index.html`, its prior content hash becomes the expected revision and the same release gate can synchronize Telegram back to that hash. Do not intentionally roll production back for this check.

- [ ] **Step 12: Final verification commit only if documentation needed**

If no code changes were required during production verification, do not create a noise commit. If documentation was corrected, commit only those corrections with:

```bash
git commit -m "docs: finalize Telegram release revision rollout"
```

---

## Plan self-review

- Spec coverage: deterministic build hash, live Worker wait, narrow router sync, dynamic `/start` revision, Telegram propagation polling, final end-to-end verification, rollback compatibility, and source-controlled router are all represented.
- Placeholder scan: no implementation step contains TBD/TODO placeholders.
- Type/interface consistency: both Node and Deno helpers produce the same 12-character SHA-256 prefix; the workflow passes only that revision value; router derives the destination URL itself.
- Safety: the router must be deployed before the workflow that invokes `/release-sync` reaches `main`.
- Non-goals preserved: no UI changes, no prediction/match/rating changes, no replacement of Cloudflare Git deployment, no Telegram token in GitHub.
