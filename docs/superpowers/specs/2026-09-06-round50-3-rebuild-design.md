# Round 50.3 Rebuild — Match Center Bottom Drawer

## Decision

Round 50.3 is rebuilt from scratch on top of the current `develop` baseline containing verified Round 50.2. No implementation code from PR #80 / branch `test/round50-3-bottom-drawer` is reused or merged.

Target branch: `test/round50-3-rebuild`.
Target environment: TEST only (`develop` / `ciao-web-app-test`).
Out of scope: `main`, `ciao-web-app`, Production, Supabase.

## Goals

1. Match Center opens as a real bottom drawer anchored to the bottom edge.
2. The source page remains visible and active behind/above the drawer; opening Match Center must not replace or suspend the source surface.
3. The drawer has three explicit snap states: compact, standard, expanded. Standard is the default.
4. Dragging is initiated only from a dedicated handle. Dragging up increases the snap height; dragging down decreases it; a deliberate downward drag from compact dismisses Match Center.
5. User-facing tabs are exactly, in this order: `Обзор`, `Составы`, `События`, `Статистика`, `Удары`.
6. Provider contracts remain unchanged. Existing canonical provider sections remain the data source; `Удары` is a presentation view backed by the existing `stats` payload rather than a new provider/API section.
7. `Статистика` renders match metrics/pressure content without the shot map.
8. `Удары` renders the Round 50.2 interactive shot experience without the long general-statistics blocks.
9. Round 50.2 behavior remains intact: prediction enrichment, lineup disclosures, clickable shots, two-decimal selected-shot xG, crest fallback, intentional empty states.
10. Live refresh is seamless: already visible section data never disappears behind the current blocking `Загружаем раздел…` state while a background refresh is in progress.
11. If a background refresh fails and stale data exists, the stale visible data remains renderable. Initial loads with no prior data may still use loading/error states.

## Architecture

### Isolation strategy

Round 50.3 is implemented as a new, isolated presentation/runtime layer over the verified Round 50.2 baseline. Existing Round 50.2 code is changed only where a well-defined integration seam is required. No broad rewrite of the canonical Match Center is allowed.

The rebuild must not copy the old Round 50.3 implementation wholesale. The previous branch may be consulted only for product intent and test ideas, not as source code to transplant.

### View state vs provider state

The runtime owns a user-facing `activeViewTab` separate from the provider/store `activeTab`.

Mapping:

- `overview -> overview`
- `lineups -> lineups`
- `events -> events`
- `statistics -> stats`
- `shots -> stats`

`statistics` and `shots` therefore reuse one provider request/cache entry but render different presentation slices.

### Drawer shell

The browser host remains `position: fixed` but is bottom anchored and does not use fullscreen `inset: 0` behavior.

The drawer shell owns:

- dedicated drag handle;
- snap state (`compact`, `standard`, `expanded`);
- bounded viewport-relative height;
- internal scroll region for Match Center content;
- close/dismiss transition.

Recommended targets, clamped for small viewports:

- compact: ~46vh;
- standard: ~78vh;
- expanded: ~94vh.

The shell must not require source-page suspension/restoration. Closing the drawer simply hides/destroys the Match Center host and leaves the source surface at its prior state.

### Rendering pipeline

The verified canonical renderer and Round 50.2 enhancer remain the base rendering pipeline.

Round 50.3 adds one final enhancer/shell layer that:

1. replaces the user tab navigation with the approved five-tab order;
2. renders the active view tab independently of provider tab identity;
3. filters the `stats` provider presentation into either `Статистика` or `Удары`;
4. wraps the output in the bottom-drawer structure/handle without mutating unrelated Round 50.2 content.

### Refresh semantics

Store refresh behavior changes only for forced/background refresh when ready data already exists.

When stale ready data exists:

- keep the section renderable during the request;
- do not emit a transient blocking loading state for that section;
- atomically replace the old data when fresh data succeeds;
- if refresh fails, retain stale data and a renderable status.

When no prior section data exists, existing loading/error behavior remains unchanged.

## Non-goals

- No new API endpoints.
- No new provider section named `shots`.
- No data migration.
- No Supabase usage.
- No redesign of unrelated pages.
- No changes to Production deployment or `main`.
- No weakening/removal of Round 50.2 regression coverage merely to make Round 50.3 pass.

## Test-first implementation

Before implementation, add focused Round 50.3 tests that fail on the clean Round 50.2 baseline and encode only the approved new behavior.

Required contracts:

1. User tab order is exactly Overview / Lineups / Events / Statistics / Shots.
2. `statistics` and `shots` both map to provider `stats` while preserving distinct view identity.
3. Statistics view excludes shot-map presentation.
4. Shots view retains interactive shot markers and selected-shot details while excluding long general-stat blocks.
5. Existing ready data stays visible throughout forced refresh.
6. Background refresh failure with stale data retains stale visible content.
7. Initial load without stale data still exposes loading/error states.
8. Browser host is bottom anchored, not fullscreen, and starts in standard snap state.
9. Snap resolver covers compact/standard/expanded and deliberate compact-dismiss behavior.
10. Opening canonical Match Center does not suspend/hide the source page.
11. All existing Round 50.2 regression tests remain green.

## Deployment acceptance

A rebuild is considered complete only after all of the following are freshly verified on the rebuild head:

1. full `npm test` passes in `cloudflare-test`;
2. TEST artifact build passes;
3. Worker bundle validation passes;
4. TEST smoke/deployed probes pass;
5. GitHub CI is green;
6. Cloudflare Workers Build for `ciao-web-app-test` is green;
7. the live TEST endpoint is probed and shows the rebuilt Round 50.3 behavior;
8. only then is the rebuild merged into `develop` / TEST;
9. `main` and Production remain byte-for-byte untouched by this round.

## Rollback

If deployment verification fails after merge to `develop`, restore TEST by reverting only the Round 50.3 rebuild merge on `develop`. Production is unaffected because `main` is never modified.
