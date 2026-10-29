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
  - `upload_file()` — `ftplib.FTP_TLS` на порт 990. У Bambu TLS включается сразу
    после TCP-соединения (implicit TLS), а стандартный `FTP_TLS.connect()`
    соединяется открытым текстом и ждёт `AUTH TLS`, которого принтер не
    присылает: поэтому `connect()` подменён наследником `_ImplicitFtpTls`, а
    вся остальная работа остаётся стандартной библиотеке. Файл кладём в папку
    `cache` на карте памяти;
  - `start_print()` — команда `project_file` в `device/<serial>/request`: файл
    уже на карте памяти, принтер забирает его по `url` (`ftp:///cache/<имя>`);
  - `get_status()`  — последний отчёт принтера: `print.gcode_state`,
    `print.mc_percent` (проценты) и `print.mc_remaining_time` (минуты).

Серийный номер. Bambu адресует топики серийником, а в настройках Мастерской
мастер вводит только адрес и код доступа. Номер приходит в задании
(`printer.serialNumber`); если его нет, адаптер ищет принтер по SSDP (UDP 1990,
в ответе поле `USN`). Пока номер неизвестен, подписка идёт на `device/+/report`
— первый же отчёт даёт настоящий серийник из топика, после чего адаптер
переподписывается на точный. Команду печати без серийника отправить нельзя:
`start_print()` вернёт False и напишет причину в журнал.

Сеть. Ни один метод не выпускает сетевые исключения наружу: выключенный принтер
— это запись в журнале и `False` (или `status = "error"` у `get_status()`), а не
падение агента. Таймауты обязательны: без них сокет ждёт вечно, и цикл опроса
встаёт вместе с принтером.
"""
from __future__ import annotations

import ftplib
import json
import logging
import socket
import ssl
import threading
import time
from typing import Any

import paho.mqtt.client as mqtt
from paho.mqtt.enums import CallbackAPIVersion

from .base import BasePrinterAdapter

logger = logging.getLogger("agent.adapters.bambu")

# Порты LAN-режима Bambu: MQTT с TLS и implicit FTPS.
MQTT_PORT = 8883
FTP_PORT = 990

# Пользователь у Bambu всегда один; пароль — LAN access code с экрана принтера.
DEVICE_USER = "bblp"

# Папка на карте памяти, куда кладём G-code. Её же повторяем в `url` команды
# печати: принтер ищет файл ровно там, куда его положили.
FTP_DIRECTORY = "cache"

# Keepalive MQTT: принтер замечает пропажу агента за минуту-две. Чаще слать
# PINGREQ незачем — сеть мастерской и так нагружена отчётами.
MQTT_KEEPALIVE = 30

# Сколько ждать CONNACK. Выключенный принтер не отвечает вообще, и ждать его
# дольше десяти секунд агент не должен: задание уйдёт в `failed`.
CONNECT_TIMEOUT = 10

# Загрузка G-code идёт дольше опроса: файл на десятки мегабайт по Wi-Fi
# передаётся минутами, обрывать его на десяти секундах нельзя.
FTP_TIMEOUT = 120

# Сколько слушать ответы SSDP при поиске серийника.
DISCOVERY_TIMEOUT = 3.0

# Адрес и тип устройства для SSDP-поиска принтеров Bambu.
SSDP_ADDRESS = ("239.255.255.250", 1990)
SSDP_TARGET = "urn:bambulab-com:device:3dprinter:1"

# `param` команды печати: запись внутри файла, которую запускает Bambu. Именно
# это значение присылает Bambu Studio в `project_file`.
GCODE_PARAM = "Metadata/plate_1.gcode"

# `print.gcode_state` принтера → статус агента. `PREPARE` — это ещё не печать,
# но принтер уже занят заданием, и мастеру важно это видеть. `PAUSE` отдаём как
# `error`: печать стоит и сама не продолжится.
_STATE_MAP: dict[str, str] = {
    "RUNNING": "printing",
    "PREPARE": "printing",
    "FINISH": "idle",
    "IDLE": "idle",
    "FAILED": "error",
    "PAUSE": "error",
}


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
    Серийный номер из поля `USN` SSDP-ответа.

    У Bambu это строка вида `00M09A123456789`. Пустое значение и строка с
    пробелами — не серийник, а мусор от чужого устройства в подсети.
    """
    serial = value.strip()

    if not serial or any(character.isspace() for character in serial):
        return ""

    return serial


class _ImplicitFtpTls(ftplib.FTP_TLS):
    """
    FTPS, который включает TLS сразу после TCP-соединения (implicit, порт 990).

    `ftplib.FTP_TLS.connect()` соединяется открытым текстом и только потом
    отправляет `AUTH TLS`. Bambu так не умеет: на 990 порту TLS начинается первым
    же байтом, и стандартный `connect()` повиснет на чтении приветствия.
    Поэтому подменён только `connect()`: рукопожатие до чтения приветствия, а
    `login()`, `prot_p()`, `storbinary()` остаются из стандартной библиотеки.
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


def _ftp_client() -> _ImplicitFtpTls:
    """
    FTP-клиент для принтера: TLS без проверки сертификата.

    Bambu выдаёт самоподписанный сертификат на каждый принтер, и проверять его
    нечем: в Мастерской нет поля для сертификата. Поэтому `check_hostname`
    снимаем первым — `verify_mode = CERT_NONE` при включённой сверке имени
    хоста `ssl` не примет.
    """
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

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


class BambuAdapter(BasePrinterAdapter):
    """Принтер Bambu Lab в LAN-режиме: MQTT для команд, FTPS для файлов."""

    def __init__(
        self,
        ip_address: str,
        api_key: str,
        serial_number: str = "",
    ) -> None:
        """
        `ip_address` — адрес принтера в сети мастера (`192.168.1.60`), порт не
        нужен: MQTT и FTPS у Bambu всегда на 8883 и 990.

        `api_key` — LAN access code с экрана принтера (Settings → Network).

        `serial_number` — серийник с наклейки или из задания. Пустая строка не
        ошибка: номер ищется по SSDP при `connect()`, а если и там не нашёлся —
        берётся из топика первого отчёта.
        """
        super().__init__(ip_address=ip_address, api_key=api_key)
        self.serial_number = serial_number.strip()
        # Хост без схемы и порта: и MQTT, и FTPS ходят на свои фиксированные.
        self.host = _host(ip_address)
        self._client: mqtt.Client | None = None
        self._connected = threading.Event()
        # Последний отчёт принтера: Bambu присылает только изменившиеся поля,
        # поэтому словарь не заменяется, а дополняется.
        self._report: dict[str, Any] = {}
        self._sequence = 0

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
        """
        report = _as_mapping(payload.get("print"))

        if report:
            self._report.update(report)

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

    def _on_message(
        self,
        client: mqtt.Client,
        userdata: Any,
        message: mqtt.MQTTMessage,
    ) -> None:
        """
        Отчёт принтера: `device/<serial>/report`.

        Из топика берём серийник, если он ещё неизвестен (подписка была на
        `device/+/report`), из тела — поля для `get_status()`. Разбор мусора не
        должен ронять поток paho: ошибки только пишутся в журнал.
        """
        self._learn_serial_from_topic(message.topic)

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
            self._apply_report(payload)

    def _learn_serial_from_topic(self, topic: str) -> None:
        """
        Серийник из топика `device/<serial>/report`.

        Нужен, когда номер не передали в задании и SSDP не ответил: без него
        нельзя ни отправить команду, ни подписаться на точный топик.
        """
        parts = topic.split("/")

        if len(parts) < 3 or parts[0] != "device" or parts[2] != "report":
            return

        serial = _clean_serial(parts[1])

        if not serial or serial == self.serial_number:
            return

        self.serial_number = serial
        logger.info("Bambu %s: серийный номер %s из отчёта", self.host, serial)

        # Точная подписка вместо `device/+/report`: иначе каждый отчёт пришёл
        # бы дважды — по шаблону и по точному топику.
        client = self._client

        if client is not None:
            client.unsubscribe("device/+/report")
            self._subscribe(client)

    def _subscribe(self, client: mqtt.Client) -> bool:
        """
        Подписка на отчёты принтера.

        Пока серийник неизвестен, подписываемся шаблоном `device/+/report`:
        отчёты придут, и первый же даст настоящий номер. Публиковать команды в
        шаблонный топик нельзя — брокер не доставит их никому, поэтому печать
        без серийника не запустится (см. `_publish`).
        """
        topic = (
            f"device/{self.serial_number}/report"
            if self.serial_number
            else "device/+/report"
        )
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
        Серийник принтера: из задания, из SSDP или пустая строка.

        Пустой результат — не ошибка: агент продолжит и получит состояние из
        первого отчёта, а вот команду печати без номера отправить не сможет.
        """
        if self.serial_number:
            return self.serial_number

        serial = self._discover_serial()

        if serial:
            self.serial_number = serial
            logger.info(
                "Bambu %s: серийный номер %s получен по SSDP",
                self.host,
                serial,
            )
        else:
            logger.warning(
                "Bambu %s: серийный номер неизвестен — беру из первого отчёта",
                self.host,
            )

        return self.serial_number

    def _discover_serial(self) -> str:
        """
        Серийник из SSDP-ответа принтера (UDP, порт 1990).

        Bambu отвечает на M-SEARCH заголовком `USN` с серийником. Если в
        подсети несколько принтеров, нужен тот, чей `Location` совпал с адресом
        задания; остальные — запасной вариант. Ни один не ответил — пустая
        строка: номер возьмём из топика первого отчёта.
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
        выключен, не в сети, не принял код доступа или молчал дольше
        `CONNECT_TIMEOUT`: задание уйдёт в `failed`, а агент продолжит опрос.
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

        self._ensure_serial()
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
        client.on_message = self._on_message

        try:
            client.connect(self.host, MQTT_PORT, keepalive=MQTT_KEEPALIVE)
        except OSError as error:
            logger.error("Bambu %s не отвечает на MQTT: %s", self.host, error)
            return False

        client.loop_start()

        if not self._connected.wait(CONNECT_TIMEOUT):
            logger.error(
                "Bambu %s: MQTT не подтвердил подключение за %d с",
                self.host,
                CONNECT_TIMEOUT,
            )
            self._stop(client)
            return False

        self._client = client

        if not self._subscribe(client):
            self._client = None
            self._stop(client)
            return False

        if not self._publish(
            {"pushing": {"sequence_id": self._next_sequence(), "command": "pushall"}}
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

        return True

    def _stop(self, client: mqtt.Client) -> None:
        """Останавливает сетевой поток paho и закрывает сокет."""
        client.loop_stop()

        try:
            client.disconnect()
        except OSError as error:
            # Соединение уже закрыто принтером — закрывать нечего.
            logger.debug("Bambu %s: MQTT отключён с ошибкой: %s", self.host, error)

    def _publish(self, command: dict[str, Any]) -> bool:
        """
        Команда принтеру в `device/<serial>/request`.

        Без серийника публиковать некуда: в шаблонный топик `device/+/request`
        брокер отправит сообщение «в никуда», поэтому такой вызов — False и
        строка в журнале, а не молчаливая потеря команды.
        """
        client = self._client

        if client is None:
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

        topic = f"device/{self.serial_number}/request"
        payload = json.dumps(command, ensure_ascii=False)
        info = client.publish(topic, payload, qos=0)

        if info.rc != mqtt.MQTT_ERR_SUCCESS:
            logger.error(
                "Bambu %s: команда в %s не отправлена (код %s)",
                self.host,
                topic,
                info.rc,
            )
            return False

        return True

    def close(self) -> None:
        """Закрывает MQTT-соединение: агент зовёт метод в конце задания."""
        client = self._client
        self._client = None

        if client is not None:
            self._stop(client)

    def upload_file(self, local_path: str, remote_name: str) -> bool:
        """
        Кладёт G-code на карту памяти принтера в папку `cache`.

        FTPS, порт 990, логин `bblp` и код доступа: тот же пароль, что у MQTT.
        Папку создаём сами — на чистой карте её может не быть, а `STOR` в
        несуществующий каталог принтер отвергнет. Ошибки папки не страшны: она
        уже есть (код 550), и файл всё равно загрузится.
        """
        if not self.api_key.strip():
            logger.error(
                "Bambu %s: не задан код доступа — FTPS не пустит", self.host
            )
            return False

        remote_path = f"{FTP_DIRECTORY}/{remote_name}"
        ftp = _ftp_client()

        try:
            ftp.connect(self.host, FTP_PORT, timeout=FTP_TIMEOUT)
            ftp.login(DEVICE_USER, self.api_key)

            try:
                ftp.prot_p()
            except ftplib.Error as error:
                # Канал управления уже под TLS; незашифрованный канал данных
                # принтер иногда разрешает. Грузим и пишем предупреждение.
                logger.warning(
                    "Bambu %s: PROT P не принят (%s), канал данных без шифрования",
                    self.host,
                    error,
                )

            try:
                ftp.mkd(FTP_DIRECTORY)
            except ftplib.Error:
                # 550 — папка уже существует: это ожидаемый ответ.
                pass

            with open(local_path, "rb") as gcode:
                ftp.storbinary(f"STOR {remote_path}", gcode)
        except (OSError, ftplib.Error) as error:
            # OSError покрывает и выключенный принтер, и отсутствующий файл.
            logger.error(
                "Bambu %s: файл %s не загружен: %s", self.host, remote_name, error
            )
            return False
        finally:
            _close_ftp(ftp)

        logger.info("Bambu %s: загружен %s", self.host, remote_path)

        return True

    def start_print(self, remote_name: str) -> bool:
        """
        Запускает печать загруженного файла командой `project_file`.

        `url` повторяет путь загрузки (`ftp:///cache/<имя>`): Bambu забирает файл
        с собственной карты памяти, второй раз по сети он не передаётся.
        """
        command = {
            "print": {
                "sequence_id": self._next_sequence(),
                "command": "project_file",
                "param": GCODE_PARAM,
                "url": f"ftp:///{FTP_DIRECTORY}/{remote_name}",
                "bed_type": "auto",
                "timelapse": False,
                "use_ams": False,
            }
        }

        if not self._publish(command):
            return False

        logger.info("Bambu %s: печать %s запущена", self.host, remote_name)

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
            return {"status": "idle", "progress": 0, "remaining_time": 0}

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

