import type { NextRequest } from "next/server";
import { Resend } from "resend";

import { getAdminEmails } from "@/lib/admin";
import {
  MODEL_TYPE_LABELS,
  type ModelType,
} from "@/lib/constructor/params";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableSchema } from "@/lib/supabase/schema-errors";

/** Supabase Admin API и Resend работают только в Node.js. */
export const runtime = "nodejs";

/** Отчёт всегда считается заново: кэшировать суточную статистику нельзя. */
export const dynamic = "force-dynamic";

/** Названия товаров для таблицы «Продажи и промокоды». */
const COURSE_TITLES: Record<string, string> = {
  confident: "Уверенный уровень",
  engineer: "Инженер 3D-печати",
  profit: "Заработок на 3D-печати",
  pro: "Пакет «Всё включено»",
  "pro-subscription": "Подписка Pro (легаси)",
};

/** Сколько последних оценок конструктора читаем для средней и комментариев. */
const FEEDBACK_SAMPLE_LIMIT = 1000;

/** Сколько текстовых отзывов показываем в письме. */
const FEEDBACK_COMMENTS_LIMIT = 3;

/**
 * Москва — UTC+3 круглый год: переходов на летнее время нет с 2014 года,
 * поэтому границу месяца можно посчитать без библиотеки часовых поясов.
 * Отчёт всегда про московский месяц, даже если сервер живёт в UTC.
 */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Строка таблицы «Продажи и промокоды»: деньги и подарки рядом. */
type SalesRow = {
  courseId: string;
  title: string;
  /** Оплаченных заказов из purchases. */
  sales: number;
  /** Сумма оплаченных заказов, ₽. */
  amount: number;
  /** Активаций промокодов из promo_codes. */
  promos: number;
};

/** Сколько раз сгенерировали модель каждого типа. */
type ModelBreakdown = {
  modelType: string;
  title: string;
  count: number;
};

/** Текстовый отзыв конструктора для блока обратной связи. */
type FeedbackComment = {
  model: string;
  rating: number;
  text: string;
  createdAt: string;
};

/**
 * Метрики одного окна: «за сутки» или «с начала месяца».
 *
 * Флаги `*Available` говорят, существует ли таблица в живой базе. Миграции
 * применяют вручную, поэтому отсутствие site_visits или
 * constructor_generations — не ошибка отчёта: в письме на месте цифры будет
 * прочерк, а в примечании — какой файл применить.
 */
type WindowStats = {
  /** Начало окна, ISO. */
  since: string;
  newUsers: number;
  /** true — просмотрены не все страницы пользователей (очень большая база). */
  usersTruncated: boolean;
  purchasesCount: number;
  purchasesAmount: number;
  sales: SalesRow[];
  promosCount: number;
  promosAvailable: boolean;
  newReviewsCount: number;
  visits: number;
  visitsAvailable: boolean;
  generationsCount: number;
  generationsByModel: ModelBreakdown[];
  generationsAvailable: boolean;
  feedbackCount: number;
  feedbackAverage: number | null;
  feedbackLow: number;
  feedbackComments: FeedbackComment[];
  feedbackAvailable: boolean;
};

/** Полный отчёт: суточное окно и текущий месяц. */
type ReportStats = {
  /** Момент формирования отчёта. */
  until: string;
  day: WindowStats;
  month: WindowStats;
};

type AdminClient = ReturnType<typeof createAdminClient>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * Новые пользователи в двух окнах за один проход по страницам.
 *
 * Supabase Admin API не отдаёт count напрямую, поэтому читаем страницы
 * listUsers и сравниваем created_at с границами окон. Список приходит от новых
 * к старым, но мы не полагаемся на порядок: проверяем каждую запись и
 * останавливаемся, когда страница кончилась. Десять страниц по 1000 —
 * предохранитель от бесконечного цикла; в письме такая ситуация помечается
 * звёздочкой.
 *
 * Один проход вместо двух важен: суточное окно целиком входит в месячное, и
 * отдельный вызов для каждого окна удваивал бы число запросов к Admin API.
 */
async function countNewUsers(
  admin: AdminClient,
  sinceDayMs: number,
  sinceMonthMs: number,
): Promise<{
  day: { count: number; truncated: boolean };
  month: { count: number; truncated: boolean };
}> {
  const perPage = 1000;
  const maxPages = 10;
  const result = {
    day: { count: 0, truncated: false },
    month: { count: 0, truncated: false },
  };

  let page = 1;

  while (page <= maxPages) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Не удалось прочитать пользователей: ${error.message}`);
    }

    const users = data?.users ?? [];

    for (const user of users) {
      const createdAt = new Date(user.created_at).getTime();

      if (Number.isNaN(createdAt)) {
        continue;
      }

      if (createdAt >= sinceDayMs) {
        result.day.count += 1;
      }

      if (createdAt >= sinceMonthMs) {
        result.month.count += 1;
      }
    }

    if (users.length < perPage) {
      return result;
    }

    page += 1;
  }

  result.day.truncated = true;
  result.month.truncated = true;
  return result;
}

/** Строки, которые читаем из таблиц: только нужные для отчёта колонки. */
type PurchaseRow = { amount: number | string; course_id: string };
type PromoRow = { course_id: string };
type FeedbackRow = {
  rating: number | string;
  feedback_text: string | null;
  model_type: string | null;
  created_at: string;
};
type GenerationRow = { model_type: string };

/**
 * Метрики одного окна. Новых пользователей считает Admin API, их подставляет
 * collectStats — здесь только таблицы PostgREST.
 */
async function collectWindow(
  admin: AdminClient,
  since: string,
): Promise<Omit<WindowStats, "newUsers" | "usersTruncated">> {
  const [
    purchasesResult,
    promosResult,
    reviewsResult,
    feedbackResult,
    visitsResult,
    generationsResult,
  ] = await Promise.all([
    admin
      .from("purchases")
      .select("amount, course_id")
      .gte("created_at", since),
    admin.from("promo_codes").select("course_id").gte("used_at", since),
    admin
      .from("course_reviews")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    admin
      .from("constructor_feedback")
      .select("rating, feedback_text, model_type, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(FEEDBACK_SAMPLE_LIMIT),
    admin
      .from("site_visits")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    admin
      .from("constructor_generations")
      .select("model_type")
      .gte("created_at", since),
  ]);

  if (purchasesResult.error) {
    throw new Error(
      `Не удалось прочитать покупки: ${purchasesResult.error.message}`,
    );
  }

  if (reviewsResult.error) {
    throw new Error(
      `Не удалось прочитать отзывы: ${reviewsResult.error.message}`,
    );
  }

  const purchases = (purchasesResult.data as PurchaseRow[] | null) ?? [];

  // Продажи и промокоды сводим в одну таблицу: видно и деньги, и подарки.
  const byCourse = new Map<string, SalesRow>();

  function courseRow(courseId: string): SalesRow {
    const current = byCourse.get(courseId);

    if (current) {
      return current;
    }

    const created: SalesRow = {
      courseId,
      title: COURSE_TITLES[courseId] ?? courseId,
      sales: 0,
      amount: 0,
      promos: 0,
    };

    byCourse.set(courseId, created);
    return created;
  }

  let purchasesAmount = 0;

  for (const purchase of purchases) {
    const amount = Number(purchase.amount);

    if (!Number.isFinite(amount)) {
      continue;
    }

    purchasesAmount += amount;

    const row = courseRow(purchase.course_id);
    row.sales += 1;
    row.amount += amount;
  }

  const promosAvailable = !promosResult.error;

  if (
    promosResult.error &&
    !isMissingTableSchema(promosResult.error.code, promosResult.error.message)
  ) {
    throw new Error(
      `Не удалось прочитать промокоды: ${promosResult.error.message}`,
    );
  }

  const promos = promosAvailable
    ? ((promosResult.data as PromoRow[] | null) ?? [])
    : [];

  for (const promo of promos) {
    courseRow(promo.course_id).promos += 1;
  }

  const sales = [...byCourse.values()].sort(
    (a, b) =>
      b.amount - a.amount ||
      b.promos - a.promos ||
      a.title.localeCompare(b.title, "ru"),
  );

  const visitsAvailable = !visitsResult.error;

  if (
    visitsResult.error &&
    !isMissingTableSchema(visitsResult.error.code, visitsResult.error.message)
  ) {
    throw new Error(
      `Не удалось прочитать посещения: ${visitsResult.error.message}`,
    );
  }

  const generationsAvailable = !generationsResult.error;

  if (
    generationsResult.error &&
    !isMissingTableSchema(
      generationsResult.error.code,
      generationsResult.error.message,
    )
  ) {
    throw new Error(
      `Не удалось прочитать генерации: ${generationsResult.error.message}`,
    );
  }

  const generations = generationsAvailable
    ? ((generationsResult.data as GenerationRow[] | null) ?? [])
    : [];

  const generationsByType = new Map<string, ModelBreakdown>();

  for (const generation of generations) {
    const current = generationsByType.get(generation.model_type) ?? {
      modelType: generation.model_type,
      title:
        MODEL_TYPE_LABELS[generation.model_type as ModelType] ??
        generation.model_type,
      count: 0,
    };

    current.count += 1;
    generationsByType.set(generation.model_type, current);
  }

  const generationsByModel = [...generationsByType.values()].sort(
    (a, b) => b.count - a.count || a.title.localeCompare(b.title, "ru"),
  );

  const feedbackAvailable = !feedbackResult.error;

  if (
    feedbackResult.error &&
    !isMissingTableSchema(
      feedbackResult.error.code,
      feedbackResult.error.message,
    )
  ) {
    throw new Error(
      `Не удалось прочитать оценки конструктора: ${feedbackResult.error.message}`,
    );
  }

  const feedback = feedbackAvailable
    ? ((feedbackResult.data as FeedbackRow[] | null) ?? [])
    : [];

  const ratings = feedback
    .map((row) => Number(row.rating))
    .filter((rating) => Number.isFinite(rating));

  const feedbackAverage =
    ratings.length === 0
      ? null
      : Math.round(
          (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) *
            10,
        ) / 10;

  const feedbackComments = feedback
    .filter(
      (row) =>
        typeof row.feedback_text === "string" &&
        row.feedback_text.trim().length > 0,
    )
    .slice(0, FEEDBACK_COMMENTS_LIMIT)
    .map((row) => ({
      model: row.model_type
        ? (MODEL_TYPE_LABELS[row.model_type as ModelType] ?? row.model_type)
        : "Модель не указана",
      rating: Number(row.rating),
      text: row.feedback_text!.trim(),
      createdAt: row.created_at,
    }));

  return {
    since,
    purchasesCount: purchases.length,
    purchasesAmount,
    sales,
    promosCount: promos.length,
    promosAvailable,
    newReviewsCount: reviewsResult.count ?? 0,
    visits: visitsResult.count ?? 0,
    visitsAvailable,
    generationsCount: generations.length,
    generationsByModel,
    generationsAvailable,
    feedbackCount: ratings.length,
    feedbackAverage,
    feedbackLow: ratings.filter((rating) => rating <= 3).length,
    feedbackComments,
    feedbackAvailable,
  };
}

/**
 * Собирает статистику за два окна: последние 24 часа и текущий месяц.
 *
 * Границы обоих окон считаются от одного момента `until`, чтобы цифры в письме
 * были согласованы. Месяц — московский календарный, а не «30 дней»: так отчёт
 * 1-го числа показывает начало месяца, а не хвост предыдущего.
 */
async function collectStats(): Promise<ReportStats> {
  const admin = createAdminClient();
  const until = new Date();
  const daySince = new Date(until.getTime() - 24 * 60 * 60 * 1000);

  const mskNow = new Date(until.getTime() + MSK_OFFSET_MS);
  const monthSince = new Date(
    Date.UTC(mskNow.getUTCFullYear(), mskNow.getUTCMonth(), 1) - MSK_OFFSET_MS,
  );

  const [users, day, month] = await Promise.all([
    countNewUsers(admin, daySince.getTime(), monthSince.getTime()),
    collectWindow(admin, daySince.toISOString()),
    collectWindow(admin, monthSince.toISOString()),
  ]);

  return {
    until: until.toISOString(),
    day: {
      ...day,
      newUsers: users.day.count,
      usersTruncated: users.day.truncated,
    },
    month: {
      ...month,
      newUsers: users.month.count,
      usersTruncated: users.month.truncated,
    },
  };
}

/**
 * Сумма в рублях. Нечисло превращаем в прочерк: для NaN Intl отдаёт строку
 * «не число ₽», которая в письме выглядит как сбой отчёта, а не как пустая
 * метрика.
 */
function formatMoney(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Дата и время по Москве: «22 октября, 09:00». */
function formatPeriod(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Дата без времени по Москве: «22 октября». */
function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

/**
 * Название месяца по Москве в именительном падеже: «октябрь».
 *
 * Заголовок блока читается как «Накопительно за октябрь», поэтому месяц берём
 * из данных, а не из константы: 1 ноября письмо само станет ноябрьским, и
 * название не придётся править.
 */
function formatMonthName(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    month: "long",
  }).format(new Date(iso));
}

/** Прочерк вместо цифры, если таблицы ещё нет в базе. */
function metric(value: number, available: boolean): string {
  return available ? String(value) : "—";
}

/** Цвета карточки: фон и подпись. */
type KpiTone = { background: string; label: string };

const KPI_BLUE: KpiTone = { background: "#eff6ff", label: "#1d4ed8" };
const KPI_GREEN: KpiTone = { background: "#f0fdf4", label: "#15803d" };
const KPI_AMBER: KpiTone = { background: "#fefce8", label: "#a16207" };
const KPI_SLATE: KpiTone = { background: "#f8fafc", label: "#475569" };
const KPI_VIOLET: KpiTone = { background: "#f5f3ff", label: "#6d28d9" };

/**
 * Карточка показателя. Ширина 50% и внутренние отступы вместо flex: flex в
 * почтовых клиентах не работает, а таблица с двумя ячейками в строке
 * перестраивается в две колонки даже на узком экране.
 */
function kpiCell(label: string, value: string, tone: KpiTone): string {
  return `<td width="50%" valign="top" style="padding:12px;background:${tone.background};border-radius:12px;">
                        <p style="margin:0;color:${tone.label};font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">${label}</p>
                        <p style="margin:6px 0 0;color:#0f172a;font-size:22px;line-height:1.2;font-weight:800;word-break:break-word;">${value}</p>
                      </td>`;
}

/**
 * Строка таблицы «Покупки по курсам»: деньги и подарки рядом.
 */
function salesRow(row: SalesRow, promosAvailable: boolean): string {
  return `
                        <tr>
                          <td style="padding:9px 0;border-top:1px solid #e2e8f0;color:#0f172a;font-size:13px;line-height:1.35;word-break:break-word;">${escapeHtml(row.title)}</td>
                          <td align="center" style="padding:9px 0;border-top:1px solid #e2e8f0;color:#334155;font-size:13px;">${row.sales}</td>
                          <td align="right" style="padding:9px 0;border-top:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600;white-space:nowrap;">${row.amount > 0 ? formatMoney(row.amount) : "—"}</td>
                          <td align="center" style="padding:9px 0;border-top:1px solid #e2e8f0;color:#334155;font-size:13px;">${promosAvailable ? row.promos : "—"}</td>
                        </tr>`;
}

/** Экранирование текста, который попадает в письмо. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Строка таблицы «Активность». */
function activityRow(
  label: string,
  value: string,
  options: { indent?: boolean; strong?: boolean } = {},
): string {
  const padding = options.indent ? "6px 0 6px 12px" : "8px 0";
  const color = options.indent ? "#64748b" : "#0f172a";
  const size = options.indent ? "12px" : "13px";
  const weight = options.strong ? "700" : "400";

  return `
                        <tr>
                          <td style="padding:${padding};border-top:1px solid #e2e8f0;color:${color};font-size:${size};line-height:1.4;">${label}</td>
                          <td align="right" style="padding:${padding};border-top:1px solid #e2e8f0;color:${color};font-size:${size};font-weight:${weight};white-space:nowrap;">${value}</td>
                        </tr>`;
}

/** Миграции, которых не хватает для метрик окна. */
function missingMigrations(stats: WindowStats): string[] {
  const files: string[] = [];

  if (!stats.promosAvailable) files.push("promo_codes.sql");
  if (!stats.visitsAvailable) files.push("site_visits.sql");
  if (!stats.generationsAvailable) files.push("constructor_generations.sql");
  if (!stats.feedbackAvailable) files.push("constructor_feedback.sql");

  return files;
}

/**
 * Один блок письма: заголовок окна, карточки и две таблицы.
 *
 * Текст заголовка приходит снаружи: суточный блок подписан «За последние
 * 24 часа», месячный — «Накопительно за октябрь». Шаблон один, поэтому оба
 * блока выглядят одинаково и сравниваются глазами построчно.
 */
function renderWindowBlock(
  heading: string,
  period: string,
  stats: WindowStats,
  accent: string,
): string {
  const usersNote = stats.usersTruncated ? " *" : "";
  const average =
    stats.feedbackAvailable && stats.feedbackAverage !== null
      ? `${stats.feedbackAverage.toFixed(1)} / 5`
      : "—";

  const salesRows =
    stats.sales.length === 0
      ? `<tr><td colspan="4" style="padding:12px 0;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;">Продаж и активаций не было.</td></tr>`
      : stats.sales
          .map((row) => salesRow(row, stats.promosAvailable))
          .join("");

  const generationRows = stats.generationsByModel
    .map((row) =>
      activityRow(`в т.ч. ${escapeHtml(row.title)}`, String(row.count), {
        indent: true,
      }),
    )
    .join("");

  const missing = missingMigrations(stats);

  return `
            <tr>
              <td style="padding:24px 28px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;color:${accent};font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">${heading}</p>
                <p style="margin:4px 0 0;color:#64748b;font-size:12px;">${period}</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate;border-spacing:6px;margin-top:12px;">
                  <tr>
                    ${kpiCell("Выручка", formatMoney(stats.purchasesAmount), KPI_BLUE)}
                    ${kpiCell("Покупки", String(stats.purchasesCount), KPI_GREEN)}
                  </tr>
                  <tr>
                    ${kpiCell("Новые ученики", `${stats.newUsers}${usersNote}`, KPI_AMBER)}
                    ${kpiCell("Посещения", metric(stats.visits, stats.visitsAvailable), KPI_VIOLET)}
                  </tr>
                  <tr>
                    ${kpiCell("Генерации STL", metric(stats.generationsCount, stats.generationsAvailable), KPI_SLATE)}
                    ${kpiCell("Промокоды", metric(stats.promosCount, stats.promosAvailable), KPI_SLATE)}
                  </tr>
                </table>
                ${stats.usersTruncated ? `<p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">* просмотрены не все страницы пользователей: цифра может быть меньше.</p>` : ""}

                <h2 style="margin:24px 0 6px;color:#0f172a;font-size:15px;">Покупки по курсам</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <th align="left" style="padding:0 0 4px;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Курс</th>
                    <th align="center" style="padding:0 0 4px;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Продаж</th>
                    <th align="right" style="padding:0 0 4px;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Сумма</th>
                    <th align="center" style="padding:0 0 4px;color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Промо</th>
                  </tr>
                  ${salesRows}
                </table>

                <h2 style="margin:24px 0 6px;color:#0f172a;font-size:15px;">Активность и генерации</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  ${activityRow("Новые ученики", `${stats.newUsers}${usersNote}`)}
                  ${activityRow("Просмотры страниц", metric(stats.visits, stats.visitsAvailable))}
                  ${activityRow("Генерации STL", metric(stats.generationsCount, stats.generationsAvailable), { strong: true })}
                  ${generationRows}
                  ${activityRow("Отзывы о курсах", String(stats.newReviewsCount))}
                  ${activityRow("Оценки конструктора", `${average}${stats.feedbackCount > 0 ? ` · ${stats.feedbackCount}` : ""}`)}
                  ${activityRow("Низкие оценки (1–3)", metric(stats.feedbackLow, stats.feedbackAvailable))}
                </table>

                ${missing.length > 0 ? `<p style="margin:12px 0 0;padding:10px 12px;background:#fff7ed;border-radius:8px;color:#9a3412;font-size:11px;line-height:1.5;">Прочерк — таблицы ещё нет. Примените миграции: ${missing.map((file) => `<code style="font-family:Consolas,monospace;">supabase/${file}</code>`).join(", ")}.</p>` : ""}
              </td>
            </tr>`;
}

/** Блок обратной связи по Конструктору: средняя оценка и последние отзывы. */
function renderFeedbackBlock(stats: WindowStats): string {
  if (!stats.feedbackAvailable) {
    return `
            <tr>
              <td style="padding:24px 28px;border-top:1px solid #e2e8f0;">
                <h2 style="margin:0 0 8px;color:#0f172a;font-size:15px;">Обратная связь по Конструктору</h2>
                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">Таблицы оценок ещё нет — примените <code style="font-family:Consolas,monospace;">supabase/constructor_feedback.sql</code>.</p>
              </td>
            </tr>`;
  }

  const summary =
    stats.feedbackAverage === null
      ? "За текущий месяц оценок ещё не было."
      : `Средняя оценка: <strong>${stats.feedbackAverage.toFixed(1)} из 5</strong> · ${stats.feedbackCount} оценок${stats.feedbackLow > 0 ? ` · ${stats.feedbackLow} ниже 4★` : ""}`;

  const comments =
    stats.feedbackComments.length === 0
      ? `<p style="margin:10px 0 0;color:#64748b;font-size:13px;">Текстовых комментариев за месяц нет.</p>`
      : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:10px;">
                  ${stats.feedbackComments
                    .map(
                      (comment) => `
                  <tr>
                    <td style="padding:10px 12px;background:#f8fafc;border-left:3px solid #f59e0b;border-radius:8px;">
                      <p style="margin:0;color:#0f172a;font-size:13px;line-height:1.55;word-break:break-word;">${escapeHtml(comment.text)}</p>
                      <p style="margin:6px 0 0;color:#64748b;font-size:11px;">${escapeHtml(comment.model)} · ★ ${comment.rating}/5 · ${formatDay(comment.createdAt)}</p>
                    </td>
                  </tr>
                  <tr><td style="height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>`,
                    )
                    .join("")}
                </table>`;

  return `
            <tr>
              <td style="padding:24px 28px;border-top:1px solid #e2e8f0;">
                <h2 style="margin:0 0 8px;color:#0f172a;font-size:15px;">Обратная связь по Конструктору</h2>
                <p style="margin:0;color:#334155;font-size:13px;line-height:1.6;">${summary}</p>
                ${comments}
              </td>
            </tr>`;
}

/**
 * HTML-письмо отчёта.
 *
 * Вёрстка на таблицах и inline-стилях: почтовые клиенты (в том числе Gmail)
 * вырезают <style> и flex/grid, поэтому внешний вид держится на атрибутах.
 * Ширина 600 px — стандарт для писем: её держит атрибут `width` (его понимает
 * Outlook), а inline-стиль `width:100%;max-width:600px` сжимает письмо до
 * экрана телефона. Карточки и таблицы занимают 100% доступной ширины.
 */
function renderDailyReport(stats: ReportStats): string {
  const monthName = formatMonthName(stats.month.since);
  const dayPeriod = `${formatPeriod(stats.day.since)} — ${formatPeriod(stats.until)} (МСК)`;
  const monthPeriod = `${formatDay(stats.month.since)} — ${formatPeriod(stats.until)} (МСК)`;

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>TriDi · сводка за сутки и месяц</title>
  </head>
  <body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;">
                <p style="margin:0;color:#93c5fd;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">TriDi</p>
                <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">Сводка за сутки и месяц</h1>
                <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Сформирована ${formatPeriod(stats.until)} (МСК)</p>
              </td>
            </tr>
            ${renderWindowBlock("За последние 24 часа", dayPeriod, stats.day, "#1d4ed8")}
            ${renderWindowBlock(`Накопительно за ${monthName}`, monthPeriod, stats.month, "#6d28d9")}
            ${renderFeedbackBlock(stats.month)}
            <tr>
              <td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                  Источник: <code style="font-family:Consolas,monospace;">/api/cron/daily-report</code><br />
                  Суммы — по всем покупкам, включая пакет «Всё включено»; старые подписки Pro тоже попадают в отчёт. Отчёт не заменяет сверку в кабинете Robokassa.<br />
                  TriDi · отчёт формируется каждый день в 09:00 МСК
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Текстовая версия для почтовых клиентов без HTML. */
function renderDailyText(stats: ReportStats): string {
  const lines = ["TriDi · сводка за сутки и месяц", ""];

  const pushWindow = (
    title: string,
    period: string,
    windowStats: WindowStats,
  ): void => {
    const average =
      windowStats.feedbackAverage === null
        ? "—"
        : `${windowStats.feedbackAverage.toFixed(1)}/5 (${windowStats.feedbackCount}${
            windowStats.feedbackLow > 0
              ? `, низких: ${windowStats.feedbackLow}`
              : ""
          })`;

    lines.push(
      title.toUpperCase(),
      period,
      "",
      `Выручка: ${formatMoney(windowStats.purchasesAmount)} · покупок: ${windowStats.purchasesCount}`,
      `Новые ученики: ${windowStats.newUsers}${windowStats.usersTruncated ? " (не все страницы)" : ""}`,
      `Посещения: ${metric(windowStats.visits, windowStats.visitsAvailable)} · генерации STL: ${metric(windowStats.generationsCount, windowStats.generationsAvailable)}`,
      `Промокоды: ${metric(windowStats.promosCount, windowStats.promosAvailable)} · отзывы о курсах: ${windowStats.newReviewsCount}`,
      `Оценка конструктора: ${average}`,
    );

    if (windowStats.sales.length === 0) {
      lines.push("  — продаж и активаций не было");
    } else {
      lines.push("По курсам:");

      for (const row of windowStats.sales) {
        const promos = windowStats.promosAvailable
          ? `, промокодов: ${row.promos}`
          : "";

        lines.push(
          `  ${row.title}: ${row.sales} продаж на ${formatMoney(row.amount)}${promos}`,
        );
      }
    }

    if (windowStats.generationsByModel.length > 0) {
      lines.push(
        `Генерации по моделям: ${windowStats.generationsByModel
          .map((model) => `${model.title} — ${model.count}`)
          .join(", ")}`,
      );
    }

    lines.push("");
  };

  pushWindow(
    "За последние 24 часа",
    `${formatPeriod(stats.day.since)} — ${formatPeriod(stats.until)} (МСК)`,
    stats.day,
  );
  pushWindow(
    `Накопительно за ${formatMonthName(stats.month.since)}`,
    `${formatDay(stats.month.since)} — ${formatPeriod(stats.until)} (МСК)`,
    stats.month,
  );

  if (stats.month.feedbackComments.length > 0) {
    lines.push("Последние отзывы о конструкторе:");

    for (const comment of stats.month.feedbackComments) {
      lines.push(
        `  ★ ${comment.rating}/5 · ${comment.model} · ${formatDay(comment.createdAt)}: ${comment.text}`,
      );
    }

    lines.push("");
  }

  lines.push("Источник: /api/cron/daily-report");
  return lines.join("\n");
}

/** Отчёт за сутки и месяц: проверка секрета, сбор статистики и отправка письма. */
async function handleReport(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return json(
      { error: "CRON_SECRET не задан: отчёт не может проверить запрос." },
      503,
    );
  }

  if (!isCronAuthorized(request, secret)) {
    return json({ error: "Неверный или отсутствующий токен." }, 401);
  }

  const dryRun = (new URL(request.url).searchParams.get("dryRun") ?? "") !== "";

  let stats: ReportStats;

  try {
    stats = await collectStats();
  } catch (error) {
    console.error("[daily-report] Ошибка сбора статистики:", error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось собрать статистику.",
      },
      500,
    );
  }

  const html = renderDailyReport(stats);

  // Проверка без отправки: удобно посмотреть письмо в браузере или curl.
  if (dryRun) {
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const adminEmails = getAdminEmails();

  if (adminEmails.length === 0) {
    return json({ error: "ADMIN_EMAIL не задан: некому отправлять отчёт.", stats }, 503);
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    return json(
      {
        sent: false,
        reason:
          "RESEND_API_KEY не задан — письмо не отправлено. Ключ добавляют в .env.local и на хостинге.",
        stats,
        preview: "/api/cron/daily-report?dryRun=1",
      },
      200,
    );
  }

  const resend = new Resend(apiKey);
  const from = process.env.MAIL_FROM?.trim() || "TriDi <onboarding@resend.dev>";
  const subject = `TriDi · сводка за ${formatPeriod(stats.until)}`;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: adminEmails,
      subject,
      html,
      text: renderDailyText(stats),
    });

    if (error) {
      console.error("[daily-report] Resend отклонил письмо:", error.message);

      return json({ sent: false, error: error.message, stats }, 502);
    }

    return json(
      {
        sent: true,
        id: data?.id ?? null,
        recipients: adminEmails.length,
        stats,
      },
      200,
    );
  } catch (error) {
    console.error("[daily-report] Ошибка отправки:", error);

    return json(
      {
        sent: false,
        error:
          error instanceof Error ? error.message : "Неизвестная ошибка отправки.",
        stats,
      },
      502,
    );
  }
}

/**
 * GET — основной способ вызова из cron:
 *   curl -sS "https://tridi-print.ru/api/cron/daily-report" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * POST поддерживается для планировщиков, которые не умеют GET с заголовками.
 */
export async function GET(request: NextRequest): Promise<Response> {
  return handleReport(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleReport(request);
}

