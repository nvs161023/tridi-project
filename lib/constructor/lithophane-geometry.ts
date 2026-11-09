import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  ShapeUtils,
  Vector2,
} from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { lithophaneContainRect } from "@/lib/constructor/lithophane-image";
import {
  LITHOPHANE_MESH_TOO_LARGE_MESSAGE,
  lithophaneHasStand,
  lithophaneMeshSize,
  lithophaneShapeHasMounts,
  normalizeLithophaneParams,
  type LithophaneLightSource,
  type LithophaneMount,
  type LithophaneParams,
  type LithophanePart,
} from "@/lib/constructor/params";

/**
 * Геометрия литофана: рельеф, рамка с пазом и два съёмных крепления.
 *
 * Всё стоит в плоскости XY нижней кромкой на Y = 0, лицо смотрит в +Z; у
 * подставки база лежит на столе. Рельеф — heightfield по габаритам плиты: шаг
 * вершины считается из стандарта 0.3 мм (`lithophaneMeshSize`), поэтому на
 * панели 120 мм сетка 360 × 227, а на панели 200 мм — 626 × 460. Толщина каждой
 * вершины берётся из яркости фотографии: билинейная выборка по четырём соседним
 * пикселям прямоугольной сетки (400 × 267 для кадра 3:2), которую браузер уже
 * сжал из кадра, а затем среднее по площади шага вершины (2 × 2 подвыборки).
 * Площадное усреднение нужно потому, что частота сетки кадра и шаг вершин почти
 * совпадают: точечная выборка попадала в центр пикселя, и край букв логотипа
 * оставался лесенкой. Чёрный пиксель даёт максимальную толщину, белый —
 * минимальную, поэтому свет проходит через тонкие участки сильнее.
 *
 * Кадр вписывается в панель по правилу contain: пропорции сохраняются, кадр
 * виден целиком, а поля по краям печатаются на минимальной толщине — на просвет
 * они светлые. Режим не выбирается вручную: фотографии вписываются всегда, а у
 * логотипа с прозрачным фоном обрезаются прозрачные поля (см.
 * `lithophane-image.ts`). Раньше действовало правило cover: лишнее срезалось, и
 * загруженное фото теряло края.
 *
 * После выборки яркость проходит через лёгкий unsharp и контраст: без них
 * площадное усреднение размывало тонкие штрихи логотипа до «каши».
 *
 * Деталей три, и каждая — отдельный замкнутый объект:
 *   `relief` — плита с плоским тылом и рельефом на лице; углы скруглены на
 *              радиус окна рамки, чтобы плита входила в него с зазором;
 *   `frame`  — скруглённое кольцо с задней полкой (плита садится на неё с
 *              зазором 0.2 мм) и передней накладкой, которая прижимает её край;
 *              наружные углы — дугой 6 мм, окно — дугой 2 мм;
 *   `stand`  — подставка: база, передняя губа и задняя стойка под наклоном 12°
 *              со скруглением в тыльном углу. Профиль один, поэтому шва, по
 *              которому деталь отламывается, нет. Подставок три: открытая арка
 *              (две ножки по краям, паз под рамку и крепление под свет в базе —
 *              низ панели открыт, и свет проходит к нему), сплошная ножка и
 *              массивное основание.
 *
 * Крепление `hook` — закрытый световой короб на тыльной стороне рамки: в нём
 * лежит лента, провод уходит через отверстие в тыльной стенке, а две петли на
 * этой стенке держат литофан на шурупах с зазором 15 мм от стены (см.
 * `LITHOPHANE_WALL_BOX`). Вычитания тел (CSG) нет: деталь собирается из
 * пересекающихся замкнутых кусков и `mergeGeometries`, как вывеска и подставка.
 * Нахлёст объединяемых кусков — BODY_OVERLAP_MM: слайсер видит один объект, а
 * каждая оболочка остаётся watertight.
 *
 * Форма панели (`lithoShape`) — отдельный режим поверх той же сборки. Плоская
 * панель остаётся heightfield по плоскости. Изогнутая гнётся по дуге радиуса
 * `lithoCurveRadius` вокруг вертикальной оси, полуцилиндр — на 180° с радиусом
 * из ширины (R = ширина / π) и стоит на столе сам. Гнётся уже готовая деталь:
 * каждое сечение поворачивается на угол x / R, поэтому сетка рельефа, посадка
 * плиты в паз и толщины остаются прежними. Крепления у этих форм отключены:
 * паз, стойка и короб вырезаны в плоской рамке, и база встала бы на стол дугой.
 */

/** Ширина бортика рамки по периметру, мм. */
export const LITHOPHANE_FRAME_WIDTH_MM = 6;

/**
 * Радиус скругления наружных углов рамки, мм.
 *
 * Прямые углы читались на предпросмотре как коробка: рамка выглядела
 * штампованным прямоугольником. 6 мм — верх рекомендуемого диапазона 4–6 мм:
 * на панели 120 × 80 скругление занимает 7 % короткой стороны и заметно, но
 * ещё не спорит с самим кадром. Радиус ограничивается четвертью меньшей стороны,
 * поэтому маленькие панели остаются целыми.
 */
export const LITHOPHANE_FRAME_CORNER_RADIUS_MM = 6;

/**
 * Радиус скругления окна рамки, мм.
 *
 * Окно — то, что видно вокруг картинки. Углы окна скруглены, иначе рамка
 * смотрелась бы коробкой в коробке. По этому радиусу скругляется и плита — на
 * зазор посадки меньше, — поэтому её углы не упираются в накладку.
 */
export const LITHOPHANE_FRAME_OPENING_RADIUS_MM = 2;

/**
 * Сколько отрезков приходится на скруглённый угол.
 *
 * Восемь шагов по 11.25° — дуга на глаз гладкая, а вершины ещё свариваются
 * `mergeVertices` и считаются миллисекунды: рамка строится на каждое движение
 * слайдера.
 */
const LITHOPHANE_CORNER_SEGMENTS = 8;

/**
 * Ширина бортика плиты по периметру, мм.
 *
 * 2 мм — стандарт литофанов из референсов: полоса максимальной толщины по краю
 * не просвечивает, не крошится при обращении и держит рельеф у самой кромки.
 * Бортик есть и при включённой рамке: фото заканчивается до рамки, а не
 * наезжает на накладку. Плита в окне уже панели на 8.4 мм с каждой стороны,
 * поэтому 0.2 мм бортика прячется под накладкой, а остальные 1.8 мм видны как
 * узкая полка вокруг кадра.
 */
export const LITHOPHANE_BORDER_MM = 2;

/**
 * Ширина фаски бортика, мм.
 *
 * Бортик заканчивается не вертикальной стенкой, а скосом: толщина плавно
 * переходит от максимальной к толщине фото. Раньше на границе был обрыв 2.2 мм
 * на одном шаге вершины (0.3 мм) — на печати это уступ в 11 слоёв, у которого
 * собираются сопли. Фаска растягивает тот же перепад на 1 мм: 0.66 мм на шаг.
 */
export const LITHOPHANE_BORDER_CHAMFER_MM = 1;

/** Зазор посадки плиты в паз на сторону, мм. */
export const LITHOPHANE_FIT_GAP_MM = 0.2;


/** Высота задней полки рамки: на неё опирается плита, мм. */
export const LITHOPHANE_FRAME_SEAT_MM = 1.6;

/** Ширина передней накладки поверх края плиты, мм. */
export const LITHOPHANE_FRAME_LIP_MM = 2.4;

/** Насколько передняя рамка выступает над самым толстым пикселем, мм. */
export const LITHOPHANE_FRAME_RIM_MM = 0.4;

/** Наклон литофана на подставке, градусы. */
export const LITHOPHANE_STAND_TILT_DEG = 12;

/**
 * Световой короб подвеса: тыльная стенка с петлями и канал под ленту.
 *
 * Петли на тыльной полке рамки держали её почти вплотную к стене: подсветку
 * сзади поставить было некуда, а сам подвес читался как две случайные бобышки.
 * Здесь за рамкой стоит закрытый короб — световой бокс. Он прячет тыл плиты от
 * комнаты, держит ленту в канале на уровне нижней кромки кадра, а петли уходят
 * на его тыльную стенку, поэтому литофан висит с зазором `hookReach` 12 мм:
 * за коробом проходит провод, и он не трётся о стену.
 *
 * Короб вписан в контур рамки с отступом `inset`: скруглённые углы рамки
 * остаются открытыми, а стенки короба встают на её тыльную полку, ширина
 * которой 8.4 мм. Короб открыт вперёд — в окно рамки, — поэтому свет ленты
 * уходит на тыл плиты, а не остаётся внутри.
 */
export const LITHOPHANE_WALL_BOX = {
  /**
   * Глубина короба по Z: от тыла рамки до внешней плоскости тыльной стенки, мм.
   *
   * От стены литофан отодвигает `hookReach`: в этом зазоре проходит провод и
   * стоят шляпки шурупов.
   */
  depth: 15,
  /** Толщина стенок и тыльной стенки, мм. */
  wall: 2.5,
  /** Отступ наружного контура короба от контура рамки, мм. */
  inset: 2,
  /**
   * Канал под ленту: ширина по Z, глубина по Y и высота пола над столом, мм.
   *
   * Пол канала на 8.5 мм выше стола — это верх задней полки рамки: лента лежит
   * на уровне нижней кромки кадра и светит вдоль тыла плиты, а не в полку.
   * Ширина канала — до тыльной стенки: лента 8–10 мм ложится между передним
   * бортиком и стенкой короба.
   */
  channelWidth: 10,
  channelDepth: 2,
  channelFloor: 8.5,
  /**
   * Отверстие под провод в тыльной стенке, мм.
   *
   * Дно отверстия совпадает с полом канала: провод сходит с ленты и уходит за
   * короб горизонтально, без излома под острым углом.
   */
  wireWidth: 6,
  wireHeight: 5,
  /** Петля под шуруп: ширина, выступ от тыльной стенки, полка и бортик, мм. */
  hookWidth: 10,
  hookReach: 12,
  hookShelf: 2.5,
  hookLip: 1.5,
  /** Отступ петли от боковой стенки короба, мм. */
  hookInset: 2,
} as const;

/**
 * Группы материалов в собранной сетке литофана.
 *
 * Группа — диапазон индексов, а не отдельный меш: сборка остаётся одной сеткой,
 * и вес, габарит и STL считаются как раньше. Предпросмотр красит рельеф
 * плоскостями (`flatShading`): по граням читается высота пикселя. Рамка и
 * подставка идут вторым материалом со сглаженными нормалями — они должны
 * выглядеть литыми и матовыми.
 */
export const LITHOPHANE_RELIEF_GROUP = 0;
export const LITHOPHANE_DETAIL_GROUP = 1;

/** Нахлёст двух объединяемых оболочек, мм: без него слайсер видит два тела. */
const BODY_OVERLAP_MM = 0.2;

type Point3 = readonly [number, number, number];

/** Индекс вершины в массиве positions. */
function vertexIndex(positions: number[]): number {
  return positions.length / 3;
}

/**
 * Добавляет выпуклый четырёхугольник двумя треугольниками.
 *
 * Порядок вершин задаётся по периметру, а expectedNormal говорит, куда должна
 * смотреть лицевая сторона. Если векторное произведение направлено в другую
 * сторону, обход разворачивается целиком — иначе нормали части граней
 * смотрели бы внутрь и объём перестал бы сходиться.
 */
function addOrientedQuad(
  indices: number[],
  positions: number[],
  a: number,
  b: number,
  c: number,
  d: number,
  normal: Point3,
): void {
  const ax = positions[a * 3];
  const ay = positions[a * 3 + 1];
  const az = positions[a * 3 + 2];
  const ux = positions[b * 3] - ax;
  const uy = positions[b * 3 + 1] - ay;
  const uz = positions[b * 3 + 2] - az;
  const vx = positions[c * 3] - ax;
  const vy = positions[c * 3 + 1] - ay;
  const vz = positions[c * 3 + 2] - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const flipped = nx * normal[0] + ny * normal[1] + nz * normal[2] < 0;
  const second = flipped ? d : b;
  const fourth = flipped ? b : d;

  indices.push(a, second, c, a, c, fourth);
}

/** Добавляет треугольник с нужной наружной нормалью. */
function addOrientedTriangle(
  indices: number[],
  positions: number[],
  a: number,
  b: number,
  c: number,
  normal: Point3,
): void {
  const ax = positions[a * 3];
  const ay = positions[a * 3 + 1];
  const az = positions[a * 3 + 2];
  const ux = positions[b * 3] - ax;
  const uy = positions[b * 3 + 1] - ay;
  const uz = positions[b * 3 + 2] - az;
  const vx = positions[c * 3] - ax;
  const vy = positions[c * 3 + 1] - ay;
  const vz = positions[c * 3 + 2] - az;
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;

  if (nx * normal[0] + ny * normal[1] + nz * normal[2] < 0) {
    indices.push(a, c, b);
  } else {
    indices.push(a, b, c);
  }
}

/**
 * Добавляет четырёхугольник четырьмя новыми вершинами.
 *
 * На построении грани остаются плоскими: у каждой свой набор вершин и своя
 * нормаль, поэтому силуэт и объём считаются точно. Сглаживание делается один раз
 * на готовую деталь (`smoothGeometryNormals`) — тогда нормаль учитывает всю
 * поверхность, а не только соседнюю грань.
 */
function addQuadFace(
  indices: number[],
  positions: number[],
  points: readonly [Point3, Point3, Point3, Point3],
  normal: Point3,
): void {
  const first = vertexIndex(positions);

  for (const point of points) {
    positions.push(point[0], point[1], point[2]);
  }

  addOrientedQuad(
    indices,
    positions,
    first,
    first + 1,
    first + 2,
    first + 3,
    normal,
  );
}

/** Собирает замкнутую оболочку из накопленных вершин и индексов. */
function finalizeGeometry(
  positions: number[],
  indices: number[],
): BufferGeometry {
  const geometry = new BufferGeometry();

  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Контур верхней поверхности против часовой стрелки со стороны +Z.
 *
 * Обход начинается в левом нижнем углу: нижняя кромка слева направо, правая
 * снизу вверх, верхняя справа налево, левая сверху вниз. Для такого контура
 * внешняя нормаль ребра равна (dy, -dx, 0).
 */
function collectBoundaryIndices(columns: number, rows: number): number[] {
  const boundary: number[] = [];
  const bottomRow = (rows - 1) * columns;

  for (let column = 0; column < columns; column += 1) {
    boundary.push(bottomRow + column);
  }

  for (let row = rows - 2; row >= 0; row -= 1) {
    boundary.push(row * columns + columns - 1);
  }

  for (let column = columns - 2; column >= 0; column -= 1) {
    boundary.push(column);
  }

  for (let row = 1; row <= rows - 2; row += 1) {
    boundary.push(row * columns);
  }

  return boundary;
}

/**
 * Габариты посадки плиты в рамку, мм.
 *
 * Считаются в одном месте: плита строится по ним, рамка вырезает по ним окно, а
 * сборка ставит плиту на полку. Иначе после смены ширины бортика плита и окно
 * разошлись бы на десятые доли миллиметра и деталь не собралась бы.
 */
type FrameMetrics = {
  /** Габарит собранной рамки — те же числа, что на слайдерах. */
  width: number;
  height: number;
  /** Ширина бортика: 6 мм, но не больше четверти панели. */
  frameWidth: number;
  /** Ширина передней накладки поверх края плиты. */
  lip: number;
  /** Окно рамки: сюда входит плита. */
  openingWidth: number;
  openingHeight: number;
  /** Размер плиты: окно минус зазор посадки с двух сторон. */
  plateWidth: number;
  plateHeight: number;
  /** Плоскость тыла плиты: верх полки минус нахлёст для объединения. */
  plateBack: number;
  /** Лицевая плоскость рамки: плита плюс выступ накладки. */
  frontZ: number;
  /** Радиус скругления наружных углов рамки, мм. */
  cornerRadius: number;
  /** Радиус скругления окна накладки: видимый край кадра, мм. */
  openingRadius: number;
  /** Радиус скругления окна задней полки, мм. */
  seatRadius: number;
  /** Радиус скругления углов плиты: окно минус зазор посадки, мм. */
  plateCornerRadius: number;
};

function lithophaneFrameMetrics(normalized: LithophaneParams): FrameMetrics {
  const width = normalized.lithophaneWidth;
  const height = normalized.lithophaneHeight;
  const frameWidth = Math.min(
    LITHOPHANE_FRAME_WIDTH_MM,
    width / 4,
    height / 4,
  );
  const openingWidth = width - 2 * frameWidth;
  const openingHeight = height - 2 * frameWidth;
  const lip = Math.min(
    LITHOPHANE_FRAME_LIP_MM,
    openingWidth / 5,
    openingHeight / 5,
  );
  const plateBack = LITHOPHANE_FRAME_SEAT_MM - BODY_OVERLAP_MM;
  // Радиусы ограничены четвертью своего прямоугольника: на маленькой панели
  // дуга иначе съела бы всю сторону.
  const cornerRadius = Math.min(
    LITHOPHANE_FRAME_CORNER_RADIUS_MM,
    width / 4,
    height / 4,
  );
  const openingRadius = Math.min(
    LITHOPHANE_FRAME_OPENING_RADIUS_MM,
    openingWidth / 4,
    openingHeight / 4,
  );
  // Окно полки шире накладки на накладку с каждой стороны: дуга растёт вместе
  // с ним, чтобы полка оставалась равномерной полосой под плитой.
  const seatRadius = Math.min(
    openingRadius + lip,
    (openingWidth - 2 * lip) / 4,
    (openingHeight - 2 * lip) / 4,
  );

  return {
    width,
    height,
    frameWidth,
    lip,
    openingWidth,
    openingHeight,
    plateWidth: openingWidth - 2 * LITHOPHANE_FIT_GAP_MM,
    plateHeight: openingHeight - 2 * LITHOPHANE_FIT_GAP_MM,
    plateBack,
    frontZ:
      plateBack + normalized.lithophaneMaxThickness + LITHOPHANE_FRAME_RIM_MM,
    cornerRadius,
    openingRadius,
    seatRadius,
    // Плита входит в окно с зазором и повторяет его скругление: контуры
    // параллельны, поэтому зазор одинаков по всему периметру, включая углы.
    plateCornerRadius: Math.max(0, openingRadius - LITHOPHANE_FIT_GAP_MM),
  };
}

/**
 * Билинейная выборка яркости в точке 0…1 по обеим осям.
 *
 * Сетка прямоугольная: 400 × 267 для кадра 3:2, 150 × 100 для предпросмотра.
 * Оси нормируются отдельно, поэтому пиксель остаётся квадратным и кадр не
 * растягивается. Значение — взвешенное среднее четырёх соседних пикселей: они
 * входят с весами `(1 − tx)(1 − ty)`, `tx(1 − ty)`, `(1 − tx)ty` и `tx·ty`.
 */
function bilinearBrightness(
  brightness: number[],
  width: number,
  height: number,
  u: number,
  v: number,
): number {
  const lastX = width - 1;
  const lastY = height - 1;
  const x = Math.min(Math.max(u, 0), 1) * lastX;
  const y = Math.min(Math.max(v, 0), 1) * lastY;
  const x0 = Math.min(Math.floor(x), lastX - 1);
  const y0 = Math.min(Math.floor(y), lastY - 1);
  const tx = x - x0;
  const ty = y - y0;
  const topRow = y0 * width;
  const bottomRow = topRow + width;
  const topLeft = brightness[topRow + x0];
  const bottomLeft = brightness[bottomRow + x0];
  const top = topLeft + (brightness[topRow + x0 + 1] - topLeft) * tx;
  const bottom =
    bottomLeft + (brightness[bottomRow + x0 + 1] - bottomLeft) * tx;

  return top + (bottom - top) * ty;
}

/**
 * Сколько подвыборок берётся по каждой оси внутри шага вершины.
 *
 * Две — это четыре точки на площадь вершины: классическое сглаживание
 * растеризатора. Больше не нужно: шаг вершины и пиксель сетки яркости почти
 * совпадают, и склон получается шириной в шаг.
 */
const LITHOPHANE_SAMPLE_GRID = 2;

/**
 * Яркость вершины как среднее по площади шага сетки.
 *
 * Билинейная выборка интерполирует четыре пикселя, но берёт их в одной точке.
 * Сетка яркости — 400 пикселей по длинной стороне кадра, а вершина панели
 * 120 мм стоит через 0.3 мм, то есть ровно через пиксель. Точка выборки
 * попадает в центр пикселя, интерполяция между соседями почти не работает, и
 * край буквы логотипа остаётся лесенкой из ступенек в один пиксель.
 *
 * Поэтому яркость считается средним четырёх билинейных выборок, сдвинутых на
 * четверть шага сетки: это площадь одной вершины. Ступенька растягивается в
 * плавный склон, буквы печатаются гладкой линией, а тонкие штрихи не тонут —
 * усредняется только площадь самой вершины, соседние пиксели не размазываются.
 *
 * `spreadU`/`spreadV` — половина шага вершины в долях кадра. Без них (0)
 * функция равна точечной билинейной выборке.
 */
function sampleBrightness(
  brightness: number[],
  width: number,
  height: number,
  u: number,
  v: number,
  spreadU = 0,
  spreadV = 0,
): number {
  if (spreadU <= 0 && spreadV <= 0) {
    return bilinearBrightness(brightness, width, height, u, v);
  }

  const offsetU = spreadU / LITHOPHANE_SAMPLE_GRID;
  const offsetV = spreadV / LITHOPHANE_SAMPLE_GRID;
  let sum = 0;

  for (let row = 0; row < LITHOPHANE_SAMPLE_GRID; row += 1) {
    // Центры ячеек внутри площади вершины: -spread + (row + 0.5) * 2 * offset.
    const shiftV = (2 * row + 1) * offsetV - spreadV;

    for (let column = 0; column < LITHOPHANE_SAMPLE_GRID; column += 1) {
      const shiftU = (2 * column + 1) * offsetU - spreadU;

      sum += bilinearBrightness(
        brightness,
        width,
        height,
        u + shiftU,
        v + shiftV,
      );
    }
  }

  return sum / (LITHOPHANE_SAMPLE_GRID * LITHOPHANE_SAMPLE_GRID);
}

/**
 * Насколько усиливается резкость: разница с средним четырёх соседей.
 *
 * Выборка по площади — это фильтр низких частот: штрих логотипа в один пиксель
 * теряет амплитуду, и на печати буквы сливаются. unsharp возвращает краю
 * контраст, а второй коэффициент расширяет диапазон вокруг середины, чтобы
 * тёмные линии уверенно доходили до максимальной толщины. Значения ниже 0 и
 * выше 255 обрезаются: толщина не может выйти за границы слайдеров.
 *
 * Соседи берутся с той же площадной выборкой, что и центр: иначе unsharp
 * сравнивал бы сглаженную точку с резкой и возвращал бы лесенку обратно.
 */
const LITHOPHANE_SHARPNESS = 0.5;
const LITHOPHANE_CONTRAST = 1.15;

function sharpenBrightness(
  brightness: number[],
  width: number,
  height: number,
  u: number,
  v: number,
  spreadU = 0,
  spreadV = 0,
): number {
  const center = sampleBrightness(
    brightness,
    width,
    height,
    u,
    v,
    spreadU,
    spreadV,
  );

  if (width < 3 && height < 3) {
    return center;
  }

  // Шаг в один пиксель источника: соседи берутся по осям, поэтому фильтр
  // остаётся разделимым и стоит четыре выборки вместо девяти. Оси сетки
  // прямоугольные, поэтому шаг по X и по Y разный.
  const stepU = width > 1 ? 1 / (width - 1) : 0;
  const stepV = height > 1 ? 1 / (height - 1) : 0;
  const neighbors =
    (sampleBrightness(
      brightness,
      width,
      height,
      u - stepU,
      v,
      spreadU,
      spreadV,
    ) +
      sampleBrightness(
        brightness,
        width,
        height,
        u + stepU,
        v,
        spreadU,
        spreadV,
      ) +
      sampleBrightness(
        brightness,
        width,
        height,
        u,
        v - stepV,
        spreadU,
        spreadV,
      ) +
      sampleBrightness(
        brightness,
        width,
        height,
        u,
        v + stepV,
        spreadU,
        spreadV,
      )) /
    4;
  const sharpened = center + (center - neighbors) * LITHOPHANE_SHARPNESS;
  const contrasted = 127.5 + (sharpened - 127.5) * LITHOPHANE_CONTRAST;

  return Math.min(255, Math.max(0, contrasted));
}

/**
 * Насколько вершина за дугой прижимается внутрь неё.
 *
 * Ноль — точная проекция на дугу, но тогда две вершины диагонали угла попадают
 * в одну точку и грань между ними вырождается. Десятая часть разносит их на
 * сотые доли миллиметра: на печати это не видно, а сетка остаётся без нулевых
 * рёбер.
 */
const PLATE_CORNER_CONTRACT = 0.1;

/**
 * Скругляет углы плиты, перенося крайние вершины на дугу.
 *
 * Плита строится регулярной сеткой, и выбросить угловые ячейки нельзя: вместе с
 * ними ушла бы замкнутость оболочки и разметка тыла. Поэтому вершины, попавшие
 * за дугу радиуса `radius`, переносятся на саму дугу — по направлению от центра
 * скругления. Топология и число треугольников не меняются, габарит тоже: вне
 * угловых квадратов вершины остаются на месте.
 *
 * Скругление нужно посадке: окно рамки скруглено, и прямоугольная плита
 * упиралась бы углами в накладку. Радиус плиты на зазор посадки меньше радиуса
 * окна, поэтому контуры идут параллельно и зазор по всему периметру одинаков.
 *
 * `halfWidth` и `halfHeight` — половины габаритов плиты, а `positions` хранит
 * Y от 0 до полной высоты, как у готовой детали.
 */
function roundPlateCorners(
  positions: number[],
  halfWidth: number,
  halfHeight: number,
  radius: number,
): void {
  if (radius <= 0) {
    return;
  }

  const flatWidth = halfWidth - radius;
  const flatHeight = halfHeight - radius;

  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index];
    const y = positions[index + 1] - halfHeight;
    const beyondX = Math.abs(x) - flatWidth;
    const beyondY = Math.abs(y) - flatHeight;

    if (beyondX <= 0 || beyondY <= 0) {
      continue;
    }

    const distance = Math.sqrt(beyondX * beyondX + beyondY * beyondY);

    if (distance <= radius) {
      continue;
    }

    // Вершины за дугой садятся чуть внутрь неё, пропорционально своему удалению:
    // строго радиальная проекция положила бы две вершины диагонали в одну
    // точку, и грани между ними выродились бы в ноль. Сжатие на десятую часть
    // разносит их на сотые доли миллиметра — дуга остаётся дугой, а сетка целой.
    const projected = radius - (distance - radius) * PLATE_CORNER_CONTRACT;
    const scale = projected / distance;
    const signX = x < 0 ? -1 : 1;
    const signY = y < 0 ? -1 : 1;

    positions[index] = signX * (flatWidth + beyondX * scale);
    positions[index + 1] = halfHeight + signY * (flatHeight + beyondY * scale);
  }
}

/**
 * Радиус изгиба панели, мм: null — форма плоская.
 *
 * У изогнутой панели радиус берётся из слайдера. Дуга при этом не доходит до
 * полукруга: панель не шире 200 мм, а радиус не меньше 100 мм, поэтому угол
 * заворота ограничен 114°. У полуцилиндра радиус выводится из ширины — половина
 * окружности укладывается ровно в ширину панели, откуда R = ширина / π: панель
 * 120 мм садится на лампу диаметром 76 мм.
 *
 * Радиус общий для плиты и рамки: обе детали получают одно и то же смещение по
 * X, поэтому посадка плиты в паз остаётся прежней.
 */
function lithophaneBendRadius(normalized: LithophaneParams): number | null {
  if (normalized.lithoShape === "cylinder") {
    return normalized.lithophaneWidth / Math.PI;
  }

  if (normalized.lithoShape === "curved") {
    return normalized.lithoCurveRadius;
  }

  return null;
}

/**
 * Гнёт готовую деталь в цилиндр вокруг вертикальной оси.
 *
 * Развёртка детали сохраняется: точка (x, z) встаёт на радиус R + z под углом
 * t = x / R. Поэтому ширина панели на поверхности не меняется — кадр не
 * сжимается к краям, — а прогиб повторяет зависимость z = R - sqrt(R^2 - x^2) с
 * точностью до второго порядка: R(1 - cos(x / R)) = x^2 / (2R). Сама формула-
 * проекция годится только для малых углов: при x около R производная dx'/dx
 * обращается в ноль, и сетка складывается в плоскость.
 *
 * Ось стоит на тыле детали (Z = -R): рельеф остаётся на выпуклой стороне, а
 * вогнутая смотрит на свет. Для полуцилиндра это и есть ночник — колба входит
 * внутрь, кадр светится снаружи, а панель стоит на дуге нижней кромки.
 *
 * Толщина переносится без искажений: слои идут по радиусу, поэтому плита и
 * рамка гнутся одинаково и зазор посадки 0.2 мм остаётся прежним.
 */
function bendGeometryAroundY(geometry: BufferGeometry, radius: number): void {
  const position = geometry.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    const angle = position.getX(index) / radius;
    const radial = radius + position.getZ(index);

    position.setX(index, radial * Math.sin(angle));
    position.setZ(index, -radius + radial * Math.cos(angle));
  }

  // Нормали считаются заново: сечение повернулось, и прежние векторы больше не
  // перпендикулярны поверхности. Сварка при этом цела — совпадавшие вершины
  // получили одинаковые координаты и остались одной точкой.
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/**
 * Ширина полосы, на которые режется деталь перед изгибом, мм.
 *
 * Изгиб считается по вершинам, поэтому длинная грань после него осталась бы
 * плоской хордой: верхняя кромка рамки на панели 200 мм стала бы одной гранью
 * через всю ширину, а тыл плиты — конусом из веера. Полоса 4 мм повторяет дугу
 * с ошибкой step² / (8R) = 0.05 мм на самом тесном полуцилиндре (R = 38 мм у
 * панели 120 мм): это в восемь раз меньше сопла. Плата — треугольники полос: у
 * панели 120 мм их на 14 % больше, чем у плоской, у панели 200 × 150 — на 27 %.
 * Бюджет в миллион треугольников проверяется до изгиба, поэтому запас на полосы
 * остаётся у самых крупных панелей.
 */
const LITHOPHANE_BEND_STRIP_MM = 4;

/**
 * Режет треугольники плоскостями X = const на полосы шириной не больше `step`.
 *
 * Нужна только изогнутым формам: плоская деталь и так состоит из коротких
 * граней — сетка рельефа идёт шагом 0.3 мм, — а тыл плиты собран веером от
 * центра к контуру, и его лучи тянутся через всю ширину. После изгиба такой луч
 * стал бы хордой, поэтому длинные рёбра режутся на полосы.
 *
 * Точки разреза на общем ребре двух треугольников считаются одинаково: концы
 * ребра упорядочиваются по координатам, и обе грани приходят в одну вершину.
 * Поэтому оболочка остаётся замкнутой, а соседние полосы сходятся без щели.
 *
 * Вершины и точки разреза живут в одной таблице, а нормали пересчитывает
 * вызывающая сторона: рельефу они нужны по своей сетке, рамке — по сварке.
 */
function subdivideAlongX(
  geometry: BufferGeometry,
  step: number,
): BufferGeometry {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const index = geometry.getIndex();
  const positions: number[] = [];
  const uvs: number[] = [];

  for (let vertex = 0; vertex < position.count; vertex += 1) {
    positions.push(
      position.getX(vertex),
      position.getY(vertex),
      position.getZ(vertex),
    );
    uvs.push(uv ? uv.getX(vertex) : 0, uv ? uv.getY(vertex) : 0);
  }

  const indices: number[] = [];
  const splitPoints = new Map<string, number>();

  /** Сравнение концов ребра: от него зависит, с какой стороны считать разрез. */
  const isOrdered = (from: number, to: number): boolean => {
    for (let axis = 0; axis < 3; axis += 1) {
      const difference =
        positions[from * 3 + axis] - positions[to * 3 + axis];

      if (difference !== 0) {
        return difference < 0;
      }
    }

    return true;
  };

  /** Точка разреза ребра плоскостью X = plane. */
  const splitEdge = (from: number, to: number, plane: number): number => {
    const a = isOrdered(from, to) ? from : to;
    const b = a === from ? to : from;
    const startX = positions[a * 3];
    const endX = positions[b * 3];
    const ratio = (plane - startX) / (endX - startX);

    // Разрез ровно в конце ребра новых вершин не даёт: иначе на кромке копились
    // бы точки, а вместе с ними и треугольники нулевой площади.
    if (ratio <= 1e-6) {
      return a;
    }

    if (ratio >= 1 - 1e-6) {
      return b;
    }

    const coordinates = [plane];

    for (const axis of [1, 2]) {
      coordinates.push(
        positions[a * 3 + axis] +
          (positions[b * 3 + axis] - positions[a * 3 + axis]) * ratio,
      );
    }

    for (const axis of [0, 1]) {
      coordinates.push(
        uvs[a * 2 + axis] + (uvs[b * 2 + axis] - uvs[a * 2 + axis]) * ratio,
      );
    }

    const key = coordinates.map((value) => value.toFixed(6)).join(":");
    const known = splitPoints.get(key);

    if (known !== undefined) {
      return known;
    }

    const vertex = positions.length / 3;

    positions.push(coordinates[0], coordinates[1], coordinates[2]);
    uvs.push(coordinates[3], coordinates[4]);
    splitPoints.set(key, vertex);

    return vertex;
  };

  /** Точки разреза ребра плоскостями сетки — по порядку от начала к концу. */
  const edgeSplits = (from: number, to: number): number[] => {
    const fromX = positions[from * 3];
    const toX = positions[to * 3];

    if (Math.abs(toX - fromX) <= step) {
      return [];
    }

    const minX = Math.min(fromX, toX);
    const maxX = Math.max(fromX, toX);
    const splitted: number[] = [];
    // Плоскости кратны step и общие для всей детали: сосед по ребру считает те
    // же точки разреза и приходит в те же вершины.
    let plane = (Math.floor(minX / step) + 1) * step;

    while (plane < maxX - 1e-6) {
      if (plane > minX + 1e-6) {
        splitted.push(splitEdge(from, to, plane));
      }

      plane += step;
    }

    return toX > fromX ? splitted : splitted.reverse();
  };

  /**
   * Треугольники по многоугольнику.
   *
   * Если рёбра не разрезаны, многоугольник — сам треугольник. Иначе веер идёт из
   * центра тяжести: разрез добавляет точки на ребро, и веер из вершины дал бы на
   * этом ребре вырожденные треугольники — полосы остались бы без граней, а тыл
   * плиты после изгиба превратился бы в одну хорду.
   */
  const pushFan = (polygon: number[]): void => {
    const emit = (a: number, b: number, c: number): void => {
      const abx = positions[b * 3] - positions[a * 3];
      const aby = positions[b * 3 + 1] - positions[a * 3 + 1];
      const abz = positions[b * 3 + 2] - positions[a * 3 + 2];
      const acx = positions[c * 3] - positions[a * 3];
      const acy = positions[c * 3 + 1] - positions[a * 3 + 1];
      const acz = positions[c * 3 + 2] - positions[a * 3 + 2];
      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;

      if (Math.hypot(nx, ny, nz) <= 1e-12) {
        return;
      }

      indices.push(a, b, c);
    };

    if (polygon.length === 3) {
      emit(polygon[0], polygon[1], polygon[2]);
      return;
    }

    const center = positions.length / 3;
    const sums = [0, 0, 0, 0, 0];

    for (const vertex of polygon) {
      for (let axis = 0; axis < 3; axis += 1) {
        sums[axis] += positions[vertex * 3 + axis];
      }

      for (let axis = 0; axis < 2; axis += 1) {
        sums[3 + axis] += uvs[vertex * 2 + axis];
      }
    }

    positions.push(
      sums[0] / polygon.length,
      sums[1] / polygon.length,
      sums[2] / polygon.length,
    );
    uvs.push(sums[3] / polygon.length, sums[4] / polygon.length);

    for (let corner = 0; corner < polygon.length; corner += 1) {
      emit(center, polygon[corner], polygon[(corner + 1) % polygon.length]);
    }
  };

  const triangles = (index?.count ?? position.count) / 3;

  for (let triangle = 0; triangle < triangles; triangle += 1) {
    const corners = [0, 1, 2].map((corner) =>
      index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner,
    );
    // Треугольник обходится по кругу, и на каждом ребре вставляются его точки
    // разреза: получается выпуклый многоугольник, который снова режется на
    // треугольники. Режется ребро, а не грань, поэтому сосед по ребру получает
    // ровно те же вершины, и шва между полосами не появляется.
    const polygon: number[] = [];

    for (let corner = 0; corner < 3; corner += 1) {
      const from = corners[corner];

      polygon.push(from, ...edgeSplits(from, corners[(corner + 1) % 3]));
    }

    pushFan(polygon);
  }

  const subdivided = new BufferGeometry();

  subdivided.setAttribute("position", new Float32BufferAttribute(positions, 3));
  subdivided.setIndex(indices);
  subdivided.setAttribute("uv", new Float32BufferAttribute(uvs, 2));

  return subdivided;
}

/**
 * Замкнутая плита рельефа: heightfield по габаритам плиты, боковины и тыл.
 *
 * Сетка считается из габаритов (`lithophaneMeshSize`): шаг вершины 0.3 мм, а на
 * большой панели вершин просто становится больше. Если бюджет треугольников
 * превышен, функция бросает ошибку с текстом для панели и API: лучше отказ, чем
 * зависший браузер и 45 МБ STL.
 *
 * `borderWidth` — плоская полоса максимальной толщины по периметру. Переход от
 * бортика к фото идёт фаской `LITHOPHANE_BORDER_CHAMFER_MM`, поэтому на печати
 * нет уступа в 2.2 мм на одном шаге вершины.
 *
 * `cornerRadius` — радиус скругления углов плиты. Окно рамки скруглено, и
 * прямоугольная плита упиралась бы углами в накладку; плита повторяет это
 * скругление за вычетом зазора посадки. Без рамки радиус равен нулю.
 *
 * Кадр вписан в плиту по правилу contain: пропорции сохранены, кадр виден
 * целиком, а разница уходит в поля минимальной толщины. `uv` размечены по плите
 * (0…1 по обеим осям): по ним предпросмотр накладывает карту свечения, когда
 * включена подсветка на просвет, а карта строится под пропорции плиты с белыми
 * полями — светится ровно то, что на фото, без сдвига и растяжения.
 */
function createReliefBody(
  normalized: LithophaneParams,
  plateWidth: number,
  plateHeight: number,
  borderWidth: number,
  cornerRadius: number,
): BufferGeometry {
  const minThickness = normalized.lithophaneMinThickness;
  const maxThickness = normalized.lithophaneMaxThickness;
  const brightness = normalized.lithophaneBrightness;
  const brightnessWidth = normalized.lithophaneBrightnessWidth;
  const brightnessHeight = normalized.lithophaneBrightnessHeight;
  const mesh = lithophaneMeshSize(plateWidth, plateHeight);

  if (mesh === null) {
    throw new Error(LITHOPHANE_MESH_TOO_LARGE_MESSAGE);
  }

  const { columns, rows } = mesh;
  const halfWidth = plateWidth / 2;
  const thicknessRange = maxThickness - minThickness;
  const chamferWidth =
    borderWidth > 0 ? Math.min(LITHOPHANE_BORDER_CHAMFER_MM, borderWidth) : 0;
  const borderFlat = borderWidth - chamferWidth;
  const positions: number[] = [];
  // uv в долях плиты: по ним подсветка накладывает карту свечения на рельеф.
  const uvs: number[] = [];
  const indices: number[] = [];

  // contain: кадр виден целиком. Пропорции сохраняются, а разница между
  // кадром и плитой уходит в поля — они печатаются на минимальной толщине и на
  // просвет остаются светлыми. Прежнее правило cover обрезало края кадра, и
  // загруженное фото теряло часть изображения.
  const fit = lithophaneContainRect(
    brightnessWidth,
    brightnessHeight,
    plateWidth,
    plateHeight,
  );
  // Половина шага вершины в долях кадра: по этой площади усредняется яркость,
  // иначе точка выборки совпадает с центром пикселя сетки и интерполяция между
  // соседями не работает — на краях букв остаётся лесенка.
  const spreadU = columns > 1 ? fit.width / (columns - 1) / 2 : 0;
  const spreadV = rows > 1 ? fit.height / (rows - 1) / 2 : 0;

  // Лицо рельефа: одна вершина на узел сетки. Строка 0 — верхний край, как у
  // массива яркости; яркость 0 — самый толстый пластик, 255 — самый тонкий.
  for (let row = 0; row < rows; row += 1) {
    const v = rows > 1 ? row / (rows - 1) : 0;
    const y = plateHeight - v * plateHeight;
    const fromTop = v * plateHeight;
    const fromBottom = plateHeight - fromTop;
    const sourceV = (v - fit.top) / fit.height;
    const insideRow = sourceV >= 0 && sourceV <= 1;

    for (let column = 0; column < columns; column += 1) {
      const u = columns > 1 ? column / (columns - 1) : 0;
      const x = -halfWidth + u * plateWidth;
      const fromLeft = u * plateWidth;
      const fromRight = plateWidth - fromLeft;
      const sourceU = (u - fit.left) / fit.width;
      // Вершина вне кадра — это поле: пластик на минимальной толщине. Край
      // кадра остаётся резким, как и на самом снимке, а сглаживать переход
      // нечем: за кадром яркости нет.
      const photoThickness =
        insideRow && sourceU >= 0 && sourceU <= 1
          ? maxThickness -
            thicknessRange *
              (sharpenBrightness(
                brightness,
                brightnessWidth,
                brightnessHeight,
                sourceU,
                sourceV,
                spreadU,
                spreadV,
              ) /
                255)
          : minThickness;
      const edgeDistance = Math.min(fromLeft, fromRight, fromTop, fromBottom);
      let thickness = photoThickness;

      if (chamferWidth > 0 && edgeDistance < borderWidth) {
        thickness =
          edgeDistance <= borderFlat
            ? maxThickness
            : maxThickness +
              (photoThickness - maxThickness) *
                ((edgeDistance - borderFlat) / chamferWidth);
      }

      positions.push(x, y, thickness);
      // uv идут по плите, а не по кадру: карта свечения строится под пропорции
      // плиты (кадр по центру, поля белые), поэтому кадр и подсветка совпадают.
      uvs.push(u, v);
    }
  }

  // Углы плите скругляются до построения тыла и боковин: они копируют уже
  // сдвинутые координаты, поэтому обе оболочки остаются замкнутыми.
  roundPlateCorners(positions, halfWidth, plateHeight / 2, cornerRadius);

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = a + columns;

      // a — левый верхний угол ячейки, c — правый нижний. Такой обход даёт
      // нормаль +Z, то есть лицо смотрит на камеру и на слайсер сверху.
      indices.push(a, d, c, a, c, b);
    }
  }

  const boundary = collectBoundaryIndices(columns, rows);
  const bottomBoundary: number[] = [];

  // Тыл повторяет контур лица по X/Y и лежит на Z = 0. Отдельные вершины
  // нужны, чтобы плоская задняя стенка не делила нормали с рельефом.
  for (const topIndex of boundary) {
    bottomBoundary.push(vertexIndex(positions));
    positions.push(
      positions[topIndex * 3],
      positions[topIndex * 3 + 1],
      0,
    );
    // Тыл лежит под лицом в тех же X/Y: uv повторяют вершину контура.
    uvs.push(uvs[topIndex * 2], uvs[topIndex * 2 + 1]);
  }

  const centerIndex = vertexIndex(positions);
  positions.push(0, plateHeight / 2, 0);
  uvs.push(0.5, 0.5);

  const boundaryCount = boundary.length;

  for (let edge = 0; edge < boundaryCount; edge += 1) {
    const next = (edge + 1) % boundaryCount;
    const topA = boundary[edge];
    const topB = boundary[next];
    const bottomA = bottomBoundary[edge];
    const bottomB = bottomBoundary[next];
    const dx = positions[topB * 3] - positions[topA * 3];
    const dy = positions[topB * 3 + 1] - positions[topA * 3 + 1];

    addOrientedQuad(
      indices,
      positions,
      topA,
      topB,
      bottomB,
      bottomA,
      [dy, -dx, 0],
    );
    addOrientedTriangle(
      indices,
      positions,
      centerIndex,
      bottomA,
      bottomB,
      [0, 0, -1],
    );
  }

  const geometry = finalizeGeometry(positions, indices);

  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));

  return geometry;
}

/**
 * Габариты плиты рельефа, мм.
 *
 * С рамкой плита меньше панели на два бортика и на два зазора посадки; без
 * рамки панель и есть плита. API зовёт эту функцию до сборки: по ней видно,
 * влезает ли сетка в бюджет треугольников.
 */
export function lithophanePlateSize(params: Partial<LithophaneParams>): {
  width: number;
  height: number;
} {
  const normalized = normalizeLithophaneParams(params);

  if (!normalized.lithoFrame) {
    return {
      width: normalized.lithophaneWidth,
      height: normalized.lithophaneHeight,
    };
  }

  const metrics = lithophaneFrameMetrics(normalized);

  return { width: metrics.plateWidth, height: metrics.plateHeight };
}

/**
 * Плита рельефа отдельной деталью.
 *
 * `Partial<LithophaneParams>` допустим и на клиенте: normalizeLithophaneParams
 * дополнит недостающие поля значениями по умолчанию. Если массив яркости
 * повреждён, нормализация подставит демонстрационный рельеф — предпросмотр
 * останется рабочим.
 */
export function createLithophaneReliefGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const plate = lithophanePlateSize(normalized);
  // Без рамки плита прямоугольная: скруглять её не к чему, а в паз рамки она
  // входит только вместе с его радиусом.
  const cornerRadius = normalized.lithoFrame
    ? lithophaneFrameMetrics(normalized).plateCornerRadius
    : 0;

  const geometry = createReliefBody(
    normalized,
    plate.width,
    plate.height,
    LITHOPHANE_BORDER_MM,
    cornerRadius,
  );
  const radius = lithophaneBendRadius(normalized);

  if (radius === null) {
    return geometry;
  }

  // Сначала нарезка полосами, потом изгиб: иначе фан тыла и боковины остались бы
  // плоскими хордами через всю ширину плиты.
  const strips = subdivideAlongX(geometry, LITHOPHANE_BEND_STRIP_MM);

  geometry.dispose();
  bendGeometryAroundY(strips, radius);

  return strips;
}

/**
 * Замкнутый параллелепипед по двум углам.
 *
 * Подставка и петли — набор коробок: так каждая деталь состоит из нескольких
 * замкнутых оболочек, которые объединяются с нахлёстом. Все шесть граней
 * получают свои вершины, поэтому рёбра остаются острыми.
 */
function createBoxBody(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  addQuadFace(
    indices,
    positions,
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
    ],
    [0, 0, -1],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [0, 0, 1],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    [0, -1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [0, 1, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x0, y0, z0],
      [x0, y1, z0],
      [x0, y1, z1],
      [x0, y0, z1],
    ],
    [-1, 0, 0],
  );
  addQuadFace(
    indices,
    positions,
    [
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x1, y0, z1],
    ],
    [1, 0, 0],
  );

  return finalizeGeometry(positions, indices);
}

/** Точка контура в плоскости XY, мм. */
type Point2 = readonly [number, number];

/**
 * Контур скруглённого прямоугольника против часовой стрелки.
 *
 * Обход начинается дугой правого нижнего угла: от (halfWidth − r, −halfHeight)
 * против часовой стрелки до (halfWidth, −halfHeight + r), дальше правая кромка,
 * дуга правого верхнего угла и так по кругу. Прямые кромки не разбиваются на
 * точки — их дают рёбра между последней точкой одной дуги и первой точкой
 * следующей. Углы всех четырёх дуг разбиты одинаково, поэтому наружный и
 * внутренний контуры кольца совпадают по числу точек: кольцо строится парами
 * `outer[i] — inner[i]` без поиска соответствий.
 *
 * Радиус не больше половины стороны: иначе дуга не поместилась бы в
 * прямоугольник.
 */
function roundedRectOutline(
  halfWidth: number,
  halfHeight: number,
  radius: number,
): Point2[] {
  const r = Math.max(0.001, Math.min(radius, halfWidth, halfHeight));
  // Центры дуг и начальный угол каждой: правый нижний, правый верхний, левый
  // верхний и левый нижний.
  const corners: readonly (readonly [number, number, number])[] = [
    [halfWidth - r, -halfHeight + r, -Math.PI / 2],
    [halfWidth - r, halfHeight - r, 0],
    [-halfWidth + r, halfHeight - r, Math.PI / 2],
    [-halfWidth + r, -halfHeight + r, Math.PI],
  ];
  const points: Point2[] = [];

  for (const [centerX, centerY, start] of corners) {
    for (let step = 0; step <= LITHOPHANE_CORNER_SEGMENTS; step += 1) {
      const angle =
        start + (step / LITHOPHANE_CORNER_SEGMENTS) * (Math.PI / 2);

      points.push([
        centerX + r * Math.cos(angle),
        centerY + r * Math.sin(angle),
      ]);
    }
  }

  return points;
}

/** Скруглённое кольцо, выдавленное по Z: задняя полка рамки и её накладка. */
type RingOptions = {
  centerX: number;
  centerY: number;
  outerWidth: number;
  outerHeight: number;
  innerWidth: number;
  innerHeight: number;
  /** Радиус скругления наружных углов, мм. */
  outerRadius: number;
  /** Радиус скругления окна, мм. */
  innerRadius: number;
  z0: number;
  z1: number;
};

/**
 * Замкнутое скруглённое кольцо: наружные и внутренние стенки плюс две полосы
 * по торцам.
 *
 * Кольцо — основа рамки: задняя полка держит плиту, передняя накладка её
 * прижимает. Обе собираются из одного кода и отличаются только размерами окна,
 * высотой по Z и радиусами углов. Торец разбит на столько же участков, сколько
 * у контура точек: каждая пара соседних точек наружного контура вместе с парой
 * внутреннего даёт квад, поэтому скругление идёт по дуге, а не срезом.
 */
function createRingBody(options: RingOptions): BufferGeometry {
  const {
    centerX,
    centerY,
    outerWidth,
    outerHeight,
    innerWidth,
    innerHeight,
    outerRadius,
    innerRadius,
    z0,
    z1,
  } = options;
  const outer = roundedRectOutline(outerWidth / 2, outerHeight / 2, outerRadius);
  const inner = roundedRectOutline(innerWidth / 2, innerHeight / 2, innerRadius);
  const count = outer.length;
  const positions: number[] = [];
  const indices: number[] = [];
  const at = (point: Point2, z: number): Point3 => [
    centerX + point[0],
    centerY + point[1],
    z,
  ];

  // Торцы: полоса между наружным и внутренним контуром на обеих плоскостях.
  for (const z of [z0, z1]) {
    const normal: Point3 = z === z0 ? [0, 0, -1] : [0, 0, 1];

    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;

      addQuadFace(
        indices,
        positions,
        [
          at(outer[index], z),
          at(outer[next], z),
          at(inner[next], z),
          at(inner[index], z),
        ],
        normal,
      );
    }
  }

  // Стенки: наружные смотрят от центра, внутренние — в окно. Для обхода против
  // часовой стрелки внешняя нормаль ребра равна (dy, −dx), у окна она
  // разворачивается.
  for (const [outline, direction] of [
    [outer, 1],
    [inner, -1],
  ] as const) {
    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;
      const dx = outline[next][0] - outline[index][0];
      const dy = outline[next][1] - outline[index][1];

      addQuadFace(
        indices,
        positions,
        [
          at(outline[index], z0),
          at(outline[next], z0),
          at(outline[next], z1),
          at(outline[index], z1),
        ],
        [direction * dy, direction * -dx, 0],
      );
    }
  }

  return finalizeGeometry(positions, indices);
}

/**
 * Световой короб подвеса: замкнутые куски, из которых собирается `hook`.
 *
 * Короб открыт вперёд — в окно рамки, — и встаёт на её тыльную полку: стенки
 * занимают полосу полки шириной 8.4 мм, поэтому скруглённые углы рамки остаются
 * открытыми, а с лица крепление не видно совсем. Внутри короба канал под ленту:
 * пол на высоте полки (лента светит вдоль тыла плиты с нижней кромки кадра),
 * спереди бортик 2 мм, сзади тыльная стенка. Тыл плиты закрыт от комнаты, свет
 * уходит только в окно.
 *
 * В тыльной стенке — окно под провод на уровне пола канала: провод сходит с
 * ленты и уходит за короб горизонтально, не перегибаясь. Петли на внешней
 * стороне той же стенки держат литофан на шурупах: между стенкой и стеной
 * остаётся `hookReach` 12 мм — провод проходит свободно, а шляпка шурупа
 * прячется в кармане над полкой петли.
 */
function createWallBoxBodies(width: number, height: number): BufferGeometry[] {
  const box = LITHOPHANE_WALL_BOX;
  const overlap = BODY_OVERLAP_MM;
  const halfWidth = width / 2 - box.inset;
  const bottom = box.inset;
  const top = height - box.inset;
  const backZ = -box.depth;
  const innerZ = backZ + box.wall;
  const innerHalf = halfWidth - box.wall;
  const sillTop = box.channelFloor;
  const wireHalf = box.wireWidth / 2;
  const wireTop = sillTop + box.wireHeight;
  // Канал отсчитывается от тыльной стенки: лента 8–10 мм упирается в неё, а
  // бортик спереди закрывает её от комнаты.
  const railBack = innerZ + box.channelWidth;
  // Стенки и подоконник заходят на тыльную полку рамки на нахлёст: короб
  // держится за полку, а не за её тонкий торец.
  const frontZ = overlap;
  const bodies: BufferGeometry[] = [
    // Тыльная стенка: плита над окном под провод и два уха по бокам от окна.
    createBoxBody(
      -halfWidth,
      halfWidth,
      wireTop,
      top,
      backZ,
      innerZ + overlap,
    ),
    createBoxBody(
      -halfWidth,
      -wireHalf,
      bottom,
      wireTop + overlap,
      backZ,
      innerZ + overlap,
    ),
    createBoxBody(
      wireHalf,
      halfWidth,
      bottom,
      wireTop + overlap,
      backZ,
      innerZ + overlap,
    ),
    // Подоконник: дно короба и пол канала одним куском — от тыла до полки рамки.
    // До тыльной стенки он доходит для того, чтобы окно под провод осталось ровно
    // `wireWidth × wireHeight` с дном на полу канала, а не открывалось вниз.
    createBoxBody(-innerHalf, innerHalf, bottom, sillTop, backZ, frontZ),
    // Стенки короба — по полосе тыльной полки рамки. Верх стенок не доходит до
    // верха короба на нахлёст: верхняя стенка ложится на них сверху, и общих
    // кромок у двух оболочек не остаётся.
    createBoxBody(
      -halfWidth,
      -innerHalf + overlap,
      bottom,
      top - overlap,
      innerZ - overlap,
      frontZ,
    ),
    createBoxBody(
      innerHalf - overlap,
      halfWidth,
      bottom,
      top - overlap,
      innerZ - overlap,
      frontZ,
    ),
    createBoxBody(
      -halfWidth,
      halfWidth,
      top - box.wall,
      top,
      innerZ - overlap,
      frontZ,
    ),
    // Бортик канала: держит ленту и не даёт свету бить вниз из-под плиты.
    createBoxBody(
      -innerHalf,
      innerHalf,
      sillTop - overlap,
      sillTop + box.channelDepth,
      railBack,
      frontZ,
    ),
  ];

  // Петли: полка с бортиком. Шуруп входит в стену над полкой, литофан
  // опускается на него, шляпка остаётся в кармане между стенкой и бортиком.
  // Полка начинается за бортиком на нахлёст: иначе у них совпала бы передняя
  // кромка, и в объединённой сетке на этом ребре сошлись бы четыре грани.
  const hookHalf = Math.min(box.hookWidth / 2, innerHalf / 2);
  const hookCenter = halfWidth - box.wall - box.hookInset - hookHalf;
  const shelfTop = top - 3;
  const shelfBottom = shelfTop - box.hookShelf;
  const shelfFront = backZ - box.hookReach + box.hookLip - overlap;

  for (const centerX of [-hookCenter, hookCenter]) {
    bodies.push(
      createBoxBody(
        centerX - hookHalf,
        centerX + hookHalf,
        shelfBottom,
        shelfTop,
        shelfFront,
        backZ + overlap,
      ),
      createBoxBody(
        centerX - hookHalf,
        centerX + hookHalf,
        shelfBottom,
        top,
        backZ - box.hookReach,
        backZ - box.hookReach + box.hookLip,
      ),
    );
  }

  return bodies;
}

/**
 * Рамка литофана отдельной деталью.
 *
 * Задняя полка поднимается до `LITHOPHANE_FRAME_SEAT_MM`, и её внутренний край
 * заходит под плиту на ширину накладки: плита ложится на полку и не проваливается
 * в окно. Передняя накладка начинается чуть ниже верха полки (нахлёст для
 * объединения) и поднимается над самым толстым пикселем на 0.4 мм — рельеф не
 * выступает за лицевую плоскость, и литофан можно ставить лицом вниз.
 *
 * При креплении `hook` тыл рамки закрывает световой короб: канал под ленту, окно
 * под провод в тыльной стенке и две петли на ней (см. `createWallBoxBodies`).
 * Литофан висит на шурупах с зазором 12 мм от стены, а лента подсвечивает плиту
 * сзади — крепление и подсветка стали одной деталью.
 *
 * Оба кольца — скруглённые: наружные углы идут дугой
 * `LITHOPHANE_FRAME_CORNER_RADIUS_MM`, окно накладки — дугой
 * `LITHOPHANE_FRAME_OPENING_RADIUS_MM`, окно полки — на накладку шире. Радиусы
 * ограничены четвертью своего прямоугольника, поэтому маленькая панель 40 мм
 * остаётся целой, а не превращается в овал.
 */
export function createLithophaneFrameGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const metrics = lithophaneFrameMetrics(normalized);
  const { width, height, frameWidth, lip, frontZ } = metrics;
  const bodies: BufferGeometry[] = [
    createRingBody({
      centerX: 0,
      centerY: height / 2,
      outerWidth: width,
      outerHeight: height,
      innerWidth: width - 2 * (frameWidth + lip),
      innerHeight: height - 2 * (frameWidth + lip),
      outerRadius: metrics.cornerRadius,
      innerRadius: metrics.seatRadius,
      z0: 0,
      z1: LITHOPHANE_FRAME_SEAT_MM,
    }),
    createRingBody({
      centerX: 0,
      centerY: height / 2,
      outerWidth: width,
      outerHeight: height,
      innerWidth: width - 2 * frameWidth,
      innerHeight: height - 2 * frameWidth,
      outerRadius: metrics.cornerRadius,
      innerRadius: metrics.openingRadius,
      z0: LITHOPHANE_FRAME_SEAT_MM - 2 * BODY_OVERLAP_MM,
      z1: frontZ,
    }),
  ];

  if (
    normalized.lithoMount === "hook" &&
    lithophaneShapeHasMounts(normalized.lithoShape)
  ) {
    bodies.push(...createWallBoxBodies(width, height));
  }

  // Рамка собирается из двух колец и петель, но печатается одной деталью:
  // сварка вершин и пересчёт нормалей делают её поверхность гладкой — на
  // предпросмотре она читается литой и матовой, а не набором плоскостей.
  const merged = mergeBodies(bodies, "рамки");
  const radius = lithophaneBendRadius(normalized);

  if (radius === null) {
    return smoothGeometryNormals(merged);
  }

  // Нарезка идёт до сварки: верхняя и нижняя кромки рамки — по одной длинной
  // грани, и без полос они остались бы хордами. Сварка после нарезки возвращает
  // общие вершины полос, поэтому поверхность снова гладкая.
  const strips = subdivideAlongX(merged, LITHOPHANE_BEND_STRIP_MM);
  const frame = smoothGeometryNormals(strips);

  merged.dispose();
  // Радиус у рамки тот же, что у плиты: окно, полка и накладка получают то же
  // смещение по X, поэтому зазор посадки по всему периметру не меняется.
  bendGeometryAroundY(frame, radius);

  return frame;
}

/**
 * Объединяет оболочки детали в одну сетку и освобождает исходные.
 *
 * `mergeGeometries` копирует данные в новую сетку; без dispose каждая правка
 * слайдера оставляла бы в памяти старые буферы.
 */
function mergeBodies(
  bodies: BufferGeometry[],
  name: string,
): BufferGeometry {
  /*
    uv размечает только рельеф: по ним предпросмотр кладёт карту свечения при
    подсветке. `mergeGeometries` требует одинаковый набор атрибутов у всех тел,
    поэтому рамке и подставке дописываются нулевые uv. Материал крепления карт
    не читает, а сварка вершин видит в совпадающих точках те же значения и, как
    раньше, склеивает стыки деталей.
  */
  const uvAttributes = bodies.map((body) => body.getAttribute("uv"));

  if (uvAttributes.some(Boolean)) {
    for (const body of bodies) {
      if (!body.getAttribute("uv")) {
        const count = body.getAttribute("position")?.count ?? 0;

        body.setAttribute(
          "uv",
          new Float32BufferAttribute(new Float32Array(count * 2), 2),
        );
      }
    }
  }

  const merged = mergeGeometries(bodies);

  for (const body of bodies) {
    body.dispose();
  }

  if (!merged) {
    throw new Error(`Не удалось объединить детали литофана: ${name}`);
  }

  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}

/**
 * Сглаживает нормали детали.
 *
 * Вершины свариваются по координатам, и нормали считаются заново: рамка
 * перестаёт выглядеть набором плоскостей — свет ложится градиентом, поверхность
 * читается литой и матовой. Рельеф так не сглаживается: там нормаль вершины
 * задаёт высоту пикселя и должна считаться по сетке рельефа.
 *
 * Сварка не меняет топологию: совпадающие вершины и раньше лежали в одних и тех
 * же точках, поэтому каждая оболочка остаётся замкнутой, а число треугольников
 * не меняется.
 */
function smoothGeometryNormals(geometry: BufferGeometry): BufferGeometry {
  geometry.deleteAttribute("normal");

  const welded = mergeVertices(geometry, 1e-4);

  geometry.dispose();
  welded.computeVertexNormals();
  welded.computeBoundingBox();
  welded.computeBoundingSphere();

  return welded;
}

/** Деталь без второй половины: вся сетка красится материалом своей группы. */
function markPartGroup(
  geometry: BufferGeometry,
  material: number,
): BufferGeometry {
  geometry.clearGroups();
  geometry.addGroup(0, geometry.getIndex()?.count ?? 0, material);

  return geometry;
}

/** Две группы собранной сетки: рельеф с начала индексов, крепление — до конца. */
function assignMaterialGroups(
  geometry: BufferGeometry,
  reliefIndices: number,
): BufferGeometry {
  const total = geometry.getIndex()?.count ?? 0;

  geometry.clearGroups();
  geometry.addGroup(0, reliefIndices, LITHOPHANE_RELIEF_GROUP);

  if (total > reliefIndices) {
    geometry.addGroup(
      reliefIndices,
      total - reliefIndices,
      LITHOPHANE_DETAIL_GROUP,
    );
  }

  return geometry;
}


/**
 * Профиль подставки в плоскости YZ: высота над столом и глубина.
 *
 * `smooth` — точка лежит на скруглении: соседние рёбра делят её вершины, и свет
 * ложится градиентом. На острых углах вершины раздельные, грань остаётся резкой.
 */
type StandProfilePoint = {
  y: number;
  z: number;
  smooth?: boolean;
};

/** Размеры профиля подставки: различают простую ножку и массивное основание. */
type StandShape = {
  /** Ширина базы: доля ширины панели и минимум в миллиметрах. */
  widthFactor: number;
  minWidth: number;
  /** Тыльная и передняя кромки базы по Z, мм. */
  back: number;
  front: number;
  /** Верх базы: на нём стоит рамка, мм. */
  baseTop: number;
  /** Толщина и высота наклонной стойки, мм. */
  strutThickness: number;
  strutTop: number;
  /** Радиус скругления в углу «база — стойка», мм. */
  filletRadius: number;
  /** Передняя губа: толщина и высота над базой, мм. */
  lipThickness: number;
  lipHeight: number;
};

/**
 * Два типа подставки.
 *
 * Ножка: база 66 % ширины панели (не уже 58 мм) уходит назад на 38 мм — этого
 * хватает панели 120 × 80. Массивное основание: база 92 % ширины и 52 мм назад,
 * сама база 9 мм вместо 6, стойка 8 мм вместо 4 и скругление 7 мм вместо 4.
 * Панель 200 × 150 весит около 120 г, её центр тяжести на наклоне 12° вынесен
 * вперёд — узкая ножка опрокидывалась бы, а толстая стойка со скруглением не
 * отламывается от базы при снятии со стола.
 *
 * Числа наружу нужны тесту: он сверяет габарит готовой детали с профилем, из
 * которого она построена, а не с зашитыми в тест миллиметрами.
 */
export const LITHOPHANE_STAND_SHAPES = {
  leg: {
    widthFactor: 0.66,
    minWidth: 58,
    back: -38,
    front: 12,
    baseTop: 6,
    strutThickness: 4,
    strutTop: 30,
    filletRadius: 4,
    lipThickness: 2.5,
    lipHeight: 4,
  },
  massive: {
    widthFactor: 0.92,
    minWidth: 76,
    back: -52,
    front: 16,
    baseTop: 9,
    strutThickness: 8,
    strutTop: 34,
    filletRadius: 7,
    lipThickness: 3,
    lipHeight: 5,
  },
} as const satisfies Record<"leg" | "massive", StandShape>;

/** Сколько отрезков у скругления: восемь шагов по 13° дают гладкую дугу. */
const STAND_FILLET_SEGMENTS = 8;

/**
 * Открытая подставка: база с пазом под рамку и каналом под светодиодную ленту.
 *
 * Сплошная стойка старой ножки во всю ширину закрывала нижние 30 мм панели:
 * на просвет там оставалось тёмное пятно, а светодиодную ленту поставить было
 * некуда. Здесь стойки нет — её заменяют две ножки по краям базы, между ними
 * панель открыта сзади и свет проходит к низу кадра.
 *
 * База 55 мм глубиной (от `back` до `front`) и 6 мм высотой несёт три выборки:
 *   - паз под рамку: глубина `seatDepth` 3.5 мм, стенки наклонены на 12°, то
 *     есть параллельны панели, а дно горизонтально. Рамка не упирается в глухую
 *     стену, а опускается в паз и держится в нём без клея;
 *   - канал под ленту: 10 мм по глубине и 2 мм по высоте, сразу за пазом.
 *     Стандартная лента 8–10 мм ложится в него и светит вверх, на тыл кадра;
 *   - канавка под провод: 2.4 мм шириной и 2 мм глубиной у тыльной кромки —
 *     провод выходит вбок по канавке, и база стоит на столе всей плоскостью.
 *
 * Ножки 6 × 5 мм стоят по краям базы и наклонены вместе с панелью: их передние
 * плоскости повторяют плоскость тыла рамки, поэтому рамка опирается на них всей
 * плоскостью, а не ребром. Высота `legTop` 34 мм выше старой стойки: опора
 * разнесена по краям, и панель не качается вокруг вертикальной оси.
 */
export const LITHOPHANE_ARCH_STAND = {
  /** Ширина базы: доля ширины панели и минимум в миллиметрах. */
  widthFactor: 0.92,
  minWidth: 76,
  /** Тыльная и передняя кромки базы по Z, мм. */
  back: -46,
  front: 9,
  /** Высота базы над столом, мм. */
  baseTop: 6,
  /** Глубина паза под рамку вдоль плоскости панели, мм. */
  seatDepth: 3.5,
  /** Канал под светодиодную ленту: ширина по Z, глубина по Y, мм. */
  channelWidth: 10,
  channelDepth: 2,
  /** Зазор от тыла рамки до передней стенки канала, мм. */
  channelGap: 1.4,
  /** Канавка под провод: ширина по Z и глубина по Y, мм. */
  wireWidth: 2.4,
  wireDepth: 2,
  /** Расстояние от тыльной кромки базы до канавки, мм. */
  wireGap: 6,
  /**
   * Ножка: ширина по X, толщина по нормали к панели, высота, мм.
   *
   * Ножка наклонена вместе с панелью и уходит в базу на 1 мм. Внутри базы она
   * заходит и в канал ленты: его передние 3.3 мм на краях закрыты ножкой. Иначе
   * задняя стенка ножки нависала бы над открытым каналом и печаталась с
   * поддержкой — а так она повторяет наклон 12°, и деталь печатается как есть.
   * Лента укладывается между ножками: на панели 120 мм это 98.4 мм.
   */
  legWidth: 6,
  legThickness: 5,
  legTop: 34,
  /**
   * Тыльная кромка базы под патрон E27, мм.
   *
   * Гнезду Ø40 с прорезью под провод нужно 44 мм позади паза рамки, а наклонная
   * панель над базой оставляет спереди только 6 мм: при кромке −46 цилиндр
   * наезжал бы на тыл рамки. Поэтому база под патрон глубже на 10 мм — 65 мм
   * вместо 55, и центр гнезда стоит на −28: под кромкой абажура Ø54 (−55) остаётся
   * ещё 1 мм материала, и кромка не свисает за базу.
   */
  socketBack: -56,
} as const;

/**
 * USB-лампа в базе открытой арки: круглая стойка с чашей под колбу.
 *
 * Штекер Type-A — 12 × 4.5 мм и 12 мм длиной, поэтому канал Ø14.2: запас на
 * сторону, чтобы лампа входила от руки. Канал проходит сквозь стойку и упирается
 * в верх базы — штекер стоит на ней, до стола не достаёт, а лампа не висит на
 * стенках. Колба Ø20–28 мм ложится в чашу на кромке стойки: дно чаши сходится к
 * каналу, поэтому лампа центрируется сама и не качается.
 *
 * Стойка — тело вращения, а не призма с пропилом: подошва Ø34 входит в базу на
 * 1 мм, пояс Ø28 на 15 мм и кромка Ø34 на 26 мм дают силуэт вазы, и с лица
 * крепление читается одной плавной деталью. Чаша — конус с плавной образующей,
 * её поверхность смотрит вверх, поэтому стойка печатается без поддержек, а
 * канал и чаша закрыты сверху: штекера и провода не видно. Передняя точка
 * стойки стоит на 5 мм позади плоскости панели — из зала крепление не заметно.
 */
export const LITHOPHANE_USB_LIGHT = {
  /** Ось стойки по Z, мм. */
  centerZ: -27,
  /** Радиус и высота подошвы, пояса и кромки, мм. */
  footRadius: 17,
  footY: 5,
  waistRadius: 14,
  waistY: 15,
  rimRadius: 17,
  rimY: 26,
  /** Ширина кольцевой кромки чаши, мм. */
  rimWidth: 2,
  /** Радиус канала под штекер, мм. */
  channelRadius: 7.1,
  /** Глубина чаши: на сколько её дно ниже кромки, мм. */
  bowlDepth: 6,
  /** Провис управляющей точки чаши: доля её глубины. */
  bowlBelly: 0.25,
  /** Отрезков на оборот стойки и на образующую чаши. */
  segments: 96,
  bowlSegments: 12,
} as const;

/**
 * Патрон E27 в базе открытой арки: стакан с гнездом, прорезью под провод и
 * наклонным абажуром.
 *
 * Пластиковый патрон E27 — Ø40 мм и 30–40 мм высотой, поэтому гнездо Ø40 × 15 мм:
 * половина патрона прячется в стакане, вторая остаётся над базой под лампу.
 * Стенка 2 мм, дно гнезда на 3 мм выше верха базы — стакан стоит на базе, а не
 * висит на ней. Прорезь 18° во всю высоту стенки обращена назад: провод выходит
 * из патрона и уходит за тыльную кромку базы.
 *
 * Абажур — наклонный отражатель вокруг гнезда: конус от кромки стакана к
 * кромке Ø54 на 33 мм с вырезом 120° в сторону панели. Свет лампы идёт прямо в
 * кадр через вырез, а всё, что уходит назад и в стороны, конус возвращает вверх
 * на тыл панели. Вырез шире угла панели (панель 120 мм перекрывает ±68° от оси
 * гнезда), поэтому отражённый свет не бьёт в глаза из-за литофана. Кромка
 * абажура выше стакана на 9 мм, а его корень утоплен в стенку стакана — деталь
 * печатается как есть: наружная поверхность конуса наклонена на 29°.
 * База под патрон глубже на 10 мм: кромка абажура Ø54 не выходит за неё.
 */
export const LITHOPHANE_SOCKET_LIGHT = {
  /** Наружный диаметр стакана, мм. */
  outerDiameter: 44,
  /** Гнездо под патрон и его глубина, мм. */
  cavityDiameter: 40,
  cavityDepth: 15,
  /** Дно гнезда над верхом базы, мм. */
  floorAboveBase: 3,
  /** Центр гнезда по Z, мм. */
  centerZ: -28,
  /** Прорезь под провод: угол сектора, градусы. */
  wireSlotDeg: 18,
  /** Отрезков на оборот стакана: 96 сторон дают круг с ошибкой 0.01 мм. */
  segments: 96,
  /** Абажур: радиус и высота кромки, радиус и высота корня, мм. */
  shadeRootRadius: 21,
  shadeRootY: 22,
  shadeRimRadius: 27,
  shadeRimY: 33,
  /** Толщина стенки абажура по кромке, мм. */
  shadeWidth: 2,
  /** Вырез в сторону панели: угол и начало сектора от +Z, градусы. */
  shadeSweepDeg: 240,
  shadeStartDeg: 60,
} as const;

/**
 * Тыльная кромка базы арки для выбранного источника света, мм.
 *
 * Канал под ленту и стойка под USB-лампу укладываются в 55 мм базы, а стакану с
 * абажуром под патрон E27 нужно на 10 мм больше: кромка абажура Ø54 при центре
 * гнезда −28 доходит до −55, и кромка −46 оставила бы её висеть в воздухе.
 */
function archBaseBack(
  shape: typeof LITHOPHANE_ARCH_STAND,
  light: LithophaneLightSource,
): number {
  return light === "socket" ? shape.socketBack : shape.back;
}

/**
 * Размеры профиля сплошной подставки для выбранного крепления.
 *
 * Сплошная подставка печатается только при `stand` и `base`. Для остальных
 * креплений возвращается профиль ножки: сборке нужна высота её базы, даже когда
 * сама деталь в файл не попадает.
 */
function standShape(mount: LithophaneMount): StandShape {
  return mount === "base"
    ? LITHOPHANE_STAND_SHAPES.massive
    : LITHOPHANE_STAND_SHAPES.leg;
}

/**
 * Высота базы подставки: на неё сборка ставит наклонённую панель.
 *
 * У открытой арки высота своя (см. `LITHOPHANE_ARCH_STAND.baseTop`), у сплошных
 * подставок — из их профиля. Общая функция нужна сборке: она не знает, какая
 * деталь выбрана, а сдвиг панели по высоте зависит только от базы.
 */
function standBaseTop(mount: LithophaneMount): number {
  return mount === "arch"
    ? LITHOPHANE_ARCH_STAND.baseTop
    : standShape(mount).baseTop;
}

/**
 * Ширина базы подставки, мм.
 *
 * База шире панели не бывает и уже `minWidth` не бывает: на панели 120 × 80
 * открытая арка получает 110.4 мм — ножки стоят под краями рамки, а на маленькой
 * панели 40 мм ширина упирается в габарит.
 */
function standWidth(
  shape: { widthFactor: number; minWidth: number },
  panelWidth: number,
): number {
  return Math.min(
    panelWidth,
    Math.max(shape.minWidth, panelWidth * shape.widthFactor),
  );
}

/**
 * Профиль подставки: замкнутый контур в плоскости YZ.
 *
 * Спереди — губа, сзади — наклонная стойка под 12°, в углу между базой и
 * тыльной плоскостью стойки — скругление. Стойка и скругление считаются от
 * одной линии: лицевая плоскость стойки проходит через (Y = baseTop,
 * Z = BODY_OVERLAP_MM), поэтому тыл рамки входит в неё на 0.2 мм, и в собранном
 * файле детали держатся друг за друга.
 *
 * Скругление стоит в тыльном углу, а не в лицевом: лицевой угол — это паз, куда
 * опускается рамка, и материал там мешал бы посадке. Центр дуги выше базы на
 * радиус и на радиус же отодвинут от плоскости стойки, поэтому дуга касается
 * базы и стойки без изломов: напряжение от изгиба панели уходит в тело базы, а
 * не в тонкое ребро.
 */
function createStandProfile(
  shape: StandShape,
  lipBack: number,
): StandProfilePoint[] {
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  const slope = Math.tan(tilt);
  const cos = Math.cos(tilt);
  const baseTop = shape.baseTop;
  const frontAt = (y: number) => BODY_OVERLAP_MM - (y - baseTop) * slope;
  const backAt = (y: number) => frontAt(y) - shape.strutThickness / cos;
  const radius = shape.filletRadius;
  const centerY = baseTop + radius;
  const centerZ = backAt(centerY) - radius / cos;
  // Дуга в параметрическом виде: угол отсчитывается от направления на базу (π)
  // к направлению на стойку (π/2 − наклон). Касание стойки приходится на точку,
  // сдвинутую от центра на радиус по нормали её плоскости.
  const startAngle = Math.PI;
  const endAngle = Math.PI / 2 - tilt;
  const profile: StandProfilePoint[] = [
    { y: 0, z: shape.front },
    { y: 0, z: shape.back },
    { y: baseTop, z: shape.back },
    { y: baseTop, z: centerZ, smooth: true },
  ];

  for (let step = 1; step <= STAND_FILLET_SEGMENTS; step += 1) {
    const angle =
      startAngle + ((endAngle - startAngle) * step) / STAND_FILLET_SEGMENTS;

    profile.push({
      y: centerY + radius * Math.cos(angle),
      z: centerZ + radius * Math.sin(angle),
      smooth: true,
    });
  }

  profile.push(
    { y: shape.strutTop, z: backAt(shape.strutTop) },
    { y: shape.strutTop, z: frontAt(shape.strutTop) },
    { y: baseTop, z: frontAt(baseTop) },
    { y: baseTop, z: lipBack },
    { y: baseTop + shape.lipHeight, z: lipBack },
    { y: baseTop + shape.lipHeight, z: lipBack + shape.lipThickness },
    { y: baseTop, z: lipBack + shape.lipThickness },
    { y: baseTop, z: shape.front },
  );

  return profile;
}

/**
 * Профиль базы открытой подставки: замкнутый контур в плоскости YZ.
 *
 * Обход идёт от передней нижней кромки назад по дну, вверх по тыльной стенке и
 * дальше вперёд по верхней плоскости: в неё врезаны канавка провода, канал под
 * ленту и паз под рамку. Все выборки — часть одного контура, поэтому деталь
 * печатается одним профилем, без клея и без вычитания тел.
 *
 * Паз повторяет наклон панели: стенки параллельны плоскости тыла рамки, между
 * ними и рамкой остаётся зазор `LITHOPHANE_FIT_GAP_MM`, а дно лежит ниже верха
 * базы на `seatDepth`. Панель опускается в паз сверху и опирается на дно, так
 * что низ рамки не упирается в глухую стену. Канал под ленту начинается сразу за
 * тыльной стенкой паза: лента стоит в базе и светит вверх, на тыл кадра.
 *
 * Канал и канавка нужны только ленте. Под USB-лампу база остаётся гладкой, а
 * стойка с чашей собирается отдельным телом (`createUsbPodBody`). Под патрон E27
 * база глубже на `socketBack`: стакан Ø44 и абажур Ø54 уходят за кромку −46.
 */
function createArchBaseProfile(
  shape: typeof LITHOPHANE_ARCH_STAND,
  frameDepth: number,
  light: LithophaneLightSource,
): StandProfilePoint[] {
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  const slope = Math.tan(tilt);
  const cos = Math.cos(tilt);
  const baseTop = shape.baseTop;
  // Пока стенка паза опускается до дна, она уходит вперёд по Z на seatShift:
  // иначе наклонная рамка зажала бы её у верхней кромки.
  const seatShift = shape.seatDepth * cos * slope;
  const seatFloor = baseTop - shape.seatDepth * cos;
  const seatBack = -LITHOPHANE_FIT_GAP_MM;
  const seatFront = frameDepth + LITHOPHANE_FIT_GAP_MM;
  const back = archBaseBack(shape, light);
  const channelFront = seatBack - shape.channelGap;
  const channelBack = channelFront - shape.channelWidth;
  const wireFront = back + shape.wireGap;
  const wireBack = wireFront - shape.wireWidth;
  // Канал и канавка нужны только ленте: под USB-лампу и патрон они не годятся, а
  // под «без подсветки» в базе не должно быть лишних выборок.
  const withStrip = light === "strip";

  return [
    { y: 0, z: shape.front },
    { y: 0, z: back },
    { y: baseTop, z: back },
    // Канавка под провод у тыльной кромки: в ней лежит кабель, база стоит ровно.
    ...(withStrip
      ? [
          { y: baseTop, z: wireBack },
          { y: baseTop - shape.wireDepth, z: wireBack },
          { y: baseTop - shape.wireDepth, z: wireFront },
          { y: baseTop, z: wireFront },
        ]
      : []),
    // Канал под светодиодную ленту 8–10 мм.
    ...(withStrip
      ? [
          { y: baseTop, z: channelBack },
          { y: baseTop - shape.channelDepth, z: channelBack },
          { y: baseTop - shape.channelDepth, z: channelFront },
          { y: baseTop, z: channelFront },
        ]
      : []),
    // Паз под рамку: наклонные стенки и горизонтальное дно.
    { y: baseTop, z: seatBack },
    { y: seatFloor, z: seatBack + seatShift },
    { y: seatFloor, z: seatFront + seatShift },
    { y: baseTop, z: seatFront },
    // Передняя губа базы: рамка упирается в неё, а не в глухую стену.
    { y: baseTop, z: shape.front },
  ];
}

/**
 * Профиль ножки открытой подставки: параллелограмм в плоскости YZ.
 *
 * Передняя плоскость ножки параллельна тылу рамки и стоит на
 * `BODY_OVERLAP_MM` впереди неё: в собранном файле детали срастаются, а в
 * напечатанной подставке рамка прижимается к ножкам всей плоскостью. Низ ножки
 * уходит в базу на 1 мм — по этому стыку она срастается с базой, и отдельного
 * шва, по которому деталь отламывается, нет.
 */
function createArchLegProfile(
  shape: typeof LITHOPHANE_ARCH_STAND,
): StandProfilePoint[] {
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  const slope = Math.tan(tilt);
  const cos = Math.cos(tilt);
  const baseTop = shape.baseTop;
  const frontAt = (y: number) => BODY_OVERLAP_MM - (y - baseTop) * slope;
  const backAt = (y: number) => frontAt(y) - shape.legThickness / cos;
  /** Низ ножки внутри базы: на столько она уходит в её тело. */
  const bottom = 1;

  return [
    { y: bottom, z: frontAt(bottom) },
    { y: bottom, z: backAt(bottom) },
    { y: shape.legTop, z: backAt(shape.legTop) },
    { y: shape.legTop, z: frontAt(shape.legTop) },
  ];
}

/**
 * Образующая чаши под колбу USB-лампы: пары (радиус, высота) от кромки к каналу.
 *
 * Квадратичная кривая Безье с провисом: управляющая точка ниже хорды, поэтому
 * дно чаши получается воронкой — колба ложится в неё и сама съезжает к центру.
 * Двенадцать отрезков дают ошибку 0.02 мм: больше на чаше не нужно, а лишние
 * грани только удлиняют сетку.
 */
function usbBowlCurve(): [number, number][] {
  const light = LITHOPHANE_USB_LIGHT;
  const edge = light.rimRadius - light.rimWidth;
  const bottom = light.rimY - light.bowlDepth;
  const controlRadius = (edge + light.channelRadius) / 2;
  const controlHeight =
    (light.rimY + bottom) / 2 - light.bowlDepth * light.bowlBelly;
  const points: [number, number][] = [];

  for (let step = 0; step <= light.bowlSegments; step += 1) {
    const t = step / light.bowlSegments;
    const rest = 1 - t;

    points.push([
      rest * rest * edge +
        2 * rest * t * controlRadius +
        t * t * light.channelRadius,
      rest * rest * light.rimY + 2 * rest * t * controlHeight + t * t * bottom,
    ]);
  }

  return points;
}

/**
 * Стойка под USB-лампу: тело вращения — подошва, пояс, кромка, чаша и канал.
 *
 * Профиль замкнут и обходится по наружной стороне: подошва Ø34 на 5 мм (на 1 мм
 * внутрь базы — по этому стыку стойка срастается с базой), пояс Ø28 на 15 мм,
 * кромка Ø34 на 26 мм, кольцо кромки 2 мм, чаша к каналу Ø14.2 на 20 мм и канал
 * вниз до подошвы. Канал открыт только снизу, а его перекрывает верх базы:
 * штекер вставляют сверху через чашу, и он стоит на базе, не доставая до стола.
 * Торцы поворота не строятся: профиль заметает полный оборот, и его начало с
 * концом совпадает.
 */
function createUsbPodBody(): BufferGeometry {
  const light = LITHOPHANE_USB_LIGHT;
  const bowl = usbBowlCurve();
  const profile: (readonly [number, number])[] = [
    [light.channelRadius, light.footY],
    [light.footRadius, light.footY],
    [light.waistRadius, light.waistY],
    [light.rimRadius, light.rimY],
    [light.rimRadius - light.rimWidth, light.rimY],
    // Кромка уже есть в первой точке чаши — она и замыкает кольцо.
    ...bowl.slice(1),
  ];

  return createRevolvedBody(
    profile,
    light.centerZ,
    0,
    360,
    light.segments,
    false,
  );
}

/**
 * Замкнутая призма: профиль в плоскости YZ, выдавленный по X от x0 до x1.
 *
 * Торцы разбивает `ShapeUtils.triangulateShape`: профиль подставки невыпуклый
 * (губа и стойка), веер из одной вершины на нём не работает. Боковины собираются
 * из колец по две вершины; кольцо точки со `smooth` общее с соседним ребром,
 * поэтому скругление считается гладким ещё до финальной сварки нормалей.
 */
function createProfilePrismBody(
  profile: readonly StandProfilePoint[],
  x0: number,
  x1: number,
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  // Обход профиля влияет только на нормали: площадь приводит его к одному виду,
  // чтобы наружное направление ребра считалось по одной формуле.
  const samples = ShapeUtils.isClockWise(
    profile.map((point) => new Vector2(point.z, point.y)),
  )
    ? [...profile].reverse()
    : profile;
  const outline = samples.map((point) => new Vector2(point.z, point.y));
  const triangles = ShapeUtils.triangulateShape(outline, []);

  for (const [x, normal] of [
    [x0, [-1, 0, 0]],
    [x1, [1, 0, 0]],
  ] as const) {
    for (const triangle of triangles) {
      const first = vertexIndex(positions);

      for (const corner of triangle) {
        positions.push(x, samples[corner].y, samples[corner].z);
      }

      addOrientedTriangle(
        indices,
        positions,
        first,
        first + 1,
        first + 2,
        normal,
      );
    }
  }

  const rings: (readonly [number, number] | null)[] = samples.map(() => null);
  const ringAt = (index: number): readonly [number, number] => {
    const cached = rings[index];

    if (cached) {
      return cached;
    }

    const first = vertexIndex(positions);

    positions.push(
      x0,
      samples[index].y,
      samples[index].z,
      x1,
      samples[index].y,
      samples[index].z,
    );

    const ring: readonly [number, number] = [first, first + 1];

    if (samples[index].smooth) {
      rings[index] = ring;
    }

    return ring;
  };

  for (let index = 0; index < samples.length; index += 1) {
    const next = (index + 1) % samples.length;
    const from = samples[index];
    const to = samples[next];
    const start = ringAt(index);
    const end = ringAt(next);

    addOrientedQuad(
      indices,
      positions,
      start[0],
      end[0],
      end[1],
      start[1],
      [0, from.z - to.z, to.y - from.y],
    );
  }

  return finalizeGeometry(positions, indices);
}

/**
 * Тело вращения: замкнутый профиль в плоскости (радиус, высота), повёрнутый
 * вокруг вертикальной оси, проходящей через (X = 0, Z = centerZ).
 *
 * Профиль приводится к обходу против часовой стрелки: только тогда наружная
 * нормаль ребра равна (dy, −dr), и грань получает нужную сторону без
 * угадывания. Торцы поворота закрываются треугольниками самого профиля: у
 * прорези под провод две стенки, и без них тело осталось бы открытым.
 *
 * Вершины колец не переиспользуются — их всё равно сваривает
 * `smoothGeometryNormals`, а лишние копии топологию не портят. Точка на оси
 * (r = 0) даёт треугольник вместо четырёхугольника: две вершины совпали бы в
 * одной точке, и в сетке появилась бы грань нулевой площади.
 *
 * `withCaps` выключают для полного оборота: у профиля, заметающего 360°, начало
 * и конец совпадают, и торцы легли бы друг на друга двумя дисками внутри тела.
 */
function createRevolvedBody(
  profile: readonly (readonly [number, number])[],
  centerZ: number,
  startDeg: number,
  sweepDeg: number,
  segmentCount: number,
  withCaps = true,
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const outline = profile.map(([radius, height]) => new Vector2(radius, height));
  const samples = ShapeUtils.isClockWise(outline)
    ? [...outline].reverse()
    : outline;
  const start = (startDeg * Math.PI) / 180;
  const sweep = (sweepDeg * Math.PI) / 180;
  const at = (radius: number, height: number, angle: number): Point3 => [
    radius * Math.sin(angle),
    height,
    centerZ + radius * Math.cos(angle),
  ];
  const push = (point: Point3): number => {
    const index = vertexIndex(positions);

    positions.push(point[0], point[1], point[2]);

    return index;
  };

  for (let side = 0; side < samples.length; side += 1) {
    const from = samples[side];
    const to = samples[(side + 1) % samples.length];
    const dr = to.x - from.x;
    const dh = to.y - from.y;

    if (Math.hypot(dr, dh) < 1e-6 || (from.x <= 0 && to.x <= 0)) {
      continue;
    }

    for (let step = 0; step < segmentCount; step += 1) {
      const angle = start + (sweep * step) / segmentCount;
      const next = start + (sweep * (step + 1)) / segmentCount;
      const middle = (angle + next) / 2;
      // Наружная нормаль ребра в плоскости профиля — (dh, −dr); радиус смотрит
      // по (sin θ, cos θ), поэтому вектор нормали раскладывается по обеим осям.
      const normal: Point3 = [
        dh * Math.sin(middle),
        -dr,
        dh * Math.cos(middle),
      ];
      const a = push(at(from.x, from.y, angle));
      const b = push(at(to.x, to.y, angle));
      const c = push(at(to.x, to.y, next));
      const d = push(at(from.x, from.y, next));

      if (from.x <= 0) {
        addOrientedTriangle(indices, positions, a, b, c, normal);
      } else if (to.x <= 0) {
        addOrientedTriangle(indices, positions, a, b, d, normal);
      } else {
        addOrientedQuad(indices, positions, a, b, c, d, normal);
      }
    }
  }

  const caps = withCaps ? ShapeUtils.triangulateShape(samples, []) : [];
  const capEnds: readonly (readonly [number, number])[] = withCaps
    ? [
        [start, -1],
        [start + sweep, 1],
      ]
    : [];

  for (const [angle, sign] of capEnds) {
    const normal: Point3 = [
      sign * Math.cos(angle),
      0,
      -sign * Math.sin(angle),
    ];

    for (const triangle of caps) {
      const first = vertexIndex(positions);

      for (const corner of triangle) {
        const point = at(samples[corner].x, samples[corner].y, angle);

        positions.push(point[0], point[1], point[2]);
      }

      addOrientedTriangle(
        indices,
        positions,
        first,
        first + 1,
        first + 2,
        normal,
      );
    }
  }

  return finalizeGeometry(positions, indices);
}

/**
 * Стакан под патрон E27: тело вращения с прорезью под провод.
 *
 * Профиль в плоскости (радиус, высота): наружная стенка Ø44 от низа до кромки
 * гнезда, кромка 2 мм, внутренняя стенка Ø40 вниз до дна и дно. Низ стакана
 * уходит в базу на 4 мм — по этому стыку он срастается с базой, и отдельного
 * шва нет. Дно гнезда на 3 мм выше верха базы: патрон стоит в стакане, а не
 * висит на его стенках. Прорезь 18° обращена назад (θ = 180°): провод выходит из
 * патрона и уходит за тыльную кромку базы.
 */
function createSocketLightBody(
  shape: typeof LITHOPHANE_ARCH_STAND,
): BufferGeometry {
  const light = LITHOPHANE_SOCKET_LIGHT;
  const outerRadius = light.outerDiameter / 2;
  const cavityRadius = light.cavityDiameter / 2;
  const floor = shape.baseTop + light.floorAboveBase;
  const rim = floor + light.cavityDepth;
  const bottom = shape.baseTop - 4;

  return createRevolvedBody(
    [
      [0, bottom],
      [outerRadius, bottom],
      [outerRadius, rim],
      [cavityRadius, rim],
      [cavityRadius, floor],
      [0, floor],
    ],
    light.centerZ,
    180 + light.wireSlotDeg / 2,
    360 - light.wireSlotDeg,
    light.segments,
  );
}

/**
 * Абажур патрона: наклонный отражатель вокруг стакана.
 *
 * Профиль — треугольник: корень на радиусе 21 мм и высоте 22 мм утоплен в стенку
 * стакана (Ø40…Ø44), кромка Ø54 стоит на 33 мм, её кольцо 2 мм. Обе поверхности
 * сходятся в корне, поэтому нижней грани у абажура нет: наружная наклонена на
 * 29°, внутренняя — на 20°, и деталь печатается без поддержек. Корень внутри
 * стенки стакана даёт сварку по всему кольцу, а не касание по кромке.
 *
 * Сектор 240° начинается от 60°: вырез 120° смотрит на панель. Лампа светит в
 * кадр напрямую через вырез, а всё, что уходит назад и в стороны, конус
 * возвращает вверх на тыл панели. Панель 120 мм шириной перекрывает ±68° от оси
 * гнезда, поэтому отражённый свет не выходит за литофан и не слепит.
 */
function createSocketShadeBody(): BufferGeometry {
  const light = LITHOPHANE_SOCKET_LIGHT;

  return createRevolvedBody(
    [
      [light.shadeRootRadius, light.shadeRootY],
      [light.shadeRimRadius, light.shadeRimY],
      [light.shadeRimRadius - light.shadeWidth, light.shadeRimY],
    ],
    light.centerZ,
    light.shadeStartDeg,
    light.shadeSweepDeg,
    light.segments,
  );
}

/**
 * Подставка отдельной деталью: открытая арка, сплошная ножка или основание.
 *
 * База держит литофан на столе: спереди её край выходит за рамку, сзади уходит
 * на 38–52 мм — центр тяжести наклонённой панели остаётся над опорой. У сплошных
 * подставок передняя губа не даёт рамке съехать вперёд, а задняя стойка на 12°
 * повторяет наклон панели: рамка опирается на неё всей плоскостью, а не ребром.
 * Стойка, база и губа — один профиль, выдавленный по ширине детали: между ними
 * нет стыков, поэтому нет и шва, по которому деталь отламывается.
 *
 * У открытой арки вместо стойки две ножки по краям базы, а рамка опускается в
 * паз глубиной 3.5 мм — низ панели открыт, и свет от ленты проходит между
 * ножками к низу кадра.
 *
 * Координаты те же, что у собранного литофана: стол — Y = 0, тыльная плоскость
 * рамки проходит через (Y = baseTop, Z = 0). Стойка стоит на 0.2 мм впереди неё:
 * в сборке она входит в тыл рамки, и слайсер видит один объект. Поэтому панель,
 * вставленная в напечатанную подставку, сдвинута вперёд на те же 0.2 мм, а
 * зазор до губы остаётся прежним.
 */
export function createLithophaneStandGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);

  if (normalized.lithoMount === "arch") {
    return createArchStandGeometry(normalized);
  }

  const metrics = lithophaneFrameMetrics(normalized);
  const shape = standShape(normalized.lithoMount);
  const standSpan = standWidth(shape, normalized.lithophaneWidth);
  const tilt = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
  // Стойка заходит в тыл рамки на BODY_OVERLAP_MM: иначе в собранном файле два
  // тела только касались бы плоскостями и слайсер видел бы два объекта. Панель
  // от нахлёста сдвигается вперёд, поэтому губа отодвигается на ту же величину и
  // зазор посадки остаётся LITHOPHANE_FIT_GAP_MM.
  const lipBack =
    metrics.frontZ * Math.cos(tilt) + LITHOPHANE_FIT_GAP_MM + BODY_OVERLAP_MM;

  return smoothGeometryNormals(
    createProfilePrismBody(
      createStandProfile(shape, lipBack),
      -standSpan / 2,
      standSpan / 2,
    ),
  );
}

/**
 * Тела базы открытой арки для выбранного источника света.
 *
 * Лента и «без подсветки» — одна призма во всю ширину: все выборки вырезаны в её
 * профиле. Под патрон E27 добавляются стакан с прорезью под провод и абажур, под
 * USB-лампу — стойка с чашей. Оба тела вращения стоят на базе и пересекаются с
 * ней, а не касаются: в собранном файле это один объект, и шва по стыку нет.
 */
function createArchBaseBodies(
  shape: typeof LITHOPHANE_ARCH_STAND,
  frameDepth: number,
  standSpan: number,
  light: LithophaneLightSource,
): BufferGeometry[] {
  const bodies = [
    createProfilePrismBody(
      createArchBaseProfile(shape, frameDepth, light),
      -standSpan / 2,
      standSpan / 2,
    ),
  ];

  if (light === "socket") {
    bodies.push(createSocketLightBody(shape), createSocketShadeBody());
  } else if (light === "usb_bulb") {
    bodies.push(createUsbPodBody());
  }

  return bodies;
}

/**
 * Открытая подставка: база с пазом под рамку, креплением под свет и две ножки.
 *
 * Деталь собирается из замкнутых тел: база (или её части — см.
 * `createArchBaseBodies`) и две ножки по краям. Между ножками нет материала
 * выше базы, поэтому свет от лампы в базе доходит до низа панели — старая
 * сплошная стойка закрывала эти 30 мм.
 * Ножки и база пересекаются и объединяются `mergeBodies`: в файле это один
 * объект, шва по стыку нет.
 *
 * Проём между ножками считается по ширине базы: на панели 120 × 80 это
 * 110.4 − 2 × 6 = 98.4 мм — под ленту 8–10 мм с запасом, а опора разнесена
 * почти на всю ширину рамки, поэтому панель не качается. Стойка с чашей под
 * USB-лампу и стакан с абажуром под патрон стоят в середине и выше ножек не
 * поднимаются: свет остаётся открытым с обеих сторон.
 */
function createArchStandGeometry(
  normalized: LithophaneParams,
): BufferGeometry {
  const metrics = lithophaneFrameMetrics(normalized);
  const shape = LITHOPHANE_ARCH_STAND;
  const standSpan = standWidth(shape, normalized.lithophaneWidth);
  const leg = createArchLegProfile(shape);

  return smoothGeometryNormals(
    mergeBodies(
      [
        ...createArchBaseBodies(
          shape,
          metrics.frontZ,
          standSpan,
          normalized.lithoLightSource,
        ),
        createProfilePrismBody(
          leg,
          standSpan / 2 - shape.legWidth,
          standSpan / 2,
        ),
        createProfilePrismBody(
          leg,
          -standSpan / 2,
          -standSpan / 2 + shape.legWidth,
        ),
      ],
      "подставки",
    ),
  );
}

/**
 * Собирает литофан по детали: рельеф, рамка, подставка или всё сразу.
 *
 * `all` — собранный вид для предпросмотра и печати одним файлом: плита вставлена
 * в рамку, а с подставкой вся сборка наклонена на 12° и стоит на базе. Ножки
 * открытой арки входят в тыл рамки, а низ рамки опущен в её паз, поэтому детали
 * держатся друг за друга.
 * Без рамки крепления нет (его паз вырезан в рамке), поэтому `all` возвращает
 * плиту. У изогнутой панели и полуцилиндра сборка — плита в рамке без наклона:
 * подставка у этих форм не печатается, панель стоит сама.
 * Если деталь недоступна — например, `frame` при выключенной рамке, — функция
 * отдаёт рельеф: предпросмотр не должен падать из-за состояния формы. API такие
 * запросы отклоняет до построения.
 *
 * На собранную сетку вешаются группы материалов: рельеф и крепление красятся
 * по-разному (см. `LITHOPHANE_RELIEF_GROUP`), но остаются одной сеткой, поэтому
 * вес, габарит и STL считаются как раньше.
 */
export function createLithophaneGeometry(
  params: Partial<LithophaneParams>,
  part: LithophanePart = "all",
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);

  if (part === "relief" || !normalized.lithoFrame) {
    return markPartGroup(
      createLithophaneReliefGeometry(normalized),
      LITHOPHANE_RELIEF_GROUP,
    );
  }

  if (part === "frame") {
    return markPartGroup(
      createLithophaneFrameGeometry(normalized),
      LITHOPHANE_DETAIL_GROUP,
    );
  }

  if (part === "stand") {
    return markPartGroup(
      createLithophaneStandGeometry(normalized),
      LITHOPHANE_DETAIL_GROUP,
    );
  }

  const metrics = lithophaneFrameMetrics(normalized);
  const relief = createLithophaneReliefGeometry(normalized);
  // Порядок слияния задаёт диапазоны индексов: рельеф идёт первым, поэтому его
  // группа занимает начало сетки.
  const reliefIndices = relief.getIndex()?.count ?? 0;
  const frame = createLithophaneFrameGeometry(normalized);
  const bodies = [relief, frame];

  // Плита входит в окно с зазором и ложится на заднюю полку: по X она уже окна
  // на зазор с каждой стороны, по Y — на зазор сверху и снизу.
  relief.translate(
    0,
    metrics.frameWidth + LITHOPHANE_FIT_GAP_MM,
    metrics.plateBack,
  );

  if (
    lithophaneShapeHasMounts(normalized.lithoShape) &&
    lithophaneHasStand(normalized.lithoMount)
  ) {
    const tiltRadians = (LITHOPHANE_STAND_TILT_DEG * Math.PI) / 180;
    const tilt = new Matrix4().makeRotationX(-tiltRadians);
    const baseTop = standBaseTop(normalized.lithoMount);
    /*
      Открытая арка держит панель не на базе, а в пазу глубиной 3.5 мм: рамка
      опускается вдоль своей плоскости, и её низ оказывается внутри базы. Сдвиг
      идёт по плоскости панели, поэтому плоскость тыла рамки остаётся прежней —
      на неё и опираются ножки, — а дно паза совпадает с нижней кромкой рамки.
    */
    const sinkDepth =
      normalized.lithoMount === "arch" ? LITHOPHANE_ARCH_STAND.seatDepth : 0;
    const sinkY = sinkDepth * Math.cos(tiltRadians);
    const sinkZ = sinkDepth * Math.sin(tiltRadians);

    for (const body of bodies) {
      // Наклон вокруг ребра (Y = 0, Z = 0), затем перенос на верх базы: так
      // тыл рамки ложится на наклонные ножки или стойку подставки.
      body.applyMatrix4(tilt);
      body.translate(0, baseTop - sinkY, sinkZ);
    }

    bodies.push(createLithophaneStandGeometry(normalized));
  }

  return assignMaterialGroups(mergeBodies(bodies, "литофана"), reliefIndices);
}

