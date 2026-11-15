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
 * замкнутость сетки, аналитический объём, все варианты 4/6/8 и толщины 3–10 мм,
 * а также собственный STL держателя.
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
  COASTER_BEVEL_MM,
  COASTER_HOLDER_BASE_THICKNESS_MM,
  COASTER_HOLDER_DIVIDER_HEIGHT_MM,
  COASTER_HOLDER_DIVIDER_THICKNESS_MM,
  COASTER_HOLDER_GROOVE_WIDTH_MM,
  COASTER_HOLDER_SLOT_CLEARANCE_MM,
  COASTER_HOLDER_WALL_HEIGHT_MM,
  COASTER_PATTERN_DEPTH_MM,
  COASTER_PATTERN_MARGIN_MM,
  COASTER_RIM_RISE_MM,
  COASTER_RIM_WALL_MM,
  coasterAnalyticVolumeMm3,
  coasterAnalyticWeightGrams,
  coasterHolderAnalyticVolumeMm3,
  coasterHolderAnalyticWeightGrams,
  coasterHolderDimensionsMm,
  createCoasterGeometry,
  createCoasterHolderGeometry,
} from "../lib/constructor/coaster-geometry";
import {
  PLA_DENSITY_G_PER_CM3,
  calculateGeometryVolumeMm3,
  calculateGeometryWeightGrams,
} from "../lib/constructor/geometry-volume";
import {
  COASTER_PATTERNS,
  DEFAULT_COASTER_PARAMS,
  coasterHolderStlFileName,
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

function overhangTriangles(triangles: readonly Triangle[]): Triangle[] {
  return triangles.filter((triangle) => {
    const flatBottom = triangle.every(
      (point) => Math.abs(point[2] - BOTTOM_Z) <= 1e-7,
    );

    if (flatBottom) {
      return false;
    }

    // Нависание больше 45° — нормаль, наклонённая вниз сильнее, чем cos 45°.
    return normalOf(triangle)[2] < -Math.SQRT1_2;
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
      params.coasterThickness - Math.min(...relief.map((point) => point[2])),
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
      const reliefRadius = Math.max(
        ...relief.map((point) => Math.hypot(point[0], point[1])),
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
  "плотность сетки STL: 30 000–40 000 треугольников",
  stlTriangles.length >= 30_000 && stlTriangles.length <= 40_000,
  true,
);
near("габарит STL по X = 100", stlBounds.width, 100);
near("габарит STL по Y = 100", stlBounds.depth, 100);
near("низ STL на Z = 0", stlBounds.minZ, 0);
near(
  "глубина узора STL 1.2 мм",
  stlParams.coasterThickness - Math.min(...stlRelief.map((point) => point[2])),
  COASTER_PATTERN_DEPTH_MM,
  1e-5,
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
near("задняя стенка держателя", COASTER_HOLDER_WALL_HEIGHT_MM, 50);
near("перегородка держателя", COASTER_HOLDER_DIVIDER_HEIGHT_MM, 15);
near("толщина перегородки", COASTER_HOLDER_DIVIDER_THICKNESS_MM, 2);
near("паз держателя по умолчанию", COASTER_HOLDER_GROOVE_WIDTH_MM, 8);
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

near("держатель: ширина", holderDims.width, 56);
near("держатель: глубина", holderDims.depth, 100);
near("держатель: высота", holderDims.height, 50);
near("держатель: гнездо", holderDims.slotWidth, 6);
near("держатель: шаг перегородок", holderDims.dividerPitch, 8);
near("держатель: паз", holderDims.grooveWidth, 8);
check("держатель: число гнёзд", holderDims.slotCenters.length, 6);
near("держатель: первое гнездо", holderDims.slotCenters[0], -20);
near("держатель: последнее гнездо", holderDims.slotCenters[5], 20);
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
  holderDims.slotWidth - holderParams.coasterThickness,
  holderDims.slotClearance * 2,
);

const thinHolderDims = coasterHolderDimensionsMm({
  ...holderParams,
  coasterThickness: 10,
});

near("держатель: паз под толстую подставку", thinHolderDims.grooveWidth, 11);
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

