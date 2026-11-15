/**
 * Тест геометрии вывески.
 *
 * Проверяет то, что обещают панель и API: общий STL блока влезает на стол
 * 220 × 220 мм, при необходимости разворачивается, лицо и крышка не
 * пересекаются, а в каждой крышке есть сквозное отверстие под провод. Отдельно
 * проверяется честный отказ: блок 80/3 шире 220 мм, и общего файла для него
 * быть не должно — только лицо и крышка по отдельности.
 *
 * Запуск:
 *   npm run check:sign
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import type { BufferGeometry } from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import type { Font, FontData } from "three/examples/jsm/loaders/FontLoader.js";

import {
  SIGN_COVER_WIRE_HOLE_MM,
  SIGN_FONT_URLS,
  createSignBlockPackageGeometry,
  createSignGeometry,
  planSignPackage,
  type SignBlockPackageReport,
  type SignLayoutReport,
  type SignPartBounds,
} from "../lib/constructor/sign-geometry";
import {
  SIGN_PACKAGE_GAP_MM,
  SIGN_PACKAGE_TOO_LARGE_MESSAGE,
  SIGN_PRINT_BED_MM,
  normalizeSignParams,
  type SignParams,
} from "../lib/constructor/params";
import {
  signExportNotice,
  signExportOptions,
} from "../lib/constructor/sign-export-options";

const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const passed = Object.is(actual, expected);

  if (!passed) {
    failures.push(
      `${name}: получено ${String(actual)}, ожидалось ${String(expected)}`,
    );
  }

  console.log(
    `  ${passed ? "✓" : "✗"} ${name}` +
      (passed ? "" : ` — ${String(actual)} вместо ${String(expected)}`),
  );
}

function near(name: string, actual: number, expected: number): void {
  const passed = Math.abs(actual - expected) <= 1e-3;

  if (!passed) {
    failures.push(
      `${name}: получено ${actual.toFixed(4)}, ожидалось ${expected.toFixed(4)}`,
    );
  }

  console.log(
    `  ${passed ? "✓" : "✗"} ${name}` +
      (passed ? "" : ` — ${actual.toFixed(4)} вместо ${expected.toFixed(4)}`),
  );
}

function atMost(name: string, actual: number, limit: number): void {
  const passed = actual <= limit + 1e-3;

  if (!passed) {
    failures.push(`${name}: получено ${actual.toFixed(2)}, предел ${limit}`);
  }

  console.log(
    `  ${passed ? "✓" : "✗"} ${name}` +
      (passed ? "" : ` — ${actual.toFixed(2)} больше ${limit}`),
  );
}

/** Пустые габариты для отчёта о пакете: поля заполняет сборка. */
function emptyBounds(): SignPartBounds {
  return {
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0,
    minZ: 0,
    maxZ: 0,
  };
}

/** Сборка отчёта той же функцией, что и предпросмотр. */
function layoutOf(params: Partial<SignParams>, font: Font): SignLayoutReport {
  const report: SignLayoutReport = { signature: "", blocks: [] };
  const geometry = createSignGeometry(params, font, report);

  geometry.dispose();

  return report;
}

/** Габарит по X/Y у сетки после placeOnBed. */
function footprint(geometry: BufferGeometry): { width: number; depth: number } {
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (!box) {
    return { width: 0, depth: 0 };
  }

  return {
    width: box.max.x - box.min.x,
    depth: box.max.y - box.min.y,
  };
}

/** Минимум по оси между огибающими лица и крышки. */
function gapBetween(
  face: SignPartBounds,
  cover: SignPartBounds,
): { x: number; y: number } {
  return {
    x: Math.max(face.minX - cover.maxX, cover.minX - face.maxX),
    y: Math.max(face.minY - cover.maxY, cover.minY - face.maxY),
  };
}

const fontPath = path.join(
  process.cwd(),
  "public",
  SIGN_FONT_URLS["sans-bold"],
);
const fontData = JSON.parse(readFileSync(fontPath, "utf8")) as FontData;
const font = new FontLoader().parse(fontData);

const base = normalizeSignParams({
  signText: "ТРИ ДИ",
  signFont: "sans-bold",
  signFontSize: 60,
  signDepth: 18,
  signChannelWidth: 8,
  signLetterGap: 6,
  signBlockSize: 3,
  signBaseMount: true,
});

console.log("\nПараметры и отверстия");
const baseLayout = layoutOf(base, font);

check("блоков на дефолте", baseLayout.blocks.length, 2);
check(
  "каждый блок получил отчёт",
  baseLayout.blocks.every((block) => block.blockIndex >= 0),
  true,
);

for (const block of baseLayout.blocks) {
  check(
    `блок ${block.blockIndex + 1}: отверстие под провод`,
    block.wireHoles.length > 0,
    true,
  );
  check(
    `блок ${block.blockIndex + 1}: отверстие сквозное`,
    block.wireHoles.every((hole) => hole.through),
    true,
  );
  console.log(
    `    блок ${block.blockIndex + 1}: ${block.wireHoles
      .map(
        (hole) =>
          `${hole.source} Ø${(hole.radius * 2).toFixed(
            0,
          )} мм (${hole.x.toFixed(1)}, ${hole.y.toFixed(1)})`,
      )
      .join(", ")}`,
  );
}


console.log("\nУзкая сплошная буква: запасное отверстие в планке");
const solid = layoutOf({ ...base, signText: "1", signBlockSize: 1 }, font);
const solidBlock = solid.blocks[0];

if (!solidBlock) {
  failures.push("буква 1: нет блока");
} else {
  check("буква 1: отверстие есть", solidBlock.wireHoles.length > 0, true);
  check(
    "буква 1: отверстие в планке крышки",
    solidBlock.wireHoles.some((hole) => hole.source === "block"),
    true,
  );
  near(
    "буква 1: диаметр отверстия",
    (solidBlock.wireHoles[0]?.radius ?? 0) * 2,
    SIGN_COVER_WIRE_HOLE_MM,
  );
}

console.log("\n60/3: пакет по умолчанию");
const baseReport = baseLayout.blocks[0];

if (!baseReport) {
  failures.push("60/3: нет первого блока");
} else {
  check("60/3: пакет влезает", baseReport.package.fits, true);
  atMost("60/3: ширина пакета", baseReport.package.width, SIGN_PRINT_BED_MM);
  atMost("60/3: глубина пакета", baseReport.package.depth, SIGN_PRINT_BED_MM);
  console.log(
    `    пакет ${baseReport.package.width.toFixed(
      1,
    )} × ${baseReport.package.depth.toFixed(
      1,
    )} мм, ${baseReport.package.arrangement}, поворот лица ${
      baseReport.package.faceRotated
    }`,
  );

  const packageReport: SignBlockPackageReport = {
    layout: baseReport.package,
    face: emptyBounds(),
    cover: emptyBounds(),
    intersects: false,
  };
  const geometry = createSignBlockPackageGeometry(
    base,
    font,
    0,
    packageReport,
  );

  check("60/3: общий STL собран", geometry !== null, true);

  if (geometry) {
    const size = footprint(geometry);

    atMost("60/3: габарит X", size.width, SIGN_PRINT_BED_MM);
    atMost("60/3: габарит Y", size.depth, SIGN_PRINT_BED_MM);
    near("60/3: пакет стоит на Z = 0", geometry.boundingBox?.min.z ?? 1, 0);
    near("60/3: пакет стоит на Y = 0", geometry.boundingBox?.min.y ?? 1, 0);
    check(
      "60/3: лицо и крышка не пересекаются",
      packageReport.intersects,
      false,
    );

    const gap = gapBetween(packageReport.face, packageReport.cover);

    check(
      "60/3: зазор 6 мм по одной оси",
      Math.max(gap.x, gap.y) >= SIGN_PACKAGE_GAP_MM - 1e-3,
      true,
    );

    geometry.dispose();
  }
}

console.log("\n80/2: пресет «Витрина 80»");
const wideParams = { ...base, signFontSize: 80, signBlockSize: 2 };
const wide = layoutOf(wideParams, font);
const wideBlock = wide.blocks[0];

if (!wideBlock) {
  failures.push("80/2: нет первого блока");
} else {
  check("80/2: пакет влезает", wideBlock.package.fits, true);
  atMost("80/2: ширина блока", wideBlock.faceWidth, SIGN_PRINT_BED_MM);
  atMost("80/2: ширина пакета", wideBlock.package.width, SIGN_PRINT_BED_MM);
  atMost("80/2: глубина пакета", wideBlock.package.depth, SIGN_PRINT_BED_MM);
  const options = signExportOptions(normalizeSignParams(wideParams), wide);

  check(
    "80/2: кнопка «Общий STL» есть",
    options.some((option) => option.request.signPart === "package"),
    true,
  );
  check(
    "80/2: предупреждения нет",
    signExportNotice(normalizeSignParams(wideParams), wide),
    null,
  );
  console.log(
    `    блок ${wideBlock.faceWidth.toFixed(
      1,
    )} × ${wideBlock.faceHeight.toFixed(
      1,
    )} мм; пакет ${wideBlock.package.width.toFixed(
      1,
    )} × ${wideBlock.package.depth.toFixed(1)} мм`,
  );
}


console.log("\n120/2: «ИИ», пакет не помещается на стол");
const tallParams = {
  ...base,
  signText: "ИИ",
  signFontSize: 120,
  signBlockSize: 2,
};
const tall = layoutOf(tallParams, font);
const tallBlock = tall.blocks[0];

if (!tallBlock) {
  failures.push("120/2: нет первого блока");
} else {
  check("120/2: пакет не влезает", tallBlock.package.fits, false);
  check(
    "120/2: общий STL не выдаётся",
    createSignBlockPackageGeometry(tallParams, font, 0),
    null,
  );
  const options = signExportOptions(normalizeSignParams(tallParams), tall);

  check(
    "120/2: кнопки «Общий STL» нет",
    options.some((option) => option.request.signPart === "package"),
    false,
  );
  check(
    "120/2: лицо и крышка доступны",
    options.some((option) => option.request.signPart === "face") &&
      options.some((option) => option.request.signPart === "cover"),
    true,
  );
  check(
    "120/2: предупреждение о поле печати",
    signExportNotice(normalizeSignParams(tallParams), tall),
    SIGN_PACKAGE_TOO_LARGE_MESSAGE,
  );
  console.log(
    `    блок ${tallBlock.faceWidth.toFixed(
      1,
    )} × ${tallBlock.faceHeight.toFixed(
      1,
    )} мм; лучший пакет ${tallBlock.package.width.toFixed(
      1,
    )} × ${tallBlock.package.depth.toFixed(1)} мм`,
  );
}

console.log("\n80/3: пакет шире стола — только отдельные файлы");
const oversizeParams = {
  ...base,
  signFontSize: 80,
  signBlockSize: 3,
};
const oversize = layoutOf(oversizeParams, font);
const oversizeBlock = oversize.blocks[0];

if (!oversizeBlock) {
  failures.push("80/3: нет первого блока");
} else {
  check("80/3: пакет не влезает", oversizeBlock.package.fits, false);
  check(
    "80/3: общий STL не выдаётся",
    createSignBlockPackageGeometry(oversizeParams, font, 0),
    null,
  );
  console.log(
    `    блок ${oversizeBlock.faceWidth.toFixed(
      1,
    )} × ${oversizeBlock.faceHeight.toFixed(
      1,
    )} мм; лучший пакет ${oversizeBlock.package.width.toFixed(
      1,
    )} × ${oversizeBlock.package.depth.toFixed(1)} мм`,
  );
}

console.log("\nПлан упаковки без геометрии");
// Асимметричная пара: сверху и рядом без поворота не влезает, а поворот лица
// на 90° уменьшает ширину и оставляет пакет в пределах стола.
const planned = planSignPackage(210, 120, 60, 120);

check("план поворачивает лицо", planned.faceRotated, true);
check("план кладёт крышку рядом", planned.arrangement, "side");
atMost("план по X", planned.width, SIGN_PRINT_BED_MM);
atMost("план по Y", planned.depth, SIGN_PRINT_BED_MM);

if (failures.length > 0) {
  console.error(`\nПровалено проверок: ${failures.length}`);

  for (const failure of failures) {
    console.error(`  • ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log("\nВсе проверки вывески прошли.");
}

