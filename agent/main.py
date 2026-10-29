"""
Локальный агент 3D-фермы TriDi: опрос очереди печати.

Агент живёт на компьютере мастера, рядом с принтерами. У него нет ни cookie
сессии Supabase, ни клиента service_role: мастерскую определяет персональный
`AGENT_TOKEN` (uuid из `workshop_settings.agent_token`, см. lib/agent-auth.ts).
Токен уходит только в заголовке `Authorization: Bearer <token>` — не в URL и
не в журнал: по нему открывается очередь мастерской вместе с ключами принтеров.

Что делает агент:
  1. раз в `POLL_INTERVAL` секунд спрашивает `GET /api/agent/tasks` — что
     мастерская поставила в очередь (шаг 4.1);
  2. пишет в журнал, сколько задач пришло, и перечисляет их;
  3. обрабатывает задания по одному (`process_task()`, шаг 4.4): скачивает
     G-code по `gcodeUrl` в `agent/temp/`, создаёт адаптер принтера через
     фабрику, загружает файл, запускает печать и ждёт её окончания;
  4. сообщает статус печати через `send_status()` — `POST /api/agent/status`:
     `printing` с прогрессом, `done` или `failed`;
  5. каждые `HEARTBEAT_INTERVAL` секунд отправляет пульс (`send_heartbeat()`,
     `POST /api/agent/heartbeat`): сервер отмечает `last_seen_at` у принтеров
     мастерской, и ферма отличает «агент молчит» от «принтер свободен».

Задания обрабатываются последовательно: пока идёт цикл мониторинга, агент не
запрашивает новые задачи — иначе два G-code ушли бы на разные принтеры сразу, а
прогресс и статусы перепутались бы. Пульс идёт отдельным потоком и не ждёт
окончания печати: одно задание печатается часами.

Сеть упала, сервер ответил 503 или не ответил вовсе — агент не вылетает:
обрыв (`ConnectionError`) и таймаут уходят в журнал строкой «Сетевая ошибка,
переподключение...», пульс повторяется через `RECONNECT_DELAY` секунд, а цикл
опроса дожидается следующего интервала. Для фермы это важнее, чем «упасть и
перезапуститься»: остановленный агент означает принтеры, которые стоят без
задания и о поломке никто не узнает.

Запуск: `python main.py`. Переменные читаются из `.env` рядом с этим файлом
(образец — `.env.example`, установка зависимостей — README.md).
"""
from __future__ import annotations

import logging
import os
import sys
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import requests
from dotenv import load_dotenv

from adapters.base import BasePrinterAdapter
from adapters.factory import get_adapter

# `.env` ищем рядом с main.py, а не от текущей папки: агента запускают и из
# своего каталога, и планировщиком из любого другого места.
ENV_PATH = Path(__file__).resolve().parent / ".env"

# Временные G-коды заданий: папка в `.gitignore`, файл удаляется после печати.
TEMP_DIR = Path(__file__).resolve().parent / "temp"

# Журнал в консоль: дата, время, уровень и сообщение.
LOG_FORMAT = "%(asctime)s | %(levelname)-7s | %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Сколько ждать ответа сервера. Без таймаута requests может ждать вечно, и цикл
# опроса встанет вместе с сетью — агент будет выглядеть живым, но замолчит.
REQUEST_TIMEOUT = 10

# Пауза между опросами, если POLL_INTERVAL пуст или испорчен.
DEFAULT_POLL_INTERVAL = 5

# Статусы, которые принимает POST /api/agent/status (см. app/api/agent/status).
AGENT_STATUSES = ("printing", "done", "failed")

# Итог пульса: ok — принят, network — не дошёл из-за сети, rejected — сервер
# ответил отказом (401, 500, 503). От исхода зависит пауза до повтора: сеть ждёт
# RECONNECT_DELAY, а на отказ сервера частый повтор не помогает.
HeartbeatResult = Literal["ok", "network", "rejected"]

# Пауза между опросами принтера, пока идёт печать. Десять секунд: чаще — лишние
# запросы к принтеру, реже — мастер поздно узнаёт, что печать встала.
MONITOR_INTERVAL = 10

# Пульс мастерской: принтеры отмечаются живыми каждые 30 секунд. Вдвое чаще,
# чем ферма считает принтер офлайн (PRINTER_OFFLINE_AFTER_MS — две минуты):
# один пропущенный запрос не должен красить живую ферму в «Офлайн».
HEARTBEAT_INTERVAL = 30

# Пауза после сетевой ошибки. Короче обычного интервала: связь могла моргнуть, и
# пульс должен вернуться сразу, как только сеть появится.
RECONNECT_DELAY = 5

# Кусок G-code при скачивании: файл на десятки мегабайт не должен оказаться в
# памяти целиком.
DOWNLOAD_CHUNK_SIZE = 64 * 1024

logger = logging.getLogger("agent")


@dataclass(frozen=True)
class Settings:
    """Прочитанная конфигурация агента."""

    crm_url: str
    agent_token: str
    poll_interval: int


@dataclass(frozen=True)
class PrinterSettings:
    """Принтер задания: чем с ним говорить и куда стучаться."""

    protocol_type: str
    ip_address: str
    api_key: str


def read_text(value: Any) -> str | None:
    """Непустая строка из поля ответа сервера; None — поля нет, пусто или не строка."""
    if isinstance(value, str):
        text = value.strip()

        if text:
            return text

    return None


def read_printer_field(
    printer: dict[str, Any], camel_name: str, snake_name: str
) -> str | None:
    """
    Поле принтера из задания.

    `/api/agent/tasks` отдаёт camelCase (`protocolType`, `ipAddress`, `apiKey`),
    но принимаем и snake_case — так поля называются в таблице
    `workshop_printers`, и ответ, собранный вручную, не должен ронять агента.
    """
    return read_text(printer.get(camel_name)) or read_text(printer.get(snake_name))


def read_printer(task: dict[str, Any]) -> PrinterSettings | None:
    """
    Принтер задания. None — печатать некуда: нет объекта, адреса или протокола.

    Без адреса адаптер не создать, без протокола фабрика бросит ValueError.
    Угадывать протокол нельзя: G-code уйдёт не на тот порт, и мастер будет
    искать причину на принтере, а не в настройках. Ключ доступа может быть
    пустым — в локальной сети часть протоколов работает без него.
    """
    printer = task.get("printer")

    if not isinstance(printer, dict):
        return None

    protocol_type = read_printer_field(printer, "protocolType", "protocol_type")
    ip_address = read_printer_field(printer, "ipAddress", "ip_address")
    api_key = read_printer_field(printer, "apiKey", "api_key") or ""

    if protocol_type is None or ip_address is None:
        return None

    return PrinterSettings(
        protocol_type=protocol_type,
        ip_address=ip_address,
        api_key=api_key,
    )


# Настройки, прочитанные в run(). Лежат в модуле, чтобы fetch_tasks() и
# send_status() оставались с сигнатурами из задачи, а `.env` читался один раз.
_settings: Settings | None = None


def setup_logging() -> None:
    """Включает журнал в консоль: дата, время, уровень и сообщение."""
    # errors="replace": русский текст в консоли Windows (cp866) не должен валить
    # агента на символе, которого в кодировке нет.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)

        if reconfigure is not None:
            reconfigure(errors="replace")

    logging.basicConfig(
        level=logging.INFO,
        format=LOG_FORMAT,
        datefmt=LOG_DATE_FORMAT,
        stream=sys.stdout,
    )


def read_poll_interval(raw: str) -> int:
    """Интервал опроса из `.env`: целое число секунд, иначе значение по умолчанию."""
    value = raw.strip()

    if not value:
        return DEFAULT_POLL_INTERVAL

    try:
        interval = int(value)
    except ValueError:
        logger.warning(
            "POLL_INTERVAL=%r — не целое число, беру %s с",
            value,
            DEFAULT_POLL_INTERVAL,
        )
        return DEFAULT_POLL_INTERVAL

    if interval < 1:
        logger.warning(
            "POLL_INTERVAL=%s меньше секунды, беру %s с",
            interval,
            DEFAULT_POLL_INTERVAL,
        )
        return DEFAULT_POLL_INTERVAL

    return interval


def load_settings() -> Settings | None:
    """
    Читает `.env` (и уже заданные переменные окружения) в Settings.

    None — запускаться бессмысленно: без адреса CRM идти некуда, без токена
    сервер отвечает 401. Такие ошибки видно сразу при старте, а не через час
    пустого журнала. Значение токена в журнал не попадает — только длина:
    журнал агента может уехать в переписку или тикет.
    """
    load_dotenv(ENV_PATH)

    crm_url = os.getenv("CRM_URL", "").strip().rstrip("/")
    agent_token = os.getenv("AGENT_TOKEN", "").strip()
    poll_interval = read_poll_interval(os.getenv("POLL_INTERVAL", ""))

    valid = True

    if not crm_url:
        logger.error("CRM_URL не задан: добавьте его в %s", ENV_PATH)
        valid = False
    elif not crm_url.startswith(("http://", "https://")):
        logger.error(
            "CRM_URL=%r должен начинаться с http:// или https://", crm_url
        )
        valid = False

    if not agent_token:
        logger.error(
            "AGENT_TOKEN не задан: скопируйте токен из настроек мастерской в %s",
            ENV_PATH,
        )
        valid = False
    else:
        try:
            uuid.UUID(agent_token)
        except ValueError:
            # Сервер проверяет токен как uuid и на мусор отвечает 401, поэтому
            # незаполненный образец из .env.example лучше поймать здесь.
            logger.error(
                "AGENT_TOKEN (длина %s) не похож на uuid: сервер ответит 401. "
                "Скопируйте ключ из настроек мастерской целиком.",
                len(agent_token),
            )
            valid = False

    if not valid:
        return None

    return Settings(
        crm_url=crm_url,
        agent_token=agent_token,
        poll_interval=poll_interval,
    )


def require_settings() -> Settings:
    """Настройки для запросов. Вызывается только после load_settings()."""
    if _settings is None:
        raise RuntimeError(
            "Настройки не загружены: вызовите load_settings() до запросов."
        )

    return _settings


def auth_headers(token: str) -> dict[str, str]:
    """Заголовки запроса: токен только здесь — в URL он попал бы в журналы."""
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }


def read_error_text(response: requests.Response) -> str:
    """Текст ошибки от роутов TriDi: они отвечают `{"error": "..."}`."""
    try:
        payload = response.json()
    except ValueError:
        return response.text[:200].strip() or "(пустой ответ)"

    if isinstance(payload, dict) and isinstance(payload.get("error"), str):
        return payload["error"]

    return response.text[:200].strip() or "(пустой ответ)"


def parse_json_object(response: requests.Response) -> dict[str, Any] | None:
    """Тело ответа как JSON-объект. None — не JSON или не объект (уже в журнале)."""
    try:
        payload = response.json()
    except ValueError:
        logger.warning("Ответ сервера — не JSON: %s", response.text[:200].strip())
        return None

    if not isinstance(payload, dict):
        logger.warning("Ответ сервера — не JSON-объект: %s", str(payload)[:200])
        return None

    return payload


def log_network_error(action: str, error: requests.RequestException) -> None:
    """
    Сетевая ошибка — в журнал, а не наружу: агент продолжает работу.

    `ConnectionError` и таймаут — это пропавшая сеть, а не отказ приложения и не
    поломка принтера. Строка «Сетевая ошибка, переподключение...» подсказывает
    мастеру, что делать ничего не нужно: агент повторит запрос сам. Остальные
    отказы requests (например, неверный CRM_URL) — ошибка настройки, её пишем
    как обычную ошибку.

    Исключение не выпускается: на ферме падение агента дороже неудачного запроса.
    """
    if isinstance(error, (requests.ConnectionError, requests.Timeout)):
        logger.warning("Сетевая ошибка, переподключение... %s: %s", action, error)
        return

    logger.error("%s: %s", action, error)


def fetch_tasks() -> list[dict[str, Any]]:
    """
    Очередь печати мастерской: `GET /api/agent/tasks`.

    Возвращает список заданий в формате роута (id, orderId, gcodeUrl, printer…
    см. app/api/agent/tasks/route.ts). Пустой список — «печатать нечего» или
    временная ошибка, которая уже записана в журнал: для вызывающего кода это
    одно и то же — ждать следующего опроса.

    Сетевые ошибки (нет сети, таймаут, обрыв) не бросаются наружу: агент должен
    дожить до следующего интервала.
    """
    settings = require_settings()

    try:
        response = requests.get(
            f"{settings.crm_url}/api/agent/tasks",
            headers=auth_headers(settings.agent_token),
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as error:
        log_network_error("Очередь не запрошена", error)
        return []

    if response.status_code == 401:
        logger.error(
            "Сервер не принял AGENT_TOKEN (401): проверьте ключ в настройках "
            "мастерской — он мог смениться."
        )
        return []

    if not response.ok:
        logger.error(
            "Очередь не прочитана: HTTP %s, %s",
            response.status_code,
            read_error_text(response),
        )
        return []

    payload = parse_json_object(response)

    if payload is None:
        return []

    tasks = payload.get("tasks")

    if not isinstance(tasks, list):
        logger.warning("В ответе нет списка tasks — пропускаю опрос")
        return []

    # Ответ сервера считаем недоверенным: в список берём только объекты.
    return [task for task in tasks if isinstance(task, dict)]


def send_status(job_id: str, status: str, progress: int | None = None) -> bool:
    """
    Сообщает статус задания: `POST /api/agent/status`.

    Тело — `{"jobId", "status", "progress"}`. progress допускается null: тогда
    сервер не трогает проценты принтера (агент сообщил только начало печати).
    Допустимые статусы — printing, done, failed; queued ставит приложение.

    True — сервер записал статус. False — не записал (сеть, 400, 401, 500):
    исключение наружу не летит, вызывающий код решает, повторить ли позже.
    Повтор с тем же статусом безопасен: роут пишет значения целиком, а не
    приращивает их.
    """
    settings = require_settings()

    if status not in AGENT_STATUSES:
        logger.error(
            "status=%r не поддерживается: допустимы %s",
            status,
            ", ".join(AGENT_STATUSES),
        )
        return False

    body = {"jobId": job_id, "status": status, "progress": progress}

    try:
        response = requests.post(
            f"{settings.crm_url}/api/agent/status",
            headers=auth_headers(settings.agent_token),
            json=body,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as error:
        log_network_error(f"Статус задания {job_id} не отправлен", error)
        return False

    if not response.ok:
        logger.error(
            "Статус задания %s не принят: HTTP %s, %s",
            job_id,
            response.status_code,
            read_error_text(response),
        )
        return False

    logger.info(
        "Статус задания %s: %s%s",
        job_id,
        status,
        f", прогресс {progress}%" if progress is not None else "",
    )
    return True


def send_heartbeat(reset_errors: bool = False) -> HeartbeatResult:
    """
    Пульс мастерской: `POST /api/agent/heartbeat`.

    Сервер отмечает `last_seen_at` у всех принтеров мастерской, поэтому вкладка
    «Принтеры» знает, что агент жив, даже когда очередь пуста и печать не идёт.

    reset_errors=True — только при старте: принтеры, оставшиеся в `error` после
    прошлого сбоя (упал агент, пропала сеть), возвращаются в `idle`
    (см. app/api/agent/heartbeat/route.ts).

    Исключение наружу не летит: сеть даёт `network`, отказ сервера — `rejected`;
    когда повторить, решает вызывающий код.
    """
    settings = require_settings()

    try:
        response = requests.post(
            f"{settings.crm_url}/api/agent/heartbeat",
            headers=auth_headers(settings.agent_token),
            json={"resetErrors": reset_errors},
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as error:
        log_network_error("Пульс не отправлен", error)
        return "network"

    if response.status_code == 401:
        logger.error(
            "Сервер не принял AGENT_TOKEN (401): пульс не отправлен. Проверьте "
            "ключ в настройках мастерской — он мог смениться."
        )
        return "rejected"

    if not response.ok:
        logger.error(
            "Пульс не принят: HTTP %s, %s",
            response.status_code,
            read_error_text(response),
        )
        return "rejected"

    return "ok"


def heartbeat_loop(stop_event: threading.Event) -> None:
    """
    Пульс раз в `HEARTBEAT_INTERVAL` секунд, независимо от очереди и печати.

    Поток живёт рядом с главным циклом, а не внутри него: пока идёт печать,
    `run()` стоит в `monitor_print()` и отправить пульс не может. Любая ошибка
    уже в журнале, поэтому цикл не выходит: следующий запрос уйдёт по расписанию.

    `stop_event.wait()` вместо `time.sleep()`: Ctrl+C не должен ждать до
    тридцати секунд. Пауза зависит от исхода — сеть ждёт `RECONNECT_DELAY`
    (вернуться сразу, как только связь появится), отказ сервера — обычный
    интервал: частый повтор 401 или 503 ничего не исправит.
    """
    while not stop_event.is_set():
        try:
            result = send_heartbeat()
        except Exception as error:  # noqa: BLE001 — поток не должен умирать
            # Сломанный разбор ответа или неожиданное исключение не должны тихо
            # выключить пульс: ферма тогда навсегда покажет «Офлайн».
            logger.exception("Пульс не отправлен: %s", error)
            stop_event.wait(RECONNECT_DELAY)
            continue

        stop_event.wait(
            RECONNECT_DELAY if result == "network" else HEARTBEAT_INTERVAL
        )


def log_task(task: dict[str, Any]) -> None:
    """
    Строка журнала о задании.

    Печатать агент пока не умеет (адаптеры — следующие шаги), но мастеру уже
    видно, что очередь действительно пришла: какое задание, какой заказ и на
    каком принтере его ждут.
    """
    job_id = task.get("id") or "?"
    printer = task.get("printer")
    order = task.get("order")

    printer_name = (
        printer.get("name") if isinstance(printer, dict) else None
    ) or "принтер не назначен"
    order_title = (order.get("title") if isinstance(order, dict) else None) or "—"

    logger.info("  задание %s | заказ: %s | %s", job_id, order_title, printer_name)


def remove_temp_file(path: Path) -> None:
    """Удаляет временный G-code. Отсутствие файла — не ошибка, а норма."""
    try:
        path.unlink(missing_ok=True)
    except OSError as error:
        # Диск занят или файл держит другой процесс: мешает только мусор на
        # диске, поэтому агент продолжает работу.
        logger.warning("Временный файл %s не удалён: %s", path, error)


def download_gcode(url: str, destination: Path) -> bool:
    """
    Скачивает G-code задания в `destination`.

    True — файл на диске и не пуст. False — причина уже в журнале: HTTP-ошибка,
    обрыв сети, нет прав на запись. Адрес не пишем: `gcodeUrl` — подписанная
    ссылка на хранилище, ей нечего делать в журнале, который уедет в тикет.

    `stream=True`: G-code весит десятки мегабайт, держать его целиком в памяти
    незачем — пишем кусками.
    """
    try:
        with requests.get(url, stream=True, timeout=REQUEST_TIMEOUT) as response:
            if not response.ok:
                logger.error(
                    "G-code не скачан: HTTP %s, %s",
                    response.status_code,
                    read_error_text(response),
                )
                return False

            destination.parent.mkdir(parents=True, exist_ok=True)

            size = 0

            with destination.open("wb") as file:
                for chunk in response.iter_content(chunk_size=DOWNLOAD_CHUNK_SIZE):
                    if chunk:
                        file.write(chunk)
                        size += len(chunk)
    except requests.RequestException as error:
        log_network_error("G-code не скачан", error)
        return False
    except OSError as error:
        logger.error("G-code не записан в %s: %s", destination, error)
        return False

    if size == 0:
        # Пустой файл принтер примет, но печатать нечего — лучше failed сразу.
        logger.error("По ссылке задания пришёл пустой G-code")
        return False

    logger.info("G-code скачан: %s (%d КБ)", destination.name, size // 1024)
    return True


def read_progress(value: Any) -> int:
    """Прогресс из ответа адаптера: целые проценты 0…100; мусор — 0."""
    # bool — подкласс int, но True в поле прогресса означает ошибку разбора.
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0

    return min(max(round(value), 0), 100)


def monitor_print(job_id: str, adapter: BasePrinterAdapter) -> None:
    """
    Цикл мониторинга: состояние принтера раз в `MONITOR_INTERVAL` секунд, пока
    печать не закончится.

    В CRM уходят только изменения прогресса: одинаковые проценты повторно не
    отправляются, иначе на каждую печать уходил бы лишний запрос каждые десять
    секунд. `idle` или 100 % — печать закончена (`done`), `error` — печать
    встала (`failed`): мастер должен узнать об этом, а не ждать до утра.

    Пауза перед первым опросом обязательна: сразу после `start_print()` принтер
    ещё показывает `standby`, и без паузы агент принял бы старт за конец печати.
    """
    # Уже отправленный прогресс: 0 ушёл вместе с началом печати.
    last_progress = 0

    while True:
        time.sleep(MONITOR_INTERVAL)

        status = adapter.get_status()
        state = read_text(status.get("status")) or ""
        progress = read_progress(status.get("progress"))

        if state == "error":
            logger.error("Задание %s: принтер сообщил об ошибке печати", job_id)
            send_status(job_id, "failed")
            return

        if state == "idle" or progress >= 100:
            logger.info(
                "Задание %s: печать закончена, прогресс %d%%", job_id, progress
            )
            send_status(job_id, "done")
            return

        if state != "printing":
            # Незнакомое состояние — не повод закрывать задание: печать может
            # идти, а протокол просто назвал её иначе. Ждём следующего опроса.
            logger.warning(
                "Задание %s: неизвестное состояние %r — продолжаю опрос",
                job_id,
                state,
            )
            continue

        if progress != last_progress:
            logger.info("Задание %s: прогресс %d%%", job_id, progress)
            send_status(job_id, "printing", progress)
            last_progress = progress


def process_task(task: dict[str, Any]) -> None:
    """
    Одно задание очереди целиком: скачать G-code, загрузить на принтер,
    запустить печать и дождаться её окончания.

    Возвращает управление только когда задание закрыто или сорвалось: поэтому
    run() не забирает новые задачи, пока идёт печать, — иначе агент начал бы
    вторую печать, а прогресс и статусы перепутались бы.

    Любая неудача — `send_status(job_id, "failed")` и запись в журнал: заказ
    вернётся мастеру на Канбан, а агент останется жив.
    """
    job_id = read_text(task.get("id"))

    if job_id is None:
        # Без jobId отправить статус некуда: сервер ответит 400.
        logger.error("Задание без id пропущено: %r", task)
        return

    # Поле называется gcodeUrl; gcode_url принимаем на случай ручного ответа.
    gcode_url = read_text(task.get("gcodeUrl")) or read_text(task.get("gcode_url"))

    if gcode_url is None:
        logger.error("Задание %s: нет gcodeUrl — печатать нечего", job_id)
        send_status(job_id, "failed")
        return

    printer = read_printer(task)

    if printer is None:
        logger.error(
            "Задание %s: у задания нет принтера с адресом и протоколом", job_id
        )
        send_status(job_id, "failed")
        return

    remote_name = f"{job_id}.gcode"
    local_path = TEMP_DIR / remote_name

    # Адаптер создаём до скачивания: неизвестный протокол должен отсечься, пока
    # файл ещё не качался.
    try:
        adapter = get_adapter(
            printer.protocol_type,
            printer.ip_address,
            printer.api_key,
        )
    except ValueError:
        logger.error(
            "Задание %s: неизвестный протокол принтера %r",
            job_id,
            printer.protocol_type,
        )
        send_status(job_id, "failed")
        return

    try:
        if not download_gcode(gcode_url, local_path):
            send_status(job_id, "failed")
            return

        # repr адаптера печатает только адрес: ключ принтера — секрет.
        logger.info("Задание %s: принтер %s", job_id, adapter)

        if not adapter.connect():
            logger.error(
                "Задание %s: принтер %s недоступен", job_id, printer.ip_address
            )
            send_status(job_id, "failed")
            return

        if not adapter.upload_file(str(local_path), remote_name=remote_name):
            logger.error(
                "Задание %s: G-code не загружен на %s", job_id, printer.ip_address
            )
            send_status(job_id, "failed")
            return

        if not adapter.start_print(remote_name=remote_name):
            logger.error(
                "Задание %s: печать не запущена на %s", job_id, printer.ip_address
            )
            send_status(job_id, "failed")
            return

        logger.info("Задание %s: печать запущена на %s", job_id, printer.ip_address)
        send_status(job_id, "printing", 0)
        monitor_print(job_id, adapter)
    except NotImplementedError as error:
        # OctoPrint и Bambu пока заглушки: мастер увидит причину, а агент не
        # вылетит и продолжит опрос очереди.
        logger.error("Задание %s: протокол принтера не реализован: %s", job_id, error)
        send_status(job_id, "failed")
    finally:
        remove_temp_file(local_path)


def poll_once() -> list[dict[str, Any]]:
    """
    Один опрос очереди: задачи плюс запись в журнал.

    Исключения не выпускает: неожиданный ответ сервера или сломанный разбор не
    должны останавливать агента на ферме.
    """
    try:
        tasks = fetch_tasks()
    except Exception as error:  # noqa: BLE001 — агент не должен падать
        logger.exception("Очередь не прочитана: %s", error)
        return []

    if not tasks:
        return []

    logger.info("Получено %d задач", len(tasks))

    for task in tasks:
        log_task(task)

    return tasks


def run() -> int:
    """
    Главный цикл: опрос очереди, затем печать заданий по одному.

    Пока `process_task()` не вернул управление, новых задач агент не забирает:
    очередь читается только после того, как печать закрыта.

    Пульс мастерской идёт отдельным потоком (`heartbeat_loop()`), поэтому он не
    зависит ни от очереди, ни от длительности печати.

    Возвращает код выхода: 0 — остановлено вручную (Ctrl+C), 1 — нет
    конфигурации, поэтому агент не запущен.
    """
    global _settings

    settings = load_settings()

    if settings is None:
        logger.error(
            "Агент не запущен: заполните %s по образцу .env.example", ENV_PATH
        )
        return 1

    _settings = settings

    logger.info(
        "Агент запущен: %s, интервал опроса %s с",
        settings.crm_url,
        settings.poll_interval,
    )

    # Первый пульс — со сбросом прошлых ошибок: принтер, оставшийся в `error`
    # после падения агента или сети, снова в работе. Дальше пульс идёт без
    # сброса, иначе настоящая ошибка печати стиралась бы каждые полминуты.
    if send_heartbeat(reset_errors=True) == "ok":
        logger.info("Пульс отправлен: принтеры мастерской отмечены живыми")

    # Пульс живёт в отдельном потоке: одно задание печатается часами, и главный
    # цикл в это время стоит в monitor_print(). Демон — Ctrl+C не ждёт пульса.
    stop_heartbeat = threading.Event()
    heartbeat = threading.Thread(
        target=heartbeat_loop,
        args=(stop_heartbeat,),
        name="heartbeat",
        daemon=True,
    )
    heartbeat.start()

    try:
        while True:
            tasks = poll_once()

            # Строго по одному и до конца печати: process_task() не возвращает
            # управление, пока цикл мониторинга не закроет задание, поэтому
            # новые задачи не запрашиваются, пока принтер занят.
            for task in tasks:
                try:
                    process_task(task)
                except Exception as error:  # noqa: BLE001 — агент не должен падать
                    # Сбой одного задания не должен останавливать ферму.
                    logger.exception("Задание не обработано: %s", error)

            time.sleep(settings.poll_interval)
    except KeyboardInterrupt:
        logger.info("Агент остановлен")
        return 0
    finally:
        # Поток ждёт события, а не sleep: остановка не занимает до 30 секунд.
        stop_heartbeat.set()


def main() -> int:
    """Точка входа: журнал, затем цикл опроса."""
    setup_logging()
    return run()


if __name__ == "__main__":
    sys.exit(main())

