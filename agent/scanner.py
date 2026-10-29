"""
Сканер локальной сети: мастер подключения фермы (шаг 7.2).

Мастеру со ста принтерами не вбить парк руками. Агент обходит подсеть, находит
Moonraker (порт 7125) и OctoPrint (80/443) и отдаёт список в CRM через
`POST /api/agent/discover`. Сервер складывает находки в
`workshop_discovered_printers` (миграция `supabase/workshop_farm_and_shop.sql`),
мастер даёт им имена в интерфейсе, и принтеры переезжают в парк мастерской.

Почему сканер на стандартной библиотеке: подсеть — это сотни соединений по
таймауту в доли секунды. `socket.connect_ex` в потоках дешевле, чем `requests`
с его сессией и разбором заголовков на каждый адрес, а `urllib.request` из
стандартной библиотеки хватает для двух GET-запросов проверки. `requests`
остался только в `send_discovered_printers()`: отправка в CRM повторяет стиль
main.py — те же таймаут и разбор ошибок, что у статусов и пульса.

Bambu (MQTT 8883) не сканируется: там TLS с самоподписанным сертификатом, а код
доступа печатается на экране принтера. «Найден» без проверки протокола обещал бы
мастеру больше, чем сеть знает.
"""
from __future__ import annotations

import ipaddress
import json
import logging
import os
import socket
import ssl
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import requests

# Порт Moonraker (Klipper) и веб-порты OctoPrint: по ним мастер и отличает
# принтер от роутера.
MOONRAKER_PORT = 7125
OCTOPRINT_PORTS = (80, 443)

# Адреса, где стоят почти все домашние и цеховые роутеры. Нужны, когда
# локальный интерфейс определить не удалось (нет маршрута по умолчанию,
# машина без сети), — иначе сканировать нечего.
DEFAULT_SUBNETS = ("192.168.1.0/24", "192.168.0.0/24")

# Маска автоопределения: адрес интерфейса → подсеть. Восемь бит — типичная
# настройка домашнего роутера; 10.0.0.5/8 иначе означало бы 16 миллионов
# адресов, а ферма живёт в одной подсети. Другую маску задают в SCAN_SUBNETS.
LOCAL_PREFIX = 24

# Сколько ждать открытия порта. Живой хост в локальной сети отвечает за
# миллисекунды, а выключенный адрес не должен растягивать обход.
PORT_TIMEOUT = 0.3

# Сколько ждать HTTP-ответа после открытого порта: Klipper отвечает сразу, а
# страница OctoPrint на медленной плате грузится пару секунд.
HTTP_TIMEOUT = 2.0

# Сколько ждать CRM, когда находки уже собраны. Как REQUEST_TIMEOUT в main.py:
# сеть пропала — агент не должен висеть на отправке.
REQUEST_TIMEOUT = 10

# Потоков на подсеть /24: 64 соединения параллельно обходят 254 адреса за
# считанные секунды и не забивают таблицу соединений роутера.
MAX_WORKERS = 64

# Предел адресов за одно сканирование. /22 — это 1022 адреса; всё шире уже
# ошибка в SCAN_SUBNETS, а не ферма.
MAX_HOSTS = 1024

# Сколько читать тело ответа при поиске подписи OctoPrint: название лежит в
# заголовке страницы, мегабайты картинок и скриптов не нужны.
MAX_BODY_BYTES = 64 * 1024

# Явный список подсетей через запятую: цех может жить в 10.0.0.0/24 или в
# нескольких VLAN, а автоопределение смотрит только сеть интерфейса по
# умолчанию.
SUBNETS_ENV = "SCAN_SUBNETS"

logger = logging.getLogger("agent.scanner")

# Контекст HTTPS создаётся один раз: он нужен каждой пробе порта 443.
_https_context: ssl.SSLContext | None = None


def local_ip_address() -> str | None:
    """
    Адрес машины в локальной сети: тот интерфейс, через который идёт интернет.

    UDP-сокет пакетов не отправляет: `connect()` для UDP только выбирает
    маршрут по таблице маршрутизации, ответа ждать не нужно, и чужой сервер
    ничего не получает. `getsockname()` после этого отдаёт локальный адрес
    выбранного интерфейса — именно в этой сети стоят принтеры.

    None — маршрута по умолчанию нет (машина без сети, изолированный цех).
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    try:
        sock.settimeout(1.0)
        sock.connect(("8.8.8.8", 80))
        address = sock.getsockname()[0]
    except OSError:
        return None
    finally:
        sock.close()

    return address if isinstance(address, str) else None


def hostname_ip_address() -> str | None:
    """
    Адрес из имени машины — запасной путь.

    На машине без маршрута по умолчанию (или с заблокированным 8.8.8.8)
    `socket.gethostname()` всё равно знает свой адрес из hosts и DNS. Это
    может оказаться адрес виртуального адаптера (VMware, Hyper-V) — поэтому
    результат проверяется на приватность в `mask_to_network()`.
    """
    try:
        return socket.gethostbyname(socket.gethostname())
    except OSError:
        return None


def mask_to_network(address: str | None) -> ipaddress.IPv4Network | None:
    """
    Адрес интерфейса → подсеть /24. None — адрес не годен для обхода.

    Петлевой и канальный адреса пропускаются: 127.0.0.1 — это сам агент, а
    169.254.x.x значит «DHCP не ответил», и принтеров там нет. Публичный адрес
    тоже отбрасывается: интерфейс смотрит в интернет, а обход чужой сети на
    сотни адресов — это уже не обнаружение фермы.
    """
    if not address:
        return None

    try:
        ip = ipaddress.IPv4Address(address)
    except ValueError:
        return None

    if ip.is_loopback or ip.is_link_local or not ip.is_private:
        return None

    return ipaddress.IPv4Network(f"{ip}/{LOCAL_PREFIX}", strict=False)


def detect_local_subnet() -> ipaddress.IPv4Network | None:
    """
    Подсеть машины агента: сначала маршрут по умолчанию, затем имя хоста.

    None — определить не удалось, вызывающий код берёт DEFAULT_SUBNETS.
    """
    for candidate in (local_ip_address(), hostname_ip_address()):
        network = mask_to_network(candidate)

        if network is not None:
            logger.info("Локальная подсеть: %s", network)
            return network

    return None


def read_env_subnets() -> list[ipaddress.IPv4Network] | None:
    """
    Подсети из `SCAN_SUBNETS` (`192.168.1.0/24, 10.0.0.0/24`). None — не задано.

    Адрес без маски (`192.168.1.0`) читается как /24: мастер, заполняющий .env,
    редко пишет префикс, а /32 сканировал бы один адрес роутера. Испорченная
    запись пропускается с предупреждением и не отменяет остальные: одна
    опечатка не должна оставлять ферму без обнаружения.
    """
    raw = os.getenv(SUBNETS_ENV, "").strip()

    if not raw:
        return None

    networks: list[ipaddress.IPv4Network] = []

    for part in raw.replace(";", ",").split(","):
        candidate = part.strip()

        if not candidate:
            continue

        if "/" not in candidate:
            candidate = f"{candidate}/{LOCAL_PREFIX}"

        try:
            networks.append(ipaddress.IPv4Network(candidate, strict=False))
        except ValueError:
            logger.warning(
                "%s: %r — не подсеть вида 192.168.1.0/24, пропускаю",
                SUBNETS_ENV,
                part.strip(),
            )

    return networks or None


def resolve_scan_networks() -> list[ipaddress.IPv4Network]:
    """
    Что сканировать: `SCAN_SUBNETS`, затем автоопределение, затем стандарт.

    Порядок сознательный. Явная настройка главнее: мастер знает про свой VLAN,
    а агент — нет. Автоопределение — обычный случай: одна сеть, один роутер.
    Стандартные 192.168.1.0/24 и 192.168.0.0/24 — последний шанс, когда
    локальный адрес определить не удалось.
    """
    configured = read_env_subnets()

    if configured is not None:
        logger.info(
            "Сканирую подсети из %s: %s",
            SUBNETS_ENV,
            ", ".join(str(network) for network in configured),
        )
        return configured

    detected = detect_local_subnet()

    if detected is not None:
        return [detected]

    logger.warning(
        "Локальная подсеть не определена: проверяю стандартные %s. "
        "Если ферма в другой сети, задайте %s.",
        ", ".join(DEFAULT_SUBNETS),
        SUBNETS_ENV,
    )
    return [ipaddress.IPv4Network(cidr) for cidr in DEFAULT_SUBNETS]


def collect_hosts(networks: list[ipaddress.IPv4Network]) -> list[str]:
    """
    Адреса для обхода: без адреса сети и широковещательного.

    Список обрезается по MAX_HOSTS: подсеть /16 в SCAN_SUBNETS — это 65534
    соединения, и агент молча висел бы на обходе вместо опроса очереди.
    """
    hosts: list[str] = []

    for network in networks:
        for host in network.hosts():
            if len(hosts) >= MAX_HOSTS:
                logger.warning(
                    "Проверяю только первые %d адресов: подсети шире, чем "
                    "нужно ферме. Сузьте %s.",
                    MAX_HOSTS,
                    SUBNETS_ENV,
                )
                return hosts

            hosts.append(str(host))

    return hosts


def probe_port(ip_address: str, port: int, timeout: float = PORT_TIMEOUT) -> bool:
    """
    Открыт ли порт: TCP-соединение и сразу закрытие, без обмена данными.

    `connect_ex` вместо `connect`: отказ соединения — обычный ответ выключенного
    принтера, и он не должен поднимать исключение внутри потока.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(timeout)
        return sock.connect_ex((ip_address, port)) == 0


def printer_ssl_context() -> ssl.SSLContext:
    """
    Контекст для HTTPS-проб без проверки сертификата.

    У принтеров самоподписанные сертификаты: OctoPrint генерирует пару при
    включении HTTPS, у части Klipper-сборок то же. Полная проверка отвергла бы
    живой принтер. Секретов проба не отправляет — только GET публичных
    страниц, — поэтому отключение проверки здесь осознанное и касается одного
    сканера, а не общего кода агента.
    """
    global _https_context

    if _https_context is None:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        _https_context = context

    return _https_context


def read_ok_body(url: str, context: ssl.SSLContext | None = None) -> bytes | None:
    """
    Тело ответа 200. None — порт закрылся, таймаут, отказ или не-200.

    Ошибка одного адреса не должна прерывать обход: сюда приходят сотни
    запросов к технике, которая может ответить чем угодно.
    """
    try:
        with urllib.request.urlopen(
            url, timeout=HTTP_TIMEOUT, context=context
        ) as response:
            if response.status != 200:
                return None

            return response.read(MAX_BODY_BYTES)
    except (urllib.error.URLError, OSError, ValueError):
        return None


def parse_json_object(body: bytes) -> dict[str, Any] | None:
    """JSON-объект из тела ответа. None — не JSON или не объект."""
    try:
        payload = json.loads(body)
    except ValueError:
        return None

    if not isinstance(payload, dict):
        return None

    return {str(key): value for key, value in payload.items()}


def is_moonraker(ip_address: str) -> bool:
    """
    Klipper за портом 7125: `GET /server/info` отвечает 200 и JSON с `result`.

    Одного открытого порта мало: 7125 может занять чужое приложение. Ответ
    Moonraker содержит `result` с `klippy_state` или `moonraker_version` — это и
    есть подпись прошивки, по которой мастеру не стыдно показать принтер.
    """
    body = read_ok_body(f"http://{ip_address}:{MOONRAKER_PORT}/server/info")

    if body is None:
        return False

    payload = parse_json_object(body)

    if payload is None:
        return False

    result = payload.get("result")

    if not isinstance(result, dict):
        return False

    return bool({"klippy_state", "moonraker_version"} & result.keys())


def is_octoprint(ip_address: str, port: int) -> bool:
    """
    OctoPrint за веб-портом: `/api/version` или название на главной странице.

    Проверять только открытый 80/443 нельзя: этот порт открыт у роутера,
    телевизора и принтера-сканера. `/api/version` отвечает без ключа и содержит
    `api` и `server` — этого достаточно. Часть сборок закрывает API целиком,
    тогда смотрим главную страницу: OctoPrint пишет своё название в заголовке.
    """
    scheme = "https" if port == 443 else "http"
    context = printer_ssl_context() if scheme == "https" else None
    base_url = f"{scheme}://{ip_address}:{port}"

    body = read_ok_body(f"{base_url}/api/version", context)

    if body is not None:
        payload = parse_json_object(body)

        if payload is not None and ("api" in payload or "server" in payload):
            return True

    page = read_ok_body(f"{base_url}/", context)

    return page is not None and b"octoprint" in page.lower()


def inspect_host(ip_address: str) -> dict[str, Any] | None:
    """
    Один адрес: принтер он или нет.

    Порядок важен и по скорости, и по смыслу. 7125 — сразу Moonraker: это порт
    по умолчанию у Klipper-ферм, и открывается он только у принтеров. Веб-порты
    проверяются вторыми и обязательно с HTTP-запросом: без него половина
    домашней техники попала бы в список находок.
    """
    if probe_port(ip_address, MOONRAKER_PORT) and is_moonraker(ip_address):
        return {"ip_address": ip_address, "protocol_type": "moonraker"}

    for port in OCTOPRINT_PORTS:
        if probe_port(ip_address, port) and is_octoprint(ip_address, port):
            return {"ip_address": ip_address, "protocol_type": "octoprint"}

    return None


def scan_network(
    networks: list[ipaddress.IPv4Network] | None = None,
) -> list[dict[str, Any]]:
    """
    Принтеры локальной сети: `[{"ip_address": ..., "protocol_type": ...}]`.

    `networks` — для явных подсетей и тестов; по умолчанию решает
    `resolve_scan_networks()`. Результат отсортирован по адресу: два запуска
    дают одинаковый порядок, и журнал сравнивается глазами.

    Исключения наружу не летят. Закрытый порт, чужой сервер на 7125 и принтер,
    выключенный посреди обхода, — нормальная картина сети, а не сбой агента.
    """
    targets = networks if networks is not None else resolve_scan_networks()
    hosts = collect_hosts(targets)

    if not hosts:
        logger.warning("Сканировать нечего: в подсетях нет адресов")
        return []

    workers = min(MAX_WORKERS, len(hosts))
    logger.info(
        "Сканирую %d адресов в %d потоков: порты %d и %d",
        len(hosts),
        workers,
        MOONRAKER_PORT,
        OCTOPRINT_PORTS[0],
    )

    found: list[dict[str, Any]] = []

    with ThreadPoolExecutor(max_workers=workers) as pool:
        for result in pool.map(inspect_host, hosts):
            if result is not None:
                found.append(result)

    found.sort(key=lambda printer: ipaddress.IPv4Address(printer["ip_address"]))
    logger.info("Найдено принтеров: %d", len(found))

    for printer in found:
        logger.info("  %s | %s", printer["ip_address"], printer["protocol_type"])

    return found


def error_text(response: requests.Response) -> str:
    """Текст ошибки от роутов TriDi: они отвечают `{"error": "..."}`."""
    try:
        payload = response.json()
    except ValueError:
        return response.text[:200].strip() or "(пустой ответ)"

    if isinstance(payload, dict) and isinstance(payload.get("error"), str):
        return payload["error"]

    return response.text[:200].strip() or "(пустой ответ)"


def send_discovered_printers(
    printers: list[dict[str, Any]],
    crm_url: str | None = None,
    agent_token: str | None = None,
) -> bool:
    """
    Находки в CRM: `POST /api/agent/discover`, `Authorization: Bearer <token>`.

    Пустой список — тоже отправка: сервер по нему очищает прошлые находки, и
    мастер видит, что сеть изменилась, а не старый список выключенных принтеров.

    `crm_url` и `agent_token` передаёт `main.py` из уже прочитанных настроек; без
    них берутся переменные окружения (их загрузил `load_settings()`), чтобы
    функцию можно было вызвать отдельно. Токен уходит только в заголовке — не в
    URL и не в журнал.

    True — сервер принял список. False — не принял (сеть, 401, 503, 500):
    исключение наружу не летит, обнаружение фермы не должно ронять агента.
    """
    base_url = (crm_url or os.getenv("CRM_URL", "")).strip().rstrip("/")
    token = (agent_token or os.getenv("AGENT_TOKEN", "")).strip()

    if not base_url or not token:
        logger.error(
            "Находки не отправлены: нет CRM_URL или AGENT_TOKEN. Запускайте "
            "агент через main.py или задайте переменные окружения."
        )
        return False

    try:
        response = requests.post(
            f"{base_url}/api/agent/discover",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            },
            json=printers,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as error:
        logger.warning("Сетевая ошибка, находки не отправлены: %s", error)
        return False

    if response.status_code == 401:
        logger.error(
            "Сервер не принял AGENT_TOKEN (401): находки не отправлены. "
            "Проверьте ключ в настройках мастерской — он мог смениться."
        )
        return False

    if not response.ok:
        logger.error(
            "Находки не приняты: HTTP %s, %s",
            response.status_code,
            error_text(response),
        )
        return False

    logger.info("Находки отправлены: %d", len(printers))

    return True
