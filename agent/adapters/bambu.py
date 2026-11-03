"""
Адаптер Bambu Lab: MQTT-команды и FTPS-загрузка.

Принтеры Bambu в LAN-режиме разговаривают не по HTTP, как Moonraker, а по MQTT
(порт 8883, TLS) для команд и состояния и по FTPS (порт 990) для файлов. Для
мастера такой принтер в Мастерской помечен `protocol_type = "bambu"` (список
протоколов — `PRINTER_PROTOCOLS` в lib/db/workshop-types.ts).

Что и куда уходит:

  - `connect()`     — MQTT-клиент paho подключается к `self.ip_address:8883`.
    Сертификат у принтера самоподписанный, поэтому проверку цепочки отключаем
    (`tls_set(cert_reqs=ssl.CERT_NONE)`), а `tls_insecure_set(True)` снимает
    ещё и сверку имени хоста. Логин — `bblp`, пароль — LAN access code принтера
    (в Мастерской это поле `api_key`). Дальше подписка на
    `device/<serial>/report` и команда `pushing.pushall`: принтер присылает
    полный статус, а не только изменения;
  - `upload_file()` — `ftplib.FTP_TLS` (наследник `_ImplicitFtpTls`) на порт 990.
    У Bambu TLS включается сразу после TCP-соединения (implicit TLS), а
    стандартный `FTP_TLS.connect()` соединяется открытым текстом и ждёт
    `AUTH TLS`, которого принтер не присылает: поэтому `connect()` подменён, а
    вся остальная работа остаётся стандартной библиотеке. `PROT P` и пассивный
    режим обязательны, TLS ограничен 1.2: только там Python отдаёт сессию
    управляющего канала для переиспользования в канале данных, а без него Bambu
    рвёт передачу (`WinError 10054`). Канал данных получает свой таймаут
    (`FTP_DATA_TIMEOUT`), а файл пишется в сокет вручную: `storbinary()` на
    финале делает `unwrap()` и ждёт ответный `close_notify`, которого Bambu не
    присылает, — передача висит уже после последнего байта. Последняя попытка —
    HTTP POST на `/api/files/local` с заголовком `X-Api-Key`. Файл кладём в
    папку `cache` на карте памяти (`STOR cache/<имя>`): оттуда прошивка берёт
    его по `url` команды печати. На принтер уходит только проект `.3mf`,
    сохранённый из Bambu Studio («Экспорт файла пластины»): плоский `.gcode`
    A1 не разбирает, а STL не нарезает — оба отклоняются до сети
    (`formats.py`, `read_bambu_project()`), вместе с проверкой, что проект
    нарезан для этой модели принтера;
  - `start_print()` — команда `project_file` в `device/<serial>/request`:
    `param=Metadata/plate_<N>.gcode` (запись внутри контейнера, номер пластины
    из самого проекта) и `url=ftp:///cache/<имя>.3mf` (сам файл на карте
    памяти). Отправка в брокер
    ничего не подтверждает (QoS 0), поэтому метод ждёт отчёт принтера с тем же
    `sequence_id` и отдаёт его `result`/`reason` в `last_error`: «команда
    отправлена» и «печать началась» — разные вещи;
  - `get_status()`  — последний отчёт принтера: `print.gcode_state`,
    `print.mc_percent` (проценты) и `print.mc_remaining_time` (минуты).
    Остановку печати принтер называет сам: `gcode_state: "FAILED"` (или
    `"CANCELLED"`) вместе с причиной в `print.fail_reason`,
    `print.print_error` или `print.mc_print_error_code`. Причина попадает в
    `last_error`, а main.py отправляет её в CRM статусом `failed`: без этого
    мастер видел «печать прервана» без объяснения, а отмену с экрана принтера
    принимал за потерю связи.

Серийный номер. Bambu адресует топики серийником, и в Мастерской это поле
обязательное: форма принтера не сохранит Bambu без SN, потому что LAN-режим без
номера не работает вообще. Адаптер ждёт номер из задания (`printer.serialNumber`,
поле «Серийный номер (SN)» карточки принтера), а если его всё же нет — ищет сам:
сертификат принтера на 8883 (в поле `CN` лежит тот же серийник,
`03900D650925979`) → SSDP-поиск (UDP 1990, в ответе поле `USN`). Поиск —
дополнительный способ, а не надежда: сертификат стоит первым, потому что
приходит за доли секунды, а SSDP на части прошивок молчит совсем.

Шаблонной подписки нет вовсе. `device/+/report` принтер не принимает: на
SUBSCRIBE он отвечает не SUBACK, а разрывом TLS-соединения, и paho сообщает
`MQTT-соединение потеряно: Unspecified error`. Пока шаблон был, агент попадал в
петлю «подключился — подписался — оборвалось» на каждом опросе и не получал ни
одного отчёта. Поэтому подписка всегда точная — `device/<serial>/report`, а нет
номера — нет и подписки: `connect()` отказывает с `SERIAL_REQUIRED_ERROR`.

Ждать номер из отчёта бессмысленно: отчёт приходит в точный топик, который
строится из номера. Поэтому `start_print()` не ждёт и не переподключается, а
первой же строкой проверяет `self.serial_number`: пусто — сразу `False` с тем же
`SERIAL_REQUIRED_ERROR` в `last_error`. Иначе мастер видел бы «MQTT-соединение
потеряно» вместо «впишите SN в карточку».

Обрыв связи. Принтер закрывает MQTT-соединение сам (например, во время
FTPS-загрузки), paho переподключается в своём потоке. Публикация идёт с QoS 0,
поэтому команда, отправленная в промежуток между обрывом и CONNACK, теряется
молча. Перед публикацией адаптер проверяет соединение и ждёт переподключения,
а если отправка всё же вернула `MQTT_ERR_NO_CONN` — переподключается и
повторяет её ровно один раз.

Сеть. Ни один метод не выпускает сетевые исключения наружу: выключенный принтер
— это запись в журнале и `False` (или `status = "error"` у `get_status()`), а не
падение агента. Таймауты обязательны: без них сокет ждёт вечно, и цикл опроса
встаёт вместе с принтером.
"""
from __future__ import annotations

import ftplib
import json
import logging
import os
import socket
import ssl
import tempfile
import threading
import time
import zipfile
from typing import Any, Callable

import paho.mqtt.client as mqtt
import requests
from paho.mqtt.enums import CallbackAPIVersion

from .base import (
    CAPABILITY_CANCEL,
    CAPABILITY_START,
    CAPABILITY_STATUS,
    CAPABILITY_UPLOAD,
    BasePrinterAdapter,
    UploadPlan,
)
from .formats import (
    BAMBU_GCODE_PART,
    FormatError,
    bambu_compat_error,
    read_bambu_project,
)

logger = logging.getLogger("agent.adapters.bambu")

# Порты LAN-режима Bambu: MQTT с TLS и implicit FTPS.
MQTT_PORT = 8883
FTP_PORT = 990

# Пользователь у Bambu всегда один; пароль — LAN access code с экрана принтера.
DEVICE_USER = "bblp"

# Папка на карте, куда загрузка кладёт файл задания. Путь в команде печати
# (`url` у `project_file`) и фактический путь файла обязаны совпадать, поэтому
# оба строятся из `FTP_CACHE_DIRECTORY`.
FTP_CACHE_DIRECTORY = "cache"

# Keepalive MQTT: принтер замечает пропажу агента за минуту-две. Чаще слать
# PINGREQ незачем — сеть мастерской и так нагружена отчётами.
MQTT_KEEPALIVE = 30

# Сколько ждать CONNACK. Выключенный принтер не отвечает вообще, и ждать его
# дольше десяти секунд агент не должен: задание уйдёт в `failed`.
CONNECT_TIMEOUT = 10

# Сколько ждать восстановления MQTT перед командой печати. Принтер рвёт
# соединение сам — чаще всего во время FTPS-загрузки, — и paho поднимает его
# заново в своём потоке. Команда, отправленная в этот промежуток, теряется
# молча (публикация идёт с QoS 0), поэтому перед `start_print()` ждём CONNACK
# до десяти секунд: этого хватает на переподключение по Wi-Fi.
CONNECT_RETRY_TIMEOUT = 10.0

# Отказ по пустому серийнику. Один текст на `connect()` и `start_print()`:
# мастер видит незаполненную карточку принтера, а не «MQTT-соединение потеряно».
# Без SN брокер не даёт ни отчётов, ни команд — топики адресуются номером,
# а шаблонную подписку принтер рвёт.
SERIAL_REQUIRED_ERROR = (
    "Не указан Serial Number. Он обязателен для LAN-режима Bambu Lab. "
    "Укажите его в карточке принтера."
)

# Сколько ждать сертификат принтера при поиске серийника. В поле `CN` лежит
# серийный номер, и на прошивках, где SSDP молчит, это единственный источник —
# поэтому таймаут отдельный и с запасом: рукопожатие TLS у принтера по Wi-Fi
# занимает доли секунды, но занятая карта памяти иногда задерживает ответ.
CERTIFICATE_TIMEOUT = 5.0

# Шаг опроса в ожиданиях: соединение и серийник меняются в потоке paho, а
# событий «номер получен» у нас нет — дешевле проверять состояние.
CONNECT_POLL = 0.2

# Загрузка G-code идёт дольше опроса: файл на десятки мегабайт по Wi-Fi
# передаётся минутами, обрывать его на десяти секундах нельзя.
FTP_TIMEOUT = 120

# Кусками по 64 КБ: стандартные 8 КБ дают слишком много TLS-записей, а принтер
# на Wi-Fi отвечает на них заметно медленнее.
FTP_BLOCK_SIZE = 64 * 1024

# Таймаут канала данных. Управляющий канал живёт по `FTP_TIMEOUT`, а зависает
# передача именно на данных: принтер принимает первые куски, замолкает (занятая
# карта, кончилось место) и не отвечает ни `226`, ни сбросом. Минута тишины —
# уже отказ: пауза записи на карту столько не длится, а вечного ожидания, из-за
# которого задание не закрывается никогда, не будет.
FTP_DATA_TIMEOUT = 60

# Сколько раз пробовать загрузку заново. Bambu рвёт первое соединение канала
# данных (WinError 10054), если карта памяти занята печатью или TLS-сессия не
# переиспользована; повтор после паузы обычно проходит.
FTP_UPLOAD_ATTEMPTS = 3

# Пауза перед повтором: множится на номер попытки, чтобы принтер успел закрыть
# осиротевшее соединение и освободить канал данных.
FTP_RETRY_DELAY = 3.0

# Как часто писать в журнал о ходе ручной отправки файла: каждые 8 МБ, чтобы
# видеть, что передача жива, и не забивать журнал строкой на каждый кусок.
FTP_PROGRESS_STEP = 8 * 1024 * 1024

# HTTP-фолбэк, если FTPS не проходит: `POST http://<ip>/api/files/local` с
# заголовком `X-Api-Key`. В LAN-режиме Bambu этот адрес официально не
# документирован (это API OctoPrint-подобных прошивок), поэтому попытка
# последняя и без повторов: ответ 200/201 — файл принят, всё остальное —
# причина в `last_error`.
HTTP_UPLOAD_PATH = "/api/files/local"
HTTP_UPLOAD_CONNECT_TIMEOUT = 5.0
HTTP_UPLOAD_TIMEOUT = 60.0

# Сколько слушать ответы SSDP при поиске серийника.
DISCOVERY_TIMEOUT = 3.0

# Адрес и тип устройства для SSDP-поиска принтеров Bambu.
SSDP_ADDRESS = ("239.255.255.250", 1990)
SSDP_TARGET = "urn:bambulab-com:device:3dprinter:1"

# `param` команды печати для проекта `.3mf` — запись внутри файла, которую
# запускает Bambu. Само значение живёт в formats.py (`BAMBU_GCODE_PART`): по
# нему же собирается контейнер из G-code, и разойтись эти два места не должны.
#
# `url` контейнера в команде `project_file`: файл на карте памяти принтера.
# Первый вариант — с папкой загрузки (`ftp:///cache/<имя>.3mf`); второй — без
# неё, если прошивка сама подставляет `cache`. Варианты дешевле ещё одного
# круга «правка — печать»: отказ приходит за секунды и виден в журнале.
PROJECT_URL_PREFIX = "ftp:///"

# Записи OPC-пакета (`[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model`,
# `Metadata/slice_info.config`) собираются в formats.py: контейнер нужен только
# при упаковке сырого `.gcode`, а сама упаковка — общая задача форматов.
#
# Сколько ждать ответ принтера на команду печати. Bambu отвечает в топик отчёта
# тем же `sequence_id`, обычно за секунды; ожидание нужно, чтобы отказ принтера
# стал причиной в `last_error`, а не «печать запущена».
COMMAND_REPLY_TIMEOUT = 20.0

# Как часто смотреть, не пришёл ли ответ, пока его ждём. Ответ приходит в потоке
# paho, поэтому ждать можно только опросом своего словаря.
COMMAND_REPLY_POLL = 0.2

# `print.gcode_state` принтера → статус агента. `PREPARE` — это ещё не печать,
# но принтер уже занят заданием, и мастеру важно это видеть. `PAUSE` отдаём как
# `error`: печать стоит и сама не продолжится. `STANDBY` — простой A1 (холодное
# сопло, стол опущен): без него `get_status()` считал бы любое такое состояние
# неизвестным и отдавал `error`, то есть «печать встала» на ровном месте.
_STATE_MAP: dict[str, str] = {
    "RUNNING": "printing",
    "PREPARE": "printing",
    "FINISH": "idle",
    "IDLE": "idle",
    "STANDBY": "idle",
    "FAILED": "error",
    "CANCELLED": "error",
    "PAUSE": "error",
}

# Состояния, которыми принтер сообщает, что печать прервана: `FAILED` — сбой или
# остановка, `CANCELLED` — отмена с экрана принтера или из Bambu Studio. Для обоих
# `get_status()` ищет причину в отчёте и кладёт её в `last_error`: иначе отмена
# выглядела бы как общая «потеря связи», и мастер не знал бы, что произошло.
_FAILURE_STATES: frozenset[str] = frozenset({"FAILED", "CANCELLED"})

# Поля отчёта, в которых Bambu называет причину остановки: `fail_reason` (строка
# прошивки или Bambu Studio, например `cancelled`), `print_error` (числовой код
# отказа) и `mc_print_error_code` (код ошибки контроллера). Приходят не всегда и
# не всегда вместе: у отмены с экрана бывает только `fail_reason`, у сбоя подачи —
# только коды. Поэтому причина собирается из всех трёх, что нашлись.
_FAILURE_REPORT_FIELDS: tuple[str, ...] = (
    "fail_reason",
    "print_error",
    "mc_print_error_code",
)

# Разбор PEM в поля сертификата. Публичного API у `ssl` нет: `getpeercert()`
# отдаёт пустой словарь при `verify_mode = CERT_NONE`, а `cryptography` ради
# одного `CN` агенту не нужна. Поэтому берётся приватная функция CPython — через
# `getattr`, чтобы она не выглядела частью публичного API модуля `ssl`.
_decode_certificate: Callable[[str], dict[str, Any]] = getattr(
    ssl, "_ssl"
)._test_decode_cert  # noqa: SLF001


def _host(address: str) -> str:
    """
    Имя хоста из поля «адрес принтера».

    Мастер может вписать `192.168.1.50`, `192.168.1.50:8883` или готовый
    `https://192.168.1.50/`: порты у Bambu фиксированы (8883 и 990), поэтому
    схему, порт и путь отбрасываем — иначе MQTT стучался бы в
    `192.168.1.50:8883:8883`.
    """
    host = address.strip()

    for scheme in ("http://", "https://", "ftps://", "ftp://"):
        if host.lower().startswith(scheme):
            host = host[len(scheme) :]
            break

    host = host.split("/", 1)[0].strip()
    name, separator, port = host.rpartition(":")

    if separator and port.isdigit() and name:
        return name.strip("[]")

    return host


def _as_number(value: Any) -> float:
    """Число из отчёта принтера: отсутствие поля или мусор — 0.0."""
    # bool — подкласс int, но True в поле прогресса означает ошибку разбора.
    if isinstance(value, bool):
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    return 0.0


def _as_mapping(value: Any) -> dict[str, Any]:
    """Поле-объект из отчёта принтера; всё остальное — пустой словарь."""
    return value if isinstance(value, dict) else {}


def _failure_text(value: Any) -> str | None:
    """
    Значение поля-причины в текст; «ошибки нет» — None.

    Bambu пишет коды и числом, и строкой, а ноль (`print_error: 0`) значит
    «ошибки нет»: без этой проверки каждая успешная печать закрывалась бы
    отказом с причиной «0». Пустая строка и `none`/`null` — тоже «нет причины».
    """
    # bool — подкласс int, но True в поле кода означает ошибку разбора.
    if isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        return None if value == 0 else str(int(value))

    if not isinstance(value, str):
        return None

    text = value.strip()

    if not text or text.lower() in {"0", "none", "null", "success"}:
        return None

    return text


def _report_failure(report: dict[str, Any]) -> str | None:
    """
    Причина остановки печати из отчёта: `fail_reason`, `print_error`,
    `mc_print_error_code`.

    Отчёт Bambu — только изменения, поэтому причина может прийти одним
    сообщением, а `gcode_state: "FAILED"` другим; кэш `self._report` копит оба.
    Поле подписывается своим именем, чтобы мастер видел, что именно прислал
    принтер: `fail_reason: cancelled` читается, а голое `cancelled` — нет.
    None — принтер не назвал причину, и `get_status()` скажет хотя бы состояние.
    """
    details: list[str] = []

    for field in _FAILURE_REPORT_FIELDS:
        text = _failure_text(report.get(field))

        if text is not None:
            details.append(f"{field}: {text}")

    return "; ".join(details) if details else None


def _read_ssdp_headers(data: bytes) -> dict[str, str]:
    """
    Заголовки SSDP-ответа в словарь: ключи в нижнем регистре.

    Ответ принтера — обычный HTTP-ответ поверх UDP: строка статуса, заголовки,
    пустая строка. Значение может содержать двоеточия (`Location`), поэтому
    строку делим только по первому.
    """
    headers: dict[str, str] = {}
    text = data.decode("utf-8", errors="replace")

    for line in text.splitlines():
        name, separator, value = line.partition(":")

        if not separator:
            continue

        key = name.strip().lower()

        if key:
            headers[key] = value.strip()

    return headers


def _same_host(location: str, host: str) -> bool:
    """Совпадает ли `Location` из SSDP-ответа с адресом нужного принтера."""
    if not location or not host:
        return False

    return _host(location).lower() == host.strip().lower()


def _clean_serial(value: str) -> str:
    """
    Серийный номер из `USN` SSDP-ответа или из `CN` сертификата принтера.

    У Bambu это строка вида `00M09A123456789`: пятнадцать латинских букв и цифр.
    Пустое значение, строка с пробелами и всё, что не похоже на номер (например,
    `BBL CA` в сертификате), — не серийник, а мусор от чужого устройства или
    поле сертификата с другим смыслом.
    """
    serial = value.strip()

    if not serial or any(character.isspace() for character in serial):
        return ""

    if not 8 <= len(serial) <= 24 or not serial.isalnum():
        return ""

    return serial


class _ImplicitFtpTls(ftplib.FTP_TLS):
    """
    FTPS, который включает TLS сразу после TCP-соединения (implicit, порт 990).

    `ftplib.FTP_TLS.connect()` соединяется открытым текстом и только потом
    отправляет `AUTH TLS`. Bambu так не умеет: на 990 порту TLS начинается первым
    же байтом, и стандартный `connect()` повиснет на чтении приветствия.
    Поэтому подменён только `connect()`: рукопожатие до чтения приветствия, а
    `login()`, `prot_p()`, `transfercmd()` остаются из стандартной библиотеки.
    """

    def connect(
        self,
        host: str = "",
        port: int = 0,
        timeout: float | None = -999,
        source_address: tuple[str, int] | None = None,
    ) -> str:
        """
        TCP-соединение, сразу TLS, затем приветствие сервера.

        `timeout = -999` — «взять значение по умолчанию»: так стандартная
        библиотека отличает «параметр не передан» от `None` (ждать вечно).
        """
        if host:
            self.host = host

        if port > 0:
            self.port = port

        if timeout is not None and timeout != -999:
            self.timeout = timeout

        if source_address is not None:
            self.source_address = source_address

        self.sock = socket.create_connection(
            (self.host, self.port),
            self.timeout,
            source_address=self.source_address,
        )
        self.af = self.sock.family
        # Сертификат принтера самоподписанный: сверку цепочки и имени хоста
        # отключили ещё в контексте (см. `_ftp_client`).
        self.sock = self.context.wrap_socket(self.sock, server_hostname=self.host)
        self.file = self.sock.makefile("r", encoding=self.encoding)
        self.welcome = self.getresp()

        return self.welcome

    # Переиспользовать ли TLS-сессию канала управления для канала данных.
    # Bambu (как и vsftpd с `require_ssl_reuse`) рвёт `STOR` без переиспользования:
    # принтер видит в этом подмену соединения и отвечает `WinError 10054` —
    # сбросом канала данных. Если сессию принять не удалось, флаг снимается, и
    # загрузка продолжается обычным рукопожатием.
    reuse_session = True

    def ntransfercmd(
        self, cmd: str, rest: int | str | None = None
    ) -> tuple[socket.socket, int | None]:
        """
        Канал данных с переиспользованием TLS-сессии управляющего соединения.

        Стандартный `FTP_TLS.ntransfercmd()` всегда делает полное рукопожатие,
        чего Bambu не любит. Здесь в `wrap_socket()` передаётся сессия
        управляющего сокета; при отказе принтера флаг `reuse_session` снимается,
        и команда повторяется на новом канале — одна неудачная попытка не должна
        закрывать задание.

        `rest` объявлен как в стандартной библиотеке (`int | str | None`): это
        смещение для докачки, и сужать тип в наследнике нельзя.
        """
        # `_prot_p` — приватный флаг `FTP_TLS` («канал данных под TLS»). В
        # типах стандартной библиотеки его нет, поэтому читаем через getattr.
        if not getattr(self, "_prot_p", False):
            conn, size = ftplib.FTP.ntransfercmd(self, cmd, rest)
            conn.settimeout(FTP_DATA_TIMEOUT)

            return conn, size

        conn, size = ftplib.FTP.ntransfercmd(self, cmd, rest)
        # Таймаут данных ставим до рукопожатия: `wrap_socket()` копирует его в
        # TLS-сокет, и дальше ни `sendall()`, ни `voidresp()` не ждут вечно.
        conn.settimeout(FTP_DATA_TIMEOUT)

        session = None

        if self.reuse_session and isinstance(self.sock, ssl.SSLSocket):
            session = self.sock.session

        try:
            secured = self.context.wrap_socket(
                conn, server_hostname=self.host, session=session
            )
        except (ssl.SSLError, ValueError) as error:
            conn.close()

            if session is None:
                raise

            logger.warning(
                "Bambu %s: TLS-сессия канала данных не принята (%s) — "
                "продолжаю без переиспользования",
                self.host,
                error,
            )
            self.reuse_session = False

            return self.ntransfercmd(cmd, rest)

        return secured, size


def _ftp_client() -> _ImplicitFtpTls:
    """
    FTP-клиент для принтера: `FTP_TLS` с собственным TLS-контекстом.

    Контекст строится `ssl.create_default_context()`, но сертификат у принтера
    самоподписанный, и проверять его нечем: в Мастерской нет поля для
    сертификата. Поэтому `check_hostname` снимаем первым — `verify_mode =
    CERT_NONE` при включённой сверке имени `ssl` не примет.

    Версия TLS ограничена 1.2. Bambu требует переиспользования TLS-сессии
    управляющего канала в канале данных, а Python отдаёт `SSLSocket.session`
    сразу после рукопожатия только в TLS 1.2: в 1.3 сессия приходит тикетом
    позже, переиспользовать нечего — и принтер отвечает сбросом канала
    (`WinError 10054`) на первом же `STOR`.
    """
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    context.maximum_version = ssl.TLSVersion.TLSv1_2

    return _ImplicitFtpTls(context=context)


def _close_ftp(ftp: _ImplicitFtpTls) -> None:
    """
    Закрывает FTPS-соединение, что бы с ним ни случилось.

    `quit()` отправляет `QUIT` в сокет, а его может не быть: `connect()` не
    удался (принтер выключен) — и стандартная библиотека падает с
    `AttributeError` вместо понятной ошибки. Поэтому `QUIT` только пробуем, а на
    любой ошибке просто закрываем сокет.
    """
    try:
        ftp.quit()
    except (OSError, ftplib.Error, AttributeError):
        ftp.close()


def _describe(error: BaseException) -> str:
    """
    Причина отказа одной строкой: тип исключения, текст и код Windows.

    `str(OSError)` на Windows уже содержит `[WinError 10054]`, но у ошибок
    `ssl` и `ftplib` кода нет, а по одному «EOF occurred in violation of
    protocol» мастеру не понять, что случилось. Поэтому пишем и класс, и код.
    """
    text = str(error).strip()
    parts = [f"{type(error).__name__}: {text}" if text else type(error).__name__]
    winerror = getattr(error, "winerror", None)

    if isinstance(winerror, int):
        parts.append(f"WinError {winerror}")

    return " · ".join(parts)


# Что в причине отказа значит «принтер сбросил канал данных». Bambu отвечает
# сбросом (`WinError 10054`), а следом присылает `426 Transfer aborted`, поэтому
# ловим оба варианта: и текст ОС, и ответ FTP.
_RESET_MARKERS = (
    "connectionreseterror",
    "connectionabortederror",
    "brokenpipeerror",
    "ssleoferror",
    "connection reset",
    "reset by peer",
    "broken pipe",
    "forcibly closed",
    "10054",
    "10053",
    "transfer aborted",
    "data connection closed",
    "принудительно разорвал",
)


def _project_file_payloads(
    remote_name: str, gcode_part: str = BAMBU_GCODE_PART
) -> list[dict[str, Any]]:
    """
    Варианты команды `project_file` — в порядке проверки.

    Набор полей повторяет то, что присылает Bambu Studio: кроме `param` и `url`
    прошивка ждёт `project_id`, `profile_id`, `task_id` и `subtask_id` (у
    локальной печати они всегда `"0"`) и флаги калибровки. Без идентификаторов
    часть прошивок отвечает `success`, но задание в работу не берёт.

    `param` — запись внутри контейнера (`Metadata/plate_1.gcode`), `url` — файл
    на карте памяти принтера: Bambu забирает его сам, второй раз по сети файл не
    передаётся. `subtask_name` — имя, которое принтер покажет на экране и в
    истории; без него Bambu подписывает задание именем из `param`.

    `gcode_part` приходит из самого проекта (`read_bambu_project()`): если в
    контейнере нарезана не первая пластина, `param` с `plate_1` указал бы на
    несуществующую запись, и принтер ответил бы отказом.

    Прошивки расходятся в том, строит ли `url` путь от корня карты или от папки
    загрузки, поэтому первый вариант — фактический путь файла (`cache/<имя>`),
    второй — имя без папки.
    """
    common: dict[str, Any] = {
        "command": "project_file",
        "param": gcode_part,
        "subtask_name": remote_name,
        "project_id": "0",
        "profile_id": "0",
        "task_id": "0",
        "subtask_id": "0",
        "bed_type": "auto",
        "timelapse": False,
        # Калибровки не запускаем: они удлиняют старт на несколько минут, а
        # стол A1 выравнивает сам.
        "bed_levelling": True,
        "flow_cali": False,
        "vibration_cali": False,
        "layer_inspect": False,
        "use_ams": False,
    }

    return [
        {
            **common,
            "url": f"{PROJECT_URL_PREFIX}{FTP_CACHE_DIRECTORY}/{remote_name}",
        },
        {**common, "url": f"{PROJECT_URL_PREFIX}{remote_name}"},
    ]


def _reply_error(reply: dict[str, Any] | None) -> str | None:
    """
    Причина отказа из ответа принтера: None — команда принята.

    Ответа нет вовсе — тоже отказ: печать без подтверждения не начинается, а
    ждать её бесконечно нельзя, иначе задание висит до утра.
    """
    if reply is None:
        return f"принтер не подтвердил печать за {int(COMMAND_REPLY_TIMEOUT)} с"

    result = str(reply.get("result") or "").strip().lower()

    if result == "success":
        return None

    reason = str(reply.get("reason") or "").strip()

    return f"принтер отклонил печать: {reason or result or 'без причины'}"


def _looks_like_reset(reason: str) -> bool:
    """
    Похоже ли, что принтер оборвал канал данных, а не отказал в доступе.

    От этого зависит вторая попытка: ручная отправка через сокет помогает
    именно при сбросе канала, а при неверном коде доступа (`530`) или занятой
    карте (`550`) она только потратит время.
    """
    text = reason.lower()

    return any(marker in text for marker in _RESET_MARKERS)


def _tls_version(ftp: ftplib.FTP) -> str:
    """
    Версия TLS управляющего канала — для журнала.

    Bambu пускает только TLS 1.2 с переиспользованием сессии, поэтому в логе
    нужна версия: по ней сразу видно, договорились мы с принтером или нет.
    """
    sock = getattr(ftp, "sock", None)

    if isinstance(sock, ssl.SSLSocket):
        return sock.version() or "unknown"

    return "unknown"


class BambuAdapter(BasePrinterAdapter):
    """Принтер Bambu Lab в LAN-режиме: MQTT для команд, FTPS для файлов."""

    # Ключ протокола в справочнике: по нему `prepare_upload()` находит формат
    # (`.3mf`) и проверяет контейнер проекта.
    protocol_key = "bambu"

    # Отмена (`print.stop`) и пауза принтера есть, но драйвер паузу не
    # отправляет: Bambu отдаёт `PAUSE` только как состояние, а команда требует
    # отдельной проверки на живой машине. Набор — по факту, а не по желанию.
    capabilities = frozenset(
        {
            CAPABILITY_UPLOAD,
            CAPABILITY_START,
            CAPABILITY_CANCEL,
            CAPABILITY_STATUS,
        }
    )

    def __init__(
        self,
        ip_address: str,
        api_key: str,
        serial_number: str = "",
        brand: str = "",
        model: str = "",
    ) -> None:
        """
        `ip_address` — адрес принтера в сети мастера (`192.168.1.60`), порт не
        нужен: MQTT и FTPS у Bambu всегда на 8883 и 990.

        `api_key` — LAN access code с экрана принтера (Settings → Network).

        `serial_number` — серийник с наклейки или из задания. В форме принтера
        поле обязательное, но пустая строка не роняет адаптер: `connect()` ещё
        раз попробует найти номер в сертификате принтера (поле `CN`), а затем по
        SSDP — это дополнительный способ, а не замена карточке. Нашёлся —
        `start_print()` работает, нет — отказывает с `SERIAL_REQUIRED_ERROR`.

        `brand` и `model` — карточка принтера. По ним `prepare_upload()`
        проверяет, что проект `.3mf` нарезан для этой модели: профиль чужого
        принтера ломает печать. Пустая модель — проверять нечего.
        """
        super().__init__(ip_address=ip_address, api_key=api_key)
        self.serial_number = serial_number.strip()
        self.brand = brand.strip()
        self.model = model.strip()
        # Хост без схемы и порта: и MQTT, и FTPS ходят на свои фиксированные.
        self.host = _host(ip_address)
        self._client: mqtt.Client | None = None
        self._connected = threading.Event()
        # Последний отчёт принтера: Bambu присылает только изменившиеся поля,
        # поэтому словарь не заменяется, а дополняется.
        self._report: dict[str, Any] = {}
        # Ответы на команды: `sequence_id` → тело `print` из отчёта. Bambu
        # отвечает в тот же топик, что и статус (`command`, `result`, `reason`),
        # поэтому без отдельного словаря отказ команды неотличим от «отправлено».
        self._replies: dict[str, dict[str, Any]] = {}
        self._sequence = 0
        # Отказ команды печати (`result: fail`, `error string`): прошивка может
        # ещё присылать `idle`, и без этой пометки задание закрывалось как
        # `done`, хотя принтер не напечатал ни слоя.
        self._command_error: str | None = None
        # Запись с нарезанным G-code внутри проекта: её указывает `param`
        # команды печати. До `prepare_upload()` — первая пластина: без проверки
        # проекта печатать нельзя, но значение по умолчанию не должно быть
        # пустым.
        self._gcode_part = BAMBU_GCODE_PART

    def _next_sequence(self) -> str:
        """Номер команды: Bambu сверяет ответ с запросом по нему."""
        self._sequence += 1

        return str(self._sequence)

    def _apply_report(self, payload: dict[str, Any]) -> None:
        """
        Дополняет кэш отчёта полями из `print`.

        Отчёт Bambu выглядит как `{"print": {"mc_percent": 42}}` — только
        изменения, а не полный статус. Заменять кэш целиком нельзя: после
        сообщения с одним `mc_percent` пропали бы `gcode_state` и остаток.
        Ответ на команду (`result`, `reason`, эхо `param`/`url`) в кэш не
        попадает: это реакция на запрос, а не состояние печати, — её разбирает
        `_remember_reply`.
        """
        report = _as_mapping(payload.get("print"))

        if not report or "result" in report:
            return

        self._report.update(report)

    def _forget_previous_print(self) -> None:
        """
        Забывает прогресс прошлой печати сразу после старта новой.

        После `FINISH` принтер продолжает отдавать `mc_percent: 100` при
        `gcode_state: IDLE`, пока не начнёт новое задание. Цикл агента опрашивает
        состояние с задержкой `PRINT_START_DELAY`, и на медленном старте (файл
        ещё разбирается) видел «100 %, простой» — задание закрывалось как `done`
        без единого напечатанного слоя. Поэтому сразу после `success` на
        `project_file` из кэша уходят процент и остаток: пока принтер не пришлёт
        отчёт о новой печати, `get_status()` отдаёт простой с нулевым прогрессом.
        Состояние (`gcode_state`) не подделываем — его принтер присылает сам, а
        выдуманное значение скрыло бы отказ «файл не взят в работу».
        """
        self._report.pop("mc_percent", None)
        self._report.pop("mc_remaining_time", None)

    def _remember_reply(self, payload: dict[str, Any]) -> None:
        """
        Ответ принтера на команду: `result` и `reason` в журнал и в `_replies`.

        Bambu отвечает в топик отчёта телом вида
        `{"print": {"command": "project_file", "sequence_id": "7",
        "result": "fail", "reason": "error string"}}`; по `sequence_id` видно,
        на какую команду это ответ. Без разбора отказ терялся: `_publish()`
        подтверждает только доставку в брокер, и агент писал «печать запущена»
        даже когда принтер команду не принял.

        Отказ запоминается дважды: текстом в `last_error` (его отправляют
        мастеру) и пометкой `_command_error`, из-за которой `get_status()`
        отдаёт `error`. Иначе принтер после отказа присылает `idle`, и цикл
        мониторинга принимал простой за успешное завершение печати.
        """
        for body in payload.values():
            if not isinstance(body, dict):
                continue

            if "command" not in body or "result" not in body:
                continue

            command = body.get("command")
            sequence = str(body.get("sequence_id", ""))
            result = str(body.get("result") or "").strip().lower()
            reason = str(body.get("reason") or "").strip()

            if result == "success":
                # Снимаем пометку только удачной печатью: на `success` от
                # `pushall` или `stop` отказ `project_file` пропадать не должен.
                if command == "project_file":
                    self._command_error = None

                logger.info(
                    "Bambu %s: принтер принял %s (sequence %s) %s",
                    self.host,
                    command,
                    sequence,
                    reason,
                )
            else:
                failure = (
                    f"принтер отклонил {command or 'команду'}: "
                    f"{reason or result or 'без причины'}"
                )
                self._command_error = failure
                self.last_error = failure
                logger.error(
                    "Bambu %s: принтер отклонил %s (sequence %s): %s %s",
                    self.host,
                    command,
                    sequence,
                    result or "без результата",
                    reason,
                )

            self._replies[sequence] = dict(body)

    def _on_connect(
        self,
        client: mqtt.Client,
        userdata: Any,
        flags: Any,
        reason_code: Any,
        properties: Any = None,
    ) -> None:
        """
        Подтверждение MQTT-подключения (callback API paho 2.x).

        `reason_code` — `ReasonCode`: сравнение с 0 работает, но надёжнее
        спросить `is_failure`, он же верен для отказов по имени.
        """
        if reason_code.is_failure:
            logger.error(
                "Bambu %s не принял MQTT-подключение: %s (код доступа?)",
                self.host,
                reason_code,
            )
            return

        self._connected.set()

        # Переподключение после обрыва: paho работает с чистой сессией, и
        # брокер подписки не помнит. Первое подключение сюда не попадает —
        # `self._client` выставляется уже после CONNACK, а подписку делает
        # `connect()`.
        if self._client is not None:
            logger.warning("Bambu %s переподключился — подписываюсь заново", self.host)
            self._subscribe(self._client)

    def _on_disconnect(
        self,
        client: mqtt.Client,
        userdata: Any,
        flags: Any,
        reason_code: Any,
        properties: Any = None,
    ) -> None:
        """
        Обрыв MQTT-соединения (callback API paho 2.x).

        Переподключение делает сам paho в своём потоке: здесь только снимаем
        отметку «связь есть» и пишем причину в журнал. Без сброса отметки
        адаптер считал бы соединение живым, а публикация уходила бы в никуда —
        как раз тот случай, когда команда печати пропадала после загрузки файла.
        """
        self._connected.clear()

        # Штатное закрытие (`close()`) тоже приходит сюда: это не авария.
        if self._client is None:
            logger.debug("Bambu %s: MQTT-соединение закрыто", self.host)
            return

        logger.warning("Bambu %s: MQTT-соединение потеряно: %s", self.host, reason_code)

    def _on_message(
        self,
        client: mqtt.Client,
        userdata: Any,
        message: mqtt.MQTTMessage,
    ) -> None:
        """
        Отчёт принтера: `device/<serial>/report`.

        Топик точный (шаблон принтер рвёт), поэтому номер из него не берём — он
        уже известен. Разбор мусора не должен ронять поток paho: ошибки только
        пишутся в журнал.
        """
        try:
            payload = json.loads(message.payload.decode("utf-8", errors="replace"))
        except ValueError:
            logger.warning(
                "Bambu %s прислал не JSON: %r",
                self.host,
                message.payload[:120],
            )
            return

        if isinstance(payload, dict):
            self._remember_reply(payload)
            self._apply_report(payload)

    def _subscribe(self, client: mqtt.Client) -> bool:
        """
        Подписка на отчёты принтера: только точный топик.

        Шаблон `device/+/report` брокер принтера не принимает: на SUBSCRIBE он
        отвечает не SUBACK, а разрывом TLS-соединения — paho видит это как
        `MQTT-соединение потеряно: Unspecified error`, переподключается и снова
        рвётся. Проверено на живой машине: `device/<serial>/report` даёт SUBACK
        и отчёты, `device/+/report` — обрыв за миллисекунды. Поэтому без
        серийника подписки нет: подписаться «на всё» нельзя.
        """
        if not self.serial_number:
            logger.error(
                "Bambu %s: не подписываюсь — серийный номер неизвестен, "
                "впишите его в карточке принтера (поле «Серийный номер (SN)»)",
                self.host,
            )
            return False

        topic = f"device/{self.serial_number}/report"
        result, _ = client.subscribe(topic, qos=0)

        if result != mqtt.MQTT_ERR_SUCCESS:
            logger.error(
                "Bambu %s: подписка на %s не удалась (%s)",
                self.host,
                topic,
                result,
            )
            return False

        logger.info("Bambu %s: подписка на %s", self.host, topic)

        return True

    def _ensure_serial(self) -> str:
        """
        Серийник принтера: из задания, сертификата или SSDP.

        Bambu адресует топики номером, поэтому порядок — от быстрого к редкому:
        задание (поле «Серийный номер (SN)» карточки), сертификат принтера на
        8883 (`CN` — это и есть номер), SSDP-поиск (в ответе поле `USN`).

        Пустая строка — номера нет: `connect()` откажет с просьбой заполнить
        карточку, а печать без него всё равно не запустится.
        """
        if self.serial_number:
            return self.serial_number

        serial = self._serial_from_certificate()

        if not serial:
            serial = self._discover_serial()

        if serial:
            self.serial_number = serial
            logger.info("Bambu %s: серийный номер %s", self.host, serial)
        else:
            logger.warning(
                "Bambu %s: серийный номер неизвестен — подписка и команды "
                "невозможны, впишите SN в карточке принтера",
                self.host,
            )

        return self.serial_number

    def _serial_from_certificate(self) -> str:
        """
        Серийник из сертификата принтера: `CN` в нём — это серийный номер.

        Прошивка отдаёт на 8883 самоподписанный сертификат (`O` — BBL
        Technologies, `CN` — `03900D650925979`), и MQTT поднимает с ним TLS
        раньше, чем нужен номер. Способ быстрее SSDP и работает там, где SSDP
        молчит (на этой машине он не ответил ни на один запрос).

        Разбор идёт через `ssl._ssl._test_decode_cert`: приватный, но стабильный
        разборщик сертификатов из стандартной библиотеки — без него пришлось бы
        тянуть `cryptography` ради одного поля. Ошибка разбора — пустая строка:
        номер попробуем взять по SSDP.
        """
        try:
            pem = ssl.get_server_certificate(
                (self.host, MQTT_PORT), timeout=CERTIFICATE_TIMEOUT
            )
        except (OSError, ssl.SSLError) as error:
            logger.debug(
                "Bambu %s: сертификат не получен (%s) — ищу серийник дальше",
                self.host,
                error,
            )
            return ""

        try:
            with tempfile.NamedTemporaryFile(
                "w", suffix=".pem", delete=False, encoding="ascii"
            ) as handle:
                handle.write(pem)
                path = handle.name

            try:
                decoded = _decode_certificate(path)
            finally:
                os.unlink(path)
        except (OSError, ssl.SSLError, ValueError) as error:
            logger.debug(
                "Bambu %s: сертификат не разобран (%s) — ищу серийник дальше",
                self.host,
                error,
            )
            return ""

        for field in decoded.get("subject", ()):
            for name, value in field:
                if name == "commonName":
                    return _clean_serial(value)

        return ""

    def _discover_serial(self) -> str:
        """
        Серийник из SSDP-ответа принтера (UDP, порт 1990).

        Bambu отвечает на M-SEARCH заголовком `USN` с серийником. Если в
        подсети несколько принтеров, нужен тот, чей `Location` совпал с адресом
        задания; остальные — запасной вариант. Ни один не ответил — пустая
        строка: номер уже пробовали взять из сертификата, а без него подписка и
        команды невозможны (см. `connect()`).
        """
        search = (
            "M-SEARCH * HTTP/1.1\r\n"
            f"HOST: {SSDP_ADDRESS[0]}:{SSDP_ADDRESS[1]}\r\n"
            'MAN: "ssdp:discover"\r\n'
            "MX: 1\r\n"
            f"ST: {SSDP_TARGET}\r\n\r\n"
        ).encode("ascii")
        fallback = ""

        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
                sock.settimeout(DISCOVERY_TIMEOUT)
                sock.sendto(search, SSDP_ADDRESS)
                deadline = time.monotonic() + DISCOVERY_TIMEOUT

                while time.monotonic() < deadline:
                    try:
                        data, _ = sock.recvfrom(2048)
                    except socket.timeout:
                        # Никто не ответил за отведённое время.
                        break
                    except OSError as error:
                        logger.warning(
                            "Bambu %s: SSDP-ответ не прочитан: %s",
                            self.host,
                            error,
                        )
                        break

                    headers = _read_ssdp_headers(data)
                    serial = _clean_serial(headers.get("usn", ""))

                    if not serial:
                        continue

                    if _same_host(headers.get("location", ""), self.host):
                        return serial

                    if not fallback:
                        fallback = serial
        except OSError as error:
            # Нет сети, порт занят, широковещание запрещено политикой — не повод
            # падать: серийник можно получить из отчёта.
            logger.warning(
                "Bambu %s: SSDP-поиск серийника не удался: %s",
                self.host,
                error,
            )
            return ""

        return fallback

    def connect(self) -> bool:
        """
        Поднимает MQTT-соединение с принтером.

        True — CONNACK получен и подписка на отчёты оформлена. False — принтер
        выключен, не в сети, не принял код доступа, остался без серийника или
        молчал дольше `CONNECT_TIMEOUT`: задание уйдёт в `failed`, а агент
        продолжит опрос.

        Серийник ищется здесь один раз (`_ensure_serial`: задание → сертификат →
        SSDP). Не нашёлся — отказ с `SERIAL_REQUIRED_ERROR`: без номера топики
        неизвестны, а шаблонную подписку принтер рвёт разрывом TLS, поэтому
        «подключимся и подождём номер из отчёта» невозможно.
        """
        if self._client is not None:
            # Соединение уже поднято: повторный connect() ничего не ломает.
            return True

        if not self.host:
            logger.error("Bambu: пустой адрес принтера — подключаться некуда")
            return False

        if not self.api_key.strip():
            logger.error(
                "Bambu %s: не задан код доступа (LAN access code)", self.host
            )
            return False

        if not self._ensure_serial():
            # Без серийника брокер не даёт ни отчётов, ни команд: топики
            # адресуются номером, а шаблонную подписку принтер рвёт.
            self.last_error = SERIAL_REQUIRED_ERROR
            logger.error("Bambu %s: %s", self.host, self.last_error)
            return False

        self._connected.clear()

        client = mqtt.Client(
            CallbackAPIVersion.VERSION2,
            client_id=f"tridi-{self.serial_number or self.host}",
        )
        # Сертификат принтера самоподписанный: цепочку и имя хоста не сверяем.
        client.tls_set(cert_reqs=ssl.CERT_NONE)
        client.tls_insecure_set(True)
        client.username_pw_set(DEVICE_USER, self.api_key)
        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message

        try:
            client.connect(self.host, MQTT_PORT, keepalive=MQTT_KEEPALIVE)
        except OSError as error:
            self.last_error = f"принтер не отвечает по MQTT (порт {MQTT_PORT}): {error}"
            logger.error("Bambu %s не отвечает на MQTT: %s", self.host, error)
            return False

        client.loop_start()

        if not self._connected.wait(CONNECT_TIMEOUT):
            self.last_error = (
                f"MQTT не подтвердил подключение за {CONNECT_TIMEOUT} с: "
                "проверьте LAN-режим и код доступа"
            )
            logger.error(
                "Bambu %s: MQTT не подтвердил подключение за %d с",
                self.host,
                CONNECT_TIMEOUT,
            )
            self._stop(client)
            return False

        self._client = client

        if not self._subscribe(client):
            self.last_error = (
                "принтер не принял подписку на отчёты "
                f"(device/{self.serial_number}/report): проверьте серийный "
                "номер (SN) в карточке принтера"
            )
            self._client = None
            self._stop(client)
            return False

        if not self._publish(
            {"pushing": {"sequence_id": self._next_sequence(), "command": "pushall"}},
            retry=False,
        ):
            # Отчёты придут и изменениями, так что это предупреждение, а не
            # отказ: соединение уже рабочее.
            logger.warning(
                "Bambu %s: полный статус (pushall) не запрошен", self.host
            )

        logger.info(
            "Bambu %s подключён по MQTT, серийник %r",
            self.host,
            self.serial_number or "неизвестен",
        )

        self.last_error = None

        return True

    def _stop(self, client: mqtt.Client) -> None:
        """Останавливает сетевой поток paho и закрывает сокет."""
        client.loop_stop()

        try:
            client.disconnect()
        except OSError as error:
            # Соединение уже закрыто принтером — закрывать нечего.
            logger.debug("Bambu %s: MQTT отключён с ошибкой: %s", self.host, error)

    def _ensure_connection(self, timeout: float) -> bool:
        """
        Рабочее MQTT-соединение: ждёт переподключения paho или поднимает новое.

        `timeout` — сколько ждать автоматического переподключения (0 — только
        проверить, что связь есть). Нужно перед каждой командой: после обрыва
        paho восстанавливает соединение в своём потоке, но не мгновенно, а
        публикация идёт с QoS 0 и в этот промежуток теряется молча.

        Не дождались — старый клиент останавливаем и поднимаем новый: paho
        после нескольких неудач уходит в долгий backoff, а задание ждать не
        может.
        """
        client = self._client

        if client is not None and client.is_connected():
            return True

        if client is not None:
            deadline = time.monotonic() + timeout

            while time.monotonic() < deadline:
                if client.is_connected():
                    return True

                time.sleep(CONNECT_POLL)

            if timeout <= 0:
                # Проверка без ожидания: клиент не трогаем, paho ещё может его
                # поднять — так `retry=False` из `connect()` не рвёт соединение.
                return False

            logger.warning(
                "Bambu %s: MQTT не восстановился за %.0f с — переподключаюсь",
                self.host,
                timeout,
            )
            self._client = None
            self._stop(client)

        if timeout <= 0:
            return False

        return self.connect()

    def _publish(self, command: dict[str, Any], *, retry: bool = True) -> bool:
        """
        Команда принтеру в `device/<serial>/request`.

        Без серийника публиковать некуда: в шаблонный топик `device/+/request`
        брокер отправит сообщение «в никуда», поэтому такой вызов — False и
        строка в журнале, а не молчаливая потеря команды.

        Соединение проверяется перед отправкой, а если брокер всё же ответил
        `MQTT_ERR_NO_CONN` (обрыв между проверкой и публикацией) — одна попытка
        переподключения и повтор. `retry=False` — для вызовов изнутри самого
        `connect()`: там переподключение уже идёт, и повтор дал бы рекурсию.
        """
        if not self._ensure_connection(CONNECT_RETRY_TIMEOUT if retry else 0.0):
            logger.error(
                "Bambu %s: нет MQTT-соединения — команда не отправлена",
                self.host,
            )
            return False

        if not self.serial_number:
            logger.error(
                "Bambu %s: серийный номер неизвестен — команда не отправлена",
                self.host,
            )
            return False

        result = self._send(command)

        if result == mqtt.MQTT_ERR_SUCCESS:
            return True

        if not retry or result != mqtt.MQTT_ERR_NO_CONN:
            logger.error(
                "Bambu %s: команда в device/%s/request не отправлена (код %s)",
                self.host,
                self.serial_number,
                result,
            )
            return False

        logger.warning(
            "Bambu %s: соединение оборвалось при отправке (код %s) — "
            "переподключаюсь и повторяю",
            self.host,
            result,
        )

        if not self._ensure_connection(CONNECT_RETRY_TIMEOUT):
            logger.error(
                "Bambu %s: нет MQTT-соединения — команда не отправлена",
                self.host,
            )
            return False

        if not self.serial_number:
            logger.error(
                "Bambu %s: серийный номер неизвестен — команда не отправлена",
                self.host,
            )
            return False

        result = self._send(command)

        if result == mqtt.MQTT_ERR_SUCCESS:
            return True

        logger.error(
            "Bambu %s: команда не отправлена и после переподключения (код %s)",
            self.host,
            result,
        )

        return False

    def _send(self, command: dict[str, Any]) -> int:
        """Публикация команды без проверок: код результата paho."""
        client = self._client

        if client is None:
            return mqtt.MQTT_ERR_NO_CONN

        info = client.publish(
            f"device/{self.serial_number}/request",
            json.dumps(command, ensure_ascii=False),
            qos=0,
        )

        return info.rc

    def _wait_reply(self, sequence: str) -> dict[str, Any] | None:
        """
        Ответ принтера на команду с этим `sequence_id` (None — не дождались).

        Ответ приходит в потоке paho, поэтому ждём опросом своего словаря.
        Ожидание обязательно: `_publish()` возвращает True уже после отправки в
        брокер, а принял ли команду принтер, видно только по ответу.
        """
        deadline = time.monotonic() + COMMAND_REPLY_TIMEOUT

        while time.monotonic() < deadline:
            reply = self._replies.pop(sequence, None)

            if reply is not None:
                return reply

            time.sleep(COMMAND_REPLY_POLL)

        return None

    def close(self) -> None:
        """Закрывает MQTT-соединение: агент зовёт метод в конце задания."""
        client = self._client
        self._client = None

        if client is not None:
            self._stop(client)

    def prepare_upload(self, local_path: str, remote_name: str) -> UploadPlan:
        """
        Проверяет проект `.3mf` до сети и запоминает, что печатать.

        Формат и имя приводит база (`formats.ensure_format()`), а здесь
        остаются две вещи, которые знает только адаптер:

          1. контейнер должен быть готовым проектом Bambu Studio — внутри
             нарезанный G-code пластины и профиль слайсера
             (`read_bambu_project()`). Плоский G-code, STL и `.3mf` без нарезки
             прошивка не разбирает: отказ приходит здесь, до сети, а не после
             загрузки сотни мегабайт на карту;
          2. проект должен быть нарезан для этой модели принтера
             (`bambu_compat_error()`): профиль чужого принтера ломает печать —
             другие температуры, скорости и объём.

        Найденная запись пластины (`Metadata/plate_2.gcode`) остаётся в
        `self._gcode_part`: `start_print()` обязан указать её в `param`, иначе
        принтер ищет в контейнере несуществующую первую пластину.

        Готовый `.3mf` уходит как есть, имя контейнера не меняется: команда
        печати указывает на тот файл, который лёг на карту, иначе принтер
        ответит «файл не найден».
        """
        plan = super().prepare_upload(local_path, remote_name)
        project = read_bambu_project(plan.path)
        mismatch = bambu_compat_error(project.printer_model, self.brand, self.model)

        if mismatch is not None:
            raise FormatError(mismatch)

        self._gcode_part = project.gcode_part
        logger.info(
            "Bambu %s: проект %s — пластина %d (%s), нарезан для %s",
            self.host,
            plan.remote_name,
            project.plate,
            project.gcode_part,
            project.printer_model or "неизвестного принтера",
        )

        return plan

    def upload_file(self, local_path: str, remote_name: str) -> bool:
        """
        Загружает файл задания на принтер, начиная с `prepare_upload()`.

        Подготовка — формат, имя и проверка проекта — в `prepare_upload()` и
        `formats.py`. Здесь остаются две вещи: превратить отказ подготовки в
        `last_error` (мастер увидит причину, а не «задание провалилось») и
        передать файл в `_upload_file()`.

        Временных файлов у Bambu больше нет: агент не пакует G-code, а
        загружает проект как есть, поэтому `cleanup_upload()` ничего не удалит.
        """
        try:
            plan = self.prepare_upload(local_path, remote_name)
        except FormatError as error:
            self.last_error = str(error)
            logger.error("Bambu %s: %s не загружен: %s", self.host, remote_name, error)
            return False
        except (OSError, zipfile.BadZipFile) as error:
            self.last_error = f"файл не подготовлен к загрузке: {error}"
            logger.error(
                "Bambu %s: %s не подготовлен к загрузке: %s",
                self.host,
                local_path,
                error,
            )
            return False

        try:
            return self._upload_file(plan.path, plan.remote_name)
        finally:
            self.cleanup_upload(plan)

    def _upload_file(self, local_path: str, remote_name: str) -> bool:
        """
        Кладёт готовый файл в папку `cache` на карте памяти принтера.

        FTPS, порт 990, логин `bblp` и код доступа: тот же пароль, что у MQTT.
        Папка та же, откуда прошивка берёт файл по `url` команды `project_file`
        (`FTP_CACHE_DIRECTORY`): путь в команде печати и фактический путь файла
        обязаны совпадать, иначе A1 отвечает `0500-4003`.

        Порядок попыток:

          1. FTPS: `TYPE I`, затем `STOR` и запись в канал данных вручную
             (`_upload_once`) — `storbinary()` не годится, он висит на `unwrap()`
             после последнего байта;
          2. когда FTPS не прошёл, последняя попытка идёт по HTTP
             (`_upload_via_http`) — для прошивок с `/api/files/local`.

        Повторы FTPS идут до `FTP_UPLOAD_ATTEMPTS` раз: Bambu рвёт канал данных,
        когда карта занята печатью или когда TLS-сессия не переиспользована.
        Каждая попытка — новое соединение, пауза между попытками нарастает, а
        причина последнего отказа остаётся в `last_error`: main.py отправит её в
        мастерскую вместе со статусом, и мастер увидит, на каком шаге всё встало.
        """
        if not self.api_key.strip():
            self.last_error = "не задан код доступа Bambu Lab (LAN access code)"
            logger.error(
                "Bambu %s: не задан код доступа — FTPS не пустит", self.host
            )
            return False

        try:
            local_size = os.path.getsize(local_path)
        except OSError as error:
            self.last_error = f"файл не прочитан: {error}"
            logger.error("G-code %s не прочитан: %s", local_path, error)
            return False

        # Имя файла с папкой: `STOR cache/<имя>` кладёт его туда, откуда прошивка
        # берёт файл по `param` команды печати.
        remote_path = f"{FTP_CACHE_DIRECTORY}/{remote_name}"
        reason = "неизвестная ошибка"

        for attempt in range(1, FTP_UPLOAD_ATTEMPTS + 1):
            logger.info(
                "Bambu %s: попытка %d/%d — загружаю %s (%d байт) по FTPS",
                self.host,
                attempt,
                FTP_UPLOAD_ATTEMPTS,
                remote_name,
                local_size,
            )
            failure = self._upload_once(local_path, remote_path, local_size)

            if failure is None:
                self.last_error = None
                logger.info("Bambu %s: загружен %s", self.host, remote_path)
                return True

            reason = failure

            if _looks_like_reset(failure):
                logger.warning(
                    "Bambu %s: канал данных сброшен (%s) — повторяю загрузку",
                    self.host,
                    failure,
                )

            logger.warning(
                "Bambu %s: попытка %d/%d загрузить %s не удалась: %s",
                self.host,
                attempt,
                FTP_UPLOAD_ATTEMPTS,
                remote_name,
                reason,
            )

            if attempt < FTP_UPLOAD_ATTEMPTS:
                time.sleep(FTP_RETRY_DELAY * attempt)

        logger.warning(
            "Bambu %s: FTPS не справился (%s) — пробую HTTP %s",
            self.host,
            reason,
            HTTP_UPLOAD_PATH,
        )
        http_failure = self._upload_via_http(local_path, remote_name)

        if http_failure is None:
            self.last_error = None
            logger.info(
                "Bambu %s: загружен %s (HTTP %s)",
                self.host,
                remote_name,
                HTTP_UPLOAD_PATH,
            )
            return True

        self.last_error = (
            f"G-code не загружен на принтер: {reason}; "
            f"HTTP-фолбэк: {http_failure}"
        )
        logger.error(
            "Bambu %s: файл %s не загружен. FTPS: %s. HTTP: %s",
            self.host,
            remote_name,
            reason,
            http_failure,
        )

        return False

    def _open_ftp(self) -> _ImplicitFtpTls:
        """
        Соединение с принтером, готовое к передаче файла.

        Шаги те же, что делает Bambu Studio, и каждый пишется в журнал: при
        обрыве видно, на чём именно принтер закрыл сессию.

        `PROT P` обязателен. Канал управления у Bambu под TLS с первого байта, и
        незашифрованный канал данных принтер рвёт сбросом, поэтому отказ `PROT P`
        — это ошибка загрузки, а не повод продолжить без шифрования. Пассивный
        режим тоже обязателен: принтер не открывает соединение к агенту, а порт
        990 за NAT мастерской недоступен.

        Исключения не глотаем: их переводит в причину отказа вызывающий метод.
        """
        ftp = _ftp_client()

        try:
            logger.info(
                "Bambu %s: FTPS — соединяюсь с %s:%d (таймаут %d с)",
                self.host,
                self.host,
                FTP_PORT,
                FTP_TIMEOUT,
            )
            ftp.connect(self.host, FTP_PORT, timeout=FTP_TIMEOUT)
            logger.info(
                "Bambu %s: FTPS — приветствие получено, TLS %s",
                self.host,
                _tls_version(ftp),
            )
            ftp.login(DEVICE_USER, self.api_key)
            logger.info(
                "Bambu %s: FTPS — логин %s принят", self.host, DEVICE_USER
            )
            ftp.set_pasv(True)
            logger.info("Bambu %s: FTPS — пассивный режим включён", self.host)
            ftp.prot_p()
            logger.info(
                "Bambu %s: FTPS — PROT P принят, канал данных под TLS", self.host
            )
            # Папку `cache` создаём один раз: на чистой карте её может не быть, а
            # `STOR cache/<имя>` без неё вернёт `550`. Ответ «уже существует» —
            # это норма, поэтому отказ `mkd` здесь не ошибка загрузки.
            try:
                ftp.mkd(FTP_CACHE_DIRECTORY)
                logger.info(
                    "Bambu %s: FTPS — папка %s создана",
                    self.host,
                    FTP_CACHE_DIRECTORY,
                )
            except ftplib.error_perm:
                logger.info(
                    "Bambu %s: FTPS — папка %s уже есть",
                    self.host,
                    FTP_CACHE_DIRECTORY,
                )
        except (OSError, ftplib.Error):
            _close_ftp(ftp)
            raise

        return ftp

    def _upload_once(
        self, local_path: str, remote_path: str, local_size: int
    ) -> str | None:
        """
        Одна попытка загрузки: None — файл на карте, строка — причина отказа.

        Файл пишется в сокет вручную, а не через `storbinary()`. `storbinary()`
        прячет все шаги в одном вызове и на финале делает `unwrap()`: TLS-разрыв
        ждёт ответный `close_notify`, которого Bambu не присылает, — передача
        висит уже после последнего байта, и до `start_print()` дело не доходит.
        Здесь `TYPE I` и `STOR` разведены по шагам, куски уходят `sendall()`, а
        канал данных закрывается без рукопожатия: принтер понимает конец файла по
        закрытию соединения и отвечает `226`.

        Размер после `STOR` сверяем с локальным: принтер отвечает `226`, даже
        когда карта заполнена и файл записался частично, а печать такого файла
        встанет на середине. Если сервер не поддерживает `SIZE`, проверку
        пропускаем — это подсказка, а не обязательный шаг.
        """
        try:
            ftp = self._open_ftp()

            try:
                ftp.voidcmd("TYPE I")
                logger.info(
                    "Bambu %s: FTPS — TYPE I принят, STOR %s (%d байт, "
                    "кусками по %d КБ)",
                    self.host,
                    remote_path,
                    local_size,
                    FTP_BLOCK_SIZE // 1024,
                )
                conn = ftp.transfercmd(f"STOR {remote_path}")
                logger.info(
                    "Bambu %s: FTPS — канал данных открыт (таймаут %d с)",
                    self.host,
                    FTP_DATA_TIMEOUT,
                )
                sent = 0
                reported = 0

                try:
                    with open(local_path, "rb") as gcode:
                        while True:
                            chunk = gcode.read(FTP_BLOCK_SIZE)

                            if not chunk:
                                break

                            conn.sendall(chunk)
                            sent += len(chunk)

                            if sent - reported >= FTP_PROGRESS_STEP:
                                reported = sent
                                logger.info(
                                    "Bambu %s: FTPS — отправлено %d из %d байт",
                                    self.host,
                                    sent,
                                    local_size,
                                )
                finally:
                    # Закрытие без `unwrap()`: Bambu не присылает `close_notify`,
                    # и рукопожатие на выходе повисло бы до таймаута.
                    conn.close()

                logger.info(
                    "Bambu %s: FTPS — файл отправлен (%d байт), жду ответа принтера",
                    self.host,
                    sent,
                )
                ftp.voidresp()
                logger.info(
                    "Bambu %s: FTPS — %s принят принтером", self.host, remote_path
                )
                self._verify_remote_size(ftp, remote_path, local_size)
            finally:
                _close_ftp(ftp)
        except (OSError, ftplib.Error) as error:
            # OSError покрывает и выключенный принтер, и обрыв канала данных
            # (WinError 10054), и таймаут сокета данных, и отсутствующий файл.
            reason = _describe(error)
            logger.warning(
                "Bambu %s: FTPS — загрузка %s прервана: %s",
                self.host,
                remote_path,
                reason,
            )

            return reason

        return None

    def _upload_via_http(self, local_path: str, remote_name: str) -> str | None:
        """
        Последняя попытка, если FTPS не проходит: `POST /api/files/local`.

        Заголовок `X-Api-Key` и поле `file` — формат, который понимают
        OctoPrint-подобные прошивки. В LAN-режиме Bambu этот адрес официально не
        документирован, поэтому попытка одна: ответ 200 или 201 — файл принят,
        любой другой — причина отказа в `last_error`. Нужен на случай прошивки,
        где FTP-порт закрыт, а HTTP-приём файлов включён.

        Соединение ограничено отдельным таймаутом: недоступный адрес не должен
        держать задание дольше `HTTP_UPLOAD_CONNECT_TIMEOUT`.
        """
        url = f"http://{self.host}{HTTP_UPLOAD_PATH}"
        logger.info(
            "Bambu %s: HTTP — отправляю %s на %s", self.host, remote_name, url
        )

        try:
            with open(local_path, "rb") as gcode:
                response = requests.post(
                    url,
                    headers={"X-Api-Key": self.api_key},
                    files={"file": (remote_name, gcode, "application/octet-stream")},
                    data={"select": "true"},
                    timeout=(HTTP_UPLOAD_CONNECT_TIMEOUT, HTTP_UPLOAD_TIMEOUT),
                )
        except (OSError, requests.RequestException) as error:
            reason = _describe(error)
            logger.warning(
                "Bambu %s: HTTP — %s не принят: %s",
                self.host,
                remote_name,
                reason,
            )

            return reason

        if response.status_code in (200, 201):
            logger.info(
                "Bambu %s: HTTP — %s принят (%d)",
                self.host,
                remote_name,
                response.status_code,
            )

            return None

        body = " ".join(response.text.split())[:200]
        logger.warning(
            "Bambu %s: HTTP — %s отклонён: %d %s",
            self.host,
            remote_name,
            response.status_code,
            body,
        )

        return f"HTTP {response.status_code}: {body}"

    def _verify_remote_size(
        self, ftp: _ImplicitFtpTls, remote_path: str, local_size: int
    ) -> None:
        """Сверяет размер файла на карте с локальным; расхождение — ошибка."""
        try:
            remote_size = ftp.size(remote_path)
        except (OSError, ftplib.Error) as error:
            logger.info(
                "Bambu %s: размер %s не проверен (SIZE не поддержан: %s)",
                self.host,
                remote_path,
                error,
            )
            return

        if remote_size is None or remote_size == local_size:
            return

        raise ftplib.error_temp(
            f"на карте {remote_size} байт вместо {local_size}: файл записан не целиком"
        )

    def start_print(self, remote_name: str) -> bool:
        """
        Запускает печать загруженного контейнера командой `project_file`.

        Печатается всегда проект: плоский `.gcode` A1 отклоняет на любой команде
        `gcode_file`, поэтому загружается только `.3mf` из Bambu Studio, а
        команда указывает на записи внутри контейнера — `param` это запись
        пластины (`Metadata/plate_1.gcode` или та, что нашлась в проекте), `url`
        — сам файл на карте.

        Имя файла — то же, что легло на карту (`prepare_upload()` его не меняет):
        команда с чужим именем заставила бы принтер искать несуществующий файл.

        Отправка в брокер ничего не подтверждает (QoS 0), поэтому после каждой
        команды ждём отчёт с тем же `sequence_id` (`_wait_reply`). Отказ принтера
        — это `False` и его `reason` в `last_error`: main.py отправит причину
        мастеру, а не «печать запущена» с последующим молчанием.

        Принтер умеет ответить `success`, а через полминуты прислать `fail`
        с причиной (файл не разобран, `0500-4003`): такой отказ ловит
        `_remember_reply`, помечает `_command_error`, и `get_status()` начинает
        отдавать `error` — цикл мониторинга закроет задание как `failed`.

        Перед командой адаптер ждёт связь: обрыв MQTT во время FTPS-загрузки —
        обычное дело, и paho поднимает соединение в своём потоке. Серийник при
        этом не ждём и из отчётов его не берём: отчёт приходит в топик, который
        из номера и строится. Пустой SN — сразу отказ с `SERIAL_REQUIRED_ERROR`,
        без переподключений и таймаутов.
        """
        # Серийник — первая проверка: без него неизвестен топик команды, и
        # ожидание связи ничего не даст. Номер ищет `connect()` (задание →
        # сертификат → SSDP), поэтому здесь остаётся только честный отказ.
        if not self.serial_number:
            self.last_error = SERIAL_REQUIRED_ERROR
            logger.error("Bambu %s: %s", self.host, self.last_error)
            return False

        # Пометка прошлого отказа не должна красить новую печать.
        self._command_error = None

        if not self._ensure_connection(CONNECT_RETRY_TIMEOUT):
            self.last_error = "команда печати не отправлена: нет MQTT-соединения"
            logger.error("Bambu %s: %s", self.host, self.last_error)
            return False

        printable = remote_name
        payloads = _project_file_payloads(printable, self._gcode_part)
        last_error = "команда печати не отправлена: нет MQTT-соединения"

        for fields in payloads:
            sequence = self._next_sequence()
            command = {"print": {"sequence_id": sequence, **fields}}

            logger.info(
                "Bambu %s: печать %s — отправляю %s",
                self.host,
                printable,
                json.dumps(command, ensure_ascii=False),
            )

            if not self._publish(command):
                self.last_error = last_error
                return False

            failure = _reply_error(self._wait_reply(sequence))

            if failure is None:
                self.last_error = None
                self._forget_previous_print()
                logger.info("Bambu %s: печать %s запущена", self.host, printable)
                return True

            last_error = failure
            logger.warning(
                "Bambu %s: печать %s не принята: %s",
                self.host,
                printable,
                failure,
            )

        logger.error(
            "Bambu %s: печать %s не запущена: %s", self.host, printable, last_error
        )
        self.last_error = last_error

        return False

    def stop_print(self) -> bool:
        """
        Останавливает текущую печать командой `print.stop`.

        Bambu принимает её и на паузе, и во время печати: принтер опускает стол
        и завершает задание как отменённое. Без серийника команду отправить
        некуда — `_publish` вернёт False и объяснит причину в журнале.
        """
        command = {
            "print": {
                "sequence_id": self._next_sequence(),
                "command": "stop",
            }
        }

        if not self._publish(command):
            self.last_error = "команда остановки не отправлена: нет MQTT-соединения"
            return False

        self.last_error = None
        logger.info("Bambu %s: печать остановлена по просьбе мастера", self.host)

        return True

    def get_status(self) -> dict[str, Any]:
        """
        Состояние печати из последнего отчёта принтера.

        Отчётов ещё не было (принтер только подключился) — `idle` с нулями:
        цикл агента продолжит опрос. `mc_remaining_time` у Bambu в минутах, а
        контракт адаптера ждёт секунды.
        """
        report = self._report

        if not report:
            return {
                "status": "error" if self._command_error else "idle",
                "progress": 0,
                "remaining_time": 0,
            }

        raw_state = report.get("gcode_state")
        state = raw_state.strip().upper() if isinstance(raw_state, str) else ""
        status = _STATE_MAP.get(state)

        if status is None:
            logger.warning(
                "Bambu %s: неизвестное состояние печати %r, отдаю error",
                self.host,
                raw_state,
            )
            status = "error"

        # Отказ команды печати сильнее любого `idle` в отчёте: прошивка после
        # `result: fail` остаётся в простое, и без этого задание закрывалось как
        # `done` на 100 %, хотя печать не начиналась.
        if self._command_error:
            status = "error"

        # Принтер сам сказал, что печать прервана: `FAILED` — сбой, `CANCELLED` —
        # отмена с экрана или из Bambu Studio. Причину он пишет рядом
        # (`fail_reason`, `print_error`, `mc_print_error_code`), и без неё в CRM
        # уходило общее «печать прервана», а отмена выглядела как потеря связи.
        # Отказ команды (`_command_error`) важнее: он называет первопричину —
        # почему печать вообще не пошла.
        if state in _FAILURE_STATES:
            status = "error"
            failure = _report_failure(report)

            # Причина отчёта читается мастеру как есть, но с пояснением: голое
            # `fail_reason: cancelled` в карточке заказа выглядело бы обрывком.
            if failure:
                self.last_error = (
                    self._command_error or f"принтер прервал печать: {failure}"
                )
            else:
                self.last_error = (
                    self._command_error
                    or f"принтер прервал печать (gcode_state: {state})"
                )

            logger.error(
                "Bambu %s: печать прервана (%s): %s",
                self.host,
                state,
                self.last_error,
            )

        # Прогресс в отчёте уже в процентах; ограничение — от мусора в полях.
        percent = _as_number(report.get("mc_percent"))
        progress = int(round(min(max(percent, 0.0), 100.0)))

        # Печать не идёт — остаток не нужен: принтер присылает последнее
        # известное значение и после FINISH.
        remaining_time = 0

        if status == "printing":
            minutes = _as_number(report.get("mc_remaining_time"))
            remaining_time = int(round(max(minutes, 0.0) * 60))

        return {
            "status": status,
            "progress": progress,
            "remaining_time": remaining_time,
        }
