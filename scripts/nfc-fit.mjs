/**
 * Временный анализ: влезает ли круглая NFC-метка Ø26 × 1 мм в каждый пресет.
 *
 * Задача — не кодировать карман, а получить числа: силуэт каждого пресета
 * строится тем же `buildKeychainPresetGeometry`, что и предпросмотр, затем
 * проекция растрируется в маску 0.1 мм, и для каждой клетки считается точное
 * евклидово расстояние до ближайшего свободного места (преобразование
 * Фельзенцвальба). Максимум этого расстояния — радиус наибольшего вписанного
 * круга, его центр — рекомендуемый центр кармана.
 *
 * Требования кармана: метка R13, кольцевая стенка 1.5 мм и слой крышки 1.5 мм.
 * Радиус вписанного круга должен быть не меньше 13 + 1.5 = 14.5 мм, а с учётом
 * фаски 0.4 мм, которая сжимает кромку со стороны задней грани, — 14.9 мм.
 * Толщина должна быть не меньше 1 + 1.5 = 2.5 мм.
 *
 * Запуск:
 *   node --import ./scripts/register-alias.mjs scripts/tmp-nfc-fit.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { KEYCHAIN_PRESETS } from "../lib/constructor/keychain-presets";
import {
  buildKeychainPresetGeometry,
  gearLayout,
  heartLayout,
  starburstLayout,
  ticketLayout,
} from "../lib/constructor/keychain-preset-geometry";
import { DEFAULT_QR_CARD_SPEC } from "../lib/constructor/qr-card-geometry";

/** Метка: диаметр и глубина кармана, мм. */
const TAG_DIAMETER_MM = 26;
const TAG_DEPTH_MM = 1;
/** Кольцевая стенка от края метки до контура, мм. */
const WALL_MM = 1.5;
/** Минимальный слой пластика над меткой, мм. */
const CAP_MM = 1.5;
/** Фаска контура: на столько сжимается кромка у задней грани, мм. */
const BEVEL_MM = 0.4;
/** Шаг растра, мм: 0.1 даёт погрешность радиуса ±0.05 мм. */
const CELL_MM = 0.1;
/** Поле вокруг габарита, мм: гарантирует свободные клетки у краёв растра. */
const PAD_MM = 2;

const REQUIRED_MM = TAG_DIAMETER_MM / 2 + WALL_MM;
const REQUIRED_BEVEL_MM = REQUIRED_MM + BEVEL_MM;
const REQUIRED_THICKNESS_MM = TAG_DEPTH_MM + CAP_MM;

/** Огромное, но конечное значение: с ним арифметика преобразования не даёт NaN. */
const FAR = 1e12;


/**
 * Растр силуэта: 1 — материал, 0 — пусто.
 *
 * Проекция всех треугольников даёт силуэт с дырками: стенки отверстий
 * вертикальны и в проекции вырождаются в линию, поэтому отверстия под кольцо и
 * перфорация остаются пустыми.
 */
function rasterize(geometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index ? index.count : position.count;
  const xs = [];
  const ys = [];

  for (let i = 0; i < count; i += 1) {
    const vertex = index ? index.getX(i) : i;

    xs.push(position.getX(vertex));
    ys.push(position.getY(vertex));
  }

  // Границы циклами, а не Math.min(...xs): у шестерни вершин десятки тысяч, и
  // разворот массива в аргументы переполняет стек.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < xs.length; i += 1) {
    minX = Math.min(minX, xs[i]);
    maxX = Math.max(maxX, xs[i]);
    minY = Math.min(minY, ys[i]);
    maxY = Math.max(maxY, ys[i]);
  }

  minX -= PAD_MM;
  maxX += PAD_MM;
  minY -= PAD_MM;
  maxY += PAD_MM;
  const width = Math.ceil((maxX - minX) / CELL_MM);
  const height = Math.ceil((maxY - minY) / CELL_MM);
  const mask = new Uint8Array(width * height);

  for (let t = 0; t < count; t += 3) {
    const ia = index ? index.getX(t) : t;
    const ib = index ? index.getX(t + 1) : t + 1;
    const ic = index ? index.getX(t + 2) : t + 2;
    const ax = (position.getX(ia) - minX) / CELL_MM;
    const ay = (position.getY(ia) - minY) / CELL_MM;
    const bx = (position.getX(ib) - minX) / CELL_MM;
    const by = (position.getY(ib) - minY) / CELL_MM;
    const cx = (position.getX(ic) - minX) / CELL_MM;
    const cy = (position.getY(ic) - minY) / CELL_MM;
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);

    if (Math.abs(area) < 1e-12) {
      // Вырожденная проекция вертикальной стенки: площади нет, заполнять нечего.
      continue;
    }

    const fromX = Math.max(Math.floor(Math.min(ax, bx, cx)), 0);
    const toX = Math.min(Math.ceil(Math.max(ax, bx, cx)), width - 1);
    const fromY = Math.max(Math.floor(Math.min(ay, by, cy)), 0);
    const toY = Math.min(Math.ceil(Math.max(ay, by, cy)), height - 1);

    for (let gy = fromY; gy <= toY; gy += 1) {
      for (let gx = fromX; gx <= toX; gx += 1) {
        const px = gx + 0.5;
        const py = gy + 0.5;
        const w0 = ((bx - ax) * (py - ay) - (px - ax) * (by - ay)) / area;
        const w1 = ((px - ax) * (cy - ay) - (cx - ax) * (py - ay)) / area;

        if (w0 >= -1e-9 && w1 >= -1e-9 && w0 + w1 <= 1 + 1e-9) {
          mask[gy * width + gx] = 1;
        }
      }
    }
  }

  return { mask, width, height, minX, minY };
}

/** Одномерное преобразование: нижняя огибающая парабол, квадраты расстояний. */
function transform1d(f, length) {
  const result = new Float64Array(length);
  const envelope = new Int32Array(length);
  const bounds = new Float64Array(length + 1);
  let top = 0;

  envelope[0] = 0;
  bounds[0] = -FAR;
  bounds[1] = FAR;

  for (let q = 1; q < length; q += 1) {
    let s =
      (f[q] + q * q - (f[envelope[top]] + envelope[top] * envelope[top])) /
      (2 * q - 2 * envelope[top]);

    while (s <= bounds[top]) {
      top -= 1;
      s =
        (f[q] + q * q - (f[envelope[top]] + envelope[top] * envelope[top])) /
        (2 * q - 2 * envelope[top]);
    }

    top += 1;
    envelope[top] = q;
    bounds[top] = s;
    bounds[top + 1] = FAR;
  }

  top = 0;

  for (let q = 0; q < length; q += 1) {
    while (bounds[top + 1] < q) {
      top += 1;
    }

    const delta = q - envelope[top];

    result[q] = delta * delta + f[envelope[top]];
  }

  return result;
}

/**
 * Расстояние от каждой клетки материала до ближайшей пустой клетки, мм.
 *
 * Пустые клетки — источники, поэтому значение 0 значит «здесь край или
 * отверстие»: радиус вписанного круга с центром в этой клетке равен нулю.
 */
function distanceToFree(shape) {
  const { mask, width, height } = shape;
  const column = new Float64Array(height);
  const grid = new Float64Array(width * height);

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      column[y] = mask[y * width + x] === 1 ? FAR : 0;
    }

    const transformed = transform1d(column, height);

    for (let y = 0; y < height; y += 1) {
      grid[y * width + x] = transformed[y];
    }
  }

  const row = new Float64Array(width);
  const squared = new Float64Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      row[x] = grid[y * width + x];
    }

    const transformed = transform1d(row, width);

    for (let x = 0; x < width; x += 1) {
      squared[y * width + x] = transformed[x];
    }
  }

  const radius = new Float64Array(width * height);

  for (let i = 0; i < squared.length; i += 1) {
    radius[i] = mask[i] === 1 ? Math.sqrt(squared[i]) * CELL_MM : 0;
  }

  return radius;
}

/** Центр клетки в миллиметрах модели. */
function cellCenter(shape, index) {
  const x = index % shape.width;
  const y = Math.floor(index / shape.width);

  return {
    x: shape.minX + (x + 0.5) * CELL_MM,
    y: shape.minY + (y + 0.5) * CELL_MM,
  };
}

/** Номер колонки, ближайшей к оси симметрии X = 0. */
function axisColumn(shape) {
  return Math.round((0 - shape.minX) / CELL_MM - 0.5);
}

/** Лучшая точка на оси X = 0: там центр кармана выглядит симметрично. */
function bestOnAxis(shape, radius) {
  const column = axisColumn(shape);
  let best = null;

  for (let y = 0; y < shape.height; y += 1) {
    const value = radius[y * shape.width + column];

    if (!best || value > best.radiusMm) {
      best = {
        radiusMm: value,
        y: cellCenter(shape, y * shape.width + column).y,
        index: y * shape.width + column,
      };
    }
  }

  return best;
}

/** Лучшая точка вообще: объясняет, чего не хватает даже в самом широком месте. */
function bestAnywhere(shape, radius) {
  let best = { radiusMm: -1, index: 0 };

  for (let i = 0; i < radius.length; i += 1) {
    if (radius[i] > best.radiusMm) {
      best = { radiusMm: radius[i], index: i };
    }
  }

  return { ...best, ...cellCenter(shape, best.index) };
}

/** Ближайшая пустая клетка: по ней видно, что именно ограничивает карман. */
function nearestFree(shape, index) {
  const x0 = index % shape.width;
  const y0 = Math.floor(index / shape.width);
  const reach = 260;
  let best = null;

  for (let dy = -reach; dy <= reach; dy += 1) {
    const y = y0 + dy;

    if (y < 0 || y >= shape.height) {
      continue;
    }

    for (let dx = -reach; dx <= reach; dx += 1) {
      const x = x0 + dx;

      if (x < 0 || x >= shape.width) {
        continue;
      }

      if (shape.mask[y * shape.width + x] === 1) {
        continue;
      }

      const distance = Math.hypot(dx, dy) * CELL_MM;

      if (!best || distance < best.distanceMm) {
        best = { distanceMm: distance, dx: dx * CELL_MM, dy: dy * CELL_MM };
      }
    }
  }

  return best;
}

/** Диапазоны Y на оси X = 0, где круг нужного радиуса ещё помещается. */
function validRanges(shape, radius, requiredMm) {
  const column = axisColumn(shape);
  const ranges = [];
  let start = null;

  for (let y = 0; y < shape.height; y += 1) {
    const fits = radius[y * shape.width + column] >= requiredMm;

    if (fits && start === null) {
      start = cellCenter(shape, y * shape.width + column).y;
    }

    if (!fits && start !== null) {
      ranges.push([
        start,
        cellCenter(shape, (y - 1) * shape.width + column).y,
      ]);
      start = null;
    }
  }

  if (start !== null) {
    ranges.push([
      start,
      cellCenter(shape, (shape.height - 1) * shape.width + column).y,
    ]);
  }

  return ranges;
}

/**
 * Тот же силуэт, но без внутренних отверстий.
 *
 * Нужен, чтобы отличить две причины отказа: узкий контур и отверстие под кольцо,
 * которое съедает середину. Заливаются только пустые клетки, недостижимые с
 * края растра: внешнее поле остаётся пустым.
 */
function fillInteriorHoles(shape) {
  const { mask, width, height } = shape;
  const outside = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const push = (index) => {
    if (mask[index] === 0 && outside[index] === 0) {
      outside[index] = 1;
      queue[tail] = index;
      tail += 1;
    }
  };

  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }

  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head];
    const x = index % width;
    const y = Math.floor(index / width);

    head += 1;

    if (x > 0) {
      push(index - 1);
    }

    if (x < width - 1) {
      push(index + 1);
    }

    if (y > 0) {
      push(index - width);
    }

    if (y < height - 1) {
      push(index + width);
    }
  }

  const filled = new Uint8Array(width * height);

  for (let i = 0; i < mask.length; i += 1) {
    filled[i] = outside[i] === 1 ? 0 : 1;
  }

  return { ...shape, mask: filled };
}




/** Габарит геометрии по трём осям. */
function bounds(geometry) {
  geometry.computeBoundingBox();

  return geometry.boundingBox;
}

/** Спецификация QR-визитки: крепление меняет положение отверстия под кольцо. */
function qrSpec(tab) {
  return {
    ...DEFAULT_QR_CARD_SPEC,
    tab,
    content: "https://tridi.ru/nfc",
  };
}

const results = [];
const ascii = [];

for (const preset of KEYCHAIN_PRESETS) {
  const variants =
    preset.id === "qr-card"
      ? [
          { label: "компакт, проушина", qr: qrSpec("tab") },
          { label: "компакт, отверстие", qr: qrSpec("hole") },
          { label: "широкая, отверстие", qr: qrSpec("hole"), width: 70, height: 45 },
          { label: "широкая, проушина", qr: qrSpec("tab"), width: 70, height: 45 },
        ]
      : [{ label: null, qr: null }];

  for (const variant of variants) {
    const params = {
      width: variant.width ?? preset.defaultWidth,
      height: variant.height ?? preset.defaultHeight,
      thickness: preset.defaultThickness,
      qr: variant.qr,
    };
    const geometry = buildKeychainPresetGeometry(preset.id, params);

    if (!geometry) {
      throw new Error(`Пресет ${preset.id} не собрался`);
    }

    const box = bounds(geometry);
    const shape = rasterize(geometry);
    const radius = distanceToFree(shape);
    const filled = fillInteriorHoles(shape);
    const contourRadius = distanceToFree(filled);
    const onAxis = bestOnAxis(shape, radius);
    const contourBest = bestOnAxis(shape, contourRadius);
    const anywhere = bestAnywhere(shape, radius);
    const obstacle = nearestFree(shape, onAxis.index);
    const ranges = validRanges(shape, radius, REQUIRED_BEVEL_MM);
    const widest = ranges.reduce(
      (best, range) =>
        best === null || range[1] - range[0] > best[1] - best[0] ? range : best,
      null,
    );
    const thickness = preset.defaultThickness;
    const capMm = thickness - TAG_DEPTH_MM;
    const fitsRadius = onAxis.radiusMm >= REQUIRED_BEVEL_MM;
    const fitsThickness = capMm >= CAP_MM;
    const recommendedY = widest
      ? Math.round(((widest[0] + widest[1]) / 2) * 10) / 10
      : null;
    // Проверка растра: площадь залитых внутренних дырок должна совпасть с
    // площадью отверстия Ø5 (19.63 мм²) — иначе проекция потеряла отверстие.
    let holeArea = 0;

    for (let i = 0; i < shape.mask.length; i += 1) {
      if (shape.mask[i] === 0 && filled.mask[i] === 1) {
        holeArea += CELL_MM * CELL_MM;
      }
    }

    results.push({
      id: preset.id,
      variant: variant.label,
      width: params.width,
      height: params.height,
      thickness,
      bbox: {
        x: box.max.x - box.min.x,
        y: box.max.y - box.min.y,
        z: box.max.z - box.min.z,
      },
      capMm,
      onAxisRadiusMm: onAxis.radiusMm,
      onAxisY: onAxis.y,
      contourRadiusMm: contourRadius[onAxis.index],
      contourBestRadiusMm: contourBest.radiusMm,
      contourBestY: contourBest.y,
      anywhereRadiusMm: anywhere.radiusMm,
      anywhereX: anywhere.x,
      anywhereY: anywhere.y,
      obstacle,
      ranges,
      fitsRadius,
      fitsThickness,
      fits: fitsRadius && fitsThickness,
      recommendedY,
    });


    // Карта 1 мм для глазной проверки растра: '#' — материал, '.' — пусто.
    const step = Math.round(1 / CELL_MM);
    const lines = [];

    console.log(
      `  отверстия в растре ${holeArea.toFixed(2)} мм², ` +
        `контур без отверстий: R${contourBest.radiusMm.toFixed(2)} при Y=${contourBest.y.toFixed(1)}`,
    );

    for (let y = shape.height - 1; y >= 0; y -= step) {
      let line = "";

      for (let x = 0; x < shape.width; x += step) {
        line += shape.mask[y * shape.width + x] === 1 ? "#" : ".";
      }

      lines.push(line);
    }

    ascii.push(
      `\n### ${preset.id}${variant.label ? ` / ${variant.label}` : ""} ${params.width} × ${params.height} × ${thickness}\n${lines.join("\n")}`,
    );

    console.log(
      `${preset.id}${variant.label ? ` (${variant.label})` : ""}: ` +
        `габарит ${(box.max.x - box.min.x).toFixed(2)} × ${(box.max.y - box.min.y).toFixed(2)} × ${(box.max.z - box.min.z).toFixed(2)}, ` +
        `R по контуру ${contourRadius[onAxis.index].toFixed(2)}, R с отверстиями ${onAxis.radiusMm.toFixed(2)} при Y=${onAxis.y.toFixed(1)}, ` +
        `максимум везде R${anywhere.radiusMm.toFixed(2)} в (${anywhere.x.toFixed(1)}, ${anywhere.y.toFixed(1)}), ` +
        `препятствие на (${obstacle.dx.toFixed(1)}, ${obstacle.dy.toFixed(1)}), ` +
        `окна Y: ${ranges.map(([a, b]) => `${a.toFixed(1)}…${b.toFixed(1)}`).join(", ") || "нет"}, ` +
        `крышка ${capMm.toFixed(2)} → ${fitsRadius && fitsThickness ? `ВЛЕЗАЕТ, Y=${recommendedY}` : "НЕ ВЛЕЗАЕТ"}`,
    );


    geometry.dispose();
  }
}

const outDir = path.join(os.tmpdir(), "tridi-nfc-fit");

mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, "fit.json"),
  JSON.stringify(
    { requiredMm: REQUIRED_MM, requiredBevelMm: REQUIRED_BEVEL_MM, results },
    null,
    2,
  ),
);
writeFileSync(path.join(outDir, "silhouettes.txt"), ascii.join("\n"));

console.log(`\nЧисла: ${path.join(outDir, "fit.json")}`);
console.log(`Силуэты: ${path.join(outDir, "silhouettes.txt")}`);

const ready = results.filter((item) => item.fits);

console.log(
  `\nВлезает ${ready.length} из ${results.length}: ` +
    ready.map((item) => `${item.id}@Y=${item.recommendedY}`).join(", "),
);
console.log(`Нужен радиус ${REQUIRED_BEVEL_MM} мм и толщина ${REQUIRED_THICKNESS_MM} мм.`);

// Точные числа раскладок: ими в отчёте называются конкретные препятствия
// (радиус впадины, положение отверстия), а не «примерно там».
console.log("\nРаскладки пресетов:");
console.log("ticket", JSON.stringify(ticketLayout(28, 60)));
console.log("starburst", JSON.stringify(starburstLayout(42, 42)));
console.log("heart", JSON.stringify(heartLayout(38, 40)));
console.log("gear", JSON.stringify(gearLayout(44, 44)));
