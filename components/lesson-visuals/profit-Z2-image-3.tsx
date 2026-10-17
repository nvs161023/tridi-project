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
 * Кадр блока 20 урока Z2 «Расчёт стоимости и цены».
 *
 * Макет из описания `Z2_price_formula.png`: семь строк расходов и множитель
 * наценки. Числа — блок 25: шесть строк себестоимости дают 370 ₽, двойная
 * наценка — 740 ₽, округление до 750 ₽; комиссия 113 ₽ и налог 30 ₽
 * вычитаются из цены, остаток 237 ₽. Седьмая строка — комиссия и налог —
 * стоит после цены, поэтому на схеме она вынесена в нижнюю сноску.
 */
export function ProfitZ2Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Формула цены подставки: себестоимость 370 рублей из шести строк — материал 65, час принтера 48, электричество 5, брак 12, работа 200, упаковка 40. Двойная наценка даёт 740 рублей, округляем до 750. Из цены вычитаются комиссия 113 и налог 30 рублей, остаток 237 рублей. Седьмая строка — комиссия и налог — считается от цены"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          формула цены: от расходов к остатку
        </text>

        <rect x="12" y="24" width="116" height="126" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="20" y="34" fontSize="10" fill="#94a3b8">
          себестоимость
        </text>
        <text x="20" y="56" fontSize="18" fontWeight="700" fill="#e2e8f0">
          370 ₽
        </text>
        {COSTS.map((cost, i) => {
          const y = 76 + i * 14;
          return (
            <g key={cost.label}>
              <text x="20" y={y} fontSize="10" fill="#cbd5e1">
                {cost.label}
              </text>
              <text x="120" y={y} fontSize="10" fill="#e2e8f0" textAnchor="end">
                {cost.value}
              </text>
            </g>
          );
        })}

        <polygon points="128,84 135,79 135,89" fill="#64748b" />
        <rect x="136" y="24" width="62" height="126" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="167" y="36" fontSize="10" fill="#94a3b8" textAnchor="middle">
          наценка
        </text>
        <text x="167" y="68" fontSize="20" fontWeight="700" fill="#fcd34d" textAnchor="middle">
          ×2
        </text>
        <text x="167" y="88" fontSize="13" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          740 ₽
        </text>
        <text x="167" y="106" fontSize="10" fill="#94a3b8" textAnchor="middle">
          округлим
        </text>
        <text x="167" y="124" fontSize="13" fontWeight="700" fill="#fcd34d" textAnchor="middle">
          750 ₽
        </text>

        <polygon points="198,84 205,79 205,89" fill="#64748b" />
        <rect x="206" y="24" width="102" height="126" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="214" y="36" fontSize="10" fill="#94a3b8">
          цена
        </text>
        <text x="214" y="60" fontSize="18" fontWeight="700" fill="#fcd34d">
          750 ₽
        </text>
        <text x="214" y="82" fontSize="10" fill="#e2e8f0">
          комиссия −113
        </text>
        <text x="214" y="96" fontSize="10" fill="#e2e8f0">
          налог −30
        </text>
        <path d="M214 104 H300" stroke="#334155" strokeWidth="0.7" />
        <text x="214" y="118" fontSize="10" fill="#94a3b8">
          остаток
        </text>
        <text x="214" y="138" fontSize="16" fontWeight="700" fill="#6ee7b7">
          237 ₽
        </text>

        <rect x="12" y="154" width="296" height="20" rx="5" fill="#f59e0b" fillOpacity="0.08" stroke="#f59e0b" strokeOpacity="0.3" />
        <text x="20" y="168" fontSize="10" fill="#e2e8f0">
          7-я строка — комиссия и налог — из цены
        </text>
      </svg>
    </VisualWrapper>
  );
}
