"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  VASE_SHAPES,
  VASE_SHAPE_LABELS,
  type ConstructorParams,
  type VaseShape,
} from "@/lib/constructor/params";
import {
  renderVaseRgb,
  type VasePreview,
  type VasePreviewOptions,
} from "@/lib/constructor/vase-preview";

/**
 * Сколько вариантов в галерее: по плитке на каждый силуэт из `VASE_SHAPES`.
 *
 * Число выводится из реестра, а не пишется руками: если силуэтов станет
 * тринадцать, галерея покажет тринадцать плиток и не разойдётся с панелью, где
 * тот же список стоит в «Форме».
 */
export const VASE_SHAPE_GALLERY_COUNT = VASE_SHAPES.length;

/** Размер одной плитки в пикселях: вдвое меньше показа, чтобы буквы не мыли. */
const TILE_WIDTH = 144;
const TILE_HEIGHT = 184;

/**
 * Сколько плиток рисуется за один кадр.
 *
 * Один рендер — это сборка сетки и растеризация: около 85 мс, потому что сетка
 * предпросмотра теперь плотная (шаг 1.2 мм по обеим осям). Двенадцать подряд
 * залипли бы на секунду, а по одной в простое страница остаётся отзывчивой и
 * галерея наполняется примерно за полторы секунды.
 */
const TILES_PER_FRAME = 1;

/** Настройки плитки: ракурс как у сцены, без сглаживания и с дешёвой сеткой. */
const TILE_RENDER_OPTIONS: VasePreviewOptions = {
  width: TILE_WIDTH,
  height: TILE_HEIGHT,
  azimuth: 24,
  elevation: 12,
  supersample: 1,
  budget: "preview",
};

type VaseShapeGalleryProps = {
  /** Полные параметры модели: галерея берёт из них узор и размеры. */
  params: ConstructorParams;
  /** Клик по плитке меняет только силуэт — узор и размеры остаются. */
  onSelectShape: (shape: VaseShape) => void;
};

/**
 * Отпечаток геометрии без силуэта.
 *
 * По нему галерея понимает, что плитки устарели: сменился узор, размер, стенка
 * или органика. Сам силуэт в ключ не входит: он у каждой плитки свой, и клик по
 * готовой плитке только переносит подсветку — двенадцать кадров остаются на
 * месте. Сид здесь нужен: через органику он меняет складки на каждой форме.
 */
function geometryKey(params: ConstructorParams): string {
  return [
    params.model,
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
    params.vaseSeed,
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

/** Одна плитка: canvas с вазой и подпись силуэта. */
function ShapeTile({
  isCurrent,
  preview,
  shape,
  onSelect,
}: {
  isCurrent: boolean;
  preview: VasePreview | undefined;
  shape: VaseShape;
  onSelect: (shape: VaseShape) => void;
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
      aria-label={`Форма «${VASE_SHAPE_LABELS[shape]}»`}
      aria-pressed={isCurrent}
      className={
        isCurrent
          ? "group relative overflow-hidden rounded-xl border-2 border-blue-400 bg-slate-950 shadow-lg shadow-blue-950/40 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          : "group relative overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 transition-colors hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      }
      onClick={() => onSelect(shape)}
      title={`Применить форму «${VASE_SHAPE_LABELS[shape]}»`}
      type="button"
    >
      {/* Пропорции плитки фиксированы: кадр не «прыгает» при появлении. */}
      <span className="block aspect-[18/23] w-full">
        {preview ? (
          <canvas aria-hidden className="block h-full w-full" ref={canvasRef} />
        ) : (
          <span
            aria-hidden
            className="flex h-full w-full items-center justify-center text-xs text-slate-500"
          >
            …
          </span>
        )}
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent px-2 pt-4 pb-1 text-[0.65rem] leading-tight font-medium text-slate-200">
        {VASE_SHAPE_LABELS[shape]}
      </span>
    </button>
  );
}

/**
 * Галерея форм: двенадцать силуэтов с текущими настройками и один клик до
 * выбора.
 *
 * Пользователь выбирает глазами, а не выпадающим списком: плитки строятся тем
 * же `renderVaseRgb`, что и снимки гейта, поэтому на экране ровно то, что уйдёт
 * в STL. Параметры берутся из текущих: узор, высота, диаметр и стенка остаются
 * пользовательскими, меняется только силуэт — это честный ответ на «а как моя
 * ваза выглядела бы в другой форме».
 *
 * Раньше здесь стояла галерея сидов, и двенадцать плиток были одной вазой: сид
 * входит в геометрию только через органику, а у нового проекта она на нуле.
 */
export function VaseShapeGallery({
  params,
  onSelectShape,
}: VaseShapeGalleryProps) {
  const [frames, setFrames] = useState<Record<string, VasePreview>>({});
  const key = geometryKey(params);

  const shapes = useMemo(() => [...VASE_SHAPES], []);

  /**
   * Параметры для рендера берём из ref: эффект не должен перезапускаться от
   * каждого нового объекта параметров, иначе плитки начнут перерисовываться на
   * каждое движение слайдера и терять уже готовые кадры.
   */
  const paramsRef = useRef(params);
  paramsRef.current = params;

  /**
   * Готовые кадры в ref — чтобы не перерисовывать плитки, которые уже есть.
   * Шаг отрисовки идёт по одной плитке, и кэш должен переживать паузы между
   * кадрами.
   */
  const framesRef = useRef<Record<string, VasePreview>>({});

  // Смена узора, размера или органики делает старые плитки неверными.
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
    const queue = shapes.filter((shape) => !framesRef.current[shape]);

    const pump = () => {
      cancelScheduled = null;

      if (cancelled) {
        return;
      }

      const batch = queue.splice(0, TILES_PER_FRAME);

      if (batch.length === 0) {
        return;
      }

      const rendered: Record<string, VasePreview> = {};

      for (const shape of batch) {
        try {
          rendered[shape] = renderVaseRgb(
            { ...paramsRef.current, shape },
            TILE_RENDER_OPTIONS,
          );
        } catch {
          // Плитка останется заглушкой: галерея — подсказка, а не модель.
          // Ошибку сборки покажет предпросмотр и серверный экспорт.
        }
      }

      // Кадры прежнего набора выбрасываем: без чистки память росла бы на каждый
      // новый силуэт в реестре.
      const allowed = new Set<string>(shapes);
      const next: Record<string, VasePreview> = {};

      for (const [shape, preview] of Object.entries(framesRef.current)) {
        if (allowed.has(shape)) {
          next[shape] = preview;
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
  }, [key, shapes, params.model]);

  if (params.model !== "vase") {
    return null;
  }

  const readyCount = shapes.filter((shape) => frames[shape]).length;

  return (
    <section
      aria-labelledby="vase-shape-gallery-heading"
      className="rounded-2xl border border-white/10 bg-white/5 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          className="text-sm font-semibold text-white"
          id="vase-shape-gallery-heading"
        >
          Галерея форм
        </h3>
        <p className="text-xs text-slate-300">
          {VASE_SHAPE_GALLERY_COUNT} форм с вашими настройками
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {shapes.map((shape) => (
          <ShapeTile
            isCurrent={shape === params.shape}
            key={shape}
            onSelect={onSelectShape}
            preview={frames[shape]}
            shape={shape}
          />
        ))}
      </div>

      <p
        aria-live="polite"
        className="mt-3 text-xs leading-relaxed text-slate-300"
      >
        {readyCount < shapes.length
          ? `Рисуем формы: ${readyCount} из ${shapes.length}.`
          : "Узор, высота, диаметр и стенка остаются вашими — плитка меняет только силуэт."}
      </p>
    </section>
  );
}
