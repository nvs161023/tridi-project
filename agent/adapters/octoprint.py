"""
Адаптер OctoPrint.

OctoPrint — HTTP REST API вокруг G-code принтера: по умолчанию порт 80, префикс
`/api`, ключ доступа (Settings → API Key) уходит заголовком `X-Api-Key`. Для
мастера такой принтер в Мастерской помечен `protocol_type = "octoprint"`
(список протоколов — `PRINTER_PROTOCOLS` в lib/db/workshop-types.ts).

Какие запросы уходят:

  - `connect()`     — `GET /api/version`: 200 значит, что OctoPrint жив и ключ
    принят; версия сервера и API из ответа пишутся в журнал для диагностики;
  - `upload_file()` — `POST /api/files/local`, `multipart/form-data`, поле
    `file`, `select=true` (файл становится текущим для печати) и `print=false`:
    печать запускает агент отдельной командой, иначе принтер начал бы печатать
    раньше, чем агент узнал, что загрузка прошла;
  - `start_print()` — `POST /api/files/local/<remote_name>` с
    `{"command": "select", "print": true}`: OctoPrint выбирает файл и сразу
    ставит его в печать, а подтверждение приходит одним ответом;
  - `get_status()`  — `GET /api/job`: `state`, `job.progress.completion` (это
    уже проценты 0…100) и `job.progress.printTimeLeft` (секунды);
  - `pause_print()` / `resume_print()` — `POST /api/job` с
    `{"command": "pause", "action": "pause"|"resume"}`;
  - `stop_print()`  — `POST /api/job` с `{"command": "cancel"}`.

Почему прогресс читается из двух мест. С версии 1.3 OctoPrint перенёс прогресс
в `job.progress` и оставил верхний `progress` для совместимости. Читаем
`job.progress`, а если его нет — верхний: старые сборки и прокси перед принтером
отдают только его.

Проценты не пересчитываются. OctoPrint — единственный из дешёвых протоколов, кто
отдаёт прогресс сразу в процентах; Moonraker отдаёт долю 0…1, поэтому пересчёт
живёт в его адаптере, а не в общем коде.

Коды отказа, которые мастер увидит в причине: 401 — ключ не принят, 403 — ключу
запрещено действие, 409 — файл занят или принтер уже печатает, 413 — файл больше
лимита принтера, 415 — тип файла не поддерживается.

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

logger = logging.getLogger("agent.adapters.octoprint")

# Сколько ждать ответа OctoPrint. Без таймаута requests может ждать вечно, и
# цикл опроса встанет вместе с принтером.
REQUEST_TIMEOUT = 10

# Загрузка G-code идёт дольше опроса: файл на десятки мегабайт по Wi-Fi
# передаётся минутами, обрывать его на десяти секундах нельзя.
UPLOAD_TIMEOUT = 120
# `state` из `GET /api/job` (машина состояний OctoPrint) → статус агента.
#
# `paused` отдаём паузой, а не ошибкой: печать стоит по воле мастера, задание
# живо, и цикл мониторинга продолжает опрос.
#
# `offline`, `closed` и `connecting` — принтер без связи с платой: для агента это
# простой, а не срыв печати. `cancelling` — печать уже останавливают, ждать
# `idle` бессмысленно. Незнакомое состояние считаем ошибкой: молчаливое «всё
# хорошо» на ферме опаснее лишней записи в журнале.
_STATE_MAP: Final[dict[str, str]] = {
    "printing": "printing",
    "starting": "printing",
    "resuming": "printing",
    "finishing": "printing",
    "pausing": "paused",
    "paused": "paused",
    "operational": "idle",
    "offline": "idle",
    "closed": "idle",
    "connecting": "idle",
    "opening serial connection": "idle",
    "transfering file": "idle",
    "error": "error",
    "cancelling": "error",
}

# Подсказки к кодам отказа: «HTTP 401» мастер прочитает как проблему сети, хотя
# ключ просто не подходит. Текст от OctoPrint добавляется в причину следом.
_STATUS_HINTS: Final[dict[int, str]] = {
    401: "ключ API не принят — проверьте ключ принтера в настройках Мастерской",
    403: "ключу API запрещено это действие",
}

# У 409, 413 и 415 разный смысл в разных запросах: при загрузке 409 — файл занят,
# у команды — она не подходит к состоянию печати. Одна подсказка на все случаи
# врала бы мастеру, поэтому наборы дополняют общий.
_UPLOAD_HINTS: Final[dict[int, str]] = {
    409: "файл занят или принтер уже печатает",
    413: "файл больше лимита принтера",
    415: "тип файла не поддерживается — переслайсите в .gcode",
}
_JOB_HINTS: Final[dict[int, str]] = {
    409: "команда не подходит к текущему состоянию печати",
}


def _as_number(value: Any) -> float:
    """Число из ответа OctoPrint: отсутствие поля или мусор — 0.0."""
    # bool — подкласс int, но True в поле прогресса означает ошибку разбора.
    if isinstance(value, bool):
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    return 0.0


def _as_mapping(value: Any) -> dict[str, Any]:
    """Поле-объект из ответа OctoPrint; всё остальное — пустой словарь."""
    return value if isinstance(value, dict) else {}


def _as_percent(value: Any) -> int:
    """
    Прогресс в процентах 0…100.

    OctoPrint отдаёт готовые проценты, но `completion` бывает `None`, пока
    принтер только разбирает файл, и больше 100 на кривой сборке. Границы
    отсекаем здесь: в базе прогресс не должен вылезать за 100.
    """
    percent = _as_number(value)

    return int(round(min(max(percent, 0.0), 100.0)))


def _as_seconds(value: Any) -> int:
    """Остаток печати в секундах: отрицательное и мусор — 0 («неизвестно»)."""
    return int(round(max(_as_number(value), 0.0)))


class OctoPrintAdapter(BasePrinterAdapter):
    """Принтер под OctoPrint: REST API `/api/version`, `/api/files`, `/api/job`."""

    # Ключ протокола в справочнике: по нему `prepare_upload()` сверяет формат
    # файла — OctoPrint печатает G-code (`.gcode`, `.gco`, `.g`).
    protocol_key = "octoprint"

    # Что адаптер действительно делает. Пауза, возврат и отмена поддержаны
    # запросами `POST /api/job`, поэтому интерфейс показывает эти кнопки.
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

    # Расширения, которые OctoPrint печатает: `file_filter` по умолчанию —
    # `.gcode`, `.gco`, `.g`. Список повторяет `formats` в справочнике протокола
    # и уходит в пробу принтера, чтобы форма «Проверить принтер» не обещала
    # меньше, чем принтер умеет.
    accepted_formats = (".gcode", ".gco", ".g")

    def __init__(self, ip_address: str, api_key: str) -> None:
        """
        `ip_address` — адрес OctoPrint в сети мастера: `192.168.1.50`,
        `octopi.local` или готовый `http://192.168.1.50:5000`.

        Схему добавляем сами: в настройках Мастерской спрашивают адрес, а
        `http://` в поле ввода легко забыть или продублировать. Порт по
        умолчанию не подставляем: OctoPrint слушает 80 или 443 через обратный
        прокси, а `:5000` — это уже осознанный выбор мастера.
        """
        super().__init__(ip_address=ip_address, api_key=api_key)

        address = ip_address.strip().rstrip("/")

        if not address.startswith(("http://", "https://")):
            address = f"http://{address}"

        # Базовый URL без слэша на конце: пути ниже начинаются с `/`.
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
        """JSON-объект из ответа OctoPrint; не JSON — None."""
        try:
            payload = response.json()
        except ValueError:
            logger.error(
                "OctoPrint ответил не JSON: HTTP %s, %r",
                response.status_code,
                response.text[:200],
            )
            return None

        if not isinstance(payload, dict):
            logger.error("OctoPrint ответил не объектом: %r", payload)
            return None

        return payload

    @staticmethod
    def _error_message(response: requests.Response) -> str:
        """
        Текст ошибки OctoPrint.

        Ошибки приходят и строкой (`{"error": "File is not an allowed type"}`), и
        объектом со вложенным `code`/`message`, и HTML от обратного прокси. В
        журнале нужен человеческий текст, поэтому разбираем все три случая, а
        остальное обрезаем до двухсот символов.
        """
        try:
            payload = response.json()
        except ValueError:
            text = (response.text or "").strip()
            return text[:200] if text else "без описания"

        error = payload.get("error") if isinstance(payload, dict) else None

        if isinstance(error, str) and error.strip():
            return error.strip()[:200]

        if isinstance(error, dict) and error.get("message"):
            message = str(error["message"])
            code = error.get("code")
            return f"{message} (код {code})" if code is not None else message

        return "без описания"

    def _http_reason(
        self,
        response: requests.Response,
        extra: Mapping[int, str] | None = None,
    ) -> str:
        """
        Причина отказа для `last_error`: подсказка по коду и текст от сервера.

        Подсказка идёт первой: «HTTP 401: ключ API не принят» мастер поймёт, а
        «HTTP 401, Invalid API key» заставит искать проблему в сети. `extra`
        добавляет смысл кода в конкретном запросе: 409 при загрузке и 409 у
        команды — разные вещи.
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
        Проверяет, что OctoPrint отвечает и ключ принят.

        `GET /api/version` отдаёт 200, когда сервер жив, и 401, если ключ не
        подошёл. Версия сервера пишется в журнал: по ней мастер отличает старую
        сборку, где нет части эндпоинтов, от проблемы с ключом.
        """
        try:
            response = requests.get(
                f"{self.base_url}/api/version",
                headers=self._headers(),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as error:
            self.last_error = f"принтер не отвечает: {error}"
            logger.error("OctoPrint %s не отвечает: %s", self.ip_address, error)
            return False

        if response.status_code != 200:
            self.last_error = (
                f"принтер отверг подключение: {self._http_reason(response)}"
            )
            logger.error(
                "OctoPrint %s не принял подключение: %s",
                self.ip_address,
                self._http_reason(response),
            )
            return False

        payload = self._read_json(response) or {}
        version = payload.get("server")
        api = payload.get("api")

        if isinstance(version, str) and version.strip():
            logger.info(
                "OctoPrint %s доступен: сервер %s, API %s",
                self.ip_address,
                version.strip(),
                api if isinstance(api, str) else "неизвестно",
            )
        else:
            logger.info("OctoPrint %s доступен", self.ip_address)

        self.last_error = None
        return True

    def upload_file(self, local_path: str, remote_name: str) -> bool:
        """
        Загружает G-code в папку `local` OctoPrint.

        Подготовка — в `prepare_upload()` и `formats.py`: имя приводится к ASCII
        и безопасному виду, формат сверяется со справочником. Отказ приходит до
        сети: мастер сразу видит «OctoPrint не печатает .3mf», а не «загрузка
        не удалась» после передачи десятков мегабайт.

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
        Отправляет подготовленный файл в `POST /api/files/local`.

        `select=true` делает файл текущим, `print=false` печать не запускает:
        команду печати отправляет `start_print()` после того, как агент узнал об
        успешной загрузке. Иначе принтер начал бы печатать файл, о котором агент
        ещё не отчитался серверу.

        Успех — 201 (`{"done": true, "files": {...}}`); 200 принимаем на случай
        прокси, который переписывает код ответа. Файл открывается на время
        запроса: `requests` читает его потоком, закрывать нужно после отправки.
        """
        try:
            with open(plan.path, "rb") as gcode:
                response = requests.post(
                    f"{self.base_url}/api/files/local",
                    headers=self._headers(),
                    files={
                        "file": (
                            plan.remote_name,
                            gcode,
                            "application/octet-stream",
                        )
                    },
                    data={"select": "true", "print": "false"},
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
                f"G-code не загружен: {self._http_reason(response, _UPLOAD_HINTS)}"
            )
            logger.error(
                "G-code %s не загружен на %s: %s",
                plan.remote_name,
                self.ip_address,
                self._http_reason(response, _UPLOAD_HINTS),
            )
            return False

        logger.info(
            "G-code %s загружен на %s (%d байт)",
            plan.remote_name,
            self.ip_address,
            plan.size,
        )
        self.last_error = None
        return True

    def start_print(self, remote_name: str) -> bool:
        """
        Выбирает файл и запускает печать одним запросом.

        `POST /api/files/local/<remote_name>` с `{"command": "select",
        "print": true}`: OctoPrint отвечает 204 без тела, когда команда принята.
        Имя в пути кодируется (`quote`), хотя `prepare_upload()` уже убрал из
        него пробелы и кириллицу: файл мог быть загружен раньше, другим агентом
        или руками мастера.

        404 — файла на принтере нет (например, загрузка не дошла), 409 —
        принтер занят печатью или папка заблокирована.
        """
        path = quote(remote_name, safe="")

        try:
            response = requests.post(
                f"{self.base_url}/api/files/local/{path}",
                headers=self._headers(),
                json={"command": "select", "print": True},
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
                f"печать не запущена: {self._http_reason(response, _UPLOAD_HINTS)}"
            )
            logger.error(
                "Печать %s не запущена на %s: %s",
                remote_name,
                self.ip_address,
                self._http_reason(response, _UPLOAD_HINTS),
            )
            return False

        logger.info("Печать %s запущена на %s", remote_name, self.ip_address)
        self.last_error = None
        return True

    def _job_command(
        self, command: str, label: str, action: str | None = None
    ) -> bool:
        """
        Команда заданию: `POST /api/job`.

        Пауза и возврат у OctoPrint — одна команда `pause` с разным `action`,
        поэтому `label` отдельный: журнал должен говорить, что именно просили, а
        не «pause: pause». Успех — 204 без тела (200 принимаем: так отвечают
        сборки за обратным прокси).

        409 значит, что команда не подходит к текущему состоянию (пауза на
        простое, возврат без паузы): для мастера это отказ, а не успех.
        """
        payload: dict[str, Any] = {"command": command}

        if action is not None:
            payload["action"] = action

        try:
            response = requests.post(
                f"{self.base_url}/api/job",
                headers=self._headers(),
                json=payload,
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

        logger.info("%s принята на %s", label.capitalize(), self.ip_address)
        self.last_error = None
        return True

    def pause_print(self) -> bool:
        """Ставит печать на паузу: `{"command": "pause", "action": "pause"}`."""
        return self._job_command("pause", "пауза", action="pause")

    def resume_print(self) -> bool:
        """Снимает печать с паузы: `{"command": "pause", "action": "resume"}`."""
        return self._job_command("pause", "возврат", action="resume")

    def stop_print(self) -> bool:
        """
        Отменяет печать: `{"command": "cancel"}`.

        OctoPrint останавливает печать и оставляет файл в папке `local` — агент
        его не удаляет: имя содержит идентификатор задания, и повторная печать
        того же файла начинается с новой загрузки.
        """
        return self._job_command("cancel", "остановка")

    def get_status(self) -> dict[str, Any]:
        """
        Состояние печати из `GET /api/job`.

        `state` — машина состояний OctoPrint (`Printing`, `Paused`,
        `Operational`, `Error`, …), переводится в статус агента по `_STATE_MAP`.

        Прогресс берётся из `job.progress.completion` — это уже проценты 0…100;
        верхний `progress` читаем, только если `job.progress` нет (старые сборки
        до 1.3 и прокси, которые вырезают вложенный объект). `printTimeLeft`
        отдаётся секундами; `None` и отрицательные значения означают «оценки
        ещё нет» и превращаются в 0.

        Сеть, 5xx и мусор в ответе дают `{"status": "error", ...}`: цикл агента
        продолжит опрос, а мастер увидит, что принтер не отвечает.
        """
        try:
            response = requests.get(
                f"{self.base_url}/api/job",
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

        raw_state = payload.get("state")
        state = raw_state.strip().lower() if isinstance(raw_state, str) else ""
        agent_status = _STATE_MAP.get(state)

        if agent_status is None:
            logger.warning(
                "OctoPrint %s: неизвестное состояние печати %r, отдаю error",
                self.ip_address,
                raw_state,
            )
            agent_status = "error"

        progress_fields = (
            _as_mapping(_as_mapping(payload.get("job")).get("progress"))
            or _as_mapping(payload.get("progress"))
        )

        return {
            "status": agent_status,
            "progress": _as_percent(progress_fields.get("completion")),
            "remaining_time": _as_seconds(progress_fields.get("printTimeLeft")),
        }

