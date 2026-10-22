import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Header } from "@/components/Header";
import { PromoCodeForm } from "@/components/promo/PromoCodeForm";
import { isAdminEmail } from "@/lib/admin";
import {
  PROMO_COURSE_IDS,
  PROMO_COURSE_LABELS,
  type PromoCourseId,
} from "@/lib/promo-codes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Промокоды — TriDi",
  description: "Выпуск партий промокодов и выгрузка CSV для Ozon.",
  robots: { index: false, follow: false },
};

/** Партия и активации меняются после каждого действия — без кэша. */
export const dynamic = "force-dynamic";

type PromoRow = {
  code: string;
  course_id: string;
  batch: string | null;
  created_at: string;
  used_at: string | null;
  expires_at: string | null;
};

type CourseStat = {
  courseId: PromoCourseId;
  total: number;
  free: number;
};

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

/** Причина, по которой код нельзя активировать: истёк или уже использован. */
function promoStatus(row: PromoRow): "used" | "expired" | "free" {
  if (row.used_at) {
    return "used";
  }

  if (row.expires_at) {
    const expiresAt = new Date(row.expires_at);

    if (!Number.isNaN(expiresAt.getTime()) && expiresAt <= new Date()) {
      return "expired";
    }
  }

  return "free";
}

/** Название курса по ключу; неизвестный ключ показываем как есть. */
function courseLabel(courseId: string): string {
  return courseId in PROMO_COURSE_LABELS
    ? PROMO_COURSE_LABELS[courseId as PromoCourseId]
    : courseId;
}

/**
 * Админка промокодов.
 *
 * Доступ: реальная сессия Supabase + email из ADMIN_EMAIL, как в /admin/forum.
 * Только после проверки создаётся service_role-клиент: RLS не отдаёт коды
 * обычному пользователю, а админке нужны и свободные, и активированные строки.
 *
 * Устойчивость к неполной базе: если supabase/promo_codes.sql ещё не применили,
 * страница не падает, а показывает инструкцию и работает без формы выпуска.
 */
export default async function AdminPromoPage() {
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
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Header />
        <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Промокоды
          </h1>
          <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-sm leading-relaxed text-red-200">
            Не заданы NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY. Без
            ключа service_role админка не может читать свободные коды.{" "}
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

  const latestResult = await admin
    .from("promo_codes")
    .select("code, course_id, batch, created_at, used_at, expires_at")
    .order("created_at", { ascending: false })
    .limit(30);

  const missingTable =
    latestResult.error?.code === "42P01" ||
    latestResult.error?.code === "PGRST205";

  const latest = (latestResult.data as PromoRow[] | null) ?? [];


  let stats: CourseStat[] = [];

  if (!latestResult.error) {
    stats = await Promise.all(
      PROMO_COURSE_IDS.map(async (courseId) => {
        const [total, free] = await Promise.all([
          admin
            .from("promo_codes")
            .select("id", { count: "exact", head: true })
            .eq("course_id", courseId),
          admin
            .from("promo_codes")
            .select("id", { count: "exact", head: true })
            .eq("course_id", courseId)
            .is("used_at", null),
        ]);

        return { courseId, total: total.count ?? 0, free: free.count ?? 0 };
      }),
    );
  }

  const freeByCourse = new Map<PromoCourseId, number>(
    stats.map((stat) => [stat.courseId, stat.free]),
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />

      <main className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-300 uppercase">
              Админка
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Промокоды
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              Одноразовые коды на курсы. Покупатель активирует код по ссылке из
              CSV, курс открывается сразу в его аккаунте. Активация не создаёт
              покупку, поэтому не попадает в выручку Robokassa.
            </p>
          </div>
          <Link
            href="/admin/forum"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-4 text-xs font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white"
          >
            Модерация форума
          </Link>
        </div>

        {missingTable ? (
          <section className="mt-8 rounded-3xl border border-amber-400/30 bg-amber-500/10 p-6">
            <h2 className="text-lg font-bold text-amber-100">
              Таблица promo_codes ещё не создана
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-amber-100/90">
              Откройте Supabase Dashboard → SQL Editor и примените{" "}
              <code className="rounded bg-slate-950/60 px-1.5 py-0.5 font-mono text-xs">
                supabase/promo_codes.sql
              </code>
              . После этого обновите страницу: появятся форма выпуска и выгрузка
              CSV.
            </p>
          </section>
        ) : null}

        {latestResult.error && !missingTable ? (
          <section className="mt-8 rounded-3xl border border-red-400/30 bg-red-500/10 p-6">
            <h2 className="text-lg font-bold text-red-100">
              Не удалось прочитать коды
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-red-200/90">
              {latestResult.error.message}
            </p>
          </section>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {missingTable ? null : <PromoCodeForm />}

          <div className="space-y-6">
            <section
              aria-labelledby="promo-export"
              className="rounded-3xl border border-blue-400/20 bg-blue-500/5 p-6 sm:p-7"
            >
              <h2
                id="promo-export"
                className="text-xl font-extrabold tracking-tight text-white"
              >
                Экспорт для Ozon
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                CSV с колонками «Код» и «Ссылка на активацию». В файл попадают
                только неиспользованные коды выбранного курса — повторная
                выгрузка не пришлёт уже активированные.
              </p>

              {missingTable ? (
                <p className="mt-4 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-4 text-sm text-slate-300">
                  Выгрузка станет доступна после создания таблицы.
                </p>
              ) : (
                <form
                  method="get"
                  action="/api/admin/promo/csv"
                  className="mt-5 space-y-4"
                >
                  <div>
                    <label
                      htmlFor="csv-course"
                      className="block text-xs font-semibold text-slate-300"
                    >
                      Курс
                    </label>
                    <select
                      id="csv-course"
                      name="course"
                      defaultValue={PROMO_COURSE_IDS[0]}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                    >
                      {PROMO_COURSE_IDS.map((courseId) => (
                        <option key={courseId} value={courseId}>
                          {PROMO_COURSE_LABELS[courseId]} — свободно{" "}
                          {freeByCourse.get(courseId) ?? 0}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                  >
                    Скачать CSV для Ozon
                  </button>
                </form>
              )}
            </section>


            <section
              aria-labelledby="promo-stats"
              className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7"
            >
              <h2
                id="promo-stats"
                className="text-xl font-extrabold tracking-tight text-white"
              >
                Сводка
              </h2>

              {stats.length === 0 ? (
                <p className="mt-3 text-sm text-slate-300">Данных пока нет.</p>
              ) : (
                <dl className="mt-4 space-y-3">
                  {stats.map((stat) => (
                    <div
                      key={stat.courseId}
                      className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-3 last:border-b-0 last:pb-0"
                    >
                      <dt className="text-sm text-slate-300">
                        {PROMO_COURSE_LABELS[stat.courseId]}
                      </dt>
                      <dd className="text-right text-sm font-semibold text-white">
                        {stat.free}{" "}
                        <span className="font-normal text-slate-400">
                          свободно из {stat.total}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </div>
        </div>

        {latest.length > 0 ? (
          <section
            aria-labelledby="promo-latest"
            className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-7"
          >
            <h2
              id="promo-latest"
              className="text-xl font-extrabold tracking-tight text-white"
            >
              Последние коды
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              До 30 последних записей. Полный список свободных кодов — в CSV.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/15 text-xs tracking-wide text-slate-400 uppercase">
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Код
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Курс
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Партия
                    </th>
                    <th scope="col" className="py-2 pr-4 font-semibold">
                      Выпущен
                    </th>
                    <th scope="col" className="py-2 font-semibold">
                      Статус
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((row) => {
                    const status = promoStatus(row);

                    return (
                      <tr
                        key={row.code}
                        className="border-b border-white/5 align-top last:border-b-0"
                      >
                        <td className="py-3 pr-4 font-mono text-xs text-white">
                          {row.code}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {courseLabel(row.course_id)}
                        </td>
                        <td className="py-3 pr-4 text-slate-400">
                          {row.batch ?? "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-400">
                          {formatDateTime(row.created_at)}
                        </td>
                        <td className="py-3">
                          {status === "used" ? (
                            <span className="rounded-full border border-slate-400/30 bg-slate-500/10 px-2.5 py-1 text-xs font-semibold text-slate-300">
                              Активирован
                              {row.used_at
                                ? ` · ${formatDateTime(row.used_at)}`
                                : ""}
                            </span>
                          ) : status === "expired" ? (
                            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                              Срок истёк
                            </span>
                          ) : (
                            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                              Свободен
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

