"""
Тест адаптера Creality без принтера (шаг 4).

Что проверяет:

  1. `connect()` идёт в `GET /info` за моделью (`F008` — K2 Plus), поднимает
     WebSocket на 9999 и подтверждает `heart_beat`;
  2. принтер, который молчит на `heart_beat`, — отказ с понятной причиной, а не
     «подключено»: на 9999 бывает чужое приложение;
  3. `upload_file()` отправляет `POST /upload/<имя>` multipart-формой, а имя с
     пробелом приходит уже с `_` (так просит прошивка Creality);
  4. `.3mf` отклоняется до сети (ни одного запроса), `{"code": 1}` в теле
     ответа объясняется в `last_error`;
  5. `start_print()` отправляет `opGcodeFile` с `printprt:/usr/data/`, а на
     отказе пробует `/mnt/UDISK/` и запоминает рабочую папку;
  6. `get_status()` переводит `state` в статусы агента, читает проценты и
     остаток, а незнакомое состояние отдаёт как `error`;
  7. пауза, возврат и остановка уходят `pause: 1|0` и `stop: 1`; молчание
     прошивки считается отправленной командой;
  8. сканер проверяет 9999 раньше 7125: K2 Plus открывает оба порта, но печатает
     только через `opGcodeFile`;
  9. не отвечающий принтер даёт `False` и `{"status": "error", ...}`, фабрика
     собирает `CrealityAdapter`.

Запуск:
    python scripts/test-creality.py

Принтер не нужен: HTTP имитирует `http.server` на loopback, WebSocket —
`websockets.sync.server` на порту 9999 (прошивка слушает именно его). Адрес
`creality-test.invalid` (RFC 2606) не разрешается в DNS — так проверяется
поведение адаптера при выключенном принтере.
"""
from __future__ import annotations

import json
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
from adapters.creality import CrealityAdapter  # noqa: E402
from adapters.factory import get_adapter  # noqa: E402
from websockets.exceptions import ConnectionClosed  # noqa: E402
from websockets.sync.server import serve  # noqa: E402

# `.invalid` зарезервирован под тесты (RFC 2606): DNS не отдаст адрес, и
# сетевые методы упадут сразу, а не через полминуты таймаута.
CHECK_IP = "creality-test.invalid"
GCODE_BODY = b"; test\nG28\nG1 X10 Y10 E1\n"
WS_PORT = 9999

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


def is_heartbeat(message: dict[str, Any]) -> bool:
    """Сообщение — `heart_beat` (адаптер шлёт его перед каждой командой)."""
    return message.get("ModeCode") == "heart_beat"


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


class FakeCreality:
    """
    Фейковый Creality: HTTP на loopback и WebSocket на 9999.

    HTTP отвечает по маршрутам `(метод, путь)`; WebSocket — по команде:
    `heart_beat` подтверждается (или молчит, если тест проверяет «на 9999 не
    Creality»), `get` отдаёт `status`, `set` — заготовленный ответ.

    Каждое сообщение и каждый запрос записываются целиком: без этого не
    проверить ни `opGcodeFile`, ни имя файла в multipart, ни порядок папок.
    """

    def __init__(self) -> None:
        self.requests: list[Recorded] = []
        self.routes: dict[tuple[str, str], tuple[int, bytes]] = {}
        self.messages: list[dict[str, Any]] = []
        self.status: dict[str, Any] = {
            "state": 1,
            "printProgress": 0,
            "printLeftTime": 0,
        }
        # Ответы на `set` по имени параметра: очередь, чтобы один и тот же
        # запрос можно было сначала отклонить, а потом подтвердить.
        self.set_replies: dict[str, list[dict[str, Any] | None]] = {}
        self.heartbeat = True
        self.port = 0
        self._http: ThreadingHTTPServer | None = None
        self._http_thread: threading.Thread | None = None
        self._ws: Any = None
        self._ws_thread: threading.Thread | None = None

    @property
    def address(self) -> str:
        """Адрес вида `127.0.0.1:51234`: порт HTTP, WebSocket всегда 9999."""
        return f"127.0.0.1:{self.port}"

    def route(self, method: str, path: str, code: int, payload: Any = None) -> None:
        """Ответ на маршрут: JSON-объект, готовые байты или пустое тело."""
        if payload is None:
            body = b""
        elif isinstance(payload, bytes):
            body = payload
        else:
            body = json.dumps(payload).encode("utf-8")

        self.routes[(method, path)] = (code, body)

    def last(self, method: str, path: str) -> Recorded | None:
        """Последний запрос к маршруту: адаптер мог обратиться дважды."""
        for request in reversed(self.requests):
            if request.method == method and request.path == path:
                return request

        return None

    def count(self, method: str) -> int:
        """Сколько запросов этого метода пришло: проверка «до сети не дошли»."""
        return sum(1 for request in self.requests if request.method == method)

    def heartbeats(self) -> int:
        """Сколько `heart_beat` дошло до принтера."""
        return sum(1 for message in self.messages if is_heartbeat(message))

    def set_params(self, key: str) -> list[dict[str, Any]]:
        """Параметры всех `set`-команд с нужным ключом, в порядке отправки."""
        return [
            message["params"]
            for message in self.messages
            if message.get("method") == "set"
            and isinstance(message.get("params"), dict)
            and key in message["params"]
        ]

    def reply_for(self, message: dict[str, Any]) -> dict[str, Any] | None:
        """
        Ответ фейка на сообщение адаптера; `None` — промолчать.

        Молчание — обычное дело: часть прошивок не подтверждает `set`, и тест
        проверяет, что адаптер считает такую команду отправленной.
        """
        if is_heartbeat(message):
            return {"ModeCode": "heart_beat", "msg": "ok"} if self.heartbeat else None

        params = message.get("params")

        if not isinstance(params, dict):
            return {"result": "ok"}

        if message.get("method") == "get":
            return {"method": "get", "params": dict(self.status)}

        for key, replies in self.set_replies.items():
            if key in params:
                return replies.pop(0) if replies else {"result": "ok"}

        return {"result": "ok"}

    def __enter__(self) -> "FakeCreality":
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

                if route is None:
                    missing = json.dumps({"message": "Not found"}).encode()
                    fake.respond(self, 404, missing)
                    return

                fake.respond(self, route[0], route[1])

            def do_GET(self) -> None:
                self._handle()

            def do_POST(self) -> None:
                self._handle()

        self._http = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._http.daemon_threads = True
        self.port = int(self._http.server_address[1])
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

    def __exit__(self, *exception: Any) -> None:
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
        """Обработчик WebSocket: записать сообщение и ответить по команде."""
        while True:
            try:
                raw = connection.recv()
            except ConnectionClosed:
                return

            message = json.loads(raw)

            if not isinstance(message, dict):
                continue

            self.messages.append(message)
            reply = self.reply_for(message)

            if reply is not None:
                connection.send(json.dumps(reply))

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


def check_scanner(fake: FakeCreality) -> None:
    """Сканер: подпись Creality по `/info` и порядок проверки портов."""
    fake.route("GET", "/info", 200, {"model": "F008", "version": "1.1.0.31"})
    check(
        "сканер: /info с кодом модели — Creality",
        scanner.is_creality("127.0.0.1", fake.port),
        f"порт {fake.port}",
    )

    fake.route("GET", "/info", 404, {"message": "Not found"})
    fake.route("GET", "/detail", 200, {"data": {"model": "F012"}})
    check(
        "сканер: /info 404 → /detail с вложенной моделью",
        scanner.is_creality("127.0.0.1", fake.port),
        "модель во вложенном объекте",
    )

    fake.route("GET", "/detail", 200, {"hostname": "printer", "version": "1.0"})
    check(
        "сканер: JSON без модели — не Creality",
        scanner.is_creality("127.0.0.1", fake.port) is False,
        "чужой JSON на 80-м порту принтером не считается",
    )

    # Порядок портов проверяется подменой проб: настоящие 9999 и 7125 в тесте
    # заняты фейковым принтером, а вопрос один — кого спросят первым.
    calls: list[str] = []
    originals = (scanner.probe_port, scanner.is_creality, scanner.is_moonraker)

    def fake_probe(ip_address: str, port: int, timeout: float = 0.3) -> bool:
        return port in (scanner.CREALITY_PORT, scanner.MOONRAKER_PORT)

    def fake_creality(ip_address: str, port: int = 80) -> bool:
        calls.append("creality")

        return True

    def fake_moonraker(ip_address: str) -> bool:
        calls.append("moonraker")

        return True

    scanner.probe_port = fake_probe
    scanner.is_creality = fake_creality
    scanner.is_moonraker = fake_moonraker

    try:
        found = scanner.inspect_host("10.0.0.5")
    finally:
        scanner.probe_port, scanner.is_creality, scanner.is_moonraker = originals

    check(
        "сканер: 9999 (Creality) проверяется раньше 7125 (Moonraker)",
        found == {"ip_address": "10.0.0.5", "protocol_type": "creality"}
        and calls == ["creality"],
        f"{found!r}, порядок вызовов {calls}",
    )


def check_adapter(fake: FakeCreality, gcode_path: Path, project_path: Path) -> None:
    """Проверки адаптера на живом (фейковом) принтере."""
    fake.route("GET", "/info", 200, {"model": "F008", "version": "1.1.0.31"})
    fake.route(
        "POST", "/upload/my_job.gcode", 200, {"code": 0, "msg": "success"}
    )
    adapter = CrealityAdapter(ip_address=fake.address, api_key="CREALITY-KEY")

    # 1. Подключение: паспорт по HTTP и heartbeat по WebSocket.
    connected = adapter.connect()
    info_request = fake.last("GET", "/info")

    check(
        "connect: GET /info и heart_beat по WebSocket",
        connected is True
        and info_request is not None
        and fake.heartbeats() > 0
        and adapter.model == "F008"
        and adapter.model_name == "K2 Plus",
        f"{connected!r}, model={adapter.model!r}, "
        f"heart_beat={fake.heartbeats()}",
    )

    # 2. Принтер молчит на heart_beat: значит на 9999 чужое приложение.
    fake.heartbeat = False
    strict = CrealityAdapter(ip_address=fake.address, api_key="")
    accepted = strict.connect()
    reason = strict.last_error or ""

    check(
        "connect: без подтверждения heart_beat — отказ",
        accepted is False and "heart_beat" in reason,
        f"{accepted!r}, last_error={reason!r}",
    )
    strict.close()
    fake.heartbeat = True

    # 3. Загрузка: имя с пробелом приходит на принтер с `_`.
    uploaded = adapter.upload_file(str(gcode_path), "my job.gcode")
    upload = fake.last("POST", "/upload/my_job.gcode")
    body = upload.body if upload is not None else b""

    check(
        "загрузка: POST /upload/my_job.gcode с телом файла",
        uploaded is True
        and upload is not None
        and b'filename="my_job.gcode"' in body
        and GCODE_BODY in body,
        f"{uploaded!r}, путь={upload.path if upload else None!r}",
    )

    # 4. `.3mf` — до сети: формат отклоняет prepare_upload().
    before = fake.count("POST")
    rejected = adapter.upload_file(str(project_path), "project.3mf")
    reason = adapter.last_error or ""

    check(
        "загрузка: .3mf отклонён до сети",
        rejected is False
        and fake.count("POST") == before
        and ".gcode" in reason,
        f"{rejected!r}, запросов={fake.count('POST') - before}, "
        f"last_error={reason!r}",
    )

    # 5. HTTP 200 с `code: 1` — отказ прошивки, а не успех.
    fake.route(
        "POST",
        "/upload/job.gcode",
        200,
        {"code": 1, "msg": "storage is full"},
    )
    refused = adapter.upload_file(str(gcode_path), "job.gcode")
    reason = adapter.last_error or ""

    check(
        "загрузка: code=1 в теле ответа — отказ с причиной",
        refused is False and "storage is full" in reason,
        f"{refused!r}, last_error={reason!r}",
    )


    # 6. Старт печати: opGcodeFile с папкой /usr/data/.
    fake.set_replies = {}
    started = adapter.start_print("job.gcode")
    paths = fake.set_params("opGcodeFile")

    check(
        "старт: printprt:/usr/data/job.gcode",
        started is True
        and paths[-1] == {"opGcodeFile": "printprt:/usr/data/job.gcode"},
        f"{started!r}, {paths[-1] if paths else None!r}",
    )

    # 7. Отказ на /usr/data/ — вторая попытка на /mnt/UDISK/.
    fake.set_replies = {
        "opGcodeFile": [
            {"result": "fail", "msg": "file not exist"},
            {"result": "ok"},
        ]
    }
    started = adapter.start_print("part.gcode")
    paths = fake.set_params("opGcodeFile")

    check(
        "старт: отказ на /usr/data/ → /mnt/UDISK/",
        started is True
        and paths[-2:]
        == [
            {"opGcodeFile": "printprt:/usr/data/part.gcode"},
            {"opGcodeFile": "printprt:/mnt/UDISK/part.gcode"},
        ],
        f"{started!r}, {paths[-2:]!r}",
    )

    fake.set_replies = {}
    adapter.start_print("next.gcode")
    paths = fake.set_params("opGcodeFile")

    check(
        "старт: рабочая папка запоминается",
        paths[-1] == {"opGcodeFile": "printprt:/mnt/UDISK/next.gcode"},
        f"{paths[-1] if paths else None!r}",
    )

    # 8. Состояние: state, проценты и остаток.
    fake.status = {"state": 1, "printProgress": 42.6, "printLeftTime": 600}
    status = adapter.get_status()

    check(
        "статус: печать, 43 %, 600 с",
        status == {"status": "printing", "progress": 43, "remaining_time": 600},
        f"{status!r}",
    )

    fake.status = {"state": 0, "printProgress": 0, "printLeftTime": 900}
    preparing = adapter.get_status()

    check(
        "статус: подготовка (state 0) — печать, а не простой",
        preparing["status"] == "printing",
        f"{preparing!r}",
    )

    fake.status = {"state": 5, "printProgress": 55, "printLeftTime": 300}
    paused_status = adapter.get_status()

    check(
        "статус: пауза (state 5)",
        paused_status["status"] == "paused",
        f"{paused_status!r}",
    )

    fake.status = {"state": 2, "printProgress": 100, "printLeftTime": 0}
    finished = adapter.get_status()

    check(
        "статус: завершено (state 2) → idle",
        finished
        == {"status": "idle", "progress": 100, "remaining_time": 0},
        f"{finished!r}",
    )

    fake.status = {"state": 3, "printProgress": 55, "printLeftTime": 120}
    stopped = adapter.get_status()
    reason = adapter.last_error or ""

    check(
        "статус: печать остановлена (state 3) → error с причиной",
        stopped["status"] == "error" and "state=3" in reason,
        f"{stopped!r}, last_error={reason!r}",
    )

    fake.status = {"state": 9, "printProgress": 10}
    unknown = adapter.get_status()
    reason = adapter.last_error or ""

    check(
        "статус: незнакомое состояние → error",
        unknown["status"] == "error" and "неизвестное" in reason,
        f"{unknown!r}, last_error={reason!r}",
    )

    fake.status = {"state": 1, "printProgress": 12, "printLeftTime": 60}
    adapter.get_status()

    check(
        "статус: успешный опрос снимает прежнюю ошибку",
        adapter.last_error is None,
        f"last_error={adapter.last_error!r}",
    )


    # 9. Пауза, возврат и остановка: `pause` и `stop` по WebSocket.
    fake.set_replies = {}
    paused = adapter.pause_print()
    resumed = adapter.resume_print()
    stopped = adapter.stop_print()
    pause_params = fake.set_params("pause")
    stop_params = fake.set_params("stop")

    check(
        "пауза и возврат: pause=1 и pause=0",
        paused is True
        and resumed is True
        and pause_params[-2:] == [{"pause": 1}, {"pause": 0}],
        f"{paused!r}/{resumed!r}, {pause_params[-2:]!r}",
    )

    check(
        "остановка: stop=1",
        stopped is True and stop_params[-1:] == [{"stop": 1}],
        f"{stopped!r}, {stop_params[-1:]!r}",
    )

    fake.set_replies = {"pause": [{"error": "not printing"}]}
    refused = adapter.pause_print()
    reason = adapter.last_error or ""

    check(
        "пауза: error в ответе — отказ с причиной",
        refused is False and "not printing" in reason,
        f"{refused!r}, last_error={reason!r}",
    )

    # 10. Молчание прошивки: команда отправлена, но не подтверждена.
    fake.set_replies = {"stop": [None]}
    silent = adapter.stop_print()

    check(
        "остановка: молчание прошивки — команда отправлена",
        silent is True and adapter.last_error is None,
        f"{silent!r}, last_error={adapter.last_error!r}",
    )

    adapter.close()


def check_factory() -> None:
    """Фабрика: протокол `creality` собирает нужный адаптер."""
    built = get_adapter("creality", "127.0.0.1", "")

    check(
        "фабрика: CrealityAdapter с паузой, возвратом и отменой",
        isinstance(built, CrealityAdapter)
        and built.protocol_key == "creality"
        and built.accepted_formats == (".gcode",)
        and built.supports("pause")
        and built.supports("resume")
        and built.supports("cancel"),
        f"{type(built).__name__}, {built.protocol_key!r}, "
        f"{sorted(built.capabilities)}",
    )


def check_offline(gcode_path: Path) -> None:
    """Выключенный принтер: False и статус `error`, без исключений."""
    offline = CrealityAdapter(ip_address=CHECK_IP, api_key="")

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


def main() -> int:
    print("Проверка адаптера Creality:")

    with tempfile.TemporaryDirectory() as directory:
        gcode_path = Path(directory) / "my job.gcode"
        gcode_path.write_bytes(GCODE_BODY)
        project_path = Path(directory) / "project.3mf"
        project_path.write_bytes(b"not a zip, but the format is checked first")

        try:
            with FakeCreality() as fake:
                check_adapter(fake, gcode_path, project_path)
        except RuntimeError as error:
            print(f"✗ фейковый принтер не поднялся — {error}")

            return 1

        check_factory()
        check_offline(gcode_path)

        with FakeCreality() as fake:
            check_scanner(fake)

    return finish()


if __name__ == "__main__":
    sys.exit(main())

