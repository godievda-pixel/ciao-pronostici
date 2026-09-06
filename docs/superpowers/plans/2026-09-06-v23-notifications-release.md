# Ciao, Web! v23 Notifications & Production Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend-driven user notifications to v23 and promote the verified standalone TEST artifact to production without replacing or losing the existing production database, while preserving a safe rollback path to v22.5.

**Architecture:** Notifications run independently from the Mini App UI and use the same canonical match/localization services as `ciao-v23-api`. Production promotion applies only additive/idempotent migrations to the existing production Supabase, deploys the same API contract against production config, then deploys the exact tested frontend artifact. v22.5 remains available for immediate frontend rollback until v23 is explicitly declared stable.

**Tech Stack:** Supabase Postgres/Edge Functions, Telegram Bot API, scheduled invocation (Supabase Cron/pg_cron or equivalent supported scheduler), GitHub Actions, Cloudflare Workers Static Assets, Node 22 tests.

**Spec:** `docs/superpowers/specs/2026-09-06-v23-standalone-app-design.md`

**Dependencies:**
- `docs/superpowers/plans/2026-09-06-v23-backend-data.md` complete.
- `docs/superpowers/plans/2026-09-06-v23-standalone-frontend.md` complete and accepted in real Telegram TEST.

## Global Constraints

- No notification about a European match without an Italian club.
- No European qualification/preliminary notification.
- Notification text is Russian and uses centralized grammatical/localization helpers.
- Notification jobs must be idempotent: the same event must not be sent twice for the same user/event type.
- User notification preferences are authoritative and default-preserving.
- Production DB is never replaced by TEST DB and is never bulk-restored from TEST.
- Production migrations are additive/idempotent only; existing users, Telegram IDs, predictions, scores, favorites and settings survive unchanged.
- No old table/column is dropped during initial v23 release.
- Production promotion requires: green automation, production migration rehearsal, real TEST Telegram smoke, and explicit user approval.
- Production rollback must be possible by restoring the v22.5 frontend artifact/pointer without undoing additive DB migrations.

---

## File Structure Locked by This Plan

Create:

```text
supabase/functions/ciao-v23-notifications/
  index.ts
  dispatcher.mjs
  message-templates.mjs
  event-key.mjs
supabase/migrations/
  20260906222000_v23_notification_delivery.sql
cloudflare-production/test/
  v23-notification-templates.test.mjs
  v23-notification-dispatcher.test.mjs
  v23-production-migration-contract.test.mjs
  v23-release-contract.test.mjs
scripts/
  (reuse or add repository-level release verification only if existing convention requires it)
```

Modify release workflow only after TEST acceptance; do not repurpose the current TEST deployment job to deploy production automatically.

---

### Task 1: Notification delivery ledger and idempotency key

**Files:**
- Create: `supabase/migrations/20260906222000_v23_notification_delivery.sql`
- Create: `supabase/functions/ciao-v23-notifications/event-key.mjs`
- Test: `cloudflare-production/test/v23-notification-dispatcher.test.mjs`

**Interfaces:**
- DB table `cp_notification_deliveries`.
- `notificationEventKey({telegramId,type,matchId,revision}) -> string`.

Migration:

```sql
create table if not exists public.cp_notification_deliveries (
  id bigserial primary key,
  user_id bigint not null references public.cp_users(id) on delete cascade,
  event_key text not null,
  notification_type text not null check (notification_type in ('deadline','lineup','kickoff','result')),
  match_id text not null,
  sent_at timestamptz not null default now(),
  payload_fingerprint text,
  unique (user_id, event_key)
);

create index if not exists cp_notification_deliveries_match_type_idx
  on public.cp_notification_deliveries (match_id, notification_type);

alter table public.cp_notification_deliveries enable row level security;
```

- [ ] **Step 1: Write event-key tests**

The same logical event produces the same key; a changed result revision produces a different result key only when a corrected result legitimately needs another notification.

Example:

```js
assert.equal(
  notificationEventKey({telegramId:1,type:'kickoff',matchId:'serie_a:42',revision:'1'}),
  '1:kickoff:serie_a:42:1'
);
```

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-notification-dispatcher.test.mjs
```

- [ ] **Step 3: Implement deterministic key and migration**

No random UUID may determine idempotency.

- [ ] **Step 4: Verify + commit**

```bash
node --test test/v23-notification-dispatcher.test.mjs
npm test
git add supabase/migrations/20260906222000_v23_notification_delivery.sql supabase/functions/ciao-v23-notifications/event-key.mjs cloudflare-production/test/v23-notification-dispatcher.test.mjs
git commit -m "feat: add v23 notification delivery ledger"
```

---

### Task 2: Russian notification templates with grammar

**Files:**
- Create: `supabase/functions/ciao-v23-notifications/message-templates.mjs`
- Test: `cloudflare-production/test/v23-notification-templates.test.mjs`

**Interfaces:**
- `deadlineMessage({match,minutes})`
- `lineupMessage({match})`
- `kickoffMessage({match})`
- `resultMessage({match})`

- [ ] **Step 1: Write exact message tests**

Examples:

```text
До закрытия прогноза на матч «Интер — Ювентус» осталось 30 минут.
Опубликованы стартовые составы на матч «Интер — Арсенал».
Матч «Милан — Рома» начался.
«Интер» победил «Ювентус» со счётом 2:1.
```

Also cover draw copy:

```text
Матч «Интер — Милан» завершился вничью — 1:1.
```

For a team with no safe genitive/accusative case, template must use a neutral construction that needs only `nameRu`; never algorithmically invent a declension.

- [ ] **Step 2: Run RED**

```bash
node --test test/v23-notification-templates.test.mjs
```

- [ ] **Step 3: Implement templates using the shared localization contract**

Do not duplicate competition/team translation dictionaries inside notification function.

- [ ] **Step 4: Verify + commit**

```bash
node --test test/v23-notification-templates.test.mjs
npm test
git add supabase/functions/ciao-v23-notifications/message-templates.mjs cloudflare-production/test/v23-notification-templates.test.mjs
git commit -m "feat: add Russian v23 notification copy"
```

---

### Task 3: Notification dispatcher with preference and eligibility guards

**Files:**
- Create: `supabase/functions/ciao-v23-notifications/dispatcher.mjs`
- Test: extend `cloudflare-production/test/v23-notification-dispatcher.test.mjs`

**Interfaces:**
- `createNotificationDispatcher({db,matchService,telegram,now})`
- `run({type}) -> {considered,sent,skipped,failed}`.

- [ ] **Step 1: Write deadline tests**

Deadline notifications select upcoming eligible matches and users who:
- have the matching preference enabled;
- have not already received that event key;
- are valid active users;
- can receive Telegram bot messages.

Use one deterministic deadline window, e.g. 30 minutes before prediction closure. The event is based on server UTC time, not user local timezone.

- [ ] **Step 2: Write lineup/kickoff/result tests**

European non-Italian fixture -> `sent=0` even if provider returns it.
European qualification -> `sent=0`.
Italian-relevant European fixture -> allowed.
Disabled preference -> skipped.
Existing delivery ledger row -> skipped.
Telegram send failure -> no successful delivery ledger insert.

- [ ] **Step 3: Run RED**

```bash
node --test test/v23-notification-dispatcher.test.mjs
```

- [ ] **Step 4: Implement dispatcher**

The dispatcher must obtain canonical matches through shared match service rather than direct raw BSD calls.

- [ ] **Step 5: Verify + commit**

```bash
node --test test/v23-notification-dispatcher.test.mjs
npm test
git add supabase/functions/ciao-v23-notifications/dispatcher.mjs cloudflare-production/test/v23-notification-dispatcher.test.mjs
git commit -m "feat: add v23 notification dispatcher"
```

---

### Task 4: Notification Edge Function and scheduler

**Files:**
- Create: `supabase/functions/ciao-v23-notifications/index.ts`
- Add an additive scheduler migration if Supabase project supports pg_cron invocation of Edge Functions; otherwise configure the supported Supabase scheduled function mechanism and document the exact schedule in deployment notes.
- Test: `cloudflare-production/test/v23-notification-function-contract.test.mjs`

**Interfaces:**
- Function accepts only an internal scheduler secret/header or service invocation; it is not a public user endpoint.
- Executes dispatcher types based on schedule.

- [ ] **Step 1: Write auth contract test**

Missing/invalid scheduler authorization -> 401/403 and no dispatcher call.

- [ ] **Step 2: Define schedule**

Use a frequency no faster than required by product behavior. Recommended baseline:

```text
every 5 minutes: deadline checks
every 2 minutes: lineup/kickoff/result checks while matching events are near/live
```

If the platform scheduler minimum differs, choose the nearest supported cadence and record it explicitly in the committed scheduler configuration.

- [ ] **Step 3: Implement function and TEST schedule**

TEST scheduler may be initially disabled until manual invocation proves correctness; after proof, enable only in TEST.

- [ ] **Step 4: Verify no duplicate delivery in two consecutive runs**

Run the same dispatcher twice against fixed fixtures/clock; second run must send zero additional messages.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ciao-v23-notifications cloudflare-production/test/v23-notification-function-contract.test.mjs supabase/migrations
git commit -m "feat: schedule v23 Telegram notifications"
```

---

### Task 5: Production migration contract test

**Files:**
- Create: `cloudflare-production/test/v23-production-migration-contract.test.mjs`

**Interfaces:**
- Static migration safety gate over every v23 migration file.

- [ ] **Step 1: Write migration scan test**

Reject destructive SQL patterns in v23 production-bound migrations:

```js
const forbidden = [
  /drop\s+table/i,
  /drop\s+column/i,
  /truncate\s+/i,
  /delete\s+from\s+public\.cp_(users|predictions|competition_predictions|matches|teams|rounds)/i,
];
```

Require additive constructs to use `if not exists` where PostgreSQL supports them. Allow explicit `drop constraint if exists cp_users_test_access_fk` only in a production-specific migration if and only if it removes the TEST-only whitelist constraint and does not touch data; do not reuse the TEST migration against production blindly.

- [ ] **Step 2: Add production-specific TEST-access handling design**

Production must never gain the TEST-only `cp_users_test_access_fk`. Therefore production promotion applies the functional v23 migrations but excludes `20260906183000_ciao_v23_test_access.sql`.

- [ ] **Step 3: Run test**

```bash
node --test test/v23-production-migration-contract.test.mjs
```

Expected: PASS for all production-bound migrations.

- [ ] **Step 4: Commit**

```bash
git add cloudflare-production/test/v23-production-migration-contract.test.mjs
git commit -m "test: guard v23 production migrations"
```

---

### Task 6: Rehearse production migration on an isolated schema copy/branch

**Files:**
- No production writes in this task.

- [ ] **Step 1: Capture production schema and row-count baseline**

At minimum record counts for:

```sql
select count(*) from public.cp_users;
select count(*) from public.cp_predictions;
select count(*) from public.cp_competition_predictions;
select count(*) from public.cp_matches;
select count(*) from public.cp_teams;
```

Do not copy or expose user message/content data in logs; counts and schema metadata are sufficient.

- [ ] **Step 2: Create/use an isolated Supabase development branch or disposable rehearsal project derived from production schema**

The rehearsal environment may copy schema and controlled data as permitted, but no TEST project is merged over production.

- [ ] **Step 3: Apply production-bound migrations in exact order**

Exclude the TEST whitelist migration. Apply localization/profile/notification additive migrations.

- [ ] **Step 4: Re-run row counts and compatibility queries**

All pre-existing row counts must be unchanged. Legacy v22.5-required columns/tables must remain present.

- [ ] **Step 5: Exercise v22.5-compatible read/write paths in rehearsal**

Validate existing `cp_predictions` Serie A path still works after additive v23 schema changes.

- [ ] **Step 6: Exercise v23 API against rehearsal DB**

Check bootstrap, predictions, ranking and profile sync.

- [ ] **Step 7: Record rehearsal result in a release note commit**

Create `docs/superpowers/release/v23-production-rehearsal.md` with date, migration list, before/after counts, test results, and no secrets.

---

### Task 7: Build immutable release artifact identity

**Files:**
- Create: `cloudflare-production/scripts/release-manifest.mjs`
- Test: `cloudflare-production/test/v23-release-contract.test.mjs`

**Interfaces:**
- `createReleaseManifest({gitSha,files})` returns hashes for `dist/index.html` and all `dist/v23/**` assets.

Manifest example with concrete example values:

```json
{
  "version": "23",
  "gitSha": "4e678fc3ca64a43349ea4d906ff731c8aaa0d39b",
  "files": {
    "index.html": "sha256:894a8d9c8114d73ab9fc6b5f0dbf69e6da2aa126ab77f9af2f4db96b79638845",
    "v23/app.mjs": "sha256:3cd5f36ddc8e87c7728220177e9bc4a5da1f0af39d141fe8f8a1f21b4f459f32"
  }
}
```

These hashes are format examples only; the implementation generates the actual hashes from the candidate artifact.

- [ ] **Step 1: Write deterministic manifest test**

Same built files -> same hashes. A one-byte change -> changed hash.

- [ ] **Step 2: Implement manifest generator**

No timestamp inside hash input. Timestamp may be metadata but must not prevent artifact identity comparison.

- [ ] **Step 3: Make TEST deployment publish/log manifest hash**

The exact accepted TEST artifact must be identifiable before promotion.

- [ ] **Step 4: Verify + commit**

```bash
node --test test/v23-release-contract.test.mjs
npm run build
node scripts/release-manifest.mjs
git add cloudflare-production/scripts/release-manifest.mjs cloudflare-production/test/v23-release-contract.test.mjs
git commit -m "feat: fingerprint v23 release artifact"
```

---

### Task 8: Production API preparation without switching frontend

**Files:**
- Production Supabase deployment/config only after explicit approval for the production migration/API stage.

- [ ] **Step 1: Obtain explicit user approval to begin production preparation**

Approval at this point authorizes additive DB migrations and API deployment, not frontend cutover.

- [ ] **Step 2: Capture fresh production counts immediately before migration**

Same baseline queries as rehearsal.

- [ ] **Step 3: Apply only production-bound additive migrations**

Never apply TEST access migration.

- [ ] **Step 4: Verify counts and schema immediately after migration**

Existing counts unchanged; new tables/columns exist.

- [ ] **Step 5: Deploy production `ciao-v23-api` using production secrets/config**

Do not change existing v22.5 frontend URL/button yet.

- [ ] **Step 6: Run authenticated production API smoke in a controlled way**

Read-only calls first. If a write smoke is required, use the authorized tester account and a reversible preference/favorite write, not a fabricated prediction on a live user.

- [ ] **Step 7: Deploy production notification function but keep scheduler disabled until frontend cutover approval**

This avoids user-visible behavior changes before v23 launch.

---

### Task 9: Final release gate before frontend cutover

**Files:**
- No code change unless a gate fails.

- [ ] **Step 1: Fresh CI on the exact candidate SHA**

Required:

```bash
npm test
npm run build
npm run probe:api
npm run probe:build
npx wrangler deploy --dry-run
node scripts/release-manifest.mjs
```

- [ ] **Step 2: Compare candidate manifest to accepted TEST artifact**

Hashes must match except environment-injected endpoint/config files if the architecture intentionally has environment-specific config. Any difference must be enumerated and reviewed; business/UI code must be identical.

- [ ] **Step 3: Re-run real Telegram TEST smoke**

Use the hidden TEST button and the full Plan 2 checklist.

- [ ] **Step 4: Ask for explicit production cutover approval**

Do not infer approval from earlier design approval.

---

### Task 10: Production frontend cutover

**Files:**
- Update production deployment configuration/workflow only after explicit cutover approval.

- [ ] **Step 1: Preserve current v22.5 rollback identity**

Record stable production commit/artifact/Worker version before deploying v23.

- [ ] **Step 2: Deploy the verified v23 frontend artifact to production Worker**

Do not rebuild from a different source commit during deployment; use exact candidate SHA/artifact pipeline.

- [ ] **Step 3: Confirm production endpoint serves standalone marker**

Check:

```text
data-ciao-app="v23"
```

and absence of:

```text
v22-5
legacy-surface-adapter
data-ciao-modular
```

- [ ] **Step 4: Real Telegram production smoke using authorized tester account**

Verify Home, Predictions, Ranking, Matches, Tables, Match Center, Back, local timezone, Russian names/grammar.

- [ ] **Step 5: Enable production notification scheduler only after app smoke is green**

Run one manual notification dry/controlled invocation before scheduler enablement.

---

### Task 11: Rollback drill and rollback procedure

**Files:**
- Create: `docs/superpowers/release/v23-rollback.md`

- [ ] **Step 1: Document exact rollback action**

Rollback means restoring the recorded v22.5 frontend Worker artifact/version. Do not roll back additive DB migrations unless a separately proven DB migration rollback is required.

- [ ] **Step 2: Verify v22.5 remains compatible with migrated production DB**

Use rehearsal evidence plus production read checks.

- [ ] **Step 3: Define rollback triggers**

Immediate rollback examples:

```text
blank/empty app route
Telegram auth broken for broad users
prediction save failures
wrong deadline/scoring
non-Italian European fixtures entering predictions/ranking
systemic navigation/Back failure
data corruption or unexpected user/prediction count changes
```

- [ ] **Step 4: Document post-rollback behavior**

v23-only notification scheduler must be disabled during rollback if v22.5 does not expose those settings/flows consistently. Additive tables remain; no data is deleted.

- [ ] **Step 5: Commit rollback document**

```bash
git add docs/superpowers/release/v23-rollback.md
git commit -m "docs: add v23 rollback procedure"
```

---

### Task 12: Stability window and later cleanup gate

**Files:**
- No legacy deletion in initial release.

- [ ] **Step 1: Keep v22.5 code/data compatibility during initial stability window**

Do not delete old tables/columns or old release artifact immediately after v23 launch.

- [ ] **Step 2: Monitor functional signals during normal use**

Check API errors, prediction saves, ranking consistency, live refresh, notification duplicate count, and localization-missing errors.

- [ ] **Step 3: Only after explicit later approval create a separate cleanup spec**

Legacy removal is a new architectural task. It is not part of this v23 release plan.

---

## Plan 3 Completion Gate

This plan is complete only when:

- Notifications are preference-aware, eligibility-filtered, Russian and idempotent.
- Production migrations were rehearsed before production application.
- Production user/prediction counts are preserved.
- Production never receives TEST whitelist constraint/data.
- Exact TEST candidate is fingerprinted and traceable to production deploy.
- Production cutover happened only after explicit approval.
- Real Telegram production smoke passed.
- Rollback identity/procedure is documented and viable.
- No legacy schema/table deletion occurred as part of initial v23 launch.