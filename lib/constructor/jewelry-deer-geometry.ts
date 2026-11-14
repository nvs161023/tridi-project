/**
 * Геометрия бюста «Лесной олень».
 *
 * Вторая форма премиум-коллекции: овальная база с полостью под утяжелитель и
 * стилизованный бюст без глаз и ноздрей. Узнаваемость держится на рогах и ушах,
 * а лицо остаётся гладкой поверхностью — это приём классической скульптуры, а не
 * упрощение.
 *
 * Бюст собран вертикальными срезами: вдоль Y от затылка к носу стоят плоские
 * сечения `y = const`, а силуэт задают три независимые кривые — верх `zTop(y)`,
 * низ `zBottom(y)` и полуширина `w(y)`. Профиль сбоку читается напрямую, как
 * рисунок: лоб на 88 мм, нос вынесен на 53 мм вперёд и опущен на 70…80 мм. В
 * прежней схеме силуэт был следствием наклона колец: ось головы задиралась вверх
 * на 24°, и бюст читался шаром с клювом.
 *
 * Сечение — не эллипс, а «суперэллипс сверху, киль снизу»: верхняя половина
 * набрана дугой с показателем 2.6, а от самой широкой точки вниз идут две грани
 * под 49°. Это и есть решение задачи печати: у лофта по наклонной оси низ кольца
 * нависал под 66°, а грань киля круче 45° по построению, то есть поддержки не
 * нужны при любом наклоне морды.
 *
 * Рога растут из черепа: корень `(±4.5, −26, 84)` утоплен внутрь головы, ствол
 * выходит наружу над затылком и уходит вверх и в стороны под 52°. Четыре отростка
 * на сторону, первый — надбровный: он загибается над мордой и делает узнаваемым
 * именно оленя. Уши — узкие плавники за рогами: без них голова читается молотком.
 *
 * Рога и уши — трубы с растянутым «бутоном» на конце вместо шара: шар дал бы
 * нижнюю полусферу с нависанием 90°, а плавное утолщение укладывается в те же
 * 45° и держит кольцо. Каждый участок трубы поднят над столом не меньше 45°.
 *
 * База — эллиптическая плита 4 мм. Полость Ø25 × 2.5 мм открыта вверх, под ней
 * остаётся дно 1.5 мм, поэтому плита не сквозная и печатается без мостов. Центр
 * полости сдвинут на 22 мм вперёд, перед бюстом: под грудью стоит широкая
 * подошва, и монету там не опустить, а перед оленем получается чаша-лоток под
 * кольца. Противовес для устойчивости не нужен: даже с грузом 200 г на кончике
 * рога при максимальном размахе запас по опрокидыванию больше единицы.
 *
 * Все тела замкнуты по отдельности и пересекаются: низ бюста уходит в базу на
 * миллиметр с половиной, корни рогов — в голову, корни отростков — в ствол.
 * Слайсер объединяет их при печати, булевых операций нет.
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
 * Полость стоит **перед** бюстом, а не под ним. Под грудью идёт широкая подошва
 * киля на `z = 2.5`: монета оказалась бы под ней, и опустить её было бы некуда.
 * Перед оленем плита свободна от `y = −9.5` до `y = −34.5`, и получается
 * чаша-лоток под кольца — так же обыграна база у референсов из исследования.
 * Задняя кромка полости отстоит от переднего края подошвы на миллиметр, поэтому
 * монета проходит между ними.
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

/** Число внутренних точек верхней дуги сечения, шт.: 18 даёт гладкий верх. */
const JEWELRY_DEER_SECTION_ARCS = 18;

/** Показатель суперэллипса верхней дуги: 2.6 — «круглая, но не мыльная» скула. */
export const JEWELRY_DEER_SECTION_POWER = 2.6;

/** Отношение «падение киля / вылет киля»: 1.15 — это 49° от горизонта. */
export const JEWELRY_DEER_KEEL_RATIO = 1.15;

/** Полуширина нижней грани киля, мм: грань 1.2 мм, чтобы киль не был лезвием. */
export const JEWELRY_DEER_SOLE_HALF_MM = 0.6;

/**
 * Предел, на который гребень киля опускается ниже подошвы, мм.
 *
 * Подошва — не горизонтальная площадка, а клин: от краёв `±wSole` гребень уходит
 * вниз до осевой линии. У шеи и морды, где `wSole = 0.6`, клин идёт ровно под
 * 49°: две грани, ни одной горизонтальной, и низ головы не нависает даже там, где
 * киль поднимается к затылку под 72°. Предел в 1 мм нужен груди: там подошва
 * 31 мм шириной, и клин на полную высоту (17.8 мм) пробил бы плиту насквозь.
 * Глубже миллиметра гребень не опускается, а широкий низ груди всё равно утоплен
 * в плиту, то есть в проверке нависаний не участвует.
 */
export const JEWELRY_DEER_SOLE_DROP_MM = 1;

/** Шаг промежуточных сечений по Y, мм: 1.5 мм — сглаживающая кривая без граней. */
const JEWELRY_DEER_SLICE_STEP_MM = 1.5;

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

/** Кончик уха, мм: подъём 53.6°, поэтому ухо-плавник не нависает. */
export const JEWELRY_DEER_EAR_TIP_MM = [11, -13, 88] as const;

/** Полуширина уха, мм: ухо плоское, 4.4 мм в плоскости и 3.2 мм толщиной. */
const JEWELRY_DEER_EAR_HALF_WIDTH_MM = 2.2;

/** Полутолщина уха, мм: по X, наружу от головы. */
const JEWELRY_DEER_EAR_HALF_THICKNESS_MM = 1.6;

/** Число сторон трубы уха, шт.: 10 хватает на плавник. */
const JEWELRY_DEER_EAR_SIDES = 10;

/**
 * Срез бюста: плоскость `y = const` и три кривые силуэта.
 *
 * `w` — полуширина на самом широком месте, `wSole` — полуширина нижней грани
 * киля, `zBottom` — низ киля, `zTop` — верх свода. Высота самого широкого места
 * не хранится: она следует из правила 45° — `zSide = zBottom + 1.15·(w − wSole)`.
 */
export type JewelryDeerSlice = {
  readonly yMm: number;
  readonly wMm: number;
  readonly wSoleMm: number;
  readonly zBottomMm: number;
  readonly zTopMm: number;
};

/**
 * Опорная строка таблицы срезов: срез плюс признак «не интерполировать».
 *
 * `hard` стоит на одном переходе — перед груди на шею. Ширина там падает
 * скачком, и сглаживающая кривая выдала бы промежуточное сечение с широкой
 * подошвой на высоте 11 мм, то есть горизонтальную площадку над столом. Пара
 * сечений на этом переходе выдаётся как есть, и передняя стенка груди получается
 * почти вертикальной, а подошва схлопывается на грани 51°.
 */
type JewelryDeerSliceControl = JewelryDeerSlice & {
  readonly hard?: true;
};

/**
 * Таблица бюста при базе 150 мм: 23 опорных срезов от задней кромки груди до носа.
 *
 * Записана так, как её читает скульптор: `yMm` — плоскость среза (олень смотрит
 * в −Y), `wMm` — полуширина, `wSoleMm` — полуширина нижней грани киля,
 * `zBottomMm` и `zTopMm` — нижняя и верхняя линии рисунка.
 *
 * Что где:
 * - `y = +12…−8.5` — грудь и плечи: `zBottom = 2.5` утоплен в плиту (4 мм), а
 *   `wSole` 12…17, поэтому грудь стоит на площадке, а не на лезвии;
 * - `−8.5 → −10` — перед груди: подошва схлопывается, низ поднимается с 2.5 до
 *   18, и дальше киль идёт по шее;
 * - `−10…−21` — шея: полуширина 15.5 → 10, киль поднимается 18 → 53;
 * - `−21…−24` — череп и лоб: самое широкое место головы 20 мм, свод 88;
 * - `−24…−53` — морда: 29 мм длиной, сужается с 20 до 7.2 мм по ширине и с 30 до
 *   10 мм по высоте. Сбоку это конус от щёк к носу, сверху — сужающийся клин.
 *
 * Нос на `y = −53` выходит за плиту на 3 мм: вынос морды важнее, чем совпадение
 * габарита с овалом, а свисает над столом только воздух на высоте 70 мм.
 */
const JEWELRY_DEER_SLICES: readonly JewelryDeerSliceControl[] = [
  { yMm: 12, wMm: 20, wSoleMm: 15.5, zBottomMm: 2.5, zTopMm: 30 },
  { yMm: 8, wMm: 22, wSoleMm: 17, zBottomMm: 2.5, zTopMm: 40 },
  { yMm: 4, wMm: 22, wSoleMm: 17, zBottomMm: 2.5, zTopMm: 46 },
  { yMm: 0, wMm: 21, wSoleMm: 16, zBottomMm: 2.5, zTopMm: 51 },
  { yMm: -4, wMm: 19.5, wSoleMm: 14.5, zBottomMm: 2.5, zTopMm: 56 },
  { yMm: -7, wMm: 18, wSoleMm: 13, zBottomMm: 2.5, zTopMm: 60 },
  { yMm: -8.5, wMm: 17, wSoleMm: 12, zBottomMm: 2.5, zTopMm: 61.5 },
  { yMm: -10, wMm: 15.5, wSoleMm: 0.6, zBottomMm: 18, zTopMm: 63, hard: true },
  { yMm: -12, wMm: 14, wSoleMm: 0.6, zBottomMm: 25, zTopMm: 66.5 },
  { yMm: -14, wMm: 12.5, wSoleMm: 0.6, zBottomMm: 32, zTopMm: 70 },
  { yMm: -16, wMm: 11.5, wSoleMm: 0.6, zBottomMm: 39, zTopMm: 74 },
  { yMm: -18.5, wMm: 10.5, wSoleMm: 0.6, zBottomMm: 47, zTopMm: 79 },
  { yMm: -21, wMm: 10, wSoleMm: 0.6, zBottomMm: 53, zTopMm: 84.5 },
  { yMm: -24, wMm: 10, wSoleMm: 0.6, zBottomMm: 58, zTopMm: 88 },
  { yMm: -27, wMm: 9.8, wSoleMm: 0.6, zBottomMm: 61, zTopMm: 87.5 },
  { yMm: -30.5, wMm: 9.4, wSoleMm: 0.6, zBottomMm: 63.5, zTopMm: 86.5 },
  { yMm: -34, wMm: 8.6, wSoleMm: 0.6, zBottomMm: 65.5, zTopMm: 85.5 },
  { yMm: -37.5, wMm: 7.8, wSoleMm: 0.6, zBottomMm: 67, zTopMm: 84.2 },
  { yMm: -41, wMm: 6.9, wSoleMm: 0.6, zBottomMm: 68.5, zTopMm: 83 },
  { yMm: -44.5, wMm: 6, wSoleMm: 0.6, zBottomMm: 69.5, zTopMm: 82 },
  { yMm: -48, wMm: 5.2, wSoleMm: 0.6, zBottomMm: 70, zTopMm: 81.2 },
  { yMm: -51, wMm: 4.4, wSoleMm: 0.6, zBottomMm: 70, zTopMm: 80.6 },
  { yMm: -53, wMm: 3.6, wSoleMm: 0.6, zBottomMm: 70, zTopMm: 80.2 },
];


/**
 * Касательные Фрича—Карлсона для набора опор.
 *
 * Обычная кривая Эрмита даёт выбросы: на пятке профиля высота шла 4 → 7 → 10 →
 * 40, и `z` между 7 и 10 сначала опускался до 6.8 — кольца перехлёстывались.
 * Здесь касательная на опоре не круче утроенной меньшей из соседних секущих, а
 * на перегибе равна нулю, поэтому кривая не выходит за пределы между опорами и
 * не разворачивается назад.
 */
function monotoneTangents(values: readonly number[]): number[] {
  const last = values.length - 1;
  const secants = values
    .slice(0, last)
    .map((value, index) => values[index + 1] - value);

  return values.map((_, index) => {
    if (index === 0) {
      return secants[0] ?? 0;
    }

    if (index === last) {
      return secants[last - 1] ?? 0;
    }

    const before = secants[index - 1];
    const after = secants[index];

    if (before * after <= 0) {
      return 0;
    }

    const average = (before + after) / 2;

    return (
      Math.sign(average) *
      Math.min(
        Math.abs(average),
        3 * Math.abs(before),
        3 * Math.abs(after),
      )
    );
  });
}

/** Кубическая кривая Эрмита между двумя опорами с заданными касательными, 0…1. */
function hermite(
  from: number,
  to: number,
  fromTangent: number,
  toTangent: number,
  u: number,
): number {
  const u2 = u * u;
  const u3 = u2 * u;

  return (
    (2 * u3 - 3 * u2 + 1) * from +
    (u3 - 2 * u2 + u) * fromTangent +
    (-2 * u3 + 3 * u2) * to +
    (u3 - u2) * toTangent
  );
}

/**
 * Срезы бюста: таблица, развёрнутая в гладкую последовательность плоскостей.
 *
 * Между опорами `w`, `wSole`, `zBottom` и `zTop` идут по одной кривой Эрмита с
 * касательными Фрича—Карлсона: кривая проходит через опоры точно и не выходит за
 * них, поэтому силуэт без изломов, но и без выбросов. Шаг 1.5 мм по Y: больше —
 * видно грани на морде, меньше — растёт число треугольников без пользы.
 *
 * Переход с `hard` выдаётся парой сечений без промежуточных: сглаживать там
 * нечего, ширина падает скачком, а интерполяция дала бы подошву на высоте 11 мм.
 */
function deerSlices(): JewelryDeerSlice[] {
  const slices = JEWELRY_DEER_SLICES;
  const last = slices.length - 1;
  const wTangents = monotoneTangents(slices.map((slice) => slice.wMm));
  const soleTangents = monotoneTangents(slices.map((slice) => slice.wSoleMm));
  const bottomTangents = monotoneTangents(slices.map((slice) => slice.zBottomMm));
  const topTangents = monotoneTangents(slices.map((slice) => slice.zTopMm));
  const result: JewelryDeerSlice[] = [];

  for (let index = 0; index < last; index += 1) {
    const from = slices[index];
    const to = slices[index + 1];
    const segmentMm = Math.abs(to.yMm - from.yMm);
    const samples = to.hard
      ? 1
      : Math.max(1, Math.ceil(segmentMm / JEWELRY_DEER_SLICE_STEP_MM));

    for (let step = 0; step < samples; step += 1) {
      const u = step / samples;

      result.push({
        yMm: from.yMm + (to.yMm - from.yMm) * u,
        wMm: hermite(from.wMm, to.wMm, wTangents[index], wTangents[index + 1], u),
        wSoleMm: hermite(
          from.wSoleMm,
          to.wSoleMm,
          soleTangents[index],
          soleTangents[index + 1],
          u,
        ),
        zBottomMm: hermite(
          from.zBottomMm,
          to.zBottomMm,
          bottomTangents[index],
          bottomTangents[index + 1],
          u,
        ),
        zTopMm: hermite(
          from.zTopMm,
          to.zTopMm,
          topTangents[index],
          topTangents[index + 1],
          u,
        ),
      });
    }
  }

  const nose = slices[last];

  result.push({
    yMm: nose.yMm,
    wMm: nose.wMm,
    wSoleMm: nose.wSoleMm,
    zBottomMm: nose.zBottomMm,
    zTopMm: nose.zTopMm,
  });

  return result;
}

/** Высота среза, на которой он шире всего: киль начинается ровно здесь. */
export function deerSliceSideMm(slice: JewelryDeerSlice): number {
  return slice.zBottomMm + JEWELRY_DEER_KEEL_RATIO * (slice.wMm - slice.wSoleMm);
}

/**
 * Контур среза в плоскости (X, Z): гребень киля, две грани и суперэллипс сверху.
 *
 * Обход против часовой стрелки, если смотреть с носа (−Y), и начинается с правой
 * нижней вершины: правый бок вверх, дуга через свод влево, левый бок вниз, левая
 * грань киля к гребню на оси и правая грань обратно в начало. Такой порядок даёт
 * наружные нормали у стенок между срезами — на нём держится знак объёма и
 * watertight.
 *
 * Верх — суперэллипс с показателем 2.6: у круга скула «мыльная», у эллипса
 * слишком плоский верх, а 2.6 даёт круглый, но собранный свод. Ниже самой
 * широкой точки идут две грани `zSide − zBottom = 1.15·(w − wSole)`, то есть 49°
 * от горизонта, а под ними — клин до гребня на осевой линии. Ни одной
 * горизонтальной грани внизу нет: именно поэтому низ головы печатается без
 * поддержек там, где киль поднимается к затылку.
 */
export function deerSectionOutline(
  slice: JewelryDeerSlice,
): readonly Point2[] {
  const sideZ = deerSliceSideMm(slice);
  const rise = slice.zTopMm - sideZ;
  const drop = Math.min(
    JEWELRY_DEER_KEEL_RATIO * slice.wSoleMm,
    JEWELRY_DEER_SOLE_DROP_MM,
  );
  const points: Point2[] = [[slice.wSoleMm, slice.zBottomMm]];

  points.push([slice.wMm, sideZ]);

  for (let step = 1; step < JEWELRY_DEER_SECTION_ARCS; step += 1) {
    const angle = (Math.PI * step) / JEWELRY_DEER_SECTION_ARCS;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const exponent = 2 / JEWELRY_DEER_SECTION_POWER;
    const x = slice.wMm * Math.sign(Math.cos(angle)) * cos ** exponent;
    const z = sideZ + rise * sin ** exponent;

    points.push([x, z]);
  }

  points.push(
    [-slice.wMm, sideZ],
    [-slice.wSoleMm, slice.zBottomMm],
    [0, slice.zBottomMm - drop],
  );

  return points;
}

/**
 * Площадь среза, мм²: площадь трапеции киля плюс площадь верхней дуги.
 *
 * Нужна не для меша, а для проверок: по ней считается центр тяжести (и запас
 * против опрокидывания) и то, что голова не тяжелее груди. Считается по тому же
 * контуру, который уходит в сетку, — расхождения с мешем не будет.
 */
export function deerSectionAreaMm2(slice: JewelryDeerSlice): number {
  const outline = deerSectionOutline(slice);
  let twiceArea = 0;

  for (let index = 0; index < outline.length; index += 1) {
    const [x0, z0] = outline[index];
    const [x1, z1] = outline[(index + 1) % outline.length];

    twiceArea += x0 * z1 - x1 * z0;
  }

  return Math.abs(twiceArea) / 2;
}


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
  /** Срезы от задней кромки груди до носа: `y` убывает. */
  readonly slices: readonly JewelryDeerSlice[];
  /** Нос: плоскость последнего среза и его габарит по высоте. */
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
 * План оленя: срезы, рога, уши, полость и габарит.
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

  // Таблица записана для базы 150 мм; ползунок длины тянет за собой весь бюст,
  // включая низ киля: при базе 120 он на 3.2 мм, при 180 — на 4.8, и в обоих
  // случаях остаётся ниже лица плиты (4 мм), то есть утопление сохраняется.
  const slices = deerSlices().map((slice) => ({
    yMm: slice.yMm * scale,
    wMm: slice.wMm * scale,
    wSoleMm: slice.wSoleMm * scale,
    zBottomMm: slice.zBottomMm * scale,
    zTopMm: slice.zTopMm * scale,
  }));
  const nose = slices[slices.length - 1];
  const crownZMm = Math.max(...slices.map((slice) => slice.zTopMm));

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

  // Верх модели — нос или рога, что выше. Нос закрыт плоской гранью в плоскости
  // последнего среза, поэтому припуска на скругление у него нет.
  const noseTopMm = nose.zTopMm;
  const heightMm = Math.round(Math.max(noseTopMm, antlerTopMm) * 100) / 100;

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
    slices,
    noseYMm: nose.yMm,
    noseZMm: nose.zTopMm - nose.zBottomMm,
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
 * Бюст: стопка вертикальных срезов от задней кромки груди до носа.
 *
 * Каждый срез — плоский контур в плоскости `y = const`; между соседними срезами
 * ставятся стенки, торцы закрываются веерами. Задняя крышка смотрит назад
 * (плоский срез бюста, как у классического портрета), носовая — вперёд.
 *
 * Низ у груди лежит на плите на `z = 2.5`, то есть утоплен в неё на 1.5 мм:
 * бюст и база — два отдельных замкнутых тела, их объединяет слайсер. Всё, что
 * ниже двух с половиной миллиметров, — это плита, а не голова, поэтому силуэт
 * снизу не нависает: от самой широкой точки среза вниз идут грани киля под 49°.
 */
function addDeerSlices(positions: number[], plan: JewelryDeerPlan): void {
  const rings = plan.slices.map((slice) =>
    deerSectionOutline(slice).map(
      ([x, z]) => [x, slice.yMm, z] as Vec3,
    ),
  );

  // Задний торец: нормаль в +Y, то есть против хода от носа к затылку.
  addRingFan(positions, ringCenter(plan.slices[0]), rings[0], false);

  for (let index = 0; index < rings.length - 1; index += 1) {
    addRingWalls(positions, rings[index], rings[index + 1]);
  }

  const last = rings.length - 1;

  addRingFan(positions, ringCenter(plan.slices[last]), rings[last], true);
}

/** Центр торца среза: середина между низом киля и сводом, на оси X = 0. */
function ringCenter(slice: JewelryDeerSlice): Vec3 {
  return [0, slice.yMm, (slice.zBottomMm + slice.zTopMm) / 2];
}

/**
 * Ухо: плоский плавник за рогом.
 *
 * Ухо — не лопатка и не шар: сечение узкое (4.4 × 3.2 мм), а ось поднята на
 * 53.6°. Поэтому самая пологая грань уха наклонена к столу на 53.6°, а не на
 * 20–30°, как у горизонтальной лопатки: печатается без поддержки и не спорит со
 * стволом рога, который проходит в 6 мм позади.
 *
 * Плоскость уха держится по Y: сбоку виден широкий силуэт, спереди — тонкая
 * полоска. Так ухо читается на витрине, где модель смотрят сбоку.
 */
function addDeerEar(positions: number[], ear: JewelryDeerEar): void {
  const sides = JEWELRY_DEER_EAR_SIDES;
  const axis = normalize(subtract(ear.tipMm, ear.rootMm));
  const lengthMm = magnitude(subtract(ear.tipMm, ear.rootMm));
  // `thin` смотрит наружу по X, `wide` — по Y: базис правый, обход кольца даёт
  // наружные нормали стенок.
  const thin = normalize(subtract([1, 0, 0], multiply(axis, dot([1, 0, 0], axis))));
  const wide = cross(axis, thin);
  const shares = [0, 0.3, 0.6, 0.82, 1] as const;
  const rings = shares.map((share) => {
    // К кончику ухо сужается: остриё плавника, а не обрубок трубы.
    const taper = 1 - 0.45 * share;
    const center = add(ear.rootMm, multiply(axis, lengthMm * share));
    const ring: Vec3[] = [];

    for (let step = 0; step < sides; step += 1) {
      const angle = (Math.PI * 2 * step) / sides;

      ring.push(
        add(
          center,
          add(
            multiply(thin, Math.cos(angle) * ear.halfThicknessMm * taper),
            multiply(wide, Math.sin(angle) * ear.halfWidthMm * taper),
          ),
        ),
      );
    }

    return ring;
  });

  // Корень утоплен в череп: торец наружу не смотрит.
  addRingFan(positions, ear.rootMm, rings[0], false);

  for (let index = 0; index < rings.length - 1; index += 1) {
    addRingWalls(positions, rings[index], rings[index + 1]);
  }

  const last = rings.length - 1;
  const tipCenter = add(ear.rootMm, multiply(axis, lengthMm));

  addDomeCap(
    positions,
    tipCenter,
    axis,
    rings[last],
    Math.min(ear.halfWidthMm, ear.halfThicknessMm) * 0.55,
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
 * в −Y. Все тела замкнуты по отдельности и пересекаются — слайсер объединит их
 * при печати.
 */
export function createJewelryDeerGeometry(
  params: Partial<JewelryStandParams> = {},
): BufferGeometry {
  const plan = jewelryDeerPlan(params);
  const positions: number[] = [];

  addDeerBase(positions, plan);
  addDeerSlices(positions, plan);

  for (const path of plan.antlers) {
    addAntlerTube(positions, path);
  }

  for (const ear of plan.ears) {
    addDeerEar(positions, ear);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

