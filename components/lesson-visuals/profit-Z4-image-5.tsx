import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const TOP_TESTS = [
  { title: "разрыв", value: "≈5 кг", x: 12, color: "#3b82f6" },
  { title: "сжатие", value: "груз сверху", x: 112, color: "#f59e0b" },
  { title: "удар", value: "1,2 м", x: 212, color: "#f87171" },
];

/**
 * Кадр блока 28 урока Z4 «Серия: повторяемость, QC, допуски».
 *
 * Макет из описания `Z4_strength_tests.png`: разрыв, сжатие и сброс с высоты
 * из блока 26, плюс изгиб и кручение из списка блока 27. В списке шесть
 * пунктов при заголовке «Пять домашних тестов», поэтому запись результата
 * вынесена в подвал, а не считается шестым тестом. Числа: бутылка на пять
 * литров весит около пяти килограммов, высота сброса — 1,2 метра.
 */
export function ProfitZ4Image5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пять домашних тестов прочности: разрыв грузом около пяти килограммов, сжатие грузом сверху, удар с высоты 1,2 метра, изгиб руками и кручение с проверкой посадки. Результат записать в паспорт, тестировать отдельную деталь, а не деталь для клиента"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          домашние тесты прочности
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          пять тестов · тестовая деталь
        </text>

        {TOP_TESTS.map((test, index) => (
          <g key={test.title}>
            <rect x={test.x} y="38" width="96" height="68" rx="6" fill="#0f172a" stroke="#334155" />
            <rect x={test.x} y="38" width="96" height="3" rx="1.5" fill={test.color} />

            {index === 0 ? (
              <g>
                <path d={`M${test.x + 22} 47 H${test.x + 74}`} stroke="#64748b" strokeWidth="1.2" />
                <path d={`M${test.x + 48} 47 V58`} stroke="#94a3b8" strokeWidth="1" />
                <rect x={test.x + 42} y="58" width="12" height="8" rx="1.5" fill="#3b82f6" fillOpacity="0.35" stroke="#60a5fa" />
              </g>
            ) : null}

            {index === 1 ? (
              <g>
                <path d={`M${test.x + 30} 64 H${test.x + 66}`} stroke="#64748b" strokeWidth="1.2" />
                <rect x={test.x + 38} y="54" width="20" height="10" rx="1.5" fill="#f59e0b" fillOpacity="0.25" stroke="#fbbf24" />
                <path d={`M${test.x + 48} 43 V52`} stroke="#fbbf24" strokeWidth="1.2" />
                <path d={`M${test.x + 45} 49 L${test.x + 48} 52 L${test.x + 51} 49`} fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ) : null}

            {index === 2 ? (
              <g>
                <path d={`M${test.x + 28} 66 H${test.x + 68}`} stroke="#64748b" strokeWidth="1.2" />
                <rect x={test.x + 44} y="51" width="8" height="8" rx="1" fill="#f87171" fillOpacity="0.3" stroke="#fca5a5" />
                <path d={`M${test.x + 48} 41 V48`} stroke="#fca5a5" strokeWidth="1.2" />
                <path d={`M${test.x + 45} 45 L${test.x + 48} 48 L${test.x + 51} 45`} fill="none" stroke="#fca5a5" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d={`M${test.x + 63} 41 V66`} stroke="#64748b" strokeWidth="0.8" strokeDasharray="2 2" />
              </g>
            ) : null}

            <text x={test.x + 48} y="80" fontSize="10" fill="#e2e8f0" textAnchor="middle">
              {test.title}
            </text>
            <text x={test.x + 48} y="96" fontSize="12" fontWeight="700" fill={test.color} textAnchor="middle">
              {test.value}
            </text>
          </g>
        ))}

        <rect x="12" y="112" width="146" height="34" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="20" y="126" fontSize="10" fill="#e2e8f0">
          изгиб
        </text>
        <text x="20" y="140" fontSize="10" fill="#94a3b8">
          согнуть руками
        </text>

        <rect x="162" y="112" width="146" height="34" rx="5" fill="#0f172a" stroke="#334155" />
        <text x="170" y="126" fontSize="10" fill="#e2e8f0">
          кручение
        </text>
        <text x="170" y="140" fontSize="10" fill="#94a3b8">
          скрутить · посадка
        </text>

        <text x="160" y="160" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          запись результата — в паспорт
        </text>
        <text x="160" y="173" fontSize="10" fill="#94a3b8" textAnchor="middle">
          тестируй отдельные детали, не для клиента
        </text>
      </svg>
    </VisualWrapper>
  );
}
