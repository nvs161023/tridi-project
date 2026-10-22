import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";
import { Resend } from "resend";

import { getAdminEmails } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/** Supabase Admin API и Resend работают только в Node.js. */
export const runtime = "nodejs";

/** Отчёт всегда считается заново: кэшировать суточную статистику нельзя. */
export const dynamic = "force-dynamic";

/** Названия товаров для таблицы «Покупки по курсам». */
const COURSE_TITLES: Record<string, string> = {
  confident: "Уверенный уровень",
  engineer: "Инженер 3D-печати",
  profit: "Заработок на 3D-печати",
  pro: "Пакет «Все 3 уровня»",
  "pro-subscription": "Подписка Pro",
};

type CourseBreakdown = {
  courseId: string;
  title: string;
  count: number;
  amount: number;
};

type DailyStats = {
  /** Начало окна: 24 часа назад. */
  since: string;
  /** Момент формирования отчёта. */
  until: string;
  newUsers: number;
  /** true — просмотрены не все страницы пользователей (очень большая база). */
  usersTruncated: boolean;
  purchasesCount: number;
  purchasesAmount: number;
  purchasesByCourse: CourseBreakdown[];
  reviewsCount: number;
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
 * Проверка секрета из заголовка Authorization.
 *
 * timingSafeEqual не даёт измерить по времени, сколько первых символов секрета
 * совпало. Длину сравниваем отдельно: timingSafeEqual требует одинаковых буферов.
 */
function isAuthorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";

  if (!header.startsWith(prefix)) {
    return false;
  }

  const token = Buffer.from(header.slice(prefix.length).trim(), "utf8");
  const expected = Buffer.from(secret, "utf8");

  if (token.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(token, expected);
}

/**
 * Новые пользователи за окно.
 *
 * Supabase Admin API не отдаёт count напрямую, поэтому читаем страницы
 * listUsers и считаем created_at. Список приходит от новых к старым, но мы не
 * полагаемся на порядок: проверяем каждую запись и останавливаемся, когда
 * страница кончилась. Десять страниц по 1000 — предохранитель от бесконечного
 * цикла; в письме такая ситуация помечается звёздочкой.
 */
async function countNewUsers(
  admin: AdminClient,
  sinceMs: number,
): Promise<{ count: number; truncated: boolean }> {
  const perPage = 1000;
  const maxPages = 10;

  let count = 0;
  let page = 1;

  while (page <= maxPages) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw new Error(`Не удалось прочитать пользователей: ${error.message}`);
    }

    const users = data?.users ?? [];

    for (const user of users) {
      const createdAt = new Date(user.created_at).getTime();

      if (!Number.isNaN(createdAt) && createdAt >= sinceMs) {
        count += 1;
      }
    }

    if (users.length < perPage) {
      return { count, truncated: false };
    }

    page += 1;
  }

  return { count, truncated: true };
}

/** Собирает всю статистику за последние 24 часа. */
async function collectStats(): Promise<DailyStats> {
  const admin = createAdminClient();
  const until = new Date();
  const sinceDate = new Date(until.getTime() - 24 * 60 * 60 * 1000);
  const since = sinceDate.toISOString();

  const [users, purchasesResult, reviewsResult] = await Promise.all([
    countNewUsers(admin, sinceDate.getTime()),
    admin
      .from("purchases")
      .select("amount, course_id")
      .gte("created_at", since),
    admin
      .from("course_reviews")
      .select("id", { count: "exact", head: true })
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

  const purchases =
    (purchasesResult.data as { amount: number | string; course_id: string }[] | null) ??
    [];

  const byCourse = new Map<string, CourseBreakdown>();
  let purchasesAmount = 0;

  for (const purchase of purchases) {
    const amount = Number(purchase.amount);

    if (!Number.isFinite(amount)) {
      continue;
    }

    purchasesAmount += amount;

    const current = byCourse.get(purchase.course_id) ?? {
      courseId: purchase.course_id,
      title: COURSE_TITLES[purchase.course_id] ?? purchase.course_id,
      count: 0,
      amount: 0,
    };

    current.count += 1;
    current.amount += amount;
    byCourse.set(purchase.course_id, current);
  }

  return {
    since,
    until: until.toISOString(),
    newUsers: users.count,
    usersTruncated: users.truncated,
    purchasesCount: purchases.length,
    purchasesAmount,
    purchasesByCourse: [...byCourse.values()].sort((a, b) => b.amount - a.amount),
    reviewsCount: reviewsResult.count ?? 0,
  };
}


/** Сумма в рублях без копеек: 12 540 ₽. */
function formatMoney(value: number): string {
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

/** Экранирование текста, который попадает в письмо. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * HTML-письмо отчёта.
 *
 * Вёрстка на таблицах и inline-стилях: почтовые клиенты (в том числе Gmail)
 * вырезают <style> и flex/grid, поэтому внешний вид держится на атрибутах.
 * Ширина 600 px — стандарт для писем.
 */
function renderDailyReport(stats: DailyStats): string {
  const period = `${formatPeriod(stats.since)} — ${formatPeriod(stats.until)} (МСК)`;
  const usersNote = stats.usersTruncated ? " *" : "";

  const courseRows =
    stats.purchasesByCourse.length === 0
      ? `<tr><td colspan="3" style="padding:12px 0;color:#64748b;font-size:14px;">За сутки покупок не было.</td></tr>`
      : stats.purchasesByCourse
          .map(
            (row) => `
              <tr>
                <td style="padding:10px 0;border-top:1px solid #e2e8f0;color:#0f172a;font-size:14px;">${escapeHtml(row.title)}</td>
                <td align="center" style="padding:10px 0;border-top:1px solid #e2e8f0;color:#334155;font-size:14px;">${row.count}</td>
                <td align="right" style="padding:10px 0;border-top:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600;">${formatMoney(row.amount)}</td>
              </tr>`,
          )
          .join("");

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>TriDi · ежедневный отчёт</title>
  </head>
  <body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;border-collapse:collapse;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;">
                <p style="margin:0;color:#93c5fd;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">TriDi</p>
                <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">Ежедневный отчёт</h1>
                <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">${period}</p>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td width="33%" valign="top" style="padding:14px;background:#eff6ff;border-radius:12px;">
                      <p style="margin:0;color:#1d4ed8;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Новые ученики</p>
                      <p style="margin:6px 0 0;color:#0f172a;font-size:26px;font-weight:800;">${stats.newUsers}${usersNote}</p>
                    </td>
                    <td width="8"></td>
                    <td width="33%" valign="top" style="padding:14px;background:#f0fdf4;border-radius:12px;">
                      <p style="margin:0;color:#15803d;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Покупки</p>
                      <p style="margin:6px 0 0;color:#0f172a;font-size:26px;font-weight:800;">${stats.purchasesCount}</p>
                    </td>
                    <td width="8"></td>
                    <td width="33%" valign="top" style="padding:14px;background:#fefce8;border-radius:12px;">
                      <p style="margin:0;color:#a16207;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Выручка</p>
                      <p style="margin:6px 0 0;color:#0f172a;font-size:22px;font-weight:800;">${formatMoney(stats.purchasesAmount)}</p>
                    </td>
                  </tr>
                </table>

                <h2 style="margin:26px 0 8px;color:#0f172a;font-size:16px;">Покупки по курсам</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <th align="left" style="padding:0 0 6px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Курс</th>
                    <th align="center" style="padding:0 0 6px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Покупок</th>
                    <th align="right" style="padding:0 0 6px;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Сумма</th>
                  </tr>
                  ${courseRows}
                </table>

                <h2 style="margin:26px 0 8px;color:#0f172a;font-size:16px;">Отзывы</h2>
                <p style="margin:0;color:#334155;font-size:14px;">
                  Новых отзывов за сутки: <strong style="color:#0f172a;">${stats.reviewsCount}</strong>
                </p>

                <p style="margin:20px 0 0;padding:14px 16px;background:#f8fafc;border-radius:12px;color:#475569;font-size:12px;line-height:1.6;">
                  Сумма — по всем покупкам за 24 часа, включая пакет «Все 3 уровня» и подписку Pro.
                  Отчёт собирается автоматически по расписанию и не заменяет сверку в кабинете Robokassa.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                  Источник: <code style="font-family:Consolas,monospace;">/api/cron/daily-report</code><br />
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
function renderDailyText(stats: DailyStats): string {
  const lines = [
    "TriDi · ежедневный отчёт",
    `${formatPeriod(stats.since)} — ${formatPeriod(stats.until)} (МСК)`,
    "",
    `Новые ученики: ${stats.newUsers}${stats.usersTruncated ? " (не все страницы)" : ""}`,
    `Покупки: ${stats.purchasesCount} на ${formatMoney(stats.purchasesAmount)}`,
    `Новые отзывы: ${stats.reviewsCount}`,
    "",
    "Покупки по курсам:",
  ];

  if (stats.purchasesByCourse.length === 0) {
    lines.push("  — за сутки покупок не было");
  } else {
    for (const row of stats.purchasesByCourse) {
      lines.push(`  ${row.title}: ${row.count} на ${formatMoney(row.amount)}`);
    }
  }

  lines.push("", "Источник: /api/cron/daily-report");
  return lines.join("\n");
}

/** Отчёт за сутки: проверка секрета, сбор статистики и отправка письма. */
async function handleReport(request: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return json(
      { error: "CRON_SECRET не задан: отчёт не может проверить запрос." },
      503,
    );
  }

  if (!isAuthorized(request, secret)) {
    return json({ error: "Неверный или отсутствующий токен." }, 401);
  }

  const dryRun = (new URL(request.url).searchParams.get("dryRun") ?? "") !== "";

  let stats: DailyStats;

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
  const subject = `TriDi · отчёт за ${formatPeriod(stats.until)}`;

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

