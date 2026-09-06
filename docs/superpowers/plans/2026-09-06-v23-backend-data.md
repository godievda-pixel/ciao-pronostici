# Ciao, Web! v23 Backend & Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone v23 backend contract on TEST that normalizes all supported football data, enforces Italian-club-only European match rules, preserves existing user/prediction data, and exposes one consistent API to the new frontend.

**Architecture:** `ciao-v23-api` remains the only public backend entry point. Internally it is split into focused domain/services/provider modules; the frontend never talks to BSD or legacy APIs. Existing production-shaped tables remain intact and are wrapped by compatibility repositories so v22.5 rollback stays possible; new schema is additive only.

**Tech Stack:** Supabase Edge Functions (Deno), JavaScript ES modules, Supabase Postgres, BSD Football API v2, Node 22 `node:test` for contract/domain tests.

**Spec:** `docs/superpowers/specs/2026-09-06-v23-standalone-app-design.md`

## Global Constraints

- Work only on branch `v23-test` until an explicit production release decision.
- TEST Supabase project is `lcnwccnkkxaosxnfvjvr`; production Supabase must never be referenced by TEST runtime code.
- Public backend entry point is only `ciao-v23-api`.
- Supported competition IDs are exactly `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`.
- UCL/UEL/UECL match data is valid only when at least one club is Italian; qualifying/preliminary rounds are excluded.
- Full UCL/UEL/UECL standings are allowed to contain every team.
- User-facing club, competition and stage names are Russian only.
- Scoring stays `5 / 3 / 2 / 0`; prediction deadline stays exactly 15 minutes before kickoff.
- Kickoff is stored/transported as UTC ISO 8601. Local timezone conversion belongs to the frontend.
- Existing `cp_users`, `cp_predictions`, `cp_competition_predictions`, `cp_matches`, `cp_teams`, `cp_rounds` data must not be deleted or rewritten destructively.
- Telegram ID remains the stable user identity; mutable Telegram profile fields sync on authenticated requests.
- Any schema migration in this plan must be additive and idempotent.

---

## File Structure Locked by This Plan

Create focused modules under `supabase/functions/ciao-v23-api/`:

- `domain/competitions.mjs` — competition registry, scopes and stage policy.
- `domain/match.mjs` — canonical `Match` normalization and eligibility rules.
- `domain/scoring.mjs` — score validation, deadline and points.
- `domain/localization.mjs` — Russian competition/stage/team-name contract.
- `repositories/users.mjs` — user/profile/favorite/settings reads and writes.
- `repositories/predictions.mjs` — compatibility facade over legacy Serie A and external prediction tables.
- `services/matches.mjs` — match list, today, favorite-next-match, standings and Match Center orchestration.
- `services/predictions.mjs` — available predictions, mine, save and eligibility enforcement.
- `services/ranking.mjs` — `all`, `italy`, `europe` aggregation.
- `services/profile.mjs` — profile sync and settings.
- `router.mjs` — request action validation and dispatch.
- `index.ts` — auth/CORS/environment composition only.

Keep `bsd-modular-provider.mjs` temporarily as the provider implementation, but refactor its public shape to the interfaces below. Remove old `modular-actions.mjs` / `modular-runtime.mjs` only after the new API tests pass and no imports remain.

New migrations:

- `supabase/migrations/20260906220000_v23_localization.sql`
- `supabase/migrations/20260906221000_v23_profile_settings.sql`

New tests under `cloudflare-production/test/`:

- `v23-domain-competitions.test.mjs`
- `v23-domain-match.test.mjs`
- `v23-domain-scoring.test.mjs`
- `v23-localization-contract.test.mjs`
- `v23-prediction-repository.test.mjs`
- `v23-ranking-service.test.mjs`
- `v23-api-router.test.mjs`
- `v23-profile-service.test.mjs`

---

### Task 1: Canonical competition and ranking domain

**Files:**
- Create: `supabase/functions/ciao-v23-api/domain/competitions.mjs`
- Test: `cloudflare-production/test/v23-domain-competitions.test.mjs`

**Interfaces:**
- Produces: `COMPETITIONS`, `competitionById(id)`, `rankingCompetitionIds(scope)`, `isEuropeanCompetition(id)`, `isQualificationStage(stage)`, `isCoppaVisibleStage(stage)`.

- [ ] **Step 1: Write the failing domain test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPETITIONS,
  competitionById,
  rankingCompetitionIds,
  isEuropeanCompetition,
  isQualificationStage,
  isCoppaVisibleStage,
} from '../../supabase/functions/ciao-v23-api/domain/competitions.mjs';

test('v23 competition registry is stable and Russian-labelled', () => {
  assert.deepEqual(COMPETITIONS.map(x => x.id), ['serie_a','coppa_italia','ucl','uel','uecl']);
  assert.equal(competitionById('serie_a').nameRu, 'Серия А');
  assert.equal(competitionById('coppa_italia').nameRu, 'Кубок Италии');
  assert.equal(competitionById('ucl').nameRu, 'Лига чемпионов');
  assert.equal(competitionById('uel').nameRu, 'Лига Европы');
  assert.equal(competitionById('uecl').nameRu, 'Лига конференций');
});

test('ranking scopes are exact', () => {
  assert.deepEqual(rankingCompetitionIds('all'), ['serie_a','coppa_italia','ucl','uel','uecl']);
  assert.deepEqual(rankingCompetitionIds('italy'), ['serie_a','coppa_italia']);
  assert.deepEqual(rankingCompetitionIds('europe'), ['ucl','uel','uecl']);
});

test('qualification and Coppa visibility policies are deterministic', () => {
  assert.equal(isQualificationStage('Qualifying round 3'), true);
  assert.equal(isQualificationStage('Preliminary round'), true);
  assert.equal(isQualificationStage('League phase'), false);
  assert.equal(isCoppaVisibleStage('Round of 16'), true);
  assert.equal(isCoppaVisibleStage('Quarter-finals'), true);
  assert.equal(isCoppaVisibleStage('Round of 32'), false);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run from `cloudflare-production`:

```bash
node --test test/v23-domain-competitions.test.mjs
```

Expected: FAIL because `domain/competitions.mjs` does not exist.

- [ ] **Step 3: Implement the minimal competition domain**

Use frozen registry objects. `isQualificationStage()` must match case-insensitively against `qualif`, `preliminary`, `play-off qualification`, `qualifying`. `isCoppaVisibleStage()` must normalize and allow only round of 16, quarter-final, semi-final, final equivalents.

- [ ] **Step 4: Run the focused test and then the full suite**

```bash
node --test test/v23-domain-competitions.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ciao-v23-api/domain/competitions.mjs cloudflare-production/test/v23-domain-competitions.test.mjs
git commit -m "feat: define standalone v23 competition domain"
```

---

### Task 2: Canonical Match model and Italian-only European eligibility

**Files:**
- Create: `supabase/functions/ciao-v23-api/domain/match.mjs`
- Test: `cloudflare-production/test/v23-domain-match.test.mjs`

**Interfaces:**
- Consumes: `isEuropeanCompetition`, `isQualificationStage`, `isCoppaVisibleStage`.
- Produces: `normalizeProviderMatch(raw, context)`, `isMatchEligible(match)`, `canonicalMatchId(competition, providerMatchId)`.

Canonical match shape:

```js
{
  id: 'ucl:12345',
  providerMatchId: '12345',
  competition: 'ucl',
  season: '2026/27',
  stage: 'League phase',
  round: '1',
  kickoffAt: '2026-09-12T18:45:00Z',
  status: 'scheduled',
  minute: null,
  home: { id:'10', nameProvider:'Inter', nameRu:'Интер', countryCode:'IT', crestUrl:'...' },
  away: { id:'20', nameProvider:'Liverpool', nameRu:'Ливерпуль', countryCode:'GB', crestUrl:'...' },
  score: { home:null, away:null },
  isItalianRelevant: true,
  isQualification: false,
}
```

- [ ] **Step 1: Write eligibility tests**

Include these exact cases:

```js
assert.equal(isMatchEligible(match({competition:'ucl', homeCountry:'IT', awayCountry:'GB'})), true);
assert.equal(isMatchEligible(match({competition:'ucl', homeCountry:'ES', awayCountry:'GB'})), false);
assert.equal(isMatchEligible(match({competition:'uel', homeCountry:'DE', awayCountry:'IT'})), true);
assert.equal(isMatchEligible(match({competition:'uecl', homeCountry:'IT', awayCountry:'FR', stage:'Qualifying round'})), false);
assert.equal(isMatchEligible(match({competition:'coppa_italia', stage:'Round of 32'})), false);
assert.equal(isMatchEligible(match({competition:'coppa_italia', stage:'Round of 16'})), true);
assert.equal(isMatchEligible(match({competition:'serie_a'})), true);
```

Also assert canonical IDs are prefixed exactly once.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-domain-match.test.mjs
```

- [ ] **Step 3: Implement normalization**

Rules:

```js
if (isEuropeanCompetition(match.competition)) {
  if (match.isQualification) return false;
  return match.home.countryCode === 'IT' || match.away.countryCode === 'IT';
}
if (match.competition === 'coppa_italia') return isCoppaVisibleStage(match.stage);
return true;
```

Do not infer Italian status from club names.

- [ ] **Step 4: Run focused + full tests**

```bash
node --test test/v23-domain-match.test.mjs
npm test
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ciao-v23-api/domain/match.mjs cloudflare-production/test/v23-domain-match.test.mjs
git commit -m "feat: add canonical v23 match eligibility"
```

---

### Task 3: Scoring and UTC deadline domain

**Files:**
- Create: `supabase/functions/ciao-v23-api/domain/scoring.mjs`
- Test: `cloudflare-production/test/v23-domain-scoring.test.mjs`

**Interfaces:**
- Produces: `scorePrediction(input)`, `predictionDeadlineIso(kickoffAt)`, `predictionIsOpen(kickoffAt, nowMs)`.

- [ ] **Step 1: Write tests for 5/3/2/0 and -15 minutes**

```js
assert.deepEqual(scorePrediction({predictedHome:2,predictedAway:1,finalHome:2,finalAway:1}), {points:5,resultType:'exact'});
assert.deepEqual(scorePrediction({predictedHome:3,predictedAway:1,finalHome:2,finalAway:0}), {points:3,resultType:'goal_difference'});
assert.deepEqual(scorePrediction({predictedHome:1,predictedAway:0,finalHome:3,finalAway:1}), {points:2,resultType:'outcome'});
assert.deepEqual(scorePrediction({predictedHome:0,predictedAway:1,finalHome:2,finalAway:0}), {points:0,resultType:'miss'});
assert.equal(predictionDeadlineIso('2026-09-12T18:45:00Z'), '2026-09-12T18:30:00.000Z');
assert.equal(predictionIsOpen('2026-09-12T18:45:00Z', Date.parse('2026-09-12T18:29:59Z')), true);
assert.equal(predictionIsOpen('2026-09-12T18:45:00Z', Date.parse('2026-09-12T18:30:00Z')), false);
```

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-domain-scoring.test.mjs
```

- [ ] **Step 3: Implement without timezone-local arithmetic**

Only use `Date.parse(kickoffAt)` and absolute milliseconds. Reject non-integer scores outside 0–20.

- [ ] **Step 4: Verify**

```bash
node --test test/v23-domain-scoring.test.mjs
npm test
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ciao-v23-api/domain/scoring.mjs cloudflare-production/test/v23-domain-scoring.test.mjs
git commit -m "feat: centralize v23 prediction scoring"
```

---

### Task 4: Russian localization registry and grammatical forms

**Files:**
- Create: `supabase/migrations/20260906220000_v23_localization.sql`
- Create: `supabase/functions/ciao-v23-api/domain/localization.mjs`
- Create: `supabase/functions/ciao-v23-api/scripts/audit-team-localizations.mjs`
- Test: `cloudflare-production/test/v23-localization-contract.test.mjs`

**Interfaces:**
- Produces DB table `cp_team_localizations(provider_team_id, name_ru, genitive_ru, dative_ru, prepositional_ru, aliases_ru, updated_at)`.
- Produces `localizeTeam(team, lookup)`, `localizeStage(stage)`, `localizeCompetition(id)`.

Migration must be additive:

```sql
create table if not exists public.cp_team_localizations (
  provider_team_id text primary key,
  name_ru text not null,
  genitive_ru text,
  dative_ru text,
  prepositional_ru text,
  aliases_ru text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.cp_team_localizations enable row level security;
```

Do not add public RLS policies; Edge Function uses service role.

- [ ] **Step 1: Write localization tests**

Assert competition names exactly:

```js
assert.equal(localizeCompetition('serie_a'), 'Серия А');
assert.equal(localizeCompetition('coppa_italia'), 'Кубок Италии');
assert.equal(localizeCompetition('ucl'), 'Лига чемпионов');
assert.equal(localizeCompetition('uel'), 'Лига Европы');
assert.equal(localizeCompetition('uecl'), 'Лига конференций');
assert.equal(localizeStage('Round of 16'), '1/8 финала');
assert.equal(localizeStage('Quarter-finals'), '1/4 финала');
assert.equal(localizeStage('Semi-finals'), '1/2 финала');
assert.equal(localizeStage('Final'), 'Финал');
assert.equal(localizeStage('League phase'), 'Общий этап');
```

For teams, assert missing localization throws `team_localization_missing:<id>` instead of returning English.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-localization-contract.test.mjs
```

- [ ] **Step 3: Implement localization module and migration**

`localizeTeam()` must prefer DB values and return `{id,nameRu,genitiveRu,dativeRu,prepositionalRu,crestUrl,countryCode}`. Never expose `nameProvider` to user-facing API fields.

- [ ] **Step 4: Add audit script**

The audit script accepts normalized provider teams plus localization rows and exits non-zero if any supported-current-season team lacks `name_ru`. Its output must print only team IDs/provider names, never credentials.

- [ ] **Step 5: Populate TEST localization data from current provider discovery**

Run the audit against all teams appearing in current Serie A/Coppa and all teams in full UCL/UEL/UECL standings. Add reviewed Russian names and grammatical forms to TEST DB. For indeclinable or awkward names, leave optional case columns null and use UI phrasings that do not require a case form.

- [ ] **Step 6: Verify audit returns zero missing teams**

Expected output ends with:

```text
missing_localizations=0
```

- [ ] **Step 7: Commit code + migration (not TEST data values if they contain operational IDs that should remain environment data)**

```bash
git add supabase/migrations/20260906220000_v23_localization.sql supabase/functions/ciao-v23-api/domain/localization.mjs supabase/functions/ciao-v23-api/scripts/audit-team-localizations.mjs cloudflare-production/test/v23-localization-contract.test.mjs
git commit -m "feat: add Russian v23 localization layer"
```

---

### Task 5: Refactor BSD provider to raw-provider responsibility only

**Files:**
- Modify: `supabase/functions/ciao-v23-api/bsd-modular-provider.mjs`
- Test: extend `cloudflare-production/test/provider-adapter.test.mjs` or create `v23-provider-contract.test.mjs`.

**Interfaces:**
- Produces provider methods:
  - `listMatches({competition,from,to}) -> raw event[]`
  - `getStandings({competition}) -> raw standings payload`
  - `getMatchSection({competition,providerMatchId,section}) -> raw payload`
  - `listItalianTeamIds() -> Set<string>`

- [ ] **Step 1: Write failing provider contract tests with fake fetch**

Verify league/season resolution, pagination, auth header, five Match Center section paths, and that no browser token is exposed.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-provider-contract.test.mjs
```

- [ ] **Step 3: Refactor provider**

Move filtering and Russian naming out of the provider. Provider may parse status/date/team IDs, but eligibility belongs to domain/services.

- [ ] **Step 4: Verify**

```bash
node --test test/v23-provider-contract.test.mjs
npm test
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ciao-v23-api/bsd-modular-provider.mjs cloudflare-production/test/v23-provider-contract.test.mjs
git commit -m "refactor: narrow BSD provider contract"
```

---

### Task 6: Match service for lists, today, favorite, standings and Match Center

**Files:**
- Create: `supabase/functions/ciao-v23-api/services/matches.mjs`
- Test: `cloudflare-production/test/v23-match-service.test.mjs`

**Interfaces:**
- Consumes provider + localization lookup + canonical Match domain.
- Produces:
  - `listMatches({competition,from,to})`
  - `listCalcioToday({localDateStartUtc,localDateEndUtc})`
  - `getFavoriteNextMatch({favoriteTeamProviderId,nowIso})`
  - `getStandings({competition})`
  - `getMatchCenter({competition,matchId,section})`

- [ ] **Step 1: Write service tests with fixtures**

Fixtures must include:

- `Inter–Liverpool` UCL -> present.
- `Real Madrid–Liverpool` UCL -> absent from match list.
- `Liverpool–Inter` UCL -> present.
- Juventus European qualifying match -> absent.
- UCL standings containing Real Madrid, Liverpool, Inter -> all three rows present.
- Coppa Round of 32 -> absent.
- Coppa Round of 16 -> present.

Match Center must reject an ineligible European match ID with `match_not_eligible` even if provider returns it.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-match-service.test.mjs
```

- [ ] **Step 3: Implement list and detail orchestration**

For standings: localize every row but do not apply Italian-only match filtering.

For Match Center: load overview first, normalize eligibility, reject if invalid, then load requested section.

- [ ] **Step 4: Verify focused/full suite**

```bash
node --test test/v23-match-service.test.mjs
npm test
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ciao-v23-api/services/matches.mjs cloudflare-production/test/v23-match-service.test.mjs
git commit -m "feat: add canonical v23 match service"
```

---

### Task 7: Prediction compatibility repository without data loss

**Files:**
- Create: `supabase/functions/ciao-v23-api/repositories/predictions.mjs`
- Test: `cloudflare-production/test/v23-prediction-repository.test.mjs`

**Interfaces:**
- Produces unified records from existing tables:

```js
{
  userId: 7,
  matchId: 'serie_a:101',
  competition: 'serie_a',
  predictedHome: 2,
  predictedAway: 1,
  points: 5,
  resultType: 'exact',
  lockedAt: '2026-09-12T18:30:00Z'
}
```

Methods:
- `listByUser(userId, competition?)`
- `save({userId, match, predictedHome, predictedAway, nowMs})`
- `pointsForCompetitions(competitionIds)`

- [ ] **Step 1: Write fake-DB tests**

Verify:

- Serie A reads/writes `cp_predictions`.
- Coppa/UCL/UEL/UECL reads/writes `cp_competition_predictions`.
- Returned shape is identical across both stores.
- Save at deadline or later returns `prediction_closed` without DB write.
- External match save requires an eligible canonical Match object; `isItalianRelevant:false` is rejected.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-prediction-repository.test.mjs
```

- [ ] **Step 3: Implement compatibility facade**

Do not migrate/delete historical prediction rows. Preserve legacy Serie A storage so v22.5 rollback can still read/write it.

- [ ] **Step 4: Verify**

```bash
node --test test/v23-prediction-repository.test.mjs
npm test
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ciao-v23-api/repositories/predictions.mjs cloudflare-production/test/v23-prediction-repository.test.mjs
git commit -m "feat: unify v23 prediction repository"
```

---

### Task 8: Prediction service and ranking service

**Files:**
- Create: `supabase/functions/ciao-v23-api/services/predictions.mjs`
- Create: `supabase/functions/ciao-v23-api/services/ranking.mjs`
- Test: `cloudflare-production/test/v23-prediction-service.test.mjs`
- Test: `cloudflare-production/test/v23-ranking-service.test.mjs`

**Interfaces:**
- Predictions: `available({userId,competition,nowMs})`, `mine({userId,competition})`, `save({userId,competition,matchId,home,away,nowMs})`.
- Ranking: `load({scope,currentUserId}) -> {rows:[{rank,userId,displayName,username,favoriteTeam,points,isCurrent}]}`.

- [ ] **Step 1: Write prediction service tests**

Available predictions include only open eligible matches. Mine includes saved entries even after finish. Save obtains canonical match from Match service and cannot bypass eligibility.

- [ ] **Step 2: Write ranking tests**

Fixtures:

```js
// User A: Serie A 5, Coppa 2, UCL Italian-match 3
// User B: Serie A 2, UEL Italian-match 5
```

Expected:

```js
assert.equal(allA.points, 10);
assert.equal(italyA.points, 7);
assert.equal(europeA.points, 3);
assert.equal(europeB.points, 5);
```

No points from non-Italian European fixture can enter the input because such prediction cannot be saved; additionally filter external rows by supported competition IDs.

- [ ] **Step 3: Run RED**

```bash
node --test test/v23-prediction-service.test.mjs test/v23-ranking-service.test.mjs
```

- [ ] **Step 4: Implement services**

Keep scoring server-side. Sort ranking by points desc then Russian display name for stable ties.

- [ ] **Step 5: Verify and commit**

```bash
node --test test/v23-prediction-service.test.mjs test/v23-ranking-service.test.mjs
npm test
git add supabase/functions/ciao-v23-api/services/predictions.mjs supabase/functions/ciao-v23-api/services/ranking.mjs cloudflare-production/test/v23-prediction-service.test.mjs cloudflare-production/test/v23-ranking-service.test.mjs
git commit -m "feat: add v23 prediction and ranking services"
```

---

### Task 9: Profile, favorite club and settings persistence

**Files:**
- Create: `supabase/migrations/20260906221000_v23_profile_settings.sql`
- Create: `supabase/functions/ciao-v23-api/repositories/users.mjs`
- Create: `supabase/functions/ciao-v23-api/services/profile.mjs`
- Test: `cloudflare-production/test/v23-profile-service.test.mjs`

**Interfaces:**
- `syncTelegramProfile(tgUser)` keeps `telegram_id` immutable while updating `username`/`display_name`.
- `getProfile(userId)`.
- `setFavoriteTeam(userId, teamId)` only accepts Italian clubs.
- `updateNotificationSettings(userId, patch)` for `deadline_reminders_enabled`, `lineup_notifications_enabled`, `kickoff_notifications_enabled`, `result_notifications_enabled`.

Migration may only add missing columns with defaults; use `ADD COLUMN IF NOT EXISTS`. Existing values remain unchanged.

- [ ] **Step 1: Write tests**

Verify changing Telegram first/last/username updates mutable fields but never `telegram_id`. Favorite foreign club is rejected. Partial settings patch updates only supplied flags.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-profile-service.test.mjs
```

- [ ] **Step 3: Implement repository/service and migration**

Do not expose service role or Telegram bot token.

- [ ] **Step 4: Verify**

```bash
node --test test/v23-profile-service.test.mjs
npm test
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260906221000_v23_profile_settings.sql supabase/functions/ciao-v23-api/repositories/users.mjs supabase/functions/ciao-v23-api/services/profile.mjs cloudflare-production/test/v23-profile-service.test.mjs
git commit -m "feat: add v23 profile and settings service"
```

---

### Task 10: Replace modular action router with standalone v23 API contract

**Files:**
- Create: `supabase/functions/ciao-v23-api/router.mjs`
- Modify: `supabase/functions/ciao-v23-api/index.ts`
- Test: `cloudflare-production/test/v23-api-router.test.mjs`
- Modify: `cloudflare-production/scripts/probe-current-api.mjs`

**Interfaces:**

POST actions:

```text
bootstrap
matches
calcio_today
favorite_next_match
standings
match_center
predictions_available
predictions_mine
prediction_save
ranking
profile
favorite_set
settings_update
```

Canonical envelope:

```js
{ ok:true, data:{...}, meta:{ serverTime:'2026-09-06T18:00:00.000Z', apiVersion:23 } }
```

Errors:

```js
{ ok:false, error:{ code:'prediction_closed', message:'Прогноз уже закрыт' } }
```

- [ ] **Step 1: Write router validation tests**

Check required fields, competition IDs, Match Center section names `overview|stats|events|lineups|players`, ranking scopes, score bounds, and unknown action -> 400.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-api-router.test.mjs
```

- [ ] **Step 3: Refactor `index.ts` to composition only**

`index.ts` responsibilities are limited to:

1. OPTIONS/CORS.
2. Telegram initData validation.
3. TEST allowlist/channel membership.
4. User sync.
5. Dependency construction.
6. Router dispatch.
7. JSON response.

Remove `legacyState()` and `legacyAction()` after new frontend no longer depends on them. During backend-first implementation they may remain behind a non-public compatibility switch until frontend Plan 2 Task 12 removes the switch.

- [ ] **Step 4: Update API probe**

Probe GET service metadata and authenticated contract shape without printing credentials. Assert `service === 'Ciao v23 API'`, `version === 23`, `environment === 'test'`.

- [ ] **Step 5: Run tests/probes**

```bash
npm test
npm run probe:api
```

Expected: all pass.

- [ ] **Step 6: Deploy `ciao-v23-api` to TEST Supabase and smoke GET**

Use the existing TEST project only. `verify_jwt` remains false because Telegram signature validation is implemented inside the function.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ciao-v23-api/index.ts supabase/functions/ciao-v23-api/router.mjs cloudflare-production/test/v23-api-router.test.mjs cloudflare-production/scripts/probe-current-api.mjs
git commit -m "feat: expose standalone v23 API contract"
```

---

### Task 11: Apply TEST migrations and verify data safety

**Files:**
- No new code beyond migrations already committed.

- [ ] **Step 1: Apply the two new migrations to TEST Supabase**

Apply in timestamp order.

- [ ] **Step 2: Run schema/data safety queries**

Verify:

```sql
select count(*) as users from public.cp_users;
select count(*) as serie_a_predictions from public.cp_predictions;
select count(*) as external_predictions from public.cp_competition_predictions;
select count(*) as localization_rows from public.cp_team_localizations;
```

Record counts before and after migration; user/prediction counts must be unchanged.

- [ ] **Step 3: Verify TEST access guard remains present**

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conname = 'cp_users_test_access_fk';
```

Expected: foreign key from `cp_users.telegram_id` to `cp_test_access.telegram_id`.

- [ ] **Step 4: Run Supabase security advisor**

Review new warnings. `cp_team_localizations` having RLS enabled with no public policy is intentional because only service-role Edge Functions access it. Do not weaken RLS to silence the informational lint.

- [ ] **Step 5: Execute authenticated TEST smoke from the hidden Telegram app**

Verify at minimum `bootstrap`, `matches` for each competition, `standings`, `predictions_available`, `ranking`, and one Match Center overview response.

---

## Plan 1 Completion Gate

This backend/data plan is complete only when all of the following are true:

- `npm test` passes with zero failures.
- `npm run probe:api` passes.
- `ciao-v23-api` is deployed only to TEST.
- UCL/UEL/UECL match lists contain no non-Italian fixture and no qualification fixture.
- Full European standings still include non-Italian teams.
- No API response exposes English team/tournament/stage labels in user-facing fields.
- Prediction deadline is server-enforced at exactly -15 minutes.
- Existing TEST user/prediction row counts survive migrations unchanged.
- `main` / production Worker / production Supabase remain untouched.

The next plan is `docs/superpowers/plans/2026-09-06-v23-standalone-frontend.md`.