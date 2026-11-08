/**
 * Студия конструктора: один набор чисел на 3D-сцену и на снимки превью.
 *
 * Зачем общий модуль: `Viewport.tsx` рисует модель в WebGL, а плитки галерей
 * рисует растеризатор `vase-preview.ts` на процессоре. Пока числа жили в двух
 * местах, они разъезжались: после переделки студии в WebGL картинки галереи
 * ещё неделю оставались от прежней сцены. Здесь лежит единственное описание
 * студии — фон, виньетка, экспозиция, керамика, софтбоксы, три источника и
 * стол, — а оба рендерера читают его отсюда.
 *
 * Модуль чистый и без зависимостей: его импортирует и клиентский компонент, и
 * Node-скрипт рендера PNG. Поэтому здесь нет ни `three`, ни DOM.
 */

/** Цвет в байтах: три канала 0…255. */
export type StudioRgb = readonly [number, number, number];

/** Цвет в линейном пространстве: три канала, значения обычно 0…1. */
export type StudioLinear = readonly [number, number, number];

/** Вектор в трёхмерном пространстве модели. */
export type StudioVector = readonly [number, number, number];

/**
 * Фон сцены: тёмный радиальный градиент, как у студийного снимка.
 *
 * Числа совпадают с CSS-градиентом обёртки viewport. Центр поднят выше
 * середины (16 %): свет софтбокса падает сверху, и модель стоит в светлом
 * пятне, а не в геометрическом центре кадра.
 */
export const STUDIO_BACKGROUND = {
  /** Где центр градиента, доли ширины и высоты кадра. */
  centerX: 0.5,
  centerY: 0.16,
  /** Остановки градиента: смещение 0…1 и цвет. */
  stops: [
    { offset: 0, color: "#1e293b" },
    { offset: 0.46, color: "#0f172a" },
    { offset: 1, color: "#050a14" },
  ],
} as const;

/** Тот же фон строкой CSS: обёртка канваса берёт его отсюда. */
export const STUDIO_BACKGROUND_CSS =
  "radial-gradient(circle at 50% 16%, #1e293b 0%, #0f172a 46%, #050a14 100%)";

/** Цвет самого тёмного края фона: им заливаются промежутки в листах гейта. */
export const STUDIO_BACKGROUND_EDGE = "#050a14";

/**
 * Виньетка поверх сцены: края уходят в тон фона, взгляд держится в центре.
 *
 * Внутренний радиус 42 % — зона, где затемнения ещё нет. Дальше плотность
 * растёт до 0.5 у края. В WebGL это отдельный слой над канвасом, в превью —
 * умножение готового кадра на ту же формулу.
 */
export const STUDIO_VIGNETTE = {
  centerX: 0.5,
  centerY: 0.42,
  innerRadius: 0.42,
  color: [2, 6, 23] as const,
  alpha: 0.5,
  css: "radial-gradient(circle at 50% 42%, transparent 42%, rgba(2,6,23,0.5) 100%)",
} as const;

/**
 * Экспозиция рендерера.
 *
 * Ниже единицы: при 1.0 освещённая сторона керамики упиралась в белый, и
 * полутени исчезали. Оба рендерера возводят этот множитель в свою кривую
 * тонмаппинга, поэтому значение одно на всех.
 */
export const STUDIO_EXPOSURE = 0.92;

/**
 * Керамика вазы: матовая основа и тонкий слой глазури сверху.
 *
 * Цвет чуть темнее бумажного: на белом при таком свете не остаётся полутеней.
 * `clearcoat` ловит свет софтбоксов отдельным бликом, по нему читается изгиб.
 */
export const STUDIO_CERAMIC = {
  color: "#dbe3ee",
  roughness: 0.55,
  metalness: 0.1,
  clearcoat: 0.5,
  clearcoatRoughness: 0.3,
} as const;

/**
 * Пластик остальных моделей: матовая основа без глазури.
 *
 * `roughness` 0.7 и `metalness` 0.1 — то же, что было в сцене до выноса сюда.
 * Глазурь вазы здесь не нужна: у деталей нет крупных изогнутых поверхностей, а
 * лишний блик только съедал бы рельеф.
 */
export const STUDIO_PLASTIC = {
  roughness: 0.7,
  metalness: 0.1,
} as const;

/**
 * Цвет пластика по модели.
 *
 * Цветов ровно столько, сколько моделей без вазы: он отличает детали друг от
 * друга в кадре конструктора, а не изображает реальный филамент. Значения
 * подобраны так, чтобы под тёплым ключом ни один канал не упирался в 255 —
 * иначе деталь читается как пересвеченное пятно без формы.
 *
 * Вывеска и органайзер для ручек светлее прочих на ступень палитры: их лицевые
 * плоскости смотрят прямо в камеру, а ключевой источник стоит сбоку (1.45 по
 * X). Такой плоскости достаётся меньше света, чем изогнутым стенкам кашпо, и
 * на прежнем цвете половина силуэта уходила в провал: у вывески доля пикселей
 * темнее 50 была 59 %, у органайзера — 19 %. Студию ради этого не трогаем:
 * вазе и остальным моделям света хватает, а плоским деталям нужен более
 * светлый пластик.
 */
export const STUDIO_MODEL_TINTS = {
  keychain: "#f59e0b",
  stand: "#38bdf8",
  box: "#34d399",
  lithophane: "#f1f5f9",
  planter: "#fbbf24",
  coaster: "#fb7185",
  jewelry_stand: "#c084fc",
  pen_holder: "#93c5fd",
  heat_transfer: "#f97316",
  sign: "#c4b5fd",
} as const;

/**
 * Программное окружение: софтбоксы виртуальной студии вместо HDR-файла.
 *
 * `PMREMGenerator` сворачивает панели в карту освещённости, и керамика
 * получает отражения без обращений к сети. Интенсивность маленькая: окружение
 * здесь добавка к ключевому свету, а не замена.
 */
export const STUDIO_ENVIRONMENT = {
  /** Насколько сильно окружение подсвечивает модель. */
  intensity: 0.22,
  /** Фон виртуальной студии: тёмный, чтобы панели читались как источники. */
  background: "#0b1220",
  panels: [
    {
      /** Верхний софтбокс: главный блик на плече и горле вазы. */
      color: "#ffffff",
      power: 3,
      size: [12, 12] as const,
      position: [0, 9, 0] as const,
    },
    {
      /** Левая полоса: длинное отражение вдоль силуэта. */
      color: "#dbeafe",
      power: 2,
      size: [6, 3] as const,
      position: [-8, 3, 2] as const,
    },
    {
      /** Правая полоса холоднее: две полосы одного цвета дали бы симметрию. */
      color: "#c7d2fe",
      power: 1.4,
      size: [6, 3] as const,
      position: [8, 2.5, 1] as const,
    },
    {
      /** Тёплый акцент сзади: второй цвет в отражениях. */
      color: "#fdba74",
      power: 1.6,
      size: [4, 4] as const,
      position: [2, 3, -8] as const,
    },
  ],
} as const;

/**
 * Свет студии: тёплый ключ, холодные заполняющий и контровой, слабая полусфера.
 *
 * Тень отбрасывает только ключевой источник: вторая тень от заполняющего
 * выглядела бы грязью под моделью. Тёплый свет на керамике читается как
 * предметная съёмка, холодная кромка отделяет деталь от тёмного фона.
 *
 * Позиции заданы множителями радиуса студии (`studioSpan`), а не
 * миллиметрами: ваза 120 мм и вывеска 400 мм требуют разного удаления лампы.
 * Ключ стоит сбоку (1.45 по X), а не перед моделью: лобовой свет давал ровный
 * силуэт без светотени.
 */
export const STUDIO_LIGHTS = {
  hemisphere: { sky: "#dbeafe", ground: "#0b1120", intensity: 0.05 },
  key: {
    color: "#fff4e6",
    intensity: 2.4,
    position: [1.45, 1.15, 0.35] as const,
    /** Карта тени: 1024 на охвате 440 мм — это 0.43 мм на тексель. */
    mapSize: 1024,
    /** Радиус размытия края тени в текселях карты. */
    radius: 16,
    bias: -0.0005,
    normalBias: 0.02,
  },
  fill: {
    color: "#dbe6f4",
    intensity: 0.22,
    position: [-1.2, 0.5, 0.9] as const,
  },
  rim: {
    color: "#bfd3ea",
    intensity: 0.55,
    position: [-0.35, 0.85, -1.25] as const,
  },
} as const;

/**
 * Стол: три прозрачные плоскости вместо поверхности.
 *
 * `shadow` — настоящая тень от ключевого света. `contact` прижимает деталь к
 * плоскости, `pool` изображает свет софтбокса на столе. Пятна — один
 * радиальный градиент, поэтому край стола не читается.
 */
export const STUDIO_FLOOR = {
  shadowColor: "#020617",
  shadowOpacity: 0.4,
  contactColor: "#020617",
  contactOpacity: 0.4,
  /** Диаметр пятна контакта к габариту модели. */
  contactScale: 1.6,
  poolColor: "#dbeafe",
  poolOpacity: 0.08,
  /** Диаметр светового пятна к габариту модели. */
  poolScale: 4,
} as const;

/**
 * Ракурс камеры при первом открытии: чуть справа и сверху.
 *
 * `direction` — тот же вектор, что у `CameraRig` в WebGL, а `azimuthDeg` и
 * `elevationDeg` — он же в градусах для растеризатора превью. Плитки галереи
 * поэтому смотрят на вазу оттуда же, откуда смотрит сцена.
 */
export const STUDIO_CAMERA = {
  direction: [0.62, 0.3, 0.94] as const,
  azimuthDeg: 33.4,
  elevationDeg: 14.9,
} as const;

/**
 * Радиус студии: по нему настраиваются свет и карта теней.
 *
 * Модели живут в миллиметрах, и ваза 120 мм с вывеской 400 мм требуют разного
 * удаления лампы и разного охвата тени: иначе тень либо не попадает в кадр,
 * либо размывается в серое пятно.
 */
export function studioSpan(height: number, footprint: number): number {
  return Math.max(footprint * 1.8, height * 1.6, 220);
}

/**
 * Разобранные цвета по строке `#rrggbb`.
 *
 * Кэш нужен не для красоты: фон превью считается на каждый пиксель, и разбор
 * строки в этом цикле стоил бы дороже самого градиента.
 */
const HEX_CACHE = new Map<string, StudioRgb>();

/** `#rrggbb` → три байта. Короткая запись `#rgb` тоже принимается. */
export function hexToRgb(hex: string): StudioRgb {
  const cached = HEX_CACHE.get(hex);

  if (cached) {
    return cached;
  }

  const body = hex.replace("#", "");
  const full =
    body.length === 3
      ? body
          .split("")
          .map((symbol) => symbol + symbol)
          .join("")
      : body;
  const parsed: StudioRgb = [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];

  HEX_CACHE.set(hex, parsed);

  return parsed;
}

/**
 * Канал sRGB → линейный.
 *
 * Ровно та кривая, которой three переводит цвета материалов и источников:
 * без неё керамика на превью стала бы светлее, чем в сцене.
 */
export function srgbToLinearChannel(value: number): number {
  return value <= 0.04045
    ? value / 12.92
    : ((value * 0.9478672986 + 0.0521327014) ** 2.4);
}

/** Канал линейный → sRGB: обратная кривая вывода рендерера. */
export function linearToSrgbChannel(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));

  return clamped <= 0.0031308
    ? clamped * 12.92
    : clamped ** 0.41666 * 1.055 - 0.055;
}

/**
 * Таблица перевода канала в sRGB: 1024 ступени с линейной доводкой.
 *
 * Степень 0.41666 в цикле по граням стоит дороже всего остального счёта, а
 * ошибка таблицы — меньше одного байта из 255. Поэтому тонмаппинг берёт её
 * отсюда, а не считает `pow` на каждый треугольник.
 */
const SRGB_TABLE_SIZE = 1024;
const SRGB_TABLE = (() => {
  const table = new Float32Array(SRGB_TABLE_SIZE + 1);

  for (let index = 0; index <= SRGB_TABLE_SIZE; index += 1) {
    table[index] = linearToSrgbChannel(index / SRGB_TABLE_SIZE);
  }

  return table;
})();

/** Канал линейный → sRGB по таблице: то же, что `linearToSrgbChannel`. */
function srgbFromTable(value: number): number {
  const clamped = value <= 0 ? 0 : value >= 1 ? 1 : value;
  const scaled = clamped * SRGB_TABLE_SIZE;
  const index = Math.floor(scaled);
  const rest = scaled - index;

  return SRGB_TABLE[index] + (SRGB_TABLE[index + 1] - SRGB_TABLE[index]) * rest;
}

/** `#rrggbb` → линейный цвет: в таком виде его ждут формулы освещения. */
export function hexToLinear(hex: string): StudioLinear {
  const [red, green, blue] = hexToRgb(hex);

  return [
    srgbToLinearChannel(red / 255),
    srgbToLinearChannel(green / 255),
    srgbToLinearChannel(blue / 255),
  ];
}

/** Линейный цвет, умноженный на множитель: мощность источника. */
export function multiplyLinear(
  color: StudioLinear,
  factor: number,
): StudioLinear {
  return [color[0] * factor, color[1] * factor, color[2] * factor];
}

/** Единичный вектор: нулевой длины не бывает, иначе деление даст NaN. */
export function normalizeVector(vector: StudioVector): StudioVector {
  const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/**
 * Вектор, приведённый к единичной длине, но без работы, если он уже такой.
 *
 * Нормали и направление взгляда приходят из растеризатора уже единичными, а
 * вызывается это на каждую грань: `hypot` и три деления на грань заметны.
 */
function asUnit(vector: StudioVector): StudioVector {
  const squared =
    vector[0] * vector[0] + vector[1] * vector[1] + vector[2] * vector[2];

  if (Math.abs(squared - 1) <= 1e-6) {
    return vector;
  }

  const length = Math.sqrt(squared) || 1;

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/**
 * Направление, в котором светит лампа из точки `position`.
 *
 * Тень и блик считаются от этого вектора, а не от позиции: расстояние до
 * источника на форму тени не влияет, только направление.
 */
export function studioLightDirection(position: StudioVector): StudioVector {
  return normalizeVector(position);
}

/** Расстояние до самого далёкого угла кадра: так CSS считает `farthest-corner`. */
function farthestCornerRadius(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
): number {
  return Math.hypot(
    Math.max(centerX, width - centerX),
    Math.max(centerY, height - centerY),
  );
}

/**
 * Фон кадра в точке.
 *
 * Повторяет `radial-gradient(circle at 50% 16%, …)` из CSS: радиус считается
 * до дальнего угла, остановки интерполируются в sRGB. Поэтому PNG плитки и
 * подложка канваса — один и тот же градиент. Целый кадр заливает
 * `fillStudioBackground`: та же формула, но без массива цвета на точку.
 */
export function studioBackgroundAt(
  x: number,
  y: number,
  width: number,
  height: number,
): StudioRgb {
  const centerX = STUDIO_BACKGROUND.centerX * width;
  const centerY = STUDIO_BACKGROUND.centerY * height;
  const radius =
    farthestCornerRadius(centerX, centerY, width, height) || 1;
  const offset = Math.min(1, Math.hypot(x - centerX, y - centerY) / radius);
  const stops = STUDIO_BACKGROUND.stops;

  let index = 0;

  while (index < stops.length - 2 && offset > stops[index + 1].offset) {
    index += 1;
  }

  const from = stops[index];
  const to = stops[Math.min(index + 1, stops.length - 1)];
  const span = to.offset - from.offset || 1;
  const mix = Math.min(1, Math.max(0, (offset - from.offset) / span));
  const start = hexToRgb(from.color);
  const end = hexToRgb(to.color);

  return [
    Math.round(start[0] + (end[0] - start[0]) * mix),
    Math.round(start[1] + (end[1] - start[1]) * mix),
    Math.round(start[2] + (end[2] - start[2]) * mix),
  ];
}

/**
 * Заливает буфер фоном студии.
 *
 * То же, что `studioBackgroundAt` по пикселю, но без массива цвета на точку и
 * без `hypot`: кадр плитки — сотни тысяч пикселей, и разница на них заметна.
 */
export function fillStudioBackground(
  target: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const centerX = STUDIO_BACKGROUND.centerX * width;
  const centerY = STUDIO_BACKGROUND.centerY * height;
  const radius = farthestCornerRadius(centerX, centerY, width, height) || 1;
  const stops = STUDIO_BACKGROUND.stops.map((stop) => ({
    offset: stop.offset,
    color: hexToRgb(stop.color),
  }));
  const last = stops.length - 1;
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    const dy = y + 0.5 - centerY;

    for (let x = 0; x < width; x += 1) {
      const dx = x + 0.5 - centerX;
      const distance = Math.sqrt(dx * dx + dy * dy) / radius;
      let index = 0;

      while (index < last - 1 && distance > stops[index + 1].offset) {
        index += 1;
      }

      const from = stops[index];
      const to = stops[Math.min(index + 1, last)];
      const span = to.offset - from.offset || 1;
      const mix = Math.min(1, Math.max(0, (distance - from.offset) / span));

      target[offset] = from.color[0] + (to.color[0] - from.color[0]) * mix;
      target[offset + 1] = from.color[1] + (to.color[1] - from.color[1]) * mix;
      target[offset + 2] = from.color[2] + (to.color[2] - from.color[2]) * mix;
      offset += 3;
    }
  }
}

/**
 * Плотность виньетки в точке: 0 — затемнения нет, 1 — полная плотность.
 *
 * Внутри 42 % радиуса кадр не трогаем, дальше плотность растёт линейно до
 * `STUDIO_VIGNETTE.alpha`. Считается в долях от дальнего угла, как в CSS.
 */
export function studioVignetteAlpha(
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const centerX = STUDIO_VIGNETTE.centerX * width;
  const centerY = STUDIO_VIGNETTE.centerY * height;
  const radius =
    farthestCornerRadius(centerX, centerY, width, height) || 1;
  const offset = Math.hypot(x - centerX, y - centerY) / radius;

  if (offset <= STUDIO_VIGNETTE.innerRadius) {
    return 0;
  }

  const span = 1 - STUDIO_VIGNETTE.innerRadius;
  const mix = Math.min(1, (offset - STUDIO_VIGNETTE.innerRadius) / span);

  return mix * STUDIO_VIGNETTE.alpha;
}

/**
 * Матрицы ACES из шейдера three: столбцы, как в GLSL.
 *
 * Своя копия вместо чтения шейдера: превью считается на процессоре, а
 * `three` в этот модуль не импортируется. Числа обязаны совпадать, иначе
 * керамика на плитке и в сцене получит разный контраст.
 */
const ACES_INPUT_COLUMNS: readonly StudioLinear[] = [
  [0.59719, 0.076, 0.0284],
  [0.35458, 0.90834, 0.13383],
  [0.04823, 0.01566, 0.83777],
];

/** Вторая матрица ACES: выход из AP1 обратно в sRGB. */
const ACES_OUTPUT_COLUMNS: readonly StudioLinear[] = [
  [1.60475, -0.10208, -0.00327],
  [-0.53108, 1.10813, -0.07276],
  [-0.07367, -0.00605, 1.07602],
];

/** Умножение столбцовой матрицы 3 × 3 на вектор, как `mat3 * vec3` в GLSL. */
function applyMatrix(
  columns: readonly StudioLinear[],
  color: StudioLinear,
): StudioLinear {
  return [
    columns[0][0] * color[0] +
      columns[1][0] * color[1] +
      columns[2][0] * color[2],
    columns[0][1] * color[0] +
      columns[1][1] * color[1] +
      columns[2][1] * color[2],
    columns[0][2] * color[0] +
      columns[1][2] * color[1] +
      columns[2][2] * color[2],
  ];
}

/**
 * Линейный цвет → байты через ACES и кривую sRGB.
 *
 * Один в один `ACESFilmicToneMapping` из three вместе с выводом в sRGB:
 * множитель экспозиции, сдвиг 1/0.6, две матрицы, фит RRT/ODT и насыщение.
 * Поэтому светлая керамика превью не пересвечена так же, как в сцене.
 */
export function studioToneMap(
  color: StudioLinear,
  exposure: number = STUDIO_EXPOSURE,
): StudioRgb {
  const scaled: StudioLinear = [
    (color[0] * exposure) / 0.6,
    (color[1] * exposure) / 0.6,
    (color[2] * exposure) / 0.6,
  ];
  const fitted = applyMatrix(ACES_INPUT_COLUMNS, scaled);
  const curve: [number, number, number] = [0, 0, 0];
  const result: [number, number, number] = [0, 0, 0];

  for (let channel = 0; channel < 3; channel += 1) {
    const value = fitted[channel];
    const numerator = value * (value + 0.0245786) - 0.000090537;
    const denominator = value * (0.983729 * value + 0.432951) + 0.238081;

    curve[channel] = numerator / denominator;
  }

  const mapped = applyMatrix(ACES_OUTPUT_COLUMNS, curve);

  for (let channel = 0; channel < 3; channel += 1) {
    result[channel] = Math.round(srgbFromTable(mapped[channel]) * 255);
  }

  return [result[0], result[1], result[2]];
}

/** Софтбокс глазами отражения: направление, яркость и граница блика. */
type StudioPanel = {
  /** Куда смотрит панель из центра студии. */
  direction: StudioVector;
  /** Яркость панели в линейных единицах, уже с интенсивностью окружения. */
  radiance: StudioLinear;
  /** Косинус углового радиуса: за ним блик кончается. */
  cosLimit: number;
};

/**
 * Панели окружения, подготовленные к расчёту отражений.
 *
 * Границей блика служит удвоенный угловой радиус панели — так крупный софтбокс
 * даёт широкое пятно, а узкая полоса длинную линию вдоль силуэта. Внутри
 * границы яркость падает по квадрату косинуса: дешевле гаусса, а на глаз то же
 * самое. Интенсивность окружения уже входит в яркость.
 */
const PANEL_LIGHTS: readonly StudioPanel[] = STUDIO_ENVIRONMENT.panels.map(
  (panel) => {
    const length =
      Math.hypot(panel.position[0], panel.position[1], panel.position[2]) || 1;
    const halfSize = 0.5 * Math.max(panel.size[0], panel.size[1]);
    const spread = Math.atan(halfSize / length);

    return {
      direction: normalizeVector(panel.position),
      radiance: multiplyLinear(
        hexToLinear(panel.color),
        panel.power * STUDIO_ENVIRONMENT.intensity,
      ),
      cosLimit: Math.cos(Math.min(Math.PI * 0.9, spread * 2.2)),
    };
  },
);

/** Фон виртуальной студии в линейных единицах: он виден в отражениях. */
const ENVIRONMENT_BACKGROUND = multiplyLinear(
  hexToLinear(STUDIO_ENVIRONMENT.background),
  STUDIO_ENVIRONMENT.intensity,
);

/**
 * Яркость виртуальной студии в направлении `direction`.
 *
 * Это то, что видит отражение на керамике: тёмный фон плюс четыре панели.
 * `PMREMGenerator` в WebGL считает то же самое честно, здесь хватает суммы по
 * панелям — блики нужны мягкие, а не точные.
 *
 * Нормировать направление не нужно: панели сравниваются по косинусу, а он
 * считается на векторе любой длины. Функция вызывается на каждую грань, и
 * лишний `hypot` в ней стоил бы дороже самого блика.
 */
export function studioEnvironmentRadiance(
  direction: StudioVector,
): StudioLinear {
  const length = Math.hypot(direction[0], direction[1], direction[2]) || 1;
  const x = direction[0] / length;
  const y = direction[1] / length;
  const z = direction[2] / length;
  let red = ENVIRONMENT_BACKGROUND[0];
  let green = ENVIRONMENT_BACKGROUND[1];
  let blue = ENVIRONMENT_BACKGROUND[2];

  for (const panel of PANEL_LIGHTS) {
    const cosine =
      x * panel.direction[0] + y * panel.direction[1] + z * panel.direction[2];

    if (cosine <= panel.cosLimit) {
      continue;
    }

    const edge = (cosine - panel.cosLimit) / (1 - panel.cosLimit);
    const falloff = edge * edge;

    red += panel.radiance[0] * falloff;
    green += panel.radiance[1] * falloff;
    blue += panel.radiance[2] * falloff;
  }

  return [red, green, blue];
}

/**
 * Облучённость от окружения: средняя яркость студии по сфере, умноженная на π.
 *
 * Направления берутся по спирали Фибоначчи: выборка равномерная и без
 * случайности, поэтому один параметр модели даёт один и тот же кадр байт в
 * байт. Для рассеянного света хватает 512 точек — панели размыты.
 */
function environmentIrradiance(): StudioLinear {
  const samples = 512;
  const golden = Math.PI * (3 - Math.sqrt(5));
  let red = 0;
  let green = 0;
  let blue = 0;

  for (let index = 0; index < samples; index += 1) {
    const y = 1 - (2 * (index + 0.5)) / samples;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = index * golden;
    const radiance = studioEnvironmentRadiance([
      Math.cos(phi) * ring,
      y,
      Math.sin(phi) * ring,
    ]);

    red += radiance[0];
    green += radiance[1];
    blue += radiance[2];
  }

  const average = Math.PI / samples;

  return [red * average, green * average, blue * average];
}

/** Готовая облучённость окружения: считается один раз на загрузку модуля. */
const ENVIRONMENT_IRRADIANCE: StudioLinear = environmentIrradiance();

/** Керамика в линейных единицах: цвет материала один раз на всю работу. */
const CERAMIC_LINEAR: StudioLinear = hexToLinear(STUDIO_CERAMIC.color);

/** Линейные цвета и направления трёх источников, по одному разу на загрузку. */
const DIRECT_LIGHTS = [
  {
    direction: studioLightDirection(STUDIO_LIGHTS.key.position),
    color: multiplyLinear(
      hexToLinear(STUDIO_LIGHTS.key.color),
      STUDIO_LIGHTS.key.intensity,
    ),
  },
  {
    direction: studioLightDirection(STUDIO_LIGHTS.fill.position),
    color: multiplyLinear(
      hexToLinear(STUDIO_LIGHTS.fill.color),
      STUDIO_LIGHTS.fill.intensity,
    ),
  },
  {
    direction: studioLightDirection(STUDIO_LIGHTS.rim.position),
    color: multiplyLinear(
      hexToLinear(STUDIO_LIGHTS.rim.color),
      STUDIO_LIGHTS.rim.intensity,
    ),
  },
] as const;

/** Небо и стол полусферы в линейных единицах. */
const HEMISPHERE_SKY = multiplyLinear(
  hexToLinear(STUDIO_LIGHTS.hemisphere.sky),
  STUDIO_LIGHTS.hemisphere.intensity,
);
const HEMISPHERE_GROUND = multiplyLinear(
  hexToLinear(STUDIO_LIGHTS.hemisphere.ground),
  STUDIO_LIGHTS.hemisphere.intensity,
);

/** Отражение вектора от нормали: куда смотрит блик со стороны поверхности. */
function reflectDirection(
  vector: StudioVector,
  normal: StudioVector,
): StudioVector {
  const dot =
    vector[0] * normal[0] + vector[1] * normal[1] + vector[2] * normal[2];

  return [
    vector[0] - 2 * dot * normal[0],
    vector[1] - 2 * dot * normal[1],
    vector[2] - 2 * dot * normal[2],
  ];
}

/** Доля глазури, которая уходит в отражение: шероховатый слой отражает слабее. */
const GLAZE_GAIN =
  STUDIO_CERAMIC.clearcoat * (1 - STUDIO_CERAMIC.clearcoatRoughness * 0.6);

/**
 * Цвет керамики в точке с нормалью `normal` при взгляде из `eye`.
 *
 * Считается по тем же правилам, что `MeshPhysicalMaterial` в сцене: сумма
 * трёх источников и окружения с делением на π, затем слой глазури —
 * отражение смотрит в виртуальные софтбоксы и складывается с Френелем Шлика
 * и узким бликом ключевого света. Завершает ACES с экспозицией студии.
 *
 * Затенение плоское: нормаль у треугольника одна. Рельеф читается гранями, а
 * не градиентом, и это же качество держит превью дешёвым.
 */
export function studioSurfaceColor(
  normal: StudioVector,
  eye: StudioVector,
): StudioRgb {
  const n = asUnit(normal);
  const view = asUnit(eye);
  const up = 0.5 + 0.5 * n[1];
  let irradianceRed =
    HEMISPHERE_GROUND[0] +
    (HEMISPHERE_SKY[0] - HEMISPHERE_GROUND[0]) * up +
    ENVIRONMENT_IRRADIANCE[0];
  let irradianceGreen =
    HEMISPHERE_GROUND[1] +
    (HEMISPHERE_SKY[1] - HEMISPHERE_GROUND[1]) * up +
    ENVIRONMENT_IRRADIANCE[1];
  let irradianceBlue =
    HEMISPHERE_GROUND[2] +
    (HEMISPHERE_SKY[2] - HEMISPHERE_GROUND[2]) * up +
    ENVIRONMENT_IRRADIANCE[2];

  for (const light of DIRECT_LIGHTS) {
    const cosine =
      n[0] * light.direction[0] +
      n[1] * light.direction[1] +
      n[2] * light.direction[2];

    if (cosine <= 0) {
      continue;
    }

    irradianceRed += cosine * light.color[0];
    irradianceGreen += cosine * light.color[1];
    irradianceBlue += cosine * light.color[2];
  }

  const reciprocal = 1 / Math.PI;
  let red = CERAMIC_LINEAR[0] * irradianceRed * reciprocal;
  let green = CERAMIC_LINEAR[1] * irradianceGreen * reciprocal;
  let blue = CERAMIC_LINEAR[2] * irradianceBlue * reciprocal;

  // Глазурь: отражённый луч уходит в студию, Френель добавляет яркость краю.
  const reflected = studioEnvironmentRadiance(
    reflectDirection([-view[0], -view[1], -view[2]], n),
  );
  const facing = Math.max(
    0,
    n[0] * view[0] + n[1] * view[1] + n[2] * view[2],
  );
  const fresnel = 0.04 + 0.96 * (1 - facing) ** 5;
  const glaze = GLAZE_GAIN * fresnel;

  red += reflected[0] * glaze;
  green += reflected[1] * glaze;
  blue += reflected[2] * glaze;

  // Узкий блик ключа: сам источник в окружение не входит, его добавляем руками.
  const key = DIRECT_LIGHTS[0].direction;
  const half = normalizeVector([
    view[0] + key[0],
    view[1] + key[1],
    view[2] + key[2],
  ]);
  const sheen =
    Math.max(0, n[0] * half[0] + n[1] * half[1] + n[2] * half[2]) ** 80 * 0.2;

  red += DIRECT_LIGHTS[0].color[0] * sheen;
  green += DIRECT_LIGHTS[0].color[1] * sheen;
  blue += DIRECT_LIGHTS[0].color[2] * sheen;

  return studioToneMap([red, green, blue]);
}
