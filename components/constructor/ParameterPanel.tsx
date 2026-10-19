"use client";

import Link from "next/link";

import { NumberSlider } from "@/components/constructor/NumberSlider";
import {
  CONSTRUCTOR_LIMITS,
  VASE_SHAPES,
  VASE_SHAPE_LABELS,
  type VaseParams,
  type VaseShape,
} from "@/lib/constructor/params";

/** Числовые параметры: форму меняет отдельный обработчик. */
type SizeParam = Exclude<keyof VaseParams, "shape">;

/** Ошибка экспорта и действие, которое поможет её исправить. */
export type StlExportError = {
  message: string;
  action: "pro" | "login" | null;
};

type ParameterPanelProps = {
  params: VaseParams;
  /** Есть ли действующий доступ Pro: от него зависит только скачивание STL. */
  hasPro: boolean;
  /** Идёт запрос к серверу: кнопка заблокирована и показывает спиннер. */
  isExporting: boolean;
  /** Ошибка последней попытки скачивания; null — ошибок нет. */
  exportError: StlExportError | null;
  /** Запрос к серверному экспорту STL. */
  onExport: () => void;
  onParamChange: (key: SizeParam, value: number) => void;
  onShapeChange: (shape: VaseShape) => void;
  onReset: () => void;
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

/** Пояснение к выбранному силуэту: помогает выбрать форму без 3D-терминов. */
const SHAPE_HINTS: Record<VaseShape, string> = {
  classic:
    "Плавный силуэт: широкая нижняя часть, мягкое сужение и небольшой раструб кромки.",
  cone: "Почти прямой конус: широкое основание и узкая верхняя часть.",
  cylinder: "Ровные вертикальные стенки без сужения и раструба.",
};

/**
 * Панель параметров модели.
 *
 * Слайдеры меняют размеры, кнопки формы — пресет силуэта. Компонент не хранит
 * состояние: значения приходят из ConstructorClient, поэтому 3D-сцена и
 * подписи всегда читают один и тот же объект параметров.
 */
export function ParameterPanel({
  params,
  hasPro,
  isExporting,
  exportError,
  onExport,
  onParamChange,
  onShapeChange,
  onReset,
}: ParameterPanelProps) {
  return (
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

      <fieldset className="mt-6 border-t border-white/10 pt-5">
        <legend className="text-sm font-medium text-slate-200">Форма</legend>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {VASE_SHAPES.map((shape) => {
            const selected = params.shape === shape;

            return (
              <button
                aria-pressed={selected}
                className={
                  selected
                    ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/60 bg-blue-500/20 px-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    : "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40 px-2 text-sm font-medium text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                }
                key={shape}
                onClick={() => onShapeChange(shape)}
                type="button"
              >
                {VASE_SHAPE_LABELS[shape]}
              </button>
            );
          })}
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {SHAPE_HINTS[params.shape]}
        </p>
      </fieldset>

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
        onClick={onReset}
        type="button"
      >
        Сбросить параметры
      </button>

      <div className="mt-5 border-t border-white/10 pt-5">
        {hasPro ? (
          <>
            <button
              aria-busy={isExporting}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-wait disabled:bg-blue-600/60 disabled:text-white/80 disabled:shadow-none"
              disabled={isExporting}
              onClick={onExport}
              type="button"
            >
              {isExporting ? (
                <>
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  />
                  Генерация…
                </>
              ) : (
                "Скачать STL"
              )}
            </button>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {isExporting
                ? "Собираем геометрию и упаковываем её в бинарный STL…"
                : "Подписка Pro активна. Файл скачается с именем по вашим параметрам."}
            </p>
            {exportError ? (
              <div
                className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
                role="alert"
              >
                <p>{exportError.message}</p>
                {exportError.action === "pro" ? (
                  <Link
                    className="mt-2 inline-flex font-semibold text-amber-200 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                    href="/subscription#tools"
                  >
                    Оформить подписку Pro
                  </Link>
                ) : null}
                {exportError.action === "login" ? (
                  <Link
                    className="mt-2 inline-flex font-semibold text-amber-200 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                    href="/auth/login?next=%2Fconstructor"
                  >
                    Войти заново
                  </Link>
                ) : null}
              </div>
            ) : null}
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
  );
}
