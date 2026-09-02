# Ciao Web v23.3 Multi-Competition Predictions, Live Match Center, Home and Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Ciao, Web! so Серия А, Кубок Италии, Лига Чемпионов, Лига Европы and Лига Конференций share one canonical match layer across Home, Predictions, My Predictions, Match Center and Tables while preserving the already-stable Serie A upstream behavior.

**Architecture:** Keep Serie A on the existing `ciao-web-api` service binding and keep BSD Football v2 as the source for Coppa Italia/UCL/UEL/UECL. Add focused v23.3 browser modules and TEST Worker routes above the existing v23.2 canonical match model. External UEFA feeds become full-tournament feeds. The existing v23.2 profile filter remains club-specific. Prediction persistence is a hard server-compatibility gate: no browser-local substitute is allowed, and v23.3 predictions are not considered complete until the upstream storage path supports canonical competition-aware identity and server-side `kickoff - 15 minutes` enforcement.

**Tech Stack:** Cloudflare Workers, browser ES modules, Node 22 `node:test`, GitHub Actions, BSD Football API v2, existing `ciao-web-api` service binding.

**Spec:** `docs/superpowers/specs/2026-09-02-v23-3-multi-competition-predictions-live-tables-design.md`

## Global Constraints

- Work only on `develop` and the `ciao-web-app-test` deployment until the complete TEST acceptance checklist is GREEN.
- Do not deploy or modify production `ciao-web-app` during implementation.
- Do not execute the real Variant B prediction reset during development or TEST verification.
- Do not use Supabase.
- Keep Serie A schedule/live behavior on the existing verified `ciao-web-api` path; do not migrate Serie A to BSD.
- Keep `BSD_API_KEY` server-side. Never write it into HTML, browser modules, test artifacts or logs.
- Canonical match identity is always `competition + matchId`; provider event ids alone are not globally unique.
- All five competitions use the same scoring rules and the same deadline: exactly 15 minutes before kickoff.
- Prediction deadline authorization must be enforced server-side. Client-side disabling is only UX.
- Do not claim external-tournament predictions are complete until persistence, retrieval, scoring and deadline rejection have been verified through the real TEST backend path.
- No localStorage/sessionStorage/in-memory browser fallback may masquerade as prediction persistence.
- A single failed BSD competition must not take down Home or other competition tabs.
- Preserve v23.2 Coppa single-leg deduplication and club-profile filtering.
- Existing v23.2 TEST behavior is the regression baseline; every task follows RED → GREEN → full regression.

---

### Task 1: Observe and lock the exact legacy integration anchors before patching

**Files:**
- Modify: `cloudflare-test/src/v23.2/api-contract-observer.mjs`
- Modify: `cloudflare-test/scripts/inspect-api-contract.mjs`
- Create: `cloudflare-test/test/v23-3-source-contract.test.mjs`

**Purpose:** The stable base HTML is downloaded during build and contains the current Home, prediction, table and Match Center implementations. Before v23.3 patches those flows, make their source anchors explicit and regression-tested.

**Interfaces:**
- `extractSourceHints(source)` must include bounded, sanitized hints for:
  - the exact Home reset-banner text;
  - `function predict`;
  - `function mine`;
  - `saveAll` / `action:'save_predictions'`;
  - `action:'state'`;
  - the current user leaderboard renderer;
  - current Serie A table/navigation anchors;
  - current Match Center open/load functions;
  - existing `__cw231HomeHtml` / Today anchors.
- `inspect-api-contract.mjs` prints a separate safe `v233SourceHints` summary containing only source snippets, never authenticated response values.

- [ ] **Step 1: Write the failing source-contract test**

```js
const markers = [
  'Начало нового сезона!',
  'function predict',
  'function mine',
  "action:'save_predictions'",
  "action:'state'",
  'openMatchCenter',
  '__cw231HomeHtml',
  'serie_a_table',
];
for (const marker of markers) {
  assert.equal(extractSourceHints(sample).some(x => x.marker === marker), true);
}
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd cloudflare-test
npm test -- --test-name-pattern="v23.3 source contract"
```

Expected: FAIL because the new v23.3 markers are not yet part of the observer.

- [ ] **Step 3: Add the exact source markers and safe report grouping**

Keep the existing token/long-literal sanitization. Add only static-source inspection; do not make authenticated calls.

```js
const V233_SOURCE_MARKERS = new Set([
  'Начало нового сезона!',
  'function predict',
  'function mine',
  'saveAll',
  "action:'save_predictions'",
  "action:'state'",
  'openMatchCenter',
  '__cw231HomeHtml',
  'serie_a_table',
]);
```

- [ ] **Step 4: Verify GREEN and full regression**

```bash
npm test -- --test-name-pattern="v23.3 source contract"
npm test
```

Expected: focused test PASS; full suite has zero failures.

- [ ] **Step 5: Build and inspect the real stable source**

```bash
npm run build
npm run inspect:api-contract
```

Acceptance: every required v23.3 anchor appears in the safe report. If a required stable-base anchor is absent, stop this task and adjust the patch design to the observed source before touching UI behavior.

- [ ] **Step 6: Commit**

```bash
git add cloudflare-test/src/v23.2/api-contract-observer.mjs cloudflare-test/scripts/inspect-api-contract.mjs cloudflare-test/test/v23-3-source-contract.test.mjs
git commit -m "test: lock v23.3 legacy integration anchors"
```

---

### Task 2: Expand BSD to full UEFA feeds and add standings/live provider primitives

**Files:**
- Modify: `cloudflare-test/src/v23.2/match-normalizer.mjs`
- Modify: `cloudflare-test/src/v23.2/bsd-adapter.mjs`
- Modify: `cloudflare-test/src/v23.2/bsd-provider.mjs`
- Create: `cloudflare-test/src/v23.3/standing-normalizer.mjs`
- Modify: `cloudflare-test/test/v23-2-normalizer.test.mjs`
- Modify: `cloudflare-test/test/v23-2-worker-api.test.mjs`
- Create: `cloudflare-test/test/v23-3-bsd-provider.test.mjs`
- Keep green: `cloudflare-test/test/v23-2-coppa-dedup.test.mjs`

**Interfaces:**
- `shouldIncludeMatch(match)` becomes app-wide inclusion and no longer rejects foreign-vs-foreign UEFA fixtures.
- `fetchBsdMatches(...)` no longer calls `/teams/?country_code=IT` merely to filter UEFA matches.
- Add `fetchBsdStandings({ competition, apiKey, fetchImpl })` for `ucl`, `uel`, `uecl`.
- Add `fetchBsdMatchSnapshot({ competition, matchId, apiKey, fetchImpl })` that returns one canonical match snapshot for a BSD-backed competition without exposing the BSD token.
- Add `normalizeStandingRows(payload, competition)` returning canonical standing rows.

Canonical standing row:

```js
{
  competition,
  position: number | null,
  team: { id, name, rawName, crestUrl },
  played: number | null,
  wins: number | null,
  draws: number | null,
  losses: number | null,
  goalsFor: number | null,
  goalsAgainst: number | null,
  goalDifference: number | null,
  points: number | null,
}
```

- [ ] **Step 1: Write RED tests for full UEFA coverage**

Change the old expectation from “only Italian-club European matches” to full feed coverage:

```js
const italian = normalizeMatch(/* Inter-Arsenal */, 'ucl');
const foreign = normalizeMatch(/* Real Madrid-Bayern */, 'ucl');
assert.equal(shouldIncludeMatch(italian), true);
assert.equal(shouldIncludeMatch(foreign), true);
```

Worker/provider test must expect both mocked UCL events and must assert there is no `/teams/?country_code=IT` request.

- [ ] **Step 2: Write RED standings tests**

Mock:

```text
GET /api/v2/leagues/
GET /api/v2/leagues/{leagueId}/season/
GET /api/v2/leagues/{leagueId}/standings/?season_id={seasonId}
```

Assert a foreign club row is retained and mapped to canonical fields.

- [ ] **Step 3: Write RED match-snapshot tests**

The provider must resolve the canonical source id from `ucl:601024`, return the matching canonical event and preserve `live`/`finished` score + minute when BSD supplies them. The implementation may use BSD live-event data first and the competition event collection as the non-live fallback; it must never infer a score.

- [ ] **Step 4: Verify RED**

```bash
npm test -- --test-name-pattern="full UEFA|BSD standings|BSD match snapshot"
```

Expected: FAIL under the old Italian filter and missing provider functions.

- [ ] **Step 5: Implement the minimal provider refactor**

Refactor league/season resolution into an internal shared context so matches, standings and match snapshots reuse the same league/season lookup. Remove the `italianTeams()` filtering branch from `fetchBsdMatches`.

Standing normalization must accept provider field aliases defensively but never invent missing values.

- [ ] **Step 6: Verify Coppa regression explicitly**

```bash
npm test -- --test-name-pattern="Coppa Italia|Coppa single-leg|Coppa semifinals"
```

Expected: stale reversed single-leg pair is still collapsed; semifinal legs remain separate.

- [ ] **Step 7: Verify GREEN and full regression**

```bash
npm test -- --test-name-pattern="full UEFA|BSD standings|BSD match snapshot"
npm test
```

- [ ] **Step 8: Commit**

```bash
git add cloudflare-test/src/v23.2/match-normalizer.mjs cloudflare-test/src/v23.2/bsd-adapter.mjs cloudflare-test/src/v23.2/bsd-provider.mjs cloudflare-test/src/v23.3/standing-normalizer.mjs cloudflare-test/test/v23-2-normalizer.test.mjs cloudflare-test/test/v23-2-worker-api.test.mjs cloudflare-test/test/v23-3-bsd-provider.test.mjs
git commit -m "feat: expose full tournament feeds standings and live snapshots"
```

---

### Task 3: Build the v23.3 canonical multi-competition selectors and exact 15-minute deadline

**Files:**
- Create: `cloudflare-test/src/v23.3/competition-data.mjs`
- Create: `cloudflare-test/test/v23-3-competition-data.test.mjs`

**Interfaces:**

```js
predictionDeadlineForKickoff(kickoffAt) -> ISO string
loadAllCompetitionMatches({ loadMatches, from, to }) -> { data, errors }
flattenCompetitionFeeds(data) -> canonicalMatch[]
selectHomeMatches(matches, { now }) -> canonicalMatch[]
groupPredictionMatches(matches, competition) -> group[]
canonicalPredictionKey({ competition, matchId }) -> string
```

Rules:
- `predictionDeadlineForKickoff` is exactly 15 minutes before `kickoffAt`.
- `loadAllCompetitionMatches` uses all five keys and isolates failures with `Promise.allSettled` semantics.
- `selectHomeMatches` compares calendar dates in the browser/device local timezone by default. It returns today’s matches chronologically; if none exist, it returns the nearest upcoming fixture set without mixing in past matches.
- Serie A grouping uses round; cups/UEFA use stage, with local date as fallback when stage is empty.
- canonical prediction identity always includes competition and canonical match id.

- [ ] **Step 1: Write RED tests for exact deadline and identity**

```js
assert.equal(
  predictionDeadlineForKickoff('2026-09-16T19:00:00Z'),
  '2026-09-16T18:45:00.000Z',
);
assert.notEqual(
  canonicalPredictionKey({ competition:'ucl', matchId:'ucl:601024' }),
  canonicalPredictionKey({ competition:'uel', matchId:'uel:601024' }),
);
```

- [ ] **Step 2: Write RED Home selector tests**

Cover:
- matches from all five competitions interleaved by kickoff;
- today-first behavior;
- nearest upcoming fallback;
- one failed tournament load with the remaining four still returned.

- [ ] **Step 3: Write RED grouping tests**

Cover Serie A round grouping and stage/date fallback for Coppa/UCL/UEL/UECL.

- [ ] **Step 4: Verify RED**

```bash
npm test -- --test-name-pattern="v23.3 competition data|15-minute|Home selector"
```

- [ ] **Step 5: Implement the pure module**

Keep this module DOM-free and fetch-free except through injected loaders. Do not add timers or global side effects.

- [ ] **Step 6: Verify GREEN and full regression**

```bash
npm test -- --test-name-pattern="v23.3 competition data|15-minute|Home selector"
npm test
```

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/src/v23.3/competition-data.mjs cloudflare-test/test/v23-3-competition-data.test.mjs
git commit -m "feat: add v23.3 multi-competition selectors"
```

---

### Task 4: Add v23.3 Worker routes for standings and BSD Match Center snapshots

**Files:**
- Modify: `cloudflare-test/src/worker.js`
- Create: `cloudflare-test/test/v23-3-worker-data.test.mjs`
- Modify: `cloudflare-test/src/v23.2/data-client.mjs`
- Create: `cloudflare-test/src/v23.3/data-client.mjs`

**Routes:**

```text
GET /api/v23.3/standings?competition=serie_a|ucl|uel|uecl
GET /api/v23.3/match-center?competition=<key>&match_id=<canonical id>
```

`coppa_italia` does not expose standings; its Tables destination uses bracket data from matches.

**Interfaces:**
- `loadCompetitionStandings(competition, options)`
- `loadMatchCenterSnapshot(competition, matchId, options)`

- [ ] **Step 1: Write RED authorization tests**

Both new routes require `x-telegram-init-data` before any upstream call.

- [ ] **Step 2: Write RED UEFA standings route tests**

Assert the Worker passes only the server BSD token to the provider and returns canonical standing rows.

- [ ] **Step 3: Lock the Serie A table contract**

Using Task 1’s observed stable source, forward the exact existing Serie A table request to `CIAO_WEB_API`; do not invent a new Serie A standings model if the old API already provides it. The Worker response may normalize the result for v23.3, but the upstream request shape must match the observed contract.

- [ ] **Step 4: Write RED BSD Match Center route tests**

Assert:
- canonical key + id required;
- competition/id mismatch rejected;
- live score/minute returned when present;
- finished score retained;
- provider error returns safe metadata and never the token.

- [ ] **Step 5: Verify RED**

```bash
npm test -- --test-name-pattern="v23.3 standings route|v23.3 match center route"
```

- [ ] **Step 6: Implement Worker handlers and clients**

Keep existing `/api/v23.2/matches` intact so v23.2 profile/matches regressions remain stable.

- [ ] **Step 7: Verify GREEN and full regression**

```bash
npm test -- --test-name-pattern="v23.3 standings route|v23.3 match center route"
npm test
```

- [ ] **Step 8: Commit**

```bash
git add cloudflare-test/src/worker.js cloudflare-test/src/v23.2/data-client.mjs cloudflare-test/src/v23.3/data-client.mjs cloudflare-test/test/v23-3-worker-data.test.mjs
git commit -m "feat: add v23.3 standings and match center APIs"
```

---

### Task 5: Rename Serie A, remove the Home reset banner and hydrate “Кальчо сегодня” from all five competitions

**Files:**
- Modify: `cloudflare-test/src/v23.2/competition-config.mjs`
- Create: `cloudflare-test/src/v23.3/home-integration.mjs`
- Create: `cloudflare-test/scripts/home-v23-3-source-patch.mjs`
- Modify: `cloudflare-test/scripts/build.mjs`
- Modify: `cloudflare-test/test/v23-2-localization.test.mjs`
- Create: `cloudflare-test/test/v23-3-home-integration.test.mjs`
- Modify: `cloudflare-test/test/build.test.mjs`

**User-visible requirements:**
- `Serie A` → `Серия А` in Russian-facing tournament UI.
- Remove exactly the supplied Home reset notice; replace it with nothing.
- “Кальчо сегодня” reads all five feeds.
- Each Home match card has a compact competition label.
- Match cards carry both competition and canonical match id so Match Center routing is unambiguous.

**Runtime interface:**

```js
globalThis.CiaoV233Home = {
  ensure(),
  html(),
  state(),
}
```

`ensure()` fetches all five competition feeds once per bounded refresh window and preserves successful results if one feed fails. `html()` is synchronous over cached state so the stable Home renderer can use it without turning the legacy render function asynchronous.

- [ ] **Step 1: Update localization expectation to RED**

```js
assert.equal(getCompetitionConfig('serie_a').title, 'Серия А');
```

- [ ] **Step 2: Write RED source-patch tests**

The patch must:
- remove `Начало нового сезона! Счёт обнулен, все начинают с нуля. Удачи!`;
- insert one idempotent `cw233-home-multicompetition` marker;
- call `CiaoV233Home.ensure()` without blocking the legacy initial render;
- use `CiaoV233Home.html()` when hydrated.

- [ ] **Step 3: Write RED Home renderer tests**

Feed it canonical matches from all five competitions and assert labels such as `Кубок Италии` and `Лига Чемпионов` appear on cards in kickoff order.

- [ ] **Step 4: Verify RED**

```bash
npm test -- --test-name-pattern="Серия А|v23.3 Home|reset banner"
```

- [ ] **Step 5: Implement config, Home runtime and build source patch**

The patch must fail the build when the known stable Home anchor is absent; silent patch failure is not acceptable.

- [ ] **Step 6: Verify GREEN, build and full regression**

```bash
npm test -- --test-name-pattern="Серия А|v23.3 Home|reset banner"
npm test
npm run build
```

Inspect `dist/index.html`: reset-banner text absent, v23.3 Home marker present once.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/src/v23.2/competition-config.mjs cloudflare-test/src/v23.3/home-integration.mjs cloudflare-test/scripts/home-v23-3-source-patch.mjs cloudflare-test/scripts/build.mjs cloudflare-test/test/v23-2-localization.test.mjs cloudflare-test/test/v23-3-home-integration.test.mjs cloudflare-test/test/build.test.mjs
git commit -m "feat: make Home multi-competition"
```

---

### Task 6: Move Coppa bracket to Tables and add full UEFA Tables UI

**Files:**
- Modify: `cloudflare-test/src/v23.2/matches-ui.mjs`
- Modify: `cloudflare-test/test/v23-2-coppa-bracket.test.mjs`
- Create: `cloudflare-test/src/v23.3/tables-ui.mjs`
- Create: `cloudflare-test/test/v23-3-tables-ui.test.mjs`

**Interfaces:**

```js
renderTablesHub({ selectedCompetition, data }) -> HTML
loadTablesCompetition(competition, deps) -> Promise<HTML>
createTablesUiController(deps)
installTablesUi(documentRef, options)
```

**Behavior:**
- Tables selectors: Серия А, Лига Чемпионов, Лига Европы, Лига Конференций, Кубок Италии.
- UCL/UEL/UECL render complete provider standings including foreign clubs.
- Serie A reuses the existing verified Serie A table source/contract from Task 4.
- Coppa destination loads Coppa matches and renders existing `buildCoppaBracket()`.
- `Матчи → Кубок Италии` renders only the schedule. No `Матчи / Сетка Плей-офф` segmented control remains there.
- Horizontal overflow is contained to selector/bracket viewports, not the document.

- [ ] **Step 1: Flip the old Coppa UI test to RED**

```js
const html = renderCompetitionScreen('coppa_italia', data);
assert.doesNotMatch(html, /data-cw232-coppa-view="bracket"/);
assert.doesNotMatch(html, /Сетка Плей-офф/);
```

Existing pure bracket tests remain unchanged and GREEN.

- [ ] **Step 2: Write RED Tables tests**

Assert all five destinations are present; UCL sample contains a non-Italian club; missing provider statistic renders `—`; Coppa output contains `cw232-bracket-viewport` and explicit winner placeholders only from source linkage.

- [ ] **Step 3: Write RED navigation isolation test**

Capture-phase bottom-navigation handling must not break the existing Matches overlay or Profile behavior. Tables overlay mounts inside `#ciao-miniapp-root`.

- [ ] **Step 4: Verify RED**

```bash
npm test -- --test-name-pattern="Coppa screen|v23.3 Tables"
```

- [ ] **Step 5: Implement minimal UI**

Reuse `getCompetitionConfig`, `loadCompetitionStandings`, `loadCompetitionMatches`, and `buildCoppaBracket`; do not duplicate provider logic inside the UI.

- [ ] **Step 6: Verify GREEN and regression**

```bash
npm test -- --test-name-pattern="Coppa bracket|Coppa screen|v23.3 Tables"
npm test
```

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/src/v23.2/matches-ui.mjs cloudflare-test/test/v23-2-coppa-bracket.test.mjs cloudflare-test/src/v23.3/tables-ui.mjs cloudflare-test/test/v23-3-tables-ui.test.mjs
git commit -m "feat: move Coppa bracket into tournament tables"
```

---

### Task 7: Build one Match Center entry flow for Serie A and BSD-backed tournaments

**Files:**
- Create: `cloudflare-test/src/v23.3/match-center.mjs`
- Create: `cloudflare-test/test/v23-3-match-center.test.mjs`
- Modify: `cloudflare-test/src/v23.3/home-integration.mjs`
- Modify: `cloudflare-test/src/v23.2/matches-ui.mjs`
- Modify: `cloudflare-test/src/v23.2/profile-integration.mjs`

**Interfaces:**

```js
openCanonicalMatchCenter({ competition, matchId, initialMatch })
createMatchCenterController({ loadSnapshot, now, setTimer, clearTimer, documentRef })
renderMatchCenter(state) -> HTML
```

**Behavior:**
- Serie A canonical cards delegate to the existing stable Serie A Match Center where possible; do not replace working Serie A detail/statistics with a reduced BSD-style view.
- Coppa/UCL/UEL/UECL use `/api/v23.3/match-center`.
- Scheduled: teams, logos, competition, local kickoff.
- Live: score + LIVE + minute only when provided.
- Finished: final score.
- Poll only while the opened match is live. Use a bounded interval of 15 seconds.
- Stop polling when the overlay closes or `document.hidden === true`; refresh once visibility returns if the match is still live.
- A transient refresh error keeps the last good state and displays a non-destructive retry/status notice.

- [ ] **Step 1: Write RED render/state tests**

Cover scheduled/live/finished and absent-minute behavior.

- [ ] **Step 2: Write RED polling lifecycle tests**

Use injected timers/document stub. Assert no recurring calls for scheduled/finished matches and no hidden-page hammering.

- [ ] **Step 3: Write RED canonical-click tests**

Home, external tournament schedule and profile external match cards must expose `competition + matchId`, not numeric id alone.

- [ ] **Step 4: Verify RED**

```bash
npm test -- --test-name-pattern="v23.3 Match Center|canonical match center"
```

- [ ] **Step 5: Implement controller and integrations**

Keep the controller isolated from data fetching through injected `loadSnapshot` so polling is deterministic in tests.

- [ ] **Step 6: Verify GREEN and Serie A regression**

```bash
npm test -- --test-name-pattern="v23.3 Match Center|match center|Serie A"
npm test
```

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/src/v23.3/match-center.mjs cloudflare-test/test/v23-3-match-center.test.mjs cloudflare-test/src/v23.3/home-integration.mjs cloudflare-test/src/v23.2/matches-ui.mjs cloudflare-test/src/v23.2/profile-integration.mjs
git commit -m "feat: add canonical tournament match center"
```

---

### Task 8: Establish the prediction backend compatibility gate before building the new prediction UI

**Files:**
- Modify: `cloudflare-test/scripts/inspect-api-contract.mjs`
- Create: `cloudflare-test/src/v23.3/prediction-contract.mjs`
- Create: `cloudflare-test/test/v23-3-prediction-contract.test.mjs`
- Create: `cloudflare-test/scripts/probe-prediction-contract.mjs`
- Modify: `.github/workflows/ciao-test-check.yml`

**Observed legacy contract to preserve:**

```js
api({ action:'state', round })
api({
  action:'save_predictions',
  round:S.selected_round,
  predictions:[{ match_id, home_score, away_score }],
})
```

**Required v23.3 server capability:**

```js
{
  user: authenticated Telegram identity,
  competition_key: 'serie_a' | 'coppa_italia' | 'ucl' | 'uel' | 'uecl',
  match_id: canonical match id,
  home_score: integer,
  away_score: integer,
}
```

The server must persist/retrieve external matches without id collision, apply the existing scoring system to all five competitions, and reject a write at or after `kickoffAt - 15 minutes` based on authoritative server time/match data.

**Hard gate outcomes:**
- **PASS:** the connected TEST backend supports the required canonical identity and deadline semantics; proceed to Tasks 9–10.
- **BLOCKED:** the backend ignores/rejects competition-aware identity, cannot store external match ids, cannot score them, or enforces a different deadline. In that state, do not ship a fake client implementation and do not claim predictions complete. Record the exact safe failure code/shape and stop prediction implementation until the backend source/deployment is made available or the service exposes the needed contract.

- [ ] **Step 1: Write RED pure contract tests**

Validate payload construction, canonical id validation, integer score bounds and 15-minute deadline calculations. No network needed.

- [ ] **Step 2: Add a non-destructive probe script**

The CI version of `probe-prediction-contract.mjs` must only inspect static contract markers unless a dedicated isolated TEST credential/data fixture is explicitly supplied. It must never mutate a real user by default.

- [ ] **Step 3: Add workflow artifact/reporting**

Add a clearly named v23.3 prediction-contract observation artifact. It may report `requires_authenticated_smoke: true`; that is not a PASS for persistence.

- [ ] **Step 4: Verify tests and static probe**

```bash
npm test -- --test-name-pattern="v23.3 prediction contract"
node scripts/probe-prediction-contract.mjs
```

- [ ] **Step 5: Execute the authenticated TEST smoke through an isolated TEST account/fixture**

Required smoke sequence:
1. read one external scheduled match;
2. save a harmless TEST prediction well before deadline;
3. read it back by the same `competition_key + match_id`;
4. verify a same-number id in another competition cannot collide;
5. verify server rejection at the deadline boundary using an isolated deterministic fixture or server test hook;
6. verify scoring uses the same rule set as Serie A on an isolated calculated fixture.

Do not use production user history for this smoke.

- [ ] **Step 6: Apply the gate**

Proceed only on PASS. On BLOCKED, commit the observation/test infrastructure, report the backend contract gap, and stop Tasks 9–10 without creating browser-local persistence.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/scripts/inspect-api-contract.mjs cloudflare-test/src/v23.3/prediction-contract.mjs cloudflare-test/test/v23-3-prediction-contract.test.mjs cloudflare-test/scripts/probe-prediction-contract.mjs .github/workflows/ciao-test-check.yml
git commit -m "test: gate v23.3 prediction persistence contract"
```

---

### Task 9: Add server-side v23.3 prediction read/write adapter after the compatibility gate passes

**Precondition:** Task 8 outcome is PASS.

**Files:**
- Modify: `cloudflare-test/src/worker.js`
- Modify: `cloudflare-test/src/v23.3/data-client.mjs`
- Create: `cloudflare-test/test/v23-3-prediction-api.test.mjs`

**Routes:**

```text
GET  /api/v23.3/predictions?competition=<key>
POST /api/v23.3/predictions
```

POST body:

```js
{
  competition_key,
  predictions: [
    { match_id, home_score, away_score }
  ]
}
```

**Server rules:**
- derive user from Telegram initData/upstream authentication; never accept a client `user_id`;
- validate `competition_key`;
- validate each canonical match exists in the authoritative competition feed;
- compute deadline server-side from authoritative kickoff;
- reject at `now >= kickoff - 15 minutes`;
- forward to the tested persistence contract from Task 8;
- return saved records only after upstream confirmation;
- never trust client-provided kickoff/status/points.

- [ ] **Step 1: Write RED auth and identity tests**

Assert missing Telegram auth returns 401 before upstream calls; same numeric provider ids in different competitions remain distinct.

- [ ] **Step 2: Write RED deadline boundary tests**

With injected server clock/provider fixture:

```js
kickoff = '2026-09-16T19:00:00Z'
18:44:59.999Z -> allowed
18:45:00.000Z -> rejected
```

- [ ] **Step 3: Write RED upstream failure tests**

A persistence failure must return failure; never respond with optimistic `saved` success.

- [ ] **Step 4: Verify RED**

```bash
npm test -- --test-name-pattern="v23.3 prediction API"
```

- [ ] **Step 5: Implement the adapter using only the verified Task 8 contract**

Do not broaden the upstream protocol beyond fields proven to work in TEST.

- [ ] **Step 6: Verify GREEN and full regression**

```bash
npm test -- --test-name-pattern="v23.3 prediction API"
npm test
```

- [ ] **Step 7: Commit**

```bash
git add cloudflare-test/src/worker.js cloudflare-test/src/v23.3/data-client.mjs cloudflare-test/test/v23-3-prediction-api.test.mjs
git commit -m "feat: add multi-competition prediction API"
```

---

### Task 10: Build Predictions and My Predictions with five tournament tabs

**Precondition:** Tasks 8 and 9 are GREEN and authenticated TEST persistence is verified.

**Files:**
- Create: `cloudflare-test/src/v23.3/predictions-ui.mjs`
- Create: `cloudflare-test/test/v23-3-predictions-ui.test.mjs`

**Interfaces:**

```js
renderPredictionShell(state) -> HTML
renderPredictionCompetition(state) -> HTML
renderMyPredictions(state) -> HTML
createPredictionsController(deps)
installPredictionsUi(documentRef, options)
```

**Behavior:**
- preserve top switch `Прогнозы / Мои прогнозы`;
- inside both add: Серия А, Кубок Италии, Лига Чемпионов, Лига Европы, Лига Конференций;
- Serie A uses rounds;
- external competitions use stage/date groups;
- exact UI deadline label reflects −15 minutes;
- editing disabled at/after deadline but saved prediction remains visible;
- save confirmation only after server confirmation;
- cards open canonical Match Center;
- tabs may scroll inside their own viewport but must not widen the document;
- global ranking remains one combined ranking, not five leaderboards.

- [ ] **Step 1: Write RED navigation/render tests**

Assert all five tabs appear in both top modes and labels are Russian.

- [ ] **Step 2: Write RED deadline interaction tests**

Before deadline: score controls/save active. At deadline: controls disabled and saved prediction still rendered.

- [ ] **Step 3: Write RED grouping/My Predictions tests**

Assert Serie A round grouping, external stage/date grouping and competition-aware retrieval.

- [ ] **Step 4: Write RED save-failure test**

Controller must preserve edit state and show error when POST fails.

- [ ] **Step 5: Verify RED**

```bash
npm test -- --test-name-pattern="v23.3 Predictions UI"
```

- [ ] **Step 6: Implement capture-safe bottom-navigation integration**

Follow the proven v23.2 Matches overlay pattern so legacy bubbling/`stopPropagation()` cannot hide the new prediction surface.

- [ ] **Step 7: Verify GREEN and mobile overflow tests**

```bash
npm test -- --test-name-pattern="v23.3 Predictions UI"
npm test
```

- [ ] **Step 8: Commit**

```bash
git add cloudflare-test/src/v23.3/predictions-ui.mjs cloudflare-test/test/v23-3-predictions-ui.test.mjs
git commit -m "feat: add predictions for all supported tournaments"
```

---

### Task 11: Prepare the full Variant B reset safely without executing it on real data

**Precondition:** Prediction backend contract is known from Task 8.

**Files:**
- Create: `cloudflare-test/src/v23.3/reset-contract.mjs`
- Create: `cloudflare-test/test/v23-3-reset-contract.test.mjs`
- Create: `cloudflare-test/scripts/probe-reset-contract.mjs`
- Modify: `.github/workflows/ciao-test-check.yml`

**Required reset semantics:**
- previous prediction submissions removed;
- awarded prediction points removed;
- predictor leaderboard/ranking aggregates cleared;
- derived caches/aggregates that can recreate old totals cleared;
- legacy My Predictions history empty after reset.

**Safety design:**
- normal browser code has no reset button or reset endpoint access;
- TEST probe defaults to dry-run/contract inspection and cannot target production origin;
- real reset implementation must use the backend’s verified guarded reset capability or backend deployment procedure; do not create an unauthenticated Worker deletion endpoint;
- reset command must expose an auditable staged result and an idempotency key/guard.

- [ ] **Step 1: Write RED safety tests**

Assert production hostname/environment is rejected by TEST reset tooling and default invocation is non-destructive.

- [ ] **Step 2: Write RED reset-result tests**

Canonical result shape:

```js
{
  ok,
  dryRun,
  stages: {
    predictions: { ok, affected },
    points: { ok, affected },
    ranking: { ok, affected },
    caches: { ok, affected },
  },
  resetKey,
}
```

A partial stage failure yields overall `ok:false`.

- [ ] **Step 3: Implement only the safe contract/probe supported by the real backend**

If the current connected backend exposes no guarded reset capability, the correct implementation outcome in this repository is a verified **BLOCKED_FOR_PRODUCTION_RESET** contract report, not a fake destructive endpoint. Production cutover remains blocked until backend reset capability is available.

- [ ] **Step 4: Verify**

```bash
npm test -- --test-name-pattern="v23.3 reset contract"
node scripts/probe-reset-contract.mjs
```

Expected during normal TEST work: no real user data deleted.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/reset-contract.mjs cloudflare-test/test/v23-3-reset-contract.test.mjs cloudflare-test/scripts/probe-reset-contract.mjs .github/workflows/ciao-test-check.yml
git commit -m "test: prepare guarded prediction reset contract"
```

---

### Task 12: Assemble the v23.3 browser entry and build pipeline

**Files:**
- Create: `cloudflare-test/src/v23.3/index.mjs`
- Modify: `cloudflare-test/scripts/build.mjs`
- Create: `cloudflare-test/test/v23-3-build.test.mjs`
- Modify: `cloudflare-test/package.json` only if a new explicit probe script command materially improves CI readability.

**Entry responsibilities:**
- import/install v23.3 Home integration;
- install Tables UI;
- install canonical Match Center;
- install Predictions UI only when the prediction backend gate has passed in the implementation branch;
- preserve v23.2 profile integration and any still-used v23.2 Matches UI;
- expose a small immutable diagnostic object, e.g. `globalThis.CiaoV233`, without auto-fetching user data before the relevant screen needs it.

- [ ] **Step 1: Write RED build-entry tests**

Assert:
- `/v23.3/index.mjs` is copied to dist;
- one `ciao-v233` module entry is injected;
- injection is idempotent;
- v23.2 core/profile entries remain present;
- Home source patch marker is present;
- no reset function is exposed in browser globals.

- [ ] **Step 2: Verify RED**

```bash
npm test -- --test-name-pattern="v23.3 build"
```

- [ ] **Step 3: Implement `copyV233Modules()` and entry injection**

Use a separate `dist/v23.3/` directory; do not overwrite v23.2 browser modules.

- [ ] **Step 4: Verify GREEN, build, static inspection**

```bash
npm test -- --test-name-pattern="v23.3 build"
npm test
npm run build
```

Verify generated HTML contains each entry exactly once and the reset-banner text is absent.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/src/v23.3/index.mjs cloudflare-test/scripts/build.mjs cloudflare-test/test/v23-3-build.test.mjs cloudflare-test/package.json
git commit -m "feat: assemble v23.3 browser runtime"
```

---

### Task 13: Expand CI and live TEST probes for v23.3 release evidence

**Files:**
- Modify: `cloudflare-test/scripts/probe-bsd-provider.mjs`
- Modify: `cloudflare-test/scripts/probe-test-deployment.mjs`
- Modify: `.github/workflows/ciao-test-check.yml`
- Modify: `cloudflare-test/test/v23-2-workflow.test.mjs`
- Create: `cloudflare-test/test/v23-3-probes.test.mjs`

**Provider probe requirements:**
- Coppa/UCL/UEL/UECL match routes available;
- UCL/UEL/UECL prove at least one non-Italian-vs-non-Italian fixture is retained when present in provider data;
- UCL/UEL/UECL standings return complete table-shaped data and include foreign clubs;
- current unknown team names listed;
- Coppa stale tie duplicate guard still reports no duplicate tie;
- BSD live/snapshot provider contract is reachable without logging credentials.

**Deployment probe requirements:**
- health endpoint reports expected TEST build/provider;
- v23.3 entry/module markers present;
- `Серия А` label present in v23.3 config/runtime;
- Home reset banner absent;
- Home multi-competition marker present;
- Tables module present;
- Match Center module present;
- Predictions module present only after Task 8 PASS + Task 9 implementation;
- Coppa bracket marker is absent from `Матчи → Кубок Италии` renderer and present in Tables module;
- profile module still present;
- document-overflow guard styles present;
- all current feed team names are translated at release time, or the probe explicitly lists the remaining names and release is held until registry coverage is completed.

- [ ] **Step 1: Write RED probe-structure tests**

Test scripts statically for the new v23.3 assertions and artifact names.

- [ ] **Step 2: Verify RED**

```bash
npm test -- --test-name-pattern="v23.3 probes|workflow"
```

- [ ] **Step 3: Implement probe expansions and workflow artifact uploads**

Keep outputs safe: no Telegram initData, user ids, predictions, BSD token or private response bodies in artifacts.

- [ ] **Step 4: Verify locally**

```bash
npm test
npm run build
node scripts/probe-bsd-provider.mjs
node scripts/probe-test-deployment.mjs
```

The deployed TEST probe can legitimately lag a just-created local build; do not call the deployment current until the corresponding Cloudflare deployment has completed.

- [ ] **Step 5: Commit**

```bash
git add cloudflare-test/scripts/probe-bsd-provider.mjs cloudflare-test/scripts/probe-test-deployment.mjs .github/workflows/ciao-test-check.yml cloudflare-test/test/v23-2-workflow.test.mjs cloudflare-test/test/v23-3-probes.test.mjs
git commit -m "test: verify v23.3 live tournament surfaces"
```

---

### Task 14: Final TEST verification, Telegram visual acceptance and TEST release boundary

**Files:**
- No feature code unless a verification failure produces a targeted bug fix with its own regression test.

- [ ] **Step 1: Run fresh local verification**

```bash
cd cloudflare-test
npm install --no-audit --no-fund
npm test
npm run build
npm run inspect:api-contract
node scripts/probe-bsd-provider.mjs
```

Acceptance: all commands exit 0; zero test failures.

- [ ] **Step 2: Push `develop` and wait for the exact-head CI run**

Confirm the workflow checked out the current v23.3 head SHA. Do not reuse an older GREEN run as evidence.

- [ ] **Step 3: Read the full deployment-probe log**

Verify all live TEST requirements from Task 13 against the actual `ciao-web-app-test` deployment after Cloudflare has updated.

- [ ] **Step 4: Telegram visual acceptance checklist**

On the TEST button, verify:
1. Home reset notice gone.
2. `Серия А` spelling correct.
3. “Кальчо сегодня” includes fixtures from every competition that has the nearest/current-day matches and displays competition labels.
4. `Матчи → Кубок Италии` has no bracket tab.
5. External tournament cards open Match Center and live/final score updates correctly on available fixtures.
6. `Таблицы` has all five selectors; UEFA tables contain foreign clubs; Coppa bracket is there.
7. `Прогнозы` and `Мои прогнозы` have all five selectors, only if prediction gate passed.
8. Prediction deadline UI is 15 minutes and server rejection is verified.
9. No horizontal document overflow on Telegram mobile widths.
10. Club profile still shows only that club’s tournament fixtures.

- [ ] **Step 5: Verify reset remains unexecuted**

TEST evidence must explicitly show real Variant B production reset has not run.

- [ ] **Step 6: Create the TEST release PR only after GREEN evidence and user visual approval**

Open `develop -> main`, review diff/checks, merge only when GREEN. Then repeat health/module/live deployment probes against the TEST deployment corresponding to the merged `main` SHA.

- [ ] **Step 7: Stop before Production**

Do not deploy production and do not run the real reset. Production requires a separate explicit user approval after TEST acceptance.

---

## Production Cutover Runbook (Not Executed by This Plan Session)

This section defines the later guarded order only; it is not permission to run Production now.

1. Confirm TEST release is approved and all v23.3 checks are GREEN.
2. Prepare the exact Production build from the approved TEST code.
3. Deploy Production without running reset yet.
4. Verify Production health, all five match feeds, standings, Match Center and prediction server contract with non-destructive smoke checks.
5. Obtain explicit final user approval for Variant B reset.
6. Execute the verified guarded reset once with its idempotency/reset key.
7. Verify predictions count/history, points, ranking and derived aggregates are zero/empty as specified.
8. Verify new predictions can be created under the new five-competition model and the 15-minute server deadline remains enforced.
9. Preserve the reset audit result.

## Completion Evidence Required Before Any “Done” Claim

A completion claim requires fresh evidence from the same final code revision:

- full `npm test` with zero failures;
- successful `npm run build`;
- successful provider probe;
- successful live TEST deployment probe after Cloudflare has deployed the same head;
- prediction compatibility gate PASS plus authenticated isolated TEST smoke for persistence/scoring/deadline;
- Telegram visual acceptance for Home, Predictions, My Predictions, Match Center, Tables and Coppa bracket move;
- explicit confirmation that Production was not touched and the real reset was not executed.

If the prediction backend compatibility gate or reset capability is BLOCKED, report the exact blocked subsystem and complete the non-blocked Home/Matches/Match Center/Tables work, but do not describe the whole v23.3 package as complete.