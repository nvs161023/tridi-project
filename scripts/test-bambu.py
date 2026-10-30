"""
Тест адаптера Bambu Lab без реального принтера (этап 7.5).

Что проверяет:

  1. адаптер собирается по контракту `BasePrinterAdapter`, а адрес принтера
     очищается от схемы и порта;
  2. `connect()`, `upload_file()` и `start_print()` на недоступном адресе
     возвращают False и не поднимают ни `NotImplementedError`, ни сетевых
     исключений — именно так ведёт себя выключенный принтер на ферме;
  3. `get_status()` без отчётов отдаёт `idle` / 0 / 0, а после отчётов —
     статус по `gcode_state`, прогресс из `mc_percent` и остаток в секундах
     (у Bambu он в минутах);
  4. отчёты приходят частичными, поэтому кэш дополняется, а не заменяется;
  5. серийник, которого не было в задании, берётся из топика отчёта;
  6. фабрика передаёт серийник только Bambu, а `read_printer()` в main.py
     читает `printer.serialNumber` (и snake_case), подставляя пустую строку,
     если поля нет;
  7. ответ принтера на команду (`result`/`reason`) разбирается и не смешивается
     со статусом: отказ уходит в `last_error`, а не теряется, и `STANDBY` не
     превращается в `error`;
  8. сырой `.gcode` пакуется в контейнер `.3mf` (внутри — `Metadata/plate_1.gcode`,
     `Metadata/slice_info.config` и записи OPC-пакета), грузится под именем
     `<задание>.3mf`, а временный контейнер удаляется;
  9. `start_print()` отправляет `project_file` и считает печать запущенной только
     по ответу принтера.

Запуск:
    python scripts/test-bambu.py

Реальный принтер не нужен: адрес `bambu-test.invalid` не разрешается в DNS,
поэтому сетевые методы упираются в ошибку имени и возвращают False. Таймауты
адаптера в тесте укорочены — ждать десять секунд CONNACK незачем.
"""
from __future__ import annotations

import sys
import tempfile
import zipfile
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Callable

ROOT = Path(__file__).resolve().parent.parent
AGENT_DIR = ROOT / "agent"

# Агент — не пакет в PYTHONPATH: импортируем так же, как при запуске main.py.
sys.path.insert(0, str(AGENT_DIR))

from adapters import bambu  # noqa: E402 — путь к агенту добавляется выше
from adapters.base import BasePrinterAdapter  # noqa: E402
from adapters.factory import get_adapter  # noqa: E402
from adapters.moonraker import MoonrakerAdapter  # noqa: E402
import gcode_metadata  # noqa: E402
import main as agent_main  # noqa: E402

# `.invalid` зарезервирован под тесты (RFC 2606): DNS не отдаст адрес, и
# сетевые методы упадут сразу, а не через полминуты таймаута.
CHECK_IP = "bambu-test.invalid"
CHECK_CODE = "12345678"
CHECK_SERIAL = "00M09A123456789"

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
    заглушка и мастер увидит её в журнале вместо печати.
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


def expect_status(
    name: str, adapter: bambu.BambuAdapter, expected: dict[str, Any]
) -> None:
    """`get_status()` вернул ровно ожидаемый словарь и не упал."""
    try:
        status = adapter.get_status()
    except Exception as error:  # noqa: BLE001 — падение статуса и есть провал
        check(name, False, f"исключение {type(error).__name__}: {error}")
        return

    check(name, status == expected, f"{status!r}")


class FlakyUploadAdapter(bambu.BambuAdapter):
    """
    Адаптер без сети: первые `failures` попыток загрузки падают.

    Нужен, чтобы проверить повторы `upload_file()` и причину отказа в
    `last_error` без принтера: реальная сеть в тесте недоступна, а поведение
    FTPS на живом принтере этой проверкой не воспроизводится.
    """

    def __init__(self, failures: int) -> None:
        super().__init__(ip_address=CHECK_IP, api_key=CHECK_CODE)
        self.failures = failures
        self.calls = 0

    def _upload_once(
        self, local_path: str, remote_path: str, local_size: int
    ) -> str | None:
        self.calls += 1

        if self.calls <= self.failures:
            return "connection reset by peer"

        return None

    def _upload_via_http(self, local_path: str, remote_name: str) -> str | None:
        """HTTP-фолбэк без сети: адрес `*.invalid` не разрешается в DNS."""
        return "ConnectionError: имя не разрешается"


class CapturingUploadAdapter(bambu.BambuAdapter):
    """
    Адаптер без сети: `_upload_file()` ничего не отправляет, а запоминает.

    Нужен, чтобы проверить обёртку `upload_file()`: на карту должен уйти
    контейнер `.3mf` под именем задания, а временный файл — исчезнуть.
    """

    def __init__(self) -> None:
        super().__init__(ip_address=CHECK_IP, api_key=CHECK_CODE)
        self.remote_name = ""
        self.wrapped_path = ""
        self.entries: set[str] = set()

    def _upload_file(self, local_path: str, remote_name: str) -> bool:
        self.remote_name = remote_name
        self.wrapped_path = local_path

        with zipfile.ZipFile(local_path) as container:
            self.entries = set(container.namelist())

        return True


class ScriptedPrintAdapter(bambu.BambuAdapter):
    """
    Адаптер без сети: `_publish()` не отправляет команду, а сразу кладёт ответ.

    Нужен, чтобы проверить `start_print()` без принтера: отказ `result=fail`
    должен уходить в `last_error`, принятый вариант — давать `True`, а пустой
    список ответов изображает молчащий принтер.
    """

    def __init__(self, replies: list[dict[str, Any]]) -> None:
        super().__init__(
            ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
        )
        self.replies = replies
        self.commands: list[dict[str, Any]] = []

    def _publish(self, command: dict[str, Any]) -> bool:
        self.commands.append(command)

        index = min(len(self.commands), len(self.replies)) - 1

        if index < 0:
            # Ответов нет вовсе: принтер молчит, как при потерянном отчёте.
            return True

        body = command["print"]
        self._replies[str(body["sequence_id"])] = {
            "command": body["command"],
            **self.replies[index],
        }

        return True


def main() -> int:
    """Проверки адаптера. Код выхода 0 — всё прошло, 1 — были провалы."""
    # Реальные таймауты (10 с на MQTT, 120 с на FTPS) в тесте ни к чему.
    bambu.DISCOVERY_TIMEOUT = 0.2
    bambu.CONNECT_TIMEOUT = 0.5
    bambu.FTP_TIMEOUT = 0.5
    # Паузы между повторами загрузки в тесте не нужны: сеть недоступна сразу.
    bambu.FTP_RETRY_DELAY = 0

    adapter = bambu.BambuAdapter(ip_address=CHECK_IP, api_key=CHECK_CODE)

    check(
        "адаптер по контракту BasePrinterAdapter",
        isinstance(adapter, BasePrinterAdapter),
        type(adapter).__name__,
    )
    check(
        "серийник не передан — пустая строка",
        adapter.serial_number == "",
        f"serial={adapter.serial_number!r}",
    )
    check(
        "адрес очищен от схемы и порта",
        adapter.host == CHECK_IP,
        f"host={adapter.host!r}",
    )
    check(
        "адрес «https://192.168.1.60:8883/» → 192.168.1.60",
        bambu._host("https://192.168.1.60:8883/") == "192.168.1.60",
        f"host={bambu._host('https://192.168.1.60:8883/')!r}",
    )

    try:
        serial = adapter._discover_serial()
    except Exception as error:  # noqa: BLE001 — SSDP не должен падать
        check("SSDP без принтера", False, f"исключение {type(error).__name__}")
    else:
        check("SSDP без принтера — пустой серийник", serial == "", f"{serial!r}")

    expect_false("connect() на недоступном адресе", adapter.connect)

    gcode_path = Path(tempfile.gettempdir()) / "tridi-bambu-test.gcode"
    gcode_path.write_text("; test\nG28\n", encoding="utf-8")

    try:
        expect_false(
            "upload_file() без сети",
            lambda: adapter.upload_file(str(gcode_path), "test.gcode"),
        )
    finally:
        gcode_path.unlink(missing_ok=True)

    expect_false("start_print() без соединения", lambda: adapter.start_print("x.gcode"))
    expect_status(
        "get_status() без отчётов — idle",
        adapter,
        {"status": "idle", "progress": 0, "remaining_time": 0},
    )

    # Принтер без кода доступа: подключаться некуда, но падать нечему.
    no_code = bambu.BambuAdapter(ip_address=CHECK_IP, api_key="")
    expect_false("connect() без кода доступа", no_code.connect)

    # Дальше — разбор отчётов: сеть не нужна, кэш заполняем напрямую.
    reporting = bambu.BambuAdapter(
        ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
    )
    check(
        "серийник из задания сохранён",
        reporting.serial_number == CHECK_SERIAL,
        f"serial={reporting.serial_number!r}",
    )

    reporting._apply_report(
        {"print": {"gcode_state": "RUNNING", "mc_percent": 42, "mc_remaining_time": 30}}
    )
    expect_status(
        "RUNNING → printing, остаток в секундах",
        reporting,
        {"status": "printing", "progress": 42, "remaining_time": 1800},
    )

    reporting._apply_report({"print": {"mc_percent": 77}})
    expect_status(
        "частичный отчёт дополняет кэш",
        reporting,
        {"status": "printing", "progress": 77, "remaining_time": 1800},
    )

    reporting._apply_report({"print": {"gcode_state": "PREPARE", "mc_percent": 0}})
    expect_status(
        "PREPARE → printing",
        reporting,
        {"status": "printing", "progress": 0, "remaining_time": 1800},
    )

    reporting._apply_report({"print": {"gcode_state": "FINISH", "mc_percent": 100}})
    expect_status(
        "FINISH → idle, остаток 0",
        reporting,
        {"status": "idle", "progress": 100, "remaining_time": 0},
    )

    reporting._apply_report({"print": {"gcode_state": "FAILED"}})
    expect_status(
        "FAILED → error",
        reporting,
        {"status": "error", "progress": 100, "remaining_time": 0},
    )

    reporting._apply_report({"print": {"gcode_state": "PAUSE"}})
    expect_status(
        "PAUSE → error",
        reporting,
        {"status": "error", "progress": 100, "remaining_time": 0},
    )

    # A1 в простое присылает STANDBY: без него статус был бы «печать встала».
    reporting._apply_report({"print": {"gcode_state": "STANDBY", "mc_percent": 0}})
    expect_status(
        "STANDBY → idle",
        reporting,
        {"status": "idle", "progress": 0, "remaining_time": 0},
    )

    # Ответ принтера на команду — единственный признак, что печать принята:
    # `_publish()` подтверждает только доставку в брокер.
    replying = bambu.BambuAdapter(
        ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
    )
    replying._on_message(
        None,  # type: ignore[arg-type] — клиент в тесте не нужен
        None,
        SimpleNamespace(
            topic=f"device/{CHECK_SERIAL}/report",
            payload=(
                b'{"print": {"command": "gcode_file", "sequence_id": "7", '
                b'"result": "fail", "reason": "key not exist"}}'
            ),
        ),  # type: ignore[arg-type] — SimpleNamespace вместо MQTTMessage
    )
    check(
        "ответ принтера разобран по sequence_id",
        replying._replies.get("7", {}).get("reason") == "key not exist",
        f"{replying._replies!r}",
    )
    expect_status(
        "ответ на команду не попадает в статус",
        replying,
        {"status": "idle", "progress": 0, "remaining_time": 0},
    )

    check(
        "_reply_error: success — команда принята",
        bambu._reply_error({"result": "SUCCESS"}) is None,
        repr(bambu._reply_error({"result": "SUCCESS"})),
    )
    check(
        "_reply_error: fail с причиной",
        bambu._reply_error({"result": "fail", "reason": "key not exist"})
        == "принтер отклонил печать: key not exist",
        repr(bambu._reply_error({"result": "fail", "reason": "key not exist"})),
    )
    check(
        "_reply_error: fail без причины не теряется",
        bambu._reply_error({}) == "принтер отклонил печать: без причины",
        repr(bambu._reply_error({})),
    )

    check(
        "_project_name: имя контейнера из имени задания",
        bambu._project_name("job.gcode") == "job.3mf"
        and bambu._project_name("8f1c-2.gcode") == "8f1c-2.3mf",
        bambu._project_name("job.gcode"),
    )

    project_payloads = bambu._project_file_payloads("job.3mf")
    check(
        "project_file: param внутри контейнера, url с карты",
        [item["url"] for item in project_payloads]
        == ["ftp:///cache/job.3mf", "ftp:///job.3mf"]
        and all(item["command"] == "project_file" for item in project_payloads)
        and all(item["param"] == "Metadata/plate_1.gcode" for item in project_payloads),
        f"{project_payloads!r}",
    )

    # Плоский G-code A1 не печатает: перед загрузкой он пакуется в контейнер.
    gcode_path = Path(tempfile.gettempdir()) / "tridi-bambu-pack.gcode"
    gcode_path.write_text("; test\nG28\n", encoding="utf-8")
    packer = bambu.BambuAdapter(ip_address=CHECK_IP, api_key=CHECK_CODE)
    wrapped = ""
    names: set[str] = set()
    plate_bytes = b""
    slice_info = ""
    rels = ""

    try:
        wrapped = packer._wrap_gcode_to_3mf(str(gcode_path), "pack.gcode")

        with zipfile.ZipFile(wrapped) as container:
            names = set(container.namelist())
            plate_bytes = container.read("Metadata/plate_1.gcode")
            slice_info = container.read("Metadata/slice_info.config").decode("utf-8")
            rels = container.read("_rels/.rels").decode("utf-8")
    finally:
        if wrapped:
            Path(wrapped).unlink(missing_ok=True)

    check(
        "контейнер .3mf собран из G-code",
        names
        == {
            "Metadata/plate_1.gcode",
            "Metadata/slice_info.config",
            "[Content_Types].xml",
            "_rels/.rels",
        }
        and plate_bytes == gcode_path.read_bytes()
        and 'name="index" value="1"' in slice_info
        and 'Target="/Metadata/plate_1.gcode"' in rels,
        f"{sorted(names)!r}, G-code {len(plate_bytes)} байт",
    )

    rejected_print = ScriptedPrintAdapter(
        [
            {"result": "fail", "reason": "error string"},
            {"result": "fail", "reason": "error string"},
        ]
    )
    check(
        "start_print: отказ принтера — False и причина в last_error",
        rejected_print.start_print("job.gcode") is False
        and "error string" in (rejected_print.last_error or "")
        and len(rejected_print.commands) == len(project_payloads)
        and rejected_print.commands[0]["print"]["url"] == "ftp:///cache/job.3mf",
        f"команд {len(rejected_print.commands)}, "
        f"last_error={rejected_print.last_error!r}",
    )

    second_variant = ScriptedPrintAdapter(
        [{"result": "fail", "reason": "file not found"}, {"result": "success"}]
    )
    check(
        "start_print: принимается второй вариант url",
        second_variant.start_print("job.gcode") is True
        and len(second_variant.commands) == 2
        and second_variant.commands[1]["print"]["url"] == "ftp:///job.3mf"
        and second_variant.last_error is None,
        f"команд {len(second_variant.commands)}, "
        f"last_error={second_variant.last_error!r}",
    )

    project_print = ScriptedPrintAdapter([{"result": "success"}])
    check(
        "start_print: G-code печатается project_file от имени контейнера",
        project_print.start_print("job.gcode") is True
        and len(project_print.commands) == 1
        and project_print.commands[0]["print"]["command"] == "project_file"
        and project_print.commands[0]["print"]["subtask_name"] == "job.3mf",
        f"{project_print.commands!r}",
    )

    # Молчащий принтер: ответа нет — это отказ, а не «печать запущена».
    silent_print = ScriptedPrintAdapter([])
    saved_timeout = bambu.COMMAND_REPLY_TIMEOUT

    try:
        bambu.COMMAND_REPLY_TIMEOUT = 0.1
        silent_result = silent_print.start_print("job.gcode")
    finally:
        bambu.COMMAND_REPLY_TIMEOUT = saved_timeout

    check(
        "start_print: молчание принтера — False с причиной",
        silent_result is False and "не подтвердил" in (silent_print.last_error or ""),
        f"last_error={silent_print.last_error!r}",
    )

    # Серийник, которого не было в задании: его даёт топик первого отчёта.
    learning = bambu.BambuAdapter(ip_address=CHECK_IP, api_key=CHECK_CODE)
    learning._on_message(
        None,  # type: ignore[arg-type] — клиент в тесте не нужен
        None,
        SimpleNamespace(
            topic="device/00M09B987654321/report",
            payload=b'{"print": {"gcode_state": "IDLE"}}',
        ),  # type: ignore[arg-type] — SimpleNamespace вместо MQTTMessage
    )
    check(
        "серийник из топика отчёта",
        learning.serial_number == "00M09B987654321",
        f"serial={learning.serial_number!r}",
    )

    learning._on_message(
        None,  # type: ignore[arg-type]
        None,
        SimpleNamespace(
            topic="device/00M09B987654321/report", payload=b"not a json"
        ),  # type: ignore[arg-type]
    )
    expect_status(
        "мусор в отчёте не ломает статус",
        learning,
        {"status": "idle", "progress": 0, "remaining_time": 0},
    )

    try:
        learning.close()
    except Exception as error:  # noqa: BLE001 — close не должен падать
        check(
            "close() без соединения",
            False,
            f"исключение {type(error).__name__}: {error}",
        )
    else:
        check("close() без соединения", True, "поток MQTT закрывать нечего")

    from_factory = get_adapter(
        " BAMBU ", CHECK_IP, CHECK_CODE, serial_number=CHECK_SERIAL
    )
    check(
        "фабрика отдаёт BambuAdapter с серийником",
        isinstance(from_factory, bambu.BambuAdapter)
        and from_factory.serial_number == CHECK_SERIAL,
        f"{from_factory!r}, serial={getattr(from_factory, 'serial_number', None)!r}",
    )

    moonraker = get_adapter("moonraker", CHECK_IP, CHECK_CODE)
    check(
        "фабрика не передаёт серийник Moonraker",
        isinstance(moonraker, MoonrakerAdapter)
        and not hasattr(moonraker, "serial_number"),
        type(moonraker).__name__,
    )

    printer_with_serial = agent_main.read_printer(
        {
            "printer": {
                "protocolType": "bambu",
                "ipAddress": "192.168.1.60",
                "apiKey": CHECK_CODE,
                "serialNumber": CHECK_SERIAL,
            }
        }
    )
    check(
        "read_printer читает printer.serialNumber",
        printer_with_serial is not None
        and printer_with_serial.serial_number == CHECK_SERIAL,
        f"serial={getattr(printer_with_serial, 'serial_number', None)!r}",
    )

    printer_snake = agent_main.read_printer(
        {
            "printer": {
                "protocol_type": "bambu",
                "ip_address": "192.168.1.60",
                "serial_number": "00M09C111111111",
            }
        }
    )
    check(
        "read_printer читает snake_case serial_number",
        printer_snake is not None
        and printer_snake.serial_number == "00M09C111111111",
        f"serial={getattr(printer_snake, 'serial_number', None)!r}",
    )

    printer_without_serial = agent_main.read_printer(
        {"printer": {"protocolType": "bambu", "ipAddress": "192.168.1.60"}}
    )
    check(
        "read_printer без серийника — пустая строка",
        printer_without_serial is not None
        and printer_without_serial.serial_number == "",
        f"serial={getattr(printer_without_serial, 'serial_number', None)!r}",
    )

    # Повторы загрузки: Bambu рвёт канал данных, и одна ошибка не должна
    # закрывать задание. Причина последнего отказа едет в мастерскую.
    upload_probe = Path(tempfile.gettempdir()) / "tridi-bambu-retry.gcode"
    upload_probe.write_text("; test\nG28\n", encoding="utf-8")

    try:
        failing = FlakyUploadAdapter(failures=bambu.FTP_UPLOAD_ATTEMPTS)
        upload_result = failing.upload_file(str(upload_probe), "retry.gcode")
        check(
            "загрузка повторяется и запоминает причину",
            upload_result is False
            and failing.calls == bambu.FTP_UPLOAD_ATTEMPTS
            and "connection reset" in (failing.last_error or ""),
            f"попыток {failing.calls}, last_error={failing.last_error!r}",
        )
        recovered = FlakyUploadAdapter(failures=1)
        check(
            "повтор после обрыва проходит",
            recovered.upload_file(str(upload_probe), "retry.gcode") is True
            and recovered.calls == 2
            and recovered.last_error is None,
            f"попыток {recovered.calls}, last_error={recovered.last_error!r}",
        )
    finally:
        upload_probe.unlink(missing_ok=True)

    # Сырой G-code на принтер не уходит: сначала контейнер, потом загрузка.
    wrap_probe = Path(tempfile.gettempdir()) / "tridi-bambu-wrap.gcode"
    wrap_probe.write_text("; test\nG28\n", encoding="utf-8")
    capturing = CapturingUploadAdapter()

    try:
        wrapped_upload = capturing.upload_file(str(wrap_probe), "wrap.gcode")
        check(
            "upload_file: G-code грузится контейнером .3mf",
            wrapped_upload is True
            and capturing.remote_name == "wrap.3mf"
            and "Metadata/plate_1.gcode" in capturing.entries
            and not Path(capturing.wrapped_path).exists(),
            f"{capturing.remote_name!r}, {sorted(capturing.entries)!r}, "
            f"временный файл на месте: {Path(capturing.wrapped_path).exists()}",
        )
    finally:
        wrap_probe.unlink(missing_ok=True)

    unreadable = CapturingUploadAdapter()
    check(
        "upload_file: нечитаемый G-code не пакуется",
        unreadable.upload_file(str(wrap_probe) + ".nope", "wrap.gcode") is False
        and "не упакован" in (unreadable.last_error or ""),
        f"last_error={unreadable.last_error!r}",
    )

    expect_false("stop_print() без соединения", adapter.stop_print)

    # Оценка печати из G-code: карточка заказа показывает время и пластик.
    estimate_path = Path(tempfile.gettempdir()) / "tridi-estimate-test.gcode"

    try:
        estimate_path.write_text(
            "; generated by Bambu Studio\n"
            "G28\n"
            "; filament used [g] = 9.10\n"
            "; total estimated time: 2h 5m 3s\n"
            "; total filament used [g] = 12.34\n",
            encoding="utf-8",
        )
        bambu_estimate = gcode_metadata.read_gcode_estimate(estimate_path)
        check(
            "оценка Bambu: время и граммы",
            bambu_estimate.seconds == 7503
            and bambu_estimate.filament_grams == 12.34,
            f"{bambu_estimate!r}",
        )

        estimate_path.write_text(";TIME:7503\nG28\n", encoding="utf-8")
        cura_estimate = gcode_metadata.read_gcode_estimate(estimate_path)
        check(
            "оценка Cura: ;TIME",
            cura_estimate.seconds == 7503 and cura_estimate.filament_grams is None,
            f"{cura_estimate!r}",
        )

        estimate_path.write_text(";test\nG28\n", encoding="utf-8")
        no_estimate = gcode_metadata.read_gcode_estimate(estimate_path)
        check(
            "без оценки — None, а не ноль",
            no_estimate.seconds is None and no_estimate.filament_grams is None,
            f"{no_estimate!r}",
        )

        estimate_path.write_text(
            "; estimated printing time (normal mode) = 45m 10s\n"
            "; filament used [g] = 7.5\n",
            encoding="utf-8",
        )
        read_estimate = agent_main.read_estimate("test-job", estimate_path)
        check(
            "read_estimate отдаёт секунды и граммы",
            read_estimate == (2710, 7.5),
            f"{read_estimate!r}",
        )
    finally:
        estimate_path.unlink(missing_ok=True)

    return finish()


def finish() -> int:
    """Итог теста и код выхода: 0 — всё прошло, 1 — были провалы."""
    if failures > 0:
        print(f"Провалов: {failures}.")

        return 1

    print("Все проверки пройдены.")

    return 0



if __name__ == "__main__":
    sys.exit(main())
