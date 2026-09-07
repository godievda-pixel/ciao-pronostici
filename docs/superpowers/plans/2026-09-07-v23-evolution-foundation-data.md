# Ciao, Web! v23 Evolution Foundation & Unified Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять в TEST точную эволюционную копию стабильной v22.5, подключить единый BSD/backend слой, оставить одного пользователя на Telegram ID и перевести все турниры на единую таблицу `cp_predictions` без потери старых прогнозов.

**Architecture:** Frontend остаётся существующей v22.5 и единственным владельцем DOM/navigation/state. Backend `ciao-v23-api` переносится из проверенной TEST-ветки как единый data/domain слой для пяти турниров, но standalone frontend не переносится. `cp_users` остаётся единой таблицей пользователей, а `cp_predictions` безопасно расширяется до универсальной таблицы прогнозов; старые Serie A строки продолжают работать через `match_id`, новые provider-backed строки используют `competition + provider_match_id`.

**Tech Stack:** Telegram Mini App v22.5 HTML/JS/CSS, Cloudflare Workers Static Assets, Node.js 22 built-in test runner, Supabase Postgres/Edge Functions, BSD Football API v2.

**Spec:** `docs/superpowers/specs/2026-09-07-v23-evolution-from-v22-5-design.md`

## Global Constraints

- База ветки: стабильный production baseline `0dc28fa382d7bbdafdd428616afb310cbfcbcb30`.
- Рабочая ветка: `v23-evolution-test`.
- Production frontend, production Worker и production Supabase не изменять.
- TEST Worker: `ciao-web-v23-test`.
- TEST backend: `ciao-v23-api` в TEST Supabase.
- v22.5 остаётся единственным frontend runtime; не добавлять второй shell/router/state owner или overlay.
- BSD provider один для `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`.
- `cp_users` одна для всех турниров; identity key только `telegram_id` из валидированного Telegram `initData`.
- Изменение имени, фамилии или `@username` не должно менять пользователя и не должно блокировать вход.
- `cp_predictions` одна финальная таблица прогнозов для всех пяти турниров.
- Scoring строго `5 / 3 / 2 / 0`; deadline строго `kickoff - 15 минут`.
- Еврокубки: только матчи с итальянскими клубами; qualification исключены.
- Общие таблицы UCL/UEL/UECL остаются полными.
- Все миграции additive/backward-safe; `cp_competition_predictions` не удалять в этом плане.
- После каждого Task полный TEST должен оставаться пригодным для Telegram smoke.

---

## File Structure

**Frontend/deploy**
- `cloudflare-production/src/v22-5-evolution.html` — зафиксированная локальная копия стабильного v22.5 HTML; это единственный UI runtime.
- `cloudflare-production/scripts/build-evolution.mjs` — собирает TEST artifact только из локальной v22.5-копии и evolution assets.
- `cloudflare-production/wrangler.evolution-test.jsonc` — TEST-only Worker config с `name = "ciao-web-v23-test"`.
- `cloudflare-production/test/evolution-baseline.test.mjs` — запреты на standalone/overlay и проверка v22.5 markers.
- `.github/workflows/v23-evolution-test.yml` — verify + TEST deploy только для `v23-evolution-test`.

**Backend**
- `supabase/functions/ciao-v23-api/index.ts` — Telegram auth + composition root + CORS.
- `supabase/functions/ciao-v23-api/router.mjs` — единый action router.
- `supabase/functions/ciao-v23-api/bsd-provider.mjs` — единственный BSD transport/provider.
- `supabase/functions/ciao-v23-api/domain/competitions.mjs` — пять турниров и stage rules.
- `supabase/functions/ciao-v23-api/domain/match.mjs` — canonical match + eligibility.
- `supabase/functions/ciao-v23-api/domain/scoring.mjs` — `5/3/2/0` + deadline.
- `supabase/functions/ciao-v23-api/domain/localization.mjs` — русские названия/падежные формы.
- `supabase/functions/ciao-v23-api/services/matches.mjs` — единый Match Service.
- `supabase/functions/ciao-v23-api/services/predictions.mjs` — единый Prediction Service.
- `supabase/functions/ciao-v23-api/services/ranking.mjs` — scopes рейтинга.
- `supabase/functions/ciao-v23-api/services/profile.mjs` — профиль/favorite/settings.
- `supabase/functions/ciao-v23-api/repositories/predictions.mjs` — только `cp_predictions`, без runtime чтения `cp_competition_predictions`.
- `supabase/functions/ciao-v23-api/repositories/users.mjs` — lookup/update только по `telegram_id`.

**Migrations/tests**
- `supabase/migrations/20260907_v23_unified_predictions.sql` — additive schema + backfill/migration from TEST-only auxiliary table.
- `supabase/functions/ciao-v23-api/test/*.test.mjs` — domain/service/repository tests.

---

### Task 1: Freeze Stable v22.5 as the Only TEST Frontend Runtime

**Files:**
- Create: `cloudflare-production/src/v22-5-evolution.html`
- Create: `cloudflare-production/scripts/build-evolution.mjs`
- Create: `cloudflare-production/wrangler.evolution-test.jsonc`
- Create: `cloudflare-production/test/evolution-baseline.test.mjs`
- Create: `.github/workflows/v23-evolution-test.yml`
- Modify: `cloudflare-production/package.json`

**Interfaces:**
- Consumes: stable release source currently referenced by `RELEASE_SOURCE_URL` in `cloudflare-production/scripts/build.mjs`.
- Produces: `dist/index.html` built from the checked-in v22.5 source; TEST Worker target `ciao-web-v23-test`.

- [ ] **Step 1: Copy the exact stable release into the branch without editing it**

During implementation, obtain the bytes from the existing stable source URL already used by `scripts/build.mjs` and save them as `cloudflare-production/src/v22-5-evolution.html`. Record its SHA-256 in the test as a baseline constant before any feature edits.

- [ ] **Step 2: Write the failing baseline test**

Create `test/evolution-baseline.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlPath = new URL('../src/v22-5-evolution.html', import.meta.url);

test('evolution starts from the stable v22.5 no-X2 runtime', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.match(html, /ciao-prod-no-x2-20260903/);
  assert.match(html, /5 \/ 3 \/ 2 \/ 0/);
  assert.match(html, /15 минут/);
});

test('evolution frontend has no second app runtime', async () => {
  const html = await readFile(htmlPath, 'utf8');
  assert.doesNotMatch(html, /legacy-surface-adapter/);
  assert.doesNotMatch(html, /src\/v23\/app\.mjs/);
  assert.doesNotMatch(html, /modular\/app\.mjs/);
});
```

- [ ] **Step 3: Run RED**

Run from `cloudflare-production`:

```bash
npm test
```

Expected: FAIL because `src/v22-5-evolution.html` does not yet exist.

- [ ] **Step 4: Implement a local-only evolution build**

Create `scripts/build-evolution.mjs` with this boundary:

```js
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'src/v22-5-evolution.html');
const dist = resolve(root, 'dist');

export async function buildEvolution() {
  const html = await readFile(source, 'utf8');
  if (!html.includes('ciao-prod-no-x2-20260903')) throw new Error('stable_v22_5_marker_missing');
  if (/legacy-surface-adapter|modular\/app\.mjs|src\/v23\/app\.mjs/.test(html)) {
    throw new Error('second_frontend_runtime_forbidden');
  }
  await mkdir(dist, { recursive: true });
  await writeFile(resolve(dist, 'index.html'), html, 'utf8');
  return { ok: true, entry: 'dist/index.html' };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildEvolution().then(console.log).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
```

Add package scripts:

```json
{
  "scripts": {
    "test": "node --test test/*.test.mjs",
    "build": "node scripts/build.mjs",
    "build:evolution": "node scripts/build-evolution.mjs",
    "deploy:evolution-test": "npm run build:evolution && wrangler deploy --config wrangler.evolution-test.jsonc"
  }
}
```

Create `wrangler.evolution-test.jsonc`:

```jsonc
{
  "name": "ciao-web-v23-test",
  "compatibility_date": "2026-09-01",
  "assets": { "directory": "./dist" }
}
```

- [ ] **Step 5: Add branch-scoped CI**

Create `.github/workflows/v23-evolution-test.yml` with:

```yaml
name: v23 evolution TEST
on:
  push:
    branches: [v23-evolution-test]
  pull_request:
    branches: [v23-evolution-test]

jobs:
  verify:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: cloudflare-production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm install --no-audit --no-fund
      - run: npm test
      - run: npm run build:evolution
      - run: npx wrangler deploy --config wrangler.evolution-test.jsonc --dry-run

  deploy_test:
    if: github.event_name == 'push'
    needs: verify
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: cloudflare-production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm install --no-audit --no-fund
      - run: npm run build:evolution
      - run: npx wrangler deploy --config wrangler.evolution-test.jsonc
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 6: Run GREEN locally/CI**

Run:

```bash
npm test
npm run build:evolution
npx wrangler deploy --config wrangler.evolution-test.jsonc --dry-run
```

Expected: all pass; build output contains only the stable v22.5 runtime.

- [ ] **Step 7: Deploy TEST and perform visual 1:1 checkpoint**

Deploy only `ciao-web-v23-test`, then open `🧪 Ciao v23 TEST` and compare Home, Predictions, Rating, Matches/Tables/navigation against production v22.5. Do not start Task 2 until the user confirms the TEST copy looks like v22.5.

- [ ] **Step 8: Commit**

```bash
git add cloudflare-production .github/workflows/v23-evolution-test.yml
git commit -m "feat: base v23 evolution on stable v22.5"
```

---

### Task 2: Port Only the Shared v23 Backend/Data Layer

**Files:**
- Create: `supabase/functions/ciao-v23-api/index.ts`
- Create: `supabase/functions/ciao-v23-api/router.mjs`
- Create: `supabase/functions/ciao-v23-api/bsd-provider.mjs`
- Create: `supabase/functions/ciao-v23-api/domain/competitions.mjs`
- Create: `supabase/functions/ciao-v23-api/domain/match.mjs`
- Create: `supabase/functions/ciao-v23-api/domain/scoring.mjs`
- Create: `supabase/functions/ciao-v23-api/domain/localization.mjs`
- Create: `supabase/functions/ciao-v23-api/services/matches.mjs`
- Create: `supabase/functions/ciao-v23-api/test/backend-contract.test.mjs`

**Interfaces:**
- Consumes: BSD API v2, TEST Supabase service role, validated Telegram `initData`.
- Produces: one `ciao-v23-api` whose match objects use canonical fields `id`, `providerMatchId`, `competition`, `stage`, `kickoffAt`, `status`, `home`, `away`, `score`, `isItalianRelevant`, `isQualification`.

- [ ] **Step 1: Write the backend contract test before copying implementation**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProviderMatch, isMatchEligible } from '../domain/match.mjs';

const italianIds = new Set(['10']);

test('one normalizer accepts both BSD team object and string+id shapes', () => {
  const match = normalizeProviderMatch({
    id: 100,
    home_team: 'Inter',
    home_team_id: 10,
    away_team: { id: 20, name: 'Liverpool' },
    round_name: 'League phase',
  }, { competition: 'ucl', italianTeamIds: italianIds });
  assert.equal(match.home.id, '10');
  assert.equal(match.away.id, '20');
});

test('European match without an Italian club is rejected', () => {
  assert.equal(isMatchEligible({
    competition: 'ucl',
    stage: 'League phase',
    home: { countryCode: 'ES' },
    away: { countryCode: 'GB' },
  }), false);
});

test('qualification is rejected even when an Italian club participates', () => {
  assert.equal(isMatchEligible({
    competition: 'ucl',
    stage: 'Qualification',
    home: { countryCode: 'IT' },
    away: { countryCode: 'FR' },
  }), false);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
node --test supabase/functions/ciao-v23-api/test/backend-contract.test.mjs
```

Expected: FAIL because the backend files are not present on `v23-evolution-test`.

- [ ] **Step 3: Port the proven backend files from `v23-test`, not its frontend**

Use the latest verified backend implementation from `v23-test` as source material, including the fixes that:

```text
- filter favorite choices before localization;
- preserve `home_team_id` / `away_team_id` when BSD returns team names as strings;
- reject disallowed European matches server-side;
- keep full European standings unfiltered;
- centralize 5/3/2/0 scoring and -15 minute deadline.
```

Do **not** copy `cloudflare-production/src/v23/**`, standalone `app.mjs`, standalone CSS, router, store, or shell.

- [ ] **Step 4: Keep one BSD provider interface**

The provider exported contract must be:

```js
export function createBsdProvider({ apiKey, fetchImpl = fetch }) {
  return {
    listMatches: async ({ competition, season, from, to }) => {},
    getMatch: async ({ competition, providerMatchId }) => {},
    getStandings: async ({ competition, season }) => {},
    listItalianTeams: async ({ season }) => {},
  };
}
```

No competition-specific provider classes are allowed.

- [ ] **Step 5: Run GREEN**

Run the backend tests plus the existing Cloudflare tests. Expected: all pass.

- [ ] **Step 6: Deploy only TEST `ciao-v23-api` and smoke metadata/CORS/auth**

Verify:

```text
GET/health => environment=test
allowed origin => https://ciao-web-v23-test.ciao-web.workers.dev
POST without valid Telegram initData => 401 telegram_auth_required
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ciao-v23-api
git commit -m "feat: add shared BSD backend for v22.5 evolution"
```

---

### Task 3: Make `cp_predictions` the One Universal Prediction Table

**Files:**
- Create: `supabase/migrations/20260907_v23_unified_predictions.sql`
- Create: `supabase/functions/ciao-v23-api/repositories/predictions.mjs`
- Create: `supabase/functions/ciao-v23-api/test/predictions-repository.test.mjs`

**Interfaces:**
- Consumes: existing `cp_predictions` with legacy Serie A `match_id` FK; optional TEST-only data currently in `cp_competition_predictions`.
- Produces: one repository whose persisted entity is:

```ts
type PredictionRecord = {
  id: number;
  userId: number;
  competition: 'serie_a' | 'coppa_italia' | 'ucl' | 'uel' | 'uecl';
  providerMatchId: string | null;
  legacyMatchId: number | null;
  homeScore: number;
  awayScore: number;
  points: number | null;
  lockedAt: string | null;
  finalHome: number | null;
  finalAway: number | null;
  resultType: string | null;
  scoredAt: string | null;
};
```

- [ ] **Step 1: Write schema/repository RED tests**

Repository test must verify two identities coexist:

```js
test('legacy Serie A prediction remains readable by local match id', async () => {
  const row = await repo.findForUserMatch({ userId: 7, competition: 'serie_a', legacyMatchId: 99 });
  assert.equal(row.legacyMatchId, 99);
});

test('new European prediction uses competition + BSD provider id in the same table', async () => {
  const row = await repo.upsert({
    userId: 7,
    competition: 'ucl',
    providerMatchId: '12345',
    legacyMatchId: null,
    homeScore: 2,
    awayScore: 1,
    lockedAt: '2026-09-08T18:45:00Z',
  });
  assert.equal(row.competition, 'ucl');
  assert.equal(row.providerMatchId, '12345');
});
```

- [ ] **Step 2: Run RED**

Expected: repository/schema contract does not exist yet.

- [ ] **Step 3: Add the additive migration**

The migration must preserve existing columns and add:

```sql
alter table public.cp_predictions
  add column if not exists competition text not null default 'serie_a',
  add column if not exists provider_match_id text,
  add column if not exists season text,
  add column if not exists locked_at timestamptz,
  add column if not exists final_home smallint,
  add column if not exists final_away smallint,
  add column if not exists result_type text,
  add column if not exists result_fingerprint text,
  add column if not exists scored_at timestamptz;

alter table public.cp_predictions
  alter column match_id drop not null;

alter table public.cp_predictions
  add constraint cp_predictions_competition_check
  check (competition in ('serie_a','coppa_italia','ucl','uel','uecl')) not valid;

alter table public.cp_predictions
  add constraint cp_predictions_identity_check
  check (match_id is not null or provider_match_id is not null) not valid;

create unique index if not exists cp_predictions_user_provider_unique
  on public.cp_predictions (user_id, competition, provider_match_id)
  where provider_match_id is not null;
```

Before applying, the implementation must guard constraint creation with catalog checks so reruns are idempotent.

- [ ] **Step 4: Backfill existing Serie A provider IDs when mappings exist**

```sql
update public.cp_predictions p
set provider_match_id = m.bsd_event_id::text
from public.cp_matches m
where p.match_id = m.id
  and p.competition = 'serie_a'
  and p.provider_match_id is null
  and m.bsd_event_id is not null;
```

Never overwrite existing `points`, `base_points`, scores or timestamps.

- [ ] **Step 5: Migrate auxiliary TEST predictions into `cp_predictions` without dropping the old table**

If `cp_competition_predictions` exists, copy rows with `match_id` formatted as `competition:providerId`:

```sql
insert into public.cp_predictions (
  user_id, match_id, competition, provider_match_id, season,
  home_score, away_score, points, created_at, updated_at,
  locked_at, final_home, final_away, result_type, result_fingerprint, scored_at
)
select
  c.user_id,
  null,
  c.competition,
  split_part(c.match_id, ':', 2),
  c.season,
  c.predicted_home,
  c.predicted_away,
  c.points,
  c.submitted_at,
  c.updated_at,
  c.locked_at,
  c.final_home,
  c.final_away,
  c.result_type,
  c.result_fingerprint,
  c.scored_at
from public.cp_competition_predictions c
where not exists (
  select 1
  from public.cp_predictions p
  where p.user_id = c.user_id
    and p.competition = c.competition
    and p.provider_match_id = split_part(c.match_id, ':', 2)
);
```

`cp_competition_predictions` remains untouched for rollback in this phase, but no new runtime reads/writes may use it after repository cutover.

- [ ] **Step 6: Implement one repository**

Required signatures:

```js
export function createPredictionsRepository({ db }) {
  return {
    findForUserMatch: async ({ userId, competition, providerMatchId = null, legacyMatchId = null }) => {},
    listForUser: async ({ userId, competitions }) => {},
    upsert: async (prediction) => {},
    applyResult: async ({ competition, providerMatchId, finalHome, finalAway, scoredAt }) => {},
  };
}
```

The repository must query only `cp_predictions`.

- [ ] **Step 7: Verify data preservation before/after migration**

Run SQL counts before and after:

```sql
select count(*) as users from public.cp_users;
select count(*) as predictions from public.cp_predictions;
select count(*) as serie_a_predictions from public.cp_predictions where competition = 'serie_a';
```

After migration, assert:

```text
users count unchanged
old cp_predictions row count not decreased
all pre-existing cp_predictions IDs still exist
auxiliary migrated rows add to the unified table without duplicates
```

- [ ] **Step 8: Run GREEN and idempotency check**

Apply the migration twice in TEST; second run must succeed without changing row counts.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260907_v23_unified_predictions.sql \
        supabase/functions/ciao-v23-api/repositories/predictions.mjs \
        supabase/functions/ciao-v23-api/test/predictions-repository.test.mjs
git commit -m "feat: unify predictions across competitions"
```

---

### Task 4: Enforce Telegram-ID Identity and Mutable Profile Sync

**Files:**
- Create: `supabase/functions/ciao-v23-api/repositories/users.mjs`
- Create: `supabase/functions/ciao-v23-api/services/profile.mjs`
- Create: `supabase/functions/ciao-v23-api/test/user-identity.test.mjs`
- Modify: `supabase/functions/ciao-v23-api/index.ts`

**Interfaces:**
- Consumes: verified Telegram user payload `{ id, first_name, last_name?, username? }`.
- Produces: same `cp_users.id` for the same Telegram ID regardless of mutable name/username.

- [ ] **Step 1: Write the exact regression test requested by the user**

```js
test('same Telegram ID with a new name and username keeps the same account', async () => {
  const first = await users.ensureTelegramUser({
    telegramId: 446763142,
    firstName: 'Daniil',
    lastName: 'Old',
    username: 'old_name',
  });

  const second = await users.ensureTelegramUser({
    telegramId: 446763142,
    firstName: 'Даня',
    lastName: 'New',
    username: 'new_name',
  });

  assert.equal(second.id, first.id);
  assert.equal(second.telegramId, 446763142);
  assert.equal(second.username, 'new_name');
});

test('removing Telegram username does not block the account', async () => {
  const user = await users.ensureTelegramUser({
    telegramId: 446763142,
    firstName: 'Даня',
    lastName: '',
    username: null,
  });
  assert.equal(user.telegramId, 446763142);
});
```

- [ ] **Step 2: Run RED**

Expected: new repository/service absent.

- [ ] **Step 3: Implement lookup by `telegram_id` only**

Required repository signature:

```js
export function createUsersRepository({ db }) {
  return {
    ensureTelegramUser: async ({ telegramId, firstName, lastName, username }) => {},
    getByTelegramId: async (telegramId) => {},
    updateFavoriteTeam: async ({ userId, teamId }) => {},
    updateSettings: async ({ userId, patch }) => {},
  };
}
```

The SQL behavior must be equivalent to:

```sql
insert into cp_users (telegram_id, username, display_name)
values ($telegram_id, $username, $display_name)
on conflict (telegram_id) do update
set username = excluded.username,
    display_name = excluded.display_name,
    updated_at = now()
returning *;
```

Do not use `username` or `display_name` in conflict keys or access decisions.

- [ ] **Step 4: Preserve existing user state**

Test that the same row retains `favorite_team_id` and notification settings after identity sync; update only `username`, `display_name`, `updated_at`.

- [ ] **Step 5: Ensure auth order is fail-closed**

`index.ts` order must be:

```text
validate Telegram initData
-> extract telegram_id
-> TEST allowlist check
-> ensure/sync cp_users by telegram_id
-> optional channel membership check
-> route action
```

No name/username comparison may occur before user admission.

- [ ] **Step 6: Run GREEN + real TEST login smoke**

After tests pass, temporarily change the Telegram display name/username in a controlled user account or emulate the same verified payload in integration tests. Verify the existing `cp_users.id` and prediction history remain unchanged.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ciao-v23-api
git commit -m "fix: keep user identity stable across Telegram profile changes"
```

---

### Task 5: Cut Services Over to Unified Predictions and One BSD Match Service

**Files:**
- Create/Modify: `supabase/functions/ciao-v23-api/services/predictions.mjs`
- Create/Modify: `supabase/functions/ciao-v23-api/services/ranking.mjs`
- Modify: `supabase/functions/ciao-v23-api/services/matches.mjs`
- Modify: `supabase/functions/ciao-v23-api/router.mjs`
- Create: `supabase/functions/ciao-v23-api/test/unified-services.test.mjs`

**Interfaces:**
- Prediction save: `{ competition, providerMatchId, homeScore, awayScore }`.
- Ranking scopes: `all | italy | europe`.
- Match service is the single eligibility gate for new predictions.

- [ ] **Step 1: Write service RED tests**

```js
test('save rejects a UCL match without an Italian club before repository write', async () => {
  await assert.rejects(
    predictions.save({ userId: 1, competition: 'ucl', providerMatchId: '999', homeScore: 1, awayScore: 0 }),
    /match_not_available/,
  );
  assert.equal(repo.upsertCalls, 0);
});

test('ranking all aggregates one unified prediction source', async () => {
  const rows = await ranking.get({ scope: 'all' });
  assert.equal(repo.tableReads, 1);
});
```

- [ ] **Step 2: Run RED**

Expected: old dual-repository behavior fails the second assertion if copied unchanged.

- [ ] **Step 3: Implement one Prediction Service path**

Required behavior:

```js
const match = await matches.getEligibleMatch({ competition, providerMatchId });
const lockedAt = new Date(new Date(match.kickoffAt).getTime() - 15 * 60_000).toISOString();
if (Date.now() >= Date.parse(lockedAt)) throw new Error('prediction_closed');
return predictionsRepo.upsert({
  userId,
  competition,
  providerMatchId,
  legacyMatchId: match.legacyMatchId ?? null,
  homeScore,
  awayScore,
  lockedAt,
});
```

Scoring remains server-side via the shared scoring module.

- [ ] **Step 4: Implement ranking scopes over the same table**

```js
const scopeCompetitions = {
  all: ['serie_a','coppa_italia','ucl','uel','uecl'],
  italy: ['serie_a','coppa_italia'],
  europe: ['ucl','uel','uecl'],
};
```

All points come from `cp_predictions`; there is no union with `cp_competition_predictions`.

- [ ] **Step 5: Add a static regression test forbidding the auxiliary table in runtime source**

```js
assert.doesNotMatch(runtimeSource, /cp_competition_predictions/);
```

The migration file may still mention the table for one-time backfill.

- [ ] **Step 6: Run full GREEN suite and deploy TEST Edge Function**

Verify tests, then authenticated smoke for:

```text
bootstrap
predictions_available Serie A
predictions_available UCL
predictions_mine
ranking all
ranking italy
ranking europe
matches UCL
standings UCL
```

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ciao-v23-api
git commit -m "feat: use one prediction and match data path"
```

---

### Task 6: Foundation Acceptance Gate

**Files:**
- Create: `docs/superpowers/checklists/v23-evolution-foundation-acceptance.md`
- Modify only if necessary: tests/workflow files from previous tasks.

**Interfaces:**
- Produces a hard checkpoint before any new UI feature is added to v22.5.

- [ ] **Step 1: Create the acceptance checklist**

Checklist must contain exact pass/fail items:

```markdown
- [ ] TEST visually matches stable v22.5 before feature additions.
- [ ] Only one frontend runtime owns DOM/navigation.
- [ ] TEST Worker is `ciao-web-v23-test`.
- [ ] TEST API is `ciao-v23-api`.
- [ ] One BSD provider handles all five competitions.
- [ ] `cp_users.telegram_id` is the sole identity key.
- [ ] Changed name/username keeps the same `cp_users.id`.
- [ ] `cp_predictions` stores Serie A + Coppa + UCL + UEL + UECL.
- [ ] Old Serie A prediction rows remain present.
- [ ] Runtime does not read/write `cp_competition_predictions`.
- [ ] 5/3/2/0 tests pass.
- [ ] -15 minute deadline tests pass.
- [ ] European non-Italian matches are rejected.
- [ ] Qualifications are rejected.
- [ ] Production has not been modified.
```

- [ ] **Step 2: Run complete verification from a fresh checkout/worktree**

```bash
cd cloudflare-production
npm install --no-audit --no-fund
npm test
npm run build:evolution
npx wrangler deploy --config wrangler.evolution-test.jsonc --dry-run
```

Run backend tests and TEST migration idempotency separately.

- [ ] **Step 3: Real Telegram smoke**

Use `🧪 Ciao v23 TEST` and verify the app still looks/behaves like v22.5 before any UI feature expansion.

- [ ] **Step 4: Commit checklist evidence**

```bash
git add docs/superpowers/checklists/v23-evolution-foundation-acceptance.md
git commit -m "docs: verify v23 evolution foundation"
```

Do not begin the UI plan until this gate is green and manually accepted.
