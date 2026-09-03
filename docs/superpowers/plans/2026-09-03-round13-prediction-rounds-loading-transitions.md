# Round 13 Prediction Rounds, Loading and Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the five mobile regressions from the latest TEST screenshots: Serie A round navigation, duplicate UEFA locks, fake ranking participant during loading, one-frame Matches transition artifact, and cropped tournament tabs in Tables.

**Implemented architecture:** Keep the existing v23.3 prediction backend authoritative. Do not change scoring, save, deadline, reconciliation, or existing UEFA server gates. A small Round 13 browser compatibility layer reads the already-available full Serie A calendar from `/api/v23.2/matches?competition=serie_a` only to render current/future round navigation; actual prediction cards and writes continue to come from the existing v23.3 prediction service. The same layer suppresses the duplicate CSS lock glyph, provides a neutral Ranking loading shell, synchronously hides stale Matches/Match Center overlays on bottom-nav pointerdown, and compacts only the Tables tournament labels.

**Tech Stack:** JavaScript ES modules, Node test runner, Cloudflare Worker static assets, existing v23.2/v23.3 runtimes.

## Constraints

- TEST/develop only; `main` and Production untouched.
- Preserve existing UEFA sequential round lock backend enforcement.
- Preserve Serie A canonical match IDs, crest enrichment, scoring and save path.
- Preserve bottom navigation and TEST reset guards.
- TDD: RED regressions first, then GREEN implementation.

## Implemented tasks

- [x] Add `round13-mobile-regressions.mjs` and load it from the unified v23.3 entry point.
- [x] Build Serie A round navigation from the full v23.2 calendar with current round active and future rounds disabled/locked.
- [x] Reserve Serie A round-nav geometry while calendar data arrives to avoid layout shift.
- [x] Remove the CSS-generated second lock icon; keep one inline accessible `🔒` only.
- [x] Add a neutral Ranking loading overlay containing skeleton geometry only — no fake participant, place or points.
- [x] Hide stale Matches and Match Center overlays synchronously on bottom-nav pointerdown to prevent one-frame transition flashes.
- [x] Keep Matches overlay background explicitly opaque during the legacy deferred controller transition.
- [x] Shorten Tables selector labels to `Серия А`, `ЛЧ`, `ЛЕ`, `ЛК` while leaving full tournament titles in content/header views.
- [x] Remove unnecessary Serie A round `scrollIntoView` so the new round strip cannot create an iPhone micro-jump.
- [x] Add `v23-3-user-feedback-round13.test.mjs` covering the new compatibility layer.

## Verification gate

Before merging to `develop`:

- [x] Full `npm test` on the exact implementation head.
- [x] `npm run build`.
- [x] `npx wrangler deploy --dry-run`.
- [x] API / prediction / reset / BSD contract checks.
- [ ] Cloudflare Git Integration deployment for the final documentation-adjusted head.
- [ ] Final TEST-only diff review.
- [ ] Merge only to `develop`.
- [ ] Post-merge push CI and deployed TEST probe.
