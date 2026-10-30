"""
Фабрика адаптеров: протокол из задания → класс адаптера.

Принтер в Мастерской хранит `protocol_type` (таблица `workshop_printers`,
значения — `PRINTER_PROTOCOLS` в lib/db/workshop-types.ts). Задание приносит
этот тип в поле `printer.protocolType`, а цикл агента не должен знать, чем
именно говорить с принтером: он просит адаптер и работает с
`BasePrinterAdapter`.

Справочник протоколов и их порты живут в `registry.py` — здесь только сборка
конструктора. Чтобы добавить протокол, достаточно написать наследника
`BasePrinterAdapter` в файле, на который указывает `ProtocolSpec.adapter`:
фабрику править не нужно, импорт драйвера ленивый.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .base import BasePrinterAdapter
from .registry import (
    AdapterUnavailableError,
    UnknownProtocolError,
    get_protocol,
    load_adapter_class,
)

# Реэкспорт: main.py ловит AdapterUnavailableError рядом с get_adapter(), и
# импортировать ради этого registry.py ему не нужно.
__all__ = [
    "AdapterUnavailableError",
    "UnknownProtocolError",
    "get_adapter",
]


def get_adapter(
    protocol_type: str,
    ip_address: str,
    api_key: str,
    serial_number: str = "",
    secrets: Mapping[str, str] | None = None,
) -> BasePrinterAdapter:
    """
    Создаёт адаптер для принтера задания.

    `protocol_type` — как в базе (`moonraker`, `creality`); регистр и лишние
    пробелы не важны, их снимает реестр.

    `serial_number` нужен Bambu и FlashForge: первый строит по нему MQTT-топики
    (`device/<serial>/report`), второй отправляет его в заголовке каждого
    запроса. Пустая строка — не ошибка: адаптер попробует найти номер сам.
    Остальным протоколам параметр не передаётся — их конструкторы его не знают.

    `secrets` — содержимое `workshop_printers.printer_secrets`: `checkCode`
    FlashForge, `deviceId` и `modeId` Anycubic. Передаём только протоколам, у
    которых в паспорте есть имена секретов: конструктор Moonraker такого
    параметра не ждёт.

    Неизвестный протокол — `UnknownProtocolError("Неизвестный протокол")`,
    известный но без драйвера — `AdapterUnavailableError`. Обе — наследники
    ValueError: принтер, с которым агент не умеет говорить, не должен молча
    пропускать задания.
    """
    spec = get_protocol(protocol_type)
    adapter_class = load_adapter_class(spec)

    # Словарь, а не явные аргументы: набор параметров зависит от паспорта
    # протокола, а конструкторы адаптеров знают только свои.
    kwargs: dict[str, Any] = {
        "ip_address": ip_address,
        "api_key": api_key,
    }

    if spec.accepts_serial:
        kwargs["serial_number"] = serial_number

    if spec.secrets and secrets:
        kwargs["secrets"] = dict(secrets)

    adapter = adapter_class(**kwargs)

    # Ключ протокола — из паспорта, а не из атрибута класса: `prepare_upload()`
    # ищет по нему форматы в справочнике, и опечатка в атрибуте адаптера
    # обернулась бы «неизвестный протокол» уже на первом задании.
    adapter.protocol_key = spec.key

    return adapter

