/**
 * Калибровочные STL к урокам «Уверенного» и «Инженера».
 *
 * Почему генератор, а не готовые файлы из интернета. Калибровочных моделей в
 * общественном достоянии (CC0 / Public Domain) практически нет: на Thingiverse
 * и Printables они выходят под CC BY или CC BY-SA, то есть требуют указания
 * автора и той же лицензии для производных. Нам нужны модели без чужих прав,
 * поэтому геометрия строится здесь и права остаются у проекта. Это и есть
 * «без лицензии»: никаких условий от третьих лиц.
 *
 * Модели совпадают с текстами уроков: размеры в миллиметрах, стенка 1,2 мм,
 * дно в три слоя по 0,2 мм, зазоры 0,10–0,50 мм. Слайсеру нужны миллиметры и
 * ось Z вверх, поэтому координаты сразу строятся в этой системе: `STLExporter`
 * только сериализует готовые треугольники и ничего не поворачивает.
 *
 * Экспорт бинарный и детерминированный: одни и те же треугольники дают одни и
 * те же байты, поэтому хеши в консоли можно сверять между запусками.
 *
 * Запуск: `npm run make:stl`. Пишет три файла в `public/artifacts/models/`.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BufferGeometry, Float32BufferAttribute, Mesh } from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "artifacts", "models");

/** Те же пределы, что проверяет `npm run check:stats`. */
const MIN_BYTES = 1024;
const MAX_BYTES = 300 * 1024;

/** Точка в миллиметрах: [x, y, z], Z направлена вверх. */
const point = (x, y, z) => [x, y, z];

/** Плоский четырёхугольник из двух треугольников; порядок точек задаёт нормаль. */
function quad(triangles, a, b, c, d) {
  triangles.push(...a, ...b, ...c, ...a, ...c, ...d);
}

/**
 * Прямоугольный параллелепипед: 12 треугольников, нормали наружу.
 *
 * Обход каждой грани выбран так, чтобы векторное произведение первых двух
 * рёбер смотрело из тела: слайсеры ориентируются на нормали, а не на порядок
 * вершин, но кривые нормали дают «дырявую» модель.
 */
function pushBox(triangles, min, max) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;

  const p000 = point(x0, y0, z0);
  const p100 = point(x1, y0, z0);
  const p110 = point(x1, y1, z0);
  const p010 = point(x0, y1, z0);
  const p001 = point(x0, y0, z1);
  const p101 = point(x1, y0, z1);
  const p111 = point(x1, y1, z1);
  const p011 = point(x0, y1, z1);

  quad(triangles, p000, p010, p110, p100); // дно, −Z
  quad(triangles, p001, p101, p111, p011); // верх, +Z
  quad(triangles, p000, p100, p101, p001); // −Y
  quad(triangles, p100, p110, p111, p101); // +X
  quad(triangles, p110, p010, p011, p111); // +Y
  quad(triangles, p010, p000, p001, p011); // −X
}

/**
 * Открытая сверху коробка одной замкнутой оболочкой: 28 треугольников.
 *
 * Такой куб не состоит из пересекающихся тел, поэтому его можно показывать как
 * эталон: внешние стенки, внутренние стенки, дно и кольцо-кромка сверху. Верх
 * открыт — видно и первый слой, и толщину стенки.
 */
function hollowBox(triangles, min, max, wall, floor) {
  const [X0, Y0, Z0] = min;
  const [X1, Y1, Z1] = max;
  const x0 = X0 + wall;
  const x1 = X1 - wall;
  const y0 = Y0 + wall;
  const y1 = Y1 - wall;
  const zf = Z0 + floor;

  quad(triangles, point(X0, Y0, Z0), point(X0, Y1, Z0), point(X1, Y1, Z0), point(X1, Y0, Z0));
  quad(triangles, point(X1, Y0, Z0), point(X1, Y1, Z0), point(X1, Y1, Z1), point(X1, Y0, Z1));
  quad(triangles, point(X0, Y1, Z0), point(X0, Y0, Z0), point(X0, Y0, Z1), point(X0, Y1, Z1));
  quad(triangles, point(X1, Y1, Z0), point(X0, Y1, Z0), point(X0, Y1, Z1), point(X1, Y1, Z1));
  quad(triangles, point(X0, Y0, Z0), point(X1, Y0, Z0), point(X1, Y0, Z1), point(X0, Y0, Z1));

  quad(triangles, point(x0, y0, zf), point(x1, y0, zf), point(x1, y1, zf), point(x0, y1, zf));
  quad(triangles, point(x0, y0, zf), point(x0, y1, zf), point(x0, y1, Z1), point(x0, y0, Z1));
  quad(triangles, point(x1, y1, zf), point(x1, y0, zf), point(x1, y0, Z1), point(x1, y1, Z1));
  quad(triangles, point(x1, y0, zf), point(x0, y0, zf), point(x0, y0, Z1), point(x1, y0, Z1));
  quad(triangles, point(x0, y1, zf), point(x1, y1, zf), point(x1, y1, Z1), point(x0, y1, Z1));

  quad(triangles, point(X0, Y0, Z1), point(X1, Y0, Z1), point(x1, y0, Z1), point(x0, y0, Z1));
  quad(triangles, point(X1, Y0, Z1), point(X1, Y1, Z1), point(x1, y1, Z1), point(x1, y0, Z1));
  quad(triangles, point(X1, Y1, Z1), point(X0, Y1, Z1), point(x0, y1, Z1), point(x1, y1, Z1));
  quad(triangles, point(X0, Y1, Z1), point(X0, Y0, Z1), point(x0, y0, Z1), point(x0, y1, Z1));
}

/** Габариты по треугольникам: `[minX, minY, minZ, maxX, maxY, maxZ]`. */
function boundsOf(triangles) {
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];

  for (let index = 0; index < triangles.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = triangles[index + axis];
      bounds[axis] = Math.min(bounds[axis], value);
      bounds[axis + 3] = Math.max(bounds[axis + 3], value);
    }
  }

  return bounds;
}

/** Сравнение габаритов с обещанными в подсказке урока. */
function sameBounds(actual, expected) {
  return actual.every((value, index) => Math.abs(value - expected[index]) < 1e-6);
}

/**
 * Экспорт одной модели: проверки до записи, чтобы битый файл не попал в public.
 *
 * Бинарный STL — это 80 байт заголовка, число треугольников (uint32) и по 50
 * байт на грань. Расхождение размера и счётчика означает, что файл не прочтёт
 * слайсер; тогда скрипт падает, а не пишет мусор.
 */
function exportModel({ name, hint, triangles, bounds }) {
  for (const value of triangles) {
    if (!Number.isFinite(value)) {
      throw new Error(`${name}: координата не число`);
    }
  }

  if (triangles.length % 9 !== 0) {
    throw new Error(
      `${name}: ${triangles.length} координат — не целое число треугольников`,
    );
  }

  const mesh = new Mesh(new BufferGeometry());
  mesh.geometry.setAttribute(
    "position",
    new Float32BufferAttribute(triangles, 3),
  );
  mesh.updateMatrixWorld(true);

  const exported = new STLExporter().parse(mesh, { binary: true });
  const bytes = Buffer.from(
    exported.buffer,
    exported.byteOffset,
    exported.byteLength,
  );
  const faces = triangles.length / 9;
  const expectedBytes = 84 + faces * 50;

  if (bytes.byteLength !== expectedBytes) {
    throw new Error(
      `${name}: размер ${bytes.byteLength} Б, ожидалось ${expectedBytes} Б ` +
        `для ${faces} треугольников`,
    );
  }

  if (bytes.readUInt32LE(80) !== faces) {
    throw new Error(`${name}: счётчик треугольников в заголовке не совпал`);
  }

  if (bytes.byteLength < MIN_BYTES || bytes.byteLength > MAX_BYTES) {
    throw new Error(
      `${name}: размер ${bytes.byteLength} Б вне пределов check:stats`,
    );
  }

  const actualBounds = boundsOf(triangles);

  if (!sameBounds(actualBounds, bounds)) {
    throw new Error(
      `${name}: габариты ${actualBounds
        .map((value) => value.toFixed(2))
        .join("×")}, ожидались ${bounds
        .map((value) => value.toFixed(2))
        .join("×")}`,
    );
  }

  const file = path.join(OUT_DIR, name);
  writeFileSync(file, bytes);

  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const size = `${bounds[3] - bounds[0]}×${bounds[4] - bounds[1]}×${
    bounds[5] - bounds[2]
  }`;

  console.log(
    `  ✓ ${name} — ${faces} треугольников, ${bytes.byteLength} Б, ${size} мм, sha256 ${hash}…`,
  );
  console.log(`    ${hint}`);

  return bytes.byteLength;
}


/**
 * Три модели из плана. Правки геометрии допустимы, но тогда нужно менять и
 * строки уроков: тексты называют те же числа (стенка 1,2 мм, зазоры
 * 0,10–0,50 мм, куб 20 мм).
 */
const MODELS = [
  {
    name: "calibration-cube-20mm.stl",
    hint: "куб 20×20×20, стенка 1,2 мм, дно 0,6 мм (три слоя по 0,2), верх открыт",
    bounds: [0, 0, 0, 20, 20, 20],
    triangles: () => {
      const triangles = [];
      hollowBox(triangles, point(0, 0, 0), point(20, 20, 20), 1.2, 0.6);
      return triangles;
    },
  },
  {
    name: "retraction-test.stl",
    hint: "две башни 10×10×30 через 30 мм, мост 30 мм на высоте 18 мм",
    bounds: [0, 0, 0, 50, 10, 30],
    triangles: () => {
      const triangles = [];
      pushBox(triangles, point(0, 0, 0), point(10, 10, 30));
      pushBox(triangles, point(40, 0, 0), point(50, 10, 30));
      // Мост заходит в башни на 1 мм: слайсер объединяет пересекающиеся тела,
      // а совпадающих граней (частая причина артефактов) не остаётся.
      pushBox(triangles, point(9, 0, 18), point(41, 10, 20));
      return triangles;
    },
  },
  {
    name: "clearance-test.stl",
    hint: "плита 40×30×4 и пять пар стенок с зазорами 0,10 / 0,15 / 0,20 / 0,30 / 0,50 мм",
    bounds: [0, 0, 0, 40, 30, 14],
    triangles: () => {
      const triangles = [];
      const gaps = [0.1, 0.15, 0.2, 0.3, 0.5];
      const wall = 1.2;
      const wallHeight = 10;
      const plateHeight = 4;
      // Стенки заходят в плиту на 0,4 мм — по той же причине, что и мост.
      const overlap = 0.4;
      let x = 4;

      pushBox(triangles, point(0, 0, 0), point(40, 30, plateHeight));

      for (const gap of gaps) {
        pushBox(
          triangles,
          point(x, 5, plateHeight - overlap),
          point(x + wall, 25, plateHeight + wallHeight),
        );

        const second = x + wall + gap;

        pushBox(
          triangles,
          point(second, 5, plateHeight - overlap),
          point(second + wall, 25, plateHeight + wallHeight),
        );

        x = second + wall + 3;
      }

      return triangles;
    },
  },
];

mkdirSync(OUT_DIR, { recursive: true });

console.log(
  `Калибровочные STL → ${path
    .relative(ROOT, OUT_DIR)
    .split(path.sep)
    .join("/")}`,
);

let totalBytes = 0;

for (const model of MODELS) {
  totalBytes += exportModel({ ...model, triangles: model.triangles() });
}

console.log(
  `Готово: ${MODELS.length} файла, ${(totalBytes / 1024).toFixed(1)} КБ. ` +
    "Права у проекта, сторонних лицензий и требований об атрибуции нет.",
);

