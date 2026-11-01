"""
Адаптер Anycubic (Kobra S1, S1 Max) — LAN-режим: MQTT для команд, HTTP для файла.

В локальной сети Anycubic — это брокер MQTT на порту 9883 под TLS: через него
идут и команды, и отчёты. Файл брокер не принимает: G-code загружается
HTTP-запросом на адрес, который принтер называет сам в отчёте о себе.

Конверт. Каждое сообщение — тип, действие и данные:

    {"type": "info",  "action": "query", "data": null, "msgid": "<номер>"}
    {"type": "print", "action": "start", "data": {...}, "msgid": "<номер>"}

Ответ приходит тем же `type` с `action: "report"`: `info/report` — паспорт
принтера, `print/report` — состояние печати и подтверждение команд. `msgid`
принтер возвращает не всегда, поэтому ответом считается и отчёт с кодом
(`code`) или с ожидаемым состоянием (`state`).

Топики строятся из номера модели (`modeId`) и номера устройства (`deviceId`):

    anycubic/anycubicCloud/v1/printer/public/<modeId>/<deviceId>/request
    anycubic/anycubicCloud/v1/printer/public/<modeId>/<deviceId>/report

Номера приходят в первом отчёте; их можно вписать и в `printer_secrets`
(`modeId`, `deviceId`) — так работает принтер, у которого бродкаст запрещён
политикой сети. Ответ принтера главнее секретов: расхождение пишется в журнал.
Пока номера неизвестны, подписка идёт шаблоном `.../+/+/report`: публиковать в
шаблон нельзя — брокер доставит сообщение никому.

Паспорт — источник адреса загрузки: `urls.fileUploadurl`. Порт 18910 запасной:
он используется только тогда, когда принтер адрес не назвал.

Загрузка. `POST <fileUploadurl>` multipart-формой с полем `gcode` (не `file`:
прошивка читает именно его) и заголовком `X-File-Length` — размер файла. MD5
прошивка сверяет при старте печати, поэтому `prepare_upload()` считает
`file_digest()` один раз: сумма уходит в команду `print/start`, а второй раз
читать файл в сотни мегабайт незачем.

Отказы. Принтер отвечает кодом в JSON: `code: 0` — принято, остальное — отказ.
`19007` — имя файла не заканчивается на `.gcode` (или формат не тот), `10105` —
принтер занят: печать или проверка файла уже идёт. Адаптер переводит код в
понятную причину: «код 19007» мастеру ничего не говорит.

Команды печати. `print/start` несёт `taskid: "-1"` (новая задача), `filename`,
`md5`, `filetype: 1`, `filesize` и `project_type: 1`; `pause`, `resume` и
`stop` — номер текущей задачи из отчёта. MD5 и размер адаптер помнит с
загрузки: `start_print()` получает только имя файла.

Молчание — отказ. Anycubic подтверждает команду отчётом; прошивка, не
ответившая на `print/start`, печать не начнёт, поэтому истечение таймаута —
это `False` с причиной в `last_error`. Creality в такой же ситуации считает
команду отправленной: там прошивки молчат штатно.

Отчёты частичные: принтер присылает только изменившиеся поля, поэтому кэш
дополняется, а не заменяется. Остаток простоя — ноль: время прошлой печати
осталось бы в кэше, и «осталось 40 минут» у свободного принтера читалось бы
как идущая работа.

Сеть. Ни MQTT-клиент, ни `requests` не выпускают исключений наружу: выключенный
принтер, разрыв брокера и таймаут — запись в журнале и `False` (или статус
`error` у `get_status()`), а не падение агента.

Что проверено, а что нет. Конверт, топики и адрес загрузки — из поведения Kobra
S1 в LAN-режиме; `scripts/test-anycubic.py` поднимает брокер MQTT и HTTP-сервер
на loopback и сверяет поля сообщений. Живой прогон — за мастером: тест печатать
не умеет, и прошивка вправе называть поля иначе — тогда причина отказа останется
в `last_error`, а не превратится в молчаливый простой.
"""
from __future__ import annotations

import json
import logging
import ssl
import threading
import time
from collections import deque
from collections.abc import Mapping
from typing import Any, Final

import paho.mqtt.client as mqtt
import requests
from paho.mqtt.enums import CallbackAPIVersion

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

logger = logging.getLogger("agent.adapters.anycubic")

# MQTT в LAN-режиме: команды и отчёты. Порт один у всей серии Kobra; TLS
# обязателен, сертификат принтера самоподписанный.
MQTT_PORT: Final = 9883

# HTTP-служба принтера: второй порт протокола. Точный адрес загрузки приходит в
# паспорте (`urls.fileUploadurl`), а это запасной путь — на случай, когда
# паспорт адрес не назвал.
HTTP_PORT: Final = 18910

# Запасной путь загрузки. Точный путь называет паспорт; здесь — предположение по
# тому же порту 18910. Если сборка ждёт другой путь, отказ виден в `last_error`
# вместе с HTTP-кодом, а не теряется.
UPLOAD_PATH: Final = "/upload"

# Поле формы загрузки. Прошивка читает `gcode`, а не `file`: с чужим именем поля
# файл приходит пустым, и принтер отвечает отказом 19007.
FILE_FIELD: Final = "gcode"

# Размер файла заголовком: по нему принтер готовит место до чтения тела.
FILE_LENGTH_HEADER: Final = "X-File-Length"

# Коды отказа прошивки и их перевод на язык мастера. Код без подсказки пишется
# числом: его пришлют в поддержку, и там уже видно, о чём речь.
CODE_SUCCESS: Final = 0
ERROR_FILE_NAME: Final = 19007
ERROR_BUSY: Final = 10105
ERROR_HINTS: Final[dict[int, str]] = {
    ERROR_FILE_NAME: "принтер принимает только имя с расширением .gcode",
    ERROR_BUSY: "принтер занят: на нём уже идёт печать или проверка файла",
}

# Таймауты. `CONNECT_TIMEOUT` — ожидание CONNACK: выключенный принтер не отвечает
# вообще. `REPORT_TIMEOUT` — паспорт: отчёт о себе принтер присылает сразу после
# запроса. `STATUS_TIMEOUT` — свежее состояние: отчёты идут сами раз в несколько
# секунд, и ждать дольше на каждом опросе значило бы держать очередь заданий.
# `COMMAND_TIMEOUT` — подтверждение команды печати.
CONNECT_TIMEOUT = 10
REPORT_TIMEOUT = 5.0
STATUS_TIMEOUT = 2.0
COMMAND_TIMEOUT = 10.0
REPORT_POLL = 0.05

# Загрузка идёт минутами: файл на десятки мегабайт по Wi-Fi передаётся долго.
UPLOAD_TIMEOUT = 120

# Keepalive MQTT: принтер замечает пропажу агента за минуту-две. Чаще слать
# PINGREQ незачем — сеть мастерской и так нагружена отчётами.
MQTT_KEEPALIVE = 30

# Очередь принятых отчётов. Принтер присылает их чаще, чем агент читает, а
# копить незачем: старые состояния всё равно устарели.
INBOX_SIZE = 64

# Логин LAN-режима по умолчанию: форма «Проверить принтер» даёт одно поле ключа,
# а брокер ждёт пару. Паролем становится ключ, логином — это имя.
DEFAULT_USER: Final = "anycubic"

# TLS обязателен в LAN-режиме. Это флаг, а не `Final`-константа: тест поднимает
# брокер на loopback без сертификата — рукопожатие в фейковом брокере проверить
# нечем, а подделывать сертификат в тесте хуже, чем честно выключить TLS.
MQTT_TLS = True

# Корень топиков. Дальше идут `modeId`, `deviceId` и вид сообщения.
TOPIC_ROOT: Final = "anycubic/anycubicCloud/v1/printer/public"

# `taskid` новой задачи: так принтер понимает, что печатать надо файл, а не
# продолжать прошлую печать.
NEW_TASK_ID: Final = "-1"

# `filetype` и `project_type` для обычного G-code.
FILE_TYPE_GCODE: Final = 1
PROJECT_TYPE_NORMAL: Final = 1

# `state` из `print/report` → статус агента.
#
# `heating`, `preheating` и `starting` — печать: сразу после `print/start`
# принтер греет стол и проверяет файл, а `idle` в этот момент main.py прочитал бы
# как «печать не начиналась» и закрыл задание провалом. `completed` — простой:
# печать закончена, задание закроется как `done`. `stopped` и `cancelled` —
# ошибка: печать прервали, и мастер увидит причину.
_STATE_MAP: Final[dict[str, str]] = {
    "idle": "idle",
    "ready": "idle",
    "completed": "idle",
    "complete": "idle",
    "finished": "idle",
    "printing": "printing",
    "heating": "printing",
    "preheating": "printing",
    "starting": "printing",
    "resuming": "printing",
    "busy": "printing",
    "paused": "paused",
    "pausing": "paused",
    "stopped": "error",
    "cancelled": "error",
    "canceled": "error",
    "error": "error",
    "failed": "error",
}

# Состояния, которые подтверждают печать: старт и возврат с паузы.
_PRINTING_STATES: Final[frozenset[str]] = frozenset(
    {"starting", "heating", "preheating", "printing", "resuming", "busy"}
)

# Состояния, которые подтверждают паузу.
_PAUSED_STATES: Final[frozenset[str]] = frozenset({"paused", "pausing"})

# Состояния, которые подтверждают остановку.
_IDLE_STATES: Final[frozenset[str]] = frozenset(
    {"idle", "ready", "completed", "complete", "finished", "stopped"}
)

# Поля отчётов. Прошивки одной серии называют одно и то же по-разному, поэтому
# у каждого поля список синонимов, а не одно имя.
_STATE_FIELDS: Final = ("state", "printState", "printStatus", "status")
_PROGRESS_FIELDS: Final = ("progress", "printProgress", "percent", "progressPercent")
_REMAINING_FIELDS: Final = (
    "printLeftTime",
    "leftTime",
    "remainingTime",
    "remainTime",
)
_TASK_FIELDS: Final = ("taskid", "taskId", "task_id")
_MODEL_FIELDS: Final = ("model", "machineName", "printerModel", "deviceName")
_FIRMWARE_FIELDS: Final = ("firmware", "firmwareVersion", "version", "softVersion")
_DEVICE_FIELDS: Final = ("deviceId", "deviceID", "device_id")
_MODE_FIELDS: Final = ("modeId", "modeID", "mode_id")
_CODE_FIELDS: Final = ("code", "errCode", "errorCode")
_MESSAGE_FIELDS: Final = ("msg", "message", "error", "errMsg")


def _host(address: str) -> str:
    """
    Хост из адреса принтера: без схемы и порта.

    Мастер вводит адрес как придётся — `192.168.1.90`, `kobra.local`,
    `http://192.168.1.90:9883`. Порт в адресе относится к вебу, для MQTT он не
    годится: брокер у Anycubic всегда на 9883.
    """
    value = address.strip().rstrip("/")

    for scheme in ("http://", "https://"):
        if value.startswith(scheme):
            value = value[len(scheme) :]

    host, _, port = value.partition(":")

    return host or value


def _text(value: Any) -> str:
    """Строка без пробелов по краям; всё, что не строка, — пустая строка."""
    if isinstance(value, str):
        return value.strip()

    return ""


def _first_text(source: Mapping[str, Any], names: tuple[str, ...]) -> str | None:
    """Первое непустое строковое поле из списка синонимов."""
    for name in names:
        value = _text(source.get(name))

        if value:
            return value

    return None


def _as_number(value: Any) -> float | None:
    """
    Число из значения любого вида.

    Прошивки шлют числа то числом, то строкой (`"62"`, `"62%"`), поэтому строка
    чистится от знака процента. Всё остальное — None: `None`, `""` и `"нет"` не
    должны превращаться в ноль, иначе «неизвестно» станет «0 %».
    """
    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        cleaned = value.strip().rstrip("%").strip()

        try:
            return float(cleaned)
        except ValueError:
            return None

    return None


def _as_percent(value: Any) -> int:
    """Проценты 0…100: дробное значение округляется, край — обрезается."""
    number = _as_number(value)

    if number is None:
        return 0

    return max(0, min(100, round(number)))


def _as_seconds(value: Any) -> int:
    """
    Остаток печати в секундах.

    Прошивка называет поле `printLeftTime` и считает его в секундах;
    отрицательное значение — не «минус», а «неизвестно», поэтому в ответе ноль.
    """
    number = _as_number(value)

    if number is None or number < 0:
        return 0

    return int(number)


def _as_mapping(value: Any) -> dict[str, Any] | None:
    """JSON-объект как словарь; список, строка и None — None."""
    if isinstance(value, Mapping):
        return dict(value)

    return None


def _pick(source: Mapping[str, Any], names: tuple[str, ...]) -> Any:
    """Значение первого найденного поля из списка синонимов."""
    for name in names:
        if name in source:
            return source[name]

    return None


def _report_code(payload: Mapping[str, Any]) -> int | None:
    """
    Код ответа из сообщения принтера.

    Сначала верхний уровень, потом `data`: отчёт о состоянии приходит без кода
    вообще, а отказ — с кодом. None и ноль означают разное: None — кода нет
    (это не ответ на команду, а просто состояние), 0 — принято.
    """
    sources = (payload, _as_mapping(payload.get("data")) or {})

    for source in sources:
        for field in _CODE_FIELDS:
            code = _as_number(source.get(field))

            if code is not None:
                return int(code)

    return None


def _refusal_text(code: int, message: str) -> str:
    """Отказ прошивки словами: «код 10105: принтер занят (…)»."""
    text = f"код {code}"
    hint = ERROR_HINTS.get(code)

    if hint:
        text = f"{text}: {hint}"

    if message:
        text = f"{text} ({message})"

    return text


def _report_error(payload: Mapping[str, Any]) -> str | None:
    """Причина отказа из сообщения принтера; «принято» и «просто состояние» — None."""
    code = _report_code(payload)

    if code is None or code == CODE_SUCCESS:
        return None

    message = _first_text(payload, _MESSAGE_FIELDS) or _first_text(
        _as_mapping(payload.get("data")) or {}, _MESSAGE_FIELDS
    )

    return _refusal_text(code, message or "")


def _report_state(payload: Mapping[str, Any]) -> str:
    """
    Состояние печати из отчёта в нижнем регистре; пустая строка, если его нет.

    Поле лежит в `data`, но часть прошивок кладёт его на верхний уровень —
    проверяются оба места.
    """
    data = _as_mapping(payload.get("data")) or {}
    value = _first_text(data, _STATE_FIELDS) or _first_text(payload, _STATE_FIELDS)

    return (value or "").lower()


def _upload_url(data: Mapping[str, Any]) -> str | None:
    """
    Адрес загрузки из паспорта: `urls.fileUploadurl`.

    Прошивка отдаёт и строку, и список адресов — по одному на каждый интерфейс
    принтера. Берём первый HTTP(S)-адрес: остальные ведут в другие сети, и
    попытка идти в них лишь удлинит отказ.
    """
    urls = data.get("urls")
    raw: Any = None

    if isinstance(urls, Mapping):
        raw = urls.get("fileUploadurl") or urls.get("fileUploadUrl")
        raw = raw or urls.get("uploadUrl")
    else:
        raw = urls

    # Некоторые сборки кладут адрес на верхний уровень паспорта.
    raw = raw or data.get("fileUploadurl") or data.get("fileUploadUrl")

    candidates: list[Any] = []

    if isinstance(raw, str):
        candidates.append(raw)
    elif isinstance(raw, (list, tuple)):
        candidates.extend(raw)

    for value in candidates:
        address = _text(value)

        if address.lower().startswith(("http://", "https://")):
            return address

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
                "Anycubic ответил не JSON: HTTP %s, %r",
                response.status_code,
                _response_text(response),
            )

        return None

    return _as_mapping(payload)


def _upload_refusal(payload: dict[str, Any] | None) -> str | None:
    """
    Отказ в ответе на загрузку.

    Код `0` и отсутствие кода — файл принят. Незнакомый код пишется числом:
    мастер пришлёт его в поддержку, и там уже видно, о чём речь. `success: false`
    без кода — тоже отказ: часть сборок отвечает флагом.
    """
    if payload is None:
        return None

    code = _report_code(payload)

    if code is None:
        return "принтер не принял файл" if payload.get("success") is False else None

    if code == CODE_SUCCESS:
        return None

    message = _first_text(payload, _MESSAGE_FIELDS) or _first_text(
        _as_mapping(payload.get("data")) or {}, _MESSAGE_FIELDS
    )

    return _refusal_text(code, message or "")


class AnycubicAdapter(BasePrinterAdapter):
    """
    Принтер Anycubic в LAN-режиме: MQTT 9883 для команд, HTTP для файла.
    """

    # Ключ протокола в справочнике: по нему `prepare_upload()` сверяет формат —
    # Kobra печатает G-code, а контейнер `.3mf` не разбирает.
    protocol_key = "anycubic"

    # Что адаптер действительно делает: пауза, возврат и остановка уходят
    # командами `print/pause`, `print/resume` и `print/stop`, поэтому интерфейс
    # показывает эти кнопки.
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

    accepted_formats = (".gcode",)

    def __init__(
        self,
        ip_address: str,
        api_key: str,
        secrets: Mapping[str, str] | None = None,
    ) -> None:
        """
        `ip_address` — адрес принтера: `192.168.1.90`, `kobra.local` или
        `http://192.168.1.90`. Схема и порт в адресе не мешают: MQTT всегда на
        9883, а HTTP-порт называет паспорт принтера.

        `api_key` — ключ принтера. Прошивка ждёт пару «логин и пароль», поэтому
        ключ становится паролем, если в секретах пароля нет: форма «Проверить
        принтер» даёт одно поле, и мастер вписывает в него пароль LAN-режима.

        `secrets` — содержимое `workshop_printers.printer_secrets`: `username`,
        `password`, `deviceId` и `modeId`. Номера адресации нужны для топиков;
        если их нет, `connect()` узнаёт их у принтера сам.

        Секреты `clientCert` и `clientKey` — пути к файлам mTLS, `caCert` — к
        сертификату принтера. В паспорте протокола их нет: добавляются в jsonb,
        когда прошивка потребует взаимной проверки, и до тех пор не нужны.
        """
        super().__init__(ip_address=ip_address, api_key=api_key, secrets=secrets)

        self.host = _host(ip_address)
        self.username = (
            (self.secrets.get("username") or DEFAULT_USER).strip() or DEFAULT_USER
        )
        self.password = (self.secrets.get("password") or api_key).strip()
        # Номера адресации: из секретов до подключения, дальше — из отчётов.
        self.mode_id = (self.secrets.get("modeId") or "").strip()
        self.device_id = (self.secrets.get("deviceId") or "").strip()
        # Адрес загрузки называет паспорт; None — принтер его ещё не назвал.
        self._upload_url: str | None = None
        self._client: mqtt.Client | None = None
        self._connected = threading.Event()
        # Паспорт и последний отчёт о печати. Отчёты частичные, поэтому кэш
        # дополняется, а не заменяется: `state` и `progress` приходят разными
        # сообщениями.
        self._info: dict[str, Any] = {}
        self._print: dict[str, Any] = {}
        # Принятые отчёты, которые агент ещё не прочитал. Ответы на команды
        # приходят в потоке paho, поэтому ждать их приходится очередью.
        self._inbox: deque[dict[str, Any]] = deque(maxlen=INBOX_SIZE)
        self._inbox_ready = threading.Condition()
        self._msgid = 0
        # Имя, MD5 и размер последней загрузки: `start_print()` получает только
        # имя файла, а прошивке нужны ещё сумма и размер.
        self._uploaded: tuple[str, str, int] | None = None

    def close(self) -> None:
        """Закрывает MQTT-соединение: цикл агента зовёт метод в конце задания."""
        client = self._client
        self._client = None

        if client is not None:
            self._stop(client)

    def _stop(self, client: mqtt.Client) -> None:
        """Останавливает сетевой поток paho и закрывает сокет."""
        client.loop_stop()

        try:
            client.disconnect()
        except OSError as error:
            # Соединение уже закрыто принтером — закрывать нечего.
            logger.debug("Anycubic %s: MQTT отключён с ошибкой: %s", self.host, error)

    def _next_msgid(self) -> str:
        """Номер сообщения: принтер возвращает его в ответе, когда умеет."""
        self._msgid += 1

        return str(self._msgid)

    def _report_topic(self) -> str:
        """
        Топик отчётов.

        Пока номера неизвестны, подписка идёт шаблоном `.../+/+/report`: первый
        же отчёт даст `modeId` и `deviceId`, после чего подписка становится
        точной.
        """
        if self.mode_id and self.device_id:
            return f"{TOPIC_ROOT}/{self.mode_id}/{self.device_id}/report"

        return f"{TOPIC_ROOT}/+/+/report"

    def _request_topic(self) -> str | None:
        """
        Топик команд; None, пока неизвестны `modeId` и `deviceId`.

        В шаблонный топик публиковать нельзя: брокер доставит сообщение никому,
        и команда потеряется молча.
        """
        if not (self.mode_id and self.device_id):
            return None

        return f"{TOPIC_ROOT}/{self.mode_id}/{self.device_id}/request"

    def _learn_ids(self, topic: str) -> None:
        """
        `modeId` и `deviceId` из топика отчёта.

        Нужны, когда номера не вписали в секреты: без них не построить топик
        запроса. После знакомства подписка становится точной — иначе отчёт
        приходил бы дважды, по шаблону и по адресу.
        """
        prefix = f"{TOPIC_ROOT}/"

        if not topic.startswith(prefix):
            return

        parts = topic[len(prefix) :].split("/")

        if len(parts) < 3 or parts[2] != "report":
            return

        mode, device = parts[0].strip(), parts[1].strip()

        if not mode or not device or mode == "+" or device == "+":
            return

        changed = False

        if not self.mode_id:
            self.mode_id = mode
            changed = True

        if not self.device_id:
            self.device_id = device
            changed = True

        if not changed:
            return

        logger.info(
            "Anycubic %s: modeId %s, deviceId %s из отчёта",
            self.host,
            self.mode_id,
            self.device_id,
        )
        self._refresh_subscription()

    def _learn_ids_from_data(self, data: Mapping[str, Any]) -> None:
        """`modeId` и `deviceId` из паспорта, если в секретах их не было."""
        mode = _first_text(data, _MODE_FIELDS)
        device = _first_text(data, _DEVICE_FIELDS)

        if mode is not None and not self.mode_id:
            self.mode_id = mode

        if device is not None and not self.device_id:
            self.device_id = device

    def _refresh_subscription(self) -> None:
        """
        Переподписка после того, как номера стали известны.

        Шаблон снимается: с ним каждый отчёт приходил бы дважды. Клиента может
        ещё не быть — номер узнают и до CONNACK, тогда подписку сделает
        `connect()`.
        """
        client = self._client

        if client is None:
            return

        client.unsubscribe(f"{TOPIC_ROOT}/+/+/report")
        self._subscribe(client)

    def _subscribe(self, client: mqtt.Client) -> bool:
        """
        Подписка на отчёты принтера.

        Пока `modeId` и `deviceId` неизвестны, подписка идёт шаблоном: отчёты
        придут, и первый же даст настоящие номера. Публиковать команды в
        шаблонный топик нельзя — их не получит никто, поэтому печать без номеров
        не запустится (см. `_publish`).
        """
        topic = self._report_topic()
        result, _ = client.subscribe(topic, qos=0)

        if result != mqtt.MQTT_ERR_SUCCESS:
            logger.error(
                "Anycubic %s: подписка на %s не удалась (%s)",
                self.host,
                topic,
                result,
            )
            return False

        logger.info("Anycubic %s: подписка на %s", self.host, topic)

        return True

    def _on_connect(
        self,
        client: mqtt.Client,
        userdata: Any,
        flags: Any,
        reason_code: Any,
        properties: Any = None,
    ) -> None:
        """
        Подтверждение MQTT-подключения (callback API paho 2.x).

        `reason_code` — `ReasonCode`: сравнение с нулём работает, но надёжнее
        спросить `is_failure`, он же верен для отказов по имени.
        """
        if reason_code.is_failure:
            logger.error(
                "Anycubic %s не принял MQTT-подключение: %s (логин и пароль?)",
                self.host,
                reason_code,
            )
            return

        self._connected.set()

        # Переподключение после обрыва: paho работает с чистой сессией, и брокер
        # подписку не помнит. Первое подключение сюда не попадает — `_client`
        # выставляется уже после CONNACK, а подписку делает `connect()`.
        if self._client is not None:
            logger.warning(
                "Anycubic %s переподключился — подписываюсь заново", self.host
            )
            self._subscribe(self._client)

    def _on_message(
        self,
        client: mqtt.Client,
        userdata: Any,
        message: mqtt.MQTTMessage,
    ) -> None:
        """
        Отчёт принтера: `.../<modeId>/<deviceId>/report`.

        Из топика берутся номера, если они ещё неизвестны, из тела — паспорт,
        состояние печати и ответ на команду. Разбор мусора не должен ронять поток
        paho: ошибки только пишутся в журнал.
        """
        try:
            payload = json.loads(message.payload.decode("utf-8", errors="replace"))
        except ValueError:
            logger.warning(
                "Anycubic %s прислал не JSON: %r",
                self.host,
                message.payload[:120],
            )
            return

        if not isinstance(payload, dict):
            return

        self._learn_ids(message.topic)

        # `action` есть только у сообщений: `report` — отчёт, `query`, `start` и
        # прочие — эхо запроса. Отчёт без `action` тоже принимается: часть
        # прошивок его не ставит.
        action = _text(payload.get("action")).lower()

        if action and action != "report":
            return

        kind = _text(payload.get("type")).lower()
        data = _as_mapping(payload.get("data")) or {}

        if kind == "info":
            self._apply_info(data)
        elif kind == "print":
            # Отчёт частичный: заменять кэш нельзя, иначе после сообщения с одним
            # `progress` пропали бы `state` и остаток.
            self._print.update(data)

        entry = {
            "type": kind,
            "msgid": _text(payload.get("msgid")) or _text(payload.get("msgId")),
            "code": _report_code(payload),
            "state": _report_state(payload),
            "payload": payload,
            "data": data,
        }

        with self._inbox_ready:
            self._inbox.append(entry)
            self._inbox_ready.notify_all()

    def _apply_info(self, data: Mapping[str, Any]) -> None:
        """
        Паспорт принтера: кэш, номера адресации и адрес загрузки.

        `urls.fileUploadurl` — единственный адрес, по которому прошивка ждёт
        файл. Пропустить его значило бы гадать о пути загрузки, поэтому каждый
        паспорт проверяется заново: принтер вправе назвать адрес позже.
        """
        self._info.update(data)
        self._learn_ids_from_data(data)
        url = _upload_url(data)

        if url is not None and url != self._upload_url:
            self._upload_url = url
            logger.info("Anycubic %s: адрес загрузки %s", self.host, url)

    @staticmethod
    def _is_answer(
        entry: Mapping[str, Any],
        msgid: str,
        accepted_states: frozenset[str],
        any_report: bool,
    ) -> bool:
        """
        Ответ ли это на наш запрос.

        Ответ — отчёт с нашим `msgid`, с кодом (`code: 0` — принято, иначе
        отказ) или с ожидаемым состоянием. Отчёт без всего этого принтер
        присылает сам, и подтверждением команды он не является: старый `paused`
        от прошлой печати подтвердил бы новую паузу.
        """
        if msgid and entry.get("msgid") == msgid:
            return True

        if entry.get("code") is not None:
            return True

        if any_report:
            return True

        return entry.get("state") in accepted_states

    def _wait_report(
        self,
        kind: str,
        timeout: float,
        msgid: str = "",
        accepted_states: frozenset[str] = frozenset(),
        any_report: bool = False,
    ) -> dict[str, Any] | None:
        """
        Ждёт подходящий отчёт из очереди; None — не дождался.

        Отчёты приходят в потоке paho, поэтому ожидание идёт по своей очереди, а
        не по ответу брокера: `publish()` подтверждает только доставку в брокер,
        а приняла ли команду прошивка, видно лишь из отчёта.

        Неподходящие отчёты из очереди выбрасываются: в кэш они уже попали, а
        подтверждением команды не служат.
        """
        deadline = time.monotonic() + timeout

        with self._inbox_ready:
            while True:
                while self._inbox:
                    entry = self._inbox.popleft()

                    if entry["type"] != kind:
                        continue

                    if self._is_answer(entry, msgid, accepted_states, any_report):
                        return entry

                remaining = deadline - time.monotonic()

                if remaining <= 0:
                    return None

                self._inbox_ready.wait(min(remaining, REPORT_POLL))

    def _wait_ids(self, timeout: float = REPORT_TIMEOUT) -> bool:
        """
        Ждёт, пока принтер назовёт `modeId` и `deviceId`.

        Без номеров команду отправить некуда, а приходят они или в паспорте, или
        в любом другом отчёте — топик содержит оба. Ждать дольше `REPORT_TIMEOUT`
        незачем: принтер присылает первый отчёт сразу после подписки.
        """
        if self.mode_id and self.device_id:
            return True

        deadline = time.monotonic() + timeout

        with self._inbox_ready:
            while True:
                while self._inbox:
                    entry = self._inbox.popleft()
                    self._learn_ids_from_data(entry["data"])

                    if self.mode_id and self.device_id:
                        return True

                remaining = deadline - time.monotonic()

                if remaining <= 0:
                    return False

                self._inbox_ready.wait(min(remaining, REPORT_POLL))


    def _fallback_upload_url(self) -> str:
        """
        Запасной адрес загрузки: порт 18910, когда паспорт адрес не назвал.

        Точный путь называет принтер; здесь — тот же порт из справочника
        протоколов. Если сборка ждёт другой путь, отказ виден в `last_error`
        вместе с HTTP-кодом.
        """
        return f"http://{self.host}:{HTTP_PORT}{UPLOAD_PATH}"

    def _publish(self, kind: str, action: str, data: Any) -> str | None:
        """
        Сообщение в топик команд; номер сообщения или None при отказе.

        Номер нужен вызывающему: по нему отчёт сверяется с запросом. Без
        `modeId` и `deviceId` публиковать некуда — это отказ с причиной в
        `last_error`, а не молчаливая потеря команды: в шаблонный топик брокер
        доставит сообщение никому.
        """
        client = self._client

        if client is None:
            self.last_error = "нет MQTT-соединения: принтер не подключён"
            logger.error("Anycubic %s: %s", self.host, self.last_error)

            return None

        topic = self._request_topic()

        if topic is None:
            self.last_error = (
                "принтер не назвал modeId и deviceId: команду отправить некуда"
            )
            logger.error("Anycubic %s: %s", self.host, self.last_error)

            return None

        msgid = self._next_msgid()
        payload = {"type": kind, "action": action, "data": data, "msgid": msgid}

        try:
            info = client.publish(
                topic, json.dumps(payload, ensure_ascii=False), qos=0
            )
        except (OSError, ValueError) as error:
            self.last_error = f"команда не отправлена: {error}"
            logger.error("Anycubic %s: %s", self.host, self.last_error)

            return None

        if info.rc != mqtt.MQTT_ERR_SUCCESS:
            self.last_error = f"MQTT не принял сообщение (код {info.rc})"
            logger.error("Anycubic %s: %s", self.host, self.last_error)

            return None

        return msgid

    def _enable_tls(self, client: mqtt.Client) -> bool:
        """
        TLS до брокера: сертификат принтера самоподписанный.

        mTLS включается секретами `clientCert` и `clientKey` (пути к файлам):
        его требует часть прошивок, и без пары файлов брокер закрывает
        соединение на рукопожатии. `caCert` добавляет проверку цепочки — по
        умолчанию её нет: свой сертификат принтер подписывает сам.
        """
        cert = (self.secrets.get("clientCert") or "").strip()
        key = (self.secrets.get("clientKey") or "").strip()
        ca = (self.secrets.get("caCert") or "").strip()

        try:
            if cert and key:
                options: dict[str, Any] = {
                    "certfile": cert,
                    "keyfile": key,
                    "cert_reqs": ssl.CERT_REQUIRED if ca else ssl.CERT_NONE,
                }

                if ca:
                    options["ca_certs"] = ca

                client.tls_set(**options)
            else:
                client.tls_set(cert_reqs=ssl.CERT_NONE)

            client.tls_insecure_set(True)
        except (OSError, ValueError) as error:
            self.last_error = f"TLS до принтера не настроен: {error}"
            logger.error("Anycubic %s: %s", self.host, self.last_error)

            return False

        return True


    def _ensure_connection(self) -> bool:
        """
        Соединение для команды или опроса: поднимает заново, если брокер пропал.

        Адаптер живёт всё задание, а брокер принтера может перезапуститься: без
        повторного подключения опрос молча возвращал бы `error` до конца печати.
        """
        if self._client is not None:
            return True

        logger.info("Anycubic %s: соединения нет — подключаюсь заново", self.host)

        return self.connect()

    def connect(self) -> bool:
        """
        MQTT-соединение, номера адресации и паспорт принтера.

        Порядок шагов неслучаен:

          1. брокер на 9883 под TLS и пара «логин, пароль» — без CONNACK дальше
             идти некуда;
          2. подписка на отчёты: пока номера неизвестны — шаблоном, иначе точным
             топиком;
          3. номера `modeId` и `deviceId` из секретов или из первого отчёта:
             без них команду не отправить;
          4. `info/query` и `info/report` — паспорт, а в нём адрес загрузки.

        `False` — не «принтер выключен», а причина в `last_error`: молчание
        брокера, отказ в логине, ответ не от Anycubic. Успех — адрес загрузки
        известен (или будет взят с порта 18910) и `last_error` снят.
        """
        self.close()
        self._connected.clear()
        self._info = {}
        self._print = {}
        self._upload_url = None

        with self._inbox_ready:
            self._inbox.clear()

        if not self.host:
            self.last_error = "пустой адрес принтера — подключаться некуда"
            logger.error("Anycubic: %s", self.last_error)

            return False

        if not self.password:
            self.last_error = (
                "не задан пароль LAN-режима: впишите его в секреты принтера "
                "или в поле ключа"
            )
            logger.error("Anycubic %s: %s", self.host, self.last_error)

            return False

        client = mqtt.Client(
            CallbackAPIVersion.VERSION2,
            client_id=f"tridi-anycubic-{self.device_id or self.host}",
        )

        if MQTT_TLS and not self._enable_tls(client):
            return False

        client.username_pw_set(self.username, self.password)
        client.on_connect = self._on_connect
        client.on_message = self._on_message

        try:
            client.connect(self.host, MQTT_PORT, keepalive=MQTT_KEEPALIVE)
        except OSError as error:
            self.last_error = (
                f"принтер не отвечает по MQTT (порт {MQTT_PORT}): {error}"
            )
            logger.error("Anycubic %s не отвечает на MQTT: %s", self.host, error)

            return False

        client.loop_start()

        if not self._connected.wait(CONNECT_TIMEOUT):
            self.last_error = (
                f"MQTT не подтвердил подключение за {CONNECT_TIMEOUT} с: "
                "проверьте LAN-режим, логин и пароль"
            )
            logger.error("Anycubic %s: %s", self.host, self.last_error)
            self._stop(client)

            return False

        if not self._subscribe(client):
            self.last_error = "не удалось подписаться на отчёты принтера"
            self._stop(client)

            return False

        self._client = client

        if not self._wait_ids():
            self.last_error = (
                "принтер не назвал modeId и deviceId: команды адресовать нечем "
                "(впишите их в секреты принтера)"
            )
            logger.error("Anycubic %s: %s", self.host, self.last_error)
            self.close()

            return False

        # Номера могли прийти ещё до появления `_client`: тогда подписка осталась
        # шаблонной, и её нужно уточнить.
        self._refresh_subscription()

        if self._query_info() is None:
            if self.last_error is None:
                self.last_error = (
                    f"на порту {MQTT_PORT} отвечает не Anycubic: "
                    f"за {REPORT_TIMEOUT:g} с паспорт не пришёл"
                )
            logger.error("Anycubic %s: %s", self.host, self.last_error)
            self.close()

            return False

        logger.info(
            "Anycubic %s подключён: устройство %s, адрес загрузки %s",
            self.host,
            self.device_id,
            self._upload_url or f"не назван — пробую {self._fallback_upload_url()}",
        )
        self.last_error = None

        return True

    def _query_info(self) -> dict[str, Any] | None:
        """
        `info/query` и ожидание `info/report`.

        Паспорт — это и проверка «на том конце Anycubic», и адрес загрузки.
        Отказ с кодом возвращается причиной в `last_error`: принтер вправе
        отказать в паспорте, и гадать о причине незачем.
        """
        msgid = self._publish("info", "query", None)

        if msgid is None:
            return None

        entry = self._wait_report("info", REPORT_TIMEOUT, msgid=msgid, any_report=True)

        if entry is None:
            return None

        refusal = _report_error(entry["payload"])

        if refusal is not None:
            self.last_error = f"паспорт не получен: {refusal}"
            logger.error("Anycubic %s: %s", self.host, self.last_error)

            return None

        return entry["data"]


    def prepare_upload(self, local_path: str, remote_name: str) -> UploadPlan:
        """
        Готовит файл: имя, формат, размер и MD5.

        MD5 — требование прошивки: `print/start` несёт сумму файла, и принтер
        сверяет её с уже принятым. Считать сумму после загрузки значило бы
        читать файл второй раз, поэтому она считается здесь, вместе с размером.

        Проверка формата остаётся за `super()`: `.3mf` Kobra не печатает, и
        отказ приходит до сети, а не после загрузки сотни мегабайт.
        """
        plan = super().prepare_upload(local_path, remote_name)

        return UploadPlan(
            path=plan.path,
            remote_name=plan.remote_name,
            md5=file_digest(plan.path),
            size=plan.size,
            is_temp=plan.is_temp,
        )

    def upload_file(self, local_path: str, remote_name: str) -> bool:
        """
        Загружает G-code на принтер: `POST <fileUploadurl>` multipart-формой.

        Поле называется `gcode`, заголовок `X-File-Length` несёт размер:
        прошивка готовит место под файл до чтения тела. Отказ 19007 значит, что
        имя не заканчивается на `.gcode` (или поле названо не так), 10105 — что
        принтер занят.

        Адрес берётся из паспорта принтера, а не из настроек: у принтера он
        один, и меняется от сборки к сборке.
        """
        try:
            plan = self.prepare_upload(local_path, remote_name)
        except FormatError as error:
            self.last_error = f"формат не подходит: {error}"
            logger.error(
                "G-code %s не отправлен на %s: %s", remote_name, self.host, error
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

        Часть формы называется `gcode`, а не `file`: прошивка ищет файл в поле
        с этим именем, а с чужим он приходит пустым — принтер отвечает 19007 и
        как будто «не тот формат».
        """
        url = self._upload_url

        if url is None:
            url = self._fallback_upload_url()
            logger.warning(
                "Anycubic %s: принтер не назвал адрес загрузки — пробую %s",
                self.host,
                url,
            )

        try:
            with open(plan.path, "rb") as source:
                response = requests.post(
                    url,
                    files={
                        FILE_FIELD: (
                            plan.remote_name,
                            source,
                            "application/octet-stream",
                        )
                    },
                    headers={FILE_LENGTH_HEADER: str(plan.size)},
                    timeout=UPLOAD_TIMEOUT,
                )
        except requests.RequestException as error:
            self.last_error = f"G-code не загружен: {error}"
            logger.error(
                "G-code %s не загружен на %s: %s",
                plan.remote_name,
                self.host,
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
            self.last_error = (
                f"G-code не загружен: HTTP {response.status_code}, "
                f"{_response_text(response)}"
            )
            logger.error(
                "G-code %s не загружен на %s: HTTP %s",
                plan.remote_name,
                self.host,
                response.status_code,
            )

            return False

        refusal = _upload_refusal(_read_json(response, quiet=True))

        if refusal is not None:
            self.last_error = f"G-code не загружен: {refusal}"
            logger.error(
                "G-code %s не принят %s: %s",
                plan.remote_name,
                self.host,
                refusal,
            )

            return False

        # Сумма и размер понадобятся `start_print()`: файл уже на принтере, а
        # агент помнит, что именно он отправил.
        self._uploaded = (plan.remote_name, plan.md5 or "", plan.size)
        logger.info(
            "G-code %s загружен на %s (%d байт)",
            plan.remote_name,
            self.host,
            plan.size,
        )
        self.last_error = None

        return True


    def _uploaded_file(self, remote_name: str) -> tuple[str, str, int]:
        """
        Имя, MD5 и размер файла с последней загрузки.

        Файла на диске у `start_print()` нет: сумма и размер берутся с загрузки.
        Имя — тоже с загрузки: `prepare_upload()` мог его очистить (пробел стал
        `-`), и команда с исходным именем искала бы на принтере файл, которого
        там нет.

        Загрузки не было (агент перезапустили между загрузкой и стартом) —
        команда уйдёт с пустой суммой и нулевым размером, и прошивка откажет;
        выдумывать сумму нельзя, принтер сверит её с файлом.
        """
        uploaded = self._uploaded

        if uploaded is None:
            logger.warning(
                "Anycubic %s: файл %s не загружался в этом запуске — "
                "печать уйдёт без MD5",
                self.host,
                remote_name,
            )

            return remote_name, "", 0

        name, md5, size = uploaded

        if name != remote_name:
            logger.warning(
                "Anycubic %s: просили печать %s, а загружен %s — печатаю "
                "загруженный: файла с другим именем на принтере нет",
                self.host,
                remote_name,
                name,
            )

        return name, md5, size

    def start_print(self, remote_name: str) -> bool:
        """
        Запускает печать: `print/start`.

        `taskid: "-1"` — новая задача: так принтер понимает, что печатать надо
        файл, а не продолжать прошлую печать. `filetype: 1` и `project_type: 1` —
        G-code и обычный проект, других значений прошивка не ждёт. `md5` и
        `filesize` берутся с загрузки: по сумме принтер находит уже принятый
        файл.
        """
        name, md5, size = self._uploaded_file(remote_name)
        payload = {
            "taskid": NEW_TASK_ID,
            "filename": name,
            "md5": md5,
            "filetype": FILE_TYPE_GCODE,
            "filesize": size,
            "project_type": PROJECT_TYPE_NORMAL,
        }

        return self._command("start", payload, "запуск печати", _PRINTING_STATES)

    def pause_print(self) -> bool:
        """Пауза: `print/pause` с номером текущей задачи."""
        return self._command(
            "pause", {"taskid": self._task_id()}, "пауза", _PAUSED_STATES
        )

    def resume_print(self) -> bool:
        """Возврат с паузы: `print/resume` с номером текущей задачи."""
        return self._command(
            "resume", {"taskid": self._task_id()}, "возврат с паузы", _PRINTING_STATES
        )

    def stop_print(self) -> bool:
        """
        Остановка: `print/stop` с номером текущей задачи.

        Файл на принтере адаптер не удаляет: его уберёт следующая загрузка с тем
        же именем, а лишний запрос на занятом принтере — лишний повод для отказа.
        """
        return self._command(
            "stop", {"taskid": self._task_id()}, "остановка", _IDLE_STATES
        )

    def _task_id(self) -> str:
        """
        Номер текущей задачи из последнего отчёта.

        Прошивка адресует команду номером задачи; пока отчёта не было (пауза
        сразу после старта), уходит `-1` — «та задача, что идёт», как и при
        старте новой.
        """
        task = _first_text(self._print, _TASK_FIELDS)

        if task is not None:
            return task

        logger.debug(
            "Anycubic %s: номер задачи неизвестен — отправляю %s",
            self.host,
            NEW_TASK_ID,
        )

        return NEW_TASK_ID

    def _command(
        self,
        action: str,
        payload: Mapping[str, Any],
        label: str,
        accepted: frozenset[str],
    ) -> bool:
        """
        Команда печати и ожидание подтверждения.

        Ответом считается отчёт с нашим `msgid`, с кодом (`code: 0` — принято,
        иначе отказ) или с ожидаемым состоянием: печать — после старта, пауза —
        после паузы, простой — после остановки. Прочие отчёты принтер присылает
        сам, и они ответом не считаются.

        Тишина — отказ: прошивка, не ответившая на команду, её не выполнила.
        Так же ведёт себя Elegoo; Creality в этой ситуации считает команду
        отправленной, потому что её прошивки молчат штатно.
        """
        self.last_error = None

        if not self._ensure_connection():
            return False

        msgid = self._publish("print", action, dict(payload))

        if msgid is None:
            return False

        entry = self._wait_report(
            "print", COMMAND_TIMEOUT, msgid=msgid, accepted_states=accepted
        )

        if entry is None:
            self.last_error = f"{label}: принтер не ответил"
            logger.error("Anycubic %s: %s", self.host, self.last_error)

            return False

        refusal = _report_error(entry["payload"])

        if refusal is not None:
            self.last_error = f"{label}: {refusal}"
            logger.error("Anycubic %s: %s", self.host, self.last_error)

            return False

        logger.info("Anycubic %s: команда «%s» принята", self.host, label)

        return True

    @staticmethod
    def _error_status() -> dict[str, Any]:
        """Ответ `get_status()` при отказе: причина — в `last_error`."""
        return {"status": "error", "progress": 0, "remaining_time": 0}


    def get_status(self) -> dict[str, Any]:
        """
        Состояние печати из `print/report`.

        Принтер присылает отчёты сам, поэтому метод ждёт свежий не дольше
        `STATUS_TIMEOUT`, а иначе отвечает по последнему: ждать `REPORT_TIMEOUT`
        на каждом опросе значило бы держать очередь заданий.

        `_STATE_MAP` переводит состояние принтера в статус агента. Прогресс —
        проценты, остаток — `printLeftTime` в секундах. У простоя остаток ноль:
        в кэше осталось время прошлой печати, и «осталось 40 минут» у свободного
        принтера читалось бы как идущая работа.
        """
        if not self._ensure_connection():
            return self._error_status()

        # Отчёт мог прийти и сам — тогда ожидание заканчивается сразу.
        self._wait_report("print", STATUS_TIMEOUT, any_report=True)

        if not self._print:
            self.last_error = "принтер не прислал отчёт о печати"
            logger.error("Anycubic %s: %s", self.host, self.last_error)

            return self._error_status()

        state = _report_state(self._print)
        status = _STATE_MAP.get(state)
        progress = _as_percent(_pick(self._print, _PROGRESS_FIELDS))

        if status is None:
            self.last_error = f"неизвестное состояние печати: {state!r}"
            logger.warning("Anycubic %s: %s", self.host, self.last_error)

            return {"status": "error", "progress": progress, "remaining_time": 0}

        remaining = (
            0
            if status == "idle"
            else _as_seconds(_pick(self._print, _REMAINING_FIELDS))
        )

        if status == "error":
            # Принтер сам остановил печать: main.py закроет задание как
            # провальное, и мастер должен увидеть причину, а не «error».
            self.last_error = f"принтер остановил печать ({state})"
            logger.error("Anycubic %s: %s", self.host, self.last_error)
        else:
            self.last_error = None

        return {"status": status, "progress": progress, "remaining_time": remaining}

    def probe(self) -> dict[str, Any]:
        """
        Проба для формы «Проверить принтер».

        Паспорт — единственный источник модели, прошивки и номера устройства,
        поэтому проба подключается по-настоящему: мастер вводит адрес и ключ и до
        сохранения принтера должен увидеть ответ машины. Отказ возвращает
        статику класса, а причину — в `last_error`: форма покажет одно, журнал
        другое, и мастер увидит, что именно не сошлось.

        `serial_number` — номер устройства: он же `deviceId` из топиков, и по
        нему мастер отличает два одинаковых принтера в цеху.
        """
        result = super().probe()

        if self._client is None and not self.connect():
            return result

        model = _first_text(self._info, _MODEL_FIELDS)
        firmware = _first_text(self._info, _FIRMWARE_FIELDS)

        if model is not None:
            result["model"] = model

        if firmware is not None:
            result["firmware"] = firmware

        if self.device_id:
            result["serial_number"] = self.device_id

        return result

