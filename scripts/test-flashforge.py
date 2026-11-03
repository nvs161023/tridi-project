"""
Тест адаптера FlashForge без принтера (шаг 5).

Что проверяет:

  1. `connect()` идёт в `POST /detail` с `serialNumber` и `checkCode` в теле,
     читает модель и прошивку, а без Serial Number или Check Code в сеть не
     выходит и объясняет, что заполнить в карточке принтера; ранняя сборка,
     которая паспорт в теле не понимает (404), находится запасным `GET` с
     заголовками, а отказы в `code` (`Access code is different`, `Parameters is
     error`) переводятся подсказками, а не остаются английским текстом;
  2. чужой JSON на 8898 принтером не считается: в ответе нет данных принтера —
     `False` и причина в `last_error`, а сырой ответ уходит в журнал строкой
     `[FlashForge] Сырой ответ:`; прошивка 5.x (5.1.8) отвечает плоским
     паспортом (`status`, `printProgress`, `pid`) без `machineStatus`,
     `printInfo` и `serialNumber` — такой ответ тоже паспорт, модель берётся из
     `pid`, а `name` с серийным номером моделью не считается;
  3. `upload_file()` отправляет `POST /uploadGcode` multipart-формой с полем
     `gcodeFile` и заголовками `fileSize`, `printNow: false`,
     `levelingBeforePrint: true`; имя с пробелом приходит уже через `-`;
  4. `.3mf` без готового G-code отклоняется до сети, `{"code": 9}` в ответе
     объясняется в `last_error`, а без серийного номера загрузка не уходит;
  5. `start_print()` отправляет `POST /printGcode` с `serialNumber`,
     `checkCode`, `fileName` и `levelingBeforePrint`;
  6. пауза, возврат и остановка уходят в `/control` как `pause`, `continue` и
     `cancel`, а 409 объясняется подсказкой;
  7. `get_status()` переводит `machineStatus` в статусы агента, читает проценты
     и остаток, а незнакомое состояние отдаёт как `error`;
  8. сканер находит FlashForge по UDP-бродкасту `~M115` и берёт `SN` из ответа —
     текста, JSON или сырой строки с мусором (`SNM0MF9201019♣♣qZ}…`), — пишет
     номер в `serial_number` находки (а тот уходит в `/api/agent/discover`) и
     строкой `[UDP] FlashForge SN найден: …` в журнал; запрос уходит на все три
     порта FlashForge (8899, 19000, 48899);
  9. не отвечающий принтер даёт `False` и `{"status": "error", ...}`, фабрика
     собирает `FlashForgeAdapter` с секретами.

Запуск:
    python scripts/test-flashforge.py

Принтер не нужен: HTTP-API имитирует `http.server` на loopback, UDP-обнаружение —
сокеты на портах 8899/19000/48899. Адрес `flashforge-test.invalid` (RFC 2606) не
разрешается в DNS — так проверяется поведение адаптера при выключенном принтере.

Порты 8899/19000/48899/3000 должны быть свободны: занятый порт обнаружения — не
повод пропустить проверку, а причина разобраться, что ещё живёт в сети.
"""
from __future__ import annotations

import ipaddress
import json
import logging
import socket
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable, NamedTuple
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
AGENT_DIR = ROOT / "agent"

# Агент — не пакет в PYTHONPATH: импортируем так же, как при запуске main.py.
sys.path.insert(0, str(AGENT_DIR))

import scanner  # noqa: E402 — путь к агенту выше
from adapters.factory import get_adapter  # noqa: E402
from adapters.flashforge import FlashForgeAdapter  # noqa: E402

# `.invalid` зарезервирован под тесты (RFC 2606): DNS не отдаст адрес, и
# сетевые методы упадут сразу, а не через полминуты таймаута.
CHECK_IP = "flashforge-test.invalid"
SERIAL = "SNM0001234"
CHECK_CODE = "a1b2c3d4"
GCODE_BODY = b"; test\nG28\nG1 X10 Y10 E1\n"

# Ответ прошивки на `~M115`: тест проверяет, что номер достаётся из строки `SN:`.
FLASHFORGE_UDP_REPLY = (
    b"CMD M115 Received.\r\n"
    b"Machine Type: Flashforge Adventurer 5M Pro.\r\n"
    b"Machine Name: Adventurer 5M Pro.\r\n"
    b"Firmware: v2.4.5\r\n"
    b"SN: SNM0001234\r\n"
    b"X: 220 Y: 220 Z: 220\r\n"
    b"ok\r\n"
)

# Сырой ответ прошивки 5.x (Adventurer 5M Pro) из журнала агента: номер идёт
# первым, без подписи и двоеточия, а следом лежит мусор из неинициализированного
# буфера. Прежний шаблон (метка + `:`) такой ответ не находил, и принтер пропадал
# из находок, хотя номер был в пакете.
FLASHFORGE_RAW_UDP_REPLY = "SNM0MF9201019♣♣qZ}SNM0MF9201019Z".encode("utf-8")
RAW_SERIAL = "SNM0MF9201019"

# Паспорт принтера: `detail` из `/detail` в том виде, в каком его отдаёт
# прошивка Adventurer 5M Pro.
DETAIL = {
    "name": "Adventurer 5M Pro",
    "firmwareVersion": "2.4.5",
    "serialNumber": SERIAL,
    "machineStatus": "READY",
    "printInfo": {"printProgress": 0, "remainingTimeEstimation": 0},
}

# Сколько байт читать из UDP: ответ FlashForge — две сотни байт.
UDP_LIMIT = 2048

# Порты обнаружения, которые тест держит открытыми: три у FlashForge и один у
# Elegoo. Закрытый порт на loopback отвечает ICMP `port unreachable`.
UDP_TEST_PORTS = (*scanner.FLASHFORGE_UDP_PORTS, scanner.ELEGOO_UDP_PORT)

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

    def json(self) -> dict[str, Any]:
        """Тело как JSON-объект; пустое тело — пустой словарь."""
        if not self.body:
            return {}

        payload = json.loads(self.body)

        return payload if isinstance(payload, dict) else {}


class FakeFlashForge:
    """
    Фейковый FlashForge: HTTP-API на loopback и запись каждого запроса.

    `detail` — ответ `/detail` (тест меняет его по ходу), `routes` — ответы на
    остальные адреса. Запросы пишутся целиком: без этого не проверить ни
    заголовки `serialNumber`/`checkCode`/`fileSize`, ни поле `gcodeFile` в
    multipart, ни тело `/printGcode`.

    `legacy_detail` переключает принтер на раннюю прошивку: паспорт в теле
    `POST /detail` она не понимает (404) и отдаёт его только по `GET` с
    заголовками — так проверяется запасной путь адаптера.
    """

    def __init__(self) -> None:
        self.requests: list[Recorded] = []
        self.routes: dict[tuple[str, str], tuple[int, bytes]] = {}
        self.detail: dict[str, Any] | None = dict(DETAIL)
        self.detail_code = 0
        self.detail_message = "Success"
        self.legacy_detail = False
        self.port = 0
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    @property
    def address(self) -> str:
        """Адрес вида `127.0.0.1:51234` — то, что мастер вводит в настройках."""
        return f"127.0.0.1:{self.port}"

    def route(
        self, method: str, path: str, status: int, payload: dict[str, Any]
    ) -> None:
        """Ответ на конкретный запрос: маршруты главнее поведения по умолчанию."""
        self.routes[(method, path)] = (status, json.dumps(payload).encode())

    def route_raw(self, method: str, path: str, status: int, body: bytes) -> None:
        """Ответ без JSON: так на 8898 отвечает чужой сервис, а не прошивка."""
        self.routes[(method, path)] = (status, body)

    def count(self, method: str, path: str | None = None) -> int:
        """Сколько таких запросов пришло: проверка «до сети не дошли»."""
        return sum(
            1
            for request in self.requests
            if request.method == method and (path is None or request.path == path)
        )

    def last(self, method: str, path: str) -> Recorded | None:
        """Последний запрос по адресу: у загрузки и команд их бывает несколько."""
        for request in reversed(self.requests):
            if request.method == method and request.path == path:
                return request

        return None

    def detail_requests(self) -> int:
        """Сколько запросов пришло за паспортом: тело и заголовки вместе."""
        return sum(1 for request in self.requests if request.path == "/detail")

    def detail_body(self) -> bytes:
        """
        Тело ответа `/detail`.

        `detail = None` изображает прошивку, у которой паспорт не собрался:
        HTTP 200 с кодом отказа и сообщением — так отвечает и настоящая
        прошивка, когда файловая система ещё не готова.
        """
        if self.detail is None:
            payload: dict[str, Any] = {
                "code": self.detail_code or 1,
                "message": self.detail_message,
            }
        else:
            payload = {
                "code": self.detail_code,
                "message": self.detail_message,
                "detail": self.detail,
            }

        return json.dumps(payload).encode()

    def __enter__(self) -> "FakeFlashForge":
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
                path = urlsplit(self.path).path

                fake.requests.append(
                    Recorded(
                        method=self.command,
                        path=path,
                        headers={
                            key.lower(): value for key, value in self.headers.items()
                        },
                        body=body,
                    )
                )

                route = fake.routes.get((self.command, path))

                if route is not None:
                    fake.respond(self, route[0], route[1])
                    return

                if path == "/detail" and self.command in ("GET", "POST"):
                    # Паспорт 3.x отдаёт на POST с парой в теле, ранние сборки —
                    # на GET с заголовками; на чужой вид запроса 404.
                    if (self.command == "POST") is fake.legacy_detail:
                        fake.respond(self, 404, b'{"message": "Not found"}')
                        return

                    fake.respond(self, 200, fake.detail_body())
                    return

                fake.respond(self, 404, b'{"message": "Not found"}')

            def do_GET(self) -> None:
                self._handle()

            def do_POST(self) -> None:
                self._handle()

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._server.daemon_threads = True
        self.port = int(self._server.server_address[1])
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

        return self

    def __exit__(self, *args: Any) -> None:
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
            self._server = None

        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None

    @staticmethod
    def respond(handler: BaseHTTPRequestHandler, code: int, body: bytes) -> None:
        """Ответ без тела (204) и с телом: у 204 `Content-Length` не бывает."""
        handler.send_response(code)

        if code == 204:
            handler.end_headers()
            return

        handler.send_header("Content-Type", "application/json")
        handler.send_header("Content-Length", str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)


class FakeUdpResponder:
    """
    Фейковый UDP-принтер: слушает порты обнаружения и отвечает на нужном.

    FlashForge отвечает на `~M115` только на своём порту, поэтому тест держит
    открытыми все три порта FlashForge и порт Elegoo: закрытый порт на loopback
    отвечает ICMP `port unreachable`, и `recvfrom` может поднять исключение
    раньше, чем придёт настоящий ответ. Отвечает только `reply_port` — так
    проверяется и то, что запрос ушёл на все три порта, и разбор ответа.
    """

    def __init__(
        self,
        ports: tuple[int, ...] = UDP_TEST_PORTS,
        reply_port: int = 8899,
        reply: bytes = FLASHFORGE_UDP_REPLY,
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


def make_adapter(fake: FakeFlashForge) -> FlashForgeAdapter:
    """Адаптер на фейковый принтер: серийный номер и checkCode как в Мастерской."""
    return FlashForgeAdapter(
        fake.address,
        "",
        SERIAL,
        {"checkCode": CHECK_CODE},
    )


def check_connect(fake: FakeFlashForge) -> None:
    """Подключение: `/detail`, пара в теле, запасной GET и отказы."""
    adapter = make_adapter(fake)
    connected = adapter.connect()
    request = fake.last("POST", "/detail")
    payload = request.json() if request is not None else {}

    check(
        "подключение: POST /detail с serialNumber и checkCode в теле",
        connected is True
        and payload == {"serialNumber": SERIAL, "checkCode": CHECK_CODE},
        f"{connected!r}, {payload!r}",
    )
    check(
        "подключение: модель и прошивка из паспорта",
        adapter.model == "Adventurer 5M Pro" and adapter.firmware == "2.4.5",
        f"{adapter.model!r}, {adapter.firmware!r}",
    )

    # Ранние сборки тело не понимают: на POST отвечают 404, а тот же паспорт
    # отдают по GET с заголовками. Без запасного запроса такой принтер выглядел
    # бы «не FlashForge», хотя он на связи.
    fake.legacy_detail = True
    legacy = make_adapter(fake)
    legacy_connected = legacy.connect()
    legacy_request = fake.last("GET", "/detail")
    legacy_headers = legacy_request.headers if legacy_request is not None else {}
    fake.legacy_detail = False

    check(
        "подключение: ранняя прошивка — запасной GET с заголовками",
        legacy_connected is True
        and legacy_headers.get("serialnumber") == SERIAL
        and legacy_headers.get("checkcode") == CHECK_CODE
        and legacy.model == "Adventurer 5M Pro",
        f"{legacy_connected!r}, {legacy_headers!r}, {legacy.model!r}",
    )

    # Без Serial Number и Check Code прошивка отвечает отказом, поэтому адаптер
    # обязан не ходить в сеть: мастеру нужна причина, а не таймаут.
    before = fake.detail_requests()
    missing = FlashForgeAdapter(fake.address, "", "", {})
    refused_missing = missing.connect()
    reason = missing.last_error or ""

    check(
        "подключение: без Serial Number и Check Code запрос не уходит",
        refused_missing is False
        and "Не указан Serial Number или Check Code" in reason
        and fake.detail_requests() == before,
        f"{refused_missing!r}, last_error={reason!r}, "
        f"запросов {fake.detail_requests() - before}",
    )

    only_code = FlashForgeAdapter(fake.address, "", "", {"checkCode": CHECK_CODE})
    refused_no_serial = only_code.connect()
    reason = only_code.last_error or ""

    check(
        "подключение: без Serial Number, но с Check Code запрос не уходит",
        refused_no_serial is False
        and "Serial Number" in reason
        and fake.detail_requests() == before,
        f"{refused_no_serial!r}, last_error={reason!r}",
    )

    # Кириллица в поле карточки: мастер копирует номер с экрана принтера, и туда
    # попадает «с»/«М» вместо латинских букв. Заголовки кодируются в latin-1,
    # поэтому такой запрос падал UnicodeEncodeError, а задание терялось целиком.
    # Отправлять «исправленный» номер нельзя: прошивка сверит его с платой.
    cyrillic_serial = FlashForgeAdapter(
        fake.address, "", SERIAL.replace("M", "М"), {"checkCode": CHECK_CODE}
    )
    refused_cyrillic_serial = cyrillic_serial.connect()
    reason = cyrillic_serial.last_error or ""

    check(
        "подключение: кириллица в Serial Number — отказ до сети",
        refused_cyrillic_serial is False
        and "недопустимые символы" in reason
        and fake.detail_requests() == before,
        f"{refused_cyrillic_serial!r}, last_error={reason!r}, "
        f"запросов {fake.detail_requests() - before}",
    )

    cyrillic_code = FlashForgeAdapter(
        fake.address, "", SERIAL, {"checkCode": CHECK_CODE.replace("a", "а")}
    )
    refused_cyrillic_code = cyrillic_code.connect()
    reason = cyrillic_code.last_error or ""

    check(
        "подключение: кириллица в Check Code — отказ до сети",
        refused_cyrillic_code is False
        and "недопустимые символы" in reason
        and fake.detail_requests() == before,
        f"{refused_cyrillic_code!r}, last_error={reason!r}, "
        f"запросов {fake.detail_requests() - before}",
    )

    # Пробелы и перенос строки вокруг значения — обычный след копирования: они
    # снимаются, и подключение проходит с тем же номером.
    padded = FlashForgeAdapter(
        fake.address, "", f"  {SERIAL}\n", {"checkCode": f"{CHECK_CODE} "}
    )
    padded_connected = padded.connect()

    check(
        "подключение: пробелы вокруг значений снимаются",
        padded_connected is True and padded.serial_number == SERIAL,
        f"{padded_connected!r}, serial={padded.serial_number!r}",
    )

    # Отказ по существу: код с экрана не подошёл. Второй вид запроса его не
    # исправит, а мастеру нужна подсказка про поле Check Code, а не английский
    # текст прошивки.
    fake.detail = None
    fake.detail_code = 1
    fake.detail_message = "Access code is different"
    denied = make_adapter(fake)
    denied_connect = denied.connect()
    reason = denied.last_error or ""
    fake.detail = dict(DETAIL)
    fake.detail_code = 0
    fake.detail_message = "Success"

    check(
        "подключение: чужой checkCode — подсказка про экран принтера",
        denied_connect is False
        and "checkCode не принят" in reason
        and "Access code is different" not in reason,
        f"{denied_connect!r}, last_error={reason!r}",
    )

    # `code: -1` — принтер не разобрал запрос. Это причина, а не «на 8898
    # отвечает не FlashForge»: по такой подсказке мастер искал чужой сервис.
    fake.detail = None
    fake.detail_code = -1
    fake.detail_message = "Parameters is error"
    broken = make_adapter(fake)
    refused_parameters = broken.connect()
    reason = broken.last_error or ""
    fake.detail = dict(DETAIL)
    fake.detail_code = 0
    fake.detail_message = "Success"

    check(
        "подключение: Parameters is error объясняется, а не «не FlashForge»",
        refused_parameters is False
        and "параметры" in reason
        and "не FlashForge" not in reason,
        f"{refused_parameters!r}, last_error={reason!r}",
    )

    # 404 на оба вида запроса — уже не пустая карточка (та отсекается до сети),
    # а выключенный LAN-режим: подсказка называет и его, и поля принтера.
    fake.route("POST", "/detail", 404, {"message": "Not Found"})
    fake.route("GET", "/detail", 404, {"message": "Not Found"})
    denied = make_adapter(fake)
    denied_connect = denied.connect()
    reason = denied.last_error or ""
    fake.routes.pop(("POST", "/detail"))
    fake.routes.pop(("GET", "/detail"))

    check(
        "подключение: 404 на оба вида запроса объясняется карточкой принтера",
        denied_connect is False
        and "404" in reason
        and "Serial Number и Check Code" in reason,
        f"{denied_connect!r}, last_error={reason!r}",
    )

    fake.detail = {"hostname": "router", "version": "1.0"}
    stranger = make_adapter(fake)
    refused = stranger.connect()
    reason = stranger.last_error or ""

    check(
        "подключение: чужой JSON на 8898 принтером не считается",
        refused is False and "не FlashForge" in reason,
        f"{refused!r}, last_error={reason!r}",
    )

    # Веб-интерфейс соседнего устройства отвечает HTML: это не отказ прошивки,
    # и подсказка не должна отправлять мастера сверять поля карточки.
    fake.route_raw("POST", "/detail", 200, b"<html><body>router</body></html>")
    html = make_adapter(fake)
    refused_html = html.connect()
    reason = html.last_error or ""
    fake.routes.pop(("POST", "/detail"))

    check(
        "подключение: HTML вместо JSON — причина про чужой сервис",
        refused_html is False and "не JSON" in reason,
        f"{refused_html!r}, last_error={reason!r}",
    )
    fake.detail = dict(DETAIL)


def check_commands(fake: FakeFlashForge) -> None:
    """Старт печати и управление: `/printGcode` и `/control`."""
    adapter = make_adapter(fake)
    fake.route("POST", "/printGcode", 200, {"code": 0, "message": "Success"})
    started = adapter.start_print("job.gcode")
    request = fake.last("POST", "/printGcode")
    payload = request.json() if request is not None else {}

    check(
        "старт: /printGcode с serialNumber, checkCode, fileName и калибровкой",
        started is True
        and payload
        == {
            "serialNumber": SERIAL,
            "checkCode": CHECK_CODE,
            "fileName": "job.gcode",
            "levelingBeforePrint": True,
        },
        f"{started!r}, {payload!r}",
    )

    fake.route("POST", "/control", 200, {"code": 0, "message": "Success"})
    paused = adapter.pause_print()
    resumed = adapter.resume_print()
    stopped = adapter.stop_print()
    controls = [
        recorded.json() for recorded in fake.requests if recorded.path == "/control"
    ]
    commands = [body.get("jobCtl_cmd") for body in controls]
    last = controls[-1] if controls else {}

    check(
        "управление: pause, continue и cancel в /control",
        paused is True
        and resumed is True
        and stopped is True
        and commands == ["pause", "continue", "cancel"],
        f"{commands!r}",
    )
    check(
        "управление: в теле /control серийный номер и checkCode",
        last.get("serialNumber") == SERIAL and last.get("checkCode") == CHECK_CODE,
        f"{last!r}",
    )

    fake.route("POST", "/control", 409, {"code": 5, "message": "printer is busy"})
    refused = adapter.pause_print()
    reason = adapter.last_error or ""

    check(
        "управление: 409 — подсказка «занят» и причина",
        refused is False and "409" in reason and "занят" in reason,
        f"{refused!r}, last_error={reason!r}",
    )


def check_new_firmware(fake: FakeFlashForge) -> None:
    """
    Прошивка 5.x: плоский паспорт, модель из `pid` и доля вместо процентов.

    Adventurer 5M Pro 5.1.8 отвечает `/detail` без `machineStatus`, `printInfo` и
    `serialNumber`: состояние в `status`, детали печати плоско, модель только в
    `pid` (36), а в `name` лежит серийный номер. Пока подпись паспорта знала
    одни старые поля, живой принтер считался чужим сервисом и печать не
    начиналась.
    """
    adapter = make_adapter(fake)
    fake.detail = {
        "name": SERIAL,
        "firmwareVersion": "5.1.8",
        "pid": 36,
        "status": "printing",
        "printProgress": 0.65,
        "estimatedTime": 1234.4,
    }
    connected = adapter.connect()

    check(
        "прошивка 5.x: подключение по плоскому паспорту",
        connected is True,
        f"{connected!r}, last_error={adapter.last_error!r}",
    )
    check(
        "прошивка 5.x: модель из pid, а name с номером — не модель",
        adapter.model == "Adventurer 5M Pro" and adapter.firmware == "5.1.8",
        f"{adapter.model!r}, {adapter.firmware!r}",
    )

    status = adapter.get_status()

    check(
        "прошивка 5.x: status, доля прогресса и estimatedTime",
        status == {"status": "printing", "progress": 65, "remaining_time": 1234},
        f"{status!r}",
    )

    # Сырой ответ в журнале — то, по чему ищут причину, когда паспорт не
    # собрался: перепутанный порт, чужой сервис, незнакомые поля.
    records: list[logging.LogRecord] = []

    class Collector(logging.Handler):
        """Собирает записи журнала адаптера для проверки текста."""

        def emit(self, record: logging.LogRecord) -> None:
            records.append(record)

    logger = logging.getLogger("agent.adapters.flashforge")
    collector = Collector()
    logger.addHandler(collector)

    try:
        fake.detail = {"hostname": "router", "version": "1.0"}
        stranger = make_adapter(fake)
        stranger.connect()
    finally:
        logger.removeHandler(collector)
        fake.detail = dict(DETAIL)

    raw = [record.getMessage() for record in records]
    printed = next((text for text in raw if "Сырой ответ" in text), "")

    check(
        "прошивка 5.x: сырой ответ в журнале, когда паспорт не собрался",
        printed.startswith("[FlashForge] Сырой ответ:")
        and '"hostname": "router"' in printed,
        f"{printed[:90]!r}",
    )


def check_status(fake: FakeFlashForge) -> None:
    """Состояние: `machineStatus`, проценты, остаток и ошибки."""
    adapter = make_adapter(fake)
    fake.detail = {
        "machineStatus": "PRINTING",
        "printInfo": {"printProgress": 42.6, "remainingTimeEstimation": 600},
    }
    status = adapter.get_status()

    check(
        "статус: PRINTING — 43 % и 600 с",
        status == {"status": "printing", "progress": 43, "remaining_time": 600},
        f"{status!r}",
    )

    fake.detail = {"machineStatus": "heating", "printInfo": {"printProgress": 0}}
    preparing = adapter.get_status()

    check(
        "статус: HEATING — печать, а не простой",
        preparing["status"] == "printing",
        f"{preparing!r}",
    )

    fake.detail = {
        "machineStatus": "PAUSED",
        "printInfo": {"printProgress": 55, "printLeftTime": 300},
    }
    paused_status = adapter.get_status()

    check(
        "статус: PAUSED — пауза с остатком",
        paused_status
        == {"status": "paused", "progress": 55, "remaining_time": 300},
        f"{paused_status!r}",
    )

    fake.detail = {"machineStatus": "COMPLETED", "printInfo": {"printProgress": 100}}
    finished = adapter.get_status()

    check(
        "статус: COMPLETED → idle",
        finished == {"status": "idle", "progress": 100, "remaining_time": 0},
        f"{finished!r}",
    )

    fake.detail = {"machineStatus": "ERROR", "printInfo": {"printProgress": 30}}
    broken = adapter.get_status()
    reason = adapter.last_error or ""

    check(
        "статус: ERROR — ошибка с причиной",
        broken["status"] == "error" and "ERROR" in reason,
        f"{broken!r}, last_error={reason!r}",
    )

    fake.detail = {"machineStatus": "DANCING", "printInfo": {"printProgress": 10}}
    unknown = adapter.get_status()
    reason = adapter.last_error or ""

    check(
        "статус: незнакомое состояние → error",
        unknown["status"] == "error" and "неизвестное" in reason,
        f"{unknown!r}, last_error={reason!r}",
    )

    fake.detail = {"machineStatus": "PRINTING", "printInfo": {"printProgress": 12}}
    adapter.get_status()

    check(
        "статус: успешный опрос снимает прежнюю ошибку",
        adapter.last_error is None,
        f"last_error={adapter.last_error!r}",
    )

    fake.detail = None
    fake.detail_message = "Internal error"
    failed = adapter.get_status()

    check(
        "статус: /detail без данных принтера → error",
        failed == {"status": "error", "progress": 0, "remaining_time": 0},
        f"{failed!r}, last_error={adapter.last_error!r}",
    )
    fake.detail = dict(DETAIL)
    fake.detail_message = "Success"


def check_upload(
    fake: FakeFlashForge, gcode_path: Path, project_path: Path
) -> None:
    """Загрузка: multipart, заголовки, формат и отказы."""
    adapter = make_adapter(fake)
    fake.route("POST", "/uploadGcode", 200, {"code": 0, "message": "Success"})
    uploaded = adapter.upload_file(str(gcode_path), "my job.gcode")
    request = fake.last("POST", "/uploadGcode")
    body = request.body if request is not None else b""
    headers = request.headers if request is not None else {}

    check(
        "загрузка: поле gcodeFile, имя без пробела и тело файла",
        uploaded is True
        and b'name="gcodeFile"' in body
        and b'filename="my-job.gcode"' in body
        and GCODE_BODY in body,
        f"{uploaded!r}, {body[:160]!r}",
    )
    check(
        "загрузка: заголовки fileSize, printNow и levelingBeforePrint",
        headers.get("filesize") == str(len(GCODE_BODY))
        and headers.get("printnow") == "false"
        and headers.get("levelingbeforeprint") == "true",
        f"{headers!r}",
    )
    # `/uploadGcode` читает авторизацию только из заголовков: та же пара полями
    # формы возвращается отказом «SN is different», и мастер ищет ошибку в
    # серийном номере, хотя он верный.
    check(
        "загрузка: пара serialNumber/checkCode только заголовками",
        headers.get("serialnumber") == SERIAL
        and headers.get("checkcode") == CHECK_CODE
        and b'name="serialNumber"' not in body
        and b'name="checkCode"' not in body,
        f"{headers!r}",
    )

    before = fake.count("POST", "/uploadGcode")
    rejected = adapter.upload_file(str(project_path), "project.3mf")
    reason = adapter.last_error or ""

    check(
        "загрузка: .3mf без готового G-code отклонён до сети",
        rejected is False
        and "3mf" in reason
        and fake.count("POST", "/uploadGcode") == before,
        f"{rejected!r}, last_error={reason!r}",
    )

    fake.route(
        "POST",
        "/uploadGcode",
        200,
        {"code": 9, "message": "No space left on device"},
    )
    refused = adapter.upload_file(str(gcode_path), "job.gcode")
    reason = adapter.last_error or ""

    check(
        "загрузка: code 9 в теле ответа — отказ с причиной",
        refused is False and "No space left" in reason,
        f"{refused!r}, last_error={reason!r}",
    )

    fake.route(
        "POST",
        "/uploadGcode",
        200,
        {"code": 1, "message": "SN is different"},
    )
    wrong_serial = adapter.upload_file(str(gcode_path), "job.gcode")
    reason = adapter.last_error or ""

    check(
        "загрузка: SN is different — подсказка про серийный номер",
        wrong_serial is False
        and "серийный номер не принят" in reason
        and "SN is different" not in reason,
        f"{wrong_serial!r}, last_error={reason!r}",
    )

    fake.detail = {"machineStatus": "READY", "printInfo": {}}
    no_serial = FlashForgeAdapter(fake.address, "", "", {})
    before = fake.count("POST")
    blocked = no_serial.upload_file(str(gcode_path), "job.gcode")
    reason = no_serial.last_error or ""

    check(
        "загрузка: без серийного номера запрос не уходит",
        blocked is False
        and "серийный номер" in reason
        and fake.count("POST") == before,
        f"{blocked!r}, last_error={reason!r}",
    )
    fake.detail = dict(DETAIL)


def check_probe(fake: FakeFlashForge) -> None:
    """Проба: модель, прошивка, серийный номер и форматы."""
    adapter = make_adapter(fake)
    probed = adapter.probe()

    check(
        "проба: модель, прошивка и серийный номер",
        probed.get("model") == "Adventurer 5M Pro"
        and probed.get("firmware") == "2.4.5"
        and probed.get("serial_number") == SERIAL
        and probed.get("formats") == [".gcode", ".3mf"],
        f"{probed!r}",
    )

    offline = FlashForgeAdapter(CHECK_IP, "", SERIAL, {"checkCode": CHECK_CODE})
    failed = offline.probe()

    check(
        "проба: выключенный принтер — статика класса и причина",
        failed.get("formats") == [".gcode", ".3mf"]
        and failed.get("model") is None
        and offline.last_error is not None,
        f"{failed!r}, last_error={offline.last_error!r}",
    )


def check_factory() -> None:
    """Фабрика: протокол `flashforge` собирает адаптер с номером и секретами."""
    built = get_adapter(
        "flashforge",
        "127.0.0.1",
        "",
        SERIAL,
        {"checkCode": CHECK_CODE},
    )

    check(
        "фабрика: FlashForgeAdapter с паузой, возвратом и отменой",
        isinstance(built, FlashForgeAdapter)
        and built.protocol_key == "flashforge"
        and built.serial_number == SERIAL
        and built.check_code == CHECK_CODE
        and built.accepted_formats == (".gcode", ".3mf")
        and built.supports("pause")
        and built.supports("resume")
        and built.supports("cancel"),
        f"{type(built).__name__}, {built.protocol_key!r}, "
        f"{sorted(built.capabilities)}",
    )


def check_offline(gcode_path: Path) -> None:
    """Выключенный принтер: False и статус `error`, без исключений."""
    offline = FlashForgeAdapter(CHECK_IP, "", SERIAL, {"checkCode": CHECK_CODE})

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


def check_scanner() -> None:
    """Сканер: разбор UDP-ответов и находка по бродкасту."""
    parsed = scanner.flashforge_serial(FLASHFORGE_UDP_REPLY)

    check(
        "сканер: SN из ответа на ~M115",
        parsed == SERIAL,
        f"{parsed!r}",
    )
    check(
        "сканер: Serial Number старой прошивки",
        scanner.flashforge_serial(b"CMD M115 Received.\r\nSerial Number: SN99\n")
        == "SN99",
        "старый формат строки",
    )
    parsed_raw = scanner.flashforge_serial(FLASHFORGE_RAW_UDP_REPLY)

    check(
        "сканер: SN из сырого ответа с мусором",
        parsed_raw == RAW_SERIAL,
        f"{parsed_raw!r}",
    )
    check(
        "сканер: хвост чужого слова номером не считается",
        scanner.flashforge_serial(b"FMSN1234567 machine") is None,
        "SN внутри слова",
    )

    # Находка из сырого ответа: номер уходит в `serial_number`, а оттуда — в
    # `POST /api/agent/discover`, поэтому мастер не вбивает его руками.
    raw_finding = scanner.udp_printer(FLASHFORGE_RAW_UDP_REPLY, ("192.168.1.50", 19000))

    check(
        "сканер: находка из сырого ответа несёт serial_number",
        raw_finding
        == {
            "ip_address": "192.168.1.50",
            "protocol_type": "flashforge",
            "serial_number": RAW_SERIAL,
        },
        f"{raw_finding!r}",
    )

    # Журнал: строка `[UDP] FlashForge SN найден: …` — то, по чему видно, что
    # номер подтянулся автоматически, без разбора сырого ответа.
    udp_records: list[logging.LogRecord] = []

    class ScannerLogCollector(logging.Handler):
        """Собирает записи журнала сканера для проверки текста."""

        def emit(self, record: logging.LogRecord) -> None:
            udp_records.append(record)

    scanner_logger = logging.getLogger("agent.scanner")
    scanner_collector = ScannerLogCollector()
    # Уровень поднимается на время проверки: тест молчит на INFO, а строка о
    # находке пишется именно им.
    previous_level = scanner_logger.level
    scanner_logger.setLevel(logging.INFO)
    scanner_logger.addHandler(scanner_collector)

    try:
        scanner.udp_printer(FLASHFORGE_RAW_UDP_REPLY, ("192.168.1.50", 19000))
    finally:
        scanner_logger.removeHandler(scanner_collector)
        scanner_logger.setLevel(previous_level)

    logged = [record.getMessage() for record in udp_records]
    found_line = f"[UDP] FlashForge SN найден: {RAW_SERIAL}"

    check(
        "сканер: найденный SN виден в журнале",
        found_line in logged,
        f"{(logged[-1] if logged else '')!r}",
    )
    check(
        "сканер: JSON-ответ с SerialNumber",
        scanner.flashforge_serial(
            b'{"MachineType":"Adventurer 5M Pro",'
            b'"SerialNumber":"SNM0001234","FirmwareVersion":"2.4.5"}\r\n'
        )
        == SERIAL,
        "JSON верхнего уровня",
    )
    check(
        "сканер: номер из конверта detail и поля SN",
        scanner.flashforge_serial(b'{"code":0,"detail":{"SN":"SNM0001234"}}')
        == SERIAL,
        "JSON с конвертом",
    )
    check(
        "сканер: номер из поля serial_no с выравниванием нулями",
        scanner.flashforge_serial(b'{"serial_no":"SNM0001234"}\x00\x00') == SERIAL,
        "JSON с нулями выравнивания",
    )
    check(
        "сканер: ответ без номера находкой не считается",
        scanner.flashforge_serial(b"CMD M115 Received.\r\nok\r\n") is None,
        "в ответе нет SN",
    )
    check(
        "сканер: поля JSON попадают в журнал, когда номера нет",
        scanner.udp_json_keys(b'{"machineType":"AD5M","status":"ready"}')
        == "machineType, status",
        scanner.udp_json_keys(b'{"machineType":"AD5M","status":"ready"}'),
    )

    targets = scanner.broadcast_targets([ipaddress.IPv4Network("192.168.1.0/24")])

    check(
        "сканер: к глобальному бродкасту добавлен бродкаст подсети",
        targets == ["255.255.255.255", "192.168.1.255"],
        f"{targets!r}",
    )

    merged = scanner.merge_discovered_printers(
        [{"ip_address": "10.0.0.5", "protocol_type": "octoprint"}],
        [
            {
                "ip_address": "10.0.0.5",
                "protocol_type": "flashforge",
                "serial_number": SERIAL,
            }
        ],
    )

    check(
        "сканер: повтор адреса схлопывается в пользу обнаружения",
        merged
        == [
            {
                "ip_address": "10.0.0.5",
                "protocol_type": "flashforge",
                "serial_number": SERIAL,
            }
        ],
        f"{merged!r}",
    )

    with FakeUdpResponder() as udp:
        found = scanner.scan_udp_broadcast(timeout=0.6, targets=("127.0.0.1",))

    expected = [
        {
            "ip_address": "127.0.0.1",
            "protocol_type": "flashforge",
            "serial_number": SERIAL,
            # Имя из текста ответа (`Machine Name: …`): по нему мастер отличает
            # находки в окне подключения.
            "name": "Adventurer 5M Pro.",
        }
    ]

    check(
        "сканер: бродкаст нашёл FlashForge с серийным номером",
        found == expected,
        f"{found!r}",
    )

    m115_ports = {port for port, data in udp.received if b"M115" in data}

    check(
        "сканер: ~M115 ушёл на все три порта FlashForge",
        m115_ports == set(scanner.FLASHFORGE_UDP_PORTS),
        f"{sorted(m115_ports)!r}",
    )
    check(
        "сканер: M99999 ушёл на порт Elegoo",
        (scanner.ELEGOO_UDP_PORT, scanner.ELEGOO_UDP_PROBE) in udp.received,
        f"{sorted(port for port, _ in udp.received)!r}",
    )


def main() -> int:
    print("Проверка адаптера FlashForge:")

    with tempfile.TemporaryDirectory() as directory:
        gcode_path = Path(directory) / "my job.gcode"
        gcode_path.write_bytes(GCODE_BODY)
        project_path = Path(directory) / "project.3mf"
        project_path.write_bytes(b"not a zip, but the format is checked first")

        try:
            with FakeFlashForge() as fake:
                check_connect(fake)
                check_new_firmware(fake)
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

    return finish()


if __name__ == "__main__":
    sys.exit(main())
