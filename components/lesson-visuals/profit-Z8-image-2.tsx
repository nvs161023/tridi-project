import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STEPS = [
  { n: "1", label: "материал", color: "#06b6d4" },
  { n: "2", label: "печать", color: "#3b82f6" },
  { n: "3", label: "сборка", color: "#8b5cf6" },
  { n: "4", label: "нумерация", color: "#f59e0b" },
  { n: "5", label: "фото", color: "#10b981" },
  { n: "6", label: "вопросы", color: "#ec4899" },
];

const STATS = [
  { value: "3", label: "ракурса", valueX: 18, labelX: 30 },
  { value: "1", label: "эталон", valueX: 114, labelX: 126 },
  { value: "≈1 ч", label: "съёмка", valueX: 210, labelX: 246 },
];

/**
 * Кадр блока 17 урока Z8 «Финальный проект: свой продукт».
 *
 * `Z8_first_batch.png`: тестовая партия из трёх-пяти штук проходит шесть
 * операций — материал, печать, сборка, нумерация, фото и вопросы о цене.
 * Съёмка — три ракурса плюс кадр деталей; одна штука остаётся эталоном
 * качества, ещё одна идёт на фото и описание.
 */
export function ProfitZ8Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Тестовая партия из трёх-пяти штук: материал, печать, сборка, нумерация каждой штуки, фото и вопросы людей о цене. Съёмка — три ракурса спереди, сбоку и в работе плюс одна фотография деталей крупно. Одна штука остаётся эталоном качества, ещё одна идёт для фото и описания. Съёмка занимает около часа"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          тестовая партия
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          от эскиза до фото · партия для проверки, не для денег
        </text>
        <rect x="262" y="5" width="48" height="14" rx="7" fill="#22d3ee" fillOpacity="0.15" stroke="#22d3ee" strokeOpacity="0.5" />
        <text x="286" y="15" fontSize="10" fontWeight="700" fill="#22d3ee" textAnchor="middle">
          3–5 шт
        </text>

        {STEPS.map((step, index) => {
          const col = index % 3;
          const row = Math.floor(index / 3);
          const x = 10 + col * 102;
          const y = 40 + row * 38;
          return (
            <g key={step.n}>
              <rect x={x} y={y} width="96" height="30" rx="5" fill="#0f172a" stroke="#334155" />
              <rect x={x} y={y} width="96" height="3" rx="1.5" fill={step.color} />
              <circle cx={x + 14} cy={y + 17} r="6" fill={step.color} fillOpacity="0.2" stroke={step.color} strokeOpacity="0.7" />
              <text x={x + 14} y={y + 21} fontSize="10" fontWeight="700" fill={step.color} textAnchor="middle">
                {step.n}
              </text>
              <text x={x + 26} y={y + 21} fontSize="10" fontWeight="700" fill="#e2e8f0">
                {step.label}
              </text>
              {col < 2 && (
                <path d={`M${x + 96} ${y + 15} h4`} stroke="#64748b" strokeWidth="1.5" />
              )}
            </g>
          );
        })}

        <rect x="10" y="116" width="300" height="56" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="18" y="130" fontSize="10" fontWeight="700" fill="#94a3b8">
          что остаётся после партии
        </text>
        {STATS.map((stat) => {
          return (
            <g key={stat.label}>
              <text x={stat.valueX} y="152" fontSize="15" fontWeight="700" fill="#22d3ee">
                {stat.value}
              </text>
              <text x={stat.labelX} y="152" fontSize="10" fill="#cbd5e1">
                {stat.label}
              </text>
            </g>
          );
        })}
        <text x="18" y="167" fontSize="10" fill="#94a3b8">
          реальная себестоимость · ответ людей на цену
        </text>
      </svg>
    </VisualWrapper>
  );
}
