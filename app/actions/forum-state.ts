/**
 * Состояние форм форума для useActionState.
 *
 * Ошибки возвращаются текстом: Server Action не должен отдавать клиенту
 * подробности Supabase. Успешное создание темы дополнительно возвращает slug,
 * чтобы форма могла показать ссылку на будущий адрес.
 */
export type ForumFormState = {
  error?: string;
  success?: string;
  slug?: string;
};

export const emptyForumFormState: ForumFormState = {};

/**
 * Состояние форм админ-панели.
 *
 * Отдельный тип, чтобы действия модерации нельзя было случайно перепутать с
 * действиями автора темы: у админских форм нет slug и они не создают контент.
 */
export type ForumAdminFormState = {
  error?: string;
  success?: string;
};

export const emptyForumAdminFormState: ForumAdminFormState = {};
