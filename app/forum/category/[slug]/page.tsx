import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Header } from "@/components/Header";
import {
  formatForumDate,
  forumAuthorName,
  forumExcerpt,
  getApprovedReplyCounts,
  getApprovedThreadsByCategory,
  getForumAuthors,
  getForumCategoryBySlug,
  pluralizeForumCount,
} from "@/lib/forum";
import { resolveSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

/** Страница читает cookies в шапке и свежие темы — без статики. */
export const dynamic = "force-dynamic";

const THREAD_FORMS = ["тема", "темы", "тем"] as const;
const REPLY_FORMS = ["ответ", "ответа", "ответов"] as const;

/** Иконка раздела: в базе слаги сгруппированы по темам. */
function categoryIcon(slug: string): string {
  if (slug.startsWith("printers")) return "🖨️";
  if (slug.startsWith("materials")) return "🧵";
  if (slug.startsWith("problems")) return "🛠️";
  if (slug === "general-business") return "💼";
  if (slug === "general-modeling") return "📐";
  return "💬";
}

/** Метаданные строим по существующей категории; неизвестный slug закрыт от индекса. */
export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const category = await getForumCategoryBySlug(supabase, slug);

  if (!category) {
    return {
      title: "Раздел не найден — форум TriDi",
      robots: { index: false, follow: false },
    };
  }

  const description =
    category.description ||
    `Обсуждения в разделе «${category.title}» на форуме сообщества TriDi.`;

  return {
    title: `${category.title} — форум TriDi`,
    description,
    alternates: { canonical: `/forum/category/${category.slug}` },
    openGraph: {
      type: "website",
      title: `${category.title} — форум TriDi`,
      description,
      url: `/forum/category/${category.slug}`,
    },
    twitter: {
      card: "summary",
      title: `${category.title} — форум TriDi`,
      description,
    },
  };
}

/**
 * Публичная страница раздела форума.
 *
 * RLS отдаёт только approved-темы и ответы, поэтому pending-материалы не
 * попадают ни в список, ни в счётчики. Создание темы доступно после входа:
 * параметр category в адресе лишь подставляет раздел в форму.
 */
export default async function ForumCategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const category = await getForumCategoryBySlug(supabase, slug);

  if (!category) {
    notFound();
  }

  const threads = await getApprovedThreadsByCategory(supabase, category.id);
  const [names, replyCounts, siteUrl] = await Promise.all([
    getForumAuthors(
      supabase,
      threads.map((thread) => thread.author_id),
    ),
    getApprovedReplyCounts(
      supabase,
      threads.map((thread) => thread.id),
    ),
    resolveSiteUrl(),
  ]);

  const categoryUrl = `${siteUrl}/forum/category/${category.slug}`;
  const createThreadHref = `/forum/new?category=${encodeURIComponent(category.slug)}`;
  const description =
    category.description ||
    `Обсуждения в разделе «${category.title}» на форуме сообщества TriDi.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Форум",
            item: `${siteUrl}/forum`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: category.title,
            item: categoryUrl,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        name: `${category.title} — форум TriDi`,
        description,
        url: categoryUrl,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: threads.length,
          itemListElement: threads.slice(0, 20).map((thread, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: thread.title,
            url: `${siteUrl}/forum/${thread.slug}`,
          })),
        },
      },
    ],
  };

  return (
    <div className="min-h-screen text-slate-100">
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-blue-600/20 blur-3xl"
          />

          <div className="relative mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <nav aria-label="Хлебные крошки" className="text-sm text-slate-300">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <Link
                    href="/forum"
                    className="transition-colors hover:text-blue-400"
                  >
                    Форум
                  </Link>
                </li>
                <li aria-hidden>→</li>
                <li className="text-slate-300" aria-current="page">
                  {category.title}
                </li>
              </ol>
            </nav>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-2xl"
                  >
                    {categoryIcon(category.slug)}
                  </span>
                  <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
                    Раздел форума
                  </p>
                </div>

                <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                  {category.title}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                  {description}
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  {threads.length}{" "}
                  {pluralizeForumCount(threads.length, THREAD_FORMS)} в разделе
                </p>
              </div>

              <Link
                href={createThreadHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Создать тему
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="category-threads"
          className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="category-threads"
                className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
              >
                Темы раздела
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Опубликованные материалы, свежие сверху.
              </p>
            </div>
          </div>


          {threads.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-slate-950/40 px-6 py-12 text-center sm:py-16">
              <span
                aria-hidden
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-blue-400/30 bg-blue-500/10 text-3xl"
              >
                {categoryIcon(category.slug)}
              </span>
              <p className="mx-auto mt-5 max-w-2xl text-xl font-bold text-white sm:text-2xl">
                В этом разделе пока нет тем. Станьте первым, кто задаст вопрос!
              </p>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-300">
                Опишите принтер, материал, слайсер и настройки. После проверки
                тема появится в этом разделе.
              </p>
              <Link
                href={createThreadHref}
                className="mt-6 inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-blue-600 px-8 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Создать тему в этом разделе
                <span aria-hidden>→</span>
              </Link>
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/50">
              {threads.map((thread) => {
                const replies = replyCounts.get(thread.id) ?? 0;

                return (
                  <li key={thread.id}>
                    <article className="p-5 transition-colors hover:bg-white/[0.04] sm:p-6">
                      <h3 className="text-lg leading-snug font-bold text-white sm:text-xl">
                        <Link
                          href={`/forum/${thread.slug}`}
                          className="transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        >
                          {thread.title}
                        </Link>
                      </h3>

                      <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-300">
                        {forumExcerpt(thread.content, 220)}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300">
                        <span>
                          Автор:{" "}
                          <span className="text-slate-300">
                            {forumAuthorName(names, thread.author_id)}
                          </span>
                        </span>
                        <span aria-hidden>·</span>
                        <time dateTime={thread.created_at}>
                          {formatForumDate(thread.created_at)}
                        </time>
                        <span aria-hidden>·</span>
                        <span>
                          {replies}{" "}
                          {pluralizeForumCount(replies, REPLY_FORMS)}
                        </span>
                        <span aria-hidden>·</span>
                        <span>{thread.views} просмотров</span>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-8">
            <Link
              href="/forum"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400"
            >
              <span aria-hidden>←</span> Назад ко всем разделам
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

