import { BufferGeometry, Float32BufferAttribute } from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { lithophaneContainRect } from "@/lib/constructor/lithophane-image";
import {
  LITHOPHANE_MESH_TOO_LARGE_MESSAGE,
  lithophaneFaceBrightness,
  lithophaneHasStand,
  lithophaneMeshSize,
  lithophaneRoundMeshSize,
  normalizeLithophaneParams,
  type LithophaneBrightnessGrid,
  type LithophaneParams,
  type LithophanePart,
} from "@/lib/constructor/params";

/**
 * Геометрия литофана: рельеф, рамка и две системы крепления.
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
 * Деталей не больше четырёх, и каждая — отдельный замкнутый объект:
 *   `relief` — плита с плоским тылом и рельефом на лице; углы скруглены на
 *              радиус окна рамки, чтобы плита входила в него с зазором;
 *   `frame`  — скруглённое кольцо с задней полкой (плита садится на неё с
 *              зазором 0.2 мм) и передней накладкой, которая прижимает её край;
 *              наружные углы — дугой 6 мм, окно — дугой 2 мм. К рамке крепится
 *              основание выбранной системы: короб или два рельса;
 *   `mount`  — съёмная деталь крепления: отсекатель короба или подвижное кольцо
 *              монорельса;
 *   `all`    — сборка для проверки и печати одним файлом.
 *
 * Вычитания тел (CSG) нет: детали собираются из пересекающихся замкнутых кусков
 * и `mergeGeometries`, как вывеска и коробка. Нахлёст объединяемых кусков —
 * BODY_OVERLAP_MM: слайсер видит один объект, а каждая оболочка остаётся
 * watertight. Поэтому «дыра» в стенке — это не вырез, а рамка из четырёх
 * кусков вокруг неё.
 *
 * Круглая панель (`lithoShape === "round"`) собирается полярной сеткой: кольца
 * и секторы вместо строк и столбцов. Внутри сектора точка считается в долях
 * радиуса и угла, поэтому кадр ложится в четверть диска, а четыре сектора дают
 * четыре разных фото на одной панели.
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
 * Короб под светодиодную плату: закрытый бокс на тыльной стороне рамки.
 *
 * Короб вписан в контур рамки с отступом `inset` и открыт вперёд, в окно
 * рамки, — свет платы уходит только на тыл панели. Плата ложится в ложемент на
 * тыльной стенке: там же окно под провод, а вокруг платы стоит воротник, в
 * который вставляется отсекатель. Отсекатель — отдельная деталь (`mount`): его
 * тубус выходит на 8 мм вперёд и срезает косой свет платы, который иначе бил бы
 * в кромку кадра и в стенки короба.
 *
 * Глубина 34 мм — стандарт светодиодных матриц: плата с радиатором и драйвером
 * укладывается целиком, а короб за панелью 120 × 80 не перевешивает её.
 */
export const LITHOPHANE_LED_BOX = {
  /** Глубина короба по Z: от тыла рамки до внешней плоскости тыльной стенки. */
  depth: 34,
  /** Толщина стенок и тыльной стенки, мм. */
  wall: 2.5,
  /** Отступ наружного контура короба от контура рамки, мм. */
  inset: 2,
  /**
   * Ложемент платы: ширина полки под плату, высота бортика и зазор посадки, мм.
   *
   * Плата стоит на тыльной стенке внутри бортика: бортик держит её от сдвига, а
   * отсекатель прижимает сверху. Зазор 0.4 мм — обычный допуск печати, поэтому
   * плата 60 × 60 входит без подгонки.
   */
  boardShelf: 4,
  boardRim: 6,
  boardFit: 0.4,
  /** Верхний предел ложемента: платы больше 90 мм в короб не ставят. */
  boardMax: 90,
  /**
   * Окно под провод в тыльной стенке, мм.
   *
   * Стоит на оси короба: у платы разъём обычно по центру тыла, и провод уходит
   * назад горизонтально, не перегибаясь через бортик.
   */
  wireWidth: 14,
  wireHeight: 8,
  /**
   * Отсекатель: ширина стенки, высота тубуса и выступ фланца, мм.
   *
   * Фланец ложится на полку ложемента и фиксирует плату; тубус на 8 мм
   * выходит вперёд и работает как бленда — свет идёт только в окно рамки.
   */
  baffleWall: 2.5,
  baffleHeight: 8,
  baffleFlange: 4,
} as const;

/**
 * Монорельс с кольцом: две направляющие и подвижная каретка под патрон.
 *
 * Рельсы идут вдоль Z за верхней и нижней кромками рамки: они на 8 мм выходят
 * за габарит панели, поэтому не упираются в её силуэт, а нижний рельс служит
 * ещё и подставкой — литофан стоит на нём и на передней лапе. По рельсам ездит
 * кольцо-каретка: два С-образных захвата обнимают рельс сверху и снизу, боковые
 * стойки соединяют их, в центре — площадка под патрон на трёх спицах.
 *
 * Патрон фиксируется штатной гайкой: в площадке круглое отверстие под резьбу
 * (14.6 мм у E14, 28.6 мм у E27), с тыльной стороны — бортик, в который гайка
 * входит как в ключ. Гайка прижимает патрон к плоской площадке, а бортик не
 * даёт ей проворачиваться. Козырёк над кольцом закрывает лампу сверху: свет
 * уходит на панель, а не в глаза.
 */
export const LITHOPHANE_SOCKET_RAIL = {
  /** Сечение рельса: высота по Y и глубина по Z, мм. */
  railHeight: 10,
  railDepth: 9,
  /** Насколько рельс выходит за кромку панели, мм. */
  railOffset: 8,
  /** Зазор каретки на рельсе: 0.3 мм — свободный ход без люфта. */
  carriageGap: 0.3,
  /** Толщина стенок каретки и кольца, мм. */
  carriageWall: 2.5,
  /** Длина захвата каретки вдоль рельса, мм. */
  carriageLength: 12,
  /** Толщина боковых стоек и спиц, мм. */
  frameThickness: 6,
  /** Ширина боковых стоек и спиц, мм. */
  frameWidth: 10,
  /**
   * Площадка патрона: толщина, диаметр, высота и стенка бортика под гайку, мм.
   *
   * Диаметр площадки — не больше `min(ширина, высота) − 4`: на панели 40 мм
   * остаётся 36 мм, и кольцо E14 всё равно влезает. Бортик на 0.6 мм шире гайки
   * по наружному диаметру: гайка входит внутрь и не проворачивается.
   */
  padThickness: 8,
  padMaxDiameter: 52,
  rimHeight: 4,
  rimWall: 2.5,
  nutClearance: 0.6,
  /** Козырёк: вылет к панели, толщина и высота передней губы, мм. */
  visorLength: 35,
  visorThickness: 3,
  visorLip: 14,
  /** Выступ рельса за площадку патрона: столько нужно, чтобы каретка не сходила. */
  railTail: 24,
} as const;

/**
 * Цоколи: резьба, гайка и высота бортика под неё.
 *
 * `thread` — диаметр резьбы патрона с зазором посадки: 14.6 и 28.6 мм. `nut` —
 * наружный диаметр штатной гайки: 22 мм у E14 и 30 мм у E27, — по нему
 * считается бортик площадки.
 */
export const LITHOPHANE_SOCKETS = {
  e14: { thread: 14.6, nut: 22 },
  e27: { thread: 28.6, nut: 30 },
} as const;


/**
 * Группы материалов в собранной сетке литофана.
 *
 * Группа — диапазон индексов, а не отдельный меш: сборка остаётся одной сеткой,
 * и вес, габарит и STL считаются как раньше. Предпросмотр красит рельеф
 * плоскостями (`flatShading`): по граням читается высота пикселя. Рамка и
 * крепление идут вторым материалом со сглаженными нормалями — они должны
 * выглядеть литыми и матовыми.
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
  // У круглой панели диаметр — это ширина, а отдельной высоты нет: диск
  // квадратен по габариту, поэтому все метрики считаются по одной стороне.
  const height =
    normalized.lithoShape === "round"
      ? width
      : normalized.lithophaneHeight;
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
  const center = vertexAt(0, plateHeight / 2);
  const backBoundary: number[] = [];

  for (let edge = 0; edge < boundary.length; edge += 1) {
    const next = (edge + 1) % boundary.length;
    const a = vertexAt(
      nodes[boundary[edge] * 3],
      nodes[boundary[edge] * 3 + 1],
    );
    const b = vertexAt(
      nodes[boundary[next] * 3],
      nodes[boundary[next] * 3 + 1],
    );

    backBoundary.push(a);
    addOrientedTriangle(indices, positions, center, a, b, [0, 0, -1]);
  }

  return backBoundary;
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
 * `grid` — сетка яркости этой плиты: у круглой панели кадров четыре, и каждый
 * сектор берёт свой (см. `createRoundReliefBody`).
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
): BufferGeometry {
  const minThickness = normalized.lithophaneMinThickness;
  const maxThickness = normalized.lithophaneMaxThickness;
  const brightness = grid.brightness;
  const brightnessWidth = grid.width;
  const brightnessHeight = grid.height;
  // Шаг сетки — стандарт 0.3 мм: число вершин растёт вместе с плитой, поэтому
  // панель 200 мм получает вдвое больше вершин, а не вдвое крупный шаг.
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

  // Без рамки панель и есть плита: скруглять и вычитать нечего.
  if (!normalized.lithoFrame) {
    return {
      width: normalized.lithophaneWidth,
      height:
        normalized.lithoShape === "round"
          ? normalized.lithophaneWidth
          : normalized.lithophaneHeight,
    };
  }

  const metrics = lithophaneFrameMetrics(normalized);

  // У круглой панели габарит плиты — диаметр: и по X, и по Y он один и тот же,
  // поэтому бюджет полярной сетки проверяется по одной стороне.
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

  if (normalized.lithoShape === "round") {
    // Круглая панель строится полярной сеткой: у неё нет ни углов, ни строк.
    return createRoundReliefBody(
      normalized,
      plate.width,
      LITHOPHANE_BORDER_MM,
    );
  }

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
    {
      brightness: normalized.lithophaneBrightness,
      width: normalized.lithophaneBrightnessWidth,
      height: normalized.lithophaneBrightnessHeight,
    },
  );
}

/**
 * Замкнутый параллелепипед по двум углам.
 *
 * Короб, рельсы и кольцо — набор коробок и колец: так каждая деталь состоит из
 * нескольких замкнутых оболочек, которые объединяются с нахлёстом. Все грани
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
 * Круглое кольцо, выдавленное по Z: круглая рамка и площадка патрона.
 *
 * Контур круга не требует скруглений: дуга задаётся числом отрезков. Число
 * отрезков считается от радиуса — `π·R / 0.5`, то есть хорда не длиннее 0.5 мм.
 * Наружная и внутренняя стенки идут парами `outer[j] — inner[j]`, поэтому
 * кольцо замкнуто и без сварки вершин.
 */
type CircularRingOptions = {
  centerY: number;
  outerRadius: number;
  innerRadius: number;
  z0: number;
  z1: number;
  segments: number;
};

function createCircularRingBody(options: CircularRingOptions): BufferGeometry {
  const { centerY, outerRadius, innerRadius, z0, z1, segments } = options;
  const count = Math.max(8, Math.floor(segments));
  const positions: number[] = [];
  const indices: number[] = [];
  const angleAt = (step: number): number => (step / count) * Math.PI * 2;
  const at = (radius: number, step: number, z: number): Point3 => [
    radius * Math.sin(angleAt(step)),
    centerY + radius * Math.cos(angleAt(step)),
    z,
  ];

  for (let step = 0; step < count; step += 1) {
    const next = (step + 1) % count;

    // Торцы: полоса между наружным и внутренним контуром на обеих плоскостях.
    for (const [z, normal] of [
      [z0, [0, 0, -1]],
      [z1, [0, 0, 1]],
    ] as const) {
      addQuadFace(
        indices,
        positions,
        [
          at(outerRadius, step, z),
          at(outerRadius, next, z),
          at(innerRadius, next, z),
          at(innerRadius, step, z),
        ],
        normal,
      );
    }

    // Стенки: наружная смотрит от оси, внутренняя — в отверстие.
    for (const [radius, direction] of [
      [outerRadius, 1],
      [innerRadius, -1],
    ] as const) {
      const angle = angleAt(step);

      addQuadFace(
        indices,
        positions,
        [
          at(radius, step, z0),
          at(radius, next, z0),
          at(radius, next, z1),
          at(radius, step, z1),
        ],
        [direction * Math.sin(angle), direction * Math.cos(angle), 0],
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
 * У плоской панели оба кольца скруглённые: наружные углы идут дугой
 * `LITHOPHANE_FRAME_CORNER_RADIUS_MM`, окно накладки — дугой
 * `LITHOPHANE_FRAME_OPENING_RADIUS_MM`, окно полки — на накладку шире. Радиусы
 * ограничены четвертью своего прямоугольника, поэтому маленькая панель 40 мм
 * остаётся целой, а не превращается в овал. У круглой панели те же два кольца
 * строятся по кругу, без скруглений.
 *
 * Основание крепления печатается вместе с рамкой: короб или два рельса врастают
 * в её тыл на `BODY_OVERLAP_MM`. Так деталь остаётся одной печатной единицей, а
 * съёмной будет только подвижная часть — отсекатель или кольцо.
 */
export function createLithophaneFrameGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const metrics = lithophaneFrameMetrics(normalized);
  const { width, height, frameWidth, lip, frontZ } = metrics;
  const round = normalized.lithoShape === "round";
  const bodies: BufferGeometry[] = [];

  if (round) {
    const outerRadius = width / 2;
    const segments = Math.ceil((Math.PI * outerRadius) / 0.5);

    bodies.push(
      createCircularRingBody({
        centerY: height / 2,
        outerRadius,
        innerRadius: outerRadius - (frameWidth + lip),
        z0: 0,
        z1: LITHOPHANE_FRAME_SEAT_MM,
        segments,
      }),
      createCircularRingBody({
        centerY: height / 2,
        outerRadius,
        innerRadius: outerRadius - frameWidth,
        z0: LITHOPHANE_FRAME_SEAT_MM - 2 * BODY_OVERLAP_MM,
        z1: frontZ,
        segments,
      }),
    );
  } else {
    bodies.push(
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
    );
  }

  if (normalized.lithoMount === "led_box") {
    bodies.push(...createLedBoxBodies(metrics, round));
  }

  if (normalized.lithoMount === "socket_rail") {
    bodies.push(...createSocketRailBodies(normalized, metrics));
  }

  // Рамка собирается из нескольких тел, но печатается одной деталью: сварка
  // вершин и пересчёт нормалей делают её поверхность гладкой — на предпросмотре
  // она читается литой и матовой, а не набором плоскостей.
  return smoothGeometryNormals(mergeBodies(bodies, "рамки"));
}

/**
 * Короб под светодиодную плату: замкнутые тела детали «рамка».
 *
 * Короб вписан в контур рамки с отступом `inset` и стоит на её тылу. Внутри три
 * уровня: тыльная стенка с окном под провод, ложемент платы на ней, и полка под
 * фланец отсекателя ближе к панели. Плата ложится в ложемент между бортиком и
 * фланцем: бортик держит её от сдвига, фланец прижимает к стенке.
 *
 * У плоской панели короб прямоугольный, у круглой — цилиндрический: контур
 * круглой рамки не вмещает углы прямоугольного бокса. Окно под провод у
 * прямоугольного короба прямоугольное (собрано из четырёх кусков стенки), у
 * цилиндрического — круглое Ø 10 мм: провод выходит по оси платы.
 */
function createLedBoxBodies(
  metrics: FrameMetrics,
  round: boolean,
): BufferGeometry[] {
  const box = LITHOPHANE_LED_BOX;
  const overlap = BODY_OVERLAP_MM;
  const { width, height } = metrics;
  const depth = box.depth;
  const wall = box.wall;
  const backOuter = -depth;
  const backInner = backOuter + wall;

  if (round) {
    const bodies: BufferGeometry[] = [];
    const outerRadius = width / 2 - box.inset;
    const innerRadius = outerRadius - wall;
    const segments = Math.ceil((Math.PI * outerRadius) / 0.5);
    const pocketRadius = Math.max(
      10,
      Math.min(innerRadius - 10, box.boardMax / 2),
    );
    const shelfInner = pocketRadius + box.boardFit;
    const shelfOuter = shelfInner + box.boardShelf;
    const rimOuter = shelfInner + 2.5;
    const baffleInner = Math.max(6, pocketRadius - 8);
    const flangeOuter = baffleInner + 5;
    const centerY = height / 2;

    bodies.push(
      // Тыльная стенка — кольцо: круглое окно под провод по оси платы.
      createCircularRingBody({
        centerY,
        outerRadius: outerRadius - 0.25,
        innerRadius: 5,
        z0: backOuter,
        z1: backInner + overlap,
        segments,
      }),
      // Боковая стенка: труба от тыльной стенки до тыла рамки.
      createCircularRingBody({
        centerY,
        outerRadius,
        innerRadius,
        z0: backOuter,
        z1: overlap,
        segments,
      }),
      // Ложемент: полка под плату и бортик вокруг неё.
      createCircularRingBody({
        centerY,
        outerRadius: shelfOuter,
        innerRadius: shelfInner,
        z0: backInner - overlap,
        z1: backInner + 2,
        segments,
      }),
      createCircularRingBody({
        centerY,
        outerRadius: rimOuter,
        innerRadius: shelfInner + 0.4,
        z0: backInner + 2 - overlap,
        z1: backInner + box.boardRim,
        segments,
      }),
    );

    // Два кронштейна под фланец отсекателя: сверху и снизу от площадки платы.
    const bracketZ0 = backInner + box.boardRim + 4;
    const bracketHalf = Math.min(12, innerRadius / 2);

    for (const direction of [-1, 1]) {
      const from = centerY + direction * flangeOuter;
      const to = centerY + direction * Math.min(outerRadius - 0.5, innerRadius + 2);

      bodies.push(
        createBoxBody(
          -bracketHalf,
          bracketHalf,
          Math.min(from, to),
          Math.max(from, to),
          bracketZ0,
          bracketZ0 + 2.5,
        ),
      );
    }

    return bodies;
  }

  return createRectLedBoxBodies(metrics);
}

/**
 * Прямоугольный короб плоской панели.
 *
 * Стенки и ложемент — те же четыре полосы, что у цилиндрического: короб открыт
 * только вперёд, в окно рамки. Кронштейны стоят сверху и снизу от площадки
 * платы, поэтому фланец отсекателя ложится на них и не качается.
 */
function createRectLedBoxBodies(metrics: FrameMetrics): BufferGeometry[] {
  const box = LITHOPHANE_LED_BOX;
  const overlap = BODY_OVERLAP_MM;
  const { width, height } = metrics;
  const wall = box.wall;
  const halfWidth = width / 2 - box.inset;
  const boxBottom = box.inset;
  const boxTop = height - box.inset;
  const innerHalfWidth = halfWidth - wall;
  const innerBottom = boxBottom + wall;
  const innerTop = boxTop - wall;
  const backOuter = -box.depth;
  const backInner = backOuter + wall;
  const wireHalf = box.wireWidth / 2;
  const wireTop = height / 2 + box.wireHeight / 2;
  const wireBottom = height / 2 - box.wireHeight / 2;
  // Полка ложемента не выходит за стенки: на панели 40 мм свободного места
  // меньше, чем плата 60 мм, и ложемент сжимается вместе с коробом.
  const pocket = Math.max(
    12,
    Math.min(
      2 * (innerHalfWidth - box.boardShelf - 0.8),
      innerTop - innerBottom - 2 * box.boardShelf - 1.6,
      box.boardMax,
    ),
  );
  const centerY = height / 2;
  const shelfInner = pocket / 2 + box.boardFit;
  const shelfOuter = shelfInner + box.boardShelf;
  const rimOuter = shelfInner + 0.4 + 2.5;
  const rimInner = shelfInner + 0.4;
  const bodies: BufferGeometry[] = [
    // Тыльная стенка четырьмя кусками вокруг окна под провод.
    createBoxBody(-halfWidth, halfWidth, wireTop, boxTop, backOuter, backInner),
    createBoxBody(
      -halfWidth,
      halfWidth,
      boxBottom,
      wireBottom,
      backOuter,
      backInner,
    ),
    createBoxBody(
      -halfWidth,
      -wireHalf,
      wireBottom,
      wireTop,
      backOuter,
      backInner,
    ),
    createBoxBody(
      wireHalf,
      halfWidth,
      wireBottom,
      wireTop,
      backOuter,
      backInner,
    ),
    // Стенки: от тыльной стенки до тыла рамки с нахлёстом.
    createBoxBody(
      -halfWidth,
      -innerHalfWidth + overlap,
      boxBottom,
      boxTop,
      backInner - overlap,
      overlap,
    ),
    createBoxBody(
      innerHalfWidth - overlap,
      halfWidth,
      boxBottom,
      boxTop,
      backInner - overlap,
      overlap,
    ),
    createBoxBody(
      -innerHalfWidth,
      innerHalfWidth,
      boxBottom,
      innerBottom + overlap,
      backInner - overlap,
      overlap,
    ),
    createBoxBody(
      -innerHalfWidth,
      innerHalfWidth,
      innerTop - overlap,
      boxTop,
      backInner - overlap,
      overlap,
    ),
  ];



  // Ложемент платы: полка из четырёх полос и бортик вокруг неё.
  for (const [z0, z1, inner, outerHalf] of [
    [backInner - overlap, backInner + 2, shelfInner, shelfOuter],
    [
      backInner + 2 - overlap,
      backInner + box.boardRim,
      rimInner,
      rimOuter,
    ],
  ] as const) {
    bodies.push(
      createBoxBody(
        -outerHalf,
        outerHalf,
        centerY - outerHalf,
        centerY - inner,
        z0,
        z1,
      ),
      createBoxBody(
        -outerHalf,
        outerHalf,
        centerY + inner,
        centerY + outerHalf,
        z0,
        z1,
      ),
      createBoxBody(
        -outerHalf,
        -inner,
        centerY - outerHalf,
        centerY + outerHalf,
        z0,
        z1,
      ),
      createBoxBody(
        inner,
        outerHalf,
        centerY - outerHalf,
        centerY + outerHalf,
        z0,
        z1,
      ),
    );
  }

  // Кронштейны под фланец отсекателя: сверху и снизу от площадки платы.
  const flangeHalf = Math.max(10, pocket / 2 - 3);
  const bracketZ0 = backInner + box.boardRim + 4;
  const bracketHalf = Math.min(12, innerHalfWidth / 2);

  for (const direction of [-1, 1]) {
    const wallDistance =
      direction < 0 ? centerY - innerBottom : innerTop - centerY;
    const from = centerY + direction * flangeHalf;
    const to =
      centerY + direction * Math.max(flangeHalf + 1, wallDistance + 2);
    const y0 = Math.min(from, to);
    const y1 = Math.max(from, to);

    if (y1 - y0 > 0.5) {
      bodies.push(
        createBoxBody(
          -bracketHalf,
          bracketHalf,
          y0,
          y1,
          bracketZ0,
          bracketZ0 + 2.5,
        ),
      );
    }
  }

  return bodies;
}

/**
 * Отсекатель короба: съёмная деталь «крепление».
 *
 * Квадратный (у плоской панели) или круглый (у круглой) тубус входит в короб и
 * садится фланцем на кронштейны. Тубус выходит на 8 мм вперёд и на 8 мм
 * перекрывает плату по краям: косые лучи, которые иначе били бы в кромку кадра
 * и в стенки короба, срезаются его стенкой, а на панель идёт ровное пятно.
 *
 * Задняя плоскость тубуса стоит в 0.5 мм над платой: фланец прижимает плату к
 * тыльной стенке, поэтому она не гремит и не сползает по ложементу.
 */
function createLedBaffleGeometry(normalized: LithophaneParams): BufferGeometry {
  const box = LITHOPHANE_LED_BOX;
  const overlap = BODY_OVERLAP_MM;
  const round = normalized.lithoShape === "round";
  const width = normalized.lithophaneWidth;
  const height = round ? width : normalized.lithophaneHeight;
  const centerY = height / 2;
  const wall = box.baffleWall;
  const backInner = -box.depth + box.wall;
  const tubeFront = backInner + box.boardRim + 4 - box.baffleHeight;
  const flangeZ0 = backInner + box.boardRim + 4;
  const flangeZ1 = flangeZ0 + 2.5;
  const bodies: BufferGeometry[] = [];

  if (round) {
    const outerRadius = width / 2 - box.inset;
    const innerRadius = outerRadius - box.wall;
    const segments = Math.ceil((Math.PI * outerRadius) / 0.5);
    const pocketRadius = Math.max(
      10,
      Math.min(innerRadius - 10, box.boardMax / 2),
    );
    const tubeOuter = Math.max(12, pocketRadius - 8 + wall);
    const tubeInner = tubeOuter - wall;
    const flangeOuter = tubeOuter + 5;

    bodies.push(
      createCircularRingBody({
        centerY,
        outerRadius: tubeOuter,
        innerRadius: tubeInner,
        z0: tubeFront - overlap,
        z1: flangeZ0,
        segments,
      }),
      createCircularRingBody({
        centerY,
        outerRadius: flangeOuter,
        innerRadius: tubeInner,
        z0: flangeZ0 - overlap,
        z1: flangeZ1,
        segments,
      }),
    );

    return mergeBodies(bodies, "отсекателя");
  }

  const halfWidth = width / 2 - box.inset;
  const innerHalfWidth = halfWidth - box.wall;
  const innerBottom = box.inset + box.wall;
  const innerTop = height - box.inset - box.wall;
  // Полка ложемента не выходит за стенки: на панели 40 мм свободного места
  // меньше, чем плата 60 мм, и ложемент сжимается вместе с коробом.
  const pocket = Math.max(
    12,
    Math.min(
      2 * (innerHalfWidth - box.boardShelf - 0.8),
      innerTop - innerBottom - 2 * box.boardShelf - 1.6,
      box.boardMax,
    ),
  );
  const tubeOuter = pocket / 2 - 8 + wall;
  const tubeInner = tubeOuter - wall;
  const flangeOuter = tubeOuter + 5;

  for (const [z0, z1, outerHalf] of [
    [tubeFront - overlap, flangeZ0, tubeOuter],
    [flangeZ0 - overlap, flangeZ1, flangeOuter],
  ] as const) {
    bodies.push(
      createBoxBody(
        -outerHalf,
        outerHalf,
        centerY - outerHalf,
        centerY - tubeInner,
        z0,
        z1,
      ),
      createBoxBody(
        -outerHalf,
        outerHalf,
        centerY + tubeInner,
        centerY + outerHalf,
        z0,
        z1,
      ),
      createBoxBody(
        -outerHalf,
        -tubeInner,
        centerY - tubeInner,
        centerY + tubeInner,
        z0,
        z1,
      ),
      createBoxBody(
        tubeInner,
        outerHalf,
        centerY - tubeInner,
        centerY + tubeInner,
        z0,
        z1,
      ),
    );
  }

  return mergeBodies(bodies, "отсекателя");
}

/**
 * Полуширина рельса по X, мм.
 *
 * Рельс не доходит до края панели на 14 мм с каждой стороны: по углам рамки
 * остаётся место для скругления, и каретка не выходит за силуэт детали. Минимум
 * 12 мм — иначе на панели 40 мм рельс выродился бы в точку.
 */
function socketRailHalf(width: number): number {
  return Math.max(12, width / 2 - 14);
}

/**
 * Монорельс: две направляющие за верхней и нижней кромками рамки.
 *
 * Рельсы выходят за габарит панели на `railOffset` 8 мм: сверху они не спорят с
 * кадром, а снизу работают подставкой — литофан стоит на нижнем рельсе и на
 * передней лапе, поэтому центр тяжести панели остаётся внутри опоры. Длина
 * рельса — расстояние до кольца плюс `railTail`: на дальнем конце стоит упор,
 * за который каретка не уезжает.
 *
 * Рельс входит в тыл рамки на `BODY_OVERLAP_MM`, поэтому вся система печатается
 * одной деталью с рамкой. У круглой панели рельс касается окружности в самой
 * нижней и самой верхней точке — там же, где у прямоугольной стоит его полка.
 */
function createSocketRailBodies(
  normalized: LithophaneParams,
  metrics: FrameMetrics,
): BufferGeometry[] {
  const rail = LITHOPHANE_SOCKET_RAIL;
  const overlap = BODY_OVERLAP_MM;
  const { width, height } = metrics;
  const halfWidth = socketRailHalf(width);
  const endZ = -(normalized.lithoRailDistance + rail.railTail);
  const bottom = -rail.railOffset;
  const top = height + rail.railOffset - rail.railHeight;
  const bodies: BufferGeometry[] = [];

  for (const y0 of [bottom, top]) {
    bodies.push(
      createBoxBody(
        -halfWidth,
        halfWidth,
        y0,
        y0 + rail.railHeight,
        endZ,
        overlap,
      ),
      // Упор: каретка упирается в него раньше, чем сойдёт с рельса.
      createBoxBody(
        -halfWidth - 2,
        halfWidth + 2,
        y0 - 2,
        y0 + rail.railHeight + 2,
        endZ - 4,
        endZ,
      ),
    );
  }

  // Лапа: пятно опоры впереди панели, чтобы литофан не опрокидывался.
  bodies.push(createBoxBody(-halfWidth, halfWidth, bottom, 0, -2, 12));

  return bodies;
}


/**
 * Кольцо монорельса: каретка с площадкой под патрон.
 *
 * Два С-образных захвата висят на рельсах: снизу — стенка, по бокам — щёки,
 * сверху проём. Такая каретка ставится на рельс снизу и держится собственным
 * весом, а вдоль рельса едет до упора. Боковые стойки связывают захваты, три
 * спицы держат площадку патрона.
 *
 * Патрон фиксируется штатной гайкой: резьба проходит сквозь отверстие площадки,
 * гайка ложится на её плоскую тыльную плоскость и входит внутрь бортика —
 * бортик работает ключом и не даёт гайке провернуться. Козырёк над кольцом
 * закрывает лампу сверху, поэтому свет уходит на панель, а не в глаза.
 */
function createSocketRingGeometry(
  normalized: LithophaneParams,
): BufferGeometry {
  const rail = LITHOPHANE_SOCKET_RAIL;
  const socket = LITHOPHANE_SOCKETS[normalized.lithoBulb];
  const overlap = BODY_OVERLAP_MM;
  const width = normalized.lithophaneWidth;
  const height =
    normalized.lithoShape === "round"
      ? width
      : normalized.lithophaneHeight;
  const gap = rail.carriageGap;
  const wall = rail.carriageWall;
  const length = rail.carriageLength;
  const front = -normalized.lithoRailDistance;
  const back = front - length;
  const halfWidth = socketRailHalf(width);
  const bottom = -rail.railOffset;
  const top = height + rail.railOffset - rail.railHeight;
  const bodies: BufferGeometry[] = [];

  for (const y0 of [bottom, top]) {
    // Стенка под рельсом: на ней каретка и висит.
    bodies.push(
      createBoxBody(
        -halfWidth - gap - wall,
        halfWidth + gap + wall,
        y0 - gap - wall,
        y0 - gap,
        back,
        front,
      ),
      createBoxBody(
        -halfWidth - gap - wall,
        -halfWidth - gap,
        y0 - gap - wall,
        y0 + rail.railHeight + gap,
        back,
        front,
      ),
      createBoxBody(
        halfWidth + gap,
        halfWidth + gap + wall,
        y0 - gap - wall,
        y0 + rail.railHeight + gap,
        back,
        front,
      ),
    );
  }

  // Боковые стойки: от нижнего захвата до верхнего, во всю глубину каретки.
  const barOuter = halfWidth + gap + wall;
  const barInner = barOuter - rail.frameWidth;
  const barBottom = bottom - gap - wall;
  const barTop = top + rail.railHeight + gap;

  for (const sign of [-1, 1]) {
    const x0 = sign < 0 ? -barOuter : barInner;
    const x1 = sign < 0 ? -barInner : barOuter;

    bodies.push(createBoxBody(x0, x1, barBottom, barTop, back, front));
  }



  // Площадка патрона: кольцо вокруг резьбы, бортик под гайку и спицы.
  const padDiameter = Math.max(
    socket.thread + 10,
    Math.min(rail.padMaxDiameter, Math.max(30, Math.min(width, height) - 4)),
  );
  const padRadius = padDiameter / 2;
  const centerY = height / 2;
  const padZ0 = front - rail.padThickness;
  const segments = Math.ceil((Math.PI * padRadius) / 0.5);

  bodies.push(
    createCircularRingBody({
      centerY,
      outerRadius: padRadius,
      innerRadius: socket.thread / 2,
      z0: padZ0,
      z1: front,
      segments,
    }),
    createCircularRingBody({
      centerY,
      outerRadius: socket.nut / 2 + rail.nutClearance + rail.rimWall,
      innerRadius: socket.nut / 2 + rail.nutClearance,
      z0: padZ0 - rail.rimHeight,
      z1: padZ0 + overlap,
      segments,
    }),
  );

  const spokeHalf = rail.frameWidth / 2;

  for (const [from, to] of [
    [-barInner + overlap, -padRadius + 2],
    [padRadius - 2, barInner - overlap],
  ] as const) {
    if (Math.abs(to - from) > 2) {
      bodies.push(
        createBoxBody(
          Math.min(from, to),
          Math.max(from, to),
          centerY - spokeHalf,
          centerY + spokeHalf,
          padZ0,
          front,
        ),
      );
    }
  }

  const upperSpokeFrom = centerY + padRadius - 2;
  const upperSpokeTo = barTop - overlap;

  if (upperSpokeTo - upperSpokeFrom > 2) {
    bodies.push(
      createBoxBody(
        -spokeHalf,
        spokeHalf,
        upperSpokeFrom,
        upperSpokeTo,
        padZ0,
        front,
      ),
    );
  }

  // Козырёк: полка под верхним захватом и губа на её переднем крае.
  const visorTop = top - gap - wall + overlap;
  const visorBottom = visorTop - rail.visorThickness;
  const visorHalf = Math.min(halfWidth, width / 2 - 8);
  const visorFront = front + rail.visorLength;

  bodies.push(
    createBoxBody(
      -visorHalf,
      visorHalf,
      visorBottom,
      visorTop,
      front - overlap,
      visorFront,
    ),
    createBoxBody(
      -visorHalf,
      visorHalf,
      visorBottom - rail.visorLip,
      visorBottom + overlap,
      visorFront - rail.visorThickness,
      visorFront,
    ),
  );

  return mergeBodies(bodies, "кольца");
}


/**
 * Съёмная деталь крепления отдельным файлом.
 *
 * У короба это отсекатель, у монорельса — кольцо с площадкой патрона. У
 * `none` отдельной детали нет: функция бросает ошибку, чтобы сборка не отдала
 * пустой STL вместо крепления.
 */
export function createLithophaneMountGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);

  if (!lithophaneHasStand(normalized.lithoMount)) {
    throw new Error("У выбранного крепления нет отдельной печатной детали.");
  }

  return smoothGeometryNormals(
    normalized.lithoMount === "socket_rail"
      ? createSocketRingGeometry(normalized)
      : createLedBaffleGeometry(normalized),
  );
}

/**
 * Сборка литофана: деталь по имени или всё вместе.
 *
 * Плита ставится на заднюю полку рамки: по X и Y она уже окна на зазор посадки,
 * по Z — на плоскость полки. Крепление (`mount`) в сборку входит отдельной
 * деталью: петли и кольцо не печатаются с рамкой, но в собранном виде стоят на
 * своих местах.
 *
 * Группы материалов: рельеф идёт первым, поэтому его диапазон индексов занимает
 * начало сетки; рамка и крепление красятся вторым материалом со сглаженными
 * нормалями.
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

  if (part === "mount") {
    return markPartGroup(
      createLithophaneMountGeometry(normalized),
      LITHOPHANE_DETAIL_GROUP,
    );
  }

  const relief = createLithophaneReliefGeometry(normalized);
  // Порядок слияния задаёт диапазоны индексов: рельеф идёт первым, поэтому его
  // группа занимает начало сетки.
  const reliefIndices = relief.getIndex()?.count ?? 0;

  /*
    Без рамки печатается только плита: ни полки, ни паза нет, поэтому плита
    остаётся на своём месте (тыл в плоскости Z = 0), а в предпросмотре нет
    рамки, которой не будет в файле.
  */
  if (!normalized.lithoFrame) {
    return assignMaterialGroups(relief, reliefIndices);
  }

  const metrics = lithophaneFrameMetrics(normalized);
  const frame = createLithophaneFrameGeometry(normalized);
  const bodies = [relief, frame];

  relief.translate(
    0,
    metrics.frameWidth + LITHOPHANE_FIT_GAP_MM,
    metrics.plateBack,
  );

  if (lithophaneHasStand(normalized.lithoMount)) {
    bodies.push(createLithophaneMountGeometry(normalized));
  }

  return assignMaterialGroups(mergeBodies(bodies, "литофана"), reliefIndices);
}


/**
 * Круглая плита рельефа: полярная сетка, четыре сектора и плоский тыл.
 *
 * Диск режется кольцами и секторами (`lithophaneRoundMeshSize`). Внутри сектора
 * точка считается в долях радиуса и угла: `x = r·sin φ`, `y = r·cos φ`. Эти же
 * доли задают место в кадре сектора, поэтому фото ложится в четверть диска —
 * центр кадра в центре панели, край кадра у кромки.
 *
 * Сектор 0 — правый верхний, дальше по часовой: у него основной кадр
 * (`lithophaneBrightness`), у остальных — слоты `lithophaneSideBrightness`.
 * Пустой слот повторяет основной кадр (см. `lithophaneFaceBrightness`), поэтому
 * одна фотография печатается на всех четырёх.
 *
 * Оболочка замкнута тремя частями: лицо с толщиной по яркости, плоский тыл и
 * боковина по кромке. Бортик `borderWidth` и фаска работают так же, как у
 * плоской панели: по краю идёт полоса максимальной толщины.
 */
function createRoundReliefBody(
  normalized: LithophaneParams,
  diameter: number,
  borderWidth: number,
): BufferGeometry {
  const mesh = lithophaneRoundMeshSize(diameter);

  if (mesh === null) {
    throw new Error(LITHOPHANE_MESH_TOO_LARGE_MESSAGE);
  }

  const { rings, segments } = mesh;
  const minThickness = normalized.lithophaneMinThickness;
  const maxThickness = normalized.lithophaneMaxThickness;
  const thicknessRange = maxThickness - minThickness;
  const radius = diameter / 2;
  const centerY = radius;
  const chamferWidth =
    borderWidth > 0 ? Math.min(LITHOPHANE_BORDER_CHAMFER_MM, borderWidth) : 0;
  const borderFlat = borderWidth - chamferWidth;
  const grids = lithophaneFaceBrightness(normalized);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const brightnessAt = (radiusFraction: number, angle: number): number => {
    const sector = Math.min(3, Math.floor(angle / (Math.PI / 2)));
    const local = angle - sector * (Math.PI / 2);
    const x = radiusFraction * Math.sin(local);
    const y = radiusFraction * Math.cos(local);
    const grid = grids[sector];
    let u: number;
    let v: number;

    if (sector === 0) {
      u = 0.5 + x / 2;
      v = 0.5 - y / 2;
    } else if (sector === 1) {
      u = 0.5 + x / 2;
      v = 0.5 + y / 2;
    } else if (sector === 2) {
      u = 0.5 - x / 2;
      v = 0.5 + y / 2;
    } else {
      u = 0.5 - x / 2;
      v = 0.5 - y / 2;
    }

    return sharpenBrightness(grid.brightness, grid.width, grid.height, u, v);
  };

  const thicknessAt = (radiusFraction: number, angle: number): number => {
    const edgeDistance = radius * (1 - radiusFraction);

    if (edgeDistance <= borderFlat) {
      return maxThickness;
    }

    const photoThickness =
      maxThickness -
      thicknessRange * (brightnessAt(radiusFraction, angle) / 255);

    if (edgeDistance >= borderWidth) {
      return photoThickness;
    }

    return (
      maxThickness +
      (photoThickness - maxThickness) *
        ((edgeDistance - borderFlat) / chamferWidth)
    );
  };

  const pushVertex = (
    radiusFraction: number,
    angle: number,
    z: number,
  ): number => {
    const x = radius * radiusFraction * Math.sin(angle);
    const y = centerY + radius * radiusFraction * Math.cos(angle);
    const index = positions.length / 3;

    positions.push(x, y, z);
    uvs.push(0.5 + x / diameter, 0.5 - (y - centerY) / diameter);

    return index;
  };

  const center = pushVertex(0, 0, thicknessAt(0, 0));
  const face: number[][] = [];

  for (let ring = 1; ring <= rings; ring += 1) {
    const radiusFraction = ring / rings;
    const row: number[] = [];

    for (let step = 0; step < segments; step += 1) {
      const angle = (step / segments) * Math.PI * 2;

      row.push(
        pushVertex(radiusFraction, angle, thicknessAt(radiusFraction, angle)),
      );
    }

    face.push(row);
  }

  // Лицо: веер у центра и кольца квадов между соседними кольцами.
  for (let step = 0; step < segments; step += 1) {
    const next = (step + 1) % segments;

    addOrientedTriangle(
      indices,
      positions,
      center,
      face[0][step],
      face[0][next],
      [0, 0, 1],
    );

    for (let ring = 1; ring < rings; ring += 1) {
      addOrientedQuad(
        indices,
        positions,
        face[ring - 1][step],
        face[ring - 1][next],
        face[ring][next],
        face[ring][step],
        [0, 0, 1],
      );
    }
  }

  // Тыл: диск от центра к внешнему кольцу, плоскость Z = 0.
  const backCenter = pushVertex(0, 0, 0);
  const backRing: number[] = [];

  for (let step = 0; step < segments; step += 1) {
    backRing.push(pushVertex(1, (step / segments) * Math.PI * 2, 0));
  }

  for (let step = 0; step < segments; step += 1) {
    const next = (step + 1) % segments;
    const angle = ((step + 0.5) / segments) * Math.PI * 2;

    addOrientedTriangle(
      indices,
      positions,
      backCenter,
      backRing[step],
      backRing[next],
      [0, 0, -1],
    );
    addOrientedQuad(
      indices,
      positions,
      face[rings - 1][step],
      face[rings - 1][next],
      backRing[next],
      backRing[step],
      [Math.sin(angle), Math.cos(angle), 0],
    );
  }

  const geometry = finalizeGeometry(positions, indices);

  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));

  return geometry;
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

