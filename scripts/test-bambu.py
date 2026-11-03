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
  5. серийник обязателен: без него `connect()` и `start_print()` отказывают
     одной фразой («Не указан Serial Number…»), а подписка «на всё»
     (`device/+/report`, из-за неё агент переподключался по кругу) не
     создаётся ни при каких условиях;
  6. фабрика передаёт серийник только Bambu, а `read_printer()` в main.py
     читает `printer.serialNumber` (и snake_case), подставляя пустую строку,
     если поля нет;
  7. ответ принтера на команду (`result`/`reason`) разбирается и не смешивается
     со статусом: отказ уходит в `last_error`, а не теряется, и `STANDBY` не
     превращается в `error`; `FAILED` и `CANCELLED` отдают `error`, а причина
     остановки из `fail_reason`/`print_error`/`mc_print_error_code` попадает в
     `last_error` (ноль и пустая строка — «причины нет», отказ команды важнее);
  8. проект `.3mf` из Bambu Studio уходит на карту как есть, адаптер помнит
     запись пластины (`Metadata/plate_N.gcode`) для команды печати, а плоский
     `.gcode` и STL отклоняются до сети с подсказкой о нарезке;
  9. `start_print()` отправляет `project_file` и считает печать запущенной только
     по ответу принтера;
  10. обрыв MQTT во время загрузки не убивает печать: `start_print()` ждёт
      переподключения, а без связи объясняет причину («нет MQTT-соединения»);
  11. `_publish()` после обрыва переподключается и повторяет команду один раз;
  12. серийник из задания используется сразу, без сертификата и SSDP.

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
from adapters import formats  # noqa: E402
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


def write_bambu_project(
    path: Path, printer_model: str = "Bambu Lab A1", plate: int = 1
) -> Path:
    """
    `.3mf` в том виде, в каком его сохраняет Bambu Studio.

    Внутри — нарезанный G-code пластины и профиль слайсера с моделью принтера:
    именно это проверяет `formats.read_bambu_project()`. Такой файл адаптер
    загружает как есть, а не пакует заново.
    """
    with zipfile.ZipFile(path, "w") as project:
        project.writestr(f"Metadata/plate_{plate}.gcode", "; project\nG28\n")
        project.writestr(
            "Metadata/project_settings.config",
            '{ "printer_model": "%s" }' % printer_model,
        )

    return path


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


class FakeMqttClient:
    """
    MQTT-клиент без сети: «соединение» есть, публикации запоминаются.

    Нужен, чтобы проверить `start_print()` и `_publish()` без принтера:
    настоящий paho требует TLS-сокет, а адаптеру от клиента нужны только
    `is_connected()` и `publish()`. `drop_after` изображает обрыв — столько
    публикаций пройдёт успешно, дальше клиент отвечает `MQTT_ERR_NO_CONN`,
    пока его не «переподключат».
    """

    def __init__(self, port: int = 0, drop_after: int | None = None) -> None:
        self.topic = ""
        self.port = port
        self.payloads: list[str] = []
        self.dropped = False
        self.drop_after = drop_after
        self.subscribed: list[str] = []

    def is_connected(self) -> bool:
        return not self.dropped

    def publish(self, topic: str, payload: str, qos: int = 0) -> SimpleNamespace:
        self.topic = topic

        if self.dropped or (
            self.drop_after is not None and len(self.payloads) >= self.drop_after
        ):
            self.dropped = True

            return SimpleNamespace(rc=bambu.mqtt.MQTT_ERR_NO_CONN)

        self.payloads.append(payload)

        return SimpleNamespace(rc=bambu.mqtt.MQTT_ERR_SUCCESS)

    def subscribe(self, topic: str, qos: int = 0) -> tuple[int, int]:
        self.subscribed.append(topic)

        return bambu.mqtt.MQTT_ERR_SUCCESS, 0

    def unsubscribe(self, topic: str) -> tuple[int, int]:
        return bambu.mqtt.MQTT_ERR_SUCCESS, 0

    def loop_stop(self) -> None:
        """Потока нет: останавливать нечего."""

    def disconnect(self) -> None:
        self.dropped = True

    def reconnect(self) -> None:
        self.dropped = False


class ScriptedPrintAdapter(bambu.BambuAdapter):
    """
    Адаптер без сети: `_publish()` не отправляет команду, а сразу кладёт ответ.

    Нужен, чтобы проверить `start_print()` без принтера: отказ `result=fail`
    должен уходить в `last_error`, принятый вариант — давать `True`, а пустой
    список ответов изображает молчащий принтер. Соединение подставлено
    (`FakeMqttClient`): `start_print()` теперь ждёт связь перед командой.
    """

    def __init__(self, replies: list[dict[str, Any]]) -> None:
        super().__init__(
            ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
        )
        self.replies = replies
        self.commands: list[dict[str, Any]] = []
        self._client = FakeMqttClient()

    def _publish(self, command: dict[str, Any], *, retry: bool = True) -> bool:
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


class ReconnectingAdapter(bambu.BambuAdapter):
    """
    Адаптер с «живым» клиентом, который рвёт соединение на публикации.

    Нужен, чтобы проверить `_publish()` без сети: `connect()` подставляет новый
    `FakeMqttClient` (как paho после переподключения), а старый клиент отвечает
    `MQTT_ERR_NO_CONN` — ровно то, что видел агент, когда печать не запускалась
    после обрыва MQTT во время FTPS-загрузки.
    """

    def __init__(self, drop_after: int = 0, reconnect: bool = True) -> None:
        super().__init__(
            ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
        )
        self.drop_after = drop_after
        self.reconnects = reconnect
        self.connects = 0
        self._client = FakeMqttClient(drop_after=drop_after)

    def connect(self) -> bool:
        self.connects += 1

        if not self.reconnects:
            self._client = None

            return False

        self._client = FakeMqttClient()

        return True


class SilentPrintAdapter:
    """
    Адаптер для `monitor_print()`: отдаёт заранее записанные состояния.

    Нужен, чтобы проверить цикл без принтера и без ожидания: состояния идут по
    списку, последнее повторяется, причина отказа берётся из `last_error`.
    """

    def __init__(self, snapshots: list[dict[str, Any]], last_error: str | None) -> None:
        self.snapshots = snapshots
        self.last_error = last_error
        self.index = 0
        self.stopped = 0

    def get_status(self) -> dict[str, Any]:
        snapshot = self.snapshots[min(self.index, len(self.snapshots) - 1)]
        self.index += 1

        return snapshot

    def stop_print(self) -> bool:
        self.stopped += 1

        return True


def run_monitor(adapter: SilentPrintAdapter) -> list[tuple[str, int, str | None]]:
    """
    `monitor_print()` с отключёнными паузами: только отправленные статусы.

    Подменяются `send_status`, `fetch_cancel_request` и интервалы — сам цикл
    остаётся настоящим, поэтому проверяется именно он.
    """
    sent: list[tuple[str, int, str | None]] = []
    saved = (
        agent_main.MONITOR_INTERVAL,
        agent_main.PRINT_START_DELAY,
        agent_main.PRINT_START_CHECKS,
        agent_main.send_status,
        agent_main.fetch_cancel_request,
    )

    try:
        agent_main.MONITOR_INTERVAL = 0
        agent_main.PRINT_START_DELAY = 0

        def capture(
            job_id: str,
            status: str,
            progress: int | None = None,
            reason: str | None = None,
            **_rest: Any,
        ) -> bool:
            sent.append((status, progress or 0, reason))

            return True

        agent_main.send_status = capture
        agent_main.fetch_cancel_request = lambda job_id: False
        agent_main.monitor_print("test-job", adapter)  # type: ignore[arg-type]
    finally:
        (
            agent_main.MONITOR_INTERVAL,
            agent_main.PRINT_START_DELAY,
            agent_main.PRINT_START_CHECKS,
            agent_main.send_status,
            agent_main.fetch_cancel_request,
        ) = saved

    return sent


def main() -> int:
    """Проверки адаптера. Код выхода 0 — всё прошло, 1 — были провалы."""
    # Реальные таймауты (10 с на MQTT, 120 с на FTPS) в тесте ни к чему.
    bambu.DISCOVERY_TIMEOUT = 0.2
    bambu.CONNECT_TIMEOUT = 0.5
    bambu.FTP_TIMEOUT = 0.5
    # Ожидание переподключения перед командой: на живом принтере это 10 с.
    bambu.CONNECT_RETRY_TIMEOUT = 0.2
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

    expect_false(
        "connect() на недоступном адресе",
        bambu.BambuAdapter(
            ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
        ).connect,
    )

    # Без серийника сеть не трогаем вовсе: топики строятся из номера, а
    # шаблонную подписку брокер принтера рвёт разрывом TLS.
    no_serial_connect = bambu.BambuAdapter(ip_address=CHECK_IP, api_key=CHECK_CODE)
    expect_false("connect() без серийника", no_serial_connect.connect)
    check(
        "connect() без серийника — причина «Не указан Serial Number»",
        no_serial_connect.last_error == bambu.SERIAL_REQUIRED_ERROR,
        f"last_error={no_serial_connect.last_error!r}",
    )

    gcode_path = Path(tempfile.gettempdir()) / "tridi-bambu-test.gcode"
    gcode_path.write_text("; test\nG28\n", encoding="utf-8")

    try:
        expect_false(
            "upload_file() без сети",
            lambda: adapter.upload_file(str(gcode_path), "test.gcode"),
        )
    finally:
        gcode_path.unlink(missing_ok=True)

    expect_false("start_print() без серийника", lambda: adapter.start_print("x.gcode"))
    check(
        "start_print() без серийника — причина та же",
        adapter.last_error == bambu.SERIAL_REQUIRED_ERROR,
        f"last_error={adapter.last_error!r}",
    )
    expect_status(
        "get_status() без отчётов — idle",
        adapter,
        {"status": "idle", "progress": 0, "remaining_time": 0},
    )

    # Принтер без кода доступа: подключаться некуда, но падать нечему.
    no_code = bambu.BambuAdapter(ip_address=CHECK_IP, api_key="")
    expect_false("connect() без кода доступа", no_code.connect)

    # Кириллица в поле карточки: из серийника строится топик `device/<sn>/…`, а
    # код доступа уходит в FTPS-логин. Такое значение роняло задание
    # UnicodeEncodeError, поэтому connect() отказывает до сети.
    cyrillic_serial = bambu.BambuAdapter(
        ip_address=CHECK_IP,
        api_key=CHECK_CODE,
        serial_number=CHECK_SERIAL.replace("0", "О"),
    )
    expect_false("connect() с кириллицей в серийнике", cyrillic_serial.connect)
    check(
        "connect() с кириллицей в серийнике — причина про раскладку",
        "недопустимые символы" in (cyrillic_serial.last_error or ""),
        f"last_error={cyrillic_serial.last_error!r}",
    )

    cyrillic_code = bambu.BambuAdapter(
        ip_address=CHECK_IP,
        api_key=CHECK_CODE.replace("1", "і"),
        serial_number=CHECK_SERIAL,
    )
    expect_false("connect() с кириллицей в коде доступа", cyrillic_code.connect)
    check(
        "connect() с кириллицей в коде доступа — причина про раскладку",
        "недопустимые символы" in (cyrillic_code.last_error or ""),
        f"last_error={cyrillic_code.last_error!r}",
    )

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

    # Причина остановки: принтер называет её сам (`fail_reason`, `print_error`,
    # `mc_print_error_code`), и мастер должен видеть её в карточке заказа, а не
    # общее «печать прервана». Проверки ниже — на отдельных адаптерах: `_report`
    # копит поля отчёта, и причина одной печати не должна попасть в другую.
    cancelled = bambu.BambuAdapter(
        ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
    )
    cancelled._apply_report(
        {
            "print": {
                "gcode_state": "FAILED",
                "mc_percent": 43,
                "fail_reason": "cancelled",
            }
        }
    )
    expect_status(
        "FAILED на середине печати → error",
        cancelled,
        {"status": "error", "progress": 43, "remaining_time": 0},
    )
    check(
        "FAILED: причина отмены в last_error",
        "fail_reason: cancelled" in (cancelled.last_error or ""),
        f"last_error={cancelled.last_error!r}",
    )

    cancelled_state = bambu.BambuAdapter(
        ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
    )
    cancelled_state._apply_report(
        {"print": {"gcode_state": "CANCELLED", "fail_reason": "stopped by user"}}
    )
    expect_status(
        "CANCELLED → error",
        cancelled_state,
        {"status": "error", "progress": 0, "remaining_time": 0},
    )
    check(
        "CANCELLED: причина в last_error",
        "fail_reason: stopped by user" in (cancelled_state.last_error or ""),
        f"last_error={cancelled_state.last_error!r}",
    )

    # Коды отказа приходят не вместе с состоянием, а отдельным сообщением —
    # кэш отчёта копит оба, и причина собирается из всего, что нашлось.
    error_codes = bambu.BambuAdapter(
        ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
    )
    error_codes._apply_report({"print": {"gcode_state": "FAILED", "print_error": 0}})
    error_codes._apply_report(
        {"print": {"print_error": 83935248, "mc_print_error_code": "0700_8010"}}
    )
    expect_status(
        "FAILED с кодами отказа → error",
        error_codes,
        {"status": "error", "progress": 0, "remaining_time": 0},
    )
    check(
        "FAILED: коды отказа в last_error",
        "print_error: 83935248" in (error_codes.last_error or "")
        and "mc_print_error_code: 0700_8010" in (error_codes.last_error or ""),
        f"last_error={error_codes.last_error!r}",
    )

    # Причины нет — но мастер всё равно узнаёт, что печать прервана и чем именно
    # принтер это назвал: «0» в коде ошибки означает «ошибки нет».
    silent_failure = bambu.BambuAdapter(
        ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
    )
    silent_failure._apply_report(
        {"print": {"gcode_state": "FAILED", "print_error": 0, "fail_reason": ""}}
    )
    expect_status(
        "FAILED без причины → error",
        silent_failure,
        {"status": "error", "progress": 0, "remaining_time": 0},
    )
    check(
        "FAILED без причины: состояние в last_error",
        "gcode_state: FAILED" in (silent_failure.last_error or ""),
        f"last_error={silent_failure.last_error!r}",
    )

    # Отказ команды важнее состояния: он говорит, почему печать не пошла.
    rejected = bambu.BambuAdapter(
        ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
    )
    rejected._remember_reply(
        {
            "print": {
                "command": "project_file",
                "sequence_id": "4",
                "result": "fail",
                "reason": "error string",
            }
        }
    )
    rejected._apply_report(
        {"print": {"gcode_state": "FAILED", "fail_reason": "cancelled"}}
    )
    expect_status(
        "отказ команды и FAILED → error",
        rejected,
        {"status": "error", "progress": 0, "remaining_time": 0},
    )
    check(
        "отказ команды важнее причины отчёта",
        (rejected.last_error or "").startswith("принтер отклонил project_file"),
        f"last_error={rejected.last_error!r}",
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
                b'{"print": {"command": "project_file", "sequence_id": "7", '
                b'"result": "fail", "reason": "key not exist"}}'
            ),
        ),  # type: ignore[arg-type] — SimpleNamespace вместо MQTTMessage
    )
    check(
        "ответ принтера разобран по sequence_id",
        replying._replies.get("7", {}).get("reason") == "key not exist",
        f"{replying._replies!r}",
    )
    # Отказ команды — это ошибка печати, даже если отчётов о печати не было:
    # раньше такой `fail` не менял статус, и задание закрывалось как `done`.
    expect_status(
        "ответ fail → статус error",
        replying,
        {"status": "error", "progress": 0, "remaining_time": 0},
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

    project_payloads = bambu._project_file_payloads("job.3mf")
    check(
        "project_file: param внутри контейнера, url с карты",
        [item["url"] for item in project_payloads]
        == ["ftp:///cache/job.3mf", "ftp:///job.3mf"]
        and all(item["command"] == "project_file" for item in project_payloads)
        and all(item["param"] == "Metadata/plate_1.gcode" for item in project_payloads)
        and all(item["project_id"] == "0" for item in project_payloads)
        and all(item["bed_levelling"] is True for item in project_payloads),
        f"{project_payloads!r}",
    )

    check(
        "project_file: param берётся из пластины проекта",
        bambu._project_file_payloads("job.3mf", "Metadata/plate_2.gcode")[0]["param"]
        == "Metadata/plate_2.gcode",
        bambu._project_file_payloads("job.3mf", "Metadata/plate_2.gcode")[0]["param"],
    )

    # Проект проверяется до сети: без нарезки и профиля слайсера прошивка его не
    # разберёт, и лучше сказать об этом мастеру заранее.
    project_path = write_bambu_project(
        Path(tempfile.gettempdir()) / "tridi-bambu-project.3mf",
        printer_model="Bambu Lab A1",
        plate=2,
    )

    try:
        project = formats.read_bambu_project(str(project_path))
        check(
            "read_bambu_project: пластина и модель принтера",
            project.gcode_part == "Metadata/plate_2.gcode"
            and project.plate == 2
            and project.printer_model == "Bambu Lab A1",
            f"{project!r}",
        )
    finally:
        project_path.unlink(missing_ok=True)

    unsliced_path = Path(tempfile.gettempdir()) / "tridi-bambu-model.3mf"

    try:
        with zipfile.ZipFile(unsliced_path, "w") as unsliced:
            unsliced.writestr(
                "Metadata/project_settings.config",
                '{ "printer_model": "Bambu Lab A1" }',
            )

        try:
            formats.read_bambu_project(str(unsliced_path))
        except formats.FormatError as error:
            check(
                "read_bambu_project: .3mf без нарезки отклонён",
                "нет нарезанного G-code" in str(error),
                str(error),
            )
        else:
            check("read_bambu_project: .3mf без нарезки отклонён", False, "—")
    finally:
        unsliced_path.unlink(missing_ok=True)

    check(
        "bambu_compat_error: проект чужой модели отклонён",
        formats.bambu_compat_error("Bambu Lab X1 Carbon", "Bambu Lab", "A1") is not None,
        str(formats.bambu_compat_error("Bambu Lab X1 Carbon", "Bambu Lab", "A1")),
    )

    rejected_print = ScriptedPrintAdapter(
        [
            {"result": "fail", "reason": "error string"},
            {"result": "fail", "reason": "error string"},
        ]
    )
    check(
        "start_print: отказ принтера — False и причина в last_error",
        rejected_print.start_print("job.3mf") is False
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
        second_variant.start_print("job.3mf") is True
        and len(second_variant.commands) == 2
        and second_variant.commands[1]["print"]["url"] == "ftp:///job.3mf"
        and second_variant.last_error is None,
        f"команд {len(second_variant.commands)}, "
        f"last_error={second_variant.last_error!r}",
    )

    project_print = ScriptedPrintAdapter([{"result": "success"}])
    check(
        "start_print: проект .3mf печатается project_file",
        project_print.start_print("job.3mf") is True
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

    # Пустой SN — не «сеть отвалилась», а незаполненная карточка принтера.
    # Проверка стоит первой строкой `start_print()`: ни таймаутов, ни
    # переподключений, ни подписки — иначе мастер увидел бы «MQTT-соединение
    # потеряно» вместо «впишите SN».
    empty_serial = bambu.BambuAdapter(ip_address=CHECK_IP, api_key=CHECK_CODE)
    empty_client = FakeMqttClient()
    empty_serial._client = empty_client
    serial_result = empty_serial.start_print("job.gcode")

    check(
        "start_print: пустой SN — отказ без команд и подписки",
        serial_result is False
        and empty_client.payloads == []
        and empty_client.subscribed == [],
        f"payloads={empty_client.payloads!r}, "
        f"subscribed={empty_client.subscribed!r}",
    )
    check(
        "start_print: пустой SN — причина «Не указан Serial Number»",
        empty_serial.last_error == bambu.SERIAL_REQUIRED_ERROR
        and "Не указан Serial Number" in (empty_serial.last_error or "")
        and "обязателен для LAN-режима Bambu Lab" in (empty_serial.last_error or ""),
        f"last_error={empty_serial.last_error!r}",
    )

    # Подписки «на всё» нет: шаблонный SUBSCRIBE принтер рвёт разрывом TLS, и
    # агент крутился в петле «подключился — подписался — оборвалось».
    bare = bambu.BambuAdapter(ip_address=CHECK_IP, api_key=CHECK_CODE)
    bare_client = FakeMqttClient()

    check(
        "_subscribe без серийника: отказ и ни одного SUBSCRIBE",
        bare._subscribe(bare_client) is False and bare_client.subscribed == [],
        f"subscribed={bare_client.subscribed!r}",
    )

    exact = bambu.BambuAdapter(
        ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
    )
    exact_client = FakeMqttClient()

    check(
        "_subscribe подписывается только на точный топик",
        exact._subscribe(exact_client) is True
        and exact_client.subscribed == [f"device/{CHECK_SERIAL}/report"],
        f"subscribed={exact_client.subscribed!r}",
    )

    # Серийник из задания — самый быстрый путь: ни сертификата, ни SSDP.
    from_task = bambu.BambuAdapter(
        ip_address=CHECK_IP, api_key=CHECK_CODE, serial_number=CHECK_SERIAL
    )
    check(
        "серийник из задания используется без сертификата и SSDP",
        from_task._ensure_serial() == CHECK_SERIAL,
        f"serial={from_task.serial_number!r}",
    )

    # Задача 3: команда не теряется, если соединение оборвалось на публикации.
    rejoining = ReconnectingAdapter(drop_after=0)
    rejoined = rejoining._publish({"print": {"command": "stop"}})
    check(
        "_publish: после обрыва переподключается и повторяет команду",
        rejoined is True
        and rejoining.connects == 1
        and rejoining._client is not None
        and len(rejoining._client.payloads) == 1,
        f"ok={rejoined}, переподключений {rejoining.connects}, "
        f"публикаций {len(rejoining._client.payloads) if rejoining._client else 0}",
    )

    dead = ReconnectingAdapter(reconnect=False)
    check(
        "_publish: переподключение не удалось — False",
        dead._publish({"print": {"command": "stop"}}) is False and dead.connects == 1,
        f"переподключений {dead.connects}",
    )

    dead_print = ReconnectingAdapter(reconnect=False)
    saved_connect_retry = bambu.CONNECT_RETRY_TIMEOUT

    try:
        bambu.CONNECT_RETRY_TIMEOUT = 0.1
        dead_print_result = dead_print.start_print("job.gcode")
    finally:
        bambu.CONNECT_RETRY_TIMEOUT = saved_connect_retry

    check(
        "start_print: нет MQTT — причина «нет соединения», а не серийник",
        dead_print_result is False
        and "нет MQTT-соединения" in (dead_print.last_error or ""),
        f"last_error={dead_print.last_error!r}",
    )

    # Отчёт приходит только в точный топик, поэтому номер из него не выучить:
    # шаблонной подписки нет, и `_on_message` разбирает состояние, а серийник
    # не подставляет — иначе адаптер снова ждал бы номер «из сети».
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
        "отчёт не подставляет серийник (шаблонной подписки нет)",
        learning.serial_number == "",
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
    upload_probe = Path(tempfile.gettempdir()) / "tridi-bambu-retry.3mf"
    write_bambu_project(upload_probe)

    try:
        failing = FlakyUploadAdapter(failures=bambu.FTP_UPLOAD_ATTEMPTS)
        upload_result = failing.upload_file(str(upload_probe), "retry.3mf")
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
            recovered.upload_file(str(upload_probe), "retry.3mf") is True
            and recovered.calls == 2
            and recovered.last_error is None,
            f"попыток {recovered.calls}, last_error={recovered.last_error!r}",
        )
    finally:
        upload_probe.unlink(missing_ok=True)

    # Плоский G-code A1 не печатает: отказ приходит до сети, а не после загрузки.
    gcode_probe = Path(tempfile.gettempdir()) / "tridi-bambu-raw.gcode"
    gcode_probe.write_text("; test\nG28\n", encoding="utf-8")

    try:
        raw = CapturingUploadAdapter()
        raw_upload = raw.upload_file(str(gcode_probe), "raw.gcode")
        check(
            "upload_file: плоский .gcode отклонён до сети",
            raw_upload is False
            and raw.remote_name == ""
            and "Bambu Studio" in (raw.last_error or ""),
            f"last_error={raw.last_error!r}",
        )
    finally:
        gcode_probe.unlink(missing_ok=True)

    unreadable = CapturingUploadAdapter()
    missing_probe = Path(tempfile.gettempdir()) / "tridi-bambu-missing.3mf"
    missing_probe.unlink(missing_ok=True)
    check(
        "upload_file: нечитаемый проект не подготовлен",
        unreadable.upload_file(str(missing_probe), "missing.3mf") is False
        and "не прочитан" in (unreadable.last_error or ""),
        f"last_error={unreadable.last_error!r}",
    )

    # Чужой формат отсекается до сети: принтер такой файл всё равно не примет.
    alien = CapturingUploadAdapter()
    check(
        "upload_file: чужое расширение — причина про формат",
        alien.upload_file(str(missing_probe) + ".nope", "wrap.nope") is False
        and "не печатает" in (alien.last_error or ""),
        f"last_error={alien.last_error!r}",
    )

    # Проект уходит на карту как есть, а пластина проекта запоминается для
    # `param` команды печати.
    ready_probe = Path(tempfile.gettempdir()) / "tridi-bambu-ready.3mf"
    passthrough = CapturingUploadAdapter()

    try:
        write_bambu_project(ready_probe, plate=2)
        check(
            "upload_file: проект .3mf не пакуется повторно",
            passthrough.upload_file(str(ready_probe), "ready.3mf") is True
            and passthrough.remote_name == "ready.3mf"
            and passthrough.wrapped_path == str(ready_probe)
            and passthrough._gcode_part == "Metadata/plate_2.gcode"
            and "Metadata/project_settings.config" in passthrough.entries,
            f"{passthrough.remote_name!r}, {passthrough.wrapped_path!r}, "
            f"запись={passthrough._gcode_part}, {sorted(passthrough.entries)!r}",
        )
    finally:
        ready_probe.unlink(missing_ok=True)

    ready_print = ScriptedPrintAdapter([{"result": "success"}])
    check(
        "start_print: готовый .3mf печатается project_file",
        ready_print.start_print("ready.3mf") is True
        and len(ready_print.commands) == 1
        and ready_print.commands[0]["print"]["param"] == "Metadata/plate_1.gcode"
        and ready_print.commands[0]["print"]["subtask_name"] == "ready.3mf"
        and ready_print.commands[0]["print"]["url"] == "ftp:///cache/ready.3mf",
        f"{ready_print.commands!r}",
    )

    check(
        "job_suffix: расширение из ссылки задания",
        agent_main.job_suffix("https://x.test/jobs/1.3mf?token=abc") == ".3mf"
        and agent_main.job_suffix("https://x.test/jobs/1.GCODE") == ".gcode",
        f"{agent_main.job_suffix('https://x.test/jobs/1.3mf?token=abc')!r}",
    )

    # Поздний отказ: принтер принял `project_file`, а через полминуты прислал
    # `fail`. Раньше такой отказ терялся, и задание закрывалось как `done`.
    late_failure = bambu.BambuAdapter(ip_address=CHECK_IP, api_key=CHECK_CODE)
    late_failure._report.update({"gcode_state": "IDLE", "mc_percent": 0})
    late_failure._remember_reply(
        {
            "print": {
                "command": "project_file",
                "sequence_id": "2",
                "result": "fail",
                "reason": "error string",
            }
        }
    )
    expect_status(
        "отказ команды: последний отчёт idle, а статус error",
        late_failure,
        {"status": "error", "progress": 0, "remaining_time": 0},
    )
    check(
        "отказ команды: причина в last_error",
        "error string" in (late_failure.last_error or ""),
        f"last_error={late_failure.last_error!r}",
    )

    late_failure._remember_reply(
        {
            "print": {
                "command": "project_file",
                "sequence_id": "3",
                "result": "success",
            }
        }
    )
    expect_status(
        "успешная печать снимает пометку отказа",
        late_failure,
        {"status": "idle", "progress": 0, "remaining_time": 0},
    )

    empty_report_failure = bambu.BambuAdapter(ip_address=CHECK_IP, api_key=CHECK_CODE)
    empty_report_failure._remember_reply(
        {"print": {"command": "project_file", "result": "fail", "reason": "0500-4003"}}
    )
    expect_status(
        "отказ без отчётов о печати — тоже error",
        empty_report_failure,
        {"status": "error", "progress": 0, "remaining_time": 0},
    )

    # Цикл мониторинга: отказ команды и простой без печати — `failed`, а не
    # `done 100%`, как было до правки.
    failed_print = run_monitor(
        SilentPrintAdapter(
            [{"status": "idle", "progress": 0, "remaining_time": 0}],
            "принтер отклонил project_file: error string",
        )
    )
    check(
        "monitor: причина отказа уходит в failed",
        failed_print == [("failed", 0, "принтер отклонил project_file: error string")],
        f"{failed_print!r}",
    )

    idle_print = run_monitor(
        SilentPrintAdapter(
            [{"status": "idle", "progress": 0, "remaining_time": 0}], None
        )
    )
    check(
        "monitor: idle при нулевом прогрессе — failed",
        idle_print
        == [("failed", 0, "принтер не начал печать: состояние idle, прогресс 0%")],
        f"{idle_print!r}",
    )

    done_print = run_monitor(
        SilentPrintAdapter(
            [
                {"status": "printing", "progress": 40, "remaining_time": 600},
                {"status": "idle", "progress": 100, "remaining_time": 0},
            ],
            None,
        )
    )
    check(
        "monitor: печать дошла до 100% — done",
        len(done_print) == 2
        and done_print[0] == ("printing", 40, None)
        and done_print[1] == ("done", 100, None),
        f"{done_print!r}",
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

        # Проект `.3mf` — это ZIP: оценка лежит в нарезанном G-code пластины.
        project_estimate_path = (
            Path(tempfile.gettempdir()) / "tridi-bambu-estimate.3mf"
        )

        try:
            with zipfile.ZipFile(project_estimate_path, "w") as project:
                project.writestr(
                    "Metadata/plate_1.gcode",
                    "; total estimated time: 2h 5m 3s\n"
                    "; total filament used [g] = 12.34\n",
                )

            project_estimate = gcode_metadata.read_gcode_estimate(
                project_estimate_path
            )
            check(
                "оценка из проекта .3mf: пластина внутри контейнера",
                project_estimate.seconds == 7503
                and project_estimate.filament_grams == 12.34,
                f"{project_estimate!r}",
            )
        finally:
            project_estimate_path.unlink(missing_ok=True)

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
