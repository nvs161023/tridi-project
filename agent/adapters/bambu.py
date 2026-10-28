"""
Адаптер Bambu Lab — заглушка.

Принтеры Bambu в LAN-режиме разговаривают не HTTP, как Moonraker, а MQTT
(порт 8883, TLS) для команд и состояния и FTPS (порт 990) для файлов. Для
мастера такой принтер в Мастерской помечен `protocol_type = "bambu"`
(список протоколов — `PRINTER_PROTOCOLS` в lib/db/workshop-types.ts).

Что понадобится для настоящей реализации (следующий шаг):
  - `connect()` — MQTT-подключение с `api_key` в качестве пароля
    (пользователь `bblp`) и подписка на тему `device/<serial>/report`;
  - `upload_file()` — FTPS-загрузка в папку `cache` на карте памяти;
  - `start_print()` — команда `project_file` с именем файла;
  - `get_status()` — поля `gcode_state` (`RUNNING`, `IDLE`, `FAILED`) и
    `mc_percent` / `mc_remaining_time` из отчёта принтера.

Все методы пока поднимают NotImplementedError: шаг 4.2 создаёт интерфейс и
фабрику, протокол Bambu — отдельная задача (в requirements.txt для него уже
объявлен `websockets`, а MQTT-клиент появится вместе с адаптером).
"""
from __future__ import annotations

from typing import Any

from .base import BasePrinterAdapter


class BambuAdapter(BasePrinterAdapter):
    """Заглушка адаптера Bambu Lab: контракт есть, протокола ещё нет."""

    def connect(self) -> bool:
        raise NotImplementedError(
            "BambuAdapter.connect ещё не реализован: нужен MQTT-клиент"
        )

    def upload_file(self, local_path: str, remote_name: str) -> bool:
        raise NotImplementedError(
            "BambuAdapter.upload_file ещё не реализован: нужен FTPS"
        )

    def start_print(self, remote_name: str) -> bool:
        raise NotImplementedError(
            "BambuAdapter.start_print ещё не реализован"
        )

    def get_status(self) -> dict[str, Any]:
        raise NotImplementedError(
            "BambuAdapter.get_status ещё не реализован"
        )
