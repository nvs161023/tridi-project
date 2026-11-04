"""
Сборка `TriDiAgent.exe`: один файл, без установки Python на ферме.

Зачем: у мастера на компьютере рядом с принтерами нет ни Python, ни опыта
`pip install`. Один exe — это «скопировал, запустил, вписал токен».

Запуск из папки `agent/`:

    python build_exe.py

Что делает скрипт:
  1. проверяет, что рядом лежат `main.py` и `.env.example` (образец зашивается
     внутрь exe, чтобы при первом запуске программа создала `.env` сама —
     `ensure_env_file()` в main.py);
  2. проверяет, установлен ли PyInstaller, и подсказывает команду установки,
     если нет (в requirements.txt он объявлен как `pyinstaller>=6.0`);
  3. зовёт PyInstaller ровно с теми ключами, что описаны в README:
     `--onefile --name TriDiAgent --add-data "<путь к .env.example>;."
     --icon=<путь к icon.ico> main.py`. Пути к образцу и значку передаются
     абсолютными: spec-файл лежит в `build/` (`--specpath`), и относительные пути
     PyInstaller искал бы рядом с ним, а не в `agent/`.

Итог — `agent/dist/TriDiAgent.exe` (десятки мегабайт: внутри интерпретатор
Python, `requests`, `python-dotenv`, `paho-mqtt` и `websockets`). Журнал агента
печатается в консоль, поэтому exe собирается консольным (`--console` по
умолчанию): при автозапуске через Планировщик окно лучше скрыть средствами
самого Планировщика (см. AUTOSTART.md). Значок берётся из `icon.ico`; если
файла нет, сборка идёт без значка и пишет об этом строкой в журнал.
"""
from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

# Папка сборки — каталог этого файла, а не текущий каталог вызова: скрипт
# запускают и из `agent/`, и из корня репозитория.
AGENT_DIR = Path(__file__).resolve().parent

ENTRY_POINT = "main.py"
APP_NAME = "TriDiAgent"
ENV_EXAMPLE = ".env.example"
ICON = "icon.ico"

# Абсолютные пути к файлам, которые PyInstaller читает уже из spec-файла. Spec
# лежит в `build/` (`--specpath build`), и относительный `.env.example` он искал
# бы рядом с собой: сборка падала с `Unable to find
# 'C:\...\agent\build\.env.example' when adding binary and data files`.
ENV_EXAMPLE_FILE = AGENT_DIR / ENV_EXAMPLE
ICON_FILE = AGENT_DIR / ICON


def missing_requirements() -> list[str]:
    """
    Чего не хватает для сборки — списком строк для мастера или CI.

    Проверяется только то, без чего PyInstaller заведомо не соберёт рабочий
    exe: точка входа, образец `.env` (он едет внутрь файла) и сам PyInstaller.
    """
    problems: list[str] = []

    if not (AGENT_DIR / ENTRY_POINT).is_file():
        problems.append(
            f"нет {ENTRY_POINT} рядом со скриптом: положите build_exe.py в папку agent/"
        )

    if not ENV_EXAMPLE_FILE.is_file():
        problems.append(
            f"нет {ENV_EXAMPLE}: без образца exe не создаст .env при первом запуске"
        )

    # find_spec, а не `import PyInstaller`: статический импорт необязательного
    # пакета pyright и линтеры считают ошибкой, а падение сборки нам не нужно.
    if importlib.util.find_spec("PyInstaller") is None:
        problems.append(
            "PyInstaller не установлен — выполните: pip install -r requirements.txt "
            "(в файле строка pyinstaller>=6.0)"
        )

    return problems


def build_command() -> list[str]:
    """
    Аргументы PyInstaller — те же, что в README.

    `--clean` убирает кеш прошлой сборки: иначе после правки main.py в файл
    попадает старая версия модуля.
    """
    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--onefile",
        "--noconfirm",
        "--clean",
        "--name",
        APP_NAME,
        # Абсолютный путь: `--specpath build` заставляет PyInstaller разбирать
        # относительные пути от `build/`, и короткое `.env.example` он там не
        # находил (`Unable to find '...\agent\build\.env.example'`).
        # Разделитель берём из `os.pathsep`: на Windows это `;`, на Linux и
        # macOS — `:`, и один скрипт собирает exe на любой машине.
        "--add-data",
        f"{ENV_EXAMPLE_FILE}{os.pathsep}.",
        "--distpath",
        "dist",
        "--workpath",
        "build",
        "--specpath",
        "build",
    ]

    # Значок тоже абсолютным путём: он попадает в тот же spec-файл в `build/`.
    if ICON_FILE.is_file():
        command += ["--icon", str(ICON_FILE)]
    else:
        print(f"! {ICON} не найден: собираю без значка")

    command.append(ENTRY_POINT)

    return command


def setup_output() -> None:
    """
    Консоль Windows не знает «✓», «✗» и «МБ».

    Кодировка консоли (cp866) и cp1251 при перенаправлении вывода в файл или pipe
    роняли сборку на последней строке: `UnicodeEncodeError: 'charmap' codec can't
    encode character '\u2713'`. `errors="replace"` заменяет незнакомый символ на
    «?» — сборка завершается, а сообщение остаётся читаемым.
    """
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)

        if reconfigure is not None:
            reconfigure(errors="replace")


def main() -> int:
    """Сборка exe. Возвращает код выхода: 0 — успех, иначе код PyInstaller."""
    setup_output()

    problems = missing_requirements()

    if problems:
        for problem in problems:
            print(f"✗ {problem}")

        return 1

    command = build_command()

    print("Сборка:", " ".join(command))

    result = subprocess.run(command, cwd=AGENT_DIR)

    if result.returncode != 0:
        print(f"✗ PyInstaller вернул код {result.returncode}: смотрите вывод выше")

        return result.returncode

    exe = Path("dist") / f"{APP_NAME}{'.exe' if os.name == 'nt' else ''}"
    path = AGENT_DIR / exe

    if not path.is_file():
        print(
            f"✗ PyInstaller закончил без ошибок, но {exe} не найден — "
            "смотрите вывод выше"
        )

        return 1

    print(f"✓ Готово: {path} ({path.stat().st_size // (1024 * 1024)} МБ)")
    print(
        "  Скопируйте файл на компьютер рядом с принтерами, запустите "
        f"{APP_NAME} и впишите AGENT_TOKEN в созданный .env"
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
