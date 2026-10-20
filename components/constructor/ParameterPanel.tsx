"use client";

import Link from "next/link";
import { useId } from "react";

import { NumberSlider } from "@/components/constructor/NumberSlider";
import { FREE_CONSTRUCTOR_DOWNLOADS_PER_MONTH } from "@/lib/constructor/downloads";
import {
  CALIBRATION_TYPES,
  CALIBRATION_TYPE_LABELS,
  CALIBRATION_UNITS,
  CALIBRATION_VALUE_LIMITS,
  CONSTRUCTOR_LIMITS,
  KEYCHAIN_SHAPES,
  KEYCHAIN_SHAPE_LABELS,
  KEYCHAIN_TEXT_MAX_LENGTH,
  LAMP_MOUNTS,
  LAMP_MOUNT_LABELS,
  MODEL_TYPE_LABELS,
  SIGN_CHANNEL_WIDTHS,
  SIGN_TEXT_MAX_LENGTH,
  VASE_PATTERNS,
  VASE_PATTERN_LABELS,
  VASE_SHAPES,
  VASE_SHAPE_LABELS,
  sanitizeKeychainText,
  sanitizeSignText,
  type CalibrationType,
  type ConstructorParams,
  type KeychainShape,
  type LampMount,
  type ModelType,
  type SignChannelWidth,
  type VasePattern,
  type VaseShape,
} from "@/lib/constructor/params";

/** Числовые параметры: форму, узор и текст меняют отдельные обработчики. */
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
  onLampPatternChange: (pattern: VasePattern) => void;
  onLampMountChange: (mount: LampMount) => void;
  onSignTextChange: (text: string) => void;
  onSignChannelWidthChange: (width: SignChannelWidth) => void;
  onCalibrationTypeChange: (type: CalibrationType) => void;
  onHasLidChange: (hasLid: boolean) => void;
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

/** Карточка типа модели во вкладках панели. */
type ModelCard = { id: ModelType; icon: string; title: string };

const MODEL_CARDS: ModelCard[] = [
  { id: "vase", icon: "🏺", title: MODEL_TYPE_LABELS.vase },
  { id: "keychain", icon: "🔑", title: MODEL_TYPE_LABELS.keychain },
  { id: "lamp", icon: "💡", title: MODEL_TYPE_LABELS.lamp },
  { id: "sign", icon: "🪧", title: MODEL_TYPE_LABELS.sign },
  { id: "calibration", icon: "🌡️", title: MODEL_TYPE_LABELS.calibration },
  { id: "box", icon: "📦", title: MODEL_TYPE_LABELS.box },
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

/** Что меняется по высоте башни: подсказка помогает выбрать тест. */
const CALIBRATION_TYPE_HINTS: Record<CalibrationType, string> = {
  temperature:
    "Температура сопла на каждой ступени. Напечатайте башню и сравните пояса: самый прочный и чистый покажет подходящую температуру.",
  retraction:
    "Длина ретракта на каждой ступени. Ищите пояс без паутинки и без пропусков подачи — это и есть рабочее значение.",
};

/**
 * Панель параметров модели.
 *
 * Слайдеры меняют размеры, кнопки формы — пресет силуэта вазы, кнопки узора —
 * математический рельеф стенки, а для брелока появляются длина, ширина,
 * толщина, форма заготовки и имя. У светильника выбирают патрон и узор, у
 * вывески — надпись, кегль, выступ букв и ширину канала под ленту, у
 * калибровки — тест, диапазон значений и число ступеней, у коробки — сетку
 * ячеек, размеры, стенку и крышку. Компонент
 * не хранит состояние: значения приходят из ConstructorClient, поэтому
 * 3D-сцена и подписи всегда читают один и тот же объект параметров.
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
  onLampPatternChange,
  onLampMountChange,
  onSignTextChange,
  onSignChannelWidthChange,
  onCalibrationTypeChange,
  onHasLidChange,
  onReset,
}: ParameterPanelProps) {
  const textInputId = useId();
  const textHintId = `${textInputId}-hint`;
  const textLength = Array.from(params.text).length;
  const signTextInputId = useId();
  const signTextHintId = `${signTextInputId}-hint`;
  const signTextLength = Array.from(params.signText).length;

  /** Границы и единица текущего калибровочного теста: у температуры и ретракта они разные. */
  const calibrationLimit = CALIBRATION_VALUE_LIMITS[params.calibrationType];
  const calibrationUnit = CALIBRATION_UNITS[params.calibrationType];

  /** Три главных размера выбранной модели для нижней сводки. */
  const summary: { label: string; value: string }[] =
    params.model === "vase"
      ? [
          { label: "Высота", value: `${params.height} мм` },
          { label: "Диаметр", value: `Ø ${params.diameter} мм` },
          { label: "Стенка", value: `${params.wall.toFixed(1)} мм` },
        ]
      : params.model === "keychain"
        ? [
            { label: "Длина", value: `${params.length} мм` },
            { label: "Ширина", value: `${params.width} мм` },
            { label: "Толщина", value: `${params.thickness.toFixed(1)} мм` },
          ]
        : params.model === "calibration"
          ? [
              {
                label: "Тест",
                value: CALIBRATION_TYPE_LABELS[params.calibrationType],
              },
              {
                label: "Диапазон",
                value: `${params.startValue.toFixed(
                  CALIBRATION_VALUE_LIMITS[params.calibrationType].decimals,
                )}–${params.endValue.toFixed(
                  CALIBRATION_VALUE_LIMITS[params.calibrationType].decimals,
                )} ${CALIBRATION_UNITS[params.calibrationType]}`,
              },
              { label: "Ступени", value: `${params.steps}` },
            ]
          : params.model === "lamp"
          ? [
              { label: "Высота", value: `${params.lampHeight} мм` },
              { label: "Диаметр", value: `Ø ${params.lampDiameter} мм` },
              { label: "Патрон", value: params.lampMount.toUpperCase() },
            ]
          : params.model === "box"
            ? [
                { label: "Длина", value: `${params.boxLength} мм` },
                { label: "Ширина", value: `${params.boxWidth} мм` },
                {
                  label: "Ячейки",
                  value: `${params.gridX} × ${params.gridY}`,
                },
              ]
            : [
                { label: "Кегль", value: `${params.signFontSize} мм` },
                { label: "Выступ", value: `${params.signDepth} мм` },
                { label: "Канал", value: `${params.signChannelWidth} мм` },
              ];

  return (
    <section
      aria-labelledby="parameters-heading"
      className="order-2 min-w-0 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 lg:order-1 lg:sticky lg:top-6"
    >
      <h2
        className="text-xs font-semibold tracking-wide text-slate-300 uppercase"
        id="parameters-heading"
      >
        Параметры модели
      </h2>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-slate-200">
          Тип модели
        </legend>

        <div className="mt-3 space-y-2">
          {MODEL_CARDS.map((type) => {
            const selected = params.model === type.id;

            return (
              <button
                aria-pressed={selected}
                className={
                  selected
                    ? "flex w-full items-center gap-3 rounded-2xl border border-blue-400/50 bg-blue-500/10 px-4 py-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    : "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                }
                key={type.id}
                onClick={() => onModelChange(type.id)}
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
                      : "rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-wide text-slate-300 uppercase"
                  }
                >
                  {selected ? "Выбрано" : "Открыть"}
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

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
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

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
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
      ) : params.model === "keychain" ? (
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

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
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
              className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base font-medium text-white placeholder:text-slate-300 focus-visible:border-amber-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
                className="text-xs leading-relaxed text-slate-300"
                id={textHintId}
              >
                Кириллица, латиница, цифры и знаки. Имя выступает над основой на
                0.8 мм и масштабируется под свободное место.
              </p>
              <span className="shrink-0 text-xs tabular-nums text-slate-300">
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
      ) : params.model === "calibration" ? (
        <>
          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Тест
            </legend>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {CALIBRATION_TYPES.map((type) => {
                const selected = params.calibrationType === type;

                return (
                  <button
                    aria-pressed={selected}
                    className={
                      selected
                        ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-400/60 bg-blue-500/20 px-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        : "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40 px-2 text-sm font-medium text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    }
                    key={type}
                    onClick={() => onCalibrationTypeChange(type)}
                    type="button"
                  >
                    {CALIBRATION_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {CALIBRATION_TYPE_HINTS[params.calibrationType]}
            </p>
          </fieldset>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              decimals={calibrationLimit.decimals}
              hint="Значение на нижней ступени. Направление башни любое: можно подниматься от холодного к горячему или наоборот."
              label="Внизу"
              max={calibrationLimit.max}
              min={calibrationLimit.min}
              onChange={(value) => onParamChange("startValue", value)}
              step={calibrationLimit.step}
              unit={calibrationUnit}
              value={params.startValue}
            />

            <NumberSlider
              decimals={calibrationLimit.decimals}
              hint="Значение на верхней ступени. Разница делится на равные шаги, а каждое значение печатается выпукло на своей грани."
              label="Вверху"
              max={calibrationLimit.max}
              min={calibrationLimit.min}
              onChange={(value) => onParamChange("endValue", value)}
              step={calibrationLimit.step}
              unit={calibrationUnit}
              value={params.endValue}
            />

            <NumberSlider
              hint="Сколько секций в башне. 5 ступеней — быстрый тест, 10 — подробная карта значений без высокого расхода пластика."
              label="Ступеней"
              max={CONSTRUCTOR_LIMITS.calibrationSteps.max}
              min={CONSTRUCTOR_LIMITS.calibrationSteps.min}
              onChange={(value) => onParamChange("steps", value)}
              step={CONSTRUCTOR_LIMITS.calibrationSteps.step}
              unit="шт."
              value={params.steps}
            />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-300">
            Ступени сужаются кверху и стоят друг на друге: нависаний нет,
            поддержки не нужны. Цифры выпуклые: выступают над передней гранью
            на 0.5 мм — их видно и после печати.
          </p>
        </>
      ) : params.model === "lamp" ? (
        <>
          <div
            className="mt-6 rounded-2xl border-2 border-red-400/50 bg-gradient-to-br from-red-500/15 to-amber-400/10 px-4 py-3"
            role="alert"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-red-100">
              <span aria-hidden>🔥</span>
              Только светодиодная лампа
            </p>
            <p className="mt-1 text-xs leading-relaxed text-red-100/85">
              Абажур печатается из PLA и размягчается уже при 60 °C. Лампа
              накаливания или галогенка расплавит деталь над патроном. Берите
              LED-лампу до 10 Вт и не оставляйте светильник без присмотра.
            </p>
          </div>

          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Патрон
            </legend>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {LAMP_MOUNTS.map((mount) => {
                const selected = params.lampMount === mount;

                return (
                  <button
                    aria-pressed={selected}
                    className={
                      selected
                        ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-400/60 bg-amber-500/20 px-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        : "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40 px-2 text-sm font-medium text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    }
                    key={mount}
                    onClick={() => onLampMountChange(mount)}
                    type="button"
                  >
                    {LAMP_MOUNT_LABELS[mount]}
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Отверстие шире резьбы на 0.3 мм с каждой стороны: после усадки
              патрон входит плотно, но не проваливается. Провод выходит через
              канал в верхнем поясе.
            </p>
          </fieldset>

          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">Узор</legend>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {VASE_PATTERNS.map((pattern) => {
                const selected = params.lampPattern === pattern;

                return (
                  <button
                    aria-pressed={selected}
                    className={
                      selected
                        ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-400/60 bg-amber-500/20 px-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        : "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40 px-2 text-sm font-medium text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    }
                    key={pattern}
                    onClick={() => onLampPatternChange(pattern)}
                    type="button"
                  >
                    {VASE_PATTERN_LABELS[pattern]}
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {PATTERN_HINTS[params.lampPattern]}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              Глубина рельефа у абажура фиксированная — 1.2 мм. У патрона и у
              стола стенка остаётся гладкой: гнездо и кромка не деформируются.
            </p>
          </fieldset>

          <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
            <NumberSlider
              hint="Высота от нижней кромки до пояса патрона. Верхние 18 мм занимает гнездо, поэтому свет уходит вниз."
              label="Высота"
              max={CONSTRUCTOR_LIMITS.lampHeight.max}
              min={CONSTRUCTOR_LIMITS.lampHeight.min}
              onChange={(value) => onParamChange("lampHeight", value)}
              step={CONSTRUCTOR_LIMITS.lampHeight.step}
              unit="мм"
              value={params.lampHeight}
            />

            <NumberSlider
              hint="Наружный диаметр у нижней кромки. Проверьте, что абажур влезает на стол принтера вместе с поддержками."
              label="Диаметр"
              max={CONSTRUCTOR_LIMITS.lampDiameter.max}
              min={CONSTRUCTOR_LIMITS.lampDiameter.min}
              onChange={(value) => onParamChange("lampDiameter", value)}
              step={CONSTRUCTOR_LIMITS.lampDiameter.step}
              unit="мм"
              value={params.lampDiameter}
            />

            <NumberSlider
              decimals={CONSTRUCTOR_LIMITS.lampWall.decimals}
              hint="0.8–1.2 мм — декоративный абажур, 1.6–2.4 мм — прочный и лучше держит форму. Толщина не меняется по высоте."
              label="Толщина стенки"
              max={CONSTRUCTOR_LIMITS.lampWall.max}
              min={CONSTRUCTOR_LIMITS.lampWall.min}
              onChange={(value) => onParamChange("lampWall", value)}
              step={CONSTRUCTOR_LIMITS.lampWall.step}
              unit="мм"
              value={params.lampWall}
            />
          </div>
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
                Кириллица, латиница, цифры и знаки. Буквы выступают над плитой
                на выбранную глубину и входят в неё на 1.2 мм.
              </p>
              <span className="shrink-0 text-xs tabular-nums text-slate-300">
                {signTextLength}/{SIGN_TEXT_MAX_LENGTH}
              </span>
            </div>
          </fieldset>

          <fieldset className="mt-6 border-t border-white/10 pt-5">
            <legend className="text-sm font-medium text-slate-200">
              Канал под ленту
            </legend>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {SIGN_CHANNEL_WIDTHS.map((channelWidth) => {
                const selected = params.signChannelWidth === channelWidth;

                return (
                  <button
                    aria-pressed={selected}
                    className={
                      selected
                        ? "inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-400/60 bg-violet-500/20 px-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        : "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/40 px-2 text-sm font-medium text-slate-300 transition-colors hover:border-white/25 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    }
                    key={channelWidth}
                    onClick={() => onSignChannelWidthChange(channelWidth)}
                    type="button"
                  >
                    {channelWidth} мм
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Лента ложится между направляющими заподлицо: дно канала — лицо
              плиты. Провод выходит через отверстие снизу.
            </p>
          </fieldset>

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
              hint="Выступ букв над плитой. 5–10 мм читается издалека, 15–40 мм даёт объёмную вывеску."
              label="Выступ букв"
              max={CONSTRUCTOR_LIMITS.signDepth.max}
              min={CONSTRUCTOR_LIMITS.signDepth.min}
              onChange={(value) => onParamChange("signDepth", value)}
              step={CONSTRUCTOR_LIMITS.signDepth.step}
              unit="мм"
              value={params.signDepth}
            />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-300">
            Плита 4 мм со скруглёнными углами, два отверстия 5 мм под крепёж и
            отверстие 8 мм под провод питания ленты.
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

      {params.model === "calibration" ? (
        <p
          className="mt-5 rounded-2xl border border-blue-400/40 bg-blue-500/15 p-3 text-xs leading-relaxed text-blue-100"
          role="note"
        >
          <span className="font-semibold">Этот тест требует настройки слайсера
          на каждом слое.</span>{" "}
          Скачайте STL и настройте скрипт изменения (ChangeAtZ) в Orca/Prusa,
          ориентируясь на выпуклые цифры: они подскажут, на каком слое
          менять температуру или длину ретракта.
        </p>
      ) : null}

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
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
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
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Оформите подписку Pro для безлимитного доступа.
            </p>
            <ExportErrorAlert error={exportError} />
          </>
        )}
      </div>
    </section>
  );
}
