"""
Тест адаптера PrusaLink без настоящего принтера (шаг 3).

Что проверяет:

  1. `connect()` идёт в `GET /api/v1/status` и передаёт ключ в `X-Api-Key`;
  2. чужой ключ (401) — отказ с понятной причиной, а не исключением;
  3. `upload_file()` отправляет `PUT /api/v1/files/<storage>/<name>` с телом
     файла, `Content-Type: application/octet-stream`, `Print-After-Upload: ?0` и
     `Overwrite: ?1`; хранилище берётся из `printer_secrets`, по умолчанию `usb`,
     а незнакомое значение не уходит в путь;
  4. `.3mf` отклоняется до сети (запрос не уходит), 415 и 409 объясняются в
     `last_error`;
  5. `start_print()` отправляет `{"command": "print"}` по имени файла;
  6. `get_status()` собирает ответ из двух запросов: состояние из
     `/api/v1/status`, прогресс и остаток из `/api/v1/job`; пустое задание
     (204) — это нули, а не ошибка;
  7. пауза, возврат и остановка уходят в `POST /api/v1/job` с `action`, а на
     405 прошивка получает документированные `PUT`/`DELETE`;
  8. не отвечающий принтер даёт `False` и `{"status": "error", ...}`, фабрика
     собирает `PrusaAdapter` и передаёт ему секреты.

Запуск:
    python scripts/test-prusa.py

Принтер не нужен: ответы API имитирует `http.server` на loopback, а адрес
`prusa-test.invalid` (RFC 2606) не разрешается в DNS — так проверяется поведение
адаптера при выключенном принтере.
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
from adapters.prusa import PrusaAdapter  # noqa: E402

# `.invalid` зарезервирован под тесты (RFC 2606): DNS не отдаст адрес, и
# сетевые методы упадут сразу, а не через полминуты таймаута.
CHECK_IP = "prusa-test.invalid"
CHECK_API_KEY = "PRUSA-KEY-9876"
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
        """Заголовок без учёта регистра: `Print-After-Upload` — `print-after-upload`."""
        return self.headers.get(name.lower(), "")


class FakePrusaLink:
    """
    Мини-сервер PrusaLink на loopback.

    Маршруты задаются словарём `(метод, путь) → (код, тело)`: тест отвечает так
    же, как ответила бы прошивка, и проверяет, что адаптер пришёл по нужному
    адресу нужным методом. Каждый запрос записывается целиком — без этого не
    проверить ни `X-Api-Key`, ни `Print-After-Upload`, ни тело загрузки.

    Ключ проверяется как на настоящем принтере: чужой `X-Api-Key` получает 401
    раньше маршрута. Так тест ловит и адаптер, который забыл заголовок.
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
    def __enter__(self) -> "FakePrusaLink":
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
                        self, 401, json.dumps({"message": "Invalid API key"}).encode()
                    )
                    return

                route = fake.routes.get((self.command, path))

                if route is None:
                    fake.respond(self, 404, json.dumps({"message": "Not found"}).encode())
                    return

                fake.respond(self, route[0], route[1])

            def do_GET(self) -> None:
                self._handle()

            def do_POST(self) -> None:
                self._handle()

            def do_PUT(self) -> None:
                self._handle()

            def do_DELETE(self) -> None:
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
def main() -> int:
    print("Проверка адаптера PrusaLink:")

    with tempfile.TemporaryDirectory() as directory:
        gcode_path = Path(directory) / "my job.gcode"
        gcode_path.write_bytes(GCODE_BODY)
        project_path = Path(directory) / "project.3mf"
        project_path.write_bytes(b"not a zip, but the format is checked first")

        with FakePrusaLink(CHECK_API_KEY) as fake:
            fake.route(
                "GET",
                "/api/v1/status",
                200,
                {"printer": {"state": "IDLE"}, "storage": {"path": "/usb/"}},
            )
            adapter = PrusaAdapter(ip_address=fake.address, api_key=CHECK_API_KEY)

            # 1. Подключение.
            connected = adapter.connect()
            status_request = fake.last("GET", "/api/v1/status")
            check(
                "connect: GET /api/v1/status с ключом",
                connected is True
                and status_request is not None
                and status_request.header("x-api-key") == CHECK_API_KEY,
                f"{connected!r}, "
                f"заголовок={status_request.header('x-api-key') if status_request else None!r}",
            )

            wrong = PrusaAdapter(ip_address=fake.address, api_key="wrong-key")
            rejected = wrong.connect()
            reason = wrong.last_error or ""
            check(
                "connect: 401 — отказ с подсказкой про ключ",
                rejected is False and "HTTP 401" in reason and "ключ" in reason,
                f"{rejected!r}, last_error={reason!r}",
            )

            # 2. Загрузка файла.
            fake.route(
                "PUT",
                "/api/v1/files/usb/my-job.gcode",
                201,
                {"storage": "USB", "path": "/my-job.gcode", "name": "my-job.gcode"},
            )
            uploaded = adapter.upload_file(str(gcode_path), "my job.gcode")
            record = fake.last("PUT", "/api/v1/files/usb/my-job.gcode")
            check(
                "upload: PUT /api/v1/files/usb/<name> с телом файла",
                uploaded is True
                and record is not None
                and record.body == GCODE_BODY
                and record.header("x-api-key") == CHECK_API_KEY
                and record.header("content-type") == "application/octet-stream"
                and record.header("print-after-upload") == "?0"
                and record.header("overwrite") == "?1",
                f"{uploaded!r}, тело={len(record.body) if record else 0} байт, "
                f"заголовки={record.headers if record else None}",
            )

            non_usb = PrusaAdapter(
                ip_address=fake.address,
                api_key=CHECK_API_KEY,
                secrets={"storage": "local"},
            )
            fake.route("PUT", "/api/v1/files/local/job.gcode", 201, {"storage": "LOCAL"})
            uploaded = non_usb.upload_file(str(gcode_path), "job.gcode")
            check(
                "upload: хранилище из secrets (`local`)",
                uploaded is True
                and non_usb.storage == "local"
                and fake.last("PUT", "/api/v1/files/local/job.gcode") is not None,
                f"{uploaded!r}, storage={non_usb.storage!r}",
            )

            unknown_storage = PrusaAdapter(
                ip_address=fake.address,
                api_key=CHECK_API_KEY,
                secrets={"storage": "sdcard"},
            )
            check(
                "upload: незнакомое хранилище → usb",
                unknown_storage.storage == "usb",
                f"{unknown_storage.storage!r}",
            )

            fake.route(
                "PUT", "/api/v1/files/usb/job.gcode", 415, {"message": "Unsupported"}
            )
            refused = adapter.upload_file(str(gcode_path), "job.gcode")
            reason = adapter.last_error or ""
            check(
                "upload: 415 — «формат не поддерживается» в причине",
                refused is False and "HTTP 415" in reason and "переслайсите" in reason,
                f"{refused!r}, last_error={reason!r}",
            )

            fake.route(
                "PUT", "/api/v1/files/usb/job.gcode", 409, {"message": "Already exists"}
            )
            conflict = adapter.upload_file(str(gcode_path), "job.gcode")
            reason = adapter.last_error or ""
            check(
                "upload: 409 — «файл уже есть» в причине",
                conflict is False and "HTTP 409" in reason and "уже есть" in reason,
                f"{conflict!r}, last_error={reason!r}",
            )

            before = fake.count("PUT")
            project = adapter.upload_file(str(project_path), "project.3mf")
            reason = adapter.last_error or ""
            check(
                "upload: .3mf отклонён до сетевого запроса",
                project is False
                and "не печатает .3mf" in reason
                and fake.count("PUT") == before,
                f"{project!r}, новых PUT={fake.count('PUT') - before}, "
                f"last_error={reason!r}",
            )

            # 3. Запуск печати.
            fake.route("POST", "/api/v1/files/usb/job.gcode", 204)
            started = adapter.start_print("job.gcode")
            record = fake.last("POST", "/api/v1/files/usb/job.gcode")
            body = record.json() if record is not None else {}
            check(
                "start_print: command=print по имени файла",
                started is True
                and body == {"command": "print"}
                and record is not None
                and record.header("x-api-key") == CHECK_API_KEY,
                f"{started!r}, тело={body!r}",
            )
            # 4. Состояние печати: состояние и прогресс — из разных запросов.
            fake.route("GET", "/api/v1/status", 200, {"printer": {"state": "PRINTING"}})
            fake.route(
                "GET",
                "/api/v1/job",
                200,
                {"state": "PRINTING", "progress": 42.0, "time_remaining": 900},
            )
            status = adapter.get_status()
            check(
                "get_status: PRINTING + job → printing, 42%, 900 с",
                status
                == {"status": "printing", "progress": 42, "remaining_time": 900},
                f"{status!r}",
            )

            fake.route("GET", "/api/v1/status", 200, {"printer": {"state": "PAUSED"}})
            fake.route("GET", "/api/v1/job", 204)
            status = adapter.get_status()
            check(
                "get_status: PAUSED и пустое задание (204) → paused, 0, 0",
                status == {"status": "paused", "progress": 0, "remaining_time": 0},
                f"{status!r}",
            )

            fake.route("GET", "/api/v1/status", 200, {"printer": {"state": "FINISHED"}})
            fake.route(
                "GET",
                "/api/v1/job",
                200,
                {"state": "FINISHED", "progress": 100.0, "time_remaining": 0},
            )
            status = adapter.get_status()
            check(
                "get_status: FINISHED → idle, 100%",
                status == {"status": "idle", "progress": 100, "remaining_time": 0},
                f"{status!r}",
            )

            fake.route("GET", "/api/v1/status", 200, {"printer": {"state": "ATTENTION"}})
            fake.route("GET", "/api/v1/job", 404)
            status = adapter.get_status()
            check(
                "get_status: ATTENTION → error (принтер ждёт мастера)",
                status == {"status": "error", "progress": 0, "remaining_time": 0},
                f"{status!r}",
            )

            fake.route("GET", "/api/v1/status", 200, {"printer": {"state": "DOWNGRADE"}})
            fake.route(
                "GET",
                "/api/v1/job",
                200,
                {"progress": 12.0, "time_remaining": 60},
            )
            status = adapter.get_status()
            check(
                "get_status: незнакомое состояние → error, прогресс сохранён",
                status == {"status": "error", "progress": 12, "remaining_time": 60},
                f"{status!r}",
            )

            # 5. Пауза, возврат и остановка.
            fake.route("POST", "/api/v1/job", 204)
            paused = adapter.pause_print()
            pause_request = fake.last("POST", "/api/v1/job")
            resumed = adapter.resume_print()
            resume_request = fake.last("POST", "/api/v1/job")
            stopped = adapter.stop_print()
            stop_request = fake.last("POST", "/api/v1/job")
            check(
                "команды: POST /api/v1/job с action pause/resume/stop",
                paused is True
                and resumed is True
                and stopped is True
                and pause_request is not None
                and pause_request.json() == {"action": "pause"}
                and pause_request.header("x-api-key") == CHECK_API_KEY
                and resume_request is not None
                and resume_request.json() == {"action": "resume"}
                and stop_request is not None
                and stop_request.json() == {"action": "stop"},
                f"{paused!r}/{resumed!r}/{stopped!r}: "
                f"{pause_request.json() if pause_request else None!r}, "
                f"{stop_request.json() if stop_request else None!r}",
            )

            # 6. Прошивка не знает POST: документированные PUT и DELETE.
            fake.route("POST", "/api/v1/job", 405, {"message": "Method not allowed"})
            fake.route("PUT", "/api/v1/job", 204)
            paused = adapter.pause_print()
            fallback = fake.last("PUT", "/api/v1/job")
            check(
                "пауза: 405 → PUT /api/v1/job с command=pause",
                paused is True
                and fallback is not None
                and fallback.json() == {"command": "pause"},
                f"{paused!r}, тело={fallback.json() if fallback else None!r}",
            )

            fake.route("DELETE", "/api/v1/job", 204)
            stopped = adapter.stop_print()
            check(
                "остановка: 405 → DELETE /api/v1/job",
                stopped is True and fake.last("DELETE", "/api/v1/job") is not None,
                f"{stopped!r}",
            )

            fake.route("DELETE", "/api/v1/job", 404, {"message": "Job not found"})
            stopped = adapter.stop_print()
            check(
                "остановка: DELETE 404 — печати уже нет, это успех",
                stopped is True,
                f"{stopped!r}, last_error={adapter.last_error!r}",
            )

            fake.route("PUT", "/api/v1/job", 500, {"message": "Internal error"})
            paused = adapter.pause_print()
            reason = adapter.last_error or ""
            check(
                "пауза: отказ документации (POST 405 → PUT 500) — False",
                paused is False and "HTTP 500" in reason,
                f"{paused!r}, last_error={reason!r}",
            )
        # 7. Выключенный принтер: адрес не разрешается в DNS.
        offline = PrusaAdapter(ip_address=CHECK_IP, api_key=CHECK_API_KEY)
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

    # 8. Фабрика: ключ протокола и секреты доходят до адаптера.
    built = get_adapter(
        "prusa", CHECK_IP, CHECK_API_KEY, secrets={"storage": "local"}
    )
    check(
        "фабрика: PrusaAdapter с protocol_key и storage из секретов",
        isinstance(built, PrusaAdapter)
        and built.protocol_key == "prusa"
        and built.storage == "local"
        and built.supports("pause")
        and built.supports("cancel")
        and built.accepted_formats == (".gcode", ".bgcode"),
        f"{type(built).__name__}, {built.protocol_key!r}, storage={built.storage!r}, "
        f"{sorted(built.capabilities)}",
    )

    defaulted = get_adapter("prusa", CHECK_IP, CHECK_API_KEY)
    check(
        "фабрика: без секретов — хранилище usb",
        isinstance(defaulted, PrusaAdapter) and defaulted.storage == "usb",
        f"{getattr(defaulted, 'storage', None)!r}",
    )

    return finish()


if __name__ == "__main__":
    sys.exit(main())
