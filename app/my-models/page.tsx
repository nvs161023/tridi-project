import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Header } from "@/components/Header";
import { GenerationCard } from "@/components/generator/GenerationCard";
import { authHref } from "@/lib/auth-redirect";
import { resolveUserId } from "@/lib/current-user";
import {
  attachGenerationPreviews,
  getMyGenerations,
} from "@/lib/generator/generation-store";
import { GENERATIONS_LIMIT } from "@/lib/generator/generations";
import { createClient } from "@/lib/supabase/server";

/**
 * «Мои модели» — история генераций 3D по фото.
 *
 * Страница закрыта сессией: middleware уводит гостя на вход, а сама страница
 * повторно проверяет пользователя (запрос мог пройти мимо прослойки). Список
 * читается клиентом пользователя, поэтому RLS отдаёт только его строки.
 *
 * Превью — подписанные ссылки на закрытый бакет `generated-models`: сам файл
 * в открытом доступе не лежит. Публикация в галерее включается на карточке и
 * сохраняется Server Action.
 */

const PAGE_PATH = "/my-models";

export const metadata: Metadata = {
  title: "Мои 3D-модели",
  description:
    "История генераций 3D-моделей по фото: предпросмотр, скачивание STL и публикация в галерее.",
  robots: { index: false, follow: false },
};

/** Список читает cookies и базу — собираем страницу на каждый запрос. */
export const dynamic = "force-dynamic";

/** Пустое состояние: объясняет, откуда берутся модели. */
function EmptyState() {
  return (
    <section className="mt-6 rounded-[1.75rem] border border-white/[0.07] bg-[#0a0a0a]/70 p-6 text-center backdrop-blur-xl sm:p-10">
      <p aria-hidden className="text-3xl">
        🧊
      </p>
      <h2 className="mt-3 text-lg font-extrabold tracking-tight text-white sm:text-xl">
        Здесь появятся ваши модели
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
        Загрузите 1–4 фото предмета в генератор: сеть соберёт модель, мы очистим
        сетку и сохраним STL в истории. Готовую модель можно скачать и
        опубликовать в галерее.
      </p>
      <Link
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-blue-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-fuchsia-500/20 transition-colors hover:from-fuchsia-400 hover:to-blue-400 focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
        href="/3d-generator"
      >
        Сгенерировать 3D из фото
        <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

export default async function MyModelsPage() {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(authHref("/auth/login", PAGE_PATH));
  }

  const generations = await attachGenerationPreviews(
    await getMyGenerations(supabase, userId),
  );

  return (
    <div className="min-h-screen text-zinc-100">
      <Header />

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
            href="/dashboard"
          >
            <span aria-hidden>←</span>
            Личный кабинет
          </Link>
          <Link
            className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
            href="/gallery"
          >
            Открыть галерею
            <span aria-hidden>→</span>
          </Link>
        </div>

        <header className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#0a0a0a]/75 px-5 py-7 shadow-[0_40px_120px_-60px_rgba(0,0,0,1)] backdrop-blur-xl sm:px-8 sm:py-9">
          <p className="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            История генераций
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Мои 3D-модели
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
            Все модели, которые вы собрали из фото. Опубликованные видны в
            галерее и доступны для скачивания любому вошедшему, скрытые — только
            вам.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            Показаны последние {GENERATIONS_LIMIT} моделей. Файлы хранятся в
            закрытом бакете и отдаются только после проверки сессии.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Категорию можно сменить на карточке — по ней модель фильтруется в
            галерее.
          </p>
        </header>

        {generations.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {generations.map((generation) => (
              <li key={generation.id}>
                <GenerationCard generation={generation} manage />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
