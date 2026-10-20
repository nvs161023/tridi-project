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
  listSignLetters,
  normalizeSignParams,
  type SignParams,
} from "@/lib/constructor/params";

/**
 * Геометрия вывески: по одной полой букве на каждый символ надписи.
 *
 * Плиты больше нет — буквы печатаются и вешаются по отдельности, поэтому
 * каждая из них самостоятельная замкнутая деталь. Буква построена в плоскости
 * XY: низ на Y = 0, лицо смотрит в +Z, толщина идёт от 0 до signDepth. В таком
 * виде деталь и попадает в STL — поворачивать её в слайсере не нужно.
 *
 * Устройство буквы: сплошное лицо SIGN_LETTER_FRONT_MM, по контуру стенка
 * SIGN_LETTER_WALL_MM и открытая сзади камера под светодиодную ленту. Лицо
 * тонкое, поэтому свет диффузно проходит сквозь него — как у литофана.
 * Открытая камера решает сразу две задачи: буква печатается лицом вниз без
 * поддержек, а при креплении на стену камера оказывается закрытой.
 *
 * Булевых операций в проекте нет, поэтому оболочка собирается из
 * пересекающихся замкнутых тел: пластина лица на всю толщину, внешняя стенка
 * (контур минус поджатый внутрь контур) и стенки вокруг отверстий буквы.
 * Каждое тело watertight, а слайсер объединяет их при печати — так же устроен
 * брелок с именем.
 *
 * Если штрих буквы тоньше, чем нужно камере, буква печатается сплошной:
 * контур просто не поджимается. Условие одно — камера должна вмещать ленту
 * шириной signChannelWidth, иначе внутри буквы нечего освещать.
 */

/** Публичный путь шрифта: тот же JSON, что у брелока. */
export const SIGN_FONT_URL = KEYCHAIN_FONT_URL;

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
 * Замкнутая область с отверстиями, выдавленная на depth от z.
 *
 * Контуры уже разбиты на точки, поэтому кривых в шейпе нет: экструзия получается
 * точной по контуру глифа и не зависит от curveSegments.
 */
function extrudeRegion(
  outer: Vector2[],
  holes: Vector2[][],
  depth: number,
  z: number,
): BufferGeometry {
  const shape = new Shape();
  appendPoints(shape, outer);
  shape.closePath();

  for (const hole of holes) {
    const path = new Path();
    appendPoints(path, hole);
    path.closePath();
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
 * Тела одной фигуры глифа.
 *
 * Сначала пробуем полую букву. Если стенка или камера не помещаются в штрих,
 * возвращается одно сплошное тело: буква остаётся печатаемой, просто без ленты
 * внутри. У «О» и «В» фигур несколько — отверстия приходят отдельными контурами
 * внутри одной фигуры, так что буква собирается из всех.
 */
function createShapeBodies(
  shape: Shape,
  depth: number,
  channelWidth: number,
): BufferGeometry[] {
  const { shape: shapePoints, holes: holePoints } =
    shape.extractPoints(SIGN_CURVE_SEGMENTS);
  const outer = cleanContour(shapePoints);

  if (outer.length < 3) {
    return [];
  }

  const holes = holePoints
    .map((hole) => cleanContour(hole))
    .filter((hole) => hole.length >= 3);
  const hollow = createHollowBodies(outer, holes, depth, channelWidth);

  return hollow ?? [extrudeRegion(outer, holes, depth, 0)];
}

/**
 * Оболочка полой буквы: лицо, внешняя стенка и стенки вокруг отверстий.
 *
 * Тела перекрываются на SIGN_LETTER_EMBED_MM — стык встык слайсер иногда
 * оставляет щель, а перекрытие даёт монолит после печати.
 *
 * null означает, что штрих не вмещает стенку с камерой.
 */
function createHollowBodies(
  outer: Vector2[],
  holes: Vector2[][],
  depth: number,
  channelWidth: number,
): BufferGeometry[] | null {
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

  return bodies;
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
function createGlyphGeometry(
  char: string,
  size: number,
  font: Font,
  depth: number,
  channelWidth: number,
): BufferGeometry | null {
  const shapes = font.generateShapes(char, size);

  if (shapes.length === 0) {
    return null;
  }

  const bodies: BufferGeometry[] = [];

  for (const shape of shapes) {
    bodies.push(...createShapeBodies(shape, depth, channelWidth));
  }

  return mergeBodies(bodies);
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

/**
 * Кегль и раскладка строки.
 *
 * Зазор задан в миллиметрах и с кеглем не масштабируется, поэтому сначала
 * считается ширина при кегле 1, а потом кегль уменьшается ровно настолько,
 * чтобы строка вместе с зазорами влезла в SIGN_MAX_WIDTH_MM. Позиции — левый
 * край каждой буквы от начала строки.
 */
function layoutSignLetters(
  params: SignParams,
  letters: { index: number; char: string }[],
  font: Font,
): { size: number; offsets: number[] } {
  const unitWidths = letters.map((letter) =>
    measureGlyphWidth(letter.char, font),
  );
  const unitTotal = unitWidths.reduce((sum, width) => sum + width, 0);
  const gapTotal = params.signLetterGap * Math.max(letters.length - 1, 0);
  const size =
    unitTotal > 0 && unitTotal * params.signFontSize + gapTotal > SIGN_MAX_WIDTH_MM
      ? (SIGN_MAX_WIDTH_MM - gapTotal) / unitTotal
      : params.signFontSize;
  const offsets: number[] = [];
  let cursor = 0;

  for (const width of unitWidths) {
    offsets.push(cursor);
    cursor += width * size + params.signLetterGap;
  }

  return { size, offsets };
}

/**
 * Буквы надписи одной сеткой: предпросмотр и скачивание всей надписи.
 *
 * Буквы стоят в порядке надписи через signLetterGap, низ на Y = 0, строка
 * отцентрована по X. Повторяющиеся символы собираются один раз и копируются:
 * «ТРИ ДИ» строит четыре тела вместо шести. В слайсере такую сетку можно
 * разложить по объектам — тела не пересекаются.
 *
 * font = null допустим: шрифт ещё грузится, и пустая сетка честнее плиты,
 * которой в модели больше нет.
 */
export function createSignGeometry(
  params: Partial<SignParams>,
  font: Font | null = null,
): BufferGeometry {
  if (!font) {
    return createEmptyGeometry();
  }

  const normalized = normalizeSignParams(params);
  const letters = listSignLetters(normalized.signText);

  if (letters.length === 0) {
    return createEmptyGeometry();
  }

  const { size, offsets } = layoutSignLetters(normalized, letters, font);
  const cache = new Map<string, BufferGeometry>();
  const bodies: BufferGeometry[] = [];

  letters.forEach((letter, position) => {
    let glyph = cache.get(letter.char);

    if (!glyph) {
      const created = createGlyphGeometry(
        letter.char,
        size,
        font,
        normalized.signDepth,
        normalized.signChannelWidth,
      );

      if (!created) {
        return;
      }

      glyph = created;
      cache.set(letter.char, glyph);
    }

    const copy = glyph.clone();
    copy.computeBoundingBox();

    const box = copy.boundingBox;

    if (!box) {
      copy.dispose();
      return;
    }

    copy.translate(offsets[position] - box.min.x, 0, 0);
    bodies.push(copy);
  });

  for (const glyph of cache.values()) {
    glyph.dispose();
  }

  const merged = mergeBodies(bodies);

  return merged ? placeOnBed(merged) : createEmptyGeometry();
}

/**
 * Одна буква надписи — отдельная деталь для печати.
 *
 * Номер буквы тот же, что в listSignLetters: позиция символа в очищенной
 * строке. Кегль считается по всей надписи, чтобы буква из отдельного файла
 * точно совпала с той же буквой в общем файле: иначе длинная строка уменьшила
 * бы буквы только в общей сетке.
 */
export function createSignLetterGeometry(
  params: Partial<SignParams>,
  font: Font | null = null,
  letterIndex = 0,
): BufferGeometry {
  if (!font) {
    return createEmptyGeometry();
  }

  const normalized = normalizeSignParams(params);
  const letters = listSignLetters(normalized.signText);
  const letter = letters[letterIndex];

  if (!letter) {
    return createEmptyGeometry();
  }

  const { size } = layoutSignLetters(normalized, letters, font);
  const geometry = createGlyphGeometry(
    letter.char,
    size,
    font,
    normalized.signDepth,
    normalized.signChannelWidth,
  );

  return geometry ? placeOnBed(geometry) : createEmptyGeometry();
}
