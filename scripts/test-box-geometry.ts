/**
 * Тест геометрии коробки-органайзера.
 *
 * Проверяет то, что обещает панель: корпус, перегородки и детали крышки —
 * замкнутые оболочки, сетка без дыр и вывернутых нормалей, габарит совпадает
 * с параметрами, крышка стоит после зазора, а её юбка входит в коробку с
 * зазором `BOX_LID_CLEARANCE_MM`. Сетка неиндексированная, поэтому вершины
 * свариваются по координатам: без этого у каждого треугольника были бы свои
 * вершины и проверка рёбер не нашла бы ни одной пары.
 *
 * Запуск:
 *   node --import ./scripts/register-alias.mjs scripts/test-box-geometry.ts
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import type { BufferGeometry } from "three";

import {
  BOX_DIVIDER_TOP_GAP_MM,
  BOX_LID_CLEARANCE_MM,
  BOX_LID_GAP_MM,
  BOX_LID_OVERHANG_MM,
  BOX_LID_PLATE_THICKNESS_MM,
  BOX_LID_SKIRT_HEIGHT_MM,
  createBoxGeometry,
} from "../lib/constructor/box-geometry";
import {
  DEFAULT_BOX_PARAMS,
  boxStlFileName,
  normalizeBoxParams,
  type BoxParams,
} from "../lib/constructor/params";

type Point = readonly [number, number, number];

interface Mesh {
  readonly vertices: Point[];
  readonly triangles: readonly (readonly [number, number, number])[];
}

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

function signedVolumeMm3(mesh: Mesh): number {
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

  return total / 6;
}

function volumeMm3(mesh: Mesh): number {
  return Math.abs(signedVolumeMm3(mesh));
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

interface Case {
  readonly name: string;
  readonly params: Partial<BoxParams>;
}

const cases: readonly Case[] = [
  { name: "по умолчанию", params: {} },
  { name: "без крышки", params: { hasLid: false } },
  {
    name: "максимум перегородок",
    params: { boxDividersX: 3, boxDividersY: 3 },
  },
  { name: "без перегородок", params: { boxDividersX: 0, boxDividersY: 0 } },
  {
    name: "прямые углы 40 × 40 × 40, стенка 3",
    params: {
      boxWidth: 40,
      boxDepth: 40,
      boxHeight: 40,
      boxWall: 3,
      boxCornerRadius: 0,
      boxDividersX: 3,
      boxDividersY: 3,
    },
  },
  {
    name: "круглые углы 40 × 40 × 40",
    params: {
      boxWidth: 40,
      boxDepth: 40,
      boxHeight: 40,
      boxWall: 1.2,
      boxCornerRadius: 20,
      boxDividersX: 1,
      boxDividersY: 1,
    },
  },
];

console.log("Геометрия коробки:");

for (const testCase of cases) {
  console.log(`\n${testCase.name}`);
  const params = normalizeBoxParams(testCase.params);
  const geometry = createBoxGeometry(params);
  const mesh = weld(geometry);
  const bounds = geometry.boundingBox;

  if (!bounds) {
    failures.push(`${testCase.name}: нет boundingBox`);
    console.log("  ✗ нет boundingBox");
    continue;
  }

  const expectedWidth = params.hasLid
    ? params.boxWidth +
      BOX_LID_GAP_MM +
      params.boxWidth +
      BOX_LID_OVERHANG_MM * 2
    : params.boxWidth;
  const expectedDepth = params.hasLid
    ? params.boxDepth + BOX_LID_OVERHANG_MM * 2
    : params.boxDepth;

  check(`${testCase.name}: NaN нет`, nanVertices(geometry), 0);
  check(`${testCase.name}: открытых рёбер нет`, openEdges(mesh), 0);
  check(
    `${testCase.name}: вырожденных треугольников нет`,
    degenerateTriangles(mesh),
    0,
  );
  check(`${testCase.name}: объём больше нуля`, volumeMm3(mesh) > 0, true);
  check(
    `${testCase.name}: нормали смотрят наружу`,
    signedVolumeMm3(mesh) > 0,
    true,
  );
  near(
    `${testCase.name}: габарит по X`,
    bounds.max.x - bounds.min.x,
    expectedWidth,
  );
  near(
    `${testCase.name}: габарит по Y`,
    bounds.max.y - bounds.min.y,
    expectedDepth,
  );
  near(
    `${testCase.name}: габарит по Z`,
    bounds.max.z - bounds.min.z,
    params.boxHeight,
  );
  near(`${testCase.name}: стол на нуле`, bounds.min.z, 0);

  const dividerTopZ = params.boxHeight - BOX_DIVIDER_TOP_GAP_MM;

  if (params.boxDividersX + params.boxDividersY > 0) {
    check(
      `${testCase.name}: верх перегородок ниже кромки`,
      mesh.vertices.some((point) => Math.abs(point[2] - dividerTopZ) <= 1e-6),
      true,
    );
  }

  if (params.hasLid) {
    const bodyPoints = mesh.vertices.filter((point) => point[0] < 0);
    const lidPoints = mesh.vertices.filter((point) => point[0] > 0);
    const skirtPoints = lidPoints.filter(
      (point) => Math.abs(point[2] - BOX_LID_SKIRT_HEIGHT_MM) <= 1e-6,
    );
    const [bodyMinX, bodyMaxX] = range(bodyPoints, 0);
    const [lidMinX, lidMaxX] = range(lidPoints, 0);
    const [lidMinZ, lidMaxZ] = range(lidPoints, 2);
    const [skirtMinX, skirtMaxX] = range(skirtPoints, 0);
    const [skirtMinY, skirtMaxY] = range(skirtPoints, 1);
    const skirtWidth =
      params.boxWidth - 2 * params.boxWall - 2 * BOX_LID_CLEARANCE_MM;
    const skirtDepth =
      params.boxDepth - 2 * params.boxWall - 2 * BOX_LID_CLEARANCE_MM;

    near(
      `${testCase.name}: зазор между корпусом и крышкой`,
      lidMinX - bodyMaxX,
      BOX_LID_GAP_MM,
    );
    near(
      `${testCase.name}: ширина корпуса без крышки`,
      bodyMaxX - bodyMinX,
      params.boxWidth,
    );
    near(
      `${testCase.name}: плита крышки с навесом`,
      lidMaxX - lidMinX,
      params.boxWidth + BOX_LID_OVERHANG_MM * 2,
    );
    near(`${testCase.name}: крышка лежит на столе`, lidMinZ, 0);
    near(
      `${testCase.name}: верх юбки`,
      lidMaxZ,
      BOX_LID_PLATE_THICKNESS_MM + BOX_LID_SKIRT_HEIGHT_MM,
    );
    near(
      `${testCase.name}: юбка по X с зазором`,
      skirtMaxX - skirtMinX,
      skirtWidth,
    );
    near(
      `${testCase.name}: юбка по Y с зазором`,
      skirtMaxY - skirtMinY,
      skirtDepth,
    );
  }
}

const filename = boxStlFileName(normalizeBoxParams(DEFAULT_BOX_PARAMS));

console.log("\nИмя STL");
check(
  "новые поля входят в имя",
  filename,
  "tridi-korobka-w140-d100-h60-t1.6-r5-x1-y1-kryshka.stl",
);

const legacy = normalizeBoxParams({
  boxLength: 180,
  boxWidth: 120,
  boxHeight: 50,
  boxWall: 2,
  cellsX: [40, 40, 40, 40],
  cellsY: [60, 60],
  hasLid: false,
});

console.log("\nМиграция старого проекта");
check("старая длина стала шириной", legacy.boxWidth, 180);
check("старая ширина стала глубиной", legacy.boxDepth, 120);
check("четыре старые ячейки — три перегородки", legacy.boxDividersX, 3);
check("две старые ячейки — одна перегородка", legacy.boxDividersY, 1);
check("старый проект остался без крышки", legacy.hasLid, false);

if (failures.length > 0) {
  console.error(`\nРасхождения (${failures.length}):`);

  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log("\nВсе проверки прошли.");
}

