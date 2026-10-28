"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { deleteProduct } from "@/app/actions/products";
import { AddProductDialog } from "@/components/workshop/AddProductDialog";
import { ImportProductsDialog } from "@/components/workshop/ImportProductsDialog";
import {
  ProductsIcon,
  TrashIcon,
} from "@/components/workshop/WorkshopIcons";
import type { WorkshopProduct } from "@/lib/workshop/products";

/**
 * Вкладка «Товары».
 *
 * Каталог читается на сервере и приходит готовым массивом. После добавления
 * товара `addProduct` вызывает `revalidatePath`, страница обновляется, и
 * таблица перерисовывается — второй источник правды вкладке не нужен.
 *
 * Пока товаров нет, показывается пустое состояние с кнопкой. Когда каталог
 * заполнен, кнопка «Добавить товар» переезжает в шапку, а данные выводятся
 * таблицей в стиле склада: тёмная карточка, uppercase-заголовки и
 * `tabular-nums` для чисел. Кнопка «Импорт» остаётся в шапке при любом
 * каталоге и открывает окно загрузки CSV.
 */

type WorkshopProductsTabProps = {
  products: WorkshopProduct[];
};

/**
 * Площадки в меню «Экспорт».
 *
 * Список локальный, а не импорт из `lib/workshop/export.ts`: серверный сборщик
 * CSV и его константы не попадают в клиентский бандл. Порядок пунктов совпадает
 * с порядком площадок в `lib/workshop/export.ts`.
 */
const EXPORT_MENU_ITEMS = [
  { platform: "ozon", label: "Ozon" },
  { platform: "wb", label: "Wildberries" },
  { platform: "yandex", label: "Яндекс.Маркет" },
  { platform: "avito", label: "Авито" },
  { platform: "megamarket", label: "Мегамаркет" },
] as const;

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

/** Цена с разделителями разрядов: «1 500 ₽». */
function formatProductPrice(price: number): string {
  return `${priceFormatter.format(price)} ₽`;
}

/** Вес в граммах; незаполненное значение — прочерк. */
function formatProductWeight(weightG: number | null): string {
  return weightG === null ? "—" : integerFormatter.format(weightG);
}

/**
 * Габариты «Д×Ш×В».
 *
 * Незаполненное измерение остаётся прочерком: если указана только длина,
 * строка честно показывает, каких сторон нет.
 */
function formatProductDimensions(product: WorkshopProduct): string {
  const sides = [product.lengthMm, product.widthMm, product.heightMm];

  if (sides.every((side) => side === null)) {
    return "—";
  }

  return sides
    .map((side) => (side === null ? "—" : integerFormatter.format(side)))
    .join("×");
}

/** Ссылка на G-code, только если это http(s): старые данные тоже проверяем. */
function gcodeHref(url: string | null): string | null {
  return url && /^https?:\/\//iu.test(url) ? url : null;
}

export function WorkshopProductsTab({ products }: WorkshopProductsTabProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isExportMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !exportMenuRef.current?.contains(event.target)
      ) {
        setIsExportMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setIsExportMenuOpen(false);
      exportButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExportMenuOpen]);

  const openDialog = useCallback(() => setIsDialogOpen(true), []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    window.requestAnimationFrame(() => addButtonRef.current?.focus());
  }, []);

  const openImportDialog = useCallback(() => setIsImportDialogOpen(true), []);

  const closeImportDialog = useCallback(() => {
    setIsImportDialogOpen(false);
    window.requestAnimationFrame(() => importButtonRef.current?.focus());
  }, []);

  /**
   * Удаление товара.
   *
   * Подтверждение обязательно: вместе с товаром уходят связи маркетплейсов,
   * а в старых заказах позиция останется без product_id. Сами заказы и SKU
   * сохраняются, поэтому история не пропадает.
   */
  async function removeProduct(product: WorkshopProduct) {
    if (
      deletingId ||
      !window.confirm(
        `Удалить товар «${product.title}»? Связи SKU с маркетплейсами тоже удалятся, а в старых заказах позиция останется без товара.`,
      )
    ) {
      return;
    }

    setNotice(null);
    setError(null);
    setDeletingId(product.id);

    const result = await deleteProduct(product.id);

    setDeletingId(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    setNotice(result.message ?? "Товар удалён.");
    router.refresh();
  }

  return (
    <section
      aria-labelledby="workshop-products-title"
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-blue-300 uppercase">
            Каталог изделий
          </p>
          <h2
            id="workshop-products-title"
            className="mt-2 text-xl font-extrabold tracking-tight text-white"
          >
            Товары
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Готовые изделия с ценой и составом: добавьте товар один раз и
            подставляйте его в заказы.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            ref={importButtonRef}
            type="button"
            onClick={openImportDialog}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            Импорт
          </button>
          <div ref={exportMenuRef} className="relative">
            <button
              ref={exportButtonRef}
              type="button"
              aria-expanded={isExportMenuOpen}
              aria-controls="workshop-export-menu"
              onClick={() => setIsExportMenuOpen((open) => !open)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              Экспорт
              <svg
                aria-hidden="true"
                className={`h-3 w-3 transition-transform duration-200 ${
                  isExportMenuOpen ? "rotate-180" : ""
                }`}
                fill="none"
                focusable="false"
                viewBox="0 0 12 12"
              >
                <path
                  d="m2.5 4.5 3.5 3.5 3.5-3.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.4"
                />
              </svg>
            </button>

            {isExportMenuOpen ? (
              <div
                id="workshop-export-menu"
                className="absolute top-full right-0 z-30 mt-2 w-56 rounded-xl border border-white/10 bg-[#0a0a0a] p-1.5 shadow-2xl shadow-black/70"
              >
                <p className="px-2.5 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-zinc-500 uppercase">
                  Маркетплейс
                </p>
                <ul aria-label="Площадки для экспорта" className="space-y-0.5">
                  {EXPORT_MENU_ITEMS.map((item) => (
                    <li key={item.platform}>
                      <a
                        href={`/api/workshop/export?platform=${item.platform}`}
                        download={`tridi_export_${item.platform}.csv`}
                        onClick={() => setIsExportMenuOpen(false)}
                        className="block rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:bg-white/[0.07] focus-visible:outline-none"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          {products.length > 0 ? (
            <button
              ref={addButtonRef}
              type="button"
              onClick={openDialog}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              <span aria-hidden>+</span>
              Добавить товар
            </button>
          ) : null}
        </div>
      </div>

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
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-[#0a0a0a] px-5 py-12 text-center sm:py-16">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-blue-300 shadow-[0_18px_60px_-28px_rgba(59,130,246,0.7)]">
            <ProductsIcon className="h-8 w-8" />
          </span>
          <h3 className="mt-5 text-lg font-bold tracking-tight text-white">
            Каталог пока пуст
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
            У вас пока нет товаров. Добавьте первый товар, чтобы использовать
            его в заказах
          </p>
          <button
            ref={addButtonRef}
            type="button"
            onClick={openDialog}
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-black shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-colors hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            <span aria-hidden className="text-lg leading-none">
              +
            </span>
            Добавить товар
          </button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs font-semibold text-zinc-500">
            Товаров: {products.length}
          </p>
          <ProductsTable
            products={products}
            deletingId={deletingId}
            onDelete={removeProduct}
          />
        </>
      )}

      {isDialogOpen ? <AddProductDialog onClose={closeDialog} /> : null}
      {isImportDialogOpen ? (
        <ImportProductsDialog onClose={closeImportDialog} />
      ) : null}
    </section>
  );
}

/** Таблица каталога в стиле склада: тёмная карточка и компактные строки. */
function ProductsTable({
  products,
  deletingId,
  onDelete,
}: {
  products: WorkshopProduct[];
  deletingId: string | null;
  onDelete: (product: WorkshopProduct) => void;
}) {
  return (
    <div
      data-products-table
      className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0a]"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">
            Товары: артикул, название, цена, вес, габариты и ссылка на G-code
          </caption>
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02] text-left text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">
              <th scope="col" className="px-3 py-3">
                Артикул
              </th>
              <th scope="col" className="px-3 py-3">
                Название
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Цена (₽)
              </th>
              <th scope="col" className="px-3 py-3 text-right">
                Вес (г)
              </th>
              <th scope="col" className="px-3 py-3">
                Габариты
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
            {products.map((product) => {
              const href = gcodeHref(product.gcodeUrl);
              const isDeleting = deletingId === product.id;

              return (
                <tr
                  key={product.id}
                  className="border-b border-white/5 align-top last:border-b-0"
                >
                  <td className="px-3 py-4 font-mono text-xs font-semibold whitespace-nowrap text-blue-200">
                    {product.sku}
                  </td>
                  <td className="px-3 py-4 font-semibold text-white">
                    {product.title}
                  </td>
                  <td className="px-3 py-4 text-right font-semibold whitespace-nowrap tabular-nums text-white">
                    {formatProductPrice(product.price)}
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums text-zinc-300">
                    {formatProductWeight(product.weightG)}
                  </td>
                  <td
                    title="Длина × ширина × высота, мм"
                    className="px-3 py-4 whitespace-nowrap tabular-nums text-zinc-300"
                  >
                    {formatProductDimensions(product)}
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
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(product)}
                      disabled={isDeleting}
                      aria-label={`Удалить товар «${product.title}»`}
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
