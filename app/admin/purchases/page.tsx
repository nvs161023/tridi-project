import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RefundButton } from "@/components/admin/RefundButton";
import { Header } from "@/components/Header";
import { isAdminEmail } from "@/lib/admin";
import {
  REFUND_PROGRESS_COURSE_TYPES,
  isCourseStarted,
  isPurchaseActive,
  isRefundCourseId,
  summarizeCourseProgress,
  type CourseProgress,
  type LessonProgressRow,
} from "@/lib/refund";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Покупки и возвраты — TriDi",
  description: "Возвраты за курсы: проверка прогресса и закрытие доступа.",
  robots: { index: false, follow: false },
};

/** Возвраты меняют покупки — без кэша. */
export const dynamic = "force-dynamic";

/** Сколько последних покупок показываем: остальное ищется в кабинете Robokassa. */
const PURCHASES_LIMIT = 50;

/** Названия товаров: совпадают с витриной и офертой. */
const COURSE_LABELS: Record<string, string> = {
  confident: "Уверенный уровень",
  engineer: "Инженер 3D-печати",
  profit: "Заработок на 3D-печати",
  pro: "Пакет «Всё включено»",
  "pro-subscription": "Подписка Pro (легаси)",
};

type PurchaseRow = {
  id: string;
  inv_id: number | null;
  user_id: string;
  course_id: string;
  amount: number | string;
  created_at: string;
  expires_at: string | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
};

/** Строка прогресса вместе с владельцем: один запрос на все покупки. */
type ProgressRow = LessonProgressRow & { user_id: string };

/** Дата и время в русском формате: «18 октября 2026, 14:30». */
function formatDateTime(value: string): string {
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

/** Сумма покупки: «2 990 ₽», для нечисла — прочерк. */
function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) {
    return "—";
  }

  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 2,
  }).format(amount)} ₽`;
}

/** Название товара по ключу; неизвестный ключ показываем как есть. */
function courseLabel(courseId: string): string {
  return COURSE_LABELS[courseId] ?? courseId;
}

/** Имя покупателя: имя, иначе email, иначе короткий id. */
function authorLabel(profiles: Map<string, ProfileRow>, id: string): string {
  const profile = profiles.get(id);
  const name = profile?.name?.trim();

  if (name) return name;
  if (profile?.email) return profile.email;
  return `Ученик ${id.slice(0, 8)}`;
}

/** Подробности прогресса для ячейки таблицы. */
function progressDetails(progress: CourseProgress): string {
  const parts: string[] = [];

  if (progress.paidLessons > 0) {
    parts.push(`платных уроков: ${progress.paidLessons}`);
  }

  if (progress.moduleTests > 0) {
    parts.push(`тестов модулей: ${progress.moduleTests}`);
  }

  return parts.join(", ");
}

/**
 * Админка покупок и возвратов.
 *
 * Доступ: реальная сессия Supabase + email из `ADMIN_EMAIL`, как в `/admin/forum`
 * и `/admin/promo`. Только после проверки создаётся service_role-клиент: RLS
 * отдаёт пользователю лишь свои покупки, а админке нужны все, вместе с прогрессом
 * чужих аккаунтов.
 *
 * Решение о возврате принимает не страница, а `POST /api/admin/refund`
 * (`lib/refund.ts`): кнопка на странице только показывает, начат ли курс, чтобы
 * администратор не нажимал её наугад.
 */
export default async function AdminPurchasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    notFound();
  }

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return (
      <div className="min-h-screen text-slate-100">
        <Header />
        <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Покупки и возвраты
          </h1>
          <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-sm leading-relaxed text-red-200">
            Не заданы NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY. Без
            ключа service_role админка не может читать покупки.{" "}
            <Link
              href="/admin/forum"
              className="font-semibold text-red-100 underline underline-offset-4"
            >
              Вернуться к модерации форума
            </Link>
          </p>
        </main>
      </div>
    );
  }

  const purchasesResult = await admin
    .from("purchases")
    .select("id, inv_id, user_id, course_id, amount, created_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(PURCHASES_LIMIT);

  const purchases = (purchasesResult.data as PurchaseRow[] | null) ?? [];
  const userIds = Array.from(new Set(purchases.map((row) => row.user_id)));

  const profiles = new Map<string, ProfileRow>();
  const progressByUser = new Map<string, ProgressRow[]>();
  let progressUnavailable = false;

  if (userIds.length > 0) {
    const [profilesResult, progressResult] = await Promise.all([
      admin.from("profiles").select("id, name, email").in("id", userIds),
      admin
        .from("lesson_progress")
        .select("user_id, course_type, lesson_id")
        .in("user_id", userIds)
        .in("course_type", REFUND_PROGRESS_COURSE_TYPES),
    ]);

    for (const profile of (profilesResult.data as ProfileRow[] | null) ?? []) {
      profiles.set(profile.id, profile);
    }

    for (const row of (progressResult.data as ProgressRow[] | null) ?? []) {
      const list = progressByUser.get(row.user_id) ?? [];
      list.push(row);
      progressByUser.set(row.user_id, list);
    }

    // Прогресс нужен только для подсказки: если он не прочитался, возврат всё
    // равно проверит сервер и откажет, если курс начат.
    progressUnavailable = Boolean(progressResult.error);

    if (progressResult.error) {
      console.warn(
        "Не удалось прочитать прогресс для списка покупок:",
        progressResult.error.message,
      );
    }
  }

  return (
    <div className="min-h-screen text-slate-100">
      <Header />

      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-300 uppercase">
              Админка
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Покупки и возвраты
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              Последние {PURCHASES_LIMIT} покупок. Возврат закрывает доступ по
              оферте: если ученик открыл платные уроки или сдал тест модуля,
              сервер ответит 403 и ничего не закроет.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/forum"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-4 text-xs font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white"
            >
              Модерация форума
            </Link>
            <Link
              href="/admin/promo"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-4 text-xs font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white"
            >
              Промокоды
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 text-sm leading-relaxed text-amber-100">
          <p>
            Возврат закрывает доступ: покупка получает{" "}
            <code className="rounded bg-slate-950/60 px-1.5 py-0.5 text-xs">
              expires_at
            </code>{" "}
            = момент возврата, а деньги администратор возвращает в кабинете
            Robokassa вручную. Первые два урока уровня — бесплатное превью,
            отметки на них возврат не блокируют.
          </p>
        </section>

        {purchasesResult.error ? (
          <p className="mt-6 rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-sm leading-relaxed text-red-200">
            Не удалось прочитать покупки. Обновите страницу; если таблицы{" "}
            <code className="rounded bg-slate-950/60 px-1.5 py-0.5 text-xs">
              purchases
            </code>{" "}
            нет, примените <code>supabase/purchases.sql</code>.
          </p>
        ) : purchases.length === 0 ? (
          <p className="mt-6 rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-sm text-slate-300">
            Покупок пока нет.
          </p>
        ) : (
          <>
            {progressUnavailable ? (
              <p className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100">
                Прогресс курсов прочитать не удалось — колонка «Прогресс» пуста.
                Возврат всё равно проверит прогресс на сервере.
              </p>
            ) : null}

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/15 text-xs tracking-wide text-slate-400 uppercase">
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Оплачен
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Покупатель
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Товар
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Сумма
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Заказ
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Прогресс
                    </th>
                    <th scope="col" className="py-2 font-semibold">
                      Возврат
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => {
                    const courseId = isRefundCourseId(purchase.course_id)
                      ? purchase.course_id
                      : null;
                    const active = isPurchaseActive(purchase);
                    const progress = courseId
                      ? summarizeCourseProgress(
                          progressByUser.get(purchase.user_id) ?? [],
                          courseId,
                        )
                      : null;
                    const started =
                      progress !== null && isCourseStarted(progress);

                    return (
                      <tr
                        key={purchase.id}
                        className="border-b border-white/5 align-top last:border-b-0"
                      >
                        <td className="py-3 pr-4 whitespace-nowrap text-slate-400">
                          {formatDateTime(purchase.created_at)}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {authorLabel(profiles, purchase.user_id)}
                        </td>
                        <td className="py-3 pr-4 text-slate-200">
                          {courseLabel(purchase.course_id)}
                        </td>
                        <td className="py-3 pr-4 font-semibold whitespace-nowrap text-white">
                          {formatMoney(Number(purchase.amount))}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-400">
                          {purchase.inv_id ?? "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {progress === null || !active ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            <span className="flex flex-col gap-1">
                              <span
                                className={
                                  started
                                    ? "w-fit rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200"
                                    : "w-fit rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200"
                                }
                              >
                                {started ? "Курс начат" : "Курс не начат"}
                              </span>
                              <span className="text-xs text-slate-400">
                                {started
                                  ? progressDetails(progress)
                                  : progress.previewLessons > 0
                                    ? `только превью: ${progress.previewLessons}`
                                    : "нет отметок"}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          {active ? (
                            <RefundButton
                              purchaseId={purchase.id}
                              courseLabel={courseLabel(purchase.course_id)}
                              amountLabel={formatMoney(Number(purchase.amount))}
                            />
                          ) : (
                            <span className="text-xs leading-relaxed text-slate-400">
                              Доступ закрыт
                              {purchase.expires_at
                                ? ` ${formatDateTime(purchase.expires_at)}`
                                : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}


