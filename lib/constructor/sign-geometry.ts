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
  SIGN_PACKAGE_GAP_MM,
  SIGN_PRINT_BED_MM,
  listSignBlocks,
  normalizeSignParams,
  type SignFont,
  type SignParams,
  type SignPart,
} from "@/lib/constructor/params";

/**
 * Геометрия вывески: отдельные полые буквы, задние крышки и рельс.
 *
 * Надпись делится на блоки по signBlockSize букв (listSignBlocks), и каждый
 * блок печатается тремя деталями:
 *   face  — отдельные полые буквы, без общей плиты; у крайних букв снизу
 *           продолжение нижнего штриха — ножка;
 *   cover — крышка 2 мм по контуру каждой буквы с шипом по краю, отверстием
 *           под провод и пазом под клипсу рельса;
 *   rail  — тонкий брус 6 × 4 мм за крышками с открытым назад каналом Ø4 мм.
 *
 * Плиты под буквами больше нет: буквы не связаны спереди ни планкой, ни
 * перемычкой. Их держит рельс за крышками. Клипса рельса — пластина 2 мм,
 * которая утоплена в паз крышки: в режиме `detachable` с зазором (рельс
 * снимается), в режиме `fixed` с натягом (после сборки проклеивается).
 * Рельс не выходит за контур букв и стоит целиком за их задней плоскостью,
 * поэтому спереди его не видно. Если рельс выключен, каждая буква получает
 * собственную ножку, а спереди по-прежнему нет общей планки.
 *
 * Сборка камеры герметична: на заднем торце стенки каждой буквы идёт паз до
 * 2 × 1.5 мм, в него входит шип 1.4 мм высотой на краю крышки. Ширина шипа на
 * 0.2 мм меньше паза, глубина — на 0.1 мм: крышка садится без заклинивания, а
 * камера под ленту остаётся закрытой. Шип повторяет и внешний контур буквы, и
 * контуры её отверстий.
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
 * watertight, а слайсер объединяет их при печати. Ножка и клипса рельса — такие
 * же отдельные замкнутые тела, входящие в букву или крышку с перекрытием.
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
export const SIGN_COVER_WIRE_HOLE_MM = 4;

/** Меньший диаметр, если широкое отверстие не помещается в штрих, мм. */
const SIGN_COVER_WIRE_HOLE_MIN_MM = 3;

/** Минимальная глубина камеры, мм: мельче — буква печатается сплошной. */
const SIGN_LETTER_MIN_CHAMBER_MM = 3;

/** Насколько стенки входят в лицо, мм: перекрытие надёжнее стыка встык. */
const SIGN_LETTER_EMBED_MM = 0.2;

/** Толщина крышки, мм: плоская пластина по контуру буквы. */
const SIGN_COVER_PLATE_MM = 2;

/** Насколько шип и клипса входят в крышку, мм: перекрытие вместо стыка. */
const SIGN_COVER_WELD_MM = 0.2;

/** Высота заднего рельса, мм: тонкий брус 6 × 4. */
export const SIGN_RAIL_HEIGHT_MM = 6;

/** Толщина заднего рельса, мм: тонкий брус 6 × 4. */
export const SIGN_RAIL_THICKNESS_MM = 4;

/**
 * Ширина открытого канала под провод в рельсе, мм.
 *
 * При толщине рельса 4 мм закрытый канал Ø4 не оставляет стенок, поэтому
 * канал открыт назад: лента и провод заводятся в него сзади и остаются
 * скрытыми за буквами.
 */
export const SIGN_RAIL_WIRE_HOLE_MM = 4;

/** Ширина клипсы рельса вдоль надписи, мм: тонкий соединитель. */
export const SIGN_RAIL_CLIP_WIDTH_MM = 2;

/** Высота клипсы рельса, мм: помещается в нижний штрих. */
const SIGN_RAIL_CLIP_HEIGHT_MM = 4;

/** Зазор клипсы в пазу для съёмного рельса, мм на сторону. */
const SIGN_RAIL_CLIP_CLEARANCE_DETACHABLE_MM = 0.3;

/**
 * Посадка клипсы в пазу для жёсткого рельса, мм на сторону.
 *
 * Отрицательное значение — натяг: паз в крышке на 0.1 мм уже клипсы.
 */
const SIGN_RAIL_CLIP_CLEARANCE_FIXED_MM = -0.05;

/** Длина ножки под нижним штрихом буквы, мм. */
export const SIGN_FOOT_HEIGHT_MM = 15;

/** Ширина ножки, мм: продолжение нижнего штриха, а не планка. */
const SIGN_FOOT_WIDTH_MM = 6;

/** Насколько ножка входит в нижний штрих буквы, мм. */
const SIGN_FOOT_EMBED_MM = 2.5;

/** На какой высоте над низом буквы ищется материал под ножку или клипсу, мм. */
const SIGN_BOTTOM_PROBE_MM = 1;

/** Раскладка пакета: крышка над лицом или рядом с ним. */
export type SignPackageArrangement = "stack" | "side";

/**
 * Выбранная раскладка пакета блока.
 *
 * `fits` — обе стороны огибающей не больше поля печати. `faceRotated` и
 * `coverRotated` означают поворот детали на 90° вокруг Z: так пакет 120 «ИИ»
 * из 210.7 × 244.9 мм превращается в 202.8 × 210.7 мм и влезает на стол 220.
 */
export type SignPackageLayout = {
  arrangement: SignPackageArrangement;
  faceRotated: boolean;
  coverRotated: boolean;
  /** Габарит пакета по X, мм. */
  width: number;
  /** Габарит пакета по Y, мм. */
  depth: number;
  fits: boolean;
};

/** Отверстие под провод: центр в координатах блока и радиус, мм. */
export type SignWireHoleReport = {
  blockIndex: number;
  x: number;
  y: number;
  radius: number;
  /** Откуда отверстие: из крышки буквы или из канала рельса. */
  source: "letter" | "rail";
  /** Отверстие сквозное по толщине крышки или по всей длине рельса. */
  through: boolean;
};

/** Габариты детали в общем STL: для проверки зазора между лицом и крышкой. */
export type SignPartBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

/** Отчёт сборки одного пакета: раскладка, габариты деталей и пересечение. */
export type SignBlockPackageReport = {
  layout: SignPackageLayout;
  face: SignPartBounds;
  cover: SignPartBounds;
  /** true — огибающие деталей пересекаются хотя бы по одной оси. */
  intersects: boolean;
};

/** Границы буквы в координатах блока: по ним проверяется равномерный трекинг. */
export type SignLetterBounds = {
  char: string;
  left: number;
  right: number;
};

/** Отчёт раскладки одного блока для панели и тестов. */
export type SignBlockLayoutReport = {
  blockIndex: number;
  faceWidth: number;
  faceHeight: number;
  coverWidth: number;
  coverHeight: number;
  /** Габариты рельса в координатах блока; null — выбран режим без рельса. */
  rail: SignPartBounds | null;
  /** Сколько ножек получил блок. */
  feet: number;
  /** Низ каждой ножки, мм: у ровной вывески он одинаковый. */
  footBottoms: number[];
  /** Буквы блока с границами по X: зазоры между ними должны совпадать. */
  letters: SignLetterBounds[];
  package: SignPackageLayout;
  wireHoles: SignWireHoleReport[];
};

/** Отчёт всей надписи: подпись параметров и блоки. */
export type SignLayoutReport = {
  /** Подпись нормализованных параметров: старый отчёт не применяется к новым. */
  signature: string;
  blocks: SignBlockLayoutReport[];
};

/** Отверстие в координатах детали до раскладки. */
type SignWireHole = {
  center: Vector2;
  radius: number;
  source: "letter" | "rail";
};

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

/** Ставит сетку на стол: X центрирован, Y и Z начинаются с нуля. */
function placeOnBed(geometry: BufferGeometry): BufferGeometry {
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (box) {
    geometry.translate(
      -(box.min.x + box.max.x) / 2,
      -box.min.y,
      -box.min.z,
    );
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

/** Блок надписи: буквы в координатах строки, мм. */
type SignBlock = {
  /** Номер блока с нуля: он же blockIndex в API. */
  index: number;
  /** Левая граница блока в координатах строки. */
  left: number;
  /** Ширина блока: по ней режется рельс. */
  width: number;
  /** Буквы блока: символ и позиция левого края в координатах строки. */
  letters: { index: number; char: string; left: number }[];
};

/**
 * Кегль и раскладка блоков.
 *
 * Зазор между буквами задан в миллиметрах и с кеглем не масштабируется.
 * Поэтому ширина строки считается функцией кегля, а сам кегль подбирается
 * итеративно: каждый шаг уменьшает его во столько раз, во сколько строка шире
 * SIGN_MAX_WIDTH_MM. Четырёх шагов хватает даже самому узкому шрифту.
 *
 * Блоки идут подряд с тем же зазором signLetterGap, что и буквы внутри блока:
 * трекинг по всей строке равномерный, без широких стыков на границах блоков.
 * Рельс каждого блока занимает ровно его ширину и не выходит за крайние буквы.
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

  const layout = (size: number): { blocks: SignBlock[]; width: number } => {
    const blocks: SignBlock[] = [];
    let cursor = 0;

    for (let start = 0; start < letters.length; start += blockSize) {
      const chunk = letters.slice(start, start + blockSize);
      const lettersWidth =
        chunk.reduce((sum, letter) => sum + unitWidth(letter.char) * size, 0) +
        params.signLetterGap * Math.max(chunk.length - 1, 0);
      // Боковых полей нет: рельс и лицо кончаются там же, где крайние буквы.
      // Поэтому зазор до следующего блока равен обычному трекингу.
      const width = lettersWidth;
      let letterCursor = cursor;
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
        letters: placed,
      });
      cursor += width + params.signLetterGap;
    }

    return { blocks, width: Math.max(cursor - params.signLetterGap, 0) };
  };

  let size = params.signFontSize;
  let result = layout(size);

  for (let step = 0; step < 4 && result.width > SIGN_MAX_WIDTH_MM; step += 1) {
    size = Math.max(1, size * (SIGN_MAX_WIDTH_MM / result.width));
    result = layout(size);
  }

  return { size, ...result };
}

/** Готовые детали одного блока: лицо, крышка, рельс и отверстия под провод. */
type SignBlockParts = {
  block: SignBlock;
  face: BufferGeometry;
  cover: BufferGeometry;
  rail: BufferGeometry;
  /** Габариты самого бруса 6 × 4 без клипс: клипсы уходят в пазы крышек. */
  railCore: SignPartBounds | null;
  feet: number;
  footBottoms: number[];
  letters: SignLetterBounds[];
  wireHoles: SignWireHole[];
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

/** Прямоугольный контур: паз под клипсу рельса в крышке. */
function createRectContour(
  center: Vector2,
  width: number,
  height: number,
): Vector2[] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  return [
    new Vector2(center.x - halfWidth, center.y - halfHeight),
    new Vector2(center.x + halfWidth, center.y - halfHeight),
    new Vector2(center.x + halfWidth, center.y + halfHeight),
    new Vector2(center.x - halfWidth, center.y + halfHeight),
  ];
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
 * нижним краем камеры на радиус плюс 0.5 мм, иначе отверстие заросло бы при
 * печати. null — штрих узкий, отверстия нет; тогда провод идёт по каналу
 * рельса.
 */
function findWireHole(
  outer: Vector2[],
  holes: Vector2[][],
): { center: Vector2; radius: number } | null {
  const radii = [SIGN_COVER_WIRE_HOLE_MM / 2, SIGN_COVER_WIRE_HOLE_MIN_MM / 2];
  let bottom = Infinity;

  for (const point of outer) {
    bottom = Math.min(bottom, point.y);
  }

  for (const radius of radii) {
    const center = findFreeChamberPoint(
      outer,
      holes,
      bottom + radius + 0.5,
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
 * ответную деталь. Отверстие под провод вырезается там, где в камеру помещается
 * окружность; если Ø4 мм не влезает, остаётся Ø3 мм. У совсем узкой буквы
 * отверстия нет — провод уходит по каналу рельса.
 *
 * Буква, которая не поместила камеру и печатается сплошной, крышки не требует:
 * null. Координаты — координаты шрифта, сдвиг на позицию в строке делает
 * вызывающий.
 */
function createLetterCover(
  letter: SignLetterShape,
  shift: number,
  clipNotch: Vector2 | null = null,
  clipClearance = 0,
): { geometry: BufferGeometry; wire: SignWireHole | null } | null {
  const cavity = letter.cavity;

  if (!cavity) {
    return null;
  }

  const bodies: BufferGeometry[] = [];
  const wire = findWireHole(cavity.outer, cavity.holes);
  const holes: Vector2[][] = [];

  if (wire) {
    holes.push(createCircleContour(wire.center, wire.radius));
  }

  if (clipNotch) {
    // Паз ровно под клипсу: в съёмном режиме с зазором, в жёстком — с натягом.
    holes.push(
      createRectContour(
        clipNotch,
        SIGN_RAIL_CLIP_WIDTH_MM + 2 * clipClearance,
        SIGN_RAIL_CLIP_HEIGHT_MM + 2 * clipClearance,
      ),
    );
  }

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

  return {
    geometry,
    wire: wire ? { ...wire, source: "letter" } : null,
  };
}

/** Интервал материала нижнего штриха на горизонтальном срезе. */
type SignBottomInterval = {
  left: number;
  right: number;
};

/**
 * Интервалы материала на горизонтальном срезе контура.
 *
 * Луч пересекает рёбра контура; чётные пары пересечений — материал. Нужен для
 * ножки и клипсы рельса: обе должны стоять на нижнем штрихе буквы, а не висеть
 * в её полости.
 */
function horizontalIntervals(
  contour: Vector2[],
  y: number,
): SignBottomInterval[] {
  const crossings: number[] = [];

  for (let index = 0; index < contour.length; index += 1) {
    const a = contour[index];
    const b = contour[(index + 1) % contour.length];
    const straddles =
      (a.y <= y && b.y > y) || (b.y <= y && a.y > y);

    if (!straddles) {
      continue;
    }

    const t = (y - a.y) / (b.y - a.y);

    crossings.push(a.x + (b.x - a.x) * t);
  }

  crossings.sort((a, b) => a - b);

  const intervals: SignBottomInterval[] = [];

  for (let index = 0; index + 1 < crossings.length; index += 2) {
    const left = crossings[index];
    const right = crossings[index + 1];

    if (right - left > SIGN_EPSILON) {
      intervals.push({ left, right });
    }
  }

  return intervals;
}

/** Материал нижнего штриха ближе к левому, правому или среднему краю буквы. */
function pickBottomInterval(
  contour: Vector2[],
  y: number,
  side: "left" | "right" | "center",
): SignBottomInterval | null {
  const intervals = horizontalIntervals(contour, y);

  if (intervals.length === 0) {
    return null;
  }

  if (side === "left") {
    return intervals.reduce((best, item) => (item.left < best.left ? item : best));
  }

  if (side === "right") {
    return intervals.reduce((best, item) => (item.right > best.right ? item : best));
  }

  let min = Infinity;
  let max = -Infinity;

  for (const point of contour) {
    min = Math.min(min, point.x);
    max = Math.max(max, point.x);
  }

  const middle = (min + max) / 2;

  return intervals.reduce((best, item) =>
    Math.abs((item.left + item.right) / 2 - middle) <
    Math.abs((best.left + best.right) / 2 - middle)
      ? item
      : best,
  );
}

/**
 * Ножка буквы: продолжение нижнего штриха вниз, а не общая планка.
 *
 * Все ножки растут от одной линии Y = −SIGN_FOOT_HEIGHT_MM до Y =
 * SIGN_FOOT_EMBED_MM. Поэтому вывеска стоит ровно, даже если у крайней буквы
 * есть выносной элемент ниже базовой линии: высота ножек не зависит от буквы.
 * Спереди ножка читается как удлинение нижнего штриха.
 */
function createFoot(
  interval: SignBottomInterval,
  depth: number,
): BufferGeometry | null {
  const width = Math.min(
    SIGN_FOOT_WIDTH_MM,
    interval.right - interval.left - 0.6,
  );

  if (width < 2) {
    return null;
  }

  const center = (interval.left + interval.right) / 2;
  const top = SIGN_FOOT_EMBED_MM;
  const bottom = -SIGN_FOOT_HEIGHT_MM;

  return extrudeRegion(
    [
      new Vector2(center - width / 2, bottom),
      new Vector2(center + width / 2, bottom),
      new Vector2(center + width / 2, top),
      new Vector2(center - width / 2, top),
    ],
    [],
    depth,
    0,
  );
}

/** Зазор паза крышки под клипсу: плюс — люфт, минус — натяг. */
function signRailClipClearance(mode: "detachable" | "fixed"): number {
  return mode === "detachable"
    ? SIGN_RAIL_CLIP_CLEARANCE_DETACHABLE_MM
    : SIGN_RAIL_CLIP_CLEARANCE_FIXED_MM;
}

/**
 * Клипса рельса: тонкая пластина 2 мм, утопленная в паз крышки.
 *
 * Клипса растёт из передней плоскости рельса, проходит сквозь паз крышки и на
 * SIGN_COVER_WELD_MM входит в заднюю плоскость лица. В собранном виде она не
 * выходит за габарит крышки с рельсом, поэтому спереди её не видно: наружу
 * торчит только паз, закрытый самой клипсой. Ширина 2 мм и высота 4 мм входят
 * в нижний штрих буквы.
 */
function createRailClip(
  centerX: number,
  railBottom: number,
): BufferGeometry {
  const front = -SIGN_COVER_WELD_MM;
  const back = SIGN_COVER_PLATE_MM + SIGN_COVER_WELD_MM;
  const bottom =
    railBottom + (SIGN_RAIL_HEIGHT_MM - SIGN_RAIL_CLIP_HEIGHT_MM) / 2;
  const top = bottom + SIGN_RAIL_CLIP_HEIGHT_MM;

  const geometry = extrudeRegion(
    [
      new Vector2(front, bottom),
      new Vector2(back, bottom),
      new Vector2(back, top),
      new Vector2(front, top),
    ],
    [],
    SIGN_RAIL_CLIP_WIDTH_MM,
    0,
  );

  // Локальная ось выдавливания становится мировой X, локальная X — мировой −Z:
  // клипса ложится поперёк рельса, а не вылезает вперёд.
  geometry.rotateY(Math.PI / 2);
  geometry.translate(centerX - SIGN_RAIL_CLIP_WIDTH_MM / 2, 0, 0);

  return geometry;
}

/**
 * Задний рельс блока: брус 6 × 4 мм с открытым назад каналом Ø4 мм.
 *
 * Рельс стоит целиком за крышками: передняя плоскость на z = −2 мм, задняя —
 * на z = −6 мм. Его длина равна ширине блока, то есть рельс не выходит за
 * крайние буквы ни слева, ни справа. Канал открыт в заднюю плоскость: при
 * толщине 4 мм закрытое отверстие Ø4 не оставило бы стенок. Провод и лента
 * заводятся сзади и остаются скрытыми за буквами.
 */
function createBlockRail(block: SignBlock, railBottom: number): BufferGeometry {
  const front = SIGN_COVER_PLATE_MM;
  const back = front + SIGN_RAIL_THICKNESS_MM;
  const top = railBottom + SIGN_RAIL_HEIGHT_MM;
  const channelCenter = new Vector2(
    back,
    railBottom + SIGN_RAIL_HEIGHT_MM / 2,
  );
  const channelRadius = SIGN_RAIL_WIRE_HOLE_MM / 2;
  const channel: Vector2[] = [];
  const channelSegments = 16;

  // Полуокружность от нижней кромки канала через самую глубокую точку к
  // верхней: она вырезает в задней стенке открытый желоб.
  for (let step = 0; step <= channelSegments; step += 1) {
    const angle = -Math.PI / 2 - (Math.PI * step) / channelSegments;

    channel.push(
      new Vector2(
        channelCenter.x + Math.cos(angle) * channelRadius,
        channelCenter.y + Math.sin(angle) * channelRadius,
      ),
    );
  }

  const geometry = extrudeRegion(
    [
      new Vector2(front, railBottom),
      new Vector2(back, railBottom),
      ...channel,
      new Vector2(back, top),
      new Vector2(front, top),
    ],
    [],
    block.width,
    0,
  );

  geometry.rotateY(Math.PI / 2);
  geometry.translate(block.left, 0, 0);

  return geometry;
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
  const firstIndex = letters[0].index;
  const lastIndex = letters[letters.length - 1].index;
  const railMode = params.signRailMode;

  /** Точка на нижнем штрихе, где крышка получит паз под клипсу рельса. */
  type RailMount = {
    x: number;
  };

  for (const block of blocks) {
    const bodies: BufferGeometry[] = [];
    const covers: BufferGeometry[] = [];
    const wireHoles: SignWireHole[] = [];
    const mounts: RailMount[] = [];
    const letterBounds: SignLetterBounds[] = [];
    const footBottoms: number[] = [];
    const clipClearance =
      railMode === "none"
        ? 0
        : signRailClipClearance(
            railMode === "detachable" ? "detachable" : "fixed",
          );
    let letterBottom = Infinity;
    let feet = 0;

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
      const letterMinY = box.min.y;

      letterBottom = Math.min(letterBottom, letterMinY);
      letterBounds.push({
        char: letter.char,
        left: letter.left,
        right: shift + box.max.x,
      });
      body.translate(shift, 0, 0);
      bodies.push(body);

      // Главная фигура глифа: у «Ё» и «Й» их две, ножка и клипса нужны только
      // на основной букве, а не на диакритическом знаке.
      let mainShape = glyph.shapes[0];

      for (const shape of glyph.shapes) {
        if (!mainShape) {
          mainShape = shape;
          continue;
        }

        const width = (points: Vector2[]) => {
          let min = Infinity;
          let max = -Infinity;

          for (const point of points) {
            min = Math.min(min, point.x);
            max = Math.max(max, point.x);
          }

          return max - min;
        };

        if (width(shape.outline) > width(mainShape.outline)) {
          mainShape = shape;
        }
      }

      let clipNotch: Vector2 | null = null;

      if (mainShape && railMode !== "none") {
        // Клипса стоит на нижнем штрихе: там материал идёт на всю глубину.
        // Ширина клипсы всего 2 мм, поэтому она помещается и в узкой букве.
        const interval = pickBottomInterval(
          mainShape.outline,
          SIGN_BOTTOM_PROBE_MM,
          "center",
        );

        if (
          interval &&
          interval.right - interval.left >= SIGN_RAIL_CLIP_WIDTH_MM + 0.6
        ) {
          const center = (interval.left + interval.right) / 2;

          clipNotch = new Vector2(center, SIGN_RAIL_HEIGHT_MM / 2);
          mounts.push({ x: shift + center });
        }
      }

      for (const shape of glyph.shapes) {
        const cover = createLetterCover(
          shape,
          shift,
          shape === mainShape ? clipNotch : null,
          clipClearance,
        );

        if (cover) {
          covers.push(cover.geometry);

          if (cover.wire) {
            wireHoles.push({
              ...cover.wire,
              center: cover.wire.center.clone().add(new Vector2(shift, 0)),
            });
          }
        }
      }

      if (mainShape) {
        const probeY = letterMinY + SIGN_BOTTOM_PROBE_MM;
        const first = letter.index === firstIndex;
        const last = letter.index === lastIndex;
        const sides: ("left" | "right" | "center")[] =
          railMode === "none"
            ? first && last
              ? ["left", "right"]
              : ["center"]
            : first && last
              ? ["left", "right"]
              : first
                ? ["left"]
                : last
                  ? ["right"]
                  : [];
        const used = new Set<number>();

        for (const side of sides) {
          const interval = pickBottomInterval(mainShape.outline, probeY, side);

          if (!interval) {
            continue;
          }

          const center = (interval.left + interval.right) / 2;
          const footKey = Math.round(center * 10);

          if (used.has(footKey)) {
            continue;
          }

          used.add(footKey);

          const foot = createFoot(interval, params.signDepth);

          if (foot) {
            foot.computeBoundingBox();

            if (foot.boundingBox) {
              footBottoms.push(foot.boundingBox.min.y);
            }

            foot.translate(shift, 0, 0);
            bodies.push(foot);
            feet += 1;
          }
        }

      }
    }

    if (!Number.isFinite(letterBottom)) {
      continue;
    }

    // Базовая линия шрифта — Y = 0. Рельс каждого блока идёт по ней ровно на
    // ширину блока: он скрыт за буквами и не образует общий брус через стыки.
    const railBottom = 0;
    let rail = createEmptyGeometry();
    let railCore: SignPartBounds | null = null;

    if (railMode !== "none") {
      const core = createBlockRail(block, railBottom);

      railCore = geometryBounds(core);

      const railBodies: BufferGeometry[] = [core];

      for (const mount of mounts) {
        railBodies.push(createRailClip(mount.x, railBottom));
      }

      rail = mergeBodies(railBodies) ?? createEmptyGeometry();
      wireHoles.push({
        center: new Vector2(
          block.left + block.width / 2,
          railBottom + SIGN_RAIL_HEIGHT_MM / 2,
        ),
        radius: SIGN_RAIL_WIRE_HOLE_MM / 2,
        source: "rail",
      });
    }

    const face = mergeBodies(bodies);
    const cover = mergeBodies(covers) ?? createEmptyGeometry();

    if (!face) {
      rail.dispose();
      cover.dispose();
      continue;
    }

    built.push({
      block,
      face,
      cover,
      rail,
      railCore,
      feet,
      footBottoms,
      letters: letterBounds,
      wireHoles,
    });
  }

  for (const glyph of cache.values()) {
    glyph.geometry.dispose();
  }

  return built;
}

/**
 * Подпись нормализованных параметров вывески.
 *
 * Отчёт раскладки приходит из сцены асинхронно, после загрузки шрифта. Подпись
 * не даёт применить старые габариты к новым параметрам: панель сверяет её перед
 * тем, как строить кнопки экспорта.
 */
export function signLayoutSignature(params: Partial<SignParams>): string {
  const normalized = normalizeSignParams(params);

  return [
    normalized.signText,
    normalized.signFont,
    normalized.signFontSize,
    normalized.signDepth,
    normalized.signChannelWidth,
    normalized.signLetterGap,
    normalized.signBlockSize,
    normalized.signRailMode,
  ].join("|");
}

/** Вариант упаковки: как повёрнуты детали и как они стоят друг к другу. */
type SignPackageCandidate = {
  arrangement: SignPackageArrangement;
  faceRotated: boolean;
  coverRotated: boolean;
};

/**
 * Порядок перебора раскладок.
 *
 * Сначала привычная: крышка над лицом, обе детали как в предпросмотре. Если
 * глубина больше 220 — крышка ставится рядом по X. Последний резерв — поворот
 * обеих деталей на 90° и боковая раскладка: так высокий пакет 120 «ИИ»
 * разворачивается и влезает на стол 220.
 */
const SIGN_PACKAGE_CANDIDATES: readonly SignPackageCandidate[] = [
  { arrangement: "stack", faceRotated: false, coverRotated: false },
  { arrangement: "side", faceRotated: false, coverRotated: false },
  { arrangement: "side", faceRotated: true, coverRotated: true },
  { arrangement: "stack", faceRotated: true, coverRotated: true },
  { arrangement: "side", faceRotated: false, coverRotated: true },
  { arrangement: "side", faceRotated: true, coverRotated: false },
  { arrangement: "stack", faceRotated: false, coverRotated: true },
  { arrangement: "stack", faceRotated: true, coverRotated: false },
];

/** Габарит пакета для одного варианта раскладки. */
function packageCandidateLayout(
  faceWidth: number,
  faceHeight: number,
  coverWidth: number,
  coverHeight: number,
  candidate: SignPackageCandidate,
): SignPackageLayout {
  const faceW = candidate.faceRotated ? faceHeight : faceWidth;
  const faceH = candidate.faceRotated ? faceWidth : faceHeight;
  const coverW = candidate.coverRotated ? coverHeight : coverWidth;
  const coverH = candidate.coverRotated ? coverWidth : coverHeight;
  const width =
    candidate.arrangement === "side"
      ? faceW + SIGN_PACKAGE_GAP_MM + coverW
      : Math.max(faceW, coverW);
  const depth =
    candidate.arrangement === "side"
      ? Math.max(faceH, coverH)
      : faceH + SIGN_PACKAGE_GAP_MM + coverH;

  return {
    ...candidate,
    width,
    depth,
    fits:
      width <= SIGN_PRINT_BED_MM + SIGN_EPSILON &&
      depth <= SIGN_PRINT_BED_MM + SIGN_EPSILON,
  };
}

/**
 * Выбор раскладки пакета по габаритам деталей.
 *
 * Если ни одна раскладка не влезает, возвращается самая компактная попытка:
 * панель показывает её размер и предупреждение, а API не выдаёт общий файл.
 */
export function planSignPackage(
  faceWidth: number,
  faceHeight: number,
  coverWidth: number,
  coverHeight: number,
): SignPackageLayout {
  const layouts = SIGN_PACKAGE_CANDIDATES.map((candidate) =>
    packageCandidateLayout(
      faceWidth,
      faceHeight,
      coverWidth,
      coverHeight,
      candidate,
    ),
  );
  const fitting = layouts.find((layout) => layout.fits);

  if (fitting) {
    return fitting;
  }

  return layouts.reduce((best, layout) => {
    const bestSpan = Math.max(best.width, best.depth);
    const span = Math.max(layout.width, layout.depth);

    if (span < bestSpan - SIGN_EPSILON) {
      return layout;
    }

    if (
      Math.abs(span - bestSpan) <= SIGN_EPSILON &&
      layout.width * layout.depth < best.width * best.depth
    ) {
      return layout;
    }

    return best;
  });
}

/** Габариты сетки; null — пустая сетка без position. */
function geometryBounds(geometry: BufferGeometry): SignPartBounds | null {
  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  // Пустая сетка после computeBoundingBox даёт бесконечные границы, а не null:
  // без этой проверки отчёт показывал бы крышку шириной −Infinity.
  if (
    !box ||
    box.isEmpty() ||
    !Number.isFinite(box.min.x) ||
    !Number.isFinite(box.max.x) ||
    !Number.isFinite(box.min.y) ||
    !Number.isFinite(box.max.y)
  ) {
    return null;
  }

  return {
    minX: box.min.x,
    maxX: box.max.x,
    minY: box.min.y,
    maxY: box.max.y,
    minZ: box.min.z,
    maxZ: box.max.z,
  };
}

/** Копия детали в начале координат: пакет собирается из независимых копий. */
function preparePackagePart(
  source: BufferGeometry,
  rotated: boolean,
): BufferGeometry {
  const geometry = source.clone();
  const first = geometryBounds(geometry);

  if (!first) {
    geometry.dispose();

    return new BufferGeometry();
  }

  geometry.translate(-first.minX, -first.minY, -first.minZ);

  if (rotated) {
    geometry.rotateZ(Math.PI / 2);
  }

  const second = geometryBounds(geometry);

  if (second) {
    geometry.translate(-second.minX, -second.minY, 0);
  }

  geometry.computeBoundingBox();

  return geometry;
}

/**
 * Сборка пакета из готовых деталей.
 *
 * Детали копируются, ставятся в начало координат, при необходимости
 * поворачиваются на 90° и разводятся зазором 6 мм. После этого весь пакет
 * центрируется по X и опускается на Y = 0; Z обеих деталей уже начинается с
 * нуля. Отчёт хранит габариты каждой детали, чтобы тест мог проверить зазор и
 * отсутствие пересечений.
 */
function packBlockParts(
  parts: SignBlockParts,
  layout: SignPackageLayout,
  report?: SignBlockPackageReport,
): BufferGeometry | null {
  const face = preparePackagePart(parts.face, layout.faceRotated);
  const cover = preparePackagePart(parts.cover, layout.coverRotated);
  const faceBox = geometryBounds(face);
  const coverBox = geometryBounds(cover);

  if (!faceBox || !coverBox) {
    face.dispose();
    cover.dispose();

    return null;
  }

  const faceWidth = faceBox.maxX - faceBox.minX;
  const faceHeight = faceBox.maxY - faceBox.minY;
  const coverWidth = coverBox.maxX - coverBox.minX;
  const width = layout.width;
  const faceX = layout.arrangement === "stack" ? (width - faceWidth) / 2 : 0;
  const coverX =
    layout.arrangement === "stack"
      ? (width - coverWidth) / 2
      : faceWidth + SIGN_PACKAGE_GAP_MM;
  const coverY =
    layout.arrangement === "stack" ? faceHeight + SIGN_PACKAGE_GAP_MM : 0;

  face.translate(faceX, 0, 0);
  cover.translate(coverX, coverY, 0);

  const positionedFace = geometryBounds(face);
  const positionedCover = geometryBounds(cover);

  if (!positionedFace || !positionedCover) {
    face.dispose();
    cover.dispose();

    return null;
  }

  const shiftX = -(
    Math.min(positionedFace.minX, positionedCover.minX) +
    Math.max(positionedFace.maxX, positionedCover.maxX)
  ) / 2;
  const shiftY = -Math.min(positionedFace.minY, positionedCover.minY);

  face.translate(shiftX, shiftY, 0);
  cover.translate(shiftX, shiftY, 0);

  const faceBounds = geometryBounds(face);
  const coverBounds = geometryBounds(cover);

  if (!faceBounds || !coverBounds) {
    face.dispose();
    cover.dispose();

    return null;
  }

  if (report) {
    const overlap = (aMin: number, aMax: number, bMin: number, bMax: number) =>
      aMin < bMax - SIGN_EPSILON && bMin < aMax - SIGN_EPSILON;

    report.layout = layout;
    report.face = faceBounds;
    report.cover = coverBounds;
    report.intersects =
      overlap(
        faceBounds.minX,
        faceBounds.maxX,
        coverBounds.minX,
        coverBounds.maxX,
      ) &&
      overlap(
        faceBounds.minY,
        faceBounds.maxY,
        coverBounds.minY,
        coverBounds.maxY,
      ) &&
      overlap(
        faceBounds.minZ,
        faceBounds.maxZ,
        coverBounds.minZ,
        coverBounds.maxZ,
      );
  }

  const merged = mergeBodies([face, cover]);

  if (merged) {
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
  }

  return merged;
}

/** Отчёт по блоку без сборки пакета: габариты и отверстия для панели. */
function blockLayoutReport(parts: SignBlockParts): SignBlockLayoutReport | null {
  const face = geometryBounds(parts.face);

  if (!face) {
    return null;
  }

  const cover = geometryBounds(parts.cover);
  const rail = parts.railCore;
  const faceWidth = face.maxX - face.minX;
  const faceHeight = face.maxY - face.minY;
  const coverWidth = cover ? cover.maxX - cover.minX : 0;
  const coverHeight = cover ? cover.maxY - cover.minY : 0;

  return {
    blockIndex: parts.block.index,
    faceWidth,
    faceHeight,
    coverWidth,
    coverHeight,
    rail,
    feet: parts.feet,
    footBottoms: parts.footBottoms,
    letters: parts.letters,
    package: planSignPackage(faceWidth, faceHeight, coverWidth, coverHeight),
    wireHoles: parts.wireHoles.map((wire) => ({
      blockIndex: parts.block.index,
      x: wire.center.x,
      y: wire.center.y,
      radius: wire.radius,
      source: wire.source,
      through: true,
    })),
  };
}

/**
 * Общий STL блока: лицо и крышка одним файлом.
 *
 * null — пакет не помещается на стол 220 мм даже после поворота. API отвечает
 * на такой запрос 422, а панель не показывает кнопку и оставляет отдельные
 * файлы. Возвращённая сетка уже стоит в начале координат: X центрирован,
 * Y и Z начинаются с нуля.
 */
export function createSignBlockPackageGeometry(
  params: Partial<SignParams>,
  font: Font | null = null,
  blockIndex = 0,
  report?: SignBlockPackageReport,
): BufferGeometry | null {
  const built = buildSignBlockParts(normalizeSignParams(params), font);

  if (!built) {
    return null;
  }

  const parts = built.find((item) => item.block.index === blockIndex);

  if (!parts) {
    return null;
  }

  const face = geometryBounds(parts.face);
  const cover = geometryBounds(parts.cover);

  if (!face) {
    return null;
  }

  const layout = planSignPackage(
    face.maxX - face.minX,
    face.maxY - face.minY,
    cover ? cover.maxX - cover.minX : 0,
    cover ? cover.maxY - cover.minY : 0,
  );

  if (!layout.fits) {
    return null;
  }

  // У сплошной буквы крышки нет: пакет — это только лицо с ножками.
  if (!cover) {
    const onlyFace = preparePackagePart(parts.face, layout.faceRotated);

    return placeOnBed(onlyFace);
  }

  return packBlockParts(parts, layout, report);
}

/**
 * Собранная надпись одной сеткой: предпросмотр.
 *
 * Блоки стоят с равномерным трекингом, шипы входят в пазы — предпросмотр
 * показывает именно то, что получится после печати. В сборку входят лицо,
 * крышки и рельс: так подпись веса учитывает все детали, а сзади не остаётся
 * открытых камер.
 *
 * font = null допустим: шрифт ещё грузится, и пустая сетка честнее плиты,
 * которой в модели больше нет. report заполняется для панели: по нему видно,
 * какие блоки можно скачать одним файлом и где проходят отверстия под провод.
 */
export function createSignGeometry(
  params: Partial<SignParams>,
  font: Font | null = null,
  report?: SignLayoutReport,
): BufferGeometry {
  const normalized = normalizeSignParams(params);
  const built = buildSignBlockParts(normalized, font);

  if (report) {
    report.signature = signLayoutSignature(normalized);
    report.blocks = (built ?? [])
      .map(blockLayoutReport)
      .filter((block): block is SignBlockLayoutReport => block !== null);
  }

  if (!built) {
    return createEmptyGeometry();
  }

  // В предпросмотр входит вся печатная сборка: лицо, крышки и рельс. Иначе
  // подпись веса занижает расход пластика, а сзади видны незакрытые камеры.
  const previewBodies = built.flatMap((parts) =>
    [parts.face, parts.cover, parts.rail].filter(
      (body) => body.getAttribute("position") !== undefined,
    ),
  );
  const merged = mergeBodies(previewBodies);

  return merged ? placeOnBed(merged) : createEmptyGeometry();
}

/**
 * Деталь блока: лицо с буквами, задняя крышка или рельс.
 *
 * Номер блока — как в listSignBlocks, деталь — `face`, `cover` или `rail`.
 * Геометрия собирается по всей надписи, потому что кегль зависит от длины
 * строки: файл блока совпадает с тем блоком, который видно в предпросмотре.
 * Номер вне списка даёт пустую сетку — API отсекает такие запросы раньше.
 *
 * `package` поддерживается для полноты контракта, но API собирает его через
 * createSignBlockPackageGeometry: только она умеет отличить «не влезает» от
 * пустой геометрии и вернуть 422.
 */
export function createSignBlockGeometry(
  params: Partial<SignParams>,
  font: Font | null = null,
  blockIndex = 0,
  part: SignPart = "face",
): BufferGeometry {
  if (part === "package") {
    return (
      createSignBlockPackageGeometry(params, font, blockIndex) ??
      createEmptyGeometry()
    );
  }

  const built = buildSignBlockParts(normalizeSignParams(params), font);

  if (!built) {
    return createEmptyGeometry();
  }

  const parts = built.find((item) => item.block.index === blockIndex);

  if (!parts) {
    return createEmptyGeometry();
  }

  return placeOnBed(
    part === "cover" ? parts.cover : part === "rail" ? parts.rail : parts.face,
  );
}
