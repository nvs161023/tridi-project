import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const ROWS = [
  { label: "посадка на вал или ось", value: "±0,1 мм", color: "#10b981" },
  { label: "внешний габарит", value: "±0,2 мм", color: "#3b82f6" },
  { label: "декор, литеры", value: "±0,5 мм", color: "#f59e0b" },
  { label: "вес детали", value: "±5 %", color: "#8b5cf6" },
];

/**
 * Кадр блока 14 урока Z4 «Серия: повторяемость, QC, допуски».
 *
 * Макет из описания `Z4_tolerances.png`: три главных допуска из блока 12 —
 * посадки ±0,1 мм, габарит ±0,2 мм, декор ±0,5 мм. Четвёртая строка — вес
 * ±5 % от эталона из блока 13. Поверхность и правило «один допуск на всю
 * партию» вынесены в подвал, чтобы таблица оставалась крупной.
 */
export function ProfitZ4Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Таблица допусков: посадка на вал или ось плюс-минус 0,1 миллиметра, внешний габарит плюс-минус 0,2 миллиметра, декор и литеры плюс-минус 0,5 миллиметра, вес детали плюс-минус 5 процентов от эталона. Поверхность без расслоений, волн и наплывов. Один допуск на всю партию задаёшь ты"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          таблица допусков
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          один допуск на всю партию
        </text>

        <rect x="12" y="38" width="296" height="110" rx="7" fill="#0f172a" stroke="#334155" />
        <rect x="12" y="38" width="296" height="18" rx="7" fill="#1d4ed8" fillOpacity="0.12" />
        <text x="20" y="50" fontSize="10" fill="#94a3b8">
          что меряем
        </text>
        <text x="300" y="50" fontSize="10" fill="#94a3b8" textAnchor="end">
          допуск
        </text>

        {ROWS.map((row, index) => {
          const y = 56 + index * 23;
          return (
            <g key={row.label}>
              <path d={`M12 ${y} H308`} stroke="#334155" strokeWidth="0.8" />
              <rect x="12" y={y} width="3" height="23" fill={row.color} />
              <text x="20" y={y + 15} fontSize="10" fill="#e2e8f0">
                {row.label}
              </text>
              <text x="300" y={y + 16} fontSize="15" fontWeight="700" fill={row.color} textAnchor="end">
                {row.value}
              </text>
            </g>
          );
        })}
        <path d="M12 148 H308" stroke="#334155" strokeWidth="0.8" />

        <text x="160" y="161" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          поверхность — без расслоений, волн и наплывов
        </text>
        <text x="160" y="171" fontSize="10" fill="#94a3b8" textAnchor="middle">
          допуск задаёшь ты · один на всю партию
        </text>
      </svg>
    </VisualWrapper>
  );
}
