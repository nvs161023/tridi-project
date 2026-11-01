"""
Тест адаптера Anycubic без принтера (шаг 6).

Что проверяет:

  1. `connect()` поднимает MQTT на 9883, подписывается на отчёты и спрашивает
     паспорт `info/query`; из `info/report` берутся `modeId`, `deviceId` и адрес
     загрузки `urls.fileUploadurl`;
  2. без паспорта подключения нет: брокер, не ответивший на `info/query`, даёт
     `False` и причину в `last_error` — «на порту отвечает не Anycubic»;
  3. `upload_file()` шлёт `POST` на адрес из паспорта multipart-формой с полем
     `gcode` (не `file`) и заголовком `X-File-Length`;
  4. `.3mf` отклоняется до сети, а отказы прошивки `19007` (имя файла) и `10105`
     (принтер занят) объясняются в `last_error`;
  5. `start_print()` отправляет `print/start` с `taskid: -1`, `filename`, `md5`,
     `filetype: 1`, `filesize` и `project_type: 1`; сумма совпадает с MD5 файла;
  6. отказ `10105` на старте и молчание принтера дают `False`, а не «команда
     отправлена»;
  7. пауза, возврат и остановка уходят командами `pause`, `resume`, `stop` с
     номером задачи из отчёта;
  8. `get_status()` читает `state`, `progress`, `printLeftTime` из частичных
     отчётов, у простоя остаток ноль, незнакомое состояние — `error`;
  9. сканер находит Anycubic по открытому 9883 и не путает его с закрытым
     портом; фабрика собирает `AnycubicAdapter` с секретами.

Запуск:
    python scripts/test-anycubic.py

Принтер не нужен: брокер MQTT и HTTP-служба загрузки имитируются на loopback
(`socketserver` и `http.server`). TLS в тесте выключен (`MQTT_TLS = False`):
подделать рукопожатие нельзя, а проверить конверт сообщений и разбор отчётов
нужно. Порт 9883 должен быть свободен — занятый порт брокера означает, что в
сети уже есть принтер или другой MQTT, и это повод разобраться, а не пропустить
проверку.

Таймауты адаптера в тесте короче боевых: проверяется поведение, а не выдержка.
"""
from __future__ import annotations

import hashlib
import json
import socket
import socketserver
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, NamedTuple, cast
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
AGENT_DIR = ROOT / "agent"

# Агент — не пакет в PYTHONPATH: импортируем так же, как при запуске main.py.
sys.path.insert(0, str(AGENT_DIR))

import scanner  # noqa: E402 — путь к агенту выше
from adapters import anycubic  # noqa: E402
from adapters.anycubic import AnycubicAdapter  # noqa: E402
from adapters.base import CAPABILITY_CANCEL, CAPABILITY_PAUSE  # noqa: E402
from adapters.factory import get_adapter  # noqa: E402
from adapters.formats import sanitize_remote_name  # noqa: E402
from adapters.registry import DISCOVERY_PORT, PROTOCOLS  # noqa: E402

# `.invalid` зарезервирован под тесты (RFC 2606): DNS не отдаст адрес, и
# сетевые методы упадут сразу, а не через полминуты таймаута.
CHECK_IP = "anycubic-test.invalid"

PASSWORD = "kobra-lan-secret"
MODE_ID = "9001"
DEVICE_ID = "AC0F2B7D4E61"
REQUEST_TOPIC = f"{anycubic.TOPIC_ROOT}/{MODE_ID}/{DEVICE_ID}/request"
REPORT_TOPIC = f"{anycubic.TOPIC_ROOT}/{MODE_ID}/{DEVICE_ID}/report"

# Подписка до знакомства: по ней приходят отчёты, из которых видно номера.
WILDCARD_TOPIC = f"{anycubic.TOPIC_ROOT}/+/+/report"

# Путь загрузки в паспорте: у настоящего принтера он свой, тесту важно, что
# адаптер берёт адрес из `info/report`, а не из порта 18910.
UPLOAD_PATH = "/anycubic/files/upload"

GCODE_BODY = b"; test\nG28\nG1 X10 Y10 E1\n"
GCODE_NAME = "vase part.gcode"

# Таймауты теста. Боевые — 5 и 10 секунд: проверок с молчанием принтера
# несколько, и ждать каждую по-настоящему значило бы полминуты на прогон.
REPORT_TIMEOUT = 1.0
COMMAND_TIMEOUT = 1.0
STATUS_TIMEOUT = 0.4
CONNECT_TIMEOUT = 5

failures = 0


def check(name: str, ok: bool, details: str) -> None:
    """Печатает результат одной проверки и считает провалы."""
    global failures

    print(f"{'✓' if ok else '✗'} {name} — {details}")

    if not ok:
        failures += 1


def finish() -> int:
    """Итог прогона: код возврата для CI и человека."""
    if failures:
        print(f"\nПровалов: {failures}")

        return 1

    print("\nВсе проверки пройдены")

    return 0


def _encode_remaining(length: int) -> bytes:
    """Остаток длины пакета MQTT: до четырёх байт по семь бит."""
    out = bytearray()

    while True:
        byte = length % 128
        length //= 128

        if length:
            byte |= 0x80

        out.append(byte)

        if not length:
            return bytes(out)


def publish_packet(topic: str, payload: bytes) -> bytes:
    """PUBLISH QoS 0: так брокер отправляет отчёт подписчику."""
    encoded = topic.encode()
    body = len(encoded).to_bytes(2, "big") + encoded + payload

    return b"\x30" + _encode_remaining(len(body)) + body


def _read_exact(sock: socket.socket, size: int) -> bytes | None:
    """Ровно `size` байт; None — соединение закрылось."""
    data = b""

    while len(data) < size:
        chunk = sock.recv(size - len(data))

        if not chunk:
            return None

        data += chunk

    return data


def _read_remaining(sock: socket.socket) -> int | None:
    """Остаток длины пакета из потока; None — соединение оборвалось."""
    value = 0
    multiplier = 1

    for _ in range(4):
        raw = _read_exact(sock, 1)

        if raw is None:
            return None

        byte = raw[0]
        value += (byte & 0x7F) * multiplier

        if not byte & 0x80:
            return value

        multiplier *= 128

    return None


def topic_matches(topic_filter: str, topic: str) -> bool:
    """Совпадает ли топик с фильтром подписки; `+` — один уровень."""
    pattern = topic_filter.split("/")
    parts = topic.split("/")

    if len(pattern) != len(parts):
        return False

    return all(expected in ("+", actual) for expected, actual in zip(pattern, parts))


def _parse_filters(data: bytes) -> list[str]:
    """Фильтры из тела SUBSCRIBE или UNSUBSCRIBE."""
    filters: list[str] = []
    offset = 0

    while offset + 2 <= len(data):
        length = int.from_bytes(data[offset : offset + 2], "big")
        offset += 2
        filters.append(data[offset : offset + length].decode("utf-8", "replace"))
        # +1 — запрошенный QoS у SUBSCRIBE, у UNSUBSCRIBE его нет: лишний байт
        # просто заканчивает разбор.
        offset += length + 1

    return filters


class FakePrinter:
    """
    Поведение Kobra S1 в LAN-режиме: паспорт, отчёты и подтверждения команд.

    Переключатели (`info_silent`, `start_reply`) дают проверить отказ и молчание,
    не поднимая второй брокер: не отвечающий принтер — это тот же принтер с
    другим поведением, и второй экземпляр брокера ничего нового не покажет.

    `state` — то, что принтер рассказывает о печати. Отчёты частичные: `push()`
    шлёт только изменившиеся поля, как настоящая прошивка.
    """

    def __init__(self, upload_url: str) -> None:
        self.upload_url = upload_url
        # Паспорт не приходит: на 9883 отвечает чужой брокер.
        self.info_silent = False
        # Ответ на `print/start`: "ok", "busy" (код 10105) или "silent".
        self.start_reply = "ok"
        self.task_id = "task-42"
        self.state: dict[str, Any] = {
            "state": "idle",
            "progress": 0,
            "printLeftTime": 0,
        }

    def info(self) -> dict[str, Any]:
        """Паспорт `info/report`: модель, прошивка и адрес загрузки."""
        return {
            "deviceId": DEVICE_ID,
            "modeId": MODE_ID,
            "model": "Kobra S1",
            "firmware": "2.6.1",
            "urls": {"fileUploadurl": self.upload_url},
        }

    def push(self, **changes: Any) -> dict[str, Any]:
        """
        Спонтанный отчёт: принтер присылает только изменившиеся поля.

        Адаптер обязан дополнить кэш, а не заменить: после сообщения с одним
        `progress` пропали бы `state` и остаток.
        """
        self.state.update(changes)

        return {"type": "print", "action": "report", "data": dict(changes)}

    def replies(
        self, topic: str, message: Any
    ) -> list[tuple[str, dict[str, Any]]]:
        """Ответы на запрос агента: паспорт и подтверждения команд."""
        if topic != REQUEST_TOPIC or not isinstance(message, dict):
            return []

        kind = message.get("type")
        action = message.get("action")
        msgid = message.get("msgid")
        data = message.get("data") or {}
        report = topic.replace("/request", "/report")

        if kind == "info" and action == "query":
            if self.info_silent:
                return []

            return [
                (
                    report,
                    {
                        "type": "info",
                        "action": "report",
                        "code": 0,
                        "msgid": msgid,
                        "data": self.info(),
                    },
                )
            ]

        if kind != "print":
            return []

        return self._print_reply(action, data, msgid, report)

    def _print_reply(
        self,
        action: Any,
        data: Any,
        msgid: Any,
        report: str,
    ) -> list[tuple[str, dict[str, Any]]]:
        """Подтверждение команды печати или отказ прошивки."""
        payload = data if isinstance(data, dict) else {}

        if action == "start":
            if self.start_reply == "silent":
                return []

            if self.start_reply == "busy":
                return [
                    (
                        report,
                        {
                            "type": "print",
                            "action": "report",
                            "code": anycubic.ERROR_BUSY,
                            "msgid": msgid,
                            "msg": "device is busy",
                            "data": {"state": "printing"},
                        },
                    )
                ]

            # Сразу после старта принтер греет стол: `heating`, а не `printing`.
            self.state = {
                "state": "heating",
                "progress": 0,
                "printLeftTime": 1800,
                "taskid": self.task_id,
                "filename": payload.get("filename"),
            }
        elif action == "pause":
            self.state = {**self.state, "state": "paused"}
        elif action == "resume":
            self.state = {**self.state, "state": "printing"}
        elif action == "stop":
            self.state = {
                **self.state,
                "state": "idle",
                "progress": 0,
                "printLeftTime": 0,
            }
        else:
            return []

        return [
            (
                report,
                {
                    "type": "print",
                    "action": "report",
                    "code": 0,
                    "msgid": msgid,
                    "data": dict(self.state),
                },
            )
        ]


class FakeBroker(socketserver.ThreadingTCPServer):
    """
    Брокер MQTT на loopback: CONNECT, SUBSCRIBE, PUBLISH, UNSUBSCRIBE, PINGREQ.

    Полный брокер тесту не нужен: адаптер пользуется пятью пакетами, и
    проверяется не MQTT, а то, что адаптер кладёт в `request` и как читает
    `report`. Соединение одно: второй клиент означал бы, что тест проверяет не
    то.

    Порт — `anycubic.MQTT_PORT` (`9883`): адаптер всегда идёт на него, и порт в
    тесте подменять нельзя, не подменяя поведение. Занятый порт — не повод
    пропустить проверку: в сети уже есть брокер, и это надо увидеть.
    """

    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, printer: FakePrinter) -> None:
        super().__init__(("127.0.0.1", anycubic.MQTT_PORT), _BrokerHandler)
        self.printer = printer
        self.filters: list[str] = []
        self.messages: list[dict[str, Any]] = []
        self.client: socket.socket | None = None
        self.lock = threading.Lock()

    def reset(self) -> None:
        """Чистое состояние между проверками: подписки и сообщения."""
        with self.lock:
            self.filters.clear()
            self.messages.clear()

    def clear_messages(self) -> None:
        """
        Забыть сообщения агента, оставив подписки.

        Сброс посреди проверки снял бы подписку живого адаптера, и ответы
        принтера перестали бы доходить: команды считаются по одной, а
        подписка одна.
        """
        with self.lock:
            self.messages.clear()

    def commands(self, action: str) -> list[dict[str, Any]]:
        """Сообщения агента с указанным действием."""
        with self.lock:
            return [
                item["message"]
                for item in self.messages
                if isinstance(item["message"], dict)
                and item["message"].get("action") == action
            ]

    def send(self, topic: str, message: dict[str, Any]) -> bool:
        """
        Отчёт принтера по своей инициативе.

        Принтер присылает состояние, даже когда его не спрашивают: опрос
        `get_status()` не должен требовать нового запроса к принтеру.
        """
        sock = self.client

        if sock is None:
            return False

        with self.lock:
            if not any(topic_matches(f, topic) for f in self.filters):
                return False

            try:
                sock.sendall(publish_packet(topic, json.dumps(message).encode()))
            except OSError:
                return False

        return True


class _BrokerHandler(socketserver.BaseRequestHandler):
    """
    Одно MQTT-соединение: разбор пакетов и ответы брокера.

    `socketserver` зовёт `handle()` в отдельном потоке, поэтому ожидание отчёта
    в `connect()` не блокирует приём остальных пакетов этого соединения.
    """

    @property
    def broker(self) -> FakeBroker:
        """Брокер, которому принадлежит соединение."""
        return cast(FakeBroker, self.server)

    def handle(self) -> None:
        sock = self.request
        sock.settimeout(30)

        while True:
            try:
                first = _read_exact(sock, 1)
            except OSError:
                return

            if first is None:
                return

            packet_type = first[0] >> 4
            remaining = _read_remaining(sock)

            if remaining is None:
                return

            body = _read_exact(sock, remaining) if remaining else b""

            if body is None:
                return

            if packet_type == 1:  # CONNECT
                self._connect(sock)
            elif packet_type == 3:  # PUBLISH
                self._publish(sock, body, first[0])
            elif packet_type == 8:  # SUBSCRIBE
                self._subscribe(sock, body)
            elif packet_type == 10:  # UNSUBSCRIBE
                self._unsubscribe(sock, body)
            elif packet_type == 12:  # PINGREQ
                sock.sendall(b"\xd0\x00")
            elif packet_type == 14:  # DISCONNECT
                return

    def _connect(self, sock: socket.socket) -> None:
        """CONNACK: чистая сессия, подключение принято."""
        self.broker.client = sock
        sock.sendall(b"\x20\x02\x00\x00")

    def _subscribe(self, sock: socket.socket, body: bytes) -> None:
        """
        SUBACK, запись фильтров и отчёт знакомства.

        На шаблонную подписку настоящий принтер отвечает отчётом сам: прошивка
        вещает состояние периодически, и первый отчёт даёт адаптеру номера
        адресации из топика. Точная подписка отчёта не вызывает — она уже после
        знакомства.
        """
        packet_id = body[0:2]
        filters = _parse_filters(body[2:])

        with self.broker.lock:
            for topic_filter in filters:
                if topic_filter not in self.broker.filters:
                    self.broker.filters.append(topic_filter)

        sock.sendall(bytes([0x90, 2 + len(filters)]) + packet_id + bytes(len(filters)))

        if WILDCARD_TOPIC in filters:
            self._deliver(sock, REPORT_TOPIC, self.broker.printer.push())

    def _unsubscribe(self, sock: socket.socket, body: bytes) -> None:
        """UNSUBACK: адаптер снимает шаблон, когда номера стали известны."""
        packet_id = body[0:2]

        with self.broker.lock:
            for topic_filter in _parse_filters(body[2:]):
                if topic_filter in self.broker.filters:
                    self.broker.filters.remove(topic_filter)

        sock.sendall(b"\xb0\x02" + packet_id)

    def _publish(self, sock: socket.socket, body: bytes, first: int) -> None:
        """PUBLISH от агента: запись сообщения и ответы принтера."""
        qos = (first >> 1) & 0x03
        topic_length = int.from_bytes(body[0:2], "big")
        topic = body[2 : 2 + topic_length].decode("utf-8", "replace")
        offset = 2 + topic_length
        packet_id = b""

        if qos:
            packet_id = body[offset : offset + 2]
            offset += 2

        payload = body[offset:]

        try:
            message: Any = json.loads(payload.decode("utf-8"))
        except ValueError:
            message = None

        with self.broker.lock:
            self.broker.messages.append(
                {"topic": topic, "message": message, "raw": payload}
            )

        if qos == 1:
            sock.sendall(b"\x40\x02" + packet_id)

        for reply_topic, reply in self.broker.printer.replies(topic, message):
            self._deliver(sock, reply_topic, reply)

    def _deliver(
        self, sock: socket.socket, topic: str, message: dict[str, Any]
    ) -> None:
        """Отчёт подписчику, если топик подходит под фильтр подписки."""
        with self.broker.lock:
            subscribed = any(topic_matches(f, topic) for f in self.broker.filters)

        if not subscribed:
            return

        sock.sendall(publish_packet(topic, json.dumps(message).encode()))


class UploadRecord(NamedTuple):
    """Запрос загрузки: путь, размер из заголовка и тело с формой."""

    path: str
    length: str | None
    body: bytes


def form_names(body: bytes) -> list[str]:
    """
    Имена полей multipart-формы: по ним видно, назван файл `gcode` или нет.

    Разделитель — `; name="`, а не `name="`: у файловой части заголовок несёт
    ещё и `filename="..."`, и простое `name="` приняло бы имя файла за имя поля.
    """
    parts = body.split(b'; name="')[1:]

    return [part.decode("utf-8", "replace").split('"')[0] for part in parts]


def form_field(body: bytes, name: str) -> bytes | None:
    """
    Содержимое части multipart-формы по имени поля.

    Разбор нарочно минимальный: тесту нужны имя поля и его данные, а полный
    разборщик спрятал бы опечатку в имени — прошивка ищет файл именно в `gcode`.
    """
    marker = f'name="{name}"'.encode()
    start = body.find(marker)

    if start == -1:
        return None

    header_end = body.find(b"\r\n\r\n", start)

    if header_end == -1:
        return None

    end = body.find(b"\r\n--", header_end)

    return body[header_end + 4 : end if end != -1 else len(body)]


def form_filename(body: bytes, name: str) -> str | None:
    """Имя файла из заголовков части multipart-формы."""
    start = body.find(f'name="{name}"'.encode())

    if start == -1:
        return None

    header_end = body.find(b"\r\n\r\n", start)
    headers = body[start:header_end].decode("utf-8", "replace")
    index = headers.find('filename="')

    if index == -1:
        return None

    return headers[index + len('filename="') :].split('"')[0]


class UploadServer(ThreadingHTTPServer):
    """
    HTTP-служба загрузки принтера на свободном порту loopback.

    Порт выбирает ОС: адрес загрузки принтер называет сам в паспорте, и тесту
    важно, что адаптер берёт его оттуда, а не собирает из порта 18910.
    """

    daemon_threads = True

    def __init__(self) -> None:
        super().__init__(("127.0.0.1", 0), UploadHandler)
        self.uploads: list[UploadRecord] = []
        # Ответ службы: код прошивки и текст. Проверка отказа переключает его на
        # 19007, не поднимая второй сервер.
        self.code = anycubic.CODE_SUCCESS
        self.message = ""
        self.lock = threading.Lock()

    @property
    def url(self) -> str:
        """Адрес, который принтер называет в `urls.fileUploadurl`."""
        return f"http://127.0.0.1:{self.server_port}{UPLOAD_PATH}"

    def received(self) -> list[UploadRecord]:
        """Запросы загрузки в порядке прихода."""
        with self.lock:
            return list(self.uploads)

    def reset(self) -> None:
        """Чистая служба между проверками: запросы, код и текст ответа."""
        with self.lock:
            self.uploads.clear()

        self.code = anycubic.CODE_SUCCESS
        self.message = ""


class UploadHandler(BaseHTTPRequestHandler):
    """Приём файла: `POST` и ответ кодом прошивки."""

    @property
    def upload_server(self) -> UploadServer:
        """Служба, которой принадлежит запрос."""
        return cast(UploadServer, self.server)

    def do_POST(self) -> None:  # noqa: N802 — имя задаёт http.server
        """Читает тело и отвечает как принтер: `{"code": ...}`."""
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length)
        server = self.upload_server

        with server.lock:
            server.uploads.append(
                UploadRecord(
                    path=urlsplit(self.path).path,
                    length=self.headers.get(anycubic.FILE_LENGTH_HEADER),
                    body=body,
                )
            )
            code = server.code
            message = server.message

        reply = json.dumps({"code": code, "msg": message or "ok", "data": {}})
        self._respond(reply.encode())

    def _respond(self, payload: bytes) -> None:
        """Ответ 200 с JSON: другой код адаптер считает отказом."""
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        """Тишина в выводе: http.server по умолчанию пишет в stderr."""


class FakeAnycubic:
    """
    Принтер в сборе: брокер MQTT на 9883 и HTTP-служба загрузки.

    Два сервера в одном контексте, потому что адаптеру нужны оба: без HTTP
    файл не загрузить, а без брокера не узнать адрес загрузки и не отправить
    команду. `RuntimeError` при входе — порт 9883 занят: в сети уже есть
    принтер или чужой брокер, и проверять на нём адаптер нельзя.
    """

    broker: FakeBroker

    def __init__(self) -> None:
        self.upload = UploadServer()
        self.printer = FakePrinter(self.upload.url)
        self._threads: list[threading.Thread] = []

    def __enter__(self) -> "FakeAnycubic":
        """Поднимает брокер и HTTP-службу в фоновых потоках."""
        try:
            self.broker = FakeBroker(self.printer)
        except OSError as error:
            self.upload.server_close()
            raise RuntimeError(
                f"порт {anycubic.MQTT_PORT} не открылся: {error}"
            ) from error

        for target in (self.broker.serve_forever, self.upload.serve_forever):
            thread = threading.Thread(target=target, daemon=True)
            thread.start()
            self._threads.append(thread)

        return self

    def __exit__(self, *args: Any) -> None:
        """Останавливает оба сервера: порт 9883 освобождается."""
        for server in (self.broker, self.upload):
            server.shutdown()
            server.server_close()

        for thread in self._threads:
            thread.join(timeout=5)

    def reset(self) -> None:
        """
        Чистый принтер между проверками.

        Сообщения и подписки чистит `FakeBroker`, запросы загрузки и код ответа
        HTTP — `UploadServer`. Прошивка остаётся подключённой: переподключение
        проверяется отдельно, а не в каждой проверке.
        """
        self.broker.reset()
        self.upload.reset()
        self.printer.state = {"state": "idle", "progress": 0, "printLeftTime": 0}
        self.printer.info_silent = False
        self.printer.start_reply = "ok"

    def command_topics(self) -> list[str]:
        """Топики, в которые агент публиковал команды."""
        with self.broker.lock:
            return [item["topic"] for item in self.broker.messages]


def make_adapter(
    fake: FakeAnycubic,
    secrets: dict[str, str] | None = None,
) -> AnycubicAdapter:
    """
    Адаптер, настроенный на фейковый принтер.

    По умолчанию номера адресации не вписаны: так проверяется знакомство по
    отчёту. Адрес — `127.0.0.1`: брокер живёт только на loopback.
    """
    settings = {"password": PASSWORD}

    if secrets:
        settings.update(secrets)

    return AnycubicAdapter("127.0.0.1", api_key="", secrets=settings)


def check_connect(fake: FakeAnycubic) -> None:
    """Подключение, знакомство по отчёту и паспорт принтера."""
    fake.reset()
    adapter = make_adapter(fake)

    try:
        connected = adapter.connect()

        check("connect() подключается к брокеру", connected, adapter.last_error or "")
        check(
            "номера из отчёта: modeId и deviceId",
            (adapter.mode_id, adapter.device_id) == (MODE_ID, DEVICE_ID),
            f"modeId {adapter.mode_id!r}, deviceId {adapter.device_id!r}",
        )
        check(
            "подписка уточнена до точного топика",
            fake.broker.filters == [REPORT_TOPIC],
            f"фильтры {fake.broker.filters!r}",
        )
        check(
            "адрес загрузки взят из паспорта",
            adapter._upload_url == fake.upload.url,
            f"паспорт {fake.upload.url!r}, адаптер {adapter._upload_url!r}",
        )

        queries = fake.broker.commands("query")
        query = queries[0] if queries else None

        check(
            "паспорт запрошен конвертом info/query с msgid",
            query is not None
            and query.get("type") == "info"
            and bool(query.get("msgid")),
            f"{query!r}",
        )
        check(
            "команды ушли в топик request",
            fake.command_topics() == [REQUEST_TOPIC],
            f"{fake.command_topics()!r}",
        )
    finally:
        adapter.close()


def check_no_passport(fake: FakeAnycubic) -> None:
    """Брокер без паспорта: подключения нет, причина названа."""
    fake.reset()
    fake.printer.info_silent = True
    adapter = make_adapter(fake)

    try:
        connected = adapter.connect()
        error = adapter.last_error or ""

        check(
            "молчащий принтер: connect() возвращает False",
            not connected,
            f"вернулось {connected}",
        )
        check(
            "причина — «отвечает не Anycubic»",
            "не Anycubic" in error,
            error or "причины нет",
        )
        check(
            "соединение закрыто после отказа",
            adapter._client is None,
            f"клиент {adapter._client!r}",
        )
    finally:
        adapter.close()


def check_upload(
    fake: FakeAnycubic,
    gcode_path: Path,
    project_path: Path,
) -> None:
    """Загрузка файла: адрес из паспорта, поле `gcode`, размер заголовком."""
    fake.reset()
    adapter = make_adapter(fake)
    expected_name = sanitize_remote_name("anycubic", GCODE_NAME)

    try:
        if not adapter.connect():
            check("загрузка: подключение", False, adapter.last_error or "")

            return

        uploaded = adapter.upload_file(str(gcode_path), GCODE_NAME)
        records = fake.upload.received()
        record = records[0] if records else None
        body = record.body if record else b""
        content = form_field(body, "gcode")

        check("upload_file() грузит файл", uploaded, adapter.last_error or "")
        check(
            "один POST на адрес из паспорта",
            record is not None and record.path == UPLOAD_PATH,
            f"путь {(record.path if record else None)!r}",
        )
        check(
            "поле формы названо gcode",
            form_names(body) == [anycubic.FILE_FIELD],
            f"поля {form_names(body)!r}",
        )
        check(
            "заголовок X-File-Length — размер файла",
            record is not None and record.length == str(len(GCODE_BODY)),
            f"X-File-Length {(record.length if record else None)!r}",
        )
        check(
            "тело формы — содержимое файла",
            content == GCODE_BODY,
            f"{len(content or b'')} байт из {len(GCODE_BODY)}",
        )
        check(
            "имя файла очищено до ASCII",
            form_filename(body, "gcode") == expected_name,
            f"на принтер ушло {(form_filename(body, 'gcode'))!r}, "
            f"ожидалось {expected_name!r}",
        )

        fake.upload.reset()
        project = adapter.upload_file(str(project_path), "project.3mf")

        check(
            ".3mf отклоняется до сети",
            not project and not fake.upload.received(),
            adapter.last_error or "отказа не было",
        )

        fake.upload.reset()
        fake.upload.code = anycubic.ERROR_FILE_NAME
        fake.upload.message = "file name error"
        refused = adapter.upload_file(str(gcode_path), GCODE_NAME)
        error = adapter.last_error or ""

        check(
            "код 19007 объяснён словами",
            not refused and "19007" in error and "расширением .gcode" in error,
            error or "отказа не было",
        )
    finally:
        adapter.close()
        fake.upload.reset()


def check_commands(fake: FakeAnycubic, gcode_path: Path) -> None:
    """Старт печати, пауза, возврат и остановка: конверт и номера задач."""
    fake.reset()
    adapter = make_adapter(fake)
    expected_name = sanitize_remote_name("anycubic", GCODE_NAME)

    try:
        ready = adapter.connect() and adapter.upload_file(str(gcode_path), GCODE_NAME)

        if not ready:
            check("команды: подключение и загрузка", False, adapter.last_error or "")

            return

        fake.broker.clear_messages()
        started = adapter.start_print(GCODE_NAME)
        starts = fake.broker.commands("start")
        payload = starts[0].get("data") if starts else None
        expected_md5 = hashlib.md5(GCODE_BODY).hexdigest()

        check("start_print() запускает печать", started, adapter.last_error or "")
        check(
            "print/start несёт md5 и размер файла",
            isinstance(payload, dict)
            and payload.get("md5") == expected_md5
            and payload.get("filesize") == len(GCODE_BODY),
            f"{payload!r}",
        )
        check(
            "print/start: новая задача и признаки G-code",
            isinstance(payload, dict)
            and payload.get("taskid") == anycubic.NEW_TASK_ID
            and payload.get("filetype") == anycubic.FILE_TYPE_GCODE
            and payload.get("project_type") == anycubic.PROJECT_TYPE_NORMAL,
            f"{payload!r}",
        )
        check(
            "print/start просит файл, который лежит на принтере",
            isinstance(payload, dict) and payload.get("filename") == expected_name,
            f"в команде {(payload or {}).get('filename')!r}, "
            f"загружен {expected_name!r} (мастер просил {GCODE_NAME!r})",
        )

        fake.broker.clear_messages()
        paused = adapter.pause_print()
        pauses = fake.broker.commands("pause")
        pause_task = pauses[0].get("data", {}).get("taskid") if pauses else None
        status = adapter.get_status()

        check(
            "пауза: отчёт подтверждает paused",
            paused and status.get("status") == "paused",
            f"{status!r}, причина {adapter.last_error!r}",
        )
        check(
            "пауза: номер задачи из отчёта",
            pause_task == fake.printer.task_id,
            f"taskid {pause_task!r}, отчёт {fake.printer.task_id!r}",
        )

        fake.broker.clear_messages()
        resumed = adapter.resume_print()
        status = adapter.get_status()

        check(
            "возврат с паузы: отчёт подтверждает printing",
            resumed and status.get("status") == "printing",
            f"{status!r}, причина {adapter.last_error!r}",
        )

        fake.broker.clear_messages()
        stopped = adapter.stop_print()
        status = adapter.get_status()

        check(
            "остановка: отчёт подтверждает простой",
            stopped and status.get("status") == "idle",
            f"{status!r}, причина {adapter.last_error!r}",
        )

        fake.broker.clear_messages()
        fake.printer.start_reply = "busy"
        busy = adapter.start_print(GCODE_NAME)
        error = adapter.last_error or ""

        check(
            "код 10105 на старте: отказ с причиной",
            not busy and "10105" in error and "занят" in error,
            error or "отказа не было",
        )

        fake.broker.clear_messages()
        fake.printer.start_reply = "silent"
        silent = adapter.start_print(GCODE_NAME)

        check(
            "молчание на print/start — отказ, а не «отправлено»",
            not silent and "не ответил" in (adapter.last_error or ""),
            adapter.last_error or "молчание принято за успех",
        )
    finally:
        adapter.close()
        fake.printer.start_reply = "ok"


def check_status(fake: FakeAnycubic) -> None:
    """Отчёты о печати: проценты, остаток и слияние частичных отчётов."""
    fake.reset()
    adapter = make_adapter(fake)

    try:
        if not adapter.connect():
            check("состояние: подключение", False, adapter.last_error or "")

            return

        fake.broker.send(
            REPORT_TOPIC,
            fake.printer.push(state="printing", printLeftTime=1800),
        )
        first = adapter.get_status()

        check(
            "статус printing с остатком",
            first == {"status": "printing", "progress": 0, "remaining_time": 1800},
            f"{first!r}",
        )

        fake.broker.send(REPORT_TOPIC, fake.printer.push(progress=42))
        second = adapter.get_status()

        check(
            "частичный отчёт дополняет кэш",
            second == {"status": "printing", "progress": 42, "remaining_time": 1800},
            f"{second!r}",
        )

        fake.broker.send(
            REPORT_TOPIC,
            fake.printer.push(state="completed", progress=100),
        )
        third = adapter.get_status()

        check(
            "у простоя остаток ноль, а не время прошлой печати",
            third == {"status": "idle", "progress": 100, "remaining_time": 0},
            f"{third!r}",
        )

        fake.broker.send(REPORT_TOPIC, fake.printer.push(state="calibrating"))
        unknown = adapter.get_status()

        check(
            "незнакомое состояние — error с причиной",
            unknown.get("status") == "error"
            and "неизвестное состояние" in (adapter.last_error or ""),
            f"{unknown!r}, причина {adapter.last_error!r}",
        )

        fake.broker.send(REPORT_TOPIC, fake.printer.push(state="stopped"))
        stopped = adapter.get_status()

        check(
            "принтер остановил печать — error с причиной",
            stopped.get("status") == "error"
            and "остановил печать" in (adapter.last_error or ""),
            f"{stopped!r}, причина {adapter.last_error!r}",
        )
    finally:
        adapter.close()


def check_scanner(fake: FakeAnycubic) -> None:
    """Сканер: Anycubic узнаётся по открытому порту 9883."""
    check(
        "порт сканера совпадает с портом брокера",
        scanner.ANYCUBIC_MQTT_PORT == anycubic.MQTT_PORT,
        f"сканер {scanner.ANYCUBIC_MQTT_PORT}, адаптер {anycubic.MQTT_PORT}",
    )

    found = scanner.is_anycubic("127.0.0.1")

    check("открытый 9883 — находка", found, f"брокер слушает {fake.broker.server_address}")

    hosted = scanner.inspect_host("127.0.0.1")

    check(
        "inspect_host называет протокол anycubic",
        hosted == {"ip_address": "127.0.0.1", "protocol_type": "anycubic"},
        f"{hosted!r}",
    )


def check_scanner_closed() -> None:
    """Брокер остановлен: порт закрыт, находки нет."""
    found = scanner.is_anycubic("127.0.0.1")

    check("закрытый 9883 — не находка", not found, f"вернулось {found}")


def check_offline() -> None:
    """Выключенный принтер: `False` и причина, а не исключение."""
    adapter = AnycubicAdapter(CHECK_IP, PASSWORD)

    try:
        connected = adapter.connect()
        error = adapter.last_error or ""

        check(
            "выключенный принтер: connect() возвращает False",
            not connected,
            f"вернулось {connected}",
        )
        check("причина в last_error", "не отвечает" in error, error or "причины нет")

        status = adapter.get_status()

        check(
            "состояние без принтера — error",
            status == {"status": "error", "progress": 0, "remaining_time": 0},
            f"{status!r}",
        )
    finally:
        adapter.close()


def check_factory() -> None:
    """Фабрика собирает адаптер, справочник знает протокол и его секреты."""
    adapter = get_adapter(
        "anycubic",
        CHECK_IP,
        PASSWORD,
        secrets={"deviceId": DEVICE_ID, "modeId": MODE_ID},
    )
    spec = PROTOCOLS["anycubic"]

    check(
        "фабрика собирает AnycubicAdapter",
        isinstance(adapter, AnycubicAdapter),
        f"{type(adapter).__name__}",
    )
    check(
        "драйвер объявляет паузу и отмену",
        {CAPABILITY_PAUSE, CAPABILITY_CANCEL} <= set(adapter.capabilities),
        f"{sorted(adapter.capabilities)!r}",
    )
    check(
        "справочник: обнаружение по порту",
        spec.discovery == DISCOVERY_PORT,
        f"{spec.discovery!r}",
    )
    check(
        "справочник: порты 9883 и 18910",
        spec.ports == (anycubic.MQTT_PORT, anycubic.HTTP_PORT),
        f"{spec.ports!r}",
    )
    check(
        "справочник: секреты modeId и deviceId",
        {"modeId", "deviceId"} <= set(spec.secrets),
        f"{spec.secrets!r}",
    )


def main() -> int:
    """Прогон: фейковый принтер на loopback и проверки адаптера."""
    print("Проверка адаптера Anycubic (MQTT 9883 + HTTP-загрузка):")

    # Боевые значения возвращаются в конце: тест короче и без TLS.
    keep = (
        anycubic.MQTT_TLS,
        anycubic.REPORT_TIMEOUT,
        anycubic.COMMAND_TIMEOUT,
        anycubic.STATUS_TIMEOUT,
    )
    anycubic.MQTT_TLS = False
    anycubic.REPORT_TIMEOUT = REPORT_TIMEOUT
    anycubic.COMMAND_TIMEOUT = COMMAND_TIMEOUT
    anycubic.STATUS_TIMEOUT = STATUS_TIMEOUT

    try:
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            gcode_path = folder / GCODE_NAME
            gcode_path.write_bytes(GCODE_BODY)
            project_path = folder / "vase.3mf"
            project_path.write_bytes(b"PK\x03\x04not a real 3mf: format is first")

            try:
                with FakeAnycubic() as fake:
                    check_connect(fake)
                    check_no_passport(fake)
                    check_upload(fake, gcode_path, project_path)
                    check_commands(fake, gcode_path)
                    check_status(fake)
                    check_scanner(fake)
            except RuntimeError as error:
                print(f"✗ фейковый принтер не поднялся — {error}")

                return 1

            check_scanner_closed()
            check_offline()

        check_factory()
    finally:
        (
            anycubic.MQTT_TLS,
            anycubic.REPORT_TIMEOUT,
            anycubic.COMMAND_TIMEOUT,
            anycubic.STATUS_TIMEOUT,
        ) = keep

    return finish()


if __name__ == "__main__":
    sys.exit(main())
