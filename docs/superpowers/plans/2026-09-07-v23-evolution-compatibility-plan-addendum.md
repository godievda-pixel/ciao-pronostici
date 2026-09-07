# v23 Evolution — compatibility plan addendum

**Prerequisite:** foundation plan Task 1 baseline source is frozen.

## Task A: Route stable v22.5 through one TEST API

- [ ] Add RED tests for legacy slug recognition and fail-closed behavior.
- [ ] Add RED tests for TEST HTML endpoint rewriting to `ciao-v23-api/<legacy-slug>`.
- [ ] Port the shared v23 backend/domain layer into `v23-evolution-test` without standalone frontend files.
- [ ] Add `compat-v22-5.mjs` as a response-adapter/router only; it must call shared services/repositories.
- [ ] Route old core aliases (`ciao-core-api-fast`, `-v4`, `-v5`, `-v6`) to one compatibility core handler.
- [ ] Route specialized stable v22.5 slugs (live, schedule, match center, club profile, club calendar, insights) to compatibility adapters.
- [ ] Support emoji asset GET without production proxy.
- [ ] Unknown slugs/actions return a deterministic 404/400; never fall back to production.
- [ ] Build TEST HTML from frozen `v22-5-evolution.html`, rewriting function URLs only.
- [ ] Assert built TEST HTML contains no production Edge Function URLs.
- [ ] Run full CI and deploy only `ciao-web-v23-test` + TEST `ciao-v23-api`.
- [ ] Telegram smoke v22.5 1:1 before adding any new UI feature.

## Task B: Preserve one identity and one prediction database

- [ ] Validate Telegram `initData` server-side once in `ciao-v23-api`.
- [ ] Resolve/sync user only by `telegram_id`.
- [ ] Regression test same Telegram ID with changed name/username.
- [ ] Compatibility `state` and ranking read from `cp_users` / `cp_predictions`.
- [ ] Compatibility save writes only `cp_predictions`.
- [ ] No runtime read/write to `cp_competition_predictions` after unified migration is complete.

## Stop condition

Do not start UI evolution tasks until stable v22.5 can be opened through `🧪 Ciao v23 TEST` with its key screens functioning through the single TEST API.
