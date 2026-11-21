"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { loadConstructorProject } from "@/app/actions/projects";
import { FeedbackDialog } from "@/components/constructor/FeedbackDialog";
import { ModelPicker } from "@/components/constructor/ModelPicker";
import {
  ParameterPanel,
  type StlExportError,
  type StlExportOption,
} from "@/components/constructor/ParameterPanel";
import { SaveProjectDialog } from "@/components/constructor/SaveProjectDialog";
import { VaseRecipeGallery } from "@/components/constructor/VaseRecipeGallery";
import {
  vaseRecipeParams,
  type VaseRecipe,
} from "@/data/vase-recipes";
import {
  FEEDBACK_OPEN_DELAY_MS,
  registerConstructorDownload,
  shouldAskForConstructorFeedback,
} from "@/lib/constructor/feedback";
import { FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH } from "@/lib/constructor/downloads";
import { constructorExportBlockReason } from "@/lib/constructor/export-guard";
import { MODEL_TYPES } from "@/lib/constructor/model-types";
import type { SavedProjectNotice } from "@/lib/constructor/projects";
import type { KeychainBuildReport } from "@/lib/constructor/keychain-geometry";
import {
  signExportNotice,
  signExportOptions,
} from "@/lib/constructor/sign-export-options";
import {
  signLayoutSignature,
  type SignLayoutReport,
} from "@/lib/constructor/sign-geometry";
import { randomVaseParams } from "@/lib/constructor/vase-random";
import {
  keychainPresetById,
  type HolePlacement,
  type KeychainPresetId,
} from "@/lib/constructor/keychain-presets";
import {
  COASTER_PATTERN_LABELS,
  COASTER_SHAPE_LABELS,
  DEFAULT_BOX_PARAMS,
  DEFAULT_COASTER_PARAMS,
  DEFAULT_CONSTRUCTOR_PARAMS,
  DEFAULT_HEAT_TRANSFER_PARAMS,
  DEFAULT_JEWELRY_STAND_PARAMS,
  DEFAULT_KEYCHAIN_PARAMS,
  DEFAULT_KEYCHAIN_QR_DECORATION,
  DEFAULT_LITHOPHANE_PARAMS,
  DEFAULT_PEN_HOLDER_PARAMS,
  DEFAULT_PLANTER_PARAMS,
  DEFAULT_SIGN_PARAMS,
  DEFAULT_VASE_PARAMS,
  JEWELRY_LEAF_TYPE_LABELS,
  JEWELRY_PRESET_LABELS,
  LITHOPHANE_SHAPE_LABELS,
  PEN_SHAPE_LABELS,
  PLANTER_SEPARATE_FILES_HINT,
  PLANTER_SHAPE_LABELS,
  VASE_MAX_PATTERN_LAYERS,
  VASE_SHAPE_LABELS,
  boxPresetParams,
  boxStlFileName,
  coasterHolderStlFileName,
  coasterSetStlFileName,
  coasterStlFileName,
  createKeychainImageDecoration,
  createKeychainTextDecoration,
  heatTransferStlFileName,
  jewelryStandStlFileName,
  keychainShapeLabel,
  keychainStlFileName,
  keychainTextDecoration,
  sanitizeQrCardContent,
  sanitizeQrCardName,
  sanitizeQrCardPhone,
  listSignBlocks,
  listSignLetters,
  lithophaneHasLedBox,
  lithophaneHasRail,
  lithophaneHasStand,
  lithophanePartLabel,
  lithophaneShapeHasFrame,
  lithophaneShapeHasMounts,
  lithophaneStlFileName,
  normalizeConstructorParams,
  nextPatternLayer,
  penHolderStlFileName,
  planterFootprint,
  planterStlFileName,
  vasePatternLabel,
  vaseStlFileName,
  type BoxMagnetSize,
  type BoxPresetId,
  type CoasterPattern,
  type CoasterHolderStyle,
  type CoasterHolderType,
  type CoasterShape,
  type ConstructorParams,
  type JewelryLeafType,
  type JewelryPreset,
  type KeychainDecoration,
  type KeychainDecorationKind,
  type KeychainParams,
  type KeychainQrDecoration,
  type LithophaneBrightnessGrid,
  type LithophaneMount,
  type LithophanePart,
  type LithophaneRailSocket,
  type LithophaneShape,
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
  type SignRailMode,
  type VaseShape,
} from "@/lib/constructor/params";

/**
 * Патч одной декорации по виду.
 *
 * Вид служит ключом: декораций каждого вида не больше одной, поэтому отдельного
 * `id` в интерфейсе не требуется. Патч приходит частичным — нормализация доводит
 * недостающие поля из образца, а границы и наборы значений проверяет сама.
 */
function patchKeychainDecoration(
  decorations: readonly KeychainDecoration[],
  kind: KeychainDecorationKind,
  patch: Partial<KeychainDecoration>,
): KeychainDecoration[] {
  return decorations.map((decoration) =>
    decoration.kind === kind
      ? // Патч размечен по виду вызывающей стороной: у карточки текста не бывает
        // полей картинки, а нормализация всё равно проверит каждое значение.
        ({ ...decoration, ...patch } as KeychainDecoration)
      : decoration,
  );
}

type ConstructorClientProps = {
  /** Есть ли действующий доступ Pro: у Pro лимита на STL нет. */
  hasPro: boolean;
  /** Сколько бесплатных скачиваний осталось в текущем месяце (0 для Pro). */
  freeDownloadsLeft: number;
  /** Проект из адреса `?project=ID`: его параметры применяются после загрузки. */
  initialProjectId?: string | null;
  /**
   * `?debug=light`: показать в сцене отладочный слой «Карта света».
   *
   * Слой считает ровность освещения панели и нужен разработчику, а не
   * покупателю, поэтому без флага кнопки «Карта света» в сцене нет вовсе.
   */
  debugLight?: boolean;
};

/**
 * Числовые параметры: форму, слои узора, надпись и флаги меняют отдельные
 * обработчики.
 *
 * Слои узора правятся не этим ключом: у слоя пять чисел и тип, поэтому панель
 * зовёт `updatePatternLayer` с индексом и патчем. `patterns` в `SizeParam` не
 * входит по той же причине — ключ ведёт к одному числу.
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
  | "signRailMode"
  | "hasLid"
  | "lithoFrame"
  | "lithoMount"
  | "lithoRailSocket"
  | "lithoShape"
  | "lithophaneBrightness"
  | "planterShape"
  | "planterDrainage"
  | "coasterShape"
  | "coasterPattern"
  | "coasterRim"
  | "coasterHolderType"
  | "coasterHolderStyle"
  | "penShape"
  | "heatTransferSvg"
  | "heatTransferMirror"
>;

/**
 * Дефолты каждой модели.
 *
 * Объект нужен двум действиям: выбор модели в выпадающем списке начинает её с
 * исходных значений, а кнопка «Сбросить параметры» возвращает к ним же текущую
 * модель. Поля других моделей лежат в общем объекте и не трогаются.
 */
const MODEL_DEFAULT_PARAMS: Record<ModelType, Partial<ConstructorParams>> = {
  vase: DEFAULT_VASE_PARAMS,
  keychain: DEFAULT_KEYCHAIN_PARAMS,
  sign: DEFAULT_SIGN_PARAMS,
  box: DEFAULT_BOX_PARAMS,
  lithophane: DEFAULT_LITHOPHANE_PARAMS,
  planter: DEFAULT_PLANTER_PARAMS,
  coaster: DEFAULT_COASTER_PARAMS,
  jewelry_stand: DEFAULT_JEWELRY_STAND_PARAMS,
  pen_holder: DEFAULT_PEN_HOLDER_PARAMS,
  heat_transfer: DEFAULT_HEAT_TRANSFER_PARAMS,
};

/**
 * Имя файла из Content-Disposition.
 *
 * Blob-ссылка не сохраняет заголовки ответа, поэтому имя приходится разбирать
 * самим. Сервер отдаёт простой ASCII filename; filename* поддерживаем на
 * случай, если имя когда-нибудь станет не-ASCII.
 */
function stlFileNameFromDisposition(
  header: string | null,
  fallback: string,
): string {
  if (!header) {
    return fallback;
  }

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);

  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // Испорченный filename* не должен ломать скачивание.
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header);

  return plain?.[1]?.trim() || fallback;
}

/** Сообщение из JSON-ошибки API; null, если тело не JSON. */
async function readServerMessage(response: Response): Promise<string | null> {
  try {
    const data: unknown = await response.json();

    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }
  } catch {
    // 500 от прокси может прийти HTML — показываем свой текст.
  }

  return null;
}

/**
 * Файлы, которые можно скачать для текущей модели.
 *
 * У вывески и литофана файлов несколько: блок вывески печатается лицом и
 * крышкой, литофан — плитой рельефа и рамкой. Первый элемент — главная кнопка:
 * лицо первого блока вывески или собранный литофан. Остальные кнопки несут
 * `request`, который уходит в API поверх параметров, поэтому геометрия и имя
 * файла на сервере собираются из тех же значений.
 *
 * Имена считаются здесь только как запасные: сервер присылает то же имя в
 * Content-Disposition, а браузеру оно нужно, если заголовок потеряется.
 */
function buildExportOptions(
  params: ConstructorParams,
  signLayout: SignLayoutReport | null = null,
): StlExportOption[] {
  if (params.model === "sign") {
    return signExportOptions(params, signLayout);
  }

  if (params.model === "lithophane") {
    // У плафона и калейдоскопа съёмной рамки нет: их панели печатаются вместе со
    // своей сборкой, поэтому файл один. У плафона отдельными файлами идут ещё
    // две детали: основание со спицами и крышка-козырёк. Печатать их с кольцом
    // нельзя: внутри осталась бы закрытая полость ступицы, а панели уже заняли
    // кольцо.
    if (!lithophaneShapeHasFrame(params.lithoShape)) {
      if (params.lithoShape !== "round") {
        return [
          {
            id: "lithophane-all",
            label: "Скачать STL",
            description: "Собранный литофан одним файлом",
            request: { part: "all" as const },
            fileName: lithophaneStlFileName(params, "all"),
          },
        ];
      }

      // Круглый плафон: панели, основание и крышка тремя файлами. Подписи берут
      // форму в расчёт — у плафона `stand` это основание, а не подставка.
      return (["relief", "stand", "top_cover"] as const).map((part) => {
        const label = lithophanePartLabel(
          part,
          params.lithoMount,
          params.lithoShape,
        );

        return {
          id: `lithophane-${part}`,
          label,
          description: `${label} отдельным файлом`,
          request: { part },
          fileName: lithophaneStlFileName(params, part),
        };
      });
    }

    // Без рамки печатается одна плита рельефа: крепления вырезаны в рамке,
    // поэтому дополнительных файлов нет.
    if (!params.lithoFrame) {
      return [
        {
          id: "lithophane-relief",
          label: "Скачать STL",
          description: "Плита рельефа без рамки",
          request: { part: "relief" },
          fileName: lithophaneStlFileName(params, "relief"),
        },
      ];
    }

    // Штатный набор: первый файл — собранный литофан, дальше детали по
    // отдельности. Рельеф и рамка есть всегда, подставка — только при ножке или
    // массивном основании, петли подвеса — часть рамки.
    const parts: LithophanePart[] = ["relief", "frame"];

    // Подставка: у плоской формы — выбранное крепление с ножкой или основанием.
    if (
      lithophaneShapeHasMounts(params.lithoShape) &&
      lithophaneHasStand(params.lithoMount)
    ) {
      parts.push("stand");
    }

    // Полоз: врезан в тыл рамки и печатается вместе с ней, поэтому отдельный
    // файл есть только у каретки. В общем STL каретка стоит в пазу, и слайсер
    // спекает её с рамкой, поэтому у полоза собранный файл из скачивания уходит:
    // на кнопках остаются три отдельные детали — рамка, каретка и панель.
    const railed = lithophaneHasRail(
      params.lithoMount,
      params.lithoShape,
      params.lithoFrame,
    );

    // Короб под LED-панель тоже наращивает рамку и печатается вместе с ней:
    // отдельным файлом идёт только задняя крышка, которая держит панель.
    if (
      lithophaneHasLedBox(
        params.lithoMount,
        params.lithoShape,
        params.lithoFrame,
      )
    ) {
      parts.push("cover");
    }

    // Подпись зависит от крепления и формы: короб и полоз наращивают одну
    // рамку, а у плафона деталь `stand` — его основание.
    const option = (part: LithophanePart): StlExportOption => {
      const label = lithophanePartLabel(
        part,
        params.lithoMount,
        params.lithoShape,
      );

      return {
        id: `lithophane-${part}`,
        label,
        description: `${label} литофана отдельным файлом`,
        request: { part },
        fileName: lithophaneStlFileName(params, part),
      };
    };

    if (railed) {
      // Порядок — от главной детали: рамка с полозом, каретка и панель.
      return (["frame", "carriage", "relief"] as const).map(option);
    }

    return [
      {
        id: "lithophane-all",
        label: "Скачать STL",
        description: "Собранный литофан одним файлом",
        request: { part: "all" },
        fileName: lithophaneStlFileName(params, "all"),
      },
      ...parts.map(option),
    ];
  }

  if (params.model === "coaster") {
    // В превью подставки стоят в гнёздах или стопкой, но печатать такую
    // сборку нельзя: стойка спечётся с плитами. Поэтому общий STL разносит
    // детали по столу с зазором 15 мм, а отдельные файлы остаются для печати
    // по одной детали и замены.
    if (params.coasterHolderType === "vertical") {
      return [
        {
          id: "coaster-set",
          label: "Общий STL",
          description: "Держатель и подставка одним файлом, детали разнесены",
          request: { part: "all" },
          fileName: coasterSetStlFileName(params),
        },
        {
          id: "coaster",
          label: "Подставка",
          description: "Подставка под кружку",
          request: { part: "coaster" },
          fileName: coasterStlFileName(params),
        },
        {
          id: "coaster-holder",
          label: "Держатель",
          description: `${
            params.coasterHolderStyle === "vertical" ? "Накопитель" : "Стойка"
          } на ${params.coasterCount} подставок`,
          request: { part: "holder" },
          fileName: coasterHolderStlFileName(),
        },
      ];
    }

    return [
      {
        id: "coaster",
        label: "Скачать STL",
        request: {},
        fileName: coasterStlFileName(params),
      },
    ];
  }

  if (params.model === "planter") {
    // Детали всегда можно скачать по отдельности. Общий STL кладёт их рядом,
    // пока пара влезает в 220 мм; иначе ставит горшок на поддон. Если даже так
    // габарит больше стола, общей кнопки нет — только два отдельных файла.
    const footprint = planterFootprint(params);
    const separateHint = footprint.hasCommonFile
      ? ""
      : ` · ${PLANTER_SEPARATE_FILES_HINT}`;
    const pot: StlExportOption = {
      id: "planter-pot",
      label: "Горшок",
      description: params.planterSelfWatering
        ? `Горшок ${params.planterSize} × ${Math.round(
            footprint.potDepth,
          )} × ${params.planterHeight} мм · автополив, дно +10 мм${separateHint}`
        : `Горшок ${params.planterSize} × ${Math.round(
            footprint.potDepth,
          )} × ${params.planterHeight} мм, дно плоское${separateHint}`,
      request: { planterPart: "pot" },
      fileName: planterStlFileName(params, "pot"),
    };

    if (!params.planterDrainage) {
      return [
        {
          ...pot,
          id: "planter",
          label: "Скачать STL",
        },
      ];
    }

    const tray: StlExportOption = {
      id: "planter-tray",
      label: "Поддон",
      description: params.planterSelfWatering
        ? `Поддон ${Math.round(footprint.trayWidth)} × ${Math.round(
            footprint.trayDepth,
          )} × ${footprint.trayHeight} мм · резервуар ${
            footprint.reservoirDepth
          } мм${separateHint}`
        : `Поддон ${Math.round(footprint.trayWidth)} × ${Math.round(
            footprint.trayDepth,
          )} × ${footprint.trayHeight} мм${separateHint}`,
      request: { planterPart: "tray" },
      fileName: planterStlFileName(params, "tray"),
    };
    const options: StlExportOption[] = [];

    if (footprint.hasCommonFile) {
      options.push({
        id: "planter-set",
        label: "Общий STL",
        description:
          footprint.layout === "side"
            ? `Детали рядом, зазор 12 мм: ${Math.round(
                footprint.width,
              )} × ${Math.round(footprint.depth)} × ${Math.round(
                footprint.height,
              )} мм`
            : `Горшок на поддоне${params.planterSelfWatering ? ", автополив" : ""}: ${Math.round(
                footprint.width,
              )} × ${Math.round(footprint.depth)} × ${Math.round(
                footprint.height,
              )} мм`,
        request: { planterPart: "all" },
        fileName: planterStlFileName(params, "all"),
      });
    }

    options.push(pot, tray);

    return options;
  }

  // Вывеска и литофан собрали набор файлов выше, поэтому здесь остаются модели
  // с одним STL: ваза, брелок, коробка, кашпо, подставка для украшений,
  // органайзер для ручек и термопринт.
  return [
    {
      id: params.model,
      label: "Скачать STL",
      request: {},
      fileName:
        params.model === "vase"
          ? vaseStlFileName(params)
          : params.model === "keychain"
            ? keychainStlFileName(params)
            : params.model === "jewelry_stand"
              ? jewelryStandStlFileName(params)
              : params.model === "pen_holder"
                ? penHolderStlFileName(params)
                : params.model === "heat_transfer"
                  ? heatTransferStlFileName(params)
                  : boxStlFileName(params),
    },
  ];
}

/**
 * Сцену грузим только в браузере: three.js и WebGL не нужны на сервере.
 * Условие ssr: false разрешено только внутри клиентского компонента, поэтому
 * dynamic живёт здесь, а не в серверном page.tsx. Пока чанк загружается,
 * показываем заглушку того же размера — макет не прыгает.
 */
const Viewport = dynamic(
  () =>
    import("@/components/constructor/Viewport").then(
      (module) => module.Viewport,
    ),
  {
    ssr: false,
    loading: () => <ViewportSkeleton />,
  },
);

function ViewportSkeleton() {
  return (
    <div className="flex h-[min(40vh,20rem)] w-full items-center justify-center rounded-3xl border border-white/10 bg-slate-900/60 sm:h-[min(48vh,26rem)] lg:h-auto lg:min-h-[16rem] lg:flex-1">
      <div className="text-center">
        <span aria-hidden className="text-4xl">
          🌀
        </span>
        <p className="mt-3 text-sm text-slate-300">Загружаем 3D-сцену…</p>
      </div>
    </div>
  );
}

/**
 * Мобильное окно со сценой: кнопка «На весь экран».
 *
 * На телефоне сцена стоит в потоке страницы обычным блоком — иначе она съедала
 * пол-экрана и панель настроек начиналась ниже. Рассмотреть модель целиком
 * можно здесь: канвас занимает всю высоту, настройки под окном не меняются.
 *
 * Окно живёт поверх страницы (`fixed inset-0`), поэтому прокрутка под ним
 * заблокирована: жест по сцене вращает модель, а не листает слайдеры. Escape
 * закрывает окно, как в остальных диалогах проекта, а кнопка «Закрыть» получает
 * фокус — на телефоне она снимает клавиатуру, на планшете закрывает по Enter.
 *
 * Отчёт о размещении картинки окно не отдаёт: его уже считает сцена в потоке
 * страницы, и второй расчёт перебил бы числа в панели, пока в окне грузятся
 * шрифты.
 */
function MobileSceneDialog({
  debugLight,
  onClose,
  params,
}: {
  /**
   * `?debug=light`: тот же флаг, что у сцены в потоке — окно показывает ту же
   * модель, и отладочных кнопок в нём должно быть столько же.
   */
  debugLight: boolean;
  /** Закрытие окна: конструктор убирает его из разметки. */
  onClose: () => void;
  /** Те же параметры, что у сцены в потоке: окно показывает ту же модель. */
  params: ConstructorParams;
}) {
  const titleId = useId();

  /** Escape и блокировка прокрутки страницы под окном. */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-[#030303] lg:hidden"
      role="dialog"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white" id={titleId}>
            Предпросмотр
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            Вращение — свайп, зум — щипок. Закройте окно, чтобы вернуться к
            настройкам.
          </p>
        </div>
        <button
          autoFocus
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          onClick={onClose}
          type="button"
        >
          Закрыть
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Viewport debugLight={debugLight} fullscreen params={params} />
      </div>
    </div>
  );
}

/**
 * Галерея форм: двенадцать силуэтов из `VASE_SHAPES` с текущими настройками
 * узора и размеров.
 *
 * Чем отличается от галереи рецептов выше: рецепт — готовая ваза целиком,
 * поэтому клик по нему переписывает все параметры. Здесь меняется только
 * силуэт, а узор, высота, диаметр и стенка остаются пользовательскими: это
 * ответ на «а как моя ваза выглядела бы в другой форме».
 */
const VaseShapeGallery = dynamic(
  () =>
    import("@/components/constructor/VaseShapeGallery").then(
      (module) => module.VaseShapeGallery,
    ),
  {
    ssr: false,
    loading: () => <VaseGallerySkeleton />,
  },
);

function VaseGallerySkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">Галерея форм</p>
      <p className="mt-2 text-xs text-slate-300">Готовим двенадцать форм…</p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            className="aspect-[18/23] w-full rounded-xl border border-white/10 bg-slate-950/60"
            key={index}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Клиентская оболочка конструктора.
 *
 * Здесь живёт единственный источник правды — объект параметров. Панель меняет
 * его через колбэки, а сцена получает готовые размеры и форму. Нормализация
 * выполняется на каждом изменении, поэтому в профиль и геометрию не попадают
 * значения вне границ слайдеров.
 */
export function ConstructorClient({
  debugLight = false,
  hasPro,
  freeDownloadsLeft: initialFreeDownloadsLeft,
  initialProjectId = null,
}: ConstructorClientProps) {
  const [params, setParams] = useState<ConstructorParams>(
    DEFAULT_CONSTRUCTOR_PARAMS,
  );
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<StlExportError | null>(null);
  const [freeDownloadsLeft, setFreeDownloadsLeft] = useState(
    initialFreeDownloadsLeft,
  );
  /** Сообщение о загрузке проекта в шапке: успех или «не нашли». */
  const [savedProjectNotice, setSavedProjectNotice] =
    useState<SavedProjectNotice | null>(null);
  /**
   * Итоги размещения картинки на брелоке.
   *
   * Заполняет сцена: только у неё есть собранная карта грани. Панель показывает
   * по этим числам, встал ли логотип и насколько он ужался ради букв.
   */
  const [keychainImageReport, setKeychainImageReport] =
    useState<KeychainBuildReport | null>(null);
  /**
   * Раскладка пакетов вывески из сцены.
   *
   * Панель не повторяет расчёт ширины шрифта: отчёт приходит вместе с готовой
   * геометрией и уже содержит решение, влезает ли блок на стол 220 мм.
   */
  const [signLayoutReport, setSignLayoutReport] =
    useState<SignLayoutReport | null>(null);

  /** Модель, по которой открыт опрос после скачивания; null — окно закрыто. */
  const [feedbackModel, setFeedbackModel] = useState<ModelType | null>(null);
  /**
   * Мобильное окно со сценой.
   *
   * На телефоне сцена стоит в потоке страницы, поэтому «покрутить» её удобнее в
   * отдельном окне на весь экран. Состояние живёт здесь: кнопка «На весь экран»
   * стоит в шапке сцены и не знает о разметке окна, а ему нужны текущие
   * параметры.
   */
  const [sceneOpen, setSceneOpen] = useState(false);
  /** Один и тот же проект не загружаем дважды (StrictMode в dev). */
  const loadedProjectRef = useRef<string | null>(null);
  /** Пауза перед опросом: файл должен начать сохраняться раньше окна. */
  const feedbackTimerRef = useRef<number | null>(null);

  /**
   * Проект из адреса `?project=ID`.
   *
   * Ссылку даёт кабинет, поэтому параметры приходят уже нормализованными
   * (normalizeSavedProjectParams) — конструктор просто заменяет состояние.
   * Ошибка не ломает страницу: пользователь видит сообщение и работает с
   * дефолтной моделью.
   */
  useEffect(() => {
    if (!initialProjectId || loadedProjectRef.current === initialProjectId) {
      return;
    }

    loadedProjectRef.current = initialProjectId;
    let active = true;

    loadConstructorProject(initialProjectId)
      .then((result) => {
        if (!active) {
          return;
        }

        if (!result.ok) {
          setSavedProjectNotice({ tone: "error", message: result.error });

          return;
        }

        setParams(result.project.params);
        setSavedProjectNotice({
          tone: "success",
          message: `Проект «${result.project.title}» загружен.`,
        });
      })
      .catch(() => {
        // Сеть отвалилась между кликом и ответом действия.
        if (active) {
          setSavedProjectNotice({
            tone: "error",
            message: "Не удалось загрузить проект. Попробуйте ещё раз.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [initialProjectId]);

  /** Закрытие опроса: таймер уже отработал, окно убираем из разметки. */
  const closeFeedback = useCallback(() => setFeedbackModel(null), []);

  /** Закрытие мобильного окна со сценой: ссылка стабильна для эффекта Escape. */
  const closeScene = useCallback(() => setSceneOpen(false), []);

  /**
   * Отчёт сцены о картинке на брелоке.
   *
   * Ссылка держится стабильной: эффект в сцене зависит от этого колбэка, и новая
   * функция на каждый рендер вызывала бы его бесконечно. Пустой отчёт (нет
   * картинки или модель не брелок) превращается в null, чтобы панель не
   * показывала чужие числа после переключения модели.
   */
  /**
   * Отчёт сцены о декорациях брелока.
   *
   * Ссылка держится стабильной: эффект в сцене зависит от этого колбэка, и новая
   * функция на каждый рендер вызывала бы его бесконечно. Пустой отчёт (нет
   * декораций или модель не брелок) превращается в null, чтобы панель не
   * показывала чужие числа после переключения модели.
   */
  const handleKeychainImageReport = useCallback(
    (report: KeychainBuildReport | null) =>
      setKeychainImageReport(
        report && report.decorations.length > 0 ? report : null,
      ),
    [],
  );
  /** Стабильная ссылка на приёмник отчёта вывески, как у брелока. */
  const handleSignLayoutReport = useCallback(
    (report: SignLayoutReport | null) => setSignLayoutReport(report),
    [],
  );

  // Окно опроса не должно появиться после ухода со страницы.
  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    },
    [],
  );

  /**
   * Показывает опрос после успешного скачивания.
   *
   * Счётчик ведёт lib/constructor/feedback: третье скачивание, дальше каждое
   * десятое. Задержка нужна, чтобы окно не перекрыло диалог сохранения файла.
   */
  function scheduleFeedback(model: ModelType) {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      feedbackTimerRef.current = null;
      setFeedbackModel(model);
    }, FEEDBACK_OPEN_DELAY_MS);
  }

  /**
   * Числовой слайдер: ключ панели и новое значение.
   *
   * Слои узора сюда не попадают — у них свой обработчик. Нормализация вызывается
   * на каждое изменение: она выравнивает число по шагу и держит его в границах,
   * поэтому в состоянии модели не бывает 0.53 мм там, где шаг 0.1.
   */
  function updateParam(key: SizeParam, value: number) {
    setParams((current) => normalizeConstructorParams({ ...current, [key]: value }));
  }

  /**
   * Смена модели начинается с её дефолтных параметров.
   *
   * Модель выбирается выпадающим списком: это новая заготовка, а не возврат к
   * черновику. Пользователь ждёт исходные размеры и форму, а не значения,
   * оставшиеся от прошлого визита. Параметры остальных моделей сохраняются.
   */
  function updateModel(model: ModelType) {
    setParams((current) =>
      model === current.model
        ? current
        : normalizeConstructorParams({
            ...current,
            model,
            ...MODEL_DEFAULT_PARAMS[model],
          }),
    );
  }

  function updateShape(shape: VaseShape) {
    setParams((current) => normalizeConstructorParams({ ...current, shape }));
  }

  /**
   * Случайная ваза: силуэт, один-два узора, амплитуда, частота и сид.
   *
   * Кнопка в панели отвечает на «покажи что-нибудь другое»: это дешевле, чем
   * крутить шесть слайдеров. Числа выбирает `randomVaseParams`, а `Math.random`
   * передаётся аргументом — сама функция чистая и проверяется тестом с
   * подставным генератором. Результат сразу становится параметрами модели, так
   * что проект и STL остаются воспроизводимыми: в сохранёнке лежат конкретные
   * числа, а не «рандом».
   *
   * Размеры, стенка и деформации не меняются: кнопка крутит форму вазы, а не
   * стол принтера.
   */
  function randomizeVase() {
    setParams((current) =>
      normalizeConstructorParams({
        ...current,
        model: "vase",
        ...randomVaseParams(() => Math.random()),
      }),
    );
  }

  /**
   * Клик по рецепту: готовая ваза вместо текущей.
   *
   * Рецепт приходит как `Partial<VaseParams>`, но применяется целиком, вместе со
   * значениями по умолчанию: иначе цоколь, обод и сид прежней вазы остались бы в
   * модели, и картинка в галерее перестала бы совпадать с результатом. Слои
   * узора и размеры тоже приходят из рецепта — это и есть смысл плитки.
   */
  function applyVaseRecipe(recipe: VaseRecipe) {
    setParams((current) =>
      normalizeConstructorParams({
        ...current,
        model: "vase",
        ...vaseRecipeParams(recipe),
      }),
    );
  }

  /**
   * Правка полей одного слоя узора.
   *
   * Патч применяется поверх слоя, а `envelope` в нём приходит целиком: панель
   * складывает его из текущих миллиметров и нового значения. Так в модели не
   * появляется слой, у которого половина затухания осталась от другого слоя.
   */
  function updatePatternLayer(index: number, patch: Partial<PatternLayer>) {
    setParams((current) =>
      normalizeConstructorParams({
        ...current,
        patterns: current.patterns.map((layer, layerIndex) =>
          layerIndex === index ? { ...layer, ...patch } : layer,
        ),
      }),
    );
  }

  /**
   * Новый слой узора: тип и числа выбирает `nextPatternLayer`.
   *
   * Проверка на лимит нужна и здесь, а не только на выключенной кнопке: проект
   * мог сохраниться с тремя слоями, а панель рисует кнопку по своему состоянию.
   * Молчаливая обрезка списка нормализацией выглядела бы как «нажал — ничего».
   */
  function addPatternLayer() {
    setParams((current) =>
      current.patterns.length >= VASE_MAX_PATTERN_LAYERS
        ? current
        : normalizeConstructorParams({
            ...current,
            patterns: [...current.patterns, nextPatternLayer(current.patterns)],
          }),
    );
  }

  /**
   * Удаление слоя по индексу.
   *
   * Последний слой не удаляется: пустой список нормализация заменила бы гладким
   * слоем, и кнопка «Добавить» начала бы с рёбер — то есть удаление последнего
   * слоя меняло бы узор вместо того, чтобы просто убрать рельеф.
   */
  function removePatternLayer(index: number) {
    setParams((current) =>
      current.patterns.length <= 1
        ? current
        : normalizeConstructorParams({
            ...current,
            patterns: current.patterns.filter(
              (_layer, layerIndex) => layerIndex !== index,
            ),
          }),
    );
  }

  /**
   * Выбор нового пресета силуэта.
   *
   * Своего контура у брелока больше нет, поэтому пресет в модели — единственный
   * источник формы. Снятие пресета (`null`) возвращает форму по умолчанию —
   * первый пресет реестра, — а размеры пресета записываются в слайдеры: панель
   * показывает те миллиметры, из которых сложится модель, и их можно править
   * дальше.
   */
  function updateKeychainPreset(presetId: KeychainPresetId | null) {
    setParams((current) => {
      if (!presetId) {
        return normalizeConstructorParams({ ...current, keychainPreset: null });
      }

      const preset = keychainPresetById(presetId);

      return normalizeConstructorParams({
        ...current,
        keychainPreset: presetId,
        width: preset.defaultWidth,
        length: preset.defaultHeight,
        thickness: preset.defaultThickness,
      });
    });
  }

  /** Правка одной декорации: панель присылает только изменённые поля. */
  function updateKeychainDecoration(
    kind: KeychainDecorationKind,
    patch: Partial<KeychainDecoration>,
  ) {
    setParams((current) =>
      normalizeConstructorParams({
        ...current,
        decorations: patchKeychainDecoration(current.decorations, kind, patch),
      }),
    );
  }

  /**
   * «Добавить текст»: пустая карточка ждёт ввода.
   *
   * Содержимое пустое намеренно — буквы появятся, как только человек что-то
   * наберёт. Повторное добавление ничего не делает: декорация этого вида уже есть.
   */
  function addKeychainTextDecoration() {
    setParams((current) =>
      current.decorations.some((decoration) => decoration.kind === "text")
        ? current
        : normalizeConstructorParams({
            ...current,
            decorations: [...current.decorations, createKeychainTextDecoration()],
          }),
    );
  }

  /**
   * «Добавить картинку»: панель присылает готовую маску и имя файла.
   *
   * Маску собирает canvas в браузере (`keychainImageFromPixels`), поэтому сюда
   * приходит уже проверенная строка. Если картинка уже есть, она заменяется:
   * второй логотип на брелок не помещается.
   */
  function addKeychainImageDecoration(imageData: string, imageName: string) {
    setParams((current) =>
      normalizeConstructorParams({
        ...current,
        decorations: [
          ...current.decorations.filter(
            (decoration) => decoration.kind !== "image",
          ),
          createKeychainImageDecoration(imageData, imageName),
        ],
      }),
    );
  }

  /** «Удалить» у карточки: рельеф уходит из модели вместе с настройками. */
  function removeKeychainDecoration(kind: KeychainDecorationKind) {
    setParams((current) =>
      normalizeConstructorParams({
        ...current,
        decorations: current.decorations.filter(
          (decoration) => decoration.kind !== kind,
        ),
      }),
    );
  }

  function updateKeychainNfc(nfcEnabled: boolean) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, nfcEnabled }),
    );
  }

  /**
   * Позиция отверстия под кольцо: набор значений проверяет нормализация по
   * реестру пресета, поэтому панель передаёт выбор как есть.
   */
  function updateHolePlacement(holePlacement: HolePlacement) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, holePlacement }),
    );
  }

  /**
   * Содержимое QR-визитки: размер, крепление, рельеф и строка кода.
   *
   * Один обработчик на все поля визитки: нормализация сама выводит габарит из
   * размера и держит толщину в границах пресета, поэтому панель не повторяет
   * эти правила. Строки чистятся до состояния: в состоянии модели не должно быть
   * управляющих символов, которые потом попали бы в код.
   */
  function updateQrCard(patch: Partial<KeychainParams>) {
    setParams((current) => normalizeConstructorParams({ ...current, ...patch }));
  }

  /** Рельеф и содержимое кода живут в декорации `qr`, а не в полях модели. */
  function updateQrDecoration(patch: Partial<KeychainQrDecoration>) {
    setParams((current) => {
      const hasQr = current.decorations.some(
        (decoration) => decoration.kind === "qr",
      );

      return normalizeConstructorParams({
        ...current,
        decorations: hasQr
          ? patchKeychainDecoration(current.decorations, "qr", patch)
          : [
              ...current.decorations,
              // Декорации визитки ещё нет (её силуэт не выбран): карточка поля
              // создаёт её из образца, чтобы введённое не потерялось.
              { ...DEFAULT_KEYCHAIN_QR_DECORATION, ...patch } as KeychainQrDecoration,
            ],
      });
    });
  }

  function updateQrCardSize(qrCardSize: QrCardSize) {
    updateQrCard({ qrCardSize });
  }

  function updateQrCardTab(qrCardTab: QrCardTab) {
    updateQrCard({ qrCardTab });
  }

  function updateQrMode(qrMode: QrMode) {
    updateQrDecoration({ qrMode });
  }

  function updateQrContentType(qrContentType: QrContentType) {
    updateQrDecoration({ qrContentType });
  }

  function updateQrContent(qrContent: string) {
    updateQrDecoration({ qrContent: sanitizeQrCardContent(qrContent) });
  }

  function updateQrName(qrName: string) {
    updateQrDecoration({ qrName: sanitizeQrCardName(qrName) });
  }

  function updateQrPhone(qrPhone: string) {
    updateQrDecoration({ qrPhone: sanitizeQrCardPhone(qrPhone) });
  }

  function updateSignText(signText: string) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, signText }),
    );
  }

  function updateSignFont(signFont: SignFont) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, signFont }),
    );
  }

  function updateSignChannelWidth(signChannelWidth: SignChannelWidth) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, signChannelWidth }),
    );
  }

  function updateSignRailMode(signRailMode: SignRailMode) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, signRailMode }),
    );
  }

  function updateHasLid(hasLid: boolean) {
    setParams((current) => normalizeConstructorParams({ ...current, hasLid }));
  }

  function updateBoxMagnets(boxMagnets: boolean) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, boxMagnets }),
    );
  }

  function updateBoxMagnetSize(boxMagnetSize: BoxMagnetSize) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, boxMagnetSize }),
    );
  }

  function updateBoxStack(boxStack: boolean) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, boxStack }),
    );
  }

  /** Пресет меняет габариты, скругление и число перегородок одной кнопкой. */
  function updateBoxPreset(preset: BoxPresetId) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, ...boxPresetParams(preset) }),
    );
  }

  function updateLithoFrame(lithoFrame: boolean) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, lithoFrame }),
    );
  }

  /**
   * Крепление литофана.
   *
   * В интерфейсе доступен только полоз с кольцом: старые подставки, арка и подвес
   * читаются у сохранённых проектов, но заново не выбираются. Крепление без
   * рамки не существует — полоз врезан в её тыл, — поэтому нормализация сама
   * сбрасывает его в `none`.
   */
  function updateLithoMount(lithoMount: LithophaneMount) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, lithoMount }),
    );
  }

  /**
   * Патрон кольца: E14 или E27.
   *
   * Значение не зависит от крепления и запоминается: у подставки гнездо не
   * печатается, а вернувшись к полозу человек получает прежний выбор.
   */
  function updateLithoRailSocket(lithoRailSocket: LithophaneRailSocket) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, lithoRailSocket }),
    );
  }

  /**
   * Расстояние от панели до лицевой плоскости кольца.
   *
   * Слайдер двигает кольцо по полозу: полоз остаётся на тылу рамки, а его паз
   * держит ножку кольца на любом конце диапазона.
   */
  function updateLithoRailDistance(lithoRailDistance: number) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, lithoRailDistance }),
    );
  }

  /**
   * Форма панели: плоская, круглый плафон или калейдоскоп.
   *
   * Крепление при этом не сбрасывается: у плафона и призмы его просто не печатают,
   * и вернувшись к плоской форме человек получает прежнее.
   */
  function updateLithoShape(lithoShape: LithophaneShape) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, lithoShape }),
    );
  }

  /**
   * Браузер уже сжал фотографию до 400 пикселей по длинной стороне и отдал
   * сетку яркости вместе с её размерами. Массив идёт в общее состояние как
   * есть: API принимает те же числа, поэтому сервер не декодирует картинку
   * повторно. Размеры обязательны — без них сетка 400 × 267 читалась бы как
   * квадрат и нормализация подменила бы фото демонстрационным рельефом.
   *
   * Панель может передать и толщины: распознанный логотип ставит 0.6…3.5 мм,
   * чтобы знак не сливался с фоном на просвет. Фото толщины не трогает.
   */
  function updateLithophaneBrightness(
    grid: LithophaneBrightnessGrid,
    thickness?: { min: number; max: number },
  ) {
    setParams((current) =>
      normalizeConstructorParams({
        ...current,
        lithophaneBrightness: grid.brightness,
        lithophaneBrightnessWidth: grid.width,
        lithophaneBrightnessHeight: grid.height,
        ...(thickness
          ? {
              lithophaneMinThickness: thickness.min,
              lithophaneMaxThickness: thickness.max,
            }
          : null),
      }),
    );
  }

  /**
   * Фото на одну из остальных граней калейдоскопа.
   *
   * Слот копируется в новый массив: ссылка на массив — это признак «какие грани
   * уже заняты», и мутация на месте не пересобрала бы ни предпросмотр, ни бюджет.
   * `null` очищает слот, и грань снова повторяет предыдущую.
   */
  function updateLithophaneSideBrightness(
    slot: number,
    grid: LithophaneBrightnessGrid | null,
  ) {
    setParams((current) => {
      const slots = current.lithophaneSideBrightness.map((value, index) =>
        index === slot ? grid : value,
      );

      return normalizeConstructorParams({
        ...current,
        lithophaneSideBrightness: slots,
      });
    });
  }

  function updatePlanterShape(planterShape: PlanterShape) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, planterShape }),
    );
  }

  function updatePlanterDrainage(planterDrainage: boolean) {
    setParams((current) =>
      normalizeConstructorParams({
        ...current,
        planterDrainage,
        planterSelfWatering: planterDrainage
          ? current.planterSelfWatering
          : false,
      }),
    );
  }

  function updatePlanterSelfWatering(planterSelfWatering: boolean) {
    setParams((current) =>
      normalizeConstructorParams({
        ...current,
        planterDrainage: planterSelfWatering
          ? true
          : current.planterDrainage,
        planterSelfWatering,
      }),
    );
  }

  function updateCoasterShape(coasterShape: CoasterShape) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, coasterShape }),
    );
  }

  function updateCoasterPattern(coasterPattern: CoasterPattern) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, coasterPattern }),
    );
  }

  function updateCoasterRim(coasterRim: boolean) {
    setParams((current) => normalizeConstructorParams({ ...current, coasterRim }));
  }

  function updateCoasterHolderType(coasterHolderType: CoasterHolderType) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, coasterHolderType }),
    );
  }

  function updateCoasterHolderStyle(coasterHolderStyle: CoasterHolderStyle) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, coasterHolderStyle }),
    );
  }

  function updateCoasterCount(coasterCount: number) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, coasterCount }),
    );
  }

  /**
   * Смена пресета коллекции.
   *
   * Пресеты делят одно поле `model: "jewelry_stand"`, поэтому параметры соседей
   * не сбрасываются: вернувшись к листу, пользователь получает свои длину,
   * ширину и глубину прожилок.
   */
  function updateJewelryPreset(jewelryPreset: JewelryPreset) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, jewelryPreset }),
    );
  }

  function updateJewelryLeafType(jewelryLeafType: JewelryLeafType) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, jewelryLeafType }),
    );
  }

  function updatePenShape(penShape: PenShape) {
    setParams((current) => normalizeConstructorParams({ ...current, penShape }));
  }

  /**
   * Логотип термопринта приходит уже проверенным: текст SVG или контур из PNG.
   *
   * Одно поле на сцену, экспорт и сохранение проекта — поэтому предпросмотр не
   * может показать не тот контур, который уйдёт в STL.
   */
  function updateHeatTransferSvg(heatTransferSvg: string) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, heatTransferSvg }),
    );
  }

  function updateHeatTransferMirror(heatTransferMirror: boolean) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, heatTransferMirror }),
    );
  }

  /** Сброс возвращает к старту только текущую модель, не трогая остальные. */
  function resetParams() {
    setParams((current) =>
      normalizeConstructorParams({
        ...current,
        ...MODEL_DEFAULT_PARAMS[current.model],
      }),
    );
  }

  /**
   * Кнопки экспорта пересобираются при смене параметров модели или отчёта
   * вывески. Отчёт приходит после загрузки шрифта; его подпись не даёт применить
   * старые габариты к новой надписи.
   */
  const signLayout =
    params.model === "sign" &&
    signLayoutReport?.signature === signLayoutSignature(params)
      ? signLayoutReport
      : null;
  const exportOptions = useMemo(
    () => buildExportOptions(params, signLayout),
    [params, signLayout],
  );
  /**
   * Предупреждение о пакете, который не влезает на стол.
   *
   * Отдельные файлы остаются доступны: это не запрет, а честная подсказка, что
   * общий STL такого блока печатать одним заданием нельзя.
   */
  const signPackageNotice =
    params.model === "sign"
      ? signExportNotice(params, signLayoutReport)
      : null;

  /**
   * Скачивание STL через сервер.
   *
   * Геометрия собирается на сервере, а браузер получает готовый бинарный файл:
   * подписку проверяет API, поэтому обойти гейт через DevTools нельзя. Blob
   * нужен, чтобы не уводить страницу на ответ API и сохранить имя из
   * Content-Disposition.
   */
  async function exportStl(option: StlExportOption) {
    if (exportingId) {
      return;
    }

    setExportingId(option.id);
    setExportError(null);

    try {
      const response = await fetch("/api/constructor/stl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        // Параметры модели плюс выбор файла: `part` для литофана,
        // `blockIndex` и `signPart` для деталей вывески. Сервер валидирует их
        // вместе с остальными полями.
        body: JSON.stringify({ ...params, ...option.request }),
      });

      if (response.status === 200) {
        // Сервер уже записал бесплатное скачивание — уменьшаем остаток до
        // сохранения файла, чтобы кнопка не позволила четвёртую попытку.
        if (!hasPro) {
          setFreeDownloadsLeft((left) => Math.max(0, left - 1));
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = stlFileNameFromDisposition(
          response.headers.get("content-disposition"),
          option.fileName,
        );
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
        // Даём браузеру начать сохранение, затем освобождаем память.
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

        // Счётчик опроса живёт в браузере: Pro сервер скачивания не считает.
        if (shouldAskForConstructorFeedback(registerConstructorDownload())) {
          scheduleFeedback(params.model);
        }

        return;
      }

      if (response.status === 403) {
        const serverMessage = await readServerMessage(response);

        // 403 теперь означает исчерпанный бесплатный лимит. Синхронизируем
        // счётчик с сервером, даже если страница была открыта давно.
        if (!hasPro) {
          setFreeDownloadsLeft(0);
        }

        setExportError({
          message:
            serverMessage ??
            "Лимит бесплатных скачиваний исчерпан. Подписка Pro открывает безлимитный экспорт.",
          action: "pro",
        });

        return;
      }

      if (response.status === 401) {
        setExportError({
          message: "Сессия истекла. Войдите в аккаунт заново.",
          action: "login",
        });

        return;
      }

      if (response.status >= 500) {
        setExportError({
          message: "Ошибка сервера, попробуйте еще раз",
          action: null,
        });

        return;
      }

      const serverMessage = await readServerMessage(response);

      setExportError({
        message:
          serverMessage ??
          "Не удалось подготовить STL. Проверьте параметры модели.",
        action: null,
      });
    } catch {
      setExportError({
        message: "Ошибка сервера, попробуйте еще раз",
        action: null,
      });
    } finally {
      setExportingId(null);
    }
  }

  const exportBlockReason = constructorExportBlockReason(params);
  const primaryExport = exportOptions[0] ?? null;
  const mobileExportBlocked =
    exportBlockReason !== null ||
    (!hasPro && freeDownloadsLeft <= 0) ||
    exportingId !== null;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 lg:h-[calc(100dvh_-_var(--header-h))] lg:overflow-hidden lg:pt-4 lg:pb-4 xl:max-w-[104rem] xl:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:text-sm"
            href="/dashboard"
          >
            <span aria-hidden>←</span>В кабинет
          </Link>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Конструктор 3D
            </h1>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.65rem] font-semibold tracking-wide text-slate-400 uppercase">
              {MODEL_TYPES.length} моделей
            </span>
          </div>

          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">
            Выберите модель, настройте параметры и проверьте результат в 3D. STL
            собирается по текущим настройкам.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <span
            className={
              hasPro
                ? "inline-flex min-h-10 items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3.5 text-sm font-semibold text-emerald-200"
                : "inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 text-sm font-semibold text-slate-300"
            }
          >
            <span aria-hidden>{hasPro ? "✓" : "◷"}</span>
            {hasPro
              ? "Pro · STL без лимита"
              : `Бесплатно · ${freeDownloadsLeft} из ${FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH} STL`}
          </span>

          {/* Сохранение доступно всем: проект помнит настройки, а не файл. */}
          <SaveProjectDialog params={params} />
        </div>
      </div>

      {savedProjectNotice ? (
        <p
          role={savedProjectNotice.tone === "error" ? "alert" : "status"}
          className={
            savedProjectNotice.tone === "error"
              ? "mt-5 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              : "mt-5 flex items-start gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
          }
        >
          <span aria-hidden>
            {savedProjectNotice.tone === "error" ? "⚠️" : "✓"}
          </span>
          <span className="flex-1">{savedProjectNotice.message}</span>
          <button
            type="button"
            onClick={() => setSavedProjectNotice(null)}
            aria-label="Скрыть сообщение"
            className="-my-1 ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-full text-base leading-none text-current transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            <span aria-hidden>×</span>
          </button>
        </p>
      ) : null}

      {/*
        Рабочая область — как в настольном редакторе. На широком экране три
        колонки: слева библиотека моделей, в центре сцена, справа настройки с
        закреплённым блоком скачивания. Меню модели больше не спрятано в
        выпадающем списке, а скачивание не уезжает под тысячи пикселей
        параметров.
        На ноутбуке остаются две колонки: лента моделей идёт сверху на всю
        ширину, настройки слева, сцена справа. На телефоне порядок такой:
        сцена, лента моделей, настройки — страница прокручивается целиком.
      */}
      <div className="mt-5 flex flex-1 flex-col gap-4 lg:min-h-0 lg:grid lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[minmax(13.5rem,15rem)_minmax(0,1fr)_minmax(21rem,26rem)] xl:grid-rows-[minmax(0,1fr)]">
        <ModelPicker
          className="order-2 lg:col-span-2 lg:row-start-1 xl:col-span-1 xl:col-start-1 xl:row-start-1 xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain xl:[scrollbar-color:#475569_transparent] xl:[scrollbar-width:thin]"
          model={params.model}
          onChange={updateModel}
        />

        <aside className="order-3 min-w-0 lg:col-start-1 lg:row-start-2 lg:min-h-0 xl:col-start-3 xl:row-start-1">
          <ParameterPanel
            exportError={exportError}
            exportNotice={signPackageNotice}
            freeDownloadsLeft={freeDownloadsLeft}
            hasPro={hasPro}
            exportingId={exportingId}
            exportOptions={exportOptions}
            onBoxPresetChange={updateBoxPreset}
            onBoxMagnetsChange={updateBoxMagnets}
            onBoxMagnetSizeChange={updateBoxMagnetSize}
            onBoxStackChange={updateBoxStack}
            onCoasterPatternChange={updateCoasterPattern}
            onCoasterRimChange={updateCoasterRim}
            onCoasterShapeChange={updateCoasterShape}
            onCoasterHolderTypeChange={updateCoasterHolderType}
            onCoasterHolderStyleChange={updateCoasterHolderStyle}
            onCoasterCountChange={updateCoasterCount}
            onExport={exportStl}
            onHasLidChange={updateHasLid}
            onHeatTransferMirrorChange={updateHeatTransferMirror}
            onHeatTransferSvgChange={updateHeatTransferSvg}
            onHolePlacementChange={updateHolePlacement}
            onJewelryPresetChange={updateJewelryPreset}
            onJewelryLeafTypeChange={updateJewelryLeafType}
            onKeychainPresetChange={updateKeychainPreset}
            onKeychainDecorationChange={updateKeychainDecoration}
            onAddKeychainText={addKeychainTextDecoration}
            onAddKeychainImage={addKeychainImageDecoration}
            onRemoveKeychainDecoration={removeKeychainDecoration}
            keychainReport={keychainImageReport}
            onLithoFrameChange={updateLithoFrame}
            onLithoMountChange={updateLithoMount}
            onLithoRailSocketChange={updateLithoRailSocket}
            onLithoRailDistanceChange={updateLithoRailDistance}
            onLithoShapeChange={updateLithoShape}
            onLithophaneBrightnessChange={updateLithophaneBrightness}
            onLithophaneSideBrightnessChange={updateLithophaneSideBrightness}
            onNfcChange={updateKeychainNfc}
            onParamChange={updateParam}
            onPatternLayerChange={updatePatternLayer}
            onAddPatternLayer={addPatternLayer}
            onRemovePatternLayer={removePatternLayer}
            onPenShapeChange={updatePenShape}
            onPlanterDrainageChange={updatePlanterDrainage}
            onPlanterSelfWateringChange={updatePlanterSelfWatering}
            onPlanterShapeChange={updatePlanterShape}
            onQrCardSizeChange={updateQrCardSize}
            onQrCardTabChange={updateQrCardTab}
            onQrContentChange={updateQrContent}
            onQrContentTypeChange={updateQrContentType}
            onQrModeChange={updateQrMode}
            onQrNameChange={updateQrName}
            onQrPhoneChange={updateQrPhone}
            onReset={resetParams}
            onShapeChange={updateShape}
            onRandomizeVase={randomizeVase}
            onSignChannelWidthChange={updateSignChannelWidth}
            onSignRailModeChange={updateSignRailMode}
            onSignFontChange={updateSignFont}
            onSignTextChange={updateSignText}
            params={params}
          >
            {/* Галереи живут в прокрутке настроек: рецепт — готовая ваза
                целиком, форма — тот же узор в другом силуэте. Блок скачивания
                внизу панели остаётся на месте. */}
            <VaseRecipeGallery
              onApplyRecipe={applyVaseRecipe}
              params={params}
            />

            <VaseShapeGallery onSelectShape={updateShape} params={params} />
          </ParameterPanel>
        </aside>

        <section
          aria-labelledby="preview-heading"
          className="order-1 flex min-w-0 flex-col lg:col-start-2 lg:row-start-2 lg:min-h-0 xl:col-start-2 xl:row-start-1"
        >
          {/*
            Сцена — центральная колонка: на широком экране она самая большая,
            на ноутбуке справа от настроек. На телефоне это первый блок после
            заголовка; покрутить модель во весь экран можно кнопкой «Показать
            3D» внизу справа.
          */}
          <div className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
              <h2
                className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-300 uppercase"
                id="preview-heading"
              >
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                />
                3D-сцена
              </h2>
              <span className="hidden text-xs tabular-nums text-slate-300 sm:inline">
                {params.model === "vase" ? (
                  <>
                    {VASE_SHAPE_LABELS[params.shape]} ·{" "}
                    {vasePatternLabel(params.patterns)} · {params.height} × Ø{" "}
                    {params.diameter} мм
                  </>
                ) : params.model === "keychain" ? (
                  <>
                    {keychainShapeLabel(params)} · {params.length} ×{" "}
                    {params.width} × {params.thickness} мм
                    {keychainTextDecoration(params.decorations)?.content.trim()
                      ? ` · «${keychainTextDecoration(params.decorations)?.content.trim()}»`
                      : ""}
                  </>
                ) : params.model === "lithophane" ? (
                  <>
                    {params.lithophaneWidth} × {params.lithophaneHeight} мм · рельеф{" "}
                    {params.lithophaneMinThickness.toFixed(1)}–
                    {params.lithophaneMaxThickness.toFixed(1)} мм ·{" "}
                    {LITHOPHANE_SHAPE_LABELS[params.lithoShape].toLowerCase()}
                    {params.lithoShape === "flat"
                      ? ` · ${params.lithoFrame ? "рамка" : "без рамки"}`
                      : ""}
                  </>
                ) : params.model === "planter" ? (
                  <>
                    {PLANTER_SHAPE_LABELS[params.planterShape]} ·{" "}
                    {params.planterSize} ×{" "}
                    {Math.round(planterFootprint(params).potDepth)} ×{" "}
                    {params.planterHeight} мм ·{" "}
                    {params.planterDrainage
                      ? `поддон ${planterFootprint(params).trayWidth} × ${Math.round(
                          planterFootprint(params).trayDepth,
                        )} × ${planterFootprint(params).trayHeight} мм · набор ${Math.round(
                          planterFootprint(params).width,
                        )} × ${Math.round(
                          planterFootprint(params).depth,
                        )} × ${Math.round(planterFootprint(params).height)} мм${
                          params.planterSelfWatering ? " · автополив" : ""
                        }`
                      : "без поддона"}
                  </>
                ) : params.model === "coaster" ? (
                  <>
                    {COASTER_SHAPE_LABELS[params.coasterShape]} ·{" "}
                    {COASTER_PATTERN_LABELS[params.coasterPattern].toLowerCase()} ·{" "}
                    {params.coasterSize} × {params.coasterThickness} мм ·{" "}
                    {params.coasterRim ? "с бортиком" : "без бортика"}
                    {params.coasterHolderType === "vertical"
                      ? ` · ${
                          params.coasterHolderStyle === "vertical"
                            ? "накопитель"
                            : "стойка"
                        } на ${params.coasterCount}`
                      : ""}
                  </>
                ) : params.model === "jewelry_stand" ? (
                  params.jewelryPreset === "leaf_tray" ? (
                    <>
                      {JEWELRY_PRESET_LABELS[params.jewelryPreset]} ·{" "}
                      {JEWELRY_LEAF_TYPE_LABELS[
                        params.jewelryLeafType
                      ].toLowerCase()}{" "}
                      · {params.jewelryLeafLength} × {params.jewelryLeafWidth} мм
                    </>
                  ) : params.jewelryPreset === "antler_tree" ? (
                    <>
                      {JEWELRY_PRESET_LABELS[params.jewelryPreset]} · база{" "}
                      {params.baseLength} × {params.baseWidth} мм · рога{" "}
                      {params.antlerSpread} мм
                    </>
                  ) : (
                    <>
                      {JEWELRY_PRESET_LABELS[params.jewelryPreset]} ·{" "}
                      {params.treeHeight} × Ø{params.treeBaseDiameter} мм ·{" "}
                      {params.treeBranchCount} ветви · изгиб{" "}
                      {Math.round(params.treeTwist * 100)}%
                    </>
                  )
                ) : params.model === "pen_holder" ? (
                  <>
                    {PEN_SHAPE_LABELS[params.penShape]} · {params.penSize} ×{" "}
                    {params.penHeight} мм · отделения: {params.penSections} · стенка{" "}
                    {params.penWall.toFixed(1)} мм
                    {params.penRimSlope > 0
                      ? ` · срез ${params.penRimSlope} мм`
                      : ""}
                  </>
                ) : params.model === "heat_transfer" ? (
                  <>
                    {params.heatTransferWidth} × {params.heatTransferHeight} мм ·{" "}
                    {params.heatTransferLayers} сл. ·{" "}
                    {params.heatTransferMirror ? "зеркало" : "без зеркала"} ·{" "}
                    {params.heatTransferSvg ? "логотип загружен" : "логотипа нет"}
                  </>
                ) : (
                  <>
                    «{params.signText.trim() || "без надписи"}» · кегль{" "}
                    {params.signFontSize} мм · букв{" "}
                    {listSignLetters(params.signText).length} · блоков{" "}
                    {listSignBlocks(params.signText, params.signBlockSize).length} ·
                    выступ {params.signDepth} мм
                  </>
                )}
              </span>
              <button
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-blue-400/50 bg-blue-500/15 px-3 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-500/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:hidden"
                onClick={() => setSceneOpen(true)}
                type="button"
              >
                <span aria-hidden>⛶</span>
                На весь экран
              </button>

            </div>

            <div className="mt-3 flex min-h-0 flex-col lg:mt-2 lg:flex-1">
              <Viewport
                debugLight={debugLight}
                params={params}
                onKeychainImageReport={handleKeychainImageReport}
                onSignLayoutReport={handleSignLayoutReport}
              />

            </div>
          </div>
        </section>
      </div>

      {/*
        Мобильная панель экспорта: на телефоне настройки длинные, поэтому
        кнопка в конце панели скрыта. Здесь всегда виден главный файл — с тем
        же ограничением, что и в панели, чтобы нельзя было скачать заведомо
        непригодную модель. Когда бесплатные скачивания кончились, кнопка
        уступает место переходу на Pro.
      */}
      {primaryExport ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">
                {hasPro || freeDownloadsLeft > 0
                  ? "STL по настройкам"
                  : "Лимит скачиваний исчерпан"}
              </p>
              <p
                className={
                  exportBlockReason || exportError
                    ? "mt-0.5 line-clamp-2 text-[0.65rem] leading-snug text-amber-200"
                    : "mt-0.5 text-[0.65rem] leading-snug text-slate-400"
                }
              >
                {exportBlockReason ??
                  exportError?.message ??
                  (hasPro
                    ? "Подписка Pro: без лимита"
                    : freeDownloadsLeft > 0
                      ? `Осталось ${freeDownloadsLeft} из ${FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH}`
                      : "Подписка Pro открывает безлимитную генерацию STL")}
              </p>
            </div>
            {hasPro || freeDownloadsLeft > 0 ? (
              <button
                aria-busy={exportingId === primaryExport.id}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:bg-blue-600/50 disabled:text-white/70 disabled:shadow-none"
                disabled={mobileExportBlocked}
                onClick={() => exportStl(primaryExport)}
                title={exportBlockReason ?? undefined}
                type="button"
              >
                {exportingId === primaryExport.id ? "Генерация…" : "Скачать"}
              </button>
            ) : (
              <Link
                aria-label="Оформить подписку Pro"
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-400 px-5 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/25 transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                href="/pricing"
              >
                <span aria-hidden>⚡</span>
                Pro
              </Link>
            )}
          </div>
        </div>
      ) : null}

      {/* Окно со сценой живёт вне сетки: оно открывается поверх страницы. */}
      {sceneOpen ? (
        <MobileSceneDialog
          debugLight={debugLight}
          onClose={closeScene}
          params={params}
        />
      ) : null}

      {/* Опрос живёт вне сетки: он открывается поверх страницы. */}
      {feedbackModel ? (
        <FeedbackDialog model={feedbackModel} onClose={closeFeedback} />
      ) : null}
    </main>
  );
}
