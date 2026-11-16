"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

import {
  GENERATOR_PHOTO_JPEG_QUALITY,
  GENERATOR_PHOTO_MAX_SIDE_PX,
  GENERATOR_PHOTO_VIEWS,
  GENERATOR_POLL_INTERVAL_MS,
  GENERATOR_POLL_TIMEOUT_MS,
  MAX_GENERATOR_PHOTOS,
  generatorServiceFor,
  type GeneratorQuality,
  type GeneratorService,
} from "@/lib/constructor/photo-generator";

/**
 * Секция «Генератор по фото» панели конструктора.
 *
 * Поток целиком клиентский: фото жмутся в браузере, `/api/generate-3d`
 * создаёт задачу у сети и сразу отдаёт `taskId`, а дальше секция сама
 * опрашивает `/api/check-3d-status` раз в три секунды. На `success` роут уже
 * вернул ссылку на печатный STL — его показывает `GeneratedModelViewer` и
 * отдаёт кнопка «Скачать STL».
 */

/** Просмотрщик подключается только в браузере: WebGL не нужен на сервере. */
const GeneratedModelViewer = dynamic(
  () =>
    import("@/components/constructor/GeneratedModelViewer").then(
      (module) => module.GeneratedModelViewer,
    ),
  {
    ssr: false,
    loading: () => <ViewerSkeleton />,
  },
);

function ViewerSkeleton() {
  return (
    <div className="flex h-64 items-center justify-center">
      <p className="text-sm text-slate-300">🌀 Готовим 3D-предпросмотр…</p>
    </div>
  );
}

/** Одно загруженное фото: превью для сетки и base64 для запроса. */
type GeneratorPhoto = {
  /** Ключ превью: уникален даже для одного файла, добавленного дважды. */
  id: string;
  /** Имя файла из проводника — подпись для скринридера. */
  name: string;
  /** Сжатый JPEG в data URL: им рисуется квадратик превью. */
  preview: string;
  /** Чистый base64 без префикса — уходит в `/api/generate-3d`. */
  base64: string;
};

/** Состояние задачи: номер есть только после ответа `/api/generate-3d`. */
type GeneratorPhase =
  | "idle"
  | "submitting"
  | "processing"
  | "success"
  | "failed";

/** Переключатель качества: подписи из задания, значения — как у роута. */
const QUALITY_OPTIONS: { value: GeneratorQuality; label: string }[] = [
  { value: "standard", label: "Стандарт (быстро)" },
  { value: "ultra", label: "Ультра (детально)" },
];

/** Файл в data URL: превью и canvas берут картинку отсюда. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Файл прочитан не как строка."));
      }
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

/** Картинка из data URL: нужна, чтобы узнать её размеры перед сжатием. */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Браузер не открыл картинку."));
    image.src = dataUrl;
  });
}

/**
 * Готовит фото к отправке.
 *
 * Снимок с телефона — это 4–12 МБ, а сеть строит модель по силуэту. Поэтому
 * кадр ужимается до 1600 px по длинной стороне и пережимается в JPEG: четыре
 * вида уходят одним запросом вместо десятков мегабайт. Прозрачный фон
 * закрашивается белым — генераторы читают его как пустой объект.
 */
async function preparePhoto(file: File): Promise<GeneratorPhoto> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, GENERATOR_PHOTO_MAX_SIDE_PX / longestSide);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Браузер не дал canvas для сжатия фото.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const compressed = canvas.toDataURL(
    "image/jpeg",
    GENERATOR_PHOTO_JPEG_QUALITY,
  );

  return {
    base64: compressed.slice(compressed.indexOf(",") + 1),
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${file.name}-${file.lastModified}-${file.size}`,
    name: file.name,
    preview: compressed,
  };
}

/** Подпись этапа по прогрессу: проценты сети растут неравномерно. */
function stageLabel(progress: number): string {
  if (progress >= 95) {
    return "Собираем печатный STL…";
  }

  if (progress >= 45) {
    return "Уточняем детали модели…";
  }

  return "Строим модель по фото…";
}

/** Прогресс из ответа: число 0–100, всё остальное — прежнее значение. */
function readProgress(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

/** Текст ошибки из JSON роута: без него показываем общий. */
function readError(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    const message = (payload as { error: string }).error.trim();

    if (message) {
      return message;
    }
  }

  return fallback;
}

export function PhotoGeneratorSection() {
  const inputId = useId();
  const hintId = useId();
  const [photos, setPhotos] = useState<GeneratorPhoto[]>([]);
  const [quality, setQuality] = useState<GeneratorQuality>("ultra");
  const [phase, setPhase] = useState<GeneratorPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [task, setTask] = useState<{
    id: string;
    service: GeneratorService;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const pollStartedAt = useRef(0);

  const isBusy = phase === "submitting" || phase === "processing";
  const room = MAX_GENERATOR_PHOTOS - photos.length;

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    // Поле очищается сразу: повторный выбор того же файла тоже сработает.
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (room <= 0) {
      setError(`В генератор входит не больше ${MAX_GENERATOR_PHOTOS} фото.`);
      return;
    }

    const images = files.filter((file) => file.type.startsWith("image/"));

    if (images.length === 0) {
      setError("Нужны фотографии: PNG, JPG или WebP.");
      return;
    }

    const skipped = files.length - images.length;
    const accepted = images.slice(0, room);

    setIsReading(true);
    setError(null);

    try {
      const prepared: GeneratorPhoto[] = [];

      for (const file of accepted) {
        prepared.push(await preparePhoto(file));
      }

      setPhotos((current) =>
        [...current, ...prepared].slice(0, MAX_GENERATOR_PHOTOS),
      );

      const cut = skipped + (images.length - accepted.length);

      if (cut > 0) {
        setError(
          `Добавили ${prepared.length} из ${files.length}: в генератор входит не больше ${MAX_GENERATOR_PHOTOS} фото.`,
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось прочитать фото. Попробуйте другой файл.",
      );
    } finally {
      setIsReading(false);
    }
  }

  function removePhoto(id: string) {
    if (isBusy) {
      return;
    }

    setPhotos((current) => current.filter((photo) => photo.id !== id));
  }

  async function handleGenerate() {
    if (photos.length === 0 || isBusy || isReading) {
      return;
    }

    // Снимок входа: пока идёт POST, список фото может измениться, а сеть для
    // опроса обязана совпасть с той, что получила ровно эти кадры.
    const sentPhotos = photos;
    const sentQuality = quality;

    setError(null);
    setModelUrl(null);
    setTask(null);
    setProgress(0);
    setPhase("submitting");

    try {
      const response = await fetch("/api/generate-3d", {
        body: JSON.stringify({
          images: sentPhotos.map((photo) => photo.base64),
          quality: sentQuality,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          readError(payload, "Сервер не принял фото. Попробуйте ещё раз."),
        );
      }

      const taskId =
        typeof payload === "object" &&
        payload !== null &&
        "taskId" in payload &&
        typeof (payload as { taskId?: unknown }).taskId === "string"
          ? (payload as { taskId: string }).taskId
          : "";

      if (!taskId) {
        throw new Error("Сервер не вернул номер задачи.");
      }

      // Опрашивать нужно ту сеть, которая создала задачу: номер Tripo не
      // найдётся в Meshy. Правило то же, что у роута.
      setTask({
        id: taskId,
        service: generatorServiceFor(sentPhotos.length, sentQuality),
      });
      setPhase("processing");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось создать задачу. Попробуйте позже.",
      );
      setPhase("failed");
    }
  }

  useEffect(() => {
    if (!task) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    pollStartedAt.current = Date.now();

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/check-3d-status?taskId=${encodeURIComponent(task.id)}&service=${task.service}`,
        );
        const payload: unknown = await response.json().catch(() => null);

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setError(
            readError(
              payload,
              "Сервис не ответил на проверку статуса. Попробуйте позже.",
            ),
          );
          setPhase("failed");
          return;
        }

        const body =
          typeof payload === "object" && payload !== null
            ? (payload as {
                status?: unknown;
                progress?: unknown;
                modelUrl?: unknown;
                error?: unknown;
              })
            : {};
        const status =
          typeof body.status === "string" ? body.status : "processing";

        setProgress((current) => readProgress(body.progress, current));

        if (status === "success") {
          if (typeof body.modelUrl !== "string" || !body.modelUrl.trim()) {
            setError("Задача завершена, но ссылки на модель нет.");
            setPhase("failed");
            return;
          }

          setProgress(100);
          setModelUrl(body.modelUrl);
          setPhase("success");
          return;
        }

        if (status === "failed") {
          setError(
            typeof body.error === "string" && body.error.trim()
              ? body.error
              : "Сервис не смог построить модель. Попробуйте другое фото.",
          );
          setPhase("failed");
          return;
        }

        if (Date.now() - pollStartedAt.current > GENERATOR_POLL_TIMEOUT_MS) {
          setError(
            "Генерация идёт слишком долго. Попробуйте позже или выберите «Стандарт».",
          );
          setPhase("failed");
          return;
        }

        timer = setTimeout(poll, GENERATOR_POLL_INTERVAL_MS);
      } catch {
        if (cancelled) {
          return;
        }

        // Сеть моргнула — не сдаёмся: следующий опрос через три секунды.
        timer = setTimeout(poll, GENERATOR_POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [task]);

  const progressText =
    phase === "submitting"
      ? "Отправляем фото в сервис…"
      : stageLabel(progress);

  return (
    <section aria-labelledby="photo-generator-heading">
      <h3
        className="text-xs font-semibold tracking-wide text-slate-300 uppercase"
        id="photo-generator-heading"
      >
        Генератор по фото
      </h3>

      <p className="mt-2 text-xs leading-relaxed text-slate-300">
        Загрузите 1–4 фото предмета и получите готовый печатный STL: сеть
        построит модель, «мясорубка» почистит сетку и приведёт её к 120 мм по
        длинной стороне. Несколько кадров — это виды одной модели: спереди,
        слева, сзади и справа.
      </p>

      <div
        aria-label="Загруженные фото"
        className="mt-4 grid grid-cols-4 gap-2"
        role="group"
      >
        {photos.map((photo) => (
          <div className="relative" key={photo.id}>
            <div
              aria-label={`Фото: ${photo.name}`}
              className="aspect-square w-full rounded-xl border border-white/15 bg-cover bg-center"
              role="img"
              style={{ backgroundImage: `url(${photo.preview})` }}
            />
            <button
              aria-label={`Убрать фото ${photo.name}`}
              className="absolute -top-1.5 -right-1.5 inline-flex size-6 items-center justify-center rounded-full border border-white/20 bg-slate-950 text-xs font-bold text-slate-200 shadow transition-colors hover:border-rose-400/60 hover:text-rose-200 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isBusy}
              onClick={() => removePhoto(photo.id)}
              type="button"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
        ))}

        {room > 0 ? (
          <div
            aria-hidden
            className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-slate-950/60 text-center text-[0.6rem] leading-tight font-medium tracking-wide text-slate-300 uppercase"
          >
            <span className="text-lg">🖼️</span>
            <span className="mt-0.5">
              {photos.length} из {MAX_GENERATOR_PHOTOS}
            </span>
          </div>
        ) : null}
      </div>

      {room > 0 ? (
        <label
          className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-400/60 bg-blue-500/15 px-3 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-500/25 focus-within:ring-2 focus-within:ring-blue-400 focus-within:ring-offset-2 focus-within:ring-offset-slate-950"
          htmlFor={inputId}
        >
          {isReading
            ? "Готовим фото…"
            : photos.length === 0
              ? "Загрузить фото"
              : "Добавить фото"}
          <input
            accept="image/*"
            aria-describedby={hintId}
            className="sr-only"
            disabled={isReading || isBusy}
            id={inputId}
            multiple
            onChange={handleFiles}
            type="file"
          />
        </label>
      ) : null}

      <p className="mt-2 text-xs leading-relaxed text-slate-400" id={hintId}>
        PNG, JPG или WebP, до {MAX_GENERATOR_PHOTOS} фото. Браузер сам сжимает
        снимок до {GENERATOR_PHOTO_MAX_SIDE_PX} px по длинной стороне, поэтому
        телефонные фото не раздувают запрос. Порядок видов:{" "}
        {GENERATOR_PHOTO_VIEWS.join(", ")}.
      </p>

      <div className="mt-4">
        <p className="text-xs font-semibold text-slate-200">Качество</p>
        <div
          aria-label="Качество генерации"
          className="mt-2 grid grid-cols-2 gap-2"
          role="group"
        >
          {QUALITY_OPTIONS.map((option) => {
            const active = quality === option.value;

            return (
              <button
                aria-pressed={active}
                className={
                  active
                    ? "min-h-10 rounded-xl border border-fuchsia-400/70 bg-gradient-to-r from-fuchsia-500/30 to-blue-500/30 px-2 text-xs font-semibold text-white shadow-lg shadow-fuchsia-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:outline-none"
                    : "min-h-10 rounded-xl border border-white/15 bg-white/5 px-2 text-xs font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none"
                }
                disabled={isBusy}
                key={option.value}
                onClick={() => setQuality(option.value)}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          «Ультра» строит самую подробную сетку, «Стандарт» — быструю и дешёвую.
          Несколько фото всегда обрабатываются по видам.
        </p>
      </div>

      <button
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-blue-500 px-4 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition-transform hover:scale-[1.01] hover:from-fuchsia-400 hover:to-blue-400 focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none active:scale-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        disabled={photos.length === 0 || isBusy || isReading}
        onClick={handleGenerate}
        type="button"
      >
        {phase === "submitting"
          ? "Создаём задачу…"
          : isBusy
            ? "Генерируем…"
            : modelUrl
              ? "Сгенерировать заново"
              : "Сгенерировать"}
      </button>

      {isBusy ? (
        <div aria-live="polite" className="mt-4">
          <div className="flex items-baseline justify-between gap-3 text-xs text-slate-300">
            <span>{progressText}</span>
            <span className="font-semibold tabular-nums text-white">
              {progress} %
            </span>
          </div>
          <div
            aria-label="Прогресс генерации"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-blue-400 transition-[width] duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Статус проверяется каждые 3 секунды, страницу можно не обновлять.
          </p>
        </div>
      ) : null}

      {error ? (
        <p
          className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {modelUrl ? (
        <div className="mt-4">
          <div
            aria-live="polite"
            className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2"
          >
            <p className="text-sm font-semibold text-emerald-100">
              Модель готова
            </p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
              STL прошёл очистку и приведён к 120 мм по длинной стороне.
              Покрутите превью и скачайте файл для слайсера.
            </p>
          </div>

          <div className="mt-3 h-64 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
            <GeneratedModelViewer url={modelUrl} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Вращение — левая кнопка мыши или один палец, зум — колесо или два
            пальца.
          </p>

          <a
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-400 px-5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/25 transition-colors hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none"
            download="tridi-generated.stl"
            href={modelUrl}
          >
            <span aria-hidden>⬇</span>
            Скачать STL
          </a>
        </div>
      ) : null}
    </section>
  );
}
