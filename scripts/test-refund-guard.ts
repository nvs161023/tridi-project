/* eslint-disable @typescript-eslint/no-explicit-any -- временный скрипт проверки: динамические ответы Supabase и cookies. */
/**
 * Проверка защиты от возврата для начатых курсов.
 *
 * Запуск (сервер уже слушает, по умолчанию http://127.0.0.1:3135, в его
 * окружении `ADMIN_EMAIL=refund-test-admin@example.com`):
 *   node scripts/test-refund-guard.ts
 *
 * Что делает:
 *  1. создаёт временного пользователя через Admin API Supabase;
 *  2. заводит ему покупки в `purchases`: без прогресса, с превью-уроком, с
 *     платным уроком, с тестом модуля, пакет `pro`, легаси-подписку и уже
 *     закрытую покупку;
 *  3. входит тестовым админом (email из `ADMIN_EMAIL` сервера) и дергает
 *     `POST /api/admin/refund` для каждой покупки;
 *  4. проверяет коды ответа, текст оферты, состояние `purchases.expires_at` и
 *     что без прав администратора роут отвечает 403;
 *  5. удаляет тестовые строки, ученика и тестового админа.
 *
 * Код сайта не меняется. Изображения не снимаются — только текст.
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE_URL = process.env.REFUND_TEST_BASE_URL ?? "http://127.0.0.1:3135";

/** Текст отказа из задачи: роут должен отвечать именно им. */
const DENIED_MESSAGE =
  "Возврат невозможен: пользователь уже начал прохождение курса. Согласно оферте, возврат доступен только до открытия платных уроков.";


let failures = 0;

/** Печатает результат одной проверки и считает провалы. */
function check(name: string, ok: boolean, details: string) {
  console.log(`${ok ? "✓" : "✗"} ${name} — ${details}`);

  if (!ok) {
    failures += 1;
  }
}

/** Читает файл переменных окружения проекта: ключ=значение, без кавычек. */
function readEnv(file: string): Record<string, string> {
  const full = path.join(ROOT, file);

  if (!fs.existsSync(full)) {
    return {};
  }

  const env: Record<string, string> = {};

  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index <= 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

const localEnv = readEnv(".env.local");

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? localEnv.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? localEnv.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Тестовый админ. Его email должен стоять в `ADMIN_EMAIL` окружения сервера —
 * тогда `isAdminEmail` пропустит сессию к роуту. Пароль случайный и живёт только
 * в этом прогоне: вход не зависит от писем Supabase.
 */
const ADMIN_TEST_EMAIL = "refund-test-admin@example.com";
const ADMIN_TEST_PASSWORD = `Adm-${randomBytes(12).toString("hex")}`;

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error(
    "Нужны NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY и SUPABASE_SERVICE_ROLE_KEY в .env.local",
  );
  process.exit(1);
}


const admin = createSupabaseClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Создаёт тестового админа или обновляет ему пароль. Возвращает его id. */
async function ensureAdminUser(): Promise<string> {
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: ADMIN_TEST_EMAIL,
      password: ADMIN_TEST_PASSWORD,
      email_confirm: true,
    });

  if (!createError && created.user) {
    return created.user.id;
  }

  // Пользователь остался от прошлого прогона: ставим новый пароль.
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(`Не удалось прочитать пользователей: ${error.message}`);
    }

    const found = data.users.find(
      (user) =>
        (user.email ?? "").toLowerCase() === ADMIN_TEST_EMAIL.toLowerCase(),
    );

    if (found) {
      await admin.auth.admin.updateUserById(found.id, {
        password: ADMIN_TEST_PASSWORD,
        email_confirm: true,
      });

      return found.id;
    }

    if (data.users.length < 200) {
      break;
    }
  }

  throw new Error(
    `Не удалось подготовить админа ${ADMIN_TEST_EMAIL}: ${
      createError?.message ?? "пользователь не вернулся"
    }`,
  );
}

/** Cookies админской сессии: заголовок Cookie для fetch. */
async function buildAdminCookie(): Promise<string> {
  const anon = createSupabaseClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signed, error: signError } = await anon.auth.signInWithPassword(
    { email: ADMIN_TEST_EMAIL, password: ADMIN_TEST_PASSWORD },
  );

  if (signError || !signed?.session) {
    throw new Error(
      `Не удалось войти тестовым админом: ${signError?.message ?? "нет сессии"}`,
    );
  }

  let jar: any[] = [];
  const ssr = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => jar,
      setAll: (list: any[]) => {
        jar = list;
      },
    },
  });

  const { error: sessionError } = await ssr.auth.setSession({
    access_token: signed.session.access_token,
    refresh_token: signed.session.refresh_token,
  });

  if (sessionError || jar.length === 0) {
    throw new Error(
      `Не удалось собрать cookies сессии: ${sessionError?.message ?? "пусто"}`,
    );
  }

  return jar.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

/** Номер заказа: уникальный, как у Robokassa. */
let nextInvId = 991_000_000 + Math.floor(Math.random() * 1_000_000);

/** Создаёт покупку тестового пользователя и возвращает её id. */
async function createPurchase(
  userId: string,
  courseId: string,
  amount: number,
  expiresAt: string | null = null,
): Promise<string> {
  const { data, error } = await admin
    .from("purchases")
    .insert({
      inv_id: nextInvId++,
      user_id: userId,
      course_id: courseId,
      amount,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Не удалось создать покупку ${courseId}: ${error?.message}`);
  }

  return (data as { id: string }).id;
}

/** Читает состояние покупки после возврата. */
async function readPurchase(purchaseId: string) {
  const { data, error } = await admin
    .from("purchases")
    .select("expires_at")
    .eq("id", purchaseId)
    .maybeSingle();

  if (error) {
    throw new Error(`Не удалось прочитать покупку: ${error.message}`);
  }

  return data as { expires_at: string | null } | null;
}

/** Вызов роута возврата: статус и тело ответа. */
async function refund(purchaseId: string, cookie: string | null) {
  const response = await fetch(`${BASE_URL}/api/admin/refund`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ purchaseId }),
  });

  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    progress?: { paidLessons: number; moduleTests: number };
  } | null;

  return { status: response.status, body };
}

/** Закрыта ли покупка: дата в прошлом или настоящем. */
function isClosed(expiresAt: string | null): boolean {
  if (!expiresAt) {
    return false;
  }

  const date = new Date(expiresAt);

  return !Number.isNaN(date.getTime()) && date <= new Date();
}

async function main() {
  const email = `refund-test-${randomBytes(4).toString("hex")}@example.com`;
  const password = `Test-${randomBytes(6).toString("hex")}`;
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({ email, password, email_confirm: true });

  if (createError || !created.user) {
    throw new Error(`Не удалось создать пользователя: ${createError?.message}`);
  }

  const userId = created.user.id;
  let adminUserId: string | null = null;
  console.log(`Пользователь: ${email} (${userId})`);

  try {
    adminUserId = await ensureAdminUser();
    const cookie = await buildAdminCookie();
    console.log(`Админ: ${ADMIN_TEST_EMAIL}`);
    console.log(`Сервер: ${BASE_URL}\n`);

    // 1. Прогресса нет — возврат разрешён.
    const cleanPurchase = await createPurchase(userId, "confident", 2990);
    const clean = await refund(cleanPurchase, cookie);
    check(
      "Без прогресса возврат разрешён",
      clean.status === 200 && clean.body?.ok === true,
      `HTTP ${clean.status}, ok=${clean.body?.ok}`,
    );

    if (clean.body?.error?.includes("Недостаточно прав")) {
      console.log(
        "  подсказка: у сервера в ADMIN_EMAIL должен стоять " +
          `${ADMIN_TEST_EMAIL}`,
      );
    }

    const cleanRow = await readPurchase(cleanPurchase);
    check(
      "Доступ закрыт датой expires_at",
      isClosed(cleanRow?.expires_at ?? null),
      `expires_at=${cleanRow?.expires_at ?? "null"}`,
    );

    const repeat = await refund(cleanPurchase, cookie);
    check(
      "Повторный возврат отклонён",
      repeat.status === 409,
      `HTTP ${repeat.status}, «${repeat.body?.error ?? "—"}»`,
    );

    // 2. Отмечен только бесплатный превью-урок — оферта разрешает возврат.
    await admin
      .from("lesson_progress")
      .insert({ user_id: userId, course_type: "confident", lesson_id: 1 });
    const previewPurchase = await createPurchase(userId, "confident", 2990);
    const preview = await refund(previewPurchase, cookie);
    check(
      "Превью-урок возврат не блокирует",
      preview.status === 200 && preview.body?.ok === true,
      `HTTP ${preview.status}, ok=${preview.body?.ok}`,
    );

    // 3. Отмечен платный урок — возврат запрещён.
    await admin
      .from("lesson_progress")
      .insert({ user_id: userId, course_type: "confident", lesson_id: 5 });
    const startedPurchase = await createPurchase(userId, "confident", 2990);
    const started = await refund(startedPurchase, cookie);
    check(
      "Платный урок блокирует возврат",
      started.status === 403 && started.body?.error === DENIED_MESSAGE,
      `HTTP ${started.status}, «${started.body?.error ?? "—"}»`,
    );
    check(
      "Прогресс показан в ответе",
      started.body?.progress?.paidLessons === 1,
      `paidLessons=${started.body?.progress?.paidLessons ?? "—"}`,
    );

    const startedRow = await readPurchase(startedPurchase);
    check(
      "Покупка начатого курса не закрыта",
      startedRow?.expires_at === null,
      `expires_at=${startedRow?.expires_at ?? "null"}`,
    );

    // Админка: страница показывает покупку начатого курса и закрыта от гостя.
    const page = await fetch(`${BASE_URL}/admin/purchases`, {
      headers: { cookie },
      redirect: "manual",
    });
    const html = await page.text();
    check(
      "Страница /admin/purchases открывается админу",
      page.status === 200 && html.includes("Покупки и возвраты"),
      `HTTP ${page.status}, заголовок=${html.includes("Покупки и возвраты")}`,
    );
    check(
      "В списке видно, что курс начат",
      html.includes("Курс начат"),
      `«Курс начат»=${html.includes("Курс начат")}`,
    );

    const guestPage = await fetch(`${BASE_URL}/admin/purchases`, {
      redirect: "manual",
    });
    check(
      "Страница закрыта от гостя",
      guestPage.status === 307 || guestPage.status === 302,
      `HTTP ${guestPage.status}`,
    );

    // 4. Пакет pro включает три уровня: прогресс любого из них блокирует возврат.
    await admin
      .from("lesson_progress")
      .insert({ user_id: userId, course_type: "engineer", lesson_id: 4 });
    const proPurchase = await createPurchase(userId, "pro", 9900);
    const pro = await refund(proPurchase, cookie);
    check(
      "Пакет pro блокируется прогрессом уровня",
      pro.status === 403 && pro.body?.error === DENIED_MESSAGE,
      `HTTP ${pro.status}, «${pro.body?.error ?? "—"}»`,
    );

    // 5. Сданный тест модуля — тоже начало курса.
    await admin
      .from("lesson_progress")
      .insert({ user_id: userId, course_type: "profit-test", lesson_id: 1 });
    const profitPurchase = await createPurchase(userId, "profit", 4990);
    const profit = await refund(profitPurchase, cookie);
    check(
      "Тест модуля блокирует возврат",
      profit.status === 403 && profit.body?.error === DENIED_MESSAGE,
      `HTTP ${profit.status}, «${profit.body?.error ?? "—"}»`,
    );

    // 6. Легаси-подписка даёт только инструменты: уроки её возврат не держат.
    const subscriptionPurchase = await createPurchase(
      userId,
      "pro-subscription",
      299,
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    );
    const subscription = await refund(subscriptionPurchase, cookie);
    check(
      "Подписка Pro возвращается без проверки уроков",
      subscription.status === 200 && subscription.body?.ok === true,
      `HTTP ${subscription.status}, ok=${subscription.body?.ok}`,
    );

    // 7. Права и параметры запроса.
    const anonymous = await refund(startedPurchase, null);
    check(
      "Без сессии — 403",
      anonymous.status === 403,
      `HTTP ${anonymous.status}`,
    );

    const malformed = await refund("not-a-uuid", cookie);
    check(
      "Некорректный id — 400",
      malformed.status === 400,
      `HTTP ${malformed.status}`,
    );

    const missing = await refund(
      "00000000-0000-4000-8000-000000000000",
      cookie,
    );
    check("Нет покупки — 404", missing.status === 404, `HTTP ${missing.status}`);

    // 8. Уже закрытая покупка не возвращается второй раз.
    const closedPurchase = await createPurchase(
      userId,
      "confident",
      2990,
      new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    );
    const closed = await refund(closedPurchase, cookie);
    check(
      "Закрытая покупка — 409",
      closed.status === 409,
      `HTTP ${closed.status}, «${closed.body?.error ?? "—"}»`,
    );
  } finally {
    await admin.from("purchases").delete().eq("user_id", userId);
    await admin.from("lesson_progress").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);

    if (adminUserId) {
      await admin.auth.admin.deleteUser(adminUserId);
    }

    console.log(`\nТестовые строки, ученик и админ ${email} удалены.`);
  }
}

try {
  await main();
} catch (error) {
  failures += 1;
  console.error(
    "Ошибка прогона:",
    error instanceof Error ? error.message : error,
  );
}

console.log(
  failures === 0
    ? "\nИтог: все проверки пройдены."
    : `\nИтог: провалов ${failures}.`,
);
process.exit(failures === 0 ? 0 : 1);


