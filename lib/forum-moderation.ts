/**
 * Правила форума: стоп-слова и изолированные баны.
 *
 * ВАЖНО: этот модуль относится ТОЛЬКО к форуму. Он не должен импортироваться
 * в lib/subscription.ts, middleware или страницы курсов. Бан на форуме —
 * отдельная запись в forum_bans; она не меняет статус подписки, покупки и
 * доступ к урокам. Пользователь с баном продолжает смотреть свои курсы.
 */
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Корни недопустимых слов и запрещённые темы.
 *
 * Это не «чёрный список всех слов русского языка», а минимальный фильтр перед
 * ручной модерацией. Текст всё равно уходит в pending: человек его проверит.
 * Корни подобраны так, чтобы ловить распространённые формы, но не резать
 * обычные технические слова вроде «себестоимость» (корень «еб» сам по себе
 * поэтому не добавлен).
 */
export const FORUM_STOP_WORDS: readonly string[] = [
  // Мат и оскорбления
  "хуй",
  "хуя",
  "хую",
  "хуе",
  "пизд",
  "бля",
  "бляд",
  "еба",
  "ебал",
  "ебан",
  "ебет",
  "ебуч",
  "заеб",
  "наеб",
  "уеб",
  "отъеб",
  "выеб",
  "долбоеб",
  "мудак",
  "мудил",
  "сука",
  "шлюх",
  "залуп",
  "манда",
  "нахуй",
  "нихуя",
  // Угрозы, насилие и экстремизм
  "убью",
  "убить",
  "убива",
  "зарезать",
  "теракт",
  "взорв",
  "свергнуть",
  "экстремист",
  "джихад",
  "нацист",
  "гитлер",
  "жиды",
  "чурк",
  "хохол",
  "москал",
  "карател",
  // Спам, мошенничество и обход оплаты
  "казино",
  "букмекер",
  "ставки на спорт",
  "займ онлайн",
  "микрозайм",
  "промокод",
  "обход оплаты",
  "оплата напрямую",
  "переведи на карту",
  "перевод на карту",
  "карта сбер",
  "криптообмен",
  "обменник",
  "usdt",
  "bitcoin",
  "заработок без вложений",
  "инвестируй",
  "подписывайся на канал",
  "пиши в телеграм",
  "пиши в whatsapp",
] as const;

/** Нормализация: регистр, ё → е, схлопывание повторов букв. */
function normalizeForumText(value: string): string {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/([а-яa-z])\1{2,}/g, "$1$1");
}

/**
 * Находит первое запрещённое слово или фразу.
 *
 * Для коротких корней проверяем начало слова (после пробела/пунктуации), чтобы
 * «хуй» ловил «хуйня», но не срабатывал на случайную середину другого слова.
 * Для фраз используем обычный поиск подстроки.
 */
export function findForumStopWord(value: string): string | null {
  const normalized = normalizeForumText(value);

  for (const word of FORUM_STOP_WORDS) {
    if (word.includes(" ")) {
      if (normalized.includes(word)) {
        return word;
      }

      continue;
    }

    // Кириллица не дружит с \b в JS, поэтому границу слова задаём явно.
    const pattern = new RegExp(
      `(?:^|[^a-zа-я0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "u",
    );

    if (pattern.test(normalized)) {
      return word;
    }
  }

  return null;
}

/** Есть ли в тексте недопустимая лексика или запрещённая тема. */
export function containsForumStopWord(value: string): boolean {
  return findForumStopWord(value) !== null;
}

/** Активный бан пользователя на форуме. */
export type ForumBan = {
  reason: string;
  expiresAt: string | null;
};

/** Строка forum_bans, которую читаем для проверки. */
type ForumBanRow = {
  reason: string | null;
  expires_at: string | null;
  created_at?: string | null;
};

/** Действует ли срок бана: null — бессрочно, иначе дата должна быть в будущем. */
function isBanActive(expiresAt: string | null): boolean {
  if (expiresAt === null) {
    return true;
  }

  const date = new Date(expiresAt);

  return !Number.isNaN(date.getTime()) && date > new Date();
}

/**
 * Проверяет бан текущего пользователя.
 *
 * Ошибка чтения (например, миграция ещё не применена) трактуется как «бана
 * нет»: форум не должен падать целиком из-за недоступной таблицы. Это НЕ
 * ослабляет платный доступ — тот проверяется отдельно и при ошибке закрывается.
 */
export async function checkForumBan(
  supabase: Supabase,
  userId: string,
): Promise<ForumBan | null> {
  const { data, error } = await supabase
    .from("forum_bans")
    .select("reason, expires_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    // Не логируем текст пользователя или email — только причину сбоя.
    console.warn("Не удалось проверить бан на форуме:", error.message);
    return null;
  }

  const active = ((data as ForumBanRow[] | null) ?? []).find((row) =>
    isBanActive(row.expires_at),
  );

  if (!active) {
    return null;
  }

  return {
    reason: active.reason?.trim() || "Нарушение правил форума",
    expiresAt: active.expires_at,
  };
}

/** Дата окончания бана: «25.10.2026, 14:00» или «бессрочно». */
export function formatForumBanUntil(expiresAt: string | null): string {
  if (!expiresAt) {
    return "бессрочно";
  }

  const date = new Date(expiresAt);

  if (Number.isNaN(date.getTime())) {
    return expiresAt;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Сообщение для формы и плашки: срок и причина. */
export function formatForumBanMessage(ban: ForumBan): string {
  return `Вы заблокированы на форуме до ${formatForumBanUntil(ban.expiresAt)}. Причина: ${ban.reason}`;
}
