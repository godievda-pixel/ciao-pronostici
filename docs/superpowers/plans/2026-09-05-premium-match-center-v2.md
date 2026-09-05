# Premium Match Center v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a fully upgraded, premium, tournament-aware Match Center across Serie A, Coppa Italia, Champions League, Europa League and Conference League, with complete rich data, no fake values, and full TEST verification.

**Architecture:** Extend the existing canonical v23.3 Match Center additively rather than introducing a parallel runtime. Keep `/api/v23.3/match-center`, existing store/lifecycle/repository boundaries and five tabs, while enriching canonical events/shots/lineups and replacing the shell/renderers with premium tournament-themed components.

**Tech Stack:** Node.js ESM, built-in `node:test`, HTML-string renderers, CSS/SVG primitives, Cloudflare Worker/Static Assets, existing v23.3 provider adapters and build/probe pipeline.

**Spec:** `docs/superpowers/specs/2026-09-05-premium-match-center-v2-design.md`

## Global Constraints

- TEST/develop only until full verification; `main`/Production must remain untouched.
- Keep the existing `/api/v23.3/match-center` entrypoint and five tabs: `overview`, `stats`, `events`, `lineups`, `players`.
- UI renderers must consume only canonical data, never raw provider payloads.
- Missing provider data must render unavailable/empty states, never fake zeroes or invented values.
- Preserve Round 45 prediction-backend authority for the user's personal prediction.
- Primary viewport is Telegram/mobile WebView; no horizontal scroll at 320px.
- Every implementation task follows RED → GREEN TDD and ends with focused test execution.

---

## File map

### Canonical/data layer
- `cloudflare-test/src/v23.3/match-center-sections.mjs` — canonical section shapes and normalization.
- `cloudflare-test/src/v23.3/match-center-contract.mjs` — canonical base response contract.
- `cloudflare-test/src/v23.3/bsd-match-center-adapter.mjs` — BSD/Coppa/UEFA canonical normalization.
- `cloudflare-test/src/v23.3/serie-a-match-center-adapter.mjs` — Serie A legacy payload to canonical response.
- `cloudflare-test/src/v23.3/serie-a-match-center-legacy-normalizer.mjs` — Serie A provider alias/shape normalization.
- `cloudflare-test/src/v23.3/serie-a-match-center-provider.mjs` — Serie A canonical provider composition.

### Premium presentation
- `cloudflare-test/src/v23.3/match-center-theme.mjs` — five competition identities and premium tokens.
- `cloudflare-test/src/v23.3/match-center-view.mjs` — shell, hero, scorers, tabs, scrollbar suppression.
- `cloudflare-test/src/v23.3/match-center-stats.mjs` — aggregate stats, shot map, detailed shot list.
- `cloudflare-test/src/v23.3/match-center-events.mjs` — premium chronological timeline.
- `cloudflare-test/src/v23.3/match-center-lineups.mjs` — pitch view, team switch, lineups, bench, coach.
- `cloudflare-test/src/v23.3/match-center-players.mjs` — premium-aligned player cards.

### Tests/probes
- Create `cloudflare-test/test/v23-3-round46-premium-match-center-contract.test.mjs`.
- Create `cloudflare-test/test/v23-3-round46-premium-match-center-providers.test.mjs`.
- Create `cloudflare-test/test/v23-3-round46-premium-match-center-shell.test.mjs`.
- Create `cloudflare-test/test/v23-3-round47-premium-match-center-stats.test.mjs`.
- Create `cloudflare-test/test/v23-3-round48-premium-match-center-events-lineups.test.mjs`.
- Create `cloudflare-test/test/v23-3-round49-premium-match-center-integration.test.mjs`.
- Create `cloudflare-test/scripts/probe-premium-match-center.mjs` and wire it into `.github/workflows/ciao-test-check.yml` only after unit/integration GREEN.

---

### Task 1: Canonical goal/event/shot/lineup richness

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-sections.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center-contract.mjs`
- Test: `cloudflare-test/test/v23-3-round46-premium-match-center-contract.test.mjs`

**Interfaces:**
- Consumes: existing `canonicalMatchCenterBase`, `canonicalEventsSection`, `canonicalStatsSection`, `canonicalLineupsSection`.
- Produces: additive `goals.home/away`, enriched event fields, `stats.shots`, enriched lineup player fields and `coach`.

- [ ] **Step 1: Write RED canonical tests**

Create tests that assert:

```js
assert.deepEqual(base.goals.home[0], {
  player:'Marco Rossi', minute:34, addedTime:null,
  kind:'penalty', scoreAfter:{ home:1, away:0 }
});
assert.equal(events[0].goalKind, 'own_goal');
assert.equal(stats.shots[0].outcome, 'saved');
assert.equal(stats.shots[0].x, null); // invalid/out-of-range canonical coordinate
assert.equal(lineups.home.starters[0].grid, '1:2');
assert.equal(lineups.home.coach, 'Coach Name');
```

Also assert old keys still exist and old callers remain valid.

- [ ] **Step 2: Run RED test**

Run:

```bash
cd cloudflare-test && node --test test/v23-3-round46-premium-match-center-contract.test.mjs
```

Expected: FAIL because rich fields are not yet canonicalized.

- [ ] **Step 3: Implement minimal additive canonical normalization**

Add focused helpers in `match-center-sections.mjs` for:

```js
canonicalGoalSummary(value)
canonicalShot(value)
canonicalLineupPlayer(value)
```

Rules:
- preserve valid numbers/text only;
- invalid shot x/y => `null`;
- do not synthesize xG;
- goal kind enum: `open_play|penalty|own_goal|free_kick|unknown`;
- shot outcome enum: `goal|saved|off_target|blocked|post|unknown`;
- shot situation enum: `open_play|set_piece|corner|free_kick|penalty|unknown`;
- lineups keep `x`, `y`, `grid`, `starter`, and side-level `coach`.

Extend base contract additively with `goals:{home:[],away:[]}`.

- [ ] **Step 4: Run canonical tests GREEN**

```bash
cd cloudflare-test && node --test test/v23-3-round46-premium-match-center-contract.test.mjs test/v23-3-round39-match-center-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/match-center-sections.mjs cloudflare-test/src/v23.3/match-center-contract.mjs cloudflare-test/test/v23-3-round46-premium-match-center-contract.test.mjs
git commit -m "feat: enrich canonical Match Center data"
```

---

### Task 2: Provider normalization for Serie A and BSD tournaments

**Files:**
- Modify: `cloudflare-test/src/v23.3/bsd-match-center-adapter.mjs`
- Modify: `cloudflare-test/src/v23.3/serie-a-match-center-adapter.mjs`
- Modify: `cloudflare-test/src/v23.3/serie-a-match-center-legacy-normalizer.mjs`
- Modify: `cloudflare-test/src/v23.3/serie-a-match-center-provider.mjs`
- Test: `cloudflare-test/test/v23-3-round46-premium-match-center-providers.test.mjs`

**Interfaces:**
- Consumes: enriched canonical helpers from Task 1.
- Produces: identical canonical semantics across Serie A, Coppa Italia, UCL, UEL and UECL.

- [ ] **Step 1: Write RED provider fixtures/tests**

Fixture A: finished Serie A match with:
- 4 goals;
- one penalty;
- one own goal;
- one `45+2` goal;
- shot coordinates + xG/outcome/situation;
- lineup grid/coords/coach.

Fixture B: BSD competition match with equivalent fields.

Assert both adapters produce the same canonical keys and semantic values.

- [ ] **Step 2: Run RED provider tests**

```bash
cd cloudflare-test && node --test test/v23-3-round46-premium-match-center-providers.test.mjs
```

Expected: FAIL on qualifiers/shots/lineup richness/hero goals.

- [ ] **Step 3: Implement provider alias normalization**

In provider adapters, map documented aliases only at the adapter boundary. Preserve:

```js
{
  goalKind, cardKind, varDecision,
  minute, addedTime, homeScore, awayScore,
  player, assist,
  shot:{ x,y,xg,outcome,situation,bodyPart },
  lineup:{ x,y,grid,coach }
}
```

Derive `base.goals.home/away` only from canonical goal events, sorted chronologically.

If a finished/live Serie A summary lacks incidents, compose server-side with the minimal incident source needed for hero scorers. Scheduled matches must avoid this extra incident fetch.

- [ ] **Step 4: Run provider + legacy regression suite GREEN**

```bash
cd cloudflare-test && node --test \
  test/v23-3-round46-premium-match-center-providers.test.mjs \
  test/v23-3-round42-match-center-complete-rich-data.test.mjs \
  test/v23-3-round45-match-center-data-completeness.test.mjs \
  test/v23-3-round18-bsd-match-center-sections.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/bsd-match-center-adapter.mjs cloudflare-test/src/v23.3/serie-a-match-center-adapter.mjs cloudflare-test/src/v23.3/serie-a-match-center-legacy-normalizer.mjs cloudflare-test/src/v23.3/serie-a-match-center-provider.mjs cloudflare-test/test/v23-3-round46-premium-match-center-providers.test.mjs
git commit -m "feat: normalize rich Match Center provider data"
```

---

### Task 3: Five premium tournament themes + shell + scorers + hidden scrollbar

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-theme.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center-view.mjs`
- Test: `cloudflare-test/test/v23-3-round46-premium-match-center-shell.test.mjs`

**Interfaces:**
- Consumes: `match.goals` from Task 1/2.
- Produces: one premium shell with five theme identities.

- [ ] **Step 1: Write RED shell tests**

Assert every tournament exposes:

```text
--mc-bg --mc-bg-deep --mc-surface --mc-surface-2 --mc-surface-raised
--mc-border --mc-border-strong --mc-accent --mc-accent-2 --mc-accent-soft
--mc-glow --mc-pitch --mc-pitch-line --mc-home-marker --mc-away-marker
```

Render a finished match and assert hero contains:
- crest/image slot;
- scorer lines;
- `34′ (П)`;
- `45+2′`;
- `(АГ)`;
- no `[object Object]`, `undefined`, `null`.

Assert generated CSS contains both:

```css
scrollbar-width:none;
::-webkit-scrollbar{display:none}
```

for Match Center and its scrolling overlay/container selectors.

- [ ] **Step 2: Run RED shell test**

```bash
cd cloudflare-test && node --test test/v23-3-round46-premium-match-center-shell.test.mjs
```

Expected: FAIL on missing theme tokens/scorer UI/scrollbar suppression.

- [ ] **Step 3: Implement premium themes**

Retain existing competition keys and set distinct premium identity:
- Serie A: deep navy + cyan blue;
- Coppa: burgundy/black + red + restrained green;
- UCL: midnight indigo + royal blue/violet;
- UEL: graphite/burnt-black + orange/amber;
- UECL: deep green/black + emerald/lime accent.

Use tokens only; no provider-specific renderer logic.

- [ ] **Step 4: Implement premium shell/hero**

Update `match-center-view.mjs`:
- richer layered background/surfaces;
- compact premium toolbar;
- hero with team crest/name/scorer list and central score/status;
- neutral smaller placeholder when crest unavailable;
- safe responsive rules at 320px;
- native vertical scrolling preserved while scrollbar hidden.

- [ ] **Step 5: Run shell/theme regressions GREEN**

```bash
cd cloudflare-test && node --test \
  test/v23-3-round46-premium-match-center-shell.test.mjs \
  test/v23-3-round39-match-center-view.test.mjs \
  test/v23-3-round22-final-match-center-themes.test.mjs \
  test/v23-3-round43-serie-a-ui-match-center-content.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-test/src/v23.3/match-center-theme.mjs cloudflare-test/src/v23.3/match-center-view.mjs cloudflare-test/test/v23-3-round46-premium-match-center-shell.test.mjs
git commit -m "feat: rebuild Match Center premium shell"
```

---

### Task 4: Premium Stats with shot map and detailed shot list

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-stats.mjs`
- Test: `cloudflare-test/test/v23-3-round47-premium-match-center-stats.test.mjs`

**Interfaces:**
- Consumes: `{home, away, shots}` canonical Stats section.
- Produces: aggregate metrics + app-owned pitch graphic + accessible shot rows.

- [ ] **Step 1: Write RED Stats tests**

Render canonical shots covering goal, saved, blocked, off-target and penalty. Assert:
- `data-cw233-mc-shotmap` exists;
- only shots with valid x/y create map markers;
- invalid-coordinate shot still exists in textual list;
- goal and penalty markers have semantic classes;
- minute/player/xG/outcome text renders only when available.

- [ ] **Step 2: Run RED Stats test**

```bash
cd cloudflare-test && node --test test/v23-3-round47-premium-match-center-stats.test.mjs
```

Expected: FAIL because current Stats has only comparative rows.

- [ ] **Step 3: Implement premium aggregate block**

Retain existing aggregate comparisons but visually group:
1. key metrics strip;
2. primary comparison rows;
3. extended rows.

- [ ] **Step 4: Implement shot map**

Use owned HTML/CSS/SVG primitives only. Position marker with canonical `x/y` percentages. Marker size may encode xG within fixed min/max bounds but must not imply xG when missing.

Each marker needs an accessible label assembled from available minute/player/outcome/xG.

- [ ] **Step 5: Implement detailed shot list**

Chronological list, showing only available metadata:
- minute;
- player;
- side/team;
- outcome;
- xG;
- situation/penalty;
- assist.

- [ ] **Step 6: Run Stats regressions GREEN**

```bash
cd cloudflare-test && node --test \
  test/v23-3-round47-premium-match-center-stats.test.mjs \
  test/v23-3-round18-match-center-stats-events.test.mjs \
  test/v23-3-round42-match-center-complete-rich-data.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/src/v23.3/match-center-stats.mjs cloudflare-test/test/v23-3-round47-premium-match-center-stats.test.mjs
git commit -m "feat: add premium Match Center shot analysis"
```

---

### Task 5: Premium Events timeline

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-events.mjs`
- Test: `cloudflare-test/test/v23-3-round48-premium-match-center-events-lineups.test.mjs`

**Interfaces:**
- Consumes: enriched canonical event array.
- Produces: chronological semantic timeline.

- [ ] **Step 1: Add RED event timeline tests**

Assert chronological top-to-bottom event order and semantic output for:
- goal + score;
- penalty goal `(П)`;
- own goal `(АГ)`;
- yellow/red card;
- substitution;
- VAR decision;
- halftime/full-time separator;
- unknown event readable fallback.

- [ ] **Step 2: Run RED events subset**

```bash
cd cloudflare-test && node --test --test-name-pattern="events" test/v23-3-round48-premium-match-center-events-lineups.test.mjs
```

Expected: FAIL because current timeline is simple and reverse-sorted.

- [ ] **Step 3: Implement premium timeline**

Change to chronological ascending order. Use home/away/neutral semantic alignment, tournament accents, full-width period separators, and compact readable event cards.

- [ ] **Step 4: Run events regressions GREEN**

```bash
cd cloudflare-test && node --test \
  test/v23-3-round48-premium-match-center-events-lineups.test.mjs \
  test/v23-3-round18-match-center-stats-events.test.mjs
```

Expected: event subset PASS.

---

### Task 6: Lineups on pitch + authoritative text fallback + premium Players alignment

**Files:**
- Modify: `cloudflare-test/src/v23.3/match-center-lineups.mjs`
- Modify: `cloudflare-test/src/v23.3/match-center-players.mjs`
- Test: `cloudflare-test/test/v23-3-round48-premium-match-center-events-lineups.test.mjs`

**Interfaces:**
- Consumes: enriched lineup sides `{formation, starters, substitutes, coach}`.
- Produces: selected-team vertical pitch, deterministic placement, text lists for both teams.

- [ ] **Step 1: Add RED lineup tests**

Cases:
1. explicit canonical x/y => exact marker positions;
2. grid token => deterministic mapped positions;
3. valid formation-only `4-3-3` => deterministic fallback formation;
4. invalid formation/insufficient starters => `Схема недоступна` while text list remains visible;
5. coach and substitutes render when available;
6. home/away segmented control markers exist and default to home.

- [ ] **Step 2: Run RED lineups subset**

```bash
cd cloudflare-test && node --test --test-name-pattern="lineup|pitch|formation" test/v23-3-round48-premium-match-center-events-lineups.test.mjs
```

Expected: FAIL because current renderer is text-only.

- [ ] **Step 3: Implement placement helpers**

In `match-center-lineups.mjs`, add pure helpers:

```js
resolvePitchPosition(player, index, side)
formationPositions(formation, starters)
gridPosition(grid)
```

Precedence: explicit x/y → grid → valid formation fallback → unavailable.

- [ ] **Step 4: Implement pitch renderer and team switch**

Render one vertical mobile pitch with home/away segmented controls. Text starters/substitutes remain for both teams below the pitch. No horizontal scroll.

- [ ] **Step 5: Align Players cards visually**

Only presentation changes in `match-center-players.mjs`; preserve existing canonical fields/ranking semantics.

- [ ] **Step 6: Run lineups/player regressions GREEN**

```bash
cd cloudflare-test && node --test \
  test/v23-3-round48-premium-match-center-events-lineups.test.mjs \
  test/v23-3-round18-match-center-lineups-players.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Tasks 5–6**

```bash
git add cloudflare-test/src/v23.3/match-center-events.mjs cloudflare-test/src/v23.3/match-center-lineups.mjs cloudflare-test/src/v23.3/match-center-players.mjs cloudflare-test/test/v23-3-round48-premium-match-center-events-lineups.test.mjs
git commit -m "feat: add premium Match Center events and pitch lineups"
```

---

### Task 7: End-to-end five-tournament integration and mobile safety

**Files:**
- Modify only if required by failing integration: `cloudflare-test/src/v23.3/match-center-runtime.mjs`, `match-center-store.mjs`, `match-center-repository.mjs`, `match-center-overview.mjs`
- Test: `cloudflare-test/test/v23-3-round49-premium-match-center-integration.test.mjs`

**Interfaces:**
- Consumes: completed canonical/presentation stack.
- Produces: stable navigation and lazy-loading behavior for all five competitions.

- [ ] **Step 1: Write RED/guard integration matrix**

For each competition key (`serie_a`, `coppa_italia`, `ucl`, `uel`, `uecl`):
- render/open base;
- verify correct theme key/tokens;
- switch all five tabs;
- verify lazy section status behavior;
- verify error in one section keeps hero/base visible;
- assert rendered HTML does not contain `[object Object]`, `undefined`, `>null<`;
- assert 320px responsive CSS contains no forced horizontal overflow.

- [ ] **Step 2: Run integration test**

```bash
cd cloudflare-test && node --test test/v23-3-round49-premium-match-center-integration.test.mjs
```

Expected: PASS if prior tasks cover all paths; any failure is a real integration gap to fix minimally.

- [ ] **Step 3: Run full Match Center regression set**

```bash
cd cloudflare-test && node --test test/*match-center*.test.mjs test/v23-3-round46-*.test.mjs test/v23-3-round47-*.test.mjs test/v23-3-round48-*.test.mjs test/v23-3-round49-*.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit integration guard**

```bash
git add cloudflare-test/test/v23-3-round49-premium-match-center-integration.test.mjs cloudflare-test/src/v23.3
git commit -m "test: lock premium Match Center integration"
```

---

### Task 8: Dedicated deployed TEST probe and CI wiring

**Files:**
- Create: `cloudflare-test/scripts/probe-premium-match-center.mjs`
- Modify: `.github/workflows/ciao-test-check.yml`
- Test: `cloudflare-test/test/v23-3-round49-premium-match-center-integration.test.mjs` or `v23-3-probes.test.mjs`

**Interfaces:**
- Consumes: deployed TEST worker/app.
- Produces: CI evidence that premium Match Center markers/API are live after merge to develop.

- [ ] **Step 1: Add RED probe-source test**

Assert workflow references `probe-premium-match-center.mjs` and script checks:
- canonical Match Center endpoint responds;
- premium runtime marker/shell exists;
- five tournament theme identifiers are present in built TEST asset/runtime;
- no Production URL mutation.

- [ ] **Step 2: Implement probe**

Follow existing `probe-round39-match-center.mjs` style but use stable capability markers, never a future round-number string as the sole success condition.

- [ ] **Step 3: Wire workflow**

Add one `Probe deployed Premium Match Center` step to `.github/workflows/ciao-test-check.yml` after existing Match Center probe.

- [ ] **Step 4: Run probe/workflow tests GREEN**

```bash
cd cloudflare-test && node --test test/v23-3-probes.test.mjs test/v23-3-round49-premium-match-center-integration.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/scripts/probe-premium-match-center.mjs .github/workflows/ciao-test-check.yml cloudflare-test/test
git commit -m "test: add Premium Match Center deployment probe"
```

---

### Task 9: Full verification before PR merge

**Files:** no feature code expected.

- [ ] **Step 1: Run full Node suite**

```bash
cd cloudflare-test && npm test
```

Expected: PASS, zero failures.

- [ ] **Step 2: Build TEST artifact**

```bash
cd cloudflare-test && npm run build:test
```

If package scripts differ, use the exact build command already used by `.github/workflows/ciao-test-check.yml`.

Expected: success.

- [ ] **Step 3: Validate Worker bundle**

Run the same validation command from `.github/workflows/ciao-test-check.yml`.

Expected: success.

- [ ] **Step 4: Inspect diff for scope violations**

Confirm:
- no `main` ref change;
- no Production Worker config change;
- no Supabase addition;
- only TEST/develop-facing Match Center/docs/tests/probe files changed.

- [ ] **Step 5: Open PR to `develop`**

Title:

```text
TEST: Premium Match Center v2 complete upgrade
```

Body must enumerate canonical richness, five themes, scorers, shot map, events timeline, pitch lineups, tests and Production/main untouched.

- [ ] **Step 6: Wait for PR checks GREEN before merge**

Required evidence:
- `verify` success;
- any PR build checks success.

Do not merge while checks are pending/failing.

---

### Task 10: Merge to develop and deployed TEST verification

- [ ] **Step 1: Merge PR to `develop` only**

Do not target `main`.

- [ ] **Step 2: Fetch fresh develop SHA**

Record the merge SHA.

- [ ] **Step 3: Verify push CI**

Require:
- `verify` completed/success;
- `Workers Builds: ciao-web-app-test` completed/success;
- `Probe deployed Premium Match Center` completed/success.

- [ ] **Step 4: Verify `main` unchanged**

Fetch `main` after deployment and compare SHA to pre-work baseline.

- [ ] **Step 5: Manual visual acceptance on user screenshots**

Ask for screenshots of:
- one finished Serie A match;
- one UEFA competition match;
- Stats shot map;
- Events timeline;
- Lineups pitch.

Manual acceptance is visual-only and comes after automated data/code/deployment verification; do not claim pixel-perfect device rendering without this final screenshot check.
