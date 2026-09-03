# Round 17 — Canonical Match Center, stable Predictions, native tournament labels

## Status
Approved in chat section-by-section on 2026-09-03. This spec covers TEST/develop only. `main` and Production are out of scope until TEST acceptance.

## Goals

1. Replace the split Match Center behavior with one canonical Match Center entry point for Serie A, Coppa Italia, Champions League, Europa League, and Conference League.
2. Keep only matches involving the already-configured Italian clubs in Coppa Italia and UEFA competitions. Matches without an eligible Italian club must not enter any UI feed.
3. Make Match Center open from every match surface: Home, Matches, Predictions, favorite/club cards, and any future canonical match card.
4. Remove remaining layout shifts in Predictions by preserving one stable page shell and patching data in-place.
5. Give Prediction match cards the same tournament-aware visual language already used in Matches/Tables.
6. Move compact tournament labels into the owning components instead of rewriting labels after render.

## Non-goals

- No new manual list of Italian clubs.
- No separate Match Center implementation per tournament.
- No new Production deployment in this round.
- No redesign of prediction scoring, deadlines, ranking formulas, or reset semantics.
- No display of non-Italian UEFA/Coppa matches anywhere in the app.

## Core rule: eligible competition matches

For `coppa_italia`, `ucl`, `uel`, and `uecl`, a match is eligible only when at least one team belongs to the same configured Italian-club set the application currently uses.

Eligibility must be applied before data reaches presentation layers:

`provider -> normalize -> Italian-club eligibility -> canonical feed -> Home / Matches / Predictions / Match Center`

The implementation must reuse the existing club identity/alias normalization mechanism. It must not create a second hard-coded list whose names can drift from the rest of the app.

A non-eligible match must not:

- appear on Home;
- appear in Matches;
- appear in Predictions;
- create a club/favorite match card;
- be routable into Match Center through the normal application flow.

Server-side Match Center resolution must also reject an external match that is not eligible, so a manually constructed UI route cannot expose a match excluded by the feed rule.

## Canonical Match Center architecture

### One public route

Every match surface routes through the same contract:

`openCanonicalMatchCenter({ competition, matchId, initialMatch? })`

The caller does not choose a tournament-specific renderer. It supplies only canonical identity plus optional bootstrap data already available on the card.

### Sources

- Serie A keeps its current authoritative Serie A source, but is adapted to the canonical snapshot shape.
- Coppa Italia and UEFA competitions use the existing BSD-backed match snapshot endpoint.
- The UI consumes one normalized snapshot interface and does not branch on provider.

### Snapshot contract

The canonical snapshot should support these fields when available:

- `competition`
- `matchId`
- `homeTeam`
- `awayTeam`
- `kickoffAt`
- `status`
- `minute`
- `homeScore`
- `awayScore`
- `round`
- `stage`
- `venue`
- `events`
- `statistics`
- `lineups`
- user prediction state / deadline metadata when available through the current prediction domain

Optional sections are genuinely optional. Missing `events`, `statistics`, `lineups`, or venue information must hide only that section, never fail the whole Match Center.

### UI structure

The existing full Serie A experience is the behavioral reference. The canonical Match Center keeps one stable shell with:

1. Back toolbar.
2. Full competition name.
3. Kickoff/date and match status.
4. Team crests and names.
5. Score/live state.
6. Match details sections when data exists: events, lineups, statistics, venue.
7. Prediction-related state where applicable.
8. Local retry state when snapshot refresh fails.

Opening the center must never begin with an empty page. The caller-provided `initialMatch` populates the fixed shell immediately; richer snapshot data patches the existing DOM afterward.

### Tournament themes

The structure and component behavior are identical across tournaments. Only theme variables differ:

- Serie A: premium blue.
- Coppa Italia: red/green.
- Champions League: deep blue/violet.
- Europa League: orange/dark.
- Conference League: green/dark.

Theme variables own overlay background, card borders, active accents, detail headers, retry/action buttons, and loading accents. Club crests and readable text are not tinted.

### Caching and live refresh

Cache snapshots by `competition + matchId`.

- Future matches: longer TTL.
- Finished matches: longer/stable TTL.
- Live matches: short TTL plus the current visibility-aware poll behavior.

Reopening a cached match must render immediately and refresh quietly in the background.

## Match Center routing from every surface

All canonical match cards should expose the same identifiers (`competition`, `matchId`). One capture-level routing layer opens Match Center from:

- Home match cards;
- Matches cards;
- Prediction cards;
- favorite/nearest-match card;
- club/profile match cards that use canonical match identity;
- future canonical match surfaces.

Prediction controls are excluded from navigation. Tapping `+`, `-`, save buttons, locked-round controls, or other form controls must not open Match Center. Tapping the teams/crest/match body does.

The router must not contain tournament-specific screen code. Eligibility and snapshot resolution belong below the router.

## Predictions: stable rendering model

`predictions-ui.mjs` becomes the owner of its visual state. Post-render runtime mutation layers must stop rewriting core Prediction layout.

### Persistent shell

Create the Prediction page shell once per mounted page and preserve these nodes across refresh/filter changes:

- hero/user slot;
- Make prediction / My predictions tabs;
- competition selector;
- round/stage navigation slot;
- match-list slot;
- save slot.

Do not replace the root Prediction page when:

- switching tournament;
- switching Make/My predictions;
- switching round/stage;
- refreshing cached data;
- changing one score;
- saving predictions.

### First paint and refresh

1. Render a final-geometry shell immediately.
2. Use cached/bootstrap match data when present.
3. Reserve final dimensions for crests, cards, navigation, and save area.
4. Start authoritative refresh in parallel.
5. Patch only changed rows/slots.
6. Never clear working content solely to show a loading state.

A cold skeleton must use the same dimensions as the final match cards.

### Tournament styling in Predictions

The selected competition drives a complete theme, not only the page background. Tournament variables apply to:

- Prediction match cards;
- card borders and depth;
- Make/My predictions controls;
- selected competition button;
- selected round/stage;
- score `+/-` controls;
- score values;
- Save predictions button;
- saved/dirty/locked states;
- pressed/hover states.

Themes match the canonical tournament palette used by Matches/Match Center.

### Match Center from Predictions

The clickable match body routes to canonical Match Center. Score and save controls stop propagation and remain editing actions only.

## Tables and Ranking label ownership

Compact labels must be emitted directly by the owning components. Round 16-style post-render text replacement is not the source of truth.

### Tables selector labels

- `Серия А`
- `ЛЧ`
- `ЛЕ`
- `ЛК`
- `КИ`

The content heading remains full:

- `Серия А`
- `Лига Чемпионов`
- `Лига Европы`
- `Лига Конференций`
- `Кубок Италии`

### Ranking selector labels

- `Общий`
- `Серия А`
- `КИ`
- `ЛЧ`
- `ЛЕ`
- `ЛК`

The Ranking section heading remains the corresponding full title.

Compact selectors must fit in one stable row on supported mobile widths without post-render label mutation.

## Error handling

### Feed/provider failure

A failure in one external competition must not clear cached data from another competition. Keep last-known content when available and mark only the affected data as stale/error.

### Match Center snapshot failure

If bootstrap/cached match data exists, keep the Match Center shell and existing data visible, show a local update notice, and provide Retry.

If no bootstrap data exists, show the same fixed shell dimensions with a local failure state. Back remains functional.

### Missing optional match details

Do not render empty section chrome for unsupported optional data.

### Eligibility mismatch

External Match Center requests for non-eligible matches return a controlled not-supported/not-eligible response rather than exposing the match.

## Migration strategy

1. Introduce a shared canonical eligibility predicate using existing club alias/identity logic.
2. Apply it in external canonical match feeds/resolvers before UI consumption.
3. Normalize Serie A and BSD Match Center responses to one snapshot interface.
4. Make `match-center.mjs` the single public Match Center UI/controller.
5. Move all match-card routing to one canonical capture handler.
6. Refactor Predictions to stable shell ownership and tournament-native card styles.
7. Move compact labels into `tables-ui.mjs` and `ranking-ui.mjs`.
8. Remove/simplify Round 16 runtime behaviors that duplicate label/routing/layout ownership once native components own them.

Do not remove a compatibility layer until its replacement has direct regression coverage.

## Test strategy

TDD is required. New tests must fail before implementation and cover at least:

1. An eligible UEFA match involving an Italian club survives the eligibility predicate.
2. A UEFA match with no Italian club is excluded from canonical feeds.
3. Coppa Italia follows the same eligibility rule.
4. A non-eligible external match cannot be resolved through Match Center API.
5. Home, Matches, Predictions, and favorite/club cards route the same canonical match identity to one Match Center API.
6. Prediction `+/-` and save controls do not trigger Match Center.
7. Serie A and each external tournament use the same Match Center renderer/controller with different themes.
8. Missing lineups/statistics/events do not break Match Center.
9. Match Center bootstrap data renders before network refresh and is patched in place.
10. Prediction root shell identity survives tournament/mode/round changes.
11. Score editing patches one card instead of rerendering the page.
12. Prediction card/control themes match the selected tournament.
13. Tables emit compact selector labels directly and full headings directly.
14. Ranking emits compact selector labels directly and full headings directly.
15. Existing prediction deadline, scoring, ranking, reset, standings, and Serie A regressions remain green.

Full verification before TEST merge:

- complete `npm test` suite;
- build;
- Wrangler dry-run;
- API contract probes;
- prediction/reset/BSD probes;
- TEST deployment;
- live TEST marker probes;
- mobile acceptance screenshots for Predictions, Tables/Ranking, and Match Center in each configured tournament.

## Acceptance criteria

Round 17 is accepted on TEST when:

- no non-Italian UEFA/Coppa match is visible anywhere;
- clicking any eligible match surface opens the same canonical Match Center;
- Match Center layout is functionally the same across tournaments and visually themed per tournament;
- Serie A no longer requires a separate user-facing Match Center path;
- Predictions do not visibly jump when opening or switching already-loaded filters;
- Prediction match cards and controls visibly match the selected tournament theme;
- Tables/Ranking selectors have correct compact labels on first render with full section headings;
- no new horizontal selector clipping appears on the tested mobile viewport;
- `main` and Production remain untouched until explicit approval after TEST validation.
