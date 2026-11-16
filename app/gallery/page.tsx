import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import { GalleryCategoryFilter } from "@/components/gallery/GalleryCategoryFilter";
import { GenerationCard } from "@/components/generator/GenerationCard";
import { authHref } from "@/lib/auth-redirect";
import { resolveUserId } from "@/lib/current-user";
import {
  generationCategoryLabel,
  parseGenerationCategory,
} from "@/lib/generator/categories";
import {
  attachGenerationPreviews,
  getPublicGenerations,
} from "@/lib/generator/generation-store";
import { createClient } from "@/lib/supabase/server";

/**
 * Публичная галерея: модели, которые пользователи сами решили показать.
 *
 * Ленту собирает сервер служебным клиентом: браузеру колонки `stl_url` и
 * `user_id` не выдаются, а фильтр `is_public` остаётся здесь. Превью доступно
 * всем — это подписанная ссылка на час. Скачивание остаётся под входом: гость
 * видит кнопку «Войти, чтобы скачать», которая ведёт на
 * /auth/login?next=/gallery. Роут `/api/generations/<id>/stl` проверяет сессию
 * ещё раз, поэтому прямой запрос мимо интерфейса тоже не отдаст файл.
 *
 * Категория — параметр адреса (`?category=toy`), а не состояние клиента:
 * фильтр применяется в запросе к базе (`.eq('category', …)`), поэтому лента не
 * тянет из Supabase модели других категорий, а ссылку можно сохранить.
 *
 * Страница собирается на каждый запрос: лента меняется после публикации, а
 * подписанные ссылки нельзя кэшировать дольше часа.
 */

const PAGE_PATH = "/gallery";

type GalleryPageProps = {
  /** Категория из адреса: `?category=toy`. Приходит промисом в Next 15. */
  searchParams: Promise<{ category?: string }>;
};

export const metadata: Metadata = {
  title: "Галерея 3D-моделей",
  description:
    "Модели, созданные в 3D-генераторе по фото: посмотрите результат и скачайте STL после входа.",
};

export const dynamic = "force-dynamic";

/** Пустое состояние публичной ленты. */
function EmptyState({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="mt-6 rounded-[1.75rem] border border-white/[0.07] bg-[#0a0a0a]/70 p-6 text-center backdrop-blur-xl sm:p-10">
      <p aria-hidden className="text-3xl">
        ✨
      </p>
      <h2 className="mt-3 text-lg font-extrabold tracking-tight text-white sm:text-xl">
        В галерее пока пусто
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
        {signedIn
          ? "Сгенерируйте модель из фото и включите «Показывать в галерее» в «Моих моделях» — она появится здесь."
          : "Модели появятся, когда авторы опубликуют их из личного кабинета. Свою можно собрать в генераторе по фото."}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-blue-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-fuchsia-500/20 transition-colors hover:from-fuchsia-400 hover:to-blue-400 focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
          href="/3d-generator"
        >
          Сгенерировать 3D из фото
          <span aria-hidden>→</span>
        </Link>
        {signedIn ? (
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
            href="/my-models"
          >
            Мои модели
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Пустая категория: лента есть, но в этой вкладке моделей нет.
 *
 * Отдельный текст нужен, чтобы не пугать посетителя «пустой галереей»: другие
 * категории могут быть заполнены, и ссылка возвращает к общей ленте.
 */
function EmptyCategoryState({ category }: { category: string }) {
  return (
    <section className="mt-6 rounded-[1.75rem] border border-white/[0.07] bg-[#0a0a0a]/70 p-6 text-center backdrop-blur-xl sm:p-10">
      <p aria-hidden className="text-3xl">
        🔎
      </p>
      <h2 className="mt-3 text-lg font-extrabold tracking-tight text-white sm:text-xl">
        В категории «{generationCategoryLabel(category)}» пока пусто
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
        Модели других категорий никуда не делись — вернитесь к общей ленте или
        сгенерируйте свою и выберите эту категорию в генераторе.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
          href="/gallery"
        >
          Показать все модели
        </Link>
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-blue-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-fuchsia-500/20 transition-colors hover:from-fuchsia-400 hover:to-blue-400 focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
          href="/3d-generator"
        >
          Сгенерировать 3D из фото
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}

export default async function GalleryPage({ searchParams }: GalleryPageProps) {
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);
  const signedIn = Boolean(userId);

  // Незнакомое значение в адресе читается как «Все»: чужую ссылку с опечаткой
  // страница не должна превращать в пустую ленту.
  const category = parseGenerationCategory((await searchParams).category);

  const generations = await attachGenerationPreviews(
    await getPublicGenerations(category),
  );

  const loginHref = authHref("/auth/login", PAGE_PATH);

  return (
    <div className="min-h-screen text-zinc-100">
      <Header />

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
            href="/"
          >
            <span aria-hidden>←</span>
            На главную
          </Link>
          {signedIn ? (
            <Link
              className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
              href="/my-models"
            >
              Мои модели
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <Link
              className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-zinc-400 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030303] focus-visible:outline-none"
              href={loginHref}
            >
              Войти
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>

        <header className="relative mt-6 overflow-hidden rounded-[2rem] border border-white/[0.07] bg-[#0a0a0a]/75 px-5 py-7 shadow-[0_40px_120px_-60px_rgba(0,0,0,1)] backdrop-blur-xl sm:px-8 sm:py-9">
          <p className="text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
            Работы сообщества
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Галерея 3D-моделей
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
            Модели, которые авторы собрали из фотографий и решили показать.
            Покрутите превью и скачайте STL для слайсера — скачивание открыто
            после входа.
          </p>
          {signedIn ? null : (
            <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
              <span aria-hidden>🔒</span>
              Просмотр открыт всем, скачивание STL — после входа.
              <Link
                className="font-semibold text-amber-50 underline underline-offset-2 hover:text-white"
                href={loginHref}
              >
                Войти
              </Link>
            </p>
          )}
        </header>

        <GalleryCategoryFilter active={category} />

        {generations.length === 0 ? (
          category ? (
            <EmptyCategoryState category={category} />
          ) : (
            <EmptyState signedIn={signedIn} />
          )
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {generations.map((generation) => (
              <li key={generation.id}>
                <GenerationCard
                  generation={generation}
                  locked={!signedIn}
                  loginHref={loginHref}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

