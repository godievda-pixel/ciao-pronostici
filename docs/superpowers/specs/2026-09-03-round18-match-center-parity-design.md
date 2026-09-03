# Round 18 — Full Match Center Parity Design

## Goal

Build one premium v23.3 Match Center architecture for Serie A, Coppa Italia, UEFA Champions League, UEFA Europa League, and UEFA Conference League without losing any functionality that exists in the proven legacy Serie A Match Center.

The legacy Serie A Match Center remains the active Serie A experience until the new v23.3 implementation passes functional parity tests and a visual TEST review. Coppa/UEFA may use the new v23.3 Match Center during development.

## Non-negotiable constraints

- Production `main` is not changed during implementation or TEST validation.
- Work is isolated to `cloudflare-test` and documentation until explicitly approved for Production.
- Serie A keeps the proven legacy Match Center until the new center reaches parity.
- Coppa Italia and UEFA competitions contain only the currently configured matches involving Italian clubs. Non-Italian-only matches must not reach Home, Matches, Predictions, Match Center, or club surfaces.
- Never fabricate provider data. Missing provider sections render a stable unavailable state.
- The same Match Center structure is used for all five competitions; only the tournament skin changes.
- No whole-screen rerender for LIVE section refreshes or ordinary tab switches.

## 1. Functional parity target

The new Match Center must reproduce the complete user-facing capability set of the legacy Serie A Match Center.

### Persistent match hero

The hero is always present and stable:

- Back navigation
- Competition name
- Kickoff date/time
- Match status and LIVE minute
- Home/away club names
- Home/away crests
- Score for LIVE/finished matches
- Stable bootstrap state while detail data loads

### Five primary tabs

The navigation is identical for every competition:

1. `Обзор`
2. `Статистика`
3. `События`
4. `Составы`
5. `Игроки`

Tabs remain visible even when their provider section is not available. An unavailable section displays a local empty/unavailable state instead of disappearing or breaking the entire Match Center.

### Overview parity

`Обзор` must support:

- Form for both teams over the last five matches
- Stadium
- City
- Capacity
- Referee
- Current user's saved prediction
- Prediction points/status where available
- Distribution of user predictions
- Momentum / pressure by minute when coverage exists
- Shot map when coverage exists

### Statistics parity

At minimum the canonical statistics model supports:

- xG
- Ball possession
- Total shots
- Shots on target
- Big chances
- Corners
- Fouls
- Offsides
- Yellow cards
- Red cards
- Goalkeeper saves
- Pass accuracy
- Interceptions
- Tackles

Statistics use comparison rows/bars and preserve a fixed layout across competitions.

### Events parity

Chronological timeline supports:

- Goals
- Score after goals
- Assists
- Yellow/red cards
- Substitutions
- VAR
- Period events
- Added time
- Home/away side

### Lineups parity

`Составы` supports:

- Starting XI
- Formation
- Tactical pitch layout
- Player positions
- Substitutes
- Home/away team identity

### Players parity

`Игроки` supports, when provider coverage exists:

- Player rating
- Minutes played
- Goals
- Assists
- xG
- xA
- Shots
- Key passes
- Team identity

## 2. Tournament-adaptive premium skin

The Match Center is one component with one geometry and five skins.

### Serie A

- Deep premium blue background
- Blue active tabs and stat accents
- Blue hero highlights

### Coppa Italia

- Dark red base with green secondary accents
- Red/green hero and active controls

### UEFA Champions League

- Midnight blue base
- Violet / electric blue highlights

### UEFA Europa League

- Graphite / near-black base
- Orange highlights

### UEFA Conference League

- Deep green base
- Brighter green highlights

The tournament skin applies to:

- Full-screen background
- Hero card
- Active tab
- Section borders
- Buttons
- Skeleton/loading state
- LIVE indicator
- Statistics bars
- Event timeline accents
- Pitch and lineup accents
- Momentum and shot-map accents

Team crests and text remain untinted and readable.

## 3. Canonical section-based data contract

The existing flat Match Center snapshot is expanded into a section-based contract.

### Base snapshot

Always fast and available when the match is valid:

```js
{
  competition,
  matchId,
  homeTeam,
  awayTeam,
  kickoffAt,
  status,
  minute,
  homeScore,
  awayScore,
  round,
  stage,
  coverage
}
```

### Coverage

```js
coverage: {
  overview: boolean,
  stats: boolean,
  events: boolean,
  lineups: boolean,
  players: boolean,
  momentum: boolean,
  shotmap: boolean
}
```

Coverage expresses provider capability. Empty arrays alone are not used to infer capability.

### Overview section

```js
{
  form: { home: [], away: [] },
  venue: { name, city, capacity },
  referee: { name },
  prediction,
  predictionSplit,
  momentum,
  shotmap
}
```

### Statistics section

Canonical shape normalizes provider-specific keys into stable home/away values.

### Events section

Canonical event records include type, minute, addedTime, side, player, assist, playerIn, playerOut, reason, and optional score.

### Lineups section

Canonical home/away lineups include formation, starters, substitutes, and normalized position metadata.

### Players section

Canonical player rows include player identity, team identity, rating, minutes, goals, assists, xG, xA, shots, and key passes.

## 4. Provider adapters

### Serie A adapter

The new parity implementation adapts the data already consumed by the legacy Serie A Match Center. The adapter must preserve the rich legacy section semantics rather than reducing them to the current minimal v23.3 snapshot.

The existing legacy Match Center remains active while this adapter is built and tested.

### BSD adapter — Coppa / UEFA

The BSD adapter starts with the existing event payload and expands detail loading into section-aware provider calls/normalization.

Rules:

- A failure in one detail section does not fail the entire Match Center.
- Provider responses are normalized into the same canonical section shapes used by Serie A.
- Eligibility filtering for Italian-club matches remains enforced before UI rendering and on direct Match Center requests.
- Unsupported provider sections return explicit coverage/unavailable states rather than fake values.

## 5. Loading and performance model

The Match Center must open immediately from bootstrap data.

### Open flow

1. User taps a match anywhere in the application.
2. Existing card data is used to render the hero immediately.
3. `overview` begins loading in parallel.
4. Other sections load lazily on first tab activation.
5. Loaded sections are cached by `competition + matchId + section`.
6. Reopening the same match uses cached content immediately and refreshes only when stale.

### LIVE behavior

- Only the active section is refreshed on the short LIVE interval.
- Hero score/status can refresh independently from tab content.
- Existing DOM shell and tabs are not replaced.
- Section content is patched/reconciled instead of replacing the whole Match Center.

### Cache policy

Status-aware TTLs:

- LIVE: short TTL
- Upcoming: medium TTL
- Finished: long TTL

In-flight requests for the same section are deduplicated.

## 6. Error behavior

Errors are section-local.

Examples:

- Stats unavailable → Stats tab displays a local unavailable/retry state.
- Lineups not published → Lineups tab remains available and says that lineups are not available yet.
- Player ratings absent → Players tab shows an unavailable state.
- Overview section failure → hero remains visible; overview displays retry.

A failed detail request must never blank the whole Match Center or expose a previous screen underneath.

## 7. Safe migration strategy

### Phase A — Coppa / UEFA

Build and validate the full new five-tab Match Center for the existing Italian-club matches in Coppa Italia and UEFA competitions.

### Phase B — Serie A parity adapter

Implement the Serie A canonical section adapter while continuing to route Serie A users to the legacy Match Center.

### Phase C — parity gate

Run old-versus-new parity tests on the same Serie A match. The gate checks:

- Hero
- Overview form
- Match information
- Predictions
- Momentum
- Shot map
- Statistics
- Events
- Lineups
- Players
- LIVE updates
- Back/navigation behavior

If any legacy function is absent, Serie A stays on legacy.

### Phase D — visual TEST gate

Perform a real Telegram TEST review of:

- Serie A
- Coppa Italia
- Champions League
- Europa League
- Conference League

Only after automated parity and visual TEST approval may Serie A routing be switched to the new Match Center.

## 8. Acceptance criteria

Round 18 is complete only when all are true:

- One v23.3 Match Center component implements the five-tab structure.
- All five competition skins are visually distinct and tournament-specific.
- Coppa/UEFA continue to show only configured matches involving Italian clubs.
- Overview, Statistics, Events, Lineups, and Players have canonical section contracts.
- Momentum and shot map are supported when coverage exists.
- Missing data never produces fabricated values.
- Section failures are local and recoverable.
- Match Center opens from bootstrap without an empty-screen flash.
- Sections lazy-load and cache independently.
- LIVE refresh does not replace the entire shell.
- Serie A legacy remains active until automated parity tests pass.
- Serie A routing is not switched until a Telegram TEST visual review is explicitly approved.
- Full test suite, build, Wrangler dry-run, contract probes, and deployed TEST probes are green before merge to `develop`.
- `main`, Production, and reset/data operations remain untouched unless separately approved.
