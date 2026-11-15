/**
 * Тест геометрии вывески.
 *
 * Проверяет то, что обещают панель и API: общий STL блока влезает на стол
 * 220 × 220 мм, при необходимости разворачивается, лицо и задняя стенка не
 * пересекаются, а в каждой стенке есть сквозное отверстие под провод. Отдельно
 * проверяются три режима рельса: съёмный рельс с пазами, жёсткий рельс одной
 * деталью со стенкой и плоская глухая стенка без рельса. Ножек нет ни в одном
 * режиме: низ букв совпадает с базовой линией шрифта. Честный отказ тоже
 * проверяется: блок 120/2 не помещается на стол, и общего файла для него быть
 * не должно — только лицо и задняя стенка по отдельности.
 *
 * Запуск:
 *   npm run check:sign
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  Mesh,
  Raycaster,
  ShapeGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import type { Font, FontData } from "three/examples/jsm/loaders/FontLoader.js";

import { calculateGeometryWeightGrams } from "../lib/constructor/geometry-volume";
import {
  SIGN_COVER_PLATE_MM,
  SIGN_FONT_URLS,
  SIGN_RAIL_HEIGHT_MM,
  SIGN_RAIL_THICKNESS_MM,
  SIGN_RAIL_WIRE_HOLE_MM,
  createSignBlockGeometry,
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

/** Есть ли в сетке хоть один треугольник: пустая деталь рельса это не ошибка. */
function hasGeometry(geometry: BufferGeometry): boolean {
  const position = geometry.getAttribute("position");

  return position !== undefined && position.count > 0;
}

/** Минимум по оси между огибающими лица и задней стенки. */
function gapBetween(
  face: SignPartBounds,
  cover: SignPartBounds,
): { x: number; y: number } {
  return {
    x: Math.max(face.minX - cover.maxX, cover.minX - face.maxX),
    y: Math.max(face.minY - cover.maxY, cover.minY - face.maxY),
  };
}

/**
 * Доля передней плоскости, занятая материалом на горизонтальной линии.
 *
 * Общая планка под буквами дала бы почти непрерывную полосу, отдельные буквы —
 * только штрихи. Луч идёт спереди назад, но считаются только попадания в
 * передний слой: рельс стоит сзади и в проверку не попадает.
 */
function frontCoverage(geometry: BufferGeometry, y: number): number {
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (!box) {
    return 1;
  }

  const mesh = new Mesh(geometry);
  mesh.updateMatrixWorld(true);

  const raycaster = new Raycaster();
  const direction = new Vector3(0, 0, -1);
  const samples = 160;
  let material = 0;

  for (let index = 0; index < samples; index += 1) {
    const x = box.min.x + ((box.max.x - box.min.x) * (index + 0.5)) / samples;

    raycaster.set(new Vector3(x, y, box.max.z + 20), direction);

    const hit = raycaster
      .intersectObject(mesh, true)
      .find((item) => item.point.z > box.max.z - 3.5);

    if (hit) {
      material += 1;
    }
  }

  return material / samples;
}

/**
 * Дефекты сетки: вырожденные треугольники, незамкнутые и неманифолдные рёбра.
 *
 * Оболочки букв пересекаются, но каждая остаётся замкнутой, поэтому открытых
 * рёбер быть не должно: именно они дают «сломанные грани» и дыры в слайсере.
 */
function topology(geometry: BufferGeometry): {
  open: number;
  nonManifold: number;
  degenerate: number;
  nan: number;
} {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const triangles = (index ? index.count : position.count) / 3;
  const edges = new Map<string, number>();
  let degenerate = 0;
  let nan = 0;
  const keyOf = (id: number): string => {
    const x = position.getX(id);
    const y = position.getY(id);
    const z = position.getZ(id);

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      nan += 1;
    }

    return `${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}`;
  };
  const vertex = (corner: number): number =>
    index ? index.getX(corner) : corner;

  for (let corner = 0; corner < triangles * 3; corner += 3) {
    const triangle = [
      keyOf(vertex(corner)),
      keyOf(vertex(corner + 1)),
      keyOf(vertex(corner + 2)),
    ];

    if (new Set(triangle).size < 3) {
      degenerate += 1;
    }

    for (let side = 0; side < 3; side += 1) {
      const a = triangle[side];
      const b = triangle[(side + 1) % 3];

      if (a === b) {
        continue;
      }

      const edge = a < b ? `${a}~${b}` : `${b}~${a}`;

      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
  }

  let open = 0;
  let nonManifold = 0;

  for (const count of edges.values()) {
    if (count % 2 !== 0) {
      open += count;
    }

    if (count > 2) {
      nonManifold += count;
    }
  }

  return { open, nonManifold, degenerate, nan };
}

const fontPath = path.join(
  process.cwd(),
  "public",
  SIGN_FONT_URLS["sans-bold"],
);
const fontData = JSON.parse(readFileSync(fontPath, "utf8")) as FontData;
const font = new FontLoader().parse(fontData);

// Эталон высоты строки: контуры шрифта без стенок и рельса. Ножки добавляли
// 15 мм снизу, поэтому совпадение с эталоном и есть проверка «ножек нет».
const glyphHeightCache = new Map<string, number>();

function glyphHeightOf(text: string): number {
  const cached = glyphHeightCache.get(text);

  if (cached !== undefined) {
    return cached;
  }

  const probe = new ShapeGeometry(font.generateShapes(text, 60));

  probe.computeBoundingBox();

  const height = probe.boundingBox
    ? probe.boundingBox.max.y - probe.boundingBox.min.y
    : 0;

  probe.dispose();
  glyphHeightCache.set(text, height);

  return height;
}

const base = normalizeSignParams({
  signText: "ТРИ ДИ",
  signFont: "sans-bold",
  signFontSize: 60,
  signDepth: 12,
  signChannelWidth: 8,
  signLetterGap: 6,
  signBlockSize: 3,
  signRailMode: "detachable",
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
  check(
    `блок ${block.blockIndex + 1}: рельс есть`,
    block.rail !== null,
    true,
  );
  check(
    `блок ${block.blockIndex + 1}: рельс не выступает вперёд`,
    (block.rail?.maxZ ?? 1) <= 0,
    true,
  );
  near(
    `блок ${block.blockIndex + 1}: высота рельса`,
    (block.rail?.maxY ?? 0) - (block.rail?.minY ?? 0),
    SIGN_RAIL_HEIGHT_MM,
  );
  near(
    `блок ${block.blockIndex + 1}: толщина рельса`,
    (block.rail?.maxZ ?? 0) - (block.rail?.minZ ?? 0),
    SIGN_RAIL_THICKNESS_MM,
  );
  near(
    `блок ${block.blockIndex + 1}: рельс по ширине лица`,
    (block.rail?.maxX ?? 0) - (block.rail?.minX ?? 0),
    block.faceWidth,
  );
  check(
    `блок ${block.blockIndex + 1}: канал рельса сквозной`,
    block.wireHoles.some((hole) => hole.source === "rail" && hole.through),
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

console.log("\nТрекинг и целостность букв");
const placedLetters = baseLayout.blocks
  .flatMap((block) => block.letters)
  .sort((a, b) => a.left - b.left);
const gaps = placedLetters
  .slice(1)
  .map((letter, index) => letter.left - placedLetters[index].right);
const minGap = Math.min(...gaps);
const maxGap = Math.max(...gaps);

check("в строке все буквы", placedLetters.length, 5);
atMost("разброс трекинга", maxGap - minGap, 0.05);
near("трекинг равен зазору", (minGap + maxGap) / 2, base.signLetterGap);
console.log(
  `    зазоры ${gaps.map((gap) => gap.toFixed(2)).join(", ")} мм; буквы ${placedLetters
    .map((letter) => letter.char)
    .join("")}`,
);

const faceHeights = baseLayout.blocks.map((block) => block.faceHeight);

for (const block of baseLayout.blocks) {
  const text = block.letters.map((letter) => letter.char).join("");

  near(`блок ${block.blockIndex + 1}: высота как у шрифта`, block.faceHeight, glyphHeightOf(text));
}
console.log(
  `    высота букв ${faceHeights.map((height) => height.toFixed(1)).join(", ")} мм; шрифт ${baseLayout.blocks
    .map((block) => glyphHeightOf(block.letters.map((letter) => letter.char).join("")).toFixed(1))
    .join(", ")} мм`,
);

for (const mode of ["detachable", "fixed", "none"] as const) {
  const modeLayout =
    mode === "detachable"
      ? baseLayout
      : layoutOf({ ...base, signRailMode: mode }, font);

  for (const block of modeLayout.blocks) {
    const text = block.letters.map((letter) => letter.char).join("");

    near(`${mode}: блок ${block.blockIndex + 1} без ножек`, block.faceHeight, glyphHeightOf(text));
  }
}

for (const blockIndex of [0, 1]) {
  for (const part of ["face", "cover", "rail"] as const) {
    const partGeometry = createSignBlockGeometry(base, font, blockIndex, part);

    if (!hasGeometry(partGeometry)) {
      check(`б${blockIndex + 1} ${part}: пустая деталь`, false, true);
      partGeometry.dispose();
      continue;
    }

    const state = topology(partGeometry);

    check(`б${blockIndex + 1} ${part}: незамкнутых рёбер`, state.open, 0);
    check(`б${blockIndex + 1} ${part}: неманифолдных рёбер`, state.nonManifold, 0);
    check(`б${blockIndex + 1} ${part}: вырожденных граней`, state.degenerate, 0);
    check(`б${blockIndex + 1} ${part}: NaN`, state.nan, 0);
    partGeometry.dispose();
  }
}

for (const mode of ["fixed", "none"] as const) {
  for (const part of ["face", "cover"] as const) {
    const modeGeometry = createSignBlockGeometry(
      { ...base, signRailMode: mode },
      font,
      0,
      part,
    );

    if (!hasGeometry(modeGeometry)) {
      check(`${mode} ${part}: пустая деталь`, false, true);
      modeGeometry.dispose();
      continue;
    }

    const state = topology(modeGeometry);

    check(`${mode} ${part}: незамкнутых рёбер`, state.open, 0);
    check(`${mode} ${part}: неманифолдных рёбер`, state.nonManifold, 0);
    modeGeometry.dispose();
  }
}

const facePart = createSignBlockGeometry(base, font, 0, "face");

facePart.computeBoundingBox();

if (!facePart.boundingBox) {
  failures.push("лицо 60/3: нет габаритов");
} else {
  near(
    "лицо 60/3: толщина букв",
    facePart.boundingBox.max.z - facePart.boundingBox.min.z,
    base.signDepth,
  );
  atMost(
    "лицо 60/3: толщина не больше 12 мм",
    facePart.boundingBox.max.z - facePart.boundingBox.min.z,
    12,
  );
}

facePart.dispose();

console.log("\nЛицо без общей планки и вес");
const preview = createSignGeometry(base, font);
preview.computeBoundingBox();

const previewBox = preview.boundingBox;

if (!previewBox) {
  failures.push("предпросмотр: нет габаритов");
} else {
  const coverage = frontCoverage(preview, previewBox.min.y + 6);

  check("спереди нет планки под буквами", coverage < 0.7, true);
  console.log(
    `    передняя линия занята на ${(coverage * 100).toFixed(1)}%; габарит ${(
      previewBox.max.x - previewBox.min.x
    ).toFixed(1)} × ${(previewBox.max.y - previewBox.min.y).toFixed(1)} мм`,
  );

  const weight = calculateGeometryWeightGrams(preview);

  check(
    "буквы полые: у блока есть задняя стенка",
    baseLayout.blocks.every((block) => block.coverWidth > 0),
    true,
  );
  atMost("вес всей вывески «ТРИ ДИ»", weight, 300);
  console.log(`    вес лица, задних стенок и рельса ${weight.toFixed(0)} г`);
}

const railPart = createSignBlockGeometry(base, font, 0, "rail");

railPart.computeBoundingBox();

if (!railPart.boundingBox) {
  failures.push("рельс: пустая деталь");
} else {
  near(
    "рельс отдельной детали: высота",
    railPart.boundingBox.max.y - railPart.boundingBox.min.y,
    SIGN_RAIL_HEIGHT_MM,
  );

  const railBox = railPart.boundingBox;
  const railMesh = new Mesh(railPart);

  railMesh.updateMatrixWorld(true);

  const channelRay = new Raycaster();

  // Канал открыт в заднюю плоскость рельса: луч идёт по его середине.
  channelRay.set(
    new Vector3(
      railBox.min.x - 10,
      railBox.min.y + SIGN_RAIL_HEIGHT_MM / 2,
      railBox.min.z + 1,
    ),
    new Vector3(1, 0, 0),
  );
  check(
    "канал Ø4 проходит сквозь рельс",
    channelRay.intersectObject(railMesh, true).length,
    0,
  );
  railMesh.clear();
}

const coverPart = createSignBlockGeometry(base, font, 0, "cover");

coverPart.computeBoundingBox();

if (coverPart.boundingBox) {
  atMost(
    "съёмная задняя стенка остаётся плоской",
    coverPart.boundingBox.max.z - coverPart.boundingBox.min.z,
    4,
  );
}

coverPart.dispose();
railPart.dispose();
preview.dispose();

console.log("\nЖёсткий рельс: одна деталь со стенкой, без пазов и зазоров");
const fixed = layoutOf({ ...base, signRailMode: "fixed" }, font);
const fixedBlock = fixed.blocks[0];

check(
  "fixed: рельс в отчёте есть",
  fixed.blocks.every((block) => block.rail !== null),
  true,
);
check(
  "fixed: отдельной детали рельса нет",
  hasGeometry(createSignBlockGeometry({ ...base, signRailMode: "fixed" }, font, 0, "rail")),
  false,
);

const fixedCover = createSignBlockGeometry(
  { ...base, signRailMode: "fixed" },
  font,
  0,
  "cover",
);

fixedCover.computeBoundingBox();

const fixedCoverDepth = fixedCover.boundingBox
  ? fixedCover.boundingBox.max.z - fixedCover.boundingBox.min.z
  : 0;

if (!fixedCover.boundingBox) {
  failures.push("fixed: у задней стенки нет габаритов");
} else {
  // Плита стенки 2 мм и шип 1.6 мм дают 3.4 мм. Рельс уходит ещё на 3.8 мм
  // назад от плиты: огибающая глубже 6 мм доказывает, что он напечатан в этой
  // же детали, а не висит отдельно.
  check(
    "fixed: рельс входит в заднюю стенку",
    fixedCoverDepth > 6,
    true,
  );
}

const fixedState = hasGeometry(fixedCover) ? topology(fixedCover) : null;

if (fixedState) {
  check("fixed cover: незамкнутых рёбер", fixedState.open, 0);
  check("fixed cover: неманифолдных рёбер", fixedState.nonManifold, 0);
} else {
  failures.push("fixed: задняя стенка пустая");
}

fixedCover.dispose();

if (fixedBlock) {
  near(
    "fixed: высота рельса",
    (fixedBlock.rail?.maxY ?? 0) - (fixedBlock.rail?.minY ?? 0),
    SIGN_RAIL_HEIGHT_MM,
  );
  near(
    "fixed: толщина рельса",
    (fixedBlock.rail?.maxZ ?? 0) - (fixedBlock.rail?.minZ ?? 0),
    SIGN_RAIL_THICKNESS_MM,
  );
  check(
    "fixed: рельс не выступает вперёд",
    (fixedBlock.rail?.maxZ ?? 1) <= 0,
    true,
  );
  console.log(
    `    fixed: задняя стенка с рельсом ${fixedCoverDepth.toFixed(1)} мм по Z`,
  );
}

const fixedOptions = signExportOptions(
  normalizeSignParams({ ...base, signRailMode: "fixed" }),
  fixed,
);

check(
  "fixed: кнопки рельса нет",
  fixedOptions.some((option) => option.request.signPart === "rail"),
  false,
);
check(
  "fixed: кнопка стенки с рельсом есть",
  fixedOptions.some((option) => option.request.signPart === "cover"),
  true,
);

console.log("\nБез рельса: плоская глухая стенка, рельса нет");
const noneLayout = layoutOf({ ...base, signRailMode: "none" }, font);

check(
  "без рельса: рельс не строится",
  noneLayout.blocks.every((block) => block.rail === null),
  true,
);
check(
  "без рельса: отверстий рельса нет",
  noneLayout.blocks.every((block) =>
    block.wireHoles.every((hole) => hole.source === "letter"),
  ),
  true,
);
check(
  "без рельса: отдельной детали рельса нет",
  hasGeometry(createSignBlockGeometry({ ...base, signRailMode: "none" }, font, 0, "rail")),
  false,
);

const noneCover = createSignBlockGeometry(
  { ...base, signRailMode: "none" },
  font,
  0,
  "cover",
);

noneCover.computeBoundingBox();

if (!noneCover.boundingBox) {
  failures.push("без рельса: у задней стенки нет габаритов");
} else {
  near(
    "без рельса: стенка ровно 2 мм, без шипа",
    noneCover.boundingBox.max.z - noneCover.boundingBox.min.z,
    SIGN_COVER_PLATE_MM,
  );
}

const noneState = hasGeometry(noneCover) ? topology(noneCover) : null;

if (noneState) {
  check("без рельса cover: незамкнутых рёбер", noneState.open, 0);
  check("без рельса cover: неманифолдных рёбер", noneState.nonManifold, 0);
} else {
  failures.push("без рельса: задняя стенка пустая");
}
noneCover.dispose();

const noRailOptions = signExportOptions(
  normalizeSignParams({ ...base, signRailMode: "none" }),
  noneLayout,
);

check(
  "без рельса: кнопки рельса нет",
  noRailOptions.some((option) => option.request.signPart === "rail"),
  false,
);
check(
  "без рельса: кнопка плоской стенки есть",
  noRailOptions.some((option) => option.request.signPart === "cover"),
  true,
);

console.log("\nУзкая сплошная буква: провод уходит в канал рельса");
const solid = layoutOf({ ...base, signText: "1", signBlockSize: 1 }, font);
const solidBlock = solid.blocks[0];

if (!solidBlock) {
  failures.push("буква 1: нет блока");
} else {
  check("буква 1: отверстие есть", solidBlock.wireHoles.length > 0, true);
  check(
    "буква 1: отверстие в рельсе",
    solidBlock.wireHoles.some((hole) => hole.source === "rail"),
    true,
  );
  near(
    "буква 1: диаметр канала рельса",
    (solidBlock.wireHoles.find((hole) => hole.source === "rail")?.radius ?? 0) *
      2,
    SIGN_RAIL_WIRE_HOLE_MM,
  );
  check("буква 1: задней стенки нет", solidBlock.coverWidth, 0);

  const solidPackage = createSignBlockPackageGeometry(
    { ...base, signText: "1", signBlockSize: 1 },
    font,
    0,
  );

  check("буква 1: пакет без задней стенки собирается", solidPackage !== null, true);
  solidPackage?.dispose();

  const solidOptions = signExportOptions(
    normalizeSignParams({ ...base, signText: "1", signBlockSize: 1 }),
    solid,
  );

  check(
    "буква 1: пустой кнопки задней стенки нет",
    solidOptions.some((option) => option.request.signPart === "cover"),
    false,
  );
}

// У сплошной буквы нет задней стенки, но в fixed рельс всё равно должен
// печататься вместе с ней: проверяем, что деталь cover не пустая и рельс
// входит в её габарит.
const solidFixedParams = {
  ...base,
  signText: "1",
  signBlockSize: 1,
  signRailMode: "fixed" as const,
};
const solidFixed = layoutOf(solidFixedParams, font);
const solidFixedPieces = createSignBlockGeometry(
  solidFixedParams,
  font,
  0,
  "cover",
);

check(
  "буква 1 fixed: рельс в отчёте",
  solidFixed.blocks[0]?.rail !== null,
  true,
);
check(
  "буква 1 fixed: рельс в детали",
  hasGeometry(solidFixedPieces),
  true,
);
const solidFixedState = topology(solidFixedPieces);

check("буква 1 fixed: незамкнутых рёбер", solidFixedState.open, 0);
check("буква 1 fixed: неманифолдных рёбер", solidFixedState.nonManifold, 0);
solidFixedPieces.dispose();

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
      "60/3: лицо и задняя стенка не пересекаются",
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
    "80/2: кнопка рельса есть",
    options.some((option) => option.request.signPart === "rail"),
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
    "120/2: лицо и задняя стенка доступны",
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

console.log("\n80/3: после удаления плиты пакет снова влезает");
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
  check("80/3: пакет влезает", oversizeBlock.package.fits, true);
  atMost("80/3: ширина пакета", oversizeBlock.package.width, SIGN_PRINT_BED_MM);
  atMost("80/3: глубина пакета", oversizeBlock.package.depth, SIGN_PRINT_BED_MM);
  const oversizePackage = createSignBlockPackageGeometry(
    oversizeParams,
    font,
    0,
  );

  check("80/3: общий STL выдаётся", oversizePackage !== null, true);
  check(
    "80/3: предупреждения нет",
    signExportNotice(normalizeSignParams(oversizeParams), oversize),
    null,
  );
  oversizePackage?.dispose();
  console.log(
    `    блок ${oversizeBlock.faceWidth.toFixed(
      1,
    )} × ${oversizeBlock.faceHeight.toFixed(
      1,
    )} мм; пакет ${oversizeBlock.package.width.toFixed(
      1,
    )} × ${oversizeBlock.package.depth.toFixed(1)} мм`,
  );
}

console.log("\nПлан упаковки без геометрии");
// Асимметричная пара: сверху и рядом без поворота не влезает, а поворот лица
// на 90° уменьшает ширину и оставляет пакет в пределах стола.
const planned = planSignPackage(210, 120, 60, 120);

check("план поворачивает лицо", planned.faceRotated, true);
check("план кладёт заднюю стенку рядом", planned.arrangement, "side");
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

