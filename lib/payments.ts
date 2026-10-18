/**
 * Платежи Robokassa: ссылка на оплату и проверка подписи уведомления.
 *
 * Здесь нет клиентского кода: модуль использует `node:crypto` и секретные
 * пароли магазина. Вызывать его можно только из Server Action или Route Handler.
 *
 * Почему сумма не приходит из браузера: `initializePayment` сверяет её с
 * `data/courses.json`. Даже если подменить запрос к Server Action, заплатить
 * меньше цены тарифа или записать в `OutSum` другую сумму не получится.
 */
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import coursesData from "@/data/courses.json";

const ROBOKASSA_PAYMENT_URL = "https://auth.robokassa.ru/Merchant/Index.aspx";
const PAYMENT_DESCRIPTION = "Оплата курса TriDi";

/**
 * Все товары, которые можно оплатить. Цены — только из data/courses.json:
 * витрина, кнопки и серверная проверка читают один источник.
 */
export const PAYMENT_PLANS = {
  confident: {
    price: coursesData.confident.price,
    title: coursesData.confident.title,
  },
  engineer: {
    price: coursesData.engineer.price,
    title: coursesData.engineer.title,
  },
  profit: {
    price: coursesData.profit.price,
    title: coursesData.profit.title,
  },
  pro: {
    price: coursesData.pro.price,
    title: coursesData.pro.bundleTitle,
  },
  "pro-subscription": {
    price: coursesData.pro.subscriptionPrice,
    title: "Подписка Pro",
  },
} as const;

/** Ключ товара, который уходит в Robokassa как `Shp_course`. */
export type PaymentCourseId = keyof typeof PAYMENT_PLANS;

export type PaymentRequest = {
  /** Ключ курса, пакета или подписки. */
  courseId: PaymentCourseId;
  /** Сумма в рублях. Сервер сверяет её с ценой из data/courses.json. */
  amount: number;
  /** Email покупателя для чека; может отсутствовать. */
  userEmail: string | null;
  /** id пользователя Supabase — вернётся в вебхуке как `Shp_user`. */
  userId: string;
};

export type PaymentIntent = {
  /** Готовая ссылка на оплату Robokassa. */
  url: string;
  /** Уникальный номер заказа в магазине. */
  invId: number;
  courseId: PaymentCourseId;
  amount: number;
};

/** Проверяет, что строка из браузера — известный товар. */
export function isPaymentCourseId(value: string): value is PaymentCourseId {
  return Object.prototype.hasOwnProperty.call(PAYMENT_PLANS, value);
}

/** Цена товара в рублях. */
export function getPaymentAmount(courseId: PaymentCourseId): number {
  return PAYMENT_PLANS[courseId].price;
}

/** Сумма для Robokassa: строго два знака после точки. */
export function formatOutSum(amount: number): string {
  return amount.toFixed(2);
}

/** MD5 в нижнем регистре — формат подписи Robokassa. */
function md5(value: string): string {
  return createHash("md5").update(value, "utf8").digest("hex");
}

/**
 * Часть подписи из пользовательских параметров.
 *
 * Robokassa требует сортировать `Shp_*` по имени и добавлять их в строку
 * подписи в формате `:Shp_key=value`. Без этого подпись платёжной ссылки и
 * уведомления не сойдётся.
 */
export function buildShpSignaturePart(
  shp: Record<string, string>,
): string {
  return Object.keys(shp)
    .sort()
    .map((key) => `:Shp_${key}=${shp[key]}`)
    .join("");
}

/** Достаёт из параметров запроса только `Shp_*` и убирает префикс. */
export function extractShpParams(
  entries: Iterable<[string, string]>,
): Record<string, string> {
  const shp: Record<string, string> = {};

  for (const [key, value] of entries) {
    if (key.startsWith("Shp_")) {
      shp[key.slice("Shp_".length)] = value;
    }
  }

  return shp;
}

/**
 * Подпись уведомления ResultURL:
 * `MD5(OutSum:InvId:Пароль#2:Shp_*)`.
 *
 * `invId` принимаем строкой, потому что Robokassa присылает его текстом.
 */
export function buildResultSignature(
  outSum: string,
  invId: string,
  shp: Record<string, string>,
  password2: string,
): string {
  return md5(`${outSum}:${invId}:${password2}${buildShpSignaturePart(shp)}`);
}

/** Сравнивает подпись из вебхука с расчётной без утечки по времени. */
export function verifyResultSignature(
  outSum: string,
  invId: string,
  signatureValue: string,
  shp: Record<string, string>,
  password2: string,
): boolean {
  const expected = buildResultSignature(outSum, invId, shp, password2);
  const provided = signatureValue.trim().toLowerCase();

  if (!/^[0-9a-f]{32}$/.test(provided)) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(provided, "utf8"),
  );
}

/**
 * Уникальный InvId. Robokassa принимает целые числа до 2^63−1, поэтому
 * миллисекунды с трёхзначным случайным хвостом безопасны и не повторяются
 * при нескольких покупках в одну миллисекунду.
 */
let lastInvId = 0;

function nextInvId(): number {
  const candidate = Date.now() * 1000 + randomInt(0, 1000);

  lastInvId = Math.max(lastInvId + 1, candidate);

  return lastInvId;
}

/**
 * Тестовый режим включён по умолчанию: без явного `ROBOKASSA_IS_TEST=false`
 * сайт не начнёт списывать реальные деньги. На хостинге переменную нужно
 * выставить осознанно.
 */
function isTestMode(): boolean {
  const value = process.env.ROBOKASSA_IS_TEST?.trim().toLowerCase();

  return value !== "false" && value !== "0" && value !== "no";
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}`);
  }

  return value;
}

/** Пароль №2 нужен только вебхуку ResultURL. */
export function getRobokassaPassword2(): string {
  return requireEnv("ROBOKASSA_PASSWORD2");
}

/**
 * Собирает ссылку на оплату Robokassa.
 *
 * `amount` — сумма, которую уже проверил вызывающий код; здесь она ещё раз
 * сверяется с тарифом. `userEmail` не участвует в подписи и нужен только для
 * чека, а `userId` и `courseId` возвращаются вебхуком как `Shp_*`.
 */
export function initializePayment(request: PaymentRequest): PaymentIntent {
  const { courseId, amount, userEmail, userId } = request;

  if (!isPaymentCourseId(courseId)) {
    throw new Error("Неизвестный тариф");
  }

  const expectedAmount = getPaymentAmount(courseId);

  if (
    !Number.isFinite(amount) ||
    Math.round(amount * 100) !== expectedAmount * 100
  ) {
    throw new Error("Сумма платежа не совпадает с ценой тарифа");
  }

  if (!userId.trim()) {
    throw new Error("Не указан пользователь для оплаты");
  }

  const login = requireEnv("ROBOKASSA_LOGIN");
  const password1 = requireEnv("ROBOKASSA_PASSWORD1");

  const invId = nextInvId();
  const outSum = formatOutSum(expectedAmount);
  const shp = { course: courseId, user: userId };
  const signature = md5(
    `${login}:${outSum}:${invId}:${password1}${buildShpSignaturePart(shp)}`,
  );

  const url = new URL(ROBOKASSA_PAYMENT_URL);
  url.searchParams.set("MerchantLogin", login);
  url.searchParams.set("OutSum", outSum);
  url.searchParams.set("InvId", String(invId));
  url.searchParams.set("Description", PAYMENT_DESCRIPTION);
  url.searchParams.set("SignatureValue", signature);
  url.searchParams.set("Culture", "ru");
  url.searchParams.set("IsTest", isTestMode() ? "1" : "0");

  const email = userEmail?.trim();

  if (email) {
    url.searchParams.set("Email", email);
  }

  url.searchParams.set("Shp_course", shp.course);
  url.searchParams.set("Shp_user", shp.user);

  return {
    url: url.toString(),
    invId,
    courseId,
    amount: expectedAmount,
  };
}
