# Ciao, Web! — Modular Production Rework Design

## Status

Approved direction: evolve the current production application incrementally, preserving the existing production experience while replacing only the requested areas with a clean modular architecture.

Baseline branch: `main`
Baseline commit: `f697bd8c7055bc657631098bd914ffe082539804`
Production implementation: `cloudflare-production/`
Current API/provider: unchanged.

## Product goal

Keep the currently used production app visually and functionally stable outside the explicitly redesigned areas, while rebuilding the following parts on a maintainable modular foundation:

1. Favorite club — nearest upcoming match card.
2. `Serie A` home section → `Кальчо сегодня`.
3. Predictions moved off the home screen into a renamed `Прогнозы` section.
4. `Прогнозы` screen with `Прогнозы` / `Мои прогнозы` sub-navigation.
5. `Таблица` → `Рейтинг` with three ranking scopes.
6. Full redesign of the `Матчи` section around tournament cards and tournament-specific presentation.
7. `Серия А` tables section → `Таблицы`, adding UCL/UEL/UECL tables.
8. One shared Match Center structure for every supported tournament.
9. Correct browser/system/in-app Back navigation with state restoration.

The rest of the current production application remains unchanged unless a dependency must be touched to support these areas.

---

# 1. Architectural approach

## Chosen approach

Incremental modular migration over the current production version.

We do **not**:
- rewrite the entire frontend from zero;
- continue stacking one-off RoundXX UI/runtime patches;
- introduce a second parallel Match Center runtime;
- replace the current API/provider;
- change scoring rules.

We **do** introduce a clean modular layer for the redesigned areas with explicit ownership and shared services.

## Core modules

### App Router

A single router owns screen navigation and browser history for all migrated screens.

Responsibilities:
- open a screen;
- open Match Center;
- restore the previous screen;
- synchronize `history.pushState` / `popstate`;
- preserve sub-tab state;
- preserve scroll position;
- prevent empty-screen states after Back navigation.

There must be no Match Center-specific competing history handler.

### Navigation State

Stores enough state to restore the exact previous UI:
- screen id;
- selected top-level section;
- selected inner tab/filter;
- tournament selection;
- scroll position;
- source from which Match Center was opened;
- selected match id.

Both the in-app Back button and browser/system Back use the same state transition path.

### Tournament Registry

One source of truth for supported tournaments:

- Serie A
- Coppa Italia
- UEFA Champions League
- UEFA Europa League
- UEFA Conference League

Each tournament config contains:
- canonical id;
- display name;
- tournament logo/icon reference;
- theme tokens;
- card style tokens;
- Match Center theme tokens;
- API competition mapping;
- availability rules;
- whether it participates in rankings/tables/fixtures.

This avoids tournament-specific hardcoded UI branches scattered through screens.

### Data Service

One adapter layer over the existing API.

Responsibilities:
- normalize match data from every supported tournament into one match model;
- normalize standings/table data;
- expose favorite-club next match;
- expose `Кальчо сегодня` matches;
- expose prediction-eligible matches;
- expose ranking aggregates;
- expose Match Center sections;
- filter European competitions to Serie A clubs only where required.

The API/provider is not replaced.

### Live Engine

Shared live-update owner for active match data.

Responsibilities:
- poll/refresh active matches at a controlled cadence;
- update scores/status/events without remounting whole screens;
- stop polling when the screen is inactive;
- reuse the same normalized data model across `Кальчо сегодня`, `Матчи` and Match Center;
- degrade gracefully if a refresh fails.

No screen implements its own independent live loop.

### Screen Modules

Migrated screens are isolated modules:
- Favorite Club
- Кальчо сегодня
- Прогнозы
- Рейтинг
- Матчи
- Таблицы
- Match Center

Each screen owns rendering and local UI state, while data/navigation/live responsibilities remain in shared services.

---

# 2. Favorite club — upcoming match

The favorite-club area shows exactly **one nearest upcoming match**, regardless of competition.

Supported competitions:
- Serie A
- Coppa Italia
- UCL
- UEL
- UECL

Requirements:
- show club logos, including the favorite club logo;
- show opponent;
- show competition;
- show date/time;
- visually premium but consistent with the current app;
- the **entire match card is clickable**;
- clicking anywhere on the card opens that match directly in the shared Match Center.

The chosen match is the chronologically nearest future match among all supported competitions.

---

# 3. `Кальчо сегодня`

The current `Серия А` section is renamed to **`Кальчо сегодня`**.

## Content rule

Show every match taking place **today** that:
- exists in the application;
- belongs to a supported competition;
- contains at least one Serie A club.

This can include:
- Serie A;
- Coppa Italia;
- UCL;
- UEL;
- UECL.

## Presentation

Matches are rendered as premium live cards.

Each card includes, where data is available:
- tournament identity;
- club logos;
- team names;
- score;
- kickoff time / live minute / finished status;
- live status indicator;
- compact important match state.

Live matches update automatically using the shared Live Engine.

The full card opens Match Center.

## Empty state

If there are no qualifying matches today, show a polished empty state with the exact copy:

**`Кальчо сегодня нет :(`**

Do not replace it with upcoming matches.

---

# 4. Predictions

## Navigation change

Remove prediction UI from the Home screen.

Rename the current `Мои прогнозы` top-level section to:

**`Прогнозы`**

Inside it, add two top controls:
- `Прогнозы`
- `Мои прогнозы`

Default active mode: **`Прогнозы`**.

## `Прогнозы` mode

Shows matches currently available for prediction using the existing prediction logic, deadlines and scoring rules.

## `Мои прогнозы` mode

Shows only predictions already made by the current user.

Existing prediction data and scoring behavior remain unchanged.

---

# 5. Ranking

Rename the current `Таблица` section to:

**`Рейтинг`**

Existing points/scoring rules stay unchanged.

Add three scopes:

### `Все`
All supported prediction competitions combined.

### `Италия`
Only:
- Serie A
- Coppa Italia

### `Еврокубки`
Only:
- UCL
- UEL
- UECL

The same scoring formula is used in all scopes; only the included prediction set changes.

## Visual redesign

Keep current ranking functionality but present it in a more premium hierarchy:
- strong top-3 treatment;
- clear current-user position;
- readable movement/position information where currently supported;
- compact rows below the podium/top area;
- no loss of existing ranking functionality.

---

# 6. Matches — complete redesign

The `Матчи` section is rebuilt as a tournament-first experience.

It does **not** use a generic row of plain tabs as the main design.

## Tournament entry cards/buttons

Create a distinct premium entry treatment for:
- Serie A
- Coppa Italia
- UCL
- UEL
- UECL

Each tournament receives its own visual identity while retaining a coherent app-wide structure.

Suggested theme direction:
- Serie A — blue / premium calcio identity;
- Coppa Italia — red/green Italian cup identity;
- UCL — dark blue / purple night identity;
- UEL — orange / dark identity;
- UECL — green / dark identity.

The exact tokens are centralized in Tournament Registry.

## Competition inclusion rules

### Serie A
Normal Serie A fixtures from the current API.

### Coppa Italia
Include matches starting from the **Round of 16 (1/8 final)** onward.

### European cups
Include only matches involving Serie A clubs.

Competitions:
- Champions League;
- Europa League;
- Conference League.

Qualification rounds are excluded.

## Tournament screen

Selecting a tournament opens a tournament-specific fixture screen using the common match data model but tournament theme tokens.

Every match card opens the shared Match Center.

Live status uses the shared Live Engine.

---

# 7. Tables

Rename the current `Серия А` tables/navigation section to:

**`Таблицы`**

Add separate tournament presentations for:
- Serie A
- UCL
- UEL
- UECL

Coppa Italia is **not included for now**.

Each competition gets its own visual treatment based on Tournament Registry, but table interaction/layout behavior stays structurally consistent.

The current API remains the data source.

---

# 8. Shared Match Center

There is exactly **one Match Center structure** for all supported competitions.

Supported competitions:
- Serie A
- Coppa Italia
- UCL
- UEL
- UECL

The layout/behavior is common; only tournament theme/data changes.

## Match Center tabs

Final initial tab set:
- `Обзор`
- `Статистика`
- `События`
- `Составы`
- `Игроки`

The existing **`Контекст Серии А`** tab is removed completely.

## Theming

Match Center receives a tournament id and resolves its design from Tournament Registry.

No competition receives a separate Match Center implementation.

## Entry points

The same Match Center can be opened from:
- Favorite Club upcoming match;
- Кальчо сегодня;
- Матчи;
- Прогнозы where relevant;
- any other migrated match card later.

---

# 9. Back navigation and empty-screen prevention

This is a hard acceptance requirement.

When a user opens a match, the router records the full origin state.

Example:

`Матчи → UCL → scroll position → Match Center`

Back must restore:

`Матчи → UCL → same scroll position`

Likewise:

`Кальчо сегодня → Match Center → Back`

returns to `Кальчо сегодня` in the same state.

Both navigation methods behave identically:
- Match Center's visible Back button;
- browser/mobile system Back.

## Rules

- No direct DOM teardown may leave the app without an active screen.
- Match Center never owns a second independent router.
- Closing Match Center is a router transition, not simply hiding/removing DOM.
- A safe fallback route exists if historical state is invalid.
- Scroll restoration occurs after the target screen is rendered.

Fallback destination when origin state cannot be restored: the last valid top-level app screen, otherwise Home.

---

# 10. Error handling

## Data/API errors

A failed API refresh must not blank a working screen.

Rules:
- preserve the last successfully rendered data where possible;
- show a compact non-blocking refresh/error state;
- allow manual retry where useful;
- Live Engine retries using controlled backoff;
- Match Center section errors are isolated to the failed section where possible.

## Missing tournament data

If a competition has no usable data, show a designed empty state rather than a broken or empty container.

## Navigation errors

Invalid or stale route state resolves to a valid safe screen and never to a blank page.

---

# 11. Testing strategy

The modular migration must add focused tests rather than relying only on visual checks.

## Unit tests

- tournament mapping and theme resolution;
- match normalization;
- `Кальчо сегодня` eligibility filtering;
- favorite-club nearest-match selection;
- Coppa Italia Round-of-16+ filtering;
- Serie A club filtering for UCL/UEL/UECL;
- ranking scope aggregation;
- prediction screen mode filtering.

## Router/navigation tests

Critical scenarios:
- Favorite Club → Match Center → Back;
- Кальчо сегодня → Match Center → Back;
- Матчи → each tournament → Match Center → Back;
- browser `popstate` follows the same path;
- sub-tab is restored;
- scroll position is restored;
- invalid history state never yields a blank screen.

## Match Center contract tests

For all five competitions:
- one Match Center runtime only;
- same tab structure;
- `Контекст Серии А` absent;
- correct tournament theme resolved;
- correct match data loaded.

## Live tests

- active matches refresh;
- non-active screens do not continue unnecessary polling;
- update failure retains previous data;
- live status changes render without full-page remount.

## Regression checks

Screens outside this migration scope are compared against the production baseline and should remain behaviorally unchanged.

---

# 12. Migration order

To reduce risk for active users, the work is introduced in isolated stages rather than one large replacement.

Recommended sequence:

1. Core foundation: Tournament Registry, Data Service, Router/Navigation State.
2. Shared Match Center + Back behavior.
3. Favorite Club nearest-match card.
4. Кальчо сегодня + Live Engine.
5. Прогнозы migration from Home.
6. Рейтинг scopes + premium presentation.
7. Матчи complete tournament-first redesign.
8. Таблицы with UCL/UEL/UECL.
9. Full regression pass across unchanged production areas.
10. Only after explicit approval: merge/publish to production.

Each stage must be independently testable and must not introduce a second parallel runtime for the same responsibility.

---

# 13. Acceptance criteria

The redesign is ready for production review when all of the following are true:

- Existing non-targeted production areas remain unchanged.
- Current API/provider is still used.
- Favorite Club shows the nearest match across all supported competitions and the full card opens Match Center.
- `Кальчо сегодня` shows today's supported matches involving Serie A clubs and live-updates them.
- Empty Calcio state says `Кальчо сегодня нет :(`.
- Prediction controls are removed from Home.
- Top-level `Мои прогнозы` is renamed `Прогнозы`.
- `Прогнозы` defaults to the `Прогнозы` sub-view and includes `Мои прогнозы` as the second sub-view.
- `Таблица` is renamed `Рейтинг`.
- Ranking scopes are `Все / Италия / Еврокубки` with unchanged scoring rules.
- `Матчи` is tournament-first with dedicated premium treatments for Serie A, Coppa Italia, UCL, UEL and UECL.
- Coppa Italia fixtures begin at Round of 16.
- European fixtures shown in the app are restricted to Serie A clubs and exclude qualification.
- `Серия А` tables section is renamed `Таблицы` and supports Serie A/UCL/UEL/UECL.
- Coppa Italia is not yet included in `Таблицы`.
- Exactly one Match Center structure serves all five competitions.
- Match Center tabs are `Обзор / Статистика / События / Составы / Игроки`.
- `Контекст Серии А` is removed.
- In-app Back and system/browser Back restore the exact origin screen/sub-tab/scroll state.
- No Back path can leave an empty screen.
- Production deployment is performed only after explicit user approval.
