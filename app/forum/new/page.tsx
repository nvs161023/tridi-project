import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CreateThreadForm } from "@/components/forum/CreateThreadForm";
import { Header } from "@/components/Header";
import { authHref } from "@/lib/auth-redirect";
import { resolveUserId } from "@/lib/current-user";
import { getForumCategories } from "@/lib/forum";
import {
  checkForumBan,
  formatForumBanMessage,
} from "@/lib/forum-moderation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Новая тема — форум TriDi",
  description: "Создание темы на форуме сообщества TriDi.",
  robots: { index: false, follow: false },
};

/** Нужна сессия и свежий список категорий. */
export const dynamic = "force-dynamic";

type NewForumThreadPageProps = {
  searchParams: Promise<{ category?: string | string[] }>;
};

/**
 * Создание темы: только для авторизованных.
 *
 * middleware закрывает /forum/new ещё до рендера, но проверка здесь нужна как
 * страховка: если matcher изменят или запрос пройдёт мимо middleware, страница
 * не должна открыться гостю с рабочей формой.
 */
export default async function NewForumThreadPage({
  searchParams,
}: NewForumThreadPageProps) {
  const { category } = await searchParams;
  const categorySlug = Array.isArray(category) ? category[0] : category;
  const returnTo = categorySlug
    ? `/forum/new?category=${encodeURIComponent(categorySlug)}`
    : "/forum/new";
  const supabase = await createClient();
  const userId = await resolveUserId(supabase);

  if (!userId) {
    redirect(authHref("/auth/login", returnTo));
  }

  const [categories, ban] = await Promise.all([
    getForumCategories(supabase),
    checkForumBan(supabase, userId),
  ]);
  const defaultCategory = categorySlug
    ? categories.find((item) => item.slug === categorySlug)
    : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <Link
          href="/forum"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden>←</span> Назад ко всем разделам
        </Link>

        <p className="mt-8 text-sm font-semibold tracking-widest text-blue-400 uppercase">
          Сообщество TriDi
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Новая тема
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-300">
          Опишите вопрос или поделитесь опытом. Тема будет опубликована после
          проверки модератором — до этого её видите только вы.
        </p>

        {ban ? (
          <div className="mt-8 rounded-3xl border border-red-500/40 bg-red-500/10 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-red-100">
              Публикация недоступна
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-red-200">
              {formatForumBanMessage(ban)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-red-200/80">
              Блокировка действует только на форуме. Доступ к курсам и подписке
              сохраняется.
            </p>
            <Link
              href="/forum"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Вернуться на форум
            </Link>
          </div>
        ) : categories.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-amber-400/30 bg-amber-500/10 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-amber-100">
              Разделы ещё не настроены
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-amber-100/90">
              В таблице forum_categories пока нет записей, поэтому выбрать раздел
              нельзя. Добавьте категории в Supabase — после обновления страницы
              форма станет доступной.
            </p>
          </div>
        ) : (
          <CreateThreadForm
            categories={categories.map((category) => ({
              id: category.id,
              title: category.title,
            }))}
            defaultCategoryId={defaultCategory?.id}
          />
        )}

        <aside className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-base font-bold text-white">Что помогает получить ответ</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
            <li>• модель принтера и его доработки;</li>
            <li>• пластик, цвет и условия хранения;</li>
            <li>• слайсер, профиль и ключевые настройки;</li>
            <li>• фото дефекта или ссылка на модель;</li>
            <li>• что уже пробовали и что изменилось.</li>
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Не публикуйте личные данные и чужие платные файлы.{" "}
            <Link
              href="/forum/rules"
              className="text-blue-300 underline underline-offset-4 transition-colors hover:text-blue-200"
            >
              Полные правила
            </Link>
            .
          </p>
        </aside>
      </main>
    </div>
  );
}
