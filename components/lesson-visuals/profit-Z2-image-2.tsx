import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const BASE = 118;
const MAX = 142;
const CHART_HEIGHT = 84;
const BASELINE = 132;

const BARS = [
  { rate: 5, add: 6, total: 124, color: "#f87171" },
  { rate: 10, add: 12, total: 130, color: "#f87171" },
  { rate: 20, add: 24, total: 142, color: "#f87171" },
];

/**
 * Кадр блока 15 урока Z2 «Расчёт стоимости и цены».
 *
 * Макет из описания `Z2_fail_rate.png`: как доля брака меняет цену партии.
 * База 118 ₽ — материал 65, час принтера 48 и электричество 5 (блок 25).
 * Десять процентов дают 12 ₽ — это число урока (блок 14); пять и двадцать
 * процентов посчитаны от той же базы: 6 и 24 ₽. Итоги 124, 130 и 142 ₽ —
 * арифметика, а не новые ставки. Внизу — двадцать деталей и две перепечатки
 * из блока 14.
 */
export function ProfitZ2Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Процент брака: база 118 рублей — материал 65, час принтера 48 и электричество 5. При пяти процентах брака добавляется 6 рублей, итого 124. При десяти процентах — 12 рублей, итого 130. При двадцати процентах — 24 рубля, итого 142. На партии в двадцать деталей это две перепечатки в запасе"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          брак: 5, 10 и 20 % партии
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          база 118 ₽: материал 65 + час 48 + электричество 5
        </text>

        {BARS.map((bar, i) => {
          const center = 60 + i * 96;
          const x = center - 36;
          const totalHeight = (bar.total / MAX) * CHART_HEIGHT;
          const baseHeight = (BASE / MAX) * CHART_HEIGHT;
          const addHeight = totalHeight - baseHeight;
          const baseY = BASELINE - baseHeight;
          const addY = baseY - addHeight;
          return (
            <g key={bar.rate}>
              <text x={center} y="44" fontSize="11" fontWeight="700" fill={bar.color} textAnchor="middle">
                {bar.rate} %
              </text>
              <rect x={x} y={baseY} width="72" height={baseHeight} fill="#1d4ed8" fillOpacity="0.5" stroke="#3b82f6" strokeOpacity="0.65" />
              <rect x={x} y={addY} width="72" height={addHeight} fill={bar.color} />
              <text x={center} y="108" fontSize="10" fill="#bfdbfe" textAnchor="middle">
                118 ₽
              </text>
              <text x={center} y="146" fontSize="10" fill={bar.color} textAnchor="middle">
                +{bar.add} ₽
              </text>
              <text x={center} y="160" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
                итого {bar.total} ₽
              </text>
            </g>
          );
        })}

        <path d={`M12 ${BASELINE} H308`} stroke="#475569" strokeWidth="0.8" />
        <text x="160" y="174" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          20 деталей → 2 перепечатки в запасе
        </text>
      </svg>
    </VisualWrapper>
  );
}
