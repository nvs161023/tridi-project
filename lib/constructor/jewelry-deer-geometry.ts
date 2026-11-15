/**
 * Геометрия подставки «Лесной олень».
 *
 * Вторая форма премиум-коллекции — гладкая скульптура стоящего оленя на
 * овальном лотке. Корпус и шея с головой построены лофтом: эллиптические
 * сечения соединяются в единую поверхность без граней и ступеней. Голова идёт
 * по анатомическому профилю из восьми опорных сечений и ста промежуточных
 * колец, поэтому линия носа, лба и затылка читается непрерывной кривой.
 * Четыре ноги — такие же сужающиеся лофт-трубы, а уши вырастают прямо из
 * колец черепа, не добавляя отдельного тела.
 *
 * Рога образуют высокую раскидистую крону, на которую вешают кольца, серьги и
 * цепочки. Их форма осталась прежней: два ствола на сторону задают развилку,
 * от них отходят первичные ветви, а часть первичных ветвится ещё раз. Осевые
 * линии — кубические Безье; кольца строятся параллельным переносом, поэтому
 * труба не перекручивается на изгибе. Каждый шаг ломаной поднимается не положе
 * 55° к столу (на компактных кронах — 65°) — это правило печати без поддержек.
 * На кончиках стоят небольшие бутоны: кольцо не соскальзывает.
 *
 * Лоток — овальная плита с полостью под монету сбоку от фигуры. Под оленем
 * стоит овальный плинт: в него утоплены нижние торцы четырёх ног. Все тела
 * замкнуты по отдельности; слайсер объединяет их при печати, булевых операций
 * нет. Нормали считаются по вершинам, а затем сглаживаются по углу до 60°:
 * лофты и трубы выглядят цельными, кромки лотка и плинта остаются чёткими.
 * В предпросмотре материал оленя гладкий, без `flatShading`.
 *
 * Высота фигуры ограничена 240 мм: если размах рогов поднимает крону выше,
 * плинт и вся фигура вместе с рогами равномерно уменьшаются, а лоток с
 * монетной полостью остаётся заданного размера. Тонкие ветви при этом не
 * опускаются ниже Ø3 мм, иначе они ломались бы при печати и использовании.
 *
 * Система координат общая для коллекции: Z вверх, низ на z = 0, центр лотка в
 * начале координат, олень смотрит в −Y.
 */

import { BufferGeometry, Float32BufferAttribute } from "three";

import { applyCreasedNormals } from "@/lib/constructor/mesh-normals";
import {
  normalizeJewelryStandParams,
  type JewelryStandParams,
} from "@/lib/constructor/params";
import {
  addFanCap,
  addPrismSides,
  type Point2,
} from "@/lib/constructor/prism-mesh";

/** Максимальная высота готовой модели, мм: поле печати обычного принтера. */
export const JEWELRY_DEER_MAX_HEIGHT_MM = 240;

/** Максимальный габарит модели по X и Y, мм: стол 250 × 250. */
export const JEWELRY_DEER_MAX_FOOTPRINT_MM = 250;

/** Минимальный диаметр ветви рога после масштабирования, мм. */
export const JEWELRY_DEER_MIN_ANTLER_DIAMETER_MM = 3;

/** Высота овального лотка, мм: полость 2.5 мм плюс дно 2.5 мм. */
export const JEWELRY_DEER_BASE_HEIGHT_MM = 5;

/** Диаметр полости под монету или шайбу, мм: рубль и четвертак входят. */
export const JEWELRY_DEER_WEIGHT_DIAMETER_MM = 25;

/** Глубина полости, мм: монета 2–3 мм ложится почти заподлицо с лицом лотка. */
export const JEWELRY_DEER_WEIGHT_DEPTH_MM = 2.5;

/** Дно под полостью, мм: лоток остаётся не сквозным. */
export const JEWELRY_DEER_WEIGHT_FLOOR_MM = 2.5;

/**
 * Сдвиг полости вбок от центра лотка, мм.
 *
 * Олень стоит по центру лотка, тело вытянуто по Y, а длинные стороны овала —
 * по X. Свободное поле остаётся справа и слева от фигуры: там и стоит круглая
 * чаша под монету, не задевая ни плинт, ни ноги. На узком лотке смещение
 * уменьшается, чтобы полость не вышла за кромку.
 */
export const JEWELRY_DEER_WEIGHT_OFFSET_MM = 60;

/** Радиус ствола рога у основания, мм: рога держат вес цепочки. */
export const JEWELRY_DEER_ANTLER_ROOT_RADIUS_MM = 7;

/** Радиус ствола на конце, мм: тонкий кончик не ломается при печати. */
export const JEWELRY_DEER_ANTLER_TIP_RADIUS_MM = 1.4;

/** Радиус бутона, мм: Ø3.6 — кольцо и серьга не соскальзывают. */
export const JEWELRY_DEER_ANTLER_BUD_RADIUS_MM = 1.8;

/** Радиус первичной ветви у основания, мм: тоньше ствола, но не хрупче. */
export const JEWELRY_DEER_TINE_ROOT_RADIUS_MM = 4.2;

/**
 * Минимальный подъём каждой хорды рога, градусы.
 *
 * 55° к столу оставляет 10° запаса к правилу 45°: даже скругление кончика и
 * утолщение-бутон не разворачивают нормаль вниз настолько, чтобы понадобилась
 * поддержка. Ломаная проверяется после выборки Безье, а не по контрольным
 * точкам — слайсер видит именно хорды.
 */
export const JEWELRY_DEER_ANTLER_MIN_ELEVATION_DEG = 55;

/** Число сторон рогов, шт.: 10 хватает, чтобы кольцо не цеплялось. */
const JEWELRY_DEER_ANTLER_SIDES = 10;

/** Сторон плинта: овал не требует большего. */
const JEWELRY_DEER_PLINTH_SIDES = 96;

/** Высота плинта, мм: скрывает нижние торцы ног. */
const JEWELRY_DEER_PLINTH_HEIGHT_MM = 6;

/** Число сторон ноги, шт.: 16 держат трубу гладкой после сглаживания. */
const JEWELRY_DEER_LEG_SIDES = 16;

/** Диаметр ноги у лапы, мм: тонкая изящная опора. */
export const JEWELRY_DEER_LEG_DIAMETER_MM = 5.2;

/** Высота ноги от лотка до верхнего сечения внутри корпуса, мм. */
export const JEWELRY_DEER_LEG_HEIGHT_MM = 35;

/** Смещение ног по X от оси, мм: верхние сечения входят в корпус. */
export const JEWELRY_DEER_LEG_OFFSET_X_MM = 12;

/** Смещение передней и задней пары ног по Y, мм. */
export const JEWELRY_DEER_LEG_OFFSET_Y_MM = 17;

/** Длина корпуса по Y, мм: компактный гладкий торс. */
export const JEWELRY_DEER_TORSO_LENGTH_MM = 55;

/** Ширина корпуса по X, мм: уже основания шеи, с килевым брюхом. */
export const JEWELRY_DEER_TORSO_WIDTH_MM = 28;

/** Высота корпуса по Z, мм. */
export const JEWELRY_DEER_TORSO_HEIGHT_MM = 36;

/** Центр корпуса над низом детали, мм. */
export const JEWELRY_DEER_TORSO_CENTER_Z_MM = 35;

/** Число колец головы и шеи, шт.: 99 поясов дают непрерывный силуэт. */
export const JEWELRY_DEER_HEAD_SECTIONS = 100;

/** Точек в одном сечении головы, шт.: шаг 5.625° незаметен после сглаживания. */
export const JEWELRY_DEER_HEAD_SECTION_POINTS = 64;

/** Число колец корпуса, шт.: 96 поясов вдоль Y. */
export const JEWELRY_DEER_BODY_SECTIONS = 96;

/** Точек в сечении корпуса, шт.: 48 держат овал гладким. */
export const JEWELRY_DEER_BODY_POINTS = 48;

/**
 * Анатомические опорные сечения головы.
 *
 * `heightYMm` — координата вдоль вертикальной оси в авторской системе эскиза,
 * `forwardZMm` — смещение вперёд (отрицательное Z), `widthMm` и `heightMm` —
 * полные оси эллипса в плоскости, перпендикулярной оси головы. В мировых
 * координатах высота становится Z, а вперёд — −Y; общий сдвиг задаёт
 * `JEWELRY_DEER_HEAD_ORIGIN_Z_MM`.
 */
export const JEWELRY_DEER_HEAD_PROFILE = [
  { heightYMm: 10, forwardZMm: 10, widthMm: 36, heightMm: 40 },
  { heightYMm: 45, forwardZMm: 0, widthMm: 28, heightMm: 32 },
  { heightYMm: 70, forwardZMm: -15, widthMm: 24, heightMm: 28 },
  { heightYMm: 90, forwardZMm: -20, widthMm: 26, heightMm: 26 },
  { heightYMm: 105, forwardZMm: -25, widthMm: 22, heightMm: 22 },
  { heightYMm: 105, forwardZMm: -40, widthMm: 16, heightMm: 18 },
  { heightYMm: 95, forwardZMm: -55, widthMm: 10, heightMm: 12 },
  { heightYMm: 88, forwardZMm: -65, widthMm: 8, heightMm: 10 },
] as const;

/** Индексы колец, в которые точно попадают восемь опорных сечений. */
export const JEWELRY_DEER_HEAD_ANCHOR_SECTIONS = [
  0, 14, 28, 42, 56, 70, 84, 99,
] as const;

/** Сдвиг профиля по высоте: основание шеи входит в корпус. */
export const JEWELRY_DEER_HEAD_ORIGIN_Z_MM =
  JEWELRY_DEER_BASE_HEIGHT_MM + 30;

/** Сечение, где уши достигают максимального выноса. */
export const JEWELRY_DEER_EAR_PEAK_SECTION = 42;

/** Полная ширина окна уха вдоль оси, в кольцах. */
const JEWELRY_DEER_EAR_WINDOW_SECTIONS = 16;

/** Вынос кончика уха в сторону от поверхности черепа, мм. */
const JEWELRY_DEER_EAR_OUT_MM = 6;

/** Подъём уха над осью сечения, мм: вырост растёт наружу и вверх. */
const JEWELRY_DEER_EAR_UP_MM = 20;

/** Угловой лепесток уха: степень 8 даёт узкое вертикальное основание. */
const JEWELRY_DEER_EAR_ANGULAR_POWER = 8;

/** Доля полуоси, где нижняя дуга головы переходит в киль: `1/√2`. */
const JEWELRY_DEER_JAW_SIDE_SHARE = Math.SQRT1_2;

/** Глубина киля к полуоси: 0.8 даёт грани круче 45° к столу. */
const JEWELRY_DEER_JAW_DEPTH_SHARE = 0.8;

/** Число сторон базы, шт.: 96 держит овал гладким на любом размере. */
const JEWELRY_DEER_BASE_SIDES = 96;

/** Одно эллиптическое сечение головы: центр, касательная и полуоси. */
export type JewelryDeerHeadSection = {
  /** Порядковый номер вдоль оси, от 0 до 99. */
  readonly index: number;
  /** Доля пройденной длины оси, 0…1. */
  readonly share: number;
  /** Центр эллипса на оси, мм. */
  readonly centerMm: Vec3;
  /** Единичная касательная оси, мм. */
  readonly tangentMm: Vec3;
  /** Полуось по X, мм: ширина головы. */
  readonly radiusXMm: number;
  /** Полуось в плоскости сечения, мм: высота эллипса. */
  readonly radiusUpMm: number;
};

/** Опорное сечение из эскиза, попавшее в конкретное кольцо лофта. */
export type JewelryDeerHeadAnchor = {
  /** Номер опорного сечения, 1…8. */
  readonly number: number;
  /** Индекс кольца, в которое оно попало. */
  readonly sectionIndex: number;
  /** Исходные координаты эскиза, мм. */
  readonly heightYMm: number;
  readonly forwardZMm: number;
  /** Полные оси эллипса из эскиза, мм. */
  readonly widthMm: number;
  readonly heightMm: number;
  /** Центр и полуоси после переноса в мировую систему, мм. */
  readonly centerMm: Vec3;
  readonly radiusXMm: number;
  readonly radiusUpMm: number;
};

/** Голова и шея — единый гладкий лофт по анатомическому профилю. */
export type JewelryDeerHead = {
  readonly sections: readonly JewelryDeerHeadSection[];
  readonly sectionCount: number;
  readonly pointsPerSection: number;
  readonly anchors: readonly JewelryDeerHeadAnchor[];
  /** Точка носа на оси, мм. */
  readonly noseMm: Vec3;
  /** Верх гладкой поверхности без рогов, мм. */
  readonly crownZMm: number;
  /** Точка роста рогов на макушке, мм. */
  readonly antlerRootMm: Vec3;
};

/** Одно эллиптическое сечение корпуса. */
export type JewelryDeerBodySection = {
  readonly index: number;
  readonly share: number;
  readonly centerMm: Vec3;
  readonly radiusXMm: number;
  readonly radiusUpMm: number;
};

/** Корпус — гладкий лофт вдоль Y, от груди к крупу. */
export type JewelryDeerBody = {
  readonly sections: readonly JewelryDeerBodySection[];
  readonly sectionCount: number;
  readonly pointsPerSection: number;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly bottomZMm: number;
  readonly centerYMm: number;
  readonly topZMm: number;
};

/** Овальный плинт под фигурой: длина по Y, ширина по X. */
export type JewelryDeerPlinth = {
  readonly centerMm: readonly [number, number];
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly topZMm: number;
};

/** Точка осевой линии ноги. */
export type JewelryDeerLimbPoint = {
  readonly xMm: number;
  readonly yMm: number;
  readonly zMm: number;
  readonly radiusMm: number;
};

/** Нога — гладкая сужающаяся лофт-труба, утопленная в корпус. */
export type JewelryDeerLeg = {
  readonly id: string;
  readonly points: readonly JewelryDeerLimbPoint[];
  readonly sides: number;
};

/** Точка в пространстве, локальный тип модуля. */
type Vec3 = readonly [number, number, number];

/** Ухо: информативные корень и кончик; поверхность уже в лофте головы. */
export type JewelryDeerEar = {
  readonly id: string;
  readonly rootMm: Vec3;
  readonly tipMm: Vec3;
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
  /** Центр полости на плоскости стола: сбоку от фигуры. */
  readonly pocketCenterMm: readonly [number, number];
  /** Смещение полости от центра, мм: на узком лотке поджимается к кромке. */
  readonly pocketOffsetMm: number;
  readonly pocketRadiusMm: number;
  readonly pocketDepthMm: number;
  readonly pocketFloorMm: number;
  /** Масштаб фигуры поверх авторских размеров: 0…1, вписывает высоту в 240 мм. */
  readonly fitScale: number;
  readonly plinth: JewelryDeerPlinth;
  readonly body: JewelryDeerBody;
  readonly legs: readonly JewelryDeerLeg[];
  readonly head: JewelryDeerHead;
  /** Верх головы без рогов, мм. */
  readonly crownZMm: number;
  /** Верх рогов, мм: самая высокая точка модели. */
  readonly antlerTopZMm: number;
  readonly antlerSpreadMm: number;
  /** Крайняя точка рогов по X от оси, мм: размах с учётом толщины бутона. */
  readonly antlerOuterXMm: number;
  readonly antlers: readonly JewelryDeerAntlerPath[];
  readonly ears: readonly JewelryDeerEar[];
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

/** Линейная интерполяция двух чисел. */
function lerpNumber(from: number, to: number, share: number): number {
  return from + (to - from) * share;
}

/** Точка кубической кривой Безье. */
function cubicBezierAt(
  controls: readonly [Vec3, Vec3, Vec3, Vec3],
  share: number,
): Vec3 {
  const inverse = 1 - share;
  const a = inverse * inverse * inverse;
  const b = 3 * inverse * inverse * share;
  const c = 3 * inverse * share * share;
  const d = share * share * share;

  return [
    controls[0][0] * a + controls[1][0] * b + controls[2][0] * c + controls[3][0] * d,
    controls[0][1] * a + controls[1][1] * b + controls[2][1] * c + controls[3][1] * d,
    controls[0][2] * a + controls[1][2] * b + controls[2][2] * c + controls[3][2] * d,
  ];
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

/** Плавное значение кусочно-заданного профиля без ступенек на стыках. */
function profileValue(
  profile: readonly (readonly [number, number])[],
  share: number,
): number {
  if (share <= profile[0][0]) {
    return profile[0][1];
  }

  for (let index = 0; index < profile.length - 1; index += 1) {
    const [fromShare, fromValue] = profile[index];
    const [toShare, toValue] = profile[index + 1];

    if (share <= toShare) {
      return lerpNumber(
        fromValue,
        toValue,
        smoothstep(fromShare, toShare, share),
      );
    }
  }

  return profile[profile.length - 1][1];
}

/** Кубическая интерполяция Эрмита: значение и производная на концах. */
function hermiteValue(
  from: number,
  to: number,
  fromTangent: number,
  toTangent: number,
  share: number,
): number {
  const share2 = share * share;
  const share3 = share2 * share;
  const h00 = 2 * share3 - 3 * share2 + 1;
  const h10 = share3 - 2 * share2 + share;
  const h01 = -2 * share3 + 3 * share2;
  const h11 = share3 - share2;

  return h00 * from + h10 * fromTangent + h01 * to + h11 * toTangent;
}

/** Производная кубического Эрмита по параметру участка. */
function hermiteTangent(
  from: number,
  to: number,
  fromTangent: number,
  toTangent: number,
  share: number,
): number {
  const share2 = share * share;
  const h00 = 6 * share2 - 6 * share;
  const h10 = 3 * share2 - 4 * share + 1;
  const h01 = -6 * share2 + 6 * share;
  const h11 = 3 * share2 - 2 * share;

  return h00 * from + h10 * fromTangent + h01 * to + h11 * toTangent;
}

/** Центральные разности опорных значений: касательные Catmull-Rom. */
function splineTangents(values: readonly number[]): number[] {
  return values.map((_, index) => {
    if (index === 0) {
      return values[1] - values[0];
    }

    if (index === values.length - 1) {
      return values[index] - values[index - 1];
    }

    return (values[index + 1] - values[index - 1]) / 2;
  });
}

/** Центр опорного сечения в мировой системе: Z вверх, вперёд — −Y. */
function headProfileCenter(
  profile: (typeof JEWELRY_DEER_HEAD_PROFILE)[number],
): Vec3 {
  return [
    0,
    profile.forwardZMm,
    JEWELRY_DEER_HEAD_ORIGIN_Z_MM + profile.heightYMm,
  ];
}

/**
 * Гладкая ось головы и 100 колец по восьми опорным сечениям.
 *
 * Между соседними сечениями действует кубический Эрмит с касательными
 * Catmull-Rom. Он проходит точно через все восемь точек и сохраняет общую
 * касательную на стыках, поэтому нет изломов ни на лбу, ни на переносице.
 * Семь участков получают 14, 14, 14, 14, 14, 14 и 15 шагов: вместе с
 * начальным кольцом это ровно 100 сечений.
 */
function buildSmoothHeadSections(): readonly {
  readonly centerMm: Vec3;
  readonly tangentMm: Vec3;
  readonly radiusXMm: number;
  readonly radiusUpMm: number;
}[] {
  const centers = JEWELRY_DEER_HEAD_PROFILE.map(headProfileCenter);
  const widths = JEWELRY_DEER_HEAD_PROFILE.map((point) => point.widthMm / 2);
  const heights = JEWELRY_DEER_HEAD_PROFILE.map(
    (point) => point.heightMm / 2,
  );
  const xValues = centers.map((point) => point[0]);
  const yValues = centers.map((point) => point[1]);
  const zValues = centers.map((point) => point[2]);
  const xTangents = splineTangents(xValues);
  const yTangents = splineTangents(yValues);
  const zTangents = splineTangents(zValues);
  const widthTangents = splineTangents(widths);
  const heightTangents = splineTangents(heights);
  const anchorIndices = JEWELRY_DEER_HEAD_ANCHOR_SECTIONS;
  const result: {
    centerMm: Vec3;
    tangentMm: Vec3;
    radiusXMm: number;
    radiusUpMm: number;
  }[] = [];

  for (let span = 0; span < anchorIndices.length - 1; span += 1) {
    const from = span;
    const to = span + 1;
    const steps = anchorIndices[to] - anchorIndices[from];

    for (let step = 0; step <= steps; step += 1) {
      if (span > 0 && step === 0) {
        continue;
      }

      const share = step / steps;
      const centerMm: Vec3 = [
        hermiteValue(
          xValues[from],
          xValues[to],
          xTangents[from],
          xTangents[to],
          share,
        ),
        hermiteValue(
          yValues[from],
          yValues[to],
          yTangents[from],
          yTangents[to],
          share,
        ),
        hermiteValue(
          zValues[from],
          zValues[to],
          zTangents[from],
          zTangents[to],
          share,
        ),
      ];
      const tangentMm: Vec3 = [
        hermiteTangent(
          xValues[from],
          xValues[to],
          xTangents[from],
          xTangents[to],
          share,
        ),
        hermiteTangent(
          yValues[from],
          yValues[to],
          yTangents[from],
          yTangents[to],
          share,
        ),
        hermiteTangent(
          zValues[from],
          zValues[to],
          zTangents[from],
          zTangents[to],
          share,
        ),
      ];

      result.push({
        centerMm,
        tangentMm: normalize(tangentMm),
        radiusXMm: Math.max(
          0.2,
          hermiteValue(
            widths[from],
            widths[to],
            widthTangents[from],
            widthTangents[to],
            share,
          ),
        ),
        radiusUpMm: Math.max(
          0.2,
          hermiteValue(
            heights[from],
            heights[to],
            heightTangents[from],
            heightTangents[to],
            share,
          ),
        ),
      });
    }
  }

  // Восемь опорных значений должны попасть в сетку без интерполяционной
  // погрешности: иначе тест и геометрия разойдутся на сотые доли миллиметра.
  for (let index = 0; index < anchorIndices.length; index += 1) {
    const sectionIndex = anchorIndices[index];
    const profile = JEWELRY_DEER_HEAD_PROFILE[index];

    result[sectionIndex] = {
      centerMm: headProfileCenter(profile),
      tangentMm: result[sectionIndex].tangentMm,
      radiusXMm: profile.widthMm / 2,
      radiusUpMm: profile.heightMm / 2,
    };
  }

  return result;
}

/** Точка осевой линии как вектор. */
function pointToVec(point: JewelryDeerAntlerPoint): Vec3 {
  return [point.xMm, point.yMm, point.zMm];
}

/** Скалярное произведение. */
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Базис трубы: два единичных вектора, перпендикулярных оси.
 *
 * Для первой точки изогнутой трубы мировая X проецируется на плоскость кольца:
 * грань не перекручивается, а дальше рамка переносится параллельно от кольца к
 * кольцу. Этого достаточно и для стволов рогов, и для ветвей, и для ног.
 */
function tubeFrame(axis: Vec3): { e1: Vec3; e2: Vec3 } {
  const reference: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = normalize(subtract(reference, multiply(axis, dot(reference, axis))));

  return { e1, e2: cross(axis, e1) };
}

/**
 * Поднимает точку так, чтобы хорда от предыдущей шла не положе `minDeg`.
 *
 * Без этого кубическая кривая может «выстрелить» вбок почти горизонтально и
 * дать нависание, которого не видно по контрольным точкам. Функция меняет
 * только Z: план по X и Y, а значит размах рогов, остаётся прежним.
 */
function enforceMinElevation(
  points: readonly Vec3[],
  minDeg: number,
): { xMm: number; yMm: number; zMm: number }[] {
  const tangent = Math.tan((minDeg * Math.PI) / 180);
  const result: { xMm: number; yMm: number; zMm: number }[] = [];

  for (const [x, y, z] of points) {
    if (result.length === 0) {
      result.push({ xMm: x, yMm: y, zMm: z });
      continue;
    }

    const previous = result[result.length - 1];
    const run = Math.hypot(x - previous.xMm, y - previous.yMm);
    const minZ = previous.zMm + run * tangent;

    result.push({ xMm: x, yMm: y, zMm: Math.max(z, minZ) });
  }

  return result;
}

/** Точки кубической кривой без радиуса: общая заготовка для труб. */
function sampleCubic(
  controls: readonly [Vec3, Vec3, Vec3, Vec3],
  samples: number,
): Vec3[] {
  const points: Vec3[] = [];

  for (let index = 0; index < samples; index += 1) {
    const share = samples > 1 ? index / (samples - 1) : 0;

    points.push(cubicBezierAt(controls, share));
  }

  return points;
}

/**
 * Одна изогнутая труба рога с бутоном на конце.
 *
 * Осевая линия — кубическая Безье. После выборки каждая хорда поднимается не
 * положе `JEWELRY_DEER_ANTLER_MIN_ELEVATION_DEG`, поэтому слайсер не поставит
 * поддержку. Радиус линейно сужается, а на последних 20 % мягко раздаётся в
 * бутон: кольцо останавливается на нём, а не соскальзывает с гладкого конуса.
 */
function createAntlerPath(options: {
  readonly id: string;
  readonly kind: "beam" | "tine";
  readonly side: -1 | 1;
  readonly controls: readonly [Vec3, Vec3, Vec3, Vec3];
  readonly rootRadiusMm: number;
  readonly tipRadiusMm: number;
  readonly budRadiusMm: number;
  readonly samples: number;
  readonly minElevationDeg: number;
}): JewelryDeerAntlerPath {
  const centers = enforceMinElevation(
    sampleCubic(options.controls, options.samples),
    options.minElevationDeg,
  );
  const points = centers.map((center, index) => {
    const share = centers.length > 1 ? index / (centers.length - 1) : 1;
    const bud = smoothstep(0.8, 1, share);

    return {
      xMm: center.xMm,
      yMm: center.yMm,
      zMm: center.zMm,
      radiusMm:
        lerpNumber(options.rootRadiusMm, options.tipRadiusMm, share) +
        (options.budRadiusMm - options.tipRadiusMm) * bud,
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

/**
 * Ветвь рога в нормированных координатах кроны.
 *
 * `tip`, `c1` и `c2` заданы долями: X — половины размаха, Y — глубины кроны,
 * Z — высоты над корнем. `parent` — имя ствола или ветви, `attach` — доля её
 * длины, откуда растёт эта ветвь. Так все развилки получаются связанными.
 */
type JewelryDeerAntlerBranchSpec = {
  readonly id: string;
  readonly parent: string | null;
  readonly attach: number;
  readonly tip: readonly [number, number, number];
  readonly c1: readonly [number, number, number];
  readonly c2: readonly [number, number, number];
  readonly rootRadiusMm: number;
  readonly samples: number;
};

/**
 * Крона: два ствола на сторону и одиннадцать ветвей.
 *
 * Нормированные Z подобраны так, чтобы даже нижние ветви уходили вверх круче
 * 55°. Стволы задают силуэт дерева; ветви заполняют его ярусами, а три
 * развилки добавляют ярус третьего порядка. Форма повторяется зеркально,
 * поэтому крона читается симметричной, как на референсе.
 */
const JEWELRY_DEER_ANTLER_BRANCHES: readonly JewelryDeerAntlerBranchSpec[] = [
  {
    id: "beam-out",
    parent: null,
    attach: 0,
    tip: [1, -0.08, 1],
    c1: [0.02, -0.02, 0.34],
    c2: [0.56, -0.14, 0.78],
    rootRadiusMm: JEWELRY_DEER_ANTLER_ROOT_RADIUS_MM,
    samples: 18,
  },
  {
    id: "beam-in",
    parent: "beam-out",
    attach: 0.14,
    tip: [0.34, -0.04, 0.96],
    c1: [0.06, -0.04, 0.5],
    c2: [0.2, -0.1, 0.78],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 1.2,
    samples: 16,
  },
  {
    id: "out-1",
    parent: "beam-out",
    attach: 0.16,
    tip: [0.62, -0.18, 0.42],
    c1: [0.2, -0.1, 0.24],
    c2: [0.45, -0.16, 0.33],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM,
    samples: 11,
  },
  {
    id: "out-2",
    parent: "beam-out",
    attach: 0.3,
    tip: [0.94, -0.3, 0.6],
    c1: [0.4, -0.1, 0.4],
    c2: [0.72, -0.25, 0.5],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM,
    samples: 11,
  },
  {
    id: "out-3",
    parent: "beam-out",
    attach: 0.44,
    tip: [0.99, 0.05, 0.76],
    c1: [0.56, 0, 0.58],
    c2: [0.82, 0.02, 0.67],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.92,
    samples: 11,
  },
  {
    id: "out-4",
    parent: "beam-out",
    attach: 0.58,
    tip: [0.8, 0.18, 0.86],
    c1: [0.6, 0.08, 0.7],
    c2: [0.72, 0.12, 0.79],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.84,
    samples: 10,
  },
  {
    id: "out-5",
    parent: "beam-out",
    attach: 0.74,
    tip: [0.56, -0.15, 0.95],
    c1: [0.56, 0, 0.82],
    c2: [0.52, -0.1, 0.89],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.76,
    samples: 10,
  },
  {
    id: "in-1",
    parent: "beam-in",
    attach: 0.38,
    tip: [0.62, -0.32, 0.5],
    c1: [0.3, -0.18, 0.38],
    c2: [0.48, -0.28, 0.44],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.9,
    samples: 10,
  },
  {
    id: "in-2",
    parent: "beam-in",
    attach: 0.58,
    tip: [0.38, -0.42, 0.7],
    c1: [0.32, -0.25, 0.58],
    c2: [0.34, -0.36, 0.64],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.8,
    samples: 10,
  },
  {
    id: "in-3",
    parent: "beam-in",
    attach: 0.76,
    tip: [0.14, -0.28, 0.88],
    c1: [0.23, -0.2, 0.78],
    c2: [0.16, -0.25, 0.83],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.7,
    samples: 9,
  },
  {
    id: "out-2a",
    parent: "out-2",
    attach: 0.55,
    tip: [0.72, -0.5, 0.74],
    c1: [0.65, -0.38, 0.62],
    c2: [0.68, -0.48, 0.68],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.55,
    samples: 9,
  },
  {
    id: "in-1a",
    parent: "in-1",
    attach: 0.55,
    tip: [0.78, -0.45, 0.68],
    c1: [0.7, -0.4, 0.56],
    c2: [0.75, -0.45, 0.62],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.5,
    samples: 9,
  },
  {
    id: "out-3a",
    parent: "out-3",
    attach: 0.58,
    tip: [1, -0.2, 0.9],
    c1: [0.86, -0.18, 0.76],
    c2: [0.94, -0.22, 0.83],
    rootRadiusMm: JEWELRY_DEER_TINE_ROOT_RADIUS_MM * 0.45,
    samples: 9,
  },
];


/**
 * План оленя до ограничения габарита.
 *
 * План считается без three.js и без меша — по нему строятся и геометрия, и
 * подписи, и проверки в `scripts/test-jewelry-geometry.ts`. Габарит фигуры
 * выводится из размеров лотка, а высота рогов — из размаха. На максимальных
 * ползунках авторская крона выходит около 410 мм, поэтому публичный
 * `jewelryDeerPlan` дополнительно вписывает её в печатный конверт.
 */
function buildJewelryDeerPlan(
  params: Partial<JewelryStandParams> = {},
): JewelryDeerPlan {
  const normalized = normalizeJewelryStandParams(params);
  const baseLengthMm = normalized.deerBaseLength;
  const baseWidthMm = normalized.deerBaseWidth;
  const antlerSpreadMm = normalized.deerAntlerSpread;
  const pocketRadiusMm = JEWELRY_DEER_WEIGHT_DIAMETER_MM / 2;
  const pocketOffsetMm = Math.min(
    JEWELRY_DEER_WEIGHT_OFFSET_MM,
    baseLengthMm / 2 - pocketRadiusMm - 2,
  );

  // Корпус стоит на ногах. Его низ на 26 мм выше стола, верх входит в основание
  // шеи; все размеры ниже — авторские, до общего вписывания в 240 мм.
  const bodyBottomZMm =
    JEWELRY_DEER_BASE_HEIGHT_MM + JEWELRY_DEER_TORSO_CENTER_Z_MM -
    JEWELRY_DEER_TORSO_HEIGHT_MM / 2;
  const bodyRadiusXMm = JEWELRY_DEER_TORSO_WIDTH_MM / 2;
  const bodyRadiusUpMm = JEWELRY_DEER_TORSO_HEIGHT_MM / 2;
  const bodyWidthProfile = [
    [0, 0.7],
    [0.16, 0.9],
    [0.34, 1],
    [0.66, 1],
    [0.84, 1.01],
    [0.95, 0.96],
    [1, 0.84],
  ] as const;
  const bodyHeightProfile = [
    [0, 0.68],
    [0.16, 0.9],
    [0.36, 1],
    [0.68, 1],
    [0.86, 0.99],
    [0.96, 0.92],
    [1, 0.8],
  ] as const;
  const bodySections: JewelryDeerBodySection[] = [];

  for (let index = 0; index <= JEWELRY_DEER_BODY_SECTIONS; index += 1) {
    const share = index / JEWELRY_DEER_BODY_SECTIONS;
    const radiusXMm = bodyRadiusXMm * profileValue(bodyWidthProfile, share);
    const radiusUpMm =
      bodyRadiusUpMm * profileValue(bodyHeightProfile, share);

    bodySections.push({
      index,
      share,
      centerMm: [
        0,
        (share - 0.5) * JEWELRY_DEER_TORSO_LENGTH_MM,
        bodyBottomZMm + radiusUpMm,
      ],
      radiusXMm,
      radiusUpMm,
    });
  }

  const bodyTopZMm = Math.max(
    ...bodySections.map(
      (section) => section.centerMm[2] + section.radiusUpMm,
    ),
  );
  const body: JewelryDeerBody = {
    sections: bodySections,
    sectionCount: JEWELRY_DEER_BODY_SECTIONS,
    pointsPerSection: JEWELRY_DEER_BODY_POINTS,
    lengthMm: JEWELRY_DEER_TORSO_LENGTH_MM,
    widthMm: JEWELRY_DEER_TORSO_WIDTH_MM,
    heightMm: JEWELRY_DEER_TORSO_HEIGHT_MM,
    bottomZMm: bodyBottomZMm,
    centerYMm: 0,
    topZMm: bodyTopZMm,
  };

  const plinthWidthMm = body.widthMm * 1.7;
  const plinthLengthMm = body.lengthMm * 1.4;
  const plinth: JewelryDeerPlinth = {
    centerMm: [0, 0],
    lengthMm: plinthLengthMm,
    widthMm: plinthWidthMm,
    heightMm: JEWELRY_DEER_PLINTH_HEIGHT_MM,
    topZMm: JEWELRY_DEER_BASE_HEIGHT_MM + JEWELRY_DEER_PLINTH_HEIGHT_MM,
  };

  const smoothHeadSections = buildSmoothHeadSections();
  const headSections: JewelryDeerHeadSection[] = smoothHeadSections.map(
    (section, index) => ({
      index,
      share: index / (smoothHeadSections.length - 1),
      ...section,
    }),
  );
  const headAnchors: JewelryDeerHeadAnchor[] =
    JEWELRY_DEER_HEAD_ANCHOR_SECTIONS.map((sectionIndex, index) => {
      const profile = JEWELRY_DEER_HEAD_PROFILE[index];

      return {
        number: index + 1,
        sectionIndex,
        heightYMm: profile.heightYMm,
        forwardZMm: profile.forwardZMm,
        widthMm: profile.widthMm,
        heightMm: profile.heightMm,
        centerMm: headSections[sectionIndex].centerMm,
        radiusXMm: headSections[sectionIndex].radiusXMm,
        radiusUpMm: headSections[sectionIndex].radiusUpMm,
      };
    });
  const sectionUp = (section: JewelryDeerHeadSection): Vec3 => [
    0,
    section.tangentMm[2],
    -section.tangentMm[1],
  ];
  let crownZMm = 0;

  for (const section of headSections) {
    const up = sectionUp(section);

    crownZMm = Math.max(
      crownZMm,
      section.centerMm[2] + up[2] * section.radiusUpMm,
    );
  }

  const lastHeadSection = headSections[headSections.length - 1];
  const noseMm = add(
    lastHeadSection.centerMm,
    multiply(lastHeadSection.tangentMm, lastHeadSection.radiusXMm),
  );
  const antlerSection = headSections[JEWELRY_DEER_HEAD_ANCHOR_SECTIONS[4]];
  const antlerUp = sectionUp(antlerSection);
  const antlerRootMm = add(
    antlerSection.centerMm,
    multiply(antlerUp, antlerSection.radiusUpMm - 2),
  );
  const head: JewelryDeerHead = {
    sections: headSections,
    sectionCount: JEWELRY_DEER_HEAD_SECTIONS,
    pointsPerSection: JEWELRY_DEER_HEAD_SECTION_POINTS,
    anchors: headAnchors,
    noseMm,
    crownZMm,
    antlerRootMm,
  };

  const earSection = headSections[JEWELRY_DEER_EAR_PEAK_SECTION];
  const earUp = sectionUp(earSection);
  const ears: JewelryDeerEar[] = ([-1, 1] as const).map((side) => ({
    id: `ear-${side < 0 ? "left" : "right"}`,
    rootMm: [
      side * earSection.radiusXMm * Math.cos(Math.PI / 6),
      earSection.centerMm[1] + earUp[1] * earSection.radiusUpMm * 0.5,
      earSection.centerMm[2] + earUp[2] * earSection.radiusUpMm * 0.5,
    ],
    tipMm: [
      side * (earSection.radiusXMm + JEWELRY_DEER_EAR_OUT_MM),
      earSection.centerMm[1] + earUp[1] * earSection.radiusUpMm * 0.8,
      earSection.centerMm[2] +
        earUp[2] * earSection.radiusUpMm * 0.8 +
        JEWELRY_DEER_EAR_UP_MM,
    ],
  }));

  const makeLeg = (
    side: -1 | 1,
    front: boolean,
  ): JewelryDeerLeg => {
    const xMm = side * JEWELRY_DEER_LEG_OFFSET_X_MM;
    const yMm = (front ? -1 : 1) * JEWELRY_DEER_LEG_OFFSET_Y_MM;

    return {
      id: `leg-${front ? "front" : "rear"}-${side < 0 ? "left" : "right"}`,
      points: [
        { xMm, yMm, zMm: JEWELRY_DEER_BASE_HEIGHT_MM, radiusMm: 2.6 },
        { xMm, yMm, zMm: 16, radiusMm: 2.6 },
        { xMm, yMm, zMm: 28, radiusMm: 3.1 },
        {
          xMm,
          yMm,
          zMm:
            JEWELRY_DEER_BASE_HEIGHT_MM + JEWELRY_DEER_LEG_HEIGHT_MM,
          radiusMm:
            JEWELRY_DEER_LEG_DIAMETER_MM / 2 + 1.1,
        },
      ],
      sides: JEWELRY_DEER_LEG_SIDES,
    };
  };

  const legs: JewelryDeerLeg[] = [
    makeLeg(-1, true),
    makeLeg(1, true),
    makeLeg(-1, false),
    makeLeg(1, false),
  ];

  // Оба ствола начинаются почти в одной точке на макушке гладкого лофта.
  // Корень уже утоплен в поверхность на 2 мм, поэтому рог не висит в воздухе.
  // Форма всех 26 трубок не меняется: сдвигается только общая точка роста.
  const rootX = 0.5;
  const rootY = head.antlerRootMm[1];
  const rootZ = head.antlerRootMm[2];
  const halfSpreadMm =
    antlerSpreadMm / 2 - JEWELRY_DEER_ANTLER_BUD_RADIUS_MM;
  const crownHeightMm = antlerSpreadMm * 1.456;
  const crownDepthMm = halfSpreadMm * 0.53;

  const crownPoint = (
    side: -1 | 1,
    [x, y, z]: readonly [number, number, number],
  ): Vec3 => [
    side * x * halfSpreadMm,
    rootY + y * crownDepthMm,
    rootZ + z * crownHeightMm,
  ];

  const pointAtShare = (
    path: JewelryDeerAntlerPath,
    share: number,
  ): { point: Vec3; radiusMm: number } => {
    const points = path.points;
    const scaled = Math.min(1, Math.max(0, share)) * (points.length - 1);
    const index = Math.min(points.length - 2, Math.floor(scaled));
    const local = scaled - index;
    const from = points[index];
    const to = points[index + 1];

    return {
      point: [
        lerpNumber(from.xMm, to.xMm, local),
        lerpNumber(from.yMm, to.yMm, local),
        lerpNumber(from.zMm, to.zMm, local),
      ],
      radiusMm: lerpNumber(from.radiusMm, to.radiusMm, local),
    };
  };

  const antlers: JewelryDeerAntlerPath[] = [];
  // На компактной фигуре рога короткие, и скругление того же бутона занимает
  // большую долю длины. Поэтому запас к 45° там больше: 65° вместо 55°.
  const antlerMinElevationDeg =
    antlerSpreadMm <= 140 ? 65 : antlerSpreadMm <= 190 ? 60 : 55;

  for (const side of [-1, 1] as const) {
    const suffix = side < 0 ? "left" : "right";
    const built = new Map<string, JewelryDeerAntlerPath>();

    for (const spec of JEWELRY_DEER_ANTLER_BRANCHES) {
      const parent = spec.parent ? built.get(spec.parent) : undefined;
      const attach = parent ? pointAtShare(parent, spec.attach) : null;
      const root: Vec3 = attach
        ? attach.point
        : [side * rootX, rootY, rootZ];
      const rootRadiusMm = parent && attach
        ? Math.max(
            0.8,
            Math.min(spec.rootRadiusMm, attach.radiusMm - 0.12),
          )
        : spec.rootRadiusMm;
      const tipRadiusMm = Math.min(
        JEWELRY_DEER_ANTLER_TIP_RADIUS_MM,
        rootRadiusMm * 0.55,
      );
      const budRadiusMm = Math.min(
        JEWELRY_DEER_ANTLER_BUD_RADIUS_MM,
        rootRadiusMm * 0.75 + 0.6,
      );
      const path = createAntlerPath({
        id: `${spec.id}-${suffix}`,
        kind: spec.parent ? "tine" : "beam",
        side,
        controls: [
          root,
          crownPoint(side, spec.c1),
          crownPoint(side, spec.c2),
          crownPoint(side, spec.tip),
        ],
        rootRadiusMm,
        tipRadiusMm,
        budRadiusMm,
        samples: spec.samples,
        minElevationDeg: antlerMinElevationDeg,
      });

      built.set(spec.id, path);
      antlers.push(path);
    }
  }

  let antlerTopMm = 0;
  let antlerOuterXMm = 0;

  for (const path of antlers) {
    const last = path.points[path.points.length - 1];

    antlerTopMm = Math.max(antlerTopMm, last.zMm + path.budRadiusMm);
    antlerOuterXMm = Math.max(
      antlerOuterXMm,
      Math.abs(last.xMm) + path.budRadiusMm,
    );
  }

  const heightMm =
    Math.round(
      Math.max(head.crownZMm, antlerTopMm, body.topZMm) * 100,
    ) / 100;

  return {
    baseLengthMm,
    baseWidthMm,
    baseHeightMm: JEWELRY_DEER_BASE_HEIGHT_MM,
    pocketCenterMm: [pocketOffsetMm, 0],
    pocketOffsetMm,
    pocketRadiusMm,
    pocketDepthMm: JEWELRY_DEER_WEIGHT_DEPTH_MM,
    pocketFloorMm: JEWELRY_DEER_WEIGHT_FLOOR_MM,
    fitScale: 1,
    plinth,
    body,
    legs,
    head,
    crownZMm: head.crownZMm,
    antlerTopZMm: antlerTopMm,
    antlerSpreadMm,
    antlerOuterXMm,
    antlers,
    ears,
    heightMm,
  };
}

/**
 * План оленя, вписанный в печатный конверт.
 *
 * Лоток и полость остаются ровно такими, какими их задали ползунки: монета
 * должна входить в гнездо. Если крона поднимает фигуру выше 240 мм, масштаб
 * применяется к плинту, корпусу, шее, голове, ушам, ногам и рогам — ко всей
 * фигуре поверх лотка. Равномерный масштаб не меняет углы наклона и пропорции,
 * поэтому гладкий силуэт и подъём рогов сохраняются. Радиусы рогов после
 * уменьшения поднимаются до Ø3 мм: ветви не становятся хрупкими.
 */
export function jewelryDeerPlan(
  params: Partial<JewelryStandParams> = {},
): JewelryDeerPlan {
  const raw = buildJewelryDeerPlan(params);
  // 0.01 мм запаса: после округления высоты и подъёма тонких бутонов кончик
  // не должен оказаться ровно на пределе или на сотую выше него.
  const availableMm =
    JEWELRY_DEER_MAX_HEIGHT_MM - raw.baseHeightMm - 0.01;
  const aboveBaseMm = raw.heightMm - raw.baseHeightMm;
  const minimumRadiusMm = JEWELRY_DEER_MIN_ANTLER_DIAMETER_MM / 2;
  const byHeight =
    aboveBaseMm > 1e-9 ? availableMm / aboveBaseMm : 1;
  // Если бутон после масштаба станет тоньше минимума, его радиус поднимется
  // обратно до 1.5 мм. Этот запас вычитается заранее, иначе кончик снова
  // вылезет за 240 мм.
  const byThickness =
    aboveBaseMm > JEWELRY_DEER_ANTLER_BUD_RADIUS_MM + 1e-9
      ? (availableMm - minimumRadiusMm) /
        (aboveBaseMm - JEWELRY_DEER_ANTLER_BUD_RADIUS_MM)
      : 1;
  const footprintMm = Math.max(
    raw.baseLengthMm,
    raw.baseWidthMm,
    raw.antlerOuterXMm * 2,
  );
  const byFootprint =
    footprintMm > 1e-9 ? JEWELRY_DEER_MAX_FOOTPRINT_MM / footprintMm : 1;
  const fitScale = Math.min(
    1,
    Math.max(0.05, Math.min(byHeight, byThickness, byFootprint)),
  );

  return scaleDeerFigure(raw, fitScale);
}

/**
 * Равномерно масштабирует фигуру оленя, оставляя лоток и полость в покое.
 *
 * По Z масштаб считается от верхней грани лотка: нижние торцы ног и плинт
 * остаются на своих местах, а крона опускается к столу. По X и Y все детали
 * фигуры сжимаются к центру лотка, поэтому за габарит 250 мм они не выйдут.
 */
function scaleDeerFigure(
  raw: JewelryDeerPlan,
  factor: number,
): JewelryDeerPlan {
  const anchorZMm = raw.baseHeightMm;
  const minimumRadiusMm = JEWELRY_DEER_MIN_ANTLER_DIAMETER_MM / 2;
  const scalePoint = (point: Vec3): Vec3 => [
    point[0] * factor,
    point[1] * factor,
    anchorZMm + (point[2] - anchorZMm) * factor,
  ];
  const scaleZ = (zMm: number): number =>
    anchorZMm + (zMm - anchorZMm) * factor;

  const plinth: JewelryDeerPlinth = {
    ...raw.plinth,
    centerMm: [
      raw.plinth.centerMm[0] * factor,
      raw.plinth.centerMm[1] * factor,
    ],
    lengthMm: raw.plinth.lengthMm * factor,
    widthMm: raw.plinth.widthMm * factor,
    heightMm: raw.plinth.heightMm * factor,
    topZMm: scaleZ(raw.plinth.topZMm),
  };
  const body: JewelryDeerBody = {
    ...raw.body,
    sections: raw.body.sections.map((section) => ({
      ...section,
      centerMm: scalePoint(section.centerMm),
      radiusXMm: section.radiusXMm * factor,
      radiusUpMm: section.radiusUpMm * factor,
    })),
    widthMm: raw.body.widthMm * factor,
    lengthMm: raw.body.lengthMm * factor,
    heightMm: raw.body.heightMm * factor,
    bottomZMm: scaleZ(raw.body.bottomZMm),
    topZMm: scaleZ(raw.body.topZMm),
  };
  const head: JewelryDeerHead = {
    ...raw.head,
    sections: raw.head.sections.map((section) => ({
      ...section,
      centerMm: scalePoint(section.centerMm),
      radiusXMm: section.radiusXMm * factor,
      radiusUpMm: section.radiusUpMm * factor,
    })),
    anchors: raw.head.anchors.map((anchor) => ({
      ...anchor,
      centerMm: scalePoint(anchor.centerMm),
      radiusXMm: anchor.radiusXMm * factor,
      radiusUpMm: anchor.radiusUpMm * factor,
    })),
    crownZMm: scaleZ(raw.head.crownZMm),
    noseMm: scalePoint(raw.head.noseMm),
    antlerRootMm: scalePoint(raw.head.antlerRootMm),
  };

  const ears: JewelryDeerEar[] = raw.ears.map((ear) => ({
    ...ear,
    rootMm: scalePoint(ear.rootMm),
    tipMm: scalePoint(ear.tipMm),
  }));
  const legs: JewelryDeerLeg[] = raw.legs.map((leg) => ({
    ...leg,
    points: leg.points.map((point) => ({
      ...point,
      xMm: point.xMm * factor,
      yMm: point.yMm * factor,
      zMm: scaleZ(point.zMm),
      radiusMm: point.radiusMm * factor,
    })),
  }));
  const antlers: JewelryDeerAntlerPath[] = raw.antlers.map((path) => ({
    ...path,
    points: path.points.map((point) => ({
      ...point,
      xMm: point.xMm * factor,
      yMm: point.yMm * factor,
      zMm: scaleZ(point.zMm),
      radiusMm: Math.max(point.radiusMm * factor, minimumRadiusMm),
    })),
    budRadiusMm: Math.max(path.budRadiusMm * factor, minimumRadiusMm),
  }));

  let antlerTopZMm = 0;
  let antlerOuterXMm = 0;

  for (const path of antlers) {
    for (const point of path.points) {
      antlerTopZMm = Math.max(
        antlerTopZMm,
        point.zMm + point.radiusMm,
      );
      antlerOuterXMm = Math.max(
        antlerOuterXMm,
        Math.abs(point.xMm) + point.radiusMm,
      );
    }

    const last = path.points[path.points.length - 1];

    antlerTopZMm = Math.max(antlerTopZMm, last.zMm + path.budRadiusMm);
    antlerOuterXMm = Math.max(
      antlerOuterXMm,
      Math.abs(last.xMm) + path.budRadiusMm,
    );
  }

  const heightMm =
    Math.round(
      Math.max(antlerTopZMm, head.crownZMm, body.topZMm) * 100,
    ) / 100;

  return {
    ...raw,
    fitScale: raw.fitScale * factor,
    plinth,
    body,
    legs,
    head,
    crownZMm: head.crownZMm,
    antlerTopZMm,
    antlerOuterXMm,
    antlerSpreadMm: antlerOuterXMm * 2,
    antlers,
    ears,
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
 * Овальный лоток с полостью под утяжелитель.
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

/**
 * Овальный плинт под фигурой.
 *
 * Это отдельное замкнутое тело: низ лежит на лотке, верх скрыт под телом.
 * Плинт шире тела, поэтому все нижние торцы ног и брюхо оказываются внутри
 * материала, а не висят над столом. Кромка вертикальная — поддержки не нужны.
 */
function addDeerPlinth(positions: number[], plan: JewelryDeerPlan): void {
  const { centerMm, widthMm, lengthMm, heightMm, topZMm } = plan.plinth;
  const bottomZMm = topZMm - heightMm;
  const sides = JEWELRY_DEER_PLINTH_SIDES;
  const points: Point2[] = [];

  for (let index = 0; index < sides; index += 1) {
    const angle = (Math.PI * 2 * index) / sides;

    points.push([
      centerMm[0] + (widthMm / 2) * Math.cos(angle),
      centerMm[1] + (lengthMm / 2) * Math.sin(angle),
    ]);
  }

  addPrismSides(positions, points, bottomZMm, topZMm);
  addFanCap(positions, points, bottomZMm, false);
  addFanCap(positions, points, topZMm, true);
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

/**
 * Скруглённая крышка трубы: три кольца и полюс, без единой плоской грани.
 *
 * Кольцо сжимается к центру как `cos`, а вдоль оси уходит на `sin` — получается
 * полусфера. Работает и для круглого кольца рога, и для плоского кольца уха:
 * смещение берётся от центра кольца, поэтому эллипс сжимается в эллипсоид.
 *
 * Сфера на конце рога — это и есть «бутон»: шар радиуса 5.5 дал бы нижнюю
 * полусферу с нависанием 90°, а утолщённая труба с такой крышкой держится в 45°,
 * потому что полусфера продолжает ось трубы, а не торчит из неё.
 */
function addDomeCap(
  positions: number[],
  center: Vec3,
  axis: Vec3,
  ring: readonly Vec3[],
  axialRadiusMm: number,
): void {
  const steps = [Math.PI / 8, Math.PI / 4, (Math.PI * 3) / 8];
  let previous = ring;

  for (const angle of steps) {
    const shrink = Math.cos(angle);
    const offset = multiply(axis, axialRadiusMm * Math.sin(angle));
    const next: Vec3[] = ring.map((point) =>
      add(
        add(center, offset),
        multiply(subtract(point, center), shrink),
      ),
    );

    addRingWalls(positions, previous, next);
    previous = next;
  }

  addRingFan(
    positions,
    add(center, multiply(axis, axialRadiusMm)),
    previous,
    true,
  );
}

/** Кольцо корпуса: эллипс спины и килевое брюхо в плоскости XZ. */
function deerBodyRing(body: JewelryDeerBody, index: number): Vec3[] {
  const section = body.sections[index];
  const ring: Vec3[] = [];

  for (let step = 0; step < body.pointsPerSection; step += 1) {
    const angle = (Math.PI * 2 * step) / body.pointsPerSection;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    // Верхняя половина — эллипс спины. Нижняя сходится к килю: две длинные
    // грани под углом круче 45° к столу, поэтому брюхо не висит круглым
    // потолком между ногами.
    const vertical =
      sine > 0
        ? 1 - Math.abs(cosine)
        : sine;

    ring.push([
      section.centerMm[0] + cosine * section.radiusXMm,
      section.centerMm[1],
      section.centerMm[2] - vertical * section.radiusUpMm,
    ]);
  }

  return ring;
}

/**
 * Гладкий корпус.
 *
 * 96 колец соединяются 95 поясами, торцы закрыты плоскими веерами. Передний и
 * задний концы сужены плавным профилем, поэтому торс не выглядит бочкой.
 */
function addDeerBody(positions: number[], body: JewelryDeerBody): void {
  const rings = body.sections.map((_, index) => deerBodyRing(body, index));
  const first = body.sections[0];
  const last = body.sections[body.sections.length - 1];

  addRingFan(positions, first.centerMm, rings[0], false);

  for (let index = 0; index < rings.length - 1; index += 1) {
    addRingWalls(positions, rings[index], rings[index + 1]);
  }

  addRingFan(
    positions,
    last.centerMm,
    rings[rings.length - 1],
    true,
  );
}

/**
 * Окно уха вдоль оси: плавный лепесток с максимумом на опорном черепе.
 *
 * За пределами 16 колец вырост равен нулю, поэтому ухо не тянется ни к
 * затылку, ни к носу. Внутри окна smoothstep обнуляет производную на краях:
 * переход от черепа к уху и обратно не даёт складки.
 */
function deerEarWindow(sectionIndex: number): number {
  const distance = Math.abs(
    sectionIndex - JEWELRY_DEER_EAR_PEAK_SECTION,
  );
  const halfWindow = JEWELRY_DEER_EAR_WINDOW_SECTIONS / 2;

  if (distance >= halfWindow) {
    return 0;
  }

  const local = 1 - distance / halfWindow;

  return local * local * (3 - 2 * local);
}

/**
 * Кольцо одного сечения головы.
 *
 * Ось сечения — касательная сплайна, поэтому кольцо всегда перпендикулярно
 * изгибу. Мировой X остаётся первой полуосью: ось лежит в плоскости YZ, и
 * перекрута вокруг неё нет. Вторая полуось — `e2 = (0, tz, −ty)`, то есть
 * «верх» в плоскости сечения.
 *
 * Уши задаются двумя гладкими полями: боковым выносом и подъёмом. Они
 * включаются только возле боковых точек (`|cos θ|` в степени 8), поэтому
 * спина и низ головы остаются эллипсами, а ухо вырастает прямо из поверхности.
 */
function deerHeadRing(head: JewelryDeerHead, sectionIndex: number): Vec3[] {
  const section = head.sections[sectionIndex];
  const tangent = section.tangentMm;
  const e2: Vec3 = [0, tangent[2], -tangent[1]];
  const earWindow = deerEarWindow(sectionIndex);
  const ring: Vec3[] = [];

  for (
    let step = 0;
    step < head.pointsPerSection;
    step += 1
  ) {
    const angle = (Math.PI * 2 * step) / head.pointsPerSection;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const side = Math.sign(cosine) || 1;
    // Лепесток посажен на 30° выше экватора: ухо растёт наружу и вверх, а его
    // нижняя кромка сходит на нет до низа кольца и не даёт отвесной стенки.
    const earAngle = side * (Math.PI / 6);
    const earLobe =
      earWindow *
      Math.max(0, Math.cos(angle - earAngle)) **
        JEWELRY_DEER_EAR_ANGULAR_POWER;
    const lateralMm =
      cosine * section.radiusXMm + side * earLobe * JEWELRY_DEER_EAR_OUT_MM;
    // Нижняя дуга в передней части головы заменяется килем: две грани под
    // 45° к столу вместо круглого низа, который под горизонтальной мордой
    // висел бы над столом. К шее киль плавно сходит на нет.
    const keelShare = smoothstep(0.38, 0.56, section.share);
    const lowerPoint =
      sine < -JEWELRY_DEER_JAW_SIDE_SHARE &&
      Math.abs(cosine) < JEWELRY_DEER_JAW_SIDE_SHARE;
    const keelUpMm =
      -section.radiusUpMm * JEWELRY_DEER_JAW_SIDE_SHARE -
      section.radiusUpMm *
        JEWELRY_DEER_JAW_DEPTH_SHARE *
        (1 - Math.abs(cosine) / JEWELRY_DEER_JAW_SIDE_SHARE);
    const upMm = lowerPoint
      ? sine * section.radiusUpMm * (1 - keelShare) + keelUpMm * keelShare
      : sine * section.radiusUpMm;

    ring.push([
      section.centerMm[0] + lateralMm,
      section.centerMm[1] + e2[1] * upMm,
      section.centerMm[2] +
        e2[2] * upMm +
        earLobe * JEWELRY_DEER_EAR_UP_MM,
    ]);
  }

  return ring;
}

/**
 * Единый гладкий лофт головы и шеи.
 *
 * 100 колец соединяются 99 поясами по 64 четырёхугольника. Нижний торец
 * закрыт веером внутри корпуса, верхний — скруглённой крышкой: у носа нет
 * плоской площадки. Уши уже входят в кольца, поэтому отдельных тел и швов на
 * голове нет.
 */
function addDeerHeadLoft(
  positions: number[],
  head: JewelryDeerHead,
): void {
  const rings = head.sections.map((_, index) =>
    deerHeadRing(head, index),
  );

  addRingFan(
    positions,
    head.sections[0].centerMm,
    rings[0],
    false,
  );

  for (let index = 0; index < rings.length - 1; index += 1) {
    addRingWalls(positions, rings[index], rings[index + 1]);
  }

  const lastSection = head.sections[head.sections.length - 1];
  const lastRing = rings[rings.length - 1];

  addDomeCap(
    positions,
    lastSection.centerMm,
    lastSection.tangentMm,
    lastRing,
    Math.max(lastSection.radiusXMm, lastSection.radiusUpMm),
  );
}

/** Нога: та же гладкая изогнутая труба, что и у рогов. */
function addDeerLimb(positions: number[], leg: JewelryDeerLeg): void {
  addCurvedTube(
    positions,
    leg.points.map((point) => [point.xMm, point.yMm, point.zMm] as Vec3),
    leg.points.map((point) => point.radiusMm),
    leg.sides,
  );
}

/**
 * Касательные ломаной: средние для внутренних точек и хорда для концов.
 *
 * Кольца изогнутой трубы ставятся перпендикулярно именно этим касательным, а не
 * одной оси на всю трубу. Иначе на сильном изгибе кольцо наклоняется и труба
 * сужается в месте перегиба.
 */
function polylineTangents(centers: readonly Vec3[]): Vec3[] {
  return centers.map((center, index) => {
    const previous = centers[Math.max(0, index - 1)];
    const next = centers[Math.min(centers.length - 1, index + 1)];

    return normalize(subtract(next, previous));
  });
}

/** Кольца изогнутой трубы с параллельным переносом рамки. */
function curvedTubeRings(
  centers: readonly Vec3[],
  radii: readonly number[],
  sides: number,
): Vec3[][] {
  const tangents = polylineTangents(centers);
  let e1 = tubeFrame(tangents[0]).e1;
  const rings: Vec3[][] = [];

  for (let index = 0; index < centers.length; index += 1) {
    const tangent = tangents[index];
    const projected = subtract(e1, multiply(tangent, dot(e1, tangent)));

    e1 =
      magnitude(projected) > 1e-6
        ? normalize(projected)
        : tubeFrame(tangent).e1;
    const e2 = cross(tangent, e1);
    const ring: Vec3[] = [];

    for (let step = 0; step < sides; step += 1) {
      const angle = (Math.PI * 2 * step) / sides;

      ring.push(
        add(
          centers[index],
          add(
            multiply(e1, Math.cos(angle) * radii[index]),
            multiply(e2, Math.sin(angle) * radii[index]),
          ),
        ),
      );
    }

    rings.push(ring);
  }

  return rings;
}

/**
 * Изогнутая труба с глухим корнем и скруглённым кончиком.
 *
 * Корень всегда утоплен в тело-хозяин, поэтому его веер смотрит внутрь и не
 * считается нависанием. Кончик закрыт полусферой: острой кромки нет, кольцо не
 * цепляется за срез.
 */
function addCurvedTube(
  positions: number[],
  centers: readonly Vec3[],
  radii: readonly number[],
  sides: number,
): void {
  if (centers.length < 2) {
    return;
  }

  const rings = curvedTubeRings(centers, radii, sides);
  const tangents = polylineTangents(centers);
  const first = centers[0];
  const last = centers[centers.length - 1];

  addRingFan(positions, first, rings[0], false);

  for (let index = 0; index < rings.length - 1; index += 1) {
    addRingWalls(positions, rings[index], rings[index + 1]);
  }

  addDomeCap(
    positions,
    last,
    tangents[tangents.length - 1],
    rings[rings.length - 1],
    radii[radii.length - 1],
  );
}

/** Одна труба рога: изогнутая ось с бутоном на конце. */
function addAntlerTube(
  positions: number[],
  path: JewelryDeerAntlerPath,
): void {
  addCurvedTube(
    positions,
    path.points.map(pointToVec),
    path.points.map((point) => point.radiusMm),
    JEWELRY_DEER_ANTLER_SIDES,
  );
}

/**
 * Геометрия подставки «Лесной олень» для набора параметров.
 *
 * Деталь построена Z-вверх; лоток стоит в начале координат, олень смотрит в −Y.
 * Лоток, плинт, корпус, голова, ноги и каждая труба рога — отдельные замкнутые
 * тела. Они пересекаются, поэтому слайсер объединяет их при печати без булевых
 * операций. Нормали сначала считаются по вершинам, а затем сглаживаются по
 * углу: лофты и трубы выглядят цельными, кромки лотка остаются чёткими.
 */
export function createJewelryDeerGeometry(
  params: Partial<JewelryStandParams> = {},
): BufferGeometry {
  const plan = jewelryDeerPlan(params);
  const positions: number[] = [];

  addDeerBase(positions, plan);
  addDeerPlinth(positions, plan);
  addDeerBody(positions, plan.body);
  addDeerHeadLoft(positions, plan.head);

  for (const leg of plan.legs) {
    addDeerLimb(positions, leg);
  }

  for (const path of plan.antlers) {
    addAntlerTube(positions, path);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

  // Требование ТЗ: сначала считаем нормали по вершинам. У неиндексированного
  // лофта эта операция даёт нормаль грани, поэтому следом `applyCreasedNormals`
  // сваривает совпадающие вершины и сглаживает всё, что сходится под углом до
  // 60°. Кромка лотка и плинта (90°) остаётся чёткой, а голова, корпус и трубы
  // становятся гладкой скульптурой.
  geometry.computeVertexNormals();

  const smoothed = applyCreasedNormals(geometry, 60);

  smoothed.computeBoundingBox();
  smoothed.computeBoundingSphere();

  return smoothed;
}

