# Ciao, Web! v23.3 Durable Object Prediction Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unresolved legacy prediction persistence with a TEST-only, SQLite-backed `PredictionLeague` Durable Object inside `ciao-web-app-test`, then wire authenticated prediction reads/writes, scoring, rankings, safe TEST reset, and the v23.3 prediction UI to that server-side backend without changing Production.

**Architecture:** `ciao-web-app-test` remains the public boundary. It resolves Telegram identity through the existing `ciao-web-api`, resolves canonical match/season/deadline data through the existing Serie A and BSD adapters, and invokes one season-scoped `PredictionLeague` Durable Object (`prediction-league:test:2026-27`). The Durable Object owns prediction rows, participant snapshots, scoring state, ranking snapshots, and reset/cache metadata; the browser never talks to the object directly and never falls back to `localStorage`, IndexedDB, Supabase, or legacy `save_predictions` persistence.

**Tech Stack:** JavaScript ES modules, Node.js 22 built-in test runner, Cloudflare Workers, Cloudflare Durable Objects with SQLite storage, Wrangler 4.127.1, existing `ciao-web-api` service binding, existing BSD v2 provider adapter, existing v23.3 build/probe pipeline.

**Spec:** `docs/superpowers/specs/2026-09-02-ciao-web-v23-3-prediction-durable-object-design.md`

## Global Constraints

- Work only from the approved TEST lineage; `ciao-web-app` Production remains unchanged until explicit acceptance.
- Active TEST prediction season is exactly `PREDICTION_SEASON=2026-27`.
- Durable Object class is exactly `PredictionLeague`; binding is exactly `PREDICTION_LEAGUE`.
- TEST object name is exactly `prediction-league:test:2026-27`.
- Supported competitions are exactly `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`.
- Prediction scores are integer values from `0` through `20`.
- Prediction locking is server-authoritative at `kickoffAt - 15 minutes`; `now < deadline` is open, `now >= deadline` is closed.
- Browser-supplied `user_id`, season, kickoff, deadline, match status, display name, and competition metadata are never trusted.
- `ciao-web-api` remains the authentication authority but is not the new prediction database.
- Prediction persistence must not use Supabase, browser `localStorage`, IndexedDB, or legacy `save_predictions` as a fallback.
- Scoring formula must remain behavior-identical to the current Serie A scoring implementation; do not invent a new formula.
- Overall ranking gives all five competitions equal weight.
- Production reset remains impossible in this plan. The only executable reset is the guarded TEST prediction reset.
- Existing Home, Matches, Tables, Match Center, profile, localization, and current v23.3 regression tests must stay green.

---

## File Structure Locked by This Plan

### New server modules

- `cloudflare-test/src/v23.3/prediction-sql.mjs` — schema SQL, row normalization, SQL repository helpers, ranking queries, reset transaction helpers.
- `cloudflare-test/src/v23.3/prediction-league-do.mjs` — `PredictionLeague` Durable Object class and private internal HTTP protocol.
- `cloudflare-test/src/v23.3/prediction-auth.mjs` — fail-closed Telegram-authenticated identity resolver over `CIAO_WEB_API`.
- `cloudflare-test/src/v23.3/prediction-match-resolver.mjs` — canonical match loading, season normalization, deadline/status checks.
- `cloudflare-test/src/v23.3/prediction-scorer.mjs` — exact extracted legacy scorer plus result fingerprint helper.
- `cloudflare-test/src/v23.3/prediction-service.mjs` — public-route orchestration; the only Worker-side module that coordinates auth + match resolver + Durable Object.
- `cloudflare-test/src/v23.3/prediction-client.mjs` — browser fetch client for v23.3 prediction/ranking routes.
- `cloudflare-test/src/v23.3/predictions-ui.mjs` — prediction screen integration using only the new server client.

### Existing modules/config to modify

- `cloudflare-test/src/worker.js` — export `PredictionLeague`; add prediction/ranking/reset routes before the generic `/api/*` proxy.
- `cloudflare-test/src/v23.3/index.mjs` — enable/import predictions UI only after backend contract tests are green.
- `cloudflare-test/wrangler.jsonc` — add TEST Durable Object binding/migration and `CIAO_ENV` / `PREDICTION_SEASON` vars.
- `cloudflare-test/scripts/build.mjs` — ensure new browser modules are copied and unified v23.3 entry remains single-injected.
- `cloudflare-test/scripts/probe-prediction-contract.mjs` — accept authenticated smoke evidence and produce a PASS only after the real backend smoke.
- `cloudflare-test/scripts/probe-reset-contract.mjs` — consume guarded TEST-reset verification without enabling Production reset.
- `cloudflare-test/scripts/probe-test-deployment.mjs` — verify deployed TEST backend/build markers and prediction route behavior.
- `.github/workflows/ciao-test-check.yml` — run deterministic tests/build/probes and upload the new evidence artifact; never execute destructive reset in CI.
- `cloudflare-test/README.md` — document TEST-only backend, required secrets, smoke command, and Production prohibition.

### New/expanded tests

- `cloudflare-test/test/v23-3-prediction-sql.test.mjs`
- `cloudflare-test/test/v23-3-prediction-do.test.mjs`
- `cloudflare-test/test/v23-3-prediction-auth.test.mjs`
- `cloudflare-test/test/v23-3-prediction-match-resolver.test.mjs`
- `cloudflare-test/test/v23-3-prediction-scorer.test.mjs`
- `cloudflare-test/test/v23-3-prediction-service.test.mjs`
- `cloudflare-test/test/v23-3-prediction-worker.test.mjs`
- `cloudflare-test/test/v23-3-prediction-client.test.mjs`
- `cloudflare-test/test/v23-3-predictions-ui.test.mjs`
- expand `cloudflare-test/test/v23-3-build.test.mjs`
- expand `cloudflare-test/test/v23-3-prediction-probe.test.mjs`
- expand `cloudflare-test/test/v23-3-reset-probe.test.mjs`
- expand `cloudflare-test/test/v23-3-deployment-probe.test.mjs`

---

## Task 1: Configure the TEST Durable Object and SQLite repository contract

**Files:**
- Create: `cloudflare-test/src/v23.3/prediction-sql.mjs`
- Create: `cloudflare-test/test/v23-3-prediction-sql.test.mjs`
- Modify: `cloudflare-test/wrangler.jsonc`
- Modify: `cloudflare-test/test/v23-3-build.test.mjs`

**Interfaces:**
- Consumes: active environment `test` and active season `2026-27`.
- Produces: `PREDICTION_SCHEMA_VERSION`, `PREDICTION_SCHEMA_SQL`, `initializePredictionSchema(sql,{environment,season})`, `predictionObjectName({environment,season})`, `normalizePredictionRow(row)`, `rankingScope({scope,competition})`.
- Wrangler produces binding `env.PREDICTION_LEAGUE`, var `env.CIAO_ENV === 'test'`, var `env.PREDICTION_SEASON === '2026-27'`.

- [ ] **Step 1: Write the failing SQL/config contract tests**

Create `test/v23-3-prediction-sql.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREDICTION_SCHEMA_VERSION,
  PREDICTION_SCHEMA_SQL,
  predictionObjectName,
  rankingScope,
} from '../src/v23.3/prediction-sql.mjs';

test('prediction object identity is environment and season scoped', () => {
  assert.equal(
    predictionObjectName({ environment: 'test', season: '2026-27' }),
    'prediction-league:test:2026-27',
  );
  assert.throws(
    () => predictionObjectName({ environment: 'production', season: '2026-27' }),
    /TEST prediction backend/i,
  );
});

test('SQLite schema contains the four approved tables and uniqueness rules', () => {
  assert.equal(PREDICTION_SCHEMA_VERSION, '1');
  assert.match(PREDICTION_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS schema_meta/i);
  assert.match(PREDICTION_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS participants/i);
  assert.match(PREDICTION_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS predictions/i);
  assert.match(PREDICTION_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS ranking_snapshots/i);
  assert.match(PREDICTION_SCHEMA_SQL, /UNIQUE\s*\(\s*user_id\s*,\s*match_id\s*\)/i);
  assert.match(PREDICTION_SCHEMA_SQL, /predicted_home[^;]*CHECK[^;]*BETWEEN 0 AND 20/is);
  assert.match(PREDICTION_SCHEMA_SQL, /predicted_away[^;]*CHECK[^;]*BETWEEN 0 AND 20/is);
});

test('ranking scope is finite and canonical', () => {
  assert.equal(rankingScope({ scope: 'overall' }), 'overall');
  assert.equal(
    rankingScope({ scope: 'competition', competition: 'ucl' }),
    'competition:ucl',
  );
  assert.throws(() => rankingScope({ scope: 'competition' }), /competition/i);
  assert.throws(() => rankingScope({ scope: 'other' }), /scope/i);
});
```

Expand `test/v23-3-build.test.mjs` with a source-config assertion:

```js
import { readFile } from 'node:fs/promises';

test('TEST wrangler binds the SQLite PredictionLeague without a Production binding', async () => {
  const source = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.match(source, /"PREDICTION_LEAGUE"/);
  assert.match(source, /"PredictionLeague"/);
  assert.match(source, /"new_sqlite_classes"\s*:\s*\[\s*"PredictionLeague"\s*\]/);
  assert.match(source, /"CIAO_ENV"\s*:\s*"test"/);
  assert.match(source, /"PREDICTION_SEASON"\s*:\s*"2026-27"/);
  assert.doesNotMatch(source, /ciao-web-app"/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
cd cloudflare-test
node --test test/v23-3-prediction-sql.test.mjs test/v23-3-build.test.mjs
```

Expected: `v23-3-prediction-sql.test.mjs` fails because `prediction-sql.mjs` does not exist; Wrangler assertions fail because no Durable Object binding exists.

- [ ] **Step 3: Implement the schema/constants and object-name guard**

`src/v23.3/prediction-sql.mjs` must define the approved columns exactly. Use this shape for the schema string:

```js
import { getCompetitionConfig } from '../v23.2/competition-config.mjs';

export const PREDICTION_SCHEMA_VERSION = '1';

export const PREDICTION_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS participants (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  username TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS predictions (
  prediction_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  competition TEXT NOT NULL CHECK (competition IN ('serie_a','coppa_italia','ucl','uel','uecl')),
  season TEXT NOT NULL,
  predicted_home INTEGER NOT NULL CHECK (predicted_home BETWEEN 0 AND 20),
  predicted_away INTEGER NOT NULL CHECK (predicted_away BETWEEN 0 AND 20),
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  locked_at TEXT NOT NULL,
  points INTEGER,
  result_type TEXT,
  final_home INTEGER,
  final_away INTEGER,
  result_fingerprint TEXT,
  scored_at TEXT,
  UNIQUE(user_id, match_id)
);
CREATE INDEX IF NOT EXISTS predictions_user_competition ON predictions(user_id, competition);
CREATE INDEX IF NOT EXISTS predictions_competition_match ON predictions(competition, match_id);
CREATE INDEX IF NOT EXISTS predictions_competition_points ON predictions(competition, points);
CREATE INDEX IF NOT EXISTS predictions_scored_at ON predictions(scored_at);
CREATE TABLE IF NOT EXISTS ranking_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  period_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE(scope, period_key)
);
`;

function text(value) { return String(value ?? '').trim(); }

export function predictionObjectName({ environment, season } = {}) {
  const env = text(environment).toLowerCase();
  const value = text(season);
  if (env !== 'test') throw new Error('TEST prediction backend only');
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error('Invalid prediction season');
  return `prediction-league:${env}:${value}`;
}

export function rankingScope({ scope, competition } = {}) {
  if (scope === 'overall') return 'overall';
  if (scope !== 'competition') throw new Error('Invalid ranking scope');
  getCompetitionConfig(competition);
  return `competition:${competition}`;
}
```

Add `initializePredictionSchema(sql,{environment,season})` using `sql.exec(PREDICTION_SCHEMA_SQL)` followed by idempotent `INSERT OR REPLACE` for `schema_version`, `environment`, `season`, and `INSERT OR IGNORE` for `prediction_cache_generation='0'`. It must reject any environment other than `test` before executing SQL.

- [ ] **Step 4: Add the TEST-only Wrangler Durable Object binding/migration**

Extend `wrangler.jsonc` without changing existing `ASSETS` or `CIAO_WEB_API` bindings:

```jsonc
"vars": {
  "CIAO_ENV": "test",
  "PREDICTION_SEASON": "2026-27"
},
"durable_objects": {
  "bindings": [
    {
      "name": "PREDICTION_LEAGUE",
      "class_name": "PredictionLeague"
    }
  ]
},
"migrations": [
  {
    "tag": "prediction-league-v1",
    "new_sqlite_classes": ["PredictionLeague"]
  }
]
```

Do not add any Production worker name or Production namespace.

- [ ] **Step 5: Run focused tests and config validation**

```bash
node --test test/v23-3-prediction-sql.test.mjs test/v23-3-build.test.mjs
npx wrangler deploy --dry-run
```

Expected: tests PASS; Wrangler dry-run recognizes `PREDICTION_LEAGUE` and the SQLite class migration without publishing.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-test/src/v23.3/prediction-sql.mjs cloudflare-test/test/v23-3-prediction-sql.test.mjs cloudflare-test/test/v23-3-build.test.mjs cloudflare-test/wrangler.jsonc
git commit -m "feat: configure TEST prediction durable object"
```

---

## Task 2: Implement `PredictionLeague` storage protocol and atomic persistence

**Files:**
- Create: `cloudflare-test/src/v23.3/prediction-league-do.mjs`
- Create: `cloudflare-test/test/v23-3-prediction-do.test.mjs`
- Modify: `cloudflare-test/src/v23.3/prediction-sql.mjs`
- Modify: `cloudflare-test/src/worker.js`

**Interfaces:**
- Consumes: `initializePredictionSchema`, active TEST environment/season, validated internal payloads only.
- Produces named export `PredictionLeague`.
- Private internal protocol paths: `POST /write`, `GET /user`, `POST /reconcile`, `GET /rankings`, `GET /rankings/me`, `POST /snapshot`, `POST /reset`.
- Public browser requests never target these paths directly.

- [ ] **Step 1: Write a fake SQLite harness and failing repository/DO tests**

Create a minimal `FakeSql` in the test file that records `exec()` calls and returns deterministic rows for query fixtures. The tests must assert behavior, not Cloudflare internals:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { PredictionLeague } from '../src/v23.3/prediction-league-do.mjs';

function stateWith(sql) {
  return {
    storage: { sql },
    blockConcurrencyWhile: fn => fn(),
  };
}

test('PredictionLeague initializes TEST season metadata exactly once', async () => {
  const calls = [];
  const sql = { exec(query, ...params) { calls.push({ query, params }); return { toArray: () => [] }; } };
  new PredictionLeague(stateWith(sql), { CIAO_ENV: 'test', PREDICTION_SEASON: '2026-27' });
  await Promise.resolve();
  assert.equal(calls.some(item => /schema_meta/i.test(item.query)), true);
  assert.equal(calls.some(item => item.params.includes?.('2026-27')), true);
});

test('internal write is an upsert keyed by user and match while preserving prediction_id', async () => {
  // FakeSql fixture returns no row on first write and an existing prediction_id on second write.
  // POST /write twice for telegram:42 + ucl:601024; assert response id is identical and score changes.
});

test('internal ranking ordering follows approved tie breakers', async () => {
  // Seed deterministic aggregate rows and assert order: points desc, exact desc,
  // correct outcome desc, scored count asc, user_id asc.
});

test('internal reset clears prediction domain and increments cache generation only', async () => {
  // Assert DELETE targets predictions/ranking_snapshots/participants and schema metadata is preserved.
});
```

For the second through fourth tests, implement the fake with explicit fixtures rather than leaving comments: provide `existingPredictionId`, ranking rows, and reset counts; assert exact JSON responses from `fetch()`.

- [ ] **Step 2: Run the DO test and verify RED**

```bash
node --test test/v23-3-prediction-do.test.mjs
```

Expected: FAIL because `prediction-league-do.mjs` does not exist.

- [ ] **Step 3: Add SQL repository helpers**

Add focused helpers in `prediction-sql.mjs`:

```js
export function rows(cursor) {
  if (!cursor) return [];
  if (typeof cursor.toArray === 'function') return cursor.toArray();
  return Array.from(cursor);
}

export function normalizePredictionRow(row = {}) {
  return Object.freeze({
    prediction_id: String(row.prediction_id),
    user_id: String(row.user_id),
    match_id: String(row.match_id),
    competition: String(row.competition),
    season: String(row.season),
    predicted_home: Number(row.predicted_home),
    predicted_away: Number(row.predicted_away),
    submitted_at: String(row.submitted_at),
    updated_at: String(row.updated_at),
    locked_at: String(row.locked_at),
    points: row.points == null ? null : Number(row.points),
    result_type: row.result_type == null ? null : String(row.result_type),
    final_home: row.final_home == null ? null : Number(row.final_home),
    final_away: row.final_away == null ? null : Number(row.final_away),
    result_fingerprint: row.result_fingerprint == null ? null : String(row.result_fingerprint),
    scored_at: row.scored_at == null ? null : String(row.scored_at),
  });
}
```

Add SQL functions with parameterized values only:

- `upsertParticipant(sql, participant, nowIso)`
- `upsertPrediction(sql, prediction, nowIso, randomUUID)`
- `listUserPredictions(sql,{userId,competition})`
- `reconcileMatchPredictions(sql,{matchId,finalHome,finalAway,resultFingerprint,scoredAt,scorePrediction})`
- `queryRanking(sql,{scope,competition})`
- `queryRankingMe(sql,{userId})`
- `createRankingSnapshot(sql,{scope,periodKey,payload,nowIso,randomUUID})`
- `resetPredictionDomain(sql)`

`upsertPrediction` must query `(user_id,match_id)` first, reuse its `prediction_id` on update, and generate `crypto.randomUUID()` only on insert. Update must clear previous scoring fields if the row is still editable and its prediction score changed.

- [ ] **Step 4: Implement the Durable Object class and private protocol**

Use this class boundary:

```js
import {
  initializePredictionSchema,
  upsertParticipant,
  upsertPrediction,
  listUserPredictions,
  reconcileMatchPredictions,
  queryRanking,
  queryRankingMe,
  createRankingSnapshot,
  resetPredictionDomain,
} from './prediction-sql.mjs';
import { scorePrediction } from './prediction-scorer.mjs';

export class PredictionLeague {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    this.ready = state.blockConcurrencyWhile(() => {
      initializePredictionSchema(this.sql, {
        environment: env.CIAO_ENV,
        season: env.PREDICTION_SEASON,
      });
    });
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    // route only the seven internal paths; return 404 otherwise.
  }
}
```

Each mutation (`/write`, `/reconcile`, `/snapshot`, `/reset`) must execute in one Durable Object turn and use SQL transaction semantics (`BEGIN IMMEDIATE`, `COMMIT`, `ROLLBACK`) through a small helper so partial batches cannot persist. `/write` accepts only a server-normalized body containing `participant`, `season`, and validated predictions with `match_id`, `competition`, predicted scores, and canonical `locked_at`.

Internal `/reset` must additionally verify the body contains `environment:'test'` and the same `season` as `env.PREDICTION_SEASON`; otherwise respond `403 reset_forbidden` before SQL mutation.

- [ ] **Step 5: Export the class from the Worker main module without adding routes yet**

At the top level of `src/worker.js` add:

```js
export { PredictionLeague } from './v23.3/prediction-league-do.mjs';
```

Keep the existing default Worker export and all current route behavior unchanged.

- [ ] **Step 6: Run focused tests and dry-run bundling**

```bash
node --test test/v23-3-prediction-sql.test.mjs test/v23-3-prediction-do.test.mjs test/v23-3-worker-data.test.mjs
npx wrangler deploy --dry-run
```

Expected: all focused tests PASS; Wrangler bundles the named Durable Object export and default Worker export.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/src/v23.3/prediction-sql.mjs cloudflare-test/src/v23.3/prediction-league-do.mjs cloudflare-test/test/v23-3-prediction-do.test.mjs cloudflare-test/src/worker.js
git commit -m "feat: persist predictions in durable object"
```

---

## Task 3: Resolve authenticated Telegram identity through `ciao-web-api`

**Files:**
- Create: `cloudflare-test/src/v23.3/prediction-auth.mjs`
- Create: `cloudflare-test/test/v23-3-prediction-auth.test.mjs`

**Interfaces:**
- Produces `resolveAuthenticatedUser({request,env}) -> { userId, displayName, username }`.
- Uses only incoming `x-telegram-init-data` and the existing `CIAO_WEB_API` service binding.
- Never accepts a client `user_id` field.

- [ ] **Step 1: Write fail-closed auth tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthenticatedUser } from '../src/v23.3/prediction-auth.mjs';

function request(initData = '') {
  return new Request('https://ciao-web-app-test.example/api/v23.3/predictions', {
    headers: initData ? { 'x-telegram-init-data': initData } : {},
  });
}

test('identity resolver rejects missing Telegram init data before upstream auth', async () => {
  let calls = 0;
  await assert.rejects(
    resolveAuthenticatedUser({
      request: request(),
      env: { CIAO_WEB_API: { fetch: async () => { calls += 1; return Response.json({ ok: true }); } } },
    }),
    error => error.code === 'telegram_auth_required' && error.status === 401,
  );
  assert.equal(calls, 0);
});

test('identity resolver forwards init data to stable state auth and normalizes user', async () => {
  let upstreamRequest;
  const user = await resolveAuthenticatedUser({
    request: request('signed-init-data'),
    env: { CIAO_WEB_API: { fetch: async req => {
      upstreamRequest = req;
      return Response.json({ ok: true, user: { id: 42, first_name: 'Daniil', username: 'ciao42' } });
    } } },
  });
  assert.equal(new URL(upstreamRequest.url).pathname, '/api/ciao-core-api-fast-v4');
  assert.equal(upstreamRequest.headers.get('x-telegram-init-data'), 'signed-init-data');
  assert.deepEqual(JSON.parse(await upstreamRequest.text()), { action: 'state' });
  assert.deepEqual(user, {
    userId: 'telegram:42',
    displayName: 'Daniil',
    username: 'ciao42',
  });
});

test('identity resolver refuses an authenticated payload without stable id', async () => {
  await assert.rejects(
    resolveAuthenticatedUser({
      request: request('signed'),
      env: { CIAO_WEB_API: { fetch: async () => Response.json({ ok: true, user: { first_name: 'No id' } }) } },
    }),
    error => error.code === 'identity_resolution_failed' && error.status === 502,
  );
});
```

Add cases for upstream `401` and `403` preserving the auth status, and a missing display name normalizing to `Участник`.

- [ ] **Step 2: Run and verify RED**

```bash
node --test test/v23-3-prediction-auth.test.mjs
```

Expected: module missing.

- [ ] **Step 3: Implement a typed fail-closed auth error and resolver**

Use a small exported error type:

```js
export class PredictionAuthError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
```

`resolveAuthenticatedUser()` must POST `{action:'state'}` to `/api/ciao-core-api-fast-v4` on the `CIAO_WEB_API` binding with the same `x-telegram-init-data`. Parse the stable ID from the authenticated server response only. Support the currently observed response nesting through one private extractor (`payload.user`, `payload.me`, `payload.profile`, `payload.state?.user`) and require a non-empty `id`. Build display name from trusted fields (`display_name`, `name`, `first_name + last_name`) and fall back to `Участник`.

Do not expose or persist raw init data.

- [ ] **Step 4: Run focused tests**

```bash
node --test test/v23-3-prediction-auth.test.mjs test/v23-3-prediction-contract.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/prediction-auth.mjs cloudflare-test/test/v23-3-prediction-auth.test.mjs
git commit -m "feat: resolve authenticated prediction users"
```

---

## Task 4: Resolve canonical matches, season, status, and the exact deadline

**Files:**
- Create: `cloudflare-test/src/v23.3/prediction-match-resolver.mjs`
- Create: `cloudflare-test/test/v23-3-prediction-match-resolver.test.mjs`

**Interfaces:**
- Consumes existing `adaptSerieASchedule`, `fetchBsdMatches`, `fetchBsdMatchSnapshot`, `getCompetitionConfig`, and `predictionDeadlineForKickoff`.
- Produces `normalizePredictionSeason(value)`, `assertPredictionWritable({match,activeSeason,now})`, `resolveCanonicalPredictionMatch({request,env,competition,matchId})`, `listCanonicalPredictionMatches({request,env,competition='all'})`.

- [ ] **Step 1: Write season/deadline/provider tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePredictionSeason,
  assertPredictionWritable,
} from '../src/v23.3/prediction-match-resolver.mjs';

test('season normalization produces the configured storage key', () => {
  assert.equal(normalizePredictionSeason('2026/27'), '2026-27');
  assert.equal(normalizePredictionSeason('Champions League 2026/27'), '2026-27');
  assert.equal(normalizePredictionSeason('2026-27'), '2026-27');
  assert.throws(() => normalizePredictionSeason('2025/26'), /season/i);
});

test('write guard closes exactly at canonical kickoff minus 15 minutes', () => {
  const match = {
    matchId: 'ucl:601024', competition: 'ucl', season: '2026/27',
    kickoffAt: '2026-09-16T19:00:00Z', status: 'scheduled',
  };
  assert.doesNotThrow(() => assertPredictionWritable({
    match, activeSeason: '2026-27', now: '2026-09-16T18:44:59.999Z',
  }));
  assert.throws(() => assertPredictionWritable({
    match, activeSeason: '2026-27', now: '2026-09-16T18:45:00.000Z',
  }), error => error.code === 'prediction_locked');
});

test('live and finished matches never reopen even with a future kickoff', () => {
  for (const status of ['live','finished']) {
    assert.throws(() => assertPredictionWritable({
      match: { matchId:'ucl:1', competition:'ucl', season:'2026/27', kickoffAt:'2099-01-01T00:00:00Z', status },
      activeSeason:'2026-27', now:'2026-09-02T00:00:00Z',
    }), error => error.code === 'prediction_locked');
  }
});
```

Add provider-isolation tests with injected fetch functions:
- Serie A resolver forwards Telegram init data only to `CIAO_WEB_API` and adapts `ciao-schedule-fast-v1`.
- UCL/UEL/UECL/Coppa resolver uses `BSD_API_KEY` server-side and never places Telegram init data in the BSD `Authorization` header.
- mismatched `competition` / `matchId` is rejected before any provider call.
- canonical season mismatch produces `season_mismatch` status `409`.

- [ ] **Step 2: Run and verify RED**

```bash
node --test test/v23-3-prediction-match-resolver.test.mjs
```

Expected: module missing.

- [ ] **Step 3: Implement exact season normalization and write guard**

```js
import { predictionDeadlineForKickoff } from './competition-data.mjs';

export class PredictionMatchError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

export function normalizePredictionSeason(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/(20\d{2})[\/-](\d{2}|20\d{2})/);
  if (!match) throw new PredictionMatchError('season_mismatch', 409);
  const end = match[2].length === 4 ? match[2].slice(2) : match[2];
  return `${match[1]}-${end}`;
}

export function assertPredictionWritable({ match, activeSeason, now = new Date() } = {}) {
  if (normalizePredictionSeason(match?.season) !== activeSeason) {
    throw new PredictionMatchError('season_mismatch', 409);
  }
  if (['live','finished'].includes(match?.status)) {
    throw new PredictionMatchError('prediction_locked', 409);
  }
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const deadline = Date.parse(predictionDeadlineForKickoff(match?.kickoffAt));
  if (!Number.isFinite(nowMs) || !Number.isFinite(deadline)) {
    throw new PredictionMatchError('match_resolution_failed', 502);
  }
  if (nowMs >= deadline) throw new PredictionMatchError('prediction_locked', 409);
  return predictionDeadlineForKickoff(match.kickoffAt);
}
```

- [ ] **Step 4: Implement canonical provider reads**

`resolveCanonicalPredictionMatch()` must validate `getCompetitionConfig(competition)` and prefix match identity before doing I/O. For `serie_a`, POST `{}` to `/api/ciao-schedule-fast-v1` through `CIAO_WEB_API` with Telegram init data and run `adaptSerieASchedule(payload)`, then find exact `matchId`. For external competitions, call `fetchBsdMatchSnapshot({competition,matchId,apiKey:env.BSD_API_KEY})` for a single match. Missing match -> `404 match_not_found`; upstream/provider failures -> `502 match_resolution_failed`.

`listCanonicalPredictionMatches()` must load the active-season prediction window for one competition or all five. Reuse the existing current date range convention (45 days back, 120 days forward) and filter every returned match by normalized season `env.PREDICTION_SEASON`. `competition='all'` uses `Promise.allSettled` and returns matches from successful competitions plus a structured `errors` map; a single requested competition failure is fatal.

- [ ] **Step 5: Run focused tests**

```bash
node --test test/v23-3-prediction-match-resolver.test.mjs test/v23-2-serie-a-adapter.test.mjs test/v23-3-bsd-provider.test.mjs test/v23-3-competition-data.test.mjs
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-test/src/v23.3/prediction-match-resolver.mjs cloudflare-test/test/v23-3-prediction-match-resolver.test.mjs
git commit -m "feat: resolve canonical prediction matches"
```

---

## Task 5: Extract the existing Serie A scorer and make result reconciliation idempotent

**Files:**
- Create: `cloudflare-test/src/v23.3/prediction-scorer.mjs`
- Create: `cloudflare-test/test/v23-3-prediction-scorer.test.mjs`
- Modify: `cloudflare-test/src/v23.3/prediction-sql.mjs`
- Modify: `cloudflare-test/test/v23-3-prediction-do.test.mjs`

**Interfaces:**
- Produces `scorePrediction({predictedHome,predictedAway,finalHome,finalAway}) -> {points,resultType}`.
- Produces `resultFingerprint({matchId,finalHome,finalAway,rawVersion}) -> string`.
- Scorer behavior must be byte-for-behavior equivalent to the existing stable Serie A decision tree.

- [ ] **Step 1: Locate the authoritative stable scorer before editing it**

Build the current stable TEST source and search the generated HTML:

```bash
cd cloudflare-test
npm run build
rg -n "save_predictions|prediction.*point|points.*prediction|exact.*score|home_score|away_score|result_type" dist/index.html
```

Open the matched function(s) and identify the one decision tree that computes awarded points/result type from predicted and final scores. Record its exact branch order and constants in the new test file as a private `legacyScorePrediction()` reference function. Do not simplify or reinterpret it.

- [ ] **Step 2: Write exhaustive parity tests against the extracted reference**

`test/v23-3-prediction-scorer.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { scorePrediction, resultFingerprint } from '../src/v23.3/prediction-scorer.mjs';

// legacyScorePrediction is copied verbatim from the authoritative stable scorer,
// with variable names changed only to predictedHome/predictedAway/finalHome/finalAway.

test('new scorer is exhaustive-parity with current Serie A scorer for practical scores 0..8', () => {
  for (let ph = 0; ph <= 8; ph += 1) {
    for (let pa = 0; pa <= 8; pa += 1) {
      for (let fh = 0; fh <= 8; fh += 1) {
        for (let fa = 0; fa <= 8; fa += 1) {
          assert.deepEqual(
            scorePrediction({ predictedHome: ph, predictedAway: pa, finalHome: fh, finalAway: fa }),
            legacyScorePrediction({ predictedHome: ph, predictedAway: pa, finalHome: fh, finalAway: fa }),
            `${ph}:${pa} vs ${fh}:${fa}`,
          );
        }
      }
    }
  }
});

test('result fingerprint is stable and changes on corrected final score/version', () => {
  const base = resultFingerprint({ matchId:'ucl:1', finalHome:2, finalAway:1, rawVersion:'v1' });
  assert.equal(base, resultFingerprint({ matchId:'ucl:1', finalHome:2, finalAway:1, rawVersion:'v1' }));
  assert.notEqual(base, resultFingerprint({ matchId:'ucl:1', finalHome:2, finalAway:2, rawVersion:'v1' }));
  assert.notEqual(base, resultFingerprint({ matchId:'ucl:1', finalHome:2, finalAway:1, rawVersion:'v2' }));
});
```

- [ ] **Step 3: Run and verify RED**

```bash
node --test test/v23-3-prediction-scorer.test.mjs
```

Expected: module missing.

- [ ] **Step 4: Implement the exact scorer by moving, not redesigning, the stable decision tree**

Create `prediction-scorer.mjs`. Copy the same comparisons, constants, and branch order found in Step 1. Only normalize the signature and return object to `{points,resultType}`. Add integer validation for all four scores; invalid values throw before calculation.

Implement a deterministic fingerprint without external dependencies:

```js
export function resultFingerprint({ matchId, finalHome, finalAway, rawVersion = '' } = {}) {
  return `${String(matchId)}|${Number(finalHome)}:${Number(finalAway)}|${String(rawVersion)}`;
}
```

- [ ] **Step 5: Wire reconciliation to fingerprint equality**

In `prediction-sql.mjs`, `reconcileMatchPredictions()` must:
1. read all rows for `match_id`;
2. skip a row when its `result_fingerprint` equals the incoming fingerprint;
3. otherwise call `scorePrediction()` and update `points`, `result_type`, `final_home`, `final_away`, `result_fingerprint`, `scored_at` in one transaction;
4. return `{affected, skipped}`.

Add a DO test proving two identical `/reconcile` calls do not apply the score twice, while a corrected final score with a new fingerprint recomputes the stored result.

- [ ] **Step 6: Run parity and DO tests**

```bash
node --test test/v23-3-prediction-scorer.test.mjs test/v23-3-prediction-do.test.mjs
```

Expected: all PASS, including the exhaustive parity matrix.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/src/v23.3/prediction-scorer.mjs cloudflare-test/test/v23-3-prediction-scorer.test.mjs cloudflare-test/src/v23.3/prediction-sql.mjs cloudflare-test/test/v23-3-prediction-do.test.mjs
git commit -m "feat: preserve prediction scoring parity"
```

---

## Task 6: Build the Worker-side prediction service over auth + canonical matches + Durable Object

**Files:**
- Create: `cloudflare-test/src/v23.3/prediction-service.mjs`
- Create: `cloudflare-test/test/v23-3-prediction-service.test.mjs`

**Interfaces:**
- Consumes `buildPredictionWritePayload`, `resolveAuthenticatedUser`, `resolveCanonicalPredictionMatch`, `listCanonicalPredictionMatches`, `assertPredictionWritable`, `normalizePredictionSeason`, `predictionObjectName`, `resultFingerprint`, and `env.PREDICTION_LEAGUE`.
- Produces `createPredictionService({request,env,now})` with methods `save(body)`, `list(competition)`, `available(competition)`, `rankings({scope,competition})`, `rankingMe()`.
- Produces `PredictionServiceError` with exact public error codes/statuses.

- [ ] **Step 1: Write service tests with a fake Durable Object namespace**

Create a fake namespace that records the `idFromName()` argument and internal `stub.fetch()` requests:

```js
function predictionNamespace(handler) {
  const names = [];
  return {
    names,
    idFromName(name) { names.push(name); return `id:${name}`; },
    get() { return { fetch: handler }; },
  };
}
```

Required tests:
- save resolves authenticated identity, validates every requested match, and calls object name `prediction-league:test:2026-27` exactly once;
- a batch with one locked/missing/mismatched match makes zero Durable Object write calls;
- list returns only current authenticated user rows;
- `available('all')` joins canonical match cards with the user's stored prediction by `match_id` and calculates `locked/open` from canonical server data;
- ranking request triggers reconciliation of finished active-season matches before `/rankings` internal read;
- object/storage failures map to `503 prediction_backend_unavailable` without leaking internal URLs;
- `identity_resolution_failed`, `match_not_found`, `prediction_locked`, `season_mismatch`, and `competition_match_mismatch` retain the approved public status codes.

Example atomicity assertion:

```js
assert.equal(doWriteCalls, 0);
assert.equal(error.code, 'prediction_locked');
assert.equal(error.status, 409);
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test test/v23-3-prediction-service.test.mjs
```

Expected: module missing.

- [ ] **Step 3: Implement the service factory and DO stub helper**

Use one helper for object identity:

```js
function activeStub(env) {
  const name = predictionObjectName({
    environment: env.CIAO_ENV,
    season: env.PREDICTION_SEASON,
  });
  const id = env.PREDICTION_LEAGUE.idFromName(name);
  return { name, stub: env.PREDICTION_LEAGUE.get(id) };
}

async function internalJson(stub, path, { method = 'GET', body } = {}) {
  const response = await stub.fetch(new Request(`https://prediction-league.internal${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }));
  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new PredictionServiceError(payload?.error || 'prediction_backend_unavailable', response.status || 503);
  }
  return payload.data;
}
```

`save(body)` algorithm must be exactly:
1. resolve authenticated user;
2. normalize `buildPredictionWritePayload(body)`;
3. resolve every canonical match using its competition/match ID;
4. run `assertPredictionWritable()` with server `now` and active season on every match;
5. only after all validations succeed, call one internal `/write` with participant + active season + all validated rows and canonical `locked_at`;
6. return the Durable Object's stored rows.

`available(competition)` must call `listCanonicalPredictionMatches()`, read the user's stored rows, map them by `match_id`, and emit deterministic chronological records with canonical match metadata plus `prediction` and `state: 'open'|'locked'|'finished'`.

`rankings()` and `rankingMe()` must first call one private `reconcileFinishedMatches()` that sends each finished match with final scores and `resultFingerprint()` to `/reconcile`. Reconciliation errors should fail the ranking response rather than silently showing known stale points.

- [ ] **Step 4: Run focused service tests**

```bash
node --test test/v23-3-prediction-service.test.mjs test/v23-3-prediction-auth.test.mjs test/v23-3-prediction-match-resolver.test.mjs test/v23-3-prediction-scorer.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/prediction-service.mjs cloudflare-test/test/v23-3-prediction-service.test.mjs
git commit -m "feat: orchestrate prediction backend service"
```

---

## Task 7: Expose the v23.3 prediction/ranking API and guarded TEST reset in `worker.js`

**Files:**
- Modify: `cloudflare-test/src/worker.js`
- Create: `cloudflare-test/test/v23-3-prediction-worker.test.mjs`
- Modify: `cloudflare-test/src/v23.3/reset-contract.mjs`
- Modify: `cloudflare-test/test/v23-3-reset-contract.test.mjs`

**Interfaces:**
- Public routes:
  - `POST /api/v23.3/predictions`
  - `GET /api/v23.3/predictions?competition=<key|all>`
  - `GET /api/v23.3/predictions/available?competition=<key|all>`
  - `GET /api/v23.3/rankings?scope=<overall|competition>&competition=<key>`
  - `GET /api/v23.3/rankings/me`
  - `POST /api/v23.3/test/predictions/reset`
- Existing `/api/v23.2/matches`, `/api/v23.3/standings`, `/api/v23.3/match-center`, generic `/api/*`, Static Assets, and `/healthz` continue to work.

- [ ] **Step 1: Write route tests before editing the Worker**

Use the same `env()` style as `v23-3-worker-data.test.mjs` plus a fake `PREDICTION_LEAGUE`. Required tests:

```js
test('POST predictions requires Telegram auth and never reaches DO without it', async () => { /* assert 401 and zero DO calls */ });
test('GET predictions returns authenticated user rows from active TEST object', async () => { /* assert 200 */ });
test('GET available validates competition query', async () => { /* invalid -> 400 */ });
test('competition ranking requires competition when scope=competition', async () => { /* 400 */ });
test('overall ranking ignores optional competition query', async () => { /* 200 and overall internal scope */ });
test('ranking me is authenticated and scoped to active season', async () => { /* 200 */ });
```

Add reset guard tests:
- wrong host -> `403 reset_forbidden`, zero DO calls;
- missing/wrong `TEST_RESET_TOKEN` -> `403 reset_forbidden`;
- `CIAO_ENV !== 'test'` -> `403 reset_forbidden`;
- active object name not `prediction-league:test:` -> reject;
- valid TEST host + env + token -> internal `/reset` exactly once and response stages are `predictions`, `points`, `ranking`, `caches`;
- no route or code path enables Production reset.

- [ ] **Step 2: Run Worker tests and verify RED**

```bash
node --test test/v23-3-prediction-worker.test.mjs test/v23-3-reset-contract.test.mjs
```

Expected: prediction routes are not present yet.

- [ ] **Step 3: Add route handlers before generic `/api/*` proxying**

Import `createPredictionService`. Add route constants and dispatch methods. Every prediction/ranking route must create its service from the current `request`, `env`, and server `new Date()`; do not read user IDs or timestamps from query/body.

Use one response adapter:

```js
async function predictionResponse(action) {
  try {
    const data = await action();
    return Response.json({ ok: true, data });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const code = String(error?.code || 'prediction_storage_failed');
    return errorJson(status, { error: code });
  }
}
```

Keep error payloads concise; do not expose Telegram init data, BSD token, Durable Object internal name, stack traces, or SQL.

- [ ] **Step 4: Implement the executable TEST reset guard at the Worker boundary**

Use `assertSafeResetTarget()` from the existing reset contract plus exact secret/header comparison:

```js
function assertTestPredictionReset(request, env) {
  const url = new URL(request.url);
  assertSafeResetTarget({ origin: url.origin, environment: env.CIAO_ENV });
  if (!env.TEST_RESET_TOKEN) throw Object.assign(new Error('reset_forbidden'), { code:'reset_forbidden', status:403 });
  if (request.headers.get('x-ciao-test-reset-token') !== env.TEST_RESET_TOKEN) {
    throw Object.assign(new Error('reset_forbidden'), { code:'reset_forbidden', status:403 });
  }
  const name = predictionObjectName({ environment: env.CIAO_ENV, season: env.PREDICTION_SEASON });
  if (!name.startsWith('prediction-league:test:')) {
    throw Object.assign(new Error('reset_forbidden'), { code:'reset_forbidden', status:403 });
  }
  return name;
}
```

The Worker calls internal `/reset` with `{environment:'test',season:env.PREDICTION_SEASON}`. Map its counts into the existing four reset stages. Do not add `TEST_RESET_TOKEN` to `wrangler.jsonc`; it remains a Wrangler secret.

- [ ] **Step 5: Extend `/healthz` with non-sensitive backend configuration markers**

Add only booleans/strings safe for diagnostics:

```js
prediction_backend: 'durable-object-sqlite',
prediction_environment: env.CIAO_ENV || null,
prediction_season: env.PREDICTION_SEASON || null,
prediction_do_configured: Boolean(env.PREDICTION_LEAGUE),
```

Do not expose secret presence beyond the existing allowed diagnostics and do not expose `TEST_RESET_TOKEN`.

- [ ] **Step 6: Run all Worker/reset regressions**

```bash
node --test test/v23-3-prediction-worker.test.mjs test/v23-3-worker-data.test.mjs test/v23-2-worker-api.test.mjs test/v23-3-reset-contract.test.mjs
```

Expected: all PASS; existing standings/match-center routes remain unchanged.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/src/worker.js cloudflare-test/test/v23-3-prediction-worker.test.mjs cloudflare-test/src/v23.3/reset-contract.mjs cloudflare-test/test/v23-3-reset-contract.test.mjs
git commit -m "feat: expose TEST prediction API"
```

---

## Task 8: Cut the browser prediction surface over to server-only persistence

**Files:**
- Create: `cloudflare-test/src/v23.3/prediction-client.mjs`
- Create: `cloudflare-test/src/v23.3/predictions-ui.mjs`
- Create: `cloudflare-test/test/v23-3-prediction-client.test.mjs`
- Create: `cloudflare-test/test/v23-3-predictions-ui.test.mjs`
- Modify: `cloudflare-test/src/v23.3/index.mjs`
- Modify: `cloudflare-test/test/v23-3-build.test.mjs`
- Modify: `cloudflare-test/scripts/build.mjs` only if its current `.mjs` copy behavior needs an explicit assertion; do not add a second v23.3 entry.

**Interfaces:**
- `createPredictionClient({fetchImpl,initData})` exposes `list`, `available`, `save`, `rankings`, `rankingMe`.
- `installPredictionsUi()` owns v23.3 prediction data rendering and keeps only unsaved score drafts in JavaScript memory.
- `CiaoV233.predictions` changes from `'blocked'` to `'enabled'` only in this task, after server/client tests pass.

- [ ] **Step 1: Write the fetch-client tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPredictionClient } from '../src/v23.3/prediction-client.mjs';

test('prediction client always sends Telegram init data and uses v23.3 routes', async () => {
  const requests = [];
  const client = createPredictionClient({
    initData: 'signed-init',
    fetchImpl: async request => {
      requests.push(request);
      return Response.json({ ok:true, data:[] });
    },
  });
  await client.available('all');
  await client.save({ competition_key:'ucl', predictions:[{ match_id:'ucl:1', home_score:1, away_score:0 }] });
  assert.equal(requests.every(req => req.headers.get('x-telegram-init-data') === 'signed-init'), true);
  assert.equal(new URL(requests[0].url).pathname, '/api/v23.3/predictions/available');
  assert.equal(new URL(requests[1].url).pathname, '/api/v23.3/predictions');
});

test('prediction client exposes server error code without persisting a fallback', async () => {
  const client = createPredictionClient({
    initData:'signed',
    fetchImpl: async () => Response.json({ ok:false, error:'prediction_locked' }, { status:409 }),
  });
  await assert.rejects(client.save({ competition_key:'ucl', predictions:[{ match_id:'ucl:1', home_score:1, away_score:0 }] }), /prediction_locked/);
});
```

- [ ] **Step 2: Write source/UI tests that forbid prediction persistence fallbacks**

`v23-3-predictions-ui.test.mjs` must read `predictions-ui.mjs` and `prediction-client.mjs` as source and assert:

```js
assert.doesNotMatch(source, /localStorage|indexedDB|supabase/i);
assert.doesNotMatch(source, /save_predictions/);
assert.match(source, /\/api\/v23\.3\/predictions/);
```

Add behavior tests around exported pure helpers:
- chronological `Все доступные` grouping by date;
- five competition filters;
- `Не заполнено` filter;
- card states `Прогноз открыт`, `Твой прогноз: X:Y ✓`, `Прогноз закрыт`, and finished result/points;
- save success replaces in-memory draft with authoritative server row;
- save failure keeps in-memory draft and returns a local error state without marking saved;
- editing one card does not remount/reorder other cards.

- [ ] **Step 3: Run and verify RED**

```bash
node --test test/v23-3-prediction-client.test.mjs test/v23-3-predictions-ui.test.mjs test/v23-3-build.test.mjs
```

Expected: new modules missing; build test still reports predictions blocked.

- [ ] **Step 4: Implement `prediction-client.mjs`**

All requests use same-origin URLs and include `x-telegram-init-data`. `save()` uses JSON POST. Read methods use GET query parameters. A non-OK HTTP response or `{ok:false}` throws an `Error` whose `code` is the server `error` and whose `status` is the HTTP status.

There is no storage API in this module.

- [ ] **Step 5: Implement `predictions-ui.mjs` around the current approved prediction layout**

Do not redesign Home/Matches/Tables/Match Center. The prediction UI may patch/replace only the existing prediction screen content and handlers. Keep a module-local `Map` keyed by `matchId` for unsaved drafts. On screen entry, call `available('all')`; on filter change, select from that server-backed dataset; on save, POST only changed card rows; on success merge authoritative stored row by `match_id`; on failure preserve the draft map and render a card-local error.

The UI must never interpret client clock as authoritative. It may display the server-derived `state` returned by `available()` but must treat `409 prediction_locked` from save as final and refresh that card from the server.

- [ ] **Step 6: Enable the unified v23.3 prediction entry once**

Update `src/v23.3/index.mjs`:

```js
import './home-integration.mjs';
import './tables-ui.mjs';
import './predictions-ui.mjs';

export const CiaoV233 = Object.freeze({
  version: '23.3',
  home: 'enabled',
  tables: 'enabled',
  matchCenter: 'enabled',
  predictions: 'enabled',
});
```

Update `v23-3-build.test.mjs` so `copyV233Modules()` must include `prediction-client.mjs` and `predictions-ui.mjs`, the unified entry imports `predictions-ui.mjs`, and the entry still contains no reset tooling. Preserve the single `<script type="module" id="ciao-v233" ...>` rule.

- [ ] **Step 7: Run browser/build regressions**

```bash
node --test test/v23-3-prediction-client.test.mjs test/v23-3-predictions-ui.test.mjs test/v23-3-build.test.mjs
npm run build
```

Expected: PASS; built `dist/v23.3/` contains the prediction modules; no browser source contains prediction `localStorage`, IndexedDB, Supabase, legacy `save_predictions`, or reset logic.

- [ ] **Step 8: Commit**

```bash
git add cloudflare-test/src/v23.3/prediction-client.mjs cloudflare-test/src/v23.3/predictions-ui.mjs cloudflare-test/test/v23-3-prediction-client.test.mjs cloudflare-test/test/v23-3-predictions-ui.test.mjs cloudflare-test/src/v23.3/index.mjs cloudflare-test/test/v23-3-build.test.mjs cloudflare-test/scripts/build.mjs
git commit -m "feat: enable server backed predictions UI"
```

---

## Task 9: Prove the real TEST backend with authenticated smoke and guarded reset evidence

**Files:**
- Create: `cloudflare-test/scripts/smoke-prediction-backend.mjs`
- Modify: `cloudflare-test/scripts/probe-prediction-contract.mjs`
- Modify: `cloudflare-test/scripts/probe-reset-contract.mjs`
- Modify: `cloudflare-test/test/v23-3-prediction-probe.test.mjs`
- Modify: `cloudflare-test/test/v23-3-reset-probe.test.mjs`
- Modify: `cloudflare-test/package.json`

**Interfaces:**
- Smoke input comes only from environment secrets/fixtures: `TEST_TELEGRAM_INIT_DATA`, `TEST_PREDICTION_MATCH_A`, `TEST_PREDICTION_MATCH_B`, optionally `TEST_RESET_TOKEN` for the explicit TEST cleanup command.
- Smoke output: `artifacts/v23-3-prediction-authenticated-smoke.json` with the exact gate booleans already expected by `evaluatePredictionGate`.
- Smoke must not print or store Telegram init data or reset token.

- [ ] **Step 1: Write report-generation tests first**

Extend `v23-3-prediction-probe.test.mjs` to assert that a smoke record containing all seven approved signals yields gate `PASS`, and any one false signal yields `BLOCKED`:

```js
const smoke = {
  performed: true,
  isolatedFixture: true,
  persistenceRoundTrip: true,
  crossCompetitionIsolation: true,
  deadlineBoundaryRejected: true,
  scoringParity: true,
  productionDataUntouched: true,
};
assert.equal(createPredictionContractReport({ observedContract, authenticatedSmoke: smoke }).status, 'PASS');
```

Extend `v23-3-reset-probe.test.mjs` so guarded TEST reset verification can set `guardedBackendResetVerified:true` but `canExecuteProductionReset` remains `false` and `requiresExplicitProductionApproval` remains `true`.

- [ ] **Step 2: Run probe tests and verify RED where new input wiring is absent**

```bash
node --test test/v23-3-prediction-probe.test.mjs test/v23-3-reset-probe.test.mjs
```

- [ ] **Step 3: Implement the authenticated smoke script with no Production mutation**

`smoke-prediction-backend.mjs` must:
1. require origin to be exactly `https://ciao-web-app-test.ciao-web.workers.dev` unless an explicit local origin is passed for unit testing;
2. require authenticated Telegram init data from environment without logging it;
3. GET `/healthz` and require `prediction_environment:'test'`, `prediction_season:'2026-27'`, backend `durable-object-sqlite`;
4. fetch available predictions and select configured isolated fixtures only;
5. save a prediction for fixture A, GET it back, edit it, GET it back again, and set `persistenceRoundTrip` only when the same `prediction_id` survives the edit;
6. use fixture B from a different competition to prove `crossCompetitionIsolation` and canonical prefixes;
7. perform a boundary-rejection probe only with a fixture whose canonical server state is already locked, expecting `409 prediction_locked`; never manipulate the client clock to claim success;
8. compare scorer evidence to the exhaustive local parity artifact/test result and set `scoringParity` only when parity test passed in the same revision;
9. set `productionDataUntouched:true` only after verifying every HTTP origin used by the script was the TEST origin;
10. write only boolean evidence, fixture match IDs, statuses, timestamps, and TEST build markers to the artifact.

Do not call the TEST reset automatically from the smoke. Reset is a separate explicit command.

- [ ] **Step 4: Let `probe-prediction-contract.mjs` consume the smoke artifact**

Add an optional `PREDICTION_AUTH_SMOKE_INPUT` path. If present and parseable, pass it to `createPredictionContractReport`; if absent, retain current `REQUIRES_AUTHENTICATED_SMOKE` behavior. This keeps ordinary CI non-destructive while allowing an explicit authenticated acceptance run to generate PASS evidence.

- [ ] **Step 5: Add package scripts**

Extend `package.json`:

```json
"smoke:predictions": "node scripts/smoke-prediction-backend.mjs",
"probe:predictions": "node scripts/probe-prediction-contract.mjs",
"probe:reset": "node scripts/probe-reset-contract.mjs"
```

No script may contain tokens or hard-coded Telegram data.

- [ ] **Step 6: Run deterministic probe tests**

```bash
node --test test/v23-3-prediction-probe.test.mjs test/v23-3-reset-probe.test.mjs
node scripts/probe-prediction-contract.mjs
```

Expected without authenticated smoke: report remains `REQUIRES_AUTHENTICATED_SMOKE`, `mutatedUserData:false`.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/scripts/smoke-prediction-backend.mjs cloudflare-test/scripts/probe-prediction-contract.mjs cloudflare-test/scripts/probe-reset-contract.mjs cloudflare-test/test/v23-3-prediction-probe.test.mjs cloudflare-test/test/v23-3-reset-probe.test.mjs cloudflare-test/package.json
git commit -m "test: add authenticated prediction backend smoke"
```

---

## Task 10: Full regression, CI evidence, TEST deployment, and acceptance gate

**Files:**
- Modify: `cloudflare-test/scripts/probe-test-deployment.mjs`
- Modify: `cloudflare-test/test/v23-3-deployment-probe.test.mjs`
- Modify: `.github/workflows/ciao-test-check.yml`
- Modify: `cloudflare-test/README.md`

**Interfaces:**
- Deterministic CI proves code/build/contracts without secrets.
- Explicit authenticated TEST acceptance proves persistence in deployed `ciao-web-app-test`.
- Production remains untouched; no Production deployment or reset exists in this task.

- [ ] **Step 1: Expand deployed TEST probe expectations**

Update `v23-3-deployment-probe.test.mjs` and `probe-test-deployment.mjs` so `/healthz` must include:

```js
{
  ok: true,
  service: 'ciao-web-app-test',
  prediction_backend: 'durable-object-sqlite',
  prediction_environment: 'test',
  prediction_season: '2026-27',
  prediction_do_configured: true,
}
```

The deployed probe must also issue an unauthenticated GET to `/api/v23.3/predictions` and require `401 telegram_auth_required`. This proves the route exists while remaining non-mutating.

- [ ] **Step 2: Run deployment-probe tests and verify RED before updating the probe**

```bash
node --test test/v23-3-deployment-probe.test.mjs
```

Expected: current probe lacks prediction backend assertions.

- [ ] **Step 3: Update CI without making it destructive**

Keep existing Node 22 install/test/build/probes. Add a `wrangler deploy --dry-run` step after build so Durable Object config is validated. Keep the static prediction contract probe; do not run authenticated smoke or reset in ordinary GitHub Actions. Upload the smoke artifact only when a file exists from a manually dispatched authenticated workflow/run; use `if-no-files-found: ignore` for that optional artifact.

Do not add `TEST_TELEGRAM_INIT_DATA` or `TEST_RESET_TOKEN` values to workflow YAML.

- [ ] **Step 4: Document the exact TEST rollout commands**

Update `cloudflare-test/README.md` with this sequence:

```bash
npm install --no-audit --no-fund
npm test
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy
node scripts/probe-test-deployment.mjs
TEST_TELEGRAM_INIT_DATA='(local shell secret)' \
TEST_PREDICTION_MATCH_A='ucl:<real-test-match-id>' \
TEST_PREDICTION_MATCH_B='serie_a:<real-test-match-id>' \
npm run smoke:predictions
PREDICTION_AUTH_SMOKE_INPUT=artifacts/v23-3-prediction-authenticated-smoke.json \
npm run probe:predictions
```

The README must explicitly state that the real match IDs are selected from current TEST `/predictions/available` data, not invented, and the secret values are entered only in the local/authorized execution environment.

Document TEST reset as a separate explicit command requiring `x-ciao-test-reset-token`; state that it is never part of normal deploy/smoke and never targets Production.

- [ ] **Step 5: Run the complete deterministic suite before any TEST deployment**

```bash
cd cloudflare-test
npm test
npm run build
npx wrangler deploy --dry-run
node scripts/probe-prediction-contract.mjs
node scripts/probe-reset-contract.mjs
node scripts/probe-bsd-provider.mjs
```

Expected:
- all Node tests PASS;
- build GREEN;
- Wrangler dry-run GREEN;
- static prediction contract may still say `REQUIRES_AUTHENTICATED_SMOKE` until the deployed smoke is performed;
- reset contract still forbids Production reset.

- [ ] **Step 6: Verify the diff cannot touch Production configuration**

From repository root:

```bash
git diff --name-only develop...HEAD
git diff develop...HEAD -- cloudflare-test/wrangler.jsonc .github/workflows/ciao-test-check.yml
```

Expected changed runtime/config paths are limited to TEST `cloudflare-test/**`, the TEST workflow, docs/spec/plan, and no Production Worker config or Production release file is changed.

- [ ] **Step 7: Deploy only `ciao-web-app-test` after deterministic GREEN**

```bash
cd cloudflare-test
npx wrangler deploy
node scripts/probe-test-deployment.mjs
```

Expected `/healthz` returns TEST service + Durable Object backend markers and existing BSD/Static Assets checks remain GREEN.

- [ ] **Step 8: Perform the authenticated isolated TEST smoke**

Select two currently available active-season matches from two competitions, then run `npm run smoke:predictions` with authorized TEST Telegram init data in the execution environment. The smoke must create/edit only the current authenticated user's TEST prediction rows.

Then run:

```bash
PREDICTION_AUTH_SMOKE_INPUT=artifacts/v23-3-prediction-authenticated-smoke.json \
npm run probe:predictions
```

Expected report:

```json
{
  "pass": true,
  "status": "PASS",
  "requiresAuthenticatedSmoke": false
}
```

and all seven authenticated smoke booleans are `true`.

- [ ] **Step 9: Verify guarded TEST reset separately, then restore one smoke row**

Only when cleanup is desired, call the TEST reset route with the configured local `TEST_RESET_TOKEN`. Require response stages `predictions`, `points`, `ranking`, `caches` all `ok:true`. Immediately re-run `/healthz`, unauthenticated route guard, and one authenticated prediction persistence round-trip so reset cannot mask a broken store.

Never call or simulate a Production reset.

- [ ] **Step 10: Run the final full suite after deployed evidence**

```bash
npm test
npm run build
node scripts/probe-test-deployment.mjs
PREDICTION_AUTH_SMOKE_INPUT=artifacts/v23-3-prediction-authenticated-smoke.json npm run probe:predictions
node scripts/probe-reset-contract.mjs
```

Expected: tests/build/deployment probe GREEN; prediction gate PASS; Production reset capability remains false.

- [ ] **Step 11: Commit the acceptance tooling/docs**

```bash
git add cloudflare-test/scripts/probe-test-deployment.mjs cloudflare-test/test/v23-3-deployment-probe.test.mjs .github/workflows/ciao-test-check.yml cloudflare-test/README.md
git commit -m "test: gate durable prediction TEST release"
```

---

## Final Acceptance Checklist

Before this work can be called complete, all of the following must be true:

- [ ] `PredictionLeague` is SQLite-backed and bound only to TEST in this phase.
- [ ] `PREDICTION_SEASON` is exactly `2026-27` and canonical match season is checked on every write.
- [ ] Missing/invalid Telegram auth cannot reach Durable Object storage.
- [ ] Client-supplied user IDs, season, deadline, status, and timestamps are ignored/not accepted as authority.
- [ ] Batch writes are atomic and editing preserves `prediction_id`.
- [ ] Deadline boundary at exactly minus 15 minutes is rejected.
- [ ] Live/finished matches never reopen.
- [ ] Existing Serie A scoring parity is proven exhaustively for 0..8 score matrices and representative boundary cases.
- [ ] Result reconciliation is idempotent and supports corrected final scores through fingerprint changes.
- [ ] Rankings cover each competition plus equal-weight overall ranking with deterministic tie breakers.
- [ ] Browser prediction code contains no `localStorage`, IndexedDB, Supabase, or legacy `save_predictions` persistence fallback.
- [ ] Failed saves keep unsaved UI draft visible and never display it as saved.
- [ ] TEST reset is protected by host + env + season + secret + object-name guards.
- [ ] Reset preserves schema metadata and invalidates prediction cache generation.
- [ ] Production reset remains impossible and Production configuration is unchanged.
- [ ] Existing Home/Matches/Tables/Match Center/profile/localization tests stay green.
- [ ] `npm test`, `npm run build`, and `wrangler deploy --dry-run` are green.
- [ ] Deployed TEST `/healthz` reports the Durable Object backend and active season.
- [ ] Authenticated TEST smoke proves persistence round-trip, cross-competition isolation, deadline rejection, scoring parity, and Production isolation.
- [ ] The v23.3 prediction contract report reaches `PASS` only from that real authenticated smoke evidence.

## Self-Review Notes

- Spec coverage: storage schema, environment/season partition, auth, canonical match authority, exact deadline, scoring parity, idempotent reconciliation, rankings, TEST reset, frontend server-only persistence, error isolation, configuration, tests, smoke, and Production isolation are each mapped to a task above.
- The scorer is intentionally extracted from the existing stable implementation during Task 5 rather than guessed in this plan; the exhaustive parity test prevents accidental formula changes.
- No implementation task enables Production deployment or Production reset.
- The plan keeps the current v23.3 single browser entry and existing `ASSETS` / `CIAO_WEB_API` bindings intact while adding only the TEST Durable Object subsystem.
