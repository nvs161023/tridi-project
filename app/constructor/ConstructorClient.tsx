"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { NumberSlider } from "@/components/constructor/NumberSlider";
import {
  CONSTRUCTOR_LIMITS,
  DEFAULT_VASE_PARAMS,
  normalizeVaseParams,
  type VaseParams,
} from "@/lib/constructor/params";

type ConstructorClientProps = {
  /** Есть ли действующий доступ Pro: от него зависит только скачивание STL. */
  hasPro: boolean;
};

/** Шаблоны моделей. В MVP работает ваза, остальные показываем как план. */
type ModelType = {
  id: "vase" | "keychain" | "lamp";
  icon: string;
  title: string;
  available: boolean;
};

const MODEL_TYPES: ModelType[] = [
  { id: "vase", icon: "🏺", title: "Ваза", available: true },
  { id: "keychain", icon: "🔑", title: "Брелок", available: false },
  { id: "lamp", icon: "💡", title: "Светильник", available: false },
];

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

export function ConstructorClient({ hasPro }: ConstructorClientProps) {
  const [params, setParams] = useState<VaseParams>(DEFAULT_VASE_PARAMS);

  function updateParam(key: keyof VaseParams, value: number) {
    setParams((current) => normalizeVaseParams({ ...current, [key]: value }));
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
            Параметрическая ваза под ваш принтер: задайте высоту, диаметр и
            толщину стенки, проверьте форму в 3D и скачайте STL.
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
        <section
          aria-labelledby="parameters-heading"
          className="order-2 min-w-0 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 lg:order-1 lg:sticky lg:top-6"
        >
          <h2
            className="text-xs font-semibold tracking-wide text-slate-400 uppercase"
            id="parameters-heading"
          >
            Параметры модели
          </h2>

          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-slate-200">
              Тип модели
            </legend>

            <div className="mt-3 space-y-2">
              {MODEL_TYPES.map((type) => (
                <button
                  aria-pressed={type.available}
                  className={
                    type.available
                      ? "flex w-full items-center gap-3 rounded-2xl border border-blue-400/50 bg-blue-500/10 px-4 py-3 text-white"
                      : "flex w-full cursor-not-allowed items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-slate-500"
                  }
                  disabled={!type.available}
                  key={type.id}
                  type="button"
                >
                  <span aria-hidden className="text-xl">
                    {type.icon}
                  </span>
                  <span className="flex-1 text-left text-sm font-semibold">
                    {type.title}
                  </span>
                  <span
                    className={
                      type.available
                        ? "rounded-full border border-blue-400/40 bg-blue-500/15 px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-blue-200 uppercase"
                        : "rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-slate-400 uppercase"
                    }
                  >
                    {type.available ? "Доступно" : "Скоро"}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Высота готовой вазы. Для модели выше 250 мм добавьте brim в слайсере."
              label="Высота"
              max={CONSTRUCTOR_LIMITS.height.max}
              min={CONSTRUCTOR_LIMITS.height.min}
              onChange={(value) => updateParam("height", value)}
              step={CONSTRUCTOR_LIMITS.height.step}
              unit="мм"
              value={params.height}
            />

            <NumberSlider
              hint="Внешний диаметр в самой широкой части. Проверьте, что модель влезает на стол принтера."
              label="Диаметр"
              max={CONSTRUCTOR_LIMITS.diameter.max}
              min={CONSTRUCTOR_LIMITS.diameter.min}
              onChange={(value) => updateParam("diameter", value)}
              step={CONSTRUCTOR_LIMITS.diameter.step}
              unit="мм"
              value={params.diameter}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.wall.decimals}
              hint="0.8–1.2 мм — декоративная ваза, 1.6–2.4 мм — прочная под живые цветы."
              label="Толщина стенки"
              max={CONSTRUCTOR_LIMITS.wall.max}
              min={CONSTRUCTOR_LIMITS.wall.min}
              onChange={(value) => updateParam("wall", value)}
              step={CONSTRUCTOR_LIMITS.wall.step}
              unit="мм"
              value={params.wall}
            />
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-center">
            <div>
              <dt className="text-[0.65rem] font-medium tracking-wide text-slate-500 uppercase">
                Высота
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-white">
                {params.height} мм
              </dd>
            </div>
            <div className="border-x border-white/10">
              <dt className="text-[0.65rem] font-medium tracking-wide text-slate-500 uppercase">
                Диаметр
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-white">
                Ø {params.diameter} мм
              </dd>
            </div>
            <div>
              <dt className="text-[0.65rem] font-medium tracking-wide text-slate-500 uppercase">
                Стенка
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-white">
                {params.wall.toFixed(1)} мм
              </dd>
            </div>
          </dl>

          <button
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/15 px-4 text-sm font-semibold text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            onClick={() => setParams(DEFAULT_VASE_PARAMS)}
            type="button"
          >
            Сбросить параметры
          </button>

          <div className="mt-5 border-t border-white/10 pt-5">
            {hasPro ? (
              <>
                <button
                  className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-blue-600/40 px-5 text-base font-semibold text-white/70"
                  disabled
                  type="button"
                >
                  Скачать STL
                  <span className="rounded-full border border-white/20 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase">
                    Скоро
                  </span>
                </button>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Подписка Pro активна. Генератор ваз и экспорт STL подключим
                  следующим шагом.
                </p>
              </>
            ) : (
              <>
                <Link
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  href="/subscription#tools"
                >
                  <span aria-hidden>🔒</span>
                  Скачать STL — Pro
                </Link>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Предпросмотр бесплатный. Скачивание STL входит в подписку Pro.
                </p>
              </>
            )}
          </div>
        </section>

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
              {params.height} мм · Ø {params.diameter} мм
            </span>
          </div>

          <div className="mt-3">
            <Viewport diameter={params.diameter} height={params.height} />
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
