# Round 50.2 — Match Center UX & Data Reliability

Date: 2026-09-05
Status: approved for implementation planning
Branch: `test/round50-2-match-center-ux-data-reliability`
Target: `develop` only
Production: `main` / Production must remain untouched until TEST verification is complete.

## 1. Context

Round 50.1 established the new canonical Match Center visual hierarchy and data enrichment for Overview, Stats, Events and Lineups. In-app verification exposed the next set of problems: excessive vertical duplication in Lineups, the user’s own prediction not appearing reliably in Overview, broken/missing team crests in some played matches, an overlong shot list in Stats, over-precise shot xG formatting, and several empty-state / density issues.

The goal of Round 50.2 is to improve UX and reliability without introducing a second Match Center implementation or temporary per-competition UI patches. Changes must stay inside the canonical v23.3 Match Center runtime/provider stack.

## 2. Goals

1. Show the authenticated user’s saved prediction in Match Center Overview for every supported prediction competition:
   - Serie A (`serie_a`)
   - Coppa Italia (`coppa_italia`)
   - Champions League (`ucl`)
   - Europa League (`uel`)
   - Conference League (`uecl`)
2. Remove duplicated full lineup lists from the default Lineups view and replace them with compact, on-demand expansion for starters and substitutes of the currently selected team.
3. Make shot-map points interactive: selecting a point reveals one compact shot detail card rather than forcing the full shot list to remain visible.
4. Standardize xG display to exactly two decimals in Match Center shot-level UI.
5. Prevent visually broken crests from leaving empty team slots by adding source recovery and client-side fallback behavior.
6. Improve empty states and mobile density while preserving the Round 50.1 visual language.
7. Keep all behavior in the canonical runtime and protect it with Round 50.2 tests plus the existing regression suite.

## 3. Non-goals

- No redesign of the five top Match Center tabs.
- No change to prediction scoring rules or prediction write rules.
- No new provider or new database.
- No change to Production deployment in this round.
- No broad refactor of unrelated v23.3 screens.
- No replacement of the existing competition theme system.
- No attempt to synthesize missing provider statistics or player names.

## 4. Current architecture to preserve

The canonical Match Center path is:

`data-client.mjs` → `/api/v23.3/match-center` → `match-center-providers.mjs` → competition provider → canonical contract → `match-center-store.mjs` → `match-center-runtime.mjs` → `match-center-view.mjs` + section renderers.

`match-center-providers.mjs` already routes Serie A to a Serie A provider and the other four competitions to the external/BSD provider. The canonical runtime already owns click handling for Match Center actions and tabs. Round 50.2 must extend these existing boundaries instead of adding a second DOM controller.

## 5. User prediction in Overview

### 5.1 Required behavior

When the authenticated user has a saved prediction for the current match, Overview shows a distinct `Твой прогноз` card before community distribution. Example:

- `Фиорентина — Торино`
- `2:1`
- points only when they are authoritative and already available for that saved prediction

If the user has not saved a prediction for the match, the personal card is omitted. Community distribution remains independent and should still render when available.

### 5.2 Data design

Personal prediction is authentication-dependent application data, not sports-provider data. Therefore it should be loaded through a shared Match Center helper in the server/provider layer, not inferred from BSD/Sports payloads.

Introduce a reusable concept equivalent to:

`loadAuthoritativeUserPrediction({ request, env, competition, matchId })`

The helper should use the existing prediction service / Durable Object path and return one normalized saved prediction or `null`.

It must work for all five competitions and match on the canonical `match_id` value. The existing Serie A special-case behavior should be generalized rather than copied five times.

### 5.3 Failure behavior

Failure to read a personal prediction must not make Overview fail. The sports Match Center response remains usable; the personal card is omitted and the rest of Overview renders normally.

The failure should be testable and isolated. No user-visible generic error banner is required solely because personal prediction enrichment failed.

### 5.4 Cache/auth correctness

Because Match Center requests are already keyed by Telegram init data on the client, personal prediction enrichment can be returned in the authenticated Overview response without leaking one user’s prediction to another user. Tests must protect this assumption.

## 6. Lineups interaction redesign

### 6.1 Default view

Keep:

- `Официальные составы`
- home/away team switch
- formation badge
- pitch and starting XI markers
- existing player micro-badges / shirt numbers

Remove the always-visible duplicated text blocks for both teams beneath the pitch.

### 6.2 Compact controls

Under the selected team’s pitch, render two compact disclosure controls:

- `Стартовый состав · 11`
- `Запасные · N`

Both are collapsed by default.

Selecting a control expands a compact player list for the currently selected team only. Selecting it again collapses it. Switching home/away must close or correctly retarget the expanded disclosure so content can never show players from the wrong team.

The player rows reuse existing data already present in the canonical lineup section: shirt number, name, position, rating and match badges when available.

### 6.3 Empty substitutes

If the provider does not supply substitutes, render `Запасные · 0` as a disabled/empty disclosure or an equally compact `Запасные · нет данных` state. Do not reserve a large empty card.

### 6.4 Runtime ownership

Disclosure clicks must be handled by the canonical Match Center host/runtime. Rendered elements expose stable `data-*` action attributes; `createBrowserMatchCenterHost` dispatches them through runtime UI state.

Do not depend on `:has()` alone for disclosure state because expanded/collapsed state must survive deterministic re-rendering and be testable.

A small local UI state object may live in the Match Center runtime/host and should reset when:

- Match Center closes
- another match opens
- the active section changes away from Lineups

## 7. Shot map interaction redesign

### 7.1 Default Stats behavior

Keep:

- primary stats
- secondary stats
- pressure graph
- shot map

Remove the permanent `Все удары` long list from the default Stats layout.

### 7.2 Selecting a shot

Each visible shot marker becomes an actual interactive control with a stable shot index/id and accessible label.

Tap/click behavior:

1. mark the selected shot
2. visually emphasize that point
3. slightly de-emphasize unselected points
4. render one compact detail card immediately beneath the pitch

Detail card fields, when available:

- minute
- player
- team
- outcome
- situation
- assist
- xG

A second click on the selected point may either keep it selected or collapse it; implementation should choose one consistent behavior. Preferred behavior: second click collapses the detail card.

### 7.3 xG formatting

Shot-level xG is always displayed with exactly two decimals:

- `0` → `0.00`
- `0.0253` → `0.03`
- `0.1255` → `0.13`
- `1` → `1.00`

This rule applies to:

- selected-shot card
- shot ARIA label if xG is included
- any remaining shot-level Match Center display

Aggregate match xG in key metrics can keep the existing compact formatting; this requirement targets shot-level values.

### 7.4 Accessibility

Markers must be keyboard-focusable where the WebView allows it and expose meaningful `aria-label` text. Selected state should be represented with `aria-pressed` or an equivalent semantic state.

## 8. Crest reliability

### 8.1 Problem

A non-empty `crestUrl` does not guarantee the image successfully loads. Played matches can therefore show an empty visual slot even when the team identity is known.

### 8.2 Source recovery

Use the existing competition/team crest sources where available. For Serie A, the existing crest registry can resolve by team ID and normalized name. Equivalent existing canonical crest data for other competitions should be preferred before inventing new external dependencies.

At the canonical base level, preserve a good bootstrap crest when a freshly loaded base response lacks one; existing `mergeTeam` behavior remains valuable.

### 8.3 Client fallback

Rendered crest images receive a canonical Match Center image-failure action. On `error`, replace the broken `<img>` with a designed fallback tile rather than leaving a broken-image icon or empty gap.

Fallback content:

- short team initials derived from the canonical display name (for example `GEN`, `COM`, `TOR`)
- same slot size and alignment as a crest
- competition theme-compatible surface

Fallback is visual only and must not alter the canonical team name.

### 8.4 Retry policy

Do not create a client retry loop for a broken image URL. Source recovery happens before render; browser failure goes directly to fallback.

## 9. Empty states

### Stats before data exists

If Stats is technically available but contains no meaningful statistics, momentum or shots, render a compact explicit state such as:

`Статистика появится после начала матча`

Do not render a large blank inner panel with only team headers.

### Events before data exists

If there are no events, show the existing concise no-events message but remove timeline rail/period decoration. The empty state should look intentionally empty, not partially rendered.

### Players unavailable

Reduce the minimum height of the unavailable Players card and tighten vertical padding. Keep the explanatory copy.

## 10. Visual density polish

The Match Center hero remains recognizable but should be reduced by roughly 8–10% in perceived vertical footprint on common Telegram mobile widths. This should come primarily from spacing/padding and not from shrinking team names or scores below readable sizes.

Raise extremely small auxiliary text. New/modified Match Center text should avoid sub-8px sizes; target approximately 8.5–9px minimum for secondary labels on typical mobile widths.

Reduce nested border emphasis in Overview prediction cards and other modified blocks. Preserve hierarchy through spacing, surface contrast and typography rather than adding another border around every nested element.

Do not change the current active-tab visual treatment.

## 11. Canonical UI state

Round 50.2 introduces transient presentation state that does not belong in provider data:

- selected lineup team (already represented by the existing team switch, but state may need explicit runtime ownership for re-render safety)
- expanded lineup disclosure: `starters | substitutes | null`
- selected shot index/id: `number|string|null`

Preferred design: add a small `viewState` owned by the canonical browser runtime/host rather than putting transient selection into `match-center-store.mjs`, whose responsibility is network/domain state.

The renderer receives the view state as context and emits stable data actions. A UI-only action re-renders from the current store snapshot without refetching the section.

Network fetches must not occur when the user simply opens substitutes or selects a shot.

## 12. Expected files/components

Implementation is expected to touch a focused subset of:

- `cloudflare-test/src/v23.3/match-center-runtime.mjs`
- `cloudflare-test/src/v23.3/match-center-view.mjs`
- `cloudflare-test/src/v23.3/match-center-lineups.mjs`
- `cloudflare-test/src/v23.3/match-center-stats.mjs`
- `cloudflare-test/src/v23.3/match-center-overview.mjs`
- `cloudflare-test/src/v23.3/match-center-providers.mjs` and/or provider-specific modules
- `cloudflare-test/src/v23.3/serie-a-match-center-provider.mjs`
- external/BSD Match Center provider path
- crest source/normalization code only where required
- Round 50.2 tests

Exact file count is implementation-dependent; unrelated modules should not be refactored.

## 13. Test design

Create a dedicated Round 50.2 test file and update older tests only when their contract is intentionally replaced by this design.

Required contracts:

### Personal prediction

- Serie A Overview receives the authenticated user prediction.
- Coppa Italia, UCL, UEL and UECL Overview receive the authenticated user prediction through the shared path.
- no saved prediction → no `Твой прогноз` card.
- prediction service failure → Overview still succeeds without personal card.
- one user’s cached Overview cannot be reused for a different init-data identity.

### Lineups

- default renderer no longer prints the two full duplicated team text panels.
- `Стартовый состав · N` and `Запасные · N` controls exist for the active team.
- default state is collapsed.
- action expands only the selected team’s requested list.
- switching team never leaves the previous team’s list visible.
- empty substitutes do not create a large empty section.

### Shots

- full shot list is absent by default.
- each marker exposes an interactive action and accessible selected state.
- selected shot renders one detail card.
- selecting another point replaces the detail card.
- selected shot styling is emitted.
- shot xG uses exactly two decimals.

### Crests

- bootstrap crest survives an empty fresh crest.
- registry/source recovery is used where available.
- broken-image action replaces `<img>` with initials fallback.
- fallback initials are deterministic for known team names.

### Empty states and visual contracts

- empty Stats renders explicit message and not a blank stats shell.
- empty Events has no timeline rail.
- Players unavailable card uses compact contract.
- minimum modified auxiliary typography does not reintroduce known 6.5/7px regressions.

## 14. Verification and rollout

Implementation workflow:

1. branch only from current `develop`
2. TDD: add failing Round 50.2 contracts first
3. make the minimum canonical implementation changes
4. run targeted Round 50.2 tests
5. run full `npm test`
6. run build / Worker validation / existing Match Center probes
7. open a draft PR into `develop`
8. deploy only TEST through the existing `develop` TEST pipeline
9. verify in Telegram via `Ciao TEST` with:
   - one upcoming match with a saved user prediction
   - one upcoming match with official lineups
   - one finished match with rich Stats/shots
   - one finished match whose crest previously failed
   - at least one non-Serie-A competition
10. only after explicit user approval consider any Production promotion in a separate step

## 15. Acceptance criteria

Round 50.2 is accepted when all of the following are true in TEST:

- the user’s saved score appears in Overview for every supported competition where they made a prediction
- community prediction percentages remain visible independently
- Lineups opens with only the pitch; starters/substitutes lists are on-demand for the selected team
- shot map taps reveal one shot card and no 30+ row shot wall is rendered by default
- every shot-level xG is formatted as `0.00`
- broken crest URLs produce a clean initials fallback rather than an empty/broken image
- empty Stats and Events look intentional
- the Match Center is visibly shorter/cleaner on mobile without reducing core readability
- full test suite and deployed TEST probes are green
- `main` and Production remain unchanged

## 16. Risks and mitigations

### Risk: prediction enrichment slows Overview
Mitigation: use the existing prediction backend and perform independent enrichment so failure is non-fatal. Avoid repeated per-match fan-out beyond the one current-match lookup/list operation.

### Risk: transient UI state is lost because the canonical host re-renders on store emissions
Mitigation: explicitly own UI selection in the runtime/host and pass it to rendering rather than relying solely on DOM state.

### Risk: image fallback creates another source of team-name mismatch
Mitigation: derive initials from the already canonical display name; never rewrite the name itself.

### Risk: older screenshot-oriented tests expect the permanent lineup/shot lists
Mitigation: update only tests whose behavior is intentionally superseded by this approved Round 50.2 contract and keep all unrelated regressions intact.

### Risk: provider differences across competitions
Mitigation: personal predictions are sourced from the application prediction service, while sports data remains provider-specific. Keep these concerns separated at the provider orchestration boundary.
