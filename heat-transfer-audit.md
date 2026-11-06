# Аудит Конструктора под heat-transfer

Только описание текущего состояния кода. Выводов, оценок и рекомендаций в файле нет.

Проверенные файлы:

- `lib/constructor/params.ts` — 3046 строк;
- `app/api/constructor/stl/route.ts` — 1651 строка;
- `components/constructor/ParameterPanel.tsx` — 3764 строки;
- `components/constructor/Viewport.tsx` — 1331 строка;
- дополнительно для контекста: `app/constructor/ConstructorClient.tsx`, `lib/constructor/projects.ts`, `lib/constructor/project-store.ts`, `app/actions/projects.ts`, `components/constructor/SaveProjectDialog.tsx`.

## 1. `lib/constructor/params.ts`

### `ConstructorParams`

`export type ConstructorParams = { model: ModelType } & VaseParams & KeychainParams & SignParams & BoxParams & LithophaneParams & StandParams & ClipsParams & PlanterParams & CoasterParams & JewelryStandParams & PenHolderParams & FabricPatchParams & StringLightParams & WallHookParams & CupClipParams & CipherBoxParams & GiftBoxParams` (строка 1454).

- Верхний уровень — одно поле `model: ModelType` плюс пересечение 17 типов параметров моделей.
- Поля всех моделей лежат в одном объекте рядом; `model` говорит, какие из них активны. Комментарий над типом объясняет это тем, что один объект проходит через панель, предпросмотр и API.
- Типы полей внутри групп: `number` (размеры в мм), `string` (надписи, SVG-data URL), `boolean` (флаги), литеральные объединения из `as const`-массивов (`VaseShape`, `VasePattern`, `SignFont`, `SignPart`, `LithophaneMount`, `LithophanePart`, `PlanterShape`, `CoasterPattern`, `JewelryConfig`, `WallHookMount`, `GiftBoxShape`, `KeychainPresetId` и т.п.), массивы `number[]` (`boxCells`, `lithophaneBrightness` — 160 000 значений).
- `DEFAULT_CONSTRUCTOR_PARAMS` (строка 1473): `model: "vase"` и spread 17 объектов `DEFAULT_*_PARAMS`. Каждая модель имеет свой `DEFAULT_*_PARAMS` (например `DEFAULT_VASE_PARAMS` — строка 1174, `DEFAULT_KEYCHAIN_PARAMS` — 1192).

### `MODEL_TYPES` и `MODEL_TYPE_LABELS`

- `MODEL_TYPES` (строка 179) — `as const` массив из **17** строковых id: `vase`, `keychain`, `sign`, `box`, `lithophane`, `stand`, `clips`, `planter`, `coaster`, `jewelry_stand`, `pen_holder`, `fabric_patch`, `string_light`, `wall_hook`, `cup_clip`, `cipher_box`, `gift_box`. `ModelType = (typeof MODEL_TYPES)[number]` (199), гард `isModelType` (1778).
- `MODEL_TYPE_LABELS` (строка 202) — `Record<ModelType, string>` через `satisfies`, **17** подписей: «Ваза», «Брелок», «Вывеска», «Коробки», «Литофан», «Подставка», «Клипсы», «Кашпо», «Подставка под кружку», «Подставка для украшений», «Органайзер для ручек», «Нашивка», «Абажур для гирлянды», «Настенный крючок», «Клипса для кружки», «Шкатулка с кодом», «Подарочная коробка».
- Рядом — `CONSTRUCTOR_TOOLS` (240): `readonly ConstructorTool[]`, ровно **17** объектов `{ id: ModelType; title: string; desc: string }`. По комментарию это единственный источник списка для витрины `/tools`, страницы тарифов и подписей.

### `normalizeConstructorParams`

`normalizeConstructorParams(params: Partial<ConstructorParams>): ConstructorParams` (строка 3021).

- `model` проверяется через `isModelType`; всё незнакомое заменяется на `DEFAULT_CONSTRUCTOR_PARAMS.model` (то есть `"vase"`).
- Результат собирается из 17 нормализаторов (`normalizeVaseParams` … `normalizeGiftBoxParams`), каждый получает тот же `Partial<ConstructorParams>` и возвращает полный набор полей своей группы.
- Поля, не входящие ни в одну группу, в результат не попадают: итоговый объект строится только из явных spread'ов, лишние ключи не копируются.
- Внутри нормализаторов: числа проходят `snap(значение, CONSTRUCTOR_LIMITS.x)` — зажим в `min`/`max` и выравнивание по `step`; отсутствующее значение берётся из `DEFAULT_*_PARAMS`; перечисления проверяются гардами `isVaseShape`, `isSignFont` и т.п. и заменяются дефолтом; `boolean` принимается только настоящим `boolean`; тексты чистятся санитайзерами (`sanitizeKeychainText`, `sanitizeSignText`, `sanitizeCipherWord`, `sanitizeQrCardContent`); SVG-строка ограничена `KEYCHAIN_SVG_MAX_LENGTH = 200_000` (419) и проверяется `isCustomSvgData` / `hasDrawableSvgData`.
- Специальные правила тоже живут в нормализаторах: у брелока пресет и свой контур взаимоисключающие, NFC-флаг гасится у пресетов без кармана, у QR-визитки габарит выводится из `qrCardSize`; у литофана крепление гасится при выключенной рамке.

### Общий «список параметров по типу модели»

В `params.ts` такого реестра нет: нет массива-описания полей на модель (аналога прежнего `STENCIL_PARAMS`). Для каждой модели в файле есть отдельные сущности:

- тип `XxxParams` (546, 621, 645, 661, 695, 737, 768, 798, 830, 851, 883, 902, 922, 967, 988, 1015, 1160 — литофан);
- `DEFAULT_XXX_PARAMS`;
- `normalizeXxxParams`;
- `xxxStlFileName` (1501, 1516, 1530, 1540, 1552, 1658, 1739, 1755, 1770 и др.);
- свои константы перечислений и лимитов (`CONSTRUCTOR_LIMITS`, `VASE_SHAPES`, `SIGN_FONTS`, `LITHOPHANE_MOUNTS` и т.д.).

Реестры «модель → данные» находятся вне `params.ts`: `MODEL_DEFAULT_PARAMS: Record<ModelType, Partial<ConstructorParams>>` в `ConstructorClient.tsx` (строка 160, 17 записей) и `ParsedConstructorRequest` + `parse*Params` в API-роуте.

## 2. `app/api/constructor/stl/route.ts`

### Как принимается запрос

- Единственный экспорт — `export async function POST(request: Request): Promise<Response>` (строка 1341).
- Тело — JSON: `body = await request.json()` (1390). `form-data`/`multipart` не используются. Ошибка чтения JSON → ответ 422 `invalid_params` («Не удалось прочитать параметры модели.»).
- Модель берётся из поля `model` в теле: `const { model = "vase" } = body` (1206). Если поле не передано, считается `vase`; неизвестное значение → `parseConstructorRequest` возвращает `null` → 422 с общим текстом про проверку параметров.
- Разбор — `parseConstructorRequest(body: unknown): ParsedConstructorRequest | null` (1199): 17 последовательных `if` по строкам `model`, каждая вызывает свой `parseVaseParams` (225), `parseKeychainParams` (302), `parseStandParams` (432), `parseClipsParams` (466), `parseSignParams` (508), `parseBoxParams` (585), `parseLithophaneParams` (671), `parsePlanterParams` (738), `parseCoasterParams` (787), `parseJewelryStandParams` (831), `parsePenHolderParams` (866), `parseFabricPatchParams` (914), `parseStringLightParams` (961), `parseWallHookParams` (1020), `parseCupClipParams` (1062), `parseCipherBoxParams` (1104), `parseGiftBoxParams` (1138). Разобранный вариант типизирован объединением `ParsedConstructorRequest` (1173).
- Три модели возвращают дополнительные поля к параметрам: `sign` — `block` и `part`, `lithophane` — `part`.
- После разбора идут отдельные проверки: реализован ли пресет брелока (`isKeychainPresetImplemented`), входит ли `holePlacement` в набор пресета, доступен ли карман под NFC (`nfcLayout`), не исчерпан ли лимит бесплатных скачиваний (403 `free_limit_reached`, 3 в месяц).

### Где вызывается генерация

- Внутри `try` (1495) одна цепочка тернарников по `parsed.model`: `createVaseGeometry` → `createBoxGeometry` → `createLithophaneGeometry` → `createStandGeometry` → `createClipsGeometry` → `createPlanterGeometry` → `createCoasterGeometry` → `createJewelryStandGeometry` → `createPenHolderGeometry` → `createFabricPatchGeometry` → `createStringLightGeometry` → `createWallHookGeometry` → `createCupClipGeometry` → `createCipherBoxGeometry` → `createGiftBoxGeometry` → `createKeychainGeometry`, последняя ветка `else` — `createSignBlockGeometry`. Всего 17 ветвей.
- Шрифт грузится только трём моделям — брелоку, вывеске и шкатулке с кодом; `loadFont` кэширует промис по URL в `fontPromises` (1321).
- Дальше `new Mesh(geometry)`, `mesh.updateMatrixWorld(true)`, `STLExporter().parse(mesh, { binary: true })`, байты в `Uint8Array`. В `finally` — `geometry.dispose()` (1640).

### Как отдаётся ответ

- Статус 200, заголовки: `content-type: model/stl`, `content-disposition: attachment; filename="<имя>"`, `content-length`, `cache-control: private, no-store`, `x-content-type-options: nosniff` (1629–1638).
- Имя файла формируется отдельной цепочкой тернарников по `parsed.model` (1558–1595), 17 ветвей: `vaseStlFileName`, `keychainStlFileName`, `boxStlFileName`, `lithophaneStlFileName(params, part)`, `standStlFileName`, `clipsStlFileName`, `planterStlFileName`, `coasterStlFileName`, `jewelryStandStlFileName`, `penHolderStlFileName`, `fabricPatchStlFileName`, `stringLightStlFileName`, `wallHookStlFileName`, `cupClipStlFileName`, `cipherBoxStlFileName`, `giftBoxStlFileName`, последняя ветка `else` — `signStlFileName(params, block, part)`. Сами функции живут в `params.ts` и собирают имя из параметров модели латиницей.
- Перед отдачей файла: для Free-пользователя пишется строка в `constructor_downloads`; если запись не удалась — 500 `download_not_recorded` и файл не отдаётся. Затем `recordConstructorGeneration(user.id, parsed.model)` — аналитика, её ошибка ответ не меняет.
- Ошибки — `errorResponse(status, code, message)` (177); внешний `catch` — 500 `export_failed`.

## 3. `components/constructor/ParameterPanel.tsx`

### `MODEL_CARDS`

- Тип: `type ModelCard = { id: ModelType; icon: string; title: string }` (443).
- `const MODEL_CARDS: ModelCard[]` (445) — **17** записей: `vase` 🏺, `keychain` 🔑, `stand` 📱, `clips` 🧷, `sign` 🪧, `box` 📦, `lithophane` 🖼️, `planter` 🪴, `coaster` ☕, `jewelry_stand` 💍, `pen_holder` 🖊️, `fabric_patch` 🧵, `string_light` 💡, `wall_hook` 🪝, `cup_clip` 🍵, `cipher_box` 🔐, `gift_box` 🎁. `title` каждой карточки — ссылка на `MODEL_TYPE_LABELS.<id>`, порядок карточек не совпадает с порядком `MODEL_TYPES` (stand — третьим).
- `MODEL_OPTIONS` (475) — производный массив `{ label: "icon title", value: id }` для выпадающего списка моделей (`ParameterSelect`).

### Блок настроек

- Отдельных компонентов на модель нет. Есть один компонент `export function ParameterPanel({...})` (1093), который принимает `params: ConstructorParams` и длинный список колбэков: `onParamChange`, `onModelChange`, `onShapeChange`, `onPatternChange`, `onKeychainShapeChange`, `onKeychainPresetChange`, `onCustomSvgChange`, `onNfcChange`, `onHolePlacementChange`, `onQrCardSizeChange`, `onQrCardTabChange`, `onQrModeChange`, `onQrContentTypeChange`, `onQrContentChange`, `onQrNameChange`, `onQrPhoneChange`, `onTextChange`, `onSignTextChange`, `onSignFontChange`, `onSignChannelWidthChange`, `onSignBaseMountChange`, `onHasLidChange`, `onBoxCellsChange`, `onBoxPresetChange`, `onLithoFrameChange`, `onLithoMountChange`, `onLithophaneBrightnessChange`, `onPlanterShapeChange`, `onPlanterDrainageChange`, `onCoasterShapeChange`, `onCoasterPatternChange`, `onCoasterRimChange`, `onJewelryConfigChange`, `onPenShapeChange`, `onPatchShapeChange`, `onPatchBorderChange`, `onWallHookMountChange`, `onCupClipHookChange`, `onCipherWordChange`, `onCipherLidTextChange` и т.д.
- Настройки рендерятся одной цепочкой тернарников по `params.model` в JSX (1802 и далее): `vase` (1802), `keychain` (1890), `stand` (2310), `clips` (2347), `planter` (2385), `coaster` (2462), `jewelry_stand` (2540), `pen_holder` (2585), `fabric_patch` (2654), `string_light` (2730), `wall_hook` (2797), `cup_clip` (2854), `cipher_box` (2918), `gift_box` (3036), `box` (3147), `lithophane` (3337), последняя ветка `else` (3516) — `sign`. Итого 16 явных условий и `sign` как `else`.
- Внутри каждой ветки — те же примитивы: `NumberSlider` (числовые параметры из `CONSTRUCTOR_LIMITS`), `ParameterSelect` (перечисления и шрифты), чекбоксы (флаги), текстовые поля (санитайзер + `input`). Своих файлов у блоков нет.
- Вторая такая же цепочка — `summary` (1585): три «главных размера» модели для нижней сводки, 16 явных условий и `else` (1754 → 1773) для `sign`.
- `partsHeading` (1579) — заголовок «Детали модели» включается только для `sign` и `lithophane`.
- Кнопки экспорта — `ExportButtons` (347) и `ExportErrorAlert` (308); варианты файлов приходят сверху через `exportOptions`, собранные `buildExportOptions` в `ConstructorClient.tsx` (242).

### Признаки загрузки файла в панели

В `ParameterPanel` два скрытых `input type="file"`:

1. строка 2056 — `accept=".svg,.png,.jpg,.jpeg"`, `id={keychainContourInputId}`, `onChange={handleKeychainContourChange}` (1273), блок «Свой контур» внутри ветки `keychain`. Результат чтения — SVG-строка, которая уходит наверх через `onCustomSvgChange` и лежит в `params.customSvgData`. Рядом кнопка «Сбросить» (`resetKeychainContour`, 1313).
2. строка 3375 — `accept="image/*"`, `id={lithophaneInputId}`, `onChange={handleLithophaneImageChange}` (1235), блок «Фотография» внутри ветки `lithophane`. Файл сжимается в браузере до сетки 400 × 400 (`compressLithophaneImage`, 586), наверх уходит массив яркости через `onLithophaneBrightnessChange`, лежит в `params.lithophaneBrightness`. Флаг «фото загружено» — сравнение ссылок с `DEFAULT_LITHOPHANE_PARAMS.lithophaneBrightness` (`hasUploadedImage`, 1225).

Оба входа устроены одинаково: скрытый `input` + `label` с `htmlFor` (кнопка-подпись). Drag-and-drop зоны, `onDrop`, `onDragOver` в панели нет.

## 4. `components/constructor/Viewport.tsx`

### Как получает геометрию

- Пропсы: `type ViewportProps = { params: ConstructorParams }` (55) — единственный вход. В файле нет `fetch`, нет обращений к API: грепом находятся только `useState` для шрифта (955–956).
- Геометрия строится в браузере в `useMemo` (1021) цепочкой `if` по `params.model`: `createKeychainGeometry`, `createStandGeometry`, `createClipsGeometry`, `createSignGeometry`, `createBoxGeometry`, `createLithophaneGeometry` (с уменьшенной копией яркости `LITHOPHANE_PREVIEW_RESOLUTION`), `createPlanterGeometry`, `createCoasterGeometry`, `createJewelryStandGeometry`, `createPenHolderGeometry`, `createFabricPatchGeometry`, `createStringLightGeometry`, `createWallHookGeometry`, `createCupClipGeometry`, `createCipherBoxGeometry`, `createGiftBoxGeometry`, иначе `createVaseGeometry(createVaseProfile(params), params)`. 16 явных ветвей + ваза как fallback.
- Шрифт: `fontUrl` (942) выбирается для `sign` (по `params.signFont`), `keychain` и `cipher_box`; остальным `null`. Загрузка асинхронная, состояние `loaded`/`fontFailed`.
- Сцена: `Scene({ params, geometry, framing })` (752) — цепочка тернарников по `params.model` с обёртками `VaseModel`, `KeychainModel`, `StandModel`, `ClipsModel`, `BoxModel`, `LithophaneModel`, `ZUpModel` (десять моделей: planter, coaster, jewelry_stand, pen_holder, fabric_patch, string_light, wall_hook, cup_clip, cipher_box, gift_box), `SignModel` в `else`. Всего 8 компонентов-обёрток.
- `Viewport` монтируется в `ConstructorClient` через `next/dynamic` с `ssr: false` (`ConstructorClient.tsx` 393, использование — 1232).

### Ветка «плоских» моделей

- В `Framing` есть поле `flat: boolean` (73): «модель лежит на столе: камера смотрит круче».
- `framing` (1105) считает габариты: `vase` — из слайдеров, `flat: false` (1110); `keychain` — `height: params.thickness`, `footprint: max(length, width)`, **`flat: true`** (1118) — единственное `true` во всём файле; группа из 12 Z-вверх моделей (stand, clips, planter, coaster, jewelry_stand, pen_holder, fabric_patch, string_light, wall_hook, cup_clip, cipher_box, gift_box) — по `computeBoundingBox`, `flat: false` (1149); `box` — по bounding box, `flat: false` (1164); `lithophane` — отдельно для `lithoMount === "stand"` (1182) и без крепления (1189), `flat: false`; финальный fallback (sign) — по bounding box, `flat: false` (1199).
- Камера: `CameraRig` (125) получает `flat`; при `false` используется `INITIAL_DIRECTION` (90), при `true` — `FLAT_DIRECTION` (97, взгляд круче сверху).
- Ориентация моделей в сцене: `ZUpModel` (543) ставит Z-вверх геометрию на стол поворотом `rotation={[-Math.PI / 2, 0, 0]}`; `KeychainModel`, `BoxModel`, `LithophaneModel`, `SignModel` — свои обёртки со своими поворотами и материалами.
- Литофан описан в коде как печатаемая плашмя деталь («Рельеф смотрит вверх: плита, рамка и подставка печатаются плашмя» — `ParameterPanel.tsx` 3511), в сцене он стоит лицевой стороной к камере (`LithophaneModel`, 608).

## 5. Загрузка файлов

Загрузка файлов в Конструктор есть, но только в двух местах и только в браузере:

- `ParameterPanel.tsx` 2056 — контур брелока: `accept=".svg,.png,.jpg,.jpeg"`, `handleKeychainContourChange` (1273) → `readFileAsText` (672) / `readFileAsDataUrl` (691) + `rasterToContourSvg` (748) / `keychainContourFromFile` (825) → строка SVG в `params.customSvgData`.
- `ParameterPanel.tsx` 3375 — фото литофана: `accept="image/*"`, `handleLithophaneImageChange` (1235) → `compressLithophaneImage` (586) через canvas → `number[]` в `params.lithophaneBrightness`.

Файлы никуда не отправляются и не хранятся отдельно: результат чтения сразу превращается в поле `ConstructorParams` (строка SVG или массив 160 000 чисел).

Грепы по `components/constructor/` и `lib/constructor/`:

- `type="file"` — 2 вхождения (`ParameterPanel.tsx` 2063, 3382);
- `FileReader` — 2 (`ParameterPanel.tsx` 674, 693, внутри `readFileAsText` / `readFileAsDataUrl`);
- `drop` / `drag` — совпадений по смыслу загрузки нет; слово `drop` встречается только как локальная переменная в геометрии (`keychain-preset-geometry.ts` 516–520, `qr-card-geometry.ts` 698–704);
- `upload` — только `hasUploadedImage` (флаг литофана), `Upload`-компонентов нет.

Серверный приём файлов: в `app/api/constructor/stl/route.ts` тело читается как JSON, файлов не принимает — только отдаёт STL. Других роутов в `app/api/constructor` нет (единственный файл — `stl/route.ts`).

Пользовательские данные, которые сохраняются: server action `saveConstructorProject` (`app/actions/projects.ts` 66) пишет в таблицу `saved_projects` поля `title`, `model_type`, `params_json` (110). Чтение — `getSavedProjects` / `getSavedProject` (`lib/constructor/project-store.ts` 36, 81), при чтении `params_json` проходит через `normalizeSavedProjectParams` (`lib/constructor/projects.ts` 120) → `normalizeConstructorParams`. То есть весь ввод пользователя, включая SVG-строку и массив яркости, лежит внутри `params_json`. Вызов сохранения — `SaveProjectDialog` (`components/constructor/SaveProjectDialog.tsx` 129).

## 6. Цифры

| Что | Сколько |
| --- | --- |
| `MODEL_TYPES` | 17 |
| `MODEL_TYPE_LABELS` | 17 |
| `CONSTRUCTOR_TOOLS` | 17 |
| `DEFAULT_*_PARAMS` (по одному на модель) | 17 |
| `normalizeXxxParams` моделей | 17 |
| `MODEL_DEFAULT_PARAMS` в `ConstructorClient.tsx` | 17 |
| `MODEL_CARDS` в `ParameterPanel.tsx` | 17 |
| `parse*Params` в `route.ts` | 17 |
| Ветвей в `parseConstructorRequest` | 17 (+ `return null` в конце) |
| Ветвей генерации STL в `route.ts` | 17 |
| Ветвей имени файла в `route.ts` | 17 |
| Ветвей `geometry` в `Viewport.tsx` | 16 `if` + ваза как fallback |
| Ветвей `Scene` в `Viewport.tsx` | 16 условий + `SignModel` как `else` |
| Ветвей блока настроек в `ParameterPanel.tsx` | 16 условий + `sign` как `else` |
| Моделей с `flat: true` в `Viewport.tsx` | 1 (`keychain`) |
| `input type="file"` в Конструкторе | 2 |
| Строк: `params.ts` / `route.ts` / `ParameterPanel.tsx` / `Viewport.tsx` | 3046 / 1651 / 3764 / 1331 |

## Проверки

- `npm run check:docs` — зелёный (только чтение).
- `git status` — единственный новый файл `heat-transfer-audit.md`.
- Код приложения не изменялся: правок в `params.ts`, `route.ts`, `ParameterPanel.tsx`, `Viewport.tsx` и других исходниках нет.




