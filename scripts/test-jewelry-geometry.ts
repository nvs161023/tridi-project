/**
 * Тест геометрии подставки для украшений.
 *
 * Три пресета коллекции: лоток-лист, «Рогатое дерево» с кроной из рогов и
 * плетёное древо. Проверяется
 * то, что обещает панель: габарит по Z совпадает с высотой из ползунка, деталь
 * стоит на столе, сетка замкнута. У листа, рогатого дерева и древа нависаний
 * круче 45° нет; у «Рогатого дерева» ствол сохраняет 60 мм, а рога по-прежнему
 * поднимаются не положе 46°. Сетка неиндексированная, поэтому вершины
 * свариваются по координатам: без этого у каждого треугольника были бы свои
 * вершины и проверка рёбер не нашла бы ни одной пары.
 *
 * Запуск:
 *   node --import ./scripts/register-alias.mjs scripts/test-jewelry-geometry.ts
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import type { BufferGeometry } from "three";

import {
  JEWELRY_ANTLER_TREE_ANTLER_MIN_ELEVATION_DEG,
  JEWELRY_ANTLER_TREE_BASE_HEIGHT_MM,
  JEWELRY_ANTLER_TREE_FLARE_RADIUS_MM,
  JEWELRY_ANTLER_TREE_HOLE_COUNT,
  JEWELRY_ANTLER_TREE_HOLE_DIAMETER_MM,
  JEWELRY_ANTLER_TREE_MAX_FOOTPRINT_MM,
  JEWELRY_ANTLER_TREE_MAX_HEIGHT_MM,
  JEWELRY_ANTLER_TREE_MIN_ANTLER_DIAMETER_MM,
  JEWELRY_ANTLER_TREE_TRUNK_BOTTOM_RADIUS_MM,
  JEWELRY_ANTLER_TREE_TRUNK_HEIGHT_MM,
  JEWELRY_ANTLER_TREE_TRUNK_SIDES,
  JEWELRY_ANTLER_TREE_TRUNK_TOP_RADIUS_MM,
  createJewelryAntlerTreeGeometry,
  jewelryAntlerTreeHeightMm,
  jewelryAntlerTreePlan,
  type JewelryAntlerTreePlan,
} from "../lib/constructor/jewelry-antler-tree-geometry";
import {
  JEWELRY_LEAF_BOWL_DEPTH_MM,
  JEWELRY_LEAF_CENTER_VEIN_HALF_MM,
  JEWELRY_LEAF_MIN_THICKNESS_MM,
  JEWELRY_LEAF_RIM_BAND_MM,
  JEWELRY_LEAF_RIM_MM,
  JEWELRY_LEAF_SIDE_VEIN_HALF_MM,
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
  JEWELRY_PRESETS,
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

/**
 * Мест, где нормали не сглажены, хотя сглаживать было что.
 *
 * `computeVertexNormals` раздаёт грани её собственную нормаль. У неиндексированной
 * сетки вершина принадлежит ровно одной грани, поэтому получается плоское
 * затенение: свод головы из срезов через 1.5 мм читается ступенями, а прядь косы —
 * шестнадцатигранником. Проверка ищет точки, где все грани вокруг лежат в пределах
 * порога сгиба (значит, ребра там нет и нормаль обязана быть общей), но записанные
 * нормали расходятся больше чем на градус. Там, где грани расходятся круче порога,
 * разные нормали — это настоящее ребро, и оно правильное.
 */
function flatShadingSpots(geometry: BufferGeometry, creaseDegrees = 30): number {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");

  if (!normal) {
    return Number.POSITIVE_INFINITY;
  }

  const faceCount = Math.floor(position.count / 3);
  const faceNormals: Point[] = [];
  const spots = new Map<string, { faces: number[]; slots: number[] }>();

  for (let face = 0; face < faceCount; face += 1) {
    const offset = face * 3;
    const ax = position.getX(offset);
    const ay = position.getY(offset);
    const az = position.getZ(offset);
    const ux = position.getX(offset + 1) - ax;
    const uy = position.getY(offset + 1) - ay;
    const uz = position.getZ(offset + 1) - az;
    const vx = position.getX(offset + 2) - ax;
    const vy = position.getY(offset + 2) - ay;
    const vz = position.getZ(offset + 2) - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);

    faceNormals.push(
      length > 0 ? [nx / length, ny / length, nz / length] : [0, 0, 0],
    );

    for (let corner = 0; corner < 3; corner += 1) {
      const slot = offset + corner;
      // Ключ с той же точностью 0.1 мкм, что у сглаживания: иначе тест делил бы
      // точку на две и требовал от половинок разного.
      const key =
        `${Math.round(position.getX(slot) * 1e4)}:` +
        `${Math.round(position.getY(slot) * 1e4)}:` +
        `${Math.round(position.getZ(slot) * 1e4)}`;
      const spot = spots.get(key);

      if (spot) {
        spot.faces.push(face);
        spot.slots.push(slot);
      } else {
        spots.set(key, { faces: [face], slots: [slot] });
      }
    }
  }

  const cosCrease = Math.cos((creaseDegrees * Math.PI) / 180);
  const cosTolerance = Math.cos((1 * Math.PI) / 180);
  let count = 0;

  for (const spot of spots.values()) {
    let smooth = true;

    for (let first = 0; first < spot.faces.length && smooth; first += 1) {
      const a = faceNormals[spot.faces[first]];

      for (let second = first + 1; second < spot.faces.length; second += 1) {
        const b = faceNormals[spot.faces[second]];

        if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < cosCrease) {
          smooth = false;
          break;
        }
      }
    }

    if (!smooth) {
      continue;
    }

    const reference = spot.slots[0];

    for (const slot of spot.slots) {
      const dot =
        normal.getX(reference) * normal.getX(slot) +
        normal.getY(reference) * normal.getY(slot) +
        normal.getZ(reference) * normal.getZ(slot);

      if (dot < cosTolerance) {
        count += 1;
        break;
      }
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
near("лист: плита 2.5 мм из ТЗ", jewelryLeafPlateThicknessMm(), 2.5);
near("лист: минимальная толщина", JEWELRY_LEAF_MIN_THICKNESS_MM, 1.2);
near("лист: бортик 5 мм по ТЗ", JEWELRY_LEAF_RIM_MM, 5);
near("лист: бортик 2 мм по ТЗ", JEWELRY_LEAF_RIM_BAND_MM, 2);
near("лист: жилка 1.5 мм по ТЗ", JEWELRY_LEAF_CENTER_VEIN_HALF_MM * 2, 1.5);
near("лист: боковая жилка 1.5 мм по ТЗ", JEWELRY_LEAF_SIDE_VEIN_HALF_MM * 2, 1.5);

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

/**
 * Гребень бортика стоит на 5 мм над плитой.
 *
 * Верхушка валика — на 78 % полосы от её начала: 2 мм полосы от кромки внутрь
 * дают `widestHalf − 0.44`. Там ложе и жилки уже погашены, поэтому лицо равно
 * плите плюс высота бортика — по этому числу и видно, что бортик из ТЗ, а не
 * прежний вал высотой 12 мм.
 */
expectNear(
  "лист: гребень бортика на 5 мм над плитой",
  jewelryLeafFaceMm(leafCase, dishPointX, widestHalfOnAxisMm - 0.44),
  jewelryLeafPlateThicknessMm() + JEWELRY_LEAF_RIM_MM,
  0.05,
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
check("лист: нормали сглажены", flatShadingSpots(leafGeometry), 0);
check("лист: объём положительный", leafVolume > 0, true);

/**
 * Вес листа по ТЗ: 20–25 г.
 *
 * Плотность 1.24 г/см³ — та же, что в остальных проверках веса: PLA-филамент
 * считает слайсер, а тесту хватает объёма и одной плотности на всю модель.
 */
const leafMassG = leafVolume * 1.24;

check(
  "лист: вес 20–25 г по ТЗ",
  leafMassG >= 20 && leafMassG <= 25,
  true,
);
console.log(
  `  · объём ${leafVolume.toFixed(1)} см³, вес ${leafMassG.toFixed(1)} г`,
);

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

/** Точка внутри ствола: радиус профиля на её высоте плюс запас. */
function insideStem(
  plan: JewelryAntlerTreePlan,
  point: Point,
  marginMm = 0,
): boolean {
  if (
    point[2] < plan.trunkRootZMm - marginMm ||
    point[2] > plan.trunkTopZMm + marginMm
  ) {
    return false;
  }

  let radiusMm = plan.stemProfile[0].radiusMm;

  for (let index = 0; index < plan.stemProfile.length - 1; index += 1) {
    const from = plan.stemProfile[index];
    const to = plan.stemProfile[index + 1];

    if (point[2] >= from.zMm && point[2] <= to.zMm) {
      const share =
        to.zMm > from.zMm ? (point[2] - from.zMm) / (to.zMm - from.zMm) : 0;

      radiusMm = from.radiusMm + (to.radiusMm - from.radiusMm) * share;
      break;
    }
  }

  return Math.hypot(point[0], point[1]) <= radiusMm + marginMm;
}

/** Точка внутри овального лотка: потолки там опираются на стол. */
function insideBasePlate(
  plan: JewelryAntlerTreePlan,
  point: Point,
): boolean {
  if (point[2] > plan.baseHeightMm + 1e-6) {
    return false;
  }

  const x = point[0] / (plan.baseLengthMm / 2);
  const y = point[1] / (plan.baseWidthMm / 2);

  return x * x + y * y <= 1;
}

/** Нависания «Рогатого дерева»: потолки, у которых есть опора или скрытый корень. */
function antlerTreeOverhangs(
  mesh: Mesh,
  plan: JewelryAntlerTreePlan,
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

    const center: Point = [centerX, centerY, centerZ];
    const buried = plan.antlers.some((path) =>
      insideTube(
        center,
        path.points.map(
          (point) => [point.xMm, point.yMm, point.zMm] as Point,
        ),
        path.points.map((point) => point.radiusMm),
        0.35,
      ),
    );

    if (
      insideBasePlate(plan, center) ||
      insideStem(plan, center, 1.5) ||
      buried
    ) {
      continue;
    }

    count += 1;
  }

  return count;
}

console.log("\nРогатое дерево: пресет и параметры");

check(
  "antler_tree есть в реестре пресетов",
  JEWELRY_PRESETS.includes("antler_tree"),
  true,
);
check(
  "deer_bust удалён из реестра",
  (JEWELRY_PRESETS as readonly string[]).includes("deer_bust"),
  false,
);

/** Витринная конфигурация: лоток 250 × 150 и крона 230 мм. */
const antlerCase = {
  jewelryPreset: "antler_tree" as const,
  antlerSpread: 230,
  baseLength: 250,
  baseWidth: 150,
};
const antlerPlan = jewelryAntlerTreePlan(antlerCase);
const antlerHeight = jewelryAntlerTreeHeightMm(antlerCase);

near("рогатое дерево: длина лотка", antlerPlan.baseLengthMm, 250);
near("рогатое дерево: ширина лотка", antlerPlan.baseWidthMm, 150);
near(
  "рогатое дерево: высота лотка",
  antlerPlan.baseHeightMm,
  JEWELRY_ANTLER_TREE_BASE_HEIGHT_MM,
);
check(
  "рогатое дерево: полости под монету нет",
  "pocketRadiusMm" in antlerPlan,
  false,
);

console.log("\nРогатое дерево: ствол и раструб");

near(
  "рогатое дерево: высота ствола 60 мм",
  antlerPlan.trunkHeightMm,
  JEWELRY_ANTLER_TREE_TRUNK_HEIGHT_MM,
);
near(
  "рогатое дерево: рога начинаются на 60 мм над лотком",
  antlerPlan.trunkTopZMm - antlerPlan.baseHeightMm,
  JEWELRY_ANTLER_TREE_TRUNK_HEIGHT_MM,
);
near(
  "рогатое дерево: нижний радиус 15",
  antlerPlan.trunkBottomRadiusMm,
  JEWELRY_ANTLER_TREE_TRUNK_BOTTOM_RADIUS_MM,
);
near(
  "рогатое дерево: верхний радиус 10",
  antlerPlan.trunkTopRadiusMm,
  JEWELRY_ANTLER_TREE_TRUNK_TOP_RADIUS_MM,
);
check(
  "рогатое дерево: 32 сегмента ствола",
  antlerPlan.trunkSides === JEWELRY_ANTLER_TREE_TRUNK_SIDES &&
    antlerPlan.trunkSides === 32,
  true,
);
near(
  "рогатое дерево: радиус раструба",
  antlerPlan.flareRadiusMm,
  JEWELRY_ANTLER_TREE_FLARE_RADIUS_MM,
);
const flareEndRadiusMm =
  antlerPlan.stemProfile.find(
    (point) => point.zMm === antlerPlan.flareEndZMm,
  )?.radiusMm ?? -1;

near(
  "рогатое дерево: раструб сходит к 15 мм",
  flareEndRadiusMm,
  JEWELRY_ANTLER_TREE_TRUNK_BOTTOM_RADIUS_MM,
);
check(
  "рогатое дерево: радиус только убывает",
  antlerPlan.stemProfile.every(
    (point, index) =>
      index === 0 ||
      point.radiusMm <= antlerPlan.stemProfile[index - 1].radiusMm + 1e-9,
  ),
  true,
);
check(
  "рогатое дерево: ствол начинается ниже лица лотка",
  antlerPlan.trunkRootZMm < antlerPlan.baseHeightMm &&
    antlerPlan.trunkRootZMm > 0,
  true,
);

console.log("\nРогатое дерево: сетка отверстий под серьги");

check(
  "рогатое дерево: десять отверстий",
  antlerPlan.holes.length === JEWELRY_ANTLER_TREE_HOLE_COUNT &&
    JEWELRY_ANTLER_TREE_HOLE_COUNT === 10,
  true,
);
near(
  "рогатое дерево: диаметр отверстия 1.2",
  antlerPlan.holeDiameterMm,
  JEWELRY_ANTLER_TREE_HOLE_DIAMETER_MM,
);
check(
  "рогатое дерево: отверстия не задевают раструб",
  antlerPlan.holes.every(
    (hole) =>
      Math.hypot(hole.xMm, hole.yMm) - hole.radiusMm >
      JEWELRY_ANTLER_TREE_FLARE_RADIUS_MM + 1.9,
  ),
  true,
);
check(
  "рогатое дерево: отверстия вписаны в лоток",
  antlerPlan.holes.every((hole) => {
    const x = hole.xMm / (antlerPlan.baseLengthMm / 2);
    const y = hole.yMm / (antlerPlan.baseWidthMm / 2);

    return Math.hypot(x, y) + hole.radiusMm / 10 < 0.95;
  }),
  true,
);
check(
  "рогатое дерево: сетка не повторяет точки",
  new Set(antlerPlan.holes.map((hole) => `${hole.xMm}:${hole.yMm}`)).size ===
    JEWELRY_ANTLER_TREE_HOLE_COUNT,
  true,
);
check(
  "рогатое дерево: сетка стоит двумя колонками",
  new Set(antlerPlan.holes.map((hole) => hole.xMm.toFixed(6))).size === 2,
  true,
);

console.log("\nРогатое дерево: крона из 26 трубок");

check("рогатое дерево: 26 труб рогов", antlerPlan.antlers.length, 26);
check(
  "рогатое дерево: два ствола и 24 ветви",
  antlerPlan.antlers.filter((path) => path.kind === "beam").length === 2 &&
    antlerPlan.antlers.filter((path) => path.kind === "tine").length === 24,
  true,
);
check(
  "рогатое дерево: ветви не тоньше Ø3 мм",
  antlerPlan.antlers.every(
    (path) =>
      path.budRadiusMm * 2 >=
        JEWELRY_ANTLER_TREE_MIN_ANTLER_DIAMETER_MM - 1e-9 &&
      path.points.every(
        (point) =>
          point.radiusMm * 2 >=
          JEWELRY_ANTLER_TREE_MIN_ANTLER_DIAMETER_MM - 1e-9,
      ),
  ),
  true,
);
check(
  "рогатое дерево: высота вписана в 240 мм",
  antlerPlan.heightMm <= JEWELRY_ANTLER_TREE_MAX_HEIGHT_MM + 1e-6 &&
    Math.abs(antlerHeight - antlerPlan.heightMm) < 1e-9,
  true,
);
check(
  "рогатое дерево: высота — это верх рогов",
  Math.abs(antlerPlan.heightMm - antlerPlan.antlerTopZMm) < 0.01,
  true,
);
check(
  "рогатое дерево: крона выше ствола",
  antlerPlan.antlerTopZMm > antlerPlan.trunkTopZMm + 150,
  true,
);
check(
  "рогатое дерево: рога не выходят за размах",
  antlerPlan.antlers.every((path) =>
    path.points.every(
      (point) =>
        Math.abs(point.xMm) + path.budRadiusMm <=
        antlerPlan.antlerSpreadMm / 2 + 0.01,
    ),
  ),
  true,
);
check(
  "рогатое дерево: габарит в плане не больше 250 × 250",
  Math.max(
    antlerPlan.baseLengthMm,
    antlerPlan.baseWidthMm,
    antlerPlan.antlerOuterXMm * 2,
    antlerPlan.antlerOuterYMm * 2,
  ) <=
    JEWELRY_ANTLER_TREE_MAX_FOOTPRINT_MM + 1e-6,
  true,
);
check(
  "рогатое дерево: рога растут из верхушки ствола",
  antlerPlan.antlerRootZMm < antlerPlan.trunkTopZMm &&
    antlerPlan.antlerRootZMm > antlerPlan.trunkTopZMm - 12,
  true,
);

for (const beam of antlerPlan.antlers.filter(
  (path) => path.kind === "beam",
)) {
  const root = beam.points[0];

  check(
    `рогатое дерево: корень ${beam.id} внутри ствола`,
    insideStem(antlerPlan, [root.xMm, root.yMm, root.zMm], 0.2),
    true,
  );
}

for (const tine of antlerPlan.antlers.filter(
  (path) => path.kind === "tine",
)) {
  const root = tine.points[0];

  check(
    `рогатое дерево: корень ${tine.id} утоплен в родителя`,
    antlerPlan.antlers.some(
      (other) =>
        other !== tine &&
        insideTube(
          [root.xMm, root.yMm, root.zMm],
          other.points.map(
            (point) => [point.xMm, point.yMm, point.zMm] as Point,
          ),
          other.points.map((point) => point.radiusMm),
          0.2,
        ),
    ),
    true,
  );
}

let flattestAntlerDeg = 180;

for (const path of antlerPlan.antlers) {
  for (let index = 0; index < path.points.length - 1; index += 1) {
    const from = path.points[index];
    const to = path.points[index + 1];
    const run = Math.hypot(to.xMm - from.xMm, to.yMm - from.yMm);

    if (run > 1e-9) {
      flattestAntlerDeg = Math.min(
        flattestAntlerDeg,
        (Math.atan2(to.zMm - from.zMm, run) * 180) / Math.PI,
      );
    }
  }
}

check(
  "рогатое дерево: каждая хорда рога не положе 46°",
  flattestAntlerDeg >=
    JEWELRY_ANTLER_TREE_ANTLER_MIN_ELEVATION_DEG - 1e-6,
  true,
);

check(
  "рогатое дерево: тела оленя удалены",
  ["body", "head", "legs", "ears", "plinth"].every(
    (key) => !(key in antlerPlan),
  ),
  true,
);

console.log("\nРогатое дерево: тело детали");

const antlerGeometry = createJewelryAntlerTreeGeometry(antlerCase);
const antlerMesh = weld(antlerGeometry);
const [antlerMinZ, antlerMaxZ] = range(antlerMesh.vertices, 2);
const [antlerMinX, antlerMaxX] = range(antlerMesh.vertices, 0);
const [antlerMinY, antlerMaxY] = range(antlerMesh.vertices, 1);
const antlerVolume = volumeMm3(antlerMesh) / 1000;
const antlerTriangles = antlerGeometry.getAttribute("position").count / 3;

check("рогатое дерево: открытых рёбер", openEdges(antlerMesh), 0);
check("рогатое дерево: NaN", nanVertices(antlerGeometry), 0);
check(
  "рогатое дерево: вырожденных треугольников",
  degenerateTriangles(antlerMesh),
  0,
);
check(
  "рогатое дерево: поверхность гладкая",
  flatShadingSpots(antlerGeometry, 60),
  0,
);
check(
  "рогатое дерево: плотная сетка",
  antlerTriangles > 10000 && antlerTriangles < 100000,
  true,
);
check(
  "рогатое дерево: низ на столе",
  Math.abs(antlerMinZ) <= 1e-6,
  true,
);
check(
  "рогатое дерево: высота совпадает с планом",
  Math.abs(antlerMaxZ - antlerPlan.heightMm) <= HEIGHT_TOLERANCE_MM,
  true,
);
expectNear("рогатое дерево: габарит по X", antlerMaxX - antlerMinX, 250, 0.15);
expectNear("рогатое дерево: габарит по Y", antlerMaxY - antlerMinY, 150, 0.15);
check(
  "рогатое дерево: STL не выше 240 мм",
  antlerMaxZ <= JEWELRY_ANTLER_TREE_MAX_HEIGHT_MM + HEIGHT_TOLERANCE_MM,
  true,
);
check(
  "рогатое дерево: STL не шире 250 мм",
  antlerMaxX - antlerMinX <=
    JEWELRY_ANTLER_TREE_MAX_FOOTPRINT_MM + 1e-6 &&
    antlerMaxY - antlerMinY <=
      JEWELRY_ANTLER_TREE_MAX_FOOTPRINT_MM + 1e-6,
  true,
);

const antlerOverhangCount = antlerTreeOverhangs(antlerMesh, antlerPlan);

check(
  "рогатое дерево: нависаний круче 45° нет",
  antlerOverhangCount,
  0,
);
check(
  "рогатое дерево: объём в коридоре",
  antlerVolume > 100 && antlerVolume < 400,
  true,
);

console.log(
  `  · ${antlerTriangles} треугольников, ${antlerVolume.toFixed(1)} см³, ` +
    `${antlerOverhangCount} нависаний, ` +
    `z ${antlerMinZ.toFixed(2)}…${antlerMaxZ.toFixed(2)} мм`,
);

console.log("\nРогатое дерево: диспетчер и подписи");

const antlerDirect = createJewelryAntlerTreeGeometry(antlerCase);
const antlerDispatched = antlerGeometry.getAttribute("position");
const antlerDirectPosition = antlerDirect.getAttribute("position");
let antlerSameMesh = antlerDirectPosition.count === antlerDispatched.count;

for (let index = 0; antlerSameMesh && index < antlerDirectPosition.count; index += 1) {
  antlerSameMesh =
    Math.abs(antlerDirectPosition.getX(index) - antlerDispatched.getX(index)) <
      1e-9 &&
    Math.abs(antlerDirectPosition.getY(index) - antlerDispatched.getY(index)) <
      1e-9 &&
    Math.abs(antlerDirectPosition.getZ(index) - antlerDispatched.getZ(index)) <
      1e-9;
}

check(
  "рогатое дерево: диспетчер вернул сетку генератора",
  antlerSameMesh,
  true,
);

const antlerMetrics = jewelryStandMetrics(antlerCase);

near("рогатое дерево: метрика ширины", antlerMetrics.widthMm, 250);
near("рогатое дерево: метрика глубины", antlerMetrics.depthMm, 150);
check(
  "рогатое дерево: метрика высоты",
  Math.abs(antlerMetrics.heightMm - antlerHeight) <= HEIGHT_TOLERANCE_MM,
  true,
);

const antlerFileName = jewelryStandStlFileName(
  normalizeJewelryStandParams(antlerCase),
);

check(
  "рогатое дерево: имя файла",
  antlerFileName,
  "tridi-podstavka-ukrasheniy-antler-tree-l250-w150-a230.stl",
);
check(
  "рогатое дерево: имя файла только ASCII",
  /^[\x20-\x7E]+$/.test(antlerFileName),
  true,
);

const clampedAntler = normalizeJewelryStandParams({
  jewelryPreset: "antler_tree",
  antlerSpread: 500,
  baseLength: 5,
  baseWidth: 500,
});

check("рогатое дерево: размах ужат", clampedAntler.antlerSpread, 230);
check("рогатое дерево: длина лотка поднята", clampedAntler.baseLength, 150);
check("рогатое дерево: ширина лотка ужата", clampedAntler.baseWidth, 150);

console.log("\nРогатое дерево: минимальный размер");

const smallestAntlerCase = {
  jewelryPreset: "antler_tree" as const,
  antlerSpread: 100,
  baseLength: 150,
  baseWidth: 100,
};
const smallestAntler = jewelryAntlerTreePlan(smallestAntlerCase);
const smallestAntlerGeometry =
  createJewelryAntlerTreeGeometry(smallestAntlerCase);
const smallestAntlerMesh = weld(smallestAntlerGeometry);
const [smallestAntlerMinZ, smallestAntlerMaxZ] = range(
  smallestAntlerMesh.vertices,
  2,
);

check(
  "рогатое дерево: минимум — открытых рёбер",
  openEdges(smallestAntlerMesh),
  0,
);
check(
  "рогатое дерево: минимум — NaN",
  nanVertices(smallestAntlerGeometry),
  0,
);
check(
  "рогатое дерево: минимум — низ на столе",
  Math.abs(smallestAntlerMinZ) <= 1e-6,
  true,
);
check(
  "рогатое дерево: минимум — высота из плана",
  Math.abs(smallestAntlerMaxZ - smallestAntler.heightMm) <=
    HEIGHT_TOLERANCE_MM,
  true,
);
check(
  "рогатое дерево: минимум — ствол те же 60 мм",
  smallestAntler.trunkHeightMm === JEWELRY_ANTLER_TREE_TRUNK_HEIGHT_MM &&
    smallestAntler.trunkTopZMm - smallestAntler.baseHeightMm ===
      JEWELRY_ANTLER_TREE_TRUNK_HEIGHT_MM,
  true,
);
check(
  "рогатое дерево: минимум — отверстия вписаны",
  smallestAntler.holes.every((hole) => {
    const x = hole.xMm / (smallestAntler.baseLengthMm / 2);
    const y = hole.yMm / (smallestAntler.baseWidthMm / 2);

    return Math.hypot(x, y) + hole.radiusMm / 10 < 0.95;
  }),
  true,
);
check(
  "рогатое дерево: минимум — нависаний нет",
  antlerTreeOverhangs(smallestAntlerMesh, smallestAntler),
  0,
);
check(
  "рогатое дерево: минимум — высота вписана в конверт",
  smallestAntler.heightMm <= JEWELRY_ANTLER_TREE_MAX_HEIGHT_MM + 1e-6,
  true,
);
check(
  "рогатое дерево: минимум — рога не тоньше Ø3 мм",
  smallestAntler.antlers.every(
    (path) =>
      path.budRadiusMm * 2 >=
        JEWELRY_ANTLER_TREE_MIN_ANTLER_DIAMETER_MM - 1e-9 &&
      path.points.every(
        (point) =>
          point.radiusMm * 2 >=
          JEWELRY_ANTLER_TREE_MIN_ANTLER_DIAMETER_MM - 1e-9,
      ),
  ),
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
  const tubes = [...plan.strands, ...plan.branches].map((tube) => ({
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

    if (process.env.JEWELRY_DEBUG_OVERHANG === "1") {
      console.log(
        `    overhang at ${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)} normal ${(nz / length).toFixed(3)}`,
      );
    }
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
check("древо: нормали сглажены", flatShadingSpots(treeGeometry), 0);
check("древо: объём положительный", treeVolume > 0, true);
console.log(`  · bbox z ${treeMinZ.toFixed(4)} … ${treeMaxZ.toFixed(4)}`);
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

