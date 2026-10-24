"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { WorkshopCalculatorTab } from "@/components/workshop/WorkshopCalculatorTab";
import { WorkshopStockTab } from "@/components/workshop/WorkshopStockTab";
import type { WorkshopFilament } from "@/lib/workshop/filaments";
import type { WorkshopSettings } from "@/lib/workshop/settings";

/**
 * Табы Мастерской.
 *
 * Калькулятор и склад работают, принтеры и заказы появятся следующими этапами.
 * Вместо пустых ссылок показываем, что именно будет в каждом разделе: человек
 * понимает, за что платит, и не уходит искать несуществующую страницу.
 *
 * На мобильном лента табов листается вбок (`overflow-x-auto`), поэтому четыре
 * подписи не ломают вёрстку. Стрелки клавиатуры переключают табы — так
 * ожидается от role="tablist", и заодно это единственный способ добраться до
 * скрытых табов с клавиатуры: у неактивных tabIndex="-1".
 */

type WorkshopTabsProps = {
  settings: WorkshopSettings;
  filaments: WorkshopFilament[];
  isMissingTable: boolean;
  isFilamentsMissingTable: boolean;
};

const TABS = [
  { id: "calculator", label: "Калькулятор", icon: "🧮" },
  { id: "inventory", label: "Склад", icon: "📦" },
  { id: "printers", label: "Принтеры", icon: "🖨️" },
  { id: "orders", label: "Заказы", icon: "🧾" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Разделы, которые ещё в разработке. */
type UpcomingTabId = Exclude<TabId, "calculator" | "inventory">;

type UpcomingTab = {
  title: string;
  description: string;
  points: string[];
};

/** Что появится в разделах, которые ещё в разработке. */
const UPCOMING: Record<UpcomingTabId, UpcomingTab> = {
  printers: {
    title: "Принтеры",
    description: "Парк принтеров, их загрузка и обслуживание в одном списке.",
    points: [
      "Стоимость часа печати по каждому принтеру",
      "Календарь занятости и очередь заказов",
      "Напоминания о чистке и смазке",
    ],
  },
  orders: {
    title: "Заказы",
    description: "Клиенты и деньги: от заявки до закрытия заказа.",
    points: [
      "Заказ из расчёта калькулятора в один клик",
      "Статусы: новый, в печати, готов, выдан",
      "Выручка и прибыль за месяц",
    ],
  },
};

const UPCOMING_IDS = Object.keys(UPCOMING) as UpcomingTabId[];

/** Раздел ещё в разработке: подпись в табе и заглушка вместо содержимого. */
function isUpcoming(tabId: TabId): tabId is UpcomingTabId {
  return tabId in UPCOMING;
}

export function WorkshopTabs({
  settings,
  filaments,
  isMissingTable,
  isFilamentsMissingTable,
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
              {isUpcoming(tab.id) ? (
                <span className="sr-only"> — в разработке</span>
              ) : null}
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

      {UPCOMING_IDS.map((id) => (
        <div
          key={id}
          role="tabpanel"
          id={`workshop-panel-${id}`}
          aria-labelledby={`workshop-tab-${id}`}
          hidden={activeTab !== id}
          className="mt-6"
        >
          <UpcomingPanel tab={UPCOMING[id]} />
        </div>
      ))}
    </div>
  );
}

/** Заглушка будущего раздела: что появится в следующих этапах. */
function UpcomingPanel({ tab }: { tab: UpcomingTab }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          {tab.title}
        </h2>
        <span className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-200 uppercase">
          В разработке
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
        {tab.description}
      </p>
      <ul className="mt-5 space-y-2">
        {tab.points.map((point) => (
          <li
            key={point}
            className="flex items-start gap-2 text-sm text-slate-300"
          >
            <span aria-hidden className="mt-0.5 text-blue-300">
              ✓
            </span>
            {point}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs leading-relaxed text-slate-400">
        Раздел появится в следующих этапах Мастерской. Калькулятор и склад уже
        работают — начните с них.
      </p>
    </section>
  );
}
