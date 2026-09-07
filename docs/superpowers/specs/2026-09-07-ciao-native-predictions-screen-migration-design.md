# Ciao, Web! — native Predictions screen migration design

Date: 2026-09-07

## Goal

Replace the current prediction UI patch stack with one maintainable, module-owned `PredictionsScreen` while keeping the existing bottom navigation unchanged.

The user-visible navigation remains:

`Главная | Прогнозы | Рейтинг | Матчи | Таблицы | Профиль`

The second bottom-nav button keeps its current icon, label, order and click target. Only the implementation of the screen opened by that button changes.

## Why this migration is required

The current production build applies multiple sequential prediction-specific HTML/runtime patches (`multitournament-predictions-runtime`, `multitournament-predictions-theme`, `prediction-stage-lock-ui`, `prediction-live-scroll-polish`, `prediction-mine-stage-polish`, etc.). Later layers override functions and CSS created by earlier layers. Presence of a marker in the generated HTML therefore does not prove that the intended UI wins at runtime.

This migration ends that pattern for the Predictions screen.

## Non-goals

- Do not move or rename the bottom-nav `Прогнозы` button.
- Do not redesign Главная, Рейтинг, Матчи, Таблицы or Профиль.
- Do not change the already deployed external-predictions backend contract except where a screen bug proves a backend contract defect.
- Do not move `stable` until visual acceptance.
- Do not reintroduce x2.

## Architecture

### 1. Tracked production shell

Production must stop depending on a remote resolved HTML file plus prediction-specific regex/IIFE injection layers.

A behavior-preserving copy of the current accepted v22.5 production shell will be tracked in the repository under `cloudflare-production/src/` and used as the production build input. The first migration step is intentionally behavior-neutral: copied shell, same nav, same existing screens, same backend URLs.

The tracked shell contains explicit static module/style entries. It is not modified at runtime by prediction patch functions.

`stable` remains the rollback reference for the pre-migration production baseline.

### 2. One Predictions module

Add a dedicated module boundary, for example:

- `cloudflare-production/src/predictions/predictions-screen.mjs`
- `cloudflare-production/src/predictions/predictions-screen.css`
- focused helper modules for state/data only when needed

The screen module owns:

- tournament hub;
- selected tournament;
- `Прогнозы | Мои прогнозы` mode;
- selected round/stage;
- local unsaved draft scores;
- loading/error/saving state;
- match-card rendering;
- 15-second visible-screen refresh;
- viewport/scroll preservation.

There must be one render path and one style source for the Predictions screen.

### 3. Explicit navigation integration

The legacy bottom navigation remains visible and authoritative.

When `button[data-tab="mine"]` (the current second `Прогнозы` tab) becomes active, the shell calls `PredictionsScreen.open()`.

When another bottom-nav tab becomes active, it calls `PredictionsScreen.close()`.

No prediction module may redefine the global legacy `predict()`, `mine()`, `render()`, `bind()` or `saveAll()` functions.

No prediction module may install a MutationObserver to repeatedly rewrite the screen.

### 4. Rendering model

Using the DOM as the browser rendering target is normal; what is prohibited is patching already-rendered legacy markup or stacking runtime overrides.

`PredictionsScreen` renders only inside its own dedicated mount element and owns all descendants of that mount.

It must not:

- query legacy cards and mutate their internals;
- clone legacy prediction HTML;
- inject CSS with `document.createElement('style')` on each runtime patch;
- replace legacy function definitions;
- rely on build markers to decide which UI version is active.

The CSS file is loaded once as a static asset.

## Data flow

### Serie A

Preserve current Serie A prediction persistence and scoring semantics.

The new screen may use an adapter around the existing Serie A state/save API so that the UI shares one card model with external tournaments. Existing historical predictions remain untouched.

### Coppa Italia / UEFA competitions

Use the existing `ciao-external-predictions` backend and canonical external match IDs.

Competitions:

- `coppa_italia`
- `champions_league`
- `europa_league`
- `conference_league`

The Competition Model / Tournament Engine conventions already present in the v23.2 modular work should be reused for competition metadata, chronological grouping and stage labels rather than recreated in screen-specific patches.

## Required UX behavior

### Hub

Opening the bottom-nav `Прогнозы` tab shows the tournament hub only.

Cards:

- Серия А
- Кубок Италии
- Лига Чемпионов
- Лига Европы
- Лига Конференций

Tournament themes remain consistent with the accepted Matches tab.

### Tournament screen

Inside a selected tournament:

1. back button + tournament title;
2. `Прогнозы | Мои прогнозы` segmented control;
3. round/stage chips;
4. stage heading/status;
5. prediction cards;
6. save bar only when the selected stage is editable.

Switching `Прогнозы ↔ Мои прогнозы` preserves tournament and selected stage.

### UEFA round gating

For Champions League, Europa League and Conference League:

- only the first unfinished league round is editable;
- round N+1 opens only after every match of round N is finished;
- future rounds remain visible but disabled;
- disabled chips do not display lock emoji or lock drawings;
- they are simply visually muted and non-interactive;
- the explanatory copy is derived from the selected round itself.

Examples:

- 2nd round → `Прогнозы на этот тур откроются после завершения 1-го тура`;
- 3rd round → `...после завершения 2-го тура`;
- 4th round → `...после завершения 3-го тура`.

The same previous-round label is used in per-card deadline copy. There is one helper for this calculation.

### My Predictions cards

Cards use a symmetric three-column layout:

`home team | prediction | away team`

For no saved prediction, the center shows `— : —` and a small secondary line `Прогноз не сделан`; the long phrase must never be the primary score-sized text.

After match start/finish, the result strip shows real score and awarded points separately.

Long team names must truncate or wrap without colliding with the prediction column.

### Match statuses

Status rendering is centralized in one helper.

Required states include:

- `МАТЧ НЕ НАЧАЛСЯ`
- `LIVE · N′`
- `ПЕРЕРЫВ`
- `ДОП. ВРЕМЯ`
- `ПЕНАЛЬТИ`
- `МАТЧ ЗАВЕРШЁН`
- `МАТЧ ПЕРЕНЕСЁН`
- `МАТЧ ОТМЕНЁН`

Only the actual LIVE pill is red (`#E7072E`) with white text. Other statuses use their tournament-neutral status style.

## Refresh behavior

The application-level cadence remains 15 seconds.

For Predictions:

- refresh only while the screen is visible;
- at most one request in flight per screen controller;
- pause while the document is hidden;
- refresh immediately on return to foreground;
- preserve selected competition/mode/stage;
- preserve unsaved draft scores;
- preserve viewport position without full-page visual jumping.

The screen should update its own state/model and render from that state. It must not rely on re-running legacy global `render()`.

## Migration/removal

After the native screen passes tests and visual acceptance, remove prediction-specific injection layers from the production build:

- `multitournament-predictions-runtime.mjs`
- `multitournament-predictions-theme.mjs`
- `prediction-stage-lock-ui.mjs`
- `prediction-live-scroll-polish.mjs`
- `prediction-mine-stage-polish.mjs`
- prediction behavior contained in `home-predictions-nav-fix.mjs`

Do not remove unrelated Matches patches during this screen migration.

The build must contain a test that fails if a removed prediction injector is imported or invoked again.

## Delivery/cache

Keep the corrected launch path:

`Telegram → ciao-web-app launcher → cache-busted Cloudflare URL → Worker-first HTML`

HTML remains `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`.

This is independent of the Predictions rendering architecture and must not be rolled back.

## Testing

### Unit tests

- previous-round copy: 2→1, 3→2, 4→3, 8→7;
- UEFA editable-stage selection;
- postponed/non-finished matches keep the current round closed;
- prediction card view-model for saved/unsaved predictions;
- status rendering including red-live state classification;
- draft preservation through refresh;
- mode switch preserves competition/stage.

### Component/controller tests

- opening the existing `mine` nav button mounts one Predictions screen;
- switching away unmounts/hides it without modifying the other tabs;
- no MutationObserver is created by Predictions;
- no legacy prediction globals are overwritten;
- future stage buttons are disabled and contain no lock glyphs/pseudo-lock class;
- `Мои прогнозы` card geometry uses the compact missing-prediction state.

### Production build tests

- tracked shell is the build input;
- no remote resolved HTML fetch is required for Predictions rendering;
- removed prediction injectors are absent from `build.mjs`;
- native module and CSS are copied to `dist`;
- HTML no-store Worker behavior remains intact.

## Rollout

1. Create tracked production shell with no user-visible behavior change.
2. Add Predictions module/CSS and tests while old Predictions screen remains available behind an internal switch.
3. Switch only the existing second bottom-nav button to native PredictionsScreen.
4. Verify all five tournaments, modes, gating, LIVE statuses, drafts and 15-second refresh in production.
5. Remove old prediction injection layers.
6. Run full production test/build gate again.
7. Ask for visual acceptance.
8. Move `stable` only after explicit user approval.

## Success criteria

The migration is complete when:

- the second bottom-nav button remains exactly where it is;
- all Predictions behavior is owned by one native module boundary;
- no prediction-specific build/runtime injection stack remains;
- 4th UEFA round correctly refers to completion of the 3rd round;
- no lock glyphs are rendered on future rounds;
- `Мои прогнозы` cards stay aligned on mobile;
- LIVE pill is visibly red;
- 15-second updates do not make the page jump;
- production delivery always opens the current build;
- existing non-Predictions tabs remain unchanged.
