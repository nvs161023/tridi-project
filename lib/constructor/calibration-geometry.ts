import {
  BoxGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
  Vector2,
} from "three";
import type { BufferGeometry } from "three";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  normalizeCalibrationParams,
  type CalibrationParams,
  type CalibrationType,
} from "@/lib/constructor/params";

/**
 * Шрифт башни — тот же Roboto Bold, что у брелока и вывески.
 *
 * Константа лежит здесь, а не импортируется из keychain-geometry: модуль
 * калибровки не должен тянуть за собой генератор брелока со всеми его
 * размерами. Файл один, поэтому превью загружает его один раз на страницу.
 */
export const CALIBRATION_FONT_URL = "/fonts/cyrillic.typeface.json";

/** Высота одной ступени: 12 мм даёт заметный участок для смены настройки. */
const BLOCK_HEIGHT_MM = 12;

/** Ширина нижней ступени: на ней помещается даже длинная подпись «230 °C». */
const BASE_WIDTH_MM = 46;

/** Ширина верхней ступени: уже неё подпись с полями не помещается. */
const TOP_WIDTH_MM = 32;

/** Глубина башни постоянна: передние грани всех ступеней в одной плоскости. */
const DEPTH_MM = 30;

/** Поле между подписью и краем ступени, чтобы буквы не выходили за грань. */
const PANEL_INSET_MM = 0.6;

/** Кегль подписи до автоподгонки под узкую верхнюю ступень. */
const LABEL_FONT_SIZE_MM = 5.6;

/** Насколько подпись выступает над передней гранью ступени. */
const LABEL_RELIEF_MM = 0.5;

/** Подпись входит в ступень, чтобы её оболочка не касалась только плоскостью. */
const LABEL_EMBED_MM = 0.4;

/** Полигонов на кривую шрифта: при кегле 5.6 мм контур остаётся гладким. */
const TEXT_CURVE_SEGMENTS = 8;

/** Сегментов у окружности градуса: маленькое кольцо не требует больше. */
const RING_SEGMENTS = 24;

/** Доля кегля: внешний и внутренний радиус кольца градуса. */
const RING_OUTER_RATIO = 0.18;
const RING_INNER_RATIO = 0.095;

/** Высота центра кольца над базовой линией текста, в долях кегля. */
const RING_CENTER_RATIO = 0.58;

/** Пробел между смысловыми частями подписи, в долях кегля. */
const LABEL_GAP_RATIO = 0.08;

/** Точка контура: шрифт и кольцо дают одинаковый формат. */
type Contour = Vector2[];

/** Замкнутая фигура подписи: внешний контур и отверстия внутри него. */
type LabelShape = { outline: Contour; holes: Contour[] };

/** Разложенная подпись: отдельные фигуры (глифы и кольцо градуса). */
type LabelContours = {
  shapes: LabelShape[];
};

/** Прямоугольные границы набора точек. */
type ContourBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Часть подписи: текст из шрифта или нарисованное кольцо градуса. */
type LabelPart =
  | { kind: "text"; text: string }
  | { kind: "ring" };

/** Контуры одной глифы: внешний контур и отверстия внутри неё. */
type GlyphContours = { outline: Contour; holes: Contour[] };

/** Разложенная часть подписи с шириной для расстановки слева направо. */
type LabelLayoutPart =
  | {
      kind: "text";
      glyphs: GlyphContours[];
      bounds: ContourBounds | null;
      width: number;
    }
  | {
      kind: "ring";
      ring: LabelShape;
      width: number;
    };

/**
 * Значение на ступени от нижней к верхней.
 *
 * Температуру округляем до целого градуса, ретракт — до 0.1 мм: больше
 * точности слайсер всё равно не даёт, а лишние знаки на грани не читаются.
 */
function valueAtStep(
  type: CalibrationType,
  startValue: number,
  endValue: number,
  index: number,
  steps: number,
): number {
  const ratio = steps === 1 ? 0 : index / (steps - 1);
  const raw = startValue + (endValue - startValue) * ratio;

  return type === "temperature"
    ? Math.round(raw)
    : Math.round(raw * 10) / 10;
}

/** Подпись ступени: «220» для температуры или «2.0» для ретракта. */
function labelValue(type: CalibrationType, value: number): string {
  return type === "temperature" ? String(value) : value.toFixed(1);
}

/** Части подписи: цифры и буквы берём из шрифта, градус рисуем кольцом. */
function labelParts(type: CalibrationType, value: number): LabelPart[] {
  const number = labelValue(type, value);

  if (type === "temperature") {
    return [
      { kind: "text", text: number },
      { kind: "ring" },
      { kind: "text", text: "C" },
    ];
  }

  return [
    { kind: "text", text: number },
    { kind: "text", text: "mm" },
  ];
}

/** Точки контура шрифта: внешний контур или отверстие внутри цифры. */
function textContours(
  font: Font,
  text: string,
  size: number,
): GlyphContours[] {
  return font.generateShapes(text, size).map((shape) => ({
    outline: shape.getPoints(TEXT_CURVE_SEGMENTS),
    holes: shape.holes.map((hole) => hole.getPoints(TEXT_CURVE_SEGMENTS)),
  }));
}

/** Границы контуров до размещения: нужны для центрирования подписи. */
function boundsOfContours(contours: Contour[]): ContourBounds | null {
  let bounds: ContourBounds | null = null;

  for (const contour of contours) {
    for (const point of contour) {
      if (!bounds) {
        bounds = {
          minX: point.x,
          minY: point.y,
          maxX: point.x,
          maxY: point.y,
        };
        continue;
      }

      bounds.minX = Math.min(bounds.minX, point.x);
      bounds.minY = Math.min(bounds.minY, point.y);
      bounds.maxX = Math.max(bounds.maxX, point.x);
      bounds.maxY = Math.max(bounds.maxY, point.y);
    }
  }

  return bounds;
}

/** Сдвигает контур на заданное смещение и возвращает копию. */
function shiftContour(contour: Contour, dx: number, dy: number): Contour {
  return contour.map((point) => new Vector2(point.x + dx, point.y + dy));
}

/** Сдвигает фигуру вместе с отверстиями и возвращает копию. */
function shiftShape(shape: LabelShape, dx: number, dy: number): LabelShape {
  return {
    outline: shiftContour(shape.outline, dx, dy),
    holes: shape.holes.map((hole) => shiftContour(hole, dx, dy)),
  };
}

/** Кольцо градуса: внешний контур и круглое отверстие внутри. */
function ringShape(size: number): LabelShape {
  const outerRadius = size * RING_OUTER_RATIO;
  const innerRadius = size * RING_INNER_RATIO;
  const centerY = size * RING_CENTER_RATIO;

  const circle = (radius: number): Contour =>
    Array.from({ length: RING_SEGMENTS }, (_, index) => {
      const angle = (index / RING_SEGMENTS) * Math.PI * 2;

      return new Vector2(
        Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius,
      );
    });

  return { outline: circle(outerRadius), holes: [circle(innerRadius)] };
}

/**
 * Раскладывает подпись по ширине и центрирует по высоте.
 *
 * Каждый текстовый фрагмент измеряем отдельно: у шрифта есть боковые поля, и
 * без вычитания minX между цифрами и кольцом появлялся бы случайный зазор.
 * Кольцо градуса рисуем сами — в Roboto нет символа «°», а подменять его
 * буквой «o» на грани выглядело бы как опечатка.
 */
export function layoutLabel(
  type: CalibrationType,
  value: number,
  font: Font,
  size: number,
): LabelContours {
  const gap = size * LABEL_GAP_RATIO;
  const parts: LabelLayoutPart[] = labelParts(type, value).map((part) => {
    if (part.kind === "text") {
      const glyphs = textContours(font, part.text, size);
      const contours = glyphs.flatMap((glyph) => [
        glyph.outline,
        ...glyph.holes,
      ]);
      const bounds = boundsOfContours(contours);

      return {
        kind: "text",
        glyphs,
        bounds,
        width: bounds ? bounds.maxX - bounds.minX : 0,
      };
    }

    const ring = ringShape(size);

    return {
      kind: "ring",
      ring,
      width: size * RING_OUTER_RATIO * 2,
    };
  });

  const totalWidth =
    parts.reduce((width, part) => width + part.width, 0) +
    gap * Math.max(parts.length - 1, 0);

  const shapes: LabelShape[] = [];
  let cursor = -totalWidth / 2;

  for (const part of parts) {
    if (part.kind === "text") {
      const dx = cursor - (part.bounds?.minX ?? 0);

      for (const glyph of part.glyphs) {
        shapes.push(shiftShape(glyph, dx, 0));
      }
    } else {
      const dx = cursor + size * RING_OUTER_RATIO;

      shapes.push(shiftShape(part.ring, dx, 0));
    }

    cursor += part.width + gap;
  }

  // Центрируем по высоте: у цифр нет выносных элементов, но кольцо градуса
  // поднимается выше заглавных, и без общего центра подпись уезжала бы вниз.
  const all = shapes.flatMap((shape) => [shape.outline, ...shape.holes]);
  const bounds = boundsOfContours(all);

  if (!bounds) {
    return { shapes };
  }

  const dy = -(bounds.minY + bounds.maxY) / 2;

  return {
    shapes: shapes.map((shape) => shiftShape(shape, 0, dy)),
  };
}

/** Выдавливает замкнутую фигуру подписи в +Z и ставит её на нужную глубину. */
function extrudeLabelShape(
  shape: LabelShape,
  depth: number,
  zStart: number,
): BufferGeometry {
  const outline = new Shape(shape.outline);
  outline.holes = shape.holes.map((hole) => new Path(hole));

  return new ExtrudeGeometry(outline, {
    depth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  }).translate(0, 0, zStart);
}

/**
 * Выпуклая подпись на передней грани ступени.
 *
 * Каждый глиф — отдельная замкнутая оболочка: внешний контур выдавливается
 * вместе со своими отверстиями («0», «8»), поэтому перемычки цифр остаются
 * углублениями до плоскости ступени. Оболочка входит в блок на
 * `LABEL_EMBED_MM` и выступает над гранью на `LABEL_RELIEF_MM`.
 *
 * Общую накладку с несколькими отверстиями делать нельзя: триангуляция
 * панели, у которой соседние контуры лежат на одной прямой (например, две
 * «m»), оставляет незамкнутые рёбра. Отдельные оболочки watertight, а слайсер
 * объединяет их с блоком при печати.
 */
function raisedLabelGeometry(
  type: CalibrationType,
  value: number,
  font: Font,
  panelWidth: number,
  panelHeight: number,
): BufferGeometry[] {
  let size = LABEL_FONT_SIZE_MM;
  let label = layoutLabel(type, value, font, size);
  const maxLabelWidth = panelWidth - 3;
  const maxLabelHeight = panelHeight - 1;
  const labelBounds = boundsOfContours(
    label.shapes.flatMap((shape) => [shape.outline, ...shape.holes]),
  );

  if (labelBounds) {
    const labelWidth = labelBounds.maxX - labelBounds.minX;
    const labelHeight = labelBounds.maxY - labelBounds.minY;
    const scale = Math.min(
      labelWidth > maxLabelWidth ? maxLabelWidth / labelWidth : 1,
      labelHeight > maxLabelHeight ? maxLabelHeight / labelHeight : 1,
    );

    if (scale < 1) {
      size *= scale;
      label = layoutLabel(type, value, font, size);
    }
  }

  const depth = LABEL_RELIEF_MM + LABEL_EMBED_MM;
  const zStart = DEPTH_MM / 2 - LABEL_EMBED_MM;

  return label.shapes.map((shape) =>
    extrudeLabelShape(shape, depth, zStart),
  );
}

/**
 * Ступенчатая калибровочная башня.
 *
 * Снизу вверх идут блоки одинаковой высоты; каждый следующий уже предыдущего
 * и целиком стоит на нём. Поэтому нависаний нет вообще: все стенки
 * вертикальные, а открытые полки смотрят вверх. Передние грани выровнены по
 * одной плоскости, чтобы подписи читались с одного ракурса. Значение на
 * нижней ступени равно `startValue`, на верхней — `endValue`; направление
 * роста задаёт пользователь.
 *
 * Без шрифта башня собирается без подписей: превью показывает её сразу, а
 * после загрузки JSON геометрия пересобирается. Сервер всегда передаёт шрифт,
 * поэтому в STL цифры есть.
 */
export function createCalibrationGeometry(
  params: CalibrationParams,
  font: Font | null,
): BufferGeometry {
  const { calibrationType, startValue, endValue, steps } =
    normalizeCalibrationParams(params);
  const parts: BufferGeometry[] = [];

  for (let index = 0; index < steps; index += 1) {
    const ratio = steps === 1 ? 0 : index / (steps - 1);
    const width = BASE_WIDTH_MM + (TOP_WIDTH_MM - BASE_WIDTH_MM) * ratio;
    const bottom = index * BLOCK_HEIGHT_MM;
    const block = new BoxGeometry(width, BLOCK_HEIGHT_MM, DEPTH_MM);

    block.translate(0, bottom + BLOCK_HEIGHT_MM / 2, 0);
    parts.push(block.toNonIndexed());
    block.dispose();

    if (!font) {
      continue;
    }

    const panelWidth = width - PANEL_INSET_MM * 2;
    const panelHeight = BLOCK_HEIGHT_MM - PANEL_INSET_MM * 2;
    const value = valueAtStep(
      calibrationType,
      startValue,
      endValue,
      index,
      steps,
    );

    for (const geometry of raisedLabelGeometry(
      calibrationType,
      value,
      font,
      panelWidth,
      panelHeight,
    )) {
      geometry.translate(0, bottom + BLOCK_HEIGHT_MM / 2, 0);
      parts.push(geometry);
    }
  }

  const geometry = mergeGeometries(parts, false);

  for (const part of parts) {
    part.dispose();
  }

  if (!geometry) {
    throw new Error("Не удалось собрать калибровочную башню из частей.");
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.computeVertexNormals();

  return geometry;
}

