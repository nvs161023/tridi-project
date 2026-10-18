import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  BanAuthorForm,
  DeleteReplyButton,
  DeleteThreadButton,
  LiftBanButton,
  ModerationButton,
} from "@/components/forum/admin/ModerationControls";
import { Header } from "@/components/Header";
import {
  approveReply,
  approveThread,
  rejectReply,
  rejectThread,
} from "@/app/actions/forum-admin";
import { isAdminEmail } from "@/lib/admin";
import {
  formatForumDateTime,
  forumExcerpt,
} from "@/lib/forum";
import { formatForumBanUntil } from "@/lib/forum-moderation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Модерация форума — TriDi",
  description: "Очередь тем и ответов форума TriDi.",
  robots: { index: false, follow: false },
};

/** Очередь меняется после каждого действия — без кэша. */
export const dynamic = "force-dynamic";

type PendingThread = {
  id: string;
  title: string;
  content: string;
  author_id: string;
  category_id: string;
  created_at: string;
};

type PublishedThread = {
  id: string;
  slug: string;
  title: string;
  content: string;
  author_id: string;
  category_id: string;
  created_at: string;
};

type ReplyRow = {
  id: string;
  content: string;
  author_id: string;
  thread_id: string;
  created_at: string;
};

type ThreadRef = {
  id: string;
  slug: string;
  title: string;
};

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
};

type BanRow = {
  id: string;
  user_id: string;
  reason: string;
  expires_at: string | null;
  created_at: string;
};

/** Имя для админ-панели: имя, иначе email, иначе нейтральная подпись. */
function authorLabel(profiles: Map<string, ProfileRow>, id: string): string {
  const profile = profiles.get(id);
  const name = profile?.name?.trim();

  if (name) return name;
  if (profile?.email) return profile.email;
  return `Участник ${id.slice(0, 8)}`;
}

/** Показываем только действующие баны: null — бессрочный. */
function isActiveBan(ban: BanRow): boolean {
  if (!ban.expires_at) return true;

  const date = new Date(ban.expires_at);

  return !Number.isNaN(date.getTime()) && date > new Date();
}

/**
 * Админ-панель форума.
 *
 * Проверка доступа: реальная сессия Supabase + email из ADMIN_EMAIL. Только
 * после этого создаётся service_role-клиент: он нужен, чтобы видеть pending и
 * менять статусы, которые закрыты RLS для обычных пользователей.
 *
 * Баны читаются и пишутся только в forum_bans. Никаких обращений к
 * subscriptions/purchases здесь нет: модерация форума не влияет на курсы.
 */
export default async function AdminForumPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    notFound();
  }

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Header />
        <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <h1 className="text-3xl font-extrabold text-white">
            Админ-панель недоступна
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Не задан SUPABASE_SERVICE_ROLE_KEY. Без него нельзя читать очередь
            модерации и менять статусы. Добавьте ключ в переменные окружения.
          </p>
          <Link
            href="/forum"
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white"
          >
            Вернуться на форум
          </Link>
        </main>
      </div>
    );
  }

  const [
    threadsResult,
    publishedThreadsResult,
    pendingRepliesResult,
    publishedRepliesResult,
    categoriesResult,
    bansResult,
  ] = await Promise.all([
    admin
      .from("forum_threads")
      .select("id, title, content, author_id, category_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50),
    admin
      .from("forum_threads")
      .select("id, slug, title, content, author_id, category_id, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("forum_replies")
      .select("id, content, author_id, thread_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50),
    admin
      .from("forum_replies")
      .select("id, content, author_id, thread_id, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50),
    admin.from("forum_categories").select("id, title").order("order"),
    admin
      .from("forum_bans")
      .select("id, user_id, reason, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const pendingThreads = (threadsResult.data ?? []) as PendingThread[];
  const publishedThreads = (publishedThreadsResult.data ??
    []) as PublishedThread[];
  const pendingReplies = (pendingRepliesResult.data ?? []) as ReplyRow[];
  const publishedReplies = (publishedRepliesResult.data ?? []) as ReplyRow[];
  const categories = (categoriesResult.data ?? []) as {
    id: string;
    title: string;
  }[];
  const bans = (bansResult.data ?? []) as BanRow[];
  const loadError = Boolean(
    threadsResult.error ||
      publishedThreadsResult.error ||
      pendingRepliesResult.error ||
      publishedRepliesResult.error ||
      categoriesResult.error ||
      bansResult.error,
  );

  const categoryTitles = new Map(
    categories.map((category) => [category.id, category.title]),
  );

  const replyThreadIds = [
    ...new Set(
      [...pendingReplies, ...publishedReplies].map((reply) => reply.thread_id),
    ),
  ];
  const { data: threadRefs } = replyThreadIds.length
    ? await admin
        .from("forum_threads")
        .select("id, slug, title")
        .in("id", replyThreadIds)
    : { data: [] as ThreadRef[] };

  const threadRefsById = new Map(
    ((threadRefs ?? []) as ThreadRef[]).map((thread) => [thread.id, thread]),
  );

  const profileIds = [
    ...new Set([
      ...pendingThreads.map((thread) => thread.author_id),
      ...publishedThreads.map((thread) => thread.author_id),
      ...pendingReplies.map((reply) => reply.author_id),
      ...publishedReplies.map((reply) => reply.author_id),
      ...bans.map((ban) => ban.user_id),
    ]),
  ];

  const { data: profileRows } = profileIds.length
    ? await admin
        .from("profiles")
        .select("id, name, email")
        .in("id", profileIds)
    : { data: [] as ProfileRow[] };

  const profiles = new Map(
    ((profileRows ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );

  const activeBans = bans.filter(isActiveBan);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-widest text-blue-400 uppercase">
              TriDi · модерация
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Форум
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Новые темы проходят премодерацию, ответы публикуются сразу.
              Публичный форум показывает только одобренные материалы.
            </p>
          </div>
          <Link
            href="/forum"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/50 hover:text-white"
          >
            Открыть форум
          </Link>
        </div>

        {loadError ? (
          <p
            role="alert"
            className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100"
          >
            Часть данных не загрузилась. Проверьте, что supabase/forum.sql
            применён и схема PostgREST обновлена.
          </p>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Тем на проверке", value: pendingThreads.length },
            { label: "Опубликованных тем", value: publishedThreads.length },
            { label: "Старых ответов в очереди", value: pendingReplies.length },
            { label: "Последних ответов", value: publishedReplies.length },
            { label: "Активных банов", value: activeBans.length },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <p className="text-3xl font-extrabold tracking-tight text-white">
                {item.value}
              </p>
              <p className="mt-1 text-sm text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>

        <section aria-labelledby="pending-threads" className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2
              id="pending-threads"
              className="text-2xl font-extrabold tracking-tight text-white"
            >
              Темы на модерации
            </h2>
            {pendingThreads.length > 50 ? (
              <span className="text-xs text-slate-500">
                Показаны первые 50
              </span>
            ) : null}
          </div>

          {pendingThreads.length === 0 ? (
            <p className="mt-4 rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm text-slate-400">
              Новых тем нет. Очередь пуста.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {pendingThreads.map((thread) => (
                <li
                  key={thread.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 font-semibold text-blue-200">
                      {categoryTitles.get(thread.category_id) ?? "Без раздела"}
                    </span>
                    <time
                      dateTime={thread.created_at}
                      className="text-slate-500"
                    >
                      {formatForumDateTime(thread.created_at)}
                    </time>
                  </div>

                  <h3 className="mt-3 text-lg font-bold leading-snug text-white">
                    {thread.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Автор: {authorLabel(profiles, thread.author_id)}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-300">
                    {forumExcerpt(thread.content, 500)}
                  </p>

                  <div className="mt-5 flex flex-wrap items-start gap-2">
                    <ModerationButton
                      action={approveThread}
                      idName="threadId"
                      idValue={thread.id}
                      label="Одобрить"
                      tone="approve"
                    />
                    <ModerationButton
                      action={rejectThread}
                      idName="threadId"
                      idValue={thread.id}
                      label="Отклонить"
                      tone="reject"
                    />
                    <DeleteThreadButton threadId={thread.id} />
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-400 transition-colors hover:text-red-300">
                      Заблокировать автора
                    </summary>
                    <BanAuthorForm userId={thread.author_id} />
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="published-threads" className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="published-threads"
                className="text-2xl font-extrabold tracking-tight text-white"
              >
                Опубликованные темы
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                Последние 50 тем, которые видны на форуме. Удаление темы
                необратимо: вместе с ней удаляются все ответы.
              </p>
            </div>
            {publishedThreads.length === 50 ? (
              <span className="text-xs text-slate-500">
                Показаны последние 50
              </span>
            ) : null}
          </div>

          {publishedThreads.length === 0 ? (
            <p className="mt-4 rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm text-slate-400">
              Опубликованных тем нет.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {publishedThreads.map((thread) => (
                <li
                  key={thread.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 font-semibold text-blue-200">
                      {categoryTitles.get(thread.category_id) ?? "Без раздела"}
                    </span>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-200">
                      Опубликована
                    </span>
                    <time
                      dateTime={thread.created_at}
                      className="text-slate-500"
                    >
                      {formatForumDateTime(thread.created_at)}
                    </time>
                  </div>

                  <h3 className="mt-3 text-lg font-bold leading-snug text-white">
                    <Link
                      href={`/forum/${thread.slug}`}
                      className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
                    >
                      {thread.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Автор: {authorLabel(profiles, thread.author_id)}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-300">
                    {forumExcerpt(thread.content, 500)}
                  </p>

                  <div className="mt-5">
                    <DeleteThreadButton threadId={thread.id} />
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-400 transition-colors hover:text-red-300">
                      Заблокировать автора
                    </summary>
                    <BanAuthorForm userId={thread.author_id} />
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="forum-replies" className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="forum-replies"
                className="text-2xl font-extrabold tracking-tight text-white"
              >
                Ответы
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                Ответы публикуются сразу. Ниже — последние 50: если комментарий
                нарушает правила, удалите его.
              </p>
            </div>
            {publishedReplies.length === 50 ? (
              <span className="text-xs text-slate-500">
                Показаны последние 50
              </span>
            ) : null}
          </div>

          {pendingReplies.length > 0 ? (
            <div className="mt-6 rounded-3xl border border-amber-400/25 bg-amber-500/5 p-5 sm:p-6">
              <h3 className="text-lg font-bold text-amber-100">
                Старые ответы на проверке
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-amber-100/80">
                Они пришли до перехода на пост-модерацию. Одобрите или отклоните
                их, чтобы закрыть очередь.
              </p>

              <ul className="mt-4 space-y-4">
              {pendingReplies.map((reply) => {
                const thread = threadRefsById.get(reply.thread_id);

                return (
                  <li
                    key={reply.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <time dateTime={reply.created_at}>
                        {formatForumDateTime(reply.created_at)}
                      </time>
                      <span aria-hidden>·</span>
                      <span>Автор: {authorLabel(profiles, reply.author_id)}</span>
                    </div>

                    <p className="mt-2 text-sm font-semibold text-white">
                      Тема:{" "}
                      {thread ? (
                        <Link
                          href={`/forum/${thread.slug}`}
                          className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
                        >
                          {thread.title}
                        </Link>
                      ) : (
                        "Тема не найдена"
                      )}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-300">
                      {forumExcerpt(reply.content, 500)}
                    </p>

                    <div className="mt-5 flex flex-wrap items-start gap-2">
                      <ModerationButton
                        action={approveReply}
                        idName="replyId"
                        idValue={reply.id}
                        label="Одобрить"
                        tone="approve"
                      />
                      <ModerationButton
                        action={rejectReply}
                        idName="replyId"
                        idValue={reply.id}
                        label="Отклонить"
                        tone="reject"
                      />
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-400 transition-colors hover:text-red-300">
                        Заблокировать автора
                      </summary>
                      <BanAuthorForm userId={reply.author_id} />
                    </details>
                  </li>
                );
              })}
              </ul>
            </div>
          ) : null}

          <h3 className="mt-8 text-lg font-bold text-white">
            Последние опубликованные
          </h3>

          {publishedReplies.length === 0 ? (
            <p className="mt-4 rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm text-slate-400">
              Опубликованных ответов пока нет.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {publishedReplies.map((reply) => {
                const thread = threadRefsById.get(reply.thread_id);

                return (
                  <li
                    key={reply.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-200">
                        Опубликован
                      </span>
                      <time dateTime={reply.created_at}>
                        {formatForumDateTime(reply.created_at)}
                      </time>
                      <span aria-hidden>·</span>
                      <span>Автор: {authorLabel(profiles, reply.author_id)}</span>
                    </div>

                    <p className="mt-2 text-sm font-semibold text-white">
                      Тема:{" "}
                      {thread ? (
                        <Link
                          href={`/forum/${thread.slug}`}
                          className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
                        >
                          {thread.title}
                        </Link>
                      ) : (
                        "Тема не найдена"
                      )}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-300">
                      {forumExcerpt(reply.content, 500)}
                    </p>

                    <div className="mt-5">
                      <DeleteReplyButton replyId={reply.id} />
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-400 transition-colors hover:text-red-300">
                        Заблокировать автора
                      </summary>
                      <BanAuthorForm userId={reply.author_id} />
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>


        <section aria-labelledby="forum-bans" className="mt-12">
          <h2
            id="forum-bans"
            className="text-2xl font-extrabold tracking-tight text-white"
          >
            Активные баны
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Блокировка действует только на форуме. Она не закрывает доступ к
            курсам, урокам и подписке Pro.
          </p>

          {activeBans.length === 0 ? (
            <p className="mt-4 rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm text-slate-400">
              Активных банов нет.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {activeBans.map((ban) => (
                <li
                  key={ban.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-red-400/20 bg-red-500/5 p-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {authorLabel(profiles, ban.user_id)}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300">
                      {ban.reason}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      До: {formatForumBanUntil(ban.expires_at)}
                    </p>
                  </div>
                  <LiftBanButton banId={ban.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

