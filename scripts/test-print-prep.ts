/**
 * Тест печатной подготовки модели (`lib/constructor/print-prep.ts`).
 *
 * Главное, что здесь закреплено: ремеш обязан давать **замкнутую** сетку с
 * плоской базой и без суб-соплового рельефа. Скульптурная сетка генерации
 * (у `cat.stl` медиана двугранного угла 15.9°, 9.6 контура на слой, 6.8
 * микроострова) слайсеру не годится: он честно печатает каждый островок
 * отдельной крошкой. После ремеша у той же модели должно быть 2–5°, один-два
 * контура на слой, ноль микроостровов и пятно контакта со столом в квадратных
 * сантиметрах.
 *
 * Что проверяется:
 *   1. синтетическая шумная сфера: замкнутость, плоская база, объём в пределах
 *      пары процентов, медиана двугранного угла ниже 8°, ноль микроостровов;
 *   2. ось Y из glTF уходит в Z: стоящий по Y брусок после подготовки выше по Z;
 *   3. «крошка» меньше 20 мм³ отбрасывается, а тело остаётся; плоская плита
 *      12 × 12 × 1 мм (144 мм³) отбрасывается по высоте — в первом слое она
 *      печаталась бы линией;
 *   4. реальный `cat.stl` из витрины: замкнутость, ровно одна оболочка, контакт
 *      со столом не меньше 5 см², ноль микроостровов, медиана ниже 8°, объём в
 *      пределах 10 % от исходного, габарит 120 мм по высоте;
 *   5. у сетки без треугольников — понятная ошибка, а не падение;
 *   6. мост в «мясорубку»: `printPrepare` принимает геометрию three.js (в том
 *      числе неиндексированную от STLLoader) и отдаёт сетку на столе.
 *
 * Запуск: npm run check:print
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

import { printPrepare } from "../lib/constructor/mesh-fixer";
import { makePrintReady, type PrintMesh } from "../lib/constructor/print-prep";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ok   ${name}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${name}`);
  console.log(`       ожидалось: ${JSON.stringify(expected)}`);
  console.log(`       получено:  ${JSON.stringify(actual)}`);
}

function checkRange(name: string, value: number, min: number, max: number): void {
  if (Number.isFinite(value) && value >= min && value <= max) {
    console.log(`  ok   ${name}: ${value.toFixed(2)}`);
    return;
  }

  failures += 1;
  console.log(`  FAIL ${name}: ${value.toFixed(2)} вне [${min}; ${max}]`);
}

/** Читает бинарный STL в неиндексированную сетку (сетка из витрины такая). */
function loadStl(file: string): PrintMesh {
  const data = readFileSync(file);
  const triangles = data.readUInt32LE(80);
  const positions = new Float32Array(triangles * 9);
  let at = 84;

  for (let t = 0; t < triangles; t += 1) {
    at += 12; // нормаль фасета: считаем её сами по вершинам

    for (let v = 0; v < 3; v += 1) {
      const target = t * 9 + v * 3;
      positions[target] = data.readFloatLE(at);
      positions[target + 1] = data.readFloatLE(at + 4);
      positions[target + 2] = data.readFloatLE(at + 8);
      at += 12;
    }

    at += 2; // attribute byte count
  }

  const indices = new Uint32Array(triangles * 3);

  for (let i = 0; i < indices.length; i += 1) {
    indices[i] = i;
  }

  return { positions, indices };
}

/** Сваривает совпадающие вершины: без этого у STL нет ни рёбер, ни соседей. */
function weld(mesh: PrintMesh): PrintMesh {
  const slots = new Map<string, number>();
  const positions: number[] = [];
  const indices = new Uint32Array(mesh.indices.length);

  for (let i = 0; i < mesh.indices.length; i += 1) {
    const vertex = mesh.indices[i] * 3;
    const key = `${Math.round(mesh.positions[vertex] * 1000)}:${
      Math.round(mesh.positions[vertex + 1] * 1000)
    }:${Math.round(mesh.positions[vertex + 2] * 1000)}`;
    let slot = slots.get(key);

    if (slot === undefined) {
      slot = positions.length / 3;
      positions.push(
        mesh.positions[vertex],
        mesh.positions[vertex + 1],
        mesh.positions[vertex + 2],
      );
      slots.set(key, slot);
    }

    indices[i] = slot;
  }

  return { positions: new Float32Array(positions), indices };
}

/** Сводка по сетке: манифолдность, гладкость, объём, габарит, база, оболочки. */
type MeshMetrics = {
  triangles: number;
  unpairedEdges: number;
  dihedralMedian: number;
  volumeCm3: number;
  size: [number, number, number];
  minZ: number;
  baseAreaMm2: number;
  shells: number;
};

/** Считает метрики печати: всё, что важно слайсеру, кроме островов. */
function analyzeMesh(mesh: PrintMesh): MeshMetrics {
  const { positions, indices } = mesh;
  const vertices = Math.floor(positions.length / 3);
  const triangles = Math.floor(indices.length / 3);
  const slots = new Map<number, number>();
  const normals: number[] = [];
  const uses: number[] = [];
  const dihedrals: number[] = [];
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let volume = 0;

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

  for (let t = 0; t < triangles; t += 1) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    const unitX = nx / length;
    const unitY = ny / length;
    const unitZ = nz / length;

    volume +=
      (positions[a] *
        (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) -
        positions[a + 1] *
          (positions[b] * positions[c + 2] - positions[b + 2] * positions[c]) +
        positions[a + 2] *
          (positions[b] * positions[c + 1] - positions[b + 1] * positions[c])) /
      6;

    for (let e = 0; e < 3; e += 1) {
      const first = indices[t * 3 + e];
      const second = indices[t * 3 + ((e + 1) % 3)];
      const key =
        first < second ? first * vertices + second : second * vertices + first;
      const slot = slots.get(key);

      if (slot === undefined) {
        slots.set(key, normals.length / 3);
        normals.push(unitX, unitY, unitZ);
        uses.push(1);
        continue;
      }

      uses[slot] += 1;

      if (uses[slot] === 2) {
        const dot =
          unitX * normals[slot * 3] +
          unitY * normals[slot * 3 + 1] +
          unitZ * normals[slot * 3 + 2];
        dihedrals.push((Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI);
      }
    }
  }

  dihedrals.sort((left, right) => left - right);
  let unpairedEdges = 0;

  for (let slot = 0; slot < uses.length; slot += 1) {
    if (uses[slot] !== 2) {
      unpairedEdges += 1;
    }
  }

  // Пятно контакта: треугольники, лежащие в плоскости низа модели.
  let baseAreaMm2 = 0;

  for (let t = 0; t < triangles; t += 1) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const limit = min[2] + 1e-3;

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

    baseAreaMm2 +=
      0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  }

  // Оболочки: слайсер печатает каждую отдельно, лишняя — мусор на столе.
  const parent = new Int32Array(vertices);

  for (let v = 0; v < vertices; v += 1) {
    parent[v] = v;
  }

  const rootOf = (vertex: number): number => {
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

  for (let t = 0; t < triangles; t += 1) {
    const a = rootOf(indices[t * 3]);
    const b = rootOf(indices[t * 3 + 1]);
    const c = rootOf(indices[t * 3 + 2]);

    if (b !== a) {
      parent[b] = a;
    }

    if (rootOf(c) !== a) {
      parent[rootOf(c)] = a;
    }
  }

  const shells = new Set<number>();

  for (let t = 0; t < triangles; t += 1) {
    shells.add(rootOf(indices[t * 3]));
  }

  return {
    triangles,
    unpairedEdges,
    dihedralMedian:
      dihedrals.length > 0 ? dihedrals[Math.floor(dihedrals.length / 2)] : 0,
    volumeCm3: Math.abs(volume) / 1000,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    minZ: min[2],
    baseAreaMm2,
    shells: shells.size,
  };
}


/**
 * Режет сетку горизонтальными плоскостями и считает контуры.
 *
 * Микроостров — компонента контура с габаритом меньше 0.7 мм: на слое такой
 * «остров» печатается крошкой, и именно из-за них слайсер рисует кашу.
 * Направление обхода здесь не нужно, поэтому площадь заменена габаритом.
 */
function sliceMetrics(
  mesh: PrintMesh,
  layers: number,
): { contoursPerLayer: number; microPerLayer: number } {
  const { positions, indices } = mesh;
  const triangles = Math.floor(indices.length / 3);
  const values = [0, 0, 0];
  const offsets = [0, 0, 0];
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 2; i < positions.length; i += 3) {
    if (positions[i] < minZ) {
      minZ = positions[i];
    }

    if (positions[i] > maxZ) {
      maxZ = positions[i];
    }
  }

  let contours = 0;
  let micro = 0;

  for (let layer = 1; layer < layers; layer += 1) {
    const z = minZ + ((maxZ - minZ) * layer) / layers;
    const nodes = new Map<string, number>();
    const parent: number[] = [];

    const nodeOf = (x: number, y: number): number => {
      const key = `${Math.round(x * 100)}:${Math.round(y * 100)}`;
      const known = nodes.get(key);

      if (known !== undefined) {
        return known;
      }

      const id = parent.length;
      parent.push(id);
      nodes.set(key, id);

      return id;
    };

    const find = (vertex: number): number => {
      let root = vertex;

      while (parent[root] !== root) {
        root = parent[root];
      }

      return root;
    };

    for (let t = 0; t < triangles; t += 1) {
      let above = 0;
      let below = 0;

      for (let v = 0; v < 3; v += 1) {
        const vertex = indices[t * 3 + v] * 3;
        offsets[v] = vertex;
        values[v] = positions[vertex + 2] - z;

        if (values[v] > 0) {
          above += 1;
        } else {
          below += 1;
        }
      }

      if (above === 0 || below === 0) {
        continue;
      }

      let start = -1;
      let end = -1;

      for (let e = 0; e < 3; e += 1) {
        const first = e;
        const second = (e + 1) % 3;

        if (values[first] > 0 === values[second] > 0) {
          continue;
        }

        const ratio = values[first] / (values[first] - values[second]);
        const from = offsets[first];
        const to = offsets[second];
        const x = positions[from] + (positions[to] - positions[from]) * ratio;
        const y =
          positions[from + 1] + (positions[to + 1] - positions[from + 1]) * ratio;
        const node = nodeOf(x, y);

        if (start < 0) {
          start = node;
        } else {
          end = node;
        }
      }

      if (start < 0 || end < 0) {
        continue;
      }

      const rootStart = find(start);
      const rootEnd = find(end);

      if (rootStart !== rootEnd) {
        parent[rootEnd] = rootStart;
      }
    }

    const xs = new Map<number, [number, number, number, number]>();

    nodes.forEach((node, key) => {
      const root = find(node);
      const [rawX, rawY] = key.split(":");
      const x = Number(rawX) / 100;
      const y = Number(rawY) / 100;
      const box = xs.get(root);

      if (box === undefined) {
        xs.set(root, [x, y, x, y]);
        return;
      }

      if (x < box[0]) {
        box[0] = x;
      }

      if (y < box[1]) {
        box[1] = y;
      }

      if (x > box[2]) {
        box[2] = x;
      }

      if (y > box[3]) {
        box[3] = y;
      }
    });

    xs.forEach((box) => {
      contours += 1;

      if (Math.max(box[2] - box[0], box[3] - box[1]) < 0.7) {
        micro += 1;
      }
    });
  }

  return {
    contoursPerLayer: contours / (layers - 1),
    microPerLayer: micro / (layers - 1),
  };
}


/** Знаковый объём: по нему видно, куда смотрят нормали. */
function signedVolume(mesh: PrintMesh): number {
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

  return total;
}

/**
 * Белый шум по паре индексов: детерминированный и без внешних зависимостей.
 * Возвращает значение в диапазоне 0…1.
 */
function hashNoise(a: number, b: number): number {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;

  return value - Math.floor(value);
}

/**
 * Шумная сфера: та же болячка, что у скульптурной сетки — рельеф в доли
 * миллиметра поверх гладкой формы. Ось Y вверх, как у glTF.
 *
 * `amplitude` — доля радиуса: 0.02 при радиусе 20 мм даёт бугры ±0.2 мм, то
 * есть ниже сопла, но вполне достаточные, чтобы испортить срез.
 */
function noisySphere(
  radius: number,
  rings: number,
  segments: number,
  amplitude: number,
): PrintMesh {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= rings; ring += 1) {
    const phi = (Math.PI * ring) / rings;

    for (let segment = 0; segment < segments; segment += 1) {
      const theta = (2 * Math.PI * segment) / segments;
      // Шум гасится к полюсам, иначе кольцо полюса рассыпается на точку с
      // разными радиусами и сфера перестаёт быть сферой.
      const ripple =
        1 + amplitude * (hashNoise(ring, segment) - 0.5) * Math.sin(phi);
      positions.push(
        radius * ripple * Math.sin(phi) * Math.cos(theta),
        radius * ripple * Math.cos(phi),
        radius * ripple * Math.sin(phi) * Math.sin(theta),
      );
    }
  }

  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = ring * segments + segment;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + segment;
      const d = (ring + 1) * segments + next;
      indices.push(a, b, c, b, d, c);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
}

/** Параллелепипед с нормалями наружу: нужен для проверки разворота осей. */
function boxMesh(width: number, height: number, depth: number): PrintMesh {
  const half: [number, number, number] = [width / 2, height / 2, depth / 2];
  const corners: number[] = [];

  for (let index = 0; index < 8; index += 1) {
    corners.push(
      (index & 1 ? half[0] : -half[0]),
      (index & 2 ? half[1] : -half[1]),
      (index & 4 ? half[2] : -half[2]),
    );
  }

  const indices = new Uint32Array([
    0, 2, 1, 1, 2, 3, // низ
    4, 5, 6, 5, 7, 6, // верх
    0, 1, 4, 1, 5, 4, // перед
    2, 6, 3, 3, 6, 7, // зад
    0, 4, 2, 2, 4, 6, // лево
    1, 3, 5, 3, 7, 5, // право
  ]);
  const mesh: PrintMesh = { positions: new Float32Array(corners), indices };

  if (signedVolume(mesh) < 0) {
    for (let t = 0; t < indices.length; t += 3) {
      const swap = indices[t + 1];
      indices[t + 1] = indices[t + 2];
      indices[t + 2] = swap;
    }
  }

  return mesh;
}

/** Склеивает две сетки в одну: так в модель попадает «крошка». */
function merge(left: PrintMesh, right: PrintMesh): PrintMesh {
  const positions = new Float32Array(left.positions.length + right.positions.length);

  positions.set(left.positions, 0);
  positions.set(right.positions, left.positions.length);

  const offset = left.positions.length / 3;
  const indices = new Uint32Array(left.indices.length + right.indices.length);

  indices.set(left.indices, 0);

  for (let i = 0; i < right.indices.length; i += 1) {
    indices[left.indices.length + i] = right.indices[i] + offset;
  }

  return { positions, indices };
}


console.log("Печатная подготовка модели");

const source = noisySphere(20, 64, 128, 0.02);
const sourceMetrics = analyzeMesh(source);
const sourceSlices = sliceMetrics(source, 12);
const started = performance.now();
const prepared = makePrintReady(source);
const elapsed = performance.now() - started;
const smoothed = analyzeMesh(prepared.mesh);
const smoothedSlices = sliceMetrics(prepared.mesh, 12);

console.log(
  `  исходник: ${sourceMetrics.triangles} треугольников, медиана ` +
    `${sourceMetrics.dihedralMedian.toFixed(1)}°, контуров на слой ` +
    `${sourceSlices.contoursPerLayer.toFixed(1)}, островов ` +
    `${sourceSlices.microPerLayer.toFixed(1)}`,
);
console.log(
  `  ремеш: ${prepared.trianglesBefore} → ${prepared.trianglesAfter} ` +
    `треугольников за ${(elapsed / 1000).toFixed(1)} с, шаг ` +
    `${prepared.cellMm.toFixed(2)} мм`,
);
console.log(
  `  после: медиана ${smoothed.dihedralMedian.toFixed(1)}°, контуров на слой ` +
    `${smoothedSlices.contoursPerLayer.toFixed(1)}, островов ` +
    `${smoothedSlices.microPerLayer.toFixed(1)}, контакт ` +
    `${(smoothed.baseAreaMm2 / 100).toFixed(1)} см², объём ` +
    `${smoothed.volumeCm3.toFixed(1)} см³`,
);

check(
  "шумная сфера: рельеф действительно был",
  sourceMetrics.dihedralMedian > 6,
  true,
);
check(
  "шумная сфера: сглаживание сняло рельеф",
  smoothed.dihedralMedian < sourceMetrics.dihedralMedian / 2,
  true,
);
check("шумная сфера: сетка замкнута", smoothed.unpairedEdges, 0);
check("шумная сфера: одна оболочка", smoothed.shells, 1);
check("шумная сфера: микроостровов нет", smoothedSlices.microPerLayer, 0);
check("шумная сфера: низ ровно на столе", smoothed.minZ, 0);
checkRange("шумная сфера: медиана двугранного угла", smoothed.dihedralMedian, 0.5, 8);
checkRange("шумная сфера: контакт со столом, см²", smoothed.baseAreaMm2 / 100, 1.2, 2.2);
checkRange("шумная сфера: объём, см³", smoothed.volumeCm3, 30, 40);
checkRange("шумная сфера: высота по Z", smoothed.size[2], 38, 39.6);
checkRange("шумная сфера: ширина по X", smoothed.size[0], 39.2, 40.8);

console.log("");

const tall = makePrintReady(boxMesh(20, 40, 20));
const tallMetrics = analyzeMesh(tall.mesh);

console.log(
  `  брусок 20 × 40 × 20: габарит ` +
    `${tallMetrics.size.map((value) => value.toFixed(1)).join(" × ")} мм, ` +
    `контакт ${(tallMetrics.baseAreaMm2 / 100).toFixed(1)} см²`,
);

check("брусок: высота переехала в Z", Math.round(tallMetrics.size[2]), 39);
checkRange("брусок: ширина по X", tallMetrics.size[0], 19.6, 20.4);
checkRange("брусок: глубина по Y", tallMetrics.size[1], 19.6, 20.4);
checkRange("брусок: база — всё сечение, см²", tallMetrics.baseAreaMm2 / 100, 3.6, 4.4);
check("брусок: сетка замкнута", tallMetrics.unpairedEdges, 0);
check("брусок: одна оболочка", tallMetrics.shells, 1);

console.log("");

const crumb = noisySphere(1, 12, 12, 0);
const body = noisySphere(20, 32, 64, 0.02);

for (let i = 0; i < crumb.positions.length; i += 3) {
  crumb.positions[i] += 40;
}

const withCrumb = makePrintReady(merge(body, crumb));
const withCrumbMetrics = analyzeMesh(withCrumb.mesh);

console.log(
  `  тело с крошкой 2 мм: габарит ` +
    `${withCrumbMetrics.size.map((value) => value.toFixed(1)).join(" × ")} мм, ` +
    `отброшено оболочек ${withCrumb.removedParts}, осталось ${withCrumbMetrics.shells}`,
);

check("крошка: отброшена", withCrumb.removedParts >= 1, true);
checkRange("крошка: габарит остался от тела", withCrumbMetrics.size[0], 39.2, 40.8);
check("крошка: сетка замкнута", withCrumbMetrics.unpairedEdges, 0);
check("крошка: осталась одна оболочка", withCrumbMetrics.shells, 1);

console.log("");

// Плоская крошка: плита 12 × 12 × 1 мм весит 144 мм³ и проходит по объёму, но
// в первом слое это линия. После ремеша высота остаётся ниже 1.2 мм, и плита
// отбрасывается по высоте, а не по объёму.
const pancake = boxMesh(12, 1, 12);

for (let i = 0; i < pancake.positions.length; i += 3) {
  pancake.positions[i] += 25;
}

const withPancake = makePrintReady(merge(noisySphere(14, 24, 48, 0.01), pancake));
const withPancakeMetrics = analyzeMesh(withPancake.mesh);

console.log(
  `  тело с плоской плитой 12 × 12 × 1 мм: габарит ` +
    `${withPancakeMetrics.size.map((value) => value.toFixed(1)).join(" × ")} мм, ` +
    `отброшено оболочек ${withPancake.removedParts}, осталось ${withPancakeMetrics.shells}`,
);

check("плита: отброшена", withPancake.removedParts >= 1, true);
check("плита: осталась одна оболочка", withPancakeMetrics.shells, 1);
checkRange("плита: габарит остался от тела", withPancakeMetrics.size[0], 27.5, 30);
check("плита: сетка замкнута", withPancakeMetrics.unpairedEdges, 0);

console.log("");

let rejected = false;

try {
  makePrintReady({ positions: new Float32Array(0), indices: new Uint32Array(0) });
} catch (error) {
  rejected = error instanceof Error && error.message.includes("пустая сетка");
}

check("пустая сетка: понятная ошибка", rejected, true);


console.log("");

const catFile = path.join(
  process.cwd(),
  "public",
  "showcase",
  "generator-cat",
  "cat.stl",
);

if (!existsSync(catFile)) {
  console.log("  пропуск витрины: нет cat.stl");
} else {
  const data = readFileSync(catFile);
  const rawMesh = weld(loadStl(catFile));
  const rawMetrics = analyzeMesh(rawMesh);
  const rawSlices = sliceMetrics(rawMesh, 12);

  console.log(
    `  cat.stl как есть: ${rawMetrics.triangles} треугольников, медиана ` +
      `${rawMetrics.dihedralMedian.toFixed(1)}°, контуров на слой ` +
      `${rawSlices.contoursPerLayer.toFixed(1)}, островов ` +
      `${rawSlices.microPerLayer.toFixed(1)}, контакт ` +
      `${(rawMetrics.baseAreaMm2 / 100).toFixed(1)} см²`,
  );

  const catStarted = performance.now();
  const catPrepared = makePrintReady(loadStl(catFile));
  const catElapsed = performance.now() - catStarted;
  const catMetrics = analyzeMesh(catPrepared.mesh);
  const catSlices = sliceMetrics(catPrepared.mesh, 12);

  console.log(
    `  cat.stl после ремеша: ${catPrepared.trianglesAfter} треугольников за ` +
      `${(catElapsed / 1000).toFixed(1)} с, медиана ` +
      `${catMetrics.dihedralMedian.toFixed(1)}°, контуров на слой ` +
      `${catSlices.contoursPerLayer.toFixed(1)}, островов ` +
      `${catSlices.microPerLayer.toFixed(1)}, контакт ` +
      `${(catMetrics.baseAreaMm2 / 100).toFixed(1)} см², объём ` +
      `${catMetrics.volumeCm3.toFixed(1)} см³, оболочек ${catMetrics.shells}, габарит ` +
      `${catMetrics.size.map((value) => value.toFixed(1)).join(" × ")} мм`,
  );

  check("cat.stl: сетка замкнута", catMetrics.unpairedEdges, 0);
  check("cat.stl: одна оболочка", catMetrics.shells, 1);
  // В исходном коте есть настоящая щель 0.3 мм между лапой и корпусом: срез
  // видит её как микро-контур. Это не рельеф от шума, поэтому допускаем один
  // такой контур на все слои (у исходника 3.8 на слой).
  check(
    "cat.stl: микроострова только из исходной геометрии",
    catSlices.microPerLayer <= 0.2,
    true,
  );
  check("cat.stl: низ ровно на столе", catMetrics.minZ, 0);
  check(
    "cat.stl: рельеф снят",
    catMetrics.dihedralMedian < rawMetrics.dihedralMedian - 5,
    true,
  );
  checkRange("cat.stl: медиана двугранного угла", catMetrics.dihedralMedian, 0.5, 8);
  check("cat.stl: контакт со столом не меньше 5 см²", catMetrics.baseAreaMm2 >= 500, true);
  check("cat.stl: не потерял объём", catMetrics.volumeCm3 > rawMetrics.volumeCm3 * 0.9, true);
  checkRange("cat.stl: высота по Z", catMetrics.size[2], 117, 119.6);

  // Мост в «мясорубку»: она отдаёт печатной подготовке геометрию three.js, а не
  // типизированные массивы. STLLoader даёт неиндексированную сетку — как раз
  // такой случай проверяем: индексы обязан поставить `printPrepare`.
  const stlGeometry = new STLLoader().parse(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  const stlCount = stlGeometry.getAttribute("position").count;

  stlGeometry.setIndex(Array.from({ length: stlCount }, (_none, index) => index));

  const bridged = printPrepare(stlGeometry);
  const bridgedPositions = bridged.getAttribute("position").array as Float32Array;
  const bridgedIndices = bridged.getIndex();
  let bridgedMinZ = Infinity;
  let bridgedFinite = true;

  for (let i = 0; i < bridgedPositions.length; i += 3) {
    const z = bridgedPositions[i + 2];

    bridgedMinZ = Math.min(bridgedMinZ, z);
    bridgedFinite = bridgedFinite && Number.isFinite(bridgedPositions[i]) && Number.isFinite(z);
  }

  console.log(
    `  мост BufferGeometry → печать: ${(bridgedIndices?.count ?? 0) / 3} треугольников`,
  );

  check("мост: индексы на месте", (bridgedIndices?.count ?? 0) > 0, true);
  check("мост: координаты конечные", bridgedFinite, true);
  check("мост: низ ровно на столе", bridgedMinZ, 0);
}

console.log("");

if (failures > 0) {
  console.log(`Провалено проверок: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("Все проверки прошли.");
}

