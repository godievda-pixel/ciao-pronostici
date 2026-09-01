# Ciao, Web! GitHub → Cloudflare TEST design

Дата: 2026-09-01

## Цель

Убрать PowerShell, локальные ZIP и ручные `wrangler deploy` из обычной разработки Ciao, Web!. Все изменения тестовой версии должны идти через GitHub и автоматически публиковаться Cloudflare Workers Builds.

## Архитектура

- `main` остаётся production-веткой репозитория и пока не подключается к автоматическому production deploy.
- `develop` — единственная рабочая TEST-ветка.
- новый Worker `ciao-web-app-test` подключается к `godievda-pixel/ciao-pronostici`, root directory `cloudflare-test`, production branch для этого Worker — `develop`.
- каждый push в `develop` выполняет `npm test`, затем `npm run build`, затем `npm run deploy`.
- `ciao-web-app-test` проксирует `/api/*` через Service Binding `CIAO_WEB_API` в существующий `ciao-web-api` и раздаёт Static Assets для frontend.
- Telegram TEST-кнопка после первого успешного deploy один раз переводится на `https://ciao-web-app-test.ciao-web.workers.dev/` и после этого больше не меняется между версиями.
- основная Telegram-кнопка и `ciao-web-app` production не меняются в рамках этой миграции.

## Переходный bootstrap v23.1

Полный standalone-исходник текущей v23.1 ещё не хранится в GitHub. Поэтому TEST build временно получает проверенную базу `https://ciao-web-app.ciao-web.workers.dev/releases/v23.1/` только на build-time, проверяет marker `ciao-web-v23-1-cloudflare-test-20260901`, внедряет GitHub-managed CSS/JS patch и сохраняет полностью собранный `dist/index.html`.

Это не runtime-зависимость: браузер получает уже готовый HTML с `ciao-web-app-test`. После стабилизации CI/CD отдельной задачей нужно vendor-нуть standalone v23.1 в GitHub и убрать build-time bootstrap.

## UI patch первой итерации

- `Сегодня в мире кальчо` → `Кальчо сегодня`.
- `Сделать прогноз` / `Мои прогнозы` становятся аккуратным двухколоночным segmented control с gap.
- фильтры `Все` / `Серия А` получают единые высоты, отступы и скругления.
- бизнес-логика, API, scoring и навигация не меняются.

## Безопасность

- TEST Worker не меняет `ciao-web-app` production.
- Service Binding используется только для `/api/*`.
- `/healthz` TEST Worker возвращает собственный build marker.
- build останавливается, если marker базовой v23.1 не совпадает.
- никакие секреты не коммитятся в GitHub.
