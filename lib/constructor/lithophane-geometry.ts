import { BufferGeometry, Float32BufferAttribute } from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { lithophaneContainRect } from "@/lib/constructor/lithophane-image";
import {
  LITHOPHANE_PANEL_MAX,
  lithophanePanelCount,
  lithophanePanelUv,
} from "@/lib/constructor/lithophane-panels";
import {
  LITHOPHANE_MESH_MAX_TRIANGLES,
  LITHOPHANE_MESH_TOO_LARGE_MESSAGE,
  LITHOPHANE_PANEL_STEP_MM,
  LITHOPHANE_VERTEX_STEP_MM,
  lithophaneFaceBrightness,
  lithophaneMeshSize,
  normalizeLithophaneParams,
  type LithophaneBrightnessGrid,
  type LithophaneParams,
  type LithophanePart,
} from "@/lib/constructor/params";

/**
 * Геометрия литофана: рельеф и рамка.
 *
 * Всё стоит в плоскости XY нижней кромкой на Y = 0, лицо смотрит в +Z, а тыл
 * рамки лежит в плоскости Z = 0. Рельеф — heightfield по габаритам плиты: шаг
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
 * они светлые. После выборки яркость проходит через лёгкий unsharp и контраст:
 * без них площадное усреднение размывало тонкие штрихи логотипа до «каши».
 *
 * Деталей три, и каждая — отдельный замкнутый объект:
 *   `relief` — плита с плоским тылом и рельефом на лице; углы скруглены на
 *              радиус окна рамки, чтобы плита входила в него с зазором;
 *   `frame`  — скруглённое кольцо с задней полкой (плита садится на неё с
 *              зазором 0.2 мм) и передней накладкой, которая прижимает её край;
 *              наружные углы — дугой 6 мм, окно — дугой 2 мм;
 *   `all`    — сборка для проверки и печати одним файлом.
 *
 * Вычитания тел (CSG) нет: детали собираются из пересекающихся замкнутых кусков
 * и `mergeGeometries`, как вывеска и коробка. Нахлёст объединяемых кусков —
 * BODY_OVERLAP_MM: слайсер видит один объект, а каждая оболочка остаётся
 * watertight. Поэтому «дыра» в стенке — это не вырез, а рамка из четырёх
 * кусков вокруг неё.
 *
 * Куб и цилиндр — ночники: панели печатаются той же плитой с рельефом, но
 * собираются не на плоской рамке, а на каркасе (`createLanternFrame`), и внутри
 * у них пусто под лампу. У куба четыре панели стоят гранями куба и повёрнуты
 * друг к другу на 90°. У цилиндра панели гнутся по радиусу плафона
 * (`wrapPanelAroundY`): плоская плита оборачивается вокруг вертикальной оси, лицо
 * смотрит наружу, а каркас — два кольца и вертикальные стойки — держит их снаружи.
 * Кадр каждой панели лежит в своём квадранте общей карты (`lithophanePanelUv`),
 * а на каркасе ничего не светится: фото видно только на панелях.
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

/**
 * Каркас ночника: куб и цилиндрический плафон.
 *
 * Панели держатся не рамкой, а каркасом — двумя поясами (нижним и верхним) и
 * стойками между ними. Пояс заходит за тыл панели на `grip`: панель стоит на
 * внешней стороне каркаса и входит в пояс на полтора миллиметра, поэтому стык
 * сваривается без клея и без паза. Внутрь каркас уходит на `wall` — это стенка,
 * которая держит форму и оставляет внутри пустоту под лампу.
 *
 * `band` — высота пояса: 6 мм хватает, чтобы панель не качалась, и это немного
 * по сравнению с высотой плафона 80 мм. `rib` — ширина стойки по дуге: 5 мм на
 * диаметре 120 мм занимают 4 % окружности, стойки не спорят с кадром. У куба
 * `rib` — сторона угловой стойки.
 */
export const LITHOPHANE_LANTERN = {
  /** Толщина пояса и стойки внутрь, мм. */
  wall: 3,
  /** Высота нижнего и верхнего пояса, мм. */
  band: 6,
  /** Ширина стойки по дуге (у куба — сторона угловой стойки), мм. */
  rib: 5,
  /** Выступ пояса за тыл панели: на столько панель входит в каркас, мм. */
  grip: 1.5,
} as const;

/**
 * Допустимый прогиб тыла изогнутой панели, мм.
 *
 * Тыл панели — веер из хорд: чем длиннее хорда, тем глубже она уходит внутрь
 * радиуса. 0.05 мм — четверть слоя печати: на вес и на просвет такое отклонение
 * не влияет, а отрезков остаётся немного. По этой величине считается, на сколько
 * частей делится путь от центра плиты к её кромке.
 */
export const LITHOPHANE_BACK_SAGITTA_MM = 0.05;

/**
 * Группы материалов в собранной сетке литофана.
 *
 * Группа — диапазон индексов, а не отдельный меш: сборка остаётся одной сеткой,
 * и вес, габарит и STL считаются как раньше. Предпросмотр красит рельеф
 * плоскостями (`flatShading`): по граням читается высота пикселя. Рамка и
 * каркас идут вторым материалом со сглаженными нормалями — они должны выглядеть
 * литыми и матовыми.
 */
export const LITHOPHANE_RELIEF_GROUP = 0;
export const LITHOPHANE_DETAIL_GROUP = 1;

/**
 * Нахлёст двух объединяемых оболочек, мм: без него слайсер видит два тела.
 *
 * На этот же размер плита сдвинута вперёд относительно тыла рамки, поэтому
 * плоскость её тыла — `LITHOPHANE_FRAME_SEAT_MM - BODY_OVERLAP_MM`. Светотехника
 * берёт отсюда положение панели, чтобы лампы стояли в сборке, а не рядом.
 */
export const BODY_OVERLAP_MM = 0.2;

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
 * Тыл плиты: веер от центра к контуру.
 *
 * Тыл плоский, поэтому одного центра достаточно: треугольники идут от центра к
 * каждой паре соседних вершин контура. Веер выбран вместо одной длинной грани
 * потому, что n-угольник слайсер триангулирует сам и может сделать это с
 * самопересечением на скруглённых углах: явные треугольники всегда корректны.
 *
 * `steps` — на сколько отрезков делится путь от центра к контуру. У плоской
 * панели хватает одного: тыл лежит в плоскости. У изогнутой панели веер
 * оборачивается вокруг оси, и длинный луч от центра к кромке становится хордой:
 * на панели 121 × 80 при радиусе 60 хорда в 72 мм уходит внутрь на 12 мм, то есть
 * тыл «толстеет» втрое. Поэтому путь делится на отрезки по 4 мм — хорда в 4 мм
 * уходит внутрь на 4² / (8 · 60) = 0.03 мм, и оболочка идёт по радиусу.
 *
 * Функция возвращает индексы вершин тыла по контуру — по ним строятся боковины.
 */
function addBackFan(
  positions: number[],
  indices: number[],
  uvs: number[],
  nodes: number[],
  boundary: readonly number[],
  plateWidth: number,
  plateHeight: number,
  steps = 1,
): number[] {
  const cache = new Map<string, number>();
  const vertexAt = (x: number, y: number): number => {
    const key = `${x.toFixed(5)}:${y.toFixed(5)}`;
    const known = cache.get(key);

    if (known !== undefined) {
      return known;
    }

    const index = vertexIndex(positions);

    positions.push(x, y, 0);
    // uv тыла продолжают uv лица: они считаются в тех же координатах развёртки.
    uvs.push((x + plateWidth / 2) / plateWidth, (plateHeight - y) / plateHeight);
    cache.set(key, index);

    return index;
  };
  const centerX = 0;
  const centerY = plateHeight / 2;
  const center = vertexAt(centerX, centerY);
  const totalSteps = Math.max(1, Math.floor(steps));
  const rings: number[][] = [];

  for (let ring = 1; ring <= totalSteps; ring += 1) {
    const share = ring / totalSteps;
    const row: number[] = [];

    for (const node of boundary) {
      const x = nodes[node * 3];
      const y = nodes[node * 3 + 1];

      row.push(
        vertexAt(
          centerX + (x - centerX) * share,
          centerY + (y - centerY) * share,
        ),
      );
    }

    rings.push(row);
  }

  for (let edge = 0; edge < boundary.length; edge += 1) {
    const next = (edge + 1) % boundary.length;

    addOrientedTriangle(
      indices,
      positions,
      center,
      rings[0][edge],
      rings[0][next],
      [0, 0, -1],
    );
  }

  for (let ring = 1; ring < totalSteps; ring += 1) {
    for (let edge = 0; edge < boundary.length; edge += 1) {
      const next = (edge + 1) % boundary.length;

      addOrientedQuad(
        indices,
        positions,
        rings[ring - 1][edge],
        rings[ring - 1][next],
        rings[ring][next],
        rings[ring][edge],
        [0, 0, -1],
      );
    }
  }

  return rings[totalSteps - 1];
}


/**
 * Замкнутая плита плоского рельефа: heightfield по габаритам плиты, боковины и
 * тыл.
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
 * `grid` — сетка яркости этой плиты: у панели ночника кадр свой, и он лежит в
 * квадранте общей карты (см. `createLanternPanel`). `step` — шаг вершины: у
 * панелей каркаса он крупнее, потому что их печатается несколько.
 *
 * Кадр вписан в плиту по правилу contain: пропорции сохранены, кадр виден
 * целиком, а разница уходит в поля минимальной толщины. `uv` размечены по плите
 * (0…1 по обеим осям) — по ним текстура ложится на рельеф без сдвига.
 */

function createReliefBody(
  normalized: LithophaneParams,
  plateWidth: number,
  plateHeight: number,
  borderWidth: number,
  cornerRadius: number,
  grid: LithophaneBrightnessGrid,
  step: number = LITHOPHANE_VERTEX_STEP_MM,
  backSteps = 1,
): BufferGeometry {
  const minThickness = normalized.lithophaneMinThickness;
  const maxThickness = normalized.lithophaneMaxThickness;
  const brightness = grid.brightness;
  const brightnessWidth = grid.width;
  const brightnessHeight = grid.height;
  // Шаг сетки — стандарт 0.3 мм: число вершин растёт вместе с плитой, поэтому
  // панель 200 мм получает вдвое больше вершин, а не вдвое крупный шаг. У панелей
  // каркаса шаг 0.5 мм: их печатается несколько, и бюджет делится между ними.
  const mesh = lithophaneMeshSize(plateWidth, plateHeight, { step });

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
  // Развёртка плиты: x, y и толщина каждой вершины лица. Из неё же берутся
  // координаты тыла и боковин, поэтому скругление углов делается здесь, и
  // оболочка остаётся замкнутой.
  const nodes: number[] = [];

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

      nodes.push(x, y, thickness);
      // uv идут по плите, а не по кадру: карта свечения строится под пропорции
      // плиты (кадр по центру, поля белые), поэтому кадр и подсветка совпадают.
      uvs.push(u, v);
    }
  }

  // Углы плиты скругляются до построения тыла с боковинами: они копируют уже
  // сдвинутые координаты развёртки, поэтому обе оболочки остаются замкнутыми.
  roundPlateCorners(nodes, halfWidth, plateHeight / 2, cornerRadius);

  // Лицо: вершины рождаются сразу в своих координатах, толщина идёт по Z.
  for (let node = 0; node < nodes.length; node += 3) {
    positions.push(nodes[node], nodes[node + 1], nodes[node + 2]);
  }

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
  // Тыл: веер от центра к контуру.
  const backBoundary = addBackFan(
    positions,
    indices,
    uvs,
    nodes,
    boundary,
    plateWidth,
    plateHeight,
    backSteps,
  );

  for (let edge = 0; edge < boundary.length; edge += 1) {
    const next = (edge + 1) % boundary.length;
    const topA = boundary[edge];
    const topB = boundary[next];
    const bottomA = backBoundary[edge];
    const bottomB = backBoundary[next];
    // Внешняя нормаль ребра контура против часовой стрелки — (dy, −dx).
    const dx = nodes[topB * 3] - nodes[topA * 3];
    const dy = nodes[topB * 3 + 1] - nodes[topA * 3 + 1];

    addOrientedQuad(
      indices,
      positions,
      topA,
      topB,
      bottomB,
      bottomA,
      [dy, -dx, 0],
    );
  }

  const geometry = finalizeGeometry(positions, indices);

  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));

  return geometry;
}

/**
 * План панелей: сколько их, какие у панели габариты и по какому радиусу она гнётся.
 *
 * У плоской формы панель одна и она же плита в рамке (или без неё). У куба
 * панелей четыре, каждая размером с грань `lithophaneWidth × lithophaneHeight`.
 * У цилиндра панель — развёртка дуги: длина равна `R · (2π/n − ширина стойки / R)`,
 * высота — высоте плафона, а гнётся она по радиусу `lithophaneWidth / 2`. Панель
 * шире стыка на два нахлёста (`BODY_OVERLAP_MM`), чтобы её край вошёл в стойку
 * каркаса и сварился с ней.
 */
type LithophanePanelPlan = {
  /** Сколько панелей печатается. */
  count: number;
  /** Ширина панели в развёртке, мм. */
  width: number;
  /** Высота панели, мм. */
  height: number;
  /** Радиус изгиба, мм: у плоской панели и куба его нет. */
  radius: number | null;
};

function lithophanePanelPlan(
  normalized: LithophaneParams,
): LithophanePanelPlan {
  if (normalized.lithoShape === "flat") {
    // Без рамки панель и есть плита: скруглять и вычитать нечего.
    const metrics = normalized.lithoFrame
      ? lithophaneFrameMetrics(normalized)
      : null;

    return {
      count: 1,
      width: metrics ? metrics.plateWidth : normalized.lithophaneWidth,
      height: metrics ? metrics.plateHeight : normalized.lithophaneHeight,
      radius: null,
    };
  }

  if (normalized.lithoShape === "cube") {
    return {
      count: LITHOPHANE_PANEL_MAX,
      width: normalized.lithophaneWidth,
      height: normalized.lithophaneHeight,
      radius: null,
    };
  }

  const radius = normalized.lithophaneWidth / 2;
  const count = lithophanePanelCount("round", normalized.lithophanePanels);
  const sweep = (Math.PI * 2) / count;
  // Стойка занимает `rib` миллиметров дуги; нахлёст по краям панели входит в
  // стойку, поэтому стык сваривается, а не встречается встык.
  const arc = sweep - (LITHOPHANE_LANTERN.rib - 2 * BODY_OVERLAP_MM) / radius;

  return {
    count,
    width: radius * Math.max(arc, 1 / radius),
    height: normalized.lithophaneHeight,
    radius,
  };
}

/**
 * Габариты одной панели рельефа, мм.
 *
 * API зовёт эту функцию до сборки: по ней видно, влезает ли сетка в бюджет
 * треугольников. `count` — сколько таких панелей печатается, `step` — шаг
 * вершины: у нескольких панелей он крупнее, чтобы бюджет миллиона делился
 * между ними.
 */
export function lithophanePlateSize(params: Partial<LithophaneParams>): {
  width: number;
  height: number;
  count: number;
  step: number;
} {
  const plan = lithophanePanelPlan(normalizeLithophaneParams(params));

  return {
    width: plan.width,
    height: plan.height,
    count: plan.count,
    step: plan.count > 1 ? LITHOPHANE_PANEL_STEP_MM : LITHOPHANE_VERTEX_STEP_MM,
  };
}

/**
 * Панели рельефа отдельной деталью.
 *
 * `Partial<LithophaneParams>` допустим и на клиенте: normalizeLithophaneParams
 * дополнит недостающие поля значениями по умолчанию. Если массив яркости
 * повреждён, нормализация подставит демонстрационный рельеф — предпросмотр
 * останется рабочим.
 *
 * У плоской формы возвращается одна плита. У куба и цилиндра — все панели,
 * собранные в одну сетку: бюджет треугольников проверяется сразу на все копии,
 * иначе сборка из четырёх панелей прошла бы проверку по одной и упёрлась в
 * миллион уже в браузере.
 */
export function createLithophaneReliefGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const plan = lithophanePanelPlan(normalized);
  const step =
    plan.count > 1 ? LITHOPHANE_PANEL_STEP_MM : LITHOPHANE_VERTEX_STEP_MM;

  if (panelTriangleCount(plan) > LITHOPHANE_MESH_MAX_TRIANGLES) {
    throw new Error(LITHOPHANE_MESH_TOO_LARGE_MESSAGE);
  }

  if (normalized.lithoShape === "flat") {
    // Без рамки плита прямоугольная: скруглять её не к чему, а в паз рамки она
    // входит только вместе с его радиусом.
    const cornerRadius = normalized.lithoFrame
      ? lithophaneFrameMetrics(normalized).plateCornerRadius
      : 0;

    return createReliefBody(
      normalized,
      plan.width,
      plan.height,
      LITHOPHANE_BORDER_MM,
      cornerRadius,
      {
        brightness: normalized.lithophaneBrightness,
        width: normalized.lithophaneBrightnessWidth,
        height: normalized.lithophaneBrightnessHeight,
      },
    );
  }

  const grids = lithophaneFaceBrightness(normalized);
  const panels: BufferGeometry[] = [];

  for (let panel = 0; panel < plan.count; panel += 1) {
    panels.push(createLanternPanel(normalized, plan, grids[panel], panel, step));
  }

  return mergeBodies(panels, "панелей");
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
  const outer = roundedRectOutline(
    outerWidth / 2,
    outerHeight / 2,
    outerRadius,
  );
  const inner = roundedRectOutline(
    innerWidth / 2,
    innerHeight / 2,
    innerRadius,
  );
  const count = outer.length;
  const positions: number[] = [];
  const indices: number[] = [];
  const at = (point: Point2, z: number): Point3 =>
    [centerX + point[0], centerY + point[1], z];

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

﻿/**
 * Рамка плоской панели отдельной деталью.
 *
 * Задняя полка поднимается до `LITHOPHANE_FRAME_SEAT_MM`, и её внутренний край
 * заходит под плиту на ширину накладки: плита ложится на полку и не проваливается
 * в окно. Передняя накладка начинается чуть ниже верха полки (нахлёст для
 * объединения) и поднимается над самым толстым пикселем на 0.4 мм — рельеф не
 * выступает за лицевую плоскость, и литофан можно ставить лицом вниз.
 *
 * Оба кольца скруглённые: наружные углы идут дугой
 * `LITHOPHANE_FRAME_CORNER_RADIUS_MM`, окно накладки — дугой
 * `LITHOPHANE_FRAME_OPENING_RADIUS_MM`, окно полки — на накладку шире. Радиусы
 * ограничены четвертью своего прямоугольника, поэтому маленькая панель 40 мм
 * остаётся целой, а не превращается в овал.
 *
 * Других деталей у рамки нет: крепления, короба и рельсы из конструктора убраны,
 * поэтому за панелью ничего не торчит и рама печатается плоской. У куба и
 * цилиндра рамки нет — там панели держит каркас (`createLanternFrame`).
 */
export function createLithophaneFrameGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);

  if (normalized.lithoShape !== "flat") {
    return createLanternFrame(normalized);
  }

  const metrics = lithophaneFrameMetrics(normalized);
  const { width, height, frameWidth, lip, frontZ } = metrics;
  const bodies = [
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

  // Рамка собирается из нескольких тел, но печатается одной деталью: сварка
  // вершин и пересчёт нормалей делают её поверхность гладкой — на предпросмотре
  // она читается литой и матовой, а не набором плоскостей.
  return smoothGeometryNormals(mergeBodies(bodies, "рамки"));
}


/**
 * Сборка литофана: деталь по имени или всё вместе.
 *
 * У плоской формы плита ставится на заднюю полку рамки: по X и Y она уже окна на
 * зазор посадки, по Z — на плоскость полки. У куба и цилиндра панели и каркас
 * собираются как есть: панели уже стоят на своих местах вокруг оси.
 *
 * Группы материалов: рельеф идёт первым, поэтому его диапазон индексов занимает
 * начало сетки; рамка или каркас красятся вторым материалом.
 */
export function createLithophaneGeometry(
  params: Partial<LithophaneParams>,
  part: LithophanePart = "all",
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);

  if (part === "relief") {
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

  const relief = createLithophaneReliefGeometry(normalized);
  // Порядок слияния задаёт диапазоны индексов: рельеф идёт первым, поэтому его
  // группа занимает начало сетки.
  const reliefIndices = relief.getIndex()?.count ?? 0;

  /*
    У плоской формы без рамки печатается только плита: ни полки, ни паза нет,
    поэтому плита остаётся на своём месте (тыл в плоскости Z = 0), а в
    предпросмотре нет рамки, которой не будет в файле.
  */
  if (normalized.lithoShape === "flat" && !normalized.lithoFrame) {
    return assignMaterialGroups(relief, reliefIndices);
  }

  const frame = createLithophaneFrameGeometry(normalized);

  if (normalized.lithoShape === "flat") {
    const metrics = lithophaneFrameMetrics(normalized);

    relief.translate(
      0,
      metrics.frameWidth + LITHOPHANE_FIT_GAP_MM,
      metrics.plateBack,
    );
  }

  return assignMaterialGroups(
    mergeBodies([relief, frame], "литофана"),
    reliefIndices,
  );
}


/**
 * Замкнутая коробка по габаритам: стойки каркаса и пояса куба.
 *
 * Ночник собирается из простых тел, а не из вырезанной оболочки: пояс — это
 * коробка или кольцо, стойка — коробка. Каждое тело замкнуто само по себе, а
 * нахлёст соседей делает их одной деталью после объединения. Нормали считаются
 * по граням: стойка должна читаться гранёной, а не литой.
 */
type BoxBody = {
  /** Границы по X, мм. */
  x0: number;
  x1: number;
  /** Границы по Y, мм: у ночника это высота, ноль — стол. */
  y0: number;
  y1: number;
  /** Границы по Z, мм. */
  z0: number;
  z1: number;
};

function createBoxBody(box: BoxBody): BufferGeometry {
  const { x0, x1, y0, y1, z0, z1 } = box;
  const positions: number[] = [];
  const indices: number[] = [];
  const at = (x: number, y: number, z: number): Point3 => [x, y, z];

  // Порядок вершин в грани не важен: `addQuadFace` разворачивает обход под
  // ожидаемую нормаль, поэтому все грани смотрят наружу.
  const faces: readonly (readonly [Point3, Point3, Point3, Point3, Point3])[] = [
    [
      at(x0, y0, z0),
      at(x1, y0, z0),
      at(x1, y0, z1),
      at(x0, y0, z1),
      [0, -1, 0],
    ],
    [
      at(x0, y1, z0),
      at(x1, y1, z0),
      at(x1, y1, z1),
      at(x0, y1, z1),
      [0, 1, 0],
    ],
    [
      at(x0, y0, z1),
      at(x1, y0, z1),
      at(x1, y1, z1),
      at(x0, y1, z1),
      [0, 0, 1],
    ],
    [
      at(x0, y0, z0),
      at(x1, y0, z0),
      at(x1, y1, z0),
      at(x0, y1, z0),
      [0, 0, -1],
    ],
    [
      at(x1, y0, z0),
      at(x1, y0, z1),
      at(x1, y1, z1),
      at(x1, y1, z0),
      [1, 0, 0],
    ],
    [
      at(x0, y0, z0),
      at(x0, y0, z1),
      at(x0, y1, z1),
      at(x0, y1, z0),
      [-1, 0, 0],
    ],
  ];

  for (const [a, b, c, d, normal] of faces) {
    addQuadFace(indices, positions, [a, b, c, d], normal);
  }

  return finalizeGeometry(positions, indices);
}

/**
 * Пояс цилиндрического плафона: кольцо в плоскости XZ, выдавленное по высоте.
 *
 * Ось плафона — Y, поэтому угол отсчитывается от +Z к +X, как у панелей:
 * `x = r·sin φ`, `z = r·cos φ`. Число отрезков считается от наружного радиуса —
 * хорда не длиннее 0.5 мм, поэтому кольцо Ø200 идёт 1257 отрезками и на экране
 * выглядит круглым. Вершины свариваются и нормали сглаживаются
 * (`smoothGeometryNormals`): пояс должен читаться точёным, а не гранёным.
 */
type DrumRingOptions = {
  /** Внутренний радиус пояса, мм: отсюда начинается пустота под лампу. */
  innerRadius: number;
  /** Наружный радиус пояса, мм: на столько он выступает за тыл панели. */
  outerRadius: number;
  /** Низ и верх пояса по Y, мм. */
  y0: number;
  y1: number;
  segments: number;
};

function createDrumRingBody(options: DrumRingOptions): BufferGeometry {
  const { innerRadius, outerRadius, segments, y0, y1 } = options;
  const count = Math.max(16, Math.floor(segments));
  const positions: number[] = [];
  const indices: number[] = [];
  const angleAt = (step: number): number => (step / count) * Math.PI * 2;
  const at = (radius: number, step: number, y: number): Point3 => {
    const angle = angleAt(step);

    return [radius * Math.sin(angle), y, radius * Math.cos(angle)];
  };

  for (let step = 0; step < count; step += 1) {
    const next = (step + 1) % count;
    const angle = angleAt(step);

    // Торцы: полоса между наружным и внутренним контуром снизу и сверху.
    for (const [y, normal] of [
      [y0, [0, -1, 0]],
      [y1, [0, 1, 0]],
    ] as const) {
      addQuadFace(
        indices,
        positions,
        [
          at(innerRadius, step, y),
          at(outerRadius, step, y),
          at(outerRadius, next, y),
          at(innerRadius, next, y),
        ],
        normal,
      );
    }

    // Стенки: наружная смотрит от оси, внутренняя — в пустоту плафона.
    for (const [radius, direction] of [
      [outerRadius, 1],
      [innerRadius, -1],
    ] as const) {
      addQuadFace(
        indices,
        positions,
        [
          at(radius, step, y0),
          at(radius, step, y1),
          at(radius, next, y1),
          at(radius, next, y0),
        ],
        [direction * Math.sin(angle), 0, direction * Math.cos(angle)],
      );
    }
  }

  return finalizeGeometry(positions, indices);
}

/**
 * Оборачивает плоскую панель вокруг вертикальной оси.
 *
 * Панель построена в плоскости XY: `x` — вдоль развёртки, `y` — высота, `z` —
 * толщина. Оборачивание переводит её в цилиндрические координаты радиуса
 * `radius`: точка с координатой `x` встаёт на угол `x / radius`, а толщина уходит
 * по радиусу. Тыл панели (z = 0) ложится на радиус, лицо — на `radius + толщина`,
 * поэтому панель стоит снаружи каркаса, как и требует плафон.
 *
 * Отображение применяется к каждой вершине одинаково, поэтому оболочка остаётся
 * замкнутой. Нормали пересчитываются после изгиба: на ровной плите они смотрели
 * в +Z, на цилиндре должны смотреть от оси.
 */
function wrapPanelAroundY(geometry: BufferGeometry, radius: number): void {
  const position = geometry.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const radial = radius + position.getZ(index);
    const angle = x / radius;

    position.setXYZ(
      index,
      radial * Math.sin(angle),
      y,
      radial * Math.cos(angle),
    );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/**
 * Раскладывает `uv` панели по квадрантам общей карты кадров.
 *
 * Плита размечает `uv` по своим габаритам (0…1), а предпросмотр держит четыре
 * кадра в одной карте 2 × 2. Квадрант берётся по номеру панели
 * (`lithophanePanelUv`), поэтому на каждой панели видно своё фото, а карта
 * собирается той же таблицей.
 */
function mapPanelUv(geometry: BufferGeometry, panel: number): void {
  const uv = geometry.getAttribute("uv");

  for (let index = 0; index < uv.count; index += 1) {
    const mapped = lithophanePanelUv(panel, uv.getX(index), uv.getY(index));

    uv.setXY(index, mapped.u, mapped.v);
  }

  uv.needsUpdate = true;
}

/**
 * На сколько отрезков делится веер тыла панели.
 *
 * У плоской панели и у грани куба тыл плоский — хватает одного отрезка. У
 * изогнутой панели длина луча от центра плиты к кромке ограничена прогибом
 * `LITHOPHANE_BACK_SAGITTA_MM`: хорда длиной `s` на радиусе `R` уходит внутрь на
 * `s² / (8R)`, поэтому `s = √(8 · прогиб · R)`. Луч в 72 мм при радиусе 60 даёт
 * 4.9 мм и 15 отрезков; ограничение в 24 отрезка держит сетку в бюджете даже на
 * панели 200 × 150 с радиусом 100.
 */
function panelBackSteps(plan: LithophanePanelPlan): number {
  if (plan.radius === null) {
    return 1;
  }

  const longestRay = Math.hypot(plan.width, plan.height) / 2;
  const chord = Math.sqrt(8 * LITHOPHANE_BACK_SAGITTA_MM * plan.radius);

  return Math.min(24, Math.max(4, Math.ceil(longestRay / chord)));
}

/**
 * Сколько треугольников выйдет у панелей рельефа, шт.
 *
 * Считается до сборки, потому что бюджет проверяется дважды: геометрия бросает
 * ошибку сама, а API отвечает 422 ещё до того, как начнёт строить мегабайты.
 * Формула обязана быть одна на оба места, иначе предварительная проверка
 * пропустит деталь, которую сборка отвергнет.
 *
 * В счёт входят лицо, боковины и тыл; у изогнутых панелей тыл делится на
 * отрезки веера, и на каждый лишний отрезок приходится по два треугольника на
 * вершину контура плиты.
 */
function panelTriangleCount(plan: LithophanePanelPlan): number {
  const step =
    plan.count > 1 ? LITHOPHANE_PANEL_STEP_MM : LITHOPHANE_VERTEX_STEP_MM;
  const mesh = lithophaneMeshSize(plan.width, plan.height, {
    copies: plan.count,
    step,
  });

  if (mesh === null) {
    return Number.POSITIVE_INFINITY;
  }

  const boundary = 2 * (mesh.columns - 1) + 2 * (mesh.rows - 1);

  return (
    mesh.triangles +
    plan.count * 2 * boundary * Math.max(0, panelBackSteps(plan) - 1)
  );
}

/**
 * Сколько треугольников выйдет у панелей рельефа для этих параметров, шт.
 *
 * Та же оценка, что у сборки: по ней API отказывает до работы, а тест сверяет
 * потолок миллиона с реальной сеткой.
 */
export function lithophaneTriangleCount(
  params: Partial<LithophaneParams>,
): number {
  return panelTriangleCount(
    lithophanePanelPlan(normalizeLithophaneParams(params)),
  );
}

/**
 * Панель ночника: плита с рельефом, поставленная на своё место.
 *
 * Плита строится плоской — той же функцией, что у обычного литофана, — и только
 * потом встаёт в сборку. У куба тыл уходит на полстороны грани, и панель
 * поворачивается на 90°: четыре грани дают квадрат. У цилиндра плита
 * оборачивается по радиусу плафона и поворачивается на свой угол, так что
 * панели идут по кругу без зазоров — стыки закрывают стойки каркаса.
 *
 * Тыл изогнутой панели делится на отрезки (`panelBackSteps`): иначе хорда от
 * центра плиты к кромке уходила бы внутрь радиуса на сантиметры, и панель на
 * просвет весила бы втрое больше тонкой пластины.
 */
function createLanternPanel(
  normalized: LithophaneParams,
  plan: LithophanePanelPlan,
  grid: LithophaneBrightnessGrid,
  panel: number,
  step: number,
): BufferGeometry {
  const geometry = createReliefBody(
    normalized,
    plan.width,
    plan.height,
    LITHOPHANE_BORDER_MM,
    0,
    grid,
    step,
    panelBackSteps(plan),
  );

  mapPanelUv(geometry, panel);

  if (plan.radius === null) {
    geometry.translate(0, 0, normalized.lithophaneWidth / 2);
    geometry.rotateY((panel * Math.PI) / 2);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
  }

  wrapPanelAroundY(geometry, plan.radius);
  geometry.rotateY((panel * Math.PI * 2) / plan.count);

  return geometry;
}

/**
 * Каркас ночника: два пояса и стойки между ними.
 *
 * У куба пояс — четыре коробки по граням, а стойки стоят на углах: они закрывают
 * стык панелей и держат куб как каркас фонаря. У цилиндра пояс — кольцо, а между
 * панелями идут вертикальные стойки по числу панелей. И там и там панель входит
 * в пояс на `grip` и в стойку на нахлёст, поэтому деталь печатается одной
 * сборкой без клея.
 *
 * Внутри каркас пуст: у куба это коробка без дна и крышки, у цилиндра — полая
 * труба. Лампа ставится на стол внутрь плафона, свет выходит через тонкие
 * участки панелей и через открытые торцы.
 */
function createLanternFrame(normalized: LithophaneParams): BufferGeometry {
  const plan = lithophanePanelPlan(normalized);
  const { band, grip, rib, wall } = LITHOPHANE_LANTERN;
  const height = plan.height;
  const bodies: BufferGeometry[] = [];

  if (plan.radius === null) {
    const half = normalized.lithophaneWidth / 2;
    const inner = half - wall;
    const outer = half + grip;
    const length = normalized.lithophaneWidth + 2 * grip;

    for (const [y0, y1] of [
      [0, band],
      [height - band, height],
    ] as const) {
      for (let face = 0; face < 4; face += 1) {
        const body = createBoxBody({
          x0: -length / 2,
          x1: length / 2,
          y0,
          y1,
          z0: inner,
          z1: outer,
        });

        body.rotateY((face * Math.PI) / 2);
        bodies.push(body);
      }
    }

    // Угловые стойки: квадрат в плане на каждом углу куба. Внутренний угол
    // стойки смотрит в пустоту, наружный выступает за тыл панелей и читается
    // как ребро фонаря.
    for (const [signX, signZ] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      bodies.push(
        createBoxBody({
          x0: signX > 0 ? inner : -outer,
          x1: signX > 0 ? outer : -inner,
          y0: 0,
          y1: height,
          z0: signZ > 0 ? inner : -outer,
          z1: signZ > 0 ? outer : -inner,
        }),
      );
    }

    return mergeBodies(bodies, "каркаса");
  }

  const radius = plan.radius;
  const segments = Math.ceil((Math.PI * 2 * (radius + grip)) / 0.5);

  for (const [y0, y1] of [
    [0, band],
    [height - band, height],
  ] as const) {
    bodies.push(
      smoothGeometryNormals(
        createDrumRingBody({
          innerRadius: radius - wall,
          outerRadius: radius + grip,
          y0,
          y1,
          segments,
        }),
      ),
    );
  }

  for (let panel = 0; panel < plan.count; panel += 1) {
    // Стойка стоит на стыке соседних панелей, поэтому её угол сдвинут на полшага.
    const angle = ((panel + 0.5) * Math.PI * 2) / plan.count;
    const body = createBoxBody({
      x0: -rib / 2,
      x1: rib / 2,
      y0: 0,
      y1: height,
      z0: radius - wall,
      z1: radius + grip,
    });

    body.rotateY(angle);
    bodies.push(body);
  }

  return mergeBodies(bodies, "каркаса");
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
    поэтому рамке и креплению дописываются нулевые uv. Материал крепления карт
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

