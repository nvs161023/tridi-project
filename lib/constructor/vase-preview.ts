/**
 * Снимок вазы в RGB-буфер: без WebGL, без браузера и без новых зависимостей.
 *
 * Зачем свой растеризатор, а не WebGL: галерея форм показывает двенадцать
 * ваз одновременно, а двенадцать WebGL-контекстов на одной странице браузер не
 * держит — он начинает выгружать старые, и плитки мигают. Здесь та же сетка, что
 * уходит в STL, рисуется по z-буферу в обычный массив пикселей: его хватает и
 * для `<canvas>` на экране, и для PNG в гейте этапа.
 *
 * Студию снимок берёт из `lib/constructor/studio.ts` — того же описания, по
 * которому собирается 3D-сцена: тёмный градиент, керамика с глазурью, стол с
 * мягкими пятнами. Поэтому плитка галереи и viewport показывают одну вазу в
 * одной студии, и разъехаться им больше негде.
 *
 * Модуль чистый: координаты берутся из `createVaseGeometry`, освещение — из
 * постоянных студии, поэтому один набор параметров даёт один и тот же кадр
 * байт в байт и в браузере, и в Node.
 */
import type { VaseParams } from "@/lib/constructor/params";
import type { VaseBudget } from "@/lib/constructor/vase-budget";
import { createVaseGeometry } from "@/lib/constructor/vase-geometry";
import { createVaseProfile } from "@/lib/constructor/vase-profile";
import {
  STUDIO_CAMERA,
  STUDIO_FLOOR,
  STUDIO_VIGNETTE,
  fillStudioBackground,
  hexToRgb,
  studioSurfaceColor,
  studioVignetteAlpha,
  type StudioRgb,
  type StudioVector,
} from "@/lib/constructor/studio";

/**
 * Где стоит дно модели, доля высоты кадра.
 *
 * Ниже линии стола остаётся место под тень: без него ваза упиралась бы в
 * нижний край, как на чертеже, а не на студийном снимке.
 */
const FLOOR_LINE = 0.86;

/** Сколько ширины кадра может занять модель. */
const MODEL_WIDTH_SHARE = 0.9;

/** Сколько высоты кадра может занять модель: остальное — воздух и тень. */
const MODEL_HEIGHT_SHARE = 0.74;

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
  /**
   * Какую долю кадра заняла модель: 0…1.
   *
   * Считается по маске при растеризации, а не сравнением с фоном: фон теперь
   * градиент с тенью, и «не фон» больше не значит «ваза». Гейт по этому числу
   * ловит пустую плитку: если растеризатор перестанет рисовать, доля упадёт.
   */
  coverage: number;
  /**
   * Локальный контраст внутри силуэта: средний перепад яркости соседних
   * пикселей модели, ступени 0…255.
   *
   * Покрытие отвечает на вопрос «нарисовалось ли что-то», контраст — «видно ли
   * на этом узор». Гладкая стенка на плитке 64 × 80 даёт около 4.6 ступени:
   * сказывается наклон света по форме. Рёбра 1.2 мм на частоте 20 — около 20.
   * Гейт превью требует, чтобы узор был в разы контрастнее гладкой стенки,
   * иначе сплошная заливка проходила бы проверку покрытия.
   */
  contrast: number;
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

/** Точка в пикселях кадра: экранные координаты, y вниз. */
type ScreenPoint = { x: number; y: number };

/**
 * Затухание радиального пятна: единица в центре, ноль на краю эллипса.
 *
 * Формула та же, что у `alphaMap` в сцене: квадрат расстояния, поэтому
 * середина плотная, а край мягкий. Корень берётся только внутри эллипса:
 * снаружи ответ и так ноль, а считать его приходится на каждый пиксель кадра.
 */
function spotFalloff(
  x: number,
  y: number,
  center: ScreenPoint,
  radiusX: number,
  radiusY: number,
): number {
  const dx = (x - center.x) / radiusX;
  const dy = (y - center.y) / radiusY;
  const squared = dx * dx + dy * dy;

  if (squared >= 1) {
    return 0;
  }

  return (1 - Math.sqrt(squared)) ** 2;
}

/** Альфа-смешивание пикселя с цветом: так ложатся тень и пятна стола. */
function blendPixel(
  pixels: Uint8ClampedArray,
  offset: number,
  color: StudioRgb,
  alpha: number,
): void {
  if (alpha <= 0) {
    return;
  }

  const weight = Math.min(1, alpha);

  pixels[offset] = pixels[offset] + (color[0] - pixels[offset]) * weight;
  pixels[offset + 1] =
    pixels[offset + 1] + (color[1] - pixels[offset + 1]) * weight;
  pixels[offset + 2] =
    pixels[offset + 2] + (color[2] - pixels[offset + 2]) * weight;
}

/**
 * Снимок вазы: RGB-буфер в размер `width × height`.
 *
 * Сглаживание — суперсэмплингом: кадр рисуется в `supersample` раз крупнее и
 * сводится усреднением. Порядок треугольников не важен, глубину решает
 * z-буфер, поэтому внутренние стенки сквозь горло видны правильно.
 *
 * Кадр собирается в том же порядке, что и сцена: фон-градиент, стол с пятнами,
 * модель и виньетка поверх. Ваза стоит на линии стола, а не прижата к нижнему
 * краю, — иначе тени было бы некуда лечь.
 */
export function renderVaseRgb(
  params: VaseParams,
  options: VasePreviewOptions = {},
): VasePreview {
  const {
    width = 720,
    height = 900,
    azimuth = STUDIO_CAMERA.azimuthDeg,
    elevation = STUDIO_CAMERA.elevationDeg,
    supersample = 2,
    budget = "export",
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
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

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
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  const modelWidth = maxU - minU || 1;
  const modelHeight = maxV - minV || 1;
  const centerU = (minU + maxU) / 2;
  const floorLine = frameHeight * FLOOR_LINE;
  const scale = Math.min(
    (frameWidth * MODEL_WIDTH_SHARE) / modelWidth,
    (frameHeight * MODEL_HEIGHT_SHARE) / modelHeight,
  );

  // Мировая точка → пиксель кадра. Та же проекция, что у вершин: по ней
  // считается место пятен на столе.
  const project = (point: StudioVector): ScreenPoint => {
    const u =
      point[0] * right[0] + point[1] * right[1] + point[2] * right[2];
    const v = point[0] * up[0] + point[1] * up[1] + point[2] * up[2];

    return {
      x: (u - centerU) * scale + frameWidth / 2,
      y: floorLine - (v - minV) * scale,
    };
  };

  // Экранные координаты вершин: пиксели, y вниз.
  const screenX = new Float32Array(vertexCount);
  const screenY = new Float32Array(vertexCount);
  const screenD = new Float32Array(vertexCount);

  for (let i = 0; i < vertexCount; i += 1) {
    screenX[i] = (projected[i * 3] - centerU) * scale + frameWidth / 2;
    screenY[i] = floorLine - (projected[i * 3 + 1] - minV) * scale;
    screenD[i] = projected[i * 3 + 2];
  }

  const pixels = new Uint8ClampedArray(frameWidth * frameHeight * 3);

  // Фон: тот же CSS-градиент, что лежит под канвасом в конструкторе.
  fillStudioBackground(pixels, frameWidth, frameHeight);

  // Стол: пятно контакта и свет софтбокса. Оба рисуются экранными эллипсами у
  // линии стола, а не проекцией круга на плоскость: в ортопроекции стол виден
  // почти с ребра, и настоящий круг под дном целиком прячется за вазой. Эллипс
  // той же ширины повторяет ровно ту полосу, которую показывает перспективная
  // камера сцены: тёмную у дна и мягкий свет вокруг.
  const footprint = Math.max(maxX - minX, maxZ - minZ, 1) * scale;
  const floorPoint = project([(minX + maxX) / 2, minY, (minZ + maxZ) / 2]);
  const baseCenter: ScreenPoint = { x: floorPoint.x, y: floorLine };
  // Ракурс сжимает круг в эллипс: высота пятна меньше ширины.
  const squeeze = Math.max(
    0.18,
    Math.sin((Math.abs(elevation) * Math.PI) / 180),
  );
  const poolRadiusX = (footprint * STUDIO_FLOOR.poolScale) / 2;
  const contactRadiusX = (footprint * STUDIO_FLOOR.contactScale) / 2;
  const poolRadiusY = poolRadiusX * squeeze;
  const contactRadiusY = contactRadiusX * squeeze;
  const contactColor = hexToRgb(STUDIO_FLOOR.contactColor);
  const poolColor = hexToRgb(STUDIO_FLOOR.poolColor);

  for (let y = 0; y < frameHeight; y += 1) {
    // Пятно контакта меньше светового, поэтому снаружи большого эллипса
    // проверять его незачем: там заведомо ноль.
    const poolFalloff = spotFalloff(
      baseCenter.x,
      y + 0.5,
      baseCenter,
      poolRadiusX,
      poolRadiusY,
    );

    if (poolFalloff === 0) {
      continue;
    }

    for (let x = 0; x < frameWidth; x += 1) {
      const inPool = spotFalloff(
        x + 0.5,
        y + 0.5,
        baseCenter,
        poolRadiusX,
        poolRadiusY,
      );

      if (inPool === 0) {
        continue;
      }

      const offset = (y * frameWidth + x) * 3;

      blendPixel(pixels, offset, poolColor, inPool * STUDIO_FLOOR.poolOpacity);
      blendPixel(
        pixels,
        offset,
        contactColor,
        spotFalloff(
          x + 0.5,
          y + 0.5,
          baseCenter,
          contactRadiusX,
          contactRadiusY,
        ) * STUDIO_FLOOR.contactOpacity,
      );
    }
  }

  const depth = new Float32Array(frameWidth * frameHeight).fill(-Infinity);
  const covered = new Uint8Array(frameWidth * frameHeight);

  for (let triangle = 0; triangle < triangles; triangle += 1) {
    const i0 = corners ? corners[triangle * 3] : triangle * 3;
    const i1 = corners ? corners[triangle * 3 + 1] : triangle * 3 + 1;
    const i2 = corners ? corners[triangle * 3 + 2] : triangle * 3 + 2;

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

    // Цвет поверхности считается один раз на грань: формула с глазурью и ACES
    // заметно дороже прежних двух умножений, поэтому она вне цикла пикселей.
    const color = studioSurfaceColor(normal, eye);

    const minPixelX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxPixelX = Math.min(
      frameWidth - 1,
      Math.ceil(Math.max(ax, bx, cx)),
    );
    const minPixelY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxPixelY = Math.min(
      frameHeight - 1,
      Math.ceil(Math.max(ay, by, cy)),
    );

    for (let y = minPixelY; y <= maxPixelY; y += 1) {
      const py = y + 0.5;

      for (let x = minPixelX; x <= maxPixelX; x += 1) {
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

        const z =
          (w0 * screenD[i0] + w1 * screenD[i1] + w2 * screenD[i2]) / sum;
        const pixel = y * frameWidth + x;

        if (z <= depth[pixel]) {
          continue;
        }

        depth[pixel] = z;
        covered[pixel] = 1;
        const pixelOffset = pixel * 3;

        pixels[pixelOffset] = color[0];
        pixels[pixelOffset + 1] = color[1];
        pixels[pixelOffset + 2] = color[2];
      }
    }
  }

  geometry.dispose();

  const rgb = new Uint8ClampedArray(width * height * 3);
  const samples = supersample * supersample;
  /** Маска готового кадра: 1 — пиксель накрыт моделью. По ней считается контраст. */
  const silhouette = new Uint8Array(width * height);
  let modelPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let coveredSamples = 0;

      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const frameX = x * supersample + sx;
          const frameY = y * supersample + sy;
          const offset = (frameY * frameWidth + frameX) * 3;
          red += pixels[offset];
          green += pixels[offset + 1];
          blue += pixels[offset + 2];
          coveredSamples += covered[frameY * frameWidth + frameX];
        }
      }

      let mixedRed = red / samples;
      let mixedGreen = green / samples;
      let mixedBlue = blue / samples;
      // Виньетка: тот же слой, что лежит над канвасом в конструкторе.
      const vignette = studioVignetteAlpha(x + 0.5, y + 0.5, width, height);

      if (vignette > 0) {
        mixedRed += (STUDIO_VIGNETTE.color[0] - mixedRed) * vignette;
        mixedGreen += (STUDIO_VIGNETTE.color[1] - mixedGreen) * vignette;
        mixedBlue += (STUDIO_VIGNETTE.color[2] - mixedBlue) * vignette;
      }

      const offset = (y * width + x) * 3;

      rgb[offset] = mixedRed;
      rgb[offset + 1] = mixedGreen;
      rgb[offset + 2] = mixedBlue;

      if (coveredSamples > 0) {
        modelPixels += 1;
        silhouette[y * width + x] = 1;
      }
    }
  }

  /*
   * Локальный контраст: средний перепад яркости между соседними пикселями
   * внутри силуэта. Гладкая стенка на этом масштабе почти не меняется, а рёбра,
   * спираль и гранёный силуэт дают заметные перепады на каждой грани. Число
   * нужно гейту: одного покрытия мало — сплошная заливка без узора тоже
   * покрытие.
   */
  let contrastSum = 0;
  let contrastPairs = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const index = y * width + x;

      if (silhouette[index] === 0 || silhouette[index + 1] === 0) {
        continue;
      }

      const left = index * 3;
      const right = left + 3;
      const leftLuminance =
        0.2126 * rgb[left] + 0.7152 * rgb[left + 1] + 0.0722 * rgb[left + 2];
      const rightLuminance =
        0.2126 * rgb[right] + 0.7152 * rgb[right + 1] + 0.0722 * rgb[right + 2];

      contrastSum += Math.abs(leftLuminance - rightLuminance);
      contrastPairs += 1;
    }
  }

  return {
    rgb,
    width,
    height,
    triangles,
    vertices: vertexCount,
    coverage: modelPixels / (width * height),
    contrast: contrastPairs ? contrastSum / contrastPairs : 0,
  };
}
