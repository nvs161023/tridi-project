import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const COSTS = [
  { label: "материал", value: 65 },
  { label: "час принтера", value: 48 },
  { label: "электричество", value: 5 },
  { label: "брак", value: 12 },
  { label: "работа", value: 200 },
  { label: "упаковка", value: 40 },
];

/**
 * Кадр блока 23 урока Z2 «Расчёт стоимости и цены».
 *
 * Макет из описания `Z2_calc_sheet.png`: таблица расходов, цена, комиссия,
 * налог и остаток на руки. Числа — блок 25: шесть строк дают 370 ₽, цена
 * 750 ₽, комиссия 113 ₽, налог 30 ₽, остаток 237 ₽ — почти треть цены.
 * Нижняя строка — проверка сложением: 370 + 113 + 30 + 237 = 750 ₽.
 */
export function ProfitZ2Image4({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Таблица расчёта подставки. Расходы: материал 65, час принтера 48, электричество 5, брак 12, работа 200, упаковка 40, итого 370 рублей. Цена 750 рублей, комиссия 113, налог 30, остаток 237 рублей — почти треть цены. Проверка: 370 плюс 113 плюс 30 плюс 237 равно 750"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          таблица расчёта: подставка
        </text>

        <rect x="12" y="24" width="168" height="130" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="20" y="38" fontSize="10" fill="#94a3b8">
          расходы
        </text>
        <text x="172" y="38" fontSize="10" fill="#94a3b8" textAnchor="end">
          ₽
        </text>
        {COSTS.map((cost, i) => {
          const y = 56 + i * 14;
          return (
            <g key={cost.label}>
              <text x="20" y={y} fontSize="10" fill="#e2e8f0">
                {cost.label}
              </text>
              <text x="172" y={y} fontSize="10" fill="#e2e8f0" textAnchor="end">
                {cost.value}
              </text>
            </g>
          );
        })}
        <path d="M20 132 H172" stroke="#334155" strokeWidth="0.7" />
        <text x="20" y="147" fontSize="11" fontWeight="700" fill="#e2e8f0">
          итого
        </text>
        <text x="172" y="147" fontSize="11" fontWeight="700" fill="#fcd34d" textAnchor="end">
          370
        </text>

        <rect x="188" y="24" width="120" height="130" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="196" y="38" fontSize="10" fill="#94a3b8">
          цена
        </text>
        <text x="196" y="58" fontSize="11" fontWeight="700" fill="#fcd34d">
          750 ₽
        </text>
        <text x="196" y="76" fontSize="10" fill="#e2e8f0">
          комиссия
        </text>
        <text x="300" y="76" fontSize="10" fill="#f87171" textAnchor="end">
          −113
        </text>
        <text x="196" y="92" fontSize="10" fill="#e2e8f0">
          налог
        </text>
        <text x="300" y="92" fontSize="10" fill="#f87171" textAnchor="end">
          −30
        </text>
        <path d="M196 100 H300" stroke="#334155" strokeWidth="0.7" />
        <text x="196" y="114" fontSize="10" fill="#94a3b8">
          остаток
        </text>
        <text x="196" y="134" fontSize="16" fontWeight="700" fill="#6ee7b7">
          237 ₽
        </text>
        <text x="196" y="149" fontSize="10" fill="#94a3b8">
          треть цены
        </text>

        <rect x="12" y="158" width="296" height="18" rx="5" fill="#f59e0b" fillOpacity="0.08" stroke="#f59e0b" strokeOpacity="0.3" />
        <text x="160" y="170" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          370 + 113 + 30 + 237 = 750 ₽
        </text>
      </svg>
    </VisualWrapper>
  );
}
