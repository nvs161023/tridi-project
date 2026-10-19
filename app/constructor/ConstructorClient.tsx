"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import {
  ParameterPanel,
  type StlExportError,
} from "@/components/constructor/ParameterPanel";
import {
  DEFAULT_VASE_PARAMS,
  VASE_PATTERN_LABELS,
  VASE_SHAPE_LABELS,
  normalizeVaseParams,
  vaseStlFileName,
  type VaseParams,
  type VasePattern,
  type VaseShape,
} from "@/lib/constructor/params";

type ConstructorClientProps = {
  /** Есть ли действующий доступ Pro: от него зависит только скачивание STL. */
  hasPro: boolean;
};

/** Числовые параметры: форму и узор меняют отдельные обработчики. */
type SizeParam = Exclude<keyof VaseParams, "shape" | "pattern">;

/**
 * Имя файла из Content-Disposition.
 *
 * Blob-ссылка не сохраняет заголовки ответа, поэтому имя приходится разбирать
 * самим. Сервер отдаёт простой ASCII filename; filename* поддерживаем на
 * случай, если имя когда-нибудь станет не-ASCII.
 */
function stlFileNameFromDisposition(header: string | null, fallback: string): string {
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
  () => import("@/components/constructor/Viewport").then((module) => module.Viewport),
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
        <p className="mt-3 text-sm text-slate-400">Загружаем 3D-сцену…</p>
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
export function ConstructorClient({ hasPro }: ConstructorClientProps) {
  const [params, setParams] = useState<VaseParams>(DEFAULT_VASE_PARAMS);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<StlExportError | null>(null);

  function updateParam(key: SizeParam, value: number) {
    setParams((current) => normalizeVaseParams({ ...current, [key]: value }));
  }

  function updateShape(shape: VaseShape) {
    setParams((current) => normalizeVaseParams({ ...current, shape }));
  }

  function updatePattern(pattern: VasePattern) {
    setParams((current) => normalizeVaseParams({ ...current, pattern }));
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
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = stlFileNameFromDisposition(
          response.headers.get("content-disposition"),
          vaseStlFileName(params),
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
        setExportError({
          message: "Для скачивания нужна подписка Pro",
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
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            href="/dashboard"
          >
            <span aria-hidden>←</span>
            В кабинет
          </Link>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Конструктор 3D
          </h1>

          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-400">
            Параметрическая ваза под ваш принтер: выберите форму, задайте высоту,
            диаметр, толщину стенки и математический узор, проверьте результат в
            3D и скачайте STL.
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
          hasPro={hasPro}
          isExporting={isExporting}
          onExport={exportStl}
          onParamChange={updateParam}
          onPatternChange={updatePattern}
          onReset={() => setParams(DEFAULT_VASE_PARAMS)}
          onShapeChange={updateShape}
          params={params}
        />

        <section
          aria-labelledby="preview-heading"
          className="order-1 min-w-0 lg:order-2"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              className="text-xs font-semibold tracking-wide text-slate-400 uppercase"
              id="preview-heading"
            >
              Предпросмотр
            </h2>
            <span className="text-xs tabular-nums text-slate-500">
              {VASE_SHAPE_LABELS[params.shape]} ·{" "}
              {VASE_PATTERN_LABELS[params.pattern]} · {params.height} × Ø{" "}
              {params.diameter} мм
            </span>
          </div>

          <div className="mt-3">
            <Viewport
              diameter={params.diameter}
              height={params.height}
              pattern={params.pattern}
              patternFrequency={params.patternFrequency}
              patternIntensity={params.patternIntensity}
              shape={params.shape}
              wall={params.wall}
            />
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Вращение — левая кнопка мыши или один палец, зум — колесо или два
            пальца. Модель стоит на виртуальном столе: заглянуть под пол камера
            не даст.
          </p>
        </section>
      </div>
    </main>
  );
}
