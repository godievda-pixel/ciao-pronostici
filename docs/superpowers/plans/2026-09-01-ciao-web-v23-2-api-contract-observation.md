# Ciao, Web! v23.2 API Contract Observation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Observe the real v23.1 API routes and safe GET response shapes from CI so the next v23.2 source-adapter plan is written against facts rather than guessed provider contracts.

**Architecture:** GitHub Actions already has outbound network access and the TEST Worker already proxies `/api/*` to the bound `ciao-web-api`. Add a pure source scanner that discovers literal `/api/...` calls in the fetched v23.1 production base, then a CI-only observer that probes only safe concrete GET routes through `ciao-web-app-test` and stores schema-only results as an uploaded artifact. No screen consumes the observation and no production Worker is changed.

**Tech Stack:** Node.js 22, native `fetch`, `node:test`, GitHub Actions, `actions/upload-artifact@v4`.

**Spec:** `docs/superpowers/specs/2026-09-01-ciao-web-v23-2-multitournament-design.md`

## Global Constraints

- TEST first: `develop` → `ciao-web-app-test`; Production remains unchanged until explicit acceptance.
- v23.1 remains the visible UI during this milestone.
- The v23.2 frontend-facing match contract remains the canonical shape already implemented under `cloudflare-test/src/v23.2/`.
- Do not guess route names or provider fields in production code.
- Observation may perform only HTTP `GET` requests with no authentication, request body, mutation parameters, Telegram init data, user ID, prediction data, or other personal state.
- The uploaded observation contains schema metadata only: HTTP status, content type, top-level JSON kind/keys, array item keys and nested key names. It must not persist response values, cookies, headers, tokens or user data.
- Existing v23.1 Home favorite-card and `Кальчо сегодня` behavior must not regress.
- Existing `Ciao TEST check` Test and Build steps remain required and must stay green.

---

### Task 1: Pure API Route Discovery

**Files:**
- Create: `cloudflare-test/src/v23.2/api-contract-observer.mjs`
- Create: `cloudflare-test/test/v23-2-api-contract-observer.test.mjs`

**Interfaces:**
- Produces: `discoverApiCalls(source)` returning sorted unique objects `{ route, method, concrete, snippet }`.
- Produces: `summarizeJsonShape(value)` returning schema-only metadata with no response values.
- Later tasks consume both functions from the CLI observer.

- [ ] **Step 1: Write failing tests**

Create `cloudflare-test/test/v23-2-api-contract-observer.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  discoverApiCalls,
  summarizeJsonShape,
} from '../src/v23.2/api-contract-observer.mjs';

test('discovers unique literal API calls and marks dynamic routes as non-concrete', () => {
  const source = `
    fetch('/api/schedule');
    fetch('/api/schedule');
    fetch('/api/matches?round=3', { method: 'GET' });
    fetch(\`/api/match/\${id}\`);
    fetch('/api/predictions', { method: 'POST', body: '{}' });
  `;
  assert.deepEqual(discoverApiCalls(source), [
    { route: '/api/match/${id}', method: 'GET', concrete: false, snippet: "fetch(`/api/match/${id}`)" },
    { route: '/api/matches?round=3', method: 'GET', concrete: true, snippet: "fetch('/api/matches?round=3', { method: 'GET' })" },
    { route: '/api/predictions', method: 'POST', concrete: true, snippet: "fetch('/api/predictions', { method: 'POST', body: '{}' })" },
    { route: '/api/schedule', method: 'GET', concrete: true, snippet: "fetch('/api/schedule')" },
  ]);
});

test('summarizes JSON shape without retaining values', () => {
  const value = {
    ok: true,
    matches: [{ id: 1, home: { id: 10, name: 'Inter' }, away: { id: 20 } }],
    meta: { round: 3, season: '2026/27' },
  };
  assert.deepEqual(summarizeJsonShape(value), {
    kind: 'object',
    keys: ['matches', 'meta', 'ok'],
    objectKeys: {
      matches: { kind: 'array', itemKeys: ['away', 'home', 'id'], nestedKeys: { away: ['id'], home: ['id', 'name'] } },
      meta: { kind: 'object', keys: ['round', 'season'] },
      ok: { kind: 'boolean' },
    },
  });
  assert.equal(JSON.stringify(summarizeJsonShape(value)).includes('Inter'), false);
  assert.equal(JSON.stringify(summarizeJsonShape(value)).includes('2026/27'), false);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
cd cloudflare-test
node --test test/v23-2-api-contract-observer.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because `api-contract-observer.mjs` does not exist.

- [ ] **Step 3: Implement the pure observer helpers**

Create `cloudflare-test/src/v23.2/api-contract-observer.mjs`:

```js
function normalizeSnippet(value) {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, 240);
}

function inferMethod(callText) {
  const match = String(callText).match(/method\s*:\s*['\"]([A-Za-z]+)['\"]/i);
  return String(match?.[1] || 'GET').toUpperCase();
}

export function discoverApiCalls(source) {
  const text = String(source);
  const calls = [];
  const pattern = /fetch\s*\(\s*([`'\"])(\/api\/[\s\S]*?)\1([\s\S]{0,220}?)\)/g;
  let match;
  while ((match = pattern.exec(text))) {
    const route = String(match[2]).trim();
    const callText = match[0];
    calls.push({
      route,
      method: inferMethod(callText),
      concrete: !/[${}]/.test(route),
      snippet: normalizeSnippet(callText),
    });
  }
  const unique = new Map();
  for (const call of calls) {
    const key = `${call.method} ${call.route}`;
    if (!unique.has(key)) unique.set(key, call);
  }
  return [...unique.values()].sort((a, b) =>
    a.route.localeCompare(b.route) || a.method.localeCompare(b.method)
  );
}

function primitiveKind(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function nestedKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.keys(value).sort();
}

export function summarizeJsonShape(value) {
  const kind = primitiveKind(value);
  if (kind === 'array') {
    const first = value.find(item => item && typeof item === 'object' && !Array.isArray(item));
    if (!first) return { kind: 'array', itemKeys: [] };
    const itemKeys = Object.keys(first).sort();
    const nested = {};
    for (const key of itemKeys) {
      const keys = nestedKeys(first[key]);
      if (keys) nested[key] = keys;
    }
    return {
      kind: 'array',
      itemKeys,
      ...(Object.keys(nested).length ? { nestedKeys: nested } : {}),
    };
  }
  if (kind === 'object') {
    const keys = Object.keys(value).sort();
    const objectKeys = {};
    for (const key of keys) {
      const child = value[key];
      const childKind = primitiveKind(child);
      if (childKind === 'array') {
        const first = child.find(item => item && typeof item === 'object' && !Array.isArray(item));
        const itemKeys = first ? Object.keys(first).sort() : [];
        const nested = {};
        if (first) {
          for (const itemKey of itemKeys) {
            const keys2 = nestedKeys(first[itemKey]);
            if (keys2) nested[itemKey] = keys2;
          }
        }
        objectKeys[key] = {
          kind: 'array',
          itemKeys,
          ...(Object.keys(nested).length ? { nestedKeys: nested } : {}),
        };
      } else if (childKind === 'object') {
        objectKeys[key] = { kind: 'object', keys: Object.keys(child).sort() };
      } else {
        objectKeys[key] = { kind: childKind };
      }
    }
    return { kind: 'object', keys, objectKeys };
  }
  return { kind };
}
```

- [ ] **Step 4: Run GREEN**

Run:

```bash
node --test test/v23-2-api-contract-observer.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.2/api-contract-observer.mjs cloudflare-test/test/v23-2-api-contract-observer.test.mjs
git commit -m "feat: observe v23.2 api route contract"
```

---

### Task 2: CI Observer CLI With Safe GET Probing

**Files:**
- Create: `cloudflare-test/scripts/inspect-api-contract.mjs`
- Modify: `cloudflare-test/package.json`
- Modify: `cloudflare-test/test/v23-2-api-contract-observer.test.mjs`
- Create: `cloudflare-test/.gitignore`

**Interfaces:**
- Consumes: `discoverApiCalls(source)` and `summarizeJsonShape(value)`.
- Produces: `artifacts/api-contract-observed.json`.
- Exports: `safeCalls(calls)` and `observeContract({ baseUrl, testOrigin, fetchImpl })` for tests.

- [ ] **Step 1: Add failing safe-probe tests**

Append to `cloudflare-test/test/v23-2-api-contract-observer.test.mjs`:

```js
import {
  safeCalls,
  observeContract,
} from '../scripts/inspect-api-contract.mjs';

test('safeCalls allows only concrete anonymous GET API calls', () => {
  const calls = [
    { route: '/api/schedule', method: 'GET', concrete: true },
    { route: '/api/match/${id}', method: 'GET', concrete: false },
    { route: '/api/predictions', method: 'POST', concrete: true },
    { route: '/api/user?id=42', method: 'GET', concrete: true },
  ];
  assert.deepEqual(safeCalls(calls).map(x => x.route), ['/api/schedule']);
});

test('observeContract stores schema only for successful JSON GET responses', async () => {
  const requests = [];
  const fetchImpl = async url => {
    requests.push(String(url));
    if (String(url).includes('/releases/v23.1/')) {
      return new Response("<script>fetch('/api/schedule')</script>", {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }
    return Response.json({ matches: [{ id: 1, home: { name: 'Inter' } }] });
  };
  const result = await observeContract({
    baseUrl: 'https://prod.example/releases/v23.1/',
    testOrigin: 'https://test.example',
    fetchImpl,
  });
  assert.equal(requests.at(-1), 'https://test.example/api/schedule');
  assert.equal(result.probes[0].status, 200);
  assert.deepEqual(result.probes[0].shape.keys, ['matches']);
  assert.equal(JSON.stringify(result).includes('Inter'), false);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-2-api-contract-observer.test.mjs
```

Expected: FAIL because `inspect-api-contract.mjs` does not exist.

- [ ] **Step 3: Implement the CLI**

Create `cloudflare-test/scripts/inspect-api-contract.mjs`:

```js
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discoverApiCalls,
  summarizeJsonShape,
} from '../src/v23.2/api-contract-observer.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'artifacts/api-contract-observed.json');

const PERSONAL_ROUTE_PATTERN = /(?:user|profile|prediction|rank|auth|telegram|admin|me)(?:\/|\?|$)/i;

export function safeCalls(calls) {
  return calls.filter(call =>
    call.method === 'GET'
    && call.concrete
    && call.route.startsWith('/api/')
    && !PERSONAL_ROUTE_PATTERN.test(call.route)
    && !/[?&](?:user|user_id|telegram|tg|token|auth|prediction)=/i.test(call.route)
  );
}

function contentType(response) {
  return String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
}

export async function observeContract({ baseUrl, testOrigin, fetchImpl = fetch }) {
  const baseResponse = await fetchImpl(baseUrl, { headers: { 'cache-control': 'no-cache' } });
  if (!baseResponse.ok) throw new Error(`base fetch failed: HTTP ${baseResponse.status}`);
  const source = await baseResponse.text();
  const calls = discoverApiCalls(source);
  const safe = safeCalls(calls);
  const probes = [];

  for (const call of safe) {
    const url = new URL(call.route, testOrigin).toString();
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json', 'cache-control': 'no-cache' },
        redirect: 'manual',
      });
      const type = contentType(response);
      const probe = { route: call.route, status: response.status, contentType: type };
      if (response.ok && type.includes('json')) {
        probe.shape = summarizeJsonShape(await response.json());
      }
      probes.push(probe);
    } catch (error) {
      probes.push({ route: call.route, status: 0, contentType: '', error: error?.name || 'Error' });
    }
  }

  return {
    observedAt: new Date().toISOString(),
    baseUrl,
    testOrigin,
    calls,
    safeGetRoutes: safe.map(call => call.route),
    probes,
  };
}

export async function main() {
  const baseUrl = process.env.BASE_URL || 'https://ciao-web-app.ciao-web.workers.dev/releases/v23.1/';
  const testOrigin = process.env.TEST_ORIGIN || 'https://ciao-web-app-test.ciao-web.workers.dev';
  const result = await observeContract({ baseUrl, testOrigin });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    discovered: result.calls.length,
    safeGetRoutes: result.safeGetRoutes.length,
    probed: result.probes.length,
    output: outputPath,
  }));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
```

Create `cloudflare-test/.gitignore`:

```text
artifacts/
```

Add to `cloudflare-test/package.json` scripts:

```json
"inspect:api-contract": "node scripts/inspect-api-contract.mjs"
```

- [ ] **Step 4: Run GREEN and regression tests**

```bash
node --test test/v23-2-api-contract-observer.test.mjs test/v23-2-*.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/scripts/inspect-api-contract.mjs cloudflare-test/package.json cloudflare-test/.gitignore cloudflare-test/test/v23-2-api-contract-observer.test.mjs
git commit -m "ci: add safe api contract observer"
```

---

### Task 3: Upload the Observed Contract From GitHub Actions

**Files:**
- Modify: `.github/workflows/ciao-test-check.yml`
- Create: `cloudflare-test/test/v23-2-workflow.test.mjs`

**Interfaces:**
- Consumes: `npm run inspect:api-contract`.
- Produces GitHub Actions artifact named `ciao-v23-2-api-contract` containing `cloudflare-test/artifacts/api-contract-observed.json`.
- Does not change Cloudflare deployment or any visible screen.

- [ ] **Step 1: Write failing workflow contract test**

Create `cloudflare-test/test/v23-2-workflow.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Ciao TEST workflow observes and uploads the v23.2 API contract after build', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/ciao-test-check.yml', import.meta.url), 'utf8');
  assert.match(workflow, /name: Observe v23\.1 API contract/);
  assert.match(workflow, /run: npm run inspect:api-contract/);
  assert.match(workflow, /uses: actions\/upload-artifact@v4/);
  assert.match(workflow, /name: ciao-v23-2-api-contract/);
  assert.match(workflow, /cloudflare-test\/artifacts\/api-contract-observed\.json/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-2-workflow.test.mjs
```

Expected: FAIL because the workflow lacks observer/upload steps.

- [ ] **Step 3: Extend the workflow after `Build TEST artifact`**

Append these steps to `.github/workflows/ciao-test-check.yml`:

```yaml
      - name: Observe v23.1 API contract
        if: github.event_name == 'push'
        run: npm run inspect:api-contract

      - name: Upload v23.2 API contract observation
        if: github.event_name == 'push'
        uses: actions/upload-artifact@v4
        with:
          name: ciao-v23-2-api-contract
          path: cloudflare-test/artifacts/api-contract-observed.json
          if-no-files-found: error
          retention-days: 7
```

The upload step intentionally uses a repository-root path because `with.path` is resolved from the workspace, not `defaults.run.working-directory`.

- [ ] **Step 4: Run workflow test and full suite**

```bash
node --test test/v23-2-workflow.test.mjs
npm test
npm run build
```

Expected: all tests PASS and build exits 0.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ciao-test-check.yml cloudflare-test/test/v23-2-workflow.test.mjs
git commit -m "ci: upload observed v23.1 api contract"
```

---

### Task 4: Inspect the Real Artifact and Freeze the Observed Contract

**Files:**
- Create after CI observation: `docs/superpowers/specs/2026-09-01-ciao-web-v23-2-observed-api-contract.md`

**Interfaces:**
- Consumes the exact `ciao-v23-2-api-contract` artifact from the successful GitHub Actions run on `develop`.
- Produces a human-readable factual contract snapshot used as the authority for the next source-adapter implementation plan.

- [ ] **Step 1: Verify GitHub Actions**

Confirm the run for the workflow commit reports:

```text
Test — success
Build TEST artifact — success
Observe v23.1 API contract — success
Upload v23.2 API contract observation — success
```

- [ ] **Step 2: Download the artifact through the GitHub connector**

Use the run's artifact listing, locate artifact `ciao-v23-2-api-contract`, and download its ZIP. Read `api-contract-observed.json` from the artifact.

- [ ] **Step 3: Write the observed-contract spec using only artifact facts**

Create `docs/superpowers/specs/2026-09-01-ciao-web-v23-2-observed-api-contract.md` with exactly these sections:

```markdown
# Ciao, Web! v23.2 — Observed v23.1 API Contract

Date: 2026-09-01
Source: GitHub Actions artifact `ciao-v23-2-api-contract`
Scope: anonymous GET routes observed from the production v23.1 frontend and probed through TEST

## Discovered frontend API calls

| Method | Route | Concrete | Probe status |
| --- | --- | --- | --- |
| ...artifact rows only... |

## Observed JSON shapes

For every successfully probed JSON route, record only the route, HTTP status, top-level kind/keys, item keys and nested key names from the artifact. Do not copy response values.

## Unprobed routes

Record every dynamic, non-GET or personal-state route from the artifact and the reason it was intentionally not probed.

## Adapter implications

State only mappings that are directly supported by observed field names. Anything not observed remains explicitly absent from this document and is not guessed.
```

No route or field may be added to this document unless it appears in the artifact.

- [ ] **Step 4: Commit the factual contract snapshot**

```bash
git add docs/superpowers/specs/2026-09-01-ciao-web-v23-2-observed-api-contract.md
git commit -m "docs: record observed v23.1 api contract"
```

- [ ] **Step 5: Final regression gate**

Verify the final `Ciao TEST check` on `develop` remains green. Do not claim any visible Telegram TEST change; this milestone is observation-only.

---

## Completion Gate

This plan is complete only when the GitHub Actions artifact has been downloaded and the observed-contract spec has been committed from that artifact. The next implementation plan may then connect real schedule data to the v23.2 canonical model using only routes and fields proven by this observation.
