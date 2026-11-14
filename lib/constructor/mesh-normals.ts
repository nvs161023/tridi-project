import { BufferGeometry, Float32BufferAttribute } from "three";

/**
 * Сглаженные нормали для сетки с рёбрами жёсткости.
 *
 * `computeVertexNormals()` считает нормаль по граням и раздаёт её своим же трём
 * вершинам. У неиндексированной сетки каждая вершина принадлежит ровно одной
 * грани, поэтому таким вызовом получается плоское затенение: лофт бюста из
 * пятидесяти срезов показывает ступени по 10–12°, а труба рога — двенадцатигранник.
 * Сварка вершин по координатам даёт гладкую нормаль, но заодно скругляет плиту
 * базы: её кромка 90° начинает светиться как фаска.
 *
 * Поэтому нормаль усредняется не по всем граням вершины, а только по тем, что
 * отстоят от данной меньше чем на `creaseDegrees`. Кромка плиты (90°) остаётся
 * острой, а свод головы и бока трубы (10–12° между гранями) становятся гладкими.
 * Усреднение идёт с весом площади: ненормированное векторное произведение уже
 * содержит длину, и мелкие треугольники не перетягивают нормаль на себя.
 *
 * Геометрия возвращается та же, если она неиндексированная: у всех деталей
 * конструктора оболочки собраны массивом позиций. Индексированную сетку функция
 * разворачивает в неиндексированную копию, потому что общая вершина на сгибе
 * должна получить две разные нормали.
 *
 * Деталь пересобирается на каждое движение ползунка, поэтому сварка сделана
 * хешем клетки с разрешением 0.1 мкм: строка из трёх координат на двести тысяч
 * вершин стоила дороже самого усреднения. Грани узла лежат подряд в общем массиве
 * (CSR): отдельный `number[]` на каждый узел — это сто тридцать тысяч массивов и
 * сборка мусора на ровном месте. Если все грани узла укладываются в порог сгиба,
 * нормаль у него одна и считается один раз, а не по разу на каждую вершину.
 */
export function applyCreasedNormals(
  geometry: BufferGeometry,
  creaseDegrees = 35,
): BufferGeometry {
  const source = geometry.getIndex() ? geometry.toNonIndexed() : geometry;
  const position = source.getAttribute("position");

  if (!position || position.count < 3) {
    return source;
  }

  const corners = position.count - (position.count % 3);
  const faceCount = corners / 3;
  const cornerNode = new Int32Array(corners);
  const nodeBuckets = new Map<number, number[]>();
  const nodeCellX: number[] = [];
  const nodeCellY: number[] = [];
  const nodeCellZ: number[] = [];
  const nodeCornerCount: number[] = [];

  for (let corner = 0; corner < corners; corner += 1) {
    // Клетка с точностью 0.1 мкм: кольца строятся одной формулой, но копить
    // ошибку плавающей точки осевых смещений всё равно незачем.
    const cellX = Math.round(position.getX(corner) * 1e4);
    const cellY = Math.round(position.getY(corner) * 1e4);
    const cellZ = Math.round(position.getZ(corner) * 1e4);
    const hash =
      Math.imul(cellX, 73856093) ^
      Math.imul(cellY, 19349663) ^
      Math.imul(cellZ, 83492791);
    let bucket = nodeBuckets.get(hash);

    if (bucket === undefined) {
      bucket = [];
      nodeBuckets.set(hash, bucket);
    }

    let node = -1;

    for (const candidate of bucket) {
      if (
        nodeCellX[candidate] === cellX &&
        nodeCellY[candidate] === cellY &&
        nodeCellZ[candidate] === cellZ
      ) {
        node = candidate;
        break;
      }
    }

    if (node < 0) {
      node = nodeCellX.length;
      nodeCellX.push(cellX);
      nodeCellY.push(cellY);
      nodeCellZ.push(cellZ);
      nodeCornerCount.push(0);
      bucket.push(node);
    }

    cornerNode[corner] = node;
    nodeCornerCount[node] += 1;
  }

  const nodeCount = nodeCellX.length;
  const nodeStart = new Int32Array(nodeCount + 1);

  for (let node = 0; node < nodeCount; node += 1) {
    nodeStart[node + 1] = nodeStart[node] + nodeCornerCount[node];
  }

  const nodeCorners = new Int32Array(corners);
  const cursor = nodeStart.slice(0, nodeCount);

  for (let corner = 0; corner < corners; corner += 1) {
    nodeCorners[cursor[cornerNode[corner]]] = corner;
    cursor[cornerNode[corner]] += 1;
  }

  const faceCross = new Float64Array(faceCount * 3);
  const faceLength = new Float64Array(faceCount);

  for (let face = 0; face < faceCount; face += 1) {
    const offset = face * 3;
    const ax = position.getX(offset);
    const ay = position.getY(offset);
    const az = position.getZ(offset);
    const ux = position.getX(offset + 1) - ax;
    const uy = position.getY(offset + 1) - ay;
    const uz = position.getZ(offset + 1) - az;
    const vx = position.getX(offset + 2) - ax;
    const vy = position.getY(offset + 2) - ay;
    const vz = position.getZ(offset + 2) - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;

    faceCross[offset] = nx;
    faceCross[offset + 1] = ny;
    faceCross[offset + 2] = nz;
    faceLength[face] = Math.sqrt(nx * nx + ny * ny + nz * nz);
  }

  const cosLimit = Math.cos(
    (Math.max(0, Math.min(180, creaseDegrees)) * Math.PI) / 180,
  );
  const normals = new Float32Array(corners * 3);
  /** Записать нормаль в одну вершину треугольника без повторной нормировки. */
  const store = (slot: number, sumX: number, sumY: number, sumZ: number): void => {
    const length = Math.sqrt(sumX * sumX + sumY * sumY + sumZ * sumZ);
    const offset = slot * 3;

    if (length > 0) {
      normals[offset] = sumX / length;
      normals[offset + 1] = sumY / length;
      normals[offset + 2] = sumZ / length;
    } else {
      // Вырожденный треугольник: направление нормали всё равно не видно.
      normals[offset + 2] = 1;
    }
  };

  for (let node = 0; node < nodeCount; node += 1) {
    const start = nodeStart[node];
    const end = nodeStart[node + 1];
    let smooth = true;
    let seen = -1;

    for (let first = start; first < end && smooth; first += 1) {
      const face = (nodeCorners[first] / 3) | 0;

      if (face === seen) {
        continue;
      }

      seen = face;

      const ownLength = faceLength[face];

      if (ownLength <= 0) {
        smooth = false;
        break;
      }

      const ownOffset = face * 3;
      const ownX = faceCross[ownOffset] / ownLength;
      const ownY = faceCross[ownOffset + 1] / ownLength;
      const ownZ = faceCross[ownOffset + 2] / ownLength;

      for (let second = first + 1; second < end; second += 1) {
        const other = (nodeCorners[second] / 3) | 0;

        if (other === face) {
          continue;
        }

        const otherLength = faceLength[other];

        if (otherLength <= 0) {
          smooth = false;
          break;
        }

        const otherOffset = other * 3;
        const dot =
          (ownX * faceCross[otherOffset] +
            ownY * faceCross[otherOffset + 1] +
            ownZ * faceCross[otherOffset + 2]) /
          otherLength;

        if (dot < cosLimit) {
          smooth = false;
          break;
        }
      }
    }

    if (!smooth) {
      // Настоящее ребро: у каждой грани своя сумма соседей в пределах порога.
      for (let index = start; index < end; index += 1) {
        const slot = nodeCorners[index];
        const face = (slot / 3) | 0;
        const ownLength = faceLength[face];

        if (ownLength <= 0) {
          continue;
        }

        const ownOffset = face * 3;
        const ownX = faceCross[ownOffset] / ownLength;
        const ownY = faceCross[ownOffset + 1] / ownLength;
        const ownZ = faceCross[ownOffset + 2] / ownLength;
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;

        for (let otherIndex = start; otherIndex < end; otherIndex += 1) {
          const other = (nodeCorners[otherIndex] / 3) | 0;
          const otherLength = faceLength[other];

          if (otherLength <= 0) {
            continue;
          }

          const otherOffset = other * 3;
          const dot =
            (ownX * faceCross[otherOffset] +
              ownY * faceCross[otherOffset + 1] +
              ownZ * faceCross[otherOffset + 2]) /
            otherLength;

          if (dot < cosLimit) {
            continue;
          }

          sumX += faceCross[otherOffset];
          sumY += faceCross[otherOffset + 1];
          sumZ += faceCross[otherOffset + 2];
        }

        store(slot, sumX, sumY, sumZ);
      }

      continue;
    }

    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    let counted = -1;

    for (let index = start; index < end; index += 1) {
      const face = (nodeCorners[index] / 3) | 0;

      if (face === counted) {
        continue;
      }

      counted = face;
      const offset = face * 3;

      sumX += faceCross[offset];
      sumY += faceCross[offset + 1];
      sumZ += faceCross[offset + 2];
    }

    for (let index = start; index < end; index += 1) {
      store(nodeCorners[index], sumX, sumY, sumZ);
    }
  }

  source.setAttribute("normal", new Float32BufferAttribute(normals, 3));

  return source;
}
