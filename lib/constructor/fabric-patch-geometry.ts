import { BufferGeometry, Float32BufferAttribute } from "three";

import {
  normalizeFabricPatchParams,
  type FabricPatchParams,
  type PatchShape,
} from "@/lib/constructor/params";
import {
  addCylinder,
  addRingPrism,
  addSolidPrism,
  polygonAcrossFlats,
  type Point2,
} from "@/lib/constructor/prism-mesh";

/**
 * Геометрия тканевой нашивки.
 *
 * Плита — плоская основа, по её краю лежит бортик, а по бортику идут стежки:
 * выпуклые точки на месте машинной строчки. Отверстий под нить нет — в проекте
 * нет булевых операций, — но стежки ставятся ровно там, где прошла бы игла,
 * поэтому нашивка читается как тканая.
 *
 * Плита, бортик и стежки — отдельные замкнутые тела. Каждое входит в соседнее
 * на доли миллиметра, поэтому слайсер печатает их одной деталью: поддерживать
 * нечего, деталь плоская.
 *
 * Деталь построена Z-вверх; предпросмотр поворачивает меш, как подставку.
 */

/** Ширина бортика от края к центру, мм: на нём помещается строчка. */
const PATCH_BORDER_WIDTH_MM = 4;

/** Высота бортика над плитой, мм: край читается на ощупь и не мешает печати. */
const PATCH_BORDER_HEIGHT_MM = 1;

/** Насколько бортик входит в плиту, мм: плоскости не совпадают. */
const PATCH_BORDER_JOIN_MM = 0.6;

/** Радиус стежка, мм: точка Ø 1.8 мм видна на бортике 4 мм. */
const PATCH_STITCH_RADIUS_MM = 0.9;

/** Насколько стежок выступает над бортиком, мм. */
const PATCH_STITCH_LIFT_MM = 0.7;

/** Насколько стежок входит в плиту, мм: точка держится за бортик. */
const PATCH_STITCH_JOIN_MM = 0.4;

/** Число сторон стежка, шт.: 16 отрезков дают ровный кружок. */
const PATCH_STITCH_SIDES = 16;

/** Число сторон круглого сечения нашивки: 64 отрезка дают ровный край. */
const PATCH_ROUND_SIDES = 64;

/** Число сторон сечения по форме: квадрат и шестигранник точные. */
const PATCH_SIDES: Record<PatchShape, number> = {
  round: PATCH_ROUND_SIDES,
  square: 4,
  hex: 6,
};

/** Квадрат повёрнут на 45°, чтобы грани смотрели по осям, как у кашпо. */
const PATCH_START_ANGLE: Record<PatchShape, number> = {
  round: 0,
  square: Math.PI / 4,
  hex: 0,
};

/**
 * Точка на контуре на заданном расстоянии от начала.
 *
 * Стежки раскладываются равномерно по периметру: шаг считается от общей длины
 * контура, поэтому на квадрате точки идут по всем четырём сторонам, а на круге
 * и шестиграннике — по всем граням без сгустков на углах.
 */
function pointOnPerimeter(points: readonly Point2[], distance: number): Point2 {
  const lengths = points.map(([x0, y0], index) => {
    const [x1, y1] = points[(index + 1) % points.length];

    return Math.hypot(x1 - x0, y1 - y0);
  });
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = ((distance % perimeter) + perimeter) % perimeter;

  for (let index = 0; index < points.length; index += 1) {
    const length = lengths[index];

    if (remaining <= length) {
      const [x0, y0] = points[index];
      const [x1, y1] = points[(index + 1) % points.length];
      const t = length === 0 ? 0 : remaining / length;

      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
    }

    remaining -= length;
  }

  return points[0];
}

/** Длина периметра контура, мм: по ней считается шаг стежков. */
function perimeterLength(points: readonly Point2[]): number {
  return points.reduce((sum, [x0, y0], index) => {
    const [x1, y1] = points[(index + 1) % points.length];

    return sum + Math.hypot(x1 - x0, y1 - y0);
  }, 0);
}

/**
 * Геометрия нашивки для набора параметров.
 *
 * Функция принимает частичные параметры: недостающие поля берутся из значений
 * по умолчанию, поэтому предпросмотр может вызвать её с любым набором.
 */
export function createFabricPatchGeometry(
  params: Partial<FabricPatchParams>,
): BufferGeometry {
  const normalized = normalizeFabricPatchParams(params);
  const positions: number[] = [];
  const sides = PATCH_SIDES[normalized.patchShape];
  const startAngle = PATCH_START_ANGLE[normalized.patchShape];
  const thickness = normalized.patchThickness;
  const outer = polygonAcrossFlats(normalized.patchSize, sides, startAngle);

  addSolidPrism(positions, outer, 0, thickness);

  const borderTop = thickness + PATCH_BORDER_HEIGHT_MM;
  const stitches = Math.max(0, Math.round(normalized.patchStitches));

  if (normalized.patchBorder) {
    const innerBorder = polygonAcrossFlats(
      normalized.patchSize - PATCH_BORDER_WIDTH_MM * 2,
      sides,
      startAngle,
    );

    addRingPrism(
      positions,
      outer,
      innerBorder,
      thickness - PATCH_BORDER_JOIN_MM,
      borderTop,
    );
  }

  if (stitches > 0) {
    // Строчка идёт по середине бортика; без бортика — на том же отступе от
    // края, чтобы включение бортика не сдвигало стежки.
    const stitchLine = polygonAcrossFlats(
      normalized.patchSize - PATCH_BORDER_WIDTH_MM,
      sides,
      startAngle,
    );
    const perimeter = perimeterLength(stitchLine);
    const top = normalized.patchBorder ? borderTop : thickness;

    for (let index = 0; index < stitches; index += 1) {
      const [x, y] = pointOnPerimeter(
        stitchLine,
        (perimeter * index) / stitches,
      );

      addCylinder(
        positions,
        [x, y, top - PATCH_STITCH_JOIN_MM],
        [x, y, top + PATCH_STITCH_LIFT_MM],
        PATCH_STITCH_RADIUS_MM,
        PATCH_STITCH_SIDES,
      );
    }
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  return geometry;
}
