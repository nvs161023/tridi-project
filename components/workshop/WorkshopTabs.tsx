"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { WorkshopCalculatorTab } from "@/components/workshop/WorkshopCalculatorTab";
import { WorkshopOrdersTab } from "@/components/workshop/WorkshopOrdersTab";
import { WorkshopPrintersTab } from "@/components/workshop/WorkshopPrintersTab";
import { WorkshopStockTab } from "@/components/workshop/WorkshopStockTab";
import type { WorkshopFilament } from "@/lib/workshop/filaments";
import type { WorkshopOrder } from "@/lib/workshop/orders";
import type { WorkshopPrinter } from "@/lib/workshop/printers";
import type { WorkshopSettings } from "@/lib/workshop/settings";

/**
 * Табы Мастерской.
 *
 * Четыре раздела: калькулятор, склад пластика, принтеры и заказы. Все работают
 * — заглушек «в разработке» больше нет. Принтеры и заказы живут в своих
 * таблицах, поэтому каждый раздел показывает предупреждение, если его миграция
 * ещё не применена, и не ломает остальные.
 *
 * На мобильном лента табов листается вбок (`overflow-x-auto`), поэтому четыре
 * подписи не ломают вёрстку. Стрелки клавиатуры переключают табы — так
 * ожидается от role="tablist", и заодно это единственный способ добраться до
 * скрытых табов с клавиатуры: у неактивных tabIndex="-1".
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
  { id: "calculator", label: "Калькулятор", icon: "🧮" },
  { id: "inventory", label: "Склад", icon: "📦" },
  { id: "printers", label: "Принтеры", icon: "🖨️" },
  { id: "orders", label: "Заказы", icon: "🧾" },
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
  const [activeTab, setActiveTab] = useState<TabId>("calculator");
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement | null>());

  /** Стрелки влево-вправо: переключение с переносом по кругу. */
  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;

    if (step === 0) {
      return;
    }

    event.preventDefault();

    const next = TABS[(index + step + TABS.length) % TABS.length];
    setActiveTab(next.id);
    tabRefs.current.get(next.id)?.focus();
  }

  return (
    <div className="mt-8">
      <div
        role="tablist"
        aria-label="Разделы мастерской"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((tab, index) => {
          const isActive = tab.id === activeTab;

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
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                isActive
                  ? "border-blue-400/50 bg-blue-500/15 text-white"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white"
              }`}
            >
              <span aria-hidden>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="workshop-panel-calculator"
        aria-labelledby="workshop-tab-calculator"
        hidden={activeTab !== "calculator"}
        className="mt-6"
      >
        <WorkshopCalculatorTab
          initialSettings={settings}
          isMissingTable={isMissingTable}
        />
      </div>

      <div
        role="tabpanel"
        id="workshop-panel-inventory"
        aria-labelledby="workshop-tab-inventory"
        hidden={activeTab !== "inventory"}
        className="mt-6"
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
        className="mt-6"
      >
        <WorkshopPrintersTab
          printers={printers}
          isMissingTable={isPrintersMissingTable}
        />
      </div>

      <div
        role="tabpanel"
        id="workshop-panel-orders"
        aria-labelledby="workshop-tab-orders"
        hidden={activeTab !== "orders"}
        className="mt-6"
      >
        <WorkshopOrdersTab
          orders={orders}
          printers={printers}
          filaments={filaments}
          isMissingTable={isOrdersMissingTable}
        />
      </div>
    </div>
  );
}
