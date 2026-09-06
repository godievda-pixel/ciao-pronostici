# Ciao, Web! v23 TEST Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing v23 candidate into a fully isolated TEST environment with its own Cloudflare Worker, Supabase backend, and Telegram button while keeping Production v22.5 untouched.

**Architecture:** Create `v23-test` from the known v23 candidate `f4aeca50c5449ea350ec5f3fadf788ca4a039c5f`. The frontend continues to live under `cloudflare-production` on that TEST branch, but its Wrangler identity becomes `ciao-web-v23-test` and its API contract points only to Supabase TEST project `lcnwccnkkxaosxnfvjvr`. Deploy only the six v23 backend Edge Functions required by `CURRENT_API`, recreate only their required database schema/reference data, and never copy Production user-generated rows.

**Tech Stack:** Node.js 22, Cloudflare Workers/Wrangler 4, Supabase Postgres + Edge Functions, Telegram Mini App, GitHub branches/actions.

**Spec:** `docs/superpowers/specs/2026-09-06-v23-test-environment-design.md`

## Global Constraints

- Production branch remains `main` and Production Worker remains `ciao-web-app`.
- Production Supabase remains `dkefzepiiudehhzbbrjn`.
- TEST branch is exactly `v23-test`.
- TEST Worker is exactly `ciao-web-v23-test`.
- TEST Supabase project is exactly `lcnwccnkkxaosxnfvjvr`.
- Telegram TEST button label is exactly `🧪 Ciao v23 TEST`.
- No Production predictions, profiles, user ranking rows, notification state, private tokens, or other user-generated rows are copied into TEST.
- All TEST write smoke checks must prove writes land only in `lcnwccnkkxaosxnfvjvr`.
- No v23 promotion to `main` occurs without explicit user approval after real Telegram smoke.

---

### Task 1: Bring Supabase TEST online and inventory the minimum backend surface

**Files:**
- Create: `docs/superpowers/artifacts/v23-test-backend-manifest.md`
- No Production code changes.

**Interfaces:**
- Consumes: Production Supabase project `dkefzepiiudehhzbbrjn`; TEST Supabase project `lcnwccnkkxaosxnfvjvr`; v23 API contract at `cloudflare-production/src/modular/data/api-contract.mjs`.
- Produces: a manifest naming the exact six Edge Functions, every referenced `public` table/view, and each table classified as `schema-only`, `reference-seed`, or `test-generated`.

- [ ] **Step 1: Wait until TEST Supabase is healthy**

Check project `lcnwccnkkxaosxnfvjvr` until status is exactly `ACTIVE_HEALTHY`.

Expected: no schema or function deployment starts while status is `COMING_UP`.

- [ ] **Step 2: Record the six backend functions required by v23**

From `CURRENT_API`, record exactly:

```text
ciao-core-api-fast-v6
ciao-match-center-fast-v3
ciao-club-profile-fast
ciao-live-snapshot-v1
ciao-schedule-fast-v1
ciao-prediction-insights-v1
```

- [ ] **Step 3: Fetch each Production Edge Function source and inventory database dependencies**

For each of the six function slugs, fetch the current Production source from `dkefzepiiudehhzbbrjn` and search for SQL/RPC/table/storage references. Record only dependencies actually used by these functions.

The manifest entry format must be:

```markdown
## ciao-core-api-fast-v6
- Tables/views: `public.<name>`, ...
- RPC/functions: `<name>`, ...
- Storage buckets: `<name>` or `none`
- Writes: yes/no
```

- [ ] **Step 4: Inspect TEST project schema metadata without reading user rows**

Run this exact metadata query against `lcnwccnkkxaosxnfvjvr`:

```sql
select
  table_schema,
  table_name,
  table_type
from information_schema.tables
where table_schema in ('public','storage')
order by table_schema, table_name;
```

Then inspect only columns for required `public` objects:

```sql
select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

Do not `select *` from Production user tables.

- [ ] **Step 5: Classify every required table**

Use exactly these three categories in the manifest:

```text
schema-only      = structure required; start empty
a reference-seed classification is NOT valid; use reference-seed below
reference-seed   = non-user lookup/static rows required for screens to function
test-generated   = profiles/predictions/favorites/ranking or other rows created by TEST users
```

No Production user-generated table may be classified `reference-seed`.

- [ ] **Step 6: Commit the manifest**

```bash
git add docs/superpowers/artifacts/v23-test-backend-manifest.md
git commit -m "docs: inventory v23 test backend dependencies"
```

Expected: manifest contains all six functions and no unrelated Supabase function.

---

### Task 2: Create the isolated `v23-test` branch and lock frontend configuration to TEST

**Files:**
- Modify: `cloudflare-production/wrangler.jsonc`
- Modify: `cloudflare-production/src/modular/data/api-contract.mjs`
- Modify: `cloudflare-production/test/api-contract.test.mjs`
- Create: `cloudflare-production/test/test-environment.test.mjs`

**Interfaces:**
- Consumes: v23 candidate commit `f4aeca50c5449ea350ec5f3fadf788ca4a039c5f` and TEST Supabase ref `lcnwccnkkxaosxnfvjvr`.
- Produces: a branch whose built frontend cannot address Production Supabase endpoints and whose Wrangler deploy target cannot overwrite `ciao-web-app`.

- [ ] **Step 1: Create `v23-test` from the exact candidate commit**

```bash
git branch v23-test f4aeca50c5449ea350ec5f3fadf788ca4a039c5f
git switch v23-test
```

Verify:

```bash
git rev-parse HEAD
```

Expected initial SHA: `f4aeca50c5449ea350ec5f3fadf788ca4a039c5f`.

- [ ] **Step 2: Write a failing API isolation test**

Replace the production-host expectation in `cloudflare-production/test/api-contract.test.mjs` with a TEST-specific assertion and add:

```js
test('v23 TEST API contract never points at Production Supabase', () => {
  assert.equal(CURRENT_API.origin, 'https://lcnwccnkkxaosxnfvjvr.supabase.co');
  assert.equal(JSON.stringify(CURRENT_API).includes('dkefzepiiudehhzbbrjn'), false);
});
```

- [ ] **Step 3: Write a failing Wrangler isolation test**

Create `cloudflare-production/test/test-environment.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const wrangler = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');

test('v23 TEST deploy targets only the dedicated Worker', () => {
  assert.match(wrangler, /"name"\s*:\s*"ciao-web-v23-test"/);
  assert.doesNotMatch(wrangler, /"name"\s*:\s*"ciao-web-app"/);
});
```

- [ ] **Step 4: Run the two tests and verify they fail before implementation**

```bash
cd cloudflare-production
node --test test/api-contract.test.mjs test/test-environment.test.mjs
```

Expected: failures mention Production Supabase origin and/or `ciao-web-app` Worker name.

- [ ] **Step 5: Retarget the API contract to TEST Supabase**

In `cloudflare-production/src/modular/data/api-contract.mjs`, set:

```js
const PROJECT_ORIGIN = 'https://lcnwccnkkxaosxnfvjvr.supabase.co';
```

Keep function slugs unchanged unless Task 3 proves a TEST-specific slug is necessary.

- [ ] **Step 6: Retarget Wrangler identity to the new TEST Worker**

In `cloudflare-production/wrangler.jsonc`, change only the Worker identity:

```json
"name": "ciao-web-v23-test"
```

Do not modify Production `main`; this file change exists only on `v23-test`.

- [ ] **Step 7: Run the isolation tests again**

```bash
node --test test/api-contract.test.mjs test/test-environment.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit frontend isolation**

```bash
git add cloudflare-production/wrangler.jsonc \
        cloudflare-production/src/modular/data/api-contract.mjs \
        cloudflare-production/test/api-contract.test.mjs \
        cloudflare-production/test/test-environment.test.mjs
git commit -m "chore: isolate v23 test frontend"
```

---

### Task 3: Recreate the minimum Supabase schema and deploy only v23 backend functions

**Files:**
- Create: `supabase-v23-test/migrations/20260906_v23_test_schema.sql`
- Create: `supabase-v23-test/README.md`
- Update: `docs/superpowers/artifacts/v23-test-backend-manifest.md` with deployed object status.

**Interfaces:**
- Consumes: Task 1 backend manifest and current Production source of the six v23 Edge Functions.
- Produces: a functional isolated TEST backend in `lcnwccnkkxaosxnfvjvr` supporting all CURRENT_API reads/writes required for Telegram smoke.

- [ ] **Step 1: Generate schema SQL only for manifest objects**

Build `supabase-v23-test/migrations/20260906_v23_test_schema.sql` from metadata for required objects only. The file must contain explicit `create table`, constraints, indexes, views/RPC definitions, and RLS/policies required by the six functions.

The migration must not contain any `insert` into tables classified `test-generated`.

- [ ] **Step 2: Add only approved reference seeds**

For every `reference-seed` object from Task 1, append explicit deterministic inserts to the same migration or a clearly named seed section. Every seed row must be non-user reference data.

Do not copy rows from profile, prediction, favorite, user-ranking, notification, token, or auth-linked tables.

- [ ] **Step 3: Apply the migration to TEST Supabase only**

Apply `20260906_v23_test_schema.sql` to project `lcnwccnkkxaosxnfvjvr`.

Expected: all required objects exist in TEST; Production project is untouched.

- [ ] **Step 4: Deploy exactly the six Edge Functions to TEST**

Deploy current source from Production for:

```text
ciao-core-api-fast-v6
ciao-match-center-fast-v3
ciao-club-profile-fast
ciao-live-snapshot-v1
ciao-schedule-fast-v1
ciao-prediction-insights-v1
```

Preserve each function's current auth mode only when its source implements the same Telegram/custom auth contract as Production; otherwise enable JWT verification and update the client contract accordingly before continuing.

- [ ] **Step 5: Configure TEST-only secrets outside Git**

Set required provider/API secrets in `lcnwccnkkxaosxnfvjvr`. Do not commit secret values to `supabase-v23-test`, GitHub Actions, or artifacts.

- [ ] **Step 6: Verify function inventory**

List Edge Functions for `lcnwccnkkxaosxnfvjvr`.

Expected: the six required v23 functions are active. Unrelated Production functions are not required.

- [ ] **Step 7: Verify empty user state before smoke**

For every table classified `test-generated`, run only a count query:

```sql
select count(*) from public.<table_name>;
```

Expected before Telegram smoke: `0` unless the old TEST project already contained TEST-only rows; any pre-existing rows must be reviewed and cleared before button activation.

- [ ] **Step 8: Commit migration documentation**

```bash
git add supabase-v23-test docs/superpowers/artifacts/v23-test-backend-manifest.md
git commit -m "feat: define isolated v23 test backend"
```

---

### Task 4: Run deterministic frontend/backend verification before any Cloudflare deployment

**Files:**
- Modify only if tests reveal a defect on `v23-test`.

**Interfaces:**
- Consumes: isolated frontend config from Task 2 and TEST Supabase backend from Task 3.
- Produces: a release candidate safe to create as a new Cloudflare Worker.

- [ ] **Step 1: Run the full Node test suite**

```bash
cd cloudflare-production
npm install --no-audit --no-fund
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Build the v23 artifact**

```bash
npm run build
```

Expected: `dist/index.html` plus modular assets are produced successfully.

- [ ] **Step 3: Run existing API/build probes**

```bash
npm run probe:api
npm run probe:build
```

Expected: both commands exit 0.

- [ ] **Step 4: Validate Cloudflare bundle without publishing**

```bash
npx wrangler deploy --dry-run
```

Expected: bundle identifies `ciao-web-v23-test`, not `ciao-web-app`.

- [ ] **Step 5: Scan the built artifact for Production Supabase leakage**

```bash
if grep -R "dkefzepiiudehhzbbrjn" dist; then
  echo "Production Supabase reference found in TEST build" >&2
  exit 1
fi
```

Expected: no match.

- [ ] **Step 6: Commit any verification-only corrections**

If no code changes were necessary, do not create an empty commit. If fixes were required, commit each independently with a message naming the defect.

---

### Task 5: Create the new Cloudflare Worker and connect the new Telegram TEST button

**Files:**
- Update: `docs/superpowers/artifacts/v23-test-release-checklist.md`
- No Production code changes.

**Interfaces:**
- Consumes: verified `v23-test` branch and TEST Supabase backend.
- Produces: live `https://ciao-web-v23-test.ciao-web.workers.dev/` and Telegram button `🧪 Ciao v23 TEST`.

- [ ] **Step 1: Push/update `v23-test` in GitHub**

Verify the branch contains all Task 2–4 commits and that `main` still points at the stable rollback tree.

- [ ] **Step 2: Perform the one-time Cloudflare Dashboard setup**

Create/connect a Worker using exactly:

```text
Repository: godievda-pixel/ciao-pronostici
Branch: v23-test
Root directory: cloudflare-production
Build command: npm test && npm run build
Deploy command: npm run deploy
Worker name: ciao-web-v23-test
```

Do not edit the existing `ciao-web-app` Worker.

- [ ] **Step 3: Verify the first Cloudflare deployment**

Expected live URL:

```text
https://ciao-web-v23-test.ciao-web.workers.dev/
```

Confirm the deployment commit equals the current `v23-test` HEAD.

- [ ] **Step 4: Verify live artifact isolation**

Fetch the TEST root and confirm it contains the v23 modular marker and does not contain the Production Supabase project ref `dkefzepiiudehhzbbrjn`.

- [ ] **Step 5: Configure the Telegram TEST entry**

Replace the obsolete TEST button with:

```text
🧪 Ciao v23 TEST
```

Target exactly:

```text
https://ciao-web-v23-test.ciao-web.workers.dev/
```

Keep `⚽ Открыть Ciao, Web!` unchanged.

- [ ] **Step 6: Perform authenticated write isolation smoke**

From the new Telegram TEST button:
1. Open Profile and allow Telegram profile synchronization.
2. Save one TEST prediction on an open fixture.
3. Change/set favorite club if the UI allows it.

Then query only TEST Supabase `lcnwccnkkxaosxnfvjvr` and confirm the TEST user's rows exist there. Query Production only by counts/keys necessary to prove those TEST writes did not appear in `dkefzepiiudehhzbbrjn`.

- [ ] **Step 7: Record release checklist**

Create `docs/superpowers/artifacts/v23-test-release-checklist.md` containing:

```markdown
- [x] TEST Worker: ciao-web-v23-test
- [x] TEST Supabase: lcnwccnkkxaosxnfvjvr
- [x] No Production Supabase URL in TEST build
- [x] Cloudflare deploy success
- [x] Telegram button points to TEST Worker
- [x] TEST write smoke isolated from Production
- [ ] User full UI smoke approved
```

- [ ] **Step 8: Commit the checklist**

```bash
git add docs/superpowers/artifacts/v23-test-release-checklist.md
git commit -m "docs: record v23 test release gate"
```

---

### Task 6: User acceptance and version workflow for future releases

**Files:**
- Create: `docs/VERSION_WORKFLOW.md`

**Interfaces:**
- Consumes: working v23 TEST environment.
- Produces: a repeatable release policy preventing untested versions from reaching Production.

- [ ] **Step 1: Run the real Telegram acceptance matrix**

User checks through `🧪 Ciao v23 TEST`:

```text
Главная
Прогнозы
Рейтинг
Матчи
Таблицы
Профиль
Match Center: Serie A
Match Center: Coppa Italia
Match Center: UCL
Match Center: UEL
Match Center: UECL
Visible Back
Telegram/system Back
Subview/tournament/scroll state restoration
Prediction save
Profile synchronization
Favorite club
```

Every defect is fixed only on `v23-test` and rechecked there.

- [ ] **Step 2: Document the future version workflow**

Create `docs/VERSION_WORKFLOW.md` with this exact lifecycle:

```text
feature work -> v23-test -> Cloudflare TEST + Supabase TEST -> Telegram user acceptance -> explicit approval -> clean Production promotion -> post-deploy smoke
```

State explicitly that automated tests alone never authorize Production publication.

- [ ] **Step 3: Commit workflow documentation**

```bash
git add docs/VERSION_WORKFLOW.md
git commit -m "docs: define tested version promotion workflow"
```

- [ ] **Step 4: Stop before Production promotion**

Do not merge or copy v23 into `main` until the user explicitly says to publish the tested version.
