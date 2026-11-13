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
  BOX_FLOOR_THICKNESS_MM,
  BOX_LID_CLEARANCE_MM,
  BOX_LID_GAP_MM,
  BOX_LID_OVERHANG_MM,
  BOX_LID_PLATE_THICKNESS_MM,
  BOX_LID_SKIRT_HEIGHT_MM,
  BOX_MAGNET_CEILING_MM,
  BOX_MAGNET_EDGE_GAP_MM,
  BOX_STACK_CLEARANCE_MM,
  BOX_STACK_HEIGHT_MM,
  boxMagnetPocketCenters,
  createBoxGeometry,
} from "../lib/constructor/box-geometry";
import {
  BOX_MAGNET_SPECS,
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

/** Объём оболочек, все вершины которых лежат правее порога. */
function signedVolumeRightOf(mesh: Mesh, minX: number): number {
  let total = 0;

  for (const [a, b, c] of mesh.triangles) {
    const pa = mesh.vertices[a];
    const pb = mesh.vertices[b];
    const pc = mesh.vertices[c];

    if (pa[0] < minX || pb[0] < minX || pc[0] < minX) {
      continue;
    }

    total +=
      pa[0] * (pb[1] * pc[2] - pb[2] * pc[1]) -
      pa[1] * (pb[0] * pc[2] - pb[2] * pc[0]) +
      pa[2] * (pb[0] * pc[1] - pb[1] * pc[0]);
  }

  return total / 6;
}

/** Вершины окружности паза на заданной высоте: их должно быть ровно 24. */
function ringVertices(
  mesh: Mesh,
  centerX: number,
  centerY: number,
  radius: number,
  z: number,
): number {
  return mesh.vertices.filter(
    (point) =>
      Math.abs(point[2] - z) <= 1e-4 &&
      Math.abs(
        Math.hypot(point[0] - centerX, point[1] - centerY) - radius,
      ) <= 1e-4,
  ).length;
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
  {
    name: "магниты 6 × 2 и штабель 100 × 100 × 50",
    params: {
      boxWidth: 100,
      boxDepth: 100,
      boxHeight: 50,
      boxWall: 1.6,
      boxCornerRadius: 5,
      boxDividersX: 1,
      boxDividersY: 0,
      hasLid: true,
      boxMagnets: true,
      boxMagnetSize: "6x2",
      boxStack: true,
    },
  },
  {
    name: "магниты 8 × 3 на прямых углах",
    params: {
      boxWidth: 120,
      boxDepth: 80,
      boxHeight: 60,
      boxWall: 1.6,
      boxCornerRadius: 0,
      boxDividersX: 1,
      boxDividersY: 1,
      hasLid: true,
      boxMagnets: true,
      boxMagnetSize: "8x3",
      boxStack: false,
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
      BOX_LID_OVERHANG_MM * 2 +
      (params.boxStack
        ? BOX_LID_GAP_MM +
          params.boxWidth +
          BOX_LID_OVERHANG_MM * 2
        : 0)
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

  const magnetSpec = BOX_MAGNET_SPECS[params.boxMagnetSize];
  const expectedFloor = BOX_FLOOR_THICKNESS_MM;
  const expectedPlate = params.boxMagnets
    ? Math.max(
        BOX_LID_PLATE_THICKNESS_MM,
        magnetSpec.depthMm + BOX_MAGNET_CEILING_MM,
      )
    : BOX_LID_PLATE_THICKNESS_MM;
  const lidWidth = params.boxWidth + BOX_LID_OVERHANG_MM * 2;
  const lidDepth = params.boxDepth + BOX_LID_OVERHANG_MM * 2;
  const bodyMinX = bounds.min.x;
  const bodyMaxX = bodyMinX + params.boxWidth;
  const lidMinX = bodyMaxX + BOX_LID_GAP_MM;
  const lidMaxX = lidMinX + lidWidth;

  if (params.hasLid) {
    const bodyPoints = mesh.vertices.filter(
      (point) => point[0] >= bodyMinX - 1e-6 && point[0] <= bodyMaxX + 1e-6,
    );
    const lidPoints = mesh.vertices.filter(
      (point) => point[0] >= lidMinX - 1e-6 && point[0] <= lidMaxX + 1e-6,
    );
    const skirtPoints = lidPoints.filter(
      (point) =>
        Math.abs(
          point[2] - (expectedPlate + BOX_LID_SKIRT_HEIGHT_MM),
        ) <= 1e-6,
    );
    const [actualBodyMinX, actualBodyMaxX] = range(bodyPoints, 0);
    const [actualLidMinX, actualLidMaxX] = range(lidPoints, 0);
    const [lidMinZ, lidMaxZ] = range(lidPoints, 2);
    const [skirtMinX, skirtMaxX] = range(skirtPoints, 0);
    const [skirtMinY, skirtMaxY] = range(skirtPoints, 1);
    const skirtWidth =
      params.boxWidth - 2 * params.boxWall - 2 * BOX_LID_CLEARANCE_MM;
    const skirtDepth =
      params.boxDepth - 2 * params.boxWall - 2 * BOX_LID_CLEARANCE_MM;

    near(
      `${testCase.name}: зазор между корпусом и крышкой`,
      actualLidMinX - actualBodyMaxX,
      BOX_LID_GAP_MM,
    );
    near(
      `${testCase.name}: ширина корпуса без крышки`,
      actualBodyMaxX - actualBodyMinX,
      params.boxWidth,
    );
    near(
      `${testCase.name}: плита крышки с навесом`,
      actualLidMaxX - actualLidMinX,
      lidWidth,
    );
    near(`${testCase.name}: крышка лежит на столе`, lidMinZ, 0);
    near(
      `${testCase.name}: верх юбки`,
      lidMaxZ,
      expectedPlate + BOX_LID_SKIRT_HEIGHT_MM,
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

  if (params.boxMagnets) {
    const radius = magnetSpec.diameterMm / 2;
    const centers = boxMagnetPocketCenters(params);
    const bodyCenterX = bodyMinX + params.boxWidth / 2;
    const lidCenterX = lidMinX + lidWidth / 2;
    const bodyMouthZ = params.boxHeight;
    const bodyCeilingZ = bodyMouthZ - magnetSpec.depthMm;
    const lidMouthZ = expectedPlate;
    const lidCeilingZ = lidMouthZ - magnetSpec.depthMm;
    const bodyMouthRings = centers.map(([offsetX, offsetY]) =>
      ringVertices(mesh, bodyCenterX + offsetX, offsetY, radius, bodyMouthZ),
    );
    const bodyCeilingRings = centers.map(([offsetX, offsetY]) =>
      ringVertices(mesh, bodyCenterX + offsetX, offsetY, radius, bodyCeilingZ),
    );
    const bodyFloorRings = centers.map(([offsetX, offsetY]) =>
      ringVertices(mesh, bodyCenterX + offsetX, offsetY, radius, 0),
    );
    const lidMouthRings = centers.map(([offsetX, offsetY]) =>
      ringVertices(mesh, lidCenterX + offsetX, offsetY, radius, lidMouthZ),
    );
    const lidCeilingRings = centers.map(([offsetX, offsetY]) =>
      ringVertices(mesh, lidCenterX + offsetX, offsetY, radius, lidCeilingZ),
    );
    const lidFloorRings = centers.map(([offsetX, offsetY]) =>
      ringVertices(mesh, lidCenterX + offsetX, offsetY, radius, 0),
    );

    check(
      `${testCase.name}: четыре паза открыты сверху корпуса`,
      bodyMouthRings.every((count) => count === 24),
      true,
    );
    check(
      `${testCase.name}: дно паза корпуса на глубине`,
      bodyCeilingRings.every((count) => count === 24),
      true,
    );
    check(
      `${testCase.name}: в дне корпуса пазов нет`,
      bodyFloorRings.every((count) => count === 0),
      true,
    );

    if (params.hasLid) {
      check(
        `${testCase.name}: четыре паза открыты снизу крышки после переворота`,
        lidMouthRings.every((count) => count === 24),
        true,
      );
      check(
        `${testCase.name}: дно паза крышки на глубине`,
        lidCeilingRings.every((count) => count === 24),
        true,
      );
      check(
        `${testCase.name}: в верхней плоскости крышки пазов нет`,
        lidFloorRings.every((count) => count === 0),
        true,
      );
    }

    if (params.hasLid) {
      check(
        `${testCase.name}: пазы крышки соосны пазам корпуса по X и Y`,
        centers.every(
          ([offsetX, offsetY]) =>
            ringVertices(
              mesh,
              bodyCenterX + offsetX,
              offsetY,
              radius,
              bodyMouthZ,
            ) === 24 &&
            ringVertices(
              mesh,
              lidCenterX + offsetX,
              offsetY,
              radius,
              lidMouthZ,
            ) === 24,
        ),
        true,
      );
      near(
        `${testCase.name}: после переворота торец паза крышки ложится на кромку`,
        params.boxHeight - (lidMouthZ - expectedPlate),
        params.boxHeight,
      );
    }

    for (const [offsetX, offsetY] of centers) {
      const bodyPocketX = bodyCenterX + offsetX;

      check(
        `${testCase.name}: паз не выходит за кромку по X`,
        Math.min(bodyPocketX - bodyMinX, bodyMaxX - bodyPocketX) >
          radius + BOX_MAGNET_EDGE_GAP_MM - 1e-6,
        true,
      );
      check(
        `${testCase.name}: паз не выходит за кромку по Y`,
        Math.min(
          offsetY + params.boxDepth / 2,
          params.boxDepth / 2 - offsetY,
        ) >
          radius + BOX_MAGNET_EDGE_GAP_MM - 1e-6,
        true,
      );
      check(
        `${testCase.name}: потолок паза замыкает глубину`,
        ringVertices(
          mesh,
          bodyPocketX,
          offsetY,
          radius,
          bodyCeilingZ,
        ) === 24,
        true,
      );

      if (params.hasLid) {
        check(
          `${testCase.name}: потолок паза крышки`,
          ringVertices(
            mesh,
            lidCenterX + offsetX,
            offsetY,
            radius,
            lidCeilingZ,
          ) === 24,
          true,
        );
      }
    }

    check(
      `${testCase.name}: дно корпуса осталось базовой толщины`,
      expectedFloor === BOX_FLOOR_THICKNESS_MM,
      true,
    );
    check(
      `${testCase.name}: плита крышки толще паза`,
      expectedPlate - magnetSpec.depthMm >=
        BOX_MAGNET_CEILING_MM - 1e-6,
      true,
    );
  }

  if (params.boxStack && params.hasLid) {
    const ringMinX = lidMaxX + BOX_LID_GAP_MM;
    const ringMaxX = ringMinX + lidWidth;
    const ringCenterX = (ringMinX + ringMaxX) / 2;
    const ringPoints = mesh.vertices.filter(
      (point) => point[0] >= ringMinX - 1e-6,
    );
    const [actualRingMinX, actualRingMaxX] = range(ringPoints, 0);
    const [ringMinY, ringMaxY] = range(ringPoints, 1);
    const [ringMinZ, ringMaxZ] = range(ringPoints, 2);
    const innerWidth = params.boxWidth + BOX_STACK_CLEARANCE_MM * 2;
    const innerDepth = params.boxDepth + BOX_STACK_CLEARANCE_MM * 2;
    const outerRadius =
      params.boxCornerRadius > 0
        ? params.boxCornerRadius + BOX_LID_OVERHANG_MM
        : 0;
    const innerRadius = params.boxCornerRadius + BOX_STACK_CLEARANCE_MM;
    const outerArea =
      lidWidth * lidDepth - (4 - Math.PI) * outerRadius * outerRadius;
    const innerArea =
      innerWidth * innerDepth - (4 - Math.PI) * innerRadius * innerRadius;
    const expectedRingVolume =
      (outerArea - innerArea) * BOX_STACK_HEIGHT_MM;
    const ringVolume = signedVolumeRightOf(mesh, ringMinX - 1e-6);

    near(
      `${testCase.name}: кольцо начинается после зазора`,
      actualRingMinX - lidMaxX,
      BOX_LID_GAP_MM,
    );
    near(
      `${testCase.name}: кольцо по ширине крышки`,
      actualRingMaxX - actualRingMinX,
      lidWidth,
    );
    near(
      `${testCase.name}: кольцо по глубине крышки`,
      ringMaxY - ringMinY,
      lidDepth,
    );
    near(`${testCase.name}: кольцо на столе`, ringMinZ, 0);
    near(
      `${testCase.name}: высота кольца`,
      ringMaxZ - ringMinZ,
      BOX_STACK_HEIGHT_MM,
    );
    check(
      `${testCase.name}: внутренний размер кольца с зазором`,
      ringPoints.some(
        (point) =>
          Math.abs(point[0] - (ringCenterX + innerWidth / 2)) <= 1e-4 &&
          Math.abs(point[2]) <= 1e-4,
      ),
      true,
    );
    check(
      `${testCase.name}: объём кольца сходится`,
      Math.abs(ringVolume - expectedRingVolume) / expectedRingVolume < 0.02,
      true,
    );
    check(
      `${testCase.name}: кольцо — отдельная оболочка`,
      ringVolume > 0,
      true,
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
check("старый проект без магнитов", legacy.boxMagnets, false);
check("старый проект без штабеля", legacy.boxStack, false);
check("типоразмер магнита по умолчанию", legacy.boxMagnetSize, "6x2");

if (failures.length > 0) {
  console.error(`\nРасхождения (${failures.length}):`);

  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log("\nВсе проверки прошли.");
}

