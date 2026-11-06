import { ExtrudeGeometry } from "three";
import type { BufferGeometry, Shape } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { calculateGeometryVolumeMm3 } from "@/lib/constructor/geometry-volume";
import {
  normalizeHeatTransferParams,
  type HeatTransferParams,
} from "@/lib/constructor/params";
import {
  buildShapes,
  groupContours,
  type ContourGroup,
} from "@/lib/constructor/shape-utils";
import {
  parseSvgOutline,
  type OutlinePoint,
} from "@/lib/constructor/svg-outline";

/**
 * Геометрия термопринта: контуры логотипа, выдавленные в тонкую наклейку.
 *
 * Деталь лежит в плоскости XY и растёт по Z от 0 до толщины — нижняя грань стоит
 * на столе слайсера, резать можно сразу. Оси общие с брелоком, поэтому
 * предпросмотр поворачивает меш так же, как плоские модели.
 *
 * Раскладка своя, не брелочная: у принта нет ушка и фаски, зато ширина и высота
 * задаются отдельно. Контуры масштабируются по осям независимо, потому что
 * `heatTransferWidth` и `heatTransferHeight` — это габарит детали, а не масштаб
 * SVG: панель подставляет пропорции при загрузке файла, а дальше пользователь
 * меняет стороны сам. Ось Y переворачивается: в SVG она смотрит вниз, на столе —
 * вверх.
 *
 * Толщина кратна слоям 0.2 мм, фаски нет: на 0.2–0.8 мм любое скругление съело
 * бы половину стенки, а слайсер и так кладёт эти миллиметры слоями. Детали
 * мельче сопла (0.4 мм) отбрасываются — из них получился бы наплыв, а не
 * логотип.
 */

/** Толщина одного слоя печати, мм: та же высота слоя, что у слайсера. */
export const HEAT_TRANSFER_LAYER_MM = 0.2;

/** Минимальный габарит детали, мм: тоньше сопла пластик не встанет. */
export const HEAT_TRANSFER_MIN_PART_MM = 0.4;

/** Габарит набора точек по осям: в единицах viewBox или в миллиметрах. */
type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/** Считает габарит контура по обеим осям. */
function contourBounds(points: readonly OutlinePoint[]): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Толщина принта по числу слоёв, мм.
 *
 * Слои считаются от одного: 1 → 0.2 мм, 4 → 0.8 мм. Число округляется к целому:
 * дробное значение не бывает высотой слоя в слайсере, а 3 × 0.2 в двоичной
 * арифметике даёт 0.6000000000000001 — поэтому результат фиксируется на двух
 * знаках, иначе толщина в STL не совпадёт с подписью слайдера.
 */
export function heatTransferThickness(layers: number): number {
  const count = Math.max(1, Math.round(layers));

  return Number((count * HEAT_TRANSFER_LAYER_MM).toFixed(2));
}

/**
 * Переносит контуры SVG в миллиметры: центр габарита — в начало координат, Y
 * переворачивается, стороны масштабируются независимо.
 *
 * Пустой результат означает, что у контуров нет площади (точка или отрезок):
 * вызывающий обязан превратить это в понятную ошибку, а не в пустой STL.
 */
function transformContours(
  contours: readonly (readonly OutlinePoint[])[],
  params: HeatTransferParams,
): OutlinePoint[][] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const contour of contours) {
    const box = contourBounds(contour);

    minX = Math.min(minX, box.minX);
    maxX = Math.max(maxX, box.maxX);
    minY = Math.min(minY, box.minY);
    maxY = Math.max(maxY, box.maxY);
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;

  if (
    !Number.isFinite(spanX) ||
    !Number.isFinite(spanY) ||
    spanX <= 0 ||
    spanY <= 0
  ) {
    return [];
  }

  const scaleX = params.heatTransferWidth / spanX;
  const scaleY = params.heatTransferHeight / spanY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const mirror = params.heatTransferMirror;
  // Переворот Y сам по себе разворачивает обход, а зеркало по X возвращает его
  // обратно: два отражения — это поворот на 180°. Контур разворачивается ровно
  // тогда, когда обход оказался вывернутым, поэтому внешний контур остаётся
  // внешним и для того, кто смотрит только на знак площади.
  const reverseWinding = !mirror;

  return contours.map((contour) => {
    const points = contour.map(
      ([x, y]) =>
        [
          (x - centerX) * scaleX * (mirror ? -1 : 1),
          (centerY - y) * scaleY,
        ] as const,
    );

    return reverseWinding ? points.reverse() : points;
  });
}

/** Проходит ли контур порог сопла по обеим сторонам габарита. */
function isPrintableContour(points: readonly OutlinePoint[]): boolean {
  const box = contourBounds(points);

  return (
    Math.min(box.maxX - box.minX, box.maxY - box.minY) >=
    HEAT_TRANSFER_MIN_PART_MM
  );
}

/**
 * Оставляет печатаемые группы и отверстия.
 *
 * Отбрасывается именно деталь, а не отдельный контур: крошечный островок — это
 * самостоятельная группа, а крошечное отверстие схлопнулось бы в дырку с
 * заплывшими краями. Такое отверстие убирается из группы, и силуэт печатается
 * залитым: буква «О» с волосяным просветом выходит сплошной, но целой.
 */
function printableGroups(groups: readonly ContourGroup[]): ContourGroup[] {
  return groups
    .filter((group) => isPrintableContour(group.outer))
    .map((group) => ({
      outer: group.outer,
      holes: group.holes.filter(isPrintableContour),
    }));
}

/**
 * Выдавливает контур на толщину принта.
 *
 * `bevelEnabled: false` — не упрощение, а требование: 0.2 мм — это один слой, и
 * фаска 0.1 мм превратила бы деталь в клин. `steps: 1` даёт ровную стенку без
 * промежуточных колец, а контуры приходят ломаными, поэтому `curveSegments` не
 * влияет ни на что.
 */
function extrudeShape(shape: Shape, height: number): BufferGeometry {
  return new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth: height,
    steps: 1,
  });
}

/**
 * Геометрия термопринта для набора параметров.
 *
 * Функция принимает частичные параметры: недостающие поля берутся из значений по
 * умолчанию, поэтому и панель, и серверный роут вызывают её одинаково.
 *
 * Пустая разметка — ошибка, а не повод собрать заглушку: контур здесь
 * единственный источник формы, запасного жетона, как у брелока, нет. То же с
 * мелкими деталями: если после фильтра ничего не осталось, файл был бы пустым,
 * поэтому пользователь получает текст про линии тоньше 0.4 мм.
 */
export function createHeatTransferGeometry(
  params: Partial<HeatTransferParams>,
): BufferGeometry {
  const normalized = normalizeHeatTransferParams(params);

  if (normalized.heatTransferSvg === "") {
    throw new Error("Логотип не загружен: у термопринта нет своей формы");
  }

  const contours = parseSvgOutline(normalized.heatTransferSvg);

  if (contours.length === 0) {
    throw new Error("Не удалось разобрать контуры логотипа");
  }

  const transformed = transformContours(contours, normalized);

  if (transformed.length === 0) {
    throw new Error("У логотипа нет площади: контур сводится к точке или линии");
  }

  const groups = printableGroups(groupContours(transformed));

  if (groups.length === 0) {
    throw new Error(
      "Логотип состоит из линий тоньше 0.4 мм: упростите его или увеличьте размер",
    );
  }

  const height = heatTransferThickness(normalized.heatTransferLayers);
  const parts = buildShapes(groups).map((shape) => extrudeShape(shape, height));
  const merged = mergeGeometries(parts);

  for (const part of parts) {
    part.dispose();
  }

  if (!merged) {
    throw new Error("Не удалось собрать геометрию термопринта");
  }

  merged.computeBoundingBox();

  // Объём проверяется после сборки: нулевой означал бы вывернутые нормали или
  // разошедшиеся оболочки, а такой STL слайсер не нарежет. Знак здесь не важен:
  // calculateGeometryVolumeMm3 уже возвращает модуль.
  if (calculateGeometryVolumeMm3(merged) <= 0) {
    merged.dispose();

    throw new Error("Геометрия термопринта получилась без объёма");
  }

  return merged;
}
