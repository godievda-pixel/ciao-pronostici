# Premium Match Center v2 — Design

Date: 2026-09-05
Scope: TEST/develop only until full verification. `main`/Production must remain untouched.

## Goal

Replace the current Match Center with a premium, app-native, tournament-aware implementation that is complete end-to-end: data contract, provider normalization, rendering, error states, responsive behavior and regression coverage.

The finished Match Center must:

- look materially more premium while remaining visually consistent with the existing Ciao, Web! app;
- have a distinct visual identity for Serie A, Coppa Italia, Champions League, Europa League and Conference League;
- show correct match facts without synthetic/fake values;
- show scorers under each team in the hero, including minute, penalty and own-goal markers;
- hide the visible system scrollbar while preserving scrolling;
- provide a detailed shot map plus a readable shot list in Stats;
- provide a premium chronological event timeline;
- provide starting lineups both on a football pitch and as text lists;
- keep the existing five-tab navigation and existing `/api/v23.3/match-center` client contract entrypoint so current navigation does not need a parallel migration.

## Architectural decision

Use an additive upgrade of the existing canonical Match Center instead of creating a parallel v23.4 runtime.

Reasons:

1. The app already has a stable canonical endpoint, store, lifecycle, renderer split and five sections.
2. The current issues are missing richness and inconsistent presentation, not a need for a second navigation/runtime stack.
3. Additive fields keep existing consumers and older tests valid while allowing premium renderers to consume richer data.
4. Provider-specific logic stays in adapters; renderers remain provider-agnostic.

No UI renderer may read raw provider payloads directly.

## Existing architecture retained

The following boundaries remain:

- `match-center-contract.mjs` — base API contract.
- `match-center-sections.mjs` — canonical rich section data.
- `serie-a-match-center-*` — Serie A provider normalization.
- `bsd-match-center-adapter.mjs` — Coppa/UEFA normalization.
- `match-center-store.mjs` / lifecycle / repository — state and lazy section loading.
- `match-center-view.mjs` — premium shell and hero.
- section renderers: overview, stats, events, lineups, players.
- `match-center-theme.mjs` — the only source of competition-specific visual tokens.

## Canonical data contract upgrade

### Base match

Keep existing base fields and add optional hero data:

```js
{
  competition,
  matchId,
  status,
  minute,
  kickoffAt,
  homeTeam,
  awayTeam,
  score,
  venue,
  referee,
  coverage,
  updatedAt,
  goals: {
    home: GoalSummary[],
    away: GoalSummary[]
  }
}
```

`GoalSummary`:

```js
{
  player: string,
  minute: number | null,
  addedTime: number | null,
  kind: 'open_play' | 'penalty' | 'own_goal' | 'free_kick' | 'unknown',
  scoreAfter: { home:number|null, away:number|null } | null
}
```

Rules:

- `penalty` must render `(П)`.
- `own_goal` must render `(АГ)`.
- added time renders as `45+2′`.
- do not infer own goal or penalty from score alone.
- if provider has no event qualifier, use `unknown`, never fabricate a marker.
- render one hero line per goal, sorted by match minute, so every qualifier remains unambiguous.

### Events

Extend canonical events additively:

```js
{
  type,
  minute,
  addedTime,
  side,
  player,
  assist,
  reason,
  playerIn,
  playerOut,
  homeScore,
  awayScore,
  text,
  goalKind,
  cardKind,
  varDecision
}
```

Supported visual event families:

- goal;
- yellow/red card;
- substitution;
- VAR;
- penalty event;
- period start/half/full time;
- neutral/unknown event fallback.

Unknown events must remain readable rather than disappear.

### Stats and shots

Keep the existing aggregate stats object and extend the Stats section to:

```js
{
  home: CanonicalStatSide,
  away: CanonicalStatSide,
  shots: CanonicalShot[]
}
```

`CanonicalShot`:

```js
{
  side: 'home' | 'away',
  x: number | null,
  y: number | null,
  minute: number | null,
  addedTime: number | null,
  player: string,
  assist: string,
  xg: number | null,
  outcome: 'goal' | 'saved' | 'off_target' | 'blocked' | 'post' | 'unknown',
  situation: 'open_play' | 'set_piece' | 'corner' | 'free_kick' | 'penalty' | 'unknown',
  bodyPart: string,
  goalKind: 'open_play' | 'penalty' | 'own_goal' | 'free_kick' | 'unknown'
}
```

Coordinate policy:

- canonical plotted coordinates use a 0–100 football-pitch coordinate system;
- provider-specific adapters may convert a documented provider scale into 0–100;
- after conversion, out-of-range/non-finite coordinates become `null` rather than being moved to the pitch edge;
- shots without valid x/y remain in the textual shot list but are not plotted;
- never synthesize xG or shot coordinates.

Backward compatibility:

- existing `overview.shotmap` remains supported during migration;
- adapters should populate `stats.shots` from the richest available source and may derive the old overview shotmap from it for legacy tests until those tests are deliberately migrated.

### Lineups

Extend lineup players additively:

```js
{
  playerId,
  name,
  position,
  shirtNumber,
  x: number | null,
  y: number | null,
  grid: string,
  starter: boolean
}
```

Each side keeps:

```js
{
  formation,
  starters,
  substitutes,
  coach: string
}
```

Pitch placement policy:

1. If provider supplies usable x/y coordinates, use them.
2. Else if provider supplies a grid token, map the grid deterministically.
3. Else use formation-aware deterministic placement from `formation` and starter order/position groups.
4. If formation is invalid or starters are insufficient, show the text list and a clear `Схема недоступна` pitch state. Never invent a tactical shape that contradicts the provider.

## Provider strategy

### Serie A

`serie-a-match-center-legacy-normalizer.mjs` and `serie-a-match-center-adapter.mjs` remain the boundary for legacy payloads.

Required additions:

- preserve event goal qualifiers, penalty/own-goal flags and score-after-event;
- normalize detailed shot fields, not only x/y/xG;
- normalize lineup coordinates/grid/coach when present;
- derive hero goal summaries from canonical events.

For live/finished matches, the Match Center base response must have enough incident data to render hero scorers. If the stable summary response does not contain incidents, `serie-a-match-center-provider.mjs` may compose the base from summary + the minimum incident request server-side. The browser still performs one canonical base call.

Scheduled matches must not incur an unnecessary incident request when the provider clearly marks them as not started.

### Coppa Italia / UEFA

`bsd-match-center-adapter.mjs` must map the same canonical fields from BSD payloads. The renderers must not contain competition-specific data parsing.

For all competitions:

- missing provider data means an unavailable/empty state, not fake zeroes;
- provider aliases are accepted only in adapter/normalizer code;
- user prediction remains authoritative from the prediction backend as implemented in Round 45.

## Premium visual system

### Core principle

One premium component language, five competition identities.

Shared across all competitions:

- same spacing scale, typography hierarchy, radii and interaction behavior;
- deep app-native background;
- layered glass/dark surfaces rather than flat grey cards;
- subtle inner highlights and restrained glow;
- no decorative effect may reduce text contrast or data readability;
- no visible browser/WebView scrollbar inside Match Center.

Competition identity is applied only through `match-center-theme.mjs` variables and optional theme metadata.

### Expanded theme tokens

Each theme must provide at least:

```text
--mc-bg
--mc-bg-deep
--mc-surface
--mc-surface-2
--mc-surface-raised
--mc-border
--mc-border-strong
--mc-accent
--mc-accent-2
--mc-accent-soft
--mc-glow
--mc-pitch
--mc-pitch-line
--mc-home-marker
--mc-away-marker
```

Base text tokens remain high-contrast and app-consistent.

### Tournament identities

#### Serie A

- deep navy/blue app base;
- clean cyan-blue accent family;
- cool premium glow;
- closest visual relation to the existing Serie A Predictions screen.

#### Coppa Italia

- deep burgundy/black base;
- Italian red as primary accent;
- restrained green secondary accent;
- avoid a literal flag treatment across whole cards.

#### Champions League

- midnight indigo/blue-black base;
- electric royal blue + violet secondary glow;
- star-night feeling via subtle radial lighting only, no copied UEFA artwork.

#### Europa League

- graphite/burnt-black base;
- orange/amber accent;
- warmer surfaces than UCL while keeping app typography and geometry.

#### Conference League

- deep green/black base;
- emerald/lime-green accent family;
- avoid neon overload; green is an accent, not the whole background.

## Premium Match Center shell

`match-center-view.mjs` becomes the single premium shell.

### Scroll behavior

- scrolling remains native;
- hide scrollbar visually with both Firefox and WebKit rules;
- ensure the actual scrolling element and any overlay parent both have scrollbar suppression;
- do not set `overflow:hidden` on a container that needs vertical scrolling;
- preserve keyboard/touch scrolling.

### Header

- compact back button consistent with app controls;
- centered `Матч-центр` title;
- competition name and kickoff remain readable but visually subordinate.

### Hero scoreboard

Layout:

- team crest area left/right;
- team name;
- scorer list directly under each team name;
- central score/status;
- subtle competition-specific background light.

Scorer list rules:

- one line per goal, in chronological order;
- use compact typography; hero must remain readable at 320px width;
- long names wrap/ellipsis safely without overlapping score;
- for scheduled matches there is no scorer area.

Crests:

- real crest when available;
- premium neutral placeholder only when genuinely unavailable;
- no empty grey circle larger than the real crest footprint.

### Tabs

Keep five tabs:

`Обзор / Статы / События / Составы / Игроки`

- active state uses tournament accents;
- unavailable state remains visible but subdued;
- no layout shift during section loading;
- current lazy loading behavior remains.

## Overview

Keep the existing correct data from Round 45 and upgrade presentation:

- match facts card (stadium, city/capacity, referee);
- recent form with semantic W/D/L chips;
- user prediction + aggregate split;
- key match numbers if available;
- momentum only when actual provider data exists.

Do not duplicate the full shot map here once Stats owns the detailed shot experience. Overview may contain only a compact shot summary if shot data exists.

## Stats

Presentation order:

1. premium key metrics strip;
2. comparative stat rows;
3. shot map;
4. detailed shot list.

### Shot map

- football-pitch graphic built with CSS/SVG primitives owned by the app;
- home/away markers use theme marker colors;
- marker size may encode xG within safe min/max bounds;
- goal markers are visually strongest;
- penalty marker is distinct;
- accessible textual label is present for each plotted shot.

### Shot list

Each row shows available fields only:

- minute;
- player;
- team side;
- outcome;
- xG;
- situation / penalty marker;
- assist if supplied.

Do not show placeholder labels such as `xG —` unless the layout specifically requires a comparison cell; prefer omission for unavailable shot metadata.

## Events

Replace the current flat list with a premium match timeline.

Rules:

- chronological top-to-bottom order;
- home events visually anchor toward the home side, away events toward the away side, neutral period events centered;
- minute remains the visual anchor;
- goal card includes scorer, assist, score and qualifier `(П)`/`(АГ)`;
- cards use distinct but restrained semantic treatment for yellow card, red card, substitution, VAR and goal;
- halftime/full-time separators are full-width timeline markers;
- unknown provider event types fall back to readable text.

## Lineups

Presentation order:

1. team segmented control;
2. pitch view for the selected team;
3. formation label;
4. textual starters for both teams;
5. substitutes for both teams;
6. coach when available.

### Pitch view

- use one vertical pitch panel on mobile;
- a compact segmented control switches explicitly between home and away team; default is home;
- switching the pitch does not hide the authoritative text lists below;
- player marker shows shirt number and compact surname/name;
- long names must not overlap adjacent markers;
- formation-derived positions are deterministic and tested;
- text lists always remain below as the authoritative fallback.

## Players

Keep the existing player stats section but visually align cards with the premium shell. Player cards may show only fields the provider supplies: rating, goals, assists, xG, xA, shots, key passes, minutes.

## Responsive requirements

Primary viewport: Telegram/mobile WebView.

Must verify at minimum:

- 320×568;
- 360×640;
- 390×844;
- 430×932;
- desktop width >= 768px.

No horizontal page scroll is allowed.

Hero, tabs, event timeline, pitch player labels and shot map must remain within viewport at 320px.

## Error and empty-state policy

- A failed section must not destroy the already-loaded hero/base match.
- Retry remains per-section.
- `Данные пока недоступны` is used only when provider coverage is false/unavailable.
- `Нет событий` is valid for a successfully loaded Events section with a valid empty event array, including a legitimate 0:0 match.
- scheduled matches may legitimately have no events/stats/lineups.
- malformed provider shapes/types must fail normalization/tests rather than silently stringifying raw objects or inventing content.
- a valid but empty canonical array/object is not automatically treated as malformed.

## Testing strategy

All implementation is RED → GREEN TDD.

### Contract tests

Add tests for:

- goal summary normalization;
- penalty and own-goal qualifiers;
- added-time formatting;
- detailed canonical shot normalization;
- invalid shot coordinate handling;
- lineup grid/coordinate/formation fallback;
- backward compatibility of existing section/base keys.

### Provider tests

Fixtures for Serie A and BSD-based competitions must cover:

- finished match with multiple goals including penalty and own goal;
- shot map with goal/saved/off-target/blocked shots;
- lineup with explicit positions;
- lineup with formation-only fallback;
- valid empty section data;
- malformed provider data;
- missing/unavailable data paths.

### Renderer tests

Verify semantic output for:

- scrollbar suppression CSS;
- five tournament theme identifiers/tokens;
- hero scorer list;
- premium Stats shot map and shot list;
- premium Events timeline;
- lineup pitch, team switch and text fallback;
- 320px-safe responsive rules.

### Integration tests

For every supported competition key:

- open base match;
- switch all five tabs;
- confirm section lazy loading;
- confirm no raw provider object stringification (`[object Object]`, `undefined`, `null` UI leaks);
- confirm no supported tournament falls through to another tournament theme.

### CI / deployed TEST probes

Before merge to develop:

- full Node test suite GREEN;
- TEST artifact build GREEN;
- Worker validation GREEN.

After merge to develop:

- fresh push `verify` GREEN;
- Cloudflare `ciao-web-app-test` build GREEN;
- deployed Match Center probe GREEN;
- `main` SHA checked and unchanged.

## Implementation slicing

This is one final Match Center upgrade, but implementation should be committed in reviewable slices on one feature branch.

### Slice A — canonical richness

- extend event, shot and lineup canonical models;
- add hero goal summaries;
- update Serie A and BSD adapters;
- RED/GREEN provider and contract tests.

### Slice B — premium shell + themes

- expanded five-tournament theme system;
- scrollbar suppression;
- premium hero + scorer list;
- premium tabs/detail container;
- renderer tests.

### Slice C — Stats

- aggregate premium stats;
- shot map;
- detailed shot list;
- shot empty states and tests.

### Slice D — Events

- premium timeline;
- semantic goal/card/substitution/VAR/period presentation;
- tests.

### Slice E — Lineups + players

- pitch projection;
- explicit home/away segmented pitch switch;
- formation/grid/coordinate logic;
- text fallback, substitutes, coach;
- players visual alignment;
- tests.

### Slice F — final integration audit

- run all tests/builds;
- inspect every supported competition through canonical fixtures;
- search built source for stale old Match Center styling hooks that override new shell;
- verify no duplicate theme systems can win the CSS cascade;
- verify all five competition themes map to the intended tokens;
- merge only after complete TEST verification.

## Acceptance criteria

The upgrade is not considered finished until all are true:

1. Visible grey Match Center scrollbar is gone, scrolling still works.
2. Finished/live hero shows actual scorers under the correct team.
3. Penalty and own-goal markers are correct and data-driven.
4. Missing crests use a premium neutral fallback without layout breakage.
5. Serie A, Coppa Italia, UCL, UEL and UECL are visibly distinct but unmistakably part of the same app.
6. Stats contains detailed comparative numbers, a shot map and a detailed shot list when provider data exists.
7. Events is a premium chronological timeline and preserves all supported event metadata.
8. Lineups show a switchable pitch representation plus complete text lists when data exists.
9. No renderer reads raw provider payloads.
10. No fake zero, fake player, fake xG, fake lineup or fake event is introduced for missing data.
11. No horizontal overflow at 320px.
12. All old Round 39–45 Match Center regression tests either continue to pass unchanged or are deliberately updated only when the new canonical contract makes the old assertion obsolete.
13. Full branch CI, post-merge develop CI, Cloudflare TEST build and deployed probes are GREEN.
14. `main`/Production remains unchanged throughout the work.

## Out of scope

- production release;
- changing bottom navigation;
- redesigning Predictions/Matches screens except where a shared Match Center theme token is reused;
- new external data provider purchases/integrations;
- fabricated data to fill provider gaps.
