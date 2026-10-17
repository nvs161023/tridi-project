import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const FACTORS = [
  { label: "температура", detail: "20–25 °C · без сквозняка", color: "#3b82f6" },
  { label: "влажность", detail: "сушить PLA и PETG", color: "#06b6d4" },
  { label: "калибровка", detail: "поток 0,4 мм · 1-й слой · ремни", color: "#f59e0b" },
  { label: "пластик", detail: "одна катушка на партию", color: "#8b5cf6" },
  { label: "принтер", detail: "люфт · сопло · ремень", color: "#10b981" },
];

/**
 * Кадр блока 5 урока Z4 «Серия: повторяемость, QC, допуски».
 *
 * Макет из описания `Z4_factors.png`: пять факторов повторяемости. Числа из
 * блоков 4–7: температура в комнате 20–25 °C, стенка при проверке потока
 * 0,4 мм, одна катушка на партию. Подвал повторяет главную мысль урока:
 * одинаковые условия дают одинаковые детали.
 */
export function ProfitZ4Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пять факторов повторяемости: температура 20–25 градусов, влажность и сушка PLA и PETG, калибровка потока 0,4 миллиметра, первого слоя и ремней, одна катушка пластика на партию и состояние принтера. Одинаковые условия дают одинаковые детали"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          пять факторов повторяемости
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          одинаковые условия → одинаковая деталь
        </text>

        {FACTORS.map((factor, index) => {
          const y = 40 + index * 24;
          return (
            <g key={factor.label}>
              <rect x="12" y={y} width="296" height="22" rx="5" fill="#0f172a" stroke="#334155" />
              <rect x="12" y={y} width="3" height="22" rx="1.5" fill={factor.color} />
              <circle cx="28" cy={y + 11} r="7" fill={factor.color} fillOpacity="0.16" stroke={factor.color} />
              <text x="28" y={y + 14.5} fontSize="10" fontWeight="700" fill={factor.color} textAnchor="middle">
                {index + 1}
              </text>
              <text x="42" y={y + 14.5} fontSize="10" fill="#e2e8f0">
                {factor.label}
              </text>
              <text x="120" y={y + 14.5} fontSize="10" fill="#cbd5e1">
                {factor.detail}
              </text>
            </g>
          );
        })}

        <text x="160" y="171" fontSize="10" fill="#94a3b8" textAnchor="middle">
          сначала условия, потом детали
        </text>
      </svg>
    </VisualWrapper>
  );
}
