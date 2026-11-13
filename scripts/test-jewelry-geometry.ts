/**
 * Тест геометрии подставки для украшений.
 *
 * Три пресета коллекции: лоток-лист, бюст оленя и плетёное древо. Проверяется
 * то, что обещает панель: габарит по Z совпадает с высотой из ползунка, деталь
 * стоит на столе, сетка замкнута и в ней нет нависаний круче 45° — печать без
 * поддержек. Сетка неиндексированная, поэтому вершины свариваются по
 * координатам: без этого у каждого треугольника были бы свои вершины и проверка
 * рёбер не нашла бы ни одной пары.
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
  JEWELRY_STABILITY_BASE_RATIO,
  createJewelryStandGeometry,
  jewelryBaseIsNarrow,
  jewelryStandMetrics,
  jewelryStableBaseMm,
} from "../lib/constructor/jewelry-stand-geometry";
import {
  JEWELRY_TREE_BASE_HEIGHT_MM,
  JEWELRY_TREE_HOLE_RADIUS_MM,
  JEWELRY_TREE_STRAND_ELEVATION_DEG,
  jewelryTreeHeightMm,
  jewelryTreePlan,
  type JewelryTreePlan,
  type JewelryTreePoint,
} from "../lib/constructor/jewelry-tree-geometry";
import {
  JEWELRY_LEAF_TYPES,
  jewelryStandStlFileName,
  normalizeJewelryStandParams,
} from "../lib/constructor/params";

type Point = readonly [number, number, number];

interface Mesh {
  readonly vertices: Point[];
  readonly triangles: readonly (readonly [number, number, number])[];
}

/** Допуск по высоте, мм: столько ТЗ отводит на скос торца и крышку. */
const HEIGHT_TOLERANCE_MM = 0.1;

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

/**
 * Самый пологий участок оси пряди по хордам, градусы.
 *
 * Считается по тем же точкам, которые уходят в сетку: слайсер видит хорды, а не
 * гладкую кривую, поэтому проверять надо их.
 */
function strandElevationDeg(points: readonly JewelryTreePoint[]): number {
  let worst = 180;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const run = Math.hypot(to.xMm - from.xMm, to.yMm - from.yMm);
    const rise = to.zMm - from.zMm;

    worst = Math.min(worst, (Math.atan2(rise, run) * 180) / Math.PI);
  }

  return worst;
}

/**
 * Насколько прядь закручивается вокруг ствола, градусы.
 *
 * Азимут считается по тем же точкам, что уходят в сетку: сумма поворотов от
 * корня к верхушке. При нулевом плетении она равна нулю, при максимальном —
 * растёт вместе с витками.
 */
function strandAzimuthSpreadDeg(points: readonly JewelryTreePoint[]): number {
  let spread = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = Math.atan2(points[index].yMm, points[index].xMm);
    const to = Math.atan2(points[index + 1].yMm, points[index + 1].xMm);
    let delta = to - from;

    if (delta > Math.PI) {
      delta -= Math.PI * 2;
    }

    if (delta < -Math.PI) {
      delta += Math.PI * 2;
    }

    spread += Math.abs(delta);
  }

  return (spread * 180) / Math.PI;
}

/**
 * Треугольники древа, которые действительно висят в воздухе.
 *
 * Правило прежнее: нормаль смотрит вниз круче 45° к вертикали — поддержка нужна.
 * Плита, юбка, коса и ветви — отдельные замкнутые тела, и они пересекаются,
 * поэтому низ корневой юбки и торцы труб лежат внутри соседних тел: такие
 * треугольники пропускаются, слайсер их сольёт. Всё, что выше плиты и вне труб,
 * обязано быть пустым.
 */
function treeOverhangTriangles(mesh: Mesh, plan: JewelryTreePlan): number {
  const tubes = [plan.core, ...plan.strands, ...plan.branches].map((tube) => ({
    centers: tube.points.map(
      (point): Point => [point.xMm, point.yMm, point.zMm],
    ),
    radii: tube.points.map((point) => point.radiusMm),
  }));
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

    // Плита с сеткой отверстий и корневая юбка: низ юбки утоплен в плиту.
    if (
      centerZ <= plan.baseHeightMm &&
      Math.hypot(centerX, centerY) <= plan.baseRadiusMm
    ) {
      continue;
    }

    const center: Point = [centerX, centerY, centerZ];

    if (
      tubes.some((tube) => insideTube(center, tube.centers, tube.radii, 0.35))
    ) {
      continue;
    }

    count += 1;
  }

  return count;
}

console.log("\nДрево «Плетёное древо»: план");

const treeCase = {
  jewelryPreset: "braided_tree" as const,
  treeHeight: 180,
  treeBaseDiameter: 120,
  treeBranchCount: 4,
  treeTwist: 0.6,
};

const treePlan = jewelryTreePlan(treeCase);

near("древо: радиус базы", treePlan.baseRadiusMm, 60);
check("древо: высота ползунка — габарит", jewelryTreeHeightMm(treeCase), 180);
near("древо: плита", treePlan.baseHeightMm, JEWELRY_TREE_BASE_HEIGHT_MM);
check("древо: четыре пряди", treePlan.strands.length, 4);
check("древо: сердечник один", treePlan.core.points.length > 0, true);
near(
  "древо: пряди касаются друг друга",
  treePlan.strandOffsetMm + treePlan.strandRadiusMm,
  treePlan.trunkRadiusMm,
);
check("древо: все пряди одной толщины", 
  treePlan.strands.every(
    (strand) => strand.points[0].radiusMm === treePlan.strandRadiusMm,
  ),
  true,
);

const treeStrandFloor = Math.min(
  ...treePlan.strands.map((strand) => strandElevationDeg(strand.points)),
);

check(
  "древо: прядь поднимается не положе 48°",
  treeStrandFloor >= JEWELRY_TREE_STRAND_ELEVATION_DEG - 1e-6,
  true,
);
check(
  "древо: ветви и коса не положе 45°",
  treePlan.flattestSurfaceDeg >= 45,
  true,
);
check("древо: ветвей по ползунку", treePlan.branches.length, 4);
check(
  "древо: крючки и штыри делят ветви",
  treePlan.hookCount + treePlan.postCount,
  treePlan.branches.length,
);
check(
  "древо: крючки выше штырей",
  Math.min(
    ...treePlan.branches
      .filter((branch) => branch.kind === "hook")
      .map((branch) => branch.points[0].zMm),
  ) >
    Math.max(
      ...treePlan.branches
        .filter((branch) => branch.kind === "post")
        .map((branch) => branch.points[0].zMm),
    ),
  true,
);
check(
  "древо: ветви не выше верхушки",
  treePlan.branches.every((branch) => {
    const last = branch.points[branch.points.length - 1];

    return last.zMm + last.radiusMm <= treePlan.crownZMm;
  }),
  true,
);
check(
  "древо: ветви растут из ствола",
  treePlan.branches.every((branch) => branch.points[0].zMm > treePlan.trunkRootZMm),
  true,
);

const looseTree = jewelryTreePlan({ ...treeCase, treeTwist: 0 });
const tightTree = jewelryTreePlan({ ...treeCase, treeTwist: 1 });

check("древо: без плетения витков нет", looseTree.twistTurns, 0);
check(
  "древо: плетение усиливает виток",
  tightTree.twistTurns > treePlan.twistTurns && treePlan.twistTurns > 0,
  true,
);
check(
  "древо: предел плетения держит 48°",
  Math.min(
    ...tightTree.strands.map((strand) => strandElevationDeg(strand.points)),
  ) >= JEWELRY_TREE_STRAND_ELEVATION_DEG - 1e-6,
  true,
);
check(
  "древо: без плетения прядь не закручивается",
  Math.max(
    ...looseTree.strands.map((strand) => strandAzimuthSpreadDeg(strand.points)),
  ) <= 1e-6,
  true,
);
check(
  "древо: с плетением прядь обходит ствол",
  Math.min(
    ...tightTree.strands.map((strand) => strandAzimuthSpreadDeg(strand.points)),
  ) > 30,
  true,
);

const treeHoles = treePlan.holes;
let treeHoleGap = Infinity;

for (let index = 0; index < treeHoles.length; index += 1) {
  for (let other = index + 1; other < treeHoles.length; other += 1) {
    treeHoleGap = Math.min(
      treeHoleGap,
      Math.hypot(
        treeHoles[other].xMm - treeHoles[index].xMm,
        treeHoles[other].yMm - treeHoles[index].yMm,
      ),
    );
  }
}

check("древо: отверстия есть", treeHoles.length >= 40, true);
check(
  "древо: между отверстиями не меньше 2 мм",
  treeHoleGap - JEWELRY_TREE_HOLE_RADIUS_MM * 2 >= 2,
  true,
);
check(
  "древо: отверстия внутри базы",
  treeHoles.every(
    (hole) =>
      Math.hypot(hole.xMm, hole.yMm) + hole.radiusMm <= treePlan.baseRadiusMm,
  ),
  true,
);
check(
  "древо: юбка не выходит за базу",
  treePlan.skirt.outerRadiusMm < treePlan.baseRadiusMm,
  true,
);
check(
  "древо: фаска юбки — 45°",
  treePlan.skirt.bevelMm <=
    (treePlan.skirt.topMm - treePlan.skirt.bottomMm) / 2 + 1e-9,
  true,
);
check(
  "древо: юбка утоплена в плиту",
  treePlan.skirt.bottomMm < treePlan.baseHeightMm,
  true,
);

const treeGeometry = createJewelryStandGeometry(treeCase);
const treeMesh = weld(treeGeometry);
const treeVolume = volumeMm3(treeMesh) / 1000;
const [treeMinX, treeMaxX] = range(treeMesh.vertices, 0);
const [treeMinY, treeMaxY] = range(treeMesh.vertices, 1);
const [treeMinZ, treeMaxZ] = range(treeMesh.vertices, 2);
const treePlanWidth = Math.max(treeMaxX - treeMinX, treeMaxY - treeMinY);

check("древо: открытых рёбер", openEdges(treeMesh), 0);
check("древо: вырожденных треугольников", degenerateTriangles(treeMesh), 0);
check("древо: NaN вершин", nanVertices(treeGeometry), 0);
check("древо: объём положительный", treeVolume > 0, true);
check("древо: низ на столе", Math.abs(treeMinZ) <= 1e-6, true);
check(
  "древо: высота совпадает с ползунком",
  Math.abs(treeMaxZ - treePlan.heightMm) <= HEIGHT_TOLERANCE_MM,
  true,
);
check(
  "древо: план не шире выноса",
  treePlanWidth <= treePlan.reachMm * 2 + 1e-6,
  true,
);
check(
  "древо: план равен базе",
  Math.abs(treePlanWidth - treeCase.treeBaseDiameter) <= 1e-6,
  true,
);
check(
  "древо: ветви не выходят за базу",
  treePlan.branches.every((branch) => {
    const last = branch.points[branch.points.length - 1];

    return (
      Math.hypot(last.xMm, last.yMm) + last.radiusMm <=
      treePlan.baseRadiusMm + 1e-9
    );
  }),
  true,
);
check(
  "древо: нависаний над плитой",
  treeOverhangTriangles(treeMesh, treePlan),
  0,
);

const treeTriangles = treeGeometry.getAttribute("position").count / 3;

check(
  "древо: сетка в бюджете 40 000 треугольников",
  treeTriangles <= 40000,
  true,
);
console.log(`  · ${treeTriangles} треугольников, ${treeVolume.toFixed(1)} см³`);

console.log("\nДрево «Плетёное древо»: крайние значения ползунков");

/** Углы сетки ползунков: высота, база, ветви и плетение по концам диапазона. */
const treeCorners: {
  readonly height: number;
  readonly base: number;
  readonly branches: number;
  readonly twist: number;
}[] = [];

for (const height of [100, 220]) {
  for (const base of [80, 140]) {
    for (const branches of [3, 6]) {
      for (const twist of [0, 1]) {
        treeCorners.push({ height, base, branches, twist });
      }
    }
  }
}

for (const corner of treeCorners) {
  const name = `H${corner.height}/D${corner.base}/B${corner.branches}/T${corner.twist}`;
  const cornerCase = {
    jewelryPreset: "braided_tree" as const,
    treeHeight: corner.height,
    treeBaseDiameter: corner.base,
    treeBranchCount: corner.branches,
    treeTwist: corner.twist,
  };
  const plan = jewelryTreePlan(cornerCase);
  const expected = normalizeJewelryStandParams(cornerCase);
  const geometry = createJewelryStandGeometry(cornerCase);
  const mesh = weld(geometry);
  const volume = volumeMm3(mesh) / 1000;
  const [minX, maxX] = range(mesh.vertices, 0);
  const [minY, maxY] = range(mesh.vertices, 1);
  const [minZ, maxZ] = range(mesh.vertices, 2);
  const footprint = Math.max(maxX - minX, maxY - minY);
  const before = failures.length;

  expect(
    `${name}: высота по ползунку`,
    Math.abs(maxZ - plan.heightMm) <= HEIGHT_TOLERANCE_MM,
    `верх ${maxZ.toFixed(3)} мм при ${plan.heightMm} мм`,
  );
  expect(
    `${name}: ничего не выше габарита`,
    maxZ <= plan.heightMm + 1e-3,
    `верх ${maxZ.toFixed(3)} мм`,
  );
  expect(`${name}: низ на столе`, Math.abs(minZ) <= 1e-6, `низ ${minZ.toFixed(4)}`);
  expect(
    `${name}: план по базе`,
    Math.abs(footprint - expected.treeBaseDiameter) <= 1e-4,
    `план ${footprint.toFixed(3)} мм при базе ${expected.treeBaseDiameter} мм`,
  );
  expect(`${name}: объём`, volume > 0, "пустая сетка");
  expect(
    `${name}: ветвей по ползунку`,
    plan.branches.length === expected.treeBranchCount,
    `${plan.branches.length} вместо ${expected.treeBranchCount}`,
  );
  expect(
    `${name}: сетка серёг`,
    plan.holes.length >= 24,
    `${plan.holes.length} отверстий`,
  );
  expect(
    `${name}: отверстия в плите`,
    plan.holes.every(
      (hole) => Math.hypot(hole.xMm, hole.yMm) + hole.radiusMm <= plan.baseRadiusMm,
    ),
    "отверстие вышло за базу",
  );
  expect(
    `${name}: нависаний нет`,
    treeOverhangTriangles(mesh, plan) === 0,
    "есть треугольники круче 45°",
  );

  console.log(
    `  ${failures.length === before ? "✓" : "✗"} ${name}: ${maxZ.toFixed(2)} мм, ` +
      `${plan.holes.length} отверстий, ${volume.toFixed(1)} см³`,
  );
}

console.log("\nДрево «Плетёное древо»: минимальный размер");

const smallestTree = {
  jewelryPreset: "braided_tree" as const,
  treeHeight: 100,
  treeBaseDiameter: 80,
  treeBranchCount: 3,
  treeTwist: 1,
};
const smallestTreePlan = jewelryTreePlan(smallestTree);
const smallestTreeGeometry = createJewelryStandGeometry(smallestTree);
const smallestTreeMesh = weld(smallestTreeGeometry);
const [smallestTreeMinZ, smallestTreeMaxZ] = range(
  smallestTreeMesh.vertices,
  2,
);

check("древо: минимум — открытых рёбер", openEdges(smallestTreeMesh), 0);
check("древо: минимум — NaN", nanVertices(smallestTreeGeometry), 0);
check(
  "древо: минимум — высота из ползунка",
  Math.abs(smallestTreeMaxZ - smallestTreePlan.heightMm) <=
    HEIGHT_TOLERANCE_MM,
  true,
);
check("древо: минимум — низ на столе", Math.abs(smallestTreeMinZ) <= 1e-6, true);
check(
  "древо: минимум — нависаний нет",
  treeOverhangTriangles(smallestTreeMesh, smallestTreePlan),
  0,
);
check(
  "древо: минимум — три ветви",
  smallestTreePlan.branches.length,
  3,
);
check(
  "древо: минимум — сетка серёг не режется",
  smallestTreePlan.holes.length >= 24,
  true,
);

const clampedTree = normalizeJewelryStandParams({
  jewelryPreset: "braided_tree",
  treeHeight: 500,
  treeBaseDiameter: 5,
  treeBranchCount: 9,
  treeTwist: 2,
});

check("древо: высота ужата", clampedTree.treeHeight, 220);
check("древо: база поднята", clampedTree.treeBaseDiameter, 80);
check("древо: число ветвей ужато", clampedTree.treeBranchCount, 6);
check("древо: плетение ужато", clampedTree.treeTwist, 1);

const treeFileName = jewelryStandStlFileName(
  normalizeJewelryStandParams(treeCase),
);

check(
  "древо: имя файла",
  treeFileName,
  "tridi-podstavka-ukrasheniy-braided-tree-h180-d120-b4-t60.stl",
);
check("древо: имя файла только ASCII", /^[\x20-\x7E]+$/.test(treeFileName), true);

if (failures.length > 0) {
  console.error(`\nРасхождения (${failures.length}):`);

  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log("\nВсе проверки прошли.");
}

