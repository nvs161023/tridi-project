"""
Адаптер Elegoo (Centauri Carbon) — протокол SDCP.

SDCP — два канала: WebSocket 3030 для команд и состояния, HTTP 80 для файла.
Оба нужны: WebSocket не принимает файл, а HTTP не умеет ни старт, ни паузу.

Команды идут конвертом

    {"Id": "<uuid>", "Data": {"Cmd": 0, "Data": {}, "RequestID": "<uuid>",
     "MainboardID": "<плата>", "TimeStamp": 0, "From": "Web"},
     "Topic": "sdcp/request/<плата>"}

и адресуются идентификатором платы (`MainboardID`): до первого ответа он
неизвестен, поэтому `connect()` отправляет `Cmd: 0` с пустым `MainboardID` и
топиком `sdcp/request/0` — прошивка отвечает и сообщает свой номер. Номер
берётся ещё и из `printer_secrets` (`mainboardId`): так работает принтер, у
которого бродкаст запрещён политикой сети, а номер мастер вписал руками.

Что уходит:

  - `Cmd: 0` — состояние (и подписка на отчёты: после него прошивка присылает
    `Attributes` сама);
  - `Cmd: 128` — старт печати: `{"Filename": <имя>, "StartLayer": 0,
    "path_prefix": "/local"}`;
  - `Cmd: 129` — пауза, `Cmd: 130` — остановка, `Cmd: 131` — возврат;
  - `POST /uploadFile/upload` — `multipart/form-data`: поля `S-File-MD5`,
    `Check: 1`, `Offset: 0`, `Uuid`, `TotalSize` и файл в поле `File`.

MD5. Прошивка сверяет контрольную сумму принятого файла, поэтому адаптер
переопределяет `prepare_upload()` и считает `file_digest()` один раз: без суммы
загрузка отклоняется уже после передачи тела, а на файле в сотни мегабайт это
минуты по Wi-Fi.

Ответ. На каждую команду приходит конверт с тем же `RequestID`; результат —
`Data.Data.Ack`, успех — 0. Молчание считаем отказом, а не успехом (в отличие
от Creality): SDCP подтверждает каждую команду, и прошивка, не ответившая на
`Cmd: 128`, печать не начнёт.

`Attributes`. Прошивка присылает их то объектом, то строкой с JSON внутри,
поэтому разбор один на оба вида. Отчёты приходят частичными (только
изменившиеся поля), поэтому кэш дополняется, а не заменяется: `Status` и
`Progress` лежат в разных пакетах, и заменять кэш значило бы терять прогресс.

Сеть. Ни `requests`, ни `websockets` не выпускают исключений наружу: закрытый
порт, разрыв WebSocket и таймаут — это запись в журнале и `False` (или статус
`error` у `get_status()`), а не падение агента.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from collections.abc import Mapping
from typing import Any, Final, cast

import requests
from websockets.exceptions import WebSocketException
from websockets.sync.client import ClientConnection, connect

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
from .formats import FormatError, file_digest

logger = logging.getLogger("agent.adapters.elegoo")

# WebSocket SDCP: команды и телеметрия. Порт один у всех моделей серии.
WS_PORT: Final = 3030

# Путь WebSocket: прошивка принимает соединение только на нём, корень отвечает
# обычной страницей и рукопожатие не подтверждает.
WS_PATH: Final = "/websocket"

# HTTP-служба принтера: файл загружается ею, а не WebSocket.
HTTP_PORT: Final = 80

# Открытие сокета, подтверждение подключения и ответ на команду. Опрос идёт раз
# в несколько секунд, и зависший сокет не должен держать очередь заданий.
WS_TIMEOUT = 5.0

# HTTP: паспорт не нужен, а загрузка идёт минутами.
UPLOAD_TIMEOUT = 120

UPLOAD_PATH: Final = "/uploadFile/upload"

# Номера команд SDCP. Строки, а не Enum: значения уходят в JSON как есть.
CMD_STATUS: Final = 0
CMD_START_PRINT: Final = 128
CMD_PAUSE: Final = 129
CMD_STOP: Final = 130
CMD_RESUME: Final = 131

# `Ack` в ответе: 0 — команда выполнена.
ACK_SUCCESS: Final = 0

# Топик запроса. До знакомства с принтером вместо номера платы идёт `0`:
# прошивка отвечает на такой запрос и сообщает свой `MainboardID`.
REQUEST_TOPIC: Final = "sdcp/request/{mainboard}"

# Как называть себя в конверте: прошивка пишет то же самое в ответах.
CLIENT_NAME: Final = "Web"

# Префикс пути файла в команде печати: файл лежит во внутренней памяти принтера.
FILE_PREFIX: Final = "/local"

# `Status` из `Attributes` → статус агента.
#
# `preheating`, `heating` и `filechecking` — печать: сразу после `Cmd: 128`
# прошивка проверяет файл и греет стол, и `idle` в этот момент main.py прочитал
# бы как «печать не начиналась» и закрыл задание провалом в первом же опросе.
#
# `complete` — простой: печать закончена, задание закроется как `done`.
# `stopping`, `stopped`, `error` и `exception` — ошибка с причиной в
# `last_error`: «печать идёт» после остановки мастер читал бы как обман.
_STATE_MAP: Final[dict[str, str]] = {
    "idle": "idle",
    "homed": "idle",
    "complete": "idle",
    "completed": "idle",
    "finished": "idle",
    "printing": "printing",
    "preheating": "printing",
    "heating": "printing",
    "filechecking": "printing",
    "resuming": "printing",
    "pausing": "paused",
    "paused": "paused",
    "stopping": "error",
    "stopped": "error",
    "error": "error",
    "exception": "error",
    "failed": "error",
}

# Поля `Attributes`: сборки называют их по-разному, берём первое найденное.
_STATE_FIELDS: Final[tuple[str, ...]] = ("Status", "status", "CurrentStatus")
_PROGRESS_FIELDS: Final[tuple[str, ...]] = ("Progress", "progress")
_REMAINING_FIELDS: Final[tuple[str, ...]] = ("RemainingTime", "remaining_time")
# Тики SDCP — секунды печати: остаток считается их разностью.
_TOTAL_TICKS_FIELDS: Final[tuple[str, ...]] = ("TotalTicks", "total_ticks")
_CURRENT_TICKS_FIELDS: Final[tuple[str, ...]] = ("CurrentTicks", "current_ticks")
_MODEL_FIELDS: Final[tuple[str, ...]] = (
    "MachineName",
    "machine_name",
    "Model",
    "model",
)
_FIRMWARE_FIELDS: Final[tuple[str, ...]] = (
    "FirmwareVersion",
    "firmware_version",
    "SoftwareVersion",
)

# Подсказки к кодам отказа: «HTTP 401» мастер прочитает как проблему сети.
_UPLOAD_HINTS: Final[dict[int, str]] = {
    401: "принтер требует авторизацию — проверьте ключ доступа",
    403: "принтеру запрещена запись файла",
    404: "прошивка не знает /uploadFile/upload — проверьте модель",
    413: "файл больше памяти принтера",
    500: "прошивка не смогла записать файл — повторите загрузку",
}


def _text(value: Any) -> str:
    """Строка из поля ответа: числа тоже читаются, остальное — пусто."""
    if isinstance(value, str):
        return value.strip()

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)

    return ""


def _first_text(source: Mapping[str, Any], names: tuple[str, ...]) -> str | None:
    """Первое непустое строковое поле из списка имён: сборки называют их по-разному."""
    for name in names:
        text = _text(source.get(name))

        if text:
            return text

    return None


def _as_number(value: Any) -> float | None:
    """
    Число из поля ответа: `42`, `"42"`, `42.6`. None — значения нет.

    SDCP отдаёт `Progress` числом, но часть сборок присылает его строкой в
    `Attributes`, а `Attributes` может прийти и JSON-строкой целиком.
    """
    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        try:
            return float(value.strip().replace(",", "."))
        except ValueError:
            return None

    return None


def _as_percent(value: Any) -> int:
    """
    Проценты 0…100: SDCP отдаёт их готовыми (`Progress`).

    Дробное значение округляется, выход за границы зажимается: `-1` и `101` от
    прошивки — это «прогресса нет» и «печать закончена», а не повод показать
    мастеру отрицательный процент.
    """
    number = _as_number(value)

    if number is None:
        return 0

    return max(0, min(100, round(number)))


def _as_seconds(value: Any) -> int:
    """Секунды из поля ответа: отрицательное и `None` — 0."""
    number = _as_number(value)

    if number is None or number < 0:
        return 0

    return int(number)


def _as_mapping(value: Any) -> dict[str, Any] | None:
    """JSON-объект из вложенного поля; остальное — None."""
    if not isinstance(value, dict):
        return None

    return {str(key): item for key, item in value.items()}


def _pick(source: Mapping[str, Any], names: tuple[str, ...]) -> Any:
    """Значение первого найденного поля: `None` не считается находкой."""
    for name in names:
        value = source.get(name)

        if value is not None:
            return value

    return None


def _response_text(response: requests.Response) -> str:
    """Текст ответа для журнала: HTML от прокси обрезается до 200 символов."""
    try:
        text = (response.text or "").strip()
    except (ValueError, OSError):
        text = ""

    return text[:200] if text else "без описания"


def _read_json(
    response: requests.Response, quiet: bool = False
) -> dict[str, Any] | None:
    """JSON-объект из ответа принтера; не JSON — None."""
    try:
        payload = response.json()
    except ValueError:
        if not quiet:
            logger.warning(
                "Elegoo ответил не JSON: HTTP %s, %r",
                response.status_code,
                _response_text(response),
            )

        return None

    return _as_mapping(payload)


def _http_reason(
    response: requests.Response, hints: Mapping[int, str] | None = None
) -> str:
    """
    Причина отказа HTTP: подсказка по коду и текст от принтера.

    Подсказка идёт первой: «HTTP 413: файл больше памяти принтера» мастер
    поймёт, а «HTTP 413, Request Entity Too Large» заставит искать причину в
    сети.
    """
    hint = (hints or {}).get(response.status_code)

    if hint:
        return f"HTTP {response.status_code}: {hint} ({_response_text(response)})"

    return f"HTTP {response.status_code}, {_response_text(response)}"


def _parse_message(raw: str | bytes) -> dict[str, Any] | None:
    """Сообщение WebSocket как JSON-объект; мусор и не объект — None."""
    try:
        payload = json.loads(raw)
    except ValueError:
        return None

    return _as_mapping(payload)


def _envelope(
    command: int, payload: dict[str, Any], mainboard_id: str
) -> dict[str, Any]:
    """
    Конверт запроса SDCP: `Id`, `Data` с командой и `Topic`.

    `RequestID` — то, по чему ответ отличается от отчёта прошивки, поэтому он
    свой у каждой команды. `TimeStamp: 0` — так советует спецификация SDCP:
    часть прошивок сравнивает время с собственным и отклоняет запрос, если
    часы агента ушли вперёд.
    """
    return {
        "Id": str(uuid.uuid4()),
        "Data": {
            "Cmd": command,
            "Data": payload,
            "RequestID": str(uuid.uuid4()),
            "MainboardID": mainboard_id,
            "TimeStamp": 0,
            "From": CLIENT_NAME,
        },
        "Topic": REQUEST_TOPIC.format(mainboard=mainboard_id or "0"),
    }


def _request_id(message: Mapping[str, Any]) -> str | None:
    """`RequestID` из конверта — ключ, по которому узнаётся ответ на команду."""
    data = _as_mapping(message.get("Data"))

    if data is None:
        return None

    return _first_text(data, ("RequestID", "RequestId"))


def _mainboard_id(message: Mapping[str, Any]) -> str | None:
    """
    Идентификатор платы из конверта.

    Прошивка кладёт `MainboardID` на верхний уровень, часть сборок — ещё и в
    `Data`. Номер нужен для топика и для карточки принтера: по нему мастер
    отличает один Centauri Carbon от другого в общем цеху.
    """
    top = _first_text(message, ("MainboardID", "MainboardId"))

    if top is not None:
        return top

    data = _as_mapping(message.get("Data"))

    if data is None:
        return None

    return _first_text(data, ("MainboardID", "MainboardId"))


def _attributes(message: Mapping[str, Any]) -> dict[str, Any] | None:
    """
    `Attributes` из отчёта или ответа на `Cmd: 0`.

    Прошивка присылает их объектом или строкой с JSON внутри — оба вида
    читаются здесь, иначе на одной сборке состояние было бы, а на другой «нет
    данных».
    """
    data = _as_mapping(message.get("Data"))

    if data is None:
        return None

    raw = data.get("Attributes")

    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            return None

    return _as_mapping(raw)


def _ack_refusal(message: Mapping[str, Any]) -> str | None:
    """
    Отказ команды по `Data.Data.Ack`: 0 — успех.

    Поля нет — считаем подтверждением: так отвечает прошивка, собравшая ответ
    без `Ack`, а саму команду уже выполнившая. Не ноль — номер ошибки, который
    мастеру полезнее показать, чем «команда не отправлена».
    """
    data = _as_mapping(message.get("Data"))

    if data is None:
        return None

    result = _as_mapping(data.get("Data"))

    if result is None:
        return None

    ack = _as_number(result.get("Ack"))

    if ack is None or ack == ACK_SUCCESS:
        return None

    return f"Ack {int(ack)}"


def _upload_refusal(payload: dict[str, Any] | None) -> str | None:
    """
    Отказ в теле ответа на загрузку.

    HTTP 200 не значит «файл принят»: Centauri Carbon отвечает им и на отказ,
    кладя результат в `success` или `code`. Пустое тело и не-JSON ответ
    считаются успехом — так отвечает часть сборок.
    """
    if payload is None:
        return None

    if payload.get("success") is False:
        return _first_text(payload, ("message", "msg", "error")) or "success: false"

    code = _as_number(payload.get("code"))

    if code is None or code == 0:
        return None

    message = _first_text(payload, ("message", "msg", "error"))

    if message:
        return f"code {int(code)}: {message}"

    return f"code {int(code)}"


def _remaining(attributes: Mapping[str, Any]) -> int:
    """
    Остаток печати в секундах.

    Отдельного `RemainingTime` прошивка обычно не присылает: SDCP отдаёт
    `TotalTicks` и `CurrentTicks` — время печати в секундах, поэтому остаток
    считается разностью. Отрицательная разность (печать закончилась, а
    `TotalTicks` остался) превращается в 0.
    """
    explicit = _as_seconds(_pick(attributes, _REMAINING_FIELDS))

    if explicit:
        return explicit

    total = _as_number(_pick(attributes, _TOTAL_TICKS_FIELDS))
    current = _as_number(_pick(attributes, _CURRENT_TICKS_FIELDS))

    if total is None or current is None:
        return 0

    return max(0, int(total - current))


class ElegooAdapter(BasePrinterAdapter):
    """
    Принтер Elegoo (Centauri Carbon): WebSocket 3030 для команд, HTTP 80 для
    файла.
    """

    # Ключ протокола в справочнике: по нему `prepare_upload()` сверяет формат
    # файла — SDCP печатает G-code из внутренней памяти.
    protocol_key = "elegoo"

    # Что адаптер действительно делает: 129, 130 и 131 — пауза, остановка и
    # возврат, поэтому интерфейс показывает эти кнопки.
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

    # `Cmd: 128` берёт G-code из папки `/local`; контейнер `.3mf` прошивка не
    # разбирает.
    accepted_formats = (".gcode",)

    def __init__(
        self,
        ip_address: str,
        api_key: str,
        secrets: Mapping[str, str] | None = None,
    ) -> None:
        """
        `ip_address` — адрес принтера: `192.168.1.80`, `centauri.local` или
        `http://192.168.1.80`. Порт в адресе относится к HTTP (загрузка файла),
        WebSocket всегда 3030: служба команд у прошивки одна, а через прокси
        мастер попадает именно на HTTP.

        `secrets` — содержимое `workshop_printers.printer_secrets`. Нужен
        `mainboardId` — адрес платы для топика SDCP; если он не задан,
        `connect()` узнаёт номер у принтера сам.

        `api_key` прошивка не проверяет и в запросах не ждёт: поле остаётся в
        контракте адаптера и в форме Мастерской, но в заголовки не попадает.
        """
        super().__init__(ip_address=ip_address, api_key=api_key, secrets=secrets)

        address = ip_address.strip().rstrip("/")

        for scheme in ("http://", "https://"):
            if address.startswith(scheme):
                address = address[len(scheme) :]

        host, _, port = address.partition(":")
        host = host or address
        http_port = port if port.isdigit() else str(HTTP_PORT)

        self.host = host
        # Базовый URL без слэша на конце: путь загрузки начинается с `/`.
        self.base_url = f"http://{host}:{http_port}"
        self.ws_url = f"ws://{host}:{WS_PORT}{WS_PATH}"
        # Номер платы: из секретов до подключения, дальше — из ответа принтера.
        self.mainboard_id = (self.secrets.get("mainboardId") or "").strip()
        self._ws: ClientConnection | None = None
        # Последние `Attributes`: прошивка присылает их частичными пакетами, и
        # `Status` с `Progress` могут прийти в разных.
        self._status: dict[str, Any] = {}

    def close(self) -> None:
        """Закрывает WebSocket: цикл агента зовёт метод в конце задания."""
        self._drop_socket()

    def _open_socket(self) -> ClientConnection | None:
        """
        Открывает `ws://<ip>:3030/websocket`.

        `ping_interval=None`: служебные WS-пинги прошивка понимать не обязана, а
        закрытие по неотвеченному пингу выглядело бы как «принтер выключился».
        Живость канала видна по ответам на `Cmd: 0`, которые агент шлёт каждым
        опросом.
        """
        try:
            # `cast` из-за legacy-режима в аннотации `connect()`: без него
            # pyright считает, что вернуться может объект переподключения.
            connection = cast(
                ClientConnection,
                connect(
                    self.ws_url,
                    open_timeout=WS_TIMEOUT,
                    close_timeout=WS_TIMEOUT,
                    ping_interval=None,
                ),
            )
        except (WebSocketException, OSError) as error:
            self.last_error = f"WebSocket {self.ws_url} не открылся: {error}"
            logger.error(
                "Elegoo %s: WebSocket не открылся: %s", self.ip_address, error
            )

            return None

        self._ws = connection

        return connection

    def _connection(self) -> ClientConnection | None:
        """Живой сокет: открывает новый, если прежний закрылся или его не было."""
        if self._ws is not None:
            return self._ws

        return self._open_socket()

    def _drop_socket(self) -> None:
        """Закрывает сокет и забывает его: следующая команда откроет новый."""
        connection, self._ws = self._ws, None

        if connection is None:
            return

        try:
            connection.close()
        except (WebSocketException, OSError) as error:
            logger.debug(
                "Elegoo %s: сокет закрыт с ошибкой: %s", self.ip_address, error
            )

    def _recv(self, connection: ClientConnection) -> dict[str, Any] | None:
        """Одно сообщение из сокета; None — таймаут, обрыв или мусор."""
        try:
            raw = connection.recv(timeout=WS_TIMEOUT)
        except TimeoutError:
            return None
        except (WebSocketException, OSError) as error:
            self._drop_socket()
            self.last_error = f"WebSocket {self.ws_url} закрыт: {error}"
            logger.error(
                "Elegoo %s: соединение закрыто: %s", self.ip_address, error
            )

            return None

        return _parse_message(raw)

    def _request(
        self, command: int, payload: dict[str, Any] | None, label: str
    ) -> dict[str, Any] | None:
        """
        Отправляет команду и ждёт конверт с тем же `RequestID`.

        Сообщения с другим `RequestID` — отчёты прошивки: их `Attributes`
        сливаются в кэш, а ожидание продолжается. После `Cmd: 0` подписка
        начинается сразу, и первый отчёт может обогнать ответ на команду.
        """
        connection = self._connection()

        if connection is None:
            return None

        # Прежняя причина отказа больше не действует: команда отправляется
        # заново, и если принтер промолчит, мастер должен увидеть «не ответил»,
        # а не ошибку прошлой попытки.
        self.last_error = None
        message = _envelope(command, payload or {}, self.mainboard_id)
        expected = _request_id(message)

        try:
            connection.send(json.dumps(message))
        except (WebSocketException, OSError) as error:
            self._drop_socket()
            self.last_error = f"WebSocket {self.ws_url} закрыт: {error}"
            logger.error(
                "Elegoo %s: «%s» не отправлено: %s",
                self.ip_address,
                label,
                error,
            )

            return None

        reply = self._read_reply(connection, expected)

        if reply is None:
            logger.warning(
                "Elegoo %s не ответил на «%s» за %.0f с",
                self.ip_address,
                label,
                WS_TIMEOUT,
            )

        return reply

    def _read_reply(
        self, connection: ClientConnection, expected: str | None
    ) -> dict[str, Any] | None:
        """
        Ответ на команду: конверт с ожидаемым `RequestID`.

        Всё остальное — отчёты прошивки: их `Attributes` сливаются в кэш и не
        прерывают ожидание. `None` — сокет закрылся или принтер промолчал
        `WS_TIMEOUT` секунд.
        """
        deadline = time.monotonic() + WS_TIMEOUT

        while time.monotonic() < deadline:
            incoming = self._recv(connection)

            if incoming is None:
                return None

            attributes = _attributes(incoming)

            if attributes is not None:
                self._status.update(attributes)

            if expected is None:
                return incoming

            if _request_id(incoming) == expected:
                return incoming

        return None

    def connect(self) -> bool:
        """
        WebSocket и `Cmd: 0`: принтер отвечает конвертом с `MainboardID`.

        Номер платы — адрес всех следующих команд. Если в секретах он уже есть,
        ответ принтера сверяется с ним: расхождение значит, что в базе записан
        номер другого принтера, и об этом стоит сказать в журнале.
        """
        self._drop_socket()
        self._status = {}
        message = self._request(CMD_STATUS, {}, "подключение")

        if message is None:
            if self.last_error is None:
                self.last_error = (
                    "WebSocket открылся, но на Cmd: 0 принтер не ответил: "
                    "это не SDCP"
                )
            logger.error(
                "Elegoo %s: подключение не подтверждено", self.ip_address
            )
            self._drop_socket()

            return False

        board = _mainboard_id(message)

        if board is None and not self.mainboard_id:
            self.last_error = "принтер не назвал MainboardID: команды адресовать нечем"
            logger.error("Elegoo %s: %s", self.ip_address, self.last_error)
            self._drop_socket()

            return False

        if board is not None:
            if self.mainboard_id and board != self.mainboard_id:
                logger.warning(
                    "Elegoo %s: MainboardID %s из секретов не совпал с ответом "
                    "%s — использую ответ принтера",
                    self.ip_address,
                    self.mainboard_id,
                    board,
                )

            self.mainboard_id = board

        logger.info(
            "Elegoo %s доступен: плата %s",
            self.ip_address,
            self.mainboard_id,
        )
        self.last_error = None

        return True

    def prepare_upload(self, local_path: str, remote_name: str) -> UploadPlan:
        """
        Готовит файл и считает MD5: прошивка сверяет сумму после передачи.

        Сумма нужна заголовку загрузки (`S-File-MD5`) и команде печати, поэтому
        считается здесь один раз: файл на сотни мегабайт второй раз читать
        незачем, а на Wi-Fi это минуты.
        """
        plan = super().prepare_upload(local_path, remote_name)

        return plan._replace(md5=file_digest(plan.path))

    def upload_file(self, local_path: str, remote_name: str) -> bool:
        """
        Загружает G-code в `POST /uploadFile/upload` multipart-формой.

        Поля формы: `S-File-MD5` (сумма файла), `Check: 1` (сверять сумму),
        `Offset: 0` (загрузка с начала, докачки прошивка не просит), `Uuid`
        (идентификатор передачи) и `TotalSize` (размер). Файл — в поле `File`.

        `FormatError` и `OSError` подготовки становятся `last_error` и `False`:
        так мастер видит причину, а не «задание провалилось».
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
        Отправляет подготовленный файл multipart-формой.

        Поля идут частями формы без имени файла (`(None, value)`), а сам
        G-code — последней частью `File`: так его ждёт прошивка, и так `requests`
        считает `Content-Length` без чтения файла в память.
        """
        parts: dict[str, Any] = {
            "S-File-MD5": (None, plan.md5 or file_digest(plan.path)),
            "Check": (None, "1"),
            "Offset": (None, "0"),
            "Uuid": (None, str(uuid.uuid4())),
            "TotalSize": (None, str(plan.size)),
        }

        try:
            with open(plan.path, "rb") as gcode:
                parts["File"] = (
                    plan.remote_name,
                    gcode,
                    "application/octet-stream",
                )
                response = requests.post(
                    f"{self.base_url}{UPLOAD_PATH}",
                    files=parts,
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
            # Проверка после RequestException: он тоже наследник OSError, но
            # сетевую ошибку нужно отличать от нечитаемого файла.
            self.last_error = f"файл не прочитан: {error}"
            logger.error("G-code %s не прочитан: %s", plan.path, error)

            return False

        if response.status_code not in (200, 201):
            reason = _http_reason(response, _UPLOAD_HINTS)
            self.last_error = f"G-code не загружен: {reason}"
            logger.error(
                "G-code %s не загружен на %s: %s",
                plan.remote_name,
                self.ip_address,
                reason,
            )

            return False

        refusal = _upload_refusal(_read_json(response, quiet=True))

        if refusal is not None:
            self.last_error = f"G-code не загружен: {refusal}"
            logger.error(
                "G-code %s не принят %s: %s",
                plan.remote_name,
                self.ip_address,
                refusal,
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
        Запускает печать: `Cmd: 128`.

        `Filename` — имя, под которым файл лёг на принтер, `path_prefix` —
        папка внутренней памяти (`/local`), `StartLayer: 0` — с первого слоя.
        Прошивка ищет файл по имени, поэтому переименовать его после загрузки
        уже нельзя.
        """
        payload = {
            "Filename": remote_name,
            "StartLayer": 0,
            "path_prefix": FILE_PREFIX,
        }

        return self._command(CMD_START_PRINT, payload, "запуск печати")

    def pause_print(self) -> bool:
        """Пауза: `Cmd: 129` с пустыми данными — команда сама по себе полная."""
        return self._command(CMD_PAUSE, {}, "пауза")

    def resume_print(self) -> bool:
        """Снятие с паузы: `Cmd: 131`."""
        return self._command(CMD_RESUME, {}, "возврат")

    def stop_print(self) -> bool:
        """
        Остановка печати: `Cmd: 130`.

        Файл на принтере адаптер не удаляет: имя содержит идентификатор
        задания, и повторная печать начинается с новой загрузки.
        """
        return self._command(CMD_STOP, {}, "остановка")

    def _command(
        self, command: int, payload: dict[str, Any] | None, label: str
    ) -> bool:
        """
        Команда SDCP: True — `Ack` равен нулю.

        Молчание — отказ, а не успех: SDCP подтверждает каждую команду, и
        прошивка, не ответившая на `Cmd: 128`, печать не начнёт. Creality в
        такой же ситуации считает `set` отправленным — там прошивки
        действительно не подтверждают команды.
        """
        message = self._request(command, payload, label)

        if message is None:
            if self.last_error is None:
                self.last_error = f"{label} не подтверждена: принтер не ответил"
            logger.error(
                "Elegoo %s: %s не подтверждена: %s",
                self.ip_address,
                label,
                self.last_error,
            )

            return False

        refusal = _ack_refusal(message)

        if refusal is not None:
            self.last_error = f"{label} отвергнута: {refusal}"
            logger.error(
                "Elegoo %s: %s отвергнута: %s",
                self.ip_address,
                label,
                refusal,
            )

            return False

        logger.info("%s принята на %s", label.capitalize(), self.ip_address)
        self.last_error = None

        return True

    def get_status(self) -> dict[str, Any]:
        """
        Состояние из `Cmd: 0`: `Status`, `Progress` и тики печати.

        `Status` переводится по `_STATE_MAP`: `printing` и `preheating` —
        печать, `paused` и `pausing` — пауза, `idle`, `homed` и `complete` —
        простой, `error`, `exception` и `stopped` — ошибка с причиной в
        `last_error`. `preheating` считается печатью намеренно: сразу после
        `Cmd: 128` прошивка проверяет файл и греет стол, а простой в этот момент
        main.py прочитал бы как «печать не начиналась» и закрыл задание
        провалом.

        Прогресс — готовые проценты (`Progress`), остаток — разность
        `TotalTicks` и `CurrentTicks` в секундах.

        Прошивка присылает отчёты частичными пакетами, поэтому читается кэш
        последних `Attributes`, а не только ответ на команду: `Status` и
        `Progress` могут прийти в разных пакетах.

        Успешный опрос `last_error` очищает: иначе прежний сбой закрыл бы уже
        идущую печать.
        """
        message = self._request(CMD_STATUS, {}, "состояние")

        if message is None:
            if self.last_error is None:
                self.last_error = "принтер не ответил на запрос состояния"

            return self._error_status()

        attributes = _attributes(message)

        if attributes is not None:
            self._status.update(attributes)

        progress = _as_percent(_pick(self._status, _PROGRESS_FIELDS))
        raw_state = _first_text(self._status, _STATE_FIELDS)
        state = raw_state.lower() if raw_state is not None else ""
        agent_status = _STATE_MAP.get(state)
        # Остаток простоя — ноль: тики остаются в кэше от прошлой печати, и
        # «осталось 40 минут» у принтера, который уже закончил, читалось бы как
        # работающая печать.
        remaining = 0 if agent_status == "idle" else _remaining(self._status)

        if agent_status is None:
            self.last_error = f"неизвестное состояние печати: {raw_state!r}"
            logger.warning(
                "Elegoo %s: неизвестное состояние печати %r, отдаю error",
                self.ip_address,
                raw_state,
            )

            return {
                "status": "error",
                "progress": progress,
                "remaining_time": remaining,
            }

        if agent_status == "error":
            self.last_error = f"принтер остановил печать ({raw_state})"
            logger.error(
                "Elegoo %s: печать остановлена принтером (%s)",
                self.ip_address,
                raw_state,
            )
        else:
            self.last_error = None

        return {
            "status": agent_status,
            "progress": progress,
            "remaining_time": remaining,
        }

    def probe(self) -> dict[str, Any]:
        """
        Проба для формы «Проверить принтер»: плата, модель и прошивка.

        `Cmd: 0` заодно и подключение: мастеру нужен ответ до сохранения
        принтера. Отказ сети возвращает статику класса, как у остальных
        адаптеров, и причину в `last_error`.
        """
        message = self._request(CMD_STATUS, {}, "паспорт")

        if message is not None:
            self.last_error = None
            board = _mainboard_id(message)

            if board is not None:
                self.mainboard_id = board

        result = super().probe()
        model = _first_text(self._status, _MODEL_FIELDS)
        firmware = _first_text(self._status, _FIRMWARE_FIELDS)

        if model is not None:
            result["model"] = model

        if firmware is not None:
            result["firmware"] = firmware

        if self.mainboard_id:
            result["serial_number"] = self.mainboard_id

        return result

    @staticmethod
    def _error_status() -> dict[str, Any]:
        """Ответ get_status(), когда состояние получить не удалось."""
        return {"status": "error", "progress": 0, "remaining_time": 0}
