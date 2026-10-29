"""
Сканер локальной сети: мастер подключения фермы (шаг 7.2).

Мастеру со ста принтерами не вбить парк руками. Агент обходит подсеть, находит
Moonraker (порт 7125), OctoPrint (80/443) и Bambu Lab (SSDP, UDP 1990) и отдаёт
список в CRM через `POST /api/agent/discover`. Сервер складывает находки в
`workshop_discovered_printers` (миграция `supabase/workshop_farm_and_shop.sql`),
мастер даёт им имена в интерфейсе, и принтеры переезжают в парк мастерской.

Почему сканер на стандартной библиотеке: подсеть — это сотни соединений по
таймауту в доли секунды. `socket.connect_ex` в потоках дешевле, чем `requests`
с его сессией и разбором заголовков на каждый адрес, а `urllib.request` из
стандартной библиотеки хватает для двух GET-запросов проверки. `requests`
остался только в `send_discovered_printers()`: отправка в CRM повторяет стиль
main.py — те же таймаут и разбор ошибок, что у статусов и пульса.

Bambu ищется не портами, а SSDP: у него нет ни Moonraker, ни OctoPrint, зато он
отвечает на multicast-запрос `urn:bambulab-com:device:3dprinter:1` заголовками
`Location` (адрес) и `USN` (серийный номер). Номер уходит в CRM вместе с
находкой: по нему агент строит MQTT-топики `device/<serial>/…`, и мастеру не
приходится переписывать его с экрана принтера.
"""
from __future__ import annotations

import ipaddress
import json
import logging
import os
import socket
import ssl
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import requests

# Порт Moonraker (Klipper) и веб-порты OctoPrint: по ним мастер и отличает
# принтер от роутера.
MOONRAKER_PORT = 7125
OCTOPRINT_PORTS = (80, 443)

# Bambu Lab не отвечает ни на 7125, ни на 80: у него MQTT (8883) и FTPS (990).
# Зато он отвечает на SSDP — multicast-запрос на UDP 1990, в ответе `Location`
# (адрес принтера) и `USN` (серийный номер). Один запрос находит все Bambu в
# подсети, а номер нужен агенту для MQTT-топиков `device/<serial>/…`, поэтому
# SSDP экономит мастеру ввод адреса и SN вручную.
BAMBU_SSDP_ADDRESS = ("239.255.255.250", 1990)
BAMBU_SSDP_TARGET = "urn:bambulab-com:device:3dprinter:1"

# Сколько собирать ответы. Живой принтер отвечает за доли секунды, но multicast
# в Wi-Fi теряется, а принтеров в цеху бывает много: четыре секунды — разумный
# компромисс между полнотой списка и временем запуска сканирования.
BAMBU_SSDP_TIMEOUT = 4.0

# Ответ SSDP — HTTP-заголовки поверх UDP, пара килобайт. Больше читать незачем.
BAMBU_SSDP_MAX_BYTES = 4096

# Сколько символов ответа показывать в строке `[SSDP] Получен ответ от ...`.
# В первых ста символах видны и `USN`, и `Location`, то есть ровно то, по чему
# сканер узнаёт принтер: когда принтер отвечает, а находок нет, журнал сразу
# показывает, что не разобралось, и не забивается килобайтами заголовков.
BAMBU_SSDP_PREVIEW = 100

# Предел серийного номера — как у колонки serial_number в миграции.
BAMBU_SERIAL_MAX = 64

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


def read_ssdp_headers(data: bytes) -> dict[str, str]:
    """
    Заголовки SSDP-ответа в словарь: ключи в нижнем регистре.

    Ответ принтера — обычный HTTP-ответ поверх UDP: строка статуса, заголовки,
    пустая строка. Разбор построчный, а не по регулярке, и делим строку только
    по первому двоеточию: `Location` может быть ссылкой. Строки без двоеточия
    (статус, мусор от чужого устройства) просто пропускаются.
    """
    headers: dict[str, str] = {}

    for line in data.decode("utf-8", errors="replace").splitlines():
        name, separator, value = line.partition(":")

        if not separator:
            continue

        key = name.strip().lower()

        if key:
            headers[key] = value.strip()

    return headers


def ssdp_location_host(location: str) -> str | None:
    """
    Адрес принтера из заголовка `Location` SSDP-ответа.

    Bambu присылает голый IPv4 (`192.168.1.50`), но поле формально URL: бывает
    и `http://192.168.1.50:8883/`. Схему, порт и путь отбрасываем — агенту нужен
    адрес, а не ссылка, и в CRM он уходит в том же виде, в каком его вводят
    руками. Разрешены только символы адресов: строка с пробелом или «/» — это
    подпись или мусор, а не принтер. None — не адрес.
    """
    text = location.strip()

    for scheme in ("http://", "https://"):
        if text.lower().startswith(scheme):
            text = text[len(scheme) :]
            break

    host = text.split("/", 1)[0].strip()
    name, separator, port = host.rpartition(":")

    if separator and port.isdigit() and name:
        host = name.strip("[]")

    if not host or len(host) > 253:
        return None

    allowed = set(
        "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-_"
    )

    return host if all(character in allowed for character in host) else None


def clean_bambu_serial(value: str) -> str | None:
    """
    Серийный номер из заголовка `USN` SSDP-ответа (`01S00C123456789`).

    Номер идёт в MQTT-топик `device/<serial>/…`, поэтому пробел внутри делает
    его негодным: это уже не подпись устройства, а чужой ответ в подсети.
    Предел длины — как у колонки serial_number в миграции. None — не номер.
    """
    serial = value.strip()

    if not serial or len(serial) > BAMBU_SERIAL_MAX:
        return None

    if any(character.isspace() for character in serial):
        return None

    return serial


def address_sort_key(printer: dict[str, Any]) -> tuple[int, int, str]:
    """
    Ключ сортировки находок: IPv4 по числу, всё остальное — по строке.

    `ipaddress.IPv4Address` не принимает имя узла, а сортировка не должна падать
    из-за одной нестандартной записи в списке. Два запуска дают одинаковый
    порядок, и журнал сравнивается глазами.
    """
    address = str(printer.get("ip_address", ""))

    try:
        return (0, int(ipaddress.IPv4Address(address)), "")
    except ValueError:
        return (1, 0, address)


def scan_bambu_ssdp(timeout: float = BAMBU_SSDP_TIMEOUT) -> list[dict[str, Any]]:
    """
    Принтеры Bambu в локальной сети: `[{"ip_address": ..., "protocol_type": "bambu",
    "serial_number": ...}]`.

    Один multicast M-SEARCH на `239.255.255.250:1990` (порт Bambu) с типом
    устройства `BAMBU_SSDP_TARGET`. Принтер отвечает HTTP-ответом поверх UDP:
    `Location` — адрес, `USN` — серийный номер. Пока открыто окно ожидания,
    собираются ответы всех принтеров подсети: один запрос дешевле обхода портов,
    которых у Bambu нет (у него MQTT 8883 и FTPS 990).

    Ответ без `USN` пропускается: тип устройства спрашивали конкретный, но
    отвечать в подсети может и чужое железо, а карточка без номера не годится для
    MQTT-топиков. Если `Location` не разобрался, берётся адрес отправителя —
    пакет пришёл от самого принтера.

    Исключения наружу не летят: multicast запрещён политикой, интерфейс без
    маршрута, занятый порт — нормальная картина чужой сети, а не сбой агента.
    Пустой список — «Bambu в сети нет»; если ошибка случилась уже после
    нескольких ответов, найденное до неё остаётся в списке.

    Журнал подробный, все строки с префиксом `[SSDP]`: запуск поиска, создание
    сокета и отправка M-SEARCH, каждый пришедший ответ (адрес отправителя и
    первые `BAMBU_SSDP_PREVIEW` символов) и пустой итог. Без этих строк
    «Найдено принтеров: 0» одинаково выглядит и при запрещённом multicast, и
    при закрытом UDP, и при принтере, который ответил без `USN`: по журналу
    видно, на каком шаге всё встало.
    """
    search = (
        "M-SEARCH * HTTP/1.1\r\n"
        f"HOST: {BAMBU_SSDP_ADDRESS[0]}:{BAMBU_SSDP_ADDRESS[1]}\r\n"
        'MAN: "ssdp:discover"\r\n'
        "MX: 1\r\n"
        f"ST: {BAMBU_SSDP_TARGET}\r\n\r\n"
    ).encode("ascii")
    found: dict[str, dict[str, Any]] = {}
    logger.info("[SSDP] Запуск поиска Bambu Lab...")

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            # Строка ниже — единственное место, где видно, что UDP вообще
            # работает: без неё «0 ответов» одинаково выглядит и при запрете
            # multicast, и при пустой подсети.
            logger.info(
                "[SSDP] Сокет создан, отправка M-SEARCH на %s:%d",
                BAMBU_SSDP_ADDRESS[0],
                BAMBU_SSDP_ADDRESS[1],
            )
            # TTL 2: ответы нужны из своей подсети; за маршрутизатор запрос
            # уходить не должен — там чужая ферма.
            sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
            sock.settimeout(timeout)
            sock.sendto(search, BAMBU_SSDP_ADDRESS)
            deadline = time.monotonic() + timeout

            while time.monotonic() < deadline:
                try:
                    data, sender = sock.recvfrom(BAMBU_SSDP_MAX_BYTES)
                except socket.timeout:
                    # Окно ожидания закрылось: больше никто не ответил.
                    break
                except OSError as error:
                    logger.warning("[SSDP] Ошибка сети: %s (приём ответа)", error)
                    break

                # Ответ пишется в журнал до разбора: принтер, который ответил
                # без `USN` или с непривычным `Location`, иначе исчез бы молча.
                preview = data[:BAMBU_SSDP_PREVIEW].decode("ascii", "replace")
                # Перевод строки разорвал бы запись журнала на несколько строк,
                # поэтому `split()` схлопывает пробелы и `\r\n`.
                logger.info(
                    "[SSDP] Получен ответ от %s: %s...",
                    sender[0],
                    " ".join(preview.split()),
                )

                headers = read_ssdp_headers(data)
                serial = clean_bambu_serial(headers.get("usn", ""))

                if serial is None:
                    continue

                ip_address = ssdp_location_host(headers.get("location", ""))
                ip_address = ip_address or ssdp_location_host(str(sender[0]))

                if ip_address is None:
                    continue

                found[ip_address.lower()] = {
                    "ip_address": ip_address,
                    "protocol_type": "bambu",
                    "serial_number": serial,
                }
    except OSError as error:
        # Запрет multicast политикой, интерфейс без маршрута, занятый UDP:
        # находок не будет, но агент продолжает работу — обход портов впереди.
        logger.warning("[SSDP] Ошибка сети: %s", error)

    printers = sorted(found.values(), key=address_sort_key)

    if printers:
        logger.info("Bambu по SSDP найдено: %d", len(printers))
    else:
        logger.info("[SSDP] Поиск завершен, ответов нет")

    return printers


def merge_bambu_printers(
    found: list[dict[str, Any]],
    bambu: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Обход портов + SSDP → один список без повторов адреса.

    Приоритет у SSDP: он и протокол называет (`bambu`), и серийный номер
    приносит, а открытый веб-порт Bambu ничего не доказывает. Порядок — по
    адресу, как у обхода портов.
    """
    merged: dict[str, dict[str, Any]] = {}

    for printer in found:
        merged.setdefault(str(printer["ip_address"]).lower(), printer)

    for printer in bambu:
        merged[str(printer["ip_address"]).lower()] = printer

    return sorted(merged.values(), key=address_sort_key)


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

    Два источника в одном списке: обход портов (Moonraker, OctoPrint) и SSDP
    (Bambu — вместе с серийным номером). Повтор адреса схлопывается в пользу
    SSDP: он точнее знает и протокол, и номер.

    `networks` — для явных подсетей и тестов; по умолчанию решает
    `resolve_scan_networks()`. Результат отсортирован по адресу: два запуска
    дают одинаковый порядок, и журнал сравнивается глазами.

    Исключения наружу не летят. Закрытый порт, чужой сервер на 7125 и принтер,
    выключенный посреди обхода, — нормальная картина сети, а не сбой агента.
    """
    targets = networks if networks is not None else resolve_scan_networks()
    hosts = collect_hosts(targets)
    found: list[dict[str, Any]] = []

    if not hosts:
        logger.warning("Сканировать нечего: в подсетях нет адресов")
    else:
        workers = min(MAX_WORKERS, len(hosts))
        logger.info(
            "Сканирую %d адресов в %d потоков: порты %d и %d",
            len(hosts),
            workers,
            MOONRAKER_PORT,
            OCTOPRINT_PORTS[0],
        )

        with ThreadPoolExecutor(max_workers=workers) as pool:
            for result in pool.map(inspect_host, hosts):
                if result is not None:
                    found.append(result)

    # SSDP спрашивает всю подсеть одним пакетом, поэтому вызывается и тогда,
    # когда обходить нечего: Bambu находит себя сам, а не через порт.
    found = merge_bambu_printers(found, scan_bambu_ssdp())

    logger.info("Найдено принтеров: %d", len(found))

    for printer in found:
        serial = printer.get("serial_number")
        logger.info(
            "  %s | %s%s",
            printer["ip_address"],
            printer["protocol_type"],
            f" | {serial}" if serial else "",
        )

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
