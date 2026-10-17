import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const ZONES = [
  { number: "1", title: "фото", detail: "5–6 кадров", color: "#3b82f6", x: 8, y: 38 },
  { number: "2", title: "название", detail: "5–8 слов", color: "#06b6d4", x: 8, y: 80 },
  { number: "3", title: "цена", detail: "750 ₽", color: "#f59e0b", x: 8, y: 122 },
  { number: "4", title: "описание", detail: "2 строки", color: "#8b5cf6", x: 216, y: 38 },
  { number: "5", title: "параметры", detail: "размер · PLA", color: "#10b981", x: 216, y: 80 },
  { number: "6", title: "отзывы", detail: "5 → 20", color: "#f472b6", x: 216, y: 122 },
];

/**
 * Кадр блока 12 урока Z5 «Фото, маркетинг, продвижение».
 *
 * Макет из описания `Z5_card_anatomy.png`: шесть зон карточки товара. В блоке
 * 12 перечислены только пять зон, шестая — описание — взята из блока 15, где
 * разобраны длина текста и структура. Цена 750 ₽ — пример из блока 1, а не
 * цена конкретной детали. Отзывы 5 → 20 показывают путь от первых пяти до
 * двадцати.
 */
export function ProfitZ5Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шесть зон карточки товара: фото из 5–6 кадров, название из 5–8 слов, цена 750 рублей, описание на 2 строки, параметры размер и материал PLA и отзывы от 5 до 20. Шестая зона — описание"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          анатомия карточки
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          шесть зон · от фото до отзывов
        </text>

        {ZONES.map((zone) => (
          <g key={zone.title}>
            <rect x={zone.x} y={zone.y} width="96" height="36" rx="6" fill="#0f172a" stroke="#334155" />
            <rect x={zone.x} y={zone.y} width="3" height="36" rx="1.5" fill={zone.color} />
            <text x={zone.x + 8} y={zone.y + 16} fontSize="10" fontWeight="700" fill="#e2e8f0">
              {zone.number} · {zone.title}
            </text>
            <text x={zone.x + 8} y={zone.y + 31} fontSize="10" fill="#cbd5e1">
              {zone.detail}
            </text>
          </g>
        ))}

        <rect x="112" y="38" width="96" height="128" rx="8" fill="#0f172a" stroke="#475569" />

        <rect x="118" y="44" width="84" height="36" rx="4" fill="#3b82f6" fillOpacity="0.1" stroke="#60a5fa" strokeOpacity="0.5" />
        <path d="M130 74 H174" stroke="#64748b" strokeWidth="1" />
        <path d="M146 74 V56 Q146 50 152 50 Q158 50 158 56 V74" fill="#3b82f6" fillOpacity="0.2" stroke="#93c5fd" />
        <circle cx="152" cy="64" r="3" fill="#93c5fd" />

        <rect x="118" y="88" width="58" height="4" rx="2" fill="#22d3ee" />
        <rect x="118" y="96" width="42" height="4" rx="2" fill="#22d3ee" fillOpacity="0.55" />

        <text x="118" y="120" fontSize="14" fontWeight="700" fill="#fbbf24">
          750 ₽
        </text>

        <rect x="118" y="126" width="76" height="3" rx="1.5" fill="#a78bfa" />
        <rect x="118" y="132" width="62" height="3" rx="1.5" fill="#a78bfa" fillOpacity="0.6" />

        {[0, 1, 2].map((chip) => (
          <rect key={chip} x={118 + chip * 24} y="140" width="20" height="7" rx="2" fill="#10b981" fillOpacity="0.22" stroke="#34d399" />
        ))}

        {[0, 1, 2, 3, 4].map((star) => {
          const cx = 122 + star * 13;
          return (
            <path
              key={star}
              d={`M${cx} 151 L${cx + 2.3} 156 L${cx + 7} 156 L${cx + 3.1} 159 L${cx + 4.6} 164 L${cx} 161 L${cx - 4.6} 164 L${cx - 3.1} 159 L${cx - 7} 156 L${cx - 2.3} 156 Z`}
              fill="#f472b6"
              fillOpacity="0.8"
            />
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
