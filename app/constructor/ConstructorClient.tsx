"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ParameterPanel,
  type StlExportError,
  type StlExportOption,
} from "@/components/constructor/ParameterPanel";
import {
  DEFAULT_BOX_PARAMS,
  DEFAULT_CONSTRUCTOR_PARAMS,
  DEFAULT_KEYCHAIN_PARAMS,
  DEFAULT_LAMP_PARAMS,
  DEFAULT_LITHOPHANE_PARAMS,
  DEFAULT_SIGN_PARAMS,
  DEFAULT_VASE_PARAMS,
  KEYCHAIN_SHAPE_LABELS,
  LAMP_BASE_SHAPE_LABELS,
  LAMP_MOUNT_LABELS,
  LAMP_PART_LABELS,
  LITHOPHANE_MOUNT_LABELS,
  LITHOPHANE_PART_LABELS,
  SIGN_PARTS,
  VASE_PATTERN_LABELS,
  VASE_SHAPE_LABELS,
  boxPresetParams,
  boxStlFileName,
  keychainStlFileName,
  lampStlFileName,
  listSignBlocks,
  listSignLetters,
  lithophaneStlFileName,
  normalizeConstructorParams,
  signStlFileName,
  vaseStlFileName,
  type BoxPresetId,
  type ConstructorParams,
  type KeychainShape,
  type LampBaseShape,
  type LampMount,
  type LithophaneMount,
  type LithophanePart,
  type ModelType,
  type SignChannelWidth,
  type SignFont,
  type VasePattern,
  type VaseShape,
} from "@/lib/constructor/params";

type ConstructorClientProps = {
  /** Есть ли действующий доступ Pro: у Pro лимита на STL нет. */
  hasPro: boolean;
  /** Сколько бесплатных скачиваний осталось в текущем месяце (0 для Pro). */
  freeDownloadsLeft: number;
};

/** Числовые параметры: форму, узор, патрон и текст меняют отдельные обработчики. */
type SizeParam = Exclude<
  keyof ConstructorParams,
  | "model"
  | "shape"
  | "pattern"
  | "shapeType"
  | "text"
  | "lampPattern"
  | "lampMount"
  | "signText"
  | "signFont"
  | "signChannelWidth"
  | "signBaseMount"
  | "hasLid"
  | "lithoFrame"
  | "lithoMount"
  | "lithophaneBrightness"
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
  lamp: DEFAULT_LAMP_PARAMS,
  sign: DEFAULT_SIGN_PARAMS,
  box: DEFAULT_BOX_PARAMS,
  lithophane: DEFAULT_LITHOPHANE_PARAMS,
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
 * У светильника и вывески файлов несколько: основание и абажур печатаются
 * разными деталями, блок вывески — лицом и крышкой. Первый элемент — главная
 * кнопка: сборка светильника или лицо первого блока вывески. Остальные кнопки
 * несут `request`, который уходит в API поверх параметров, поэтому геометрия и
 * имя файла на сервере собираются из тех же значений.
 *
 * Имена считаются здесь только как запасные: сервер присылает то же имя в
 * Content-Disposition, а браузеру оно нужно, если заголовок потеряется.
 */
function buildExportOptions(params: ConstructorParams): StlExportOption[] {
  if (params.model === "lamp") {
    // Две детали печатаются отдельно: основание с патроном и абажур, который
    // ставится на него сверху. Общей сборки в списке нет — иначе пользователь
    // снова получил бы один файл, который нельзя напечатать без разрыва.
    const parts = ["base", "shade"] as const;

    return parts.map((part) => ({
      id: `lamp-${part}`,
      label:
        part === "base"
          ? "Скачать базу (Base)"
          : "Скачать плафон (Shade)",
      description: `${LAMP_PART_LABELS[part]} светильника отдельным файлом`,
      request: { part },
      fileName: lampStlFileName(params, part),
    }));
  }

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

    // Первый файл — собранный литофан: плита уже вставлена в рамку и, если
    // выбрана подставка, наклонена вместе с ней. Дальше детали по отдельности:
    // рельеф и рамка есть всегда, подставка — только при своём креплении,
    // петли подвеса — часть рамки.
    const parts: LithophanePart[] = ["relief", "frame"];

    if (params.lithoMount === "stand") {
      parts.push("stand");
    }

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
        label: LITHOPHANE_PART_LABELS[part],
        description: `${LITHOPHANE_PART_LABELS[part]} литофана отдельным файлом`,
        request: { part },
        fileName: lithophaneStlFileName(params, part),
      })),
    ];
  }

  // Светильник, вывеска и литофан собрали набор файлов выше, поэтому здесь
  // остаются модели с одним STL: ваза, брелок и коробка.
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
    <div className="flex h-[24rem] w-full items-center justify-center rounded-3xl border border-white/10 bg-slate-900/60 sm:h-[32rem] lg:h-[38rem]">
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
}: ConstructorClientProps) {
  const [params, setParams] = useState<ConstructorParams>(
    DEFAULT_CONSTRUCTOR_PARAMS,
  );
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<StlExportError | null>(null);
  const [freeDownloadsLeft, setFreeDownloadsLeft] = useState(
    initialFreeDownloadsLeft,
  );

  function updateParam(key: SizeParam, value: number) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, [key]: value }),
    );
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

  function updatePattern(pattern: VasePattern) {
    setParams((current) => normalizeConstructorParams({ ...current, pattern }));
  }

  function updateKeychainShape(shapeType: KeychainShape) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, shapeType }),
    );
  }

  function updateKeychainText(text: string) {
    setParams((current) => normalizeConstructorParams({ ...current, text }));
  }

  /** Свой контур приходит уже проверенным SVG: текст файла или обводка PNG. */
  function updateKeychainCustomSvg(customSvgData: string) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, customSvgData }),
    );
  }

  function updateKeychainNfc(nfcEnabled: boolean) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, nfcEnabled }),
    );
  }

  function updateLampPattern(lampPattern: VasePattern) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, lampPattern }),
    );
  }

  function updateLampMount(lampMount: LampMount) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, lampMount }),
    );
  }

  function updateLampBaseShape(lampBaseShape: LampBaseShape) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, lampBaseShape }),
    );
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

  function updateLithoMount(lithoMount: LithophaneMount) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, lithoMount }),
    );
  }

  /**
   * Браузер уже сжал фотографию до 150 × 150 и отдал яркость. Массив идёт в
   * общее состояние как есть: API принимает те же 22 500 целых чисел, поэтому
   * сервер не декодирует картинку повторно.
   */
  function updateLithophaneBrightness(lithophaneBrightness: number[]) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, lithophaneBrightness }),
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
        // Параметры модели плюс выбор файла: `part` для светильника и
        // литофана, `blockIndex` и `signPart` для деталей вывески. Сервер
        // валидирует их вместе с остальными полями.
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
            "Лимит бесплатных скачиваний исчерпан. Оформите подписку Pro для безлимитного доступа.",
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
    <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            href="/dashboard"
          >
            <span aria-hidden>←</span>В кабинет
          </Link>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Конструктор 3D
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300">
            Параметрические модели под ваш принтер: ваза с математическим узором,
            брелок с именем, абажур на патрон E27 или E14, светодиодная вывеска
            с надписью, коробка-органайзер с сеткой и крышкой и литофан из
            фотографии. Настройте размеры, проверьте результат в 3D и скачайте
            STL.
          </p>
        </div>

        <span
          className={
            hasPro
              ? "inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 sm:self-auto"
              : "inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 sm:self-auto"
          }
        >
          <span aria-hidden>{hasPro ? "✓" : "👁"}</span>
          {hasPro ? "Подписка Pro" : "Бесплатный предпросмотр"}
        </span>
      </div>

      {/*
        На мобильных первой идёт сцена (order-1), панель — второй: человек
        сразу видит результат. На десктопе панель слева, сцена справа.
        min-w-0 у обеих колонок не даёт Canvas и длинным подписям растянуть
        страницу по горизонтали.
      */}
      <div className="mt-8 grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start xl:gap-6">
        <ParameterPanel
          exportError={exportError}
          freeDownloadsLeft={freeDownloadsLeft}
          hasPro={hasPro}
          exportingId={exportingId}
          exportOptions={exportOptions}
          onBoxCellsChange={updateBoxCells}
          onBoxPresetChange={updateBoxPreset}
          onCustomSvgChange={updateKeychainCustomSvg}
          onExport={exportStl}
          onHasLidChange={updateHasLid}
          onLithoFrameChange={updateLithoFrame}
          onLithoMountChange={updateLithoMount}
          onKeychainShapeChange={updateKeychainShape}
          onLampBaseShapeChange={updateLampBaseShape}
          onLampMountChange={updateLampMount}
          onLampPatternChange={updateLampPattern}
          onLithophaneBrightnessChange={updateLithophaneBrightness}
          onModelChange={updateModel}
          onNfcChange={updateKeychainNfc}
          onParamChange={updateParam}
          onPatternChange={updatePattern}
          onReset={resetParams}
          onShapeChange={updateShape}
          onSignChannelWidthChange={updateSignChannelWidth}
          onSignBaseMountChange={updateSignBaseMount}
          onSignFontChange={updateSignFont}
          onSignTextChange={updateSignText}
          onTextChange={updateKeychainText}
          params={params}
        />

        <section
          aria-labelledby="preview-heading"
          className="order-1 min-w-0 lg:order-2"
        >
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
                  {VASE_PATTERN_LABELS[params.pattern]} · {params.height} × Ø{" "}
                  {params.diameter} мм
                </>
              ) : params.model === "keychain" ? (
                <>
                  {KEYCHAIN_SHAPE_LABELS[params.shapeType]} · {params.length} ×{" "}
                  {params.width} × {params.thickness} мм
                  {params.text.trim() ? ` · «${params.text.trim()}»` : ""}
                </>
              ) : params.model === "lamp" ? (
                <>
                  {LAMP_BASE_SHAPE_LABELS[params.lampBaseShape]} ·{" "}
                  {LAMP_MOUNT_LABELS[params.lampMount]} ·{" "}
                  {VASE_PATTERN_LABELS[params.lampPattern]} ·{" "}
                  {params.lampBaseHeight + params.lampHeight} × Ø{" "}
                  {params.lampDiameter} мм
                </>
              ) : params.model === "lithophane" ? (
                <>
                  {params.lithophaneWidth} × {params.lithophaneHeight} мм · рельеф{" "}
                  {params.lithophaneMinThickness.toFixed(1)}–
                  {params.lithophaneMaxThickness.toFixed(1)} мм ·{" "}
                  {params.lithoFrame
                    ? `рамка · ${LITHOPHANE_MOUNT_LABELS[params.lithoMount].toLowerCase()}`
                    : "без рамки"}
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

          <div className="mt-3">
            <Viewport params={params} />
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-300">
            Вращение — левая кнопка мыши или один палец, зум — колесо или два
            пальца. Модель стоит на виртуальном столе: заглянуть под пол камера
            не даст.
          </p>
        </section>
      </div>
    </main>
  );
}
