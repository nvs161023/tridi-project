import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
} from "three";

import {
  normalizeStandParams,
  type StandParams,
} from "@/lib/constructor/params";

/**
 * Геометрия подставки под телефон.
 *
 * Деталь — профиль буквой П: плита на столе, передняя губа и наклонная спинка.
 * Телефон ставится нижней кромкой в жёлоб между губой и спинкой и ложится на
 * спинку экраном к пользователю. Наклон 65° держит центр тяжести над плитой:
 * телефон не опрокидывает подставку ни назад, ни вперёд.
 *
 * Губа собрана из двух стоек с окном посередине. Через окно выходит кабель
 * зарядки, а сами стойки не дают телефону сползти вперёд по наклону. Ширина
 * окна растёт вместе с подставкой, поэтому стойки остаются широкими и на
 * узкой детали.
 *
 * Профиль выдавливается на всю ширину — это одно замкнутое тело. Стойки губ
 * входят в плиту на STAND_JOIN_MM и замкнуты каждая сама по себе, как
 * перегородки коробки: булевых операций в проекте нет, слайсер объединяет
 * пересекающиеся оболочки при печати.
 *
 * Деталь построена Z-вверх, как её ждёт слайсер: стол — плоскость XY, высота
 * идёт по Z, передняя плоскость — на Y = 0. Предпросмотр поворачивает меш так
 * же, как коробку. Печатается подставка стоя, без поддержек: спинка отклонена
 * от вертикали на 15–45°, верхний торец срезан под прямым углом к ней, а
 * стойки губ растут вертикально.
 */

/** Толщина плиты, которая лежит на столе, мм. */
export const STAND_FLOOR_MM = 3;

/** Толщина наклонной спинки, мм. */
const STAND_BACK_MM = 3;

/** Толщина передней губы, мм. */
const STAND_LIP_MM = 4;

/** Высота передней губы над столом, мм. */
const STAND_LIP_HEIGHT_MM = 14;

/** Высота верхней кромки спинки над столом, мм. */
export const STAND_HEIGHT_MM = 100;

/** Минимальная ширина окна под кабель в губе, мм. */
export const STAND_CABLE_WINDOW_MM = 24;

/** Запас к глубине жёлоба на чехол и разъём, мм. */
const STAND_TROUGH_MARGIN_MM = 6;

/** Какую долю ширины забирает окно сверх минимума. */
const STAND_WINDOW_SHARE = 0.34;

/** Насколько стойки губ входят в плиту, мм. */
const STAND_JOIN_MM = 0.4;

type Point3 = readonly [number, number, number];

/** Точка профиля: глубина от передней плоскости и высота над столом, мм. */
type ProfilePoint = readonly [number, number];

/**
 * Добавляет выпуклый четырёхугольник двумя треугольниками.
 *
 * Обход вершин задаётся по периметру, а `normal` говорит, куда должна смотреть
 * лицевая сторона. Если векторное произведение смотрит в другую сторону,
 * порядок разворачивается целиком — иначе один из треугольников лёг бы с
 * нормалью внутрь и объём перестал бы сходиться.
 */
function addOrientedQuad(
  positions: number[],
  a: Point3,
  b: Point3,
  c: Point3,
  d: Point3,
  normal: Point3,
): void {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const flipped = nx * normal[0] + ny * normal[1] + nz * normal[2] < 0;
  const second = flipped ? d : b;
  const fourth = flipped ? b : d;

  positions.push(...a, ...second, ...c, ...a, ...c, ...fourth);
}

/**
 * Замкнутый прямоугольный брусок.
 *
 * Из брусков собраны стойки передней губы: все шесть граней смотрят наружу,
 * поэтому брусок можно безопасно пересекать с плитой.
 */
function addBox(
  positions: number[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): void {
  addOrientedQuad(
    positions,
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y1, z0],
    [x0, y1, z0],
    [0, 0, -1],
  );
  addOrientedQuad(
    positions,
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
    [0, 0, 1],
  );
  addOrientedQuad(
    positions,
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y0, z1],
    [x0, y0, z1],
    [0, -1, 0],
  );
  addOrientedQuad(
    positions,
    [x1, y0, z0],
    [x1, y1, z0],
    [x1, y1, z1],
    [x1, y0, z1],
    [1, 0, 0],
  );
  addOrientedQuad(
    positions,
    [x1, y1, z0],
    [x0, y1, z0],
    [x0, y1, z1],
    [x1, y1, z1],
    [0, 1, 0],
  );
  addOrientedQuad(
    positions,
    [x0, y1, z0],
    [x0, y0, z0],
    [x0, y0, z1],
    [x0, y1, z1],
    [-1, 0, 0],
  );
}
/**
 * Профиль детали: (u, v) — глубина от передней плоскости и высота над столом.
 *
 * Контур идёт по дну вперёд, поднимается по внешней стороне спинки, срезает
 * верхний торец под прямым углом к спинке и возвращается по внутренней стороне
 * вниз в жёлоб. Затем жёлоб идёт вперёд до передней плоскости и замыкается по
 * дну.
 *
 * Жёлоб начинается за губой на горизонтальной проекции дна телефона: телефон
 * стоит наклонно, и его нижняя грань занимает по глубине thickness·sin угла.
 * Поэтому нижнее ребро телефона опускается в угол между плитой и спинкой, а
 * переднее ребро оказывается у самой губы — пустой плиты перед телефоном нет.
 * Запас STAND_TROUGH_MARGIN_MM оставляет место чехлу и разъёму кабеля.
 *
 * Верх срезан так, что внешняя сторона спинки доходит до STAND_HEIGHT_MM — по
 * этой высоте и считается наклон.
 */
function standProfile(angleDeg: number, thickness: number): ProfilePoint[] {
  const angle = (angleDeg * Math.PI) / 180;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const trough = thickness * sin + STAND_TROUGH_MARGIN_MM;
  const foot = STAND_LIP_MM + trough;
  const back = foot + STAND_BACK_MM * sin;
  const run = (STAND_HEIGHT_MM - STAND_FLOOR_MM) / sin;
  const top = foot + run * cos;

  return [
    [0, 0],
    [back, 0],
    [back, STAND_FLOOR_MM - STAND_BACK_MM * cos],
    [top + STAND_BACK_MM * sin, STAND_HEIGHT_MM - STAND_BACK_MM * cos],
    [top, STAND_HEIGHT_MM],
    [foot, STAND_FLOOR_MM],
    [0, STAND_FLOOR_MM],
  ];
}

/**
 * Выдавливает замкнутый профиль по ширине детали.
 *
 * Профиль строится в плоскости XY и выдавливается по Z: (u, v, w) — глубина,
 * высота, ширина. Для STL нужна высота по Z, поэтому оси переставляются
 * циклом (x, y, z) → (z, x, y): определитель такой перестановки +1, обход
 * граней не переворачивается, а сетка остаётся замкнутой.
 */
function addProfile(
  positions: number[],
  points: readonly ProfilePoint[],
  from: number,
  to: number,
): void {
  const shape = new Shape();

  points.forEach(([u, v], index) => {
    if (index === 0) {
      shape.moveTo(u, v);
    } else {
      shape.lineTo(u, v);
    }
  });

  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
    depth: to - from,
  });
  const position = geometry.getAttribute("position");

  for (let index = 0; index < position.count; index += 1) {
    positions.push(
      position.getZ(index) + from,
      position.getX(index),
      position.getY(index),
    );
  }

  geometry.dispose();
}

/**
 * Стойки передней губы с окном под кабель.
 *
 * Стойки стоят на плите и входят в неё на STAND_JOIN_MM, а спереди отступают
 * от передней плоскости на тот же размер: иначе их лицевые грани легли бы в
 * одну плоскость с гранью плиты, и слайсер решал бы, где внутри, а где
 * снаружи. Отступ 0.4 мм на глаз не виден и даёт ровную ступеньку.
 */
function addLipPosts(positions: number[], width: number, shift: number): void {
  const window = Math.max(STAND_CABLE_WINDOW_MM, width * STAND_WINDOW_SHARE);
  const front = shift + STAND_JOIN_MM;
  const back = shift + STAND_LIP_MM;
  const bottom = STAND_FLOOR_MM - STAND_JOIN_MM;

  addBox(
    positions,
    -width / 2,
    -window / 2,
    front,
    back,
    bottom,
    STAND_LIP_HEIGHT_MM,
  );
  addBox(
    positions,
    window / 2,
    width / 2,
    front,
    back,
    bottom,
    STAND_LIP_HEIGHT_MM,
  );
}

/**
 * Собирает подставку в одну неиндексированную сетку.
 *
 * Деталь центрирована в плане: середина плиты по глубине и по ширине лежит в
 * нуле, так камера предпросмотра и контактная тень ставят её по центру сцены.
 * Высота считается от стола, поэтому печатать можно без сдвига по Z.
 */
export function createStandGeometry(
  params: Partial<StandParams>,
): BufferGeometry {
  const normalized = normalizeStandParams(params);
  const profile = standProfile(
    normalized.standAngle,
    normalized.phoneThickness,
  );
  const depth = Math.max(...profile.map(([u]) => u));
  const shift = -depth / 2;
  const positions: number[] = [];

  addProfile(
    positions,
    profile.map(([u, v]) => [u + shift, v] as const),
    -normalized.standWidth / 2,
    normalized.standWidth / 2,
  );
  addLipPosts(positions, normalized.standWidth, shift);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

