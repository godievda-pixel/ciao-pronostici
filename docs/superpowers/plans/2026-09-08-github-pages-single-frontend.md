# GitHub Pages Single Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GitHub Pages the only production frontend for Ciao, Web!, while keeping Supabase for backend/data and Cloudflare only for API/Worker duties that are still needed.

**Architecture:** BotFather continues to open `https://godievda-pixel.github.io/ciao-pronostici/`. The repository root `index.html` becomes byte-identical to `cloudflare-production/src/v23/index.html`, so there is no frontend launcher, no Supabase release manifest, and no Cloudflare frontend routing. GitHub Actions may validate the v23 source but must not synchronize a separate Telegram/frontend release target.

**Tech Stack:** GitHub Pages, static HTML/JavaScript, Node.js tests, Supabase backend APIs, optional Cloudflare Workers for backend-only endpoints.

**Spec:** User-approved architecture in chat on 2026-09-08: GitHub Pages = frontend production; Supabase = backend/data; Cloudflare = API/Workers only.

## Global Constraints

- Work directly on `main` as explicitly approved by the user.
- Preserve rollback via `backup-pre-github-pages-direct-20260908` and existing stable v22.5 backup.
- Do not delete Supabase backend functions or data tables as part of this change.
- Do not depend on Cloudflare for serving the Mini App frontend.
- BotFather Main App URL remains `https://godievda-pixel.github.io/ciao-pronostici/`.

---

### Task 1: Make GitHub Pages serve v23 directly

**Files:**
- Modify: `index.html`
- Create: `cloudflare-production/test/github-pages-entry.test.mjs`

**Interfaces:**
- Consumes: `cloudflare-production/src/v23/index.html` as the canonical v23 frontend source.
- Produces: root `index.html` with identical bytes, directly served by GitHub Pages.

- [ ] **Step 1: Write the failing contract test**

Create a Node test that reads root `index.html` and `src/v23/index.html`, asserts exact equality, and asserts the root no longer contains `ciao-release-manifest-v1` or `ciao-web-entry-dynamic`.

- [ ] **Step 2: Verify the contract fails against the current launcher**

Run `node --test cloudflare-production/test/github-pages-entry.test.mjs` from the repository root. Expected: FAIL because root `index.html` is currently a Supabase manifest launcher.

- [ ] **Step 3: Replace root `index.html` with the existing v23 blob**

Reuse the exact Git blob of `cloudflare-production/src/v23/index.html` for root `index.html`; do not reserialize or patch the 800 KB HTML.

- [ ] **Step 4: Verify root and canonical source are identical**

Compare the two Git blob SHAs. Expected: both paths resolve to the same blob SHA.

### Task 2: Stop frontend release synchronization outside GitHub Pages

**Files:**
- Modify: `.github/workflows/ciao-production-check.yml`

**Interfaces:**
- Consumes: v23 source and tests under `cloudflare-production`.
- Produces: validation-only workflow; no `release-gate.mjs` call and no separate Telegram/frontend release synchronization.

- [ ] **Step 1: Remove the `Synchronize Telegram release` step**

Keep checkout, Node setup, install, test/build validation. Rename the workflow to make it clear that it validates the frontend rather than deploying it.

- [ ] **Step 2: Keep Cloudflare deployment manual/backend-only**

Do not invoke `npm run deploy` from this workflow. Existing Cloudflare resources remain available for backend/API use but are outside the frontend publication path.

### Task 3: Verify the new production path

**Files:**
- Verify: `index.html`
- Verify: `.github/workflows/ciao-production-check.yml`

**Interfaces:**
- Produces: one deterministic frontend path: BotFather → GitHub Pages → v23 HTML.

- [ ] **Step 1: Fetch `main/index.html` and confirm the v23 native markers are present**

Required markers: `ciao-v23-native-home-20260908` and `ciao-v23-native-predictions-20260908`.

- [ ] **Step 2: Confirm the launcher markers are absent**

The root must not contain `ciao-release-manifest-v1`, `ciao:production-url`, or `ciao-web-entry-dynamic`.

- [ ] **Step 3: Confirm rollback references still exist**

Verify branch `backup-pre-github-pages-direct-20260908` and the existing stable v22.5 backup remain available.
