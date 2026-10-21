"use client";

import Link from "next/link";
import { useId, useRef, useState, useEffect, type ChangeEvent } from "react";

import { NumberSlider } from "@/components/constructor/NumberSlider";
import { ParameterSelect } from "@/components/constructor/ParameterSelect";
import { FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH } from "@/lib/constructor/downloads";
import {
  BOX_CELL_MAX_MM,
  BOX_CELL_MIN_MM,
  BOX_PRESET_IDS,
  BOX_PRESET_LABELS,
  CONSTRUCTOR_LIMITS,
  DEFAULT_LITHOPHANE_PARAMS,
  KEYCHAIN_SHAPES,
  KEYCHAIN_SHAPE_LABELS,
  KEYCHAIN_SVG_MAX_LENGTH,
  KEYCHAIN_TEXT_MAX_LENGTH,
  hasDrawableSvgData,
  isCustomSvgData,
  LAMP_BASE_SHAPES,
  LAMP_BASE_SHAPE_LABELS,
  LAMP_MOUNTS,
  LITHOPHANE_MOUNTS,
  LITHOPHANE_MOUNT_LABELS,
  LITHOPHANE_PIXEL_COUNT,
  LITHOPHANE_RESOLUTION,
  LAMP_MOUNT_LABELS,
  MODEL_TYPE_LABELS,
  SIGN_CHANNEL_WIDTHS,
  SIGN_FONTS,
  SIGN_FONT_LABELS,
  SIGN_TEXT_MAX_LENGTH,
  VASE_PATTERNS,
  VASE_PATTERN_LABELS,
  VASE_SHAPES,
  VASE_SHAPE_LABELS,
  sanitizeKeychainText,
  sanitizeSignText,
  type BoxPresetId,
  type ConstructorParams,
  type KeychainShape,
  type LampBaseShape,
  type LampMount,
  type LithophaneMount,
  type ModelType,
  type SignChannelWidth,
  type SignFont,
  type VasePattern,
  type VaseShape,
} from "@/lib/constructor/params";

/** Числовые параметры: форму, узор и текст меняют отдельные обработчики. */
type SizeParam = Exclude<
  keyof ConstructorParams,
  | "model"
  | "shape"
  | "pattern"
  | "shapeType"
  | "text"
  | "lampPattern"
  | "lampMount"
  | "lampBaseShape"
  | "signText"
  | "signFont"
  | "signChannelWidth"
  | "signBaseMount"
  | "hasLid"
  | "lithoFrame"
  | "lithoMount"
  | "lithophaneBrightness"
>;

/** Ошибка экспорта и действие, которое поможет её исправить. */
export type StlExportError = {
  message: string;
  action: "pro" | "login" | null;
};

/**
 * Файл, который предлагает панель.
 *
 * Первый файл в списке — главный: у светильника это сборка, у вывески — вся
 * надпись. Остальные кнопки отдают детали по отдельности: основание и абажур
 * печатаются разными деталями, буквы вывески — тоже. `request` уходит в API
 * поверх параметров модели, поэтому панель не знает, как они называются.
 */
export type StlExportOption = {
  /** Уникальный ключ: по нему видно, на какой кнопке крутится спиннер. */
  id: string;
  /** Текст кнопки. */
  label: string;
  /** Подпись для скринридера, если текст кнопки слишком короткий («А»). */
  description?: string;
  /** Дополнительные поля запроса: `part` светильника или `letter` вывески. */
  request: Record<string, number | string>;
  /** Имя файла, если сервер не прислал Content-Disposition. */
  fileName: string;
};

type ParameterPanelProps = {
  params: ConstructorParams;
  /** Есть ли действующий доступ Pro: у Pro лимита на STL нет. */
  hasPro: boolean;
  /** Остаток бесплатных скачиваний; у Pro не используется. */
  freeDownloadsLeft: number;
  /** Какой файл сейчас генерируется; null — запросов нет. */
  exportingId: string | null;
  /** Что можно скачать для текущей модели: сборка и отдельные детали. */
  exportOptions: StlExportOption[];
  /** Ошибка последней попытки скачивания; null — ошибок нет. */
  exportError: StlExportError | null;
  /** Запрос к серверному экспорту STL для выбранного файла. */
  onExport: (option: StlExportOption) => void;
  onParamChange: (key: SizeParam, value: number) => void;
  onModelChange: (model: ModelType) => void;
  onShapeChange: (shape: VaseShape) => void;
  onPatternChange: (pattern: VasePattern) => void;
  onKeychainShapeChange: (shape: KeychainShape) => void;
  /** Свой SVG-контур: текст SVG или SVG, собранный из загруженной картинки. */
  onCustomSvgChange: (svg: string) => void;
  /** Карман под NFC-метку в теле брелока. */
  onNfcChange: (enabled: boolean) => void;
  onTextChange: (text: string) => void;
  onLampPatternChange: (pattern: VasePattern) => void;
  onLampMountChange: (mount: LampMount) => void;
  onLampBaseShapeChange: (shape: LampBaseShape) => void;
  onSignTextChange: (text: string) => void;
  onSignFontChange: (font: SignFont) => void;
  onSignChannelWidthChange: (width: SignChannelWidth) => void;
  onSignBaseMountChange: (mount: boolean) => void;
  onHasLidChange: (hasLid: boolean) => void;
  /** Ширины или высоты ячеек коробки, введённые через запятую. */
  onBoxCellsChange: (axis: "x" | "y", cells: number[]) => void;
  /** Готовый набор ячеек и габаритов коробки. */
  onBoxPresetChange: (preset: BoxPresetId) => void;
  /** Рамка литофана: отдельная деталь с пазом под плиту. */
  onLithoFrameChange: (hasFrame: boolean) => void;
  /** Крепление литофана: подставка, настенные петли или ничего. */
  onLithoMountChange: (mount: LithophaneMount) => void;
  /** Готовая яркость 150 × 150 из canvas: 0 — чёрный, 255 — белый. */
  onLithophaneBrightnessChange: (brightness: number[]) => void;
  onReset: () => void;
};

/** Ошибка экспорта с подсказкой: войти заново или оформить Pro. */
function ExportErrorAlert({ error }: { error: StlExportError | null }) {
  if (!error) {
    return null;
  }

  return (
    <div
      className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
      role="alert"
    >
      <p>{error.message}</p>
      {error.action === "pro" ? (
        <Link
          className="mt-2 inline-flex font-semibold text-amber-200 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          href="/subscription#tools"
        >
          Оформить подписку Pro
        </Link>
      ) : null}
      {error.action === "login" ? (
        <Link
          className="mt-2 inline-flex font-semibold text-amber-200 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          href="/auth/login?next=%2Fconstructor"
        >
          Войти заново
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Кнопки скачивания: главный файл и детали по отдельности.
 *
 * Первый файл — главный: лицо первого блока вывески или собранный литофан.
 * У светильника сборки нет: база идёт крупной кнопкой, плафон — компактной.
 * Остальные кнопки подписаны деталью — «Блок 1: Крышка», «Рамка» или
 * «Подставка». Пока один файл генерируется, остальные заблокированы, а спиннер
 * крутится только на нажатой кнопке.
 */
function ExportButtons({
  options,
  exportingId,
  partsHeading,
  onExport,
}: {
  options: StlExportOption[];
  exportingId: string | null;
  /** Заголовок над компактными кнопками: детали светильника или блоков. */
  partsHeading: string | null;
  onExport: (option: StlExportOption) => void;
}) {
  const [primary, ...parts] = options;

  if (!primary) {
    return null;
  }

  const isExporting = exportingId !== null;

  return (
    <>
      <button
        aria-busy={exportingId === primary.id}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-wait disabled:bg-blue-600/60 disabled:text-white/80 disabled:shadow-none"
        disabled={isExporting}
        onClick={() => onExport(primary)}
        type="button"
      >
        {exportingId === primary.id ? (
          <>
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
            />
            Генерация…
          </>
        ) : (
          primary.label
        )}
      </button>

      {parts.length > 0 ? (
        <div className="mt-3">
          {partsHeading ? (
            <p className="text-[0.65rem] font-semibold tracking-wide text-slate-300 uppercase">
              {partsHeading}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {parts.map((option) => (
              <button
                aria-busy={exportingId === option.id}
                aria-label={option.description}
                className="inline-flex min-h-9 min-w-11 items-center justify-center rounded-full border border-white/15 px-3 text-sm font-semibold text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-wait disabled:text-slate-300/60"
                disabled={isExporting}
                key={option.id}
                onClick={() => onExport(option)}
                title={option.description}
                type="button"
              >
                {exportingId === option.id ? (
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  />
                ) : (
                  option.label
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Модель конструктора: идентификатор, иконка и подпись в списке. */
type ModelCard = { id: ModelType; icon: string; title: string };

const MODEL_CARDS: ModelCard[] = [
  { id: "vase", icon: "🏺", title: MODEL_TYPE_LABELS.vase },
  { id: "keychain", icon: "🔑", title: MODEL_TYPE_LABELS.keychain },
  { id: "lamp", icon: "💡", title: MODEL_TYPE_LABELS.lamp },
  { id: "sign", icon: "🪧", title: MODEL_TYPE_LABELS.sign },
  { id: "box", icon: "📦", title: MODEL_TYPE_LABELS.box },
  { id: "lithophane", icon: "🖼️", title: MODEL_TYPE_LABELS.lithophane },
];

/**
 * Пункты выпадающего списка моделей.
 *
 * Иконка осталась от прежних карточек: по ней модель узнаётся быстрее, чем по
 * названию, а в списке она занимает те же несколько символов.
 */
const MODEL_OPTIONS = MODEL_CARDS.map((card) => ({
  label: `${card.icon} ${card.title}`,
  value: card.id,
}));

/** Пояснение к выбранному силуэту: помогает выбрать форму без 3D-терминов. */
const SHAPE_HINTS: Record<VaseShape, string> = {
  classic:
    "Плавный силуэт: широкая нижняя часть, мягкое сужение и небольшой раструб кромки.",
  cone: "Почти прямой конус: широкое основание и узкая верхняя часть.",
  cylinder: "Ровные вертикальные стенки без сужения и раструба.",
  hourglass:
    "Песочные часы: широкая нижняя и верхняя часть с узкой талией посередине.",
  teardrop:
    "Капля: массивное основание, плавное сужение и округлённая верхняя часть.",
  double_bulb: "Двойная сфера: две выпуклости, разделённые мягкой талией.",
  square:
    "Квадратная: сечение в плане — квадрат с плоскими гранями и острыми углами, стенка остаётся ровной по толщине.",
  octagon:
    "Восьмигранная: восемь плоских граней, силуэт мягко сужается кверху.",
};

/** Пояснение к узору: что произойдёт со стенкой. */
const PATTERN_HINTS: Record<VasePattern, string> = {
  smooth: "Ровная стенка без рельефа — самый простой вариант для печати.",
  spiral:
    "Косая спираль: узор поднимается по стенке и дополнительно закручивается по высоте.",
  ribs: "Вертикальные рёбра: частота задаёт число гребней по окружности.",
  waves:
    "Горизонтальные волны: частота задаёт частоту кольцевых гребней по высоте.",
  honeycomb:
    "Соты: шестиугольные ячейки с плоским дном и чёткими рёбрами. Частота задаёт размер ячейки.",
  scales:
    "Чешуйки: перекрывающиеся округлые пластины со смещённым рядом. Частота задаёт размер чешуйки.",
};

/** Сжатая картинка: яркость для API и маленькое превью для панели. */
type LithophaneImage = {
  brightness: number[];
  preview: string;
};

/**
 * Сжимает выбранный файл до 150 × 150 и считает яркость пикселей.
 *
 * Полное фото нельзя класть в состояние: декодирование многомегапиксельного
 * кадра и передача его в three.js подвесили бы браузер. Canvas сразу уменьшает
 * картинку до 150 × 150, поэтому в React попадают только 22 500 чисел. Фон
 * заливается белым: прозрачные участки PNG не должны стать чёрными и
 * превратиться в самый толстый пластик. Квадрат вырезается из центра кадра,
 * чтобы не растягивать пропорции.
 */
async function compressLithophaneImage(
  file: File,
): Promise<LithophaneImage> {
  // Пустой MIME встречается у некоторых систем для обычного JPG. Такой файл
  // пропускаем до декодирования: canvas всё равно отклонит не-картинку.
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Выберите файл изображения: PNG, JPG или WebP.");
  }

  const bitmap = await createImageBitmap(file);

  try {
    if (bitmap.width < 1 || bitmap.height < 1) {
      throw new Error("Изображение пустое или повреждено.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = LITHOPHANE_RESOLUTION;
    canvas.height = LITHOPHANE_RESOLUTION;

    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("Браузер не смог подготовить canvas для изображения.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, LITHOPHANE_RESOLUTION, LITHOPHANE_RESOLUTION);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const sourceSize = Math.min(bitmap.width, bitmap.height);

    context.drawImage(
      bitmap,
      (bitmap.width - sourceSize) / 2,
      (bitmap.height - sourceSize) / 2,
      sourceSize,
      sourceSize,
      0,
      0,
      LITHOPHANE_RESOLUTION,
      LITHOPHANE_RESOLUTION,
    );

    const pixels = context.getImageData(
      0,
      0,
      LITHOPHANE_RESOLUTION,
      LITHOPHANE_RESOLUTION,
    ).data;
    const brightness = new Array<number>(LITHOPHANE_PIXEL_COUNT);

    for (let index = 0; index < LITHOPHANE_PIXEL_COUNT; index += 1) {
      const offset = index * 4;
      // Воспринимаемая яркость, а не среднее RGB: зелёный вносит наибольший
      // вклад, поэтому лица и трава не становятся неожиданно тёмными.
      brightness[index] = Math.round(
        0.2126 * pixels[offset] +
          0.7152 * pixels[offset + 1] +
          0.0722 * pixels[offset + 2],
      );
    }

    return {
      brightness,
      preview: canvas.toDataURL("image/jpeg", 0.82),
    };
  } finally {
    bitmap.close();
  }
}

/** Сетка перевода растровой картинки в контур: 96 × 96 даёт ровный силуэт. */
const CONTOUR_GRID_SIZE = 96;

/**
 * Предел числа прямоугольников контура.
 *
 * Сервер принимает SVG не длиннее 200 КБ. Каждый `<rect>` занимает около
 * 45 байт, поэтому 2400 полос — это ещё безопасный запас, а более подробная
 * картинка всё равно превратилась бы в кашу после масштабирования под брелок.
 */
const CONTOUR_MAX_RECTS = 2400;

/** Читает файл как текст: так приходит исходный SVG. */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Не удалось прочитать SVG. Попробуйте другой файл."));
      }
    };
    reader.onerror = () => {
      reject(new Error("Не удалось прочитать файл. Попробуйте ещё раз."));
    };
    reader.readAsText(file);
  });
}

/** Читает файл как data URL: картинку дальше рисует canvas. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Не удалось прочитать изображение."));
      }
    };
    reader.onerror = () => {
      reject(new Error("Не удалось прочитать файл. Попробуйте ещё раз."));
    };
    reader.readAsDataURL(file);
  });
}

/** Декодирует data URL в Image: createImageBitmap есть не во всех браузерах. */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Картинка повреждена или не читается."));
    image.src = dataUrl;
  });
}

/** Пиксель считается контуром, если он непрозрачный и не белый. */
function isContourPixel(pixels: Uint8ClampedArray, index: number): boolean {
  const alpha = pixels[index + 3];

  if (alpha < 128) {
    return false;
  }

  const luminance =
    0.299 * pixels[index] +
    0.587 * pixels[index + 1] +
    0.114 * pixels[index + 2];

  // Светлый фон фотографии не должен стать силуэтом: контуром считается
  // только заметно тёмная и непрозрачная часть кадра.
  return luminance < 200;
}

/**
 * Переводит картинку в SVG из горизонтальных полос.
 *
 * Полноценная трассировка кривых в браузере не нужна: брелок печатается
 * размером 30–100 мм, поэтому сетка 96 × 96 и склейка соседних пикселей в
 * полосы дают узнаваемый контур. Полосы — обычные `<rect>`, которые разбирает
 * серверный svg-outline.ts, а прозрачный фон PNG и белый фон JPG не попадают
 * в силуэт.
 */
async function rasterToContourSvg(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const size = Math.min(image.naturalWidth, image.naturalHeight);

  if (size < 1) {
    throw new Error("Изображение пустое или повреждено.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = CONTOUR_GRID_SIZE;
  canvas.height = CONTOUR_GRID_SIZE;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Браузер не смог подготовить canvas для контура.");
  }

  // Центральный квадрат сохраняет пропорции: вытянутое фото не растянется.
  context.drawImage(
    image,
    (image.naturalWidth - size) / 2,
    (image.naturalHeight - size) / 2,
    size,
    size,
    0,
    0,
    CONTOUR_GRID_SIZE,
    CONTOUR_GRID_SIZE,
  );

  const pixels = context.getImageData(
    0,
    0,
    CONTOUR_GRID_SIZE,
    CONTOUR_GRID_SIZE,
  ).data;
  const rects: string[] = [];

  for (let y = 0; y < CONTOUR_GRID_SIZE; y += 1) {
    let runStart = -1;

    for (let x = 0; x <= CONTOUR_GRID_SIZE; x += 1) {
      const inked =
        x < CONTOUR_GRID_SIZE &&
        isContourPixel(pixels, (y * CONTOUR_GRID_SIZE + x) * 4);

      if (inked && runStart < 0) {
        runStart = x;
      }

      if (!inked && runStart >= 0) {
        rects.push(
          `<rect x="${runStart}" y="${y}" width="${x - runStart}" height="1"/>`,
        );
        runStart = -1;
      }
    }
  }

  if (rects.length === 0) {
    throw new Error(
      "На картинке не найден контур: нужен тёмный силуэт на светлом фоне.",
    );
  }

  if (rects.length > CONTOUR_MAX_RECTS) {
    throw new Error(
      "Слишком сложная картинка. Загрузите логотип с крупным силуэтом или готовый SVG.",
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CONTOUR_GRID_SIZE} ${CONTOUR_GRID_SIZE}">${rects.join("")}</svg>`;
}

/** SVG берём как текст, PNG и JPG переводим в контур на клиенте. */
async function keychainContourFromFile(file: File): Promise<string> {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);

  // Лимит сервера считает символы, а file.size — байты. Кириллица в тексте
  // SVG весит больше, поэтому грубая проверка ловит только явный перебор;
  // точную проверку всё равно делает isCustomSvgData ниже.
  if (isSvg && file.size > KEYCHAIN_SVG_MAX_LENGTH) {
    throw new Error(
      "SVG больше 200 КБ. Упростите контур или сохраните файл без встроенных картинок.",
    );
  }

  const svg = isSvg
    ? await readFileAsText(file)
    : await rasterToContourSvg(file);

  if (!isCustomSvgData(svg)) {
    throw new Error(
      "Файл слишком большой или содержит скрипты. Нужен SVG до 200 КБ.",
    );
  }

  if (!hasDrawableSvgData(svg)) {
    throw new Error(
      "В файле нет контура. Нужен SVG с path, polygon, rect, circle или ellipse.",
    );
  }

  return svg;
}

/**
 * Разбирает строку «20, 40, 20» в ширины ячеек.
 *
 * Пустые куски после запятой игнорируются, чтобы «20, » не считался ошибкой
 * во время набора. Ноль, отрицательное число и выход за 5–220 мм отклоняются:
 * геометрия делит свободное место пропорционально, и нулевая ячейка сломала бы
 * расчёт.
 */
function parseBoxCellsInput(value: string): number[] | null {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (
    parts.length < CONSTRUCTOR_LIMITS.boxGrid.min ||
    parts.length > CONSTRUCTOR_LIMITS.boxGrid.max
  ) {
    return null;
  }

  const cells = parts.map((part) => Number(part));

  if (
    cells.some(
      (cell) =>
        !Number.isFinite(cell) ||
        cell < BOX_CELL_MIN_MM ||
        cell > BOX_CELL_MAX_MM,
    )
  ) {
    return null;
  }

  return cells;
}

/** Обратное представление массива ячеек для поля ввода. */
function formatBoxCells(cells: readonly number[]): string {
  return cells.join(", ");
}

/**
 * Панель параметров модели.
 *
 * Тип модели и её варианты (форма, узор, патрон, шрифт, канал, крепление)
 * выбираются выпадающими списками, размеры меняют слайдеры, а имя, надпись и
 * фото — текстовое поле и загрузка файла. У брелока появляются длина, ширина,
 * толщина, силуэт, своя загрузка контура и карман под NFC-метку. У светильника
 * выбирают патрон и узор, у вывески — надпись, кегль, выступ букв и ширину
 * канала под ленту, у коробки — пресеты, ширины ячеек текстом, размеры, стенку
 * и крышку, у литофана — фото, превью и толщины.
 * Параметры компонент не хранит: они приходят из ConstructorClient, поэтому
 * 3D-сцена и подписи всегда читают один и тот же объект. Локальное состояние
 * есть только у загрузки изображения — текст ошибки и превью на время сеанса.
 */
export function ParameterPanel({
  params,
  hasPro,
  freeDownloadsLeft,
  exportingId,
  exportOptions,
  exportError,
  onExport,
  onParamChange,
  onModelChange,
  onShapeChange,
  onPatternChange,
  onKeychainShapeChange,
  onCustomSvgChange,
  onNfcChange,
  onTextChange,
  onLampPatternChange,
  onLampMountChange,
  onLampBaseShapeChange,
  onSignTextChange,
  onSignFontChange,
  onSignChannelWidthChange,
  onSignBaseMountChange,
  onHasLidChange,
  onBoxCellsChange,
  onBoxPresetChange,
  onLithoFrameChange,
  onLithoMountChange,
  onLithophaneBrightnessChange,
  onReset,
}: ParameterPanelProps) {
  const isExporting = exportingId !== null;
  const textInputId = useId();
  const textHintId = `${textInputId}-hint`;
  const textLength = Array.from(params.text).length;
  const signTextInputId = useId();
  const signTextHintId = `${signTextInputId}-hint`;
  const signTextLength = Array.from(params.signText).length;
  const lithophaneInputId = useId();
  const lithophaneHintId = `${lithophaneInputId}-hint`;
  const keychainContourInputId = useId();
  const keychainContourHintId = `${keychainContourInputId}-hint`;
  const boxCellsXInputId = useId();
  const boxCellsYInputId = useId();
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessingContour, setIsProcessingContour] = useState(false);
  const [contourError, setContourError] = useState<string | null>(null);
  const [contourFileName, setContourFileName] = useState<string | null>(null);
  const [cellsXText, setCellsXText] = useState(() =>
    formatBoxCells(params.cellsX),
  );
  const [cellsYText, setCellsYText] = useState(() =>
    formatBoxCells(params.cellsY),
  );
  /**
   * Последний набор ячеек, который пришёл в состояние.
   *
   * Поле ввода хранит текст как есть, чтобы можно было набрать «20, 40» без
   * подмены на середине. Синхронизация нужна только когда ячейки поменял не
   * текст, а пресет или слайдер количества: тогда ref отличается от параметров.
   */
  const appliedCellsX = useRef(formatBoxCells(params.cellsX));
  const appliedCellsY = useRef(formatBoxCells(params.cellsY));

  useEffect(() => {
    const signature = params.cellsX.join(",");

    if (signature !== appliedCellsX.current) {
      appliedCellsX.current = signature;
      setCellsXText(formatBoxCells(params.cellsX));
    }
  }, [params.cellsX]);

  useEffect(() => {
    const signature = params.cellsY.join(",");

    if (signature !== appliedCellsY.current) {
      appliedCellsY.current = signature;
      setCellsYText(formatBoxCells(params.cellsY));
    }
  }, [params.cellsY]);

  /**
   * Сброс всех параметров очищает customSvgData, но имя файла живёт в панели.
   * Без синхронизации плашка «Контур: logo.svg» осталась бы на пустом месте.
   */
  useEffect(() => {
    if (!params.customSvgData) {
      setContourFileName(null);
    }
  }, [params.customSvgData]);

  /**
   * Демонстрационный массив живёт в DEFAULT_LITHOPHANE_PARAMS и после сброса
   * возвращается по ссылке. Сравнение ссылок показывает, загружено ли фото,
   * не копируя 22 500 чисел при каждой отрисовке.
   */
  const hasUploadedImage =
    params.lithophaneBrightness !==
    DEFAULT_LITHOPHANE_PARAMS.lithophaneBrightness;

  /**
   * Читает файл, сразу сжимает его и отдаёт яркость наверх.
   *
   * Поле очищается до await: иначе повторный выбор того же файла не вызвал бы
   * change. Ошибка остаётся в панели и не ломает уже загруженный рельеф.
   */
  async function handleLithophaneImageChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    setIsProcessingImage(true);
    setImageError(null);

    try {
      const image = await compressLithophaneImage(file);

      setImagePreview(image.preview);
      onLithophaneBrightnessChange(image.brightness);
    } catch (error) {
      setImageError(
        error instanceof Error
          ? error.message
          : "Не удалось обработать изображение. Попробуйте другой файл.",
      );
    } finally {
      setIsProcessingImage(false);
    }
  }

  /**
   * Загружает свой контур брелока.
   *
   * SVG читается как текст, картинка — как data URL и сразу переводится в
   * контур на canvas: серверная геометрия понимает только SVG-примитивы.
   * После успешного разбора форма переключается на «Свой SVG», иначе выбранный
   * ранее силуэт остался бы и файл ни на что не влиял.
   */
  async function handleKeychainContourChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    setIsProcessingContour(true);
    setContourError(null);

    try {
      const svg = await keychainContourFromFile(file);

      onCustomSvgChange(svg);
      onKeychainShapeChange("custom");
      setContourFileName(file.name);
    } catch (error) {
      setContourError(
        error instanceof Error
          ? error.message
          : "Не удалось обработать файл. Попробуйте другой контур.",
      );
    } finally {
      setIsProcessingContour(false);
    }
  }

  /** Возвращает встроенный силуэт: пустой customSvgData сервер не примет. */
  function resetKeychainContour() {
    onCustomSvgChange("");
    setContourFileName(null);
    setContourError(null);

    if (params.shapeType === "custom") {
      onKeychainShapeChange("dog_tag");
    }
  }

  /**
   * Текст поля ячеек уходит в состояние только когда строка разобралась.
   *
   * Незаконченный ввод («20, ») остаётся в поле и не отправляется в API:
   * сервер требует от 1 до 8 ячеек по 5–220 мм, а промежуточная строка этому
   * не соответствует.
   */
  function handleBoxCellsTextChange(axis: "x" | "y", value: string) {
    if (axis === "x") {
      setCellsXText(value);
    } else {
      setCellsYText(value);
    }

    const cells = parseBoxCellsInput(value);

    if (!cells) {
      return;
    }

    if (axis === "x") {
      appliedCellsX.current = cells.join(",");
    } else {
      appliedCellsY.current = cells.join(",");
    }

    onBoxCellsChange(axis, cells);
  }

  const cellsXInvalid =
    cellsXText.trim().length > 0 && parseBoxCellsInput(cellsXText) === null;
  const cellsYInvalid =
    cellsYText.trim().length > 0 && parseBoxCellsInput(cellsYText) === null;
  /** Слой паузы M600: метка ложится под верхней крышкой кармана. */
  const nfcPauseZ = Math.max(0, params.thickness - 0.4).toFixed(1);

  /**
   * Заголовок над компактными кнопками. У светильника и вывески файлов
   * несколько — детали печатаются по отдельности, — поэтому список кнопок
   * подписан: иначе «1 · крышка» и «2 · лицо» выглядели бы загадочно.
   */
  const partsHeading =
    params.model === "lamp"
      ? "Детали светильника"
      : params.model === "sign"
        ? "Детали блоков"
        : null;

  /** Три главных размера выбранной модели для нижней сводки. */
  const summary: { label: string; value: string }[] =
    params.model === "vase"
      ? [
          { label: "Высота", value: `${params.height} мм` },
          { label: "Диаметр", value: `Ø ${params.diameter} мм` },
          { label: "Стенка", value: `${params.wall.toFixed(1)} мм` },
        ]
      : params.model === "keychain"
        ? [
            { label: "Длина", value: `${params.length} мм` },
            { label: "Ширина", value: `${params.width} мм` },
            { label: "Толщина", value: `${params.thickness.toFixed(1)} мм` },
          ]
        : params.model === "lamp"
          ? [
              {
                label: "Высота",
                value: `${params.lampBaseHeight + params.lampHeight} мм`,
              },
              { label: "Диаметр", value: `Ø ${params.lampDiameter} мм` },
              { label: "Патрон", value: params.lampMount.toUpperCase() },
            ]
          : params.model === "box"
            ? [
                { label: "Длина", value: `${params.boxLength} мм` },
                { label: "Ширина", value: `${params.boxWidth} мм` },
                {
                  label: "Ячейки",
                  value: `${params.gridX} × ${params.gridY}`,
                },
              ]
            : params.model === "lithophane"
              ? [
                  { label: "Ширина", value: `${params.lithophaneWidth} мм` },
                  { label: "Высота", value: `${params.lithophaneHeight} мм` },
                  {
                    label: "Рельеф",
                    value: `${params.lithophaneMinThickness.toFixed(1)}–${params.lithophaneMaxThickness.toFixed(1)} мм`,
                  },
                ]
              : [
                  { label: "Кегль", value: `${params.signFontSize} мм` },
                  { label: "Выступ", value: `${params.signDepth} мм` },
                  { label: "Канал", value: `${params.signChannelWidth} мм` },
                ];

  return (
    <section
      aria-labelledby="parameters-heading"
      className="order-2 min-w-0 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 lg:order-1 lg:sticky lg:top-6"
    >
      <h2
        className="text-xs font-semibold tracking-wide text-slate-300 uppercase"
        id="parameters-heading"
      >
        Параметры модели
      </h2>

      <div className="mt-4">
        <ParameterSelect
          label="Тип модели"
          onChange={onModelChange}
          options={MODEL_OPTIONS}
          value={params.model}
        />
      </div>

      {params.model === "vase" ? (
        <>
          <div className="mt-6 border-t border-white/10 pt-5">
            <ParameterSelect
              hint={SHAPE_HINTS[params.shape]}
              label="Форма"
              onChange={onShapeChange}
              options={VASE_SHAPES.map((shape) => ({
                label: VASE_SHAPE_LABELS[shape],
                value: shape,
              }))}
              value={params.shape}
            />
          </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <ParameterSelect
              hint={PATTERN_HINTS[params.pattern]}
              label="Узор"
              onChange={onPatternChange}
              options={VASE_PATTERNS.map((pattern) => ({
                label: VASE_PATTERN_LABELS[pattern],
                value: pattern,
              }))}
              value={params.pattern}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.patternIntensity.decimals}
              hint="0 — ровная стенка, 5 мм — глубокий рельеф. В узкой горловине амплитуда ограничивается автоматически, чтобы стенка не разорвалась."
              label="Сила узора"
              max={CONSTRUCTOR_LIMITS.patternIntensity.max}
              min={CONSTRUCTOR_LIMITS.patternIntensity.min}
              onChange={(value) => onParamChange("patternIntensity", value)}
              step={CONSTRUCTOR_LIMITS.patternIntensity.step}
              unit="мм"
              value={params.patternIntensity}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.patternFrequency.decimals}
              hint="1 — крупный узор, 20 — частый. Для рёбер это число гребней по окружности; волны и спираль считают фазу от высоты в миллиметрах."
              label="Частота узора"
              max={CONSTRUCTOR_LIMITS.patternFrequency.max}
              min={CONSTRUCTOR_LIMITS.patternFrequency.min}
              onChange={(value) => onParamChange("patternFrequency", value)}
              step={CONSTRUCTOR_LIMITS.patternFrequency.step}
              unit="раз"
              value={params.patternFrequency}
            />
          </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Высота готовой вазы. Для модели выше 250 мм добавьте brim в слайсере."
              label="Высота"
              max={CONSTRUCTOR_LIMITS.height.max}
              min={CONSTRUCTOR_LIMITS.height.min}
              onChange={(value) => onParamChange("height", value)}
              step={CONSTRUCTOR_LIMITS.height.step}
              unit="мм"
              value={params.height}
            />

            <NumberSlider
              hint="Внешний диаметр в самой широкой части. Проверьте, что модель влезает на стол принтера."
              label="Диаметр"
              max={CONSTRUCTOR_LIMITS.diameter.max}
              min={CONSTRUCTOR_LIMITS.diameter.min}
              onChange={(value) => onParamChange("diameter", value)}
              step={CONSTRUCTOR_LIMITS.diameter.step}
              unit="мм"
              value={params.diameter}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.wall.decimals}
              hint="0.8–1.2 мм — декоративная ваза, 1.6–2.4 мм — прочная под живые цветы. В узкой горловине стенка автоматически утончается."
              label="Толщина стенки"
              max={CONSTRUCTOR_LIMITS.wall.max}
              min={CONSTRUCTOR_LIMITS.wall.min}
              onChange={(value) => onParamChange("wall", value)}
              step={CONSTRUCTOR_LIMITS.wall.step}
              unit="мм"
              value={params.wall}
            />
          </div>
        </>
      ) : params.model === "keychain" ? (
        <>
          <div className="mt-6 border-t border-white/10 pt-5">
            <ParameterSelect
              hint="У каждого силуэта есть ушко с отверстием под кольцо 4 мм. Жетон и шестиугольник выглядят спокойнее, фигурные силуэты заметнее на связке."
              label="Форма брелока"
              onChange={onKeychainShapeChange}
              options={KEYCHAIN_SHAPES.map((shapeType) => ({
                label: KEYCHAIN_SHAPE_LABELS[shapeType],
                value: shapeType,
              }))}
              value={params.shapeType}
            />
          </div>

          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Свой контур
            </legend>

            <div className="mt-3 flex flex-wrap gap-2">
              <label
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-blue-400/60 bg-blue-500/15 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500/25 focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950"
                htmlFor={keychainContourInputId}
              >
                {isProcessingContour
                  ? "Обрабатываем…"
                  : contourFileName
                    ? "Заменить контур"
                    : "Загрузить свой контур"}
              </label>
              <input
                accept=".svg,.png,.jpg,.jpeg"
                aria-describedby={keychainContourHintId}
                className="sr-only"
                disabled={isProcessingContour}
                id={keychainContourInputId}
                onChange={handleKeychainContourChange}
                type="file"
              />
              {contourFileName ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-3 text-sm font-semibold text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  onClick={resetKeychainContour}
                  type="button"
                >
                  Сбросить
                </button>
              ) : null}
            </div>

            <p
              className="mt-2 text-xs leading-relaxed text-slate-300"
              id={keychainContourHintId}
            >
              SVG с контуром или картинка PNG/JPG. Картинка переводится в силуэт
              в браузере: лучше всего подходит тёмный логотип на светлом фоне.
              Учтите, что отверстия внутри силуэта при таком переводе
              заполняются.
            </p>

            {contourFileName ? (
              <p className="mt-2 truncate text-xs text-emerald-200">
                Контур: {contourFileName}
              </p>
            ) : null}

            {contourError ? (
              <p
                className="mt-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
                role="alert"
              >
                {contourError}
              </p>
            ) : null}
          </fieldset>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition-colors hover:border-white/25 hover:bg-white/5">
            <input
              checked={params.nfcEnabled}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              onChange={(event) => onNfcChange(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-200">
                Карман под NFC-метку
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-300">
                Закрытое углубление с верхней крышкой 0.4 мм. Метку вкладывают
                в паузу печати, поэтому карман не видно снаружи.
              </span>
            </span>
          </label>

          {params.nfcEnabled ? (
            <aside className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
              Добавьте паузу <code className="font-semibold">M600</code> в
              слайсере на слое{" "}
              <strong className="font-semibold">Z = {nfcPauseZ} мм</strong>{" "}
              (толщина минус 0.4 мм), вложите метку и продолжите печать.
            </aside>
          ) : null}

          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Имя на брелоке
            </legend>

            <label className="sr-only" htmlFor={textInputId}>
              Имя или надпись на брелоке
            </label>
            <input
              aria-describedby={textHintId}
              autoComplete="off"
              className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base font-medium text-white placeholder:text-slate-300 focus-visible:border-amber-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              id={textInputId}
              maxLength={KEYCHAIN_TEXT_MAX_LENGTH}
              onChange={(event) =>
                onTextChange(sanitizeKeychainText(event.target.value))
              }
              placeholder="Например, Аня"
              spellCheck={false}
              type="text"
              value={params.text}
            />

            <div className="mt-2 flex items-start justify-between gap-3">
              <p
                className="text-xs leading-relaxed text-slate-300"
                id={textHintId}
              >
                Кириллица, латиница, цифры и знаки. Имя выступает над основой на
                0.8 мм и масштабируется под свободное место.
              </p>
              <span className="shrink-0 text-xs tabular-nums text-slate-300">
                {textLength}/{KEYCHAIN_TEXT_MAX_LENGTH}
              </span>
            </div>
          </fieldset>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Расстояние от верхнего края с кольцом до нижнего. 60 мм — удобный размер для связки ключей."
              label="Длина"
              max={CONSTRUCTOR_LIMITS.length.max}
              min={CONSTRUCTOR_LIMITS.length.min}
              onChange={(value) => onParamChange("length", value)}
              step={CONSTRUCTOR_LIMITS.length.step}
              unit="мм"
              value={params.length}
            />

            <NumberSlider
              hint="Ширина заготовки. Длинное имя автоматически становится мельче, но остаётся в пределах кромок."
              label="Ширина"
              max={CONSTRUCTOR_LIMITS.width.max}
              min={CONSTRUCTOR_LIMITS.width.min}
              onChange={(value) => onParamChange("width", value)}
              step={CONSTRUCTOR_LIMITS.width.step}
              unit="мм"
              value={params.width}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.thickness.decimals}
              hint="2–3 мм — лёгкий брелок, 4–5 мм — прочный. Края скруглены фаской, чтобы не резали руки."
              label="Толщина"
              max={CONSTRUCTOR_LIMITS.thickness.max}
              min={CONSTRUCTOR_LIMITS.thickness.min}
              onChange={(value) => onParamChange("thickness", value)}
              step={CONSTRUCTOR_LIMITS.thickness.step}
              unit="мм"
              value={params.thickness}
            />
          </div>
        </>
      ) : params.model === "lamp" ? (
        <>
          <div
            className="mt-6 rounded-2xl border-2 border-red-400/50 bg-gradient-to-br from-red-500/15 to-amber-400/10 px-4 py-3"
            role="alert"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-red-100">
              <span aria-hidden>🔥</span>
              Только светодиодная лампа
            </p>
            <p className="mt-1 text-xs leading-relaxed text-red-100/85">
              Абажур печатается из PLA и размягчается уже при 60 °C. Лампа
              накаливания или галогенка расплавит деталь над патроном. Берите
              LED-лампу до 10 Вт и не оставляйте светильник без присмотра.
            </p>
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <ParameterSelect
              hint="Отверстие шире резьбы на 0.3 мм с каждой стороны: после усадки патрон входит плотно, но не проваливается. Провод выходит через канал в верхнем поясе."
              label="Патрон"
              onChange={onLampMountChange}
              options={LAMP_MOUNTS.map((mount) => ({
                label: LAMP_MOUNT_LABELS[mount],
                value: mount,
              }))}
              value={params.lampMount}
            />
          </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <ParameterSelect
              hint="Квадрат и шестигранник стоят устойчивее круга и дают ровные грани, круг печатается проще всего."
              label="Основание"
              onChange={onLampBaseShapeChange}
              options={LAMP_BASE_SHAPES.map((shape) => ({
                label: LAMP_BASE_SHAPE_LABELS[shape],
                value: shape,
              }))}
              value={params.lampBaseShape}
            />

            <NumberSlider
              hint="Высота тумбы под патрон. Внутри остаётся место для клеммника, а абажур ставится на верхнюю плиту и центруется посадочным кольцом."
              label="Высота основания"
              max={CONSTRUCTOR_LIMITS.lampBaseHeight.max}
              min={CONSTRUCTOR_LIMITS.lampBaseHeight.min}
              onChange={(value) => onParamChange("lampBaseHeight", value)}
              step={CONSTRUCTOR_LIMITS.lampBaseHeight.step}
              unit="мм"
              value={params.lampBaseHeight}
            />
          </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <ParameterSelect
              hint="Глубина рельефа у абажура фиксированная — 1.2 мм. У патрона и у стола стенка остаётся гладкой: гнездо и кромка не деформируются."
              label="Узор"
              onChange={onLampPatternChange}
              options={VASE_PATTERNS.map((pattern) => ({
                label: VASE_PATTERN_LABELS[pattern],
                value: pattern,
              }))}
              value={params.lampPattern}
            />
          </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Высота абажура от нижней кромки до пояса патрона. Верхние 18 мм занимает гнездо, поэтому свет уходит вниз."
              label="Высота"
              max={CONSTRUCTOR_LIMITS.lampHeight.max}
              min={CONSTRUCTOR_LIMITS.lampHeight.min}
              onChange={(value) => onParamChange("lampHeight", value)}
              step={CONSTRUCTOR_LIMITS.lampHeight.step}
              unit="мм"
              value={params.lampHeight}
            />

            <NumberSlider
              hint="Наружный диаметр у нижней кромки. Проверьте, что абажур влезает на стол принтера вместе с поддержками."
              label="Диаметр"
              max={CONSTRUCTOR_LIMITS.lampDiameter.max}
              min={CONSTRUCTOR_LIMITS.lampDiameter.min}
              onChange={(value) => onParamChange("lampDiameter", value)}
              step={CONSTRUCTOR_LIMITS.lampDiameter.step}
              unit="мм"
              value={params.lampDiameter}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.lampWall.decimals}
              hint="0.8–1.2 мм — декоративный абажур, 1.6–2.4 мм — прочный и лучше держит форму. Толщина не меняется по высоте."
              label="Толщина стенки"
              max={CONSTRUCTOR_LIMITS.lampWall.max}
              min={CONSTRUCTOR_LIMITS.lampWall.min}
              onChange={(value) => onParamChange("lampWall", value)}
              step={CONSTRUCTOR_LIMITS.lampWall.step}
              unit="мм"
              value={params.lampWall}
            />
          </div>
        </>
      ) : params.model === "box" ? (
        <>
          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Сетка ячеек
            </legend>

            <div className="mt-3 space-y-5">
              <NumberSlider
                hint="Сколько секций по длине. Перегородки получают ту же толщину, что и наружные стенки."
                label="Ячеек по длине"
                max={CONSTRUCTOR_LIMITS.boxGrid.max}
                min={CONSTRUCTOR_LIMITS.boxGrid.min}
                onChange={(value) => onParamChange("gridX", value)}
                step={CONSTRUCTOR_LIMITS.boxGrid.step}
                unit="шт."
                value={params.gridX}
              />

              <NumberSlider
                hint="Сколько секций по ширине. 1 × 1 — простая коробка без внутренних перегородок."
                label="Ячеек по ширине"
                max={CONSTRUCTOR_LIMITS.boxGrid.max}
                min={CONSTRUCTOR_LIMITS.boxGrid.min}
                onChange={(value) => onParamChange("gridY", value)}
                step={CONSTRUCTOR_LIMITS.boxGrid.step}
                unit="шт."
                value={params.gridY}
              />

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                <p className="text-xs font-semibold tracking-wide text-slate-300 uppercase">
                  Пресеты
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BOX_PRESET_IDS.map((preset) => (
                    <button
                      className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                      key={preset}
                      onClick={() => onBoxPresetChange(preset)}
                      type="button"
                    >
                      {BOX_PRESET_LABELS[preset]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  className="text-sm font-medium text-slate-200"
                  htmlFor={boxCellsXInputId}
                >
                  Ширины ячеек по длине, мм
                </label>
                <input
                  aria-describedby={`${boxCellsXInputId}-hint`}
                  aria-invalid={cellsXInvalid}
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-base font-medium text-white placeholder:text-slate-300 focus-visible:border-amber-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  id={boxCellsXInputId}
                  inputMode="decimal"
                  onChange={(event) =>
                    handleBoxCellsTextChange("x", event.target.value)
                  }
                  placeholder="20, 40, 20"
                  spellCheck={false}
                  type="text"
                  value={cellsXText}
                />
                <p
                  className={
                    cellsXInvalid
                      ? "mt-2 text-xs leading-relaxed text-rose-200"
                      : "mt-2 text-xs leading-relaxed text-slate-300"
                  }
                  id={`${boxCellsXInputId}-hint`}
                >
                  Через запятую, от 1 до 8 чисел по 5–220 мм. Например: 20, 40,
                  20. Размеры задают пропорции ячеек.
                </p>
              </div>

              <div>
                <label
                  className="text-sm font-medium text-slate-200"
                  htmlFor={boxCellsYInputId}
                >
                  Высоты ячеек по ширине, мм
                </label>
                <input
                  aria-describedby={`${boxCellsYInputId}-hint`}
                  aria-invalid={cellsYInvalid}
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-base font-medium text-white placeholder:text-slate-300 focus-visible:border-amber-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  id={boxCellsYInputId}
                  inputMode="decimal"
                  onChange={(event) =>
                    handleBoxCellsTextChange("y", event.target.value)
                  }
                  placeholder="45, 45"
                  spellCheck={false}
                  type="text"
                  value={cellsYText}
                />
                <p
                  className={
                    cellsYInvalid
                      ? "mt-2 text-xs leading-relaxed text-rose-200"
                      : "mt-2 text-xs leading-relaxed text-slate-300"
                  }
                  id={`${boxCellsYInputId}-hint`}
                >
                  Через запятую, от 1 до 8 чисел по 5–220 мм. Например: 45, 45.
                  Свободное место делится пропорционально.
                </p>
              </div>
            </div>
          </fieldset>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Наружный размер по длинной стороне. 140–180 мм удобны для кабелей, крепежа и канцелярии."
              label="Длина"
              max={CONSTRUCTOR_LIMITS.boxLength.max}
              min={CONSTRUCTOR_LIMITS.boxLength.min}
              onChange={(value) => onParamChange("boxLength", value)}
              step={CONSTRUCTOR_LIMITS.boxLength.step}
              unit="мм"
              value={params.boxLength}
            />

            <NumberSlider
              hint="Наружный размер по короткой стороне. Вместе с длиной задаёт размеры ячеек."
              label="Ширина"
              max={CONSTRUCTOR_LIMITS.boxWidth.max}
              min={CONSTRUCTOR_LIMITS.boxWidth.min}
              onChange={(value) => onParamChange("boxWidth", value)}
              step={CONSTRUCTOR_LIMITS.boxWidth.step}
              unit="мм"
              value={params.boxWidth}
            />

            <NumberSlider
              hint="Высота стенок и перегородок от стола. Высокая коробка вмещает больше, но печатается дольше."
              label="Высота"
              max={CONSTRUCTOR_LIMITS.boxHeight.max}
              min={CONSTRUCTOR_LIMITS.boxHeight.min}
              onChange={(value) => onParamChange("boxHeight", value)}
              step={CONSTRUCTOR_LIMITS.boxHeight.step}
              unit="мм"
              value={params.boxHeight}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.boxWall.decimals}
              hint="Толщина наружных стенок и перегородок. 1.2–1.6 мм — прочный бытовой органайзер; 0.8 мм — быстрее, но тоньше."
              label="Толщина стенки"
              max={CONSTRUCTOR_LIMITS.boxWall.max}
              min={CONSTRUCTOR_LIMITS.boxWall.min}
              onChange={(value) => onParamChange("boxWall", value)}
              step={CONSTRUCTOR_LIMITS.boxWall.step}
              unit="мм"
              value={params.boxWall}
            />
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition-colors hover:border-white/25 hover:bg-white/5">
            <input
              checked={params.hasLid}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              onChange={(event) => onHasLidChange(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-200">
                Крышка
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-300">
                Отдельная плита с бортиком по периметру. Лежит рядом с корпусом
                в том же STL и печатается без поддержек.
              </span>
            </span>
          </label>

          <p className="mt-4 text-xs leading-relaxed text-slate-300">
            Корпус и крышка — две отдельные замкнутые детали. Перегородки входят
            в дно и стенки, поэтому после печати коробка не расслаивается.
          </p>
        </>
      ) : params.model === "lithophane" ? (
        <>
          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Фотография
            </legend>

            <div className="mt-3 flex items-start gap-3">
              {hasUploadedImage && imagePreview ? (
                <div
                  aria-label="Превью загруженного изображения"
                  className="h-24 w-24 shrink-0 rounded-2xl border border-white/15 bg-cover bg-center"
                  role="img"
                  style={{ backgroundImage: `url(${imagePreview})` }}
                />
              ) : (
                <div
                  aria-hidden
                  className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-slate-950/60 text-center text-[0.65rem] leading-tight font-medium tracking-wide text-slate-300 uppercase"
                >
                  <span className="text-2xl">🖼️</span>
                  <span className="mt-1">
                    {LITHOPHANE_RESOLUTION} × {LITHOPHANE_RESOLUTION}
                  </span>
                </div>
              )}

              <div className="min-w-0 flex-1">
                <label
                  className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-blue-400/60 bg-blue-500/15 px-3 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-500/25 focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950"
                  htmlFor={lithophaneInputId}
                >
                  {isProcessingImage
                    ? "Сжимаем…"
                    : hasUploadedImage
                      ? "Заменить фото"
                      : "Загрузить фото"}
                </label>
                <input
                  accept="image/*"
                  aria-describedby={lithophaneHintId}
                  className="sr-only"
                  disabled={isProcessingImage}
                  id={lithophaneInputId}
                  onChange={handleLithophaneImageChange}
                  type="file"
                />
                <p
                  className="mt-2 text-xs leading-relaxed text-slate-300"
                  id={lithophaneHintId}
                >
                  PNG, JPG или WebP. Браузер сразу сжимает кадр до 150 × 150,
                  поэтому большой файл не подвесит предпросмотр. Берётся
                  центральная квадратная область.
                </p>
              </div>
            </div>

            {imageError ? (
              <p
                className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
                role="alert"
              >
                {imageError}
              </p>
            ) : null}

            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {hasUploadedImage
                ? "Фото загружено. Тёмные участки станут толще, светлые — тоньше."
                : "Пока показан демонстрационный рельеф. Загрузите фото, чтобы заменить его."}
            </p>
          </fieldset>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Ширина панели вместе с рамкой. 120–160 мм удобно печатать на столе 220 × 220."
              label="Ширина"
              max={CONSTRUCTOR_LIMITS.lithophaneWidth.max}
              min={CONSTRUCTOR_LIMITS.lithophaneWidth.min}
              onChange={(value) => onParamChange("lithophaneWidth", value)}
              step={CONSTRUCTOR_LIMITS.lithophaneWidth.step}
              unit="мм"
              value={params.lithophaneWidth}
            />

            <NumberSlider
              hint="Высота панели вместе с рамкой. Пропорции фото подстраиваются под этот размер."
              label="Высота"
              max={CONSTRUCTOR_LIMITS.lithophaneHeight.max}
              min={CONSTRUCTOR_LIMITS.lithophaneHeight.min}
              onChange={(value) => onParamChange("lithophaneHeight", value)}
              step={CONSTRUCTOR_LIMITS.lithophaneHeight.step}
              unit="мм"
              value={params.lithophaneHeight}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.lithophaneMinThickness.decimals}
              hint="Толщина светлых участков. 0.8 мм пропускает свет, но остаётся прочной; ниже 0.6 мм пластик легко ломается."
              label="Толщина светлого"
              max={CONSTRUCTOR_LIMITS.lithophaneMinThickness.max}
              min={CONSTRUCTOR_LIMITS.lithophaneMinThickness.min}
              onChange={(value) =>
                onParamChange("lithophaneMinThickness", value)
              }
              step={CONSTRUCTOR_LIMITS.lithophaneMinThickness.step}
              unit="мм"
              value={params.lithophaneMinThickness}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.lithophaneMaxThickness.decimals}
              hint="Толщина тёмных участков и рамки. Чем больше разница с минимумом, тем контрастнее рельеф, но дольше печать."
              label="Толщина тёмного"
              max={CONSTRUCTOR_LIMITS.lithophaneMaxThickness.max}
              min={CONSTRUCTOR_LIMITS.lithophaneMaxThickness.min}
              onChange={(value) =>
                onParamChange("lithophaneMaxThickness", value)
              }
              step={CONSTRUCTOR_LIMITS.lithophaneMaxThickness.step}
              unit="мм"
              value={params.lithophaneMaxThickness}
            />
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition-colors hover:border-white/25 hover:bg-white/5">
            <input
              checked={params.lithoFrame}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              onChange={(event) => onLithoFrameChange(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-200">
                Рамка
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-300">
                Отдельная деталь: задняя полка с пазом, куда входит плита, и
                передняя накладка по периметру. Без рамки печатается только
                плита рельефа со своим бортиком.
              </span>
            </span>
          </label>

          {params.lithoFrame ? (
            <div className="mt-6 border-t border-white/10 pt-5">
              <ParameterSelect
                label="Крепление"
                onChange={onLithoMountChange}
                options={LITHOPHANE_MOUNTS.map((mount) => ({
                  label: LITHOPHANE_MOUNT_LABELS[mount],
                  value: mount,
                }))}
                value={params.lithoMount}
              />

              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                {params.lithoMount === "stand"
                  ? "Подставка: база 6 мм с передней губой и наклонной задней стенкой. Панель с рамкой ставится в паз сверху и наклонена на 12° — так удобнее рассматривать фото на столе."
                  : params.lithoMount === "hook"
                    ? "Петли: две проушины на тыльной стороне верхней планки. Литофан висит на двух шурупах почти вплотную к стене, шляпка прячется в кармане петли."
                    : "Без крепления: печатается только рамка с плитой. Её можно поставить на полку или вставить в свою подставку."}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-slate-300">
              Рамка выключена: печатается только плита рельефа, крепления нет —
              их паз вырезан в рамке.
            </p>
          )}

          <p className="mt-4 text-xs leading-relaxed text-slate-300">
            Рельеф смотрит вверх: плита, рамка и подставка печатаются плашмя,
            поддержки не нужны. Детали собираются без клея — плита входит в паз
            рамки с зазором 0.2 мм.
          </p>
        </>
      ) : (
        <>
          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Надпись на вывеске
            </legend>

            <label className="sr-only" htmlFor={signTextInputId}>
              Надпись на вывеске
            </label>
            <input
              aria-describedby={signTextHintId}
              autoComplete="off"
              className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base font-medium text-white placeholder:text-slate-300 focus-visible:border-violet-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              id={signTextInputId}
              maxLength={SIGN_TEXT_MAX_LENGTH}
              onChange={(event) =>
                onSignTextChange(sanitizeSignText(event.target.value))
              }
              placeholder="Например, ТРИ ДИ"
              spellCheck={false}
              type="text"
              value={params.signText}
            />

            <div className="mt-2 flex items-start justify-between gap-3">
              <p
                className="text-xs leading-relaxed text-slate-300"
                id={signTextHintId}
              >
                Кириллица, латиница, цифры и знаки. Надпись делится на блоки: в
                каждом — объёмные полые буквы на общей плите, лицо 2 мм, стенки
                1.8 мм и открытая камера под ленту сзади.
              </p>
              <span className="shrink-0 text-xs tabular-nums text-slate-300">
                {signTextLength}/{SIGN_TEXT_MAX_LENGTH}
              </span>
            </div>
          </fieldset>

          <div className="mt-6 border-t border-white/10 pt-5">
            <ParameterSelect
              hint="Шрифт задаёт рисунок и толщину штриха. Все три набора с кириллицей: у Regular тонкие штрихи чаще собираются сплошными — камера под ленту в них не помещается."
              label="Шрифт надписи"
              onChange={onSignFontChange}
              options={SIGN_FONTS.map((signFont) => ({
                label: SIGN_FONT_LABELS[signFont],
                value: signFont,
              }))}
              value={params.signFont}
            />
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <ParameterSelect
              hint="Лента ложится в открытую камеру сзади буквы: стенки держат её по краям, а лицо остаётся сплошным. На стыках блоков есть сквозной канал — по нему лента переходит из блока в блок, а провод уходит по тыльной стороне надписи."
              label="Канал под ленту"
              onChange={onSignChannelWidthChange}
              options={SIGN_CHANNEL_WIDTHS.map((channelWidth) => ({
                label: `${channelWidth} мм`,
                value: channelWidth,
              }))}
              value={params.signChannelWidth}
            />
          </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Кегль надписи. Если строка длиннее 800 мм, буквы уменьшаются сами — фактический размер видно по габаритам предпросмотра."
              label="Кегль"
              max={CONSTRUCTOR_LIMITS.signFontSize.max}
              min={CONSTRUCTOR_LIMITS.signFontSize.min}
              onChange={(value) => onParamChange("signFontSize", value)}
              step={CONSTRUCTOR_LIMITS.signFontSize.step}
              unit="мм"
              value={params.signFontSize}
            />

            <NumberSlider
              hint="Выступ букв над столом. 11–18 мм — компактная подсветка, 25–40 мм даёт объёмную вывеску с запасом под ленту и диффузор."
              label="Выступ букв"
              max={CONSTRUCTOR_LIMITS.signDepth.max}
              min={CONSTRUCTOR_LIMITS.signDepth.min}
              onChange={(value) => onParamChange("signDepth", value)}
              step={CONSTRUCTOR_LIMITS.signDepth.step}
              unit="мм"
              value={params.signDepth}
            />

            <NumberSlider
              hint="Расстояние между буквами в строке. Зазор не масштабируется с кеглем: буквы не слипаются даже в длинной надписи."
              label="Зазор между буквами"
              max={CONSTRUCTOR_LIMITS.signLetterGap.max}
              min={CONSTRUCTOR_LIMITS.signLetterGap.min}
              onChange={(value) => onParamChange("signLetterGap", value)}
              step={CONSTRUCTOR_LIMITS.signLetterGap.step}
              unit="мм"
              value={params.signLetterGap}
            />

            <NumberSlider
              hint="Сколько букв печатается одним блоком. Блок — это лицо с плитой и шипом и отдельная задняя крышка: 2–3 буквы удобно вешать, по одной — если буквы крупные."
              label="Букв в блоке"
              max={CONSTRUCTOR_LIMITS.signBlockSize.max}
              min={CONSTRUCTOR_LIMITS.signBlockSize.min}
              onChange={(value) => onParamChange("signBlockSize", value)}
              step={CONSTRUCTOR_LIMITS.signBlockSize.step}
              unit="шт."
              value={params.signBlockSize}
            />
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition-colors hover:border-white/25 hover:bg-white/5">
            <input
              checked={params.signBaseMount}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              onChange={(event) => onSignBaseMountChange(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-200">
                Общее основание
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-300">
                Плита под буквами блока: буквы стоят на ней, а не на узкой рейке.
                Без основания блок легче, но плита ниже и шип меньше.
              </span>
            </span>
          </label>

          <p className="mt-4 text-xs leading-relaxed text-slate-300">
            Блок печатается двумя деталями: лицо с буквами на плите и задняя
            крышка с бортиком. Плиты соседей стыкуются шипом и пазом, а за плитой
            на стыке проходит сквозной канал под ленту. Слишком тонкие штрихи —
            например, у «I» или «1» — собираются сплошными: камера под ленту там
            не помещается.
          </p>
        </>
      )}

      <dl className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-center">
        {summary.map((item, index) => (
          <div
            className={index === 1 ? "border-x border-white/10" : undefined}
            key={item.label}
          >
            <dt className="text-[0.65rem] font-medium tracking-wide text-slate-300 uppercase">
              {item.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-white">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <button
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/15 px-4 text-sm font-semibold text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        onClick={onReset}
        type="button"
      >
        Сбросить параметры
      </button>

      <div className="mt-5 border-t border-white/10 pt-5">
        {hasPro ? (
          <>
            <ExportButtons
              exportingId={exportingId}
              onExport={onExport}
              options={exportOptions}
              partsHeading={partsHeading}
            />
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {isExporting
                ? "Собираем геометрию и упаковываем её в бинарный STL…"
                : "Подписка Pro активна. Файл скачается с именем по вашим параметрам."}
            </p>
            <ExportErrorAlert error={exportError} />
          </>
        ) : freeDownloadsLeft > 0 ? (
          <>
            <div
              aria-live="polite"
              className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3"
            >
              <p className="text-sm font-semibold text-amber-100">
                Осталось бесплатных скачиваний:{" "}
                <span className="tabular-nums text-white">
                  {freeDownloadsLeft} из {FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH}
                </span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                Лимит обновляется 1-го числа каждого месяца по UTC.
              </p>
            </div>

            <div className="mt-3">
              <ExportButtons
                exportingId={exportingId}
                onExport={onExport}
                options={exportOptions}
                partsHeading={partsHeading}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {isExporting
                ? "Собираем геометрию и упаковываем её в бинарный STL…"
                : "Бесплатный лимит: 3 скачивания в календарный месяц."}
            </p>
            <ExportErrorAlert error={exportError} />
          </>
        ) : (
          <>
            <div
              aria-live="polite"
              className="rounded-2xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-400/20 to-orange-500/10 px-4 py-3"
            >
              <p className="text-sm font-semibold text-amber-100">
                Осталось бесплатных скачиваний:{" "}
                <span className="tabular-nums text-white">
                  0 из {FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH}
                </span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                Лимит на этот месяц исчерпан. Pro открывает безлимитную
                генерацию STL.
              </p>
            </div>

            <Link
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-5 text-base font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              href="/subscription#tools"
            >
              <span aria-hidden>⚡</span>
              Оформить Pro для безлимита
            </Link>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Оформите подписку Pro для безлимитного доступа.
            </p>
            <ExportErrorAlert error={exportError} />
          </>
        )}
      </div>
    </section>
  );
}
