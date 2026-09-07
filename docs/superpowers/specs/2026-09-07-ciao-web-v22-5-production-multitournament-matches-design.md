# Ciao, Web! v22.5 — Production multi-tournament Matches redesign

Date: 2026-09-07
Status: Approved design, awaiting implementation plan
Target branch: `main`
Stable branch must remain untouched until production is visually accepted.

## 1. Goal

Rework the existing production `Матчи` tab without rebuilding the application architecture.

The result must keep the current v22.5 product language and the visual structure of the existing Serie A match screen, while adding five competitions:

- Серия А
- Кубок Италии
- Лига Чемпионов
- Лига Европы
- Лига Конференций

The work must not be a blind copy of the old v23.2 test implementation. The old TEST code is reference material for data contracts, BSD integration, filtering rules, stage grouping and error cases only. Production UI and integration must be adapted to the current v22.5 runtime and current styling.

## 2. Bottom navigation

Rename labels only. Existing routes/actions remain unchanged unless the current runtime requires a minimal adapter.

- `Мои прогнозы` -> `Прогнозы`
- `Таблица` -> `Рейтинг`
- `Серия А` -> `Таблицы`
- `Матчи` remains `Матчи`
- `Профиль` remains unchanged

No icon, ordering or navigation-logic redesign is part of this task.

## 3. Matches hub

Opening the `Матчи` bottom-navigation item must show a tournament selection hub instead of directly opening the Serie A calendar.

### 3.1 Tournament cards

Five premium tournament buttons:

1. Серия А
2. Кубок Италии
3. Лига Чемпионов
4. Лига Европы
5. Лига Конференций

Layout:

- Serie A card spans the full row.
- Remaining four cards form a 2x2 grid where screen width allows it.
- On narrow screens the grid must remain readable without horizontal page scrolling.

Card content:

- tournament name only;
- subtle arrow / navigation affordance;
- no small explanatory subtitle;
- no dependency on tournament logos or external logo packs.

All cards share one component structure and interaction pattern. Tournament identity is expressed through theme colors, gradients and subtle lighting only.

## 4. Competition screen visual system

All five competition screens must use one shared design system based on the current Serie A match screen.

The following remain structurally identical across competitions:

- hero/header geometry;
- round/stage switcher pattern;
- match-card geometry;
- team crest sizing;
- typography;
- spacing and radii;
- live-score layout;
- loading and empty states;
- interaction behavior.

Only the tournament visual theme changes.

### 4.1 Tournament themes

- Serie A: keep the current saturated blue identity.
- Coppa Italia: dark graphite base with restrained Italian green/red accents.
- Champions League: deep navy / indigo / violet highlights.
- Europa League: near-black graphite with orange accent.
- Conference League: dark emerald base with green accent.

The theme must primarily affect the hero/cover, active round/stage switcher and small decorative accents. Match cards must remain recognizably the same application component.

## 5. Round and stage navigation

Keep the same horizontal round selector behavior currently used by Serie A.

### 5.1 Serie A

Use championship rounds as today.

### 5.2 Coppa Italia

Display only matches from the Round of 32 onward:

- 1/16 финала
- 1/8 финала
- 1/4 финала
- 1/2 финала
- Финал

Earlier Coppa Italia stages must not appear in this UI.

### 5.3 European competitions

For league-phase matches use combined stage + round labels:

- Общий этап · 1 тур
- Общий этап · 2 тур
- etc.

Then use knockout-stage labels:

- playoff stage when present in BSD data, normalized to a user-facing Russian label;
- 1/8 финала
- 1/4 финала
- 1/2 финала
- Финал

Stage ordering must follow tournament chronology, not alphabetical order.

## 6. Match cards

Use the current Serie A match-card layout as the visual baseline.

Each card contains:

- home crest + team name;
- central score or kickoff time;
- away team name + crest;
- live status/minute when relevant.

Do not add extra metadata under every match unless it already exists in the current Serie A design and is necessary for status clarity.

### 6.1 Match states

Before kickoff:

- show kickoff time;
- no live badge;
- no fake score.

Live:

- show current score;
- show `LIVE`;
- show current minute when BSD/current provider supplies it.

Finished:

- show final score;
- live badge disappears.

Postponed:

- show a Russian postponed status.

Cancelled:

- show a Russian cancelled status.

Malformed or incomplete provider rows must not break rendering of the whole competition.

## 7. Club click behavior

Only Italian clubs are interactive on external-tournament match cards.

### 7.1 Italian clubs

Click/tap on the crest + club-name area opens the existing production club profile.

The profile must reuse the current club-profile implementation and BSD crest path already deployed in production.

### 7.2 Foreign clubs

Foreign clubs are visually rendered with the same crest/name quality, but:

- are not clickable;
- do not get hover/active affordances that imply navigation;
- do not open a match center or club profile.

Italian club detection should prefer stable BSD team identity / country metadata rather than name-only heuristics.

## 8. Match-center scope

No new match center is part of this version for:

- Coppa Italia
- Champions League
- Europa League
- Conference League

Clicking the match card itself must not open a match center for these competitions.

Serie A existing behavior should remain unchanged unless a minimal compatibility guard is required by the new hub.

## 9. Data sources

### 9.1 Serie A

Keep the current working production data source and current live-update behavior.

Do not migrate Serie A to BSD as part of this task.

### 9.2 Coppa Italia and UEFA competitions

Use BSD as the provider.

The old v23.2 TEST modules may be used as contract references for:

- competition key mapping;
- BSD league lookup;
- current-season resolution;
- event pagination;
- team normalization;
- crest URL generation;
- live status normalization;
- score normalization;
- stage/round extraction;
- Italian-club filtering;
- upstream-error normalization.

They must not be copied wholesale into production without review against the current v22.5 runtime.

## 10. Competition filtering rules

### 10.1 Coppa Italia

Fetch the current-season Coppa Italia event set, then display only Round of 32 and later.

All participating clubs in those stages are displayed.

### 10.2 Champions League, Europa League, Conference League

Display only matches where at least one participating team is Italian.

The provider-side / adapter-side Italian filter must rely on BSD team identity or country metadata.

The UI must not receive a large unfiltered European calendar and then rely only on client-side name filtering.

## 11. Team and crest normalization

BSD team IDs are the canonical identity for external competitions.

BSD crest format remains:

`https://sports.bzzoiro.com/img/team/<BSD_TEAM_ID>/?bg=transparent`

External match normalization must produce one stable team shape containing at minimum:

- team id;
- display name;
- country code / Italian flag;
- crest URL.

Existing production local-Serie-A-ID -> BSD-ID compatibility remains available for opening current club profiles.

No Telegram `custom_emoji_id` dependency is allowed in the new match rendering path.

## 12. Live refresh behavior

External competition screens must update live score/status automatically in a way consistent with current Serie A behavior.

Requirements:

- no full-page navigation or visual reset on each refresh;
- selected competition and selected stage/round remain stable;
- score, minute and status can update in place;
- finished matches transition cleanly from LIVE to final score;
- stale/out-of-order requests must not overwrite newer state;
- refresh failure must preserve the last successfully rendered data rather than blanking the screen.

The exact polling interval will be chosen in the implementation plan based on the existing Serie A behavior and BSD limits; the visual contract is that live data feels current without aggressive unnecessary requests.

## 13. Error and empty states

If one external tournament cannot be loaded:

- show a compact in-style error state inside that tournament screen;
- provide a retry action;
- do not break bottom navigation or other tournaments.

If a stage has no matches after filtering, do not render a misleading empty round tab unless it is required for chronology.

If the whole selected competition has no current-season matches, show a clear Russian empty state.

## 14. Production integration boundaries

Current production is built from the resolved v22.5 release and receives narrowly scoped production patches at build time.

This redesign must therefore be implemented as a bounded production integration layer, not by replacing the application with the old v23.2 test frontend.

Expected architectural units:

1. production multi-tournament data/provider module;
2. production match normalization + filtering helpers;
3. production matches UI/runtime patch integrated into the existing v22.5 final IIFE / existing runtime hooks;
4. minimal production worker/API route for external competitions if required by the BSD secret boundary;
5. focused tests for each unit and for build-time injection.

If implementation reveals that the production worker must gain server-side BSD fetching, this remains within scope, but the BSD API key must never be exposed to browser JavaScript.

## 15. Reuse policy for old TEST code

The old `cloudflare-test/src/v23.2` implementation is reference material, not source-of-truth production code.

Allowed reuse:

- verified competition keys;
- provider endpoint strategy;
- normalization rules that still match BSD responses;
- Italian filtering concept;
- chronological grouping concept;
- stale-request guarding concept;
- known error cases and tests.

Must be redesigned/adapted:

- production UI markup;
- CSS and tournament cards;
- hooks into bottom navigation;
- integration with current v22.5 state/render lifecycle;
- Italian-club click-to-profile behavior;
- Serie A coexistence;
- live refresh integration;
- production worker route/configuration.

No whole-file copy from TEST into production is accepted without explicit line-by-line justification in implementation review.

## 16. Testing strategy

Implementation follows TDD.

Required automated coverage includes:

### Navigation

- new bottom-nav labels are present;
- existing navigation targets still resolve correctly;
- `Матчи` opens the tournament hub.

### Hub

- exactly five tournament cards render;
- Serie A + four external competitions map to correct keys;
- no explanatory subtitles are rendered.

### Data normalization

- BSD team IDs and crests normalize correctly;
- live, finished, scheduled, postponed and cancelled statuses normalize correctly;
- live score and minute propagate correctly;
- malformed rows are isolated.

### Filters

- Coppa Italia excludes stages before 1/16;
- UCL/UEL/UECL exclude matches with no Italian club;
- matches with one or two Italian clubs are retained;
- foreign opponent remains visible.

### Grouping

- Serie A remains round-based;
- European league phase groups by official round;
- knockout stages are chronological;
- Coppa stages are chronological.

### Club interaction

- Italian club control opens existing club profile with the correct local/BSD mapping;
- foreign club has no navigation action;
- external match card itself does not open match center.

### Live refresh

- newer response wins over stale response;
- refresh updates score/minute without resetting selected stage;
- temporary refresh error preserves previous rendered data.

### Build/integration

- runtime patch injects once;
- existing BSD crest patch still applies;
- legacy Telegram emoji compatibility is not reintroduced;
- production HTML remains syntactically valid;
- existing production tests remain green.

## 17. Verification before production acceptance

Before declaring the feature complete, verify the deployed production build, not only local/unit output.

Required checks:

1. production root returns HTTP 200;
2. bottom labels are correct;
3. matches hub displays five cards;
4. each of five competitions opens;
5. Serie A still behaves as before;
6. Coppa Italia starts at 1/16;
7. each European competition contains only Italian-club matches;
8. stage/round selector is usable on mobile width;
9. live score/minute is visible for a live fixture or verified by deterministic test fixture if no match is live at deployment time;
10. Italian club opens existing profile;
11. foreign club is not clickable;
12. no external match center opens;
13. BSD crests render;
14. no regression in Прогнозы, Рейтинг, Таблицы, Профиль;
15. stable branch remains unchanged until the user visually approves production.

## 18. Rollback

`stable` remains the rollback point during implementation and visual review.

Do not promote `stable` automatically after deployment. Promotion happens only after explicit user confirmation that the production version is good.

The immutable archival backup branch remains untouched.

## 19. Out of scope

Not included in this version:

- predictions for Coppa Italia or European matches;
- points/rating changes based on external tournaments;
- match center for external competitions;
- foreign club profiles;
- tournament standings/tables inside the Matches tab;
- official tournament logo asset packs;
- migrating Serie A provider to BSD;
- broader v23.x architecture migration.

## 20. Success criteria

The change is successful when the user can open `Матчи`, choose any of five competitions, browse the current season using the same familiar Serie A-style round selector and match cards, see correct themed tournament visuals and live score/status, and open profiles only for Italian clubs, while the rest of the current production app remains unchanged and stable.