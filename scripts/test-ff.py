"""
Диагностика живого FlashForge: что принтер отвечает на 8898.

Скрипт нужен, когда печать не начинается, а в журнале агента видно «нет данных
принтера». Он не правит карточку и ничего не запускает: только спрашивает
принтер и печатает сырые ответы.

Что проверяется:

  1. `POST /detail` с парой `serialNumber`/`checkCode` в теле — штатный паспорт
     прошивки 3.x и 5.x; рядом печатается разбор: модель, прошивка, состояние,
     прогресс и серийный номер, как их видит адаптер;
  2. `GET /detail` с парой в заголовках — запасной вид запроса ранних сборок;
  3. `POST /product` — состояния управления (свет, вентиляторы, стол);
  4. `POST /info`, `GET /info` — адрес новых сборок Creator 5; на 5M Pro его нет,
     и 404 здесь ожидаем;
  5. `POST /gcodeList` — список файлов в памяти принтера.

Запуск:

    python scripts/test-ff.py 192.168.0.5 SNMOMF9201019 A1B2C3D4
    python scripts/test-ff.py 192.168.0.5

Без пары в аргументах берутся `FLASHFORGE_SERIAL` и `FLASHFORGE_CHECK_CODE` из
окружения — так секрет не остаётся в истории команд. Без пары скрипт тоже
работает: покажет, какие адреса принтер знает и как отвечает на пустой запрос
(`Parameters is error`) и на чужой номер (`SN is different`).

Печатается не больше 500 символов ответа: этого хватает, чтобы увидеть поля, а
журнал не превращается в километровую строку. Код выхода — 1, если принтер не
ответил ни на один запрос: сеть, LAN-режим или адрес.
"""
from __future__ import annotations

import os
import sys
from typing import Final

import requests

DEFAULT_IP: Final = "192.168.0.5"
HTTP_PORT: Final = 8898
TIMEOUT: Final = 8
PREVIEW_LIMIT: Final = 500

# Адреса, которые стоит спросить: путь и метод. Тело с парой уходит в `POST`,
# заголовки — всегда: ранние сборки читают пару только из них.
PROBES: Final[tuple[tuple[str, str], ...]] = (
    ("/detail", "POST"),
    ("/detail", "GET"),
    ("/product", "POST"),
    ("/info", "POST"),
    ("/info", "GET"),
    ("/gcodeList", "POST"),
)


def preview(response: requests.Response) -> str:
    """Тело ответа одной строкой: переводы строк схлопнуты, длина ограничена."""
    try:
        text = (response.text or "").strip()
    except (ValueError, OSError):
        return "тело не читается"

    collapsed = " ".join(text.split())

    return collapsed[:PREVIEW_LIMIT] if collapsed else "пустое тело"


def ask(
    base_url: str,
    path: str,
    method: str,
    serial: str,
    check_code: str,
) -> bool:
    """
    Один запрос к принтеру: печатает код ответа и сырое тело.

    `True` — принтер ответил HTTP, даже отказом: отказ это тоже сведения.
    """
    headers = {"Accept": "application/json"}
    body = None

    if serial:
        headers["serialNumber"] = serial

    if check_code:
        headers["checkCode"] = check_code

    if method == "POST":
        body = {"serialNumber": serial, "checkCode": check_code}

    try:
        response = requests.request(
            method,
            f"{base_url}{path}",
            headers=headers,
            json=body,
            timeout=TIMEOUT,
        )
    except requests.RequestException as error:
        print(f"✗ {method} {path} — ошибка сети: {error}")

        return False

    length = len(response.text or "")
    print(f"→ {method} {path}: HTTP {response.status_code}, {length} символов")
    print(f"  {preview(response)}")

    return True


def describe(base_url: str, serial: str, check_code: str) -> None:
    """Разбор паспорта так, как его читает адаптер: модель, состояние, прогресс."""
    try:
        response = requests.post(
            f"{base_url}/detail",
            headers={
                "Accept": "application/json",
                "serialNumber": serial,
                "checkCode": check_code,
            },
            json={"serialNumber": serial, "checkCode": check_code},
            timeout=TIMEOUT,
        )
        payload = response.json()
    except (requests.RequestException, ValueError) as error:
        print(f"Разбор не вышел: {error}")

        return

    detail = payload.get("detail") if isinstance(payload, dict) else None

    if not isinstance(detail, dict):
        print("Разбор не вышел: в ответе нет объекта detail")

        return

    keys = ", ".join(sorted(detail))
    print("Поля паспорта:", keys)
    print(
        "Как прочтёт адаптер:",
        {
            "state": detail.get("machineStatus") or detail.get("status"),
            "progress": detail.get("printProgress"),
            "remaining": detail.get("remainingTimeEstimation")
            or detail.get("estimatedTime"),
            "name": detail.get("name"),
            "pid": detail.get("pid"),
            "firmware": detail.get("firmwareVersion"),
            "serial": detail.get("serialNumber") or detail.get("name"),
        },
    )
    print("Модель прошивки 5.x отдают только в pid: 36 — Adventurer 5M Pro.")


def main() -> int:
    """Опросить принтер по всем адресам и напечатать итог."""
    ip = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_IP
    serial = sys.argv[2] if len(sys.argv) > 2 else os.environ.get(
        "FLASHFORGE_SERIAL", ""
    )
    check_code = sys.argv[3] if len(sys.argv) > 3 else os.environ.get(
        "FLASHFORGE_CHECK_CODE", ""
    )

    base_url = f"http://{ip}:{HTTP_PORT}"
    print(f"FlashForge {base_url}")
    print(
        "Пара для входа:",
        f"serialNumber={'задан' if serial else 'пуст'}",
        f"checkCode={'задан' if check_code else 'пуст'}",
    )

    answered = [ask(base_url, *probe, serial, check_code) for probe in PROBES]

    if not any(answered):
        print("Провал: принтер не ответил ни на один запрос.")

        return 1

    if serial and check_code:
        describe(base_url, serial, check_code)

    return 0


if __name__ == "__main__":
    sys.exit(main())
