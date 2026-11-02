"""
Оценка печати из самого G-code: время и масса пластика.

Слайсеры пишут оценку комментариями рядом с моделью, и этих данных хватает,
чтобы карточка заказа показала «≈2 ч 5 мин» и стоимость печати ещё до того,
как принтер дойдёт до последнего слоя. Ничего не считаем сами: масса и время —
это то, что посчитал слайсер для конкретных настроек.

Форматы, которые разбираются:

  - Bambu Studio / OrcaSlicer / PrusaSlicer:
        ; total estimated time: 2h 5m 3s
        ; estimated printing time (normal mode) = 2h 5m 3s
        ; total filament used [g] = 12.34
        ; filament used [g] = 12.34
  - Cura:
        ;TIME:7503
        ;Filament used: 1.23456m   (метры, в граммы не переводим: плотность
                                   пластика слайсер сюда не пишет)

Разбор устойчив к мусору: неизвестные строки пропускаются, а если оценок в
файле нет (обычный G-code из репозитория), возвращаются `None`, а не нули —
ноль означал бы «печать бесплатная и мгновенная».

Проект `.3mf` тоже разбирается: Bambu печатает только его, а оценка лежит в
нарезанном G-code внутри контейнера (`Metadata/plate_N.gcode`). Без этой ветки
у заданий Bambu не было бы ни времени, ни расхода пластика: ZIP построчно не
читается.
"""
from __future__ import annotations

import io
import re
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

# Секунды в году: оценка больше — заведомо мусор, как и в остатке печати.
_MAX_SECONDS = 31_536_000

# Граммы: катушки на 5 кг редки, но 100 кг в одной модели — уже ошибка разбора.
_MAX_GRAMS = 100_000.0

# «1d 2h 3m 4s», «2h 5m», «12m» — как пишут слайсеры.
_TIME_UNITS = {"d": 86_400, "h": 3_600, "m": 60, "s": 1}

_TIME_PATTERNS = (
    re.compile(r"^;\s*total estimated time\s*[:=]\s*(?P<value>.+)$", re.I),
    re.compile(
        r"^;\s*estimated printing time[^:=]*[:=]\s*(?P<value>.+)$", re.I
    ),
    re.compile(r"^;\s*TIME:\s*(?P<value>\d+)\s*$", re.I),
)

_GRAM_PATTERNS = (
    re.compile(
        r"^;\s*total filament used \[g\]\s*=\s*(?P<value>\d+(?:[.,]\d+)?)",
        re.I,
    ),
    re.compile(
        r"^;\s*filament used \[g\]\s*=\s*(?P<value>\d+(?:[.,]\d+)?)", re.I
    ),
)

_TIME_PART = re.compile(r"(?P<number>\d+(?:[.,]\d+)?)\s*(?P<unit>[dhms])", re.I)

# Нарезка внутри проекта `.3mf`: по одной записи на пластину. Оценка берётся с
# первой — агент печатает именно её.
_PLATE_FILE = re.compile(r"^Metadata/plate_(\d+)\.gcode$", re.I)


@dataclass(frozen=True)
class GcodeEstimate:
    """Оценка из файла; `None` — слайсер её не писал."""

    seconds: int | None
    filament_grams: float | None


def parse_duration(text: str) -> int | None:
    """
    Секунды из строки слайсера: `1d 2h 3m 4s` → 93784.

    Голое число принимается как секунды (формат `;TIME:7503`). Пробелы и запятая
    в дробной части допустимы: Bambu и Cura пишут по-разному.
    """
    value = text.strip()

    if not value:
        return None

    if value.isdigit():
        return _clamp_seconds(int(value))

    seconds = 0.0
    found = False

    for match in _TIME_PART.finditer(value):
        number = float(match.group("number").replace(",", "."))
        seconds += number * _TIME_UNITS[match.group("unit").lower()]
        found = True

    if not found:
        return None

    return _clamp_seconds(int(round(seconds)))


def parse_grams(text: str) -> float | None:
    """Граммы из строки слайсера; мусор и отрицательные значения — None."""
    try:
        grams = float(text.replace(",", "."))
    except ValueError:
        return None

    if grams <= 0 or grams > _MAX_GRAMS:
        return None

    return round(grams, 2)


def _clamp_seconds(seconds: int) -> int | None:
    if seconds <= 0 or seconds > _MAX_SECONDS:
        return None

    return seconds


def _empty() -> GcodeEstimate:
    """Оценки нет: ноль означал бы «печать мгновенная и бесплатная»."""
    return GcodeEstimate(seconds=None, filament_grams=None)


def _scan_lines(lines: Iterable[str]) -> GcodeEstimate:
    """
    Оценка из потока строк G-code: побеждает последнее найденное значение.

    Последнее, а не первое: слайсеры пишут итог в конце файла, а в начале может
    остаться оценка одного объекта или черновика.
    """
    seconds: int | None = None
    grams: float | None = None

    for line in lines:
        stripped = line.strip()

        if not stripped.startswith(";"):
            continue

        # Дешёвая проверка до регулярных выражений: файл на десятки мегабайт,
        # и гонять три шаблона на каждой строке незачем.
        lowered = stripped.lower()

        if "estimated" in lowered or ";time:" in lowered:
            seconds = _match_time(stripped) or seconds

        if "filament used [g]" in lowered:
            grams = _match_grams(stripped) or grams

    return GcodeEstimate(seconds=seconds, filament_grams=grams)


def _read_project_estimate(path: str | Path) -> GcodeEstimate:
    """
    Оценка из проекта `.3mf`: читается запись `Metadata/plate_N.gcode`.

    Первая пластина — та, что печатает агент. Битый контейнер или отсутствие
    нарезки дают пустую оценку: печать от этого не отменяется, а причину
    мастер увидит из отказа загрузки.
    """
    try:
        with zipfile.ZipFile(path) as project:
            plates = sorted(
                (int(match.group(1)), name)
                for name in project.namelist()
                for match in [_PLATE_FILE.match(name)]
                if match
            )

            if not plates:
                return _empty()

            with project.open(plates[0][1]) as raw:
                with io.TextIOWrapper(
                    raw, encoding="utf-8", errors="replace"
                ) as gcode:
                    return _scan_lines(gcode)
    except (OSError, KeyError, zipfile.BadZipFile):
        return _empty()


def read_gcode_estimate(path: str | Path) -> GcodeEstimate:
    """
    Читает файл построчно и берёт последнюю найденную оценку.

    Файл читается потоком — держать тридцать мегабайт в памяти агенту на ферме
    незачем. Проект `.3mf` разбирается изнутри: оценка лежит в нарезанном
    G-code пластины. Ошибка чтения не поднимается: без оценки задание всё равно
    печатается, поэтому возвращается пустая оценка и запись в журнал
    вызывающего кода.
    """
    if zipfile.is_zipfile(path):
        return _read_project_estimate(path)

    with open(path, "r", encoding="utf-8", errors="replace") as gcode:
        return _scan_lines(gcode)


def _match_time(line: str) -> int | None:
    for pattern in _TIME_PATTERNS:
        match = pattern.match(line)

        if match:
            parsed = parse_duration(match.group("value"))

            if parsed is not None:
                return parsed

    return None


def _match_grams(line: str) -> float | None:
    for pattern in _GRAM_PATTERNS:
        match = pattern.match(line)

        if match:
            parsed = parse_grams(match.group("value"))

            if parsed is not None:
                return parsed

    return None
