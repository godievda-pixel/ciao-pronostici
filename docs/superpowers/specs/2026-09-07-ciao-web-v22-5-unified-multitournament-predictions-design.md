# Ciao, Web! v22.5 — Unified multi-tournament Predictions redesign

Date: 2026-09-07
Status: Approved design, awaiting implementation plan
Target branch: `main`
Stable branch must remain untouched until production is visually accepted.

## 1. Goal

Rebuild the existing production `Прогнозы` experience into one unified prediction center for:

- Серия А
- Кубок Италии
- Лига Чемпионов
- Лига Европы
- Лига Конференций

The user must experience these competitions as one prediction game with:

- one bottom-navigation item: `Прогнозы`;
- one permanent mode switch: `Прогнозы | Мои прогнозы`;
- one tournament selection hub;
- tournament-specific visual themes matching the already approved `Матчи` tab;
- one scoring system;
- one combined Rating and profile statistics;
- the same per-match deadline rule;
- automatic live/result updates every 15 seconds on the currently visible application tab.

The current Serie A prediction path is production-proven and must remain compatible. External competitions are added beside it through a new storage/API layer rather than by forcing BSD events into the current Serie A round schema.

This spec supersedes the `Out of scope` statement in `2026-09-07-ciao-web-v22-5-production-multitournament-matches-design.md` only for predictions and rating integration. The approved `Матчи` behavior remains unchanged except for the global 15-second refresh requirement defined here.

## 2. Product model

There is only one bottom-navigation item for predictions: `Прогнозы`.

Inside it, the application has two modes:

1. `Прогнозы` — create and edit predictions while a match is open.
2. `Мои прогнозы` — read-only view of the user's saved prediction, real match state/result and awarded points.

The mode switch remains visible at the top of the prediction experience at all times, including after a tournament and stage/round have been selected.

Switching between `Прогнозы` and `Мои прогнозы` must preserve:

- selected competition;
- selected stage/round;
- horizontal selector position where practical;
- last successfully loaded tournament state.

If the user has not yet selected a tournament, switching modes keeps the tournament hub visible.

## 3. Tournament hub

Below the permanent mode switch, the initial screen mirrors the already approved `Матчи` tournament hub.

Five tournament cards:

1. Серия А
2. Кубок Италии
3. Лига Чемпионов
4. Лига Европы
5. Лига Конференций

Layout:

- Serie A spans the full row.
- The remaining four competitions form a 2x2 grid where width allows.
- No explanatory subtitles.
- No official tournament-logo dependency.
- Tournament identity is expressed through color, gradient and lighting.

The tournament themes must match the current production `Матчи` themes:

- Serie A — saturated blue.
- Coppa Italia — graphite with Italian green/red accents.
- Champions League — deep navy / indigo / violet.
- Europa League — near-black / orange.
- Conference League — dark emerald / green.

## 4. Competition screen hierarchy

After choosing a tournament, the screen hierarchy is:

1. permanent `Прогнозы | Мои прогнозы` switch;
2. tournament cover/header with back control and tournament title;
3. stage/round selector;
4. full stage title where required;
5. prediction cards;
6. save action in edit mode.

The selected tournament theme must affect:

- application background;
- tournament cover;
- active stage/round control;
- prediction cards and decorative accents.

The theme must be applied synchronously before the main competition content is rendered so mobile WebViews do not show a one-frame default-theme flash.

## 5. Round and stage navigation

### 5.1 Serie A

Keep the current round model and round numbering.

### 5.2 Coppa Italia

Expose only:

- `1/16`
- `1/8`
- `1/4`
- `1/2`
- `Финал`

No earlier Coppa stages are part of Predictions.

### 5.3 UEFA league phase

The compact selector contains numbers only:

- `1`
- `2`
- `3`
- etc.

The full stage title remains below, for example:

`Общий этап · 3 тур`

### 5.4 UEFA knockout stages

Use the same normalized Russian stage labels and chronology as `Матчи`, including playoff/tie stage where present.

Selected stage/round remains stable during:

- 15-second refresh;
- mode switch;
- quiet retry after provider failure.

## 6. Prediction card — edit mode

All competitions use one shared prediction-card anatomy. Tournament theme changes color only, not interaction structure.

### 6.1 Top row

Left: real match status.

Right: date and kickoff time formatted in the user's device/WebView timezone.

### 6.2 Main row

- home crest + home team name;
- prediction score editor in the center;
- away crest + away team name.

The score editor uses the existing deliberate `− / value / +` interaction for each side.

Score limits remain 0–20.

External tournament crests use BSD crest URLs. No Telegram `custom_emoji_id` dependency is introduced into the external prediction path.

Italian clubs may open the existing club profile. Foreign clubs are non-clickable. The external match card itself never opens Match Center.

### 6.3 Bottom metadata

Before deadline:

- show the deadline rule in a concise form;
- if a saved prediction already exists, show a restrained `Сохранено` indicator.

After deadline:

- show `Прогноз закрыт`;
- editor controls are removed or disabled;
- no client action can reopen the prediction.

### 6.4 Save action

One button at the bottom of the selected round/stage:

`Сохранить прогнозы`

Changing `+ / −` controls modifies only local draft state until the user explicitly presses this button.

The save request contains all valid editable predictions for the selected stage/round. The server validates every match independently, so one newly closed match must not make valid still-open predictions unsafe.

## 7. My Predictions card — read-only mode

The card keeps the same competition styling and team geometry but has no score-edit controls.

The center emphasizes the user's saved prediction, for example:

`2 : 1`

If no prediction exists, render the explicit text:

`Прогноз не сделан`

Do not use a bare em dash for this state.

When the real match is live or finished, the card also displays:

- current/final real score;
- real match status;
- points once calculated.

Examples:

- `LIVE · 67′ · 1:1`
- `ПЕРЕРЫВ · 1:1`
- `ДОП. ВРЕМЯ · 2:2`
- `ПЕНАЛЬТИ · 4:3`
- `ИТОГ · 2:1`
- `+5 очков`

For Serie A, existing Match Center behavior may remain on the appropriate read-only match card.

For Coppa Italia and UEFA competitions:

- no Match Center opens;
- Italian club profile links remain available;
- foreign clubs remain non-clickable.

## 8. Match status model

The normalized UI status set is:

- scheduled -> `МАТЧ НЕ НАЧАЛСЯ`
- live first/second half -> `LIVE · N′`
- halftime -> `ПЕРЕРЫВ`
- extra time -> `ДОП. ВРЕМЯ`
- penalty shootout -> `ПЕНАЛЬТИ`
- finished -> `МАТЧ ЗАВЕРШЁН`
- postponed -> `МАТЧ ПЕРЕНЕСЁН`
- cancelled -> `МАТЧ ОТМЕНЁН`

At halftime, extra time and penalties, the current real score remains visible.

A minute is not appended to `ПЕРЕРЫВ`. Extra-time minute may be kept as secondary data internally but the primary status label remains `ДОП. ВРЕМЯ` unless a later explicitly approved UI refinement says otherwise.

Provider aliases must normalize into these states without leaking English provider status strings into the UI.

## 9. Prediction deadline

One rule for every competition:

`kickoff_at - 15 minutes`

Before the deadline:

- prediction may be created;
- saved prediction may be changed.

At or after the deadline:

- prediction becomes read-only;
- new prediction is rejected;
- update is rejected;
- LIVE/finished matches are always read-only.

The server is authoritative. Client clock, client `open` state and client-supplied kickoff values are never trusted for write authorization.

If kickoff is rescheduled before the original match starts, the latest authoritative provider kickoff controls the deadline. Existing saved prediction remains attached to the same stable match identity.

## 10. Scoring system

There is one scoring system across all competitions:

- exact score: 5 points;
- correct goal difference: 3 points;
- correct outcome: 2 points;
- miss: 0 points.

The current `cp_scoring_rules` record remains the canonical numeric source where practical, but the external prediction code must interpret it identically to Serie A.

### 10.1 No x2 bonus

The x2 match bonus is removed from the product model.

Requirements:

- no x2 UI;
- no x2 selection control;
- no x2 field in new external-prediction tables;
- no x2 multiplier in new calculations;
- no new calls to `set_round_bonus`;
- unified Rating must reflect the plain 5/3/2/0 scoring system.

Existing backend bonus code (`round_bonus`, `set_round_bonus`, legacy bonus tables/settings) is legacy debt and must be disconnected from active calculation/response paths as part of this implementation.

Before changing already-calculated historical Serie A points, implementation must audit whether any current `cp_predictions.points` differ from `base_points` specifically because of x2. If safe bonus-only differences are identified, normalize them to ordinary base points so the unified Rating is genuinely 5/3/2/0. If differences cannot be proven to be bonus-only, do not rewrite history blindly; stop that migration step and report the ambiguous rows for review.

## 11. Storage architecture

Keep current Serie A storage unchanged:

- `cp_matches`
- `cp_predictions`
- `cp_rounds`

Do not force external tournaments into `cp_rounds` or `cp_matches`.

Add a parallel external layer.

### 11.1 `cp_external_matches`

Recommended fields:

- internal `id` primary key;
- `competition` (`coppa_italia`, `ucl`, `uel`, `uecl`);
- `provider` (`bsd`);
- `provider_event_id`;
- `stage_key`;
- `stage_label`;
- `stage_order`;
- `round_number` where applicable;
- `kickoff_at`;
- normalized `status`;
- `minute`;
- home BSD team id;
- home display name;
- home country code;
- home crest URL;
- away BSD team id;
- away display name;
- away country code;
- away crest URL;
- home score;
- away score;
- provider/snapshot updated timestamp;
- local sync timestamp;
- finalized/result timestamp when finished.

Required uniqueness:

`(competition, provider_event_id)`

This is the stable match identity for external predictions.

Provider corrections to date, names, stage labels or home/away metadata update the existing row rather than creating a new prediction identity.

### 11.2 `cp_external_predictions`

Recommended fields:

- internal `id` primary key;
- `user_id` -> `cp_users`;
- `external_match_id` -> `cp_external_matches`;
- predicted home score;
- predicted away score;
- `points` nullable until calculated;
- `base_points` nullable until calculated;
- created timestamp;
- updated timestamp;
- calculated timestamp.

Required uniqueness:

`(user_id, external_match_id)`

New tables must have RLS enabled. The browser must not write them directly; all reads/writes go through the authenticated application API using Telegram init-data validation and server-side credentials.

## 12. External match synchronization

BSD remains the provider for Coppa Italia and UEFA competitions.

The prediction backend must use the same competition aliases, stage normalization, Russian club naming, Coppa stale-duplicate policy and Italian-club filtering contract already verified for `Матчи`.

External prediction state flow:

`BSD -> normalize/filter -> upsert cp_external_matches -> attach user prediction -> return UI state`

Rules:

- Coppa: Round of 32 onward only.
- UEFA: only matches with at least one Italian club.
- stale duplicate Coppa single-leg fixtures must not become two prediction opportunities.
- malformed BSD rows are isolated rather than breaking the whole response.
- last good database snapshot remains usable during temporary BSD failure.

The new external prediction API may have its own provider implementation, but parity tests must verify it against the production `Матчи` competition contract so the same event cannot appear with conflicting identity/stage semantics across the two tabs.

## 13. Result settlement

External prediction points must not depend on the individual user reopening the app after a match.

Settlement is server-side and idempotent.

When an external match becomes final:

1. update the authoritative match snapshot;
2. calculate every uncalculated prediction for that match;
3. persist `base_points`, `points` and calculation timestamp;
4. repeated settlement runs produce no duplicate award and no additive side effects.

A scheduled server-side synchronizer must periodically settle relevant external matches even when no user is actively viewing that competition. User-triggered state refresh may also opportunistically settle completed matches, but it is not the only mechanism.

If a provider later corrects a final score, the implementation plan must define a safe deterministic re-evaluation path. The product source of truth is the latest authoritative finalized result, not a cumulative award ledger.

## 14. Unified Rating and profile statistics

The user sees one game, so aggregate statistics combine:

`cp_predictions` + `cp_external_predictions`

Unified values:

- points;
- exact scores;
- successful predictions;
- calculated predictions;
- rank.

Ranking order retains the current tie-break behavior unless implementation proves an existing rule must change for cross-competition data.

`Рейтинг` and Profile must stop reading Serie-A-only totals as the final product total once external predictions are enabled.

The aggregation must be server-side. The browser must not calculate the global rank by merging partial lists.

Existing Serie A predictions and users remain valid without migration into the external tables.

## 15. API boundaries

Do not replace the current production Serie A prediction API path merely to make the architecture look uniform.

Recommended separation:

### 15.1 Existing Serie A path

Continue using the current proven state/save mechanism for Serie A.

### 15.2 New external prediction service

Add a focused server-side API capable of:

- external competition state by competition + stage/round;
- save external predictions;
- retrieve attached user predictions;
- normalized status/live/result data;
- unified stats;
- unified standings/rating;
- settlement/sync support for scheduled server execution.

All user-facing endpoints validate Telegram init data using the same authorization/subscription contract as the current production application.

No BSD key or database service secret is exposed to browser JavaScript.

A feature flag/capability gate should keep the external prediction path disabled until schema, API and production UI verification are complete.

## 16. 15-second refresh across the application

The user requirement is global:

**Every application tab refreshes its currently visible data every 15 seconds.**

This applies to:

- Прогнозы;
- Мои прогнозы mode;
- Матчи;
- Рейтинг;
- Таблицы;
- Профиль;
- other existing primary tabs/screens that expose refreshable server data.

Implementation behavior:

- one central refresh scheduler;
- interval: 15,000 ms;
- refresh only the currently visible screen, not every tab in parallel;
- pause polling when `document.hidden === true` / Mini App is backgrounded;
- immediately refresh on visibility return;
- immediately refresh when moving to a screen whose data may be stale;
- do not start a second request for the same resource while the previous request is still in flight;
- stale/out-of-order responses cannot overwrite newer state;
- quiet refresh must patch/update data without resetting navigation, selected competition, selected stage or local unsaved draft;
- refresh failure preserves the last good state and retries on the next eligible tick.

For prediction edit mode, a quiet refresh must never erase unsaved local score drafts. It may only update authoritative match status/deadline/result metadata around them. If a match closes while a draft exists, that draft becomes non-saveable and the UI must clearly show the closed state.

## 17. Live update behavior

Every 15-second refresh can update:

- live score;
- minute;
- halftime;
- extra time;
- penalties;
- finished state;
- awarded points after settlement;
- standings/rank;
- tournament tables where applicable.

No full-screen loader is shown for quiet refresh when usable data is already rendered.

Initial load and explicit retry may use the normal loading state.

## 18. Error handling and stale data

External BSD failure must not destroy the user's prediction experience.

If fresh provider data cannot be obtained:

- return/use the latest persisted external match snapshot where available;
- keep saved predictions visible;
- do not blank the stage;
- mark data stale internally and expose a compact retry/error state only when necessary;
- never silently reopen a match whose persisted deadline has already passed.

Prediction save failures must be explicit and must not falsely show `Сохранено`.

Partial batch save response must identify how many predictions were saved and which matches were rejected because their deadline closed.

## 19. Interaction with the existing Matches tab

The approved `Матчи` tab remains the visual/data reference for external tournament identity.

Shared product rules:

- same tournament names;
- same theme colors;
- same Russian team localization;
- same external competition filtering;
- same stage chronology;
- same normalized live states;
- same BSD crest format;
- same Italian club profile behavior;
- no external Match Center.

Predictions must not fork into a contradictory tournament model.

The global 15-second visible-screen refresh requirement replaces the earlier 30-second external Matches polling interval.

## 20. Testing strategy

Implementation follows TDD.

Required automated coverage includes at least:

### Data model / identity

- unique external identity is competition + BSD event id;
- provider date/stage/name correction updates the same match row;
- same BSD id in different competitions cannot collide;
- Coppa stale duplicate does not become a second prediction match.

### Competition filters

- Coppa excludes pre-1/16 stages;
- UEFA excludes matches without Italian clubs;
- one or two Italian participants are retained.

### Deadline

- write succeeds before kickoff −15 minutes;
- create fails at/after deadline;
- update fails at/after deadline;
- rescheduled authoritative kickoff changes deadline correctly;
- client-supplied time cannot bypass server validation.

### Batch save

- multiple predictions save with one action;
- invalid score is rejected;
- a newly closed match does not corrupt valid open-match saves;
- repeated save upserts rather than duplicates.

### Scoring

- exact -> 5;
- correct goal difference -> 3;
- correct outcome -> 2;
- miss -> 0;
- draw handling is correct;
- repeated settlement is idempotent;
- no x2 multiplier is applied.

### Legacy x2 removal

- active UI/API exposes no bonus selection;
- unified calculation ignores legacy bonus metadata;
- historical normalization audit detects point/base-point mismatch safely before any rewrite.

### Unified standings

- Serie A-only user points remain present;
- external-only points are present;
- mixed points sum correctly;
- exact/successful/calculated totals combine correctly;
- rank ordering uses combined points.

### UI navigation

- one bottom `Прогнозы` tab;
- permanent `Прогнозы | Мои прогнозы` switch;
- five-card tournament hub;
- selected competition/stage survives mode switch;
- back returns to prediction tournament hub;
- tournament theme matches `Матчи`.

### Prediction cards

- edit controls only before deadline;
- read-only after deadline;
- `Сохранено` reflects server-confirmed state;
- `Прогноз не сделан` renders explicitly;
- external cards do not open Match Center;
- Italian club can open profile;
- foreign club cannot.

### Status normalization

- scheduled;
- LIVE + minute;
- halftime -> `ПЕРЕРЫВ`;
- extra time -> `ДОП. ВРЕМЯ`;
- penalties -> `ПЕНАЛЬТИ`;
- finished;
- postponed;
- cancelled.

### 15-second refresh

- interval is exactly 15 seconds;
- only visible/current screen refreshes;
- hidden document pauses refresh;
- visibility return refreshes immediately;
- in-flight request is not duplicated;
- stale response cannot overwrite newer state;
- quiet refresh preserves selected tournament/stage;
- quiet refresh preserves unsaved prediction drafts;
- closed-during-draft match becomes non-saveable without deleting unrelated drafts.

### Failure resilience

- BSD outage retains last good match snapshot;
- saved predictions remain visible during provider failure;
- batch save failure does not show false saved state;
- malformed external row cannot break entire stage.

## 21. Production rollout and verification

Implementation happens on `main` following the existing project workflow.

`stable` remains untouched until explicit visual approval.

Recommended rollout order:

1. schema + server tests;
2. external prediction API behind disabled capability/feature flag;
3. settlement and unified ranking tests;
4. prediction UI/runtime tests;
5. global 15-second scheduler tests;
6. deploy production code with external prediction capability still controlled;
7. smoke test with authenticated production data;
8. enable external predictions;
9. visual/mobile acceptance by user;
10. only then promote `stable`.

Production acceptance checklist:

1. `Прогнозы` opens without regression.
2. Permanent `Прогнозы | Мои прогнозы` switch is present.
3. Five tournament cards match `Матчи` styling.
4. All five competitions open.
5. Serie A existing prediction saving still works.
6. Coppa starts at 1/16.
7. UEFA displays only Italian-club fixtures.
8. Stage selectors match the approved compact format.
9. External prediction saves persist after reload.
10. Deadline locks at exactly −15 minutes.
11. `Мои прогнозы` shows saved prediction, real score/status and points.
12. Missing prediction says `Прогноз не сделан`.
13. `ПЕРЕРЫВ`, `ДОП. ВРЕМЯ` and `ПЕНАЛЬТИ` render correctly when state is available or via deterministic fixture test.
14. External cards never open Match Center.
15. Italian club profile navigation works.
16. Combined Rating includes Serie A + external points.
17. Profile totals are combined.
18. x2 controls are absent and active calculations are plain 5/3/2/0.
19. Visible screen refreshes every 15 seconds.
20. Backgrounding pauses requests and returning refreshes immediately.
21. Quiet refresh does not erase an unsaved draft.
22. Existing `Матчи`, `Рейтинг`, `Таблицы`, `Профиль` remain functional.
23. `stable` has not moved before explicit approval.

## 22. Rollback

`stable` remains the guaranteed rollback point throughout implementation and visual review.

The immutable archival backup remains untouched.

Database migrations must be additive and backward-compatible so the current production frontend can continue operating if the new external prediction capability is disabled.

Do not drop legacy Serie A tables during this work.

## 23. Out of scope

Not included in this implementation:

- foreign club profiles;
- external Match Center;
- changing the 5/3/2/0 scoring rules;
- automatic per-click score autosave;
- migrating Serie A predictions into external tables;
- replacing the existing Serie A provider/model;
- official tournament logo packs;
- a broad v23.x frontend migration;
- unrelated QPTG database/security changes.

## 24. Success criteria

The feature is successful when a user can enter the single `Прогнозы` tab, switch between `Прогнозы` and `Мои прогнозы`, choose any of five competitions, make and save predictions under the same −15 minute rule, follow live and final states in the tournament's own visual style, and see all Serie A/Coppa/UEFA points reflected in one Rating and one profile statistic set, with no x2 mechanics and with the current visible application screen refreshing every 15 seconds without UI resets or loss of unsaved drafts.