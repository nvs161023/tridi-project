# Полный аудит проекта TriDi: что сделано, где лежат данные, что осталось

Дата: **5 ноября 2026**. Проверялся коммит `13a07d3` (`main`, синхронизирован с `origin/main`),
рабочее дерево чистое, всего в истории **586 коммитов**.

Документ — это снимок состояния репозитория и живой базы. Код в этой итерации не менялся: только
чтение файлов, прогон проверок и read-only запросы к Supabase (ключи не печатались).

> **Пометка от 6 ноября 2026.** «19 моделей» ниже — состояние на дату аудита. Шестого ноября из
> конструктора удалены семь генераторов (настенный крючок, клипсы для кабеля, нашивка, плафон
> гирлянды, клипса для кружки, шкатулка с кодом, подарочная коробка), и в `MODEL_TYPES` осталось
> одиннадцать. Пункты этого документа про удалённые модели (грани шкатулки, габарит подарочной
> коробки) закрыты удалением и записаны в журнале `PROJECT.md`; живые числа про вазы, брелок,
> вывеску и остальные оставшиеся модели по-прежнему в силе.

## 0. Резюме одной страницей

**Что уже работает.** Четыре уровня курсов (38 уроков, 9 тестов модулей, 250 нарисованных кадров,
38 практик с критерием и артефактом), оплата Robokassa с чеком 54-ФЗ и идемпотентной записью покупки,
личный кабинет с прогрессом и гейтами, сертификаты с HMAC-подписью и публичной проверкой, отзывы
выпускников, форум с пост-модерацией, библиотека профилей печати (193 позиции каталога, 178 файлов),
блог, юридический контур по 152-ФЗ, ежедневный отчёт админу, промокоды, возвраты, аналитика.
Плюс два больших инструмента: **Мастерская** (CRM для 3D-фермы: заказы, склад, принтеры, товары,
клиенты, калькулятор, реквизиты, интеграции Ozon/WB/Яндекс, локальный агент с 8 протоколами принтеров)
и **Конструктор 3D** (19 моделей, брелок с 9 пресетами, карман под NFC, QR-визитка, экспорт STL).

**Техническое состояние — зелёное.** Прогнано 5 ноября 2026:

| Проверка | Результат |
| --- | --- |
| `npm run lint` (eslint) | 0 замечаний |
| `npx tsc --noEmit` | 0 ошибок |
| `npm run check:docs` | «Сводка и данные согласованы» |
| `npm run check:imports` | 1963 импорта, битых нет |
| `npm run check:style` | 38 уроков, 0 нарушений |
| `npm run build` | сборка проходит, 54 страницы, 22 API-роута |

**Живая база отвечает.** Supabase (`https://api.tridi-print.ru`) — 28 таблиц + 2 представления,
3 публичных бакета Storage, 8 пользователей, 8 778 просмотров страниц (4 521 за последние 7 дней).

**Что осталось (кратко).** Конструктор собран, но скрыт от всех до проверки моделей на печати;
в планировщике печати не закрыты «живучесть» и приоритеты (distribution-audit P1/P2); 3D-генератор
имеет готовый бэкенд, но не подключён к интерфейсу; нет автотестов и CI; на стороне Supabase не
вставлены шаблоны писем (Reset password / Confirm signup); уведомление Роскомнадзора — задача
владельца; документация местами отстала от кода (NFC-константы, число таблиц, nfc-compatibility.md);
контент-роадмап (`improvement-roadmap.md`, 8,4 из 10) не выполнен.

---

## 1. Продукт и стек

- **Продукт:** онлайн-курсы по 3D-печати. Базовый уровень — бесплатно; «Уверенный», «Инженер
  3D-печати», «Заработок на 3D-печати» — навсегда; пакет «Всё включено» (`pro`) открывает все три
  уровня, библиотеку профилей и Мастерскую.
- **Домен:** https://tridi-print.ru. **Владелец/оператор ПД:** самозанятый Накоряков Вадим Сергеевич,
  ИНН 531603515195 (НПД), контакт nvs16@ya.ru.
- **Стек:** Next.js 15.5.25 (App Router, Turbopack), React 19.1, TypeScript 5, Tailwind CSS 4,
  Supabase self-hosted (@supabase/ssr 0.12.7 + supabase-js 2.116), three.js 0.186 / @react-three
  (в зависимостях), Resend (письма), qrcode-generator / qrcode.react, papaparse, react-markdown.
- **Хостинг:** Amvera Cloud (Москва), Node 22, `output: "standalone"`, запуск
  `node .next/standalone/server.js`, порт 3000.
- **Агент фермы:** Python 3.12, `requests`/`paho-mqtt`/`zeroconf`, сборка в EXE через PyInstaller.
- **Архитектурный принцип:** контент курсов и юридические тексты отдельно от отображения; страницы
  серверные; клиентского Supabase почти нет (только `/auth/confirm` и `/auth/reset-password`);
  доступ к платному контенту решается только на сервере.

## 2. Карта репозитория

Всего в git **1070 файлов**. Крупные блоки:

| Путь | Файлов | Что внутри |
| --- | ---: | --- |
| `app/` | 128 | 54 страницы, 22 API-роута, 29 Server Actions (`app/actions/*`), layout'ы, стили |
| `lib/` | 112 | генераторы конструктора (19 моделей), Мастерская (CRM), оплата, доступ, аналитика, Supabase-клиенты |
| `components/` | 501 | 412 файлов `lesson-visuals/*` + индекс-реестр, мастерская (56 компонентов), конструктор (7), курсы, форум, ревью, UI |
| `supabase/` | 35 | справочные SQL-миграции (применяются вручную в SQL Editor) |
| `scripts/` | 30 | проверки (`check-docs`, `check-imports`, `style-check`, `lesson-stats`) и ручные тесты |
| `agent/` | 25 | Python-агент фермы: 8 адаптеров принтеров, EXE-сборка, доки |
| `profiles/` | 180 | библиотека профилей печати: 92 профиля принтеров, 9 материалов, 77 профилей печати (json + ini), README и SOURCES |
| `data/` | 7 | JSON курсов и каталог профилей (`profiles.json`) |
| `content/blog/` | 4 | markdown-статьи блога |
| `public/` | — | иконки, шаблоны писем (`confirmation.html`, `recovery.html`), EXE агента, OG-картинки |

Самые большие файлы кода (по строкам): `components/constructor/ParameterPanel.tsx` 3498,
`lib/constructor/params.ts` 2966, `app/actions/orders.ts` 2806, `lib/constructor/keychain-preset-geometry.ts`
2610, `lib/workshop/printers.ts` 1856, `components/workshop/OrderDetailsDialog.tsx` 1792,
`components/workshop/WorkshopOrdersTab.tsx` 1734, `app/api/constructor/stl/route.ts` 1592.

Документация в корне (все — актуальные отчёты, каждый со своей датой):

| Файл | Дата | О чём |
| --- | --- | --- |
| `PROJECT.md` | 5 ноя | главная сводка: маршруты, функции, данные, библиотеки, база, деплой, история работ (9 504 строки) |
| `constructor-full-audit.md` | 4 ноя | аудит Конструктора: P0/P1/P2, замеры сеток, чек-лист посадок |
| `nfc-embedding-research.md` | 4 ноя | исследование «метка внутри детали» |
| `nfc-compatibility.md` | 4 ноя | расчёт, в какие пресеты брелока влезает метка Ø26 |
| `qr-card-research.md` | 4 ноя | референсы и ограничения печати QR-визитки |
| `ticket-design-plan.md` | 4 ноя | план переделки пресета Ticket |
| `workshop-audit.md` | 30 окт | аудит Мастерской (C1–C10, U1–U15, F1–F13) |
| `workshop-final-audit.md` | 4 ноя | финальный аудит Мастерской (вёрстка, мобильные, дизайн) |
| `distribution-audit.md` | 3 ноя | аудит распределения задач по принтерам + план P0/P1/P2 |
| `adapter-confirmation-audit.md` | 4 ноя | подтверждение команд адаптерами принтеров |
| `pre-launch-audit.md` | 2 ноя | готовность к платному трафику (30 прогонов Playwright) |
| `COURSES-AUDIT.md`, `COURSES-REVIEW.md` | 23–24 окт | аудит и разбор курсов |
| `content-audit.md`, `content-seo-plan.md`, `improvement-roadmap.md` | 27–28 окт, 1 ноя | качество текста, SEO-план, дорожная карта контента до 9,5–10 |
| `README.md` | — | быстрый старт, подтверждение email, деплой на Amvera, watchdog |

## 3. Что сделано — по модулям

### 3.1 Курсы и контент — готово

- Четыре активных уровня: `data/lessons.json` (базовый, 2 модуля / 8 уроков), `data/course-confident.json`
  (3 / 12), `data/course-engineer.json` (2 / 10), `data/course-profit.json` (2 / 8). Итого **38 уроков**.
- **9 тестов модулей** (по 10 вопросов, порог 7 правильных, 60 пояснений в базовом, 90 в «Уверенном»,
  60 в «Инженере», 60 в «Заработке»).
- **250 визуализаций** на 250 визуальных блоков (55 / 72 / 68 / 55): 412 файлов в
  `components/lesson-visuals/` + реестр `index.tsx`. `check:docs` подтверждает 410 блоков со ссылкой на кадр.
- **38 практик** с критерием готовности и артефактом; `practice_minutes` в `data/courses.json`:
  basic 205, confident 650, engineer 690, profit 460.
- Архив старого продвинутого курса `data/course-pro.json` (26 модулей / 109 уроков / 741 блок / 260 вопросов)
  в витрине не участвует, маршруты `app/course/pro/**` удалены, `/course/pro*` редиректит на `/courses/pro`.
- Стиль уроков: `npm run check:style` — 38 уроков, **0 нарушений** (список `LEGACY_LESSONS` пуст).

### 3.2 Регистрация, вход, письма — готово (кроме шаблонов на стороне Supabase)

- Регистрация с подтверждением: `signUpAction` → `/auth/confirm` (токен активируется только кнопкой
  `verifyOtp`, поэтому авто-открытие ссылки почтовиком его не сжигает) → `/auth/verify-email`.
- Легаси-формат ссылки (`#access_token=…`) разбирает `components/EmailLinkHandler.tsx` +
  `app/actions/confirm-session.ts`.
- Вход, выход (`/logout`), «забыли пароль» (`/auth/forgot-password`), новый пароль (`/auth/reset-password`).
- Middleware не пускает в `/course/*`, `/dashboard/*`, `/forum/new`, `/admin/*` без входа и с
  неподтверждённой почтой; защита от открытого редиректа (`?next=//evil.com` не уводит наружу).

### 3.3 Оплата, доступ, промокоды, возвраты — готово

- **Robokassa:** подписанная ссылка (`Shp_course`, `Shp_user`, чек ФНС), обязательное подтверждение 18+,
  проверка подписи и суммы в ResultURL, идемпотентная запись в `purchases` (`inv_id unique`),
  открытие уровня или пакета `pro`. Легаси-подписка `pro-subscription` продлевается от текущей
  оплаченной даты; автопродление только при `ROBOKASSA_RECURRING=true` (сейчас `false`).
- **Доступ:** `lib/course-access.ts`, `lib/subscription.ts`; страницы платных уровней отдают только
  2 блока превью, остальное не попадает в HTML.
- **Промокоды** (`/activate`, `app/admin/promo`, `app/actions/promo*.ts`): три уровня, срок, отметка
  `used_at`/`used_by`, CSV-экспорт, RLS «вижу только свои активации».
- **Возвраты:** `/admin/purchases` + `/api/admin/refund` — доступ закрывается датой (`expires_at`),
  деньги возвращаются вручную в кабинете Robokassa, отдельного журнала возвратов нет.

### 3.4 Кабинет, прогресс, сертификаты, отзывы — готово

- `/dashboard`: прогресс по каждому уровню, продолжение с нужного урока, «Доступ открыт» после покупки.
- Гейты модулей: следующий модуль закрыт до сдачи теста; порог 7 из 10 на всех уровнях.
- `/certificate/<course>` — печатный A4-бланк + HMAC-ссылка `/verify/<token>` (публичная проверка
  без входа и без запросов к базе). Секрет — `CERTIFICATE_SECRET` (в dev — локальный).
- Отзывы: `/course/<уровень>/complete`, `components/reviews/*`, `lib/reviews.ts`; проверка
  «курс завершён» повторяется в Server Action, имена через представление `course_review_authors`.

### 3.5 Витрина, лендинги, SEO, аналитика — готово

- Страницы: `/`, `/start`, `/subscription`, `/courses/<id>`, `/tools`, `/tools/defects`, `/profiles`,
  `/blog`, `/forum`, `/legal/*` (5 документов + индекс), `/activate`, `/auth/*`, `/verify`, `/certificate`.
- SEO: `sitemap.xml`, `robots.txt`, canonical, OpenGraph/Twitter, JSON-LD (`FAQPage`, `Article`,
  `BreadcrumbList`), `lib/seo.ts`.
- Аналитика: `site_visits` (путь без query, без IP — пишется из middleware через `event.waitUntil`),
  Яндекс.Метрика / GA4 / пиксель VK подключаются только после «Принять все» в cookie-баннере.
- Ежедневный отчёт `/api/cron/daily-report` (защищён `CRON_SECRET`, отправка через Resend, без ключа
  возвращает HTML — удобно локально).

### 3.6 Форум — готово, но пусто

- Разделы, темы, ответы, баны; пост-модерация: темы проходят премодерацию, ответы публикуются сразу.
- `/forum`, `/forum/category/<slug>`, `/forum/<slug>`, `/forum/new`, `/forum/rules`,
  модерация `/admin/forum` (`ADMIN_EMAIL`), баны форума не закрывают доступ к курсам.
- **Факт в базе:** 17 категорий и **0 тем** — сообщество технически готово, но не запущено.

### 3.7 Блог — готово

- `content/blog/*.md` (4 статьи: PLA vs PETG, Klipper для новичков, ошибка 0500-4003 Bambu, заработок
  на 3D-печати), рендер `react-markdown` + GFM, хлебные крошки, JSON-LD `Article`, CTA на `/start`.

### 3.8 Библиотека профилей печати — готово

- 178 файлов: 92 профиля принтеров (Anycubic, Elegoo, Sovol, Artillery, Flashforge, Qidi, Bambu,
  Creality, Prusa, Voron), 9 материалов, 77 профилей печати (`.json` Orca-совместимые и `.ini` Prusa).
- Каталог `data/profiles.json` — **193 позиции** (92 принтера + 9 материалов + 92 настройки печати),
  каскадный фильтр «бренд → модель → материал» (`components/profiles/ProfilesClient.tsx`).
- Страница `/profiles` открыта всем, но карточки без пакета размыты; скачивание — только
  `/api/profiles/download` с активным пакетом. Проверено: все `file` из каталога существуют на диске.

### 3.9 Мастерская (CRM 3D-фермы) — готово, крупнейший модуль

**Страницы:** `/dashboard/workshop` (8 вкладок), `/dashboard/workshop/marketplace`,
`/dashboard/workshop/products`, `/dashboard/workshop/integrations/help`,
`/workshop/orders/<id>/specification`, `/workshop/orders/<id>/waybill`,
`/workshop/filaments/specification`.

**Вкладки:** Заказы (Kanban с drag-and-drop), Склад (катушки, остатки, порог, списание),
Принтеры (наработка сопла/смазки, ТО, обнаружение по сети), Товары, Клиенты, Калькулятор
(себестоимость, цена, прибыль), Реквизиты, Интеграции.

**Что закрыто из аудита `workshop-audit.md`** (по коммитам и коду):

- очередь и задания: уникальный активный индекс на позицию, метки `queued_at`/`started_at`/`finished_at`,
  журнал `workshop_print_events`, триггеры пересчёта статуса заказа;
- **watchdog зависших заданий** (`/api/agent/watchdog`, `lib/workshop/stuck-print-jobs.ts`):
  порог «оценка слайсера + 10 %», без оценки — сутки, снятие в `failed`, принтер в `error`;
- ручная отмена задания через RPC `workshop_cancel_print_job` (единственный RPC в проекте);
- подтверждение старта и загрузки у всех адаптеров, повторные попытки загрузки, диалог «стол пуст»;
- устойчивость Bambu: статус FINISH, отмена с причиной, `.gcode.3mf` вместо `project_file`;
- определение SN (Bambu — CN сертификата, FlashForge — raw UDP), обязательный SN, отказ от wildcard MQTT;
- SKU-маппинг Ozon (`workshop_marketplace_links`), импорт товаров и склада из фото (OCR);
- realtime-подписки (`supabase_realtime`: заказы, принтеры, задания, события).

**Планировщик печати (по `distribution-audit.md`):** P0-часть закрыта — появился
`lib/workshop/print-assignment.ts` (матрица «протокол × формат»: `.3mf` не уходит на Klipper, `.bgcode`
разрешён только PrusaLink), `last_seen_at` пишет пульс агента и по нему определяется живость принтера.
Не закрыты пункты P1/P2 — см. раздел 7.

**Агент фермы** (`agent/`): Python, 8 адаптеров — Bambu (MQTT), Moonraker/Klipper, OctoPrint,
PrusaLink, FlashForge, Creality, Anycubic, Elegoo; сканер сети (`scanner.py`), метаданные G-code,
сборка `TriDiAgent.exe` (PyInstaller, `agent/build_exe.py`), `SECURITY.md`, `AUTOSTART.md`,
`tridi-agent.service`, `protocol-test-report.md`. Эндпоинты: `/api/agent/{discover,heartbeat,probe,
scan-status,scan-complete,tasks,status,watchdog}`.

### 3.10 Конструктор 3D — собран, но скрыт от пользователей

**Статус:** `/constructor` отдаёт редирект на `/tools` (`lib/hidden-routes.ts`: `HIDDEN_PATH_PREFIXES =
["/constructor"]`), ссылок нет ни в меню, ни в тарифах. Причина — модели не проверены контрольной
печатью. Серверный экспорт `/api/constructor/stl` при этом живой.

**19 моделей** (`MODEL_TYPES` в `lib/constructor/params.ts`): ваза, брелок, вывеска, коробка, литофан,
подставка под телефон, клипсы для кабелей, кашпо, подставка под кружку, стойка украшений,
органайзер для ручек, нашивка, плафон гирлянды, ёлочная игрушка, настенный крючок, клипса для кружки,
трафарет, шкатулка с кодом, подарочная коробка.

**Брелок — 9 пресетов** (`lib/constructor/keychain-presets.ts`): `apple-tag`, `capsule`, `hex`, `gear`,
`brick`, `ticket`, `starburst`, `heart`, `qr-card`. 14 старых силуэтов удалены (коммит `cce9aed`).

**NFC-карман (свежая работа, 5 ноября):**

- карман только у трёх пресетов с `nfcPocketY`: Apple Tag (−3.7 мм), Brick (−5.2), QR-визитка (−2,
  при креплении «отверстие» — −4.2);
- раскладка `nfcLayout` — четыре зоны по Z: дно 0.6 мм, полость Ø29 мм высотой 1.2 мм (метка Ø26),
  пауза печати **Z = 1.8 мм**, губа 0.4 мм с отверстием Ø22 мм (держит метку), дальше сплошная крышка;
- проверка силуэта `nfcWallMm`: стенка считается по профилю (заготовка минус 2 × фаска 0.4 мм) с учётом
  смещения кармана; `tightReason` покрывает тонкую стенку и тонкую крышку (толщина 3.0–3.3 мм);
  блокировка — если узкая сторона < 32 мм или стенка < 0;
- панель показывает жёлтую плашку «Card на пределе: {tightReason}» и красную блокировку с причиной;
  `/api/constructor/stl` отвечает 422 `nfc_pocket_unavailable` той же причиной;
- проверено на 6+ конфигурациях: `open = 0`, `doubled = 0` (водонепроницаемость тел).

**QR-визитка** (`lib/constructor/qr-card-geometry.ts`): два размера (60 × 40 и 70 × 45), содержимое
ссылка / телефон / почта / vCard, рельеф или гравировка, крепление «отверстие» или «кольцо»;
модуль кода и версия считаются, отказ объясняется текстом (vCard на 60 × 40 не влезает — 0.62 мм).

**Прочее в конструкторе:** сохранение проектов (`saved_projects`, до 12 в кабинете), опрос после
скачивания (`constructor_feedback`), аналитика выдач (`constructor_generations`), бесплатный лимит
3 STL в календарный месяц по UTC (`constructor_downloads`), оффлайн-поведение при неприменённых
миграциях (честное «временно недоступно»).

**Из аудита `constructor-full-audit.md` осталось** (см. раздел 7): фаски/скругления у 12 вызовов
`bevelEnabled: false`, предупреждение о столе 220 × 220, гонка лимита скачиваний, выбор типа метки.

### 3.11 3D-генератор — бэкенд готов, интерфейс не подключён

- `/api/3d/generate` (Node runtime, `maxDuration = 300`): проверка сессии, кредиты (`user_credits`,
  `lib/credits.ts`: списание только после сохранения файла), загрузка фото в бакет `workshop-temp`,
  запрос в Gen API (Trellis 2 или Tripo3D), опрос каждые 3 с до 270 с, скачивание `.glb` (лимит 50 МБ),
  проверка сигнатуры и загрузка в бакет `3d-models` путём `<дата>/3d-model-<request_id>.glb`.
- Страница `/3d-generator` — каркас: drag-and-drop фото, превью, кнопка «Сгенерировать», плашка
  «Доступно генераций: 10» (заглушка); **запросов к API страница не делает** — единственное место
  в продукте, где бэкенд опережает интерфейс.

### 3.12 Админка, служебные роуты, отчёты — готово

- `/admin/forum` (модерация, баны), `/admin/promo` (+ CSV), `/admin/purchases` (продажи, возвраты).
- `/api/cron/daily-report` (выручка, регистрации, просмотры, топ страниц), `/api/agent/watchdog`.
- Вебхуки маркетплейсов: `/api/webhooks/{ozon,wb,yandex}` (Ozon — по персональному `webhook_token`).
- `/api/workshop/{export,gcode,ocr}`, `/api/profiles/download`, `/api/constructor/stl`.

### 3.13 Безопасность — готово

- Пароли и сессии целиком на Supabase Auth (bcrypt, httpOnly cookie), приложение не пишет в `auth.users`.
- RLS на всех таблицах + отсутствие грантов у `anon` (так описано в `PROJECT.md` §9: без входа PostgREST
  отвечает `401 permission denied`, гранты выданы ролям `authenticated` и `service_role`).
- Заголовок `x-supabase-user` всегда перезаписывается middleware; подделать личность нельзя.
- Секреты Ozon шифруются AES-256-GCM (`lib/crypto.ts`, `ENCRYPTION_SECRET`, фолбэк — SHA-256 от
  service-role key); ключи агента — отдельные токены (`lib/workshop/credentials.ts`, `agent-auth.ts`).
- Вебхук Robokassa проверяет MD5-подпись с `Shp_*`, сумму и пользователя; покупки пишет только
  `service_role`.
- Серверная валидация всех входов Server Actions; доступ к платному контенту решается на сервере.

## 4. Где находятся данные (базы)

### 4.1 Supabase — единственная настоящая база

- **Адрес проекта:** `https://api.tridi-print.ru` (self-hosted Supabase на VPS в РФ; используется только
  Auth + Postgres + Storage; Realtime включён публикацией `supabase_realtime`).
- **Доступы:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (браузер, только для
  подтверждения почты и сброса пароля), `SUPABASE_SERVICE_ROLE_KEY` (вебхуки, админка, агент, лимиты).
  Все три ключа лежат локально в `.env.local` и задаются в окружении Amvera.
- **Схема** применяется вручную в Supabase → SQL Editor по файлам `supabase/*.sql` (35 файлов).
  Автоматических миграций нет: `npm run build` ничего в базу не пишет.
- **Живое состояние на 5 ноября 2026** (read-only проверка service-role ключом, `rows` — фактическое
  число строк):

| Таблица | Строк | Назначение |
| --- | ---: | --- |
| `profiles` | 8 | имя и почта пользователя (1:1 с `auth.users`) |
| `lesson_progress` | 60 | прогресс уроков и тесты (уникальный индекс `user_id + course_type + lesson_id`) |
| `purchases` | 3 | покупки Robokassa (`inv_id` уникален, `expires_at` — закрытие доступа) |
| `subscriptions` | 1 | легаси-подписка `pro-subscription` |
| `promo_codes` | 1 | промокоды трёх уровней |
| `user_credits` | 1 | кредиты генераций 3D (ключ — `user_id`, колонки `id` нет) |
| `course_reviews` | 0 | отзывы выпускников (один на курс) |
| `course_review_authors` | 8 (view) | имена авторов отзывов |
| `forum_categories` | 17 | разделы форума |
| `forum_threads` | 0 | темы (публично видны только `approved`) |
| `forum_replies` | 0 | ответы |
| `forum_bans` | 0 | баны форума |
| `forum_authors` | 0 (view) | имена авторов |
| `saved_projects` | 0 | сохранённые проекты конструктора |
| `constructor_downloads` | 0 | счётчик бесплатных STL (лимит 3 в месяц по UTC) |
| `constructor_feedback` | 0 | оценки конструктора после скачивания |
| `constructor_generations` | 0 | журнал выдач STL (аналитика) |
| `site_visits` | 8 778 | обезличенные просмотры (4 521 за последние 7 дней) |
| `workshop_settings` | 1 | калькулятор, реквизиты, ключи Ozon, `webhook_token` |
| `workshop_printers` | 2 | принтеры, `last_seen_at`, протокол, SN, ТО |
| `workshop_filaments` | 1 | катушки: вес, остаток, порог, `usage_type` |
| `workshop_products` | 4 | товары, `gcodeUrl`, SKU |
| `workshop_clients` | 1 | клиенты |
| `workshop_orders` | 4 | заказы (Kanban) |
| `workshop_order_items` | 4 | позиции заказа |
| `workshop_order_comments` | 0 | комментарии к заказу |
| `workshop_print_jobs` | 13 | задания печати (`queued_at`/`started_at`/`finished_at`, `estimated_seconds`) |
| `workshop_print_events` | 37 | журнал очереди (кто поставил, начал, закрыл) |
| `workshop_marketplace_links` | 0 | связка SKU маркетплейса ↔ товар |
| `workshop_discovered_printers` | 2 | найденные в сети принтеры до добавления |

Итого **28 таблиц + 2 представления**. `PROJECT.md` §9 всё ещё пишет «девятнадцать таблиц» — цифра
отстала от кода; `check:docs` этого не ловит (он сверяет пути и числа уроков, но не количество таблиц).

### 4.2 Supabase Storage — файлы

Три **публичных** бакета (проверено запросом к `/storage/v1/bucket`):

| Бакет | Что хранит | Кто пишет |
| --- | --- | --- |
| `workshop-temp` | фото для OCR накладных и генерации 3D | `/api/workshop/ocr`, `/api/3d/generate` |
| `3d-models` | готовые `.glb` из Gen API (`<дата>/3d-model-<request_id>.glb`) | `/api/3d/generate` |
| `workshop-gcode` | G-code/3MF, который скачивает агент по `gcodeUrl` | `/api/workshop/gcode` |

Публичность вынужденная: агент фермы работает без cookies и забирает файл по прямой ссылке,
Gen API принимает только публичный URL фото.

### 4.3 SQL-миграции в репозитории (`supabase/`, 35 файлов)

Применяются вручную, большинство идемпотентны (`if not exists`, `drop policy if exists`). Группы:

- **доступ и оплата:** `grants_and_policies.sql`, `purchases.sql`, `promo_codes.sql`,
  `subscriptions_recurring.sql`, `pro_course_access.sql`, `module_test_course_types.sql`,
  `confident_course_access.sql`, `engineer_course_access.sql`, `profit_course_access.sql`;
- **курсы и сервис:** `course_reviews.sql`, `forum.sql`, `site_visits.sql`, `user_credits.sql`,
  `fix-missing-objects.sql` (ремонтная копия для базы, где объекты не появились);
- **конструктор:** `constructor_downloads.sql`, `constructor_feedback.sql`, `constructor_generations.sql`,
  `saved_projects.sql`;
- **Мастерская:** `workshop_settings.sql`, `workshop_requisites.sql`, `workshop_filaments.sql`,
  `workshop_filament_usage_type.sql`, `workshop_products.sql`, `workshop_product_model_url.sql`,
  `workshop_printers_orders.sql`, `workshop_farm_and_shop.sql`, `workshop_print_queue_hardening.sql`,
  `workshop_printer_probe.sql`, `workshop_printer_protocols.sql`, `workshop_printer_z_screw.sql`,
  `workshop_marketplace_integration.sql`, `workshop_clients.sql`, `workshop_order_comments.sql`,
  `workshop_orders_client_id.sql`, `workshop_fix_triggers.sql`.

### 4.4 Данные в репозитории (не база, но источник правды)

| Путь | Объём | Что внутри |
| --- | ---: | --- |
| `data/lessons.json` | ≈766 КБ | базовый курс: 2 модуля, 8 уроков, 312 блоков |
| `data/course-confident.json` | ≈763 КБ | «Уверенный»: 3 модуля, 12 уроков, 442 блока |
| `data/course-engineer.json` | ≈652 КБ | «Инженер»: 2 модуля, 10 уроков, 375 блоков |
| `data/course-profit.json` | ≈534 КБ | «Заработок»: 2 модуля, 8 уроков, 307 блоков |
| `data/course-pro.json` | ≈380 КБ | архив продвинутого курса (26 / 109 / 741), не в витрине |
| `data/courses.json` | 1 КБ | метаданные витрины, цены, часы, `practice_minutes` |
| `data/profiles.json` | — | каталог 193 профилей печати |
| `profiles/**` | 178 файлов | сами профили (json/ini) |
| `content/blog/*.md` | 4 файла | статьи блога |
| `public/templates/*.html` | 2 файла | готовые шаблоны писем Supabase |

### 4.5 Что живёт на клиенте и локально

- **Cookie:** сессия Supabase (`sb-*` через `@supabase/ssr`), согласие cookie-баннера
  (`components/CookieBanner.tsx`).
- **localStorage:** `tridi-constructor-downloads` (когда показать опрос), `workshop_onboarding_seen` и
  `workshop_full_tour_seen` (пройден ли тур Мастерской).
- **Локальные артефакты (в git не попадают):** `.next/`, `tsconfig.tsbuildinfo`,
  `agent/temp/*.gcode|*.3mf`, `agent/.env` (`CRM_URL`, `AGENT_TOKEN`, `POLL_INTERVAL`, `SCAN_NETWORK`),
  `agent/build/`, `agent/dist/TriDiAgent.exe`.
- **Секреты локально:** `.env.local` — 16 переменных: Supabase URL / anon / service-role, `ADMIN_EMAIL`,
  `ROBOKASSA_LOGIN`, оба пароля Robokassa, `ROBOKASSA_IS_TEST=false`, `ROBOKASSA_RECURRING=false`,
  `CRON_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `OPENAI_API_KEY`, `ENCRYPTION_SECRET`, `GEN_API_KEY`,
  `GEN_API_MODEL`. Файл в `.gitignore` — в git только `.env.example` и `agent/.env.example` (проверено).
  В нём **нет** `NEXT_PUBLIC_SITE_URL`, `CERTIFICATE_SECRET`, `NEXT_PUBLIC_YM_ID`, `NEXT_PUBLIC_GA_ID`,
  `NEXT_PUBLIC_VK_PIXEL_ID`, `TRIPO3D_API_KEY`: локально сертификаты работают на dev-фолбэке,
  а счётчики аналитики не подключаются.

---

## 5. Инфраструктура, сборка и эксплуатация

- **Хостинг:** Amvera Cloud (`amvera.yml`, Node 22). Сборка: `npm run build:amvera` =
  `clean` + `ensure:tsconfig` + `check:imports` + `next build --turbopack` + копирование `public` и
  `.next/static` внутрь `.next/standalone`; запуск — `node .next/standalone/server.js`, порт 3000.
- **Почему так:** `ensure:tsconfig` восстанавливает алиас `@/*`; `check:imports` сверяет регистр имён
  файлов (Linux чувствителен, Windows — нет); `.npmrc` с `include=optional` нужен для
  `@tailwindcss/oxide-linux-x64-gnu`; блок `artifacts` из `amvera.yml` убран, чтобы в архив не уезжал
  весь `.next` (было 809 МБ против ~80 МБ standalone).
- **Cron (2 задачи, обе под `CRON_SECRET`):** `0 9 * * *` — `POST /api/cron/daily-report`;
  `17 * * * *` — `POST /api/agent/watchdog`.
- **Переменные на проде:** Supabase (3), `NEXT_PUBLIC_SITE_URL`, Robokassa (4), `ENCRYPTION_SECRET`,
  `CERTIFICATE_SECRET`, `ADMIN_EMAIL`, `CRON_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `OPENAI_API_KEY`,
  `GEN_API_KEY`, `GEN_API_MODEL`, при необходимости `TRIPO3D_API_KEY`, `NEXT_PUBLIC_YM_ID`,
  `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_VK_PIXEL_ID`, `NEXT_PUBLIC_ENABLE_PARTNER_PROMO`.
- **Агент фермы:** ставится на ПК мастера, читает `.env` (`CRM_URL`, `AGENT_TOKEN`), запускается
  `python main.py` или службой (`tridi-agent.service`); Windows-сборка `TriDiAgent.exe` лежит в
  `agent/dist` и в `public/downloads`.

---

## 6. Качество: чем проверяется и чего нет

Прогнано 5 ноября 2026 (всё зелёное):

```
npm run lint          → 0 замечаний
tsc --noEmit          → 0 ошибок
npm run check:docs    → «Сводка и данные согласованы»
npm run check:imports → 1963 импорта, битых нет
npm run check:style   → 38 уроков, 0 нарушений
npm run build         → успешно: 54 страницы, 22 API-роута, shared JS 103 kB
```

| Скрипт | Смысл |
| --- | --- |
| `scripts/check-docs.mjs` | все пути из `PROJECT.md` существуют; числа уроков/блоков/вопросов/`total_*`/`practice_minutes` совпадают с данными |
| `scripts/check-imports.mjs` | каждый `@/…` и относительный импорт существует **и с тем же регистром**, что на диске |
| `scripts/style-check.mjs` | предложение ≤ 12 слов, абзац ≤ 4 предложений; 38 уроков |
| `scripts/lesson-stats.mjs` | объём урока: блоки, слова, знаки, среднее на блок |
| `scripts/ensure-tsconfig.mjs` | восстановление `tsconfig.json` с алиасом `@/*` |
| `scripts/register-alias.mjs` | запуск TS-скриптов без сборки (`node --import ./scripts/register-alias.mjs …`) |

**Чего нет:** автотестов и CI (все проверки запускаются вручную), pre-commit-хуков, сгенерированных
типов Supabase (строки читаются вручную, ошибки схемы разбирает `lib/supabase/schema-errors.ts`).
Ручные тесты (30 скриптов) требуют живой базы, а часть — реальных принтеров: `test-db.ts`,
`test-order-processor.ts`, `test-marketplace-orders.ts`, `test-print-resources.ts`,
`test-refund-guard.ts`, `test-agent-status.ts`, `test-agent-tasks.ts`, `test-3mf.ts`,
`test-all-protocols.py` и `test-{bambu,ff,flashforge,prusa,octoprint,moonraker,creality,anycubic,elegoo,formats}.py`.

---

## 7. Что осталось сделать

### 7.1 P0 — до платного трафика и первых реальных денег

| # | Задача | Где | Почему P0 |
| --- | --- | --- | --- |
| 1 | Вставить шаблоны писем в Supabase: **Reset password** и **Confirm signup** | `public/templates/recovery.html`, `public/templates/confirmation.html` → Email Templates | с шаблоном по умолчанию (`{{ .ConfirmationURL }}`) письмо ведёт на `/auth/v1/verify`, токен сгорает от авто-открытия, пользователь видит «ссылка не сработала» |
| 2 | Заполнить Site URL и Redirect URLs (`https://tridi-print.ru/**`) | Supabase → Authentication → URL Configuration | без этого ссылка из письма не приводит на `/auth/confirm` |
| 3 | Проверить боевые настройки Robokassa: ResultURL `/api/payments/robokassa/result`, SuccessURL, FailURL, `ROBOKASSA_IS_TEST=false` | кабинет Robokassa + окружение Amvera | интеграция проверена E2E в тестовом режиме, **реальная оплата ни разу не проводилась** |
| 4 | Уведомление Роскомнадзора о начале обработки ПД + сверка реквизитов | `lib/legal.ts`, документы `/legal/*` | юридическое требование, задача владельца |
| 5 | Привести документацию к коду: `PROJECT.md` §3.11 (NFC: сейчас `NFC_POCKET_DEPTH_MM` 1, `NFC_LID_MIN_MM` 1.5, `pauseZ = 1.05`, флаг `tight`), `PROJECT.md` §9 («девятнадцать таблиц»), `nfc-compatibility.md` (R14.9 / толщина 2.5 / пауза 1.05) | `PROJECT.md` строки ≈9461–9491, `nfc-compatibility.md` §1–3 | `check:docs` это не ловит: он сверяет пути и числа уроков, а не прозу о константах. Читатель документации получает устаревшую инструкцию по NFC |
| 6 | Убедиться, что на проде заданы `NEXT_PUBLIC_SITE_URL` и `CERTIFICATE_SECRET` | окружение Amvera | без первого ломаются ссылки в письмах/sitemap, без второго страницы сертификата и `/verify` честно сообщают об ошибке; локально обеих переменных нет |

### 7.2 P1 — функциональные дыры, которые видит пользователь

**Планировщик печати** (остаток `distribution-audit.md`, P1–P2; сейчас в коде нет ни `attempts`,
ни `priority`):

1. Задание в статусе `queued` не имеет срока жизни: watchdog смотрит только `printing`, поэтому задание,
   выданное мёртвому агенту, навсегда блокирует позицию (уникальный активный индекс), принтер и заказ.
2. Нет повторных попыток: любая ошибка агента — `failed`, заказ возвращается в «Новые», следующий клик
   автораспределения отдаёт его тому же принтеру (замкнутый цикл).
3. Статус принтера `error` «липкий»: снимается только пульсом `resetErrors` при старте агента.
4. Пауза у Bambu/Moonraker отдаётся как `error`, и задание на паузе закрывается провалом.
5. Приоритетов и дедлайнов нет: очередь — FIFO по `created_at`, поле `deadline` не читается.
6. Нужны миграция (`supabase/workshop_print_assignment.sql` — файла пока нет) и новые проверки
   (`scripts/test-print-assignment.ts`).

**Конструктор** (остаток `constructor-full-audit.md`):

7. Нет фасок и скруглений: **12 вызовов `bevelEnabled: false`** в `lib/constructor/*.ts`
   (подставка под телефон — 48 треугольников, клипса кружки — 44, коробка — 112, трафарет — 254,
   подарочная коробка — 304, крючок — 388). Это и есть «примитивный» вид моделей (P1-2, 16–24 ч).
8. Габарит по умолчанию у пяти моделей больше стола 220 × 220 (коробка 293.8, кашпо 262,
   шифр-коробка 335, подарочная 383.8, вывеска 281.2) — предупреждения в интерфейсе нет (P1-1).
9. Лимит «3 бесплатных STL в месяц» не атомарен: проверка `usage.count` и вставка — два запроса,
   гонка даёт 4-е скачивание (P1-4).
10. Счётчик для показа опроса живёт в `localStorage` (`tridi-constructor-downloads`) — не переносится
    между устройствами, скачивания Pro не учитываются (P1-5).
11. P2: включение NFC визуально почти ничего не меняет в предпросмотре, нет выбора типа метки
    (Ø26 — единственный), габарит брелока по умолчанию 40.8 вместо 40.

**Прочее:**

12. **3D-генератор не подключён к интерфейсу:** `/3d-generator` не вызывает `/api/3d/generate`
    (единственное расхождение «бэкенд есть, UI нет»).
13. **Мини-проверки не сохраняются** (`components/course/MiniCheck.tsx`) — это самопроверка, не тест;
    в платных уровнях блок `mini_check` есть только в C9, IN2, Z2.
14. **`completeLesson` не проверяет доступ**: вошедший пользователь может отметить урок платного уровня
    пройденным (контента это не даёт, но строки в `lesson_progress` появляются).
15. **Правильные ответы тестов уходят в браузер** (проверка на клиенте, сервер считает только число) —
    приемлемо для обучающих тестов, но не защита от накрутки.
16. **Нет автотестов и CI** (п. 7.1 выше и раздел 6).
17. **Форум пуст** (0 тем при 17 категориях) — нужен стартовый контент или сидинг перед запуском трафика.
18. **Контент-роадмап `improvement-roadmap.md` не выполнен**: оценка 8,4 из 10; Этап 1 (17 кадров
    за рамкой, 77 дублей подписи, 29 линий сквозь текст, заполненный паспорт партии, три обещанных
    файла) — гейт для продажи за 4 990 ₽.

### 7.3 P2 — развитие Мастерской (по `workshop-audit.md`, F-пункты)

Не закрыты (проверено по коду и схеме): **F1** остаток готовой продукции, **F2** фото товара и
3D-превью, **F4** роли и команда, **F6** уведомления (мастеру и клиенту), **F7** журнал обслуживания
принтеров (сейчас только наработка и сброс ТО), **F8** учёт брака и повторных печатей, **F9** статус
заказа для клиента, **F10** оплата и счёт, **F12** привязка катушки к принтеру и слоту AMS,
**F13** себестоимость заказа в карточке. UX-пункты (**U6** поиск и фильтры, **U7** массовые действия,
**U9** экран «Очередь фермы», **U15** история печати) на текущем коммите требуют перепроверки:
часть редактирования уже сделана (`EditOrderDialog`, `AddProductDialog`, `ClientOrdersDialog`).

### 7.4 P3 — гигиена репозитория и документации

1. ~~**`scripts/tmp-nfc-fit.mjs` (20 КБ) закоммичен**~~ — **закрыто 6 ноября 2026.** Скрипт
   переименован в `scripts/nfc-fit.mjs`, шапка и пороги переписаны под текущий код: полость равна
   метке (R13), стенка 1.5, фаска профиля 0.4 (консервативно 14.9), блок по толщине 3.0 и норма
   3.5. Второй блок вывода печатает фактический `nfcLayout`, поэтому числа растра и кода больше не
   расходятся. Запуск — `node --import ./scripts/register-alias.mjs scripts/nfc-fit.mjs`.
2. **`PROJECT.md` §3.11 устарел по NFC** (см. 7.1 п.5) и **§9 говорит «девятнадцать таблиц»** при 28.
3. **`PROJECT.md` §2 (строка 125, описание `/profiles`): «193 файла в трёх категориях, включая
   86 принтеров»** — на диске 178 файлов (92 принтера), а 193 — это число позиций каталога
   `data/profiles.json` (92 принтера + 92 процесса + 9 материалов, что верно указано в §3.15).
   Формулировку стоит выровнять: «193 позиции каталога, 178 файлов».
4. **Нумерация разделов `PROJECT.md`**: после §3 сразу §5 — раздел 4 отсутствует (нумерация сбивает
   ссылки вида «раздел 4»).
5. **`README.md`** остался шаблоном `create-next-app` в первых 35 строках; полезная часть — про почту,
   деплой и watchdog — начинается ниже.
6. **Зависимости:** `next@15.5.25`, `postcss`, `three` — стоит периодически смотреть `npm audit`;
   в проекте нет lock-проверки версий в CI.
7. **Дубли в истории `PROJECT.md`** (запись о QR-визитке идёт двумя блоками, у второго нет заголовка) —
   редакционная правка, не влияет на продукт.

---

## 8. Как воспроизвести этот аудит

```powershell
# 1. Состояние кода и проверки
git log --oneline -5
npm run lint
npx tsc --noEmit
npm run check:docs
npm run check:imports
npm run check:style
npm run build

# 2. Карта файлов
git ls-files | Measure-Object -Line
git ls-files app | Select-String '(page|route)\.tsx?$'

# 3. Живая база (только чтение; ключ берётся из .env.local, в консоль не печатается)
#    GET <URL>/rest/v1/<table>?select=id&limit=1 с заголовками apikey + Authorization и Prefer: count=exact
#    число строк приходит в заголовке Content-Range; список файлов — GET <URL>/storage/v1/bucket

# 4. Пересчёт NFC-раскладки для пресетов (растр по текущим порогам + фактический nfcLayout)
node --import ./scripts/register-alias.mjs scripts/nfc-fit.mjs
```

Проверки `check:docs`, `check:imports`, `check:style` менять код не требуют и безопасны в любой момент;
`npm run build` перезаписывает `.next` (на работу дев-сервера не влияет).

---

## 9. Итог: где мы находимся

**Продукт готов к продажам по функциональности:** курсы, доступ, оплата, кабинет, сертификаты,
профили, форум, блог, Мастерская с локальным агентом. Все технические проверки зелёные, сборка
проходит, база отвечает, миграции применены.

**Перед платным трафиком остаётся конфигурация, а не код:** шаблоны писем Supabase, Site URL и
Redirect URLs, боевые адреса Robokassa и проверка одной реальной оплаты, `NEXT_PUBLIC_SITE_URL` и
`CERTIFICATE_SECRET` на проде, уведомление Роскомнадзора.

**Три содержательных «хвоста» разработки:**

1. **Планировщик печати** — «живучесть» (просроченные `queued`, повторы, липкий `error`, пауза как
   провал) и приоритеты. Это единственное место, где логика фермы может надолго заблокировать заказ.
2. **Конструктор** — фаски и скругления (12 моделей без единого), предупреждение о столе, атомарность
   лимита; плюс контрольная печать, после которой раздел можно снова включить в витрину.
3. **Контент** — дорожная карта `improvement-roadmap.md` (Этап 1 — гейт для цены 4 990 ₽) и
   наполнение форума.

**Системный риск:** нет автотестов и CI — все 6 проверок запускаются вручную, а ручные тесты требуют
живой базы и принтеров. Первый шаг гигиены — GitHub Actions на `lint + tsc + check:imports +
check:docs + build`.
