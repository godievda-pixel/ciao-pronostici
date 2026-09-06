# Ciao, Web! — единый canonical Match Center

Дата: 2026-09-06  
Статус: design approved in chat; письменный spec ожидает финального подтверждения перед implementation plan  
Рабочая ветка: `design/round51-canonical-match-center-cutover`  
База: `test/round51-2-match-center-fixes` @ `b2aee439c70a870e88c1e4fa5ea25a73d14bdff4`

## 1. Цель

Заменить текущую многослойную реализацию Match Center в TEST на один canonical Match Center, визуально и поведенчески повторяющий Match Center основной v23.1-базы, и использовать его для Serie A, Coppa Italia, Champions League, Europa League и Conference League.

Различия между турнирами должны находиться только в:

1. теме оформления;
2. источнике/адаптере данных;
3. турнирных метаданных, если они действительно нужны содержимому экрана.

Сам UI, навигация, lifecycle, tabs, структура блоков и поведение Match Center остаются общими.

## 2. Что существует сейчас

TEST собирается поверх v23.1-базы (`DEFAULT_BASE_URL` в `cloudflare-test/scripts/build.mjs` указывает на `/releases/v23.1/`). Поверх неё подключён v23.3 runtime и цепочка последующих UI/runtime patch-модулей.

В `cloudflare-test/src/v23.3/index.mjs` одновременно присутствуют legacy Match Center theme/lifecycle и поздние Match Center-патчи, включая Round51.1.

Round51.2 содержит отдельный runtime `round51-2-match-center-runtime.mjs` с собственными store/host/view state, bottom-drawer host, snap state и глобальным API `CiaoV2512MatchCenterRuntime`. Это является вторым параллельным Match Center runtime и не соответствует целевой архитектуре.

В проекте уже есть reusable-слои: canonical Match Center modules, `legacy-match-center-theme.mjs`, repository/store/providers и Serie A/legacy adapters. Их следует переиспользовать там, где они соответствуют целевому contract, вместо нового переписывания с нуля.

## 3. Архитектурное решение

### 3.1. Один click-owner

В активной TEST-сборке должен существовать ровно один обработчик, который принимает пользовательский переход из карточки матча в Match Center.

Никакие Round51/Round51.2 interceptors, bottom drawer handlers или параллельные routers не должны конкурировать с canonical handler.

Все supported entry points — домашний экран, Serie A, Coppa Italia, Champions League, Europa League, Conference League, любимый клуб и совместимые старые ссылки — должны разрешаться в один и тот же `openMatchCenter(target)` flow.

### 3.2. Один runtime и lifecycle

Canonical Match Center владеет:

- open / close / back lifecycle;
- текущим матчем;
- активной вкладкой;
- загрузкой base payload и секций;
- retry/error state;
- scroll position и обычным полноэкранным layout.

Не допускаются:

- bottom drawer;
- snap states;
- второй parallel store/runtime;
- второй overlay lifecycle;
- tournament-specific копии Match Center.

### 3.3. UI baseline

Serie A Match Center должен практически 1:1 повторять вид и поведение Match Center исходной v23.1-базы:

- экран/overlay;
- header;
- match card/score area;
- tabs;
- расположение информационных блоков;
- кнопка/жест возврата;
- loading/error/empty states;
- desktop/mobile behavior.

Это не новый редизайн. Любые косметические улучшения, которые не нужны для parity или tournament theme, исключаются из scope.

### 3.4. Tournament themes

Один и тот же DOM/UI contract получает тему по competition id через небольшой theme resolver. Темизация выполняется CSS variables/classes, а не отдельными view-файлами.

| Турнир | Тема |
| --- | --- |
| Serie A | основной синий стиль |
| Coppa Italia | красно-зелёный |
| Champions League | тёмно-синий / фиолетовый |
| Europa League | оранжевый |
| Conference League | зелёный |

Theme layer может переиспользовать `legacy-match-center-theme.mjs`, если модуль удаётся свести к чистому resolver/style shim без владения runtime или lifecycle. В противном случае нужные tokens переносятся в canonical theme layer, а legacy-модуль удаляется после cutover.

### 3.5. Единый data contract

UI получает нормализованный Match Center model, независимый от турнира.

Минимальные группы данных:

- identity: competition, match id, teams, crests;
- fixture: kickoff, status, venue/round where available;
- score;
- overview;
- stats;
- events;
- lineups/players;
- optional competition-specific metadata.

Serie A и каждый еврокубок используют свои provider/adapter, но обязаны вернуть одну и ту же canonical shape. View не должен знать, из какого API пришли данные.

Если конкретный источник не предоставляет секцию, UI показывает canonical unavailable/empty state; отдельная версия экрана ради этого не создаётся.

## 4. Routing и backward compatibility

Существующие публичные entry points и совместимые query-переходы сохраняются, но после нормализации они только формируют canonical target:

```text
{ competition, matchId, optional initialMatch }
```

После этого управление передаётся единственному Match Center runtime.

Старые ссылки не должны импортировать или запускать старый runtime. Совместимость реализуется на boundary/router level, а не через сохранение второго Match Center.

## 5. Cutover

Переход выполняется только в TEST и поэтапно.

### Phase A — зафиксировать canonical parity

Перед удалением старых слоёв добавить/актуализировать focused tests, которые описывают необходимое поведение основной версии: открытие, header, match card, tabs, back, retry/error, mobile/desktop shell и один click-owner.

### Phase B — переключить ownership

1. Убрать Round51/Round51.2 Match Center ownership из активной сборки.
2. Удалить interceptors, которые перехватывают клики поверх canonical flow.
3. Все supported match links направить в canonical runtime.
4. Подключить competition theme resolver.
5. Подключить adapters для Serie A и каждого кубка.

### Phase C — удалить мёртвую реализацию

После того как dependency scan и tests подтверждают отсутствие ссылок, удалить Round51/Round51.2 Match Center-specific файлы, включая bottom-drawer host/runtime/view/link/recovery модули и специфические тесты, которые проверяют только удалённое поведение.

Кандидаты на удаление после подтверждения dependency graph:

- `round51-1-active-match-center-ui.mjs` — если после cutover в нём не остаётся независимого нужного поведения;
- `round51-2-match-center-host.mjs`;
- `round51-2-match-center-links.mjs`;
- `round51-2-match-center-runtime.mjs`;
- `round51-2-match-center-view.mjs`;
- Round51.2 recovery modules, если их data-fix полностью поглощён canonical adapters;
- соответствующие Round51/Round51.2 Match Center tests.

`round51-1-current-round.mjs` не удаляется автоматически: он остаётся, если отвечает за выбор текущего тура вне Match Center.

Ранние generic Match Center modules также не удаляются механически. Каждый из них либо становится частью canonical path, либо удаляется только после доказанного отсутствия runtime/import references.

## 6. Testing strategy

Работа ведётся TDD: сначала тест, фиксирующий ожидаемое canonical поведение, затем минимальное изменение кода.

Обязательные уровни проверки:

1. unit/contract tests для competition normalization, adapters и theme resolver;
2. ownership/routing tests: один click -> один Match Center;
3. lifecycle tests: open/back/close без второго runtime/drawer;
4. UI parity tests для Serie A;
5. один и тот же UI contract для Coppa Italia, Champions League, Europa League и Conference League;
6. полный проектный CI;
7. после CI — TEST deployment verification отдельно для Serie A и каждого из четырёх кубков.

Для каждого турнира проверяются минимум: открытие из карточки, правильный матч, правильная тема, header/score, tabs, возврат, отсутствие второго drawer/overlay, отсутствие duplicate click handling.

## 7. Safety и rollback

- `main` / production не изменяется на этапе разработки и проверки.
- Все изменения сначала проходят через отдельную TEST-ветку.
- Исходная `test/round51-2-match-center-fixes` остаётся rollback point.
- Удалённые Round51 файлы не сохраняются в активной сборке как fallback runtime; rollback выполняется Git branch/commit, а не параллельным кодом.
- Production cutover рассматривается отдельным решением только после успешного TEST + full CI + ручной проверки всех пяти турниров.

## 8. Acceptance criteria

Работа считается готовой к production review, когда одновременно выполнены все условия:

- Serie A Match Center визуально и поведенчески соответствует основной v23.1-версии;
- Coppa Italia / Champions / Europa / Conference используют тот же DOM/UI/runtime и различаются только theme + data adapter;
- в активной сборке один Match Center runtime и один click-owner;
- нет bottom drawer, snap state и Round51.2 parallel runtime;
- старые поддерживаемые ссылки корректно маршрутизируются в canonical Match Center;
- данные каждого турнира нормализованы в единый contract;
- targeted tests и full CI зелёные;
- TEST вручную проверен на всех пяти турнирах;
- `main` не менялся до отдельного production approval.

## 9. Отвергнутые варианты

### Продолжать чинить Round51.2 bottom drawer

Отклонено: сохраняет второй runtime, дублирует lifecycle и увеличивает вероятность конфликтов click ownership/state.

### Сделать отдельный Match Center для каждого турнира

Отклонено: быстро создаст несколько расходящихся UI/runtime реализаций и повторит текущую проблему.

### Сразу заменить production/main

Отклонено: сначала необходим изолированный TEST cutover, полный CI и проверка каждого источника данных.
