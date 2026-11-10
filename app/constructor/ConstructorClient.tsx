"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { loadConstructorProject } from "@/app/actions/projects";
import { FeedbackDialog } from "@/components/constructor/FeedbackDialog";
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
import type { SavedProjectNotice } from "@/lib/constructor/projects";
import type { KeychainBuildReport } from "@/lib/constructor/keychain-geometry";
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
  DEFAULT_STAND_PARAMS,
  DEFAULT_VASE_PARAMS,
  JEWELRY_CONFIG_LABELS,
  LITHOPHANE_MOUNT_LABELS,
  LITHOPHANE_PART_LABELS,
  PEN_SHAPE_LABELS,
  PLANTER_SHAPE_LABELS,
  SIGN_PARTS,
  VASE_MAX_PATTERN_LAYERS,
  VASE_SHAPE_LABELS,
  boxPresetParams,
  boxStlFileName,
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
  lithophaneStlFileName,
  normalizeConstructorParams,
  nextPatternLayer,
  penHolderStlFileName,
  planterStlFileName,
  signStlFileName,
  standStlFileName,
  vasePatternLabel,
  vaseStlFileName,
  type BoxPresetId,
  type CoasterPattern,
  type CoasterShape,
  type ConstructorParams,
  type JewelryConfig,
  type KeychainDecoration,
  type KeychainDecorationKind,
  type KeychainParams,
  type KeychainQrDecoration,
  type LithophaneBrightnessGrid,
  type LithophaneMount,
  type LithophanePart,
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
  | "signBaseMount"
  | "hasLid"
  | "lithoFrame"
  | "lithoMount"
  | "lithoShape"
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
  stand: DEFAULT_STAND_PARAMS,
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

/** Подпись детали литофана. */
function lithophanePartLabel(part: LithophanePart): string {
  return LITHOPHANE_PART_LABELS[part];
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
function buildExportOptions(params: ConstructorParams): StlExportOption[] {
  if (params.model === "sign") {
    const blocks = listSignBlocks(params.signText, params.signBlockSize);

    // Первый файл — лицо первого блока с буквами: это главная деталь вывески.
    // Дальше идут остальные детали блоков: у каждого блока своя крышка, а
    // начиная со второго — и своё лицо.
    const options = blocks.flatMap((block) =>
      SIGN_PARTS.map((part) => {
        const letters = block.letters.map((letter) => letter.char).join("");

        return {
          id: `sign-block-${block.index}-${part}`,
          label: `Блок ${block.index + 1}: ${
            part === "face" ? "Лицо" : "Крышка"
          }`,
          description: `Блок ${block.index + 1} «${letters}»: ${
            part === "face" ? "лицо" : "крышка"
          } отдельным файлом`,
          request: { blockIndex: block.index, signPart: part },
          fileName: signStlFileName(params, block.index, part),
        };
      }),
    );

    if (options.length > 0) {
      return options;
    }

    // Пустая надпись: кнопка остаётся, но сервер отклонит запрос и панель
    // покажет подсказку — так пользователь видит, что нужно ввести буквы.
    return [
      {
        id: "sign-empty",
        label: "Блок 1: Лицо",
        description: "В надписи нет букв",
        request: { blockIndex: 0, signPart: "face" },
        fileName: signStlFileName(params, 0, "face"),
      },
    ];
  }

  if (params.model === "lithophane") {
    // Без рамки печатается одна плита рельефа, поэтому дополнительных файлов нет.
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

    // Первый файл — собранный литофан: плита уже вставлена в рамку. Дальше детали
    // по отдельности: рельеф и рамка есть всегда.
    const parts: LithophanePart[] = ["relief", "frame"];

    return [
      {
        id: "lithophane-all",
        label: "Скачать STL",
        description: "Собранный литофан одним файлом",
        request: { part: "all" },
        fileName: lithophaneStlFileName(params, "all"),
      },
      ...parts.map((part) => ({
        id: `lithophane-${part}`,
        label: lithophanePartLabel(part),
        description: `${lithophanePartLabel(part)} литофана отдельным файлом`,
        request: { part },
        fileName: lithophaneStlFileName(params, part),
      })),
    ];
  }

  // Вывеска и литофан собрали набор файлов выше, поэтому здесь остаются модели
  // с одним STL: ваза, брелок, коробка, подставка, кашпо, подставка под кружку,
  // подставка для украшений, органайзер для ручек и термопринт.
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
            : params.model === "stand"
              ? standStlFileName(params)
              : params.model === "planter"
                ? planterStlFileName(params)
                : params.model === "coaster"
                  ? coasterStlFileName(params)
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
 * Мобильное окно со сценой: «Показать 3D» на весь экран.
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
  onClose,
  params,
}: {
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
        <Viewport fullscreen params={params} />
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

  /** Модель, по которой открыт опрос после скачивания; null — окно закрыто. */
  const [feedbackModel, setFeedbackModel] = useState<ModelType | null>(null);
  /**
   * Мобильное окно со сценой.
   *
   * На телефоне сцена стоит в потоке страницы, поэтому «покрутить» её удобнее в
   * отдельном окне на весь экран. Состояние живёт здесь: кнопка «Показать 3D»
   * плавающая и не знает о разметке сцены, а окну нужны текущие параметры.
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

  function updateSignBaseMount(signBaseMount: boolean) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, signBaseMount }),
    );
  }

  function updateHasLid(hasLid: boolean) {
    setParams((current) => normalizeConstructorParams({ ...current, hasLid }));
  }

  /**
   * Ячейки приходят из текстового поля «20, 40, 20».
   *
   * Вместе с массивом обновляется gridX/gridY: normalizeBoxParams иначе
   * сравнит новую длину со старым количеством ячеек, посчитает набор
   * несовместимым и заменит пропорции равными единицами.
   */
  function updateBoxCells(axis: "x" | "y", cells: number[]) {
    setParams((current) =>
      normalizeConstructorParams({
        ...current,
        ...(axis === "x"
          ? { cellsX: cells, gridX: cells.length }
          : { cellsY: cells, gridY: cells.length }),
      }),
    );
  }

  /** Пресет меняет и ячейки, и габариты: набор должен помещаться в коробку. */
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

  /** Крепление литофана: сейчас доступно только «без подставки». */
  function updateLithoMount(lithoMount: LithophaneMount) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, lithoMount }),
    );
  }

  /**
   * Форма панели: плоская или круглая.
   *
   * Кадры секторов при этом не сбрасываются: вернувшись к кругу, человек
   * получает те же четыре фотографии.
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
      normalizeConstructorParams({ ...current, planterDrainage }),
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

  function updateJewelryConfig(jewelryConfig: JewelryConfig) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, jewelryConfig }),
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

  /** Кнопки экспорта пересобираются только при смене параметров модели. */
  const exportOptions = useMemo(() => buildExportOptions(params), [params]);

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
            "Лимит бесплатных скачиваний исчерпан. Пакет «Всё включено» открывает безлимитный экспорт.",
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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col px-5 pt-10 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-14 lg:h-[calc(100dvh_-_var(--header-h))] lg:overflow-y-auto lg:pt-4 lg:pb-4 xl:max-w-[96rem]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between lg:items-center lg:gap-8">
        <div className="min-w-0">
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            href="/dashboard"
          >
            <span aria-hidden>←</span>В кабинет
          </Link>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:mt-3 lg:text-3xl">
            Конструктор 3D
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300 lg:mt-2 lg:max-w-3xl lg:text-sm">
            Параметрические модели под ваш принтер: ваза с математическим узором,
            брелок с именем, подставка под телефон, светодиодная вывеска с
            надписью, коробка-органайзер с сеткой и крышкой, литофан из
            фотографии, кашпо с поддоном, подставка под кружку, стойка для
            украшений, органайзер для ручек и термопринт логотипа.
            Настройте размеры, проверьте результат в 3D и скачайте STL.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <span
            className={
              hasPro
                ? "inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200"
                : "inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300"
            }
          >
            <span aria-hidden>{hasPro ? "✓" : "👁"}</span>
            {hasPro ? "Пакет «Всё включено»" : "Бесплатный предпросмотр"}
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
        Рабочая область — две независимые колонки, как в 3D-редакторе.
        Слева всё, что меняет модель: параметры, галерея рецептов и галерея
        форм. Колонка прокручивается сама, поэтому длинная панель и новые слои
        узора больше не утаскивают сцену из виду. Справа сцена: она занимает
        высоту рабочей области и остаётся на месте, что бы ни происходило
        слева.
        Строка сетки задана как minmax(0, 1fr): без нулевого минимума grid
        растянул бы строку по содержимому высокой панели, и внутренняя
        прокрутка колонки перестала бы работать.
        На мобильном порядок обратный (order): сцена стоит обычным блоком вверху,
        параметры и галереи едут под ней — страница прокручивается целиком, а
        сцену на весь экран открывает плавающая кнопка «Показать 3D».
      */}
      <div className="mt-8 flex flex-col gap-5 lg:mt-5 lg:grid lg:min-h-[26rem] lg:flex-1 lg:grid-cols-[minmax(19rem,25rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-5 xl:grid-cols-[minmax(21rem,28rem)_minmax(0,1fr)]">
        <div className="order-2 flex min-w-0 flex-col gap-5 lg:order-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:[scrollbar-color:#475569_transparent] lg:[scrollbar-width:thin]">
          <ParameterPanel
            exportError={exportError}
            freeDownloadsLeft={freeDownloadsLeft}
            hasPro={hasPro}
            exportingId={exportingId}
            exportOptions={exportOptions}
            onBoxCellsChange={updateBoxCells}
            onBoxPresetChange={updateBoxPreset}
            onCoasterPatternChange={updateCoasterPattern}
            onCoasterRimChange={updateCoasterRim}
            onCoasterShapeChange={updateCoasterShape}
            onExport={exportStl}
            onHasLidChange={updateHasLid}
            onHeatTransferMirrorChange={updateHeatTransferMirror}
            onHeatTransferSvgChange={updateHeatTransferSvg}
            onHolePlacementChange={updateHolePlacement}
            onJewelryConfigChange={updateJewelryConfig}
            onKeychainPresetChange={updateKeychainPreset}
            onKeychainDecorationChange={updateKeychainDecoration}
            onAddKeychainText={addKeychainTextDecoration}
            onAddKeychainImage={addKeychainImageDecoration}
            onRemoveKeychainDecoration={removeKeychainDecoration}
            keychainReport={keychainImageReport}
            onLithoFrameChange={updateLithoFrame}
            onLithoMountChange={updateLithoMount}
            onLithoShapeChange={updateLithoShape}
            onLithophaneBrightnessChange={updateLithophaneBrightness}
            onLithophaneSideBrightnessChange={updateLithophaneSideBrightness}
            onModelChange={updateModel}
            onNfcChange={updateKeychainNfc}
            onParamChange={updateParam}
            onPatternLayerChange={updatePatternLayer}
            onAddPatternLayer={addPatternLayer}
            onRemovePatternLayer={removePatternLayer}
            onPenShapeChange={updatePenShape}
            onPlanterDrainageChange={updatePlanterDrainage}
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
            onSignBaseMountChange={updateSignBaseMount}
            onSignFontChange={updateSignFont}
            onSignTextChange={updateSignText}
            params={params}
          />

          {/* Галереи стоят под панелью, в той же прокручиваемой колонке:
              сравнивать вазы удобно рядом со слайдерами, а сцена справа в это
              время не сдвигается. Сначала рецепты — готовая ваза целиком,
              потом формы — тот же узор в другом силуэте. */}
          <VaseRecipeGallery
            onApplyRecipe={applyVaseRecipe}
            params={params}
          />

          <VaseShapeGallery onSelectShape={updateShape} params={params} />

          <p className="text-xs leading-relaxed text-slate-300">
            Вращение — левая кнопка мыши или один палец, зум — колесо или два
            пальца. Модель стоит на виртуальном столе: заглянуть под пол камера
            не даст.
          </p>
        </div>

        <section
          aria-labelledby="preview-heading"
          className="order-1 flex min-w-0 flex-col lg:order-2 lg:min-h-0"
        >
          {/*
            На десктопе сцена — правая колонка сетки: она тянется на всю высоту
            рабочей области, поэтому прокрутка панели слева её не касается и
            галереи под неё не заезжают.
            На мобильном сцена — обычный блок в самом верху страницы, без sticky:
            липкая сцена занимала под шапкой всё окно, и панель настроек
            начиналась ниже, а прокрутка шла мимо неё. Теперь страница
            прокручивается целиком, а покрутить модель можно в окне «Показать
            3D» — плавающая кнопка внизу справа открывает сцену во весь экран.
          */}
          <div className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                className="text-xs font-semibold tracking-wide text-slate-300 uppercase"
                id="preview-heading"
              >
                Предпросмотр
              </h2>
              <span className="text-xs tabular-nums text-slate-300">
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
                ) : params.model === "stand" ? (
                  <>
                    наклон {params.standAngle}° · телефон{" "}
                    {params.phoneThickness} мм · ширина {params.standWidth} мм
                  </>
                ) : params.model === "lithophane" ? (
                  <>
                    {params.lithoShape === "round"
                      ? `Ø ${params.lithophaneWidth} мм`
                      : `${params.lithophaneWidth} × ${params.lithophaneHeight} мм`}{" "}
                    · рельеф {params.lithophaneMinThickness.toFixed(1)}–
                    {params.lithophaneMaxThickness.toFixed(1)} мм ·{" "}
                    {params.lithoFrame ? "рамка" : "без рамки"} ·{" "}
                    {LITHOPHANE_MOUNT_LABELS[params.lithoMount].toLowerCase()}
                  </>
                ) : params.model === "planter" ? (
                  <>
                    {PLANTER_SHAPE_LABELS[params.planterShape]} ·{" "}
                    {params.planterSize} × {params.planterHeight} мм ·{" "}
                    {params.planterDrainage ? "дренаж и поддон" : "без дренажа"}
                  </>
                ) : params.model === "coaster" ? (
                  <>
                    {COASTER_SHAPE_LABELS[params.coasterShape]} ·{" "}
                    {COASTER_PATTERN_LABELS[params.coasterPattern].toLowerCase()} ·{" "}
                    {params.coasterSize} × {params.coasterThickness} мм ·{" "}
                    {params.coasterRim ? "с бортиком" : "без бортика"}
                  </>
                ) : params.model === "jewelry_stand" ? (
                  <>
                    {JEWELRY_CONFIG_LABELS[params.jewelryConfig]} ·{" "}
                    {params.jewelryBase} × {params.jewelryHeight} мм
                  </>
                ) : params.model === "pen_holder" ? (
                  <>
                    {PEN_SHAPE_LABELS[params.penShape]} · {params.penSize} ×{" "}
                    {params.penHeight} мм · отделения: {params.penSections} · стенка{" "}
                    {params.penWall.toFixed(1)} мм
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
            </div>

            <div className="mt-3 flex min-h-0 flex-col lg:mt-2 lg:flex-1">
              <Viewport
                params={params}
                onKeychainImageReport={handleKeychainImageReport}
              />

            </div>
          </div>
        </section>
      </div>

      {/*
        Плавающая кнопка «Показать 3D»: только на мобильном, где сцена ушла в
        поток страницы. Стоит над панелью справа снизу, отступ учитывает
        safe-area — иначе на iPhone её срезала бы домашняя полоса. Когда окно
        открыто, кнопка не нужна: его закрывает своя кнопка и Escape.
      */}
      {sceneOpen ? null : (
        <button
          className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 inline-flex min-h-12 items-center gap-2 rounded-full border border-blue-400/60 bg-blue-500/90 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-950/50 backdrop-blur transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:hidden"
          onClick={() => setSceneOpen(true)}
          type="button"
        >
          <span aria-hidden>🧊</span>
          Показать 3D
        </button>
      )}

      {/* Окно со сценой живёт вне сетки: оно открывается поверх страницы. */}
      {sceneOpen ? (
        <MobileSceneDialog
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

