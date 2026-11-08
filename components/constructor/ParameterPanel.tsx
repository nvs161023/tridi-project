"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, useEffect, type ChangeEvent } from "react";

import { NumberSlider } from "@/components/constructor/NumberSlider";
import { ParameterSelect } from "@/components/constructor/ParameterSelect";
import { FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH } from "@/lib/constructor/downloads";
import { heatTransferThickness } from "@/lib/constructor/heat-transfer-geometry";
import {
  HEAT_TRANSFER_LOW_RESOLUTION_HINT,
  HEAT_TRANSFER_NO_TRANSPARENCY_HINT,
  HEAT_TRANSFER_RECOMMENDED_SIDE_PX,
  checkHeatTransferSource,
  heatTransferGridSize,
  heatTransferImportError,
  heatTransferLegibility,
  heatTransferSourceError,
  heatTransferStrokeHint,
  rasterToHeatTransferSvg,
  type HeatTransferWarning,
  type StrokeHistogram,
} from "@/lib/constructor/heat-transfer-import";
import {
  KEYCHAIN_NFC_CLEARANCE_MM,
  KEYCHAIN_NFC_TAG_MM,
  keychainNfcLayers,
  measureKeychainNfc,
  type KeychainBuildReport,
} from "@/lib/constructor/keychain-geometry";
import {
  KEYCHAIN_IMAGE_GRID,
  keychainImageErrorText,
  keychainImageFromPixels,
} from "@/lib/constructor/keychain-image";
import {
  APPLE_TAG_RING_HOLE_INSET_MM,
  RING_HOLE_DIAMETER_MM,
  brickStudLayout,
  gearLayout,
  heartLayout,
  isKeychainPresetImplemented,
  nfcLayout,
  protrudingTabLayout,
  ringHoleSideOffsetMm,
  ringHoleSideWallMm,
  starburstLayout,
  ticketLayout,
} from "@/lib/constructor/keychain-preset-geometry";
import {
  HOLE_PLACEMENT_LABELS,
  KEYCHAIN_PRESETS,
  isKeychainPresetId,
  keychainPresetById,
  type HolePlacement,
  type KeychainPresetId,
} from "@/lib/constructor/keychain-presets";
import {
  QR_CARD_MIN_MODULE_MM,
  QR_CARD_SIZE_IDS,
  QR_CARD_SIZE_LABELS,
  QR_CARD_TABS,
  QR_CARD_TAB_LABELS,
  QR_CONTENT_TYPES,
  QR_CONTENT_TYPE_LABELS,
  QR_MODES,
  QR_MODE_LABELS,
  qrCardPlan,
  qrCardReport,
} from "@/lib/constructor/qr-card-geometry";
import {
  BOX_CELL_MAX_MM,
  BOX_CELL_MIN_MM,
  BOX_PRESET_IDS,
  BOX_PRESET_LABELS,
  COASTER_PATTERNS,
  COASTER_PATTERN_LABELS,
  COASTER_SHAPES,
  COASTER_SHAPE_LABELS,
  CONSTRUCTOR_LIMITS,
  DEFAULT_LITHOPHANE_PARAMS,
  JEWELRY_CONFIGS,
  JEWELRY_CONFIG_LABELS,
  KEYCHAIN_SHAPES,
  KEYCHAIN_SHAPE_LABELS,
  KEYCHAIN_DECORATION_DEPTH_LIMITS,
  KEYCHAIN_DECORATION_KIND_LABELS,
  KEYCHAIN_DECORATION_OFFSET_LIMITS,
  KEYCHAIN_DECORATION_ROTATIONS,
  KEYCHAIN_DECORATION_SIDE_LABELS,
  KEYCHAIN_DECORATION_SIDES,
  KEYCHAIN_FONTS,
  KEYCHAIN_FONT_LABELS,
  KEYCHAIN_IMAGE_SCALE_LIMITS,
  KEYCHAIN_MAX_DECORATIONS,
  KEYCHAIN_SVG_MAX_LENGTH,
  KEYCHAIN_TEXT_ALIGNS,
  KEYCHAIN_TEXT_ALIGN_LABELS,
  KEYCHAIN_TEXT_LINE_HEIGHT_LIMITS,
  KEYCHAIN_TEXT_MAX_LENGTH,
  KEYCHAIN_TEXT_MAX_LINES,
  keychainImageDecoration,
  keychainQrDecoration,
  keychainQrCardSpec,
  keychainTextDecoration,
  keychainThicknessLimits,
  hasDrawableSvgData,
  isCustomSvgData,
  LITHOPHANE_MOUNTS,
  LITHOPHANE_MOUNT_LABELS,
  LITHOPHANE_PIXEL_COUNT,
  LITHOPHANE_RESOLUTION,
  MODEL_TYPE_LABELS,
  PEN_SHAPES,
  PEN_SHAPE_LABELS,
  PLANTER_SHAPES,
  PLANTER_SHAPE_LABELS,
  SIGN_CHANNEL_WIDTHS,
  SIGN_FONTS,
  SIGN_FONT_LABELS,
  SIGN_TEXT_MAX_LENGTH,
  VASE_MAX_PATTERN_LAYERS,
  VASE_PATTERNS,
  VASE_PATTERN_LABELS,
  VASE_SHAPES,
  VASE_SHAPE_LABELS,
  sanitizeKeychainText,
  sanitizeSignText,
  type BoxPresetId,
  type CoasterPattern,
  type CoasterShape,
  type ConstructorParams,
  type JewelryConfig,
  type KeychainDecoration,
  type KeychainDecorationKind,
  type KeychainDecorationSide,
  type KeychainFontId,
  type KeychainImageDecoration,
  type KeychainRotation,
  type KeychainShape,
  type KeychainTextAlign,
  type KeychainTextDecoration,
  type LithophaneMount,
  type ModelType,
  type PatternLayer,
  type PenShape,
  type PlanterShape,
  type QrCardSize,
  type QrCardTab,
  type QrContentType,
  type QrMode,
  type SignChannelWidth,
  type SignFont,
  type VasePattern,
  type VaseShape,
} from "@/lib/constructor/params";
import {
  binarizeByLuminance,
  runsToRects,
} from "@/lib/constructor/raster-to-contours";
import {
  VASE_SECTION_MIN_SIDES,
  resolveSectionSides,
} from "@/lib/constructor/vase-section";

/**
 * Числовые параметры: форму, слои узора и текст меняют отдельные обработчики.
 *
 * Слои узора правятся не этим ключом, а `onPatternLayerChange`: у слоя пять
 * чисел и тип, поэтому панель передаёт индекс слоя и патч. `patterns` в
 * `SizeParam` не входит — числа слоя не укладываются в «ключ → число».
 */
type SizeParam = Exclude<
  keyof ConstructorParams,
  | "model"
  | "shape"
  | "patterns"
  | "shapeType"
  | "text"
  | "signText"
  | "signFont"
  | "signChannelWidth"
  | "signBaseMount"
  | "hasLid"
  | "lithoFrame"
  | "lithoMount"
  | "lithophaneBrightness"
  | "planterShape"
  | "planterDrainage"
  | "coasterShape"
  | "coasterPattern"
  | "coasterRim"
  | "jewelryConfig"
  | "penShape"
  | "heatTransferSvg"
  | "heatTransferMirror"
  | "qrCardSize"
  | "qrCardTab"
  | "qrMode"
  | "qrContentType"
  | "qrContent"
  | "qrName"
  | "qrPhone"
>;

/** Ошибка экспорта и действие, которое поможет её исправить. */
export type StlExportError = {
  message: string;
  action: "pro" | "login" | null;
};

/**
 * Файл, который предлагает панель.
 *
 * Первый файл в списке — главный: у вывески это лицо первого блока, у
 * литофана — собранная панель. Остальные кнопки отдают детали по отдельности:
 * лицо и крышка блока печатаются разными деталями. `request` уходит в API
 * поверх параметров модели, поэтому панель не знает, как они называются.
 */
export type StlExportOption = {
  /** Уникальный ключ: по нему видно, на какой кнопке крутится спиннер. */
  id: string;
  /** Текст кнопки. */
  label: string;
  /** Подпись для скринридера, если текст кнопки слишком короткий («А»). */
  description?: string;
  /** Дополнительные поля запроса: `part` литофана или `letter` вывески. */
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
  /**
   * Случайная ваза: силуэт, один-два слоя узора, амплитуда, частота и сид.
   *
   * Отдельный обработчик, а не набор `onParamChange`: рандом меняет несколько
   * полей сразу, а `onParamChange` ведёт к одному числу. Размеры, стенка и
   * деформации остаются прежними — кнопка крутит форму, а не стол принтера.
   */
  onRandomizeVase: () => void;
  /**
   * Правка одного поля слоя узора: индекс слоя и изменённые поля.
   *
   * Патч приходит частичным, но `envelope` в нём всегда полный: нормализация
   * подставляет недостающие миллиметры затухания из дефолтного слоя, а не из
   * текущего, поэтому половина конверта сбросила бы вторую половину к 5 и 3 мм.
   */
  onPatternLayerChange: (index: number, patch: Partial<PatternLayer>) => void;
  /** Добавить слой узора: тип и числа выбирает `nextPatternLayer`. */
  onAddPatternLayer: () => void;
  /** Удалить слой по индексу; последний слой остаётся всегда. */
  onRemovePatternLayer: (index: number) => void;
  /**
   * Форма брелока: `custom` — свой контур из `customSvgData`, null — вернуть
   * пресет по умолчанию.
   *
   * Встроенных силуэтов больше нет, поэтому других значений не бывает: выбор
   * пресета идёт через `onKeychainPresetChange`, и он же обнуляет контур.
   */
  onKeychainShapeChange: (shape: KeychainShape | null) => void;
  /**
   * Новый пресет силуэта; null снимает пресет, и нормализация возвращает пресет
   * по умолчанию.
   *
   * Пресет живёт в параметрах модели (`params.keychainPreset`), а не в состоянии
   * панели: иначе список, предпросмотр и STL могли бы показывать разные формы.
   */
  onKeychainPresetChange: (preset: KeychainPresetId | null) => void;
  /** Свой SVG-контур: текст SVG или SVG, собранный из загруженной картинки. */
  onCustomSvgChange: (svg: string) => void;
  /**
   * Правка декорации по виду: панель присылает только изменённые поля.
   *
   * Один обработчик на все карточки блока «Декор»: вид служит ключом, а границы,
   * наборы значений и порядок в массиве доводит нормализация.
   */
  onKeychainDecorationChange: (
    kind: KeychainDecorationKind,
    patch: Partial<KeychainDecoration>,
  ) => void;
  /** «Добавить текст»: пустая карточка, содержимое вводит человек. */
  onAddKeychainText: () => void;
  /**
   * «Добавить картинку»: готовая маска из canvas и имя файла.
   *
   * Маску переводит `keychainImageFromPixels`, поэтому в параметры приходит уже
   * проверенная строка, а имя файла остаётся в декорации для подписи карточки.
   */
  onAddKeychainImage: (imageData: string, imageName: string) => void;
  /** «Удалить» у карточки декорации. */
  onRemoveKeychainDecoration: (kind: KeychainDecorationKind) => void;
  /**
   * Что вышло из декораций при последней сборке модели.
   *
   * Приходит из сцены: только там есть готовая карта грани, по которой видно, на
   * какую сторону встал рельеф, насколько ужался логотип и что не поместилось.
   * `null` — модель сейчас не брелок или декораций в параметрах нет.
   */
  keychainReport?: KeychainBuildReport | null;
  /** Карман под NFC-метку в теле брелока. */
  onNfcChange: (enabled: boolean) => void;
  /**
   * Куда ставить отверстие Ø5 мм под кольцо.
   *
   * Набор пунктов берётся из реестра пресета, поэтому панель не предлагает
   * позицию, которую силуэт не держит, и не повторяет его геометрию у себя.
   */
  onHolePlacementChange: (placement: HolePlacement) => void;
  /** Размер QR-визитки: 60 × 40 или 70 × 45 мм; габарит выводится из него. */
  onQrCardSizeChange: (size: QrCardSize) => void;
  /** Крепление визитки: проушина сверху или отверстие в теле. */
  onQrCardTabChange: (tab: QrCardTab) => void;
  /** Рельеф кода: выпуклый или углублённый. */
  onQrModeChange: (mode: QrMode) => void;
  /** Что зашито в код: ссылка, телефон, почта или визитка. */
  onQrContentTypeChange: (contentType: QrContentType) => void;
  /** Ссылка, телефон или почта. */
  onQrContentChange: (content: string) => void;
  /** Имя для визитки vCard. */
  onQrNameChange: (name: string) => void;
  /** Телефон для визитки vCard. */
  onQrPhoneChange: (phone: string) => void;
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
  /** Готовая яркость 400 × 400 из canvas: 0 — чёрный, 255 — белый. */
  onLithophaneBrightnessChange: (brightness: number[]) => void;
  /** Форма кашпо в плане: круг, квадрат или шестигранник. */
  onPlanterShapeChange: (shape: PlanterShape) => void;
  /** Дренажные отверстия и поддон рядом с горшком. */
  onPlanterDrainageChange: (enabled: boolean) => void;
  /** Форма подставки под кружку в плане. */
  onCoasterShapeChange: (shape: CoasterShape) => void;
  /** Рельеф на лице подставки под кружку. */
  onCoasterPatternChange: (pattern: CoasterPattern) => void;
  /** Бортик по краю подставки под кружку. */
  onCoasterRimChange: (enabled: boolean) => void;
  /** Набор держателей стойки для украшений. */
  onJewelryConfigChange: (config: JewelryConfig) => void;
  /** Форма органайзера для ручек в плане. */
  onPenShapeChange: (shape: PenShape) => void;
  /** Разметка логотипа термопринта: текст SVG или контур, собранный из PNG. */
  onHeatTransferSvgChange: (svg: string) => void;
  /** Зеркало принта для переноса утюгом. */
  onHeatTransferMirrorChange: (enabled: boolean) => void;
  onReset: () => void;
};

/** Ошибка экспорта с подсказкой: войти заново или открыть пакет. */
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
          href="/courses/pro"
        >
          Открыть пакет «Всё включено»
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
 * Остальные кнопки подписаны деталью — «Блок 1: Крышка», «Рамка» или
 * «Подставка». Пока один файл генерируется, остальные заблокированы, а спиннер
 * крутится только на нажатой кнопке.
 */
function ExportButtons({
  options,
  exportingId,
  partsHeading,
  onExport,
  blockedReason,
}: {
  options: StlExportOption[];
  exportingId: string | null;
  /** Заголовок над компактными кнопками: детали вывески или литофана. */
  partsHeading: string | null;
  onExport: (option: StlExportOption) => void;
  /**
   * Причина, по которой скачивание запрещено. Сейчас она одна: NFC-карман не
   * вмещает метку 25 мм, и файл заведомо не годится для печати.
   */
  blockedReason: string | null;
}) {
  const [primary, ...parts] = options;

  if (!primary) {
    return null;
  }

  const isExporting = exportingId !== null;
  const isBlocked = blockedReason !== null;

  return (
    <>
      {blockedReason ? (
        <p
          className="mb-3 rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
          role="alert"
        >
          {blockedReason}
        </p>
      ) : null}

      <button
        aria-busy={exportingId === primary.id}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-wait disabled:bg-blue-600/60 disabled:text-white/80 disabled:shadow-none"
        disabled={isExporting || isBlocked}
        onClick={() => onExport(primary)}
        title={blockedReason ?? undefined}
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
                disabled={isExporting || isBlocked}
                key={option.id}
                onClick={() => onExport(option)}
                title={blockedReason ?? option.description}
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
  { id: "stand", icon: "📱", title: MODEL_TYPE_LABELS.stand },
  { id: "sign", icon: "🪧", title: MODEL_TYPE_LABELS.sign },
  { id: "box", icon: "📦", title: MODEL_TYPE_LABELS.box },
  { id: "lithophane", icon: "🖼️", title: MODEL_TYPE_LABELS.lithophane },
  { id: "planter", icon: "🪴", title: MODEL_TYPE_LABELS.planter },
  { id: "coaster", icon: "☕", title: MODEL_TYPE_LABELS.coaster },
  {
    id: "jewelry_stand",
    icon: "💍",
    title: MODEL_TYPE_LABELS.jewelry_stand,
  },
  { id: "pen_holder", icon: "🖊️", title: MODEL_TYPE_LABELS.pen_holder },
  {
    id: "heat_transfer",
    icon: "🖨️",
    title: MODEL_TYPE_LABELS.heat_transfer,
  },
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
  mushroom:
    "Гриб: узкая ножка и широкая шляпка сверху — читается как лампа или подсвечник.",
  bud:
    "Бутон: широкое основание сходится к узкой горловине, как нераскрывшийся цветок.",
  bottle:
    "Бутыль: широкое тулово, плечо и узкое горлышко — форма графина.",
  bubble:
    "Пузыри: три сферы, посаженные друг на друга, с мягкими перехватами.",
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
  basket:
    "Плетение: полосы по кругу и по высоте переплетаются «над-под», как в корзине. Частота задаёт число полос в каждом направлении.",
  chevron:
    "Шеврон: полосы идут под углом и ломаются в вершине галочки. Частота задаёт число галочек по кругу.",
  moire:
    "Муар: две решётки под прямым углом дают ромбическую сетку с биениями. Частота задаёт шаг обеих решёток.",
  flutes:
    "Каннелюры: узкие острые жёлоба и широкие гребни между ними — та же частота, что у рёбер, но форма другая.",
};

/**
 * Пояснения к слайдерам слоя.
 *
 * Тексты общие для всех слоёв: числа у них независимы, поэтому пояснение
 * описывает смысл параметра, а не конкретное значение.
 */
const PATTERN_LAYER_HINTS = {
  amplitude:
    "Насколько стенка уходит наружу и внутрь, мм: 0 — слой молчит, 1.2 мм — тонкие рёбра, 3 мм — глубокий рельеф. Сумма амплитуд всех слоёв автоматически делится до 45% самого узкого радиуса, поэтому композиция не вывернет стенку.",
  frequency:
    "Сколько раз рисунок повторяется по окружности: 6 — крупный, 20 — частые тонкие рёбра, 32 — предел, на котором сетка ещё различает гребни. Соты и чешуйки считают частоту вдвое мельче, каннелюры рисуют столько же жёлобов, сколько рёбер гребней.",
  phase:
    "Сдвиг рисунка по кругу, градусы. Нужен, чтобы совместить слои: два одинаковых узора с разницей 180° гасят друг друга, а сдвиг на полпериода рисует вторую сетку между первой.",
  fadeTop:
    "Сколько миллиметров у кромки рисунок гаснет: 5 мм — горло остаётся ровным кольцом, 30 мм — узор не доходит до горла вовсе. Гасим не для красоты: гребешок на венце печатается как брак.",
  fadeBottom:
    "Сколько миллиметров от дна рисунок гаснет: 3 мм — два слоя печати ложатся полным диском, 30 мм — узор начинается только в середине вазы.",
} as const;

/**
 * Есть ли на вазе что закручивать.
 *
 * Замер растеризатором: у гладкой вазы-цилиндра закрутка на 180° меняет 0.02%
 * кадров — геометрия та же, поворачивать нечего. У гранёной формы, каннелюр и
 * любого рельефного узора тот же поворот меняет 38–43% кадров. Слайдер
 * «Закрутка» показываем только во втором случае: иначе это поле, которое
 * человек честно двигает и не видит результата.
 *
 * Проверка повторяет то, что делает геометрия: грани силуэта приходят из
 * `resolveSectionSides`, а не только из слайдера «Грани».
 */
function vaseHasRelief(params: ConstructorParams): boolean {
  if (params.model !== "vase") {
    return false;
  }

  return (
    params.patterns.some((layer) => layer.type !== "smooth") ||
    params.flutes > 0 ||
    resolveSectionSides(params.shape, params.sectionSides) >=
      VASE_SECTION_MIN_SIDES
  );
}

/**
 * Значение списка «Форма брелока»: пресет из реестра или свой контур.
 *
 * Идентификаторы не пересекаются (`custom` не встречается среди пресетов),
 * поэтому один нативный список обслуживает оба набора без префиксов и групп.
 */
type KeychainShapeSelectValue = KeychainPresetId | KeychainShape;

/**
 * Пункты списка «Форма брелока».
 *
 * Девять пресетов идут первыми, «Свой SVG» — последним: пользователь видит
 * готовые формы там, где раньше начинался старый список силуэтов. Оба набора
 * статичные, поэтому массив собирается один раз при импорте модуля.
 */
const KEYCHAIN_SHAPE_OPTIONS: readonly {
  label: string;
  value: KeychainShapeSelectValue;
}[] = [
  ...KEYCHAIN_PRESETS.map((preset) => ({
    label: preset.label,
    value: preset.id,
  })),
  ...KEYCHAIN_SHAPES.map((shape) => ({
    label: KEYCHAIN_SHAPE_LABELS[shape],
    value: shape,
  })),
];

/**
 * Пункты списков QR-визитки.
 *
 * Подписи берутся из `qr-card-geometry.ts` — того же модуля, что строит матрицу и
 * геометрию: миллиметры в списке и в файле не могут разойтись.
 */
const QR_CARD_SIZE_OPTIONS: readonly {
  label: string;
  value: QrCardSize;
}[] = QR_CARD_SIZE_IDS.map((size) => ({
  label: QR_CARD_SIZE_LABELS[size],
  value: size,
}));

const QR_CARD_TAB_OPTIONS: readonly { label: string; value: QrCardTab }[] =
  QR_CARD_TABS.map((tab) => ({ label: QR_CARD_TAB_LABELS[tab], value: tab }));

const QR_MODE_OPTIONS: readonly { label: string; value: QrMode }[] =
  QR_MODES.map((mode) => ({ label: QR_MODE_LABELS[mode], value: mode }));

const QR_CONTENT_TYPE_OPTIONS: readonly {
  label: string;
  value: QrContentType;
}[] = QR_CONTENT_TYPES.map((type) => ({
  label: QR_CONTENT_TYPE_LABELS[type],
  value: type,
}));

/** Сжатая картинка: яркость для API и маленькое превью для панели. */
type LithophaneImage = {
  brightness: number[];
  preview: string;
};

/**
 * Сжимает выбранный файл до 400 × 400 и считает яркость пикселей.
 *
 * Полное фото нельзя класть в состояние: декодирование многомегапиксельного
 * кадра и передача его в three.js подвесили бы браузер. Canvas сразу уменьшает
 * картинку до 400 × 400, поэтому в React попадают 160 000 чисел, а не
 * 12 мегапикселей. Меньше нельзя: на панели 120 мм пиксель 150 × 150 — это
 * 0.8 мм, и тонкие линии логотипа сглаживались до «каши» ещё до геометрии.
 * Фон заливается белым: прозрачные участки PNG не должны стать чёрными и
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

/**
 * Рисует картинку в canvas и отдаёт пиксели сетки.
 *
 * Canvas — браузерная часть: в `raster-to-contours.ts` его нет, модуль работает
 * с готовым `Uint8ClampedArray`. Центральный квадрат сохраняет пропорции:
 * вытянутое фото не растянется.
 */
async function readImagePixels(
  file: File,
  gridSize: number,
): Promise<Uint8ClampedArray> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const size = Math.min(image.naturalWidth, image.naturalHeight);

  if (size < 1) {
    throw new Error("Изображение пустое или повреждено.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = gridSize;
  canvas.height = gridSize;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Браузер не смог подготовить canvas для контура.");
  }

  context.drawImage(
    image,
    (image.naturalWidth - size) / 2,
    (image.naturalHeight - size) / 2,
    size,
    size,
    0,
    0,
    gridSize,
    gridSize,
  );

  return context.getImageData(0, 0, gridSize, gridSize).data;
}

/**
 * Переводит картинку в SVG из горизонтальных полос.
 *
 * Полноценная трассировка кривых в браузере не нужна: брелок печатается
 * размером 30–100 мм, поэтому сетка 96 × 96 и склейка соседних пикселей в
 * полосы дают узнаваемый контур. Полосы — обычные `<rect>`, которые разбирает
 * серверный svg-outline.ts, а прозрачный фон PNG и белый фон JPG не попадают
 * в силуэт. Пиксели, маска и полосы живут в `raster-to-contours.ts`: здесь
 * остаются canvas и строка `<svg>`.
 */
async function rasterToContourSvg(file: File): Promise<string> {
  const pixels = await readImagePixels(file, CONTOUR_GRID_SIZE);
  const mask = binarizeByLuminance(
    pixels,
    CONTOUR_GRID_SIZE,
    CONTOUR_GRID_SIZE,
  );
  const rects = runsToRects(mask, CONTOUR_GRID_SIZE, CONTOUR_GRID_SIZE).map(
    (rect) =>
      `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="1"/>`,
  );

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

/**
 * Предел исходного файла картинки, байт.
 *
 * Маска всё равно сжимается до 96 пикселей по большей стороне, поэтому большой
 * файл — это только память браузера. 10 МБ хватает фотографии с телефона, а
 * случайный RAW-файл отсекается до чтения.
 */
const KEYCHAIN_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Пиксели картинки брелока: пропорции сохраняются, кадр не обрезается.
 *
 * У своего контура квадрат режет вытянутое фото по центру — там важен силуэт
 * целиком в квадрате. Логотип на брелоке, наоборот, приходит прямоугольным:
 * обрезка съела бы края картинки 3:1, поэтому в квадрат вписывается большая
 * сторона, а меньшая остаётся пропорциональной. Маска потом сама приводит
 * габарит к единице, и на грани логотип получает исходные пропорции.
 *
 * Сглаживание включено: уменьшение до 96 пикселей даёт субпиксельные переходы,
 * и обводка ведёт ровную границу, а не лестницу по целым пикселям.
 */
async function readKeychainImagePixels(file: File): Promise<{
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  if (file.size > KEYCHAIN_IMAGE_MAX_BYTES) {
    throw new Error(
      "Картинка больше 10 МБ. Сохраните её поменьше: на брелоке всё равно останется контур 96 пикселей.",
    );
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);

  if (longest < 2) {
    throw new Error("Изображение пустое или повреждено.");
  }

  // Меньшая сторона не опускается ниже двух пикселей: у полоски 100:1 иначе
  // получилась бы строка в один пиксель, из которой не собрать контур.
  const width = Math.max(
    2,
    Math.round((image.naturalWidth / longest) * KEYCHAIN_IMAGE_GRID),
  );
  const height = Math.max(
    2,
    Math.round((image.naturalHeight / longest) * KEYCHAIN_IMAGE_GRID),
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Браузер не смог подготовить canvas для картинки.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  return { pixels: context.getImageData(0, 0, width, height).data, width, height };
}

/**
 * Готовит `imageData` из файла PNG/JPG.
 *
 * В параметры уходит маска, а не файл: сервер не умеет декодировать PNG, зато
 * разбирает SVG тем же кодом, что силуэт брелока. Пустой рисунок и слишком
 * подробная картинка возвращаются текстом отказа — панель покажет его под
 * кнопкой, а прежняя маска останется в модели.
 */
async function keychainImageDataFromFile(file: File): Promise<string> {
  const { pixels, width, height } = await readKeychainImagePixels(file);
  const converted = keychainImageFromPixels(pixels, width, height);

  if ("error" in converted) {
    throw new Error(keychainImageErrorText(converted.error));
  }

  return converted.imageData;
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
 * Готовит логотип термопринта: SVG берётся как текст, PNG и WebP — контуром.
 *
 * В отличие от брелока кадр не обрезается до квадрата: логотип 3:1 должен
 * прийти 3:1, иначе габарит в миллиметрах исказил бы форму. Canvas есть только
 * в браузере, поэтому пиксели здесь, а пороги размеров, сетки и тексты отказов
 * живут в `heat-transfer-import.ts` — том же модуле, что строит разметку.
 *
 * «Нет прозрачности» — не отказ, поэтому возвращается предупреждением: фон
 * ушёл в силуэт по яркости, и об этом честно сообщает панель.
 */
async function heatTransferSvgFromFile(file: File): Promise<{
  svg: string;
  warning: HeatTransferWarning | null;
  lowResolution: boolean;
  contourCount: number | null;
  pointCount: number | null;
  /** Ширина рабочей сетки: по ней гистограмма штрихов переводится в мм. */
  gridWidth: number | null;
  strokes: StrokeHistogram | null;
}> {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);

  if (isSvg) {
    const svg = await readFileAsText(file);

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

    return {
      svg,
      warning: null,
      lowResolution: false,
      contourCount: null,
      pointCount: null,
      gridWidth: null,
      strokes: null,
    };
  }

  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const sourceError = checkHeatTransferSource({
    fileName: file.name,
    mimeType: file.type,
    bytes: file.size,
    width: image.naturalWidth,
    height: image.naturalHeight,
  });

  if (sourceError) {
    throw new Error(heatTransferSourceError(sourceError));
  }

  const grid = heatTransferGridSize(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = grid.width;
  canvas.height = grid.height;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Браузер не смог подготовить canvas для логотипа.");
  }

  // Сглаженное уменьшение и растяжение дают субпиксельные переходы: по ним
  // трассировка ведёт ровную границу, а не лестницу по целым пикселям.
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, grid.width, grid.height);

  const imported = rasterToHeatTransferSvg(
    context.getImageData(0, 0, grid.width, grid.height).data,
    grid.width,
    grid.height,
  );

  if (!imported.ok) {
    throw new Error(heatTransferImportError(imported.code));
  }

  return {
    svg: imported.svg,
    warning: imported.warning,
    lowResolution: longest < HEAT_TRANSFER_RECOMMENDED_SIDE_PX,
    contourCount: imported.contourCount,
    pointCount: imported.pointCount,
    gridWidth: grid.width,
    strokes: imported.strokes,
  };
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
 * Где стоит отверстие Ø5 мм у выбранного пресета.
 *
 * Числа берутся из констант геометрии, а не набираются здесь заново: подпись
 * «Готово» обещает ту же дырку, что уедет в STL. Ушко считается через
 * `protrudingTabLayout` — та же функция, что строит дугу пятака.
 */
function holePlacementNote(
  presetId: KeychainPresetId,
  params: ConstructorParams,
): string {
  const hole = `отверстие Ø${RING_HOLE_DIAMETER_MM} мм под кольцо`;

  switch (params.holePlacement) {
    case "left":
    case "right":
      return `${hole} ${params.holePlacement === "left" ? "слева" : "справа"}: ${ringHoleSideOffsetMm(presetId, params.width)} мм от оси и ${APPLE_TAG_RING_HOLE_INSET_MM} мм от верхнего края`;

    case "none":
      return "без отверстия под кольцо";

    case "tab": {
      const tab = protrudingTabLayout(params.length);

      return `ушко Ø${tab.diameterMm} мм сверху, ${hole} внутри ушка (габарит +${tab.protrusionMm} мм по высоте)`;
    }

    default:
      return `${hole} в ${APPLE_TAG_RING_HOLE_INSET_MM} мм от верхнего края`;
  }
}

/**
 * Фраза про отверстие Ø5 мм для подписи пресета.
 *
 * Подпись обещает ровно то, что вырезано: `none` — «без отверстия», боковая
 * позиция — сдвиг в миллиметрах из той же функции, что строит геометрию, `tab` —
 * ушко с числами из `protrudingTabLayout`. Так список и STL не могут разойтись.
 */
function ringPhrase(
  presetId: KeychainPresetId,
  params: ConstructorParams,
  centered: string,
  centeredNone: string | null = null,
  sided: (offsetMm: number, sideLabel: string) => string = (offsetMm, sideLabel) =>
    `отверстие Ø${RING_HOLE_DIAMETER_MM} мм сдвинуто на ${offsetMm} мм ${sideLabel}`,
): string {
  const placement = params.holePlacement;

  if (placement === "none") {
    return centeredNone ?? "без отверстия под кольцо";
  }

  if (placement === "tab") {
    const tab = protrudingTabLayout(params.length);

    return `ушко Ø${tab.diameterMm} мм сверху с отверстием Ø${RING_HOLE_DIAMETER_MM} мм внутри (габарит +${tab.protrusionMm} мм по высоте)`;
  }

  if (placement === "left" || placement === "right") {
    return sided(
      ringHoleSideOffsetMm(presetId, params.width),
      placement === "left" ? "влево" : "вправо",
    );
  }

  return centered;
}

/**
 * Подсказка под списком «Отверстие»: что именно меняется в геометрии.
 *
 * Первой идёт причина NFC-конфликта: если карман перекрывает отверстие, совет про
 * миллиметры сдвига только мешает. Дальше — ветка по позиции: у ушка габарит
 * растёт на выступ пятака, у остальных меняется только само отверстие. Ширина и
 * толщина не меняются никогда, о чём и говорит последняя фраза.
 */
function holePlacementHintText(
  presetId: KeychainPresetId | null,
  params: ConstructorParams,
  sideOffsetMm: number,
  sideWallMm: number | null,
  nfcConflictReason: string | null,
): string {
  if (params.nfcEnabled && nfcConflictReason) {
    return nfcConflictReason;
  }

  switch (params.holePlacement) {
    case "none":
      return `Отверстия не будет: брелок напечатается без крепления под кольцо${presetId === "ticket" ? ", проушина Ø11 мм остаётся частью силуэта" : ""}. Габарит и толщина не меняются.`;

    case "tab": {
      const tab = protrudingTabLayout(params.length);

      return `Ушко Ø${tab.diameterMm} мм выступает на ${tab.protrusionMm} мм над верхним краем, отверстие Ø${RING_HOLE_DIAMETER_MM} мм — внутри ушка. Габарит по высоте ${params.length + tab.protrusionMm} мм вместо ${params.length}, ширина и толщина не меняются.`;
    }

    case "left":
    case "right":
      return `Смещение ${sideOffsetMm} мм от оси${sideWallMm !== null ? `, стенка до кромки ${sideWallMm.toFixed(1)} мм` : ""}, высота отверстия прежняя${presetId === "apple-tag" ? ` — ${APPLE_TAG_RING_HOLE_INSET_MM} мм от верхнего края` : ""}. Габарит и толщина не меняются.`;

    default:
      return `Отверстие Ø${RING_HOLE_DIAMETER_MM} мм по центру силуэта${presetId === "apple-tag" ? ` в ${APPLE_TAG_RING_HOLE_INSET_MM} мм от верхнего края` : ""}: остальные размеры не меняются.`;
  }
}

/**
 * Что именно строит геометрия готового пресета брелока.
 *
 * Числа берутся из параметров, а не из реестра: геометрия читает миллиметры
 * слайдеров, поэтому плашка с размерами по умолчанию обещала бы не тот файл,
 * который скачается. Строка для пресета без геометрии — общая заглушка: её
 * всё равно перекрывает плашка «в работе».
 */
function presetReadyNote(
  presetId: KeychainPresetId,
  params: ConstructorParams,
): string {
  switch (presetId) {
    case "apple-tag":
      return `скруглённый прямоугольник ${params.width} × ${params.length} мм со скруглением 4 мм, ${holePlacementNote(presetId, params)}`;
    case "capsule":
      return `капсула ${params.width} × ${params.length} мм с торцами-полукругами, ${ringPhrase("capsule", params, "отверстие Ø5 мм в верхней части")}`;
    case "hex":
      return `шестигранник ${params.width} × ${params.length} мм со скруглёнными углами, ${ringPhrase("hex", params, "отверстие Ø5 мм в верхней части")}`;
    case "gear": {
      const layout = gearLayout(params.width, params.length);
      const ring =
        layout.ringY > 0
          ? `отверстие Ø5 мм на ${layout.ringY.toFixed(1)} мм выше центра, между ступицей и верхним зубом (стенка до ступицы ${layout.ringWallMm.toFixed(1)} мм)`
          : `отверстие Ø5 мм по центру ступицы (стенка ${layout.ringWallMm.toFixed(1)} мм)`;

      return `шестерня Ø${layout.diameterMm.toFixed(1)} мм (вписана в ${params.width} × ${params.length} мм): ${layout.teeth} зубьев с модулем ${layout.moduleMm.toFixed(2)} мм и шагом ${layout.pitchMm.toFixed(1)} мм, впадина до Ø${(layout.rootRadiusMm * 2).toFixed(1)} мм, ступица Ø${layout.hubDiameterMm.toFixed(1)} мм с выступом 0.6 мм, ${ringPhrase("gear", params, ring, "без отверстия под кольцо — ступица сплошная")}`;
    }
    case "brick": {
      const studs = brickStudLayout(params.width, params.length);

      return `LEGO-кирпич ${params.width} × ${params.length} мм, шипы Ø4.7 мм (компенсация под FDM) шагом 8 мм: ${studs.total} шт. (${studs.columns} × ${studs.rows}), ${ringPhrase("brick", params, "отверстие Ø5 мм в верхней части")}`;
    }
    case "ticket": {
      const layout = ticketLayout(params.width, params.length);

      return `билет ${params.width} × ${params.length} мм с корешком ${layout.stubHeight.toFixed(1)} мм снизу, перфорацией (${layout.slotCount} шт. щелей 4×0.9 мм с перемычкой 2.6 мм и вырезами R2.5 на кромках) и проушиной Ø11 мм ${ringPhrase("ticket", params, "с отверстием Ø5 мм", "без отверстия")} (габарит по высоте ${params.length + layout.tabProtrusion} мм)`;
    }
    case "starburst": {
      const layout = starburstLayout(params.width, params.length);
      const shortestRay = Math.min(...layout.rayLengths);
      const longestRay = Math.max(...layout.rayLengths);

      return `вспышка: ${layout.rayCount} лучей через ${layout.pitchDeg}° разной длины (${shortestRay.toFixed(1)}–${longestRay.toFixed(1)} мм от центра, вписана в ${layout.sizeMm} × ${layout.sizeMm} мм с полем 2 мм от кромки заготовки), кончик R${layout.rays[0].tipRadiusMm.toFixed(1)} мм под ${layout.tipAngleMinDeg.toFixed(0)}–${layout.tipAngleMaxDeg.toFixed(0)}°, ${ringPhrase("starburst", params, `отверстие Ø5 мм в верхнем луче на ${layout.ringY.toFixed(1)} мм от центра (стенка до кромки ${layout.rimWidthMm.toFixed(1)} мм)`)}`;
    }
    case "heart": {
      const layout = heartLayout(params.width, params.length);
      const ringY = layout.ringY.toFixed(1);
      const wall = layout.ringWallMm.toFixed(1);
      const ring = ringPhrase(
        "heart",
        params,
        `отверстие Ø5 мм по центру на ${ringY} мм от центра (стенка до дна выемки ${wall} мм)`,
        "без отверстия под кольцо",
        (offsetMm, sideLabel) =>
          `отверстие Ø5 мм сдвинуто на ${offsetMm} мм ${sideLabel} на ${ringY} мм от центра (стенка до кромки ${(ringHoleSideWallMm("heart", params) ?? 0).toFixed(1)} мм, до дна выемки ${wall} мм)`,
      );

      return `сердце ${params.width} × ${params.length} мм: доли с выемкой ${layout.valleyDepthMm.toFixed(1)} мм (дно R${layout.valleyRadiusMm.toFixed(1)} мм), плечи на ${layout.shoulderY.toFixed(1)} мм выше центра, кончик R${layout.tipRadiusMm.toFixed(1)} мм под ${((layout.tipAngle * 180) / Math.PI).toFixed(0)}°, ${ring}`;
    }
    case "qr-card": {
      const plan = qrCardPlan(keychainQrCardSpec(params));

      return `${QR_CARD_SIZE_LABELS[plan.spec.size]}, ${qrCardReport(plan)} Тёмные модули ${plan.spec.mode === "raised" ? "выступают на 0.4 мм" : "утоплены на 0.3 мм"}`;
    }
    default:
      return `форма ${params.width} × ${params.length} мм, отверстие Ø5 мм под кольцо`;
  }
}

/**
 * Три главных размера выбранной модели для нижней сводки панели.
 *
 * Функция, а не каскад тернарников: моделей много, а сводка у каждой — это
 * ровно три пары «подпись — значение». Логотип термопринта приходит флагом:
 * сама панель знает, загружен ли контур, а сводка только показывает это.
 */
function modelSummary(
  params: ConstructorParams,
  hasHeatTransferLogo: boolean,
): { label: string; value: string }[] {
  if (params.model === "vase") {
    return [
      { label: "Высота", value: `${params.height} мм` },
      { label: "Диаметр", value: `Ø ${params.diameter} мм` },
      { label: "Стенка", value: `${params.wall.toFixed(1)} мм` },
    ];
  }

  if (params.model === "keychain") {
    return [
      { label: "Длина", value: `${params.length} мм` },
      { label: "Ширина", value: `${params.width} мм` },
      { label: "Толщина", value: `${params.thickness.toFixed(1)} мм` },
    ];
  }

  if (params.model === "stand") {
    return [
      { label: "Наклон", value: `${params.standAngle}°` },
      { label: "Телефон", value: `${params.phoneThickness} мм` },
      { label: "Ширина", value: `${params.standWidth} мм` },
    ];
  }

  if (params.model === "box") {
    return [
      { label: "Длина", value: `${params.boxLength} мм` },
      { label: "Ширина", value: `${params.boxWidth} мм` },
      { label: "Ячейки", value: `${params.gridX} × ${params.gridY}` },
    ];
  }

  if (params.model === "lithophane") {
    return [
      { label: "Ширина", value: `${params.lithophaneWidth} мм` },
      { label: "Высота", value: `${params.lithophaneHeight} мм` },
      {
        label: "Рельеф",
        value: `${params.lithophaneMinThickness.toFixed(1)}–${params.lithophaneMaxThickness.toFixed(1)} мм`,
      },
    ];
  }

  if (params.model === "planter") {
    return [
      { label: "Габарит", value: `${params.planterSize} мм` },
      { label: "Высота", value: `${params.planterHeight} мм` },
      { label: "Стенка", value: `${params.planterWall.toFixed(1)} мм` },
    ];
  }

  if (params.model === "coaster") {
    return [
      { label: "Габарит", value: `${params.coasterSize} мм` },
      {
        label: "Толщина",
        value: `${params.coasterThickness.toFixed(1)} мм`,
      },
      { label: "Узор", value: COASTER_PATTERN_LABELS[params.coasterPattern] },
    ];
  }

  if (params.model === "jewelry_stand") {
    return [
      { label: "Высота", value: `${params.jewelryHeight} мм` },
      { label: "Основание", value: `Ø ${params.jewelryBase} мм` },
      { label: "Держатели", value: JEWELRY_CONFIG_LABELS[params.jewelryConfig] },
    ];
  }

  if (params.model === "pen_holder") {
    return [
      { label: "Габарит", value: `${params.penSize} мм` },
      { label: "Высота", value: `${params.penHeight} мм` },
      { label: "Отделения", value: `${params.penSections} шт.` },
    ];
  }

  if (params.model === "heat_transfer") {
    return [
      {
        label: "Габарит",
        value: `${params.heatTransferWidth} × ${params.heatTransferHeight} мм`,
      },
      {
        label: "Толщина",
        value: `${heatTransferThickness(params.heatTransferLayers).toFixed(1)} мм`,
      },
      { label: "Логотип", value: hasHeatTransferLogo ? "загружен" : "нет" },
    ];
  }

  return [
    { label: "Кегль", value: `${params.signFontSize} мм` },
    { label: "Выступ", value: `${params.signDepth} мм` },
    { label: "Канал", value: `${params.signChannelWidth} мм` },
  ];
}

/**
 * Панель параметров модели.
 *
 * Тип модели и её варианты (форма, узор, шрифт, канал, крепление) выбираются
 * выпадающими списками, размеры меняют слайдеры, а имя, надпись и фото —
 * текстовое поле и загрузка файла. У брелока появляются длина, ширина,
 * толщина, силуэт, своя загрузка контура и карман под NFC-метку. У подставки —
 * наклон, толщина телефона и ширина, у вывески — надпись, кегль, выступ букв и
 * ширина канала под ленту, у коробки — пресеты, ширины ячеек текстом, размеры,
 * стенку и крышку, у литофана — фото, превью и толщины, у кашпо — форма,
 * высота, стенка и дренаж, у подставки под кружку — форма, узор, бортик и
 * толщина, у стойки украшений — высота, основание и набор держателей.
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
  onRandomizeVase,
  onPatternLayerChange,
  onAddPatternLayer,
  onRemovePatternLayer,
  onKeychainShapeChange,
  onKeychainPresetChange,
  onKeychainDecorationChange,
  onAddKeychainText,
  onAddKeychainImage,
  onRemoveKeychainDecoration,
  keychainReport,
  onCustomSvgChange,
  onNfcChange,
  onHolePlacementChange,
  onQrCardSizeChange,
  onQrCardTabChange,
  onQrModeChange,
  onQrContentTypeChange,
  onQrContentChange,
  onQrNameChange,
  onQrPhoneChange,
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
  onPlanterShapeChange,
  onPlanterDrainageChange,
  onCoasterShapeChange,
  onCoasterPatternChange,
  onCoasterRimChange,
  onJewelryConfigChange,
  onPenShapeChange,
  onHeatTransferSvgChange,
  onHeatTransferMirrorChange,
  onReset,
}: ParameterPanelProps) {
  const isExporting = exportingId !== null;
  const keychainTextInputId = useId();
  const keychainTextHintId = `${keychainTextInputId}-hint`;
  const signTextInputId = useId();
  const signTextHintId = `${signTextInputId}-hint`;
  const signTextLength = Array.from(params.signText).length;
  const lithophaneInputId = useId();
  const lithophaneHintId = `${lithophaneInputId}-hint`;
  const keychainContourInputId = useId();
  const keychainContourHintId = `${keychainContourInputId}-hint`;
  const keychainImageInputId = useId();
  const keychainImageHintId = `${keychainImageInputId}-hint`;
  const qrContentInputId = useId();
  const qrNameInputId = useId();
  const qrPhoneInputId = useId();
  const boxCellsXInputId = useId();
  const boxCellsYInputId = useId();
  const heatTransferInputId = useId();
  const heatTransferHintId = `${heatTransferInputId}-hint`;
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessingContour, setIsProcessingContour] = useState(false);
  const [contourError, setContourError] = useState<string | null>(null);
  const [contourFileName, setContourFileName] = useState<string | null>(null);
  const [isProcessingKeychainImage, setIsProcessingKeychainImage] =
    useState(false);
  const [keychainImageError, setKeychainImageError] = useState<string | null>(
    null,
  );
  const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferFileName, setTransferFileName] = useState<string | null>(null);
  const [transferWarning, setTransferWarning] = useState<string | null>(null);
  const [transferStats, setTransferStats] = useState<{
    contourCount: number;
    pointCount: number;
  } | null>(null);
  const [transferStrokes, setTransferStrokes] = useState<{
    strokes: StrokeHistogram;
    gridWidth: number;
  } | null>(null);
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
   * Картинка ушла из модели (её удалили или загрузился другой проект) — ошибка
   * обработки файла больше не нужна: она относилась к прежней карточке.
   */
  useEffect(() => {
    if (!keychainImageDecoration(params.decorations)) {
      setKeychainImageError(null);
    }
  }, [params.decorations]);

  /**
   * Демонстрационный массив живёт в DEFAULT_LITHOPHANE_PARAMS и после сброса
   * возвращается по ссылке. Сравнение ссылок показывает, загружено ли фото,
   * не копируя 160 000 чисел при каждой отрисовке.
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

      // Сначала данные, потом форма: обновление формы само снимает пресет, а
      // обратный порядок оставил бы в модели пресет без загруженного контура.
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

  /**
   * Возвращает форму к пресету по умолчанию.
   *
   * Загруженный контур стирается вместе с пресетом: без файла `custom` — форма
   * без геометрии, и сервер не примет такой брелок. Нормализация сама подставит
   * первый пресет реестра, потому что встроенных силуэтов больше нет.
   */
  function resetKeychainContour() {
    onCustomSvgChange("");
    onKeychainShapeChange(null);
    setContourFileName(null);
    setContourError(null);
  }

  /**
   * Загружает картинку на грань брелока.
   *
   * Файл превращается в маску прямо в браузере: сервер получает уже готовую
   * строку `imageData` и не зависит от того, чем браузер декодировал JPEG. Поле
   * очищается до await, иначе повторный выбор того же файла не вызвал бы change.
   * Ошибка остаётся в панели: прежняя картинка в модели не портится.
   *
   * Масштаб и смещения не сбрасываются: пользователь мог подобрать место, а
   * замена картинки на похожий логотип — это правка, а не новый брелок. Если
   * новая маска крупнее, геометрия сама ужмёт её по свободной полосе.
   */
  async function handleKeychainImageChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    setIsProcessingKeychainImage(true);
    setKeychainImageError(null);

    try {
      const imageData = await keychainImageDataFromFile(file);

      onAddKeychainImage(imageData, file.name);
    } catch (error) {
      setKeychainImageError(
        error instanceof Error
          ? error.message
          : "Не удалось обработать картинку. Попробуйте PNG с прозрачным фоном.",
      );
    } finally {
      setIsProcessingKeychainImage(false);
    }
  }

  /**
   * Убирает картинку из модели.
   *
   * Вместе с маской уходят её масштаб и смещения: карточки «Картинка» больше нет, и
   * держать настройки невидимого рельефа незачем. Вернуть логотип можно кнопкой
   * «Добавить картинку» — файл придётся выбрать заново.
   */
  function removeKeychainImage() {
    onRemoveKeychainDecoration("image");
    setKeychainImageError(null);
  }

  /**
   * Загружает логотип термопринта.
   *
   * Разметка уходит в параметры сразу после разбора: сцена и STL читают её из
   * одного поля, поэтому предпросмотр не может разойтись с файлом. Имя файла и
   * счётчики контуров живут в состоянии панели: в `params_json` им места нет, а
   * после загрузки сохранённого проекта панель честно покажет «логотип есть» без
   * подробностей.
   *
   * Старое предупреждение сбрасывается до разбора: иначе совет от прошлого
   * файла висел бы над новым логотипом.
   */
  async function handleHeatTransferFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    setIsProcessingTransfer(true);
    setTransferError(null);
    setTransferWarning(null);
    setTransferStats(null);
    setTransferStrokes(null);

    try {
      const result = await heatTransferSvgFromFile(file);

      onHeatTransferSvgChange(result.svg);
      setTransferFileName(file.name);
      setTransferWarning(
        result.warning === "no_transparency"
          ? HEAT_TRANSFER_NO_TRANSPARENCY_HINT
          : result.lowResolution
            ? HEAT_TRANSFER_LOW_RESOLUTION_HINT
            : null,
      );
      setTransferStats(
        result.contourCount !== null && result.pointCount !== null
          ? {
              contourCount: result.contourCount,
              pointCount: result.pointCount,
            }
          : null,
      );
      setTransferStrokes(
        result.strokes !== null && result.gridWidth !== null
          ? { strokes: result.strokes, gridWidth: result.gridWidth }
          : null,
      );
    } catch (error) {
      setTransferError(
        error instanceof Error
          ? error.message
          : "Не удалось обработать логотип. Попробуйте другой файл.",
      );
    } finally {
      setIsProcessingTransfer(false);
    }
  }

  /** Убирает логотип: без разметки термопринт нечего печатать. */
  function resetHeatTransferLogo() {
    onHeatTransferSvgChange("");
    setTransferFileName(null);
    setTransferError(null);
    setTransferWarning(null);
    setTransferStats(null);
    setTransferStrokes(null);
  }

  /**
   * Выбор в списке «Форма брелока».
   *
   * Список общий для пресетов и своего контура, но активным остаётся ровно один
   * пункт: выбор пресета обнуляет контур, выбор «Свой SVG» снимает пресет — это
   * делает `updateKeychainShape` в `ConstructorClient`. Поэтому форма в модели,
   * подпись в сводке и файл STL всегда совпадают.
   */
  function handleKeychainShapeSelect(value: KeychainShapeSelectValue) {
    if (isKeychainPresetId(value)) {
      onKeychainPresetChange(value);
      return;
    }

    onKeychainShapeChange(value);
  }

  /** Данные выбранного пресета: подпись, пояснение и готовность геометрии. */
  const selectedKeychainPreset = params.keychainPreset
    ? keychainPresetById(params.keychainPreset)
    : null;
  const selectedPresetReady =
    selectedKeychainPreset !== null &&
    isKeychainPresetImplemented(selectedKeychainPreset.id);

  /**
   * Есть ли логотип у термопринта.
   *
   * Нормализация оставляет в поле только разметку с контуром, поэтому пустая
   * строка означает ровно «файла нет»: сервер такой запрос отклонит, и панель
   * говорит об этом заранее, а не после нажатия «Скачать STL».
   */
  const hasHeatTransferLogo =
    isCustomSvgData(params.heatTransferSvg) &&
    hasDrawableSvgData(params.heatTransferSvg);

  /** Надпись и картинка брелока: карточки блока «Декор» строятся по ним. */
  const keychainText = keychainTextDecoration(params.decorations);
  const keychainImage = keychainImageDecoration(params.decorations);
  const keychainQr = keychainQrDecoration(params.decorations);
  const keychainTextLength = keychainText
    ? Array.from(keychainText.content).length
    : 0;
  /**
   * Что вышло из картинки при последней сборке.
   *
   * Отчёт приходит из сцены: карту грани знает только геометрия, и повторять её
   * расчёт в панели значило бы держать вторую копию правил размещения.
   * `side === null` — картинка не встала ни на лицо, ни на оборот; `scale` меньше
   * `requested` — она ужалась, чтобы обойти буквы и кромку.
   */
  const keychainImageFit =
    keychainReport?.decorations.find((fit) => fit.kind === "image") ?? null;
  const keychainImageStatus =
    !keychainImage || !keychainImageFit
      ? null
      : keychainImageFit.side === null
        ? {
            tone: "error" as const,
            text: "Картинка не поместилась: грань занята буквами и отверстием. Уменьшите масштаб, смените сторону или уберите надпись.",
          }
        : keychainImageFit.scale < keychainImageFit.requested - 0.001
          ? {
              tone: "warning" as const,
              text: `Картинка ужалась до ${Math.round(keychainImageFit.scale * 100)}% запрошенного размера: ${keychainImageFit.size.toFixed(1)} мм на ${keychainImageFit.side === "back" ? "обороте" : "лице"}. Освободите место или уменьшите масштаб логотипа.`,
            }
          : {
              tone: "ok" as const,
              text: `Картинка стоит на ${keychainImageFit.side === "back" ? "обороте" : "лице"}: ${keychainImageFit.size.toFixed(1)} мм по большей стороне, рельеф ${keychainImage.depth.toFixed(1)} мм.`,
            };

  /**
   * Читаемость логотипа при текущей ширине детали.
   *
   * В пикселях штрихи не меняются, а в миллиметрах зависят от
   * `heatTransferWidth`: поэтому расчёт идёт на каждом рендере, и совет
   * «увеличьте до N мм» всегда соответствует положению слайдера, а не моменту
   * загрузки файла.
   */
  const transferStrokeHint = useMemo(() => {
    if (!transferStrokes) {
      return null;
    }

    return heatTransferStrokeHint(
      heatTransferLegibility(
        transferStrokes.strokes,
        transferStrokes.gridWidth,
        params.heatTransferWidth,
      ),
    );
  }, [transferStrokes, params.heatTransferWidth]);

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
  /**
   * NFC-карман для текущих параметров: сторона в свету, зазор под метку и слой
   * паузы. Считается теми же функциями, что и геометрия, поэтому подсказка не
   * может разойтись с моделью.
   */
  const nfcFit = useMemo(
    () =>
      params.model === "keychain" && params.nfcEnabled
        ? measureKeychainNfc(params)
        : null,
    [params],
  );

  /** Слои кармана: пауза стоит на верхе задней части, лицо идёт поверх метки. */
  const nfcLayers = keychainNfcLayers(params.thickness);

  /**
   * Раскладка кармана у выбранного пресета.
   *
   * Считается той же `nfcLayout`, что и геометрия: радиус полости, границы зон,
   * пауза и причина отказа берутся из одного места, поэтому подсказка «пауза на
   * Z = 2.35 мм» не может разойтись с моделью. Для своего контура — null: у него
   * карман квадратный и считается по `measureKeychainNfc`.
   */
  const presetNfc = params.keychainPreset
    ? nfcLayout(params.keychainPreset, {
        width: params.width,
        height: params.length,
        thickness: params.thickness,
        nfcEnabled: params.nfcEnabled,
        // Позиция отверстия важна и здесь: карман и боковое отверстие могут
        // пересечься, и `nfcLayout` вернёт причину для красной плашки.
        holePlacement: params.holePlacement,
        qr:
          params.keychainPreset === "qr-card"
            ? keychainQrCardSpec(params)
            : null,
      })
    : null;

  /** Почему пресет не получит карман: силуэт не держит метку или основа тонкая. */
  const presetNfcBlocked = presetNfc?.blockedReason ?? null;

  /** Пауза и пластик над карманом пресета без хвостовых нулей: 1.8 и 1.7. */
  const presetNfcPauseLabel = presetNfc
    ? Number(presetNfc.pauseZ.toFixed(2)).toString()
    : "";
  const presetNfcLidLabel = presetNfc
    ? Number(presetNfc.lidMm.toFixed(2)).toString()
    : "";
  const presetNfcDiameterLabel = presetNfc
    ? Number((presetNfc.radiusMm * 2).toFixed(1)).toString()
    : "";
  const presetNfcLipLabel = presetNfc
    ? Number((presetNfc.lipRadiusMm * 2).toFixed(0)).toString()
    : "";
  const presetNfcFloorLabel = presetNfc
    ? Number(presetNfc.floorMm.toFixed(1)).toString()
    : "";
  const presetNfcCavityLabel = presetNfc
    ? Number(presetNfc.cavityHeightMm.toFixed(1)).toString()
    : "";

  /**
   * Почему NFC-брелок нельзя скачать. Пусто — карман есть и метка влезает.
   *
   * У своего контура карман квадратный: у узкого силуэта 25 мм не влезают вовсе
   * и карман не режется, у остальных он выходит меньше метки. У пресета причина
   * одна — `nfcLayout` уже знает и про силуэт, и про толщину. Раньше такой файл
   * молча уходил в печать, хотя метку в него не вложить.
   */
  const nfcBlockReason = nfcFit
    ? nfcFit.cavityMm <= 0
      ? "Этот контур не поддерживает NFC-метку: карман под квадрат 25 × 25 мм не вырезается. Загрузите контур шире или выключите карман."
      : nfcFit.fits
        ? null
        : `Карман под метку не помещается: в этом контуре максимум ${nfcFit.cavityMm.toFixed(1)} × ${nfcFit.cavityMm.toFixed(1)} мм при метке ${KEYCHAIN_NFC_TAG_MM} × ${KEYCHAIN_NFC_TAG_MM} мм. Загрузите контур шире или выключите карман.`
    : params.nfcEnabled
      ? presetNfcBlocked
      : null;

  /**
   * Почему нельзя скачать STL из-за выбранной формы.
   *
   * Геометрия есть у всех девяти пресетов, поэтому причина одна: пресет в
   * разработке. Она важнее причины NFC — пользователь только что выбрал форму.
   */
  const presetBlockReason =
    params.keychainPreset && !selectedPresetReady
      ? "Этот пресет ещё в разработке. Выберите готовый пресет или свой контур."
      : null;

  /**
   * Раскладка QR-визитки: матрица, размер модуля и причина отказа.
   *
   * Считается теми же функциями, что и геометрия, поэтому плашка «модуль 0.85 мм»
   * и скачанный файл всегда про один и тот же код. Для остальных пресетов — null.
   */
  const qrCardLayoutPlan = useMemo(
    () =>
      params.keychainPreset === "qr-card"
        ? qrCardPlan(keychainQrCardSpec(params))
        : null,
    [params],
  );

  /** Почему визитку нельзя скачать: содержимое не годится или код слишком плотный. */
  const qrBlockReason = qrCardLayoutPlan
    ? (qrCardLayoutPlan.contentError ?? qrCardLayoutPlan.layout.blockedReason)
    : null;

  /**
   * Поле содержимого: у ссылки, телефона и почты разные подпись, подсказка и
   * клавиатура. У визитки поля нет — там имя и телефон.
   */
  const qrContentField =
    (keychainQr?.qrContentType ?? "url") === "tel"
      ? {
          label: "Телефон",
          placeholder: "+7 900 123-45-67",
          inputMode: "tel" as const,
        }
      : (keychainQr?.qrContentType ?? "url") === "email"
        ? {
            label: "Почта",
            placeholder: "name@example.ru",
            inputMode: "email" as const,
          }
        : {
            label: "Ссылка",
            placeholder: "https://tridi.ru",
            inputMode: "url" as const,
          };

  /** Границы толщины выбранного пресета: у визитки они свои. */
  const keychainThickness = keychainThicknessLimits(params.keychainPreset);

  /**
   * Пункты списка «Отверстие»: только позиции, которые держит силуэт.
   *
   * Список берётся из реестра: Apple Tag заявляет пять позиций (включая ушко),
   * Heart — четыре, Brick — три, остальные простые силуэты — центр и «без
   * отверстия», у QR-визитки крепление своё и список пуст, поэтому селекта у неё
   * нет вовсе — обещать позицию, которую геометрия не строит, было бы обманом.
   */
  const holePlacementOptions = (
    selectedKeychainPreset?.holePlacements ?? []
  ).map((placement) => ({
    value: placement,
    label: HOLE_PLACEMENT_LABELS[placement],
  }));

  /** Сдвиг бокового отверстия от оси, мм: та же функция, что режет STL. */
  const holeSideOffsetMm = params.keychainPreset
    ? ringHoleSideOffsetMm(params.keychainPreset, params.width)
    : 0;

  /**
   * Стенка от бокового отверстия до кромки, мм.
   *
   * Считает геометрия, а не панель: у сердца кромка на высоте отверстия идёт по
   * внешней ветви доли, и ширина слайдера здесь ничего не обещает. null —
   * отверстие по центру или позиция силуэту недоступна.
   */
  const holeSideWallMm = params.keychainPreset
    ? ringHoleSideWallMm(params.keychainPreset, {
        width: params.width,
        height: params.length,
        thickness: params.thickness,
        holePlacement: params.holePlacement,
      })
    : null;

  /** Куда переехало отверстие и что при этом не изменилось: у каждого силуэта своё. */
  const holePlacementHint = holePlacementHintText(
    params.keychainPreset ?? null,
    params,
    holeSideOffsetMm,
    holeSideWallMm,
    params.nfcEnabled ? (presetNfc?.holeConflictReason ?? null) : null,
  );

  /** Итоговая причина, по которой кнопки скачивания заблокированы. */
  const exportBlockReason =
    presetBlockReason ?? qrBlockReason ?? nfcBlockReason;

  /** Пауза и пластик над карманом без хвостовых нулей: 1.05 и 1.95. */
  const nfcPauseLabel = Number(nfcLayers.pauseZ.toFixed(2)).toString();
  const nfcTopLabel = Number(nfcLayers.topMm.toFixed(2)).toString();

  /**
   * Заголовок над компактными кнопками. У вывески и литофана файлов несколько —
   * детали печатаются по отдельности, — поэтому список кнопок подписан: иначе
   * «1 · крышка» и «2 · лицо» выглядели бы загадочно.
   */
  const partsHeading =
    params.model === "sign" || params.model === "lithophane"
      ? "Детали модели"
      : null;

  /** Три главных размера выбранной модели для нижней сводки. */
  const summary = modelSummary(params, hasHeatTransferLogo);

  /**
   * Общие поля декорации: сторона, поворот, толщина, рельеф и смещения.
   *
   * Одна разметка на текст и картинку: у обоих видов эти поля значат одно и то же,
   * и отдельная копия слайдеров разошлась бы с другой при первой правке.
   */
  function renderDecorationCommon(decoration: KeychainDecoration) {
    const kindLabel = KEYCHAIN_DECORATION_KIND_LABELS[decoration.kind];

    return (
      <>
        <ParameterSelect
          hint={`Куда поставить ${kindLabel.toLowerCase()}. «Любая сторона» пробует лицо, а если там нет места — оборот. «Только лицо» и «только оборот» — просьба: если места нет, рельеф не печатается, и об этом скажет плашка выше.`}
          label="Сторона"
          onChange={(value) =>
            onKeychainDecorationChange(decoration.kind, {
              side: value as KeychainDecorationSide,
            })
          }
          options={KEYCHAIN_DECORATION_SIDES.map((side) => ({
            label: KEYCHAIN_DECORATION_SIDE_LABELS[side],
            value: side,
          }))}
          value={decoration.side}
        />

        <ParameterSelect
          hint="Поворот в плоскости грани. 90° и 270° дают вертикальный рельеф, 45° и 135° — угловой: габарит после поворота считается по крайним точкам, поэтому косой рельеф встаёт мельче прямого, но целиком."
          label="Поворот"
          onChange={(value) =>
            onKeychainDecorationChange(decoration.kind, {
              rotation: value as KeychainRotation,
            })
          }
          options={KEYCHAIN_DECORATION_ROTATIONS.map((rotation) => ({
            label: `${rotation}°`,
            value: rotation,
          }))}
          value={decoration.rotation}
        />

        <NumberSlider
          decimals={KEYCHAIN_DECORATION_DEPTH_LIMITS.decimals}
          hint="Насколько рельеф выступает над пластиком. Внедрение в тело остаётся 0.35 мм: 0.2 мм — почти гравировка, 1 мм — выпуклый рельеф, который читается на ощупь."
          label="Толщина рельефа"
          max={KEYCHAIN_DECORATION_DEPTH_LIMITS.max}
          min={KEYCHAIN_DECORATION_DEPTH_LIMITS.min}
          onChange={(value) =>
            onKeychainDecorationChange(decoration.kind, { depth: value })
          }
          step={KEYCHAIN_DECORATION_DEPTH_LIMITS.step}
          unit="мм"
          value={decoration.depth}
        />

        <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition-colors hover:border-white/25 hover:bg-white/5">
          <input
            checked={decoration.emboss}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            onChange={(event) =>
              onKeychainDecorationChange(decoration.kind, {
                emboss: event.target.checked,
              })
            }
            type="checkbox"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-200">
              Выступает над пластиком
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-300">
              Снятая галочка утопляет рельеф: вокруг остаётся поле толщиной с
              рельеф, а сам рисунок лежит на лице. Вычитания в модели нет —
              утопление печатается плитой с окнами, как углублённый QR-код.
            </span>
          </span>
        </label>

        <NumberSlider
          decimals={KEYCHAIN_DECORATION_OFFSET_LIMITS.decimals}
          hint="Сдвигает рельеф к левому или правому краю. Смещение — просьба: геометрия обрезает его по свободному месту грани, и рельеф останавливается на границе, а не уезжает с детали."
          label="Смещение по горизонтали"
          max={KEYCHAIN_DECORATION_OFFSET_LIMITS.max}
          min={KEYCHAIN_DECORATION_OFFSET_LIMITS.min}
          onChange={(value) =>
            onKeychainDecorationChange(decoration.kind, { offsetX: value })
          }
          step={KEYCHAIN_DECORATION_OFFSET_LIMITS.step}
          unit="мм"
          value={decoration.offsetX}
        />

        <NumberSlider
          decimals={KEYCHAIN_DECORATION_OFFSET_LIMITS.decimals}
          hint="Сдвигает рельеф выше или ниже. Вверх путь упирается в отверстие под кольцо, вниз — в нижнюю кромку силуэта: дальше смещение обрезается само."
          label="Смещение по вертикали"
          max={KEYCHAIN_DECORATION_OFFSET_LIMITS.max}
          min={KEYCHAIN_DECORATION_OFFSET_LIMITS.min}
          onChange={(value) =>
            onKeychainDecorationChange(decoration.kind, { offsetY: value })
          }
          step={KEYCHAIN_DECORATION_OFFSET_LIMITS.step}
          unit="мм"
          value={decoration.offsetY}
        />
      </>
    );
  }

  /**
   * Карточка «Текст»: содержимое, шрифт, выравнивание и строки.
   *
   * Поле — `textarea`, а не `input`: перевод строки и есть многострочность, и
   * вторая строка вводится клавишей Enter. Санитайзер чистит каждую строку
   * отдельно (`sanitizeKeychainText`), поэтому набор идёт без подмены на середине.
   */
  function renderTextCard(decoration: KeychainTextDecoration) {
    const capacity = KEYCHAIN_TEXT_MAX_LENGTH * KEYCHAIN_TEXT_MAX_LINES;
    const title = decoration.content.trim()
      ? decoration.content.trim().replace(/\n/g, " / ")
      : "Без надписи";

    return (
      <div
        className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
        key={decoration.id}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-200">Текст</p>
            <p className="mt-1 truncate text-xs text-slate-300">{title}</p>
          </div>
          <button
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl border border-white/15 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-rose-400/60 hover:bg-rose-400/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            onClick={() => onRemoveKeychainDecoration("text")}
            type="button"
          >
            Удалить
          </button>
        </div>

        <label className="sr-only" htmlFor={keychainTextInputId}>
          Надпись на брелоке
        </label>
        <textarea
          aria-describedby={keychainTextHintId}
          autoComplete="off"
          className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base font-medium text-white placeholder:text-slate-300 focus-visible:border-blue-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          id={keychainTextInputId}
          maxLength={capacity + KEYCHAIN_TEXT_MAX_LINES - 1}
          onChange={(event) =>
            onKeychainDecorationChange("text", {
              content: sanitizeKeychainText(event.target.value),
            })
          }
          placeholder={"Например,\nАня"}
          rows={2}
          spellCheck={false}
          value={decoration.content}
        />

        <div className="mt-2 flex items-start justify-between gap-3">
          <p
            className="text-xs leading-relaxed text-slate-300"
            id={keychainTextHintId}
          >
            Кириллица, латиница, цифры и знаки; до {KEYCHAIN_TEXT_MAX_LINES}{" "}
            строк по {KEYCHAIN_TEXT_MAX_LENGTH} символов. Enter — новая строка.
            Кегль подбирается по свободному месту, а соседний рельеф буквы
            обходят: место ищется по карте грани.
          </p>
          <span className="shrink-0 text-xs tabular-nums text-slate-300">
            {keychainTextLength}/{capacity}
          </span>
        </div>

        {renderTextStyleFields(decoration)}
      </div>
    );
  }

  /** Поля надписи внутри карточки: шрифт, выравнивание, строки и общий рельеф. */
  function renderTextStyleFields(decoration: KeychainTextDecoration) {
    return (
      <details className="group mt-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
          Настройки надписи
          <span
            aria-hidden
            className="text-xs text-slate-400 group-open:hidden"
          >
            ▾
          </span>
          <span
            aria-hidden
            className="hidden text-xs text-slate-400 group-open:inline"
          >
            ▴
          </span>
        </summary>
        <div className="mt-4 space-y-5">
          <ParameterSelect
            hint="Три набора из public/fonts: Roboto Bold — плотный и читаемый на мелком кегле, Roboto Regular — светлее, PT Serif Bold — с засечками для имени в подарок."
            label="Шрифт"
            onChange={(value) =>
              onKeychainDecorationChange("text", {
                font: value as KeychainFontId,
              })
            }
            options={KEYCHAIN_FONTS.map((font) => ({
              label: KEYCHAIN_FONT_LABELS[font],
              value: font,
            }))}
            value={decoration.font}
          />

          <ParameterSelect
            hint="Как строки выравниваются друг относительно друга: при центре короткая вторая строка встаёт по центру первой, при правом крае — по её правому краю."
            label="Выравнивание строк"
            onChange={(value) =>
              onKeychainDecorationChange("text", {
                align: value as KeychainTextAlign,
              })
            }
            options={KEYCHAIN_TEXT_ALIGNS.map((align) => ({
              label: KEYCHAIN_TEXT_ALIGN_LABELS[align],
              value: align,
            }))}
            value={decoration.align}
          />

          <NumberSlider
            decimals={KEYCHAIN_TEXT_LINE_HEIGHT_LIMITS.decimals}
            hint="Шаг между строками в долях кегля: 1.2 — обычный набор, 0.8 — строки почти слипаются, 2.0 — разрядка в две высоты буквы."
            label="Межстрочный интервал"
            max={KEYCHAIN_TEXT_LINE_HEIGHT_LIMITS.max}
            min={KEYCHAIN_TEXT_LINE_HEIGHT_LIMITS.min}
            onChange={(value) =>
              onKeychainDecorationChange("text", { lineHeight: value })
            }
            step={KEYCHAIN_TEXT_LINE_HEIGHT_LIMITS.step}
            unit="×"
            value={decoration.lineHeight}
          />

          {renderDecorationCommon(decoration)}
        </div>
      </details>
    );
  }

  /**
   * Карточка «Картинка»: маска, имя файла и настройки рельефа.
   *
   * Имя файла живёт в самой декорации (`imageName`), поэтому после перезагрузки
   * проекта карточка подписана «Картинка: logo.png», а не обезличенным «сохранена
   * в проекте». Превью — та же маска, что уходит в геометрию.
   */
  function renderImageCard(decoration: KeychainImageDecoration) {
    const title = decoration.imageName
      ? `Картинка: ${decoration.imageName}`
      : "Картинка из проекта";

    return (
      <div
        className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
        key={decoration.id}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-200">Картинка</p>
            <p className="mt-1 truncate text-xs text-emerald-200">{title}</p>
          </div>
          <button
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl border border-white/15 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-rose-400/60 hover:bg-rose-400/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            onClick={removeKeychainImage}
            type="button"
          >
            Удалить
          </button>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-slate-700/60 p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Маска загруженной картинки"
              className="size-full object-contain"
              src={decoration.imageData}
            />
          </span>
          <div className="min-w-0 flex-1">
            <label
              className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-xl border border-white/15 px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950"
              htmlFor={keychainImageInputId}
            >
              {isProcessingKeychainImage ? "Обрабатываем…" : "Заменить картинку"}
            </label>
          </div>
        </div>

        <p
          className="mt-2 text-xs leading-relaxed text-slate-300"
          id={keychainImageHintId}
        >
          PNG с прозрачным фоном или JPG. Рельефом становится тёмное и
          непрозрачное: логотип на светлом фоне тоже подойдёт. Место ищется по
          карте грани, а имя и отверстие под кольцо логотип обходит сам.
        </p>

        {keychainImageError ? (
          <p
            className="mt-3 rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
            role="alert"
          >
            {keychainImageError}
          </p>
        ) : keychainImageStatus ? (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-relaxed ${
              keychainImageStatus.tone === "error"
                ? "border-rose-400/40 bg-rose-400/10 text-rose-100"
                : keychainImageStatus.tone === "warning"
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
                  : "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
            }`}
            role={keychainImageStatus.tone === "error" ? "alert" : undefined}
          >
            {keychainImageStatus.text}
          </p>
        ) : null}

        {renderImageStyleFields(decoration)}
      </div>
    );
  }

  /** Поля картинки внутри карточки: масштаб и общие настройки рельефа. */
  function renderImageStyleFields(decoration: KeychainImageDecoration) {
    return (
      <details className="group mt-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-200 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
          Настройки картинки
          <span
            aria-hidden
            className="text-xs text-slate-400 group-open:hidden"
          >
            ▾
          </span>
          <span
            aria-hidden
            className="hidden text-xs text-slate-400 group-open:inline"
          >
            ▴
          </span>
        </summary>
        <div className="mt-4 space-y-5">
          <NumberSlider
            decimals={KEYCHAIN_IMAGE_SCALE_LIMITS.decimals}
            hint="1.0 — логотип вписан в свободную полосу целиком, больше — крупнее, если место позволяет. Масштаб — просьба: при нехватке места картинка ужимается до 25% и сообщает об этом плашкой."
            label="Размер картинки"
            max={KEYCHAIN_IMAGE_SCALE_LIMITS.max}
            min={KEYCHAIN_IMAGE_SCALE_LIMITS.min}
            onChange={(value) =>
              onKeychainDecorationChange("image", { imageScale: value })
            }
            step={KEYCHAIN_IMAGE_SCALE_LIMITS.step}
            unit="×"
            value={decoration.imageScale}
          />

          {renderDecorationCommon(decoration)}
        </div>
      </details>
    );
  }

  return (
    <section
      aria-labelledby="parameters-heading"
      className="min-w-0 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
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
          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
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

            {/*
              Рандом стоит сразу под силуэтом: «покажи что-нибудь другое»
              дешевле, чем крутить шесть слайдеров. Кнопка меняет только
              форму, узоры и сид — размеры и стенку оставляет как есть.
            */}
            <button
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-blue-500 px-4 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition-transform hover:scale-[1.01] hover:from-fuchsia-400 hover:to-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 active:scale-100"
              onClick={onRandomizeVase}
              title="Случайный силуэт, один-два узора, амплитуда и частота, новый сид"
              type="button"
            >
              <span aria-hidden>🎲</span>
              Сгенерировать случайную вазу
            </button>
          </div>

          {/*
            Первый экран: узор и размеры. Один слой и три числа — то, что
            действительно меняют у вазы. Всё остальное (композиция слоёв, грани,
            края, деформации, сид) ушло в свёрнутое «Дополнительно»: раньше
            панель занимала три экрана, и главные слайдеры терялись среди
            подсказок.
          */}
          <div className="mt-6 space-y-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-200">Узор</h3>
              <p className="text-xs tabular-nums text-slate-400">
                {params.patterns.length} из {VASE_MAX_PATTERN_LAYERS}
              </p>
            </div>

            <ParameterSelect
              hint={PATTERN_HINTS[params.patterns[0].type]}
              label="Тип узора"
              onChange={(type) => onPatternLayerChange(0, { type })}
              options={VASE_PATTERNS.map((pattern) => ({
                label: VASE_PATTERN_LABELS[pattern],
                value: pattern,
              }))}
              value={params.patterns[0].type}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.patternIntensity.decimals}
              hint={PATTERN_LAYER_HINTS.amplitude}
              label="Амплитуда"
              max={CONSTRUCTOR_LIMITS.patternIntensity.max}
              min={CONSTRUCTOR_LIMITS.patternIntensity.min}
              onChange={(value) => onPatternLayerChange(0, { amplitude: value })}
              step={CONSTRUCTOR_LIMITS.patternIntensity.step}
              unit="мм"
              value={params.patterns[0].amplitude}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.patternFrequency.decimals}
              hint={PATTERN_LAYER_HINTS.frequency}
              label="Частота"
              max={CONSTRUCTOR_LIMITS.patternFrequency.max}
              min={CONSTRUCTOR_LIMITS.patternFrequency.min}
              onChange={(value) => onPatternLayerChange(0, { frequency: value })}
              step={CONSTRUCTOR_LIMITS.patternFrequency.step}
              unit="раз"
              value={params.patterns[0].frequency}
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

          {/*
            Нативный details: раскрытие работает без состояния, а содержимое
            остаётся в DOM для скринридеров и поиска по странице. `group` нужен
            только затем, чтобы стрелка меняла направление.
          */}
          <details className="group mt-6 border-t border-white/10 pt-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
              Дополнительно: слои, грани, края и деформации
              <span aria-hidden className="text-xs text-slate-400 group-open:hidden">
                ▾
              </span>
              <span aria-hidden className="hidden text-xs text-slate-400 group-open:inline">
                ▴
              </span>
            </summary>

            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Для печати и точной подгонки: композиция узоров, грани, цоколь и
              обод, каннелюры, органика и наклон. Первый экран работает без них.
            </p>

            <div className="mt-4 space-y-5">
              <NumberSlider
                decimals={CONSTRUCTOR_LIMITS.sectionSides.decimals}
                hint="Сечение в плане: 3–12 граней превращают круг в правильный многоугольник — плоские грани и острые углы, вид кристалла. 0–2 — как в силуэте (круг у плавных форм, четыре грани у квадрата, восемь у восьмигранника): меньше трёх граней не бывает. Толщина стенки остаётся заданной и на гранях, и в углах."
                label="Грани"
                max={CONSTRUCTOR_LIMITS.sectionSides.max}
                min={CONSTRUCTOR_LIMITS.sectionSides.min}
                onChange={(value) => onParamChange("sectionSides", value)}
                step={CONSTRUCTOR_LIMITS.sectionSides.step}
                unit="шт"
                value={params.sectionSides}
              />
            </div>

            <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
              <NumberSlider
                decimals={CONSTRUCTOR_LIMITS.footMm.decimals}
                hint="0 — силуэт начинается от самого дна. 3–12 мм — прямая вертикальная ножка: первый слой ложится полным диском без нависаний, ваза стоит устойчиво и не обрастает «юбкой» от растекания пластика."
                label="Цоколь"
                max={CONSTRUCTOR_LIMITS.footMm.max}
                min={CONSTRUCTOR_LIMITS.footMm.min}
                onChange={(value) => onParamChange("footMm", value)}
                step={CONSTRUCTOR_LIMITS.footMm.step}
                unit="мм"
                value={params.footMm}
              />

              <NumberSlider
                decimals={CONSTRUCTOR_LIMITS.rimMm.decimals}
                hint="Насколько горло шире стенки: кромка уходит наружу под 45°, поэтому печатается без поддержек, а вода не льётся по стенке. Раструб не выходит за диаметр — у цилиндра, где горло и так самое широкое место, слайдер ничего не меняет."
                label="Обод"
                max={CONSTRUCTOR_LIMITS.rimMm.max}
                min={CONSTRUCTOR_LIMITS.rimMm.min}
                onChange={(value) => onParamChange("rimMm", value)}
                step={CONSTRUCTOR_LIMITS.rimMm.step}
                unit="мм"
                value={params.rimMm}
              />
            </div>

            <div className="mt-6 space-y-4 border-t border-white/10 pt-5">
              <h3 className="text-sm font-semibold text-slate-200">
                Слои узора
              </h3>

              <p className="text-xs leading-relaxed text-slate-300">
                Слои складываются: рёбра плюс спираль читаются как кручёная грань,
                волны поверх рёбер — как лепная керамика. До трёх слоёв: дальше
                рисунки перестают читаться по отдельности. У первого слоя здесь
                только фаза и затухание — тип, амплитуда и частота на первом
                экране.
              </p>

              {params.patterns.map((layer, index) => (
                // Ключ — индекс: у слоя нет своего идентификатора, а порядок
                // задаёт пользователь. После удаления индексы сдвигаются, и это
                // ожидаемо: панель показывает нумерацию списка, а не историю.
                <div
                  className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                  key={index}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-200">
                      {index === 0
                        ? params.patterns.length > 1
                          ? "Слой 1 · фаза и края"
                          : "Слой 1 · края"
                        : `Слой ${index + 1}`}
                    </h4>

                    {params.patterns.length > 1 ? (
                      <button
                        aria-label={`Удалить слой ${index + 1}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-300 transition-colors hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        onClick={() => onRemovePatternLayer(index)}
                        title="Удалить слой"
                        type="button"
                      >
                        <span aria-hidden>🗑</span>
                      </button>
                    ) : null}
                  </div>

                  {/*
                    Тип, амплитуда и частота первого слоя стоят на первом экране:
                    здесь они не дублируются, остаются только фаза и затухание.
                    У второго и третьего слоя полный набор — иначе новый слой
                    нельзя было бы настроить.
                  */}
                  {index > 0 ? (
                    <>
                      <ParameterSelect
                        hint={PATTERN_HINTS[layer.type]}
                        label="Узор слоя"
                        onChange={(type) =>
                          onPatternLayerChange(index, { type })
                        }
                        options={VASE_PATTERNS.map((pattern) => ({
                          label: VASE_PATTERN_LABELS[pattern],
                          value: pattern,
                        }))}
                        value={layer.type}
                      />

                      <NumberSlider
                        decimals={CONSTRUCTOR_LIMITS.patternIntensity.decimals}
                        hint={PATTERN_LAYER_HINTS.amplitude}
                        label="Амплитуда"
                        max={CONSTRUCTOR_LIMITS.patternIntensity.max}
                        min={CONSTRUCTOR_LIMITS.patternIntensity.min}
                        onChange={(value) =>
                          onPatternLayerChange(index, { amplitude: value })
                        }
                        step={CONSTRUCTOR_LIMITS.patternIntensity.step}
                        unit="мм"
                        value={layer.amplitude}
                      />

                      <NumberSlider
                        decimals={CONSTRUCTOR_LIMITS.patternFrequency.decimals}
                        hint={PATTERN_LAYER_HINTS.frequency}
                        label="Частота"
                        max={CONSTRUCTOR_LIMITS.patternFrequency.max}
                        min={CONSTRUCTOR_LIMITS.patternFrequency.min}
                        onChange={(value) =>
                          onPatternLayerChange(index, { frequency: value })
                        }
                        step={CONSTRUCTOR_LIMITS.patternFrequency.step}
                        unit="раз"
                        value={layer.frequency}
                      />
                    </>
                  ) : null}

                  {/*
                    Фаза нужна, чтобы совместить слои. У единственного слоя это
                    поворот и без того симметричного узора: силуэт не меняется, и
                    поле только занимает место — поэтому показываем его со
                    второго слоя.
                  */}
                  {params.patterns.length > 1 ? (
                    <NumberSlider
                      decimals={CONSTRUCTOR_LIMITS.patternPhaseDeg.decimals}
                      hint={PATTERN_LAYER_HINTS.phase}
                      label="Фаза"
                      max={CONSTRUCTOR_LIMITS.patternPhaseDeg.max}
                      min={CONSTRUCTOR_LIMITS.patternPhaseDeg.min}
                      onChange={(value) =>
                        onPatternLayerChange(index, { phaseDeg: value })
                      }
                      step={CONSTRUCTOR_LIMITS.patternPhaseDeg.step}
                      unit="°"
                      value={layer.phaseDeg}
                    />
                  ) : null}

                  <NumberSlider
                    decimals={CONSTRUCTOR_LIMITS.patternFadeMm.decimals}
                    hint={PATTERN_LAYER_HINTS.fadeTop}
                    label="Затухание сверху"
                    max={CONSTRUCTOR_LIMITS.patternFadeMm.max}
                    min={CONSTRUCTOR_LIMITS.patternFadeMm.min}
                    onChange={(value) =>
                      onPatternLayerChange(index, {
                        envelope: { ...layer.envelope, fadeTopMm: value },
                      })
                    }
                    step={CONSTRUCTOR_LIMITS.patternFadeMm.step}
                    unit="мм"
                    value={layer.envelope.fadeTopMm}
                  />

                  <NumberSlider
                    decimals={CONSTRUCTOR_LIMITS.patternFadeMm.decimals}
                    hint={PATTERN_LAYER_HINTS.fadeBottom}
                    label="Затухание снизу"
                    max={CONSTRUCTOR_LIMITS.patternFadeMm.max}
                    min={CONSTRUCTOR_LIMITS.patternFadeMm.min}
                    onChange={(value) =>
                      onPatternLayerChange(index, {
                        envelope: { ...layer.envelope, fadeBottomMm: value },
                      })
                    }
                    step={CONSTRUCTOR_LIMITS.patternFadeMm.step}
                    unit="мм"
                    value={layer.envelope.fadeBottomMm}
                  />
                </div>
              ))}

              {/*
                Кнопка выключается на третьем слое, а не исчезает: так видно и
                предел, и то, что список уже полон.
              */}
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-blue-400/40 bg-blue-500/10 px-4 text-sm font-semibold text-blue-100 transition-colors hover:border-blue-300/60 hover:bg-blue-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
                disabled={params.patterns.length >= VASE_MAX_PATTERN_LAYERS}
                onClick={onAddPatternLayer}
                type="button"
              >
                <span aria-hidden>＋</span>
                Добавить слой
              </button>
            </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.flutes.decimals}
              hint="Канавки с почти плоским дном вместо синуса: 8–12 читаются как античная каннелюра, 20–24 — как тонкая насечка. Глубина задаётся в миллиметрах и ограничена стенкой, поэтому тонкая ваза получит мелкие жёлоба."
              label="Каннелюры"
              max={CONSTRUCTOR_LIMITS.flutes.max}
              min={CONSTRUCTOR_LIMITS.flutes.min}
              onChange={(value) => onParamChange("flutes", value)}
              step={CONSTRUCTOR_LIMITS.flutes.step}
              unit="шт"
              value={params.flutes}
            />

            {/*
              Глубина без жёлобов невидима: геометрия умножает её на число
              каннелюр, и при нуле результат нулевой — замер дал 0.00% кадров.
              Поле появляется вместе с каннелюрами.
            */}
            {params.flutes > 0 ? (
              <NumberSlider
                decimals={CONSTRUCTOR_LIMITS.fluteDepthMm.decimals}
                hint="1 мм — деликатная канавка, 3 мм — глубокий жёлоб. Больше не получится: геометрия ограничивает глубину 60% стенки и 45% самого узкого радиуса, иначе стенка на дне жёлоба вывернулась бы."
                label="Глубина каннелюр"
                max={CONSTRUCTOR_LIMITS.fluteDepthMm.max}
                min={CONSTRUCTOR_LIMITS.fluteDepthMm.min}
                onChange={(value) => onParamChange("fluteDepthMm", value)}
                step={CONSTRUCTOR_LIMITS.fluteDepthMm.step}
                unit="мм"
                value={params.fluteDepthMm}
              />
            ) : null}

            {/*
              Закрутка поворачивает рельеф: грани, каннелюры и узор. На гладкой
              вазе-цилиндре поворачивать нечего — слайдер виден только когда
              рельеф есть (см. `vaseHasRelief`).
            */}
            {vaseHasRelief(params) ? (
              <NumberSlider
                decimals={CONSTRUCTOR_LIMITS.twistDeg.decimals}
                hint="Фаза рельефа поворачивается от дна к кромке: грани, каннелюры и узор идут по спирали. 90–180° — заметный поворот, 360–720° — тугая спираль. Ровный круг без узора не меняется: закручивать нечего, а шов сходится при любом угле."
                label="Закрутка"
                max={CONSTRUCTOR_LIMITS.twistDeg.max}
                min={CONSTRUCTOR_LIMITS.twistDeg.min}
                onChange={(value) => onParamChange("twistDeg", value)}
                step={CONSTRUCTOR_LIMITS.twistDeg.step}
                unit="°"
                value={params.twistDeg}
              />
            ) : null}

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.organic.decimals}
              hint="Складки «мятой глины» по сиду: крупные волны через всю вазу плюс мелкая рябь. 0.2–0.4 — ручная лепка, 1 — сильная деформация. Стенка сохраняет толщину, у дна и под кромкой складки гаснут, а глубина ограничена 4 мм и 15% самого узкого радиуса."
              label="Органика"
              max={CONSTRUCTOR_LIMITS.organic.max}
              min={CONSTRUCTOR_LIMITS.organic.min}
              onChange={(value) => onParamChange("organic", value)}
              step={CONSTRUCTOR_LIMITS.organic.step}
              unit=""
              value={params.organic}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.leanDeg.decimals}
              hint="Наклон всей модели: верх уходит в сторону, дно остаётся на столе. Толщина стенки и объём не меняются, но габарит по ширине растёт на tan(угла) × высоту, а одна сторона стенки становится круче — при больших углах нужны поддержки."
              label="Наклон"
              max={CONSTRUCTOR_LIMITS.leanDeg.max}
              min={CONSTRUCTOR_LIMITS.leanDeg.min}
              onChange={(value) => onParamChange("leanDeg", value)}
              step={CONSTRUCTOR_LIMITS.leanDeg.step}
              unit="°"
              value={params.leanDeg}
            />

            {/*
              Сид из интерфейса убран: он входит в геометрию только через
              органику, и человек всё равно не связывал число с рисунком.
              Генератор случайной вазы ставит новый сид сам, а сохранённый
              проект помнит его в параметрах.
            */}
          </div>
          </details>
        </>
      ) : params.model === "keychain" ? (
        <>
          <div className="mt-6 border-t border-white/10 pt-5">
            <ParameterSelect
              hint="Восемь пунктов — готовые пресеты со своей геометрией, девятый — свой SVG-контур: у него ушко с отверстием под кольцо 4 мм."
              label="Форма брелока"
              onChange={handleKeychainShapeSelect}
              options={KEYCHAIN_SHAPE_OPTIONS}
              value={
                params.keychainPreset ?? params.keychainShape ?? KEYCHAIN_SHAPES[0]
              }
            />

            {selectedKeychainPreset ? (
              selectedPresetReady ? (
                <p className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs leading-relaxed text-emerald-100">
                  <strong className="font-semibold">Готово:</strong>{" "}
                  {presetReadyNote(selectedKeychainPreset.id, params)}. Фаска 0.4
                  мм по контуру, толщина {params.thickness} мм — размеры берутся
                  из слайдеров ниже. Имя и карман под NFC-метку подключим
                  отдельными шагами.
                </p>
              ) : (
                <p className="mt-3 rounded-xl border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-xs leading-relaxed text-sky-100">
                  <strong className="font-semibold">
                    {selectedKeychainPreset.label}
                  </strong>
                  : {selectedKeychainPreset.description} Геометрия пресета ещё в
                  работе, поэтому скачивание STL заблокировано. Выберите готовый
                  пресет или загрузите свой контур.
                </p>
              )
            ) : null}
          </div>

          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Декор
            </legend>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/60 bg-blue-500/15 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  keychainText !== null ||
                  params.decorations.length >= KEYCHAIN_MAX_DECORATIONS
                }
                onClick={onAddKeychainText}
                type="button"
              >
                Добавить текст
              </button>
              {keychainImage ? null : (
                <label
                  className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/60 bg-blue-500/15 px-3 text-sm font-semibold text-white transition-colors focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950 ${
                    params.decorations.length >= KEYCHAIN_MAX_DECORATIONS
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:bg-blue-500/25"
                  }`}
                  htmlFor={keychainImageInputId}
                >
                  {isProcessingKeychainImage
                    ? "Обрабатываем…"
                    : "Добавить картинку"}
                </label>
              )}
              <input
                accept="image/png,image/jpeg"
                aria-describedby={keychainImageHintId}
                className="sr-only"
                disabled={isProcessingKeychainImage}
                id={keychainImageInputId}
                onChange={handleKeychainImageChange}
                type="file"
              />
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              До {KEYCHAIN_MAX_DECORATIONS} рельефов: текст, картинка и QR-код.
              Порядок постановки задаёт геометрия — логотип встаёт первым, буквы
              подстраиваются под остаток полосы, — поэтому рельефы не
              пересекаются и не наезжают друг на друга.
            </p>

            <div className="mt-4 space-y-4">
              {params.decorations.map((decoration) =>
                decoration.kind === "text"
                  ? renderTextCard(decoration)
                  : decoration.kind === "image"
                    ? renderImageCard(decoration)
                    : null,
              )}

              {params.keychainPreset === "qr-card" && qrCardLayoutPlan ? (
                <div
                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                  key="qr"
                >
                  <p className="text-sm font-semibold text-slate-200">QR-код</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    Код занимает лицо визитки целиком, поэтому не двигается и не
                    поворачивается. Надпись и картинка остаются в списке, но на
                    визитке не печатаются.
                  </p>

                  <div className="mt-3 space-y-5">
              <ParameterSelect
                hint="Компактная 60 × 40 помещается в карман, широкая 70 × 45 даёт крупный модуль и вмещает визитку с именем."
                label="Размер визитки"
                onChange={onQrCardSizeChange}
                options={QR_CARD_SIZE_OPTIONS}
                value={params.qrCardSize}
              />

              <ParameterSelect
                hint="Проушина Ø11 мм выступает над корпусом на 4 мм и входит в габарит по высоте. Отверстие Ø5 мм остаётся в теле: размер ровно по заготовке, но код опускается ниже."
                label="Крепление"
                onChange={onQrCardTabChange}
                options={QR_CARD_TAB_OPTIONS}
                value={params.qrCardTab}
              />

              <ParameterSelect
                hint="Выпуклый рельеф 0.4 мм читается пальцем, углублённый 0.3 мм не стирается о карман. Сканер читает оба."
                label="Рельеф кода"
                onChange={onQrModeChange}
                options={QR_MODE_OPTIONS}
                value={keychainQr?.qrMode ?? "raised"}
              />

              <ParameterSelect
                hint="Ссылка открывает сайт, телефон предлагает звонок, почта — письмо. Визитка сохраняет контакт целиком: имя и телефон."
                label="Что зашить в код"
                onChange={onQrContentTypeChange}
                options={QR_CONTENT_TYPE_OPTIONS}
                value={(keychainQr?.qrContentType ?? "url")}
              />

              {(keychainQr?.qrContentType ?? "url") === "vcard" ? (
                <>
                  <div>
                    <label
                      className="text-sm font-medium text-slate-200"
                      htmlFor={qrNameInputId}
                    >
                      Имя
                    </label>
                    <input
                      autoComplete="off"
                      className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base font-medium text-white placeholder:text-slate-300 focus-visible:border-amber-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                      id={qrNameInputId}
                      onChange={(event) => onQrNameChange(event.target.value)}
                      placeholder="Иван Петров"
                      spellCheck={false}
                      type="text"
                      value={keychainQr?.qrName ?? ""}
                    />
                  </div>

                  <div>
                    <label
                      className="text-sm font-medium text-slate-200"
                      htmlFor={qrPhoneInputId}
                    >
                      Телефон
                    </label>
                    <input
                      autoComplete="off"
                      className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base font-medium text-white placeholder:text-slate-300 focus-visible:border-amber-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                      id={qrPhoneInputId}
                      inputMode="tel"
                      onChange={(event) => onQrPhoneChange(event.target.value)}
                      placeholder="+7 900 123-45-67"
                      spellCheck={false}
                      type="tel"
                      value={keychainQr?.qrPhone ?? ""}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label
                    className="text-sm font-medium text-slate-200"
                    htmlFor={qrContentInputId}
                  >
                    {qrContentField.label}
                  </label>
                  <input
                    autoComplete="off"
                    className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base font-medium text-white placeholder:text-slate-300 focus-visible:border-amber-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    id={qrContentInputId}
                    inputMode={qrContentField.inputMode}
                    onChange={(event) => onQrContentChange(event.target.value)}
                    placeholder={qrContentField.placeholder}
                    spellCheck={false}
                    type="text"
                    value={keychainQr?.qrContent ?? ""}
                  />
                </div>
              )}

              {qrBlockReason ? (
                <p
                  className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
                  role="alert"
                >
                  {qrBlockReason} Скачивание STL заблокировано: иначе уйдёт в
                  печать код, который не сканируется.
                </p>
              ) : (
                <p className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-xs leading-relaxed text-emerald-100">
                  <strong className="font-semibold">Код влезает:</strong>{" "}
                  {qrCardReport(qrCardLayoutPlan)} Минимальный модуль для печати
                  — {QR_CARD_MIN_MODULE_MM} мм.
                </p>
              )}
                  </div>
                </div>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Силуэт детали
            </legend>

            <div className="mt-3 flex flex-wrap gap-2">
              <label
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-blue-400/60 bg-blue-500/15 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500/25 focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950"
                htmlFor={keychainContourInputId}
              >
                {isProcessingContour
                  ? "Обрабатываем…"
                  : contourFileName
                    ? "Заменить силуэт"
                    : "Загрузить силуэт детали"}
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
              Форма самой детали, а не логотип: картинка на грани живёт в блоке
              «Декор» выше. SVG с контуром или PNG/JPG — картинка переводится в
              силуэт в браузере, лучше всего подходит тёмный логотип на светлом
              фоне. Отверстия внутри силуэта при таком переводе заполняются.
            </p>

            {contourFileName ? (
              <p className="mt-2 truncate text-xs text-emerald-200">
                Силуэт: {contourFileName}
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

          {params.keychainPreset ? (
            <>
              <label
                className={`mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition-colors ${
                  presetNfcBlocked
                    ? "cursor-not-allowed opacity-70"
                    : "cursor-pointer hover:border-white/25 hover:bg-white/5"
                }`}
              >
                <input
                  checked={params.nfcEnabled}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed"
                  disabled={Boolean(presetNfcBlocked)}
                  onChange={(event) => onNfcChange(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-200">
                    Карман под NFC-метку
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-300">
                    Карман Ø{presetNfcDiameterLabel} мм по центру корпуса: сплошное
                    дно {presetNfcFloorLabel} мм снизу, полость{" "}
                    {presetNfcCavityLabel} мм под метку и губа Ø
                    {presetNfcLipLabel} мм сверху. Метку Ø25–26 мм (не шире
                    полости) толщиной до 1.1 мм вкладывают в паузу печати. Без паузы
                    карман останется запечатанной пустой полостью.
                  </span>
                </span>
              </label>

              {presetNfcBlocked ? (
                <p
                  className="mt-3 rounded-2xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-xs leading-relaxed text-rose-100"
                  role={params.nfcEnabled ? "alert" : "status"}
                >
                  {presetNfcBlocked}
                  {params.nfcEnabled
                    ? " Скачивание STL заблокировано: иначе уйдёт в печать брелок, в который метка не влезает."
                    : null}
                </p>
              ) : null}

              {params.nfcEnabled && !presetNfcBlocked && presetNfc ? (
                presetNfc.tightReason ? (
                  <p className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
                    Карман на пределе: {presetNfc.tightReason} Пауза{" "}
                    <code className="font-semibold">M600</code> на слое{" "}
                    <strong className="font-semibold">
                      Z = {presetNfcPauseLabel} мм
                    </strong>
                    . Тонкий пластик лучше печатать PETG: PLA в нём лопается по
                    слоям.
                  </p>
                ) : (
                  <p className="mt-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-xs leading-relaxed text-emerald-100">
                    Карман Ø{presetNfcDiameterLabel} мм по центру: дно{" "}
                    {presetNfcFloorLabel} мм, губа Ø{presetNfcLipLabel} мм и{" "}
                    {presetNfcLidLabel} мм пластика над меткой. Добавьте паузу{" "}
                    <code className="font-semibold">M600</code> на слое{" "}
                    <strong className="font-semibold">
                      Z = {presetNfcPauseLabel} мм
                    </strong>
                    , вложите метку Ø25–26 мм в открытую полость и продолжите
                    печать — губа и крышка закроют её навсегда. Мост над полостью
                    печатайте на 20–25 мм/с со 100 % заполнением.
                  </p>
                )
              ) : null}
            </>
          ) : (
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
                  Открытое снизу углубление под квадрат 25 × 25 мм. Метку вкладывают
                  в паузу печати, и последние слои закрывают её пластиком.
                </span>
              </span>
            </label>
          )}

          {!presetNfc && nfcBlockReason ? (
            <p
              className="mt-3 rounded-2xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-xs leading-relaxed text-rose-100"
              role="alert"
            >
              {nfcBlockReason} Скачивание STL заблокировано: иначе уйдёт в печать
              брелок, в который метка не влезает.
            </p>
          ) : null}

          {nfcFit?.fits && nfcFit.clearanceMm < KEYCHAIN_NFC_CLEARANCE_MM ? (
            <p className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
              Карман {nfcFit.cavityMm.toFixed(1)} ×{" "}
              {nfcFit.cavityMm.toFixed(1)} мм: метка 25 × 25 садится без зазора.
              Снимите защитный слой наклейки или подрежьте её по контуру — иначе
              она не ляжет заподлицо.
            </p>
          ) : null}

          {!presetNfc && params.nfcEnabled && !nfcBlockReason ? (
            <p className="mt-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-xs leading-relaxed text-emerald-100">
              Добавьте паузу <code className="font-semibold">M600</code> на слое{" "}
              <strong className="font-semibold">Z = {nfcPauseLabel} мм</strong> —
              это верх задней части кармана. Вложите метку в открытое отверстие и
              продолжите печать: поверх неё останется {nfcTopLabel} мм пластика.
            </p>
          ) : null}




          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            {params.keychainPreset === "qr-card" ? null : (
              <>
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
              </>
            )}

            <NumberSlider
              decimals={keychainThickness.decimals}
              hint={
                params.keychainPreset === "qr-card"
                  ? "2.5–3.5 мм: тоньше карта прогибается в кармане, толще рельеф кода перестаёт читаться пальцем. Ширина и высота приходят из размера визитки."
                  : "2–3 мм — лёгкий брелок, 4–5 мм — прочный. Края скруглены фаской, чтобы не резали руки."
              }
              label="Толщина"
              max={keychainThickness.max}
              min={keychainThickness.min}
              onChange={(value) => onParamChange("thickness", value)}
              step={keychainThickness.step}
              unit="мм"
              value={params.thickness}
            />

            {holePlacementOptions.length > 0 ? (
              <ParameterSelect
                hint={holePlacementHint}
                label="Отверстие"
                onChange={onHolePlacementChange}
                options={holePlacementOptions}
                value={params.holePlacement}
              />
            ) : null}
          </div>
        </>
      ) : params.model === "stand" ? (
        <>
          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Наклон спинки: 45° — телефон лежит почти как на столе, 75° — стоит почти вертикально. Рабочий диапазон 60–70°: экран видно, а центр тяжести остаётся над плитой."
              label="Наклон"
              max={CONSTRUCTOR_LIMITS.standAngle.max}
              min={CONSTRUCTOR_LIMITS.standAngle.min}
              onChange={(value) => onParamChange("standAngle", value)}
              step={CONSTRUCTOR_LIMITS.standAngle.step}
              unit="°"
              value={params.standAngle}
            />

            <NumberSlider
              hint="Толщина телефона вместе с чехлом. От неё зависит глубина жёлоба: запас 6 мм оставляет место разъёму и проводу зарядки."
              label="Толщина телефона"
              max={CONSTRUCTOR_LIMITS.phoneThickness.max}
              min={CONSTRUCTOR_LIMITS.phoneThickness.min}
              onChange={(value) => onParamChange("phoneThickness", value)}
              step={CONSTRUCTOR_LIMITS.phoneThickness.step}
              unit="мм"
              value={params.phoneThickness}
            />

            <NumberSlider
              hint="Ширина плиты и спинки. Высота подставки фиксированная — 100 мм, поэтому проверьте, что деталь влезает на стол принтера."
              label="Ширина"
              max={CONSTRUCTOR_LIMITS.standWidth.max}
              min={CONSTRUCTOR_LIMITS.standWidth.min}
              onChange={(value) => onParamChange("standWidth", value)}
              step={CONSTRUCTOR_LIMITS.standWidth.step}
              unit="мм"
              value={params.standWidth}
            />
          </div>
        </>
      ) : params.model === "planter" ? (
        <>
          <div className="mt-6 border-t border-white/10 pt-5">
            <ParameterSelect
              hint="Форма в плане: круглое кашпо печатается равномерно, квадратное даёт плоские стенки, шестигранное — гранёный силуэт. Габарит везде считается «под ключ»."
              label="Форма"
              onChange={onPlanterShapeChange}
              options={PLANTER_SHAPES.map((planterShape) => ({
                label: PLANTER_SHAPE_LABELS[planterShape],
                value: planterShape,
              }))}
              value={params.planterShape}
            />
          </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Габарит горшка «под ключ». Внутренняя полость меньше на две толщины стенки: для цветка с корневым комом оставьте запас 10–15 мм."
              label="Габарит"
              max={CONSTRUCTOR_LIMITS.planterSize.max}
              min={CONSTRUCTOR_LIMITS.planterSize.min}
              onChange={(value) => onParamChange("planterSize", value)}
              step={CONSTRUCTOR_LIMITS.planterSize.step}
              unit="мм"
              value={params.planterSize}
            />

            <NumberSlider
              hint="Высота стенки от стола. Дно поднято над кромкой: вода выходит через отверстия и не задерживается под грунтом."
              label="Высота"
              max={CONSTRUCTOR_LIMITS.planterHeight.max}
              min={CONSTRUCTOR_LIMITS.planterHeight.min}
              onChange={(value) => onParamChange("planterHeight", value)}
              step={CONSTRUCTOR_LIMITS.planterHeight.step}
              unit="мм"
              value={params.planterHeight}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.planterWall.decimals}
              hint="Толщина стенки и дна. 1.8–2.4 мм держат форму после печати, 1.2 мм — быстрее, но стенка заметно пружинит."
              label="Стенка"
              max={CONSTRUCTOR_LIMITS.planterWall.max}
              min={CONSTRUCTOR_LIMITS.planterWall.min}
              onChange={(value) => onParamChange("planterWall", value)}
              step={CONSTRUCTOR_LIMITS.planterWall.step}
              unit="мм"
              value={params.planterWall}
            />
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition-colors hover:border-white/25 hover:bg-white/5">
            <input
              checked={params.planterDrainage}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              onChange={(event) =>
                onPlanterDrainageChange(event.target.checked)
              }
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-200">
                Дренаж и поддон
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-300">
                Отверстия Ø 5 мм в дне и поддон шире горшка на 16 мм. Пара
                печатается в одном STL рядом друг с другом с зазором 12 мм.
              </span>
            </span>
          </label>

          <p className="mt-4 text-xs leading-relaxed text-slate-300">
            {params.planterDrainage
              ? "Горшок и поддон — две отдельные замкнутые детали: вода уходит из грунта в поддон, а не растекается по столу. Отверстия кольцом появляются только на дне, где хватает места."
              : "Без дренажа дно глухое и печатается одна деталь. Для суккулентов это рабочий вариант, но поливать придётся аккуратно — лишней воде некуда уходить."}
          </p>
        </>
      ) : params.model === "coaster" ? (
        <>
          <div className="mt-6 border-t border-white/10 pt-5">
            <ParameterSelect
              hint="Форма в плане: круглая салфетка под чашку, квадратная под стакан, шестигранная — гранёный вариант. Габарит считается «под ключ»."
              label="Форма"
              onChange={onCoasterShapeChange}
              options={COASTER_SHAPES.map((coasterShape) => ({
                label: COASTER_SHAPE_LABELS[coasterShape],
                value: coasterShape,
              }))}
              value={params.coasterShape}
            />
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <ParameterSelect
              hint="Рельеф выступает над лицом на 0.4 мм: рисунок видно и на ощупь, но кружка стоит ровно. Кольца читаются на круглой форме лучше всего."
              label="Узор"
              onChange={onCoasterPatternChange}
              options={COASTER_PATTERNS.map((coasterPattern) => ({
                label: COASTER_PATTERN_LABELS[coasterPattern],
                value: coasterPattern,
              }))}
              value={params.coasterPattern}
            />
          </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Габарит подставки «под ключ». Чашке хватает 80–100 мм, кружке побольше — 110–120 мм: дно должно стоять целиком на плите."
              label="Габарит"
              max={CONSTRUCTOR_LIMITS.coasterSize.max}
              min={CONSTRUCTOR_LIMITS.coasterSize.min}
              onChange={(value) => onParamChange("coasterSize", value)}
              step={CONSTRUCTOR_LIMITS.coasterSize.step}
              unit="мм"
              value={params.coasterSize}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.coasterThickness.decimals}
              hint="Толщина плиты. 4–5 мм держат горячую кружку и не коробятся, 3 мм — компактный вариант для чашки."
              label="Толщина"
              max={CONSTRUCTOR_LIMITS.coasterThickness.max}
              min={CONSTRUCTOR_LIMITS.coasterThickness.min}
              onChange={(value) => onParamChange("coasterThickness", value)}
              step={CONSTRUCTOR_LIMITS.coasterThickness.step}
              unit="мм"
              value={params.coasterThickness}
            />
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition-colors hover:border-white/25 hover:bg-white/5">
            <input
              checked={params.coasterRim}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              onChange={(event) => onCoasterRimChange(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-200">
                Бортик
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-300">
                Кольцо по краю шириной 3 мм и высотой 2.5 мм над лицом:
                конденсат с холодного стакана остаётся на подставке, а не течёт
                на стол.
              </span>
            </span>
          </label>

          <p className="mt-4 text-xs leading-relaxed text-slate-300">
            Плита, бортик и рельеф — отдельные замкнутые тела, которые входят друг
            в друга: слайсер печатает их одной деталью без поддержек. Узор
            повторяет форму подставки и не доходит до края 2.2 мм.
          </p>
        </>
      ) : params.model === "jewelry_stand" ? (
        <>
          <div className="mt-6 border-t border-white/10 pt-5">
            <ParameterSelect
              hint="Штанга держит кольца и серьги, рожки — цепочки и браслеты. «Кольца и цепочки» строит оба держателя на одной стойке."
              label="Держатели"
              onChange={onJewelryConfigChange}
              options={JEWELRY_CONFIGS.map((jewelryConfig) => ({
                label: JEWELRY_CONFIG_LABELS[jewelryConfig],
                value: jewelryConfig,
              }))}
              value={params.jewelryConfig}
            />
          </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Высота стойки от стола. Штанга для колец стоит выше середины, рожки для цепочек заканчиваются у самого верха: 100–130 мм удобно для стола."
              label="Высота"
              max={CONSTRUCTOR_LIMITS.jewelryHeight.max}
              min={CONSTRUCTOR_LIMITS.jewelryHeight.min}
              onChange={(value) => onParamChange("jewelryHeight", value)}
              step={CONSTRUCTOR_LIMITS.jewelryHeight.step}
              unit="мм"
              value={params.jewelryHeight}
            />

            <NumberSlider
              hint="Диаметр основания. Чем шире база, тем устойчивее стойка и больше места для часов и серёг; штанга и рожки масштабируются вместе с ней."
              label="Основание"
              max={CONSTRUCTOR_LIMITS.jewelryBase.max}
              min={CONSTRUCTOR_LIMITS.jewelryBase.min}
              onChange={(value) => onParamChange("jewelryBase", value)}
              step={CONSTRUCTOR_LIMITS.jewelryBase.step}
              unit="мм"
              value={params.jewelryBase}
            />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-300">
            Основание, стойка, штанга и рожки — отдельные замкнутые тела: каждое
            входит в соседнее на миллиметр, поэтому стойка печатается одной
            деталью без клея и поддержек.
          </p>
        </>
      ) : params.model === "pen_holder" ? (
        <>
          <div className="mt-6 border-t border-white/10 pt-5">
            <ParameterSelect
              hint="Круглый органайзер стоит на столе, квадратный и шестигранный можно поставить вплотную к монитору: грани не дают ему катиться."
              label="Форма"
              onChange={onPenShapeChange}
              options={PEN_SHAPES.map((penShape) => ({
                label: PEN_SHAPE_LABELS[penShape],
                value: penShape,
              }))}
              value={params.penShape}
            />
          </div>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Габарит «под ключ»: у круга — диаметр, у квадрата и шестигранника — расстояние между гранями. 70–90 мм хватает на ручки, карандаши и ножницы."
              label="Габарит"
              max={CONSTRUCTOR_LIMITS.penSize.max}
              min={CONSTRUCTOR_LIMITS.penSize.min}
              onChange={(value) => onParamChange("penSize", value)}
              step={CONSTRUCTOR_LIMITS.penSize.step}
              unit="мм"
              value={params.penSize}
            />

            <NumberSlider
              hint="Высота стенки от стола. Под длинные ручки берите 110–140 мм, под карандаши и кисти достаточно 80–100 мм."
              label="Высота"
              max={CONSTRUCTOR_LIMITS.penHeight.max}
              min={CONSTRUCTOR_LIMITS.penHeight.min}
              onChange={(value) => onParamChange("penHeight", value)}
              step={CONSTRUCTOR_LIMITS.penHeight.step}
              unit="мм"
              value={params.penHeight}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.penWall.decimals}
              hint="Толщина стенки, дна и перегородок. 1.6–2 мм держат форму, 3 мм и больше — запас под грубую печать и тяжёлые канцелярские принадлежности."
              label="Стенка"
              max={CONSTRUCTOR_LIMITS.penWall.max}
              min={CONSTRUCTOR_LIMITS.penWall.min}
              onChange={(value) => onParamChange("penWall", value)}
              step={CONSTRUCTOR_LIMITS.penWall.step}
              unit="мм"
              value={params.penWall}
            />

            <NumberSlider
              hint="Сколько отделений делят полость. Перегородки входят в стенку и дно, поэтому 1 — просто стакан без делений."
              label="Отделения"
              max={CONSTRUCTOR_LIMITS.penSections.max}
              min={CONSTRUCTOR_LIMITS.penSections.min}
              onChange={(value) => onParamChange("penSections", value)}
              step={CONSTRUCTOR_LIMITS.penSections.step}
              unit="шт."
              value={params.penSections}
            />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-300">
            Дно, стенка и перегородки — отдельные замкнутые тела, которые входят
            друг в друга: органайзер печатается одной деталью без клея и
            поддержек. Перегородки подрезаны по хорде сечения, поэтому не
            выходят за грани квадрата или шестигранника.
          </p>
        </>
      ) : params.model === "heat_transfer" ? (
        <>
          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Логотип
            </legend>

            <div className="mt-3 flex flex-wrap gap-2">
              <label
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-blue-400/60 bg-blue-500/15 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500/25 focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950"
                htmlFor={heatTransferInputId}
              >
                {isProcessingTransfer
                  ? "Обводим контур…"
                  : hasHeatTransferLogo
                    ? "Заменить логотип"
                    : "Загрузить логотип"}
              </label>
              <input
                accept=".svg,.png,.webp"
                aria-describedby={heatTransferHintId}
                className="sr-only"
                disabled={isProcessingTransfer}
                id={heatTransferInputId}
                onChange={handleHeatTransferFileChange}
                type="file"
              />
              {hasHeatTransferLogo ? (
                <button
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-3 text-sm font-semibold text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  onClick={resetHeatTransferLogo}
                  type="button"
                >
                  Убрать
                </button>
              ) : null}
            </div>

            <p
              className="mt-2 text-xs leading-relaxed text-slate-300"
              id={heatTransferHintId}
            >
              PNG или WebP с прозрачным фоном либо SVG с замкнутыми путями.
              Контур обводится в браузере: непрозрачные пиксели становятся
              пластиком, прозрачные остаются тканью. Логотип от{" "}
              {HEAT_TRANSFER_RECOMMENDED_SIDE_PX} px по длинной стороне даёт
              ровный край.
            </p>

            {hasHeatTransferLogo ? (
              <p className="mt-2 truncate text-xs text-emerald-200">
                Логотип: {transferFileName ?? "загруженный контур"}
              </p>
            ) : null}

            {transferStats ? (
              <p className="mt-2 text-xs text-emerald-200">
                Контуров: {transferStats.contourCount} · точек:{" "}
                {transferStats.pointCount}
              </p>
            ) : null}

            {transferWarning ? (
              <p className="mt-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                {transferWarning}
              </p>
            ) : null}

            {transferStrokeHint ? (
              <p className="mt-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                {transferStrokeHint}
              </p>
            ) : null}

            {transferError ? (
              <p
                className="mt-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
                role="alert"
              >
                {transferError}
              </p>
            ) : null}

            {!hasHeatTransferLogo && !transferError ? (
              <p className="mt-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                Без логотипа печатать нечего: у термопринта нет своей формы.
                Загрузите PNG или SVG — до этого скачивание вернёт ошибку.
              </p>
            ) : null}
          </fieldset>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Ширина принта в миллиметрах. Лист A4 — 210 мм, поэтому 200 мм — самый крупный перенос целиком."
              label="Ширина"
              max={CONSTRUCTOR_LIMITS.heatTransferWidth.max}
              min={CONSTRUCTOR_LIMITS.heatTransferWidth.min}
              onChange={(value) => onParamChange("heatTransferWidth", value)}
              step={CONSTRUCTOR_LIMITS.heatTransferWidth.step}
              unit="мм"
              value={params.heatTransferWidth}
            />

            <NumberSlider
              hint="Высота принта. Ширина и высота независимы: узкий логотип можно вытянуть в полосу под рукав."
              label="Высота"
              max={CONSTRUCTOR_LIMITS.heatTransferHeight.max}
              min={CONSTRUCTOR_LIMITS.heatTransferHeight.min}
              onChange={(value) => onParamChange("heatTransferHeight", value)}
              step={CONSTRUCTOR_LIMITS.heatTransferHeight.step}
              unit="мм"
              value={params.heatTransferHeight}
            />

            <NumberSlider
              decimals={1}
              hint={`Толщина — слои по 0.2 мм: сейчас ${heatTransferThickness(
                params.heatTransferLayers,
              ).toFixed(1)} мм. Два слоя гнутся по ткани, четыре держат форму жёсткой наклейки.`}
              label="Толщина"
              max={CONSTRUCTOR_LIMITS.heatTransferLayers.max}
              min={CONSTRUCTOR_LIMITS.heatTransferLayers.min}
              onChange={(value) => onParamChange("heatTransferLayers", value)}
              step={CONSTRUCTOR_LIMITS.heatTransferLayers.step}
              unit="сл."
              value={params.heatTransferLayers}
            />
          </div>

          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Перенос на ткань
            </legend>

            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 transition-colors hover:border-white/25 hover:bg-white/5">
              <input
                checked={params.heatTransferMirror}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                onChange={(event) =>
                  onHeatTransferMirrorChange(event.target.checked)
                }
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-200">
                  Зеркалить принт
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-300">
                  Нужно при переносе утюгом: плёнка прижимается к ткани лицевой
                  стороной вниз, и рисунок переворачивается. Для термопресса
                  наклейкой вверх зеркало не включают.
                </span>
              </span>
            </label>
          </fieldset>

          <p className="mt-4 text-xs leading-relaxed text-slate-300">
            Принт — плоская наклейка{" "}
            {heatTransferThickness(params.heatTransferLayers).toFixed(1)} мм:
            печатается слоями по 0.2 мм без поддержек и переносится на ткань.
            Части логотипа тоньше 0.4 мм отбрасываются, поэтому мелкие детали
            узкого шрифта могут не пропечататься.
          </p>
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
                  PNG, JPG или WebP. Браузер сразу сжимает кадр до{" "}
                  {LITHOPHANE_RESOLUTION} × {LITHOPHANE_RESOLUTION}, поэтому
                  большой файл не подвесит предпросмотр. Берётся центральная
                  квадратная область.
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
              blockedReason={exportBlockReason}
              exportingId={exportingId}
              onExport={onExport}
              options={exportOptions}
              partsHeading={partsHeading}
            />
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {isExporting
                ? "Собираем геометрию и упаковываем её в бинарный STL…"
                : "Пакет «Всё включено» активен. Файл скачается с именем по вашим параметрам."}
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
                blockedReason={exportBlockReason}
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
                Лимит на этот месяц исчерпан. Пакет «Всё включено» открывает
                безлимитную генерацию STL.
              </p>
            </div>

            <Link
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-5 text-base font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              href="/courses/pro"
            >
              <span aria-hidden>⚡</span>
              Открыть пакет «Всё включено»
            </Link>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Пакет «Всё включено» открывает безлимитную генерацию STL.
            </p>
            <ExportErrorAlert error={exportError} />
          </>
        )}
      </div>
    </section>
  );
}
