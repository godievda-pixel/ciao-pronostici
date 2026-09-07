# Ciao, Web! v22.5 Unified Multi-Tournament Predictions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing production `Прогнозы` experience into one five-tournament prediction center with a permanent `Прогнозы | Мои прогнозы` switch, ordinary 5/3/2/0 scoring, unified Rating/Profile totals, correct live states, and a global 15-second visible-screen refresh cadence.

**Architecture:** Preserve the resolved v22.5 shell and the existing Serie A tables/API/write path. Add `cp_external_matches` + `cp_external_predictions` beside the Serie A schema, expose a focused Supabase Edge Function for authenticated external prediction state/save/settlement, reuse the already approved Cloudflare `/api/cw22/matches` normalization contract for user-facing external match snapshots, and extend the existing `ciao-core-api-fast-v4` slug to aggregate a server-side union view for Rating/Profile without changing the browser API base. Add two narrowly scoped v22.5 build-time patches: unified Predictions UI/theme and one global visible-screen refresh scheduler.

**Tech Stack:** JavaScript ES modules, TypeScript/Deno Supabase Edge Functions, PostgreSQL/Supabase migrations, Node.js built-in test runner, Cloudflare Workers + Static Assets, existing BSD-backed Matches API, existing v22.5 build-time injection.

**Spec:** `docs/superpowers/specs/2026-09-07-ciao-web-v22-5-unified-multitournament-predictions-design.md`

## Global Constraints

- Work directly on `main`; do not create implementation branches unless isolation becomes strictly necessary.
- `stable` stays at the current accepted rollback commit throughout implementation and visual review; do not move it automatically.
- The immutable archival backup branch stays untouched.
- Resolved v22.5 remains the production base; do not migrate the frontend to v23.x.
- There is one user-facing bottom-navigation prediction entry: `Прогнозы`; do not add a second visible bottom item.
- The permanent in-screen mode switch is exactly `Прогнозы | Мои прогнозы`.
- Competition keys remain exactly `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`.
- Serie A keeps `cp_rounds`, `cp_matches`, `cp_predictions` and the existing save path.
- External tournaments use a separate storage layer keyed by `(competition, provider_event_id)`.
- Coppa Italia prediction scope starts at Round of 32 / `1/16`.
- UCL / UEL / UECL show only matches containing at least one Italian club, exactly as approved in `Матчи`.
- Prediction deadline is server-authoritative `kickoff_at - 15 minutes` for every competition.
- Scoring is only 5 / 3 / 2 / 0: exact score / correct goal difference / correct outcome / miss.
- x2 is not part of the active product. No new x2 UI, storage, API response or multiplier is allowed.
- External tournament match cards never open Match Center. Serie A may keep its existing Match Center behavior.
- Italian clubs may open the existing local club profile; foreign clubs remain non-clickable.
- External match identity, saved predictions and points survive provider date/stage/name corrections.
- Browser JavaScript never receives `BSD_API_KEY`, Supabase service-role credentials, Telegram bot token or cron secret.
- Browser JavaScript never writes prediction tables directly; writes go through the authenticated application API.
- Current visible application data refreshes every 15,000 ms; hidden/background Mini App polling pauses and visibility return triggers an immediate refresh.
- Refresh must never clear an unsaved score draft.
- Do not run all tabs' APIs in parallel; refresh only the current visible screen/resource.
- Temporary provider/API refresh failure preserves the last successfully rendered state.
- Feature-gate external predictions until schema, API, settlement and final HTML checks are green.
- Production completion requires deployed verification plus the user's visual approval before any `stable` promotion.

---

## File Structure Locked by This Plan

### Database / Supabase

- `supabase/migrations/20260907_ciao_external_predictions.sql` — external match/prediction tables, RLS, indexes, feature flag, unified result view, private runtime-secret storage.
- `supabase/migrations/20260907_ciao_external_predictions_cron.sql` — idempotent five-minute background sync/settlement schedule.
- `supabase/functions/ciao-external-predictions/domain.mjs` — pure score/deadline/stable-ID/result-signature helpers.
- `supabase/functions/ciao-external-predictions/auth.mjs` — Telegram init-data validation, channel membership and `cp_users` resolution.
- `supabase/functions/ciao-external-predictions/service.mjs` — external state/save/snapshot/settlement business logic with injected repository/provider interfaces.
- `supabase/functions/ciao-external-predictions/index.ts` — Deno HTTP/CORS/Supabase wiring for `state`, `save_predictions`, `sync_due`, `health`.
- `supabase/functions/ciao-core-api-fast-v4/standings.mjs` — pure unified standings/stat calculation from the union result view.
- `supabase/functions/ciao-core-api-fast-v4/index.ts` — tracked source of the current production slug, modified only for unified totals and complete x2 disconnection.

### Production frontend / Cloudflare

- `cloudflare-production/src/matches/normalizer.mjs` — extend canonical status model with halftime, extra time and penalties.
- `cloudflare-production/scripts/multitournament-runtime.mjs` — keep approved Matches behavior, expose a quiet visible-screen refresh hook and remove its private 30-second timer.
- `cloudflare-production/scripts/multitournament-card-theme.mjs` — render `ПЕРЕРЫВ`, `ДОП. ВРЕМЯ`, `ПЕНАЛЬТИ` consistently.
- `cloudflare-production/scripts/multitournament-predictions-runtime.mjs` — unified Predictions state, hub, mode switch, Serie A/external card rendering, draft/save logic, club/Match Center boundaries, quiet refresh hook.
- `cloudflare-production/scripts/multitournament-predictions-theme.mjs` — Predictions hub/tournament/card CSS using the approved Matches tournament palette.
- `cloudflare-production/scripts/global-refresh-runtime.mjs` — one 15-second scheduler for the visible screen with hidden-state pause, immediate resume and overlap/stale guards.
- `cloudflare-production/scripts/build.mjs` — inject and validate the new prediction/theme/refresh patches after the approved Matches layers.

### Tests

- `cloudflare-production/test/external-predictions-schema.test.mjs`
- `cloudflare-production/test/external-predictions-domain.test.mjs`
- `cloudflare-production/test/external-predictions-service.test.mjs`
- `cloudflare-production/test/core-unified-rating.test.mjs`
- `cloudflare-production/test/multitournament-predictions-runtime.test.mjs`
- `cloudflare-production/test/multitournament-predictions-theme.test.mjs`
- `cloudflare-production/test/global-refresh-runtime.test.mjs`
- modify existing `matches-core.test.mjs`, `multitournament-card-theme.test.mjs`, `multitournament-runtime.test.mjs`, `build.test.mjs`.

---

### Task 1: External Prediction Schema, Unified Result View, and x2 Safety Audit

**Files:**
- Create: `supabase/migrations/20260907_ciao_external_predictions.sql`
- Create: `cloudflare-production/test/external-predictions-schema.test.mjs`

**Interfaces:**
- Produces tables `public.cp_external_matches`, `public.cp_external_predictions`.
- Produces view `public.cp_prediction_results_unified` consumed by Task 5.
- Produces feature flag `external_predictions_v1=false` consumed by Task 3.
- Produces private cron token row in `ciao_private.external_runtime_secrets` consumed by Task 4.

- [ ] **Step 1: Re-run the historical x2 audit before any write**

Run through Supabase SQL:

```sql
select count(*) as calculated,
       count(*) filter (
         where base_points is not null
           and points is distinct from base_points
       ) as different_from_base
from public.cp_predictions
where points is not null;
```

Expected from the design-time audit on 2026-09-07: `calculated = 588`, `different_from_base = 0`.

If `different_from_base` is not zero at execution time, stop only the historical-normalization/x2 cleanup part of Task 5 and inspect those rows before changing any historical points. Continue schema work because the new external model never uses x2.

- [ ] **Step 2: Write the RED schema-contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path = new URL('../../supabase/migrations/20260907_ciao_external_predictions.sql', import.meta.url);

test('external prediction migration defines isolated RLS-protected storage and unified view', async () => {
  const sql = await readFile(path, 'utf8');
  for (const fragment of [
    'create table public.cp_external_matches',
    'create table public.cp_external_predictions',
    'unique (competition, provider_event_id)',
    'unique (user_id, external_match_id)',
    'enable row level security',
    'create or replace view public.cp_prediction_results_unified',
    "'external_predictions_v1'",
  ]) assert.ok(sql.toLowerCase().includes(fragment.toLowerCase()), fragment);
});
```

- [ ] **Step 3: Run the test and witness RED**

```bash
cd cloudflare-production
node --test test/external-predictions-schema.test.mjs
```

Expected: FAIL with `ENOENT` for the new migration.

- [ ] **Step 4: Create the migration with the exact storage contract**

Use this schema shape:

```sql
create table public.cp_external_matches (
  id bigint generated by default as identity primary key,
  competition text not null check (competition in ('coppa_italia','ucl','uel','uecl')),
  provider text not null default 'bsd' check (provider = 'bsd'),
  provider_event_id bigint not null,
  stage_key text not null,
  stage_label text not null,
  stage_order integer not null,
  round_number integer,
  kickoff_at timestamptz not null,
  status text not null check (status in ('scheduled','live','halftime','extra_time','penalties','finished','postponed','cancelled')),
  minute integer,
  home_bsd_team_id bigint,
  home_name text not null,
  home_country_code text not null default '',
  home_crest_url text not null default '',
  away_bsd_team_id bigint,
  away_name text not null,
  away_country_code text not null default '',
  away_crest_url text not null default '',
  home_score integer,
  away_score integer,
  provider_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  finalized_at timestamptz,
  result_signature text,
  unique (competition, provider_event_id)
);

create table public.cp_external_predictions (
  id bigint generated by default as identity primary key,
  user_id bigint not null references public.cp_users(id),
  external_match_id bigint not null references public.cp_external_matches(id),
  home_score integer not null check (home_score between 0 and 20),
  away_score integer not null check (away_score between 0 and 20),
  points integer check (points is null or points in (0,2,3,5)),
  base_points integer check (base_points is null or base_points in (0,2,3,5)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  calculated_at timestamptz,
  unique (user_id, external_match_id)
);

alter table public.cp_external_matches enable row level security;
alter table public.cp_external_predictions enable row level security;
```

Add indexes on `(competition, kickoff_at)`, `(status, kickoff_at)`, `cp_external_predictions(user_id)` and `cp_external_predictions(external_match_id)`.

Do not create anon/authenticated table policies. These tables are service-only; service-role Edge Functions bypass RLS.

- [ ] **Step 5: Add the unified server-side result view**

The view shape is:

```sql
create or replace view public.cp_prediction_results_unified
with (security_invoker = true) as
select
  p.user_id,
  'serie_a'::text as competition,
  'serie_a:' || p.match_id::text as prediction_key,
  m.kickoff_at,
  r.number as serie_a_round_number,
  p.points,
  p.base_points
from public.cp_predictions p
join public.cp_matches m on m.id = p.match_id
join public.cp_rounds r on r.id = m.round_id
where p.points is not null
union all
select
  p.user_id,
  m.competition,
  m.competition || ':' || m.provider_event_id::text as prediction_key,
  m.kickoff_at,
  null::integer as serie_a_round_number,
  p.points,
  p.base_points
from public.cp_external_predictions p
join public.cp_external_matches m on m.id = p.external_match_id
where p.points is not null;
```

Grant only what the existing server-side `service_role` needs. The browser does not query the view directly.

- [ ] **Step 6: Add feature flag and generated private cron token**

```sql
insert into public.cp_feature_flags(key, enabled, config)
values ('external_predictions_v1', false, '{}'::jsonb)
on conflict (key) do update set enabled = false, updated_at = now();

create schema if not exists ciao_private;
revoke all on schema ciao_private from public, anon, authenticated;
grant usage on schema ciao_private to service_role;

create table if not exists ciao_private.external_runtime_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

revoke all on ciao_private.external_runtime_secrets from public, anon, authenticated;
grant select on ciao_private.external_runtime_secrets to service_role;

insert into ciao_private.external_runtime_secrets(key, value)
values ('cron_token', gen_random_uuid()::text || gen_random_uuid()::text)
on conflict (key) do nothing;
```

- [ ] **Step 7: Run local contract test, apply migration, and verify database shape**

```bash
node --test test/external-predictions-schema.test.mjs
```

Expected: PASS.

Apply with Supabase migration tooling, then verify:

```sql
select relname, relrowsecurity
from pg_class
where relname in ('cp_external_matches','cp_external_predictions');

select key, enabled
from public.cp_feature_flags
where key='external_predictions_v1';
```

Expected: both `relrowsecurity=true`; feature flag `enabled=false`.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260907_ciao_external_predictions.sql cloudflare-production/test/external-predictions-schema.test.mjs
git commit -m "feat: add external prediction storage"
```

---

### Task 2: Pure External Prediction Rules — Stable IDs, Deadline, Scoring, Settlement Signature

**Files:**
- Create: `supabase/functions/ciao-external-predictions/domain.mjs`
- Create: `cloudflare-production/test/external-predictions-domain.test.mjs`

**Interfaces:**
- Produces `parseExternalMatchId(matchId)`.
- Produces `predictionDeadlineAt(kickoffAt)`.
- Produces `isPredictionOpen(match, nowMs)`.
- Produces `scorePrediction(prediction, result, rules)`.
- Produces `resultSignature(match)`.
- Produces `toExternalMatchRow(match)`.

- [ ] **Step 1: Write RED rule tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExternalMatchId,
  predictionDeadlineAt,
  isPredictionOpen,
  scorePrediction,
  resultSignature,
} from '../../supabase/functions/ciao-external-predictions/domain.mjs';

const rules={exact_score:5,correct_goal_difference:3,correct_outcome:2,miss:0};

test('stable external match id keeps competition separate from BSD event id',()=>{
  assert.deepEqual(parseExternalMatchId('ucl:600983'),{competition:'ucl',providerEventId:600983});
  assert.equal(parseExternalMatchId('serie_a:12'),null);
});

test('deadline closes exactly fifteen minutes before kickoff',()=>{
  assert.equal(predictionDeadlineAt('2026-09-15T19:00:00Z'),'2026-09-15T18:45:00.000Z');
  const match={kickoffAt:'2026-09-15T19:00:00Z',status:'scheduled'};
  assert.equal(isPredictionOpen(match,Date.parse('2026-09-15T18:44:59Z')),true);
  assert.equal(isPredictionOpen(match,Date.parse('2026-09-15T18:45:00Z')),false);
});

test('score uses only 5/3/2/0',()=>{
  assert.equal(scorePrediction({homeScore:2,awayScore:1},{homeScore:2,awayScore:1},rules),5);
  assert.equal(scorePrediction({homeScore:2,awayScore:1},{homeScore:3,awayScore:2},rules),3);
  assert.equal(scorePrediction({homeScore:1,awayScore:0},{homeScore:3,awayScore:1},rules),2);
  assert.equal(scorePrediction({homeScore:0,awayScore:1},{homeScore:3,awayScore:1},rules),0);
});
```

Add tests proving `halftime`, `extra_time`, `penalties`, `live`, `finished` are never editable, invalid kickoff is closed, scores outside 0–20 are rejected by a shared validator, and `resultSignature()` changes if a finalized score is corrected.

- [ ] **Step 2: Witness RED**

```bash
node --test test/external-predictions-domain.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the minimal pure domain**

Use:

```js
export const EXTERNAL_COMPETITIONS=Object.freeze(new Set(['coppa_italia','ucl','uel','uecl']));
export const LOCK_MS=15*60*1000;

export function isPredictionOpen(match,nowMs=Date.now()){
  if(match?.status!=='scheduled') return false;
  const kickoff=Date.parse(match?.kickoffAt||match?.kickoff_at||'');
  return Number.isFinite(kickoff) && nowMs < kickoff-LOCK_MS;
}
```

`scorePrediction()` compares exact score first, then goal difference, then outcome sign, otherwise miss. It returns only one of the numeric rule values and never reads a bonus multiplier.

`resultSignature()` returns an empty string unless `status==='finished'` and both canonical scores are integers; otherwise return exactly `finished:<home>:<away>`.

`toExternalMatchRow()` maps canonical Cloudflare match fields to the Task 1 table columns while preserving `(competition, sourceId)` identity.

- [ ] **Step 4: Verify GREEN**

```bash
node --test test/external-predictions-domain.test.mjs
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ciao-external-predictions/domain.mjs cloudflare-production/test/external-predictions-domain.test.mjs
git commit -m "feat: add external prediction rules"
```

---

### Task 3: Authenticated External Prediction Service and Edge Function

**Files:**
- Create: `supabase/functions/ciao-external-predictions/auth.mjs`
- Create: `supabase/functions/ciao-external-predictions/service.mjs`
- Create: `supabase/functions/ciao-external-predictions/index.ts`
- Create: `cloudflare-production/test/external-predictions-service.test.mjs`

**Interfaces:**
- `authorizeTelegramRequest(req,{db,botToken,fetchImpl}): Promise<{user,telegramUser}>`.
- `createExternalPredictionService({repository,fetchMatches,now}): {state,savePredictions,syncDue}`.
- Browser actions:
  - `{action:'state', competition}`.
  - `{action:'save_predictions', competition, predictions:[{match_id,home_score,away_score}]}`.
- Server action: `{action:'sync_due'}` with `x-ciao-cron-token`.
- Health: GET returns `{ok:true,service:'ciao-external-predictions',version:1}` without user data.

- [ ] **Step 1: Write RED service tests with fake repository/provider**

Cover these exact cases:

1. `state('ucl')` fetches normalized production matches, upserts snapshots, settles a newly finished result, attaches only the current user's saved predictions and computes `open/deadline_at` server-side.
2. If provider refresh fails but DB has a last-good competition snapshot, `state` returns that snapshot with `stale:true` instead of blanking the screen.
3. `save_predictions` accepts two open matches, rejects a third that crossed the deadline, and returns `{saved:2,closed:['ucl:<id>']}` without rolling back the valid two.
4. A client-supplied unknown match ID cannot be inserted.
5. A client cannot save a `coppa_italia` ID while requesting `ucl`.
6. Rescheduled kickoff uses the freshly synchronized server snapshot before validating the deadline.
7. Re-running settlement with the same `result_signature` does not add points or duplicate rows.
8. If a final score changes, the new signature causes every saved prediction on that match to be overwritten with recalculated 5/3/2/0 values.

Use a fake provider that returns canonical match objects shaped exactly like `/api/cw22/matches`.

- [ ] **Step 2: Witness RED**

```bash
node --test test/external-predictions-service.test.mjs
```

Expected: module missing.

- [ ] **Step 3: Implement Telegram authorization in `auth.mjs`**

Use the current production algorithm already deployed in Ciao:

- validate Telegram WebApp HMAC-SHA256 using `TELEGRAM_BOT_TOKEN`;
- require `auth_date` within 24 hours;
- require a valid Telegram user ID;
- call `getChatMember` for `@CiaoCalcio`;
- accept only `member`, `administrator`, `creator`;
- resolve/upsert `cp_users` by `telegram_id` using service-role DB access;
- never return the bot token or Telegram validation material in an error.

Keep a short in-process membership/user cache as the current core API does, but authorization correctness must not depend on cache availability.

- [ ] **Step 4: Implement repository methods inside `index.ts` wiring**

Repository contract passed to `service.mjs`:

```js
{
  featureEnabled(key),
  upsertMatches(canonicalMatches),
  listMatches(competition),
  findMatchesByCanonicalIds(matchIds),
  listUserPredictions(userId, externalMatchIds),
  upsertUserPredictions(rows),
  scoringRules(),
  settleFinishedMatch(externalMatchId, resultSignature, result, rules),
  cronToken(),
}
```

`settleFinishedMatch` runs in one logical operation: load predictions for the match, calculate with `scorePrediction`, update `base_points`, `points`, `calculated_at`, and persist the match `result_signature/finalized_at`. Re-running the same signature performs no additive award operation.

- [ ] **Step 5: Reuse the production Matches API as the interactive normalized source**

For user `state/save` synchronization call:

```text
https://ciao-web-app.ciao-web.workers.dev/api/cw22/matches
```

with `competition`, current-season `from/to`, `cache:'no-store'`, and the original `x-telegram-init-data` header. This keeps stage filtering, Coppa dedupe, Russian team names, Italian filtering and canonical match IDs identical to the already accepted `Матчи` tab.

For the secured `sync_due` server action, the same read-only route may be called with a non-empty internal sentinel init-data value because the Worker route exposes only normalized public match data and no user/private data. The write/settlement authority remains protected by the Edge Function cron token.

- [ ] **Step 6: Implement HTTP actions in `index.ts`**

Behavior:

```text
GET                         -> health
POST action=state           -> Telegram auth + feature flag + state
POST action=save_predictions-> Telegram auth + feature flag + authoritative resync/save
POST action=sync_due        -> cron-token auth, no Telegram user, sync all four external competitions
OPTIONS                     -> CORS preflight
other methods/actions       -> 405/400
```

CORS origins must include the current production worker origin and the existing approved GitHub Pages origin; no wildcard credential behavior.

Keep `verify_jwt=false` when deploying this function because it performs the same custom Telegram authorization model as the current Ciao functions and has a separate server-only cron-token check.

- [ ] **Step 7: Verify service tests GREEN**

```bash
node --test test/external-predictions-service.test.mjs test/external-predictions-domain.test.mjs
```

Expected: all PASS.

- [ ] **Step 8: Deploy with feature flag still OFF and smoke health**

Deploy `ciao-external-predictions` from the tracked files. Verify the deployed function version/source, then call health and expect:

```json
{"ok":true,"service":"ciao-external-predictions","version":1}
```

Do not enable `external_predictions_v1` yet.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/ciao-external-predictions cloudflare-production/test/external-predictions-service.test.mjs
git commit -m "feat: add external prediction service"
```

---

### Task 4: Background Sync and Settlement Without User Activity

**Files:**
- Create: `supabase/migrations/20260907_ciao_external_predictions_cron.sql`
- Modify: `cloudflare-production/test/external-predictions-schema.test.mjs`

**Interfaces:**
- Produces cron job `ciao-external-predictions-sync` every five minutes.
- Calls Task 3 `sync_due` with the generated private token.

- [ ] **Step 1: Extend the schema test RED for cron contract**

Assert the second migration contains:

```text
ciao-external-predictions-sync
*/5 * * * *
/functions/v1/ciao-external-predictions
x-ciao-cron-token
sync_due
```

Run the schema test and expect RED because the cron migration does not yet exist.

- [ ] **Step 2: Create an idempotent cron migration**

The migration must first unschedule an existing job with this exact name, then schedule:

```sql
select cron.schedule(
  'ciao-external-predictions-sync',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-external-predictions',
    headers := jsonb_build_object(
      'content-type','application/json',
      'x-ciao-cron-token',(
        select value
        from ciao_private.external_runtime_secrets
        where key='cron_token'
      )
    ),
    body := '{"action":"sync_due"}'::jsonb
  );
  $job$
);
```

Use the project-specific URL above; do not put the generated token itself in Git.

- [ ] **Step 3: Apply migration and prove the schedule exists once**

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname='ciao-external-predictions-sync';
```

Expected: exactly one active row, schedule `*/5 * * * *`.

- [ ] **Step 4: Trigger one secured sync through the cron path and inspect persistence**

After one invocation, verify:

```sql
select competition, count(*) as matches, max(synced_at) as last_sync
from public.cp_external_matches
group by competition
order by competition;
```

Expected: current-season snapshot rows for available competitions; no duplicate `(competition,provider_event_id)` pairs.

If no finished external match with a saved test prediction exists at execution time, settlement correctness remains covered by deterministic Task 3 tests; do not fabricate production user predictions merely to smoke this.

- [ ] **Step 5: Verify GREEN and commit**

```bash
cd cloudflare-production
node --test test/external-predictions-schema.test.mjs
```

Then:

```bash
git add supabase/migrations/20260907_ciao_external_predictions_cron.sql cloudflare-production/test/external-predictions-schema.test.mjs
git commit -m "feat: schedule external prediction settlement"
```

---

### Task 5: Unified Rating/Profile Totals and Complete x2 Disconnection in Current Core API Slug

**Files:**
- Create: `supabase/functions/ciao-core-api-fast-v4/standings.mjs`
- Create: `supabase/functions/ciao-core-api-fast-v4/index.ts`
- Create: `cloudflare-production/test/core-unified-rating.test.mjs`

**Interfaces:**
- Browser API URL remains exactly the current `ciao-core-api-fast-v4` slug.
- `state.stats` and `state.standings` become unified overall values.
- `standings_scope overall` includes every competition.
- `standings_scope month` includes every competition by kickoff month.
- `standings_scope round` remains Serie A round-specific because external competitions do not have a Serie A round number.
- Active response no longer contains `round_bonus` or usable x2 controls.

- [ ] **Step 1: Write RED pure standings tests**

Use users plus unified rows such as:

```js
const rows=[
 {user_id:1,competition:'serie_a',kickoff_at:'2026-09-01T18:00:00Z',serie_a_round_number:1,points:5,base_points:5},
 {user_id:1,competition:'ucl',kickoff_at:'2026-09-03T19:00:00Z',serie_a_round_number:null,points:3,base_points:3},
 {user_id:2,competition:'serie_a',kickoff_at:'2026-09-01T18:00:00Z',serie_a_round_number:1,points:5,base_points:5},
];
```

Assert:

- overall user 1 = 8 points;
- month `2026-09` also = 8;
- Serie A round 1 = 5, excluding UCL;
- exact/successful/calculated are aggregated correctly;
- tie break remains points desc, exact desc, display name asc;
- no multiplier or `bonus` field is required by the helper.

- [ ] **Step 2: Witness RED**

```bash
node --test test/core-unified-rating.test.mjs
```

Expected: missing standings module.

- [ ] **Step 3: Implement `standings.mjs`**

Export:

```js
buildStandings({users,predictions,teams,rules,scope,round,month,previousCutoff})
```

Filter rules:

```js
if(scope==='round') keep row.serie_a_round_number===round;
if(scope==='month') keep row.kickoff_at.slice(0,7)===month;
if(scope==='overall') keep all rows;
```

Streak sorts calculated rows newest-first by `kickoff_at`, then `prediction_key`; count consecutive positive-point rows until the first zero.

For overall trend, the previous snapshot includes unified predictions whose `kickoff_at < previousCutoff`, where `previousCutoff` is the earliest kickoff/nominal boundary of the current Serie A round. This prevents external points already earned before the current Serie A round from disappearing from the comparison baseline.

- [ ] **Step 4: Copy the currently deployed v4 source into the tracked `index.ts`, then make only bounded changes**

Starting point is the currently deployed `ciao-core-api-fast-v4` source, not an older repo experiment.

Make these exact changes:

1. import `buildStandings`;
2. `rules()` returns `exact_score`, `correct_goal_difference`, `correct_outcome`, `miss`, `deadline_minutes:15` only;
3. remove `BONUS`, `bonusState`, `setBonus`, `round_bonus` response fields and the `set_round_bonus` active route;
4. `roundSummary` reports only ordinary saved/open/closed/deadline counts;
5. `standings()` queries `cp_prediction_results_unified` instead of Serie-A-only `cp_predictions + cp_matches` joins;
6. `state.stats`, `state.standings`, `public_predictor`, `standings_scope` consume unified results;
7. keep existing notification, telemetry, favorite club, CORS and legacy Serie A save behavior unchanged.

Do not drop `cp_round_bonus_picks`; it may remain as inactive historical data. The product/API simply stops consuming it.

- [ ] **Step 5: Re-run x2 audit and verify no historical rewrite is required**

Repeat Task 1 audit immediately before deployment. If still `different_from_base=0`, no historical score update is needed. This is the expected path.

- [ ] **Step 6: Verify tests GREEN**

```bash
node --test test/core-unified-rating.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Deploy the same function slug and verify Serie A compatibility**

Deploy to `ciao-core-api-fast-v4` with `verify_jwt=false`, matching the existing custom auth architecture.

Verify:

- `state` still returns current Serie A round/matches;
- existing `save_predictions` passthrough still works;
- `rules` has 5/3/2/0 and no active bonus fields;
- overall standings query does not fail when external table is empty;
- after a deterministic external settled row exists in a controlled test fixture, overall/month totals include it exactly once.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/ciao-core-api-fast-v4 cloudflare-production/test/core-unified-rating.test.mjs
git commit -m "feat: unify prediction rating totals"
```

---

### Task 6: Canonical Halftime / Extra-Time / Penalty States Across Matches and Predictions

**Files:**
- Modify: `cloudflare-production/src/matches/normalizer.mjs`
- Modify: `cloudflare-production/test/matches-core.test.mjs`
- Modify: `cloudflare-production/scripts/multitournament-card-theme.mjs`
- Modify: `cloudflare-production/test/multitournament-card-theme.test.mjs`

**Interfaces:**
- Canonical statuses become `scheduled|live|halftime|extra_time|penalties|finished|postponed|cancelled`.
- All downstream prediction code consumes these same status strings.

- [ ] **Step 1: Add RED status fixtures**

Add provider fixtures with aliases:

```text
ht / halftime / half_time      -> halftime
et / extra_time / extra-time   -> extra_time while active
aet                            -> finished
pen_live / penalties           -> penalties while active
pen / ft / finished            -> finished
```

Assert halftime/extra-time/penalty states keep current score; only ordinary `live` exposes the standard `LIVE · N′` primary label.

- [ ] **Step 2: Run status tests RED**

```bash
node --test test/matches-core.test.mjs test/multitournament-card-theme.test.mjs
```

Expected: current `ht`, `et`, `pen_live` collapse into generic live and assertions fail.

- [ ] **Step 3: Split status sets in the normalizer**

Replace the single live bucket with dedicated alias sets. `score()` accepts `live`, `halftime`, `extra_time`, `penalties`, `finished` so the current score remains visible in all required states.

Keep `aet` and final `pen` in `finished` because they represent completed fixtures, not active periods.

- [ ] **Step 4: Update Matches card status rendering**

Primary labels:

```text
live       -> LIVE · N′
halftime   -> ПЕРЕРЫВ
extra_time -> ДОП. ВРЕМЯ
penalties  -> ПЕНАЛЬТИ
finished   -> existing final state
```

Do not append a minute to `ПЕРЕРЫВ`.

- [ ] **Step 5: Verify GREEN and commit**

```bash
node --test test/matches-core.test.mjs test/multitournament-card-theme.test.mjs test/bsd-provider.test.mjs
```

Then:

```bash
git add cloudflare-production/src/matches/normalizer.mjs cloudflare-production/scripts/multitournament-card-theme.mjs cloudflare-production/test/matches-core.test.mjs cloudflare-production/test/multitournament-card-theme.test.mjs
git commit -m "feat: add football period statuses"
```

---

### Task 7: Unified Predictions Runtime — Hub, Permanent Mode Switch, Cards, Drafts, Save, My Predictions

**Files:**
- Create: `cloudflare-production/scripts/multitournament-predictions-runtime.mjs`
- Create: `cloudflare-production/test/multitournament-predictions-runtime.test.mjs`
- Modify: `cloudflare-production/scripts/build.mjs`
- Modify: `cloudflare-production/test/build.test.mjs`

**Interfaces:**
- Produces marker `ciao-prod-multitournament-predictions-20260907`.
- Produces `injectMultitournamentPredictionsPatch(html)` and validation function.
- Runtime exposes `__cwPredRefreshVisible({quiet:true})` for Task 9.
- Uses existing runtime globals `S`, `tab`, `draft`, `api`, `render`, `bind`, `load`, `scoreOf`, `openClubProfile`, `initData` only through guarded adapters.
- External API base: `https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-external-predictions`.

- [ ] **Step 1: Write RED source/runtime contract tests**

Assert generated source contains:

- exactly five competition cards and approved keys;
- permanent buttons `Прогнозы` and `Мои прогнозы`;
- mode state independent from selected competition/stage;
- external canonical match IDs are strings and never coerced through `Number(match_id)`;
- `Сохранить прогнозы` button;
- explicit `Прогноз не сделан`;
- 15-minute copy;
- status labels `ПЕРЕРЫВ`, `ДОП. ВРЕМЯ`, `ПЕНАЛЬТИ`;
- no `x2`, `bonus_multiplier`, `set_round_bonus` strings in the new runtime source;
- no external Match Center call;
- Italian local-club bridge remains available;
- `__cwPredRefreshVisible` exists and preserves drafts.

Add a pure-source test proving switching mode does not assign/reset `__cwPredCompetition` or `__cwPredStageKey`.

- [ ] **Step 2: Witness RED**

```bash
node --test test/multitournament-predictions-runtime.test.mjs
```

Expected: missing module.

- [ ] **Step 3: Implement the runtime state machine**

Use bounded state:

```js
let __cwPredMode='edit';
let __cwPredCompetition='';
let __cwPredStageKey='';
let __cwPredExternalPayload=null;
const __cwPredExternalDraft=new Map();
let __cwPredRequestVersion=0;
let __cwPredLoading=false;
let __cwPredSaving=false;
let __cwPredError='';
```

Both legacy internal prediction states (`predict` and `mine`) render the same unified prediction center. The visible bottom `Прогнозы` entry remains the only user-facing prediction nav item; do not create another button. If the resolved base still contains a hidden/legacy duplicate prediction nav node, keep it non-user-facing rather than exposing a second prediction tab.

Mode buttons change only `__cwPredMode` and call `render()`.

- [ ] **Step 4: Implement the tournament hub and persistent hierarchy**

Before competition selection:

```text
Прогнозы | Мои прогнозы
[ Серия А — full width ]
[ Кубок Италии ][ Лига Чемпионов ]
[ Лига Европы  ][ Лига Конференций ]
```

Inside a competition:

```text
Прогнозы | Мои прогнозы
← Tournament title
stage/round selector
full stage label
cards
save button only in edit mode when applicable
```

`__cwPredOpenHub()` clears selected competition/stage and external payload/draft for the departed competition. Switching mode never clears them.

- [ ] **Step 5: Implement Serie A through the existing state/write model, not external IDs**

Use `S.round.matches`, `S.rounds`, `S.selected_round`, current local numeric match IDs and the existing `api({action:'save_predictions',round,...})` path.

For edit cards, update the existing shared `draft` map via numeric local match IDs. For read-only cards use existing `prediction`, real score/live state and points from `S`.

Use the current Serie A club crest mapping already injected by the production BSD crest patch; do not add Telegram emoji dependencies.

For Serie A `Мои прогнозы`, preserve current Match Center behavior by keeping the existing production match-center binding/adapter for local match IDs. Do not attach that binding to external cards.

- [ ] **Step 6: Implement external state/load and stage grouping**

`__cwPredLoadExternal(competition,{quiet})` POSTs:

```json
{"action":"state","competition":"ucl"}
```

with `x-telegram-init-data:initData` and `cache:'no-store'`.

Stale guard uses an incrementing request version; a response may apply only if both request version and selected competition still match.

Group by canonical `stageKey/stageLabel/stageOrder`; stage chip labels mirror `Матчи`:

- UEFA league phase: digits only;
- playoff: `Стыки`;
- Coppa/knockout: `1/16`, `1/8`, `1/4`, `1/2`, `Финал`.

The full stage title remains below the selector.

- [ ] **Step 7: Implement external edit/save cards**

Each card renders team crest/name, date/device-local time, authoritative status, `− value + : − value +`, deadline state and saved indicator.

Draft key is the canonical string match ID, for example `ucl:600983`.

Saving sends only current selected-stage valid draft/saved values:

```json
{
  "action":"save_predictions",
  "competition":"ucl",
  "predictions":[
    {"match_id":"ucl:600983","home_score":2,"away_score":1}
  ]
}
```

On success, clear only successfully saved external draft keys, keep any server-reported closed match draft visible but locked, then quiet-reload authoritative state.

One match crossing its deadline must not prevent other still-open rows from being saved.

- [ ] **Step 8: Implement `Мои прогнозы` card state**

Display in this order:

1. user's prediction `2 : 1` or `Прогноз не сделан`;
2. current/final real score when available;
3. normalized status (`LIVE · N′`, `ПЕРЕРЫВ`, `ДОП. ВРЕМЯ`, `ПЕНАЛЬТИ`, final/postponed/cancelled);
4. points after settlement (`+5 очков`, `+3 очка`, `+2 очка`, `0 очков`).

External card article itself has no Match Center click handler. Only Italian team sub-controls that resolve through the existing BSD->local mapping call `openClubProfile(localId)`.

- [ ] **Step 9: Implement quiet refresh without draft loss**

`__cwPredRefreshVisible({quiet:true})`:

- external selected tournament -> quiet external `state` load, preserve `__cwPredExternalDraft`, patch/render with selected stage retained;
- Serie A -> fetch fresh `state` through existing `api` without calling the legacy `load()` path that clears `draft`; replace `S`, keep existing `draft`, keep selected round, render once;
- no selected tournament hub -> no network request.

On refresh error with an existing payload/state, leave the current UI on screen.

- [ ] **Step 10: Verify GREEN and inject after existing Matches layers**

```bash
node --test test/multitournament-predictions-runtime.test.mjs test/build.test.mjs
```

Update `build.mjs` so order is:

```text
BSD crests
-> Matches runtime
-> Matches card/theme
-> Predictions runtime
```

Validate each marker appears exactly once.

- [ ] **Step 11: Commit**

```bash
git add cloudflare-production/scripts/multitournament-predictions-runtime.mjs cloudflare-production/scripts/build.mjs cloudflare-production/test/multitournament-predictions-runtime.test.mjs cloudflare-production/test/build.test.mjs
git commit -m "feat: add unified prediction runtime"
```

---

### Task 8: Predictions Tournament Themes and Premium Card Styling

**Files:**
- Create: `cloudflare-production/scripts/multitournament-predictions-theme.mjs`
- Create: `cloudflare-production/test/multitournament-predictions-theme.test.mjs`
- Modify: `cloudflare-production/scripts/build.mjs`
- Modify: `cloudflare-production/test/build.test.mjs`

**Interfaces:**
- Produces marker `ciao-prod-multitournament-predictions-theme-20260907`.
- Reuses the same theme identities as current `Матчи` without changing the already accepted Matches layout.

- [ ] **Step 1: Write RED theme tests**

Assert source/CSS includes theme selectors for:

```text
serie-a
coppa
champions
europa
conference
```

and component classes for:

```text
mode segmented control
tournament hub 1 + 2x2 grid
competition cover/back row
round/stage chips
prediction card
score +/- controls
saved/closed indicators
my prediction/result/points
loading/error/empty state
```

Assert the theme-specific header selector disables backdrop blur when a prediction tournament theme is active, matching the mobile repaint fix already accepted in `Матчи`.

- [ ] **Step 2: Witness RED**

```bash
node --test test/multitournament-predictions-theme.test.mjs
```

Expected: missing theme module.

- [ ] **Step 3: Implement shared geometry and tournament variables**

Use the approved Matches palette:

- Serie A saturated blue;
- Coppa graphite + restrained green/red;
- UCL deep navy/indigo/violet;
- UEL near-black + orange;
- UECL dark emerald + green.

Keep one card geometry across competitions. Theme changes background, active controls and decorative lighting, not typography hierarchy or interaction placement.

Mode switch remains visually persistent at the top in every tournament.

- [ ] **Step 4: Add mobile constraints**

Required CSS behavior:

- no horizontal page scroll;
- mode control fits narrow width;
- score controls remain tappable without team names colliding;
- team names wrap/ellipsize predictably;
- stage bar may scroll horizontally inside itself;
- save button clears bottom navigation safe area;
- active tournament header background renders synchronously with `backdrop-filter:none` on the themed screen to avoid the one-frame mobile lag already fixed in Matches.

- [ ] **Step 5: Verify GREEN and injection order**

```bash
node --test test/multitournament-predictions-theme.test.mjs test/build.test.mjs
```

Final partial order becomes:

```text
... -> Predictions runtime -> Predictions theme
```

- [ ] **Step 6: Commit**

```bash
git add cloudflare-production/scripts/multitournament-predictions-theme.mjs cloudflare-production/scripts/build.mjs cloudflare-production/test/multitournament-predictions-theme.test.mjs cloudflare-production/test/build.test.mjs
git commit -m "feat: style unified prediction center"
```

---

### Task 9: One Global 15-Second Visible-Screen Refresh Scheduler

**Files:**
- Create: `cloudflare-production/scripts/global-refresh-runtime.mjs`
- Create: `cloudflare-production/test/global-refresh-runtime.test.mjs`
- Modify: `cloudflare-production/scripts/multitournament-runtime.mjs`
- Modify: `cloudflare-production/test/multitournament-runtime.test.mjs`
- Modify: `cloudflare-production/scripts/build.mjs`
- Modify: `cloudflare-production/test/build.test.mjs`

**Interfaces:**
- Produces marker `ciao-prod-global-refresh-15000-20260907`.
- Calls `__cwPredRefreshVisible({quiet:true})` for prediction screens.
- Calls an exposed `__cwMtRefreshVisible({quiet:true})` for external Matches.
- Uses existing core `api`/`refreshLive` adapters for other current visible tabs.

- [ ] **Step 1: Write RED scheduler tests**

Assert generated source contains:

- exact `15000` interval;
- `document.hidden` guard;
- `visibilitychange` listener;
- immediate refresh when document becomes visible;
- single in-flight guard;
- stale/sequence guard;
- dispatch by current visible `tab`/screen;
- no loop over all tabs;
- no `draft.clear()`;
- external Matches no longer owns a `30000` private interval.

- [ ] **Step 2: Witness RED**

```bash
node --test test/global-refresh-runtime.test.mjs test/multitournament-runtime.test.mjs
```

Expected: global scheduler module missing and Matches still contains its private 30-second timer.

- [ ] **Step 3: Convert the Matches runtime from private timer to refresh hook**

Replace `__cwMtStartRefresh/__cwMtStopRefresh` interval ownership with:

```js
async function __cwMtRefreshVisible(){
  if(tab!=='calendar'||!__cwMtCompetition||__cwMtCompetition==='serie_a') return false;
  return __cwMtLoadCompetition(__cwMtCompetition,{quiet:true});
}
```

Keep the existing stale-request protection and selected-stage preservation. Opening/closing Matches no longer creates/clears its own interval.

- [ ] **Step 4: Implement central scheduler dispatch**

Pseudo-contract:

```js
const __CW_REFRESH_MS=15000;
let __cwRefreshBusy=false;
let __cwRefreshTimer=0;
let __cwRefreshSeq=0;

async function __cwRefreshVisibleNow(){
  if(document.hidden||__cwRefreshBusy) return false;
  __cwRefreshBusy=true;
  const seq=++__cwRefreshSeq;
  try{
    if(tab==='predict'||tab==='mine') return await __cwPredRefreshVisible({quiet:true});
    if(tab==='calendar'&&typeof __cwMtRefreshVisible==='function'){
      const handled=await __cwMtRefreshVisible({quiet:true});
      if(handled) return true;
    }
    // For current core screens, refresh current state/live data only.
    return await __cwRefreshCurrentCoreScreen(seq);
  } finally { if(seq===__cwRefreshSeq)__cwRefreshBusy=false; }
}
```

`__cwRefreshCurrentCoreScreen` behavior:

- `predict/mine` is already handled above;
- external `calendar` is handled above;
- Serie A calendar/tables/live-capable views call the existing `refreshLive()` first;
- `table`, `seriea`, `profile` refresh the current `state`/specific current resource through existing `api` functions and render only that visible view;
- duplicate legacy 30-second callbacks are coalesced by a `lastStartedAt` guard so they cannot create an extra overlapping request burst.

- [ ] **Step 5: Install visibility lifecycle**

On startup:

```js
setInterval(__cwRefreshVisibleNow,15000)
```

On `visibilitychange`:

- hidden -> interval callback becomes no-op;
- visible -> call `__cwRefreshVisibleNow()` immediately, then continue the 15-second cadence.

Do not reload the whole document and do not reset selected tournament/stage/round.

- [ ] **Step 6: Add regression test for unsaved drafts**

The test source must prove the global scheduler never calls `draft.clear()` and that prediction refresh delegates to Task 7's draft-preserving hook.

- [ ] **Step 7: Verify GREEN and final injection order**

```bash
node --test test/global-refresh-runtime.test.mjs test/multitournament-runtime.test.mjs test/multitournament-predictions-runtime.test.mjs test/build.test.mjs
```

Final order:

```text
BSD crests
-> Matches runtime
-> Matches theme
-> Predictions runtime
-> Predictions theme
-> Global 15s refresh
```

- [ ] **Step 8: Commit**

```bash
git add cloudflare-production/scripts/global-refresh-runtime.mjs cloudflare-production/scripts/multitournament-runtime.mjs cloudflare-production/scripts/build.mjs cloudflare-production/test/global-refresh-runtime.test.mjs cloudflare-production/test/multitournament-runtime.test.mjs cloudflare-production/test/build.test.mjs
git commit -m "feat: refresh visible app data every 15 seconds"
```

---

### Task 10: Full Regression, Feature Enablement, Production Deployment and Visual Acceptance Gate

**Files:**
- Modify only if verification exposes a real defect in files from Tasks 1–9.
- `cloudflare-production/DEPLOY_TRIGGER` may be touched only if the existing Cloudflare integration requires an explicit deploy trigger after a verified commit.

**Interfaces:**
- Enables `cp_feature_flags.external_predictions_v1` only after backend and final HTML checks pass.
- Does not move `stable`.

- [ ] **Step 1: Run the full local production suite from a clean checkout of current `main`**

```bash
cd cloudflare-production
npm test
npm run build
```

Expected: every Node test PASS and production build exits 0.

Then verify the generated HTML contains each patch marker exactly once and still contains the existing no-x2 marker.

- [ ] **Step 2: Run database safety checks**

```sql
select count(*) filter (where points is distinct from base_points and base_points is not null) as x2_like_rows
from public.cp_predictions
where points is not null;

select competition, provider_event_id, count(*)
from public.cp_external_matches
group by competition, provider_event_id
having count(*) > 1;

select user_id, external_match_id, count(*)
from public.cp_external_predictions
group by user_id, external_match_id
having count(*) > 1;
```

Expected: all three checks return zero problematic rows/groups.

- [ ] **Step 3: Verify backend deployment before exposing UI**

Check:

1. `ciao-external-predictions` deployed source/version matches repo.
2. `ciao-core-api-fast-v4` deployed source/version matches repo.
3. cron job exists once and is active.
4. external sync has populated current snapshots.
5. current Serie A `state` remains healthy.
6. external health endpoint is healthy.

- [ ] **Step 4: Enable the feature flag**

Only after Steps 1–3 are green:

```sql
update public.cp_feature_flags
set enabled=true, updated_at=now()
where key='external_predictions_v1';
```

Read it back and verify exactly one enabled row.

- [ ] **Step 5: Deploy/allow Cloudflare production build from `main`**

Wait for the configured Cloudflare production integration to finish. Verify production root and `/healthz` return HTTP 200 and the new generated markers are present in the served HTML.

Do not infer deployment success from Git commit status alone.

- [ ] **Step 6: Production functional smoke — Predictions**

Verify on production/mobile-width WebView:

1. one visible bottom `Прогнозы` entry;
2. permanent `Прогнозы | Мои прогнозы` switch;
3. five tournament hub cards;
4. Serie A edit cards still save through the legacy path;
5. Coppa begins at `1/16`;
6. UCL/UEL/UECL contain only Italian-club fixtures;
7. external score save works and returns saved state after reload;
8. switching to `Мои прогнозы` preserves competition + stage;
9. `Прогноз не сделан` is explicit where appropriate;
10. external cards do not open Match Center;
11. Italian club sub-control opens existing profile;
12. foreign clubs do not imply navigation;
13. deadline locks at -15 minutes;
14. one closed match does not block another open save;
15. `ПЕРЕРЫВ`, `ДОП. ВРЕМЯ`, `ПЕНАЛЬТИ` are verified by deterministic fixture/tests if no production match is currently in that state.

- [ ] **Step 7: Production functional smoke — unified totals and 15-second refresh**

Verify:

- settled external points appear in the same overall Rating/Profile totals as Serie A;
- month scope includes external points in the same month;
- Serie A round scope remains Serie A-specific;
- no x2 UI/control is visible or active;
- current visible screen refresh begins at 15-second cadence;
- backgrounding pauses effective network refresh;
- foregrounding refreshes immediately;
- changing unsaved score controls, waiting through at least one refresh tick, and returning focus does not erase the draft;
- selected tournament/stage does not jump during refresh;
- temporary failed refresh preserves current cards.

- [ ] **Step 8: Verify rollback refs before asking for visual approval**

Read refs and confirm:

```text
stable = 0dc28fa382d7bbdafdd428616afb310cbfcbcb30
backup-stable-v22.5-2026-09-07 = 0dc28fa382d7bbdafdd428616afb310cbfcbcb30
```

If either changed unexpectedly, stop and investigate before any acceptance claim.

- [ ] **Step 9: Ask the user for visual acceptance**

Present production for review. Do not move `stable` yet.

Only after explicit approval may a separate promotion step move `stable` to the accepted `main` commit. The immutable archive never moves.

---

## Self-Review Checklist Completed for This Plan

- Spec coverage: tournament hub, persistent mode, five themes, Serie A preservation, separate external storage, canonical IDs, -15 deadline, batch save, My Predictions, all requested match states, no external Match Center, Italian club profile bridge, unified Rating/Profile, no x2, provider failure fallback, background settlement and global 15-second refresh each map to an explicit task.
- Data ownership: Cloudflare remains the normalized external-match read source; Supabase owns prediction persistence, settlement and unified ranking; browser owns only unsaved draft state.
- ID consistency: Serie A uses existing numeric local IDs; external uses canonical string `<competition>:<BSD event id>` in API/UI and an internal bigint FK in database storage.
- Score consistency: all new calculations return only 5/3/2/0 and overwrite deterministic result state rather than adding award ledgers.
- Refresh consistency: only Task 9 owns the repeating 15-second scheduler; Matches and Predictions expose quiet hooks instead of owning separate intervals.
- Rollback consistency: every implementation task targets `main`; no task moves `stable` or the immutable archive.
- Placeholder scan: no TBD/TODO/"implement later" steps remain.
