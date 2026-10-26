"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

/**
 * Рабочая область 3D-генератора: выбрать фото, отправить его в API и скачать
 * готовую модель.
 *
 * Файл уходит на `/api/3d/generate` multipart-полем `file`, а в ответ приходит
 * `{ modelUrl }`. Кредит списывает сервер и только после успешной генерации,
 * поэтому после 200 вызываем `router.refresh()` — серверная страница заново
 * прочитает `user_credits` и плашка баланса покажет новый остаток.
 *
 * Проверки размера и формата здесь дублируют серверные ради быстрой подсказки:
 * настоящую защиту держит API, браузеру оно не доверяет.
 *
 * Две карточки стоят рядом на десктопе (`lg:grid-cols-2`) и друг под другом на
 * мобильном. У обеих `min-w-0`: длинное имя файла и картинка не растягивают
 * сетку, поэтому горизонтальной прокрутки нет даже на 390 px.
 */

/** Лимит API: больше 10 МБ роут отвечает 413, здесь — понятная подсказка. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Как в роуте: JPEG, PNG и WebP. Проверяем по MIME, запасной путь — `image/*`. */
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Адрес генерации: роут сам проверяет сессию, пакет, кредиты и файл. */
const GENERATE_ENDPOINT = "/api/3d/generate";

/** 403 от роута: пакет кончился, и это не сбой сервиса. */
const NO_CREDITS_ERROR = "Кредиты закончились. Купите пакет генераций";

/**
 * 502 и 504: Gen API не ответил или не уложился в бюджет ожидания. Кредит за
 * такую попытку роут не списывает, так что человеку достаточно повторить.
 */
const SERVICE_BUSY_ERROR = "Сервис перегружен или не отвечает. Попробуйте позже";

/** Ответ успешной генерации. */
type GenerateResponse = { modelUrl?: unknown; error?: unknown };


const fileSizeFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 1,
});

/** Причина отказа или `null`, если файл подходит. */
function validateImageFile(file: File): string | null {
  const isImage =
    file.type === "" ||
    file.type.startsWith("image/") ||
    IMAGE_MIME_TYPES.includes(file.type);

  if (!isImage) {
    return "Нужен файл изображения: JPEG, PNG или WebP.";
  }

  if (file.size === 0) {
    return "Файл пустой — выберите другое фото.";
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return "Фото больше 10 МБ — уменьшите его или выберите другое.";
  }

  return null;
}

/** «842,3 КБ» / «2,4 МБ» — размер рядом с превью. */
function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${fileSizeFormatter.format(bytes / (1024 * 1024))} МБ`;
  }

  return `${fileSizeFormatter.format(Math.max(bytes / 1024, 0.1))} КБ`;
}

/** Стрелка в лоток — та же роль, что у зоны G-code в калькуляторе. */
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 16V4m0 0-4 4m4-4 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/** Куб с видимыми гранями — заглушка будущего 3D-вьювера. */
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
        d="m12 3 8 4.6v8.8L12 21l-8-4.6V7.6L12 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="m4.3 7.8 7.7 4.4 7.7-4.4M12 12.2V21"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Галочка в круге — модель собралась и её можно скачать. */
function SuccessIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m8 12.2 2.8 2.8 5.6-5.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

/** Сколько кредитов осталось; `null` — счётчик недоступен, показываем прочерк. */
type GeneratorWorkspaceProps = { credits: number | null };

export function GeneratorWorkspace({ credits }: GeneratorWorkspaceProps) {
  const inputId = useId();
  const hintId = useId();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Ссылка живёт столько же, сколько выбранный файл: старую отзываем, чтобы
  // браузер не держал в памяти мегабайты прежних фотографий.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function acceptFile(candidate: File) {
    const problem = validateImageFile(candidate);

    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setFile(candidate);
    // Новая фотография — прошлая модель к ней уже не относится.
    setModelUrl(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const candidate = event.target.files?.[0];
    // Сбрасываем значение, иначе повторный выбор того же файла не вызовет
    // change — например, после «Убрать фото».
    event.target.value = "";

    if (candidate) {
      acceptFile(candidate);
    }
  }

  /** Файл тащат над зоной: подсвечиваем её и разрешаем drop. */
  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  /** Уход на дочерний элемент не должен гасить подсветку зоны. */
  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    const nextTarget = event.relatedTarget;

    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    const candidate = event.dataTransfer.files?.[0];

    if (candidate) {
      acceptFile(candidate);
    }
  }

  function handleRemove() {
    setFile(null);
    setError(null);
    setModelUrl(null);
  }

  /**
   * Отправка фото в API.
   *
   * Ответы разбираем по коду: 200 — ссылка на модель, 403 — кончились кредиты,
   * 502/504 — Gen API не ответил (кредит за такую попытку не списывается).
   * Остальные коды (400/413/415/401/503) приходят со своим текстом от роута.
   */
  async function handleGenerate() {
    if (!file || isGenerating) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    setModelUrl(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const response = await fetch(GENERATE_ENDPOINT, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as
        | GenerateResponse
        | null;

      if (response.ok) {
        const url =
          typeof payload?.modelUrl === "string" ? payload.modelUrl : null;

        if (url) {
          setModelUrl(url);
          // Кредит списан на сервере — перечитываем страницу, чтобы плашка
          // баланса показала новый остаток.
          router.refresh();
        } else {
          setError("Сервер не вернул ссылку на модель. Попробуйте ещё раз.");
        }

        return;
      }

      if (response.status === 403) {
        setError(NO_CREDITS_ERROR);
        return;
      }

      if (response.status === 502 || response.status === 504) {
        setError(SERVICE_BUSY_ERROR);
        return;
      }

      setError(
        typeof payload?.error === "string"
          ? payload.error
          : "Не удалось сгенерировать 3D-модель. Попробуйте позже.",
      );
    } catch {
      // Сеть отвалилась или роут не ответил: для человека это тот же сбой
      // сервиса. Фото остаётся выбранным — попытку можно повторить.
      setError(SERVICE_BUSY_ERROR);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-2 lg:items-start">
      <section
        aria-labelledby="generator-upload-title"
        className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] border-t-white/15 bg-[#0a0a0a]/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_70px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-6"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl"
        />

        <div className="relative">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-blue-300 uppercase">
            Шаг 1
          </p>
          <h2
            id="generator-upload-title"
            className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl"
          >
            Фото для генерации
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
            Один предмет на однотонном фоне. Чем чётче контуры и ровнее свет,
            тем аккуратнее получится модель.
          </p>

          <label
            htmlFor={inputId}
            data-generator-dropzone
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center transition-all duration-200 focus-within:border-blue-400/70 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:ring-inset ${
              isDragging
                ? "border-blue-400/70 bg-blue-500/10"
                : "border-white/15 bg-black/25 hover:border-white/25 hover:bg-white/[0.04]"
            }`}
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
                isDragging
                  ? "border-blue-400/50 bg-blue-500/20 text-blue-100"
                  : "border-white/10 bg-white/5 text-zinc-300"
              }`}
            >
              <UploadIcon className="h-5 w-5" />
            </span>
            <span className="mt-3 text-sm font-semibold text-white">
              {file
                ? "Перетащите другое фото или нажмите, чтобы заменить"
                : "Перетащите фото сюда или нажмите, чтобы выбрать"}
            </span>
            <span
              id={hintId}
              className="mt-1 text-xs leading-relaxed text-zinc-500"
            >
              JPEG, PNG или WebP до 10 МБ. Файл остаётся в браузере.
            </span>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              autoComplete="off"
              aria-describedby={hintId}
              data-generator-file-input
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200"
            >
              {error}
            </p>
          ) : null}

          {file && previewUrl ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex h-52 items-center justify-center overflow-hidden rounded-xl bg-black/40 sm:h-64">
                <Image
                  src={previewUrl}
                  alt={`Превью загруженного фото: ${file.name}`}
                  width={512}
                  height={512}
                  unoptimized
                  data-generator-preview
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p
                  className="min-w-0 flex-1 truncate text-xs text-zinc-400"
                  title={file.name}
                >
                  {file.name}
                </p>
                <p className="text-xs whitespace-nowrap text-zinc-500 tabular-nums">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              aria-busy={isGenerating}
              data-generator-submit
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-center text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-wait disabled:opacity-70 disabled:hover:bg-white sm:w-auto"
            >
              {isGenerating
                ? "Генерация... Это может занять до 2 минут"
                : "Сгенерировать"}
            </button>
            {file ? (
              <button
                type="button"
                onClick={handleRemove}
                data-generator-reset
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-zinc-300 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
              >
                Убрать фото
              </button>
            ) : null}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            Осталось генераций: {credits === null ? "—" : credits}. Одна
            генерация списывает один кредит — и только если модель собралась.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="generator-result-title"
        className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] border-t-white/15 bg-[#0a0a0a]/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_70px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-6"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-violet-500/[0.09] blur-3xl"
        />

        <div className="relative">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-violet-300 uppercase">
            Шаг 2
          </p>
          <h2
            id="generator-result-title"
            className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl"
          >
            3D-модель
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
            Готовый файл можно будет осмотреть со всех сторон и скачать для
            печати.
          </p>

          {isGenerating ? (
            <div
              data-generator-progress
              role="status"
              aria-live="polite"
              className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-blue-400/25 bg-blue-500/[0.06] px-5 py-10 text-center sm:min-h-80"
            >
              <span
                aria-hidden
                className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-blue-400"
              />
              <p className="mt-4 max-w-xs text-sm leading-relaxed font-semibold text-white">
                Создаем 3D-модель...
              </p>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-500">
                Обычно это занимает до 2 минут. Страницу можно не закрывать.
              </p>
            </div>
          ) : modelUrl ? (
            <div
              data-generator-result
              className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] px-5 py-10 text-center sm:min-h-80"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-300">
                <SuccessIcon className="h-8 w-8" />
              </span>
              <p className="mt-4 max-w-xs text-sm leading-relaxed font-semibold text-white">
                Модель готова!
              </p>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-500">
                Скачайте файл и откройте его в слайсере — модель придёт с
                текстурой.
              </p>
              <a
                href={modelUrl}
                download
                data-generator-download
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-center text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] sm:w-auto"
              >
                Скачать GLB/STL
                <span aria-hidden>↓</span>
              </a>
            </div>
          ) : (
            <div
              data-generator-viewer-placeholder
              className="mt-5 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-black/25 px-5 py-10 text-center sm:min-h-80"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-300">
                <CubeIcon className="h-7 w-7" />
              </span>
              <p className="mt-4 max-w-xs text-sm leading-relaxed font-semibold text-white">
                Здесь появится 3D-модель после генерации
              </p>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-zinc-500">
                Вьювер с поворотом и скачиванием подключим следом за
                генерацией.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

