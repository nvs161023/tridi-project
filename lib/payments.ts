/**
 * Платежи Robokassa: ссылка на оплату и проверка подписи уведомления.
 *
 * Здесь нет клиентского кода: модуль использует `node:crypto` и секретные
 * пароли магазина. Вызывать его можно только из Server Action или Route Handler.
 *
 * Почему сумма не приходит из браузера: `initializePayment` сверяет её с
 * `data/courses.json`. Даже если подменить запрос к Server Action, заплатить
 * меньше цены тарифа или записать в `OutSum` другую сумму не получится.
 *
 * Магазин в Robokassa активирован, поэтому ссылка всегда уходит с чеком для ФНС
 * (`Receipt`, 54-ФЗ). Признак `Recurring` для подписки Pro добавляется только
 * при `ROBOKASSA_RECURRING=true`: пока в оферте написано «без автопродления»,
 * по умолчанию флаг выключен.
 */
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import coursesData from "@/data/courses.json";

const ROBOKASSA_PAYMENT_URL = "https://auth.robokassa.ru/Merchant/Index.aspx";
const PAYMENT_DESCRIPTION = "Оплата курса TriDi";

/**
 * Срок подписки Pro. Первый платёж `pro-subscription` открывает инструменты на
 * 30 дней, каждый следующий (в том числе автопродление) добавляет ещё 30.
 * Здесь константа, чтобы ссылка и вебхук считали одинаково.
 */
export const SUBSCRIPTION_PERIOD_DAYS = 30;

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

/**
 * Позиция чека в формате Robokassa (54-ФЗ).
 *
 * `sum` — полная сумма за позицию, а не цена за штуку: у нас всегда одна штука,
 * поэтому эти значения совпадают. `tax` по требованиям Robokassa обязателен:
 * владелец магазина — самозанятый (НПД), поэтому чек идёт без НДС.
 */
export type ReceiptItem = {
  /** Название курса или подписки, до 128 символов. */
  name: string;
  quantity: number;
  sum: number;
  payment_method: "full_payment";
  payment_object: "service";
  tax: "none";
};

/** Чек для ФНС: состав корзины, который уходит в параметре `Receipt`. */
export type Receipt = {
  items: ReceiptItem[];
};

/**
 * Состав корзины для чека: один товар — один курс или подписка.
 *
 * Сумма берётся из тарифа, а не из запроса. Поэтому чек всегда совпадает с
 * `OutSum`, иначе Robokassa отклонит платёж.
 */
export function buildReceipt(
  courseId: PaymentCourseId,
  amount: number,
): Receipt {
  return {
    items: [
      {
        name: PAYMENT_PLANS[courseId].title,
        quantity: 1,
        sum: amount,
        payment_method: "full_payment",
        payment_object: "service",
        tax: "none",
      },
    ],
  };
}

/**
 * `Receipt` в том виде, в каком он уходит в ссылку и входит в подпись.
 *
 * Robokassa принимает чек как URL-кодированный JSON и проверяет подпись по
 * переданному значению. Кодируем как PHP `urlencode`, то есть пробел — «+»:
 * ровно такой пример в документации Robokassa и в готовых интеграциях, а
 * `encodeURIComponent` оставил бы «%20». В названиях курсов пробелы есть,
 * поэтому разница была бы заметной.
 */
function encodeReceiptParam(receipt: Receipt): string {
  return encodeURIComponent(JSON.stringify(receipt)).replace(/%20/g, "+");
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

/**
 * Включено ли автопродление подписки Pro.
 *
 * `Recurring=true` в ссылке означает согласие на повторные списания, а оферта
 * (разделы 4 и 6) обещает обратное. Поэтому флаг включается только явно —
 * `ROBOKASSA_RECURRING=true`, — когда тексты документов и отмена подписки
 * в кабинете уже готовы. Любое другое значение, включая отсутствие переменной,
 * оставляет ручное продление.
 */
function isRecurringEnabled(): boolean {
  return process.env.ROBOKASSA_RECURRING?.trim().toLowerCase() === "true";
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
 *
 * Чек обязателен: без `Receipt` Robokassa не сформирует чек для ФНС и часть
 * способов оплаты просто не покажет. Для подписки Pro добавляется
 * `Recurring=true`, но только при `ROBOKASSA_RECURRING=true` (см.
 * `isRecurringEnabled`): по умолчанию продление остаётся ручным.
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

  // Robokassa принимает Receipt только в URL-кодированном виде и подписывает
  // ровно это значение: MD5(MerchantLogin:OutSum:InvId:Receipt:Пароль#1).
  // Кодируем один раз и используем одну строку и в подписи, и в ссылке.
  const receiptParam = encodeReceiptParam(
    buildReceipt(courseId, expectedAmount),
  );

  const signature = md5(
    `${login}:${outSum}:${invId}:${receiptParam}:${password1}${buildShpSignaturePart(shp)}`,
  );

  const params = new URLSearchParams();
  params.set("MerchantLogin", login);
  params.set("OutSum", outSum);
  params.set("InvId", String(invId));
  params.set("Description", PAYMENT_DESCRIPTION);
  params.set("SignatureValue", signature);
  params.set("Culture", "ru");
  params.set("IsTest", isTestMode() ? "1" : "0");

  const email = userEmail?.trim();

  if (email) {
    params.set("Email", email);
  }

  // Автопродление: Robokassa запоминает платёж и разрешает повторные списания.
  // Параметр в подпись не входит — она считается только с Receipt и Shp_*.
  // Выключено по умолчанию: оферта обещает ручное продление, пока нет отмены
  // подписки в кабинете (см. isRecurringEnabled).
  if (courseId === "pro-subscription" && isRecurringEnabled()) {
    params.set("Recurring", "true");
  }

  params.set("Shp_course", shp.course);
  params.set("Shp_user", shp.user);

  // Receipt дописываем руками: значение уже закодировано и подписано в таком
  // виде. URLSearchParams закодировал бы «%» второй раз, и подпись не сошлась
  // бы с той, которую проверяет Robokassa.
  const url = `${ROBOKASSA_PAYMENT_URL}?${params.toString()}&Receipt=${receiptParam}`;

  return {
    url,
    invId,
    courseId,
    amount: expectedAmount,
  };
}
