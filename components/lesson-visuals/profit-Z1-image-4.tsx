import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const FILTERS = [
  {
    title: "что умею",
    color: "#93c5fd",
    line1: "детали, что уже",
    line2: "не начинать с 10 часов",
  },
  {
    title: "что покупают",
    color: "#fcd34d",
    line1: "10 товаров на площадке",
    line2: "3–4 жалобы в отзывах",
  },
  {
    title: "что остаётся на руки",
    color: "#6ee7b7",
    line1: "100 ₽/ч — порог",
    line2: "меньше — слабая ниша",
  },
];

/**
 * Кадр блока 29 урока Z1 «Что продавать: ниши и маржа».
 *
 * Макет из описания `Z1_pick_niche.png`: три круга — что умею, что покупают и
 * что остаётся на руки. Числа — блок 28 (десять похожих товаров, три жалобы,
 * сто рублей за час, десять часов печати) и блок 6 (десять вариантов, неделя).
 */
export function ProfitZ1Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Ниша выбрана: три круга. Что умею — детали, которые уже получались, не начинать с десяти часов печати. Что покупают — десять похожих товаров на площадке, три-четыре повторяющиеся жалобы в отзывах. Что остаётся на руки — сто рублей за час как порог, меньше — слабая ниша. Пересечение трёх кругов и есть ниша: десять вариантов и неделя проверки"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          ниша: пересечение трёх кругов
        </text>

        <circle cx="72" cy="80" r="38" fill="#3b82f6" fillOpacity="0.12" stroke="#3b82f6" strokeOpacity="0.55" />
        <circle cx="128" cy="80" r="38" fill="#f59e0b" fillOpacity="0.12" stroke="#f59e0b" strokeOpacity="0.55" />
        <circle cx="100" cy="114" r="38" fill="#10b981" fillOpacity="0.12" stroke="#10b981" strokeOpacity="0.55" />

        <text x="52" y="85" fontSize="14" fontWeight="700" fill="#93c5fd" textAnchor="middle">
          1
        </text>
        <text x="148" y="85" fontSize="14" fontWeight="700" fill="#fcd34d" textAnchor="middle">
          2
        </text>
        <text x="100" y="143" fontSize="14" fontWeight="700" fill="#6ee7b7" textAnchor="middle">
          3
        </text>

        <rect x="83" y="72" width="34" height="18" rx="9" fill="#0f172a" stroke="#475569" />
        <text x="100" y="85" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          ниша
        </text>

        <rect x="172" y="24" width="136" height="126" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        {FILTERS.map((filter, i) => {
          const y = 42 + i * 38;
          return (
            <g key={filter.title}>
              <circle cx="180" cy={y - 3.5} r="2.5" fill={filter.color} />
              <text x="188" y={y} fontSize="10" fontWeight="700" fill={filter.color}>
                {filter.title}
              </text>
              <text x="180" y={y + 14} fontSize="10" fill="#e2e8f0">
                {filter.line1}
              </text>
              <text x="180" y={y + 26} fontSize="10" fill="#94a3b8">
                {filter.line2}
              </text>
              {i < FILTERS.length - 1 ? (
                <path d={`M188 ${y + 31} H300`} stroke="#334155" strokeWidth="0.7" />
              ) : null}
            </g>
          );
        })}

        <rect x="12" y="154" width="296" height="20" rx="5" fill="#f59e0b" fillOpacity="0.08" stroke="#f59e0b" strokeOpacity="0.3" />
        <text x="160" y="168" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          10 вариантов · неделя проверки · одна ниша
        </text>
      </svg>
    </VisualWrapper>
  );
}
