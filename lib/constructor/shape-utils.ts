import { Path, Shape } from "three";

import {
  isPointInsideOutline,
  outlineArea,
  type OutlinePoint,
} from "@/lib/constructor/svg-outline";

/**
 * Общие операции над замкнутыми контурами: вложенность, `THREE.Shape`, отверстия.
 *
 * Файл появился из `keychain-geometry.ts`: брелок и heat-transfer строят
 * плоскую деталь из SVG-контуров одним и тем же способом. Разница только в
 * раскладке контуров в миллиметры — она остаётся в геометрии конкретной модели,
 * потому что у брелока резервируется место под ушко и учитывается фаска, а у
 * принта свои ширина, высота и зеркало.
 *
 * Здесь нет ни одного числа модели: только контуры и формы.
 */

/** Внешний контур силуэта и отверстия внутри него. */
export type ContourGroup = {
  outer: OutlinePoint[];
  holes: OutlinePoint[][];
};

/** Центр контура: средняя точка, по ней определяется вложенность. */
function contourCenter(points: readonly OutlinePoint[]): OutlinePoint {
  let x = 0;
  let y = 0;

  for (const point of points) {
    x += point[0];
    y += point[1];
  }

  return [x / points.length, y / points.length];
}

/**
 * Делит контуры на внешние и отверстия по правилу чётности.
 *
 * Вложенность считается по центру контура: контур внутри другого — отверстие,
 * отверстие внутри отверстия снова становится телом. Каждое отверстие
 * привязывается к ближайшему внешнему контуру с наименьшей площадью, поэтому
 * глаз рыбы или окно ракеты не «прилипают» к чужому силуэту.
 */
export function groupContours(
  contours: readonly OutlinePoint[][],
): ContourGroup[] {
  const centers = contours.map(contourCenter);
  const areas = contours.map((contour) => Math.abs(outlineArea(contour)));
  // Вложенность считается по вершине контура, а не по центру: у кольца центр
  // внешнего прямоугольника лежит внутри отверстия, и по центру внешний
  // контур ошибочно стал бы дырой. Контейнер обязан быть больше по площади,
  // поэтому концентрические окружности не путают направления вложенности.
  const depths = contours.map((contour, index) =>
    contours.reduce((depth, other, otherIndex) => {
      if (otherIndex === index || areas[otherIndex] <= areas[index]) {
        return depth;
      }

      return isPointInsideOutline(contour[0], [other]) ? depth + 1 : depth;
    }, 0),
  );
  const groups: ContourGroup[] = [];

  contours.forEach((contour, index) => {
    if (depths[index] % 2 === 0) {
      groups.push({ outer: [...contour], holes: [] });
    }
  });

  contours.forEach((contour, index) => {
    if (depths[index] % 2 === 0) {
      return;
    }

    let target: ContourGroup | null = null;
    let targetArea = Infinity;

    for (const group of groups) {
      if (!isPointInsideOutline(centers[index], [group.outer])) {
        continue;
      }

      const area = Math.abs(outlineArea(group.outer));

      if (area < targetArea) {
        target = group;
        targetArea = area;
      }
    }

    target?.holes.push([...contour]);
  });

  return groups;
}

/** Shape из набора точек: обход замыкается через closePath. */
export function createShape(points: readonly OutlinePoint[]): Shape {
  const shape = new Shape();
  const [first, ...rest] = points;

  shape.moveTo(first[0], first[1]);

  for (const point of rest) {
    shape.lineTo(point[0], point[1]);
  }

  shape.closePath();

  return shape;
}

/** Path отверстия из набора точек. */
export function createHolePath(points: readonly OutlinePoint[]): Path {
  const path = new Path();
  const [first, ...rest] = points;

  path.moveTo(first[0], first[1]);

  for (const point of rest) {
    path.lineTo(point[0], point[1]);
  }

  path.closePath();

  return path;
}

/**
 * Собирает THREE.Shape из групп контуров, при необходимости с лишними отверстиями.
 *
 * `extraHoles` вызывается для каждой группы и возвращает готовые пути, которые
 * добавляются после отверстий самого контура. Брелок передаёт сюда карман под
 * NFC-метку: он вырезается только в том силуэте, внутри которого стоит его
 * центр. Остальным моделям параметр не нужен.
 */
export function buildShapes(
  groups: readonly ContourGroup[],
  extraHoles?: (outer: readonly OutlinePoint[]) => readonly Path[],
): Shape[] {
  return groups.map((group) => {
    const shape = createShape(group.outer);

    for (const hole of group.holes) {
      shape.holes.push(createHolePath(hole));
    }

    if (extraHoles) {
      for (const path of extraHoles(group.outer)) {
        shape.holes.push(path);
      }
    }

    return shape;
  });
}
