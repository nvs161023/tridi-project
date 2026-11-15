/**
 * Тест геометрии кашпо с дренажом, умной раскладкой и автополивом.
 *
 * Проверяет обязательства P0 и F1: ширина шестигранника 120 мм измеряется по
 * углам, поддон считается от реального габарита горшка, дно горшка плоское и
 * лежит на Z = 0, дренажные отверстия сквозные. Общий STL при 120 мм больше не
 * растягивается на 268 мм: горшок ставится на поддон, поэтому X/Y равны 136 мм.
 * Для автополива проверяются резервуар 26 мм, внутреннее дно +10 мм, сквозное
 * фитильное Ø 5 мм, открытая смотровая трубка и герметичность стенок. Отдельный
 * блок собирает бинарный STL набора и повторяет замеры уже по файлу.
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
  PLANTER_SIGHT_TUBE_INLET_GAP_MM,
  PLANTER_SIGHT_TUBE_OUTER_RADIUS_MM,
  createPlanterGeometry,
  createPlanterPotGeometry,
  createPlanterTrayGeometry,
  planterDrainHoleCenters,
  planterSightTube,
  planterWickHoleCenters,
} from "../lib/constructor/planter-geometry";
import {
  DEFAULT_PLANTER_PARAMS,
  PLANTER_PRINT_BED_MM,
  PLANTER_SELF_WATERING_INNER_FLOOR_MM,
  PLANTER_SELF_WATERING_RESERVOIR_DEPTH_MM,
  PLANTER_SELF_WATERING_TRAY_HEIGHT_MM,
  PLANTER_SIGHT_TUBE_HEIGHT_MM,
  PLANTER_TRAY_EXTRA_MM,
  PLANTER_TRAY_FLOOR_MM,
  PLANTER_TRAY_GAP_MM,
  PLANTER_TRAY_HEIGHT_MM,
  PLANTER_WICK_HOLE_RADIUS_MM,
  normalizePlanterParams,
  planterFootprint,
  planterLayout,
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

/** Радиус описанной окружности сечения: нужен для проверки смотровой трубки. */
function sectionCircumradius(shape: PlanterShape, width: number): number {
  if (shape === "round" || shape === "hex") {
    return width / 2;
  }

  return width / Math.SQRT2;
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

/** Площадь горизонтальных граней, смотрящих вверх, на плоскости `z`. */
function upFacingAreaAt(
  triangles: readonly Triangle[],
  z: number,
): number {
  return triangles.reduce((total, triangle) => {
    const normal = normalOf(triangle);

    if (
      normal[2] < 0.999 ||
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

function rayHitsFrom(
  triangles: readonly Triangle[],
  origin: Point3,
  direction: Point3,
): number {
  return triangles.filter((triangle) =>
    rayHitsTriangle(triangle, origin, direction),
  ).length;
}

function rayHits(triangles: readonly Triangle[], x: number, y: number): number {
  return rayHitsFrom(triangles, [x, y, -1], [0, 0, 1]);
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
near("поле печати", PLANTER_PRINT_BED_MM, 220);
near("высота поддона автополива", PLANTER_SELF_WATERING_TRAY_HEIGHT_MM, 28);
near(
  "глубина резервуара",
  PLANTER_SELF_WATERING_RESERVOIR_DEPTH_MM,
  26,
);
near("внутреннее дно", PLANTER_SELF_WATERING_INNER_FLOOR_MM, 10);
near("радиус фитиля", PLANTER_WICK_HOLE_RADIUS_MM, 2.5);
near("верх смотровой трубки", PLANTER_SIGHT_TUBE_HEIGHT_MM, 34);
check(
  "автополив выключен по умолчанию",
  DEFAULT_PLANTER_PARAMS.planterSelfWatering,
  false,
);

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
near("hex: bbox поддона Z", hexTrayBounds.height, PLANTER_TRAY_HEIGHT_MM);
check(
  "hex: поддон выше горшка по X",
  hexTrayBounds.width > hexPotBounds.width,
  true,
);

check("hex: раскладка вложенная", planterLayout(hexParams), "nested");
near("hex: боковая пара не влезает", hexFootprint.sideBySideWidth, 268);
near("hex: footprint набора X", hexFootprint.width, 136);
near(
  "hex: footprint набора Y",
  hexFootprint.depth,
  (136 * Math.sqrt(3)) / 2,
  1e-3,
);
near(
  "hex: footprint набора Z",
  hexFootprint.height,
  PLANTER_TRAY_HEIGHT_MM + HEIGHT,
);
near(
  "hex: горшок стоит на борту поддона",
  hexFootprint.potBottomZ,
  PLANTER_TRAY_HEIGHT_MM,
);
check("hex: общий файл помещается", hexFootprint.hasCommonFile, true);
check(
  "hex: общий файл не шире стола",
  hexFootprint.width <= PLANTER_PRINT_BED_MM,
  true,
);

hexPot.dispose();
hexTray.dispose();

console.log("\nОбщий STL: горшок на поддоне:");

const pair = createPlanterGeometry(hexParams, "all");
const pairTriangles = trianglesOf(pair);
const pairBounds = boundsOf(pairTriangles);

near("набор: ширина", pairBounds.width, 136, 1e-3);
near(
  "набор: глубина",
  pairBounds.depth,
  (136 * Math.sqrt(3)) / 2,
  1e-3,
);
near(
  "набор: высота",
  pairBounds.height,
  PLANTER_TRAY_HEIGHT_MM + HEIGHT,
  1e-3,
);
near("набор: низ на Z = 0", pairBounds.minZ, 0, 1e-6);
near("набор: центр X", (pairBounds.minX + pairBounds.maxX) / 2, 0);
check(
  "набор: X меньше 220",
  pairBounds.width < PLANTER_PRINT_BED_MM,
  true,
);
check(
  "набор: Y меньше 220",
  pairBounds.depth < PLANTER_PRINT_BED_MM,
  true,
);
check(
  "набор: горшок поднят над поддоном",
  hexFootprint.potBottomZ >= PLANTER_TRAY_HEIGHT_MM,
  true,
);

console.log("\nМалая пара остаётся рядом с зазором:");

const sideParams = normalizePlanterParams({
  ...hexParams,
  planterSize: 90,
  planterHeight: 80,
});
const sideFootprint = planterFootprint(sideParams);
const sidePair = createPlanterGeometry(sideParams, "all");
const sideTriangles = trianglesOf(sidePair);
const sideBounds = boundsOf(sideTriangles);
const sideLeft = sideTriangles.filter(
  (triangle) =>
    (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3 < 0,
);
const sideRight = sideTriangles.filter(
  (triangle) =>
    (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3 >= 0,
);
const sideLeftBounds = boundsOf(sideLeft);
const sideRightBounds = boundsOf(sideRight);

check("90 мм: раскладка боковая", planterLayout(sideParams), "side");
near("90 мм: ширина набора", sideBounds.width, 208, 1e-3);
near("90 мм: footprint X", sideFootprint.width, 208, 1e-3);
near("90 мм: высота набора", sideBounds.height, 80);
near(
  "90 мм: фактический зазор",
  sideRightBounds.minX - sideLeftBounds.maxX,
  PLANTER_TRAY_GAP_MM,
  1e-3,
);
check(
  "90 мм: детали не пересекаются",
  sideRightBounds.minX > sideLeftBounds.maxX,
  true,
);
check(
  "90 мм: все треугольники разложены",
  sideLeft.length + sideRight.length,
  sideTriangles.length,
);

sidePair.dispose();

console.log("\nАвтополив: резервуар, фитиль и индикатор:");

const selfParams = normalizePlanterParams({
  ...hexParams,
  planterSelfWatering: true,
  planterDrainage: false,
});
const selfFootprint = planterFootprint(selfParams);
const selfPot = createPlanterPotGeometry(selfParams);
const selfTray = createPlanterTrayGeometry(selfParams);
const selfPotTriangles = trianglesOf(selfPot);
const selfTrayTriangles = trianglesOf(selfTray);
const selfPotBounds = boundsOf(selfPotTriangles);
const selfTrayBounds = boundsOf(selfTrayTriangles);
const selfPair = createPlanterGeometry(selfParams, "all");
const selfPairBounds = boundsOf(trianglesOf(selfPair));
const tube = planterSightTube(selfParams);

check("автополив включает дренаж", selfParams.planterDrainage, true);
check("автополив включён", selfParams.planterSelfWatering, true);
near("автополив: глубина резервуара", selfFootprint.reservoirDepth, 26);
near("автополив: высота горшка", selfPotBounds.height, HEIGHT);
check(
  "автополив: внутреннее дно на +10 мм",
  upFacingAreaAt(selfPotTriangles, PLANTER_SELF_WATERING_INNER_FLOOR_MM) >
    5_000,
  true,
);
near(
  "автополив: фитильное отверстие в центре",
  planterWickHoleCenters(selfParams).length,
  1,
);
check(
  "автополив: луч через фитиль свободен",
  rayHits(selfPotTriangles, 0, 0),
  0,
);
check(
  "автополив: внутреннее дно не дырявое",
  rayHits(selfPotTriangles, 20, 0) > 0,
  true,
);
near(
  "автополив: поддон выше обычного",
  selfTrayBounds.height,
  PLANTER_SIGHT_TUBE_HEIGHT_MM,
);
near(
  "автополив: борт резервуара",
  selfFootprint.trayBodyHeight,
  PLANTER_SELF_WATERING_TRAY_HEIGHT_MM,
);
check("автополив: трубка есть", tube !== null, true);
check(
  "автополив: трубка выше воды",
  (tube?.z1 ?? 0) > PLANTER_SELF_WATERING_TRAY_HEIGHT_MM,
  true,
);
check(
  "автополив: трубка открыта снизу",
  tube?.z0 === PLANTER_TRAY_FLOOR_MM + PLANTER_SIGHT_TUBE_INLET_GAP_MM,
  true,
);
check(
  "автополив: канал трубки не перекрыт",
  tube
    ? rayHitsFrom(
        selfTrayTriangles,
        [tube.centerX, tube.centerY, tube.z0 + 0.25],
        [0, 0, 1],
      ) === 0
    : false,
  true,
);

const tubeRadius = Math.hypot(tube?.centerX ?? 0, tube?.centerY ?? 0);
const tubeInnerEdge = tubeRadius - (tube?.innerRadius ?? 0);
const tubeOuterEdge = tubeRadius + (tube?.outerRadius ?? 0);

check(
  "автополив: трубка не задевает горшок",
  tubeInnerEdge > sectionCircumradius(selfParams.planterShape, SIZE),
  true,
);
check(
  "автополив: трубка не прорезает внешнюю стенку",
  tubeOuterEdge < (SIZE + PLANTER_TRAY_EXTRA_MM) / 2,
  true,
);
near(
  "автополив: радиус трубки",
  tube?.outerRadius ?? 0,
  PLANTER_SIGHT_TUBE_OUTER_RADIUS_MM,
);
near("автополив: набор X", selfPairBounds.width, 136, 1e-3);
near(
  "автополив: набор Y",
  selfPairBounds.depth,
  (136 * Math.sqrt(3)) / 2,
  1e-3,
);
near(
  "автополив: набор Z",
  selfPairBounds.height,
  PLANTER_SELF_WATERING_TRAY_HEIGHT_MM + HEIGHT,
  1e-3,
);
near("автополив: набор на столе", selfPairBounds.minZ, 0, 1e-6);
check(
  "автополив: набор уже 220",
  selfPairBounds.width < PLANTER_PRINT_BED_MM &&
    selfPairBounds.depth < PLANTER_PRINT_BED_MM,
  true,
);
check(
  "автополив: горшок выше упоров",
  selfFootprint.potBottomZ >= PLANTER_SELF_WATERING_TRAY_HEIGHT_MM,
  true,
);
check(
  "автополив: поддон не пропускает воду",
  rayHits(selfTrayTriangles, 0, 0) > 0,
  true,
);

let selfTrayWallsClosed = true;

for (const z of [6, 13, 20, 26]) {
  for (let index = 0; index < 32; index += 1) {
    const angle = 0.07 + (Math.PI * 2 * index) / 32;
    const hits = rayHitsFrom(
      selfTrayTriangles,
      [0, 0, z],
      [Math.cos(angle), Math.sin(angle), 0],
    );

    if (hits < 2) {
      selfTrayWallsClosed = false;
    }
  }
}

check(
  "автополив: стенки резервуара непрерывны",
  selfTrayWallsClosed,
  true,
);

let selfTrayBottomClosed = true;

for (let x = -36; x <= 36; x += 12) {
  for (let y = -36; y <= 36; y += 12) {
    if (rayHits(selfTrayTriangles, x, y) < 1) {
      selfTrayBottomClosed = false;
    }
  }
}

check(
  "автополив: дно резервуара без сквозных щелей",
  selfTrayBottomClosed,
  true,
);

let selfPotWallsClosed = true;

for (const z of [20, 50]) {
  for (let index = 0; index < 32; index += 1) {
    const angle = 0.07 + (Math.PI * 2 * index) / 32;
    const hits = rayHitsFrom(
      selfPotTriangles,
      [0, 0, z],
      [Math.cos(angle), Math.sin(angle), 0],
    );

    if (hits < 2) {
      selfPotWallsClosed = false;
    }
  }
}

check("автополив: стенки горшка целые", selfPotWallsClosed, true);

selfPot.dispose();
selfTray.dispose();
selfPair.dispose();


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
near("part all: ширина", allBounds.width, 136, 1e-3);
near(
  "part all: высота",
  allBounds.height,
  PLANTER_TRAY_HEIGHT_MM + HEIGHT,
  1e-3,
);
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

console.log("\nSTL набора с автополивом 120 мм (hex):");

const selfStlName = planterStlFileName(selfParams, "all");
const selfStlPath = join(stlDirectory, selfStlName);
const selfStlTriangles = exportStl(
  createPlanterGeometry(selfParams, "all"),
  selfStlPath,
);
const selfStlBounds = boundsOf(selfStlTriangles);

check(
  "STL автополива: имя с суффиксом",
  selfStlName.includes("-avtopoliv-set.stl"),
  true,
);
near("STL автополива: ширина", selfStlBounds.width, 136, 1e-4);
near(
  "STL автополива: глубина",
  selfStlBounds.depth,
  (136 * Math.sqrt(3)) / 2,
  1e-3,
);
near(
  "STL автополива: высота",
  selfStlBounds.height,
  PLANTER_SELF_WATERING_TRAY_HEIGHT_MM + HEIGHT,
  1e-3,
);
near("STL автополива: низ на Z = 0", selfStlBounds.minZ, 0, 1e-6);
check(
  "STL автополива: влезает в 220",
  selfStlBounds.width < PLANTER_PRINT_BED_MM &&
    selfStlBounds.depth < PLANTER_PRINT_BED_MM,
  true,
);

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
      "поддон 136 × 117.85 × 14 мм, набор 136 × 117.85 × 124 мм, " +
      "автополив 136 × 117.85 × 138 мм, резервуар 26 мм.",
  );
}
