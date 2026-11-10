/**
 * Светотехнический расчёт литофана: где стоит лампа, как свет ложится на панель и
 * что из этого следует для печати.
 *
 * Литофан читается только на свету, но панель — не лампа: точечный источник за
 * плитой даёт пятно. Низ кадра горит, верх уходит в темноту, и фото читается на
 * треть высоты. Поэтому расчёт считает освещённость в каждой точке панели и
 * сравнивает её со средней: по этой карте видно, где пересвет, а где провал.
 *
 * Модель честная по физике и упрощённая по геометрии:
 *   - свет — набор точечных источников с силой света в канделах. Лента не точка:
 *     она раскладывается на `stripEmitters` равных отрезков по каналу, а колба,
 *     патрон и свеча остаются одной точкой в своём центре;
 *   - освещённость точки — сумма по источникам `I · cosθ · diagram / r²` в
 *     люксах: расстояние в метрах, `cosθ` — наклон луча к нормали панели,
 *     `diagram` — диаграмма излучения (лента светит вверх по косинусу, колба,
 *     патрон и свеча — во все стороны);
 *   - панель — та же поверхность, что печатается: плоская плита с наклоном 12°,
 *     цилиндр радиуса изгиба или четыре грани призмы. Точка на цилиндре считается
 *     по той же формуле, что `cylinderPoint` в `lithophane-geometry.ts`, поэтому
 *     карта света ложится ровно на рельеф, а не на плоскость рядом с ним.
 *
 * Что модуль отдаёт наружу:
 *   - `lithophaneLightPlan` — источники, поверхность, карта освещённости,
 *     рекомендации и предупреждения для текущих параметров;
 *   - `lithophaneLightMetrics` — то же без привязки к параметрам: считает метрики
 *     по готовым граням и источникам (по ней расчёт проверяется в
 *     `check:lithophane`);
 *   - `lithophaneFacePoint` и `lithophaneFaceNormal` — точки поверхности для
 *     наложения карты света в предпросмотре;
 *   - `lithophaneHeatColor` — цвет точки карты по отношению к средней
 *     освещённости.
 */
import {
  BODY_OVERLAP_MM,
  LITHOPHANE_ARCH_STAND,
  LITHOPHANE_ARCH_STRIP,
  LITHOPHANE_BENT_BASE,
  LITHOPHANE_BENT_BASE_FLOOR_MM,
  LITHOPHANE_CYLINDER_FLOOR_MM,
  LITHOPHANE_FIT_GAP_MM,
  LITHOPHANE_FRAME_SEAT_MM,
  LITHOPHANE_KALEIDOSCOPE,
  LITHOPHANE_LAMP_CLAMP,
  LITHOPHANE_STAND_SHAPES,
  LITHOPHANE_STAND_TILT_DEG,
  LITHOPHANE_WALL_BOX,
  lithophaneClampBulb,
  lithophanePlateSize,
} from "@/lib/constructor/lithophane-geometry";
import {
  lithophaneHasStand,
  normalizeLithophaneParams,
  type LithophaneMount,
  type LithophaneParams,
  type LithophaneShape,
} from "@/lib/constructor/params";

/** Точка или вектор в системе сборки, мм: X поперёк, Y от стола, Z от тыла рамки. */
type Vec3 = readonly [number, number, number];

/**
 * Источник света в системе сборки.
 *
 * `position` — центр светящейся части. `axis` — куда светит источник, `lobe` —
 * показатель диаграммы: 1 у ленты (яркость падает по косинусу от оси), 0 у
 * колбы, патрона и свечи (светят во все стороны). `intensity` — сила света в
 * канделах; у ленты это доля её потока на один отрезок.
 */
export type LithoLightEmitter = {
  position: Vec3;
  axis: Vec3;
  lobe: number;
  intensity: number;
};

/**
 * Грань панели — поверхность, на которую ложится карта света.
 *
 * `origin` — центр нижней кромки тыла плиты: от него отсчитываются `right` и
 * `up`. У плоской панели это же место стоит на наклонной базе, у призмы — на
 * повёрнутой грани. `bend` описывает цилиндр развёртки: `radius` — радиус
 * изгиба, `backOffset` — насколько тыл плиты отстоит от плоскости развёртки
 * (у плоской панели его нет).
 */
export type LithoLightFace = {
  origin: Vec3;
  right: Vec3;
  up: Vec3;
  normal: Vec3;
  /** Ширина и высота плиты, мм. */
  width: number;
  height: number;
  bend: { radius: number; backOffset: number } | null;
};

/** Источник, под который в базе вырезано крепление. */
export type LithoLightKind = "strip" | "usb_bulb" | "socket" | "candle";

/** Подписи источников для панели конструктора. */
export const LITHO_LIGHT_KIND_LABELS = {
  strip: "Светодиодная лента",
  usb_bulb: "USB-лампа",
  socket: "Лампа E27 в патроне",
  candle: "Свеча",
} as const satisfies Record<LithoLightKind, string>;

/**
 * Предупреждение светотехнического расчёта.
 *
 * `error` — красное: так печатать нельзя, кадр будет пятном. `warning` — жёлтое:
 * свет ложится неровно, но фото читается.
 */
export type LithoLightWarning = {
  id: "too_close" | "dark_top" | "uneven_faces" | "diffuser";
  severity: "error" | "warning";
  /** Заголовок в одну строку: его читают в блоке расчёта. */
  title: string;
  /** Пояснение с числами: что сделать, чтобы стало ровно. */
  hint: string;
};

/**
 * Готовая карта света и выводы по ней.
 *
 * `maps` — освещённость в люксах по граням: `maps[face][row * columns + column]`,
 * строка 0 — низ панели. Предпросмотр нормирует её на `average`, поэтому карта
 * показывает не яркость лампы, а ровность: зелёный — рабочая зона, красный —
 * пересвет, синий — провал.
 */
export type LithoLightPlan = {
  kind: LithoLightKind;
  shape: LithophaneShape;
  emitters: LithoLightEmitter[];
  faces: LithoLightFace[];
  /**
   * Место листа-рассеивателя, если он включён и его паз напечатан: по нему карта
   * света размывается. `null` — листа нет, карта прямая.
   */
  diffuser: LithoLightDiffuser | null;
  /** Есть ли у этой сборки паз под лист: от него зависит переключатель в панели. */
  diffuserSupported: boolean;
  columns: number;
  rows: number;
  maps: number[][];
  /** Средняя, пиковая и наименьшая освещённость панели, люксы. */
  average: number;
  peak: number;
  floor: number;
  /** Пик к средней: 1 — ровное пятно, 3 — точка пересвета. */
  peakRatio: number;
  /** Яркость верхней полосы к нижней, доли: 1 — ровно, 0.2 — верх тёмный. */
  topShare: number;
  /** Разброс средних по граням призмы, доли. */
  faceSpread: number;
  /** Фактическое расстояние от лампы до панели, мм. */
  actualDistance: number;
  /** Рекомендованное расстояние от лампы до панели, мм. */
  recommendedDistance: number;
  /** Рекомендованная высота лампы над столом, мм. */
  recommendedHeight: number;
  warnings: LithoLightWarning[];
};

/**
 * Числа модели: сетка, допуски и сила света источников.
 *
 * Канделы номинальные — паспортных данных у ленты и лампы нет. Сравнивать их с
 * чем-то абсолютным и не нужно: расчёт отвечает на вопросы «во сколько раз низ
 * ярче верха» и «во сколько раз пик больше среднего». Панель 120 × 80 с лентой в
 * канале получает около 1300 лк у нижней кромки и единицы люкс у верхней; для
 * чтения фото хватает 800–1500 лк, поэтому такой перепад и виден глазом.
 */
export const LITHO_LIGHT_MODEL = {
  /** Сетка карты на грань: шаг около 5 мм на панели 60–200 мм. */
  columns: 13,
  rows: 17,
  /** Полоса низа и верха для сравнения — доля высоты панели. */
  edgeBand: 0.2,
  /** Предельный угол падения на панель, градусы: дальше свет ложится косо. */
  maxIncidenceDeg: 45,
  /** Допустимый перепад низа и верха, доли: 20 % — фото читается по всей высоте. */
  maxVerticalFalloff: 0.2,
  /** Пик к средней, после которого кадр считается пересвеченным. */
  overexposure: 2.5,
  /** Верх к низу, ниже которого верх читается тёмным. */
  darkTop: 0.4,
  /** Разброс средних по граням призмы, доли. */
  faceSpread: 0.25,
  /** Сколько точек раскладывается по каналу ленты. */
  stripEmitters: 13,
  /**
   * Рассеиватель: конус рассеяния, пропускание и высота листа.
   *
   * Лист опалового акрила 2 мм рассеивает свет вперёд конусом с полушириной
   * `diffuserSpreadDeg`: точка листа светит на панель пятном радиуса
   * `gap · tan(spread)`, где `gap` — расстояние от листа до тыла панели. Паз базы
   * арки стоит на 19.4 мм, отсюда радиус размытия σ ≈ 23 мм — свет уходит из пятна
   * лампы в кольцо вокруг, и пик падает с 2.2 до 1.7 средних.
   *
   * Пропускание 0.85 — потери на отражение и поглощение в 2 мм опала. Высота 70
   * мм: выше лист упёрся бы в тыл наклонной панели, которая уходит назад на 12°,
   * поэтому верх кадра освещён прямым светом мимо листа — так и считает
   * `diffuserShare`.
   */
  diffuserSpreadDeg: 50,
  diffuserTransmission: 0.85,
  diffuserSheetHeight: 70,
  /** Мягкий край листа в расчёте: переход от листа к прямому свету, мм. */
  diffuserEdge: 10,
  /**
   * Ширина панели, с которой расчёт советует лист, мм.
   *
   * До 150 мм пятно лампы ещё укладывается в кадр: пик не выше двух средних.
   * Дальше панель шире диаграммы, и без листа центр пересвечен при ровных краях.
   */
  diffuserPanelWidth: 150,
  /**
   * Высота светящейся части ленты над полом канала, мм.
   *
   * Пол канала — верх задней полки рамки. Лента с платой 1 мм лежит на нём и
   * светит на тыл плиты, а не в полку.
   */
  stripLift: 1,
  /**
   * Сила света источников, канделы.
   *
   * Лента 700 лм/м на канале 98 мм — около 1.7 кд на точку. USB-лампа 30 лм в
   * шар — 2.4 кд. Патрон E27 с лампой 6 Вт (470 лм) против панели — 30 кд, но
   * абажур возвращает на кадр только вырез 120°, остальное уходит вверх и в
   * стороны. Свеча — 1.2 кд, как у чайной.
   */
  candelas: {
    strip: 1.7,
    usbBulb: 2.4,
    socket: 30,
    candle: 1.2,
  },
} as const;

/**
 * Где стоит лампа в напечатанном креплении, мм над столом.
 *
 * Числа выведены из геометрии, а не выбраны на глаз: у открытой лампы это центр
 * колбы в скобе (`lithophaneClampBulb`), у свечи в призме — центр пламени в гнезде
 * пьедестала. Крепления держат источник в единственном положении, поэтому и
 * расчёт берёт его оттуда. У изогнутых форм лампа стоит на полке базы, поэтому её
 * центр считается от полки, а не от стола.
 */

/** Дно гнезда пьедестала призмы, мм: на нём стоит свеча. */
const CANDLE_FLOOR_MM =
  LITHOPHANE_KALEIDOSCOPE.pedestalTop - LITHOPHANE_KALEIDOSCOPE.pedestalDepth;

/** Пламя чайной свечи над её дном, мм. */
const CANDLE_FLAME_MM = 18;

export const LITHO_LIGHT_SEATS = {
  /**
   * Диаметр колбы лампы, мм.
   *
   * Берётся из грушевидной колбы A60 (Ø60) и колбы USB-лампы (Ø20–28): по нему
   * считается только подсказка о пятне — у открытой лампы светит вся колба.
   */
  bulbDiameter: LITHOPHANE_LAMP_CLAMP.socketBulbDiameter,
  /**
   * Пламя свечи в пьедестале калейдоскопа, мм.
   *
   * Чайная свеча Ø38 стоит в гнезде Ø40: её дно на дне гнезда, пламя — на 18 мм
   * выше. Раньше свеча стояла на столе, и источник оказывался у самого низа кадра.
   */
  candleY: CANDLE_FLOOR_MM + CANDLE_FLAME_MM,
} as const;

/** Сумма векторов. */
function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Вектор на число. */
function scale(v: Vec3, k: number): Vec3 {
  return [v[0] * k, v[1] * k, v[2] * k];
}

/** Скалярное произведение. */
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Длина вектора. */
function magnitude(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

/** Единичный вектор; нулевой остаётся нулевым. */
function normalize(v: Vec3): Vec3 {
  const length = magnitude(v);

  return length > 0 ? scale(v, 1 / length) : v;
}

/** Тыл плиты относительно тыла рамки, мм: нахлёст сдвигает плиту вперёд. */
function plateBack(): number {
  return LITHOPHANE_FRAME_SEAT_MM - BODY_OVERLAP_MM;
}

/**
 * Ширина рамки вокруг окна, мм.
 *
 * Геометрия считает её как минимум из трёх чисел (`lithophaneFrameMetrics`), но
 * наружу отдаёт только габарит плиты. Ширина восстанавливается из него:
 * `плита = окно − 2 · зазор`, `окно = габарит − 2 · рамка`.
 */
function plateFrameWidth(
  params: LithophaneParams,
  plate: { width: number; height: number },
): number {
  return (params.lithophaneHeight - plate.height) / 2 - LITHOPHANE_FIT_GAP_MM;
}

/** Ось изгиба грани: точка на нормали в радиусе развёртки. */
function bentAxis(face: LithoLightFace): Vec3 {
  if (!face.bend) {
    return face.origin;
  }

  return add(
    face.origin,
    scale(face.normal, -(face.bend.radius + face.bend.backOffset)),
  );
}

/**
 * Точка на грани панели.
 *
 * `u` и `v` — доли ширины и высоты от левого нижнего угла. Плоская грань —
 * обычная плоскость, изогнутая — цилиндр: точка встаёт на радиус
 * `R + backOffset + offset` под углом `(u − 0.5) · width / R`. Формула повторяет
 * `cylinderPoint` из `lithophane-geometry.ts`, поэтому карта света ложится на
 * рельеф, а не на плоскость рядом с ним. `offset` сдвигает точку по нормали —
 * им карта выносится вперёд рельефа.
 */
export function lithophaneFacePoint(
  face: LithoLightFace,
  u: number,
  v: number,
  offset = 0,
): Vec3 {
  const alongRight = (u - 0.5) * face.width;
  const alongUp = v * face.height;

  if (!face.bend) {
    return add(
      add(
        add(face.origin, scale(face.right, alongRight)),
        scale(face.up, alongUp),
      ),
      scale(face.normal, offset),
    );
  }

  const radial = face.bend.radius + face.bend.backOffset + offset;
  const angle = alongRight / face.bend.radius;

  return add(
    add(
      add(bentAxis(face), scale(face.normal, radial * Math.cos(angle))),
      scale(face.right, radial * Math.sin(angle)),
    ),
    scale(face.up, alongUp),
  );
}

/**
 * Нормаль грани в точке `u`.
 *
 * У изогнутой панели нормаль повёрнута вместе с поверхностью: на краю дуги она
 * уходит от оси на угол дуги. Без этого карта света на цилиндре считалась бы по
 * одной плоскости и показывала провал у краёв.
 */
export function lithophaneFaceNormal(face: LithoLightFace, u: number): Vec3 {
  if (!face.bend) {
    return face.normal;
  }

  const angle = ((u - 0.5) * face.width) / face.bend.radius;

  return normalize(
    add(
      scale(face.normal, Math.cos(angle)),
      scale(face.right, Math.sin(angle)),
    ),
  );
}

/**
 * Освещённость точки панели одним источником, люксы.
 *
 * Закон обратных квадратов: `I / r²`, расстояние в метрах, поэтому канделы сразу
 * дают люксы. `cosθ` — наклон луча к нормали панели: под 45° освещённость падает
 * вдвое. `diagram` — диаграмма излучения, `(axis · dir)^lobe`: у ленты косинус к
 * вертикали, у колбы единица во все стороны. Луч с тыла панели даёт ноль — она
 * его не видит.
 */
function emitterLux(
  emitter: LithoLightEmitter,
  point: Vec3,
  normal: Vec3,
): number {
  const fromEmitter: Vec3 = [
    point[0] - emitter.position[0],
    point[1] - emitter.position[1],
    point[2] - emitter.position[2],
  ];
  const distance = magnitude(fromEmitter);

  // Лампа вплотную к панели: модель точечного источника здесь врёт, берём ноль.
  if (distance < 1) {
    return 0;
  }

  const cosSurface = dot(normal, fromEmitter) / distance;

  if (cosSurface <= 0) {
    return 0;
  }

  const along = dot(emitter.axis, fromEmitter) / distance;
  /*
    Диаграмма излучения: `(axis · dir)^lobe`. У ленты `lobe = 1` — косинус к
    вертикали, и вниз она не светит вовсе, поэтому отрицательное скалярное
    произведение обнуляется. У колбы, патрона и свечи `lobe = 0` — светят во все
    стороны, и `along` может быть каким угодно: ноль в степени ноль — единица.
  */
  const diagram =
    emitter.lobe > 0
      ? along > 0
        ? Math.pow(along, emitter.lobe)
        : 0
      : 1;
  const metres = distance / 1000;

  return (emitter.intensity * cosSurface * diagram) / (metres * metres);
}

/** Освещённость точки панели всеми источниками, люксы. */
function panelLux(
  point: Vec3,
  normal: Vec3,
  emitters: readonly LithoLightEmitter[],
): number {
  let total = 0;

  for (const emitter of emitters) {
    total += emitterLux(emitter, point, normal);
  }

  return total;
}

/**
 * Рассеиватель в напечатанной базе: где стоит лист и сколько он размывает.
 *
 * `gap` — расстояние от листа до тыла панели, мм: от него зависит радиус
 * размытия. `bottom` и `top` — низ и верх листа над столом: свет, идущий выше
 * листа, доходит до панели прямым, и расчёт считает его прямым.
 */
export type LithoLightDiffuser = {
  gap: number;
  bottom: number;
  top: number;
};

/** Гауссово ядро свёртки по одной оси, нормированное на единицу. */
function gaussianKernel(sigmaSteps: number): number[] {
  const half = Math.max(1, Math.ceil(sigmaSteps * 2.5));
  const weights: number[] = [];
  let total = 0;

  for (let step = -half; step <= half; step += 1) {
    const weight = Math.exp(-(step * step) / (2 * sigmaSteps * sigmaSteps));

    weights.push(weight);
    total += weight;
  }

  return weights.map((weight) => weight / total);
}

/**
 * Размытие карты света: разделимая свёртка по ширине и высоте панели.
 *
 * Рассеиватель не меняет поток, а перераспределяет его: свёртка с гауссом
 * сохраняет среднее, поэтому после неё средняя освещённость та же, а пик ниже.
 * Края карты не заворачиваются — свет за кромку панели уходит, и там остаётся
 * то, что даёт ближайшая точка.
 */
function blurMap(
  map: readonly number[],
  rows: number,
  columns: number,
  sigmaMm: number,
  widthMm: number,
  heightMm: number,
): number[] {
  const stepX = columns > 1 ? widthMm / (columns - 1) : widthMm;
  const stepY = rows > 1 ? heightMm / (rows - 1) : heightMm;
  const sigmaX = Math.max(0.01, sigmaMm / stepX);
  const sigmaY = Math.max(0.01, sigmaMm / stepY);
  const kernelX = gaussianKernel(sigmaX);
  const kernelY = gaussianKernel(sigmaY);
  const halfX = (kernelX.length - 1) / 2;
  const halfY = (kernelY.length - 1) / 2;
  const horizontal: number[] = new Array<number>(map.length).fill(0);
  const result: number[] = new Array<number>(map.length).fill(0);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let total = 0;

      for (let step = 0; step < kernelX.length; step += 1) {
        const at = Math.min(
          columns - 1,
          Math.max(0, column + step - halfX),
        );

        total += (map[row * columns + at] ?? 0) * (kernelX[step] ?? 0);
      }

      horizontal[row * columns + column] = total;
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      let total = 0;

      for (let step = 0; step < kernelY.length; step += 1) {
        const at = Math.min(rows - 1, Math.max(0, row + step - halfY));

        total += (horizontal[at * columns + column] ?? 0) * (kernelY[step] ?? 0);
      }

      result[row * columns + column] = total;
    }
  }

  return result;
}

/**
 * Доля света точки панели, прошедшая через лист рассеивателя.
 *
 * Луч от лампы к точке пересекает плоскость листа на высоте `y`: ниже верхней
 * кромки свет прошёл через лист и размыт, выше — идёт прямо. Переход сглажен на
 * `diffuserEdge`, иначе на карте была бы видна ступенька. Плоскость листа берётся
 * параллельной панели на расстоянии `gap`: паз базы вертикален, а панель наклонена
 * на 12°, и на 70 мм высоты расхождение меньше 15 мм — для доли света это
 * округление.
 */
function diffuserShare(
  face: LithoLightFace,
  point: Vec3,
  from: Vec3,
  diffuser: LithoLightDiffuser,
): number {
  const fromDepth = dot(sub(from, face.origin), face.normal);

  // Лампа ближе листа: между ней и панелью листа нет, свет идёт прямо.
  if (fromDepth >= -diffuser.gap) {
    return 0;
  }

  const t = (-diffuser.gap - fromDepth) / -fromDepth;
  const crossing = add(from, scale(sub(point, from), t));
  const edge = Math.max(1, LITHO_LIGHT_MODEL.diffuserEdge);

  return Math.min(1, Math.max(0, (diffuser.top - crossing[1]) / edge));
}

/**
 * Карта света с рассеивателем: размытая часть от листа плюс прямой свет мимо него.
 *
 * Доля `share` считается по каждому узлу сетки, поэтому лист не обрезает карту
 * ступенькой: у нижней кромки свет размыт полностью, у верхней — идёт прямо.
 * Пропускание листа снижает только размытую часть, из-за чего за листом панель
 * темнее на 15 %.
 */
function diffusedMap(
  face: LithoLightFace,
  map: readonly number[],
  emitters: readonly LithoLightEmitter[],
  diffuser: LithoLightDiffuser,
  columns: number,
  rows: number,
): number[] {
  const sigma =
    diffuser.gap *
    Math.tan((LITHO_LIGHT_MODEL.diffuserSpreadDeg * Math.PI) / 180);
  const blurred = blurMap(map, rows, columns, sigma, face.width, face.height);
  const from = emittersCentroid(emitters);
  const result: number[] = new Array<number>(columns * rows).fill(0);

  for (let row = 0; row < rows; row += 1) {
    const v = rows > 1 ? row / (rows - 1) : 0.5;

    for (let column = 0; column < columns; column += 1) {
      const u = columns > 1 ? column / (columns - 1) : 0.5;
      const index = row * columns + column;
      const share = diffuserShare(
        face,
        lithophaneFacePoint(face, u, v),
        from,
        diffuser,
      );

      result[index] =
        (map[index] ?? 0) * (1 - share) +
        (blurred[index] ?? 0) * share * LITHO_LIGHT_MODEL.diffuserTransmission;
    }
  }

  return result;
}

/** Метрики карты света: без параметров и рекомендаций — их считает план. */
export type LithoLightMetrics = {
  columns: number;
  rows: number;
  maps: number[][];
  average: number;
  peak: number;
  floor: number;
  peakRatio: number;
  topShare: number;
  faceSpread: number;
};

/**
 * Считает карту света по готовым граням и источникам.
 *
 * `topShare` — средняя освещённость верхней полосы к нижней: главная метрика для
 * литофана, потому что низ всегда ближе к лампе. `faceSpread` — разброс средних
 * по граням призмы: у калейдоскопа все четыре кадра должны читаться одинаково.
 * Функция чистая и не знает про параметры, поэтому её же проверяет
 * `check:lithophane`.
 */
export function lithophaneLightMetrics(
  faces: readonly LithoLightFace[],
  emitters: readonly LithoLightEmitter[],
  columns: number = LITHO_LIGHT_MODEL.columns,
  rows: number = LITHO_LIGHT_MODEL.rows,
  diffuser: LithoLightDiffuser | null = null,
): LithoLightMetrics {
  const maps: number[][] = [];
  const faceMeans: number[] = [];
  const band = Math.max(1, Math.round(rows * LITHO_LIGHT_MODEL.edgeBand));
  let sum = 0;
  let peak = 0;
  let floor = Number.POSITIVE_INFINITY;
  let count = 0;
  let bottomSum = 0;
  let bottomCount = 0;
  let topSum = 0;
  let topCount = 0;

  for (const face of faces) {
    const direct: number[] = new Array<number>(columns * rows).fill(0);

    for (let row = 0; row < rows; row += 1) {
      const v = rows > 1 ? row / (rows - 1) : 0.5;

      for (let column = 0; column < columns; column += 1) {
        const u = columns > 1 ? column / (columns - 1) : 0.5;

        direct[row * columns + column] = panelLux(
          lithophaneFacePoint(face, u, v),
          lithophaneFaceNormal(face, u),
          emitters,
        );
      }
    }

    // Рассеиватель считается по готовой прямой карте: он не двигает лампу, а
    // перераспределяет уже дошедший свет.
    const map = diffuser
      ? diffusedMap(face, direct, emitters, diffuser, columns, rows)
      : direct;
    let faceSum = 0;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const lux = map[row * columns + column] ?? 0;

        faceSum += lux;
        sum += lux;
        count += 1;
        peak = Math.max(peak, lux);
        floor = Math.min(floor, lux);

        if (row < band) {
          bottomSum += lux;
          bottomCount += 1;
        }

        if (row >= rows - band) {
          topSum += lux;
          topCount += 1;
        }
      }
    }

    maps.push(map);
    faceMeans.push(faceSum / (columns * rows));
  }

  const average = count > 0 ? sum / count : 0;
  const bottomMean = bottomCount > 0 ? bottomSum / bottomCount : 0;
  const topMean = topCount > 0 ? topSum / topCount : 0;
  const maxFace = Math.max(...faceMeans);
  const minFace = Math.min(...faceMeans);

  return {
    columns,
    rows,
    maps,
    average,
    peak,
    floor: Number.isFinite(floor) ? floor : 0,
    peakRatio: average > 0 ? peak / average : 0,
    topShare: bottomMean > 0 ? topMean / bottomMean : 0,
    faceSpread: maxFace > 0 ? (maxFace - minFace) / maxFace : 0,
  };
}

/** Грань панели и источники, которые её освещают: заготовка плана. */
type LithoLightSeat = {
  kind: LithoLightKind;
  faces: LithoLightFace[];
  emitters: LithoLightEmitter[];
};

/**
 * Лента, разложенная на точки по каналу.
 *
 * Канал 98 мм на панели 120 мм: одна лампа в его середине дала бы пятно, поэтому
 * поток делится на `count` равных частей, а точки идут от края до края. Суммарная
 * сила света от числа точек не зависит — меняется только ровность.
 *
 * `axis` — куда светит лента: у канала в скате базы арки это нормаль ската, у
 * ленты в коробе подвеса и в рельсе дуги — вертикаль.
 */
function stripEmitterLine(
  count: number,
  candelas: number,
  place: (offset: number) => Vec3,
  axis: Vec3 = [0, 1, 0],
): LithoLightEmitter[] {
  const emitters: LithoLightEmitter[] = [];
  const step = count > 1 ? 2 / (count - 1) : 0;

  for (let index = 0; index < count; index += 1) {
    emitters.push({
      position: place(count > 1 ? -1 + index * step : 0),
      axis,
      lobe: 1,
      intensity: candelas / count,
    });
  }

  return emitters;
}

/** Верх базы для выбранного крепления, мм: массивная подставка выше ножки. */
function standBaseTop(mount: LithophaneMount): number {
  return mount === "base"
    ? LITHOPHANE_STAND_SHAPES.massive.baseTop
    : LITHOPHANE_STAND_SHAPES.leg.baseTop;
}

/**
 * Тыл плоской плиты: центр нижней кромки и оси панели.
 *
 * Наклон 12° вокруг ребра (Y = 0, Z = 0) и посадка на верх базы повторяют сборку
 * из `createLithophaneGeometry`: та же матрица и тот же сдвиг, поэтому карта
 * света ложится на ту же плоскость, что видна в предпросмотре. Подвес на стене
 * стоит ровно: наклона у него нет, а низ плиты остаётся на высоте рамки.
 */
function flatFace(
  normalized: LithophaneParams,
  plate: { width: number; height: number },
): LithoLightFace {
  const stand = lithophaneHasStand(normalized.lithoMount);
  const tilt = stand ? (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180 : 0;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const localY = plateFrameWidth(normalized, plate) + LITHOPHANE_FIT_GAP_MM;
  const localZ = plateBack();
  /*
    Арка опускает рамку в паз на 3.5 мм вдоль плоскости панели, остальные
    крепления ставят её низом на базу. Сдвиг идёт по плоскости панели, поэтому
    тыл рамки остаётся на прежнем месте.
  */
  const sink =
    normalized.lithoMount === "arch" ? LITHOPHANE_ARCH_STAND.seatDepth : 0;
  const baseTop = stand ? standBaseTop(normalized.lithoMount) : 0;

  return {
    origin: [
      0,
      localY * cos + localZ * sin + baseTop - sink * cos,
      -localY * sin + localZ * cos + sink * sin,
    ],
    right: [1, 0, 0],
    up: [0, cos, -sin],
    normal: [0, sin, cos],
    width: plate.width,
    height: plate.height,
    bend: null,
  };
}

/**
 * Источники плоской панели: лента в канале, колба в чаше или патрон в стакане.
 *
 * Координаты канала взяты из профилей базы: у арки канал идёт сразу за пазом
 * рамки, у подвеса — вдоль тыльной стенки короба. Лента лежит на полу канала и
 * светит вверх по всей его длине; колба и патрон стоят в своих креплениях на оси
 * панели, поэтому остаются одной точкой.
 */
function flatEmitters(
  normalized: LithophaneParams,
  kind: LithoLightKind,
  plate: { width: number; height: number },
): LithoLightEmitter[] {
  const candelas = LITHO_LIGHT_MODEL.candelas;

  // Лампа в открытой скобе смотрит в панель, а не вверх: ось скобы
  // горизонтальна, поэтому центр колбы стоит на высоте гнезда и сдвинут к панели
  // на свой вылет. Какое из двух гнёзд занято, говорит параметр `lithoLightSeat`.
  if (kind === "usb_bulb" || kind === "socket") {
    return [
      {
        position: lithophaneClampBulb(kind, normalized.lithoLightSeat),
        axis: [0, 0, 1],
        lobe: 0,
        intensity:
          kind === "usb_bulb" ? candelas.usbBulb : candelas.socket,
      },
    ];
  }

  const arch = LITHOPHANE_ARCH_STAND;
  const box = LITHOPHANE_WALL_BOX;

  if (normalized.lithoMount === "hook") {
    // Короб подвеса: лента лежит на полке рамки у тыльной стенки и светит вверх.
    const half = (plate.width - 2 * box.inset - 2 * box.wall) / 2;

    return stripEmitterLine(
      LITHO_LIGHT_MODEL.stripEmitters,
      candelas.strip,
      (offset) => [
        offset * half,
        box.channelFloor + LITHO_LIGHT_MODEL.stripLift,
        -(box.depth - box.wall) + box.channelWidth / 2,
      ],
    );
  }

  /*
    Арка: канал вырезан в скате задней стенки-клина, а не в верхней плоскости базы.
    Точка и ось берутся из геометрии — это тот же скат, по которому режется канал.
    Лента идёт по всей ширине базы: ножки стоят впереди и её не перекрывают.
  */
  const half = Math.min(
    normalized.lithophaneWidth,
    Math.max(
      arch.minWidth,
      normalized.lithophaneWidth * arch.widthFactor,
    ),
  ) / 2;
  const lift = LITHO_LIGHT_MODEL.stripLift;
  const start: Vec3 = [
    0,
    LITHOPHANE_ARCH_STRIP.y + LITHOPHANE_ARCH_STRIP.axis[1] * lift,
    LITHOPHANE_ARCH_STRIP.z + LITHOPHANE_ARCH_STRIP.axis[2] * lift,
  ];

  return stripEmitterLine(
    LITHO_LIGHT_MODEL.stripEmitters,
    candelas.strip,
    (offset) => [offset * half, start[1], start[2]],
    LITHOPHANE_ARCH_STRIP.axis,
  );
}

/**
 * Тыл изогнутой панели: цилиндр радиуса изгиба вокруг оси (0, *, −R).
 *
 * Сборка изогнутой формы не наклоняется и не садится на базу — панель стоит
 * нижней кромкой в пазу рельса, поэтому вся плита поднята на дно паза. Радиус
 * полуцилиндра выводится из ширины (`R = ширина / π`), у изогнутой панели берётся
 * из слайдера — ровно как в `lithophaneBendRadius`.
 */
function bentFace(
  normalized: LithophaneParams,
  plate: { width: number; height: number },
): LithoLightFace {
  const radius =
    normalized.lithoShape === "cylinder"
      ? normalized.lithophaneWidth / Math.PI
      : normalized.lithoCurveRadius;
  // У полуцилиндра панель стоит на кромке чаши, у изогнутой — на бруске дуги.
  const floor =
    normalized.lithoShape === "cylinder"
      ? LITHOPHANE_CYLINDER_FLOOR_MM
      : LITHOPHANE_BENT_BASE_FLOOR_MM;

  return {
    origin: [
      0,
      floor + plateFrameWidth(normalized, plate) + LITHOPHANE_FIT_GAP_MM,
      plateBack(),
    ],
    right: [1, 0, 0],
    up: [0, 1, 0],
    normal: [0, 0, 1],
    width: plate.width,
    height: plate.height,
    bend: { radius, backOffset: plateBack() },
  };
}

/**
 * Источники изогнутых форм: лента в базе, USB-лампа или патрон E27 на полке.
 *
 * У изогнутой панели лента лежит в канале бруска, заметённого по дуге: он идёт
 * за пазом рамки, повторяя её прогиб, а канал вынесен назад на 26 мм, поэтому
 * точки ленты встают на радиус `R − (зазор + отступ + канал)`. У полуцилиндра
 * ленте отведена круговая канавка в дне чаши — кольцо точек по всему
 * полуцилиндру. USB-лампа и патрон стоят на полке базы: у бруска на оси панели,
 * в чаше — в её центре, на оси вращения. «Без подсветки» источника не даёт.
 */
function bentSeat(
  normalized: LithophaneParams,
  plate: { width: number; height: number },
): LithoLightSeat | null {
  const face = bentFace(normalized, plate);
  const kind = normalized.lithoLightSource;

  if (kind === "none") {
    return null;
  }

  if (kind === "usb_bulb" || kind === "socket") {
    const cylinder = normalized.lithoShape === "cylinder";
    const shelf = cylinder
      ? LITHOPHANE_BENT_BASE.perchTop
      : LITHOPHANE_BENT_BASE.railTop;
    // Ось скобы над полкой та же, что у тела: `bentAxisAbove` из геометрии.
    const above = LITHOPHANE_LAMP_CLAMP.bentAxisAbove[kind];
    // В чаше лампа стоит на оси вращения, на бруске — на оси скобы.
    const z = cylinder
      ? -(face.bend?.radius ?? 0)
      : LITHOPHANE_LAMP_CLAMP.bentAxisZ;

    return {
      kind,
      faces: [face],
      emitters: [
        {
          position: [0, shelf + above, z],
          axis: [0, 0, 1],
          lobe: 0,
          intensity:
            kind === "usb_bulb"
              ? LITHO_LIGHT_MODEL.candelas.usbBulb
              : LITHO_LIGHT_MODEL.candelas.socket,
        },
      ],
    };
  }

  const base = LITHOPHANE_BENT_BASE;
  const radius = face.bend?.radius ?? 0;

  if (normalized.lithoShape === "cylinder") {
    const ring =
      radius -
      (LITHOPHANE_FIT_GAP_MM +
        base.bowlWall +
        base.ringInset +
        base.channelWidth / 2);
    const y =
      base.bowlFloor - base.channelDepth + LITHO_LIGHT_MODEL.stripLift;
    const count = LITHO_LIGHT_MODEL.stripEmitters;

    return {
      kind: "strip",
      faces: [face],
      emitters: Array.from({ length: count }, (_, index) => {
        const angle = (2 * Math.PI * index) / count;

        return {
          position: [
            ring * Math.sin(angle),
            y,
            -radius + ring * Math.cos(angle),
          ],
          axis: [0, 1, 0],
          lobe: 1,
          intensity: LITHO_LIGHT_MODEL.candelas.strip / count,
        };
      }),
    };
  }

  const radial =
    radius - (LITHOPHANE_FIT_GAP_MM + base.channelGap + base.channelWidth / 2);
  const y = base.top - base.channelDepth + LITHO_LIGHT_MODEL.stripLift;
  const half = plate.width / 2;

  return {
    kind: "strip",
    faces: [face],
    emitters: stripEmitterLine(
      LITHO_LIGHT_MODEL.stripEmitters,
      LITHO_LIGHT_MODEL.candelas.strip,
      (offset) => {
        const angle = (offset * half) / radius;

        return [
          radial * Math.sin(angle),
          y,
          -radius + radial * Math.cos(angle),
        ];
      },
    ),
  };
}

/**
 * Призма калейдоскопа: четыре панели вокруг свечи.
 *
 * Грань повёрнута на 90° · side вокруг оси призмы, её тыл отстоит от оси на
 * `width / 2 − maxThickness` — там же, где его ставит
 * `kaleidoscopePanelMatrix`. Свеча стоит в кольце Ø40 на оси: все четыре кадра
 * получают один и тот же свет, поэтому карта нужна прежде всего для проверки
 * ровности граней.
 */
function kaleidoscopeSeat(
  normalized: LithophaneParams,
  plate: { width: number; height: number },
): LithoLightSeat {
  const kaleido = LITHOPHANE_KALEIDOSCOPE;
  const back = plate.width / 2 - normalized.lithophaneMaxThickness;
  const faces: LithoLightFace[] = [];
  // Плита чуть уже грани призмы: её торец уходит внутрь соседней панели.
  const width = plate.width - 2 * BODY_OVERLAP_MM;

  for (let side = 0; side < kaleido.sides; side += 1) {
    const angle = (side * Math.PI) / 2;
    const normal: Vec3 = [Math.sin(angle), 0, Math.cos(angle)];
    const right: Vec3 = [Math.cos(angle), 0, -Math.sin(angle)];

    faces.push({
      origin: [
        normal[0] * back,
        kaleido.floor,
        normal[2] * back,
      ],
      right,
      up: [0, 1, 0],
      normal,
      width,
      height: plate.height,
      bend: null,
    });
  }

  return {
    kind: "candle",
    faces,
    emitters: [
      {
        position: [0, LITHO_LIGHT_SEATS.candleY, 0],
        axis: [0, 1, 0],
        lobe: 0,
        intensity: LITHO_LIGHT_MODEL.candelas.candle,
      },
    ],
  };
}

/** Центр светящейся группы, взвешенный по силе света, мм. */
function emittersCentroid(emitters: readonly LithoLightEmitter[]): Vec3 {
  let weight = 0;
  let x = 0;
  let y = 0;
  let z = 0;

  for (const emitter of emitters) {
    weight += emitter.intensity;
    x += emitter.position[0] * emitter.intensity;
    y += emitter.position[1] * emitter.intensity;
    z += emitter.position[2] * emitter.intensity;
  }

  return weight > 0 ? [x / weight, y / weight, z / weight] : [0, 0, 0];
}

/** Вектор от `b` к `a`. */
function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * Расстояние от точки до грани панели, мм.
 *
 * У плоской панели — до плоскости, у изогнутой — до поверхности цилиндра: разница
 * радиуса и радиального удаления точки от оси. Знак не важен: лампа стоит и
 * снаружи дуги, и внутри неё, как у полуцилиндра.
 */
function distanceToFace(face: LithoLightFace, point: Vec3): number {
  if (!face.bend) {
    return Math.abs(dot(sub(point, face.origin), face.normal));
  }

  const axis = bentAxis(face);
  const radial = Math.hypot(point[0] - axis[0], point[2] - axis[2]);

  return Math.abs(radial - (face.bend.radius + face.bend.backOffset));
}

/** След точки на плоскости грани: проекция по нормали. */
function projectOnFace(face: LithoLightFace, point: Vec3): Vec3 {
  const offset = dot(sub(point, face.origin), face.normal);

  return add(point, scale(face.normal, -offset));
}

/** Углы грани в долях ширины и высоты. */
const FACE_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

/**
 * Рекомендованное расстояние от лампы до панели, мм.
 *
 * Для плоской плиты — правило 45°: самый дальний угол должен видеть лампу под углом
 * не больше 45° к нормали, иначе у лампы пятно, а в углу провал. Порог и есть
 * рекомендация: `d = смещение / tan 45°`, то есть расстояние должно быть не меньше
 * смещения от следа лампы на панели до самого дальнего угла.
 *
 * Для изогнутой панели и призмы рекомендуемое место — ось: панель собирает свет со
 * всех сторон, и расстояние до неё задаёт радиус развёртки.
 */
function recommendedDistance(
  face: LithoLightFace,
  emitters: readonly LithoLightEmitter[],
): number {
  if (face.bend) {
    return face.bend.radius + face.bend.backOffset;
  }

  const foot = projectOnFace(face, emittersCentroid(emitters));
  let offset = 0;

  for (const [u, v] of FACE_CORNERS) {
    offset = Math.max(
      offset,
      magnitude(sub(lithophaneFacePoint(face, u, v), foot)),
    );
  }

  return offset / Math.tan((LITHO_LIGHT_MODEL.maxIncidenceDeg * Math.PI) / 180);
}

/**
 * Расстояние, при котором верх получает не меньше 80 % света низа, мм.
 *
 * Точечный источник на уровне нижней кромки освещает точку на высоте `h` как
 * `d² / (d² + h²)`. Из неравенства «не меньше `1 − falloff`» выходит
 * `d ≥ h · √((1 − falloff) / falloff)`: при допуске 20 % это два роста панели.
 * Столько ленте в канале не выдержать — это уже световой бокс с рассеивателем.
 */
function evenHeightDistance(plateHeight: number): number {
  const falloff = LITHO_LIGHT_MODEL.maxVerticalFalloff;

  return plateHeight * Math.sqrt((1 - falloff) / falloff);
}

/** Основание для предупреждений: метрики карты и посчитанные рекомендации. */
type LithoLightVerdict = {
  kind: LithoLightKind;
  metrics: LithoLightMetrics;
  actualDistance: number;
  recommendedDistance: number;
  /** Высота лампы над столом, мм: её задаёт крепление. */
  actualHeight: number;
  /** Высота середины панели над столом, мм: лучшее место для лампы. */
  recommendedHeight: number;
  plateHeight: number;
};

/**
 * Предупреждения по метрикам.
 *
 * Пороги берутся из `LITHO_LIGHT_MODEL`: 45° ограничивают расстояние, отношение
 * пика к средней — пересвет, верх к низу — читаемость кадра сверху. Тексты уже
 * готовы к показу, панель конструктора их только раскрашивает.
 *
 * Расстояние и высоту лампы задаёт напечатанное крепление, поэтому советы
 * говорят не «передвиньте лампу», а что даёт результат: рассеиватель, бокс,
 * абажур. Числа в тексте — из карты света, чтобы их можно было сверить с ней.
 */
function lightWarnings(verdict: LithoLightVerdict): LithoLightWarning[] {
  const warnings: LithoLightWarning[] = [];
  const { metrics } = verdict;
  const falloff = metrics.topShare > 0 ? 1 / metrics.topShare : 0;
  const actual = Math.round(verdict.actualDistance);
  const wanted = Math.round(verdict.recommendedDistance);
  const lampY = Math.round(verdict.actualHeight);
  const plateY = Math.round(verdict.recommendedHeight);
  /*
    Верх обычно темнее низа: источник стоит ниже середины кадра. Но правило не
    всеобщее — в арке скоба держит лампу на середине панели, и наклонный тыл ловит
    её свет снизу: верх выходит даже светлее. Поэтому считаем не «верх темнее», а
    насколько он ушёл в тень: пока разрыв в пределах допуска — молчим, дальше
    предупреждаем, а когда верх едва виден (`darkTop`) — это уже ошибка: кадр
    читается на треть высоты.
  */
  const shaded = metrics.topShare < 1 - LITHO_LIGHT_MODEL.maxVerticalFalloff;
  const severity: LithoLightWarning["severity"] =
    metrics.topShare < LITHO_LIGHT_MODEL.darkTop ? "error" : "warning";

  /*
    Пересвет — это в первую очередь пик к средней: 2.5 раза уже видно глазом. Второй
    признак — расстояние: если лампа ближе половины рекомендованного, пятно будет
    при любом потоке. Порог половины, а не трёх четвертей, потому что у ленты в
    наклонном канале правило 45° считается для линии источников и даёт с запасом:
    на 54 мм лента светит ровно, хотя 88 мм формально ещё «не хватает».
  */
  if (
    metrics.peakRatio > LITHO_LIGHT_MODEL.overexposure ||
    verdict.actualDistance < verdict.recommendedDistance * 0.5
  ) {
    warnings.push({
      id: "too_close",
      severity: "error",
      title: "Лампа вплотную: на панели пятно пересвета",
      hint:
        `До панели ${actual} мм, а ровный свет начинается с ${wanted} мм: ` +
        `пик ярче средней в ${metrics.peakRatio.toFixed(1)} раза, дальний ` +
        `угол видит лампу под углом больше ` +
        `${LITHO_LIGHT_MODEL.maxIncidenceDeg}°. Расстояние задаёт ` +
        `крепление, поэтому пятно размывает рассеиватель, а ровный свет даёт ` +
        `бокс с лампой на ${wanted} мм от панели.`,
    });
  }

  if (shaded) {
    warnings.push(
      verdict.kind === "strip"
        ? {
            id: "dark_top",
            severity,
            title: "Верхняя часть будет тёмной",
            hint:
              `Лента стоит за нижней кромкой и светит вверх: низ получает в ` +
              `${falloff.toFixed(1)} раза больше света, чем верх. Ровно по ` +
              `высоте лента светит только с ` +
              `${Math.round(evenHeightDistance(verdict.plateHeight))} мм до ` +
              `панели — это световой бокс с рассеивателем, а не канал в ` +
              `базе: в канале верх вытягивает лента по контуру или ` +
              `рассеивающая плёнка за панелью.`,
          }
        : {
            id: "dark_top",
            severity,
            title: "Верх панели темнее низа",
            hint:
              `Источник стоит на ${lampY} мм над столом, а середина панели — на ` +
              `${plateY} мм: низ получает в ${falloff.toFixed(1)} раза больше ` +
              `света, чем верх. Высоту задаёт гнездо, поэтому верх ` +
              `подтягивает абажур, отражение от задней стенки или ` +
              `рассеиватель — он же снимает пересвет у лампы.`,
          },
    );
  }

  if (metrics.faceSpread > LITHO_LIGHT_MODEL.faceSpread) {
    warnings.push({
      id: "uneven_faces",
      severity: "warning",
      title: "Грани призмы освещены по-разному",
      hint:
        `Разброс средних по граням ` +
        `${Math.round(metrics.faceSpread * 100)} %: источник стоит не на оси ` +
        `призмы, и один кадр ярче соседних.`,
    });
  }

  return warnings;
}

/** Источник плоской панели по креплению: у ножки и массивной базы его нет. */
function flatLightKind(normalized: LithophaneParams): LithoLightKind | null {
  if (normalized.lithoMount === "hook") {
    return "strip";
  }

  if (normalized.lithoMount !== "arch") {
    return null;
  }

  return normalized.lithoLightSource === "none"
    ? null
    : normalized.lithoLightSource;
}

/**
 * Грань и источники по форме и креплению: единственное место, где они выбираются.
 *
 * Плоская панель светит тем, что выбрано в параметрах, и только в арке или в коробе
 * подвеса. Изогнутая панель и полуцилиндр тоже читают `lithoLightSource`: лента
 * ложится в канал бруска или в круговую канавку чаши, USB-лампа и патрон встают на
 * полку базы. Призма держит свечу в пьедестале: другой источник внутрь камеры не
 * встаёт.
 */
function lightSeat(
  normalized: LithophaneParams,
  plate: { width: number; height: number },
): LithoLightSeat | null {
  if (normalized.lithoShape === "kaleidoscope") {
    return kaleidoscopeSeat(normalized, plate);
  }

  if (
    normalized.lithoShape === "curved" ||
    normalized.lithoShape === "cylinder"
  ) {
    return bentSeat(normalized, plate);
  }

  const kind = flatLightKind(normalized);

  if (!kind) {
    return null;
  }

  return {
    kind,
    faces: [flatFace(normalized, plate)],
    emitters: flatEmitters(normalized, kind, plate),
  };
}

/**
 * Место листа-рассеивателя: есть только там, где напечатан его паз.
 *
 * Паз стоит в верхней плоскости базы арки и в бруске дуги — там лист вставляется
 * сверху и оказывается между лентой и панелью. У стойки USB-лампы и стакана
 * патрона лист упёрся бы в саму стойку: они занимают середину базы, поэтому
 * рассеиватель им не предлагается. В чаше полуцилиндра и в призме калейдоскопа
 * листу негде стоять: свет там идёт от центра кольцом по всей дуге.
 *
 * Низ листа — дно паза, верх — на `diffuserSheetHeight` выше. Числа берутся из
 * геометрии, поэтому расчёт и напечатанный паз не разъезжаются.
 */
function diffuserSeat(
  normalized: LithophaneParams,
  kind: LithoLightKind,
): LithoLightDiffuser | null {
  if (!normalized.lithoDiffuser || kind !== "strip") {
    return null;
  }

  if (normalized.lithoShape === "flat") {
    const stand = LITHOPHANE_ARCH_STAND;
    const bottom = stand.baseTop - stand.diffuserDepth;

    return {
      gap: plateBack() - stand.diffuserZ,
      bottom,
      top: bottom + LITHO_LIGHT_MODEL.diffuserSheetHeight,
    };
  }

  if (normalized.lithoShape === "curved") {
    const base = LITHOPHANE_BENT_BASE;
    const bottom = base.top - base.diffuserDepth;

    return {
      gap: plateBack() - base.diffuserU,
      bottom,
      top: bottom + LITHO_LIGHT_MODEL.diffuserSheetHeight,
    };
  }

  return null;
}

/**
 * Полный расчёт по параметрам: источники, карта, рекомендации и предупреждения.
 *
 * Возвращает `null`, если свет ставить некуда: крепления вырезаны в рамке, поэтому
 * без неё сборка — одна плита, а у ножки, массивной базы и «без подсветки»
 * источника нет. Предпросмотр в этом случае не рисует ни ламп, ни карты.
 */
export function lithophaneLightPlan(
  params: Partial<LithophaneParams>,
): LithoLightPlan | null {
  const normalized = normalizeLithophaneParams(params);

  if (!normalized.lithoFrame) {
    return null;
  }

  const plate = lithophanePlateSize(normalized);
  const seat = lightSeat(normalized, plate);

  if (!seat) {
    return null;
  }

  const diffuser = diffuserSeat(normalized, seat.kind);
  const metrics = lithophaneLightMetrics(
    seat.faces,
    seat.emitters,
    undefined,
    undefined,
    diffuser,
  );
  const face = seat.faces[0];
  const centroid = emittersCentroid(seat.emitters);
  const actualDistance = distanceToFace(face, centroid);
  const distance = recommendedDistance(face, seat.emitters);
  const height = lithophaneFacePoint(face, 0.5, 0.5)[1];
  const warnings = lightWarnings({
    kind: seat.kind,
    metrics,
    actualDistance,
    recommendedDistance: distance,
    actualHeight: centroid[1],
    recommendedHeight: height,
    plateHeight: plate.height,
  });

  /*
    Рассеиватель не обязателен: лист — отдельная деталь, и без неё сборка
    работает. Но на широкой панели лампа в базе светит пятном, поэтому о листе
    стоит сказать один раз и с числом: до какого пика доходит карта.
  */
  const diffuserSupported =
    seat.kind === "strip" &&
    (normalized.lithoShape === "flat" || normalized.lithoShape === "curved");

  if (
    diffuserSupported &&
    !diffuser &&
    plate.width >= LITHO_LIGHT_MODEL.diffuserPanelWidth
  ) {
    warnings.push({
      id: "diffuser",
      severity: "warning",
      title: "Рассеиватель сделает свет ровнее",
      hint:
        `Панель ${Math.round(plate.width)} мм шире ` +
        `${LITHO_LIGHT_MODEL.diffuserPanelWidth} мм, и пик ярче средней в ` +
        `${metrics.peakRatio.toFixed(1)} раза. Включите рассеиватель: паз под ` +
        `лист 2 мм уже напечатан в базе, останется вставить лист матового ` +
        `акрила — расчёт покажет свет с ним.`,
    });
  }

  return {
    kind: seat.kind,
    shape: normalized.lithoShape,
    emitters: seat.emitters,
    faces: seat.faces,
    diffuser,
    diffuserSupported,
    ...metrics,
    actualDistance,
    recommendedDistance: distance,
    recommendedHeight: height,
    warnings,
  };
}

/**
 * Цвет точки карты света по отношению к средней освещённости.
 *
 * Палитра читается как термометр: синий — свет не дошёл, зелёный — рабочая зона
 * (0.6–1.6 от средней), красный — пересвет. Отношение берётся к средней, а не к
 * абсолютной яркости: карта показывает ровность, а не мощность лампы.
 */
export function lithophaneHeatColor(ratio: number): Vec3 {
  const stops: ReadonlyArray<readonly [number, Vec3]> = [
    [0.35, [0.05, 0.16, 0.75]],
    [0.6, [0.08, 0.45, 0.95]],
    [0.85, [0.1, 0.7, 0.7]],
    [1.15, [0.15, 0.8, 0.3]],
    [1.6, [0.95, 0.8, 0.2]],
    [2.2, [0.95, 0.25, 0.12]],
  ];
  let lower = stops[0];
  let upper = stops[stops.length - 1];

  for (const stop of stops) {
    if (stop[0] <= ratio) {
      lower = stop;
    }

    if (stop[0] >= ratio) {
      upper = stop;
      break;
    }
  }

  const span = upper[0] - lower[0];
  const t = span > 0 ? Math.min(1, Math.max(0, (ratio - lower[0]) / span)) : 0;

  return [
    lower[1][0] + (upper[1][0] - lower[1][0]) * t,
    lower[1][1] + (upper[1][1] - lower[1][1]) * t,
    lower[1][2] + (upper[1][2] - lower[1][2]) * t,
  ];
}

/**
 * Сетка карты света на грани панели: точки, развёртка, индексы и цвета.
 *
 * Освещённость считается той же функцией, что строит точки (`lithophaneFacePoint`),
 * поэтому отдельной развёртки не нужно: одна параметризация `u`–`v` даёт и точку
 * на поверхности, и место в сетке люксов. Плоская панель, изогнутая и грань
 * призмы получают карту одинаково.
 *
 * Люксы считаны на тыле плиты, а смотреть на карту надо с лица, поэтому точки
 * выносятся вперёд по нормали на толщину плиты плюс зазор: рельеф выступает ровно
 * на толщину, и без сдвига карта легла бы внутрь пластика.
 *
 * Возвращаются сырые массивы, а не объекты three: расчёт остаётся чистым, его
 * проверяет тест, а буферы и текстуру собирает сцена.
 */
export type LithoHeatMesh = {
  /** Позиции вершин, мм: три числа на точку. */
  positions: Float32Array;
  /** Развёртка сетки: два числа на точку. */
  uvs: Float32Array;
  /** Индексы: два треугольника на клетку, строки идут снизу вверх. */
  indices: Uint32Array;
  /** Пиксели карты RGBA, готовые к sRGB-текстуре. */
  pixels: Uint8Array;
};

export function lithophaneHeatMesh(
  face: LithoLightFace,
  map: readonly number[],
  columns: number,
  rows: number,
  average: number,
  lift: number,
): LithoHeatMesh {
  const positions = new Float32Array(columns * rows * 3);
  const uvs = new Float32Array(columns * rows * 2);
  const pixels = new Uint8Array(columns * rows * 4);
  const cells = Math.max(0, columns - 1) * Math.max(0, rows - 1);
  const indices = new Uint32Array(cells * 6);
  let cursor = 0;

  for (let row = 0; row < rows; row += 1) {
    const v = rows > 1 ? row / (rows - 1) : 0.5;

    for (let column = 0; column < columns; column += 1) {
      const u = columns > 1 ? column / (columns - 1) : 0.5;
      const point = lithophaneFacePoint(face, u, v);
      const normal = lithophaneFaceNormal(face, u);
      const index = row * columns + column;
      const lux = map[index] ?? 0;
      const [red, green, blue] = lithophaneHeatColor(
        average > 0 ? lux / average : 1,
      );

      positions[index * 3] = point[0] + normal[0] * lift;
      positions[index * 3 + 1] = point[1] + normal[1] * lift;
      positions[index * 3 + 2] = point[2] + normal[2] * lift;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = v;
      pixels[index * 4] = Math.round(red * 255);
      pixels[index * 4 + 1] = Math.round(green * 255);
      pixels[index * 4 + 2] = Math.round(blue * 255);
      pixels[index * 4 + 3] = 255;
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const corner = row * columns + column;

      indices[cursor] = corner;
      indices[cursor + 1] = corner + 1;
      indices[cursor + 2] = corner + columns;
      indices[cursor + 3] = corner + 1;
      indices[cursor + 4] = corner + columns + 1;
      indices[cursor + 5] = corner + columns;
      cursor += 6;
    }
  }

  return { positions, uvs, indices, pixels };
}

