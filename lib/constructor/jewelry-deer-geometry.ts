/**
 * Геометрия бюста «Лесной олень».
 *
 * Вторая форма премиум-коллекции: овальная база с полостью под утяжелитель и
 * стилизованный бюст без глаз и ноздрей. Конструкция головы собрана из
 * примитивов, а не из вертикальных срезов: череп — сплюснутая по бокам сфера
 * 64 × 64, морда — усечённый конус, шея — цилиндр с раструбом к базе, уши —
 * два сплюснутых конуса. Рога остаются трубами с бутонами: это рабочая часть
 * держателя, а не декор.
 *
 * Пропорции взяты из `deer-research.md` §1 и §3.3: череп около 24 × 25 × 30 мм,
 * морда длиннее черепа (≈30 мм) и вынесена вперёд, нос 7.2 × 10.2 мм, уши
 * подняты на 53.6°. Сфера даёт гладкий свод, усечённый конус — сужение к носу,
 * которое читается сбоку как морда, а не как клюв.
 *
 * Печатность держится на трёх решениях. Нижняя половина черепа утоплена в
 * наклонную шею, поэтому её полусфера не висит в воздухе. Под мордой идёт
 * четырёхгранный киль: его грани круче 45°, и они закрывают нижнюю дугу конуса,
 * которая иначе нависала бы над столом. Шея наклонена вперёд и расширяется к
 * базе; её боковые нормали отклоняются от вертикали меньше чем на 28°.
 *
 * Рога растут из черепа: корень `(±4.5, −26, 84)` утоплен внутрь головы, ствол
 * выходит наружу над затылком и уходит вверх и в стороны под 52°. Четыре отростка
 * на сторону, первый — надбровный: он загибается над мордой и делает узнаваемым
 * именно оленя. Уши — конусы, направленные в стороны и вверх.
 *
 * База — эллиптическая плита 4 мм. Полость Ø25 × 2.5 мм открыта вверх, под ней
 * остаётся дно 1.5 мм, поэтому плита не сквозная и печатается без мостов. Центр
 * полости сдвинут на 22 мм вперёд, перед бюстом: под шеей стоит широкая
 * подошва, и монету там не опустить, а перед оленем получается чаша-лоток под
 * кольца. Противовес для устойчивости не нужен: даже с грузом 200 г на кончике
 * рога при максимальном размахе запас по опрокидыванию больше единицы.
 *
 * Все тела замкнуты по отдельности и пересекаются: низ шеи уходит в базу, корни
 * рогов — в голову, корни отростков — в ствол. Слайсер объединяет их при печати,
 * булевых операций нет. После слияния примитивов нормали сглаживаются с порогом
 * 45°, поэтому свод головы и бока труб гладкие, а кромка плиты остаётся острой.
 *
 * Система координат общая для коллекции: Z вверх, низ на z = 0, центр базы в
 * начале координат, олень смотрит в −Y.
 */

import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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
 * Полость стоит **перед** бюстом, а не под ним. Под шеей стоит раструб радиусом
 * 14 мм: монета оказалась бы под ним, и опустить её было бы некуда. Перед оленем
 * плита свободна от `y = −9.5` до `y = −34.5`, и получается чаша-лоток под
 * кольца — так же обыграна база у референсов из исследования. Задняя кромка
 * полости отстоит от переднего края раструба на миллиметр, поэтому монета
 * проходит между ними.
 */
export const JEWELRY_DEER_WEIGHT_OFFSET_MM = 22;

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
 * Сегменты черепа, шт.: 64 × 64 дают гладкий свод без видимых граней.
 *
 * Ниже 48 сегментов на сфере видны полосы после сглаживания, выше 64 — растёт
 * число треугольников, а силуэт не меняется: на габарите 24 × 30 мм шаг дуги
 * при 64 сегментах меньше 1.5 мм.
 */
export const JEWELRY_DEER_SKULL_SEGMENTS = 64;

/** Радиусы черепа, мм: сплюснут по бокам, вытянут вперёд и вверх. */
export const JEWELRY_DEER_SKULL_RADII_MM = [11.8, 12, 15] as const;

/** Центр черепа, мм: над шеей, свод на 88 мм. */
export const JEWELRY_DEER_SKULL_CENTER_MM = [0, -22, 73] as const;

/** Основание наклонной шеи, мм: начинается внутри раструба. */
export const JEWELRY_DEER_NECK_BASE_MM = [0, 5.5, 10] as const;

/** Верх шеи, мм: утоплен в череп, поэтому его полусфера не нависает. */
export const JEWELRY_DEER_NECK_TOP_MM = [0, -22, 64] as const;

/** Радиус шеи у основания, мм. */
export const JEWELRY_DEER_NECK_BASE_RADIUS_MM = 12.8;

/** Радиус шеи у черепа, мм: уже черепа, но закрывает его нижнюю половину. */
export const JEWELRY_DEER_NECK_TOP_RADIUS_MM = 10.5;

/**
 * Раструб у базы: вертикальный цилиндр от стола до наклонной шеи, мм.
 *
 * Наклонная шея не может опираться на стол нижним торцом: её торец повёрнут
 * вместе с осью и частью ушёл бы ниже z = 0. Вертикальный раструб стоит на
 * столе, а наклонная шея начинается внутри него — нижний торец спрятан, и
 * деталь не проваливается под стол.
 */
export const JEWELRY_DEER_NECK_COLLAR_BASE_MM = [0, 5.5, 0] as const;

/** Верх раструба, мм: выше самой высокой точки нижнего торца шеи. */
export const JEWELRY_DEER_NECK_COLLAR_TOP_MM = [0, 5.5, 17] as const;

/** Радиус раструба у стола, мм: передняя кромка в миллиметре от полости. */
export const JEWELRY_DEER_NECK_COLLAR_BASE_RADIUS_MM = 14;

/** Радиус раструба у шеи, мм. */
export const JEWELRY_DEER_NECK_COLLAR_TOP_RADIUS_MM = 13.5;

/** Начало морды, мм: внутри черепа, чтобы конус не торчал торцом. */
export const JEWELRY_DEER_MUZZLE_BASE_MM = [0, -20, 74] as const;

/** Кончик носа, мм: длинная морда, вынесенная за плиту на 3 мм. */
export const JEWELRY_DEER_MUZZLE_TIP_MM = [0, -53, 68] as const;

/** Радиус морды у черепа, мм: по X; по Z он растянут в 1.39 раза. */
export const JEWELRY_DEER_MUZZLE_BASE_RADIUS_MM = 8.3;

/** Радиус морды у носа, мм: нос 7.2 × 10.2 мм после растяжения по Z. */
export const JEWELRY_DEER_MUZZLE_TIP_RADIUS_MM = 3.6;

/** Растяжение сечения морды: 1.39 даёт высоту носа 10.2 мм при ширине 7.2. */
export const JEWELRY_DEER_MUZZLE_Z_SCALE = 1.39;

/** Сегменты морды и шеи, шт.: 64 держат круглое сечение гладким. */
export const JEWELRY_DEER_BODY_SEGMENTS = 64;

/** Сегменты киля, шт.: четыре грани дают печатный клин под мордой. */
export const JEWELRY_DEER_JAW_SEGMENTS = 4;

/**
 * Доля полуширины морды, на которой стоят боковые вершины киля.
 *
 * `1/√2` — это точки нижней дуги под 45°: выше них нормаль конуса уже не
 * нависает, ниже — киль закрывает её своими гранями.
 */
export const JEWELRY_DEER_JAW_SIDE_SHARE = Math.SQRT1_2;

/**
 * Высота грани киля к его полуширине.
 *
 * 0.8 при боковой доле `1/√2` даёт наклон грани 48.5° к столу: нормаль
 * отклоняется вниз только на 41.5°, то есть киль печатается без поддержки.
 */
export const JEWELRY_DEER_JAW_DEPTH_SHARE = 0.8;

/**
 * Перекрытие киля по отношению к морде: 1.5 %.
 *
 * Если боковая вершина киля попадает точно в вершину 64-гранной морды, сварка
 * вершин в проверке объединяет два тела в не-многообразие. Полтора процента
 * (0.09 мм на базе) дают зазор, достаточный для сварки, и не видны на глаз.
 */
export const JEWELRY_DEER_JAW_COVER_SHARE = 1.015;

/** Число сторон базы, шт.: 96 держит овал гладким на любом размере. */
const JEWELRY_DEER_BASE_SIDES = 96;

/** Корень ствола рога, мм: внутри черепа над лбом, `z` — на 3.4 ниже свода. */
export const JEWELRY_DEER_ANTLER_ROOT_MM = [4.5, -26, 84] as const;

/** Куда уходит кончик ствола по Y, мм: рога слегка зачёсаны назад. */
const JEWELRY_DEER_ANTLER_TIP_Y_MM = 2;

/**
 * Корень уха, мм: утоплен в череп на 3 мм вдоль оси уха.
 *
 * Если поставить корень на поверхность (4.5, −19, 76), край его торца выходит
 * наружу над сводом у затылка, и торец становится площадкой с нормалью вниз.
 * Сдвиг на 3 мм вдоль оси уха уводит весь торец под свод, а направление и подъём
 * уха остаются прежними — 53.6°.
 */
export const JEWELRY_DEER_EAR_ROOT_MM = [3.2, -20.2, 73.6] as const;

/** Кончик уха, мм: подъём 53.6°, поэтому конус уха не нависает. */
export const JEWELRY_DEER_EAR_TIP_MM = [11, -13, 88] as const;

/** Полуширина уха, мм: конус сплюснут, 4.4 мм в плоскости и 3.2 мм толщиной. */
const JEWELRY_DEER_EAR_HALF_WIDTH_MM = 2.2;

/** Полутолщина уха, мм: по X, наружу от головы. */
const JEWELRY_DEER_EAR_HALF_THICKNESS_MM = 1.6;

/** Число сторон конуса уха, шт.: 32 дают гладкий сплюснутый конус. */
const JEWELRY_DEER_EAR_SIDES = 32;

/**
 * Голова из примитивов: пропорции, по которым собирается меш.
 *
 * Поля хранятся в миллиметрах при `scale = 1` и проверяются тестом. Геометрия
 * читает те же числа, поэтому подпись, проверка пропорций и STL не расходятся.
 */
export type JewelryDeerHead = {
  /** Центр и радиусы сферы черепа: по X она сплюснута. */
  readonly skullCenterMm: Vec3;
  readonly skullRadiiMm: Vec3;
  readonly skullSegments: number;
  /** Шея: наклонный цилиндр с раструбом к базе. */
  readonly neckBaseMm: Vec3;
  readonly neckTopMm: Vec3;
  readonly neckBaseRadiusMm: number;
  readonly neckTopRadiusMm: number;
  readonly neckCollarBaseMm: Vec3;
  readonly neckCollarTopMm: Vec3;
  readonly neckCollarBaseRadiusMm: number;
  readonly neckCollarTopRadiusMm: number;

  /** Морда: усечённый конус от черепа к носу. */
  readonly muzzleBaseMm: Vec3;
  readonly muzzleTipMm: Vec3;
  readonly muzzleBaseRadiusMm: number;
  readonly muzzleTipRadiusMm: number;
  readonly muzzleZScale: number;
  readonly muzzleSegments: number;
  /** Киль под мордой: четырёхгранный конус, закрывающий нависание. */
  readonly jawBaseMm: Vec3;
  readonly jawTipMm: Vec3;
  readonly jawBaseRadiusXMm: number;
  readonly jawBaseRadiusZMm: number;
  readonly jawTipRadiusXMm: number;
  readonly jawTipRadiusZMm: number;
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
  readonly pocketRadiusMm: number;
  readonly pocketDepthMm: number;
  readonly pocketFloorMm: number;
  readonly scale: number;
  /** Череп, шея, морда и киль — те же числа, что уходят в примитивы. */
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

  const skullCenterMm: Vec3 = [
    JEWELRY_DEER_SKULL_CENTER_MM[0] * scale,
    JEWELRY_DEER_SKULL_CENTER_MM[1] * scale,
    JEWELRY_DEER_SKULL_CENTER_MM[2] * scale,
  ];
  const skullRadiiMm: Vec3 = [
    JEWELRY_DEER_SKULL_RADII_MM[0] * scale,
    JEWELRY_DEER_SKULL_RADII_MM[1] * scale,
    JEWELRY_DEER_SKULL_RADII_MM[2] * scale,
  ];
  const neckBaseMm: Vec3 = [
    JEWELRY_DEER_NECK_BASE_MM[0] * scale,
    JEWELRY_DEER_NECK_BASE_MM[1] * scale,
    JEWELRY_DEER_NECK_BASE_MM[2] * scale,
  ];
  const neckTopMm: Vec3 = [
    JEWELRY_DEER_NECK_TOP_MM[0] * scale,
    JEWELRY_DEER_NECK_TOP_MM[1] * scale,
    JEWELRY_DEER_NECK_TOP_MM[2] * scale,
  ];
  const neckCollarBaseMm: Vec3 = [
    JEWELRY_DEER_NECK_COLLAR_BASE_MM[0] * scale,
    JEWELRY_DEER_NECK_COLLAR_BASE_MM[1] * scale,
    JEWELRY_DEER_NECK_COLLAR_BASE_MM[2] * scale,
  ];
  const neckCollarTopMm: Vec3 = [
    JEWELRY_DEER_NECK_COLLAR_TOP_MM[0] * scale,
    JEWELRY_DEER_NECK_COLLAR_TOP_MM[1] * scale,
    JEWELRY_DEER_NECK_COLLAR_TOP_MM[2] * scale,
  ];

  const muzzleBaseMm: Vec3 = [
    JEWELRY_DEER_MUZZLE_BASE_MM[0] * scale,
    JEWELRY_DEER_MUZZLE_BASE_MM[1] * scale,
    JEWELRY_DEER_MUZZLE_BASE_MM[2] * scale,
  ];
  const muzzleTipMm: Vec3 = [
    JEWELRY_DEER_MUZZLE_TIP_MM[0] * scale,
    JEWELRY_DEER_MUZZLE_TIP_MM[1] * scale,
    JEWELRY_DEER_MUZZLE_TIP_MM[2] * scale,
  ];
  const muzzleBaseRadiusMm = JEWELRY_DEER_MUZZLE_BASE_RADIUS_MM * scale;
  const muzzleTipRadiusMm = JEWELRY_DEER_MUZZLE_TIP_RADIUS_MM * scale;
  const muzzleBaseRadiusZ = muzzleBaseRadiusMm * JEWELRY_DEER_MUZZLE_Z_SCALE;
  const muzzleTipRadiusZ = muzzleTipRadiusMm * JEWELRY_DEER_MUZZLE_Z_SCALE;
  // Киль стоит ниже оси морды на `r_z/√2` вдоль её поперечной оси. Смещение
  // берётся не по мировому Z, а по местному Z конуса: только тогда боковые
  // вершины киля лежат ровно на поверхности морды под 45°.
  const muzzleAxis = normalize(subtract(muzzleTipMm, muzzleBaseMm));
  const muzzleDown: Vec3 = [0, -muzzleAxis[2], muzzleAxis[1]];
  const jawBaseMm: Vec3 = add(
    muzzleBaseMm,
    multiply(
      muzzleDown,
      muzzleBaseRadiusZ * JEWELRY_DEER_JAW_SIDE_SHARE,
    ),
  );
  const jawTipMm: Vec3 = add(
    muzzleTipMm,
    multiply(
      muzzleDown,
      muzzleTipRadiusZ * JEWELRY_DEER_JAW_SIDE_SHARE,
    ),
  );
  const head: JewelryDeerHead = {
    skullCenterMm,
    skullRadiiMm,
    skullSegments: JEWELRY_DEER_SKULL_SEGMENTS,
    neckBaseMm,
    neckTopMm,
    neckBaseRadiusMm: JEWELRY_DEER_NECK_BASE_RADIUS_MM * scale,
    neckTopRadiusMm: JEWELRY_DEER_NECK_TOP_RADIUS_MM * scale,
    neckCollarBaseMm,
    neckCollarTopMm,
    neckCollarBaseRadiusMm:
      JEWELRY_DEER_NECK_COLLAR_BASE_RADIUS_MM * scale,
    neckCollarTopRadiusMm:
      JEWELRY_DEER_NECK_COLLAR_TOP_RADIUS_MM * scale,

    muzzleBaseMm,
    muzzleTipMm,
    muzzleBaseRadiusMm,
    muzzleTipRadiusMm,
    muzzleZScale: JEWELRY_DEER_MUZZLE_Z_SCALE,
    muzzleSegments: JEWELRY_DEER_BODY_SEGMENTS,
    jawBaseMm,
    jawTipMm,
    jawBaseRadiusXMm:
      muzzleBaseRadiusMm *
      JEWELRY_DEER_JAW_SIDE_SHARE *
      JEWELRY_DEER_JAW_COVER_SHARE,
    jawBaseRadiusZMm:
      muzzleBaseRadiusMm *
      JEWELRY_DEER_JAW_DEPTH_SHARE *
      JEWELRY_DEER_JAW_COVER_SHARE,
    jawTipRadiusXMm:
      muzzleTipRadiusMm *
      JEWELRY_DEER_JAW_SIDE_SHARE *
      JEWELRY_DEER_JAW_COVER_SHARE,
    jawTipRadiusZMm:
      muzzleTipRadiusMm *
      JEWELRY_DEER_JAW_DEPTH_SHARE *
      JEWELRY_DEER_JAW_COVER_SHARE,
  };
  const crownZMm = skullCenterMm[2] + skullRadiiMm[2];
  const headWidthMm = skullRadiiMm[0] * 2;
  const headHeightMm = skullRadiiMm[2] * 2;
  const headBackY = skullCenterMm[1] + skullRadiiMm[1];
  const headLengthMm = headBackY - muzzleTipMm[1];
  const muzzleLengthMm = magnitude(
    subtract(muzzleTipMm, muzzleBaseMm),
  );
  const noseZMm =
    2 *
    muzzleTipRadiusZ *
    Math.sqrt(1 - muzzleAxis[2] ** 2);

  const rootZ = JEWELRY_DEER_ANTLER_ROOT_MM[2] * scale;
  const rootX = JEWELRY_DEER_ANTLER_ROOT_MM[0] * scale;
  const rootY = JEWELRY_DEER_ANTLER_ROOT_MM[1] * scale;
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
      side * JEWELRY_DEER_EAR_ROOT_MM[0] * scale,
      JEWELRY_DEER_EAR_ROOT_MM[1] * scale,
      JEWELRY_DEER_EAR_ROOT_MM[2] * scale,
    ],
    tipMm: [
      side * JEWELRY_DEER_EAR_TIP_MM[0] * scale,
      JEWELRY_DEER_EAR_TIP_MM[1] * scale,
      JEWELRY_DEER_EAR_TIP_MM[2] * scale,
    ],
    halfWidthMm: JEWELRY_DEER_EAR_HALF_WIDTH_MM * scale,
    halfThicknessMm: JEWELRY_DEER_EAR_HALF_THICKNESS_MM * scale,
  }));

  return {
    baseLengthMm,
    baseWidthMm,
    baseHeightMm: JEWELRY_DEER_BASE_HEIGHT_MM,
    pocketCenterMm: [0, -JEWELRY_DEER_WEIGHT_OFFSET_MM],
    pocketRadiusMm: JEWELRY_DEER_WEIGHT_DIAMETER_MM / 2,
    pocketDepthMm: JEWELRY_DEER_WEIGHT_DEPTH_MM,
    pocketFloorMm: JEWELRY_DEER_WEIGHT_FLOOR_MM,
    scale,
    head,
    headLengthMm,
    headWidthMm,
    headHeightMm,
    muzzleLengthMm,
    noseYMm: muzzleTipMm[1],
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
 * Подготовка примитива к слиянию.
 *
 * У `SphereGeometry`, `CylinderGeometry` и `ConeGeometry` есть `uv` и индекс;
 * `mergeGeometries` требует одинаковый набор атрибутов и одинаковое состояние
 * индекса. Поэтому примитив разворачивается в неиндексированный вид, а `uv`
 * удаляется: в STL он не нужен, а в памяти занимает больше, чем позиции.
 */
function flattenPrimitive(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.getIndex() ? geometry.toNonIndexed() : geometry;

  if (flat !== geometry) {
    geometry.dispose();
  }

  flat.deleteAttribute("uv");
  flat.deleteAttribute("normal");

  return flat;
}

/**
 * Базис примитива: локальный Y смотрит вдоль оси, локальный X — наружу по X.
 *
 * Для всех тел головы ось лежит в плоскости YZ, поэтому мировой X всегда
 * перпендикулярен ей и годится в базис без проекции. Локальный Z считается
 * векторным произведением, чтобы обход треугольников остался правым.
 */
function axisBasis(axis: Vec3): Matrix4 {
  const xAxis = normalize(
    subtract([1, 0, 0], multiply(axis, dot([1, 0, 0], axis))),
  );
  const zAxis = cross(xAxis, axis);

  return new Matrix4().makeBasis(
    new Vector3(xAxis[0], xAxis[1], xAxis[2]),
    new Vector3(axis[0], axis[1], axis[2]),
    new Vector3(zAxis[0], zAxis[1], zAxis[2]),
  );
}

/**
 * Усечённый конус или цилиндр между двумя точками.
 *
 * `CylinderGeometry` растёт вдоль +Y: верхнее кольцо получает радиус кончика,
 * нижнее — радиус основания. После масштаба локального Z и поворота на базис
 * тело встаёт вдоль оси; торцы остаются замкнутыми.
 */
function createAxisBody(options: {
  readonly baseMm: Vec3;
  readonly tipMm: Vec3;
  readonly baseRadiusMm: number;
  readonly tipRadiusMm: number;
  readonly segments: number;
  readonly zScale?: number;
}): BufferGeometry {
  const direction = subtract(options.tipMm, options.baseMm);
  const lengthMm = magnitude(direction);

  if (lengthMm <= 1e-9) {
    throw new Error("Нулевая длина примитива головы");
  }

  const axis = multiply(direction, 1 / lengthMm);
  const geometry = new CylinderGeometry(
    options.tipRadiusMm,
    options.baseRadiusMm,
    lengthMm,
    options.segments,
    1,
    false,
  );

  geometry.scale(1, 1, options.zScale ?? 1);
  geometry.applyMatrix4(axisBasis(axis));
  geometry.translate(
    (options.baseMm[0] + options.tipMm[0]) / 2,
    (options.baseMm[1] + options.tipMm[1]) / 2,
    (options.baseMm[2] + options.tipMm[2]) / 2,
  );

  return flattenPrimitive(geometry);
}

/** Сплюснутый конус уха: вершина на кончике, основание в черепе. */
function createEarCone(
  ear: JewelryDeerEar,
  segments: number,
): BufferGeometry {
  const direction = subtract(ear.tipMm, ear.rootMm);
  const lengthMm = magnitude(direction);
  const axis = normalize(direction);
  // `thin` — наружу по X, `wide` — вдоль плоскости уха. Базис правый:
  // локальный X уходит в thin, локальный Y — в ось, локальный Z — в wide.
  const thin = normalize(
    subtract([1, 0, 0], multiply(axis, dot([1, 0, 0], axis))),
  );
  const wide = cross(thin, axis);
  const geometry = new ConeGeometry(1, lengthMm, segments, 1, false);

  geometry.scale(ear.halfThicknessMm, 1, ear.halfWidthMm);
  geometry.applyMatrix4(
    new Matrix4().makeBasis(
      new Vector3(thin[0], thin[1], thin[2]),
      new Vector3(axis[0], axis[1], axis[2]),
      new Vector3(wide[0], wide[1], wide[2]),
    ),
  );
  geometry.translate(
    (ear.rootMm[0] + ear.tipMm[0]) / 2,
    (ear.rootMm[1] + ear.tipMm[1]) / 2,
    (ear.rootMm[2] + ear.tipMm[2]) / 2,
  );

  return flattenPrimitive(geometry);
}

/**
 * Голова целиком: череп, шея, морда и киль.
 *
 * Череп — сфера с сегментами 64 × 64, сплюснутая по X: ширина 23.6 мм при
 * высоте 30 и глубине 24. Шея — наклонный цилиндр с раструбом к базе; её верх
 * утоплен в череп и закрывает нижнюю полусферу. Морда — усечённый конус от
 * черепа к носу, а под ней четырёхгранный киль, который забирает себе нижнюю
 * дугу, нависавшую бы над столом.
 */
function createDeerHeadGeometries(
  head: JewelryDeerHead,
): BufferGeometry[] {
  const skull = new SphereGeometry(
    1,
    head.skullSegments,
    head.skullSegments,
  );

  skull.scale(
    head.skullRadiiMm[0],
    head.skullRadiiMm[1],
    head.skullRadiiMm[2],
  );
  skull.translate(
    head.skullCenterMm[0],
    head.skullCenterMm[1],
    head.skullCenterMm[2],
  );

  const neck = createAxisBody({
    baseMm: head.neckBaseMm,
    tipMm: head.neckTopMm,
    baseRadiusMm: head.neckBaseRadiusMm,
    tipRadiusMm: head.neckTopRadiusMm,
    segments: JEWELRY_DEER_BODY_SEGMENTS,
  });
  const collar = createAxisBody({
    baseMm: head.neckCollarBaseMm,
    tipMm: head.neckCollarTopMm,
    baseRadiusMm: head.neckCollarBaseRadiusMm,
    tipRadiusMm: head.neckCollarTopRadiusMm,
    segments: JEWELRY_DEER_BODY_SEGMENTS,
  });

  const muzzle = createAxisBody({
    baseMm: head.muzzleBaseMm,
    tipMm: head.muzzleTipMm,
    baseRadiusMm: head.muzzleBaseRadiusMm,
    tipRadiusMm: head.muzzleTipRadiusMm,
    segments: head.muzzleSegments,
    zScale: head.muzzleZScale,
  });
  const jaw = createAxisBody({
    baseMm: head.jawBaseMm,
    tipMm: head.jawTipMm,
    baseRadiusMm: head.jawBaseRadiusXMm,
    tipRadiusMm: head.jawTipRadiusXMm,
    segments: JEWELRY_DEER_JAW_SEGMENTS,
    zScale: head.jawBaseRadiusZMm / head.jawBaseRadiusXMm,
  });

  return [flattenPrimitive(skull), neck, collar, muzzle, jaw];
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
 * в −Y. Все тела замкнуты по отдельности и пересекаются — слайсер объединит их
 * при печати.
 */
export function createJewelryDeerGeometry(
  params: Partial<JewelryStandParams> = {},
): BufferGeometry {
  const plan = jewelryDeerPlan(params);
  const positions: number[] = [];
  const headParts: BufferGeometry[] = [
    ...createDeerHeadGeometries(plan.head),
    ...plan.ears.map((ear) => createEarCone(ear, JEWELRY_DEER_EAR_SIDES)),
  ];
  const headGeometry = mergeGeometries(headParts, false);

  if (!headGeometry) {
    throw new Error("Не удалось слить примитивы головы оленя");
  }

  const headPosition = headGeometry.getAttribute("position");

  for (let index = 0; index < headPosition.count; index += 1) {
    positions.push(
      headPosition.getX(index),
      headPosition.getY(index),
      headPosition.getZ(index),
    );
  }

  for (const part of headParts) {
    part.dispose();
  }

  headGeometry.dispose();

  addDeerBase(positions, plan);

  for (const path of plan.antlers) {
    addAntlerTube(positions, path);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

  // Примитивы приходят с плоскими нормалями и мелкими гранями; после слияния
  // сглаживаем всё, что сходится под углом до 45°. Свод черепа и конус морды
  // читаются цельной поверхностью, а кромка плиты (90°) остаётся острой.
  const smoothed = applyCreasedNormals(geometry, 45);

  smoothed.computeBoundingBox();
  smoothed.computeBoundingSphere();

  return smoothed;
}

