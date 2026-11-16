/**
 * Типы моделей Конструктора и их подписи.
 *
 * Отдельный файл, а не `params.ts`: названия моделей нужны витринам — `/pricing`
 * перечисляет их в составе подписки Pro, `/tools` — в списке генераторов. Сам
 * `params.ts` импортирует `qr-card-geometry.ts` с three.js, и публичной странице
 * тарифов незачем тянуть движок геометрии ради десяти строк.
 *
 * Порядок совпадает с вкладками панели параметров. `params.ts` реэкспортирует
 * эти константы, поэтому панель, API и проверочные скрипты импортируют их по
 * прежнему адресу.
 */

/** Типы моделей, которые умеет собирать конструктор. */
export const MODEL_TYPES = [
  "vase",
  "keychain",
  "sign",
  "box",
  "lithophane",
  "planter",
  "coaster",
  "jewelry_stand",
  "pen_holder",
  "heat_transfer",
] as const;

export type ModelType = (typeof MODEL_TYPES)[number];

/** Подписи моделей для вкладок панели параметров и витрин. */
export const MODEL_TYPE_LABELS = {
  vase: "Ваза",
  keychain: "Брелок",
  sign: "Вывеска",
  box: "Коробки",
  lithophane: "Литофан",
  planter: "Кашпо",
  coaster: "Подставка под кружку",
  jewelry_stand: "Подставка для украшений",
  pen_holder: "Органайзер для ручек",
  heat_transfer: "Термопринт",
} as const satisfies Record<ModelType, string>;
