/**
 * Тест геометрии вазы: толщина стенки, замкнутость, габарит.
 *
 * Главное правило, которое здесь закреплено: на многоугольном сечении стенка
 * должна быть одинаковой **по нормали**, а не по лучу. Разница не косметическая:
 * когда внутренний контур строился как «внешний радиус минус стенка», у квадрата
 * на 1.6 мм печаталось 1.131 мм в углах (cos 45° = 0.707), у восьмигранника
 * 1.478 (cos 22.5° = 0.924), а кромка переставала быть кольцом постоянной ширины
 * и в углу появлялся диагональный перегиб.
 *
 * Что проверяется:
 *   1. все восемь силуэтов и шесть узоров на дефолтных размерах замкнуты
 *      (у каждого ребра ровно два треугольника), без NaN и с объёмом больше нуля;
 *   2. у квадрата и восьмигранника перпендикулярная толщина на всех кольцах и на
 *      кромке равна заданной ±0.05 мм;
 *   3. толщина по лучу у них же лежит от `wall` до `wall / cos(π/N)` — это
 *      обратная сторона отступа по нормали, и её тоже нельзя терять;
 *   4. у круглых силуэтов толщина по лучу равна заданной;
 *   5. габарит гладкой многоугольной вазы равен `diameter · cos(π/N)`
 *      (63.64 мм для квадрата и 83.15 мм для восьмигранника при 90 мм);
 *   6. толстая стенка на маленьком квадрате не выворачивает полость.
 *
 * Запуск:
 *   node --import ./scripts/register-alias.mjs scripts/test-vase-geometry.ts
 *
 * Выход: 0 — все проверки прошли, 1 — есть расхождения.
 */
import type { BufferGeometry } from "three";

import {
  DEFAULT_VASE_PARAMS,
  VASE_PATTERNS,
  VASE_SHAPES,
  type VaseParams,
} from "../lib/constructor/params";
import { createVaseGeometry } from "../lib/constructor/vase-geometry";
import { createVaseProfile } from "../lib/constructor/vase-profile";

/** Допуск толщины стенки, мм: столько же требует план для этапа сечения. */
const WALL_TOLERANCE_MM = 0.05;

/** Допуск габарита, мм. */
const BOX_TOLERANCE_MM = 0.1;

/** Сколько проверок упало: из этого складывается код выхода. */
let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const isEqual = JSON.stringify(actual) === JSON.stringify(expected);

  if (isEqual) {
    console.log(`  ok   ${name}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${name}`);
  console.log(`       ожидалось: ${JSON.stringify(expected)}`);
  console.log(`       получено:  ${JSON.stringify(actual)}`);
}

/** Проверка с допуском: `actual` попадает в `[min, max]`. */
function checkRange(
  name: string,
  values: number[],
  min: number,
  max: number,
): void {
  if (values.length === 0) {
    failures += 1;
    console.log(`  FAIL ${name}`);
    console.log("       нет замеров");
    return;
  }

  const actualMin = Math.min(...values);
  const actualMax = Math.max(...values);

  if (actualMin >= min && actualMax <= max) {
    console.log(
      `  ok   ${name} — ${actualMin.toFixed(3)}…${actualMax.toFixed(3)}`,
    );
    return;
  }

  failures += 1;
  console.log(`  FAIL ${name}`);
  console.log(
    `       ожидалось: ${min.toFixed(3)}…${max.toFixed(3)}, ` +
      `получено: ${actualMin.toFixed(3)}…${actualMax.toFixed(3)}`,
  );
}

function vaseParams(overrides: Partial<VaseParams> = {}): VaseParams {
  return { ...DEFAULT_VASE_PARAMS, ...overrides };
}

function buildGeometry(params: VaseParams): BufferGeometry {
  return createVaseGeometry(createVaseProfile(params), params, {
    budget: "export",
  });
}

/** Сколько рёбер встречается не дважды: ненулевое значение — дыра в сетке. */
function openEdges(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  const edges = new Map<string, number>();

  if (!index) {
    return Number.POSITIVE_INFINITY;
  }

  for (let offset = 0; offset < index.count; offset += 3) {
    const corners = [
      index.getX(offset),
      index.getX(offset + 1),
      index.getX(offset + 2),
    ];

    for (let corner = 0; corner < 3; corner += 1) {
      const from = corners[corner];
      const to = corners[(corner + 1) % 3];
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

function volumeMm3(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  const position = geometry.getAttribute("position");

  if (!index) {
    return 0;
  }

  let total = 0;

  for (let offset = 0; offset < index.count; offset += 3) {
    const a = index.getX(offset);
    const b = index.getX(offset + 1);
    const c = index.getX(offset + 2);

    total +=
      position.getX(a) *
        (position.getY(b) * position.getZ(c) - position.getZ(b) * position.getY(c)) -
      position.getY(a) *
        (position.getX(b) * position.getZ(c) - position.getZ(b) * position.getX(c)) +
      position.getZ(a) *
        (position.getX(b) * position.getY(c) - position.getY(b) * position.getX(c));
  }

  return Math.abs(total / 6);
}


/** Вершина кольца: радиус и угол в плане. */
type RingPoint = {
  radius: number;
  angle: number;
};

/** Кольца по высоте профиля: ключ — высота, значение — все вершины кольца. */
function ringsByHeight(geometry: BufferGeometry): Map<string, RingPoint[]> {
  const position = geometry.getAttribute("position");
  const rings = new Map<string, RingPoint[]>();

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const radius = Math.hypot(x, z);

    if (radius <= 1e-4) {
      continue;
    }

    const key = y.toFixed(4);
    const point = { radius, angle: Math.atan2(z, x) };
    const ring = rings.get(key);

    if (ring) {
      ring.push(point);
    } else {
      rings.set(key, [point]);
    }
  }

  return rings;
}

/**
 * Делит кольцо на внешний и внутренний контуры.
 *
 * По среднему радиусу делить нельзя: у квадрата радиус по лучу гуляет на 30 %,
 * а стенка — 1.6 мм, и внутренние вершины уезжают в группу внешних. Поэтому
 * вершины группируются по лучу: на каждом луче внешняя та, что дальше от оси.
 */
function splitRing(ring: RingPoint[]): {
  outer: RingPoint[];
  inner: RingPoint[];
} {
  const byAngle = new Map<string, RingPoint[]>();

  for (const point of ring) {
    const key = point.angle.toFixed(5);
    const ray = byAngle.get(key);

    if (ray) {
      ray.push(point);
    } else {
      byAngle.set(key, [point]);
    }
  }

  const outer: RingPoint[] = [];
  const inner: RingPoint[] = [];

  for (const ray of byAngle.values()) {
    if (ray.length < 2) {
      continue;
    }

    const sorted = [...ray].sort((first, second) => second.radius - first.radius);
    outer.push(sorted[0]);
    inner.push(sorted[1]);
  }

  return { outer, inner };
}

type PlanPoint = { x: number; z: number };

function toCartesian(point: RingPoint): PlanPoint {
  return {
    x: Math.cos(point.angle) * point.radius,
    z: Math.sin(point.angle) * point.radius,
  };
}

/** Расстояние от точки до отрезка в плане. */
function pointToSegment(point: PlanPoint, first: PlanPoint, second: PlanPoint): number {
  const dx = second.x - first.x;
  const dz = second.z - first.z;
  const lengthSquared = dx * dx + dz * dz;
  const share =
    lengthSquared === 0
      ? 0
      : Math.min(
          1,
          Math.max(
            0,
            ((point.x - first.x) * dx + (point.z - first.z) * dz) /
              lengthSquared,
          ),
        );

  return Math.hypot(
    point.x - (first.x + dx * share),
    point.z - (first.z + dz * share),
  );
}

/** Толщина по нормали: от каждой внутренней вершины до внешнего контура. */
function normalThickness(outer: RingPoint[], inner: RingPoint[]): number[] {
  const polygon = outer
    .map(toCartesian)
    .sort(
      (first, second) =>
        Math.atan2(first.z, first.x) - Math.atan2(second.z, second.x),
    );
  const values: number[] = [];

  for (const point of inner.map(toCartesian)) {
    let best = Number.POSITIVE_INFINITY;

    for (let index = 0; index < polygon.length; index += 1) {
      const next = polygon[(index + 1) % polygon.length];
      best = Math.min(best, pointToSegment(point, polygon[index], next));
    }

    values.push(best);
  }

  return values;
}

/** Толщина по лучу: разность радиусов на одном угле. */
function radialThickness(outer: RingPoint[], inner: RingPoint[]): number[] {
  const byAngle = new Map(
    outer.map((point) => [point.angle.toFixed(5), point.radius]),
  );
  const values: number[] = [];

  for (const point of inner) {
    const outerRadius = byAngle.get(point.angle.toFixed(5));

    if (outerRadius !== undefined) {
      values.push(outerRadius - point.radius);
    }
  }

  return values;
}

/** Толщина стенки по всем кольцам профиля и отдельно по кромке. */
function wallMeasurements(geometry: BufferGeometry): {
  normal: number[];
  radial: number[];
  rimNormal: number[];
} {
  const normal: number[] = [];
  const radial: number[] = [];
  let rimNormal: number[] = [];
  let topHeight = Number.NEGATIVE_INFINITY;

  for (const [key, ring] of ringsByHeight(geometry)) {
    const { outer, inner } = splitRing(ring);

    if (outer.length < 8) {
      continue;
    }

    normal.push(...normalThickness(outer, inner));
    radial.push(...radialThickness(outer, inner));

    const height = Number(key);

    if (height > topHeight) {
      topHeight = height;
      rimNormal = normalThickness(outer, inner);
    }
  }

  return { normal, radial, rimNormal };
}


const wall = DEFAULT_VASE_PARAMS.wall;
const diameter = DEFAULT_VASE_PARAMS.diameter;

console.log("1. Замкнутость, NaN и объём: восемь силуэтов и шесть узоров");

{
  const broken: string[] = [];
  let minVolume = Number.POSITIVE_INFINITY;
  let worstOpen = 0;

  for (const shape of VASE_SHAPES) {
    for (const pattern of VASE_PATTERNS) {
      const geometry = buildGeometry(vaseParams({ shape, pattern }));
      const open = openEdges(geometry);
      const nan = nanVertices(geometry);
      const volume = volumeMm3(geometry);

      worstOpen = Math.max(worstOpen, open);
      minVolume = Math.min(minVolume, volume);

      if (open !== 0 || nan !== 0 || volume <= 0) {
        broken.push(
          `${shape}/${pattern}: рёбер ${open}, NaN ${nan}, объём ${volume.toFixed(1)}`,
        );
      }

      geometry.dispose();
    }
  }

  check("48 комбинаций: дыр, NaN и нулевого объёма нет", broken, []);
  console.log(
    `       худшее ребро: ${worstOpen}, минимальный объём ${minVolume.toFixed(1)} мм³`,
  );
}

console.log("\n2. Стенка многоугольника: по нормали и по лучу");

for (const [shape, sides] of [
  ["square", 4],
  ["octagon", 8],
] as const) {
  const geometry = buildGeometry(vaseParams({ shape, pattern: "smooth" }));
  const { normal, radial, rimNormal } = wallMeasurements(geometry);
  const flatShare = Math.cos(Math.PI / sides);

  checkRange(
    `${shape}: по нормали на стенках`,
    normal,
    wall - WALL_TOLERANCE_MM,
    wall + WALL_TOLERANCE_MM,
  );
  checkRange(
    `${shape}: по нормали на кромке`,
    rimNormal,
    wall - WALL_TOLERANCE_MM,
    wall + WALL_TOLERANCE_MM,
  );
  checkRange(
    `${shape}: по лучу — от стенки до стенки / cos(π/${sides})`,
    radial,
    wall - WALL_TOLERANCE_MM,
    wall / flatShare + WALL_TOLERANCE_MM,
  );

  geometry.dispose();
}

console.log("\n3. Стенка круглых силуэтов: по лучу равна заданной");

for (const shape of VASE_SHAPES) {
  if (shape === "square" || shape === "octagon") {
    continue;
  }

  const geometry = buildGeometry(vaseParams({ shape, pattern: "smooth" }));
  const { radial } = wallMeasurements(geometry);

  checkRange(`${shape}: по лучу`, radial, wall - 0.01, wall + 0.01);
  geometry.dispose();
}

console.log("\n4. Габарит гладкой многоугольной вазы");

for (const [shape, sides] of [
  ["square", 4],
  ["octagon", 8],
] as const) {
  const geometry = buildGeometry(vaseParams({ shape, pattern: "smooth" }));
  const expected = diameter * Math.cos(Math.PI / sides);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;

  checkRange(
    `${shape}: ширина и глубина = diameter · cos(π/${sides})`,
    [
      (box?.max.x ?? 0) - (box?.min.x ?? 0),
      (box?.max.z ?? 0) - (box?.min.z ?? 0),
    ],
    expected - BOX_TOLERANCE_MM,
    expected + BOX_TOLERANCE_MM,
  );

  geometry.dispose();
}

console.log("\n5. Толстая стенка на маленьком квадрате: полость не выворачивается");

{
  const geometry = buildGeometry(
    vaseParams({
      shape: "square",
      pattern: "smooth",
      diameter: 20,
      height: 40,
      wall: 9,
    }),
  );
  const volume = volumeMm3(geometry);

  check("открытых рёбер 0", openEdges(geometry), 0);
  check("NaN 0", nanVertices(geometry), 0);
  check("объём больше нуля", volume > 0, true);
  console.log(`       объём ${volume.toFixed(1)} мм³`);

  geometry.dispose();
}

console.log("");

if (failures > 0) {
  console.log(`Провалено проверок: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Все проверки прошли.");
}
