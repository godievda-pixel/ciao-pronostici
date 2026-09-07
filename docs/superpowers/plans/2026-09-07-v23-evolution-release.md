# Ciao, Web! v23 Evolution Production Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести принятую v22.5-based v23 из TEST в production без потери пользователей/прогнозов и с возможностью немедленного отката frontend на стабильную v22.5.

**Architecture:** Production DB остаётся существующей production Supabase и мигрируется только additive/backward-safe SQL. Тот же проверенный frontend artifact и тот же `ciao-v23-api` контракт переходят из TEST в production с environment-specific configuration. Старый v22.5 artifact сохраняется как rollback target; `cp_competition_predictions` и другие временные структуры не удаляются во время первого production релиза.

**Tech Stack:** Cloudflare Workers Static Assets, Supabase Postgres/Edge Functions, GitHub Actions, Telegram Mini App.

**Spec:** `docs/superpowers/specs/2026-09-07-v23-evolution-from-v22-5-design.md`

**Prerequisites:**
- `docs/superpowers/plans/2026-09-07-v23-evolution-foundation-data.md` GREEN.
- `docs/superpowers/plans/2026-09-07-v23-evolution-v22-5-ui.md` GREEN.
- Полный Telegram smoke через `🧪 Ciao v23 TEST` принят пользователем.
- От пользователя получено отдельное явное разрешение на production release.

## Global Constraints

- Не начинать этот план без отдельного production approval.
- Не копировать TEST Supabase поверх production.
- Не копировать TEST users/predictions в production.
- Production `cp_users` и `cp_predictions` являются источником истины.
- Миграции только additive/backward-safe.
- Не удалять старые columns/tables/functions в первом release.
- Стабильный v22.5 frontend rollback target сохраняется до отдельного решения после периода стабильности.
- Production auth identity — Telegram ID, не username/display name.
- Release artifact должен происходить из принятого TEST commit; никаких ручных production-only code edits.

---

### Task 1: Capture Production Safety Snapshot Before Any Change

**Files:**
- Create: `docs/superpowers/releases/v23-production-preflight.md`
- No production writes in this Task.

**Interfaces:**
- Produces immutable preflight evidence used after migration and for rollback decisions.

- [ ] **Step 1: Record production git/Worker baseline**

Document:

```text
stable source commit: 0dc28fa382d7bbdafdd428616afb310cbfcbcb30
stable release marker: ciao-prod-no-x2-20260903
current production Worker/version id
current production ciao-v22.5 artifact checksum
accepted TEST source commit
```

- [ ] **Step 2: Capture production DB counts with read-only SQL**

```sql
select count(*) as users from public.cp_users;
select count(*) as predictions from public.cp_predictions;
select count(*) as matches from public.cp_matches;
select count(*) as teams from public.cp_teams;
```

Also capture:

```sql
select min(id), max(id), count(*) from public.cp_users;
select min(id), max(id), count(*) from public.cp_predictions;
```

Never include personal row contents in the release document.

- [ ] **Step 3: Capture schema constraints/indexes**

Record `cp_users`, `cp_predictions`, `cp_matches` column/constraint definitions so post-migration diff can prove only planned additive changes occurred.

- [ ] **Step 4: Commit the non-sensitive preflight record**

```bash
git add docs/superpowers/releases/v23-production-preflight.md
git commit -m "docs: capture v23 production preflight"
```

---

### Task 2: Rehearse the Exact Production Migration in TEST Again

**Files:**
- Reuse: `supabase/migrations/20260907_v23_unified_predictions.sql`
- Create: `supabase/functions/ciao-v23-api/test/production-migration-contract.test.mjs`

**Interfaces:**
- Produces evidence that the same migration is idempotent and does not decrease users/old predictions.

- [ ] **Step 1: Write migration contract assertions**

Required assertions:

```text
cp_users count unchanged
pre-existing cp_predictions IDs preserved
competition default for legacy rows = serie_a
legacy match_id values preserved
new provider_match_id can coexist with null match_id
unique (user_id, competition, provider_match_id) enforced where provider id exists
second migration application is a no-op for row counts
```

- [ ] **Step 2: Run migration on TEST with before/after counts**

Apply exactly the checked-in SQL, not a copied manual variant.

- [ ] **Step 3: Apply it a second time**

Expected: success and identical counts.

- [ ] **Step 4: Run authenticated TEST smoke after the second migration**

Verify bootstrap, existing Serie A predictions, one non-Serie-A prediction, all three ranking scopes and profile identity.

- [ ] **Step 5: Commit test evidence**

```bash
git add supabase/functions/ciao-v23-api/test/production-migration-contract.test.mjs
git commit -m "test: rehearse v23 production migration"
```

---

### Task 3: Harden Database Security Findings Before Production Cutover

**Files:**
- Create: `supabase/migrations/20260907_v23_security_hardening.sql`
- Create: `docs/superpowers/releases/v23-security-check.md`

**Interfaces:**
- Consumes known advisor warning around public `SECURITY DEFINER` `public.rls_auto_enable()`.
- Produces no user-visible product change.

- [ ] **Step 1: Read current function ownership/grants before editing**

Use SQL equivalent to:

```sql
select p.oid::regprocedure::text, p.prosecdef, p.proowner::regrole::text
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname = 'rls_auto_enable';

select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema='public' and routine_name='rls_auto_enable';
```

- [ ] **Step 2: Write the hardening migration**

If the function is internal trigger/helper only, revoke public client execution:

```sql
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
```

Do not drop the function/event trigger unless independently proven unnecessary.

- [ ] **Step 3: Apply in TEST and run Supabase Security Advisor**

Expected: the specific public-executable SECURITY DEFINER warning is resolved or documented with exact remaining cause.

- [ ] **Step 4: Verify normal TEST auth/prediction flow**

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260907_v23_security_hardening.sql docs/superpowers/releases/v23-security-check.md
git commit -m "chore: harden v23 database function grants"
```

---

### Task 4: Build and Pin the Accepted Production Artifact

**Files:**
- Create/Modify: `.github/workflows/v23-production-release.yml`
- Modify only configuration/build files already tested in evolution branch.

**Interfaces:**
- Consumes accepted source commit SHA.
- Produces immutable frontend build checksum and deployable production artifact.

- [ ] **Step 1: Make workflow require explicit manual dispatch**

```yaml
on:
  workflow_dispatch:
    inputs:
      source_sha:
        description: Accepted v23 evolution commit SHA
        required: true
```

The workflow must fail unless `source_sha` equals the explicitly accepted commit documented in preflight.

- [ ] **Step 2: Build from the pinned checkout**

```yaml
- uses: actions/checkout@v4
  with:
    ref: ${{ inputs.source_sha }}
```

Run the same tests and `build:evolution` used in TEST before creating production artifact.

- [ ] **Step 3: Produce artifact checksum**

```bash
sha256sum cloudflare-production/dist/index.html > artifact.sha256
```

Upload the artifact/checksum before deployment.

- [ ] **Step 4: Add a hard production target assertion**

The production deploy step must assert Worker name is exactly `ciao-web-app`; TEST workflow must assert `ciao-web-v23-test`. A mismatch aborts.

- [ ] **Step 5: Do not deploy yet**

Workflow preparation itself may be merged; actual manual dispatch waits until Tasks 5–6 are ready and user approval remains valid.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/v23-production-release.yml
git commit -m "ci: prepare pinned v23 production release"
```

---

### Task 5: Apply Production Database Migrations with Immediate Verification

**Files:**
- Reuse checked-in migration files exactly.
- Update: `docs/superpowers/releases/v23-production-preflight.md` with non-sensitive results.

**Interfaces:**
- Produces production schema compatible with both stable v22.5 rollback frontend and new v23 evolution frontend.

- [ ] **Step 1: Reconfirm user approval immediately before first production write**

No write tool call before this confirmation.

- [ ] **Step 2: Apply unified predictions migration**

Apply `20260907_v23_unified_predictions.sql` exactly once through migration tooling.

- [ ] **Step 3: Apply security hardening migration**

Apply `20260907_v23_security_hardening.sql`.

- [ ] **Step 4: Compare before/after counts immediately**

Required:

```text
cp_users count identical
cp_predictions count >= previous count
all old cp_predictions IDs still present
old Serie A scores/points unchanged
```

If any assertion fails, stop before backend/frontend deployment.

- [ ] **Step 5: Verify new schema columns/indexes only**

No destructive column/table removals are permitted.

- [ ] **Step 6: Record results**

Do not include user-identifying data in docs.

---

### Task 6: Deploy Production `ciao-v23-api` Before the Frontend

**Files:**
- No code changes; deploy accepted backend source from pinned commit.

**Interfaces:**
- Backend must support both new v23 calls and leave existing production v22.5 behavior intact until frontend switch.

- [ ] **Step 1: Confirm production runtime env**

Required environment values exist for production origin/environment; never print secret values.

- [ ] **Step 2: Deploy the exact accepted Edge Function source**

No manual production-only patch.

- [ ] **Step 3: Smoke health/CORS/auth**

Verify production environment marker, production origin CORS, invalid Telegram auth rejection.

- [ ] **Step 4: Authenticated read-only smoke**

Use a permitted production user and verify bootstrap, one Serie A match, one relevant European match, ranking and standings without writing a prediction.

- [ ] **Step 5: Stop if old v22.5 frontend shows any regression**

Keep old frontend live until backend compatibility is confirmed.

---

### Task 7: Switch Production Frontend to the Accepted v22.5-Based v23 Artifact

**Files:**
- No source edits during release; use pinned build artifact.

**Interfaces:**
- Switches only the frontend artifact after DB/backend have passed smoke.

- [ ] **Step 1: Record current Worker version for rollback**

Keep exact version id `ROLLBACK_WORKER_VERSION` in release notes.

- [ ] **Step 2: Manually dispatch the pinned production workflow**

Input must be the accepted source SHA.

- [ ] **Step 3: Verify deployed checksum/version**

Deployed artifact checksum must equal the artifact produced before deploy.

- [ ] **Step 4: Real Telegram smoke immediately**

Required paths:

```text
login with existing Telegram ID
Home
favorite club / Calcio Today
Predictions Serie A
Predictions UCL
My Predictions
Ranking all/italy/europe
Matches all five competitions
Match Center all five tabs
Tables Serie A/UCL/UEL/UECL
Back from Match Center
local time
```

- [ ] **Step 5: Verify identity after mutable Telegram profile change**

Same Telegram ID must map to the same production `cp_users.id` and retain history. Do not require username presence.

---

### Task 8: Rollback Procedure and Post-Release Gate

**Files:**
- Create: `docs/superpowers/releases/v23-rollback-runbook.md`

**Interfaces:**
- Frontend rollback must not require reverting additive DB migrations.

- [ ] **Step 1: Document immediate frontend rollback**

```text
If severe UI/navigation/auth regression:
1. switch Cloudflare Worker back to ROLLBACK_WORKER_VERSION / stable v22.5 artifact;
2. keep additive DB columns/tables in place;
3. do not reverse migrated prediction rows destructively;
4. confirm stable v22.5 login/Serie A flows;
5. investigate on TEST branch.
```

- [ ] **Step 2: Define release-failure triggers**

Immediate rollback for:

```text
existing users cannot login
old prediction history missing
wrong points/scoring
root navigation unusable
production data count loss
systematic Telegram WebView crash
```

Block-specific external API failure alone uses graceful degradation and is not automatically a full rollback if old v22.5 core remains operational.

- [ ] **Step 3: Run one rollback rehearsal before declaring release complete**

In TEST, deploy accepted v23 artifact, switch back to stable v22.5 baseline, verify it still works against additive schema, then return to v23 TEST.

- [ ] **Step 4: Keep legacy structures**

Do not drop `cp_competition_predictions`, legacy columns or rollback compatibility during the initial stability window.

- [ ] **Step 5: Commit runbook**

```bash
git add docs/superpowers/releases/v23-rollback-runbook.md
git commit -m "docs: add v23 rollback runbook"
```

The first production release is considered complete only after user acceptance of the real Telegram production smoke. Cleanup/destructive migrations require a separate future spec and approval.
