"""
Реестр протоколов принтеров: одно место, где описано, чем агент говорит с
принтером.

Зачем отдельный модуль. До реестра список протоколов жил в двух местах: в
`_ADAPTERS` фабрики и в `PRINTER_PROTOCOLS` приложения. С восемью протоколами
этого мало: сканеру нужны порты, форме добавления — какие секреты спрашивать,
проверке файла — какие расширения принтер печатает, а интерфейсу — что принтер
умеет. Если держать это по файлам, порты и подписи разъедутся молча, и мастер
увидит «принтер не отвечает» там, где агент просто стучался не в тот порт.

Что здесь есть:
  - `ProtocolSpec` — паспорт протокола: подпись для журнала, класс адаптера,
    порты, способ обнаружения, набор возможностей, форматы файлов и имена
    секретов, которые лежат в `workshop_printers.printer_secrets`;
  - `PROTOCOLS` — сам справочник. Ключи совпадают со значениями
    `PRINTER_PROTOCOLS` в lib/db/workshop-types.ts и с check-ограничениями в
    supabase/workshop_printer_secrets.sql — это три места одного списка;
  - `get_protocol()` — поиск по ключу без учёта регистра и пробелов;
  - `load_adapter_class()` — ленивый импорт класса адаптера.

Ленивый импорт — не украшение. Протокол попадает в справочник раньше, чем
появляется его драйвер: так база, форма и сканер знают про `anycubic`,
`flashforge` и `elegoo` уже сегодня, а их модули дописываются следующими шагами.
Пока модуля нет, `load_adapter_class()` поднимает `AdapterUnavailableError` — это
не «неизвестный протокол» (его приложение знает), а честное «драйвера ещё нет»:
задание закрывается отказом с этой причиной, а не молчаливым пропуском.

Откуда порты и способы обнаружения (исследование протоколов, этап 1):
  - moonraker — HTTP 7125, подтверждение `GET /server/info`;
  - octoprint — HTTP 80/443, подтверждение `GET /api/version`;
  - bambu — SSDP UDP 1990 (серийник в USN), дальше MQTT 8883 и FTPS 990;
  - prusa — PrusaLink по HTTP 80/443; локального обнаружения нет, адрес вводят
    руками;
  - creality — WebSocket 9999, подтверждение `GET /info` (код модели);
  - anycubic — MQTT 9883 и HTTP 18910; локального обнаружения нет;
  - flashforge — HTTP 8898, UDP-бродкаст 8899/19000/48899 (серийник в ответе);
  - elegoo — WebSocket 3030 (SDCP), UDP-бродкаст 3000 (`M99999`).

Почему возможности протокола и возможности драйвера — не одно и то же.
`ProtocolSpec.capabilities` описывает, что протокол умеет в принципе; адаптер
объявляет свой набор у себя и может быть скромнее (Moonraker умеет отмену, но
паузы в его драйвере пока нет). Интерфейс смотрит на драйвер: мёртвая кнопка
хуже её отсутствия.
"""
from __future__ import annotations

from dataclasses import dataclass
from importlib import import_module
from typing import Final

from .base import (
    CAPABILITY_CANCEL,
    CAPABILITY_PAUSE,
    CAPABILITY_RESUME,
    CAPABILITY_START,
    CAPABILITY_STATUS,
    CAPABILITY_UPLOAD,
    BasePrinterAdapter,
)

# Как агент находит принтер в сети. Строки, а не Enum: значение уходит в
# журнал и в пробы сканера, где читается глазами.
DISCOVERY_SSDP: Final = "ssdp"
DISCOVERY_UDP: Final = "udp"
DISCOVERY_HTTP: Final = "http"
DISCOVERY_MANUAL: Final = "manual"


class UnknownProtocolError(ValueError):
    """
    Протокола нет в справочнике.

    Наследник ValueError не случайно: main.py уже ловит ValueError вокруг
    `get_adapter()` и закрывает задание отказом «протокол неизвестен агенту», а
    принтер с незнакомым протоколом не должен молча брать задания.
    """


class AdapterUnavailableError(ValueError):
    """
    Протокол известен приложению, но драйвера в агенте ещё нет.

    Тоже ValueError — по той же причине, что и выше, но текст другой: «протокол
    creality ещё не реализован в агенте». Мастеру это говорит о версии агента, а
    не о том, что принтер завели с опечаткой в протоколе.
    """


@dataclass(frozen=True)
class ProtocolSpec:
    """
    Паспорт протокола: всё, что о нём нужно знать вне самого драйвера.

    `adapter` — путь «модуль:Класс» относительно пакета `adapters`. Строка, а не
    класс, именно ради ленивого импорта: справочник собирается без сетевых
    библиотек и без риска уронить агент отсутствующим модулем.

    `ports` — куда стучаться сканеру. Порядок важен: сначала самый характерный
    порт протокола (Creality — 9999 раньше 7125, иначе K2 определится как
    Moonraker и старт печати пойдёт не тем запросом).

    `secrets` — имена полей `workshop_printers.printer_secrets` (jsonb), которые
    нужны драйверу. Первичный секрет (`api_key`: ключ API, код доступа, пароль)
    остаётся отдельной колонкой — ради совместимости с уже заведёнными
    принтерами; в jsonb лежит то, для чего колонки нет.

    `accepts_serial` — передаёт ли фабрика серийный номер в конструктор. Он нужен
    Bambu (топики MQTT) и FlashForge (заголовок `serialNumber` в каждом запросе).
    """

    key: str
    title: str
    adapter: str
    ports: tuple[int, ...]
    discovery: str
    capabilities: frozenset[str]
    formats: tuple[str, ...]
    secrets: tuple[str, ...] = ()
    accepts_serial: bool = False


# Наборы возможностей: минимум и полный контроль над заданием.
_BASE: Final[frozenset[str]] = frozenset(
    {CAPABILITY_UPLOAD, CAPABILITY_START, CAPABILITY_STATUS}
)
_CONTROL: Final[frozenset[str]] = _BASE | {
    CAPABILITY_CANCEL,
    CAPABILITY_PAUSE,
    CAPABILITY_RESUME,
}


PROTOCOLS: Final[dict[str, ProtocolSpec]] = {
    "moonraker": ProtocolSpec(
        key="moonraker",
        title="Moonraker (Klipper)",
        adapter="moonraker:MoonrakerAdapter",
        ports=(7125,),
        discovery=DISCOVERY_HTTP,
        capabilities=_CONTROL,
        # Klipper печатает файлы из `gcodes` с расширением из `file_filter`:
        # `.gcode`, `.gco`, `.g`. `.3mf` он не разбирает — это контейнер
        # слайсера, а не задание печати.
        formats=(".gcode", ".gco", ".g"),
    ),
    "octoprint": ProtocolSpec(
        key="octoprint",
        title="OctoPrint",
        adapter="octoprint:OctoPrintAdapter",
        ports=(80, 443),
        discovery=DISCOVERY_HTTP,
        capabilities=_CONTROL,
        formats=(".gcode", ".gco", ".g"),
    ),
    "bambu": ProtocolSpec(
        key="bambu",
        title="Bambu Lab (LAN)",
        adapter="bambu:BambuAdapter",
        ports=(8883, 990),
        discovery=DISCOVERY_SSDP,
        capabilities=_CONTROL,
        formats=(".3mf", ".gcode"),
        accepts_serial=True,
    ),
    "prusa": ProtocolSpec(
        key="prusa",
        title="Prusa (PrusaLink)",
        adapter="prusa:PrusaAdapter",
        ports=(80, 443),
        discovery=DISCOVERY_MANUAL,
        capabilities=_CONTROL,
        # PrusaLink не печатает `.3mf`: проект PrusaSlicer уходит на принтер
        # только как `.gcode` или бинарный `.bgcode`.
        formats=(".gcode", ".bgcode"),
        # storage — не секрет, а выбор хранилища (`usb` или `local`): своей
        # колонки у него нет, а без него `PUT /api/v1/files/<storage>/…` не
        # собрать.
        secrets=("storage",),
    ),
    "creality": ProtocolSpec(
        key="creality",
        title="Creality (K1 / K2 / Hi)",
        adapter="creality:CrealityAdapter",
        # 9999 — WebSocket команд и телеметрии, 80 — паспорт `/info` и загрузка
        # `/upload/<имя>`. Сканер стучится сначала в 9999: у K2 Plus открыт и
        # 7125 (принтер собран на Klipper), но печатает он только `opGcodeFile`.
        ports=(9999, 80),
        discovery=DISCOVERY_HTTP,
        capabilities=_CONTROL,
        # Только G-code: `opGcodeFile` печатает файл из папки принтера.
        formats=(".gcode",),
    ),
    "anycubic": ProtocolSpec(
        key="anycubic",
        title="Anycubic (Kobra)",
        adapter="anycubic:AnycubicAdapter",
        ports=(9883, 18910),
        discovery=DISCOVERY_MANUAL,
        capabilities=_CONTROL,
        formats=(".gcode",),
        # deviceId и modeId — адресация MQTT-топиков; логин и пароль — LAN-режим
        # принтера. Всё остальное (md5, размер) адаптер считает сам.
        secrets=("username", "password", "deviceId", "modeId"),
    ),
    "flashforge": ProtocolSpec(
        key="flashforge",
        title="FlashForge (Adventurer)",
        adapter="flashforge:FlashForgeAdapter",
        ports=(8898, 8899, 19000, 48899),
        discovery=DISCOVERY_UDP,
        capabilities=_CONTROL,
        # AD5X и Creator 5 печатают контейнер `.3mf` (мультиматериал), 5M —
        # обычный G-code.
        formats=(".gcode", ".3mf"),
        # checkCode вводит мастер: из сети его не узнать, а без него принтер
        # отвечает отказом на каждый запрос.
        secrets=("checkCode",),
        accepts_serial=True,
    ),
    "elegoo": ProtocolSpec(
        key="elegoo",
        title="Elegoo (Centauri Carbon)",
        adapter="elegoo:ElegooAdapter",
        ports=(3030, 3000),
        discovery=DISCOVERY_UDP,
        capabilities=_CONTROL,
        formats=(".gcode",),
        # Mainboard ID приходит в UDP-ответе `M99999`, но мастер может задать его
        # и руками — если бродкаст запрещён политикой сети.
        secrets=("mainboardId",),
    ),
}


def protocol_keys() -> tuple[str, ...]:
    """Ключи протоколов в порядке справочника: подсказка для формы и журнала."""
    return tuple(PROTOCOLS)


def normalize_protocol(protocol_type: str | None) -> str:
    """Ключ протокола без регистра и пробелов по краям: `" BAMBU "` → `bambu`."""
    return (protocol_type or "").strip().lower()


def get_protocol(protocol_type: str | None) -> ProtocolSpec:
    """
    Паспорт протокола по ключу.

    `UnknownProtocolError` — протокола нет в справочнике. Пустое значение тоже
    сюда попадает: принтер без протокола не должен получать задания.
    """
    spec = PROTOCOLS.get(normalize_protocol(protocol_type))

    if spec is None:
        raise UnknownProtocolError("Неизвестный протокол")

    return spec


def load_adapter_class(spec: ProtocolSpec) -> type[BasePrinterAdapter]:
    """
    Класс адаптера по паспорту протокола.

    Импорт отложен до первого задания: `import adapters.factory` не тянет за
    собой paho, ssl и ftplib, а отсутствующий драйвер нового протокола не мешает
    агенту работать с остальными.

    `AdapterUnavailableError` — модуля или класса ещё нет. Ошибку импорта не
    пробрасываем как есть: трассировка `ModuleNotFoundError: adapters.creality`
    в журнале задания ничего не говорит мастеру.
    """
    module_name, _, class_name = spec.adapter.partition(":")

    try:
        module = import_module(f".{module_name}", __package__)
        adapter_class = getattr(module, class_name)
    except (ImportError, AttributeError) as error:
        raise AdapterUnavailableError(
            f"протокол {spec.key} ещё не реализован в агенте: нет {spec.adapter}"
        ) from error

    return adapter_class

