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
  LITHOPHANE_BEND_STRIP_MM,
  LITHOPHANE_KALEIDOSCOPE_SIDES,
  LITHOPHANE_MESH_TOO_LARGE_MESSAGE,
  LITHOPHANE_RAIL_SOCKET_SIZES,
  lithophaneFaceBrightness,
  lithophaneHasLedBox,
  lithophaneHasRail,
  lithophaneHasStand,
  lithophaneMeshOptions,
  lithophaneMeshSize,
  lithophanePanelCount,
  lithophaneShapeHasBase,
  lithophaneShapeHasMounts,
  normalizeLithophaneParams,
  type LithophaneBrightnessGrid,
  type LithophaneLightSeat,
  type LithophaneLightSource,
  type LithophaneMount,
  type LithophaneParams,
  type LithophanePart,
} from "@/lib/constructor/params";

/**
 * Геометрия литофана: плоская панель с рамкой, круглый плафон и калейдоскоп.
 *
 * Плоская панель стоит в плоскости XY нижней кромкой на Y = 0, лицо смотрит в
 * +Z; у подставки база лежит на столе. Рельеф — heightfield по габаритам плиты:
 * шаг вершины считается из стандарта 0.3 мм (`lithophaneMeshSize`), поэтому на
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
 * Деталей у плоской панели три, и каждая — отдельный замкнутый объект:
 *   `relief` — плита с плоским тылом и рельефом на лице; углы скруглены на
 *              радиус окна рамки, чтобы плита входила в него с зазором;
 *   `frame`  — скруглённое кольцо с задней полкой (плита садится на неё с
 *              зазором 0.2 мм) и передней накладкой, которая прижимает её край;
 *              наружные углы — дугой 6 мм, окно — дугой 2 мм;
 *   `stand`  — подставка: база, передняя губа и задняя стойка под наклоном 12°
 *              со скруглением в тыльном углу. В интерфейсе креплений больше нет,
 *              но геометрия осталась для сохранённых проектов и API.
 *
 * Круглый плафон — полый цилиндр из двух-четырёх панелей: каждая панель это тот
 * же рельеф, но вершины рождаются сразу в цилиндрических координатах, поэтому
 * тыл остаётся на радиусе, а поверхность получается гладкой без изгиба готовой
 * сетки. Панели занимают соседние секторы окружности и образуют замкнутую
 * стенку; внутри остаётся пустая камера под лампу. Рамки и базы у плафона нет.
 *
 * Калейдоскоп — призма из четырёх плоских граней без рамок на полом цоколе с
 * тонкой крышкой: каждая грань может нести своё фото.
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
 * Короб под LED-панель: тонкий световой бокс за плоской рамкой.
 *
 * За рамкой стоит закрытый ящик глубиной `depth`: стенки наращивают её тыл теми
 * же полосами, что и у подвеса, — скруглённые углы рамки остаются открытыми. На
 * передине, сразу за тылом плиты, — полка `ledge` под квадратную LED-панель: она
 * прижимает светящуюся плоскость к самой плите, поэтому свет ложится ровно и
 * рельеф не расплывается. Панель вставляют с тыла и подпирает съёмная задняя
 * крышка: её воротник входит в паз `coverGroove` на тылу короба, а в самой
 * крышке — окно под провод.
 *
 * Паза под лист-рассеиватель здесь нет: у LED-панели рассеиватель уже в её
 * корпусе, и лишний слой акрила только съел бы зазор до плиты.
 */
export const LITHOPHANE_LED_BOX = {
  /**
   * Глубина короба по Z: от тыла рамки до внешней плоскости задней крышки, мм.
   *
   * Пятнадцати хватает на панель до 7–8 мм с разъёмом и проводом: внутри
   * остаётся карман `depth − ledgeDepth − coverGroove` ≈ 10 мм.
   */
  depth: 15,
  /** Толщина стенок, мм. */
  wall: 2.5,
  /** Отступ наружного контура короба от контура рамки, мм. */
  inset: 2,
  /** Полка под LED-панель: выступ в просвет и длина по Z от тыла рамки, мм. */
  ledge: 3,
  ledgeDepth: 2.5,
  /**
   * Паз под заднюю крышку, мм: длина по Z и глубина с каждой стороны.
   *
   * Паз открыт назад, поэтому крышка вставляется с тыла, воротник входит в него
   * с натягом по бокам и упирается в передний уступ — деталь держится трением и
   * снимается рукой.
   */
  coverGroove: 2.4,
  coverGrooveDepth: 1.2,
  /** Толщина задней крышки и ширина её воротника, мм. */
  coverThickness: 2,
  coverFlange: 2,
  /** Зазор воротника в пазу и до его переднего уступа, мм. */
  coverClearance: 0.15,
  /**
   * Окно под провод в задней крышке, мм.
   *
   * Дно окна поднято над нижней кромкой крышки на `wireLift`: провод выходит из
   * короба горизонтально и его не прижимает к столу, когда литофан стоит.
   */
  wireWidth: 8,
  wireHeight: 8,
  wireLift: 6,
  /**
   * Сетка точек LED-панели для расчёта света: по X и по Y.
   *
   * Панель — площадной источник, а расчёт складывает точечные. Двенадцать точек
   * на просвете полки дают на карте ровное поле, но не превращают предпросмотр
   * в гирлянду из лампочек.
   */
  emittersX: 4,
  emittersY: 3,
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

/**
 * Нахлёст двух объединяемых оболочек, мм: без него слайсер видит два тела.
 *
 * На этот же размер плита сдвинута вперёд относительно тыла рамки, поэтому
 * плоскость её тыла — `LITHOPHANE_FRAME_SEAT_MM - BODY_OVERLAP_MM`. Светотехника
 * берёт отсюда положение панели, чтобы лампы стояли в сборке, а не рядом.
 */
export const BODY_OVERLAP_MM = 0.2;

/**
 * Нижний полоз: узкая шина по центру нижней кромки тыла плоской рамки.
 *
 * Полоз печатается вместе с рамкой одной деталью. Шина 14 × 5 мм лежит на столе
 * (Y = 0) и нахлёстом входит в тыл нижней полки рамки, поэтому растёт из рамки,
 * а не висит на ней. Назад шина уходит на `depth` и несёт Т-образную
 * направляющую: сверху открыта шейка 6 мм, под ней — карман 10 мм с фланками под
 * 45°. Паз открыт с торцов, поэтому печатается без поддержек, а карман держит
 * салазки ножки кольца: каретка едет по нему вдоль Z и не опрокидывается вперёд.
 *
 * Салазки уже кармана и шейки на `clearance` с каждой стороны: ножка входит в паз
 * с торца, едет по нему без затирания, а фланки кармана не дают кольцу наклониться
 * ни вперёд, ни назад.
 */
export const LITHOPHANE_RAIL = {
  /** Ширина шины по X, мм. */
  width: 14,
  /** Толщина шины на столе: верх рельса, мм. */
  thickness: 5,
  /**
   * Выступ шины назад от тыла рамки, мм: по её пазу каретка едет вдоль Z,
   * поэтому шина длиннее хода салазок на всём диапазоне `lithoRailDistance`.
   */
  depth: 100,
  /** Ширина шейки паза под ножку кольца, мм. */
  slotWidth: 6,
  /** Высота шейки от верха шины вниз, мм. */
  slotDepth: 1.5,
  /**
   * Ширина кармана под салазки на дне паза, мм.
   *
   * Фланки кармана идут под 45°, поэтому вылет кармана за шейку равен его высоте:
   * дно кармана на `thickness − slotDepth − (cavityWidth − slotWidth) / 2` = 1.5 мм.
   */
  cavityWidth: 10,
  /**
   * Зазор между пазом и салазками на сторону, мм.
   *
   * 0.4 мм — двойная посадка: каретку вставляют с торца шины рукой, а если её
   * всё же печатают в сборе (print-in-place), зазор держит салазки и фланки
   * раздельными и слайсер не спекает каретку с полозом.
   */
  clearance: 0.4,
  /** Нахлёст шины с рамкой по Z, мм. */
  frameOverlap: BODY_OVERLAP_MM,
} as const;

/**
 * Держатель патрона: плоское кольцо Ø32 (E14) или Ø42 (E27) на ножке с
 * салазками и козырьком.
 *
 * Каретка-барабан заменена кольцом: патрон стандартный — с наружной резьбой и
 * штатной гайкой, — поэтому кольцу не нужны ни корпус, ни полость. Кольцо просто
 * зажимается между фланцем патрона и его же гайкой: отверстие равно резьбе
 * (Ø14.6 у E14 и Ø28.6 у E27), а наружный диаметр считается от гайки — см.
 * `LITHOPHANE_RAIL_SOCKET_SIZES`.
 *
 * Лицо кольца смотрит на панель: в нём утоплена круглая зенковка под фланец
 * патрона (`flangeDepth`), поэтому патрон садится ровно, а не на кромку
 * отверстия. С тыла — плоская площадка с шестигранным гнездом под штатную гайку:
 * гайка не проворачивается под ключом. Между дном зенковки и гнездом остаётся
 * 2 мм мяса.
 *
 * Кольцо стоит на ножке: снизу к нему примыкает вертикальная пластина
 * `stemWidth × stemDepth`, а её низ расширен в салазки `sledWidth` с фланками под
 * 45°. Салазки входят в Т-образный паз полоза с зазорами по бокам и едут по нему
 * вдоль Z, поэтому каретка — отдельная подвижная деталь: её вставляют с торца
 * шины и двигают слайдером «Расстояние до панели». Высота оси — половина высоты
 * панели, так что патрон сам оказывается напротив центра кадра.
 *
 * Козырёк — тонкая (2 мм) гнутая пластина поверх макушки кольца, шириной в само
 * кольцо: выступает к панели на `visorRun`, плавно опускается к носу на
 * `visorDrop` и закрывает патрон от глаз. Хвост навеса врезан в кольцо на
 * `BODY_OVERLAP_MM`, поэтому козырёк и кольцо спекаются в одну деталь.
 */
export const LITHOPHANE_CARRIAGE = {
  /** Толщина кольца вдоль оси патрона, мм. */
  ringDepth: 5,
  /** Глубина круглой зенковки под фланец патрона с лица, мм. */
  flangeDepth: 1,
  /** Зазор зенковки под фланец по диаметру, мм. */
  flangeClearance: 0.4,
  /** Глубина шестигранного гнезда под гайку с тыла, мм. */
  nutDepth: 2,
  /** Зазор шестигранного гнезда под гайку на сторону, мм. */
  nutClearance: 0.2,
  /**
   * Ножка: толщина вдоль Z и предельный нахлёст в мясо кольца, мм.
   *
   * Ширина ножки — шейка паза минус зазор на сторону, а ширина салазок — карман
   * минус зазор; обе считаются в `lithophaneCarriageMetrics`. Толщина 10 мм — это
   * пятно опоры: салазки стоят в кармане на дне и не качаются вдоль Z. Верх ножки
   * врезан в кольцо снизу, но не глубже `stemOverlap` и не выше гнезда гайки:
   * резьба и гайка остаются свободными, а кольцо и ножка спекаются в одну деталь.
   */
  stemDepth: 10,
  stemOverlap: 5,
  /**
   * Зазор между низом кольца и верхом шины, мм.
   *
   * Кольцо висит над полозом на 1 мм: в пазу стоят только салазки, а само кольцо
   * шины не касается, поэтому его мясо не трётся о рельс при перестановке.
   */
  railGap: 1,
  /** Зазор между козырьком и панелью, мм. */
  panelClearance: 3,
  /**
   * Козырёк: вылет к панели, толщина, хвост в кольце и провис носа, мм.
   *
   * Пластина лежит на макушке кольца и плавно опускается к панели на
   * `visorDrop`: это не плита, а гнутый навес. По ширине он равен кольцу, поэтому
   * считается в `lithophaneCarriageMetrics`. Низ навеса поднят выше резьбы E27,
   * поэтому лампа вкручивается рукой, а хвост утоплен в кольцо — козырёк остаётся
   * частью держателя, а не отдельной деталью.
   */
  visorRun: 20,
  visorThickness: 2,
  visorTail: 2,
  visorDrop: 5,
  /** Скругление носа навеса в плане, мм. */
  visorRadius: 6,
  /** Фаска на кромках навеса: по бокам и по низу, мм. */
  visorChamfer: 0.6,
  /** Сегментов по наружной дуге кольца: 48 — круг читается гладким. */
  ringSegments: 48,
  /** Сегментов у круглых отверстий и зенковки. */
  boreSegments: 24,
} as const;

/**
 * Смещение каретки в собранном виде, мм.
 *
 * В пазу полоза каретка стоит вплотную к рельсу, и в общем STL слайсер видит
 * одну деталь с рамкой. На собранном виде каретку уводим вбок на это расстояние
 * и опускаем на стол: она лежит рядом с рамкой отдельной деталью, а сборка
 * остаётся наглядной.
 *
 * 150 мм хватает на всю ширину панели: у самой широкой (200 мм) полуширина
 * рамки 104 мм, а кольцо E27 занимает ещё 21 мм.
 */
export const LITHOPHANE_CARRIAGE_OFFSET_MM = 150;

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
 * Габариты короба под LED-панель, мм.
 *
 * Считаются в одном месте: по ним строятся стенки, крышка, крепление в сборке и
 * точки светящейся панели в расчёте света. Короб вписан в контур рамки с
 * отступом `inset` — скруглённые углы рамки остаются открытыми, — поэтому все
 * размеры выведены из габарита рамки, а не заданы отдельно.
 *
 * По Z короб идёт от тыла рамки назад: полка под панель (`ledgeDepth`), карман
 * под саму панель и паз под заднюю крышку у самого тыла. Плоскость лица панели —
 * задняя плоскость полки: светит она вплотную к тылу плиты, поэтому карта света
 * ровная, а рельеф не расплывается.
 */
export type LithophaneLedBoxMetrics = {
  /** Наружный контур короба и его радиус, мм. */
  outerWidth: number;
  outerHeight: number;
  outerRadius: number;
  /** Просвет стенок: сюда входит панель. */
  innerWidth: number;
  innerHeight: number;
  /** Центр короба по Y: он совпадает с центром рамки. */
  centerY: number;
  /**
   * Плоскости по Z, мм: тыл рамки с нахлёстом, задняя плоскость полки, передний
   * уступ паза под крышку и наружная плоскость крышки.
   */
  frontZ: number;
  ledgeBackZ: number;
  grooveFrontZ: number;
  backZ: number;
  /** Просвет полки под панель и плоскость её лица, мм. */
  panelWidth: number;
  panelHeight: number;
  panelZ: number;
  /** Просвет паза под крышку и его радиус, мм. */
  grooveWidth: number;
  grooveHeight: number;
  grooveRadius: number;
};

export function lithophaneLedBoxMetrics(
  params: Partial<LithophaneParams>,
): LithophaneLedBoxMetrics {
  const normalized = normalizeLithophaneParams(params);
  const metrics = lithophaneFrameMetrics(normalized);
  const box = LITHOPHANE_LED_BOX;
  const outerWidth = metrics.width - 2 * box.inset;
  const outerHeight = metrics.height - 2 * box.inset;
  // Радиус короба меньше рамки на отступ: контуры параллельны, и полоса тыльной
  // полки рамки остаётся ровной по всему периметру, включая углы.
  const outerRadius = Math.max(0.5, metrics.cornerRadius - box.inset);
  const innerWidth = outerWidth - 2 * box.wall;
  const innerHeight = outerHeight - 2 * box.wall;
  const backZ = -box.depth;

  return {
    outerWidth,
    outerHeight,
    outerRadius,
    innerWidth,
    innerHeight,
    centerY: metrics.height / 2,
    frontZ: BODY_OVERLAP_MM,
    ledgeBackZ: -box.ledgeDepth,
    grooveFrontZ: backZ + box.coverGroove,
    backZ,
    panelWidth: innerWidth - 2 * box.ledge,
    panelHeight: innerHeight - 2 * box.ledge,
    panelZ: -box.ledgeDepth,
    grooveWidth: innerWidth + 2 * box.coverGrooveDepth,
    grooveHeight: innerHeight + 2 * box.coverGrooveDepth,
    grooveRadius: Math.max(
      0.5,
      outerRadius - (box.wall - box.coverGrooveDepth),
    ),
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
 * Отображение развёртки на цилиндр радиуса R: точка (x, y, z) встаёт на радиус
 * R + z под углом x / R.
 *
 * Так строится панель круглого плафона: ширина панели на поверхности равна дуге
 * сектора — кадр не сжимается к краям, — а прогиб повторяет зависимость
 * z = R − √(R² − x²) с точностью до второго порядка: R(1 − cos(x / R)) =
 * x² / (2R).
 *
 * Ось стоит на тыле панели (Z = −R): рельеф остаётся на выпуклой стороне, а
 * вогнутая смотрит на свет. Для плафона это и есть абажур — лампа входит внутрь,
 * кадр светится снаружи.
 *
 * Функция зовётся на каждой вершине в момент её рождения, а не после сборки
 * детали: сетка сразу считается в цилиндрических координатах, поэтому грани
 * остаются правильными, а нормали, посчитанные по общим вершинам, — гладкими.
 * Изгиб готовой сетки давал рябь: у каждой фасетки 0.5 мм была своя нормаль, и
 * на цилиндре они читались муаром.
 *
 * Толщина переносится без искажений: слои идут по радиусу, поэтому лицо, тыл и
 * боковины панели получают одно и то же смещение.
 */
function cylinderPoint(
  x: number,
  y: number,
  z: number,
  radius: number,
): Point3 {
  const angle = x / radius;
  const radial = radius + z;

  return [radial * Math.sin(angle), y, -radius + radial * Math.cos(angle)];
}

/**
 * Куда ставить вершину развёртки: на плоскость или на цилиндр.
 *
 * Одна функция на рельеф и рамку, чтобы обе детали считались одним кодом: у
 * плоской панели вершина остаётся как есть, у панели плафона уходит на цилиндр.
 * `null` — изгиба нет.
 */
type VertexWrap = (x: number, y: number, z: number) => Point3;

function vertexWrap(radius: number | null): VertexWrap {
  return radius === null
    ? (x, y, z) => [x, y, z]
    : (x, y, z) => cylinderPoint(x, y, z, radius);
}

/**
 * Направление на цилиндре: куда смотрит плоский вектор после отображения.
 *
 * Нужно для проверки обхода граней. У панели плафона кромка встаёт под углом к
 * оси, и плоская нормаль (dy, −dx, 0) уже не даёт надёжного знака: косинус угла
 * близок к нулю, и `addOrientedQuad` мог развернуть грань наугад. Здесь
 * направление поворачивается вместе с сечением, поэтому знак верен на любом
 * угле.
 */
function wrapDirection(
  direction: Point3,
  x: number,
  z: number,
  radius: number,
): Point3 {
  const angle = x / radius;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scale = (radius + z) / radius;

  return [
    direction[0] * scale * cos + direction[2] * sin,
    direction[1],
    direction[2] * cos - direction[0] * scale * sin,
  ];
}

/**
 * Тыл плиты: веер от центра к контуру, разрезанный вдоль лучей.
 *
 * В развёртке тыл — плоскость, а на цилиндре — поверхность. Веер от одного центра
 * к контуру на цилиндре дал бы хорды через всю ширину: луч веера идёт от центра
 * до кромки, и его середина проваливается внутрь радиуса на R(1 − cos(θ/2)) — на
 * панели плафона Ø120 это 5 мм, то есть тыл превратился бы в конус внутри
 * световой камеры. Поэтому каждый луч делится на отрезки не длиннее `step`, и
 * каждая точка рождается уже на цилиндре (`wrap`). Отрезок 4 мм даёт ошибку формы
 * step² / (8R) = 0.1 мм на самом тесном плафоне — вчетверо меньше сопла.
 *
 * Два луча одного треугольника делятся по своей длине, поэтому числа отрезков у
 * них разные. Сшиваются они «змейкой»: треугольники идут по тому лучу, чей
 * очередной шаг короче. Все вершины лежат на общих лучах соседних треугольников
 * и считаются от центра, поэтому кэш сводит их в одни и те же точки — оболочка
 * остаётся замкнутой, а контур лица не режется вовсе (иначе кромка веера и
 * боковина разошлись бы на доли микрона).
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
  wrap: VertexWrap,
  step: number,
  radius: number | null,
): number[] {
  const cache = new Map<string, number>();
  const vertexAt = (x: number, y: number): number => {
    const key = `${x.toFixed(5)}:${y.toFixed(5)}`;
    const known = cache.get(key);

    if (known !== undefined) {
      return known;
    }

    const index = vertexIndex(positions);

    positions.push(...wrap(x, y, 0));
    // uv тыла продолжают uv лица: они считаются в тех же координатах развёртки.
    uvs.push(
      (x + plateWidth / 2) / plateWidth,
      (plateHeight - y) / plateHeight,
    );
    cache.set(key, index);

    return index;
  };
  // Нормаль тыла смотрит от пластика: на цилиндре это внутрь, к оси.
  const backNormal = (x: number): Point3 =>
    radius === null ? [0, 0, -1] : wrapDirection([0, 0, -1], x, 0, radius);
  const centerX = 0;
  const centerY = plateHeight / 2;
  const center = vertexAt(centerX, centerY);
  // Точка на луче от центра к кромке: доля t идёт от 0 до 1.
  const rayAt = (x: number, y: number, t: number): number =>
    t >= 1
      ? vertexAt(x, y)
      : vertexAt(
          centerX + (x - centerX) * t,
          centerY + (y - centerY) * t,
        );
  const backBoundary: number[] = [];

  for (let edge = 0; edge < boundary.length; edge += 1) {
    const next = (edge + 1) % boundary.length;
    const ax = nodes[boundary[edge] * 3];
    const ay = nodes[boundary[edge] * 3 + 1];
    const bx = nodes[boundary[next] * 3];
    const by = nodes[boundary[next] * 3 + 1];
    const a = vertexAt(ax, ay);
    const b = vertexAt(bx, by);

    backBoundary.push(a);

    if (step <= 0) {
      addOrientedTriangle(
        indices,
        positions,
        center,
        a,
        b,
        backNormal((ax + bx) / 2),
      );
      continue;
    }

    // Число отрезков — по длине луча: соседний треугольник делит тот же луч так
    // же, потому что считает от центра и от своей кромки.
    const segmentsA = Math.max(
      1,
      Math.ceil(Math.hypot(ax - centerX, ay - centerY) / step),
    );
    const segmentsB = Math.max(
      1,
      Math.ceil(Math.hypot(bx - centerX, by - centerY) / step),
    );
    // Первая полоса — треугольник у самого центра: там оба луча сходятся в одну
    // точку, и «змейка» выдала бы вырожденные грани.
    const firstA = rayAt(ax, ay, 1 / segmentsA);
    const firstB = rayAt(bx, by, 1 / segmentsB);

    addOrientedTriangle(
      indices,
      positions,
      center,
      firstA,
      firstB,
      backNormal((ax + bx) / 2),
    );

    let alongA = 1;
    let alongB = 1;

    while (alongA < segmentsA || alongB < segmentsB) {
      const normal = backNormal(
        centerX +
          ((ax - centerX) * alongA) / segmentsA / 2 +
          ((bx - centerX) * alongB) / segmentsB / 2,
      );

      if (alongA === segmentsA) {
        // Луч A кончился: дальше веер идёт только по лучу B.
        addOrientedTriangle(
          indices,
          positions,
          a,
          rayAt(bx, by, alongB / segmentsB),
          rayAt(bx, by, (alongB + 1) / segmentsB),
          normal,
        );
        alongB += 1;
      } else if (alongB === segmentsB) {
        addOrientedTriangle(
          indices,
          positions,
          rayAt(ax, ay, alongA / segmentsA),
          rayAt(ax, ay, (alongA + 1) / segmentsA),
          b,
          normal,
        );
        alongA += 1;
      } else if (
        (alongA + 1) / segmentsA <=
        (alongB + 1) / segmentsB
      ) {
        addOrientedTriangle(
          indices,
          positions,
          rayAt(ax, ay, alongA / segmentsA),
          rayAt(ax, ay, (alongA + 1) / segmentsA),
          rayAt(bx, by, alongB / segmentsB),
          normal,
        );
        alongA += 1;
      } else {
        addOrientedTriangle(
          indices,
          positions,
          rayAt(ax, ay, alongA / segmentsA),
          rayAt(bx, by, (alongB + 1) / segmentsB),
          rayAt(bx, by, alongB / segmentsB),
          normal,
        );
        alongB += 1;
      }
    }
  }

  return backBoundary;
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
 * `grid` — сетка яркости именно этой плиты: у калейдоскопа их четыре, у плафона
 * до четырёх — на каждой панели может быть своё фото (см.
 * `lithophaneFaceBrightness`).
 *
 * `radius` — радиус цилиндра, на который рождаются вершины. У плоской панели и
 * грани призмы изгиба нет (`null`), у панели плафона вершины считаются сразу на
 * цилиндре (см. `cylinderPoint`). Отображение применяется к каждой вершине в
 * момент её рождения: лицо, тыл и боковины считаются по одной формуле, поэтому
 * оболочка остаётся замкнутой, а сетка — без деформации. Нормали считает
 * `computeVertexNormals` по общим вершинам сетки лица: фасетки 0.5 мм не дают
 * ряби на цилиндре.
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
  grid: LithophaneBrightnessGrid,
  radius: number | null,
  /**
   * Шип кромки, мм: высота, толщина и признак `top`. У панели плафона низ входит
   * в кольцевой паз основания, а верх — в такой же паз крышки-козырька, а паз
   * уже бортика, поэтому крайние миллиметры стесаны с лица. У плоской панели
   * шипа нет.
   */
  tenon: { height: number; thickness: number; top?: boolean } | null = null,
): BufferGeometry {
  const minThickness = normalized.lithophaneMinThickness;
  const maxThickness = normalized.lithophaneMaxThickness;
  const brightness = grid.brightness;
  const brightnessWidth = grid.width;
  const brightnessHeight = grid.height;
  // Шаг и число копий — по форме панели: калейдоскоп печатает четыре плиты,
  // плафон — столько, сколько загружено фото, и все они делят один бюджет
  // треугольников (см. `lithophaneMeshOptions`).
  const mesh = lithophaneMeshSize(
    plateWidth,
    plateHeight,
    lithophaneMeshOptions(normalized.lithoShape, lithophanePanelCount(normalized)),
  );

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
  // координаты тыла и боковин, поэтому скругление углов делается здесь, до
  // отображения на цилиндр, и оболочка остаётся замкнутой.
  const nodes: number[] = [];
  const wrap = vertexWrap(radius);

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

      // Шипы кромок: у плафона плита продолжается в паз основания снизу и в паз
      // крышки-козырька сверху, а паз шириной 2.5 мм уже бортика. Крайние
      // миллиметры стесаны с лица — деталь входит в канавку от руки, а над пазом
      // видна уже полная кромка.
      if (
        tenon !== null &&
        (fromBottom <= tenon.height ||
          (tenon.top === true && fromTop <= tenon.height))
      ) {
        thickness = Math.min(thickness, tenon.thickness);
      }

      nodes.push(x, y, thickness);
      // uv идут по плите, а не по кадру: карта свечения строится под пропорции
      // плиты (кадр по центру, поля белые), поэтому кадр и подсветка совпадают.
      uvs.push(u, v);
    }
  }

  // Углы плите скругляются до отображения на цилиндр и до построения тыла с
  // боковинами: они копируют уже сдвинутые координаты развёртки, поэтому обе
  // оболочки остаются замкнутыми.
  roundPlateCorners(nodes, halfWidth, plateHeight / 2, cornerRadius);

  // Лицо: вершины рождаются сразу в своих координатах — на плоскости или на
  // цилиндре радиуса R + толщина. Толщина идёт по радиусу, поэтому слои не
  // пересекаются, а сетка не деформируется.
  for (let node = 0; node < nodes.length; node += 3) {
    positions.push(...wrap(nodes[node], nodes[node + 1], nodes[node + 2]));
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
  // Тыл: веер от центра к контуру, разрезанный по углу так, чтобы каждая полоса
  // рождалась уже на цилиндре (см. `addBackFan`). У плоской панели разрез не
  // нужен, и тыл остаётся одним веером.
  const backBoundary = addBackFan(
    positions,
    indices,
    uvs,
    nodes,
    boundary,
    plateWidth,
    plateHeight,
    vertexWrap(radius),
    radius === null ? 0 : LITHOPHANE_BEND_STRIP_MM,
    radius,
  );

  for (let edge = 0; edge < boundary.length; edge += 1) {
    const next = (edge + 1) % boundary.length;
    const topA = boundary[edge];
    const topB = boundary[next];
    const bottomA = backBoundary[edge];
    const bottomB = backBoundary[next];
    // Наружное направление ребра берётся по развёртке и поворачивается вместе с
    // сечением: у панели плафона кромка стоит под углом к оси, и плоская нормаль
    // там уже не даёт надёжного знака (см. `wrapDirection`).
    const dx = nodes[topB * 3] - nodes[topA * 3];
    const dy = nodes[topB * 3 + 1] - nodes[topA * 3 + 1];

    addOrientedQuad(
      indices,
      positions,
      topA,
      topB,
      bottomB,
      bottomA,
      radius === null
        ? [dy, -dx, 0]
        : wrapDirection(
            [dy, -dx, 0],
            nodes[topA * 3],
            nodes[topA * 3 + 2],
            radius,
          ),
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
 *
 * У круглого плафона плита — это одна изогнутая панель: её ширина равна дуге
 * сектора, а не диаметру плафона. У калейдоскопа плита — грань призмы.
 */
export function lithophanePlateSize(params: Partial<LithophaneParams>): {
  width: number;
  height: number;
} {
  const normalized = normalizeLithophaneParams(params);

  // У плафона и призмы съёмной рамки нет: панель — это плита целиком. Бюджет
  // сетки считается по тому же габариту, поэтому проверка API и сборка не
  // расходятся.
  if (normalized.lithoShape === "round") {
    const round = roundMetrics(normalized);

    return { width: round.panelWidth, height: round.height };
  }

  if (!normalized.lithoFrame || normalized.lithoShape === "kaleidoscope") {
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

  // Плита плоская: плафон и призма собираются своими функциями, а изгиба у этой
  // детали нет — радиус `null` оставляет вершины в плоскости.
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
    null,
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
 * Пояс стенки короба: окно контура и его радиус, мм.
 *
 * Пояса идут от передней плоскости к тылу, и у каждого своё окно: полка под
 * панель уже просвета стенок, паз под крышку — шире. Материал между окнами
 * соседних поясов и есть уступ.
 */
type LedBoxBand = {
  innerWidth: number;
  innerHeight: number;
  innerRadius: number;
};

/**
 * Стенки с уступами: замкнутая оболочка переменного окна.
 *
 * Обычное кольцо (`createRingBody`) держит одно окно на всю высоту, а короб под
 * LED-панель — это как раз ступени: полка, карман, паз. Поэтому оболочка
 * строится не из отдельных колец, а одной трубой: наружная стенка идёт одной
 * полосой на всю глубину, внутренняя делится по поясам, а на стыках поясов
 * ставится плоское кольцо-уступ. Оболочек с совпадающими плоскостями не
 * остаётся, и объединённая сетка остаётся замкнутой без внутренних граней.
 *
 * `z` задаёт плоскости от передней к тыльной (по убыванию), `bands[i]` — окно
 * между `z[i]` и `z[i + 1]`. У всех контуров одинаковое число точек
 * (`roundedRectOutline`), поэтому уступ — это квады между парами `before[i]` и
 * `after[i]`, без поиска соответствий.
 */
function createSteppedTubeBody(options: {
  centerX: number;
  centerY: number;
  outerWidth: number;
  outerHeight: number;
  outerRadius: number;
  z: readonly number[];
  bands: readonly LedBoxBand[];
}): BufferGeometry {
  const { centerX, centerY, z, bands } = options;
  const outer = roundedRectOutline(
    options.outerWidth / 2,
    options.outerHeight / 2,
    options.outerRadius,
  );
  const inners = bands.map((band) =>
    roundedRectOutline(
      band.innerWidth / 2,
      band.innerHeight / 2,
      band.innerRadius,
    ),
  );
  const count = outer.length;
  const positions: number[] = [];
  const indices: number[] = [];
  const at = (point: Point2, plane: number): Point3 => [
    centerX + point[0],
    centerY + point[1],
    plane,
  ];
  const front = z[0];
  const back = z[z.length - 1];

  // Наружная стенка: снаружи короб — ровная призма, поэтому одна полоса на всю
  // глубину. Нормаль ребра контура против часовой стрелки равна (dy, −dx, 0).
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const dx = outer[next][0] - outer[index][0];
    const dy = outer[next][1] - outer[index][1];

    addQuadFace(
      indices,
      positions,
      [
        at(outer[index], back),
        at(outer[next], back),
        at(outer[next], front),
        at(outer[index], front),
      ],
      [dy, -dx, 0],
    );
  }

  // Внутренние стенки: у каждого пояса своё окно, и нормаль смотрит в просвет.
  for (let bandIndex = 0; bandIndex < inners.length; bandIndex += 1) {
    const inner = inners[bandIndex];
    const z0 = z[bandIndex + 1];
    const z1 = z[bandIndex];

    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;
      const dx = inner[next][0] - inner[index][0];
      const dy = inner[next][1] - inner[index][1];

      addQuadFace(
        indices,
        positions,
        [
          at(inner[index], z0),
          at(inner[next], z0),
          at(inner[next], z1),
          at(inner[index], z1),
        ],
        [-dy, dx, 0],
      );
    }
  }

  /*
    Уступы на стыках поясов. Кольцо между двумя окнами смотрит в сторону
    большего из них: если к тылу окно расширяется (полка под панель), уступ
    виден с тыла, а если сужается (паз под крышку) — с переда.
  */
  for (let bandIndex = 1; bandIndex < inners.length; bandIndex += 1) {
    const before = inners[bandIndex - 1];
    const after = inners[bandIndex];
    const zStep = z[bandIndex];
    const wider =
      bands[bandIndex].innerWidth > bands[bandIndex - 1].innerWidth ||
      bands[bandIndex].innerHeight > bands[bandIndex - 1].innerHeight;
    const normal: Point3 = [0, 0, wider ? -1 : 1];

    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;

      addQuadFace(
        indices,
        positions,
        [
          at(before[index], zStep),
          at(before[next], zStep),
          at(after[next], zStep),
          at(after[index], zStep),
        ],
        normal,
      );
    }
  }

  // Торцы: передний уходит в тыл рамки, тыльный закрывает крышка.
  for (const [plane, outline, normal] of [
    [front, inners[0], [0, 0, 1]],
    [back, inners[inners.length - 1], [0, 0, -1]],
  ] as const) {
    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;

      addQuadFace(
        indices,
        positions,
        [
          at(outline[index], plane),
          at(outline[next], plane),
          at(outer[next], plane),
          at(outer[index], plane),
        ],
        normal,
      );
    }
  }

  return finalizeGeometry(positions, indices);
}

/**
 * Короб под LED-панель: стенки с полкой и пазом под заднюю крышку.
 *
 * Три пояса от рамки к тылу: полка под панель (её окно уже просвета на `ledge` —
 * панель упирается в неё лицом), карман под саму панель с проводом и паз под
 * воротник задней крышки. Печатается вместе с рамкой: передний торец заходит в
 * её тыльную полку на нахлёст `BODY_OVERLAP_MM`, поэтому деталь держится за
 * полку, а не за тонкий торец.
 */
function createLithophaneLedBoxBodies(
  metrics: LithophaneLedBoxMetrics,
): BufferGeometry[] {
  const box = LITHOPHANE_LED_BOX;

  return [
    createSteppedTubeBody({
      centerX: 0,
      centerY: metrics.centerY,
      outerWidth: metrics.outerWidth,
      outerHeight: metrics.outerHeight,
      outerRadius: metrics.outerRadius,
      z: [
        metrics.frontZ,
        metrics.ledgeBackZ,
        metrics.grooveFrontZ,
        metrics.backZ,
      ],
      bands: [
        {
          innerWidth: metrics.panelWidth,
          innerHeight: metrics.panelHeight,
          innerRadius: Math.max(
            0.5,
            metrics.outerRadius - (box.wall + box.ledge),
          ),
        },
        {
          innerWidth: metrics.innerWidth,
          innerHeight: metrics.innerHeight,
          innerRadius: Math.max(0.5, metrics.outerRadius - box.wall),
        },
        {
          innerWidth: metrics.grooveWidth,
          innerHeight: metrics.grooveHeight,
          innerRadius: metrics.grooveRadius,
        },
      ],
    }),
  ];
}

/**
 * Точки дуги окружности в плоскости XY, мм.
 *
 * Обход задаётся начальным углом и разверткой в градусах: отрицательная
 * развертка идёт по часовой стрелке.
 */
function arcPoints(
  centerX: number,
  centerY: number,
  radius: number,
  fromDeg: number,
  sweepDeg: number,
  steps: number,
): Point2[] {
  const points: Point2[] = [];

  for (let step = 0; step <= steps; step += 1) {
    const angle = ((fromDeg + (sweepDeg * step) / steps) * Math.PI) / 180;

    points.push([
      centerX + radius * Math.cos(angle),
      centerY + radius * Math.sin(angle),
    ]);
  }

  return points;
}

/**
 * Пластина: плоский контур с отверстиями, выдавленный по Z от `z0` до `z1`.
 *
 * Торцы режутся триангуляцией контура (`ShapeUtils.triangulateShape`), боковые
 * стенки — по рёбрам контура и отверстий. Нормаль ребра контура против часовой
 * стрелки равна (dy, -dx, 0); отверстия обходятся по часовой стрелке, поэтому та
 * же формула даёт нормаль наружу материала — в сторону отверстия.
 */
function createPlateBody(
  outline: readonly Point2[],
  holes: readonly (readonly Point2[])[],
  z0: number,
  z1: number,
): BufferGeometry {
  const toVectors = (points: readonly Point2[]): Vector2[] =>
    points.map(([x, y]) => new Vector2(x, y));
  // Контур растягивается против часовой стрелки, отверстия — по часовой.
  const order = (points: Vector2[], clockwise: boolean): Point2[] => {
    const ordered = [...points];

    if (ShapeUtils.isClockWise(ordered) !== clockwise) {
      ordered.reverse();
    }

    return ordered.map((point): Point2 => [point.x, point.y]);
  };
  const contour = order(toVectors(outline), false);
  const loops = holes.map((hole) => order(toVectors(hole), true));
  const triangles = ShapeUtils.triangulateShape(
    toVectors(contour),
    loops.map((loop) => toVectors(loop)),
  );
  const positions: number[] = [];
  const indices: number[] = [];
  const capPoints = [...contour, ...loops.flat()];

  // Торцы: задний смотрит в −Z, передний в +Z.
  for (const [z, normal] of [
    [z0, [0, 0, -1]],
    [z1, [0, 0, 1]],
  ] as const) {
    const base = vertexIndex(positions);

    for (const [x, y] of capPoints) {
      positions.push(x, y, z);
    }

    for (const [a, b, c] of triangles) {
      addOrientedTriangle(
        indices,
        positions,
        base + a,
        base + b,
        base + c,
        normal,
      );
    }
  }

  for (const loop of [contour, ...loops]) {
    for (let index = 0; index < loop.length; index += 1) {
      const [ax, ay] = loop[index];
      const [bx, by] = loop[(index + 1) % loop.length];

      addQuadFace(
        indices,
        positions,
        [
          [ax, ay, z0],
          [bx, by, z0],
          [bx, by, z1],
          [ax, ay, z1],
        ],
        [by - ay, ax - bx, 0],
      );
    }
  }

  return finalizeGeometry(positions, indices);
}

/**
 * Задняя крышка короба под LED-панель: пластина с воротником и окном под провод.
 *
 * Крышка закрывает тыл короба и держит панель: воротник `coverFlange` входит в
 * паз на тылу короба, а пластина ложится на его заднюю плоскость. Зазор
 * `coverClearance` оставлен и по бокам, и до переднего уступа паза — деталь
 * вставляется от руки, держится трением и снимается одним движением. Окно под
 * провод поднято над нижней кромкой на `wireLift`, поэтому провод выходит
 * горизонтально и не подворачивается под короб.
 *
 * Пластина строится `createPlateBody` по контуру короба: окно под провод — это
 * отверстие в контуре, а не вырез с края, иначе провод пришлось бы продевать.
 * В сборке крышка стоит на 0.2 мм впереди своего места — нахлёст
 * `BODY_OVERLAP_MM`, как у остальных деталей: иначе её пластина легла бы на
 * заднюю плоскость короба ровно и в объединённой сетке остались бы две
 * совпадающие грани.
 */
export function createLithophaneLedBoxCoverGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const led = lithophaneLedBoxMetrics(normalized);
  const box = LITHOPHANE_LED_BOX;
  const frontZ = led.backZ + BODY_OVERLAP_MM;
  const backZ = frontZ - box.coverThickness;
  // Окно под провод: квадрат по центру нижней кромки крышки.
  const wireHalf = box.wireWidth / 2;
  const wireBottom = box.inset + box.wireLift;
  const wireTop = wireBottom + box.wireHeight;
  const wireHole: Point2[] = [
    [-wireHalf, wireBottom],
    [wireHalf, wireBottom],
    [wireHalf, wireTop],
    [-wireHalf, wireTop],
  ];
  // Пластина: контур короба, сдвинутый на его центр по Y, с окном под провод.
  const plate = createPlateBody(
    roundedRectOutline(
      led.outerWidth / 2,
      led.outerHeight / 2,
      led.outerRadius,
    ).map(([x, y]): Point2 => [x, y + led.centerY]),
    [wireHole],
    backZ,
    frontZ,
  );
  const flangeWidth = led.grooveWidth - 2 * box.coverClearance;
  const flangeHeight = led.grooveHeight - 2 * box.coverClearance;
  const flangeRadius = Math.max(0.5, led.grooveRadius - box.coverClearance);
  const flange = createRingBody({
    centerX: 0,
    centerY: led.centerY,
    outerWidth: flangeWidth,
    outerHeight: flangeHeight,
    innerWidth: flangeWidth - 2 * box.coverFlange,
    innerHeight: flangeHeight - 2 * box.coverFlange,
    outerRadius: flangeRadius,
    innerRadius: Math.max(0.5, flangeRadius - box.coverFlange),
    // Воротник уходит в паз от пластины до его переднего уступа, не доставая до
    // него на зазор: иначе крышка не села бы до конца.
    z0: led.grooveFrontZ - box.coverClearance,
    z1: frontZ,
  });

  return mergeBodies([plate, flange], "крышки");
}

/**
 * Тело переменного сечения: несколько контуров с одинаковым числом точек.
 *
 * Конус каретки на каждом Z имеет свой радиус, поэтому плоской пластиной
 * (`createPlateBody`) его не построить. Секции идут от первой к последней, торцы
 * зашиваются триангуляцией крайнего контура, а между соседними секциями ставятся
 * четырёхугольники по рёбрам. Как и в `createPlateBody`, контуры приводятся к
 * обходу против часовой стрелки, и внешняя нормаль ребра равна (dy, −dx, 0).
 * Число точек у всех секций обязано совпадать — тогда вершины совмещаются по
 * индексу, а не по геометрии.
 */
function createLoftBody(
  sections: readonly { z: number; outline: readonly Point2[] }[],
): BufferGeometry {
  const toVectors = (points: readonly Point2[]): Vector2[] =>
    points.map(([x, y]) => new Vector2(x, y));
  // Направление обхода задаёт первая секция: остальные повторяют её форму.
  const reverse = ShapeUtils.isClockWise(toVectors(sections[0].outline));
  const contours = sections.map(({ outline }) => {
    const points = toVectors(outline);
    const ordered = reverse ? [...points].reverse() : points;

    return ordered.map((point): Point2 => [point.x, point.y]);
  });
  const count = contours[0].length;
  const positions: number[] = [];
  const indices: number[] = [];

  // Торцы: задний смотрит в −Z, передний в +Z. Каждый торец триангулируется по
  // своему контуру: у навеса сечение сужается к носу, и общая триангуляция
  // хвоста не годится для носа.
  for (const [index, normal] of [
    [0, [0, 0, -1]],
    [sections.length - 1, [0, 0, 1]],
  ] as const) {
    const contour = contours[index];
    const triangles = ShapeUtils.triangulateShape(toVectors(contour), []);
    const base = vertexIndex(positions);

    for (const [x, y] of contour) {
      positions.push(x, y, sections[index].z);
    }

    for (const [a, b, c] of triangles) {
      addOrientedTriangle(
        indices,
        positions,
        base + a,
        base + b,
        base + c,
        normal,
      );
    }
  }

  for (let index = 0; index < sections.length - 1; index += 1) {
    const near = contours[index];
    const far = contours[index + 1];
    const z0 = sections[index].z;
    const z1 = sections[index + 1].z;

    for (let point = 0; point < count; point += 1) {
      const next = (point + 1) % count;
      const [ax, ay] = near[point];
      const [bx, by] = near[next];

      addQuadFace(
        indices,
        positions,
        [
          [ax, ay, z0],
          [bx, by, z0],
          [far[next][0], far[next][1], z1],
          [far[point][0], far[point][1], z1],
        ],
        [by - ay, ax - bx, 0],
      );
    }
  }

  return finalizeGeometry(positions, indices);
}

/** Габариты монорельса: шина, шейка и карман Т-образного паза, мм. */
export type RailMetrics = {
  /** Ширина шины, мм. */
  width: number;
  /** Половина ширины, мм. */
  half: number;
  /** Выступ шины назад от тыла рамки, мм. */
  depth: number;
  /** Верх шины, мм. */
  top: number;
  /** Ширина шейки паза: в неё проходит ножка каретки, мм. */
  slotWidth: number;
  /** Высота шейки от верха шины вниз, мм. */
  slotDepth: number;
  /** Ширина кармана под салазки на дне паза, мм. */
  cavityWidth: number;
  /** Дно кармана над столом, мм: на нём стоят салазки. */
  cavityFloor: number;
  /** Потолок кармана — низ фланок, которые держат салазки, мм. */
  cavityCeiling: number;
  /** Зазор между пазом и салазками на сторону, мм. */
  clearance: number;
};

/**
 * Габариты монорельса.
 *
 * Экспортируется для теста геометрии: по этим числам проверяются шина, шейка и
 * карман, которые иначе пришлось бы выковыривать из готовой сетки. От параметров
 * панели шина не зависит — рельс одинаков у любой ширины.
 *
 * Дно кармана выводится из фланок под 45°: вылет кармана за шейку равен его
 * высоте, поэтому `cavityFloor = top − slotDepth − (cavityWidth − slotWidth) / 2`.
 */
export function lithophaneRailMetrics(): RailMetrics {
  const rail = LITHOPHANE_RAIL;
  const cavityCeiling = rail.thickness - rail.slotDepth;
  const flank = (rail.cavityWidth - rail.slotWidth) / 2;

  return {
    width: rail.width,
    half: rail.width / 2,
    depth: rail.depth,
    top: rail.thickness,
    slotWidth: rail.slotWidth,
    slotDepth: rail.slotDepth,
    cavityWidth: rail.cavityWidth,
    cavityFloor: cavityCeiling - flank,
    cavityCeiling,
    clearance: rail.clearance,
  };
}

/**
 * Полоз на нижней кромке тыла плоской рамки: шина 14 × 5 мм с Т-образным пазом.
 *
 * Шина лежит на столе (Y = 0) и нахлёстом `frameOverlap` входит в тыл нижней
 * полки рамки, поэтому полоз и рамка печатаются одним телом. Паз открыт сверху и
 * с торцов, а его сечение — шейка 6 мм над карманом 10 мм с фланками под 45°.
 *
 * Профиль режется одним замкнутым контуром (`createPlateBody`) и выдавливается по
 * Z: так паз получается призматическим, а оболочка остаётся замкнутой без
 * склейки брусков. Фланки под 45° печатаются нависанием, которое станок держит
 * сам, — поддержек под карманом не нужно.
 */
function createRailBodies(): BufferGeometry[] {
  const {
    half,
    depth,
    top,
    slotWidth,
    cavityWidth,
    cavityFloor,
    cavityCeiling,
  } = lithophaneRailMetrics();
  const neckHalf = slotWidth / 2;
  const cavityHalf = cavityWidth / 2;
  const front = LITHOPHANE_RAIL.frameOverlap;
  // Контур шины: низ на столе, сверху — шейка с карманом под салазки.
  const outline: Point2[] = [
    [-half, 0],
    [half, 0],
    [half, top],
    [neckHalf, top],
    [neckHalf, cavityCeiling],
    [cavityHalf, cavityFloor],
    [-cavityHalf, cavityFloor],
    [-neckHalf, cavityCeiling],
    [-neckHalf, top],
    [-half, top],
  ];

  return [createPlateBody(outline, [], -depth, front)];
}

/** Габариты держателя патрона: кольцо, карманы патрона, ножка и козырёк, мм. */
export type CarriageMetrics = {
  /** Ось кольца и патрона над столом, мм. */
  socketY: number;
  /** Наружный радиус кольца, мм. */
  ringRadius: number;
  /** Верх и низ кольца над столом, мм. */
  ringTop: number;
  ringBottom: number;
  /** Радиус сквозного отверстия под резьбу патрона, мм. */
  boreRadius: number;
  /** Толщина кольца вдоль оси патрона, мм. */
  ringDepth: number;
  /** Лицевая (к панели) и задняя плоскости кольца по Z, мм. */
  plateFront: number;
  plateBack: number;
  /** Круглая зенковка под фланец патрона с лица: радиус и глубина, мм. */
  flangeRadius: number;
  flangeDepth: number;
  /** Шестигранное гнездо под гайку: под ключ, по вершинам и глубиной, мм. */
  nutFlats: number;
  nutRadius: number;
  nutDepth: number;
  /**
   * Ножка и салазки: ширина ножки в шейке, ширина салазок на дне кармана, верх
   * ножки над столом, лицо и тыл по Z, низ и верх салазок, мм.
   */
  stemWidth: number;
  sledWidth: number;
  stemDepth: number;
  stemTop: number;
  stemFront: number;
  stemBack: number;
  sledBottom: number;
  sledTop: number;
  /** Нижний предел оси патрона: кольцо не ложится на шину, мм. */
  minAxisY: number;
  /** Низ навеса у лица, его нос, провис, ширина и толщина, мм. */
  visorBottom: number;
  visorFront: number;
  visorDrop: number;
  visorWidth: number;
  visorThickness: number;
  /** Резьба патрона: диаметр сквозного отверстия, мм. */
  thread: number;
  /** Гайка патрона: размер под ключ, мм. */
  nut: number;
};

/**
 * Габариты держателя патрона по нормализованным параметрам.
 *
 * Экспортируется для теста геометрии: кольцо, карманы патрона, ножка с салазками
 * и козырёк считаются здесь, а сетка только повторяет эти числа. Нос навеса
 * обрезан зазором `panelClearance`, поэтому козырёк никогда не доходит до рельефа.
 *
 * Диаметр кольца берётся из патрона (`ring` в `LITHOPHANE_RAIL_SOCKET_SIZES`) —
 * Ø32 у E14 и Ø42 у E27, — поэтому вместе с ним меняются верх и низ кольца, ширина
 * козырька и предел оси. Козырёк равен кольцу по ширине: он закрывает патрон ровно
 * на всю его макушку.
 *
 * Высота оси — половина высоты панели: кольцо встаёт напротив центра кадра, и у
 * высокой панели лампа не светит вниз. Ниже `minAxisY` ось опустить нельзя —
 * кольцо легло бы на шину, — поэтому у низкой панели ось стоит на пределе, а не
 * на середине: `minAxisY = ringRadius + railGap + top`.
 *
 * Салазки опускаются на дно кармана полоза и кончаются там, где кончается полоз:
 * на дальнем положении (`lithoRailDistance` 90 мм) от шины остаётся 10 мм, и
 * ножка укорачивается до них — иначе салазки свисали бы с торца полоза.
 *
 * Верх ножки упирается в гнездо гайки: `stemTop` не выше нижней грани
 * шестигранника (`socketY − nutFlats / 2`), иначе ножка перекрыла бы гайку в тылу
 * кольца. Поэтому нахлёст в мясо кольца — `stemOverlap` или чуть меньше: у E14 это
 * 4.6 мм, у E27 — 4.1 мм, и оба кармана патрона остаются свободными.
 */
export function lithophaneCarriageMetrics(
  normalized: LithophaneParams,
): CarriageMetrics {
  const carriage = LITHOPHANE_CARRIAGE;
  const rail = LITHOPHANE_RAIL;
  const railMetrics = lithophaneRailMetrics();
  const socket = LITHOPHANE_RAIL_SOCKET_SIZES[normalized.lithoRailSocket];
  // Лицевая плоскость кольца смотрит на панель, ось патрона проходит по ней.
  const plateFront = -normalized.lithoRailDistance;
  const ringRadius = socket.ring / 2;
  // Предел оси: кольцо висит над шиной на `railGap`, салазки — в кармане.
  const minAxisY = ringRadius + carriage.railGap + railMetrics.top;
  // Половина высоты панели — до предела, ниже которого кольцо легло бы на шину.
  const socketY = Math.max(normalized.lithophaneHeight / 2, minAxisY);
  const ringBottom = socketY - ringRadius;
  const nutFlats = socket.nut + 2 * carriage.nutClearance;
  const nutRadius = nutFlats / Math.sqrt(3);
  // Нос навеса не доходит до рельефа на `panelClearance`: у панели он короче.
  const visorFront = Math.min(
    plateFront + carriage.visorRun,
    -carriage.panelClearance,
  );
  // Ножка стоит за лицом кольца и не свисает за торец полоза.
  const stemFront = plateFront - BODY_OVERLAP_MM;
  const stemBack = Math.max(stemFront - carriage.stemDepth, -rail.depth);
  /*
    Верх ножки: она входит в мясо кольца снизу, но не достаёт до гнезда гайки.
    Гнездо — шестигранник гранью вниз, поэтому его нижняя граница на
    `socketY − nutFlats / 2`; зенковка фланца того же радиуса. Ножка кончается ниже
    обоих карманов, иначе перекрыла бы гайку в тыльной части кольца.
  */
  const stemTop = Math.min(
    ringBottom + carriage.stemOverlap,
    socketY - nutFlats / 2 - BODY_OVERLAP_MM,
  );

  return {
    socketY,
    ringRadius,
    ringTop: socketY + ringRadius,
    ringBottom,
    boreRadius: socket.thread / 2,
    ringDepth: carriage.ringDepth,
    plateFront,
    plateBack: plateFront - carriage.ringDepth,
    // Зенковка — по фланцу патрона: он того же габарита, что и гайка.
    flangeRadius: (socket.nut + carriage.flangeClearance) / 2,
    flangeDepth: carriage.flangeDepth,
    nutFlats,
    nutRadius,
    nutDepth: carriage.nutDepth,
    // Ножка уже шейки, а салазки — кармана, на зазор с каждой стороны.
    stemWidth: rail.slotWidth - 2 * rail.clearance,
    sledWidth: rail.cavityWidth - 2 * rail.clearance,
    stemDepth: stemFront - stemBack,
    stemTop,
    stemFront,
    stemBack,
    // Салазки стоят на дне кармана, фланки кончаются на его потолке.
    sledBottom: railMetrics.cavityFloor,
    sledTop: railMetrics.cavityCeiling,
    minAxisY,
    // Низ навеса — внутренняя дуга хвоста: она врезана в кольцо на нахлёст.
    visorBottom: socketY + ringRadius - BODY_OVERLAP_MM,
    visorFront,
    visorDrop: carriage.visorDrop,
    visorWidth: socket.ring,
    visorThickness: carriage.visorThickness,
    thread: socket.thread,
    nut: socket.nut,
  };
}

/** Шаг секций навеса вдоль Z: по нему раскладывается провис носа, мм. */
const LITHOPHANE_VISOR_STEP_MM = 1.5;

/** Точек на дугу навеса: по ним гнётся козырёк и скругляется нос. */
const LITHOPHANE_VISOR_ARC_SEGMENTS = 12;

/** Круг в плоскости XY без замыкающей точки: контур кольца и его отверстий. */
function circlePoints(
  centerX: number,
  centerY: number,
  radius: number,
  steps: number,
): Point2[] {
  return arcPoints(centerX, centerY, radius, 0, 360, steps).slice(0, -1);
}

/**
 * Шестигранник под гайку: вершины через 60°, грань смотрит вверх.
 *
 * Наружный радиус по вершинам на 15.5 % больше размера под ключ, поэтому гнездо
 * под гайку E27 (33 мм) занимает 38.1 мм по вершинам и остаётся внутри кольца
 * Ø42: по углам гнезда остаётся 1.7 мм мяса.
 */
function nutPocketPoints(centerY: number, radius: number): Point2[] {
  return Array.from(
    { length: 6 },
    (_, index): Point2 => {
      const angle = (Math.PI / 3) * index;

      return [radius * Math.cos(angle), centerY + radius * Math.sin(angle)];
    },
  );
}




/**
 * Держатель патрона отдельной деталью: плоское кольцо Ø32 (E14) или Ø42 (E27)
 * толщиной 5 мм на ножке с салазками и козырьком.
 *
 * Кольцо лежит плоскостью XY: лицо смотрит на панель, ось патрона проходит через
 * центр на середине высоты панели. Отверстие равно резьбе патрона — патрон
 * вставляется с лица, его фланец тонет в зенковке, а штатная гайка садится в
 * шестигранное гнездо с тыла и зажимает кольцо. Ни корпуса, ни полости у детали
 * нет: это плоское кольцо, а не барабан.
 *
 * Кольцо стоит на ножке, низ которой расширен в салазки: они входят в Т-образный
 * паз полоза с торца, стоят на дне кармана и едут по нему вдоль Z, поэтому кольцо
 * держится на полозе, не опрокидывается вперёд и не соскакивает при сдвиге
 * слайдером. Сверху лежит гнутый козырёк — тонкая пластина, которая закрывает
 * патрон от глаз.
 */
export function createLithophaneCarriageGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const carriage = LITHOPHANE_CARRIAGE;
  const metrics = lithophaneCarriageMetrics(normalized);
  const {
    socketY,
    ringRadius,
    boreRadius,
    plateFront,
    plateBack,
    flangeRadius,
    flangeDepth,
    nutRadius,
    nutDepth,
    stemWidth,
    sledWidth,
    sledBottom,
    sledTop,
    stemTop,
    stemFront,
    stemBack,
  } = metrics;
  const ring = circlePoints(0, socketY, ringRadius, carriage.ringSegments);
  const bore = circlePoints(0, socketY, boreRadius, carriage.boreSegments);
  const flange = circlePoints(0, socketY, flangeRadius, carriage.boreSegments);
  const nutPocket = nutPocketPoints(socketY, nutRadius);
  const stemHalf = stemWidth / 2;
  const sledHalf = sledWidth / 2;

  const bodies: BufferGeometry[] = [
    /*
      Кольцо — три слоя по Z: гнездо гайки с тыла, сквозное отверстие под резьбу и
      зенковка под фланец с лица. Слои нахлёстнуты на `BODY_OVERLAP_MM` в мясо
      соседа, но не в его карман: глубина кармана остаётся ровной, а слайсер
      видит одно тело.
    */
    createPlateBody(
      ring,
      [nutPocket],
      plateBack,
      plateBack + nutDepth + BODY_OVERLAP_MM,
    ),
    createPlateBody(ring, [bore], plateBack + nutDepth, plateFront - flangeDepth),
    createPlateBody(
      ring,
      [flange],
      plateFront - flangeDepth - BODY_OVERLAP_MM,
      plateFront,
    ),
    /*
      Ножка с салазками — один призматический контур по всей толщине: снизу
      салазки шириной `sledWidth` стоят на дне кармана, фланки под 45° сходятся к
      шейке, а выше ножка идёт в `stemWidth` и входит в мясо кольца на
      `stemOverlap` — ниже отверстия патрона, поэтому резьба остаётся свободной.
      Фланки повторяют паз с зазором `clearance` по X, поэтому салазки входят в
      паз с торца шины, едут по нему вдоль Z и не дают кольцу наклониться.
    */
    createPlateBody(
      [
        [-sledHalf, sledBottom],
        [sledHalf, sledBottom],
        [stemHalf, sledTop],
        [stemHalf, stemTop],
        [-stemHalf, stemTop],
        [-stemHalf, sledTop],
      ],
      [],
      stemBack,
      stemFront,
    ),
    ...createCarriageVisorBodies(normalized),
  ];

  return smoothGeometryNormals(mergeBodies(bodies, "каретки"));
}

/**
 * Козырёк держателя: тонкая гнутая пластина над патроном.
 *
 * Навес лежит на макушке кольца: наружный радиус на `BODY_OVERLAP_MM` больше
 * кольца, внутренний — на `visorThickness` меньше. Внутренняя дуга врезается в
 * мясо кольца на этот нахлёст, поэтому козырёк и кольцо спекаются без совпадающих
 * плоскостей. Хвост уходит в кольцо на `visorTail`, дальше пластина идёт над
 * лампой и опускается к носу на `visorDrop`. Снизу и с боков патрон остаётся
 * открытым: навес только срезает свет сверху, а лампа вкручивается рукой.
 *
 * Провис начинается за серединой вылета: над резьбой патрона навес идёт ровно,
 * иначе его низ задел бы резьбу E27 (Ø28.6 мм). Нос скруглён в плане на
 * `visorRadius`, кромки срезаны фаской `visorChamfer`, а сам нос не доходит до
 * рельефа на `panelClearance` — это уже в `visorFront`.
 *
 * Навес строится лофтом по Z: на каждом шаге дуга сдвигается вниз на провис и
 * сужается у носа, поэтому изгиб получается гладким, без изломов и без окон.
 */
function createCarriageVisorBodies(
  normalized: LithophaneParams,
): BufferGeometry[] {
  const carriage = LITHOPHANE_CARRIAGE;
  const { socketY, plateFront, visorFront, ringRadius, visorWidth } =
    lithophaneCarriageMetrics(normalized);
  const outer = ringRadius + carriage.visorThickness - BODY_OVERLAP_MM;
  const inner = outer - carriage.visorThickness;
  // Ширина навеса равна кольцу: он закрывает патрон на всю макушку.
  const halfWidth = visorWidth / 2;
  // Провис: ровно над резьбой, плавно вниз за серединой вылета.
  const bendFrom = plateFront + (visorFront - plateFront) / 2;
  const bendRun = Math.max(0.001, visorFront - bendFrom);
  // Скругление носа в плане: последние `visorRadius` дуга сужается по четверти
  // окружности, поэтому сверху нос читается скруглённым.
  const noseFrom =
    visorFront - Math.min(carriage.visorRadius, carriage.visorRun / 2);
  const noseRun = Math.max(0.001, visorFront - noseFrom);
  // Фаска кромок: внутренняя дуга выходит за наружную на `visorChamfer`, и
  // торцы навеса срезаны наклонно.
  const chamferDeg = (carriage.visorChamfer / inner) * (180 / Math.PI);
  const back = plateFront - carriage.visorTail;
  const run = visorFront - back;
  const steps = Math.max(8, Math.round(run / LITHOPHANE_VISOR_STEP_MM));
  const sections: { z: number; outline: Point2[] }[] = [];

  for (let step = 0; step <= steps; step += 1) {
    const z = back + (run * step) / steps;
    const bend = Math.min(1, Math.max(0, (z - bendFrom) / bendRun));
    const centerY =
      socketY - carriage.visorDrop * bend * bend * (3 - 2 * bend);
    const nose = Math.min(1, Math.max(0, (z - noseFrom) / noseRun));
    const width =
      halfWidth - carriage.visorRadius * (1 - Math.sqrt(Math.max(0, 1 - nose * nose)));
    const angleDeg = (Math.asin(Math.min(1, width / outer)) * 180) / Math.PI;

    sections.push({
      z,
      outline: [
        // Наружная дуга: справа через верх налево.
        ...arcPoints(
          0,
          centerY,
          outer,
          90 - angleDeg,
          2 * angleDeg,
          LITHOPHANE_VISOR_ARC_SEGMENTS,
        ),
        // Внутренняя дуга возвращается налево-вправо с фаской на концах.
        ...arcPoints(
          0,
          centerY,
          inner,
          90 + angleDeg + chamferDeg,
          -2 * (angleDeg + chamferDeg),
          LITHOPHANE_VISOR_ARC_SEGMENTS,
        ),
      ],
    });
  }

  return [createLoftBody(sections)];
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
 * Геометрия осталась для сохранённых проектов: в интерфейсе креплений больше нет.
 *
 * Оба кольца — скруглённые: наружные углы идут дугой
 * `LITHOPHANE_FRAME_CORNER_RADIUS_MM`, окно накладки — дугой
 * `LITHOPHANE_FRAME_OPENING_RADIUS_MM`, окно полки — на накладку шире. Радиусы
 * ограничены четвертью своего прямоугольника, поэтому маленькая панель 40 мм
 * остаётся целой, а не превращается в овал.
 *
 * Рамка плоская: у плафона и калейдоскопа её нет, их панели собираются своим
 * кодом, поэтому вершины кольца остаются в плоскости XY.
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

  // Монорельс печатается вместе с рамкой: его полка лежит на тыле, поэтому
  // каретка едет по самой панели, а не по отдельной стойке.
  if (
    lithophaneHasRail(
      normalized.lithoMount,
      normalized.lithoShape,
      normalized.lithoFrame,
    )
  ) {
    bodies.push(...createRailBodies());
  }

  // Короб под LED-панель — тоже часть рамки: он наращивает её тыл и печатается с
  // ней одной деталью. Задняя крышка короба при этом отдельная деталь, иначе
  // короб нечем было бы закрыть.
  if (
    lithophaneHasLedBox(
      normalized.lithoMount,
      normalized.lithoShape,
      normalized.lithoFrame,
    )
  ) {
    bodies.push(...createLithophaneLedBoxBodies(lithophaneLedBoxMetrics(normalized)));
  }

  // Рамка собирается из двух колец и, при подвесе, короба, но печатается одной
  // деталью: сварка вершин и пересчёт нормалей делают её поверхность гладкой —
  // на предпросмотре она читается литой и матовой, а не набором плоскостей.
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
 * Группы материалов сборки: по одной на грань калейдоскопа, крепление — последняя.
 *
 * Предпросмотр рисует грани разными текстурами, поэтому одной общей карты
 * свечения мало: с ней на всех четырёх гранях светился первый кадр. Границы
 * групп режутся по числу индексов каждой панели, цоколь и крышка получают
 * последний номер материала.
 */
function assignFaceGroups(
  geometry: BufferGeometry,
  panels: readonly number[],
): BufferGeometry {
  const total = geometry.getIndex()?.count ?? 0;
  let start = 0;

  geometry.clearGroups();

  for (let face = 0; face < panels.length; face += 1) {
    geometry.addGroup(start, panels[face], face);
    start += panels[face];
  }

  if (total > start) {
    geometry.addGroup(start, total - start, panels.length);
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
 * Открытая подставка: база с пазом под рамку, наклонной стенкой под ленту и
 * пазом под рассеиватель.
 *
 * Сплошная стойка старой ножки во всю ширину закрывала нижние 30 мм панели:
 * на просвет там оставалось тёмное пятно, а светодиодную ленту поставить было
 * некуда. Здесь стойки нет — её заменяют две ножки по краям базы, между ними
 * панель открыта сзади и свет проходит к низу кадра.
 *
 * База 74 мм глубиной (от `back` −64 до `front` 10) несёт четыре выборки:
 *   - паз под рамку: глубина `seatDepth` 3.5 мм, стенки наклонены на 12°, то
 *     есть параллельны панели, а дно горизонтально. Рамка не упирается в глухую
 *     стену, а опускается в паз и держится в нём без клея;
 *   - канал под ленту: 10 мм по наклону и 3 мм глубиной, вырезан в наклонной
 *     задней стенке-клине. Скат клина наклонён на 50° к столу, его нормаль — на
 *     40° к вертикали вперёд, поэтому лента светит вверх и на панель, а не в
 *     потолок;
 *   - паз под рассеиватель: щель 2.4 × 6 мм в верхней плоскости базы между
 *     лентой и панелью. В неё от руки ставится лист белого матового акрила 2 мм
 *     (около 100 × 30 мм) — он и разбивает пятно от ленты;
 *   - `baseTop` 10 мм — высота площадки, по которой ходит рамка.
 *
 * Ножки 6 × 5 мм стоят по краям базы и наклонены вместе с панелью: их передние
 * плоскости повторяют плоскость тыла рамки, поэтому рамка опирается на них всей
 * плоскостью, а не ребром. Высота `legTop` 34 мм: опора разнесена по краям, и
 * панель не качается вокруг вертикальной оси.
 */
export const LITHOPHANE_ARCH_STAND = {
  /** Ширина базы: доля ширины панели и минимум в миллиметрах. */
  widthFactor: 0.92,
  minWidth: 76,
  /**
   * Тыльная и передняя кромки базы по Z, мм.
   *
   * 74 мм — это то, что помещается на столе без «объёмной» подставки: канал
   * ленты уходит на 59 мм за тыл панели, и расстояние от ленты до плоскости
   * панели выходит около 54 мм вместо прежних 8. Рекомендованные для панели
   * 120 × 80 88 мм на стол не встают — они и вынесены в подсказку панели.
   */
  back: -64,
  /**
   * Тыльная кромка базы без канала под ленту, мм.
   *
   * Под открытую лампу и «без подсветки» в базе нет выборок: за панелью стоят
   * только штанга и скобы держателя, поэтому база кончается за пазом рамки.
   * 30 мм вместо 64 — это пластик, который на полке некуда девать.
   */
  openBack: -30,
  front: 10,
  /** Высота площадки базы над столом, мм. */
  baseTop: 10,
  /** Глубина паза под рамку вдоль плоскости панели, мм. */
  seatDepth: 3.5,
  /**
   * Задняя стенка-клин: высота и наклон её ската к столу, градусы.
   *
   * Стенка поднимается над столом на `leanTop` и переходит в скат, наклонённый
   * к столу на `ledgeDeg`. Нормаль ската — 40° к вертикали вперёд: лента светит
   * на панель, а её собственный корпус закрывает свет с тыла. Скат идёт от
   * высоты 34 до `baseTop`, поэтому канал целиком лежит на нём.
   */
  leanTop: 34,
  ledgeDeg: 50,
  /**
   * Канал под светодиодную ленту: высота середины над столом, ширина по скату
   * и глубина по нормали к нему, мм.
   *
   * Середина на 24 мм: лента стоит выше нижней кромки панели на 14 мм, поэтому
   * её диаграмма бьёт и в низ кадра, и в верх. Глубина 3 мм — лента с платой
   * 1 мм утоплена в скат, её свет не бьёт в глаза сбоку.
   */
  channelCenterY: 24,
  channelWidth: 10,
  channelDepth: 3,
  /**
   * Паз под рассеиватель: центр щели по Z, ширина и глубина, мм.
   *
   * Щель вертикальна и режется в верхней плоскости базы между источником и
   * панелью: лист 2 мм вставляется сверху и стоит на пути света. 12 мм от тыла
   * панели — середина рабочего диапазона 10–15 мм: ближе лист греется от ленты,
   * дальше он перестаёт размывать пятно, потому что сам становится источником
   * пятна. Паз режется при любом источнике: лист входит в комплект.
   */
  diffuserZ: -12,
  diffuserWidth: 2.4,
  diffuserDepth: 6,
  /**
   * Ножка: ширина по X, толщина по нормали к панели, высота, мм.
   *
   * Ножка наклонена вместе с панелью и уходит в базу на 1 мм. Задняя стенка
   * ножки повторяет наклон 12°, поэтому печатается без поддержки. Канал ленты
   * теперь вырезан в скате за ножками, и ножки его не перекрывают: лента
   * укладывается по всей ширине базы.
   */
  legWidth: 6,
  legThickness: 5,
  legTop: 34,
} as const;

/** Угол ската задней стенки арки к столу, радианы. */
const ARCH_LEDGE = (LITHOPHANE_ARCH_STAND.ledgeDeg * Math.PI) / 180;

/**
 * Точка на скате задней стенки арки, мм.
 *
 * `run` — сколько миллиметров отложено вдоль ската от его верхней кромки
 * (высота `leanTop`, тыльная кромка `back`). Скат идёт вниз и вперёд, поэтому
 * высота убывает, а Z растёт. Функция одна на всех: по ней строится профиль базы
 * и считается место ленты в `litho-light-calc`, иначе расчёт и геометрия
 * разъехались бы при любой правке угла.
 */
function archLedgePoint(run: number): { y: number; z: number } {
  const shape = LITHOPHANE_ARCH_STAND;

  return {
    y: shape.leanTop - run * Math.sin(ARCH_LEDGE),
    z: shape.back + run * Math.cos(ARCH_LEDGE),
  };
}

/** Середина канала ленты по скату: сколько миллиметров от верхней кромки. */
const ARCH_CHANNEL_RUN =
  (LITHOPHANE_ARCH_STAND.leanTop - LITHOPHANE_ARCH_STAND.channelCenterY) /
  Math.sin(ARCH_LEDGE);

/**
 * Лента в базе арки: где лежит и куда светит.
 *
 * Считается из того же ската, по которому режется канал: точка — центр пола
 * канала, ось — нормаль ската. Нормаль наклонена на 40° к вертикали вперёд,
 * поэтому лента светит и в низ кадра, и в верх, а не только в потолок. Расчёт
 * света берёт эти числа, а не повторяет арифметику профиля.
 */
export const LITHOPHANE_ARCH_STRIP = {
  /** Центр пола канала — на нём лежит лента, мм. */
  y:
    archLedgePoint(ARCH_CHANNEL_RUN).y -
    LITHOPHANE_ARCH_STAND.channelDepth * Math.cos(ARCH_LEDGE),
  z:
    archLedgePoint(ARCH_CHANNEL_RUN).z -
    LITHOPHANE_ARCH_STAND.channelDepth * Math.sin(ARCH_LEDGE),
  /** Ось свечения: нормаль ската, единичный вектор. */
  axis: [0, Math.cos(ARCH_LEDGE), Math.sin(ARCH_LEDGE)],
} as const;

/**
 * Открытая скоба под патрон E27 и ножку USB-лампы.
 *
 * Владелец показал, как это делают на Cults3D: за панелью стоит не чаша с
 * абажуром, а простая скоба, в которую патрон входит с натягом, и открытая лампа
 * светит прямо на тыл литофана. Скоба — недокрученное кольцо: тело вращения с
 * проёмом 150° сверху, его стенки пружинят, патрон вставляется вдоль оси с натягом
 * 0.2 мм и держится трением, а провод свободно выходит назад через открытый торец.
 * Дна у гнезда нет: скоба — кольцо, патрон проходит насквозь. Наружная дуга кольца
 * ниже оси смотрит вниз, поэтому снизу скобу держит седло стойки
 * (`createClampSaddleBodies`): печатаются только вертикальные стенки и вогнутая
 * полка, и поддержек деталь не требует.
 *
 * Ось гнезда горизонтальна и смотрит в панель: лампа направлена прямо на кадр, как
 * в референсе. Отсюда расстояния: у колбы A60 центр стекла на 30 мм впереди кромки
 * гнезда, а сама колба тянется ещё на 45 мм, поэтому ближняя скоба стоит от панели
 * дальше, чем светит, — иначе колба упиралась бы в литофан. Панель наклонена на
 * 12°, поэтому её плоскость на высоте гнезда уходит назад: расчёт света берёт
 * настоящее расстояние до плоскости, а не координату Z.
 */
export const LITHOPHANE_LAMP_CLAMP = {
  /** Гнездо под патрон E27: патрон Ø40 входит с натягом 0.2 мм, мм. */
  socketBore: 39.8,
  /** Гнездо под гибкую ножку USB-лампы Ø12, мм. */
  usbBore: 13.4,
  /** Толщина стенки скобы, мм. */
  wall: 2,
  /**
   * Длина скобы вдоль оси гнезда, мм.
   *
   * 17 мм — не меньше натяга: патрон Ø40 входит в кольцо на две трети своего
   * корпуса, а ножке USB-лампы хватает и того меньше. Скоба длиннее держала лампу
   * не крепче, а стойка под ней росла вместе с ней: у бруска с патроном пара таких
   * миллиметров весила больше грамма. Стойка-седло кроится по этому же числу (см.
   * `postDepth`): полка под плоской полосой кольца не должна кончаться раньше
   * самой полосы, иначе кромка скобы повисает в воздухе.
   */
  length: 17,
  /** Оборот скобы: остальные 150° — проём сверху, через него стенки пружинят. */
  sweepDeg: 210,
  /** Отрезков на дугу скобы: 48 дают круг с ошибкой 0.02 мм. */
  segments: 48,
  /** Высота оси гнезда над столом в базе арки, мм. */
  axisY: 52,
  /**
   * Гнёзда в держателе арки: ось скобы, мм от плоскости панели.
   *
   * Ближнее — то же, что на референсе: патрон почти у панели, деталь компактная.
   * Дальнее отодвигает лампу на 120 мм: пик падает с ×6 до ×1.4, и карта зеленеет.
   */
  socketAxis: { near: 78, far: 120 },
  /** То же для USB-лампы: её гибкая ножка сама выносит колбу вперёд на 25 мм. */
  usbAxis: { near: 60, far: 115 },
  /** Вылет центра колбы от кромки гнезда, мм: радиус A60 и головка USB-лампы. */
  socketBulbReach: 30,
  usbBulbReach: 25,
  /** Диаметр колбы A60, мм: по нему считается зазор до панели. */
  socketBulbDiameter: 60,
  /** Ширина и высота несущей штанги за панелью, мм. */
  beamWidth: 12,
  beamHeight: 6,
  /**
   * Стойка-седло под скобу: ширина по X и глубина по Z, мм.
   *
   * Верх стойки повторяет наружную дугу кольца (см. `createClampSaddleBodies`), и
   * ширина седла — это ширина нависания кольца: ниже оси наружная стенка смотрит
   * вниз, и стойка с плоским верхом оставила бы эту дугу в воздухе. У кольца Ø44
   * нависание доходит до 16 мм от оси, поэтому седлу патрона нужно 32 мм; ножке
   * USB-лампы Ø17 хватает 20 мм. Шире самого кольца седло не бывает: его полка
   * повторяет стенку, а за габарит скобы деталь не выходит.
   */
  postWidth: 20,
  /** Ширина седла под патрон E27: кольцо Ø44 не встаёт на стойку 20 мм. */
  socketPostWidth: 32,
  /**
   * Глубина стойки-седла по Z, мм.
   *
   * Скоба входит в седло дном дуги, а не всей длиной: пятно контакта — дуга полки,
   * и лишние 3 мм позади неё только добавляли пластик. Владелец попросил держать
   * базу легче 70 г, и у бруска с патроном стойка была самым тяжёлым куском.
   */
  postDepth: 17,
} as const;

/** Скоба какого гнезда: патрон E27 или ножка USB-лампы. */
export type LithophaneClampKind = "socket" | "usb_bulb";

/**
 * Ширина стойки-седла под скобу, мм.
 *
 * Считается в одном месте: по ней строится седло и её же проверяет
 * `check:lithophane`. У седла верх повторяет наружную дугу кольца, поэтому шире
 * самого кольца оно не бывает — иначе полка вышла бы за стенку и легла бы в
 * пустоту. Патрону E27 нужна вся ширина нависания кольца Ø44, ножке USB-лампы
 * Ø17 хватает `postWidth`.
 */
export function clampPostWidth(light: LithophaneClampKind): number {
  const clamp = LITHOPHANE_LAMP_CLAMP;
  const bore = light === "socket" ? clamp.socketBore : clamp.usbBore;
  const outer = bore / 2 + clamp.wall;
  const wanted = light === "socket" ? clamp.socketPostWidth : clamp.postWidth;

  return Math.min(wanted, 2 * (outer - BODY_OVERLAP_MM));
}

/** Гнездо скобы в держателе арки для выбранного источника, мм от панели. */
function clampAxisZ(
  light: LithophaneClampKind,
  seat: LithophaneLightSeat,
): number {
  const clamp = LITHOPHANE_LAMP_CLAMP;

  return light === "socket" ? clamp.socketAxis[seat] : clamp.usbAxis[seat];
}

/**
 * Центр свечения лампы в держателе арки, мм в координатах подставки.
 *
 * Ось скобы горизонтальна, поэтому колба висит на одной высоте с гнездом и
 * сдвинута к панели на свой вылет. Расчёт света берёт эту точку, а не повторяет
 * арифметику профиля.
 */
export function lithophaneClampBulb(
  light: LithophaneClampKind,
  seat: LithophaneLightSeat,
): readonly [number, number, number] {
  const clamp = LITHOPHANE_LAMP_CLAMP;
  const reach =
    light === "socket" ? clamp.socketBulbReach : clamp.usbBulbReach;

  return [0, clamp.axisY, -clampAxisZ(light, seat) + reach];
}

/**
 * Тыльная кромка базы арки, мм.
 *
 * Канал под ленту вырезан в скате задней стенки, поэтому под ленту база глубже:
 * деталь уходит на `shape.back`. Под открытую лампу и «без подсветки» в базе нет
 * выборок, и лишние 34 мм глубины стоили бы 60 г пластика: за панелью остаются
 * только штанга со скобами.
 */
function archBaseBack(
  shape: typeof LITHOPHANE_ARCH_STAND,
  light: LithophaneLightSource,
): number {
  return light === "strip" ? shape.back : shape.openBack;
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
 * дальше вперёд по наклонному скату и верхней плоскости: в них врезаны канал под
 * ленту, паз под рассеиватель и паз под рамку. Все выборки — часть одного
 * контура, поэтому деталь печатается одним профилем, без клея и без вычитания
 * тел.
 *
 * Паз повторяет наклон панели: стенки параллельны плоскости тыла рамки, между
 * ними и рамкой остаётся зазор `LITHOPHANE_FIT_GAP_MM`, а дно лежит ниже верха
 * базы на `seatDepth`. Панель опускается в паз сверху и опирается на дно, так
 * что низ рамки не упирается в глухую стену. Канал под ленту начинается сразу за
 * тыльной стенкой паза: лента стоит в базе и светит вверх, на тыл кадра.
 *
 * Канал, паз под рассеиватель, наклонный скат и высокая тыльная стенка нужны
 * только ленте. Под открытую лампу и «без подсветки» база — ровная планка под
 * пазом рамки: лампу держит отдельный держатель за панелью
 * (`createArchLampBodies`), и выборок в базе нет.
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
  // Канал и паз под рассеиватель нужны только ленте: под открытую лампу в базе не
  // должно быть лишних выборок, а её держатель стоит отдельной деталью.
  const withStrip = light === "strip";
  // Скат клина: от верхней кромки тыльной стенки вниз-вперёд до площадки базы.
  const ledgeFoot = archLedgePoint(
    (shape.leanTop - baseTop) / Math.sin(ARCH_LEDGE),
  );
  const normal = { y: Math.cos(ARCH_LEDGE), z: Math.sin(ARCH_LEDGE) };
  const channelHigh = archLedgePoint(
    ARCH_CHANNEL_RUN - shape.channelWidth / 2,
  );
  const channelLow = archLedgePoint(ARCH_CHANNEL_RUN + shape.channelWidth / 2);
  // Дно канала — поверхность ската, сдвинутая вглубь по его нормали.
  const channelFloor = (point: { y: number; z: number }) => ({
    y: point.y - normal.y * shape.channelDepth,
    z: point.z - normal.z * shape.channelDepth,
  });
  const diffuserBack = shape.diffuserZ - shape.diffuserWidth / 2;
  const diffuserFront = shape.diffuserZ + shape.diffuserWidth / 2;
  const diffuserFloor = baseTop - shape.diffuserDepth;

  return [
    { y: 0, z: shape.front },
    { y: 0, z: back },
    // Тыльная стенка со скатом и каналом ленты — только под ленту: без неё база
    // кончается на верхней площадке и за панелью ничего не держит.
    ...(withStrip
      ? [
          { y: shape.leanTop, z: back },
          // Канал под светодиодную ленту 8–10 мм в скате задней стенки.
          { y: channelHigh.y, z: channelHigh.z },
          channelFloor(channelHigh),
          channelFloor(channelLow),
          { y: channelLow.y, z: channelLow.z },
          { y: ledgeFoot.y, z: ledgeFoot.z },
        ]
      : [{ y: baseTop, z: back }]),
    // Паз под рассеиватель: вертикальная щель в верхней плоскости базы. Он
    // режется при любом источнике — лист входит в комплект, — а под лентой
    // встаёт между каналом и пазом рамки.
    ...(diffuserFloor > 0
      ? [
          { y: baseTop, z: diffuserBack },
          { y: diffuserFloor, z: diffuserBack },
          { y: diffuserFloor, z: diffuserFront },
          { y: baseTop, z: diffuserFront },
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
 * Профиль скобы в плоскости (радиус, осевая координата): кольцо со стенкой.
 *
 * Обход замкнут: задний торец, наружная стенка, передний торец, гнездо. Дна у
 * гнезда нет — скоба открыта с обоих концов, поэтому патрон проходит насквозь, а
 * провод выходит назад.
 */
function clampProfile(bore: number): [number, number][] {
  const clamp = LITHOPHANE_LAMP_CLAMP;
  const inner = bore / 2;
  const outer = inner + clamp.wall;
  const half = clamp.length / 2;

  return [
    [inner, -half],
    [outer, -half],
    [outer, half],
    [inner, half],
  ];
}

/**
 * Скоба-зажим вокруг горизонтальной оси: лампа входит с натягом и смотрит в панель.
 *
 * Тело вращения строится вокруг вертикальной оси, поэтому после заметания скоба
 * ложится на бок: `rotateX(90°)` переводит ось вращения в +Z, а проём, вырезанный
 * сверху (начало 255° при обороте 210°), остаётся открытым вверх. Через него
 * стенки пружинят, когда в гнездо вдавливают патрон, и в него видно цоколь при
 * сборке. Торцы заметания закрыты: это кольца скобы, а не открытые срезы, — так
 * деталь остаётся замкнутой и печатается без поддержек.
 *
 * `axisY` — высота оси над столом, `axisZ` — положение кромки гнезда по Z.
 */
function createClampBody(
  light: LithophaneClampKind,
  axisY: number,
  axisZ: number,
): BufferGeometry {
  const clamp = LITHOPHANE_LAMP_CLAMP;
  const gap = 360 - clamp.sweepDeg;
  const bore = light === "socket" ? clamp.socketBore : clamp.usbBore;

  return createRevolvedBody(
    clampProfile(bore),
    0,
    180 + gap / 2,
    clamp.sweepDeg,
    clamp.segments,
  )
    .rotateX(Math.PI / 2)
    .translate(0, axisY, axisZ);
}

/**
 * Стойка-седло под скобу: столб, верх которого повторяет наружную дугу кольца.
 *
 * Кольцо ниже оси смотрит наружной стенкой вниз, поэтому на стойку с плоским
 * верхом ложится только узкая полоса дна, а нижняя дуга висит в воздухе — у
 * патрона Ø44 это нависание в 16 мм, и без поддержек оно провисает. Седло
 * повторяет снизу ту же дугу: печатаются только вертикальные стенки и вогнутая
 * полка, а скоба лежит на стойке всей нижней половиной.
 *
 * Полка проведена по радиусу на `BODY_OVERLAP_MM` меньше наружного: по этому
 * нахлёсту деталь срастается, а стенка скобы остаётся почти 2 мм — гнездо седло
 * не задевает. Ширина седла — `clampPostWidth`: это ширина нависания кольца,
 * шире самого кольца седло не бывает.
 *
 * `foot` — высота пятака под седлом. Пятак на 2 мм шире седла: под кромками
 * остаётся горизонтальная полка, и печать опирается на неё, а не начинает кромки
 * в воздухе. В базе арки пятак стоит на столе, и седло встаёт на штангу.
 */
function createClampSaddleBodies(
  light: LithophaneClampKind,
  axisY: number,
  axisZ: number,
  foot = 0,
): BufferGeometry[] {
  const clamp = LITHOPHANE_LAMP_CLAMP;
  const bore = light === "socket" ? clamp.socketBore : clamp.usbBore;
  const outer = bore / 2 + clamp.wall;
  // Полка седла: скоба входит в стойку на нахлёст, гнездо остаётся чистым.
  const perch = outer - BODY_OVERLAP_MM;
  const half = clampPostWidth(light) / 2;
  // Дуга полки идёт через низ кольца от кромки до кромки. Угол кромки считается от
  // оси кольца: там, где дуга доходит до половины ширины седла.
  const edge = Math.acos(Math.min(1, half / perch));
  const steps = Math.max(
    6,
    Math.round((clamp.segments * (Math.PI - 2 * edge)) / (2 * Math.PI)),
  );
  const z0 = axisZ - clamp.postDepth / 2;
  const z1 = axisZ + clamp.postDepth / 2;
  const bodies: BufferGeometry[] = [];

  if (foot > 0) {
    const pad = half + 2;

    bodies.push(
      createSectionPrismBody(
        [
          [-pad, 0],
          [pad, 0],
          [pad, foot],
          [-pad, foot],
        ],
        z0,
        z1,
      ),
    );
  }

  // Седло садится в пятак на нахлёст — по этому стыку тела срастаются.
  const seat = foot > 0 ? foot - BODY_OVERLAP_MM : 0;
  const section: [number, number][] = [
    [-half, seat],
    [half, seat],
  ];

  for (let step = 0; step <= steps; step += 1) {
    const angle = -edge - ((Math.PI - 2 * edge) * step) / steps;

    section.push([perch * Math.cos(angle), axisY + perch * Math.sin(angle)]);
  }

  bodies.push(createSectionPrismBody(section, z0, z1));

  return bodies;
}

/**
 * Держатель лампы в базе арки: штанга по столу, стойки и две скобы.
 *
 * Обе скобы печатаются всегда: ближняя повторяет референс с Cults3D (патрон почти
 * у панели, деталь компактная), дальняя отодвигает лампу на 120 мм, и карта света
 * зеленеет. Человек переставляет патрон между ними при сборке, а расчёт света
 * берёт то гнездо, что выбрано в параметрах.
 *
 * Штанга начинается в теле базы и идёт по столу назад: она связывает скобы в одну
 * деталь и даёт подставке глубину, без которой лампа на 52 мм опрокинула бы её.
 */
function createArchLampBodies(
  light: LithophaneClampKind,
  baseBack: number,
): BufferGeometry[] {
  const clamp = LITHOPHANE_LAMP_CLAMP;
  const axes = light === "socket" ? clamp.socketAxis : clamp.usbAxis;
  const seats: readonly LithophaneLightSeat[] = ["near", "far"];
  // Штанга на 4 мм длиннее дальней скобы: её задний торец уходит за гнездо.
  const rear = -(Math.max(axes.near, axes.far) + clamp.length / 2 + 4);
  const bodies = [
    // Штанга на 2 мм заходит в базу — по этому стыку детали срастаются.
    createProfilePrismBody(
      [
        { y: 0, z: baseBack + 2 },
        { y: 0, z: rear },
        { y: clamp.beamHeight, z: rear },
        { y: clamp.beamHeight, z: baseBack + 2 },
      ],
      -clamp.beamWidth / 2,
      clamp.beamWidth / 2,
    ),
  ];

  for (const seat of seats) {
    const axisZ = -axes[seat];

    bodies.push(
      ...createClampSaddleBodies(light, clamp.axisY, axisZ, clamp.beamHeight),
      createClampBody(light, clamp.axisY, axisZ),
    );
  }

  return bodies;
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
 * Замкнутая призма по сечению в плоскости (X, Y), выдавленная по Z от z0 до z1.
 *
 * Отличие от `createProfilePrismBody` одно: сечение — готовые пары (x, y), а не
 * объекты профиля. Так удобнее седлу скобы: его полка повторяет дугу кольца,
 * лежащего в плоскости XY, и точки считаются из угла. Торцы разбивает
 * `ShapeUtils.triangulateShape` — полка седла вогнутая, веер из одной вершины на
 * ней не работает.
 */
function createSectionPrismBody(
  section: readonly (readonly [number, number])[],
  z0: number,
  z1: number,
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const outline = section.map(([x, y]) => new Vector2(x, y));
  const samples = ShapeUtils.isClockWise(outline) ? outline.reverse() : outline;
  const triangles = ShapeUtils.triangulateShape(samples, []);

  for (const [z, normal] of [
    [z0, [0, 0, -1]],
    [z1, [0, 0, 1]],
  ] as const) {
    for (const triangle of triangles) {
      const first = vertexIndex(positions);

      for (const corner of triangle) {
        positions.push(samples[corner].x, samples[corner].y, z);
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

  const rings = samples.map((point) => {
    const first = vertexIndex(positions);

    positions.push(point.x, point.y, z0, point.x, point.y, z1);

    return [first, first + 1] as const;
  });

  for (let index = 0; index < samples.length; index += 1) {
    const next = (index + 1) % samples.length;
    const from = samples[index];
    const to = samples[next];

    addOrientedQuad(
      indices,
      positions,
      rings[index][0],
      rings[next][0],
      rings[next][1],
      rings[index][1],
      [to.y - from.y, from.x - to.x, 0],
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
 * Кольца одного ребра профиля переиспользуются на соседних шагах: нормали
 * сглаживаются вдоль дуги, поэтому база читается литой, а не гранёной. Новое
 * ребро начинает свои кольца, и излом профиля остаётся острым — сварка
 * (`smoothGeometryNormals`) поверх такой сетки не нужна: она скруглила бы и
 * кромки паза. Точка на оси (r = 0) даёт треугольник вместо четырёхугольника:
 * две вершины совпали бы в одной точке, и в сетке появилась бы грань нулевой
 * площади.
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

    // Кольца одного ребра профиля общие для соседних шагов: нормали сглаживаются
    // вдоль дуги, и заметённая поверхность читается литой. Следующее ребро
    // начинает свои кольца, поэтому изломы профиля (паз, канал, кромки) остаются
    // острыми — база выглядит фрезерованной, а не оплавленной.
    let previous: { from: number; to: number } | null = null;

    for (let step = 0; step <= segmentCount; step += 1) {
      const angle = start + (sweep * step) / segmentCount;
      const axisFrom = from.x <= 0;
      const axisTo = to.x <= 0;
      // Точка на оси от угла не зависит: у неё одна вершина на все шаги.
      const toVertex: number = axisTo
        ? (previous?.to ?? push(at(0, to.y, angle)))
        : push(at(to.x, to.y, angle));
      const fromVertex: number = axisFrom
        ? (previous?.from ?? push(at(0, from.y, angle)))
        : push(at(from.x, from.y, angle));

      if (previous !== null) {
        // Наружная нормаль ребра в плоскости профиля — (dh, −dr); радиус смотрит
        // по (sin θ, cos θ), поэтому вектор нормали раскладывается по обеим осям.
        const middle = start + (sweep * (step - 0.5)) / segmentCount;
        const normal: Point3 = [
          dh * Math.sin(middle),
          -dr,
          dh * Math.cos(middle),
        ];

        if (axisFrom) {
          addOrientedTriangle(
            indices,
            positions,
            previous.from,
            previous.to,
            toVertex,
            normal,
          );
        } else if (axisTo) {
          addOrientedTriangle(
            indices,
            positions,
            previous.from,
            previous.to,
            fromVertex,
            normal,
          );
        } else {
          addOrientedQuad(
            indices,
            positions,
            previous.from,
            previous.to,
            toVertex,
            fromVertex,
            normal,
          );
        }
      }

      previous = { from: fromVertex, to: toVertex };
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

/** Угол фасетки дуги обвязки, градусы: силуэт цоколя читается дугой. */
const LITHOPHANE_ARC_FACET_DEG = 1.5;

/** Наименьшее число отрезков дуги: короткая дуга остаётся гладкой. */
const LITHOPHANE_ARC_MIN_SEGMENTS = 8;

/** Отрезков дуги обвязки: не крупнее фасетки `LITHOPHANE_ARC_FACET_DEG`. */
function baseArcSegments(sweepDeg: number): number {
  return Math.max(
    LITHOPHANE_ARC_MIN_SEGMENTS,
    Math.ceil(sweepDeg / LITHOPHANE_ARC_FACET_DEG),
  );
}

/**
 * Круглый плафон: полый цилиндр из двух-четырёх изогнутых панелей.
 *
 * Ширина слайдера — наружный диаметр плафона, поэтому панель рождается на
 * радиусе `диаметр / 2 − максимальная толщина`: бортик плиты печатается на
 * максимальной толщине и доходит ровно до заданного диаметра, а лицо фото
 * остаётся чуть глубже. Внутренняя камера — это диаметр минус две толщины
 * панели: на плафоне Ø120 при толщине 3 мм внутри остаётся Ø114 мм под лампу.
 *
 * Панели занимают соседние секторы окружности: ширина каждой равна дуге
 * `2πR / N`, а перехлёст `seamOverlapMm` убирает совпадающие плоскости на стыке.
 * Верх и низ открыты — плафон надевается на лампу или ставится на неё, а воздух
 * проходит насквозь.
 */
export const LITHOPHANE_ROUND = {
  /**
   * Перехлёст соседних панелей по дуге, мм: 0.2 мм на сторону.
   *
   * Без перехлёста боковины соседних панелей легли бы в одну плоскость, и
   * слайсер увидел бы две оболочки, касающиеся гранями. Небольшой нахлёст даёт
   * одно тело без щели, как у деталей подставки (`BODY_OVERLAP_MM`).
   */
  seamOverlapMm: 0.4,
} as const;

/**
 * Основание круглого плафона: кольцо с пазом, спицы и ступица под патрон.
 *
 * Панели плафона висят в воздухе — у них нет ни цоколя, ни рамки. Основание
 * замыкает абажур снизу, но сплошным диском не становится: пластик нужен только
 * там, где он держит. По краю идёт кольцо с пазом под шип панели, в центре —
 * ступица-держатель лампы, а между ними четыре спицы. Воздух проходит насквозь,
 * деталь весит втрое меньше диска, а провод от патрона свободно выходит вниз.
 *
 * Паз шириной 2.5 мм уже бортика панели (3 мм на максимальной толщине), поэтому
 * низ каждой панели стесан с лица до 2.2 мм — шип. Стес идёт на 3.4 мм от
 * кромки: над пазом видна уже полная кромка, а ступенька прячется внутри.
 *
 * Наружное кольцо выступает за панель на `rimOverhang`: панель толще паза и
 * закрывает почти всё кольцо, сплошного борта над канавкой не остаётся. Выступ
 * даёт борт 3.65 мм — деталь не ломается при съёме плафона, — а заодно скрывает
 * ступеньку шипа под свесом козырька.
 *
 * Ступица — держатель лампы: труба стоит прямо на столе, дно гнезда на 3 мм,
 * гнездо внутри рассчитано на корпус патрона E14 или E27 (`lithoRailSocket`,
 * `ring` из `LITHOPHANE_RAIL_SOCKET_SIZES`). Патрон вставляется корпусом сверху,
 * цоколь смотрит вверх, а провод уходит вниз через квадратное окно 6 × 6 мм в
 * дне — дна под ступицей нет, окно открыто снизу. Печать без поддержек: кольцо,
 * спицы и дно ступицы лежат на столе, стенки растут вверх.
 *
 * Крышка-козырек (`top_cover`) повторяет паз основания сверху и нависает над
 * плафоном на `visorOverhang`: свет не бьёт в потолок и в глаза, а вентиляция
 * идёт через отверстие 20 мм в центре.
 */
export const LITHOPHANE_ROUND_BASE = {
  /** Толщина кольца и спиц, мм: под пазом остаётся дно 1 мм. */
  thickness: 4,
  /** Глубина кольцевого паза под кромку панели, мм. */
  grooveDepth: 3,
  /** Ширина паза по радиусу, мм. */
  grooveWidth: 2.5,
  /** Зазор между шипом панели и стенкой паза на сторону, мм. */
  grooveClearance: 0.15,
  /**
   * Высота шипа панели над кромкой, мм: чуть выше паза, чтобы ступенька
   * от стеса осталась внутри канавки.
   */
  tenonHeight: 3.4,
  /** Толщина шипа, когда бортик панели шире паза, мм. */
  tenonMax: 2.2,
  /** Сегментов окружностей деталей: фасетка около 1°. */
  segments: 96,
  /** Вылет кольца за наружный диаметр панели, мм. */
  rimOverhang: 3,
  /** Спиц между кольцом и ступицей: четыре стоят по осям X и Z. */
  spokeCount: 4,
  /** Ширина спицы в плане, мм. */
  spokeWidth: 8,
  /** Стенка ступицы, мм. */
  cupWall: 3,
  /** Дно гнезда над столом, мм. */
  cupFloor: 3,
  /** Высота ступицы над столом, мм. */
  cupHeight: 25,
  /** Окно под провод: сторона квадрата, мм. */
  wireSize: 6,
  /** Вылет крышки-козырька за кольцо основания, мм. */
  visorOverhang: 5,
  /** Толщина крышки в зоне паза и козырька, мм. */
  visorThickness: 4,
  /** Толщина середины крышки: она только отсекает свет, мм. */
  visorPlate: 2,
  /** Отверстие вентиляции в центре крышки, мм. */
  visorVent: 20,
  /**
   * Насколько крышка села глубже шипа, мм: низ крышки на столько ниже верха
   * панели сверх глубины паза. Ступенька шипа уходит под свес, а совпадающих
   * плоскостей у деталей нет.
   */
  visorLift: 0.35,
} as const;

/** Габариты основания и крышки плафона: кольцо, паз, шип, спицы, ступица. */
export type RoundBaseMetrics = {
  /** Наружный радиус кольца основания, мм: панель плюс вылет. */
  discRadius: number;
  /** Толщина кольца и спиц, мм. */
  thickness: number;
  /** Радиус тыла панелей, мм: на нём стоит шип. */
  backRadius: number;
  /** Внутренний и наружный радиусы кольцевого паза, мм. */
  grooveInner: number;
  grooveOuter: number;
  /** Ширина и глубина паза, мм. */
  grooveWidth: number;
  grooveDepth: number;
  /** Толщина шипа панели, мм: бортик панели, стесанный под паз. */
  tenonThickness: number;
  /** Высота шипа, мм. */
  tenonHeight: number;
  /** Высота дна паза над столом, мм. */
  grooveFloorY: number;
  /** Насколько панели подняты от стола: дно паза минус нахлёст, мм. */
  panelLift: number;
  /** Верх панели в собранном виде, мм. */
  panelTop: number;
  /** Спицы: сколько, ширина и радиусы, на которых они стоят, мм. */
  spokeCount: number;
  spokeWidth: number;
  spokeInner: number;
  spokeOuter: number;
  /** Спица длиннее половины миллиметра: иначе ступица и так в кольце. */
  spokes: boolean;
  /** Наружный радиус ступицы и радиус её гнезда, мм. */
  cupOuter: number;
  cupBore: number;
  /** Верх ступицы над столом и дно гнезда, мм. */
  cupTop: number;
  cupFloor: number;
  /** Сторона сквозного окна под провод, мм. */
  wireSize: number;
  /** Крышка-козырек: наружный радиус, отверстие, толщины и высоты, мм. */
  visorRadius: number;
  visorVent: number;
  visorThickness: number;
  visorPlate: number;
  /** Глубина паза крышки, мм: равна толщине её середины. */
  visorGrooveDepth: number;
  /** Низ и верх крышки в собранном виде, мм. */
  visorBottom: number;
  visorTop: number;
  /** Число панелей: по нему строится кольцо. */
  panels: number;
};

/**
 * Габариты основания и крышки по параметрам плафона.
 *
 * Экспортируется для теста: паз, шип, спицы и ступица заданы числами, а сетка
 * только повторяет их. Паз стоит на радиусе тыла панелей: внутренняя стенка
 * отступает на зазор, поэтому шип входит от руки. Ступица считается по
 * выбранному патрону: гнездо равно наружному диаметру кольца патрона (32 мм у
 * E14, 42 мм у E27), а стенка 3 мм даёт наружный диаметр 38 и 48 мм.
 */
export function lithophaneRoundBaseMetrics(
  normalized: LithophaneParams,
): RoundBaseMetrics {
  const base = LITHOPHANE_ROUND_BASE;
  const socket = LITHOPHANE_RAIL_SOCKET_SIZES[normalized.lithoRailSocket];
  const discRadius = Math.max(1, normalized.lithophaneWidth / 2) + base.rimOverhang;
  const backRadius = Math.max(
    1,
    normalized.lithophaneWidth / 2 - normalized.lithophaneMaxThickness,
  );
  const grooveInner = Math.max(0, backRadius - base.grooveClearance);
  const grooveOuter = Math.min(discRadius, grooveInner + base.grooveWidth);
  // Шип не может быть шире бортика панели: у тонкой панели он стесан сильнее,
  // и в пазу остаётся свободный ход — деталь всё равно держится стенками.
  const tenonThickness = Math.min(
    base.tenonMax,
    base.grooveWidth - 2 * base.grooveClearance,
    normalized.lithophaneMaxThickness - base.grooveClearance * 2,
  );
  const cupBore = socket.ring;
  const grooveFloorY = base.thickness - base.grooveDepth;
  const panelLift = grooveFloorY - BODY_OVERLAP_MM;
  // Спица идёт от наружной стенки ступицы до внутренней стенки кольца. На малом
  // диаметре промежутка нет: ступица шире кольца, и деталь связна без спиц.
  const spokeInner = (cupBore + 2 * base.cupWall) / 2 - BODY_OVERLAP_MM;
  const spokeOuter = grooveInner + BODY_OVERLAP_MM;

  return {
    discRadius,
    thickness: base.thickness,
    backRadius,
    grooveInner,
    grooveOuter,
    grooveWidth: grooveOuter - grooveInner,
    grooveDepth: base.grooveDepth,
    tenonThickness,
    tenonHeight: base.tenonHeight,
    // Панель входит в паз на нахлёст: её низ на 0.2 мм ниже дна канавки, как у
    // остальных деталей проекта. Иначе панель и дно паза легли бы плоскость в
    // плоскость, и в объединённой сетке слайсер увидел бы две грани в одном
    // месте, а не одно тело.
    grooveFloorY,
    panelLift,
    panelTop: panelLift + normalized.lithophaneHeight,
    spokeCount: base.spokeCount,
    spokeWidth: base.spokeWidth,
    spokeInner,
    spokeOuter,
    spokes: spokeOuter - spokeInner > 0.5,
    cupOuter: (cupBore + 2 * base.cupWall) / 2,
    cupBore: cupBore / 2,
    cupTop: base.cupHeight,
    cupFloor: base.cupFloor,
    wireSize: base.wireSize,
    visorRadius: discRadius + base.visorOverhang,
    visorVent: base.visorVent,
    visorThickness: base.visorThickness,
    visorPlate: base.visorPlate,
    visorGrooveDepth: base.visorPlate,
    // Крышка садится на верхний шип панели: её паз глубиной `visorPlate`, и низ
    // крышки стоит на `visorLift` ниже верха панели — шип входит в паз, но до
    // потолка не достаёт, поэтому крышка ложится на кольцо без натяга.
    visorBottom:
      panelLift + normalized.lithophaneHeight - base.visorPlate + base.visorLift,
    visorTop:
      panelLift +
      normalized.lithophaneHeight -
      base.visorPlate +
      base.visorLift +
      base.visorThickness,
    panels: lithophanePanelCount(normalized),
  };
}

/** Габариты круглого плафона: радиус тыла, длина панели по дуге и высота. */
type RoundMetrics = {
  /** Радиус тыла панелей, мм: рельеф растёт наружу от него. */
  radius: number;
  /** Длина панели по дуге тыла вместе с перехлёстом, мм. */
  panelWidth: number;
  /** Высота панели, мм. */
  height: number;
  /** Число панелей в кольце. */
  panels: number;
};

/**
 * Габариты плафона из параметров панели.
 *
 * Радиус считается от наружного диаметра: максимальная толщина — это бортик,
 * который печатается по всему периметру панели, поэтому именно он задаёт
 * габарит. Длина панели — дуга её сектора: `2πR / N` плюс перехлёст, где N —
 * число загруженных фото (один кадр даёт цельное кольцо на 360°). Высота берётся
 * как у плоской панели, из того же слайдера.
 */
function roundMetrics(normalized: LithophaneParams): RoundMetrics {
  const panels = Math.max(1, lithophanePanelCount(normalized));
  const radius = Math.max(
    1,
    normalized.lithophaneWidth / 2 - normalized.lithophaneMaxThickness,
  );

  return {
    radius,
    panelWidth: (2 * Math.PI * radius) / panels + LITHOPHANE_ROUND.seamOverlapMm,
    height: normalized.lithophaneHeight,
    panels,
  };
}

/**
 * Панели плафона: кольцо из изогнутых рельефов, у каждой панели свой кадр.
 *
 * Каждая панель — та же плита, что у плоского литофана, но вершины рождаются
 * сразу на цилиндре радиуса `radius` (см. `cylinderPoint`): тыл остаётся на
 * радиусе, рельеф растёт наружу, а нормали по общим вершинам выходят гладкими.
 * Ось панели стоит в (0, y, −R), поэтому сдвиг на R переносит её в ось плафона,
 * а поворот вокруг Y ставит панель на её сектор. Пустой слот панели повторяет
 * предыдущий кадр — одна картинка печатается на всём кольце.
 *
 * `lift` поднимает панели в основание: низ каждой входит в кольцевой паз и
 * лежит на его дне, поэтому в собранном виде кольцо стоит на основании, а не
 * висит над ним. Шипы обеих кромок (см. `tenon` в `createReliefBody`) уже
 * бортика панели: нижний проходит в канавку 2.5 мм основания, верхний — в такой
 * же паз крышки-козырька.
 */
function createRoundPanelsGeometry(
  normalized: LithophaneParams,
  lift = 0,
): {
  geometry: BufferGeometry;
  spans: number[];
} {
  const round = roundMetrics(normalized);
  const base = lithophaneRoundBaseMetrics(normalized);
  const tenon = {
    height: base.tenonHeight,
    thickness: base.tenonThickness,
    top: true,
  };
  const faces = lithophaneFaceBrightness(normalized);
  const bodies: BufferGeometry[] = [];
  const spans: number[] = [];

  for (let panel = 0; panel < round.panels; panel += 1) {
    const plate = createReliefBody(
      normalized,
      round.panelWidth,
      round.height,
      LITHOPHANE_BORDER_MM,
      0,
      faces[panel] ?? faces[0],
      round.radius,
      tenon,
    );

    plate.translate(0, lift, round.radius);
    plate.rotateY((panel * 2 * Math.PI) / round.panels);
    spans.push(plate.getIndex()?.count ?? 0);
    bodies.push(plate);
  }

  return { geometry: mergeBodies(bodies, "панелей плафона"), spans };
}

/**
 * Основание плафона отдельной деталью: кольцо с пазом, спицы и ступица.
 *
 * Сплошного диска нет — пластик остался только там, где он держит:
 *   • наружное кольцо — борт от паза до `discRadius` и дно паза толщиной 1 мм,
 *     на котором стоят панели;
 *   • спицы — четыре бруска 8 × 4 мм от ступицы до кольца, по осям X и Z;
 *   • ступица — дно на 3 мм с окном под провод и труба до `cupTop`.
 * Плиты перекрываются на `BODY_OVERLAP_MM`: в объединённой сетке нет
 * совпадающих плоскостей, и слайсер видит одно тело.
 *
 * Ступица стоит на столе: гнездо внутри равно наружному диаметру кольца
 * патрона, поэтому в него плотно встаёт корпус E14 или E27, а цоколь смотрит
 * вверх. Дна под ступицей нет — окно 6 × 6 мм выходит прямо под стол, и провод
 * не приходится продевать через закрытую полость.
 *
 * Плиты строятся в плоскости XY и выдавливаются по Z; перенос `rotateX(-π/2)`
 * кладёт их на стол: контурная ось Y становится −Z, выдавливание — высотой.
 */
export function createRoundBaseGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const base = lithophaneRoundBaseMetrics(normalized);
  const round = LITHOPHANE_ROUND_BASE;
  const overlap = BODY_OVERLAP_MM;
  const wireHalf = base.wireSize / 2;
  // Окно под провод — квадрат по оси: штекер и вилка проходят целиком, а не
  // продеваются по одному проводу.
  const wireHole: Point2[] = [
    [-wireHalf, -wireHalf],
    [wireHalf, -wireHalf],
    [wireHalf, wireHalf],
    [-wireHalf, wireHalf],
  ];
  const circle = (radius: number): Point2[] =>
    circlePoints(0, 0, Math.max(0.01, radius), round.segments);
  const plates: BufferGeometry[] = [];
  // Наружный борт паза: кольцо от канавки до вылета. Вылет кольца больше
  // нахлёста всегда, поэтому борт выходит цельной стенкой, а не перемычкой.
  const rim = createPlateBody(
    circle(base.discRadius),
    [circle(base.grooveOuter)],
    0,
    base.thickness,
  );

  rim.rotateX(-Math.PI / 2);
  plates.push(rim);

  // Дно паза: кольцо на 1 мм от стола, на нём стоит шип панели.
  const grooveFloor = createPlateBody(
    circle(base.grooveOuter + overlap),
    [circle(Math.max(overlap, base.grooveInner - overlap))],
    0,
    Math.max(0.4, base.thickness - base.grooveDepth),
  );

  grooveFloor.rotateX(-Math.PI / 2);
  plates.push(grooveFloor);

  // Дно ступицы: плита по наружному диаметру с окном под провод. Дна под ней
  // нет, поэтому окно открыто снизу и печать не требует поддержек.
  const cupFloor = createPlateBody(
    circle(base.cupOuter),
    [wireHole],
    0,
    base.cupFloor,
  );

  cupFloor.rotateX(-Math.PI / 2);
  plates.push(cupFloor);

  // Стенка стакана: труба от дна до верха, гнездо внутри остаётся открытым.
  const cupWall = createRevolvedBody(
    [
      [base.cupBore, base.cupFloor - overlap],
      [base.cupOuter, base.cupFloor - overlap],
      [base.cupOuter, base.cupTop],
      [base.cupBore, base.cupTop],
    ],
    0,
    0,
    360,
    round.segments,
    false,
  );

  plates.push(cupWall);

  // Спицы: брусок от наружной стенки ступицы до внутренней стенки кольца. Оба
  // конца заходят в соседние детали на нахлёст, поэтому кольцо, спицы и ступица
  // печатаются одним телом. На малом диаметре промежутка нет — спиц не нужно.
  if (base.spokes) {
    const halfSpoke = base.spokeWidth / 2;

    for (let spoke = 0; spoke < base.spokeCount; spoke += 1) {
      const arm = createPlateBody(
        [
          [base.spokeInner, -halfSpoke],
          [base.spokeOuter, -halfSpoke],
          [base.spokeOuter, halfSpoke],
          [base.spokeInner, halfSpoke],
        ],
        [],
        0,
        base.thickness,
      );

      arm.rotateX(-Math.PI / 2);
      arm.rotateY((spoke * 2 * Math.PI) / base.spokeCount);
      plates.push(arm);
    }
  }

  return mergeBodies(plates, "основания плафона");
}

/**
 * Верхняя крышка-козырек плафона отдельной деталью: паз снизу и свес по краю.
 *
 * Крышка закрывает плафон сверху, поэтому свет не бьёт в потолок, а козырёк
 * выступает за кольцо основания на `visorOverhang` и не пускает его в глаза.
 * Снизу вырезан такой же кольцевой паз, как на основании: верхний шип панели
 * входит в него, и крышка садится на кольцо без крепежа.
 *
 * Деталь собирается тремя плитами:
 *   • середина — диск от вентиляции до внутренней стенки паза, `visorPlate`
 *     толщиной: она задаёт глубину паза;
 *   • потолок — кольцо над пазом от `visorPlate` до верха крышки: на нём лежит
 *     верхний шип панели;
 *   • козырёк — кольцо от паза до `visorRadius` полной толщины.
 * Середина и потолок стыкуются на `visorPlate`, а козырёк заходит под потолок на
 * `BODY_OVERLAP_MM`: совпадающих плоскостей нет, и слайсер видит одно тело.
 * Отверстие 20 мм в центре выпускает горячий воздух от лампы: без него крышка
 * превратила бы абажур в закрытую камеру.
 */
export function createRoundTopCoverGeometry(
  params: Partial<LithophaneParams>,
): BufferGeometry {
  const normalized = normalizeLithophaneParams(params);
  const base = lithophaneRoundBaseMetrics(normalized);
  const round = LITHOPHANE_ROUND_BASE;
  const overlap = BODY_OVERLAP_MM;
  const ventRadius = base.visorVent / 2;
  const circle = (radius: number): Point2[] =>
    circlePoints(0, 0, Math.max(0.01, radius), round.segments);
  const plates: BufferGeometry[] = [];

  // Середина: диск вокруг вентиляции до внутренней стенки паза. Свет она не
  // пропускает, а вес не тянет: её толщина и есть глубина паза.
  const middle = createPlateBody(
    circle(base.grooveInner),
    [circle(ventRadius)],
    0,
    base.visorGrooveDepth,
  );

  middle.rotateX(-Math.PI / 2);
  plates.push(middle);

  // Потолок паза: кольцо от глубины канавки до верха крышки. Внутрь и наружу
  // оно заходит на нахлёст, поэтому середина и козырёк срастаются с ним.
  const ceiling = createPlateBody(
    circle(base.grooveOuter + overlap),
    [circle(Math.max(overlap, base.grooveInner - overlap))],
    base.visorGrooveDepth,
    base.visorThickness,
  );

  ceiling.rotateX(-Math.PI / 2);
  plates.push(ceiling);

  // Козырёк: кольцо от паза до наружного радиуса во всю толщину.
  const visor = createPlateBody(
    circle(base.visorRadius),
    [circle(Math.max(overlap, base.grooveOuter - overlap))],
    0,
    base.visorThickness,
  );

  visor.rotateX(-Math.PI / 2);
  plates.push(visor);

  return mergeBodies(plates, "крышки плафона");
}

/**
 * Калейдоскоп: четыре панели без рамок на полом цоколе под вентилируемой крышкой.
 *
 * Панель — это плита целиком: съёмная рамка у призмы не нужна, её край входит в
 * паз цоколя и в паз крышки. Лицевая плоскость панели (плоскость бортика) лежит
 * ровно на грани призмы, поэтому призма — квадрат со стороной ширины панели, а
 * световая камера ограничена тылами четырёх плит.
 *
 * Цоколь — четыре тонких рельса с пазом: пола нет, призма стоит на столе, воздух
 * заходит снизу. Свечу или LED-лампу держит пьедестал по центру камеры: раньше она
 * стояла на столе в кольце Ø40, и источник оказывался у самого низа — низ граней
 * горел, верх уходил в тень. Пьедестал поднимает гнездо на 27 мм, к середине
 * кадра, а спицы связывают его с обвязкой. Сверху камеру закрывает тонкая крышка с
 * окнами: горячий воздух уходит, а колпак над источником не даёт свету бить прямо
 * в потолок.
 */
export const LITHOPHANE_KALEIDOSCOPE = {
  /** Граней в призме: квадрат, панели через 90°. */
  sides: LITHOPHANE_KALEIDOSCOPE_SIDES,
  /**
   * Вылет рельса за конец панели, мм: на столько рельс короче стороны цоколя.
   *
   * Рельс по длине чуть не доходит до наружной плоскости соседнего: иначе торец
   * одного рельса и лицо соседнего легли бы в одну плоскость, и слайсер увидел бы
   * две грани в одном месте. Ниша 0.2 мм в углу цоколя не видна — она закрыта
   * клеем при сборке.
   */
  railOverhang: BODY_OVERLAP_MM,
  /** Толщина стенок цоколя и крышки, мм. */
  wall: 1.2,
  /** Дно паза под нижнюю кромку панели над столом, мм. */
  floor: 2,
  /** Глубина паза под панель в цоколе и в крышке, мм. */
  seatDepth: 1.5,
  /** Толщина крышки над пазом, мм. */
  lidThickness: 2.5,
  /**
   * Пьедестал под источник: наружный радиус, высота и стенка трубы, мм.
   *
   * Труба, а не столбик: полая деталь весит втрое меньше. Гнездо Ø40 глубиной 5
   * сверху держит и LED-свечу Ø38, и обычную чайную — их центр свечения выходит на
   * 42 мм, то есть на середину кадра высотой 80. Верх пьедестала на 27 мм: выше
   * пола цоколя, но ниже панелей, поэтому свет не перекрывает.
   */
  pedestalOuter: 22,
  pedestalInner: 15,
  pedestalTop: 27,
  pedestalCavity: 20,
  pedestalDepth: 5,
  /** Ширина спицы дна и перемычки крышки, мм. */
  spokeWidth: 4,
  /** Высота спиц дна, мм: пьедестал стоит на столе, спицы держат обвязку. */
  spokeHeight: 2.5,
  /** Диаметр колпака над свечой в крышке, мм. */
  capDiameter: 44,
  /** Толщина колпака, мм: тонкий, иначе крышка тяжелеет. */
  capThickness: 1.6,
  /** Ширина перемычек, на которых висит колпак, мм. */
  armWidth: 8,
  /** Толщина перемычек, мм. */
  armThickness: 1.6,
} as const;

/**
 * Матрица грани призмы: поворот на 90° · side и отступ от оси призмы.
 *
 * Поворот вокруг оси Y переводит тыл панели (Z = back) в нужную грань, поэтому
 * одна и та же плита встаёт на все четыре стороны без отдельной геометрии.
 * Тот же поворот ставит рельсы цоколя и крышки: они выдавливаются вдоль X и
 * поворачиваются вокруг оси призмы.
 *
 * `narrow` — сжатие плиты по её ширине перед поворотом. Панель чуть уже грани
 * призмы: её торец уходит внутрь соседней панели, и совпадающих плоскостей в
 * углах нет. Щель 0.2 мм в углу закрывается клеем при сборке.
 */
function kaleidoscopePanelMatrix(
  side: number,
  back: number,
  lift: number,
  narrow = 1,
): Matrix4 {
  return new Matrix4()
    .makeRotationY((side * Math.PI) / 2)
    .multiply(new Matrix4().makeTranslation(0, lift, back))
    .multiply(new Matrix4().makeScale(narrow, 1, 1));
}

/**
 * Габариты калейдоскопа, мм: призма, пазы, цоколь и крышка.
 *
 * Считаются в одном месте, потому что от них зависят и плита, и рельсы цоколя, и
 * крышка: паз цоколя и паз крышки должны стоять ровно над кромкой панели, иначе
 * призма не соберётся. Лицевая плоскость панели (`front`) — это грань призмы:
 * бортик плиты печатается на максимальной толщине и лежит заподлицо с ней.
 */
type KaleidoscopeMetrics = {
  /** Сторона панели без рамки, мм. */
  width: number;
  height: number;
  /** Максимальная толщина панели: по ней считается ширина паза. */
  maxThickness: number;
  /** Лицевая плоскость панели — она же грань призмы. */
  front: number;
  /** Плоскость тыла панели. */
  back: number;
  /** Паз под панель: от стенки до стенки. */
  grooveInner: number;
  grooveOuter: number;
  /** Внутренняя и наружная стенки цоколя от оси призмы. */
  inner: number;
  outer: number;
  /** Дно паза над столом и верх цоколя. */
  floor: number;
  collarTop: number;
  /** Низ и верх крышки. */
  lidBottom: number;
  lidTop: number;
  /** Половина длины рельса: сторона цоколя без нахлёста в углу. */
  reach: number;
};

function kaleidoscopeMetrics(
  normalized: LithophaneParams,
): KaleidoscopeMetrics {
  const kaleido = LITHOPHANE_KALEIDOSCOPE;
  const maxThickness = normalized.lithophaneMaxThickness;
  const front = normalized.lithophaneWidth / 2;
  const back = front - maxThickness;
  const grooveInner = back - LITHOPHANE_FIT_GAP_MM;
  const grooveOuter = front + LITHOPHANE_FIT_GAP_MM;
  const outer = grooveOuter + kaleido.wall;
  // Крышка садится на верхние кромки панелей на глубину паза: низ крышки ниже
  // верха панели, поэтому панель входит в её паз, а не упирается в дно.
  const lidBottom =
    kaleido.floor + normalized.lithophaneHeight - kaleido.seatDepth;

  return {
    width: normalized.lithophaneWidth,
    height: normalized.lithophaneHeight,
    maxThickness,
    front,
    back,
    grooveInner,
    grooveOuter,
    inner: grooveInner - kaleido.wall,
    outer,
    floor: kaleido.floor,
    collarTop: kaleido.floor + kaleido.seatDepth,
    lidBottom,
    lidTop: lidBottom + kaleido.lidThickness,
    reach: outer - kaleido.railOverhang,
  };
}


/**
 * Сечение рельса цоколя: паз сверху, стенки по бокам.
 *
 * Паз шире панели на зазор посадки с каждой стороны: панель опускается в него
 * сверху до дна, а бортик на максимальной толщине держит её без качки. Пол между
 * рельсами не залит — призма стоит на столе, и свет свечи выходит вниз.
 */
function kaleidoscopeCollarProfile(
  metrics: KaleidoscopeMetrics,
): StandProfilePoint[] {
  return [
    { y: 0, z: metrics.inner },
    { y: 0, z: metrics.outer },
    { y: metrics.collarTop, z: metrics.outer },
    { y: metrics.collarTop, z: metrics.grooveOuter },
    { y: metrics.floor, z: metrics.grooveOuter },
    { y: metrics.floor, z: metrics.grooveInner },
    { y: metrics.collarTop, z: metrics.grooveInner },
    { y: metrics.collarTop, z: metrics.inner },
  ];
}

/**
 * Сечение рельса крышки: паз снизу.
 *
 * Крышка тонкая (2.5 мм), паз в ней глубиной 2 мм: панель входит в него верхней
 * кромкой, поэтому крышка держится на призме без клея и её можно снять, чтобы
 * поставить свечу.
 */
function kaleidoscopeLidProfile(
  metrics: KaleidoscopeMetrics,
): StandProfilePoint[] {
  const seatTop = metrics.lidBottom + LITHOPHANE_KALEIDOSCOPE.seatDepth;

  return [
    { y: metrics.lidBottom, z: metrics.inner },
    { y: metrics.lidBottom, z: metrics.grooveInner },
    { y: seatTop, z: metrics.grooveInner },
    { y: seatTop, z: metrics.grooveOuter },
    { y: metrics.lidBottom, z: metrics.grooveOuter },
    { y: metrics.lidBottom, z: metrics.outer },
    { y: metrics.lidTop, z: metrics.outer },
    { y: metrics.lidTop, z: metrics.inner },
  ];
}

/**
 * Плита одной грани: рельеф во всю панель, без рамки.
 *
 * Кадров может быть до четырёх (`lithophaneFaceBrightness`), поэтому сетка
 * приходит параметром: одна и та же функция печатает и грань с общим фото, и
 * грань со своим. Толщина и бортик считаются как у плоской панели.
 */
function createKaleidoscopePanelBody(
  normalized: LithophaneParams,
  grid: LithophaneBrightnessGrid,
): BufferGeometry {
  return createReliefBody(
    normalized,
    normalized.lithophaneWidth,
    normalized.lithophaneHeight,
    LITHOPHANE_BORDER_MM,
    0,
    grid,
    null,
  );
}

/**
 * Цоколь калейдоскопа: четыре рельса, пьедестал под источник и четыре спицы.
 *
 * Рельсы пересекаются в углах и вместе с пазами образуют нижнюю обвязку призмы.
 * Пьедестал — полая труба Ø44 с гнездом Ø40 сверху: в нём стоит LED-свеча или
 * чайная, и источник оказывается на середине кадра, а не у пола. Раньше свеча
 * стояла на столе в кольце Ø40, низ граней пересвечивался, а верх уходил в тень.
 * Спицы связывают пьедестал с обвязкой и держат его от качки.
 *
 * Вес — главное: пола нет, труба полая, поэтому цоколь остаётся лёгким, а воздух
 * заходит снизу.
 */
function createKaleidoscopeBaseGeometry(
  normalized: LithophaneParams,
): BufferGeometry {
  const kaleido = LITHOPHANE_KALEIDOSCOPE;
  const metrics = kaleidoscopeMetrics(normalized);
  const profile = kaleidoscopeCollarProfile(metrics);
  const bodies: BufferGeometry[] = [];

  for (let side = 0; side < kaleido.sides; side += 1) {
    const rail = createProfilePrismBody(profile, -metrics.reach, metrics.reach);

    rail.applyMatrix4(kaleidoscopePanelMatrix(side, 0, 0));
    bodies.push(rail);
  }

  // Пьедестал — тело вращения вокруг оси призмы: гнездо на контуре призмы дало бы
  // вырожденные грани, а вращение их не даёт. Профиль — труба с дном: свеча стоит
  // на дне гнезда, снизу полость, поэтому деталь весит вдвое меньше столбика.
  const pedestalFloor = kaleido.pedestalTop - kaleido.pedestalDepth;

  bodies.push(
    createRevolvedBody(
      [
        [0, pedestalFloor] as const,
        [kaleido.pedestalCavity, pedestalFloor] as const,
        [kaleido.pedestalCavity, kaleido.pedestalTop] as const,
        [kaleido.pedestalOuter, kaleido.pedestalTop] as const,
        [kaleido.pedestalOuter, 0] as const,
        [kaleido.pedestalInner, 0] as const,
        [kaleido.pedestalInner, pedestalFloor] as const,
      ],
      0,
      0,
      360,
      baseArcSegments(360),
      false,
    ),
  );

  // Спицы: две вдоль X и две вдоль Z, от пьедестала до внутренней стенки обвязки.
  const spokeStart = kaleido.pedestalOuter - BODY_OVERLAP_MM;
  const spokeEnd = metrics.inner + BODY_OVERLAP_MM;
  const spokeHalf = kaleido.spokeWidth / 2;

  for (const sign of [1, -1]) {
    bodies.push(
      createBoxBody(
        sign > 0 ? spokeStart : -spokeEnd,
        sign > 0 ? spokeEnd : -spokeStart,
        0,
        kaleido.spokeHeight,
        -spokeHalf,
        spokeHalf,
      ),
      createBoxBody(
        -spokeHalf,
        spokeHalf,
        0,
        kaleido.spokeHeight,
        sign > 0 ? spokeStart : -spokeEnd,
        sign > 0 ? spokeEnd : -spokeStart,
      ),
    );
  }

  return mergeBodies(bodies, "цоколя калейдоскопа");
}

/**
 * Крышка калейдоскопа: обвязка с пазом, колпак над свечой и четыре перемычки.
 *
 * Между обвязкой и колпаком остаются четыре широких окна — вентиляционные
 * прорези: горячий воздух свечи уходит вверх, поэтому свеча не гаснет и не
 * коптит. Колпак закрывает пламя сверху, чтобы свет не бил прямо в потолок, а шёл
 * через рельеф панелей. Всё вместе — тонкая деталь: 2.5 мм обвязка и 2 мм колпак.
 */
function createKaleidoscopeLidBody(
  normalized: LithophaneParams,
): BufferGeometry {
  const kaleido = LITHOPHANE_KALEIDOSCOPE;
  const metrics = kaleidoscopeMetrics(normalized);
  const profile = kaleidoscopeLidProfile(metrics);
  const bodies: BufferGeometry[] = [];

  for (let side = 0; side < kaleido.sides; side += 1) {
    const rail = createProfilePrismBody(profile, -metrics.reach, metrics.reach);

    rail.applyMatrix4(kaleidoscopePanelMatrix(side, 0, 0));
    bodies.push(rail);
  }

  const capRadius = kaleido.capDiameter / 2;
  const capBottom = metrics.lidTop - kaleido.capThickness;

  bodies.push(
    createRevolvedBody(
      [
        [0, capBottom] as const,
        [capRadius, capBottom] as const,
        [capRadius, metrics.lidTop] as const,
        [0, metrics.lidTop] as const,
      ],
      0,
      0,
      360,
      baseArcSegments(360),
      false,
    ),
  );

  // Перемычки идут от колпака к обвязке крестом: четыре окна между ними и есть
  // прорези, а колпак держится на них.
  const armStart = capRadius - BODY_OVERLAP_MM;
  const armEnd = metrics.inner + BODY_OVERLAP_MM;
  const armHalf = kaleido.armWidth / 2;
  const armBottom = metrics.lidTop - kaleido.armThickness;

  for (const sign of [1, -1]) {
    bodies.push(
      createBoxBody(
        sign > 0 ? armStart : -armEnd,
        sign > 0 ? armEnd : -armStart,
        armBottom,
        metrics.lidTop,
        -armHalf,
        armHalf,
      ),
      createBoxBody(
        -armHalf,
        armHalf,
        armBottom,
        metrics.lidTop,
        sign > 0 ? armStart : -armEnd,
        sign > 0 ? armEnd : -armStart,
      ),
    );
  }

  return mergeBodies(bodies, "крышки калейдоскопа");
}

/**
 * Четыре панели калейдоскопа: рельеф каждой грани без цоколя и крышки.
 *
 * У каждой грани может быть свой кадр: сетка берётся из `lithophaneFaceBrightness`
 * по номеру грани. Панель чуть уже грани призмы — её торец уходит внутрь соседней
 * (см. матрицу), — а лицевая плоскость встаёт на грань, тыл на `back`, низ на дно
 * паза цоколя. Возвращаются и размеры индексов каждой панели: по ним сборка режет
 * группы материалов.
 */
function createKaleidoscopePanelsGeometry(normalized: LithophaneParams): {
  geometry: BufferGeometry;
  spans: number[];
} {
  const kaleido = LITHOPHANE_KALEIDOSCOPE;
  const metrics = kaleidoscopeMetrics(normalized);
  const faces = lithophaneFaceBrightness(normalized);
  const narrow = (metrics.width - 2 * BODY_OVERLAP_MM) / metrics.width;
  const bodies: BufferGeometry[] = [];
  const spans: number[] = [];

  for (let side = 0; side < kaleido.sides; side += 1) {
    const plate = createKaleidoscopePanelBody(
      normalized,
      faces[side] ?? faces[0],
    );

    plate.applyMatrix4(
      kaleidoscopePanelMatrix(side, metrics.back, metrics.floor, narrow),
    );
    spans.push(plate.getIndex()?.count ?? 0);
    bodies.push(plate);
  }

  return { geometry: mergeBodies(bodies, "панелей калейдоскопа"), spans };
}

/**
 * Собранный калейдоскоп: четыре панели, цоколь и крышка.
 *
 * Панели идут в сетку первыми и каждая — своей группой материалов: у грани
 * может быть свой кадр, и предпросмотр красит их разными текстурами. Цоколь и
 * крышка замыкают группы последним номером.
 */
function createKaleidoscopeGeometry(
  normalized: LithophaneParams,
): BufferGeometry {
  const panels = createKaleidoscopePanelsGeometry(normalized);

  return assignFaceGroups(
    mergeBodies(
      [
        panels.geometry,
        createKaleidoscopeBaseGeometry(normalized),
        createKaleidoscopeLidBody(normalized),
      ],
      "калейдоскопа",
    ),
    panels.spans,
  );
}

/**
 * Подставка отдельной деталью: цоколь калейдоскопа, открытая арка, сплошная
 * ножка или основание.
 *
 * У калейдоскопа база — его собственная часть: панели встают в паз рельсов, а не
 * в наклонную стойку (см. `lithophaneShapeHasBase`). Поэтому сменные подставки с
 * наклоном к нему не применяются. У круглого плафона база тоже своя — круглое
 * основание с кольцевым пазом и стаканом под патрон (см.
 * `createRoundBaseGeometry`), поэтому деталь `stand` возвращает его.
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

  // У плафона база — собственное основание: диск с кольцевым пазом и стаканом
  // под патрон. Панели входят в паз шипом, поэтому деталь `stand` — это диск.
  if (normalized.lithoShape === "round") {
    return createRoundBaseGeometry(normalized);
  }

  // Калейдоскоп держится на собственном цоколе: рельсы по квадрату и пьедестал
  // под свечу.
  if (lithophaneShapeHasBase(normalized.lithoShape)) {
    return createKaleidoscopeBaseGeometry(normalized);
  }

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
 * профиле. Под открытую лампу добавляется держатель за панелью — штанга по столу,
 * две стойки и две скобы (`createArchLampBodies`). Штанга на 2 мм заходит в базу,
 * стойки стоят на ней, скобы надеты на стойки: в собранном файле это один объект,
 * и шва по стыкам нет.
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

  if (light === "socket" || light === "usb_bulb") {
    bodies.push(...createArchLampBodies(light, archBaseBack(shape, light)));
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
 * почти на всю ширину рамки, поэтому панель не качается. Стойка-седло со скобой
 * под USB-лампу и патрон E27 стоит за панелью на штанге и выше ножек не
 * поднимается: свет остаётся открытым с обеих сторон.
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
 * плиту. Круглый плафон отдаёт кольцо панелей, а в сборке — кольцо на круглом
 * основании с пазом и стаканом под патрон (см. `createRoundBaseGeometry`).
 * Калейдоскоп собирается из четырёх панелей на цоколе с полом и
 * крышкой (см. `createKaleidoscopeGeometry`).
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

  // Круглый плафон — кольцо панелей на своём основании. Съёмной рамки у него
  // нет, поэтому детали `relief` и `frame` дают одно и то же кольцо, детали
  // `stand` и `top_cover` — основание со спицами и крышку-козырек, а `all` —
  // собранный абажур: панели, опущенные шипами в паз основания и поднятые в паз
  // крышки. Группы по панелям остаются: в сцене у каждой панели своя карта
  // свечения, а основание и крышка замыкают список материалом крепления.
  if (normalized.lithoShape === "round") {
    if (part === "stand") {
      return markPartGroup(
        createRoundBaseGeometry(normalized),
        LITHOPHANE_DETAIL_GROUP,
      );
    }

    if (part === "top_cover") {
      return markPartGroup(
        createRoundTopCoverGeometry(normalized),
        LITHOPHANE_DETAIL_GROUP,
      );
    }

    const base = lithophaneRoundBaseMetrics(normalized);
    const panels = createRoundPanelsGeometry(normalized, base.panelLift);

    if (part !== "all") {
      return assignFaceGroups(panels.geometry, panels.spans);
    }

    // Крышка садится на верхние шипы панелей: её низ на `visorBottom`, поэтому
    // кольцо, панели и козырёк сходятся в одну сборку без крепежа.
    const cover = createRoundTopCoverGeometry(normalized);

    cover.translate(0, base.visorBottom, 0);
    return assignFaceGroups(
      mergeBodies(
        [panels.geometry, createRoundBaseGeometry(normalized), cover],
        "плафона",
      ),
      panels.spans,
    );
  }

  if (part === "relief" || !normalized.lithoFrame) {
    // У калейдоскопа «рельеф» — это все четыре панели: у каждой грани может быть
    // свой кадр, и печатают их вместе. Группы по граням остаются и здесь: панель
    // без рамки тоже светится своим кадром на каждой стороне.
    if (normalized.lithoShape === "kaleidoscope") {
      const panels = createKaleidoscopePanelsGeometry(normalized);

      return assignFaceGroups(panels.geometry, panels.spans);
    }

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

  // Каретка монорельса печатается отдельно: плита с гнездом патрона, обойма с
  // Т-пазом и козырёк. На рельс рамки она надевается при сборке.
  if (part === "carriage") {
    return markPartGroup(
      createLithophaneCarriageGeometry(normalized),
      LITHOPHANE_DETAIL_GROUP,
    );
  }

  // Задняя крышка короба под LED-панель: отдельная деталь, потому что панель
  // вставляют через тыл короба, а печатать её вместе с коробом нечем — внутри
  // остался бы закрытый объём.
  if (part === "cover") {
    return markPartGroup(
      createLithophaneLedBoxCoverGeometry(normalized),
      LITHOPHANE_DETAIL_GROUP,
    );
  }

  const metrics = lithophaneFrameMetrics(normalized);

  // Калейдоскоп собирается по своей схеме: четыре панели без рамок, цоколь и
  // крышка. Общей ветки сборки для него нет — деталь «stand» у него только
  // цоколь, а плит четыре и у каждой свой кадр.
  if (normalized.lithoShape === "kaleidoscope") {
    return createKaleidoscopeGeometry(normalized);
  }

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

  /*
    Каретку на собранном виде отодвигаем от рамки. В пазу полоза она стоит
    вплотную к рельсу, и слайсер спекает её с рамкой в одну деталь: торец шины
    открыт, а паз занят. Рядом на столе каретка печатается отдельно и остаётся на
    виду в сборке. Низ салазок висит на дне кармана, поэтому деталь опускается до
    стола.
  */
  if (
    lithophaneHasRail(
      normalized.lithoMount,
      normalized.lithoShape,
      normalized.lithoFrame,
    )
  ) {
    const carriage = createLithophaneCarriageGeometry(normalized);

    carriage.computeBoundingBox();
    carriage.translate(
      LITHOPHANE_CARRIAGE_OFFSET_MM,
      -(carriage.boundingBox?.min.y ?? 0),
      0,
    );
    bodies.push(carriage);
  }

  // Задняя крышка короба встаёт в паз на его тылу: на собранном виде короб
  // закрыт, а в списке деталей крышка идёт отдельным файлом. Переносить её не
  // нужно — она построена в плоскостях сборки, как и короб.
  if (
    lithophaneHasLedBox(
      normalized.lithoMount,
      normalized.lithoShape,
      normalized.lithoFrame,
    )
  ) {
    bodies.push(createLithophaneLedBoxCoverGeometry(normalized));
  }

  return assignMaterialGroups(mergeBodies(bodies, "литофана"), reliefIndices);
}

