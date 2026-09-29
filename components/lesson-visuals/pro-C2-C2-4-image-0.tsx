import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Смещения пинов от середины: один, два, три и четыре контакта. */
const PIN_OFFSETS: Record<number, number[]> = {
  1: [0],
  2: [-2.1, 2.1],
  3: [-4.2, 0, 4.2],
  4: [-5.6, -1.9, 1.9, 5.6],
};

/**
 * Шкала по току: слева тонкий сигнальный DuPont, справа силовой XT60.
 * Сечение провода растёт вместе с током, цвет — тот же, что у этих разъёмов
 * в кадре про плату (C2-1), чтобы разъём узнавался по цвету.
 */
const CONNECTORS = [
  { id: "dupont", name: "DuPont", use: "концевики", color: "#60a5fa", wire: 1.6, pins: 1, cx: 48 },
  { id: "ph", name: "JST-PH", use: "датчики", color: "#cbd5e1", wire: 2.4, pins: 2, cx: 104 },
  { id: "xh", name: "JST-XH", use: "термисторы", color: "#e2e8f0", wire: 3.2, pins: 3, cx: 160 },
  { id: "molex", name: "Molex", use: "питание", color: "#f472b6", wire: 4.4, pins: 4, cx: 216 },
  { id: "xt60", name: "XT60", use: "силовое питание", color: "#fbbf24", wire: 6.4, pins: 2, cx: 272 },
];

/**
 * Разъёмы одной шкалой по току, а не каталогом: слева направо растёт и число
 * контактов, и сечение провода. Каждый разъём нарисован парой «мама и папа» —
 * гнёзда слева, штырьки справа.
 *
 * От C2-1-image (ряд разъёмов на плате, каждый сам по себе) отличается тем, что
 * здесь разъёмы выстроены шкалой по одному признаку и связаны ростом сечения
 * провода. От M-M3-image (каталог моделей) — отсутствием плиток и названий
 * моделей.
 */
export function ProC2C24Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шкала разъёмов по току: слева направо DuPont для концевиков, JST-PH для датчиков, JST-XH для термисторов, Molex для питания и силовой XT60, у которого самый толстый провод. Каждый разъём показан парой «мама и папа»: гнёзда слева, штырьки справа."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Типы разъёмов: от DuPont к XT60 — ток растёт
        </text>

        {/* Ось шкалы: направление роста тока */}
        <line x1="20" y1="30" x2="292" y2="30" stroke="#475569" strokeWidth="1.2" />
        <polygon points="292,30 284,26 284,34" fill="#94a3b8" />

        {CONNECTORS.map((item) => (
          <g key={item.id}>
            {/* Мама: корпус с гнёздами под штырьки */}
            <rect
              x={item.cx - 14}
              y="41"
              width="13"
              height="15"
              rx="2"
              fill="#334155"
              stroke={item.color}
              strokeWidth="1.2"
            />
            {/* Папа: корпус, из которого выходят штырьки */}
            <rect
              x={item.cx + 2}
              y="41"
              width="13"
              height="15"
              rx="2"
              fill="#334155"
              stroke={item.color}
              strokeWidth="1.2"
            />
            {PIN_OFFSETS[item.pins].map((offset) => (
              <g key={`${item.id}-${offset}`}>
                <line
                  x1={item.cx - 4}
                  y1={48.5 + offset}
                  x2={item.cx + 2}
                  y2={48.5 + offset}
                  stroke="#fbbf24"
                  strokeWidth="1.8"
                />
                <circle
                  cx={item.cx - 8.5}
                  cy={48.5 + offset}
                  r="1.5"
                  fill="#0f172a"
                  stroke={item.color}
                  strokeWidth="0.7"
                />
              </g>
            ))}
            {/* Провод: сечение растёт от сигнального к силовому */}
            <line
              x1={item.cx - 24}
              y1="70"
              x2={item.cx + 24}
              y2="70"
              stroke="#94a3b8"
              strokeWidth={item.wire}
              strokeLinecap="round"
            />
            <text x={item.cx} y="92" fontSize="8" fill="#e2e8f0" textAnchor="middle">
              {item.name}
            </text>
            <text x={item.cx} y="105" fontSize="7.5" fill="#94a3b8" textAnchor="middle">
              {item.use}
            </text>
          </g>
        ))}

        <text x="12" y="150" fontSize="8" fill="#94a3b8">
          в паре — мама и папа; провод толще — ток больше
        </text>
      </svg>
    </VisualWrapper>
  );
}
