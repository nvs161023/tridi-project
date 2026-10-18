import { chromium } from "playwright";

const BASE_URL = "http://127.0.0.1:3129";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

const results = [];

function check(scope, name, ok, detail = "") {
  results.push({ scope, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${scope}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function normalize(text) {
  return text.replace(/\s+/g, " ").trim();
}

const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: "ru-RU",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(`console: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    const banner = page.getByRole("dialog", { name: "Согласие на использование cookie" });
    await banner.waitFor({ state: "visible" });
    check(viewport.name, "cookie-баннер показан при первом визите", true);
    check(
      viewport.name,
      "cookie-баннер содержит ссылки на cookie- и privacy-политики",
      (await banner.locator('a[href="/legal/cookies"]').count()) >= 1 &&
        (await banner.locator('a[href="/legal/privacy"]').count()) >= 1,
    );

    const footer = page.locator("footer").filter({ hasText: "Оплата через Robokassa" }).first();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(600);

    const footerText = normalize(await footer.innerText());
    check(
      viewport.name,
      "точная строка реквизитов в футере",
      footerText.includes("Самозанятый Накоряков Вадим Сергеевич, ИНН 531603515195"),
    );
    check(
      viewport.name,
      "фраза 18+ в футере",
      footerText.includes("Сервис предназначен для лиц старше 18 лет."),
    );

    const footerLinks = await footer.locator("a").evaluateAll((links) =>
      links.map((link) => ({ href: link.getAttribute("href"), text: link.textContent?.trim() })),
    );
    for (const href of ["/legal/offer", "/legal/privacy", "/legal/terms"]) {
      check(
        viewport.name,
        `кликабельная ссылка ${href} в футере`,
        footerLinks.some((link) => link.href === href),
      );
    }
    check(
      viewport.name,
      "телефон и email оформлены ссылками tel:/mailto:",
      footerLinks.some((link) => link.href?.startsWith("tel:")) &&
        footerLinks.some((link) => link.href?.startsWith("mailto:")),
    );

    const phone = footer.locator('a[href^="tel:"]').first();
    const phoneBox = await phone.boundingBox();
    const bannerBox = await banner.boundingBox();
    check(
      viewport.name,
      "cookie-баннер не перекрывает телефон продавца",
      Boolean(phoneBox && bannerBox && phoneBox.y + phoneBox.height <= bannerBox.y + 1),
      phoneBox && bannerBox
        ? `phone.bottom=${Math.round(phoneBox.y + phoneBox.height)}, banner.top=${Math.round(bannerBox.y)}`
        : "не удалось получить координаты",
    );

    const homeOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    check(viewport.name, "нет горизонтальной прокрутки на главной", !homeOverflow);

    await banner.getByRole("button", { name: "Принять все" }).click();
    await banner.waitFor({ state: "hidden" });
    await page.reload({ waitUntil: "networkidle" });
    check(
      viewport.name,
      "после принятия баннер не показывается повторно",
      (await page.getByRole("dialog", { name: "Согласие на использование cookie" }).count()) === 0,
    );

    await page.screenshot({
      path: `.next/audit-final-home-${viewport.name}.png`,
      fullPage: true,
    });

    await page.goto(`${BASE_URL}/legal/privacy`, { waitUntil: "networkidle" });
    const privacyText = normalize(await page.locator("main").innerText());
    check(
      viewport.name,
      "номер Роскомнадзора в политике",
      privacyText.includes(
        "Оператор персональных данных включен в реестр Роскомнадзора, регистрационный номер: 78-26-218690.",
      ),
    );
    for (const section of [
      "Цели обработки персональных данных",
      "Категории субъектов и перечень обрабатываемых данных",
      "Сроки хранения",
      "Права субъекта персональных данных",
      "Порядок отзыва согласия",
    ]) {
      check(viewport.name, `раздел политики: ${section}`, privacyText.includes(section));
    }
    check(viewport.name, "в политике указана Robokassa", privacyText.includes("Robokassa"));
    check(viewport.name, "в политике нет устаревшей ЮKassa", !privacyText.includes("ЮKassa"));
    check(
      viewport.name,
      "в политике перечислены email и IP-адрес",
      privacyText.includes("Адрес электронной почты") && privacyText.includes("IP-адрес"),
    );
    const privacyOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    check(viewport.name, "нет горизонтальной прокрутки в политике", !privacyOverflow);
    await page.screenshot({
      path: `.next/audit-final-privacy-${viewport.name}.png`,
      fullPage: false,
    });

    await page.goto(`${BASE_URL}/legal/offer`, { waitUntil: "networkidle" });
    const offerText = normalize(await page.locator("main").innerText());
    check(
      viewport.name,
      "оферта: возврат цифрового продукта в течение 7 дней",
      offerText.includes(
        "возврат за цифровой продукт надлежащего качества возможен в течение 7 дней с момента покупки (при условии, что доступ к платным урокам не был использован)",
      ),
    );
    check(
      viewport.name,
      "оферта: возврат Pro пропорционально полным дням",
      offerText.includes("Возврат осуществляется пропорционально неиспользованным полным дням подписки."),
    );
    check(
      viewport.name,
      "оферта: ссылки на privacy и terms в футере",
      (await footer.locator('a[href="/legal/privacy"]').count()) >= 1 &&
        (await footer.locator('a[href="/legal/terms"]').count()) >= 1,
    );

    await page.goto(`${BASE_URL}/auth/sign-up`, { waitUntil: "networkidle" });
    const consent = page.getByRole("checkbox", { name: /Я согласен на обработку персональных данных/ });
    const age = page.getByRole("checkbox", { name: /Мне исполнилось 18 лет/ });
    check(viewport.name, "чекбокс согласия найден", (await consent.count()) === 1);
    check(viewport.name, "чекбокс согласия не предустановлен", !(await consent.isChecked()));
    check(viewport.name, "чекбокс 18+ не предустановлен", !(await age.isChecked()));
    check(
      viewport.name,
      "в согласии есть прямая ссылка на /legal/privacy",
      (await page.locator('label[for="consent"] a[href="/legal/privacy"]').count()) === 1,
    );
    check(
      viewport.name,
      "кнопка регистрации заблокирована без обеих отметок",
      await page.getByRole("button", { name: /Зарегистрироваться/ }).isDisabled(),
    );

    for (const [path, label] of [
      ["/auth/login", "вход"],
      ["/auth/forgot-password", "восстановление пароля"],
      ["/auth/verify-email", "подтверждение email"],
    ]) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
      check(
        viewport.name,
        `ссылка на политику в форме: ${label}`,
        (await page.locator('form a[href="/legal/privacy"]').count()) >= 1,
      );
    }

    check(viewport.name, "нет ошибок в консоли браузера", errors.length === 0, errors.join(" | "));
    await context.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\nИтог: ${results.length - failed.length} из ${results.length} проверок пройдено.`);
if (failed.length > 0) {
  console.log("Провалы:");
  for (const result of failed) {
    console.log(`- [${result.scope}] ${result.name}: ${result.detail}`);
  }
  process.exitCode = 1;
}
