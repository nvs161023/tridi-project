/**
 * Геометрия листа-лотка «Фигуристые листья».
 *
 * Лист — не тело вращения и не набор пересекающихся призм, а поле высот:
 * плоское дно лежит на столе, лицо повторяет рельеф. Такая схема печатается
 * без поддержек по построению — каждый следующий слой меньше предыдущего, ведь
 * всё, что есть на лице, растёт кверху от плоского дна. Крючок — единственный
 * наклонный элемент: его ось отклонена от вертикали на 39°, а нижний срез
 * утоплен в плиту, поэтому поддержки не нужны и ему.
 *
 * Сетка параметрическая: строка `i` — сечение вдоль длины, столбец `j` —
 * поперёк. Верх и низ строятся по одним и тем же `(x, y)`, поэтому боковая
 * стенка сшивается с обеими поверхностями по индексам, а не поиском границы.
 * Контур задан полушириной `w(t)`, а не маской ячеек: край получается гладким
 * при любом шаге сетки.
 *
 * Лицо — сумма четырёх слагаемых (`leafFaceMm`), все гладкие (smoothstep):
 *
 * 1. ложе — впадина на каждой половине пластины: ноль на жилке и у кромки,
 *    максимум посередине. Так лист читается чашей, а не плоской плитой;
 * 2. центральная жилка — выпуклое ребро по оси, самое высокое на листе;
 * 3. боковые жилки — тонкие рёбра-лучи от оси к краю, наклонённые к кончику;
 * 4. бортик — валик по кромке: подъём, верхушка и скруглённый край.
 *
 * Ложе снимает материал вниз, рёбра и бортик поднимаются вверх. Плита толще
 * самого глубокого места ложа ровно на минимальную толщину, поэтому лист не
 * просвечивает на любом ползунке, а рёбра не выходят за высоту бортика.
 */

import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  normalizeJewelryStandParams,
  type JewelryLeafType,
  type JewelryStandParams,
} from "@/lib/constructor/params";
import { applyCreasedNormals } from "@/lib/constructor/mesh-normals";

/**
 * Толщина плиты в самой тонкой точке — на дне ложа, мм.
 *
 * 1.2 мм — шесть слоёв по 0.2: лист не просвечивает и не рвётся даже там, где
 * ложе снимает материал глубже всего.
 */
export const JEWELRY_LEAF_MIN_THICKNESS_MM = 1.2;

/**
 * Глубина ложа на каждой половине пластины, мм: лист читается чашей.
 *
 * Плита 2.5 мм = ложе 1.3 + минимальная толщина 1.2. По ТЗ лист — изящная
 * пластина 2.5 мм: на плитах 4 и 3 мм лист 150 × 100 весил 53.9 и 46.8 г, а на
 * 2.5 мм с тонким бортиком и тонкими жилками — около 20 г.
 */
export const JEWELRY_LEAF_BOWL_DEPTH_MM = 1.3;

/** Ширина ободка по краю, где ложе и рёбра затухают до нуля, мм. */
export const JEWELRY_LEAF_EDGE_BAND_MM = 3.5;

/**
 * Полуширина центральной жилки, мм: 1.5 мм по ТЗ — ребро, а не вал.
 *
 * Прежняя жилка шириной 4.8 мм при подъёме 2 мм читалась гребнем и забирала
 * пластик: на тонкой плите 2.5 мм такое ребро выглядит грубо.
 */
export const JEWELRY_LEAF_CENTER_VEIN_HALF_MM = 0.75;

/** Полуширина боковой жилки, мм: тоже 1.5 мм — жилки одной толщины по ТЗ. */
export const JEWELRY_LEAF_SIDE_VEIN_HALF_MM = 0.75;

/** Предел подъёма жилки над ложем, мм: 1.5 мм по ТЗ. */
export const JEWELRY_LEAF_VEIN_HEIGHT_MM = 1.5;

/**
 * Доля подъёма жилки от ползунка: 0.75 при ползунке 2 мм даёт ровно 1.5 мм.
 *
 * Ползунок «высота прожилок» остаётся рабочим: 1 мм даёт 0.75 мм, 3 мм — 1.5 мм
 * (предел ТЗ), выше ребро на плите 2.5 мм уже спорит с бортиком.
 */
const JEWELRY_LEAF_VEIN_RISE_SHARE = 0.75;

/** Пар боковых жилок: пять пар дают шесть полос-лож между ними. */
export const JEWELRY_LEAF_SIDE_VEIN_PAIRS = 5;

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

/**
 * Плотность сетки: шаг ячейки равен `√(длина · ширина / этого числа)`.
 *
 * Число названо делителем, а не площадью: чем оно больше, тем мельче сетка.
 * 16 000 при листе 150 × 100 дают шаг 0.97 мм — на полосу бортика 2 мм
 * приходится два узла, и валик читается, а не рассыпается на зубцы.
 */
const JEWELRY_LEAF_CELL_MM2 = 16000;

/** Границы шага сетки, мм: мельче 0.9 мм листу не нужно, крупнее 1.8 грубо. */
const JEWELRY_LEAF_STEP_MIN_MM = 0.9;
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
 * Высота бортика-валика по краю, мм: 5 мм по ТЗ.
 *
 * Бортик выше плиты вдвое, но он узкий: 2 мм полосы на плите 2.5 мм дают
 * кромку-воротник, а не стенку. Валик держит цепочку на листе и не даёт
 * пластине играть.
 */
export const JEWELRY_LEAF_RIM_MM = 5;

/**
 * Ширина бортика по полуширине листа, мм: 2 мм по ТЗ.
 *
 * Полоса отсчитывается от кромки внутрь и переводится в долю полуширины в
 * каждой точке: на широкой части это те же 2 мм, у черешка полоса уже.
 */
export const JEWELRY_LEAF_RIM_BAND_MM = 2;

/** Доля полосы бортика, где он выходит на полную высоту. */
const JEWELRY_LEAF_RIM_CREST_SHARE = 0.78;

/** Насколько кромка ниже верхушки бортика: сверху выходит валик, а не стенка. */
const JEWELRY_LEAF_RIM_CROWN_SHARE = 0.22;

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

/** Ребро листа: полуширина и подъём над ложем, мм. */
type JewelryLeafRib = {
  readonly halfMm: number;
  readonly riseMm: number;
};

/** План листа: всё, что считается один раз на генерацию. */
type JewelryLeafPlan = {
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly plateMm: number;
  readonly rimMm: number;
  readonly centerRib: JewelryLeafRib;
  readonly sideRib: JewelryLeafRib;
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
 * Толщина плиты под самым глубоким местом ложа.
 *
 * Ложе снимает `bowlDepth`, а плита выше этой глубины ровно на минимальную
 * толщину, поэтому лист не просвечивает и не рвётся при печати на любом
 * ползунке. Рёбра растут вверх, поэтому на толщину не влияют.
 */
export function jewelryLeafPlateThicknessMm(): number {
  return JEWELRY_LEAF_BOWL_DEPTH_MM + JEWELRY_LEAF_MIN_THICKNESS_MM;
}

/**
 * Рёбра по ползунку прожилок.
 *
 * Жилки одинаковой толщины — 1.5 мм по ТЗ — и центральная, и боковые: на плите
 * 2.5 мм широкое ребро читается валом и спорит с бортиком. Ползунок задаёт
 * подъём, а не ширину: 1 мм даёт 0.75 мм, 3 мм упирается в предел 1.5 мм.
 */
function leafRibsMm(veinDepthMm: number): {
  center: JewelryLeafRib;
  side: JewelryLeafRib;
} {
  const riseMm = clamp(
    veinDepthMm * JEWELRY_LEAF_VEIN_RISE_SHARE,
    JEWELRY_LEAF_VEIN_HEIGHT_MM * 0.4,
    JEWELRY_LEAF_VEIN_HEIGHT_MM,
  );

  return {
    center: { halfMm: JEWELRY_LEAF_CENTER_VEIN_HALF_MM, riseMm },
    side: { halfMm: JEWELRY_LEAF_SIDE_VEIN_HALF_MM, riseMm },
  };
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
  const ribs = leafRibsMm(params.jewelryLeafVeinDepth);
  const stepMm = clamp(
    Math.sqrt((lengthMm * widthMm) / JEWELRY_LEAF_CELL_MM2),
    JEWELRY_LEAF_STEP_MIN_MM,
    JEWELRY_LEAF_STEP_MAX_MM,
  );

  return {
    lengthMm,
    widthMm,
    plateMm: jewelryLeafPlateThicknessMm(),
    rimMm: JEWELRY_LEAF_RIM_MM,
    centerRib: ribs.center,
    sideRib: ribs.side,
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
 * Где начинается полоса бортика по полуширине в точке `t`.
 *
 * Полоса задана в миллиметрах от кромки, а профиль рельефа считается в долях
 * полуширины, поэтому 2 мм переводятся в долю заново в каждой точке: у черешка,
 * где лопасть узкая, бортик не расползается на пол-листа.
 */
function rimBandStart(plan: JewelryLeafPlan, t: number): number {
  const halfMm = Math.max(leafHalfWidth(plan, t), 1e-6);

  return clamp(1 - JEWELRY_LEAF_RIM_BAND_MM / halfMm, 0, 1);
}

/**
 * Профиль бортика внутри его полосы: подъём, верхушка и скруглённая кромка.
 *
 * `share` — положение внутри полосы: 0 у её начала, 1 у самой кромки. Верхушка
 * стоит на `CREST_SHARE` полосы, а у кромки лицо опускается на `CROWN_SHARE`
 * высоты: снаружи выходит валик, а не стенка с плоским верхом. Опускание идёт
 * внутрь листа, поэтому нависаний не добавляет.
 */
function rimProfile(share: number): number {
  const a = clamp(share, 0, 1);

  return (
    smoothstep(0, JEWELRY_LEAF_RIM_CREST_SHARE, a) -
    JEWELRY_LEAF_RIM_CROWN_SHARE * smoothstep(JEWELRY_LEAF_RIM_CREST_SHARE, 1, a)
  );
}

/** Положение точки внутри полосы бортика: 0 внутри листа, 1 на кромке. */
function rimShare(plan: JewelryLeafPlan, frame: JewelryLeafFrame): number {
  const start = rimBandStart(plan, frame.t);

  return (Math.abs(frame.s) - start) / Math.max(1 - start, 1e-6);
}

/** Опорные величины в точке листа: положение вдоль и поперёк, затухание у кромки. */
type JewelryLeafFrame = {
  readonly t: number;
  readonly s: number;
  /** 1 внутри пластины, 0 у самой кромки: рельеф не срезает край в волос. */
  readonly edgeFade: number;
};

function leafFrame(
  plan: JewelryLeafPlan,
  xMm: number,
  yMm: number,
): JewelryLeafFrame {
  const halfLength = plan.lengthMm / 2;
  const t = clamp((xMm + halfLength) / plan.lengthMm, 0, 1);
  const halfWidthMm = leafHalfWidth(plan, t);
  const edge = halfWidthMm - Math.abs(yMm);

  return {
    t,
    s: clamp(yMm / Math.max(halfWidthMm, 1e-6), -1, 1),
    edgeFade: smoothstep(0, JEWELRY_LEAF_EDGE_BAND_MM, edge),
  };
}

/**
 * Ложе: впадина на каждой половине пластины, мм вниз от лица плиты.
 *
 * `16·s²·(1 − |s|)²` — единичный импульс с максимумом на середине половины:
 * ноль на жилке и на кромке, производная на концах нулевая, поэтому ложе
 * переходит в ребро и в бортик без изломов. Так лист читается чашей с двумя
 * ложами, между которыми проходит ребро центральной жилки.
 */
function leafDishMm(frame: JewelryLeafFrame): number {
  if (frame.edgeFade <= 0) {
    return 0;
  }

  // Ложе не доходит до черешка и кончика: там пластина узкая.
  const along = smoothstep(0.06, 0.2, frame.t) * (1 - smoothstep(0.82, 0.97, frame.t));
  const absoluteS = Math.abs(frame.s);

  return (
    JEWELRY_LEAF_BOWL_DEPTH_MM *
    16 *
    absoluteS *
    absoluteS *
    (1 - absoluteS) *
    (1 - absoluteS) *
    along *
    frame.edgeFade
  );
}

/** Подъём рёбер — центральной жилки и пяти пар боковых, мм над ложем. */
function leafRibRiseMm(
  plan: JewelryLeafPlan,
  xMm: number,
  yMm: number,
  frame: JewelryLeafFrame,
): number {
  if (frame.edgeFade <= 0) {
    return 0;
  }

  const along = smoothstep(0.06, 0.2, frame.t) * (1 - smoothstep(0.82, 0.96, frame.t));
  const halfLength = plan.lengthMm / 2;
  let rise = plan.centerRib.riseMm * pulse(plan.centerRib.halfMm, yMm);

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
      const lateral =
        plan.sideRib.riseMm * pulse(plan.sideRib.halfMm, distance);

      // Рёбра не суммируются: на пересечении с центральной жилкой сумма дала бы
      // бугор выше ползунка и «зализанный» бок.
      rise = Math.max(rise, lateral);
    }
  }

  // На валике бортика рёбра не поднимаются: жилка вливается в кромку, а не
  // ложится поверх неё бугром.
  return rise * along * frame.edgeFade * (1 - rimProfile(rimShare(plan, frame)));
}

/** Подъём бортика-валика у кромки, мм. */
function leafRimRiseMm(plan: JewelryLeafPlan, frame: JewelryLeafFrame): number {
  // Бортик не выходит на черешок и гаснет у кончика: там пластина уже 2 мм, и
  // высокий валик превратился бы в тонкий плавник.
  const along =
    smoothstep(0.04, 0.2, frame.t) * (1 - smoothstep(0.78, 0.96, frame.t));

  return plan.rimMm * rimProfile(rimShare(plan, frame)) * along;
}

/**
 * Лицо листа в точке по готовому плану: высота над столом, мм.
 *
 * План передаётся снаружи: на сетке 9 тысяч вершин повторять подбор амплитуды
 * и нормализацию параметров нельзя — это превратило бы предпросмотр в
 * многосекундную паузу. Эту же функцию вызывает генератор меша, поэтому тест
 * и модель считают одно и то же поле.
 */
function leafFaceMm(plan: JewelryLeafPlan, xMm: number, yMm: number): number {
  const frame = leafFrame(plan, xMm, yMm);

  return (
    plan.plateMm -
    leafDishMm(frame) +
    leafRibRiseMm(plan, xMm, yMm, frame) +
    leafRimRiseMm(plan, frame)
  );
}

/**
 * Глубина ложа в точке для тестов, мм вниз от лица плиты.
 *
 * Проверка минимальной толщины обращается к той же функции, что и генератор,
 * поэтому тест не повторяет формулы и не подтверждает сам себя.
 */
export function jewelryLeafReliefMm(
  params: Partial<JewelryStandParams>,
  xMm: number,
  yMm: number,
): number {
  const plan = leafPlan(normalizeJewelryStandParams(params));

  return leafDishMm(leafFrame(plan, xMm, yMm));
}

/** Лицо листа в точке для тестов и подсказок панели, мм над столом. */
export function jewelryLeafFaceMm(
  params: Partial<JewelryStandParams>,
  xMm: number,
  yMm: number,
): number {
  return leafFaceMm(leafPlan(normalizeJewelryStandParams(params)), xMm, yMm);
}

/**
 * Высота крючка над столом, мм.
 *
 * Начало наклонной части спрятано в плите на `HOOK_JOIN`, дальше идут подъём и
 * вертикальный штырь. Метрика нужна предпросмотру: он пишет габарит, не
 * собирая меш. Плита берётся из плана, поэтому метрика живёт на тех же
 * ползунках, что и геометрия.
 */
export function jewelryLeafHeightMm(
  params: Partial<JewelryStandParams>,
): number {
  const plate = leafPlan(normalizeJewelryStandParams(params)).plateMm;

  return Math.max(
    plate + JEWELRY_LEAF_RIM_MM,
    plate -
      JEWELRY_LEAF_HOOK_JOIN_MM +
      JEWELRY_LEAF_HOOK_RISE_MM +
      JEWELRY_LEAF_HOOK_STUB_MM,
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
      const y = (-1 + (2 * row) / plan.rows) * halfWidth;

      topRow.push(pushVertex(x, y, leafFaceMm(plan, x, y)));
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

  // Ложе и бортик набраны шагом до 1.8 мм: при плоских нормалях на поверхности
  // были видны полосы сетки. Порог 35° сглаживает ложе и скругляет бортик, а
  // жилки (63° к плоскости листа) остаются рёбрами.
  const smoothed = applyCreasedNormals(geometry);

  smoothed.computeBoundingBox();

  return smoothed;
}


