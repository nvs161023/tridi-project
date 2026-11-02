import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import { formatPostDate, getAllPosts } from "@/lib/blog";
import { OG_IMAGE } from "@/lib/seo";

const PAGE_TITLE = "Блог о 3D-печати: ошибки, слайсеры, настройки";
const PAGE_DESCRIPTION =
  "Статьи TriDi о 3D-печати: разбор ошибок принтеров, настройки Bambu Studio и других слайсеров, материалы и практика без брака.";
const PAGE_IMAGE_ALT = "Блог TriDi о 3D-печати";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/blog" },
  // Карточка для мессенджеров повторяет заголовок и описание страницы, картинку
  // 1200×630 Next.js подставляет из OG_IMAGE через metadataBase в корневом layout.
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "TriDi",
    url: "/blog",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        ...OG_IMAGE,
        alt: PAGE_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE.url,
        alt: PAGE_IMAGE_ALT,
      },
    ],
  },
};

/** Шапка читает cookies, поэтому страница собирается на каждый запрос. */
export const dynamic = "force-dynamic";

/**
 * Список статей блога.
 *
 * Статьи читаются с диска через lib/blog: свежие сверху, дата и время чтения —
 * под заголовком. Пустой список — не ошибка: раздел только заводится, и
 * страница должна открываться, пока не опубликована первая статья.
 */
export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen text-slate-100">
      <Header />

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl"
          />

          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
              Блог TriDi
            </p>

            <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Разборы, которые экономят пластик и нервы
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              Ошибки принтеров, настройки слайсеров, материалы и первые слои —
              по шагам, с причинами и без общих слов.
            </p>

            <p className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300 sm:text-sm">
              {posts.length > 0
                ? `Статей в блоге: ${posts.length}`
                : "Первая статья готовится к публикации"}
            </p>
          </div>
        </section>

        <section aria-labelledby="blog-list-title" className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
            <h2
              id="blog-list-title"
              className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            >
              Все статьи
            </h2>

            {posts.length === 0 ? (
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300">
                Пока пусто. Подпишитесь на обновления в форуме — о новых разборах
                сообщаем там.
              </p>
            ) : (
              <ul className="mt-8 grid gap-5 md:grid-cols-2">
                {posts.map((post) => (
                  <li key={post.slug} className="h-full">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition duration-200 hover:-translate-y-1 hover:border-blue-400/30 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:p-7"
                    >
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-400">
                        <time dateTime={post.date}>
                          {formatPostDate(post.date)}
                        </time>
                        <span aria-hidden>•</span>
                        <span>{post.readingMinutes} мин чтения</span>
                      </span>

                      <span className="mt-4 block text-xl font-bold tracking-tight text-white sm:text-2xl">
                        {post.title}
                      </span>

                      <span className="mt-3 block flex-1 text-base leading-relaxed text-slate-200">
                        {post.description}
                      </span>

                      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-400 transition-colors group-hover:text-blue-300">
                        Читать статью
                        <span
                          aria-hidden
                          className="transition-transform duration-200 group-hover:translate-x-1"
                        >
                          →
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
