/**
 * Геометрия листа-лотка «Фигуристые листья».
 *
 * Лист — не тело вращения и не набор пересекающихся призм, а поле высот:
 * плоское дно лежит на столе, лицо повторяет рельеф. Такая схема печатается
 * без поддержек по построению — каждый следующий слой меньше предыдущего, ведь
 * все углубления только снимают материал сверху. Крючок — единственный
 * наклонный элемент: его ось отклонена от вертикали на 39°, а нижний срез
 * утоплен в плиту, поэтому поддержки не нужны и ему.
 *
 * Сетка параметрическая: строка `i` — сечение вдоль длины, столбец `j` —
 * поперёк. Верх и низ строятся по одним и тем же `(x, y)`, поэтому боковая
 * стенка сшивается с обеими поверхностями по индексам, а не поиском границы.
 * Контур задан полушириной `w(t)`, а не маской ячеек: край получается гладким
 * при любом шаге сетки.
 *
 * Рельеф — три наложенные функции, все гладкие (smoothstep):
 *
 * 1. центральная жилка — канавка вниз по оси листа;
 * 2. боковые жилки — отрезки от оси к краю, наклонённые к кончику;
 * 3. ложе между жилками — пологая впадина по всей пластине, в ней лежат кольца.
 *
 * Глубина каждой функции вниз от лица, поэтому верхняя поверхность нигде не
 * поднимается выше плиты, а самая тонкая точка — центр центральной жилки.
 */

import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  normalizeJewelryStandParams,
  type JewelryLeafType,
  type JewelryStandParams,
} from "@/lib/constructor/params";

/** Толщина плиты в самой тонкой точке — под центральной жилкой, мм. */
export const JEWELRY_LEAF_MIN_THICKNESS_MM = 1.6;

/** Глубина пологого ложа между жилками, мм: кольцо лежит, а не катается. */
export const JEWELRY_LEAF_BOWL_DEPTH_MM = 0.9;

/** Ширина ободка по краю, где рельеф затухает до нуля, мм. */
export const JEWELRY_LEAF_EDGE_BAND_MM = 3.5;

/** Полуширина центральной жилки, мм. */
export const JEWELRY_LEAF_CENTER_VEIN_HALF_MM = 1.6;

/** Полуширина боковой жилки, мм: уже центральной, но читается на слое 0.2. */
export const JEWELRY_LEAF_SIDE_VEIN_HALF_MM = 1.1;

/** Пар боковых жилок: пять пар дают шесть полос-лож между ними. */
export const JEWELRY_LEAF_SIDE_VEIN_PAIRS = 5;

/** Глубина боковой жилки в долях глубины центральной. */
const JEWELRY_LEAF_SIDE_VEIN_RATIO = 0.72;

/** Полуширина черешка, мм: в неё входит крючок и остаётся мясо по краям. */
const JEWELRY_LEAF_STEM_HALF_MM = 4.5;

/** Полуширина кончика, мм: остриё не тоньше двух линий периметра. */
const JEWELRY_LEAF_TIP_HALF_MM = 1.1;

/** Доля длины, где черешок переходит в пластину. */
const JEWELRY_LEAF_STEM_SHARE = 0.16;

/** Первая пара боковых жилок и шаг между парами в долях длины. */
const JEWELRY_LEAF_SIDE_VEIN_FIRST = 0.24;
const JEWELRY_LEAF_SIDE_VEIN_STEP = 0.14;

/** Наклон боковой жилки к поперечной оси: конец пары забегает вперёд. */
const JEWELRY_LEAF_SIDE_VEIN_RUN = 0.13;

/** Площадь ячейки сетки, мм²: шаг растёт вместе с листом, а не с одной длиной. */
const JEWELRY_LEAF_CELL_MM2 = 9000;

/** Границы шага сетки, мм: мельче 1 мм сетка не нужна, крупнее 1.8 грубо. */
const JEWELRY_LEAF_STEP_MIN_MM = 1;
const JEWELRY_LEAF_STEP_MAX_MM = 1.8;

/** Радиус трубы крючка, мм: в него проходит петля цепочки. */
const JEWELRY_LEAF_HOOK_RADIUS_MM = 4;

/** Число сторон крючка: 32 хватает, чтобы петля цепочки не цеплялась. */
const JEWELRY_LEAF_HOOK_SIDES = 32;

/** Вынос и подъём наклонной части крючка, мм: 8/10 — это 51° к столу. */
const JEWELRY_LEAF_HOOK_RUN_MM = 8;
const JEWELRY_LEAF_HOOK_RISE_MM = 10;

/** Вертикальный штырь на конце черешка, мм: седло для петли цепочки. */
const JEWELRY_LEAF_HOOK_STUB_MM = 10;

/** Отступ крючка от конца черешка, мм: крючок стоит внутри плиты. */
const JEWELRY_LEAF_HOOK_INSET_MM = 18;

/** Насколько начало наклонной части ниже лица плиты, мм: торец уходит в материал. */
const JEWELRY_LEAF_HOOK_JOIN_MM = 1.2;

/**
 * Высота нижнего среза крючка над столом, мм.
 *
 * Срез горизонтальный и лежит внутри плиты: её сплошной низ толще любого
 * рельефа, поэтому под крючком остаётся материал от стола и нависания нет.
 */
const JEWELRY_LEAF_HOOK_BOTTOM_MM = 0.6;


/**
 * Профиль силуэта: степень синуса задаёт полноту, лепестки — волнистый край.
 *
 * `widthFactor` — доля ширины ползунка, которую занимает пластина: папоротник
 * узкий при той же длине. `lobes` и `lobeDepth` — число и глубина вырезов;
 * ноль лепестков оставил бы ровный овал.
 */
type JewelryLeafProfile = {
  readonly exponent: number;
  readonly widthFactor: number;
  readonly lobes: number;
  readonly lobeDepth: number;
};

const JEWELRY_LEAF_PROFILES: Record<JewelryLeafType, JewelryLeafProfile> = {
  // Монстера: широкий лист с четырьмя глубокими вырезами по краю.
  monstera: { exponent: 0.7, widthFactor: 1, lobes: 4, lobeDepth: 0.24 },
  // Папоротник: узкая длинная пластина с частыми мелкими зубцами.
  fern: { exponent: 1, widthFactor: 0.62, lobes: 9, lobeDepth: 0.14 },
  // Дуб: полный округлый лист, край слегка волнистый.
  oak: { exponent: 0.55, widthFactor: 1, lobes: 5, lobeDepth: 0.12 },
};

/** План листа: всё, что считается один раз на генерацию. */
type JewelryLeafPlan = {
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly veinDepthMm: number;
  readonly plateMm: number;
  readonly profile: JewelryLeafProfile;
  readonly amplitudeMm: number;
  readonly stepMm: number;
  readonly columns: number;
  readonly rows: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Плавная ступенька: производная на концах нулевая, изломов в рельефе нет. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return t * t * (3 - 2 * t);
}

/** Гладкий импульс: 1 на оси, 0 на расстоянии `halfWidth` и дальше. */
function pulse(halfWidthMm: number, distanceMm: number): number {
  return 1 - smoothstep(0, halfWidthMm, Math.abs(distanceMm));
}

/**
 * Толщина плиты по глубине прожилок.
 *
 * Самая тонкая точка — пересечение центральной жилки с ложем: там снимается
 * `veinDepth + bowl`. Плита выше этой суммы ровно на минимальную толщину,
 * поэтому лист не просвечивает и не рвётся при печати на любом ползунке.
 */
export function jewelryLeafPlateThicknessMm(veinDepthMm: number): number {
  return (
    veinDepthMm + JEWELRY_LEAF_BOWL_DEPTH_MM + JEWELRY_LEAF_MIN_THICKNESS_MM
  );
}

/** Минимальная полуширина по длине: черешок толще, кончик тоньше. */
function leafMinHalfWidthMm(t: number): number {
  return (
    JEWELRY_LEAF_STEM_HALF_MM +
    (JEWELRY_LEAF_TIP_HALF_MM - JEWELRY_LEAF_STEM_HALF_MM) *
      smoothstep(0, 1, t)
  );
}

/** Единичный профиль пластины: 0 на черешке и кончике, 1 в широкой части. */
function leafUnitHalfWidth(t: number, profile: JewelryLeafProfile): number {
  const u = clamp(
    (t - JEWELRY_LEAF_STEM_SHARE) / (1 - JEWELRY_LEAF_STEM_SHARE),
    0,
    1,
  );
  const base = Math.sin(Math.PI * u) ** profile.exponent;
  const lobes =
    1 - profile.lobeDepth * Math.sin(Math.PI * profile.lobes * u) ** 2;

  return base * lobes;
}

/**
 * Амплитуда пластины: подбирается так, чтобы максимум полуширины был ровно
 * `width / 2`.
 *
 * Полуширина — гладкий максимум `hypot(min, amplitude · profile)`, поэтому
 * амплитуда не равна половине ширины напрямую. Четырёх проходов достаточно:
 * каждый уменьшает невязку на порядок, а результат совпадает с ползунком в
 * пределах сотой миллиметра.
 */
function leafAmplitudeMm(leafType: JewelryLeafType, widthMm: number): number {
  const profile = JEWELRY_LEAF_PROFILES[leafType];
  const target = widthMm / 2;
  let amplitude = target;

  for (let pass = 0; pass < 4; pass += 1) {
    let widest = 0;

    for (let index = 0; index <= 512; index += 1) {
      const t = index / 512;
      const half = Math.hypot(
        leafMinHalfWidthMm(t),
        amplitude * leafUnitHalfWidth(t, profile),
      );

      widest = Math.max(widest, half);
    }

    amplitude *= target / Math.max(widest, 1e-6);
  }

  return amplitude;
}

/** План листа: размеры, профиль, амплитуда и сетка. */
function leafPlan(params: JewelryStandParams): JewelryLeafPlan {
  const lengthMm = params.jewelryLeafLength;
  const widthMm = params.jewelryLeafWidth;
  const stepMm = clamp(
    Math.sqrt((lengthMm * widthMm) / JEWELRY_LEAF_CELL_MM2),
    JEWELRY_LEAF_STEP_MIN_MM,
    JEWELRY_LEAF_STEP_MAX_MM,
  );

  return {
    lengthMm,
    widthMm,
    veinDepthMm: params.jewelryLeafVeinDepth,
    plateMm: jewelryLeafPlateThicknessMm(params.jewelryLeafVeinDepth),
    profile: JEWELRY_LEAF_PROFILES[params.jewelryLeafType],
    amplitudeMm: leafAmplitudeMm(params.jewelryLeafType, widthMm),
    stepMm,
    columns: Math.max(24, Math.round(lengthMm / stepMm)),
    rows: Math.max(8, Math.round(widthMm / stepMm)),
  };
}

/** Полуширина листа в доле длины `t`: 0 — черешок, 1 — кончик. */
function leafHalfWidth(plan: JewelryLeafPlan, t: number): number {
  return Math.hypot(
    leafMinHalfWidthMm(t),
    plan.amplitudeMm * leafUnitHalfWidth(t, plan.profile),
  );
}

/** Полуширина листа в точке `t` для тестов и подсказок панели. */
export function jewelryLeafHalfWidthAt(
  params: Partial<JewelryStandParams>,
  t: number,
): number {
  const normalized = normalizeJewelryStandParams(params);

  return leafHalfWidth(leafPlan(normalized), clamp(t, 0, 1));
}
/** Расстояние от точки до отрезка на плоскости, мм. */
function segmentDistanceMm(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const u =
    lengthSq > 0
      ? clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1)
      : 0;

  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

/**
 * Глубина рельефа в точке по готовому плану, мм вниз от лица плиты.
 *
 * План передаётся снаружи: на сетке 9 тысяч вершин повторять подбор амплитуды
 * и нормализацию параметров нельзя — это превратило бы предпросмотр в
 * многосекундную паузу.
 */
function leafReliefMm(
  plan: JewelryLeafPlan,
  xMm: number,
  yMm: number,
): number {
  const halfLength = plan.lengthMm / 2;
  const t = clamp((xMm + halfLength) / plan.lengthMm, 0, 1);
  const halfWidth = leafHalfWidth(plan, t);
  const edge = halfWidth - Math.abs(yMm);

  // У самого края рельеф не снимается: остаётся ободок толщиной плиты, он
  // держит кольца и не даёт краю получиться толщиной в волос.
  const edgeFade = smoothstep(0, JEWELRY_LEAF_EDGE_BAND_MM, edge);

  if (edgeFade <= 0) {
    return 0;
  }

  // Жилки и ложе не доходят до черешка и кончика: там пластина узкая.
  const alongFade = smoothstep(0.08, 0.2, t) * (1 - smoothstep(0.9, 0.99, t));
  const ratio = clamp(yMm / Math.max(halfWidth, 1e-6), -1, 1);
  const bowl = JEWELRY_LEAF_BOWL_DEPTH_MM * (1 - ratio * ratio) * alongFade;
  const center =
    plan.veinDepthMm *
    pulse(JEWELRY_LEAF_CENTER_VEIN_HALF_MM, yMm) *
    alongFade;

  let vein = center;

  for (let index = 0; index < JEWELRY_LEAF_SIDE_VEIN_PAIRS; index += 1) {
    const rootT =
      JEWELRY_LEAF_SIDE_VEIN_FIRST + index * JEWELRY_LEAF_SIDE_VEIN_STEP;
    const tipT = Math.min(0.96, rootT + JEWELRY_LEAF_SIDE_VEIN_RUN);
    const rootX = -halfLength + rootT * plan.lengthMm;
    const tipX = -halfLength + tipT * plan.lengthMm;
    const tipHalf = leafHalfWidth(plan, tipT);

    // Жилка идёт к краю, но не в самое ребро: ободок остаётся целым.
    const tipY = Math.max(0, tipHalf - JEWELRY_LEAF_EDGE_BAND_MM * 0.5);

    for (const side of [-1, 1]) {
      const distance = segmentDistanceMm(
        xMm,
        yMm,
        rootX,
        0,
        tipX,
        side * tipY,
      );
      const depth =
        plan.veinDepthMm *
        JEWELRY_LEAF_SIDE_VEIN_RATIO *
        pulse(JEWELRY_LEAF_SIDE_VEIN_HALF_MM, distance);

      vein = Math.max(vein, depth);
    }
  }

  return edgeFade * (vein + bowl);
}

/**
 * Глубина рельефа в точке для тестов, мм вниз от лица плиты.
 *
 * Проверка глубины жилки обращается к той же функции, что и генератор, поэтому
 * тест не повторяет формулы и не подтверждает сам себя.
 */
export function jewelryLeafReliefMm(
  params: Partial<JewelryStandParams>,
  xMm: number,
  yMm: number,
): number {
  const normalized = normalizeJewelryStandParams(params);

  return leafReliefMm(leafPlan(normalized), xMm, yMm);
}

/**
 * Высота крючка над столом, мм.
 *
 * Начало наклонной части спрятано в плите на `HOOK_JOIN`, дальше идут подъём и
 * вертикальный штырь. Метрика нужна предпросмотру: он пишет габарит, не
 * собирая меш.
 */
export function jewelryLeafHeightMm(
  params: Partial<JewelryStandParams>,
): number {
  const normalized = normalizeJewelryStandParams(params);
  const plate = jewelryLeafPlateThicknessMm(normalized.jewelryLeafVeinDepth);

  return (
    plate -
    JEWELRY_LEAF_HOOK_JOIN_MM +
    JEWELRY_LEAF_HOOK_RISE_MM +
    JEWELRY_LEAF_HOOK_STUB_MM
  );
}

/** Дописывает треугольник по индексам вершин: обход задан вызывающим. */
function addTriangle(
  positions: number[],
  vertices: readonly number[],
  a: number,
  b: number,
  c: number,
): void {
  for (const index of [a, b, c]) {
    positions.push(
      vertices[index * 3],
      vertices[index * 3 + 1],
      vertices[index * 3 + 2],
    );
  }
}

/** Точка в плоскости симметрии листа: крючок строится по XZ, Y = 0. */
type LeafHookPoint = readonly [number, number, number];

/**
 * Добавляет крючок одной трубой: наклонная часть, колено и вертикальный штырь.
 *
 * Два отдельных цилиндра дают висящий торец: низ штыря оказывается плоской
 * крышкой в воздухе. Здесь кольца нанизаны на общую ось, а в колене нормаль
 * усреднена — поверхность непрерывна. Нижний срез горизонтален и лежит внутри
 * плиты, верхняя крышка — макушка штыря, поэтому нависаний нет.
 */
function addHookTube(
  positions: number[],
  vertices: number[],
  pushVertex: (x: number, y: number, z: number) => number,
  rootX: number,
  rootZ: number,
  radiusMm: number,
  sides: number,
): void {
  const runMm = JEWELRY_LEAF_HOOK_RUN_MM;
  const riseMm = JEWELRY_LEAF_HOOK_RISE_MM;
  const stubMm = JEWELRY_LEAF_HOOK_STUB_MM;
  const slantLength = Math.hypot(runMm, riseMm);
  // Наклонная часть идёт вверх и к кончику черешка: влево по X и вверх по Z.
  const dirX = -runMm / slantLength;
  const dirZ = riseMm / slantLength;
  const bendX = rootX - runMm;
  const bendZ = rootZ + riseMm;
  // Ось уходит вниз, в плиту: нижний срез заведомо лежит в сплошном материале.
  const bottomZ = JEWELRY_LEAF_HOOK_BOTTOM_MM;
  const startS = (bottomZ - rootZ) / dirZ;
  const slantSteps = 4;
  const stubSteps = 3;
  // Колено: нормаль — биссектриса осей, иначе кольца не сшить без щели.
  const kneeLength = Math.hypot(dirX, dirZ + 1);
  const kneeX = dirX / kneeLength;
  const kneeZ = (dirZ + 1) / kneeLength;
  const centers: LeafHookPoint[] = [];
  const normals: LeafHookPoint[] = [];

  for (let step = 1; step <= slantSteps; step += 1) {
    const s = startS + ((slantLength - startS) * step) / slantSteps;

    centers.push([rootX + dirX * s, 0, rootZ + dirZ * s]);

    if (step === slantSteps) {
      // Последнее кольцо наклонной части уже стоит в колене.
      normals.push([kneeX, 0, kneeZ]);
    } else {
      normals.push([dirX, 0, dirZ]);
    }
  }

  for (let step = 1; step <= stubSteps; step += 1) {
    centers.push([bendX, 0, bendZ + (stubMm * step) / stubSteps]);
    normals.push([0, 0, 1]);
  }

  const rings: number[][] = [];

  for (let ringIndex = 0; ringIndex < centers.length; ringIndex += 1) {
    const [centerX, centerY, centerZ] = centers[ringIndex];
    const [normalX, , normalZ] = normals[ringIndex];
    const ring: number[] = [];

    for (let side = 0; side < sides; side += 1) {
      const angle = (Math.PI * 2 * side) / sides;
      const cos = Math.cos(angle) * radiusMm;
      const sin = Math.sin(angle) * radiusMm;

      ring.push(
        pushVertex(
          centerX + normalZ * cos,
          centerY + sin,
          centerZ - normalX * cos,
        ),
      );
    }

    rings.push(ring);
  }

  // Нижний срез горизонтален, поэтому в сечении эллипс: труба наклонена.
  const startCenterX = rootX + dirX * startS;
  const ellipseHalfMm = radiusMm / dirZ;
  const startRing: number[] = [];

  for (let side = 0; side < sides; side += 1) {
    const angle = (Math.PI * 2 * side) / sides;

    startRing.push(
      pushVertex(
        startCenterX + ellipseHalfMm * Math.cos(angle),
        radiusMm * Math.sin(angle),
        bottomZ,
      ),
    );
  }

  const startCenter = pushVertex(startCenterX, 0, bottomZ);

  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;

    addTriangle(
      positions,
      vertices,
      startCenter,
      startRing[next],
      startRing[side],
    );
    addTriangle(
      positions,
      vertices,
      startRing[side],
      startRing[next],
      rings[0][next],
    );
    addTriangle(
      positions,
      vertices,
      startRing[side],
      rings[0][next],
      rings[0][side],
    );
  }

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const lower = rings[ringIndex];
    const upper = rings[ringIndex + 1];

    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;

      addTriangle(positions, vertices, lower[side], lower[next], upper[next]);
      addTriangle(positions, vertices, lower[side], upper[next], upper[side]);
    }
  }

  const topRing = rings[rings.length - 1];
  const [topX, topY, topZ] = centers[centers.length - 1];
  const topCenter = pushVertex(topX, topY, topZ);

  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;

    addTriangle(positions, vertices, topCenter, topRing[side], topRing[next]);
  }
}

/**
 * Сетка листа-лотка.
 *
 * Плита строится двумя параметрическими поверхностями и четырьмя полосами
 * боковой стенки. Крючок — отдельное замкнутое тело из `addHookTube`: его срез
 * лежит внутри плиты, и слайсер объединяет тела при печати.
 */
export function createJewelryLeafGeometry(
  params: Partial<JewelryStandParams>,
): BufferGeometry {
  const normalized = normalizeJewelryStandParams(params);
  const plan = leafPlan(normalized);
  const halfLength = plan.lengthMm / 2;
  const vertices: number[] = [];
  const top: number[][] = [];
  const bottom: number[][] = [];

  const pushVertex = (x: number, y: number, z: number): number => {
    const index = vertices.length / 3;

    vertices.push(x, y, z);

    return index;
  };

  for (let column = 0; column <= plan.columns; column += 1) {
    const t = column / plan.columns;
    const x = -halfLength + t * plan.lengthMm;
    const halfWidth = leafHalfWidth(plan, t);
    const topRow: number[] = [];
    const bottomRow: number[] = [];

    for (let row = 0; row <= plan.rows; row += 1) {
      const s = -1 + (2 * row) / plan.rows;
      const y = s * halfWidth;
      const relief = leafReliefMm(plan, x, y);

      topRow.push(pushVertex(x, y, plan.plateMm - relief));
      bottomRow.push(pushVertex(x, y, 0));
    }

    top.push(topRow);
    bottom.push(bottomRow);
  }

  const positions: number[] = [];

  // Верх: обход против часовой стрелки при взгляде сверху — наружу по +Z.
  for (let column = 0; column < plan.columns; column += 1) {
    for (let row = 0; row < plan.rows; row += 1) {
      const a = top[column][row];
      const b = top[column + 1][row];
      const c = top[column + 1][row + 1];
      const d = top[column][row + 1];

      addTriangle(positions, vertices, a, b, c);
      addTriangle(positions, vertices, a, c, d);
    }
  }

  // Низ: тот же контур, обратный обход — нормаль смотрит вниз.
  for (let column = 0; column < plan.columns; column += 1) {
    for (let row = 0; row < plan.rows; row += 1) {
      const a = bottom[column][row];
      const b = bottom[column + 1][row];
      const c = bottom[column + 1][row + 1];
      const d = bottom[column][row + 1];

      addTriangle(positions, vertices, a, c, b);
      addTriangle(positions, vertices, a, d, c);
    }
  }

  // Боковые стенки: каждая полоса соединяет верх и низ по общей линии контура.
  for (let column = 0; column < plan.columns; column += 1) {
    const topLow = top[column][0];
    const topLowNext = top[column + 1][0];
    const bottomLow = bottom[column][0];
    const bottomLowNext = bottom[column + 1][0];

    addTriangle(positions, vertices, topLow, bottomLow, bottomLowNext);
    addTriangle(positions, vertices, topLow, bottomLowNext, topLowNext);

    const topHigh = top[column][plan.rows];
    const topHighNext = top[column + 1][plan.rows];
    const bottomHigh = bottom[column][plan.rows];
    const bottomHighNext = bottom[column + 1][plan.rows];

    addTriangle(positions, vertices, topHigh, topHighNext, bottomHighNext);
    addTriangle(positions, vertices, topHigh, bottomHighNext, bottomHigh);
  }

  for (let row = 0; row < plan.rows; row += 1) {
    const topStem = top[0][row];
    const topStemNext = top[0][row + 1];
    const bottomStem = bottom[0][row];
    const bottomStemNext = bottom[0][row + 1];

    addTriangle(positions, vertices, topStem, topStemNext, bottomStemNext);
    addTriangle(positions, vertices, topStem, bottomStemNext, bottomStem);

    const topTip = top[plan.columns][row];
    const topTipNext = top[plan.columns][row + 1];
    const bottomTip = bottom[plan.columns][row];
    const bottomTipNext = bottom[plan.columns][row + 1];

    addTriangle(positions, vertices, topTip, bottomTip, bottomTipNext);
    addTriangle(positions, vertices, topTip, bottomTipNext, topTipNext);
  }

  // Крючок для цепочек: одна труба от нижнего среза в плите до макушки штыря.
  addHookTube(
    positions,
    vertices,
    pushVertex,
    -halfLength + JEWELRY_LEAF_HOOK_INSET_MM,
    plan.plateMm - JEWELRY_LEAF_HOOK_JOIN_MM,
    JEWELRY_LEAF_HOOK_RADIUS_MM,
    JEWELRY_LEAF_HOOK_SIDES,
  );

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}


