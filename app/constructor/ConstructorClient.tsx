"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { ParameterPanel } from "@/components/constructor/ParameterPanel";
import {
  DEFAULT_VASE_PARAMS,
  VASE_SHAPE_LABELS,
  normalizeVaseParams,
  type VaseParams,
  type VaseShape,
} from "@/lib/constructor/params";

type ConstructorClientProps = {
  /** Есть ли действующий доступ Pro: от него зависит только скачивание STL. */
  hasPro: boolean;
};

/** Числовые параметры: форму меняет отдельный обработчик. */
type SizeParam = Exclude<keyof VaseParams, "shape">;

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

  function updateParam(key: SizeParam, value: number) {
    setParams((current) => normalizeVaseParams({ ...current, [key]: value }));
  }

  function updateShape(shape: VaseShape) {
    setParams((current) => normalizeVaseParams({ ...current, shape }));
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
            диаметр и толщину стенки, проверьте результат в 3D и скачайте STL.
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
          hasPro={hasPro}
          onParamChange={updateParam}
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
              {VASE_SHAPE_LABELS[params.shape]} · {params.height} × Ø{" "}
              {params.diameter} мм
            </span>
          </div>

          <div className="mt-3">
            <Viewport
              diameter={params.diameter}
              height={params.height}
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
