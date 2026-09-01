# GitHub → Cloudflare TEST Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать постоянный GitHub-managed TEST-контур Ciao, Web! без PowerShell и локальных deploy.

**Architecture:** `develop` собирает тестовый frontend в `cloudflare-test/dist`, Worker `ciao-web-app-test` раздаёт assets и проксирует `/api/*` через Service Binding в `ciao-web-api`. Текущая v23.1 используется только как build-time bootstrap до отдельной миграции полного standalone-исходника в GitHub.

**Tech Stack:** GitHub, Cloudflare Workers Builds, Wrangler 4.127.1, Node.js test runner, Cloudflare Static Assets + Service Binding.

**Spec:** `docs/superpowers/specs/2026-09-01-github-cloudflare-test-design.md`

## Global Constraints

- `ciao-web-app` production не изменять.
- основную Telegram-кнопку не изменять.
- тестовый frontend всегда публиковать в `ciao-web-app-test`.
- API использовать через `ciao-web-api`; не добавлять прямые browser runtime-запросы к Supabase.
- build должен падать при несовпадении marker базовой v23.1.

---

### Task 1: Test project and regression tests

**Files:**
- Create: `cloudflare-test/package.json`
- Create: `cloudflare-test/test/build.test.mjs`

- [x] Добавить test-first проверки idempotent patch и отказа от неверного base marker.
- [x] Запустить `node --test test/*.test.mjs` и получить PASS после реализации build helper.

### Task 2: v23.1 GitHub UI patch

**Files:**
- Create: `cloudflare-test/src/ui-v23.1.css`
- Create: `cloudflare-test/src/ui-v23.1.js`
- Create: `cloudflare-test/scripts/build.mjs`

- [x] Добавить segmented control для прогнозов и компактные Today filters.
- [x] Переименовать Today header в `Кальчо сегодня` через isolated DOM patch.
- [x] Инжектировать CSS/JS в standalone HTML только один раз.
- [x] Проверять `ciao-web-v23-1-cloudflare-test-20260901` перед сборкой.

### Task 3: Cloudflare TEST Worker

**Files:**
- Create: `cloudflare-test/src/worker.js`
- Create: `cloudflare-test/wrangler.jsonc`

- [x] `/healthz` возвращает TEST build marker.
- [x] `/api/*` проксируется через `CIAO_WEB_API` service binding.
- [x] остальные пути обслуживаются через Static Assets.

### Task 4: One-time Cloudflare Git integration

- [ ] Создать/подключить Worker `ciao-web-app-test` к GitHub repo `godievda-pixel/ciao-pronostici`.
- [ ] Root directory: `cloudflare-test`.
- [ ] Production branch данного TEST Worker: `develop`.
- [ ] Build command: `npm test && npm run build`.
- [ ] Deploy command: `npm run deploy`.
- [ ] Проверить `https://ciao-web-app-test.ciao-web.workers.dev/healthz` и root Mini App.
- [ ] После acceptance один раз перевести Telegram TEST-кнопку на `https://ciao-web-app-test.ciao-web.workers.dev/`.

### Task 5: Remove bootstrap dependency

- [ ] После стабилизации TEST pipeline сохранить полный standalone v23.1 source в GitHub.
- [ ] Заменить build-time fetch текущей release на локальный versioned source.
- [ ] Сохранить те же tests и TEST URL.
