"use server";

import { revalidatePath } from "next/cache";

import type { ForumAdminFormState } from "@/app/actions/forum-state";
import { isAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DENIED = "Недостаточно прав. Войдите под администратором форума.";

/**
 * Проверяет администратора по реальной сессии.
 *
 * getUser(), а не getSession(): email из непроверенной cookie нельзя использовать
 * для доступа к service_role. Если ADMIN_EMAIL не задан, список админов пуст и
 * действие отклоняется.
 */
async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return "Требуется вход администратора.";
  }

  if (!isAdminEmail(user.email)) {
    return DENIED;
  }

  return null;
}

/** После модерации обновляем публичные страницы и очередь. */
function revalidateForum(slug?: string) {
  revalidatePath("/forum");
  revalidatePath("/admin/forum");

  if (slug) {
    revalidatePath(`/forum/${slug}`);
  }
}

/** Одобрение или отклонение темы. */
async function setThreadStatus(
  _prevState: ForumAdminFormState,
  formData: FormData,
  status: "approved" | "rejected",
): Promise<ForumAdminFormState> {
  const denied = await requireAdmin();

  if (denied) {
    return { error: denied };
  }

  const threadId = String(formData.get("threadId") ?? "").trim();

  if (!UUID_PATTERN.test(threadId)) {
    return { error: "Некорректная тема." };
  }

  const admin = createAdminClient();
  const { data: thread, error: readError } = await admin
    .from("forum_threads")
    .select("slug")
    .eq("id", threadId)
    .maybeSingle();

  if (readError) {
    console.warn("Не удалось прочитать тему для модерации:", readError.message);
    return { error: "Не удалось изменить статус темы. Попробуйте ещё раз." };
  }

  if (!thread) {
    return { error: "Тема не найдена." };
  }

  const { error } = await admin
    .from("forum_threads")
    .update({ status })
    .eq("id", threadId);

  if (error) {
    console.warn("Не удалось изменить статус темы:", error.message);
    return { error: "Не удалось изменить статус темы. Попробуйте ещё раз." };
  }

  revalidateForum((thread as { slug: string }).slug);

  return {
    success:
      status === "approved"
        ? "Тема опубликована."
        : "Тема отклонена и не видна другим пользователям.",
  };
}

export async function approveThread(
  prevState: ForumAdminFormState,
  formData: FormData,
): Promise<ForumAdminFormState> {
  return setThreadStatus(prevState, formData, "approved");
}

export async function rejectThread(
  prevState: ForumAdminFormState,
  formData: FormData,
): Promise<ForumAdminFormState> {
  return setThreadStatus(prevState, formData, "rejected");
}

/** Одобрение или отклонение ответа. */
async function setReplyStatus(
  _prevState: ForumAdminFormState,
  formData: FormData,
  status: "approved" | "rejected",
): Promise<ForumAdminFormState> {
  const denied = await requireAdmin();

  if (denied) {
    return { error: denied };
  }

  const replyId = String(formData.get("replyId") ?? "").trim();

  if (!UUID_PATTERN.test(replyId)) {
    return { error: "Некорректный ответ." };
  }

  const admin = createAdminClient();
  const { data: reply, error: readError } = await admin
    .from("forum_replies")
    .select("thread_id")
    .eq("id", replyId)
    .maybeSingle();

  if (readError) {
    console.warn("Не удалось прочитать ответ для модерации:", readError.message);
    return { error: "Не удалось изменить статус ответа. Попробуйте ещё раз." };
  }

  if (!reply) {
    return { error: "Ответ не найден." };
  }

  const { error } = await admin
    .from("forum_replies")
    .update({ status })
    .eq("id", replyId);

  if (error) {
    console.warn("Не удалось изменить статус ответа:", error.message);
    return { error: "Не удалось изменить статус ответа. Попробуйте ещё раз." };
  }

  const { data: thread } = await admin
    .from("forum_threads")
    .select("slug")
    .eq("id", (reply as { thread_id: string }).thread_id)
    .maybeSingle();

  revalidateForum((thread as { slug: string } | null)?.slug);

  return {
    success:
      status === "approved"
        ? "Ответ опубликован."
        : "Ответ отклонён и не виден другим пользователям.",
  };
}

export async function approveReply(
  prevState: ForumAdminFormState,
  formData: FormData,
): Promise<ForumAdminFormState> {
  return setReplyStatus(prevState, formData, "approved");
}

export async function rejectReply(
  prevState: ForumAdminFormState,
  formData: FormData,
): Promise<ForumAdminFormState> {
  return setReplyStatus(prevState, formData, "rejected");
}

/**
 * Удаляет опубликованный ответ из админки.
 *
 * Ответы теперь публикуются сразу, поэтому нарушение можно убрать только
 * вручную. Удаление необратимо: кнопка в интерфейсе сначала просит подтверждение.
 */
export async function deleteForumReply(
  _prevState: ForumAdminFormState,
  formData: FormData,
): Promise<ForumAdminFormState> {
  const denied = await requireAdmin();

  if (denied) {
    return { error: denied };
  }

  const replyId = String(formData.get("replyId") ?? "").trim();

  if (!UUID_PATTERN.test(replyId)) {
    return { error: "Некорректный ответ." };
  }

  const admin = createAdminClient();
  const { data: reply, error: readError } = await admin
    .from("forum_replies")
    .select("thread_id")
    .eq("id", replyId)
    .maybeSingle();

  if (readError) {
    console.warn("Не удалось прочитать ответ для удаления:", readError.message);
    return { error: "Не удалось удалить ответ. Попробуйте ещё раз." };
  }

  if (!reply) {
    return { error: "Ответ не найден." };
  }

  const { data: thread } = await admin
    .from("forum_threads")
    .select("slug")
    .eq("id", (reply as { thread_id: string }).thread_id)
    .maybeSingle();

  const { error } = await admin
    .from("forum_replies")
    .delete()
    .eq("id", replyId);

  if (error) {
    console.warn("Не удалось удалить ответ форума:", error.message);
    return { error: "Не удалось удалить ответ. Попробуйте ещё раз." };
  }

  revalidateForum((thread as { slug: string } | null)?.slug);

  return { success: "Ответ удалён." };
}


/**
 * Блокирует автора на форуме.
 *
 * Это запись только в forum_bans. Здесь намеренно нет ни одного обращения к
 * subscriptions или purchases: бан форума не должен закрывать оплаченные курсы
 * и доступ к инструментам платформы. Срок: число дней или «навсегда».
 */
export async function banForumAuthor(
  _prevState: ForumAdminFormState,
  formData: FormData,
): Promise<ForumAdminFormState> {
  const denied = await requireAdmin();

  if (denied) {
    return { error: denied };
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const reason =
    String(formData.get("reason") ?? "").trim() || "Нарушение правил форума";
  const daysValue = String(formData.get("days") ?? "forever").trim();

  if (!UUID_PATTERN.test(userId)) {
    return { error: "Некорректный пользователь." };
  }

  if (reason.length > 300) {
    return { error: "Причина слишком длинная — максимум 300 символов." };
  }

  let expiresAt: string | null = null;

  if (daysValue !== "forever") {
    const days = Number.parseInt(daysValue, 10);

    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      return { error: "Срок бана должен быть от 1 до 3650 дней." };
    }

    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  const admin = createAdminClient();
  const { data: target, error: userError } = await admin.auth.admin.getUserById(
    userId,
  );

  if (userError || !target.user) {
    return { error: "Пользователь не найден." };
  }

  const { error } = await admin.from("forum_bans").insert({
    user_id: userId,
    reason,
    expires_at: expiresAt,
  });

  if (error) {
    console.warn("Не удалось заблокировать автора на форуме:", error.message);
    return { error: "Не удалось выдать бан. Попробуйте ещё раз." };
  }

  revalidateForum();

  return {
    success: expiresAt
      ? `Автор заблокирован на форуме на ${daysValue} дн.`
      : "Автор заблокирован на форуме бессрочно.",
  };
}

/** Снимает бан: удаляет запись forum_bans по её id. */
export async function liftForumBan(
  _prevState: ForumAdminFormState,
  formData: FormData,
): Promise<ForumAdminFormState> {
  const denied = await requireAdmin();

  if (denied) {
    return { error: denied };
  }

  const banId = String(formData.get("banId") ?? "").trim();

  if (!UUID_PATTERN.test(banId)) {
    return { error: "Некорректная запись бана." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("forum_bans").delete().eq("id", banId);

  if (error) {
    console.warn("Не удалось снять бан форума:", error.message);
    return { error: "Не удалось снять бан. Попробуйте ещё раз." };
  }

  revalidateForum();

  return { success: "Бан снят." };
}

