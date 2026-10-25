import type { SVGProps } from "react";

/**
 * Иконки Мастерской.
 *
 * Один набор на навигацию и карточки статистики: линейные SVG в стиле Lucide,
 * наследуют цвет и размер от родителя (`currentColor`). Emoji в интерфейсе
 * остаются только у пустых состояний — навигация CRM должна выглядеть строго.
 */
type WorkshopIconProps = SVGProps<SVGSVGElement>;

/** Общие атрибуты: тонкая линия, скруглённые концы, без заливки. */
const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** Заказы: список с галочкой. */
export function OrdersIcon(props: WorkshopIconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="m8.5 13 1.5 1.5 3-3" />
      <path d="M14.5 16H16" />
    </svg>
  );
}

/** Склад: коробка с крышкой. */
export function InventoryIcon(props: WorkshopIconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="m21 8-9 5-9-5" />
      <path d="M3 8v9l9 5 9-5V8" />
      <path d="m3 8 9-5 9 5" />
      <path d="M12 13v9" />
    </svg>
  );
}

/** Принтеры: корпус 3D-принтера и деталь на столе. */
export function PrinterIcon(props: WorkshopIconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M6 9V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" />
      <rect x="3" y="9" width="18" height="7" rx="2" />
      <path d="M7 16v5h10v-5" />
      <path d="M7 19h10" />
      <path d="M9 5h6" />
    </svg>
  );
}

/** Товары: куб — модель, готовая к продаже. */
export function ProductsIcon(props: WorkshopIconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="m12 2 8 4.5v9L12 20l-8-4.5v-9L12 2Z" />
      <path d="m4 6.5 8 4.5 8-4.5" />
      <path d="M12 11v9" />
    </svg>
  );
}

/** Калькулятор: клавиатура и экран. */
export function CalculatorIcon(props: WorkshopIconProps) {
  return (
    <svg {...iconProps} {...props}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M8 6h8v4H8z" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </svg>
  );
}

/** Выручка: растущий график. */
export function RevenueIcon(props: WorkshopIconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

/** Плюс для акцентной кнопки. */
export function PlusIcon(props: WorkshopIconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
