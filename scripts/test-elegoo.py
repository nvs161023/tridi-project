"""
Тест адаптера Elegoo (SDCP) без принтера (шаг 5).

Что проверяет:

  1. `connect()` открывает `ws://<ip>:3030/websocket`, шлёт `Cmd: 0` конвертом
     SDCP с топиком `sdcp/request/0` и запоминает `MainboardID` из ответа;
  2. номер платы из секретов не мешает: ответ принтера главнее, а номер из
     паспорта уходит в `probe()` как серийный номер;
  3. `upload_file()` грузит файл `POST /uploadFile/upload` multipart-формой с
     полями `S-File-MD5`, `Check`, `Offset`, `Uuid`, `TotalSize` и файлом `File`,
     а MD5 совпадает с суммой файла;
  4. `.3mf` отклоняется до сети, `{"success": false}` в ответе объясняется в
     `last_error`;
  5. `start_print()` отправляет `Cmd: 128` с `Filename`, `StartLayer: 0` и
     `path_prefix: "/local"`;
  6. пауза, остановка и возврат уходят как `Cmd: 129`, `130`, `131`, а `Ack`
     не ноль — отказ с причиной; молчание принтера тоже отказ;
  7. `get_status()` читает `Status`, `Progress` и разность тиков, понимает
     `Attributes` строкой, дополняет кэш частичными отчётами и отдаёт `error`
     на незнакомое состояние;
  8. сканер находит Elegoo по UDP-бродкасту `M99999` и берёт `MainboardID`;
  9. не отвечающий принтер даёт `False` и `{"status": "error", ...}`, фабрика
     собирает `ElegooAdapter`.

Запуск:
    python scripts/test-elegoo.py

Принтер не нужен: WebSocket имитирует `websockets.sync.server` на порту 3030
(прошивка слушает именно его), HTTP — `http.server` на свободном порту loopback,
UDP-обнаружение — сокеты на портах 3000/8899/19000/48899. Адрес
`elegoo-test.invalid` (RFC 2606) не разрешается в DNS — так проверяется поведение
адаптера при выключенном принтере.

Порт 3030 и порты обнаружения должны быть свободны: занятый порт — не повод
пропустить проверку, а причина разобраться, что ещё живёт в сети.
"""
from __future__ import annotations

import hashlib
import json
import socket
import sys
import tempfile
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable, NamedTuple
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
AGENT_DIR = ROOT / "agent"

# Агент — не пакет в PYTHONPATH: импортируем так же, как при запуске main.py.
sys.path.insert(0, str(AGENT_DIR))

import adapters.elegoo as elegoo_module  # noqa: E402 — путь к агенту выше
import scanner  # noqa: E402
from adapters.elegoo import ElegooAdapter  # noqa: E402
from adapters.factory import get_adapter  # noqa: E402
from websockets.exceptions import ConnectionClosed  # noqa: E402
from websockets.sync.server import serve  # noqa: E402

# `.invalid` зарезервирован под тесты (RFC 2606): DNS не отдаст адрес, и
# сетевые методы упадут сразу, а не через полминуты таймаута.
CHECK_IP = "elegoo-test.invalid"
BOARD = "01S00B1234567890"
GCODE_BODY = b"; test\nG28\nG1 X10 Y10 E1\n"
WS_PORT = 3030

# Сколько байт читать из UDP: конверт SDCP — пара сотен байт.
UDP_LIMIT = 2048

# Порты обнаружения, которые тест держит открытыми: три у FlashForge и один у
# Elegoo. Закрытый порт на loopback отвечает ICMP `port unreachable`.
UDP_TEST_PORTS = (*scanner.FLASHFORGE_UDP_PORTS, scanner.ELEGOO_UDP_PORT)

# Ответ Centauri Carbon на `M99999`: конверт SDCP с номером платы внутри `Data`.
ELEGOO_UDP_REPLY = json.dumps(
    {
        "Id": "0",
        "Data": {
            "Cmd": 0,
            "Data": {"Ack": 0},
            "RequestID": "0",
            "MainboardID": BOARD,
            "Attributes": {
                "MainboardID": BOARD,
                "MachineName": "Centauri Carbon",
            },
        },
        "Topic": "sdcp/response/0",
    }
).encode()

failures = 0


def check(name: str, ok: bool, details: str) -> None:
    """Печатает результат одной проверки и считает провалы."""
    global failures

    print(f"{'✓' if ok else '✗'} {name} — {details}")

    if not ok:
        failures += 1


def expect_false(name: str, method: Callable[[], Any]) -> None:
    """
    Метод адаптера на недоступном принтере: только False, без исключений.

    `NotImplementedError` показываем отдельно: значит в адаптере осталась
    заглушка, и мастер увидит её в журнале вместо печати.
    """
    try:
        result = method()
    except NotImplementedError as error:
        check(name, False, f"заглушка вместо протокола: {error}")
        return
    except Exception as error:  # noqa: BLE001 — любое падение и есть провал
        check(name, False, f"исключение {type(error).__name__}: {error}")
        return

    check(name, result is False, f"вернул {result!r}")


def finish() -> int:
    """Итог теста и код выхода: 0 — всё прошло, 1 — были провалы."""
    if failures > 0:
        print(f"Провалов: {failures}.")

        return 1

    print("Все проверки пройдены.")

    return 0


class Recorded(NamedTuple):
    """HTTP-запрос, который пришёл на фейковый принтер."""

    method: str
    path: str
    headers: dict[str, str]
    body: bytes


def form_field(body: bytes, name: str) -> bytes | None:
    """
    Значение части multipart-формы с именем `name`.

    Полный разбор формы здесь не нужен: проверяются пять текстовых полей и
    файл, а тянуть `email` ради этого незачем. Заголовки части отделены пустой
    строкой, конец значения — следующим разделителем.
    """
    marker = f'name="{name}"'.encode()
    start = body.find(marker)

    if start < 0:
        return None

    start = body.find(b"\r\n\r\n", start)

    if start < 0:
        return None

    start += 4
    end = body.find(b"\r\n--", start)

    if end < 0:
        return None

    return body[start:end]


class FakeElegoo:
    """
    Фейковый Centauri Carbon: WebSocket SDCP на 3030 и HTTP-загрузка на loopback.

    `attributes` — `Attributes` ответа на `Cmd: 0`, `ack` — `Data.Data.Ack`
    ответов на команды. `push` изображает отчёт прошивки, который приходит до
    ответа: после `Cmd: 0` принтер начинает присылать `Attributes` сам, и
    первый пакет может обогнать конверт с `RequestID`.

    `muted` и `silent_commands` — принтер молчит совсем или на выбранные
    команды: так проверяется, что тишина считается отказом, а не успехом.
    """

    def __init__(self) -> None:
        self.requests: list[Recorded] = []
        self.messages: list[dict[str, Any]] = []
        self.attributes: Any = {
            "Status": "idle",
            "Progress": 0,
            "TotalTicks": 0,
            "CurrentTicks": 0,
        }
        self.ack = 0
        self.push: dict[str, Any] | None = None
        self.muted = False
        self.silent_commands: set[int] = set()
        self.mainboard_id = BOARD
        self.upload_status = 200
        self.upload_reply: dict[str, Any] = {"success": True}
        self.http_port = 0
        self._http: ThreadingHTTPServer | None = None
        self._http_thread: threading.Thread | None = None
        self._ws: Any = None
        self._ws_thread: threading.Thread | None = None

    @property
    def address(self) -> str:
        """Адрес вида `127.0.0.1:51234` — то, что мастер вводит в настройках."""
        return f"127.0.0.1:{self.http_port}"

    def commands(self) -> list[int]:
        """Номера команд, дошедших до принтера, в порядке отправки."""
        return [
            data["Cmd"]
            for data in (self._payloads())
            if isinstance(data.get("Cmd"), int)
        ]

    def command_data(self, command: int) -> dict[str, Any]:
        """`Data.Data` последней команды с этим номером: тело `Cmd: 128` и др."""
        found: dict[str, Any] = {}

        for payload in self._payloads():
            if payload.get("Cmd") == command:
                data = payload.get("Data")
                found = data if isinstance(data, dict) else {}

        return found

    def envelope(self, command: int) -> dict[str, Any]:
        """Конверт последней команды: топик и `MainboardID` адресата."""
        for message in reversed(self.messages):
            data = message.get("Data")

            if isinstance(data, dict) and data.get("Cmd") == command:
                return message

        return {}

    def count_http(self, method: str, path: str) -> int:
        """Сколько таких HTTP-запросов пришло: проверка «до сети не дошли»."""
        return sum(
            1
            for request in self.requests
            if request.method == method and request.path == path
        )

    def last_http(self, method: str, path: str) -> Recorded | None:
        """Последний HTTP-запрос по адресу."""
        for request in reversed(self.requests):
            if request.method == method and request.path == path:
                return request

        return None

    def _payloads(self) -> list[dict[str, Any]]:
        """`Data` каждого конверта: сама команда без обёртки топика."""
        payloads: list[dict[str, Any]] = []

        for message in self.messages:
            data = message.get("Data")

            if isinstance(data, dict):
                payloads.append(data)

        return payloads

    def reply(self, command: int, request_id: str) -> dict[str, Any] | None:
        """
        Конверт ответа на команду.

        `Cmd: 0` отвечает `Attributes`, остальные — только `Ack`: так отвечает
        прошивка, и тест проверяет, что адаптер читает именно эти поля.
        """
        result: dict[str, Any] = {"Ack": 0 if command == 0 else self.ack}

        return self.envelope_for(
            command,
            result,
            attributes=self.attributes if command == 0 else None,
            request_id=request_id,
        )

    def envelope_for(
        self,
        command: int,
        payload: dict[str, Any],
        attributes: Any = None,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        """Собирает конверт ответа: тот же `RequestID`, что у запроса."""
        data: dict[str, Any] = {
            "Cmd": command,
            "Data": payload,
            "RequestID": request_id or str(uuid.uuid4()),
            "MainboardID": self.mainboard_id,
            "TimeStamp": 0,
            "From": "printer",
        }

        if attributes is not None:
            data["Attributes"] = attributes

        return {
            "Id": str(uuid.uuid4()),
            "Data": data,
            "Topic": f"sdcp/response/{self.mainboard_id or '0'}",
        }

    def __enter__(self) -> "FakeElegoo":
        fake = self

        class Handler(BaseHTTPRequestHandler):
            # HTTP/1.1 с `Content-Length` в каждом ответе: `requests` не ждёт
            # закрытия соединения и не висит на пустом ответе.
            protocol_version = "HTTP/1.1"

            def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
                """Без журнала запросов: тест печатает только свои проверки."""

            def _handle(self) -> None:
                length = int(self.headers.get("Content-Length") or 0)
                body = self.rfile.read(length) if length else b""

                fake.requests.append(
                    Recorded(
                        method=self.command,
                        path=urlsplit(self.path).path,
                        headers={
                            key.lower(): value for key, value in self.headers.items()
                        },
                        body=body,
                    )
                )

                if urlsplit(self.path).path != "/uploadFile/upload":
                    fake.respond(self, 404, b'{"success": false}')
                    return

                fake.respond(
                    self,
                    fake.upload_status,
                    json.dumps(fake.upload_reply).encode(),
                )

            def do_POST(self) -> None:
                self._handle()

        self._http = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._http.daemon_threads = True
        self.http_port = int(self._http.server_address[1])
        self._http_thread = threading.Thread(
            target=self._http.serve_forever, daemon=True
        )
        self._http_thread.start()

        try:
            self._ws = serve(self._handle_socket, "127.0.0.1", WS_PORT)
        except OSError as error:
            self.shutdown_http()

            raise RuntimeError(
                f"порт {WS_PORT} занят: закройте принтер или другой тест ({error})"
            ) from error

        self._ws_thread = threading.Thread(target=self._ws.serve_forever, daemon=True)
        self._ws_thread.start()

        return self

    def __exit__(self, *args: Any) -> None:
        # Сокеты адаптера закрывает тест (adapter.close()): без этого
        # shutdown() ждал бы обработчики соединений до таймаута.
        if self._ws is not None:
            self._ws.shutdown()
            self._ws = None

        if self._ws_thread is not None:
            self._ws_thread.join(timeout=5)
            self._ws_thread = None

        self.shutdown_http()

    def shutdown_http(self) -> None:
        """Останавливает HTTP-сервер: он живёт в своём потоке."""
        if self._http is not None:
            self._http.shutdown()
            self._http.server_close()
            self._http = None

        if self._http_thread is not None:
            self._http_thread.join(timeout=5)
            self._http_thread = None

    def _handle_socket(self, connection: Any) -> None:
        """
        Обработчик WebSocket: записать конверт и ответить по команде.

        `push` уходит до ответа — так проверяется, что отчёт прошивки не
        принимается за ответ, а дополняет кэш `Attributes`.
        """
        while True:
            try:
                raw = connection.recv()
            except ConnectionClosed:
                return

            message = json.loads(raw)

            if not isinstance(message, dict):
                continue

            self.messages.append(message)
            data = message.get("Data")

            if not isinstance(data, dict):
                continue

            command = data.get("Cmd")

            if self.muted or command in self.silent_commands:
                continue

            if self.push is not None:
                connection.send(json.dumps(self.envelope_for(0, {}, self.push)))

            request_id = data.get("RequestID")
            reply = self.reply(
                command if isinstance(command, int) else -1,
                request_id if isinstance(request_id, str) else "",
            )

            if reply is not None:
                connection.send(json.dumps(reply))

    @staticmethod
    def respond(handler: BaseHTTPRequestHandler, code: int, body: bytes) -> None:
        """Ответ с телом: у загрузки тело всегда JSON, даже на отказе."""
        handler.send_response(code)
        handler.send_header("Content-Type", "application/json")
        handler.send_header("Content-Length", str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)


class FakeUdpResponder:
    """
    Фейковый UDP-принтер: слушает порты обнаружения и отвечает на нужном.

    Elegoo отвечает на `M99999` только на UDP 3000, поэтому тест держит
    открытыми и порты FlashForge: `scan_udp_broadcast()` шлёт запросы обоих
    протоколов, а закрытый порт на loopback отвечает ICMP `port unreachable`, и
    `recvfrom` может поднять исключение раньше, чем придёт настоящий ответ.
    """

    def __init__(
        self,
        ports: tuple[int, ...] = UDP_TEST_PORTS,
        reply_port: int = scanner.ELEGOO_UDP_PORT,
        reply: bytes = ELEGOO_UDP_REPLY,
    ) -> None:
        self.ports = ports
        self.reply_port = reply_port
        self.reply = reply
        self.received: list[tuple[int, bytes]] = []
        self._sockets: list[tuple[int, socket.socket]] = []
        self._threads: list[threading.Thread] = []
        self._running = False

    def __enter__(self) -> "FakeUdpResponder":
        try:
            for port in self.ports:
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

                try:
                    sock.bind(("127.0.0.1", port))
                except OSError as error:
                    sock.close()
                    raise RuntimeError(f"UDP {port} занят: {error}") from error

                sock.settimeout(0.2)
                self._sockets.append((port, sock))
        except RuntimeError:
            self.close()

            raise

        self._running = True
        self._threads = [
            threading.Thread(target=self._serve, args=(port, sock), daemon=True)
            for port, sock in self._sockets
        ]

        for thread in self._threads:
            thread.start()

        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def close(self) -> None:
        """Останавливает потоки и закрывает сокеты."""
        self._running = False

        for thread in self._threads:
            thread.join(timeout=2)

        self._threads = []

        for _, sock in self._sockets:
            sock.close()

        self._sockets = []

    def _serve(self, port: int, sock: socket.socket) -> None:
        """Один порт: запомнить запрос и ответить, если порт отвечающий."""
        while self._running:
            try:
                data, sender = sock.recvfrom(UDP_LIMIT)
            except socket.timeout:
                continue
            except OSError:
                return

            self.received.append((port, data))

            if port != self.reply_port:
                continue

            try:
                sock.sendto(self.reply, sender)
            except OSError:
                return


def make_adapter(fake: FakeElegoo, with_board: bool = True) -> ElegooAdapter:
    """Адаптер на фейковый принтер: номер платы в секретах, как в Мастерской."""
    secrets = {"mainboardId": BOARD} if with_board else {}

    return ElegooAdapter(fake.address, "", secrets)


def check_connect(fake: FakeElegoo) -> None:
    """Подключение: `Cmd: 0`, топик SDCP и `MainboardID` из ответа."""
    adapter = make_adapter(fake, with_board=False)
    connected = adapter.connect()
    envelope = fake.envelope(0)
    data = envelope.get("Data")
    data = data if isinstance(data, dict) else {}

    check(
        "подключение: Cmd 0 с пустым MainboardID и топиком sdcp/request/0",
        connected is True
        and data.get("MainboardID") == ""
        and envelope.get("Topic") == "sdcp/request/0",
        f"{connected!r}, topic={envelope.get('Topic')!r}, "
        f"mainboard={data.get('MainboardID')!r}",
    )
    check(
        "подключение: номер платы взят из ответа принтера",
        adapter.mainboard_id == BOARD,
        f"{adapter.mainboard_id!r}",
    )

    adapter.get_status()
    topic = fake.envelope(0).get("Topic")

    check(
        "подключение: следующие команды адресованы номеру платы",
        topic == f"sdcp/request/{BOARD}",
        f"{topic!r}",
    )
    adapter.close()

    stale = ElegooAdapter(fake.address, "", {"mainboardId": "OLD-BOARD"})
    stale.connect()

    check(
        "подключение: ответ принтера главнее номера из секретов",
        stale.mainboard_id == BOARD,
        f"{stale.mainboard_id!r}",
    )
    stale.close()

    fake.muted = True
    silent = make_adapter(fake)
    refused = silent.connect()
    reason = silent.last_error or ""
    fake.muted = False

    check(
        "подключение: молчащий WebSocket — отказ, а не «подключено»",
        refused is False and "Cmd: 0" in reason,
        f"{refused!r}, last_error={reason!r}",
    )
    silent.close()

    fake.mainboard_id = ""
    unnamed = make_adapter(fake, with_board=False)
    refused = unnamed.connect()
    reason = unnamed.last_error or ""
    fake.mainboard_id = BOARD

    check(
        "подключение: принтер без MainboardID — команды адресовать нечем",
        refused is False and "MainboardID" in reason,
        f"{refused!r}, last_error={reason!r}",
    )
    unnamed.close()


def check_upload(fake: FakeElegoo, gcode_path: Path, project_path: Path) -> None:
    """Загрузка: поля формы, MD5, формат и отказы."""
    adapter = make_adapter(fake)
    uploaded = adapter.upload_file(str(gcode_path), "my job.gcode")
    request = fake.last_http("POST", "/uploadFile/upload")
    body = request.body if request is not None else b""
    expected_md5 = hashlib.md5(GCODE_BODY).hexdigest()

    check(
        "загрузка: поля S-File-MD5, Check, Offset, Uuid, TotalSize и File",
        uploaded is True
        and form_field(body, "S-File-MD5") == expected_md5.encode()
        and form_field(body, "Check") == b"1"
        and form_field(body, "Offset") == b"0"
        and form_field(body, "TotalSize") == str(len(GCODE_BODY)).encode()
        and form_field(body, "Uuid") is not None
        and b'name="File"; filename="my-job.gcode"' in body
        and form_field(body, "File") == GCODE_BODY,
        f"{uploaded!r}, md5={form_field(body, 'S-File-MD5')!r}",
    )

    before = fake.count_http("POST", "/uploadFile/upload")
    rejected = adapter.upload_file(str(project_path), "project.3mf")
    reason = adapter.last_error or ""

    check(
        "загрузка: .3mf отклонён до сети",
        rejected is False
        and "3mf" in reason
        and fake.count_http("POST", "/uploadFile/upload") == before,
        f"{rejected!r}, last_error={reason!r}",
    )

    fake.upload_reply = {"success": False, "message": "md5 mismatch"}
    refused = adapter.upload_file(str(gcode_path), "job.gcode")
    reason = adapter.last_error or ""

    check(
        "загрузка: success false в ответе — отказ с причиной",
        refused is False and "md5 mismatch" in reason,
        f"{refused!r}, last_error={reason!r}",
    )
    fake.upload_reply = {"success": True}

    fake.upload_status = 500
    broken = adapter.upload_file(str(gcode_path), "job.gcode")
    reason = adapter.last_error or ""
    fake.upload_status = 200

    check(
        "загрузка: HTTP 500 — подсказка и причина",
        broken is False and "500" in reason,
        f"{broken!r}, last_error={reason!r}",
    )
    adapter.close()


def check_commands(fake: FakeElegoo) -> None:
    """Старт печати и управление: `Cmd: 128`, 129, 130, 131."""
    adapter = make_adapter(fake)
    started = adapter.start_print("job.gcode")
    payload = fake.command_data(elegoo_module.CMD_START_PRINT)

    check(
        "старт: Cmd 128 с Filename, StartLayer и path_prefix",
        started is True
        and payload
        == {"Filename": "job.gcode", "StartLayer": 0, "path_prefix": "/local"},
        f"{started!r}, {payload!r}",
    )

    paused = adapter.pause_print()
    stopped = adapter.stop_print()
    resumed = adapter.resume_print()
    commands = fake.commands()

    check(
        "управление: пауза 129, остановка 130, возврат 131",
        paused is True
        and stopped is True
        and resumed is True
        and commands[-3:]
        == [
            elegoo_module.CMD_PAUSE,
            elegoo_module.CMD_STOP,
            elegoo_module.CMD_RESUME,
        ],
        f"{commands!r}",
    )

    fake.ack = 7
    refused = adapter.pause_print()
    reason = adapter.last_error or ""
    fake.ack = 0

    check(
        "управление: Ack 7 — отказ с причиной",
        refused is False and "Ack 7" in reason,
        f"{refused!r}, last_error={reason!r}",
    )

    fake.silent_commands = {elegoo_module.CMD_PAUSE}
    silent = adapter.pause_print()
    reason = adapter.last_error or ""
    fake.silent_commands = set()

    check(
        "управление: молчание принтера — отказ, а не успех",
        silent is False and "не ответил" in reason,
        f"{silent!r}, last_error={reason!r}",
    )
    adapter.close()


def check_status(fake: FakeElegoo) -> None:
    """Состояние: `Status`, `Progress`, тики и частичные отчёты."""
    adapter = make_adapter(fake)
    fake.attributes = {
        "Status": "printing",
        "Progress": 42.6,
        "TotalTicks": 1000,
        "CurrentTicks": 400,
    }
    status = adapter.get_status()

    check(
        "статус: printing — 43 % и 600 с по тикам",
        status == {"status": "printing", "progress": 43, "remaining_time": 600},
        f"{status!r}",
    )

    fake.attributes = {"Status": "paused", "Progress": 55, "RemainingTime": 240}
    paused_status = adapter.get_status()

    check(
        "статус: paused — пауза и остаток из RemainingTime",
        paused_status
        == {"status": "paused", "progress": 55, "remaining_time": 240},
        f"{paused_status!r}",
    )

    fake.attributes = {"Status": "preheating", "Progress": 0}
    preparing = adapter.get_status()

    check(
        "статус: preheating — печать, а не простой",
        preparing["status"] == "printing",
        f"{preparing!r}",
    )

    fake.attributes = {"Status": "complete", "Progress": 100}
    finished = adapter.get_status()

    check(
        "статус: complete → idle без остатка",
        finished == {"status": "idle", "progress": 100, "remaining_time": 0},
        f"{finished!r}",
    )

    fake.attributes = {"Status": "error", "Progress": 30}
    broken = adapter.get_status()
    reason = adapter.last_error or ""

    check(
        "статус: error — ошибка с причиной",
        broken["status"] == "error" and "error" in reason,
        f"{broken!r}, last_error={reason!r}",
    )

    fake.attributes = {"Status": "orbiting", "Progress": 10}
    unknown = adapter.get_status()
    reason = adapter.last_error or ""

    check(
        "статус: незнакомое состояние → error",
        unknown["status"] == "error" and "неизвестное" in reason,
        f"{unknown!r}, last_error={reason!r}",
    )

    fake.attributes = {"Status": "printing", "Progress": 12}
    adapter.get_status()

    check(
        "статус: успешный опрос снимает прежнюю ошибку",
        adapter.last_error is None,
        f"last_error={adapter.last_error!r}",
    )

    fake.attributes = {"Status": "printing"}
    fake.push = {"Progress": 77}
    merged = adapter.get_status()
    fake.push = None

    check(
        "статус: частичный отчёт дополняет кэш, а не заменяет",
        merged["progress"] == 77 and merged["status"] == "printing",
        f"{merged!r}",
    )
    adapter.close()

    # Строковые `Attributes` проверяются на свежем адаптере: у прежнего в кэше
    # остались тики прошлой печати, и остаток считался бы по ним.
    raw = make_adapter(fake)
    fake.attributes = json.dumps({"Status": "paused", "Progress": 20})
    parsed = raw.get_status()

    check(
        "статус: Attributes строкой с JSON тоже читаются",
        parsed == {"status": "paused", "progress": 20, "remaining_time": 0},
        f"{parsed!r}",
    )
    fake.attributes = {"Status": "idle", "Progress": 0}
    raw.close()


def check_probe(fake: FakeElegoo) -> None:
    """Проба: номер платы, модель и прошивка из `Attributes`."""
    fake.attributes = {
        "Status": "idle",
        "MachineName": "Centauri Carbon",
        "FirmwareVersion": "1.2.3",
    }
    adapter = make_adapter(fake, with_board=False)
    probed = adapter.probe()

    check(
        "проба: номер платы, модель и прошивка",
        probed.get("serial_number") == BOARD
        and probed.get("model") == "Centauri Carbon"
        and probed.get("firmware") == "1.2.3"
        and probed.get("formats") == [".gcode"],
        f"{probed!r}",
    )
    adapter.close()
    fake.attributes = {"Status": "idle", "Progress": 0}


def check_factory() -> None:
    """Фабрика: протокол `elegoo` собирает адаптер с номером платы."""
    built = get_adapter("elegoo", "127.0.0.1", "", "", {"mainboardId": BOARD})

    check(
        "фабрика: ElegooAdapter с паузой, возвратом и отменой",
        isinstance(built, ElegooAdapter)
        and built.protocol_key == "elegoo"
        and built.mainboard_id == BOARD
        and built.accepted_formats == (".gcode",)
        and built.supports("pause")
        and built.supports("resume")
        and built.supports("cancel"),
        f"{type(built).__name__}, {built.protocol_key!r}, "
        f"{sorted(built.capabilities)}",
    )


def check_offline(gcode_path: Path) -> None:
    """Выключенный принтер: False и статус `error`, без исключений."""
    offline = ElegooAdapter(CHECK_IP, "")

    expect_false("нет принтера: connect", offline.connect)
    expect_false(
        "нет принтера: upload_file",
        lambda: offline.upload_file(str(gcode_path), "job.gcode"),
    )
    expect_false(
        "нет принтера: start_print", lambda: offline.start_print("job.gcode")
    )
    expect_false("нет принтера: пауза", offline.pause_print)

    status = offline.get_status()

    check(
        "нет принтера: get_status → error",
        status == {"status": "error", "progress": 0, "remaining_time": 0},
        f"{status!r}",
    )
    offline.close()


def check_scanner() -> None:
    """Сканер: разбор конверта SDCP и находка по бродкасту."""
    parsed = scanner.elegoo_mainboard_id(ELEGOO_UDP_REPLY)

    check(
        "сканер: MainboardID из конверта SDCP",
        parsed == BOARD,
        f"{parsed!r}",
    )
    check(
        "сканер: ответ без MainboardID находкой не считается",
        scanner.elegoo_mainboard_id(b'{"Data": {"Cmd": 0}}') is None,
        "в ответе нет номера платы",
    )
    check(
        "сканер: пустой JSON на порту Elegoo — не принтер",
        scanner.udp_printer(b"{}", ("10.0.0.9", scanner.ELEGOO_UDP_PORT)) is None,
        "ответ без MainboardID",
    )

    with FakeUdpResponder() as udp:
        found = scanner.scan_udp_broadcast(timeout=0.6, targets=("127.0.0.1",))

    expected = [
        {
            "ip_address": "127.0.0.1",
            "protocol_type": "elegoo",
            "serial_number": BOARD,
        }
    ]

    check(
        "сканер: бродкаст нашёл Elegoo с номером платы",
        found == expected,
        f"{found!r}",
    )
    check(
        "сканер: M99999 ушёл на порт Elegoo",
        (scanner.ELEGOO_UDP_PORT, scanner.ELEGOO_UDP_PROBE) in udp.received,
        f"{sorted(port for port, _ in udp.received)!r}",
    )

    # Реальная картина: у принтера открыт один порт из четырёх, а на закрытые
    # система отвечает ICMP «порт закрыт». Находка не должна из-за этого
    # теряться — иначе в цеху сканер находил бы только принтеры с открытыми
    # всеми портами рассылки.
    with FakeUdpResponder(ports=(scanner.ELEGOO_UDP_PORT,)) as single:
        found = scanner.scan_udp_broadcast(timeout=0.6, targets=("127.0.0.1",))

    check(
        "сканер: закрытые порты рассылки не отменяют находку",
        found == expected,
        f"{found!r}, порты {sorted(port for port, _ in single.received)!r}",
    )


def main() -> int:
    print("Проверка адаптера Elegoo (SDCP):")
    original_timeout = elegoo_module.WS_TIMEOUT
    # Локальный фейк отвечает мгновенно, а проверки тишины иначе ждали бы по
    # пять секунд каждая: таймаут адаптера здесь не то, что проверяется.
    elegoo_module.WS_TIMEOUT = 1.0

    try:
        with tempfile.TemporaryDirectory() as directory:
            gcode_path = Path(directory) / "my job.gcode"
            gcode_path.write_bytes(GCODE_BODY)
            project_path = Path(directory) / "project.3mf"
            project_path.write_bytes(b"not a zip, but the format is checked first")

            try:
                with FakeElegoo() as fake:
                    check_connect(fake)
                    check_upload(fake, gcode_path, project_path)
                    check_commands(fake)
                    check_status(fake)
                    check_probe(fake)
            except RuntimeError as error:
                print(f"✗ фейковый принтер не поднялся — {error}")

                return 1

            check_factory()
            check_offline(gcode_path)

            try:
                check_scanner()
            except RuntimeError as error:
                print(f"✗ фейковый UDP-принтер не поднялся — {error}")

                return 1
    finally:
        elegoo_module.WS_TIMEOUT = original_timeout

    return finish()


if __name__ == "__main__":
    sys.exit(main())
