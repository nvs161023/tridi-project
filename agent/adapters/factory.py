"""
Фабрика адаптеров: протокол из задания → класс адаптера.

Принтер в Мастерской хранит `protocol_type` (таблица `workshop_printers`,
значения — `PRINTER_PROTOCOLS` в lib/db/workshop-types.ts). Задание приносит
этот тип в поле `printer.protocolType`, а цикл агента не должен знать, чем
именно говорить с принтером: он просит адаптер и работает с
`BasePrinterAdapter`.

Чтобы добавить протокол, достаточно написать наследника
`BasePrinterAdapter` в новом файле и добавить строку в `_ADAPTERS`.
"""
from __future__ import annotations

from .bambu import BambuAdapter
from .base import BasePrinterAdapter
from .moonraker import MoonrakerAdapter
from .octoprint import OctoPrintAdapter

# Известные протоколы → класс адаптера. Ключи совпадают со значениями
# PRINTER_PROTOCOLS на стороне приложения.
_ADAPTERS: dict[str, type[BasePrinterAdapter]] = {
    "moonraker": MoonrakerAdapter,
    "octoprint": OctoPrintAdapter,
    "bambu": BambuAdapter,
}

# Moonraker (шаг 4.3) говорит с принтером по-настоящему; OctoPrint и Bambu пока
# заглушки — их методы поднимают NotImplementedError, и мастер увидит в журнале
# понятную причину, а не молчаливое «печать не началась». Протокол, которого нет
# в _ADAPTERS вовсе, попадает в ValueError.


def get_adapter(
    protocol_type: str, ip_address: str, api_key: str
) -> BasePrinterAdapter:
    """
    Создаёт адаптер для принтера задания.

    `protocol_type` — как в базе (`moonraker`, `bambu`); регистр и лишние
    пробелы не важны, их приводит к нижнему регистру сама фабрика.

    Неизвестный протокол — `ValueError("Неизвестный протокол")`: принтер с
    незнакомым протоколом не должен молча пропускать задания.
    """
    adapter_class = _ADAPTERS.get(protocol_type.strip().lower())

    if adapter_class is None:
        raise ValueError("Неизвестный протокол")

    return adapter_class(ip_address=ip_address, api_key=api_key)
