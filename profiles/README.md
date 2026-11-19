# Библиотека профилей печати

Курируемый склад профилей принтеров, материалов и настроек печати для слайсеров.
Сейчас в библиотеке **223 профиля**: 107 принтеров, 107 процессов и 9 материалов.
Основу составляют официальные профили OrcaSlicer для Anycubic, Elegoo, Sovol,
Artillery, Flashforge, Qidi, Anker, FLSun, TwoTrees и Kingroon, а также Bambu
Lab X1 Carbon, Prusa MK3S+/MK4S/CORE One/XL 5T, Voron 2.4/Trident, Creality
Ender-3/K1C/K2 Plus/Ender-3 V3/Hi и Anycubic Kobra.
Точные источники, версии и лицензии — в [`SOURCES.md`](./SOURCES.md).

> Библиотека подключена к приложению: каталог `data/profiles.json` строит карточки на
> `/profiles`, а файлы отдаёт `/api/profiles/download` только при активной подписке Pro.
> При добавлении профиля обновляйте метаданные и файл вместе.

## Структура

```
profiles/
├── README.md
├── SOURCES.md
├── printers/
│   ├── anker/            # 2 модели, сопло 0.4
│   ├── anycubic/         # 20 моделей, сопло 0.4
│   ├── anycubic-kobra/   # ручной профиль первого этапа
│   ├── artillery/        # 10 моделей
│   ├── bambu-lab-x1c/
│   ├── creality/         # 5 моделей: K1C, K2 Plus, Ender-3 V3, Hi
│   ├── creality-ender-3/
│   ├── elegoo/           # 18 моделей
│   ├── flashforge/       # 13 моделей
│   ├── flsun/            # T1
│   ├── kingroon/         # KP3S PRO V2
│   ├── prusa/            # MK4S, CORE One, XL 5T
│   ├── prusa-mk3s-plus/
│   ├── qidi/             # 13 моделей
│   ├── sovol/            # 13 моделей
│   ├── twotrees/         # SK1
│   ├── voron-2.4/
│   └── voron-trident/
├── process/
│   ├── anker/            # штатный процесс M5/M5C
│   ├── anycubic/         # штатный процесс каждой модели
│   ├── anycubic-kobra/
│   ├── artillery/
│   ├── bambu-lab-x1c/
│   ├── creality/         # штатные процессы новых моделей
│   ├── creality-ender-3/
│   ├── elegoo/
│   ├── flashforge/
│   ├── flsun/
│   ├── kingroon/
│   ├── prusa/            # процессы MK4S, CORE One, XL 5T
│   ├── prusa-mk3s-plus/
│   ├── qidi/
│   ├── sovol/
│   ├── twotrees/
│   └── voron-2.4/        # Standard и Draft; Standard общий для Trident
└── filaments/
    ├── generic/          # Generic ABS, ASA, TPU и PA @System
    ├── polymaker/
    └── prusa/
```

Для Anycubic, Elegoo, Sovol, Artillery, Flashforge и Qidi лежат все профили
машин с соплом 0.4 из OrcaSlicer; для Prusa, Creality, Anker, FLSun, TwoTrees
и Kingroon — выбранные современные модели. У каждой машины добавлен штатный
`default_print_profile`. Для Elegoo исходные подпапки серий схлопнуты в один
каталог; имена файлов сохранены.

Правило именования: `<тип>/<принтер или производитель>/<исходное имя файла>`.
Имя профиля внутри файла не переводится и не сокращается, иначе рвётся `inherits`
и ссылки в `compatible_printers_condition`.

## Форматы

### OrcaSlicer и Bambu Studio — JSON

Один профиль — один JSON-объект. Общие поля:

- `type` — `machine`, `process` или `filament` (у пользовательских экспортов
  Bambu Studio поле может отсутствовать — тип определяется папкой и импортом);
- `name` — имя пресета, на которое ссылаются другие профили;
- `from` — откуда пресет (`system`, `User`, `default`; регистр зависит от
  слайсера);
- `inherits` — имя базового профиля, у которого берутся недостающие ключи;
- `instantiation` — `"false"` у абстрактных профилей (например, `@base`);
- настройки слайсера — скаляры, строки, массивы (для векторных значений вроде
  `nozzle_diameter`, `bed_shape`, `compatible_printers`).

Важно: массивы в Orca/Bambu — это вектор, а не «список допустимых значений».
Нельзя заменять `"nozzle_diameter": ["0.4"]` на `"nozzle_diameter": "0.4"`.

`@base` — абстрактная основа материала, `@System` — выбираемый системный пресет,
который наследует `@base`. В библиотеке лежат обе части, иначе `@System` неполон.

### PrusaSlicer — INI

Одна секция на файл:

```ini
[printer:Original Prusa i3 MK3S & MK3S+]
inherits = Original Prusa i3 MK3
...
```

Типы секций: `printer:`, `print:`, `filament:`. Комментарии начинаются с `#`,
настройки записываются как `key = value`. Векторные значения — через запятую.

Файлы MK3S+ вынуты из официального бандла `PrusaResearch/2.5.12.ini`
(`prusa3d/PrusaSlicer-settings-prusa-fff`). Это фрагменты, а не резолвнутые
конфиги: `inherits` сохранён, базовые секции вида `Original Prusa i3 MK3`,
`*0.20mm*`, `*MK3*` и `*PLA*` остаются в системном бандле PrusaSlicer.
При импорте отдельного файла слайсер должен видеть этот бандл, иначе часть
настроек не подхватится.

### Наследование

Все файлы — снимки исходных профилей, а не переписанные с нуля пресеты.
`inherits` не удаляется и не переименовывается. Если профиль нужно поправить
под себя, делайте копию с новым `name` и указывайте исходный профиль в
`inherits` — так обновление библиотеки не затрёт локальные правки.

## Что собрано

| Принтер | Профили принтера | Процессы | Материалы |
| --- | --- | --- | --- |
| Bambu Lab X1 Carbon, сопло 0.4 | `REDUCE CURRENT`, `REDUCE PURGE` | `0.20mm Standard - SLOWED` | — |
| Prusa — MK3S+, MK4S, CORE One, XL 5T | 4 профиля машин | 4 штатных процесса | `Prusament PLA` |
| Voron 2.4 300 и Trident 300, сопло 0.4 | 2 профиля машин | 3 процесса: `Standard` и `Draft`, общий `Standard` для Trident | — |
| Creality — Ender-3, K1C, K2 Plus, Ender-3 V3 KE/SE, Hi | 6 профилей машин | 6 штатных процессов | — |
| Anycubic Kobra, сопло 0.4 | `Anycubic Kobra 0.4 nozzle` | `0.20mm Standard @Anycubic Kobra` | — |
| Anycubic — 21 модель, сопло 0.4 | 21 профиль машин | 21 штатный процесс | Generic ABS/ASA/TPU/PA |
| Elegoo — 18 моделей, сопло 0.4 | 18 профилей машин | 18 штатных процессов | Generic ABS/ASA/TPU/PA |
| Sovol — 13 моделей, сопло 0.4 | 13 профилей машин | 13 штатных процессов | Generic ABS/ASA/TPU/PA |
| Artillery — 10 моделей, сопло 0.4 | 10 профилей машин | 10 штатных процессов | Generic ABS/ASA/TPU/PA |
| Flashforge — 13 моделей, сопло 0.4 | 13 профилей машин | 13 штатных процессов | Generic ABS/ASA/TPU/PA |
| Qidi — 13 моделей, сопло 0.4 | 13 профилей машин | 13 штатных процессов | Generic ABS/ASA/TPU/PA |
| Anker — M5, M5C, сопло 0.4 | 2 профиля машин | 2 процесса (общий `0.20mm Standard @Anker`) | Generic ABS/ASA/TPU/PA |
| FLSun — T1, сопло 0.4 | 1 профиль машины | 1 штатный процесс | Generic ABS/ASA/TPU/PA |
| TwoTrees — SK1, сопло 0.4 | 1 профиль машины | 1 штатный процесс | Generic ABS/ASA/TPU/PA |
| Kingroon — KP3S PRO V2, сопло 0.4 | 1 профиль машины | 1 штатный процесс | Generic ABS/ASA/TPU/PA |
| Универсальные | — | — | Polymaker `PolyLite PLA`, `PolyLite PETG` (`@base` + `@System`), Generic `ABS`, `ASA`, `TPU`, `PA` |

Итого 223 профиля: 107 принтеров, 107 процессов и 9 материалов.
Это не «лучшие настройки для вазы», а исходные заводские и community-пресеты:
перед печатью их нужно проверить на конкретном принтере и пластике.

## Как добавить профиль

1. Найдите официальный или upstream-источник. Приоритет: производитель
   принтера/пластика, затем профиль в OrcaSlicer или PrusaSlicer, затем
   сообщество с открытой лицензией.
2. Зафиксируйте commit SHA или версию бандла. Не берите профиль из `main`:
   без пина невозможно понять, что именно лежит в библиотеке.
3. Скачайте один профиль в исходном формате. Не редактируйте значения и
   `inherits`; для INI-секции из бандла добавьте только комментарии
   `# Source:`, `# Commit:`, `# Bundle:`, `# Section:`.
4. Положите файл в `<тип>/<принтер или производитель>/`, сохранив имя.
5. Добавьте запись в `data/profiles.json`: `id`, название, описание, слайсер,
   формат, базовый профиль в `requires` и путь к файлу в `file`. Для каскадного
   фильтра заполните `category` (`printer`, `material` или `process`),
   `manufacturer` (бренд или `Generic`), `model` (модель или `Universal`) и
   `material` (пластик или `Universal`). Без записи файл не появится на
   `/profiles` и не будет доступен для скачивания.
6. Проверьте формат: JSON должен парситься, INI — содержать ровно одну секцию
   нужного типа и ключ `inherits`, если он был в источнике.
7. Обновите таблицу выше и [`SOURCES.md`](./SOURCES.md); затем прогоните
   `npm run check:docs`.

Не коммитьте целые вендорские бандлы, `.3mf`-проекты, G-code и архивы:
в библиотеке должны лежать только отдельные профили и документация.

## Как использовать

- **OrcaSlicer / Bambu Studio.** Импортируйте JSON через меню пресетов
  (`File → Import → Import Configs` в OrcaSlicer; в Bambu Studio путь зависит
  от версии) или положите файл в пользовательскую папку пресетов. Сначала
  установите базовые системные профили, на которые ссылается `inherits`.
- **PrusaSlicer.** Импортируйте INI через `File → Import → Import Config`, либо
  скопируйте секцию в пользовательский конфиг. Базовый бандл `PrusaResearch`
  версии 2.5.12 должен быть установлен: без него фрагменты MK3S+ неполны.
- **Перед печатью.** Проверьте диаметр сопла, тип стола, температуру и
  максимальный объёмный расход. Все профили машин в каталоге рассчитаны на
  сопло 0.4 мм; у Voron 2.4 300 — стол 300 мм, у Trident 300 — 300 мм.

## Источники

Основные ссылки; точные пути, commit SHA и лицензии — в [`SOURCES.md`](./SOURCES.md).

- [Bambu Lab X1C presets](https://github.com/DRIgnazGortngschirl/bambulab-studio-orca-slicer-presets) —
  community-репозиторий пресетов Bambu Studio / OrcaSlicer.
- [PrusaSlicer vendor profiles](https://github.com/prusa3d/PrusaSlicer-settings-prusa-fff) —
  актуальный официальный бандл Prusa Research (2.5.12).
- [PrusaSlicer legacy settings](https://github.com/prusa3d/PrusaSlicer-settings) —
  старый репозиторий, больше не обновляется для новых версий.
- [OrcaSlicer](https://github.com/OrcaSlicer/OrcaSlicer) — профили принтеров,
  Voron и библиотека `OrcaFilamentLibrary`, включая Polymaker.
- [SimplyPrint slicer-profiles-db](https://github.com/SimplyPrint/slicer-profiles-db) —
  открытая база профилей для PrusaSlicer, Bambu Studio и OrcaSlicer; кандидат
  на следующий источник.
- [Polymaker: Print Profiles](https://polymaker.com/download-category/print-profiles-downloads/) —
  официальные профили производителя (интерактивная загрузка).
- [VoronUsers](https://github.com/VoronDesign/VoronUsers) — моды и печатные
  детали Voron, не профили слайсера.

### Про Voron

В `VoronDesign/VoronUsers` и его форке `hartk1213/VoronUsers` нет профилей
Voron 2.4 для слайсера: там лежат модели деталей, моды и bed shape для V0.
Поэтому профиль Voron 2.4 взят из `OrcaSlicer/OrcaSlicer`
(`resources/profiles/Voron`), а не из VoronUsers.

### Про Polymaker

Официальные профили Polymaker скачиваются с сайта вручную и зависят от
принтера/слайсера. В первом этапе взяты пресеты PolyLite PLA и PETG из
`OrcaFilamentLibrary` OrcaSlicer: они уже нормализованы под формат Orca и
содержат `@base`/`@System`. Это совместимый старт, но не замена официальной
таблице под конкретный принтер.

## Лицензии и атрибуция

- **Bambu presets** — AGPL-3.0 (лицензия репозитория).
- **OrcaSlicer** — AGPL-3.0; профили Voron и Polymaker распространяются в его
  составе.
- **PrusaSlicer vendor profiles** — отдельная лицензия в репозитории не
  заявлена; это официальные профили Prusa Research. Старый репозиторий
  `PrusaSlicer-settings` был AGPL-3.0.
- **SimplyPrint** — отдельная лицензия в репозитории не заявлена; профили не
  скопированы в первый этап, условия проверяйте перед добавлением.
- **Polymaker** — названия и профили принадлежат Polymaker; условия
  использования сайта и загружаемых файлов проверяйте перед публикацией.

При копировании файлов сохраняйте ссылку на источник и commit SHA. Если
профиль будет использоваться в продукте, проверьте совместимость лицензии
исходного репозитория с лицензией проекта.
