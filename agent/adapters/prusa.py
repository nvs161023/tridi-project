"""
Адаптер PrusaLink.

PrusaLink — HTTP API прошивки Prusa (MINI, MK3.5, MK4, XL): порт 80, префикс
`/api/v1`, ключ доступа (PrusaLink → Settings → API key) в заголовке `X-Api-Key`.
В Мастерской такой принтер помечен `protocol_type = "prusa"` (список протоколов
— `PRINTER_PROTOCOLS` в lib/db/workshop-types.ts).

Какие запросы уходят:

  - `connect()`     — `GET /api/v1/status`: 200 значит, что PrusaLink жив и ключ
    принят; состояние принтера из ответа пишется в журнал;
  - `upload_file()` — `PUT /api/v1/files/<storage>/<remote_name>`: тело файла
    целиком, `Content-Type: application/octet-stream`,
    `Print-After-Upload: ?0` и `Overwrite: ?1`;
  - `start_print()` — `POST /api/v1/files/<storage>/<remote_name>` с
    `{"command": "print"}`;
  - `get_status()`  — `GET /api/v1/status` (состояние) и `GET /api/v1/job`
    (прогресс и остаток);
  - `pause_print()` / `resume_print()` / `stop_print()` — `POST /api/v1/job` с
    `{"action": "pause"|"resume"|"stop"}`.

Хранилище. `usb` — флешка принтера, `local` — внутренняя память. Значение
приходит из `workshop_printers.printer_secrets` (поле `storage`): своей колонки
у него нет, а без него путь загрузки не собрать. По умолчанию `usb`: так
настроено у большинства мастеров, а MK4 без флешки отвечает 404 на
`/api/v1/files/usb`, и мастер увидит понятный отказ загрузки.

Почему у команд два вида запроса. В документации PrusaLink пауза и возврат —
это `PUT /api/v1/job` с `{"command": "pause"|"resume"}`, а отмена —
`DELETE /api/v1/job`; прошивки 2.x принимают и `POST` с `{"action": ...}`.
Отправляем `POST` (как договорились для Мастерской), а на 400/404/405 повторяем
документированным запросом: иначе на живом принтере пауза молча не сработала бы,
а мастер решил бы, что она включена.

`Print-After-Upload: ?0` и `Overwrite: ?1` — заголовки PrusaLink в формате
`?1`/`?0` (так в API описаны флаги). Первый запрещает печать сразу после
загрузки: команду печати отправляет агент, когда узнал об успешной загрузке.
Второй разрешает перезапись — повторная попытка после обрыва связи не упирается
в 409 на уже отправленном файле.

Сеть. Ни один метод не выпускает `requests.*` наружу: выключенный принтер — это
запись в журнале и `False` (или статус `error` у `get_status()`), а не падение
агента. Таймауты обязательны: без них цикл опроса встаёт вместе с принтером.
"""
from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final
from urllib.parse import quote

import requests

from .base import (
    CAPABILITY_CANCEL,
    CAPABILITY_PAUSE,
    CAPABILITY_RESUME,
    CAPABILITY_START,
    CAPABILITY_STATUS,
    CAPABILITY_UPLOAD,
    BasePrinterAdapter,
    UploadPlan,
)
from .formats import FormatError

logger = logging.getLogger("agent.adapters.prusa")

# Сколько ждать ответа PrusaLink.
REQUEST_TIMEOUT = 10

# Загрузка G-code идёт дольше опроса: файл на десятки мегабайт по Wi-Fi
# передаётся минутами, обрывать его на десяти секундах нельзя.
UPLOAD_TIMEOUT = 120

# Хранилища PrusaLink. Путь загрузки начинается с имени хранилища, поэтому
# незнакомое значение из `printer_secrets` подменяем на `usb`, а не отправляем
# как есть: так мастер получит отказ загрузки, а не запрос в чужую папку.
_STORAGES: Final[frozenset[str]] = frozenset({"usb", "local"})
DEFAULT_STORAGE: Final = "usb"
# `printer.state` из `GET /api/v1/status` → статус агента.
#
# `finished`, `stopped`, `ready` и `busy` — принтер свободен: печать закончена
# или не начиналась. `attention` — принтер ждёт мастера (кончился филамент,
# ошибка калибровки), и это ошибка задания: само не рассосётся. Незнакомое
# состояние считаем ошибкой: молчаливое «всё хорошо» на ферме опаснее лишней
# записи в журнале.
_STATE_MAP: Final[dict[str, str]] = {
    "printing": "printing",
    "paused": "paused",
    "idle": "idle",
    "ready": "idle",
    "busy": "idle",
    "finished": "idle",
    "stopped": "idle",
    "attention": "error",
    "error": "error",
}

# Подсказки к кодам отказа: «HTTP 401» мастер прочитает как проблему сети, хотя
# ключ просто не подходит.
_STATUS_HINTS: Final[dict[int, str]] = {
    401: "ключ API не принят — проверьте ключ принтера в настройках Мастерской",
    403: "ключу API запрещено это действие",
}

# Смысл кодов зависит от запроса: 404 у файла — нет хранилища или файла, 404 у
# команды — нет текущего задания; 409 при загрузке — файл уже есть. Одна
# подсказка на все случаи врала бы мастеру, поэтому наборы дополняют общий.
_FILE_HINTS: Final[dict[int, str]] = {
    404: "файла или хранилища на принтере нет — проверьте storage в настройках",
    409: "файл уже есть на принтере или принтер занят",
    413: "файл больше лимита принтера",
    415: "тип файла не поддерживается — переслайсите в .gcode или .bgcode",
}
_JOB_HINTS: Final[dict[int, str]] = {
    404: "текущего задания нет — печать не запущена",
    409: "команда не подходит к текущему состоянию печати",
}

# Коды, на которые имеет смысл повторить команду документированным запросом:
# прошивка не знает `POST /api/v1/job` с `action` (405), не разобрала тело
# (400) или не нашла текущего задания (404). На 401/403/500 повтор бессмыслен.
_FALLBACK_STATUSES: Final[frozenset[int]] = frozenset({400, 404, 405})


def _as_number(value: Any) -> float:
    """Число из ответа PrusaLink: отсутствие поля или мусор — 0.0."""
    # bool — подкласс int, но True в поле прогресса означает ошибку разбора.
    if isinstance(value, bool):
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    return 0.0


def _as_mapping(value: Any) -> dict[str, Any]:
    """Поле-объект из ответа PrusaLink; всё остальное — пустой словарь."""
    return value if isinstance(value, dict) else {}


def _as_percent(value: Any) -> int:
    """
    Прогресс в процентах 0…100.

    PrusaLink отдаёт готовые проценты (`progress`), но в простое поля нет, а на
    кривой сборке бывает больше 100. Границы отсекаем здесь: в базе прогресс не
    должен вылезать за 100.
    """
    percent = _as_number(value)

    return int(round(min(max(percent, 0.0), 100.0)))


def _as_seconds(value: Any) -> int:
    """Остаток печати в секундах: отрицательное и мусор — 0 («неизвестно»)."""
    return int(round(max(_as_number(value), 0.0)))


def _storage_from_secrets(secrets: Mapping[str, str] | None) -> str:
    """
    Хранилище из `printer_secrets`: `usb` или `local`.

    Пустое значение и незнакомое (`local/` с ошибкой, `SDCARD`) дают `usb` с
    записью в журнал: путь загрузки должен быть собран всегда, иначе задание
    падало бы на разборе настроек, а не на принтере.
    """
    raw = (dict(secrets or {}).get("storage") or "").strip().lower()

    if not raw:
        return DEFAULT_STORAGE

    if raw in _STORAGES:
        return raw

    logger.warning(
        "PrusaLink: неизвестное хранилище %r в секретах принтера, использую %s",
        raw,
        DEFAULT_STORAGE,
    )

    return DEFAULT_STORAGE


class PrusaAdapter(BasePrinterAdapter):
    """Принтер с PrusaLink: `GET /api/v1/status`, `PUT /api/v1/files`, `/api/v1/job`."""

    # Ключ протокола в справочнике: по нему `prepare_upload()` сверяет формат
    # файла — PrusaLink печатает `.gcode` и бинарный `.bgcode`, а `.3mf` не
    # разбирает: это проект слайсера, а не задание печати.
    protocol_key = "prusa"

    # Что адаптер действительно делает: пауза, возврат и остановка есть в
    # `/api/v1/job`, поэтому интерфейс показывает эти кнопки.
    capabilities = frozenset(
        {
            CAPABILITY_UPLOAD,
            CAPABILITY_START,
            CAPABILITY_PAUSE,
            CAPABILITY_RESUME,
            CAPABILITY_CANCEL,
            CAPABILITY_STATUS,
        }
    )

    # Расширения, которые PrusaLink печатает: `.gcode` и бинарный `.bgcode`
    # (сжатый G-code прошивок Buddy). Список повторяет `formats` в справочнике
    # протокола и уходит в пробу принтера.
    accepted_formats = (".gcode", ".bgcode")

    def __init__(
        self,
        ip_address: str,
        api_key: str,
        secrets: Mapping[str, str] | None = None,
    ) -> None:
        """
        `ip_address` — адрес PrusaLink в сети мастера: `192.168.1.60`,
        `prusa.local` или готовый `http://192.168.1.60`.

        `secrets` — содержимое `workshop_printers.printer_secrets`. Адаптеру
        нужно одно поле — `storage`: имя хранилища в пути загрузки. Остальные
        секреты протокола игнорируются.
        """
        super().__init__(ip_address=ip_address, api_key=api_key, secrets=secrets)

        address = ip_address.strip().rstrip("/")

        if not address.startswith(("http://", "https://")):
            address = f"http://{address}"

        # Базовый URL без слэша на конце: пути ниже начинаются с `/`.
        self.base_url = address
        # Хранилище решается один раз при сборке: менять его в середине задания
        # нельзя — файл уже лежит по конкретному пути.
        self.storage = _storage_from_secrets(secrets)

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
        """
        JSON-объект из ответа PrusaLink; не JSON — None.

        Пустое тело (204 у `GET /api/v1/job`, когда задания нет) — не ошибка:
        вызывающий код отличает `None` от пустого словаря сам.
        """
        if not (response.content or b"").strip():
            return {}

        try:
            payload = response.json()
        except ValueError:
            logger.error(
                "PrusaLink ответил не JSON: HTTP %s, %r",
                response.status_code,
                response.text[:200],
            )
            return None

        if not isinstance(payload, dict):
            logger.error("PrusaLink ответил не объектом: %r", payload)
            return None

        return payload
    @staticmethod
    def _error_message(response: requests.Response) -> str:
        """
        Текст ошибки PrusaLink.

        Ошибки приходят строкой (`{"message": "…"}`), вложенным объектом, а при
        ошибке обратного прокси — HTML. В журнале нужен человеческий текст,
        поэтому разбираем все случаи, а остальное обрезаем до двухсот символов.
        """
        try:
            payload = response.json()
        except ValueError:
            text = (response.text or "").strip()
            return text[:200] if text else "без описания"

        if not isinstance(payload, dict):
            return "без описания"

        for key in ("message", "error"):
            value = payload.get(key)

            if isinstance(value, str) and value.strip():
                return value.strip()[:200]

            if isinstance(value, dict):
                nested = value.get("message") or value.get("title")

                if isinstance(nested, str) and nested.strip():
                    return nested.strip()[:200]

        return "без описания"

    def _http_reason(
        self,
        response: requests.Response,
        extra: Mapping[int, str] | None = None,
    ) -> str:
        """
        Причина отказа для `last_error`: подсказка по коду и текст от сервера.

        Подсказка идёт первой: «HTTP 409: файл уже есть на принтере» мастер
        поймёт, а «HTTP 409, Conflict» заставит искать проблему в сети. `extra`
        уточняет смысл кода для конкретного запроса.
        """
        hints = dict(_STATUS_HINTS)

        if extra:
            hints.update(extra)

        hint = hints.get(response.status_code)
        message = self._error_message(response)

        if hint:
            return f"HTTP {response.status_code}: {hint} ({message})"

        return f"HTTP {response.status_code}, {message}"

    def connect(self) -> bool:
        """
        Проверяет, что PrusaLink отвечает и ключ принят.

        `GET /api/v1/status` отдаёт 200, когда сервер жив, и 401, если ключ не
        подошёл. Состояние принтера из ответа пишется в журнал: PrusaLink может
        быть доступен, пока сама плата в ошибке — файл загрузить можно, но
        печать не начнётся, и мастеру полезно увидеть это сразу.
        """
        try:
            response = requests.get(
                f"{self.base_url}/api/v1/status",
                headers=self._headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as error:
            self.last_error = f"принтер не отвечает: {error}"
            logger.error("PrusaLink %s не отвечает: %s", self.ip_address, error)
            return False

        if response.status_code != 200:
            self.last_error = (
                f"принтер отверг подключение: {self._http_reason(response)}"
            )
            logger.error(
                "PrusaLink %s не принял подключение: %s",
                self.ip_address,
                self._http_reason(response),
            )
            return False

        payload = self._read_json(response) or {}
        printer = _as_mapping(payload.get("printer"))
        raw_state = printer.get("state")
        state = raw_state.strip().upper() if isinstance(raw_state, str) else ""

        if state in ("IDLE", "READY"):
            logger.info(
                "PrusaLink %s доступен, принтер в состоянии %s",
                self.ip_address,
                state,
            )
        else:
            logger.warning(
                "PrusaLink %s доступен, принтер в состоянии %r",
                self.ip_address,
                state or "неизвестно",
            )

        self.last_error = None
        return True

    def _file_url(self, remote_name: str) -> str:
        """
        Путь файла на принтере: `/api/v1/files/<storage>/<remote_name>`.

        Имя кодируется (`quote`), хотя `prepare_upload()` уже убрал из него
        пробелы и кириллицу: файл мог быть загружен раньше, другим агентом или
        руками мастера, и путь с `#` или `?` сломал бы запрос.
        """
        return (
            f"{self.base_url}/api/v1/files/{self.storage}/"
            f"{quote(remote_name, safe='')}"
        )

    def upload_file(self, local_path: str, remote_name: str) -> bool:
        """
        Загружает G-code в хранилище PrusaLink.

        Подготовка — в `prepare_upload()` и `formats.py`: имя приводится к ASCII
        и безопасному виду, формат сверяется со справочником. Отказ приходит до
        сети: мастер сразу видит «Prusa (PrusaLink) не печатает .3mf —
        переслайсите в .gcode или .bgcode», а не «загрузка не удалась» после
        передачи десятков мегабайт.

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
        Отправляет подготовленный файл: `PUT /api/v1/files/<storage>/<name>`.

        Тело запроса — сам файл, поэтому `requests` читает его с диска потоком:
        для G-code в сотни мегабайт это принципиально. Заголовки:

          - `Content-Type: application/octet-stream` — PrusaLink не разбирает
            multipart, ему нужен файл как есть;
          - `Print-After-Upload: ?0` — печать запускает агент отдельной
            командой, иначе принтер начал бы печатать до отчёта серверу;
          - `Overwrite: ?1` — повторная попытка после обрыва перезаписывает уже
            отправленный файл вместо 409.

        Успех — 201 (`{"storage": "USB", "path": …, "name": …}`); 200 принимаем
        на случай прошивки, которая отвечает 200 на перезапись.
        """
        headers = self._headers()
        headers["Content-Type"] = "application/octet-stream"
        headers["Print-After-Upload"] = "?0"
        headers["Overwrite"] = "?1"

        try:
            with open(plan.path, "rb") as gcode:
                response = requests.put(
                    self._file_url(plan.remote_name),
                    headers=headers,
                    data=gcode,
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
                f"G-code не загружен: {self._http_reason(response, _FILE_HINTS)}"
            )
            logger.error(
                "G-code %s не загружен на %s: %s",
                plan.remote_name,
                self.ip_address,
                self._http_reason(response, _FILE_HINTS),
            )
            return False

        logger.info(
            "G-code %s загружен на %s в хранилище %s (%d байт)",
            plan.remote_name,
            self.ip_address,
            self.storage,
            plan.size,
        )
        self.last_error = None
        return True

    def start_print(self, remote_name: str) -> bool:
        """
        Запускает печать загруженного файла.

        `POST /api/v1/files/<storage>/<remote_name>` с `{"command": "print"}`:
        PrusaLink отвечает 204 без тела, когда команда принята. 404 — файла на
        принтере нет (например, загрузка не дошла), 409 — принтер занят печатью.
        """
        try:
            response = requests.post(
                self._file_url(remote_name),
                headers=self._headers(),
                json={"command": "print"},
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

        if response.status_code not in (200, 204):
            self.last_error = (
                f"печать не запущена: {self._http_reason(response, _FILE_HINTS)}"
            )
            logger.error(
                "Печать %s не запущена на %s: %s",
                remote_name,
                self.ip_address,
                self._http_reason(response, _FILE_HINTS),
            )
            return False

        logger.info("Печать %s запущена на %s", remote_name, self.ip_address)
        self.last_error = None
        return True

    def _job_command(self, action: str, label: str) -> bool:
        """
        Команда текущему заданию: `POST /api/v1/job` с `{"action": ...}`.

        Пауза, возврат и остановка различаются только действием, поэтому
        `label` отдельный: журнал должен говорить, что именно просили.

        На 400/404/405 прошивка не поняла `POST` (документация PrusaLink
        описывает `PUT` с `command`, а отмену — `DELETE`): повторяем
        документированным запросом. Остальные коды — отказ, повтор не поможет.
        """
        try:
            response = requests.post(
                f"{self.base_url}/api/v1/job",
                headers=self._headers(),
                json={"action": action},
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as error:
            self.last_error = f"{label} не отправлена: {error}"
            logger.error(
                "%s на %s не отправлена: %s",
                label.capitalize(),
                self.ip_address,
                error,
            )
            return False

        if response.status_code in (200, 204):
            logger.info("%s принята на %s", label.capitalize(), self.ip_address)
            self.last_error = None
            return True

        if response.status_code in _FALLBACK_STATUSES:
            logger.warning(
                "PrusaLink %s не принял POST /api/v1/job (HTTP %s), "
                "повторяю документированным запросом",
                self.ip_address,
                response.status_code,
            )
            return self._documented_job_command(action, label)

        self.last_error = (
            f"{label} не отправлена: {self._http_reason(response, _JOB_HINTS)}"
        )
        logger.error(
            "%s на %s не отправлена: %s",
            label.capitalize(),
            self.ip_address,
            self._http_reason(response, _JOB_HINTS),
        )
        return False

    def _documented_job_command(self, action: str, label: str) -> bool:
        """
        Второй способ управления заданием из документации PrusaLink.

        Пауза и возврат — `PUT /api/v1/job` с `{"command": ...}`, отмена —
        `DELETE /api/v1/job`. Сюда попадаем только после отказа `POST`, поэтому
        в журнале уже есть запись о первой попытке.

        404 на `DELETE` — печати уже нет: для агента это успех, закрывать
        нечего. Пауза без текущего задания — наоборот, отказ: мастер нажал
        кнопку, а принтер простоял, и об этом нужно сказать.
        """
        try:
            if action == "stop":
                response = requests.delete(
                    f"{self.base_url}/api/v1/job",
                    headers=self._headers(),
                    timeout=REQUEST_TIMEOUT,
                )
            else:
                response = requests.put(
                    f"{self.base_url}/api/v1/job",
                    headers=self._headers(),
                    json={"command": action},
                    timeout=REQUEST_TIMEOUT,
                )
        except requests.RequestException as error:
            self.last_error = f"{label} не отправлена: {error}"
            logger.error(
                "%s на %s не отправлена: %s",
                label.capitalize(),
                self.ip_address,
                error,
            )
            return False

        if action == "stop" and response.status_code == 404:
            logger.info(
                "PrusaLink %s: печати уже нет — останавливать нечего",
                self.ip_address,
            )
            self.last_error = None
            return True

        if response.status_code not in (200, 204):
            self.last_error = (
                f"{label} не отправлена: {self._http_reason(response, _JOB_HINTS)}"
            )
            logger.error(
                "%s на %s не отправлена: %s",
                label.capitalize(),
                self.ip_address,
                self._http_reason(response, _JOB_HINTS),
            )
            return False

        logger.info(
            "%s принята на %s (документированный запрос)",
            label.capitalize(),
            self.ip_address,
        )
        self.last_error = None
        return True

    def pause_print(self) -> bool:
        """Ставит печать на паузу: `POST /api/v1/job` с `{"action": "pause"}`."""
        return self._job_command("pause", "пауза")

    def resume_print(self) -> bool:
        """Снимает печать с паузы: `{"action": "resume"}`."""
        return self._job_command("resume", "возврат")

    def stop_print(self) -> bool:
        """
        Останавливает печать: `{"action": "stop"}`, при отказе — `DELETE`.

        PrusaLink оставляет файл в хранилище: агент его не удаляет — имя
        содержит идентификатор задания, и повторная печать начинается с новой
        загрузки.
        """
        return self._job_command("stop", "остановка")

    def _read_job_progress(self) -> tuple[int, int]:
        """
        Прогресс и остаток из `GET /api/v1/job`.

        204 и 404 — задания нет: принтер в простое, возвращаем нули. Прочие
        отказы тоже дают нули: состояние уже получено из `/api/v1/status`, и
        из-за отсутствия прогресса не стоит объявлять печать сорванной —
        `get_status()` сообщит его состояние, а мастер увидит `printing` с
        прогрессом 0, пока PrusaLink не начнёт отдавать задание.
        """
        try:
            response = requests.get(
                f"{self.base_url}/api/v1/job",
                headers=self._headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as error:
            logger.warning("Прогресс %s не получен: %s", self.ip_address, error)
            return 0, 0

        if response.status_code in (204, 404):
            return 0, 0

        if response.status_code != 200:
            logger.warning(
                "Прогресс %s не получен: %s",
                self.ip_address,
                self._http_reason(response),
            )
            return 0, 0

        payload = self._read_json(response)

        if payload is None:
            return 0, 0

        return (
            _as_percent(payload.get("progress")),
            _as_seconds(payload.get("time_remaining")),
        )

    def get_status(self) -> dict[str, Any]:
        """
        Состояние печати из двух запросов: `/api/v1/status` и `/api/v1/job`.

        PrusaLink разделяет их: состояние принтера (`printer.state`) живёт в
        `/api/v1/status`, а прогресс задания — в `/api/v1/job`. Состояние
        обязательно, прогресс — нет: если задания нет, принтер всё равно
        расскажет, что он в простое.

        `printer.state` приходит в верхнем регистре (`PRINTING`, `PAUSED`,
        `FINISHED`, `ATTENTION`) и переводится в статус агента по `_STATE_MAP`.
        `progress` — уже проценты 0…100, `time_remaining` — секунды.

        Сеть и 5xx дают `{"status": "error", ...}`: цикл агента продолжит опрос,
        а мастер увидит, что принтер не отвечает.
        """
        try:
            response = requests.get(
                f"{self.base_url}/api/v1/status",
                headers=self._headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as error:
            logger.error("Состояние %s не получено: %s", self.ip_address, error)
            return self._error_status()

        if response.status_code != 200:
            logger.error(
                "Состояние %s не получено: %s",
                self.ip_address,
                self._http_reason(response),
            )
            return self._error_status()

        payload = self._read_json(response)

        if payload is None:
            return self._error_status()

        printer = _as_mapping(payload.get("printer"))
        raw_state = printer.get("state")
        state = raw_state.strip().lower() if isinstance(raw_state, str) else ""
        agent_status = _STATE_MAP.get(state)

        if agent_status is None:
            logger.warning(
                "PrusaLink %s: неизвестное состояние печати %r, отдаю error",
                self.ip_address,
                raw_state,
            )
            agent_status = "error"

        progress, remaining_time = self._read_job_progress()

        return {
            "status": agent_status,
            "progress": progress,
            "remaining_time": remaining_time,
        }
