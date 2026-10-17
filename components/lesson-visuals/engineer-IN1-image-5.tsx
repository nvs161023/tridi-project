import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type Panel = { cx: number; title: string; value: string; note: string };

/** Три способа посадить металл в пластик, блоки 21–23. */
const PANELS: Panel[] = [
  { cx: 58, title: "вставка M3", value: "250–280 °C", note: "паяльник" },
  { cx: 160, title: "гайка в кармане", value: "сборка один раз", note: "дешевле вставки" },
  { cx: 262, title: "втулка", value: "по всей длине", note: "иначе точечно" },
];

/**
 * Кадр блока 23 урока IN1 «Инженерные материалы и совместимость».
 *
 * Макет из описания кадра `IN1_inserts.png`: три разреза крепежа. Тепловая
 * вставка M3 запрессовывается паяльником при 250–280 °C и выступает над
 * пластиком, гайка лежит в кармане, втулка идёт по всей длине отверстия.
 */
export function EngineerIN1Image5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Крепёж и вставки: три разреза. Тепловая вставка M3 запрессовывается паяльником при 250–280 °C и выступает над пластиком. Гайка в кармане — вариант для сборки один раз, дешевле вставки. Втулка идёт по всей длине отверстия, иначе давление точечное"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          как посадить металл в пластик
        </text>

        {PANELS.map((panel) => (
          <g key={panel.title}>
            <rect
              x={panel.cx - 46}
              y="22"
              width="92"
              height="98"
              rx="8"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
            />
            <text
              x={panel.cx}
              y="36"
              fontSize="10"
              fontWeight="700"
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {panel.title}
            </text>

            {/* Пластик — общая деталь для всех трёх разрезов. */}
            <rect
              x={panel.cx - 20}
              y="74"
              width="40"
              height="38"
              rx="3"
              fill="#334155"
              stroke="#64748b"
            />
            <rect x={panel.cx - 3} y="49" width="6" height="20" fill="#cbd5e1" fillOpacity="0.8" />
            <rect x={panel.cx - 11} y="44" width="22" height="5" rx="1" fill="#94a3b8" />
          </g>
        ))}

        {/* Вставка: металл сидит в бобышке и выступает над пластиком. */}
        <rect x="50" y="62" width="16" height="14" fill="#cbd5e1" fillOpacity="0.6" stroke="#94a3b8" />
        <line x1="52" y1="74" x2="62" y2="64" stroke="#64748b" />
        <line x1="56" y1="75" x2="65" y2="66" stroke="#64748b" />

        {/* Гайка в шестигранном кармане. */}
        <rect x="158" y="60" width="4" height="22" fill="#cbd5e1" fillOpacity="0.8" />
        <path d="M150 74 H170 L174 84 L170 94 H150 L146 84 Z" fill="#0f172a" stroke="#64748b" />
        <path d="M153 79 H167 L170 84 L167 89 H153 L150 84 Z" fill="#cbd5e1" fillOpacity="0.7" />

        {/* Втулка по всей длине отверстия. */}
        <rect x="256" y="74" width="8" height="38" fill="#0f172a" />
        <rect x="253" y="68" width="4" height="44" fill="#cbd5e1" fillOpacity="0.65" />
        <rect x="263" y="68" width="4" height="44" fill="#cbd5e1" fillOpacity="0.65" />
        <rect x="259" y="46" width="4" height="24" fill="#cbd5e1" fillOpacity="0.8" />

        {PANELS.map((panel) => (
          <g key={panel.value}>
            <text x={panel.cx} y="132" fontSize="10" fontWeight="700" fill="#fcd34d" textAnchor="middle">
              {panel.value}
            </text>
            <text x={panel.cx} y="144" fontSize="10" fill="#cbd5e1" textAnchor="middle">
              {panel.note}
            </text>
          </g>
        ))}

        <text x="160" y="164" fontSize="10" fill="#fcd34d" textAnchor="middle">
          металл должен выступать над пластиком
        </text>
      </svg>
    </VisualWrapper>
  );
}
