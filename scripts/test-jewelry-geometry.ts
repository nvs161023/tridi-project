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
  JEWELRY_DEER_ANTLER_ROOT_MM,
  JEWELRY_DEER_ANTLER_TIP_RADIUS_MM,
  JEWELRY_DEER_BASE_HEIGHT_MM,
  JEWELRY_DEER_EAR_ROOT_MM,
  JEWELRY_DEER_EAR_TIP_MM,
  JEWELRY_DEER_KEEL_RATIO,
  JEWELRY_DEER_SECTION_POWER,
  JEWELRY_DEER_SOLE_DROP_MM,
  JEWELRY_DEER_SOLE_HALF_MM,
  JEWELRY_DEER_WEIGHT_DIAMETER_MM,
  JEWELRY_DEER_WEIGHT_OFFSET_MM,
  createJewelryDeerGeometry,
  deerSectionAreaMm2,
  deerSectionOutline,
  deerSliceSideMm,
  jewelryDeerHeightMm,
  jewelryDeerPlan,
  type JewelryDeerPlan,
  type JewelryDeerSlice,
} from "../lib/constructor/jewelry-deer-geometry";
import {
  JEWELRY_LEAF_BOWL_DEPTH_MM,
  JEWELRY_LEAF_MIN_THICKNESS_MM,
  jewelryLeafFaceMm,
  jewelryLeafHalfWidthAt,
  jewelryLeafHeightMm,
  jewelryLeafPlateThicknessMm,
  jewelryLeafReliefMm,
} from "../lib/constructor/jewelry-leaf-geometry";
import {
  createJewelryStandGeometry,
  jewelryStandMetrics,
} from "../lib/constructor/jewelry-stand-geometry";
import {
  JEWELRY_TREE_MIN_ELEVATION_DEG,
  jewelryTreeHeightMm,
  jewelryTreePlan,
  type JewelryTreePlan,
  type JewelryTreePoint,
} from "../lib/constructor/jewelry-tree-geometry";
import {
  CONSTRUCTOR_LIMITS,
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


console.log("\nНабор параметров");

const standKeys = normalizeJewelryStandParams({});

check("старой высоты стойки нет", "jewelryHeight" in standKeys, false);
check("старого основания нет", "jewelryBase" in standKeys, false);
check("старого набора держателей нет", "jewelryConfig" in standKeys, false);


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
near(
  "лист: плита над ложем",
  jewelryLeafPlateThicknessMm(),
  JEWELRY_LEAF_BOWL_DEPTH_MM + JEWELRY_LEAF_MIN_THICKNESS_MM,
);
near("лист: плита 3 мм из ТЗ", jewelryLeafPlateThicknessMm(), 3);
near("лист: минимальная толщина", JEWELRY_LEAF_MIN_THICKNESS_MM, 1.2);

/** Самое широкое место и точка на середине половины: там дно ложа. */
const widestHalfOnAxisMm = jewelryLeafHalfWidthAt(leafCase, widestT);
const dishPointY = widestHalfOnAxisMm / 2;
const dishPointX =
  -leafCase.jewelryLeafLength / 2 + widestT * leafCase.jewelryLeafLength;

near(
  "лист: глубина ложа",
  jewelryLeafReliefMm(leafCase, dishPointX, dishPointY),
  JEWELRY_LEAF_BOWL_DEPTH_MM,
);
near(
  "лист: у края рельеф затухает",
  jewelryLeafReliefMm(leafCase, 0, widestHalfMm - 0.1),
  0,
);
check(
  "лист: ложе не глубже плиты минус минимум",
  jewelryLeafReliefMm(leafCase, dishPointX, dishPointY) <=
    JEWELRY_LEAF_BOWL_DEPTH_MM + 1e-9,
  true,
);
check(
  "лист: центральная жилка выше ложа",
  jewelryLeafFaceMm(leafCase, dishPointX, 0) >
    jewelryLeafFaceMm(leafCase, dishPointX, dishPointY) + 0.5,
  true,
);
check(
  "лист: бортик выше центральной жилки",
  jewelryLeafFaceMm(leafCase, dishPointX, widestHalfOnAxisMm - 0.2) >
    jewelryLeafFaceMm(leafCase, dishPointX, 0),
  true,
);
check(
  "лист: лицо нигде не ниже минимальной толщины",
  jewelryLeafFaceMm(leafCase, dishPointX, dishPointY) >=
    JEWELRY_LEAF_MIN_THICKNESS_MM - 1e-9,
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
const leafPlate = jewelryLeafPlateThicknessMm();

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

console.log("\nЛоток-лист: границы ползунков");

for (const jewelryLeafWidth of [
  CONSTRUCTOR_LIMITS.jewelryLeafWidth.min,
  CONSTRUCTOR_LIMITS.jewelryLeafWidth.max,
]) {
  for (const jewelryLeafVeinDepth of [
    CONSTRUCTOR_LIMITS.jewelryLeafVeinDepth.min,
    CONSTRUCTOR_LIMITS.jewelryLeafVeinDepth.max,
  ]) {
    const extreme = {
      ...leafCase,
      jewelryLeafWidth,
      jewelryLeafVeinDepth,
    };
    const geometry = createJewelryStandGeometry(extreme);
    const mesh = weld(geometry);
    const [minZ, maxZ] = range(mesh.vertices, 2);
    const label = `лист W${jewelryLeafWidth}/V${jewelryLeafVeinDepth}`;

    check(`${label}: открытых рёбер`, openEdges(mesh), 0);
    check(`${label}: NaN вершин`, nanVertices(geometry), 0);
    expectNear(
      `${label}: высота`,
      maxZ - minZ,
      jewelryLeafHeightMm(extreme),
      0.05,
    );
    check(
      `${label}: нет нависаний круче 45°`,
      overhangTriangles(mesh, jewelryLeafPlateThicknessMm(), extreme),
      0,
    );
  }
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
 * Внутри ли точка среза бюста — с запасом `marginMm`.
 *
 * Та же формула, что у генератора: суперэллипс сверху, грань киля снизу и клин до
 * гребня. Запас нужен, чтобы треугольник, лежащий **на** поверхности, не сошёл за
 * спрятанный: у него центр ровно на границе, и без запаса проверка объявила бы
 * утопленным сам низ головы.
 */
function insideBust(
  plan: JewelryDeerPlan,
  x: number,
  y: number,
  z: number,
  marginMm = 0.15,
): boolean {
  const slices = plan.slices;

  if (y > slices[0].yMm + 1e-9 || y < slices[slices.length - 1].yMm - 1e-9) {
    return false;
  }

  let index = 0;

  while (index < slices.length - 2 && slices[index + 1].yMm > y) {
    index += 1;
  }

  const from = slices[index];
  const to = slices[Math.min(index + 1, slices.length - 1)];
  const span = from.yMm - to.yMm;
  const share = span > 1e-9 ? (from.yMm - y) / span : 0;
  const mix = (start: number, end: number) => start + (end - start) * share;
  const wMm = mix(from.wMm, to.wMm);
  const soleMm = mix(from.wSoleMm, to.wSoleMm);
  const bottomMm = mix(from.zBottomMm, to.zBottomMm);
  const topMm = mix(from.zTopMm, to.zTopMm);
  const sideMm = bottomMm + JEWELRY_DEER_KEEL_RATIO * (wMm - soleMm);
  const dropMm = Math.min(JEWELRY_DEER_KEEL_RATIO * soleMm, JEWELRY_DEER_SOLE_DROP_MM);

  if (z < bottomMm - dropMm + marginMm || z > topMm - marginMm) {
    return false;
  }

  if (z > sideMm) {
    const across = Math.abs(x) / Math.max(wMm - marginMm, 1e-9);
    const up = (z - sideMm) / Math.max(topMm - sideMm - marginMm, 1e-9);

    return across ** JEWELRY_DEER_SECTION_POWER + up ** JEWELRY_DEER_SECTION_POWER <= 1;
  }

  const along = (z - bottomMm) / Math.max(sideMm - bottomMm, 1e-9);

  return Math.abs(x) <= soleMm + (wMm - soleMm) * along - marginMm;
}

/**
 * Треугольники оленя, которые действительно висят в воздухе.
 *
 * Правило то же, что у лотка: нормаль смотрит вниз круче 45° к вертикали —
 * поддержка нужна. Не в счёт только спрятанное внутри других тел: низ груди
 * утоплен в плиту, торцы корней рогов — в голову, торцы отростков — в ствол.
 * Каждое исключение проверяется по геометрии, а не по имени функции: точка
 * обязана лежать внутри тела с запасом 0.15 мм. Иначе «утопленным» можно
 * объявить что угодно, и тест перестанет ловить нависания.
 *
 * Возвращаются площадь и самый крутой угол: по углу сразу видно, вернулась ли
 * проблема прежнего лофта, где низ колец нависал под 66°.
 */
function deerOverhangs(
  mesh: Mesh,
  plan: JewelryDeerPlan,
): { areaMm2: number; worstDeg: number } {
  const position = mesh.vertices;
  let areaMm2 = 0;
  let worstDeg = 0;

  for (const [a, b, c] of mesh.triangles) {
    const pa = position[a];
    const pb = position[b];
    const pc = position[c];
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
    const insidePlate =
      centerZ <= plan.baseHeightMm &&
      (centerX * centerX) / (plan.baseLengthMm * plan.baseLengthMm * 0.25) +
        (centerY * centerY) / (plan.baseWidthMm * plan.baseWidthMm * 0.25) <=
        1 &&
      Math.hypot(
        centerX - plan.pocketCenterMm[0],
        centerY - plan.pocketCenterMm[1],
      ) > plan.pocketRadiusMm;
    const buriedInAntler = plan.antlers.some((path) =>
      insideTube(
        center,
        path.points.map((point) => [point.xMm, point.yMm, point.zMm] as Point),
        path.points.map((point) => point.radiusMm),
        0.35,
      ),
    );

    if (insidePlate || buriedInAntler || insideBust(plan, centerX, centerY, centerZ)) {
      continue;
    }

    areaMm2 += length / 2;
    worstDeg = Math.max(worstDeg, (Math.asin(-nz / length) * 180) / Math.PI);
  }

  return { areaMm2, worstDeg };
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
  "олень: полость перед бюстом",
  deerPlan.pocketCenterMm[0] === 0 &&
    deerPlan.pocketCenterMm[1] === -JEWELRY_DEER_WEIGHT_OFFSET_MM,
  true,
);
check("олень: десять труб рога", deerPlan.antlers.length, 10);
check(
  "олень: на сторону ствол и четыре отростка",
  deerPlan.antlers.filter((path) => path.kind === "beam").length === 2 &&
    deerPlan.antlers.filter((path) => path.kind === "tine").length === 8,
  true,
);
expectNear(
  "олень: размах рогов как у ползунка",
  deerPlan.antlerOuterXMm * 2,
  110,
  0.01,
);

console.log("\nБюст «Лесной олень»: силуэт задан срезами");

/**
 * Срез плана, попавший на опорную плоскость таблицы.
 *
 * Сглаживающая кривая проходит через опоры точно, поэтому каждая строка таблицы
 * лежит в плане отдельным срезом — по нему и видно, что силуэт собран по ТЗ, а не
 * подобран на глаз.
 */
function deerSliceAtY(
  plan: JewelryDeerPlan,
  yMm: number,
): JewelryDeerSlice | undefined {
  return plan.slices.find(
    (slice) => Math.abs(slice.yMm - yMm * plan.scale) <= 1e-6,
  );
}

/**
 * Опорные срезы: имя, `y`, полуширина, полуширина подошвы, низ киля, верх свода.
 *
 * Числа — из таблицы исследования. Грудь стоит на широкой подошве (`wSole`
 * 12…17 при низе 2.5), поэтому она не лезвие; на шее подошва схлопывается до
 * 0.6, и дальше идёт киль. Морда сужается с 20 до 7.2 мм по ширине за 29 мм и
 * опускается к носу: верх падает с 88 до 80.2, низ поднимается с 58 до 70.
 */
const deerSliceRows = [
  ["грудь сзади", 12, 20, 15.5, 2.5, 30],
  ["грудь", 8, 22, 17, 2.5, 40],
  ["грудь спереди", 4, 22, 17, 2.5, 46],
  ["перед груди", -8.5, 17, 12, 2.5, 61.5],
  ["основание шеи", -10, 15.5, 0.6, 18, 63],
  ["середина шеи", -16, 11.5, 0.6, 39, 74],
  ["затылок", -21, 10, 0.6, 53, 84.5],
  ["лоб", -24, 10, 0.6, 58, 88],
  ["морда", -34, 8.6, 0.6, 65.5, 85.5],
  ["нос", -53, 3.6, 0.6, 70, 80.2],
] as const;

for (const [name, yMm, wMm, soleMm, bottomMm, topMm] of deerSliceRows) {
  const slice = deerSliceAtY(deerPlan, yMm);

  check(`олень: срез «${name}» есть в плане`, slice !== undefined, true);

  if (!slice) {
    continue;
  }

  expectNear(`олень: ${name} — полуширина`, slice.wMm, wMm, 0.02);
  expectNear(`олень: ${name} — подошва`, slice.wSoleMm, soleMm, 0.02);
  expectNear(`олень: ${name} — низ киля`, slice.zBottomMm, bottomMm, 0.02);
  expectNear(`олень: ${name} — верх свода`, slice.zTopMm, topMm, 0.02);
}

/** Шаг между соседними срезами: 1.5 мм, кроме перехода «перед груди — шея». */
let smallestSliceStepMm = Number.POSITIVE_INFINITY;
let largestSliceStepMm = 0;
let hardSteps = 0;

for (let index = 1; index < deerPlan.slices.length; index += 1) {
  const previous = deerPlan.slices[index - 1];
  const slice = deerPlan.slices[index];
  const step = Math.abs(previous.yMm - slice.yMm);

  smallestSliceStepMm = Math.min(smallestSliceStepMm, step);
  largestSliceStepMm = Math.max(largestSliceStepMm, step);

  if (previous.yMm >= -8.5 * deerPlan.scale - 1e-9 && slice.yMm <= -10 * deerPlan.scale + 1e-9) {
    hardSteps += 1;
  }
}

check(
  "олень: срезы стоят не реже миллиметра",
  smallestSliceStepMm >= 0.9 * deerPlan.scale,
  true,
);
check(
  "олень: переход «перед груди — шея» не сглажен",
  hardSteps === 1 && largestSliceStepMm <= 1.6 * deerPlan.scale,
  true,
);
check("олень: срезов больше сорока", deerPlan.slices.length >= 40, true);

/**
 * Угол грани киля в каждом срезе, где низ выше плиты, градусы.
 *
 * Это главная проверка новой схемы: грань обязана быть круче 45°, иначе низ
 * головы снова нависает. Требуется 47°, а не 45: ровно на границе слайсер и
 * проверка расходятся на округлении.
 */
let flattestKeelDeg = 180;

for (const slice of deerPlan.slices) {
  if (slice.zBottomMm <= deerPlan.baseHeightMm) {
    continue;
  }

  const run = slice.wMm - slice.wSoleMm;
  const fall = deerSliceSideMm(slice) - slice.zBottomMm;

  flattestKeelDeg = Math.min(
    flattestKeelDeg,
    (Math.atan2(fall, run) * 180) / Math.PI,
  );
}

check("олень: грань киля не положе 47°", flattestKeelDeg >= 47, true);
check(
  "олень: подошва киля одной ширины по всей шее",
  deerPlan.slices
    .filter((slice) => slice.zBottomMm > deerPlan.baseHeightMm)
    .every(
      (slice) =>
        Math.abs(slice.wSoleMm - JEWELRY_DEER_SOLE_HALF_MM * deerPlan.scale) <=
        0.02,
    ),
  true,
);


/**
 * Низ среза — клин, а не площадка.
 *
 * Горизонтальная подошва — это грань с нормалью вниз: там, где киль поднимается к
 * затылку под 72°, она становится нависанием. Поэтому от краёв `±wSole` гребень
 * уходит вниз к осевой линии, и у срезов выше плиты самая низкая точка стоит на
 * `x = 0`.
 */
const deerNeckSlice = deerSliceAtY(deerPlan, -16);

if (deerNeckSlice) {
  const outline = deerSectionOutline(deerNeckSlice);
  const lowest = outline.reduce((best, point) =>
    point[1] < best[1] ? point : best,
  );
  const shoulders = outline.filter(
    (point) => Math.abs(Math.abs(point[0]) - deerNeckSlice.wSoleMm) <= 1e-9,
  );

  expectNear("олень: гребень киля на оси", lowest[0], 0, 1e-9);
  check(
    "олень: гребень ниже подошвы — клин, а не площадка",
    lowest[1] < deerNeckSlice.zBottomMm - 0.5,
    true,
  );
  check(
    "олень: у клина две грани по краям подошвы",
    shoulders.length === 2 &&
      shoulders.every((point) => point[1] > lowest[1] + 0.5),
    true,
  );
}

/** Контур среза: состав точек, порядок обхода и площадь. */
const deerOutline = deerSectionOutline(deerPlan.slices[0]);
let outlineTwiceArea = 0;

for (let index = 0; index < deerOutline.length; index += 1) {
  const [x0, z0] = deerOutline[index];
  const [x1, z1] = deerOutline[(index + 1) % deerOutline.length];

  outlineTwiceArea += x0 * z1 - x1 * z0;
}

check("олень: в контуре 22 точки", deerOutline.length, 22);
check(
  "олень: контур обойдён против часовой стрелки",
  outlineTwiceArea > 0,
  true,
);
expectNear(
  "олень: площадь среза по контуру",
  deerSectionAreaMm2(deerPlan.slices[0]),
  outlineTwiceArea / 2,
  1e-6,
);
check(
  "олень: срез шире всего на высоте киля",
  Math.max(...deerOutline.map((point) => point[0])) ===
    deerPlan.slices[0].wMm &&
    Math.max(...deerOutline.map((point) => point[1])) ===
      deerPlan.slices[0].zTopMm,
  true,
);

expectNear("олень: свод черепа на 88 мм", deerPlan.crownZMm, 88, 0.02);
expectNear("олень: нос вынесен на −53 мм", deerPlan.noseYMm, -53, 0.02);
expectNear("олень: нос высотой 10 мм", deerPlan.noseZMm, 10.2, 0.02);
check(
  "олень: нос выходит за плиту — профиль важнее габарита",
  -deerPlan.noseYMm > deerPlan.baseWidthMm / 2 &&
    -deerPlan.noseYMm <= deerPlan.baseWidthMm / 2 + 4,
  true,
);
check(
  "олень: морда длиннее черепа",
  (deerSliceAtY(deerPlan, -24)?.yMm ?? 0) - deerPlan.noseYMm >= 29,
  true,
);

console.log("\nБюст «Лесной олень»: рога, уши и низ головы");

/** Корень ствола: внутри черепа, а не на его поверхности. */
const deerBeamRoot = deerPlan.antlers.find((path) => path.kind === "beam")
  ?.points[0];

if (deerBeamRoot) {
  expectNear(
    "олень: корень рога по X",
    Math.abs(deerBeamRoot.xMm),
    JEWELRY_DEER_ANTLER_ROOT_MM[0],
    0.02,
  );
  expectNear("олень: корень рога по Y", deerBeamRoot.yMm, JEWELRY_DEER_ANTLER_ROOT_MM[1], 0.02);
  expectNear("олень: корень рога по Z", deerBeamRoot.zMm, JEWELRY_DEER_ANTLER_ROOT_MM[2], 0.02);
  check(
    "олень: корень рога утоплен в голову",
    insideBust(
      deerPlan,
      deerBeamRoot.xMm,
      deerBeamRoot.yMm,
      deerBeamRoot.zMm,
      0,
    ),
    true,
  );
  check(
    "олень: кончик ствола выше головы",
    !insideBust(
      deerPlan,
      deerPlan.antlers[0].points[10].xMm,
      deerPlan.antlers[0].points[10].yMm,
      deerPlan.antlers[0].points[10].zMm,
      0,
    ),
    true,
  );
}

/** Отросток не толще ствола в месте крепления: иначе его торец торчит наружу. */
check(
  "олень: отростки тоньше ствола",
  deerPlan.antlers
    .filter((path) => path.kind === "tine")
    .every((path) => path.points[0].radiusMm <= 1.75 + 1e-9),
  true,
);

/** Кончик уха выше и снаружи черепа, а сам корень — внутри. */
for (const ear of deerPlan.ears) {
  expectNear(
    `олень: корень уха «${ear.id}» по X`,
    Math.abs(ear.rootMm[0]),
    JEWELRY_DEER_EAR_ROOT_MM[0],
    0.02,
  );
  expectNear(
    `олень: корень уха «${ear.id}» по Y`,
    ear.rootMm[1],
    JEWELRY_DEER_EAR_ROOT_MM[1],
    0.02,
  );
  expectNear(
    `олень: корень уха «${ear.id}» по Z`,
    ear.rootMm[2],
    JEWELRY_DEER_EAR_ROOT_MM[2],
    0.02,
  );
  expectNear(
    `олень: кончик уха «${ear.id}» по X`,
    Math.abs(ear.tipMm[0]),
    JEWELRY_DEER_EAR_TIP_MM[0],
    0.02,
  );
  expectNear(
    `олень: кончик уха «${ear.id}» по Z`,
    ear.tipMm[2],
    JEWELRY_DEER_EAR_TIP_MM[2],
    0.02,
  );
  check(
    `олень: корень уха «${ear.id}» утоплен в череп`,
    insideBust(deerPlan, ear.rootMm[0], ear.rootMm[1], ear.rootMm[2], 0),
    true,
  );
  check(
    `олень: кончик уха «${ear.id}» снаружи черепа`,
    !insideBust(deerPlan, ear.tipMm[0], ear.tipMm[1], ear.tipMm[2], 0),
    true,
  );
  const runMm = Math.hypot(ear.tipMm[0] - ear.rootMm[0], ear.tipMm[1] - ear.rootMm[1]);
  const riseMm = ear.tipMm[2] - ear.rootMm[2];
  const elevationDeg = (Math.atan2(riseMm, runMm) * 180) / Math.PI;

  check(
    `олень: ухо «${ear.id}» поднято не ниже 45°`,
    elevationDeg >= 45,
    true,
  );
}

/** Зазор между ухом и стволом рога: тела не должны слипаться. */
let earAntlerGapMm = Number.POSITIVE_INFINITY;

for (const ear of deerPlan.ears) {
  for (const path of deerPlan.antlers) {
    for (let index = 0; index < path.points.length - 1; index += 1) {
      const from = path.points[index];
      const to = path.points[index + 1];
      const distance = distanceToSegment(
        ear.tipMm,
        [from.xMm, from.yMm, from.zMm],
        [to.xMm, to.yMm, to.zMm],
      );

      earAntlerGapMm = Math.min(
        earAntlerGapMm,
        distance - Math.max(from.radiusMm, to.radiusMm) - ear.halfWidthMm,
      );
    }
  }
}

check("олень: уши не задевают рога", earAntlerGapMm >= 2, true);


/**
 * Свод без ступенек: верх силуэта идёт в гору до лба и опускается к носу.
 *
 * Скачок `zTop` сам по себе не ошибка — грудь поднимается круто, и это её силуэт.
 * Ошибка — горб на морде или впадина на лбу: они означают, что сглаживающая
 * кривая выбросила срез за пределы между опорами и голова снова читается шаром.
 */
let widestSlice = 0;
let crownIndex = 0;

for (let index = 1; index < deerPlan.slices.length; index += 1) {
  if (
    deerPlan.slices[index].zTopMm >
    deerPlan.slices[crownIndex].zTopMm
  ) {
    crownIndex = index;
  }
}

let crownRises = true;
let muzzleFalls = true;
let crownDipMm = 0;

for (let index = 0; index < deerPlan.slices.length; index += 1) {
  widestSlice = Math.max(widestSlice, deerPlan.slices[index].wMm);

  if (index === 0) {
    continue;
  }

  const rise = deerPlan.slices[index].zTopMm - deerPlan.slices[index - 1].zTopMm;

  if (index <= crownIndex && rise < -1e-9) {
    crownRises = false;
    crownDipMm = Math.min(crownDipMm, rise);
  }

  if (index > crownIndex && rise > 1e-9) {
    muzzleFalls = false;
  }
}

check("олень: свод растёт от груди до лба", crownRises, true);
check("олень: морда опускается после лба", muzzleFalls, true);

check(
  "олень: голова не шире груди",
  widestSlice <= 22 + 1e-9 &&
    (deerSliceAtY(deerPlan, -24)?.wMm ?? 99) < widestSlice,
  true,
);

/**
 * Зазор между рогами и мордой: ни одна точка труб не лежит внутри головы.
 *
 * Проверка строгая: `insideBust` считает ту же формулу среза, что генератор.
 * Корни стволов — исключение, они обязаны быть внутри; всё остальное, включая
 * надбровный отросток, проходящий над мордой, торчит наружу.
 */
let antlersInsideHead = 0;

for (const path of deerPlan.antlers) {
  path.points.forEach((point, index) => {
    const isRoot = path.kind === "beam" && index === 0;

    if (
      !isRoot &&
      insideBust(deerPlan, point.xMm, point.yMm, point.zMm, 0.3)
    ) {
      antlersInsideHead += 1;
    }
  });
}

check("олень: рога не проходят сквозь голову", antlersInsideHead, 0);

console.log(
  `  · киль ${flattestKeelDeg.toFixed(1)}°, срезов ${deerPlan.slices.length}, ` +
    `свод ${deerPlan.crownZMm.toFixed(1)} мм, ` +
    `уши — рога ${earAntlerGapMm.toFixed(1)} мм`,
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
/** Плита отдельно: нос выходит за овал, поэтому габарит в плане — не плита. */
const deerPlate = deerMesh.vertices.filter(
  (vertex) => vertex[2] <= deerPlan.baseHeightMm + 1e-6,
);
const [plateMinX, plateMaxX] = range(deerPlate, 0);
const [plateMinY, plateMaxY] = range(deerPlate, 1);

check("олень: открытых рёбер", openEdges(deerMesh), 0);
check("олень: вырожденных треугольников", degenerateTriangles(deerMesh), 0);
check("олень: NaN вершин", nanVertices(deerGeometry), 0);
check("олень: объём положительный", deerVolume > 0, true);
expectNear("олень: низ на столе", deerMinZ, 0, 1e-4);
expectNear("олень: длина базы по X", plateMaxX - plateMinX, 150, 0.02);
expectNear("олень: ширина базы по Y", plateMaxY - plateMinY, 100, 0.02);
expectNear("олень: высота вместе с рогами", deerMaxZ - deerMinZ, deerHeight, 0.2);
expectNear(
  "олень: габарит по Y — нос за краем плиты",
  deerMaxY - deerMinY,
  103,
  0.02,
);
expectNear(
  "олень: габарит по X — плита шире рогов",
  deerMaxX - deerMinX,
  150,
  0.02,
);

/**
 * Нависания: ноль, и это главный результат новой схемы.
 *
 * Прежний лофт по наклонной оси давал 187 мм² пологого низа: кольца стояли
 * перпендикулярно оси морды, и снизу каждое кольцо нависало под 66°. Киль с
 * гранями под 49° снял это по построению, поэтому допуска больше нет — только
 * ноль. Число печатается, чтобы регресс было видно сразу.
 */
const deerOverhang = deerOverhangs(deerMesh, deerPlan);

check("олень: нависаний нет", deerOverhang.areaMm2 <= 1e-6, true);
check("олень: самый крутой нависающий угол", deerOverhang.worstDeg, 0);
console.log(
  `  · объём ${deerVolume.toFixed(1)} см³ (${(deerVolume * 1.24).toFixed(0)} г), ` +
    `высота ${deerHeight} мм, нависаний ${deerOverhang.areaMm2.toFixed(2)} мм²`,
);

console.log("\nБюст «Лесной олень»: полость и устойчивость");

/**
 * Полость стоит перед бюстом, а не под ним.
 *
 * Под грудью идёт подошва киля на `z = 2.5`, и монету там не опустить. Задняя
 * кромка полости отстоит от переднего края подошвы на миллиметр — этого хватает,
 * чтобы монета прошла между ними, и свойство сохраняется на всех размерах базы,
 * потому что бюст масштабируется вместе с ней.
 */
const deerFootFrontY = Math.min(
  ...deerPlan.slices
    .filter((slice) => slice.zBottomMm <= deerPlan.baseHeightMm)
    .map((slice) => slice.yMm),
);
const pocketRearY = deerPlan.pocketCenterMm[1] + deerPlan.pocketRadiusMm;

check(
  "олень: полость не под подошвой",
  deerFootFrontY - pocketRearY >= 0.9,
  true,
);
check(
  "олень: полость внутри плиты",
  Math.abs(deerPlan.pocketCenterMm[1]) + deerPlan.pocketRadiusMm <
    deerPlan.baseWidthMm / 2 &&
    deerPlan.pocketRadiusMm < deerPlan.baseLengthMm / 2,
  true,
);
check(
  "олень: дно полости толще миллиметра",
  deerPlan.pocketFloorMm >= 1.2 && deerPlan.pocketDepthMm >= 2,
  true,
);

/**
 * Устойчивость: груз 200 г на кончике рога при максимальном размахе.
 *
 * Опрокидывание считается вокруг длинной кромки плиты `x = ±baseWidth / 2`:
 * плечо груза — `spread / 2 − baseWidth / 2`, плечо возврата — половина ширины
 * плиты. Двести граммов — заведомо больше любого кольца или цепочки, поэтому
 * запас 1.15× означает, что противовес не нужен.
 */
const deerMassG = deerVolume * 1.24;
const deerTipLoadG = 200;
const tippingSpreadMm = 150;
const tippingRestoreMm = deerMassG * (deerCase.deerBaseWidth / 2);
const tippingLoadMm =
  deerTipLoadG * (tippingSpreadMm / 2 - deerCase.deerBaseWidth / 2);

check(
  "олень: не опрокидывается грузом 200 г на роге",
  tippingLoadMm > 0 && tippingRestoreMm / tippingLoadMm >= 1.15,
  true,
);
console.log(
  `  · запас опрокидывания ${(tippingRestoreMm / tippingLoadMm).toFixed(2)}×, ` +
    `зазор подошва — полость ${(deerFootFrontY - pocketRearY).toFixed(1)} мм`,
);

console.log("\nБюст «Лесной олень»: диспетчер отдаёт новый лофт");

/**
 * Диспетчер — единственная точка, через которую превью и скачивание STL берут
 * геометрию пресета. Проверка сравнивает его ответ с генератором напрямую: если
 * ветку `deer_bust` когда-нибудь снова уведёт к старому «шару на конусе», тест
 * упадёт здесь, а не в браузере у владельца.
 */
const deerDirectGeometry = createJewelryDeerGeometry(deerCase);
const deerDirect = deerDirectGeometry.getAttribute("position");
const deerDispatched = deerGeometry.getAttribute("position");
let deerSameMesh = deerDirect.count === deerDispatched.count;

for (let index = 0; deerSameMesh && index < deerDirect.count; index += 1) {
  deerSameMesh =
    Math.abs(deerDirect.getX(index) - deerDispatched.getX(index)) < 1e-9 &&
    Math.abs(deerDirect.getY(index) - deerDispatched.getY(index)) < 1e-9 &&
    Math.abs(deerDirect.getZ(index) - deerDispatched.getZ(index)) < 1e-9;
}

check("олень: диспетчер вернул сетку генератора", deerSameMesh, true);

/**
 * Подпись формы: у вертикальных срезов 5864 треугольника и высота 157.57 мм, у
 * прежнего лофта по наклонной оси — 7296 и 140.49, у старого бюста со сферой на
 * конусе — 3936 и 131.91. Порог, а не точное число: правка таблицы срезов подпись
 * не ломает, а возврат к лофту или к сфере ловится сразу.
 */
check(
  "олень: диспетчер вернул срезы, а не лофт",
  deerDispatched.count / 3 > 5000 && deerDispatched.count / 3 < 7000,
  true,
);
check("олень: высота срезов из диспетчера", deerMaxZ - deerMinZ > 150, true);
check(
  "олень: вес срезов из диспетчера в коридоре",
  deerVolume >= 95 && deerVolume <= 135,
  true,
);

/**
 * Морда, а не шар: у срезов голова доходит по Y до −53 мм, у прежнего лофта — до
 * −35, у бюста со сферой на конусе передняя точка головы была на −17. Меряется
 * передний край всего, что выше шеи: рога стоят позади головы и в минимум не
 * попадают.
 */
const deerHeadFrontY = Math.min(
  ...deerMesh.vertices
    .filter((vertex) => vertex[2] > 60)
    .map((vertex) => vertex[1]),
);

check("олень: нос вынесен вперёд черепа", deerHeadFrontY <= -52.5, true);
console.log(`  · передний край головы: y = ${deerHeadFrontY.toFixed(1)} мм`);

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

const smallestOverhang = deerOverhangs(smallestMesh, smallestDeer);

check(
  "олень: минимум — нависаний нет",
  smallestOverhang.areaMm2 <= 1e-6,
  true,
);
check(
  "олень: минимум — киль утоплен в плиту",
  Math.min(
    ...smallestDeer.slices
      .filter((slice) => slice.zBottomMm <= smallestDeer.baseHeightMm)
      .map((slice) => slice.zBottomMm),
  ) < smallestDeer.baseHeightMm,
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
 * Треугольники древа, которые действительно висят в воздухе.
 *
 * Правило прежнее: нормаль смотрит вниз круче 45° к вертикали — поддержка нужна.
 * Плита, юбка, коса и ветви — отдельные замкнутые тела, и они пересекаются,
 * поэтому низ корневой юбки и торцы труб лежат внутри соседних тел: такие
 * треугольники пропускаются, слайсер их сольёт. Всё, что выше плиты и вне труб,
 * обязано быть пустым.
 */
function treeOverhangTriangles(mesh: Mesh, plan: JewelryTreePlan): number {
  const tubes = [plan.trunk, ...plan.branches].map((tube) => ({
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
check(
  "древо: чаша — борт выше дна",
  treePlan.dish.rimZMm > treePlan.dish.floorZMm,
  true,
);
near("древо: дно чаши 3 мм из ТЗ", treePlan.dish.floorZMm, 3);
near("древо: борт чаши 10 мм из ТЗ", treePlan.dish.rimZMm, 10);
near("древо: чаша по базе", treePlan.dish.outerRadiusMm, 60);
check(
  "древо: чаша внутри базы",
  treePlan.dish.profile.every(
    (point) => point.radiusMm <= treePlan.baseRadiusMm + 1e-9,
  ),
  true,
);
check(
  "древо: чаша стоит на столе",
  treePlan.dish.profile.some((point) => Math.abs(point.zMm) <= 1e-9),
  true,
);
check("древо: основные ветви по ползунку", treePlan.mainBranchCount, 4);
check(
  "древо: каждая ветвь ветвится дважды",
  treePlan.twigCount,
  treePlan.mainBranchCount * 2,
);
check("древо: штырь у каждой ветви", treePlan.thornCount, treePlan.mainBranchCount);
check(
  "древо: ствол и ветви не положе 45°",
  treePlan.flattestSurfaceDeg >= 45,
  true,
);
check(
  "древо: подъём у ствола не ниже предела",
  treePlan.branches.every((branch) => {
    if (branch.kind === "thorn") {
      return true;
    }

    return (
      strandElevationDeg(branch.points.slice(0, 2)) >=
      JEWELRY_TREE_MIN_ELEVATION_DEG - 1e-6
    );
  }),
  true,
);
check(
  "древо: ветви растут из ствола",
  treePlan.branches.every(
    (branch) => branch.points[0].zMm > treePlan.trunkRootZMm,
  ),
  true,
);
check(
  "древо: ветви не выше габарита",
  treePlan.branches.every((branch) => {
    const last = branch.points[branch.points.length - 1];

    return last.zMm + last.radiusMm <= treePlan.heightMm + 1e-6;
  }),
  true,
);
check(
  "древо: ствол выше нижней ветви",
  treePlan.crownZMm > treePlan.branches[0].points[0].zMm,
  true,
);

const looseTree = jewelryTreePlan({ ...treeCase, treeTwist: 0 });
const tightTree = jewelryTreePlan({ ...treeCase, treeTwist: 1 });

/** Насколько ветвь уходит от прямой: стрелка прогиба в долях хорды. */
const treeBranchBendRatio = (
  points: readonly JewelryTreePoint[],
): number => {
  const head = points[0];
  const tail = points[points.length - 1];
  const dx = tail.xMm - head.xMm;
  const dy = tail.yMm - head.yMm;
  const chordMm = Math.hypot(dx, dy) || 1;
  let bendMm = 0;

  for (const point of points) {
    bendMm = Math.max(
      bendMm,
      Math.abs(dx * (point.yMm - head.yMm) - dy * (point.xMm - head.xMm)) /
        chordMm,
    );
  }

  return bendMm / chordMm;
};

const treeBranchSpreadDeg = (plan: typeof treePlan): number =>
  Math.max(
    ...plan.branches.map((branch) => treeBranchBendRatio(branch.points)),
  );

check(
  "древо: изгиб уводит ветви в сторону",
  treeBranchSpreadDeg(tightTree) > treeBranchSpreadDeg(looseTree) + 0.03,
  true,
);
check(
  "древо: изгиб не поднимает крону выше предела",
  tightTree.heightMm <= treeCase.treeHeight + 1e-6 &&
    looseTree.heightMm <= treeCase.treeHeight + 1e-6,
  true,
);

check(
  "древо: без изгиба ветви идут по лучу",
  treeBranchSpreadDeg(looseTree) < 0.05,
  true,
);
check(
  "древо: с изгибом ветви уходят в сторону",
  treeBranchSpreadDeg(tightTree) > 0.085,
  true,
);
check(
  "древо: изгиб не ломает подъём",
  tightTree.flattestSurfaceDeg >= 45 && looseTree.flattestSurfaceDeg >= 45,
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
  "древо: план не уже базы",
  treePlanWidth >= treeCase.treeBaseDiameter - 1e-4,
  true,
);
check(
  "древо: ветви в пределах выноса",
  treePlan.branches.every((branch) => {
    const last = branch.points[branch.points.length - 1];

    return (
      Math.hypot(last.xMm, last.yMm) + last.radiusMm <=
      treePlan.reachMm + 1e-6
    );
  }),
  true,
);
check(
  "древо: нависаний нет",
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
    plan.mainBranchCount === expected.treeBranchCount,
    `${plan.mainBranchCount} вместо ${expected.treeBranchCount}`,
  );
  expect(
    `${name}: ветвление кроны`,
    plan.twigCount === plan.mainBranchCount * 2,
    `${plan.twigCount} веточек`,
  );
  expect(
    `${name}: нависаний нет`,
    treeOverhangTriangles(mesh, plan) === 0,
    "есть треугольники круче 45°",
  );

  console.log(
    `  ${failures.length === before ? "✓" : "✗"} ${name}: ${maxZ.toFixed(2)} мм, ` +
      `${plan.branches.length} ветвей, ${volume.toFixed(1)} см³`,
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
  smallestTreePlan.mainBranchCount,
  3,
);
check(
  "древо: минимум — крона ветвится",
  smallestTreePlan.twigCount >= 6 &&
    smallestTreePlan.branches.length > smallestTreePlan.mainBranchCount,
  true,
);
check(
  "древо: минимум — чаша не ниже трёх миллиметров",
  smallestTreePlan.dish.rimZMm >= 3,
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

