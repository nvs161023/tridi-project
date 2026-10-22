import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  normalizePenHolderParams,
  type PenHolderParams,
  type PenShape,
} from "@/lib/constructor/params";
import {
  addRingPrism,
  addSolidPrism,
  polygonAcrossFlats,
  type Point2,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия органайзера для ручек.
 *
 * Деталь собирается из трёх частей: плита дна, кольцо-стена и перегородки.
 * Между стенкой и дном остаётся открытая полость, перегородки делят её на
 * отделения. Каждая часть — замкнутое тело, которое входит в соседнее на доли
 * миллиметра: булевых операций в проекте нет, тела объединяет слайсер.
 *
 * Перегородки не выходят за полость: их длина считается по хорде внутреннего
 * контура, поэтому в круглом стаканчике крайние перегородки короче средних.
 * Верх перегородки на миллиметр ниже кромки — по краю остаётся ровный борт.
 *
 * Деталь построена Z-вверх, как кашпо и коробка: предпросмотр поворачивает меш.
 */

/** Толщина дна, мм: держит вес ручек и не прогибается. */
const PEN_FLOOR_MM = 3;

/** Насколько стенка приподнята над столом, мм: плоскости дна и стенки не совпадают. */
const PEN_JOIN_MM = 0.6;

/** Насколько перегородка входит в стенку, мм: запас на слияние тел. */
const PEN_DIVIDER_JOIN_MM = 0.6;

/** Отступ верха перегородки от кромки, мм: борт остаётся ровным. */
const PEN_DIVIDER_TOP_MARGIN_MM = 1;

/** Число сторон круглого сечения: 64 отрезка дают гладкую стенку. */
const PEN_ROUND_SIDES = 64;

/** Число сторон сечения по форме: квадрат и шестигранник точные. */
const PEN_SIDES: Record<PenShape, number> = {
  round: PEN_ROUND_SIDES,
  square: 4,
  hex: 6,
};

/** Квадрат повёрнут на 45°, чтобы грани смотрели по осям, как у кашпо. */
const PEN_START_ANGLE: Record<PenShape, number> = {
  round: 0,
  square: Math.PI / 4,
  hex: 0,
};

/**
 * Полухорда выпуклого контура на вертикальной прямой.
 *
 * Перегородка — плита постоянной толщины по X, а её длина по Y ограничена
 * стенкой. Считаем пересечения контура с прямой `x` и берём меньшую из двух
 * полухорд: так углы плиты не выходят наружу даже у круга и шестигранника.
 */
function halfChordAtX(points: readonly Point2[], x: number): number {
  const crossings: number[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[(index + 1) % points.length];

    if (x0 === x1) {
      continue;
    }

    if ((x0 - x) * (x1 - x) <= 0) {
      const t = (x - x0) / (x1 - x0);

      crossings.push(y0 + (y1 - y0) * t);
    }
  }

  if (crossings.length < 2) {
    return 0;
  }

  const low = Math.min(...crossings);
  const high = Math.max(...crossings);

  return Math.min(high, -low);
}

/**
 * Геометрия органайзера для набора параметров.
 *
 * Функция принимает частичные параметры: недостающие поля берутся из значений
 * по умолчанию, поэтому предпросмотр может вызвать её с любым набором.
 */
export function createPenHolderGeometry(
  params: Partial<PenHolderParams>,
): BufferGeometry {
  const normalized = normalizePenHolderParams(params);
  const positions: number[] = [];
  const sides = PEN_SIDES[normalized.penShape];
  const startAngle = PEN_START_ANGLE[normalized.penShape];
  const wall = normalized.penWall;
  const height = normalized.penHeight;
  const outer = polygonAcrossFlats(normalized.penSize, sides, startAngle);
  const inner = polygonAcrossFlats(
    normalized.penSize - wall * 2,
    sides,
    startAngle,
  );

  addSolidPrism(positions, outer, 0, PEN_FLOOR_MM);
  addRingPrism(positions, outer, inner, PEN_JOIN_MM, height);

  const interiorWidth = normalized.penSize - wall * 2;
  const sections = Math.max(1, Math.round(normalized.penSections));
  const dividerTop = height - PEN_DIVIDER_TOP_MARGIN_MM;

  for (let section = 1; section < sections; section += 1) {
    const centerX = -interiorWidth / 2 + (interiorWidth * section) / sections;
    const leftX = centerX - wall / 2;
    const rightX = centerX + wall / 2;
    const halfLength =
      Math.min(halfChordAtX(inner, leftX), halfChordAtX(inner, rightX)) +
      PEN_DIVIDER_JOIN_MM;

    if (halfLength <= wall / 2) {
      continue;
    }

    // Прямоугольник перегородки обходится против часовой стрелки, если смотреть
    // сверху: призма получает наружные нормали, как у остальных плит.
    const divider: Point2[] = [
      [leftX, -halfLength],
      [rightX, -halfLength],
      [rightX, halfLength],
      [leftX, halfLength],
    ];

    addSolidPrism(positions, divider, PEN_JOIN_MM, dividerTop);
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}
