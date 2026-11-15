/**
 * Тест геометрии подставки под кружку.
 *
 * Проверяет обещания новой модели: низ плоский и лежит на Z = 0, верхний край
 * срезан фаской 1.5 × 1.5 мм под 45°, узор углублён ровно на 1.2 мм и не
 * доходит до фаски. Объём меша сравнивается с аналитическим объёмом верхней
 * поверхности, а для сот ещё собирается настоящий бинарный STL: габарит,
 * число треугольников, объём и отсутствие нависаний проверяются уже по файлу.
 *
 * Отдельный блок проверяет вертикальный держатель: размеры гнёзд и зазор,
 * заднюю стенку 60 мм, глубину по фактическому AABB, замкнутость сетки,
 * аналитический объём, все варианты 4/6/8 и толщины 3–10 мм, собственный STL,
 * а также отсутствие пересечения подставки с пластиком держателя для круга и
 * гекса. Общий STL набора проверяется отдельно: подставка и держатель должны
 * лежать двумя непересекающимися оболочками, а для шести гексов ещё и влезать
 * в поле 220 мм.
 *
 * Запуск:
 *   npm run check:coaster
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import { Mesh } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  COASTER_ACCUMULATOR_BASE_THICKNESS_MM,
  COASTER_ACCUMULATOR_POST_DIAMETER_MM,
  COASTER_ACCUMULATOR_POST_GAP_MM,
  COASTER_ACCUMULATOR_POST_RING_CLEARANCE_MM,
  COASTER_ACCUMULATOR_STACK_CLEARANCE_MM,
  COASTER_ACCUMULATOR_TOP_HEADROOM_MM,
  COASTER_BEVEL_MM,
  COASTER_HOLDER_BASE_MARGIN_MM,
  COASTER_HOLDER_BASE_THICKNESS_MM,
  COASTER_HOLDER_DIVIDER_FRONT_CLEARANCE_MM,
  COASTER_HOLDER_DIVIDER_HEIGHT_MM,
  COASTER_HOLDER_DIVIDER_THICKNESS_MM,
  COASTER_HOLDER_SLOT_CLEARANCE_MM,
  COASTER_HOLDER_WALL_HEIGHT_MM,
  COASTER_PATTERN_DEPTH_MM,
  COASTER_PATTERN_MARGIN_MM,
  COASTER_RIM_RISE_MM,
  COASTER_RIM_WALL_MM,
  COASTER_SET_BED_HEIGHT_MM,
  COASTER_SET_BED_MM,
  COASTER_SET_PART_GAP_MM,
  coasterAnalyticVolumeMm3,
  coasterAnalyticWeightGrams,
  coasterHolderAnalyticVolumeMm3,
  coasterHolderAnalyticWeightGrams,
  coasterHolderDimensionsMm,
  coasterPlacementInHolderMm,
  coasterSetHolderOffsetMm,
  createCoasterGeometry,
  createCoasterHolderGeometry,
  createCoasterSetGeometry,
} from "../lib/constructor/coaster-geometry";
import {
  PLA_DENSITY_G_PER_CM3,
  calculateGeometryVolumeMm3,
  calculateGeometryWeightGrams,
} from "../lib/constructor/geometry-volume";
import {
  COASTER_HOLDER_STYLE_LABELS,
  COASTER_HOLDER_STYLES,
  COASTER_PATTERNS,
  DEFAULT_COASTER_PARAMS,
  coasterHolderStlFileName,
  coasterSetStlFileName,
  coasterStlFileName,
  normalizeCoasterParams,
  type CoasterParams,
} from "../lib/constructor/params";

type Point3 = readonly [number, number, number];
type Triangle = readonly [Point3, Point3, Point3];
type IdTriangle = readonly [number, number, number];

const failures: string[] = [];
const BOTTOM_Z = 0;

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

function trianglesOf(
  geometry: ReturnType<typeof createCoasterGeometry>,
): Triangle[] {
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

type AxisAlignedBox = ReturnType<typeof boundsOf>;

/**
 * Пересечение двух ограничивающих боксов.
 *
 * Касание плоскостями не считается пересечением: плита стоит низом на
 * основании, и общая граница Z не должна ронять тест.
 */
function boxesIntersect(a: AxisAlignedBox, b: AxisAlignedBox): boolean {
  const epsilon = 1e-6;

  return (
    a.minX < b.maxX - epsilon &&
    b.minX < a.maxX - epsilon &&
    a.minY < b.maxY - epsilon &&
    b.minY < a.maxY - epsilon &&
    a.minZ < b.maxZ - epsilon &&
    b.minZ < a.maxZ - epsilon
  );
}

function box(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
): AxisAlignedBox {
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

function signedVolumeOf(triangles: readonly Triangle[]): number {
  let total = 0;

  for (const [a, b, c] of triangles) {
    total +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }

  return total / 6;
}

function volumeOf(triangles: readonly Triangle[]): number {
  return Math.abs(signedVolumeOf(triangles));
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
    Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2
  );
}

/**
 * Минимум без spread.
 *
 * У плотной сетки Ø100 больше ста тысяч вершин, и `Math.min(...points)` здесь
 * переполняет стек вызовов. Один проход по массиву считает то же значение без
 * риска.
 */
function minOf(values: readonly number[]): number {
  let minimum = Number.POSITIVE_INFINITY;

  for (const value of values) {
    minimum = Math.min(minimum, value);
  }

  return minimum;
}

/** Максимум без spread по тем же причинам, что и `minOf`. */
function maxOf(values: readonly number[]): number {
  let maximum = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    maximum = Math.max(maximum, value);
  }

  return maximum;
}
function weld(triangles: readonly Triangle[]): {
  vertices: Point3[];
  triangles: IdTriangle[];
} {
  const lookup = new Map<string, number>();
  const vertices: Point3[] = [];
  const welded: IdTriangle[] = [];
  const epsilon = 1e-6;

  const idOf = (point: Point3): number => {
    const key = point.map((value) => Math.round(value / epsilon)).join(":");
    const known = lookup.get(key);

    if (known !== undefined) {
      return known;
    }

    const id = vertices.length;
    lookup.set(key, id);
    vertices.push(point);

    return id;
  };

  for (const triangle of triangles) {
    welded.push([idOf(triangle[0]), idOf(triangle[1]), idOf(triangle[2])]);
  }

  return { vertices, triangles: welded };
}

function openEdges(triangles: readonly Triangle[]): number {
  const mesh = weld(triangles);
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

function degenerateTriangles(triangles: readonly Triangle[]): number {
  return triangles.filter((triangle) => triangleArea(triangle) <= 1e-10)
    .length;
}

function nanVertices(triangles: readonly Triangle[]): number {
  return triangles
    .flat()
    .filter((point) => point.some((value) => !Number.isFinite(value))).length;
}

function bottomTriangles(triangles: readonly Triangle[]): Triangle[] {
  return triangles.filter((triangle) =>
    triangle.every((point) => Math.abs(point[2] - BOTTOM_Z) <= 1e-7),
  );
}

/**
 * Нависания больше 45° с учётом опорных плоскостей.
 *
 * Горизонтальная грань, лежащая на столе или на уже напечатанной поверхности,
 * нависанием не является: её печатает первый слой над опорой. По умолчанию
 * опорой считается только `Z = 0`; накопитель добавляет верх основания, на
 * котором стоят стойки.
 */
function overhangTriangles(
  triangles: readonly Triangle[],
  supportPlanes: readonly number[] = [BOTTOM_Z],
): Triangle[] {
  return triangles.filter((triangle) => {
    const normal = normalOf(triangle);

    if (normal[2] >= 0) {
      return false;
    }

    const supported = triangle.every((point) =>
      supportPlanes.some((plane) => Math.abs(point[2] - plane) <= 1e-7),
    );

    if (supported) {
      return false;
    }

    // Нависание больше 45° — нормаль, наклонённая вниз сильнее, чем cos 45°.
    return normal[2] < -Math.SQRT1_2;
  });
}

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

console.log("Параметры и узоры:");

check(
  "COASTER_PATTERNS",
  COASTER_PATTERNS.join(","),
  "smooth,waves,honeycomb",
);
check("узор по умолчанию", DEFAULT_COASTER_PARAMS.coasterPattern, "smooth");
near("фаска", COASTER_BEVEL_MM, 1.5);
near("глубина узора", COASTER_PATTERN_DEPTH_MM, 1.2);
near("отступ узора", COASTER_PATTERN_MARGIN_MM, 2);
near("бортик: стенка", COASTER_RIM_WALL_MM, 3);
near("бортик: подъём", COASTER_RIM_RISE_MM, 2.5);

const cases: ReadonlyArray<{
  name: string;
  params: Partial<CoasterParams>;
}> = [
  {
    name: "круг Ø100, гладкая, бортик",
    params: {
      coasterSize: 100,
      coasterThickness: 5,
      coasterShape: "round",
      coasterPattern: "smooth",
      coasterRim: true,
    },
  },
  {
    name: "круг Ø100, волны, бортик",
    params: {
      coasterSize: 100,
      coasterThickness: 5,
      coasterShape: "round",
      coasterPattern: "waves",
      coasterRim: true,
    },
  },
  {
    name: "круг Ø100, соты, бортик",
    params: {
      coasterSize: 100,
      coasterThickness: 5,
      coasterShape: "round",
      coasterPattern: "honeycomb",
      coasterRim: true,
    },
  },
  {
    name: "квадрат 100, волны",
    params: {
      coasterSize: 100,
      coasterThickness: 5,
      coasterShape: "square",
      coasterPattern: "waves",
      coasterRim: true,
    },
  },
  {
    name: "гекс 100, соты",
    params: {
      coasterSize: 100,
      coasterThickness: 5,
      coasterShape: "hex",
      coasterPattern: "honeycomb",
      coasterRim: true,
    },
  },
  {
    name: "круг Ø100, соты, без бортика",
    params: {
      coasterSize: 100,
      coasterThickness: 5,
      coasterShape: "round",
      coasterPattern: "honeycomb",
      coasterRim: false,
    },
  },
];

console.log("\nГабариты, плоский низ, топология и объём:");

for (const testCase of cases) {
  const params = normalizeCoasterParams(testCase.params);
  const geometry = createCoasterGeometry(params);
  const triangles = trianglesOf(geometry);
  const vertices = triangles.flat();
  const bounds = boundsOf(triangles);
  const meshVolume = calculateGeometryVolumeMm3(geometry);
  const analyticVolume = coasterAnalyticVolumeMm3(params);
  const bottom = bottomTriangles(triangles);
  const apothem = params.coasterSize / 2;
  const faceApothem = params.coasterRim
    ? apothem - COASTER_RIM_WALL_MM
    : apothem - COASTER_BEVEL_MM;
  const patternApothem = faceApothem - COASTER_PATTERN_MARGIN_MM;
  const relief = vertices.filter(
    (point) =>
      point[2] > BOTTOM_Z + 1e-7 &&
      point[2] < params.coasterThickness - 1e-7 &&
      Math.hypot(point[0], point[1]) <= patternApothem + 1e-5,
  );

  console.log(`\n${testCase.name}`);
  near("низ на Z = 0", bounds.minZ, 0);
  near(
    "высота",
    bounds.height,
    params.coasterThickness +
      (params.coasterRim ? COASTER_RIM_RISE_MM : 0),
  );
  check("нижняя крышка — 288 треугольников", bottom.length, 288);
  check(
    "нижняя плоскость без наклона",
    bottom.every((triangle) =>
      triangle.every((point) => point[2] === BOTTOM_Z),
    ),
    true,
  );
  check("низ не ниже стола", vertices.every((point) => point[2] >= 0), true);
  check("NaN нет", nanVertices(triangles), 0);
  check("открытых рёбер нет", openEdges(triangles), 0);
  check("вырожденных треугольников нет", degenerateTriangles(triangles), 0);
  check("нормали наружу", signedVolumeOf(triangles) > 0, true);
  check("нависаний больше 45° нет", overhangTriangles(triangles).length, 0);
  near("объём меша = аналитический", meshVolume, analyticVolume, 0.001);
  near(
    "вес = объём × 1.24",
    calculateGeometryWeightGrams(geometry),
    (meshVolume / 1000) * PLA_DENSITY_G_PER_CM3,
    1e-4,
  );
  near(
    "аналитический вес",
    coasterAnalyticWeightGrams(params),
    (analyticVolume / 1000) * PLA_DENSITY_G_PER_CM3,
    1e-9,
  );

  if (params.coasterPattern === "smooth") {
    check("у гладкой нет углублений", relief.length, 0);
  } else {
    near(
      "глубина узора 1.2 мм",
      params.coasterThickness - minOf(relief.map((point) => point[2])),
      COASTER_PATTERN_DEPTH_MM,
      1e-5,
    );
  }

  if (params.coasterShape === "round") {
    near("габарит X", bounds.width, params.coasterSize);
    near("габарит Y", bounds.depth, params.coasterSize);

    const topRadius = Math.max(
      ...vertices
        .filter((point) => Math.abs(point[2] - bounds.maxZ) <= 1e-6)
        .map((point) => Math.hypot(point[0], point[1])),
    );
    const shoulderZ = bounds.maxZ - COASTER_BEVEL_MM;
    const shoulderRadius = Math.max(
      ...vertices
        .filter((point) => Math.abs(point[2] - shoulderZ) <= 1e-6)
        .map((point) => Math.hypot(point[0], point[1])),
    );

    near("фаска: радиус верха", topRadius, apothem - COASTER_BEVEL_MM);
    near("фаска: радиус плеча", shoulderRadius, apothem);
    near(
      "фаска 45°",
      shoulderRadius - topRadius,
      bounds.maxZ - shoulderZ,
    );

    if (params.coasterPattern !== "smooth") {
      const reliefRadius = maxOf(
        relief.map((point) => Math.hypot(point[0], point[1])),
      );

      check(
        "узор не доходит до фаски",
        reliefRadius <= patternApothem + 1e-5,
        true,
      );
    }
  }

  console.log(
    `  вес: ${coasterAnalyticWeightGrams(params).toFixed(2)} г, ` +
      `объём: ${(analyticVolume / 1000).toFixed(3)} см³`,
  );

  geometry.dispose();
}

console.log("\nБинарный STL для сот Ø100:");

const stlParams = normalizeCoasterParams({
  coasterSize: 100,
  coasterThickness: 5,
  coasterShape: "round",
  coasterPattern: "honeycomb",
  coasterRim: true,
});
const stlFileName = coasterStlFileName(stlParams);
const stlGeometry = createCoasterGeometry(stlParams);
const stlMesh = new Mesh(stlGeometry);
const stlDirectory = mkdtempSync(join(tmpdir(), "tridi-coaster-"));
const stlPath = join(stlDirectory, stlFileName);

stlMesh.updateMatrixWorld(true);

const exported = new STLExporter().parse(stlMesh, { binary: true });
const exportedBytes = exported as DataView;

writeFileSync(
  stlPath,
  Buffer.from(
    exportedBytes.buffer,
    exportedBytes.byteOffset,
    exportedBytes.byteLength,
  ),
);

const stlBuffer = readFileSync(stlPath);
const stlTriangles = readBinaryStl(stlBuffer);
const stlBounds = boundsOf(stlTriangles);
const stlAnalyticVolume = coasterAnalyticVolumeMm3(stlParams);
const stlPatternApothem =
  stlParams.coasterSize / 2 -
  COASTER_RIM_WALL_MM -
  COASTER_PATTERN_MARGIN_MM;
const stlRelief = stlTriangles
  .flat()
  .filter(
    (point) =>
      point[2] > BOTTOM_Z + 1e-7 &&
      point[2] < stlParams.coasterThickness - 1e-7 &&
      Math.hypot(point[0], point[1]) <= stlPatternApothem + 1e-5,
  );

console.log(
  `  файл: ${stlPath} (${stlBuffer.byteLength} байт, ` +
    `${stlTriangles.length} треугольников)`,
);
check(
  "имя STL с узором и бортиком",
  stlFileName,
  "tridi-podstavka-kruzhka-round-d100-t5-honeycomb-bort.stl",
);
check(
  "число треугольников STL",
  stlTriangles.length,
  trianglesOf(stlGeometry).length,
);
check(
  "плотность сетки STL: 58 000–62 000 треугольников",
  stlTriangles.length >= 58_000 && stlTriangles.length <= 62_000,
  true,
);
near("габарит STL по X = 100", stlBounds.width, 100);
near("габарит STL по Y = 100", stlBounds.depth, 100);
near("низ STL на Z = 0", stlBounds.minZ, 0);
near(
  "глубина узора STL 1.2 мм",
  stlParams.coasterThickness - minOf(stlRelief.map((point) => point[2])),
  COASTER_PATTERN_DEPTH_MM,
  1e-5,
);
const stlWallSlopes = stlTriangles
  .filter((triangle) =>
    triangle.every(
      (point) =>
        point[2] > BOTTOM_Z + 1e-7 &&
        point[2] < stlParams.coasterThickness - 1e-7 &&
        Math.hypot(point[0], point[1]) <= stlPatternApothem + 1e-5,
    ),
  )
  .map(
    (triangle) =>
      (Math.acos(Math.abs(normalOf(triangle)[2])) * 180) / Math.PI,
  );
const stlMaxWallSlope = maxOf(stlWallSlopes);

check(
  "стенка сот после smoothstep: 62–65°",
  stlMaxWallSlope >= 62 && stlMaxWallSlope <= 65,
  true,
);
check(
  "нижняя плоскость STL плоская",
  bottomTriangles(stlTriangles).every((triangle) =>
    triangle.every((point) => point[2] === BOTTOM_Z),
  ),
  true,
);
near("объём STL = аналитический", volumeOf(stlTriangles), stlAnalyticVolume, 0.001);
check("нависаний в STL больше 45° нет", overhangTriangles(stlTriangles).length, 0);
console.log(
  `  вес STL: ${((volumeOf(stlTriangles) / 1000) * PLA_DENSITY_G_PER_CM3).toFixed(2)} г`,
);

stlGeometry.dispose();
rmSync(stlDirectory, { recursive: true, force: true });

console.log("\nВертикальный держатель для стекирования:");

check(
  "держатель по умолчанию выключен",
  DEFAULT_COASTER_PARAMS.coasterHolderType,
  "none",
);
check("подставок в наборе по умолчанию", DEFAULT_COASTER_PARAMS.coasterCount, 6);
near("основание держателя", COASTER_HOLDER_BASE_THICKNESS_MM, 3);
near("задняя стенка держателя", COASTER_HOLDER_WALL_HEIGHT_MM, 60);
near("перегородка держателя", COASTER_HOLDER_DIVIDER_HEIGHT_MM, 15);
near("толщина перегородки", COASTER_HOLDER_DIVIDER_THICKNESS_MM, 2);
near("зазор подставки в гнезде", COASTER_HOLDER_SLOT_CLEARANCE_MM, 0.5);

const holderParams = normalizeCoasterParams({
  coasterSize: 90,
  coasterThickness: 5,
  coasterShape: "round",
  coasterPattern: "smooth",
  coasterRim: true,
  coasterHolderType: "vertical",
  coasterCount: 6,
});
const holderDims = coasterHolderDimensionsMm(holderParams);

near("держатель: ширина", holderDims.width, 71);
near("держатель: глубина", holderDims.depth, 100);
near("держатель: высота", holderDims.height, 60);
near(
  "держатель: посадочная толщина с бортиком",
  holderDims.coasterStackThickness,
  holderParams.coasterThickness + COASTER_RIM_RISE_MM,
);
near(
  "держатель: ширина паза = толщина с бортиком + 1",
  holderDims.slotWidth,
  holderDims.coasterStackThickness + 1,
);
near(
  "держатель: глубина = диаметр + 10",
  holderDims.depth,
  holderParams.coasterSize + 10,
);
near(
  "держатель: зазор до задней стенки",
  holderDims.depth / 2 -
    holderDims.wallThickness -
    holderParams.coasterSize / 2,
  2,
);
near("держатель: гнездо", holderDims.slotWidth, 8.5);
near("держатель: шаг перегородок", holderDims.dividerPitch, 10.5);
near("держатель: паз", holderDims.grooveWidth, holderDims.slotWidth);
near(
  "держатель: передний торец перегородок отступает",
  holderDims.depth / 2 - holderDims.dividerFrontY,
  COASTER_HOLDER_DIVIDER_FRONT_CLEARANCE_MM,
);
check("держатель: число гнёзд", holderDims.slotCenters.length, 6);
near("держатель: первое гнездо", holderDims.slotCenters[0], -26.25);
near("держатель: последнее гнездо", holderDims.slotCenters[5], 26.25);
check(
  "гнёзда не пересекаются",
  holderDims.slotCenters.every(
    (center, index) =>
      index === 0 ||
      center -
        (holderDims.slotCenters[index - 1] ?? center) >=
        holderDims.dividerPitch - 1e-9,
  ),
  true,
);
check(
  "подставка входит в гнездо с зазором",
  holderDims.slotWidth - holderDims.coasterStackThickness,
  holderDims.slotClearance * 2,
);

const thinHolderDims = coasterHolderDimensionsMm({
  ...holderParams,
  coasterThickness: 10,
});

near("держатель: паз под толстую подставку", thinHolderDims.grooveWidth, 13.5);
check(
  "ширина растёт с числом подставок",
  coasterHolderDimensionsMm({ ...holderParams, coasterCount: 8 }).width >
    coasterHolderDimensionsMm({ ...holderParams, coasterCount: 4 }).width,
  true,
);

const holderGeometry = createCoasterHolderGeometry(holderParams);
const holderTriangles = trianglesOf(holderGeometry);
const holderBounds = boundsOf(holderTriangles);
const holderAnalyticVolume = coasterHolderAnalyticVolumeMm3(holderParams);

near("держатель: габарит X", holderBounds.width, holderDims.width);
near("держатель: габарит Y", holderBounds.depth, holderDims.depth);
near("держатель: габарит Z", holderBounds.height, holderDims.height);
near("держатель: низ на Z = 0", holderBounds.minZ, 0);
check(
  "держатель: низ плоский",
  bottomTriangles(holderTriangles).every((triangle) =>
    triangle.every((point) => point[2] === BOTTOM_Z),
  ),
  true,
);
check(
  "держатель: грани замкнуты",
  openEdges(holderTriangles),
  0,
);
check(
  "держатель: нет вырожденных треугольников",
  degenerateTriangles(holderTriangles),
  0,
);
check("держатель: нет NaN", nanVertices(holderTriangles), 0);
near(
  "держатель: объём меша = аналитический",
  calculateGeometryVolumeMm3(holderGeometry),
  holderAnalyticVolume,
  0.001,
);
check(
  "держатель: нависаний больше 45° нет",
  overhangTriangles(holderTriangles).length,
  0,
);
console.log(
  `  держатель: ${holderDims.width} × ${holderDims.depth} × ${holderDims.height} мм, ` +
    `объём ${(holderAnalyticVolume / 1000).toFixed(2)} см³, ` +
    `вес ${coasterHolderAnalyticWeightGrams(holderParams).toFixed(2)} г`,
);

// Гекс шире номинала по диагонали: держатель обязан вырасти по Y, иначе его
// задняя стенка пересекает углы плиты, а передние углы свисают с основания.
const hexHolderParams = normalizeCoasterParams({
  ...holderParams,
  coasterShape: "hex",
});
const hexHolderDims = coasterHolderDimensionsMm(hexHolderParams);
const hexFootprintWidth = 90 / Math.cos(Math.PI / 6);

near(
  "гекс: фактическая ширина AABB",
  hexHolderDims.coasterFootprintWidth,
  hexFootprintWidth,
);
near(
  "гекс: глубина держателя = AABB + 10",
  hexHolderDims.depth,
  hexFootprintWidth + 10,
);
near(
  "гекс: перегородки короче диагонали",
  hexHolderDims.dividerFrontY,
  holderParams.coasterSize / 2 - 10,
);

// Проверка посадки в той же системе координат, что и превью. Пластик держателя
// разбит на точные боксы основания, задней стенки и перегородок; бокс плиты —
// фактический AABB после поворота: толщина идёт по X, ширина сечения по Y,
// высота по Z. Круг и гекс проверяются одинаково.
for (const shape of ["round", "hex"] as const) {
  const shapeParams = normalizeCoasterParams({
    ...holderParams,
    coasterShape: shape,
  });
  const shapeDims = coasterHolderDimensionsMm(shapeParams);
  const shapeCoasterGeometry = createCoasterGeometry(shapeParams);
  const shapeCoasterBounds = boundsOf(trianglesOf(shapeCoasterGeometry));
  const shapePlacement = coasterPlacementInHolderMm(shapeDims);
  const holderSolidBoxes = [
    box(
      -shapeDims.width / 2,
      shapeDims.width / 2,
      -shapeDims.depth / 2,
      shapeDims.depth / 2,
      0,
      shapeDims.baseThickness,
    ),
    box(
      -shapeDims.width / 2,
      shapeDims.width / 2,
      -shapeDims.depth / 2,
      -shapeDims.depth / 2 + shapeDims.wallThickness,
      0,
      shapeDims.wallHeight,
    ),
  ];
  const dividerBoxes = Array.from(
    { length: shapeDims.count + 1 },
    (_, index) => {
      const start =
        -shapeDims.width / 2 +
        COASTER_HOLDER_BASE_MARGIN_MM +
        index * shapeDims.dividerPitch;

      return box(
        start,
        start + shapeDims.dividerThickness,
        -shapeDims.depth / 2,
        shapeDims.dividerFrontY,
        0,
        shapeDims.baseThickness + shapeDims.dividerHeight,
      );
    },
  );
  const slotIntersections = shapeDims.slotCenters.reduce((total, center) => {
    const plateBox = box(
      center -
        shapePlacement.centerOffsetX +
        shapeCoasterBounds.minZ,
      center -
        shapePlacement.centerOffsetX +
        shapeCoasterBounds.maxZ,
      shapePlacement.centerOffsetY + shapeCoasterBounds.minX,
      shapePlacement.centerOffsetY + shapeCoasterBounds.maxX,
      shapePlacement.centerZ + shapeCoasterBounds.minY,
      shapePlacement.centerZ + shapeCoasterBounds.maxY,
    );
    const solidIntersections = [...holderSolidBoxes, ...dividerBoxes].filter(
      (solid) => boxesIntersect(plateBox, solid),
    ).length;
    const dividerIntersections = dividerBoxes.filter((solid) =>
      boxesIntersect(plateBox, solid),
    ).length;

    return {
      total: total.total + solidIntersections,
      dividers: total.dividers + dividerIntersections,
    };
  }, { total: 0, dividers: 0 });

  near(
    `${shape}: толщина AABB в гнезде`,
    shapeCoasterBounds.height,
    shapeDims.coasterStackThickness,
  );
  near(
    `${shape}: центр AABB по X`,
    shapePlacement.centerOffsetX,
    shapeDims.coasterStackThickness / 2,
  );
  near(`${shape}: центр AABB по Y`, shapePlacement.centerOffsetY, 0);
  near(
    `${shape}: низ AABB на основании`,
    shapePlacement.centerZ + shapeCoasterBounds.minY,
    shapeDims.baseThickness,
  );
  check(
    `Coaster intersects with holder (${shape})`,
    slotIntersections.total,
    0,
  );
  check(
    `AABB ${shape} не пересекается с перегородками`,
    slotIntersections.dividers,
    0,
  );
  console.log(
    `  ${shape} AABB: ${shapeCoasterBounds.width.toFixed(2)} × ` +
      `${shapeCoasterBounds.depth.toFixed(2)} × ` +
      `${shapeCoasterBounds.height.toFixed(2)} мм, ` +
      `глубина держателя ${shapeDims.depth.toFixed(2)} мм`,
  );
  shapeCoasterGeometry.dispose();
}

for (const count of [4, 6, 8]) {
  for (const coasterThickness of [3, 5, 10]) {
    const variant = normalizeCoasterParams({
      ...holderParams,
      coasterCount: count,
      coasterThickness,
    });
    const variantDims = coasterHolderDimensionsMm(variant);
    const variantGeometry = createCoasterHolderGeometry(variant);
    const variantTriangles = trianglesOf(variantGeometry);
    const variantBounds = boundsOf(variantTriangles);

    check(
      `держатель ${count} × ${coasterThickness} мм: гнёзд`,
      variantDims.slotCenters.length,
      count,
    );
    near(
      `держатель ${count} × ${coasterThickness} мм: ширина`,
      variantBounds.width,
      variantDims.width,
    );
    near(
      `держатель ${count} × ${coasterThickness} мм: глубина`,
      variantBounds.depth,
      variantDims.depth,
    );
    check(
      `держатель ${count} × ${coasterThickness} мм: грани замкнуты`,
      openEdges(variantTriangles),
      0,
    );
    check(
      `держатель ${count} × ${coasterThickness} мм: нет нависаний`,
      overhangTriangles(variantTriangles).length,
      0,
    );
    near(
      `держатель ${count} × ${coasterThickness} мм: объём`,
      calculateGeometryVolumeMm3(variantGeometry),
      coasterHolderAnalyticVolumeMm3(variant),
      0.001,
    );
    variantGeometry.dispose();
  }
}

check(
  "имя STL держателя",
  coasterHolderStlFileName(),
  "tridi-podstavka-derzhatel.stl",
);

const holderDirectory = mkdtempSync(join(tmpdir(), "tridi-coaster-holder-"));
const holderPath = join(holderDirectory, coasterHolderStlFileName());
const holderMesh = new Mesh(holderGeometry);

holderMesh.updateMatrixWorld(true);

const holderExported = new STLExporter().parse(holderMesh, { binary: true });
const holderBytes = holderExported as DataView;

writeFileSync(
  holderPath,
  Buffer.from(
    holderBytes.buffer,
    holderBytes.byteOffset,
    holderBytes.byteLength,
  ),
);

const holderStlTriangles = readBinaryStl(readFileSync(holderPath));
const holderStlBounds = boundsOf(holderStlTriangles);

console.log(
  `  файл держателя: ${holderPath} (${holderStlTriangles.length} треугольников)`,
);
near("держатель STL: габарит X", holderStlBounds.width, holderDims.width);
near("держатель STL: габарит Y", holderStlBounds.depth, holderDims.depth);
near("держатель STL: габарит Z", holderStlBounds.height, holderDims.height);
check(
  "держатель STL: число треугольников",
  holderStlTriangles.length,
  holderTriangles.length,
);
near(
  "держатель STL: объём = аналитический",
  volumeOf(holderStlTriangles),
  holderAnalyticVolume,
  0.001,
);
check(
  "держатель STL: нависаний больше 45° нет",
  overhangTriangles(holderStlTriangles).length,
  0,
);

console.log("\nВертикальный накопитель: стопка между тремя стойками:");

check(
  "стиль держателя по умолчанию",
  DEFAULT_COASTER_PARAMS.coasterHolderStyle,
  "horizontal",
);
check(
  "стили держателя перечислены",
  COASTER_HOLDER_STYLES.join(","),
  "horizontal,vertical",
);
check(
  "метка вертикального стиля",
  COASTER_HOLDER_STYLE_LABELS.vertical,
  "Вертикальный накопитель",
);

// Ø100 — самый крупный набор: боковая раскладка уже не помещается в 220 мм,
// поэтому проверка заодно включает диагональное размещение деталей.
const accumulatorParams = normalizeCoasterParams({
  ...holderParams,
  coasterSize: 100,
  coasterHolderStyle: "vertical",
});
const accumulatorDims = coasterHolderDimensionsMm(accumulatorParams);

near(
  "накопитель: толщина базы",
  accumulatorDims.baseThickness,
  COASTER_ACCUMULATOR_BASE_THICKNESS_MM,
);
near(
  "накопитель: диаметр стойки",
  accumulatorDims.postDiameter,
  COASTER_ACCUMULATOR_POST_DIAMETER_MM,
);
near(
  "накопитель: радиус установки стоек",
  accumulatorDims.postRingRadius,
  accumulatorDims.coasterOuterRadius +
    COASTER_ACCUMULATOR_POST_RING_CLEARANCE_MM,
);
near(
  "накопитель: ширина = описанная окружность + 5 мм с каждой стороны",
  accumulatorDims.width,
  (accumulatorDims.coasterOuterRadius + 5) * 2,
);
check("накопитель: три стойки", accumulatorDims.postCenters.length, 3);
near(
  "накопитель: шаг стопки = толщина с бортиком + 1.5",
  accumulatorDims.stackPitch,
  accumulatorDims.coasterStackThickness +
    COASTER_ACCUMULATOR_STACK_CLEARANCE_MM,
);
check(
  "накопитель: низ каждой подставки",
  accumulatorDims.stackBottomZs.length,
  accumulatorParams.coasterCount,
);
near(
  "накопитель: первая подставка на базе",
  accumulatorDims.stackBottomZs[0],
  accumulatorDims.baseThickness,
);
near(
  "накопитель: последняя подставка стопки",
  accumulatorDims.stackBottomZs[accumulatorDims.stackBottomZs.length - 1],
  accumulatorDims.baseThickness +
    (accumulatorParams.coasterCount - 1) * accumulatorDims.stackPitch,
);
near(
  "накопитель: высота стоек",
  accumulatorDims.postHeight,
  accumulatorParams.coasterCount * accumulatorDims.stackPitch +
    COASTER_ACCUMULATOR_TOP_HEADROOM_MM,
);
near(
  "накопитель: высота детали",
  accumulatorDims.height,
  accumulatorDims.baseThickness + accumulatorDims.postHeight,
);

const accumulatorGeometry = createCoasterHolderGeometry(accumulatorParams);
const accumulatorTriangles = trianglesOf(accumulatorGeometry);
const accumulatorBounds = boundsOf(accumulatorTriangles);
const accumulatorPosition = accumulatorGeometry.getAttribute("position");
let minPostRadius = Number.POSITIVE_INFINITY;
let maxPostRadius = 0;

for (let index = 0; index < accumulatorPosition.count; index += 1) {
  if (
    accumulatorPosition.getZ(index) <=
    accumulatorDims.baseThickness + 1e-6
  ) {
    continue;
  }

  const radius = Math.hypot(
    accumulatorPosition.getX(index),
    accumulatorPosition.getY(index),
  );

  minPostRadius = Math.min(minPostRadius, radius);
  maxPostRadius = Math.max(maxPostRadius, radius);
}

const accumulatorStackTop =
  accumulatorDims.stackBottomZs[accumulatorDims.stackBottomZs.length - 1] +
  accumulatorDims.coasterStackThickness;

near("накопитель: габарит X", accumulatorBounds.width, accumulatorDims.width);
near("накопитель: габарит Y", accumulatorBounds.depth, accumulatorDims.depth);
near(
  "накопитель: габарит Z",
  accumulatorBounds.height,
  accumulatorDims.height,
);
near("накопитель: низ на Z = 0", accumulatorBounds.minZ, 0);
check(
  "накопитель: стойки не заходят в стопку",
  minPostRadius >=
    accumulatorDims.coasterOuterRadius + COASTER_ACCUMULATOR_POST_GAP_MM,
  true,
);
check(
  "накопитель: стойки не выходят за базу",
  maxPostRadius <= accumulatorDims.width / 2 + 1e-6,
  true,
);
check(
  "накопитель: над верхней подставкой есть запас",
  accumulatorBounds.maxZ - accumulatorStackTop >=
    COASTER_ACCUMULATOR_TOP_HEADROOM_MM - 1e-6,
  true,
);
check(
  "накопитель: грани замкнуты",
  openEdges(accumulatorTriangles),
  0,
);
check(
  "накопитель: нет вырожденных треугольников",
  degenerateTriangles(accumulatorTriangles),
  0,
);
check("накопитель: нет NaN", nanVertices(accumulatorTriangles), 0);
near(
  "накопитель: объём меша = аналитический",
  calculateGeometryVolumeMm3(accumulatorGeometry),
  coasterHolderAnalyticVolumeMm3(accumulatorParams),
  0.001,
);
check(
  "накопитель: нависаний больше 45° нет",
  overhangTriangles(accumulatorTriangles, [
    BOTTOM_Z,
    accumulatorDims.baseThickness,
  ]).length,
  0,
);
console.log(
  `  накопитель: ${accumulatorDims.width.toFixed(2)} × ` +
    `${accumulatorDims.depth.toFixed(2)} × ${accumulatorDims.height.toFixed(2)} мм, ` +
    `зазор до стопки ${(minPostRadius - accumulatorDims.coasterOuterRadius).toFixed(3)} мм, ` +
    `запас сверху ${(accumulatorBounds.maxZ - accumulatorStackTop).toFixed(2)} мм`,
);

const accumulatorDirectory = mkdtempSync(
  join(tmpdir(), "tridi-coaster-accumulator-"),
);
const accumulatorPath = join(
  accumulatorDirectory,
  coasterHolderStlFileName(),
);
const accumulatorMesh = new Mesh(accumulatorGeometry);

accumulatorMesh.updateMatrixWorld(true);

const accumulatorExported = new STLExporter().parse(accumulatorMesh, {
  binary: true,
});
const accumulatorBytes = accumulatorExported as DataView;

writeFileSync(
  accumulatorPath,
  Buffer.from(
    accumulatorBytes.buffer,
    accumulatorBytes.byteOffset,
    accumulatorBytes.byteLength,
  ),
);

const accumulatorStlTriangles = readBinaryStl(
  readFileSync(accumulatorPath),
);
const accumulatorStlBounds = boundsOf(accumulatorStlTriangles);

near(
  "накопитель STL: габарит X",
  accumulatorStlBounds.width,
  accumulatorDims.width,
);
near(
  "накопитель STL: габарит Y",
  accumulatorStlBounds.depth,
  accumulatorDims.depth,
);
near(
  "накопитель STL: габарит Z",
  accumulatorStlBounds.height,
  accumulatorDims.height,
);
check(
  "накопитель STL: число треугольников",
  accumulatorStlTriangles.length,
  accumulatorTriangles.length,
);
near(
  "накопитель STL: объём = аналитический",
  volumeOf(accumulatorStlTriangles),
  coasterHolderAnalyticVolumeMm3(accumulatorParams),
  0.001,
);
check(
  "накопитель STL: нависаний больше 45° нет",
  overhangTriangles(accumulatorStlTriangles, [
    BOTTOM_Z,
    accumulatorDims.baseThickness,
  ]).length,
  0,
);
rmSync(accumulatorDirectory, { recursive: true, force: true });

console.log("\nОбщий STL набора: накопитель по диагонали:");

const accumulatorSetGeometry = createCoasterSetGeometry(accumulatorParams);
const accumulatorSetTriangles = trianglesOf(accumulatorSetGeometry);
const accumulatorSetBounds = boundsOf(accumulatorSetTriangles);
const accumulatorSetCenterX =
  accumulatorSetBounds.maxX - accumulatorDims.width / 2;
const accumulatorSetCenterY =
  accumulatorSetBounds.maxY - accumulatorDims.depth / 2;

check(
  "набор с накопителем: габарит X не больше 220 мм",
  accumulatorSetBounds.width <= COASTER_SET_BED_MM,
  true,
);
check(
  "набор с накопителем: габарит Y не больше 220 мм",
  accumulatorSetBounds.depth <= COASTER_SET_BED_MM,
  true,
);
check(
  "набор с накопителем: габарит Z не больше 250 мм",
  accumulatorSetBounds.height <= COASTER_SET_BED_HEIGHT_MM,
  true,
);
near(
  "набор с накопителем: высота без поворота на бок",
  accumulatorSetBounds.height,
  accumulatorDims.height,
);
check(
  "набор с накопителем: детали разведены на 15 мм",
  Math.hypot(accumulatorSetCenterX, accumulatorSetCenterY) >=
    accumulatorDims.coasterOuterRadius +
      accumulatorDims.width / 2 +
      COASTER_SET_PART_GAP_MM -
      1e-6,
  true,
);
near(
  "набор с накопителем: объём = подставка + накопитель",
  calculateGeometryVolumeMm3(accumulatorSetGeometry),
  coasterAnalyticVolumeMm3(accumulatorParams) +
    coasterHolderAnalyticVolumeMm3(accumulatorParams),
  // Сдвиг на 45° прибавляет к каждой координате иррациональное число, поэтому
  // сумма объёмов после слияния сходится с аналитикой до сотых мм³.
  0.01,
);
console.log(
  `  набор с накопителем: ${accumulatorSetBounds.width.toFixed(2)} × ` +
    `${accumulatorSetBounds.depth.toFixed(2)} × ` +
    `${accumulatorSetBounds.height.toFixed(2)} мм`,
);

accumulatorSetGeometry.dispose();
accumulatorGeometry.dispose();

console.log("\nОбщий STL набора: подставка и держатель рядом:");

const setParams = normalizeCoasterParams({
  ...stlParams,
  coasterHolderType: "vertical",
  coasterCount: 6,
});
const setHolderDims = coasterHolderDimensionsMm(setParams);
const setHolderOffset = coasterSetHolderOffsetMm(setParams);
const maxSetParams = normalizeCoasterParams({
  ...setParams,
  coasterSize: 140,
  coasterThickness: 10,
  coasterCount: 8,
});
const maxSetHolderDims = coasterHolderDimensionsMm(maxSetParams);
const maxSetOffset = coasterSetHolderOffsetMm(maxSetParams);
const maxSetGap =
  maxSetOffset -
  maxSetHolderDims.width / 2 -
  maxSetParams.coasterSize / 2;

check(
  "общий STL: зазор сохраняется на максимальных размерах",
  maxSetGap >= COASTER_SET_PART_GAP_MM,
  true,
);
near("общий STL: минимальный зазор", maxSetGap, 19);
const setGeometry = createCoasterSetGeometry(setParams);
const setTriangles = trianglesOf(setGeometry);
const setBounds = boundsOf(setTriangles);
const holderLeftEdge = setHolderOffset - setHolderDims.width / 2;
const coasterRightEdge = setParams.coasterSize / 2;
const setCoasterTriangles = setTriangles.filter((triangle) =>
  triangle.every((point) => point[0] <= coasterRightEdge + 1e-6),
);
const setHolderTriangles = setTriangles.filter((triangle) =>
  triangle.every((point) => point[0] >= holderLeftEdge - 1e-6),
);
const setCoasterBounds = boundsOf(setCoasterTriangles);
const setHolderBounds = boundsOf(setHolderTriangles);

check(
  "Coaster intersects with holder (общий STL)",
  boxesIntersect(setCoasterBounds, setHolderBounds),
  false,
);
check(
  "общий STL: габарит X не больше 220 мм",
  setBounds.width <= COASTER_SET_BED_MM,
  true,
);
check(
  "общий STL: габарит Y не больше 220 мм",
  setBounds.depth <= COASTER_SET_BED_MM,
  true,
);
near("общий STL: точный габарит X", setBounds.width, 200.5);
near("общий STL: точный габарит Y", setBounds.depth, 110);
near("общий STL: точная высота", setBounds.height, 60);
const setDirectory = mkdtempSync(join(tmpdir(), "tridi-coaster-set-"));
const setPath = join(setDirectory, coasterSetStlFileName(setParams));

check(
  "общий STL: имя файла набора",
  coasterSetStlFileName(setParams),
  "tridi-podstavka-kruzhka-nabor-round-d100-t5-honeycomb-bort.stl",
);
near(
  "общий STL: сдвиг держателя — ширина набора + 15 мм",
  setHolderOffset,
  115,
);
check(
  "общий STL: зазор между деталями не меньше 15 мм",
  holderLeftEdge - coasterRightEdge >= COASTER_SET_PART_GAP_MM,
  true,
);
near("общий STL: левый край подставки", setBounds.minX, -coasterRightEdge);
near(
  "общий STL: правый край держателя",
  setBounds.maxX,
  setHolderOffset + setHolderDims.width / 2,
);
near("общий STL: низ на Z = 0", setBounds.minZ, 0);
check(
  "общий STL: все треугольники подставки слева от держателя",
  setCoasterTriangles.length,
  stlTriangles.length,
);
check(
  "общий STL: все треугольники держателя справа от подставки",
  setHolderTriangles.length,
  holderTriangles.length,
);
check(
  "общий STL: треугольники не пересекаются по X",
  setCoasterTriangles.length + setHolderTriangles.length,
  setTriangles.length,
);
near(
  "общий STL: объём = подставка + держатель",
  calculateGeometryVolumeMm3(setGeometry),
  stlAnalyticVolume + coasterHolderAnalyticVolumeMm3(setParams),
  0.001,
);

const setMesh = new Mesh(setGeometry);

setMesh.updateMatrixWorld(true);

const setExported = new STLExporter().parse(setMesh, { binary: true });
const setBytes = setExported as DataView;

writeFileSync(
  setPath,
  Buffer.from(setBytes.buffer, setBytes.byteOffset, setBytes.byteLength),
);

const setStlTriangles = readBinaryStl(readFileSync(setPath));
const setStlBounds = boundsOf(setStlTriangles);

console.log(
  `  файл набора: ${setPath} (${setStlTriangles.length} треугольников, ` +
    `держатель с X = ${setHolderOffset} мм)`,
);
near(
  "общий STL в файле: габарит X",
  setStlBounds.width,
  setBounds.width,
);
check(
  "общий STL в файле: габарит X не больше 220 мм",
  setStlBounds.width <= COASTER_SET_BED_MM,
  true,
);
check(
  "общий STL в файле: габарит Y не больше 220 мм",
  setStlBounds.depth <= COASTER_SET_BED_MM,
  true,
);
check(
  "общий STL в файле: число треугольников",
  setStlTriangles.length,
  setTriangles.length,
);
check(
  "общий STL в файле: нависаний больше 45° нет",
  overhangTriangles(setStlTriangles).length,
  0,
);

for (const [label, extremeParams] of [
  ["круг 140 × 10, 8 гнёзд", maxSetParams],
  ["гекс 140 × 10, 8 гнёзд", { ...maxSetParams, coasterShape: "hex" as const }],
] as const) {
  const extremeGeometry = createCoasterSetGeometry(extremeParams);
  const extremeTriangles = trianglesOf(extremeGeometry);
  const extremeBounds = boundsOf(extremeTriangles);
  const extremeCoasterEdge = extremeParams.coasterSize / 2;
  const extremeLowerTriangles = extremeTriangles.filter((triangle) =>
    triangle.every((point) => point[1] <= extremeCoasterEdge + 1e-6),
  );
  const extremeUpperTriangles = extremeTriangles.filter((triangle) =>
    triangle.every(
      (point) =>
        point[1] >= extremeCoasterEdge + COASTER_SET_PART_GAP_MM - 1e-6,
    ),
  );

  check(
    `${label}: детали разведены по Y`,
    extremeLowerTriangles.length + extremeUpperTriangles.length,
    extremeTriangles.length,
  );
  check(
    `${label}: Coaster intersects with holder`,
    boxesIntersect(
      boundsOf(extremeLowerTriangles),
      boundsOf(extremeUpperTriangles),
    ),
    false,
  );

  check(
    `${label}: габарит X не больше 220 мм`,
    extremeBounds.width <= COASTER_SET_BED_MM,
    true,
  );
  check(
    `${label}: габарит Y не больше 220 мм`,
    extremeBounds.depth <= COASTER_SET_BED_MM,
    true,
  );
  check(
    `${label}: габарит Z не больше 250 мм`,
    extremeBounds.height <= COASTER_SET_BED_HEIGHT_MM,
    true,
  );
  near(`${label}: низ на Z = 0`, extremeBounds.minZ, 0);
  console.log(
    `  ${label}: ${extremeBounds.width.toFixed(2)} × ` +
      `${extremeBounds.depth.toFixed(2)} × ${extremeBounds.height.toFixed(2)} мм`,
  );
  extremeGeometry.dispose();
}

setGeometry.dispose();
rmSync(setDirectory, { recursive: true, force: true });

console.log("\nОбщий STL набора: гекс, шесть подставок:");

const hexSetParams = normalizeCoasterParams({
  ...hexHolderParams,
  coasterHolderType: "vertical",
  coasterCount: 6,
});
const hexSetDims = coasterHolderDimensionsMm(hexSetParams);
const hexSetOffset = coasterSetHolderOffsetMm(hexSetParams);
const hexSetGeometry = createCoasterSetGeometry(hexSetParams);
const hexSetTriangles = trianglesOf(hexSetGeometry);
const hexSetBounds = boundsOf(hexSetTriangles);
const hexSetHolderLeft = hexSetOffset - hexSetDims.width / 2;
const hexSetCoasterRight = hexSetDims.coasterFootprintWidth / 2;
const hexSetCoasterTriangles = hexSetTriangles.filter((triangle) =>
  triangle.every((point) => point[0] <= hexSetCoasterRight + 1e-6),
);
const hexSetHolderTriangles = hexSetTriangles.filter((triangle) =>
  triangle.every((point) => point[0] >= hexSetHolderLeft - 1e-6),
);

check(
  "гекс-набор: все треугольники подставки слева от держателя",
  hexSetCoasterTriangles.length + hexSetHolderTriangles.length,
  hexSetTriangles.length,
);
check(
  "гекс-набор: AABB подставки не пересекается с держателем",
  boxesIntersect(
    boundsOf(hexSetCoasterTriangles),
    boundsOf(hexSetHolderTriangles),
  ),
  false,
);
check(
  "гекс-набор: габарит X не больше 220 мм",
  hexSetBounds.width <= COASTER_SET_BED_MM,
  true,
);
check(
  "гекс-набор: габарит Y не больше 220 мм",
  hexSetBounds.depth <= COASTER_SET_BED_MM,
  true,
);
near("гекс-набор: габарит X", hexSetBounds.width, 192.4615, 1e-3);
near("гекс-набор: габарит Y", hexSetBounds.depth, 113.923, 1e-3);
near("гекс-набор: высота", hexSetBounds.height, 60);
near(
  "гекс-набор: зазор между деталями",
  hexSetHolderLeft - hexSetCoasterRight,
  17.5385,
  1e-3,
);

const hexSetDirectory = mkdtempSync(join(tmpdir(), "tridi-coaster-hex-set-"));
const hexSetPath = join(hexSetDirectory, coasterSetStlFileName(hexSetParams));
const hexSetMesh = new Mesh(hexSetGeometry);

hexSetMesh.updateMatrixWorld(true);

const hexSetExported = new STLExporter().parse(hexSetMesh, { binary: true });
const hexSetBytes = hexSetExported as DataView;

writeFileSync(
  hexSetPath,
  Buffer.from(
    hexSetBytes.buffer,
    hexSetBytes.byteOffset,
    hexSetBytes.byteLength,
  ),
);

const hexSetStlTriangles = readBinaryStl(readFileSync(hexSetPath));
const hexSetStlBounds = boundsOf(hexSetStlTriangles);

check(
  "гекс-набор STL: габарит X не больше 220 мм",
  hexSetStlBounds.width <= COASTER_SET_BED_MM,
  true,
);
check(
  "гекс-набор STL: габарит Y не больше 220 мм",
  hexSetStlBounds.depth <= COASTER_SET_BED_MM,
  true,
);
near("гекс-набор STL: габарит X", hexSetStlBounds.width, hexSetBounds.width);
near("гекс-набор STL: габарит Y", hexSetStlBounds.depth, hexSetBounds.depth);
check(
  "гекс-набор STL: число треугольников",
  hexSetStlTriangles.length,
  hexSetTriangles.length,
);
check(
  "гекс-набор STL: нависаний больше 45° нет",
  overhangTriangles(hexSetStlTriangles).length,
  0,
);
console.log(
  `  гекс-набор: ${hexSetBounds.width.toFixed(2)} × ` +
    `${hexSetBounds.depth.toFixed(2)} × ${hexSetBounds.height.toFixed(2)} мм, ` +
    `зазор ${(hexSetHolderLeft - hexSetCoasterRight).toFixed(2)} мм`,
);

hexSetGeometry.dispose();
rmSync(hexSetDirectory, { recursive: true, force: true });

holderGeometry.dispose();
rmSync(holderDirectory, { recursive: true, force: true });

if (failures.length > 0) {
  console.log(`\nПровалено проверок: ${failures.length}`);

  for (const failure of failures) {
    console.log(`  ✗ ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log("\nВсе проверки геометрии подставки под кружку прошли.");
}

