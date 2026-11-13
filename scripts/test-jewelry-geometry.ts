/**
 * Тест геометрии подставки для украшений.
 *
 * Проверяет то, что обещает панель: габарит по Z совпадает с высотой из
 * ползунка, рожки для цепочек стоят в плоскости Y и выступают вперёд, а
 * перекладина под кольца имеет глубину по Y. Цепочка, свисающая со штыря рожка,
 * проходит мимо колец с зазором — это и есть исправление «цепочка падает на
 * кольца». Сетка неиндексированная, поэтому вершины свариваются по координатам:
 * без этого у каждого треугольника были бы свои вершины и проверка рёбер не
 * нашла бы ни одной пары.
 *
 * Запуск:
 *   node --import ./scripts/register-alias.mjs scripts/test-jewelry-geometry.ts
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import type { BufferGeometry } from "three";

import {
  JEWELRY_DEER_ANTLER_BUD_RADIUS_MM,
  JEWELRY_DEER_ANTLER_TIP_RADIUS_MM,
  JEWELRY_DEER_BASE_HEIGHT_MM,
  JEWELRY_DEER_WEIGHT_DIAMETER_MM,
  JEWELRY_DEER_WEIGHT_OFFSET_MM,
  jewelryDeerHeightMm,
  jewelryDeerPlan,
  type JewelryDeerPlan,
} from "../lib/constructor/jewelry-deer-geometry";
import {
  JEWELRY_LEAF_BOWL_DEPTH_MM,
  JEWELRY_LEAF_MIN_THICKNESS_MM,
  jewelryLeafHalfWidthAt,
  jewelryLeafHeightMm,
  jewelryLeafPlateThicknessMm,
  jewelryLeafReliefMm,
} from "../lib/constructor/jewelry-leaf-geometry";
import {
  JEWELRY_BAR_HEIGHT_RATIO,
  JEWELRY_BAR_RADIUS_MM,
  JEWELRY_HORN_RADIUS_MM,
  JEWELRY_HORN_STUB_RADIUS_MM,
  JEWELRY_POST_RADIUS_MM,
  JEWELRY_STABILITY_BASE_RATIO,
  createJewelryStandGeometry,
  jewelryBaseIsNarrow,
  jewelryStandMetrics,
  jewelryStableBaseMm,
} from "../lib/constructor/jewelry-stand-geometry";
import {
  JEWELRY_CONFIGS,
  JEWELRY_LEAF_TYPES,
  jewelryStandStlFileName,
  normalizeJewelryStandParams,
  type JewelryConfig,
} from "../lib/constructor/params";

type Point = readonly [number, number, number];

interface Mesh {
  readonly vertices: Point[];
  readonly triangles: readonly (readonly [number, number, number])[];
}

/** Допуск по высоте, мм: столько ТЗ отводит на скос торца и крышку. */
const HEIGHT_TOLERANCE_MM = 0.1;

/** Зазор между цепочкой на рожке и перекладиной колец, мм. */
const CHAIN_BAR_GAP_MM = 8;

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
  const passed = Math.abs(actual - expected) <= 1e-4;

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

/**
 * Проверка внутри матрицы конфигураций.
 *
 * Печатать по строке на каждую из семидесяти пяти конфигураций бессмысленно:
 * итог по конфигурации выводится одной строкой, а расхождения копятся здесь и
 * печатаются в конце с именем конфигурации.
 */
function expect(name: string, passed: boolean, detail: string): boolean {
  if (!passed) {
    failures.push(`${name}: ${detail}`);
  }

  return passed;
}

function expectNear(
  name: string,
  actual: number,
  expected: number,
  tolerance: number,
): boolean {
  return expect(
    name,
    Math.abs(actual - expected) <= tolerance,
    `получено ${actual.toFixed(3)} мм, ожидалось ${expected.toFixed(3)} ± ${tolerance}`,
  );
}

/** Сварка неиндексированной сетки по координатам. */
function weld(geometry: BufferGeometry): Mesh {
  const position = geometry.getAttribute("position");
  const lookup = new Map<string, number>();
  const vertices: Point[] = [];
  const triangles: [number, number, number][] = [];
  const epsilon = 1e-6;

  const idOf = (index: number): number => {
    const x = Math.round(position.getX(index) / epsilon);
    const y = Math.round(position.getY(index) / epsilon);
    const z = Math.round(position.getZ(index) / epsilon);
    const key = `${x}:${y}:${z}`;
    const known = lookup.get(key);

    if (known !== undefined) {
      return known;
    }

    const id = vertices.length;
    lookup.set(key, id);
    vertices.push([
      position.getX(index),
      position.getY(index),
      position.getZ(index),
    ]);

    return id;
  };

  for (let offset = 0; offset < position.count; offset += 3) {
    triangles.push([idOf(offset), idOf(offset + 1), idOf(offset + 2)]);
  }

  return { vertices, triangles };
}

/** Рёбер, которые встречаются не дважды: ненулевое значение — дыра. */
function openEdges(mesh: Mesh): number {
  const edges = new Map<string, number>();

  for (const [a, b, c] of mesh.triangles) {
    for (const [from, to] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }

  let open = 0;

  for (const count of edges.values()) {
    if (count !== 2) {
      open += 1;
    }
  }

  return open;
}

/** Треугольники с нулевой площадью или повторяющейся вершиной. */
function degenerateTriangles(mesh: Mesh): number {
  let count = 0;

  for (const [a, b, c] of mesh.triangles) {
    const pa = mesh.vertices[a];
    const pb = mesh.vertices[b];
    const pc = mesh.vertices[c];

    if (a === b || b === c || c === a) {
      count += 1;
      continue;
    }

    const ux = pb[0] - pa[0];
    const uy = pb[1] - pa[1];
    const uz = pb[2] - pa[2];
    const vx = pc[0] - pa[0];
    const vy = pc[1] - pa[1];
    const vz = pc[2] - pa[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;

    if (nx * nx + ny * ny + nz * nz <= 1e-14) {
      count += 1;
    }
  }

  return count;
}

function nanVertices(geometry: BufferGeometry): number {
  const position = geometry.getAttribute("position");
  let count = 0;

  for (let index = 0; index < position.count; index += 1) {
    if (
      !Number.isFinite(position.getX(index)) ||
      !Number.isFinite(position.getY(index)) ||
      !Number.isFinite(position.getZ(index))
    ) {
      count += 1;
    }
  }

  return count;
}

function volumeMm3(mesh: Mesh): number {
  let total = 0;

  for (const [a, b, c] of mesh.triangles) {
    const pa = mesh.vertices[a];
    const pb = mesh.vertices[b];
    const pc = mesh.vertices[c];

    total +=
      pa[0] * (pb[1] * pc[2] - pb[2] * pc[1]) -
      pa[1] * (pb[0] * pc[2] - pb[2] * pc[0]) +
      pa[2] * (pb[0] * pc[1] - pb[1] * pc[0]);
  }

  return Math.abs(total / 6);
}

/** Границы выбранных вершин по одной оси. */
function range(points: readonly Point[], axis: 0 | 1 | 2): [number, number] {
  let min = Infinity;
  let max = -Infinity;

  for (const point of points) {
    min = Math.min(min, point[axis]);
    max = Math.max(max, point[axis]);
  }

  return [min, max];
}


/**
 * Треугольники-потолки, которые действительно висят в воздухе.
 *
 * Нависание считается по нормали: если она смотрит вниз круче 45° к вертикали,
 * слайсеру нужна поддержка. Два вида потолков не в счёт: дно на столе и нижние
 * торцы крючка, утопленные в плиту — над ними есть материал, и слайсер
 * объединяет тела. Поэтому потолок внутри плиты пропускается, а всё, что выше
 * её лица, обязано быть пустым.
 */
function overhangTriangles(
  mesh: Mesh,
  plateMm: number,
  params: {
    readonly jewelryLeafLength: number;
    readonly jewelryLeafType: "monstera" | "fern" | "oak";
  },
): number {
  let count = 0;

  for (const [a, b, c] of mesh.triangles) {
    const pa = mesh.vertices[a];
    const pb = mesh.vertices[b];
    const pc = mesh.vertices[c];
    const centerX = (pa[0] + pb[0] + pc[0]) / 3;
    const centerY = (pa[1] + pb[1] + pc[1]) / 3;
    const centerZ = (pa[2] + pb[2] + pc[2]) / 3;

    if (centerZ <= 0.01) {
      continue;
    }

    const ux = pb[0] - pa[0];
    const uy = pb[1] - pa[1];
    const uz = pb[2] - pa[2];
    const vx = pc[0] - pa[0];
    const vy = pc[1] - pa[1];
    const vz = pc[2] - pa[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);

    if (length <= 0 || nz / length >= -Math.SQRT1_2) {
      continue;
    }

    const t = Math.min(
      1,
      Math.max(
        0,
        (centerX + params.jewelryLeafLength / 2) / params.jewelryLeafLength,
      ),
    );
    const insidePlate =
      centerZ <= plateMm &&
      Math.abs(centerY) <= jewelryLeafHalfWidthAt(params, t) + 1e-6;

    if (!insidePlate) {
      count += 1;
    }
  }

  return count;
}

interface Case {
  readonly height: number;
  readonly base: number;
  readonly config: JewelryConfig;
}

const cases: Case[] = [];

for (const height of [60, 80, 100, 120, 160]) {
  for (const base of [50, 60, 80, 100, 120]) {
    for (const config of JEWELRY_CONFIGS) {
      cases.push({ height, base, config });
    }
  }
}

console.log("Габарит, рожки и глубина штанги");

for (const testCase of cases) {
  const name = `H${testCase.height}/D${testCase.base}/${testCase.config}`;
  const geometry = createJewelryStandGeometry({
    jewelryPreset: "braided_tree",
    jewelryHeight: testCase.height,
    jewelryBase: testCase.base,
    jewelryConfig: testCase.config,
  });
  const mesh = weld(geometry);
  const before = failures.length;
  const [minX, maxX] = range(mesh.vertices, 0);
  const [minY, maxY] = range(mesh.vertices, 1);
  const [minZ, maxZ] = range(mesh.vertices, 2);
  const withNecklace = testCase.config !== "rings";

  expectNear(
    `${name}: высота`,
    maxZ - minZ,
    testCase.height,
    HEIGHT_TOLERANCE_MM,
  );
  expectNear(`${name}: низ на столе`, minZ, 0, 1e-4);
  expectNear(`${name}: габарит по X`, maxX - minX, testCase.base, 1e-4);
  expectNear(`${name}: габарит по Y`, maxY - minY, testCase.base, 1e-4);
  expect(
    `${name}: ничего не выше высоты`,
    maxZ <= testCase.height + 1e-4,
    `верх ${maxZ.toFixed(3)} мм при высоте ${testCase.height} мм`,
  );
  expect(`${name}: без NaN`, nanVertices(geometry) === 0, "в координатах NaN");

  let hornTipY = 0;
  let chainGap = Number.POSITIVE_INFINITY;

  if (withNecklace) {
    // Торец штыря лежит на высоте стойки; вершины рожка не выходят в X: рожок
    // стоит в плоскости Y, стойка — в центре, поэтому фильтр отсекает её кольцо.
    const topRim = mesh.vertices.filter(
      (point) =>
        Math.abs(point[2] - testCase.height) <= 1e-4 &&
        Math.abs(point[1]) > JEWELRY_POST_RADIUS_MM + 0.1,
    );
    const hornInnerY = topRim.reduce(
      (min, point) => Math.min(min, Math.abs(point[1])),
      Number.POSITIVE_INFINITY,
    );

    hornTipY = topRim.reduce(
      (max, point) => Math.max(max, Math.abs(point[1])),
      0,
    );
    chainGap = hornInnerY - JEWELRY_BAR_RADIUS_MM;

    expect(
      `${name}: штырь рожка на высоте стойки`,
      topRim.length > 0,
      "верха рожка нет на высоте H",
    );
    expect(
      `${name}: рожок в плоскости Y`,
      topRim.every(
        (point) => Math.abs(point[0]) <= JEWELRY_HORN_STUB_RADIUS_MM + 1e-3,
      ),
      "вершины рожка ушли в X",
    );
    expect(
      `${name}: рожок выступает за стойку`,
      hornInnerY - JEWELRY_POST_RADIUS_MM >= JEWELRY_HORN_RADIUS_MM,
      `внутренний край ${hornInnerY.toFixed(2)} мм при стойке ${JEWELRY_POST_RADIUS_MM} мм`,
    );
  }

  if (testCase.config !== "necklace") {
    // Перекладина — цилиндр по X: её глубина по Y равна диаметру, 8.4 мм.
    const barZ = testCase.height * JEWELRY_BAR_HEIGHT_RATIO;
    const barPoints = mesh.vertices.filter(
      (point) =>
        Math.abs(point[2] - barZ) <= JEWELRY_BAR_RADIUS_MM + 1e-4 &&
        Math.abs(point[0]) > JEWELRY_POST_RADIUS_MM,
    );
    const [barMinY, barMaxY] = range(barPoints, 1);
    const [barMinZ, barMaxZ] = range(barPoints, 2);

    expect(
      `${name}: у штанги есть вершины`,
      barPoints.length > 0,
      "вершин штанги не найдено",
    );
    expectNear(
      `${name}: глубина штанги по Y`,
      barMaxY - barMinY,
      2 * JEWELRY_BAR_RADIUS_MM,
      1e-4,
    );
    expectNear(
      `${name}: высота штанги`,
      barMaxZ - barMinZ,
      2 * JEWELRY_BAR_RADIUS_MM,
      1e-4,
    );
  }

  if (testCase.config === "combo") {
    expect(
      `${name}: цепочка проходит мимо колец`,
      chainGap >= CHAIN_BAR_GAP_MM,
      `зазор ${chainGap.toFixed(2)} мм при норме ${CHAIN_BAR_GAP_MM} мм`,
    );
  }

  const passed = failures.length === before;

  console.log(
    `  ${passed ? "✓" : "✗"} ${name}: высота ${(maxZ - minZ).toFixed(2)} мм` +
      (withNecklace ? `, рожки ±${hornTipY.toFixed(1)} мм` : "") +
      (testCase.config === "combo"
        ? `, зазор до колец ${chainGap.toFixed(1)} мм`
        : ""),
  );
}


/** Тело целиком: умолчание и три крайние конфигурации. */
const solids: readonly { readonly name: string; readonly case: Case }[] = [
  { name: "по умолчанию", case: { height: 100, base: 80, config: "combo" } },
  { name: "минимум 60/50", case: { height: 60, base: 50, config: "combo" } },
  {
    name: "максимум 160/120",
    case: { height: 160, base: 120, config: "combo" },
  },
  {
    name: "только цепочки 160/50",
    case: { height: 160, base: 50, config: "necklace" },
  },
];

console.log("\nТело детали");

for (const solid of solids) {
  const geometry = createJewelryStandGeometry({
    jewelryPreset: "braided_tree",
    jewelryHeight: solid.case.height,
    jewelryBase: solid.case.base,
    jewelryConfig: solid.case.config,
  });
  const mesh = weld(geometry);
  const volume = volumeMm3(mesh) / 1000;

  check(`${solid.name}: открытых рёбер`, openEdges(mesh), 0);
  check(`${solid.name}: вырожденных треугольников`, degenerateTriangles(mesh), 0);
  check(`${solid.name}: NaN вершин`, nanVertices(geometry), 0);
  check(`${solid.name}: объём положительный`, volume > 0, true);
  check(
    `${solid.name}: объём в коридоре 20–120 см³`,
    volume >= 20 && volume <= 120,
    true,
  );
  console.log(`  · объём ${volume.toFixed(1)} см³`);
}

/** Треугольников в сетке выбранного режима. */
function triangleCount(config: JewelryConfig): number {
  const geometry = createJewelryStandGeometry({
    jewelryPreset: "braided_tree",
    jewelryConfig: config,
  });

  return geometry.getAttribute("position").count / 3;
}

console.log("\nСостав по режимам");

// Числа держат число сторон: основание 64, стойка 48, штанга 28, рожок 24 —
// по две пары треугольников на сегмент и две крышки веером. Правка сторон
// меняет эти числа намеренно, и тест об этом скажет.
check("только кольца: 560 треугольников", triangleCount("rings"), 560);
check("только цепочки: 832 треугольника", triangleCount("necklace"), 832);
check("кольца и цепочки: 944 треугольника", triangleCount("combo"), 944);

console.log("\nУстойчивость");

check("порог основания — 0.55 высоты", JEWELRY_STABILITY_BASE_RATIO, 0.55);
check("H=60 советует Ø50", jewelryStableBaseMm(60), 50);
check("H=100 советует Ø55", jewelryStableBaseMm(100), 55);
check("H=120 советует Ø70", jewelryStableBaseMm(120), 70);
check("H=160 советует Ø90", jewelryStableBaseMm(160), 90);
check("60/50 устойчива", jewelryBaseIsNarrow(60, 50), false);
check("100/50 неустойчива", jewelryBaseIsNarrow(100, 50), true);
check("100/55 устойчива", jewelryBaseIsNarrow(100, 55), false);
check("160/85 неустойчива", jewelryBaseIsNarrow(160, 85), true);
check("160/90 устойчива", jewelryBaseIsNarrow(160, 90), false);
check("160/120 устойчива", jewelryBaseIsNarrow(160, 120), false);

console.log("\nИмя STL и границы ползунков");

const filename = jewelryStandStlFileName(
  normalizeJewelryStandParams({
    jewelryPreset: "braided_tree",
    jewelryHeight: 100,
    jewelryBase: 80,
  }),
);

check(
  "имя файла",
  filename,
  "tridi-podstavka-ukrasheniy-braided-tree-h100-d80.stl",
);
check("имя файла только ASCII", /^[\x20-\x7E]+$/.test(filename), true);

const clamped = normalizeJewelryStandParams({
  jewelryPreset: "braided_tree",
  jewelryHeight: 500,
  jewelryBase: 5,
  jewelryConfig: "combo",
});
const clampedMesh = weld(createJewelryStandGeometry(clamped));
const [clampedMinX, clampedMaxX] = range(clampedMesh.vertices, 0);
const [clampedMinZ, clampedMaxZ] = range(clampedMesh.vertices, 2);

check("высота за ползунком ужата до максимума", clamped.jewelryHeight, 160);
check("основание за ползунком поднято до минимума", clamped.jewelryBase, 50);
near("высота ужатой детали", clampedMaxZ - clampedMinZ, 160);
near("габарит ужатой детали по X", clampedMaxX - clampedMinX, 50);

console.log("\nЛоток-лист: силуэт и рельеф");

/** Базовая конфигурация листа: крайние значения проверяются отдельно. */
const leafCase = {
  jewelryPreset: "leaf_tray" as const,
  jewelryLeafType: "monstera" as const,
  jewelryLeafLength: 150,
  jewelryLeafWidth: 100,
  jewelryLeafVeinDepth: 2,
};

let widestHalfMm = 0;
let widestT = 0;

for (let index = 0; index <= 1000; index += 1) {
  const t = index / 1000;
  const half = jewelryLeafHalfWidthAt(leafCase, t);

  if (half > widestHalfMm) {
    widestHalfMm = half;
    widestT = t;
  }
}

near("лист: ширина равна ползунку", widestHalfMm * 2, 100);
check(
  "лист: самое широкое место — средняя треть",
  widestT > 0.35 && widestT < 0.65,
  true,
);
near("лист: плита над ложем", jewelryLeafPlateThicknessMm(2), 4.5);
near("лист: минимальная толщина", JEWELRY_LEAF_MIN_THICKNESS_MM, 1.6);
near(
  "лист: глубина в центре жилки",
  jewelryLeafReliefMm(leafCase, 0, 0),
  2 + JEWELRY_LEAF_BOWL_DEPTH_MM,
);
near(
  "лист: у края рельеф затухает",
  jewelryLeafReliefMm(leafCase, 0, widestHalfMm - 0.1),
  0,
);
check(
  "лист: рельеф не глубже жилки и ложа",
  jewelryLeafReliefMm(leafCase, 0, 0) <=
    leafCase.jewelryLeafVeinDepth + JEWELRY_LEAF_BOWL_DEPTH_MM + 1e-9,
  true,
);

const leafMetrics = jewelryStandMetrics(leafCase);

near("лист: метрика длины", leafMetrics.widthMm, 150);
near("лист: метрика ширины", leafMetrics.depthMm, 100);
near(
  "лист: метрика высоты",
  leafMetrics.heightMm,
  jewelryLeafHeightMm(leafCase),
);
check(
  "по умолчанию строится лист",
  jewelryStandMetrics({}).heightMm > 15,
  true,
);

console.log("\nЛоток-лист: тело детали");

const leafGeometry = createJewelryStandGeometry(leafCase);
const leafMesh = weld(leafGeometry);
const leafVolume = volumeMm3(leafMesh) / 1000;
const [leafMinX, leafMaxX] = range(leafMesh.vertices, 0);
const [leafMinY, leafMaxY] = range(leafMesh.vertices, 1);
const [leafMinZ, leafMaxZ] = range(leafMesh.vertices, 2);
const leafPlate = jewelryLeafPlateThicknessMm(leafCase.jewelryLeafVeinDepth);

check("лист: открытых рёбер", openEdges(leafMesh), 0);
check("лист: вырожденных треугольников", degenerateTriangles(leafMesh), 0);
check("лист: NaN вершин", nanVertices(leafGeometry), 0);
check("лист: объём положительный", leafVolume > 0, true);
check(
  "лист: объём в коридоре 30–80 см³",
  leafVolume >= 30 && leafVolume <= 80,
  true,
);
console.log(`  · объём ${leafVolume.toFixed(1)} см³`);

expectNear("лист: низ на столе", leafMinZ, 0, 1e-4);
expectNear("лист: длина по X", leafMaxX - leafMinX, 150, 0.02);
expectNear("лист: ширина по Y", leafMaxY - leafMinY, 100, 0.6);
expectNear(
  "лист: высота вместе с крючком",
  leafMaxZ - leafMinZ,
  jewelryLeafHeightMm(leafCase),
  0.05,
);
check(
  "лист: нет нависаний круче 45°",
  overhangTriangles(leafMesh, leafPlate, leafCase),
  0,
);

console.log("\nЛоток-лист: три силуэта");

for (const leafType of JEWELRY_LEAF_TYPES) {
  const silhouette = createJewelryStandGeometry({
    ...leafCase,
    jewelryLeafType: leafType,
  });
  const mesh = weld(silhouette);
  const [minY, maxY] = range(mesh.vertices, 1);

  check(`${leafType}: открытых рёбер`, openEdges(mesh), 0);
  check(`${leafType}: NaN вершин`, nanVertices(silhouette), 0);
  check(
    `${leafType}: объём положительный`,
    volumeMm3(mesh) > 0,
    true,
  );
  expectNear(`${leafType}: ширина`, maxY - minY, 100, 0.6);
}

console.log("\nЛоток-лист: имя файла и границы ползунков");

const leafFileName = jewelryStandStlFileName(
  normalizeJewelryStandParams(leafCase),
);

check(
  "лист: имя файла",
  leafFileName,
  "tridi-podstavka-ukrasheniy-leaf-tray-monstera-l150-w100-v2.stl",
);
check(
  "лист: имя файла только ASCII",
  /^[\x20-\x7E]+$/.test(leafFileName),
  true,
);

const clampedLeaf = normalizeJewelryStandParams({
  jewelryPreset: "leaf_tray",
  jewelryLeafLength: 500,
  jewelryLeafWidth: 5,
  jewelryLeafVeinDepth: 9,
});

check("лист: длина ужата", clampedLeaf.jewelryLeafLength, 170);
check("лист: ширина поднята", clampedLeaf.jewelryLeafWidth, 80);
check("лист: глубина ужата", clampedLeaf.jewelryLeafVeinDepth, 3);

/**
 * Расстояние от точки до отрезка прямой.
 *
 * Нужно, чтобы понять, утоплен ли корень рога в голове: булевых операций в
 * генераторе нет, тела просто пересекаются, и проверка идёт по осям.
 */
function distanceToSegment(point: Point, from: Point, to: Point): number {
  const ux = to[0] - from[0];
  const uy = to[1] - from[1];
  const uz = to[2] - from[2];
  const lengthSq = ux * ux + uy * uy + uz * uz;
  const offsetX = point[0] - from[0];
  const offsetY = point[1] - from[1];
  const offsetZ = point[2] - from[2];
  const t =
    lengthSq > 1e-12
      ? Math.min(
          1,
          Math.max(
            0,
            (offsetX * ux + offsetY * uy + offsetZ * uz) / lengthSq,
          ),
        )
      : 0;

  return Math.hypot(
    offsetX - ux * t,
    offsetY - uy * t,
    offsetZ - uz * t,
  );
}

/** Точка внутри трубы переменного радиуса вдоль ломаной, с запасом `margin`. */
function insideTube(
  point: Point,
  centers: readonly Point[],
  radii: readonly number[],
  margin: number,
): boolean {
  if (centers.length === 1) {
    return (
      Math.hypot(
        point[0] - centers[0][0],
        point[1] - centers[0][1],
        point[2] - centers[0][2],
      ) <=
      radii[0] - margin
    );
  }

  for (let index = 0; index < centers.length - 1; index += 1) {
    const distance = distanceToSegment(
      point,
      centers[index],
      centers[index + 1],
    );
    const radius = Math.max(radii[index], radii[index + 1]);

    if (distance <= radius - margin) {
      return true;
    }
  }

  return false;
}

/**
 * Треугольники оленя, которые действительно висят в воздухе.
 *
 * Правило то же, что у лотка: нормаль смотрит вниз круче 45° к вертикали —
 * поддержка нужна. Отличие одно: база, бюст и восемь труб построены отдельными
 * замкнутыми телами и пересекаются, поэтому торцы корней и низ бюста лежат
 * внутри соседних тел. Такие треугольники пропускаются: слайсер их сольёт.
 */
function deerOverhangTriangles(mesh: Mesh, plan: JewelryDeerPlan): number {
  const axis: Point[] = plan.stations.map((station) => [
    0,
    station.yMm,
    station.zMm,
  ]);
  const radii = plan.stations.map((station) =>
    Math.min(station.rxMm, station.ryMm),
  );
  let count = 0;

  for (const [a, b, c] of mesh.triangles) {
    const pa = mesh.vertices[a];
    const pb = mesh.vertices[b];
    const pc = mesh.vertices[c];
    const centerX = (pa[0] + pb[0] + pc[0]) / 3;
    const centerY = (pa[1] + pb[1] + pc[1]) / 3;
    const centerZ = (pa[2] + pb[2] + pc[2]) / 3;

    if (centerZ <= 0.01) {
      continue;
    }

    const ux = pb[0] - pa[0];
    const uy = pb[1] - pa[1];
    const uz = pb[2] - pa[2];
    const vx = pc[0] - pa[0];
    const vy = pc[1] - pa[1];
    const vz = pc[2] - pa[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);

    if (length <= 0 || nz / length >= -Math.SQRT1_2) {
      continue;
    }

    const center: Point = [centerX, centerY, centerZ];

    if (insideTube(center, axis, radii, 0.35)) {
      continue;
    }

    const buried = plan.antlers.some((path) =>
      insideTube(
        center,
        path.points.map((point) => [point.xMm, point.yMm, point.zMm] as Point),
        path.points.map((point) => point.radiusMm),
        0.35,
      ),
    );

    if (buried) {
      continue;
    }

    count += 1;
  }

  return count;
}

console.log("\nБюст «Лесной олень»: план");

/** Базовая конфигурация бюста: крайние значения проверяются отдельно. */
const deerCase = {
  jewelryPreset: "deer_bust" as const,
  deerAntlerSpread: 110,
  deerBaseLength: 150,
  deerBaseWidth: 100,
};

const deerPlan = jewelryDeerPlan(deerCase);
const deerHeight = jewelryDeerHeightMm(deerCase);

near("олень: длина базы", deerPlan.baseLengthMm, 150);
near("олень: ширина базы", deerPlan.baseWidthMm, 100);
near("олень: высота базы", deerPlan.baseHeightMm, JEWELRY_DEER_BASE_HEIGHT_MM);
near(
  "олень: дно и глубина полости дают высоту базы",
  deerPlan.pocketFloorMm + deerPlan.pocketDepthMm,
  JEWELRY_DEER_BASE_HEIGHT_MM,
);
near(
  "олень: радиус полости",
  deerPlan.pocketRadiusMm,
  JEWELRY_DEER_WEIGHT_DIAMETER_MM / 2,
);
check(
  "олень: полость под головой",
  deerPlan.pocketCenterMm[0] === 0 &&
    deerPlan.pocketCenterMm[1] === -JEWELRY_DEER_WEIGHT_OFFSET_MM,
  true,
);
check("олень: восемь труб рога", deerPlan.antlers.length, 8);
check(
  "олень: на сторону ствол и три отростка",
  deerPlan.antlers.filter((path) => path.kind === "beam").length === 2 &&
    deerPlan.antlers.filter((path) => path.kind === "tine").length === 6,
  true,
);
expectNear(
  "олень: размах рогов как у ползунка",
  deerPlan.antlerOuterXMm * 2,
  110,
  0.01,
);

/** Ось бюста и его узкие полуоси: по ним проверяется, что корни рогов утоплены. */
const bustAxis: Point[] = deerPlan.stations.map((station) => [
  0,
  station.yMm,
  station.zMm,
]);
const bustRadii = deerPlan.stations.map((station) =>
  Math.min(station.rxMm, station.ryMm),
);

check(
  "олень: корни ствола утоплены в голову",
  deerPlan.antlers
    .filter((path) => path.kind === "beam")
    .every((path) => {
      const root = path.points[0];

      return insideTube(
        [root.xMm, root.yMm, root.zMm],
        bustAxis,
        bustRadii,
        0,
      );
    }),
  true,
);

// Подъём рогов: каждый участок трубы обязан быть круче 45° к столу. Считается по
// оси, а не по нормали меша: внутренние торцы корней — не поверхность детали.
let flattestDeg = 180;
let flattestId = "—";
let budSurfaceDeg = 180;

for (const path of deerPlan.antlers) {
  for (let index = 0; index < path.points.length - 1; index += 1) {
    const from = path.points[index];
    const to = path.points[index + 1];
    const run = Math.hypot(to.xMm - from.xMm, to.yMm - from.yMm);
    const rise = to.zMm - from.zMm;
    const elevation = (Math.atan2(rise, run) * 180) / Math.PI;
    const travelled = Math.hypot(run, rise);
    const growth = Math.max(0, (to.radiusMm - from.radiusMm) / travelled);
    // Низ бутона поднимается медленнее оси: рост радиуса «съедает» подъём.
    const surface = elevation - (Math.atan(growth) * 180) / Math.PI;

    if (elevation < flattestDeg) {
      flattestDeg = elevation;
      flattestId = path.id;
    }

    budSurfaceDeg = Math.min(budSurfaceDeg, surface);
  }
}

check("олень: трубы подняты не ниже 45°", flattestDeg >= 45, true);
check("олень: низ бутона не положе 45°", budSurfaceDeg >= 45, true);
check(
  "олень: бутон толще конца ствола",
  JEWELRY_DEER_ANTLER_BUD_RADIUS_MM > JEWELRY_DEER_ANTLER_TIP_RADIUS_MM,
  true,
);
console.log(
  `  · самый пологий участок ${flattestId}: ${flattestDeg.toFixed(1)}°, ` +
    `низ бутона ${budSurfaceDeg.toFixed(1)}°`,
);

console.log("\nБюст «Лесной олень»: тело детали");

const deerGeometry = createJewelryStandGeometry(deerCase);
const deerMesh = weld(deerGeometry);
const deerVolume = volumeMm3(deerMesh) / 1000;
const [deerMinX, deerMaxX] = range(deerMesh.vertices, 0);
const [deerMinY, deerMaxY] = range(deerMesh.vertices, 1);
const [deerMinZ, deerMaxZ] = range(deerMesh.vertices, 2);

check("олень: открытых рёбер", openEdges(deerMesh), 0);
check("олень: вырожденных треугольников", degenerateTriangles(deerMesh), 0);
check("олень: NaN вершин", nanVertices(deerGeometry), 0);
check("олень: объём положительный", deerVolume > 0, true);
expectNear("олень: низ на столе", deerMinZ, 0, 1e-4);
expectNear("олень: длина базы по X", deerMaxX - deerMinX, 150, 0.02);
expectNear("олень: ширина базы по Y", deerMaxY - deerMinY, 100, 0.02);
expectNear("олень: высота вместе с рогами", deerMaxZ - deerMinZ, deerHeight, 0.2);
check(
  "олень: нет нависаний круче 45°",
  deerOverhangTriangles(deerMesh, deerPlan),
  0,
);
console.log(`  · объём ${deerVolume.toFixed(1)} см³, высота ${deerHeight} мм`);

console.log("\nБюст «Лесной олень»: рога шире базы");

// Витринная пара: размах больше овала, значит габарит по X задают рога, а не база.
const wideDeer = {
  ...deerCase,
  deerAntlerSpread: 150,
  deerBaseLength: 120,
  deerBaseWidth: 90,
};
const wideGeometry = createJewelryStandGeometry(wideDeer);
const wideMesh = weld(wideGeometry);
const [wideMinX, wideMaxX] = range(wideMesh.vertices, 0);
const wideMetrics = jewelryStandMetrics(wideDeer);

check("олень: рога шире базы — рёбра", openEdges(wideMesh), 0);
check("олень: рога шире базы — NaN", nanVertices(wideGeometry), 0);
// Бутон скруглён полусферой, а её кольца набраны 12 гранями: крайняя точка
// попадает между вершинами, поэтому размах чуть меньше расчётного.
expectNear("олень: габарит по X задают рога", wideMaxX - wideMinX, 150, 0.15);
near("олень: метрика ширины", wideMetrics.widthMm, 150);
near("олень: метрика глубины", wideMetrics.depthMm, 90);
near(
  "олень: метрика высоты",
  wideMetrics.heightMm,
  jewelryDeerHeightMm(wideDeer),
);

console.log("\nБюст «Лесной олень»: имя файла и границы ползунков");

const deerFileName = jewelryStandStlFileName(normalizeJewelryStandParams(deerCase));

check(
  "олень: имя файла",
  deerFileName,
  "tridi-podstavka-ukrasheniy-deer-bust-l150-w100-a110.stl",
);
check(
  "олень: имя файла только ASCII",
  /^[\x20-\x7E]+$/.test(deerFileName),
  true,
);

const clampedDeer = normalizeJewelryStandParams({
  jewelryPreset: "deer_bust",
  deerAntlerSpread: 500,
  deerBaseLength: 5,
  deerBaseWidth: 500,
});

check("олень: размах ужат", clampedDeer.deerAntlerSpread, 150);
check("олень: длина базы поднята", clampedDeer.deerBaseLength, 120);
check("олень: ширина базы ужата", clampedDeer.deerBaseWidth, 120);

console.log("\nБюст «Лесной олень»: минимальный размер");

const smallestDeer = jewelryDeerPlan({
  deerAntlerSpread: 80,
  deerBaseLength: 120,
  deerBaseWidth: 80,
});
const smallestMesh = weld(
  createJewelryStandGeometry({
    jewelryPreset: "deer_bust",
    deerAntlerSpread: 80,
    deerBaseLength: 120,
    deerBaseWidth: 80,
  }),
);

check("олень: минимум — открытых рёбер", openEdges(smallestMesh), 0);
check(
  "олень: полость вписана в овал",
  smallestDeer.pocketRadiusMm + Math.abs(smallestDeer.pocketCenterMm[1]) <
    smallestDeer.baseWidthMm / 2,
  true,
);
check(
  "олень: полость целиком под плитой",
  smallestDeer.pocketFloorMm > 0 &&
    smallestDeer.pocketDepthMm + smallestDeer.pocketFloorMm <=
      smallestDeer.baseHeightMm + 1e-9,
  true,
);
check(
  "олень: минимум ниже максимума",
  smallestDeer.heightMm < deerPlan.heightMm,
  true,
);

if (failures.length > 0) {
  console.error(`\nРасхождения (${failures.length}):`);

  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log("\nВсе проверки прошли.");
}

