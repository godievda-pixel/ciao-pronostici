# Ciao, Web! v23.2 — Multi-Tournament Architecture Design

Date: 2026-09-01
Status: Approved in chat, pending written-spec review
Target: TEST first (`develop` → `ciao-web-app-test`); Production remains unchanged until explicit acceptance

## 1. Goal

v23.2 extends Ciao, Web! from a Serie A-centered experience into a unified Italian-club match platform covering five competitions while preserving one consistent data model and one shared interaction model.

Included competitions:

- `serie_a` — all Serie A matches.
- `coppa_italia` — all Coppa Italia matches.
- `ucl` — only UEFA Champions League matches involving at least one Italian club.
- `uel` — only UEFA Europa League matches involving at least one Italian club.
- `uecl` — only UEFA Conference League matches involving at least one Italian club.

The same normalized match must power Home, Matches, Predictions, Match Center and Rankings. The system must not maintain separate per-screen copies of schedule logic.

## 2. Non-goals

This release does not:

- change the existing prediction scoring formula;
- apply competition weighting to ranking points;
- show European matches with no Italian club involved;
- replace Production before TEST acceptance;
- create five independent match-center implementations;
- copy official UEFA visual assets or branded layouts.

## 3. Core architecture

Use a hybrid API + frontend engine approach.

### 3.1 `ciao-web-api`

The API is the source of normalized competition and match data. Upstream provider-specific data is isolated behind adapters. The frontend must not need to know which upstream provider supplied a match.

Responsibilities:

1. Fetch raw match data from the configured upstream source(s).
2. Normalize all competitions into one match schema.
3. Apply competition inclusion rules.
4. Identify Italian clubs for UCL, UEL and UECL filtering.
5. Expose stable match IDs and competition metadata.
6. Serve schedule snapshots with a data version.
7. Serve prediction/ranking data through the same competition keys.
8. Apply short-lived server caching appropriate to match status.

### 3.2 Frontend Tournament Engine

The frontend receives normalized data and handles presentation behavior through competition configuration rather than duplicated business logic.

Each competition config defines:

- competition key;
- user-facing title;
- visual theme token;
- navigation model (`rounds` vs `stages`);
- grouping rules;
- stage labels;
- competition-specific UI accents.

The Tournament Engine is shared by Home, Matches, Predictions, Match Center and Rankings.

## 4. Canonical match model

Every match must normalize to one stable shape:

```text
matchId
competition
season
stage
round
kickoffAt
status
minute
homeTeam
awayTeam
homeScore
awayScore
aggregateScore
leg
venue
predictionDeadline
rawVersion
```

### Required semantics

- `matchId` is stable across screens and updates.
- `competition` is one of `serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`.
- `kickoffAt` is an absolute timestamp; the client formats it in the user's locale/timezone.
- `status` uses a normalized finite set such as `scheduled`, `live`, `finished`, `postponed`, `cancelled`.
- `minute` is populated only when meaningful.
- `aggregateScore` and `leg` are optional and used only when the competition stage requires them.
- `predictionDeadline` is authoritative for prediction locking and must not depend on delayed LIVE polling.
- `rawVersion` may be used internally for debugging/cache invalidation but is not a user-facing identifier.

`homeTeam` and `awayTeam` include at minimum a stable team ID, display name, country association and crest/logo URL when available.

## 5. Competition inclusion rules

### Serie A

Return the complete competition calendar.

### Coppa Italia

Return the complete competition calendar, including all stages present in the current season format.

### UCL / UEL / UECL

Return a match only when at least one participating club is identified as Italian by the API's canonical club metadata.

Filtering happens in `ciao-web-api`, not independently in the client.

## 6. API shape

The exact upstream provider remains replaceable, but the frontend-facing contract is stable.

Recommended routes:

```text
GET /api/v23.2/competitions
GET /api/v23.2/matches?competition=<key>&from=<iso>&to=<iso>
GET /api/v23.2/matches/:matchId
GET /api/v23.2/predictions/available
GET /api/v23.2/rankings?competition=<key|overall>
```

Responses include a compatible `dataVersion` and a server timestamp.

The first implementation may adapt existing endpoints internally, but screens must consume the normalized v23.2 contract rather than provider-specific shapes.

## 7. Data flow and LIVE updates

The only supported flow is:

```text
upstream source
→ ciao-web-api adapter
→ normalized match model
→ Tournament Engine
→ Home / Matches / Predictions / Match Center / Rankings
```

### LIVE behavior

- Active LIVE matches refresh approximately every 15–30 seconds.
- Upcoming scheduled matches refresh less frequently.
- Finished matches stop high-frequency polling.
- A LIVE refresh updates changed fields in place; it does not replace entire screens.
- Stable match IDs and stable DOM/card geometry are required.

### No-layout-shift rule

The v23.1 regression where a card changed geometry after calendar hydration must not return.

For async data:

- reserve final component geometry on first render;
- update text, score, status, logos and action IDs in place where possible;
- do not reset scroll position;
- do not reset the selected competition, stage, round or expanded section;
- do not remount the whole page for a score/minute update.

## 8. Cache and degradation

Use two cache layers.

### API cache

Short-lived server cache keyed by competition/window and tuned by match state.

### Client snapshot cache

The client keeps the last successful compatible snapshot so Mini App startup can render immediately and hydrate silently.

If data refresh fails:

- keep the last successful data visible;
- show a compact non-blocking status such as `Данные могут быть неактуальны`;
- for LIVE data use `Обновление задерживается`;
- never replace a populated screen with an empty error state solely because refresh failed.

If `dataVersion` is incompatible with the current frontend, use the last compatible snapshot rather than guessing at the new schema.

## 9. Navigation model

Bottom navigation remains:

```text
Главная / Матчи / Прогнозы / Рейтинг / Профиль
```

Competitions are not added as bottom-nav items.

Deep-link match route:

```text
/match/:matchId
```

A match can be opened from Home, Matches, Predictions or a Telegram link without separate match-center logic.

Back navigation must restore the originating screen state, including:

- competition;
- round/stage;
- active filter;
- expanded sections;
- scroll position.

## 10. Matches experience

### 10.1 Matches landing screen

The root Matches screen is a five-competition showcase rather than one mixed list.

Competition cards:

- Serie A
- Coppa Italia
- Champions League
- Europa League
- Conference League

Each card may show the next relevant match/date and a count of upcoming matches.

A compact top block may show the nearest upcoming matches involving Italian clubs across competitions.

### 10.2 Competition screens

Each competition opens a dedicated screen with its own visual theme while preserving a common interaction structure.

#### Serie A

- `Ближайшие / Тур / Календарь` views.
- round selector;
- all matches in the selected round;
- LIVE matches prioritized;
- finished matches remain accessible.

#### Coppa Italia

Stage-oriented navigation rather than league rounds.

Typical labels are derived from the actual season format, e.g. `1/32`, `1/16`, `1/8`, `1/4`, `1/2`, `Финал` where applicable.

Two-leg aggregate data is displayed only when the current competition format actually uses it.

#### UCL / UEL / UECL

Show only matches involving Italian clubs.

Stage navigation adapts to the season format, for example:

`Лига → Плей-офф → 1/8 → 1/4 → 1/2 → Финал`

When multiple Italian clubs play in the same matchweek, matches appear in one chronological stage block.

### 10.3 Match cards

All competitions share the same information hierarchy:

```text
crest + home team | score/time | away team + crest
stage/round · date · status
prediction status / user's prediction when relevant
```

The whole match card is clickable to Match Center.

## 11. Competition visual themes

Themes remain recognizably Ciao, Web! rather than replicas of official competition branding.

- Serie A — saturated Ciao blue / calcio theme.
- Coppa Italia — dark base with restrained Italian tricolore accents.
- UCL — deep midnight/navy with subtle star/geometry cues.
- UEL — dark base with orange accents.
- UECL — dark base with green accents.

Theme changes color, surface treatment and decorative detail, not fundamental layout or interaction patterns.

## 12. Predictions experience

### 12.1 Root Predictions screen

Default view: `Все доступные`.

Competition access:

```text
Все доступные / Serie A / Coppa Italia / ЛЧ / ЛЕ / ЛК
```

`Все доступные` is one chronological feed of currently predictable matches from all included competitions.

European competitions include only matches involving Italian clubs.

### 12.2 Grouping

Group available predictions by date using user-friendly labels such as:

- Сегодня
- Завтра
- calendar date thereafter

### 12.3 Prediction cards

A prediction card includes:

- teams and crests;
- kickoff time;
- competition;
- stage/round;
- prediction state;
- current user's prediction if submitted.

Quick prediction entry must be possible directly from the list without opening Match Center.

Clicking the match identity area opens Match Center.

### 12.4 States

Open:

`Прогноз открыт`

Submitted:

`Твой прогноз: X:Y ✓`

Locked:

`Прогноз закрыт`

Finished:

Show final score, user's prediction and awarded points.

Submitting or editing a prediction updates the card in place without changing its geometry or scroll position.

### 12.5 Progress and filters

Each competition screen shows progress such as `Прогнозировано 6 из 10`.

The overall view shows an aggregate weekly summary.

Provide a `Не заполнено` filter that leaves only matches without a submitted prediction.

## 13. Prediction model and scoring

Canonical prediction record:

```text
predictionId
userId
matchId
competition
predictedHome
predictedAway
submittedAt
lockedAt
points
resultType
```

Rules:

- `competition` is derived from the match, not manually chosen by the user.
- scoring formula remains unchanged from the current Ciao, Web! Prediction League.
- after a match is finalized, scoring is computed once for the authoritative final result.
- `points` and `resultType` are stored on the prediction result.
- prediction locking uses `predictionDeadline`, not the arrival of LIVE state.

## 14. Rankings

Ranking tabs:

```text
Общий / Serie A / Coppa Italia / ЛЧ / ЛЕ / ЛК
```

### 14.1 Equal weight

All competitions have equal weight.

Ten points earned in any competition contribute exactly ten points to the overall ranking.

### 14.2 Competition rankings

A competition ranking is the sum of prediction points where `competition` matches that competition.

Only users with at least one submitted prediction in that competition appear in that competition table.

### 14.3 Overall ranking

Overall score is derived, never independently maintained:

```text
overall = serie_a + coppa_italia + ucl + uel + uecl
```

A user with no participation in one competition contributes zero for that competition.

### 14.4 User summary

The ranking screen shows the current user's:

- position;
- total points;
- movement since previous ranking period;
- predictions made;
- exact scores;
- correct outcomes;
- average points per prediction.

The overall view may show the point split by competition.

### 14.5 Ranking movement

Store ranking snapshots after meaningful competition periods.

Period definitions:

- Serie A — completed round;
- Coppa Italia — completed match date/stage checkpoint;
- UCL / UEL / UECL — completed UEFA matchweek/stage checkpoint.

Movement is shown as `↑N`, `↓N`, or `—` relative to the previous snapshot for that ranking scope.

## 15. Participant profile

Clicking a ranking row opens a participant statistics profile.

Show:

- overall ranking position;
- position in each competition where the user participates;
- total points;
- exact scores;
- best-performing competition;
- recent predictions;
- recent form over the latest five scored predictions.

## 16. Home integration

Home remains compact and personalized.

It consumes the same Tournament Engine and may show:

- favorite club's nearest match across included competitions;
- `Кальчо сегодня` from the unified schedule;
- nearest available predictions;
- compact overall-ranking status.

The existing approved v23.1 favorite-match and Today-card behavior must not regress during migration.

## 17. Match Center

There is one technical Match Center.

Its theme is selected by `competition`.

Common tabs:

```text
Обзор / Составы / События / Статистика / Прогнозы
```

Additional cup/European metadata appears when relevant:

- stage;
- leg (`первый матч` / `ответный матч`);
- aggregate score.

No competition gets a separate Match Center implementation.

## 18. Error handling

Errors are scoped rather than global where possible.

### Upstream match-source failure

Serve cached normalized data when available and flag staleness.

### `ciao-web-api` refresh failure

Client keeps its last successful compatible snapshot.

### User action failure

Prediction-save failures are shown locally near the action and must not clear or rerender unrelated screen content.

## 19. Safe migration from v23.1

v23.1 remains the known-good TEST baseline while v23.2 is introduced alongside it.

Migration order:

1. Build normalized multi-competition API contract and Tournament Engine behind TEST-only integration.
2. Migrate Matches.
3. Migrate Predictions.
4. Migrate Rankings.
5. Migrate Home to the new source.
6. Migrate Match Center last.

Each migrated surface must pass regression tests before the next becomes authoritative.

Production `ciao-web-app` is not switched during these steps.

## 20. Release acceptance criteria

TEST must pass the complete user path before any Production cutover:

1. Open all five competition screens.
2. Verify inclusion rules: full Serie A/Coppa, Italian-club-only UCL/UEL/UECL.
3. Navigate rounds/stages and preserve screen state.
4. Open a match from Matches and return to the exact previous state.
5. Submit/edit a prediction from the prediction list without layout shift.
6. Verify prediction lock behavior at deadline.
7. Open Match Center from Home, Matches and Predictions using the same match ID.
8. Verify competition-specific Match Center themes.
9. Verify five separate rankings.
10. Verify overall ranking equals the exact sum of the five competition scores.
11. Verify ranking movement snapshots.
12. Simulate refresh/API failure and confirm cached data remains visible.
13. Simulate LIVE updates and confirm score/minute update without remount, scroll loss or layout shift.
14. Verify current v23.1 Home favorite-card and `Кальчо сегодня` regressions do not return.

Production cutover requires explicit user approval after TEST verification.

## 21. Testing strategy

Use TDD for behavior changes.

Required test layers:

### API/unit

- competition normalization;
- Italian-club filtering;
- stable IDs;
- stage/round mapping;
- prediction deadline normalization;
- ranking aggregation.

### Frontend/unit

- competition config mapping;
- route/state restoration;
- no-layout-shift shell behavior;
- competition-specific filtering;
- prediction-card state transitions.

### Integration/build

- normalized API fixture → Tournament Engine → screen model;
- same match ID across Home/Matches/Predictions/Match Center;
- ranking totals across all competitions;
- compatibility guard for `dataVersion`.

### Manual TEST acceptance

Telegram TEST is the final visual/interaction validation before Production.

## 22. Implementation decomposition

The architecture is one coherent design, but implementation should be split into independently verifiable milestones:

1. Multi-competition API normalization + competition metadata.
2. Frontend Tournament Engine + theme/config layer.
3. Matches experience.
4. Predictions + competition-aware result storage.
5. Rankings + snapshots + participant profile.
6. Home + Match Center migration and full regression pass.

No milestone is considered complete until its tests and TEST build are green.
