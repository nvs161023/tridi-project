"""
Сводный прогон всех протоколов агента на локальных симуляторах.

Что делает:

  - запускает тест каждого протокола отдельным процессом (`scripts/test-*.py`):
    у каждого свой фейковый принтер, и падение одного не мешает остальным;
  - считает проверки `✓`/`✗` и раскладывает их по операциям контракта
    (подключение, загрузка, старт печати, состояние), чтобы таблица показывала,
    что именно проверено у протокола, а не только «упало / прошло»;
  - печатает сводную таблицу и подробности провалов; код выхода 1, если хоть
    одна проверка не прошла или тест завершился исключением.

Запуск:
    python scripts/test-all-protocols.py
    python scripts/test-all-protocols.py moonraker bambu

Принтер не нужен: каждый тест поднимает свой симулятор на loopback. Порты у
симуляторов фиксированные (Creality 9999, Elegoo 3030, Anycubic 9883), поэтому
тесты идут по очереди, а не параллельно.
"""
from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = ROOT / "scripts"

# Протокол → файл теста. Порядок — как в справочнике `PRINTER_PROTOCOLS`:
# от HTTP-протоколов к тем, у кого постоянный канал и свои порты.
SUITES: tuple[tuple[str, str], ...] = (
    ("moonraker", "test-moonraker.py"),
    ("octoprint", "test-octoprint.py"),
    ("prusa", "test-prusa.py"),
    ("creality", "test-creality.py"),
    ("elegoo", "test-elegoo.py"),
    ("anycubic", "test-anycubic.py"),
    ("bambu", "test-bambu.py"),
    ("flashforge", "test-flashforge.py"),
)

# Операции контракта адаптера и слова, по которым проверка относится к операции.
# Порядок важен: «старт» проверяется раньше «состояния», иначе проверка
# «старт: после старта статус printing» попала бы в состояние.
OPERATIONS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Подключение", ("подключ", "connect")),
    ("Загрузка", ("загруз", "upload")),
    ("Старт", ("старт", "start")),
    ("Состояние", ("состояни", "status", "монитор")),
)

OTHER = "Прочее"
CHECK_MARKS = ("✓", "✗")
# Сколько ждать один тест: загрузка и MQTT-таймауты идут секундами, но
# зависший симулятор лучше оборвать, чем ждать его молча.
SUITE_TIMEOUT = 900


@dataclass
class SuiteResult:
    """Итог одного протокола: счётчики по операциям и список провалов."""

    key: str
    script: str
    passed: int = 0
    failed: int = 0
    exit_code: int = 0
    crashed: str = ""
    counters: dict[str, list[int]] = field(default_factory=dict)
    failures: list[str] = field(default_factory=list)

    def add(self, operation: str, ok: bool) -> None:
        """Учитывает проверку: операция → [прошло, провалено]."""
        counter = self.counters.setdefault(operation, [0, 0])
        counter[0 if ok else 1] += 1

        if ok:
            self.passed += 1
        else:
            self.failed += 1

    @property
    def ok(self) -> bool:
        """Протокол проверен: проверки были, провалов и падений нет."""
        return self.passed > 0 and self.failed == 0 and self.exit_code == 0

    def cell(self, operation: str) -> str:
        """Ячейка таблицы: `прошло/всего` или `—`, если проверок не было."""
        counter = self.counters.get(operation)

        if counter is None:
            return "—"

        total = counter[0] + counter[1]

        return f"{counter[0]}/{total}"


def operation_for(name: str) -> str:
    """Операция контракта по названию проверки."""
    lowered = name.lower()

    for operation, words in OPERATIONS:
        if any(word in lowered for word in words):
            return operation

    return OTHER


def parse(
    key: str,
    script: str,
    output: str,
    exit_code: int,
    crashed: str,
) -> SuiteResult:
    """Разбирает вывод теста: строки `✓`/`✗`, операции и провалы."""
    result = SuiteResult(key=key, script=script, exit_code=exit_code)

    for raw in output.splitlines():
        line = raw.strip()

        if not line or line[0] not in CHECK_MARKS:
            continue

        ok = line[0] == "✓"
        body = line[1:].strip()
        name = body.split(" — ", 1)[0]
        result.add(operation_for(name), ok)

        if not ok:
            result.failures.append(body)

    # Ни одной проверки — тест упал до первой из них (порт занят, импорт).
    if result.passed == 0 and result.failed == 0:
        result.crashed = crashed

    return result


def run_suite(key: str, script: str) -> SuiteResult:
    """Запускает тест протокола отдельным процессом и разбирает его вывод."""
    path = SCRIPTS_DIR / script

    if not path.exists():
        return SuiteResult(
            key=key,
            script=script,
            exit_code=1,
            crashed=f"нет файла {path.relative_to(ROOT)}",
        )

    env = dict(os.environ)
    # Кириллица в проверках: без этого дочерний процесс пишет в cp1251 и
    # строки `✓` приходят мусором.
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUTF8"] = "1"

    try:
        completed = subprocess.run(
            [sys.executable, str(path)],
            cwd=str(ROOT),
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=SUITE_TIMEOUT,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return SuiteResult(
            key=key,
            script=script,
            exit_code=1,
            crashed=f"тест не уложился в {SUITE_TIMEOUT} с",
        )

    errors = [line.strip() for line in completed.stderr.splitlines() if line.strip()]
    crashed = errors[-1] if completed.returncode != 0 and errors else ""

    return parse(key, script, completed.stdout, completed.returncode, crashed)


def print_table(results: list[SuiteResult]) -> None:
    """Печатает сводную таблицу: протокол × операции контракта."""
    headers = ["Протокол", *(operation for operation, _ in OPERATIONS), OTHER, "Вердикт"]
    rows: list[list[str]] = []

    for result in results:
        verdict = "OK" if result.ok else "ПРОВАЛ"
        rows.append(
            [
                result.key,
                *(result.cell(operation) for operation, _ in OPERATIONS),
                result.cell(OTHER),
                verdict,
            ]
        )

    widths = [
        max(len(headers[index]), *(len(row[index]) for row in rows))
        if rows
        else len(headers[index])
        for index in range(len(headers))
    ]

    def line(cells: list[str]) -> str:
        return "  ".join(cell.ljust(widths[index]) for index, cell in enumerate(cells))

    print(line(headers))
    print("  ".join("-" * width for width in widths))

    for row in rows:
        print(line(row))


def print_failures(results: list[SuiteResult]) -> None:
    """Подробности провалов: что именно не совпало с контрактом."""
    broken = [result for result in results if not result.ok]

    if not broken:
        print(f"\nВсе {len(results)} протоколов проверены.")
        return

    print("\nПровалы:")

    for result in broken:
        if result.crashed:
            print(f"  {result.key}: тест не дошёл до проверок — {result.crashed}")

        for failure in result.failures:
            print(f"  {result.key}: ✗ {failure}")

        if result.exit_code != 0 and not result.crashed and not result.failures:
            print(f"  {result.key}: код выхода {result.exit_code} без подробностей")

    print(f"\nПротоколов с провалами: {len(broken)} из {len(results)}.")


def main(argv: list[str]) -> int:
    """Прогоняет выбранные протоколы и печатает сводку."""
    known = {key for key, _ in SUITES}
    selected = {item.strip().lower() for item in argv if item.strip()}
    unknown = selected - known

    if unknown:
        print(f"Неизвестный протокол: {', '.join(sorted(unknown))}.")
        print(f"Известные: {', '.join(key for key, _ in SUITES)}.")

        return 2

    suites = [item for item in SUITES if not selected or item[0] in selected]
    results: list[SuiteResult] = []

    for key, script in suites:
        print(f"… {key}: scripts/{script}")
        result = run_suite(key, script)
        results.append(result)
        mark = "✓" if result.ok else "✗"
        print(
            f"{mark} {key}: прошло {result.passed}, провалов {result.failed}"
            + (f", {result.crashed}" if result.crashed else "")
        )

    print()
    print_table(results)
    print_failures(results)

    return 0 if all(result.ok for result in results) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
