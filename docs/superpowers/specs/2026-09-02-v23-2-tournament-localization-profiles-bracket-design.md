# Ciao Web v23.2 Tournament Localization, Profiles and Coppa Bracket Design

## Goal

Extend the working BSD-backed v23.2 tournament layer so that it behaves like the existing Serie A experience: correct local time for every user, Russian tournament/team names, tournament matches visible in club profiles, clean Coppa Italia data without duplicates, and a dedicated Coppa Italia playoff bracket.

## Scope

This change covers only the TEST v23.2 tournament layer and its integration points into the existing TEST build. Production `ciao-web-app` remains untouched until TEST is verified.

Supported competitions remain:

- Serie A
- Кубок Италии
- Лига Чемпионов
- Лига Европы
- Лига Конференций

## Data model and identity

BSD remains the external provider for Coppa Italia, Champions League, Europa League and Conference League. Serie A keeps the existing verified `ciao-web-api` schedule path.

The canonical match model keeps provider event IDs, kickoff ISO timestamps, stage/round information, scores, status and both teams. A separate team registry provides:

- canonical Russian display name;
- BSD team ID;
- normalized name aliases used for matching BSD names to the legacy club-profile identity;
- optional legacy club ID/name aliases where available.

All display surfaces consume the canonical Russian display name from this registry. Unknown teams fall back to the BSD name, and CI reports unknown names so the registry can be completed instead of silently inventing translations.

## Coppa Italia duplicate handling

The tournament feed is deduplicated before rendering and before profile integration.

Primary identity is BSD event ID. A secondary fingerprint prevents duplicate provider rows with different IDs from appearing twice. The fingerprint is:

`competition + stage + kickoffAt + homeTeamId/name + awayTeamId/name`

The fingerprint intentionally keeps stage and kickoff time so legitimate later meetings between the same clubs are not collapsed.

A TEST probe will inspect the current Coppa Italia season and fail if the same fingerprint is emitted more than once. The reported Fiorentina duplication is treated as the regression case.

## User-local match time

BSD kickoff timestamps remain canonical ISO timestamps with UTC offset. The browser formats them without a forced `timeZone` option so `Intl.DateTimeFormat` uses the user's device/browser time zone, matching the behavior expected from the existing Serie A UI.

The visual format remains Russian locale and compact date/time. No Europe/Rome hard-code is allowed in v23.2 match rendering.

Tests cover at least two explicit time zones by temporarily setting the formatter environment and checking that the same kickoff renders at different local clock times.

## Russian competition names

The public v23.2 labels become:

- `coppa_italia` → `Кубок Италии`
- `ucl` → `Лига Чемпионов`
- `uel` → `Лига Европы`
- `uecl` → `Лига Конференций`

Serie A remains `Serie A`.

These names are used both on the tournament hub cards and inside tournament screens.

## Russian team names

A dedicated `team-registry.mjs` owns display-name localization and identity matching. The BSD adapter continues to carry provider IDs and raw names; display-name localization is applied in a focused enrichment step so raw provider data stays inspectable.

The registry initially covers every club returned by the current 2026/27 supported tournament feeds. CI contains a live/reporting probe that lists unknown names without exposing secrets. Unknown clubs still render using the BSD name rather than disappearing.

## Club profile integration

Existing club profiles currently rely on the legacy club calendar/profile flow. v23.2 adds a tournament-match enrichment layer without replacing that flow.

When a club profile is opened, TEST will:

1. keep the existing Serie A/profile data;
2. obtain or reuse cached v23.2 competition data for Coppa Italia/UCL/UEL/UECL;
3. match the opened club against the team registry using BSD ID when known and normalized aliases otherwise;
4. merge all matching tournament matches with the existing club calendar;
5. deduplicate by canonical match identity;
6. sort chronologically;
7. render competition labels alongside the extra matches so users can tell Serie A, Coppa and UEFA fixtures apart.

The integration is implemented as a TEST build source patch around the existing club-profile/calendar renderer rather than changing `ciao-web-api` or the stable production build.

## Coppa Italia tabs

Inside `Кубок Италии`, add two internal tabs:

- `Матчи`
- `Сетка Плей-офф`

`Матчи` keeps the current chronological stage-grouped list.

`Сетка Плей-офф` renders the knockout path from the same canonical Coppa Italia match dataset so there is one source of truth.

## Coppa Italia bracket model

The bracket model normalizes stage names into ordered knockout rounds. It uses real BSD matches for resolved pairings and future fixtures.

For a downstream slot where the next participant is not yet resolved, the UI shows:

`Победитель пары <Команда A> — <Команда B>`

When BSD later returns the actual participant/fixture, the placeholder is automatically replaced by the club name.

The bracket must never invent a pairing that cannot be derived from the tournament data. If BSD lacks enough information to connect a source tie to a future slot, the slot is shown as `Соперник определяется` rather than guessing.

Resolved matches show score/status and team names; upcoming matches show local user time.

## UI behavior

Tournament screens keep the current v23.2 visual themes and mobile-safe overlay behavior. New internal Coppa tabs use the same control language as the rest of Ciao Web: rounded segmented controls, active accent derived from the Coppa theme, no horizontal page overflow.

The bracket is horizontally scrollable only inside its own bracket viewport when necessary; the full page must not gain horizontal scroll.

## Error handling

- BSD failures keep the existing metadata-only diagnostics (`stage/status/code`) and never expose the API token.
- Unknown team translation: render raw BSD name and report it in CI.
- Bracket linkage unavailable: render `Соперник определяется`, never fabricate a path.
- Profile enrichment failure: keep the existing club profile/calendar usable and omit only the extra v23.2 tournament matches.

## Testing and verification

TDD is required for each behavior.

Required automated coverage:

1. Coppa deduplication, including duplicate Fiorentina-style rows.
2. Local-time rendering without `Europe/Rome`.
3. Russian tournament titles.
4. Team-name registry lookup and raw-name fallback.
5. Club-profile match merge and deduplication.
6. Coppa bracket stage ordering.
7. `Победитель пары …` placeholder replacement when a future participant becomes known.
8. Mobile bracket container does not force document-level horizontal overflow.
9. Existing v23.2 navigation and BSD live UCL probe remain GREEN.

Required live TEST probes after merge:

- Coppa Italia returns no duplicate fingerprints;
- UCL/UEL/UECL/Coppa endpoints return 200;
- at least one Italian club profile contains a non-Serie-A tournament match;
- public TEST continues reporting `matchesProvider: bsd-v2` and `bsdConfigured: true`.

## Release boundary

All work lands in `develop`, passes CI, then merges to `main` only for the Git-connected `ciao-web-app-test` deployment. Production `ciao-web-app` is not changed during this package.
