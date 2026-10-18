"use server";

import { revalidatePath } from "next/cache";

import {
  checkForumBan,
  findForumStopWord,
  formatForumBanMessage,
} from "@/lib/forum-moderation";
import { buildForumThreadSlug } from "@/lib/forum";
import { createClient } from "@/lib/supabase/server";

import type { ForumFormState } from "@/app/actions/forum-state";

/** UUID из формы: значение приходит из браузера, доверять ему нельзя. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FORUM_UNAVAILABLE =
  "Форум временно недоступен. Попробуйте ещё раз через минуту.";

/** Таблицы или представления ещё нет — миграцию не применили. */
function isMissingForumSchema(
  code: string | undefined,
  message: string,
): boolean {
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.toLowerCase().includes("could not find the table")
  );
}

/** Текст для пользователя: детали ошибки остаются в серверном логе. */
function forumInsertError(error: { code?: string; message: string }): string {
  if (isMissingForumSchema(error.code, error.message)) {
    return FORUM_UNAVAILABLE;
  }

  if (error.code === "23505") {
    return "Не удалось подобрать адрес темы. Отправьте форму ещё раз.";
  }

  return "Не удалось сохранить материал. Попробуйте ещё раз.";
}

/**
 * Создаёт тему на модерацию.
 *
 * Порядок проверок:
 *   1. реальная сессия (getUser, а не getSession);
 *   2. активный бан форума;
 *   3. согласие с правилами и поля;
 *   4. стоп-слова;
 *   5. insert со status = 'pending'.
 *
 * Бан проверяется по forum_bans и НЕ влияет на подписку или курсы. Этот файл
 * не импортирует lib/subscription.ts и не вызывает проверки доступа к урокам.
 */
export async function createThread(
  _prevState: ForumFormState,
  formData: FormData,
): Promise<ForumFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Чтобы создать тему, войдите в аккаунт." };
  }

  const ban = await checkForumBan(supabase, user.id);

  if (ban) {
    return { error: formatForumBanMessage(ban) };
  }

  if (formData.get("rules") !== "on") {
    return { error: "Подтвердите, что вы согласны с правилами форума." };
  }

  // Ловушка для простых спам-ботов: поле скрыто от человека. Боту показываем
  // нейтральный успех, но ничего не записываем.
  if (String(formData.get("website") ?? "").trim().length > 0) {
    return { success: "Тема отправлена на модерацию." };
  }

  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!UUID_PATTERN.test(categoryId)) {
    return { error: "Выберите раздел форума." };
  }

  if (title.length < 5) {
    return { error: "Заголовок слишком короткий — минимум 5 символов." };
  }

  if (title.length > 180) {
    return { error: "Заголовок слишком длинный — максимум 180 символов." };
  }

  if (content.length < 10) {
    return { error: "Опишите вопрос подробнее — минимум 10 символов." };
  }

  if (content.length > 20000) {
    return { error: "Текст слишком длинный — максимум 20 000 символов." };
  }

  const stopWord = findForumStopWord(`${title}\n${content}`);

  if (stopWord) {
    return {
      error:
        "Нарушение правил: в тексте есть недопустимая лексика или запрещённая тема. Прочитайте правила форума.",
    };
  }

  const { data: category, error: categoryError } = await supabase
    .from("forum_categories")
    .select("id")
    .eq("id", categoryId)
    .maybeSingle();

  if (categoryError) {
    if (isMissingForumSchema(categoryError.code, categoryError.message)) {
      return { error: FORUM_UNAVAILABLE };
    }

    return { error: "Не удалось проверить раздел. Попробуйте ещё раз." };
  }

  if (!category) {
    return { error: "Раздел не найден. Обновите страницу и выберите другой." };
  }

  // Повторяем вставку при редком совпадении slug: адрес содержит случайный
  // хвост, но уникальность окончательно проверяет база.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = buildForumThreadSlug(title);

    const { error } = await supabase.from("forum_threads").insert({
      category_id: categoryId,
      slug,
      title,
      content,
      author_id: user.id,
      status: "pending",
    });

    if (!error) {
      revalidatePath("/forum");
      revalidatePath("/forum/new");
      revalidatePath("/admin/forum");

      return {
        success:
          "Тема отправлена на модерацию. Мы проверим её и опубликуем — обычно в течение дня.",
        slug,
      };
    }

    if (error.code !== "23505") {
      console.warn("Не удалось создать тему форума:", error.message);
      return { error: forumInsertError(error) };
    }
  }

  return {
    error:
      "Не удалось подобрать адрес темы. Измените заголовок и отправьте ещё раз.",
  };
}


/**
 * Создаёт ответ на модерацию.
 *
 * Отвечать можно только в approved-тему: pending ещё не опубликована, и ответ
 * к ней никто не увидит. Бан форума проверяется тем же изолированным модулем.
 */
export async function createReply(
  _prevState: ForumFormState,
  formData: FormData,
): Promise<ForumFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Чтобы ответить, войдите в аккаунт." };
  }

  const ban = await checkForumBan(supabase, user.id);

  if (ban) {
    return { error: formatForumBanMessage(ban) };
  }

  const threadId = String(formData.get("threadId") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  if (!UUID_PATTERN.test(threadId)) {
    return { error: "Тема не найдена. Обновите страницу." };
  }

  if (content.length < 3) {
    return { error: "Ответ слишком короткий — минимум 3 символа." };
  }

  if (content.length > 20000) {
    return { error: "Ответ слишком длинный — максимум 20 000 символов." };
  }

  const stopWord = findForumStopWord(content);

  if (stopWord) {
    return {
      error:
        "Нарушение правил: в тексте есть недопустимая лексика или запрещённая тема. Прочитайте правила форума.",
    };
  }

  const { data: thread, error: threadError } = await supabase
    .from("forum_threads")
    .select("id, slug")
    .eq("id", threadId)
    .eq("status", "approved")
    .maybeSingle();

  if (threadError) {
    if (isMissingForumSchema(threadError.code, threadError.message)) {
      return { error: FORUM_UNAVAILABLE };
    }

    return { error: "Не удалось проверить тему. Попробуйте ещё раз." };
  }

  if (!thread) {
    return { error: "Тема не найдена или ещё не прошла модерацию." };
  }

  const { error } = await supabase.from("forum_replies").insert({
    thread_id: threadId,
    content,
    author_id: user.id,
    status: "pending",
  });

  if (error) {
    console.warn("Не удалось создать ответ форума:", error.message);
    return { error: forumInsertError(error) };
  }

  const slug = (thread as { slug: string }).slug;

  revalidatePath("/forum");
  revalidatePath(`/forum/${slug}`);
  revalidatePath("/admin/forum");

  return {
    success:
      "Ответ отправлен на модерацию. После проверки он появится в теме.",
  };
}

