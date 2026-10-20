import {
  BufferGeometry,
  ExtrudeGeometry,
  Matrix4,
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
 *   face  — полые буквы на общей плите с шипом справа и пазом слева;
 *   cover — задняя крышка с бортиком, который входит в камеру буквы.
 *
 * Сборка: плиты соседних блоков стоят с зазором SIGN_BLOCK_JOINT_MM, шип
 * одного входит в паз другого с натягом SIGN_PIN_FIT_MM, а за плитой на стыке
 * проходит прямоугольный канал — по нему лента уходит из камеры одного блока в
 * камеру следующего. Крышка закрывает камеру сзади, бортик повторяет контур
 * полости и держится в ней за счёт натяга SIGN_COVER_PRESS_MM.
 *
 * Буква построена в плоскости XY: низ на Y = 0, лицо смотрит в +Z, толщина идёт
 * от 0 до signDepth. Печатается деталь лицом вниз, поэтому ни поворот в
 * слайсере, ни поддержки не нужны.
 *
 * Устройство буквы: сплошное лицо SIGN_LETTER_FRONT_MM, по контуру стенка
 * SIGN_LETTER_WALL_MM и открытая сзади камера под светодиодную ленту. Лицо
 * тонкое, поэтому свет диффузно проходит сквозь него — как у литофана.
 *
 * Булевых операций в проекте нет, поэтому каждая оболочка собирается из
 * пересекающихся замкнутых тел: пластина лица на всю толщину, внешняя стенка
 * (контур минус поджатый внутрь контур) и стенки вокруг отверстий буквы.
 * Каждое тело watertight, а слайсер объединяет их при печати — так же устроен
 * брелок с именем. Плита, шип, канал и бортик крышки приходят в ту же сетку
 * отдельными телами: они входят в буквы и друг в друга, но замкнутость каждого
 * тела не нарушают.
 *
 * Если штрих буквы тоньше, чем нужно камере, буква печатается сплошной:
 * контур просто не поджимается. Условие одно — камера должна вмещать ленту
 * шириной signChannelWidth, иначе внутри буквы нечего освещать.
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

/** Толщина стенки между контуром буквы и камерой, мм. */
export const SIGN_LETTER_WALL_MM = 1.8;

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

/** Стенка канала под ленту на стыке, мм. */
const SIGN_LIGHT_WALL_MM = 1.6;

/** Толщина задней крышки, мм. */
const SIGN_COVER_PLATE_MM = 2;

/** Высота бортика крышки, который входит в камеру буквы, мм. */
const SIGN_COVER_RIM_MM = 4;

/** Натяг бортика в камере на сторону, мм. */
const SIGN_COVER_PRESS_MM = 0.15;

/** Запас крышки за верхний край букв, мм. */
const SIGN_COVER_MARGIN_MM = 2;

/** Полость буквы: контур камеры и отверстия внутри неё. */
type SignCavity = {
  outer: Vector2[];
  holes: Vector2[][];
};

/** Глиф с полостями: тела буквы в координатах шрифта и контуры камер. */
type SignGlyph = {
  geometry: BufferGeometry;
  cavities: SignCavity[];
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

/**
 * Тела одной фигуры глифа и её полости.
 *
 * Сначала пробуем полую букву. Если стенка или камера не помещаются в штрих,
 * возвращается одно сплошное тело: буква остаётся печатаемой, просто без ленты
 * внутри и без бортика у крышки. У «О» и «В» фигур несколько — отверстия
 * приходят отдельными контурами внутри одной фигуры, так что буква собирается
 * из всех.
 */
function createShapeBodies(
  shape: Shape,
  depth: number,
  channelWidth: number,
): { bodies: BufferGeometry[]; cavities: SignCavity[] } {
  const { shape: shapePoints, holes: holePoints } =
    shape.extractPoints(SIGN_CURVE_SEGMENTS);
  const outer = cleanContour(shapePoints);

  if (outer.length < 3) {
    return { bodies: [], cavities: [] };
  }

  const holes = holePoints
    .map((hole) => cleanContour(hole))
    .filter((hole) => hole.length >= 3);
  const hollow = createHollowBodies(outer, holes, depth, channelWidth);

  if (!hollow) {
    return { bodies: [extrudeRegion(outer, holes, depth, 0)], cavities: [] };
  }

  return { bodies: hollow.bodies, cavities: [hollow.cavity] };
}

/**
 * Оболочка полой буквы: лицо, внешняя стенка и стенки вокруг отверстий.
 *
 * Тела перекрываются на SIGN_LETTER_EMBED_MM — стык встык слайсер иногда
 * оставляет щель, а перекрытие даёт монолит после печати.
 *
 * Заодно возвращается полость: её контур нужен крышке, бортик которой входит
 * в камеру. null означает, что штрих не вмещает стенку с камерой.
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

  if (maxInscribedWidth(inset, expandedHoles) < channelWidth) {
    return null;
  }

  const wallDepth = chamberDepth + SIGN_LETTER_EMBED_MM;
  const bodies: BufferGeometry[] = [
    extrudeRegion(outer, holes, front, chamberDepth),
    extrudeRegion(outer, [inset], wallDepth, 0),
  ];

  for (let index = 0; index < holes.length; index += 1) {
    bodies.push(
      extrudeRegion(expandedHoles[index], [holes[index]], wallDepth, 0),
    );
  }

  return { bodies, cavity: { outer: inset, holes: expandedHoles } };
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
  const cavities: SignCavity[] = [];

  for (const shape of shapes) {
    const created = createShapeBodies(shape, depth, channelWidth);

    bodies.push(...created.bodies);
    cavities.push(...created.cavities);
  }

  const geometry = mergeBodies(bodies);

  return geometry ? { geometry, cavities } : null;
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

/**
 * Бортик крышки: полость буквы с натягом.
 *
 * Тело выдавливается от z = −1 до высоты бортика: миллиметр внутри плиты
 * крышки нужен для сварки, остальное входит в камеру. Контур полости
 * расширяется на SIGN_COVER_PRESS_MM, отверстия поджимаются на столько же —
 * бортик садится в букву с натягом и не выпадает.
 *
 * null — контур полости не пережил смещение с натягом: буква останется без
 * бортика, крышка просто закроет её сзади.
 */
function createCoverPlug(
  cavity: SignCavity,
  depth: number,
  shift: number,
): BufferGeometry | null {
  const chamber = depth - SIGN_LETTER_FRONT_MM;
  const rim = Math.min(SIGN_COVER_RIM_MM, chamber - 1);

  if (rim < 1) {
    return null;
  }

  const outer = offsetContour(cavity.outer, -SIGN_COVER_PRESS_MM);

  if (!outer || !isSimpleContour(outer)) {
    return null;
  }

  const holes: Vector2[][] = [];

  for (const hole of cavity.holes) {
    const pressed = offsetContour(hole, SIGN_COVER_PRESS_MM);

    if (!pressed || !isSimpleContour(pressed)) {
      return null;
    }

    holes.push(pressed);
  }

  const geometry = extrudeRegion(outer, holes, rim + 1, -1);

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
 * Канал на стыке: труба за плитой, по которой лента уходит в соседний блок.
 *
 * Труба начинается внутри своей плиты (перекрытие 3 мм по X и 1 мм по Z — так
 * она приваривается к детали) и заканчивается за 0.2 мм до плиты соседа: при
 * сборке блоки не упираются друг в друга. Отверстие открыто с обоих концов, а
 * его ширина равна signChannelWidth, поэтому лента проходит насквозь. Со
 * стенкой SIGN_LIGHT_WALL_MM труба остаётся в габарите плиты.
 *
 * Профиль строится в плоскости XY (u — Y детали, v — Z детали) и выдавливается
 * по нормали; затем матрица переставляет оси, и ось выдавливания становится X.
 * Определитель перестановки равен +1, поэтому обход граней не переворачивается.
 */
function createJointChannel(
  block: SignBlock,
  params: SignParams,
): BufferGeometry | null {
  if (!block.hasNext) {
    return null;
  }

  const wall = SIGN_LIGHT_WALL_MM;
  const channel = params.signChannelWidth;
  const front = params.signDepth - SIGN_BASE_PLATE_MM + 1;
  const outerHeight = channel + 2 * wall;

  if (front - 2 * wall < 2) {
    return null;
  }

  const right = block.left + block.width;
  const from = right - 3;
  const length = SIGN_BLOCK_JOINT_MM + 3 - 0.2;
  const outer = [
    new Vector2(0, 0),
    new Vector2(outerHeight, 0),
    new Vector2(outerHeight, front),
    new Vector2(0, front),
  ];
  const hole = [
    new Vector2(wall, wall),
    new Vector2(wall, front - wall),
    new Vector2(wall + channel, front - wall),
    new Vector2(wall + channel, wall),
  ];
  const geometry = extrudeRegion(outer, [hole], length, 0);

  geometry.applyMatrix4(
    new Matrix4().set(0, 0, 1, from, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1),
  );

  return geometry;
}

/**
 * Задняя крышка блока: плита на весь габарит букв.
 *
 * Крышка лежит в z от −SIGN_COVER_PLATE_MM до 0, то есть вплотную к тыльной
 * плоскости букв: камера закрывается, лента остаётся внутри. По высоте плита
 * доходит до верхнего края самой высокой буквы плюс запас, снизу — до низа
 * плиты блока, поэтому блок закрыт целиком.
 */
function createBlockCover(block: SignBlock, letterTop: number): BufferGeometry {
  const bottom = -SIGN_BASE_BOTTOM_MM;
  const top = Math.max(letterTop + SIGN_COVER_MARGIN_MM, block.plateHeight);
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
    const plugs: BufferGeometry[] = [];
    let letterTop = block.plateHeight;

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
      letterTop = Math.max(letterTop, box.max.y);

      for (const cavity of glyph.cavities) {
        const plug = createCoverPlug(cavity, params.signDepth, shift);

        if (plug) {
          plugs.push(plug);
        }
      }
    }

    bodies.push(createBlockPlate(block, params));

    const channel = createJointChannel(block, params);

    if (channel) {
      bodies.push(channel);
    }

    const face = mergeBodies(bodies);

    if (!face) {
      continue;
    }

    const cover = mergeBodies([createBlockCover(block, letterTop), ...plugs]);

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
 * Блоки стоят с зазором стыка, шипы входят в пазы, на стыках видны каналы —
 * предпросмотр показывает именно то, что получится после печати. Крышки в
 * сборку не входят: они закрывают камеры сзади и с лицевой стороны не видны.
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
