import { ExtrudeGeometry, Path, Shape, ShapeGeometry } from "three";
import type { BufferGeometry } from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { KEYCHAIN_FONT_URL } from "@/lib/constructor/keychain-geometry";
import {
  normalizeSignParams,
  type SignParams,
} from "@/lib/constructor/params";

/**
 * Геометрия вывески: плита, канал под светодиодную ленту и выпуклые буквы.
 *
 * Плита стоит в плоскости XY и стоит на столе: нижняя кромка на Y = 0, лицо
 * смотрит в +Z, толщина идёт от 0 до SIGN_BASE_THICKNESS_MM. В таком виде
 * деталь и попадает в STL — её не нужно поворачивать в слайсере.
 *
 * Канал под ленту образован двумя направляющими на лицевой стороне: они
 * выступают вперёд и разделены ровно на 8 или 10 мм. Стенки канала — это
 * боковины направляющих, дно — лицо плиты, поэтому лента ложится заподлицо.
 * Буквы не вырезаются из плиты, а входят в неё на TEXT_EMBED_MM и выступают
 * на signDepth: булевых операций в проекте нет, но пересекающиеся замкнутые
 * оболочки слайсер объединяет при печати. Так же устроен брелок.
 *
 * Если строка длиннее лимита по ширине, кегль уменьшается: иначе вывеска
 * вышла бы за 800 мм и не влезла на стол принтера. Панель показывает
 * номинальный кегль, а фактический виден по габаритам предпросмотра.
 */

/** Публичный путь шрифта: тот же JSON, что у брелока. */
export const SIGN_FONT_URL = KEYCHAIN_FONT_URL;

/** Предельная ширина: длинная строка упирается в неё и мельчает. */
export const SIGN_MAX_WIDTH_MM = 800;

/** Минимальная ширина: короткая надпись не превращает плиту в планку. */
export const SIGN_MIN_WIDTH_MM = 160;

/** Толщина плиты, мм: достаточно для канала и крепежа. */
export const SIGN_BASE_THICKNESS_MM = 4;

/** Отверстия под крепёж к стене, мм. */
export const SIGN_MOUNT_HOLE_DIAMETER_MM = 5;

/** Отверстие под провод питания ленты, мм. */
export const SIGN_CABLE_HOLE_DIAMETER_MM = 8;

/** Скругление углов плиты, мм. */
const PLATE_CORNER_RADIUS_MM = 10;

/** Фаска кромок плиты: убирает острые углы, не мешая каналу. */
const PLATE_BEVEL_MM = 0.35;

/** Сегменты фаски и скруглений. */
const PLATE_BEVEL_SEGMENTS = 3;
const CURVE_SEGMENTS = 24;

/** Поля плиты слева и справа от надписи, мм. */
const SIDE_MARGIN_MM = 24;

/** Полоса сверху под крепёж: буквы ниже неё не заходят. */
const TOP_BAND_MM = 24;

/** Полоса снизу: в ней помещается отверстие под провод. */
const BOTTOM_BORDER_MM = 16;

/** Высота направляющих канала, мм. */
const BAR_HEIGHT_MM = 7;

/** Отступ направляющих от боковых кромок, мм. */
const BAR_SIDE_INSET_MM = 14;

/** Насколько направляющие входят в плиту, мм. */
const BAR_EMBED_MM = 1;

/** Максимальный выступ направляющих над лицом, мм. */
const MAX_BAR_DEPTH_MM = 8;

/** Зазор между верхней направляющей и низом букв, мм. */
const CHANNEL_GAP_ABOVE_MM = 9;

/** Положение крепёжных отверстий от верхней и боковой кромки, мм. */
const MOUNT_HOLE_INSET_X_MM = 16;
const MOUNT_HOLE_INSET_Y_MM = 12;

/** Насколько буквы входят в плиту для прочного соединения, мм. */
const TEXT_EMBED_MM = 1.2;

/** Скругление кромок букв, мм. */
const TEXT_BEVEL_MM = 0.2;

/** Сегменты контуров и фаски букв. */
const TEXT_CURVE_SEGMENTS = 8;
const TEXT_BEVEL_SEGMENTS = 2;

/** Скруглённый прямоугольник плиты: x по центру, y от 0 до height. */
function createPlateShape(
  width: number,
  height: number,
  bevel: number,
): Shape {
  const halfWidth = width / 2 - bevel;
  const bottom = bevel;
  const top = height - bevel;
  const radius = Math.min(
    PLATE_CORNER_RADIUS_MM,
    halfWidth,
    (top - bottom) / 2,
  );

  const shape = new Shape();
  shape.moveTo(-halfWidth + radius, bottom);
  shape.lineTo(halfWidth - radius, bottom);
  shape.quadraticCurveTo(halfWidth, bottom, halfWidth, bottom + radius);
  shape.lineTo(halfWidth, top - radius);
  shape.quadraticCurveTo(halfWidth, top, halfWidth - radius, top);
  shape.lineTo(-halfWidth + radius, top);
  shape.quadraticCurveTo(-halfWidth, top, -halfWidth, top - radius);
  shape.lineTo(-halfWidth, bottom + radius);
  shape.quadraticCurveTo(-halfWidth, bottom, -halfWidth + radius, bottom);
  shape.closePath();

  return shape;
}

/** Круглое отверстие в плите. */
function createHole(x: number, y: number, diameter: number): Path {
  const hole = new Path();
  hole.absarc(x, y, diameter / 2, 0, Math.PI * 2, false);

  return hole;
}

/** Направляющая канала: прямоугольник со скруглёнными торцами. */
function createBarShape(
  halfWidth: number,
  bottom: number,
  height: number,
): Shape {
  const radius = Math.min(height / 2, halfWidth / 2);
  const shape = new Shape();
  shape.moveTo(-halfWidth + radius, bottom);
  shape.lineTo(halfWidth - radius, bottom);
  shape.quadraticCurveTo(halfWidth, bottom, halfWidth, bottom + radius);
  shape.lineTo(halfWidth, bottom + height - radius);
  shape.quadraticCurveTo(
    halfWidth,
    bottom + height,
    halfWidth - radius,
    bottom + height,
  );
  shape.lineTo(-halfWidth + radius, bottom + height);
  shape.quadraticCurveTo(
    -halfWidth,
    bottom + height,
    -halfWidth,
    bottom + height - radius,
  );
  shape.lineTo(-halfWidth, bottom + radius);
  shape.quadraticCurveTo(-halfWidth, bottom, -halfWidth + radius, bottom);
  shape.closePath();

  return shape;
}


/** Габариты вывески и положение канала: всё в миллиметрах. */
type SignLayout = {
  plateWidth: number;
  plateHeight: number;
  /** Фактический кегль: может быть меньше номинального из-за ширины. */
  size: number;
  textHeight: number;
  /** Низ букв: выше канала и зазора. */
  textBottom: number;
  /** Низ нижней и верхней направляющих канала. */
  lowerBarBottom: number;
  upperBarBottom: number;
  /** Выступ направляющих над лицом плиты. */
  barDepth: number;
};

/**
 * Габариты текста при размере 1.
 *
 * ShapeGeometry даёт контуры глифов без выдавливания, поэтому замер дешёвый,
 * а временная сетка сразу освобождается. Как и у брелока, null означает, что
 * шрифт ещё не загрузился или строка пуста.
 */
function measureText(
  text: string,
  font: Font,
): { width: number; height: number } | null {
  const shapes = font.generateShapes(text, 1);

  if (shapes.length === 0) {
    return null;
  }

  const probe = new ShapeGeometry(shapes);
  probe.computeBoundingBox();

  const box = probe.boundingBox;
  probe.dispose();

  if (!box) {
    return null;
  }

  const width = box.max.x - box.min.x;
  const height = box.max.y - box.min.y;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

/**
 * Раскладка вывески.
 *
 * Сначала кегль уменьшается до допустимой ширины, потом по фактическим
 * габаритам букв считается высота плиты. Порядок важен: иначе длинная строка
 * крупным кеглем дала бы плиту шире 800 мм.
 */
function createLayout(params: SignParams, font: Font | null): SignLayout {
  const text = params.signText.trim();
  const measured = text && font ? measureText(text, font) : null;
  const maxTextWidth = SIGN_MAX_WIDTH_MM - SIDE_MARGIN_MM * 2;
  let size = params.signFontSize;

  if (measured && measured.width * size > maxTextWidth) {
    size = maxTextWidth / measured.width;
  }

  const textWidth = measured ? measured.width * size : 0;
  const textHeight = measured ? measured.height * size : 0;
  const plateWidth = Math.max(
    SIGN_MIN_WIDTH_MM,
    textWidth + SIDE_MARGIN_MM * 2,
  );

  const lowerBarBottom = BOTTOM_BORDER_MM;
  const upperBarBottom =
    lowerBarBottom + BAR_HEIGHT_MM + params.signChannelWidth;
  const textBottom = upperBarBottom + BAR_HEIGHT_MM + CHANNEL_GAP_ABOVE_MM;

  return {
    plateWidth,
    plateHeight: textBottom + textHeight + TOP_BAND_MM,
    size,
    textHeight,
    textBottom,
    lowerBarBottom,
    upperBarBottom,
    barDepth: Math.min(MAX_BAR_DEPTH_MM, params.signDepth),
  };
}

/**
 * Плита с крепёжными отверстиями и отверстием под провод.
 *
 * Отверстия заданы больше номинала на две фаски: фаска поджимает контур
 * отверстия внутрь, и без компенсации винт М5 не прошёл бы. Фаска снаружи,
 * наоборот, расширяет плиту — поэтому контур строится меньше на её ширину.
 */
function createPlateGeometry(layout: SignLayout): BufferGeometry {
  const shape = createPlateShape(
    layout.plateWidth,
    layout.plateHeight,
    PLATE_BEVEL_MM,
  );
  // Крепёж стоит в прямой части верхней кромки: отступ по X больше радиуса
  // скругления, поэтому отверстия не выходят на дугу угла.
  const mountX = layout.plateWidth / 2 - MOUNT_HOLE_INSET_X_MM;
  const mountY = layout.plateHeight - MOUNT_HOLE_INSET_Y_MM;
  const holeExtra = PLATE_BEVEL_MM * 2;

  shape.holes.push(
    createHole(mountX, mountY, SIGN_MOUNT_HOLE_DIAMETER_MM + holeExtra),
    createHole(-mountX, mountY, SIGN_MOUNT_HOLE_DIAMETER_MM + holeExtra),
    createHole(
      0,
      BOTTOM_BORDER_MM / 2,
      SIGN_CABLE_HOLE_DIAMETER_MM + holeExtra,
    ),
  );

  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: PLATE_BEVEL_SEGMENTS,
    bevelSize: PLATE_BEVEL_MM,
    bevelThickness: PLATE_BEVEL_MM,
    curveSegments: CURVE_SEGMENTS,
    depth: Math.max(SIGN_BASE_THICKNESS_MM - PLATE_BEVEL_MM * 2, 0.4),
    steps: 1,
  });

  // Экструзия начинается с −bevel: поднимаем её, чтобы лицо плиты встало
  // ровно на SIGN_BASE_THICKNESS_MM, а низ — на 0.
  geometry.translate(0, 0, PLATE_BEVEL_MM);

  return geometry;
}

/**
 * Направляющая канала.
 *
 * Без фаски: она сузила бы канал, а лента должна входить без люфта. Низ
 * направляющей заглублён в плиту на BAR_EMBED_MM, поэтому деталь держится
 * даже без клея.
 */
function createBarGeometry(
  layout: SignLayout,
  bottom: number,
): BufferGeometry {
  const shape = createBarShape(
    layout.plateWidth / 2 - BAR_SIDE_INSET_MM,
    bottom,
    BAR_HEIGHT_MM,
  );
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 12,
    depth: layout.barDepth,
    steps: 1,
  });

  geometry.translate(0, 0, SIGN_BASE_THICKNESS_MM - BAR_EMBED_MM);

  return geometry;
}

/**
 * Выпуклые буквы на лицевой стороне.
 *
 * Нижняя грань букв уходит внутрь плиты на TEXT_EMBED_MM, верхняя — ровно на
 * signDepth над лицом. Пустая строка или отсутствующий шрифт дают null:
 * предпросмотр показывает плиту с каналом, пока JSON ещё грузится.
 */
function createTextGeometry(
  params: SignParams,
  layout: SignLayout,
  font: Font,
): BufferGeometry | null {
  const text = params.signText.trim();

  if (!text || layout.size <= 0) {
    return null;
  }

  const bevel = Math.min(TEXT_BEVEL_MM, layout.size * 0.02);
  const depth = params.signDepth + TEXT_EMBED_MM - bevel * 2;
  const geometry = new TextGeometry(text, {
    bevelEnabled: true,
    bevelSegments: TEXT_BEVEL_SEGMENTS,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: TEXT_CURVE_SEGMENTS,
    depth,
    font,
    size: layout.size,
  });

  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (!box) {
    geometry.dispose();
    return null;
  }

  const textCenterY = layout.textBottom + layout.textHeight / 2;

  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    textCenterY - (box.min.y + box.max.y) / 2,
    SIGN_BASE_THICKNESS_MM - TEXT_EMBED_MM + bevel,
  );

  return geometry;
}

/**
 * Собирает вывеску в одну сетку.
 *
 * Плита, две направляющие и буквы пересекаются, но каждая часть — замкнутая
 * оболочка. STL хранит их вместе, слайсер объединяет при нарезке: так же
 * устроен брелок, где буквы входят в основу.
 *
 * font = null допустим для предпросмотра: сцена покажет плиту с каналом, а
 * после загрузки шрифта пересоберёт модель. Серверный экспорт передаёт шрифт.
 */
export function createSignGeometry(
  params: Partial<SignParams>,
  font: Font | null = null,
): BufferGeometry {
  const normalized = normalizeSignParams(params);
  const layout = createLayout(normalized, font);
  const parts: BufferGeometry[] = [
    createPlateGeometry(layout),
    createBarGeometry(layout, layout.lowerBarBottom),
    createBarGeometry(layout, layout.upperBarBottom),
  ];

  if (font) {
    const text = createTextGeometry(normalized, layout, font);

    if (text) {
      parts.push(text);
    }
  }

  const merged = mergeGeometries(parts);

  for (const part of parts) {
    part.dispose();
  }

  if (!merged) {
    throw new Error("Не удалось объединить плиту вывески, канал и текст");
  }

  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}
