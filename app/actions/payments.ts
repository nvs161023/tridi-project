"use server";

import { authHref } from "@/lib/auth-redirect";
import {
  getPaymentAmount,
  initializePayment,
  isPaymentCourseId,
} from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

export type CreatePaymentResult =
  | { url: string }
  | { error: string; loginHref?: string };

/**
 * Создаёт ссылку на оплату Robokassa для текущего пользователя.
 *
 * Из браузера приходит только ключ тарифа: id пользователя и email берём из
 * сессии, цену — из data/courses.json. Поэтому подменить сумму или оплатить
 * курс от имени другого аккаунта через этот Server Action нельзя.
 */
export async function createRobokassaPayment(
  courseId: string,
): Promise<CreatePaymentResult> {
  if (!isPaymentCourseId(courseId)) {
    return { error: "Неизвестный тариф. Обновите страницу и попробуйте снова." };
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        error: "Чтобы оплатить курс, войдите в аккаунт.",
        loginHref: authHref("/auth/login", "/subscription#pricing"),
      };
    }

    const payment = initializePayment({
      courseId,
      amount: getPaymentAmount(courseId),
      userEmail: user.email ?? null,
      userId: user.id,
    });

    return { url: payment.url };
  } catch (error) {
    // В лог — только текст ошибки: пароли Robokassa не должны попасть в логи.
    console.error(
      "Не удалось создать платёж Robokassa:",
      error instanceof Error ? error.message : "неизвестная ошибка",
    );

    return {
      error:
        "Оплата временно недоступна. Попробуйте ещё раз через минуту или напишите нам.",
    };
  }
}
