"""
Форматы файлов печати: имя на принтере, проверка формата, упаковка, MD5.

Модуль общий для всех адаптеров, хотя протоколы разные: правила одни и те же —
привести имя файла к безопасному виду, убедиться, что принтер такой файл
печатает, и довести его до печатаемого формата.

  - `sanitize_remote_name()` — имя файла на карте принтера. Creality теряет
    файл с пробелом в имени (`opGcodeFile` режет строку по пробелу), а `/` и
    `..` увели бы загрузку за пределы папки, поэтому имя приводится к ASCII и
    одному набору символов здесь, а не в каждом адаптере;
  - `ensure_format()` — формат, который принтер согласен печатать: Bambu
    печатает только проект `.3mf` из Bambu Studio — его проверяет
    `read_bambu_project()`, — FlashForge берёт `.3mf` только с записями
    `3D/3dmodel.model` и `Metadata/plate_1.gcode` внутри, остальным нужен
    G-code;
  - `file_digest()` — MD5 файла: Anycubic и Elegoo сверяют его в командах
    печати, Bambu — в отчёте о загрузке.

Список форматов протокола живёт в справочнике (`registry.ProtocolSpec.formats`),
а не здесь: `registry` импортирует `base`, а `base` — этот модуль. Поэтому
`registry` читается внутри функции, иначе получилось бы кольцо импортов.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import zipfile
from typing import TYPE_CHECKING, Final, NamedTuple

if TYPE_CHECKING:  # только для аннотаций: справочник тянет за собой адаптеры
    from collections.abc import Callable

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

# Записи с нарезанным G-code: по одной на пластину проекта (`plate_1.gcode`,
# `plate_2.gcode`). Прошивка получает номер пластины в `param` команды печати,
# поэтому имя записи читается из контейнера, а не угадывается: проект, где
# нарезана только вторая пластина, иначе не напечатался бы вовсе.
BAMBU_PLATE_PATTERN: Final = re.compile(r"^Metadata/plate_(\d+)\.gcode$")

# Служебные файлы проекта Bambu Studio и Orca. Вместе с `plate_*.gcode` они
# доказывают, что контейнер — готовое задание печати, а не модель для слайсера:
# `project_settings.config` — профиль принтера и пластика (принтер не нарезает
# файл сам и берёт настройки отсюда), `slice_info.config` — отчёт слайсера с
# моделью принтера.
BAMBU_PLATE_SETTINGS: Final = "Metadata/project_settings.config"
BAMBU_SLICE_INFO: Final = "Metadata/slice_info.config"

# Ключи с моделью принтера в служебных файлах: сначала отчёт слайсера, затем
# проект настроек. Порядок тот же, что в `lib/3d/parse-3mf.ts`: поле
# `printer_settings_id` у Bambu Studio выглядит как «Bambu Lab A1 0.4 nozzle»,
# поэтому хвост про сопло снимается перед сравнением.
BAMBU_MODEL_KEYS: Final = (
    "printer_model",
    "printer_model_id",
    "printer_settings_id",
)

# Служебные коды моделей Bambu Lab. Bambu Studio 02.x пишет в
# `slice_info.config` не название станка, а код профиля
# (`<metadata key="printer_model_id" value="N2S"/>`): «N2S» — это A1. Коды взяты
# из официальных профилей Bambu Studio (`resources/profiles/BBL/machine/*.json`,
# поле `model_id`); версии до 02.x кладут в то же поле готовое название, поэтому
# незнакомое значение остаётся как есть. Таблица повторяет
# `lib/3d/printer-model-codes.ts`: веб-приложение и агент должны одинаково
# понимать, под какой станок нарезан проект.
BAMBU_MODELS: Final = (
    ("N2S", "Bambu Lab A1", ("A1",)),
    ("N1", "Bambu Lab A1 mini", ("A1 mini",)),
    ("C11", "Bambu Lab P1P", ("P1P",)),
    ("C12", "Bambu Lab P1S", ("P1S",)),
    ("C13", "Bambu Lab X1E", ("X1E",)),
    ("BL-P001", "Bambu Lab X1C", ("X1C", "X1 Carbon", "Bambu Lab X1 Carbon")),
    ("BL-P002", "Bambu Lab X1", ("X1",)),
    ("O1D", "Bambu Lab H2D", ("H2D",)),
)

# Хвост профиля слайсера про сопло: «Bambu Lab A1 0.4 nozzle» → «Bambu Lab A1».
_NOZZLE_TAIL: Final = re.compile(r"\b\d+(?:\.\d+)?\s*(?:mm)?\s*nozzle\b", re.IGNORECASE)
_NOZZLE_WORD: Final = re.compile(r"\bnozzle\b", re.IGNORECASE)
_XML_METADATA_TAG: Final = re.compile(r"<metadata\b[^>]*>", re.IGNORECASE)
# Примета служебного кода: «N2S», «C12», «O1S», «BL-P003». Название с пробелами
# под неё не попадает.
_MODEL_CODE: Final = re.compile(r"^[a-z]{1,3} ?[a-z0-9]{1,4}$", re.IGNORECASE)


def _spelling_key(value: str) -> str:
    """
    Ключ написания модели: регистр, вид тире и лишние пробелы не важны.

    «Bambu Lab — X1», «Bambu Lab-X1» и «bambu lab  x1» дают один ключ.
    """
    normalized = value.strip().lower()

    for dash in ("—", "–", "-"):
        normalized = normalized.replace(dash, " ")

    return " ".join(normalized.split())


# Код модели → подпись для человека («n2s» → «Bambu Lab A1»).
BAMBU_NAME_BY_CODE: Final = {_spelling_key(code): name for code, name, _ in BAMBU_MODELS}

# Код, подпись и другие написания → код модели («bambu lab x1 carbon» → «bl p001»).
BAMBU_CODE_BY_NAME: Final = {
    _spelling_key(name): _spelling_key(code)
    for code, model_name, aliases in BAMBU_MODELS
    for name in (code, model_name, *aliases)
}

def discard(path: str) -> None:
    """Удаляет временный файл: его отсутствие задание не ломает."""
    try:
        os.remove(path)
    except OSError as error:
        logger.warning("временный файл %s не удалён: %s", path, error)


class BambuProject(NamedTuple):
    """
    Паспорт проекта `.3mf` для Bambu: что печатать и под какой принтер.

      - `gcode_part` — запись внутри контейнера (`Metadata/plate_2.gcode`): её
        указывает `param` команды `project_file`;
      - `plate` — номер пластины из имени записи;
      - `printer_model` — модель принтера из профиля слайсера; None — профиль
        модели не называет, и сравнивать нечего.
    """

    gcode_part: str
    plate: int
    printer_model: str | None


def _xml_attribute(tag: str, name: str) -> str | None:
    """Значение атрибута XML-тега: кавычки одинарные и двойные."""
    pattern = re.compile(rf"\b{name}\s*=\s*(\"([^\"]*)\"|'([^']*)')", re.IGNORECASE)
    match = pattern.search(tag)

    if not match:
        return None

    return match.group(2) if match.group(2) is not None else match.group(3)


def _clean_printer_model(value: str | None) -> str | None:
    """
    Модель принтера в одном виде: без кавычек, лишних пробелов и хвоста сопла.

    `printer_settings_id` у Bambu Studio выглядит как «Bambu Lab A1 0.4 nozzle»,
    а сравнивать его нужно с моделью принтера из парка («A1»). Служебный код
    модели («N2S») разворачивается в название: отказ «проект нарезан для N2S»
    мастеру ничего не говорил.
    """
    if not value:
        return None

    text = value.strip().strip("\"'").strip()
    text = _NOZZLE_TAIL.sub(" ", text)
    text = _NOZZLE_WORD.sub(" ", text)
    text = " ".join(text.split())

    if not text:
        return None

    return BAMBU_NAME_BY_CODE.get(_spelling_key(text), text)


def _is_model_code(value: str) -> bool:
    """
    Похоже на служебный код, а не на название модели: «N2S», «C12», «O1S».

    По этой примете выбирается источник, когда слайсер написал в `slice_info` и
    `project_settings` разное: название понятнее даже незнакомого кода.
    """
    return bool(_MODEL_CODE.match(_spelling_key(value)))


def _slice_info_model(xml: str) -> str | None:
    """
    Модель принтера из `Metadata/slice_info.config`.

    Bambu Studio и Orca пишут её метаданными пластины:
    `<metadata key="printer_model_id" value="Bambu Lab A1"/>`.
    """
    values: dict[str, str] = {}

    for tag in _XML_METADATA_TAG.findall(xml):
        key = (_xml_attribute(tag, "key") or "").strip().lower()
        value = _xml_attribute(tag, "value")

        if key and value and key not in values:
            values[key] = value

    for key in BAMBU_MODEL_KEYS:
        model = _clean_printer_model(values.get(key))

        if model:
            return model

    return None


def _project_settings_model(json_text: str) -> str | None:
    """
    Модель принтера из `Metadata/project_settings.config`.

    Файл — JSON проекта слайсера. Битый или неожиданный JSON не ошибка: просто
    нет подсказки, для какого принтера нарезан проект.
    """
    try:
        settings = json.loads(json_text)
    except ValueError:
        return None

    if not isinstance(settings, dict):
        return None

    for key in BAMBU_MODEL_KEYS:
        value = settings.get(key)
        model = _clean_printer_model(value if isinstance(value, str) else None)

        if model:
            return model

    return None


def _bambu_plate(parts: list[str]) -> tuple[int, str] | None:
    """
    Первая нарезанная пластина контейнера: номер и путь записи.

    None — в контейнере нет `Metadata/plate_*.gcode`, то есть нарезки нет.
    """
    plates = [
        (int(match.group(1)), part)
        for part in parts
        for match in [BAMBU_PLATE_PATTERN.match(part)]
        if match
    ]

    return min(plates) if plates else None


def _read_bambu_part(
    container: zipfile.ZipFile,
    parts: set[str],
    part: str,
    reader: "Callable[[str], str | None]",
) -> str | None:
    """
    Модель принтера из одного служебного файла проекта.

    Любая ошибка чтения — «модели нет»: подсказка нужна только для проверки
    совместимости, и портить ею загрузку готового проекта нельзя.
    """
    if part not in parts:
        return None

    try:
        text = container.read(part).decode("utf-8", "replace")
    except (OSError, KeyError, zipfile.BadZipFile) as error:
        logger.warning("Bambu: %s не прочитан: %s", part, error)
        return None

    return reader(text)


def _bambu_model(container: zipfile.ZipFile, parts: set[str]) -> str | None:
    """
    Модель принтера из проекта: отчёт слайсера, затем проект настроек.

    Bambu Studio 02.x пишет в отчёт служебный код модели («N2S»), а название
    станка — только в проект настроек, поэтому читаются оба файла и код уступает
    названию. Незнакомый код тоже уступает: новая модель Bambu не должна
    превращаться в отказ «проект нарезан для O1S».
    """
    from_slice_info = _read_bambu_part(
        container, parts, BAMBU_SLICE_INFO, _slice_info_model
    )
    from_settings = _read_bambu_part(
        container, parts, BAMBU_PLATE_SETTINGS, _project_settings_model
    )

    if (
        from_slice_info
        and from_settings
        and from_slice_info != from_settings
        and _is_model_code(from_slice_info)
        and not _is_model_code(from_settings)
    ):
        return from_settings

    return from_slice_info or from_settings


def read_bambu_project(path: str) -> BambuProject:
    """
    Проверяет, что `.3mf` — готовый проект печати Bambu, и читает его паспорт.

    A1 печатает только проект, сохранённый слайсером Bambu Studio (или Orca)
    командой «Экспорт файла пластины»: внутри такого файла лежит нарезанный
    G-code пластины (`Metadata/plate_N.gcode`) и профиль слайсера
    (`Metadata/project_settings.config`). Модель `.3mf` без нарезки прошивка не
    разбирает — она не слайсит, — поэтому такой файл отклоняется здесь, до
    загрузки сотни мегабайт на карту и до команды печати.

    Отказы — `FormatError` с причиной для мастера: «не удалось загрузить файл»
    он уже видел, и оно не говорило, что делать дальше.
    """
    try:
        with zipfile.ZipFile(path) as container:
            parts = set(container.namelist())
            plate = _bambu_plate(list(parts))

            if plate is None:
                raise FormatError(
                    "в контейнере .3mf нет нарезанного G-code "
                    "(`Metadata/plate_1.gcode`): это модель, а не задание печати. "
                    "Нарежьте её в Bambu Studio под свой принтер и сохраните "
                    "проект — «Экспорт файла пластины» (.3mf)"
                )

            if BAMBU_PLATE_SETTINGS not in parts:
                raise FormatError(
                    "контейнер .3mf собран не Bambu Studio: в нём нет "
                    f"`{BAMBU_PLATE_SETTINGS}`, а прошивка берёт из него профиль "
                    "печати. Сохраните проект из Bambu Studio («Экспорт файла "
                    "пластины») и загрузите его заново"
                )

            index, part = plate

            return BambuProject(
                gcode_part=part,
                plate=index,
                printer_model=_bambu_model(container, parts),
            )
    except (OSError, zipfile.BadZipFile) as error:
        raise FormatError(f"контейнер .3mf не прочитан: {error}") from error


def _comparison_key(value: str) -> str:
    """
    Ключ сравнения моделей: регистр, скобки и хвост сопла не важны.

    «Bambu Lab A1 0.4 nozzle» → «bambu lab a1»; «Original Prusa MK4» →
    «original prusa mk4». У Bambu Lab ключом становится код модели, поэтому
    «N2S», «Bambu Lab A1» и «A1» сходятся, а «A1 mini» — нет.
    """
    text = _clean_printer_model(value) or ""
    key = " ".join(text.replace("(", " ").replace(")", " ").split()).lower()

    return BAMBU_CODE_BY_NAME.get(_spelling_key(key), key)


def _printer_keys(brand: str, model: str) -> list[str]:
    """
    Варианты ключа принтера из парка: «A1» и «Bambu Lab A1» — один принтер.

    Модель может уже содержать бренд («Bambu Lab A1» при бренде «Bambu Lab»),
    поэтому набор собирается, а не сравнивается одной строкой.
    """
    model_key = _comparison_key(model)
    brand_key = _comparison_key(brand)
    keys: list[str] = []

    if model_key:
        keys.append(model_key)

    if brand_key and model_key:
        keys.append(f"{brand_key} {model_key}")

    return keys


def bambu_compat_error(project_model: str | None, brand: str, model: str) -> str | None:
    """
    Подходит ли проект принтеру: None — подходит, строка — причина отказа.

    Профили температуры, скорости и объёма у моделей разные, поэтому проект,
    нарезанный для X1 Carbon, на A1 печатать нельзя: принтер либо откажется,
    либо испортит деталь. Пустая модель в профиле или пустая модель принтера —
    «сравнивать нечего», и такой проект пропускается: отказ ради догадки хуже
    ошибки.

    Совпадение по концу строки нужно для названий с уточнением впереди:
    «Original Prusa MK4» и модель «MK4». Разные модели им не станут: «A1 mini»
    не заканчивается на «A1».
    """
    sliced = _comparison_key(project_model or "")

    if not sliced:
        return None

    keys = _printer_keys(brand, model)

    if not keys:
        return None

    if any(sliced == key or sliced.endswith(f" {key}") for key in keys):
        return None

    # В отказе — название модели, а не служебный код: «нарезан для N2S» мастеру
    # ничего не говорит, «нарезан для Bambu Lab A1» — говорит.
    sliced_for = _clean_printer_model(project_model) or (project_model or "")
    printer = " ".join(part.strip() for part in (brand, model) if part.strip())

    return (
        f"проект .3mf нарезан для {sliced_for}, а принтер — "
        f"{printer or 'без модели в карточке'}: переслайсите модель под этот "
        "принтер и загрузите файл заново"
    )


def _bambu_format_error(extension: str) -> str:
    """
    Почему Bambu не возьмёт такой файл: текст для мастера, а не код ошибки.

    STL и плоский G-code принтер не нарезает и не разбирает: A1 печатает только
    готовый проект `.3mf`. Без этого объяснения мастер видел «задание
    провалилось» и искал причину в принтере.
    """
    if extension == ".stl":
        return (
            "STL — это модель, а не задание печати: принтер её не нарезает. "
            "Нарежьте модель в Bambu Studio под свой принтер и сохраните проект "
            "— «Экспорт файла пластины» (.3mf)"
        )

    if extension in (".gcode", ".gco", ".g"):
        return (
            "Bambu Lab печатает только проект .3mf из Bambu Studio: плоский "
            f"{extension} прошивка A1 не разбирает. Нарежьте модель под принтер "
            "и сохраните «Экспорт файла пластины» (.3mf)"
        )

    return (
        f"Bambu Lab не печатает {extension or 'файлы без расширения'} — "
        "загрузите проект .3mf, сохранённый из Bambu Studio для этого принтера"
    )


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

      - Bambu и не `.3mf` — `FormatError` с объяснением: A1 печатает только
        проект `.3mf`, сохранённый из Bambu Studio, а плоский G-code и STL он
        не разбирает. Проверка стоит до сети: иначе мастер узнал бы об этом
        после загрузки сотни мегабайт;
      - Bambu и `.3mf` — проверка контейнера (`read_bambu_project()`): внутри
        должен быть нарезанный G-code пластины и профиль слайсера, иначе
        прошивка ответит `0500-4003` уже после загрузки;
      - формат не входит в `ProtocolSpec.formats` — `FormatError` с понятным
        текстом. Это дешевле, чем узнать отказ от принтера через полминуты:
        PrusaLink не печатает `.3mf`, Creality — тоже;
      - FlashForge и `.3mf` — проверка записей внутри контейнера;
      - остальные случаи — файл уходит как есть (`local_path`, не временный).

    Расширение берётся из пути файла, а имя из задания — второй вариант на
    случай, когда файл скачан без расширения.
    """
    spec = _spec(protocol)
    extension = file_extension(local_path) or file_extension(remote_name)

    # Bambu отвечает за формат сам: у него один печатаемый формат — проект
    # `.3mf`, и текст отказа должен говорить, что делать мастеру, а не только
    # «формат не тот».
    if spec.key == "bambu" and extension != ".3mf":
        raise FormatError(_bambu_format_error(extension))

    if extension not in spec.formats:
        raise FormatError(
            f"{spec.title} не печатает {extension or 'файлы без расширения'} — "
            f"переслайсите в {_formats_hint(spec.formats)}"
        )

    if spec.key == "bambu":
        read_bambu_project(local_path)

    if spec.key == "flashforge" and extension == ".3mf":
        _require_flashforge_parts(local_path)

    return local_path, False
