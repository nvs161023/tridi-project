"""
Тест адаптера Moonraker (Klipper) без настоящего принтера.

Что проверяет:

  1. `connect()` идёт в `GET /server/info` и передаёт ключ в `X-Api-Key`;
     `klippy_state` из ответа пишется в журнал, но не мешает подключению:
     Moonraker жив, а Klipper в `error` — файл загрузить можно;
  2. чужой ключ (401) — отказ с причиной в `last_error`, а не исключение;
  3. `upload_file()` отправляет `POST /server/files/upload` multipart-формой:
     поле `file` с именем файла и `root=gcodes`, откуда `start_print()` берёт
     файл; успех — 201 (так отвечает Moonraker) и 200 (старые сборки);
  4. `.3mf` отклоняется до сети: Klipper печатает только G-code, и мастер
     видит «не печатает .3mf», а не «печать не запущена»;
  5. `start_print()` отправляет `POST /printer/print/start?filename=<имя>`;
     404 на старт (файла нет) не выдаётся за успех;
  6. `get_status()` читает `print_stats.state` и `virtual_sdcard.progress`
     (доля 0…1 → проценты), остаток считает по `print_duration`; `paused` и
     незнакомое состояние — `error`, а не «всё хорошо»;
  7. отмена уходит в `POST /printer/print/cancel`;
  8. полный цикл задания: подключение → загрузка → старт → `printing` →
     `complete` → `idle`;
  9. выключенный принтер даёт `False` и `{"status": "error", ...}`, а фабрика
     собирает `MoonrakerAdapter` с ключом протокола из справочника.

Запуск:
    python scripts/test-moonraker.py

Принтер не нужен: ответы API имитирует `http.server` на loopback, а адрес
`moonraker-test.invalid` (RFC 2606) не разрешается в DNS — так проверяется
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

from adapters.factory import get_adapter  # noqa: E402 — путь к агенту выше
from adapters.moonraker import MoonrakerAdapter  # noqa: E402

# `.invalid` зарезервирован под тесты (RFC 2606): DNS не отдаст адрес, и
# сетевые методы упадут сразу, а не через полминуты таймаута.
CHECK_IP = "moonraker-test.invalid"
CHECK_API_KEY = "MOON-KEY-1234"
GCODE_BODY = b"; test\nG28\nG1 X10 Y10 E1\n"
STATUS_PATH = "/printer/objects/query"

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
    """Запрос, который пришёл на фейковый Moonraker."""

    method: str
    path: str
    query: str
    headers: dict[str, str]
    body: bytes

    def json(self) -> dict[str, Any]:
        """Тело как JSON-объект; пустое тело — пустой словарь."""
        if not self.body:
            return {}

        payload = json.loads(self.body)

        return payload if isinstance(payload, dict) else {}

    def header(self, name: str) -> str:
        """Заголовок без учёта регистра: `X-Api-Key` и `x-api-key` — одно."""
        return self.headers.get(name.lower(), "")


class FakeMoonraker:
    """
    Мини-сервер Moonraker на loopback.

    Маршруты задаются словарём `(метод, путь) → (код, тело)`; `path` — без
    строки запроса, сама строка лежит в `Recorded.query`. Так проверяются и
    `POST /printer/print/start?filename=...`, и обычные запросы состояния.

    Ключ проверяется как на настоящем Moonraker: чужой `X-Api-Key` получает
    401 раньше маршрута. Тест ловит и адаптер, который забыл заголовок, а не
    только тот, который перепутал путь.
    """

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key
        self.requests: list[Recorded] = []
        self.routes: dict[tuple[str, str], tuple[int, bytes]] = {}
        self.port = 0
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    @property
    def address(self) -> str:
        """Адрес вида `127.0.0.1:51234` — то, что мастер вводит в настройках."""
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

    def status(self, state: str, progress: float, duration: float = 0.0) -> None:
        """
        Ответ `/printer/objects/query`: состояние `print_stats` и прогресс.

        `progress` — доля 0…1, как отдаёт Klipper; `duration` — секунды печати
        без пауз (`print_duration`), по ним адаптер считает остаток.
        """
        self.route(
            "GET",
            STATUS_PATH,
            200,
            {
                "result": {
                    "eventtime": 1234.5,
                    "status": {
                        "print_stats": {"state": state, "print_duration": duration},
                        "virtual_sdcard": {"progress": progress},
                    },
                }
            },
        )

    def __enter__(self) -> "FakeMoonraker":
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
                parts = urlsplit(self.path)

                fake.requests.append(
                    Recorded(
                        method=self.command,
                        path=parts.path,
                        query=parts.query,
                        headers={
                            key.lower(): value for key, value in self.headers.items()
                        },
                        body=body,
                    )
                )

                if self.headers.get("X-Api-Key", "") != fake.api_key:
                    fake.respond(
                        self,
                        401,
                        json.dumps(
                            {"error": {"code": 401, "message": "Unauthorized"}}
                        ).encode(),
                    )
                    return

                route = fake.routes.get((self.command, parts.path))

                if route is None:
                    fake.respond(
                        self,
                        404,
                        json.dumps(
                            {"error": {"code": 404, "message": "Not found"}}
                        ).encode(),
                    )
                    return

                fake.respond(self, route[0], route[1])

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

    def __exit__(self, *exception: Any) -> None:
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


def check_connect(fake: FakeMoonraker) -> None:
    """Подключение: `GET /server/info`, ключ в заголовке и отказы."""
    fake.route(
        "GET",
        "/server/info",
        200,
        {
            "result": {
                "klippy_state": "ready",
                "moonraker_version": "v0.8.0",
                "components": ["klippy_apis"],
            }
        },
    )
    adapter = MoonrakerAdapter(fake.address, CHECK_API_KEY)
    connected = adapter.connect()
    request = fake.last("GET", "/server/info")

    check(
        "подключение: GET /server/info и ключ в X-Api-Key",
        connected is True
        and request is not None
        and request.header("x-api-key") == CHECK_API_KEY,
        f"{connected!r}, X-Api-Key="
        f"{request.header('x-api-key') if request else None!r}",
    )

    # Чужой ключ — 401: мастер должен увидеть причину, а не «принтер молчит».
    wrong = MoonrakerAdapter(fake.address, "OTHER-KEY")
    refused = wrong.connect()
    reason = wrong.last_error or ""

    check(
        "подключение: чужой ключ (401) — отказ с причиной",
        refused is False and "HTTP 401" in reason and "Unauthorized" in reason,
        f"{refused!r}, last_error={reason!r}",
    )

    # Moonraker жив, а Klipper в ошибке: подключение состоялось — файл залить
    # можно, и мастер увидит предупреждение в журнале.
    fake.route("GET", "/server/info", 200, {"result": {"klippy_state": "error"}})
    broken = MoonrakerAdapter(fake.address, CHECK_API_KEY)
    accepted = broken.connect()

    check(
        "подключение: Klipper в error — Moonraker доступен",
        accepted is True and broken.last_error is None,
        f"{accepted!r}, last_error={broken.last_error!r}",
    )


def check_upload(fake: FakeMoonraker, gcode_path: Path, project_path: Path) -> None:
    """Загрузка: multipart в корень `gcodes`, отказ `.3mf` и ошибки HTTP."""
    adapter = MoonrakerAdapter(fake.address, CHECK_API_KEY)
    fake.route(
        "POST",
        "/server/files/upload",
        201,
        {"result": {"item": {"path": "my-job.gcode"}, "action": "create"}},
    )

    uploaded = adapter.upload_file(str(gcode_path), "my job.gcode")
    request = fake.last("POST", "/server/files/upload")
    body = request.body if request is not None else b""

    check(
        "загрузка: POST /server/files/upload с полем file и root=gcodes",
        uploaded is True
        and request is not None
        and b'name="file"' in body
        and b'filename="my-job.gcode"' in body
        and b'name="root"' in body
        and b"gcodes" in body
        and GCODE_BODY in body
        and request.header("x-api-key") == CHECK_API_KEY,
        f"{uploaded!r}, имя файла в форме="
        f"{b'filename=\"my-job.gcode\"' in body}, root={b'name=\"root\"' in body}",
    )

    # Старые сборки отвечают 200: для адаптера это тот же успех.
    fake.route("POST", "/server/files/upload", 200, {"result": {}})
    old = adapter.upload_file(str(gcode_path), "job.gcode")

    check("загрузка: 200 принят как успех", old is True, f"{old!r}")

    # `.3mf` — до сети: Klipper контейнер слайсера не печатает, и мастер должен
    # увидеть «переслайсите в .gcode», а не «печать не запущена».
    before = fake.count("POST")
    rejected = adapter.upload_file(str(project_path), "project.3mf")
    reason = adapter.last_error or ""

    check(
        "загрузка: .3mf отклонён до сети",
        rejected is False and "не печатает" in reason and fake.count("POST") == before,
        f"{rejected!r}, last_error={reason!r}, запросов POST={fake.count('POST')}",
    )

    fake.route(
        "POST",
        "/server/files/upload",
        507,
        {"error": {"code": 507, "message": "Not enough free space"}},
    )
    failed = adapter.upload_file(str(gcode_path), "job.gcode")
    reason = adapter.last_error or ""

    check(
        "загрузка: 507 — отказ с текстом Moonraker",
        failed is False
        and "HTTP 507" in reason
        and "Not enough free space" in reason,
        f"{failed!r}, last_error={reason!r}",
    )


def check_status(fake: FakeMoonraker) -> None:
    """Состояние: `print_stats`, `virtual_sdcard` и перевод состояний."""
    adapter = MoonrakerAdapter(fake.address, CHECK_API_KEY)

    fake.status("printing", 0.42, 60.0)
    status = adapter.get_status()

    check(
        "состояние: printing, доля 0…1 → проценты, остаток по print_duration",
        status == {"status": "printing", "progress": 42, "remaining_time": 83},
        f"{status!r}",
    )

    fake.status("complete", 1.0, 120.0)
    done = adapter.get_status()

    check(
        "состояние: complete → idle без остатка",
        done == {"status": "idle", "progress": 100, "remaining_time": 0},
        f"{done!r}",
    )

    # Пауза — не «всё хорошо»: печать стоит и сама не продолжится.
    fake.status("paused", 0.5, 60.0)
    paused = adapter.get_status()

    check(
        "состояние: paused → error",
        paused["status"] == "error" and paused["progress"] == 50,
        f"{paused!r}",
    )

    fake.status("shutdown", 0.0)
    unknown = adapter.get_status()

    check(
        "состояние: незнакомое состояние → error",
        unknown == {"status": "error", "progress": 0, "remaining_time": 0},
        f"{unknown!r}",
    )

    fake.route(
        "GET", STATUS_PATH, 500, {"error": {"code": 500, "message": "Internal"}}
    )
    failed = adapter.get_status()

    check(
        "состояние: HTTP 500 → error",
        failed == {"status": "error", "progress": 0, "remaining_time": 0},
        f"{failed!r}",
    )

    # Ответ без print_stats и virtual_sdcard — это не «idle», а непонятно что.
    fake.route("GET", STATUS_PATH, 200, {"result": {"status": {}}})
    empty = adapter.get_status()

    check(
        "состояние: пустой status → error",
        empty == {"status": "error", "progress": 0, "remaining_time": 0},
        f"{empty!r}",
    )


def check_start_and_cancel(fake: FakeMoonraker) -> None:
    """Старт печати по имени файла и отмена текущей печати."""
    adapter = MoonrakerAdapter(fake.address, CHECK_API_KEY)
    fake.route("POST", "/printer/print/start", 200, {"result": "ok"})

    started = adapter.start_print("my-job.gcode")
    request = fake.last("POST", "/printer/print/start")

    check(
        "старт: POST /printer/print/start?filename=имя файла",
        started is True
        and request is not None
        and request.query == "filename=my-job.gcode",
        f"{started!r}, query={request.query if request else None!r}",
    )

    fake.route(
        "POST",
        "/printer/print/start",
        404,
        {"error": {"code": 404, "message": "File not found"}},
    )
    missing = adapter.start_print("missing.gcode")
    reason = adapter.last_error or ""

    check(
        "старт: 404 — отказ с текстом Moonraker",
        missing is False and "HTTP 404" in reason and "File not found" in reason,
        f"{missing!r}, last_error={reason!r}",
    )

    fake.route("POST", "/printer/print/cancel", 200, {"result": "ok"})
    cancelled = adapter.stop_print()
    request = fake.last("POST", "/printer/print/cancel")

    check(
        "отмена: POST /printer/print/cancel",
        cancelled is True and request is not None and adapter.last_error is None,
        f"{cancelled!r}, путь={request.path if request else None!r}",
    )


def check_cycle(fake: FakeMoonraker, gcode_path: Path) -> None:
    """
    Полный цикл задания на одном подключении, как его ведёт main.py.

    Подключение → загрузка → старт → `printing` → `complete` → `idle`: если
    адаптер и фейк расходятся в имени файла или в разборе состояния, провал
    виден здесь, а не в поле у мастера.
    """
    fake.route("GET", "/server/info", 200, {"result": {"klippy_state": "ready"}})
    fake.route("POST", "/server/files/upload", 201, {"result": {"action": "create"}})
    fake.route("POST", "/printer/print/start", 200, {"result": "ok"})
    fake.status("standby", 0.0)

    adapter = MoonrakerAdapter(fake.address, CHECK_API_KEY)
    connected = adapter.connect()
    idle = adapter.get_status()
    uploaded = adapter.upload_file(str(gcode_path), "cycle.gcode")
    started = adapter.start_print("cycle.gcode")

    fake.status("printing", 0.25, 30.0)
    printing = adapter.get_status()
    fake.status("printing", 0.85, 120.0)
    later = adapter.get_status()
    fake.status("complete", 1.0, 140.0)
    done = adapter.get_status()

    check(
        "полный цикл: connect → upload → start → printing → complete → idle",
        connected is True
        and idle["status"] == "idle"
        and uploaded is True
        and started is True
        and printing == {"status": "printing", "progress": 25, "remaining_time": 90}
        and later["progress"] == 85
        and done == {"status": "idle", "progress": 100, "remaining_time": 0}
        and adapter.last_error is None,
        f"connect={connected!r}, idle={idle['status']!r}, "
        f"upload={uploaded!r}, start={started!r}, printing={printing!r}, "
        f"later={later!r}, done={done['status']!r}",
    )


def check_offline(gcode_path: Path) -> None:
    """Выключенный принтер: `False` и `error`, без исключений наружу."""
    offline = MoonrakerAdapter(CHECK_IP, CHECK_API_KEY)

    expect_false("нет принтера: connect", offline.connect)
    expect_false(
        "нет принтера: upload_file",
        lambda: offline.upload_file(str(gcode_path), "job.gcode"),
    )
    expect_false("нет принтера: start_print", lambda: offline.start_print("job.gcode"))
    expect_false("нет принтера: отмена", offline.stop_print)

    status = offline.get_status()

    check(
        "нет принтера: get_status → error",
        status == {"status": "error", "progress": 0, "remaining_time": 0},
        f"{status!r}",
    )


def check_factory() -> None:
    """Фабрика и объявленные возможности адаптера."""
    built = get_adapter("moonraker", CHECK_IP, CHECK_API_KEY)

    check(
        "фабрика: MoonrakerAdapter с ключом протокола",
        isinstance(built, MoonrakerAdapter)
        and built.protocol_key == "moonraker"
        and built.supports("upload")
        and built.supports("start")
        and built.supports("cancel")
        and built.supports("status")
        # Паузы в драйвере нет: интерфейс не должен показывать мёртвую кнопку.
        and not built.supports("pause"),
        f"{type(built).__name__}, {built.protocol_key!r}, "
        f"{sorted(built.capabilities)}",
    )


def main() -> int:
    """Поднимает фейковый Moonraker и проверяет адаптер на нём."""
    with tempfile.TemporaryDirectory() as tmp:
        gcode_path = Path(tmp) / "job.gcode"
        gcode_path.write_bytes(GCODE_BODY)
        project_path = Path(tmp) / "project.3mf"
        project_path.write_bytes(b"PK\x03\x04 test")

        with FakeMoonraker(CHECK_API_KEY) as fake:
            check_connect(fake)
            check_upload(fake, gcode_path, project_path)
            check_status(fake)
            check_start_and_cancel(fake)
            check_cycle(fake, gcode_path)
            check_offline(gcode_path)

    check_factory()

    return finish()


if __name__ == "__main__":
    sys.exit(main())
