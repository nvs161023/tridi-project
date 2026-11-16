"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

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
} from "@/lib/generator/photo-generator";

/**
 * Генератор 3D-модели по фото для страницы `/3d-generator`.
 *
 * Поток целиком клиентский: фото жмутся в браузере, `/api/generate-3d`
 * проверяет сессию и кредиты, создаёт задачу у сети и сразу отдаёт `taskId`,
 * а дальше компонент сам опрашивает `/api/check-3d-status` раз в три секунды.
 * На `success` роут уже вернул ссылку на печатный STL — его показывает
 * `GeneratedModelViewer` и отдаёт кнопка «Скачать STL». Копия файла к этому
 * моменту лежит в закрытом бакете, поэтому модель остаётся в «Моих моделях» и
 * после перезапуска сервера.
 *
 * Слева — карточка «Фото»: загрузка, качество, согласие на публикацию в
 * галерее и кнопка запуска. Справа — карточка «Модель»: ожидание с
 * прогресс-баром, вьювер и скачивание. На мобильном карточки идут друг под
 * другом.
 */

/** Просмотрщик подключается только в браузере: WebGL не нужен на сервере. */
const GeneratedModelViewer = dynamic(
  () =>
    import("@/components/generator/GeneratedModelViewer").then(
      (module) => module.GeneratedModelViewer,
    ),
  {
    ssr: false,
    loading: () => <ViewerSkeleton />,
  },
);

function ViewerSkeleton() {
  return (
    <div className="flex h-full items-center justify-center">
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

/** Сколько генераций осталось по счётчику `user_credits`; `null` — неизвестно. */
type Image3DGeneratorProps = {
  credits: number | null;
};

export function Image3DGenerator({ credits }: Image3DGeneratorProps) {
  const router = useRouter();
  const inputId = useId();
  const hintId = useId();
  const [photos, setPhotos] = useState<GeneratorPhoto[]>([]);
  const [quality, setQuality] = useState<GeneratorQuality>("ultra");
  // Галерея предвключена, но это осознанный выбор: галочку можно снять здесь
  // или позже в «Моих моделях». Значение уходит в `/api/generate-3d` вместе
  // с фото и записывается в строку истории.
  const [isPublic, setIsPublic] = useState(true);
  const [phase, setPhase] = useState<GeneratorPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [task, setTask] = useState<{
    id: string;
    service: GeneratorService;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const pollStartedAt = useRef(0);

  const isBusy = phase === "submitting" || phase === "processing";
  const room = MAX_GENERATOR_PHOTOS - photos.length;
  // Ноль кредитов — не ошибка ввода: кнопку гасим заранее, чтобы человек не
  // ждал ответа 402. `null` (счётчик недоступен) кнопку не блокирует — это
  // решит сервер, а не пропавший запрос к базе.
  const noCredits = credits !== null && credits <= 0;
  const canGenerate = photos.length > 0 && !isBusy && !isReading && !noCredits;

  /** Общий путь для выбора файлов и drag-and-drop: готовит и добавляет фото. */
  async function addFiles(files: File[]) {
    if (files.length === 0 || isBusy) {
      return;
    }

    if (room <= 0) {
      setError(`В генератор входит не больше ${MAX_GENERATOR_PHOTOS} фото.`);
      return;
    }

    const images = files.filter(
      (file) => file.type === "" || file.type.startsWith("image/"),
    );

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

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    // Поле очищается сразу: повторный выбор того же файла тоже сработает.
    event.target.value = "";

    void addFiles(files);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (isBusy) {
      return;
    }

    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    // Курсор переходит на дочерний элемент — подсветку не снимаем.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (isBusy || isReading) {
      return;
    }

    void addFiles(Array.from(event.dataTransfer.files));
  }

  function removePhoto(id: string) {
    if (isBusy) {
      return;
    }

    setPhotos((current) => current.filter((photo) => photo.id !== id));
  }

  async function handleGenerate() {
    if (!canGenerate) {
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
          isPublic,
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
          // Баланс в шапке страницы посчитан на сервере: кредит уже списан,
          // поэтому просим серверную часть перечитать `user_credits`.
          router.refresh();
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
  }, [router, task]);

  const progressText =
    phase === "submitting"
      ? "Отправляем фото в сервис…"
      : stageLabel(progress);

  const creditNote = noCredits
    ? "Кредиты закончились: одна генерация списывает один кредит."
    : credits === null
      ? "Одна генерация списывает один кредит — баланс проверит сервер."
      : `Одна генерация — один кредит. Осталось: ${credits}.`;

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* Карточка 1: фото, качество и запуск. */}
      <section
        aria-labelledby="generator-photos-heading"
        className="rounded-[1.75rem] border border-white/[0.07] bg-[#0a0a0a]/80 p-5 shadow-[0_30px_90px_-60px_rgba(0,0,0,1)] backdrop-blur-xl sm:p-6"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-400/25 bg-blue-500/10 text-sm font-extrabold text-blue-200"
          >
            1
          </span>
          <div className="min-w-0">
            <h2
              className="text-lg font-extrabold tracking-tight text-white"
              id="generator-photos-heading"
            >
              Фото предмета
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
              1–4 кадра: чем больше видов, тем точнее силуэт
            </p>
          </div>
        </div>

        <div
          aria-label="Фото для генерации"
          className={
            isDragging
              ? "mt-4 rounded-2xl border border-dashed border-blue-400/70 bg-blue-500/[0.08] p-2 transition-colors"
              : "mt-4 rounded-2xl border border-dashed border-white/10 p-2 transition-colors"
          }
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="group"
        >
          {photos.length === 0 ? (
            <label
              className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl px-4 py-8 text-center transition-colors hover:bg-white/[0.03] focus-within:ring-2 focus-within:ring-blue-400 focus-within:outline-none"
              htmlFor={inputId}
            >
              <span
                aria-hidden
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl"
              >
                📷
              </span>
              <span className="text-sm font-semibold text-white">
                {isReading
                  ? "Готовим фото…"
                  : "Перетащите фото сюда или нажмите"}
              </span>
              <span className="text-xs leading-relaxed text-zinc-500">
                PNG, JPG или WebP — до {MAX_GENERATOR_PHOTOS} кадров
              </span>
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
          ) : (
            <div className="grid grid-cols-4 gap-2">
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
                <label
                  className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-slate-950/40 text-center text-[0.6rem] leading-tight font-semibold tracking-wide text-slate-300 uppercase transition-colors hover:border-blue-400/60 hover:text-white focus-within:ring-2 focus-within:ring-blue-400 focus-within:outline-none"
                  htmlFor={inputId}
                >
                  <span aria-hidden className="text-lg">
                    ＋
                  </span>
                  <span className="mt-0.5">
                    {isReading
                      ? "Готовим…"
                      : `${photos.length} из ${MAX_GENERATOR_PHOTOS}`}
                  </span>
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
            </div>
          )}
        </div>

        <p
          className="mt-2 text-xs leading-relaxed text-zinc-500"
          id={hintId}
        >
          Браузер сам сжимает снимок до {GENERATOR_PHOTO_MAX_SIDE_PX} px по
          длинной стороне. Порядок видов: {GENERATOR_PHOTO_VIEWS.join(", ")}.
        </p>

        <div className="mt-5">
          <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
            Качество
          </p>
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
                      ? "min-h-10 rounded-xl border border-fuchsia-400/70 bg-gradient-to-r from-fuchsia-500/30 to-blue-500/30 px-2 text-xs font-semibold text-white shadow-lg shadow-fuchsia-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      : "min-h-10 rounded-xl border border-white/15 bg-white/5 px-2 text-xs font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
          <input
            checked={isPublic}
            className="mt-0.5 size-4 accent-emerald-400"
            disabled={isBusy}
            onChange={(event) => setIsPublic(event.target.checked)}
            type="checkbox"
          />
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-zinc-200">
              Показать модель в галерее
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500">
              Согласен(на) на публикацию: модель увидят все посетители{" "}
              <Link
                className="font-semibold text-zinc-300 underline underline-offset-2 hover:text-white"
                href="/gallery"
              >
                галереи
              </Link>
              , а STL сможет скачать любой вошедший. Передумать можно в{" "}
              <Link
                className="font-semibold text-zinc-300 underline underline-offset-2 hover:text-white"
                href="/my-models"
              >
                «Моих моделях»
              </Link>
              .
            </span>
          </span>
        </label>

        <button
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-blue-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-fuchsia-500/25 transition-transform hover:scale-[1.01] hover:from-fuchsia-400 hover:to-blue-400 focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none active:scale-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          disabled={!canGenerate}
          onClick={handleGenerate}
          type="button"
        >
          {phase === "submitting"
            ? "Создаём задачу…"
            : isBusy
              ? "Генерируем…"
              : modelUrl
                ? "Сгенерировать заново"
                : "Сгенерировать 3D"}
          {isBusy ? null : <span aria-hidden>→</span>}
        </button>

        <p className="mt-2 text-center text-xs leading-relaxed text-zinc-500">
          {creditNote}
        </p>
      </section>

      {/* Карточка 2: ожидание, вьювер и скачивание. */}
      <section
        aria-labelledby="generator-result-heading"
        className="rounded-[1.75rem] border border-white/[0.07] bg-[#0a0a0a]/80 p-5 shadow-[0_30px_90px_-60px_rgba(0,0,0,1)] backdrop-blur-xl sm:p-6"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-sm font-extrabold text-emerald-200"
          >
            2
          </span>
          <div className="min-w-0">
            <h2
              className="text-lg font-extrabold tracking-tight text-white"
              id="generator-result-heading"
            >
              Модель
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
              STL для слайсера — 120 мм по длинной стороне
            </p>
          </div>
        </div>

        {error ? (
          <p
            className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {isBusy ? (
          <div
            aria-live="polite"
            className="mt-4 rounded-2xl border border-blue-400/20 bg-blue-500/[0.06] px-4 py-6"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-blue-400"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {progressText}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                  Обычно это занимает до двух минут. Страницу можно не
                  закрывать.
                </p>
              </div>
              <span className="ml-auto shrink-0 text-sm font-bold tabular-nums text-white">
                {progress} %
              </span>
            </div>

            <div
              aria-label="Прогресс генерации"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progress}
              className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-blue-400 transition-[width] duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Статус проверяется каждые 3 секунды, обновлять страницу не нужно.
            </p>
          </div>
        ) : modelUrl ? (
          <div className="mt-4" data-generator-result>
            <div
              aria-live="polite"
              className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2"
            >
              <p className="text-sm font-semibold text-emerald-100">
                Модель готова
              </p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
                Сетка прошла очистку и приведена к 120 мм. Покрутите превью и
                скачайте файл для слайсера.
              </p>
            </div>

            <div className="mt-3 h-72 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 sm:h-80">
              <GeneratedModelViewer url={modelUrl} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Вращение — левая кнопка мыши или один палец, зум — колесо или два
              пальца.
            </p>

            <a
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/25 transition-colors hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none"
              data-generator-download
              download="tridi-generated.stl"
              href={modelUrl}
            >
              <span aria-hidden>⬇</span>
              Скачать STL
            </a>

            <p className="mt-2 text-center text-xs leading-relaxed text-zinc-500">
              Модель сохранена в истории. Включить или скрыть публикацию в
              галерее можно в{" "}
              <Link
                className="font-semibold text-zinc-300 underline underline-offset-2 hover:text-white"
                href="/my-models"
              >
                «Моих моделях»
              </Link>
              .
            </p>
          </div>
        ) : (
          <div
            className="mt-4 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-black/25 px-5 py-10 text-center sm:min-h-80"
            data-generator-viewer-placeholder
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-300">
              <CubeIcon className="h-7 w-7" />
            </span>
            <p className="mt-4 max-w-xs text-sm leading-relaxed font-semibold text-white">
              {phase === "failed"
                ? "Модель не собралась"
                : "Здесь появится 3D-модель"}
            </p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-500">
              {phase === "failed"
                ? "Поправьте ошибку и запустите ещё раз: за отказ сети кредит возвращается на счёт."
                : "Загрузите фото и нажмите «Сгенерировать 3D»: модель можно будет повернуть со всех сторон и скачать."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/** Контур куба для пустого места под вьювер. */
function CubeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M4 7.5 12 12l8-4.5M12 12v9"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}







