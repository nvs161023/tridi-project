import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const BRIEF = [
  { label: "задача", value: "подставка для планшета" },
  { label: "габариты", value: "180 × 120 × 25 мм" },
  { label: "материал", value: "PETG" },
  { label: "цвет", value: "чёрный" },
  { label: "срок", value: "к пятнице" },
  { label: "бюджет", value: "≈ 800 ₽" },
];

/**
 * Кадр блока 9 урока Z3 «Клиенты: бриф, ТЗ, споры».
 *
 * Макет из описания `Z3_brief_card.png`: бриф на одну страницу. В карточке
 * ровно шесть ответов из блока 6 — задача, габариты, материал, цвет, срок,
 * бюджет. Примеры размеров 180 × 120 × 25 мм, PETG, чёрный, пятница и бюджет
 * около 800 ₽ взяты оттуда же. Количество 1 шт вынесено отдельным бейджем,
 * потому что в заголовке брифа именно шесть пунктов.
 */
export function ProfitZ3Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Бриф на одну страницу: подставка для планшета, габариты 180 на 120 на 25 миллиметров, материал PETG, чёрный цвет, срок к пятнице, бюджет около 800 рублей, одна штука. В брифе шесть ответов"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          бриф на одну страницу
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          шесть ответов вместо десяти сообщений
        </text>

        <rect x="12" y="38" width="190" height="130" rx="7" fill="#0f172a" stroke="#334155" />
        <rect x="12" y="38" width="190" height="20" rx="7" fill="#1d4ed8" fillOpacity="0.12" />
        <text x="20" y="51" fontSize="10" fontWeight="700" fill="#e2e8f0">
          БРИФ · подставка
        </text>
        <text x="194" y="51" fontSize="10" fill="#fcd34d" textAnchor="end">
          6 ответов
        </text>
        <path d="M20 58 H194" stroke="#334155" strokeWidth="0.8" />
        <path d="M70 64 V160" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 3" />

        {BRIEF.map((row, index) => {
          const y = 72 + index * 16;
          return (
            <g key={row.label}>
              <text x="20" y={y} fontSize="10" fill="#94a3b8">
                {row.label}
              </text>
              <text x="78" y={y} fontSize="10" fill="#e2e8f0">
                {row.value}
              </text>
            </g>
          );
        })}

        <rect x="212" y="38" width="96" height="18" rx="5" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeOpacity="0.35" />
        <text x="260" y="50" fontSize="10" fill="#fcd34d" textAnchor="middle">
          1 шт · подставка
        </text>

        <rect x="224" y="100" width="64" height="10" rx="3" fill="#3b82f6" fillOpacity="0.25" stroke="#3b82f6" />
        <path d="M228 100 V78 L238 73 V100" fill="#3b82f6" fillOpacity="0.35" stroke="#60a5fa" strokeWidth="0.8" />
        <rect x="240" y="66" width="34" height="26" rx="2" fill="#0f172a" stroke="#94a3b8" transform="rotate(-10 257 79)" />

        <path d="M224 120 H288" stroke="#94a3b8" strokeWidth="0.8" />
        <path d="M224 116 V124 M288 116 V124" stroke="#94a3b8" strokeWidth="0.8" />
        <text x="256" y="134" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          180 мм
        </text>
        <text x="256" y="150" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          120 × 25 мм
        </text>
        <text x="256" y="164" fontSize="10" fill="#94a3b8" textAnchor="middle">
          PETG · чёрный
        </text>
      </svg>
    </VisualWrapper>
  );
}
