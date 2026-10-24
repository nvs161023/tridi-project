/* eslint-disable @typescript-eslint/no-explicit-any -- временная проверка: динамические ответы Supabase и cookies. */
/**
 * Проверка админ-блока в личном кабинете.
 *
 * Запуск (сервер уже слушает, по умолчанию http://127.0.0.1:3137, в его
 * окружении `ADMIN_EMAIL=dashboard-test-admin@example.com`):
 *   node scripts/test-dashboard-admin.ts
 *
 * Проверяет: админу видны обе карточки и ссылки, обычному пользователю секции
 * нет вовсе, гостя middleware уводит на вход, а на экране 390 px карточки идут
 * друг под другом без наложений и без горизонтальной прокрутки.
 * Изображения не снимаются — только текст и координаты.
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE_URL = process.env.DASH_TEST_BASE_URL ?? "http://127.0.0.1:3137";
const ADMIN_EMAIL = "dashboard-test-admin@example.com";
const ADMIN_PASSWORD = `Adm-${randomBytes(10).toString("hex")}`;
const USER_EMAIL = `dashboard-test-${randomBytes(4).toString("hex")}@example.com`;
const USER_PASSWORD = `Usr-${randomBytes(10).toString("hex")}`;

let failures = 0;

/** Печатает результат одной проверки и считает провалы. */
function check(name: string, ok: boolean, details: string) {
  console.log(`${ok ? "✓" : "✗"} ${name} — ${details}`);

  if (!ok) {
    failures += 1;
  }
}

/** Читает .env.local: ключ=значение, кавычки снимаются. */
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

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error("Нужны ключи Supabase в .env.local");
  process.exit(1);
}

const admin = createSupabaseClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Создаёт пользователя с паролем или обновляет пароль старому. */
async function ensureUser(email: string, password: string): Promise<string> {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error && created.user) {
    return created.user.id;
  }

  for (let page = 1; page <= 5; page += 1) {
    const { data } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    const found = data?.users.find(
      (user) => (user.email ?? "").toLowerCase() === email.toLowerCase(),
    );

    if (found) {
      await admin.auth.admin.updateUserById(found.id, {
        password,
        email_confirm: true,
      });

      return found.id;
    }

    if ((data?.users.length ?? 0) < 200) {
      break;
    }
  }

  throw new Error(`Не удалось подготовить ${email}: ${error?.message ?? "?"}`);
}

/** Вход по паролю и cookies сессии в том виде, в каком их ждёт сервер. */
async function sessionFor(email: string, password: string) {
  const anon = createSupabaseClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error(`Не удалось войти ${email}: ${error?.message ?? "?"}`);
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

  await ssr.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  return {
    header: jar.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    cookies: jar.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: BASE_URL,
    })),
  };
}

/** HTML кабинета для готового заголовка Cookie. */
async function dashboardHtml(cookie: string) {
  const response = await fetch(`${BASE_URL}/dashboard`, {
    headers: { cookie },
    redirect: "manual",
  });

  return { status: response.status, html: await response.text() };
}


const browser = await chromium.launch();
const created: string[] = [];

/** Координаты карточек админ-секции и ширина документа на заданном экране. */
async function layoutAt(width: number, cookies: any[]) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
  });
  await context.addCookies(cookies);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });

  const cards = page.locator('section[aria-labelledby="admin-title"] article');
  await cards.first().waitFor();
  const count = await cards.count();
  const boxes: any[] = [];

  for (let index = 0; index < count; index += 1) {
    boxes.push(await cards.nth(index).boundingBox());
  }

  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  const links = await page
    .locator('section[aria-labelledby="admin-title"] a')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        href: node.getAttribute("href"),
        text: (node.textContent ?? "").trim(),
      })),
    );

  await context.close();

  return { count, boxes, scrollWidth, links };
}

try {
  const adminId = await ensureUser(ADMIN_EMAIL, ADMIN_PASSWORD);
  const userId = await ensureUser(USER_EMAIL, USER_PASSWORD);
  created.push(adminId, userId);

  const adminSession = await sessionFor(ADMIN_EMAIL, ADMIN_PASSWORD);
  const userSession = await sessionFor(USER_EMAIL, USER_PASSWORD);

  // 1. Админ видит обе карточки и обе ссылки.
  const adminPage = await dashboardHtml(adminSession.header);
  check(
    "Кабинет открывается админу",
    adminPage.status === 200,
    `HTTP ${adminPage.status}`,
  );
  check(
    "Есть заголовок «Администрирование»",
    adminPage.html.includes("Администрирование"),
    `HTTP ${adminPage.status}`,
  );
  check(
    "Есть карточка «Управление покупками»",
    adminPage.html.includes("Управление покупками") &&
      adminPage.html.includes("Просмотр покупок и оформление возвратов"),
    `описание=${adminPage.html.includes("Просмотр покупок и оформление возвратов")}`,
  );
  check(
    "Ссылка на /admin/purchases",
    adminPage.html.includes('href="/admin/purchases"'),
    `ссылка=${adminPage.html.includes('href="/admin/purchases"')}`,
  );
  check(
    "Ссылка на /admin/forum осталась",
    adminPage.html.includes('href="/admin/forum"'),
    `ссылка=${adminPage.html.includes('href="/admin/forum"')}`,
  );
  check(
    "Сетка карточек 1 → 2 колонки",
    adminPage.html.includes("grid-cols-1 gap-5 md:grid-cols-2"),
    `класс=${adminPage.html.includes("grid-cols-1 gap-5 md:grid-cols-2")}`,
  );

  // 2. Обычному пользователю секции нет вовсе.
  const userPage = await dashboardHtml(userSession.header);
  check(
    "Кабинет открывается обычному пользователю",
    userPage.status === 200,
    `HTTP ${userPage.status}`,
  );
  check(
    "У обычного пользователя нет админ-секции",
    !userPage.html.includes("Администрирование") &&
      !userPage.html.includes("Управление покупками") &&
      !userPage.html.includes("Панель модератора"),
    `Администрирование=${userPage.html.includes("Администрирование")}`,
  );
  check(
    "У обычного пользователя нет ссылок /admin/",
    !userPage.html.includes("/admin/"),
    `/admin/=${userPage.html.includes("/admin/")}`,
  );

  // 3. Гость уходит на вход.
  const guest = await fetch(`${BASE_URL}/dashboard`, { redirect: "manual" });
  check(
    "Гостя уводит на вход",
    guest.status === 307 && (guest.headers.get("location") ?? "").length > 0,
    `HTTP ${guest.status}, location=${guest.headers.get("location")}`,
  );

  // 4. Телефон 390 px: карточки друг под другом, без наложений и прокрутки.
  const mobile = await layoutAt(390, adminSession.cookies);
  const [first, second] = mobile.boxes;
  check(
    "На 390 px две карточки",
    mobile.count === 2 && Boolean(first) && Boolean(second),
    `карточек=${mobile.count}`,
  );

  if (first && second) {
    check(
      "На 390 px карточки друг под другом",
      Math.abs(first.x - second.x) < 1 &&
        second.y >= first.y + first.height - 1,
      `x1=${first.x}, y1=${first.y}, h1=${first.height}, x2=${second.x}, y2=${second.y}`,
    );
    check(
      "На 390 px карточки не наезжают",
      second.y >= first.y + first.height,
      `низ первой=${first.y + first.height}, верх второй=${second.y}`,
    );
    check(
      "На 390 px нет горизонтальной прокрутки",
      mobile.scrollWidth <= 390 &&
        first.x >= 0 &&
        first.x + first.width <= 390 &&
        second.x + second.width <= 390,
      `scrollWidth=${mobile.scrollWidth}, ширина карточки=${first.width}`,
    );
  }

  // 5. Кнопки: «Открыть» у покупок и «Открыть админку» у форума.
  check(
    "На 390 px кнопки ведут в обе админки",
    mobile.links.some((link: any) => link.href === "/admin/purchases") &&
      mobile.links.some((link: any) => link.href === "/admin/forum"),
    mobile.links.map((link: any) => `${link.href}:${link.text}`).join(", "),
  );
  check(
    "Подписи кнопок из задачи",
    mobile.links.some(
      (link: any) =>
        link.href === "/admin/purchases" &&
        link.text.replace(/\s/g, "") === "Открыть→",
    ) &&
      mobile.links.some(
        (link: any) =>
          link.href === "/admin/forum" &&
          link.text.replace(/\s/g, "") === "Открытьадминку→",
      ),
    mobile.links.map((link: any) => `«${link.text}»`).join(", "),
  );

  // 6. Компьютер: карточки в одной строке.
  const desktop = await layoutAt(1280, adminSession.cookies);
  const [left, right] = desktop.boxes;
  check(
    "На 1280 px карточки в одной строке",
    Boolean(left) &&
      Boolean(right) &&
      Math.abs(left.y - right.y) < 1 &&
      left.x + left.width <= right.x,
    `x1=${left?.x}, y1=${left?.y}, x2=${right?.x}, y2=${right?.y}`,
  );
} finally {
  await browser.close();

  for (const id of created) {
    await admin.auth.admin.deleteUser(id);
  }

  console.log(
    created.length > 0
      ? `\nТестовые пользователи удалены: ${created.join(", ")}`
      : "\nТестовых пользователей не создавалось.",
  );
  console.log(
    failures === 0
      ? "\nИтог: все проверки пройдены."
      : `\nИтог: провалов ${failures}.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

