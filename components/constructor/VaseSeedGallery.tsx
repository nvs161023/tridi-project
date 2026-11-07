"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  CONSTRUCTOR_LIMITS,
  type ConstructorParams,
} from "@/lib/constructor/params";
import {
  renderVaseRgb,
  type VasePreview,
  type VasePreviewOptions,
} from "@/lib/constructor/vase-preview";
import { vaseSeedSeries } from "@/lib/constructor/vase-seed";

/** Сколько вариантов в галерее: двенадцать плиток, как в плане этапа. */
export const VASE_GALLERY_COUNT = 12;

/** Размер одной плитки в пикселях: вдвое меньше показа, чтобы буквы не мылить. */
const TILE_WIDTH = 144;
const TILE_HEIGHT = 184;

/**
 * Сколько плиток рисуется за один кадр.
 *
 * Один рендер — это сборка сетки и растеризация: около десяти миллисекунд.
 * Двенадцать подряд дали бы заметный «залип» прокрутки, а по три в простое
 * страница остаётся отзывчивой, и плитки появляются почти сразу.
 */
const TILES_PER_FRAME = 3;

/** Настройки плитки: ракурс как у сцены, без сглаживания и с дешёвой сеткой. */
const TILE_RENDER_OPTIONS: VasePreviewOptions = {
  width: TILE_WIDTH,
  height: TILE_HEIGHT,
  azimuth: 24,
  elevation: 12,
  supersample: 1,
  budget: "preview",
};

type VaseSeedGalleryProps = {
  /** Полные параметры модели: галерея берёт из них форму и рельеф. */
  params: ConstructorParams;
  /** Выбор сида: он же уходит в предпросмотр, в проект и в имя STL. */
  onSelectSeed: (seed: number) => void;
};

/**
 * Отпечаток геометрии без сида.
 *
 * По нему галерея понимает, что плитки устарели: сменился силуэт, узор,
 * закрутка или размер. Сам сид в ключ не входит — при его смене перерисовываются
 * те же плитки с другим шумом, и старые кадры не нужно выбрасывать заранее.
 */
function geometryKey(params: ConstructorParams): string {
  return [
    params.model,
    params.shape,
    params.height,
    params.diameter,
    params.wall,
    params.footMm,
    params.rimMm,
    // Слои целиком, а не три поля: композиция меняет силуэт любым своим полем —
    // амплитудой, фазой и затуханием, — и плитки должны обновиться на каждое.
    JSON.stringify(params.patterns),
    params.sectionSides,
    params.flutes,
    params.fluteDepthMm,
    params.twistDeg,
    params.organic,
    params.leanDeg,
  ].join("|");
}

/**
 * Рисует готовый кадр в canvas.
 *
 * `renderVaseRgb` отдаёт три байта на точку, а холсту нужны четыре: альфу
 * ставим непрозрачной. Кадр маленький, поэтому копирование вручную дешевле,
 * чем отдельный путь с `ImageData` из RGB.
 */
function paintPreview(canvas: HTMLCanvasElement, preview: VasePreview) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = preview.width;
  canvas.height = preview.height;

  const image = context.createImageData(preview.width, preview.height);

  for (let index = 0; index < preview.rgb.length; index += 3) {
    const offset = (index / 3) * 4;
    image.data[offset] = preview.rgb[index];
    image.data[offset + 1] = preview.rgb[index + 1];
    image.data[offset + 2] = preview.rgb[index + 2];
    image.data[offset + 3] = 255;
  }

  context.putImageData(image, 0, 0);
}

/**
 * Планировщик фоновой отрисовки.
 *
 * `requestIdleCallback` есть не во всех браузерах, поэтому запасной путь —
 * обычный таймер: плитки появятся чуть позже, но интерфейс не залипнет.
 */
function scheduleInIdle(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(callback, { timeout: 240 });

    return () => window.cancelIdleCallback(handle);
  }

  const handle = window.setTimeout(callback, 24);

  return () => window.clearTimeout(handle);
}

/** Одна плитка: канвас с вазой и подпись номера варианта. */
function SeedTile({
  index,
  isCurrent,
  preview,
  seed,
  onSelect,
}: {
  index: number;
  isCurrent: boolean;
  preview: VasePreview | undefined;
  seed: number;
  onSelect: (seed: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas && preview) {
      paintPreview(canvas, preview);
    }
  }, [preview]);

  return (
    <button
      aria-label={`Вариант ${index + 1}, сид ${seed}`}
      aria-pressed={isCurrent}
      className={
        isCurrent
          ? "group relative overflow-hidden rounded-xl border-2 border-blue-400 bg-slate-950 shadow-lg shadow-blue-950/40 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          : "group relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 transition-colors hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      }
      onClick={() => onSelect(seed)}
      title={`Сид ${seed}`}
      type="button"
    >
      {/* Пропорции плитки фиксированы: кадр не «прыгает» при появлении. */}
      <span className="block aspect-[18/23] w-full">
        {preview ? (
          <canvas
            aria-hidden
            className="block h-full w-full"
            ref={canvasRef}
          />
        ) : (
          <span
            aria-hidden
            className="flex h-full w-full items-center justify-center text-xs text-slate-500"
          >
            …
          </span>
        )}
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/90 to-transparent px-2 pt-4 pb-1 text-[0.65rem] font-medium text-slate-300">
        <span>{index + 1}</span>
        <span className="tabular-nums text-slate-400">{seed}</span>
      </span>
    </button>
  );
}

/**
 * Галерея вариантов: двенадцать ваз из текущих настроек с разными сидами.
 *
 * Пользователь выбирает глазами, а не слайдером: плитки строятся тем же
 * `renderVaseRgb`, что и снимки гейта, поэтому на экране ровно то, что уйдёт в
 * STL. Сиды идут цепочкой от текущего (`vaseSeedSeries`), так что галерея
 * воспроизводима: один и тот же проект открывается теми же плитками.
 */
export function VaseSeedGallery({ params, onSelectSeed }: VaseSeedGalleryProps) {
  const [frames, setFrames] = useState<Record<number, VasePreview>>({});
  const max = CONSTRUCTOR_LIMITS.vaseSeed.max;
  const current = Math.round(params.vaseSeed);
  const key = geometryKey(params);

  const seeds = useMemo(
    () => [current, ...vaseSeedSeries(current, VASE_GALLERY_COUNT - 1, max)],
    [current, max],
  );

  /**
   * Параметры для рендера берём из ref: эффект не должен перезапускаться от
   * каждого нового объекта параметров, иначе плитки начнут перерисовываться
   * на смену сида и терять уже готовые кадры.
   */
  const paramsRef = useRef(params);
  paramsRef.current = params;

  /**
   * Готовые кадры в ref — чтобы не перерисовывать плитки, которые уже есть.
   * После клика по одной из них серия сдвигается на один сид: одиннадцать кадров
   * остаются прежними, и рисовать заново нужно только новый.
   */
  const framesRef = useRef<Record<number, VasePreview>>({});

  // Смена силуэта, узора или размера делает старые плитки неверными.
  useEffect(() => {
    framesRef.current = {};
    setFrames({});
  }, [key]);

  useEffect(() => {
    if (params.model !== "vase") {
      return;
    }

    let cancelled = false;
    let cancelScheduled: (() => void) | null = null;
    const queue = seeds.filter((seed) => !framesRef.current[seed]);

    const pump = () => {
      cancelScheduled = null;

      if (cancelled) {
        return;
      }

      const batch = queue.splice(0, TILES_PER_FRAME);

      if (batch.length === 0) {
        return;
      }

      const rendered: Record<number, VasePreview> = {};

      for (const seed of batch) {
        try {
          rendered[seed] = renderVaseRgb(
            { ...paramsRef.current, vaseSeed: seed },
            TILE_RENDER_OPTIONS,
          );
        } catch {
          // Плитка останется заглушкой: галерея — подсказка, а не модель.
          // Ошибку сборки покажет предпросмотр и серверный экспорт.
        }
      }

      // Кадры прежней серии выбрасываем: после «Другой вазы» сиды другие, и
      // без чистки память росла бы на каждый клик.
      const allowed = new Set(seeds);
      const next: Record<number, VasePreview> = {};

      for (const [seed, preview] of Object.entries(framesRef.current)) {
        if (allowed.has(Number(seed))) {
          next[Number(seed)] = preview;
        }
      }

      framesRef.current = { ...next, ...rendered };
      setFrames(framesRef.current);

      if (queue.length > 0) {
        cancelScheduled = scheduleInIdle(pump);
      }
    };

    cancelScheduled = scheduleInIdle(pump);

    return () => {
      cancelled = true;
      cancelScheduled?.();
    };
  }, [key, seeds, params.model]);

  if (params.model !== "vase") {
    return null;
  }

  const readyCount = seeds.filter((seed) => frames[seed]).length;

  return (
    <section
      aria-labelledby="vase-gallery-heading"
      className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          className="text-sm font-semibold text-white"
          id="vase-gallery-heading"
        >
          Галерея вариантов
        </h3>
        <p className="text-xs text-slate-300">
          Двенадцать ваз из ваших настроек: меняется только сид.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {seeds.map((seed, index) => (
          <SeedTile
            index={index}
            isCurrent={seed === current}
            key={seed}
            onSelect={onSelectSeed}
            preview={frames[seed]}
            seed={seed}
          />
        ))}
      </div>

      <p aria-live="polite" className="mt-3 text-xs leading-relaxed text-slate-300">
        {params.organic === 0
          ? "Органика 0: сид меняет только микро-вариации силуэта, до 2 %. Добавьте складки, чтобы варианты стали заметно разными."
          : readyCount < seeds.length
            ? `Рисуем варианты: ${readyCount} из ${seeds.length}.`
            : "Плитка — это тот же сид, что попадёт в проект и в имя STL. Нажмите на вариант, чтобы забрать его форму."}
      </p>
    </section>
  );
}
