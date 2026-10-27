/**
 * Возвраты за курсы: проверка прогресса и закрытие покупки.
 *
 * Оферта (раздел 7) разрешает возврат цифрового продукта только до открытия
 * платных уроков. Поэтому перед возвратом читаем `lesson_progress`: отмеченный
 * платный урок или сданный тест модуля означают, что курс начат, и возврат
 * запрещён. Бесплатное превью не считается: первые `PREVIEW_LESSONS` урока
 * уровня открыты без покупки (см. `lib/course-access.ts`) — это образец, а не
 * платная часть, и отметка на нём не должна лишать человека возврата.
 *
 * Тесты модулей лежат в той же таблице, но с отдельным `course_type`
 * (`confident-test`…, см. `lib/module-test.ts`), поэтому проверка читает и их:
 * сдать тест модуля, не открыв платные уроки, невозможно.
 *
 * Почему покупка не удаляется: у строки `purchases` есть уникальный `inv_id`, и
 * повторное уведомление Robokassa по тому же заказу не должно снова выдать
 * доступ (вебхук отвечает `OK{InvId}` по коду 23505 и ничего не пишет). Строка
 * закрывается датой — `expires_at` = момент возврата, — а `lib/subscription.ts`
 * считает такую покупку недействительной. Деньги возвращаются в кабинете
 * Robokassa вручную: API возврата у магазина требует отдельного доступа
 * оператора.
 *
 * Модуль серверный: его вызывает только route handler `POST /api/admin/refund`
 * с клиентом service_role — прогресс другого пользователя закрыт RLS.
 */
import { PREVIEW_LESSONS } from "@/lib/course-access";
import { MODULE_TEST_COURSE_TYPES } from "@/lib/module-test";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Товары из `purchases.course_id`, по которым можно оформить возврат. */
export const REFUNDABLE_COURSE_IDS = [
  "confident",
  "engineer",
  "profit",
  "pro",
  "pro-subscription",
] as const;

export type RefundCourseId = (typeof REFUNDABLE_COURSE_IDS)[number];

/** Проверяет, что товар из базы известен: остальное возвращать нечем. */
export function isRefundCourseId(value: string): value is RefundCourseId {
  return (REFUNDABLE_COURSE_IDS as readonly string[]).includes(value);
}

/**
 * Первый платный урок уровня.
 *
 * Всё, что ниже, — бесплатное превью (`PREVIEW_LESSONS` урока открыто без
 * покупки). Если владелец решит блокировать возврат по любой отметке, включая
 * превью, достаточно поставить здесь 1.
 */
export const PAID_LESSON_FROM = PREVIEW_LESSONS + 1;

/**
 * Типы строк `lesson_progress`, по которым видно, что товар начат.
 *
 * Пакет `pro` открывает три уровня и архивный продвинутый курс, поэтому у него
 * в наборе все уроки и все тесты. Легаси-подписка `pro-subscription` даёт только
 * инструменты платформы — уроков у неё нет, проверять нечего.
 */
const COURSE_PROGRESS_TYPES: Record<RefundCourseId, readonly string[]> = {
  confident: ["confident", "confident-test"],
  engineer: ["engineer", "engineer-test"],
  profit: ["profit", "profit-test"],
  pro: [
    "confident",
    "confident-test",
    "engineer",
    "engineer-test",
    "profit",
    "profit-test",
    "pro",
    "pro-test",
  ],
  "pro-subscription": [],
};

/** Все типы, которые влияют на возврат: один запрос на список покупок. */
export const REFUND_PROGRESS_COURSE_TYPES: readonly string[] = Array.from(
  new Set(Object.values(COURSE_PROGRESS_TYPES).flat()),
);

/** Типы строк, которыми пишутся результаты тестов модулей. */
const MODULE_TEST_TYPES = new Set<string>(
  Object.values(MODULE_TEST_COURSE_TYPES),
);

/** Строка `lesson_progress` в том виде, в каком её читает проверка. */
export type LessonProgressRow = {
  course_type: string;
  /** Число или строка: колонка числовая, но ответ базы не гарантирует тип. */
  lesson_id: number | string;
};

/** Что удалось посчитать по прогрессу курса. */
export type CourseProgress = {
  /** Всего отмеченных строк: уроки и тесты. */
  total: number;
  /** Отмеченные платные уроки. */
  paidLessons: number;
  /** Сданные тесты модулей. */
  moduleTests: number;
  /** Отмеченные бесплатные уроки-превью. */
  previewLessons: number;
};

/** Пустой прогресс: новый покупатель, ничего не отмечено. */
const EMPTY_PROGRESS: CourseProgress = {
  total: 0,
  paidLessons: 0,
  moduleTests: 0,
  previewLessons: 0,
};

/**
 * Считает прогресс по строкам `lesson_progress`.
 *
 * Строки чужих курсов пропускаются: страница покупок читает прогресс всех
 * пользователей одним запросом и раскладывает его по покупкам.
 */
export function summarizeCourseProgress(
  rows: readonly LessonProgressRow[],
  courseId: RefundCourseId,
): CourseProgress {
  const allowed = new Set(COURSE_PROGRESS_TYPES[courseId]);
  const progress: CourseProgress = { ...EMPTY_PROGRESS };

  for (const row of rows) {
    if (!allowed.has(row.course_type)) {
      continue;
    }

    progress.total += 1;

    if (MODULE_TEST_TYPES.has(row.course_type)) {
      progress.moduleTests += 1;
      continue;
    }

    const lessonId = Number(row.lesson_id);

    if (Number.isFinite(lessonId) && lessonId >= PAID_LESSON_FROM) {
      progress.paidLessons += 1;
      continue;
    }

    progress.previewLessons += 1;
  }

  return progress;
}

/** Начал ли пользователь платную часть курса. */
export function isCourseStarted(progress: CourseProgress): boolean {
  return progress.paidLessons > 0 || progress.moduleTests > 0;
}

/** Текст отказа по оферте: его показывают админке и возвращают в JSON. */
export const REFUND_DENIED_MESSAGE =
  "Возврат невозможен: пользователь уже начал прохождение курса. Согласно оферте, возврат доступен в течение 7 дней, пока не отмечен ни один платный урок и не сдан ни один тест модуля.";

/** Строка `purchases`, которую читает возврат. */
export type RefundablePurchase = {
  id: string;
  inv_id: number | null;
  user_id: string;
  course_id: string;
  amount: number;
  expires_at: string | null;
  created_at: string;
};

/** Колонки покупки: ровно то, что нужно для решения и отчёта администратору. */
const PURCHASE_COLUMNS =
  "id, inv_id, user_id, course_id, amount, expires_at, created_at";

/** Дата в будущем: срок покупки ещё не истёк. */
function isFutureDate(value: string): boolean {
  const date = new Date(value);

  return !Number.isNaN(date.getTime()) && date > new Date();
}

/** Покупка действует: `expires_at = null` значит «навсегда». */
export function isPurchaseActive(purchase: {
  expires_at: string | null;
}): boolean {
  return purchase.expires_at === null || isFutureDate(purchase.expires_at);
}

type ProgressResult =
  | { ok: true; progress: CourseProgress }
  | { ok: false; error: string };

/**
 * Прогресс пользователя по товару.
 *
 * Ошибка чтения — это отказ, а не «прогресса нет»: оформить возврат, не увидев
 * прогресс, значит закрыть доступ человеку, который курс не начинал, или
 * наоборот — выдать возврат тому, кто его уже прошёл.
 */
export async function loadCourseProgress(
  admin: AdminClient,
  userId: string,
  courseId: RefundCourseId,
): Promise<ProgressResult> {
  const types = COURSE_PROGRESS_TYPES[courseId];

  if (types.length === 0) {
    return { ok: true, progress: { ...EMPTY_PROGRESS } };
  }

  const { data, error } = await admin
    .from("lesson_progress")
    .select("course_type, lesson_id")
    .eq("user_id", userId)
    .in("course_type", types);

  if (error) {
    console.warn("Не удалось прочитать прогресс для возврата:", error.message);

    return {
      ok: false,
      error:
        "Не удалось проверить прогресс курса, поэтому возврат не оформлен. Попробуйте ещё раз.",
    };
  }

  return {
    ok: true,
    progress: summarizeCourseProgress(
      (data as LessonProgressRow[] | null) ?? [],
      courseId,
    ),
  };
}

/** Коды ответа: их же отдаёт route handler. */
export type RefundStatus = 400 | 403 | 404 | 409 | 500;

export type RefundSuccess = {
  ok: true;
  purchase: RefundablePurchase;
  courseId: RefundCourseId;
  /** Момент, которым закрыт доступ (ISO). */
  refundedAt: string;
};

export type RefundFailure = {
  ok: false;
  status: RefundStatus;
  error: string;
  /** Прогресс, из-за которого возврат запрещён (только при 403). */
  progress?: CourseProgress;
};

export type RefundResult = RefundSuccess | RefundFailure;

/**
 * Оформляет возврат: проверяет прогресс и закрывает покупку.
 *
 * Порядок проверок важен: сначала существование покупки и её состояние, потом
 * прогресс. Уже закрытую покупку второй раз не возвращаем (409), иначе админка
 * показывала бы успех там, где ничего не произошло.
 */
export async function refundPurchase(
  admin: AdminClient,
  purchaseId: string,
): Promise<RefundResult> {
  const { data, error } = await admin
    .from("purchases")
    .select(PURCHASE_COLUMNS)
    .eq("id", purchaseId)
    .maybeSingle();

  if (error) {
    console.warn("Не удалось прочитать покупку для возврата:", error.message);

    return {
      ok: false,
      status: 500,
      error: "Не удалось прочитать покупку. Попробуйте ещё раз.",
    };
  }

  const purchase = data as RefundablePurchase | null;

  if (!purchase) {
    return { ok: false, status: 404, error: "Покупка не найдена." };
  }

  if (!isRefundCourseId(purchase.course_id)) {
    return {
      ok: false,
      status: 400,
      error: "Неизвестный товар в покупке: возврат для него не поддерживается.",
    };
  }

  const courseId = purchase.course_id;

  if (!isPurchaseActive(purchase)) {
    return {
      ok: false,
      status: 409,
      error:
        "Доступ по этой покупке уже закрыт: возврат уже оформлен или срок истёк.",
    };
  }

  const progressResult = await loadCourseProgress(
    admin,
    purchase.user_id,
    courseId,
  );

  if (!progressResult.ok) {
    return { ok: false, status: 500, error: progressResult.error };
  }

  if (isCourseStarted(progressResult.progress)) {
    return {
      ok: false,
      status: 403,
      error: REFUND_DENIED_MESSAGE,
      progress: progressResult.progress,
    };
  }

  const refundedAt = new Date().toISOString();
  const { error: closeError } = await admin
    .from("purchases")
    .update({ expires_at: refundedAt })
    .eq("id", purchaseId);

  if (closeError) {
    console.warn("Не удалось закрыть покупку при возврате:", closeError.message);

    return {
      ok: false,
      status: 500,
      error: "Не удалось закрыть доступ. Попробуйте ещё раз.",
    };
  }

  // Строка в логах — единственный след возврата: отдельного журнала в базе нет,
  // а деньги администратор возвращает в кабинете Robokassa.
  console.log("[Возврат] доступ закрыт:", {
    purchaseId,
    invId: purchase.inv_id,
    userId: purchase.user_id,
    courseId,
    amount: purchase.amount,
    refundedAt,
  });

  return { ok: true, purchase, courseId, refundedAt };
}
