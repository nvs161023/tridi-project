"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { WorkshopCalculatorTab } from "@/components/workshop/WorkshopCalculatorTab";
import {
  CalculatorIcon,
  InventoryIcon,
  OrdersIcon,
  PrinterIcon,
  ProductsIcon,
} from "@/components/workshop/WorkshopIcons";
import { WorkshopOrdersTab } from "@/components/workshop/WorkshopOrdersTab";
import { WorkshopPrintersTab } from "@/components/workshop/WorkshopPrintersTab";
import { WorkshopStockTab } from "@/components/workshop/WorkshopStockTab";
import type { WorkshopFilament } from "@/lib/workshop/filaments";
import type { WorkshopOrder } from "@/lib/workshop/orders";
import type { WorkshopPrinter } from "@/lib/workshop/printers";
import type { WorkshopSettings } from "@/lib/workshop/settings";

/**
 * Рабочая область Мастерской: сайдбар на десктопе и сегментированные табы на
 * мобильном.
 *
 * Это один и тот же `role="tablist"`: на широком экране CSS разворачивает его
 * в вертикальную колонку слева, на узком — в горизонтальную ленту с прокруткой.
 * Дублировать кнопки для двух раскладок нельзя: у табов одинаковые id и
 * aria-controls, и скринридер получил бы два набора одного и того же.
 *
 * «Заказы», «Склад», «Принтеры» и «Калькулятор» сохраняют внутреннее
 * содержимое. «Товары» — новый раздел навигации: таблицы товаров в базе пока
 * нет, поэтому вкладка показывает честное пустое состояние.
 *
 * Активная вкладка получает `bg-white/10` и белый текст, неактивные остаются
 * серыми `text-zinc-400`. Стрелки клавиатуры переключают табы, у неактивных
 * `tabIndex="-1"` — как ожидается от roving tabindex.
 */

type WorkshopTabsProps = {
  settings: WorkshopSettings;
  filaments: WorkshopFilament[];
  printers: WorkshopPrinter[];
  orders: WorkshopOrder[];
  isMissingTable: boolean;
  isFilamentsMissingTable: boolean;
  isPrintersMissingTable: boolean;
  isOrdersMissingTable: boolean;
};

const TABS = [
  {
    id: "orders",
    label: "Заказы",
    description: "Клиенты, сроки и статусы",
    Icon: OrdersIcon,
  },
  {
    id: "inventory",
    label: "Склад",
    description: "Катушки и остатки пластика",
    Icon: InventoryIcon,
  },
  {
    id: "printers",
    label: "Принтеры",
    description: "Наработка и обслуживание",
    Icon: PrinterIcon,
  },
  {
    id: "products",
    label: "Товары",
    description: "Каталог готовых изделий",
    Icon: ProductsIcon,
  },
  {
    id: "calculator",
    label: "Калькулятор",
    description: "Себестоимость и цена",
    Icon: CalculatorIcon,
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function WorkshopTabs({
  settings,
  filaments,
  printers,
  orders,
  isMissingTable,
  isFilamentsMissingTable,
  isPrintersMissingTable,
  isOrdersMissingTable,
}: WorkshopTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("orders");
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement | null>());

  const activeTabMeta =
    TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  /** Счётчики в навигации: их видно и на мобильном, и в сайдбаре. */
  const counts: Partial<Record<TabId, number>> = {
    orders: orders.length,
    inventory: filaments.length,
    printers: printers.length,
  };

  /** Стрелки влево-вправо: переключение с переносом по кругу. */
  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;

    if (step === 0) {
      return;
    }

    event.preventDefault();

    const next = TABS[(index + step + TABS.length) % TABS.length];
    setActiveTab(next.id);
    tabRefs.current.get(next.id)?.focus();
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <div className="min-w-0 lg:sticky lg:top-24">
        <nav
          aria-label="Разделы мастерской"
          className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#0a0a0a]/90 p-2 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl"
        >
          <div className="hidden items-center justify-between px-3 pt-2 pb-3 lg:flex">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              Разделы
            </p>
            <span className="rounded-md border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 tabular-nums">
              {TABS.length}
            </span>
          </div>

          <div
            role="tablist"
            aria-label="Разделы мастерской"
            className="-mx-0.5 flex max-w-full gap-1 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
          >
            {TABS.map((tab, index) => {
              const isActive = tab.id === activeTab;
              const count = counts[tab.id];
              const Icon = tab.Icon;

              return (
                <button
                  key={tab.id}
                  ref={(node) => {
                    tabRefs.current.set(tab.id, node);
                  }}
                  type="button"
                  role="tab"
                  id={`workshop-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`workshop-panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  title={tab.description}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className={`group flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl border px-3.5 text-left text-sm font-semibold whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] lg:w-full ${
                    isActive
                      ? "border-white/10 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-500/15 text-blue-300"
                        : "text-zinc-500 group-hover:text-zinc-300"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="lg:flex-1">{tab.label}</span>
                  {count !== undefined && count > 0 ? (
                    <span
                      className={`inline-flex min-w-5 items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                        isActive
                          ? "bg-white/10 text-zinc-200"
                          : "bg-white/[0.04] text-zinc-500"
                      }`}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-2 hidden border-t border-white/5 px-3 pt-4 pb-2 lg:block">
            <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-600 uppercase">
              Pro workspace
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
              Заказы, склад и техника в одном аккаунте.
            </p>
          </div>
        </nav>
      </div>

      <section
        aria-label="Рабочая область мастерской"
        className="min-w-0 overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0a] shadow-[0_30px_90px_-50px_rgba(0,0,0,1)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
            />
            <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">
              Рабочая область
            </p>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <p className="truncate text-xs font-semibold text-zinc-300">
              {activeTabMeta.label}
            </p>
          </div>
          <p className="hidden text-[11px] text-zinc-600 sm:block">
            Данные сохраняются в аккаунте
          </p>
        </div>

        <div className="p-4 sm:p-6">

          <div
            role="tabpanel"
            id="workshop-panel-orders"
            aria-labelledby="workshop-tab-orders"
            hidden={activeTab !== "orders"}
          >
            <WorkshopOrdersTab
              orders={orders}
              printers={printers}
              filaments={filaments}
              isMissingTable={isOrdersMissingTable}
            />
          </div>

          <div
            role="tabpanel"
            id="workshop-panel-inventory"
            aria-labelledby="workshop-tab-inventory"
            hidden={activeTab !== "inventory"}
          >
            <WorkshopStockTab
              filaments={filaments}
              isMissingTable={isFilamentsMissingTable}
            />
          </div>

          <div
            role="tabpanel"
            id="workshop-panel-printers"
            aria-labelledby="workshop-tab-printers"
            hidden={activeTab !== "printers"}
          >
            <WorkshopPrintersTab
              printers={printers}
              isMissingTable={isPrintersMissingTable}
            />
          </div>

          <div
            role="tabpanel"
            id="workshop-panel-products"
            aria-labelledby="workshop-tab-products"
            hidden={activeTab !== "products"}
          >
            <ProductsEmptyState
              onOpenCalculator={() => setActiveTab("calculator")}
            />
          </div>

          <div
            role="tabpanel"
            id="workshop-panel-calculator"
            aria-labelledby="workshop-tab-calculator"
            hidden={activeTab !== "calculator"}
          >
            <WorkshopCalculatorTab
              initialSettings={settings}
              isMissingTable={isMissingTable}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Пустое состояние «Товаров».
 *
 * Раздел добавлен в навигацию, но таблицы товаров ещё нет. Честный экран
 * объясняет, что здесь появится, и ведёт в работающий калькулятор — вместо
 * пустоты или фальшивого списка.
 */
function ProductsEmptyState({
  onOpenCalculator,
}: {
  onOpenCalculator: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-5 py-12 text-center sm:py-16">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-400">
        <ProductsIcon className="h-6 w-6" />
      </span>
      <h2 className="mt-5 text-lg font-bold tracking-tight text-white">
        Товары пока не ведутся
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
        Здесь появятся карточки изделий, цены и связь с заказами. Пока
        себестоимость и рекомендованную цену считает калькулятор.
      </p>
      <button
        type="button"
        onClick={onOpenCalculator}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-semibold text-zinc-200 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
      >
        Открыть калькулятор
      </button>
    </div>
  );
}
