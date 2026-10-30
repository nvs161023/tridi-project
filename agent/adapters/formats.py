"""
Форматы файлов печати: имя на принтере, проверка формата, упаковка, MD5.

Модуль общий для всех адаптеров, хотя протоколы разные: правила одни и те же —
привести имя файла к безопасному виду, убедиться, что принтер такой файл
печатает, и довести его до печатаемого формата.

  - `sanitize_remote_name()` — имя файла на карте принтера. Creality теряет
    файл с пробелом в имени (`opGcodeFile` режет строку по пробелу), а `/` и
    `..` увели бы загрузку за пределы папки, поэтому имя приводится к ASCII и
    одному набору символов здесь, а не в каждом адаптере;
  - `ensure_format()` — формат, который принтер согласен печатать: Bambu не
    печатает плоский `.gcode` (он пакуется в контейнер `.3mf`), FlashForge
    берёт `.3mf` только с записями `3D/3dmodel.model` и
    `Metadata/plate_1.gcode` внутри, остальным нужен G-code;
  - `file_digest()` — MD5 файла: Anycubic и Elegoo сверяют его в командах
    печати, Bambu — в отчёте о загрузке.

Список форматов протокола живёт в справочнике (`registry.ProtocolSpec.formats`),
а не здесь: `registry` импортирует `base`, а `base` — этот модуль. Поэтому
`registry` читается внутри функции, иначе получилось бы кольцо импортов.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import tempfile
import zipfile
from typing import TYPE_CHECKING, Final

if TYPE_CHECKING:  # только для аннотаций: справочник тянет за собой адаптеры
    from .registry import ProtocolSpec

logger = logging.getLogger("agent.adapters.formats")

# Предел имени файла на принтере: 255 символов — столько принимают файловые
# системы принтеров и столько же прошивка показывает в списке файлов.
REMOTE_NAME_MAX: Final = 255

# Пробел в имени файла: Creality понимает только `_`, остальные протоколы — `-`.
CREALITY_SPACE: Final = "_"
DEFAULT_SPACE: Final = "-"

# Кириллица и прочие не-ASCII символы на карте принтера превращаются в вопрос:
# прошивки показывают `?` и не находят файл по имени. Поэтому в имени остаётся
# один набор символов, а всё прочее становится `_`.
_NOT_ASCII_NAME: Final = re.compile(r"[^A-Za-z0-9._-]+")
_SPACES: Final = re.compile(r"\s+")
_MULTI_UNDERSCORES: Final = re.compile(r"_+")

# Сколько читать за раз, считая MD5: файл задания бывает в сотни мегабайт, а
# держать его целиком в памяти незачем.
DIGEST_CHUNK: Final = 1024 * 1024


class FormatError(ValueError):
    """
    Файл не годится для этого принтера.

    Наследник ValueError: `upload_file()` адаптеров ловит его, кладёт текст в
    `last_error` и возвращает False, а main.py отправляет причину в мастерскую.
    Мастеру нужен именно этот текст («Creality (K1 / K2 / Hi) не печатает
    .3mf — переслайсите в .gcode»), а не «не удалось загрузить файл».
    """


def _basename(path: str) -> str:
    """
    Имя файла без папок: `cache/job.gcode` и `cache\\job.gcode` → `job.gcode`.

    `os.path.basename` на Linux не считает разделителем `\\`, а имя приходит и
    из задания, и из формы, поэтому оба вида разделителей приводятся к `/`.
    """
    return path.replace("\\", "/").rsplit("/", 1)[-1]


def file_extension(path: str) -> str:
    """
    Расширение файла в нижнем регистре: `.3MF` → `.3mf`.

    Пустая строка — расширения нет: такой файл не печатает ни один протокол, и
    проверка формата скажет об этом прямо.
    """
    return os.path.splitext(_basename(path))[1].lower()


def file_digest(path: str) -> str:
    """
    MD5 файла в hex: 32 символа, как их ждут Anycubic, Elegoo и Bambu.

    Считается потоком: файл печати весит десятки мегабайт, и читать его целиком
    в память ради хеша нельзя — на ферме из десятка принтеров это гигабайты.

    `usedforsecurity=False` нужен для сборок Python с FIPS: без него md5 в них
    запрещён. В Python 3.8 параметра ещё нет, поэтому вызов с откатом.
    """
    try:
        digest = hashlib.md5(usedforsecurity=False)
    except TypeError:  # Python 3.8: `usedforsecurity` появился в 3.9
        digest = hashlib.md5()

    try:
        with open(path, "rb") as handle:
            for chunk in iter(lambda: handle.read(DIGEST_CHUNK), b""):
                digest.update(chunk)
    except OSError as error:
        raise OSError(f"файл не прочитан для MD5: {error}") from error

    return digest.hexdigest()


def _is(protocol: str, expected: str) -> bool:
    """Ключ протокола без регистра и пробелов: `" BAMBU "` → `bambu`."""
    return (protocol or "").strip().lower() == expected


def sanitize_remote_name(protocol: str, name: str) -> str:
    """
    Безопасное имя файла на принтере: ASCII, без папок, до 255 символов.

    Что и зачем:

      - папки отбрасываются (`cache/job.gcode` → `job.gcode`): загрузка кладёт
        файл в свою папку, а путь в имени увёл бы его в чужую;
      - `..` схлопывается в `.`: имя с `..` означает выход из папки загрузки, и
        прошивка может отказать или записать файл куда не следует;
      - пробелы: Creality — `_`, остальные — `-`. Один и тот же файл на разных
        принтерах получает разные имена, но каждое читается прошивкой;
      - не-ASCII символы становятся `_`: кириллица на карте принтера — это `?` в
        списке файлов и «файл не найден» при старте печати;
      - длина ограничена `REMOTE_NAME_MAX` за счёт основы имени: расширение
        важнее, без него принтер не поймёт, чем печатать.

    Расширение в ответе в нижнем регистре (`.GCODE` → `.gcode`): `start_print()`
    ищет файл по имени, а регистр разные протоколы трактуют по-разному. Пустое
    после чистки имя становится `job` — прошивка не примет файл без имени.
    """
    base = _basename(name).strip()
    # Двойные точки убираем до разбора расширения: `..gcode` — это не `.gcode`.
    stem, extension = os.path.splitext(base.replace("..", "."))
    # Точка без расширения (`job.`) остаётся от имени, а файл с точкой на конце
    # Windows не создаст.
    extension = _NOT_ASCII_NAME.sub("", extension).lower().rstrip(".")
    space = CREALITY_SPACE if _is(protocol, "creality") else DEFAULT_SPACE
    stem = _SPACES.sub(space, stem)
    stem = _NOT_ASCII_NAME.sub("_", stem)
    stem = _MULTI_UNDERSCORES.sub("_", stem).strip("._-")

    # Расширению отдаём место первым: имя без него принтеру бесполезно.
    room = REMOTE_NAME_MAX - len(extension)

    if room <= 0:
        return "job"

    return f"{(stem or 'job')[:room]}{extension}"


# `param` команды печати Bambu для проекта `.3mf`: запись внутри файла, которую
# запускает прошивка. Именно это значение присылает Bambu Studio в `project_file`.
BAMBU_GCODE_PART: Final = "Metadata/plate_1.gcode"

# Запись с 3D-моделью внутри контейнера: путь фиксирован спецификацией 3MF, и
# прошивка ищет модель именно там, когда инициализирует проект.
BAMBU_MODEL_PART: Final = "3D/3dmodel.model"

# Записи OPC-пакета. Прошивка открывает `.3mf` как контейнер: без
# `[Content_Types].xml` и `_rels/.rels` это обычный ZIP, и `project_file` его не
# разбирает — так же, как раньше не разбирал плоский `.gcode`. Объявление
# `3D/3dmodel.model` обязательно: без него пакет не считается 3MF-моделью.
CONTENT_TYPES_XML: Final = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="gcode" ContentType="text/x.gcode"/>
<Default Extension="config" ContentType="text/xml"/>
<Override PartName="/3D/3dmodel.model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
"""

RELS_XML: Final = f"""<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Target="/{BAMBU_GCODE_PART}" Id="rel-0" Type="http://schemas.bambulab.com/package/2021/gcode"/>
<Relationship Target="/{BAMBU_MODEL_PART}" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
"""

# Минимальная 3D-модель без геометрии. Прошивка инициализирует проект по
# `3D/3dmodel.model` и без этой записи не берёт задание в работу, даже когда
# печатать нужно готовый G-code: `project_file` отвечает `success`, а принтер
# остаётся в `STANDBY`.
MODEL_XML: Final = """<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<resources></resources>
<build></build>
</model>
"""

# `Metadata/model_settings.config`: настройки объектов проекта. Объектов в нашем
# контейнере нет, поэтому файл пустой — прошивка читает его, но искать в нём
# нечего.
MODEL_SETTINGS_XML: Final = """<?xml version="1.0" encoding="UTF-8"?>
<config></config>
"""


def _slice_info_xml(remote_name: str) -> str:
    """
    `Metadata/slice_info.config` — минимум, который прошивка ищет в проекте.

    Времени и веса здесь нет (прошивка берёт их из самого G-code), но поля
    обязаны присутствовать: без `index` и `prediction` Bambu Studio считает
    проект недослицованным.
    """
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<config>\n"
        '<header><metadata name="BambuStudio:3mfVersion" value="1"/></header>\n'
        "<plate>\n"
        '<metadata name="index" value="1"/>\n'
        f'<metadata name="name" value="{remote_name}"/>\n'
        '<metadata name="prediction" value="0"/>\n'
        '<metadata name="weight" value="0"/>\n'
        "</plate>\n"
        "</config>\n"
    )


def discard(path: str) -> None:
    """Удаляет временный файл: его отсутствие задание не ломает."""
    try:
        os.remove(path)
    except OSError as error:
        logger.warning("временный файл %s не удалён: %s", path, error)


def wrap_gcode_to_3mf(gcode_path: str, remote_name: str) -> str:
    """
    Пакует сырой G-code в минимальный контейнер `.3mf`, путь — в ответе.

    Bambu A1 не печатает плоский `.gcode`: `gcode_file` он отклоняет на любых
    `param` и `url`, а `project_file` разбирает только проект. Поэтому файл
    становится записью `Metadata/plate_1.gcode` внутри контейнера, а рядом
    кладётся всё, что прошивка требует от 3MF-пакета:

      - `3D/3dmodel.model` — модель без геометрии (`MODEL_XML`): без неё
        `project_file` отвечает `success`, но задание в работу не берётся;
      - `Metadata/slice_info.config` — параметры площадки;
      - `Metadata/model_settings.config` — настройки объектов (пустые);
      - `[Content_Types].xml` и `_rels/.rels` — служебные записи OPC-пакета.

    Контейнер создаётся во временном каталоге и удаляется вызывающим
    (`discard`): сам файл задания остаётся на месте — по нему main.py считает
    оценку печати.
    """
    try:
        handle, path = tempfile.mkstemp(prefix="print-", suffix=".3mf")
    except OSError as error:
        raise OSError(f"временный файл не создан: {error}") from error

    os.close(handle)

    try:
        with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as project:
            project.write(gcode_path, BAMBU_GCODE_PART)
            project.writestr("Metadata/slice_info.config", _slice_info_xml(remote_name))
            project.writestr("Metadata/model_settings.config", MODEL_SETTINGS_XML)
            project.writestr(BAMBU_MODEL_PART, MODEL_XML)
            project.writestr("[Content_Types].xml", CONTENT_TYPES_XML)
            project.writestr("_rels/.rels", RELS_XML)
    except (OSError, zipfile.BadZipFile):
        discard(path)
        raise

    logger.info(
        "G-code %s упакован в контейнер %s (%d байт)",
        remote_name,
        path,
        os.path.getsize(path),
    )

    return path


# Пути записей внутри контейнера `.3mf` фиксированы спецификацией 3MF: модель
# лежит в `3D/3dmodel.model`, а готовый G-code слайсер кладёт в
# `Metadata/plate_1.gcode`. FlashForge читает проект по этим путям, и контейнер
# без них он принимает как файл, но печатать отказывается.
FLASHFORGE_MODEL_PART: Final = "3D/3dmodel.model"
FLASHFORGE_GCODE_PART: Final = "Metadata/plate_1.gcode"


def _spec(protocol: str) -> ProtocolSpec:
    """
    Паспорт протокола из справочника.

    Импорт внутри функции: `registry` импортирует `base`, а `base` — этот
    модуль, поэтому импорт на уровне модуля дал бы кольцо и падение агента при
    старте.
    """
    from .registry import get_protocol

    return get_protocol(protocol)


def _formats_hint(formats: tuple[str, ...]) -> str:
    """Перечисление форматов для текста отказа: `.gcode, .gco или .g`."""
    if len(formats) <= 2:
        return " или ".join(formats)

    return f"{', '.join(formats[:-1])} или {formats[-1]}"


def _require_flashforge_parts(path: str) -> None:
    """
    Проверяет, что `.3mf` — это проект с готовым G-code, а не модель.

    FlashForge печатает контейнер только тогда, когда внутри есть и модель
    (`3D/3dmodel.model`), и нарезанный G-code (`Metadata/plate_1.gcode`).
    Контейнер из одного слайсера-модели (PrusaSlicer, «Сохранить как 3MF»)
    проходит по расширению, но печатать его нельзя: принтер ответит отказом
    уже после загрузки, а мастер увидит «задание в очереди» без объяснения.
    Поэтому отказ приходит здесь и говорит, чего в файле нет.
    """
    try:
        with zipfile.ZipFile(path) as container:
            parts = set(container.namelist())
    except (OSError, zipfile.BadZipFile) as error:
        raise FormatError(f"контейнер .3mf не прочитан: {error}") from error

    missing = [
        part
        for part in (FLASHFORGE_MODEL_PART, FLASHFORGE_GCODE_PART)
        if part not in parts
    ]

    if missing:
        raise FormatError(
            "FlashForge печатает только проект .3mf с готовым G-code: "
            f"в контейнере нет {', '.join(missing)} — переслайсите модель "
            "в слайсере и загрузите файл заново"
        )


def ensure_format(
    protocol: str, local_path: str, remote_name: str = ""
) -> tuple[str, bool]:
    """
    Доводит файл до формата, который принтер печатает.

    Возвращает пару «путь к готовому файлу» и «файл временный»: временный —
    значит его создал агент, и удалить его обязан вызывающий, иначе в TEMP
    останется копия задания на десятки мегабайт после каждой печати.

    Что происходит по протоколам:

      - формат не входит в `ProtocolSpec.formats` — `FormatError` с понятным
        текстом. Это дешевле, чем узнать отказ от принтера через полминуты:
        PrusaLink не печатает `.3mf`, Creality — тоже;
      - Bambu и `.gcode` — файл пакуется в контейнер `.3mf`
        (`wrap_gcode_to_3mf`): плоский G-code A1 отклоняет на любой команде;
      - FlashForge и `.3mf` — проверка записей внутри контейнера;
      - остальные случаи — файл уходит как есть (`local_path`, не временный).

    Расширение берётся из пути файла, а имя из задания — второй вариант на
    случай, когда файл скачан без расширения.
    """
    spec = _spec(protocol)
    extension = file_extension(local_path) or file_extension(remote_name)

    if extension not in spec.formats:
        raise FormatError(
            f"{spec.title} не печатает {extension or 'файлы без расширения'} — "
            f"переслайсите в {_formats_hint(spec.formats)}"
        )

    if spec.key == "bambu" and extension == ".gcode":
        name = remote_name or _basename(local_path)
        return wrap_gcode_to_3mf(local_path, name), True

    if spec.key == "flashforge" and extension == ".3mf":
        _require_flashforge_parts(local_path)

    return local_path, False
