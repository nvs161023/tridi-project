import {
  CircleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
} from "three";
import type { BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  isHolePlacement,
  keychainPresetById,
  type HolePlacement,
  type KeychainPresetId,
} from "@/lib/constructor/keychain-presets";
import {
  QR_ENGRAVED_DEPTH_MM,
  buildQrCard,
  type QrCardSpec,
} from "@/lib/constructor/qr-card-geometry";

/**
 * Геометрия пресетов брелока.
 *
 * В отличие от прежних встроенных силуэтов, где форма была SVG-строкой, которую
 * надо было разобрать, масштабировать и обрезать под габарит, пресет строится
 * кодом сразу в миллиметрах. Так проще держать пропорции: скругление, отверстие
 * под кольцо и толщина заданы числами, а не «на глаз» после масштабирования.
 *
 * Соглашения те же, что у пользовательского контура: основа лежит в плоскости
 * XY, толщина идёт по Z от 0 до `thickness`, центр габарита — в начале координат.
 * Такой файл слайсер ставит на стол без поворотов, а предпросмотр поворачивает
 * группу на -90° вокруг X.
 *
 * Фаска three.js расширяет контур наружу: у середины толщины габарит больше
 * контура Shape на `bevelSize`, а у крышек совпадает с ним. Поэтому профиль
 * строится меньше заданного габарита на фаску — иначе модель выходила бы на
 * 0.8 мм шире, чем обещает панель.
 */

/** Параметры, общие для всех пресетов: габарит и толщина из слайдеров, мм. */
export type KeychainPresetGeometryParams = {
  /** Ширина в самой широкой части, мм. */
  width: number;
  /** Высота сверху вниз, мм. */
  height: number;
  /** Толщина основы вместе с фасками, мм. */
  thickness: number;
  /**
   * Содержимое QR-визитки: размер, крепление, рельеф и строка кода.
   *
   * У остальных пресетов поля нет: их форма задаётся тремя числами. Визитка —
   * исключение, потому что её раскладку определяет содержимое, а не габарит:
   * длинная ссылка делает модуль мельче.
   */
  qr?: QrCardSpec | null;
  /**
   * Вырезать карман под NFC-метку.
   *
   * Приходит из `params.ts` уже проверенным: у пресета без `nfcPocketY` флаг
   * обнулён, поэтому здесь достаточно одного булева. Глубину, радиус и место
   * кармана считает `nfcLayout` — геометрия и панель берут числа оттуда.
   */
  nfcEnabled?: boolean;
  /**
   * Куда ставить отверстие Ø5 мм под кольцо.
   *
   * Приходит из `params.ts` уже проверенным по набору реестра: значение, которого
   * у силуэта нет, нормализация заменила центром. Пресеты, которым позиция ещё не
   * реализована, поле не читают — у них отверстие остаётся на оси.
   */
  holePlacement?: HolePlacement;
};

/** Ширина фаски по контуру: 0.4 мм читается как скругление кромки. */
const PRESET_BEVEL_SIZE_MM = 0.4;

/** Глубина фаски на каждой стороне: входит в толщину, а не добавляется к ней. */
const PRESET_BEVEL_THICKNESS_MM = 0.2;

/** Два сегмента дают фаску из двух полос — её видно, но она не «мылит» кромку. */
const PRESET_BEVEL_SEGMENTS = 2;

/** 32 сегмента на дугу: скругления и отверстие выходят гладкими, без лесенки. */
const PRESET_CURVE_SEGMENTS = 32;

/** Радиус скругления корпуса Apple Tag, мм. */
const APPLE_TAG_CORNER_RADIUS_MM = 4;

/** Диаметр отверстия под кольцо в свету, мм: общий для всех пресетов. */
export const RING_HOLE_DIAMETER_MM = 5;

/** Отступ центра отверстия от верхнего края корпуса Apple Tag, мм. */
export const APPLE_TAG_RING_HOLE_INSET_MM = 5;

/**
 * Отступ центра отверстия от верхнего края у пресетов с сужающимся верхом, мм.
 *
 * Больше, чем у Apple Tag: у капсулы верх — полукруг, у шестигранника — угол,
 * поэтому отверстие отодвигают вниз, чтобы оно целиком легло в широкую часть и
 * стенка над кольцом осталась ровной, а не клином.
 */
const RING_HOLE_INSET_MM = 8;

/** Радиус скругления углов шестигранника, мм. */
const HEX_CORNER_RADIUS_MM = 2;

/**
 * Скругление углов кирпича, мм.
 *
 * Крупное, потому что основа — прямоугольник 32 × 64: с малым радиусом он
 * цепляется за ключи и колет ладонь в кармане.
 */
const BRICK_CORNER_RADIUS_MM = 8;

/** Шаг сетки шипов, мм: стандарт LEGO, под него же сделаны отверстия в деталях. */
const BRICK_STUD_PITCH_MM = 8;

/**
 * Диаметр шипа, мм.
 *
 * Стандарт LEGO — Ø4.8, но FDM раздаёт пластик наружу на 0.05–0.15 мм, и
 * напечатанный шип Ø4.8 в деталь уже не входит. Ø4.7 отдаёт эти 0.1 мм обратно:
 * брелок садится в LEGO-отверстие с рабочим зазором.
 */
const BRICK_STUD_DIAMETER_MM = 4.7;

/** Высота шипа над верхней площадкой, мм. */
const BRICK_STUD_HEIGHT_MM = 1.7;

/** Высота фаски на верхней кромке шипа, мм. */
const BRICK_STUD_CHAMFER_MM = 0.5;

/** Радиус верхней площадки шипа, мм: фаска снимает 0.5 мм высоты и 0.35 мм радиуса. */
const BRICK_STUD_TOP_RADIUS_MM = 2;

/**
 * Насколько низ шипа утоплен в тело, мм.
 *
 * Тело и шипы сливаются через `mergeGeometries`, а не вычитаются друг из друга:
 * CSG в проекте нет, и литофан, вывеска и подставка собраны так же. Оболочки
 * поэтому должны пересекаться объёмом — касание плоскостями дало бы на верхней
 * грани совпадающие треугольники, и слайсер показал бы самопересечение.
 */
const BRICK_STUD_EMBED_MM = 0.2;

/**
 * Скругление четырёх углов билета, мм.
 *
 * Меньше, чем у остальных пресетов: у настоящего билета угол почти прямой, а
 * 6 мм превращали силуэт в капсулу.
 */
const TICKET_CORNER_RADIUS_MM = 4;

/**
 * Доля высоты, уходящая под отрывной корешок.
 *
 * У бумажных билетов корешок — 25–33 % длины; 28 % попадает в середину вилки и
 * оставляет основной части место под надпись.
 */
const TICKET_STUB_SHARE = 0.28;

/** Корешок не ниже 12 мм: в нём должны уместиться полоса номера и штрихкода. */
const TICKET_STUB_MIN_MM = 12;

/** Корешок не выше 22 мм: на длинной заготовке он иначе съедает четверть детали. */
const TICKET_STUB_MAX_MM = 22;

/** Длина щели перфорации по ширине, мм. */
const TICKET_SLOT_LENGTH_MM = 4;

/** Высота щели в свету, мм: сквозной прокол, который перемычка держит от разрыва. */
const TICKET_SLOT_HEIGHT_MM = 0.9;

/** Перемычка между щелями, мм: 2.6 мм держат нагрузку и читаются как пунктир. */
const TICKET_SLOT_GAP_MM = 2.6;

/** Шаг между центрами щелей, мм: длина щели плюс перемычка. */
const TICKET_SLOT_STEP_MM = TICKET_SLOT_LENGTH_MM + TICKET_SLOT_GAP_MM;

/** Поле от боковой кромки до крайней щели, мм: щель не сливается с кромочным вырезом. */
const TICKET_SLOT_EDGE_MARGIN_MM = 4;

/** Радиус полукруглого выреза на боковой кромке, мм: «зацеп» линии отрыва. */
const TICKET_NOTCH_RADIUS_MM = 2.5;

/** Диаметр пятака проушины, мм. */
const TICKET_TAB_DIAMETER_MM = 11;

/** Выступ проушины над верхней кромкой билета, мм. */
const TICKET_TAB_PROTRUSION_MM = 4;

/** Лучей у вспышки: восемь вершин через 45° читаются как звезда, а не шестерня. */
const STARBURST_RAY_COUNT = 8;

/** Шаг между лучами, °. */
const STARBURST_RAY_PITCH_DEG = 360 / STARBURST_RAY_COUNT;

/**
 * Множители длины лучей: вспышка выходит неровной, как настоящая.
 *
 * Массив фиксированный, а не случайный: STL обеих моделей обязан совпадать
 * бит в бит, иначе один и тот же пресет печатался бы по-разному при каждом
 * скачивании. Порядок — по часовой стрелке от верхнего луча.
 */
const STARBURST_RAY_VARIATION = [1, 0.85, 0.95, 1.1, 0.9, 1.05, 0.88, 1.02];

/** Поле от кромки заготовки до кончика луча, мм. */
const STARBURST_EDGE_MARGIN_MM = 2;

/**
 * Доля внешнего радиуса, остающаяся на впадину между лучами.
 *
 * 47 % радиуса дают глубокую впадину и в то же время держат угол при кончике
 * около 30°: при 40 % лучи выходили шипами, которые гнутся в кармане, а при
 * 65 % силуэт читался шестернёй.
 */
const STARBURST_INNER_SHARE = 0.47;

/**
 * Радиус впадины не меньше этого, мм: отверстие Ø5 мм, стенка кольца 1.5 мм и
 * фаска 0.4 мм, которая снимается на средней плоскости выдавливания.
 *
 * Без этого минимума на 20 × 30 впадина подошла бы к кольцу на полмиллиметра:
 * кромку вырвало бы первым рывком за ключи. На малых размерах ограничение
 * поднимает впадину, поэтому лучи там короче, чем позволяет доля радиуса.
 */
const STARBURST_INNER_MIN_MM =
  RING_HOLE_DIAMETER_MM / 2 + PRESET_BEVEL_SIZE_MM + 1.5;

/** Скругление кончика луча, мм: острый кончик колет ладонь и скалывается. */
const STARBURST_TIP_RADIUS_MM = 0.8;

/** Скругление впадины, мм: меньше кончика, иначе впадина читается волной. */
const STARBURST_VALLEY_RADIUS_MM = 1;

/**
 * Доля ребра луча под прямыми участками между скруглениями.
 *
 * Если оставить меньше, луч превращается в иглу: на 20 мм брелоке два скругления
 * иначе смыкаются, и контур пересекает сам себя.
 */
const STARBURST_STRAIGHT_SHARE = 0.8;

/** Доля верхнего луча, на которую отверстие под кольцо смещается к кончику. */
const STARBURST_RING_SHARE = 0.65;

/** Стенка между отверстием под кольцо и кромкой луча, мм. */
const STARBURST_RING_WALL_MM = 1.5;

/** Шаг поиска смещения отверстия, мм: точнее сетка STL всё равно не нужна. */
const STARBURST_RING_STEP_MM = 0.05;

/**
 * Проходов уточнения луча.
 *
 * Скругление кончика срезает вершину, а срезание зависит от раствора угла, тот —
 * от выноса вершины: поправка уточняется итеративно, как у шестигранника, но
 * здесь она меняет угол в разы сильнее, поэтому проходов больше.
 */
const STARBURST_SOLVE_PASSES = 80;

/** Скругление кончика сердца, мм: острый кончик колет ладонь и скалывается. */
const HEART_TIP_RADIUS_MM = 1;

/** Раствор, под которым нижние ветви сходятся в кончик, °. */
const HEART_TIP_ANGLE_DEG = 60;

/**
 * Глубина выемки между долями в долях высоты слайдера.
 *
 * 15 % оставляют доли круглыми: при 8 % выемка почти исчезает и сердце читается
 * яблоком, а глубже 22 % верх превращается в галочку.
 */
const HEART_VALLEY_DEPTH_SHARE = 0.15;

/** Скругление дна выемки, мм: 3–4 мм держат выемку выемкой, а не надрезом. */
const HEART_VALLEY_RADIUS_MM = 3.5;

/**
 * Полураствор дуги дна выемки, °.
 *
 * Под этим углом дуга переходит в ветвь доли: 55° дают пологий вход и оставляют
 * долям место; при 70° ветви встают почти вертикально, и выемка читается щелью.
 */
const HEART_VALLEY_JOIN_ANGLE_DEG = 55;

/**
 * Уровень максимальной ширины в долях полувысоты профиля.
 *
 * 0.15 ставит плечи выше середины. На 0.10 широкий участок приходился на центр,
 * и силуэт выглядел яблоком с выемкой, а не сердцем.
 */
const HEART_SHOULDER_SHARE = 0.15;

/** X верхушки доли в долях полуширины: 0.52 оставляют доли круглыми. */
const HEART_LOBE_TOP_SHARE = 0.52;

/** Длина контрольного «уса» Безье в долях хорды ветви. */
const HEART_BEZIER_TANGENT_SHARE = 0.55;

/** Доля хорды, на которую ус верхушки доли отодвинут вдоль верхней кромки. */
const HEART_LOBE_TANGENT_SHARE = 0.42;

/**
 * Длина «уса» нижней ветви в долях её хорды.
 *
 * Меньше, чем у долей: нижняя ветвь длинная, и с длинным усом она выгибается
 * боками наружу, как у яблока. 0.45 держат сторону почти прямой у кончика и
 * дают выпуклость только под плечом.
 */
const HEART_LOWER_TANGENT_SHARE = 0.45;

/**
 * Стенка между отверстием под кольцо и дном выемки, мм.
 *
 * Дно выемки — тонкая точка над кольцом: в стороны материал быстро набирает
 * толщину. При 1.5 мм кромка под кольцом выходила на грань печати, 2 мм
 * держатся и на 20 × 30.
 */
const HEART_RING_WALL_MM = 2;

/**
 * Сколько точек берётся на кривую контура сердца при измерении стенки у кольца.
 *
 * 48 — вдвое больше, чем у выдавливания: подпись в панели не должна занижать
 * стенку из-за того, что хорда между точками проходит внутри дуги.
 */
const HEART_CONTOUR_SAMPLES = 48;

/**
 * Целевой модуль шестерни, мм.
 *
 * Модуль — это шаг зубьев, делённый на π, и главный размер шестерни: диаметр по
 * вершинам равен `m × (z + 2)`. 2.16 даёт 20 зубьев на 44 × 44 и окружной шаг
 * 6.2 мм: у печатных брелоков шаг держат в вилке 3–6 мм, и 6.2 — её верхняя
 * граница. Меньше 2 мм зубья сливаются в пилу, больше 2.6 — деталь становится
 * звёздочкой.
 */
const GEAR_MODULE_TARGET_MM = 2.16;

/**
 * Границы числа зубьев и шаг сетки.
 *
 * 12 — минимум, при котором впадина ещё шире сопла 0.4 мм и на 20 × 30 деталь не
 * превращается в звёздочку; 20 — максимум, после которого силуэт читается
 * «монетой с насечкой». Число зубьев кратно четырём: тогда по одному зубу
 * смотрит ровно вверх, вниз, вправо и влево — габарит держится по обеим осям без
 * компенсации, а деталь симметрична относительно обеих осей. При 18 зубьях
 * пришлось бы либо терять 0.65 мм по оси X, либо поворачивать контур на 5° и
 * терять симметрию.
 */
const GEAR_TEETH_MIN = 12;
const GEAR_TEETH_MAX = 20;
const GEAR_TEETH_STEP = 4;

/**
 * Угол профиля зуба, °.
 *
 * 20° — стандарт эвольвентного зацепления, и он же лучший компромисс для FDM:
 * при 14.5° зубья у корня толще и впадина уже, при 25° вершина выходит такой
 * узкой, что сопло её не пропечатывает.
 */
const GEAR_PRESSURE_ANGLE_DEG = 20;

/**
 * Радиальный зазор под зубом в долях модуля.
 *
 * 1.25m — стандарт: впадина глубже рабочей высоты зуба, поэтому вершина
 * соседней шестерни не упирается в дно.
 */
const GEAR_ROOT_CLEARANCE_SHARE = 1.25;

/**
 * Скругления вершины и впадины в долях модуля и их потолки в мм.
 *
 * Вершина: 0.3m срезает острый угол, но оставляет плоскую площадку — именно она
 * читается как фрезерованный зуб. Впадина крупнее (0.5m) — это галтель, без неё
 * угол корня становится концентратором и первым ломается на ключах.
 */
const GEAR_TIP_RADIUS_SHARE = 0.3;
const GEAR_TIP_RADIUS_MAX_MM = 0.8;
const GEAR_ROOT_RADIUS_SHARE = 0.5;
const GEAR_ROOT_RADIUS_MAX_MM = 1.2;

/**
 * Предел скругления в долях ширины площадки, на которой оно стоит.
 *
 * На 20 × 30 впадина сужается до 1.3 мм, и два скругления по 0.7 мм смыкаются в
 * точке: там сходятся четыре треугольника, и сетка перестаёт быть манифолдной.
 * 35 % ширины оставляют между скруглениями прямую площадку.
 */
const GEAR_ROUND_WIDTH_SHARE = 0.35;

/**
 * Во сколько раз радиус галтели должен превышать фаску, чтобы его ставить.
 *
 * Фаска смещает контур внутрь на 0.4 мм, и при галтели меньше 0.55 мм впадина на
 * крышке вырождается в точку. На 20 × 30 галтель 0.45 мм — там угол остаётся
 * острым, его всё равно срезает сама фаска.
 */
const GEAR_ROOT_ROUND_BEVEL_RATIO = 1.4;

/**
 * Скругление излома между радиальной стенкой и эвольвентой, доли модуля и мм.
 *
 * Угол там всего 10–15°, но острым он выглядит как заусенец, поэтому малый
 * радиус всё равно нужен.
 */
const GEAR_SHOULDER_RADIUS_SHARE = 0.25;
const GEAR_SHOULDER_RADIUS_MAX_MM = 0.5;

/** Сегментов на дугу вершины и впадины: 4 дают хорду ≤0.5 мм на 44 мм. */
const GEAR_ARC_SEGMENTS = 4;

/**
 * Диаметр ступицы в долях диаметра вершин и минимальная стенка вокруг кольца, мм.
 *
 * Ступица остаётся акцентом в центре шестерни и отделяет тело от обода — без неё
 * силуэт читается звёздочкой. 0.4 диаметра дают Ø17.3 мм на 44 × 44, и на всех
 * размерах, где отверстие уходит наверх, этого хватает. На 20 × 30 отверстию
 * места нет, оно остаётся в центре, и там диаметр поднимается до
 * `Ø5 + 2 × 2.5 мм`: кольцо не должно вырвать ступицу при первом рывке за ключи.
 */
const GEAR_HUB_SHARE = 0.4;
const GEAR_HUB_MIN_WALL_MM = 2.5;

/**
 * Стенка от отверстия Ø5 до внешнего контура и до ступицы, мм.
 *
 * Отверстие смещено вверх, к верхнему зубу, поэтому ближайшая кромка — то дно
 * впадины сбоку, то кромка ступицы снизу. 1.5 мм — минимум, при котором кольцо
 * ещё держится в пластике и стенка печатается соплом 0.4 мм в два прохода.
 */
const GEAR_RING_WALL_MM = 1.5;

/**
 * Запас на скругления при поиске верхней границы отверстия, мм.
 *
 * Контур проверяется по вершинам до скруглений, а галтель впадины добавляет
 * материал в угол и подходит к отверстию примерно на 0.4 своего радиуса. 0.6 мм
 * запаса держат стенку и после `roundedPointLoop`, где галтель уже срезана.
 */
const GEAR_RING_CONTOUR_MARGIN_MM = 0.6;

/**
 * Выступ ступицы над полем и её утопление в тело, мм.
 *
 * 0.6 мм видно на просвет и на ощупь, но ступица не цепляется за ключи. Низ
 * утоплен на 0.2 мм: оболочки сливаются `mergeGeometries` и должны
 * пересекаться объёмом — касание плоскостями дало бы совпадающие треугольники
 * на верхней грани, как у шипов кирпича.
 */
const GEAR_HUB_LIFT_MM = 0.6;
const GEAR_HUB_EMBED_MM = 0.2;

/**
 * Зазор между отверстием ступицы и отверстием тела, мм.
 *
 * Если обе стенки совпадают по координатам, на цилиндре остаются рёбра, где
 * сходятся четыре треугольника: сетка перестаёт быть манифолдной, и слайсер
 * показывает самопересечение. 0.15 мм разводят стенки в стороны — в свету это
 * расширение вокруг кольца, которое читается как зенковка.
 */
const GEAR_HUB_HOLE_GAP_MM = 0.15;

/**
 * Раскладка билета: корешок снизу, линия отрыва со щелями и проушина.
 *
 * Общая функция для геометрии и подписи в панели, как `brickStudLayout`: числа
 * на плашке обязаны совпадать с тем, что уедет в STL, поэтому высота корешка,
 * число щелей и положение кольца считаются в одном месте.
 *
 * Корешок — полоса у нижней кромки, поперёк ширины: 28 % высоты в вилке 12–22 мм.
 * Линия отрыва идёт по его верхней границе и упирается в полукруглые вырезы на
 * обеих боковых кромках — так она «выходит на кромку», как у бумажного билета.
 * Проушина выступает над верхней кромкой на 4 мм, поэтому габарит по высоте на
 * эти 4 мм больше слайдера: `height` остаётся длиной самого билета.
 */
export type TicketLayout = {
  /** Высота корешка снизу, мм. */
  stubHeight: number;
  /** Y линии отрыва от центра габарита, мм: по ней идут щели и кромочные вырезы. */
  perforationY: number;
  /** Щелей в линии перфорации. */
  slotCount: number;
  /** Щелей в ряду: линия одна, поэтому совпадает с `slotCount`. */
  slotsPerRow: number;
  /** Шаг между центрами щелей, мм. */
  slotStep: number;
  /** X центров щелей от центра габарита, мм; слева направо. */
  slotXs: number[];
  /** Y центра отверстия под кольцо — он же центр пятака проушины, мм. */
  ringY: number;
  /** Выступ проушины над верхней кромкой билета, мм. */
  tabProtrusion: number;
};

export function ticketLayout(width: number, height: number): TicketLayout {
  // Корешок снизу: доля высоты в вилке 12–22 мм и не больше половины заготовки —
  // иначе от билета остаётся один корешок.
  const stubHeight = Math.min(
    Math.max(height * TICKET_STUB_SHARE, TICKET_STUB_MIN_MM),
    TICKET_STUB_MAX_MM,
    height / 2,
  );
  // Полоса под щели: от кромки до кромки без полей. Крайняя щель должна уложиться
  // целиком, поэтому от полосы отнимается длина щели, а не шаг.
  const slotField = Math.max(
    width - TICKET_SLOT_EDGE_MARGIN_MM * 2,
    TICKET_SLOT_LENGTH_MM,
  );
  const slotCount = Math.max(
    1,
    Math.floor((slotField + TICKET_SLOT_GAP_MM) / TICKET_SLOT_STEP_MM),
  );
  const slotSpan =
    slotCount * TICKET_SLOT_LENGTH_MM + (slotCount - 1) * TICKET_SLOT_GAP_MM;
  const slotXs = Array.from(
    { length: slotCount },
    (_, index) =>
      -slotSpan / 2 + TICKET_SLOT_LENGTH_MM / 2 + index * TICKET_SLOT_STEP_MM,
  );
  // Проушина выступает над верхней кромкой ровно на 4 мм, поэтому центр пятака
  // лежит на 1.5 мм ниже кромки: 5.5 − 4 = 1.5 при пятаке Ø11.
  const ringY =
    height / 2 + TICKET_TAB_PROTRUSION_MM - TICKET_TAB_DIAMETER_MM / 2;

  return {
    stubHeight,
    perforationY: -height / 2 + stubHeight,
    slotCount,
    slotsPerRow: slotCount,
    slotStep: TICKET_SLOT_STEP_MM,
    slotXs,
    ringY,
    tabProtrusion: TICKET_TAB_PROTRUSION_MM,
  };
}

/**
 * Раскладка вспышки: лучи разной длины, впадины, скругления и отверстие Starburst.
 *
 * Общая функция для геометрии и подписи в панели, как `ticketLayout`: числа на
 * плашке обязаны совпадать с тем, что уедет в STL.
 *
 * Звезда вписывается в квадрат по меньшей стороне слайдера: разница
 * `width × length` уходит в поле по краям. Внешний радиус — это профиль контура,
 * то есть номинал минус поле 2 мм и минус фаска; на готовой модели фаска
 * раздвигает контур обратно, и габарит совпадает с `sizeMm`. Длины лучей идут по
 * фиксированным множителям `STARBURST_RAY_VARIATION` и нормируются на самый
 * длинный: он один дотягивается до номинала, остальные короче.
 *
 * Скругление кончика срезает вершину луча, поэтому сама вершина выносится
 * дальше длины луча ровно на срезание — так габарит остаётся равен `sizeMm`, а не
 * теряет 2 мм на самом длинном луче. Срезание зависит от угла при кончике, угол —
 * от выноса вершины, поэтому положение вершины ищется итеративно для каждого
 * луча: короткий луч шире, и вынос у него меньше. Скругления поджимаются общим
 * множителем по самому тесному ребру — иначе на 20 мм два скругления на одном
 * ребре сомкнулись бы и контур пересёк сам себя.
 *
 * Отверстие Ø5 мм смещается в верхний луч к кончику, но только пока от его
 * кромки до ребра луча остаётся стенка `STARBURST_RING_WALL_MM`: на малых
 * размерах луч уже кольца со стенками, и отверстие остаётся ближе к центру.
 */
export type StarburstRay = {
  /** Длина луча в профиле контура, мм: радиус с поправкой на вариацию. */
  lengthMm: number;
  /** Радиус математической вершины: вынесен на срезание скругления, мм. */
  apexRadiusMm: number;
  /** Радиус скругления кончика, мм: поджат под длину ребра. */
  tipRadiusMm: number;
  /** Угол между рёбрами луча, °. */
  tipAngleDeg: number;
};

export type StarburstLayout = {
  /** Лучей у вспышки. */
  rayCount: number;
  /** Шаг между лучами, °. */
  pitchDeg: number;
  /** Габарит модели по обеим осям, мм: меньшая сторона слайдера минус поле. */
  sizeMm: number;
  /** Радиус самого длинного луча в профиле контура, мм. */
  outerRadius: number;
  /** Радиус впадины между лучами, мм. */
  innerRadius: number;
  /** Глубина впадины у длинного луча, мм: разница его радиуса и впадины. */
  valleyDepth: number;
  /** Лучи по порядку от верхнего, по часовой стрелке. */
  rays: StarburstRay[];
  /** Длины лучей по порядку, мм: от верхнего луча по часовой стрелке. */
  rayLengths: number[];
  /** Радиус скругления впадин, мм: общий, поджат под короткие рёбра. */
  valleyRadiusMm: number;
  /** Доля ребра, остающаяся прямой между скруглениями, %: по тесному ребру. */
  straightSharePct: number;
  /** Наименьший угол при кончике, °: у самого короткого луча. */
  tipAngleMinDeg: number;
  /** Наибольший угол при кончике, °: у самого длинного луча. */
  tipAngleMaxDeg: number;
  /** Смещение отверстия Ø5 мм по X, мм: ноль, отверстие на оси верхнего луча. */
  ringX: number;
  /** Смещение отверстия Ø5 мм по Y, мм: в верхний луч к кончику. */
  ringY: number;
  /** Стенка между отверстием Ø5 мм и кромкой луча, мм. */
  rimWidthMm: number;
};

export function starburstLayout(
  width: number,
  height: number,
): StarburstLayout {
  const bevel = PRESET_BEVEL_SIZE_MM;
  const sizeMm = Math.max(
    Math.min(width, height) - STARBURST_EDGE_MARGIN_MM * 2,
    STARBURST_INNER_MIN_MM * 2,
  );
  const outerRadius = Math.max((sizeMm - bevel * 2) / 2, 1);
  // Впадина не может подойти к центру ближе стенки кольца: иначе отверстие
  // вырвет кромку при первом же рывке за ключи.
  const innerRadius = Math.min(
    Math.max(outerRadius * STARBURST_INNER_SHARE, STARBURST_INNER_MIN_MM),
    outerRadius - 1.5,
  );
  const pitch = (STARBURST_RAY_PITCH_DEG * Math.PI) / 180;
  const halfPitch = pitch / 2;
  const sinPitch = Math.sin(halfPitch);
  const cosPitch = Math.cos(halfPitch);
  // Раствор угла при кончике: он и решает, насколько скругление срежет вершину.
  const tipAngleAt = (apex: number): number =>
    2 * Math.atan((innerRadius * sinPitch) / (apex - innerRadius * cosPitch));
  const longestVariation = Math.max(...STARBURST_RAY_VARIATION);
  // Самый длинный луч достаёт до номинала, остальные короче по множителям.
  const rayLengths = STARBURST_RAY_VARIATION.map(
    (variation) => (outerRadius * variation) / longestVariation,
  );
  // Вынос вершины ищется для каждого луча отдельно: короткий луч шире, и
  // скругление срезает у него меньшую величину.
  const apexRadii = rayLengths.map((length) => {
    let apex = length;

    for (let pass = 0; pass < STARBURST_SOLVE_PASSES; pass += 1) {
      const halfAngle = tipAngleAt(apex) / 2;

      apex =
        length +
        STARBURST_TIP_RADIUS_MM / Math.sin(halfAngle) -
        STARBURST_TIP_RADIUS_MM;
    }

    return apex;
  });
  const baseAngle = Math.PI / 2;
  const apexPoints = apexRadii.map((radius, index) =>
    polarPoint(radius, baseAngle + index * pitch),
  );
  const valleyPoints = Array.from({ length: STARBURST_RAY_COUNT }, (_, index) =>
    polarPoint(innerRadius, baseAngle + halfPitch + index * pitch),
  );
  // Угол при впадине считается по двум рёбрам сразу: лучи разной длины, и
  // треугольник «впадина — две вершины» перестал быть равнобедренным.
  const valleyHalfAngles = valleyPoints.map((valley, index) => {
    const previous = apexPoints[index];
    const next = apexPoints[(index + 1) % STARBURST_RAY_COUNT];
    const toPrevious = Math.hypot(
      previous[0] - valley[0],
      previous[1] - valley[1],
    );
    const toNext = Math.hypot(next[0] - valley[0], next[1] - valley[1]);
    const chord = Math.hypot(previous[0] - next[0], previous[1] - next[1]);
    const cosine =
      (toPrevious ** 2 + toNext ** 2 - chord ** 2) / (2 * toPrevious * toNext);

    return Math.acos(Math.min(Math.max(cosine, -1), 1)) / 2;
  });
  const tipCutUnits = apexRadii.map(
    (apex) => STARBURST_TIP_RADIUS_MM / Math.tan(tipAngleAt(apex) / 2),
  );
  const valleyCutUnits = valleyHalfAngles.map(
    (halfAngle) => STARBURST_VALLEY_RADIUS_MM / Math.tan(halfAngle),
  );
  // Скругления поджимаются одним множителем: он держит прямые участки на всех
  // рёбрах сразу, поэтому контур остаётся простым даже на коротких лучах.
  const edges = apexPoints.map((apex, index) =>
    [
      (index + STARBURST_RAY_COUNT - 1) % STARBURST_RAY_COUNT,
      index,
    ].map((valleyIndex) => ({
      valleyIndex,
      length: Math.hypot(
        apex[0] - valleyPoints[valleyIndex][0],
        apex[1] - valleyPoints[valleyIndex][1],
      ),
    })),
  );
  let scale = 1;

  for (const [index, rayEdges] of edges.entries()) {
    for (const edge of rayEdges) {
      const cuts = tipCutUnits[index] + valleyCutUnits[edge.valleyIndex];

      scale = Math.min(scale, (STARBURST_STRAIGHT_SHARE * edge.length) / cuts);
    }
  }

  // Множитель уже известен, поэтому остаток прямой части считается по нему.
  let straightShare = 1;

  for (const [index, rayEdges] of edges.entries()) {
    for (const edge of rayEdges) {
      const cuts =
        (tipCutUnits[index] + valleyCutUnits[edge.valleyIndex]) * scale;

      straightShare = Math.min(
        straightShare,
        (edge.length - cuts) / edge.length,
      );
    }
  }

  const rays = rayLengths.map((length, index) => ({
    lengthMm: length,
    apexRadiusMm: apexRadii[index],
    tipRadiusMm: STARBURST_TIP_RADIUS_MM * scale,
    tipAngleDeg: (tipAngleAt(apexRadii[index]) * 180) / Math.PI,
  }));
  const holeRadius = RING_HOLE_DIAMETER_MM / 2;
  // Стенка кольца — это расстояние от кромки отверстия до ребра верхнего луча:
  // рёбра берутся прямые, без скруглений, поэтому запас только растёт.
  const ringGap = (y: number): number =>
    Math.min(
      distanceToSegment(
        0,
        y,
        valleyPoints[STARBURST_RAY_COUNT - 1][0],
        valleyPoints[STARBURST_RAY_COUNT - 1][1],
        apexPoints[0][0],
        apexPoints[0][1],
      ),
      distanceToSegment(
        0,
        y,
        apexPoints[0][0],
        apexPoints[0][1],
        valleyPoints[0][0],
        valleyPoints[0][1],
      ),
    ) - holeRadius;
  const targetRingY = rayLengths[0] * STARBURST_RING_SHARE;
  let ringY = 0;

  // Отверстие забирается вверх, пока выдержана стенка: на малых размерах луч
  // уже кольца со стенками, и подвеска остаётся ближе к центру — иначе кромку
  // разорвёт первым рывком за ключи.
  for (
    let candidate = targetRingY;
    candidate >= 0;
    candidate -= STARBURST_RING_STEP_MM
  ) {
    if (ringGap(candidate) >= STARBURST_RING_WALL_MM) {
      ringY = Math.round(candidate * 100) / 100;
      break;
    }
  }

  const tipAngles = rays.map((ray) => ray.tipAngleDeg);

  return {
    rayCount: STARBURST_RAY_COUNT,
    pitchDeg: STARBURST_RAY_PITCH_DEG,
    sizeMm,
    outerRadius,
    innerRadius,
    valleyDepth: outerRadius - innerRadius,
    rays,
    rayLengths,
    valleyRadiusMm: STARBURST_VALLEY_RADIUS_MM * scale,
    straightSharePct: straightShare * 100,
    tipAngleMinDeg: Math.min(...tipAngles),
    tipAngleMaxDeg: Math.max(...tipAngles),
    ringX: 0,
    ringY,
    rimWidthMm: ringGap(ringY),
  };
}

/**
 * Раскладка сердца: доли, выемка, кончик и отверстие под кольцо.
 *
 * Общая функция для геометрии и подписи в панели, как `ticketLayout` и
 * `starburstLayout`: числа на плашке обязаны совпадать с тем, что уедет в STL.
 *
 * Сердце вписывается в `width × height` слайдеров целиком: верхнюю кромку
 * габарита держат верхушки долей, нижнюю — дуга кончика, а максимальную ширину —
 * плечи. Отверстие Ø5 мм стоит на оси симметрии под выемкой, в теле: проушина
 * поверх выемки не влезает в габарит, а пятак Ø11 мм закрыл бы саму выемку —
 * сердце перестало бы читаться.
 */
export type HeartLayout = {
  /** Полуширина профиля (заготовка минус фаска), мм. */
  halfWidthMm: number;
  /** Полувысота профиля, мм. */
  halfHeightMm: number;
  /** Глубина выемки между долями, мм. */
  valleyDepthMm: number;
  /** Y дна выемки, мм: он же верхняя кромка материала над кольцом. */
  valleyY: number;
  /** Радиус скругления дна выемки, мм. */
  valleyRadiusMm: number;
  /** Полураствор дуги дна выемки, рад: под ним дуга переходит в ветвь доли. */
  valleyJoinAngle: number;
  /** Радиус скругления кончика, мм. */
  tipRadiusMm: number;
  /** Раствор, под которым ветви сходятся в кончик, рад. */
  tipAngle: number;
  /** Y центра дуги кончика, мм. */
  tipCenterY: number;
  /** Y уровня максимальной ширины (плеча), мм. */
  shoulderY: number;
  /** X верхушки доли, мм. */
  lobeTopX: number;
  /** Y верхушки доли — верхняя кромка габарита, мм. */
  lobeTopY: number;
  /** Y центра отверстия под кольцо, мм. */
  ringY: number;
  /** Стенка между отверстием и дном выемки в свету, мм. */
  ringWallMm: number;
};

export function heartLayout(width: number, height: number): HeartLayout {
  const bevel = PRESET_BEVEL_SIZE_MM;
  const halfWidth = Math.max(width - bevel * 2, 1) / 2;
  const halfHeight = Math.max(height - bevel * 2, 1) / 2;
  // Выемка — доля высоты слайдера, но не глубже половины полувысоты: иначе на
  // низкой заготовке доли съедаются и сердце превращается в два круга с провалом.
  const valleyDepth = Math.min(
    height * HEART_VALLEY_DEPTH_SHARE,
    halfHeight * 0.5,
  );
  const valleyY = halfHeight - valleyDepth;
  // Дно выемки скругляется не крупнее половины её глубины и трети полуширины: на
  // 20 × 30 дуга R3.5 иначе заняла бы всю выемку и срезала вход в доли.
  const valleyRadius = Math.min(
    HEART_VALLEY_RADIUS_MM,
    valleyDepth / 2,
    halfWidth * 0.3,
  );
  const tipRadius = Math.min(HEART_TIP_RADIUS_MM, halfHeight * 0.08);
  const tipAngle = (HEART_TIP_ANGLE_DEG * Math.PI) / 180;
  // Габарит снизу держит не вершина угла, а нижняя точка дуги кончика: центр
  // поднимается ровно на радиус от нижней кромки, поэтому высота модели
  // совпадает со слайдером, а ветви касаются дуги под заданным раствором θ.
  const tipCenterY = -halfHeight + tipRadius;
  const ringY =
    valleyY - (RING_HOLE_DIAMETER_MM / 2 + bevel + HEART_RING_WALL_MM);

  return {
    halfWidthMm: halfWidth,
    halfHeightMm: halfHeight,
    valleyDepthMm: valleyDepth,
    valleyY,
    valleyRadiusMm: valleyRadius,
    valleyJoinAngle: (HEART_VALLEY_JOIN_ANGLE_DEG * Math.PI) / 180,
    tipRadiusMm: tipRadius,
    tipAngle,
    tipCenterY,
    shoulderY: halfHeight * HEART_SHOULDER_SHARE,
    lobeTopX: halfWidth * HEART_LOBE_TOP_SHARE,
    lobeTopY: halfHeight,
    ringY,
    ringWallMm: valleyY - ringY - RING_HOLE_DIAMETER_MM / 2,
  };
}

/**
 * Раскладка шестерни: число зубьев, модуль, ступица и отверстие под кольцо.
 *
 * Общая функция для геометрии и подписи в панели, как `heartLayout`: числа на
 * плашке обязаны совпадать с тем, что уедет в STL.
 *
 * Зубьев столько, сколько влезает при целевом модуле: `D / m − 2`, округлённое до
 * кратного четырём. Модуль после округления пересчитывается от габарита, поэтому
 * `D = m × (z + 2)` выполняется точно, а не «примерно».
 *
 * Профиль зуба — реечный, а не эвольвентный, и это осознанно: у шестерни меньше
 * 41 зуба основная окружность лежит выше впадин, эвольвенты там не существует, и
 * настоящий зуб у корня переходит в трохоиду. Радиальная стенка от впадины до
 * основной окружности повторяет эту трохоиду с точностью 0.02 мм и даёт широкую
 * впадину, по которой шестерня и узнаётся.
 */
export type GearLayout = {
  /** Габарит по слайдерам минус фаска, мм: он же диаметр по вершинам. */
  diameterMm: number;
  /** Число зубьев. */
  teeth: number;
  /** Модуль, мм: диаметр по вершинам, делённый на `z + 2`. */
  moduleMm: number;
  /** Окружной шаг на делительной окружности, мм. */
  pitchMm: number;
  /** Радиус вершин, мм. */
  tipRadiusMm: number;
  /** Радиус делительной окружности, мм. */
  pitchRadiusMm: number;
  /** Радиус основной окружности, мм: ниже него зуб идёт радиальной стенкой. */
  baseRadiusMm: number;
  /** Радиус впадин, мм. */
  rootRadiusMm: number;
  /** Полуугол зуба на вершине, рад. */
  tipHalfAngle: number;
  /** Полуугол зуба на основной окружности — он же на впадине, рад. */
  baseHalfAngle: number;
  /** Радиус скругления вершины, мм. */
  tipRoundMm: number;
  /** Радиус галтели впадины, мм; ноль, если она не переживёт фаску. */
  rootRoundMm: number;
  /** Радиус скругления излома между стенкой и эвольвентой, мм. */
  shoulderRoundMm: number;
  /** Радиус профиля ступицы, мм: фаска добавит к нему `bevel`. */
  hubRadiusMm: number;
  /** Номинальный диаметр ступицы, мм. */
  hubDiameterMm: number;
  /** Радиус отверстия в ступице, мм; ноль — ступица сплошная. */
  hubBoreRadiusMm: number;
  /** Высота центра отверстия Ø5 над центром шестерни, мм. */
  ringY: number;
  /** Стенка от отверстия Ø5 до кромки ступицы, мм. */
  ringWallMm: number;
};

export function gearLayout(width: number, height: number): GearLayout {
  const bevel = PRESET_BEVEL_SIZE_MM;
  // Шестерня круглая, поэтому вписана в меньшую сторону: разница уходит в поле,
  // как у вспышки, которая тоже не растягивается на вытянутый габарит.
  const diameter = Math.max(
    Math.min(width, height) - bevel * 2,
    GEAR_TEETH_MIN,
  );
  const teeth = Math.min(
    Math.max(
      Math.round(
        Math.round(diameter / GEAR_MODULE_TARGET_MM - 2) / GEAR_TEETH_STEP,
      ) * GEAR_TEETH_STEP,
      GEAR_TEETH_MIN,
    ),
    GEAR_TEETH_MAX,
  );
  const pressureAngle = (GEAR_PRESSURE_ANGLE_DEG * Math.PI) / 180;
  const tanPressure = Math.tan(pressureAngle);
  // Полуугол зуба на делительной: толщина зуба равна половине шага.
  const halfToothPitch = Math.PI / (2 * teeth);
  // Толщина зуба по рейке растёт к основанию на `(r_p − r) × tanα`, поэтому
  // полуугол на радиусе r: θ(r) = θ_p × r_p / r + (r_p − r) × tanα / r.
  const halfAngleAt = (radius: number, tipRadius: number): number => {
    const moduleMm = (2 * tipRadius) / (teeth + 2);
    const pitchRadius = tipRadius - moduleMm;

    return (
      (halfToothPitch * pitchRadius) / radius +
      ((pitchRadius - radius) * tanPressure) / radius
    );
  };
  const tipRadius = diameter / 2;
  const moduleMm = (2 * tipRadius) / (teeth + 2);
  const pitchRadius = tipRadius - moduleMm;
  // Основная окружность: ниже неё эвольвента не существует, и зуб идёт
  // радиальной стенкой — так у настоящей шестерни выглядит подрез у корня.
  const baseRadius = pitchRadius * Math.cos(pressureAngle);
  const rootRadius = pitchRadius - GEAR_ROOT_CLEARANCE_SHARE * moduleMm;
  const tipHalfAngle = halfAngleAt(tipRadius, tipRadius);
  const baseHalfAngle = halfAngleAt(baseRadius, tipRadius);
  // Ширина площадки вершины и впадины по дуге: скругление не может занять её
  // целиком, иначе два скругления смыкаются в точке.
  const tipWidthMm = 2 * tipHalfAngle * tipRadius;
  const rootWidthMm = ((Math.PI * 2) / teeth - 2 * baseHalfAngle) * rootRadius;
  const tipRound = Math.min(
    GEAR_TIP_RADIUS_SHARE * moduleMm,
    GEAR_TIP_RADIUS_MAX_MM,
    tipWidthMm * GEAR_ROUND_WIDTH_SHARE,
  );
  const rootRound = Math.min(
    GEAR_ROOT_RADIUS_SHARE * moduleMm,
    GEAR_ROOT_RADIUS_MAX_MM,
    rootWidthMm * GEAR_ROUND_WIDTH_SHARE,
  );
  // Фаска смещает контур внутрь на 0.4 мм. Если радиус галтели меньше этой
  // величины с запасом, впадина на крышке вырождается в точку: там сходятся
  // четыре треугольника, и сетка перестаёт быть манифолдной. На 20 × 30 впадина
  // 1.3 мм, галтель 0.45 — не влезает, поэтому угол остаётся острым: его всё
  // равно срезает сама фаска.
  const rootRoundSafe =
    rootRound < bevel * GEAR_ROOT_ROUND_BEVEL_RATIO ? 0 : rootRound;
  const shoulderRound = Math.min(
    GEAR_SHOULDER_RADIUS_SHARE * moduleMm,
    GEAR_SHOULDER_RADIUS_MAX_MM,
  );
  // Ступица не подходит вплотную к впадинам: между её кромкой и дном впадины
  // остаётся 1.5 мм, иначе обод превращается в лепестки.
  const hubDiameterMax = Math.min(
    Math.max(
      GEAR_HUB_SHARE * diameter,
      RING_HOLE_DIAMETER_MM + 2 * GEAR_HUB_MIN_WALL_MM,
    ),
    (rootRadius - 1.5) * 2,
  );
  // Отверстие под кольцо уходит вверх, к верхнему зубу: центр занят ступицей, и
  // кольцо в центре превращает шестерню в медаль. Верхняя граница считается по
  // вершинам контура до скруглений, с запасом на галтель впадины, — иначе на
  // крышке, где фаска сжимает контур и расширяет отверстие, стенка проседает.
  const holeRadius = RING_HOLE_DIAMETER_MM / 2 + bevel;
  const reach = holeRadius + GEAR_RING_WALL_MM + GEAR_RING_CONTOUR_MARGIN_MM;
  const profile: GearProfile = {
    teeth,
    tipRadiusMm: tipRadius,
    baseRadiusMm: baseRadius,
    rootRadiusMm: rootRadius,
    tipHalfAngle,
    baseHalfAngle,
    tipRoundMm: tipRound,
    rootRoundMm: rootRoundSafe,
    shoulderRoundMm: shoulderRound,
  };
  let contourTop = Infinity;

  for (const [x, y] of gearContour(profile).points) {
    // Нижняя половина контура отверстие не ограничивает: центр всегда выше нуля,
    // а расстояние до этих вершин заведомо больше стенки.
    if (y <= 0 || Math.abs(x) >= reach) {
      continue;
    }

    contourTop = Math.min(contourTop, y - Math.sqrt(reach * reach - x * x));
  }
  // Верхнее мясо достаётся отверстию уступкой ступицы: её кромка отходит вниз
  // ровно на стенку. Где места не хватает совсем — 20 × 30: диск 19.2 мм,
  // ступица 10 мм, впадины в 6.5 мм от центра, — отверстие остаётся в центре, а
  // ступица работает кольцом вокруг него, как и до смещения.
  const hubDiameterFit =
    2 * (contourTop - (holeRadius + GEAR_RING_WALL_MM) + bevel);
  const ringFits =
    Number.isFinite(contourTop) && hubDiameterFit >= RING_HOLE_DIAMETER_MM;
  const hubDiameter = ringFits
    ? Math.min(hubDiameterMax, hubDiameterFit)
    : hubDiameterMax;
  const hubRadius = hubDiameter / 2 - bevel;
  const ringY = ringFits ? contourTop : 0;

  return {
    diameterMm: diameter,
    teeth,
    moduleMm,
    pitchMm: Math.PI * moduleMm,
    tipRadiusMm: tipRadius,
    pitchRadiusMm: pitchRadius,
    baseRadiusMm: baseRadius,
    rootRadiusMm: rootRadius,
    tipHalfAngle,
    baseHalfAngle,
    tipRoundMm: tipRound,
    rootRoundMm: rootRoundSafe,
    shoulderRoundMm: shoulderRound,
    hubRadiusMm: hubRadius,
    hubDiameterMm: hubDiameter,
    hubBoreRadiusMm: ringFits ? 0 : holeRadius + GEAR_HUB_HOLE_GAP_MM,
    ringY,
    ringWallMm: ringFits
      ? ringY - hubRadius - RING_HOLE_DIAMETER_MM / 2 - bevel
      : hubRadius - RING_HOLE_DIAMETER_MM / 2 - bevel,
  };
}

/**
 * Пресеты, у которых уже есть геометрия.
 *
 * Список читают панель (подсказка вместо плашки «в работе») и API (422 вместо
 * файла-заглушки), поэтому он один на оба места: разойтись они не могут.
 */
export const IMPLEMENTED_KEYCHAIN_PRESETS: readonly KeychainPresetId[] = [
  "apple-tag",
  "capsule",
  "hex",
  "gear",
  "brick",
  "ticket",
  "starburst",
  "heart",
  "qr-card",
];

/** Готова ли геометрия пресета: список выше — единственный источник правды. */
export function isKeychainPresetImplemented(
  presetId: KeychainPresetId,
): boolean {
  return IMPLEMENTED_KEYCHAIN_PRESETS.includes(presetId);
}

/**
 * Контур отверстия под кольцо в точке (`centerX`, `centerY`).
 *
 * Кольцо стоит на оси X = 0 у большинства пресетов: у билета проушина с пятаком
 * по центру верхней кромки, а не в корешке. Боковые позиции (`left`/`right`)
 * передают смещение по X — так одно и то же отверстие переезжает к кромке, не
 * меняя ни диаметра, ни отступа от верхнего края. Радиус берётся больше
 * номинального на фаску: у отверстия three.js поджимает стенку на `bevelSize` так
 * же, как расширяет корпус наружу. Центр отсчитывается от номинального габарита, а
 * не от контура крышки: панель обещает миллиметры заготовки, а не профиля
 * выдавливания.
 */
function ringHolePath(centerX: number, centerY: number): Path {
  const hole = new Path();
  const holeRadius = RING_HOLE_DIAMETER_MM / 2 + PRESET_BEVEL_SIZE_MM;

  hole.absarc(centerX, centerY, holeRadius, 0, Math.PI * 2, true);

  return hole;
}

/**
 * Пределы бокового сдвига по силуэтам: желаемый сдвиг и минимальный отступ от
 * кромки, мм.
 *
 * Apple Tag: 8 мм — середина между центром и кромкой. При ширине 38 заготовка
 * даёт 19 мм до края, то есть стенка до боковой кромки выходит 8.5 мм. У самой
 * кромки (5 мм, как в аудите) стенка была бы 2.5 мм, и рядом с карманом NFC её
 * вырвало бы первым рывком за ключи. Отступ 5 мм — тот же, что сверху, и та же
 * стенка 2.5 мм: на узкой заготовке фиксированный сдвиг 8 мм вынес бы отверстие
 * за силуэт (при ширине 20 мм кромка идёт по X = 10).
 *
 * Сердце: 6 + 6, потому что кромка на высоте отверстия уже габарита — контур
 * идёт по внешней ветви доли, а не по краю заготовки. На 20 мм ширины он стоит
 * в 9.1 мм от оси, и сдвиг 5 мм оставил бы стенку 1.2 мм; 6 + 6 держит её не
 * тоньше 2.2 мм на всей сетке слайдеров.
 */
const RING_HOLE_SIDE_LIMITS: Partial<
  Record<KeychainPresetId, { offsetMm: number; edgeInsetMm: number }>
> = {
  "apple-tag": { offsetMm: 8, edgeInsetMm: 5 },
  heart: { offsetMm: 6, edgeInsetMm: 6 },
};

/**
 * Фактический сдвиг бокового отверстия от оси, мм.
 *
 * Общее правило для геометрии и панели: желаемый сдвиг, пока до кромки остаётся
 * не меньше отступа силуэта, иначе — сколько есть. На ширине 38 у Apple Tag это
 * 8 мм, на 20 — 5 мм. Ноль означает, что силуэт боковую позицию не строит:
 * отверстие останется на оси, даже если реестр её заявил.
 */
export function ringHoleSideOffsetMm(
  presetId: KeychainPresetId,
  width: number,
): number {
  const limit = RING_HOLE_SIDE_LIMITS[presetId];

  if (!limit) {
    return 0;
  }

  return Number(
    Math.min(
      limit.offsetMm,
      Math.max(width / 2 - limit.edgeInsetMm, 0),
    ).toFixed(2),
  );
}

/**
 * Позиция отверстия для пресета: значение из параметров, если силуэт его держит.
 *
 * Панель и геометрия читают одно правило, поэтому список пунктов и вырезанное
 * отверстие не могут разойтись. `tab` пока не реализована: до T3 она возвращает
 * центр, чтобы модель не осталась без крепления вовсе.
 */
function presetHolePlacement(
  presetId: KeychainPresetId,
  params: KeychainPresetGeometryParams,
): HolePlacement {
  const placement = isHolePlacement(params.holePlacement)
    ? params.holePlacement
    : "center";

  if (placement === "tab") {
    return "center";
  }

  return keychainPresetById(presetId).holePlacements.includes(placement)
    ? placement
    : "center";
}

/**
 * Центр отверстия Ø5 мм при боковой установке, мм; null — позиция не боковая.
 *
 * Смещение идёт только по X, Y берётся из силуэта, поэтому панель обещает те же
 * миллиметры от верхней кромки, что и у центрального отверстия. Пресеты, у
 * которых геометрия боковой позиции ещё не написана, возвращают null — отверстие
 * у них остаётся на оси, даже если реестр позицию уже заявил.
 */
function sideHoleCenter(
  presetId: KeychainPresetId,
  params: KeychainPresetGeometryParams,
): { x: number; y: number } | null {
  const placement = presetHolePlacement(presetId, params);

  if (placement !== "left" && placement !== "right") {
    return null;
  }

  const offset = ringHoleSideOffsetMm(presetId, params.width);

  if (offset === 0) {
    return null;
  }

  switch (presetId) {
    case "apple-tag":
      return {
        x: placement === "left" ? -offset : offset,
        y: params.height / 2 - APPLE_TAG_RING_HOLE_INSET_MM,
      };
    case "heart":
      return {
        x: placement === "left" ? -offset : offset,
        // Отверстие сердца стоит под дном выемки: Y задаёт раскладка, а не край
        // заготовки, иначе на вытянутом сердце оно уехало бы в сужение к кончику.
        y: heartLayout(params.width, params.height).ringY,
      };
    default:
      return null;
  }
}

/**
 * Контур отверстия под кольцо для пресета: X из позиции, Y из силуэта.
 *
 * null — позиция `none`: отверстия нет вовсе. Одна функция на все силуэты,
 * поэтому «без отверстия» и «отверстие сбоку» не могут разойтись между
 * пресетами: разницу задаёт только `sideHoleCenter`.
 */
function presetRingHole(
  presetId: KeychainPresetId,
  params: KeychainPresetGeometryParams,
  centerY: number,
): Path | null {
  if (presetHolePlacement(presetId, params) === "none") {
    return null;
  }

  return ringHolePath(sideHoleCenter(presetId, params)?.x ?? 0, centerY);
}

/**
 * Стенка от бокового отверстия до кромки силуэта в плоскости профиля, мм.
 *
 * Считается в ту сторону, куда сдвинуто отверстие: у Apple Tag это боковая
 * кромка заготовки, у сердца — внешняя ветвь доли на высоте отверстия (она идёт
 * внутри габарита, поэтому ширина слайдера здесь ничего не обещает). Отсчёт — от
 * кромки отверстия Ø5 мм, то есть так, как её увидит кольцо.
 *
 * null — отверстие стоит по центру: сравнивать нечего, стенка та же, что у
 * центральной позиции.
 */
export function ringHoleSideWallMm(
  presetId: KeychainPresetId,
  params: KeychainPresetGeometryParams,
): number | null {
  const center = sideHoleCenter(presetId, params);

  if (!center) {
    return null;
  }

  switch (presetId) {
    case "apple-tag": {
      // Контур — скруглённый прямоугольник, и на высоте отверстия кромка прямая:
      // отступ считаем от профиля, а не от габарита, — фаска снимает 0.4 мм.
      const halfWidth =
        Math.max(params.width - PRESET_BEVEL_SIZE_MM * 2, 1) / 2;

      return Number(
        (
          halfWidth -
          Math.abs(center.x) -
          RING_HOLE_DIAMETER_MM / 2
        ).toFixed(2),
      );
    }
    case "heart": {
      // Ближайшая к отверстию точка контура с той же стороны: у доли ветвь почти
      // вертикальная, поэтому это и есть «кромка вбок». Точки берём из того же
      // контура, который уйдёт в выдавливание, — подпись и STL не разойдутся.
      const points = heartShape(
        heartLayout(params.width, params.height),
      ).getPoints(HEART_CONTOUR_SAMPLES);
      const sign = center.x < 0 ? -1 : 1;
      let edgeX = 0;

      for (const point of points) {
        if (point.x * sign <= 0 || Math.abs(point.y - center.y) > 1) {
          continue;
        }

        edgeX = Math.max(edgeX, Math.abs(point.x));
      }

      // Ни одной точки на высоте отверстия — контур здесь не описан, и врать
      // нулём или отрицательной стенкой нельзя.
      if (edgeX === 0) {
        return null;
      }

      return Number(
        (edgeX - Math.abs(center.x) - RING_HOLE_DIAMETER_MM / 2).toFixed(2),
      );
    }
    default:
      return null;
  }
}

/**
 * Выдавливает контур в слой с фаской по обеим кромкам, мм.
 *
 * Полная высота слоя равна `height`: выдавливание идёт на
 * `height − 2 × bevelThickness`, а сдвиг на `bevelThickness` ставит нижнюю грань
 * ровно на `startZ`. Так два слоя основы с NFC-карманом стыкуются без щели, а
 * одиночный слой встаёт на Z = 0 — слайсер кладёт модель на стол без поворотов.
 */
function extrudePresetLayer(
  shape: Shape,
  startZ: number,
  height: number,
): ExtrudeGeometry {
  const depth = Math.max(height - PRESET_BEVEL_THICKNESS_MM * 2, 0.05);
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: PRESET_BEVEL_SEGMENTS,
    bevelSize: PRESET_BEVEL_SIZE_MM,
    bevelThickness: PRESET_BEVEL_THICKNESS_MM,
    curveSegments: PRESET_CURVE_SEGMENTS,
    depth,
    steps: 1,
  });

  geometry.translate(0, 0, startZ + PRESET_BEVEL_THICKNESS_MM);

  return geometry;
}

/**
 * Выдавливает контур в полосу без фаски, мм.
 *
 * Нужна полостям кармана: фаска three.js расширяет наружу и контур, и дырки, из-за
 * чего стенка полости выходит наклонной, а на стыке с соседней полосой появляется
 * ступенька 0.4 мм. Без фаски стенка отвесная, и круг в слайсере равен радиусу
 * из `nfcLayout`.
 */
function extrudePresetBand(
  shape: Shape,
  startZ: number,
  height: number,
): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: PRESET_CURVE_SEGMENTS,
    depth: Math.max(height, 0.05),
    steps: 1,
  });

  geometry.translate(0, 0, startZ);

  return geometry;
}

/**
 * Выдавливает контур в основу на всю толщину.
 *
 * Толщина держится ровно по слайдеру: нижняя грань на Z = 0, верхняя — на
 * `thickness`.
 */
function extrudePresetShape(
  shape: Shape,
  thickness: number,
): ExtrudeGeometry {
  const geometry = extrudePresetLayer(shape, 0, thickness);

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/** Радиус NFC-метки в свету, мм: круглая метка Ø26, наклеенная на кольцо. */
const NFC_TAG_RADIUS_MM = 13;

/**
 * Минимальная стенка между карманом и кромкой силуэта, мм.
 *
 * Тоньше — пластик вокруг метки прогибается и ломается в кармане. Отсюда и
 * правило отбора: в силуэт должен вписаться круг радиусом `13 + 1.5 = 14.5` мм,
 * иначе пресет карман не получает.
 */
const NFC_WALL_MIN_MM = 1.5;

/**
 * Радиус полости по контуру, мм — Ø29 в свету.
 *
 * Два слагаемых: 13 мм метки и 1.5 мм стенки. Добавки на фаску нет: полость
 * режется полосами без фаски, стенки у неё отвесные, и three.js не поджимает
 * круг на середине толщины.
 */
const NFC_POCKET_RADIUS_MM = NFC_TAG_RADIUS_MM + NFC_WALL_MIN_MM;

/**
 * Сплошное дно под полостью, мм.
 *
 * Три слоя по 0.2 мм: снизу деталь закрыта, и метка лежит на пластике, а не
 * висит над сквозной дырой. Прежняя схема резала карман от Z = 0 — снизу была
 * дыра во весь Ø29, и деталь держалась кольцом вокруг метки.
 */
const NFC_FLOOR_MM = 0.6;

/** Высота полости, мм: метка 1 мм и зазор 0.2 мм на её толщину. */
const NFC_CAVITY_HEIGHT_MM = 1.2;

/** Верх полости, мм: на этом слое ставится пауза M600 — метку кладут сюда. */
const NFC_PAUSE_Z_MM = Number(
  (NFC_FLOOR_MM + NFC_CAVITY_HEIGHT_MM).toFixed(2),
);

/**
 * Губа над полостью, мм.
 *
 * Узкое кольцо, которое печатается после паузы: оно сужает мост с 29 до 22 мм и
 * физически не даёт метке выпасть из полости, даже если она не приклеена.
 */
const NFC_LIP_MM = 0.4;

/** Радиус отверстия в губе, мм — Ø22: метка Ø26 проходит только в полость. */
const NFC_LIP_HOLE_RADIUS_MM = 11;

/** Низ крышки, мм: губа кончилась, дальше сплошной пластик до лица. */
const NFC_LID_START_Z_MM = Number((NFC_PAUSE_Z_MM + NFC_LIP_MM).toFixed(2));

/**
 * Толщина, ниже которой карман не режется, мм.
 *
 * Дно 0.6 + полость 1.2 + губа 0.4 + крышка 0.8: тоньше крышка над меткой
 * прогибается пальцем и трескается по слоям.
 */
const NFC_BLOCK_THICKNESS_MM = 3;

/** Толщина, до которой крышка тоньше нормы 1.1 мм: карман идёт «впритык», мм. */
const NFC_TIGHT_THICKNESS_MM = 3.3;

/** Перекрытие соседних полос тела, мм: слайсер не видит щели между ними. */
const NFC_JOIN_MM = 0.05;

/**
 * Сдвиг кармана вниз у QR-визитки с креплением «отверстие», мм.
 *
 * Отверстие Ø5 мм занимает верхнюю часть тела, поэтому круг опускается на 2.2 мм:
 * иначе он подрезал бы стенку кольца. У проушины сверху карман стоит выше.
 */
const QR_CARD_NFC_HOLE_SHIFT_MM = 2.2;

/**
 * Раскладка кармана под NFC-метку: четыре зоны по Z.
 *
 * Деталь с меткой устроена как слоёный пирог, и все числа ниже — границы зон:
 *
 * 1. `0 … floorMm` — сплошное дно: силуэт целиком, снизу карман закрыт;
 * 2. `floorMm … pauseZ` — полость Ø29 мм: сюда падает метка;
 * 3. `pauseZ … lidStartZ` — губа с отверстием Ø22 мм: она держит метку;
 * 4. `lidStartZ … thickness` — сплошная крышка над меткой.
 */
export type KeychainNfcLayout = {
  /** Карман действительно вырезается: флаг включён и пресет его держит. */
  enabled: boolean;
  /** Почему кармана не будет: пресет не держит метку или основа тонкая. */
  blockedReason: string | null;
  /**
   * Почему боковое отверстие не уживается с полостью, null — уживается.
   *
   * Считается по тем же центрам, что строит геометрия: `sideHoleCenter` и
   * `pocketY`. В минус — круг отверстия заходит в полость, и карман тогда не
   * режется: метка легла бы в дырку от кольца. Причина не отменяет позицию в
   * состоянии, а объясняет, что выбрать: `center` или `none`.
   *
   * У нынешних пресетов это страховка, а не рабочий режим: у Apple Tag полость
   * перестаёт вписываться в силуэт уже при высоте 37 мм, а зазор уходит в минус
   * только на 30–32 мм, где карман всё равно не режется и выше в очереди стоит его
   * собственная причина. Проверка держит инвариант «метка не лежит в отверстии»,
   * чтобы новая позиция или новый пресет не собрали такую модель молча.
   */
  holeConflictReason: string | null;
  /** Центр кармана по Y, мм; null — у пресета кармана нет вовсе. */
  pocketY: number | null;
  /** Радиус полости по контуру, мм. */
  radiusMm: number;
  /** Сплошное дно от нижней грани, мм. */
  floorMm: number;
  /** Высота полости, мм. */
  cavityHeightMm: number;
  /** Высота губы над полостью, мм. */
  lipMm: number;
  /** Радиус отверстия в губе, мм: метка через него не проходит. */
  lipRadiusMm: number;
  /** Верх полости: на нём ставится пауза M600, мм. */
  pauseZ: number;
  /** Низ крышки, мм. */
  lidStartZ: number;
  /** Пластик над полостью, мм. */
  lidMm: number;
  /**
   * Стенка от полости до кромки силуэта, мм.
   *
   * Отрицательная — полость вылезает за силуэт, карман не режется. Меньше
   * `NFC_WALL_MIN_MM` — деталь печатается, но метка садится впритык.
   */
  wallMm: number;
  /**
   * Почему карман идёт впритык: тонкая стенка или тонкая крышка, null — норма.
   *
   * Карман при этом режется: панель показывает жёлтую плашку вместо зелёной.
   * Отдельная строка, а не флаг: пользователю нужна цифра, которая не сошлась с
   * нормой, — «стенка 1.1 мм» читается, «впритык» нет.
   */
  tightReason: string | null;
};

/** Число без хвостовых нулей для текстов панели и API: 1.1, 0.9, 32. */
function nfcMmLabel(value: number, digits = 2): string {
  return Number(value.toFixed(digits)).toString();
}

/**
 * Стенка от полости кармана до кромки силуэта, мм.
 *
 * Полость стоит по центру ширины, поэтому ближайшая кромка — боковая или
 * верхняя/нижняя: стенка считается по осям X и Y, скругления углов не в счёт
 * (при полости Ø29 в центральной полосе радиус 4–8 мм от неё дальше, чем кромка).
 * Низ кармана отдельно: центр смещён на `nfcPocketY`, и у Apple Tag карман
 * опущен на 3.7 мм — там стенка и самая тонкая.
 *
 * Габарит берётся в профиле, то есть меньше слайдера на фаску: полость и губа
 * режутся полосами без фаски, их силуэт — это контур крышки
 * (`PRESET_BEVEL_SIZE_MM`, у визитки та же фаска в своём модуле), а не заготовка.
 *
 * Отрицательное значение означает, что полость вылезает за силуэт.
 */
function nfcWallMm(width: number, height: number, pocketY: number): number {
  const halfWidth = Math.max(width - PRESET_BEVEL_SIZE_MM * 2, 1) / 2;
  const halfHeight = Math.max(height - PRESET_BEVEL_SIZE_MM * 2, 1) / 2;
  const sideMm = halfWidth - NFC_POCKET_RADIUS_MM;
  const alongMm = halfHeight - Math.abs(pocketY) - NFC_POCKET_RADIUS_MM;

  return Number(Math.min(sideMm, alongMm).toFixed(2));
}

/**
 * Раскладка кармана под NFC-метку для пресета.
 *
 * Единственный источник правды для геометрии и панели: границы зон, «пауза на
 * Z = 1.8» и причины берутся здесь, поэтому подсказка не может разойтись с
 * моделью. Проверок три — пресет, силуэт и толщина:
 *
 * - карман есть только у пресетов с `nfcPocketY` (Apple Tag, Brick, QR-визитка);
 * - в силуэт должна вписаться полость вместе с зазором `NFC_WALL_MIN_MM`: у
 *   заготовки узкая сторона не меньше `2 × (radius + зазор) = 32` мм, а у
 *   профиля — стенка не в минус (карман смещён по Y, поэтому вторая проверка
 *   режет и по высоте: у Apple Tag уже при 34 мм карман вылезает за низ);
 * - лицо должно быть не тоньше `NFC_BLOCK_THICKNESS_MM`, а у гравированной
 *   визитки — на 0.3 мм больше: плита лица снимает эту толщину с тела.
 *
 * Тонкая стенка и тонкая крышка карман не отменяют: они уходят в `tightReason`,
 * по которому панель показывает жёлтую плашку вместо зелёной. Стенка в профиле
 * на фаску тоньше, чем обещает заготовка: у Apple Tag 3.4 мм, у Brick 32 мм —
 * 1.1, у компактной визитки с отверстием — 0.9.
 */
export function nfcLayout(
  presetId: KeychainPresetId,
  params: KeychainPresetGeometryParams,
): KeychainNfcLayout {
  const preset = keychainPresetById(presetId);
  const qr = params.qr ?? null;
  const basePocketY = preset.nfcPocketY ?? null;
  const pocketY =
    basePocketY === null
      ? null
      : presetId === "qr-card" && qr?.tab === "hole"
        ? basePocketY - QR_CARD_NFC_HOLE_SHIFT_MM
        : basePocketY;
  // Гравировка снимает 0.3 мм с лица, но зоны кармана отсчитываются от нижней
  // грани, поэтому пороги толщины у такой визитки выше на ту же величину.
  const reliefMm = qr?.mode === "engraved" ? QR_ENGRAVED_DEPTH_MM : 0;
  const faceThicknessMm = Number((params.thickness - reliefMm).toFixed(2));
  const thicknessMm = params.thickness.toFixed(1);
  const blockThicknessMm = (NFC_BLOCK_THICKNESS_MM + reliefMm).toFixed(1);
  const tightThicknessMm = (NFC_TIGHT_THICKNESS_MM + reliefMm).toFixed(1);
  // Крышка на пороге и по норме: 3 и 3.3 мм лица дают 0.8 и 1.1 мм пластика.
  const minLidMm = (NFC_BLOCK_THICKNESS_MM - NFC_LID_START_Z_MM).toFixed(1);
  const normLidMm = (NFC_TIGHT_THICKNESS_MM - NFC_LID_START_Z_MM).toFixed(1);
  const reliefNote =
    reliefMm > 0 ? ` + гравировка ${QR_ENGRAVED_DEPTH_MM}` : "";
  const lidMm = Math.max(
    0,
    Number((faceThicknessMm - NFC_LID_START_Z_MM).toFixed(2)),
  );
  // Стенка и порог вписывания. Порог считается по заготовке из слайдеров —
  // полость плюс зазор должны уложиться в половину узкой стороны, — а стенка по
  // профилю: он меньше заготовки на фаску, поэтому ровно 32 мм узкой стороны
  // дают 1.1 мм пластика и жёлтую плашку, а не блок.
  const wallMm =
    pocketY === null ? 0 : nfcWallMm(params.width, params.height, pocketY);
  const fitNeedMm = (NFC_POCKET_RADIUS_MM + NFC_WALL_MIN_MM) * 2;
  const narrowMm = Math.min(params.width, params.height);
  const sizeLabel = `${nfcMmLabel(params.width, 1)}×${nfcMmLabel(params.height, 1)}`;

  // Стенка в минус — полость вылезает за силуэт: у кармана смещённый центр, и
  // узкой стороны мало, чтобы поймать ещё и низ (Apple Tag при высоте 34 мм).
  // Боковое отверстие проверяется последним: сначала карман должен вписаться в
  // силуэт, и только потом обсуждается, мешает ли ему отверстие. Иначе брелок
  // 38 × 30 мм получил бы совет про отверстие вместо «увеличьте высоту».
  const sideHole = sideHoleCenter(presetId, params);
  const holeClearanceMm =
    sideHole === null || pocketY === null
      ? null
      : Number(
          (
            Math.hypot(sideHole.x, sideHole.y - pocketY) -
            NFC_POCKET_RADIUS_MM -
            RING_HOLE_DIAMETER_MM / 2
          ).toFixed(2),
        );
  const holeSideLabel =
    holeClearanceMm === null || sideHole === null
      ? ""
      : sideHole.x < 0
        ? "слева"
        : "справа";
  const holeConflictReason =
    holeClearanceMm !== null && holeClearanceMm < 0
      ? `При NFC полость Ø${nfcMmLabel(NFC_POCKET_RADIUS_MM * 2, 1)} мм перекрывает отверстие Ø${nfcMmLabel(RING_HOLE_DIAMETER_MM, 0)} мм ${holeSideLabel}: зазор ${nfcMmLabel(holeClearanceMm)} мм. Оставьте center или none.`
      : null;
  const blockedReason =
    pocketY === null
      ? "Этот пресет не поддерживает NFC-карман."
      : wallMm < 0 || narrowMm < fitNeedMm - 1e-6
        ? `Полость Ø${nfcMmLabel(NFC_POCKET_RADIUS_MM * 2, 1)} мм не вписывается в силуэт ${sizeLabel} мм: нужно минимум ${nfcMmLabel(fitNeedMm, 1)}×${nfcMmLabel(fitNeedMm, 1)} мм для радиуса ${nfcMmLabel(NFC_POCKET_RADIUS_MM, 1)} и зазора ${nfcMmLabel(NFC_WALL_MIN_MM, 1)}.`
        : faceThicknessMm <= NFC_BLOCK_THICKNESS_MM + 1e-6
          ? `Толщина ${thicknessMm} мм: для кармана нужно минимум ${blockThicknessMm} мм (сплошное дно ${NFC_FLOOR_MM} + полость ${NFC_CAVITY_HEIGHT_MM} + губа ${NFC_LIP_MM} + крышка ${minLidMm}${reliefNote}), а с запасом — от ${tightThicknessMm} мм, где крышка ${normLidMm} мм.`
          : holeConflictReason;

  // Жёлтая плашка: карман режется, но на пределе. Причины могут сойтись —
  // тонкая стенка и тонкая крышка сразу, — тогда обе идут в одну строку, чтобы
  // панель не выбирала, какую из них показать.
  const tightReasons: string[] = [];

  if (pocketY !== null && wallMm < NFC_WALL_MIN_MM) {
    tightReasons.push(
      `Стенка ${nfcMmLabel(wallMm)} мм, метка Ø${nfcMmLabel(NFC_TAG_RADIUS_MM * 2, 0)} впритык.`,
    );
  }

  if (
    pocketY !== null &&
    faceThicknessMm > NFC_BLOCK_THICKNESS_MM + 1e-6 &&
    faceThicknessMm < NFC_TIGHT_THICKNESS_MM - 1e-6
  ) {
    tightReasons.push(
      `Крышка ${nfcMmLabel(lidMm)} мм вместо нормы ${normLidMm} мм.`,
    );
  }

  // Зазор между боковым отверстием и полостью: в плюс, но тоньше нормы — деталь
  // печатается, метка встаёт рядом с кольцом, и пластик между ними прогибается.
  if (
    holeClearanceMm !== null &&
    holeClearanceMm >= 0 &&
    holeClearanceMm < NFC_WALL_MIN_MM
  ) {
    tightReasons.push(
      `Между отверстием и полостью ${nfcMmLabel(holeClearanceMm)} мм пластика, впритык.`,
    );
  }

  return {
    enabled: Boolean(params.nfcEnabled) && blockedReason === null,
    blockedReason,
    holeConflictReason,
    pocketY,
    radiusMm: NFC_POCKET_RADIUS_MM,
    floorMm: NFC_FLOOR_MM,
    cavityHeightMm: NFC_CAVITY_HEIGHT_MM,
    lipMm: NFC_LIP_MM,
    lipRadiusMm: NFC_LIP_HOLE_RADIUS_MM,
    pauseZ: NFC_PAUSE_Z_MM,
    lidStartZ: NFC_LID_START_Z_MM,
    lidMm,
    wallMm,
    tightReason:
      blockedReason === null && tightReasons.length > 0
        ? tightReasons.join(" ")
        : null,
  };
}

/**
 * Круг кармана в контуре, обход по часовой стрелке — как у `ringHolePath`.
 *
 * Радиус берётся как есть, без добавки на фаску: полость и губа выдавливаются
 * полосами без фаски, поэтому круг в слайсере выходит ровно `radius`. По этому же
 * вызову строится и отверстие губы — отличается только радиус.
 */
function nfcHolePath(centerY: number, radius: number): Path {
  const hole = new Path();

  hole.absarc(0, centerY, radius, 0, Math.PI * 2, true);

  return hole;
}

/**
 * Копия контура с независимыми дырками.
 *
 * `ExtrudeGeometry` читает `shape.curves` и `shape.holes` при каждом вызове,
 * поэтому задний слой получает свою копию с карманом: иначе круг попал бы и в
 * сплошную крышку, и карман вышел бы сквозным.
 */
function cloneShape(shape: Shape): Shape {
  const copy = new Shape();

  copy.autoClose = shape.autoClose;
  copy.curves = shape.curves.map((curve) => curve.clone());
  copy.holes = shape.holes.map((hole) => {
    const path = new Path();

    path.autoClose = hole.autoClose;
    path.curves = hole.curves.map((curve) => curve.clone());

    return path;
  });

  return copy;
}

/**
 * Основа пресета: сплошная плита или тело с запечатанной полостью под метку.
 *
 * Без кармана контур выдавливается на всю толщину одной оболочкой. С карманом
 * тело собирается из четырёх полос по Z — дно, полость, губа, крышка:
 *
 * 1. `0 … floorMm` — силуэт целиком с фаской по кромкам полосы: снизу деталь
 *    закрыта, метка лежит на пластике;
 * 2. `floorMm … pauseZ` — силуэт с кругом Ø29: полость, куда падает метка;
 * 3. `pauseZ … lidStartZ` — силуэт с кругом Ø22: губа, она держит метку и сужает
 *    мост над полостью до кольца 3.5 мм;
 * 4. `lidStartZ … thickness` — силуэт целиком: крышка над меткой.
 *
 * Полость и губа выдавливаются без фаски (`extrudePresetBand`), иначе three.js
 * поджимает круг на середине полосы и стенка выходит наклонной. Дно и крышка
 * остаются с фаской: их кромки — это внешние грани детали.
 *
 * Полосы перекрываются на `NFC_JOIN_MM`, поэтому щели между ними нет: слайсер
 * объединяет пересекающиеся оболочки, а полость остаётся замкнутой — сплошное
 * дно снизу и крышка сверху.
 */
function extrudePresetBody(
  shape: Shape,
  params: KeychainPresetGeometryParams,
  nfc: KeychainNfcLayout,
): BufferGeometry {
  if (!nfc.enabled || nfc.pocketY === null) {
    return extrudePresetShape(shape, params.thickness);
  }

  const cavityShape = cloneShape(shape);

  cavityShape.holes.push(nfcHolePath(nfc.pocketY, nfc.radiusMm));

  const lipShape = cloneShape(shape);

  lipShape.holes.push(nfcHolePath(nfc.pocketY, nfc.lipRadiusMm));

  const parts: BufferGeometry[] = [
    extrudePresetLayer(shape, 0, nfc.floorMm),
    extrudePresetBand(
      cavityShape,
      nfc.floorMm - NFC_JOIN_MM,
      nfc.cavityHeightMm + NFC_JOIN_MM * 2,
    ),
    extrudePresetBand(lipShape, nfc.pauseZ, nfc.lipMm + NFC_JOIN_MM),
    extrudePresetLayer(
      shape,
      nfc.lidStartZ,
      params.thickness - nfc.lidStartZ,
    ),
  ];

  const body = mergeGeometries(parts);

  for (const part of parts) {
    part.dispose();
  }

  if (!body) {
    throw new Error("Не удалось собрать тело с полостью под NFC-метку");
  }

  body.computeBoundingBox();
  body.computeBoundingSphere();

  return body;
}

/**
 * Скруглённый прямоугольник с отверстием под кольцо — пресет Apple Tag.
 *
 * Корпус — прямоугольник `width × height` со скруглением 4 мм и отверстием
 * Ø5 мм в 5 мм от верхнего края: отдельное ушко не нужно, кольцо проходит сквозь
 * корпус, и брелок не цепляется ушком за ключи. Отверстие вырезано через
 * `shape.holes`, поэтому оно сквозное на всю толщину.
 *
 * Позиция отверстия приходит из `holePlacements`: `center` — по оси, `left` и
 * `right` — те же 5 мм от верхнего края, но со сдвигом 8 мм к боковой кромке,
 * `none` — отверстия нет вовсе. `tab` ещё не реализована и пока строит центр.
 *
 * Толщина держится ровно по слайдеру: выдавливание идёт на
 * `thickness − 2 × bevelThickness`, а сдвиг на `bevelThickness` ставит нижнюю
 * грань на Z = 0 — так же, как у старой геометрии.
 *
 * С включённым NFC-карманом (`nfcLayout`) основа собирается из четырёх полос:
 * сплошное дно, полость Ø29 мм, губа с отверстием Ø22 мм и крышка над меткой.
 */
export function buildAppleTag(
  params: KeychainPresetGeometryParams,
): BufferGeometry {
  const bevel = PRESET_BEVEL_SIZE_MM;
  // Профиль Shape — это контур крышки: фаска раздвигает его на bevel наружу.
  const profileWidth = Math.max(params.width - bevel * 2, 1);
  const profileHeight = Math.max(params.height - bevel * 2, 1);
  const radius = Math.min(
    APPLE_TAG_CORNER_RADIUS_MM,
    Math.min(profileWidth, profileHeight) / 2,
  );
  const halfWidth = profileWidth / 2;
  const halfHeight = profileHeight / 2;

  const shape = new Shape();

  shape.moveTo(-halfWidth + radius, -halfHeight);
  shape.lineTo(halfWidth - radius, -halfHeight);
  shape.absarc(
    halfWidth - radius,
    -halfHeight + radius,
    radius,
    -Math.PI / 2,
    0,
    false,
  );
  shape.lineTo(halfWidth, halfHeight - radius);
  shape.absarc(
    halfWidth - radius,
    halfHeight - radius,
    radius,
    0,
    Math.PI / 2,
    false,
  );
  shape.lineTo(-halfWidth + radius, halfHeight);
  shape.absarc(
    -halfWidth + radius,
    halfHeight - radius,
    radius,
    Math.PI / 2,
    Math.PI,
    false,
  );
  shape.lineTo(-halfWidth, -halfHeight + radius);
  shape.absarc(
    -halfWidth + radius,
    -halfHeight + radius,
    radius,
    Math.PI,
    Math.PI * 1.5,
    false,
  );
  shape.closePath();

  // Отверстие ставится по выбранной позиции: центр, сдвиг к кромке или без
  // отверстия вовсе. Центр отсчитывается от номинального габарита, а не от
  // контура крышки: панель обещает 5 мм от края заготовки.
  const hole = presetRingHole(
    "apple-tag",
    params,
    params.height / 2 - APPLE_TAG_RING_HOLE_INSET_MM,
  );

  if (hole) {
    shape.holes.push(hole);
  }

  return extrudePresetBody(shape, params, nfcLayout("apple-tag", params));
}

/**
 * Капсула с торцами-полукругами и отверстием под кольцо — пресет Capsule.
 *
 * Корпус — прямоугольник `width × height`, у которого верх и низ заменены
 * полукругами радиусом в половину ширины: при 24 × 64 мм это два торца по
 * 12 мм и прямая стенка 40 мм между ними. Углов у такой формы нет, поэтому она
 * не цепляется за ключи и печатается без поддержек.
 *
 * Отверстие Ø5 мм стоит на оси симметрии (X = 0) в 8 мм от верхнего края. Центр
 * верхнего полукруга лежит ниже, поэтому кольцо целиком попадает в плоскую
 * часть торца, а стенка над ним ровная со всех сторон — это и держит прочность
 * ушка при узкой капсуле. Если ширина больше высоты, капсула ложится набок:
 * полукруги уходят на боковые торцы, а отверстие остаётся там же, где обещает
 * панель — по центру и в 8 мм от верхнего края.
 */
export function buildCapsule(
  params: KeychainPresetGeometryParams,
): ExtrudeGeometry {
  const bevel = PRESET_BEVEL_SIZE_MM;
  // Профиль Shape — контур крышки: фаска раздвигает его на bevel наружу.
  const profileWidth = Math.max(params.width - bevel * 2, 1);
  const profileHeight = Math.max(params.height - bevel * 2, 1);
  const halfWidth = profileWidth / 2;
  const halfHeight = profileHeight / 2;
  // Радиус торца — половина ширины, но не больше половины высоты: при широкой
  // заготовке полукруги иначе наехали бы друг на друга.
  const radius = Math.min(halfWidth, halfHeight);
  const shape = new Shape();

  if (halfWidth <= halfHeight) {
    // Вертикальная капсула: торцы сверху и снизу, стенки идут по оси Y.
    // Выше этой точки контур уже закругляется: там начинается верхний торец.
    const topArcCenterY = halfHeight - radius;
    const bottomArcCenterY = -halfHeight + radius;

    shape.moveTo(halfWidth, bottomArcCenterY);
    shape.lineTo(halfWidth, topArcCenterY);
    // Полукруг по верхнему торцу: от правой стенки через верх к левой.
    shape.absarc(0, topArcCenterY, radius, 0, Math.PI, false);
    shape.lineTo(-halfWidth, bottomArcCenterY);
    // Полукруг по нижнему торцу: от левой стенки через низ обратно к правой.
    shape.absarc(0, bottomArcCenterY, radius, Math.PI, Math.PI * 2, false);
  } else {
    // Широкая заготовка: полукруги радиуса halfHeight уже не помещаются между
    // верхом и низом, поэтому капсула ложится набок — торцы слева и справа,
    // стенки параллельны оси X. Иначе контур вылезал бы за габарит.
    const rightArcCenterX = halfWidth - radius;
    const leftArcCenterX = -halfWidth + radius;

    shape.moveTo(leftArcCenterX, -halfHeight);
    shape.lineTo(rightArcCenterX, -halfHeight);
    shape.absarc(rightArcCenterX, 0, radius, -Math.PI / 2, Math.PI / 2, false);
    shape.lineTo(leftArcCenterX, halfHeight);
    shape.absarc(leftArcCenterX, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
  }

  shape.closePath();

  // Позиция `none` оставляет капсулу без ушка: отверстие не вырезается вовсе.
  const hole = presetRingHole(
    "capsule",
    params,
    params.height / 2 - RING_HOLE_INSET_MM,
  );

  if (hole) {
    shape.holes.push(hole);
  }

  return extrudePresetShape(shape, params.thickness);
}

/** Точка контура в плоскости XY, мм. */
type ShapePoint = readonly [number, number];

/** Точка на окружности радиуса `radius` под углом `angle` (радианы), мм. */
function polarPoint(radius: number, angle: number): ShapePoint {
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

/** Единичный вектор из `from` в `to`: направление ребра без длины. */
function unitVector(from: ShapePoint, to: ShapePoint): ShapePoint {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);

  if (length === 0) {
    return [0, 0];
  }

  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
}

/**
 * Расстояние от точки до отрезка, мм.
 *
 * Нужно для стенки кольца: отверстие стоит в теле, и ближайшая кромка — это не
 * обязательно впадина, а ребро луча, идущее к кончику. Параметр проекции
 * зажимается в [0, 1], иначе для точки «за» концом отрезка считалась бы высота
 * треугольника, а не расстояние до кромки.
 */
function distanceToSegment(
  pointX: number,
  pointY: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number {
  const edgeX = toX - fromX;
  const edgeY = toY - fromY;
  const lengthSquared = edgeX * edgeX + edgeY * edgeY;
  const projection =
    lengthSquared > 0
      ? Math.min(
          Math.max(
            ((pointX - fromX) * edgeX + (pointY - fromY) * edgeY) /
              lengthSquared,
            0,
          ),
          1,
        )
      : 0;

  return Math.hypot(
    pointX - (fromX + edgeX * projection),
    pointY - (fromY + edgeY * projection),
  );
}

/** Точка начала дуги скругления по её центру, радиусу и углу, мм. */
function arcStart(
  center: ShapePoint,
  radius: number,
  angle: number,
): ShapePoint {
  return [
    center[0] + radius * Math.cos(angle),
    center[1] + radius * Math.sin(angle),
  ];
}

/**
 * Точки, между которыми пройдёт скругление угла.
 *
 * Дуга радиуса `radius`, вписанная в угол с внутренним раствором θ, касается его
 * сторон на расстоянии `radius / tan(θ / 2)` от вершины, и такую же хорду даёт
 * квадратичная кривая с контрольной точкой в самом угле. Отсюда и формула: угол
 * скругляется одним `quadraticCurveTo`, без отдельной математики на дуги.
 * Половина смежной стороны — верхняя граница: у вытянутого шестигранника соседние
 * скругления иначе наехали бы друг на друга и контур пересёкся бы сам с собой.
 */
function cornerRoundPoints(
  corner: ShapePoint,
  previous: ShapePoint,
  next: ShapePoint,
  radius: number,
): { from: ShapePoint; to: ShapePoint } {
  const toPrevious = [previous[0] - corner[0], previous[1] - corner[1]];
  const toNext = [next[0] - corner[0], next[1] - corner[1]];
  const previousLength = Math.hypot(toPrevious[0], toPrevious[1]);
  const nextLength = Math.hypot(toNext[0], toNext[1]);

  if (previousLength === 0 || nextLength === 0) {
    return { from: corner, to: corner };
  }

  // Раствор угла берётся через косинус: acos устойчив и там, где вытянутый
  // шестигранник ушёл от 120°.
  const cosine =
    (toPrevious[0] * toNext[0] + toPrevious[1] * toNext[1]) /
    (previousLength * nextLength);
  const halfAngle = Math.acos(Math.min(Math.max(cosine, -1), 1)) / 2;
  const cut = Math.min(
    radius / Math.tan(halfAngle),
    previousLength / 2,
    nextLength / 2,
  );

  return {
    from: [
      corner[0] + (toPrevious[0] / previousLength) * cut,
      corner[1] + (toPrevious[1] / previousLength) * cut,
    ],
    to: [
      corner[0] + (toNext[0] / nextLength) * cut,
      corner[1] + (toNext[1] / nextLength) * cut,
    ],
  };
}

/**
 * Насколько скругление отступает от самой вершины по вертикали, мм.
 *
 * Квадратичная кривая до вершины не доходит: её крайняя точка — среднее
 * `(A + 2V + B) / 4`, где A и B — концы скругления, а V — сам угол. Эта величина
 * и решает габарит шестигранника: сверху и снизу крайние точки — вершины.
 */
function cornerApexInset(
  corner: ShapePoint,
  previous: ShapePoint,
  next: ShapePoint,
  radius: number,
): number {
  const round = cornerRoundPoints(corner, previous, next, radius);

  return corner[1] - (round.from[1] + corner[1] * 2 + round.to[1]) / 4;
}

/** Шесть углов шестигранника против часовой стрелки, начиная с верхнего. */
function hexCorners(halfWidth: number, halfHeight: number): ShapePoint[] {
  return [
    [0, halfHeight],
    [-halfWidth, halfHeight / 2],
    [-halfWidth, -halfHeight / 2],
    [0, -halfHeight],
    [halfWidth, -halfHeight / 2],
    [halfWidth, halfHeight / 2],
  ];
}

/**
 * Контур многоугольника с углами, скруглёнными квадратичными кривыми.
 *
 * Общий шаг для шестигранника и кирпича: углы обходятся против часовой стрелки,
 * каждый угол даёт одну кривую с контрольной точкой в самой вершине, между
 * углами остаются прямые грани. Точки касания считает `cornerRoundPoints`,
 * поэтому скругление само ужимается на вытянутом контуре и не пересекает
 * соседнее.
 */
function roundedPolygonShape(
  corners: readonly ShapePoint[],
  radius: number,
): Shape {
  const rounds = corners.map((corner, index) =>
    cornerRoundPoints(
      corner,
      corners[(index + corners.length - 1) % corners.length],
      corners[(index + 1) % corners.length],
      radius,
    ),
  );
  const shape = new Shape();

  shape.moveTo(rounds[0].from[0], rounds[0].from[1]);

  rounds.forEach((round, index) => {
    shape.quadraticCurveTo(
      corners[index][0],
      corners[index][1],
      round.to[0],
      round.to[1],
    );
    // Угол закругляется кривой, а между углами идёт прямая грань.
    if (index < rounds.length - 1) {
      const nextRound = rounds[index + 1];

      shape.lineTo(nextRound.from[0], nextRound.from[1]);
    }
  });
  shape.closePath();

  return shape;
}

/**
 * Шестигранник со скруглёнными углами и отверстием под кольцо — пресет Hex.
 *
 * Острые вершины смотрят вверх и вниз, бока — две вертикальные стенки: так
 * шестигранник точно ложится в габарит `width × height` из слайдеров. При
 * 34 × 40 он отличается от правильного на доли градуса (у правильного высота
 * равна `width × 2 / √3` = 39.3 мм), а на крайних значениях просто растягивается.
 * Углы скруглены на 2 мм: острых кромок в кармане не остаётся, и кольцо не
 * прорезает ушко насквозь.
 *
 * Отверстие Ø5 мм стоит на оси симметрии в 8 мм от верхнего края. Верх здесь —
 * угол, а не прямая кромка, поэтому мало отступить от вершины: важно, что
 * расстояние до двух наклонных граней (около 7.2 мм при 34 × 40) оставляет над
 * кольцом стенку 4.7 мм, и ушко не рвётся при ключах. На самом узком соотношении
 * габарита (50 × 100) стенка проседает до 3.7 мм — это всё ещё втрое толще стенки
 * сопла 0.4 мм.
 */
export function buildHex(params: KeychainPresetGeometryParams): ExtrudeGeometry {
  const bevel = PRESET_BEVEL_SIZE_MM;
  // Профиль Shape — контур крышки: фаска раздвигает его на bevel наружу.
  const halfWidth = Math.max(params.width - bevel * 2, 1) / 2;
  // Ширину задают вертикальные стенки, а высоту — вершины, и скругление срезает
  // как раз их. Поэтому углы ставятся дальше на это срезание: иначе после фаски
  // высота вышла бы меньше слайдера почти на 0.6 мм. Срезание зависит от
  // раствора угла, а тот — от самой полувысоты, поэтому поправка уточняется в
  // три прохода: она меняется в десятки раз медленнее себя, и остаток уходит в
  // тысячные доли миллиметра.
  const apexHalfHeight = Math.max(params.height - bevel * 2, 1) / 2;
  let corners = hexCorners(halfWidth, apexHalfHeight);

  for (let pass = 0; pass < 3; pass += 1) {
    const inset = cornerApexInset(
      corners[0],
      corners[corners.length - 1],
      corners[1],
      HEX_CORNER_RADIUS_MM,
    );

    corners = hexCorners(halfWidth, apexHalfHeight + inset);
  }

  const shape = roundedPolygonShape(corners, HEX_CORNER_RADIUS_MM);

  // Шестигранник держит только центр и `none`: боковой позиции у него в реестре
  // нет, и нормализация не пустит её дальше параметров.
  const hole = presetRingHole(
    "hex",
    params,
    params.height / 2 - RING_HOLE_INSET_MM,
  );

  if (hole) {
    shape.holes.push(hole);
  }

  return extrudePresetShape(shape, params.thickness);
}

/**
 * Сколько шипов встаёт по стороне `dimension` при шаге 8 мм.
 *
 * Сетка отступает от кромки на половину шага, поэтому крайний шип стоит в 4 мм
 * от края и в 1.6 мм от кромки — так же, как у настоящей детали. Это и есть
 * `floor((dimension − 8) / 8) + 1`: «+1» — первый шип, «−8» — два отступа.
 */
function brickStudLineCount(dimension: number): number {
  return Math.max(
    1,
    Math.floor((dimension - BRICK_STUD_PITCH_MM) / BRICK_STUD_PITCH_MM) + 1,
  );
}

/** Раскладка шипов на кирпиче: сколько их и как они стоят. */
export type BrickStudLayout = {
  /** Шипов поперёк ширины. */
  columns: number;
  /** Рядов по высоте; верхний ряд снят под отверстие. */
  rows: number;
  /** Всего шипов. */
  total: number;
};

/**
 * Раскладка шипов для габарита — общая для геометрии и подписи в панели.
 *
 * Верхний ряд снимается всегда: отверстие Ø5 мм стоит в 8 мм от верхнего края,
 * то есть как раз в полосе верхнего ряда. У 32 × 64 шипы этого ряда проходят в
 * 5.66 мм от центра отверстия при сумме радиусов 4.85 мм и кольцо не задевают —
 * ряд снимается ради гладкой полосы под кольцо. Зато при 50 × 100 и 20 × 30
 * тот же шип подходит на 4.47 и 4.12 мм и врезался бы в отверстие.
 */
export function brickStudLayout(width: number, height: number): BrickStudLayout {
  const columns = brickStudLineCount(width);
  const rows = Math.max(brickStudLineCount(height) - 1, 1);

  return { columns, rows, total: columns * rows };
}

/**
 * Центры шипов, мм: сетка от центра габарита, без верхнего ряда.
 *
 * Ряды после снятия не пересчитываются: сетка остаётся на своей высоте, сверху
 * освобождается полоса. Иначе шипы съехали бы к отверстию и потеряли шаг 8 мм
 * относительно соседних деталей.
 */
function brickStudCenters(width: number, height: number): ShapePoint[] {
  const { columns, rows } = brickStudLayout(width, height);
  const startX = -((columns - 1) * BRICK_STUD_PITCH_MM) / 2;
  const startY = -((brickStudLineCount(height) - 1) * BRICK_STUD_PITCH_MM) / 2;
  const centers: ShapePoint[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      centers.push([
        startX + column * BRICK_STUD_PITCH_MM,
        startY + row * BRICK_STUD_PITCH_MM,
      ]);
    }
  }

  return centers;
}

/**
 * Оболочка одного шипа: цилиндр Ø4.7 мм с фаской на верхней кромке.
 *
 * Шип собран из четырёх кусков — стенки, конуса фаски и двух донышек, — а не из
 * двух готовых цилиндров: у стопки цилиндров совпадающие диски остаются внутри
 * оболочки, и рёбра колец сходятся по три, то есть сетка перестаёт быть
 * watertight. Каждый кусок здесь замкнут, кольца соседних кусков совпадают по
 * вершинам, а низ шипа уходит в тело на `BRICK_STUD_EMBED_MM`.
 */
function brickStudGeometry(): BufferGeometry {
  const radius = BRICK_STUD_DIAMETER_MM / 2;
  const baseZ = -BRICK_STUD_EMBED_MM;
  // Фаска начинается на 0.5 мм ниже верха: цилиндрическая часть шипа — 1.2 мм.
  const wallTopZ = BRICK_STUD_HEIGHT_MM - BRICK_STUD_CHAMFER_MM;
  const wallHeight = wallTopZ - baseZ;
  const segments = PRESET_CURVE_SEGMENTS;
  // CylinderGeometry строится вдоль Y: поворот на 90° ставит ось шипа по Z.
  const wall = new CylinderGeometry(
    radius,
    radius,
    wallHeight,
    segments,
    1,
    true,
  );

  wall.rotateX(Math.PI / 2);
  wall.translate(0, 0, baseZ + wallHeight / 2);

  const chamfer = new CylinderGeometry(
    BRICK_STUD_TOP_RADIUS_MM,
    radius,
    BRICK_STUD_CHAMFER_MM,
    segments,
    1,
    true,
  );

  chamfer.rotateX(Math.PI / 2);
  chamfer.translate(0, 0, wallTopZ + BRICK_STUD_CHAMFER_MM / 2);

  // Донышки — плоские многоугольники: верхнее смотрит вверх, нижнее вниз.
  const top = new CircleGeometry(BRICK_STUD_TOP_RADIUS_MM, segments);

  top.translate(0, 0, BRICK_STUD_HEIGHT_MM);

  const bottom = new CircleGeometry(radius, segments);

  bottom.rotateX(Math.PI);
  bottom.translate(0, 0, baseZ);

  const pieces = [wall, chamfer, top, bottom];
  const merged = mergeGeometries(pieces);

  for (const piece of pieces) {
    piece.dispose();
  }

  if (!merged) {
    throw new Error("Не удалось собрать оболочку шипа кирпича");
  }

  // Тело кирпича выдавливается без индекса, поэтому и шип отдаётся без него.
  const stud = merged.toNonIndexed();

  merged.dispose();

  return stud;
}


/**
 * LEGO-кирпич с шипами и отверстием под кольцо — пресет Brick.
 *
 * Основа — прямоугольник `width × height` (по умолчанию 32 × 64, то есть плита
 * четыре на восемь), углы скруглены на 8 мм: у такой формы нет кромок, за
 * которые цепляются ключи, и она не колет ладонь в кармане.
 *
 * Сверху — шипы Ø4.7 мм, высота 1.7 мм, шаг 8 мм, фаска 0.5 мм по верхней
 * кромке. Шаг и высота взяты из стандарта LEGO, поэтому брелок стыкуется с
 * обычными деталями, а 32 × 64 — это ровно 4 × 8 шипов. Диаметр на 0.1 мм
 * меньше стандартного Ø4.8: FDM раздаёт пластик наружу на 0.05–0.15 мм, и
 * напечатанный шип в LEGO-отверстие уже не входит. Сетка считается от центра
 * габарита, верхний ряд снят под отверстие (`brickStudLayout`).
 *
 * Габарит от шипов не растёт: крайний шип стоит в 4 мм от кромки при радиусе
 * 2.35 мм, то есть до края остаётся 1.65 мм. Исключение — углы: у 32 × 64 шип в
 * углу выступает за дугу скругления на 0.6 мм и висит крошечным козырьком над
 * фаской. Это осознанная плата за честный шаг 8 мм: у настоящих деталей LEGO
 * углы квадратные, а брелок без скругления царапается в кармане.
 *
 * Компенсация габарита, как у шестигранника, здесь не нужна: крайние точки
 * прямоугольника — середины прямых сторон, и скругление их не трогает даже на
 * крайних значениях слайдеров (20 × 30): срез 8 мм меньше половины короткой
 * стороны профиля (9.6 мм), поэтому радиус не поджимается, а посередине
 * короткой стороны остаётся прямая грань 3.2 мм.
 *
 * Отверстие Ø5 мм — на оси симметрии в 8 мм от верхнего края, верхняя кромка
 * горизонтальная, поэтому пластик над кольцом всегда один и тот же: 4.7 мм у
 * крышек и 5.5 мм на середине толщины, при любом размере заготовки.
 *
 * NFC-карман (`nfcLayout`) собирает тело из четырёх полос и оставляет шипы
 * сверху: сплошное дно 0.6 мм, полость Ø29 мм, губа Ø22 мм и крышка. Метку
 * вкладывают в паузу на Z = 1.8 мм, после чего губа и крышка закрывают полость.
 */
export function buildBrick(
  params: KeychainPresetGeometryParams,
): BufferGeometry {
  const bevel = PRESET_BEVEL_SIZE_MM;
  // Профиль Shape — контур крышки: фаска раздвигает его на bevel наружу.
  const halfWidth = Math.max(params.width - bevel * 2, 1) / 2;
  const halfHeight = Math.max(params.height - bevel * 2, 1) / 2;
  const corners: ShapePoint[] = [
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
  ];

  const shape = roundedPolygonShape(corners, BRICK_CORNER_RADIUS_MM);

  // Шипы живут отдельными телами и позиции не касаются: `none` убирает только
  // отверстие в теле, ряд шипов над ним остаётся на месте.
  const hole = presetRingHole(
    "brick",
    params,
    params.height / 2 - RING_HOLE_INSET_MM,
  );

  if (hole) {
    shape.holes.push(hole);
  }

  const body = extrudePresetBody(shape, params, nfcLayout("brick", params));
  const stud = brickStudGeometry();
  const parts: BufferGeometry[] = [body];

  // Шип стоит на верхней грани: низ утоплен в тело, верх поднят на 1.7 мм.
  for (const [x, y] of brickStudCenters(params.width, params.height)) {
    parts.push(stud.clone().translate(x, y, params.thickness));
  }

  stud.dispose();

  const brick = mergeGeometries(parts);

  for (const part of parts) {
    part.dispose();
  }

  if (!brick) {
    throw new Error("Не удалось соединить кирпич и шипы");
  }

  brick.computeBoundingBox();
  brick.computeBoundingSphere();

  return brick;
}

/**
 * Щель перфорации: капсула 4 × 0.9 мм с закруглёнными торцами и центром в (x, y).
 *
 * Радиус и прямая часть больше номинала на фаску: на середине толщины three.js
 * поджимает отверстие на `bevelSize`, и без добавки щель в свету вышла бы
 * 0.1 × 3.2 мм вместо 0.9 × 4. Торцы скруглены на половину высоты, поэтому у
 * капсулы нет углов, в которых фаска сходится клином и ломает сетку.
 *
 * Обход по часовой стрелке — как у остальных отверстий: three.js сам приводит
 * дырки к обратному обходу, но одинаковое направление читается легче.
 */
function ticketSlotPath(x: number, y: number): Path {
  const radius = TICKET_SLOT_HEIGHT_MM / 2 + PRESET_BEVEL_SIZE_MM;
  // Половина прямой части: 4 − 0.9 = 3.1 мм, то есть по 1.55 мм от центра.
  const straight = (TICKET_SLOT_LENGTH_MM - TICKET_SLOT_HEIGHT_MM) / 2;
  const slot = new Path();

  slot.moveTo(x - straight, y + radius);
  slot.lineTo(x + straight, y + radius);
  // Правый торец: сверху вниз через крайнюю точку.
  slot.absarc(x + straight, y, radius, Math.PI / 2, -Math.PI / 2, true);
  slot.lineTo(x - straight, y - radius);
  // Левый торец: снизу вверх через крайнюю точку.
  slot.absarc(x - straight, y, radius, -Math.PI / 2, Math.PI / 2, true);
  slot.closePath();

  return slot;
}

/**
 * Билет с корешком снизу, пунктиром отрыва и проушиной — пресет Ticket.
 *
 * Корпус — прямоугольник `width × height` (28 × 60 по умолчанию) с углами,
 * скруглёнными на 4 мм, а сверху по центру выступает проушина-пятак Ø11 мм на
 * 4 мм: габарит по высоте поэтому на 4 мм больше слайдера. Отверстие под кольцо
 * Ø5 мм стоит в пятаке, то есть в целой части билета, а не в отрывной.
 *
 * Корешок — полоса у нижней кромки высотой 28 % длины (вилка 12–22 мм). По его
 * верхней границе идёт линия отрыва: щели-капсулы 4 × 0.9 мм с перемычкой
 * 2.6 мм, а на обеих боковых кромках — полукруглые вырезы R 2.5 мм. Вырезы и
 * делают линию отрыва линией: она выходит на кромку, как у бумажного билета, а
 * не обрывается в теле. Сквозные щели вместо бороздки выбраны по прочности:
 * перемычка 2.6 мм держит ключи, а «сэндвич» на толщине 2 мм оставил бы 0.8 мм
 * тела.
 *
 * Контур обходится против часовой стрелки и построен точными дугами `absarc`:
 * на радиусе 4 мм квадратичная кривая ушла бы от окружности, и угол выглядел бы
 * приплюснутым. Проушина — не отдельная оболочка, а часть того же контура:
 * дуга пятака подменяет собой участок верхней кромки, поэтому модель остаётся
 * одним `ExtrudeGeometry` без слияния геометрий и без CSG.
 *
 * Щели и отверстие под кольцо добавляются в `shape.holes`, поэтому они сквозные
 * на всю толщину, и каждая оболочка остаётся замкнутой. Тиснёной рамки по
 * контуру нет: канавка 0.5 мм — это второй уровень выдавливания, а надпись и
 * рамка подключутся отдельной задачей сразу для всех пресетов.
 */
export function buildTicket(
  params: KeychainPresetGeometryParams,
): ExtrudeGeometry {
  const bevel = PRESET_BEVEL_SIZE_MM;
  const layout = ticketLayout(params.width, params.height);
  // Профиль Shape — контур крышки: фаска раздвигает его на bevel наружу.
  const halfWidth = Math.max(params.width - bevel * 2, 1) / 2;
  const halfHeight = Math.max(params.height - bevel * 2, 1) / 2;
  // Скругление поджимается под половину габарита: на узкой заготовке углы иначе
  // наехали бы друг на друга.
  const corner = Math.min(TICKET_CORNER_RADIUS_MM, halfWidth, halfHeight);
  // Пятак проушины: радиус профиля меньше номинала на фаску, центр совпадает с
  // центром отверстия под кольцо.
  const tabRadius = TICKET_TAB_DIAMETER_MM / 2 - bevel;
  // Расстояние от центра пятака до верхней кромки профиля: 1.5 − 0.4 = 1.1 мм, то
  // есть над габаритом проушина поднимается ровно на 4 мм. Берётся из геометрии,
  // а не из номинала, чтобы дуга начиналась точно на кромке.
  const tabDrop = halfHeight - layout.ringY;
  // Полухорда, по которой дуга пятака пересекает верхнюю кромку: с неё начинается
  // проушина, и туда же контур возвращается с другой стороны.
  const tabChord = Math.sqrt(
    Math.max(tabRadius * tabRadius - tabDrop * tabDrop, 0),
  );
  const tabStartAngle = Math.atan2(tabDrop, tabChord);
  const tabEndAngle = Math.PI - tabStartAngle;
  const notchY = layout.perforationY;
  const shape = new Shape();

  // Обход против часовой стрелки: нижняя кромка слева направо, правая стенка с
  // вырезом, верхняя кромка через проушину, левая стенка с вырезом.
  shape.moveTo(-halfWidth + corner, -halfHeight);
  shape.lineTo(halfWidth - corner, -halfHeight);
  // Правый нижний угол: от нижней кромки к правой стенке.
  shape.absarc(
    halfWidth - corner,
    -halfHeight + corner,
    corner,
    -Math.PI / 2,
    0,
    false,
  );
  shape.lineTo(halfWidth, notchY - TICKET_NOTCH_RADIUS_MM);
  // Кромочный вырез: дуга уходит внутрь тела, поэтому в контуре она обходится по
  // часовой стрелке — материал остаётся снаружи выреза.
  shape.absarc(
    halfWidth,
    notchY,
    TICKET_NOTCH_RADIUS_MM,
    -Math.PI / 2,
    Math.PI / 2,
    true,
  );
  shape.lineTo(halfWidth, halfHeight - corner);
  // Правый верхний угол: от правой стенки к верхней кромке.
  shape.absarc(
    halfWidth - corner,
    halfHeight - corner,
    corner,
    0,
    Math.PI / 2,
    false,
  );
  // Верхняя кромка доходит до пятака и уступает ему место: дальше идёт дуга
  // проушины от правой точки пересечения через верх к левой.
  shape.lineTo(tabChord, halfHeight);
  shape.absarc(
    0,
    layout.ringY,
    tabRadius,
    tabStartAngle,
    tabEndAngle,
    false,
  );
  shape.lineTo(-halfWidth + corner, halfHeight);
  // Левый верхний угол.
  shape.absarc(
    -halfWidth + corner,
    halfHeight - corner,
    corner,
    Math.PI / 2,
    Math.PI,
    false,
  );
  shape.lineTo(-halfWidth, notchY + TICKET_NOTCH_RADIUS_MM);
  // Левый кромочный вырез: та же дуга внутрь тела, но стенка обходится вниз.
  shape.absarc(
    -halfWidth,
    notchY,
    TICKET_NOTCH_RADIUS_MM,
    Math.PI / 2,
    -Math.PI / 2,
    true,
  );
  shape.lineTo(-halfWidth, -halfHeight + corner);
  // Левый нижний угол: возврат к началу контура.
  shape.absarc(
    -halfWidth + corner,
    -halfHeight + corner,
    corner,
    Math.PI,
    Math.PI * 1.5,
    false,
  );
  shape.closePath();

  // Линия отрыва: каждая щель — отдельная дырка в контуре.
  for (const x of layout.slotXs) {
    shape.holes.push(ticketSlotPath(x, notchY));
  }

  // `none` убирает только отверстие Ø5 мм: проушина Ø11 мм остаётся частью
  // силуэта — она держит габарит по высоте, который обещает панель.
  const hole = presetRingHole("ticket", params, layout.ringY);

  if (hole) {
    shape.holes.push(hole);
  }

  return extrudePresetShape(shape, params.thickness);
}

/**
 * Вспышка из восьми лучей с отверстием под кольцо — пресет Starburst.
 *
 * Силуэт — звезда с шагом 45°, внешний радиус берётся по меньшей стороне
 * слайдера и ужимается на поле 2 мм: при 42 × 44 мм габарит выходит 38 × 38, а
 * разница сторон уходит в поле. Лучи разной длины по фиксированным множителям,
 * впадина лежит на 47 % радиуса, кончик скруглён на 0.8 мм, впадина на 1 мм:
 * угол при кончике выходит около 30°, поэтому луч держит форму, а не гнётся.
 *
 * Скругление кончика срезает вершину луча, поэтому вершина выносится за длину
 * луча на срезание: без этого габарит вышел бы меньше номинала почти на 2 мм.
 * Отверстие Ø5 мм стоит на оси верхнего луча со сдвигом к кончику: на 42 мм это
 * 1/3 луча, на малых размерах сдвиг поджимается, потому что луч там уже кольца
 * со стенками. Кольцо сквозное через `shape.holes` и упирается в ребро луча
 * стенкой не меньше 1.5 мм.
 */
export function buildStarburst(
  params: KeychainPresetGeometryParams,
): ExtrudeGeometry {
  const layout = starburstLayout(params.width, params.height);
  const rayCount = layout.rayCount;
  const pitch = (layout.pitchDeg * Math.PI) / 180;
  const tipRadii = layout.rays.map((ray) => ray.tipRadiusMm);
  const tips = layout.rays.map((ray, index) =>
    polarPoint(ray.apexRadiusMm, Math.PI / 2 + index * pitch),
  );
  const valleys = Array.from({ length: rayCount }, (_, index) =>
    polarPoint(layout.innerRadius, Math.PI / 2 + pitch / 2 + index * pitch),
  );
  // Скругление кончика — дуга, вписанная в угол между рёбрами: её центр лежит на
  // биссектрисе на расстоянии R / sin(θ / 2) от вершины, а разворот равен внешнему
  // углу луча, то есть 180° − θ. Радиус свой у каждого луча: скругления поджаты
  // под самое тесное ребро, а на коротком луче ребро короче.
  const arcs = tips.map((tip, index) => {
    const toPrevious = unitVector(
      tip,
      valleys[(index + rayCount - 1) % rayCount],
    );
    const toNext = unitVector(tip, valleys[index]);
    const cosine =
      toPrevious[0] * toNext[0] + toPrevious[1] * toNext[1];
    const halfAngle = Math.acos(Math.min(Math.max(cosine, -1), 1)) / 2;
    const distance = tipRadii[index] / Math.sin(halfAngle);
    const bisectorX = toPrevious[0] + toNext[0];
    const bisectorY = toPrevious[1] + toNext[1];
    const bisectorLength = Math.hypot(bisectorX, bisectorY);

    return {
      center: [
        tip[0] + (bisectorX / bisectorLength) * distance,
        tip[1] + (bisectorY / bisectorLength) * distance,
      ] as ShapePoint,
      startAngle:
        Math.atan2(toPrevious[1], toPrevious[0]) + Math.PI / 2,
      sweep: Math.PI - halfAngle * 2,
    };
  });
  // Впадина скругляется квадратичной кривой с контрольной точкой в самой
  // впадине: так же, как углы шестигранника, и без математики на вторую дугу.
  const valleyRounds = valleys.map((valley, index) =>
    cornerRoundPoints(
      valley,
      tips[index],
      tips[(index + 1) % rayCount],
      layout.valleyRadiusMm,
    ),
  );
  const shape = new Shape();
  const start = arcStart(arcs[0].center, tipRadii[0], arcs[0].startAngle);

  shape.moveTo(start[0], start[1]);

  // Обход против часовой стрелки: дуга кончика, ребро вниз к впадине, скругление
  // впадины, ребро к следующему кончику.
  for (let index = 0; index < rayCount; index += 1) {
    const arc = arcs[index];
    const round = valleyRounds[index];
    const nextArc = arcs[(index + 1) % rayCount];
    const nextRadius = tipRadii[(index + 1) % rayCount];
    const nextStart = arcStart(nextArc.center, nextRadius, nextArc.startAngle);

    shape.absarc(
      arc.center[0],
      arc.center[1],
      tipRadii[index],
      arc.startAngle,
      arc.startAngle + arc.sweep,
      false,
    );
    shape.lineTo(round.from[0], round.from[1]);
    shape.quadraticCurveTo(
      valleys[index][0],
      valleys[index][1],
      round.to[0],
      round.to[1],
    );
    shape.lineTo(nextStart[0], nextStart[1]);
  }
  shape.closePath();

  // Отверстие уезжает в верхний луч: X = 0, Y — из раскладки, где уже проверена
  // стенка до рёбер. Лучи от позиции не зависят: `none` оставляет их как есть.
  const hole = presetRingHole("starburst", params, layout.ringY);

  if (hole) {
    shape.holes.push(hole);
  }

  return extrudePresetShape(shape, params.thickness);
}

/** Кубическая Безье по точкам: `Shape` ждёт шесть чисел, а не пару точек. */
function bezierTo(
  shape: Shape,
  control1: ShapePoint,
  control2: ShapePoint,
  to: ShapePoint,
): void {
  shape.bezierCurveTo(
    control1[0],
    control1[1],
    control2[0],
    control2[1],
    to[0],
    to[1],
  );
}

/**
 * Контур сердца: две доли, скруглённая выемка между ними и скруглённый кончик.
 *
 * Обход против часовой стрелки, как у остальных пресетов: от левой точки стыка с
 * дугой кончика через низ вправо, затем по правой половине вверх к верхушке
 * доли, через дно выемки и обратно по левой половине.
 *
 * Все стыки гладкие по построению: дуга кончика переходит в нижнюю ветвь по
 * общей касательной, ветви доли подходят к верхушке горизонтально (поэтому
 * верхнюю кромку габарита держит верхушка), а усы Безье у дна выемки ставятся
 * вдоль её дуги.
 */
function heartShape(layout: HeartLayout): Shape {
  const tipHalf = layout.tipAngle / 2;
  const tipCenterY = layout.tipCenterY;
  const tipLeft = arcStart([0, tipCenterY], layout.tipRadiusMm, -Math.PI + tipHalf);
  const tipRight = arcStart([0, tipCenterY], layout.tipRadiusMm, -tipHalf);
  // Касательная к дуге кончика в правой точке стыка: ветвь уходит вверх-вправо
  // под `tipHalf` к вертикали, поэтому низ габарита держит дуга, а не излом.
  const tipTangent: ShapePoint = [Math.sin(tipHalf), Math.cos(tipHalf)];
  const shoulderRight: ShapePoint = [layout.halfWidthMm, layout.shoulderY];
  const shoulderLeft: ShapePoint = [-layout.halfWidthMm, layout.shoulderY];
  const lobeRight: ShapePoint = [layout.lobeTopX, layout.lobeTopY];
  const lobeLeft: ShapePoint = [-layout.lobeTopX, layout.lobeTopY];
  // Центр дуги дна выемки лежит выше дна: дно — её нижняя точка, поэтому
  // скругление входит в материал, а не выпирает бугром между долями.
  const valleyCenterY = layout.valleyY + layout.valleyRadiusMm;
  const valleyRightAngle = -Math.PI / 2 + layout.valleyJoinAngle;
  const valleyLeftAngle = -Math.PI / 2 - layout.valleyJoinAngle;
  const valleyRight = arcStart(
    [0, valleyCenterY],
    layout.valleyRadiusMm,
    valleyRightAngle,
  );
  const valleyLeft = arcStart(
    [0, valleyCenterY],
    layout.valleyRadiusMm,
    valleyLeftAngle,
  );
  // Направление касательной дна выемки в стыке: вправо-вниз и влево-вверх.
  const valleyCosine = Math.cos(layout.valleyJoinAngle);
  const valleySine = Math.sin(layout.valleyJoinAngle);
  // Правая нижняя ветвь: кончик → плечо.
  const lowerLength = Math.hypot(
    shoulderRight[0] - tipRight[0],
    shoulderRight[1] - tipRight[1],
  );
  const lowerShare = lowerLength * HEART_LOWER_TANGENT_SHARE;
  const lowerRightC1: ShapePoint = [
    tipRight[0] + lowerShare * tipTangent[0],
    tipRight[1] + lowerShare * tipTangent[1],
  ];
  const lowerRightC2: ShapePoint = [
    shoulderRight[0],
    shoulderRight[1] - lowerShare,
  ];
  // Внешняя часть правой доли: плечо → верхушка.
  const lobeLength = Math.hypot(
    lobeRight[0] - shoulderRight[0],
    lobeRight[1] - shoulderRight[1],
  );
  const lobeShare = lobeLength * HEART_BEZIER_TANGENT_SHARE;
  const outerRightC1: ShapePoint = [
    shoulderRight[0],
    shoulderRight[1] + lobeShare,
  ];
  const outerRightC2: ShapePoint = [
    lobeRight[0] + (shoulderRight[0] - lobeRight[0]) * HEART_LOBE_TANGENT_SHARE,
    lobeRight[1],
  ];
  // Внутренняя часть правой доли: верхушка → дно выемки.
  const innerLength = Math.hypot(
    valleyRight[0] - lobeRight[0],
    valleyRight[1] - lobeRight[1],
  );
  const innerShare = innerLength * HEART_BEZIER_TANGENT_SHARE;
  const innerRightC1: ShapePoint = [lobeRight[0] - innerShare, lobeRight[1]];
  const innerRightC2: ShapePoint = [
    valleyRight[0] + innerShare * valleyCosine,
    valleyRight[1] + innerShare * valleySine,
  ];
  // Левая половина — та же геометрия с обратным знаком X и обратным порядком:
  // первый ус левой ветви — это второй ус правой, и наоборот.
  const innerLeftC1: ShapePoint = [
    valleyLeft[0] - innerShare * valleyCosine,
    valleyLeft[1] + innerShare * valleySine,
  ];
  const innerLeftC2: ShapePoint = [lobeLeft[0] + innerShare, lobeLeft[1]];
  const outerLeftC1: ShapePoint = [
    lobeLeft[0] - (shoulderRight[0] - lobeRight[0]) * HEART_LOBE_TANGENT_SHARE,
    lobeLeft[1],
  ];
  const outerLeftC2: ShapePoint = [
    shoulderLeft[0],
    shoulderLeft[1] + lobeShare,
  ];
  const lowerLeftC1: ShapePoint = [
    shoulderLeft[0],
    shoulderLeft[1] - lowerShare,
  ];
  const lowerLeftC2: ShapePoint = [
    -(tipRight[0] + lowerShare * tipTangent[0]),
    tipRight[1] + lowerShare * tipTangent[1],
  ];
  const shape = new Shape();

  shape.moveTo(tipLeft[0], tipLeft[1]);
  // Дуга кончика: слева через нижнюю точку (0, −B) к правой точке стыка.
  shape.absarc(
    0,
    tipCenterY,
    layout.tipRadiusMm,
    -Math.PI + tipHalf,
    -tipHalf,
    false,
  );
  bezierTo(shape, lowerRightC1, lowerRightC2, shoulderRight);
  bezierTo(shape, outerRightC1, outerRightC2, lobeRight);
  bezierTo(shape, innerRightC1, innerRightC2, valleyRight);
  // Дно выемки: справа налево через нижнюю точку дуги.
  shape.absarc(
    0,
    valleyCenterY,
    layout.valleyRadiusMm,
    valleyRightAngle,
    valleyLeftAngle,
    true,
  );
  bezierTo(shape, innerLeftC1, innerLeftC2, lobeLeft);
  bezierTo(shape, outerLeftC1, outerLeftC2, shoulderLeft);
  bezierTo(shape, lowerLeftC1, lowerLeftC2, tipLeft);
  shape.closePath();

  return shape;
}

/**
 * Сердце с выемкой между долями и отверстием в теле — пресет Heart.
 *
 * Классическая форма: две круглые доли сверху, плавная выемка глубиной 15 %
 * высоты со скруглённым дном R3–4 мм, максимальная ширина на 15 % полувысоты
 * выше центра и кончик, сходящийся под 60° со скруглением R1 мм. Доли остаются
 * круглыми, а широкий участок приходится выше середины — иначе силуэт читается
 * яблоком с вырезкой.
 *
 * Отверстие Ø5 мм стоит по центру на оси симметрии под дном выемки: проушина
 * поверх выемки не влезает в габарит `width × height`, а пятак Ø11 мм закрыл бы
 * саму выемку. Стенка над кольцом — 2 мм в свету, в стороны материала больше,
 * поэтому ушко держит нагрузку и на 20 × 30.
 *
 * Габарит держится точно по слайдерам: верхнюю кромку даёт горизонтальная
 * касательная в верхушке доли, нижнюю — дуга кончика, ширину — вертикальная
 * касательная в плече. Фаска расширяет контур на 0.4 мм по нормали, а профиль
 * построен меньше на эту же величину, поэтому STL совпадает со слайдером.
 */
export function buildHeart(
  params: KeychainPresetGeometryParams,
): ExtrudeGeometry {
  const layout = heartLayout(params.width, params.height);
  const shape = heartShape(layout);
  // Отверстие стоит под дном выемки: `left`/`right` сдвигают его вдоль X в теле
  // доли, `none` оставляет сердце целым.
  const hole = presetRingHole("heart", params, layout.ringY);

  if (hole) {
    shape.holes.push(hole);
  }

  return extrudePresetShape(shape, params.thickness);
}

/**
 * Контур из точек, где скруглена только часть углов.
 *
 * Обобщение `roundedPolygonShape`: там радиус один на все углы, а у зуба их три
 * вида — вершина, галтель впадины и излом профиля. Точки дуг вершины и впадины
 * идут с нулевым радиусом: излом между соседними точками дуги всего 2°, и
 * скруглять там нечего. Скругление, как и у многоугольника, — одна квадратичная
 * кривая с контрольной точкой в самом углу, а точки касания считает
 * `cornerRoundPoints`, поэтому на узкой впадине оно само ужимается.
 */
function roundedPointLoop(
  points: readonly ShapePoint[],
  radii: readonly number[],
): Shape {
  const count = points.length;
  const rounds = points.map((point, index) =>
    radii[index] > 0
      ? cornerRoundPoints(
          point,
          points[(index + count - 1) % count],
          points[(index + 1) % count],
          radii[index],
        )
      : { from: point, to: point },
  );
  const shape = new Shape();

  shape.moveTo(rounds[0].from[0], rounds[0].from[1]);

  for (let index = 0; index < count; index += 1) {
    if (radii[index] > 0) {
      shape.quadraticCurveTo(
        points[index][0],
        points[index][1],
        rounds[index].to[0],
        rounds[index].to[1],
      );
    }

    const nextIndex = (index + 1) % count;

    // Замыкание делает `closePath`: последнее ребро ведёт к началу первого
    // скругления, а не к его концу — иначе на стыке осталась бы петля.
    if (nextIndex === 0) {
      break;
    }

    if (radii[nextIndex] > 0) {
      shape.lineTo(rounds[nextIndex].from[0], rounds[nextIndex].from[1]);
    } else {
      shape.lineTo(points[nextIndex][0], points[nextIndex][1]);
    }
  }

  shape.closePath();

  return shape;
}

/**
 * Профиль шестерни: всё, что нужно контуру, без раскладки отверстия.
 *
 * Отдельный тип нужен, чтобы `gearLayout` мог построить контур до расчёта
 * положения отверстия: контур от него не зависит, а отверстие считается по
 * расстоянию до контура.
 */
type GearProfile = Pick<
  GearLayout,
  | "teeth"
  | "tipRadiusMm"
  | "baseRadiusMm"
  | "rootRadiusMm"
  | "tipHalfAngle"
  | "baseHalfAngle"
  | "tipRoundMm"
  | "rootRoundMm"
  | "shoulderRoundMm"
>;

/**
 * Точки контура шестерни и радиусы скруглений по ним.
 *
 * Зуб обходится против часовой стрелки: галтель впадины, радиальная стенка до
 * основной окружности, излом, наклон к вершине, плоская вершина дугой, и та же
 * пара стенок вниз. Между зубьями — дуга впадины. Плоская вершина важна не
 * меньше глубины: без неё силуэт читается звёздочкой, а не шестернёй.
 */
function gearContour(profile: GearProfile): {
  points: ShapePoint[];
  radii: number[];
} {
  const points: ShapePoint[] = [];
  const radii: number[] = [];
  const pitch = (Math.PI * 2) / profile.teeth;
  const push = (point: ShapePoint, radius: number): void => {
    points.push(point);
    radii.push(radius);
  };

  for (let tooth = 0; tooth < profile.teeth; tooth += 1) {
    const centre = Math.PI / 2 + tooth * pitch;
    const tipFrom = centre - profile.tipHalfAngle;
    const tipTo = centre + profile.tipHalfAngle;
    const valleyFrom = centre + profile.baseHalfAngle;
    const valleyTo = centre + pitch - profile.baseHalfAngle;

    push(
      polarPoint(profile.rootRadiusMm, centre - profile.baseHalfAngle),
      profile.rootRoundMm,
    );
    push(
      polarPoint(profile.baseRadiusMm, centre - profile.baseHalfAngle),
      profile.shoulderRoundMm,
    );
    push(polarPoint(profile.tipRadiusMm, tipFrom), profile.tipRoundMm);

    for (let step = 1; step < GEAR_ARC_SEGMENTS; step += 1) {
      push(
        polarPoint(
          profile.tipRadiusMm,
          tipFrom + ((tipTo - tipFrom) * step) / GEAR_ARC_SEGMENTS,
        ),
        0,
      );
    }

    push(polarPoint(profile.tipRadiusMm, tipTo), profile.tipRoundMm);
    push(
      polarPoint(profile.baseRadiusMm, centre + profile.baseHalfAngle),
      profile.shoulderRoundMm,
    );
    push(
      polarPoint(profile.rootRadiusMm, centre + profile.baseHalfAngle),
      profile.rootRoundMm,
    );

    for (let step = 1; step < GEAR_ARC_SEGMENTS; step += 1) {
      push(
        polarPoint(
          profile.rootRadiusMm,
          valleyFrom + ((valleyTo - valleyFrom) * step) / GEAR_ARC_SEGMENTS,
        ),
        0,
      );
    }
  }

  return { points, radii };
}

/** Контур шестерни: зубья по кругу со скруглениями вершины, излома и впадины. */
function gearShape(layout: GearLayout): Shape {
  const { points, radii } = gearContour(layout);

  return roundedPointLoop(points, radii);
}

/**
 * Шестерня с плоской вершиной зуба, ступицей и отверстием под кольцо — пресет Gear.
 *
 * Зубьев столько, сколько влезает при модуле 2.16 мм, с округлением до кратного
 * четырём: на 44 × 44 это 20 зубьев, диаметр по вершинам 43.2 мм, шаг 6.17 мм и
 * глубина впадины 4.4 мм (20 % радиуса). Профиль реечный (20°), ниже основной
 * окружности зуб идёт радиальной стенкой — так у настоящей шестерни выглядит
 * подрез у корня, и именно эта стенка делает впадину широкой, а силуэт —
 * шестернёй, а не кругом с зубчиками.
 *
 * Отверстие Ø5 мм смещено вверх, к верхнему зубу, а ступица остаётся в центре
 * акцентом и сквозного отверстия не несёт: кольцо в центре превращало шестерню
 * в медаль, а подвес сверху — то, за что брелок и цепляют. Стенка до контура и
 * до кромки ступицы держится 1.5 мм (расчёт — в `gearLayout`). Там, где
 * отверстию не хватает места (20 × 30), оно остаётся в центре, и ступица
 * работает кольцом вокруг него — иначе кольцо идёт сквозь ступицу и рвёт её.
 *
 * Ступица поднята над полем на 0.6 мм и собрана отдельной оболочкой через
 * `mergeGeometries` — вычитания тел (CSG) в проекте нет, так же собраны шипы
 * кирпича. Низ ступицы утоплен в тело на 0.2 мм: оболочки должны пересекаться
 * объёмом, а не касаться плоскостями.
 *
 * Габарит держится точно по обеим осям без всякой компенсации: при числе зубьев,
 * кратном четырём, по одному зубу смотрит ровно вверх, вниз, вправо и влево.
 * Шестерня круглая, поэтому вписана в меньшую сторону слайдеров, а разница
 * уходит в поле — как у вспышки, которая тоже не растягивается на вытянутый
 * габарит.
 */
export function buildGear(
  params: KeychainPresetGeometryParams,
): BufferGeometry {
  const layout = gearLayout(params.width, params.height);
  const shape = gearShape(layout);
  // У шестерни позиция только центр или `none`: сдвиг вбок уводит отверстие во
  // впадину, где стенка отрицательная.
  const placement = presetHolePlacement("gear", params);
  const hole = presetRingHole("gear", params, layout.ringY);

  if (hole) {
    shape.holes.push(hole);
  }

  const body = extrudePresetShape(shape, params.thickness);
  // Ступица — вторая оболочка с той же фаской, что у тела. Отверстие в ней есть
  // только когда кольцо осталось в центре: тогда её стенка на 0.15 мм шире
  // стенки тела, иначе совпадающие стенки дают рёбра с четырьмя треугольниками.
  // При `none` ступица остаётся, но сплошной: иначе её канал повис бы над телом
  // без отверстия и превратился в глухой карман.
  const hubShape = new Shape();

  hubShape.absarc(0, 0, layout.hubRadiusMm, 0, Math.PI * 2, false);

  if (layout.hubBoreRadiusMm > 0 && placement !== "none") {
    const hubHole = new Path();

    hubHole.absarc(0, 0, layout.hubBoreRadiusMm, 0, Math.PI * 2, true);
    hubShape.holes.push(hubHole);
  }

  const hub = extrudePresetShape(
    hubShape,
    GEAR_HUB_LIFT_MM + GEAR_HUB_EMBED_MM,
  );

  hub.translate(0, 0, params.thickness - GEAR_HUB_EMBED_MM);

  const parts = [body, hub];
  const gear = mergeGeometries(parts);

  for (const part of parts) {
    part.dispose();
  }

  if (!gear) {
    throw new Error("Не удалось соединить шестерню и ступицу");
  }

  gear.computeBoundingBox();
  gear.computeBoundingSphere();

  return gear;
}

/**
 * Геометрия выбранного пресета.
 *
 * null означает «пресет ещё не реализован»: панель по этому же признаку гасит
 * кнопку скачивания, а API отвечает 422, поэтому заглушка не может уехать в
 * печать как правдоподобная модель.
 *
 * Карман под NFC-метку считается здесь же: `nfcLayout` — общий источник правды
 * для геометрии и панели. QR-визитка собирается в своём модуле, ей раскладка
 * передаётся готовыми числами: её корпус — отдельная деталь со своей фаской.
 */
export function buildKeychainPresetGeometry(
  presetId: KeychainPresetId,
  params: KeychainPresetGeometryParams,
): BufferGeometry | null {
  switch (presetId) {
    case "apple-tag":
      return buildAppleTag(params);
    case "capsule":
      return buildCapsule(params);
    case "hex":
      return buildHex(params);
    case "gear":
      return buildGear(params);
    case "brick":
      return buildBrick(params);
    case "ticket":
      return buildTicket(params);
    case "starburst":
      return buildStarburst(params);
    case "heart":
      return buildHeart(params);
    case "qr-card": {
      const nfc = nfcLayout(presetId, params);

      return buildQrCard({
        width: params.width,
        height: params.height,
        thickness: params.thickness,
        qr: params.qr,
        nfc:
          nfc.enabled && nfc.pocketY !== null
            ? {
                pocketY: nfc.pocketY,
                radiusMm: nfc.radiusMm,
                floorMm: nfc.floorMm,
                cavityHeightMm: nfc.cavityHeightMm,
                lipMm: nfc.lipMm,
                lipRadiusMm: nfc.lipRadiusMm,
                pauseZ: nfc.pauseZ,
                lidStartZ: nfc.lidStartZ,
              }
            : null,
      });
    }
    default:
      return null;
  }
}
