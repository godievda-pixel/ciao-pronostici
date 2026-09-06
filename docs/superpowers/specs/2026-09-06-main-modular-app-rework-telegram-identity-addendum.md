# Ciao, Web! — Telegram Identity Sync Addendum

## Status

Approved mandatory addendum to `docs/superpowers/specs/2026-09-06-main-modular-app-rework-design.md`.

This requirement is part of the same production rework and must be complete before production-readiness approval.

## Incident

A returning user changed their Telegram name and then could no longer open Ciao, Web!. The visible boot error is:

`display_name is not defined`

The current production baseline already renders a user-facing `display_name` from application state, so mutable Telegram profile fields must never become an authentication or account-identity key.

The implementation must first trace the exact free-variable source that produces the `ReferenceError`; the error must not be patched by hiding the boot failure or by creating a second user record.

## Identity invariant

The canonical user identity is the verified Telegram numeric user ID from Telegram `initData`.

Mutable Telegram profile fields are attributes only:
- `first_name`;
- `last_name`;
- `username`;
- derived/display `display_name`.

Changing any of these fields must not:
- create a new Ciao, Web! user;
- lose or duplicate predictions;
- change ranking ownership;
- lose favorite-club settings;
- lose history or other user-owned data;
- block application boot.

## Display-name resolution

At application boot, resolve the current display label in this order:

1. current Telegram `first_name + last_name` when either is present;
2. current Telegram `username` when name fields are empty;
3. the last valid server-side stored display name for the same Telegram user ID;
4. safe generic fallback `Игрок Ciao, Web!`.

No renderer may depend on an undeclared/free `display_name` variable. Renderers receive the resolved profile/display value explicitly through state or a helper return value.

## Profile synchronization

After Telegram `initData` is verified and the existing user is resolved by Telegram user ID:

- compare current Telegram profile fields with stored profile fields;
- update changed mutable fields using the existing API/account record;
- keep the same user identity and data ownership;
- make the current Telegram name visible in the same session;
- do not require logout/re-registration.

Profile synchronization is non-blocking for entry. If the profile update request temporarily fails, the application must still open using current Telegram data in memory or the last valid stored profile.

Authentication verification itself remains mandatory; only profile-field synchronization is allowed to fail softly.

## Error handling

- An absent `first_name`, `last_name`, `username`, or stored `display_name` must not throw.
- A malformed/stale profile response must fall back to current verified Telegram profile values.
- A failed profile-sync mutation must not blank the app or replace the user session.
- No client-side fallback may invent a different Telegram user ID.
- Do not overwrite non-profile user-owned state when updating name fields.

## Tests

Add focused regression coverage for:

1. same Telegram ID, stored old name, Telegram provides new name -> existing account opens and new name is displayed;
2. same Telegram ID and changed username -> same account remains selected;
3. user without `last_name` -> boot succeeds;
4. user without `username` -> boot succeeds;
5. user with only one usable Telegram name field -> boot succeeds;
6. all optional Telegram name fields missing but stored display name exists -> stored display name is used;
7. profile-sync API fails -> app still boots and no user data is replaced;
8. undeclared `display_name` regression -> boot path and render helpers never reference a free `display_name` identifier;
9. existing predictions/ranking/favorite-club data remain tied to the same Telegram user ID after the name change.

## Acceptance criteria

This addendum is complete when:

- Telegram user ID is the only account identity key for this flow;
- changing Telegram name or username never prevents application entry;
- the current Telegram name is automatically reflected in Ciao, Web! without creating a new account;
- `display_name is not defined` is no longer reproducible;
- profile-sync failure is non-blocking;
- existing user-owned data survives the profile change unchanged;
- all identity/profile regression tests are green;
- production is still not deployed without explicit approval.