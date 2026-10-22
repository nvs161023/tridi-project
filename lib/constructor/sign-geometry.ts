import {
  BufferGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
  ShapeGeometry,
  Vector2,
} from "three";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { KEYCHAIN_FONT_URL } from "@/lib/constructor/keychain-geometry";
import {
  listSignBlocks,
  normalizeSignParams,
  type SignFont,
  type SignParams,
  type SignPart,
} from "@/lib/constructor/params";

/**
 * Геометрия вывески: блоки по несколько букв, каждый — лицо и крышка.
 *
 * Надпись делится на блоки по signBlockSize букв (listSignBlocks), и каждый
 * блок печатается двумя деталями:
 *   face  — полые буквы, соединённые рейкой 3 мм, с шипом справа и пазом слева;
 *   cover — крышка 2 мм по контуру каждой буквы с шипом по краю и отверстием
 *           под провод, детали блока связаны общей планкой.
 *
 * Сборка герметична: на заднем торце стенки каждой буквы идёт паз до 2 × 1.5 мм,
 * в него входит шип 1.4 мм высотой на краю крышки. Ширина шипа на 0.2 мм
 * меньше паза, глубина — на 0.1 мм: крышка садится без заклинивания, а камера
 * под ленту остаётся закрытой. Шип повторяет и внешний контур буквы, и контуры
 * её отверстий. У стенки 2 мм паз сужается до 1.2 мм, поэтому шип выходит
 * 1.0 мм: размеры считаются от реальной ширины паза. Плиты соседних блоков
 * стоят с зазором SIGN_BLOCK_JOINT_MM, а шип одного входит в паз другого с
 * натягом SIGN_PIN_FIT_MM. Камеры открыты со стороны крышки, поэтому лента
 * переходит из блока в блок за плитами, и канала на стыке не нужно.
 *
 * Буква построена в плоскости XY: низ на Y = 0, лицо смотрит в +Z, толщина идёт
 * от 0 до signDepth, лицо — на z = signDepth. Печатается деталь лицом вниз,
 * поэтому ни поворот в слайсере, ни поддержки не нужны.
 *
 * Устройство буквы: сплошное лицо SIGN_LETTER_FRONT_MM, по контуру стенка
 * SIGN_LETTER_WALL_MM и открытая сзади камера под светодиодную ленту. Лицо
 * тонкое, поэтому свет диффузно проходит сквозь него — как у литофана.
 *
 * Булевых операций в проекте нет, поэтому каждая оболочка собирается из
 * пересекающихся замкнутых тел: пластина лица на всю толщину, стенка с пазом
 * (нижний пояс и две губки паза), стенки вокруг отверстий буквы. Каждое тело
 * watertight, а слайсер объединяет их при печати — так же устроен брелок с
 * именем. Рейка, шип и крышка приходят в ту же сетку отдельными телами:
 * они входят в буквы и друг в друга, но замкнутость каждого тела не нарушают.
 *
 * Если штрих буквы тоньше, чем нужно камере, буква печатается сплошной:
 * контур просто не поджимается, паза и шипа у такой буквы нет. Условие одно —
 * камера должна вмещать ленту шириной signChannelWidth, иначе внутри буквы
 * нечего освещать.
 */

/** Публичные пути шрифтов: те же JSON, что грузит предпросмотр и сервер. */
export const SIGN_FONT_URLS = {
  "sans-bold": KEYCHAIN_FONT_URL,
  sans: "/fonts/roboto-regular.typeface.json",
  serif: "/fonts/pt-serif-bold.typeface.json",
} as const satisfies Record<SignFont, string>;

/** Предельная ширина строки: длинная надпись упирается в неё и мельчает. */
export const SIGN_MAX_WIDTH_MM = 800;

/** Толщина лица буквы, мм: свет проходит, но слой не рвётся. */
export const SIGN_LETTER_FRONT_MM = 2;

/**
 * Толщина стенки между контуром буквы и камерой, мм.
 *
 * 2 мм — нижняя граница диапазона 2–3 мм: у Roboto Bold кегля 60 штрих около
 * 12 мм, и только такая стенка оставляет камеру в 8 мм под ленту. Паз при этом
 * сужается до 1.2 мм, по 0.4 мм губки с каждой стороны — SIGN_GROOVE_MIN_LIP_MM.
 * Толще стенку делать нельзя, иначе у типового кегля камера не вмещает ленту и
 * буква уходит в сплошную.
 */
export const SIGN_LETTER_WALL_MM = 2;

/** Глубина паза на заднем торце стенки, мм. */
export const SIGN_GROOVE_DEPTH_MM = 1.5;

/** Ширина паза по нормали к контуру, мм. */
export const SIGN_GROOVE_WIDTH_MM = 2;

/** Предельная ширина шипа крышки, мм: шире паза он всё равно не выйдет. */
export const SIGN_COVER_TENON_WIDTH_MM = 1.8;

/** Высота шипа крышки, мм: 0.1 мм не доходит до дна паза. */
export const SIGN_COVER_TENON_HEIGHT_MM = 1.4;

/** Зазор между шипом и пазом по нормали и по глубине, мм. */
export const SIGN_COVER_TENON_CLEARANCE_MM = 0.1;

/** Диаметр отверстия под провод в крышке, мм: хватает на два провода ленты. */
const SIGN_COVER_WIRE_HOLE_MM = 4;

/** Меньший диаметр, если широкое отверстие не помещается в штрих, мм. */
const SIGN_COVER_WIRE_HOLE_MIN_MM = 3;

/** Минимальная глубина камеры, мм: мельче — буква печатается сплошной. */
const SIGN_LETTER_MIN_CHAMBER_MM = 3;

/** Насколько стенки входят в лицо, мм: перекрытие надёжнее стыка встык. */
const SIGN_LETTER_EMBED_MM = 0.2;

/** Зазор между плитами соседних блоков при сборке, мм. */
export const SIGN_BLOCK_JOINT_MM = 3;

/** Боковой запас плиты за крайними буквами, мм: там живут шип и паз. */
const SIGN_BLOCK_SIDE_MM = 6;

/** Минимальная ширина плиты блока, мм: иначе паз не помещается. */
const SIGN_BLOCK_MIN_WIDTH_MM = 24;

/** Толщина плиты под буквами, мм. */
const SIGN_BASE_PLATE_MM = 3;

/** Насколько плита опускается ниже нуля, мм: перекрывает вылет круглых букв. */
const SIGN_BASE_BOTTOM_MM = 1;

/** Высота рейки без общего основания, мм. */
const SIGN_BASE_RAIL_MIN_HEIGHT_MM = 10;

/** Высота плиты общего основания, мм. */
const SIGN_BASE_MOUNT_MIN_HEIGHT_MM = 14;

/** Длина шипа, мм: половина уходит в паз соседа. */
const SIGN_PIN_LENGTH_MM = 8;

/** Натяг шипа в пазу на сторону, мм: детали держатся без клея. */
const SIGN_PIN_FIT_MM = 0.15;

/** Толщина крышки, мм: плоская пластина по контуру буквы. */
const SIGN_COVER_PLATE_MM = 2;

/** Насколько шип и планка входят в крышку, мм: перекрытие вместо стыка. */
const SIGN_COVER_WELD_MM = 0.2;

/** Полость буквы: контур камеры, отверстия и признак готового паза. */
type SignCavity = {
  outer: Vector2[];
  holes: Vector2[][];
  /** Удалось ли вырезать паз: если нет, шипа у крышки этой буквы не будет. */
  grooved: boolean;
};

/** Фигура глифа: контур буквы, её отверстия и полость под ленту. */
type SignLetterShape = {
  outline: Vector2[];
  holes: Vector2[][];
  cavity: SignCavity | null;
};

/** Глиф: тела буквы в координатах шрифта и фигуры для крышки. */
type SignGlyph = {
  geometry: BufferGeometry;
  shapes: SignLetterShape[];
};

/** Сегменты кривых шрифта: восьми хватает для плавных дуг при печати. */
const SIGN_CURVE_SEGMENTS = 8;

/** Предел острия при смещении контура: длиннее — срез вместо клина. */
const SIGN_MITER_LIMIT = 4;

/** Узлов сетки при замере ширины штриха: точность около миллиметра. */
const SIGN_WIDTH_PROBE_STEPS = 16;

/** Допуск сравнения точек контура, мм. */
const SIGN_EPSILON = 0.0001;

/** Замкнутый контур без повторяющихся соседних точек. */
function cleanContour(points: Vector2[]): Vector2[] {
  const result: Vector2[] = [];

  for (const point of points) {
    const last = result[result.length - 1];

    if (!last || last.distanceTo(point) > SIGN_EPSILON) {
      result.push(point.clone());
    }
  }

  while (
    result.length > 1 &&
    result[0].distanceTo(result[result.length - 1]) <= SIGN_EPSILON
  ) {
    result.pop();
  }

  return result;
}

/** Площадь контура со знаком: по ней определяется направление обхода. */
function signedArea(points: Vector2[]): number {
  let total = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];

    total += current.x * next.y - next.x * current.y;
  }

  return total / 2;
}

/**
 * Смещение замкнутого контура.
 *
 * Положительное расстояние поджимает область внутрь, отрицательное расширяет
 * её наружу: так отверстие буквы превращается в границу камеры. Направление
 * обхода учитывается само, поэтому вызывающему не нужно знать, как шрифт
 * нарисовал контур. В острых углах точка уходит по биссектрисе, но не дальше
 * SIGN_MITER_LIMIT: иначе игла глифа вытянула бы стенку в бесконечность.
 *
 * null означает, что контур вырожден или сгиб острее допустимого — буква
 * останется сплошной.
 */
function offsetContour(points: Vector2[], distance: number): Vector2[] | null {
  const count = points.length;

  if (count < 3) {
    return null;
  }

  const area = signedArea(points);

  if (Math.abs(area) < SIGN_EPSILON) {
    return null;
  }

  const orientation = area > 0 ? 1 : -1;
  const result: Vector2[] = [];

  for (let index = 0; index < count; index += 1) {
    const previous = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    const before = current.clone().sub(previous);
    const after = next.clone().sub(current);

    if (before.length() < SIGN_EPSILON || after.length() < SIGN_EPSILON) {
      continue;
    }

    before.normalize();
    after.normalize();

    const normalBefore = new Vector2(-before.y, before.x).multiplyScalar(
      orientation,
    );
    const normalAfter = new Vector2(-after.y, after.x).multiplyScalar(
      orientation,
    );
    const miter = normalBefore.clone().add(normalAfter);
    const length = miter.length();

    if (length < SIGN_EPSILON) {
      result.push(current.clone().addScaledVector(normalBefore, distance));
      continue;
    }

    miter.divideScalar(length);

    const cosHalf = miter.dot(normalBefore);

    if (cosHalf <= 1e-3) {
      return null;
    }

    const miterLength = distance / cosHalf;

    if (Math.abs(miterLength) > Math.abs(distance) * SIGN_MITER_LIMIT) {
      result.push(current.clone().addScaledVector(normalBefore, distance));
      result.push(current.clone().addScaledVector(normalAfter, distance));
      continue;
    }

    result.push(current.clone().addScaledVector(miter, miterLength));
  }

  return result.length >= 3 ? result : null;
}

/** Знак векторного произведения: по какую сторону отрезка лежит точка. */
function cross(origin: Vector2, a: Vector2, b: Vector2): number {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

/** Пересекаются ли отрезки насквозь: касание концов пересечением не считается. */
function segmentsCross(
  a1: Vector2,
  a2: Vector2,
  b1: Vector2,
  b2: Vector2,
): boolean {
  const first = cross(a1, a2, b1);
  const second = cross(a1, a2, b2);
  const third = cross(b1, b2, a1);
  const fourth = cross(b1, b2, a2);

  return first * second < 0 && third * fourth < 0;
}

/**
 * Простой ли контур.
 *
 * Поджатый внутрь контур узкого штриха может сам себя пересечь: тогда тело
 * стенки вывернется наизнанку и слайсер получит мусор. Такой контур
 * отбраковывается — буква печатается сплошной.
 */
function isSimpleContour(points: Vector2[]): boolean {
  const count = points.length;

  for (let index = 0; index < count; index += 1) {
    const a1 = points[index];
    const a2 = points[(index + 1) % count];

    for (let other = index + 1; other < count; other += 1) {
      // Соседние отрезки делят вершину: их пересечение ничего не значит.
      if (other === index || (other + 1) % count === index) {
        continue;
      }

      if (segmentsCross(a1, a2, points[other], points[(other + 1) % count])) {
        return false;
      }
    }
  }

  return true;
}

/** Точка внутри замкнутого контура: трассировка луча по чётности пересечений. */
function isInsideContour(point: Vector2, points: Vector2[]): boolean {
  let inside = false;

  for (
    let index = 0, previous = points.length - 1;
    index < points.length;
    previous = index, index += 1
  ) {
    const a = points[index];
    const b = points[previous];

    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/** Расстояние от точки до отрезка, мм. */
function distanceToSegment(
  x: number,
  y: number,
  a: Vector2,
  b: Vector2,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq < 1e-9) {
    return Math.hypot(x - a.x, y - a.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSq),
  );

  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
}

/**
 * Ширина самого широкого места области: диаметр наибольшей окружности, которую
 * можно вписать между контурами.
 *
 * Точного ответа для многоугольника без диаграммы Вороного не получить, но для
 * решения «камера вмещает ленту» хватает сетки узлов. У «Т», «Р» и «И»
 * результат совпадает с шириной штриха, у «О» — с шириной кольца, поэтому по
 * нему и решается, полая буква или сплошная.
 */
function maxInscribedWidth(outer: Vector2[], holes: Vector2[][]): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of outer) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  if (!Number.isFinite(minX) || maxX - minX < SIGN_EPSILON || maxY - minY < SIGN_EPSILON) {
    return 0;
  }

  const contours = [outer, ...holes];
  let radius = 0;

  for (let column = 0; column <= SIGN_WIDTH_PROBE_STEPS; column += 1) {
    for (let row = 0; row <= SIGN_WIDTH_PROBE_STEPS; row += 1) {
      const x = minX + ((maxX - minX) * column) / SIGN_WIDTH_PROBE_STEPS;
      const y = minY + ((maxY - minY) * row) / SIGN_WIDTH_PROBE_STEPS;
      const point = new Vector2(x, y);

      if (!isInsideContour(point, outer)) {
        continue;
      }

      if (holes.some((hole) => isInsideContour(point, hole))) {
        continue;
      }

      let nearest = Infinity;

      for (const contour of contours) {
        for (let index = 0; index < contour.length; index += 1) {
          nearest = Math.min(
            nearest,
            distanceToSegment(
              x,
              y,
              contour[index],
              contour[(index + 1) % contour.length],
            ),
          );
        }
      }

      radius = Math.max(radius, nearest);
    }
  }

  return radius * 2;
}

/** Первая точка контура — moveTo, остальные — lineTo. */
function appendPoints(path: Path, points: Vector2[]): void {
  points.forEach((point, index) => {
    if (index === 0) {
      path.moveTo(point.x, point.y);
    } else {
      path.lineTo(point.x, point.y);
    }
  });
}

/**
 * Контур с нужным направлением обхода: true — против часовой стрелки.
 *
 * Возвращается исходный массив, если обход уже верный, иначе его копия:
 * вызывающий код не должен зависеть от того, как шрифт нарисовал глиф.
 */
function orientContour(points: Vector2[], counterClockwise: boolean): Vector2[] {
  return signedArea(points) > 0 === counterClockwise ? points : [...points].reverse();
}

/**
 * Замкнутая область с отверстиями, выдавленная на depth от z.
 *
 * Контуры уже разбиты на точки, поэтому кривых в шейпе нет: экструзия получается
 * точной по контуру глифа и не зависит от curveSegments.
 *
 * Обход контуров приводится к виду, который ждёт ExtrudeGeometry: внешний — по
 * часовой стрелке, отверстия — против. Библиотека сама разворачивает внешний
 * контур, но отверстия правит только в этом же случае: если внешний контур уже
 * по часовой стрелке, отверстие с тем же обходом остаётся как есть. Earcut
 * внутри нормализует его сам, поэтому крышки выходят с одним обходом, а стенки
 * вокруг отверстия — с другим, и в сетке появляются незамкнутые рёбра. Явная
 * ориентация убирает эту зависимость от направления обхода в шрифте.
 *
 * closePath() здесь не вызывается: он дописывает замыкающий отрезок, и
 * extractPoints() возвращает контур, последняя точка которого повторяет первую.
 * ShapeUtils.triangulateShape() убирает такую точку из контура и из отверстий
 * уже после того, как ExtrudeGeometry скопировала их в общий список вершин
 * крышек, — индексы отверстий съезжают. Полигон замыкается сам: Earcut считает
 * контур замкнутым, а стенки обходят его по кругу.
 */
function extrudeRegion(
  outer: Vector2[],
  holes: Vector2[][],
  depth: number,
  z: number,
): BufferGeometry {
  const shape = new Shape();
  appendPoints(shape, orientContour(outer, false));

  for (const hole of holes) {
    const path = new Path();
    appendPoints(path, orientContour(hole, true));
    shape.holes.push(path);
  }

  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: SIGN_CURVE_SEGMENTS,
    depth,
    steps: 1,
  });

  if (z !== 0) {
    geometry.translate(0, 0, z);
  }

  return geometry;
}

/** Минимальная губка паза, мм: тоньше слайсер не напечатает. */
const SIGN_GROOVE_MIN_LIP_MM = 0.4;

/**
 * Стенка с пазом на заднем торце.
 *
 * Паз не вырезается булевой операцией: стенка делится на нижний пояс и две
 * губки, между которыми на глубину grooveDepth остаётся пустота. Губки
 * перекрываются с нижним поясом на SIGN_LETTER_EMBED_MM, поэтому после печати
 * это монолит. null — смещение губок не пережило острых углов: стенка останется
 * сплошной, без паза, и крышка этой буквы будет без шипа.
 */
function createGroovedWallBodies(
  wallOuter: Vector2[],
  wallInner: Vector2[],
  wallDepth: number,
  grooveDepth: number,
  grooveWidth: number,
): BufferGeometry[] | null {
  const lip = (SIGN_LETTER_WALL_MM - grooveWidth) / 2;

  if (lip < SIGN_GROOVE_MIN_LIP_MM) {
    return null;
  }

  const outerLipInner = offsetContour(wallOuter, lip);
  const innerLipOuter = offsetContour(wallInner, -lip);

  if (
    !outerLipInner ||
    !innerLipOuter ||
    !isSimpleContour(outerLipInner) ||
    !isSimpleContour(innerLipOuter)
  ) {
    return null;
  }

  // Пояс начинается ровно на дне паза: иначе он съедал бы часть глубины, и шип
  // крышки упирался бы в него вместо зазора. С губками пояс перекрывается уже
  // после дна — там стык и зарастает.
  const lipDepth = grooveDepth + SIGN_LETTER_EMBED_MM;
  const bodyDepth = wallDepth - grooveDepth;

  if (bodyDepth <= lipDepth) {
    return null;
  }

  return [
    extrudeRegion(wallOuter, [wallInner], bodyDepth, grooveDepth),
    extrudeRegion(wallOuter, [outerLipInner], lipDepth, 0),
    extrudeRegion(innerLipOuter, [wallInner], lipDepth, 0),
  ];
}

/**
 * Тела одной фигуры глифа и её полости.
 *
 * Сначала пробуем полую букву. Если стенка или камера не помещаются в штрих,
 * возвращается одно сплошное тело: буква остаётся печатаемой, просто без ленты
 * внутри и без паза под шип крышки. У «О» и «В» фигур несколько — отверстия
 * приходят отдельными контурами внутри одной фигуры, так что буква собирается
 * из всех.
 */
function createShapeBodies(
  shape: Shape,
  depth: number,
  channelWidth: number,
): { bodies: BufferGeometry[]; letter: SignLetterShape } {
  const { shape: shapePoints, holes: holePoints } =
    shape.extractPoints(SIGN_CURVE_SEGMENTS);
  const outer = cleanContour(shapePoints);

  if (outer.length < 3) {
    return {
      bodies: [],
      letter: { outline: outer, holes: [], cavity: null },
    };
  }

  const holes = holePoints
    .map((hole) => cleanContour(hole))
    .filter((hole) => hole.length >= 3);
  const hollow = createHollowBodies(outer, holes, depth, channelWidth);

  if (!hollow) {
    return {
      bodies: [extrudeRegion(outer, holes, depth, 0)],
      letter: { outline: outer, holes, cavity: null },
    };
  }

  return { bodies: hollow.bodies, letter: { outline: outer, holes, cavity: hollow.cavity } };
}

/**
 * Оболочка полой буквы: лицо, стенка с пазом и стенки вокруг отверстий.
 *
 * Тела перекрываются на SIGN_LETTER_EMBED_MM — стык встык слайсер иногда
 * оставляет щель, а перекрытие даёт монолит после печати.
 *
 * Заодно возвращается полость: её контур нужен крышке, шип которой входит в
 * паз. null означает, что штрих не вмещает стенку с камерой.
 */
function createHollowBodies(
  outer: Vector2[],
  holes: Vector2[][],
  depth: number,
  channelWidth: number,
): { bodies: BufferGeometry[]; cavity: SignCavity } | null {
  const front = SIGN_LETTER_FRONT_MM;
  const chamberDepth = depth - front;

  if (chamberDepth < SIGN_LETTER_MIN_CHAMBER_MM) {
    return null;
  }

  const wall = SIGN_LETTER_WALL_MM;
  const inset = offsetContour(outer, wall);

  if (!inset || !isSimpleContour(inset)) {
    return null;
  }

  // Внутренний контур обязан остаться в букве и не залезть в её отверстия:
  // иначе стенка исчезнет, а лицо останется висеть на нулевой толщине.
  const staysInsideShape = inset.every(
    (point) =>
      isInsideContour(point, outer) &&
      !holes.some((hole) => isInsideContour(point, hole)),
  );

  if (!staysInsideShape) {
    return null;
  }

  // Отверстие расширяется наружу: между ним и камерой тоже нужна стенка.
  const expandedHoles: Vector2[][] = [];

  for (let index = 0; index < holes.length; index += 1) {
    const expanded = offsetContour(holes[index], -wall);

    if (!expanded || !isSimpleContour(expanded)) {
      return null;
    }

    const fitsChamber = expanded.every(
      (point) =>
        isInsideContour(point, inset) &&
        holes.every(
          (hole, holeIndex) =>
            holeIndex === index || !isInsideContour(point, hole),
        ),
    );

    if (!fitsChamber) {
      return null;
    }

    expandedHoles.push(expanded);
  }

  // Камера у «О» ровно по ширине ленты: допуск убирает ошибку округления
  // смещения контура, иначе буква без причины уходила бы в сплошную.
  if (maxInscribedWidth(inset, expandedHoles) < channelWidth - SIGN_EPSILON) {
    return null;
  }

  const grooveWidth = Math.min(
    SIGN_GROOVE_WIDTH_MM,
    wall - 2 * SIGN_GROOVE_MIN_LIP_MM,
  );
  const wallDepth = chamberDepth + SIGN_LETTER_EMBED_MM;
  const bodies: BufferGeometry[] = [
    extrudeRegion(outer, holes, front, chamberDepth),
  ];
  const outerWall = createGroovedWallBodies(
    outer,
    inset,
    wallDepth,
    SIGN_GROOVE_DEPTH_MM,
    grooveWidth,
  );
  let grooved = outerWall !== null;

  if (outerWall) {
    bodies.push(...outerWall);
  } else {
    bodies.push(extrudeRegion(outer, [inset], wallDepth, 0));
  }

  for (let index = 0; index < holes.length; index += 1) {
    const holeWall = grooved
      ? createGroovedWallBodies(
          expandedHoles[index],
          holes[index],
          wallDepth,
          SIGN_GROOVE_DEPTH_MM,
          grooveWidth,
        )
      : null;

    if (holeWall) {
      bodies.push(...holeWall);
    } else {
      grooved = false;
      bodies.push(
        extrudeRegion(expandedHoles[index], [holes[index]], wallDepth, 0),
      );
    }
  }

  return {
    bodies,
    cavity: { outer: inset, holes: expandedHoles, grooved },
  };
}

/** Объединение тел в одну сетку; исходные сетки освобождаются. */
function mergeBodies(bodies: BufferGeometry[]): BufferGeometry | null {
  if (bodies.length === 0) {
    return null;
  }

  if (bodies.length === 1) {
    return bodies[0];
  }

  const merged = mergeGeometries(bodies);

  for (const body of bodies) {
    body.dispose();
  }

  return merged;
}

/** Буква целиком: все фигуры глифа в одной сетке, в координатах шрифта. */
function createGlyph(
  char: string,
  size: number,
  font: Font,
  depth: number,
  channelWidth: number,
): SignGlyph | null {
  const shapes = font.generateShapes(char, size);

  if (shapes.length === 0) {
    return null;
  }

  const bodies: BufferGeometry[] = [];
  const letters: SignLetterShape[] = [];

  for (const shape of shapes) {
    const created = createShapeBodies(shape, depth, channelWidth);

    bodies.push(...created.bodies);

    if (created.letter.outline.length >= 3) {
      letters.push(created.letter);
    }
  }

  const geometry = mergeBodies(bodies);

  return geometry ? { geometry, shapes: letters } : null;
}

/**
 * Пустая сетка: шрифт ещё грузится или надпись пуста.
 *
 * Атрибута position нет вовсе — индексный буфер нулевой длины three.js принял
 * бы за ошибку, а без атрибута сетка просто не рисуется.
 */
function createEmptyGeometry(): BufferGeometry {
  return new BufferGeometry();
}

/** Ставит сетку на стол и центрирует по X: в таком виде деталь идёт в STL. */
function placeOnBed(geometry: BufferGeometry): BufferGeometry {
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (box) {
    geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, 0);
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/** Ширина глифа при кегле 1: контуры без выдавливания, замер дешёвый. */
function measureGlyphWidth(char: string, font: Font): number {
  const shapes = font.generateShapes(char, 1);

  if (shapes.length === 0) {
    return 0;
  }

  const probe = new ShapeGeometry(shapes);
  probe.computeBoundingBox();

  const box = probe.boundingBox;
  const width = box ? box.max.x - box.min.x : 0;

  probe.dispose();

  return width;
}

/** Блок надписи: буквы и плита в координатах строки, мм. */
type SignBlock = {
  /** Номер блока с нуля: он же blockIndex в API. */
  index: number;
  /** Левая граница плиты в координатах строки. */
  left: number;
  /** Ширина плиты без шипа. */
  width: number;
  /** Высота плиты под буквами. */
  plateHeight: number;
  /** Есть ли сосед слева: у первого блока паза нет. */
  hasPrev: boolean;
  /** Есть ли сосед справа: у последнего блока нет шипа. */
  hasNext: boolean;
  /** Буквы блока: символ и позиция левого края в координатах строки. */
  letters: { index: number; char: string; left: number }[];
};

/**
 * Высота плиты под буквами блока, мм.
 *
 * С общим основанием плита — видимый постамент, без него — узкая рейка, которая
 * держит шип и канал. Обе не выше трети кегля: иначе плита переросла бы
 * короткие буквы вроде «Г» и закрыла камеру.
 */
function blockPlateHeight(params: SignParams, size: number): number {
  const minHeight = params.signBaseMount
    ? SIGN_BASE_MOUNT_MIN_HEIGHT_MM
    : SIGN_BASE_RAIL_MIN_HEIGHT_MM;
  const ratio = params.signBaseMount ? 0.3 : 0.18;

  return Math.max(minHeight, Math.min(48, Math.round(size * ratio)));
}

/**
 * Кегль и раскладка блоков.
 *
 * Зазор между буквами задан в миллиметрах и с кеглем не масштабируется, а
 * плиты, шипы и зазоры стыка от кегля не зависят вовсе. Поэтому ширина строки
 * считается функцией кегля, а сам кегль подбирается итеративно: каждый шаг
 * уменьшает его во столько раз, во сколько строка шире SIGN_MAX_WIDTH_MM.
 * Четырёх шагов хватает даже самому узкому шрифту.
 *
 * Плиты блоков идут подряд с зазором SIGN_BLOCK_JOINT_MM. Если букв в блоке
 * мало и плита вышла бы уже SIGN_BLOCK_MIN_WIDTH_MM, буквы встают по её
 * центру: шипу и пазу нужно место.
 */
function layoutSignBlocks(
  params: SignParams,
  letters: { index: number; char: string }[],
  font: Font,
): { size: number; blocks: SignBlock[]; width: number } {
  const cache = new Map<string, number>();
  const unitWidth = (char: string): number => {
    const cached = cache.get(char);

    if (cached !== undefined) {
      return cached;
    }

    const width = measureGlyphWidth(char, font);

    cache.set(char, width);

    return width;
  };
  const blockSize = Math.max(1, Math.round(params.signBlockSize));
  const blockCount = Math.max(1, Math.ceil(letters.length / blockSize));

  const layout = (size: number): { blocks: SignBlock[]; width: number } => {
    const blocks: SignBlock[] = [];
    let cursor = 0;

    for (let start = 0; start < letters.length; start += blockSize) {
      const chunk = letters.slice(start, start + blockSize);
      const lettersWidth =
        chunk.reduce((sum, letter) => sum + unitWidth(letter.char) * size, 0) +
        params.signLetterGap * Math.max(chunk.length - 1, 0);
      const width = Math.max(
        lettersWidth + 2 * SIGN_BLOCK_SIDE_MM,
        SIGN_BLOCK_MIN_WIDTH_MM,
      );
      let letterCursor = cursor + (width - lettersWidth) / 2;
      const placed = chunk.map((letter) => {
        const item = {
          index: letter.index,
          char: letter.char,
          left: letterCursor,
        };

        letterCursor += unitWidth(letter.char) * size + params.signLetterGap;

        return item;
      });

      blocks.push({
        index: blocks.length,
        left: cursor,
        width,
        plateHeight: blockPlateHeight(params, size),
        hasPrev: blocks.length > 0,
        hasNext: blocks.length + 1 < blockCount,
        letters: placed,
      });
      cursor += width + SIGN_BLOCK_JOINT_MM;
    }

    return { blocks, width: Math.max(cursor - SIGN_BLOCK_JOINT_MM, 0) };
  };

  let size = params.signFontSize;
  let result = layout(size);

  for (let step = 0; step < 4 && result.width > SIGN_MAX_WIDTH_MM; step += 1) {
    size = Math.max(1, size * (SIGN_MAX_WIDTH_MM / result.width));
    result = layout(size);
  }

  return { size, ...result };
}

/** Готовые детали одного блока: лицо и крышка. */
type SignBlockParts = {
  block: SignBlock;
  face: BufferGeometry;
  cover: BufferGeometry;
};

/** Окружность замкнутым контуром: отверстие под провод в крышке. */
function createCircleContour(center: Vector2, radius: number): Vector2[] {
  const points: Vector2[] = [];
  const segments = 32;

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;

    points.push(
      new Vector2(
        center.x + Math.cos(angle) * radius,
        center.y + Math.sin(angle) * radius,
      ),
    );
  }

  return points;
}

/**
 * Самая свободная точка камеры не ниже floorY и не ближе minClearance к стенкам.
 *
 * Перебирается та же сетка 16 × 16, что и при замере ширины штриха: для каждой
 * точки камеры считается расстояние до стенок, и берётся самая просторная.
 * null — подходящих точек нет.
 */
function findFreeChamberPoint(
  outer: Vector2[],
  holes: Vector2[][],
  floorY: number,
  minClearance: number,
): Vector2 | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of outer) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  if (
    !Number.isFinite(minX) ||
    maxX - minX < SIGN_EPSILON ||
    maxY - minY < SIGN_EPSILON
  ) {
    return null;
  }

  const contours = [outer, ...holes];
  let best: Vector2 | null = null;
  let clearance = 0;

  for (let column = 0; column <= SIGN_WIDTH_PROBE_STEPS; column += 1) {
    for (let row = 0; row <= SIGN_WIDTH_PROBE_STEPS; row += 1) {
      const x = minX + ((maxX - minX) * column) / SIGN_WIDTH_PROBE_STEPS;
      const y = minY + ((maxY - minY) * row) / SIGN_WIDTH_PROBE_STEPS;

      if (y < floorY) {
        continue;
      }

      const point = new Vector2(x, y);

      if (!isInsideContour(point, outer)) {
        continue;
      }

      if (holes.some((hole) => isInsideContour(point, hole))) {
        continue;
      }

      let nearest = Infinity;

      for (const contour of contours) {
        for (let index = 0; index < contour.length; index += 1) {
          nearest = Math.min(
            nearest,
            distanceToSegment(
              x,
              y,
              contour[index],
              contour[(index + 1) % contour.length],
            ),
          );
        }
      }

      if (nearest > clearance) {
        clearance = nearest;
        best = point;
      }
    }
  }

  return best && clearance >= minClearance ? best : null;
}

/**
 * Точка камеры под отверстие для провода.
 *
 * Сначала ищется место под широкое отверстие Ø4 мм, потом под узкое Ø3 мм:
 * точка должна отойти от стенки на радиус плюс миллиметр и подняться над
 * планкой на радиус плюс 0.5 мм, иначе отверстие заросло бы при печати.
 * plateTop — верх планки крышки блока. null — штрих узкий, отверстия нет.
 */
function findWireHole(
  outer: Vector2[],
  holes: Vector2[][],
  plateTop: number,
): { center: Vector2; radius: number } | null {
  const radii = [SIGN_COVER_WIRE_HOLE_MM / 2, SIGN_COVER_WIRE_HOLE_MIN_MM / 2];

  for (const radius of radii) {
    const center = findFreeChamberPoint(
      outer,
      holes,
      plateTop + radius + 0.5,
      radius + 1,
    );

    if (center) {
      return { center, radius };
    }
  }

  return null;
}

/**
 * Шип крышки по контуру: кольцо, которое входит в паз стенки.
 *
 * Шип начинается на lip + зазор от контура и занимает ширину паза минус два
 * зазора (не больше SIGN_COVER_TENON_WIDTH_MM), то есть садится в паз с
 * зазором SIGN_COVER_TENON_CLEARANCE_MM на сторону. По высоте он на столько же
 * короче паза, а на SIGN_COVER_WELD_MM входит в плиту крышки — так он приварен
 * к ней, а не стоит встык.
 *
 * direction = 1 — шип снаружи контура буквы, −1 — внутри её отверстия: там
 * кольцо расширяется наружу, а не поджимается внутрь.
 */
function createCoverTenon(
  contour: Vector2[],
  direction: 1 | -1,
): BufferGeometry | null {
  const grooveWidth = Math.min(
    SIGN_GROOVE_WIDTH_MM,
    SIGN_LETTER_WALL_MM - 2 * SIGN_GROOVE_MIN_LIP_MM,
  );
  const tenonWidth = Math.min(
    SIGN_COVER_TENON_WIDTH_MM,
    grooveWidth - 2 * SIGN_COVER_TENON_CLEARANCE_MM,
  );

  if (tenonWidth < 0.6) {
    return null;
  }

  const lip = (SIGN_LETTER_WALL_MM - grooveWidth) / 2;
  const start = lip + SIGN_COVER_TENON_CLEARANCE_MM;
  const end = start + tenonWidth;
  const near =
    direction > 0
      ? offsetContour(contour, start)
      : offsetContour(contour, -end);
  const far =
    direction > 0 ? offsetContour(contour, end) : offsetContour(contour, -start);

  if (!near || !far || !isSimpleContour(near) || !isSimpleContour(far)) {
    return null;
  }

  return extrudeRegion(
    near,
    [far],
    SIGN_COVER_TENON_HEIGHT_MM + SIGN_COVER_WELD_MM,
    -SIGN_COVER_WELD_MM,
  );
}

/**
 * Крышка одной буквы: плита 2 мм по её контуру и шип по краю.
 *
 * Плита сплошная — она закрывает камеру вместе с перемычками буквы, — а шип
 * повторяет и внешний контур, и контуры отверстий: каждая стенка получает
 * ответную деталь. Отверстие под провод вырезается только там, где в камеру
 * помещается окружность и над планкой блока остаётся место: у узкой «I» его
 * нет, провод идёт через стык блоков.
 *
 * Буква, которая не поместила камеру и печатается сплошной, крышки не требует:
 * null. Координаты — координаты шрифта, сдвиг на позицию в строке делает
 * вызывающий.
 */
function createLetterCover(
  letter: SignLetterShape,
  shift: number,
  plateTop: number,
): BufferGeometry | null {
  const cavity = letter.cavity;

  if (!cavity) {
    return null;
  }

  const bodies: BufferGeometry[] = [];
  const wire = findWireHole(cavity.outer, cavity.holes, plateTop);
  const holes = wire ? [createCircleContour(wire.center, wire.radius)] : [];

  bodies.push(
    extrudeRegion(
      letter.outline,
      holes,
      SIGN_COVER_PLATE_MM,
      -SIGN_COVER_PLATE_MM,
    ),
  );

  if (cavity.grooved) {
    const outerTenon = createCoverTenon(letter.outline, 1);

    if (outerTenon) {
      bodies.push(outerTenon);
    }

    letter.holes.forEach((hole) => {
      const tenon = createCoverTenon(hole, -1);

      if (tenon) {
        bodies.push(tenon);
      }
    });
  }

  const geometry = mergeBodies(bodies);

  if (!geometry) {
    return null;
  }

  if (shift !== 0) {
    geometry.translate(shift, 0, 0);
  }

  return geometry;
}

/**
 * Плита блока: основание под буквами с шипом справа и пазом слева.
 *
 * Контур обходится снизу вверх по левой кромке (с пазом), по верхней кромке
 * вправо, вниз по правой (с шипом) и по нижней кромке обратно. Паз и шип —
 * трапеции в плоскости плиты: шип сужается от основания к острию, паз
 * повторяет его форму с натягом, поэтому блоки входят друг в друга с усилием и
 * держатся без клея.
 *
 * Плита стоит в передней части детали (z от signDepth − 3 до signDepth), так
 * что камера букв остаётся открытой сзади.
 */
function createBlockPlate(block: SignBlock, params: SignParams): BufferGeometry {
  const bottom = -SIGN_BASE_BOTTOM_MM;
  const top = block.plateHeight;
  const half = (top - bottom) / 2;
  const center = (top + bottom) / 2;
  const neck = Math.max(half * 0.62, 1.5);
  const tip = Math.max(half * 0.37, 0.9);
  const left = block.left;
  const right = block.left + block.width;
  const points: Vector2[] = [new Vector2(left, bottom)];

  if (block.hasPrev) {
    // Ширина шипа на входе в паз: от основания к острию он сужается, и на
    // расстоянии стыка от основания шип уже у́же. Натяг снимается с обеих
    // сторон паза, поэтому детали входят с усилием, но без заклинивания.
    const mouth =
      neck +
      (tip - neck) * (SIGN_BLOCK_JOINT_MM / SIGN_PIN_LENGTH_MM) -
      SIGN_PIN_FIT_MM;
    const slot = SIGN_PIN_LENGTH_MM - SIGN_BLOCK_JOINT_MM + 0.6;

    points.push(
      new Vector2(left, center - mouth),
      new Vector2(left + slot, center - (tip - SIGN_PIN_FIT_MM)),
      new Vector2(left + slot, center + (tip - SIGN_PIN_FIT_MM)),
      new Vector2(left, center + mouth),
    );
  }

  points.push(new Vector2(left, top), new Vector2(right, top));

  if (block.hasNext) {
    points.push(
      new Vector2(right, center + neck),
      new Vector2(right + SIGN_PIN_LENGTH_MM, center + tip),
      new Vector2(right + SIGN_PIN_LENGTH_MM, center - tip),
      new Vector2(right, center - neck),
    );
  }

  points.push(new Vector2(right, bottom));

  return extrudeRegion(
    points,
    [],
    SIGN_BASE_PLATE_MM,
    params.signDepth - SIGN_BASE_PLATE_MM,
  );
}

/**
 * Планка крышки блока: связывает крышки букв в одну деталь.
 *
 * Плита каждой буквы своя и повторяет её контур, поэтому без планки блок
 * рассыпался бы на отдельные пластинки. Планка 2 мм идёт по высоте рейки блока
 * (там, где у лица стоит плита SIGN_BASE_PLATE_MM) и печатается вместе с
 * крышками: она лежит за плитой лица и ничему не мешает. Полоса выше планки
 * сплошная, поэтому отверстия под провод ищутся только над её верхом —
 * см. findWireHole.
 */
function createBlockCover(block: SignBlock): BufferGeometry {
  const bottom = -SIGN_BASE_BOTTOM_MM;
  const top = block.plateHeight;
  const left = block.left;
  const right = block.left + block.width;

  return extrudeRegion(
    [
      new Vector2(left, bottom),
      new Vector2(right, bottom),
      new Vector2(right, top),
      new Vector2(left, top),
    ],
    [],
    SIGN_COVER_PLATE_MM,
    -SIGN_COVER_PLATE_MM,
  );
}

/**
 * Детали всех блоков надписи.
 *
 * Буквы одного символа собираются один раз и копируются: «ТРИ ДИ» строит
 * четыре глифа вместо пяти. Копия сдвигается так, чтобы левый край совпал с
 * позицией из раскладки, — тем же сдвигом переводятся контуры полостей, иначе
 * бортик крышки оказался бы не под буквой.
 *
 * null означает, что шрифт не загружен или надпись пуста.
 */
function buildSignBlockParts(
  params: SignParams,
  font: Font | null,
): SignBlockParts[] | null {
  if (!font) {
    return null;
  }

  const letters = listSignBlocks(params.signText, params.signBlockSize).flatMap(
    (block) => block.letters,
  );

  if (letters.length === 0) {
    return null;
  }

  const { size, blocks } = layoutSignBlocks(params, letters, font);
  const cache = new Map<string, SignGlyph>();
  const built: SignBlockParts[] = [];

  for (const block of blocks) {
    const bodies: BufferGeometry[] = [];
    const covers: BufferGeometry[] = [];

    for (const letter of block.letters) {
      let glyph = cache.get(letter.char);

      if (!glyph) {
        const created = createGlyph(
          letter.char,
          size,
          font,
          params.signDepth,
          params.signChannelWidth,
        );

        if (!created) {
          continue;
        }

        glyph = created;
        cache.set(letter.char, glyph);
      }

      const body = glyph.geometry.clone();

      body.computeBoundingBox();

      const box = body.boundingBox;

      if (!box) {
        body.dispose();
        continue;
      }

      const shift = letter.left - box.min.x;

      body.translate(shift, 0, 0);
      bodies.push(body);

      for (const shape of glyph.shapes) {
        const cover = createLetterCover(shape, shift, block.plateHeight);

        if (cover) {
          covers.push(cover);
        }
      }
    }

    bodies.push(createBlockPlate(block, params));

    const face = mergeBodies(bodies);

    if (!face) {
      continue;
    }

    const cover = mergeBodies([createBlockCover(block), ...covers]);

    if (!cover) {
      face.dispose();
      continue;
    }

    built.push({ block, face, cover });
  }

  for (const glyph of cache.values()) {
    glyph.geometry.dispose();
  }

  return built;
}

/**
 * Собранная надпись одной сеткой: предпросмотр.
 *
 * Блоки стоят с зазором стыка, шипы входят в пазы — предпросмотр показывает
 * именно то, что получится после печати. Крышки в сборку не входят: они
 * закрывают камеры сзади и с лицевой стороны не видны.
 *
 * font = null допустим: шрифт ещё грузится, и пустая сетка честнее плиты,
 * которой в модели больше нет.
 */
export function createSignGeometry(
  params: Partial<SignParams>,
  font: Font | null = null,
): BufferGeometry {
  const built = buildSignBlockParts(normalizeSignParams(params), font);

  if (!built) {
    return createEmptyGeometry();
  }

  const merged = mergeBodies(built.map((parts) => parts.face));

  return merged ? placeOnBed(merged) : createEmptyGeometry();
}

/**
 * Деталь блока: лицо с буквами или задняя крышка.
 *
 * Номер блока — как в listSignBlocks, деталь — `face` или `cover`. Геометрия
 * собирается по всей надписи, потому что кегль зависит от длины строки: файл
 * блока совпадает с тем блоком, который видно в предпросмотре. Номер вне
 * списка даёт пустую сетку — API отсекает такие запросы раньше.
 */
export function createSignBlockGeometry(
  params: Partial<SignParams>,
  font: Font | null = null,
  blockIndex = 0,
  part: SignPart = "face",
): BufferGeometry {
  const built = buildSignBlockParts(normalizeSignParams(params), font);

  if (!built) {
    return createEmptyGeometry();
  }

  const parts = built.find((item) => item.block.index === blockIndex);

  if (!parts) {
    return createEmptyGeometry();
  }

  return placeOnBed(part === "cover" ? parts.cover : parts.face);
}
