"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useTransition, type ChangeEvent } from "react";

import { setGenerationVisibility } from "@/app/actions/generations";
import {
  generationServiceLabel,
  generationStlHref,
  type GenerationCardData,
} from "@/lib/generator/generations";

/**
 * Карточка сгенерированной модели для «Моих моделей» и галереи.
 *
 * Превью — тот же `GeneratedModelViewer`, что и на странице генератора:
 * подписанная ссылка на STL живёт час и приходит с сервера. Скачивание идёт
 * не в бакет, а в `/api/generations/<id>/stl`: гость галереи видит модель, но
 * кнопка ведёт его на вход, а не отдаёт файл.
 *
 * В «Моих моделях» карточка ещё и управляет публикацией: переключатель
 * вызывает Server Action и при ошибке возвращает флажок назад, чтобы
 * состояние на экране не расходилось с базой.
 */

const GeneratedModelViewer = dynamic(
  () =>
    import("@/components/generator/GeneratedModelViewer").then(
      (module) => module.GeneratedModelViewer,
    ),
  {
    ssr: false,
    loading: () => <PreviewPlaceholder message="Загружаем превью…" />,
  },
);

/** Куда вести гостя, если страница не передала свой адрес возврата. */
const FALLBACK_LOGIN_HREF = "/auth/login?next=%2Fgallery";

function PreviewPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center">
      <p className="max-w-xs text-sm leading-relaxed text-slate-400">{message}</p>
    </div>
  );
}

type GenerationCardProps = {
  generation: GenerationCardData;
  /** Гость галереи: превью открыто, скачивание закрыто. */
  locked?: boolean;
  /** «Мои модели»: переключатель «Показывать в галерее». */
  manage?: boolean;
  /** Куда ведёт кнопка входа для гостя. */
  loginHref?: string;
};

export function GenerationCard({
  generation,
  locked = false,
  manage = false,
  loginHref = FALLBACK_LOGIN_HREF,
}: GenerationCardProps) {
  const [isPublic, setIsPublic] = useState(generation.isPublic);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const serviceLabel = generationServiceLabel(generation.service);

  function handleVisibilityChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.checked;

    setError(null);
    setIsPublic(next);

    startTransition(async () => {
      const result = await setGenerationVisibility({
        id: generation.id,
        isPublic: next,
      });

      if (!result.ok) {
        // Возвращаем флажок: база не приняла значение, и экран не должен врать.
        setIsPublic(!next);
        setError(result.error);
      }
    });
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0a0a] shadow-xl transition-colors hover:border-white/20">
      <div className="relative h-64 border-b border-white/5 bg-[#0b1120]">
        {generation.previewUrl ? (
          <GeneratedModelViewer url={generation.previewUrl} />
        ) : (
          <PreviewPlaceholder message="Превью временно недоступно. Модель можно скачать кнопкой ниже." />
        )}

        <span className="absolute top-3 left-3 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 backdrop-blur">
          {serviceLabel}
        </span>

        {manage && isPublic ? (
          <span className="absolute top-3 right-3 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 backdrop-blur">
            В галерее
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
          Создана
        </p>
        <p className="mt-1 text-sm font-semibold text-zinc-200">
          {generation.createdAtLabel}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          {serviceLabel} · STL, 120 мм по большему габариту
        </p>

        <div className="mt-auto pt-4">
          {locked ? (
            <>
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] focus-visible:outline-none"
                href={loginHref}
              >
                <span aria-hidden>🔒</span>
                Войти, чтобы скачать
              </Link>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-zinc-500">
                Скачивание STL доступно только после входа. Модель останется в
                галерее.
              </p>
            </>
          ) : (
            <a
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-blue-500 px-4 text-sm font-extrabold text-white shadow-lg shadow-fuchsia-500/20 transition-colors hover:from-fuchsia-400 hover:to-blue-400 focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] focus-visible:outline-none"
              download={`tridi-${generation.id}.stl`}
              href={generationStlHref(generation.id)}
            >
              <span aria-hidden>↓</span>
              Скачать STL
            </a>
          )}

          {manage ? (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
              <input
                checked={isPublic}
                className="mt-0.5 size-4 accent-emerald-400"
                disabled={isPending}
                onChange={handleVisibilityChange}
                type="checkbox"
              />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-zinc-200">
                  Показывать в галерее
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500">
                  {isPending
                    ? "Сохраняем…"
                    : isPublic
                      ? "Модель видят все, скачать может любой вошедший"
                      : "Модель видите только вы"}
                </span>
              </span>
            </label>
          ) : null}

          {error ? (
            <p className="mt-2 text-xs text-rose-200" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

