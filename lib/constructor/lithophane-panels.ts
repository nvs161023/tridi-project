/**
 * Панели литофана: сколько их у формы и где лежит кадр каждой в общей карте.
 *
 * Панель — плита с рельефом одной фотографии. У плоской формы панель одна, у
 * куба их четыре (по грани), у цилиндра — от двух до четырёх: столько, сколько
 * выбрано в панели конструктора. Все панели печатаются одной деталью и
 * собираются на общем каркасе, поэтому кадры должны лежать в одной карте: у
 * каждого своя четверть.
 *
 * Карта — сетка 2 × 2 в RGBA, по кадру на квадрант. Квадрант панели считается по
 * её номеру: панель 1 — правый верхний (`u = 0.5, v = 0`), дальше против часовой
 * стрелки. Геометрия кладёт результат `lithophanePanelUv` в атрибут `uv`, а
 * `createLithophanePanelMapData` пишет кадр в тот же квадрант. Без общей таблицы
 * картинка и `uv` разъезжаются, и панель показывает чужой кадр.
 *
 * Внутри квадранта координата панели сжимается вдвое: кадр целиком занимает
 * четверть карты. Панелей у цилиндра может быть меньше четырёх — неиспользованные
 * квадранты остаются пустыми, и никто их не читает.
 */

import {
  LITHOPHANE_SIDE_IMAGE_SLOTS,
  type LithophaneBrightnessGrid,
  type LithophaneShape,
} from "./params";

/**
 * Больше четырёх панелей не бывает.
 *
 * Кадров у сборки тоже четыре: основной и три слота `lithophaneSideBrightness`.
 * Число выведено из слотов, а не задано отдельно, иначе карта кадров и слоты
 * панели разошлись бы.
 */
export const LITHOPHANE_PANEL_MAX = LITHOPHANE_SIDE_IMAGE_SLOTS + 1;

/** Минимум панелей у цилиндра: две — это уже абажур, одна была бы плоской. */
export const LITHOPHANE_PANEL_MIN = 2;

/**
 * Сколько панелей печатается у формы.
 *
 * У плоской панель одна, у куба четыре (по грани), у цилиндра — выбранное число,
 * зажатое в 2–4. Функция общая для геометрии, предпросмотра и панели
 * конструктора: слоты фотографий, `uv` и каркас считают панели одинаково.
 */
export function lithophanePanelCount(
  shape: LithophaneShape,
  panels: number,
): number {
  if (shape === "flat") {
    return 1;
  }

  if (shape === "cube") {
    return LITHOPHANE_PANEL_MAX;
  }

  const requested = Number.isFinite(panels)
    ? Math.trunc(panels)
    : LITHOPHANE_PANEL_MIN;

  return Math.min(
    LITHOPHANE_PANEL_MAX,
    Math.max(LITHOPHANE_PANEL_MIN, requested),
  );
}

/** Начало квадранта панели в общей карте кадров. */
export type LithophanePanelQuadrant = {
  /** Левый край квадранта, 0 или 0.5. */
  u: number;
  /** Верхний край квадранта, 0 или 0.5. */
  v: number;
};

/** Доля карты, которую занимает один кадр: четверть. */
const PANEL_QUADRANT_SCALE = 0.5;

/**
 * Квадранты по номерам панелей.
 *
 * Панель 1 — правый верхний квадрант; дальше против часовой стрелки: левый
 * верхний, левый нижний и правый нижний. Порядок совпадает с порядком слотов в
 * параметрах: основной кадр, слоты 1–3.
 */
const PANEL_QUADRANTS: readonly LithophanePanelQuadrant[] = [
  { u: 0.5, v: 0 },
  { u: 0, v: 0 },
  { u: 0, v: 0.5 },
  { u: 0.5, v: 0.5 },
];

/** Квадрант панели: номер зажимается в 1–4. */
export function lithophanePanelQuadrant(
  panel: number,
): LithophanePanelQuadrant {
  const index = Math.min(
    LITHOPHANE_PANEL_MAX - 1,
    Math.max(0, Math.trunc(panel)),
  );

  return PANEL_QUADRANTS[index];
}

/**
 * Координаты точки панели в общей карте кадров.
 *
 * `u` и `v` — положение внутри кадра панели (0–1), результат — положение в
 * карте 2 × 2. Геометрия кладёт этот результат в атрибут `uv`, а сборка карты
 * пишет пиксель кадра в тот же квадрант.
 */
export function lithophanePanelUv(
  panel: number,
  u: number,
  v: number,
): { u: number; v: number } {
  const quadrant = lithophanePanelQuadrant(panel);

  return {
    u: quadrant.u + u * PANEL_QUADRANT_SCALE,
    v: quadrant.v + v * PANEL_QUADRANT_SCALE,
  };
}

/**
 * Собирает общую карту кадров для предпросмотра.
 *
 * Карта — квадратная сетка `side × side` в RGBA, по кадру на квадрант. Пиксель
 * берётся билинейной выборкой из сетки своей панели, поэтому уменьшенный кадр
 * 150 × 100 ложится в квадрант без ступенек. Пустой слот повторяет первый кадр —
 * так же, как это делает `lithophaneFaceBrightness` в геометрии: одна
 * загруженная фотография печатается на всех панелях. Квадранты, которых у
 * выбранной формы нет, остаются чёрными, а `uv` на них не ссылается.
 *
 * Строка 0 данных — это `v = 0`, то есть верх кадра: `DataTexture` в three.js
 * читает данные снизу вверх, а `uv` панелей считают `v` от верха фото, поэтому
 * карта и рельеф совпадают по ориентации без переворота.
 */
export function createLithophanePanelMapData(
  grids: readonly (LithophaneBrightnessGrid | null)[],
  side: number,
): { data: Uint8Array; side: number } {
  const size = Math.max(2, Math.trunc(side / 2) * 2);
  const half = size / 2;
  const data = new Uint8Array(size * size * 4);
  const first = grids[0] ?? null;

  // Прозрачности в карте нет: непокрашенный квадрант — это чёрный пластик, а не
  // дыра. Материал предпросмотра непрозрачный, и нулевой альфа дал бы артефакты
  // на краю кадра.
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset + 3] = 255;
  }

  for (let panel = 0; panel < LITHOPHANE_PANEL_MAX; panel += 1) {
    const grid = grids[panel] ?? first;

    if (!grid) {
      continue;
    }

    const quadrant = lithophanePanelQuadrant(panel);
    const left = Math.round(quadrant.u * size);
    const top = Math.round(quadrant.v * size);

    for (let row = 0; row < half; row += 1) {
      const v = (row + 0.5) / half;
      const target = (top + row) * size + left;

      for (let column = 0; column < half; column += 1) {
        const value = sampleGrid(grid, (column + 0.5) / half, v);
        const offset = (target + column) * 4;

        data[offset] = value;
        data[offset + 1] = value;
        data[offset + 2] = value;
      }
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
