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
     если поля нет.

Запуск:
    python scripts/test-bambu.py

Реальный принтер не нужен: адрес `bambu-test.invalid` не разрешается в DNS,
поэтому сетевые методы упираются в ошибку имени и возвращают False. Таймауты
адаптера в тесте укорочены — ждать десять секунд CONNACK незачем.
"""
from __future__ import annotations

import sys
import tempfile
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
        self.stream_calls = 0

    def _upload_once(
        self, local_path: str, remote_path: str, local_size: int
    ) -> str | None:
        self.calls += 1

        if self.calls <= self.failures:
            return "connection reset by peer"

        return None

    def _upload_stream_once(
        self, local_path: str, remote_path: str, local_size: int
    ) -> str | None:
        """
        Ручная отправка тоже без сети: тест проверяет только повторы.

        Настоящий метод пошёл бы в FTPS к `bambu-test.invalid`, а проверка
        повторов должна оставаться мгновенной.
        """
        self.stream_calls += 1

        return "connection reset by peer"

    def _upload_via_http(self, local_path: str, remote_name: str) -> str | None:
        """HTTP-фолбэк без сети: адрес `*.invalid` не разрешается в DNS."""
        return "ConnectionError: имя не разрешается"


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
        # Сброс канала — повод повторить файл вручную через сокет, а не сразу
        # закрывать задание: на каждой попытке ровно одна ручная отправка.
        check(
            "сброс канала пробует ручную отправку",
            failing.stream_calls == bambu.FTP_UPLOAD_ATTEMPTS,
            f"ручных отправок {failing.stream_calls}",
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
