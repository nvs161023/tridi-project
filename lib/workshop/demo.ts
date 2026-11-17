/**
 * Демо-доступ к Мастерской.
 *
 * Зачем: витрина `/tools/workshop` продаёт CRM, но до оплаты её никто не видел.
 * Демо-аккаунт показывает настоящую мастерскую с настоящими таблицами — те же
 * вкладки, тот же калькулятор, тот же агент печати. Отличие одно: данные в нём
 * нельзя менять. Посетитель витрины нажимает «Открыть демо», попадает внутрь и
 * щёлкает по вкладкам, а при попытке сохранить получает честный текст
 * `DEMO_READ_ONLY` вместо тихой ошибки базы.
 *
 * Как узнаём демо-аккаунт:
 *   1. основной признак — `user_metadata.is_demo = true`: его ставит
 *      scripts/seed-demo-workshop.ts при создании аккаунта;
 *   2. запасной — совпадение почты с `DEMO_WORKSHOP_EMAIL`. Он нужен, если
 *      метаданные потерялись: почта демо-аккаунта всё равно известна.
 *
 * Почему это безопасно: ни одно действие мастерской не выполняется для демо —
 * проверка стоит в каждой Server Action и в API-роутах сразу после проверки
 * подписки. Навигация демо-сессии в lib/supabase/middleware.ts тоже ограничена
 * мастерской и витриной, чтобы демо-вход не открывал кабинет, форум и генератор.
 *
 * Модуль должен оставаться без Node-зависимостей: его импортирует middleware,
 * который работает в edge-среде.
 */

/** Витрина и мастерская — единственные разделы, открытые демо-сессии. */
export const DEMO_WORKSHOP_PATH = "/dashboard/workshop";

/**
 * Приватные разделы, куда демо-сессия не должна попадать.
 *
 * Демо-аккаунт — не полноценный аккаунт: у него нет покупок и кредитов, но
 * форум и генератор всё равно приняли бы запросы. Поэтому из демо ведём назад в
 * мастерскую, а не показываем кабинет, конструктор или создание темы.
 * Публичные страницы (главная, курсы, тарифы, витрина) остаются доступными:
 * демо-гость может смотреть сайт как обычный посетитель.
 */
const DEMO_BLOCKED_PREFIXES = [
  "/dashboard",
  "/forum/new",
  "/my-models",
  "/3d-generator",
  "/constructor",
  "/course",
  "/certificate",
  "/admin",
  "/profiles",
  "/start",
  "/activate",
  "/verify",
];

/** Куда демо-сессии нельзя: всё приватное, кроме самой мастерской. */
export function isDemoBlockedPath(pathname: string): boolean {
  if (
    pathname === DEMO_WORKSHOP_PATH ||
    pathname.startsWith(DEMO_WORKSHOP_PATH + "/")
  ) {
    return false;
  }

  return DEMO_BLOCKED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

/** Ошибка записи для демо-аккаунта: одна формулировка на весь продукт. */
export const DEMO_READ_ONLY =
  "В демо-мастерской нельзя сохранять изменения: здесь только пример данных. Оформите подписку Pro, чтобы вести свои заказы, склад и принтеры.";

/** Почта демо-аккаунта; переопределяется переменной окружения. */
export function demoWorkshopEmail(): string {
  const fromEnv = process.env.DEMO_WORKSHOP_EMAIL;

  return (fromEnv && fromEnv.trim() ? fromEnv : "demo@tridi-print.ru")
    .trim()
    .toLowerCase();
}

/** Совпадает ли почта с демо-аккаунтом. */
export function isDemoEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === demoWorkshopEmail();
}

type DemoIdentity = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null;

/**
 * Демо-пользователь: метаданные `is_demo` или почта демо-аккаунта.
 * Подходит и `User` из Supabase, и `RequestUser` из middleware.
 */
export function isDemoAccount(user: DemoIdentity | undefined): boolean {
  if (!user) {
    return false;
  }

  if (user.user_metadata?.is_demo === true) {
    return true;
  }

  return isDemoEmail(user.email);
}
