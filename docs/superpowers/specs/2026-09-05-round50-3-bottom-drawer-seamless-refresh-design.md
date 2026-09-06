# Round 50.3 — Match Center Bottom Drawer + Seamless Refresh

## Scope

Round 50.3 changes the canonical Match Center presentation and interaction model in TEST/develop only. `main` and Production are out of scope.

## User-approved behavior

1. Match Center is a real bottom drawer attached to the bottom edge, not a modal/popup and not a fullscreen replacement page.
2. The source page remains visible behind/above the drawer and is not suspended or hidden when Match Center opens.
3. The drawer has three snap states: compact, standard, expanded. It can be dragged by a dedicated handle and dismissed by a deliberate downward drag from compact range.
4. User-facing tabs are exactly: `Обзор`, `Составы`, `События`, `Статистика`, `Удары`, in that order. `Обзор` is the default.
5. Provider contracts remain unchanged: the canonical provider sections stay `overview`, `stats`, `events`, `lineups`, `players`. `Удары` is a presentation view backed by the existing `stats` provider payload; `players` remains available internally but disappears from user navigation.
6. `Статистика` shows match metrics and pressure/momentum, without the shot map.
7. `Удары` shows the interactive shot map and the selected-shot detail from Round 50.2, without the long general-statistics content.
8. Live refresh must never replace already visible section content with the current `Загружаем раздел… / Карточка матча остаётся на месте.` block. When existing section data is being force-refreshed, stale content remains visible until fresh data arrives.
9. If a background refresh fails while stale section data exists, keep the stale content visible instead of switching to a section error card. Initial loads with no prior data may still use loading/error states.
10. Round 50.2 behavior stays intact: personal prediction enrichment, compact lineup disclosures, clickable shot markers, exact two-decimal selected-shot xG, crest fallback, and intentional empty states.

## Architecture

### Provider/store boundary

Do not add `shots` to `MATCH_CENTER_SECTIONS`; it is not a new network contract. Add a user-view mapping in the runtime/view layer: `shots -> stats`. This prevents duplicate requests and preserves all provider/cache contracts.

`match-center-store.mjs` changes only refresh semantics. A force refresh with an already-ready section does not emit a transient `loading` status. On refresh failure with stale content, section status remains renderable/ready and the old data stays in `sections[key]`.

### Runtime/view boundary

Runtime owns `activeViewTab` separately from the store's provider `activeTab`. Selecting `Удары` sets `activeViewTab='shots'` while loading/reusing provider section `stats`. Selecting `Статистика` also uses provider section `stats` but renders only non-shot statistics.

Round 50.3 view enhancement wraps the existing canonical output in a drawer shell, replaces user tab navigation with the approved order, and filters the existing stats HTML according to `activeViewTab`. Round 50.2 enhancement remains in the pipeline before Round 50.3 so shot clicks, lineup disclosure state, xG formatting, crest fallbacks, and empty states continue to work.

### Drawer host

The browser host becomes bottom-anchored and no longer fills the viewport with an opaque background. It contains a dedicated scroll region and drag handle. Drawer height is controlled by explicit snap states rather than free persistent pixels.

The canonical runtime installation no longer suspends/restores the source surface on open/close. The legacy lifecycle exports stay available for compatibility, but canonical open events no longer hide the source surface.

## Drawer states

Use viewport-relative targets with safe clamping:

- compact: about 46vh
- standard: about 78vh (default)
- expanded: about 94vh

Drag up increases height, drag down decreases height. On release, snap to the nearest state. A deliberate downward drag from the compact range closes Match Center. Dragging must not be initiated from ordinary content; only the handle owns the gesture.

## Refresh UX

Live polling remains 15 seconds. During a refresh of an already-loaded active provider section:

- keep `sectionState[key].status` renderable;
- keep existing `sections[key]` visible;
- update the base score/minute as it arrives;
- atomically replace section data after the section response;
- do not render a blocking per-section spinner between these steps.

This directly removes the live-update state shown in the approved reference screenshot.

## Testing

Add Round 50.3 contracts for:

- view tab order and `shots -> stats` provider mapping;
- Stats view excludes shot map while Shots view excludes general stat groups and retains interactive shot markers;
- force refresh with stale content never emits section `loading` and refresh errors preserve stale content;
- bottom drawer shell/handle/default snap state and pure snap-resolution behavior;
- canonical browser installation no longer suspends the source page;
- prior Round 50.2 tests remain green;
- full `npm test`, TEST build and Worker validation via `Ciao TEST check`.
