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
     мастерской, и ферма отличает «агент молчит» от «принтер свободен»;
  6. если в `.env` включён `SCAN_NETWORK` — один раз при старте обходит
     локальную сеть (`scan_network()` из scanner.py, шаг 7.2) и отправляет
     найденные принтеры в `POST /api/agent/discover` (`discover_farm()`):
     мастеру со ста принтерами остаётся дать им имена, а не вбивать адреса.
     Сам по себе обход в цикле опроса не повторяется — подсеть на сотни адресов
     не должна сканироваться каждые пять секунд;
  7. следит за просьбой мастера «найти принтеры в сети»:
     `handle_scan_request()` в цикле опроса читает флаг
     `workshop_settings.scan_requested` через `GET /api/agent/scan-status`,
     обходит сеть, отправляет находки и сбрасывает флаг через
     `POST /api/agent/scan-complete`.

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
from gcode_metadata import read_gcode_estimate
from scanner import scan_network, send_discovered_printers

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

# Значения, которые включают флаг из `.env`. Список строгий, а не `bool(raw)`:
# пустая строка и «false» — тоже непустые строки, и `bool()` включил бы обход
# сети там, где мастер его выключил.
TRUE_VALUES = ("1", "true", "yes", "on", "да")

# Статусы, которые принимает POST /api/agent/status (см. app/api/agent/status).
# `cancelled` — мастер нажал «Отменить печать»: сервер закрывает задание отменой,
# а не отказом, чтобы отмены не попадали в статистику поломок.
AGENT_STATUSES = ("printing", "done", "failed", "cancelled")

# Предел причины отказа: столько же ждёт колонка workshop_print_jobs.last_error.
# Полный текст ошибки остаётся в журнале агента, в мастерскую уходит начало —
# мастеру нужно понять причину, а не читать стектрейс.
STATUS_MESSAGE_MAX = 500

# Итог пульса: ok — принят, network — не дошёл из-за сети, rejected — сервер
# ответил отказом (401, 500, 503). От исхода зависит пауза до повтора: сеть ждёт
# RECONNECT_DELAY, а на отказ сервера частый повтор не помогает.
HeartbeatResult = Literal["ok", "network", "rejected"]

# Пауза между опросами принтера, пока идёт печать. Десять секунд: чаще — лишние
# запросы к принтеру, реже — мастер поздно узнаёт, что печать встала.
MONITOR_INTERVAL = 10

# Пауза перед первым опросом, то есть ожидание подтверждения старта печати.
# После команды принтер ещё разбирает файл с карты и какое-то время показывает
# `standby`/`idle`: опрос сразу принял бы это за конец печати и закрыл задание
# как `done`. Минута — с запасом на разбор большого G-code; дальше цикл идёт по
# `MONITOR_INTERVAL`, чтобы прогресс и отмену мастер видел без задержки.
PRINT_START_DELAY = 60

# Сколько опросов подряд принтер может простоять, прежде чем задание считается
# не начавшимся. Прошивка успевает показать `standby`/`idle` между приёмом
# команды и стартом нагрева, поэтому одного опроса мало: три опроса — это ещё
# полминуты запаса после `PRINT_START_DELAY`, а дальше простой уже отказ.
PRINT_START_CHECKS = 3

# Пульс мастерской: принтеры отмечаются живыми каждые 30 секунд. Вдвое чаще,
# чем ферма считает принтер офлайн (PRINTER_OFFLINE_AFTER_MS — две минуты):
# один пропущенный запрос не должен красить живую ферму в «Офлайн».
HEARTBEAT_INTERVAL = 30

# Пауза после сетевой ошибки. Короче обычного интервала: связь могла моргнуть, и
# пульс должен вернуться сразу, как только сеть появится.
RECONNECT_DELAY = 5

# Пауза между сканированиями по просьбе мастера, если обход или сброс флага не
# удался. Минута, а не пять секунд опроса: обход подсети на сотни адресов —
# дорогая операция, и повторять её на каждом цикле нельзя.
SCAN_RETRY_DELAY = 60

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
    # Обнаружение фермы (шаг 7.2): обход локальной сети при старте.
    scan_network: bool


@dataclass(frozen=True)
class PrinterSettings:
    """Принтер задания: чем с ним говорить и куда стучаться."""

    protocol_type: str
    ip_address: str
    api_key: str
    # Серийный номер нужен Bambu: топики MQTT адресуются им. Пустая строка —
    # сервер его не прислал, адаптер попробует найти номер сам.
    serial_number: str


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

    `/api/agent/tasks` отдаёт camelCase (`protocolType`, `ipAddress`, `apiKey`,
    `serialNumber`), но принимаем и snake_case — так поля называются в таблице
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
    # Серийник приходит из поля «Серийный номер (SN)» формы принтера
    # (workshop_printers.serial_number). Поле необязательное: пустая строка —
    # нормальный случай, и тогда адаптер находит номер сам (SSDP или топик).
    serial_number = (
        read_printer_field(printer, "serialNumber", "serial_number") or ""
    )

    if protocol_type is None or ip_address is None:
        return None

    return PrinterSettings(
        protocol_type=protocol_type,
        ip_address=ip_address,
        api_key=api_key,
        serial_number=serial_number,
    )


# Настройки, прочитанные в run(). Лежат в модуле, чтобы fetch_tasks() и
# send_status() оставались с сигнатурами из задачи, а `.env` читался один раз.
_settings: Settings | None = None

# Когда последний раз сканировали сеть по просьбе мастера (monotonic). Нужно,
# если сбросить флаг не удалось: агент повторит обход, но не на каждом опросе.
_requested_scan_at: float | None = None

# Последняя ошибка чтения флага. Журнал не должен повторять одну строку каждые
# пять секунд, пока мастер не применил миграцию: пишем её только при изменении.
_scan_status_error: str | None = None


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


def read_scan_flag(raw: str) -> bool:
    """
    Флаг SCAN_NETWORK из `.env`: true, 1, yes, on (и «да»).

    Незнакомое значение считается выключенным: обход сети на сотни адресов —
    осознанное действие мастера, а не побочный эффект опечатки. Значение
    пишется в журнал, чтобы «почему не сканирует» не искали по исходникам.
    """
    value = raw.strip()
    enabled = value.lower() in TRUE_VALUES

    if value and not enabled:
        logger.info("SCAN_NETWORK=%r — обнаружение фермы выключено", value)

    return enabled


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
    scan_network = read_scan_flag(os.getenv("SCAN_NETWORK", ""))

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
        scan_network=scan_network,
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


def send_status(
    job_id: str,
    status: str,
    progress: int | None = None,
    reason: str | None = None,
    estimated_seconds: int | None = None,
    filament_grams: float | None = None,
) -> bool:
    """
    Сообщает статус задания: `POST /api/agent/status`.

    Тело — `{"jobId", "status", "progress"}`. progress допускается null: тогда
    сервер не трогает проценты принтера (агент сообщил только начало печати).
    Допустимые статусы — printing, done, failed и cancelled; queued ставит
    приложение, а cancelled — ответ на просьбу мастера остановить печать.

    `reason` — причина отказа для мастера: сервер кладёт её в
    `workshop_print_jobs.last_error` и в журнал задания, поэтому карточка
    заказа показывает «G-code не загружен: …», а не просто «провалено».

    `estimated_seconds` и `filament_grams` — оценка слайсера из самого G-code
    (см. gcode_metadata.py). Приходят один раз, вместе со стартом печати:
    сервер сохраняет их в задании, и карточка показывает «≈2 ч 5 мин» и
    стоимость пластика.

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

    body: dict[str, Any] = {"jobId": job_id, "status": status, "progress": progress}

    if reason:
        body["message"] = reason[:STATUS_MESSAGE_MAX]

    if estimated_seconds is not None:
        body["estimatedSeconds"] = estimated_seconds

    if filament_grams is not None:
        body["filamentGrams"] = filament_grams

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
        "Статус задания %s: %s%s%s",
        job_id,
        status,
        f", прогресс {progress}%" if progress is not None else "",
        f", причина: {reason}" if reason else "",
    )
    return True


def fetch_cancel_request(job_id: str) -> bool:
    """
    Просьба мастера остановить печать: `GET /api/agent/status?jobId=<id>`.

    Роут отвечает `{"cancelRequested": true}`, когда в карточке заказа нажали
    «Отменить печать». False — и когда мастер ничего не просил, и когда сервер
    недоступен: гасить печать из-за сетевого сбоя нельзя. Старый сервер без
    GET-обработчика отвечает 405 — это тоже False, печать продолжается.
    """
    settings = require_settings()

    try:
        response = requests.get(
            f"{settings.crm_url}/api/agent/status",
            params={"jobId": job_id},
            headers=auth_headers(settings.agent_token),
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as error:
        log_network_error(f"Просьба об отмене задания {job_id} не прочитана", error)
        return False

    if not response.ok:
        logger.warning(
            "Просьба об отмене задания %s не прочитана: HTTP %s",
            job_id,
            response.status_code,
        )
        return False

    payload = parse_json_object(response)

    if payload is None:
        return False

    return payload.get("cancelRequested") is True


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


def discover_farm() -> bool:
    """
    Обнаружение фермы: обход локальной сети и отправка находок в CRM (шаг 7.2).

    Два повода запустить обход: флаг `SCAN_NETWORK` при старте агента и просьба
    мастера из интерфейса — кнопка «Найти принтеры в сети» поднимает
    `workshop_settings.scan_requested`, а читает её `handle_scan_request()`.
    Сам по себе обход в цикле опроса не повторяется: подсеть на сотни адресов не
    должна сканироваться каждые пять секунд.

    Пустой результат тоже отправляется: сервер по пустому списку очищает прошлые
    находки, и мастер видит, что сеть изменилась. Если принтеры есть, а находок
    нет, в журнале будет подсказка про `SCAN_SUBNETS`.

    Исключение наружу не летит: очередь печати важнее вспомогательной работы.
    True — сервер принял находки.
    """
    settings = require_settings()

    try:
        printers = scan_network()
    except Exception as error:  # noqa: BLE001 — агент не должен падать
        logger.exception("Сеть не просканирована: %s", error)
        return False

    if not printers:
        logger.warning(
            "Принтеры в сети не найдены. Если ферма в другой подсети, задайте "
            "SCAN_SUBNETS в .env (например, 10.0.0.0/24)."
        )

    return send_discovered_printers(
        printers, settings.crm_url, settings.agent_token
    )


def fetch_scan_request() -> bool:
    """
    Просьба мастера «просканировать сеть»: `GET /api/agent/scan-status`.

    Флаг ставит кнопка «Найти принтеры в сети» (Server Action
    requestNetworkScan), а не `.env`: обход нужен по требованию, а не при каждом
    старте. Ответ `{"scan_requested": true}` — можно сканировать.

    False — просьбы нет, сервер не ответил или ответ непонятен. Сканировать «на
    всякий случай» агент не должен: обход подсети на сотни адресов — работа по
    просьбе мастера.

    Отказ сервера (401, 503 без миграции) пишется в журнал один раз: иначе одна
    и та же строка повторялась бы каждые пять секунд, пока мастер не применит
    SQL. Сеть ошибку не повторяет вовсе — её уже пишет log_network_error.
    """
    global _scan_status_error

    settings = require_settings()

    try:
        response = requests.get(
            f"{settings.crm_url}/api/agent/scan-status",
            headers=auth_headers(settings.agent_token),
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as error:
        log_network_error("Запрос сканирования не прочитан", error)
        return False

    if not response.ok:
        message = f"HTTP {response.status_code}, {read_error_text(response)}"

        if message != _scan_status_error:
            _scan_status_error = message
            logger.error("Запрос сканирования не прочитан: %s", message)

        return False

    # Успешный ответ снимает прошлую ошибку: следующий сбой снова попадёт
    # в журнал, а не потеряется за старым сообщением.
    _scan_status_error = None

    payload = parse_json_object(response)

    if payload is None:
        return False

    return payload.get("scan_requested") is True


def complete_scan_request() -> bool:
    """
    Сбрасывает флаг сканирования: `POST /api/agent/scan-complete`.

    Вызывается только после того, как находки приняты сервером: неудачная
    отправка не должна терять просьбу мастера. True — сервер снял флаг.
    """
    settings = require_settings()

    try:
        response = requests.post(
            f"{settings.crm_url}/api/agent/scan-complete",
            headers=auth_headers(settings.agent_token),
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as error:
        log_network_error("Флаг сканирования не сброшен", error)
        return False

    if not response.ok:
        logger.error(
            "Флаг сканирования не сброшен: HTTP %s, %s",
            response.status_code,
            read_error_text(response),
        )
        return False

    return True


def handle_scan_request() -> None:
    """
    Сканирование по просьбе мастера — вызывается из цикла опроса.

    Кнопка «Найти принтеры в сети» в браузере не может обойти локальную сеть:
    её видит только агент. Поэтому кнопка ставит флаг на сервере, а агент
    проверяет его на каждом опросе и, если флаг поднят, запускает обход.

    Порядок: обход → отправка находок → сброс флага. Сброс идёт только после
    успешной отправки: иначе пропавшая сеть потеряла бы просьбу мастера, и он
    остался бы с пустым списком без объяснения. Повтор при неудаче — не раньше
    `SCAN_RETRY_DELAY`: обход подсети на каждом пятисекундном опросе — нагрузка
    на сеть без пользы.

    Исключение наружу не летит: очередь печати важнее вспомогательной работы.
    """
    global _requested_scan_at

    if not fetch_scan_request():
        return

    now = time.monotonic()

    if _requested_scan_at is not None and now - _requested_scan_at < SCAN_RETRY_DELAY:
        return

    _requested_scan_at = now
    logger.info("Мастер запросил сканирование сети: обход запущен")

    if not discover_farm():
        logger.warning(
            "Сканирование по запросу не отправлено: флаг остаётся, повтор через %s с",
            SCAN_RETRY_DELAY,
        )
        return

    if complete_scan_request():
        logger.info("Сканирование по запросу: находки приняты, флаг сброшен")
    else:
        logger.warning(
            "Флаг сканирования не сброшен: обход повторится через %s с",
            SCAN_RETRY_DELAY,
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


def format_duration(seconds: int | None) -> str:
    """Секунды в «2 ч 5 мин» для журнала; None — «неизвестно»."""
    if seconds is None:
        return "неизвестно"

    hours, remainder = divmod(int(seconds), 3600)
    minutes = remainder // 60

    if hours:
        return f"{hours} ч {minutes} мин"

    return f"{minutes} мин"


def read_estimate(job_id: str, local_path: Path) -> tuple[int | None, float | None]:
    """
    Оценка слайсера из скачанного G-code: (секунды, граммы пластика).

    Оценка — подсказка для карточки заказа, а не условие печати: если файл не
    открылся или слайсер оценки не писал, возвращаются None и задание
    печатается как обычно.
    """
    try:
        estimate = read_gcode_estimate(local_path)
    except OSError as error:
        logger.warning("Задание %s: оценка печати не прочитана: %s", job_id, error)
        return None, None

    if estimate.seconds is None and estimate.filament_grams is None:
        logger.info("Задание %s: в G-code нет оценки слайсера", job_id)
        return None, None

    logger.info(
        "Задание %s: оценка слайсера %s, %s г",
        job_id,
        format_duration(estimate.seconds),
        estimate.filament_grams if estimate.filament_grams is not None else "?",
    )

    return estimate.seconds, estimate.filament_grams


def job_suffix(url: str) -> str:
    """
    Расширение файла задания по ссылке: `.3mf` — готовый проект, иначе `.gcode`.

    Имя файла на карте принтера решает, пакует адаптер файл в контейнер или
    печатает как есть: `.gcode` оборачивается в `.3mf` (A1 плоский G-code не
    берёт), а готовый проект Bambu Studio уходит на печать без обёртки. Без
    этого `.3mf` скачивался бы под именем `<id>.gcode` и попадал в контейнер
    повторно — прошивка такой файл не разбирает.
    """
    path = url.split("?", 1)[0].split("#", 1)[0].lower()

    return ".3mf" if path.endswith(".3mf") else ".gcode"


def monitor_print(job_id: str, adapter: BasePrinterAdapter) -> None:
    """
    Цикл мониторинга: состояние принтера раз в `MONITOR_INTERVAL` секунд, пока
    печать не закончится.

    В CRM уходят только изменения прогресса: одинаковые проценты повторно не
    отправляются, иначе на каждую печать уходил бы лишний запрос каждые десять
    секунд. 100 % или `idle` уже после старта — печать закончена (`done`),
    `error` — печать встала (`failed`): мастер должен узнать об этом, а не ждать
    до утра.

    Причина отказа важнее статуса: если адаптер отдал `error` или оставил текст
    в `last_error` (принтер прислал `result: fail`, например `error string` на
    неразобранный файл), в CRM уходит `failed` с этим текстом. Иначе мастер
    видит «печать завершена», а на столе пусто.

    Пауза перед первым опросом обязательна: сразу после `start_print()` принтер
    ещё разбирает файл и может показывать простой, и без паузы агент принял бы
    старт за конец печати. Первая пауза — `PRINT_START_DELAY` (принтеру нужно
    время на разбор файла), дальше цикл идёт по `MONITOR_INTERVAL`.

    Печать, которая так и не началась, закрывается как `failed`, а не `done`:
    `idle` при нулевом прогрессе — это «файл не взят в работу» (принтер уже
    успел поругаться ошибкой на экране), а простой на первых опросах означает,
    что файл не разобран. Мастеру нельзя показывать изделие, которого нет.
    """
    # Уже отправленный прогресс: 0 ушёл вместе с началом печати.
    last_progress = 0
    delay = PRINT_START_DELAY
    # Появился ли хоть один признак печати: `printing` или прогресс больше нуля.
    started = False
    idle_checks = 0

    while True:
        time.sleep(delay)
        delay = MONITOR_INTERVAL

        status = adapter.get_status()
        state = read_text(status.get("status")) or ""
        progress = read_progress(status.get("progress"))

        if state == "printing" or progress > 0:
            started = True

        # Отказ принтера и причина из `last_error` важнее любого `idle`:
        # прошивка после `result: fail` (например, `error string` на
        # неразобранный файл) остаётся в простое, и раньше агент закрывал такое
        # задание как `done`. Текст причины отправляется мастеру.
        failure = read_text(adapter.last_error)

        if state == "error" or (failure and progress < 100):
            reason = failure or "принтер сообщил об ошибке печати"
            logger.error("Задание %s: печать сорвалась: %s", job_id, reason)
            send_status(job_id, "failed", progress, reason=reason)
            return

        if progress >= 100 or (started and state == "idle"):
            logger.info(
                "Задание %s: печать закончена, прогресс %d%%", job_id, progress
            )
            send_status(job_id, "done", 100)
            return

        # Просьбу мастера проверяем после «печать закончена»: если принтер уже
        # дошёл до конца, отмена опоздала и задание должно закрыться как `done`.
        if fetch_cancel_request(job_id):
            stopped = adapter.stop_print()
            logger.warning(
                "Задание %s: мастер отменил печать (%s)",
                job_id,
                "принтер остановлен" if stopped else "принтер не подтвердил остановку",
            )
            send_status(
                job_id,
                "cancelled",
                progress,
                reason=(
                    "печать отменена мастером"
                    if stopped
                    else "печать отменена мастером, но принтер не подтвердил остановку: "
                    + (adapter.last_error or "нет ответа")
                ),
            )
            return

        # Простой при нулевом прогрессе — печать не начиналась: файл принят, но
        # в работу не взят (принтер показывает ошибку на экране).
        if not started and state == "idle" and progress == 0:
            reason = "Принтер не начал печать (ошибка файла)"
            logger.error("Задание %s: %s", job_id, reason)
            send_status(job_id, "failed", 0, reason=reason)
            return

        if not started:
            # Принтер простоял весь цикл: печать не началась. Несколько опросов
            # — запас на прошивку, которая между приёмом команды и нагревом
            # показывала состояние, не похожее ни на печать, ни на простой;
            # дальше это уже отказ, а не задержка.
            idle_checks += 1

            if idle_checks < PRINT_START_CHECKS:
                logger.warning(
                    "Задание %s: принтер ещё не начал печать (%s, прогресс %d%%)",
                    job_id,
                    state,
                    progress,
                )
                continue

            reason = (
                f"принтер не начал печать: состояние {state}, прогресс {progress}%"
            )
            logger.error("Задание %s: %s", job_id, reason)
            send_status(job_id, "failed", progress, reason=reason)
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
        send_status(
            job_id,
            "failed",
            reason="в задании нет ссылки на G-code: добавьте её в товар заказа",
        )
        return

    printer = read_printer(task)

    if printer is None:
        logger.error(
            "Задание %s: у задания нет принтера с адресом и протоколом", job_id
        )
        send_status(
            job_id,
            "failed",
            reason="у задания нет принтера: выберите принтер и заполните адрес",
        )
        return

    # Расширение — из ссылки задания: `.3mf` печатается как есть, сырой G-code
    # адаптер упакует сам (см. `job_suffix`).
    remote_name = f"{job_id}{job_suffix(gcode_url)}"
    local_path = TEMP_DIR / remote_name

    # Адаптер создаём до скачивания: неизвестный протокол должен отсечься, пока
    # файл ещё не качался.
    try:
        adapter = get_adapter(
            printer.protocol_type,
            printer.ip_address,
            printer.api_key,
            printer.serial_number,
        )
    except ValueError:
        logger.error(
            "Задание %s: неизвестный протокол принтера %r",
            job_id,
            printer.protocol_type,
        )
        send_status(
            job_id,
            "failed",
            reason=f"протокол принтера {printer.protocol_type!r} неизвестен агенту",
        )
        return

    try:
        if not download_gcode(gcode_url, local_path):
            send_status(
                job_id,
                "failed",
                reason="G-code не скачан по ссылке задания: проверьте ссылку и доступ к файлу",
            )
            return

        # repr адаптера печатает только адрес: ключ принтера — секрет.
        logger.info("Задание %s: принтер %s", job_id, adapter)

        if not adapter.connect():
            logger.error(
                "Задание %s: принтер %s недоступен", job_id, printer.ip_address
            )
            send_status(
                job_id,
                "failed",
                reason=adapter.last_error
                or f"принтер {printer.ip_address} недоступен",
            )
            return

        # Оценку читаем после подключения: она нужна только для «печать
        # запущена», а лишнее чтение файла до проверки принтера замедляло бы
        # разбор отказа.
        estimated_seconds, filament_grams = read_estimate(job_id, local_path)

        if not adapter.upload_file(str(local_path), remote_name=remote_name):
            logger.error(
                "Задание %s: G-code не загружен на %s", job_id, printer.ip_address
            )
            send_status(
                job_id,
                "failed",
                reason=adapter.last_error or "G-code не загружен на принтер",
            )
            return

        # FTP-соединение к этому моменту закрыто (`upload_file` закрывает его в
        # `finally`), поэтому команда уходит сразу: принтер забирает файл с
        # собственной карты памяти.
        logger.info("[Agent] Файл загружен, отправляю команду на печать...")

        if not adapter.start_print(remote_name=remote_name):
            logger.error(
                "Задание %s: печать не запущена на %s", job_id, printer.ip_address
            )
            send_status(
                job_id,
                "failed",
                reason=adapter.last_error or "принтер не принял команду печати",
            )
            return

        logger.info("Задание %s: печать запущена на %s", job_id, printer.ip_address)
        send_status(
            job_id,
            "printing",
            0,
            estimated_seconds=estimated_seconds,
            filament_grams=filament_grams,
        )
        monitor_print(job_id, adapter)
    except NotImplementedError as error:
        # OctoPrint пока заглушка: мастер увидит причину, а агент не вылетит и
        # продолжит опрос очереди.
        logger.error("Задание %s: протокол принтера не реализован: %s", job_id, error)
        send_status(
            job_id,
            "failed",
            reason=f"протокол {printer.protocol_type} пока не реализован в агенте",
        )
    finally:
        # Bambu держит MQTT-соединение и поток paho: закрываем его здесь, иначе
        # на каждый принтер копился бы живой сокет до выхода из процесса.
        adapter.close()
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

    # Обнаружение фермы (шаг 7.2) — до пульса и до очереди: сканирование один
    # раз при старте, поэтому мастеру видно список принтеров сразу после
    # запуска агента, а цикл опроса не ждёт обхода сети.
    if settings.scan_network:
        if discover_farm():
            logger.info("Обнаружение фермы: находки ушли в мастерскую")
        else:
            logger.warning(
                "Обнаружение фермы не удалось: агент продолжит опрос очереди"
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
            # Просьба мастера «найти принтеры в сети» проверяется на каждом
            # опросе, но сам обход — не чаще SCAN_RETRY_DELAY: кнопка в
            # интерфейсе ставит флаг, а не сканирует из браузера.
            try:
                handle_scan_request()
            except Exception as error:  # noqa: BLE001 — агент не должен падать
                logger.exception("Запрос сканирования не обработан: %s", error)

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

