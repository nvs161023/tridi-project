"""
Тест адаптера OctoPrint без настоящего принтера (шаг 3).

Что проверяет:

  1. `connect()` идёт в `GET /api/version` и передаёт ключ в `X-Api-Key`;
  2. чужой ключ (401) — отказ с понятной причиной в `last_error`, а не
     исключением;
  3. `upload_file()` отправляет `POST /api/files/local` multipart-формой: поле
     `file` с именем файла, `select=true` и `print=false`, кириллица и пробелы
     из имени уже убраны (`my job.gcode` → `my-job.gcode`);
  4. `.3mf` отклоняется до сети — запрос не уходит, а мастер видит «не печатает
     .3mf»; 415 на загрузку объясняется как неподдерживаемый формат;
  5. `start_print()` отправляет `select` и `print` по имени файла в пути;
  6. `get_status()` разбирает `Printing`, `Paused` и `Operational`: проценты из
     `job.progress.completion`, остаток из `printTimeLeft`, а верхний `progress`
     (старые сборки) не теряется;
  7. пауза, возврат и отмена уходят в `POST /api/job` нужными командами, а
     отказ 409 не выдаётся за успех;
  8. не отвечающий принтер даёт `False` и `{"status": "error", ...}`, фабрика
     собирает `OctoPrintAdapter` с ключом протокола из справочника.

Запуск:
    python scripts/test-octoprint.py

Принтер не нужен: ответы API имитирует `http.server` на loopback, а адрес
`octoprint-test.invalid` (RFC 2606) не разрешается в DNS — так проверяется
поведение адаптера при выключенном принтере.
"""
from __future__ import annotations

import json
import re
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
from adapters.octoprint import OctoPrintAdapter  # noqa: E402

# `.invalid` зарезервирован под тесты (RFC 2606): DNS не отдаст адрес, и
# сетевые методы упадут сразу, а не через полминуты таймаута.
CHECK_IP = "octoprint-test.invalid"
CHECK_API_KEY = "OCTO-KEY-1234"
GCODE_BODY = b"; test\nG28\nG1 X10 Y10 E1\n"

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
    """Запрос, который пришёл на фейковый сервер."""

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

    def header(self, name: str) -> str:
        """Заголовок без учёта регистра: `X-Api-Key` и `x-api-key` — одно."""
        return self.headers.get(name.lower(), "")


class FakeOctoPrint:
    """
    Мини-сервер OctoPrint на loopback.

    Маршруты задаются словарём `(метод, путь) → (код, тело)`: тест отвечает так
    же, как ответил бы принтер, и проверяет, что адаптер пришёл по нужному
    адресу. Каждый запрос записывается целиком — без этого не проверить ни
    `X-Api-Key`, ни поля multipart-формы.

    Ключ проверяется как на настоящем принтере: чужой `X-Api-Key` получает 401
    раньше маршрута. Так тест ловит и адаптер, который забыл заголовок, а не
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

    def __enter__(self) -> "FakeOctoPrint":
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

                if self.headers.get("X-Api-Key", "") != fake.api_key:
                    fake.respond(
                        self, 401, json.dumps({"error": "Invalid API key"}).encode()
                    )
                    return

                route = fake.routes.get((self.command, path))

                if route is None:
                    fake.respond(self, 404, json.dumps({"error": "Not found"}).encode())
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

        if self._thread is not None:
            self._thread.join(timeout=5)

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
def multipart_fields(request: Recorded) -> dict[str, tuple[str | None, bytes]]:
    """
    Поля multipart-формы: имя → (имя файла, содержимое).

    Модуль `cgi` (разбор форм) в Python 3.13 удалён, а тянуть `email` ради двух
    полей незачем: граница есть в `Content-Type`, тело делится по ней, а
    `Content-Disposition` разбирается регуляркой.
    """
    content_type = request.header("content-type")
    marker = "boundary="

    if marker not in content_type:
        return {}

    boundary = content_type.split(marker, 1)[1].strip().strip('"').encode("utf-8")
    fields: dict[str, tuple[str | None, bytes]] = {}

    for chunk in request.body.split(b"--" + boundary):
        head, separator, content = chunk.partition(b"\r\n\r\n")

        if not separator:
            continue

        disposition = ""

        for line in head.decode("utf-8", "replace").split("\r\n"):
            if line.lower().startswith("content-disposition:"):
                disposition = line

        name = re.search(r'name="([^"]*)"', disposition)
        filename = re.search(r'filename="([^"]*)"', disposition)

        if name is None:
            continue

        # Перед границей у части стоит CRLF — он не относится к содержимому.
        fields[name.group(1)] = (
            filename.group(1) if filename else None,
            content[:-2] if content.endswith(b"\r\n") else content,
        )

    return fields


def main() -> int:
    print("Проверка адаптера OctoPrint:")

    with tempfile.TemporaryDirectory() as directory:
        gcode_path = Path(directory) / "my job.gcode"
        gcode_path.write_bytes(GCODE_BODY)
        project_path = Path(directory) / "project.3mf"
        project_path.write_bytes(b"not a zip, but the format is checked first")

        with FakeOctoPrint(CHECK_API_KEY) as fake:
            fake.route(
                "GET",
                "/api/version",
                200,
                {"api": "0.1", "server": "1.9.3", "text": "OctoPrint 1.9.3"},
            )
            adapter = OctoPrintAdapter(ip_address=fake.address, api_key=CHECK_API_KEY)

            # 1. Подключение.
            connected = adapter.connect()
            version = fake.last("GET", "/api/version")
            check(
                "connect: GET /api/version с ключом",
                connected is True
                and version is not None
                and version.header("x-api-key") == CHECK_API_KEY,
                f"{connected!r}, заголовок={version.header('x-api-key') if version else None!r}",
            )

            wrong = OctoPrintAdapter(ip_address=fake.address, api_key="wrong-key")
            rejected = wrong.connect()
            reason = wrong.last_error or ""
            check(
                "connect: 401 — отказ с подсказкой про ключ",
                rejected is False and "HTTP 401" in reason and "ключ" in reason,
                f"{rejected!r}, last_error={reason!r}",
            )

            # 2. Загрузка файла.
            fake.route(
                "POST",
                "/api/files/local",
                201,
                {"done": True, "files": {"local": {"name": "my-job.gcode"}}},
            )
            uploaded = adapter.upload_file(str(gcode_path), "my job.gcode")
            record = fake.last("POST", "/api/files/local")
            fields = multipart_fields(record) if record is not None else {}
            file_field = fields.get("file", (None, b""))
            select_field = fields.get("select", (None, b""))
            print_field = fields.get("print", (None, b""))
            check(
                "upload: POST /api/files/local, multipart, поле file",
                uploaded is True
                and record is not None
                and record.header("x-api-key") == CHECK_API_KEY
                and file_field[0] == "my-job.gcode"
                and file_field[1] == GCODE_BODY
                and select_field[1] == b"true"
                and print_field[1] == b"false",
                f"{uploaded!r}, файл={file_field[0]!r}, "
                f"select={select_field[1]!r}, print={print_field[1]!r}",
            )

            fake.route(
                "POST",
                "/api/files/local",
                415,
                {"error": "File is not an allowed type"},
            )
            refused = adapter.upload_file(str(gcode_path), "job.gcode")
            reason = adapter.last_error or ""
            check(
                "upload: 415 — «формат не поддерживается» в причине",
                refused is False and "HTTP 415" in reason and "переслайсите" in reason,
                f"{refused!r}, last_error={reason!r}",
            )

            before = len(fake.requests)
            project = adapter.upload_file(str(project_path), "project.3mf")
            reason = adapter.last_error or ""
            check(
                "upload: .3mf отклонён до сетевого запроса",
                project is False
                and "не печатает .3mf" in reason
                and len(fake.requests) == before,
                f"{project!r}, новых запросов={len(fake.requests) - before}, "
                f"last_error={reason!r}",
            )
            # 3. Запуск печати.
            fake.route("POST", "/api/files/local/job.gcode", 204)
            started = adapter.start_print("job.gcode")
            record = fake.last("POST", "/api/files/local/job.gcode")
            body = record.json() if record is not None else {}
            check(
                "start_print: select + print по имени файла",
                started is True
                and body == {"command": "select", "print": True}
                and record is not None
                and record.header("x-api-key") == CHECK_API_KEY,
                f"{started!r}, тело={body!r}",
            )

            missing = adapter.start_print("no-such.gcode")
            reason = adapter.last_error or ""
            check(
                "start_print: 404 — файла нет",
                missing is False and "HTTP 404" in reason,
                f"{missing!r}, last_error={reason!r}",
            )

            # 4. Состояние печати.
            fake.route(
                "GET",
                "/api/job",
                200,
                {
                    "job": {"progress": {"completion": 42.4, "printTimeLeft": 600}},
                    "progress": {"completion": 42.4, "printTimeLeft": 600},
                    "state": "Printing",
                },
            )
            status = adapter.get_status()
            check(
                "get_status: Printing → printing, 42%, 600 с",
                status
                == {"status": "printing", "progress": 42, "remaining_time": 600},
                f"{status!r}",
            )

            fake.route(
                "GET",
                "/api/job",
                200,
                {
                    "job": {"progress": None},
                    "progress": {"completion": 37.2, "printTimeLeft": 120},
                    "state": "Paused",
                },
            )
            status = adapter.get_status()
            check(
                "get_status: Paused из верхнего progress (старые сборки)",
                status == {"status": "paused", "progress": 37, "remaining_time": 120},
                f"{status!r}",
            )

            fake.route(
                "GET",
                "/api/job",
                200,
                {
                    "job": {"progress": {"completion": None, "printTimeLeft": None}},
                    "state": "Operational",
                },
            )
            status = adapter.get_status()
            check(
                "get_status: Operational → idle без прогресса",
                status == {"status": "idle", "progress": 0, "remaining_time": 0},
                f"{status!r}",
            )
            fake.route(
                "GET",
                "/api/job",
                200,
                {
                    "job": {"progress": {"completion": 55.0, "printTimeLeft": 300}},
                    "state": "Error",
                },
            )
            status = adapter.get_status()
            check(
                "get_status: Error → error с прогрессом",
                status == {"status": "error", "progress": 55, "remaining_time": 300},
                f"{status!r}",
            )

            fake.route("GET", "/api/job", 200, b"<html>proxy error</html>")
            status = adapter.get_status()
            check(
                "get_status: не-JSON → error",
                status == {"status": "error", "progress": 0, "remaining_time": 0},
                f"{status!r}",
            )

            # 5. Пауза, возврат и отмена.
            fake.route("POST", "/api/job", 204)
            paused = adapter.pause_print()
            pause_request = fake.last("POST", "/api/job")
            resumed = adapter.resume_print()
            resume_request = fake.last("POST", "/api/job")
            stopped = adapter.stop_print()
            stop_request = fake.last("POST", "/api/job")
            check(
                "команды: pause, resume и cancel уходят в POST /api/job",
                paused is True
                and resumed is True
                and stopped is True
                and pause_request is not None
                and pause_request.json() == {"command": "pause", "action": "pause"}
                and pause_request.header("x-api-key") == CHECK_API_KEY
                and resume_request is not None
                and resume_request.json() == {"command": "pause", "action": "resume"}
                and stop_request is not None
                and stop_request.json() == {"command": "cancel"},
                f"{paused!r}/{resumed!r}/{stopped!r}: "
                f"{pause_request.json() if pause_request else None!r}, "
                f"{stop_request.json() if stop_request else None!r}",
            )

            fake.route("POST", "/api/job", 409, {"error": "Printer is not operational"})
            paused = adapter.pause_print()
            reason = adapter.last_error or ""
            check(
                "пауза: 409 — отказ, а не успех",
                paused is False and "HTTP 409" in reason,
                f"{paused!r}, last_error={reason!r}",
            )

        # 6. Выключенный принтер: адрес не разрешается в DNS.
        offline = OctoPrintAdapter(ip_address=CHECK_IP, api_key=CHECK_API_KEY)
        expect_false("нет принтера: connect", offline.connect)
        expect_false(
            "нет принтера: upload_file",
            lambda: offline.upload_file(str(gcode_path), "job.gcode"),
        )
        expect_false(
            "нет принтера: start_print", lambda: offline.start_print("job.gcode")
        )
        expect_false("нет принтера: пауза", offline.pause_print)
        expect_false("нет принтера: остановка", offline.stop_print)

        status = offline.get_status()
        check(
            "нет принтера: get_status → error",
            status == {"status": "error", "progress": 0, "remaining_time": 0},
            f"{status!r}",
        )

    # 7. Фабрика и объявленные возможности.
    built = get_adapter("octoprint", CHECK_IP, CHECK_API_KEY)
    check(
        "фабрика: OctoPrintAdapter с ключом протокола",
        isinstance(built, OctoPrintAdapter)
        and built.protocol_key == "octoprint"
        and built.supports("pause")
        and built.supports("resume")
        and built.supports("cancel")
        and built.accepted_formats == (".gcode", ".gco", ".g"),
        f"{type(built).__name__}, {built.protocol_key!r}, "
        f"{sorted(built.capabilities)}",
    )

    return finish()


if __name__ == "__main__":
    sys.exit(main())
