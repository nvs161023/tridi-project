/**
 * Четыре сектора круглой панели: раскладка кадров по квадрантам.
 *
 * Лицо круга разделено на четыре равных сектора по 90° от оси Y по часовой
 * стрелке: сектор 1 — правый верхний, дальше 2, 3 и 4. У каждого сектора своя
 * фотография, и в предпросмотре они лежат одной общей картой 2 × 2 — по кадру на
 * квадрант. Функции ниже держат это соответствие в одном месте: геометрия берёт
 * из них координаты `uv` для каждого сектора, а `Viewport` собирает ту же карту
 * из сеток яркости. Без общей таблицы картинка и `uv` разъезжаются, и сектор
 * показывает чужой кадр.
 *
 * Квадрант — это origin пары `uv` в общей карте: правый верхний начинается с
 * `u = 0.5, v = 0`, левый нижний — с `0, 0.5`. Внутри квадранта координата
 * сектора сжимается вдвое: кадр целиком занимает четверть карты.
 */

import type { LithophaneBrightnessGrid } from "./params";

/** Сколько секторов у круглой панели. */
export const LITHOPHANE_SECTOR_COUNT = 4;

/** Начало квадранта сектора в общей карте кадров. */
export type LithophaneSectorQuadrant = {
  /** Левый край квадранта, 0 или 0.5. */
  u: number;
  /** Верхний край квадранта, 0 или 0.5. */
  v: number;
};

/** Доля карты, которую занимает один кадр: четверть. */
const SECTOR_QUADRANT_SCALE = 0.5;

/**
 * Квадранты по номерам секторов.
 *
 * Сектор 1 смотрит в правый верхний угол диска, поэтому его кадр лежит в правом
 * верхнем квадранте карты; дальше по часовой стрелке — правый нижний, левый
 * нижний и левый верхний. Порядок совпадает с порядком слотов в параметрах.
 */
const SECTOR_QUADRANTS: readonly LithophaneSectorQuadrant[] = [
  { u: 0.5, v: 0 },
  { u: 0.5, v: 0.5 },
  { u: 0, v: 0.5 },
  { u: 0, v: 0 },
];

/** Квадрант сектора: номер зажимается в 1–4. */
export function lithophaneSectorQuadrant(
  sector: number,
): LithophaneSectorQuadrant {
  const index = Math.min(
    LITHOPHANE_SECTOR_COUNT - 1,
    Math.max(0, Math.trunc(sector)),
  );

  return SECTOR_QUADRANTS[index];
}

/**
 * Координаты точки сектора в общей карте кадров.
 *
 * `u` и `v` — положение внутри кадра сектора (0–1), результат — положение в
 * карте 2 × 2. Геометрия кладёт этот результат в атрибут `uv`, а сборка карты
 * пишет пиксель кадра в тот же квадрант.
 */
export function lithophaneSectorUv(
  sector: number,
  u: number,
  v: number,
): { u: number; v: number } {
  const quadrant = lithophaneSectorQuadrant(sector);

  return {
    u: quadrant.u + u * SECTOR_QUADRANT_SCALE,
    v: quadrant.v + v * SECTOR_QUADRANT_SCALE,
  };
}

/**
 * Собирает общую карту четырёх кадров для предпросмотра.
 *
 * Карта — квадратная сетка `side × side` в RGBA, по кадру на квадрант. Пиксель
 * берётся билинейной выборкой из сетки своего сектора, поэтому уменьшенный кадр
 * 150 × 100 ложится в квадрант без ступенек. Пустой слот повторяет первый кадр —
 * так же, как это делает `lithophaneFaceBrightness` в геометрии: одна
 * загруженная фотография печатается на всех четырёх секторах.
 *
 * Строка 0 данных — это `v = 0`, то есть верх кадра: `DataTexture` в three.js
 * читает данные снизу вверх, а `uv` секторов считают `v` от верха фото, поэтому
 * карта и рельеф совпадают по ориентации без переворота.
 */
export function createLithophaneSectorMapData(
  grids: readonly (LithophaneBrightnessGrid | null)[],
  side: number,
): { data: Uint8Array; side: number } {
  const size = Math.max(2, Math.trunc(side / 2) * 2);
  const data = new Uint8Array(size * size * 4);
  const first = grids[0] ?? null;
  const quadrants = SECTOR_QUADRANTS.map((quadrant, index) => {
    const grid = grids[index] ?? first;

    return { quadrant, grid };
  });

  for (let row = 0; row < size; row += 1) {
    const v = (row + 0.5) / size;
    const top = v < SECTOR_QUADRANT_SCALE;

    for (let column = 0; column < size; column += 1) {
      const u = (column + 0.5) / size;
      const left = u < SECTOR_QUADRANT_SCALE;
      const entry = quadrants.find(
        (candidate) =>
          candidate.quadrant.u === (left ? 0 : SECTOR_QUADRANT_SCALE) &&
          candidate.quadrant.v === (top ? 0 : SECTOR_QUADRANT_SCALE),
      );
      const offset = (row * size + column) * 4;
      const value = entry?.grid
        ? sampleGrid(
            entry.grid,
            u * 2 - (left ? 0 : 1),
            v * 2 - (top ? 0 : 1),
          )
        : 0;

      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  return { data, side: size };
}

/** Билинейная выборка яркости в точке кадра: `u` и `v` — доли стороны. */
function sampleGrid(
  grid: LithophaneBrightnessGrid,
  u: number,
  v: number,
): number {
  const { brightness, width, height } = grid;

  if (brightness.length < width * height || width < 2 || height < 2) {
    return 0;
  }

  const x = Math.min(width - 1, Math.max(0, u) * (width - 1));
  const y = Math.min(height - 1, Math.max(0, v) * (height - 1));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const top =
    brightness[y0 * width + x0] * (1 - fx) + brightness[y0 * width + x1] * fx;
  const bottom =
    brightness[y1 * width + x0] * (1 - fx) + brightness[y1 * width + x1] * fx;

  return Math.round(top * (1 - fy) + bottom * fy);
}
