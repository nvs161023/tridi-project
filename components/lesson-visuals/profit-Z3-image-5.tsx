import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STAGES = [
  { label: "недовольство", y: 36, color: "#f87171" },
  { label: "факт из ТЗ", y: 66, color: "#3b82f6" },
  { label: "предложение", y: 96, color: "#f59e0b" },
  { label: "решение", y: 126, color: "#10b981" },
];

const OPTIONS = ["переделать", "доработать", "возврат"];

/**
 * Кадр блока 27 урока Z3 «Клиенты: бриф, ТЗ, споры».
 *
 * Макет из описания `Z3_dispute_map.png`: четыре этапа — недовольство, факт
 * из ТЗ, предложение и решение. В блоке 26 заголовок говорит «пять шагов»,
 * но элементов там шесть, поэтому кадр идёт по описанию визуала: проверка
 * факта и сверка с ТЗ объединены в один этап, а запись договорённости и
 * правка ТЗ завершают решение. Три варианта предложения, пример PETG 180
 * против 150, 9 из 10 споров и 200 ₽ против трёх дней — из блока 25.
 */
export function ProfitZ3Image5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разбор спора: недовольство, факт из ТЗ, предложение и решение. В ТЗ PETG и 180 миллиметров, клиент просит 150. Три варианта предложения: переделать, доработать или вернуть деньги. В конце записать договорённость и дописать ТЗ. Девять из десяти споров решает последовательность, а 200 рублей дешевле трёх дней спора"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          разбор спора: от факта к решению
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          четыре этапа · три варианта
        </text>

        {STAGES.map((stage) => (
          <g key={stage.label}>
            <rect x="12" y={stage.y} width="104" height="24" rx="5" fill="#0f172a" stroke="#334155" />
            <rect x="12" y={stage.y} width="3" height="24" rx="1.5" fill={stage.color} />
            <text x="64" y={stage.y + 16} fontSize="10" fill="#e2e8f0" textAnchor="middle">
              {stage.label}
            </text>
          </g>
        ))}

        <path d="M60 62 L64 66 L68 62" fill="none" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M60 92 L64 96 L68 92" fill="none" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M60 122 L64 126 L68 122" fill="none" stroke="#64748b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />

        <rect x="128" y="36" width="180" height="52" rx="6" fill="#3b82f6" fillOpacity="0.07" stroke="#3b82f6" strokeOpacity="0.3" />
        <text x="136" y="49" fontSize="10" fill="#94a3b8">
          пример факта
        </text>
        <text x="136" y="67" fontSize="12" fontWeight="700" fill="#93c5fd">
          PETG · 180 мм
        </text>
        <text x="136" y="82" fontSize="10" fill="#cbd5e1">
          клиент просит 150
        </text>
        <path d="M116 78 H128" stroke="#64748b" strokeWidth="1" />

        <path d="M116 108 H128" stroke="#64748b" strokeWidth="1" />
        {OPTIONS.map((option, index) => {
          const x = 128 + index * 60;
          return (
            <g key={option}>
              <rect x={x} y="96" width="57" height="24" rx="5" fill="#f59e0b" fillOpacity="0.1" stroke="#f59e0b" strokeOpacity="0.4" />
              <text x={x + 28.5} y="112" fontSize="10" fill="#fcd34d" textAnchor="middle">
                {option}
              </text>
            </g>
          );
        })}

        <path d="M116 138 H128" stroke="#64748b" strokeWidth="1" />
        <rect x="128" y="122" width="177" height="32" rx="5" fill="#10b981" fillOpacity="0.08" stroke="#10b981" strokeOpacity="0.35" />
        <text x="136" y="136" fontSize="10" fill="#e2e8f0">
          записать договорённость
        </text>
        <text x="136" y="150" fontSize="10" fill="#cbd5e1">
          дописать ТЗ
        </text>

        <text x="160" y="167" fontSize="10" fill="#94a3b8" textAnchor="middle">
          9 из 10 · 200 ₽ дешевле 3 дней спора
        </text>
      </svg>
    </VisualWrapper>
  );
}
