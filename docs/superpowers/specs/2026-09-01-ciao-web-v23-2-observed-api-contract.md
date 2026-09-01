# Ciao, Web! v23.2 — Observed v23.1 API Contract

Date: 2026-09-01  
Source: GitHub Actions run `33530179327` / artifact `ciao-v23-2-api-contract` (`9809384618`)  
Artifact digest: `sha256:c74c642102c9c8543fa2e95740bfc390555f7ee3d02ab9fd8dc5a84a525494b0`  
Scope: static production-v23.1 frontend contract plus anonymous probes that are safe without Telegram identity.

## Observation result

The v23.1 frontend does not call its business-data API as direct literal `fetch('/api/...')` requests. API URLs are assigned to constants and are then passed into POST helpers. Therefore the direct-call observer correctly found zero safe anonymous GET business-data calls.

No authenticated endpoint was probed. No Telegram init data, user ID, prediction, ranking, cookies, tokens or response values were stored in the artifact.

## Static API route inventory

The following route literals were observed in the production v23.1 source:

| Route | Observed use |
| --- | --- |
| `/api/ciao-club-calendar-fast-v1` | Route literal observed; request contract not established by this artifact. |
| `/api/ciao-club-profile-fast` | Route literal observed; request contract not established by this artifact. |
| `/api/ciao-core-api-fast-v4` | `POST`, JSON body, `x-telegram-init-data` header through the legacy `api(body)` helper. |
| `/api/ciao-core-api-fast-v6` | Route literal observed; request contract not established by this artifact. |
| `/api/ciao-fast-api-v2` | `POST`, JSON body, `x-telegram-init-data` header through `__cw9Post`. |
| `/api/ciao-live-snapshot-v1` | Route literal observed; request contract not established by this artifact. |
| `/api/ciao-match-center` | `POST` with `{ match_id }`, JSON body and `x-telegram-init-data`. |
| `/api/ciao-match-center-fast-v3` | `POST` through `__cw9Post`; observed body includes `{ match_id, sections, include_split: false }`. |
| `/api/ciao-match-summary-fast-v2` | `POST` through `__cw9Post`; observed body includes `{ match_id }`. |
| `/api/ciao-miniapp-api` | Diagnostic image/GET usage is present in the page source. |
| `/api/ciao-miniapp-api?boot=page210244509-v7&t=` | Diagnostic boot request literal observed. |
| `/api/ciao-prediction-insights-v1` | Route literal observed; request contract not established by this artifact. |
| `/api/ciao-schedule-fast-v1` | `POST` through `__cw9Post` with an empty `{}` JSON body and `x-telegram-init-data`. This is the current full Serie A schedule source. |

## Shared authenticated POST helper

The production source establishes the following legacy helper behavior for the v20.9+ fast endpoints:

```text
method: POST
content-type: application/json
x-telegram-init-data: <Telegram WebApp initData>
body: JSON.stringify(body)
response: JSON; success requires HTTP ok and response.ok
```

This is an observed frontend contract. The artifact intentionally does not contain an initData value.

## Serie A schedule contract observed from source

`/api/ciao-schedule-fast-v1` is assigned to `__CW209_SCHEDULE` and loaded by:

```text
__cw9Post(__CW209_SCHEDULE, {}, ...)
```

The returned object is stored as `__cw209Schedule`. The production frontend directly reads these response fields:

```text
current_round
rounds[]
rounds[].number
rounds[].matches[]
```

When the flattened schedule is passed into the v23 Today layer, each raw match receives:

```text
round_number = match.round_number || round.number
```

The production v23 normalizer is also observed reading these raw match fields/alternatives:

```text
id | match_id
live_status | status
is_finished
is_live
competition_code | competition.code
kickoff_at
```

This document does not infer unobserved response fields beyond those names.

## Existing v23.1 schedule flow

```text
Telegram Mini App
  -> POST /api/ciao-schedule-fast-v1
  -> __cw209Schedule
  -> rounds[].matches[]
  -> __cw231RawScheduleMatches()
  -> CiaoV23Today.normalizeMatch()
  -> Home / Calendar presentation
```

The schedule cache in the frontend is refreshed on a roughly 30-second boundary while the calendar is active.

## Unprobed business-data routes

Authenticated POST routes were not called by GitHub Actions because their source contract requires `x-telegram-init-data`. This includes the schedule, fast core, Match Center, club, live and prediction-related endpoints where request semantics are not anonymous GET.

The lack of probe output is therefore not evidence that the endpoints are unavailable. It means the observation respected the no-identity/no-user-data boundary.

## Adapter implications for v23.2

1. TEST can safely preserve all existing v23.1 routes by continuing to proxy `/api/*` to the current `ciao-web-api` service binding.
2. A v23.2 TEST adapter can obtain the existing Serie A schedule by forwarding the user's incoming `x-telegram-init-data` to `/api/ciao-schedule-fast-v1` with the source-proven empty JSON body, then normalizing the response server-side.
3. `rounds[].matches[]` is the confirmed legacy source collection for Serie A. The v23.2 adapter must not invent a second Serie A calendar model.
4. The current artifact does not establish a legacy source for Coppa Italia, UCL, UEL or UECL. Those competitions require either an observed capability of the existing API worker or a new source/provider integration before their match feeds can be considered real.
5. Production remains unchanged. New v23.2 routing must be introduced in TEST first, while v23.1 remains visible until a screen is explicitly cut over.
