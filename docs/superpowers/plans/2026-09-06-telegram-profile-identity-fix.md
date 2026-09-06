# Telegram Profile Identity Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Telegram profile-name changes non-breaking by keeping user ownership tied to Telegram numeric user id, resolving display names safely from fresh Telegram data, and preventing profile metadata synchronization from blocking application boot.

**Architecture:** Add one focused profile-identity module to the new modular production layer. Authentication and persisted ownership continue to use validated Telegram `initData` and stable Telegram user id; mutable name/username fields are resolved separately for presentation and reconciled with the existing API only through an already-supported profile update path. Boot rendering never depends on a mutable profile sync succeeding.

**Tech Stack:** Telegram WebApp init data, browser ES modules, current production API/provider, Node 22 `node:test`, current v22.5 production baseline plus the approved modular production layer.

**Spec:** `docs/superpowers/specs/2026-09-06-telegram-profile-identity-addendum.md`

## Global Constraints

- Work in the dedicated implementation branch created from `main`; do not commit feature code directly to `main`.
- Do not deploy `ciao-web-app` until the user explicitly approves production publication.
- Stable user identity is the validated Telegram numeric user id, never `display_name`, `first_name`, `last_name`, or `username`.
- Keep the current API/provider and Telegram authentication model.
- A failure to refresh mutable Telegram profile metadata must never block application boot.
- Do not create a second user record because a name or username changed.
- Do not invent a new profile-write API if the current API does not already expose one; first observe the current contract.
- Preserve existing prediction, ranking and favorite-club ownership.
- Each implementation task follows RED → GREEN → full regression → commit.

---

### Task 1: Trace the reported `display_name` boot failure to its exact production source

**Files:**
- Create: `cloudflare-production/test/telegram-profile-identity-contract.test.mjs`
- Modify: `cloudflare-production/scripts/probe-current-api.mjs` if it already exists from the main modular plan; otherwise add the identity checks when that file is created by the main plan.
- Inspect only: current fetched v22.5 baseline source built by `cloudflare-production/scripts/build.mjs`

**Interfaces:**
- Consumes: the built production HTML and fresh Telegram WebApp user shape.
- Produces: an evidence-backed list of the exact boot/profile code path that references `display_name`, plus the observed server profile read/update contract.

- [ ] **Step 1: Add a failing regression fixture for the reported scenario**

Create a test fixture representing the same stable user id with changed mutable Telegram fields:

```js
const oldServerProfile = {
  user_id: 'telegram:123456789',
  display_name: 'Старое Имя',
  username: 'old_name',
};

const telegramUserAfterRename = {
  id: 123456789,
  first_name: 'Новое',
  last_name: 'Имя',
  username: 'new_name',
};
```

The initial test must assert that the future identity resolver is required and that stable identity remains `telegram:123456789`.

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
cd cloudflare-production
npm test -- --test-name-pattern="Telegram profile identity"
```

Expected: FAIL because no safe identity resolver exists yet.

- [ ] **Step 3: Build the exact production baseline and inspect the failing symbol**

```bash
npm run build
rg -n "display_name|first_name|last_name|username|initDataUnsafe" dist/index.html
```

Record the exact function/scope where `display_name` is referenced and determine whether it is an undeclared identifier, a missing destructured field, or an unsafe server-response assumption. Do not edit code in this step.

- [ ] **Step 4: Observe the current server profile contract without mutation**

Use the existing read-only probe path to establish:
- how the current user record is keyed;
- whether the response exposes `user_id`, `display_name`, `username`;
- whether an existing profile-update action is visible in the current source/API contract.

The probe must never submit a profile change during this task.

- [ ] **Step 5: Add evidence assertions to the contract test**

The test must lock these invariants:

```js
assert.equal(stableTelegramIdentity({ id:123456789 }), 'telegram:123456789');
assert.notEqual(oldServerProfile.display_name, 'Новое Имя');
```

The test description should state that mutable fields must not participate in identity matching.

- [ ] **Step 6: Commit the diagnostic contract**

```bash
git add cloudflare-production/test/telegram-profile-identity-contract.test.mjs cloudflare-production/scripts/probe-current-api.mjs
git commit -m "test: lock Telegram profile identity contract"
```

---

### Task 2: Add a safe Telegram profile identity resolver and non-blocking metadata reconciliation

**Files:**
- Create: `cloudflare-production/src/modular/profile/profile-identity.mjs`
- Create: `cloudflare-production/test/profile-identity.test.mjs`
- Modify: `cloudflare-production/src/modular/data/api-client.mjs`
- Modify: `cloudflare-production/src/modular/app.mjs`

**Interfaces:**
- Consumes: `Telegram.WebApp.initDataUnsafe.user`, validated auth context, optional existing server profile.
- Produces:

```js
stableTelegramIdentity(user) -> string
resolveTelegramDisplayName(user, serverProfile?) -> string
createProfileSnapshot(user, serverProfile?) -> {
  userId,
  displayName,
  firstName,
  lastName,
  username
}
reconcileProfileMetadata(snapshot, apiClient) -> Promise<{ ok:boolean, skipped?:boolean }>
```

- [ ] **Step 1: Write RED unit tests for name resolution**

Required expectations:

```js
assert.equal(
  resolveTelegramDisplayName({ first_name:'Новое', last_name:'Имя', username:'new_name' }),
  'Новое Имя',
);
assert.equal(resolveTelegramDisplayName({ first_name:'Новое' }), 'Новое');
assert.equal(resolveTelegramDisplayName({ last_name:'Имя' }), 'Имя');
assert.equal(resolveTelegramDisplayName({ username:'new_name' }), '@new_name');
assert.equal(resolveTelegramDisplayName({}, { display_name:'Серверное Имя' }), 'Серверное Имя');
assert.equal(resolveTelegramDisplayName({}), 'Пользователь');
```

- [ ] **Step 2: Write RED identity-stability tests**

```js
const before = { id:123456789, first_name:'Старое', username:'old_name' };
const after = { id:123456789, first_name:'Новое', username:'new_name' };
assert.equal(stableTelegramIdentity(before), stableTelegramIdentity(after));
assert.equal(stableTelegramIdentity(after), 'telegram:123456789');
```

Reject missing/invalid numeric ids with an explicit controlled error; do not derive identity from a name.

- [ ] **Step 3: Write RED boot-safety test**

Simulate a metadata reconciliation rejection:

```js
const apiClient = {
  updateProfileMetadata: async () => { throw new Error('network_down'); },
};
```

Assert that the resolved profile snapshot is returned for immediate rendering before the reconciliation promise settles, and that a rejected reconciliation is caught and reported as `{ ok:false }` rather than rethrown into boot.

- [ ] **Step 4: Run focused tests and confirm RED**

```bash
npm test -- --test-name-pattern="profile identity|display name|metadata reconciliation"
```

- [ ] **Step 5: Implement `profile-identity.mjs`**

Use only local, defined variables. `resolveTelegramDisplayName` must trim optional fields and apply exactly this precedence:

```text
first_name + last_name
first_name
last_name
@username
server display_name
Пользователь
```

No code path may reference a free/undeclared `display_name` identifier.

- [ ] **Step 6: Wire existing profile update capability only if Task 1 observed one**

If the current API already exposes a profile metadata update action, add one `apiClient.updateProfileMetadata(snapshot)` method using the same authenticated API client and stable user identity.

If no such existing capability is observed, implement `updateProfileMetadata` as an intentional no-op returning `{ skipped:true }`; the app still renders the fresh Telegram-derived name locally. Do not add a new backend vendor or persistence system.

- [ ] **Step 7: Make reconciliation non-blocking in app boot**

Boot order:

```js
const telegramUser = globalThis.Telegram?.WebApp?.initDataUnsafe?.user || {};
const profile = createProfileSnapshot(telegramUser, serverProfile);
renderApp({ profile });
void reconcileProfileMetadata(profile, apiClient);
```

The rendering call must not await reconciliation.

- [ ] **Step 8: Verify GREEN and full regression**

```bash
npm test -- --test-name-pattern="profile identity|display name|metadata reconciliation"
npm test
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add cloudflare-production/src/modular/profile/profile-identity.mjs cloudflare-production/src/modular/data/api-client.mjs cloudflare-production/src/modular/app.mjs cloudflare-production/test/profile-identity.test.mjs
git commit -m "fix: make Telegram profile names non-blocking"
```

---

### Task 3: Protect user-owned data across Telegram name changes and add end-to-end boot regression

**Files:**
- Create: `cloudflare-production/test/telegram-name-change-regression.test.mjs`
- Modify: `cloudflare-production/src/modular/data/data-service.mjs`
- Modify: `cloudflare-production/src/modular/app.mjs`

**Interfaces:**
- Consumes: stable Telegram user id from `stableTelegramIdentity(user)`.
- Produces: all current-user data loaders keyed by the existing authenticated user identity rather than mutable display metadata.

- [ ] **Step 1: Write a RED regression test for same-id rename**

Use two boot snapshots with identical Telegram id and different mutable fields. Mock existing user-owned data:

```js
const stored = {
  favoriteClub:'juventus',
  predictions:[{ matchId:'SA-1', home:2, away:1 }],
  rankingPoints:42,
};
```

Assert after rename:
- resolved display name is `Новое Имя`;
- favorite club is still `juventus`;
- prediction remains present;
- ranking points remain `42`;
- no new user key is generated.

- [ ] **Step 2: Write RED optional-field regression tests**

Cover users with:
- no `last_name`;
- no `username`;
- only `last_name`;
- empty strings for optional fields.

Every case with a valid Telegram id must reach a rendered application state.

- [ ] **Step 3: Write RED error regression for the reported symbol**

Inspect the built modular assets and assert there is no unsafe free-variable pattern equivalent to:

```js
display_name
```

outside object property access/destructuring/string literals. Also exercise the boot function under changed-name input and assert it does not throw `ReferenceError`.

- [ ] **Step 4: Run focused regression and confirm RED**

```bash
npm test -- --test-name-pattern="Telegram name change regression"
```

- [ ] **Step 5: Route user-owned reads through authenticated identity only**

Where the modular Data Service requests current-user data, do not pass display name or username as ownership selectors. Reuse the validated Telegram auth context/current-user endpoints already observed in Task 1.

- [ ] **Step 6: Verify focused GREEN, full suite and production build**

```bash
npm test -- --test-name-pattern="Telegram name change regression"
npm test
npm run build
```

Expected: zero failures and the same production baseline remains buildable.

- [ ] **Step 7: Commit**

```bash
git add cloudflare-production/test/telegram-name-change-regression.test.mjs cloudflare-production/src/modular/data/data-service.mjs cloudflare-production/src/modular/app.mjs
git commit -m "test: protect users across Telegram name changes"
```

---

## Integration into the main modular production plan

Execute this fix after the main plan has established the inert modular shell and observed the production API contract, and before migrating Predictions/Ranking/Favorite Club UI. This ordering ensures every later current-user screen is built on stable Telegram identity rather than mutable presentation metadata.

Production review is blocked until all three tasks in this plan are GREEN.
