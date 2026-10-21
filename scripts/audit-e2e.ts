/* eslint-disable @typescript-eslint/no-explicit-any -- E2E-скрипт работает с динамическими ответами Supabase и браузерным кодом внутри page.evaluate. */
/**
 * E2E-аудит TriDi перед релизом.
 *
 * Запуск (сервер уже слушает 127.0.0.1:3117):
 *   node scripts/audit-e2e.ts
 *
 * Для production-сборки задайте ADMIN_EMAIL явно:
 *   AUDIT_ADMIN_EMAIL=admin@example.com node scripts/audit-e2e.ts
 * Иначе скрипт возьмёт админа из .env.development.local, а production-сервер
 * прочитает .env.local — сценарии модерации форума получат ложный FAIL.
 *
 * Что делает:
 *  - создаёт обычного и Pro-тестового пользователя через Supabase Admin API;
 *  - проходит сценарии A–F в реальном Chrome (desktop + mobile);
 *  - проверяет регистрацию, вход, кабинет, профили, форум, оплату и навигацию;
 *  - складывает скриншоты в audit-e2e/, отчёт — в audit-e2e-report.md;
 *  - в конце удаляет тестовых пользователей, их покупки/подписки и темы форума.
 *
 * Код сайта не меняется. Изображения в чат не передаются — только пути.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const ROOT = path.resolve(import.meta.dirname, "..");

type DeviceName = "desktop" | "mobile";

type Check = {
  name: string;
  ok: boolean;
  expected: string;
  actual: string;
};

type Scenario = {
  id: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  title: string;
  status: "PASS" | "FAIL";
  checks: Check[];
  steps: string[];
  screenshots: string[];
  errors: string[];
  notes: string[];
};

type Diagnostics = {
  console: string[];
  pageErrors: string[];
  network: string[];
};

type Session = {
  context: any;
  page: any;
  diagnostics: Diagnostics;
};

type UserInfo = {
  id: string;
  email: string;
  password: string;
  name: string;
};

const BASE_URL = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3117";
const OUT_DIR = path.join(ROOT, "audit-e2e");
const REPORT_PATH = path.join(ROOT, "audit-e2e-report.md");
const CHROME_PATH =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36";

const DEVICES: Record<
  DeviceName,
  {
    viewport: { width: number; height: number };
    mobile: boolean;
    userAgent: string;
  }
> = {
  desktop: {
    viewport: { width: 1440, height: 900 },
    mobile: false,
    userAgent: DESKTOP_UA,
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    mobile: true,
    userAgent: MOBILE_UA,
  },
};

const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /\[HMR\]/i,
  /\[webpack\]/i,
  /favicon\.ico/i,
];

const IGNORED_NETWORK = [
  /favicon\.ico/i,
  /^data:/i,
  /^blob:/i,
  /\/_next\//i,
  /\/api\/profiles\/download/i,
  /auth\.robokassa\.ru/i,
];

const PROFILE_ID = "bambu-x1c-reduce-current";
const PROFILE_FILE =
  "profiles/printers/bambu-lab-x1c/Bambu Lab X1 Carbon 0.4 nozzle - REDUCE CURRENT.json";
const REPLY_TEXT = "E2E-ответ: профиль и температура проверены.";

let ADMIN_EMAIL = "nvs16@ya.ru";
let supabaseUrl = "";
let supabaseAnonKey = "";
let supabaseServiceKey = "";
let adminClient: any = null;

const stamp = new Date()
  .toISOString()
  .replace(/[-:T]/g, "")
  .slice(0, 14);
const NORMAL_EMAIL = `audit-${stamp}@tridi.test`;
const PRO_EMAIL = `audit-pro-${stamp}@tridi.test`;
const NORMAL_PASSWORD = `Aa1!${randomBytes(12).toString("hex")}`;
const PRO_PASSWORD = `Aa1!${randomBytes(12).toString("hex")}`;
const THREAD_TITLE = `E2E аудит ${stamp}`;
const THREAD_BODY =
  "Проверка публикации темы в E2E-аудите. Принтер Bambu Lab X1 Carbon, PLA, Bambu Studio.";

const createdUserIds: string[] = [];
const createdSubscriptionIds: string[] = [];
const createdPurchaseIds: string[] = [];
const createdWebhookInvIds: number[] = [];

function loadEnvFile(file: string) {
  try {
    if (fs.existsSync(file)) {
      process.loadEnvFile(file);
    }
  } catch {
    // Если файла нет или Node не умеет loadEnvFile — ниже будет понятная ошибка.
  }
}

function readEnvValue(file: string, key: string): string {
  try {
    const text = fs.readFileSync(file, "utf8");
    const line = text
      .split(/\r?\n/)
      .find((item) => item.trim().startsWith(`${key}=`));

    if (!line) return "";

    return line
      .slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

function mdCell(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function addCheck(
  scenario: Scenario,
  name: string,
  ok: boolean,
  expected: string,
  actual: string,
) {
  scenario.checks.push({ name, ok, expected, actual });
}

function addStep(scenario: Scenario, text: string) {
  scenario.steps.push(text);
}

function addNote(scenario: Scenario, text: string) {
  scenario.notes.push(text);
}

async function screenshot(
  scenario: Scenario,
  page: any,
  name: string,
): Promise<string> {
  const relative = `audit-e2e/${name}`;
  const absolute = path.join(ROOT, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });

  try {
    await page.screenshot({ path: absolute, fullPage: true });
    scenario.screenshots.push(relative);
  } catch (error: any) {
    scenario.notes.push(`Скриншот ${relative} не сделан: ${error?.message || error}`);
  }

  return relative;
}

function initEnvironment() {
  loadEnvFile(path.join(ROOT, ".env.local"));

  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error(
      "Не заданы NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY или SUPABASE_SERVICE_ROLE_KEY в .env.local",
    );
  }

  // В dev Next.js поверх .env.local читает .env.development.local, поэтому
  // ADMIN_EMAIL может быть переопределён. Берём именно то значение, которое
  // увидит dev-сервер, если аудит не переопределили явно.
  ADMIN_EMAIL =
    process.env.AUDIT_ADMIN_EMAIL ||
    readEnvValue(path.join(ROOT, ".env.development.local"), "ADMIN_EMAIL") ||
    process.env.ADMIN_EMAIL ||
    "nvs16@ya.ru";

  adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function createDiagnostics(): Diagnostics {
  return { console: [], pageErrors: [], network: [] };
}

function isIgnoredConsole(text: string): boolean {
  return IGNORED_CONSOLE.some((pattern) => pattern.test(text));
}

function isIgnoredNetwork(url: string): boolean {
  return IGNORED_NETWORK.some((pattern) => pattern.test(url));
}

function attachDiagnostics(page: any, diagnostics: Diagnostics) {
  page.on("console", (message: any) => {
    if (message.type() !== "error") return;

    const place = message.location?.() ?? {};
    const location = place.url
      ? `${place.url}:${place.lineNumber ?? 0}:${place.columnNumber ?? 0}`
      : "";
    const text = message.text();

    if (isIgnoredConsole(`${text} ${location}`)) return;

    diagnostics.console.push(location ? `${text} @ ${location}` : text);
  });

  page.on("pageerror", (error: any) => {
    diagnostics.pageErrors.push(error?.message || String(error));
  });

  page.on("requestfailed", (request: any) => {
    const url = request.url();
    if (isIgnoredNetwork(url)) return;

    const failure = request.failure()?.errorText || "unknown";

    // Next.js и Playwright штатно отменяют запрос при серверном редиректе,
    // повторной навигации и перехвате Robokassa — это не сетевой дефект.
    if (/ERR_ABORTED/i.test(failure)) {
      return;
    }

    diagnostics.network.push(`requestfailed ${url}: ${failure}`);
  });

  page.on("response", (response: any) => {
    const status = response.status();
    if (status < 500) return;

    const url = response.url();
    if (isIgnoredNetwork(url)) return;

    diagnostics.network.push(`HTTP ${status} ${url}`);
  });
}

async function createContext(
  browser: any,
  device: DeviceName,
  cookies: any[] = [],
) {
  const config = DEVICES[device];
  const context = await browser.newContext({
    viewport: config.viewport,
    userAgent: config.userAgent,
    isMobile: config.mobile,
    hasTouch: config.mobile,
    deviceScaleFactor: config.mobile ? 3 : 1,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
  });

  await context.addInitScript(() => {
    try {
      window.localStorage.setItem(
        "tridi-cookie-consent",
        JSON.stringify({ scope: "necessary", savedAt: new Date().toISOString() }),
      );
    } catch {
      // Приватный режим — баннер просто останется, это не ошибка аудита.
    }
  });

  if (cookies.length > 0) {
    await context.addCookies(cookies);
  }

  return context;
}

async function openPath(page: any, target: string) {
  const url = target.startsWith("http") ? target : `${BASE_URL}${target}`;
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);

  return response;
}

async function buildAdminCookies(email: string) {
  const { data: link, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError || !link?.properties?.hashed_token) {
    throw new Error(
      `Не удалось выпустить magiclink для ${email}: ${
        linkError?.message || "нет hashed_token"
      }`,
    );
  }

  const anon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError || !verified?.session) {
    throw new Error(
      `Не удалось проверить magiclink для ${email}: ${
        verifyError?.message || "нет сессии"
      }`,
    );
  }

  let jar: any[] = [];
  const ssr = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => jar,
      setAll: (list: any[]) => {
        jar = list;
      },
    },
  });

  const { error: sessionError } = await ssr.auth.setSession({
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
  });

  if (sessionError || jar.length === 0) {
    throw new Error(
      `Не удалось собрать auth-cookies для ${email}: ${
        sessionError?.message || "пустой jar"
      }`,
    );
  }

  return jar.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: new URL(BASE_URL).hostname,
    path: "/",
    httpOnly: Boolean(cookie.options?.httpOnly),
    secure: false,
    sameSite: "Lax" as const,
    expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  }));
}

async function adminSession(
  browser: any,
  device: DeviceName,
  cookies: any[],
): Promise<Session> {
  const context = await createContext(browser, device, cookies);
  const page = await context.newPage();
  const diagnostics = createDiagnostics();
  attachDiagnostics(page, diagnostics);

  return { context, page, diagnostics };
}

async function loginSession(
  browser: any,
  device: DeviceName,
  user: { email: string; password: string },
): Promise<Session & { loginError: string }> {
  const context = await createContext(browser, device);
  const page = await context.newPage();
  const diagnostics = createDiagnostics();
  attachDiagnostics(page, diagnostics);

  let loginError = "";

  try {
    await openPath(page, "/auth/login");
    await page.locator("#email").fill(user.email);
    await page.locator("#password").fill(user.password);
    await page.locator("form button[type=submit]").first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
  } catch (error: any) {
    loginError =
      (await page
        .locator('[role="alert"]')
        .first()
        .innerText()
        .catch(() => "")) || error?.message || String(error);
  }

  return { context, page, diagnostics, loginError };
}

async function findUserByEmail(email: string) {
  let page = 1;

  while (page <= 20) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(`listUsers: ${error.message}`);
    }

    const users = data?.users ?? [];
    const found = users.find(
      (user: any) => (user.email || "").toLowerCase() === email.toLowerCase(),
    );

    if (found) return found;
    if (users.length < 200) return null;

    page += 1;
  }

  return null;
}

async function createUserViaAdmin(
  email: string,
  password: string,
  name: string,
): Promise<UserInfo> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error || !data?.user) {
    throw new Error(`createUser ${email}: ${error?.message || "нет user"}`);
  }

  if (!createdUserIds.includes(data.user.id)) {
    createdUserIds.push(data.user.id);
  }

  return { id: data.user.id, email, password, name };
}

async function ensureUser(
  email: string,
  password: string,
  name: string,
): Promise<UserInfo> {
  const existing = await findUserByEmail(email);

  if (existing) {
    const { error } = await adminClient.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
    });

    if (error) {
      throw new Error(`updateUserById ${email}: ${error.message}`);
    }

    return { id: existing.id, email, password, name };
  }

  return createUserViaAdmin(email, password, name);
}

async function confirmUserEmail(userId: string) {
  const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Не удалось подтвердить email: ${error.message}`);
  }

  return Boolean(data?.user?.email_confirmed_at);
}

async function runScenario(
  id: Scenario["id"],
  title: string,
  fn: (scenario: Scenario) => Promise<void>,
): Promise<Scenario> {
  const scenario: Scenario = {
    id,
    title,
    status: "PASS",
    checks: [],
    steps: [],
    screenshots: [],
    errors: [],
    notes: [],
  };

  try {
    await fn(scenario);
  } catch (error: any) {
    addCheck(
      scenario,
      "Сценарий выполнен без исключения",
      false,
      "все шаги завершаются",
      error?.stack || String(error),
    );
  }

  scenario.status = scenario.checks.every((check) => check.ok)
    ? "PASS"
    : "FAIL";

  return scenario;
}

function collectErrors(scenario: Scenario, session: Session) {
  const values = [
    ...session.diagnostics.console.map((text) => `console: ${text}`),
    ...session.diagnostics.pageErrors.map((text) => `pageerror: ${text}`),
    ...session.diagnostics.network.map((text) => `network: ${text}`),
  ];

  for (const value of values) {
    if (!scenario.errors.includes(value)) {
      scenario.errors.push(value);
    }
  }
}

async function collectDashboardState(page: any, email: string) {
  return page.evaluate((userEmail: string) => {
    function textOf(element: Element | null): string {
      return (element?.textContent || "").replace(/\s+/g, " ").trim();
    }

    const courses = Array.from(
      document.querySelectorAll(
        'section[aria-labelledby="courses-title"] article',
      ),
    ).map((element) => {
      const text = (element.textContent || "").replace(/\s+/g, " ");

      return {
        heading: textOf(element.querySelector("h3")),
        text,
        hasLock: element.querySelectorAll("svg").length > 0,
        hasProgress: Boolean(element.querySelector('[role="progressbar"]')),
        hasBuy: /Купить курс/.test(text),
        hasClosed: /Закрыт/.test(text),
        hasContinue: /Продолжить/.test(text),
      };
    });

    const tools = Array.from(
      document.querySelectorAll(
        'section[aria-labelledby="pro-tools-title"] article',
      ),
    ).map((element) => {
      const inner = element.querySelector(":scope > div") as HTMLElement | null;
      const filter = inner ? window.getComputedStyle(inner).filter : "";

      return {
        heading: textOf(element.querySelector("h3")),
        text: (element.textContent || "").replace(/\s+/g, " "),
        blurred: /blur\(/.test(filter) || /\bblur-\[/.test(element.innerHTML),
        ariaHidden: inner?.getAttribute("aria-hidden") || null,
        links: Array.from(element.querySelectorAll("a")).map(
          (link) => link.getAttribute("href") || "",
        ),
        overlay: /Доступно по подписке Pro/.test(element.textContent || ""),
      };
    });

    const subscription =
      document.querySelector(
        'section[aria-labelledby="subscription-status-title"]',
      )?.textContent || "";
    const header = document.querySelector("header");

    return {
      courses,
      tools,
      subscription: subscription.replace(/\s+/g, " ").trim(),
      dataError: (document.body.textContent || "").includes(
        "Часть данных не загрузилась",
      ),
      headerText: (header?.textContent || "").replace(/\s+/g, " ").trim(),
      avatarCount: document.querySelectorAll(
        'header img, header [aria-label*="аватар" i], header [data-avatar]',
      ).length,
      headerHasEmail: (header?.textContent || "").includes(userEmail),
      headerProfileLinks: Array.from(
        header?.querySelectorAll('a[href="/profiles"]') || [],
      ).length,
      headerAdminLinks: Array.from(
        header?.querySelectorAll('a[href="/admin"]') || [],
      ).length,
      bodyHasEmail: (document.body.textContent || "").includes(userEmail),
      greeting:
        Array.from(document.querySelectorAll("p")).find((element) =>
          /^Привет,/.test((element.textContent || "").trim()),
        )?.textContent || "",
      pagePath: window.location.pathname,
    };
  }, email);
}

async function collectHeaderLinks(page: any) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll("header a")).map((link) => {
      const element = link as HTMLElement;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);

      return {
        text: (link.textContent || "").replace(/\s+/g, " ").trim(),
        href: link.getAttribute("href") || "",
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none",
      };
    });
  });
}

async function requestStatus(page: any, target: string) {
  const url = target.startsWith("http") ? target : `${BASE_URL}${target}`;

  try {
    const response = await page.request.get(url, {
      maxRedirects: 5,
      timeout: 30000,
    });

    return { status: response.status(), url: response.url() };
  } catch (error: any) {
    return { status: null, url, error: error?.message || String(error) };
  }
}

function readCoursesData(): any {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, "data", "courses.json"), "utf8"),
  );
}

async function attemptPurchase(
  userId: string,
  courseId: "pro" | "pro-subscription",
  amount: number,
) {
  const invId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  const basePayload = {
    user_id: userId,
    course_id: courseId,
    amount,
    expires_at: null,
  };
  let result = await adminClient
    .from("purchases")
    .insert({ ...basePayload, inv_id: invId })
    .select("id")
    .maybeSingle();
  let warning = "";

  // Миграция supabase/purchases.sql создаёт inv_id, но в уже существующей
  // таблице колонки может не быть: create table if not exists её не добавит.
  // Для проверки доступа создаём запись без номера заказа и отдельно
  // предупреждаем, что вебхук Robokassa требует inv_id.
  if (
    result.error?.code === "PGRST204" &&
    /inv_id/i.test(result.error.message)
  ) {
    warning =
      "В public.purchases нет колонки inv_id: запись для E2E создана без номера заказа. Вебхук Robokassa в такой схеме не сможет сохранить оплату.";

    result = await adminClient
      .from("purchases")
      .insert(basePayload)
      .select("id")
      .maybeSingle();
  }

  const { data, error } = result;

  if (error) {
    return {
      ok: false,
      id: null,
      error: `${error.code || "error"} ${error.message}`,
      warning,
    };
  }

  if (data?.id) {
    createdPurchaseIds.push(data.id);
  }

  return { ok: true, id: data?.id ?? null, error: "", warning };
}

/** MD5 в нижнем регистре — формат подписи Robokassa. */
function md5(value: string): string {
  return createHash("md5").update(value, "utf8").digest("hex");
}

/**
 * `Shp_*`-часть подписи. Robokassa требует сортировать параметры по имени и
 * добавлять их как `:Shp_key=value`.
 */
function buildShpSignaturePart(shp: Record<string, string>): string {
  return Object.keys(shp)
    .sort()
    .map((key) => `:Shp_${key}=${shp[key]}`)
    .join("");
}

/**
 * Подпись ссылки на оплату: логин, сумма, InvId, чек, пароль №1 и Shp_*.
 *
 * `receipt` — уже URL-кодированное значение параметра: Robokassa подписывает
 * чек в том виде, в каком он передан в ссылке.
 */
function buildPaymentSignature(
  login: string,
  outSum: string,
  invId: string,
  receipt: string,
  shp: Record<string, string>,
  password1: string,
): string {
  return md5(
    `${login}:${outSum}:${invId}:${receipt}:${password1}${buildShpSignaturePart(shp)}`,
  );
}

/** Подпись уведомления ResultURL: сумма, InvId, пароль №2 и Shp_*. */
function buildResultSignature(
  outSum: string,
  invId: string,
  shp: Record<string, string>,
  password2: string,
): string {
  return md5(`${outSum}:${invId}:${password2}${buildShpSignaturePart(shp)}`);
}

/**
 * Отправляет в приложение подписанное уведомление Robokassa. Реальная оплата
 * не проводится: запрос имитирует ResultURL после успешного платежа.
 */
async function postRobokassaResult(
  outSum: string,
  invId: number,
  shp: Record<string, string>,
): Promise<{ status: number; body: string; error: string }> {
  const password2 =
    readEnvValue(path.join(ROOT, ".env.local"), "ROBOKASSA_PASSWORD2") ||
    process.env.ROBOKASSA_PASSWORD2 ||
    "";

  if (!password2) {
    return {
      status: 0,
      body: "",
      error: "В .env.local не задан ROBOKASSA_PASSWORD2",
    };
  }

  const body = new URLSearchParams({
    OutSum: outSum,
    InvId: String(invId),
    SignatureValue: buildResultSignature(outSum, String(invId), shp, password2),
    Shp_course: shp.course,
    Shp_user: shp.user,
  });

  try {
    const response = await fetch(`${BASE_URL}/api/payments/robokassa/result`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(30000),
    });

    return {
      status: response.status,
      body: (await response.text()).trim(),
      error: "",
    };
  } catch (error: any) {
    return {
      status: 0,
      body: "",
      error: error?.message || String(error),
    };
  }
}

/** Ищет покупку по номеру заказа: вебхук мог записать её, а сценарий — нет. */
async function findPurchaseByInvId(invId: number) {
  const { data, error } = await adminClient
    .from("purchases")
    .select("id, course_id, amount")
    .eq("inv_id", invId);

  return { rows: data ?? [], error: error?.message ?? "" };
}

async function deleteForumArtifacts() {
  const lines: string[] = [];

  try {
    const { data: threads, error } = await adminClient
      .from("forum_threads")
      .select("id, title")
      .like("title", `${THREAD_TITLE}%`);

    if (error) {
      lines.push(`forum_threads select: ${error.code} ${error.message}`);
      return lines;
    }

    for (const thread of threads ?? []) {
      const { error: deleteError } = await adminClient
        .from("forum_threads")
        .delete()
        .eq("id", thread.id);

      lines.push(
        deleteError
          ? `тема ${thread.id} не удалена: ${deleteError.code} ${deleteError.message}`
          : `тема ${thread.id} удалена`,
      );
    }

    if ((threads ?? []).length === 0) {
      lines.push("тем E2E в forum_threads не осталось");
    }

    const { data: replies, error: replyError } = await adminClient
      .from("forum_replies")
      .select("id")
      .eq("content", REPLY_TEXT);

    if (!replyError) {
      for (const reply of replies ?? []) {
        const { error: deleteReplyError } = await adminClient
          .from("forum_replies")
          .delete()
          .eq("id", reply.id);

        lines.push(
          deleteReplyError
            ? `ответ ${reply.id} не удалён: ${deleteReplyError.code} ${deleteReplyError.message}`
            : `ответ ${reply.id} удалён`,
        );
      }
    }
  } catch (error: any) {
    lines.push(`forum cleanup: ${error?.message || error}`);
  }

  return lines;
}

async function deleteTestUser(userId: string) {
  let email = userId;

  try {
    const { data } = await adminClient.auth.admin.getUserById(userId);
    email = data?.user?.email || userId;
  } catch {
    // Для отчёта достаточно id.
  }

  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    const found = await findUserByEmail(email).catch(() => null);

    if (found) {
      return `пользователь ${email} (${userId}) не удалён: ${error.message}`;
    }

    return `пользователь ${email} (${userId}) уже отсутствует`;
  }

  return `пользователь ${email} (${userId}) удалён`;
}

async function cleanupAll() {
  const lines: string[] = [];

  // Темы и ответы удаляем до пользователей: внешние ключи могут запрещать
  // удаление автора, пока его материалы ещё в базе.
  lines.push(...(await deleteForumArtifacts()));

  for (const id of createdPurchaseIds) {
    const { error } = await adminClient.from("purchases").delete().eq("id", id);
    lines.push(
      error
        ? `purchase ${id} не удалена: ${error.message}`
        : `purchase ${id} удалена`,
    );
  }

  // Покупку из сценария G создаёт сам вебхук, поэтому её id может быть
  // неизвестен. Дополнительно страхуемся номером заказа Robokassa.
  for (const invId of [...new Set(createdWebhookInvIds)]) {
    const { error } = await adminClient
      .from("purchases")
      .delete()
      .eq("inv_id", invId);
    lines.push(
      error
        ? `purchase inv_id=${invId} не удалена: ${error.message}`
        : `purchase inv_id=${invId} удалена`,
    );
  }

  const uniqueSubscriptions = [...new Set(createdSubscriptionIds)];
  for (const id of uniqueSubscriptions) {
    const { error } = await adminClient
      .from("subscriptions")
      .delete()
      .eq("id", id);
    lines.push(
      error
        ? `subscription ${id} не удалена: ${error.message}`
        : `subscription ${id} удалена`,
    );
  }

  const ids = [...new Set(createdUserIds)];
  for (const id of ids) {
    lines.push(await deleteTestUser(id));
  }

  const remainingNormal = await findUserByEmail(NORMAL_EMAIL).catch(() => null);
  const remainingPro = await findUserByEmail(PRO_EMAIL).catch(() => null);

  if (remainingNormal) {
    lines.push(`ВНИМАНИЕ: ${NORMAL_EMAIL} всё ещё существует`);
  }
  if (remainingPro) {
    lines.push(`ВНИМАНИЕ: ${PRO_EMAIL} всё ещё существует`);
  }
  if (!remainingNormal && !remainingPro) {
    lines.push("тестовые пользователи в auth.users не найдены");
  }

  return lines;
}

function gitStatusPorcelain(): string {
  try {
    return execSync("git status --porcelain", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (error: any) {
    return `git status недоступен: ${error?.message || error}`;
  }
}

async function scenarioA(
  browser: any,
  state: { normalUser?: UserInfo },
): Promise<Scenario> {
  return runScenario("A", "Регистрация и вход", async (scenario) => {
    const context = await createContext(browser, "desktop");
    const page = await context.newPage();
    const diagnostics = createDiagnostics();
    attachDiagnostics(page, diagnostics);

    try {
      addStep(scenario, "Открываю /auth/sign-up и заполняю форму регистрации.");
      await openPath(page, "/auth/sign-up");
      await page.locator("#name").fill("E2E Audit");
      await page.locator("#email").fill(NORMAL_EMAIL);
      await page.locator("#password").fill(NORMAL_PASSWORD);
      await page.locator("#consent").check();
      await page.locator("#age-confirmed").check();
      await screenshot(scenario, page, "sign-up-form.png");

      const submit = page.getByRole("button", { name: /Зарегистрироваться/ });
      await submit.click();

      addStep(scenario, "Отправляю форму и жду /dashboard или /auth/verify-email.");
      let signupPath = "";

      try {
        await page.waitForURL(
          (url: URL) => /\/dashboard|\/auth\/verify-email/.test(url.pathname),
          { timeout: 90000 },
        );
        signupPath = new URL(page.url()).pathname;
      } catch (error: any) {
        signupPath = new URL(page.url()).pathname;
        const alert = await page
          .locator('[role="alert"]')
          .first()
          .innerText()
          .catch(() => "");
        addNote(
          scenario,
          `Регистрация не завершилась ожидаемым переходом: ${
            alert || error?.message || error
          }`,
        );
      }

      addCheck(
        scenario,
        "Форма регистрации отправилась",
        signupPath === "/dashboard" || signupPath === "/auth/verify-email",
        "переход на /dashboard или /auth/verify-email",
        signupPath || "перехода не было",
      );

      let user = await findUserByEmail(NORMAL_EMAIL);

      if (!user) {
        addNote(
          scenario,
          "UI-регистрация не создала пользователя — создаю того же пользователя через service-role, чтобы проверить остальные сценарии.",
        );
        state.normalUser = await createUserViaAdmin(
          NORMAL_EMAIL,
          NORMAL_PASSWORD,
          "E2E Audit",
        );
        user = await findUserByEmail(NORMAL_EMAIL);
      } else {
        state.normalUser = {
          id: user.id,
          email: NORMAL_EMAIL,
          password: NORMAL_PASSWORD,
          name: "E2E Audit",
        };
        if (!createdUserIds.includes(user.id)) {
          createdUserIds.push(user.id);
        }
      }

      addCheck(
        scenario,
        "Пользователь существует в auth.users",
        Boolean(user?.id),
        `пользователь ${NORMAL_EMAIL}`,
        user
          ? `${user.id}, подтверждён: ${Boolean(user.email_confirmed_at)}`
          : "не найден",
      );

      let confirmed = false;

      if (user?.id) {
        confirmed = await confirmUserEmail(user.id);
      }

      addCheck(
        scenario,
        "Email подтверждён через service-role",
        confirmed,
        "auth.admin.updateUserById({ email_confirm: true })",
        confirmed ? "email_confirmed_at заполнен" : "не подтверждён",
      );

      collectErrors(scenario, { context, page, diagnostics } as Session);
      await context.close();

      addStep(scenario, "Вхожу через /auth/login под обычным пользователем.");
      const desktop = await loginSession(browser, "desktop", {
        email: NORMAL_EMAIL,
        password: NORMAL_PASSWORD,
      });

      addCheck(
        scenario,
        "Вход ведёт на /dashboard",
        new URL(desktop.page.url()).pathname === "/dashboard" &&
          !desktop.loginError,
        "/dashboard после входа",
        desktop.loginError || new URL(desktop.page.url()).pathname,
      );

      if (desktop.loginError) {
        await screenshot(scenario, desktop.page, "login-error-desktop.png");
      }

      const heading = await desktop.page
        .locator("h1")
        .first()
        .innerText()
        .catch(() => "");
      addCheck(
        scenario,
        "В кабинете есть заголовок «Личный кабинет»",
        heading.includes("Личный кабинет"),
        "h1 «Личный кабинет»",
        heading || "заголовок не найден",
      );

      const dashboard = await collectDashboardState(
        desktop.page,
        NORMAL_EMAIL,
      );
      addCheck(
        scenario,
        "В шапке отображается email или аватар",
        dashboard.headerHasEmail || dashboard.avatarCount > 0,
        "email или аватар в header",
        `header="${dashboard.headerText || "пусто"}", avatarCount=${dashboard.avatarCount}, email=${dashboard.headerHasEmail}`,
      );
      addCheck(
        scenario,
        "Приветствие содержит имя или email",
        Boolean(
          dashboard.greeting && /E2E Audit|audit-/.test(dashboard.greeting),
        ),
        "«Привет, E2E Audit!» или email",
        dashboard.greeting || "приветствие не найдено",
      );
      addNote(
        scenario,
        dashboard.dataError
          ? "На /dashboard показано «Часть данных не загрузилась» — вероятно, для нового пользователя нет строки в profiles."
          : "Предупреждения «Часть данных не загрузилась» на /dashboard нет.",
      );

      await screenshot(scenario, desktop.page, "login-desktop.png");
      collectErrors(scenario, desktop);
      await desktop.context.close();

      addStep(scenario, "Повторяю вход и снимаю мобильный кабинет.");
      const mobile = await loginSession(browser, "mobile", {
        email: NORMAL_EMAIL,
        password: NORMAL_PASSWORD,
      });

      addCheck(
        scenario,
        "Мобильный вход ведёт на /dashboard",
        new URL(mobile.page.url()).pathname === "/dashboard" &&
          !mobile.loginError,
        "/dashboard в мобильном контексте",
        mobile.loginError || new URL(mobile.page.url()).pathname,
      );

      await screenshot(scenario, mobile.page, "login-mobile.png");
      collectErrors(scenario, mobile);
      await mobile.context.close();
    } finally {
      await context.close().catch(() => {});
    }
  });
}

async function loginAndCollectDashboard(
  browser: any,
  device: DeviceName,
  user: UserInfo,
  scenario: Scenario,
  shotName: string,
) {
  const session = await loginSession(browser, device, user);
  addCheck(
    scenario,
    `Вход в кабинет (${device})`,
    new URL(session.page.url()).pathname === "/dashboard" && !session.loginError,
    "/dashboard",
    session.loginError || new URL(session.page.url()).pathname,
  );

  const state = await collectDashboardState(session.page, user.email);
  await screenshot(scenario, session.page, shotName);
  collectErrors(scenario, session);
  await session.context.close();

  return state;
}

function courseCard(state: any, title: string) {
  return state.courses.find((card: any) => card.heading.includes(title));
}

function toolsAreLocked(state: any) {
  return (
    state.tools.length === 2 &&
    state.tools.every(
      (tool: any) =>
        tool.blurred &&
        tool.ariaHidden === "true" &&
        tool.overlay &&
        tool.links.includes("/subscription#tools") &&
        !tool.links.includes("/constructor") &&
        !tool.links.includes("/profiles"),
    )
  );
}

function toolsAreActive(state: any) {
  const links = state.tools.flatMap((tool: any) => tool.links);

  return (
    state.tools.length === 2 &&
    state.tools.every((tool: any) => !tool.blurred && !tool.overlay) &&
    links.includes("/constructor") &&
    links.includes("/profiles")
  );
}

function paidCoursesAreLocked(state: any) {
  return ["Уверенный", "Инженер", "Заработок"].every((title) => {
    const card = courseCard(state, title);
    return Boolean(card && card.hasLock && card.hasBuy && card.hasClosed);
  });
}

function paidCoursesHaveProgress(state: any) {
  return ["Уверенный", "Инженер", "Заработок"].every((title) => {
    const card = courseCard(state, title);
    return Boolean(
      card && card.hasProgress && !card.hasBuy && !card.hasClosed,
    );
  });
}

async function scenarioB(
  browser: any,
  state: {
    normalUser: UserInfo;
    proUser: UserInfo;
    proPurchase: { ok: boolean; error: string; warning?: string };
  },
): Promise<Scenario> {
  return runScenario("B", "Дашборд: обычный и Pro-пользователь", async (scenario) => {
    addStep(scenario, "Обычный пользователь: открываю /dashboard (desktop).");
    const freeDesktop = await loginAndCollectDashboard(
      browser,
      "desktop",
      state.normalUser,
      scenario,
      "dashboard-free-desktop.png",
    );

    addCheck(
      scenario,
      "Блок «Статус подписки»",
      freeDesktop.subscription.includes("Статус подписки") &&
        freeDesktop.subscription.includes("Бесплатный аккаунт"),
      "«Статус подписки» + «Бесплатный аккаунт»",
      freeDesktop.subscription || "блок не найден",
    );
    addCheck(
      scenario,
      "В «Моих курсах» 4 карточки",
      freeDesktop.courses.length === 4,
      "4 карточки",
      `${freeDesktop.courses.length}: ${freeDesktop.courses
        .map((card: any) => card.heading)
        .join(", ")}`,
    );
    addCheck(
      scenario,
      "Три платных курса закрыты замком и кнопкой «Купить курс»",
      paidCoursesAreLocked(freeDesktop),
      "замок + «Курс не куплен» + «Купить курс» у «Уверенный», «Инженер», «Заработок»",
      JSON.stringify(
        ["Уверенный", "Инженер", "Заработок"].map((title) => {
          const card = courseCard(freeDesktop, title);
          return {
            title,
            lock: card?.hasLock,
            closed: card?.hasClosed,
            buy: card?.hasBuy,
          };
        }),
      ),
    );
    addCheck(
      scenario,
      "У бесплатного уровня есть прогресс",
      Boolean(courseCard(freeDesktop, "Новичок")?.hasProgress),
      "полоса прогресса у «Новичок»",
      JSON.stringify(courseCard(freeDesktop, "Новичок")),
    );
    addCheck(
      scenario,
      "«Инструменты Pro» размыты и ведут на /subscription#tools",
      toolsAreLocked(freeDesktop),
      "2 размытые карточки, aria-hidden, CTA /subscription#tools",
      JSON.stringify(freeDesktop.tools),
    );

    addStep(scenario, "Обычный пользователь: повторяю проверку в mobile.");
    const freeMobile = await loginAndCollectDashboard(
      browser,
      "mobile",
      state.normalUser,
      scenario,
      "dashboard-free-mobile.png",
    );
    addCheck(
      scenario,
      "Мобильный кабинет повторяет состояние free",
      freeMobile.courses.length === 4 &&
        paidCoursesAreLocked(freeMobile) &&
        toolsAreLocked(freeMobile),
      "4 карточки, 3 замка, 2 размытых инструмента",
      JSON.stringify({
        courses: freeMobile.courses.length,
        paidLocked: paidCoursesAreLocked(freeMobile),
        toolsLocked: toolsAreLocked(freeMobile),
      }),
    );

    addStep(
      scenario,
      "Pro-пользователь: проверяю покупку pro, подписку и /dashboard (desktop).",
    );
    addCheck(
      scenario,
      "Запись purchases с course_id='pro' создана",
      state.proPurchase.ok,
      "insert в public.purchases",
      state.proPurchase.ok
        ? "запись создана"
        : `ошибка: ${state.proPurchase.error}`,
    );

    if (!state.proPurchase.ok) {
      addNote(
        scenario,
        "Пакет pro не создан: без записи purchases проверить открытие курсов и инструментов нельзя, поэтому проверки ниже ожидаемо упадут.",
      );
    }

    const proDesktop = await loginAndCollectDashboard(
      browser,
      "desktop",
      state.proUser,
      scenario,
      "dashboard-pro-desktop.png",
    );

    addCheck(
      scenario,
      "У трёх платных курсов прогресс вместо замка",
      paidCoursesHaveProgress(proDesktop),
      "progressbar + «Продолжить» у «Уверенный», «Инженер», «Заработок»",
      JSON.stringify(
        ["Уверенный", "Инженер", "Заработок"].map((title) => {
          const card = courseCard(proDesktop, title);
          return {
            title,
            progress: card?.hasProgress,
            closed: card?.hasClosed,
            buy: card?.hasBuy,
          };
        }),
      ),
    );
    addCheck(
      scenario,
      "Блок подписки показывает Pro",
      /Пакет «Всё включено» активен|Pro-подписка активна/.test(
        proDesktop.subscription,
      ),
      "активный пакет pro или подписка Pro",
      proDesktop.subscription || "блок не найден",
    );
    addCheck(
      scenario,
      "«Инструменты Pro» активны",
      toolsAreActive(proDesktop),
      "карточки без blur, ссылки на /constructor и /profiles",
      JSON.stringify(proDesktop.tools),
    );

    addStep(scenario, "Pro-пользователь: повторяю проверку в mobile.");
    const proMobile = await loginAndCollectDashboard(
      browser,
      "mobile",
      state.proUser,
      scenario,
      "dashboard-pro-mobile.png",
    );
    addCheck(
      scenario,
      "Мобильный кабинет повторяет состояние Pro",
      paidCoursesHaveProgress(proMobile) && toolsAreActive(proMobile),
      "3 курса с прогрессом + активные инструменты",
      JSON.stringify({
        paidProgress: paidCoursesHaveProgress(proMobile),
        toolsActive: toolsAreActive(proMobile),
      }),
    );
  });
}

async function collectProfilesState(page: any) {
  return page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll("li")).filter((item) =>
      /Скачать профиль|Доступно с Pro/.test(item.textContent || ""),
    );

    return {
      cards: cards.length,
      locked: cards.filter((item) =>
        /Доступно с Pro/.test(item.textContent || ""),
      ).length,
      blurred: cards.filter((item) => {
        const inner = item.querySelector(":scope > div") as HTMLElement | null;
        return Boolean(
          inner && /blur\(/.test(window.getComputedStyle(inner).filter),
        );
      }).length,
      downloadLinks: document.querySelectorAll(
        'a[href^="/api/profiles/download"]',
      ).length,
      downloadText: Array.from(
        document.querySelectorAll('a[href^="/api/profiles/download"]'),
      ).map((link) => (link.textContent || "").replace(/\s+/g, " ").trim()),
    };
  });
}

async function scenarioC(
  browser: any,
  state: {
    normalUser: UserInfo;
    proUser: UserInfo;
    proPurchase: { ok: boolean; error: string; warning?: string };
  },
): Promise<Scenario> {
  return runScenario("C", "Профили: 403 для free и 200 для Pro", async (scenario) => {
    addStep(scenario, "Обычный пользователь: открываю /profiles.");
    const freeSession = await loginSession(browser, "desktop", state.normalUser);
    await openPath(freeSession.page, "/profiles");
    const freeState = await collectProfilesState(freeSession.page);

    addCheck(
      scenario,
      "Free: карточки размыты",
      freeState.locked > 0 && freeState.blurred === freeState.locked,
      "все карточки с замком размыты",
      JSON.stringify(freeState),
    );
    addCheck(
      scenario,
      "Free: кнопки «Скачать» нет",
      freeState.downloadLinks === 0,
      "0 ссылок /api/profiles/download",
      `${freeState.downloadLinks} ссылок`,
    );

    // 403/400 ниже — ожидаемые ответы проверки доступа. Собираем ошибки до
    // намеренных fetch-запросов, чтобы браузерный console не считал их дефектом.
    collectErrors(scenario, freeSession);

    const freeFetch = await freeSession.page.evaluate(async (id: string) => {
      const response = await fetch(
        `/api/profiles/download?id=${encodeURIComponent(id)}`,
      );
      const body = await response.text();

      return {
        status: response.status,
        contentType: response.headers.get("content-type"),
        size: body.length,
        body,
      };
    }, PROFILE_ID);

    addCheck(
      scenario,
      "Free: прямой fetch возвращает 403",
      freeFetch.status === 403,
      "HTTP 403 pro_required",
      `HTTP ${freeFetch.status}, ${freeFetch.body.slice(0, 180)}`,
    );

    const freeFileFetch = await freeSession.page.evaluate(async (file: string) => {
      const response = await fetch(
        `/api/profiles/download?file=${encodeURIComponent(file)}`,
      );
      const body = await response.text();

      return { status: response.status, body };
    }, PROFILE_FILE);

    addNote(
      scenario,
      `Free: вариант из задания с параметром file= вернул HTTP ${freeFileFetch.status}. Маршрут app/api/profiles/download/route.ts принимает id=, а не file=; для free проверка авторизации срабатывает раньше параметра.`,
    );

    await screenshot(scenario, freeSession.page, "profiles-free.png");
    await freeSession.context.close();

    addStep(scenario, "Pro-пользователь: открываю /profiles и скачиваю профиль.");
    addCheck(
      scenario,
      "Pro-доступ настроен штатной записью purchases.pro",
      state.proPurchase.ok,
      "purchases.course_id='pro'",
      state.proPurchase.ok
        ? "запись есть"
        : `ошибка: ${state.proPurchase.error}`,
    );

    const proSession = await loginSession(browser, "desktop", state.proUser);
    await openPath(proSession.page, "/profiles");
    const proState = await collectProfilesState(proSession.page);

    addCheck(
      scenario,
      "Pro: кнопка «Скачать профиль» есть",
      proState.downloadLinks > 0,
      "ссылки /api/profiles/download",
      JSON.stringify(proState),
    );

    // Ошибки страницы собираем до намеренных fetch-запросов: 400 на file=
    // ожидаем и проверяется отдельно.
    collectErrors(scenario, proSession);

    const proFetch = await proSession.page.evaluate(async (id: string) => {
      const response = await fetch(
        `/api/profiles/download?id=${encodeURIComponent(id)}`,
      );
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const text = new TextDecoder().decode(bytes.slice(0, 160));

      return {
        status: response.status,
        contentType: response.headers.get("content-type"),
        disposition: response.headers.get("content-disposition"),
        size: buffer.byteLength,
        head: text,
      };
    }, PROFILE_ID);

    addCheck(
      scenario,
      "Pro: прямой fetch возвращает 200",
      proFetch.status === 200,
      "HTTP 200",
      `HTTP ${proFetch.status}`,
    );
    addCheck(
      scenario,
      "Pro: Content-Type корректный",
      Boolean(
        proFetch.contentType &&
          /application\/(json|octet-stream)/.test(proFetch.contentType),
      ),
      "application/json или application/octet-stream",
      proFetch.contentType || "заголовка нет",
    );
    addCheck(
      scenario,
      "Pro: файл не пустой",
      proFetch.size > 0,
      "size > 0",
      `${proFetch.size} байт, начало: ${proFetch.head
        .replace(/\s+/g, " ")
        .slice(0, 80)}`,
    );
    addNote(
      scenario,
      `Скачан профиль ${PROFILE_ID}: ${proFetch.size} байт, Content-Disposition: ${
        proFetch.disposition || "нет"
      }.`,
    );

    const proFileFetch = await proSession.page.evaluate(
      async (file: string) => {
        const response = await fetch(
          `/api/profiles/download?file=${encodeURIComponent(file)}`,
        );
        return { status: response.status, body: await response.text() };
      },
      PROFILE_FILE,
    );
    addNote(
      scenario,
      `Pro: вариант с file= вернул HTTP ${proFileFetch.status}. Это подтверждает, что API принимает id=; file= не является контрактом маршрута.`,
    );

    await screenshot(scenario, proSession.page, "profiles-pro.png");
    await proSession.context.close();
  });
}

async function scenarioD(
  browser: any,
  state: {
    normalUser: UserInfo;
    adminCookies: any[];
  },
): Promise<Scenario> {
  return runScenario("D", "Форум: создание темы, модерация, ответ, удаление", async (scenario) => {
    const normal = await loginSession(browser, "desktop", state.normalUser);

    addStep(scenario, "Открываю /forum/category/printers-bambu и нажимаю «Создать тему».");
    await openPath(normal.page, "/forum/category/printers-bambu");
    const createLink = normal.page
      .getByRole("link", { name: /Создать тему/ })
      .first();
    addCheck(
      scenario,
      "На странице раздела есть ссылка «Создать тему»",
      (await createLink.count()) > 0,
      "ссылка на /forum/new?category=printers-bambu",
      `${await createLink.count()} ссылок`,
    );
    await createLink.click();
    await normal.page.waitForURL(/\/forum\/new/, { timeout: 60000 });

    addStep(scenario, "Заполняю заголовок, текст и согласие с правилами.");
    await normal.page.locator("#thread-title").fill(THREAD_TITLE);
    await normal.page.locator("#thread-content").fill(THREAD_BODY);
    await normal.page.locator('input[name="rules"]').check();
    await screenshot(scenario, normal.page, "forum-new-form.png");

    await normal.page
      .getByRole("button", { name: /Отправить на модерацию/ })
      .click();

    let pendingMessage = "";

    try {
      await normal.page
        .getByRole("heading", { name: "Тема отправлена на модерацию" })
        .waitFor({ state: "visible", timeout: 60000 });
      pendingMessage = await normal.page
        .getByRole("heading", { name: "Тема отправлена на модерацию" })
        .innerText();
    } catch (error: any) {
      pendingMessage =
        (await normal.page
          .locator('[role="alert"]')
          .first()
          .innerText()
          .catch(() => "")) || error?.message || String(error);
    }

    addCheck(
      scenario,
      "После отправки показано «Тема отправлена на модерацию»",
      pendingMessage.includes("Тема отправлена на модерацию"),
      "заголовок успеха",
      pendingMessage || "сообщения нет",
    );
    await screenshot(scenario, normal.page, "forum-new-pending.png");

    addStep(scenario, "Проверяю, что pending-тема не видна на /forum и в разделе.");
    await openPath(normal.page, "/forum");
    const forumHasPending = await normal.page
      .getByText(THREAD_TITLE, { exact: true })
      .count();
    await openPath(normal.page, "/forum/category/printers-bambu");
    const categoryHasPending = await normal.page
      .getByText(THREAD_TITLE, { exact: true })
      .count();

    addCheck(
      scenario,
      "Pending-тема не видна на публичном форуме",
      forumHasPending === 0 && categoryHasPending === 0,
      "0 упоминаний до одобрения",
      `/forum: ${forumHasPending}, раздел: ${categoryHasPending}`,
    );

    collectErrors(scenario, normal);

    addStep(scenario, "Захожу в /admin/forum под админом и одобряю тему.");
    const admin = await adminSession(browser, "desktop", state.adminCookies);
    const adminResponse = await openPath(admin.page, "/admin/forum");
    const adminHeading = await admin.page
      .locator("h1")
      .first()
      .innerText()
      .catch(() => "");

    addCheck(
      scenario,
      "Админка форума открыта под админом",
      adminResponse?.status() === 200 && adminHeading.includes("Форум"),
      "HTTP 200 и h1 «Форум»",
      `HTTP ${adminResponse?.status() ?? "?"}, h1="${adminHeading}"`,
    );

    const authorsView = await adminClient
      .from("forum_authors")
      .select("id")
      .limit(1);
    addNote(
      scenario,
      authorsView.error
        ? `forum_authors недоступен (${authorsView.error.code} ${authorsView.error.message}); имена авторов на форуме падают в fallback «Участник …».`
        : "forum_authors доступен, имена авторов загружаются.",
    );

    const pendingItem = admin.page
      .locator("li")
      .filter({ hasText: THREAD_TITLE })
      .filter({ has: admin.page.getByRole("button", { name: "Одобрить" }) })
      .first();
    const pendingCount = await pendingItem.count();

    addCheck(
      scenario,
      "Тема появилась в очереди модерации",
      pendingCount > 0,
      "pending-тема на /admin/forum",
      `${pendingCount} совпадений`,
    );
    await screenshot(scenario, admin.page, "admin-pending.png");

    if (pendingCount > 0) {
      await pendingItem
        .getByRole("button", { name: "Одобрить" })
        .click();
      await admin.page.waitForTimeout(1500);
      await admin.page.reload({ waitUntil: "domcontentloaded" });
      await admin.page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await admin.page.waitForTimeout(500);
    }

    const publishedTitle = admin.page
      .locator('section[aria-labelledby="published-threads"]')
      .getByText(THREAD_TITLE, { exact: true });
    await publishedTitle
      .first()
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => {});

    addCheck(
      scenario,
      "После «Одобрить» тема опубликована",
      (await publishedTitle.count()) > 0,
      "тема в блоке «Опубликованные темы»",
      `${await publishedTitle.count()} совпадений`,
    );
    await screenshot(scenario, admin.page, "admin-approved.png");

    addStep(scenario, "Возвращаюсь в раздел, открываю тему и пишу ответ.");
    await openPath(normal.page, "/forum/category/printers-bambu");
    const visibleThread = normal.page.getByRole("link", {
      name: THREAD_TITLE,
      exact: true,
    });
    await visibleThread
      .first()
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => {});

    addCheck(
      scenario,
      "Одобренная тема видна в разделе",
      (await visibleThread.count()) > 0,
      "ссылка с заголовком темы",
      `${await visibleThread.count()} совпадений`,
    );

    let threadUrl = "";

    if ((await visibleThread.count()) > 0) {
      await visibleThread.first().click();
      await normal.page.waitForURL(/\/forum\/[^/]+$/, { timeout: 60000 });
      threadUrl = new URL(normal.page.url()).pathname;
    }

    addCheck(
      scenario,
      "Страница темы открывается",
      Boolean(threadUrl),
      "/forum/<slug>",
      threadUrl || "переход не состоялся",
    );

    if (threadUrl) {
      await normal.page.locator("#reply-content").fill(REPLY_TEXT);
      await normal.page
        .getByRole("button", { name: /Отправить ответ/ })
        .click();

      let replyMessage = "";

      try {
        await normal.page
          .getByRole("status")
          .filter({ hasText: "Ответ опубликован" })
          .first()
          .waitFor({ state: "visible", timeout: 30000 });
        replyMessage = await normal.page
          .getByRole("status")
          .filter({ hasText: "Ответ опубликован" })
          .first()
          .innerText();
      } catch (error: any) {
        replyMessage =
          (await normal.page
            .locator('[role="alert"]')
            .first()
            .innerText()
            .catch(() => "")) || error?.message || String(error);
      }

      addCheck(
        scenario,
        "Ответ отправлен",
        replyMessage.includes("Ответ опубликован"),
        "«Ответ опубликован.»",
        replyMessage || "сообщения нет",
      );

      const replyImmediately = await normal.page
        .getByText(REPLY_TEXT, { exact: true })
        .count();
      addCheck(
        scenario,
        "Ответ виден сразу, без перезагрузки",
        replyImmediately > 0,
        "текст ответа в DOM сразу после отправки",
        `${replyImmediately} совпадений`,
      );

      if (replyImmediately === 0) {
        await normal.page.reload({ waitUntil: "domcontentloaded" });
        await normal.page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await normal.page.waitForTimeout(500);
        addNote(
          scenario,
          `После перезагрузки ответ найден: ${await normal.page
            .getByText(REPLY_TEXT, { exact: true })
            .count()} раз.`,
        );
      }

      await screenshot(scenario, normal.page, "thread-approved-reply.png");
    }

    collectErrors(scenario, normal);
    collectErrors(scenario, admin);

    addStep(scenario, "В админке удаляю тему вместе с ответами.");
    await openPath(admin.page, "/admin/forum");
    const deleteItem = admin.page
      .locator("li")
      .filter({ hasText: THREAD_TITLE })
      .filter({ has: admin.page.getByRole("button", { name: "Удалить" }) })
      .first();
    const deleteCount = await deleteItem.count();

    addCheck(
      scenario,
      "У темы в админке есть кнопка «Удалить»",
      deleteCount > 0,
      "кнопка «Удалить» у опубликованной темы",
      `${deleteCount} совпадений`,
    );

    if (deleteCount > 0) {
      admin.page.once("dialog", async (dialog: any) => {
        await dialog.accept();
      });
      await deleteItem.getByRole("button", { name: "Удалить" }).click();
      await admin.page.waitForTimeout(2000);
      await admin.page.reload({ waitUntil: "domcontentloaded" });
      await admin.page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await admin.page.waitForTimeout(500);
    }

    const adminTitleAfterDelete = await admin.page
      .getByText(THREAD_TITLE, { exact: true })
      .count();
    addCheck(
      scenario,
      "После удаления темы нет в админке",
      adminTitleAfterDelete === 0,
      "0 упоминаний",
      `${adminTitleAfterDelete} упоминаний`,
    );
    await screenshot(scenario, admin.page, "admin-deleted.png");

    addStep(scenario, "Проверяю, что тема и ответ исчезли с форума.");
    await openPath(normal.page, "/forum/category/printers-bambu");
    const titleAfterDelete = await normal.page
      .getByText(THREAD_TITLE, { exact: true })
      .count();
    addCheck(
      scenario,
      "После удаления темы нет в разделе",
      titleAfterDelete === 0,
      "0 упоминаний",
      `${titleAfterDelete} упоминаний`,
    );

    // Собираем ошибки до проверки удалённой темы: ожидаемый 404 по её slug —
    // не дефект и не должен попадать в «Ошибки консоли».
    collectErrors(scenario, normal);
    collectErrors(scenario, admin);

    if (threadUrl) {
      const deletedResponse = await openPath(normal.page, threadUrl);
      const deletedBody = await normal.page
        .locator("body")
        .innerText()
        .catch(() => "");
      addCheck(
        scenario,
        "Страница удалённой темы отдаёт 404",
        deletedResponse?.status() === 404 ||
          /404|не найдена|could not be found/i.test(deletedBody),
        "HTTP 404",
        `HTTP ${deletedResponse?.status() ?? "?"}, текст: ${deletedBody
          .replace(/\s+/g, " ")
          .slice(0, 120)}`,
      );
    }

    await normal.context.close();
    await admin.context.close();
  });
}

async function scenarioE(
  browser: any,
  state: { normalUser: UserInfo },
): Promise<Scenario> {
  return runScenario("E", "Клик «Купить» под логином", async (scenario) => {
    const session = await loginSession(browser, "desktop", state.normalUser);

    // Если ключи всё-таки настроены, не уходим на реальную оплату: обрываем
    // переход на Robokassa и фиксируем сам факт попытки.
    await session.context.route("https://auth.robokassa.ru/**", (route: any) =>
      route.abort(),
    );

    addStep(scenario, "Открываю /courses/engineer и нажимаю «Купить».");
    await openPath(session.page, "/courses/engineer");
    const buyButton = session.page
      .getByRole("button", { name: /Купить за/ })
      .first();
    const buyCount = await buyButton.count();

    addCheck(
      scenario,
      "На странице курса есть кнопка «Купить»",
      buyCount > 0,
      "кнопка «Купить за … ₽»",
      `${buyCount} кнопок`,
    );

    let outcome = "timeout";
    let alertText = "";
    let redirectUrl = "";
    let paymentRequestUrl = "";
    let ageDialogVisible = false;
    let agePayEnabled = false;

    if (buyCount > 0) {
      await buyButton.click();

      // Новый обязательный шаг: перед созданием платежа открывается окно 18+.
      const dialog = session.page.getByRole("dialog", {
        name: "Подтвердите возраст",
      });
      ageDialogVisible = await dialog
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => true)
        .catch(() => false);

      if (ageDialogVisible) {
        await dialog.getByRole("checkbox").first().check();
        const payButton = dialog.getByRole("button", {
          name: /Перейти к оплате/,
        });
        agePayEnabled = await payButton.isEnabled();
        await payButton.click();
      }

      const alertPromise = session.page
        .locator('[role="alert"]')
        .first()
        .waitFor({ state: "visible", timeout: 20000 })
        .then(() => "alert");
      // Переход на Robokassa в этом сценарии намеренно обрывается, поэтому
      // waitForURL не сработает. Ждём сам запрос: он уже содержит подпись.
      const redirectPromise = session.page
        .waitForRequest(
          (request: any) => request.url().includes("auth.robokassa.ru"),
          { timeout: 20000 },
        )
        .then((request: any) => {
          paymentRequestUrl = request.url();
          return "redirect";
        });

      outcome = await Promise.race([alertPromise, redirectPromise]).catch(
        () => "timeout",
      );
      await session.page.waitForTimeout(500);

      // У Next.js есть собственный route announcer с role="alert": он может
      // выиграть гонку, хотя запрос на оплату уже сформирован. Приоритет —
      // фактически перехваченный запрос Robokassa.
      if (paymentRequestUrl) {
        outcome = "redirect";
      }

      alertText = await session.page
        .locator('[role="alert"]')
        .first()
        .innerText()
        .catch(() => "");
      redirectUrl = paymentRequestUrl
        ? new URL(paymentRequestUrl).host
        : new URL(session.page.url()).host;
    }

    addCheck(
      scenario,
      "Клик «Купить» открывает подтверждение 18+",
      ageDialogVisible,
      "модальное окно с чекбоксом возраста",
      ageDialogVisible ? "окно открылось" : "окно не появилось",
    );

    addCheck(
      scenario,
      "После отметки 18+ кнопка оплаты активна",
      agePayEnabled,
      "кнопка «Перейти к оплате» доступна",
      agePayEnabled ? "доступна" : "осталась заблокированной",
    );

    addCheck(
      scenario,
      "Клик обработан: редирект на Robokassa или понятный alert",
      outcome === "redirect" ||
        (outcome === "alert" &&
          /Оплата временно недоступна|войдите в аккаунт|не настро/i.test(
            alertText,
          )),
      "auth.robokassa.ru или alert об ошибке оплаты",
      `outcome=${outcome}, host=${redirectUrl || "—"}, alert="${alertText}"`,
    );

    const login = readEnvValue(path.join(ROOT, ".env.local"), "ROBOKASSA_LOGIN");
    const password1 = readEnvValue(
      path.join(ROOT, ".env.local"),
      "ROBOKASSA_PASSWORD1",
    );
    addNote(
      scenario,
      login && password1
        ? "В .env.local есть ROBOKASSA_LOGIN и ROBOKASSA_PASSWORD1."
        : "В .env.local не заданы ROBOKASSA_LOGIN/ROBOKASSA_PASSWORD1 — alert об ошибке оплаты ожидаем.",
    );
    addNote(
      scenario,
      "Реальная оплата не проводилась: переход на auth.robokassa.ru перехвачен и оборван.",
    );

    await screenshot(scenario, session.page, "purchase-engineer.png");
    collectErrors(scenario, session);
    await session.context.close();
  });
}

async function scenarioF(
  browser: any,
  state: {
    normalUser: UserInfo;
    adminCookies: any[];
  },
): Promise<Scenario> {
  return runScenario("F", "Навигация на залогиненной сессии", async (scenario) => {
    const normal = await loginSession(browser, "desktop", state.normalUser);
    await openPath(normal.page, "/dashboard");
    const dashboardLinks = await collectHeaderLinks(normal.page);
    const dashboardStatuses = [];

    for (const link of dashboardLinks) {
      const result = await requestStatus(normal.page, link.href);
      dashboardStatuses.push({ ...link, status: result.status });
    }

    addCheck(
      scenario,
      "Все ссылки шапки /dashboard отвечают 200",
      dashboardStatuses.length > 0 &&
        dashboardStatuses.every((link: any) => link.status === 200),
      "HTTP 200 для каждой ссылки",
      JSON.stringify(dashboardStatuses),
    );

    const profilesOnDashboard = dashboardLinks.find(
      (link: any) => link.text === "Профили",
    );
    addCheck(
      scenario,
      "Ссылка «Профили» есть в шапке /dashboard",
      Boolean(profilesOnDashboard),
      "ссылка «Профили» → /profiles",
      profilesOnDashboard
        ? profilesOnDashboard.href
        : `нет; ссылки: ${dashboardLinks.map((link: any) => link.text).join(", ")}`,
    );
    await screenshot(scenario, normal.page, "navigation-dashboard.png");

    addStep(scenario, "Проверяю общий Header сайта на /forum.");
    await openPath(normal.page, "/forum");
    const globalLinks = await collectHeaderLinks(normal.page);
    const globalStatuses = [];

    for (const link of globalLinks) {
      const result = await requestStatus(normal.page, link.href);
      globalStatuses.push({ ...link, status: result.status });
    }

    const profilesOnForum = globalLinks.find(
      (link: any) => link.text === "Профили",
    );
    addCheck(
      scenario,
      "У авторизованного пользователя есть «Профили» → /profiles",
      profilesOnForum?.href === "/profiles",
      "ссылка /profiles в общем Header",
      profilesOnForum?.href || "ссылки нет",
    );
    addCheck(
      scenario,
      "Все ссылки общего Header отвечают 200",
      globalStatuses.length > 0 &&
        globalStatuses.every((link: any) => link.status === 200),
      "HTTP 200 для каждой ссылки",
      JSON.stringify(globalStatuses),
    );
    addCheck(
      scenario,
      "Обычный пользователь не видит админку",
      !globalLinks.some((link: any) => /Админ/i.test(link.text)) &&
        !dashboardLinks.some((link: any) => /Админ/i.test(link.text)),
      "0 ссылок на админку",
      `dashboard: ${dashboardLinks
        .map((link: any) => link.text)
        .join(", ")}; forum: ${globalLinks
        .map((link: any) => link.text)
        .join(", ")}`,
    );
    await screenshot(scenario, normal.page, "navigation-global-header.png");
    collectErrors(scenario, normal);
    await normal.context.close();

    addStep(scenario, "Проверяю админскую ссылку под админом.");
    const admin = await adminSession(browser, "desktop", state.adminCookies);
    await openPath(admin.page, "/dashboard");
    const adminLink = admin.page
      .getByRole("link", { name: /админ/i })
      .first();
    const adminLinkCount = await adminLink.count();
    const adminHref =
      adminLinkCount > 0
        ? await adminLink.getAttribute("href").catch(() => null)
        : null;
    const adminStatus = adminHref
      ? await requestStatus(admin.page, adminHref)
      : { status: null };

    addCheck(
      scenario,
      "Под админом есть ссылка в админку",
      adminLinkCount > 0 && adminHref === "/admin/forum",
      "ссылка «Открыть админку» → /admin/forum",
      adminLinkCount > 0
        ? `href=${adminHref}, HTTP ${adminStatus.status}`
        : "ссылки нет",
    );
    addCheck(
      scenario,
      "Админка открывается под админом",
      adminStatus.status === 200,
      "HTTP 200 на /admin/forum",
      `HTTP ${adminStatus.status ?? "?"}`,
    );
    collectErrors(scenario, admin);
    await admin.context.close();
  });
}

async function scenarioG(
  browser: any,
  state: { normalUser: UserInfo },
): Promise<Scenario> {
  return runScenario(
    "G",
    "Воронка: главная → курс → 18+ → Robokassa → вебхук → доступ",
    async (scenario) => {
      const session = await loginSession(browser, "desktop", state.normalUser);
      const { page } = session;

      const cardByHeading = (title: string) =>
        page
          .locator("article")
          .filter({
            has: page.getByRole("heading", { name: title, exact: true }),
          })
          .first();

      try {
        addStep(scenario, "Открываю главную и считаю карточки витрины.");
        await openPath(page, "/");

        const cardsCount = await page.locator("#levels article").count();
        addCheck(
          scenario,
          "На главной пять карточек: четыре уровня и пакет",
          cardsCount === 5,
          "5 карточек в блоке #levels",
          `${cardsCount} карточек`,
        );

        const bundleBefore = cardByHeading("Всё включено");
        const bundleTextBefore = (
          await bundleBefore.innerText().catch(() => "")
        ).replace(/\s+/g, " ");
        addCheck(
          scenario,
          "Карточка пакета показывает цену и «Купить пакет»",
          /9\s?900\s?₽/.test(bundleTextBefore) &&
            /Купить пакет/.test(bundleTextBefore),
          "9 900 ₽ и кнопка «Купить пакет»",
          bundleTextBefore || "карточка пакета не найдена",
        );

        addStep(
          scenario,
          "В карточке «Уверенный» нажимаю «Подробнее о курсе» и проверяю текст.",
        );
        const confidentCard = cardByHeading("Уверенный");
        const detailsLink = confidentCard.getByRole("link", {
          name: /Подробнее о курсе/,
        });
        const detailsCount = await detailsLink.count();

        addCheck(
          scenario,
          "У платного уровня есть «Подробнее о курсе»",
          detailsCount > 0,
          "ссылка «Подробнее о курсе»",
          `${detailsCount} ссылок`,
        );

        let detailPath = "";
        let detailHeading = "";
        let detailText = "";

        if (detailsCount > 0) {
          await Promise.all([
            page.waitForURL(/\/courses\/confident$/, { timeout: 30000 }),
            detailsLink.click(),
          ]);
          await page
            .waitForLoadState("networkidle", { timeout: 15000 })
            .catch(() => {});
          detailPath = new URL(page.url()).pathname;
          detailHeading = await page
            .locator("h1")
            .first()
            .innerText()
            .catch(() => "");
          detailText = (
            await page.locator("main").innerText().catch(() => "")
          ).replace(/\s+/g, " ");
        }

        addCheck(
          scenario,
          "«Подробнее о курсе» ведёт на /courses/confident",
          detailPath === "/courses/confident",
          "/courses/confident",
          detailPath || "переход не выполнен",
        );
        addCheck(
          scenario,
          "Страница курса показывает заголовок, описание и цену",
          detailHeading.includes("Уверенный уровень") &&
            /Продолжение базового курса/.test(detailText) &&
            /Купить за 2\s?990\s?₽/.test(detailText),
          "«Уверенный уровень», «Продолжение базового курса», «Купить за 2 990 ₽»",
          `h1="${detailHeading}", текст=${detailText.slice(0, 240)}`,
        );
        await screenshot(scenario, page, "funnel-course-detail.png");

        addStep(
          scenario,
          "Возвращаюсь на главную, открываю окно 18+ и генерирую ссылку на пакет pro.",
        );
        await openPath(page, "/");
        const bundle = cardByHeading("Всё включено");
        await bundle.scrollIntoViewIfNeeded().catch(() => {});
        await screenshot(scenario, page, "funnel-home-before.png");

        const buyBundle = bundle.getByRole("button", {
          name: /Купить пакет/,
        });
        const buyCount = await buyBundle.count();
        const dialog = page.getByRole("dialog", {
          name: "Подтвердите возраст",
        });
        let dialogVisible = false;
        let payEnabled = false;
        let paymentUrl = "";
        let paymentRequestSeen = false;

        if (buyCount > 0) {
          await buyBundle.click();
          dialogVisible = await dialog
            .waitFor({ state: "visible", timeout: 8000 })
            .then(() => true)
            .catch(() => false);
        }

        if (dialogVisible) {
          await screenshot(scenario, page, "funnel-age-dialog.png");
          await dialog.getByRole("checkbox").first().check();
          const payButton = dialog.getByRole("button", {
            name: /Перейти к оплате/,
          });
          payEnabled = await payButton.isEnabled();

          // Реальную оплату не запускаем: перехватываем переход и сохраняем
          // URL, чтобы проверить его параметры и подпись.
          await page
            .context()
            .route("https://auth.robokassa.ru/**", (route: any) =>
              route.abort(),
            );
          const paymentRequestPromise = page
            .waitForRequest(
              (request: any) => request.url().includes("auth.robokassa.ru"),
              { timeout: 25000 },
            )
            .catch(() => null);

          await payButton.click();
          const paymentRequest = await paymentRequestPromise;
          paymentUrl = paymentRequest?.url() ?? "";
          paymentRequestSeen = Boolean(paymentRequest);
        }

        addCheck(
          scenario,
          "Кнопка «Купить пакет» открывает окно 18+",
          buyCount > 0 && dialogVisible,
          "модальное окно «Подтвердите возраст»",
          dialogVisible ? "окно открылось" : "окно не появилось",
        );
        addCheck(
          scenario,
          "После отметки 18+ кнопка «Перейти к оплате» активна",
          payEnabled,
          "кнопка доступна",
          payEnabled ? "доступна" : "недоступна",
        );
        addCheck(
          scenario,
          "Приложение формирует переход на Robokassa",
          paymentRequestSeen &&
            paymentUrl.startsWith("https://auth.robokassa.ru/"),
          "запрос на https://auth.robokassa.ru/Merchant/Index.aspx",
          paymentRequestSeen ? "запрос перехвачен" : "запроса не было",
        );

        const courses = readCoursesData();
        const expectedOutSum = Number(courses.pro.price).toFixed(2);
        const login =
          readEnvValue(path.join(ROOT, ".env.local"), "ROBOKASSA_LOGIN") ||
          process.env.ROBOKASSA_LOGIN ||
          "";
        const password1 =
          readEnvValue(path.join(ROOT, ".env.local"), "ROBOKASSA_PASSWORD1") ||
          process.env.ROBOKASSA_PASSWORD1 ||
          "";

        let invId = 0;
        let outSum = "";
        let shp: Record<string, string> = { course: "", user: "" };
        let signatureValid = false;
        let receiptOk = false;
        let receiptInfo = "чека нет";

        if (paymentUrl) {
          const payment = new URL(paymentUrl);
          const params = payment.searchParams;
          invId = Number(params.get("InvId") || 0);
          outSum = params.get("OutSum") || "";
          shp = {
            course: params.get("Shp_course") || "",
            user: params.get("Shp_user") || "",
          };

          // Receipt дописан последним параметром и уже закодирован: берём его
          // из строки запроса, потому что searchParams вернул бы раскодированный
          // JSON, а в подпись входит именно переданное значение.
          const rawReceipt = paymentUrl.includes("&Receipt=")
            ? (paymentUrl.split("&Receipt=")[1] ?? "").split("&")[0]
            : "";

          if (rawReceipt) {
            try {
              const receipt = JSON.parse(
                decodeURIComponent(rawReceipt.replace(/\+/g, " ")),
              ) as { items?: Array<Record<string, unknown>> };
              const item = receipt.items?.[0];
              const sum = Number(item?.sum ?? 0);

              receiptOk =
                Array.isArray(receipt.items) &&
                receipt.items.length === 1 &&
                Math.round(sum * 100) === Number(outSum) * 100 &&
                Number(item?.quantity ?? 0) === 1 &&
                item?.payment_method === "full_payment" &&
                item?.payment_object === "service" &&
                item?.tax === "none";
              receiptInfo = `${String(item?.name ?? "—")}, sum=${sum}, tax=${String(
                item?.tax ?? "—",
              )}`;
            } catch {
              receiptInfo = "чек не разобрался как JSON";
            }
          }

          signatureValid =
            Boolean(login && password1) &&
            params.get("SignatureValue") ===
              buildPaymentSignature(
                login,
                outSum,
                String(invId),
                rawReceipt,
                shp,
                password1,
              );
        }

        addCheck(
          scenario,
          "Ссылка Robokassa содержит пакет pro, сумму и пользователя",
          invId > 0 &&
            outSum === expectedOutSum &&
            shp.course === "pro" &&
            shp.user === state.normalUser.id,
          `OutSum=${expectedOutSum}, Shp_course=pro, Shp_user=${state.normalUser.id}`,
          `InvId=${invId || "—"}, OutSum=${outSum || "—"}, Shp_course=${
            shp.course || "—"
          }, Shp_user=${shp.user || "—"}`,
        );
        addCheck(
          scenario,
          "Подпись ссылки Robokassa сходится",
          signatureValid,
          "MD5(login:OutSum:InvId:Receipt:password1:Shp_*)",
          signatureValid ? "подпись верна" : "подпись не совпала",
        );
        addCheck(
          scenario,
          "Ссылка содержит чек для ФНС",
          receiptOk,
          "одна позиция full_payment/service, tax=none, sum=OutSum",
          receiptOk ? receiptInfo : "чек не найден или не совпал",
        );

        addStep(
          scenario,
          "Имитирую успешный ResultURL с подписью пароля №2 и проверяю покупку.",
        );
        let webhookStatus = 0;
        let webhookBody = "";
        let webhookError = "";
        let purchaseRows: any[] = [];
        let purchaseError = "";
        let duplicateStatus = 0;
        let duplicateBody = "";
        let duplicateRows = 0;

        if (invId > 0) {
          createdWebhookInvIds.push(invId);

          const first = await postRobokassaResult(outSum, invId, shp);
          webhookStatus = first.status;
          webhookBody = first.body;
          webhookError = first.error;

          const purchase = await findPurchaseByInvId(invId);
          purchaseRows = purchase.rows;
          purchaseError = purchase.error;

          if (purchaseRows[0]?.id) {
            createdPurchaseIds.push(purchaseRows[0].id);
          }

          // Robokassa может повторить уведомление: уникальный inv_id должен
          // сделать обработку идемпотентной.
          const duplicate = await postRobokassaResult(outSum, invId, shp);
          duplicateStatus = duplicate.status;
          duplicateBody = duplicate.body;
          const duplicatePurchase = await findPurchaseByInvId(invId);
          duplicateRows = duplicatePurchase.rows.length;
        }

        addCheck(
          scenario,
          "Подписанный вебхук возвращает OK{InvId}",
          webhookStatus === 200 && webhookBody === `OK${invId}`,
          `HTTP 200, тело OK${invId || "{InvId}"}`,
          webhookError ||
            `HTTP ${webhookStatus || "—"}, тело "${webhookBody || "—"}"`,
        );
        addCheck(
          scenario,
          "Вебхук записал покупку pro на нужную сумму",
          !purchaseError &&
            purchaseRows.length === 1 &&
            purchaseRows[0]?.course_id === "pro" &&
            Math.round(Number(purchaseRows[0]?.amount) * 100) ===
              Math.round(Number(expectedOutSum) * 100),
          `1 запись purchases: course_id=pro, amount=${expectedOutSum}`,
          purchaseError ||
            JSON.stringify(
              purchaseRows.map((row: any) => ({
                course_id: row.course_id,
                amount: row.amount,
              })),
            ),
        );
        addCheck(
          scenario,
          "Повторный вебхук идемпотентен",
          duplicateStatus === 200 &&
            duplicateBody === `OK${invId}` &&
            duplicateRows === 1,
          "повторный OK{InvId} и одна запись purchases",
          `HTTP ${duplicateStatus || "—"}, тело "${
            duplicateBody || "—"
          }", записей ${duplicateRows}`,
        );

        addStep(
          scenario,
          "Открываю главную после оплаты: проверяю «Доступ открыт» и «Продолжить обучение».",
        );
        await openPath(page, "/");

        const bundleAfter = cardByHeading("Всё включено");
        const bundleTextAfter = (
          await bundleAfter.innerText().catch(() => "")
        ).replace(/\s+/g, " ");
        const bundleDashboardLink = bundleAfter.getByRole("link", {
          name: /Перейти в кабинет/,
        });
        const bundleDashboardCount = await bundleDashboardLink.count();

        addCheck(
          scenario,
          "Пакет на главной показывает «Доступ открыт»",
          /Доступ открыт/.test(bundleTextAfter) &&
            !/Купить пакет/.test(bundleTextAfter),
          "плашка «Доступ открыт» без кнопки покупки",
          bundleTextAfter || "карточка пакета не найдена",
        );
        addCheck(
          scenario,
          "Пакет ведёт в кабинет кнопкой «Перейти в кабинет»",
          bundleDashboardCount > 0,
          "ссылка «Перейти в кабинет» → /dashboard",
          `${bundleDashboardCount} ссылок`,
        );

        const levelResults = [];

        for (const title of ["Уверенный", "Инженер", "Заработок"]) {
          const card = cardByHeading(title);
          const text = (await card.innerText().catch(() => "")).replace(
            /\s+/g,
            " ",
          );
          const continueLink = card.getByRole("link", {
            name: /Продолжить обучение/,
          });
          const continueHref =
            (await continueLink.getAttribute("href").catch(() => null)) || "";

          levelResults.push({
            title,
            access: /Доступ открыт/.test(text),
            continueHref,
            noBuy: !/Подробнее о курсе/.test(text) && !/Купить/.test(text),
          });
        }

        addCheck(
          scenario,
          "Три платных уровня открыты после покупки пакета",
          levelResults.every(
            (level) =>
              level.access &&
              /^\/course\/(confident|engineer|profit)$/.test(
                level.continueHref,
              ) &&
              level.noBuy,
          ),
          "«Доступ открыт» + «Продолжить обучение» у трёх уровней",
          JSON.stringify(levelResults),
        );
        await screenshot(scenario, page, "funnel-home-after.png");

        addStep(scenario, "Проверяю статус пакета в личном кабинете.");
        await openPath(page, "/dashboard");
        const dashboardText = (
          await page.locator("main").innerText().catch(() => "")
        ).replace(/\s+/g, " ");
        addCheck(
          scenario,
          "В кабинете пакет показан активным навсегда",
          /Пакет «Всё включено» активен навсегда/.test(dashboardText),
          "«Пакет «Всё включено» активен навсегда»",
          dashboardText.slice(0, 300) || "текст кабинета не найден",
        );
        await screenshot(scenario, page, "funnel-dashboard-after.png");

        addNote(
          scenario,
          "Реальная оплата не проводилась: переход на auth.robokassa.ru перехвачен и оборван, ResultURL подписан локально паролем №2.",
        );
      } finally {
        collectErrors(scenario, session);
        await session.context.close().catch(() => {});
      }
    },
  );
}


function buildReport(
  scenarios: Scenario[],
  meta: {
    startedAt: Date;
    finishedAt: Date;
    browserVersion: string;
    playwrightVersion: string;
    nodeVersion: string;
    normalUser?: UserInfo;
    proUser?: UserInfo;
    proPurchase: { ok: boolean; error: string; warning?: string };
    setupWarnings: string[];
    cleanup: string[];
    gitStatus: string;
  },
): string {
  const lines: string[] = [];
  const passed = scenarios.filter((item) => item.status === "PASS").length;
  const failed = scenarios.length - passed;

  lines.push("# E2E-аудит TriDi");
  lines.push("");
  lines.push(`- Дата: ${meta.startedAt.toISOString()} — ${meta.finishedAt.toISOString()}`);
  lines.push(`- Сайт: ${BASE_URL}`);
  lines.push(`- Браузер: Chrome ${meta.browserVersion}, Playwright ${meta.playwrightVersion}, Node ${meta.nodeVersion}`);
  lines.push(`- Админ для модерации: ${ADMIN_EMAIL} (сессия через service-role magiclink, пароль не менялся)`);
  lines.push("");
  lines.push("## Подготовка");
  lines.push("");
  lines.push(
    `- Обычный пользователь: \`${NORMAL_EMAIL}\`, пароль \`${NORMAL_PASSWORD}\`${
      meta.normalUser ? `, id \`${meta.normalUser.id}\`` : " (не создан)"
    }.`,
  );
  lines.push(
    `- Pro-пользователь: \`${PRO_EMAIL}\`, пароль \`${PRO_PASSWORD}\`${
      meta.proUser ? `, id \`${meta.proUser.id}\`` : " (не создан)"
    }.`,
  );
  lines.push(
    `- Попытка вставить \`purchases\` с \`course_id='pro'\`: ${
      meta.proPurchase.ok ? "успешно" : `ошибка — ${meta.proPurchase.error}`
    }.`,
  );

  for (const warning of meta.setupWarnings) {
    lines.push(`- ${warning}`);
  }

  lines.push("");
  lines.push("## Сценарии");
  lines.push("");

  for (const scenario of scenarios) {
    lines.push(`## Сценарий ${scenario.id}: ${scenario.title}`);
    lines.push("");
    lines.push(`- **Результат:** ${scenario.status}`);
    lines.push("- **Шаги:**");

    if (scenario.steps.length === 0) {
      lines.push("  1. Шаги не зафиксированы.");
    } else {
      scenario.steps.forEach((step, index) => {
        lines.push(`  ${index + 1}. ${step}`);
      });
    }

    lines.push(
      `- **Скриншоты:** ${
        scenario.screenshots.length > 0
          ? scenario.screenshots.map((item) => `\`${item}\``).join(", ")
          : "нет"
      }`,
    );
    lines.push(
      `- **Ошибки консоли:** ${
        scenario.errors.length > 0
          ? scenario.errors.map((item) => `\`${mdCell(item)}\``).join("; ")
          : "нет"
      }`,
    );
    lines.push("- **Ожидалось / Получено:**");
    lines.push("");
    lines.push("| Проверка | Ожидалось | Получено | Итог |");
    lines.push("| --- | --- | --- | --- |");

    for (const check of scenario.checks) {
      lines.push(
        `| ${mdCell(check.name)} | ${mdCell(check.expected)} | ${mdCell(
          check.actual,
        )} | ${check.ok ? "PASS" : "FAIL"} |`,
      );
    }

    if (scenario.notes.length > 0) {
      lines.push("");
      lines.push("- **Примечания:**");
      scenario.notes.forEach((note) => {
        lines.push(`  - ${note}`);
      });
    }

    lines.push("");
  }

  lines.push("## Сводка");
  lines.push("");
  lines.push("| Сценарий | Результат | Проваленные проверки |");
  lines.push("| --- | --- | --- |");

  for (const scenario of scenarios) {
    const failedChecks = scenario.checks
      .filter((check) => !check.ok)
      .map((check) => check.name);

    lines.push(
      `| ${scenario.id}. ${mdCell(scenario.title)} | ${scenario.status} | ${
        failedChecks.length > 0
          ? mdCell(failedChecks.join("; "))
          : "—"
      } |`,
    );
  }

  lines.push("");
  lines.push(`**PASS:** ${passed} из ${scenarios.length}; **FAIL:** ${failed} из ${scenarios.length}.`);
  lines.push("");

  const failedChecks = scenarios.flatMap((scenario) =>
    scenario.checks
      .filter((check) => !check.ok)
      .map((check) => `${scenario.id}: ${check.name} — ${check.actual}`),
  );

  lines.push("### Ключевые провалы");
  lines.push("");

  if (failedChecks.length === 0) {
    lines.push("Проваленных проверок нет.");
  } else {
    failedChecks.forEach((item) => {
      lines.push(`- ${item}`);
    });
  }

  lines.push("");
  lines.push("## Уборка");
  lines.push("");
  meta.cleanup.forEach((line) => {
    lines.push(`- ${line}`);
  });
  lines.push("");
  lines.push("`git status --porcelain`:");
  lines.push("");
  lines.push("```text");
  lines.push(meta.gitStatus || "(пусто)");
  lines.push("```");
  lines.push("");
  lines.push(
    "Скрипт `scripts/audit-e2e.ts` временный и не коммитился. Изображения в чат не передавались — только пути к файлам.",
  );
  lines.push("");

  return lines.join("\n");
}

function printSummary(scenarios: Scenario[]) {
  console.log("\nИтог E2E:");

  for (const scenario of scenarios) {
    const failed = scenario.checks.filter((check) => !check.ok);
    console.log(
      `  ${scenario.id}. ${scenario.title}: ${scenario.status}${
        failed.length > 0
          ? ` (${failed.map((check) => check.name).join("; ")})`
          : ""
      }`,
    );
  }
}

async function main() {
  const startedAt = new Date();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  initEnvironment();

  console.log(`E2E-аудит TriDi: ${BASE_URL}`);
  console.log(`Chrome: ${CHROME_PATH}`);
  console.log(`Админ: ${ADMIN_EMAIL}`);

  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(
      `Google Chrome не найден: ${CHROME_PATH}. Укажите путь через CHROME_PATH.`,
    );
  }

  const probe = await fetch(`${BASE_URL}/`, {
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  }).catch((error: any) => {
    throw new Error(
      `Dev-сервер недоступен на ${BASE_URL}: ${error?.message || error}. Запустите npm run dev.`,
    );
  });

  if (probe.status >= 500) {
    throw new Error(`Dev-сервер отвечает ${probe.status} на ${BASE_URL}/`);
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: ["--disable-dev-shm-usage", "--hide-scrollbars", "--mute-audio"],
  });
  const browserVersion = browser.version();

  const scenarios: Scenario[] = [];
  const setupWarnings: string[] = [];
  let normalUser: UserInfo | undefined;
  let proUser: UserInfo | undefined;
  let proPurchase: {
    ok: boolean;
    error: string;
    warning?: string;
  } = { ok: false, error: "не выполнялась" };
  let cleanup: string[] = [];
  let fatalError = "";

  try {
    const state: { normalUser?: UserInfo } = {};
    console.log("\nСценарий A: регистрация и вход...");
    scenarios.push(await scenarioA(browser, state));
    normalUser = state.normalUser;

    if (!normalUser) {
      normalUser = await ensureUser(
        NORMAL_EMAIL,
        NORMAL_PASSWORD,
        "E2E Audit",
      );
      setupWarnings.push(
        "Обычный пользователь создан через service-role: UI-регистрация не вернула пользователя.",
      );
    }

    console.log("Подготовка Pro-пользователя...");
    proUser = await ensureUser(PRO_EMAIL, PRO_PASSWORD, "Pro Audit");
    const courses = readCoursesData();
    proPurchase = await attemptPurchase(
      proUser.id,
      "pro",
      courses.pro.price,
    );

    if (!proPurchase.ok) {
      setupWarnings.push(
        `Не удалось создать purchases.course_id='pro': ${proPurchase.error}. Это блокирует штатную проверку пакета pro.`,
      );
    }
    if (proPurchase.warning) {
      setupWarnings.push(proPurchase.warning);
    }

    let adminCookies: any[] = [];

    try {
      adminCookies = await buildAdminCookies(ADMIN_EMAIL);
    } catch (error: any) {
      setupWarnings.push(
        `Не удалось открыть админ-сессию ${ADMIN_EMAIL}: ${error?.message || error}`,
      );
    }

    console.log("Сценарий B: дашборд...");
    scenarios.push(
      await scenarioB(browser, {
        normalUser,
        proUser,
        proPurchase,
      }),
    );

    console.log("Сценарий C: профили...");
    scenarios.push(
      await scenarioC(browser, {
        normalUser,
        proUser,
        proPurchase,
      }),
    );

    console.log("Сценарий D: форум...");
    scenarios.push(
      await scenarioD(browser, {
        normalUser,
        adminCookies,
      }),
    );

    console.log("Сценарий E: оплата...");
    scenarios.push(await scenarioE(browser, { normalUser }));

    console.log("Сценарий F: навигация...");
    scenarios.push(
      await scenarioF(browser, {
        normalUser,
        adminCookies,
      }),
    );

    console.log("Сценарий G: воронка оплаты...");
    scenarios.push(await scenarioG(browser, { normalUser }));
  } catch (error: any) {
    fatalError = error?.stack || String(error);
    console.error("\nE2E-аудит остановлен:");
    console.error(fatalError);
  } finally {
    console.log("\nУборка тестовых данных...");

    try {
      cleanup = await cleanupAll();
    } catch (error: any) {
      cleanup = [`cleanup error: ${error?.stack || error}`];
    }

    await browser.close().catch(() => {});
  }

  const finishedAt = new Date();
  const report = buildReport(scenarios, {
    startedAt,
    finishedAt,
    browserVersion,
    playwrightVersion: JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "node_modules", "playwright", "package.json"),
        "utf8",
      ),
    ).version,
    nodeVersion: process.version,
    normalUser,
    proUser,
    proPurchase,
    setupWarnings,
    cleanup,
    gitStatus: gitStatusPorcelain(),
  });

  fs.writeFileSync(REPORT_PATH, report, "utf8");
  printSummary(scenarios);
  console.log(`\nОтчёт: ${REPORT_PATH}`);
  console.log(`Скриншоты: ${OUT_DIR}`);

  if (fatalError) {
    process.exitCode = 1;
  }
}

main().catch((error: any) => {
  console.error("\nE2E-аудит завершился с ошибкой:");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
