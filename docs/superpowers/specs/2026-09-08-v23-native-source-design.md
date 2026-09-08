# Ciao, Web! v23 Native Source Design

## Goal

Freeze the current v22.5 production release as the rollback baseline and ship the next application release as v23.0 from a repository-tracked source file instead of rebuilding v22.5 through a chain of runtime/build-time `inject...Patch` transforms.

## Approved release model

- v22.5 remains untouched and available for rollback.
- v23.0 is a new application version, not another patch layer on top of v22.5.
- Cloudflare continues to deploy only from `main` using the existing `npm run build` -> `npm run deploy` Git integration.
- The content-derived Telegram revision pipeline remains unchanged: build hash -> wait for exact Worker bytes -> update Telegram `tg_rev` -> end-to-end verification.
- Production is not switched to v23.0 until v23.0 passes tests and build on its feature branch.

## v23.0 source strategy

The first v23.0 source snapshot is the exact current production Worker HTML, captured once into the repository as `cloudflare-production/src/v23/index.html`. After capture, the build no longer fetches the Supabase v22.5 migration file and no longer executes the legacy injection chain for v23.0.

The captured snapshot preserves all functionality currently present in the Worker, but future v23 changes are made directly in the tracked source. Legacy patch scripts remain in the repository only as rollback/history artifacts and are not part of the v23 build path.

## Required product changes in v23.0

### Home

- User profile card (`Daniil`, username, rank) appears first.
- Favorite-club card appears below the user profile card.
- `Профиль клуба` receives a more premium visual treatment.
- Favorite-club nearest match searches all supported competitions, not only Serie A.
- Nearest-match card displays opponent crest and is clickable to Match Center.
- Rename `Сегодня в Серии А` to `Кальчо сегодня`.
- `Кальчо сегодня` includes today's matches involving Italian clubs from Serie A, Coppa Italia and UEFA competitions, including upcoming, live and finished matches.
- Today's matches render as premium internal match cards and open Match Center.

### Predictions

- Future stage/round buttons show no lock glyph or lock pseudo-icon.
- Future stages remain actually disabled and cannot be opened.
- `Мои прогнозы` empty state displays `ВАШ ПРОГНОЗ`, `— : —`, and `Прогноз не сделан` without clipping/overlap.

## Build architecture

`cloudflare-production/scripts/build.mjs` gains an explicit v23 path:

1. Read `cloudflare-production/src/v23/index.html` from disk.
2. Validate required v23 source markers and browser-script syntax.
3. Write the source directly to `dist/index.html` and `dist/releases/v23.html`.
4. Compute `dist/release-revision.txt` from the final `dist/index.html` bytes.

The v23 path must not import or call the legacy UI injection functions.

## Safety and rollback

- Keep the existing v22.5 source URL and legacy build helpers available but inactive for the v23 production path.
- Keep the current stable git history and existing backup branches untouched.
- A rollback is performed by reverting `main` to the previous production commit; the content-hash Telegram pipeline then points Telegram back to the reverted Worker bytes automatically.
- No Supabase release-state mutation is required for ordinary v23 deployments.

## Verification

Before merge to `main`:

- Tests prove v23 build does not call the legacy injection chain.
- Final v23 inline browser scripts compile.
- Tests assert Home ordering, `Кальчо сегодня`, nearest-match navigation/crest contract, and disabled lock-free stages.
- `npm test` passes.
- `npm run build` passes.
- PR production-check leaves Telegram synchronization skipped.

After merge:

- Cloudflare creates a new Worker Version from `main`.
- GitHub release gate observes exact v23 hash on Worker.
- Telegram menu receives the new hash-derived `tg_rev`.
- End-to-end gate verifies Telegram launcher returns the exact same v23 HTML.