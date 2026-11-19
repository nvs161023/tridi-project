# Источники и версии профилей

Все профили зафиксированы на конкретных commit SHA. Дата сверки — 18.11.2026.
Если обновляете профиль, меняйте и таблицу, и commit в шапке INI-файла.

## Bambu Lab X1 Carbon

- Репозиторий: [DRIgnazGortngschirl/bambulab-studio-orca-slicer-presets](https://github.com/DRIgnazGortngschirl/bambulab-studio-orca-slicer-presets)
- Commit: `2d5b8abf862fc69d91f355cc723be8c0dc41d04e` (19.08.2026)
- Лицензия: AGPL-3.0 (`LICENSE` в корне репозитория)
- Формат: JSON Bambu Studio / OrcaSlicer

| Файл в библиотеке | Путь в источнике |
| --- | --- |
| `profiles/printers/bambu-lab-x1c/Bambu Lab X1 Carbon 0.4 nozzle - REDUCE CURRENT.json` | `machine/Bambu Lab X1 Carbon 0.4 nozzle - REDUCE CURRENT.json` |
| `profiles/printers/bambu-lab-x1c/Bambu Lab X1 Carbon 0.4 nozzle - REDUCE PURGE.json` | `machine/Bambu Lab X1 Carbon 0.4 nozzle - REDUCE PURGE.json` |
| `profiles/process/bambu-lab-x1c/0.20mm Standard @BBL X1C - SLOWED.json` | `process/0.20mm Standard @BBL X1C - SLOWED.json` |

Это community-пресеты, а не официальный репозиторий Bambu Lab. Оба варианта
принтера отличаются стратегией очистки сопла (`REDUCE CURRENT` и
`REDUCE PURGE`); процесс `SLOWED` — замедленная версия стандартного 0.20 мм.

## Prusa MK3S+

- Репозиторий: [prusa3d/PrusaSlicer-settings-prusa-fff](https://github.com/prusa3d/PrusaSlicer-settings-prusa-fff)
- Commit: `c712aaf177a915da19acad20262ab9379010b3aa` (15.10.2026)
- Бандл: `PrusaResearch/2.5.12.ini`
- Лицензия: отдельный файл лицензии в репозитории не заявлен; это официальные
  профили Prusa Research. Старый репозиторий
  [prusa3d/PrusaSlicer-settings](https://github.com/prusa3d/PrusaSlicer-settings)
  распространялся под AGPL-3.0 и больше не обновляется для новых версий.
- Формат: INI PrusaSlicer, по одной секции на файл

| Файл в библиотеке | Секция в бандле |
| --- | --- |
| `profiles/printers/prusa-mk3s-plus/Original Prusa i3 MK3S & MK3S+.ini` | `[printer:Original Prusa i3 MK3S & MK3S+]` |
| `profiles/process/prusa-mk3s-plus/0.20mm QUALITY @MK3.ini` | `[print:0.20mm QUALITY @MK3]` |
| `profiles/filaments/prusa/Prusament PLA.ini` | `[filament:Prusament PLA]` |

Секции вынуты без изменения настроек. В каждом файле сохранён исходный
`inherits`, поэтому это фрагменты бандла, а не самостоятельные конфиги:
`printer` наследует `Original Prusa i3 MK3`, процесс — `*0.20mm*` и `*MK3*`,
филамент — `*PLA*`. Для импорта нужен установленный бандл `PrusaResearch`
версии 2.5.12 или новее с теми же базовыми секциями.

## Voron 2.4

- Репозиторий: [OrcaSlicer/OrcaSlicer](https://github.com/OrcaSlicer/OrcaSlicer)
- Commit: `1ee0b730a1e6484e55a631dd567b41c986fc1d6a` (17.10.2026)
- Лицензия: AGPL-3.0
- Формат: JSON OrcaSlicer
- Каталог: `resources/profiles/Voron`

| Файл в библиотеке | Путь в источнике |
| --- | --- |
| `profiles/printers/voron-2.4/Voron 2.4 300 0.4 nozzle.json` | `resources/profiles/Voron/machine/Voron 2.4 300 0.4 nozzle.json` |
| `profiles/process/voron-2.4/0.20mm Standard @Voron.json` | `resources/profiles/Voron/process/0.20mm Standard @Voron.json` |
| `profiles/process/voron-2.4/0.24mm Draft @Voron.json` | `resources/profiles/Voron/process/0.24mm Draft @Voron.json` |

Почему не VoronUsers: в [VoronDesign/VoronUsers](https://github.com/VoronDesign/VoronUsers)
и форке [hartk1213/VoronUsers](https://github.com/hartk1213/VoronUsers) лежат
модели деталей, моды и bed shape для V0, но нет профилей Voron 2.4 для
слайсера. Профиль машины в Orca наследует `fdm_klipper_common`, а
`printer_model: Voron 2.4 300` ссылается на описание модели; и то и другое
остаётся в системной библиотеке OrcaSlicer.

## Anycubic, Elegoo, Sovol, Artillery, Flashforge, Qidi

- Репозиторий: [OrcaSlicer/OrcaSlicer](https://github.com/OrcaSlicer/OrcaSlicer)
- Commit: `06665d05582f29acc84cb63cfeb1f719a7f904fd` (18.10.2026)
- Лицензия: AGPL-3.0
- Формат: JSON OrcaSlicer
- Каталоги: `resources/profiles/Anycubic`, `Elegoo`, `Sovol`, `Artillery`,
  `Flashforge`, `Qidi`
- В библиотеке: 86 профилей машин и 86 процессов.

Для этих брендов взяты все профили машин с соплом 0.4 и их штатный
`default_print_profile` (в основном `0.20mm Standard`). Файлы лежат в
`profiles/printers/<бренд>/` и `profiles/process/<бренд>/`; имена сохранены
байт-в-байт. Вложенные серии Elegoo (`EN4SERIES`, `ECC` и другие) схлопнуты
в один каталог бренда. Процессы, совместимые сразу с двумя моделями, хранятся
одним файлом и описаны в каталоге для каждой модели.

## Обновление от 18.11.2026: Prusa, Creality, Anker, FLSun, TwoTrees, Kingroon, Voron Trident

- Репозиторий: [OrcaSlicer/OrcaSlicer](https://github.com/OrcaSlicer/OrcaSlicer)
- Commit: `4f71398a0fc9719aeda72cc6a32997f304ca9da9` (18.11.2026)
- Лицензия: AGPL-3.0
- Формат: JSON OrcaSlicer
- Каталоги: `resources/profiles/Prusa`, `Creality`, `Anker`, `Qidi`, `FLSun`,
  `TwoTrees`, `Kingroon`, `Voron`
- В библиотеке: 15 профилей машин и 15 записей процессов. Скопировано 13 новых
  файлов процессов: M5 и M5C делят один файл, а Trident использует уже
  существующий `0.20mm Standard @Voron` от Voron 2.4.

| Принтер | Файл в библиотеке | Процесс |
| --- | --- | --- |
| Prusa MK4S | `profiles/printers/prusa/Prusa MK4S 0.4 nozzle.json` | `0.20mm SPEED @MK4S 0.4` |
| Prusa CORE One | `profiles/printers/prusa/Prusa CORE One 0.4 nozzle.json` | `0.20mm SPEED @CORE One 0.4` |
| Prusa XL 5T | `profiles/printers/prusa/Prusa XL 5T 0.4 nozzle.json` | `0.20mm Speed @Prusa XL 5T 0.4` |
| Creality K1C | `profiles/printers/creality/Creality K1C 0.4 nozzle.json` | `0.20mm Standard @Creality K1C` |
| Creality K2 Plus | `profiles/printers/creality/Creality K2 Plus 0.4 nozzle.json` | `0.16mm Optimal @Creality K2 Plus 0.4 nozzle` |
| Creality Ender-3 V3 KE | `profiles/printers/creality/Creality Ender-3 V3 KE 0.4 nozzle.json` | `0.20mm Standard @Creality Ender3V3KE` |
| Creality Ender-3 V3 SE | `profiles/printers/creality/Creality Ender-3 V3 SE 0.4 nozzle.json` | `0.20mm Standard @Creality Ender3V3SE 0.4` |
| Creality Hi | `profiles/printers/creality/Creality Hi 0.4 nozzle.json` | `0.20mm Standard @Creality Hi` |
| Anker M5 | `profiles/printers/anker/Anker M5 0.4 nozzle.json` | `0.20mm Standard @Anker` |
| Anker M5C | `profiles/printers/anker/Anker M5C 0.4 nozzle.json` | `0.20mm Standard @Anker` |
| Qidi X-Smart 5 | `profiles/printers/qidi/Qidi X-Smart 5 0.4 nozzle.json` | `0.20mm Standard @X-Smart 5` |
| FLSun T1 | `profiles/printers/flsun/FLSun T1 0.4 nozzle.json` | `0.20mm Standard @FLSun T1` |
| TwoTrees SK1 | `profiles/printers/twotrees/TwoTrees SK1 0.4 nozzle.json` | `0.20mm Standard @SK1` |
| Kingroon KP3S PRO V2 | `profiles/printers/kingroon/Kingroon KP3S PRO V2 0.4 nozzle.json` | `0.20mm Standard @Kingroon KP3S PRO V2` |
| Voron Trident 300 | `profiles/printers/voron-trident/Voron Trident 300 0.4 nozzle.json` | `0.20mm Standard @Voron` (общий с Voron 2.4) |

Имена файлов сохранены. Для Prusa, Creality, Anker, Qidi, FLSun, TwoTrees и
Kingroon путь машины в источнике — `resources/profiles/<Brand>/machine/<имя>`,
процесса — `resources/profiles/<Brand>/process/<имя>`. Для Voron Trident:
`resources/profiles/Voron/machine/Voron Trident 300 0.4 nozzle.json` и
`resources/profiles/Voron/process/0.20mm Standard @Voron.json`.

Официальные BBL-профили A1, P1S, X1 Carbon и H2D не добавлены: их machine JSON
ссылается на 5–6 отдельных `include`-файлов с G-code, а карточка библиотеки
отдаёт один файл. Без этих шаблонов импорт получится неполным, поэтому BBL
оставлен на отдельный формат «пакет профилей».

## Generic ABS, ASA, TPU и PA

- Репозиторий: [OrcaSlicer/OrcaSlicer](https://github.com/OrcaSlicer/OrcaSlicer)
- Commit: `06665d05582f29acc84cb63cfeb1f719a7f904fd` (18.10.2026)
- Лицензия: AGPL-3.0
- Формат: JSON OrcaSlicer
- Каталог: `resources/profiles/OrcaFilamentLibrary/filament`

| Файл в библиотеке | Путь в источнике |
| --- | --- |
| `profiles/filaments/generic/Generic ABS @System.json` | `.../filament/Generic ABS @System.json` |
| `profiles/filaments/generic/Generic ASA @System.json` | `.../filament/Generic ASA @System.json` |
| `profiles/filaments/generic/Generic TPU @System.json` | `.../filament/Generic TPU @System.json` |
| `profiles/filaments/generic/Generic PA @System.json` | `.../filament/Generic PA @System.json` |

Это системные пресеты OrcaSlicer: они наследуют `fdm_filament_abs`,
`fdm_filament_asa`, `fdm_filament_tpu` и `fdm_filament_pa` из системной
библиотеки слайсера. Отдельные `@base`-файлы для них не нужны.

## Creality Ender-3 и Anycubic Kobra

- Репозиторий: [OrcaSlicer/OrcaSlicer](https://github.com/OrcaSlicer/OrcaSlicer)
- Commit: `1ee0b730a1e6484e55a631dd567b41c986fc1d6a` (17.10.2026)
- Лицензия: AGPL-3.0
- Формат: JSON OrcaSlicer
- Каталоги: `resources/profiles/Creality` и `resources/profiles/Anycubic`

| Файл в библиотеке | Путь в источнике |
| --- | --- |
| `profiles/printers/creality-ender-3/Creality Ender-3 0.4 nozzle.json` | `resources/profiles/Creality/machine/Creality Ender-3 0.4 nozzle.json` |
| `profiles/process/creality-ender-3/0.20mm Standard @Creality Ender3.json` | `resources/profiles/Creality/process/0.20mm Standard @Creality Ender3.json` |
| `profiles/printers/anycubic-kobra/Anycubic Kobra 0.4 nozzle.json` | `resources/profiles/Anycubic/machine/Anycubic Kobra 0.4 nozzle.json` |
| `profiles/process/anycubic-kobra/0.20mm Standard @Anycubic Kobra.json` | `resources/profiles/Anycubic/process/0.20mm Standard @Anycubic Kobra.json` |

Оба профиля машины рассчитаны на стол 220 × 220 мм, высоту 250 мм и сопло
0.4 мм. Ender-3 наследует `fdm_creality_common`, Kobra — `fdm_machine_common`;
процессы ссылаются на `fdm_process_creality_common` и `fdm_process_common`
соответственно. Базовые пресеты остаются в системной библиотеке OrcaSlicer.

## Polymaker

- Репозиторий: [OrcaSlicer/OrcaSlicer](https://github.com/OrcaSlicer/OrcaSlicer)
- Commit: `1ee0b730a1e6484e55a631dd567b41c986fc1d6a` (18.10.2026)
- Лицензия: AGPL-3.0 (файлы входят в состав OrcaSlicer)
- Формат: JSON OrcaSlicer
- Каталог: `resources/profiles/OrcaFilamentLibrary/filament/Polymaker`

| Файл в библиотеке | Путь в источнике |
| --- | --- |
| `profiles/filaments/polymaker/PolyLite PLA @base.json` | `.../Polymaker/PolyLite PLA @base.json` |
| `profiles/filaments/polymaker/PolyLite PLA @System.json` | `.../Polymaker/PolyLite PLA @System.json` |
| `profiles/filaments/polymaker/PolyLite PETG @base.json` | `.../Polymaker/PolyLite PETG @base.json` |
| `profiles/filaments/polymaker/PolyLite PETG @System.json` | `.../Polymaker/PolyLite PETG @System.json` |

`@base` — абстрактная основа (`instantiation: "false"`), `@System` — выбираемый
пресет, который её наследует. Официальные профили Polymaker также доступны на
сайте производителя в разделе
[Print Profiles](https://polymaker.com/download-category/print-profiles-downloads/),
но скачиваются вручную и зависят от принтера/слайсера; в первый этап они не
включены.

## Рассмотренные, но не включённые источники

| Источник | Почему не включён |
| --- | --- |
| [SimplyPrint/slicer-profiles-db](https://github.com/SimplyPrint/slicer-profiles-db) | Открытая база профилей для нескольких слайсеров; хороший кандидат на следующий этап, но формат требует отдельного маппинга. |
| [raporter1992/Polymaker-3dPrinting-Calibrated-Filament-Profiles](https://github.com/raporter1992/Polymaker-3dPrinting-Calibrated-Filament-Profiles) | Профили откалиброваны под MK4S / Core One, а не под MK3S+; лицензия CC BY-SA 4.0 требует отдельной атрибуции. |
| [Polymaker: Print Profiles](https://polymaker.com/download-category/print-profiles-downloads/) | Официальные файлы отдаются через интерактивную загрузку; в первом этапе использованы нормализованные пресеты из OrcaSlicer. |
| [PrusaSlicer-settings (legacy)](https://github.com/prusa3d/PrusaSlicer-settings) | Не обновляется для PrusaSlicer 2.8+; актуальные профили лежат в `PrusaSlicer-settings-prusa-fff`. |

## Как воспроизвести

```bash
git clone --depth 1 https://github.com/DRIgnazGortngschirl/bambulab-studio-orca-slicer-presets.git
git clone --depth 1 --filter=blob:none --sparse https://github.com/OrcaSlicer/OrcaSlicer.git
git -C OrcaSlicer sparse-checkout set resources/profiles/Anycubic/machine resources/profiles/Anycubic/process resources/profiles/Elegoo/machine resources/profiles/Elegoo/process resources/profiles/Sovol/machine resources/profiles/Sovol/process resources/profiles/Artillery/machine resources/profiles/Artillery/process resources/profiles/Flashforge/machine resources/profiles/Flashforge/process resources/profiles/Qidi/machine resources/profiles/Qidi/process resources/profiles/Prusa/machine resources/profiles/Prusa/process resources/profiles/Creality/machine resources/profiles/Creality/process resources/profiles/Anker/machine resources/profiles/Anker/process resources/profiles/FLSun/machine resources/profiles/FLSun/process resources/profiles/TwoTrees/machine resources/profiles/TwoTrees/process resources/profiles/Kingroon/machine resources/profiles/Kingroon/process resources/profiles/Voron/machine resources/profiles/Voron/process resources/profiles/OrcaFilamentLibrary/filament
git clone --depth 1 https://github.com/prusa3d/PrusaSlicer-settings-prusa-fff.git
```

Для Prusa секции извлекаются из `PrusaResearch/2.5.12.ini` по заголовкам
`[printer:...]`, `[print:...]`, `[filament:...]`; в полученный файл
добавляются только комментарии с источником и commit. Для Orca/Bambu файлы
копируются байт-в-байт, без переформатирования JSON.

Для брендов из OrcaSlicer берутся файлы машин с соплом 0.4 и процесс с именем
из `default_print_profile` этой машины. Вложенные каталоги Elegoo обходятся
рекурсивно. Для Prusa CORE One процесс наследует `0.20mm SPEED @MK4S 0.4`, а
машина — `Prusa CORE One HF 0.4 nozzle`; эти базовые профили остаются в
системной библиотеке слайсера. `.ini` для PrusaSlicer и старые ручные профили
при повторном импорте не перезаписываются.
