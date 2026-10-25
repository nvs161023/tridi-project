import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReplyForm } from "@/components/forum/ReplyForm";
import { Header } from "@/components/Header";
import { authHref } from "@/lib/auth-redirect";
import {
  formatForumDateTime,
  forumAuthorName,
  forumExcerpt,
  getApprovedReplies,
  getApprovedThreadBySlug,
  getForumAuthors,
} from "@/lib/forum";
import {
  checkForumBan,
  formatForumBanMessage,
} from "@/lib/forum-moderation";
import { resolveSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

type ThreadPageProps = {
  params: Promise<{ slug: string }>;
};

/** Тема зависит от cookies (кнопка входа) и свежих ответов — без статики. */
export const dynamic = "force-dynamic";

/** Метаданные строим по одобренной теме; pending и rejected сюда не попадают. */
export async function generateMetadata({
  params,
}: ThreadPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const threadPage = await getApprovedThreadBySlug(supabase, slug);

  if (!threadPage) {
    return {
      title: "Тема не найдена — форум TriDi",
      robots: { index: false, follow: false },
    };
  }

  const { thread, category } = threadPage;
  const authors = await getForumAuthors(supabase, [thread.author_id]);
  const description = forumExcerpt(thread.content, 158);

  return {
    title: `${thread.title} — форум TriDi`,
    description,
    alternates: { canonical: `/forum/${thread.slug}` },
    openGraph: {
      type: "article",
      title: thread.title,
      description,
      url: `/forum/${thread.slug}`,
      publishedTime: thread.created_at,
      authors: [forumAuthorName(authors, thread.author_id)],
      section: category?.title,
    },
    twitter: {
      card: "summary",
      title: thread.title,
      description,
    },
  };
}

/**
 * Публичная страница темы.
 *
 * Данные читаются клиентом пользователя: RLS отдаёт approved-тему и approved-
 * ответы всем, а pending-ответы — только их автору (мы их здесь не показываем).
 * Форма ответа появляется только для вошедшего пользователя, но окончательное
 * решение всё равно принимает Server Action: проверка в разметке — лишь UX.
 */
export default async function ForumThreadPage({ params }: ThreadPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const threadPage = await getApprovedThreadBySlug(supabase, slug);

  if (!threadPage) {
    notFound();
  }

  const { thread, category } = threadPage;
  const replies = await getApprovedReplies(supabase, thread.id);
  const names = await getForumAuthors(supabase, [
    thread.author_id,
    ...replies.map((reply) => reply.author_id),
  ]);

  // getUser проверяет токен на сервере. Это подсказка для интерфейса, а не
  // проверка прав: createReply вызовет getUser() заново.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;
  const ban = userId ? await checkForumBan(supabase, userId) : null;

  const siteUrl = await resolveSiteUrl();
  const threadUrl = `${siteUrl}/forum/${thread.slug}`;
  const authorName = forumAuthorName(names, thread.author_id);

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
            name: thread.title,
            item: threadUrl,
          },
        ],
      },
      {
        "@type": "DiscussionForumPosting",
        headline: thread.title,
        text: thread.content,
        url: threadUrl,
        datePublished: thread.created_at,
        author: { "@type": "Person", name: authorName },
        interactionStatistic: {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/CommentAction",
          userInteractionCount: replies.length,
        },
        comment: replies.map((reply) => ({
          "@type": "Comment",
          text: reply.content,
          dateCreated: reply.created_at,
          author: {
            "@type": "Person",
            name: forumAuthorName(names, reply.author_id),
          },
        })),
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

      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <Link
          href="/forum"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>←</span> Назад ко всем разделам
        </Link>

        <nav aria-label="Хлебные крошки" className="mt-5 text-sm text-slate-300">
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
            <li className="text-slate-300">
              {category ? (
                <Link
                  href={`/forum/category/${category.slug}`}
                  className="transition-colors hover:text-blue-400"
                >
                  {category.title}
                </Link>
              ) : (
                "Тема"
              )}
            </li>
          </ol>
        </nav>

        <article className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 font-semibold text-blue-200">
              {category?.title ?? "Форум"}
            </span>
            <time dateTime={thread.created_at} className="text-slate-300">
              {formatForumDateTime(thread.created_at)}
            </time>
          </div>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {thread.title}
          </h1>

          <p className="mt-3 text-sm text-slate-300">
            Автор: <span className="text-slate-200">{authorName}</span>
          </p>

          <div className="mt-6 border-t border-white/10 pt-6">
            <p className="text-base leading-relaxed whitespace-pre-line text-slate-200">
              {thread.content}
            </p>
          </div>
        </article>

        <section aria-labelledby="thread-replies" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2
              id="thread-replies"
              className="text-xl font-extrabold tracking-tight text-white sm:text-2xl"
            >
              Ответы
              {replies.length > 0 ? (
                <span className="ml-2 text-base font-semibold text-slate-300">
                  {replies.length}
                </span>
              ) : null}
            </h2>
            <Link
              href="/forum/rules"
              className="text-sm font-medium text-slate-300 transition-colors hover:text-blue-400"
            >
              Правила форума
            </Link>
          </div>

          {replies.length === 0 ? (
            <p className="mt-4 rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm leading-relaxed text-slate-300">
              Ответов пока нет. Если знаете решение — напишите: это поможет не
              только автору темы.
            </p>
          ) : (
            <ol className="mt-4 space-y-4">
              {replies.map((reply) => (
                <li
                  key={reply.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-semibold text-blue-200">
                      {forumAuthorName(names, reply.author_id)}
                    </span>
                    <time
                      dateTime={reply.created_at}
                      className="text-slate-300"
                    >
                      {formatForumDateTime(reply.created_at)}
                    </time>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-200">
                    {reply.content}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>


        <section
          aria-labelledby="thread-reply"
          className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8"
        >
          <h2
            id="thread-reply"
            className="text-xl font-extrabold tracking-tight text-white"
          >
            Ответить в теме
          </h2>

          {ban ? (
            <p
              role="alert"
              className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-200"
            >
              {formatForumBanMessage(ban)}
            </p>
          ) : userId ? (
            <ReplyForm threadId={thread.id} />
          ) : (
            <div className="mt-4">
              <p className="text-sm leading-relaxed text-slate-300">
                Чтобы ответить, войдите в аккаунт TriDi. Читать форум можно без
                регистрации.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={authHref("/auth/login", `/forum/${thread.slug}`)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Войти
                </Link>
                <Link
                  href={authHref("/auth/sign-up", `/forum/${thread.slug}`)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Зарегистрироваться
                </Link>
              </div>
            </div>
          )}
        </section>

        <div className="mt-8">
          <Link
            href="/forum"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400"
          >
            <span aria-hidden>←</span> Назад ко всем разделам
          </Link>
        </div>
      </main>
    </div>
  );
}

