# Round 51 — Clean Match Center Rebuild

## Decision

Round 51 is a clean Match Center rebuild on top of the current stable `develop` baseline containing Round 50.2.

The failed Round 50.3 branches are archive/reference only. No Round 50.3 source file, runtime change, lifecycle change, test workaround, or compatibility hack is copied into Round 51.

Target branch: `test/round51-match-center-rebuild`.
Base commit: `6dd6e91986e3934c34c6ac7f9fed7f0ad21f890a` (stable Round 50.2 on `develop`).
Target environment: TEST only (`develop` / `ciao-web-app-test`).
Out of scope: `main`, `ciao-web-app`, Production, Supabase.

## Product goals

1. Match Center opens as a real bottom drawer anchored to the bottom edge.
2. The source page remains visible and intact behind the drawer for every normal Round 51 open path.
3. Opening or closing Round 51 Match Center must not suspend, hide, reconstruct, or restore the source page.
4. Drawer snap states are exactly `compact`, `standard`, `expanded`; `standard` is the default.
5. Dragging is owned by a dedicated handle only.
6. A deliberate downward drag from `compact` dismisses Match Center.
7. User-facing tabs are exactly, in this order: `Обзор`, `Составы`, `События`, `Статистика`, `Удары`.
8. Provider/API contracts remain unchanged.
9. `Статистика` and `Удары` both read the existing canonical `stats` provider data but render distinct views.
10. `Статистика` shows match metrics/pressure content and excludes the shot map/list/selected-shot presentation.
11. `Удары` shows the interactive shot experience and excludes long general-statistics blocks.
12. Verified Round 50.2 behavior is retained: prediction enrichment, lineup disclosures, clickable shots, selected-shot xG precision, crest fallback, and intentional empty states.
13. Live refresh is seamless: already-rendered data remains visible during background refresh.
14. Failed background refresh with stale valid data keeps that stale data renderable.
15. Initial load with no prior data may still use loading/error states.

## Architecture

### 1. Isolation boundary

Round 51 is not implemented by continuing to mutate the existing canonical Round 50.2 runtime until it behaves like a drawer.

Instead, Round 51 introduces a separate presentation/runtime entrypoint that composes the stable Round 50.2 data/repository/store contracts behind a new Round 51 host and view adapter.

The existing Round 50.2 canonical modules remain the regression baseline. They are changed only if an integration seam is strictly required and the change is backwards-compatible by construction. Broad edits to historical lifecycle/runtime behavior are prohibited.

### 2. Round 51 runtime ownership

The new Round 51 runtime owns:

- Match Center open/close state for the drawer;
- user-facing `activeViewTab`;
- mapping from user view tabs to canonical provider tabs;
- drawer snap state;
- drag gesture state;
- selected lineup side/disclosure state;
- selected shot state;
- rendering through the Round 50.2 enhancer followed by Round 51 presentation filtering.

The Round 51 runtime must not call the legacy source suspension/restoration path during normal operation.

### 3. Source-page behavior

The click/router layer may still capture source context for diagnostics or future navigation needs, but captured source context is metadata only.

Passing a `source` object to Round 51 must never imply `suspendSource`, `restoreSource`, hiding overlays, adding owner classes, or reconstructing source scroll state.

Closing Round 51 simply hides/destroys the Match Center drawer and leaves the underlying source surface untouched.

### 4. View tabs vs provider tabs

Round 51 user tabs:

- `overview`
- `lineups`
- `events`
- `statistics`
- `shots`

Provider mapping:

- `overview -> overview`
- `lineups -> lineups`
- `events -> events`
- `statistics -> stats`
- `shots -> stats`

`statistics` and `shots` therefore share one canonical provider request/cache entry while maintaining independent user-facing state.

### 5. Rendering pipeline

Round 51 uses the verified canonical renderer and Round 50.2 enhancer as data-rich base output, then applies a Round 51 presentation layer.

The Round 51 layer:

1. replaces provider-oriented navigation with the approved five user tabs;
2. renders active user view identity independently from provider identity;
3. filters `stats` presentation into either `Статистика` or `Удары`;
4. wraps the result inside a dedicated bottom-drawer shell;
5. preserves Round 50.2 lineup and shot interactivity;
6. does not alter unrelated Match Center sections.

### 6. Bottom drawer host

Round 51 uses a new host rather than converting the historical fullscreen host in place.

Host requirements:

- `position: fixed`;
- bottom anchored;
- never `inset: 0` fullscreen ownership;
- bounded viewport-relative height;
- rounded top corners;
- dedicated drag handle;
- internal scroll area for Match Center content;
- source page remains visible outside/behind the drawer;
- no page-level overlay lifecycle dependency.

Recommended snap targets, clamped for small viewports:

- compact: approximately `46vh`;
- standard: approximately `78vh`;
- expanded: approximately `94vh`.

### 7. Refresh semantics

Round 51 reuses the stable store contract but must add seamless refresh behavior through an isolated adapter or narrowly-scoped opt-in seam.

When valid stale section data already exists and a forced/background refresh starts:

- keep section status renderable;
- keep stale data visible;
- do not replace it with a blocking loading state;
- atomically replace it only after a successful fresh response;
- if refresh fails, keep stale data and a renderable status.

When no previous valid data exists, the original loading/error semantics remain unchanged.

The preferred implementation is an isolated Round 51 store adapter. Direct global semantic changes to the historical store are allowed only if they are fully backward compatible and existing Round 50.2 tests stay unchanged and green.

## Explicit non-goals

- No code reuse from failed Round 50.3 branches.
- No migration of Round 50.3 compatibility patches.
- No changes to provider endpoints or API section names.
- No new provider section named `shots`.
- No Supabase usage.
- No unrelated refactor of navigation, predictions, rankings, tables, or profiles.
- No changes to `main` or Production.
- No weakening or deletion of historical regression tests solely to make Round 51 pass.

## Test-first contracts

Round 51 implementation begins with focused tests that fail on the clean Round 50.2 baseline.

Required contracts:

1. User tab order is exactly Overview / Lineups / Events / Statistics / Shots.
2. `statistics` and `shots` both map to provider `stats` while preserving distinct view identity.
3. Statistics view excludes shot-map/list/selected-shot presentation.
4. Shots view keeps interactive markers, selected-shot details, and Round 50.2 xG precision while excluding general-stat blocks.
5. Round 50.2 lineup disclosure behavior remains functional.
6. Valid stale data stays visible throughout a forced/background refresh.
7. Background refresh failure with stale data retains stale visible content.
8. Initial section load without stale data still exposes loading/error states.
9. Round 51 host is bottom anchored, not fullscreen, and starts in `standard` snap state.
10. Snap resolver covers compact/standard/expanded transitions and deliberate compact-dismiss behavior.
11. Normal Round 51 open with or without captured `source` does not suspend/hide the source page.
12. Close/back does not reconstruct or restore the source page.
13. All existing Round 50.2 regression tests remain unchanged and green.

## Build and deployment acceptance

Round 51 is complete only after fresh verification on the final branch head:

1. full `npm test` passes in `cloudflare-test`;
2. TEST artifact build passes;
3. Worker bundle validation passes;
4. TEST smoke/deployment probes pass;
5. GitHub CI is green;
6. Cloudflare Workers Build for `ciao-web-app-test` is green;
7. live TEST endpoint is probed and shows the Round 51 drawer behavior;
8. only then may the branch be merged into `develop`;
9. `main`, `ciao-web-app`, and Production remain untouched.

## Rollback

If TEST verification fails after merge, restore TEST by reverting only the Round 51 merge on `develop`.

Production is unaffected because Round 51 never modifies `main`.