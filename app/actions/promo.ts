"use server";

import { revalidatePath } from "next/cache";

import type { ActivatePromoFormState } from "@/app/actions/promo-state";
import {
  isPromoCodeFormat,
  isPromoCourseId,
  normalizePromoCode,
} from "@/lib/promo-codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hasCourseAccess } from "@/lib/subscription";

/** Строка promo_codes, которая нужна для решения об активации. */
type PromoRow = {
  id: string;
  course_id: string;
  used_at: string | null;
  expires_at: string | null;
};

/**
 * Активация промокода покупателем.
 *
 * Порядок важен:
 *   1. сессия — код привязывается к пользователю, гость активировать не может;
 *   2. код ищется service_role-клиентом: обычному пользователю RLS показывает
 *      только уже активированные им строки, а свободный код он ещё не видит;
 *   3. повторная проверка used_at и срока;
 *   4. если курс уже открыт покупкой или другим кодом — код НЕ сжигаем;
 *   5. update с условием used_at is null — атомарная защита от двух вкладок:
 *      второй запрос не найдёт строку и получит понятную ошибку.
 *
 * Запись в purchases не создаётся: см. комментарий в supabase/promo_codes.sql.
 * Доступ появится сразу — hasCourseAccess проверяет promo_codes.
 */
export async function activatePromoCode(
  _prevState: ActivatePromoFormState,
  formData: FormData,
): Promise<ActivatePromoFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !user) {
    return { error: "Войдите в аккаунт, чтобы активировать промокод." };
  }

  const code = normalizePromoCode(String(formData.get("code") ?? ""));

  if (!isPromoCodeFormat(code)) {
    return {
      error:
        "Код должен выглядеть так: TRIDI-ABCD-1234. Проверьте написание и попробуйте ещё раз.",
    };
  }

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        "Сервис активации временно недоступен. Напишите в поддержку — код не потрачен.",
    };
  }

  const { data, error } = await admin
    .from("promo_codes")
    .select("id, course_id, used_at, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return {
        error:
          "Промокоды ещё не подключены. Напишите в поддержку — мы активируем код вручную.",
      };
    }

    console.warn("Не удалось прочитать промокод:", error.message);

    return { error: "Не удалось проверить код. Попробуйте ещё раз." };
  }

  const promo = data as PromoRow | null;

  if (!promo) {
    return { error: "Код не найден. Проверьте написание — например, TRIDI-ABCD-1234." };
  }

  if (promo.used_at) {
    return { error: "Этот код уже активирован. Каждый код одноразовый." };
  }

  if (promo.expires_at) {
    const expiresAt = new Date(promo.expires_at);

    if (!Number.isNaN(expiresAt.getTime()) && expiresAt <= new Date()) {
      return { error: "Срок действия кода истёк. Напишите в поддержку." };
    }
  }

  if (!isPromoCourseId(promo.course_id)) {
    return {
      error: "Код выпущен для курса, которого нет в продаже. Напишите в поддержку.",
    };
  }

  // Курс мог быть куплен раньше: тогда код лучше сохранить для другого человека.
  if (await hasCourseAccess(supabase, user.id, promo.course_id)) {
    return {
      error:
        "Этот курс уже открыт в вашем аккаунте — код остался неиспользованным. Его можно передать другому.",
    };
  }

  const { data: updated, error: updateError } = await admin
    .from("promo_codes")
    .update({ used_at: new Date().toISOString(), used_by: user.id })
    .eq("id", promo.id)
    .is("used_at", null)
    .select("id");

  if (updateError) {
    console.warn("Не удалось активировать промокод:", updateError.message);

    return { error: "Не удалось активировать код. Попробуйте ещё раз." };
  }

  if (!updated || updated.length === 0) {
    return {
      error:
        "Код только что активировали в другой вкладке. Если это были не вы — напишите в поддержку.",
    };
  }

  // Доступ читается на сервере в этих же разделах — сбрасываем кэш, чтобы
  // «Купить» сменилось на «Продолжить обучение» без перезагрузки с очисткой.
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/subscription");
  revalidatePath("/courses");
  revalidatePath(`/courses/${promo.course_id}`);
  revalidatePath(`/course/${promo.course_id}`);
  revalidatePath("/activate");

  return {
    success: "Код активирован — курс открыт в вашем аккаунте.",
    courseHref: `/course/${promo.course_id}`,
  };
}
