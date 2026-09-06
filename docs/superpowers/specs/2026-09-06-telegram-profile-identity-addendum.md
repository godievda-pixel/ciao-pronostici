# Ciao, Web! — Telegram Profile Identity Addendum

## Status

Approved addendum to `docs/superpowers/specs/2026-09-06-main-modular-app-rework-design.md`.

This requirement is mandatory for the modular production rework and must be verified before production publication.

## Problem

A user who changed their Telegram display name is currently unable to enter the application. The visible boot error is:

`ReferenceError: display_name is not defined`

Changing Telegram profile fields must never invalidate application access.

## Identity rule

The stable application identity is the Telegram numeric user id from validated Telegram `initData`.

Mutable Telegram profile fields are presentation/profile metadata only:
- `first_name`
- `last_name`
- `username`
- derived `display_name`

Predictions, ranking history, favorite club and any other persisted user-owned data must continue to resolve by the same Telegram user id after those fields change.

## Display-name resolution

At application boot, derive the current presentation name from fresh Telegram WebApp user data.

Canonical precedence:

1. non-empty `first_name + last_name`;
2. non-empty `first_name`;
3. non-empty `last_name`;
4. `@username` when username exists;
5. existing server-side display name when available;
6. safe fallback `Пользователь`.

No direct reference to an undeclared `display_name` variable is allowed. Profile rendering must receive a defined value from a resolver function.

## Synchronization behavior

On each authenticated application start:

1. validate Telegram `initData` as today;
2. resolve stable Telegram user id;
3. read current Telegram profile fields;
4. render the app immediately using the locally resolved safe display name;
5. asynchronously reconcile mutable profile fields with the existing server profile record for that Telegram user id when the current API supports such an update.

A failure to synchronize mutable profile metadata must be non-blocking. It may be retried later, but must not prevent boot or hide existing user data.

No new identity record may be created solely because the user's Telegram name or username changed.

## Compatibility

The change must not alter:
- Telegram authentication/signature validation;
- prediction ownership;
- prediction scoring;
- ranking ownership;
- favorite-club ownership;
- existing persistent identifiers.

If the current backend stores mutable display fields as part of a profile row, the implementation must update those fields in place under the same Telegram user id.

## Error handling

Missing or malformed optional Telegram profile fields must never throw during boot.

If the server profile is unavailable, the app still opens using the Telegram-derived name.

If Telegram provides no usable display fields but authentication is valid, the app opens with `Пользователь`.

## Required tests

The following are acceptance tests:

1. Same Telegram id, old server name, new Telegram name -> app boots and renders the new Telegram name.
2. Same Telegram id, changed username -> existing predictions/ranking/favorite club remain attached to the user.
3. User without `last_name` -> boot succeeds.
4. User without `username` -> boot succeeds.
5. User with only one usable name field -> boot succeeds.
6. Profile-sync API failure -> boot succeeds and existing app data remains available.
7. No runtime path can throw `ReferenceError: display_name is not defined`.
8. Server reconciliation never changes the stable Telegram user id.

## Production acceptance

This addendum is complete only when a regression test covers the reported name-change scenario and the production candidate can boot with changed Telegram profile metadata without losing user-owned data.
