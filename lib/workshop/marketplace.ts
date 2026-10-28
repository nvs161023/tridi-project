/**
 * Маркетплейсы Мастерской: типы связей SKU и заказов без маппинга.
 *
 * Файл импортируют клиентские компоненты, поэтому здесь нет ни Supabase, ни
 * серверных действий — только словари, типы и проверки формы.
 */
import {
  MARKETPLACES,
  type Marketplace,
} from "@/lib/db/workshop-types";

export { MARKETPLACES };
export type { Marketplace };

/** Подписи площадок и цвета бейджей: классы статические, Tailwind их видит. */
export const MARKETPLACE_META: Record<
  Marketplace,
  { label: string; shortLabel: string; badgeClassName: string }
> = {
  ozon: {
    label: "Ozon",
    shortLabel: "OZ",
    badgeClassName: "border-blue-400/40 bg-blue-500/15 text-blue-100",
  },
  wb: {
    label: "Wildberries",
    shortLabel: "WB",
    badgeClassName: "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100",
  },
  yandex: {
    label: "Яндекс Маркет",
    shortLabel: "ЯМ",
    badgeClassName: "border-amber-400/40 bg-amber-500/15 text-amber-100",
  },
};

/** Связь «SKU площадки → товар каталога». */
export type MarketplaceLink = {
  id: string;
  marketplace: Marketplace;
  sku: string;
  productId: string;
  createdAt: string | null;
};

/** Связь вместе с товаром: страница собирает её из двух таблиц. */
export type MarketplaceLinkView = MarketplaceLink & {
  productTitle: string;
  productSku: string;
  gcodeUrl: string | null;
};

/** Позиция заказа, которую не удалось связать с товаром. */
export type UnmappedOrderItem = {
  id: string;
  sku: string | null;
  quantity: number;
};

/**
 * Заказ со статусом unmapped.
 *
 * `source` — площадка, на которой искать SKU: связь Ozon не подходит заказу
 * Wildberries, даже если артикул совпал.
 */
export type UnmappedOrder = {
  id: string;
  title: string;
  source: Marketplace;
  marketplaceOrderId: string | null;
  clientName: string | null;
  createdAt: string | null;
  items: UnmappedOrderItem[];
};

/** Ответ Server Action связи. */
export type MarketplaceActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

/** Пределы полей — как у check-ограничений workshop_marketplace_links. */
export const MARKETPLACE_LINK_LIMITS = {
  sku: 128,
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Идентификатор связи: мусор отсекаем до запроса к PostgREST. */
export function isMarketplaceLinkId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Текст для интерфейса: пробелы по краям не считаются содержимым. */
export function formatMarketplaceSku(sku: string | null): string {
  return sku ?? "Без артикула";
}
