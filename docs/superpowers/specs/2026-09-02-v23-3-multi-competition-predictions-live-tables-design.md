# Ciao, Web! v23.3 — Multi-Competition Predictions, Live Match Center, Home Feed and Tables

## Status

Approved architecture for TEST-first implementation on `develop`.

## Goal

Extend the existing v23.2 tournament layer so the whole app consistently supports five competitions:

- Серия А
- Кубок Италии
- Лига Чемпионов
- Лига Европы
- Лига Конференций

The change must preserve the already stable Serie A backend behavior while adding the four BSD-backed competitions through one canonical multi-competition layer.

Production must remain untouched until TEST is fully verified. The destructive prediction reset is prepared and tested on TEST, but executed against real user data only during the final Production cutover after explicit approval.

## Approved Architecture

Use the hybrid canonical approach:

- Serie A keeps the existing verified Ciao API and existing live/prediction behavior.
- Coppa Italia, UCL, UEL and UECL continue to use BSD Football v2.
- A canonical application layer normalizes both sources into one shared match contract consumed by Home, Predictions, My Predictions, Match Center, club profiles and Tables.

Do not migrate Serie A to BSD in this release.

## Canonical Competition Keys

The application-wide keys remain:

- `serie_a`
- `coppa_italia`
- `ucl`
- `uel`
- `uecl`

Every user-visible competition label must use:

- `serie_a` → `Серия А`
- `coppa_italia` → `Кубок Италии`
- `ucl` → `Лига Чемпионов`
- `uel` → `Лига Европы`
- `uecl` → `Лига Конференций`

`Serie A` must no longer be shown as the main Russian UI label.

## Canonical Match Contract

Every match consumed by the new shared UI flows must expose at least:

```js
{
  competition: 'serie_a' | 'coppa_italia' | 'ucl' | 'uel' | 'uecl',
  matchId: string,
  kickoffAt: string,
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled',
  minute: number | null,
  stage: string | null,
  round: number | string | null,
  homeTeam: {
    id: string,
    name: string,
    rawName: string,
    crestUrl: string,
  },
  awayTeam: {
    id: string,
    name: string,
    rawName: string,
    crestUrl: string,
  },
  homeScore: number | null,
  awayScore: number | null,
  predictionDeadline: string,
}
```

The canonical identity of a match is the pair:

`competition + matchId`

Never treat a provider event id by itself as globally unique across competitions.

## Data Coverage

### Serie A

Continue using the current stable Ciao schedule/live APIs and prediction storage paths. Adapt them into the shared canonical contract without changing the working upstream implementation.

### Coppa Italia

Load all competition matches from BSD, not only Italian top-flight clubs. Keep the v23.2 Coppa dedupe rule so stale reversed single-leg duplicates remain removed while legitimate two-leg semifinals remain separate.

### UEFA competitions

For UCL, UEL and UECL, remove the current v23.2 Italian-club filter for app-wide competition data. The shared tournament feed must contain every match returned for the current tournament season.

Club-profile enrichment is different: a club profile still shows only matches involving that club.

## User Local Time

All competition match times must render in the user's device/WebView timezone by using `Intl.DateTimeFormat` without a forced production timezone.

The same canonical `kickoffAt` is used for:

- Home cards
- tournament match lists
- Predictions
- My Predictions
- Match Center
- club profiles
- playoff bracket

No screen may independently hard-code `Europe/Rome`.

## Home Screen

### Remove Season Reset Banner

Remove the Home notice shown in the supplied screenshot:

`Начало нового сезона! Счёт обнулен, все начинают с нуля. Удачи!`

It must not be replaced by another reset announcement.

### “Кальчо сегодня”

The Home match feed must no longer depend only on Serie A.

It must merge all five competition feeds, dedupe canonically, sort chronologically and display the closest relevant fixtures.

Behavior:

1. Prefer matches occurring today in the user's local date.
2. If there are no matches today, show the nearest upcoming fixtures across all competitions.
3. If multiple competitions have matches today, interleave them by kickoff time rather than grouping by competition.
4. Each card must include a compact competition label so the user can distinguish, for example, `Кубок Италии` from `Лига Чемпионов`.
5. Clicking a card opens the shared Match Center for the same canonical match.

## Predictions

### Navigation

Preserve the current top-level switch:

- `Прогнозы`
- `Мои прогнозы`

Inside both views add the same competition selector:

- `Серия А`
- `Кубок Италии`
- `Лига Чемпионов`
- `Лига Европы`
- `Лига Конференций`

The selector must be mobile-safe and must not create document-level horizontal overflow.

### Competition Grouping

Serie A keeps its current round/tour grouping.

Coppa Italia and UEFA competitions group fixtures by provider stage when meaningful, and secondarily by date when stage metadata is absent or too broad.

### Prediction Deadline

All five competitions use the same rule:

`predictionDeadline = kickoffAt - 15 minutes`

A prediction may be created or changed only while current time is strictly before the deadline.

At or after the deadline:

- editing is disabled;
- submission is rejected server-side as well as disabled client-side;
- an already saved prediction remains visible.

Do not rely on client time alone for write authorization.

### Prediction Identity

New universal prediction records must be keyed by at least:

- authenticated user id
- `competition_key`
- canonical `match_id`

This prevents same-number event ids from different competitions colliding.

### Scoring

All five competitions use the exact same scoring rules currently used by Serie A.

There are no:

- competition multipliers;
- bonus coefficients for European matches;
- separate tournament leaderboards.

The global prediction ranking is the sum of points earned from all five competitions.

### My Predictions

`Мои прогнозы` uses the same competition selector and same match identity contract.

After the Production reset, the old prediction history must be empty and only predictions created in the new season/system are shown.

## Prediction Data Reset

The user selected full reset Variant B.

The final Production reset must remove the legacy prediction state, including:

- all previous prediction submissions;
- points awarded from those submissions;
- current predictor leaderboard/ranking rows or aggregates;
- derived prediction leaderboard caches/aggregates that would repopulate old values;
- old “My Predictions” history from the reset dataset.

### TEST safety rule

On TEST, implement and verify the reset mechanism against isolated/non-production data only.

Do not execute destructive deletion against real Production user data during development or TEST verification.

### Production cutover order

The real reset may happen only after:

1. the new Production build is deployed;
2. health checks pass;
3. all five competition feeds pass live probes;
4. prediction write/deadline behavior passes a Production smoke test that does not alter historical users unexpectedly;
5. explicit final approval is given;
6. the one-time reset is executed;
7. an immediate verification confirms zeroed ranking and no legacy prediction history.

The reset operation must be idempotent or guarded so it cannot accidentally run twice with different semantics.

## Match Center

Create one logical Match Center entry contract for all five competitions.

The UI must open a match by:

`competition + matchId`

### Serie A

Preserve the existing stable Match Center/live implementation and adapt its output to the shared UI contract.

### BSD-backed competitions

Coppa Italia, UCL, UEL and UECL must provide the same user-facing Match Center capabilities where provider data exists:

- teams and crests;
- competition label;
- local kickoff time;
- scheduled/live/finished status;
- live score;
- minute when provided;
- final score when finished.

The app must poll or refresh BSD live data at a practical bounded interval while the Match Center is open and the match is live.

The implementation must not hammer BSD while the page is hidden or when the match is not live.

If live minute data is missing, show the score/status without inventing a minute.

If BSD live refresh fails temporarily, preserve the last known valid Match Center state and show a non-destructive refresh error rather than clearing the screen.

## Tables Section

The bottom navigation section `Таблицы` becomes the home for tournament standings/brackets.

Add competition selectors for:

- `Серия А`
- `Лига Чемпионов`
- `Лига Европы`
- `Лига Конференций`
- `Кубок Италии`

### Serie A

Keep the existing Serie A table behavior, changing only the user-visible main label to `Серия А` where appropriate.

### UEFA standings

UCL, UEL and UECL must show the full current tournament table including all participating clubs, not only Italian teams.

Standings rows should include the provider-supported competition table fields needed to understand ranking, at minimum:

- position;
- club;
- played;
- wins;
- draws;
- losses;
- goals for;
- goals against;
- goal difference;
- points.

If a provider field is not available, the table must degrade gracefully rather than invent values.

### Coppa Italia

The Coppa Italia destination in `Таблицы` displays the playoff bracket.

The existing v23.2 bracket logic and safety rules remain:

- use real provider linkage when available;
- unresolved participant may display `Победитель пары X — Y` only when linkage is explicit;
- otherwise display `Соперник определяется`;
- do not infer bracket paths from arbitrary list order.

The bracket may scroll horizontally inside its own viewport, but the document itself must not horizontally overflow.

## Matches Section

The `Матчи` tournament hub continues to show all five competitions.

### Coppa Italia simplification

Remove the internal `Матчи / Сетка Плей-офф` segmented switch from `Матчи → Кубок Италии`.

That screen becomes only the chronological/grouped Coppa Italia match schedule.

The bracket is accessible from `Таблицы → Кубок Италии` only.

## Club Profiles

Keep v23.2 profile enrichment.

A club profile shows that club's own matches across relevant supported competitions. It must not dump the complete UEFA competition feed into an Italian club profile.

Profile integration failure remains non-destructive: the legacy profile and Serie A data still render if an external tournament feed fails.

## Team Localization

Keep the v23.2 Russian team registry.

Because app-wide UEFA feeds now include all tournament clubs, the localization live probe must cover every team currently returned by the supported competition feeds.

Unknown names may fall back to the raw provider name so the UI remains usable, but CI/live diagnostics must report them so they can be added to the registry.

## UI Requirements

The new screens must preserve the visual language already established in Ciao, Web! and the provided screenshots.

Specific requirements:

- rename `Serie A` to `Серия А` in tournament cards and Russian-facing navigation;
- remove the Home reset banner;
- competition selectors use compact rounded segmented controls consistent with existing v23.2 tournament controls;
- Home match cards show competition labels without overwhelming the team names;
- Predictions and My Predictions must remain comfortable on Telegram mobile widths;
- no document-level horizontal overflow;
- bracket scrolling is contained to the bracket viewport;
- existing bottom navigation behavior must remain stable.

## Error Handling

### Competition feed failure

If one BSD competition fails, other competitions and Serie A continue to render.

Home should merge all successful feeds and not fail the whole block because one tournament is unavailable.

### Standings failure

Only the selected tournament table shows an error state. Other Tables tabs remain usable.

### Match Center live failure

Keep the last known valid score/status and retry later. Do not blank the Match Center.

### Prediction write failure

Do not optimistically claim a saved prediction unless the server confirms it. Show a clear error and preserve the editable state if still before deadline.

### Reset failure

The Production reset must fail closed and produce an auditable result indicating which reset stages succeeded. It must not silently report success after a partial failure.

## Security and Authorization

Prediction reads/writes remain tied to authenticated Telegram user identity.

Server-side prediction deadline enforcement is mandatory.

No client-supplied user id, score, points or competition label is trusted as authoritative.

BSD credentials remain server-side only.

Do not use Supabase for this release.

## Caching and Refresh

Competition schedule data can use bounded caching appropriate to scheduled fixtures.

Live match data must use a shorter refresh path than static schedules.

Standings may be cached briefly but must have an explicit refresh/TTL path so recently completed matches update the table.

Prediction state must not be served from a cache that can cause a user to overwrite a newer saved prediction.

## Required Tests

### Competition configuration

1. Russian label `Серия А` is used in approved Russian UI destinations.
2. Exact Russian titles for all five competitions.

### Home

3. Home reset banner is absent.
4. “Кальчо сегодня” merges matches from all five competitions.
5. Today-first selection works in user local date.
6. Nearest-upcoming fallback works when today is empty.
7. Competition labels render on Home match cards.
8. Home survives one failed competition feed.

### Predictions

9. Both `Прогнозы` and `Мои прогнозы` expose all five competition tabs.
10. Serie A still groups by round.
11. Cup/UEFA competitions group by stage/date.
12. Deadline is exactly kickoff minus 15 minutes for all competitions.
13. Client disables edits at deadline.
14. Server rejects writes at/after deadline.
15. Prediction identity includes competition plus match id.
16. Same numeric provider id in different competitions does not collide.
17. Scoring rules are identical across all competitions.
18. Global ranking aggregates points from all five competitions.

### Reset

19. Reset clears legacy predictions.
20. Reset clears earned prediction points.
21. Reset clears predictor ranking/derived aggregates.
22. Reset clears legacy My Predictions history.
23. Reset test is isolated and cannot target Production by default.
24. Reset is guarded/idempotent.

### Match Center and live

25. Serie A Match Center regression remains green.
26. BSD match center opens by `competition + matchId`.
27. Scheduled BSD match renders teams/time/status.
28. Live BSD match updates score/status.
29. Minute renders only when provider supplies it.
30. Finished BSD match renders final score.
31. Temporary live refresh failure preserves last good state.
32. Hidden page does not continue aggressive live polling.

### Tables

33. Tables exposes all five competition destinations.
34. UCL standings contain non-Italian clubs.
35. UEL standings contain non-Italian clubs.
36. UECL standings contain non-Italian clubs.
37. Standings ordering and points map correctly from provider data.
38. Coppa bracket is accessible from Tables.
39. Coppa bracket is no longer rendered inside Matches → Coppa Italia.
40. Bracket unresolved-participant safety rules remain green.
41. Bracket does not cause document-level horizontal overflow.

### Provider coverage

42. UCL match feed includes non-Italian fixtures.
43. UEL match feed includes non-Italian fixtures.
44. UECL match feed includes non-Italian fixtures.
45. Coppa feed retains single-leg stale duplicate protection.
46. Team localization diagnostics report no untranslated names for the current live feed at release time.

### Profiles/navigation

47. Club profile still includes that club's external tournament matches only.
48. Existing bottom navigation remains operational.
49. Tournament cards open the correct screens.

## Live TEST Probes

The final TEST deployment probe must verify at minimum:

- health endpoint reports the expected TEST build and BSD configuration;
- all four BSD competition match endpoints return 200;
- UCL/UEL/UECL include at least one non-Italian-vs-non-Italian or otherwise non-filtered fixture proving the old Italian-only filter is gone;
- Coppa duplicate fingerprints are empty;
- no stale reversed Fiorentina/Pisa duplicate reappears;
- current live-feed unknown-team list is empty at release time;
- Home multi-competition module markers are deployed;
- prediction multi-competition module markers are deployed;
- Tables standings and Coppa bracket module markers are deployed;
- profile integration marker remains present;
- at least one BSD-backed Italian club Match Center payload can be resolved;
- at least one full UEFA standings payload contains non-Italian clubs.

## Release Boundary

All implementation work lands on `develop` and is verified on `ciao-web-app-test` first.

Do not switch Production or execute the real prediction reset during TEST development.

Only after visual approval of TEST and successful CI/live probes may the release be prepared for Production.

The actual destructive reset is a separate controlled final-cutover action, executed once after the new Production version is healthy.
