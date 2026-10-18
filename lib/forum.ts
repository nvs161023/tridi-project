/**
 * Форум: типы, выборки и небольшие помощники для страниц.
 *
 * Публичные страницы читают данные клиентом текущего пользователя (anon или
 * authenticated). RLS отдаёт только approved-темы и ответы; pending видит лишь
 * автор. Админ-панель использует service_role отдельно.
 */
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Статус материала форума. */
export type ForumStatus = "pending" | "approved" | "rejected";

/** Категория: slug из адреса, название и порядок показа. */
export type ForumCategory = {
  id: string;
  slug: string;
  title: string;
  description: string;
  order: number;
};

/** Тема в том виде, в каком её отдаёт PostgREST. */
export type ForumThread = {
  id: string;
  category_id: string;
  slug: string;
  title: string;
  content: string;
  author_id: string;
  created_at: string;
  views: number;
  status: ForumStatus;
};

/** Ответ в теме. */
export type ForumReply = {
  id: string;
  thread_id: string;
  content: string;
  author_id: string;
  created_at: string;
  status: ForumStatus;
};

/** Публичное имя автора из представления forum_authors. */
export type ForumAuthor = {
  id: string;
  display_name: string;
};

/** Если профиль не найден или имя пустое. */
export const FORUM_AUTHOR_FALLBACK = "Участник";

/** Русская форма слова по числу: 1 тема, 2 темы, 5 тем. */
export function pluralizeForumCount(
  count: number,
  forms: readonly [string, string, string],
): string {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** Тема вместе с категорией — для страницы темы и хлебных крошек. */
export type ForumThreadPage = {
  thread: ForumThread;
  category: ForumCategory | null;
};

/** Ошибки Supabase не показываем пользователю — только пишем в лог. */
function warnForumQuery(label: string, message: string) {
  console.warn(`Форум: не удалось ${label}:`, message);
}

/**
 * Транслитерация заголовка в SEO-адрес.
 *
 * Пример: «Как выбрать PLA для Ender 3?» → «kak-vybrat-pla-dlya-ender-3-abc123».
 * Случайный хвост защищает от совпадений: slug в базе уникален, а темы с
 * одинаковым названием — обычное дело.
 */
export function buildForumThreadSlug(title: string): string {
  const transliteration: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  const base = title
    .toLocaleLowerCase("ru-RU")
    .split("")
    .map((char) => transliteration[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");

  const suffix = Math.random().toString(36).slice(2, 8);

  return `${base || "tema"}-${suffix}`;
}

/** Короткое описание для метатегов и превью: без переносов, до 160 знаков. */
export function forumExcerpt(value: string, limit = 160): string {
  const plain = value.replace(/\s+/g, " ").trim();

  if (plain.length <= limit) {
    return plain;
  }

  const cut = plain.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** Дата в русском формате: «18 октября 2026». */
export function formatForumDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Дата и время: «18 октября 2026, 14:30». */
export function formatForumDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Категории в порядке `order`; при недоступной базе — пустой список. */
export async function getForumCategories(
  supabase: Supabase,
): Promise<ForumCategory[]> {
  const { data, error } = await supabase
    .from("forum_categories")
    .select("*")
    .order("order", { ascending: true });

  if (error) {
    warnForumQuery("загрузить категории", error.message);
    return [];
  }

  return ((data as ForumCategory[] | null) ?? []).sort(
    (left, right) => left.order - right.order,
  );
}

/** Одна категория по slug из адреса. null — если её нет или БД недоступна. */
export async function getForumCategoryBySlug(
  supabase: Supabase,
  slug: string,
): Promise<ForumCategory | null> {
  const { data, error } = await supabase
    .from("forum_categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    warnForumQuery("загрузить категорию", error.message);
    return null;
  }

  return data ? (data as ForumCategory) : null;
}

/**
 * Публичный список тем: только approved, свежие сверху.
 *
 * Лимит в 300 — защита от случайной выгрузки всей базы на старте. Когда тем
 * станет больше, здесь появится пагинация; счётчики категорий при этом нужно
 * будет считать отдельным запросом.
 */
export async function getApprovedThreads(
  supabase: Supabase,
): Promise<ForumThread[]> {
  const { data, error } = await supabase
    .from("forum_threads")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    warnForumQuery("загрузить темы", error.message);
    return [];
  }

  return (data as ForumThread[] | null) ?? [];
}

/**
 * Одобренные темы одного раздела — свежие сверху.
 *
 * Лимит тот же, что у общего списка: страница раздела не должна выгружать всю
 * базу. Когда тем станет больше, здесь появится пагинация.
 */
export async function getApprovedThreadsByCategory(
  supabase: Supabase,
  categoryId: string,
): Promise<ForumThread[]> {
  const { data, error } = await supabase
    .from("forum_threads")
    .select("*")
    .eq("category_id", categoryId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    warnForumQuery("загрузить темы раздела", error.message);
    return [];
  }

  return (data as ForumThread[] | null) ?? [];
}

/** Одна approved-тема по slug. null — если темы нет, она pending или БД недоступна. */
export async function getApprovedThreadBySlug(
  supabase: Supabase,
  slug: string,
): Promise<ForumThreadPage | null> {
  const { data, error } = await supabase
    .from("forum_threads")
    .select("*")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  if (error) {
    warnForumQuery("загрузить тему", error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  const thread = data as ForumThread;
  const { data: category, error: categoryError } = await supabase
    .from("forum_categories")
    .select("*")
    .eq("id", thread.category_id)
    .maybeSingle();

  if (categoryError) {
    warnForumQuery("загрузить категорию темы", categoryError.message);
  }

  return {
    thread,
    category: category ? (category as ForumCategory) : null,
  };
}

/** Одобренные ответы темы — от старых к новым. */
export async function getApprovedReplies(
  supabase: Supabase,
  threadId: string,
): Promise<ForumReply[]> {
  const { data, error } = await supabase
    .from("forum_replies")
    .select("*")
    .eq("thread_id", threadId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (error) {
    warnForumQuery("загрузить ответы", error.message);
    return [];
  }

  return (data as ForumReply[] | null) ?? [];
}

/**
 * Число одобренных ответов по каждой теме.
 *
 * Считаем по строкам, а не через агрегат: PostgREST на self-hosted Supabase может
 * быть собран без поддержки `count` в select. Запросы идут порциями — длинный
 * `in` превращается в URL, который прокси вправе отклонить.
 */
export async function getApprovedReplyCounts(
  supabase: Supabase,
  threadIds: readonly string[],
): Promise<Map<string, number>> {
  const uniqueIds = [...new Set(threadIds.filter(Boolean))];
  const counts = new Map<string, number>();
  const chunkSize = 100;

  for (let start = 0; start < uniqueIds.length; start += chunkSize) {
    const chunk = uniqueIds.slice(start, start + chunkSize);
    const { data, error } = await supabase
      .from("forum_replies")
      .select("thread_id")
      .eq("status", "approved")
      .in("thread_id", chunk);

    if (error) {
      warnForumQuery("посчитать ответы", error.message);
      return counts;
    }

    const replies = (data as Pick<ForumReply, "thread_id">[] | null) ?? [];

    for (const reply of replies) {
      counts.set(reply.thread_id, (counts.get(reply.thread_id) ?? 0) + 1);
    }
  }

  return counts;
}

/**
 * Имена авторов по id.
 *
 * Читаем безопасное представление forum_authors: в нём только id и display_name,
 * без email. Если представления ещё нет (миграция не применена), возвращаем
 * пустую карту — страница покажет «Участник» вместо падения.
 */
export async function getForumAuthors(
  supabase: Supabase,
  authorIds: readonly string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(authorIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("forum_authors")
    .select("id, display_name")
    .in("id", uniqueIds);

  if (error) {
    warnForumQuery("загрузить имена авторов", error.message);
    return new Map();
  }

  const names = new Map<string, string>();

  for (const author of (data as ForumAuthor[] | null) ?? []) {
    const name = author.display_name?.trim();

    if (name) {
      names.set(author.id, name);
    }
  }

  return names;
}

/** Имя автора или нейтральная подпись. */
export function forumAuthorName(
  names: Map<string, string>,
  authorId: string,
): string {
  return names.get(authorId) || FORUM_AUTHOR_FALLBACK;
}
