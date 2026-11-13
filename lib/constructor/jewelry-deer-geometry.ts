/**
 * Геометрия бюста «Лесной олень».
 *
 * Вторая форма премиум-коллекции: овальная база с полостью под утяжелитель и
 * стилизованный бюст без глаз, ушей и носа. Узнаваемость держится на рогах,
 * поэтому лицо остаётся гладкой поверхностью — это приём классической
 * скульптуры, а не упрощение.
 *
 * Бюст — один лофт по станциям от груди до кончика морды. Кольца стоят
 * перпендикулярно оси, поэтому на повороте к морде они наклоняются, и голова
 * получает «изгиб», а не трубу. Сечения — эллипсы: шея уже по X, чем по глубине.
 *
 * Рога — четыре трубы на сторону: ствол и три отростка. Каждый сегмент поднят
 * над столом не меньше 45°, то есть отклонён от вертикали не больше 45°: это и
 * есть правило печати без поддержек. Бутоны на концах — не шары, а плавное
 * утолщение последних 22 мм: шар дал бы нижнюю полусферу с нависанием 90°, а
 * плавный «бутон» укладывается в те же 45° и держит кольцо.
 *
 * База — эллиптическая плита 5.5 мм. Полость Ø25 × 4 мм открыта вверх, под ней
 * остаётся дно 1.5 мм, поэтому плита не сквозная и печатается без мостов:
 * монета или шайба ложится в полость заподлицо. Центр полости сдвинут на 12 мм
 * вперёд, под голову — туда, где стоит центр тяжести бюста; пятка шеи остаётся
 * позади полости, иначе монету было бы не опустить.
 *
 * Все тела замкнуты по отдельности и пересекаются: низ бюста уходит в базу на
 * миллиметр, корни рогов — в голову, корни отростков — в ствол. Слайсер
 * объединяет их при печати, булевых операций нет.
 *
 * Система координат общая для коллекции: Z вверх, низ на z = 0, центр базы в
 * начале координат, олень смотрит в −Y.
 */

import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  normalizeJewelryStandParams,
  type JewelryStandParams,
} from "@/lib/constructor/params";
import {
  addFanCap,
  addPrismSides,
  type Point2,
} from "@/lib/constructor/prism-mesh";

/** Высота овальной базы, мм: полость 4 мм плюс дно 1.5 мм. */
export const JEWELRY_DEER_BASE_HEIGHT_MM = 5.5;

/** Диаметр полости под монету или шайбу, мм: рубль и четвертак входят. */
export const JEWELRY_DEER_WEIGHT_DIAMETER_MM = 25;

/** Глубина полости, мм: монета 2–3 мм ложится ниже лица базы. */
export const JEWELRY_DEER_WEIGHT_DEPTH_MM = 4;

/** Дно под полостью, мм: плита остаётся не сквозной. */
export const JEWELRY_DEER_WEIGHT_FLOOR_MM = 1.5;

/**
 * Сдвиг полости вперёд от центра базы, мм.
 *
 * Бюст наклонён к морде, его центр тяжести стоит перед центром овала. Полость
 * смещена туда же — под голову и ближе к шее. Пятка шеи заканчивается на
 * 2·scale позади центра, поэтому между ней и полостью остаётся не меньше
 * миллиметра: монету можно опустить, не задев бюст.
 */
export const JEWELRY_DEER_WEIGHT_OFFSET_MM = 12;

/** Радиус ствола рога у основания, мм: Ø4 по ТЗ. */
export const JEWELRY_DEER_ANTLER_ROOT_RADIUS_MM = 2;

/** Радиус ствола на конце, мм: Ø3 до бутона. */
export const JEWELRY_DEER_ANTLER_TIP_RADIUS_MM = 1.5;

/** Радиус бутона, мм: Ø5.5 — кольцо и серьга не соскальзывают. */
export const JEWELRY_DEER_ANTLER_BUD_RADIUS_MM = 2.75;

/** Радиус отростка у основания, мм: тоньше ствола, но не хрупче. */
export const JEWELRY_DEER_TINE_ROOT_RADIUS_MM = 1.75;

/**
 * Подъём ствола над столом, градусы.
 *
 * 52° к горизонтали — это 38° от вертикали, то есть у самого предела печати без
 * поддержек. Круче нельзя: размах рогов на витринной базе увёл бы кончики за
 * 180 мм по высоте.
 */
export const JEWELRY_DEER_ANTLER_ELEVATION_DEG = 52;

/** Длина бутона ствола, мм: утолщение растянуто, иначе нависание. */
const JEWELRY_DEER_ANTLER_BUD_MM = 22;

/** Длина бутона отростка, мм: отросток короче, и бутон короче. */
const JEWELRY_DEER_TINE_BUD_MM = 10;

/** Доля длины трубы, выше которой бутон не растягивается. */
const JEWELRY_DEER_BUD_MAX_SHARE = 0.75;

/** Число сторон рогов, шт.: 12 хватает, чтобы кольцо не цеплялось. */
const JEWELRY_DEER_ANTLER_SIDES = 12;

/** Число точек кольца бюста, шт.: 40 — гладкая шея без граней. */
const JEWELRY_DEER_BUST_SIDES = 40;

/** Число сторон базы, шт.: 96 держит овал гладким на любом размере. */
const JEWELRY_DEER_BASE_SIDES = 96;

/** Низ бюста над столом, мм: миллиметр уходит внутрь базы на слияние. */
const JEWELRY_DEER_BUST_Z0_MM = 4.5;

/** Высота корня рога над столом в долях масштаба, мм. */
const JEWELRY_DEER_ANTLER_ROOT_HEIGHT_MM = 62;

/** Вынос корня рога от оси в долях масштаба, мм. */
const JEWELRY_DEER_ANTLER_ROOT_X_MM = 6;

/** Положение корня рога по Y в долях масштаба, мм: внутри затылка. */
const JEWELRY_DEER_ANTLER_ROOT_Y_MM = -9;

/** Куда уходит кончик ствола по Y, мм: рога слегка зачёсаны назад. */
const JEWELRY_DEER_ANTLER_TIP_Y_MM = 2;

/**
 * Станции бюста при базе 150 мм: `hMm` — высота над низом бюста.
 *
 * Шея узкая, грудь широкая, морда вытянутая и поднятая. Радиусы растут только
 * там, где ось ещё почти вертикальна: рост радиуса на наклонной оси добавляет
 * к нависанию свой угол, а сумма обязана остаться ниже 45°.
 */
const JEWELRY_DEER_STATIONS: readonly {
  readonly yMm: number;
  readonly hMm: number;
  readonly rxMm: number;
  readonly ryMm: number;
}[] = [
  { yMm: 14, hMm: 0, rxMm: 17, ryMm: 12 },
  { yMm: 13, hMm: 8, rxMm: 19, ryMm: 13 },
  { yMm: 10, hMm: 20, rxMm: 15, ryMm: 11 },
  { yMm: 6, hMm: 32, rxMm: 10.5, ryMm: 9 },
  { yMm: 2, hMm: 43, rxMm: 9.5, ryMm: 8.5 },
  { yMm: -1, hMm: 52, rxMm: 11, ryMm: 11 },
  { yMm: -5, hMm: 61, rxMm: 12.5, ryMm: 13 },
  { yMm: -9, hMm: 68, rxMm: 12.5, ryMm: 13.5 },
  { yMm: -13, hMm: 75, rxMm: 10, ryMm: 11 },
  { yMm: -17, hMm: 81, rxMm: 7, ryMm: 8 },
  { yMm: -21, hMm: 87, rxMm: 4.5, ryMm: 5 },
  { yMm: -24, hMm: 91, rxMm: 2.5, ryMm: 2.5 },
];

/**
 * Отростки рога: доля длины ствола, длина и направление.
 *
 * Направление задано в мировых осях для правого рога (`side = 1`); левый
 * получает зеркальный X. Подъём каждого отростка — 62–69°, поэтому нависания
 * нет даже с утолщением на конце.
 */
const JEWELRY_DEER_TINES: readonly {
  readonly share: number;
  readonly lengthMm: number;
  readonly direction: readonly [number, number, number];
}[] = [
  { share: 0.3, lengthMm: 20, direction: [0.1, -0.45, 0.88] },
  { share: 0.56, lengthMm: 18, direction: [0.16, -0.38, 0.91] },
  { share: 0.8, lengthMm: 15, direction: [0.2, 0.3, 0.93] },
];


/** Точка в пространстве, локальный тип модуля. */
type Vec3 = readonly [number, number, number];

/** Станция бюста после масштабирования: центр, высота и полуоси. */
export type JewelryDeerStation = {
  readonly yMm: number;
  readonly zMm: number;
  readonly rxMm: number;
  readonly ryMm: number;
};

/** Точка осевой линии рога: центр кольца и радиус трубы. */
export type JewelryDeerAntlerPoint = {
  readonly xMm: number;
  readonly yMm: number;
  readonly zMm: number;
  readonly radiusMm: number;
};

/** Одна труба рога: ствол или отросток. */
export type JewelryDeerAntlerPath = {
  /** Имя для тестов и отчёта: `beam-right`, `tine-2-left` и так далее. */
  readonly id: string;
  /** `beam` — ствол с бутоном на конце, `tine` — отросток. */
  readonly kind: "beam" | "tine";
  /** Сторона: −1 — левый рог, 1 — правый. */
  readonly side: -1 | 1;
  /** Осевая линия от корня до бутона. */
  readonly points: readonly JewelryDeerAntlerPoint[];
  /** Радиус бутона на конце, мм. */
  readonly budRadiusMm: number;
};

/** План оленя: всё, что считается один раз и проверяется тестом. */
export type JewelryDeerPlan = {
  readonly baseLengthMm: number;
  readonly baseWidthMm: number;
  readonly baseHeightMm: number;
  /** Центр полости на плоскости стола: X всегда 0, Y сдвинут к голове. */
  readonly pocketCenterMm: readonly [number, number];
  readonly pocketRadiusMm: number;
  readonly pocketDepthMm: number;
  readonly pocketFloorMm: number;
  readonly scale: number;
  readonly stations: readonly JewelryDeerStation[];
  readonly noseCapMm: number;
  readonly antlerSpreadMm: number;
  /** Крайняя точка рогов по X от оси, мм: размах с учётом толщины бутона. */
  readonly antlerOuterXMm: number;
  readonly antlers: readonly JewelryDeerAntlerPath[];
  readonly heightMm: number;
};

/** Сложение векторов. */
function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Разность векторов. */
function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** Умножение вектора на число. */
function multiply(v: Vec3, factor: number): Vec3 {
  return [v[0] * factor, v[1] * factor, v[2] * factor];
}

/** Длина вектора. */
function magnitude(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/** Единичный вектор; нулевой остаётся нулевым, чтобы не делить на ноль. */
function normalize(v: Vec3): Vec3 {
  const size = magnitude(v);

  return size > 1e-12 ? multiply(v, 1 / size) : [0, 0, 1];
}

/** Векторное произведение. */
function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** Гладкая ступень 0…1: у неё ограничена производная, а значит и нависание. */
function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 <= edge0) {
    return value >= edge1 ? 1 : 0;
  }

  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));

  return t * t * (3 - 2 * t);
}

/** Точка осевой линии как вектор. */
function pointToVec(point: JewelryDeerAntlerPoint): Vec3 {
  return [point.xMm, point.yMm, point.zMm];
}

/** Станция как вектор центра. */
function stationToVec(station: JewelryDeerStation): Vec3 {
  return [0, station.yMm, station.zMm];
}


/**
 * Базис кольца, перпендикулярного оси.
 *
 * `e1` берётся из мировой вертикали, поэтому у стоящего бюста кольцо всегда
 * смотрит «шириной» по X: слайдеры длины и ширины читаются однозначно. У рогов
 * ось наклонена, и `e1` уезжает в сторону — это нормально, труба круглая.
 */
function ringBasis(tangent: Vec3): { e1: Vec3; e2: Vec3 } {
  const reference: Vec3 = Math.abs(tangent[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = normalize(cross(reference, tangent));

  return { e1, e2: cross(tangent, e1) };
}

/** Касательные ломаной: на изломе — биссектриса, чтобы кольцо не разворачивалось. */
function polylineTangents(points: readonly Vec3[]): Vec3[] {
  if (points.length < 2) {
    return points.map(() => [0, 0, 1] as Vec3);
  }

  return points.map((point, index) => {
    if (index === 0) {
      return normalize(subtract(points[1], point));
    }

    if (index === points.length - 1) {
      return normalize(subtract(point, points[index - 1]));
    }

    return normalize(
      add(
        normalize(subtract(point, points[index - 1])),
        normalize(subtract(points[index + 1], point)),
      ),
    );
  });
}

/**
 * Одна труба рога с бутоном на конце.
 *
 * Радиус вдоль оси — линейный конус от основания к концу плюс гладкое
 * утолщение последних `budLengthMm`. Скорость утолщения ограничена
 * smoothstep: 1.5·Δr/L, поэтому даже короткий отросток не даёт нависания
 * круче 45° от вертикали.
 */
function createAntlerPath(options: {
  readonly id: string;
  readonly kind: "beam" | "tine";
  readonly side: -1 | 1;
  readonly rootMm: Vec3;
  readonly tipMm: Vec3;
  readonly rootRadiusMm: number;
  readonly tipRadiusMm: number;
  readonly budRadiusMm: number;
  readonly budLengthMm: number;
  readonly samples: readonly number[];
}): JewelryDeerAntlerPath {
  const axis = subtract(options.tipMm, options.rootMm);
  const fullLengthMm = magnitude(axis);
  const budLengthMm = Math.min(
    Math.max(options.budLengthMm, 1e-6),
    fullLengthMm * JEWELRY_DEER_BUD_MAX_SHARE,
  );
  const budStartMm = fullLengthMm - budLengthMm;

  const points = options.samples.map((share) => {
    const travelledMm = fullLengthMm * share;
    const center = add(options.rootMm, multiply(axis, share));
    const taper =
      options.rootRadiusMm +
      (options.tipRadiusMm - options.rootRadiusMm) * share;
    const bud = smoothstep(budStartMm, fullLengthMm, travelledMm);

    return {
      xMm: center[0],
      yMm: center[1],
      zMm: center[2],
      radiusMm: taper + (options.budRadiusMm - options.tipRadiusMm) * bud,
    };
  });

  return {
    id: options.id,
    kind: options.kind,
    side: options.side,
    points,
    budRadiusMm: options.budRadiusMm,
  };
}

/** Доли длины ствола, где стоят кольца: сгущение к бутону. */
const JEWELRY_DEER_BEAM_SAMPLES = [
  0, 0.2, 0.4, 0.55, 0.68, 0.76, 0.83, 0.89, 0.94, 0.97, 1,
] as const;

/** Доли длины отростка: шесть колец хватает на 15–20 мм. */
const JEWELRY_DEER_TINE_SAMPLES = [0, 0.32, 0.58, 0.78, 0.9, 1] as const;


/**
 * План оленя: станции, рога, полость и габарит.
 *
 * План считается без three.js и без меша — по нему строятся и геометрия, и
 * подписи, и проверки в `scripts/test-jewelry-geometry.ts`.
 */
export function jewelryDeerPlan(
  params: Partial<JewelryStandParams> = {},
): JewelryDeerPlan {
  const normalized = normalizeJewelryStandParams(params);
  const baseLengthMm = normalized.deerBaseLength;
  const baseWidthMm = normalized.deerBaseWidth;
  const antlerSpreadMm = normalized.deerAntlerSpread;
  const scale = baseLengthMm / 150;

  const stations = JEWELRY_DEER_STATIONS.map((station) => ({
    yMm: station.yMm * scale,
    zMm: JEWELRY_DEER_BUST_Z0_MM + station.hMm * scale,
    rxMm: station.rxMm * scale,
    ryMm: station.ryMm * scale,
  }));
  const noseStation = stations[stations.length - 1];
  const noseCapMm = Math.min(noseStation.rxMm, noseStation.ryMm);

  const rootZ =
    JEWELRY_DEER_BUST_Z0_MM + JEWELRY_DEER_ANTLER_ROOT_HEIGHT_MM * scale;
  const rootX = JEWELRY_DEER_ANTLER_ROOT_X_MM * scale;
  const rootY = JEWELRY_DEER_ANTLER_ROOT_Y_MM * scale;
  // Крайняя точка бутона отстоит от его центра на полный радиус: скруглённая
  // крышка — полусфера, и «наружу» в +X и +Z она выходит на budR, а не на budR·k.
  // Поэтому ось ствола заканчивается за вычетом этого радиуса, и напечатанный
  // размах совпадает с ползунком.
  const tipX = antlerSpreadMm / 2 - JEWELRY_DEER_ANTLER_BUD_RADIUS_MM;
  const tipY = JEWELRY_DEER_ANTLER_TIP_Y_MM * scale;
  const runMm = Math.hypot(tipX - rootX, tipY - rootY);
  const tipZ =
    rootZ +
    runMm * Math.tan((JEWELRY_DEER_ANTLER_ELEVATION_DEG * Math.PI) / 180);

  const antlers: JewelryDeerAntlerPath[] = [];

  for (const side of [-1, 1] as const) {
    const suffix = side < 0 ? "left" : "right";
    const rootMm: Vec3 = [side * rootX, rootY, rootZ];
    const tipMm: Vec3 = [side * tipX, tipY, tipZ];
    const beamAxis = normalize(subtract(tipMm, rootMm));
    const beamLengthMm = magnitude(subtract(tipMm, rootMm));

    antlers.push(
      createAntlerPath({
        id: `beam-${suffix}`,
        kind: "beam",
        side,
        rootMm,
        tipMm,
        rootRadiusMm: JEWELRY_DEER_ANTLER_ROOT_RADIUS_MM,
        tipRadiusMm: JEWELRY_DEER_ANTLER_TIP_RADIUS_MM,
        budRadiusMm: JEWELRY_DEER_ANTLER_BUD_RADIUS_MM,
        budLengthMm: JEWELRY_DEER_ANTLER_BUD_MM,
        samples: JEWELRY_DEER_BEAM_SAMPLES,
      }),
    );

    JEWELRY_DEER_TINES.forEach((tine, index) => {
      const anchor = add(
        rootMm,
        multiply(beamAxis, beamLengthMm * tine.share),
      );
      const direction = normalize([
        side * tine.direction[0],
        tine.direction[1],
        tine.direction[2],
      ]);

      antlers.push(
        createAntlerPath({
          id: `tine-${index + 1}-${suffix}`,
          kind: "tine",
          side,
          rootMm: anchor,
          tipMm: add(anchor, multiply(direction, tine.lengthMm * scale)),
          rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM,
          tipRadiusMm: JEWELRY_DEER_ANTLER_TIP_RADIUS_MM,
          budRadiusMm: JEWELRY_DEER_ANTLER_BUD_RADIUS_MM,
          budLengthMm: JEWELRY_DEER_TINE_BUD_MM,
          samples: JEWELRY_DEER_TINE_SAMPLES,
        }),
      );
    });
  }

  let antlerTopMm = 0;
  let antlerOuterXMm = 0;

  for (const path of antlers) {
    const last = path.points[path.points.length - 1];

    // Скруглённая крышка — полусфера радиуса бутона: её крайняя точка по X и Z
    // отстоит от центра ровно на радиус, потому что +X и +Z попадают в её
    // полусферу при любом подъёме рога больше нуля.
    antlerTopMm = Math.max(antlerTopMm, last.zMm + path.budRadiusMm);
    antlerOuterXMm = Math.max(
      antlerOuterXMm,
      Math.abs(last.xMm) + path.budRadiusMm,
    );
  }

  const noseTopMm = noseStation.zMm + noseCapMm;
  const heightMm = Math.round(Math.max(noseTopMm, antlerTopMm) * 100) / 100;

  return {
    baseLengthMm,
    baseWidthMm,
    baseHeightMm: JEWELRY_DEER_BASE_HEIGHT_MM,
    pocketCenterMm: [0, -JEWELRY_DEER_WEIGHT_OFFSET_MM],
    pocketRadiusMm: JEWELRY_DEER_WEIGHT_DIAMETER_MM / 2,
    pocketDepthMm: JEWELRY_DEER_WEIGHT_DEPTH_MM,
    pocketFloorMm: JEWELRY_DEER_WEIGHT_FLOOR_MM,
    scale,
    stations,
    noseCapMm,
    antlerSpreadMm,
    antlerOuterXMm,
    antlers,
    heightMm,
  };
}

/** Высота модели, мм: габарит по Z для подписи и предпросмотра. */
export function jewelryDeerHeightMm(
  params: Partial<JewelryStandParams> = {},
): number {
  return jewelryDeerPlan(params).heightMm;
}

/** Полуоси овальной базы: длина и ширина в тех же единицах, что слайдеры. */
export function jewelryDeerBaseRadiiMm(plan: JewelryDeerPlan): {
  readonly a: number;
  readonly b: number;
} {
  return { a: plan.baseLengthMm / 2, b: plan.baseWidthMm / 2 };
}


/** Полка верхней грани: четырехугольники между наружным и внутренним контуром. */
function addAnnulusCap(
  positions: number[],
  outer: readonly Point2[],
  inner: readonly Point2[],
  z: number,
): void {
  for (let index = 0; index < outer.length; index += 1) {
    const next = (index + 1) % outer.length;
    const [ox0, oy0] = outer[index];
    const [ox1, oy1] = outer[next];
    const [ix0, iy0] = inner[index];
    const [ix1, iy1] = inner[next];

    positions.push(
      ox0,
      oy0,
      z,
      ox1,
      oy1,
      z,
      ix0,
      iy0,
      z,
      ix0,
      iy0,
      z,
      ox1,
      oy1,
      z,
      ix1,
      iy1,
      z,
    );
  }
}

/**
 * Овальная база с полостью под утяжелитель.
 *
 * Тело замкнуто: наружная стенка, дно, полка верхней грани, стенка полости и её
 * дно. Стенка полости обходится в обратную сторону — её нормаль смотрит в
 * пустоту, иначе объём детали не сойдётся. Полость не сквозная: под ней
 * остаётся сплошное дно `pocketFloorMm`, поэтому принтер не тянет мост.
 */
function addDeerBase(positions: number[], plan: JewelryDeerPlan): void {
  const { a, b } = jewelryDeerBaseRadiiMm(plan);
  const height = plan.baseHeightMm;
  const floor = plan.pocketFloorMm;
  const [pocketX, pocketY] = plan.pocketCenterMm;
  const pocketRadius = plan.pocketRadiusMm;
  const sides = JEWELRY_DEER_BASE_SIDES;
  const outer: Point2[] = [];
  const inner: Point2[] = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = (Math.PI * 2 * index) / sides;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    outer.push([a * cos, b * sin]);
    inner.push([pocketX + pocketRadius * cos, pocketY + pocketRadius * sin]);
  }

  addPrismSides(positions, outer, 0, height);
  addFanCap(positions, outer, 0, false);
  addAnnulusCap(positions, outer, inner, height);
  addFanCap(positions, inner, floor, true);

  // Стенка полости: обход обратный наружному, нормаль смотрит в отверстие.
  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    const [ix0, iy0] = inner[index];
    const [ix1, iy1] = inner[next];

    positions.push(
      ix0,
      iy0,
      floor,
      ix0,
      iy0,
      height,
      ix1,
      iy1,
      height,
      ix0,
      iy0,
      floor,
      ix1,
      iy1,
      height,
      ix1,
      iy1,
      floor,
    );
  }
}

/** Стенки между двумя кольцами: кольца обходятся против часовой стрелки от +оси. */
function addRingWalls(
  positions: number[],
  start: readonly Vec3[],
  end: readonly Vec3[],
): void {
  const count = start.length;

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const [ax0, ay0, az0] = start[index];
    const [ax1, ay1, az1] = start[next];
    const [bx0, by0, bz0] = end[index];
    const [bx1, by1, bz1] = end[next];

    positions.push(
      ax0,
      ay0,
      az0,
      ax1,
      ay1,
      az1,
      bx1,
      by1,
      bz1,
      ax0,
      ay0,
      az0,
      bx1,
      by1,
      bz1,
      bx0,
      by0,
      bz0,
    );
  }
}

/** Веер от центра кольца: `forward` — нормаль вдоль оси, иначе против. */
function addRingFan(
  positions: number[],
  center: Vec3,
  ring: readonly Vec3[],
  forward: boolean,
): void {
  const [cx, cy, cz] = center;

  for (let index = 0; index < ring.length; index += 1) {
    const next = (index + 1) % ring.length;
    const [ax, ay, az] = ring[index];
    const [bx, by, bz] = ring[next];

    if (forward) {
      positions.push(cx, cy, cz, ax, ay, az, bx, by, bz);
    } else {
      positions.push(cx, cy, cz, bx, by, bz, ax, ay, az);
    }
  }
}

/** Полукруглая крышка трубы: три кольца и полюс, без единой плоской грани. */
function addRoundedCap(
  positions: number[],
  center: Vec3,
  tangent: Vec3,
  radius: number,
  ring: readonly Vec3[],
): void {
  const steps = [Math.PI / 8, Math.PI / 4, (Math.PI * 3) / 8];
  const { e1, e2 } = ringBasis(tangent);
  let previous = ring;

  for (const angle of steps) {
    const scale = Math.cos(angle);
    const offset = multiply(tangent, radius * Math.sin(angle));
    const next: Vec3[] = [];

    for (let index = 0; index < ring.length; index += 1) {
      const angleAround = (Math.PI * 2 * index) / ring.length;
      const radial = add(
        multiply(e1, Math.cos(angleAround) * radius * scale),
        multiply(e2, Math.sin(angleAround) * radius * scale),
      );

      next.push(add(add(center, offset), radial));
    }

    addRingWalls(positions, previous, next);
    previous = next;
  }

  const pole = add(center, multiply(tangent, radius));

  addRingFan(positions, pole, previous, true);
}


/**
 * Бюст: лофт по станциям от груди до морды.
 *
 * Низ закрыт плоской крышкой и утоплен в базу, верх — скруглённый кончик морды
 * высотой в радиус последнего кольца. Глаз, ушей и носа нет: силуэт держат
 * рога, а гладкая голова читается как скульптура.
 */
function addDeerBust(positions: number[], plan: JewelryDeerPlan): void {
  const sides = JEWELRY_DEER_BUST_SIDES;
  const centers = plan.stations.map(stationToVec);
  const tangents = polylineTangents(centers);

  const rings = plan.stations.map((station, index) => {
    const { e1, e2 } = ringBasis(tangents[index]);
    const ring: Vec3[] = [];

    for (let step = 0; step < sides; step += 1) {
      const angle = (Math.PI * 2 * step) / sides;

      ring.push(
        add(
          centers[index],
          add(
            multiply(e1, Math.cos(angle) * station.rxMm),
            multiply(e2, Math.sin(angle) * station.ryMm),
          ),
        ),
      );
    }

    return ring;
  });

  addRingFan(positions, centers[0], rings[0], false);

  for (let index = 0; index < rings.length - 1; index += 1) {
    addRingWalls(positions, rings[index], rings[index + 1]);
  }

  const last = rings.length - 1;

  addRoundedCap(
    positions,
    centers[last],
    tangents[last],
    plan.noseCapMm,
    rings[last],
  );
}

/** Одна труба рога: конус, стенки, крышки и бутон на конце. */
function addDeerAntler(
  positions: number[],
  path: JewelryDeerAntlerPath,
): void {
  const sides = JEWELRY_DEER_ANTLER_SIDES;
  const centers = path.points.map(pointToVec);
  const tangents = polylineTangents(centers);

  const rings = path.points.map((point, index) => {
    const { e1, e2 } = ringBasis(tangents[index]);
    const ring: Vec3[] = [];

    for (let step = 0; step < sides; step += 1) {
      const angle = (Math.PI * 2 * step) / sides;

      ring.push(
        add(
          centers[index],
          add(
            multiply(e1, Math.cos(angle) * point.radiusMm),
            multiply(e2, Math.sin(angle) * point.radiusMm),
          ),
        ),
      );
    }

    return ring;
  });

  // Корень утоплен в голову или в ствол: торец наружу не смотрит.
  addRingFan(positions, centers[0], rings[0], false);

  for (let index = 0; index < rings.length - 1; index += 1) {
    addRingWalls(positions, rings[index], rings[index + 1]);
  }

  const last = rings.length - 1;

  addRoundedCap(
    positions,
    centers[last],
    tangents[last],
    path.points[last].radiusMm,
    rings[last],
  );
}

/**
 * Геометрия бюста «Лесной олень» для набора параметров.
 *
 * Деталь построена Z-вверх; база и бюст стоят в начале координат, олень смотрит
 * в −Y. Все тела замкнуты по отдельности и пересекаются — слайсер объединит их
 * при печати.
 */
export function createJewelryDeerGeometry(
  params: Partial<JewelryStandParams> = {},
): BufferGeometry {
  const plan = jewelryDeerPlan(params);
  const positions: number[] = [];

  addDeerBase(positions, plan);
  addDeerBust(positions, plan);

  for (const path of plan.antlers) {
    addDeerAntler(positions, path);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

