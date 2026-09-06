# Telegram Identity Sync Addendum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure a returning user who changes Telegram name/username keeps the same Ciao, Web! account, can always boot the app, and automatically sees the current Telegram display identity without losing predictions, ranking, favorite club, or history.

**Architecture:** Keep Telegram `initData` verification and the current API/account record. Treat verified Telegram numeric user ID as the sole account identity key; resolve mutable display fields through one profile helper and synchronize changed Telegram profile fields non-blockingly after the account is resolved. Fix the exact `display_name is not defined` root cause rather than masking the error.

**Tech Stack:** Current v22.5 production baseline, modular production layer, Telegram WebApp init data, current Ciao API, browser ES modules, Node 22 `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-06-main-modular-app-rework-telegram-identity-addendum.md`

## Global Constraints

- This is a mandatory addendum to `docs/superpowers/plans/2026-09-06-main-modular-app-rework.md` and must be complete before its production-readiness task.
- Work in the same dedicated implementation branch; do not modify `main` directly.
- Do not deploy production without explicit user approval.
- Do not change prediction scoring, deadlines, ranking ownership, favorite-club ownership, or any other user-owned domain state.
- Telegram numeric user ID is the canonical identity key.
- `first_name`, `last_name`, `username`, and `display_name` are mutable profile attributes only.
- A failed profile synchronization request must not block application boot.
- Authentication verification must not be weakened.
- Follow RED → GREEN → full regression → commit.

---

## Task A1: Reproduce and trace the `display_name` boot failure to its exact source

**Files:**
- Create: `cloudflare-production/test/telegram-profile-regression.test.mjs`
- Create: `cloudflare-production/scripts/inspect-telegram-profile-flow.mjs`
- Modify only after evidence: the exact production integration file/source anchor identified by the inspection.

**Purpose:** Establish the root cause before writing the fix. The screenshot proves a `ReferenceError` for a free identifier; do not assume which layer creates it.

**Interfaces:**

```js
export function findUnsafeDisplayNameReferences(source) -> Array<{ index, excerpt }>
export function inspectTelegramProfileFlow(source) -> {
  unsafeDisplayNameReferences,
  stateDisplayNameReferences,
  telegramIdentityAnchors
}
```

- [ ] **Step 1: Write the failing static regression test**

Use a representative broken sample and prove the inspector detects a free identifier while allowing property access:

```js
const broken = `function boot(){ return display_name || user.display_name; }`;
const result = inspectTelegramProfileFlow(broken);
assert.equal(result.unsafeDisplayNameReferences.length, 1);
```

Also assert these are safe and are not reported as free identifiers:

```js
user.display_name
user?.display_name
row.display_name
```

- [ ] **Step 2: Verify RED**

```bash
cd cloudflare-production
npm test -- --test-name-pattern="Telegram profile regression"
```

Expected: FAIL because the inspector does not exist.

- [ ] **Step 3: Implement the read-only inspector**

The script must inspect the built/current production source only. It must not mutate profile data or call any write endpoint.

- [ ] **Step 4: Run the inspector on the actual production baseline**

```bash
npm run build
node scripts/inspect-telegram-profile-flow.mjs
```

Record the exact file/source anchor and call path that produces the free `display_name`. If the free identifier originates server-side rather than in the built HTML, capture the request/action and response boundary that exposes it and move the failing test to that boundary.

- [ ] **Step 5: Verify the focused test is GREEN**

```bash
npm test -- --test-name-pattern="Telegram profile regression"
```

- [ ] **Step 6: Commit the evidence-only test/inspector**

```bash
git add cloudflare-production/test/telegram-profile-regression.test.mjs cloudflare-production/scripts/inspect-telegram-profile-flow.mjs
git commit -m "test: reproduce Telegram display name boot failure"
```

---

## Task A2: Add one canonical Telegram profile resolver keyed by Telegram user ID

**Files:**
- Create: `cloudflare-production/src/modular/identity/telegram-profile.mjs`
- Extend: `cloudflare-production/test/telegram-profile-regression.test.mjs`

**Interfaces:**

```js
export function telegramUserId(user) -> string
export function resolveTelegramDisplayName({ telegramUser, storedUser }) -> string
export function profilePatchFromTelegram({ telegramUser, storedUser }) -> {
  telegramUserId: string,
  patch: { first_name?, last_name?, username?, display_name? },
  changed: boolean
}
```

**Display-name precedence:**

```text
current Telegram first_name + last_name
→ current Telegram username
→ stored display_name
→ "Игрок Ciao, Web!"
```

- [ ] **Step 1: Write RED resolver tests**

Cover:
- same `id`, old stored name, new Telegram name;
- missing `last_name`;
- missing `username`;
- only `username` present;
- all optional Telegram name fields empty with stored name present;
- all name sources empty -> `Игрок Ciao, Web!`.

Example:

```js
assert.equal(
  resolveTelegramDisplayName({
    telegramUser: { id: 777, first_name: 'Новый', last_name: 'Игрок' },
    storedUser: { telegram_user_id: '777', display_name: 'Старое имя' },
  }),
  'Новый Игрок',
);
```

- [ ] **Step 2: Write RED identity tests**

```js
assert.equal(telegramUserId({ id: 777, username: 'new_name' }), '777');
assert.equal(telegramUserId({ id: 777, username: 'old_name' }), '777');
```

Changing mutable fields must never change the resolved identity.

- [ ] **Step 3: Verify RED**

```bash
npm test -- --test-name-pattern="Telegram profile resolver|Telegram identity"
```

- [ ] **Step 4: Implement the minimal pure resolver**

No DOM, network, storage, or side effects in this file.

- [ ] **Step 5: Verify GREEN and full regression**

```bash
npm test -- --test-name-pattern="Telegram profile resolver|Telegram identity"
npm test
```

- [ ] **Step 6: Commit**

```bash
git add cloudflare-production/src/modular/identity/telegram-profile.mjs cloudflare-production/test/telegram-profile-regression.test.mjs
git commit -m "feat: add Telegram profile identity resolver"
```

---

## Task A3: Fix the root boot path and make name synchronization non-blocking

**Files:**
- Modify: exact root-cause file/source anchor established in Task A1.
- Modify: `cloudflare-production/src/modular/data/api-client.mjs` if the modular client already exists at execution time; otherwise add the synchronization hook to the existing production API bridge and move it into the modular client when Task 4 of the parent plan lands.
- Create: `cloudflare-production/src/modular/identity/profile-sync.mjs`
- Extend: `cloudflare-production/test/telegram-profile-regression.test.mjs`

**Interfaces:**

```js
export async function synchronizeTelegramProfile({
  telegramUser,
  storedUser,
  updateProfile,
  onLocalProfile,
}) -> {
  userId: string,
  displayName: string,
  synchronized: boolean,
  syncError: Error | null
}
```

**Required flow:**

```text
verify Telegram initData
→ resolve existing account by Telegram numeric ID
→ resolve current display name locally
→ allow application render/boot
→ if mutable fields changed, attempt profile update
→ merge successful profile response into the same account
→ if update fails, retain current local display name and continue
```

- [ ] **Step 1: Write RED boot regression test**

Simulate:
- Telegram ID `777`;
- stored user `777` with `display_name: 'Старое имя'`;
- Telegram now reports `first_name: 'Новое', last_name: 'Имя'`.

Assert:
- boot/render callback executes;
- resolved account ID remains `777`;
- display name is `Новое Имя`;
- no second-account creation path is invoked.

- [ ] **Step 2: Write RED sync-failure test**

Make `updateProfile()` reject and assert:

```js
assert.equal(result.userId, '777');
assert.equal(result.displayName, 'Новое Имя');
assert.equal(result.synchronized, false);
assert.ok(result.syncError);
assert.equal(renderWasAllowed, true);
```

- [ ] **Step 3: Write RED data-retention test**

Use a stored user object containing representative user-owned state:

```js
{
  telegram_user_id: '777',
  predictions_count: 42,
  ranking_points: 118,
  favorite_team_id: 109,
}
```

After profile synchronization, assert these fields remain unchanged unless the existing API itself returns authoritative equivalents.

- [ ] **Step 4: Verify RED**

```bash
npm test -- --test-name-pattern="Telegram profile boot|profile sync failure|profile data retention"
```

- [ ] **Step 5: Replace the exact unsafe `display_name` reference at the root cause**

Use the explicit resolved profile value returned by `resolveTelegramDisplayName()`/`synchronizeTelegramProfile()`. Do not introduce a global `display_name` variable as a workaround.

- [ ] **Step 6: Implement non-blocking synchronization**

The render/boot path must not await a profile-only write before making the app usable. Authentication/account lookup remains blocking; mutable profile update does not.

- [ ] **Step 7: Verify GREEN and full regression**

```bash
npm test -- --test-name-pattern="Telegram profile"
npm test
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add cloudflare-production/src/modular/identity cloudflare-production/test/telegram-profile-regression.test.mjs <root-cause-file>
git commit -m "fix: keep Telegram profile changes from blocking app boot"
```

---

## Task A4: Add Telegram-name-change scenarios to production readiness

**Files:**
- Modify: `cloudflare-production/test/production-regression.test.mjs`
- Modify: `cloudflare-production/scripts/probe-production-build.mjs`
- Modify: parent-plan production-readiness checklist during execution notes/checkpoint record.

**Acceptance matrix:**

- same Telegram ID + changed first/last name -> app opens, new name displayed;
- same Telegram ID + changed username -> app opens, same account;
- no last name -> app opens;
- no username -> app opens;
- profile sync endpoint unavailable -> app opens;
- old predictions remain accessible;
- ranking ownership remains unchanged;
- favorite club remains unchanged;
- built production source contains no unsafe free `display_name` reference in the identified boot path.

- [ ] **Step 1: Add regression assertions for the full matrix**.
- [ ] **Step 2: Add the safe static boot-source check to `probe-production-build.mjs`**.
- [ ] **Step 3: Run complete production verification**

```bash
cd cloudflare-production
npm test
npm run build
npm run probe:api
npm run probe:build
npx wrangler deploy --dry-run
```

- [ ] **Step 4: Verify no real production deployment occurred**.
- [ ] **Step 5: Commit readiness coverage**.

---

## Integration point with the parent plan

Execute this addendum after the production API/profile contract is observed and before final production readiness. If the parent plan Tasks 1–5 are already implemented, place A1–A3 immediately after them. If implementation has not started yet, run A1 early enough to protect current boot behavior and complete A2–A4 before parent Task 13.

The parent plan is not production-ready until both its own Definition of Done and this addendum's acceptance matrix are green.