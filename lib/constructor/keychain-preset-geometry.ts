import { ExtrudeGeometry, Path, Shape } from "three";

import type { KeychainPresetId } from "@/lib/constructor/keychain-presets";

/**
 * Геометрия новых пресетов брелока.
 *
 * В отличие от прежних силуэтов (`lib/constructor/keychain-shapes.ts`), где
 * форма — это SVG-строка, которую надо разобрать, масштабировать и обрезать под
 * габарит, пресет строится кодом сразу в миллиметрах. Так проще держать
 * пропорции: скругление, отверстие под кольцо и толщина заданы числами, а не
 * «на глаз» после масштабирования.
 *
 * Соглашения те же, что у старой геометрии: основа лежит в плоскости XY,
 * толщина идёт по Z от 0 до `thickness`, центр габарита — в начале координат.
 * Такой файл слайсер ставит на стол без поворотов, а предпросмотр поворачивает
 * группу на -90° вокруг X.
 *
 * Фаска three.js расширяет контур наружу: у середины толщины габарит больше
 * контура Shape на `bevelSize`, а у крышек совпадает с ним. Поэтому профиль
 * строится меньше заданного габарита на фаску — иначе модель выходила бы на
 * 0.8 мм шире, чем обещает панель.
 */

/** Параметры, общие для всех пресетов: габарит и толщина из слайдеров, мм. */
export type KeychainPresetGeometryParams = {
  /** Ширина в самой широкой части, мм. */
  width: number;
  /** Высота сверху вниз, мм. */
  height: number;
  /** Толщина основы вместе с фасками, мм. */
  thickness: number;
};

/** Ширина фаски по контуру: 0.4 мм читается как скругление кромки. */
const PRESET_BEVEL_SIZE_MM = 0.4;

/** Глубина фаски на каждой стороне: входит в толщину, а не добавляется к ней. */
const PRESET_BEVEL_THICKNESS_MM = 0.2;

/** Два сегмента дают фаску из двух полос — её видно, но она не «мылит» кромку. */
const PRESET_BEVEL_SEGMENTS = 2;

/** 32 сегмента на дугу: скругления и отверстие выходят гладкими, без лесенки. */
const PRESET_CURVE_SEGMENTS = 32;

/** Радиус скругления корпуса Apple Tag, мм. */
const APPLE_TAG_CORNER_RADIUS_MM = 4;

/** Диаметр отверстия под кольцо в свету, мм. */
const APPLE_TAG_RING_HOLE_DIAMETER_MM = 5;

/** Отступ центра отверстия от верхнего края, мм. */
const APPLE_TAG_RING_HOLE_INSET_MM = 5;

/**
 * Пресеты, у которых уже есть геометрия.
 *
 * Список читают панель (подсказка вместо плашки «в работе») и API (422 вместо
 * файла-заглушки), поэтому он один на оба места: разойтись они не могут.
 */
export const IMPLEMENTED_KEYCHAIN_PRESETS: readonly KeychainPresetId[] = [
  "apple-tag",
];

/** Готова ли геометрия пресета: остальные семь пока строятся старым силуэтом. */
export function isKeychainPresetImplemented(
  presetId: KeychainPresetId,
): boolean {
  return IMPLEMENTED_KEYCHAIN_PRESETS.includes(presetId);
}

/**
 * Скруглённый прямоугольник с отверстием под кольцо — пресет Apple Tag.
 *
 * Корпус — прямоугольник `width × height` со скруглением 4 мм и отверстием
 * Ø5 мм в 5 мм от верхнего края: отдельное ушко не нужно, кольцо проходит сквозь
 * корпус, и брелок не цепляется ушком за ключи. Отверстие вырезано через
 * `shape.holes`, поэтому оно сквозное на всю толщину.
 *
 * Толщина держится ровно по слайдеру: выдавливание идёт на
 * `thickness − 2 × bevelThickness`, а сдвиг на `bevelThickness` ставит нижнюю
 * грань на Z = 0 — так же, как у старой геометрии.
 */
export function buildAppleTag(
  params: KeychainPresetGeometryParams,
): ExtrudeGeometry {
  const bevel = PRESET_BEVEL_SIZE_MM;
  // Профиль Shape — это контур крышки: фаска раздвигает его на bevel наружу.
  const profileWidth = Math.max(params.width - bevel * 2, 1);
  const profileHeight = Math.max(params.height - bevel * 2, 1);
  const radius = Math.min(
    APPLE_TAG_CORNER_RADIUS_MM,
    Math.min(profileWidth, profileHeight) / 2,
  );
  const halfWidth = profileWidth / 2;
  const halfHeight = profileHeight / 2;

  const shape = new Shape();

  shape.moveTo(-halfWidth + radius, -halfHeight);
  shape.lineTo(halfWidth - radius, -halfHeight);
  shape.absarc(
    halfWidth - radius,
    -halfHeight + radius,
    radius,
    -Math.PI / 2,
    0,
    false,
  );
  shape.lineTo(halfWidth, halfHeight - radius);
  shape.absarc(
    halfWidth - radius,
    halfHeight - radius,
    radius,
    0,
    Math.PI / 2,
    false,
  );
  shape.lineTo(-halfWidth + radius, halfHeight);
  shape.absarc(
    -halfWidth + radius,
    halfHeight - radius,
    radius,
    Math.PI / 2,
    Math.PI,
    false,
  );
  shape.lineTo(-halfWidth, -halfHeight + radius);
  shape.absarc(
    -halfWidth + radius,
    -halfHeight + radius,
    radius,
    Math.PI,
    Math.PI * 1.5,
    false,
  );
  shape.closePath();

  // У отверстия фаска поджимает стенку так же, как расширяет корпус: в свету
  // остаётся `radius − bevel`. Поэтому радиус профиля берётся с запасом на фаску,
  // и Ø5 мм держится по всей высоте стенки. Центр отсчитывается от номинального
  // габарита, а не от контура крышки: панель обещает 5 мм от края заготовки.
  const holeY = params.height / 2 - APPLE_TAG_RING_HOLE_INSET_MM;
  const holeRadius = APPLE_TAG_RING_HOLE_DIAMETER_MM / 2 + bevel;
  const hole = new Path();

  hole.absarc(0, holeY, holeRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const depth = Math.max(
    params.thickness - PRESET_BEVEL_THICKNESS_MM * 2,
    0.05,
  );
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: PRESET_BEVEL_SEGMENTS,
    bevelSize: bevel,
    bevelThickness: PRESET_BEVEL_THICKNESS_MM,
    curveSegments: PRESET_CURVE_SEGMENTS,
    depth,
    steps: 1,
  });

  geometry.translate(0, 0, PRESET_BEVEL_THICKNESS_MM);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

/**
 * Геометрия выбранного пресета.
 *
 * null означает «пресет ещё не реализован»: панель по этому же признаку гасит
 * кнопку скачивания, а API отвечает 422, поэтому заглушка не может уехать в
 * печать как правдоподобная модель.
 */
export function buildKeychainPresetGeometry(
  presetId: KeychainPresetId,
  params: KeychainPresetGeometryParams,
): ExtrudeGeometry | null {
  switch (presetId) {
    case "apple-tag":
      return buildAppleTag(params);
    default:
      return null;
  }
}
