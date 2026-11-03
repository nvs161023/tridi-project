"""
Адаптер FlashForge (Adventurer 5M / 5M Pro / AD5X).

FlashForge — HTTP-протокол на порту 8898: отдельная служба рядом с
веб-интерфейсом принтера, без Moonraker и без WebSocket. Прошивка узнаёт
мастера по паре `serialNumber` + `checkCode`, поэтому оба значения здесь не
«дополнительные», а обязательные.

Запросы:

  - `/detail` — паспорт и состояние: `detail.name` (модель),
    `detail.firmwareVersion`, `detail.serialNumber`, `machineStatus` и
    `printInfo` (`printProgress`, `remainingTimeEstimation`). Один адрес
    отвечает и за «принтер на связи», и за опрос печати. Где прошивка ждёт
    пару `serialNumber`/`checkCode`, зависит от сборки: 3.x (`Adventurer 5M
    Pro`, `AD5X`) читает её из JSON-тела `POST /detail`, ранние сборки — из
    заголовков `GET /detail`. На чужой вид запроса принтер отвечает 404 и
    пустым телом, поэтому адаптер пробует оба;
  - `POST /uploadGcode` — `multipart/form-data`, поле `gcodeFile`. Заголовки
    `fileSize`, `printNow: false`, `levelingBeforePrint: true` и та же пара
    `serialNumber`/`checkCode`: этот адрес авторизует только по заголовкам
    (номер полем формы прошивка не видит и отвечает «SN is different»).
    `printNow: false` оставляет запуск агенту, а калибровка стола нужна любому
    заданию;
  - `POST /printGcode` — `{"serialNumber", "checkCode", "fileName",
    "levelingBeforePrint": true}`;
  - `POST /control` — `{"serialNumber", "checkCode", "jobCtl_cmd"}`:
    `pause`, `continue` или `cancel`.

Серийный номер и checkCode обязательны. `serialNumber` берётся из поля
«Серийный номер (SN)» формы принтера (`workshop_printers.serial_number`), а если
его не заполнили — из секретов записи (`serialNumber` в `printer_secrets`:
запасной путь для принтеров, заведённых до появления колонки SN). `checkCode`
печатается на экране принтера и хранится только в секретах.

Без любого из двух значений адаптер не выходит в сеть: прошивка без них отвечает
отказом (`Parameters is error` у 3.x, 404 у ранних сборок), и мастер видел
«прошивка не знает /detail», хотя пустое поле было в карточке принтера. Поэтому
`connect()` возвращает `False` сразу и называет поля карточки. 404 на оба вида
запроса — уже другая причина: выключенный LAN-режим или чужой сервис на 8898.

Ответ на команду. Прошивка отвечает `{"code": 0, "message": "Success"}`: ноль —
успех, остальное — отказ с текстом в `message`. Ответ без `code` (часть сборок
отвечает пустым объектом) считается подтверждением: команда ушла, а правду
покажет следующий `get_status()`. HTTP при этом всегда 200, поэтому код в теле —
единственный признак отказа, а английский текст переводится подсказкой
(`_REFUSAL_HINTS`): «Access code is different» — про поле Check Code, «SN is
different» — про серийный номер.

Форматы. 5M печатает обычный G-code, AD5X и Creator 5 — контейнер `.3mf` с
готовым G-code внутри. Проверку записей контейнера делает `formats.py`
(`ensure_format()`), адаптеру она достаётся из `prepare_upload()`.

Сеть. Ни один метод не выпускает `requests.*` наружу: выключенный принтер — это
запись в журнале и `False` (или статус `error` у `get_status()`), а не падение
агента. Таймауты обязательны: без них цикл опроса встаёт вместе с принтером.
"""
from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, Final

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

logger = logging.getLogger("agent.adapters.flashforge")

# HTTP API прошивки. Отдельная служба: веб-интерфейс принтера живёт на 80-м
# порту, и путать их нельзя — там нет ни `/detail`, ни `/uploadGcode`.
HTTP_PORT: Final = 8898

# Сколько ждать ответа FlashForge. Без таймаута requests может ждать вечно, и
# цикл опроса встанет вместе с принтером.
REQUEST_TIMEOUT = 10

# Загрузка файла идёт дольше опроса: контейнер `.3mf` на десятки мегабайт по
# Wi-Fi передаётся минутами, обрывать его на десяти секундах нельзя.
UPLOAD_TIMEOUT = 120

DETAIL_PATH: Final = "/detail"
UPLOAD_PATH: Final = "/uploadGcode"
PRINT_PATH: Final = "/printGcode"
CONTROL_PATH: Final = "/control"

# Виды запроса `/detail`: `True` — пара `serialNumber`/`checkCode` в JSON-теле
# `POST` (прошивки 3.x), `False` — в заголовках `GET` (ранние сборки). Порядок
# важен: 404 от принтера дешёвый (доли секунды), а вот второй таймаут на
# выключенном принтере мастеру ждать не за что — поэтому тело идёт первым, а
# заголовки остаются запасным путём.
DETAIL_REQUEST_SHAPES: Final[tuple[bool, ...]] = (True, False)

# Причина отказа, когда карточка принтера не заполнена. Без этой пары прошивка
# отвечает отказом на любой запрос, а мастер читал «прошивка не знает /detail» и
# искал проблему в модели принтера вместо пустых полей. Запрос в сеть при пустых
# полях не отправляется вовсе: незачем ждать таймаут десять секунд.
CREDENTIALS_MISSING: Final = (
    "Не указан Serial Number или Check Code. Добавьте их в карточке принтера"
)

# 404 от `/detail` на оба вида запроса: принтер не понял ни тело, ни заголовки.
# Это уже не «пустая карточка» (та отсекается до сети), а выключенный LAN-режим,
# чужой сервис на 8898 или прошивка без этого API.
DETAIL_NOT_FOUND: Final = (
    "FlashForge не ответил на /detail (404). Проверьте, что в настройках "
    "принтера включён LAN-режим и указаны Serial Number и Check Code."
)

# Отказы прошивки в `message`: HTTP всегда 200, а исход лежит в `code`, и текст
# английский — мастеру он ничего не объясняет. «Access code is different» и «SN
# is different» относятся к двум разным полям карточки, и путать их нельзя:
# новый код не исправит чужой серийный номер.
_REFUSAL_HINTS: Final[dict[str, str]] = {
    "access code is different": "checkCode не принят — сверьте код с экрана принтера",
    "sn is different": "серийный номер не принят — сверьте SN с экрана принтера",
    "parameters is error": "принтер не разобрал параметры запроса",
    "content-type is error": "принтер не принял формат запроса",
    "file is not exist": "такого файла нет на принтере — повторите загрузку",
}


# `jobCtl_cmd` в `POST /control`. Возврат прошивка называет `continue`, а не
# `resume`: неизвестную команду она отклоняет, и печать осталась бы стоять.
JOB_PAUSE: Final = "pause"
JOB_RESUME: Final = "continue"
JOB_CANCEL: Final = "cancel"

# `machineStatus` из `/detail` → статус агента.
#
# `HEATING`, `PREHEATING`, `HOMING`, `LEVELING`, `CALIBRATING` и `BUSY` — печать,
# а не простой: сразу после `/printGcode` прошивка греет и калибрует стол, и
# `idle` в этот момент main.py прочитал бы как «печать не начиналась» и закрыл
# задание провалом в первом же опросе.
#
# `COMPLETED` — простой: печать закончена, задание закроется как `done`.
# `ERROR`, `CANCELLED` и `STOPPED` — ошибка: мастер увидит причину в
# `last_error`, а не «печать идёт» до бесконечности.
_STATE_MAP: Final[dict[str, str]] = {
    "ready": "idle",
    "completed": "idle",
    "complete": "idle",
    "finished": "idle",
    "printing": "printing",
    "heating": "printing",
    "preheating": "printing",
    "homing": "printing",
    "leveling": "printing",
    "calibrating": "printing",
    "busy": "printing",
    "paused": "paused",
    "pausing": "paused",
    "error": "error",
    "failed": "error",
    "cancelled": "error",
    "canceled": "error",
    "stopped": "error",
}

# Поля `/detail`, в которых прошивка называет состояние, модель, прошивку и
# номер: сборки называют их по-разному, берём первое найденное.
_STATE_FIELDS: Final[tuple[str, ...]] = (
    "machineStatus",
    "machine_status",
    "status",
)
_MODEL_FIELDS: Final[tuple[str, ...]] = (
    "name",
    "machineName",
    "machine_name",
    "productName",
    "model",
)
_FIRMWARE_FIELDS: Final[tuple[str, ...]] = (
    "firmwareVersion",
    "firmware_version",
    "firmware",
)

# Поля `printInfo`: проценты и остаток печати.
_PROGRESS_FIELDS: Final[tuple[str, ...]] = (
    "printProgress",
    "print_progress",
    "progress",
)
_REMAINING_FIELDS: Final[tuple[str, ...]] = (
    "remainingTimeEstimation",
    "remainingTime",
    "printLeftTime",
    "print_left_time",
)

# Подпись ответа `/detail`: чужой сервис на 8898 не должен считаться принтером.
_DETAIL_SIGNATURE: Final[tuple[str, ...]] = (
    "machineStatus",
    "machine_status",
    "printInfo",
    "serialNumber",
)

# Подсказки к кодам отказа: «HTTP 401» мастер прочитает как проблему сети, хотя
# принтер просто не принял код с экрана. 404 сюда не входит: он объясняется
# целиком (`DETAIL_NOT_FOUND`), потому что чаще всего это пустая карточка.
_DETAIL_HINTS: Final[dict[int, str]] = {
    401: "checkCode не принят — сверьте код с экраном принтера",
    403: "принтеру запрещены запросы по сети — включите LAN-режим",
}
_UPLOAD_HINTS: Final[dict[int, str]] = {
    400: "запрос отклонён: проверьте серийный номер и checkCode принтера",
    401: "checkCode не принят — сверьте код с экраном принтера",
    403: "принтеру запрещена запись файла",
    413: "файл больше памяти принтера",
    500: "прошивка не смогла записать файл — повторите загрузку",
}
_COMMAND_HINTS: Final[dict[int, str]] = {
    400: "команда отклонена: проверьте серийный номер и checkCode принтера",
    401: "checkCode не принят — сверьте код с экраном принтера",
    403: "принтеру запрещено управление по сети",
    409: "принтер занят: дождитесь окончания текущей печати",
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

    Запятая как десятичный разделитель встречается в ответах частичной локали:
    `"42,6"` — это те же 42.6 процента, и терять прогресс из-за запятой незачем.
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
    Проценты 0…100: FlashForge отдаёт их готовыми (`printProgress`).

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
                "FlashForge ответил не JSON: HTTP %s, %r",
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

    Подсказка идёт первой: «HTTP 401: checkCode не принят» мастер поймёт, а
    «HTTP 401, Unauthorized» заставит искать проблему в сети.
    """
    hint = (hints or {}).get(response.status_code)

    if hint:
        return f"HTTP {response.status_code}: {hint} ({_response_text(response)})"

    return f"HTTP {response.status_code}, {_response_text(response)}"


def _detail_payload(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    """
    Данные принтера из ответа `/detail`.

    Прошивка отвечает `{"code": 0, "message": "Success", "detail": {...}}`, но
    часть сборок кладёт поля на верхний уровень. Чужой JSON (прокси, роутер на
    том же порту) отсекается по подписи: в данных принтера должно быть поле
    `machineStatus`, `printInfo` или `serialNumber`. Проверка нужна и для
    вложенного `detail`: код `0` с посторонним объектом внутри — не паспорт.
    """
    if payload is None:
        return None

    for source in (payload.get("detail"), payload):
        candidate = _as_mapping(source)

        if candidate is None:
            continue

        if any(field in candidate for field in _DETAIL_SIGNATURE):
            return candidate

    return None


def _ack_reason(payload: dict[str, Any] | None) -> str | None:
    """
    Отказ прошивки: `{"code": 0, "message": "Success"}` — успех.

    Конверт один у `/detail`, `/uploadGcode`, `/printGcode` и `/control`: HTTP
    всегда 200, а исход лежит в `code` (`0` — успех, `1` — не принят код с
    экрана или номер, `-1` — не разобраны параметры). Английский `message`
    мастеру ничего не объясняет, поэтому известные отказы переводит
    `_REFUSAL_HINTS`, а код остаётся в тексте для журнала.

    Пустое тело и ответ без `code` считаются подтверждением: часть сборок
    отвечает `{}` или строкой, а саму команду уже выполнила.
    """
    if payload is None:
        return None

    code = _as_number(payload.get("code"))

    if code is None or code == 0:
        return None

    message = _first_text(payload, ("message", "msg"))
    hint = _REFUSAL_HINTS.get(message.lower()) if message else None

    if hint:
        return f"{hint} (код {int(code)})"

    if message:
        return f"code {int(code)}: {message}"

    return f"code {int(code)}"


class FlashForgeAdapter(BasePrinterAdapter):
    """
    Принтер FlashForge: HTTP 8898, `/detail`, `/uploadGcode`, `/printGcode`,
    `/control`.
    """

    # Ключ протокола в справочнике: по нему `prepare_upload()` сверяет формат
    # файла (`.gcode` у 5M, `.3mf` у AD5X и Creator 5).
    protocol_key = "flashforge"

    # Что адаптер действительно делает: `/control` знает паузу, возврат и
    # отмену, поэтому интерфейс показывает эти кнопки.
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

    # Форматы повторяют паспорт протокола: `.gcode` и контейнер `.3mf`. Записи
    # внутри контейнера проверяет `formats.py` — модель без G-code до принтера
    # не дойдёт.
    accepted_formats = (".gcode", ".3mf")

    def __init__(
        self,
        ip_address: str,
        api_key: str,
        serial_number: str = "",
        secrets: Mapping[str, str] | None = None,
    ) -> None:
        """
        `ip_address` — адрес принтера: `192.168.1.70`, `adventurer.local` или
        `http://192.168.1.70`. Порт в адресе относится к HTTP API: так мастер
        попадает на принтер через прокси. По умолчанию 8898.

        `serial_number` — поле «Серийный номер (SN)» формы принтера. Пустое
        значение не «дозаполнится» позже: прошивка сверяет номер с платой и без
        него отказывает, поэтому `connect()` вернёт `False` с просьбой указать
        Serial Number и Check Code.

        `secrets` — содержимое `workshop_printers.printer_secrets`. Нужен
        `checkCode` (код с экрана принтера); `serialNumber` в секретах читается
        как запасной путь для записей, заведённых до появления колонки SN.

        `api_key` принимается ради общего контракта, но в запросы не попадает:
        FlashForge авторизует по `serialNumber` и `checkCode`, а выдуманный
        заголовок прошивка проигнорирует — и мастер решил бы, что ключ проверен.
        """
        super().__init__(ip_address=ip_address, api_key=api_key, secrets=secrets)

        address = ip_address.strip().rstrip("/")

        for scheme in ("http://", "https://"):
            if address.startswith(scheme):
                address = address[len(scheme) :]

        host, _, port = address.partition(":")
        host = host or address

        self.host = host
        self.port = int(port) if port.isdigit() else HTTP_PORT
        # Базовый URL без слэша на конце: пути ниже начинаются с `/`.
        self.base_url = f"http://{host}:{self.port}"
        # Номер из формы главнее секретов: мастер мог переписать его после
        # замены платы, а секреты остались от прежней записи.
        self.serial_number = (
            serial_number or self.secrets.get("serialNumber") or ""
        ).strip()
        # checkCode печатает сам принтер: из сети его не узнать.
        self.check_code = (self.secrets.get("checkCode") or "").strip()
        # Паспорт из `/detail`: модель и прошивка для журнала и пробы.
        self.model: str | None = None
        self.firmware: str | None = None

    def _headers(self, extra: Mapping[str, str] | None = None) -> dict[str, str]:
        """
        Заголовки запроса: `serialNumber`, `checkCode` и то, что нужно методу.

        Пара нужна в заголовках всегда, даже если паспорт и команды берут её из
        тела: `/uploadGcode` другого вида авторизации не знает.

        Пустые значения не отправляются: заголовок с пустым значением прошивка
        читает как «номер есть, но пустой» и отвечает отказом, который мастеру
        ничего не объясняет. Отсутствие номера ловит `_require_identity()`, а
        пустой `checkCode` виден в журнале при подключении.
        """
        headers = {"Accept": "application/json"}

        if self.serial_number:
            headers["serialNumber"] = self.serial_number

        if self.check_code:
            headers["checkCode"] = self.check_code

        headers.update(extra or {})

        return headers

    def _require_identity(self, label: str) -> bool:
        """
        Проверка серийного номера до сети.

        False — номера нет, и запрос отправлять некуда: прошивка сверяет
        `serialNumber` с платой и пустой номер отклоняет. Причина остаётся в
        `last_error`, чтобы мастер увидел её в карточке задания, а не «HTTP
        400» из журнала.
        """
        if self.serial_number:
            return True

        self.last_error = (
            "не задан серийный номер принтера (SN): FlashForge сверяет его с "
            f"платой, а без него {label} отклоняется"
        )
        logger.error("FlashForge %s: %s", self.ip_address, self.last_error)

        return False

    def _missing_credentials(self) -> str | None:
        """
        Чего не хватает для запроса к принтеру: `serialNumber` и `checkCode`.

        Без любого из двух значений прошивка отвечает отказом (`Parameters is
        error`) вместо паспорта, поэтому проверка стоит до сети: таймаут
        десять секунд мастеру ждать не за что, а причина в `last_error` должна
        называть поля карточки, а не HTTP-код.
        """
        if self.serial_number and self.check_code:
            return None

        return CREDENTIALS_MISSING

    def _read_detail(self) -> dict[str, Any] | None:
        """
        Паспорт и состояние печати из `/detail`.

        Прошивки 3.x читают `serialNumber` и `checkCode` из JSON-тела `POST`,
        ранние сборки — из заголовков `GET`: на чужой вид запроса принтер
        отвечает 404 и пустым телом. Поэтому сначала уходит тело, а
        заголовочный запрос — только если тело не разобралось.

        Отказ по существу (`code` не ноль: код с экрана или номер не приняты,
        параметры не разобраны) второй запрос не оправдывает: вид запроса уже
        верный, и мастеру нужна причина, а не второй таймаут.

        Ответ без `detail` и без полей принтера — не FlashForge: на 8898 в
        мастерской может оказаться чужой сервис, и «подключено» там было бы
        ложью. Причина отказа остаётся в `last_error`.
        """
        missing = self._missing_credentials()

        if missing is not None:
            self.last_error = missing
            logger.error(
                "FlashForge %s: %s (serialNumber: %s, checkCode: %s)",
                self.ip_address,
                missing,
                "задан" if self.serial_number else "пуст",
                "задан" if self.check_code else "пуст",
            )

            return None

        reason: str | None = None

        for in_body in DETAIL_REQUEST_SHAPES:
            detail, attempt_reason, retry = self._detail_attempt(in_body)

            if detail is not None:
                self._remember_detail(detail)

                return detail

            # 404 запасного запроса не должен затирать причину первой попытки:
            # чужой сервис на 8898 отвечает на `POST` посторонним JSON, а на
            # `GET` — 404, и мастеру нужнее «отвечает не FlashForge», чем код.
            if reason is None or reason == DETAIL_NOT_FOUND:
                reason = attempt_reason

            if not retry:
                break

        if reason is not None:
            self.last_error = reason
            logger.error("FlashForge %s: %s", self.ip_address, reason)

        return None

    def _detail_attempt(
        self, in_body: bool
    ) -> tuple[dict[str, Any] | None, str | None, bool]:
        """
        Один запрос `/detail`: `(паспорт, причина отказа, пробовать другой вид)`.

        Третий элемент — «прошивка не поняла вид запроса»: 404, пустое тело и
        не-JSON. Сеть и отказ по существу второй запрос не оправдывают: у
        выключенного принтера это ещё один таймаут, а чужой код с экрана не
        исправится сменой вида запроса.
        """
        try:
            if in_body:
                response = requests.post(
                    f"{self.base_url}{DETAIL_PATH}",
                    headers=self._headers(),
                    json={
                        "serialNumber": self.serial_number,
                        "checkCode": self.check_code,
                    },
                    timeout=REQUEST_TIMEOUT,
                )
            else:
                response = requests.get(
                    f"{self.base_url}{DETAIL_PATH}",
                    headers=self._headers(),
                    timeout=REQUEST_TIMEOUT,
                )
        except requests.RequestException as error:
            return None, f"паспорт не получен: {error}", False

        if response.status_code != 200:
            if response.status_code == 404:
                return None, DETAIL_NOT_FOUND, True

            return (
                None,
                f"паспорт не получен: {_http_reason(response, _DETAIL_HINTS)}",
                False,
            )

        answer = _read_json(response)

        # Пустое тело и HTML вместо JSON — тоже «не понял», но причина другая:
        # так отвечает чужой сервис на 8898, а не прошивка с отказом. Второй
        # вид запроса это не исправит, но проверить его дешевле, чем оставить
        # мастера с догадками.
        if answer is None:
            return (
                None,
                "на /detail пришёл не JSON — на 8898 отвечает не прошивка",
                True,
            )

        refusal = _ack_reason(answer)

        if refusal is not None:
            return None, refusal, False

        detail = _detail_payload(answer)

        if detail is None:
            return None, "на 8898 отвечает не FlashForge: нет данных принтера", True

        return detail, None, False

    def _remember_detail(self, detail: Mapping[str, Any]) -> None:
        """
        Запоминает паспорт: модель и прошивку.

        `name` у FlashForge — модель («Adventurer 5M Pro»), `firmwareVersion` —
        прошивка. Серийный номер отсюда не берётся: без него `_read_detail()` в
        сеть не выходит (прошивка отвечает отказом), поэтому номер всегда
        приходит из карточки принтера.
        """
        self.model = _first_text(detail, _MODEL_FIELDS) or self.model
        self.firmware = _first_text(detail, _FIRMWARE_FIELDS) or self.firmware

    def connect(self) -> bool:
        """
        `/detail` с паспортом принтера — принтер на связи.

        Без `serialNumber` и `checkCode` подключение не начинается: прошивка
        без них отвечает отказом, а не паспортом. `last_error` в этом случае
        называет поля карточки принтера, а не HTTP-код: мастеру нужно знать,
        что заполнить, а не что случилось с `/detail`.
        """
        detail = self._read_detail()

        if detail is None:
            return False

        logger.info(
            "FlashForge %s доступен: %s, прошивка %s",
            self.ip_address,
            self.model or "неизвестна",
            self.firmware or "неизвестна",
        )
        self.last_error = None

        return True

    def upload_file(self, local_path: str, remote_name: str) -> bool:
        """
        Загружает файл в `POST /uploadGcode` multipart-формой, поле `gcodeFile`.

        Заголовки `fileSize`, `printNow: false` и `levelingBeforePrint: true`:
        размер прошивка сверяет с принятым файлом, `printNow` запрещает печать
        сразу после загрузки (команду печати отправляет агент, когда узнал об
        успехе), а калибровка стола перед печатью нужна любому заданию — иначе
        деталь печатается по забытым настройкам стола.

        `FormatError` и `OSError` подготовки становятся `last_error` и `False`:
        так мастер видит причину, а не «задание провалилось».
        """
        try:
            plan = self.prepare_upload(local_path, remote_name)
        except FormatError as error:
            self.last_error = str(error)
            logger.error(
                "Файл %s не загружен на %s: %s",
                remote_name,
                self.ip_address,
                error,
            )

            return False
        except OSError as error:
            self.last_error = f"файл не прочитан: {error}"
            logger.error("Файл %s не прочитан: %s", local_path, error)

            return False

        try:
            return self._upload_prepared(plan)
        finally:
            self.cleanup_upload(plan)

    def _upload_prepared(self, plan: UploadPlan) -> bool:
        """
        Отправляет подготовленный файл multipart-формой с полем `gcodeFile`.

        Имя приходит из `prepare_upload()`: папки отброшены, кириллица снята,
        пробелы заменены на `-`. Файл прошивка кладёт в свою папку сама, а
        `start_print()` ищет его по этому же имени.

        Пара `serialNumber`/`checkCode` здесь уходит заголовками: `/uploadGcode`
        читает авторизацию только оттуда и на номер полем формы отвечает «SN is
        different».
        """
        if not self._require_identity("загрузка файла"):
            return False

        headers = self._headers(
            {
                "fileSize": str(plan.size),
                "printNow": "false",
                "levelingBeforePrint": "true",
            }
        )

        try:
            with open(plan.path, "rb") as gcode:
                response = requests.post(
                    f"{self.base_url}{UPLOAD_PATH}",
                    headers=headers,
                    files={
                        "gcodeFile": (
                            plan.remote_name,
                            gcode,
                            "application/octet-stream",
                        )
                    },
                    timeout=UPLOAD_TIMEOUT,
                )
        except requests.RequestException as error:
            self.last_error = f"файл не загружен: {error}"
            logger.error(
                "Файл %s не загружен на %s: %s",
                plan.remote_name,
                self.ip_address,
                error,
            )

            return False
        except OSError as error:
            # Проверка после RequestException: он тоже наследник OSError, но
            # сетевую ошибку нужно отличать от нечитаемого файла.
            self.last_error = f"файл не прочитан: {error}"
            logger.error("Файл %s не прочитан: %s", plan.path, error)

            return False

        if response.status_code not in (200, 201):
            reason = _http_reason(response, _UPLOAD_HINTS)
            self.last_error = f"файл не загружен: {reason}"
            logger.error(
                "Файл %s не загружен на %s: %s",
                plan.remote_name,
                self.ip_address,
                reason,
            )

            return False

        refusal = _ack_reason(_read_json(response, quiet=True))

        if refusal is not None:
            self.last_error = f"файл не загружен: {refusal}"
            logger.error(
                "Файл %s не принят %s: %s",
                plan.remote_name,
                self.ip_address,
                refusal,
            )

            return False

        logger.info(
            "Файл %s загружен на %s (%d байт)",
            plan.remote_name,
            self.ip_address,
            plan.size,
        )
        self.last_error = None

        return True

    def start_print(self, remote_name: str) -> bool:
        """
        Запускает печать загруженного файла: `POST /printGcode`.

        `fileName` — имя, под которым файл лёг на принтер: прошивка ищет файл по
        нему, поэтому после загрузки имя не меняется. `levelingBeforePrint:
        true` повторяет настройку загрузки: часть прошивок читает её только
        здесь.
        """
        if not self._require_identity("запуск печати"):
            return False

        payload = {
            "serialNumber": self.serial_number,
            "checkCode": self.check_code,
            "fileName": remote_name,
            "levelingBeforePrint": True,
        }

        return self._command(PRINT_PATH, payload, "запуск печати")

    def pause_print(self) -> bool:
        """Пауза: `POST /control` с `jobCtl_cmd: "pause"`."""
        return self._control(JOB_PAUSE, "пауза")

    def resume_print(self) -> bool:
        """Возврат: `jobCtl_cmd: "continue"` — так прошивка называет снятие с паузы."""
        return self._control(JOB_RESUME, "возврат")

    def stop_print(self) -> bool:
        """
        Остановка: `jobCtl_cmd: "cancel"`.

        Файл на принтере адаптер не удаляет: имя содержит идентификатор задания,
        и повторная печать начинается с новой загрузки.
        """
        return self._control(JOB_CANCEL, "остановка")

    def _control(self, command: str, label: str) -> bool:
        """Команда управления печатью в `POST /control`."""
        if not self._require_identity(label):
            return False

        payload = {
            "serialNumber": self.serial_number,
            "checkCode": self.check_code,
            "jobCtl_cmd": command,
        }

        return self._command(CONTROL_PATH, payload, label)

    def _command(self, path: str, payload: dict[str, Any], label: str) -> bool:
        """
        `POST` с JSON-телом: True — прошивка подтвердила (`code: 0`).

        Сетевую ошибку, отказ HTTP и `code` не ноль разбираем по отдельности:
        «принтер не отвечает», «checkCode не принят» и «принтер занят» лечатся
        по-разному, и мастеру нужен разный текст.
        """
        try:
            response = requests.post(
                f"{self.base_url}{path}",
                headers=self._headers(),
                json=payload,
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as error:
            self.last_error = f"{label} не отправлена: {error}"
            logger.error(
                "FlashForge %s: %s не отправлена: %s",
                self.ip_address,
                label,
                error,
            )

            return False

        if response.status_code not in (200, 201):
            reason = _http_reason(response, _COMMAND_HINTS)
            self.last_error = f"{label} не выполнена: {reason}"
            logger.error(
                "FlashForge %s: %s не выполнена: %s",
                self.ip_address,
                label,
                reason,
            )

            return False

        refusal = _ack_reason(_read_json(response, quiet=True))

        if refusal is not None:
            self.last_error = f"{label} отвергнута: {refusal}"
            logger.error(
                "FlashForge %s: %s отвергнута: %s",
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
        Состояние из `/detail`: `machineStatus` и `printInfo`.

        `machineStatus` переводится по `_STATE_MAP`: `READY` и `COMPLETED` —
        простой, `PRINTING`, `HEATING` и `BUSY` — печать, `PAUSED` — пауза,
        `ERROR` и отменённая печать — ошибка. `HEATING` и `BUSY` считаются
        печатью намеренно: сразу после `/printGcode` прошивка греет и калибрует
        стол, а простой в этот момент main.py прочитал бы как «печать не
        начиналась» и закрыл задание провалом.

        Прогресс — готовые проценты (`printInfo.printProgress`), остаток —
        секунды (`remainingTimeEstimation`), `None` превращается в 0.

        Успешный опрос `last_error` очищает: иначе прежний сбой закрыл бы уже
        идущую печать.
        """
        detail = self._read_detail()

        if detail is None:
            return self._error_status()

        print_info = _as_mapping(detail.get("printInfo")) or detail
        progress = _as_percent(_pick(print_info, _PROGRESS_FIELDS))
        remaining = _as_seconds(_pick(print_info, _REMAINING_FIELDS))
        raw_state = _first_text(detail, _STATE_FIELDS)
        state = raw_state.lower() if raw_state is not None else ""
        agent_status = _STATE_MAP.get(state)

        if agent_status is None:
            self.last_error = f"неизвестное состояние печати: {raw_state!r}"
            logger.warning(
                "FlashForge %s: неизвестное состояние печати %r, отдаю error",
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
                "FlashForge %s: печать остановлена принтером (%s)",
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
        Паспорт для формы «Проверить принтер»: модель, прошивка, серийный номер.

        `/detail` безвреден и отвечает за доли секунды: мастеру нужен ответ
        до сохранения принтера. Отказ сети возвращает статику класса, как у
        остальных адаптеров, и причину в `last_error`.
        """
        detail = self._read_detail()

        if detail is not None:
            self.last_error = None

        result = super().probe()

        if self.model is not None:
            result["model"] = self.model

        if self.firmware is not None:
            result["firmware"] = self.firmware

        if self.serial_number:
            result["serial_number"] = self.serial_number

        return result

    @staticmethod
    def _error_status() -> dict[str, Any]:
        """Ответ get_status(), когда состояние получить не удалось."""
        return {"status": "error", "progress": 0, "remaining_time": 0}
