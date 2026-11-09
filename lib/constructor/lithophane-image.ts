/**
 * Кадр литофана: что это за картинка и как она ложится на плиту.
 *
 * Режим вписывания пользователь не выбирает: браузер сам решает, фотография
 * это или логотип, и от решения зависят и посадка на плиту, и толщины.
 *
 *   `photo` — снимок без прозрачного фона (JPG, PNG с непрозрачной альфой).
 *             Кадр виден целиком: он вписывается по меньшей стороне, а поля по
 *             краям печатаются на минимальной толщине и на просвет остаются
 *             светлыми. Прежнее правило cover резало края кадра — владелец
 *             заметил, что загруженный котёнок обрезан.
 *   `logo`  — PNG с прозрачным фоном. Прозрачные поля обрезаются, поэтому знак
 *             занимает панель максимально крупно, а сам фон печатается на
 *             минимальной толщине (прозрачность и есть фон). Контраст знака
 *             усилен: минимум 0.6 мм, максимум 3.5 мм, иначе логотип сливался
 *             с фоном.
 *
 * Модуль чистый: ни canvas, ни React, ни three.js. Пиксели приходят массивом
 * RGBA, выходят числа. Поэтому правила проверяются в Node тем же кодом, что
 * работает в браузере, в предпросмотре и на сервере.
 */

/** Что за картинка пришла: снимок или логотип с прозрачным фоном. */
export type LithophaneImageKind = "photo" | "logo";

/**
 * Доля прозрачных пикселей, с которой кадр считается логотипом.
 *
 * 2 % — это уже осмысленный фон: у PNG-снимка с прозрачными уголками столько не
 * набирается, а у знака с полями вокруг рисунка — с большим запасом.
 */
export const LITHOPHANE_LOGO_MIN_TRANSPARENT_SHARE = 0.02;

/**
 * Доля прозрачных пикселей, выше которой снимок перестаёт быть снимком.
 *
 * PNG-фотографию иногда сохраняют с прозрачным фоном вокруг кадра: её вырезали
 * из макета. Четверть прозрачного — это уже вырезанный знак, а не снимок.
 */
export const LITHOPHANE_PHOTO_TRANSPARENT_SHARE_MAX = 0.25;

/**
 * Пропорции, по которым узнаётся снимок: 4:3, 3:2 и 16:9.
 *
 * Проверка вторая, а не первая: кадр 4:3 с прозрачными полями вокруг всё равно
 * фотография, а квадратный знак 1:1 — логотип.
 */
export const LITHOPHANE_PHOTO_ASPECTS: readonly number[] = [
  4 / 3,
  3 / 2,
  16 / 9,
];

/** Насколько пропорция может уйти от 4:3, 3:2 или 16:9 и остаться снимком. */
export const LITHOPHANE_PHOTO_ASPECT_TOLERANCE = 0.12;

/**
 * Минимальная толщина логотипа, мм.
 *
 * 0.6 мм — нижняя граница слайдера после этой правки. Тоньше пластик рвётся в
 * печати, а на просвет фон и так светлый: 0.6 мм даёт заметный контраст со
 * знаком 3.5 мм.
 */
export const LITHOPHANE_LOGO_MIN_THICKNESS_MM = 0.6;

/** Максимальная толщина логотипа, мм: знак читается, а печать не растягивается. */
export const LITHOPHANE_LOGO_MAX_THICKNESS_MM = 3.5;

/**
 * Порог альфы, начиная с которого пиксель считается краской.
 *
 * Ниже 16 — мягкая тень от антиалиасинга: она не должна попадать в габарит
 * обрезки, иначе вокруг знака останется светлая кайма в пиксель.
 */
export const LITHOPHANE_ALPHA_VISIBLE = 16;

/** Порог альфы, начиная с которого пиксель считается непрозрачным. */
export const LITHOPHANE_ALPHA_OPAQUE = 128;

/**
 * Сколько пикселей остаётся за габаритом знака при обрезке прозрачных полей.
 *
 * Один пиксель — мягкий край антиалиасинга: без него буквы обрезались бы по
 * контуру и теряли полутон.
 */
export const LITHOPHANE_TRIM_PADDING_PX = 1;

/**
 * Похожи ли пропорции на снимок: 4:3, 3:2 или 16:9 с допуском 12 %.
 *
 * Допуск широкий нарочно: кадр телефона приходит и 4:3, и 3:2, и полноэкранным
 * 16:9, а снимок после обрезки в редакторе — 1.5 с точностью до процента.
 */
export function isPhotoAspectRatio(width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) {
    return false;
  }

  const aspect = width / height;

  return LITHOPHANE_PHOTO_ASPECTS.some(
    (known) =>
      Math.abs(aspect - known) <= known * LITHOPHANE_PHOTO_ASPECT_TOLERANCE,
  );
}

/**
 * Фотография это или логотип.
 *
 * Порядок проверок: прозрачность меньше 2 % — снимок, тут решать нечего. Дальше
 * смотрят пропорции: снимок 4:3 или 16:9 с небольшой прозрачностью (уголки,
 * вырезанный кадр) остаётся снимком, а знак с прозрачным фоном — логотип.
 */
export function lithophaneImageKind(
  transparentShare: number,
  width: number,
  height: number,
): LithophaneImageKind {
  if (!(transparentShare >= LITHOPHANE_LOGO_MIN_TRANSPARENT_SHARE)) {
    return "photo";
  }

  if (
    transparentShare < LITHOPHANE_PHOTO_TRANSPARENT_SHARE_MAX &&
    isPhotoAspectRatio(width, height)
  ) {
    return "photo";
  }

  return "logo";
}

/** Прямоугольник кадра в долях плиты: левый край, верх, ширина и высота. */
export type LithophaneFitRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Как кадр ложится на плиту по правилу contain.
 *
 * Фото вписывается целиком: длинная сторона кадра упирается в свою сторону
 * плиты, короткая занимает столько же, а разница уходит в поля. Пиксель
 * остаётся квадратным, лицо не растягивается, обрезки нет. Возвращаются доли
 * плиты, поэтому функция годится и для миллиметров геометрии, и для пикселей
 * карты свечения.
 */
export function lithophaneContainRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): LithophaneFitRect {
  const sourceAspect =
    sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : 0;
  const targetAspect =
    targetWidth > 0 && targetHeight > 0 ? targetWidth / targetHeight : 0;

  if (!(sourceAspect > 0) || !(targetAspect > 0)) {
    return { left: 0, top: 0, width: 1, height: 1 };
  }

  // Кадр шире плиты — он упирается в ширину, поля остаются сверху и снизу.
  if (sourceAspect > targetAspect) {
    const height = targetAspect / sourceAspect;

    return { left: 0, top: (1 - height) / 2, width: 1, height };
  }

  // Кадр уже плиты — поля по бокам.
  const width = sourceAspect / targetAspect;

  return { left: (1 - width) / 2, top: 0, width, height: 1 };
}

/** Прямоугольник непрозрачной части кадра в пикселях сетки. */
export type LithophaneAlphaBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** Что показала альфа кадра: сколько в нём прозрачного и где краска. */
export type LithophaneAlphaStats = {
  /** Доля непрозрачных меньше половины пикселей — по ней выбирается вид. */
  transparentShare: number;
  /** Габарит краски без мягкого края; `null` — кадр прозрачный целиком. */
  bounds: LithophaneAlphaBounds | null;
};

/**
 * Разбор альфы кадра за один проход.
 *
 * Прозрачность и габарит считаются вместе, потому что оба нужны сразу: по доле
 * решается, логотип это или снимок, а по габариту обрезаются прозрачные поля.
 * Второй проход по 160 000 пикселей на каждую загрузку — лишняя работа в главном
 * потоке браузера.
 *
 * Кадр без альфа-канала (JPG) даёт нулевую прозрачность и полный габарит: у
 * такого изображения alpha = 255 во всех пикселях.
 */
export function lithophaneAlphaStats(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
): LithophaneAlphaStats {
  if (!(width > 0) || !(height > 0)) {
    return { transparentShare: 0, bounds: null };
  }

  let transparent = 0;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const alpha = pixels[(row * width + column) * 4 + 3] ?? 255;

      if (alpha < LITHOPHANE_ALPHA_OPAQUE) {
        transparent += 1;
      }

      if (alpha < LITHOPHANE_ALPHA_VISIBLE) {
        continue;
      }

      left = Math.min(left, column);
      top = Math.min(top, row);
      right = Math.max(right, column);
      bottom = Math.max(bottom, row);
    }
  }

  return {
    transparentShare: transparent / (width * height),
    bounds: right < 0 ? null : { left, top, right, bottom },
  };
}

/**
 * Габарит краски с запасом на мягкий край, в пикселях кадра.
 *
 * Прозрачные поля вокруг знака съедают место на панели: логотип с полями по
 * трети кадра печатался бы вдвое мельче, чем мог. Запасный пиксель держит
 * антиалиасинг, поэтому буквы не обрезаются по контуру.
 */
export function lithophaneTrimBounds(
  bounds: LithophaneAlphaBounds,
  width: number,
  height: number,
): LithophaneAlphaBounds {
  return {
    left: Math.max(0, bounds.left - LITHOPHANE_TRIM_PADDING_PX),
    top: Math.max(0, bounds.top - LITHOPHANE_TRIM_PADDING_PX),
    right: Math.min(width - 1, bounds.right + LITHOPHANE_TRIM_PADDING_PX),
    bottom: Math.min(height - 1, bounds.bottom + LITHOPHANE_TRIM_PADDING_PX),
  };
}

/** Сетка яркости, из которой собирается карта свечения. */
export type LithophaneGlowSource = {
  brightness: number[];
  width: number;
  height: number;
};

/** Пиксели карты свечения вместе с её размерами. */
export type LithophaneGlowPixels = {
  pixels: Uint8Array;
  width: number;
  height: number;
};

/**
 * Пиксели карты свечения под пропорции плиты.
 *
 * Подсветка накладывается по uv, а uv рельефа идут по плите: кадр вписан, поля
 * остаются светлыми. Поэтому текстура повторяет плиту целиком: кадр по центру,
 * поля залиты белым — на просвет они и должны светиться, ведь их толщина
 * минимальна. Кадр уже плиты по одной оси, значит текстура только шире или уже
 * исходной сетки: уменьшать нечего, лишние пиксели — это и есть поля.
 */
export function lithophaneGlowPixels(
  grid: LithophaneGlowSource,
  plateWidth: number,
  plateHeight: number,
): LithophaneGlowPixels {
  const fit = lithophaneContainRect(
    grid.width,
    grid.height,
    plateWidth,
    plateHeight,
  );
  const width = Math.max(grid.width, Math.round(grid.width / fit.width));
  const height = Math.max(grid.height, Math.round(grid.height / fit.height));
  const left = Math.floor((width - grid.width) / 2);
  const top = Math.floor((height - grid.height) / 2);
  // 255 во всех каналах: поля светятся так же, как самый тонкий пластик.
  const pixels = new Uint8Array(width * height * 4).fill(255);

  for (let row = 0; row < grid.height; row += 1) {
    for (let column = 0; column < grid.width; column += 1) {
      const value = Math.round(
        Math.min(255, Math.max(0, grid.brightness[row * grid.width + column])),
      );
      const offset = ((row + top) * width + column + left) * 4;

      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }
  }

  return { pixels, width, height };
}
