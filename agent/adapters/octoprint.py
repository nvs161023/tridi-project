"""
Адаптер OctoPrint — заглушка.

OctoPrint разговаривает по HTTP REST API (по умолчанию порт 80, префикс `/api`,
ключ доступа в заголовке `X-Api-Key`). Для мастера такой принтер в Мастерской
помечен `protocol_type = "octoprint"` (список протоколов — `PRINTER_PROTOCOLS`
в lib/db/workshop-types.ts).

Что понадобится для настоящей реализации (следующий шаг):
  - `connect()` — `GET /api/version` (или `/api/printer`): сервер отвечает,
    значит OctoPrint жив; ключ уходит в `X-Api-Key: <api_key>`;
  - `upload_file()` — `POST /api/files/local` (multipart, поле `file`,
    `select=true`, чтобы файл стал текущим для печати);
  - `start_print()` — `POST /api/job` с `{"command": "start"}` (ответ 204):
    печатает файл, выбранный командой `select`;
  - `get_status()` — `GET /api/job`: `progress.completion` (доля 0…1),
    `progress.printTimeLeft` (секунды) и `state` (`Printing`, `Paused`,
    `Operational`, `Error`).

Все методы пока поднимают NotImplementedError: заглушка нужна, чтобы протокол
из `PRINTER_PROTOCOLS` попадал в фабрику и давал понятную ошибку в журнале, а
не «неизвестный протокол».
"""
from __future__ import annotations

from typing import Any

from .base import BasePrinterAdapter


class OctoPrintAdapter(BasePrinterAdapter):
    """Заглушка адаптера OctoPrint: контракт есть, протокола ещё нет."""

    def connect(self) -> bool:
        raise NotImplementedError(
            "OctoPrintAdapter.connect ещё не реализован: нужен HTTP API OctoPrint"
        )

    def upload_file(self, local_path: str, remote_name: str) -> bool:
        raise NotImplementedError(
            "OctoPrintAdapter.upload_file ещё не реализован: нужен POST /api/files/local"
        )

    def start_print(self, remote_name: str) -> bool:
        raise NotImplementedError(
            "OctoPrintAdapter.start_print ещё не реализован: нужен POST /api/job"
        )

    def get_status(self) -> dict[str, Any]:
        raise NotImplementedError(
            "OctoPrintAdapter.get_status ещё не реализован: нужен GET /api/job"
        )
