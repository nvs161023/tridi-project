"""
Адаптер Creality (Creality OS: K1, K2 Plus, Ender-3 V3).

Creality — единственный протокол фермы, где команды идут не HTTP-запросами, а
по WebSocket. HTTP остаётся только на паспорт принтера и на загрузку файла:

  - `GET /info` (у части прошивок `/detail`) отдаёт модель кодом: `F008` — K2
    Plus. Запрос идёт первым: он отвечает за доли секунды и сразу говорит,
    что на адресе принтер, а не чужой сервер на 80-м порту;
  - `POST /upload/<remote_name>` — `multipart/form-data`, поле `file`.
    Прошивка кладёт файл в свою папку сама, имя из формы и есть имя на
    принтере; `prepare_upload()` уже заменил пробелы на `_`
    (`sanitize_remote_name()` знает, что Creality просит именно так);
  - `ws://<ip>:9999` — команды и телеметрия.

Heartbeat. Прошивка держит WebSocket, пока агент шлёт
`{"ModeCode": "heart_beat"}` и получает `{"ModeCode": "heart_beat", "msg":
"ok"}`. Поэтому `heart_beat` уходит и при подключении, и перед каждой
командой: между опросами проходят секунды, а молчащий сокет прошивка рвёт.

Запросы и ответы:

  - состояние — `{"method": "get", "params": {"ReqPrinterPara": 1}}`; в ответе
    `state`, `printProgress` (проценты) и `printLeftTime` (секунды);
  - старт — `{"method": "set", "params": {"opGcodeFile":
    "printprt:/usr/data/<remote_name>"}}`;
  - пауза, возврат, отмена — `{"method": "set", "params": {"pause": 1|0}}` и
    `{"method": "set", "params": {"stop": 1}}`.

Две папки файлов. `opGcodeFile` принимает полный путь, и он разный у моделей:
K2 Plus печатает из `/usr/data/`, часть прошивок — из `/mnt/UDISK/`. Таблицы
«модель → папка» нет, а прошивка обновляется чаще модельного ряда, поэтому
адаптер пробует `/usr/data/`, на отказе — `/mnt/UDISK/`, и запоминает рабочую
папку до конца задания.

Почему `state` 0 — это `printing`, а не `idle`. Сразу после `opGcodeFile`
прошивка ещё греет стол и паркует голову. `idle` в этот момент main.py читает
как «печать не начиналась»: при нулевом прогрессе задание закрылось бы
`failed` в первом же опросе, а деталь начала бы печататься без задания.

Молчание в ответ на `set` — не отказ: часть прошивок команды не подтверждает,
а просто выполняет. Такая команда считается отправленной (с записью в
журнал): что вышло на самом деле, покажет следующий `get_status()`. Явный
отказ (`error`, ненулевой `code`, `result` со словами `fail`/`error`/`not
exist`) возвращает False и причину в `last_error`.

Ключ принтера. `api_key` прошивка не проверяет и в запросах не ждёт: поле
остаётся в контракте адаптера и в форме Мастерской, но в заголовки не
попадает. Придумывать заголовок, которого протокол не знает, значило бы
показать мастеру «ключ принят» там, где ключ никто не спрашивал.

Сеть. Ни `requests`, ни `websockets` не выпускают исключений наружу: закрытый
порт, разрыв WebSocket и таймаут — это запись в журнале и `False` (или статус
`error` у `get_status()`), а не падение агента.
"""
from __future__ import annotations

import json
import logging
import time
from collections.abc import Mapping
from typing import Any, Final, cast
from urllib.parse import quote

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
from .formats import FormatError

logger = logging.getLogger("agent.adapters.creality")

# WebSocket-порт прошивки: команды и телеметрия. Отдельная служба рядом с
# веб-интерфейсом на 80-м порту, и порт один у всех моделей.
WS_PORT = 9999

# HTTP: паспорт отвечает сразу, загрузка файла идёт минутами.
HTTP_TIMEOUT = 5
UPLOAD_TIMEOUT = 120

# WebSocket: открытие сокета, подтверждение `heart_beat` и ответ на команду.
# Опрос идёт раз в несколько секунд, и зависший сокет не должен держать очередь.
WS_TIMEOUT = 5.0
HEARTBEAT_TIMEOUT = 3.0


# `opGcodeFile` принимает полный путь, а папка зависит от модели: K2 Plus
# печатает из `/usr/data/`, часть прошивок — из `/mnt/UDISK/`. Первая папка
# пробуется сразу, вторая — на отказе.
FILE_ROOTS: Final[tuple[str, ...]] = ("/usr/data/", "/mnt/UDISK/")

# Префикс пути в `opGcodeFile`: прошивка читает файл с внутренней памяти.
PRINT_PREFIX: Final = "printprt:"

HEARTBEAT: Final[dict[str, Any]] = {"ModeCode": "heart_beat"}

# `state` из `ReqPrinterPara` → статус агента.
#
# 0 — подготовка (нагрев, парковка) и 1 — печать: для main.py обе означают
# «печать идёт». 2 — завершено: `idle`, задание закроется как `done`. 3 и 4 —
# остановлено (срыв или остановка с экрана): `error`, и мастер увидит причину.
# 5 — пауза: `paused`, задание живо, опрос продолжается.
_STATE_MAP: Final[dict[int, str]] = {
    0: "printing",
    1: "printing",
    2: "idle",
    3: "error",
    4: "error",
    5: "paused",
}

# Модели по коду из `/info`. Список короткий намеренно: код незнакомой модели
# уходит в журнал как есть, а новая строка добавляется одним движением.
_MODEL_NAMES: Final[dict[str, str]] = {"F008": "K2 Plus"}

# Подсказки к кодам отказа загрузки: «HTTP 401» мастер прочитает как проблему
# сети, хотя принтер просто не принял запрос.
_UPLOAD_HINTS: Final[dict[int, str]] = {
    401: "ключ API не принят — проверьте ключ принтера в настройках Мастерской",
    403: "принтеру запрещена запись файла",
    404: "принтер не принимает загрузку по этому адресу — проверьте модель",
    413: "файл больше памяти принтера",
}

# Поля ответа на `ReqPrinterPara`: прошивки называют их по-разному, берём
# первое найденное.
_PROGRESS_FIELDS: Final[tuple[str, ...]] = ("printProgress", "print_progress")
_REMAINING_FIELDS: Final[tuple[str, ...]] = (
    "printLeftTime",
    "print_left_time",
    "printTimeLeft",
)
_STATE_KEYS: Final[tuple[str, ...]] = (
    "state",
    "printProgress",
    "print_progress",
    "printLeftTime",
    "print_left_time",
)

# Слова, которыми прошивка сообщает об отказе в `result`/`msg`. Список
# короткий намеренно: незнакомый текст считается подтверждением, потому что
# отвечает прошивка по-разному — `ok`, `success` или эхом самой команды.
_REFUSAL_MARKERS: Final[tuple[str, ...]] = (
    "err",
    "fail",
    "not exist",
    "no such",
    "invalid",
    "unsupported",
    "denied",
    "refus",
)

_HEARTBEAT_OK: Final[frozenset[str]] = frozenset({"ok", "success", "done", "true"})


def _text(value: Any) -> str:
    """Строка из поля ответа: числа тоже читаются, остальное — пусто."""
    if isinstance(value, str):
        return value.strip()

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)

    return ""


def _first_text(source: Any, names: tuple[str, ...]) -> str | None:
    """Первое непустое строковое поле из списка названий."""
    if not isinstance(source, Mapping):
        return None

    for name in names:
        text = _text(source.get(name))

        if text:
            return text

    return None


def _as_number(value: Any) -> float:
    """Число из поля ответа: отсутствие, мусор и bool — 0.0."""
    if isinstance(value, bool):
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return 0.0

    return 0.0


def _as_int(value: Any) -> int | None:
    """
    Целое из поля ответа; `None` — поля нет или в нём не число.

    Отдельно от `_as_number()`: `state` без значения нельзя считать нулём —
    ноль это «идёт подготовка», и мусор в поле выглядел бы как живая печать.
    """
    if isinstance(value, bool):
        return None

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return int(round(value))

    if isinstance(value, str):
        text = value.strip()

        if text.lstrip("+-").isdigit():
            return int(text)

    return None


def _as_percent(value: Any) -> int:
    """
    Прогресс в процентах 0…100.

    Прошивка отдаёт готовые проценты, но на кривой сборке бывает и 120, и
    отрицательное значение. Границы отсекаем здесь: в базе прогресс не должен
    вылезать за 100.
    """
    percent = _as_number(value)

    return int(round(min(max(percent, 0.0), 100.0)))


def _as_seconds(value: Any) -> int:
    """Остаток печати в секундах: отрицательное и мусор — 0 («неизвестно»)."""
    return int(round(max(_as_number(value), 0.0)))


def _pick(fields: Mapping[str, Any], names: tuple[str, ...]) -> Any:
    """Первое найденное поле из списка названий."""
    for name in names:
        if name in fields:
            return fields[name]

    return None


def _short(value: Any, limit: int = 200) -> str:
    """JSON для журнала, обрезанный до `limit` символов."""
    try:
        text = json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        text = repr(value)

    return text[:limit]


def _parse_message(raw: str | bytes) -> dict[str, Any] | None:
    """Сообщение WebSocket как объект; не JSON и не объект — None."""
    try:
        message = json.loads(raw)
    except (TypeError, ValueError):
        preview = raw if isinstance(raw, str) else raw[:200]
        logger.warning("Creality прислал не JSON: %r", preview)

        return None

    if not isinstance(message, dict):
        logger.warning("Creality прислал не объект: %r", message)

        return None

    return {str(key): value for key, value in message.items()}


def _is_heartbeat(message: Mapping[str, Any]) -> bool:
    """Сообщение относится к heartbeat: подтверждение или эхо запроса."""
    code = _text(message.get("ModeCode")) or _text(message.get("modeCode"))

    return code.lower() == "heart_beat"


def _heartbeat_accepted(message: Mapping[str, Any]) -> bool:
    """`msg` подтверждения равен `ok` (или его синониму)."""
    for field in ("msg", "result", "message"):
        text = _text(message.get(field))

        if text:
            return text.lower() in _HEARTBEAT_OK

    return False


def _state_fields(message: Mapping[str, Any]) -> dict[str, Any] | None:
    """
    Объект с полями печати из ответа на `ReqPrinterPara`.

    Прошивки кладут их по-разному: в `params` (эхо запроса), в `result`, в
    `data` или прямо в сообщении. Первый объект, в котором есть хоть одно поле
    печати, и есть ответ.
    """
    for key in ("params", "result", "data"):
        candidate = message.get(key)

        if isinstance(candidate, dict) and any(
            field in candidate for field in _STATE_KEYS
        ):
            return {str(name): value for name, value in candidate.items()}

    if any(field in message for field in _STATE_KEYS):
        return {str(name): value for name, value in message.items()}

    return None


def _refusal(message: Mapping[str, Any]) -> str | None:
    """
    Причина отказа из ответа на `set`; `None` — команда принята.

    Порядок проверок — от точного к догадке: поле `error` (строка или объект),
    ненулевой `code`, затем слова-маркеры в `result`/`msg`/`message`.
    """
    error = message.get("error")

    if isinstance(error, str) and error.strip():
        return error.strip()[:200]

    if isinstance(error, dict) and error:
        return _short(error)

    code = message.get("code")

    if isinstance(code, int) and not isinstance(code, bool) and code != 0:
        return _text(message.get("msg"))[:200] or f"код {code}"

    for field in ("result", "msg", "message"):
        text = _text(message.get(field))

        if text and any(marker in text.lower() for marker in _REFUSAL_MARKERS):
            return text[:200]

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
                "Creality ответил не JSON: HTTP %s, %r",
                response.status_code,
                _response_text(response),
            )

        return None

    if not isinstance(payload, dict):
        if not quiet:
            logger.warning("Creality ответил не объектом: %r", payload)

        return None

    return {str(key): value for key, value in payload.items()}


def _http_reason(
    response: requests.Response, hints: Mapping[int, str] | None = None
) -> str:
    """
    Причина отказа HTTP: подсказка по коду и текст от принтера.

    Подсказка идёт первой: «HTTP 401: ключ API не принят» мастер поймёт, а
    «HTTP 401, Unauthorized» заставит искать проблему в сети.
    """
    hint = (hints or {}).get(response.status_code)

    if hint:
        return f"HTTP {response.status_code}: {hint} ({_response_text(response)})"

    return f"HTTP {response.status_code}, {_response_text(response)}"


def _upload_refusal(response: requests.Response) -> str | None:
    """
    Отказ прошивки в теле ответа на загрузку.

    HTTP 200 прошивка возвращает и тогда, когда файл не записался: результат
    лежит в `{"code": 0, "msg": "success"}`, где ноль — успех, а всё остальное
    — отказ. Пустое и не-JSON тело (часть сборок отвечает строкой `ok`)
    считаем успехом.
    """
    payload = _read_json(response, quiet=True)

    if payload is None:
        return None

    return _refusal(payload)


class CrealityAdapter(BasePrinterAdapter):
    """
    Принтер Creality OS: HTTP для паспорта и файла, WebSocket 9999 для команд.
    """

    # Ключ протокола в справочнике: по нему `prepare_upload()` сверяет формат
    # файла и заменяет пробелы в имени на `_`.
    protocol_key = "creality"

    # Что адаптер действительно делает: `set`-команды прошивки поддерживают
    # паузу, возврат и остановку, поэтому интерфейс показывает эти кнопки.
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

    # `opGcodeFile` печатает G-code из папки принтера; контейнер `.3mf`
    # прошивка не разбирает.
    accepted_formats = (".gcode",)

    def __init__(self, ip_address: str, api_key: str) -> None:
        """
        `ip_address` — адрес принтера: `192.168.1.60`, `k2.local` или
        `http://192.168.1.60`.

        Порт в адресе относится к HTTP: так мастер попадает на принтер через
        прокси. Исключение — 9999: этот порт занят WebSocket, и HTTP тогда
        остаётся на 80-м, иначе `GET /info` ушёл бы в службу команд.

        `api_key` прошивка не проверяет: значение принимается ради общего
        контракта и в запросы не попадает (почему — в начале модуля).
        """
        super().__init__(ip_address=ip_address, api_key=api_key)

        address = ip_address.strip().rstrip("/")

        for scheme in ("http://", "https://"):
            if address.startswith(scheme):
                address = address[len(scheme) :]

        host, _, port = address.partition(":")
        host = host or address
        http_port = "" if port == str(WS_PORT) else port
        suffix = f":{http_port}" if http_port else ""

        self.host = host
        # Базовый URL без слэша на конце: пути ниже начинаются с `/`.
        self.base_url = f"http://{host}{suffix}"
        self.ws_url = f"ws://{host}:{WS_PORT}"
        # Паспорт из `/info`: модель кодом (`F008`) и версия прошивки.
        self.model: str | None = None
        self.firmware: str | None = None
        # Рабочая папка файлов, найденная при первом запуске печати.
        self._file_root: str | None = None
        self._ws: ClientConnection | None = None

    @property
    def model_name(self) -> str | None:
        """
        Подпись модели для журнала: `F008` → `K2 Plus`.

        Незнакомый код отдаётся как есть: он всё равно полезнее, чем
        «неизвестная модель», когда мастер сверяет принтер с экраном.
        """
        if self.model is None:
            return None

        return _MODEL_NAMES.get(self.model, self.model)

    def close(self) -> None:
        """Закрывает WebSocket: цикл агента зовёт метод в конце задания."""
        self._drop_socket()

    def connect(self) -> bool:
        """
        Паспорт по HTTP и `heart_beat` по WebSocket.

        `GET /info` идёт первым: он отвечает за доли секунды и сразу говорит,
        что на адресе принтер (`model`), а не чужой сервер. Ответ без модели —
        не повод отказывать: загрузка и команды проверяются дальше.

        Подтверждение `heart_beat` обязательно: порт 9999 бывает занят чужим
        приложением, и тогда `set`-команды ушли бы в пустоту.
        """
        self._drop_socket()
        info = self._read_info()

        if info is None:
            logger.warning(
                "Creality %s: паспорт не получен, проверяю WebSocket",
                self.ip_address,
            )

        connection = self._open_socket()

        if connection is None:
            return False

        if not self._heartbeat_ok(connection):
            self.last_error = (
                "WebSocket отвечает, но heart_beat не подтверждён: это не Creality"
            )
            logger.error(
                "Creality %s: heart_beat не подтверждён, соединение закрываю",
                self.ip_address,
            )
            self._drop_socket()

            return False

        logger.info(
            "Creality %s доступен: модель %s, прошивка %s",
            self.ip_address,
            self.model_name or "неизвестна",
            self.firmware or "неизвестна",
        )
        self.last_error = None

        return True

    def _read_info(self) -> dict[str, Any] | None:
        """
        `GET /info`, при отказе — `GET /detail`.

        Модель лежит в `model` (`F008` — K2 Plus), версия — в `version` или
        `firmware`. Часть прошивок прячет их в `data`, поэтому код модели
        ищется и во вложенном объекте.

        Сетевая ошибка возвращает `None` сразу: второй адрес на выключенном
        принтере всё равно не ответит. Отказ по коду пробует следующий адрес —
        у части сборок `/info` закрыт, а `/detail` открыт.
        """
        failure = ""

        for path in ("/info", "/detail"):
            try:
                response = requests.get(
                    f"{self.base_url}{path}", timeout=HTTP_TIMEOUT
                )
            except requests.RequestException as error:
                self.last_error = f"принтер не отвечает: {error}"
                logger.error("Creality %s не отвечает: %s", self.ip_address, error)

                return None

            if response.status_code != 200:
                failure = _http_reason(response)
                logger.warning(
                    "Creality %s: %s ответил %s",
                    self.ip_address,
                    path,
                    failure,
                )
                continue

            payload = _read_json(response)

            if payload is None:
                failure = "ответ не JSON"
                continue

            self._remember_info(payload)

            return payload

        self.last_error = f"паспорт принтера не получен: {failure or 'нет ответа'}"

        return None

    def _remember_info(self, payload: Mapping[str, Any]) -> None:
        """
        Запоминает модель и прошивку из ответа `/info`.

        Поля ищутся в самом ответе, затем в `data` и `result`: у K2 Plus они
        на верхнем уровне, у части сборок — внутри обёртки. Чего нет, то
        остаётся прежним: повторный запрос не должен стирать модель.
        """
        nested = (
            payload.get("data"),
            payload.get("result"),
            payload.get("device"),
        )
        model = _first_text(payload, ("model", "modelName", "machineModel"))
        firmware = _first_text(payload, ("version", "firmware", "softwareVersion"))

        for source in nested:
            if model is None:
                model = _first_text(source, ("model", "modelName", "machineModel"))

            if firmware is None:
                firmware = _first_text(
                    source, ("version", "firmware", "softwareVersion")
                )

        if model is not None:
            self.model = model

        if firmware is not None:
            self.firmware = firmware

    def _connection(self) -> ClientConnection | None:
        """Открытый WebSocket: существующий или новый."""
        if self._ws is not None:
            return self._ws

        return self._open_socket()

    def _open_socket(self) -> ClientConnection | None:
        """
        Открывает `ws://<ip>:9999`.

        `ping_interval=None`: служебные WS-пинги прошивка понимать не обязана,
        а закрытие по неотвеченному пингу выглядело бы как «принтер
        выключился». Живость канала держит `heart_beat` самого протокола.
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
                "Creality %s: WebSocket не открылся: %s", self.ip_address, error
            )

            return None

        self._ws = connection

        return connection

    def _drop_socket(self) -> None:
        """Закрывает сокет и забывает его: следующая команда откроет новый."""
        connection, self._ws = self._ws, None

        if connection is None:
            return

        try:
            connection.close()
        except (WebSocketException, OSError) as error:
            logger.debug(
                "Creality %s: сокет закрыт с ошибкой: %s", self.ip_address, error
            )

    def _heartbeat_ok(self, connection: ClientConnection) -> bool:
        """
        `heart_beat` → `{"ModeCode": "heart_beat", "msg": "ok"}`.

        Молчание или `msg` не `ok` означают, что на 9999 отвечает не Creality:
        порт открыт, а протокол чужой. Чужие сообщения (например, отчёт о
        состоянии, который прошивка прислала сама) пропускаются: ждём именно
        подтверждение.
        """
        try:
            connection.send(json.dumps(HEARTBEAT))
        except (WebSocketException, OSError) as error:
            self.last_error = f"WebSocket {self.ws_url} закрыт: {error}"
            logger.error(
                "Creality %s: heart_beat не отправлен: %s", self.ip_address, error
            )

            return False

        deadline = time.monotonic() + HEARTBEAT_TIMEOUT

        while time.monotonic() < deadline:
            message = self._recv(connection)

            if message is None:
                return False

            if _is_heartbeat(message):
                return _heartbeat_accepted(message)

        return False

    def _request(self, payload: dict[str, Any], label: str) -> dict[str, Any] | None:
        """
        Отправляет сообщение и ждёт первый ответ, не являющийся heartbeat.

        `heart_beat` уходит перед командой: между опросами проходят секунды,
        и прошивка рвёт сокет, который долго молчит. Подтверждения heartbeat
        пропускаются — ответ на саму команду идёт следом.

        Телеметрию «сама по себе» Creality не присылает: любое сообщение после
        запроса — ответ на него. `None` — сокета нет, он закрылся или принтер
        промолчал `WS_TIMEOUT` секунд.
        """
        connection = self._connection()

        if connection is None:
            return None

        try:
            connection.send(json.dumps(HEARTBEAT))
            connection.send(json.dumps(payload))
        except (WebSocketException, OSError) as error:
            self._drop_socket()
            self.last_error = f"WebSocket {self.ws_url} закрыт: {error}"
            logger.error(
                "Creality %s: «%s» не отправлено: %s",
                self.ip_address,
                label,
                error,
            )

            return None

        message = self._read_reply(connection)

        if message is None:
            logger.warning(
                "Creality %s не ответил на «%s» за %.0f с",
                self.ip_address,
                label,
                WS_TIMEOUT,
            )

        return message

    def _read_reply(self, connection: ClientConnection) -> dict[str, Any] | None:
        """Первый ответ на команду: heartbeat-сообщения пропускаются."""
        deadline = time.monotonic() + WS_TIMEOUT

        while time.monotonic() < deadline:
            message = self._recv(connection)

            if message is None:
                return None

            if _is_heartbeat(message):
                continue

            return message

        return None

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
                "Creality %s: соединение закрыто: %s", self.ip_address, error
            )

            return None

        return _parse_message(raw)

    def upload_file(self, local_path: str, remote_name: str) -> bool:
        """
        Загружает G-code в `POST /upload/<remote_name>`.

        Имя приходит из `prepare_upload()`: пробелы заменены на `_`, кириллица
        снята, папки отброшены. Прошивка кладёт файл в свою папку сама, а
        `start_print()` потом ищет его по этому же имени — переименовать после
        загрузки уже нельзя.

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
        Отправляет подготовленный файл multipart-формой с полем `file`.

        Успех — 200 или 201: прошивки отвечают по-разному, а тело всё равно
        проверяется отдельно (`{"code": 0}` — успех). Файл открывается на время
        запроса: `requests` читает его потоком, закрывать нужно после отправки.
        """
        path = quote(plan.remote_name, safe="")

        try:
            with open(plan.path, "rb") as gcode:
                response = requests.post(
                    f"{self.base_url}/upload/{path}",
                    files={
                        "file": (
                            plan.remote_name,
                            gcode,
                            "application/octet-stream",
                        )
                    },
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

        refusal = _upload_refusal(response)

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
        Запускает печать файла из папки принтера.

        `{"method": "set", "params": {"opGcodeFile": "printprt:<папка><имя>"}}`:
        прошивка берёт файл по полному пути, и папка у моделей разная. Отказ на
        `/usr/data/` — вторая попытка с `/mnt/UDISK/`; рабочая папка
        запоминается, чтобы следующая печать не тратила лишний запрос.

        Молчание прошивки в ответ на первую папку считается успехом: команды
        отправлены, а правду покажет `get_status()`. Иначе пришлось бы гадать
        по тишине и портить рабочий путь второй попыткой.
        """
        for root in self._file_roots():
            params = {"opGcodeFile": f"{PRINT_PREFIX}{root}{remote_name}"}
            accepted = self._set_command(params, "печать")

            if accepted is False:
                continue

            self._file_root = root

            if accepted is None:
                logger.warning(
                    "Creality %s: печать %s отправлена без подтверждения",
                    self.ip_address,
                    remote_name,
                )
            else:
                logger.info(
                    "Печать %s запущена на %s (%s)",
                    remote_name,
                    self.ip_address,
                    root,
                )

            self.last_error = None

            return True

        logger.error(
            "Creality %s: печать %s не запущена: %s",
            self.ip_address,
            remote_name,
            self.last_error or "принтер не подтвердил запуск",
        )

        return False

    def _file_roots(self) -> tuple[str, ...]:
        """Папки файлов в порядке проверки: найденная рабочая — первой."""
        if self._file_root is None:
            return FILE_ROOTS

        return (self._file_root,) + tuple(
            root for root in FILE_ROOTS if root != self._file_root
        )

    def pause_print(self) -> bool:
        """Пауза: `{"method": "set", "params": {"pause": 1}}`."""
        return self._silent_ok({"pause": 1}, "пауза")

    def resume_print(self) -> bool:
        """Снятие с паузы: `{"method": "set", "params": {"pause": 0}}`."""
        return self._silent_ok({"pause": 0}, "возврат")

    def stop_print(self) -> bool:
        """
        Остановка печати: `{"method": "set", "params": {"stop": 1}}`.

        Файл на принтере адаптер не удаляет: имя содержит идентификатор
        задания, и повторная печать начнётся с новой загрузки.
        """
        return self._silent_ok({"stop": 1}, "остановка")

    def _silent_ok(self, params: dict[str, Any], label: str) -> bool:
        """
        Команда управления печатью: молчание прошивки считается успехом.

        Прошивки, которые не подтверждают `set`, всё равно выполняют команду.
        Возвращать False из-за тишины значило бы показать мастеру «пауза не
        сработала» и оставить печать стоять до вмешательства у стола.
        """
        accepted = self._set_command(params, label)

        if accepted is None:
            logger.warning(
                "Creality %s не подтвердил «%s» — считаю отправленной",
                self.ip_address,
                label,
            )

        if accepted is not False:
            self.last_error = None

        return accepted is not False

    def _set_command(self, params: dict[str, Any], label: str) -> bool | None:
        """
        `set`-команда: True — подтверждена, False — отказ, None — тишина.

        Тишина и отказ различаются по сокету: если он не открылся или закрылся,
        принтера нет вовсе — это отказ. Молчание на живом сокете отказом не
        считается: часть прошивок команды не подтверждает. Решение, что делать
        с тишиной, остаётся вызывающему: старту печати она не мешает, а пауза
        считается отправленной только с записью в журнал.
        """
        message = self._request({"method": "set", "params": params}, label)

        if message is None:
            if self._ws is not None:
                return None

            if self.last_error is None:
                self.last_error = f"WebSocket {self.ws_url} не отвечает"

            return False

        refusal = _refusal(message)

        if refusal is None:
            return True

        self.last_error = f"{label} отвергнута: {refusal}"
        logger.error(
            "Creality %s: %s отвергнута: %s", self.ip_address, label, refusal
        )

        return False

    def get_status(self) -> dict[str, Any]:
        """
        Состояние из `{"method": "get", "params": {"ReqPrinterPara": 1}}`.

        `state` переводится в статусы агента по `_STATE_MAP`: 0 и 1 — печать,
        2 — готово, 3 и 4 — печать остановлена, 5 — пауза. Незнакомое число
        считается ошибкой: молчаливое «всё хорошо» на ферме опаснее лишней
        записи в журнале.

        Прогресс прошивка отдаёт готовыми процентами, остаток — секундами,
        `None` и отрицательные значения превращаются в 0.

        Сеть, таймаут, ответ без полей печати и остановка печати принтером
        дают статус `error` с причиной в `last_error`: main.py закроет задание
        и отправит мастеру текст, а не «задание провалилось». Успешный опрос
        `last_error` очищает — иначе прежний сбой закрыл бы уже идущую печать.
        """
        message = self._request(
            {"method": "get", "params": {"ReqPrinterPara": 1}}, "состояние"
        )

        if message is None:
            self.last_error = "принтер не ответил на запрос состояния"

            return self._error_status()

        fields = _state_fields(message)

        if fields is None:
            self.last_error = "в ответе нет состояния печати"
            logger.error(
                "Creality %s ответил без состояния печати: %s",
                self.ip_address,
                _short(message),
            )

            return self._error_status()

        raw_state = fields.get("state")
        state = _as_int(raw_state)
        progress = _as_percent(_pick(fields, _PROGRESS_FIELDS))
        remaining = _as_seconds(_pick(fields, _REMAINING_FIELDS))
        agent_status = None if state is None else _STATE_MAP.get(state)

        if agent_status is None:
            self.last_error = f"неизвестное состояние печати: {raw_state!r}"
            logger.warning(
                "Creality %s: неизвестное состояние печати %r, отдаю error",
                self.ip_address,
                raw_state,
            )

            return {
                "status": "error",
                "progress": progress,
                "remaining_time": remaining,
            }

        if agent_status == "error":
            self.last_error = f"принтер остановил печать (state={state})"
            logger.error(
                "Creality %s: печать остановлена принтером (state=%s)",
                self.ip_address,
                state,
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
        Паспорт принтера для формы «Проверить принтер»: модель и прошивка.

        Сеть здесь уместна: мастеру нужен ответ до сохранения принтера, а
        `GET /info` безвреден и отвечает за доли секунды. Отказ сети возвращает
        статику класса, как у остальных адаптеров, и причину в `last_error`.
        """
        info = self._read_info()

        if info is not None:
            self.last_error = None

        result = super().probe()
        model = self.model_name

        if model is not None:
            result["model"] = model

        if self.firmware is not None:
            result["firmware"] = self.firmware

        return result

    @staticmethod
    def _error_status() -> dict[str, Any]:
        """Ответ get_status(), когда состояние получить не удалось."""
        return {"status": "error", "progress": 0, "remaining_time": 0}

