"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import {
  ParameterPanel,
  type StlExportError,
} from "@/components/constructor/ParameterPanel";
import {
  CALIBRATION_TYPE_LABELS,
  CALIBRATION_UNITS,
  CALIBRATION_VALUE_LIMITS,
  DEFAULT_BOX_PARAMS,
  DEFAULT_CALIBRATION_PARAMS,
  DEFAULT_CALIBRATION_VALUES,
  DEFAULT_CONSTRUCTOR_PARAMS,
  DEFAULT_KEYCHAIN_PARAMS,
  DEFAULT_LAMP_PARAMS,
  DEFAULT_LITHOPHANE_PARAMS,
  DEFAULT_SIGN_PARAMS,
  DEFAULT_VASE_PARAMS,
  KEYCHAIN_SHAPE_LABELS,
  LAMP_MOUNT_LABELS,
  VASE_PATTERN_LABELS,
  VASE_SHAPE_LABELS,
  boxStlFileName,
  calibrationStlFileName,
  keychainStlFileName,
  lampStlFileName,
  lithophaneStlFileName,
  normalizeConstructorParams,
  signStlFileName,
  vaseStlFileName,
  type CalibrationType,
  type ConstructorParams,
  type KeychainShape,
  type LampMount,
  type ModelType,
  type SignChannelWidth,
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
  | "signChannelWidth"
  | "calibrationType"
  | "hasLid"
  | "lithophaneBrightness"
>;

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
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<StlExportError | null>(null);
  const [freeDownloadsLeft, setFreeDownloadsLeft] = useState(
    initialFreeDownloadsLeft,
  );

  function updateParam(key: SizeParam, value: number) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, [key]: value }),
    );
  }

  function updateModel(model: ModelType) {
    setParams((current) => normalizeConstructorParams({ ...current, model }));
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

  function updateSignText(signText: string) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, signText }),
    );
  }

  function updateSignChannelWidth(signChannelWidth: SignChannelWidth) {
    setParams((current) =>
      normalizeConstructorParams({ ...current, signChannelWidth }),
    );
  }

  /**
   * Смена теста сбрасывает диапазон к его собственным значениям.
   *
   * Общие поля `startValue` / `endValue` не могут одновременно хранить °C и
   * миллиметры: если перенести 230 в ретракт, получится 230 мм и параметры
   * зажмутся в 5. Поэтому у каждого теста свой стартовый диапазон.
   */
  function updateCalibrationType(calibrationType: CalibrationType) {
    setParams((current) =>
      normalizeConstructorParams({
        ...current,
        calibrationType,
        ...DEFAULT_CALIBRATION_VALUES[calibrationType],
      }),
    );
  }

  function updateHasLid(hasLid: boolean) {
    setParams((current) => normalizeConstructorParams({ ...current, hasLid }));
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
        ...(current.model === "vase"
          ? DEFAULT_VASE_PARAMS
          : current.model === "keychain"
            ? DEFAULT_KEYCHAIN_PARAMS
            : current.model === "lamp"
              ? DEFAULT_LAMP_PARAMS
              : current.model === "sign"
                ? DEFAULT_SIGN_PARAMS
                : current.model === "box"
                  ? DEFAULT_BOX_PARAMS
                  : current.model === "lithophane"
                    ? DEFAULT_LITHOPHANE_PARAMS
                    : DEFAULT_CALIBRATION_PARAMS),
      }),
    );
  }

  /**
   * Скачивание STL через сервер.
   *
   * Геометрия собирается на сервере, а браузер получает готовый бинарный файл:
   * подписку проверяет API, поэтому обойти гейт через DevTools нельзя. Blob
   * нужен, чтобы не уводить страницу на ответ API и сохранить имя из
   * Content-Disposition.
   */
  async function exportStl() {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const response = await fetch("/api/constructor/stl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(params),
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
          params.model === "vase"
            ? vaseStlFileName(params)
            : params.model === "keychain"
              ? keychainStlFileName(params)
              : params.model === "lamp"
                ? lampStlFileName(params)
                : params.model === "box"
                  ? boxStlFileName(params)
                  : params.model === "lithophane"
                    ? lithophaneStlFileName(params)
                    : params.model === "sign"
                      ? signStlFileName(params)
                      : calibrationStlFileName(params),
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
      setIsExporting(false);
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
            с надписью, калибровочная башня для температуры или ретракта,
            коробка-органайзер с сеткой и крышкой и литофан из фотографии.
            Настройте размеры, проверьте результат в 3D и скачайте STL.
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
          isExporting={isExporting}
          onExport={exportStl}
          onCalibrationTypeChange={updateCalibrationType}
          onHasLidChange={updateHasLid}
          onKeychainShapeChange={updateKeychainShape}
          onLampMountChange={updateLampMount}
          onLampPatternChange={updateLampPattern}
          onLithophaneBrightnessChange={updateLithophaneBrightness}
          onModelChange={updateModel}
          onParamChange={updateParam}
          onPatternChange={updatePattern}
          onReset={resetParams}
          onShapeChange={updateShape}
          onSignChannelWidthChange={updateSignChannelWidth}
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
                  {LAMP_MOUNT_LABELS[params.lampMount]} ·{" "}
                  {VASE_PATTERN_LABELS[params.lampPattern]} ·{" "}
                  {params.lampHeight} × Ø {params.lampDiameter} мм
                </>
              ) : params.model === "calibration" ? (
                <>
                  {CALIBRATION_TYPE_LABELS[params.calibrationType]} ·{" "}
                  {params.startValue.toFixed(
                    CALIBRATION_VALUE_LIMITS[params.calibrationType].decimals,
                  )}
                  –
                  {params.endValue.toFixed(
                    CALIBRATION_VALUE_LIMITS[params.calibrationType].decimals,
                  )}{" "}
                  {CALIBRATION_UNITS[params.calibrationType]} · {params.steps}{" "}
                  ступеней
                </>
              ) : params.model === "lithophane" ? (
                <>
                  {params.lithophaneWidth} × {params.lithophaneHeight} мм · рельеф{" "}
                  {params.lithophaneMinThickness.toFixed(1)}–
                  {params.lithophaneMaxThickness.toFixed(1)} мм
                </>
              ) : (
                <>
                  «{params.signText.trim() || "без надписи"}» · кегль{" "}
                  {params.signFontSize} мм · канал {params.signChannelWidth} мм
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
