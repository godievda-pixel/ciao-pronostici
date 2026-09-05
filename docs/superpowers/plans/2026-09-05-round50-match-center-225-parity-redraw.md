# Round 50 — Match Center 22.5 parity redraw

## Goal
Rebuild the strongest product blocks from the old 22.5/21.5.4 Match Center inside the current canonical Premium Match Center. The old implementation is a functional reference only: do not copy its monolithic renderer/CSS. Re-draw every block as modular v23.3 UI using canonical data and current tournament themes.

## Constraints
- TEST/develop only. Never modify `main` or Production.
- Preserve the Round 49 canonical runtime, five tabs, five tournament themes, source/back lifecycle, real overlay scrollbar suppression, scorer hero, provider/adapters and lazy sections.
- Never fabricate unavailable provider data. Missing optional metrics hide locally.
- Mobile-first from 320px and safe for Telegram/WebView.
- Every product change follows RED -> GREEN and full regression verification.

## Reference parity
The old product provides the reference hierarchy:
1. Overview: Key indicators -> Form -> Match information -> Predictions.
2. Stats: primary bilateral comparisons -> secondary compact comparisons -> pressure/momentum -> shot map/detail.
3. Events: chronological centered timeline, home/away sides, periods, score-after-goal.
4. Lineups: team selector + formation -> official pitch -> player badges -> textual starters/substitutes/coach.
5. Players: dense rating cards with goals, assists, xG, xA, shots, key passes and minutes.

## Task 1 — Overview data parity
Files:
- `cloudflare-test/src/v23.3/serie-a-match-center-provider.mjs`
- `cloudflare-test/src/v23.3/bsd-match-center-adapter.mjs` / provider boundary as required
- `cloudflare-test/src/v23.3/match-center-overview.mjs`
- new Round 50 tests

RED acceptance:
- Overview receives enough canonical data to render four key comparisons: xG, possession, shots, shots on target.
- If player ratings exist, Overview can render the best player without re-fetching client-side.
- If match incidents exist, Overview can render up to four recent important events without fabricating them.
- Existing venue/referee/form/prediction data stays intact.

GREEN implementation:
- Add additive Overview summary fields at provider/adapter boundary (not direct legacy reads in renderer).
- Render `Ключевые показатели` first.
- Remove Overview shot-map and pressure duplication; they belong to Stats.

## Task 2 — Overview block redraw
Redraw, do not copy:
- Key indicators: 4 compact comparison tiles + featured best-player card + recent-event chips.
- Form: full-width premium two-team block, last five results.
- Match information: stadium/city as main row, capacity and referee as secondary cards.
- Predictions: separate saved user prediction card; horizontal P1/X/P2 distribution bar; percentages/count; exact-score probability and popular scores only when real fields exist.
- Use tournament theme tokens for accent, border, glow and surfaces.

## Task 3 — Stats parity redraw
- Primary bilateral rows: xG, possession, shots, shots on target, big chances, corners.
- Secondary compact matrix: fouls, offsides, yellows, reds, saves, pass accuracy, interceptions, tackles.
- Pressure/momentum block inside Stats when coverage exists.
- Keep Round 47 shot map + detailed shot list, but redraw with clearer hierarchy and selected-shot detail affordance where possible without client-state regression.
- Never move shot coordinates to invented positions.

## Task 4 — Events redraw
- Center chronological timeline with home left / away right on wide mobile; collapse safely on narrow screens.
- Period separators.
- Distinct event presentation for goal, penalty, own goal, yellow/red card, substitution and VAR.
- Show score after goals when provider supplies it.
- Preserve ascending chronology.

## Task 5 — Lineups redraw
- Premium home/away selector with formation.
- `Официальные составы` label.
- Pitch remains canonical coordinate/grid/formation fallback based.
- Richer player nodes: shirt number + short name; goal/card/rating micro-badges only when real data is available.
- Under pitch: starters, substitutes and coach as textual fallback.

## Task 6 — Players redraw
- Dense premium player cards sorted by rating/minutes as current contract allows.
- Rating remains the strongest right-side element.
- Metric chips: goals, assists, xG, xA, shots, key passes, minutes; hide unavailable/zero values according to existing semantics.
- Preserve provider names/teams and no synthetic ratings.

## Task 7 — Five-tournament visual system
- All rebuilt blocks use the existing theme variables and render in Serie A, Coppa Italia, UCL, UEL and UECL identities.
- No hard-coded Serie A-only surface inside shared renderers.
- Keep one common information architecture across competitions.

## Task 8 — Regression + deployed verification
Add a Round 50 integration test proving:
- Overview contains the four parity blocks and correct hierarchy.
- Stats contains primary/secondary comparisons, pressure where covered, shot map/list.
- Events has chronological home/away timeline.
- Lineups have selector/pitch/text fallback.
- Players have dense rating/metric cards.
- Five tournament themes remain distinct.
- Runtime overlay scrollbar stays hidden and Back restores source.

Extend deployed TEST probe with Round 50 markers and wire it into develop push CI.

## Definition of Done
- Full test suite GREEN.
- TEST artifact build GREEN.
- Worker validation GREEN.
- Provider/contract probes GREEN.
- Cloudflare `ciao-web-app-test` build GREEN.
- Deployed Round 50 Match Center parity probe GREEN after merge to `develop`.
- `main` SHA verified unchanged.
- Final visual acceptance is based on fresh TEST screenshots for Overview / Stats / Events / Lineups / Players.