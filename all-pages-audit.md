# Аудит всех страниц TriDi: полный инвентарь маршрутов и сверка SEO

Дата: 16.11.2026.
Область проверки: `app/` (57 `page.tsx`, 25 `route.ts`), `app/robots.ts`, `app/sitemap.ts`, `middleware.ts`, `next.config.ts`, внутренние ссылки в `app/**`, `components/**`, `lib/**`.
Режим: только аудит. Код не менялся, добавлен только этот файл.

## 0. Главное (TL;DR)

1. **Найдено 57 страниц** (40 статических + 17 динамических) и **25 route-обработчиков** (24 API + `/logout`). Других маршрутов вне `app/` нет.
2. **P0 — критично:** в `app/robots.ts` стоит `Disallow: /course`. Правило матчится по префиксу пути, поэтому блокирует не только уроки `/course/*`, но и **все продающие страницы `/courses/*`** (4 URL). При этом `app/sitemap.ts` отдаёт `/courses/confident`, `/courses/engineer`, `/courses/profit`, `/courses/pro` с `priority: 0.9`. В Search Console это даст «URL заблокирован в robots.txt» по всем четырём страницам, которые мы продвигаем.
3. **P1 — дыра в sitemap:** `/forum/category/[slug]` — публичные индексируемые разделы (canonical есть, `noindex` только для несуществующего slug), но в карту сайта не попадают: `sitemap.ts` берёт только `getApprovedThreadsForSitemap`, разделы не перечисляет.
4. **P1 — тонкие страницы в индексе:** `/auth/login` и `/auth/sign-up` не имеют ни собственных метаданных, ни `noindex`, а `/auth` не закрыт в robots. Они наследуют из корневого layout **курсовой** title «TriDi — Курсы по 3D-печати и CRM для мастеров» и могут попасть в выдачу.
5. **P1 — страницы-сироты:** `/start` (лендинг бесплатного курса, `priority: 0.7`) получает ссылки только из статей блога — ни шапка, ни футер, ни главная на него не ведут; CTA бесплатного старта (`START_FREE_HREF`) уводят сразу на `/auth/sign-up?next=/course/lesson-1`. Второй сирота — `/legal`: на оглавление документов нет ни одной ссылки, оно доступно только из sitemap.
6. **Метаданные:** у 52 из 57 страниц есть собственный блок `metadata`/`generateMetadata`; у 5 его нет (`/auth/login`, `/auth/sign-up` — полностью; `/auth/confirm`, `/auth/reset-password`, `/start` — получают из layout сегмента). `description` отсутствует ещё на части закрытых страниц (сертификат, уроки, чек-модули).
7. **Сознательно закрыты и не должны попадать в sitemap** (это не ошибки): `/constructor`, `/3d-generator`, `/my-models`, `/gallery`, `/activate`, `/verify/*`, `/certificate/*`, `/workshop/*`, `/dashboard/*`, `/admin/*`, `/course/*`, `/auth/*` (кроме login/sign-up — там ошибка, см. п. 4).

## 1. Как проверялось

- **Инвентарь.** `Get-ChildItem -Recurse -Filter page.tsx` и `route.ts` в `app/`; отдельно проверены `layout.tsx`/`not-found.tsx` (кастомного `not-found.tsx` в проекте нет).
- **Доступ.** По трём независимым источникам: (а) `middleware.ts` — `SESSION_PATH_PREFIXES` (`/dashboard`, `/certificate`, `/course`, `/admin`, `/auth`, `/3d-generator`, `/constructor`, `/my-models`) + `SESSION_EXACT_PATHS` (`/forum/new`); (б) серверные проверки внутри страниц (`redirect()` на вход, `hasActiveSubscription()`, `hasCourseAccess()`, `isAdminEmail()`); (в) guard'ы внутри route-обработчиков.
- **Метаданные.** Извлекались только из блока `export const metadata` / `generateMetadata`, а не поиском по всему файлу (иначе в выборку попадает текст карточек). Для страниц без своего блока проверялись `layout.tsx` сегмента.
- **Индексация.** `app/robots.ts` (`allow`/`disallow`), `app/sitemap.ts` (`STATIC_PAGES` + `COURSE_LANDING_IDS` + статьи блога + темы форума), поле `robots` в метаданных.
- **Внутренние ссылки.** Сканирование `href="…"`, `href={…}` и шаблонных строк в `app/**`, `components/**`; плюс источники навигации: `components/Header.tsx`, `components/navigation/MobileMenu.tsx`, `components/navigation/tool-links.ts`, `components/Footer.tsx`, `lib/legal.ts`.
- **Риск сопровождения.** Список защищённых путей продублирован: `middleware.ts` (`SESSION_PATH_PREFIXES` + `SESSION_EXACT_PATHS`) и `lib/supabase/middleware.ts` (`PROTECTED_PATH_PREFIXES`) перечисляют одни и те же разделы независимо. Новый закрытый раздел нужно добавлять в оба файла, иначе гость увидит страницу до проверки сессии. Сейчас списки согласованы, ошибки нет.

**Ограничения аудита.** Темы и разделы форума, прогресс учеников и заказы Мастерской живут в Supabase — их количество на момент проверки не фиксировано, поэтому динамические маршруты описаны по шаблону и источнику данных. Живой обход сайта роботом не выполнялся: выводы по robots.txt сделаны по спецификации префиксного совпадения путей. Дата `lastModified` в sitemap — константа `CONTENT_REVIEWED_AT = 2026-11-01`, автоматически не обновляется.

## 2. Полный инвентарь страниц (57)

Обозначения:
- **Тип:** «стат.» — статический путь, «дин.» — динамический сегмент.
- **Доступ:** «публ.» — открыта всем; «вход» — нужна сессия; «вход+Pro» — сессия и активная подписка; «курс» — сессия и доступ к курсу; «админ» — сессия + email администратора.
- **Sitemap:** «да» — URL попадает в `sitemap.xml`; «нет» — не попадает.
- **Robots:** «allow» — путь не закрыт в `robots.txt`; «disallow» — закрыт; «disallow (префикс)» — закрыт правилом `/course`, которое матчит и `/courses/...`.
- **noindex:** «да» — `robots: { index: false }` в метаданных; «404» — только для несуществующей записи; «нет» — индексируется.
- **title / description:** «да» — задан на странице или в layout сегмента; «нет» — наследуется от вышестоящего layout (для title это курсовой заголовок сайта).

| № | Маршрут | Тип | Доступ | Sitemap | Robots | noindex | title / description |
|---|---|---|---|---|---|---|---|
| 1 | `/` | стат. | публ. | да (1.0) | allow | нет | нет / да |
| 2 | `/3d-generator` | стат. | вход | нет | allow | да | да / да |
| 3 | `/activate` | стат. | публ. (активация после входа) | нет | allow | да | да / да |
| 4 | `/admin/forum` | стат. | админ | нет | disallow | да | да / да |
| 5 | `/admin/promo` | стат. | админ | нет | disallow | да | да / да |
| 6 | `/admin/purchases` | стат. | админ | нет | disallow | да | да / да |
| 7 | `/auth/confirm` | стат. | служебная (открыта всем, токен в ссылке) | нет | allow | да (layout) | нет / нет |
| 8 | `/auth/forgot-password` | стат. | публ. (гость) | нет | allow | да | да / да |
| 9 | `/auth/login` | стат. | публ. (гость) | нет | allow | **нет** | **нет / нет** |
| 10 | `/auth/reset-password` | стат. | служебная (открыта и вошедшему, токен в ссылке) | нет | allow | да (layout) | да / нет |
| 11 | `/auth/sign-up` | стат. | публ. (гость) | нет | allow | **нет** | **нет / нет** |
| 12 | `/auth/verify-email` | стат. | служебная (открыта неподтверждённым) | нет | allow | да | да / да |
| 13 | `/blog` | стат. | публ. | да (0.8) | allow | нет | да / да |
| 14 | `/blog/[slug]` | дин. | публ. | да (0.7) | allow | 404 | да / да |
| 15 | `/certificate/[courseId]` | дин. | курс | нет | disallow | да | да / нет |
| 16 | `/constructor` | стат. | вход (+Pro/лимит) | нет | disallow | да | да / да |
| 17 | `/course/[id]` | дин. | курс | нет | disallow | нет | да / нет |
| 18 | `/course/[id]/complete` | дин. | курс | нет | disallow | да | да / нет |
| 19 | `/course/check/[moduleId]` | дин. | курс | нет | disallow | нет | да / нет |
| 20 | `/course/confident` | стат. | курс | нет | disallow | да | да / да |
| 21 | `/course/confident/[moduleId]/[lessonId]` | дин. | курс | нет | disallow | нет | да / нет |
| 22 | `/course/confident/[moduleId]/check` | дин. | курс | нет | disallow | нет | да / нет |
| 23 | `/course/engineer` | стат. | курс | нет | disallow | да | да / да |
| 24 | `/course/engineer/[moduleId]/[lessonId]` | дин. | курс | нет | disallow | нет | да / нет |
| 25 | `/course/engineer/[moduleId]/check` | дин. | курс | нет | disallow | нет | да / нет |
| 26 | `/course/profit` | стат. | курс | нет | disallow | да | да / да |
| 27 | `/course/profit/[moduleId]/[lessonId]` | дин. | курс | нет | disallow | нет | да / нет |
| 28 | `/course/profit/[moduleId]/check` | дин. | курс | нет | disallow | нет | да / нет |
| 29 | `/courses/[id]` | дин. | публ. | да (0.9) | **disallow (префикс)** | 404 | да / да |
| 30 | `/dashboard` | стат. | вход | нет | disallow | **нет** | да / да |
| 31 | `/dashboard/workshop` | стат. | вход+Pro | нет | disallow | да | да / да |
| 32 | `/dashboard/workshop/integrations/help` | стат. | вход+Pro | нет | disallow | да | да / да |
| 33 | `/dashboard/workshop/marketplace` | стат. | вход+Pro | нет | disallow | да | да / да |
| 34 | `/dashboard/workshop/products` | стат. | вход+Pro | нет | disallow | да | да / да |
| 35 | `/forum` | стат. | публ. | да (0.7) | allow | нет | да / да |
| 36 | `/forum/[slug]` | дин. | публ. | да (0.6) | allow | 404 | да / да |
| 37 | `/forum/category/[slug]` | дин. | публ. | **нет** | allow | 404 | да / да |
| 38 | `/forum/new` | стат. | вход | нет | allow | да | да / да |
| 39 | `/forum/rules` | стат. | публ. | да (0.4) | allow | нет | да / да |
| 40 | `/gallery` | стат. | публ. | нет | allow | да | да / да |
| 41 | `/legal` | стат. | публ. | да (0.4) | allow | нет | да / да |
| 42 | `/legal/consent` | стат. | публ. | да (0.3) | allow | нет | да / да |
| 43 | `/legal/cookies` | стат. | публ. | да (0.3) | allow | нет | да / да |
| 44 | `/legal/offer` | стат. | публ. | да (0.7) | allow | нет | да / да |
| 45 | `/legal/privacy` | стат. | публ. | да (0.7) | allow | нет | да / да |
| 46 | `/legal/terms` | стат. | публ. | да (0.3) | allow | нет | да / да |
| 47 | `/my-models` | стат. | вход | нет | allow | да | да / да |
| 48 | `/pricing` | стат. | публ. | да (0.8) | allow | нет | да / да |
| 49 | `/profiles` | стат. | публ. (скачивание — Pro) | да (0.7) | allow | нет | да / да |
| 50 | `/start` | стат. | публ. | да (0.7) | allow | нет | да / да (в layout) |
| 51 | `/subscription` | стат. | публ. | да (0.7) | allow | нет | да / да |
| 52 | `/tools` | стат. | публ. | да (0.8) | allow | нет | да / да |
| 53 | `/tools/defects` | стат. | публ. | да (0.7) | allow | нет | да / да |
| 54 | `/verify/[id]` | дин. | публ. (по токену) | нет | disallow | да | да / да |
| 55 | `/workshop/filaments/specification` | стат. | вход+Pro | нет | allow | да | да / да |
| 56 | `/workshop/orders/[id]/specification` | дин. | вход+Pro | нет | allow | да | да / да |
| 57 | `/workshop/orders/[id]/waybill` | дин. | вход+Pro | нет | allow | да | да / да |

### Что стоит за динамическими маршрутами

| Шаблон | Источник данных | Сколько URL сейчас | Индексируется |
|---|---|---|---|
| `/blog/[slug]` | `content/blog/*.md` через `lib/blog.ts` | 4 статьи: `bambu-a1-error-0500-4003`, `how-to-earn-on-3d-printing`, `klipper-for-beginners`, `pla-vs-petg` | да, все в sitemap |
| `/courses/[id]` | `COURSE_LANDING_IDS` в `lib/course-landing.ts` | 4: `confident`, `engineer`, `profit`, `pro` | да, в sitemap, но заблокированы robots (см. §4) |
| `/forum/[slug]` | `getApprovedThreadsForSitemap` (Supabase) | все одобренные темы | да, в sitemap |
| `/forum/category/[slug]` | `getForumCategories` (Supabase) | все разделы форума | да, но **не в sitemap** |
| `/course/[id]` | уроки из `data/lessons.json` (`/course/lesson-1`, …) | все уроки | нет (вход + robots) |
| `/course/[id]/complete`, `/course/check/[moduleId]` | прогресс и тесты курса | по модулям | нет (вход + robots) |
| `/certificate/[courseId]` | `LEVELS` (`basic`, `confident`, `engineer`, `profit`) | 4 | нет (вход + noindex + robots) |
| `/verify/[id]` | подписанный токен сертификата (`lib/certificates.ts`) | по числу выданных сертификатов | нет (noindex + robots) |
| `/workshop/orders/[id]/…` | заказы Мастерской (Supabase) | по числу заказов | нет (вход + Pro + noindex) |

## 3. API-роуты и `/logout` (25)

Все `/api/*` закрыты в `robots.txt` (`Disallow: /api/`), в sitemap не попадают — это корректно. `/logout` — единственный route-обработчик вне `/api`; он не закрыт в robots, но отвечает только на POST и сразу редиректит, индексировать там нечего.

| № | Маршрут | Методы | Защита | Robots |
|---|---|---|---|---|
| 1 | `/api/admin/promo/csv` | GET | сессия + `isAdminEmail` | disallow |
| 2 | `/api/admin/refund` | POST | сессия + `isAdminEmail` | disallow |
| 3 | `/api/agent/discover` | POST | Bearer-токен агента | disallow |
| 4 | `/api/agent/heartbeat` | POST | Bearer-токен агента | disallow |
| 5 | `/api/agent/probe` | GET, POST | GET — сессия + Pro; POST — Bearer-токен агента | disallow |
| 6 | `/api/agent/scan-complete` | POST | Bearer-токен агента | disallow |
| 7 | `/api/agent/scan-status` | GET | Bearer-токен агента | disallow |
| 8 | `/api/agent/status` | GET, POST | Bearer-токен агента | disallow |
| 9 | `/api/agent/tasks` | GET | Bearer-токен агента | disallow |
| 10 | `/api/agent/watchdog` | POST | `CRON_SECRET` (timingSafeEqual) | disallow |
| 11 | `/api/check-3d-status` | GET | сессия | disallow |
| 12 | `/api/constructor/stl` | POST | сессия + Pro/лимит моделей | disallow |
| 13 | `/api/cron/daily-report` | GET, POST | `CRON_SECRET` | disallow |
| 14 | `/api/generate-3d` | POST | сессия + тариф/кредиты | disallow |
| 15 | `/api/generated-stl/[file]` | GET | сессия + подписанный URL (HMAC) | disallow |
| 16 | `/api/generations/[id]/stl` | GET | сессия + владелец записи | disallow |
| 17 | `/api/payments/robokassa/result` | GET, POST | подпись Robokassa | disallow |
| 18 | `/api/profiles/download` | GET | сессия + Pro | disallow |
| 19 | `/api/webhooks/ozon` | GET, POST | webhook-токен магазина | disallow |
| 20 | `/api/webhooks/wb` | GET, POST | webhook-токен магазина | disallow |
| 21 | `/api/webhooks/yandex` | GET, POST | webhook-токен магазина | disallow |
| 22 | `/api/workshop/export` | GET | сессия + Pro | disallow |
| 23 | `/api/workshop/gcode` | POST | сессия + Pro | disallow |
| 24 | `/api/workshop/ocr` | POST | сессия + Pro | disallow |
| 25 | `/logout` | POST | публичный (выход из аккаунта) | allow |

## 4. Пропущено в sitemap или закрыто ошибочно

### P0. `/courses/*` заблокированы строкой `Disallow: /course`

- **Факт.** `app/robots.ts` содержит `disallow: ["/api/", "/_next/", "/admin", "/dashboard", "/constructor", "/course", "/certificate", "/verify"]`. Правила robots.txt сравниваются с **началом пути**, поэтому `"/course"` совпадает и с `/course/lesson-1`, и с `/courses/confident`, `/courses/engineer`, `/courses/profit`, `/courses/pro` (как в документации Google: `Disallow: /fish` закрывает и `/fishheads`).
- **Следствие.** Четыре продающих лендинга курсов одновременно:
  - перечислены в `app/sitemap.ts` с `priority: 0.9`;
  - отдают 200, canonical и полный набор OG/Twitter;
  - но запрещены к обходу. Search Console покажет по ним «URL заблокирован в robots.txt», а `lastmod` из карты сайта не будет использован.
- **Риск.** Внешние ссылки и внутренние ссылки с главной (`/#levels` → `level.href` = `/courses/confident` и т.д.) остаются, но робот не сможет прочитать title/description и оценить контент. Страницы-конкуренты по запросам «курс по 3D-печати» получают преимущество.
- **Как чинить.** Сузить правило до `/course/` (с косой чертой) — тогда `/courses/*` остаётся открытым, а уроки и чек-модули по-прежнему закрыты. Дополнительно можно явно добавить `/courses` в `allow`, но одного `allow` недостаточно: при конфликте правил побеждает более длинное совпадение, а `"/course"` длиннее `"/"`.
- **Проверка после правки.** В Search Console «Проверка URL» по каждому из четырёх адресов: «Доступ разрешён», страница добавлена в обход; в `robots.txt` правило `/course/` не матчит `/courses/...`.

### P1. `/forum/category/[slug]` отсутствует в sitemap

- **Факт.** Страница публичная, `generateMetadata` отдаёт title, description, canonical и OG; `noindex` включается **только** при несуществующем slug (`robots: { index: false, follow: false }` в ветке `if (!category)`). Разделы перелинкованы: `/forum` → `/forum/category/${slug}`, тема → её раздел.
- **Проблема.** `app/sitemap.ts` добавляет только темы (`getApprovedThreadsForSitemap`), а разделы — нет. Внутренние ссылки есть, поэтому разделы, скорее всего, окажутся в индексе, но без карты сайта и с `lastModified` из общей константы.
- **Как чинить.** Добавить в `sitemap()` выборку разделов (`getForumCategories`) с `changeFrequency: "weekly"`, `priority: 0.5–0.6`.

### P1. `/auth/login` и `/auth/sign-up` индексируемы и наследуют курсовой title

- **Факт.** В `app/auth/login/page.tsx` и `app/auth/sign-up/page.tsx` нет `metadata` и `generateMetadata`; `layout.tsx` в этих сегментах тоже нет. `/auth` не закрыт в `robots.ts`, `noindex` не выставлен.
- **Следствие.** Обе страницы получают из корневого layout title «TriDi — Курсы по 3D-печати и CRM для мастеров», description про курсы и `index: true`. В выдачу могут попасть тонкие страницы входа/регистрации с чужим описанием; на них ведут ссылки из шапки и меню, то есть краулинг гарантирован.
- **Как чинить.** Дать каждой странице собственные `title`/`description` и `robots: { index: false, follow: true }` (или, как минимум, `noindex`). Не закрывать `/auth` целиком в robots.txt: тогда `noindex` не будет прочитан.

### P2. Осознанно исключены, но требуют решения владельца

| Маршрут | Статус | Комментарий |
|---|---|---|
| `/gallery` | публичная, `noindex`, нет в sitemap | Галерея работ генератора — потенциальный источник длинного хвоста и доказательство продукта. Сейчас закрыта от индекса и не попадёт в выдачу по «3D-модель из фото». Решение продуктовое: открывать или нет. |
| `/activate` | публичная, `noindex` | Правильно: дублирует `/dashboard` и содержит форму активации. |
| `/verify/[id]`, `/certificate/[courseId]` | `noindex` + disallow | Правильно: персональные документы, токен в адресе. |
| `/workshop/*` | `noindex`, robots allow | Печатные формы, доступ только по сессии и Pro. `noindex` достаточно, disallow не нужен. |
| `/my-models` | `noindex`, robots allow | Личный раздел; middleware уводит гостя на вход. |
| `/3d-generator` | `noindex`, robots allow | Инструмент под входом; витрина для поиска — `/pricing`. |
| `/constructor` | `noindex` + disallow | Инструмент; витрины в поиске нет вообще (см. `main-page-audit-plan.md`). |

### P3. Формальности в robots/sitemap

- `/logout` не закрыт в robots.txt. Вреда нет (POST, 303), но для чистоты можно добавить `Disallow: /logout`.
- `allow: ["/", "/tools", "/profiles", "/blog"]` дублирует отсутствие запретов: эти пути и так разрешены. Строки безвредны, но создают ложное впечатление, что `allow` может «перебить» `Disallow: /course` для `/courses` — не может.
- `CONTENT_REVIEWED_AT` (2026-11-01) общий для всех статических страниц: `lastmod` не отражает реальные правки (например, новые юридические документы от 16.11.2026).

## 5. Страницы-сироты и слабая перелинковка

Метод: собраны все `href` в `app/**` и `components/**` (включая шаблонные строки), отдельно проверены источники навигации — `Header.tsx`, `MobileMenu.tsx`, `tool-links.ts`, `Footer.tsx`, `lib/legal.ts`. Сиротой считается страница, на которую нет ни одной ссылки из меню, футера или других страниц.

| Маршрут | Входящие ссылки | Вердикт |
|---|---|---|
| `/start` | только `/blog/[slug]` (4 статьи) | **Сирота.** Нет ни в шапке, ни в футере, ни на главной. CTA бесплатного старта на `/` и `/subscription` (`START_FREE_HREF`) ведут на `/auth/sign-up?next=/course/lesson-1`, минуя лендинг. При этом у раздела `/start` свой title «Бесплатный курс по 3D-печати для новичков» и `priority: 0.7` в sitemap — страница подготовлена для поиска, но не получает веса. |
| `/legal` | **нет ни одной ссылки** — ни в футере, ни в документах, ни в меню | **Сирота.** Оглавление документов доступно только из sitemap: логотип в `app/legal/layout.tsx` ведёт на `/`, а футер перечисляет пять документов, минуя оглавление. Стоит добавить ссылку «Все документы» в футер или в блок реквизитов. |
| `/pricing` | `/courses/[id]`, `/profiles`, `/3d-generator`, `/dashboard`, `/dashboard/workshop`, `/course/[id]/complete`, панель конструктора (`ParameterPanel`), генератор (`Image3DGenerator`), `ProBundleCard`, `ProfilesClient` | Не сирота, но нет ссылки из шапки/футера/главной. Публичные входы — только `/courses/*` и `/profiles`. Для «витрины генератора» (0.8 в sitemap) этого мало. |
| `/courses/pro` | главная (`/courses/pro`), sitemap | Ссылка есть, но пакет архивный: в `lib/course-landing.ts` у `pro` `paymentId: null`, новый платёж не предлагается. Страница продаёт то, что нельзя купить. |
| `/courses/confident`, `/courses/engineer`, `/courses/profit` | главная (`#levels` → `level.href`), `/subscription` (два блока с `level.href`), `/course/[id]/complete`, `lib/course-levels.ts` | Не сироты. Взаимных ссылок между лендингами курсов нет (в `/courses/[id]` только self-canonical), поэтому «похожие курсы» не перелинкованы. |
| `/gallery` | `tool-links.ts` (десктопное меню и бургер), `/pricing`, `/my-models`, `/3d-generator`, `Image3DGenerator` | Не сирота, но `noindex` — трафик из поиска не придёт. |
| `/profiles` | `tool-links.ts`, `/tools`, `/tools/defects`, `/pricing`, `/course/[id]/complete`, главная, `ProBundleCard` | В порядке. |
| `/my-models` | `tool-links.ts` (только вошедшим), `/gallery`, `Image3DGenerator` | В порядке (гостю не показывается осознанно). |
| `/tools/defects` | `/tools`, бургер, `/course/[id]/complete` | В порядке. |
| `/forum/category/[slug]` | `/forum`, `/forum/[slug]` | Перелинкованы, но отсутствуют в sitemap (см. §4). |
| `/forum/rules` | `/forum`, `/forum/[slug]`, `/forum/new`, формы ответа и создания темы | В порядке. |
| `/activate` | `Header.tsx`, `MobileMenu.tsx`, `/dashboard` | В порядке. |
| `/certificate/[courseId]` | `/dashboard`, `/course/[id]/complete` | В порядке, но доступ только после входа. |
| `/verify/[id]` | QR-код на сертификате (`CertificateQr`) | В порядке (публичная проверка по токену). |
| `/workshop/*` | окна Мастерской в `/dashboard/workshop` | В порядке: печатные формы открываются в новой вкладке. |
| `/legal/consent`, `/legal/cookies`, `/legal/terms`, `/legal/offer`, `/legal/privacy` | футер на всех страницах, формы регистрации/входа, cookie-баннер | В порядке. |
| `/blog/[slug]` | `/blog` | В порядке. |
| `/auth/*` | шапка, мобильное меню, формы, редиректы middleware | В порядке. |
| `/admin/*` | `/dashboard`, перекрёстные ссылки между админ-страницами | В порядке. |
| `/dashboard/workshop/*` | `/dashboard`, `/dashboard/workshop` | В порядке. |

**Итог по сиротам.** Настоящих сирот две: `/start` (ссылка только из блога) и `/legal` (ссылок нет вообще, только sitemap). Условно слабая — `/pricing` (нет входов из постоянной навигации). Остальные страницы достижимы за 1–2 клика; закрытые разделы достижимы только после входа — это ожидаемо.

## 6. Страницы с плохими или неполными мета-тегами

Общая причина половины проблем — **наследование курсового блока из `app/layout.tsx`**: `SITE_TITLE = "TriDi — Курсы по 3D-печати и CRM для мастеров"`, описание про курсы, `openGraph.images = [OG_IMAGE]` и `twitter` с тем же курсовым текстом. Если страница не переопределяет поле, в HTML уходит курсовое значение. Картинка `app/opengraph-image.tsx` тоже курсовая, поэтому даже страницы с собственным `openGraph` показывают в мессенджерах обложку курса, если не задали своё изображение (сейчас не задаёт никто).

| Маршрут | title | description | OpenGraph / Twitter | Проблема |
|---|---|---|---|---|
| `/` | **нет** (курсовой из layout) | курсовое | OG курсовой, twitter курсовой | Главная продаёт курс, хотя по факту должна продавать конструктор и генератор; title не отражает ни один продукт. См. `main-page-audit-plan.md`. |
| `/auth/login` | **нет** | **нет** | нет | Тонкая страница в индексе с курсовым title/description; `noindex` отсутствует. |
| `/auth/sign-up` | **нет** | **нет** | нет | То же; при этом это целевая страница регистрации, на неё ведут все CTA. |
| `/auth/confirm` | **нет** | **нет** | нет | `noindex` есть, поэтому вреда мало; title в вкладке — курсовой. |
| `/legal` | да | да | **нет** | Нет `canonical` и OG: при шаринге подставляется курсовая карточка. |
| `/legal/privacy`, `/legal/consent`, `/legal/terms`, `/legal/offer`, `/legal/cookies` | да | да | **нет** (только canonical) | Нет `openGraph` и `twitter`: ссылка в мессенджере открывается курсовой карточкой. |
| `/pricing` | да | да | OG да, **twitter нет** | `twitter` наследуется из layout с курсовым текстом — карточка не соответствует странице тарифов генератора. |
| `/subscription` | да | да | OG да, **twitter нет** | То же: Twitter-карточка курсового вида на странице тарифов. |
| `/profiles` | да | да | OG да, **twitter нет** | То же. |
| `/forum` | да | да | OG без `images`, **twitter нет** | Карточка форума может открыться без обложки; twitter-текст курсовой. |
| `/forum/rules` | да | да | OG без `images`, **twitter нет** | То же. |
| `/forum/[slug]` | да | да | OG без `images`, twitter `summary` без картинки | Превью темы без обложки. |
| `/forum/category/[slug]` | да | да | OG без `images`, twitter `summary` без картинки | То же + отсутствие в sitemap. |
| `/certificate/[courseId]` | да | **нет** | нет | Закрытая страница с `noindex`, описание не критично, но в соцсетях/печати карточка курсовая. |
| `/course/[id]`, `/course/[id]/complete`, `/course/check/[moduleId]`, `/course/confident/[moduleId]/…`, `/course/engineer/[moduleId]/…`, `/course/profit/[moduleId]/…` | генерируются | **нет** на уроках и чек-модулях | нет | Раздел закрыт robots и входом; приоритет низкий. |
| `/dashboard` | да | да | нет | Нет `noindex` — защита держится только на `Disallow: /dashboard` и middleware. |
| `/gallery` | да | да | нет | `noindex` оправдан, но ссылка в мессенджере открывается курсовой карточкой. |
| `/activate`, `/constructor`, `/3d-generator`, `/my-models`, `/workshop/*` | да | да / частично | нет | Для `noindex`-страниц допустимо; влияет только на превью ссылок. |

**Страницы с полным и корректным набором (образец для остальных):** `/tools`, `/tools/defects`, `/blog`, `/blog/[slug]`, `/courses/[id]`, `/start`. У них есть собственные title, description, canonical, OpenGraph и Twitter, а описание собрано из данных страницы.

**Отдельно про OG-картинку.** `app/opengraph-image.tsx` — единственное изображение сайта; оно курсовое. После смены позиционирования главной (продажа конструктора и генератора) его нужно перерисовать, иначе все карточки в поиске и мессенджерах будут по-прежнему обещать курс.

## 7. Приоритетный план исправлений

### P0 — блокирует текущее продвижение (сделать первым)

1. **Починить robots.txt: `/course` → `/course/`.**
   - Файл: `app/robots.ts`, одна строка в `disallow`.
   - Эффект: `/courses/confident`, `/courses/engineer`, `/courses/profit`, `/courses/pro` перестают быть заблокированными и совпадают с sitemap.
   - Проверка: `GET /robots.txt` содержит `/course/`; «Проверка URL» в Search Console — «Доступ разрешён»; в отчёте «Страницы» исчезает «Заблокировано robots.txt» по четырём адресам.
2. **Главная: собственные title/description/OG под конструктор и генератор.**
   - Файл: `app/page.tsx` (метаданные) — по плану из `main-page-audit-plan.md`.
   - Сейчас title наследуется от layout и обещает курсы. Пока это не исправлено, вся остальная SEO-работа по `/` упирается в несоответствие сниппета и страницы.
3. **`/auth/login` и `/auth/sign-up`: метаданные + `noindex`.**
   - Файлы: `app/auth/login/page.tsx`, `app/auth/sign-up/page.tsx` (или `layout.tsx` в этих сегментах, если страницы останутся клиентскими).
   - Минимум: свой title/description и `robots: { index: false, follow: true }`.

### P1 — неделя

4. **Добавить `/forum/category/[slug]` в sitemap.**
   - Файл: `app/sitemap.ts`; источник — `getForumCategories` из `lib/forum`.
   - `changeFrequency: "weekly"`, `priority: 0.5`, `lastModified: CONTENT_REVIEWED_AT`.
5. **Вернуть `/start` в перелинковку.**
   - Ссылка из шапки или футера (например, «Бесплатный курс»), блок на главной и замена части CTA «Старт бесплатно» на `/start` вместо прямого `/auth/sign-up?next=/course/lesson-1`.
   - Критерий: у `/start` появляется минимум два входящих источника, кроме блога.
6. **Синхронизировать Twitter-карточки.**
   - `/pricing`, `/subscription`, `/profiles`, `/forum`, `/forum/rules`: добавить `twitter` с тем же текстом, что в `openGraph` (или убрать наследование, задав `twitter` явно).
7. **Решить судьбу `/courses/pro`.**
   - Пакет не продаётся (`paymentId: null`). Варианты: `noindex` + убрать из sitemap; либо оставить как «архив» с `priority: 0.3`; либо вернуть продажу, если пакет снова актуален. Сейчас страница с `priority: 0.9` продаёт недоступный товар.

### P2 — 2–4 недели

8. **Юридические страницы:** добавить `openGraph` (title/description/url) в `app/legal/layout.tsx` один раз — он применится ко всем пяти документам; для `/legal` добавить `alternates.canonical`. Заодно добавить в футер ссылку «Все документы» на `/legal`, чтобы оглавление перестало быть сиротой (§5).
9. **`/gallery`:** продуктовое решение. Если открываем — снять `noindex`, добавить canonical и sitemap. Если закрываем — оставить как есть, но задать OG, чтобы ссылка в мессенджере не выглядела курсом.
10. **`/dashboard`:** добавить `robots: { index: false, follow: false }` как вторую страховку к `Disallow: /dashboard`.
11. **`lastModified` в sitemap:** перейти от одной константы `CONTENT_REVIEWED_AT` к датам по страницам (юридические документы уже имеют `LEGAL_*_UPDATED_AT` от 16.11.2026, профили — `profilesUpdatedAt`).
12. **Перелинковать лендинги курсов** между собой (блок «Другие уровни») — сейчас связи идут только с главной и `/subscription`.

### P3 — по случаю

13. Добавить `app/not-found.tsx`: сейчас используется стандартная страница Next.js, она отдаёт корректный 404, но без навигации и бренда.
14. Добавить `Disallow: /logout` в robots.txt (косметика).
15. `description` для `/certificate/[courseId]` и уроков — не влияет на индекс (страницы закрыты), полезно только для превью.

### Что НЕ надо «исправлять»

- `/constructor`, `/3d-generator`, `/my-models`, `/workshop/*`, `/verify/*`, `/certificate/*`, `/dashboard/*`, `/admin/*`, `/course/*` — закрытые разделы. Их отсутствие в sitemap и `noindex` — правильное поведение. Массово открывать их нельзя: это инструменты и личные документы, а не контент для поиска.
- `/activate` — `noindex` оправдан: страница нужна только по ссылке из промокода.
- `Disallow` для `/api/` — корректно, API не индексируется.

## 8. Приложение: редиректы, 404 и служебные пути

Редиректы из `next.config.ts`:

| Старый адрес | Куда ведёт | Код | Комментарий |
|---|---|---|---|
| `/terms` | `/legal/terms` | 308 | В sitemap указан конечный адрес — правильно. |
| `/privacy` | `/legal/privacy` | 308 | То же. |
| `/legal/oferta` | `/legal/offer` | 308 | То же. |
| `/register` | `/auth/sign-up` | 308 | Старые ссылки на регистрацию. |
| `/course/pro` | `/courses/pro` | 308 | Источник сам закрыт `Disallow: /course` — робот редирект не увидит, человек увидит. |
| `/course/pro/:path*` | `/courses/pro` | 308 | То же. |

404 и служебные пути:

| Путь | Поведение |
|---|---|
| `/courses` (без id) | 404: отдельного `page.tsx` нет. Ссылок на него тоже нет. |
| `/blog/<неизвестный slug>` | 404 + `noindex` из `generateMetadata`. |
| `/forum/<неизвестный slug>` | 404 + `noindex`. |
| `/forum/category/<неизвестный slug>` | 404 + `noindex`. |
| `/courses/<неизвестный id>` | 404 + `noindex`. |
| `/robots.txt` | `app/robots.ts`, исключён из matcher middleware. |
| `/sitemap.xml` | `app/sitemap.ts`, `force-dynamic`, исключён из matcher middleware. |
| `/logout` | Только POST (выход); GET не предусмотрен. |
| Любой путь с расширением (`*.png`, `*.txt`, `*.xml`) | Исключён из matcher middleware как файл, а не страница. |

## 9. Чек-лист приёмки после исправлений

- [ ] `robots.txt` содержит `/course/`, а не `/course`; `/courses/confident` в Search Console — «Доступ разрешён».
- [ ] `sitemap.xml` содержит четыре `/courses/*`, а после P1 — и `/forum/category/*`; закрытые разделы в нём отсутствуют.
- [ ] `/auth/login` и `/auth/sign-up` отдают `<meta name="robots" content="noindex">` и собственный `title`.
- [ ] У `/start` минимум две входящие ссылки вне блога.
- [ ] `/` отдаёт собственные title/description/OG, соответствующие новому позиционированию.
- [ ] Нет публичной индексируемой страницы без title/description (кроме осознанных исключений из §4).
- [ ] `/dashboard` не попадает в индекс.

## 10. На чём основан отчёт

- `middleware.ts`, `next.config.ts`
- `app/robots.ts`, `app/sitemap.ts`, `app/layout.tsx`, `app/opengraph-image.tsx`
- все 57 `app/**/page.tsx` и 25 `app/**/route.ts`
- `components/Header.tsx`, `components/Footer.tsx`, `components/navigation/MobileMenu.tsx`, `components/navigation/ToolsDropdown.tsx`, `components/navigation/tool-links.ts`, `components/legal/LegalText.tsx`
- `lib/legal.ts`, `lib/course-landing.ts`, `lib/course-levels.ts`, `lib/blog.ts`, `lib/forum.ts`, `lib/seo.ts`, `lib/features` (навигация и доступ)
- `content/blog/*.md` (4 статьи)

Код не изменялся. Все выводы сделаны чтением файлов; живой обход сайта не выполнялся.


