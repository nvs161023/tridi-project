/**
 * Тест геометрии кашпо с дренажом и поддоном.
 *
 * Проверяет обязательства P0: ширина шестигранника 120 мм измеряется по углам,
 * поддон считается от реального габарита горшка и стоит с зазором 12 мм, дно
 * горшка плоское и лежит на Z = 0, дренажные отверстия сквозные, а детали
 * `pot`, `tray` и `all` действительно разделяются. Отдельный блок собирает
 * настоящий бинарный STL горшка 120 мм (hex) и повторяет замеры уже по файлу.
 *
 * Запуск:
 *   npm run check:planter
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import { Mesh } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PLANTER_DRAIN_HOLE_RADIUS_MM,
  createPlanterGeometry,
  createPlanterPotGeometry,
  createPlanterTrayGeometry,
  planterDrainHoleCenters,
} from "../lib/constructor/planter-geometry";
import {
  DEFAULT_PLANTER_PARAMS,
  PLANTER_TRAY_EXTRA_MM,
  PLANTER_TRAY_GAP_MM,
  PLANTER_TRAY_HEIGHT_MM,
  normalizePlanterParams,
  planterFootprint,
  planterStlFileName,
  type PlanterShape,
} from "../lib/constructor/params";

type Point3 = readonly [number, number, number];
type Triangle = readonly [Point3, Point3, Point3];

const failures: string[] = [];
const SIZE = 120;
const WALL = 2;
const HEIGHT = 110;

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

function near(
  name: string,
  actual: number,
  expected: number,
  tolerance = 1e-4,
): void {
  const passed = Math.abs(actual - expected) <= tolerance;

  if (!passed) {
    failures.push(
      `${name}: получено ${actual.toFixed(6)}, ожидалось ${expected.toFixed(6)}`,
    );
  }

  console.log(
    `  ${passed ? "✓" : "✗"} ${name}` +
      (passed
        ? ""
        : ` — ${actual.toFixed(6)} вместо ${expected.toFixed(6)}`),
  );
}

function trianglesOf(geometry: ReturnType<typeof createPlanterGeometry>) {
  const position = geometry.getAttribute("position");
  const triangles: Triangle[] = [];

  for (let offset = 0; offset < position.count; offset += 3) {
    triangles.push([
      [position.getX(offset), position.getY(offset), position.getZ(offset)],
      [
        position.getX(offset + 1),
        position.getY(offset + 1),
        position.getZ(offset + 1),
      ],
      [
        position.getX(offset + 2),
        position.getY(offset + 2),
        position.getZ(offset + 2),
      ],
    ]);
  }

  return triangles;
}

function boundsOf(triangles: readonly Triangle[]) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const triangle of triangles) {
    for (const [x, y, z] of triangle) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }

  return {
    width: maxX - minX,
    depth: maxY - minY,
    height: maxZ - minZ,
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
  };
}

function normalOf([a, b, c]: Triangle): Point3 {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz);

  return [nx / length, ny / length, nz / length];
}

function triangleArea([a, b, c]: Triangle): number {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];

  return (
    Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) /
    2
  );
}

/**
 * Площадь горизонтальных граней, смотрящих вниз, на плоскости `z`.
 *
 * У плоского дна все такие грани лежат на Z = 0. Если вернуть мост, появится
 * вторая плоскость выше стола — тест это поймает.
 */
function downFacingAreaAt(
  triangles: readonly Triangle[],
  z: number,
): number {
  return triangles.reduce((total, triangle) => {
    const normal = normalOf(triangle);

    if (
      normal[2] > -0.999 ||
      !triangle.every((point) => Math.abs(point[2] - z) <= 1e-6)
    ) {
      return total;
    }

    return total + triangleArea(triangle);
  }, 0);
}

/** Есть ли у детали нижние грани, висящие над столом. */
function hasFloatingFloor(triangles: readonly Triangle[]): boolean {
  return triangles.some((triangle) => {
    const normal = normalOf(triangle);

    return (
      normal[2] < -0.999 &&
      triangle.every((point) => point[2] > 1e-6)
    );
  });
}

/** Пересекает ли луч треугольник (Möller–Trumbore). */
function rayHitsTriangle(
  triangle: Triangle,
  origin: Point3,
  direction: Point3,
): boolean {
  const [ax, ay, az] = triangle[0];
  const [bx, by, bz] = triangle[1];
  const [cx, cy, cz] = triangle[2];
  const e1x = bx - ax;
  const e1y = by - ay;
  const e1z = bz - az;
  const e2x = cx - ax;
  const e2y = cy - ay;
  const e2z = cz - az;
  const [dx, dy, dz] = direction;
  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const determinant = e1x * px + e1y * py + e1z * pz;

  if (Math.abs(determinant) < 1e-9) {
    return false;
  }

  const inverse = 1 / determinant;
  const tx = origin[0] - ax;
  const ty = origin[1] - ay;
  const tz = origin[2] - az;
  const u = (tx * px + ty * py + tz * pz) * inverse;

  if (u < 0 || u > 1) {
    return false;
  }

  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inverse;

  if (v < 0 || u + v > 1) {
    return false;
  }

  return (e2x * qx + e2y * qy + e2z * qz) * inverse > 1e-6;
}

function rayHits(triangles: readonly Triangle[], x: number, y: number): number {
  return triangles.filter((triangle) =>
    rayHitsTriangle(triangle, [x, y, -1], [0, 0, 1]),
  ).length;
}


/** Бинарный STL в треугольники: замеры по файлу, а не по BufferGeometry. */
function readBinaryStl(buffer: Buffer): Triangle[] {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  const count = view.getUint32(80, true);
  const triangles: Triangle[] = [];
  let offset = 84;

  for (let index = 0; index < count; index += 1) {
    offset += 12;

    const vertices: Point3[] = [];

    for (let vertex = 0; vertex < 3; vertex += 1) {
      vertices.push([
        view.getFloat32(offset, true),
        view.getFloat32(offset + 4, true),
        view.getFloat32(offset + 8, true),
      ]);
      offset += 12;
    }

    offset += 2;
    triangles.push(vertices as unknown as Triangle);
  }

  return triangles;
}

/** Экспорт геометрии тем же STLExporter, что и API, и повторное чтение файла. */
function exportStl(
  geometry: ReturnType<typeof createPlanterGeometry>,
  path: string,
): Triangle[] {
  const mesh = new Mesh(geometry);

  mesh.updateMatrixWorld(true);

  const exported = new STLExporter().parse(mesh, { binary: true });
  const view = exported as DataView;

  writeFileSync(
    path,
    Buffer.from(view.buffer, view.byteOffset, view.byteLength),
  );

  return readBinaryStl(readFileSync(path));
}

console.log("Параметры и константы:");

check(
  "части набора в имени файла",
  [
    planterStlFileName(DEFAULT_PLANTER_PARAMS, "pot"),
    planterStlFileName(DEFAULT_PLANTER_PARAMS, "tray"),
    planterStlFileName(DEFAULT_PLANTER_PARAMS, "all"),
  ]
    .map((name) => name.match(/-(pot|tray|set)\.stl$/)?.[1])
    .join(","),
  "pot,tray,set",
);
near("зазор пары", PLANTER_TRAY_GAP_MM, 12);
near("запас поддона", PLANTER_TRAY_EXTRA_MM, 16);
near("высота поддона", PLANTER_TRAY_HEIGHT_MM, 14);
near("радиус отверстия", PLANTER_DRAIN_HOLE_RADIUS_MM, 2.5);

console.log("\nГабариты горшка по формам:");

const SHAPES: readonly PlanterShape[] = ["round", "square", "hex"];

for (const shape of SHAPES) {
  const pot = createPlanterPotGeometry({
    ...DEFAULT_PLANTER_PARAMS,
    planterSize: SIZE,
    planterHeight: HEIGHT,
    planterWall: WALL,
    planterShape: shape,
  });
  const bounds = boundsOf(trianglesOf(pot));
  const expectedDepth = shape === "hex" ? (SIZE * Math.sqrt(3)) / 2 : SIZE;

  near(`${shape}: ширина`, bounds.width, SIZE);
  near(`${shape}: глубина`, bounds.depth, expectedDepth, 1e-3);
  near(`${shape}: высота`, bounds.height, HEIGHT);
  near(`${shape}: низ на столе`, bounds.minZ, 0);

  pot.dispose();
}

console.log("\nПоддон считается от реального габарита:");

const hexParams = normalizePlanterParams({
  ...DEFAULT_PLANTER_PARAMS,
  planterSize: SIZE,
  planterHeight: HEIGHT,
  planterWall: WALL,
  planterShape: "hex",
});
const hexFootprint = planterFootprint(hexParams);
const hexPot = createPlanterPotGeometry(hexParams);
const hexTray = createPlanterTrayGeometry(hexParams);
const hexPotBounds = boundsOf(trianglesOf(hexPot));
const hexTrayBounds = boundsOf(trianglesOf(hexTray));

near("hex: bbox горшка X", hexPotBounds.width, SIZE);
near(
  "hex: bbox горшка Y",
  hexPotBounds.depth,
  (SIZE * Math.sqrt(3)) / 2,
  1e-3,
);
near("hex: bbox поддона X", hexTrayBounds.width, SIZE + PLANTER_TRAY_EXTRA_MM);
near(
  "hex: bbox поддона Y",
  hexTrayBounds.depth,
  ((SIZE + PLANTER_TRAY_EXTRA_MM) * Math.sqrt(3)) / 2,
  1e-3,
);
check(
  "hex: поддон выше горшка по X",
  hexTrayBounds.width > hexPotBounds.width,
  true,
);
near(
  "hex: footprint пары X",
  hexFootprint.width,
  SIZE + PLANTER_TRAY_GAP_MM + SIZE + PLANTER_TRAY_EXTRA_MM,
);
near("hex: высота пары", hexFootprint.height, HEIGHT);

hexPot.dispose();
hexTray.dispose();


console.log("\nОбщий STL: горшок и поддон рядом:");

const pair = createPlanterGeometry(hexParams, "all");
const pairTriangles = trianglesOf(pair);
const pairBounds = boundsOf(pairTriangles);
const leftTriangles = pairTriangles.filter(
  (triangle) =>
    (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3 < 0,
);
const rightTriangles = pairTriangles.filter(
  (triangle) =>
    (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3 >= 0,
);
const leftBounds = boundsOf(leftTriangles);
const rightBounds = boundsOf(rightTriangles);

near("пара: ширина", pairBounds.width, 268, 1e-3);
near(
  "пара: глубина",
  pairBounds.depth,
  ((SIZE + PLANTER_TRAY_EXTRA_MM) * Math.sqrt(3)) / 2,
  1e-3,
);
near("пара: высота", pairBounds.height, HEIGHT);
near("пара: центр X", (pairBounds.minX + pairBounds.maxX) / 2, 0);
near("пара: горшок слева", leftBounds.width, SIZE, 1e-3);
near(
  "пара: поддон справа",
  rightBounds.width,
  SIZE + PLANTER_TRAY_EXTRA_MM,
  1e-3,
);
near(
  "пара: фактический зазор",
  rightBounds.minX - leftBounds.maxX,
  PLANTER_TRAY_GAP_MM,
  1e-3,
);
check(
  "пара: горшок и поддон не пересекаются",
  rightBounds.minX - leftBounds.maxX > 0,
  true,
);
check(
  "пара: все треугольники разложены по двум деталям",
  leftTriangles.length + rightTriangles.length,
  pairTriangles.length,
);

console.log("\nПлоское дно и сквозной дренаж:");

const potTriangles = trianglesOf(createPlanterPotGeometry(hexParams));
const potBounds = boundsOf(potTriangles);
const potDownArea = downFacingAreaAt(potTriangles, 0);

near("горшок: низ на Z = 0", potBounds.minZ, 0);
check("горшок: моста над столом нет", hasFloatingFloor(potTriangles), false);
check("горшок: площадь первого слоя", potDownArea > 8_000, true);

const trayTriangles = trianglesOf(createPlanterTrayGeometry(hexParams));
const trayBounds = boundsOf(trayTriangles);
const trayDownArea = downFacingAreaAt(trayTriangles, 0);

near("поддон: низ на Z = 0", trayBounds.minZ, 0);
check("поддон: моста над столом нет", hasFloatingFloor(trayTriangles), false);
check("поддон: площадь первого слоя", trayDownArea > 10_000, true);

const holeCenters = planterDrainHoleCenters(hexParams);

check("дренаж: центральное и кольцевые отверстия", holeCenters.length, 7);

for (const [index, [x, y]] of holeCenters.entries()) {
  check(
    `дренаж: луч ${index + 1} проходит сквозь дно`,
    rayHits(potTriangles, x, y),
    0,
  );
}

const solidPot = createPlanterPotGeometry({
  ...hexParams,
  planterDrainage: false,
});
const solidTriangles = trianglesOf(solidPot);
const solidBounds = boundsOf(solidTriangles);
const solidFootprint = planterFootprint({
  ...hexParams,
  planterDrainage: false,
});

check("без дренажа: моста нет", hasFloatingFloor(solidTriangles), false);
near("без дренажа: ширина горшка", solidBounds.width, SIZE);
check("без дренажа: поддона в паре нет", solidFootprint.hasTray, false);
near("без дренажа: ширина пары", solidFootprint.width, SIZE);

console.log("\nРазделение деталей:");

const potOnlyBounds = boundsOf(
  trianglesOf(createPlanterGeometry(hexParams, "pot")),
);
const trayOnlyBounds = boundsOf(
  trianglesOf(createPlanterGeometry(hexParams, "tray")),
);
const allBounds = boundsOf(trianglesOf(createPlanterGeometry(hexParams, "all")));

near("part pot: ширина", potOnlyBounds.width, SIZE);
near(
  "part tray: ширина",
  trayOnlyBounds.width,
  SIZE + PLANTER_TRAY_EXTRA_MM,
);
near("part all: ширина", allBounds.width, 268, 1e-3);
near("part pot: центр X", (potOnlyBounds.minX + potOnlyBounds.maxX) / 2, 0);
near("part tray: центр X", (trayOnlyBounds.minX + trayOnlyBounds.maxX) / 2, 0);

console.log("\nSTL горшка 120 мм (hex):");

const stlDirectory = mkdtempSync(join(tmpdir(), "tridi-planter-"));
const stlPath = join(stlDirectory, planterStlFileName(hexParams, "pot"));
const stlTriangles = exportStl(createPlanterPotGeometry(hexParams), stlPath);
const stlBounds = boundsOf(stlTriangles);
const stlDownArea = downFacingAreaAt(stlTriangles, 0);

check(
  "STL: имя отдельного горшка",
  planterStlFileName(hexParams, "pot").endsWith("-pot.stl"),
  true,
);
near("STL: ширина ровно 120 мм", stlBounds.width, SIZE, 1e-4);
near(
  "STL: глубина hex",
  stlBounds.depth,
  (SIZE * Math.sqrt(3)) / 2,
  1e-3,
);
near("STL: высота", stlBounds.height, HEIGHT, 1e-3);
near("STL: низ на Z = 0", stlBounds.minZ, 0, 1e-6);
check("STL: моста над столом нет", hasFloatingFloor(stlTriangles), false);
check("STL: площадь первого слоя", stlDownArea > 8_000, true);

rmSync(stlDirectory, { recursive: true, force: true });

pair.dispose();
solidPot.dispose();

if (failures.length > 0) {
  console.log(`\nПровалено проверок: ${failures.length}`);

  for (const failure of failures) {
    console.log(`  ✗ ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log(
    "\nВсе проверки геометрии кашпо прошли: hex 120 × 103.92 × 110 мм, " +
      "поддон 136 × 117.85 × 14 мм, дно плоское, зазор 12 мм.",
  );
}
