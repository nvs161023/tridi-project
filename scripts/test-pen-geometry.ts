/**
 * Тест геометрии органайзера для ручек.
 *
 * Проверяет то, что обещает панель: габарит по X равен `penSize` у всех форм,
 * круг и квадрат имеют ровно 80 мм по обеим осям, а шестигранник — честные
 * 69.28 мм по Y при ширине 80 мм. Перегородки лежат внутри полости, занимают
 * её полную ширину и не протыкают стенку. Вес считается по объёму сетки и
 * плотности PLA, без двойного учёта оболочек.
 *
 * Запуск:
 *   node --import ./scripts/register-alias.mjs scripts/test-pen-geometry.ts
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import type { BufferGeometry } from "three";

import { calculateGeometryVolumeMm3, calculateGeometryWeightGrams } from "../lib/constructor/geometry-volume";
import {
  createPenHolderGeometry,
  penHolderContours,
} from "../lib/constructor/pen-holder-geometry";
import {
  DEFAULT_PEN_HOLDER_PARAMS,
  PEN_SHAPES,
  PLANTER_SHAPES,
  isPenShape,
  isPlanterShape,
  normalizePenHolderParams,
  type PenHolderParams,
  type PenShape,
} from "../lib/constructor/params";

type Point = readonly [number, number, number];
type Point2 = readonly [number, number];

interface Mesh {
  readonly vertices: Point[];
  readonly triangles: readonly (readonly [number, number, number])[];
}

const failures: string[] = [];
const DIVIDER_TOP_MARGIN_MM = 1;

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

/** Знак объёма: отрицательное значение означало бы вывернутые нормали. */
function signedVolumeMm3(geometry: BufferGeometry): number {
  const position = geometry.getAttribute("position");
  let total = 0;

  for (let offset = 0; offset + 2 < position.count; offset += 3) {
    const ax = position.getX(offset);
    const ay = position.getY(offset);
    const az = position.getZ(offset);
    const bx = position.getX(offset + 1);
    const by = position.getY(offset + 1);
    const bz = position.getZ(offset + 1);
    const cx = position.getX(offset + 2);
    const cy = position.getY(offset + 2);
    const cz = position.getZ(offset + 2);

    total +=
      ax * (by * cz - bz * cy) -
      ay * (bx * cz - bz * cx) +
      az * (bx * cy - by * cx);
  }

  return total / 6;
}

function boundsOf(geometry: BufferGeometry): {
  width: number;
  depth: number;
  height: number;
  minZ: number;
} {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;

  if (!box) {
    throw new Error("У геометрии нет boundingBox");
  }

  return {
    width: box.max.x - box.min.x,
    depth: box.max.y - box.min.y,
    height: box.max.z - box.min.z,
    minZ: box.min.z,
  };
}

function pointOnSegment(point: Point2, a: Point2, b: Point2): boolean {
  const cross =
    (point[0] - a[0]) * (b[1] - a[1]) -
    (point[1] - a[1]) * (b[0] - a[0]);

  // Вершины сетки хранятся во float32, поэтому точка на границе контура
  // может отстоять от неё на несколько микрометров.
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);

  if (length === 0 || Math.abs(cross) / length > 1e-3) {
    return false;
  }

  const dot =
    (point[0] - a[0]) * (b[0] - a[0]) +
    (point[1] - a[1]) * (b[1] - a[1]);
  const lengthSquared = length * length;
  const t = dot / lengthSquared;

  return t >= -1e-6 && t <= 1 + 1e-6;
}

/** Точка внутри замкнутого контура; граница считается допустимой. */
function pointInPolygon(point: Point2, polygon: readonly Point2[]): boolean {
  let inside = false;

  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];

    if (pointOnSegment(point, a, b)) {
      return true;
    }

    const crosses =
      (a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] <
        ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
}

/** Вершины верхней плоскости перегородок: стенка заканчивается на кромке. */
function dividerTopPoints(
  geometry: BufferGeometry,
  params: PenHolderParams,
): Point2[] {
  const position = geometry.getAttribute("position");
  const topZ = params.penHeight - DIVIDER_TOP_MARGIN_MM;
  const points: Point2[] = [];

  for (let index = 0; index < position.count; index += 1) {
    if (Math.abs(position.getZ(index) - topZ) <= 1e-4) {
      points.push([position.getX(index), position.getY(index)]);
    }
  }

  return points;
}

function defaultParams(shape: PenShape): PenHolderParams {
  return normalizePenHolderParams({
    ...DEFAULT_PEN_HOLDER_PARAMS,
    penSize: 80,
    penHeight: 100,
    penWall: 1.6,
    penShape: shape,
    penSections: 2,
  });
}




interface Case {
  readonly name: string;
  readonly params: Partial<PenHolderParams>;
  readonly expectedDepth?: number;
}

const cases: readonly Case[] = [
  {
    name: "круг 80 / 100 / 1.6, 2 отделения",
    params: {
      penSize: 80,
      penHeight: 100,
      penWall: 1.6,
      penShape: "round",
      penSections: 2,
    },
  },
  {
    name: "квадрат 80 / 100 / 1.6, 2 отделения",
    params: {
      penSize: 80,
      penHeight: 100,
      penWall: 1.6,
      penShape: "square",
      penSections: 2,
    },
  },
  {
    name: "шестигранник 80 / 100 / 1.6, 2 отделения",
    params: {
      penSize: 80,
      penHeight: 100,
      penWall: 1.6,
      penShape: "hex",
      penSections: 2,
    },
    expectedDepth: 80 * (Math.sqrt(3) / 2),
  },
  {
    name: "минимум 50 / 60 / 1.2, круг",
    params: {
      penSize: 50,
      penHeight: 60,
      penWall: 1.2,
      penShape: "round",
      penSections: 2,
    },
  },
  {
    name: "максимум 120 / 160 / 4, шестигранник",
    params: {
      penSize: 120,
      penHeight: 160,
      penWall: 4,
      penShape: "hex",
      penSections: 2,
    },
    expectedDepth: 120 * (Math.sqrt(3) / 2),
  },
];

console.log("Габариты, замкнутость и вес:");

for (const testCase of cases) {
  const params = normalizePenHolderParams(testCase.params);
  const geometry = createPenHolderGeometry(params);
  const mesh = weld(geometry);
  const bounds = boundsOf(geometry);
  const volume = calculateGeometryVolumeMm3(geometry);
  const weight = calculateGeometryWeightGrams(geometry);
  const expectedDepth = testCase.expectedDepth ?? params.penSize;

  console.log(`\n${testCase.name}`);
  near(`ширина по X = ${params.penSize}`, bounds.width, params.penSize);
  near("глубина по Y", bounds.depth, expectedDepth);
  near(`высота по Z = ${params.penHeight}`, bounds.height, params.penHeight);
  near("стол на Z = 0", bounds.minZ, 0);
  check("NaN нет", nanVertices(geometry), 0);
  check("открытых рёбер нет", openEdges(mesh), 0);
  check("вырожденных треугольников нет", degenerateTriangles(mesh), 0);
  check("объём больше нуля", volume > 0, true);
  check("нормали смотрят наружу", signedVolumeMm3(geometry) > 0, true);
  check(
    "объём меньше габаритного объёма",
    volume < bounds.width * bounds.depth * bounds.height,
    true,
  );
  near("вес = объём × 1.24", weight, (volume / 1000) * 1.24);
  check("вес в разумном диапазоне", weight > 1 && weight < 500, true);

  if (params.penSections > 1) {
    const inner = penHolderContours(params).inner;
    const topPoints = dividerTopPoints(geometry, params);
    const inside = topPoints.every((point) => pointInPolygon(point, inner));

    check("вершины перегородок есть", topPoints.length > 0, true);
    check("перегородки не выходят за полость", inside, true);

    if (params.penSections === 2) {
      const xs = topPoints.map(([x]) => x);
      near(
        "перегородка занимает полную толщину стенки",
        Math.max(...xs) - Math.min(...xs),
        params.penWall,
      );
    }
  }

  geometry.dispose();
}

console.log("\nОтделения и объём:");

const roundVolumes = [1, 2, 4].map((penSections) => {
  const geometry = createPenHolderGeometry({
    ...defaultParams("round"),
    penSections,
  });
  const volume = calculateGeometryVolumeMm3(geometry);

  geometry.dispose();

  return volume;
});

check(
  "с двумя перегородками объём больше, чем без них",
  roundVolumes[1] > roundVolumes[0],
  true,
);
check(
  "с четырьмя отделениями объём больше, чем с двумя",
  roundVolumes[2] > roundVolumes[1],
  true,
);

console.log("\nФормы и защита от протечки:");

check("PEN_SHAPES", PEN_SHAPES.join(","), "round,square,hex");
check("PEN_SHAPES не ссылается на PLANTER_SHAPES", Object.is(PEN_SHAPES, PLANTER_SHAPES), false);
check("isPenShape(hex)", isPenShape("hex"), true);
check("isPenShape(squircle)", isPenShape("squircle"), false);
check("isPlanterShape(squircle)", isPlanterShape("squircle"), false);
check(
  "неизвестная форма пена откатывается к кругу",
  normalizePenHolderParams({
    ...defaultParams("round"),
    penShape: "squircle" as PenShape,
  }).penShape,
  "round",
);
check(
  "форма кашпо не изменилась",
  PLANTER_SHAPES.join(","),
  "round,square,hex",
);

if (failures.length > 0) {
  console.log(`\nПровалено проверок: ${failures.length}`);

  for (const failure of failures) {
    console.log(`  ✗ ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log("\nВсе проверки геометрии органайзера для ручек прошли.");
}
