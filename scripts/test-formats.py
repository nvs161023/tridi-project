"""
Тест форматов файлов печати (этап 2).

Что проверяет:

  1. `sanitize_remote_name()`: пробелы (Creality — `_`, остальные — `-`), пути и
     `..`, кириллица, регистр расширения и предел длины;
  2. `file_digest()`: MD5 совпадает с `hashlib.md5` по тем же байтам;
  3. `ensure_format()` и `read_bambu_project()`: Bambu отклоняет плоский `.gcode`
     и STL с подсказкой о нарезке, проект Bambu Studio уходит как есть, а
     контейнер без нарезки и проект чужой модели — `FormatError` с понятным
     текстом; FlashForge без записей в контейнере тоже отклоняется;
  4. `prepare_upload()`: имя и формат приводятся в порядок до сети, Bambu
     запоминает запись пластины из проекта, отказывает проекту чужой модели и
     не создаёт временных файлов, Moonraker отказывает `.3mf` без запроса к
     принтеру;
  5. фабрика ставит `protocol_key` из справочника: по нему и находятся форматы.

Запуск:
    python scripts/test-formats.py

Принтер не нужен: адаптеры в тесте только готовят файл, а отказ Moonraker
случается уже после проверки формата — до сетевого запроса.
"""
from __future__ import annotations

import hashlib
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AGENT_DIR = ROOT / "agent"

# Агент — не пакет в PYTHONPATH: импортируем так же, как при запуске main.py.
sys.path.insert(0, str(AGENT_DIR))

from adapters import formats  # noqa: E402 — путь к агенту добавляется выше
from adapters.bambu import BambuAdapter  # noqa: E402
from adapters.factory import get_adapter  # noqa: E402
from adapters.moonraker import MoonrakerAdapter  # noqa: E402

CHECK_IP = "formats-test.invalid"
CHECK_API_KEY = "12345678"
GCODE_BODY = b"; test\nG28\nG1 X10 Y10\n"

failures = 0


def check(name: str, ok: bool, details: str) -> None:
    """Печатает результат одной проверки и считает провалы."""
    global failures

    print(f"{'✓' if ok else '✗'} {name} — {details}")

    if not ok:
        failures += 1


def write_gcode(directory: Path, name: str) -> Path:
    """Кладёт в каталог теста маленький G-code и возвращает путь."""
    path = directory / name
    path.write_bytes(GCODE_BODY)

    return path


def write_bambu_project(
    path: Path, printer_model: str, plate: int = 1
) -> Path:
    """
    Собирает `.3mf` так, как его сохраняет Bambu Studio «Экспорт файла пластины».

    Внутри — нарезанный G-code пластины и профиль слайсера с моделью принтера:
    ровно то, что проверяет `read_bambu_project()`.
    """
    with zipfile.ZipFile(path, "w") as project:
        project.writestr(f"Metadata/plate_{plate}.gcode", GCODE_BODY)
        project.writestr(
            "Metadata/project_settings.config",
            '{ "printer_model": "%s", "printer_settings_id": "%s 0.4 nozzle" }'
            % (printer_model, printer_model),
        )
        project.writestr(
            "Metadata/slice_info.config",
            '<config><plate><metadata key="index" value="%d"/>'
            '<metadata key="printer_model_id" value="%s"/></plate></config>'
            % (plate, printer_model),
        )
        project.writestr("3D/3dmodel.model", "<model/>")

    return path


def finish() -> int:
    """Итог теста и код выхода: 0 — всё прошло, 1 — были провалы."""
    if failures > 0:
        print(f"Провалов: {failures}.")

        return 1

    print("Все проверки пройдены.")

    return 0


def main() -> int:
    print("Проверка форматов и подготовки загрузки:")

    # 1. Имя файла на принтере.
    creality_name = formats.sanitize_remote_name("creality", "my vase v2.gcode")
    check(
        "sanitize: Creality заменяет пробелы на `_`",
        creality_name == "my_vase_v2.gcode",
        creality_name,
    )

    moonraker_name = formats.sanitize_remote_name("moonraker", "my vase v2.gcode")
    check(
        "sanitize: остальные протоколы — `-`",
        moonraker_name == "my-vase-v2.gcode",
        moonraker_name,
    )

    traversal = formats.sanitize_remote_name("moonraker", "../../etc/pass wd.gcode")
    check(
        "sanitize: путь и `..` не проходят",
        traversal == "pass-wd.gcode"
        and "/" not in traversal
        and ".." not in traversal,
        traversal,
    )

    cyrillic = formats.sanitize_remote_name("creality", "ваза.gcode")
    check("sanitize: кириллица становится ASCII", cyrillic == "job.gcode", cyrillic)

    upper = formats.sanitize_remote_name("bambu", "Job.GCODE")
    check("sanitize: расширение в нижнем регистре", upper == "Job.gcode", upper)

    long_name = formats.sanitize_remote_name("moonraker", f"{'a' * 400}.gcode")
    check(
        "sanitize: длина не больше 255",
        len(long_name) == formats.REMOTE_NAME_MAX and long_name.endswith(".gcode"),
        f"{len(long_name)} символов",
    )

    with tempfile.TemporaryDirectory() as raw_directory:
        directory = Path(raw_directory)
        gcode_path = write_gcode(directory, "probe.gcode")

        # 2. Контрольная сумма.
        digest = formats.file_digest(str(gcode_path))
        check(
            "file_digest: MD5 совпадает с hashlib",
            digest == hashlib.md5(GCODE_BODY).hexdigest(),
            digest,
        )

        # 3. Формат и проверка проекта.
        try:
            formats.ensure_format(
                "bambu", str(gcode_path), remote_name="probe.gcode"
            )
        except formats.FormatError as error:
            check(
                "ensure_format: Bambu отклоняет плоский .gcode",
                "проект .3mf" in str(error) and "Bambu Studio" in str(error),
                str(error),
            )
        else:
            check("ensure_format: Bambu отклоняет плоский .gcode", False, "—")

        stl_path = directory / "vase.stl"
        stl_path.write_bytes(b"solid vase\nendsolid vase\n")

        try:
            formats.ensure_format("bambu", str(stl_path), remote_name="vase.stl")
        except formats.FormatError as error:
            check(
                "ensure_format: Bambu отклоняет STL с подсказкой о нарезке",
                "STL" in str(error) and "Экспорт файла пластины" in str(error),
                str(error),
            )
        else:
            check("ensure_format: Bambu отклоняет STL с подсказкой о нарезке", False, "—")

        project_path = write_bambu_project(directory / "project.3mf", "Bambu Lab A1")
        project = formats.read_bambu_project(str(project_path))
        check(
            "read_bambu_project: пластина и модель принтера",
            project.gcode_part == "Metadata/plate_1.gcode"
            and project.plate == 1
            and project.printer_model == "Bambu Lab A1",
            f"{project!r}",
        )

        second_plate = write_bambu_project(
            directory / "second-plate.3mf", "Bambu Lab A1", plate=2
        )
        check(
            "read_bambu_project: номер пластины из имени записи",
            formats.read_bambu_project(str(second_plate)).gcode_part
            == "Metadata/plate_2.gcode",
            formats.read_bambu_project(str(second_plate)).gcode_part,
        )

        unsliced_path = directory / "model.3mf"

        with zipfile.ZipFile(unsliced_path, "w") as model:
            model.writestr(
                "Metadata/project_settings.config",
                '{ "printer_model": "Bambu Lab A1" }',
            )
            model.writestr("3D/3dmodel.model", "<model/>")

        try:
            formats.ensure_format(
                "bambu", str(unsliced_path), remote_name="model.3mf"
            )
        except formats.FormatError as error:
            check(
                "ensure_format: .3mf без нарезки отклонён",
                "нет нарезанного G-code" in str(error),
                str(error),
            )
        else:
            check("ensure_format: .3mf без нарезки отклонён", False, "—")

        no_settings = directory / "foreign-slicer.3mf"

        with zipfile.ZipFile(no_settings, "w") as foreign:
            foreign.writestr("Metadata/plate_1.gcode", GCODE_BODY)

        try:
            formats.ensure_format(
                "bambu", str(no_settings), remote_name="foreign-slicer.3mf"
            )
        except formats.FormatError as error:
            check(
                "ensure_format: .3mf без профиля Bambu Studio отклонён",
                "project_settings.config" in str(error),
                str(error),
            )
        else:
            check("ensure_format: .3mf без профиля Bambu Studio отклонён", False, "—")

        mismatch = formats.bambu_compat_error("Bambu Lab X1 Carbon", "Bambu Lab", "A1")
        check(
            "bambu_compat_error: проект чужой модели отклонён",
            mismatch is not None and "X1 Carbon" in mismatch,
            str(mismatch),
        )

        check(
            "bambu_compat_error: профиль с соплом сравнивается с моделью",
            formats.bambu_compat_error("Bambu Lab A1 0.4 nozzle", "Bambu Lab", "A1")
            is None,
            "—",
        )

        check(
            "bambu_compat_error: пустая модель принтера — проверять нечего",
            formats.bambu_compat_error("Bambu Lab A1", "", "") is None,
            "—",
        )

        passthrough, passthrough_temp = formats.ensure_format(
            "bambu", str(project_path), remote_name="project.3mf"
        )
        check(
            "ensure_format: проект .3mf уходит как есть",
            passthrough == str(project_path) and passthrough_temp is False,
            f"{passthrough!r}, временный={passthrough_temp}",
        )

        for protocol in ("prusa", "creality", "elegoo"):
            try:
                formats.ensure_format(protocol, str(project_path))
            except formats.FormatError as error:
                reason = str(error)
                check(
                    f"ensure_format: {protocol} не печатает .3mf",
                    "не печатает .3mf" in reason and "переслайсите" in reason,
                    reason,
                )
            else:
                check(f"ensure_format: {protocol} не печатает .3mf", False, "отказ")

        broken_project = directory / "broken.3mf"
        broken_project.write_bytes(b"not a zip")

        try:
            formats.ensure_format("flashforge", str(broken_project))
        except formats.FormatError as error:
            check(
                "ensure_format: битый .3mf для FlashForge отклонён",
                "не прочитан" in str(error),
                str(error),
            )
        else:
            check("ensure_format: битый .3mf для FlashForge отклонён", False, "—")

        # 4. Подготовка загрузки адаптерами.
        moonraker = MoonrakerAdapter(ip_address=CHECK_IP, api_key=CHECK_API_KEY)
        moonraker.protocol_key = "moonraker"
        plan = moonraker.prepare_upload(str(gcode_path), "my job.gcode")
        check(
            "prepare_upload: Moonraker — имя без пробелов, файл не временный",
            plan.remote_name == "my-job.gcode"
            and plan.path == str(gcode_path)
            and plan.is_temp is False
            and plan.size == len(GCODE_BODY)
            and plan.md5 is None,
            f"{plan!r}",
        )

        bambu = BambuAdapter(
            ip_address=CHECK_IP,
            api_key=CHECK_API_KEY,
            serial_number="",
            brand="Bambu Lab",
            model="A1",
        )
        bambu.protocol_key = "bambu"
        bambu_plan = bambu.prepare_upload(str(project_path), "job.3mf")
        check(
            "prepare_upload: Bambu — проект как есть, пластина из контейнера",
            bambu_plan.remote_name == "job.3mf"
            and bambu_plan.is_temp is False
            and bambu_plan.path == str(project_path)
            and bambu._gcode_part == "Metadata/plate_1.gcode",
            f"{bambu_plan!r}, запись={bambu._gcode_part}",
        )

        second_plan = bambu.prepare_upload(str(second_plate), "second-plate.3mf")
        check(
            "prepare_upload: Bambu запоминает пластину проекта",
            bambu._gcode_part == "Metadata/plate_2.gcode"
            and second_plan.remote_name == "second-plate.3mf",
            f"запись={bambu._gcode_part}",
        )

        bambu.cleanup_upload(bambu_plan)
        check(
            "cleanup_upload: исходный проект не удалён",
            project_path.exists(),
            f"{project_path}",
        )

        rejected = bambu.upload_file(str(gcode_path), remote_name="job.gcode")
        check(
            "upload_file: Bambu отклоняет .gcode до сети",
            rejected is False and "Bambu Studio" in (bambu.last_error or ""),
            f"last_error={bambu.last_error!r}",
        )

        foreign_model = BambuAdapter(
            ip_address=CHECK_IP,
            api_key=CHECK_API_KEY,
            brand="Bambu Lab",
            model="A1 mini",
        )
        foreign_model.protocol_key = "bambu"

        try:
            foreign_model.prepare_upload(str(project_path), "job.3mf")
        except formats.FormatError as error:
            check(
                "prepare_upload: Bambu отказывает проекту чужой модели",
                "A1 mini" in str(error),
                str(error),
            )
        else:
            check("prepare_upload: Bambu отказывает проекту чужой модели", False, "—")

        try:
            uploaded = moonraker.upload_file(str(project_path), "project.3mf")
        except Exception as error:  # noqa: BLE001 — сеть в тесте запрещена
            check(
                "upload_file: Moonraker отказал без сети",
                False,
                f"исключение {type(error).__name__}: {error}",
            )
        else:
            check(
                "upload_file: Moonraker отказал без сети",
                uploaded is False
                and "не печатает .3mf" in (moonraker.last_error or ""),
                f"last_error={moonraker.last_error!r}",
            )

    # 5. Ключ протокола из справочника.
    factory_bambu = get_adapter("bambu", CHECK_IP, CHECK_API_KEY)
    check(
        "фабрика: protocol_key из справочника",
        factory_bambu.protocol_key == "bambu"
        and isinstance(factory_bambu, BambuAdapter)
        and type(factory_bambu).prepare_upload is BambuAdapter.prepare_upload,
        f"{factory_bambu.protocol_key!r}, {type(factory_bambu).__name__}",
    )

    return finish()


if __name__ == "__main__":
    sys.exit(main())
