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
  normalizeLithophaneParams,
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
 *              (две ножки по краям, паз под рамку и канал под светодиодную
 *              ленту — низ панели открыт, и свет проходит к нему), сплошная
 *              ножка и массивное основание.
 *
 * Крепление `hook` — две петли на тыльной стороне верхней планки рамки: литофан
 * висит на шурупах почти вплотную к стене. Вычитания тел (CSG) нет: деталь
 * собирается из пересекающихся замкнутых кусков и `mergeGeometries`, как
 * вывеска и подставка. Нахлёст объединяемых кусков — BODY_OVERLAP_MM: слайсер
 * видит один объект, а каждая оболочка остаётся watertight.
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

/** Петля подвеса: наружная ширина и выступ от тыльной плоскости, мм. */
export const LITHOPHANE_HOOK_WIDTH_MM = 8;
export const LITHOPHANE_HOOK_DEPTH_MM = 9;

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

  return createReliefBody(
    normalized,
    plate.width,
    plate.height,
    LITHOPHANE_BORDER_MM,
    cornerRadius,
  );
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
 * Рамка литофана отдельной деталью.
 *
 * Задняя полка поднимается до `LITHOPHANE_FRAME_SEAT_MM`, и её внутренний край
 * заходит под плиту на ширину накладки: плита ложится на полку и не проваливается
 * в окно. Передняя накладка начинается чуть ниже верха полки (нахлёст для
 * объединения) и поднимается над самым толстым пикселем на 0.4 мм — рельеф не
 * выступает за лицевую плоскость, и литофан можно ставить лицом вниз.
 *
 * При креплении `hook` на тыльной стороне верхней планки появляются две петли.
 * Каждая — полка с бортиком сзади: шуруп вворачивается в стену, литофан
 * опускается на него, шляпка остаётся в кармане между рамкой и бортиком.
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

  if (normalized.lithoMount === "hook") {
    // Петли стоят на верхней планке: её ширина — бортик плюс накладка. Полка
    // петли занимает нижние 4 мм планки, бортик поднимается от неё к верхнему
    // краю, поэтому с лица крепление не видно.
    const band = frameWidth + lip;
    const bracketHalf = Math.min(LITHOPHANE_HOOK_WIDTH_MM / 2, band / 2);
    const bracketCenter = width / 2 - band / 2;
    const shelfTop = height - band + Math.min(4, band / 2);

    for (const centerX of [-bracketCenter, bracketCenter]) {
      bodies.push(
        createBoxBody(
          centerX - bracketHalf,
          centerX + bracketHalf,
          height - band,
          shelfTop,
          -LITHOPHANE_HOOK_DEPTH_MM,
          BODY_OVERLAP_MM,
        ),
      );
      bodies.push(
        createBoxBody(
          centerX - bracketHalf,
          centerX + bracketHalf,
          shelfTop - 1,
          height - 1,
          -LITHOPHANE_HOOK_DEPTH_MM,
          -LITHOPHANE_HOOK_DEPTH_MM + 1.5,
        ),
      );
    }
  }

  // Рамка собирается из двух колец и петель, но печатается одной деталью:
  // сварка вершин и пересчёт нормалей делают её поверхность гладкой — на
  // предпросмотре она читается литой и матовой, а не набором плоскостей.
  return smoothGeometryNormals(mergeBodies(bodies, "рамки"));
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
} as const;

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
 */
function createArchBaseProfile(
  shape: typeof LITHOPHANE_ARCH_STAND,
  frameDepth: number,
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
  const channelFront = seatBack - shape.channelGap;
  const channelBack = channelFront - shape.channelWidth;
  const wireFront = shape.back + shape.wireGap;
  const wireBack = wireFront - shape.wireWidth;

  return [
    { y: 0, z: shape.front },
    { y: 0, z: shape.back },
    { y: baseTop, z: shape.back },
    // Канавка под провод у тыльной кромки: в ней лежит кабель, база стоит ровно.
    { y: baseTop, z: wireBack },
    { y: baseTop - shape.wireDepth, z: wireBack },
    { y: baseTop - shape.wireDepth, z: wireFront },
    { y: baseTop, z: wireFront },
    // Канал под светодиодную ленту 8–10 мм.
    { y: baseTop, z: channelBack },
    { y: baseTop - shape.channelDepth, z: channelBack },
    { y: baseTop - shape.channelDepth, z: channelFront },
    { y: baseTop, z: channelFront },
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
 * Открытая подставка: база с пазом под рамку, каналом под ленту и две ножки.
 *
 * Деталь собирается из трёх замкнутых тел: база во всю ширину и две ножки по её
 * краям. Между ножками нет материала выше базы, поэтому свет от ленты, стоящей в
 * канале, доходит до низа панели — старая сплошная стойка закрывала эти 30 мм.
 * Ножки и база пересекаются на 1 мм и объединяются `mergeBodies`: в файле это
 * один объект, шва по стыку нет.
 *
 * Проём между ножками считается по ширине базы: на панели 120 × 80 это
 * 110.4 − 2 × 6 = 98.4 мм — под ленту 8–10 мм с запасом, а опора разнесена
 * почти на всю ширину рамки, поэтому панель не качается.
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
        createProfilePrismBody(
          createArchBaseProfile(shape, metrics.frontZ),
          -standSpan / 2,
          standSpan / 2,
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
 * плиту.
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

  if (lithophaneHasStand(normalized.lithoMount)) {
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

