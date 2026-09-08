# Telegram Release Revision Automation — Design

## Goal

Eliminate the recurring state where a new Cloudflare production build is live but Telegram keeps reopening an older Mini App WebView because the bot's Web App URL has not changed.

The release pipeline must update Telegram only after the exact newly built HTML is confirmed live on the production Cloudflare Worker.

## Current verified state

- Telegram's real menu button opens the Supabase launcher `ciao-web-app`, not GitHub Pages directly.
- `ciao-web-app` redirects to `https://ciao-web-app.ciao-web.workers.dev/` with a cache-busting `v=<timestamp>` query parameter.
- Fresh HTTP requests through the real Telegram chain already return the current production HTML.
- Telegram can nevertheless reuse a WebView when the initial Web App URL itself is unchanged.
- Changing the Telegram menu URL from the stable launcher URL to the same launcher plus `?tg_rev=<revision>` caused Telegram to propagate the new URL and forced a fresh entry path.
- Telegram menu propagation is asynchronous; an observed update took about 50 seconds.

## Chosen approach

Use a content-derived release revision.

Each production build computes a SHA-256 hash from the final `dist/index.html` bytes. The release revision is the first 12 lowercase hexadecimal characters of that SHA-256.

Example:

```text
sha256: e833e3ab9551a3ce80b35085ca16be10c95a4fd92f1d176cc1710119a872b8ae
revision: e833e3ab9551
Telegram URL: https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=e833e3ab9551
```

The revision represents actual delivered HTML, not a timestamp, commit message, or manually edited version number.

## Release data flow

```text
push/merge to main
  -> production tests
  -> production build
  -> compute expected SHA-256 revision from dist/index.html
  -> Cloudflare Git build/deploy runs
  -> GitHub workflow polls production Worker
  -> fetch Worker root without compression and compute SHA-256
  -> wait until live revision == expected revision
  -> call narrow Telegram release-sync endpoint
  -> release-sync independently re-fetches Worker HTML and recomputes revision
  -> only if revision matches the requested revision: update Telegram menu button
  -> poll Telegram getChatMenuButton until the new URL is visible
  -> fetch revised Telegram launcher URL and follow redirect to Worker
  -> verify known production markers in final HTML
```

## Why the pipeline waits for the Worker

GitHub Actions and Cloudflare's Git integration can start independently after the same push. The GitHub workflow must never assume Cloudflare has already deployed the commit.

The workflow therefore polls the production Worker for a bounded period. It does not update Telegram until the live Worker HTML hash equals the locally built HTML hash.

If Cloudflare fails to deploy or deploys different bytes, the workflow fails and Telegram remains on the previous known-good revision.

## Build revision generation

`cloudflare-production/scripts/build.mjs` will gain a small deterministic helper that computes the SHA-256 of the final root HTML bytes after all existing production transformations have completed.

The build will write:

```text
dist/release-revision.txt
```

with exactly:

```text
<12 lowercase hex characters>\n
```

The build result printed to stdout will also include the revision for diagnostics.

No runtime UI behavior changes are part of this work.

## Telegram release-sync endpoint

The existing `ciao-pronostici-router` Edge Function already owns the Telegram bot token and is therefore the correct component to perform `setChatMenuButton`.

A new narrow GET endpoint will be added:

```text
/functions/v1/ciao-pronostici-router/release-sync?revision=<12hex>
```

It will NOT accept an arbitrary Web App URL.

Behavior:

1. Validate `revision` against `^[0-9a-f]{12}$`.
2. Fetch the fixed production Worker URL `https://ciao-web-app.ciao-web.workers.dev/` with cache-bypass semantics and no caller-controlled destination.
3. Compute SHA-256 over the fetched HTML bytes and derive the first 12 hex characters.
4. If the live revision differs from the requested revision, return HTTP 409 and do not call Telegram.
5. If it matches, call `setChatMenuButton` using exactly:
   `https://dkefzepiiudehhzbbrjn.supabase.co/functions/v1/ciao-web-app?tg_rev=<revision>`.
6. Return JSON containing the requested revision, verified live revision, and Telegram API success state.

This endpoint is intentionally narrow enough to be called by GitHub Actions without exposing the Telegram token or allowing callers to redirect the bot to arbitrary domains.

## Inline `/start` buttons

The router also sends inline Web App buttons from `/start`. Future `/start` responses must use the current live content-derived revision as well, otherwise the menu button and inline button can diverge.

The router will resolve the current Worker revision through the same fixed Worker hashing helper, cache it briefly in memory, and construct inline buttons as:

```text
ciao-web-app?tg_rev=<current-live-revision>
```

The cache is only a performance optimization. The release-sync endpoint always performs a fresh verification before changing the menu.

## GitHub production workflow

`.github/workflows/ciao-production-check.yml` remains the source-controlled production verifier. It will keep the existing install/test/build sequence and add a release gate after build on pushes to `main` only.

The release gate will:

1. Read `cloudflare-production/dist/release-revision.txt`.
2. Poll the Worker root and compute its revision.
3. Stop successfully only when the Worker revision equals the expected build revision.
4. Fail after a bounded timeout if the new Worker never becomes live.
5. Call the narrow `release-sync` endpoint with the expected revision.
6. Poll the existing Telegram entry probe until `getChatMenuButton` reports the expected `tg_rev` URL.
7. Follow the expected Telegram launcher URL to production and verify the final HTML has the current production markers.

Pull-request runs continue to test and build but MUST NOT synchronize Telegram.

## Timeout and propagation policy

Cloudflare deployment polling:

- interval: 10 seconds
- maximum wait: 5 minutes

Telegram menu propagation polling:

- interval: 5 seconds
- maximum wait: 2 minutes

These are condition-based waits. No fixed sleep is treated as proof of deployment.

## Failure behavior

### Build/test failure

Stop immediately. Cloudflare may independently fail or succeed, but the GitHub release gate never updates Telegram.

### Worker revision mismatch

Do not update Telegram. Continue polling until timeout, then fail the workflow.

### release-sync live hash mismatch

Return 409. Do not update Telegram. Workflow fails.

### Telegram API failure

Do not claim release completion. Return failure from release-sync and fail workflow.

### Telegram propagation delay

Poll until `getChatMenuButton` returns the exact expected URL. A successful `setChatMenuButton` response alone is not sufficient evidence.

### End-to-end content mismatch

Fail the workflow even if Telegram reports the new menu URL.

## Security constraints

- GitHub does not receive or store `TELEGRAM_BOT_TOKEN`.
- No GitHub secret is required for the Telegram Bot API.
- The public release-sync endpoint cannot accept an arbitrary destination URL.
- A caller can request only a 12-hex revision, and the router updates Telegram only when that revision equals the hash of the fixed live production Worker HTML.
- The production Worker URL and Telegram launcher base URL are constants in the router.
- Existing bot webhook authentication remains unchanged.

## Source control

The Telegram router code used by production must be checked into this repository before the automation is considered complete. The source-controlled copy becomes the canonical implementation for future changes instead of relying on an Edge Function that exists only in the Supabase dashboard.

Proposed path:

```text
supabase/functions/ciao-pronostici-router/index.ts
```

The checked-in version must first reproduce the currently deployed router behavior, then add the release revision logic.

## Tests

### Build unit tests

Add tests that prove:

- the revision is deterministic for identical bytes;
- changing one byte changes the revision;
- revision format is exactly 12 lowercase hex characters;
- `build()` writes `dist/release-revision.txt` containing the revision of `dist/index.html`.

### Router unit tests

Extract pure helpers where practical and test:

- revision validation;
- construction of the Telegram Web App URL;
- live-hash mismatch prevents synchronization;
- a matching live hash produces the expected Telegram URL;
- arbitrary external URLs cannot be supplied through the release-sync interface.

### Workflow regression checks

The source-controlled workflow must make the following ordering explicit:

```text
build -> wait for matching live Worker revision -> release-sync -> Telegram propagation -> end-to-end HTML verification
```

### Production verification

Before declaring the change complete, capture fresh evidence that:

- the feature-branch tests pass;
- the build emits a revision;
- after merge/deploy, the live Worker has that same revision;
- Telegram menu reports that exact revision URL;
- the revised Telegram URL redirects to the production Worker;
- the final HTML contains the expected current production markers.

## Rollback

The existing production build remains untouched while this work is implemented on `feat/telegram-release-revision`.

If a later production release must be rolled back, Cloudflare can deploy the prior stable source tree. The same pipeline computes the prior HTML's content revision and synchronizes Telegram back to the matching URL automatically.

The content hash therefore works in both forward releases and rollbacks without special version-number handling.

## Non-goals

- No redesign of the Mini App UI.
- No changes to prediction logic, matches, ratings, or club navigation.
- No replacement of the existing Cloudflare Git deployment mechanism.
- No runtime injection patches.
- No arbitrary remote-control endpoint for Telegram configuration.
