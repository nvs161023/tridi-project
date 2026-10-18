/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports -- Скрипт запускается напрямую через Node и работает с динамическими DOM/Playwright-данными. */
/**
 * Скрипт аудита сайта TriDi (web + mobile) перед релизом.
 *
 * Запуск (dev-сервер уже слушает порт 3117):
 *   node scripts/audit-site.ts
 *
 * Что делает:
 *  - проходит 20 публичных и защищённых роутов в двух прогонах:
 *    desktop 1440x900 и mobile 390x844 (UA мобильного Chrome);
 *  - фиксирует HTTP-статусы и цепочку редиректов (для закрытых страниц);
 *  - собирает console.error / console.warn (без React DevTools и HMR),
 *    pageerror и requestfailed / ответы 4xx-5xx;
 *  - ищет горизонтальный скролл и переполнение в прокручиваемых контейнерах
 *    (overflow-x: auto|scroll);
 *  - дополнительно ищет элементы за пределами viewport, обрезанный текст
 *    и наложения видимых интерактивных элементов;
 *  - делает full-page скриншоты в audit-screenshots/;
 *  - проверяет ссылки Header на / и /subscription, карточки категорий /forum,
 *    каскадные селекты /profiles и кнопки «Купить» на /courses/*;
 *  - пишет audit-report.md и краткую сводку в консоль.
 *
 * Cookie-баннер скрывается через localStorage, чтобы не перекрывать контент
 * на скриншотах. Никакие изображения в чат не передаются — только файлы.
 */

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

type DeviceName = "desktop" | "mobile";
type RouteKind = "public" | "protected";

type Device = {
  name: DeviceName;
  viewport: { width: number; height: number };
  mobile: boolean;
  userAgent: string;
};

type Route = {
  path: string;
  label: string;
  kind: RouteKind;
};

type ConsoleIssue = {
  kind: "console" | "pageerror";
  level: string;
  text: string;
  location: string;
};

type NetworkIssue = {
  url: string;
  status: number | null;
  detail: string;
  resourceType: string;
};

type OverflowIssue = {
  selector: string;
  tag: string;
  text: string;
  scrollWidth: number;
  clientWidth: number;
  overflowX: string;
};

type OutsideIssue = {
  selector: string;
  tag: string;
  text: string;
  left: number;
  right: number;
  width: number;
};

type ClippedIssue = {
  selector: string;
  tag: string;
  text: string;
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
  overflowX: string;
  overflowY: string;
  textOverflow: string;
};

type OverlapIssue = {
  aSelector: string;
  bSelector: string;
  aText: string;
  bText: string;
};

type Metrics = {
  innerWidth: number;
  scrollWidth: number;
  bodyScrollWidth: number;
  hasHorizontalScroll: boolean;
  overflowPx: number;
  overflow: OverflowIssue[];
  outside: OutsideIssue[];
  clipped: ClippedIssue[];
  overlaps: OverlapIssue[];
  documentHeight: number;
};

type HeaderLink = {
  raw: string;
  abs: string;
  text: string;
  visible: boolean;
};

type HeaderCheck = {
  raw: string;
  abs: string;
  text: string;
  visible: boolean;
  sources: string[];
  status: number | null;
  chain: string[];
  finalPath: string;
  ok: boolean;
  error: string;
};

type CategoryLink = {
  href: string;
  abs: string;
  text: string;
  visible: boolean;
  status: number | null;
  finalPath: string;
  ok: boolean;
  error: string;
};

type ProfileSelect = {
  label: string;
  disabled: boolean;
  options: number;
  visible: boolean;
};

type ProfileCheck = {
  selects: ProfileSelect[];
  modelBefore: { disabled: boolean; options: number } | null;
  modelAfter: { disabled: boolean; options: number } | null;
  cascadeError: string;
};

type BuyButton = {
  text: string;
  tag: string;
  disabled: boolean;
  visible: boolean;
  pointerEvents: string;
  href: string;
  ok: boolean;
};

type BuyCheck = {
  buttons: BuyButton[];
  guestClick: { text: string; href: string } | null;
  guestClickError: string;
};

type Run = {
  route: Route;
  device: DeviceName;
  finalStatus: number | null;
  firstStatus: number | null;
  chain: { url: string; status: number | null }[];
  finalUrl: string;
  finalPath: string;
  console: ConsoleIssue[];
  network: NetworkIssue[];
  metrics: Metrics | null;
  screenshot: string;
  headerLinks: HeaderLink[];
  forum: {
    links: { href: string; text: string; visible: boolean }[];
    articles: { text: string; href: string; isLink: boolean }[];
  } | null;
  profiles: ProfileCheck | null;
  buy: BuyCheck | null;
  gotoError: string;
  screenshotError: string;
  durationMs: number;
};

const ROOT = path.resolve(__dirname, "..");
const BASE_URL = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3117";
const OUT_DIR = path.join(ROOT, "audit-screenshots");
const REPORT_PATH = path.join(ROOT, "audit-report.md");
const CHROME_PATH =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36";

const DEVICES: Device[] = [
  {
    name: "desktop",
    viewport: { width: 1440, height: 900 },
    mobile: false,
    userAgent: DESKTOP_UA,
  },
  {
    name: "mobile",
    viewport: { width: 390, height: 844 },
    mobile: true,
    userAgent: MOBILE_UA,
  },
];

/** Служебные сообщения dev-режима, которые не считаем дефектами. */
const IGNORED_CONSOLE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /\[HMR\]/i,
  /\[webpack\]/i,
  /favicon\.ico/i,
];

const IGNORED_NETWORK = [/favicon\.ico/i, /^data:/i, /^blob:/i];

function routeSlug(routePath: string): string {
  if (routePath === "/") return "home";
  return routePath
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase();
}

/** Все страницы раздела /legal собираются из файловой системы. */
function discoverLegalRoutes(): Route[] {
  const base = path.join(ROOT, "app", "legal");
  const found: Route[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "page.tsx") {
        const rel = path.relative(base, dir).replace(/\\/g, "/");
        found.push({
          path: rel ? `/legal/${rel}` : "/legal",
          label: "Юридический документ",
          kind: "public",
        });
      }
    }
  }

  walk(base);

  return found.sort(
    (a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path),
  );
}

const ROUTES: Route[] = [
  { path: "/", label: "Главная", kind: "public" },
  { path: "/subscription", label: "Тарифы", kind: "public" },
  { path: "/courses/confident", label: "Курс «Уверенный»", kind: "public" },
  { path: "/courses/engineer", label: "Курс «Инженер»", kind: "public" },
  { path: "/courses/profit", label: "Курс «Заработок»", kind: "public" },
  { path: "/courses/pro", label: "Пакет «Всё включено»", kind: "public" },
  { path: "/profiles", label: "Библиотека профилей", kind: "public" },
  { path: "/forum", label: "Форум", kind: "public" },
  {
    path: "/forum/category/printers-bambu",
    label: "Форум: Bambu Lab",
    kind: "public",
  },
  { path: "/forum/rules", label: "Правила форума", kind: "public" },
  { path: "/auth/login", label: "Вход", kind: "public" },
  { path: "/auth/sign-up", label: "Регистрация", kind: "public" },
  ...discoverLegalRoutes(),
  { path: "/dashboard", label: "Личный кабинет", kind: "protected" },
  { path: "/admin/forum", label: "Админка форума", kind: "protected" },
];

function isIgnoredConsole(text: string, location: string): boolean {
  const value = `${text} ${location}`;
  return IGNORED_CONSOLE.some((pattern) => pattern.test(value));
}

function isIgnoredNetwork(url: string): boolean {
  return IGNORED_NETWORK.some((pattern) => pattern.test(url));
}

function mdCell(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function shortText(value: string, limit: number): string {
  const text = mdCell(value).replace(/\s+/g, " ");
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function authExpectation(route: Route): string {
  return route.kind === "protected"
    ? "гость → редирект на /auth/login"
    : "гость → 200";
}



async function readRedirectChain(
  response: any,
): Promise<{ url: string; status: number | null }[]> {
  const hops: { url: string; status: number | null }[] = [];

  try {
    let request = response?.request();

    while (request) {
      const hopResponse = await request.response().catch(() => null);
      hops.unshift({
        url: request.url(),
        status: hopResponse ? hopResponse.status() : null,
      });
      request = request.redirectedFrom();
    }
  } catch {
    // Цепочка нужна только для отчёта.
  }

  return hops;
}

/** Метрики считаются в браузере: горизонтальный скролл и визуальные аномалии. */
async function collectMetrics(page: any): Promise<Metrics> {
  return page.evaluate(() => {
    function readSelector(element: Element): string {
      const el = element as HTMLElement;
      let selector = el.tagName.toLowerCase();

      if (el.id) selector += `#${el.id}`;

      const classNames =
        typeof el.className === "string"
          ? el.className.split(/\s+/).filter(Boolean).slice(0, 3)
          : [];

      if (classNames.length) selector += `.${classNames.join(".")}`;

      return selector;
    }

    function describe(element: Element): string {
      return (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
    }

    function isVisible(element: Element): boolean {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0.05 &&
        rect.width > 0 &&
        rect.height > 0
      );
    }

    const root = document.documentElement;
    const innerWidth = window.innerWidth;
    const scrollWidth = root.scrollWidth;
    const bodyScrollWidth = document.body ? document.body.scrollWidth : 0;
    const overflow: any[] = [];
    const outside: any[] = [];
    const clipped: any[] = [];
    const overlaps: any[] = [];
    const all = Array.from(
      document.body ? document.body.querySelectorAll("*") : [],
    );

    for (const el of all) {
      if (!isVisible(el)) continue;

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const text = describe(el);
      const decorative =
        style.pointerEvents === "none" || el.getAttribute("aria-hidden") === "true";

      // Смысл имеет только переполнение у контейнеров, которые умеют
      // прокручиваться. У `overflow: visible` содержимое просто рисуется
      // поверх соседей и дефектом не является.
      const scrollableX =
        style.overflowX === "auto" || style.overflowX === "scroll";

      if (
        !decorative &&
        scrollableX &&
        el.tagName !== "HTML" &&
        el.tagName !== "BODY" &&
        el.clientWidth > 0 &&
        el.scrollWidth > el.clientWidth + 2
      ) {
        overflow.push({
          selector: readSelector(el),
          tag: el.tagName.toLowerCase(),
          text,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: style.overflowX,
        });
      }

      if (
        !decorative &&
        (rect.right > innerWidth + 2 || rect.left < -2) &&
        (text.length > 0 || el.matches("img, svg, canvas"))
      ) {
        outside.push({
          selector: readSelector(el),
          tag: el.tagName.toLowerCase(),
          text,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }

      if (
        !decorative &&
        !el.classList.contains("sr-only") &&
        text.length > 0 &&
        el.children.length === 0 &&
        (el.scrollWidth > el.clientWidth + 2 ||
          el.scrollHeight > el.clientHeight + 2) &&
        (style.overflowX !== "visible" ||
          style.overflowY !== "visible" ||
          style.textOverflow === "ellipsis")
      ) {
        clipped.push({
          selector: readSelector(el),
          tag: el.tagName.toLowerCase(),
          text,
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          textOverflow: style.textOverflow,
        });
      }
    }

    const clickable = all.filter(
      (el) =>
        ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) &&
        isVisible(el),
    );

    for (const el of clickable) {
      const rect = el.getBoundingClientRect();

      if (rect.top < 0 || rect.bottom > window.innerHeight) continue;

      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      if (x < 0 || x > innerWidth) continue;

      const top = document.elementFromPoint(x, y);

      if (!top || top === el || el.contains(top) || top.contains(el)) continue;
      if (top === document.body || top === document.documentElement) continue;

      if (window.getComputedStyle(top).pointerEvents === "none") continue;

      overlaps.push({
        aSelector: readSelector(el),
        bSelector: readSelector(top),
        aText: describe(el),
        bText: describe(top),
      });
    }

    return {
      innerWidth,
      scrollWidth,
      bodyScrollWidth,
      hasHorizontalScroll: scrollWidth > innerWidth,
      overflowPx: Math.max(0, scrollWidth - innerWidth),
      overflow: overflow.slice(0, 12),
      outside: outside.slice(0, 12),
      clipped: clipped.slice(0, 12),
      overlaps: overlaps.slice(0, 8),
      documentHeight: root.scrollHeight,
    };
  });
}

async function auditRoute(
  browser: any,
  route: Route,
  device: Device,
): Promise<Run> {
  const started = Date.now();
  const context = await browser.newContext({
    viewport: device.viewport,
    userAgent: device.userAgent,
    isMobile: device.mobile,
    hasTouch: device.mobile,
    deviceScaleFactor: device.mobile ? 3 : 1,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
  });

  // Cookie-баннер не должен перекрывать контент на скриншотах.
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

  const page = await context.newPage();
  const consoleIssues: ConsoleIssue[] = [];
  const networkIssues: NetworkIssue[] = [];
  let closing = false;

  page.on("console", (message: any) => {
    const type = message.type();

    if (type !== "error" && type !== "warning") return;

    const place = message.location();
    const location = place.url
      ? `${place.url}:${place.lineNumber ?? 0}:${place.columnNumber ?? 0}`
      : "";
    const text = message.text();

    if (isIgnoredConsole(text, location)) return;

    consoleIssues.push({ kind: "console", level: type, text, location });
  });

  page.on("pageerror", (error: any) => {
    const stack = typeof error?.stack === "string" ? error.stack : "";

    consoleIssues.push({
      kind: "pageerror",
      level: "error",
      text: error?.message || String(error),
      location: stack.split("\n").slice(0, 6).join(" "),
    });
  });

  page.on("requestfailed", (request: any) => {
    if (closing) return;

    const url = request.url();

    if (isIgnoredNetwork(url)) return;

    networkIssues.push({
      url,
      status: null,
      detail: request.failure()?.errorText || "request failed",
      resourceType: request.resourceType(),
    });
  });

  page.on("response", (response: any) => {
    if (closing) return;

    const status = response.status();

    if (status < 400) return;

    const url = response.url();

    if (isIgnoredNetwork(url)) return;

    networkIssues.push({
      url,
      status,
      detail: response.statusText(),
      resourceType: response.request().resourceType(),
    });
  });

  let response: any = null;
  let gotoError = "";

  try {
    response = await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // networkidle в dev-режиме может не наступить из-за фоновых соединений,
    // поэтому ждём его с ограничением, но не считаем таймаут ошибкой.
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
  } catch (error: any) {
    gotoError = error?.stack || error?.message || String(error);
  }

  let metrics: Metrics | null = null;

  try {
    metrics = await collectMetrics(page);
  } catch (error: any) {
    gotoError = [gotoError, `metrics: ${error?.message || String(error)}`]
      .filter(Boolean)
      .join("\n");
  }

  let headerLinks: HeaderLink[] = [];

  try {
    headerLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll("header a[href]")).map((link) => {
        const anchor = link as HTMLAnchorElement;

        return {
          raw: anchor.getAttribute("href") || "",
          abs: anchor.href,
          text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
          visible: Boolean(anchor.offsetWidth || anchor.offsetHeight),
        };
      }),
    );
  } catch {
    // Шапки может не быть — это не ошибка.
  }

  let forum: Run["forum"] = null;

  if (route.path === "/forum") {
    try {
      forum = await page.evaluate(() => ({
        links: Array.from(
          document.querySelectorAll('a[href*="/forum/category/"]'),
        ).map((link) => ({
          href: link.getAttribute("href") || "",
          text: (
            link.querySelector("h2, h3, h4")?.textContent ||
            (link as HTMLElement).innerText ||
            ""
          )
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 120),
          visible: Boolean(
            (link as HTMLElement).offsetWidth ||
              (link as HTMLElement).offsetHeight,
          ),
        })),
        articles: Array.from(document.querySelectorAll("article")).map(
          (article) => {
            const anchor = article.closest("a[href]") as HTMLAnchorElement | null;

            return {
              text: ((article as HTMLElement).innerText || "")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 120),
              href: anchor?.getAttribute("href") || "",
              isLink: Boolean(
                article.closest('a[href*="/forum/category/"]'),
              ),
            };
          },
        ),
      }));
    } catch {
      forum = null;
    }
  }


  let profiles: ProfileCheck | null = null;

  if (route.path === "/profiles") {
    profiles = {
      selects: [],
      modelBefore: null,
      modelAfter: null,
      cascadeError: "",
    };

    try {
      profiles.selects = await page.evaluate(() =>
        Array.from(document.querySelectorAll("select")).map((select) => {
          const element = select as HTMLSelectElement;
          const rect = element.getBoundingClientRect();

          return {
            label:
              element
                .closest("label")
                ?.querySelector("span")
                ?.textContent?.trim() || "",
            disabled: element.disabled,
            options: element.options.length,
            visible: rect.width > 0 && rect.height > 0,
          };
        }),
      );

      const selects = page.locator("select");

      if ((await selects.count()) >= 2) {
        profiles.modelBefore = await selects.nth(1).evaluate((select: any) => ({
          disabled: select.disabled,
          options: select.options.length,
        }));

        try {
          await selects.nth(0).selectOption({ label: "Bambu Lab" });
          await page.waitForTimeout(400);

          profiles.modelAfter = await selects.nth(1).evaluate((select: any) => ({
            disabled: select.disabled,
            options: select.options.length,
          }));

          await selects.nth(0).selectOption({ label: "Все бренды" });
          await page.waitForTimeout(300);
        } catch (error: any) {
          profiles.cascadeError = error?.message || String(error);
        }
      }
    } catch (error: any) {
      profiles.cascadeError = error?.message || String(error);
    }
  }

  let buy: BuyCheck | null = null;

  if (route.path.startsWith("/courses/")) {
    buy = { buttons: [], guestClick: null, guestClickError: "" };

    try {
      buy.buttons = await page.evaluate(() => {
        const root = document.querySelector("main") || document.body;

        return Array.from(root.querySelectorAll("button, a[href]"))
          .filter((element) => /Купить/i.test((element.textContent || "").trim()))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            const visible =
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              Number(style.opacity) > 0.05;
            const disabled =
              (element as HTMLButtonElement).disabled === true ||
              element.getAttribute("aria-disabled") === "true";

            return {
              text: (element.textContent || "").replace(/\s+/g, " ").trim(),
              tag: element.tagName.toLowerCase(),
              disabled,
              visible,
              pointerEvents: style.pointerEvents,
              href:
                element.tagName === "A"
                  ? (element as HTMLAnchorElement).getAttribute("href") || ""
                  : "",
              ok: visible && !disabled && style.pointerEvents !== "none",
            };
          });
      });
    } catch (error: any) {
      buy.guestClickError = `collect: ${error?.message || String(error)}`;
    }
  }

  let screenshot = "";
  let screenshotError = "";

  try {
    await page.evaluate(() => window.scrollTo(0, 0));

    const screenshotFile = path.join(
      OUT_DIR,
      `${routeSlug(route.path)}-${device.name}.png`,
    );

    await page.screenshot({
      path: screenshotFile,
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      timeout: 90000,
    });

    screenshot = path.relative(ROOT, screenshotFile).replace(/\\/g, "/");
  } catch (error: any) {
    screenshotError = error?.message || String(error);
  }

  // Проверка гостевого сценария оплаты — только один раз и только на desktop.
  // Гость не может создать платёж: Server Action вернёт приглашение войти.
  if (buy && route.path === "/courses/confident" && device.name === "desktop") {
    try {
      const button = page.locator("main button", { hasText: /Купить/ }).first();

      if ((await button.count()) > 0) {
        await button.click({ timeout: 8000 });

        // Server Action гостя возвращает сообщение «войдите в аккаунт» в
        // inline-alert. Ждём именно его, чтобы не поймать служебный alert
        // dev-оверлея Next.js.
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const found = await page.evaluate(() =>
            Array.from(document.querySelectorAll('[role="alert"]'))
              .map((element) => ({
                text: (element.textContent || "").replace(/\s+/g, " ").trim(),
                href:
                  element.querySelector("a")?.getAttribute("href") || "",
              }))
              .find((item) => /войд|вход|оплат/i.test(item.text)) ?? null,
          );

          if (found) {
            buy.guestClick = found;
            break;
          }

          await page.waitForTimeout(250);
        }

        if (!buy.guestClick) {
          buy.guestClickError =
            "alert с приглашением войти не появился за 10 секунд после клика";
        }
      } else {
        buy.guestClickError = "кнопка «Купить» не найдена";
      }
    } catch (error: any) {
      buy.guestClickError = error?.message || String(error);
    }
  }

  const finalUrl = page.url();
  let finalPath = finalUrl;

  try {
    const parsed = new URL(finalUrl);
    finalPath = `${parsed.pathname}${parsed.search}`;
  } catch {
    // Оставляем полный URL.
  }

  const chain = await readRedirectChain(response);
  const finalStatus = response ? response.status() : null;
  const firstStatus = chain.length ? chain[0].status ?? finalStatus : finalStatus;

  closing = true;
  await context.close();

  return {
    route,
    device: device.name,
    finalStatus,
    firstStatus,
    chain,
    finalUrl,
    finalPath,
    console: consoleIssues,
    network: networkIssues,
    metrics,
    screenshot,
    headerLinks,
    forum,
    profiles,
    buy,
    gotoError,
    screenshotError,
    durationMs: Date.now() - started,
  };
}


async function primeGuestContext(context: any) {
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem(
        "tridi-cookie-consent",
        JSON.stringify({ scope: "necessary", savedAt: new Date().toISOString() }),
      );
    } catch {
      // Ничего страшного: баннер может остаться.
    }
  });
}

/** Ссылки Header с / и /subscription проверяются реальным переходом. */
async function checkHeaderLinks(browser: any, runs: Run[]): Promise<HeaderCheck[]> {
  const collected = new Map<string, HeaderCheck>();

  for (const run of runs) {
    if (run.route.path !== "/" && run.route.path !== "/subscription") continue;

    for (const link of run.headerLinks) {
      if (!link.abs.startsWith("http")) continue;

      try {
        if (new URL(link.abs).origin !== new URL(BASE_URL).origin) continue;
      } catch {
        continue;
      }

      const existing = collected.get(link.abs);

      if (existing) {
        if (!existing.sources.includes(run.route.path)) {
          existing.sources.push(run.route.path);
        }
        existing.visible = existing.visible || link.visible;
        continue;
      }

      collected.set(link.abs, {
        raw: link.raw,
        abs: link.abs,
        text: link.text,
        visible: link.visible,
        sources: [run.route.path],
        status: null,
        chain: [],
        finalPath: "",
        ok: false,
        error: "",
      });
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: DESKTOP_UA,
    locale: "ru-RU",
  });
  await primeGuestContext(context);

  const page = await context.newPage();

  for (const check of collected.values()) {
    try {
      // Переход по `/#anchor` — это same-document навигация, при которой
      // Playwright не возвращает HTTP-ответ. Проверяем документ без хеша,
      // а хеш сохраняем в итоговом пути.
      const target = new URL(check.abs);
      const hash = target.hash;
      target.hash = "";

      const response = await page.goto(target.href, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await page
        .waitForLoadState("networkidle", { timeout: 8000 })
        .catch(() => {});
      await page.waitForTimeout(200);

      check.status = response ? response.status() : null;

      const chain = await readRedirectChain(response);
      check.chain = chain.map((hop) => `${hop.status ?? "?"} ${hop.url}`);

      try {
        const parsed = new URL(target.href);
        check.finalPath = `${parsed.pathname}${parsed.search}${hash}`;
      } catch {
        check.finalPath = target.href;
      }

      check.ok = Boolean(check.status && check.status < 400);
    } catch (error: any) {
      check.error = error?.message || String(error);
      check.ok = false;
    }
  }

  await context.close();

  return Array.from(collected.values());
}

/** Ссылки карточек категорий /forum проверяются реальным переходом. */
async function checkCategoryLinks(
  browser: any,
  runs: Run[],
): Promise<CategoryLink[]> {
  const collected = new Map<string, CategoryLink>();

  for (const run of runs) {
    if (run.route.path !== "/forum" || !run.forum) continue;

    for (const link of run.forum.links) {
      if (!link.href.startsWith("/forum/category/")) continue;
      if (collected.has(link.href)) continue;

      const abs = new URL(link.href, BASE_URL).href;

      collected.set(link.href, {
        href: link.href,
        abs,
        text: link.text,
        visible: link.visible,
        status: null,
        finalPath: "",
        ok: false,
        error: "",
      });
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: DESKTOP_UA,
    locale: "ru-RU",
  });
  await primeGuestContext(context);

  const page = await context.newPage();

  for (const check of collected.values()) {
    try {
      const response = await page.goto(check.abs, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await page
        .waitForLoadState("networkidle", { timeout: 8000 })
        .catch(() => {});
      await page.waitForTimeout(150);

      check.status = response ? response.status() : null;

      try {
        const parsed = new URL(page.url());
        check.finalPath = `${parsed.pathname}${parsed.search}`;
      } catch {
        check.finalPath = page.url();
      }

      check.ok = Boolean(check.status && check.status < 400);
    } catch (error: any) {
      check.error = error?.message || String(error);
      check.ok = false;
    }
  }

  await context.close();

  return Array.from(collected.values());
}


function consoleIssuesOf(run: Run, level: "error" | "warning"): ConsoleIssue[] {
  return run.console.filter(
    (issue) => issue.kind === "console" && issue.level === level,
  );
}

function pageErrorsOf(run: Run): ConsoleIssue[] {
  return run.console.filter((issue) => issue.kind === "pageerror");
}

function formatIssues(issues: ConsoleIssue[], limit: number): string {
  const shown = issues.slice(0, limit).map((issue) => {
    const place = issue.location ? ` (${shortText(issue.location, 120)})` : "";
    return `«${shortText(issue.text, 220)}»${place}`;
  });

  const tail =
    issues.length > shown.length
      ? `; ещё ${issues.length - shown.length}`
      : "";

  return `${issues.length} — ${shown.join("; ")}${tail}`;
}

function formatNetwork(issues: NetworkIssue[], limit: number): string {
  const seen = new Set<string>();
  const unique: NetworkIssue[] = [];

  for (const issue of issues) {
    const key = `${issue.status ?? "FAILED"}|${issue.url}|${issue.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(issue);
  }

  const shown = unique.slice(0, limit).map((issue) => {
    const status = issue.status == null ? "FAILED" : issue.status;
    return `${status} \`${shortText(issue.url, 180)}\` (${shortText(
      issue.detail,
      120,
    )})`;
  });

  const tail =
    unique.length > shown.length ? `; ещё ${unique.length - shown.length}` : "";

  return `${unique.length} — ${shown.join("; ")}${tail}`;
}

function describeStatus(run: Run): string {
  if (run.finalStatus == null) {
    return `ERR${run.gotoError ? " (навигация не удалась)" : ""}`;
  }

  if (run.firstStatus != null && run.firstStatus !== run.finalStatus) {
    return `${run.firstStatus} → ${run.finalStatus} (final: ${run.finalPath})`;
  }

  return String(run.finalStatus);
}

function describeHorizontal(run: Run): string {
  if (!run.metrics) return "нет данных";

  if (!run.metrics.hasHorizontalScroll) return "no";

  const culprit =
    run.metrics.overflow
      .slice(0, 3)
      .map(
        (item) =>
          `\`${item.selector}\` (scrollWidth ${item.scrollWidth} > ${item.clientWidth})`,
      )
      .join("; ") || "корневой документ";

  return `YES (+${run.metrics.overflowPx}px) — ${culprit}`;
}

function describeVisual(run: Run): string[] {
  if (!run.metrics) return [];

  const metrics = run.metrics;
  const lines: string[] = [];

  if (metrics.overflow.length) {
    lines.push(
      `scrollWidth > clientWidth: ${metrics.overflow
        .slice(0, 3)
        .map(
          (item) =>
            `\`${item.selector}\` (${item.scrollWidth} > ${item.clientWidth}, overflow-x: ${item.overflowX})`,
        )
        .join("; ")}`,
    );
  }

  if (metrics.outside.length) {
    lines.push(
      `за viewport: ${metrics.outside
        .slice(0, 3)
        .map(
          (item) =>
            `\`${item.selector}\` (right ${item.right} при ширине ${metrics.innerWidth})`,
        )
        .join("; ")}`,
    );
  }

  if (metrics.clipped.length) {
    lines.push(
      `возможный обрезанный текст: ${metrics.clipped
        .slice(0, 3)
        .map(
          (item) =>
            `\`${item.selector}\` «${shortText(item.text, 60)}» (${item.clientWidth} < ${item.scrollWidth}, overflow-x: ${item.overflowX})`,
        )
        .join("; ")}`,
    );
  }

  if (metrics.overlaps.length) {
    lines.push(
      `наложения в первом экране: ${metrics.overlaps
        .slice(0, 3)
        .map(
          (item) =>
            `\`${item.aSelector}\` «${shortText(item.aText, 40)}» и \`${item.bSelector}\` «${shortText(item.bText, 40)}»`,
        )
        .join("; ")}`,
    );
  }

  return lines;
}

function statusIsExpected(run: Run): boolean {
  if (run.finalStatus == null) return false;

  if (run.route.kind === "protected") {
    const redirected =
      run.firstStatus === 307 || run.firstStatus === 308 || run.firstStatus === 302;
    return (
      redirected &&
      run.finalStatus === 200 &&
      run.finalPath.startsWith("/auth/login")
    );
  }

  return run.finalStatus === 200;
}

type ReportMeta = {
  startedAt: Date;
  finishedAt: Date;
  browserVersion: string;
  playwrightVersion: string;
  nodeVersion: string;
};


function buildReport(
  runs: Run[],
  headerChecks: HeaderCheck[],
  categoryChecks: CategoryLink[],
  meta: ReportMeta,
): string {
  const lines: string[] = [];
  const push = (...items: string[]) => lines.push(...items);
  const consoleErrors = runs.filter(
    (run) => consoleIssuesOf(run, "error").length > 0,
  );
  const pageErrors = runs.filter((run) => pageErrorsOf(run).length > 0);
  const warnings = runs.filter(
    (run) => consoleIssuesOf(run, "warning").length > 0,
  );
  const warningCount = runs.reduce(
    (sum, run) => sum + consoleIssuesOf(run, "warning").length,
    0,
  );
  const networkRuns = runs.filter((run) => run.network.length > 0);
  const scrollRuns = runs.filter(
    (run) => run.metrics?.hasHorizontalScroll,
  );
  const badStatuses = runs.filter((run) => !statusIsExpected(run));
  const brokenHeader = headerChecks.filter((check) => !check.ok);
  const brokenCategories = categoryChecks.filter((check) => !check.ok);

  push(
    "# Аудит сайта TriDi",
    "",
    `- Дата: ${meta.startedAt.toLocaleString("ru-RU")} — ${meta.finishedAt.toLocaleString("ru-RU")}`,
    `- Базовый URL: ${BASE_URL}`,
    `- Браузер: Chromium ${meta.browserVersion} (системный Google Chrome), Playwright ${meta.playwrightVersion}, Node ${meta.nodeVersion}, headless`,
    "- Viewport: desktop 1440×900; mobile 390×844, UA мобильного Chrome, isMobile + touch",
    `- Всего проверок: ${runs.length} (${ROUTES.length} роутов × 2 вьюпорта)`,
    "- Все прогоны — гость. Закрытые страницы должны отдавать 307/308 и уводить на `/auth/login`.",
    "- Cookie-баннер скрыт через `localStorage` (`tridi-cookie-consent`), чтобы не перекрывать контент на скриншотах.",
    "- Скриншоты сохранены файлами в `audit-screenshots/`; в чат изображения не передавались.",
    "",
  );

  push("## Проверенные страницы", "");

  for (const route of ROUTES) {
    const routeRuns = runs.filter((run) => run.route.path === route.path);

    if (routeRuns.length === 0) continue;

    push(`## ${route.path}`, "");
    push(`*${route.label}* — ${authExpectation(route)}.`, "");

    for (const run of routeRuns) {
      const viewport =
        run.device === "desktop" ? "Desktop (1440×900)" : "Mobile (390×844)";
      const errors = consoleIssuesOf(run, "error");
      const warns = consoleIssuesOf(run, "warning");
      const pageErrs = pageErrorsOf(run);

      push(`### ${viewport}`);
      push(`- Status: ${describeStatus(run)}`);
      push(
        `- Console errors: ${errors.length ? formatIssues(errors, 3) : "0"}`,
      );
      push(
        `- Console warnings: ${
          warns.length ? formatIssues(warns, 2) : "0"
        }`,
      );
      push(
        `- Page errors: ${
          pageErrs.length ? formatIssues(pageErrs, 2) : "0"
        }`,
      );
      push(
        `- Failed requests: ${
          run.network.length ? formatNetwork(run.network, 3) : "0"
        }`,
      );
      push(`- Horizontal scroll: ${describeHorizontal(run)}`);
      push(
        `- Screenshot: ${run.screenshot || "не создан"}${
          run.screenshotError ? ` (ошибка: ${shortText(run.screenshotError, 200)})` : ""
        }`,
      );

      if (run.gotoError) {
        push(`- Navigation error: ${shortText(run.gotoError, 500)}`);
      }

      for (const visual of describeVisual(run)) {
        push(`- Visual: ${visual}`);
      }

      push("");
    }
  }


  push("## Ссылки в Header", "");

  if (headerChecks.length === 0) {
    push("Ссылки в `<header>` не найдены — это дефект.", "");
  } else {
    push(
      `Проверено уникальных ссылок: **${headerChecks.length}**, битых: **${brokenHeader.length}**.`,
      "",
      "| Источник | Текст | href | Видима | HTTP | Итоговый путь | Итог |",
      "| --- | --- | --- | --- | --- | --- | --- |",
    );

    for (const check of headerChecks) {
      const status =
        check.chain.length > 1
          ? `${check.chain[0].split(" ")[0]} → ${check.status ?? "ERR"}`
          : String(check.status ?? "ERR");
      const okLabel = check.ok
        ? check.finalPath.startsWith("/auth/login")
          ? "да (гость → вход)"
          : "да"
        : "**нет**";

      push(
        `| ${check.sources.map((item) => `\`${item}\``).join(", ")} | ${mdCell(
          check.text || "—",
        )} | \`${mdCell(check.raw)}\` | ${check.visible ? "да" : "нет"} | ${status} | \`${mdCell(
          check.finalPath,
        )}\` | ${okLabel} |`,
      );
    }

    if (brokenHeader.length) {
      push("", "**Битые ссылки Header:**", "");
      for (const check of brokenHeader) {
        push(
          `- \`${check.raw}\` (${check.text || "без текста"}): ${check.error || `HTTP ${check.status ?? "ERR"}`}`,
        );
      }
    }

    push("");
  }

  push("## Карточки категорий /forum", "");

  const forumRun = runs.find(
    (run) => run.route.path === "/forum" && run.device === "desktop",
  );

  if (!forumRun || !forumRun.forum) {
    push("Не удалось собрать карточки категорий.", "");
  } else {
    const articles = forumRun.forum.articles;
    const categoryArticles = articles.filter((article) => article.isLink);
    const unlinked = articles.filter((article) => !article.isLink);
    const uniqueHrefs = new Set(categoryChecks.map((check) => check.href)).size;
    const everyCategoryClickable =
      uniqueHrefs > 0 &&
      categoryArticles.length >= uniqueHrefs &&
      brokenCategories.length === 0;

    push(
      `- Всего карточек \`<article>\`: **${articles.length}**.`,
      `- Карточек категорий (внутри ссылки \`/forum/category/...\`): **${categoryArticles.length}**; уникальных категорий: **${uniqueHrefs}**.`,
      `- Каждая карточка категории кликабельна и ссылка рабочая: **${
        everyCategoryClickable ? "да" : "нет"
      }**.`,
      `- Битых ссылок категорий: **${brokenCategories.length}** из ${categoryChecks.length}.`,
      "",
    );

    if (unlinked.length) {
      push(
        `**\`<article>\` без ссылки на категорию (${unlinked.length})** — это пошаговые карточки и/или карточки тем, ссылка для них не требуется:`,
        "",
      );
      for (const article of unlinked.slice(0, 20)) {
        push(`- «${shortText(article.text, 120)}»`);
      }
      push("");
    }

    if (categoryChecks.length) {
      push(
        "| Категория | href | Видима | HTTP | Итог |",
        "| --- | --- | --- | ---: | --- |",
      );

      for (const check of categoryChecks) {
        push(
          `| ${mdCell(shortText(check.text, 90))} | \`${mdCell(check.href)}\` | ${check.visible ? "да" : "нет"} | ${check.status ?? "ERR"} | ${check.ok ? "да" : "**нет**"} |`,
        );
      }

      push("");
    }
  }


  push("## Каскадные селекты /profiles", "");

  const profileRun = runs.find(
    (run) => run.route.path === "/profiles" && run.device === "desktop",
  );

  if (!profileRun || !profileRun.profiles) {
    push("Не удалось проверить селекты.", "");
  } else {
    const profile = profileRun.profiles;

    push(
      "| Селект | В DOM | Видим | disabled (до выбора) | Опций |",
      "| --- | --- | --- | --- | ---: |",
    );

    for (const select of profile.selects) {
      push(
        `| ${mdCell(select.label || "без подписи")} | да | ${select.visible ? "да" : "нет"} | ${select.disabled ? "да" : "нет"} | ${select.options} |`,
      );
    }

    push("");

    const labels = profile.selects.map((select) => select.label);
    const hasAllLabels = ["Бренд", "Модель", "Материал"].every((label) =>
      labels.some((value) => value.includes(label)),
    );

    push(
      `- Все три подписи (Бренд / Модель / Материал) в DOM: **${hasAllLabels ? "да" : "нет"}**.`,
      `- «Модель» до выбора бренда disabled: **${profile.modelBefore?.disabled ? "да (каскад)" : "нет"}**; опций: ${profile.modelBefore?.options ?? 0}.`,
      `- После выбора «Bambu Lab»: «Модель» disabled: **${profile.modelAfter?.disabled ? "да" : "нет"}**, опций: ${profile.modelAfter?.options ?? 0}.`,
      `- Каскад работает: **${
        profile.modelBefore?.disabled && profile.modelAfter && !profile.modelAfter.disabled
          ? "да"
          : "нет"
      }**.${profile.cascadeError ? ` Ошибка взаимодействия: ${shortText(profile.cascadeError, 300)}` : ""}`,
      `- Disabled «Модели» по умолчанию — ожидаемое поведение каскада, а не дефект.`,
      "",
    );
  }

  push("## Кнопки «Купить» на страницах курсов", "");

  const buyRuns = runs.filter((run) => run.buy);

  if (buyRuns.length === 0) {
    push("Проверки не выполнялись.", "");
  } else {
    push(
      "Клик по кнопке выполнялся только один раз (гость, `/courses/confident` desktop), чтобы не создавать платёж.",
      "",
      "| Страница | Viewport | Найдено | Активных | Тег | href | Итог |",
      "| --- | --- | ---: | ---: | --- | --- | --- |",
    );

    for (const run of buyRuns) {
      const buttons = run.buy?.buttons ?? [];
      const enabled = buttons.filter((button) => button.ok).length;
      const tags = Array.from(new Set(buttons.map((button) => button.tag))).join(", ");
      const hrefs = Array.from(
        new Set(buttons.map((button) => button.href).filter(Boolean)),
      );
      const ok = buttons.length > 0 && enabled === buttons.length;

      push(
        `| \`${run.route.path}\` | ${run.device} | ${buttons.length} | ${enabled} | ${tags || "—"} | ${hrefs.length ? hrefs.map((href) => `\`${mdCell(href)}\``).join(", ") : "нет"} | ${ok ? "OK" : "**проблема**"} |`,
      );
    }

    push("");

    const confident = runs.find(
      (run) =>
        run.route.path === "/courses/confident" && run.device === "desktop",
    )?.buy;

    if (confident?.guestClick) {
      push(
        `- Гостевой клик на «Купить»: появился alert «${shortText(confident.guestClick.text, 200)}», ссылка входа: \`${confident.guestClick.href || "нет"}\`.`,
        `- Вывод: кнопка активна, платежа у гостя не создаёт, ведёт на вход — **OK**.`,
        "",
      );
    } else {
      push(
        `- Гостевой клик на «Купить»: ${confident?.guestClickError ? `ошибка — ${shortText(confident.guestClickError, 300)}` : "alert не появился"}.`,
        "",
      );
    }
  }


  push("## Визуальные расхождения", "");

  push("### Горизонтальный скролл", "");

  if (scrollRuns.length === 0) {
    push("Не обнаружен ни на одной странице и ни на одном viewport.", "");
  } else {
    for (const run of scrollRuns) {
      push(
        `- \`${run.route.path}\` (${run.device}): +${run.metrics?.overflowPx ?? 0}px — ${
          run.metrics?.overflow
            .slice(0, 4)
            .map((item) => `\`${item.selector}\` (${item.scrollWidth} > ${item.clientWidth})`)
            .join("; ") || "корневой документ"
        }`,
      );
    }
    push("");
  }

  push("### Прочие аномалии", "");

  const anomalyRuns = runs.filter((run) => {
    const metrics = run.metrics;
    if (!metrics) return false;

    return Boolean(
      metrics.overflow.length ||
        metrics.outside.length ||
        metrics.clipped.length ||
        metrics.overlaps.length,
    );
  });

  if (anomalyRuns.length === 0) {
    push("Элементов за пределами viewport, обрезанного текста и наложений не найдено.", "");
  } else {
    push(
      "Эвристика: `overflow` — у контейнера с `overflow-x: auto|scroll` контент шире клиентской области; `outside` — видимый элемент выходит за viewport; `clipped` — текст обрезан своим контейнером; `overlaps` — клик по кнопке/ссылке в первом экране перехватывает другой элемент.",
      "",
      "| Страница | Viewport | overflow | outside | clipped | overlaps |",
      "| --- | --- | ---: | ---: | ---: | ---: |",
    );

    for (const run of anomalyRuns) {
      const metrics = run.metrics!;

      push(
        `| \`${run.route.path}\` | ${run.device} | ${metrics.overflow.length} | ${metrics.outside.length} | ${metrics.clipped.length} | ${metrics.overlaps.length} |`,
      );
    }

    push("");
  }

  push("## Сводка", "");

  const totalErrors = consoleErrors.reduce(
    (sum, run) => sum + consoleIssuesOf(run, "error").length,
    0,
  );
  const totalPageErrors = pageErrors.reduce(
    (sum, run) => sum + pageErrorsOf(run).length,
    0,
  );
  const allNetwork = runs.reduce((sum, run) => sum + run.network.length, 0);

  push("### Статусы страниц", "");

  if (badStatuses.length === 0) {
    push(
      `- Все ${runs.length} прогонов соответствуют ожиданию: публичные — 200, закрытые — 307/308 → 200 на \`/auth/login\`.`,
      "",
    );
  } else {
    push(`- Отклонений: **${badStatuses.length}** из ${runs.length}.`, "");

    for (const run of badStatuses) {
      push(
        `- \`${run.route.path}\` (${run.device}): ${describeStatus(run)} — ожидалось ${
          run.route.kind === "protected" ? "307/308 → 200 `/auth/login`" : "200"
        }${run.gotoError ? `; ошибка: ${shortText(run.gotoError, 200)}` : ""}`,
      );
    }

    push("");
  }

  push("### Console", "");

  push(
    `- \`console.error\`: **${totalErrors}** сообщений в ${consoleErrors.length} прогонах.`,
    `- Необработанные исключения (pageerror): **${totalPageErrors}** в ${pageErrors.length} прогонах.`,
    `- \`console.warn\`: **${warningCount}** в ${warnings.length} прогонах.`,
    "",
  );

  if (consoleErrors.length) {
    push("**Ошибки:**", "");

    for (const run of consoleErrors) {
      push(
        `- \`${run.route.path}\` (${run.device}): ${formatIssues(
          consoleIssuesOf(run, "error"),
          3,
        )}`,
      );
    }

    push("");
  }

  if (pageErrors.length) {
    push("**Page errors:**", "");

    for (const run of pageErrors) {
      push(
        `- \`${run.route.path}\` (${run.device}): ${formatIssues(
          pageErrorsOf(run),
          3,
        )}`,
      );
    }

    push("");
  }

  if (warningCount > 0) {
    const warningMap = new Map<string, number>();

    for (const run of runs) {
      for (const warning of consoleIssuesOf(run, "warning")) {
        const key = shortText(warning.text, 220);
        warningMap.set(key, (warningMap.get(key) ?? 0) + 1);
      }
    }

    const topWarnings = Array.from(warningMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    push("**Уникальные предупреждения:**", "");

    for (const [text, count] of topWarnings) {
      push(`- ${count}× «${text}»`);
    }

    push("");
  }


  push("### Сеть", "");

  if (networkRuns.length === 0) {
    push("- Неуспешных запросов (HTTP ≥ 400 и requestfailed) нет.", "");
  } else {
    push(`- Всего записей: **${allNetwork}** в ${networkRuns.length} прогонах.`, "");

    for (const run of networkRuns) {
      push(
        `- \`${run.route.path}\` (${run.device}): ${formatNetwork(run.network, 4)}`,
      );
    }

    push("");
  }

  push("### Горизонтальный скролл", "");

  if (scrollRuns.length === 0) {
    push("- Горизонтального скролла нет ни на одной странице (desktop и mobile).", "");
  } else {
    push(`- Страниц со скроллом: **${scrollRuns.length}**.`, "");

    for (const run of scrollRuns) {
      push(
        `- \`${run.route.path}\` (${run.device}): +${run.metrics?.overflowPx ?? 0}px`,
      );
    }

    push("");
  }

  push("### Ссылки и элементы", "");

  const headerMissing = headerChecks.length === 0;
  const buyProblems = buyRuns.filter((run) => {
    const buttons = run.buy?.buttons ?? [];
    return buttons.length === 0 || buttons.some((button) => !button.ok);
  });
  const profileLabels = profileRun?.profiles?.selects.map((item) => item.label) ?? [];
  const profileLabelsOk = ["Бренд", "Модель", "Материал"].every((label) =>
    profileLabels.some((value) => value.includes(label)),
  );
  const cascadeOk = Boolean(
    profileRun?.profiles?.modelBefore?.disabled &&
      profileRun.profiles.modelAfter &&
      !profileRun.profiles.modelAfter.disabled,
  );
  const forumArticles = forumRun?.forum?.articles ?? [];
  const forumCategoryArticles = forumArticles.filter(
    (article) => article.isLink,
  ).length;
  const forumCategoryHrefs = new Set(
    categoryChecks.map((check) => check.href),
  ).size;
  const forumLinksOk =
    forumCategoryHrefs > 0 &&
    forumCategoryArticles >= forumCategoryHrefs &&
    brokenCategories.length === 0;
  const buyGuest = buyRuns.find(
    (run) => run.route.path === "/courses/confident" && run.device === "desktop",
  )?.buy;
  const buyGuestOk = Boolean(buyGuest?.guestClick);

  push(
    `- Header: ссылок ${headerChecks.length}, битых ${brokenHeader.length}${
      headerMissing ? " — **шапка пуста**" : ""
    }.`,
    `- Карточки категорий \`/forum\`: ${forumCategoryArticles} из ${forumCategoryHrefs} категорий, битых ссылок ${brokenCategories.length} — кликабельность: ${
      forumLinksOk ? "**да**" : "**нет**"
    }.`,
    `- Каскад \`/profiles\`: подписи Бренд/Модель/Материал — ${
      profileLabelsOk ? "**есть**" : "**нет**"
    }; переход disabled → enabled — ${cascadeOk ? "**работает**" : "**не работает**"}.`,
    `- «Купить»: проверено ${buyRuns.length} прогонов, проблемных ${buyProblems.length}.${
      buyProblems.length
        ? ` Страницы: ${buyProblems
            .map((run) => `\`${run.route.path}\` (${run.device})`)
            .join(", ")}.`
        : ""
    }`,
    `- Гостевой клик по «Купить»: ${
      buyGuestOk
        ? "alert с приглашением войти появился — **OK**"
        : `**проблема** — ${shortText(buyGuest?.guestClickError || "alert не появился", 200)}`
    }.`,
    "",
  );

  push("### Примечания", "");

  push(
    "- Аудит выполнялся на dev-сервере (`next dev`): часть запросов и предупреждений относится к режиму разработки.",
    "- Предупреждения React/Next и сообщения Supabase не являются падениями страницы; они перечислены отдельно от `console.error`.",
    "- Видимость элементов определяется по `display`, `visibility`, `opacity` и размерам; элементы мобильного меню в закрытом состоянии считаются скрытыми.",
    "- Скриншоты — fullPage PNG: desktop 1440×900, mobile 390×844 с DPR 3. Имена: `<slug>-<device>.png`.",
    "- Код сайта не изменялся; изменены только `scripts/audit-site.ts`, `audit-report.md` и папка `audit-screenshots/`.",
    "",
  );

  push("## Итог", "");

  const criticalCount =
    badStatuses.length +
    consoleErrors.length +
    pageErrors.length +
    brokenHeader.length +
    brokenCategories.length +
    buyProblems.length +
    (headerMissing ? 1 : 0) +
    (forumLinksOk ? 0 : 1) +
    (profileLabelsOk && cascadeOk ? 0 : 1) +
    (buyGuestOk ? 0 : 1);
  const verdict =
    criticalCount === 0
      ? scrollRuns.length === 0
        ? "Критических дефектов не найдено; горизонтального скролла нет. Сайт работает штатно на desktop и mobile."
        : "Критических дефектов не найдено, но есть горизонтальный скролл — см. раздел «Визуальные расхождения»."
      : `Найдено критических проблем: ${criticalCount}. Детали — в разделах выше.`;

  push(
    `- Критические проблемы (статусы, console/page errors, битые ссылки, отсутствующие элементы): **${criticalCount}**.`,
    `- Горизонтальный скролл: **${scrollRuns.length}** прогонов.`,
    `- Прогонов с прочими визуальными аномалиями: **${anomalyRuns.length}**.`,
    `- Предупреждений console.warn: **${warningCount}**.`,
    "",
    `**Вердикт:** ${verdict}`,
    "",
  );

  const report = `${lines.join("\n")}\n`;
  fs.writeFileSync(path.join(ROOT, "audit-report.md"), report, "utf8");

  return report;
}


function printConsoleSummary(
  runs: Run[],
  headerChecks: HeaderCheck[],
  categoryChecks: CategoryLink[],
  reportPath: string,
) {
  const badStatuses = runs.filter((run) => !statusIsExpected(run));
  const errors = runs.filter((run) => consoleIssuesOf(run, "error").length > 0);
  const pageErrors = runs.filter((run) => pageErrorsOf(run).length > 0);
  const scroll = runs.filter((run) => run.metrics?.hasHorizontalScroll);
  const brokenHeader = headerChecks.filter((check) => !check.ok);
  const brokenCategories = categoryChecks.filter((check) => !check.ok);
  const network = runs.filter((run) => run.network.length > 0);
  const warnings = runs.reduce(
    (sum, run) => sum + consoleIssuesOf(run, "warning").length,
    0,
  );

  console.log("\n=== Краткая сводка ===");
  console.log(`Прогонов: ${runs.length}`);
  console.log(`Статусы вне ожидания: ${badStatuses.length}`);
  console.log(`console.error (прогонов): ${errors.length}`);
  console.log(`pageerror (прогонов): ${pageErrors.length}`);
  console.log(`console.warn (сообщений): ${warnings}`);
  console.log(`Неуспешные запросы (прогонов): ${network.length}`);
  console.log(`Горизонтальный скролл (прогонов): ${scroll.length}`);
  console.log(
    `Header: ${headerChecks.length} ссылок, битых ${brokenHeader.length}`,
  );
  console.log(
    `Категории /forum: ${categoryChecks.length} ссылок, битых ${brokenCategories.length}`,
  );

  for (const run of badStatuses) {
    console.log(
      `  status: ${run.route.path} [${run.device}] — ${describeStatus(run)}`,
    );
  }

  for (const run of errors) {
    console.log(
      `  console.error: ${run.route.path} [${run.device}] — ${shortText(
        consoleIssuesOf(run, "error")[0]?.text ?? "",
        200,
      )}`,
    );
  }

  for (const run of scroll) {
    console.log(
      `  scroll: ${run.route.path} [${run.device}] +${run.metrics?.overflowPx ?? 0}px`,
    );
  }

  for (const check of brokenHeader) {
    console.log(
      `  header: ${check.raw} — ${check.error || `HTTP ${check.status ?? "ERR"}`}`,
    );
  }

  console.log(`\nОтчёт: ${reportPath}`);
  console.log(`Скриншоты: ${OUT_DIR}`);
}

async function main() {
  const startedAt = new Date();

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Аудит TriDi: ${BASE_URL}`);
  console.log(`Chrome: ${CHROME_PATH}`);
  console.log(
    `Роутов: ${ROUTES.length}, прогонов: ${ROUTES.length * DEVICES.length}`,
  );

  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(
      `Google Chrome не найден: ${CHROME_PATH}. Укажите путь через CHROME_PATH.`,
    );
  }

  const probe = await fetch(`${BASE_URL}/`, {
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  }).catch((error: any) => {
    throw new Error(
      `Dev-сервер недоступен на ${BASE_URL}: ${error?.message || error}. Запустите \`npm run dev\`.`,
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
  const runs: Run[] = [];
  const total = ROUTES.length * DEVICES.length;
  let index = 0;

  try {
    for (const route of ROUTES) {
      for (const device of DEVICES) {
        index += 1;

        const run = await auditRoute(browser, route, device);
        runs.push(run);

        console.log(
          `[${index}/${total}] ${route.path} (${device.name}) — ${describeStatus(
            run,
          )} · ${(run.durationMs / 1000).toFixed(1)}s · errors ${
            consoleIssuesOf(run, "error").length
          } · warns ${consoleIssuesOf(run, "warning").length}`,
        );
      }
    }

    console.log("\nПроверяю ссылки Header...");
    const headerChecks = await checkHeaderLinks(browser, runs);

    console.log("Проверяю ссылки категорий /forum...");
    const categoryChecks = await checkCategoryLinks(browser, runs);

    const finishedAt = new Date();
    const report = buildReport(runs, headerChecks, categoryChecks, {
      startedAt,
      finishedAt,
      browserVersion,
      playwrightVersion: require("playwright/package.json").version,
      nodeVersion: process.version,
    });

    if (!report.includes("## Сводка")) {
      throw new Error("Отчёт сформирован без секции «Сводка»");
    }

    printConsoleSummary(runs, headerChecks, categoryChecks, REPORT_PATH);
    console.log(
      `\nДлительность: ${((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)}s`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error: any) => {
  console.error("\nАудит завершился с ошибкой:");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
