"use server";

import { revalidatePath } from "next/cache";

import type { PromoAdminFormState } from "@/app/actions/promo-state";
import { isAdminEmail } from "@/lib/admin";
import {
  PROMO_MAX_BATCH,
  generatePromoCode,
  isPromoCourseId,
  missingColumnName,
} from "@/lib/promo-codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DENIED = "Недостаточно прав. Войдите под администратором.";

/** Таблица promo_codes ещё не создана: миграцию применяют вручную. */
function isMissingPromoTable(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205";
}

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

/**
 * Выпускает партию промокодов для одного курса.
 *
 * Коды генерируются здесь, а не в браузере: иначе подменённый запрос мог бы
 * прислать произвольные коды, включая уже существующие. Уникальность
 * гарантирует индекс promo_codes_code_key; коллизию из 40 бит практически
 * невозможно получить, но при 23505 просим повторить — партия создастся заново.
 *
 * Доступ к таблице только через service_role: RLS не даёт вставлять строки
 * даже администратору с обычным ключом.
 */
export async function createPromoCodes(
  _prevState: PromoAdminFormState,
  formData: FormData,
): Promise<PromoAdminFormState> {
  const denied = await requireAdmin();

  if (denied) {
    return { error: denied };
  }

  const courseId = String(formData.get("course") ?? "").trim();

  if (!isPromoCourseId(courseId)) {
    return { error: "Выберите курс, для которого выпускаются коды." };
  }

  const count = Number.parseInt(String(formData.get("count") ?? ""), 10);

  if (!Number.isFinite(count) || count < 1 || count > PROMO_MAX_BATCH) {
    return { error: `Количество кодов — от 1 до ${PROMO_MAX_BATCH}.` };
  }

  const batch = String(formData.get("batch") ?? "").trim().slice(0, 60) || null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;

  // Срок действия: 0 — бессрочно. Ограничение сверху защищает от опечатки.
  const daysValue = String(formData.get("days") ?? "0").trim();
  const days = Number.parseInt(daysValue, 10);
  let expiresAt: string | null = null;

  if (daysValue !== "0") {
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      return { error: "Срок действия — от 1 до 3650 дней или «бессрочно»." };
    }

    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  // Set сам отбрасывает повторы: даже теоретическая коллизия не уменьшит партию.
  const codes = new Set<string>();

  while (codes.size < count) {
    codes.add(generatePromoCode());
  }

  /**
   * Строка партии. Record, а не точный тип: при старой схеме базы неизвестную
   * колонку приходится убирать из объекта перед повторной вставкой.
   */
  const rows: Record<string, string | null>[] = [...codes].map((code) => ({
    code,
    course_id: courseId,
    batch,
    note,
    expires_at: expiresAt,
  }));

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        "Не заданы NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY — коды негде сохранить.",
    };
  }

  /**
   * Вставка с откатом на старую схему.
   *
   * Ключ service_role обходит RLS, но не исправляет расхождение схемы: если в
   * базе ещё нет `note` (или другой необязательной колонки), PostgREST отвечает
   * PGRST204 и не сохраняет НИ ОДНОЙ строки. Поэтому неизвестную колонку
   * убираем и повторяем — партия создаётся, а форма предупреждает, чего не
   * хватает и какой файл применить.
   */
  const droppedColumns = new Set<string>();
  let insertError: { code?: string; message: string } | null = null;

  // Колонок в партии пять: больше пяти повторов не понадобится.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error } = await admin.from("promo_codes").insert(rows);

    if (!error) {
      insertError = null;
      break;
    }

    insertError = error;

    const column = missingColumnName(error);

    if (!column || !(column in rows[0])) {
      break;
    }

    droppedColumns.add(column);

    for (const row of rows) {
      delete row[column];
    }
  }

  if (insertError) {
    if (isMissingPromoTable(insertError.code)) {
      return {
        error:
          "Таблица promo_codes не создана. Примените supabase/promo_codes.sql в SQL Editor, затем повторите.",
      };
    }

    if (insertError.code === "23505") {
      return {
        error:
          "Один из кодов уже существует. Нажмите «Выпустить» ещё раз — партия создастся заново.",
      };
    }

    console.warn("Не удалось сохранить промокоды:", insertError.message);

    return { error: "Не удалось сохранить коды. Попробуйте ещё раз." };
  }

  revalidatePath("/admin/promo");

  return {
    success: `Выпущено кодов: ${rows.length}. Партия: ${batch ?? "без названия"}.`,
    warning:
      droppedColumns.size > 0
        ? `В таблице promo_codes нет колонок: ${[...droppedColumns].join(", ")}. Коды сохранены без них — примените supabase/promo_codes.sql, чтобы схема совпала.`
        : undefined,
    created: [...codes],
  };
}
