/**
 * Подготовка сгенерированной модели к печати.
 *
 * Сеть генерации отдаёт «скульптурную» сетку: треугольники мелкие, поверхность
 * в суб-сопловом рельефе. Слайсер на такой сетке видит на каждом слое десяток
 * замкнутых контуров (микроострова), режет их как крошки и печатает кольца
 * вместо гладкой детали. Дырок при этом нет: `cat.stl` из витрины замкнут, но
 * медианный двугранный угол между соседними треугольниками — 15.9°, а у гладкой
 * печатной модели он 2–5°.
 *
 * Здесь сетка пересобирается от поля расстояний, как это делают «слайсерные»
 * ремешеры:
 *
 *   1. модель разворачивается осью Z вверх (glTF отдаёт Y вверх);
 *   2. строится поле знаковых расстояний в воксельной сетке 0.55 мм: точное
 *      расстояние в полосе шириной 1.6 ячейки, знак — по нормали ближайшего
 *      треугольника, а вдали от поверхности — заливкой снаружи;
 *   3. снизу поле пересекается с полупространством стола: база становится
 *      плоской без возни с триангуляцией среза;
 *   4. изоповерхность вытягивается марширующими тетраэдрами (разбиение куба на
 *      шесть тетраэдров, без таблиц на 256 случаев): результат замкнут и
 *      гарантированно без микроостровов;
 *   5. поверхность сглаживается Таубином — вершины базы при этом закреплены,
 *      чтобы плоскость стола осталась плоскостью;
 *   6. оболочки меньше 20 мм³ отбрасываются, модель садится на стол.
 *
 * Почему не сглаживание исходной сетки: сорок итераций Таубина на `cat.stl`
 * дают медиану 9.8° и всё ещё 5.7 микроострова на слой. Рельеф не «дрожание»
 * вершин, его надо пересобрать.
 *
 * Модуль намеренно без зависимостей и без WebAssembly: он работает в том же
 * процессе Next, что и «мясорубка», и не требует ни Python-сервиса, ни
 * нативной сборки.
 */

/** Треугольная сетка в миллиметрах: позиции xyz и индексы тройками. */
export type PrintMesh = {
  positions: Float32Array;
  indices: Uint32Array;
};

/** Готовая сетка и цифры для лога: по ним видно, что именно сделал ремеш. */
export type PrintPrepResult = {
  mesh: PrintMesh;
  trianglesBefore: number;
  trianglesAfter: number;
  cellMm: number;
  removedParts: number;
  volumeCm3: number;
  baseAreaMm2: number;
};

/**
 * Шаг воксельной сетки, мм: полтора сопла 0.4 — рельеф мельче уже не нужен.
 *
 * Шаг 0.45 проверен на коте и откачен: детализация выше, но настоящая щель
 * 0.3 мм между лапой и корпусом перестаёт схлопываться и даёт 2.6 контура на
 * слой вместо 1.6 — слайсер рисует её отдельной петлёй. 0.55 такую щель
 * закрывает сам, и печать чище.
 */
export const PRINT_CELL_MM = 0.55;

/** Сколько срезается снизу, чтобы пятно контакта стало плоским, мм. */
export const BED_CUT_MM = 1.2;

/** Полоса точных расстояний вокруг поверхности, в ячейках. */
const BAND_CELLS = 1.6;

/** Оболочки меньше этого объёма — мусор генерации, мм³. */
const MIN_PART_MM3 = 20;

/**
 * Оболочки ниже этого слоя — плоская крошка, мм.
 *
 * Тонкий «блинчик» площадью в сантиметр и высотой в полмиллиметра весит больше
 * 20 мм³ и проходит по объёму, но печатается мусорной линией в первом слое.
 */
const MIN_PART_HEIGHT_MM = 1.2;

/** Итерации Таубина: три прохода снимают гранёность, пять — уже без выигрыша. */
const SMOOTH_PASSES = 3;

/** Коэффициенты Таубина: вперёд сглаживает, назад возвращает объём. */
const SMOOTH_LAMBDA = 0.5;
const SMOOTH_MU = -0.53;

/** Предохранитель по памяти: 20 млн точек — это 80 МБ на поле расстояний. */
const MAX_GRID_POINTS = 20_000_000;

/** База считается плоской, если вершина выше плоскости стола не больше чем на это. */
const BASE_EPSILON_MM = 0.001;

/** Проходы чистки одиночных точек поля: одна точка — ямка, две — уже деталь. */
const DESPECKLE_PASSES = 3;

/**
 * Сдвиг узла, попавшего ровно на изоповерхность, мм.
 *
 * Ноль в узле — это пересечение ребра точно в узле: соседние рёбра дали бы
 * вершины в одной и той же точке, и поверхность стала бы незамкнутой. Микрон в
 * минус уводит узел наружу, а на печати микрон не виден.
 */
const FIELD_EPSILON_MM = 0.0001;

/** Шесть тетраэдров куба (разбиение Куна через диагональ 0–7). */
const CUBE_TETS = [
  [0, 1, 3, 7],
  [0, 1, 5, 7],
  [0, 2, 3, 7],
  [0, 2, 6, 7],
  [0, 4, 5, 7],
  [0, 4, 6, 7],
] as const;

/** Габариты сетки по трём осям. */
type Bounds = {
  min: [number, number, number];
  max: [number, number, number];
};

/** Поле расстояний: значения в узлах сетки и геометрия самой сетки. */
type Field = {
  values: Float32Array;
  nx: number;
  ny: number;
  nz: number;
  origin: [number, number, number];
  cell: number;
  cutZ: number;
};

/**
 * Готовит сетку к печати: ось Z вверх, плоская база, воксельный ремеш.
 *
 * На вход подаётся сетка в миллиметрах в осях glTF (Y вверх), на выходе —
 * замкнутая сетка на столе, центр XY в нуле, низ на Z = 0.
 */
export function makePrintReady(mesh: PrintMesh): PrintPrepResult {
  if (mesh.indices.length < 3 || mesh.positions.length < 9) {
    throw new Error("print-prep: пустая сетка");
  }

  const oriented = orientZUp(mesh);
  const bounds = measureBounds(oriented.positions);
  const height = bounds.max[2] - bounds.min[2];
  const cell = pickCell(bounds);
  const cutZ = bounds.min[2] + Math.min(BED_CUT_MM, height / 4);
  const field = buildField(oriented, cell, cutZ);
  const isosurface = marchingTetrahedra(field);
  const smoothed = taubin(isosurface, cutZ, cell);
  const kept = dropSmallParts(smoothed);
  const placed = sitOnBed(kept.mesh);

  return {
    mesh: placed,
    trianglesBefore: mesh.indices.length / 3,
    trianglesAfter: placed.indices.length / 3,
    cellMm: cell,
    removedParts: kept.dropped,
    volumeCm3: measureVolume(placed) / 1000,
    baseAreaMm2: measureBase(placed),
  };
}

/**
 * Разворачивает модель осью Z вверх.
 *
 * glTF (а значит и обе сети генерации) считает Y верхом, слайсер — Z. Это
 * поворот на +90° вокруг X: (x, y, z) → (x, −z, y). Определитель +1, поэтому
 * обход треугольников остаётся прежним и нормали не выворачиваются.
 */
function orientZUp(mesh: PrintMesh): PrintMesh {
  const { positions, indices } = mesh;
  const rotated = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    rotated[i] = positions[i];
    rotated[i + 1] = -positions[i + 2];
    rotated[i + 2] = positions[i + 1];
  }

  return { positions: rotated, indices };
}

/** Габариты по позициям сетки. */
function measureBounds(positions: Float32Array): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[i + axis];

      if (value < min[axis]) {
        min[axis] = value;
      }

      if (value > max[axis]) {
        max[axis] = value;
      }
    }
  }

  return { min, max };
}

/**
 * Убирает одиночные точки с чужим знаком.
 *
 * В складках поверхности знак по нормали ближайшего треугольника ошибается: на
 * внешнюю точку может «смотреть» треугольник с другой стороны гребня, и точка
 * попадает внутрь. В изоповерхности такая точка даёт ямку или прокол размером в
 * ячейку — на срезе это отдельный микро-контур, а на печати — дырка.
 *
 * Правило осторожное: переворачивается только точка, у которой из шести соседей
 * своего знака не больше одного. Плёнка толщиной в ячейку так не страдает — у
 * неё четыре соседа из шести.
 */
function despeckle(field: Omit<Raster, "origin" | "cell">): void {
  const { nx, ny, nz, side } = field;
  const nxy = nx * ny;
  const flips: number[] = [];

  for (let pass = 0; pass < DESPECKLE_PASSES; pass += 1) {
    flips.length = 0;

    for (let k = 1; k < nz - 1; k += 1) {
      for (let j = 1; j < ny - 1; j += 1) {
        for (let i = 1; i < nx - 1; i += 1) {
          const index = (k * ny + j) * nx + i;
          const label = side[index];
          const same =
            (side[index - 1] === label ? 1 : 0) +
            (side[index + 1] === label ? 1 : 0) +
            (side[index - nx] === label ? 1 : 0) +
            (side[index + nx] === label ? 1 : 0) +
            (side[index - nxy] === label ? 1 : 0) +
            (side[index + nxy] === label ? 1 : 0);

          if (same <= 1) {
            flips.push(index);
          }
        }
      }
    }

    // Перевороты применяются после прохода: соседи внутри прохода читаются по
    // исходному состоянию, иначе ямка «расползалась» бы за один проход.
    for (const index of flips) {
      side[index] = side[index] === 1 ? -1 : 1;
    }

    if (flips.length === 0) {
      break;
    }
  }
}

/**
 * Строит поле знаковых расстояний в воксельной сетке.
 *
 * В полосе 1.6 ячейки вокруг поверхности считается точное расстояние до
 * ближайшего треугольника, а знак берётся по его нормали: точка с той стороны,
 * куда смотрит нормаль, — снаружи. Вдали от поверхности точное расстояние не
 * нужно, достаточно знака, и он добывается заливкой от границы сетки: всё, до
 * чего заливка не добралась, — внутренность. Заливка идёт только по точкам вне
 * полосы, поэтому сквозь стенки не протекает.
 *
 * Нормали задают знак только в полосе, то есть там, где поверхность рядом и
 * ошибка в одну ячейку невозможна. Это же делает метод устойчивым к мелкому
 * рельефу: у рваной сетки в полосе всё равно есть ближайший треугольник и его
 * нормаль.
 */
function buildField(mesh: PrintMesh, cell: number, cutZ: number): Field {
  const bounds = measureBounds(mesh.positions);
  const margin = cell * 2;
  const origin: [number, number, number] = [
    bounds.min[0] - margin,
    bounds.min[1] - margin,
    bounds.min[2] - margin,
  ];
  const nx = Math.floor((bounds.max[0] + margin - origin[0]) / cell) + 1;
  const ny = Math.floor((bounds.max[1] + margin - origin[1]) / cell) + 1;
  const nz = Math.floor((bounds.max[2] + margin - origin[2]) / cell) + 1;
  const total = nx * ny * nz;

  if (total > MAX_GRID_POINTS || total <= 0) {
    throw new Error(`print-prep: сетка поля слишком велика (${total} точек)`);
  }

  const band = cell * BAND_CELLS;
  const near = new Float32Array(total).fill(band);
  const side = new Int8Array(total);

  rasterize(mesh, { origin, cell, nx, ny, nz, band, near, side });
  floodOutside({ nx, ny, nz, band, near, side });
  despeckle({ nx, ny, nz, band, near, side });

  // Знак поля: положительно внутри. Стол — полупространство z >= cutZ, его
  // поле линейно, поэтому пересечение (min) даёт ровный срез без отдельной
  // триангуляции: изоповерхность пересекает x - cutZ по плоскости.
  const values = new Float32Array(total);

  for (let k = 0; k < nz; k += 1) {
    const z = origin[2] + k * cell - cutZ;

    for (let j = 0; j < ny; j += 1) {
      const row = (k * ny + j) * nx;

      for (let i = 0; i < nx; i += 1) {
        const index = row + i;
        const solid = -side[index] * near[index];
        const value = solid < z ? solid : z;
        // Ровно ноль — узел ровно на поверхности. Такой узел попадает в
        // «снаружи», но пересечение ребра пришлось бы точно в узел, и вершины с
        // разных рёбер слиплись бы в одну точку. Сдвигаем на микрон в минус.
        values[index] = value === 0 ? -FIELD_EPSILON_MM : value;
      }
    }
  }

  return { values, nx, ny, nz, origin, cell, cutZ };
}

/** Внутренние параметры растеризации: сетка плюс буферы поля. */
type Raster = {
  origin: [number, number, number];
  cell: number;
  nx: number;
  ny: number;
  nz: number;
  band: number;
  near: Float32Array;
  side: Int8Array;
};

/**
 * Раскладывает расстояние до треугольников по узлам сетки.
 *
 * Треугольники скульптурной сетки мелкие, поэтому на каждый приходится около
 * сотни узлов: 100 000 треугольников × 100 ≈ 10 млн вычислений — секунда-две.
 */
function rasterize(mesh: PrintMesh, raster: Raster): void {
  const { origin, cell, nx, ny, nz, band, near, side } = raster;
  const { positions, indices } = mesh;
  const closest = new Float64Array(3);
  const triangleCount = Math.floor(indices.length / 3);

  for (let t = 0; t < triangleCount; t += 1) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const ax = positions[a];
    const ay = positions[a + 1];
    const az = positions[a + 2];
    const bx = positions[b];
    const by = positions[b + 1];
    const bz = positions[b + 2];
    const cx = positions[c];
    const cy = positions[c + 1];
    const cz = positions[c + 2];

    // Нормаль треугольника: по ней определяется сторона в полосе.
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const rawX = uy * vz - uz * vy;
    const rawY = uz * vx - ux * vz;
    const rawZ = ux * vy - uy * vx;
    const length = Math.hypot(rawX, rawY, rawZ);

    if (length < 1e-12) {
      continue;
    }

    const normalX = rawX / length;
    const normalY = rawY / length;
    const normalZ = rawZ / length;

    const loX = clampIndex(Math.floor((Math.min(ax, bx, cx) - band - origin[0]) / cell), nx);
    const hiX = clampIndex(Math.ceil((Math.max(ax, bx, cx) + band - origin[0]) / cell), nx);
    const loY = clampIndex(Math.floor((Math.min(ay, by, cy) - band - origin[1]) / cell), ny);
    const hiY = clampIndex(Math.ceil((Math.max(ay, by, cy) + band - origin[1]) / cell), ny);
    const loZ = clampIndex(Math.floor((Math.min(az, bz, cz) - band - origin[2]) / cell), nz);
    const hiZ = clampIndex(Math.ceil((Math.max(az, bz, cz) + band - origin[2]) / cell), nz);

    for (let k = loZ; k <= hiZ; k += 1) {
      const pz = origin[2] + k * cell;

      for (let j = loY; j <= hiY; j += 1) {
        const py = origin[1] + j * cell;
        const row = (k * ny + j) * nx;

        for (let i = loX; i <= hiX; i += 1) {
          const px = origin[0] + i * cell;
          closestPointOnTriangle(
            px, py, pz,
            ax, ay, az, bx, by, bz, cx, cy, cz,
            closest,
          );

          const dx = px - closest[0];
          const dy = py - closest[1];
          const dz = pz - closest[2];
          const distance = Math.hypot(dx, dy, dz);
          const index = row + i;

          if (distance < near[index]) {
            near[index] = distance;
            side[index] = dx * normalX + dy * normalY + dz * normalZ >= 0 ? 1 : -1;
          }
        }
      }
    }
  }
}

/** Зажимает индекс узла в допустимый диапазон. */
function clampIndex(value: number, size: number): number {
  if (value < 0) {
    return 0;
  }

  return value > size - 1 ? size - 1 : value;
}

/**
 * Ближайшая точка треугольника (алгоритм Эриксона по областям Вороного).
 *
 * Результат пишется в `out`, а не возвращается объектом: функция вызывается
 * миллионы раз, и аллокация на каждый вызов съела бы всё время.
 */
function closestPointOnTriangle(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  out: Float64Array,
): void {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;

  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;

  if (d1 <= 0 && d2 <= 0) {
    out[0] = ax;
    out[1] = ay;
    out[2] = az;
    return;
  }

  const bpx = px - bx;
  const bpy = py - by;
  const bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;

  if (d3 >= 0 && d4 <= d3) {
    out[0] = bx;
    out[1] = by;
    out[2] = bz;
    return;
  }

  const vc = d1 * d4 - d3 * d2;

  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    out[0] = ax + abx * v;
    out[1] = ay + aby * v;
    out[2] = az + abz * v;
    return;
  }

  const cpx = px - cx;
  const cpy = py - cy;
  const cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;

  if (d6 >= 0 && d5 <= d6) {
    out[0] = cx;
    out[1] = cy;
    out[2] = cz;
    return;
  }

  const vb = d5 * d2 - d1 * d6;

  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    out[0] = ax + acx * w;
    out[1] = ay + acy * w;
    out[2] = az + acz * w;
    return;
  }

  const va = d3 * d6 - d5 * d4;

  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    out[0] = bx + (cx - bx) * w;
    out[1] = by + (cy - by) * w;
    out[2] = bz + (cz - bz) * w;
    return;
  }

  const denominator = va + vb + vc;

  if (Math.abs(denominator) < 1e-20) {
    out[0] = ax;
    out[1] = ay;
    out[2] = az;
    return;
  }

  const v = vb / denominator;
  const w = vc / denominator;
  out[0] = ax + abx * v + acx * w;
  out[1] = ay + aby * v + acy * w;
  out[2] = az + abz * v + acz * w;
}

/**
 * Вытягивает изоповерхность марширующими тетраэдрами.
 *
 * Кубическая сетка разбивается на шесть тетраэдров диагональю 0–7 — такое
 * разбиение согласовано между соседними ячейками, поэтому поверхность выходит
 * без щелей и без таблиц на 256 случаев. Вершины на рёбрах переиспользуются по
 * ключу из пары узлов сетки: вода не течёт, каждая вершина одна.
 *
 * Ориентация треугольников не берётся из таблицы, а проверяется по центроиду
 * внутренности тетраэдра: нормаль обязана смотреть от него наружу. Так
 * вывернутых треугольников не остаётся ни в одном из случаев.
 */
function marchingTetrahedra(field: Field): PrintMesh {
  const { values, nx, ny, nz, origin, cell } = field;
  const nxy = nx * ny;
  const totalPoints = nxy * nz;
  const cornerIndex = new Int32Array(8);
  const cornerValue = new Float64Array(8);
  const cornerX = new Float64Array(8);
  const cornerY = new Float64Array(8);
  const cornerZ = new Float64Array(8);
  const insideCenter = new Float64Array(3);
  const tet = new Int32Array(4);
  const insideList = new Int32Array(4);
  const outsideList = new Int32Array(4);
  const polygon = new Int32Array(4);
  const shared = new Map<number, number>();
  const positions: number[] = [];
  const indices: number[] = [];

  /** Вершина на ребре «внутри → снаружи», общая для соседних тетраэдров. */
  const vertexOnEdge = (inside: number, outside: number): number => {
    const insideIndex = cornerIndex[inside];
    const outsideIndex = cornerIndex[outside];
    const key =
      insideIndex < outsideIndex
        ? insideIndex * totalPoints + outsideIndex
        : outsideIndex * totalPoints + insideIndex;
    const cached = shared.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const from = cornerValue[inside];
    const to = cornerValue[outside];
    const t = from / (from - to);
    const id = positions.length / 3;

    positions.push(
      cornerX[inside] + (cornerX[outside] - cornerX[inside]) * t,
      cornerY[inside] + (cornerY[outside] - cornerY[inside]) * t,
      cornerZ[inside] + (cornerZ[outside] - cornerZ[inside]) * t,
    );
    shared.set(key, id);

    return id;
  };

  /** Треугольник с нормалью, направленной от центра внутренности наружу. */
  const emitTriangle = (a: number, b: number, c: number): void => {
    const ax = positions[a * 3];
    const ay = positions[a * 3 + 1];
    const az = positions[a * 3 + 2];
    const bx = positions[b * 3];
    const by = positions[b * 3 + 1];
    const bz = positions[b * 3 + 2];
    const cx = positions[c * 3];
    const cy = positions[c * 3 + 1];
    const cz = positions[c * 3 + 2];
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const normalX = uy * vz - uz * vy;
    const normalY = uz * vx - ux * vz;
    const normalZ = ux * vy - uy * vx;
    // Вырожденные треугольники не отбрасываются: даже нулевая площадь держит
    // ребро замкнутым. Выброшенный треугольник оставил бы в поверхности дырку.
    const facing =
      normalX * ((ax + bx + cx) / 3 - insideCenter[0]) +
      normalY * ((ay + by + cy) / 3 - insideCenter[1]) +
      normalZ * ((az + bz + cz) / 3 - insideCenter[2]);

    if (facing < 0) {
      indices.push(a, c, b);
    } else {
      indices.push(a, b, c);
    }
  };

  /** Достраивает многоугольник среза тетраэдра (3 или 4 вершины) до треугольников. */
  const emitPolygon = (count: number): void => {
    if (count === 3) {
      emitTriangle(polygon[0], polygon[1], polygon[2]);
      return;
    }

    emitTriangle(polygon[0], polygon[1], polygon[2]);
    emitTriangle(polygon[0], polygon[2], polygon[3]);
  };

  /** Обрабатывает один тетраэдр: классифицирует вершины и строит срез. */
  const emitTet = (a: number, b: number, c: number, d: number): void => {
    tet[0] = a;
    tet[1] = b;
    tet[2] = c;
    tet[3] = d;

    let insideCount = 0;
    let outsideCount = 0;
    insideCenter[0] = 0;
    insideCenter[1] = 0;
    insideCenter[2] = 0;

    for (let n = 0; n < 4; n += 1) {
      const corner = tet[n];

      if (cornerValue[corner] > 0) {
        insideList[insideCount] = corner;
        insideCount += 1;
        insideCenter[0] += cornerX[corner];
        insideCenter[1] += cornerY[corner];
        insideCenter[2] += cornerZ[corner];
      } else {
        outsideList[outsideCount] = corner;
        outsideCount += 1;
      }
    }

    if (insideCount === 0 || outsideCount === 0) {
      return;
    }

    insideCenter[0] /= insideCount;
    insideCenter[1] /= insideCount;
    insideCenter[2] /= insideCount;

    if (insideCount === 1) {
      const inside = insideList[0];

      polygon[0] = vertexOnEdge(inside, outsideList[0]);
      polygon[1] = vertexOnEdge(inside, outsideList[1]);
      polygon[2] = vertexOnEdge(inside, outsideList[2]);
      emitPolygon(3);
      return;
    }

    if (insideCount === 3) {
      const outside = outsideList[0];

      polygon[0] = vertexOnEdge(insideList[0], outside);
      polygon[1] = vertexOnEdge(insideList[1], outside);
      polygon[2] = vertexOnEdge(insideList[2], outside);
      emitPolygon(3);
      return;
    }

    // Две вершины внутри, две снаружи: срез — четырёхугольник.
    polygon[0] = vertexOnEdge(insideList[0], outsideList[0]);
    polygon[1] = vertexOnEdge(insideList[0], outsideList[1]);
    polygon[2] = vertexOnEdge(insideList[1], outsideList[1]);
    polygon[3] = vertexOnEdge(insideList[1], outsideList[0]);
    emitPolygon(4);
  };

  for (let k = 0; k < nz - 1; k += 1) {
    for (let j = 0; j < ny - 1; j += 1) {
      const rowBase = (k * ny + j) * nx;

      for (let i = 0; i < nx - 1; i += 1) {
        const base = rowBase + i;
        cornerIndex[0] = base;
        cornerIndex[1] = base + 1;
        cornerIndex[2] = base + nx;
        cornerIndex[3] = base + nx + 1;
        cornerIndex[4] = base + nxy;
        cornerIndex[5] = base + nxy + 1;
        cornerIndex[6] = base + nxy + nx;
        cornerIndex[7] = base + nxy + nx + 1;

        let lowest = Infinity;
        let highest = -Infinity;

        for (let n = 0; n < 8; n += 1) {
          const value = values[cornerIndex[n]];
          cornerValue[n] = value;

          if (value < lowest) {
            lowest = value;
          }

          if (value > highest) {
            highest = value;
          }
        }

        // Узел со значением ровно 0 считается снаружи: ячейка активна, только
        // если внутри есть строго положительный и неположительный узлы.
        if (highest <= 0 || lowest > 0) {
          continue;
        }

        for (let n = 0; n < 8; n += 1) {
          cornerX[n] = origin[0] + (i + (n & 1)) * cell;
          cornerY[n] = origin[1] + (j + ((n >> 1) & 1)) * cell;
          cornerZ[n] = origin[2] + (k + ((n >> 2) & 1)) * cell;
        }

        for (let t = 0; t < CUBE_TETS.length; t += 1) {
          const tetCorners = CUBE_TETS[t];
          emitTet(tetCorners[0], tetCorners[1], tetCorners[2], tetCorners[3]);
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

/**
 * Заливает снаружи всё, до чего можно добраться от границы сетки.
 *
 * Идём только по точкам вне полосы (`near >= band`): полоса — это стенка,
 * поэтому заливка не просачивается внутрь модели. Точки, до которых не
 * добрались, лежат внутри и получают −1.
 */
function floodOutside(field: Omit<Raster, "origin" | "cell">): void {
  const { nx, ny, nz, band, near, side } = field;
  const nxy = nx * ny;
  const queue = new Int32Array(nxy * nz);
  let head = 0;
  let tail = 0;

  // Порог сравнивается в точности float32: `band` — double (0.55 × 1.6 =
  // 0.8800000000000001), а в Float32Array он лежит как 0.8799999952316284.
  // Прямое `near[index] >= band` всегда ложно, и заливка не началась бы вовсе.
  const limit = Math.fround(band);

  const push = (index: number): void => {
    if (side[index] === 0 && near[index] >= limit) {
      side[index] = 1;
      queue[tail] = index;
      tail += 1;
    }
  };

  for (let k = 0; k < nz; k += 1) {
    const borderLayer = k === 0 || k === nz - 1;

    for (let j = 0; j < ny; j += 1) {
      if (borderLayer || j === 0 || j === ny - 1) {
        for (let i = 0; i < nx; i += 1) {
          push((k * ny + j) * nx + i);
        }
      } else {
        push((k * ny + j) * nx);
        push((k * ny + j) * nx + nx - 1);
      }
    }
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const k = Math.floor(index / nxy);
    const rest = index - k * nxy;
    const j = Math.floor(rest / nx);
    const i = rest - j * nx;

    if (i > 0) {
      push(index - 1);
    }

    if (i < nx - 1) {
      push(index + 1);
    }

    if (j > 0) {
      push(index - nx);
    }

    if (j < ny - 1) {
      push(index + nx);
    }

    if (k > 0) {
      push(index - nxy);
    }

    if (k < nz - 1) {
      push(index + nxy);
    }
  }

  for (let index = 0; index < side.length; index += 1) {
    if (side[index] === 0) {
      side[index] = -1;
    }
  }
}


function pickCell(bounds: Bounds): number {
  let cell = PRINT_CELL_MM;

  for (;;) {
    const nx = Math.ceil((bounds.max[0] - bounds.min[0]) / cell) + 5;
    const ny = Math.ceil((bounds.max[1] - bounds.min[1]) / cell) + 5;
    const nz = Math.ceil((bounds.max[2] - bounds.min[2]) / cell) + 5;

    if (nx * ny * nz <= MAX_GRID_POINTS) {
      return cell;
    }

    cell *= 1.25;
  }
}


/**
 * Сглаживание Таубина: λ-шаг гасит высокие частоты, μ-шаг возвращает объём.
 *
 * Обычный лапласиан «сдувает» модель: после десяти итераций кот теряет
 * миллиметры объёма. Пара λ = 0.5, μ = −0.53 объём почти сохраняет.
 *
 * Вершины базы закреплены, иначе плоское пятно контакта превратилось бы в
 * линзу и модель снова встала бы на одну точку. Захватывается слой в одну
 * ячейку: без него соседи плоскости проседают и у основания вырастает валик,
 * который потом печатается утолщением первого слоя.
 */
function taubin(mesh: PrintMesh, cutZ: number, cell: number): PrintMesh {
  const { positions, indices } = mesh;
  const count = Math.floor(positions.length / 3);

  if (count === 0 || indices.length === 0) {
    return mesh;
  }

  // Соседство в формате CSR: сначала степени вершин, затем плоский список.
  // У вершины два соседа на треугольник, поэтому каждая позиция в `indices`
  // даёт два места в списке — иначе буфер переполнится и связность порвётся.
  const start = new Uint32Array(count + 1);

  for (let t = 0; t < indices.length; t += 1) {
    start[indices[t] + 1] += 2;
  }

  for (let v = 0; v < count; v += 1) {
    start[v + 1] += start[v];
  }

  const neighbors = new Uint32Array(indices.length * 2);
  const cursor = start.slice(0, count);

  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t];
    const b = indices[t + 1];
    const c = indices[t + 2];

    neighbors[cursor[a]] = b;
    cursor[a] += 1;
    neighbors[cursor[a]] = c;
    cursor[a] += 1;
    neighbors[cursor[b]] = c;
    cursor[b] += 1;
    neighbors[cursor[b]] = a;
    cursor[b] += 1;
    neighbors[cursor[c]] = a;
    cursor[c] += 1;
    neighbors[cursor[c]] = b;
    cursor[c] += 1;
  }

  const locked = new Uint8Array(count);
  const lockZ = cutZ + cell;

  for (let v = 0; v < count; v += 1) {
    if (positions[v * 3 + 2] <= lockZ) {
      locked[v] = 1;
    }
  }

  let source = Float32Array.from(positions);
  let target = new Float32Array(positions.length);
  const factors = [SMOOTH_LAMBDA, SMOOTH_MU];

  for (let pass = 0; pass < SMOOTH_PASSES; pass += 1) {
    for (let f = 0; f < factors.length; f += 1) {
      const factor = factors[f];

      for (let v = 0; v < count; v += 1) {
        const base = v * 3;
        const from = start[v];
        const to = start[v + 1];

        if (locked[v] === 1 || to === from) {
          target[base] = source[base];
          target[base + 1] = source[base + 1];
          target[base + 2] = source[base + 2];
          continue;
        }

        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;

        for (let n = from; n < to; n += 1) {
          const around = neighbors[n] * 3;
          sumX += source[around];
          sumY += source[around + 1];
          sumZ += source[around + 2];
        }

        const weight = 1 / (to - from);
        target[base] = source[base] + factor * (sumX * weight - source[base]);
        target[base + 1] =
          source[base + 1] + factor * (sumY * weight - source[base + 1]);
        target[base + 2] =
          source[base + 2] + factor * (sumZ * weight - source[base + 2]);
      }

      const swap = source;
      source = target;
      target = swap;
    }
  }

  // Соседние с базой вершины могли просесть ниже стола — поднимаем их обратно,
  // иначе самая низкая точка съедет с базы и модель встанет на одну точку.
  for (let v = 0; v < count; v += 1) {
    if (source[v * 3 + 2] < cutZ) {
      source[v * 3 + 2] = cutZ;
    }
  }

  return { positions: source, indices };
}


/**
 * Отбрасывает мелкие оболочки — «крошки» генерации.
 *
 * Порог двойной: по объёму и по высоте. Тонкий блинчик в сантиметр площадью
 * весит больше 20 мм³, но в первом слое это мусорная линия, а не деталь.
 *
 * Самая большая оболочка остаётся всегда: даже если модель целиком меньше
 * порога, печатать что-то надо.
 */
function dropSmallParts(mesh: PrintMesh): { mesh: PrintMesh; dropped: number } {
  const { positions, indices } = mesh;
  const count = Math.floor(positions.length / 3);
  const parent = new Int32Array(count);

  for (let v = 0; v < count; v += 1) {
    parent[v] = v;
  }

  const find = (vertex: number): number => {
    let root = vertex;

    while (parent[root] !== root) {
      root = parent[root];
    }

    let walk = vertex;

    while (parent[walk] !== root) {
      const next = parent[walk];
      parent[walk] = root;
      walk = next;
    }

    return root;
  };

  for (let t = 0; t < indices.length; t += 3) {
    const a = find(indices[t]);
    const b = find(indices[t + 1]);

    if (a !== b) {
      parent[a] = b;
    }

    const root = find(indices[t]);
    const tail = find(indices[t + 2]);

    if (tail !== root) {
      parent[tail] = root;
    }
  }

  const volume = new Float64Array(count);
  const triangles = new Uint32Array(count);

  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const root = find(indices[t]);

    volume[root] +=
      (positions[a] *
        (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) -
        positions[a + 1] *
          (positions[b] * positions[c + 2] - positions[b + 2] * positions[c]) +
        positions[a + 2] *
          (positions[b] * positions[c + 1] - positions[b + 1] * positions[c])) /
      6;
    triangles[root] += 1;
  }

  // Высота оболочки: плоский «блинчик» проходит по объёму, но не по высоте.
  const minZ = new Float32Array(count).fill(Number.POSITIVE_INFINITY);
  const maxZ = new Float32Array(count).fill(Number.NEGATIVE_INFINITY);

  for (let t = 0; t < indices.length; t += 3) {
    const root = find(indices[t]);

    for (let n = 0; n < 3; n += 1) {
      const z = positions[indices[t + n] * 3 + 2];

      if (z < minZ[root]) {
        minZ[root] = z;
      }

      if (z > maxZ[root]) {
        maxZ[root] = z;
      }
    }
  }

  let biggestRoot = -1;
  let biggestVolume = 0;

  for (let root = 0; root < count; root += 1) {
    if (triangles[root] === 0) {
      continue;
    }

    const size = Math.abs(volume[root]);

    if (size > biggestVolume) {
      biggestVolume = size;
      biggestRoot = root;
    }
  }

  const keep = new Uint8Array(count);
  let dropped = 0;

  for (let root = 0; root < count; root += 1) {
    if (triangles[root] === 0) {
      continue;
    }

    const height = maxZ[root] - minZ[root];
    const flat = height < MIN_PART_HEIGHT_MM;
    const solid = !flat && Math.abs(volume[root]) >= MIN_PART_MM3;

    if (root === biggestRoot || solid) {
      keep[root] = 1;
    } else {
      dropped += 1;
    }
  }

  if (dropped === 0) {
    return { mesh, dropped: 0 };
  }

  const remap = new Int32Array(count).fill(-1);
  const keptPositions: number[] = [];

  for (let t = 0; t < indices.length; t += 3) {
    if (keep[find(indices[t])] === 0) {
      continue;
    }

    for (let n = 0; n < 3; n += 1) {
      const vertex = indices[t + n];

      if (remap[vertex] < 0) {
        remap[vertex] = keptPositions.length / 3;
        keptPositions.push(
          positions[vertex * 3],
          positions[vertex * 3 + 1],
          positions[vertex * 3 + 2],
        );
      }
    }
  }

  const keptIndices: number[] = [];

  for (let t = 0; t < indices.length; t += 3) {
    if (keep[find(indices[t])] === 0) {
      continue;
    }

    keptIndices.push(
      remap[indices[t]],
      remap[indices[t + 1]],
      remap[indices[t + 2]],
    );
  }

  return {
    mesh: {
      positions: new Float32Array(keptPositions),
      indices: new Uint32Array(keptIndices),
    },
    dropped,
  };
}


/** Ставит модель на стол: центр XY в нуле, низ на Z = 0. */
function sitOnBed(mesh: PrintMesh): PrintMesh {
  const { positions, indices } = mesh;
  const bounds = measureBounds(positions);
  const offsetX = -(bounds.min[0] + bounds.max[0]) / 2;
  const offsetY = -(bounds.min[1] + bounds.max[1]) / 2;
  const offsetZ = -bounds.min[2];
  const placed = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    // Z прижимаем к нулю: float32 после сдвига может дать −1e-7, и слайсер
    // увидит модель, «утонувшую» на сотую микрометра.
    const z = positions[i + 2] + offsetZ;

    placed[i] = positions[i] + offsetX;
    placed[i + 1] = positions[i + 1] + offsetY;
    placed[i + 2] = z > 0 ? z : 0;
  }

  return { positions: placed, indices };
}

/** Объём замкнутой сетки по формуле суммы тетраэдров, мм³. */
function measureVolume(mesh: PrintMesh): number {
  const { positions, indices } = mesh;
  let total = 0;

  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;

    total +=
      (positions[a] *
        (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) -
        positions[a + 1] *
          (positions[b] * positions[c + 2] - positions[b + 2] * positions[c]) +
        positions[a + 2] *
          (positions[b] * positions[c + 1] - positions[b + 1] * positions[c])) /
      6;
  }

  return Math.abs(total);
}

/** Площадь пятна контакта со столом: треугольники, лежащие в плоскости Z низа. */
function measureBase(mesh: PrintMesh): number {
  const { positions, indices } = mesh;
  let planeZ = Infinity;

  for (let i = 2; i < positions.length; i += 3) {
    if (positions[i] < planeZ) {
      planeZ = positions[i];
    }
  }

  let area = 0;

  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const limit = planeZ + BASE_EPSILON_MM;

    if (
      positions[a + 2] > limit ||
      positions[b + 2] > limit ||
      positions[c + 2] > limit
    ) {
      continue;
    }

    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];

    area +=
      0.5 *
      Math.hypot(
        uy * vz - uz * vy,
        uz * vx - ux * vz,
        ux * vy - uy * vx,
      );
  }

  return area;
}
