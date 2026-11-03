"""
Сканер локальной сети: мастер подключения фермы (шаг 7.2).

Мастеру со ста принтерами не вбить парк руками. Агент обходит подсеть, находит
Moonraker (порт 7125), Creality (WebSocket 9999 и `GET /info`), OctoPrint
(80/443), Anycubic (MQTT 9883), Bambu Lab (MQTT 8883 и SSDP, UDP 1990) и
FlashForge (HTTP 8898, TCP 8899 и UDP-обнаружение) и отдаёт список в CRM
через `POST /api/agent/discover`. Сервер складывает находки в
`workshop_discovered_printers` (миграция `supabase/workshop_farm_and_shop.sql`),
мастер даёт им имена в интерфейсе, и принтеры переезжают в парк мастерской.

Почему сканер на стандартной библиотеке: подсеть — это сотни соединений по
таймауту в доли секунды. `socket.connect_ex` в потоках дешевле, чем `requests`
с его сессией и разбором заголовков на каждый адрес, а `urllib.request` из
стандартной библиотеки хватает для двух GET-запросов проверки. `requests`
остался только в `send_discovered_printers()`: отправка в CRM повторяет стиль
main.py — те же таймаут и разбор ошибок, что у статусов и пульса.

Открытый порт — не подпись протокола, и у трёх протоколов подписи снаружи нет
вовсе: Anycubic (9883), Bambu (8883) и FlashForge (8898/8899) молчат до
авторизации или требуют заголовок с серийным номером, которого у сканера ещё
нет. Их находки — «порт слушает», и подтверждает их адаптер в `connect()`: не
ответил паспорт — принтер не подключается. Порты у этих протоколов редкие, так
что ложная находка в мастерской почти невозможна.

Bambu дополнительно ищется SSDP, и это важнее обхода портов: у него нет ни
Moonraker, ни OctoPrint, зато он отвечает на multicast-запрос
`urn:bambulab-com:device:3dprinter:1` заголовками `Location` (адрес) и `USN`
(серийный номер). Номер уходит в CRM вместе с находкой: по нему агент строит
MQTT-топики `device/<serial>/…`, и мастеру не приходится переписывать его с
экрана принтера. Порт 8883 находит Bambu там, где роутер режет multicast, — и
тоже с номером: сертификат принтера содержит его в `CN`
(`bambu_certificate_serial`), поэтому находка без SN остаётся только у машины,
которая сертификат не отдала.

FlashForge и Elegoo тоже ищутся широковещательным UDP-запросом — у них нет ни
7125, ни 80/443 с подписью, зато есть собственный порт обнаружения.
Elegoo (SDCP) ждёт на UDP 3000 текст `M99999` и отвечает конвертом с
`MainboardID`, FlashForge — на 8899, 19000 или 48899 (порт зависит от модели) и
отвечает на `~M115` по-разному: JSON-объектом с номером, строкой `SN: …` или
голым номером `SNM0MF9201019` посреди мусора — все три вида разбирает
`flashforge_serial()`. Номер платы и серийный номер едут в CRM вместе с
находкой: адаптеру они нужны в каждом запросе, а вводить их руками мастеру не за
что.

Оба поиска — одно окно ожидания (`scan_udp_broadcast()`): принтеры отвечают за
доли секунды, и ждать отдельно 3 секунды на каждый протокол значило бы утроить
время сканирования фермы.

Anycubic ищется хуже всех: у него нет ни паспорта на веб-порту, ни бродкаста —
только MQTT на 9883 под TLS (`modeId` и `deviceId` приходят в отчёте внутри
брокера, а сам брокер на запросы без авторизации молчит). Поэтому находка — это
открытый 9883 без подписи протокола: она помечается `anycubic`, но проверяется
адаптером, который в `connect()` спрашивает паспорт и не подтвердивший себя
принтер не подключает. Порт 9883 в сети мастерской почти наверняка принтер: у
остальных протоколов из справочника номера другие.
"""
from __future__ import annotations

import errno
import ipaddress
import json
import logging
import os
import re
import socket
import ssl
import time
import urllib.error
import urllib.request
from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import requests

# Разбор сертификата Bambu живёт в адаптере (`certificate_serial`): номер из `CN`
# нужен и подключению, и сканеру, а второй разборщик сертификатов разъехался бы
# с первым. Цикла импортов нет: адаптер сканер не импортирует.
from adapters.bambu import certificate_serial

# Порт Moonraker (Klipper) и веб-порты OctoPrint: по ним мастер и отличает
# принтер от роутера.
MOONRAKER_PORT = 7125
OCTOPRINT_PORTS = (80, 443)

# Creality (Creality OS): WebSocket 9999 для команд и HTTP 80 для паспорта.
# Порт 9999 — самая узкая подпись протокола: он есть у K1, K2 Plus и Ender-3 V3
# и почти ни у кого больше. Подтверждение — `/info` с кодом модели (`F008`).
CREALITY_PORT = 9999
CREALITY_HTTP_PORT = 80

# Адреса паспорта Creality: `/info` у большинства сборок, `/detail` — у тех, где
# первый закрыт. Порядок важен: лишний запрос стоит секунды обхода, поэтому
# сначала тот, что отвечает чаще.
CREALITY_INFO_PATHS = ("/info", "/detail")

# Поля, в которых Creality называет модель. Код (`F008`) — единственная
# подпись, которую нельзя спутать с чужим JSON на том же порту.
CREALITY_MODEL_FIELDS = ("model", "modelName", "machineModel")

# Имя находки: колонка `workshop_discovered_printers.name` — 60 символов.
# Мастеру оно нужно, чтобы отличить принтеры друг от друга: адреса в подсети
# выглядят одинаково.
DISCOVERED_NAME_LIMIT = 60

# Поля, в которых принтер называет себя. Сборки пишут их по-разному, поэтому
# перебираются все варианты (сравнение в нижнем регистре): `hostname` —
# Moonraker, `machineName`/`Name` — FlashForge и Elegoo, `deviceName` — Bambu в
# отчёте.
PRINTER_NAME_FIELDS = (
    "name",
    "printername",
    "printer_name",
    "hostname",
    "machinename",
    "machine_name",
    "devicename",
    "device_name",
)

# Где искать имя внутри ответа: `/info` Creality и `/detail` FlashForge кладут
# паспорт во вложенный объект, а не на верхний уровень.
PRINTER_NAME_CONTAINERS = ("data", "result", "device", "detail", "info")

# Глубина поиска имени: два уровня хватает всем сборкам из справочника, а
# рекурсия по произвольному JSON не должна уходить вглубь чужого ответа.
PRINTER_NAME_DEPTH = 2

# Строка имени в текстовом ответе FlashForge: `Machine Name: Adventurer 5M`.
FLASHFORGE_NAME = re.compile(
    r"Machine\s*Name\s*[:=]\s*([^\r\n]{1,60})", re.IGNORECASE
)

# FlashForge: HTTP API на 8898, а обнаружение — UDP-бродкаст на 8899, 19000 или
# 48899. Порт зависит от модели и прошивки, поэтому запрос уходит на все три:
# лишний пакет дешевле, чем принтер, которого сканер не нашёл.
FLASHFORGE_HTTP_PORT = 8898
FLASHFORGE_UDP_PORTS = (8899, 19000, 48899)

# TCP-порт, который FlashForge держит рядом с HTTP 8898 (Adventurer 3/4,
# Adventurer 5M): часть моделей поднимает сервис печати только здесь. Паспорт
# `GET /detail` на обоих портах требует заголовок `serialNumber`, которого у
# сканера ещё нет, поэтому проверяется открытие соединения.
FLASHFORGE_TCP_PORT = 8899

# Bambu Lab: MQTT под TLS на 8883 (команды и отчёты) и FTPS 990 для файлов.
# HTTP-запроса к 8883 быть не может — там TLS-брокер, и `urlopen` повесил бы
# поток на таймаут вместо мгновенного ответа. Поэтому признак находки один:
# порт слушает. Это тот же компромисс, что у Anycubic: открытый 8883 в сети
# мастерской почти наверняка принтер, а подтверждает находку `connect()` —
# без `device/<serial>/report` принтер не подключается.
BAMBU_MQTT_PORT = 8883

# `~M115` — запрос версии прошивки по G-code: на него FlashForge отвечает
# текстом с `Machine Name` и `SN`. HTTP-порт 8898 у части моделей закрыт, а
# UDP-обнаружение работает и там.
FLASHFORGE_UDP_PROBE = b"~M115\r\n"

# Строка номера в текстовом ответе FlashForge: `SN: SNM0001234` у Adventurer,
# `Serial Number: ...` и `SerialNo: ...` у старых прошивок. Номер нужен
# адаптеру в заголовке каждого запроса, поэтому находка без него бесполезна.
FLASHFORGE_SERIAL = re.compile(
    r"(?:SN|S/N|Serial(?:\s*(?:Number|No\.?|#))?)\s*[:=]\s*([A-Za-z0-9._-]{4,64})",
    re.IGNORECASE,
)

# Голый номер: прошивка 5.x (Adventurer 5M Pro) отвечает на `~M115` строкой
# `SNM0MF9201019♣♣qZ}SNM0MF9201019Z` — номер идёт первым, а следом лежит мусор
# из неинициализированного буфера. Двоеточия перед номером нет, поэтому шаблон с
# меткой выше давал пустоту, и принтер терялся при сканировании, хотя номер был
# в пакете. Перед `SN` не должно быть буквы или цифры: иначе это хвост чужого
# слова, а не подпись номера. Заглавные буквы обязательны — так номер печатают
# и на наклейке, а мусор в нижнем регистре номером не считается.
#
# Шаблон мягкий по разделителю: между `SN` и номером допускаются пробелы и
# знаки (`SN M0MF9201019`, `SN-M0MF9201019`, `SN:M0MF9201019`), потому что
# прошивки расходятся даже в этом, а номер нужен целиком — он уходит в заголовок
# `serialNumber` каждого запроса. Номер забирается отдельной группой, а пробелы
# и мусор после него шаблон просто отбрасывает. Минимум шесть знаков после `SN`:
# такой длины заводской номер, а случайный обрывок номером не считается.
FLASHFORGE_SERIAL_TOKEN = re.compile(
    r"(?<![A-Za-z0-9])SN[\s:=\-]*([0-9A-Z]{6,62})"
)

# Поля JSON-ответа FlashForge: часть прошивок (Adventurer 5M, ADX5) отвечает на
# `~M115` не текстом G-code, а объектом со своим написанием номера. Сборки
# называют поле по-разному — `SerialNumber`, `serialNumber`, `SN`, `SerialNo`,
# `serial_no`, `Serial Number`, — поэтому сравнение идёт по нормализованному
# ключу (`normalize_json_key`): регистр, пробелы, подчёркивания и точки не важны.
FLASHFORGE_SERIAL_KEYS = frozenset({"serialnumber", "serialno", "sn"})

# Насколько глубоко искать номер в JSON-ответе. Прошивки прячут его в конверте
# (`{"code": 0, "detail": {…}}`, `{"Data": {…}}`), но ответ на `~M115` — это
# пара уровней: глубже рекурсия по чужому JSON только тратила бы время.
FLASHFORGE_JSON_DEPTH = 3

# Elegoo (SDCP): WebSocket 3030 для команд и UDP 3000 для обнаружения. `M99999`
# — текстовый запрос, на который Centauri Carbon отвечает конвертом SDCP с
# `MainboardID`; номер едет в CRM как серийный номер принтера.
ELEGOO_WS_PORT = 3030
ELEGOO_UDP_PORT = 3000
ELEGOO_UDP_PROBE = b"M99999"

# Поля конверта SDCP, в которых лежит номер платы. Верхний уровень — обычный
# ответ загрузки, `Data` — ответ принтера на запрос обнаружения.
ELEGOO_BOARD_FIELDS = ("MainboardID", "MainboardId", "mainboardId")

# Anycubic (Kobra S1, S1 Max): MQTT 9883 под TLS для команд и отчётов, HTTP
# 18910 для загрузки файла. Подписи протокола в сети нет — ни паспорта на
# веб-порту, ни броадкаста, — поэтому признак один: открытый порт брокера.
# Находка помечается `anycubic`, а проверяет её адаптер в `connect()`: на
# `info/query` отвечает только принтер, и без `info/report` подключения нет.
ANYCUBIC_MQTT_PORT = 9883
ANYCUBIC_HTTP_PORT = 18910

# Сколько собирать ответы на бродкаст. Три секунды — как окно SSDP: живой
# принтер отвечает сразу, но Wi-Fi теряет широковещательные пакеты, а UDP —
# ненадёжный транспорт без повторов.
UDP_DISCOVERY_TIMEOUT = 3.0

# Ответ — конверт SDCP или строка G-code, пара сотен байт. Больше читать незачем.
UDP_MAX_BYTES = 8192

# Глобальный широковещательный адрес. Часть роутеров его фильтрует, поэтому
# `scan_network()` добавляет бродкаст каждой подсети.
UDP_BROADCAST_ADDRESS = "255.255.255.255"

# Сколько символов ответа показывать в журнале: в первых ста видны и
# `MainboardID`, и `SN`, то есть ровно то, по чему сканер узнаёт принтер.
UDP_PREVIEW = 100

# Сколько символов сырого ответа печатать в журнале: ответ на `~M115` — это пара
# сотен байт, поэтому 200 символов показывают его целиком. Без этой строки не
# видно, что именно приходит от принтера, когда номер не разобрался, — и парсер
# правится по догадке, а не по факту. Ответ печатается всегда, а не только при
# отказе: порт ответа на части прошивок не совпадает с портом запроса, и по
# одному порту нельзя решить, стоит ли показывать пакет.
UDP_FLASHFORGE_RAW_PREVIEW = 200

# Коды «порт закрыт»: Windows сообщает ICMP `port unreachable` кодом 10054, а
# POSIX — `ECONNRESET`. Это не сбой поиска, а отсутствие слушателя на одном из
# портов рассылки: ответы остальных портов надо дочитать.
UDP_CLOSED_PORT = frozenset({errno.ECONNRESET, 10054})

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

# Предел серийного номера и номера платы — как у колонки serial_number в
# миграции. Обрезать номер нельзя: он адрес устройства, поэтому слишком длинная
# строка считается мусором, а не сокращается.
SERIAL_MAX = 64

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

    if not serial or len(serial) > SERIAL_MAX:
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


def bambu_certificate_serial(
    ip_address: str, port: int = BAMBU_MQTT_PORT
) -> str | None:
    """
    Серийник Bambu из сертификата принтера на 8883: None — номер не получен.

    Номер лежит в `CN` самоподписанного сертификата (тот же, что `USN` в
    SSDP-ответе), и TLS отдаёт его раньше логина. Поэтому портовая находка
    перестаёт быть «просто открытый порт»: мастеру не надо вписывать SN с
    наклейки, а `merge_discovered_printers()` предпочитает находку с номером.

    Разбор — в адаптере (`certificate_serial`): он же нужен подключению, а
    причина неудачи уже написана WARNING'ом там. None оставляет находку без
    номера — её подтвердит `connect()`, а поле в мастере будет обязательным.

    `port` — для тестов: сканер всегда спрашивает 8883.
    """
    serial = certificate_serial(ip_address, port)

    if not serial:
        return None

    logger.info(
        "[Bambu] %s: серийный номер из сертификата — %s", ip_address, serial
    )

    return serial


def scan_bambu_ssdp(timeout: float = BAMBU_SSDP_TIMEOUT) -> list[dict[str, Any]]:
    """
    Принтеры Bambu в локальной сети: `[{"ip_address": ..., "protocol_type": "bambu",
    "serial_number": ..., "name": "Bambu Lab <SN>"}]`.

    Один multicast M-SEARCH на `239.255.255.250:1990` (порт Bambu) с типом
    устройства `BAMBU_SSDP_TARGET`. Принтер отвечает HTTP-ответом поверх UDP:
    `Location` — адрес, `USN` — серийный номер. Пока открыто окно ожидания,
    собираются ответы всех принтеров подсети: один запрос дешевле обхода портов,
    которых у Bambu нет (у него MQTT 8883 и FTPS 990).

    Ответ без `USN` не пропускается: адрес уже известен, и номер спрашивает
    сертификат принтера на 8883 (`bambu_certificate_serial`). Часть прошивок
    (A1 в LAN-режиме) в SSDP номер не присылает, и раньше такая находка
    терялась, хотя принтер в сети. Если `Location` не разобрался, берётся адрес
    отправителя — пакет пришёл от самого принтера.

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
                ip_address = ssdp_location_host(headers.get("location", ""))
                ip_address = ip_address or ssdp_location_host(str(sender[0]))

                if ip_address is None:
                    continue

                serial = clean_bambu_serial(headers.get("usn", ""))

                if serial is None:
                    # `USN` в ответе нет — часть прошивок его не присылает, — но
                    # адрес известен: номер спрашиваем у сертификата на 8883.
                    # Раньше такой ответ пропускался, и принтер, который в сети и
                    # отвечает, в список находок не попадал.
                    logger.warning(
                        "[SSDP] %s: в ответе нет серийного номера — спрашиваю "
                        "сертификат принтера",
                        ip_address,
                    )
                    serial = bambu_certificate_serial(ip_address)

                if serial is None:
                    continue

                found[ip_address.lower()] = found_printer(
                    ip_address,
                    "bambu",
                    serial,
                    # Модель Bambu в SSDP не называет, а серийник называет: имя
                    # «Bambu Lab 01S00C123456789» отличает принтеры друг от друга
                    # лучше одинаковых адресов.
                    f"Bambu Lab {serial}" if serial else None,
                )
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


def merge_discovered_printers(
    found: list[dict[str, Any]],
    discovered: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Обход портов + широковещательное обнаружение → один список без повторов.

    Приоритет у обнаружения: оно и протокол называет (`bambu`, `flashforge`,
    `elegoo`), и приносит серийный номер или номер платы, а открытый веб-порт
    принтера ничего не доказывает. Порядок — по адресу, как у обхода портов.
    """
    merged: dict[str, dict[str, Any]] = {}

    for printer in found:
        merged.setdefault(str(printer["ip_address"]).lower(), printer)

    for printer in discovered:
        merged[str(printer["ip_address"]).lower()] = printer

    return sorted(merged.values(), key=address_sort_key)


def broadcast_targets(networks: Sequence[ipaddress.IPv4Network]) -> list[str]:
    """
    Адреса для широковещательного запроса: глобальный и бродкаст каждой подсети.

    Глобальный `255.255.255.255` не выходит за маршрутизатор, но часть роутеров
    его фильтрует. Бродкаст подсети (`192.168.1.255`) доходит до принтеров
    своего VLAN, и назвать его нужно явно — этим и занимается функция.
    """
    targets = [UDP_BROADCAST_ADDRESS]

    for network in networks:
        address = str(network.broadcast_address)

        if address not in targets:
            targets.append(address)

    return targets


def parse_udp_json(data: bytes) -> dict[str, Any] | None:
    """
    JSON-объект из UDP-пакета.

    `parse_json_object()` здесь не годится: в датаграмме после JSON часто идут
    нули выравнивания и перевод строки, и `json.loads` на них падает. Пустой
    ответ и не-JSON — None.
    """
    text = data.decode("utf-8", errors="replace").strip("\x00 \r\n\t")

    if not text:
        return None

    try:
        payload = json.loads(text)
    except ValueError:
        return None

    if not isinstance(payload, dict):
        return None

    return {str(key): value for key, value in payload.items()}


def elegoo_mainboard_id(data: bytes) -> str | None:
    """
    `MainboardID` из UDP-ответа Elegoo на `M99999`.

    Centauri Carbon отвечает конвертом SDCP: номер платы лежит на верхнем уровне
    или внутри `Data`. Номер уходит в CRM как серийный номер принтера: адаптеру
    он нужен для топика команд, и мастеру не приходится переписывать его с
    экрана. Пустое и слишком длинное значение — не номер, а чужой ответ.
    """
    payload = parse_udp_json(data)

    if payload is None:
        return None

    for source in (payload, payload.get("Data"), payload.get("data")):
        if not isinstance(source, dict):
            continue

        for field in ELEGOO_BOARD_FIELDS:
            value = source.get(field)

            if not isinstance(value, str):
                continue

            board = value.strip()

            if board and len(board) <= SERIAL_MAX and not board.isspace():
                return board

    return None


def clean_flashforge_serial(value: Any) -> str | None:
    """
    Серийный номер FlashForge в пригодном виде.

    Пробел внутри делает номер негодным: он уходит в заголовок `serialNumber`,
    и прошивка такой запрос отклоняет. Предел длины — как у колонки
    `serial_number` в миграции, обрезать нельзя: номер адресует принтер. Число
    из JSON тоже читается: часть сборок отдаёт номер без букв.
    """
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        serial = str(value)
    elif isinstance(value, str):
        serial = value.strip()
    else:
        return None

    if not serial or len(serial) > SERIAL_MAX:
        return None

    if any(character.isspace() for character in serial):
        return None

    return serial


def normalize_json_key(value: str) -> str:
    """
    Ключ JSON в сравнимом виде: без регистра, пробелов, подчёркиваний и точек.

    Прошивки FlashForge называют одно и то же поле по-разному (`SerialNumber`,
    `serial_number`, `Serial Number`, `SN`, `serialNo`). Перечислять написания
    списком — значит потерять следующее, поэтому ключи сравниваются по буквам и
    цифрам: `Serial Number` и `serial_number` дают одно и то же — `serialnumber`.
    """
    return "".join(character for character in value.lower() if character.isalnum())


def serial_in_json(payload: Any, depth: int = 0) -> str | None:
    """
    Серийный номер в разобранном JSON: ищется на всех уровнях вложенности.

    Прошивки прячут номер в конверте (`{"code": 0, "detail": {…}}`,
    `{"Data": {"SerialNumber": …}}`), и уровень зависит от модели. Обход
    ограничен `FLASHFORGE_JSON_DEPTH`: ответ на `~M115` — пара уровней, а
    рекурсия по чужому JSON не должна крутиться на мегабайтах.

    None — поля с номером нет ни на одном уровне.
    """
    if depth > FLASHFORGE_JSON_DEPTH:
        return None

    if isinstance(payload, dict):
        # Сначала поля своего уровня, потом вложенные объекты: номер на верхнем
        # уровне главнее номера из вложенного конверта.
        for key, value in payload.items():
            normalized = normalize_json_key(key) if isinstance(key, str) else ""

            if normalized in FLASHFORGE_SERIAL_KEYS:
                serial = clean_flashforge_serial(value)

                if serial is not None:
                    return serial

        for value in payload.values():
            serial = serial_in_json(value, depth + 1)

            if serial is not None:
                return serial

        return None

    if isinstance(payload, list):
        for value in payload:
            serial = serial_in_json(value, depth + 1)

            if serial is not None:
                return serial

    return None


def flashforge_json_serial(data: bytes) -> str | None:
    """
    Серийный номер из JSON-ответа FlashForge на `~M115`.

    Часть прошивок отвечает на `~M115` не текстом G-code, а объектом:
    `{"SerialNumber": "SNM0001234", …}` либо конвертом
    `{"code": 0, "detail": {…}}`. Раньше такой ответ считался «без серийного
    номера», и принтер терялся при сканировании, хотя номер в пакете был.
    Поиск идёт по всем уровням (`serial_in_json`), а написание поля
    сравнивается без учёта регистра и разделителей.
    """
    payload = parse_udp_json(data)

    if payload is None:
        return None

    return serial_in_json(payload)


def flashforge_serial(data: bytes) -> str | None:
    """
    Серийный номер из UDP-ответа FlashForge на `~M115`.

    Ответ бывает трёх видов, и все три разбираются:

      - текст G-code: `CMD M115 Received.`, затем строки `Machine Type`,
        `Machine Name`, `Firmware` и `SN: SNM0MF9201019`;
      - JSON-объект с номером (Adventurer 5M Pro, AD5X): `SerialNumber`,
        `serialNumber` или `SN`, в том числе внутри конверта `detail`;
      - сырая строка без подписи и двоеточия: `SNM0MF9201019♣♣qZ}…` — номер
        стоит первым, за ним мусор из неинициализированного буфера. Шаблон с
        меткой такой ответ не находил, и принтер пропадал из находок, хотя номер
        был в пакете; теперь работает `FLASHFORGE_SERIAL_TOKEN`.

    Номер нужен адаптеру в заголовке каждого запроса, поэтому находка без него
    бесполезна — отказ пришёл бы уже на загрузке файла, а не при сканировании.
    """
    serial = flashforge_json_serial(data)

    if serial is not None:
        return serial

    # Нули выравнивания и раскладка вида `S\x00N\x00M\x000…` рвут номер на
    # куски: между буквами оказывается `\x00`, и шаблон его не видит. Номер —
    # ASCII, поэтому нули убираются перед разбором текста.
    text = data.replace(b"\x00", b"").decode("utf-8", errors="replace")
    match = FLASHFORGE_SERIAL.search(text)

    if match is not None:
        serial = clean_flashforge_serial(match.group(1))

        if serial is not None:
            return serial

    # Голый номер в сырой строке: подписи и двоеточия нет, за номером мусор.
    token = FLASHFORGE_SERIAL_TOKEN.search(text)

    if token is None:
        return None

    # Разделитель между `SN` и номером в номер не входит: в заголовок
    # `serialNumber` уходит `SN` и знаки без пробелов — номер с пробелом внутри
    # прошивка отклонит, а `clean_flashforge_serial()` такой не пропустит.
    return clean_flashforge_serial(f"SN{token.group(1)}")


def udp_json_keys(data: bytes) -> str:
    """
    Поля JSON-ответа для журнала: `SerialNumber, machineType, …`.

    Нужны, когда серийного номера в ответе не нашлось: по списку полей сразу
    видно, что именно пришло, и парсер правится по факту, а не по догадке.
    Не JSON — пустая строка.
    """
    payload = parse_udp_json(data)

    if payload is None:
        return ""

    return ", ".join(sorted(str(key) for key in payload)[:8])


def udp_printer(data: bytes, sender: tuple[str, int]) -> dict[str, Any] | None:
    """
    Находка из одного UDP-ответа: протокол по содержимому, адрес — отправитель.

    Содержимое главнее порта: на один адрес уходят запросы двух протоколов, и
    отвечать на них может чужое железо. JSON с `MainboardID` — Elegoo, текст с
    `SN:` или JSON с `SerialNumber` — FlashForge. Порт отправителя решает только
    тогда, когда тело не разобралось: по нему видно, кто ответил и почему
    находка не годится, а поля JSON из журнала подсказывают, какое имя номера
    не учёл парсер.

    Вместе с номером читается имя (`Name`, `Machine Name` и их варианты в
    `PRINTER_NAME_FIELDS`): по нему мастер отличает находки друг от друга, а
    прошивки называют себя по-разному. Номер найденного FlashForge пишется в
    журнал строкой `[UDP] FlashForge SN найден: …` — по ней видно, что SN
    подтянулся автоматически, и искать его в сыром ответе не нужно.
    """
    preview = data[:UDP_PREVIEW].decode("utf-8", errors="replace")
    # Перевод строки разорвал бы запись журнала на несколько строк, поэтому
    # `split()` схлопывает пробелы и `\r\n`.
    logger.info(
        "[UDP] Получен ответ от %s:%d: %s...",
        sender[0],
        sender[1],
        " ".join(preview.split()),
    )

    board = elegoo_mainboard_id(data)

    if board is not None:
        return found_printer(
            sender[0],
            "elegoo",
            board,
            json_printer_name(parse_udp_json(data)),
        )

    # Сырой ответ FlashForge целиком — до разбора и независимо от него. Раньше
    # строка печаталась только при отказе и только для портов рассылки, поэтому
    # по журналу нельзя было понять, что приходит от принтера: порт ответа на
    # части прошивок не совпадает с портом запроса, а при найденном номере
    # строка не печаталась вовсе. Переводы строк схлопнуты, чтобы запись
    # осталась одной строкой, а не порвала журнал на два десятка строк.
    raw = data[:UDP_FLASHFORGE_RAW_PREVIEW].decode("utf-8", errors="replace")
    logger.info("[UDP] FlashForge raw response: %s", " ".join(raw.split()))

    serial = flashforge_serial(data)

    if serial is not None:
        # Строка на каждую находку: по журналу агента видно, что номер пришёл из
        # ответа принтера, а не введён руками, — и мастер не ищет SN в логах.
        logger.info("[UDP] FlashForge SN найден: %s", serial)

        return found_printer(sender[0], "flashforge", serial, flashforge_name(data))

    if sender[1] == ELEGOO_UDP_PORT:
        logger.info("[UDP] %s: ответ Elegoo без MainboardID — пропускаю", sender[0])
    elif sender[1] in FLASHFORGE_UDP_PORTS:
        keys = udp_json_keys(data)
        logger.info(
            "[UDP] %s: ответ FlashForge без серийного номера — пропускаю%s",
            sender[0],
            f" (поля JSON: {keys})" if keys else "",
        )

    return None


def scan_udp_broadcast(
    timeout: float = UDP_DISCOVERY_TIMEOUT,
    targets: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Принтеры FlashForge и Elegoo, которые отвечают на широковещательный запрос.

    Два протокола одним окном ожидания:

      - Elegoo (SDCP) слушает UDP 3000 и отвечает на `M99999` конвертом с
        `MainboardID`;
      - FlashForge отвечает на `~M115` на 8899, 19000 или 48899 — порт зависит
        от модели и прошивки, поэтому запрос уходит на все три.

    `targets` — адреса для отправки; по умолчанию глобальный
    `255.255.255.255`. Тест передаёт loopback, а `scan_network()` — ещё и
    бродкаст каждой подсети (`broadcast_targets()`).

    Исключения наружу не летят: бродкаст запрещён политикой, интерфейс без
    маршрута, занятый порт — обычная картина чужой сети, а не сбой агента.
    Найденное до ошибки остаётся в списке.
    """
    addresses = tuple(targets) if targets else (UDP_BROADCAST_ADDRESS,)
    found: dict[str, dict[str, Any]] = {}
    logger.info(
        "[UDP] Запуск поиска FlashForge и Elegoo: %s, порты %d и %s",
        ", ".join(addresses),
        ELEGOO_UDP_PORT,
        "/".join(str(port) for port in FLASHFORGE_UDP_PORTS),
    )

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            # Без этого флага `sendto` на широковещательный адрес система
            # отклоняет: право рассылать бродкаст спрашивается явно.
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.settimeout(timeout)

            for address in addresses:
                for port in FLASHFORGE_UDP_PORTS:
                    sock.sendto(FLASHFORGE_UDP_PROBE, (address, port))

                sock.sendto(ELEGOO_UDP_PROBE, (address, ELEGOO_UDP_PORT))

            deadline = time.monotonic() + timeout

            while time.monotonic() < deadline:
                try:
                    data, sender = sock.recvfrom(UDP_MAX_BYTES)
                except socket.timeout:
                    # Окно ожидания закрылось: больше никто не ответил.
                    break
                except OSError as error:
                    if error.errno in UDP_CLOSED_PORT:
                        # На одном из портов рассылки никого нет, и система
                        # вернула ICMP «порт закрыт». Это обычная картина: у
                        # принтера открыт один порт из четырёх. Ждём остальные
                        # ответы до конца окна, иначе первый же закрытый порт
                        # отменял бы находку.
                        logger.debug("[UDP] Порт закрыт: %s", error)
                        continue

                    logger.warning("[UDP] Ошибка сети: %s (приём ответа)", error)
                    break

                printer = udp_printer(data, sender)

                if printer is not None:
                    found[str(printer["ip_address"]).lower()] = printer
    except OSError as error:
        # Запрет бродкаста политикой, интерфейс без маршрута, занятый UDP:
        # находок не будет, но агент продолжает работу — обход портов впереди.
        logger.warning("[UDP] Ошибка сети: %s", error)

    printers = sorted(found.values(), key=address_sort_key)

    if printers:
        logger.info("FlashForge и Elegoo по UDP найдено: %d", len(printers))
    else:
        logger.info("[UDP] Поиск завершен, ответов нет")

    return printers


def clean_printer_name(value: Any) -> str | None:
    """
    Имя, которое принтер назвал сам: одна строка до `DISCOVERED_NAME_LIMIT`.

    Пробелы, переносы строк и управляющие символы схлопываются: имя уходит в
    JSON и в подпись карточки. Пустое значение и заглушки прошивок («unknown»,
    «none», «null», «n/a») — «имени нет»: показывать их мастеру бессмысленно.
    """
    if not isinstance(value, str):
        return None

    text = " ".join(value.split())

    if not text or text.lower() in {"unknown", "none", "null", "n/a"}:
        return None

    return text[:DISCOVERED_NAME_LIMIT]


def json_printer_name(
    payload: dict[str, Any] | None, depth: int = 0
) -> str | None:
    """
    Имя принтера из JSON-ответа: `hostname`, `name`, `printerName`, …

    Ответы сборок кладут паспорт во вложенный объект (`data`, `result`,
    `device`, `detail`), поэтому поиск идёт на два уровня вглубь. Ошибка разбора
    не пробрасывается: имя — подсказка мастеру, а не признак протокола.
    """
    if not isinstance(payload, dict):
        return None

    for field in PRINTER_NAME_FIELDS:
        for key, value in payload.items():
            if str(key).strip().lower() == field:
                name = clean_printer_name(value)

                if name:
                    return name

    if depth >= PRINTER_NAME_DEPTH:
        return None

    for container in PRINTER_NAME_CONTAINERS:
        for key, value in payload.items():
            if str(key).strip().lower() != container:
                continue

            name = json_printer_name(value, depth + 1)

            if name:
                return name

    return None


def flashforge_name(data: bytes) -> str | None:
    """
    Имя FlashForge из ответа на `~M115`.

    Часть прошивок отвечает JSON с полем `Name`, часть — текстом G-code со
    строкой `Machine Name: …`, поэтому проверяются оба вида.
    """
    name = json_printer_name(parse_udp_json(data))

    if name:
        return name

    match = FLASHFORGE_NAME.search(data.decode("utf-8", errors="replace"))

    return clean_printer_name(match.group(1)) if match else None


def found_printer(
    ip_address: str,
    protocol_type: str,
    serial_number: str | None = None,
    name: str | None = None,
) -> dict[str, Any]:
    """
    Находка в том виде, в каком её принимает `POST /api/agent/discover`.

    Пустые поля не пишутся вовсе: `null` и отсутствие ключа на сервере значат
    одно и то же («принтер не назвал»), а лишние ключи только удлиняют журнал.
    """
    printer: dict[str, Any] = {
        "ip_address": ip_address,
        "protocol_type": protocol_type,
    }

    if serial_number:
        printer["serial_number"] = serial_number

    if name:
        printer["name"] = name

    return printer


def creality_model(payload: dict[str, Any] | None) -> str | None:
    """
    Код модели Creality из ответа `/info` или `/detail`.

    У K2 Plus он лежит на верхнем уровне (`{"model": "F008"}`), часть сборок
    прячет в `data`, `result` или `device`. Ни один из вариантов не считается
    подписью, если поля нет: `{"hostname": "creality"}` на 9999 мог бы прийти и
    от чужого приложения.
    """
    if payload is None:
        return None

    sources = (
        payload,
        payload.get("data"),
        payload.get("result"),
        payload.get("device"),
    )

    for source in sources:
        if not isinstance(source, dict):
            continue

        for field in CREALITY_MODEL_FIELDS:
            value = source.get(field)

            if isinstance(value, str) and value.strip():
                return value.strip()

    return None


def creality_payload(
    ip_address: str, port: int = CREALITY_HTTP_PORT
) -> dict[str, Any] | None:
    """
    Ответ `/info` (или `/detail`) Creality с кодом модели; None — это не Creality.

    Читается один раз на адрес: и признак протокола (`creality_model`), и имя
    берутся из одного ответа, а второй запрос стоил бы секунды обхода.
    """
    for path in CREALITY_INFO_PATHS:
        body = read_ok_body(f"http://{ip_address}:{port}{path}")

        if body is None:
            continue

        payload = parse_json_object(body)

        if creality_model(payload) is not None:
            return payload

    return None


def is_creality(ip_address: str, port: int = CREALITY_HTTP_PORT) -> bool:
    """
    Creality за веб-портом: `/info` (или `/detail`) с кодом модели.

    Порт проверяет вызывающий: 9999 открыт только у принтеров Creality, а вот
    проверить один открытый порт мало — его мог занять чужой сервис. Код
    модели (`F008` — K2 Plus) и есть подпись протокола.

    `port` — для тестов и для принтера за прокси; по умолчанию 80.
    """
    return creality_payload(ip_address, port) is not None


def moonraker_hostname(ip_address: str, port: int = MOONRAKER_PORT) -> str | None:
    """
    Имя Moonraker-принтера: `result.hostname` из `GET /printer/info`.

    Klipper-хосты обычно названы по делу («voron-2feeder», «k1-max»), и это
    подсказка мастеру лучше адреса. Ошибка чтения — None: имя необязательно, а
    сама находка уже подтверждена `/server/info`.
    """
    body = read_ok_body(f"http://{ip_address}:{port}/printer/info")

    if body is None:
        return None

    payload = parse_json_object(body)
    result = payload.get("result") if isinstance(payload, dict) else None

    return json_printer_name(result if isinstance(result, dict) else None)


def is_anycubic(ip_address: str, port: int = ANYCUBIC_MQTT_PORT) -> bool:
    """
    Anycubic: открытый MQTT-порт 9883.

    Подписи протокола у Anycubic нет: паспорт лежит внутри брокера, а спросить
    его можно только с логином и паролем — на этапе сканирования их нет. Значит,
    проверяется одно: порт слушает. Это слабее, чем `/info` у Creality, зато 9883
    не занят ни одним другим протоколом из справочника (`8883` — Bambu, `9999` —
    Creality, `7125` — Moonraker). Ошибку исправит `connect()`: без `info/report`
    адаптер пишет «на порту отвечает не Anycubic» и не подключается.

    `port` — для тестов: сканер всегда проверяет 9883.
    """
    return probe_port(ip_address, port)


def is_bambu(ip_address: str, port: int = BAMBU_MQTT_PORT) -> bool:
    """
    Bambu Lab: открытый MQTT-порт 8883 под TLS.

    Подписи протокола снаружи нет: брокер молчит до логина и ждёт TLS, поэтому
    HTTP-запрос здесь не просто бесполезен, а вреден — `urlopen` к 8883 висит до
    таймаута и растягивает обход подсети. Значит проверяется ровно одно: порт
    слушает. Открытый 8883 в мастерской почти всегда Bambu (у остальных
    протоколов из справочника номера другие: 7125 — Moonraker, 9999 — Creality,
    9883 — Anycubic, 8898/8899 — FlashForge). Серийный номер при этом берётся из
    сертификата (`bambu_certificate_serial`), поэтому находка приходит готовой к
    подключению, а не «портом без номера». Ошибку исправит `connect()`: без
    отчёта в `device/<serial>/report` принтер не подключается.

    `port` — для тестов: сканер всегда проверяет 8883.
    """
    return probe_port(ip_address, port)


def is_flashforge(
    ip_address: str,
    http_port: int = FLASHFORGE_HTTP_PORT,
    tcp_port: int = FLASHFORGE_TCP_PORT,
) -> bool:
    """
    FlashForge: открытый HTTP 8898 или TCP 8899.

    Паспорт `GET /detail` требует заголовок `serialNumber`, а на этапе сканера
    номера ещё нет: запрос без него принтер отклоняет. Поэтому здесь, как и у
    Bambu, признак — открытый порт, а серийный номер приносит UDP-обнаружение
    (`scan_udp_broadcast()`), чья находка перекрывает портовую в
    `merge_discovered_printers()`. Модели, у которых 8898 закрыт, слушают 8899 —
    проверяются оба.

    `http_port` и `tcp_port` — для тестов: сканер всегда проверяет 8898 и 8899.
    """
    return probe_port(ip_address, http_port) or probe_port(ip_address, tcp_port)


def inspect_host(ip_address: str) -> dict[str, Any] | None:
    """
    Один адрес: принтер он или нет.

    Порядок важен и по скорости, и по смыслу. 9999 проверяется первым: у K2
    Plus открыты и 9999, и 7125 — принтер собран на Klipper, — но печать
    запускается только командой `opGcodeFile` по WebSocket. Определи такого
    принтера как Moonraker, и задание уйдёт в никуда: Klipper команду примет,
    а файл не напечатается.

    Дальше 7125 — порт по умолчанию у Klipper-ферм, открывается только у
    принтеров. Anycubic, Bambu и FlashForge проверяются после них: их признак —
    открытый порт, а не паспорт с подписью, и если на адресе нашёлся протокол с
    подписью, он и главнее. К 8883 (Bambu) HTTP-запроса нет — там TLS-брокер,
    поэтому проба ограничивается соединением. Веб-порты проверяются последними и
    обязательно с HTTP-запросом: без него половина домашней техники попала бы в
    список находок.

    Имя принтера читается там, где он его называет: Moonraker —
    `GET /printer/info` (`result.hostname`), Creality — тот же `/info`, что
    подтвердил модель. У Anycubic подписи в HTTP нет, имя приносят SSDP и
    UDP-обнаружение (Bambu — серийник, FlashForge — `Machine Name`), а без имени
    окно мастера подставляет «Принтер <адрес>». Bambu сверх того называет
    серийник в сертификате на 8883 (`bambu_certificate_serial`), поэтому и
    портовая находка приходит с номером — мастеру не надо переписывать его с
    наклейки.
    """
    if probe_port(ip_address, CREALITY_PORT):
        creality = creality_payload(ip_address)

        if creality is not None:
            return found_printer(
                ip_address, "creality", name=json_printer_name(creality)
            )

    if probe_port(ip_address, MOONRAKER_PORT) and is_moonraker(ip_address):
        return found_printer(
            ip_address, "moonraker", name=moonraker_hostname(ip_address)
        )

    if is_anycubic(ip_address):
        return found_printer(ip_address, "anycubic")

    if is_bambu(ip_address):
        return found_printer(ip_address, "bambu", bambu_certificate_serial(ip_address))

    if is_flashforge(ip_address):
        return found_printer(ip_address, "flashforge")

    for port in OCTOPRINT_PORTS:
        if probe_port(ip_address, port) and is_octoprint(ip_address, port):
            return found_printer(ip_address, "octoprint")

    return None


def scan_network(
    networks: list[ipaddress.IPv4Network] | None = None,
) -> list[dict[str, Any]]:
    """
    Принтеры локальной сети: `[{"ip_address": ..., "protocol_type": ...}]`.

    Три источника в одном списке: обход портов (Creality, Moonraker, Anycubic,
    Bambu, FlashForge, OctoPrint), SSDP (Bambu — с серийным номером) и
    широковещательный UDP-запрос (FlashForge и Elegoo — с серийным номером или
    номером платы). Bambu отдаёт номер и в сертификате на 8883, поэтому портовая
    находка тоже приходит с SN (`bambu_certificate_serial`). Повтор адреса
    схлопывается в пользу обнаружения: оно точнее знает и протокол, и номер.
    Anycubic находит только обход портов; Bambu и FlashForge — и обход портов, и
    обнаружение, поэтому находка с номером перекрывает портовую без номера.

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
            "Сканирую %d адресов в %d потоков: порты %s",
            len(hosts),
            workers,
            ", ".join(
                str(port)
                for port in (
                    CREALITY_PORT,
                    MOONRAKER_PORT,
                    ANYCUBIC_MQTT_PORT,
                    BAMBU_MQTT_PORT,
                    FLASHFORGE_HTTP_PORT,
                    FLASHFORGE_TCP_PORT,
                    *OCTOPRINT_PORTS,
                )
            ),
        )

        with ThreadPoolExecutor(max_workers=workers) as pool:
            for result in pool.map(inspect_host, hosts):
                if result is not None:
                    found.append(result)

    # Широковещательные поиски спрашивают всю подсеть одним пакетом, поэтому
    # вызываются и тогда, когда обходить нечего: Bambu, FlashForge и Elegoo
    # находят себя сами, а не через открытый порт.
    found = merge_discovered_printers(found, scan_bambu_ssdp())
    found = merge_discovered_printers(
        found, scan_udp_broadcast(targets=broadcast_targets(targets))
    )

    logger.info("Найдено принтеров: %d", len(found))

    for printer in found:
        details = " · ".join(
            str(value)
            for value in (printer.get("name"), printer.get("serial_number"))
            if value
        )
        logger.info(
            "  %s | %s%s",
            printer["ip_address"],
            printer["protocol_type"],
            f" | {details}" if details else "",
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
