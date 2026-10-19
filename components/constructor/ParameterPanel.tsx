"use client";

import Link from "next/link";
import { useId } from "react";

import { NumberSlider } from "@/components/constructor/NumberSlider";
import { FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH } from "@/lib/constructor/downloads";
import {
  CONSTRUCTOR_LIMITS,
  KEYCHAIN_SHAPES,
  KEYCHAIN_SHAPE_LABELS,
  KEYCHAIN_TEXT_MAX_LENGTH,
  MODEL_TYPE_LABELS,
  VASE_PATTERNS,
  VASE_PATTERN_LABELS,
  VASE_SHAPES,
  VASE_SHAPE_LABELS,
  sanitizeKeychainText,
  type ConstructorParams,
  type KeychainShape,
  type ModelType,
  type VasePattern,
  type VaseShape,
} from "@/lib/constructor/params";

/** Числовые параметры: форму, узор и текст меняют отдельные обработчики. */
type SizeParam = Exclude<
  keyof ConstructorParams,
  "model" | "shape" | "pattern" | "shapeType" | "text"
>;

/** Ошибка экспорта и действие, которое поможет её исправить. */
export type StlExportError = {
  message: string;
  action: "pro" | "login" | null;
};

type ParameterPanelProps = {
  params: ConstructorParams;
  /** Есть ли действующий доступ Pro: у Pro лимита на STL нет. */
  hasPro: boolean;
  /** Остаток бесплатных скачиваний; у Pro не используется. */
  freeDownloadsLeft: number;
  /** Идёт запрос к серверу: кнопка заблокирована и показывает спиннер. */
  isExporting: boolean;
  /** Ошибка последней попытки скачивания; null — ошибок нет. */
  exportError: StlExportError | null;
  /** Запрос к серверному экспорту STL. */
  onExport: () => void;
  onParamChange: (key: SizeParam, value: number) => void;
  onModelChange: (model: ModelType) => void;
  onShapeChange: (shape: VaseShape) => void;
  onPatternChange: (pattern: VasePattern) => void;
  onKeychainShapeChange: (shape: KeychainShape) => void;
  onTextChange: (text: string) => void;
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

/** Доступная карточка модели или будущий светильник со статусом «Скоро». */
type ModelCard =
  | { id: ModelType; icon: string; title: string; available: true }
  | { id: "lamp"; icon: string; title: string; available: false };

const MODEL_TYPES: ModelCard[] = [
  { id: "vase", icon: "🏺", title: MODEL_TYPE_LABELS.vase, available: true },
  {
    id: "keychain",
    icon: "🔑",
    title: MODEL_TYPE_LABELS.keychain,
    available: true,
  },
  { id: "lamp", icon: "💡", title: "Светильник", available: false },
];

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
};

/** Пояснение к узору: что произойдёт со стенкой. */
const PATTERN_HINTS: Record<VasePattern, string> = {
  smooth: "Ровная стенка без рельефа — самый простой вариант для печати.",
  spiral:
    "Косая спираль: узор поднимается по стенке и дополнительно закручивается по высоте.",
  ribs: "Вертикальные рёбра: частота задаёт число гребней по окружности.",
  waves:
    "Горизонтальные волны: частота задаёт частоту кольцевых гребней по высоте.",
};

/**
 * Панель параметров модели.
 *
 * Слайдеры меняют размеры, кнопки формы — пресет силуэта вазы, кнопки узора —
 * математический рельеф стенки, а для брелока появляются длина, ширина,
 * толщина, форма заготовки и имя. Компонент не хранит состояние: значения
 * приходят из ConstructorClient, поэтому 3D-сцена и подписи всегда читают
 * один и тот же объект параметров.
 */
export function ParameterPanel({
  params,
  hasPro,
  freeDownloadsLeft,
  isExporting,
  exportError,
  onExport,
  onParamChange,
  onModelChange,
  onShapeChange,
  onPatternChange,
  onKeychainShapeChange,
  onTextChange,
  onReset,
}: ParameterPanelProps) {
  const textInputId = useId();
  const textHintId = `${textInputId}-hint`;
  const textLength = Array.from(params.text).length;
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
          {MODEL_TYPES.map((type) => {
            const selected = type.available && params.model === type.id;

            return (
              <button
                aria-pressed={selected}
                className={
                  selected
                    ? "flex w-full items-center gap-3 rounded-2xl border border-blue-400/50 bg-blue-500/10 px-4 py-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    : type.available
                      ? "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                      : "flex w-full cursor-not-allowed items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-slate-500"
                }
                disabled={!type.available}
                key={type.id}
                onClick={() => {
                  if (type.id !== "lamp") {
                    onModelChange(type.id);
                  }
                }}
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
                    selected
                      ? "rounded-full border border-blue-400/40 bg-blue-500/15 px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-blue-200 uppercase"
                      : type.available
                        ? "rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-slate-300 uppercase"
                        : "rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-slate-400 uppercase"
                  }
                >
                  {selected ? "Выбрано" : type.available ? "Доступно" : "Скоро"}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {params.model === "vase" ? (
        <>
          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Форма
            </legend>

            <div className="mt-3 grid grid-cols-2 gap-2">
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

          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">Узор</legend>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {VASE_PATTERNS.map((pattern) => {
                const selected = params.pattern === pattern;

                return (
                  <button
                    aria-pressed={selected}
                    className={
                      selected
                        ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-400/60 bg-emerald-500/20 px-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        : "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40 px-2 text-sm font-medium text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    }
                    key={pattern}
                    onClick={() => onPatternChange(pattern)}
                    type="button"
                  >
                    {VASE_PATTERN_LABELS[pattern]}
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {PATTERN_HINTS[params.pattern]}
            </p>

            <div className="mt-4 space-y-5">
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
        </>
      ) : (
        <>
          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Форма брелока
            </legend>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {KEYCHAIN_SHAPES.map((shapeType) => {
                const selected = params.shapeType === shapeType;

                return (
                  <button
                    aria-pressed={selected}
                    className={
                      selected
                        ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-400/60 bg-amber-500/20 px-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        : "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40 px-2 text-sm font-medium text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    }
                    key={shapeType}
                    onClick={() => onKeychainShapeChange(shapeType)}
                    type="button"
                  >
                    {KEYCHAIN_SHAPE_LABELS[shapeType]}
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Отверстие под кольцо диаметром 4 мм есть у обеих форм. Выберите
              скруглённый прямоугольник для спокойного вида или шестиугольник
              для более техничного.
            </p>
          </fieldset>

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
              className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base font-medium text-white placeholder:text-slate-600 focus-visible:border-amber-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
                className="text-xs leading-relaxed text-slate-500"
                id={textHintId}
              >
                Кириллица, латиница, цифры и знаки. Имя выступает над основой на
                0.8 мм и масштабируется под свободное место.
              </p>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">
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
      )}

      <dl className="mt-6 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-center">
        {params.model === "vase" ? (
          <>
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
          </>
        ) : (
          <>
            <div>
              <dt className="text-[0.65rem] font-medium tracking-wide text-slate-500 uppercase">
                Длина
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-white">
                {params.length} мм
              </dd>
            </div>
            <div className="border-x border-white/10">
              <dt className="text-[0.65rem] font-medium tracking-wide text-slate-500 uppercase">
                Ширина
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-white">
                {params.width} мм
              </dd>
            </div>
            <div>
              <dt className="text-[0.65rem] font-medium tracking-wide text-slate-500 uppercase">
                Толщина
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-white">
                {params.thickness.toFixed(1)} мм
              </dd>
            </div>
          </>
        )}
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

            <button
              aria-busy={isExporting}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-wait disabled:bg-blue-600/60 disabled:text-white/80 disabled:shadow-none"
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
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Оформите подписку Pro для безлимитного доступа.
            </p>
            <ExportErrorAlert error={exportError} />
          </>
        )}
      </div>
    </section>
  );
}
