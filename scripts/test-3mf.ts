/**
 * Тест разбора 3MF и сверки файла с принтером.
 *
 * Что проверяется без базы и без сети:
 *   1. модель принтера из `Metadata/slice_info.config` (XML Bambu Studio и
 *      Orca) — основной источник;
 *   2. резервный путь через `Metadata/project_settings.config` (JSON), в том
 *      числе если слайсер оставил только профиль печати с хвостом сопла
 *      («Bambu Lab A1 0.4 nozzle»);
 *   3. архивы без служебных файлов, битые буферы и распаковка методом store
 *      возвращают null или значение, но не падают;
 *   4. сверка «нарезан для …» с моделью принтера: Bambu A1 не подходит для
 *      FlashForge, A1 mini не путается с A1, файл без разметки разрешён любому
 *      принтеру;
 *   5. текст отказа совпадает с тем, что показывает карточка заказа;
 *   6. файл товара: карточка принимает 3MF, G-code и STL в одном поле, но в
 *      очередь печати STL не попадает — это модель для нарезки;
 *   7. планировщик: формат против протокола (Bambu — `.3mf`, Klipper — `.gcode`) и
 *      строгая разметка 3MF (проект без метки на принтер с маркой не идёт).
 *
 * ZIP собирается здесь же: нужен минимальный архив с двумя служебными файлами,
 * а тянуть в тест упаковщик незачем. CRC считается по-настоящему — тестовый
 * архив остаётся корректным ZIP.
 *
 * Запуск:
 *   node --import ./scripts/register-alias.mjs scripts/test-3mf.ts
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import { deflateRawSync } from "node:zlib";

import {
  extractPrinterModelFrom3mf,
  extractPrinterModelFromProjectSettings,
  extractPrinterModelFromSliceInfo,
} from "../lib/3d/parse-3mf";
import {
  isPrintableFile,
  isProductFile,
  isSlicedForPrinter,
  isSourceModelFile,
  printerMismatchMessage,
  PRODUCT_FILE_LABEL,
} from "../lib/3d/print-compatibility";
import {
  checkPrintAssignment,
  printFitsPrinter,
} from "../lib/workshop/print-assignment";

/** Сколько проверок упало: из этого складывается код выхода. */
let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);

  if (isEqual) {
    console.log(`  ok   ${name}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${name}`);
  console.log(`       ожидалось: ${JSON.stringify(expected)}`);
  console.log(`       получено:  ${JSON.stringify(actual)}`);
}

/** Таблица CRC32 для ZIP: без неё тестовый архив был бы «почти ZIP». */
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/** Файл внутри тестового архива: имя и содержимое. */
type ZipFile = { name: string; data: string };

/**
 * Собирает ZIP из файлов.
 *
 * `method` 8 — deflate (так пишут слайсеры), 0 — store (тоже встречается).
 * Флаг 0x0800 помечает имена как UTF-8.
 */
function makeZip(files: ZipFile[], method: 0 | 8 = 8): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const raw = Buffer.from(file.data, "utf8");
    const body = method === 8 ? deflateRawSync(raw) : raw;
    const crc = crc32(raw);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);

    locals.push(local, body);
    centrals.push(central);
    offset += local.length + body.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, directory, end]);
}

/** XML отчёта Bambu Studio: модель принтера — в метаданных пластины. */
const BAMBU_SLICE_INFO = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <header>
    <header_item key="X-BBL-Client-Type" value="slicer"/>
  </header>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="printer_model_id" value="Bambu Lab A1"/>
    <metadata key="nozzle_diameters" value="0.4"/>
  </plate>
</config>`;

/** Отчёт Orca под FlashForge: модель в атрибуте `printer_model`. */
const FLASHFORGE_SLICE_INFO = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate>
    <metadata key="printer_model" value="FlashForge Adventurer 5M Pro"/>
  </plate>
</config>`;


console.log("Разбор 3MF");

check(
  "модель из slice_info.config",
  extractPrinterModelFrom3mf(
    makeZip([
      { name: "3D/3dmodel.model", data: "<model/>" },
      { name: "Metadata/slice_info.config", data: BAMBU_SLICE_INFO },
    ]),
  ),
  "Bambu Lab A1",
);

check(
  "модель из project_settings.config",
  extractPrinterModelFrom3mf(
    makeZip([
      {
        name: "Metadata/project_settings.config",
        data: JSON.stringify({
          printer_model: "FlashForge Adventurer 5M Pro",
          printer_settings_id: "FlashForge Adventurer 5M Pro 0.4 nozzle",
        }),
      },
    ]),
  ),
  "FlashForge Adventurer 5M Pro",
);

check(
  "профиль печати без printer_model",
  extractPrinterModelFromProjectSettings(
    JSON.stringify({ printer_settings_id: "Bambu Lab A1 mini 0.4 nozzle" }),
  ),
  "Bambu Lab A1 mini",
);

check(
  "архив без служебных файлов",
  extractPrinterModelFrom3mf(
    makeZip([{ name: "Metadata/plate_1.gcode", data: "G28" }]),
  ),
  null,
);

check("битый буфер", extractPrinterModelFrom3mf(Buffer.from("не zip")), null);

check(
  "распаковка store",
  extractPrinterModelFrom3mf(
    makeZip(
      [{ name: "Metadata/slice_info.config", data: FLASHFORGE_SLICE_INFO }],
      0,
    ),
  ),
  "FlashForge Adventurer 5M Pro",
);

check(
  "XML без модели принтера",
  extractPrinterModelFromSliceInfo("<config><plate/></config>"),
  null,
);

console.log("Совместимость файла и принтера");

const bambuA1 = { brand: "Bambu Lab", model: "A1" };
const flashforge = { brand: "FlashForge", model: "Adventurer 5M Pro" };

check(
  "Bambu A1 подходит Bambu A1",
  isSlicedForPrinter("Bambu Lab A1", bambuA1),
  true,
);

check("файл без разметки разрешён", isSlicedForPrinter(null, flashforge), true);

check(
  "Bambu A1 не подходит FlashForge",
  isSlicedForPrinter("Bambu Lab A1", flashforge),
  false,
);

check(
  "A1 mini не путается с A1",
  isSlicedForPrinter("Bambu Lab A1 mini", bambuA1),
  false,
);

check(
  "профиль с соплом сравнивается с моделью",
  isSlicedForPrinter("Bambu Lab A1 0.4 nozzle", bambuA1),
  true,
);

check(
  "модель с брендом внутри",
  isSlicedForPrinter("Bambu Lab A1", {
    brand: "Bambu Lab",
    model: "Bambu Lab A1",
  }),
  true,
);

check(
  "уточнение перед моделью (Original Prusa MK4)",
  isSlicedForPrinter("Original Prusa MK4", { brand: "Prusa", model: "MK4" }),
  true,
);

check(
  "текст отказа",
  printerMismatchMessage("FlashForge Adventurer 5M Pro", bambuA1),
  "Этот файл нарезан для FlashForge Adventurer 5M Pro. Выберите соответствующий принтер или загрузите файл, нарезанный для Bambu Lab A1.",
);

check(
  "подходящий файл не даёт отказа",
  printerMismatchMessage("Bambu Lab A1", bambuA1),
  null,
);

console.log("Файл пригоден для очереди печати");

check("G-code печатается", isPrintableFile("https://x/vase.gcode"), true);
check("3MF печатается", isPrintableFile("https://x/vase.3mf?token=1"), true);
check("STL не печатается", isPrintableFile("https://x/vase.stl"), false);
check("пустая ссылка", isPrintableFile(null), false);

console.log("Старые карточки: STL в отдельном поле");

check("STL — исходник", isSourceModelFile("https://x/vase.stl"), true);
check(
  "STL с query — исходник",
  isSourceModelFile("https://x/vase.stl?download=1"),
  true,
);
check("STL в верхнем регистре", isSourceModelFile("https://x/VASE.STL"), true);
check("3MF не исходник", isSourceModelFile("https://x/vase.3mf"), false);
check("G-code не исходник", isSourceModelFile("https://x/vase.gcode"), false);
check("пустая ссылка — не исходник", isSourceModelFile(null), false);

console.log("Файл модели для карточки товара");

check("3MF — файл товара", isProductFile("https://x/vase.3mf"), true);
check("G-code — файл товара", isProductFile("https://x/vase.gcode"), true);
check("gco — файл товара", isProductFile("https://x/vase.gco?token=1"), true);
check("STL — файл товара", isProductFile("https://x/vase.stl"), true);
check("PDF не файл товара", isProductFile("https://x/vase.pdf"), false);
check("пустая ссылка — не файл товара", isProductFile(null), false);
check("подпись файла товара", PRODUCT_FILE_LABEL, "Файл модели для печати");

console.log("Планировщик: формат и разметка");

const bambuPrinter = {
  brand: "Bambu Lab",
  model: "A1",
  protocolType: "bambu" as const,
};
const klipperPrinter = {
  brand: "Creality",
  model: "Ender-3",
  protocolType: "moonraker" as const,
};
const flashforgePrinter = {
  brand: "FlashForge",
  model: "Adventurer 5M Pro",
  protocolType: "flashforge" as const,
};

const unmarkedOnBambu = checkPrintAssignment(
  "https://x/vase.3mf",
  "",
  bambuPrinter,
);

check("3MF без метки на Bambu — отказ", unmarkedOnBambu.ok, false);
check(
  "3MF без метки на Bambu — причина unsliced",
  unmarkedOnBambu.ok ? "" : unmarkedOnBambu.kind,
  "unsliced",
);
check(
  "3MF без метки на Bambu — просьба сохранить в Bambu Studio",
  unmarkedOnBambu.ok ? "" : unmarkedOnBambu.reason,
  "Невозможно проверить совместимость: файл не содержит данных о слайсере. Пожалуйста, сохраните файл в Bambu Studio.",
);

check(
  "3MF без метки на FlashForge — тоже отказ",
  printFitsPrinter("https://x/vase.3mf", null, flashforgePrinter),
  false,
);

check(
  "3MF с меткой уходит на Bambu",
  printFitsPrinter("https://x/vase.3mf", "Bambu Lab A1", bambuPrinter),
  true,
);

const gcodeOnBambu = checkPrintAssignment(
  "https://x/vase.gcode",
  null,
  bambuPrinter,
);

check("G-code на Bambu — отказ по формату", gcodeOnBambu.ok, false);
check(
  "G-code на Bambu — причина format",
  gcodeOnBambu.ok ? "" : gcodeOnBambu.kind,
  "format",
);

check(
  "G-code на Klipper печатается",
  printFitsPrinter("https://x/vase.gcode", null, klipperPrinter),
  true,
);

const projectOnKlipper = checkPrintAssignment(
  "https://x/vase.3mf",
  "Bambu Lab A1",
  klipperPrinter,
);

check("3MF на Klipper — отказ по формату", projectOnKlipper.ok, false);
check(
  "3MF на Klipper — причина format",
  projectOnKlipper.ok ? "" : projectOnKlipper.kind,
  "format",
);

const foreignOnBambu = checkPrintAssignment(
  "https://x/vase.3mf",
  "FlashForge Adventurer 5M Pro",
  bambuPrinter,
);

check("3MF под FlashForge на Bambu — отказ", foreignOnBambu.ok, false);
check(
  "3MF под FlashForge на Bambu — причина sliced",
  foreignOnBambu.ok ? "" : foreignOnBambu.kind,
  "sliced",
);

const stlCheck = checkPrintAssignment(
  "https://x/vase.stl",
  null,
  klipperPrinter,
);

check("STL не ставится в очередь", stlCheck.ok, false);
check(
  "STL — причина no_file",
  stlCheck.ok ? "" : stlCheck.kind,
  "no_file",
);

if (failures > 0) {
  console.log(`\nПровалено проверок: ${failures}`);
  process.exit(1);
}

console.log("\nВсе проверки прошли.");
