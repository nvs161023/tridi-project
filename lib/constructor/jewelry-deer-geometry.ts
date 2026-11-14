/**
 * Геометрия бюста «Лесной олень».
 *
 * Вторая форма премиум-коллекции: овальная база с полостью под утяжелитель и
 * стилизованный бюст без глаз и ноздрей. Голова и шея — единый гладкий лофт:
 * 100 сечений по 64 точки вдоль двух дуг Безье от центра базы через затылок к
 * носу. Диаметр и вертикальная полуось заданы профилями и интерполируются
 * smoothstep, поэтому на сечениях нет ступенек. На затылке дуги стыкуются с
 * общей вертикальной касательной; кольца перпендикулярны касательной, а нос
 * закрыт полусферой, а не плоской площадкой.
 *
 * Уши — не отдельные тела, а два гладких лепестка на боковой поверхности
 * верхних сечений. Спина и низ головы остаются эллипсами, поэтому ухо вырастает
 * из лофта без шва. Под мордой нижняя дуга передних сечений переходит в киль:
 * две грани под 45° к столу закрывают круглый низ, который на горизонтальной
 * морде висел бы над столом. К шее киль плавно сходит на нет, чтобы не выдвигать
 * переднюю кромку шеи в полость базы.
 *
 * Рога остаются трубами с бутонами: это рабочая часть держателя, а не декор.
 * Ствол растёт из 73-го сечения головы, утоплен внутрь и уходит вверх и в
 * стороны под 52°. Четыре отростка на сторону, первый — надбровный: он
 * загибается над мордой и делает узнаваемым именно оленя.
 *
 * База — эллиптическая плита 4 мм. Полость Ø25 × 2.5 мм открыта вверх, под ней
 * остаётся дно 1.5 мм, поэтому плита не сквозная и печатается без мостов.
 * Центр полости стоит перед бюстом, где плита свободна от шеи. На узкой базе
 * смещение уменьшается, а бюст сдвигается назад ровно настолько, чтобы монета
 * проходила между шеей и краем. Противовес не нужен: даже с грузом 200 г на
 * кончике рога при максимальном размахе запас по опрокидыванию больше единицы.
 *
 * Все тела замкнуты по отдельности и пересекаются: низ шеи уходит в базу, корни
 * рогов — в голову, корни отростков — в ствол. Слайсер объединяет их при печати,
 * булевых операций нет. После слияния нормали сглаживаются с порогом 45°,
 * поэтому лофт и бока труб гладкие, а кромка плиты остаётся острой.
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
import { applyCreasedNormals } from "@/lib/constructor/mesh-normals";

/** Высота овальной базы, мм: полость 2.5 мм плюс дно 1.5 мм. */
export const JEWELRY_DEER_BASE_HEIGHT_MM = 4;

/** Диаметр полости под монету или шайбу, мм: рубль и четвертак входят. */
export const JEWELRY_DEER_WEIGHT_DIAMETER_MM = 25;

/** Глубина полости, мм: монета 2–3 мм ложится почти заподлицо с лицом базы. */
export const JEWELRY_DEER_WEIGHT_DEPTH_MM = 2.5;

/** Дно под полостью, мм: плита остаётся не сквозной. */
export const JEWELRY_DEER_WEIGHT_FLOOR_MM = 1.5;

/**
 * Сдвиг полости вперёд от центра базы, мм.
 *
 * Полость стоит **перед** бюстом, а не под ним. Шея у основания имеет диаметр
 * 40 мм, её передняя кромка доходит до `y = −15`: монета под ней не поместится.
 * Перед оленем плита свободна от `y = −21.5` до `y = −46.5`, и получается
 * чаша-лоток под кольца — так же обыграна база у референсов из исследования.
 * Задняя кромка полости отстоит от шеи на 6.5 мм, поэтому монета проходит между
 * ними. На узкой плите смещение меньше, а зазор сохраняется сдвигом бюста.
 */
export const JEWELRY_DEER_WEIGHT_OFFSET_MM = 34;

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

/**
 * Число осевых сечений головы, шт.: 100 держат изгиб шеи и морды без ступеней.
 *
 * Шаг по оси около 0.8 мм. При габарите головы 80 мм это меньше одного шага
 * печати, поэтому силуэт читается непрерывной кривой, а не набором срезов.
 */
export const JEWELRY_DEER_HEAD_SECTIONS = 100;

/**
 * Точек в одном сечении, шт.: 64.
 *
 * 64 точки дают шаг 5.625° по окружности. На черепе Ø16 мм хорда равна 1.57 мм,
 * после сглаживания нормалей граней не видно даже на крупном плане.
 */
export const JEWELRY_DEER_HEAD_SECTION_POINTS = 64;

/** Диаметр шеи у основания, мм: по ТЗ 40. */
export const JEWELRY_DEER_HEAD_BASE_DIAMETER_MM = 40;

/** Диаметр черепа, мм: по ТЗ 16; уши добавляют ширину плавными выростами. */
export const JEWELRY_DEER_HEAD_SKULL_DIAMETER_MM = 16;

/** Диаметр носа, мм: по ТЗ 8. */
export const JEWELRY_DEER_HEAD_NOSE_DIAMETER_MM = 8;

/**
 * Начало оси, мм: центр базы.
 *
 * Ось начинается на `z = 2`, внутри плиты: торец лофта не совпадает с нижней
 * плоскостью базы и не создаёт вторую копию дна на столе.
 */
export const JEWELRY_DEER_HEAD_SPINE_START_MM = [0, 0, 2] as const;

/** Затылок, мм: верхняя точка оси перед изгибом вперёд. */
export const JEWELRY_DEER_HEAD_SPINE_NAPE_MM = [0, 0, 80] as const;

/** Нос, мм: ось уходит вперёд по −Y и чуть опускается. */
export const JEWELRY_DEER_HEAD_SPINE_NOSE_MM = [0, -50, 70] as const;

/**
 * Первая кубическая дуга Безье: база → затылок.
 *
 * Опорные точки лежат на вертикали, поэтому шея поднимается без наклона и
 * нависаний. Неравномерность параметра не важна: сечения всё равно
 * распределяются по длине дуги.
 */
const JEWELRY_DEER_NECK_BEZIER = [
  JEWELRY_DEER_HEAD_SPINE_START_MM,
  [0, 0, 28] as const,
  [0, 0, 56] as const,
  JEWELRY_DEER_HEAD_SPINE_NAPE_MM,
] as const;

/**
 * Вторая кубическая дуга Безье: затылок → нос.
 *
 * Касательная на стыке вертикальная, как у шеи, поэтому на затылке нет излома.
 * Дальше ось плавно заворачивает вперёд и заканчивается над носом: последняя
 * касательная наклонена вниз примерно на 25°, и морда не клюёт в стол.
 */
const JEWELRY_DEER_HEAD_BEZIER = [
  JEWELRY_DEER_HEAD_SPINE_NAPE_MM,
  [0, 0, 92] as const,
  [0, -20, 84] as const,
  JEWELRY_DEER_HEAD_SPINE_NOSE_MM,
] as const;

/**
 * Профиль диаметра вдоль оси: доля длины → диаметр, мм.
 *
 * Ключи плавно интерполируются smoothstep, поэтому производная радиуса
 * ограничена и на сечениях нет ступенек. У основания 40 мм, на черепе 16,
 * у носа 8 — ровно числа из ТЗ.
 */
const JEWELRY_DEER_HEAD_DIAMETER_PROFILE = [
  [0, 40],
  [0.12, 36],
  [0.28, 30],
  [0.4, 24],
  [0.5, 19],
  [0.62, 16],
  [0.74, 15.8],
  [0.84, 13],
  [0.94, 9.2],
  [1, 8],
] as const;

/**
 * Отношение вертикальной полуоси к горизонтальной.
 *
 * Шея сплюснута спереди назад (0.75), череп круглый (1), морда слегка вытянута
 * вверх (1.15). Это эллипсы, а не тела вращения: сбоку голова глубже, чем
 * спереди, и не выглядит трубой.
 */
const JEWELRY_DEER_HEAD_ASPECT_PROFILE = [
  [0, 0.75],
  [0.5, 0.84],
  [0.62, 1],
  [0.8, 1.08],
  [1, 1.15],
] as const;

/**
 * Сечение уха, где вырост достигает максимума.
 *
 * 73-е сечение — верхняя часть черепа: ухо растёт из боковой поверхности, а не
 * приклеено к ней отдельным конусом.
 */
const JEWELRY_DEER_EAR_PEAK_SECTION = 73;

/** Полная ширина окна уха в сечениях: 18 сечений по 0.8 мм ≈ 14 мм. */
const JEWELRY_DEER_EAR_WINDOW_SECTIONS = 18;

/** Вынос кончика уха в сторону, мм: от боковой поверхности черепа. */
const JEWELRY_DEER_EAR_OUT_MM = 5;

/** Подъём кончика уха над осью сечения, мм: ниже 45° к боковой поверхности. */
const JEWELRY_DEER_EAR_UP_MM = 9;

/**
 * Показатель углового лепестка уха: 6 даёт основание около 60°.
 *
 * Лепесток центрирован на 30° выше боковой линии. Меньшая степень растянула бы
 * ухо почти на спину, большая собрала бы его в шип с крутой нижней кромкой.
 */
const JEWELRY_DEER_EAR_ANGULAR_POWER = 6;

/**
 * Доля полуоси, где нижняя дуга переходит в киль: `1/√2`.
 *
 * В этих точках нормаль эллипса наклонена к столу на 45°. Ниже начинается
 * грань киля, поэтому круглый низ морды больше не нависает над столом.
 */
const JEWELRY_DEER_JAW_SIDE_SHARE = Math.SQRT1_2;

/**
 * Высота грани киля к полуоси сечения: 0.8.
 *
 * При боковой доле `1/√2` грань наклонена к столу на 48.5°, то есть её нормаль
 * смотрит вниз только на 41.5° — печать без поддержек.
 */
const JEWELRY_DEER_JAW_DEPTH_SHARE = 0.8;

/** Полуширина уха в плане для подписи, мм. */
const JEWELRY_DEER_EAR_HALF_WIDTH_MM = 2.2;

/** Полутолщина уха, мм: вырост остаётся тонким на кончике. */
const JEWELRY_DEER_EAR_HALF_THICKNESS_MM = 1.6;

/** Число сторон базы, шт.: 96 держит овал гладким на любом размере. */
const JEWELRY_DEER_BASE_SIDES = 96;

/**
 * Корень ствола рога: верхнее сечение черепа.
 *
 * Рог не висит в воздухе над отдельной сферой: корень берётся из 73-го сечения
 * того же лофта, что и голова, и уходит внутрь на 2 мм.
 */
const JEWELRY_DEER_ANTLER_ROOT_SECTION = 73;

/** Куда уходит кончик ствола по Y, мм: рога слегка зачёсаны назад. */
const JEWELRY_DEER_ANTLER_TIP_Y_MM = 2;

/** Одно эллиптическое сечение лофта: центр, касательная и полуоси. */
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

/**
 * Голова — единый гладкий лофт: 100 эллипсов вдоль составной кривой Безье.
 *
 * Все поля считаются без three.js и проверяются тестом. Геометрия читает те же
 * сечения, поэтому подпись, проверка пропорций и STL не расходятся.
 */
export type JewelryDeerHead = {
  readonly sections: readonly JewelryDeerHeadSection[];
  readonly sectionCount: number;
  readonly pointsPerSection: number;
  readonly baseDiameterMm: number;
  readonly skullDiameterMm: number;
  readonly noseDiameterMm: number;
  readonly spineStartMm: Vec3;
  readonly spineNapeMm: Vec3;
  readonly spineNoseMm: Vec3;
  /** Верхняя точка гладкой поверхности без рогов, мм. */
  readonly crownZMm: number;
};

/**
 * Отростки рога: доля длины ствола, длина и направление.
 *
 * Направление задано в мировых осях для правого рога (`side = 1`); левый
 * получает зеркальный X. Отростков четыре, а не три: первый растёт низко и
 * загибается над мордой — это надбровный отросток, главный признак оленя.
 *
 * Подъём 57–70°. Первому нужен запас не ради красоты: бутон утолщает конец на
 * 1.25 мм за 10 мм, и низ бутона опускается ещё на 7–9°, то есть при 50° он вышел
 * бы за 45° и потребовал поддержку.
 */
const JEWELRY_DEER_TINES: readonly {
  readonly share: number;
  readonly lengthMm: number;
  readonly direction: readonly [number, number, number];
}[] = [
  { share: 0.08, lengthMm: 18, direction: [0.15, -0.52, 0.84] },
  { share: 0.34, lengthMm: 20, direction: [0.12, -0.45, 0.88] },
  { share: 0.6, lengthMm: 16, direction: [0.18, -0.3, 0.94] },
  { share: 0.82, lengthMm: 13, direction: [0.22, 0.32, 0.92] },
];



/** Точка в пространстве, локальный тип модуля. */
type Vec3 = readonly [number, number, number];

/** Ухо: корень в черепе, кончик наружу и вверх, плоское сечение. */
export type JewelryDeerEar = {
  readonly id: string;
  readonly rootMm: Vec3;
  readonly tipMm: Vec3;
  readonly halfWidthMm: number;
  readonly halfThicknessMm: number;
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
  /** Центр полости на плоскости стола: X всегда 0, Y перед бюстом. */
  readonly pocketCenterMm: readonly [number, number];
  /** Смещение полости вперёд, мм: на узкой базе поджимается к плите. */
  readonly pocketOffsetMm: number;
  readonly pocketRadiusMm: number;
  readonly pocketDepthMm: number;
  readonly pocketFloorMm: number;
  readonly scale: number;
  /** Череп, шея, морда и киль — те же числа, что уходят в лофт. */
  readonly head: JewelryDeerHead;
  /** Длина головы от затылка до носа, мм. */
  readonly headLengthMm: number;
  /** Ширина черепа, мм: сплюснутость по бокам. */
  readonly headWidthMm: number;
  /** Высота черепа, мм. */
  readonly headHeightMm: number;
  /** Длина морды по оси, мм: должна быть больше черепа. */
  readonly muzzleLengthMm: number;
  /** Нос: передняя точка и его габарит по высоте. */
  readonly noseYMm: number;
  readonly noseZMm: number;
  /** Верх свода, мм: макушка черепа без рогов. */
  readonly crownZMm: number;
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

/** Касательная кубической кривой Безье. */
function cubicBezierTangent(
  controls: readonly [Vec3, Vec3, Vec3, Vec3],
  share: number,
): Vec3 {
  const inverse = 1 - share;
  const a = 3 * inverse * inverse;
  const b = 6 * inverse * share;
  const c = 3 * share * share;

  return normalize([
    (controls[1][0] - controls[0][0]) * a +
      (controls[2][0] - controls[1][0]) * b +
      (controls[3][0] - controls[2][0]) * c,
    (controls[1][1] - controls[0][1]) * a +
      (controls[2][1] - controls[1][1]) * b +
      (controls[3][1] - controls[2][1]) * c,
    (controls[1][2] - controls[0][2]) * a +
      (controls[2][2] - controls[1][2]) * b +
      (controls[3][2] - controls[2][2]) * c,
  ]);
}

/** Плавное значение профиля между ключами: без ступенек на стыках. */
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
      const local = smoothstep(fromShare, toShare, share);

      return lerpNumber(fromValue, toValue, local);
    }
  }

  return profile[profile.length - 1][1];
}

/**
 * Осевые точки лофта: 100 сечений по двум дугам Безье.
 *
 * На затылке дуги стыкуются с общей вертикальной касательной, поэтому ось не
 * ломается. Первая дуга даёт 50 сечений вместе с затылком, вторая — ещё 50 без
 * повторного затылка; итого ровно 100.
 */
function headSpineMm(
  scale: number,
  shiftYMm: number,
): readonly { readonly centerMm: Vec3; readonly tangentMm: Vec3 }[] {
  const shift: Vec3 = [0, shiftYMm, 0];
  const neckControls = JEWELRY_DEER_NECK_BEZIER.map((point) =>
    multiply(point, scale),
  ) as unknown as readonly [Vec3, Vec3, Vec3, Vec3];
  const headControls = JEWELRY_DEER_HEAD_BEZIER.map((point) =>
    multiply(point, scale),
  ) as unknown as readonly [Vec3, Vec3, Vec3, Vec3];
  const result: { centerMm: Vec3; tangentMm: Vec3 }[] = [];

  for (let index = 0; index < JEWELRY_DEER_HEAD_SECTIONS / 2; index += 1) {
    const share = index / (JEWELRY_DEER_HEAD_SECTIONS / 2 - 1);

    result.push({
      centerMm: add(cubicBezierAt(neckControls, share), shift),
      tangentMm: cubicBezierTangent(neckControls, share),
    });
  }

  const headStart = JEWELRY_DEER_HEAD_SECTIONS / 2;

  for (let index = headStart; index < JEWELRY_DEER_HEAD_SECTIONS; index += 1) {
    const share = (index - headStart + 1) / (JEWELRY_DEER_HEAD_SECTIONS / 2);

    result.push({
      centerMm: add(cubicBezierAt(headControls, share), shift),
      tangentMm: cubicBezierTangent(headControls, share),
    });
  }

  return result;
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

/** Скалярное произведение. */
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Базис трубы: два единичных вектора, перпендикулярных оси.
 *
 * Трубы рогов, отростков и ушей — прямые: `createAntlerPath` ставит кольца на
 * одной прямой от корня к кончику, поэтому ось у всей трубы одна и касательные по
 * ломаной не нужны. Раньше здесь стояли `ringBasis` и `polylineTangents`: они
 * обслуживали лофт бюста, где ось изгибалась, а у труб давали ту же самую ось на
 * каждом кольце. `e1` — проекция мировой X на плоскость кольца, поэтому грань
 * трубы не перекручивается от кольца к кольцу.
 */
function tubeFrame(axis: Vec3): { e1: Vec3; e2: Vec3 } {
  const reference: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = normalize(subtract(reference, multiply(axis, dot(reference, axis))));

  return { e1, e2: cross(axis, e1) };
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
 * План оленя: череп, шея, морда, киль, рога, уши, полость и габарит.
 *
 * План считается без three.js и без меша — по нему строятся и геометрия, и
 * подписи, и проверки в `scripts/test-jewelry-geometry.ts`. Все размеры
 * записаны для базы 150 мм и умножаются на `scale`, как ползунок длины.
 */
export function jewelryDeerPlan(
  params: Partial<JewelryStandParams> = {},
): JewelryDeerPlan {
  const normalized = normalizeJewelryStandParams(params);
  const baseLengthMm = normalized.deerBaseLength;
  const baseWidthMm = normalized.deerBaseWidth;
  const antlerSpreadMm = normalized.deerAntlerSpread;
  const scale = baseLengthMm / 150;
  const pocketRadiusMm = JEWELRY_DEER_WEIGHT_DIAMETER_MM / 2;
  // На базе шириной 80 мм полость Ø25 не помещается на прежних 34 мм вперёд:
  // её передняя кромка вышла бы за плиту. Поэтому смещение ограничено так,
  // чтобы между полостью и краем оставалось 2 мм. На базе 100 мм и шире
  // работает расчётное смещение 34 мм.
  const pocketOffsetMm = Math.min(
    JEWELRY_DEER_WEIGHT_OFFSET_MM,
    baseWidthMm / 2 - pocketRadiusMm - 2,
  );

  // Шея круглая (Ø40), а плита на минимуме всего 80 мм: между передней
  // кромкой шеи и задней кромкой полости остаётся меньше 1.4 мм. Сдвигаем бюст
  // назад ровно настолько, чтобы зазор стал 2 мм. На широких базах сдвиг
  // обнуляется и морда остаётся на расчётном выносе.
  const baseRadiusUpMm =
    (JEWELRY_DEER_HEAD_BASE_DIAMETER_MM / 2) *
    scale *
    profileValue(JEWELRY_DEER_HEAD_ASPECT_PROFILE, 0);
  const headShiftMm = Math.max(
    0,
    -pocketOffsetMm +
      pocketRadiusMm +
      2 +
      baseRadiusUpMm -
      1e-9,
  );
  const spine = headSpineMm(scale, headShiftMm);
  const sections: JewelryDeerHeadSection[] = spine.map((sample, index) => {
    const share = index / (JEWELRY_DEER_HEAD_SECTIONS - 1);
    const radiusXMm =
      (profileValue(JEWELRY_DEER_HEAD_DIAMETER_PROFILE, share) / 2) * scale;

    return {
      index,
      share,
      centerMm: sample.centerMm,
      tangentMm: sample.tangentMm,
      radiusXMm,
      radiusUpMm:
        radiusXMm *
        profileValue(JEWELRY_DEER_HEAD_ASPECT_PROFILE, share),
    };
  });
  const shiftHead = (point: readonly [number, number, number]): Vec3 => [
    point[0] * scale,
    point[1] * scale + headShiftMm,
    point[2] * scale,
  ];
  const spineStartMm = shiftHead(JEWELRY_DEER_HEAD_SPINE_START_MM);
  const spineNapeMm = shiftHead(JEWELRY_DEER_HEAD_SPINE_NAPE_MM);
  const spineNoseMm = shiftHead(JEWELRY_DEER_HEAD_SPINE_NOSE_MM);
  const earSection = sections[JEWELRY_DEER_EAR_PEAK_SECTION];
  const earTipZMm = earSection.centerMm[2] + JEWELRY_DEER_EAR_UP_MM * scale;
  const sectionCrownMm = sections.reduce(
    (top, section) =>
      Math.max(
        top,
        section.centerMm[2] - section.tangentMm[1] * section.radiusUpMm,
      ),
    Number.NEGATIVE_INFINITY,
  );
  const crownZMm = Math.max(sectionCrownMm, earTipZMm);
  const head: JewelryDeerHead = {
    sections,
    sectionCount: JEWELRY_DEER_HEAD_SECTIONS,
    pointsPerSection: JEWELRY_DEER_HEAD_SECTION_POINTS,
    baseDiameterMm: JEWELRY_DEER_HEAD_BASE_DIAMETER_MM * scale,
    skullDiameterMm: JEWELRY_DEER_HEAD_SKULL_DIAMETER_MM * scale,
    noseDiameterMm: JEWELRY_DEER_HEAD_NOSE_DIAMETER_MM * scale,
    spineStartMm,
    spineNapeMm,
    spineNoseMm,
    crownZMm,
  };
  const headLengthMm = magnitude(subtract(spineNoseMm, spineNapeMm));
  const headWidthMm =
    (JEWELRY_DEER_HEAD_SKULL_DIAMETER_MM +
      JEWELRY_DEER_EAR_OUT_MM * 2) *
    scale;
  const headHeightMm = JEWELRY_DEER_HEAD_SKULL_DIAMETER_MM * scale;
  const muzzleStart = sections[84];
  const muzzleLengthMm = magnitude(
    subtract(sections[sections.length - 1].centerMm, muzzleStart.centerMm),
  );
  const noseZMm =
    sections[sections.length - 1].radiusUpMm * 2;

  const rootSection = sections[JEWELRY_DEER_ANTLER_ROOT_SECTION];
  const rootZ = rootSection.centerMm[2] + 2 * scale;
  const rootX = JEWELRY_DEER_HEAD_SKULL_DIAMETER_MM * 0.25 * scale;
  const rootY = rootSection.centerMm[1];
  // Крайняя точка бутона отстоит от его центра на полный радиус: крышка —
  // полусфера, и «наружу» в +X и +Z она выходит на budR, а не на budR·k.
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
      // Отросток не толще ствола в месте крепления. Иначе его корневой торец
      // вылезает из ствола видимой площадкой, а нормаль торца смотрит вниз — это
      // готовое нависание. У низкого отростка ствол уже тонкий, поэтому радиус
      // корня считается от радиуса ствола, а не берётся из константы.
      const beamRadiusMm =
        JEWELRY_DEER_ANTLER_ROOT_RADIUS_MM +
        (JEWELRY_DEER_ANTLER_TIP_RADIUS_MM -
          JEWELRY_DEER_ANTLER_ROOT_RADIUS_MM) *
          tine.share;
      const tineRootRadiusMm = Math.min(
        JEWELRY_DEER_TINE_ROOT_RADIUS_MM,
        beamRadiusMm - 0.1,
      );
      const tineTipRadiusMm = Math.min(
        JEWELRY_DEER_ANTLER_TIP_RADIUS_MM,
        tineRootRadiusMm,
      );

      antlers.push(
        createAntlerPath({
          id: `tine-${index + 1}-${suffix}`,
          kind: "tine",
          side,
          rootMm: anchor,
          tipMm: add(anchor, multiply(direction, tine.lengthMm * scale)),
          rootRadiusMm: tineRootRadiusMm,
          tipRadiusMm: tineTipRadiusMm,
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

  // Верх модели — рога или свод черепа, что выше. Нос ниже обоих, поэтому в
  // габарит по Z не входит.
  const heightMm = Math.round(Math.max(crownZMm, antlerTopMm) * 100) / 100;

  const ears: JewelryDeerEar[] = [-1, 1].map((side) => ({
    id: `ear-${side < 0 ? "left" : "right"}`,
    rootMm: [
      side * earSection.radiusXMm * 0.8,
      earSection.centerMm[1],
      earSection.centerMm[2],
    ],
    tipMm: [
      side *
        (earSection.radiusXMm + JEWELRY_DEER_EAR_OUT_MM * scale),
      earSection.centerMm[1],
      earSection.centerMm[2] + JEWELRY_DEER_EAR_UP_MM * scale,
    ],
    halfWidthMm: JEWELRY_DEER_EAR_HALF_WIDTH_MM * scale,
    halfThicknessMm: JEWELRY_DEER_EAR_HALF_THICKNESS_MM * scale,
  }));

  return {
    baseLengthMm,
    baseWidthMm,
    baseHeightMm: JEWELRY_DEER_BASE_HEIGHT_MM,
    pocketCenterMm: [0, -pocketOffsetMm],
    pocketOffsetMm,
    pocketRadiusMm,
    pocketDepthMm: JEWELRY_DEER_WEIGHT_DEPTH_MM,
    pocketFloorMm: JEWELRY_DEER_WEIGHT_FLOOR_MM,
    scale,
    head,
    headLengthMm,
    headWidthMm,
    headHeightMm,
    muzzleLengthMm,
    noseYMm: spineNoseMm[1],
    noseZMm,
    crownZMm,
    antlerSpreadMm,
    antlerOuterXMm,
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

/**
 * Окно уха вдоль оси: плавный лепесток с максимумом на 73-м сечении.
 *
 * За пределами 18 сечений вырост равен нулю, поэтому ухо не тянется ни к
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
 * Кольцо одного сечения лофта.
 *
 * Ось сечения — касательная Безье, поэтому кольцо всегда перпендикулярно
 * изгибу. Мировой X остаётся первой полуосью: ось лежит в плоскости YZ, и
 * перекрута вокруг неё нет. Вторая полуось — `e2 = (0, tz, −ty)`, то есть
 * «вверх» в плоскости сечения.
 *
 * Уши задаются двумя гладкими полями: боковым выносом и подъёмом. Они
 * включаются только возле боковых точек (`|cos θ|` в степени 24), поэтому
 * спина и низ головы остаются эллипсами, а ухо вырастает из поверхности, не
 * добавляя отдельного тела.
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
    // Лепесток уха посажен не на экватор, а на 30° выше него. Тогда ухо
    // растёт наружу и вверх, а его нижняя кромка плавно (степень 6 обнуляет и
    // значение, и производную) сходит на нет ещё до низа кольца. Если центр
    // лепестка поставить на экватор, подъём верхней половины даёт отвесную
    // стенку под ухом — нависание круче 45°.
    const earAngle = side * (Math.PI / 6);
    const earLobe =
      earWindow *
      Math.max(0, Math.cos(angle - earAngle)) **
        JEWELRY_DEER_EAR_ANGULAR_POWER;
    const lateralMm =
      cosine * section.radiusXMm +
      side * earLobe * (JEWELRY_DEER_EAR_OUT_MM * head.skullDiameterMm) /
        JEWELRY_DEER_HEAD_SKULL_DIAMETER_MM;
    // Нижняя дуга в передней части головы заменяется килем: две грани под
    // 45° к столу вместо круглого низа, который на горизонтальной морде висел
    // бы над столом. К шее киль плавно сходит на нет, иначе он выдвинул бы её
    // переднюю кромку в полость базы.
    const keelShare = smoothstep(0.58, 0.72, section.share);
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
    const liftMm =
      earLobe *
      (JEWELRY_DEER_EAR_UP_MM *
        head.skullDiameterMm) /
      JEWELRY_DEER_HEAD_SKULL_DIAMETER_MM;

    ring.push([
      section.centerMm[0] + lateralMm,
      section.centerMm[1] + e2[1] * upMm,
      section.centerMm[2] + e2[2] * upMm + liftMm,
    ]);
  }

  return ring;
}

/**
 * Единый гладкий лофт головы и шеи.
 *
 * 100 колец соединяются 99 поясами по 64 четырёхугольника. Нижний торец
 * закрыт веером внутри плиты, верхний — скруглённой крышкой из
 * `addDomeCap`: у носа нет плоской площадки. Уши уже входят в кольца, поэтому
 * отдельных тел и швов на голове нет.
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
    lastSection.radiusXMm,
  );
}

/**
 * Одна труба рога: конус, стенки, крышки и бутон на конце.
 *
 * Труба прямая, поэтому базис кольца считается один раз на всю трубу: раньше он
 * пересчитывался по касательным ломаной, и на изломе кольцо могло развернуться.
 * Здесь излома нет вовсе, а у рогов и отростков он и не нужен.
 */
function addAntlerTube(
  positions: number[],
  path: JewelryDeerAntlerPath,
): void {
  const sides = JEWELRY_DEER_ANTLER_SIDES;
  const centers = path.points.map(pointToVec);
  const first = centers[0];
  const last = centers[centers.length - 1];
  const axis = normalize(subtract(last, first));
  const { e1, e2 } = tubeFrame(axis);

  const rings = path.points.map((point, index) => {
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
  addRingFan(positions, first, rings[0], false);

  for (let index = 0; index < rings.length - 1; index += 1) {
    addRingWalls(positions, rings[index], rings[index + 1]);
  }

  addDomeCap(
    positions,
    last,
    axis,
    rings[rings.length - 1],
    path.points[path.points.length - 1].radiusMm,
  );
}

/**
 * Геометрия бюста «Лесной олень» для набора параметров.
 *
 * Деталь построена Z-вверх; база и бюст стоят в начале координат, олень смотрит
 * в −Y. Голова, шея и уши — один неиндексированный лофт. База и рога остаются
 * отдельными замкнутыми телами и пересекаются с ним, как и раньше: слайсер
 * объединяет их при печати.
 */
export function createJewelryDeerGeometry(
  params: Partial<JewelryStandParams> = {},
): BufferGeometry {
  const plan = jewelryDeerPlan(params);
  const positions: number[] = [];

  addDeerHeadLoft(positions, plan.head);
  addDeerBase(positions, plan);

  for (const path of plan.antlers) {
    addAntlerTube(positions, path);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

  // Требование ТЗ: сначала считаем нормали по вершинам. У неиндексированного
  // лофта эта операция даёт нормаль грани, поэтому следом `applyCreasedNormals`
  // сваривает совпадающие вершины и сглаживает всё, что сходится под углом до
  // 60°. Кончики ушей и кромка плиты (90°) остаются читаемыми рёбрами.
  geometry.computeVertexNormals();

  const smoothed = applyCreasedNormals(geometry, 60);

  smoothed.computeBoundingBox();
  smoothed.computeBoundingSphere();

  return smoothed;
}

