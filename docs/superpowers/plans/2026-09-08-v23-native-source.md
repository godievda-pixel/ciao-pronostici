# Ciao, Web! v23 Native Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v23.0 as a new repository-tracked application release with the approved Home and Predictions changes, without rebuilding v22.5 through the legacy runtime injection chain.

**Architecture:** Capture the exact current production Worker HTML once as `cloudflare-production/src/v23/index.html`, then make v23 changes directly in that tracked source. Switch `build.mjs` to a direct v23 build path that validates and copies the source, preserving the existing SHA-256 Telegram release gate and keeping v22.5 history/rollback intact.

**Tech Stack:** Cloudflare Workers, Wrangler, Node.js 22, Node test runner, inline HTML/CSS/JavaScript, GitHub Actions, Supabase Edge Functions for the existing Telegram router.

**Spec:** `docs/superpowers/specs/2026-09-08-v23-native-source-design.md`

## Global Constraints

- v22.5 remains untouched and rollback-capable.
- v23.0 must not execute the legacy `inject...Patch` chain during build.
- Cloudflare deploys only from `main`.
- PR runs must not mutate Telegram.
- Existing content-derived Telegram revision automation stays active.
- No product UI change is merged until tests and build pass.

---

### Task 1: Capture the frozen v23.0 source snapshot

**Files:**
- Create: `cloudflare-production/src/v23/index.html`
- Create temporarily: `.github/workflows/capture-v23-source.yml`
- Test: `cloudflare-production/test/v23-source.test.mjs`

**Interfaces:**
- Produces: a tracked UTF-8 HTML file whose SHA-256 initially matches the live production Worker bytes.

- [ ] **Step 1: Write the failing source-presence test**

Create `cloudflare-production/test/v23-source.test.mjs` that reads `../src/v23/index.html` and asserts it contains `Ciao, Web!`, `ciao-prod-home-calcio-polish-20260908`, `ciao-prod-multitournament-predictions-20260907`, and no placeholder text.

- [ ] **Step 2: Run test and verify RED**

Run `npm test -- --test-name-pattern="v23 source"` from `cloudflare-production`.
Expected: FAIL because `src/v23/index.html` does not exist.

- [ ] **Step 3: Capture exact live Worker HTML into the feature branch**

Add a temporary GitHub workflow with `permissions: contents: write` that runs only on `feat/v23-native-source`, downloads `https://ciao-web-app.ciao-web.workers.dev/` with `curl --fail --silent --show-error`, verifies the existing production markers, writes it to `cloudflare-production/src/v23/index.html`, and commits only that file back to the same feature branch.

- [ ] **Step 4: Run the test and verify GREEN**

Run the PR CI and confirm the v23 source test passes.

- [ ] **Step 5: Remove the temporary capture workflow**

Delete `.github/workflows/capture-v23-source.yml` after the snapshot is committed so production cannot recapture mutable live content later.

---

### Task 2: Add a direct v23 build path

**Files:**
- Modify: `cloudflare-production/scripts/build.mjs`
- Test: `cloudflare-production/test/v23-build.test.mjs`

**Interfaces:**
- Produces: `buildV23()` and `validateV23Source(html)`; `build()` uses v23 local source and never calls the legacy patch chain.

- [ ] **Step 1: Write failing build-path tests**

Test that `buildV23({sourceHtml, outputDir})` writes byte-identical `index.html` and `releases/v23.html`, writes `release-revision.txt`, and that `build()` source code does not invoke `injectBsdCrestPatch`, `injectMultitournamentPatch`, `injectPredictionMineStagePolishPatch`, or `injectHomeCalcioPolishSafePatch` on the active v23 path.

- [ ] **Step 2: Run tests and verify RED**

Expected: FAIL because `buildV23`/`validateV23Source` do not exist.

- [ ] **Step 3: Implement the direct v23 builder**

Read `src/v23/index.html` via `readFile`, validate required v23 markers and `validateBrowserScripts`, then write it directly through `writeBuildOutputs` using `releases/v23.html`. Keep legacy helper imports only if required by old tests/history, but do not call them in `build()`.

- [ ] **Step 4: Run full tests and build**

Run `npm test` and `npm run build`.
Expected: PASS; build output identifies v23 and revision from exact source bytes.

---

### Task 3: Implement Home directly in v23 source

**Files:**
- Modify: `cloudflare-production/src/v23/index.html`
- Test: `cloudflare-production/test/v23-home.test.mjs`

**Interfaces:**
- Produces native v23 renderer behavior without a post-render Home patch.

- [ ] **Step 1: Write RED structural tests**

Parse source text and assert the native Home renderer emits a stable user-card marker before the favorite-club shell, contains `Кальчо сегодня`, includes competition labels/crest markup for today cards, and nearest-match markup has a Match Center data contract and opponent crest.

- [ ] **Step 2: Verify RED**

Expected: FAIL against frozen source because legacy Home markup/order remains.

- [ ] **Step 3: Modify native Home rendering code**

Edit the v23 source directly so the Home HTML is generated in this order: user card -> favorite club -> Calcio Today -> prediction rounds/content. Replace the native favorite match body with opponent crest + competition/date/status and Match Center navigation attributes. Make the favorite profile button use the premium class in the generated markup. Generate Calcio Today from the existing Serie A data plus the existing multi-tournament payload/helpers for Coppa Italia, Champions League, Europa League and Conference League, filtering to matches involving Italian clubs and today's local calendar date.

- [ ] **Step 4: Remove the obsolete Home/Calcio post-render layer from v23 source**

Delete the `ciao-prod-home-calcio-polish-20260908` runtime block and its safety block from the v23 source after its behavior has been absorbed into native render functions.

- [ ] **Step 5: Run tests and build**

Expected: PASS with browser-script syntax validation.

---

### Task 4: Implement Predictions directly in v23 source

**Files:**
- Modify: `cloudflare-production/src/v23/index.html`
- Test: `cloudflare-production/test/v23-predictions.test.mjs`

**Interfaces:**
- Produces native lock-free disabled stage buttons and unclipped Mine cards.

- [ ] **Step 1: Write RED source-contract tests**

Assert the native round/stage renderers never emit `🔒` or `🔐`, locked future buttons include `disabled`, `aria-disabled="true"`, and `tabindex="-1"`, and the Mine prediction block contains `ВАШ ПРОГНОЗ`, `— : —`, `Прогноз не сделан` with dedicated class names for layout.

- [ ] **Step 2: Verify RED**

Expected: FAIL because the frozen source still emits lock glyphs in at least the Serie A `roundBar()` and relies on late patches.

- [ ] **Step 3: Modify native Predictions renderers**

Change `roundBar()` and external competition stage buttons directly. Remove lock pseudo-icon CSS. Keep disabled behavior in event handlers by relying on disabled controls and existing lock guards. Fold the Mine v3 card markup/styles into the native `mine()`/external Mine renderers.

- [ ] **Step 4: Delete obsolete prediction lock/mine post-render overrides from v23 source**

Remove v23 copies of `ciao-prod-prediction-stage-lock-ui-20260907` and `ciao-prod-prediction-mine-stage-polish-20260907` only after native behavior is present.

- [ ] **Step 5: Run tests and build**

Expected: PASS.

---

### Task 5: Freeze rollback metadata and verify no legacy injection path

**Files:**
- Modify: `cloudflare-production/test/v23-build.test.mjs`
- Modify: `cloudflare-production/README.md` if present, otherwise create `cloudflare-production/VERSIONS.md`

**Interfaces:**
- Documents: v22.5 rollback baseline and v23 direct-source build model.

- [ ] **Step 1: Add regression assertions**

Assert `RELEASE_SOURCE_URL` is not fetched by active `build()`, `src/v23/index.html` is the production source, and the legacy injectors are not invoked by the v23 build path.

- [ ] **Step 2: Document rollback**

Record `a521bc803ad8ddeb72b1ec39ad2fba784fce1799` as the pre-v23 pipeline baseline and identify the previous stable Cloudflare v22.5 line as rollback-only.

- [ ] **Step 3: Run complete verification**

Run `npm test` and `npm run build`; inspect `dist/index.html`, `dist/releases/v23.html`, and `dist/release-revision.txt`; confirm identical SHA-256 for source and `dist/index.html`.

---

### Task 6: Review, merge, and release v23.0

**Files:**
- No additional product files unless review finds a defect.

- [ ] **Step 1: Review PR diff**

Confirm no temporary capture workflow remains, no Supabase router changes are included, and legacy v22.5 files are not deleted.

- [ ] **Step 2: Confirm PR CI**

Tests/build must be green and `Synchronize Telegram release` must be skipped on PR.

- [ ] **Step 3: Merge one squash commit to `main`**

Use title `release: ship Ciao Web v23 native source`.

- [ ] **Step 4: Verify post-merge production pipeline**

Confirm tests/build pass on `main`, Cloudflare serves the exact new v23 hash, Telegram release synchronization succeeds, and the final Telegram entry returns the same v23 hash.

- [ ] **Step 5: User visual verification**

Open Mini App from a fresh Telegram menu button and verify Home ordering, Calcio Today, nearest-match crest/navigation, lock-free disabled stages and Mine-card copy.