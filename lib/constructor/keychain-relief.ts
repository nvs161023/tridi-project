import { BoxGeometry } from "three";
import type { BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { KeychainTextSide } from "@/lib/constructor/keychain-text";
import type { ContourGroup } from "@/lib/constructor/shape-utils";
import { isPointInsideOutline } from "@/lib/constructor/svg-outline";

/**
 * Утопленный рельеф грани: плита с окнами по контурам букв или логотипа.
 *
 * Почему плита, а не «вырезать ямку». `ExtrudeGeometry` строит замкнутую оболочку,
 * а `mergeGeometries` объединяет её с телом: материала можно только добавить,
 * вычитания (CSG) в проекте нет. Поэтому утопление делается обратным приёмом —
 * тем же, каким `qr-card-geometry.ts` печатает углублённый код:
 *
 *   плита — поле вокруг рельефа, поднятое на `depth`; низ утоплен в тело на 0.1 мм;
 *   окна — места рисунка: там плиты нет, и он лежит на лице, то есть в канавке.
 *
 * Почему бруски, а не «плита с дырками». Отверстия задавались бы контурами букв, а
 * триангулятор three.js теряет грани крышки, когда отверстий много и их вершины
 * лежат на общих прямых: у плиты с окном буквы «А» оставалось 14 незамкнутых
 * рёбер, у двух строк с датой — 94, то есть модель перестала быть watertight.
 * Бруски такой беды не знают: каждая оболочка замкнута сама по себе, и слияние
 * выходит замкнутым всегда. Цена — ступенька по контуру размером в ячейку 0.35 мм;
 * на рельефе 8 мм она не видна, а FDM всё равно сглаживает кромку соплом 0.4 мм.
 */

/**
 * Насколько низ плиты входит в тело, мм.
 *
 * Меньше — плита может оторваться от лица на печати, больше — на тонкой основе
 * 2 мм остаётся мало тела на канавку.
 */
const RECESS_EMBED_MM = 0.1;

/** Ячейка плиты, мм: точность контура против размера сетки. */
const RECESS_CELL_MM = 0.35;

/** Перекрытие соседних брусков, мм: они не должны касаться гранями в ноль. */
const RECESS_OVERLAP_MM = 0.05;

/**
 * Поле плиты вокруг рельефа, доля его размера.
 *
 * Плита не должна подходить к соседнему рельефу вплотную: на печати два рельефа с
 * полем меньше 0.5 мм сливаются в одно пятно. Поле считается долей размера, а не
 * миллиметрами: тогда кегль и рамка масштабируются вместе, и поворот на 45° не
 * выносит угол плиты за силуэт — при постоянных 0.6 мм диагональ плиты добавляла к
 * габариту 0.85 мм на сторону и вылезала за кромку.
 */
export const KEYCHAIN_RECESS_FRAME_SHARE = 0.06;

/** Внедрение плиты в тело, мм: по нему считается высота канавки. */
export const KEYCHAIN_RECESS_EMBED_MM = RECESS_EMBED_MM;

/** Габарит группы контуров: ячейки вне буквы даже не проверяются. */
function contourBounds(group: ContourGroup) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [x, y] of group.outer) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return { maxX, maxY, minX, minY };
}

/**
 * Плита с окнами, поставленная на грань.
 *
 * `contours` приходят в координатах рельефа с центром в нуле: внутри контуров
 * плиты нет, снаружи она поднимается на `depth`. Поворот идёт вокруг центра
 * рельефа, поэтому 45° не уводит плиту вбок; на обороте она переворачивается
 * через X, как и выпуклый рельеф.
 *
 * `frame` — габарит плиты: для надписи это габарит блока плюс поле, для картинки —
 * рамка маски. `null` — контуров нет или всё поле занято рисунком: печатать нечего.
 */
export function createKeychainRecessedReliefGeometry(options: {
  centerX: number;
  centerY: number;
  /** Контуры рисунка в координатах рельефа. */
  contours: readonly ContourGroup[];
  /** Глубина канавки, мм: высота плиты над лицом. */
  depth: number;
  /** Габарит плиты, мм: прямоугольник с центром в нуле. */
  frame: { height: number; width: number };
  rotation: number;
  side: KeychainTextSide;
  thickness: number;
}): BufferGeometry | null {
  if (options.contours.length === 0) {
    return null;
  }

  const halfWidth = options.frame.width / 2;
  const halfHeight = options.frame.height / 2;
  const columns = Math.max(Math.ceil(options.frame.width / RECESS_CELL_MM), 1);
  const rows = Math.max(Math.ceil(options.frame.height / RECESS_CELL_MM), 1);
  const cellX = options.frame.width / columns;
  const cellY = options.frame.height / rows;
  const height = Math.max(options.depth, 0.1) + RECESS_EMBED_MM;
  const bounds = options.contours.map(contourBounds);
  const parts: BufferGeometry[] = [];
  // Ячейки под рисунком помечаются один раз: по ним вырезаются окна плиты.
  const filled = new Uint8Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    const y = -halfHeight + (row + 0.5) * cellY;

    for (let column = 0; column < columns; column += 1) {
      const x = -halfWidth + (column + 0.5) * cellX;
      const inner = options.contours.some((group, index) => {
        const box = bounds[index];

        if (x < box.minX || x > box.maxX || y < box.minY || y > box.maxY) {
          return false;
        }

        return isPointInsideOutline([x, y], [group.outer, ...group.holes]);
      });

      if (inner) {
        filled[row * columns + column] = 1;
      }
    }
  }

  // Свободные ячейки сливаются в бруски по строкам: одна оболочка на полосу, а не
  // на ячейку — иначе сетка выросла бы в десятки тысяч треугольников.
  for (let row = 0; row < rows; row += 1) {
    let runStart = -1;

    for (let column = 0; column <= columns; column += 1) {
      const free = column < columns && !filled[row * columns + column];

      if (free && runStart < 0) {
        runStart = column;

        continue;
      }

      if (free || runStart < 0) {
        continue;
      }

      const runColumns = column - runStart;
      const width = runColumns * cellX + RECESS_OVERLAP_MM * 2;
      const box = new BoxGeometry(width, cellY + RECESS_OVERLAP_MM * 2, height);

      box.translate(
        -halfWidth + (runStart + runColumns / 2) * cellX,
        -halfHeight + (row + 0.5) * cellY,
        height / 2,
      );
      // mergeGeometries требует одинакового набора атрибутов: у тела
      // (ExtrudeGeometry) сетка неиндексированная, поэтому брусок тоже
      // разворачивается в список треугольников.
      parts.push(box.toNonIndexed());
      box.dispose();
      runStart = -1;
    }
  }

  if (parts.length === 0) {
    return null;
  }

  const geometry = mergeGeometries(parts);

  parts.forEach((part) => part.dispose());

  if (!geometry) {
    return null;
  }

  geometry.rotateZ((options.rotation * Math.PI) / 180);

  if (options.side === "back") {
    geometry.rotateX(Math.PI);
  }

  const translateZ =
    options.side === "front"
      ? options.thickness - RECESS_EMBED_MM
      : RECESS_EMBED_MM;

  geometry.translate(options.centerX, options.centerY, translateZ);

  return geometry;
}
