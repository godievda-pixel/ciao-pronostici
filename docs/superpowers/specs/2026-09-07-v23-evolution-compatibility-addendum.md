# v23 Evolution — v22.5 compatibility addendum

Дата: 2026-09-07
Статус: утверждено пользователем
Ветка: `v23-evolution-test`

## Решение

Stable v22.5 остаётся единственным frontend runtime и сохраняет внешний вид 1:1 на первом этапе. Старые backend Edge Functions не копируются в TEST и не используются как отдельные runtime-контуры.

Все запросы v22.5 в TEST направляются в один Edge Function:

`v22.5 UI -> ciao-v23-api/<legacy-slug> -> shared services/provider -> TEST Supabase`

Path suffix нужен, чтобы сохранить различие старых контрактов без query-string конфликтов с asset URLs. Например:

- `.../ciao-core-api-fast-v4` -> `.../ciao-v23-api/ciao-core-api-fast-v4`
- `.../ciao-match-center-fast-v3` -> `.../ciao-v23-api/ciao-match-center-fast-v3`
- `.../ciao-schedule-fast-v1` -> `.../ciao-v23-api/ciao-schedule-fast-v1`

## Жёсткие правила

1. Compatibility layer не проксирует запросы в production Supabase или production Edge Functions.
2. Compatibility layer не создаёт отдельный BSD client на каждый legacy slug. Все match/provider операции идут через один shared BSD provider/data layer.
3. `cp_users` остаётся единственной таблицей пользователей, identity key — validated Telegram ID.
4. `cp_predictions` является единственной финальной таблицей прогнозов.
5. Старые response-shapes v22.5 формируются adapters/serializers поверх общих domain/services, а не отдельной бизнес-логикой.
6. Неизвестный legacy slug или action fail-closed и не вызывает production fallback.
7. TEST build переписывает только function endpoints; frozen source HTML остаётся неизменяемым baseline artifact.
8. Static/public assets могут оставаться внешними read-only URL, если они не дают записи в production; пользовательские/матчевые данные в TEST идут только через TEST backend.
9. Production не изменяется.

## Compatibility scope для checkpoint 22.5 1:1

Поддерживаются вызовы, реально присутствующие в stable v22.5:

- core state/save/settings/favorite/ranking actions;
- fast live updates;
- Match Center;
- match summary;
- club profile;
- schedule;
- club calendar;
- live snapshot;
- prediction insights;
- diagnostic/health request;
- emoji asset route.

После Telegram smoke старые compatibility response-shapes можно постепенно упрощать только вместе с прямой эволюцией соответствующего UI v22.5.
