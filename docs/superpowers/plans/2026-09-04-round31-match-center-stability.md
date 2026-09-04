# Round 31 — Match Center stability

## Scope
TEST only. Production/main are not part of this work.

## User-visible regressions
1. Coppa Italia and UEFA Match Centers reuse Serie A-only Overview blocks: `Форма` and Serie A context.
2. Returning to `Обзор` in Coppa/UEFA can fall back to an error/stale legacy render.
3. The Matches competition header/back control (`Матчи` / `Серия A` / `Италия`) can leak above the Serie A Match Center. The only exit control while Match Center is open must be `.mc-back`.
4. Legacy Match Center refreshes and tab changes cause visible jumping/lag from repeated full `innerHTML` rewrites and overlay lifecycle races.

## Root causes to address
- External tournaments are deliberately routed through the proven legacy Serie A Match Center shell, but its `matchTabContent(..., 'overview')` renderer contains Serie A-specific form/context sections.
- External tab navigation and live refresh share mutable `matchCenterTab`/`matchData`; a refresh can rewrite the active tab while the user is changing tabs.
- Matches overlay suspension currently depends on a separate event listener/CSS class, so the competition header can be exposed during a lifecycle race.
- External refresh unconditionally rewrites active tab HTML even when the rendered HTML is unchanged, then forces scroll restoration twice.

## Implementation plan
1. Add Round 31 regression tests first (RED) covering external Overview sanitization, overview -> stats -> overview local rendering, overlay ownership, and no-op refresh DOM stability.
2. Extend the v23.3 source patch with an external-only Overview sanitizer. Serie A output remains unchanged. Remove the complete legacy sections containing `.cw14-form-card` and `.cw14-match-info`/Serie-A context.
3. Make external tab rendering a single local helper keyed by current external context. It must never call legacy match API for external matches and must reuse the current snapshot when returning to Overview.
4. Make Match Center viewport ownership idempotent: suspension happens before/with Match Center activation; Matches overlay cannot become visible while `match-center-open` is active; restore only after close and only when returning to `calendar`.
5. Stabilize refresh: compare rendered active-tab HTML before assignment, skip identical writes, preserve active tab, and avoid redundant scroll writes. Add `overflow-anchor:none` to the legacy Match Center content path.
6. Run full TEST CI, build, Worker dry-run, then add/execute a deployed Round 31 probe before any claim that the fix is live on TEST.

## Non-goals
- No redesign of match data providers.
- No Production/main changes.
- No change to Serie A Overview content except removal of the leaked outer Matches header while Match Center is open.
