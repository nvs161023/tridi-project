"""
Адаптер Moonraker (Klipper).

Moonraker — HTTP/WebSocket-сервер рядом с Klipper. Для мастера такой принтер
в Мастерской помечен `protocol_type = "moonraker"` (список протоколов —
`PRINTER_PROTOCOLS` в lib/db/workshop-types.ts).

Какие запросы уходят (External API Moonraker):

  - `connect()`     — `GET /server/info`: ответ 200 значит, что Moonraker жив;
    `klippy_state` из ответа пишем в журнал для диагностики;
  - `upload_file()` — `POST /server/files/upload`, `multipart/form-data`, поле
    `file`, корень `gcodes`. Успех — 201 (Moonraker отвечает 201 и ставит
    `Location`), 200 принимаем тоже: так отвечали старые сборки;
  - `start_print()` — `POST /printer/print/start?filename=<remote_name>`; имя
    файла requests кодирует сам (пробелы и кириллица в именах);
  - `get_status()`  — `GET /printer/objects/query?print_stats&virtual_sdcard`:
    `print_stats.state` и `virtual_sdcard.progress` (доля 0…1).

Ключ доступа. Если в настройках принтера задан `api_key`, он уходит в
`X-Api-Key` у каждого запроса. Пустой ключ — открытый Moonraker в локальной
сети мастера, тогда заголовок не отправляется.

Сеть. Ни один метод не выпускает `requests.*` наружу: выключенный принтер —
это запись в журнале и `False` (или статус `error` у `get_status()`), а не
падение агента. Таймауты обязательны: без них `requests` ждёт вечно, и цикл
опроса встаёт вместе с принтером.
"""
from __future__ import annotations

import logging
from typing import Any

import requests

from .base import (
    CAPABILITY_CANCEL,
    CAPABILITY_START,
    CAPABILITY_STATUS,
    CAPABILITY_UPLOAD,
    BasePrinterAdapter,
    UploadPlan,
)
from .formats import FormatError

logger = logging.getLogger("agent.adapters.moonraker")

# Сколько ждать ответа Moonraker. Без таймаута requests может ждать вечно, и
# цикл опроса встанет вместе с сетью.
REQUEST_TIMEOUT = 10

# Загрузка G-code идёт дольше опроса состояния: файл на десятки мегабайт по
# Wi-Fi передаётся минутами, обрывать его на десяти секундах нельзя.
UPLOAD_TIMEOUT = 120

# `print_stats.state` у Klipper (klippy/extras/print_stats.py) → статус агента.
# `paused` отдаём как `error`: печать стоит и сама не продолжится, мастеру нужно
# об этом узнать. Незнакомое состояние считаем ошибкой тоже — молчаливое «всё
# хорошо» на ферме опаснее лишнего сообщения в журнале.
_STATE_MAP: dict[str, str] = {
    "printing": "printing",
    "standby": "idle",
    "complete": "idle",
    "error": "error",
    "paused": "error",
}


def _as_number(value: Any) -> float:
    """Число из ответа Moonraker: отсутствие поля или мусор — 0.0."""
    # bool — подкласс int, но True в поле прогресса означает ошибку разбора.
    if isinstance(value, bool):
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    return 0.0


def _as_mapping(value: Any) -> dict[str, Any]:
    """Поле-объект из ответа Moonraker; всё остальное — пустой словарь."""
    return value if isinstance(value, dict) else {}


class MoonrakerAdapter(BasePrinterAdapter):
    """Принтер на Klipper: HTTP API Moonraker и статусы `print_stats`."""

    # Ключ протокола в справочнике: по нему `prepare_upload()` сверяет формат
    # файла — Moonraker печатает G-code (`.gcode`, `.gco`, `.g`) и не разбирает `.3mf`.
    protocol_key = "moonraker"

    # Отмена печати реализована (`POST /printer/print/cancel`), паузы в драйвере
    # пока нет: набор описывает только то, что адаптер действительно делает,
    # чтобы интерфейс не показывал мёртвую кнопку.
    capabilities = frozenset(
        {
            CAPABILITY_UPLOAD,
            CAPABILITY_START,
            CAPABILITY_CANCEL,
            CAPABILITY_STATUS,
        }
    )

    def __init__(self, ip_address: str, api_key: str) -> None:
        """
        `ip_address` — адрес Moonraker в сети мастера: `192.168.1.50`,
        `printer.local:7125` или готовый `http://192.168.1.50:7125`.

        Схему добавляем сами: в настройках Мастерской спрашивают только адрес и
        порт, а `http://` в поле ввода легко забыть или продублировать.
        """
        super().__init__(ip_address=ip_address, api_key=api_key)

        address = ip_address.strip().rstrip("/")

        if not address.startswith(("http://", "https://")):
            address = f"http://{address}"

        # Базовый URL без слэша на конце: пути ниже начинаются со `/`.
        self.base_url = address

    def _headers(self) -> dict[str, str]:
        """Заголовки запроса: `X-Api-Key`, если ключ принтера задан."""
        headers = {"Accept": "application/json"}
        api_key = self.api_key.strip()

        if api_key:
            headers["X-Api-Key"] = api_key

        return headers

    @staticmethod
    def _error_status() -> dict[str, Any]:
        """Ответ get_status(), когда состояние получить не удалось."""
        return {"status": "error", "progress": 0, "remaining_time": 0}

    @staticmethod
    def _read_json(response: requests.Response) -> dict[str, Any] | None:
        """JSON-объект из ответа Moonraker; не JSON — None."""
        try:
            payload = response.json()
        except ValueError:
            logger.error(
                "Moonraker ответил не JSON: HTTP %s, %r",
                response.status_code,
                response.text[:200],
            )
            return None

        if not isinstance(payload, dict):
            logger.error("Moonraker ответил не объектом: %r", payload)
            return None

        return payload

    @staticmethod
    def _error_message(response: requests.Response) -> str:
        """
        Текст ошибки Moonraker.

        Ошибки приходят как `{"error": {"code": ..., "message": ...}}`; если
        тело другое, печатаем начало ответа — этого хватает для журнала.
        """
        try:
            payload = response.json()
        except ValueError:
            text = (response.text or "").strip()
            return text[:200] if text else "без описания"

        error = payload.get("error") if isinstance(payload, dict) else None

        if isinstance(error, dict) and error.get("message"):
            message = str(error["message"])
            code = error.get("code")
            return f"{message} (код {code})" if code is not None else message

        return "без описания"

    def connect(self) -> bool:
        """
        Проверяет, что Moonraker отвечает.

        `GET /server/info` отдаёт 200, когда сервер жив, и 401, если ключ не
        принят. `klippy_state` из ответа пишем в журнал: Moonraker может быть
        доступен, пока сам Klipper в `error` или `shutdown`, — мастер увидит это
        сразу, хотя подключение состоялось (файл загрузить можно).
        """
        try:
            response = requests.get(
                f"{self.base_url}/server/info",
                headers=self._headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as error:
            self.last_error = f"принтер не отвечает: {error}"
            logger.error("Moonraker %s не отвечает: %s", self.ip_address, error)
            return False

        if response.status_code != 200:
            self.last_error = (
                f"принтер отверг подключение: HTTP {response.status_code}, "
                f"{self._error_message(response)}"
            )
            logger.error(
                "Moonraker %s не принял подключение: HTTP %s, %s",
                self.ip_address,
                response.status_code,
                self._error_message(response),
            )
            return False

        payload = self._read_json(response)
        klippy_state = "неизвестно"

        if payload is not None:
            state = _as_mapping(payload.get("result")).get("klippy_state")

            if isinstance(state, str) and state:
                klippy_state = state

        if klippy_state == "ready":
            logger.info("Moonraker %s доступен, Klipper готов", self.ip_address)
        else:
            logger.warning(
                "Moonraker %s доступен, но Klipper в состоянии %r",
                self.ip_address,
                klippy_state,
            )

        return True

    def upload_file(self, local_path: str, remote_name: str) -> bool:
        """
        Загружает G-code в корень `gcodes` Moonraker.

        Подготовка — в `prepare_upload()` и `formats.py`: имя приводится к ASCII
        (кириллица на карте принтера превращается в `?`, и `start_print()` не
        находит файл), а формат сверяется со справочником. `.3mf` Klipper не
        печатает, и отказ приходит до сети, а не после загрузки: мастер увидит
        «переслайсите в .gcode», а не «печать не запущена».

        `FormatError` и `OSError` подготовки становятся `last_error` и False —
        так же, как сетевые отказы самого запроса.
        """
        try:
            plan = self.prepare_upload(local_path, remote_name)
        except FormatError as error:
            self.last_error = str(error)
            logger.error(
                "G-code %s не загружен на %s: %s",
                remote_name,
                self.ip_address,
                error,
            )
            return False
        except OSError as error:
            self.last_error = f"файл не прочитан: {error}"
            logger.error("G-code %s не прочитан: %s", local_path, error)
            return False

        try:
            return self._upload_prepared(plan)
        finally:
            self.cleanup_upload(plan)

    def _upload_prepared(self, plan: UploadPlan) -> bool:
        """
        Отправляет подготовленный файл в корень `gcodes`.

        Поле формы называется `file`, рядом уходит `root=gcodes`: именно из
        этого корня Moonraker берёт файл для `POST /printer/print/start`, поэтому
        имя в `start_print()` совпадает с загруженным. Успех — 201 (так отвечает
        Moonraker, ставя `Location` с путём файла), 200 принимаем на случай
        старых сборок.

        Файл открывается на время запроса: `requests` читает его потоком, и
        закрывать его нужно после отправки, а не сразу.
        """
        try:
            with open(plan.path, "rb") as gcode:
                response = requests.post(
                    f"{self.base_url}/server/files/upload",
                    headers=self._headers(),
                    files={"file": (plan.remote_name, gcode)},
                    data={"root": "gcodes"},
                    timeout=UPLOAD_TIMEOUT,
                )
        except requests.RequestException as error:
            self.last_error = f"G-code не загружен: {error}"
            logger.error(
                "G-code %s не загружен на %s: %s",
                plan.remote_name,
                self.ip_address,
                error,
            )
            return False
        except OSError as error:
            # Файла нет, он занят другой программой или нет прав на чтение.
            # Проверка идёт после RequestException: он тоже наследник OSError,
            # но сетевую ошибку нужно отличать от нечитаемого файла.
            self.last_error = f"файл не прочитан: {error}"
            logger.error("G-code %s не прочитан: %s", plan.path, error)
            return False

        if response.status_code not in (200, 201):
            self.last_error = (
                f"G-code не загружен: HTTP {response.status_code}, "
                f"{self._error_message(response)}"
            )
            logger.error(
                "G-code %s не загружен на %s: HTTP %s, %s",
                plan.remote_name,
                self.ip_address,
                response.status_code,
                self._error_message(response),
            )
            return False

        logger.info(
            "G-code %s загружен на %s (HTTP %s)",
            plan.remote_name,
            self.ip_address,
            response.status_code,
        )
        self.last_error = None
        return True

    def start_print(self, remote_name: str) -> bool:
        """
        Запускает печать файла из корня `gcodes`.

        `POST /printer/print/start?filename=<remote_name>`: имя передаём через
        `params`, чтобы requests сам закодировал пробелы и кириллицу. Ответ
        `"ok"` — 200; 404 значит, что файла нет (например, загрузка не дошла),
        503 — Klipper не готов печатать.
        """
        try:
            response = requests.post(
                f"{self.base_url}/printer/print/start",
                params={"filename": remote_name},
                headers=self._headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as error:
            self.last_error = f"печать не запущена: {error}"
            logger.error(
                "Печать %s не запущена на %s: %s",
                remote_name,
                self.ip_address,
                error,
            )
            return False

        if response.status_code != 200:
            self.last_error = (
                f"печать не запущена: HTTP {response.status_code}, "
                f"{self._error_message(response)}"
            )
            logger.error(
                "Печать %s не запущена на %s: HTTP %s, %s",
                remote_name,
                self.ip_address,
                response.status_code,
                self._error_message(response),
            )
            return False

        logger.info("Печать %s запущена на %s", remote_name, self.ip_address)
        self.last_error = None
        return True

    def stop_print(self) -> bool:
        """
        Останавливает печать: `POST /printer/print/cancel`.

        Moonraker отвечает 200 и `"ok"`, когда Klipper принял команду. Если
        печати уже нет, Klipper отвечает 400 — для агента это успех: закрывать
        нечего, задание уходит в «отменено» без ошибки.
        """
        try:
            response = requests.post(
                f"{self.base_url}/printer/print/cancel",
                headers=self._headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as error:
            self.last_error = f"команда остановки не отправлена: {error}"
            logger.error(
                "Печать на %s не остановлена: %s", self.ip_address, error
            )
            return False

        if response.status_code == 400:
            logger.info(
                "Moonraker %s: печати уже нет — останавливать нечего",
                self.ip_address,
            )
            self.last_error = None
            return True

        if response.status_code != 200:
            self.last_error = (
                f"принтер отказал в остановке: HTTP {response.status_code}, "
                f"{self._error_message(response)}"
            )
            logger.error(
                "Печать на %s не остановлена: HTTP %s, %s",
                self.ip_address,
                response.status_code,
                self._error_message(response),
            )
            return False

        logger.info("Печать на %s остановлена по просьбе мастера", self.ip_address)
        self.last_error = None
        return True

    def get_status(self) -> dict[str, Any]:
        """
        Состояние печати из `print_stats` и `virtual_sdcard`.

        `virtual_sdcard.progress` — доля 0…1 (оценка по размеру файла и позиции),
        поэтому в ответ агента она идёт процентами. Остаток считаем как в
        документации Moonraker: полное время = `print_duration / progress`,
        остаток — разница с уже напечатанным; при нулевом прогрессе остаток
        неизвестен и равен 0.

        Сеть, 5xx и мусор в ответе дают `{"status": "error", ...}`: цикл агента
        продолжит опрос, а мастер увидит, что принтер не отвечает.
        """
        try:
            response = requests.get(
                f"{self.base_url}/printer/objects/query?print_stats&virtual_sdcard",
                headers=self._headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as error:
            logger.error("Состояние %s не получено: %s", self.ip_address, error)
            return self._error_status()

        if response.status_code != 200:
            logger.error(
                "Состояние %s не получено: HTTP %s, %s",
                self.ip_address,
                response.status_code,
                self._error_message(response),
            )
            return self._error_status()

        payload = self._read_json(response)

        if payload is None:
            return self._error_status()

        # Ответ Moonraker: {"result": {"eventtime": …, "status": {...}}}.
        status_objects = _as_mapping(_as_mapping(payload.get("result")).get("status"))
        print_stats = _as_mapping(status_objects.get("print_stats"))
        virtual_sdcard = _as_mapping(status_objects.get("virtual_sdcard"))

        if not print_stats and not virtual_sdcard:
            logger.error(
                "Moonraker %s не вернул print_stats и virtual_sdcard: %r",
                self.ip_address,
                payload,
            )
            return self._error_status()

        raw_state = print_stats.get("state")
        state = raw_state.strip().lower() if isinstance(raw_state, str) else ""
        agent_status = _STATE_MAP.get(state)

        if agent_status is None:
            logger.warning(
                "Moonraker %s: неизвестное состояние печати %r, отдаю error",
                self.ip_address,
                raw_state,
            )
            agent_status = "error"

        # Прогресс Moonraker — доля 0…1; в ответе агента — проценты 0…100.
        fraction = min(max(_as_number(virtual_sdcard.get("progress")), 0.0), 1.0)
        progress = int(round(fraction * 100))

        # print_duration — секунды печати без пауз. Прогресс нулевой или время
        # ещё не накопилось — остаток неизвестен, отдаём 0 (по контракту
        # адаптера это и значит «неизвестно»).
        printed = _as_number(print_stats.get("print_duration"))
        remaining_time = 0

        if fraction > 0 and printed > 0:
            total_time = printed / fraction
            remaining_time = int(round(max(total_time - printed, 0.0)))

        return {
            "status": agent_status,
            "progress": progress,
            "remaining_time": remaining_time,
        }
