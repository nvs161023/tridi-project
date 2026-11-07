/**
 * Снимок вазы в RGB-буфер: без WebGL, без браузера и без новых зависимостей.
 *
 * Зачем свой растеризатор, а не WebGL: галерея вариантов показывает двенадцать
 * ваз одновременно, а двенадцать WebGL-контекстов на одной странице браузер не
 * держит — он начинает выгружать старые, и плитки мигают. Здесь та же сетка, что
 * уходит в STL, рисуется по z-буферу с плоским затенением в обычный массив
 * пикселей: его хватает и для `<canvas>` на экране, и для PNG в гейте этапа.
 *
 * Модуль чистый: координаты берутся из `createVaseGeometry`, освещение — из двух
 * постоянных векторов, поэтому один набор параметров даёт один и тот же кадр
 * байт в байт и в браузере, и в Node.
 */
import type { VaseParams } from "@/lib/constructor/params";
import type { VaseBudget } from "@/lib/constructor/vase-budget";
import { createVaseGeometry } from "@/lib/constructor/vase-geometry";
import { createVaseProfile } from "@/lib/constructor/vase-profile";

/** Фон снимка: тёмная плита, как сцена конструктора. */
export const VASE_PREVIEW_BACKGROUND = [17, 24, 39] as const;

/** Цвет пластика: тёплый светлый, чтобы рельеф читался тенями. */
export const VASE_PREVIEW_PLASTIC = [236, 227, 214] as const;

/** Три канала цвета: значения 0…255. */
type Rgb = readonly [number, number, number];

/** Кадр: пиксели в порядке RGB, по три байта на точку. */
export type VasePreview = {
  /** Пиксели кадра: длина `width * height * 3`. */
  rgb: Uint8ClampedArray;
  width: number;
  height: number;
  /** Сколько треугольников попало в кадр — для подписи гейта. */
  triangles: number;
  /** Сколько вершин в сетке: по ним видно, выросло ли разрешение. */
  vertices: number;
};

/** Настройки кадра: размер, ракурс и бюджет сетки. */
export type VasePreviewOptions = {
  /** Ширина кадра, пиксели. */
  width?: number;
  /** Высота кадра, пиксели. */
  height?: number;
  /** Азимут камеры, градусы: 0 — взгляд с фронта, 90 — сбоку. */
  azimuth?: number;
  /** Подъём камеры, градусы: 0 — на уровне дна, 90 — сверху. */
  elevation?: number;
  /** Во сколько раз крупнее рисуется кадр до усреднения: 1 — без сглаживания. */
  supersample?: number;
  /**
   * Бюджет сетки. По умолчанию экспортный: снимок гейта должен показывать самую
   * мелкую геометрию, которую можно скачать. Плитке галереи хватает предпросмотра
   * — она всё равно шириной в 160 пикселей.
   */
  budget?: VaseBudget;
  /** Цвет фона: тёмная плита по умолчанию. */
  background?: Rgb;
  /** Цвет пластика: тёплый светлый по умолчанию. */
  plastic?: Rgb;
};

/** Единичный вектор: нулевой длины не бывает, иначе деление даст NaN. */
function normalize(
  vector: readonly [number, number, number],
): [number, number, number] {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/** Векторное произведение: по нему строятся базис камеры и нормали граней. */
function cross(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Базис ортографической камеры.
 *
 * Азимут 0 — взгляд с фронта (ось +Z), азимут 90 — сбоку. Наклон ограничен
 * ±80°, иначе «вверх» камеры вырождается вместе с моделью в кадре.
 */
export function cameraBasis(azimuthDeg: number, elevationDeg: number) {
  const azimuth = (azimuthDeg * Math.PI) / 180;
  const elevation = (Math.max(-80, Math.min(80, elevationDeg)) * Math.PI) / 180;
  const cosElevation = Math.cos(elevation);
  const eye: [number, number, number] = [
    Math.sin(azimuth) * cosElevation,
    Math.sin(elevation),
    Math.cos(azimuth) * cosElevation,
  ];
  const right = normalize(cross([0, 1, 0], eye));

  return { eye, right, up: normalize(cross(eye, right)) };
}

/**
 * Снимок вазы: RGB-буфер в размер `width × height`.
 *
 * Сглаживание — суперсэмплингом: кадр рисуется в `supersample` раз крупнее и
 * сводится усреднением. Порядок треугольников не важен, глубину решает
 * z-буфер, поэтому внутренние стенки сквозь горло видны правильно.
 */
export function renderVaseRgb(
  params: VaseParams,
  options: VasePreviewOptions = {},
): VasePreview {
  const {
    width = 720,
    height = 900,
    azimuth = 24,
    elevation = 12,
    supersample = 2,
    budget = "export",
    background = VASE_PREVIEW_BACKGROUND,
    plastic = VASE_PREVIEW_PLASTIC,
  } = options;

  // Профиль строится с тем же бюджетом, что и сетка: от бюджета зависит шаг
  // строк по высоте, и строки должны совпасть с шагом по окружности.
  const geometry = createVaseGeometry(createVaseProfile(params, budget), params, {
    budget,
  });
  const position = geometry.getAttribute("position").array as Float32Array;
  const index = geometry.getIndex();
  const corners = index ? (index.array as ArrayLike<number>) : null;
  const vertexCount = position.length / 3;
  const triangles = corners ? corners.length / 3 : vertexCount / 3;

  const frameWidth = width * supersample;
  const frameHeight = height * supersample;
  const { eye, right, up } = cameraBasis(azimuth, elevation);

  // Проекция в камеру: u — вправо, v — вверх, d — к зрителю.
  const projected = new Float32Array(position.length);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;

  for (let i = 0; i < position.length; i += 3) {
    const x = position[i];
    const y = position[i + 1];
    const z = position[i + 2];
    const u = x * right[0] + y * right[1] + z * right[2];
    const v = x * up[0] + y * up[1] + z * up[2];

    projected[i] = u;
    projected[i + 1] = v;
    projected[i + 2] = x * eye[0] + y * eye[1] + z * eye[2];

    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
  }

  const scale =
    Math.min(frameWidth / (maxU - minU || 1), frameHeight / (maxV - minV || 1)) *
    0.92;
  const centerU = (minU + maxU) / 2;
  const centerV = (minV + maxV) / 2;

  // Экранные координаты вершин: пиксели, y вниз.
  const screenX = new Float32Array(vertexCount);
  const screenY = new Float32Array(vertexCount);
  const screenD = new Float32Array(vertexCount);

  for (let i = 0; i < vertexCount; i += 1) {
    screenX[i] = (projected[i * 3] - centerU) * scale + frameWidth / 2;
    screenY[i] = frameHeight / 2 - (projected[i * 3 + 1] - centerV) * scale;
    screenD[i] = projected[i * 3 + 2];
  }

  const pixels = new Uint8ClampedArray(frameWidth * frameHeight * 3);

  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] = background[0];
    pixels[i + 1] = background[1];
    pixels[i + 2] = background[2];
  }

  const depth = new Float32Array(frameWidth * frameHeight).fill(-Infinity);

  // Два источника света в мире: основной сверху-слева и слабая подсветка
  // справа, чтобы глубина рельефа читалась и в тенях.
  const lightA = normalize([-0.45, 0.75, 0.55]);
  const lightB = normalize([0.65, -0.1, 0.35]);

  for (let t = 0; t < triangles; t += 1) {
    const i0 = corners ? corners[t * 3] : t * 3;
    const i1 = corners ? corners[t * 3 + 1] : t * 3 + 1;
    const i2 = corners ? corners[t * 3 + 2] : t * 3 + 2;

    const ax = screenX[i0];
    const ay = screenY[i0];
    const bx = screenX[i1];
    const by = screenY[i1];
    const cx = screenX[i2];
    const cy = screenY[i2];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

    if (area === 0) {
      continue;
    }

    // Нормаль считается по исходным координатам в миллиметрах: экранные уже
    // сжаты масштабом кадра, и по ним освещение поехало бы вместе с зумом.
    const p0 = i0 * 3;
    const p1 = i1 * 3;
    const p2 = i2 * 3;
    let normal = normalize(
      cross(
        [
          position[p1] - position[p0],
          position[p1 + 1] - position[p0 + 1],
          position[p1 + 2] - position[p0 + 2],
        ],
        [
          position[p2] - position[p0],
          position[p2 + 1] - position[p0 + 1],
          position[p2 + 2] - position[p0 + 2],
        ],
      ),
    );

    // Затенение двустороннее: сквозь горло видна внутренняя стенка, и без
    // разворота нормали она провалилась бы в чёрный.
    if (normal[0] * eye[0] + normal[1] * eye[1] + normal[2] * eye[2] < 0) {
      normal = [-normal[0], -normal[1], -normal[2]];
    }

    const key = Math.max(
      0,
      normal[0] * lightA[0] + normal[1] * lightA[1] + normal[2] * lightA[2],
    );
    const fill = Math.max(
      0,
      normal[0] * lightB[0] + normal[1] * lightB[1] + normal[2] * lightB[2],
    );
    const shade = Math.min(1.15, 0.18 + 0.66 * key + 0.2 * fill);
    const red = Math.min(255, Math.round(plastic[0] * shade));
    const green = Math.min(255, Math.round(plastic[1] * shade));
    const blue = Math.min(255, Math.round(plastic[2] * shade));

    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxX = Math.min(frameWidth - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxY = Math.min(frameHeight - 1, Math.ceil(Math.max(ay, by, cy)));

    for (let y = minY; y <= maxY; y += 1) {
      const py = y + 0.5;

      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5;
        const w0 = (cx - bx) * (py - by) - (px - bx) * (cy - by);
        const w1 = (ax - cx) * (py - cy) - (px - cx) * (ay - cy);
        const w2 = (bx - ax) * (py - ay) - (px - ax) * (by - ay);

        if (
          !((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0))
        ) {
          continue;
        }

        const sum = w0 + w1 + w2;

        if (sum === 0) {
          continue;
        }

        const z = (w0 * screenD[i0] + w1 * screenD[i1] + w2 * screenD[i2]) / sum;
        const pixel = y * frameWidth + x;

        if (z <= depth[pixel]) {
          continue;
        }

        depth[pixel] = z;
        const offset = pixel * 3;
        pixels[offset] = red;
        pixels[offset + 1] = green;
        pixels[offset + 2] = blue;
      }
    }
  }

  geometry.dispose();

  const rgb = new Uint8ClampedArray(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;

      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const offset =
            ((y * supersample + sy) * frameWidth + x * supersample + sx) * 3;
          red += pixels[offset];
          green += pixels[offset + 1];
          blue += pixels[offset + 2];
        }
      }

      const area = supersample * supersample;
      const offset = (y * width + x) * 3;
      rgb[offset] = Math.round(red / area);
      rgb[offset + 1] = Math.round(green / area);
      rgb[offset + 2] = Math.round(blue / area);
    }
  }

  return { rgb, width, height, triangles, vertices: vertexCount };
}
