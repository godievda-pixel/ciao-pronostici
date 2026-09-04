# Ciao, Web! Runtime Architecture Recovery Design

## Context

Round 37 exposed that several UI regressions are symptoms of duplicated runtime ownership rather than isolated visual bugs. Match Center navigation is split across canonical, legacy, bridge, lifecycle, and later regression layers. Ranking hydration is post-render and observer-driven. Home intentionally paints an incomplete bootstrap view. Tables are rendered full-width first and compacted later. Styling is fragmented between tournament-specific dark surfaces and the app's premium blue identity.

This design consolidates ownership without rewriting working football-data presentation.

## Goals

1. Make Match Center have one lifecycle owner for entry, parent suppression, source restoration, and back navigation across Serie A and external competitions.
2. Remove ranking-wide MutationObserver hydration and repeated ranking fetches; render favorite-team identity and predictor IDs from ranking data in the primary render path.
3. Restore clickable predictor profiles without a second ranking request.
4. Make premium deep blue the application base across Home, Predictions, Ranking, Matches, Tables, and Profile while keeping tournament colors as accents.
5. Render compact standings directly, with larger club crests and premium qualification-zone treatments.
6. Prevent users from seeing incomplete Home/bootstrap content before the first usable app render.
7. Preserve TEST-only deployment discipline; `main` / Production is untouched.

## Non-goals

- Rewriting every legacy Match Center tab into the newer canonical renderer.
- Changing football data providers or backend schemas unless required to expose already-available favorite-team fields.
- Redesigning navigation labels or changing the current bottom navigation.
- Changing scoring logic, prediction logic, standings data, or tournament coverage.

## Architecture

### 1. Match Center lifecycle ownership

Create one focused runtime owner that sits at the application shell boundary and owns only lifecycle state, not football content rendering. It records an immutable source snapshot when a match is opened, then performs four actions in order: suspend the parent surface, open the existing Match Center renderer, handle back, and restore the exact source surface/scroll state.

The owner supports both legacy Serie A and external legacy Match Center events. Older Round 31 / Round 37 viewport ownership hooks must no longer mutate `match-center-open`, the parent matches overlay, or back restoration. They may retain unrelated presentation behavior only if still needed.

Source snapshots use explicit surface identifiers (`home`, `predictions`, `matches`, `club-profile`) plus competition, active subtab/filter where available, and scroll position. The back path never guesses from current DOM state.

Success criteria:
- No `МАТЧИ / Серия А / Италия` parent header is visible inside any Match Center.
- Opening Milan–Benfica or any external competition cannot inherit Serie A parent chrome.
- Back from Home, Predictions, Matches, and club profile returns to that exact surface without blank/gray frames.

### 2. Ranking data-first rendering

Ranking rows must contain predictor identity and favorite-team display data at render time. The ranking renderer is the only owner of ranking row DOM. It writes `data-cw233-predictor-id` and renders the favorite-team crest directly.

`predictor-profile-ui.mjs` becomes profile-modal behavior only. It must not observe the whole document and must not re-fetch ranking rows to decorate them after render. Predictor profile opening uses the row's already-rendered ID and fetches only the selected predictor profile.

Favorite-team asset resolution supports direct crest URLs and Telegram `custom_emoji_id` through the existing legacy asset endpoint. A football emoji is a last-resort placeholder only when the ranking data genuinely contains no usable club asset.

Success criteria:
- Ranking tab performs one ranking data request per explicit load/filter change, not per DOM mutation.
- Scrolling and UI mutations do not trigger ranking refetches.
- Favorite clubs show their actual crest when data contains a URL or `custom_emoji_id`.
- Clicking a predictor row opens a profile.

### 3. Premium blue design tokens

Introduce a small app-shell token module/style contract for the shared base palette. The deep premium blue from the Profile is the default surface language. Tournament colors are accent variables only.

Base tokens include:
- app background: deep navy / blue-black
- primary surface: layered premium blue
- elevated surface: brighter blue glass
- border: cool blue translucent
- primary accent: `#315CFF` family
- secondary accent: `#1937DF` family

Tournament modules may override accent variables but not replace the entire screen with gray, brown, green, or orange. This keeps Coppa/UCL/UEL/UECL identifiable while preserving one product identity.

### 4. Direct compact standings

`tables-ui.mjs` renders the compact schema directly: `# / Команда / И / РМ / О`. No later DOM column deletion is allowed.

Club crests render at 36px desktop/mobile target size unless viewport constraints require 34px. Qualification/relegation zones use a premium treatment: subtle row tint, position badge/accent, and soft inset glow rather than only a 3px strip.

The qualification legend uses the same badge colors and remains accessible.

### 5. Boot readiness gate

Do not show the Home bootstrap skeleton to the user. The app shell receives a minimal boot gate before the first visible application paint. The gate uses the premium blue background and no fake match cards.

The gate clears when:
- the root navigation is installed, and
- Home has either hydrated successfully or reached a recoverable failure state.

A timeout fallback guarantees the app never stays permanently hidden if upstream data is unavailable. On fallback, the normal app renders its explicit error/empty state.

### 6. Performance and mutation discipline

Global MutationObservers that trigger network reads are prohibited. Observers may be used only for lightweight, idempotent DOM synchronization when no primary renderer hook exists, and must be scoped to the smallest container.

All network fetches are tied to explicit state transitions (initial load, filter change, retry, timed refresh where already required).

## Files and responsibilities

- `cloudflare-test/src/v23.3/match-center-lifecycle.mjs` — new single lifecycle owner; no content rendering.
- `cloudflare-test/src/v23.3/round31-match-center-stability.mjs` — remove lifecycle competition with the new owner while preserving unrelated stable external refresh behavior if required.
- `cloudflare-test/src/v23.3/round37-runtime.mjs` — remove Match Center lifecycle/back ownership and standings post-processing; keep only behavior not superseded.
- `cloudflare-test/src/v23.3/ranking-ui.mjs` — render predictor ID and favorite-team crest directly.
- `cloudflare-test/src/v23.3/predictor-profile-ui.mjs` — profile modal only; no ranking hydration observer/refetch.
- `cloudflare-test/src/v23.3/app-theme.mjs` — shared premium-blue tokens/style installation.
- `cloudflare-test/src/v23.3/tables-ui.mjs` — direct compact rows, 36px crests, premium zone treatment.
- `cloudflare-test/src/v23.3/home-integration.mjs` — readiness signal; no visible fake bootstrap cards.
- `cloudflare-test/src/v23.3/boot-gate.mjs` — first-paint gate and safe fallback.
- `cloudflare-test/src/v23.3/index.mjs` — install ordering for app theme, boot gate, lifecycle owner, and existing modules.
- `cloudflare-test/test/*` — regression tests for lifecycle, ranking request count/data rendering, premium theme, compact tables, and boot gate.

## Data flow

### Match Center

1. User activates a match card.
2. Lifecycle owner captures source snapshot before legacy/canonical open event mutates the screen.
3. Existing Match Center renderer receives the match open event and renders football content.
4. Lifecycle owner hides/suspends the source surface and marks Match Center as viewport owner.
5. Back triggers existing Match Center close first, then lifecycle owner restores source surface and scroll from snapshot.

### Ranking

1. Ranking controller fetches rows once for the selected scope.
2. `ranking-ui.mjs` normalizes row identity/favorite team and renders complete rows.
3. Clicking a row passes predictor ID to profile modal.
4. Profile modal fetches only `public_predictor` for that ID.

### Boot

1. Early module installs premium boot gate.
2. Navigation/runtime modules initialize.
3. Home performs first hydration before exposing app content.
4. Ready signal clears gate. Timeout/error also clears gate into explicit recoverable UI.

## Error handling

- Match Center restoration always clears ownership classes/attributes even if the source surface is missing.
- Ranking missing favorite-team data renders a neutral club placeholder, but failed image loads do not trigger refetch loops.
- Profile fetch failures remain local to the modal with retry.
- Home boot timeout reveals the app rather than trapping the user behind a loader.
- Tables preserve current retry behavior for data failures.

## Testing strategy

Use TDD. Add failing tests before each architecture change.

Required regressions:
1. Match Center source restoration for Home, Predictions, Matches, and club profile.
2. Parent matches overlay/header cannot be visible while Match Center owns viewport for Serie A or external competitions.
3. One close/back path only; no duplicate restoration event.
4. Ranking renderer outputs predictor ID and favorite-club asset URL from both direct crest and `custom_emoji_id` forms.
5. Ranking profile module creates no global MutationObserver and does not call rankings hydration.
6. Ranking network request count stays stable across unrelated DOM mutations.
7. Tables renderer outputs exactly five columns before mounting; no Round 37 column-deletion dependency.
8. Crest target size and zone classes/tokens are present in source-rendered table markup/CSS.
9. Premium blue tokens apply to all primary surfaces while tournament accents remain separate variables.
10. Home first visible state is gated until ready; timeout releases safely.

Full repository TEST suite, build, Wrangler validation, existing contract probes, and deployment probes must all be green before merging into `develop`.

## Rollout

Implement on an isolated branch from `develop`. Merge only into `develop` after full CI and code review. Deploy TEST and verify the five user-reported paths manually/live. Do not update `main` or Production in this round.
