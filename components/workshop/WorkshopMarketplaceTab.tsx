"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import {
  addMarketplaceLink,
  deleteMarketplaceLink,
} from "@/app/actions/marketplace";
import { useDialogDismiss } from "@/components/workshop/use-dialog-dismiss";
import {
  PlugIcon,
  TrashIcon,
} from "@/components/workshop/WorkshopIcons";
import type { WorkshopProduct } from "@/lib/workshop/products";
import {
  MARKETPLACES,
  MARKETPLACE_META,
  formatMarketplaceSku,
  type Marketplace,
  type MarketplaceLinkView,
  type UnmappedOrder,
} from "@/lib/workshop/marketplace";

/**
 * Страница «Маркетплейсы»: связи SKU → товар и заказы, которые ждут маппинга.
 *
 * Связь добавляется одной формой: площадка, SKU и товар. Кнопка «Связать» у
 * заказа открывает ту же форму с заполненными площадкой и SKU. После успеха
 * Server Action пересчитывает unmapped-заказы: если все позиции нашли товар,
 * заказ возвращается в колонку «Новые».
 */

type WorkshopMarketplaceTabProps = {
  links: MarketplaceLinkView[];
  products: WorkshopProduct[];
  unmappedOrders: UnmappedOrder[];
  isMissingTable: boolean;
};

type DialogInitial = {
  marketplace?: Marketplace;
  sku?: string;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none transition-all duration-200 placeholder:text-zinc-500 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30 focus:ring-inset";

const labelClassName = "block text-sm font-semibold text-slate-200";

export function WorkshopMarketplaceTab({
  links,
  products,
  unmappedOrders,
  isMissingTable,
}: WorkshopMarketplaceTabProps) {
  const router = useRouter();
  const [dialogInitial, setDialogInitial] = useState<DialogInitial | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openDialog = useCallback((initial: DialogInitial = {}) => {
    setNotice(null);
    setError(null);
    setDialogInitial(initial);
  }, []);

  const closeDialog = useCallback(() => setDialogInitial(null), []);

  function handleSaved(message: string) {
    setDialogInitial(null);
    setNotice(message);
    router.refresh();
  }

  async function removeLink(link: MarketplaceLinkView) {
    if (
      deletingId ||
      !window.confirm(
        `Удалить связь SKU «${link.sku}» с товаром «${link.productTitle}»? Будущие заказы с этим артикулом снова потребуют маппинга.`,
      )
    ) {
      return;
    }

    setNotice(null);
    setError(null);
    setDeletingId(link.id);

    const result = await deleteMarketplaceLink(link.id);

    setDeletingId(null);

    if (!result.ok) {
      setError(result.error ?? "Не удалось удалить связь.");
      return;
    }

    setNotice(result.message ?? "Связь удалена.");
    router.refresh();
  }

  return (
    <section
      aria-labelledby="workshop-marketplace-title"
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
            SKU маркетплейсов
          </p>
          <h2
            id="workshop-marketplace-title"
            className="mt-2 text-xl font-extrabold tracking-tight text-white"
          >
            Маркетплейсы
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Свяжите артикул площадки с товаром каталога. По этой связи заказ
            находит G-code и уходит в очередь печати без ручного разбора.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openDialog()}
          disabled={products.length === 0}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden>+</span>
          Добавить связь
        </button>
      </div>

      {isMissingTable ? (
        <p className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
          Таблицы этапа 1 ещё не созданы. Примените
          supabase/workshop_farm_and_shop.sql — после этого связи и заказы
          появятся здесь.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-100"
        >
          {notice}
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-relaxed text-zinc-400">
          Сначала добавьте товар в каталог: связывать SKU пока не с чем.
        </p>
      ) : null}

      {unmappedOrders.length > 0 ? (
        <AttentionBlock
          orders={unmappedOrders}
          onLink={(order, sku) =>
            openDialog({ marketplace: order.source, sku: sku ?? "" })
          }
        />
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-white">
          Связи SKU → товар
        </h3>
        <p className="text-xs font-semibold text-zinc-500">
          Всего связей: {links.length}
        </p>
      </div>

      {links.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-[#0a0a0a] px-5 py-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-blue-300">
            <PlugIcon className="h-7 w-7" />
          </span>
          <h3 className="mt-4 text-base font-bold text-white">
            Связей пока нет
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
            Добавьте первую связь: укажите площадку, SKU из кабинета продавца и
            товар, который печатается по этому артикулу.
          </p>
          <button
            type="button"
            onClick={() => openDialog()}
            disabled={products.length === 0}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden>+</span>
            Добавить связь
          </button>
        </div>
      ) : (
        <LinksTable
          links={links}
          deletingId={deletingId}
          onDelete={(link) => void removeLink(link)}
        />
      )}

      {dialogInitial ? (
        <LinkDialog
          products={products}
          initial={dialogInitial}
          onClose={closeDialog}
          onSaved={handleSaved}
        />
      ) : null}
    </section>
  );
}

/** Таблица связей: площадка, SKU, товар, наличие G-code и удаление. */
function LinksTable({
  links,
  deletingId,
  onDelete,
}: {
  links: MarketplaceLinkView[];
  deletingId: string | null;
  onDelete: (link: MarketplaceLinkView) => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0a]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">
            Связи артикулов маркетплейсов с товарами каталога
          </caption>
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02] text-left text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
              <th scope="col" className="px-3 py-3">
                Площадка
              </th>
              <th scope="col" className="px-3 py-3">
                SKU
              </th>
              <th scope="col" className="px-3 py-3">
                Товар
              </th>
              <th scope="col" className="px-3 py-3">
                G-code
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => {
              const meta = MARKETPLACE_META[link.marketplace];
              const href =
                link.gcodeUrl && /^https?:\/\//iu.test(link.gcodeUrl)
                  ? link.gcodeUrl
                  : null;
              const isDeleting = deletingId === link.id;

              return (
                <tr
                  key={link.id}
                  className="border-b border-white/5 align-top last:border-b-0"
                >
                  <td className="px-3 py-4">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${meta.badgeClassName}`}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-4 font-mono text-xs font-semibold whitespace-nowrap text-blue-200">
                    {link.sku}
                  </td>
                  <td className="px-3 py-4">
                    <p className="font-semibold text-white">
                      {link.productTitle}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                      {link.productSku}
                    </p>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-blue-300 underline decoration-blue-300/40 underline-offset-2 transition-colors hover:text-blue-200"
                      >
                        Открыть
                      </a>
                    ) : (
                      <span className="text-xs text-amber-200">Нет файла</span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(link)}
                      disabled={isDeleting}
                      aria-label={`Удалить связь SKU «${link.sku}»`}
                      aria-busy={isDeleting}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Заказы, которые не удалось разложить по товарам.
 *
 * Показываем каждую позицию отдельно: у одной могут найтись связи, а другая
 * остаться без артикула. Кнопка «Связать» открывает форму с площадкой заказа и
 * этим SKU — ошибиться площадкой уже нельзя.
 */
function AttentionBlock({
  orders,
  onLink,
}: {
  orders: UnmappedOrder[];
  onLink: (order: UnmappedOrder, sku: string | null) => void;
}) {
  return (
    <section
      aria-labelledby="workshop-unmapped-title"
      className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-500/[0.06] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-amber-300 uppercase">
            Нужен маппинг
          </p>
          <h3
            id="workshop-unmapped-title"
            className="mt-1 text-base font-extrabold text-amber-100"
          >
            Требуют внимания
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
            Заказ принят, но печатать его нельзя: хотя бы один SKU не связан с
            товаром.
          </p>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-100">
          Заказов: {orders.length}
        </span>
      </div>

      <ul className="mt-4 space-y-3">
        {orders.map((order) => {
          const meta = MARKETPLACE_META[order.source];

          return (
            <li
              key={order.id}
              className="rounded-xl border border-amber-400/15 bg-black/25 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${meta.badgeClassName}`}
                >
                  {meta.label}
                </span>
                <p className="text-sm font-bold text-white">{order.title}</p>
                {order.clientName ? (
                  <p className="text-xs text-zinc-400">{order.clientName}</p>
                ) : null}
              </div>

              {order.items.length === 0 ? (
                <p className="mt-3 text-xs text-amber-200/80">
                  В заказе нет позиций — проверьте уведомление площадки.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-white/5">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-amber-100">
                          {formatMarketplaceSku(item.sku)}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Количество: {item.quantity}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onLink(order, item.sku)}
                        disabled={!item.sku}
                        title={
                          item.sku
                            ? undefined
                            : "У позиции нет артикула — связать её автоматически нельзя"
                        }
                        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 text-xs font-bold text-amber-100 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Связать
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Форма связи SKU с товаром.
 *
 * Площадка и SKU могут быть предзаполнены из заказа. Товар выбирается только
 * из каталога мастерской: свободный uuid не даст связать чужую карточку.
 */
function LinkDialog({
  products,
  initial,
  onClose,
  onSaved,
}: {
  products: WorkshopProduct[];
  initial: DialogInitial;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDialogDismiss(onClose);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await addMarketplaceLink(formData);

      if (!result.ok) {
        setError(result.error ?? "Не удалось сохранить связь.");
        return;
      }

      onSaved(result.message ?? "Связь сохранена.");
    } catch {
      setError("Не удалось отправить форму. Попробуйте ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      data-marketplace-link-dialog-overlay
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketplace-link-title"
        data-marketplace-link-dialog
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl shadow-black/60 sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-blue-400 uppercase">
              Маркетплейсы
            </p>
            <h2
              id="marketplace-link-title"
              className="mt-2 text-xl font-extrabold tracking-tight text-white"
            >
              Связать SKU
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Заказы с этим артикулом будут находить товар и G-code.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно связи SKU"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg text-zinc-400 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="mt-6 space-y-4">
          <div>
            <label htmlFor="link-marketplace" className={labelClassName}>
              Площадка
            </label>
            <select
              id="link-marketplace"
              name="marketplace"
              defaultValue={initial.marketplace ?? "ozon"}
              className={inputClassName}
            >
              {MARKETPLACES.map((marketplace) => (
                <option key={marketplace} value={marketplace}>
                  {MARKETPLACE_META[marketplace].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="link-sku" className={labelClassName}>
              SKU площадки <span className="text-blue-300">*</span>
            </label>
            <input
              id="link-sku"
              name="sku"
              type="text"
              required
              maxLength={128}
              defaultValue={initial.sku ?? ""}
              placeholder="OZON-123456789"
              spellCheck={false}
              className={`${inputClassName} font-mono`}
            />
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Артикул из кабинета продавца — тот же, что приходит в уведомлении
              о заказе.
            </p>
          </div>

          <div>
            <label htmlFor="link-product" className={labelClassName}>
              Товар каталога <span className="text-blue-300">*</span>
            </label>
            <select
              id="link-product"
              name="productId"
              required
              defaultValue=""
              className={inputClassName}
            >
              <option value="" disabled>
                Выберите товар
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title} — {product.sku}
                  {product.gcodeUrl ? "" : " (без G-code)"}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p
              role="alert"
              data-marketplace-link-error
              className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm leading-relaxed text-red-100"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row">
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Сохранение..." : "Связать"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
