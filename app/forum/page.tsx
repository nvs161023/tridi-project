import type { Metadata } from "next";
import Link from "next/link";

import { Header } from "@/components/Header";
import {
  formatForumDate,
  forumAuthorName,
  forumExcerpt,
  getApprovedThreads,
  getForumAuthors,
  getForumCategories,
} from "@/lib/forum";
import { resolveSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Форум сообщества — TriDi",
  description:
    "Сообщество 3D-печати TriDi: выбор принтера, материалы, настройки слайсера и решение проблем печати. Читать может каждый, писать — после входа.",
  alternates: { canonical: "/forum" },
};

/** Страница читает сессию и свежие темы — собираем её на каждый запрос. */
export const dynamic = "force-dynamic";

const CATEGORY_ICONS: Record<string, string> = {
  printers: "🖨️",
  materials: "🧵",
  problems: "🛠️",
  general: "💬",
};

const THREAD_FORMS = ["тема", "темы", "тем"] as const;

/** Русская форма слова по числу. */
function pluralize(count: number, forms: readonly [string, string, string]) {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/**
 * Публичный форум.
 *
 * RLS отдаёт только approved-темы, поэтому страница безопасна и для гостя, и
 * для поискового робота: pending-материалы сюда не попадают. Авторизация нужна
 * только для создания темы и ответов.
 */
export default async function ForumPage() {
  const supabase = await createClient();
  const [categories, threads, siteUrl] = await Promise.all([
    getForumCategories(supabase),
    getApprovedThreads(supabase),
    resolveSiteUrl(),
  ]);

  const names = await getForumAuthors(
    supabase,
    threads.map((thread) => thread.author_id),
  );
  const categoryTitles = new Map(
    categories.map((category) => [category.id, category.title]),
  );
  const threadCounts = new Map<string, number>();

  for (const thread of threads) {
    threadCounts.set(
      thread.category_id,
      (threadCounts.get(thread.category_id) ?? 0) + 1,
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Форум сообщества TriDi",
    description:
      "Обсуждения 3D-печати: принтеры, материалы, настройки и решение проблем.",
    url: `${siteUrl}/forum`,
    hasPart: threads.slice(0, 20).map((thread) => ({
      "@type": "DiscussionForumPosting",
      headline: thread.title,
      url: `${siteUrl}/forum/${thread.slug}`,
      datePublished: thread.created_at,
      author: {
        "@type": "Person",
        name: forumAuthorName(names, thread.author_id),
      },
    })),
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
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
          <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
            <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
              Сообщество TriDi
            </p>
            <h1 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Форум о 3D-печати
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Задавайте вопросы, показывайте результаты и помогайте другим.
              Читать может каждый, писать — только после входа. Все материалы
              проходят модерацию.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/forum/new"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Создать тему
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/forum/rules"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Правила форума
              </Link>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="forum-categories"
          className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16"
        >
          <h2
            id="forum-categories"
            className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
          >
            Разделы
          </h2>

          {categories.length === 0 ? (
            <p className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-slate-400">
              Разделы ещё не настроены. Если вы администратор, добавьте записи в
              таблицу forum_categories — после этого форма создания темы станет
              доступной.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {categories.map((category) => {
                const count = threadCounts.get(category.id) ?? 0;

                return (
                  <article
                    key={category.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-blue-400/30"
                  >
                    <div className="flex items-start gap-4">
                      <span
                        aria-hidden
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-xl"
                      >
                        {CATEGORY_ICONS[category.slug] ?? "💬"}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-white">
                          {category.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-400">
                          {category.description}
                        </p>
                        <p className="mt-3 text-xs font-semibold tracking-wide text-blue-300 uppercase">
                          {count} {pluralize(count, THREAD_FORMS)}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>


        <section
          aria-labelledby="forum-threads"
          className="border-t border-white/10 bg-white/[0.02]"
        >
          <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="forum-threads"
                  className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
                >
                  Последние темы
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Опубликованные материалы сообщества, свежие сверху.
                </p>
              </div>
              <Link
                href="/forum/rules"
                className="text-sm font-medium text-slate-400 transition-colors hover:text-blue-400"
              >
                Как проходит модерация
              </Link>
            </div>

            {threads.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-8 text-center">
                <p className="text-base font-semibold text-white">
                  Пока нет опубликованных тем
                </p>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                  Станьте первым: задайте вопрос о принтере, пластике или
                  настройках. После проверки тема появится здесь.
                </p>
                <Link
                  href="/forum/new"
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                >
                  Создать тему
                  <span aria-hidden>→</span>
                </Link>
              </div>
            ) : (
              <ul className="mt-6 divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/50">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <article className="p-5 transition-colors hover:bg-white/[0.04] sm:p-6">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 font-semibold text-blue-200">
                          {categoryTitles.get(thread.category_id) ?? "Форум"}
                        </span>
                        <span className="text-slate-500">
                          {formatForumDate(thread.created_at)}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg leading-snug font-bold text-white sm:text-xl">
                        <Link
                          href={`/forum/${thread.slug}`}
                          className="transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        >
                          {thread.title}
                        </Link>
                      </h3>

                      <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-400">
                        {forumExcerpt(thread.content, 220)}
                      </p>

                      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span>{forumAuthorName(names, thread.author_id)}</span>
                        <span aria-hidden>·</span>
                        <span>{thread.views} просмотров</span>
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>


        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Войдите в аккаунт",
                text: "Читать форум можно без входа. Для создания темы нужна учётная запись TriDi.",
              },
              {
                step: "02",
                title: "Опишите вопрос",
                text: "Укажите принтер, пластик, слайсер и настройки. Чем больше деталей, тем полезнее ответы.",
              },
              {
                step: "03",
                title: "Дождитесь проверки",
                text: "Материал появится в публичном списке после модерации. Ответы проверяются так же.",
              },
            ].map((item) => (
              <article
                key={item.step}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <p
                  aria-hidden
                  className="text-2xl font-extrabold tracking-tight text-blue-400/70"
                >
                  {item.step}
                </p>
                <h2 className="mt-3 text-base font-bold text-white">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

