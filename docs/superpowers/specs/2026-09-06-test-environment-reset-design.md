# Ciao, Web! TEST Environment Reset — Design

## Goal

Discard the current TEST architecture completely and rebuild a clean TEST environment from the current production implementation, while leaving production behavior and `main` untouched during the reset work.

## Safety boundary

- Production application and production Worker stay unchanged.
- `main` is the source of truth for the production baseline and is not rewritten as part of the reset.
- Destructive TEST cleanup is limited to TEST-only repository assets, TEST-only branches/PRs, TEST-only CI/deployment wiring, and the TEST Worker/environment.
- No production deployment or production cutover is part of this reset.

## What will be removed

Repository-side TEST assets:
- `cloudflare-test/` in full, including its current source, scripts, tests, README, build/deploy markers, package metadata and Wrangler configuration.
- `.github/workflows/ciao-test-check.yml` and any TEST-only workflow wiring tied to the discarded architecture.
- Obsolete TEST branches and open PRs created for Round51 / Match Center experiments, after preserving any information that is still needed in git history.
- Any TEST-only link/button configuration that points users at the old TEST environment.

Cloudflare-side TEST assets:
- The current TEST Worker `ciao-web-app-test` and its existing TEST deployment state are treated as disposable.
- The new TEST environment will be created as a clean Worker/configuration rather than inheriting runtime state from the discarded TEST Worker.

## Clean rebuild baseline

The new TEST starts from the current production implementation under `cloudflare-production/` on `main`.

The first clean TEST version must be functionally identical to production except for environment identity and safety settings:
- separate Worker/service name;
- separate TEST URL;
- no production route ownership;
- no production release switching;
- no TEST-only feature code initially.

This baseline is verified before any new architecture work begins.

## New TEST architecture principles

1. One clean baseline copied from production.
2. TEST deltas must be small, explicit, and isolated from production code.
3. No historical RoundXX runtime stack is carried into the new TEST unless deliberately reintroduced later.
4. Every new subsystem added to TEST must have its own focused tests and clear ownership.
5. Production promotion happens only by explicit later approval after TEST verification.

## Rebuild sequence

1. Snapshot current production baseline and record its commit SHA.
2. Remove old TEST repository files/workflows/obsolete TEST branches and close obsolete TEST PRs.
3. Remove the current TEST Worker/environment.
4. Create a new TEST branch from the production baseline.
5. Recreate `cloudflare-test/` by copying the current production implementation, changing only TEST identity/configuration.
6. Create minimal TEST CI: install, test, build, dry-run validation, and deployed TEST smoke check.
7. Deploy the clean TEST Worker.
8. Verify that the TEST button/URL opens a version visually and functionally matching production.
9. Only after the clean baseline passes, begin rebuilding the new architecture from zero.

## Acceptance criteria

The reset is complete when:
- old TEST files and old TEST runtime layers are gone;
- obsolete Round51 TEST branches/PRs are no longer active;
- the old TEST Worker is removed/replaced;
- a new TEST environment is deployed from the production baseline;
- the TEST button opens the new clean TEST build;
- production remains unchanged;
- there are no Round51/51.2 Match Center runtime markers in the clean TEST baseline unless they are also part of the production baseline copied from `main`.

## Rollback

Repository deletion remains recoverable from git history. If the new clean TEST fails, the production system remains unaffected and the previous TEST state can still be inspected from historical commits without being reactivated.
