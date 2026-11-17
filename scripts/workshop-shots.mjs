/**
 * Скриншоты демо-мастерской для витрины /tools/workshop.
 *
 * Зачем: гость должен увидеть настоящую CRM, а не нарисованный макет. Скрипт
 * заходит в демо через `/api/demo/workshop` (та же кнопка, что на витрине),
 * открывает каждую вкладку и кладёт JPEG в public/workshop. Витрина выводит эти
 * файлы в блоке «Посмотрите мастерскую до оплаты», подпись честно говорит, что
 * данные демонстрационные.
 *
 * Запуск:
 *   1. npm run seed:demo — создать демо-аккаунт и данные;
 *   2. npm run build && npm run start — поднять production-сборку;
 *   3. npm run shots:workshop
 *
 * Адрес сервера можно переопределить: SHOTS_BASE_URL=http://localhost:3100.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "workshop");
const BASE_URL = (process.env.SHOTS_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Вкладки мастерской: имя кнопки в навигации и имя файла. */
const SHOTS = [
  { file: "orders.jpg", tab: null },
  { file: "stock.jpg", tab: "Склад" },
  { file: "printers.jpg", tab: "Принтеры" },
  { file: "clients.jpg", tab: "Клиенты" },
  { file: "calculator.jpg", tab: "Калькулятор" },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1150 },
    deviceScaleFactor: 1.5,
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    reducedMotion: "reduce",
    colorScheme: "dark",
  });

  // Баннер cookie и тур по мастерской в кадр не нужны: отмечаем выбор «только
  // необходимые» и «тур пройден». Тур открывается сам при первом входе — без
  // этого флага он закрывает все вкладки модальным окном.
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem(
        "tridi-cookie-consent",
        JSON.stringify({ scope: "necessary", at: new Date().toISOString() }),
      );
      window.localStorage.setItem("workshop_onboarding_seen", "true");
      window.localStorage.setItem("workshop_full_tour_seen", "true");
    } catch {
      // Приватный режим без localStorage — баннер просто останется в кадре.
    }
  });

  const page = await context.newPage();

  try {
    // Вход через публичную дверь демо: она же обновляет last_seen_at у
    // принтеров, поэтому ферма на снимке выглядит живой.
    await page.goto(BASE_URL + "/api/demo/workshop", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForURL(/\/dashboard\/workshop/, { timeout: 60000 });

    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);

    // Страховка: если тур всё же открылся, закрываем его до съёмки.
    if ((await page.getByRole("dialog").count()) > 0) {
      const closeTour = page.getByRole("button", { name: "Закрыть тур" });

      if ((await closeTour.count()) > 0) {
        await closeTour.first().click().catch(() => {});
      } else {
        await page.keyboard.press("Escape");
      }

      await page.waitForTimeout(500);
    }

    for (const shot of SHOTS) {
      if (shot.tab) {
        await page.getByRole("tab", { name: shot.tab }).click();
        await page.waitForTimeout(700);
      }

      // Кадр — рабочая область вкладки, а не шапка: на витрине нужен сам
      // интерфейс (канбан, таблица склада, карточки принтеров). Панель
      // прокручиваем к верху окна, оставляя 80 px на липкую навигацию.
      await page.evaluate(() => {
        const panel = document.querySelector(
          '[role="tabpanel"]:not([hidden])',
        );

        if (panel) {
          const top = panel.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: "instant" });
        }
      });
      await page.waitForTimeout(250);

      const target = path.join(OUT_DIR, shot.file);
      await page.screenshot({ path: target, type: "jpeg", quality: 88 });

      const size = Math.round(fs.statSync(target).size / 1024);
      console.log("  " + shot.file + " — " + size + " КБ");
    }

    console.log("Скриншоты готовы: " + path.relative(ROOT, OUT_DIR));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(
    "Скриншоты не сделаны:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
