# Ciao, Web! — Canonical Match Center Redesign

Date: 2026-09-04
Status: Approved design, pre-implementation
Target: TEST/develop only
Production/main: explicitly out of scope until manual approval

## 1. Problem statement

The current v23.3 runtime has accumulated multiple generations of Match Center behavior: canonical v23.3 modules, Serie A legacy bridging, external legacy bridging, old build-time patches, round-specific lifecycle fixes, CSS ownership patches, and duplicated back-navigation logic.

This causes recurring defects that cannot be made reliable with additional CSS hiding:

- parent tournament chrome such as `Матчи / Серия А / Италия` can appear above Match Center;
- tournament-colored borders or wrappers can leak into Match Center from the underlying Matches screen;
- back navigation can restore the wrong surface or leave a gray/empty screen;
- Serie A and external competitions do not follow exactly the same runtime path;
- old Round modules can still become de facto owners after newer modules render;
- visual correctness depends on import order and DOM post-processing.

Two adjacent UX problems are included because they share the same architectural root: too many post-render owners.

- Predictions/Ranking expose destructive intermediate loading states instead of atomically replacing finished content.
- The application base theme is Premium Blue, but old tournament theme layers recolor entire pages, producing gray/brown/green surfaces inconsistent with the product identity.

The redesign must remove these competing ownership layers rather than mask them.

## 2. Product rules

### 2.1 Global application identity

Ciao, Web! is always a Premium Blue application.

The following screens use one canonical application design system:

- Home
- Predictions
- Ranking
- Matches
- Tables
- Profile

Tournament identity is an accent on those screens, not ownership of the full application background.

### 2.2 Match Center identity

Match Center is the deliberate exception. It is a full-screen tournament experience.

All competitions share one architecture, one data contract, one lifecycle, one router, and one component structure, but each competition has a distinct complete visual theme:

- Serie A — deep premium blue, cold blue glow, refined glass surfaces;
- Coppa Italia — dark premium base with balanced Italian red/green accents;
- UEFA Champions League — midnight/navy with electric blue and violet atmosphere;
- UEFA Europa League — graphite/black with rich orange identity;
- UEFA Conference League — dark green/black with controlled modern green highlights.

The themes must differ by more than a single accent color. Background treatment, hero ambience, board surface, controls, border lighting and loading transition may vary while geometry and behavior remain shared.

## 3. Architecture decision

We choose the full rewrite option: Match Center UI and Match Center data access are redesigned together around one canonical contract.

Legacy data parsing may temporarily remain behind canonical providers during migration, but legacy Match Center DOM, legacy lifecycle, legacy back navigation and legacy UI events must not participate in the user-visible runtime after cutover.

The target architecture is:

```text
ScreenRouter
    ↓
MatchCenterRouter
    ↓
MatchCenterStore
    ↓
MatchCenterRepository
    ↓
Canonical Match Center API
    ↓
Competition Providers

MatchCenterStore
    ↓
MatchCenterView
    ↓
CompetitionTheme
```

There is one Match Center screen root:

```text
#ciao-match-center
```

It is a standalone application screen. It is not rendered inside Matches, Predictions, a Serie A wrapper, or a legacy overlay.

## 4. Canonical data contract

### 4.1 Base match entity

Every competition must normalize to the same structure before the UI sees it.

Conceptual shape:

```text
competition
matchId
status
kickoffAt

homeTeam
  id
  name
  crestUrl

awayTeam
  id
  name
  crestUrl

score
  home
  away

venue
referee

coverage
  overview
  stats
  events
  lineups
  players

updatedAt
```

No UI component may branch on legacy payload shape.

### 4.2 Section payloads

Heavy sections are loaded independently:

- overview
- stats
- events
- lineups
- players

Each section gets a canonical normalized representation. Provider-specific field names are resolved before the repository returns data to the store.

### 4.3 API surface

Target conceptual endpoints:

```text
GET /api/match-center/{competition}/{matchId}
GET /api/match-center/{competition}/{matchId}/{section}
```

The base endpoint must be fast enough to reveal the full Match Center shell with teams, crests, kickoff, score/status and section availability without waiting for all heavy sections.

### 4.4 Provider boundary

Provider selection belongs behind the repository/API boundary, for example:

```text
serie_a       → SerieAProvider
coppa_italia  → CoppaProvider
ucl/uel/uecl  → UefaProvider
```

A provider may use existing BSD or legacy parsing internally during transition, but it must return canonical data and may not render DOM, dispatch legacy UI events, or own navigation.

## 5. Match Center runtime ownership

### 5.1 MatchCenterRouter

The router accepts only canonical navigation input:

```text
{
  competition,
  matchId,
  source
}
```

`source` is a navigation snapshot, not a string-only hint.

Expected snapshot fields where relevant:

```text
sourceScreen
competition
stageOrRound
filter
mode
selectedTeam
scrollY
profileId
```

The exact schema may be typed/normalized during implementation, but it must contain enough information to reconstruct the source screen deterministically.

### 5.2 MatchCenterStore

The store is the only owner of Match Center state:

- open/closed;
- current competition;
- match id;
- base match;
- active tab;
- section data;
- section loading/error states;
- last updated timestamp;
- live polling lifecycle;
- navigation snapshot;
- request generation/cancellation state.

No Round module, bridge, MutationObserver or global click patch may alter this state independently.

### 5.3 MatchCenterView

The view renders only store state into `#ciao-match-center`.

The open Match Center subtree must not contain:

- `.cw232-competition__head`;
- old `matchCenterHtml` wrappers;
- a Matches competition wrapper;
- a legacy Serie A header;
- a parent Matches overlay as its layout container;
- legacy close/back controls.

This is a structural invariant, not a CSS visibility rule.

## 6. Navigation and Back behavior

Back behavior must be deterministic and source-aware.

Required restoration matrix:

| Entry point | Back destination |
| --- | --- |
| Home | Home with previous scroll |
| Matches → Serie A | same competition, same round/stage, previous scroll |
| Matches → UCL/UEL/UECL | same competition and stage, previous scroll |
| Matches → Coppa | same cup section/stage, previous scroll |
| Predictions | same mode, tournament, round/filter and previous scroll |
| Club profile | same club profile and previous scroll |
| Predictor profile if applicable | same predictor profile and previous scroll |

The implementation must not use blind `history.back()` as the source of truth.

Opening Match A, leaving it, opening Match B, and returning must not reuse stale snapshot data from Match A.

All entry points must call the same router. There must be no Serie A-specific UI route and no external-competition legacy UI route after cutover.

## 7. Loading model

### 7.1 Match Center

The user must never see a half-assembled Match Center inherited from the source page.

Transition sequence:

```text
user taps match
→ tournament-specific full-screen transition/loading state
→ canonical base payload ready
→ atomic reveal of Match Center
→ heavy sections load lazily inside stable shell
```

The loading state uses the selected competition theme.

If base loading fails, the new Match Center shows its own error/retry state. There is no fallback to legacy Match Center UI.

### 7.2 Predictions and Ranking

Switching filters/tournaments uses stale-while-revalidate semantics.

Current completed content remains visible while the next dataset loads. Once ready, the new state replaces the old content atomically.

State model:

```text
ready(currentData) + refreshing(nextScope)
```

not:

```text
clear content → skeleton page → ready
```

For a first-ever load with no usable data, show one coherent branded loading state rather than multiple large empty skeleton cards.

### 7.3 Initial app boot

The boot gate remains until the actual initial route is ready to present as a complete screen.

A safety timeout/fallback must prevent a permanent blank screen if data fails, but the normal case must not expose intermediate Home/Ranking/Predictions geometry.

## 8. Live update model

Live updates belong only to `MatchCenterStore`.

Rules:

- scheduled match: low-frequency or event-driven refresh according to available infrastructure;
- live match: target polling around the existing 15 second cadence;
- finished/cancelled match: polling stops;
- closed Match Center: polling and section work stop;
- document hidden: live work pauses where safe;
- a stale response from a previous match/request generation is ignored;
- changing matches before an earlier request returns must never overwrite the new match.

DOM mutation must never trigger network refreshes.

## 9. Premium Blue application design system

### 9.1 Canonical application tokens

The existing Premium Blue direction becomes the only global owner.

Canonical categories:

```text
app-bg
app-bg-deep
surface-1
surface-2
surface-3
border-soft
border-strong
primary
primary-hover
text
text-muted
```

Existing values in `app-theme.mjs` are the starting point, including the deep blue application background and elevated blue surfaces.

### 9.2 Competition accent tokens

Outside Match Center, competition styling is limited to content accents:

```text
competition-accent
competition-accent-2
competition-soft
competition-border
```

Old tournament theme code must not recolor the entire Predictions or Ranking page background.

### 9.3 Predictions

Predictions stays Premium Blue regardless of selected competition.

Competition identity may affect:

- selected competition chip;
- match card edge/glow;
- status/accent details;
- score controls;
- subtle tournament marker.

Primary application CTA remains Ciao blue.

### 9.4 Ranking

Ranking stays Premium Blue for all filters.

Gold/silver/bronze top-three treatments remain, but sit on the blue product surface.

Tournament filters use tournament accents only in their active state.

Changing from Overall to Europa League must not recolor the page brown/orange.

### 9.5 Tables

Tables stays Premium Blue.

Team crests target approximately 36–40px where mobile layout allows.

Qualification/relegation zones must use premium row treatment rather than a cheap vertical stripe alone. Preferred treatment:

- subtle row tint;
- compact illuminated marker around/near position;
- restrained competition-specific accent;
- text and numbers remain high-contrast and readable.

### 9.6 Matches

The Matches hub and tournament lists stay inside Premium Blue application chrome. Tournament cards may carry stronger accents, but the whole application shell does not change identity.

## 10. Full Match Center competition themes

Match Center competition themes own a complete theme token group, potentially including:

```text
mc-bg
mc-bg-secondary
mc-surface
mc-surface-elevated
mc-border
mc-accent
mc-accent-2
mc-glow
mc-text
mc-muted
mc-loader
```

The shared geometry and component hierarchy remain constant.

### Serie A

Deep premium blue; refined cold blue glow; glass card treatment; no inherited Matches header.

### Coppa Italia

Dark neutral base with elegant Italian red/green treatment. Avoid a literal split flag or oversaturated green/red blocks.

### UEFA Champions League

Midnight/navy base, electric blue/violet glow, premium night-match atmosphere.

### UEFA Europa League

Graphite/near-black base with saturated but controlled orange accents.

### UEFA Conference League

Deep green-black base with modern green highlights, avoiding neon-acid appearance.

## 11. Legacy retirement rules

### 11.1 Remove from user-visible runtime at cutover

The following concepts must stop participating in Match Center UI lifecycle:

- `openExternalLegacyMatchCenter()` as a UI route;
- `ciao-v233-open-external-legacy-match` as a UI-render trigger;
- legacy Match Center DOM renderer;
- Serie A legacy UI bridge;
- external legacy UI bridge;
- old `closeMatchCenter` interception layers;
- Match Center lifecycle ownership in Round 20/21/23/31/33/35/37/38 patches;
- CSS whose job is to hide the underlying Matches header/overlay while Match Center is open;
- build-time patches that reintroduce old Match Center UI ownership.

### 11.2 May temporarily remain behind data boundary

Legacy/BSD parsing can temporarily remain if required to produce canonical provider output. Such code must:

- return data only;
- never render HTML;
- never dispatch UI navigation events;
- never access source screen DOM;
- be replaceable without Match Center UI changes.

### 11.3 Cleanup phase

Once TEST parity is confirmed, dead legacy UI files/imports/tests are removed in a separate cleanup commit so the migration diff and deletion diff remain reviewable.

## 12. Migration strategy

### Phase A — Canonical data layer

Build and test canonical base + section contracts for all five competition families without changing public routing.

Compare normalized outputs against currently known data behavior.

### Phase B — New standalone Match Center

Build `#ciao-match-center` with router/store/repository/view/theme system behind TEST-only/internal access.

No legacy Match Center UI is embedded inside it.

### Phase C — Parity gate

For representative matches in each competition verify:

- teams;
- crests;
- kickoff;
- status;
- score;
- overview;
- stats;
- events;
- lineups;
- players;
- unavailable section behavior;
- error/retry;
- live refresh;
- close/reopen;
- switching to another match.

### Phase D — Hard UI cutover

All match entry points switch in one controlled change to `MatchCenterRouter.open(...)`.

At the same time old UI bridge imports/listeners are disabled.

There is no runtime legacy UI fallback.

### Phase E — Global theme/loading migration

Make `app-theme.mjs` the single global theme owner.

Move useful stable geometry/loading behavior out of old Round theme modules into canonical component styles.

Predictions/Ranking adopt stale-while-revalidate.

### Phase F — Legacy cleanup

After real TEST visual confirmation, remove dead legacy Match Center UI code and obsolete regression expectations.

## 13. Test strategy

Implementation follows TDD.

Required test groups:

### Data contract

- all competition providers normalize to the canonical base contract;
- all section payloads normalize consistently;
- absent provider fields do not leak provider-specific shapes to UI;
- stale requests cannot overwrite current state.

### Store/lifecycle

- one Match Center owner only;
- open/close is deterministic;
- active tab state is store-owned;
- polling begins/stops correctly;
- hidden document behavior;
- section retry/error behavior;
- changing match invalidates previous requests.

### Navigation

Full restoration matrix from Section 6, including repeated open/close/open sequences and scroll/filter restoration.

### DOM ownership regression

When Match Center is open:

- exactly one canonical Match Center root is active;
- `.cw232-competition__head` is absent from Match Center subtree;
- legacy Match Center wrapper is absent;
- parent Matches competition shell is not the Match Center layout owner;
- old legacy UI events are not necessary to display the match.

### Theme tests

- global non-Match-Center surfaces use Premium Blue tokens for every competition filter;
- old Round 11 page-wide tournament backgrounds no longer own Predictions/Ranking;
- five Match Center themes resolve to distinct theme token sets;
- component geometry remains common across themes.

### Loading tests

- Predictions/Ranking do not clear ready content during refresh;
- first-load state is one branded loading surface;
- Match Center does not reveal half-built shell before base payload is ready;
- initial boot does not expose intermediate route DOM during healthy startup.

### Build/deployment

- full existing suite after updating only genuinely obsolete legacy expectations;
- build;
- Wrangler validation;
- API contract probes;
- deployed TEST probes;
- explicit no-legacy-runtime-import/ownership probe.

## 14. Manual TEST acceptance gate

GREEN CI is necessary but not sufficient.

Before any Production discussion, manually inspect on real TEST:

1. Serie A Match Center;
2. Coppa Italia Match Center;
3. Champions League Match Center;
4. Europa League Match Center;
5. Conference League Match Center.

For each, verify at minimum:

- unique intended tournament design;
- no parent Matches header or leaked border;
- tabs work;
- back works;
- reopen works;
- no visible intermediate legacy screen.

Also verify entry from:

- Home;
- Matches;
- Predictions;
- profile where applicable.

And verify:

- Predictions remains Premium Blue across tournament filters;
- Ranking remains Premium Blue across tournament filters;
- filter switching does not show malformed skeleton layout;
- Tables retains Premium Blue shell with improved crests and qualification treatment.

## 15. Production boundary

All implementation and deployment work is limited to TEST/develop until the user explicitly approves Production promotion.

`main` must not move during this project phase.

No automatic promotion follows CI success.

## 16. Success criteria

The redesign is considered successful when all of the following are true:

1. Every competition opens through one Match Center router/store/view architecture.
2. Serie A, Coppa Italia, UCL, UEL and UECL each have a distinct full Match Center design.
3. No old tournament header, parent frame or Matches wrapper can appear in Match Center because those elements are not part of its render tree.
4. Back always restores the exact source surface and relevant UI state.
5. Match Center data is canonical and UI-independent of provider payload shape.
6. Legacy Match Center UI events/renderers are absent from the active user path.
7. Predictions and Ranking keep finished content while refreshing and no longer expose broken intermediate skeleton screens.
8. The whole normal application remains Premium Blue; tournament colors act as accents outside Match Center.
9. Live polling and asynchronous responses cannot leak across closed/switched matches.
10. Full CI, deployed TEST probes and manual visual acceptance all pass before any Production change.

## 17. Non-goals

This redesign does not intentionally change:

- prediction scoring rules;
- tournament standings calculations;
- competition qualification rules;
- authentication model;
- unrelated Profile features;
- Production deployment configuration.

Those may only change if a concrete dependency is discovered and separately justified during implementation.
