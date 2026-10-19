import { ExtrudeGeometry, Path, Shape, ShapeGeometry, Vector2 } from "three";
import type { BufferGeometry } from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import {
  normalizeKeychainParams,
  type KeychainParams,
} from "@/lib/constructor/params";

/**
 * Геометрия брелока: заготовка с отверстием под кольцо и выдавленное имя.
 *
 * Заготовка лежит в плоскости XY, толщина идёт по Z от 0 до thickness. Такой
 * файл уже стоит на столе слайсера: нижняя грань на Z = 0, рельеф имени
 * выступает вверх. В предпросмотре группа поворачивается на -90° вокруг X,
 * чтобы брелок лежал на виртуальном столе.
 *
 * Имя не вырезается из основы, а пересекается с ней: нижняя часть букв уходит
 * внутрь на TEXT_EMBED_MM, верхняя выступает на TEXT_RELIEF_MM. Это даёт
 * прочное соединение без CSG; основа и буквы остаются двумя замкнутыми
 * оболочками в одной сетке, и слайсер объединяет их при печати.
 */

/** Публичный путь шрифта: его грузит браузер и читает серверный роут. */
export const KEYCHAIN_FONT_URL = "/fonts/cyrillic.typeface.json";

/** Диаметр отверстия под кольцо, мм. */
export const KEYCHAIN_HOLE_DIAMETER_MM = 4;

/** Сколько миллиметров оставляем от отверстия до верхнего края. */
const HOLE_EDGE_MARGIN_MM = 3;

/** Максимальный радиус скругления углов прямоугольной заготовки. */
const MAX_CORNER_RADIUS_MM = 5;

/** Скругление кромок: не больше 0.3 мм, иначе тонкая основа теряет лицо. */
const EDGE_BEVEL_MM = 0.3;

/** Доля толщины, которую может занять фаска сверху и снизу. */
const EDGE_BEVEL_SHARE = 0.12;

/** Число сегментов фаски: на 0.3 мм трёх хватает. */
const EDGE_BEVEL_SEGMENTS = 3;

/** Сегменты скруглённых углов и отверстия. */
const CURVE_SEGMENTS = 24;

/** Отступ текста от боковых кромок, мм. */
const TEXT_EDGE_MARGIN_MM = 3;

/** Зазор между нижней точкой отверстия и верхом текста, мм. */
const TEXT_HOLE_GAP_MM = 1.5;

/** Насколько имя выступает над лицом брелока, мм. */
const TEXT_RELIEF_MM = 0.8;

/** Скругление кромок букв, мм. */
const TEXT_BEVEL_MM = 0.1;

/** Насколько буквы уходят внутрь основы для прочного соединения, мм. */
const TEXT_EMBED_MM = 0.35;

/** Сегменты контуров букв: 8 достаточно для мелкого рельефа. */
const TEXT_CURVE_SEGMENTS = 8;

/** Сегменты фаски букв. */
const TEXT_BEVEL_SEGMENTS = 2;

/** Скруглённый прямоугольник с центром в начале координат. */
function createRoundedShape(width: number, length: number): Shape {
  const halfWidth = width / 2;
  const halfLength = length / 2;
  const radius = Math.min(MAX_CORNER_RADIUS_MM, width / 4, length / 4);

  const shape = new Shape();
  shape.moveTo(-halfWidth + radius, -halfLength);
  shape.lineTo(halfWidth - radius, -halfLength);
  shape.quadraticCurveTo(
    halfWidth,
    -halfLength,
    halfWidth,
    -halfLength + radius,
  );
  shape.lineTo(halfWidth, halfLength - radius);
  shape.quadraticCurveTo(halfWidth, halfLength, halfWidth - radius, halfLength);
  shape.lineTo(-halfWidth + radius, halfLength);
  shape.quadraticCurveTo(
    -halfWidth,
    halfLength,
    -halfWidth,
    halfLength - radius,
  );
  shape.lineTo(-halfWidth, -halfLength + radius);
  shape.quadraticCurveTo(
    -halfWidth,
    -halfLength,
    -halfWidth + radius,
    -halfLength,
  );
  shape.closePath();

  return shape;
}

/**
 * Вытянутый шестиугольник с плоским верхом и низом.
 *
 * Верхняя грань шириной width / 2 оставляет место для отверстия, а боковые
 * вершины на середине длины дают максимальную ширину. Форма вписывается в
 * прямоугольник width × length, поэтому габариты совпадают с подписями в UI.
 */
function createHexagonShape(width: number, length: number): Shape {
  const halfWidth = width / 2;
  const halfLength = length / 2;
  const shoulder = width / 4;

  const shape = new Shape([
    new Vector2(-shoulder, halfLength),
    new Vector2(shoulder, halfLength),
    new Vector2(halfWidth, 0),
    new Vector2(shoulder, -halfLength),
    new Vector2(-shoulder, -halfLength),
    new Vector2(-halfWidth, 0),
  ]);
  shape.closePath();

  return shape;
}

/** Круглое отверстие в верхней части заготовки. */
function createHole(centerY: number): Path {
  const hole = new Path();
  hole.absarc(0, centerY, KEYCHAIN_HOLE_DIAMETER_MM / 2, 0, Math.PI * 2, false);

  return hole;
}

/** Координата центра отверстия: верхний край, отступ и радиус. */
function holeCenterY(length: number): number {
  return length / 2 - HOLE_EDGE_MARGIN_MM - KEYCHAIN_HOLE_DIAMETER_MM / 2;
}

/** Основа брелока с отверстием, выдавленная на заданную толщину. */
function createBaseGeometry(params: KeychainParams): BufferGeometry {
  const bevelThickness = Math.min(
    EDGE_BEVEL_MM,
    params.thickness * EDGE_BEVEL_SHARE,
  );
  // Фаска расширяет контур наружу на свою ширину. Уменьшаем заготовку на
  // два размера фаски, чтобы итоговые габариты совпали со слайдерами.
  const shapeWidth = params.width - bevelThickness * 2;
  const shapeLength = params.length - bevelThickness * 2;
  const shape =
    params.shapeType === "hexagon"
      ? createHexagonShape(shapeWidth, shapeLength)
      : createRoundedShape(shapeWidth, shapeLength);

  shape.holes.push(createHole(holeCenterY(params.length)));

  // Полная толщина ExtrudeGeometry = depth + 2 × bevelThickness. Вычитаем
  // фаски из depth, чтобы габарит по Z точно совпал со слайдером.
  const depth = Math.max(params.thickness - bevelThickness * 2, 0.4);
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: EDGE_BEVEL_SEGMENTS,
    bevelSize: bevelThickness,
    bevelThickness,
    curveSegments: CURVE_SEGMENTS,
    depth,
    steps: 1,
  });

  // Экструзия начинается с -bevelThickness: поднимаем её, чтобы нижняя грань
  // легла на Z = 0, а верхняя — ровно на thickness.
  geometry.translate(0, 0, bevelThickness);

  return geometry;
}

/**
 * Габариты текста при размере 1.
 *
 * TextGeometry строит контуры по глифам, но чтобы выбрать итоговый кегль,
 * нужны ширина и высота до выдавливания. ShapeGeometry даёт их без лишней
 * геометрии; после замера временная сетка освобождается.
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
 * Выдавленное имя на лицевой стороне.
 *
 * Кегль выбирается по меньшему из двух ограничений: ширина заготовки минус
 * боковые отступы и свободная высота между нижней кромкой и отверстием.
 * Поэтому длинное имя автоматически становится мельче, а короткое не
 * упирается в кольцо. Центр текста — середина свободной зоны под отверстием.
 *
 * Возвращает null, если строка пустая или состоит из пробелов.
 */
function createTextGeometry(
  params: KeychainParams,
  font: Font,
): BufferGeometry | null {
  const text = params.text.trim();

  if (!text) {
    return null;
  }

  const measured = measureText(text, font);

  if (!measured) {
    return null;
  }

  const halfLength = params.length / 2;
  const holeBottom = holeCenterY(params.length) - KEYCHAIN_HOLE_DIAMETER_MM / 2;
  const textTop = holeBottom - TEXT_HOLE_GAP_MM;
  const textBottom = -halfLength + TEXT_EDGE_MARGIN_MM;
  const availableWidth = params.width - TEXT_EDGE_MARGIN_MM * 2;
  const availableHeight = Math.max(textTop - textBottom, 1);
  const size = Math.min(
    availableWidth / measured.width,
    availableHeight / measured.height,
  );

  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }

  // Мелкое имя при 10 символах на узком брелоке: фаска 0.1 мм съедала бы
  // тонкие перемычки букв. Уменьшаем её вместе с кеглем, но не больше 0.1.
  const bevel = Math.min(TEXT_BEVEL_MM, size * 0.03);
  const geometry = new TextGeometry(text, {
    bevelEnabled: true,
    bevelSegments: TEXT_BEVEL_SEGMENTS,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: TEXT_CURVE_SEGMENTS,
    depth: Math.max(TEXT_RELIEF_MM - bevel * 2, 0.1),
    font,
    size,
  });

  geometry.computeBoundingBox();

  const box = geometry.boundingBox;

  if (!box) {
    geometry.dispose();
    return null;
  }

  const textCenterY = (textTop + textBottom) / 2;
  const geometryCenterY = (box.min.y + box.max.y) / 2;
  // Нижняя грань текста после translateZ оказывается на
  // thickness - TEXT_EMBED_MM, верхняя — на thickness + TEXT_RELIEF_MM -
  // TEXT_EMBED_MM. Буквы входят в основу и не отрываются от неё.
  const translateZ = params.thickness - TEXT_EMBED_MM + bevel;

  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    textCenterY - geometryCenterY,
    translateZ,
  );

  return geometry;
}

/**
 * Собирает брелок в одну сетку.
 *
 * font = null допустим для предпросмотра, пока JSON шрифта ещё грузится:
 * сцена показывает заготовку без имени, а после загрузки пересобирает её.
 * Серверный экспорт передаёт шрифт всегда.
 *
 * mergeGeometries копирует данные в новую сетку; исходные основа и текст
 * освобождаются сразу, чтобы слайдер не оставлял мусор в памяти.
 */
export function createKeychainGeometry(
  params: Partial<KeychainParams>,
  font: Font | null = null,
): BufferGeometry {
  const normalized = normalizeKeychainParams(params);
  const base = createBaseGeometry(normalized);

  if (!font) {
    base.computeBoundingBox();
    base.computeBoundingSphere();

    return base;
  }

  const text = createTextGeometry(normalized, font);

  if (!text) {
    base.computeBoundingBox();
    base.computeBoundingSphere();

    return base;
  }

  const merged = mergeGeometries([base, text]);

  base.dispose();
  text.dispose();

  if (!merged) {
    throw new Error("Не удалось объединить основу брелока и текст");
  }

  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}
