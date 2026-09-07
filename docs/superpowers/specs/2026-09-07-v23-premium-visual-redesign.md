# Ciao, Web! v23 — Premium Visual Redesign

Дата: 2026-09-07  
Статус: визуальный дизайн согласован по разделам в чате; ожидает финального подтверждения этого файла перед implementation plan  
Ветка: `v23-test`

## 1. Цель

Полностью заменить текущий технический standalone-UI v23 на единый premium football interface, сохранив уже реализованные архитектуру, API, router, store, live-controller, локализацию и бизнес-правила.

Редизайн не является возвратом к v22.5 и не должен использовать legacy DOM, legacy CSS или старые карточки.

Текущий TEST-визуал считается временным техническим слоем и не является визуальной базой финальной v23.

## 2. Что не меняется

Редизайн не меняет:

- нижнюю структуру навигации из пяти разделов;
- route-модель и Back/scroll restoration;
- Telegram bridge;
- API-контракт `ciao-v23-api`;
- Match Service и фильтрацию еврокубков;
- prediction deadline `kickoff - 15 минут`;
- scoring `5 / 3 / 2 / 0`;
- локализацию клубов и турниров;
- локальное время пользователя;
- единый Match Center;
- правило полного standings для еврокубков;
- TEST/production isolation.

Функциональные ошибки данных исправляются отдельно и не маскируются редизайном.

## 3. Основное визуальное направление

Интерфейс должен ощущаться как современный футбольный продукт, а не как административная панель или набор одинаковых карточек.

Ключевой принцип:

`deep navy -> сильная типографика -> эмблемы -> счёт / позиция / статус -> минимум технических рамок -> точечный blue accent`

### 3.1. Цветовая система

Базовые implementation tokens:

- app background: `#050B18`;
- primary surface: `#0A1426`;
- raised surface: `#101D33`;
- subtle surface: `#14233B`;
- primary text: `#F7F9FC`;
- secondary text: `#8F9BB3`;
- main accent: `#3D7BFF`;
- accent soft: `rgba(61, 123, 255, 0.14)`;
- success: `#45C989`;
- live/error: `#FF5A6F`;
- divider: `rgba(255,255,255,0.07)`.

Большие сплошные цветные заливки не используются. Цвет турнира применяется точечно: badge, тонкая линия, небольшой graphic accent или icon background.

Турнирные акценты:

- Серия А — холодный голубой;
- Кубок Италии — приглушённый красно-малиновый;
- Лига чемпионов — холодный violet-blue;
- Лига Европы — тёплый оранжевый;
- Лига конференций — мягкий зелёный.

Эти цвета не заменяют основной navy UI.

### 3.2. Типографика

На всех устройствах используется одна реально подключённая гарнитура, а не случайный Telegram/system fallback.

Предпочтение: self-hosted variable `Inter` или эквивалентная нейтральная variable sans, загружаемая как asset приложения.

Иерархия:

- screen title: 28–32px, 750–800;
- major number / score: 28–40px, 750–850;
- card title / team name: 15–18px, 650–750;
- body: 14–16px;
- metadata: 12–13px;
- bottom-nav label: 11–12px.

Не использовать слишком много uppercase. Верхний регистр допустим для `LIVE`, коротких status badge и небольших eyebrow labels.

### 3.3. Геометрия и отступы

- радиусы в основном 14–18px;
- крупные hero-поверхности до 22px;
- pill radius только для chips/status;
- touch target минимум 44px;
- базовый горизонтальный padding мобильного экрана 16px;
- вертикальный ритм 8 / 12 / 16 / 24 / 32px;
- экран не должен выглядеть как столбец из одинаковых обведённых контейнеров.

Разделение достигается в первую очередь иерархией, воздухом, фоном, типографикой и содержанием; border — вторичный инструмент.

## 4. App Shell

### 4.1. Header

На Главной верхняя зона является частью персонального dashboard:

- avatar;
- имя;
- username;
- компактная ranking position / status information;
- отдельная кнопка перехода в Настройки при необходимости.

На внутренних экранах:

- компактный screen title;
- Back только там, где маршрут является вложенным;
- без повторного огромного `Ciao, Web!` на каждом экране.

### 4.2. Bottom Navigation

Ровно пять пунктов:

- Главная;
- Прогнозы;
- Рейтинг;
- Матчи;
- Таблицы.

Требования:

- единый набор SVG-иконок одной толщины;
- подписи всегда видимы;
- inactive — muted blue-grey;
- active — белая/яркая иконка + основной accent;
- никаких больших синих капсул на всю ячейку;
- активность читается через icon/color/small indicator;
- compact height;
- корректный Telegram safe-area;
- blur/divider допустимы, но панель не должна ощущаться отдельной большой карточкой поверх приложения.

## 5. Общие компоненты

### 5.1. Team Identity

Во всех матчевых и табличных интерфейсах клуб представляется через:

- эмблему;
- русское название;
- безопасный fallback, если crest недоступен.

Provider English name никогда не показывается как fallback.

### 5.2. Match Card

Единый формат для Home, Matches и контекстных списков:

- tournament badge / stage;
- local kickoff или status;
- home crest + name;
- центральный score/time;
- away crest + name;
- небольшой status badge;
- вся карточка кликабельна, если открывает Match Center.

Запрещён дубль вроде `Серия А · Серия А`.

Live-вариант заметнее через status/accent, но не использует большой красный фон.

### 5.3. Empty / Loading / Error

Loading:

- skeleton структуры конкретного экрана;
- без большого generic spinner как основной экран.

Empty:

- спокойный, короткий, встроенный в структуру экрана;
- не должен занимать почти весь viewport.

Error:

- ошибка одного блока не уничтожает весь экран;
- пользователь видит понятный русский текст;
- raw provider/backend error не показывается как основной UI;
- в TEST разрешена небольшая диагностическая строка `Код: ...` под локальной ошибкой;
- TEST diagnostic не должна менять структуру production UI.

## 6. Главная

Главная строится как персональный football dashboard в последовательности:

`profile -> key metrics -> favorite club -> Calcio today`

### 6.1. Profile Hero

Содержит:

- avatar;
- display name;
- username;
- текущую позицию в общем рейтинге.

Профиль не оборачивается в тяжёлую карточку без необходимости.

### 6.2. Key Metrics

Три показателя:

- Очки;
- Место;
- Точные счёта.

Они выглядят как единая компактная metrics-strip, а не три независимых административных KPI-card.

Цифры — главный визуальный элемент. Подписи — вторичные.

### 6.3. Любимый клуб

Если клуб не выбран:

- premium empty-state с icon/shield;
- `Выберите любимый клуб`;
- короткое пояснение;
- компактное действие.

Если выбран:

- крупная эмблема;
- русское название;
- ближайший матч;
- турнир и локальное время;
- весь ближайший матч открывает Match Center.

Не использовать огромную пустую синюю кнопку на всю ширину без дополнительного контекста.

### 6.4. Кальчо сегодня

- heading + количество матчей при наличии;
- live-first ordering;
- compact premium match cards;
- club crests обязательно;
- time/score — центральный акцент;
- tournament metadata показывается один раз;
- exact empty copy остаётся `Кальчо сегодня нет :(`.

## 7. Прогнозы

### 7.1. Верхняя структура

- screen title `Прогнозы`;
- segmented control `Прогнозы / Мои прогнозы`;
- горизонтальные competition chips:
  - Все;
  - Серия А;
  - Кубок Италии;
  - Лига чемпионов;
  - Лига Европы;
  - Лига конференций.

Competition chips могут скроллиться внутри своей области; весь экран горизонтально не двигается.

### 7.2. Карточка доступного прогноза

Структура:

- tournament badge + local kickoff;
- две крупные crest-композиции;
- русские названия клубов;
- два больших score-input по центру;
- deadline вторичной строкой;
- primary action `Сохранить прогноз`;
- inline success state `Прогноз сохранён`.

Score-input остаётся удобным для пальца и не выглядит как маленькое административное поле формы.

После закрытия:

- input disabled;
- спокойный статус `Приём прогнозов завершён`;
- без системного popup.

### 7.3. Мои прогнозы

Показывать:

- турнир;
- команды и crest;
- сохранённый прогноз;
- фактический результат при наличии;
- начисленные очки;
- статус.

`+5`, `+3`, `+2` выделяются положительно. `0 очков` остаётся нейтральным, не красным наказанием.

## 8. Рейтинг

Верхний segmented control:

`Все / Италия / Еврокубки`

### 8.1. Top 3

Если участников минимум трое:

- compact podium composition;
- 1 место визуально главное;
- 2 и 3 места вторичны;
- avatar;
- display name;
- username;
- points.

Не использовать чрезмерно декоративный пьедестал, медали или золотые градиенты на весь экран.

### 8.2. Ranking List

Ниже podium:

- position;
- avatar;
- user identity;
- points.

Текущий пользователь выделяется мягким accent background/indicator.

Если пользователь один или участников меньше трёх, podium не рисуется искусственно; используется чистый leaderboard state без большого пустого пространства.

## 9. Матчи

### 9.1. Tournament Landing

Пять tournament cards имеют общий layout, но свой небольшой character:

- название;
- короткий subtitle;
- небольшая tournament graphic mark;
- тонкий акцент соответствующего турнира;
- secondary arrow/chevron.

Карточки не должны выглядеть как пять одинаковых синих прямоугольников.

### 9.2. Серия А

- group by rounds;
- current/nearest relevant round визуально приоритетен;
- match cards с crest;
- score/time по центру;
- status badge;
- завершённые и будущие матчи отличаются контрастом, но используют один компонент.

### 9.3. Кубок Италии

Секции:

- 1/8 финала;
- 1/4 финала;
- 1/2 финала;
- Финал.

Стадии визуально отделены heading/divider/spacing, а не большими контейнерами вокруг каждой стадии.

### 9.4. Еврокубки

- только разрешённые backend-матчи итальянских клубов;
- qualification отсутствуют;
- русские названия;
- stage/status/time используют тот же match-card language.

## 10. Таблицы

Таблицы должны ощущаться как спортивный standings interface, а не spreadsheet/admin table.

### 10.1. Верх

- compact tournament switch;
- title;
- season/context subtitle при доступности.

### 10.2. Строка

Главные элементы:

- место;
- crest;
- название команды;
- игры;
- разница мячей;
- очки.

Очки — самый сильный цифровой элемент справа. Название клуба имеет приоритет над вторичными колонками.

### 10.3. Mobile priority

Приоритет мобильного отображения:

`# · Команда · И · РМ · О`

`В · Н · П` остаются доступными, но могут находиться в контролируемом горизонтальном scroll-area самой таблицы.

Page-level horizontal overflow запрещён.

### 10.4. Визуальная система rows

- без тяжёлой клеточной сетки;
- тонкие separators;
- zebra striping не обязателен;
- hover desktop-only и не является основным differentiator;
- crest присутствует;
- top/European/relegation zones могут отмечаться тонкой боковой меткой, без цветной заливки всей строки.

Для UCL/UEL/UECL standings остаётся полной со всеми клубами.

## 11. Match Center

Match Center — главный матчевый premium screen приложения.

### 11.1. Match Header

Порядок:

- `Назад`;
- tournament + stage;
- две крупные crest;
- названия клубов;
- центральный score или local kickoff;
- status;
- date / stadium / round вторично.

Матч, а не служебный UI, является главным визуальным объектом.

### 11.2. Tabs

Ровно пять:

- Обзор;
- Статистика;
- События;
- Составы;
- Игроки.

Вкладки compact, горизонтально scrollable при необходимости. Active определяется accent line / text emphasis, а не крупной pill-заливкой.

Match Header не исчезает при переключении вкладки.

### 11.3. Обзор

Только значимая информация:

- status;
- tournament/stage;
- local date/time;
- stadium;
- round.

Не повторять одно и то же поле в header и body без необходимости.

### 11.4. Статистика

Каждая метрика строится как football comparison:

`home value — metric — away value`

Поддерживаются progress indicators для подходящих метрик.

Отсутствующие данные не превращаются в `0`.

### 11.5. События

Vertical timeline:

- minute;
- event icon;
- player;
- team side;
- secondary detail.

Goal/card/substitution/penalty/VAR должны визуально различаться, но оставаться в одной системе.

### 11.6. Составы

- два team blocks;
- crest + team name;
- formation;
- XI;
- bench;
- coach, если доступен.

Не отображать raw provider objects.

### 11.7. Игроки

Compact player-stat rows/cards с приоритетом важной матчевой статистики. Не использовать тяжёлую отдельную карточку на каждого игрока, если список длинный.

## 12. Настройки

Экран Настройки — часть consumer sports product, не admin panel.

### 12.1. Profile Header

- avatar;
- display name;
- username.

### 12.2. Любимый клуб

- searchable club list;
- crest;
- русское название;
- compact check state;
- выбранный клуб сразу влияет на Home после успешного сохранения.

### 12.3. Уведомления

Один цельный settings block с четырьмя строками и separators:

- Напоминание о прогнозе;
- Стартовые составы;
- Начало матча;
- Итог матча.

Каждая строка использует аккуратный native-like switch.

Не помещать каждый toggle в отдельную большую card.

### 12.4. System Info

Внизу вторичным текстом:

- `Часовой пояс определяется автоматически`;
- `Язык интерфейса: русский`.

## 13. Иконки и изображения

- использовать один собственный SVG icon set одной толщины;
- не использовать emoji как финальные nav/action icons;
- crest команд приходят из нормализованного UI model;
- broken image не разрушает layout;
- fallback emblem нейтральный и не показывает provider name;
- tournament graphics декоративны и не несут единственную критичную информацию.

## 14. Motion

Анимации минимальны:

- tab/segment transitions 120–180ms;
- button feedback;
- live status pulse очень деликатный;
- score/live refresh не перерисовывает весь экран;
- prefers-reduced-motion учитывается.

Нет тяжёлых entrance animations, parallax или постоянных декоративных движений.

## 15. Responsive / Telegram WebView

Основная цель — Telegram mobile WebView.

Обязательно:

- safe-area top/bottom;
- touch target >= 44px;
- отсутствие page-level horizontal overflow;
- внутренний горизонтальный scroll только для tabs/chips/table region;
- bottom nav не перекрывает последний контент;
- UI не зависит от hover;
- typography и spacing проверяются минимум на узком Android/iOS viewport и desktop Telegram/Web.

## 16. Ошибки данных и graceful degradation

Редизайн не должен превращать ошибку одного матча или одной команды в пустой экран всего раздела.

Правила:

- локализационная ошибка одной записи изолируется на уровне списка/карточки;
- последний хороший block state сохраняется при transient refresh failure;
- пользователь не видит `team_localization_missing:*` как главный контент production-экрана;
- TEST может показывать diagnostic code вторичной строкой;
- если crest отсутствует, используется visual fallback;
- если secondary metadata отсутствует, строка просто опускается.

## 17. Визуальные критерии приёмки

Redesign считается готовым к Telegram smoke только если одновременно выполняется всё ниже:

- ни на одном из пяти основных экранов нет ощущения одинаковых bordered cards для каждого блока;
- Home читается как profile/dashboard, а не KPI admin page;
- прогнозная карточка визуально центрируется вокруг клубов и счёта;
- Ranking корректно выглядит при 1, 2, 3 и большем числе участников;
- Matches landing визуально различает пять турниров;
- standings читается на мобильном без page-level horizontal scroll;
- crest команд присутствуют в матчах, рейтинговом контексте где уместно и standings;
- Match Center header визуально доминирует над tabs;
- bottom navigation компактна и не использует большие active pills;
- нет emoji как финальных навигационных иконок;
- нет дублей metadata вроде `Серия А · Серия А`;
- все user-facing названия остаются русскими;
- локальное время не меняет backend deadline semantics;
- block error не обнуляет весь screen;
- TEST diagnostic code не определяет layout production UI;
- current functionality и route/back behavior проходят существующий regression suite.

## 18. Реализационная граница

Редизайн должен в первую очередь менять:

- design tokens;
- typography/font loading;
- app shell;
- shared UI components;
- screen render structure там, где текущая HTML-структура мешает новой визуальной иерархии;
- screen-specific styles;
- SVG icon assets.

Редизайн не должен менять backend/API contract, scoring, filtering, database schema, auth или navigation semantics без отдельного согласования.

## 19. Порядок реализации

Рекомендуемый визуальный rollout:

1. typography + tokens + shell + bottom nav;
2. shared Team / Match / Tournament components;
3. Home;
4. Predictions;
5. Ranking;
6. Matches;
7. Tables;
8. Match Center;
9. Settings;
10. responsive pass + visual regression tests + Telegram smoke.

На каждом шаге сохраняются существующие functional tests. Production не меняется до отдельного release approval.

## 20. Definition of Done

Premium redesign считается завершённым только после:

- implementation plan по этому spec;
- TDD/visual contract tests на новые компоненты и критичные mobile states;
- полного существующего CI;
- свежего TEST deploy;
- ручного smoke всех пяти вкладок в реальном Telegram WebView;
- smoke Match Center, Settings, Back и table overflow;
- визуального подтверждения пользователя по скринам;
- отсутствия production изменений до отдельного подтверждения.
