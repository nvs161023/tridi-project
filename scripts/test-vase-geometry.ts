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
 *      кромке равна заданной ±0.05 мм, а толщина по лучу лежит от `wall` до
 *      `wall / cos(π/N)` — это обратная сторона отступа по нормали, и её тоже
 *      нельзя терять;
 *   3. у круглых силуэтов толщина по лучу равна заданной;
 *   4. габарит гладкой многоугольной вазы равен `diameter · cos(π/N)`
 *      (63.64 мм для квадрата и 83.15 мм для восьмигранника при 90 мм);
 *   5. толстая стенка на маленьком квадрате не выворачивает полость;
 *   6. цоколь и обод не меняют высоту и диаметр, стенка на их полосах остаётся
 *      заданной, а самый тесный случай (Ø40 × 60, стенка 4) замкнут;
 *   7. у дна и под кромкой узор гаснет до нуля: кольца кромки и дна совпадают с
 *      той же вазой при нулевой амплитуде, а в теле рельеф остаётся прежним;
 *   8. грани 3–12 дают точный правильный N-угольник: угол лежит на радиусе
 *      `diameter / 2`, середина грани — на `diameter / 2 · cos(π/N)`, сетка
 *      замкнута, а стенка на гранях и в углах равна заданной по нормали.
 *      Слайдер «0–2» повторяет силуэт: у квадрата это четыре грани, у классики
 *      круг;
 *   9. каннелюры и закрутка: матрица 4 × 3 × 3 (жёлоба, глубина, угол) остаётся
 *      замкнутой, стенка не тоньше 0.8 мм, глубина на цилиндре равна заданной,
 *      ограничение по стенке работает, а закрутка поворачивает фазу рельефа, не
 *      меняя ни объём, ни шов.
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
import {
  VASE_EXPORT_TRIANGLE_BUDGET,
  vaseSegments,
} from "../lib/constructor/vase-budget";
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

/** Радиус дна: первая точка профиля после оси. */
function bottomRadius(profile: { x: number }[]): number {
  for (const point of profile) {
    if (point.x > 1e-6) {
      return point.x;
    }
  }

  return Number.NaN;
}

/** Радиус самой широкой точки кромки. */
function topRadius(profile: { x: number; y: number }[]): number {
  const top = Math.max(...profile.map((point) => point.y));
  let radius = 0;

  for (const point of profile) {
    if (Math.abs(point.y - top) <= 1e-6) {
      radius = Math.max(radius, point.x);
    }
  }

  return radius;
}

/** Высота модели по профилю: должна совпадать с параметром высоты. */
function profileHeight(profile: { y: number }[]): number {
  return Math.max(...profile.map((point) => point.y));
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

/**
 * Радиусы вершин по высотам, мм.
 *
 * Узор двигает вершины только по радиусу, поэтому поведение затухания видно
 * простым сравнением наборов радиусов на одной высоте: у вазы с амплитудой и у
 * той же вазы с нулевой амплитудой они должны совпасть там, где рельеф погашен.
 * Вершины на оси пропускаются — их радиус нулевой всегда.
 */
function radiiByHeight(geometry: BufferGeometry): Map<string, number[]> {
  const position = geometry.getAttribute("position");
  const rings = new Map<string, number[]>();

  for (let index = 0; index < position.count; index += 1) {
    const radius = Math.hypot(position.getX(index), position.getZ(index));

    if (radius <= 1e-4) {
      continue;
    }

    const key = position.getY(index).toFixed(4);
    const ring = rings.get(key);

    if (ring) {
      ring.push(radius);
    } else {
      rings.set(key, [radius]);
    }
  }

  for (const ring of rings.values()) {
    ring.sort((first, second) => first - second);
  }

  return rings;
}

/** Нижняя и верхняя границы сетки по высоте, мм. */
function heightSpan(geometry: BufferGeometry): { min: number; max: number } {
  const position = geometry.getAttribute("position");
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);

    min = Math.min(min, y);
    max = Math.max(max, y);
  }

  return { min, max };
}

/**
 * Кольцо профиля, ближайшее к заданной доле высоты.
 *
 * Нужно там, где важна не вся сетка, а одно сечение: глубина жёлоба и фаза
 * закрутки читаются на одном кольце, и перебирать ради этого все кольца профиля
 * незачем. Доля 0.25 — четверть высоты: там затухание у дна уже кончилось, а
 * закрутка прошла четверть своего угла.
 */
function ringAtHeightShare(
  geometry: BufferGeometry,
  share: number,
): RingPoint[] {
  const { min, max } = heightSpan(geometry);
  const target = min + (max - min) * share;
  let closest: RingPoint[] = [];
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const [key, ring] of ringsByHeight(geometry)) {
    const distance = Math.abs(Number(key) - target);

    if (distance < closestDistance) {
      closestDistance = distance;
      closest = ring;
    }
  }

  return closest;
}

/**
 * Угол самого глубокого места кольца, приведённый к одному периоду узора.
 *
 * У жёлоба период — `2π / flutes`, и дно канавки лежит на определённой фазе
 * внутри периода. Модуль убирает номер жёлоба: важно не «какой по счёту», а
 * «где внутри своего периода», поэтому фазу закрутки можно сравнивать с нулём
 * и с половиной периода, не зная, в каком месте круга мы смотрим.
 */
function deepestAngleWithinPeriod(ring: RingPoint[], period: number): number {
  let deepest = ring[0];

  for (const point of ring) {
    if (point.radius < deepest.radius) {
      deepest = point;
    }
  }

  return ((deepest.angle % period) + period) % period;
}

/**
 * Наибольшее расхождение радиусов двух сеток на кольцах в полосе высот, мм.
 *
 * Кольца сопоставляются по высоте и сравниваются попарно после сортировки по
 * радиусу. Если набор вершин в кольце разошёлся (одна сетка сварила вершину,
 * другая нет), расхождение не число — тогда возвращается бесконечность и
 * проверка падает, а не молча проходит.
 */
function shiftInBand(
  base: Map<string, number[]>,
  other: Map<string, number[]>,
  from: number,
  to: number,
): number {
  let worst = 0;

  for (const [key, baseRing] of base) {
    const height = Number(key);

    if (height < from || height > to) {
      continue;
    }

    const otherRing = other.get(key);

    if (!otherRing || otherRing.length !== baseRing.length) {
      return Number.POSITIVE_INFINITY;
    }

    for (let index = 0; index < baseRing.length; index += 1) {
      worst = Math.max(worst, Math.abs(baseRing[index] - otherRing[index]));
    }
  }

  return worst;
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

console.log("\n6. Цоколь и обод: профиль и сетка");

{
  const plain = createVaseProfile(vaseParams({ shape: "classic" }));
  const footed = createVaseProfile(
    vaseParams({ shape: "classic", footMm: 10 }),
  );
  const rimmed = createVaseProfile(vaseParams({ shape: "classic", rimMm: 4 }));

  checkRange(
    "classic: радиус дна = 0.55 · 45 = 24.75",
    [bottomRadius(plain)],
    24.74,
    24.76,
  );
  checkRange(
    "classic: радиус кромки = 0.57 · 45 = 25.65",
    [topRadius(plain)],
    25.64,
    25.66,
  );

  // Цоколь — вертикальная полоса: внешние точки профиля до его высоты стоят на
  // радиусе дна, поэтому первый слой ложится полным диском без нависаний.
  // Профиль идёт снизу вверх по внешней стенке и обратно по внутренней, так что
  // полоса ищется по обе стороны от верхней точки.
  const topIndex = footed.findIndex(
    (point) => point.y >= profileHeight(footed) - 1e-4,
  );
  const bandFilter = (point: { x: number; y: number }): boolean =>
    point.x > 1e-6 && point.y <= 10 + 1e-4;
  const footOuter = footed.slice(0, topIndex).filter(bandFilter);
  const footInner = footed.slice(topIndex).filter(bandFilter);
  const footWall = bottomRadius(plain) - wall;

  checkRange(
    "цоколь 10 мм: внешняя полоса стоит на радиусе дна",
    footOuter.map((point) => point.x),
    24.74,
    24.76,
  );
  checkRange(
    "цоколь 10 мм: внутренняя стенка полосы сохраняет толщину",
    footInner.map((point) => point.x),
    footWall - 0.01,
    footWall + 0.01,
  );
  checkRange(
    "цоколь: высота модели не выросла",
    [profileHeight(footed)],
    139.99,
    140.01,
  );

  checkRange(
    "обод 4 мм: кромка шире на 4",
    [topRadius(rimmed) - topRadius(plain)],
    3.99,
    4.01,
  );
  checkRange(
    "обод: высота модели не тронута",
    [profileHeight(rimmed)],
    139.99,
    140.01,
  );

  const cylinder = createVaseProfile(vaseParams({ shape: "cylinder" }));
  const cylinderRim = createVaseProfile(
    vaseParams({ shape: "cylinder", rimMm: 6 }),
  );

  checkRange(
    "обод в цилиндре упирается в диаметр и ничего не меняет",
    [topRadius(cylinderRim) - topRadius(cylinder)],
    -0.01,
    0.01,
  );

  // Ни цоколь, ни обод не могут выйти за заданный диаметр: слайдер «Диаметр»
  // обещает самую широкую часть модели.
  const overflow = VASE_SHAPES.filter(
    (shape) =>
      Math.max(
        ...createVaseProfile(
          vaseParams({ shape, footMm: 12, rimMm: 6 }),
        ).map((point) => point.x),
      ) >
      diameter / 2 + 1e-3,
  );

  check("цоколь 12 + обод 6 не выходят за диаметр", overflow, []);
}

{
  const broken: string[] = [];

  for (const shape of VASE_SHAPES) {
    const geometry = buildGeometry(
      vaseParams({ shape, pattern: "smooth", footMm: 10, rimMm: 4 }),
    );
    const open = openEdges(geometry);
    const nan = nanVertices(geometry);
    const volume = volumeMm3(geometry);

    if (open !== 0 || nan !== 0 || volume <= 0) {
      broken.push(
        `${shape}: рёбер ${open}, NaN ${nan}, объём ${volume.toFixed(1)}`,
      );
    }

    geometry.dispose();
  }

  check("цоколь 10 + обод 4: все восемь силуэтов замкнуты", broken, []);
}

for (const overrides of [
  { footMm: 10 },
  { rimMm: 4 },
  { footMm: 10, rimMm: 4 },
] as const) {
  const geometry = buildGeometry(
    vaseParams({ shape: "square", pattern: "smooth", ...overrides }),
  );
  const { normal, rimNormal } = wallMeasurements(geometry);
  const label = Object.entries(overrides)
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");

  checkRange(
    `square, ${label}: стенка по нормали`,
    normal,
    wall - WALL_TOLERANCE_MM,
    wall + WALL_TOLERANCE_MM,
  );
  checkRange(
    `square, ${label}: кромка по нормали`,
    rimNormal,
    wall - WALL_TOLERANCE_MM,
    wall + WALL_TOLERANCE_MM,
  );

  geometry.dispose();
}

{
  // Самый тесный случай: минимальный диаметр, максимальная стенка, цоколь
  // обрезан долей высоты, обод упирается в диаметр.
  const geometry = buildGeometry(
    vaseParams({
      shape: "square",
      pattern: "smooth",
      diameter: 40,
      height: 60,
      wall: 4,
      footMm: 12,
      rimMm: 6,
    }),
  );

  check(
    "Ø40 × 60, стенка 4, цоколь 12, обод 6: замкнуто",
    [openEdges(geometry), nanVertices(geometry)],
    [0, 0],
  );
  check("объём больше нуля", volumeMm3(geometry) > 0, true);

  geometry.dispose();
}

console.log("\n7. Затухание узора у кромки и дна");

{
  // Самый злой случай для кромки: максимальная амплитуда и максимальная
  // частота. Именно на нём венец выходил зубчатым гребешком. Опорой служит та
  // же ваза с нулевой амплитудой: разрешение по окружности зависит от узора и
  // частоты, поэтому «гладкая» ваза другого разрешения не подошла бы — кольца
  // сравнивались бы через разное число вершин.
  const dense = { patternIntensity: 5, patternFrequency: 20 } as const;
  const rimShifted: string[] = [];
  const floorShifted: string[] = [];
  const flatBody: string[] = [];
  let maxRimShift = 0;
  let maxFloorShift = 0;
  let minBodyShift = Number.POSITIVE_INFINITY;

  for (const shape of VASE_SHAPES) {
    for (const pattern of VASE_PATTERNS) {
      if (pattern === "smooth") {
        continue;
      }

      const flat = buildGeometry(
        vaseParams({ shape, pattern, ...dense, patternIntensity: 0 }),
      );
      const geometry = buildGeometry(vaseParams({ shape, pattern, ...dense }));
      const baseRings = radiiByHeight(flat);
      const rings = radiiByHeight(geometry);
      const { min: base, max: top } = heightSpan(flat);
      const body = top - base;
      const rimShift = shiftInBand(baseRings, rings, top - 1e-3, top + 1e-3);
      const floorShift = shiftInBand(baseRings, rings, base - 1e-3, base + 1e-3);
      const bodyShift = shiftInBand(
        baseRings,
        rings,
        base + body * 0.25,
        base + body * 0.75,
      );

      if (rimShift > 1e-3) {
        rimShifted.push(`${shape}/${pattern}: ${rimShift.toFixed(3)} мм`);
      }

      if (floorShift > 1e-3) {
        floorShifted.push(`${shape}/${pattern}: ${floorShift.toFixed(3)} мм`);
      }

      if (bodyShift < 0.5) {
        flatBody.push(`${shape}/${pattern}: ${bodyShift.toFixed(3)} мм`);
      }

      maxRimShift = Math.max(maxRimShift, rimShift);
      maxFloorShift = Math.max(maxFloorShift, floorShift);
      minBodyShift = Math.min(minBodyShift, bodyShift);

      flat.dispose();
      geometry.dispose();
    }
  }

  check("кромка при любом узоре осталась ровным кольцом", rimShifted, []);
  check("дно при любом узоре осталось ровным кругом", floorShifted, []);
  check("в теле узор работает: сдвиг ≥ 0.5 мм", flatBody, []);
  console.log(
    `       кромка ≤ ${maxRimShift.toFixed(4)} мм, дно ≤ ${maxFloorShift.toFixed(4)} мм, ` +
      `тело ≥ ${minBodyShift.toFixed(3)} мм`,
  );
}

{
  // Спорный кадр гейта: спираль на частоте 20 с цоколем и ободом. Затухание
  // привязано к тем же полосам, что и профиль, поэтому цоколь обязан остаться
  // гладким на всю свою высоту, а не только на первые три миллиметра.
  const shape = "classic" as const;
  const bands = { footMm: 10, rimMm: 6 } as const;
  const flat = buildGeometry(
    vaseParams({
      shape,
      pattern: "spiral",
      patternIntensity: 0,
      patternFrequency: 20,
      ...bands,
    }),
  );
  const spiral = buildGeometry(
    vaseParams({
      shape,
      pattern: "spiral",
      patternIntensity: 5,
      patternFrequency: 20,
      ...bands,
    }),
  );
  const baseRings = radiiByHeight(flat);
  const rings = radiiByHeight(spiral);
  const { max: top } = heightSpan(flat);

  checkRange(
    "спираль 20, обод 6: кольцо кромки не тронуто",
    [shiftInBand(baseRings, rings, top - 1e-3, top + 1e-3)],
    0,
    1e-3,
  );
  checkRange(
    "спираль 20, цоколь 10: полоса цоколя гладкая",
    [shiftInBand(baseRings, rings, 1, 9.99)],
    0,
    1e-3,
  );
  checkRange(
    "спираль 20: выше цоколя узор уже работает",
    [shiftInBand(baseRings, rings, 20, top * 0.5)],
    1,
    5.01,
  );

  flat.dispose();
  spiral.dispose();
}

{
  // Цоколь и обод не должны ломать сетку вместе с узором: сварка сравнивает
  // координаты, а смещение зависит только от высоты, поэтому совпадающие
  // вершины остаются совпадающими.
  const broken: string[] = [];
  let minVolume = Number.POSITIVE_INFINITY;

  for (const shape of VASE_SHAPES) {
    for (const pattern of VASE_PATTERNS) {
      const geometry = buildGeometry(
        vaseParams({
          shape,
          pattern,
          patternIntensity: 5,
          patternFrequency: 20,
          footMm: 10,
          rimMm: 4,
        }),
      );
      const open = openEdges(geometry);
      const nan = nanVertices(geometry);
      const volume = volumeMm3(geometry);

      minVolume = Math.min(minVolume, volume);

      if (open !== 0 || nan !== 0 || volume <= 0) {
        broken.push(
          `${shape}/${pattern}: рёбер ${open}, NaN ${nan}, объём ${volume.toFixed(1)}`,
        );
      }

      geometry.dispose();
    }
  }

  check("цоколь 10 + обод 4 + все узоры: 48 комбинаций замкнуты", broken, []);
  console.log(`       минимальный объём ${minVolume.toFixed(1)} мм³`);
}

{
  // Толщина на рельефе: смещение радиальное и одинаковое для внешней и
  // внутренней стенки, поэтому толщина по лучу остаётся заданной. Толщину по
  // нормали здесь не проверяем: узор наклоняет контур, и перпендикуляр между
  // двумя волнистыми линиями короче толщины по лучу — это свойство самого
  // радиального смещения, а не затухания.
  const geometry = buildGeometry(
    vaseParams({
      shape: "square",
      pattern: "ribs",
      patternIntensity: 5,
      patternFrequency: 8,
      footMm: 10,
      rimMm: 4,
    }),
  );
  const { radial, rimNormal } = wallMeasurements(geometry);

  checkRange(
    "square, рёбра 8, цоколь 10, обод 4: по лучу",
    radial,
    wall - WALL_TOLERANCE_MM,
    wall / Math.cos(Math.PI / 4) + WALL_TOLERANCE_MM,
  );
  checkRange(
    "square, рёбра 8, цоколь 10, обод 4: кромка по нормали",
    rimNormal,
    wall - WALL_TOLERANCE_MM,
    wall + WALL_TOLERANCE_MM,
  );

  geometry.dispose();
}

console.log("\n8. Грани: правильный N-угольник от 3 до 12");

{
  // Силуэт `square` выбран потому, что его самая широкая точка — ровно
  // `diameter / 2`: на таком кольце угол многоугольника должен лежать на этом
  // радиусе, а середина грани — на `diameter / 2 · cos(π/N)`. Проверка ловит
  // и ошибку формулы, и невыровненное число сегментов: если окружность не
  // делится на грани, угол срезается хордой между соседними кольцами.
  const sidesList = [3, 5, 6, 7, 12];
  const broken: string[] = [];
  const cornerErrors: number[] = [];
  const flatErrors: number[] = [];
  const normal: number[] = [];
  const radial: number[] = [];
  let minVolume = Number.POSITIVE_INFINITY;

  for (const sides of sidesList) {
    const geometry = buildGeometry(
      vaseParams({ shape: "square", pattern: "smooth", sectionSides: sides }),
    );
    const open = openEdges(geometry);
    const nan = nanVertices(geometry);
    const volume = volumeMm3(geometry);

    minVolume = Math.min(minVolume, volume);

    if (open !== 0 || nan !== 0 || volume <= 0) {
      broken.push(
        `${sides} граней: рёбер ${open}, NaN ${nan}, объём ${volume.toFixed(1)}`,
      );
    }

    let widest: RingPoint[] = [];
    let widestRadius = 0;

    for (const ring of ringsByHeight(geometry).values()) {
      const { outer } = splitRing(ring);

      if (outer.length < sides) {
        continue;
      }

      const radius = Math.max(...outer.map((point) => point.radius));

      if (radius > widestRadius) {
        widestRadius = radius;
        widest = outer;
      }
    }

    const radii = widest.map((point) => point.radius);

    cornerErrors.push(Math.abs(Math.max(...radii) - diameter / 2));
    flatErrors.push(
      Math.abs(Math.min(...radii) - (diameter / 2) * Math.cos(Math.PI / sides)),
    );

    const measurements = wallMeasurements(geometry);

    normal.push(...measurements.normal);
    radial.push(...measurements.radial);

    geometry.dispose();
  }

  check("грани 3, 5, 6, 7, 12: замкнутость, NaN и объём", broken, []);
  console.log(`       минимальный объём ${minVolume.toFixed(1)} мм³`);
  checkRange(
    "угол лежит на радиусе diameter / 2",
    cornerErrors,
    0,
    BOX_TOLERANCE_MM,
  );
  checkRange(
    "середина грани = diameter / 2 · cos(π/N)",
    flatErrors,
    0,
    BOX_TOLERANCE_MM,
  );
  checkRange(
    "стенка по нормали: грани и углы",
    normal,
    wall - WALL_TOLERANCE_MM,
    wall + WALL_TOLERANCE_MM,
  );
  checkRange(
    "стенка по лучу: от wall до wall / cos(π/3)",
    radial,
    wall - WALL_TOLERANCE_MM,
    wall / Math.cos(Math.PI / 3) + WALL_TOLERANCE_MM,
  );
}

{
  // Слайдер: 0, 1 и 2 — «как в силуэте», 3–12 — столько граней у любой формы.
  // Габарит — самый простой признак: у круга это диаметр, у квадрата
  // `diameter · cos(π/4)`, и значения не должны меняться от того, задан силуэт
  // или слайдер.
  const footprint = (params: VaseParams): number => {
    const geometry = buildGeometry(params);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const width = Math.max(
      (box?.max.x ?? 0) - (box?.min.x ?? 0),
      (box?.max.z ?? 0) - (box?.min.z ?? 0),
    );

    geometry.dispose();

    return width;
  };

  const circle = footprint(vaseParams({ shape: "classic", pattern: "smooth" }));

  checkRange("classic без граней: габарит = диаметр", [circle], 89.99, 90.01);
  checkRange(
    "classic, грани 0–2: габарит тот же, что у круга",
    [
      footprint(
        vaseParams({ shape: "classic", pattern: "smooth", sectionSides: 1 }),
      ),
      footprint(
        vaseParams({ shape: "classic", pattern: "smooth", sectionSides: 2 }),
      ),
    ],
    89.99,
    90.01,
  );
  checkRange(
    "classic, грани 4: габарит = 90 · cos(π/4)",
    [
      footprint(
        vaseParams({ shape: "classic", pattern: "smooth", sectionSides: 4 }),
      ),
      footprint(vaseParams({ shape: "square", pattern: "smooth" })),
    ],
    diameter * Math.cos(Math.PI / 4) - BOX_TOLERANCE_MM,
    diameter * Math.cos(Math.PI / 4) + BOX_TOLERANCE_MM,
  );
}

{
  // Треугольник — самый тесный случай: внутренняя стенка отходит от внешней на
  // `w / cos(π/3) = 2·w`, то есть на 90 % самого узкого радиуса при предельной
  // стенке. Полость не должна сложиться через ось.
  const geometry = buildGeometry(
    vaseParams({
      shape: "classic",
      pattern: "smooth",
      diameter: 40,
      height: 60,
      wall: 4,
      sectionSides: 3,
    }),
  );
  const volume = volumeMm3(geometry);

  check("треугольник Ø40 со стенкой 4: открытых рёбер 0", openEdges(geometry), 0);
  check("треугольник Ø40 со стенкой 4: NaN 0", nanVertices(geometry), 0);
  check("треугольник Ø40 со стенкой 4: объём больше нуля", volume > 0, true);
  console.log(`       объём ${volume.toFixed(1)} мм³`);

  geometry.dispose();
}

console.log("\n9. Каннелюры и закрутка: глубина, стенка и шов");

{
  // Матрица плана: 4, 8, 16, 24 жёлоба × 1, 3, 6 мм × закрутка 0, 90, 180°.
  // Классика выбрана как самый тесный силуэт: горловина узкая, стенка в ней
  // тоньше заданной, поэтому ограничение глубины включается по-настоящему.
  const broken: string[] = [];
  let minVolume = Number.POSITIVE_INFINITY;
  let maxTriangles = 0;

  for (const flutes of [4, 8, 16, 24]) {
    for (const depth of [1, 3, 6]) {
      for (const twist of [0, 90, 180]) {
        const geometry = buildGeometry(
          vaseParams({
            pattern: "smooth",
            flutes,
            fluteDepthMm: depth,
            twistDeg: twist,
          }),
        );
        const open = openEdges(geometry);
        const nan = nanVertices(geometry);
        const volume = volumeMm3(geometry);
        const index = geometry.getIndex();

        minVolume = Math.min(minVolume, volume);
        maxTriangles = Math.max(maxTriangles, index ? index.count / 3 : 0);

        if (open !== 0 || nan !== 0 || volume <= 0) {
          broken.push(
            `${flutes} × ${depth} мм, ${twist}°: рёбер ${open}, ` +
              `NaN ${nan}, объём ${volume.toFixed(1)}`,
          );
        }

        geometry.dispose();
      }
    }
  }

  check("матрица 4 × 3 × 3: замкнутость, NaN и объём", broken, []);
  console.log(
    `       минимальный объём ${minVolume.toFixed(1)} мм³, ` +
      `максимум треугольников ${maxTriangles}`,
  );
  check(
    "треугольников не больше бюджета STL",
    maxTriangles <= VASE_EXPORT_TRIANGLE_BUDGET,
    true,
  );
}

{
  // Стенка на жёлобах. Смещение одинаково для внешней и внутренней
  // поверхностей, поэтому толщина по нормали остаётся заданной, но на дне
  // жёлоба поверхность наклонена — допуск шире, чем у гладкой вазы. Порог
  // 0.8 мм из плана: тоньше не печатается двумя периметрами.
  const normal: number[] = [];

  for (const flutes of [4, 8, 16, 24]) {
    for (const twist of [0, 180]) {
      const geometry = buildGeometry(
        vaseParams({
          pattern: "smooth",
          flutes,
          fluteDepthMm: 6,
          twistDeg: twist,
        }),
      );

      normal.push(...wallMeasurements(geometry).normal);
      geometry.dispose();
    }
  }

  // Гранёная ваза с жёлобами: внутренняя стенка строится вписанным
  // многоугольником, поэтому смещение канавки проверяется и на гранях, и в углах.
  for (const sectionSides of [4, 8]) {
    for (const twist of [0, 180]) {
      const geometry = buildGeometry(
        vaseParams({
          pattern: "smooth",
          sectionSides,
          flutes: 16,
          fluteDepthMm: 6,
          twistDeg: twist,
        }),
      );

      normal.push(...wallMeasurements(geometry).normal);
      geometry.dispose();
    }
  }

  // Верхняя граница щедрая: на гранях и в углах расстояние от внутренней
  // вершины до ближайшей точки контура может быть больше заданной стенки — важен
  // только нижний порог 0.8 мм, тоньше пластик не печатается двумя периметрами.
  checkRange(
    "стенка на жёлобах: не тоньше 0.8 мм",
    normal,
    0.8,
    wall / Math.cos(Math.PI / 3) + WALL_TOLERANCE_MM,
  );
}

{
  // Глубина жёлоба проверяется на цилиндре: только у него радиус по высоте
  // постоянный, поэтому разница между самым далёким и самым близким радиусом
  // кольца — это ровно глубина канавки. Стенка 2.4 мм выбрана так, чтобы
  // ограничение по стенке не срабатывало: 1 мм меньше 60% от 2.4.
  const radius = diameter / 2;
  const depth = 1;
  const period = (Math.PI * 2) / 8;
  const degrees = (radians: number): number => (radians * 180) / Math.PI;
  const geometry = buildGeometry(
    vaseParams({
      shape: "cylinder",
      pattern: "smooth",
      wall: 2.4,
      flutes: 8,
      fluteDepthMm: depth,
    }),
  );
  const radii = splitRing(ringAtHeightShare(geometry, 0.5)).outer.map(
    (point) => point.radius,
  );
  const crest = Math.max(...radii);
  const trough = Math.min(...radii);

  checkRange(
    "гребень жёлоба на радиусе diameter / 2",
    [crest],
    radius - 0.02,
    radius + 0.02,
  );
  checkRange(
    "дно жёлоба: радиус = R − глубина",
    [crest - trough],
    depth - 0.02,
    depth + 0.02,
  );
  checkRange(
    "фаза без закрутки: дно на полпериода",
    [degrees(deepestAngleWithinPeriod(ringAtHeightShare(geometry, 0.25), period))],
    degrees(period / 2) - 3.2,
    degrees(period / 2) + 3.2,
  );

  geometry.dispose();

  // Та же ваза с закруткой 90°: на четверти высоты фаза прошла 22.5°, то есть
  // дно жёлоба переехало в ноль. Это и есть доказательство, что закрутка —
  // поворот фазы, а не вершин: угловое положение вершин осталось прежним.
  const twisted = buildGeometry(
    vaseParams({
      shape: "cylinder",
      pattern: "smooth",
      wall: 2.4,
      flutes: 8,
      fluteDepthMm: depth,
      twistDeg: 90,
    }),
  );
  const twistedPhase = degrees(
    deepestAngleWithinPeriod(ringAtHeightShare(twisted, 0.25), period),
  );

  check("закрутка 90°: открытых рёбер 0", openEdges(twisted), 0);
  check("закрутка 90°: NaN 0", nanVertices(twisted), 0);
  checkRange(
    "закрутка 90°: дно ушло в ноль на четверти высоты",
    [twistedPhase],
    0,
    3.2,
  );

  twisted.dispose();
}

{
  // Ограничение глубины: 6 мм на стенке 1.6 мм не бывает. Предел — 60% стенки,
  // то есть 0.96 мм; второе ограничение (45% самого узкого радиуса) здесь не
  // работает: 43.4 мм полости дают 19.5 мм запаса.
  const geometry = buildGeometry(
    vaseParams({
      shape: "cylinder",
      pattern: "smooth",
      wall: 1.6,
      flutes: 12,
      fluteDepthMm: 6,
    }),
  );
  const radii = splitRing(ringAtHeightShare(geometry, 0.5)).outer.map(
    (point) => point.radius,
  );

  checkRange(
    "глубина 6 мм ограничена 60% стенки",
    [Math.max(...radii) - Math.min(...radii)],
    1.6 * 0.6 - 0.02,
    1.6 * 0.6 + 0.02,
  );

  geometry.dispose();
}

{
  // Закрутка не меняет ни один радиус: кольцо поворачивается целиком, а стенка
  // и рельеф уже посчитаны. Объём при этом сходится не точно: поверхность между
  // двумя повёрнутыми кольцами — уже не призма, а винтовая полоса, поэтому
  // сумма по треугольникам отличается на доли процента. Полпроцента — граница,
  // за которой это была бы уже не закрутка, а другая форма.
  const straight = buildGeometry(
    vaseParams({
      shape: "cylinder",
      pattern: "smooth",
      wall: 2.4,
      flutes: 8,
      fluteDepthMm: 1,
    }),
  );
  const twisted = buildGeometry(
    vaseParams({
      shape: "cylinder",
      pattern: "smooth",
      wall: 2.4,
      flutes: 8,
      fluteDepthMm: 1,
      twistDeg: 90,
    }),
  );
  const volume = volumeMm3(straight);
  const difference = Math.abs(volume - volumeMm3(twisted));

  checkRange("закрутка сохраняет объём", [difference / volume], 0, 0.005);
  console.log(
    `       объём ${volume.toFixed(1)} мм³, расхождение ${difference.toFixed(2)} мм³`,
  );

  straight.dispose();
  twisted.dispose();
}

{
  // Худшее сочетание для выравнивания сетки: 11 граней требуют кратности 22,
  // 23 жёлоба — 46, а общее кратное 506 выходит за двойной потолок окружности.
  // Бюджет важнее точности жёлоба, поэтому остаётся шаг граней, а сетка всё
  // равно должна быть замкнутой и без NaN.
  const params = vaseParams({
    pattern: "smooth",
    sectionSides: 11,
    flutes: 23,
    fluteDepthMm: 2,
    twistDeg: 360,
  });
  const segments = vaseSegments(
    params,
    createVaseProfile(params).length,
    "preview",
  );
  const geometry = buildGeometry(params);

  check("11 граней + 23 жёлоба: сегментов не больше 512", segments <= 512, true);
  console.log(`       сегментов ${segments}`);
  check("11 граней + 23 жёлоба: открытых рёбер 0", openEdges(geometry), 0);
  check("11 граней + 23 жёлоба: NaN 0", nanVertices(geometry), 0);
  check(
    "11 граней + 23 жёлоба: объём больше нуля",
    volumeMm3(geometry) > 0,
    true,
  );

  geometry.dispose();
}

console.log("");

if (failures > 0) {
  console.log(`Провалено проверок: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Все проверки прошли.");
}
