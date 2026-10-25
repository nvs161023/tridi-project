import {
  InventoryIcon,
  OrdersIcon,
  PrinterIcon,
  RevenueIcon,
} from "@/components/workshop/WorkshopIcons";
import { formatOrderCost } from "@/lib/workshop/orders";

/**
 * Быстрая статистика рабочей области.
 *
 * Четыре glass-карточки отделены от hero: цифры читаются сразу, а подписи
 * объясняют, что именно посчитано. Выручка — только доставленные заказы,
 * созданные в текущем месяце: в модели заказа нет даты оплаты, поэтому
 * выдавать новые заказы за полученные деньги нельзя.
 *
 * На мобильном сетка держит две колонки, на десктопе — четыре. Крупное
 * значение переносится, если сумма не помещается: горизонтального overflow
 * не появляется даже у семизначной выручки.
 */
type WorkshopStatsProps = {
  activeOrders: number;
  printingOrders: number;
  monthRevenue: number;
  deliveredThisMonth: number;
  spools: number;
  lowStock: number;
  printerCount: number;
  maintenanceDue: number;
};

export function WorkshopStats({
  activeOrders,
  printingOrders,
  monthRevenue,
  deliveredThisMonth,
  spools,
  lowStock,
  printerCount,
  maintenanceDue,
}: WorkshopStatsProps) {
  const stats = [
    {
      label: "Заказов в работе",
      value: String(activeOrders),
      hint:
        printingOrders > 0
          ? `Сейчас в печати: ${printingOrders}`
          : "Сейчас нет заказов в печати",
      Icon: OrdersIcon,
      tone: "text-blue-300",
      iconBox: "border-blue-400/20 bg-blue-500/10",
      glow: "bg-blue-500/15",
    },
    {
      label: "Выручка за месяц",
      value: formatOrderCost(monthRevenue),
      hint:
        deliveredThisMonth > 0
          ? `Доставлено в этом месяце: ${deliveredThisMonth}`
          : "Доставленных заказов пока нет",
      Icon: RevenueIcon,
      tone: "text-emerald-300",
      iconBox: "border-emerald-400/20 bg-emerald-500/10",
      glow: "bg-emerald-500/15",
    },
    {
      label: "Катушек на складе",
      value: String(spools),
      hint:
        lowStock > 0 ? `Пора докупить: ${lowStock}` : "Все катушки с запасом",
      Icon: InventoryIcon,
      tone: "text-violet-300",
      iconBox: "border-violet-400/20 bg-violet-500/10",
      glow: "bg-violet-500/15",
    },
    {
      label: "Принтеров",
      value: String(printerCount),
      hint:
        maintenanceDue > 0
          ? `Требуют ТО: ${maintenanceDue}`
          : "Обслуживание в норме",
      Icon: PrinterIcon,
      tone: "text-amber-300",
      iconBox: "border-amber-400/20 bg-amber-500/10",
      glow: "bg-amber-500/15",
    },
  ];

  return (
    <ul
      aria-label="Быстрая статистика мастерской"
      className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-4"
    >
      {stats.map((stat) => {
        const Icon = stat.Icon;

        return (
          <li
            key={stat.label}
            className="relative min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] border-t-white/15 bg-[#0a0a0a]/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_50px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-5"
          >
            <div
              aria-hidden
              className={`pointer-events-none absolute -top-10 -right-8 h-24 w-24 rounded-full blur-2xl ${stat.glow}`}
            />
            <div className="relative flex items-start justify-between gap-3">
              <p className="max-w-[9rem] text-[10px] leading-snug font-semibold tracking-[0.12em] text-zinc-500 uppercase sm:text-[11px]">
                {stat.label}
              </p>
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${stat.iconBox} ${stat.tone}`}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="relative mt-4 text-[1.55rem] leading-none font-bold tracking-tight break-words text-white tabular-nums sm:text-3xl lg:text-[2rem]">
              {stat.value}
            </p>
            <p className="relative mt-2 text-[11px] leading-relaxed text-zinc-500">
              {stat.hint}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
