# Ciao, Web! v23.3 — Durable Object Prediction Backend Design

Date: 2026-09-02
Status: Approved in chat, pending written-spec review
Target: TEST first (`develop` lineage → `ciao-web-app-test`); Production remains unchanged until explicit acceptance

## 1. Goal

Replace the unresolved legacy prediction-storage dependency with a new server-side prediction backend owned by Ciao, Web! itself.

The backend uses a Cloudflare Durable Object with SQLite storage and becomes the authoritative store for new-season predictions, scoring state, and prediction rankings in TEST.

The design covers five competitions:

- `serie_a`
- `coppa_italia`
- `ucl`
- `uel`
- `uecl`

The new prediction season starts empty. Existing legacy prediction rows are not imported into TEST.

## 2. Context and constraints

The current TEST application already runs through `ciao-web-app-test`, serves Static Assets, and has a service binding to the existing `ciao-web-api`.

The current v23.3 branch line already contains:

- normalized multi-competition match data;
- a prediction contract that validates canonical competition-prefixed match IDs, score bounds, and the server deadline boundary;
- a prediction release gate that requires an authenticated isolated persistence smoke;
- a reset contract that forbids Production reset execution during TEST work.

Those gates remain in force. This design provides the missing persistent backend that they are intended to verify.

## 3. Non-goals

This phase does not:

- switch Production to the new prediction backend;
- delete or reset Production prediction data;
- migrate legacy prediction rows into the new TEST store;
- use Supabase for prediction storage;
- use browser `localStorage` as prediction persistence;
- replace the existing Telegram authentication authority;
- change the current prediction scoring formula;
- introduce competition weighting;
- rebuild Home, Matches, Match Center, or profile data sources unrelated to predictions;
- create a separate prediction service Worker.

## 4. Architecture

Use one Durable Object class inside the Ciao, Web! TEST Worker:

```text
Telegram Mini App
  → ciao-web-app-test
      → authenticated identity resolver → ciao-web-api
      → canonical match resolver
          → ciao-web-api for Serie A
          → BSD adapter for Coppa Italia / UCL / UEL / UECL
      → PredictionLeague Durable Object
          → SQLite storage
```

The Durable Object is not exposed directly to the browser. Public API routes terminate in `ciao-web-app-test`; the Worker validates identity and match metadata before invoking the object.

### 4.1 Durable Object class

Class name:

```text
PredictionLeague
```

Binding:

```text
PREDICTION_LEAGUE
```

The class uses SQLite-backed Durable Object storage.

### 4.2 Object partitioning and active season

Use one logical object per environment and season.

Canonical object name:

```text
prediction-league:<environment>:<season>
```

Example TEST object:

```text
prediction-league:test:2026-27
```

The active prediction season is a server-side TEST configuration value:

```text
PREDICTION_SEASON=2026-27
```

The browser never supplies or selects the storage season.

For every write, the canonical match resolver also returns the match season. The write is accepted only when the canonical match season equals `PREDICTION_SEASON`; otherwise it fails with `409 season_mismatch`. This prevents a stale or malformed match from being written into the active-season object.

Read, ranking, and TEST-reset routes always address the object derived from the configured active season.

TEST and future Production must use separate Worker/Durable Object namespaces. A future Production binding is created only during a separately approved cutover. Production must never point at the TEST namespace.

This season-level partition is intentional: rankings require consistent aggregation across all participants and all five competitions in one season. The expected Ciao, Web! prediction volume is suitable for one season object; no cross-object ranking fan-out is introduced in this phase.

## 5. Ownership boundaries

### 5.1 `ciao-web-app-test` Worker

Responsibilities:

1. Require Telegram init data on prediction routes.
2. Resolve an authenticated stable user identity through the existing `ciao-web-api` authentication authority.
3. Resolve the canonical match by `competition + match_id`.
4. Derive canonical season, kickoff, prediction deadline, and match status from server-side match data.
5. Verify canonical season equals the configured active prediction season.
6. Reject malformed or mismatched requests before storage.
7. Route the operation to the active-season Durable Object.
8. Return normalized prediction/ranking responses to the frontend.
9. Keep all TEST reset guards outside and inside the Durable Object boundary.

### 5.2 `ciao-web-api`

`ciao-web-api` remains the authentication authority. It is not used as the new prediction database.

The Ciao Web Worker forwards the incoming Telegram init data to the already authenticated legacy state/auth path and extracts the stable authenticated user ID from that verified response.

The identity adapter must fail closed:

- missing init data → `401 telegram_auth_required`;
- upstream auth rejection → corresponding `401/403`;
- authenticated response without a stable user ID → `502 identity_resolution_failed`;
- no prediction write occurs on identity-resolution failure.

If the legacy response shape differs between environments, that difference is isolated in one `resolveAuthenticatedUser()` adapter. Prediction storage never trusts an unsigned client-supplied `user_id`.

### 5.3 Match providers

Match identity and deadlines are authoritative server data.

- Serie A is resolved through the existing authenticated `ciao-web-api` schedule path.
- Coppa Italia, UCL, UEL and UECL are resolved through the current BSD-backed normalized match layer in `ciao-web-app-test`.

The browser cannot choose its own kickoff timestamp, season, competition identity, or deadline.

### 5.4 Durable Object

The Durable Object owns:

- submitted prediction scores;
- timestamps;
- scoring state;
- participant display snapshots needed by prediction rankings;
- ranking snapshots when created;
- schema version metadata;
- reset/cache-generation metadata for the prediction domain.

It does not fetch third-party football data directly and does not validate Telegram init data itself.

## 6. Canonical identity

### 6.1 User identity

Internal user key:

```text
telegram:<stable_authenticated_id>
```

The raw Telegram init payload is never stored.

A minimal participant snapshot may be stored for rankings:

```text
user_id
display_name
username
updated_at
```

Only fields already supplied by the authenticated identity layer are used. Missing username is allowed. If the authenticated identity has no usable display name, the normalized display name is `Участник` rather than accepting arbitrary client text.

### 6.2 Match identity

Canonical match IDs keep the existing competition prefix rule:

```text
<competition>:<provider-stable-id>
```

Examples:

```text
serie_a:12345
ucl:67890
```

A write whose `match_id` prefix does not match `competition_key` is rejected before it reaches SQLite.

### 6.3 Prediction identity

One user has at most one current prediction per match.

Unique key:

```text
(user_id, match_id)
```

`prediction_id` is generated server-side on first insert with `crypto.randomUUID()` and is preserved on later edits.

Submitting again before the deadline updates the existing record rather than creating a duplicate.

## 7. SQLite schema

The first schema contains four tables.

### 7.1 `schema_meta`

```text
key TEXT PRIMARY KEY
value TEXT NOT NULL
```

Required keys include:

```text
schema_version
environment
season
prediction_cache_generation
```

### 7.2 `participants`

```text
user_id TEXT PRIMARY KEY
display_name TEXT NOT NULL
username TEXT
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
```

### 7.3 `predictions`

```text
prediction_id TEXT PRIMARY KEY
user_id TEXT NOT NULL
match_id TEXT NOT NULL
competition TEXT NOT NULL
season TEXT NOT NULL
predicted_home INTEGER NOT NULL
predicted_away INTEGER NOT NULL
submitted_at TEXT NOT NULL
updated_at TEXT NOT NULL
locked_at TEXT NOT NULL
points INTEGER
result_type TEXT
final_home INTEGER
final_away INTEGER
result_fingerprint TEXT
scored_at TEXT
UNIQUE(user_id, match_id)
```

Constraints enforced by application validation and SQL checks:

- score values are integers from `0` through `20`;
- competition is one of the five supported competition keys;
- prediction season equals the season object metadata;
- `points` remains null until an authoritative finished result is scored.

Recommended indexes:

```text
(user_id, competition)
(competition, match_id)
(competition, points)
(scored_at)
```

### 7.4 `ranking_snapshots`

```text
snapshot_id TEXT PRIMARY KEY
scope TEXT NOT NULL
period_key TEXT NOT NULL
created_at TEXT NOT NULL
payload_json TEXT NOT NULL
UNIQUE(scope, period_key)
```

Scope values are exactly:

```text
overall
competition:<competition_key>
```

Snapshots exist only for ranking movement/history. The live ranking itself is derived from prediction rows and is not maintained as a separate mutable total.

## 8. Prediction deadline and locking

The existing rule remains authoritative:

```text
prediction_deadline = kickoff_at - 15 minutes
```

A submission is accepted only when all conditions are true:

1. authenticated user identity is valid;
2. canonical match exists;
3. match competition matches the requested competition;
4. canonical match season equals `PREDICTION_SEASON`;
5. canonical match status is not `live` or `finished`;
6. server time is strictly earlier than the canonical deadline.

Boundary behavior is exact:

```text
now < deadline  → allowed
now >= deadline → rejected
```

HTTP response for a closed prediction:

```text
409 prediction_locked
```

The server never uses client time.

If a scheduled kickoff is officially changed before the match starts, the current canonical kickoff becomes authoritative. A later postponed kickoff can reopen editing only while the match remains scheduled and server time is earlier than the newly derived deadline. A live or finished match never reopens.

The stored `locked_at` is the canonical deadline that applied to the latest accepted write.

## 9. Write path

Public route:

```text
POST /api/v23.3/predictions
```

Request shape preserves the existing v23.3 contract:

```json
{
  "competition_key": "ucl",
  "predictions": [
    {
      "match_id": "ucl:67890",
      "home_score": 2,
      "away_score": 1
    }
  ]
}
```

Flow:

```text
request
→ validate Telegram authentication
→ normalize request contract
→ resolve each canonical match
→ derive season/deadline/status
→ verify season equals PREDICTION_SEASON
→ Durable Object transaction
→ upsert participant snapshot
→ insert/update prediction rows
→ return normalized saved rows
```

Because all writes target the configured active-season object, a request batch is one Durable Object transaction. If any requested prediction in the batch fails validation, no row from that batch is written.

The response returns the authoritative stored values, including `prediction_id`, `updated_at`, and `locked_at`.

## 10. Read paths

### 10.1 Current user's predictions

```text
GET /api/v23.3/predictions?competition=<key|all>
```

Returns only the authenticated user's prediction rows from `PREDICTION_SEASON`.

### 10.2 Available predictions

```text
GET /api/v23.3/predictions/available?competition=<key|all>
```

Availability is calculated from canonical match data for `PREDICTION_SEASON` and joined with the authenticated user's stored predictions.

The Durable Object is not the schedule source.

### 10.3 Rankings

```text
GET /api/v23.3/rankings?scope=<overall|competition>&competition=<key>
```

For `scope=competition`, `competition` is required and must be one of the five supported keys.

Competition scope aggregates only scored predictions for that competition.

Overall scope aggregates all five competitions with equal weight and ignores the optional `competition` query field if it is supplied.

### 10.4 Current-user ranking summary

```text
GET /api/v23.3/rankings/me
```

Returns position, total points, scored prediction count, exact-score count, correct-outcome count, and per-competition point split for the configured active season.

## 11. Scoring

The scoring formula is not redesigned.

Implementation extracts or reuses the existing canonical Serie A scorer and proves parity with existing fixtures before the Durable Object can pass the prediction release gate.

Scoring input:

```text
predicted_home
predicted_away
final_home
final_away
```

Stored scoring output:

```text
points
result_type
final_home
final_away
result_fingerprint
scored_at
```

### 11.1 Idempotency

Scoring is idempotent.

For every authoritative finished result, the Worker computes a stable `result_fingerprint` from match identity plus final score/result version.

- same fingerprint → already scored; do nothing;
- new fingerprint → recompute affected prediction rows transactionally.

This protects against duplicate reconciliation requests and allows an upstream corrected final score to be repaired deterministically without double-counting.

### 11.2 Reconciliation strategy

The first release uses request-driven reconciliation rather than introducing another scheduled service.

Before returning ranking/result-dependent views, `ciao-web-app-test` resolves recently finished relevant matches from the configured active season and asks the season Durable Object to reconcile any unscored or changed result fingerprints.

A later Cron/Alarm optimization is allowed but is not required for initial acceptance.

## 12. Rankings

Ranking totals are derived from prediction rows:

```text
competition_points = SUM(points WHERE competition = selected_competition)
overall_points = SUM(points across all five competitions)
```

No competition multiplier is applied.

Tie ordering for the first release is deterministic:

1. total points descending;
2. exact scores descending;
3. correct outcomes descending;
4. scored predictions ascending;
5. stable user ID ascending as a final non-display tie breaker.

Only users with at least one submitted prediction in the requested ranking scope appear.

Ranking movement uses `ranking_snapshots` and follows the previously approved v23.2 period definitions. Snapshot generation occurs when a completed period is first observed; duplicate period snapshots are prevented by the unique `(scope, period_key)` constraint.

## 13. TEST reset

A real reset capability is added only for the TEST prediction store.

Route:

```text
POST /api/v23.3/test/predictions/reset
```

Reset always targets the active `PREDICTION_SEASON`; the client cannot choose an arbitrary season or object ID.

Execution requires all of the following:

1. request host exactly matches `ciao-web-app-test.ciao-web.workers.dev`;
2. configured environment is exactly `test`;
3. `TEST_RESET_TOKEN` is configured server-side;
4. request header `x-ciao-test-reset-token` exactly matches the configured token;
5. derived Durable Object name starts with `prediction-league:test:`;
6. derived season equals `PREDICTION_SEASON`.

If any guard fails, the reset is rejected without mutation.

The reset transaction:

- deletes all rows from `predictions` for the target TEST season object;
- deletes `ranking_snapshots`;
- deletes participant snapshots after prediction deletion;
- increments `prediction_cache_generation` so any prediction-domain in-memory/read cache is invalidated;
- preserves `schema_meta` environment/season/schema-version keys.

The reset response continues to use the existing reset-contract stage names:

```text
predictions → prediction rows deleted
points      → scored prediction rows invalidated by the same prediction deletion
ranking     → ranking snapshots deleted
caches      → prediction_cache_generation incremented
```

The operation does not touch football schedules, BSD data, `ciao-web-api`, Telegram authorization, Static Assets, or any Production data.

No Production reset endpoint is enabled in this phase.

The existing reset contract remains the release gate and must continue to report `canExecuteProductionReset: false` until a separate Production migration is explicitly approved.

## 14. Frontend persistence rule

Prediction persistence is server-only.

The frontend may hold unsaved score edits in JavaScript memory while the screen is open, but it must not use browser `localStorage`, IndexedDB, or Supabase as the authoritative or fallback prediction store.

After a successful save, the frontend renders the server response.

After a failed save:

- keep the user's in-memory draft visible;
- show a local error;
- do not mark it as saved;
- do not silently fall back to legacy `save_predictions` storage.

Non-prediction UI state may keep its existing persistence behavior; this rule is specifically about prediction-domain data.

## 15. Error contract

Required errors:

```text
400 invalid_prediction_request
400 competition_match_mismatch
401 telegram_auth_required
401/403 telegram_auth_rejected
404 match_not_found
409 prediction_locked
409 season_mismatch
500 prediction_storage_failed
502 identity_resolution_failed
502 match_resolution_failed
503 prediction_backend_unavailable
```

Storage errors are scoped to prediction surfaces and do not replace unrelated populated screens with a global error state.

## 16. Durable Object failure behavior

The Worker never reports a prediction as saved unless the Durable Object transaction completed successfully.

On Durable Object timeout/unavailability:

- write → fail with `503 prediction_backend_unavailable`;
- read → return an explicit prediction-domain error rather than stale browser persistence;
- unrelated Home/Matches/Match Center data continues to function.

Retries of the same save are safe because the logical identity is `(user_id, match_id)` and the operation is an upsert.

## 17. Configuration changes

Only TEST configuration is changed in this phase.

`cloudflare-test/wrangler.jsonc` receives:

- `PREDICTION_LEAGUE` Durable Object binding;
- a Durable Object migration declaring `PredictionLeague` as a new SQLite class;
- `APP_ENV=test`;
- `PREDICTION_SEASON=2026-27` for the new season.

The existing bindings remain:

- `ASSETS`;
- `CIAO_WEB_API`.

`BSD_API_KEY` remains a secret/environment binding as currently used.

`TEST_RESET_TOKEN` is a TEST-only secret. Absence of the token disables executable reset rather than weakening the guard.

No Production Wrangler configuration is changed.

## 18. Code organization

Keep the subsystem isolated under v23.3.

Planned modules:

```text
cloudflare-test/src/v23.3/prediction-league-do.mjs
cloudflare-test/src/v23.3/prediction-service.mjs
cloudflare-test/src/v23.3/prediction-auth.mjs
cloudflare-test/src/v23.3/prediction-scoring.mjs
```

Existing modules remain and are reused where appropriate:

```text
prediction-contract.mjs
reset-contract.mjs
competition-data.mjs
```

`worker.js` stays an HTTP router/orchestrator and must not absorb SQL, scoring rules, or Telegram identity parsing logic.

## 19. Test strategy

Implementation follows TDD.

### 19.1 Pure unit tests

Cover:

- score bounds `0–20`;
- canonical match ID/competition mismatch;
- exact deadline boundary;
- active-season mismatch;
- object-name derivation;
- scoring parity with legacy Serie A fixtures;
- deterministic ranking tie ordering;
- result fingerprint idempotency;
- auth adapter fail-closed behavior;
- Production reset rejection.

### 19.2 Durable Object storage tests

Cover:

- initial schema creation;
- insert and read round-trip;
- edit before deadline;
- one row per `(user_id, match_id)`;
- cross-user isolation;
- cross-competition match identity isolation;
- transaction rollback for invalid batch;
- idempotent result reconciliation;
- ranking SQL aggregation;
- TEST reset clearing only the target active-season object and incrementing cache generation.

### 19.3 Worker API tests

Cover:

- unauthenticated routes return `401`;
- client-supplied user identity is ignored;
- client cannot choose the storage season;
- canonical match metadata is required;
- active-season mismatch is rejected;
- closed prediction is rejected server-side;
- correct season Durable Object is selected;
- storage failures do not fall back to the legacy save endpoint;
- rankings use Durable Object data;
- non-prediction `/api/*` proxy behavior remains unchanged.

### 19.4 Authenticated TEST smoke

The existing prediction gate may pass only after a real TEST deployment proves:

- isolated TEST fixture;
- persistence round-trip;
- persistence survives a fresh request/session;
- cross-competition identity isolation;
- exact server deadline rejection;
- scoring parity;
- Production data untouched.

The smoke writes only disposable TEST data.

### 19.5 Regression gate

Before any TEST cutover:

- full existing test suite is green;
- build is green;
- `/healthz` is green;
- BSD probes are green for the currently supported competition paths;
- Home, Matches, Match Center, Profile and Tables regression probes remain green.

## 20. Migration and rollout

### Phase A — backend construction

1. Add Durable Object binding, active-season configuration, and SQLite migration to TEST configuration.
2. Implement the Durable Object schema/repository.
3. Implement authenticated identity adapter.
4. Implement canonical match/deadline/season resolution.
5. Implement prediction write/read endpoints.
6. Implement scoring reconciliation and rankings.
7. Implement guarded TEST reset.

No frontend persistence switch occurs until backend tests and authenticated smoke pass.

### Phase B — TEST frontend cutover

1. Wire the TEST Predictions screen to the new routes.
2. Remove prediction-domain legacy save fallback from the TEST frontend.
3. Verify save/edit/reload behavior.
4. Wire TEST Rating/Ranking data to the Durable Object backend.
5. Verify all five competition filters and overall aggregation.

### Phase C — acceptance

TEST is considered ready for user acceptance only when:

- prediction release gate is `PASS`;
- reset capability is verified for TEST only;
- full regression suite is green;
- no Production resource has been modified;
- no Supabase or browser persistence participates in the new prediction data path.

### Phase D — future Production cutover

Not part of this implementation plan.

A later Production cutover requires a new explicit approval and a separate migration design covering:

- Production Durable Object namespace/binding;
- production-season start/reset decision;
- rollback plan;
- production smoke;
- final frontend/route cutover.

## 21. Acceptance criteria

The design is complete when the implementation can demonstrate all of the following in TEST:

1. A Telegram-authenticated user can save a prediction for any supported competition.
2. The saved prediction survives reload/new request because it is stored in Durable Object SQLite.
3. A second user cannot read or overwrite the first user's personal prediction data.
4. A prediction can be edited before the authoritative deadline.
5. A prediction cannot be edited at or after `kickoff - 15 minutes`.
6. Client-provided kickoff, season, user ID, or deadline cannot bypass server rules.
7. Scoring matches the current Serie A scoring formula.
8. Competition rankings and overall ranking derive from the same stored prediction rows.
9. Overall ranking gives equal weight to all five competitions.
10. TEST reset clears only the configured TEST active-season prediction store and invalidates prediction-domain caches.
11. Production reset remains impossible from the TEST tooling.
12. Production `ciao-web-app` remains untouched until a separate explicit approval.
13. Prediction persistence uses neither Supabase nor browser `localStorage`/IndexedDB.
14. Existing non-prediction v23.3 functionality continues to pass regression checks.
