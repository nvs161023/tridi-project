import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STEPS = [
  { count: "1 шт", price: "1 110 ₽", note: "работа 200 ₽", x: 16, y: 44, height: 88, color: "#3b82f6" },
  { count: "5 шт", price: "", note: "работа делится", x: 86, y: 56, height: 76, color: "#64748b" },
  { count: "10 шт", price: "", note: "работа делится", x: 156, y: 68, height: 64, color: "#64748b" },
  { count: "20 шт", price: "750 ₽", note: "работа 60 ₽", x: 226, y: 80, height: 52, color: "#10b981" },
];

/**
 * Кадр блока 27 урока Z2 «Расчёт стоимости и цены».
 *
 * Макет из описания `Z2_price_ladder.png`: одна деталь, пять, десять и двадцать
 * штук. В уроке есть точные числа только для одной и двадцати деталей: цена
 * 1 110 → 750 ₽, себестоимость 370 → 230 ₽, работа 200 → 60 ₽, остаток
 * 529 → 377 ₽, заказ на двадцать штук — 7 540 ₽ (блоки 25–28). Для пяти и
 * десяти штук цен нет, поэтому на ступенях стоит только «работа делится»:
 * выдуманных чисел в кадре нет.
 */
export function ProfitZ2Image5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Лестница цен: одна деталь стоит 1 110 рублей, работа 200 рублей; двадцать штук — 750 рублей за штуку, работа 60 рублей. Для пяти и десяти штук известна только закономерность: работа делится на партию. Себестоимость падает с 370 до 230 рублей, остаток — с 529 до 377. Заказ на двадцать штук приносит 7 540 рублей"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          лестница цен: 1, 5, 10 и 20 штук
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          цена за штуку: 1 110 ₽ → 750 ₽
        </text>

        {STEPS.map((step) => (
          <g key={step.count}>
            <rect x={step.x} y={step.y} width="62" height={step.height} rx="6" fill="#0f172a" fillOpacity="0.65" stroke="#334155" />
            <rect x={step.x} y={step.y} width="62" height="3" rx="1.5" fill={step.color} />
            <text x={step.x + 31} y={step.y + 16} fontSize="10" fill="#94a3b8" textAnchor="middle">
              {step.count}
            </text>
            {step.price ? (
              <>
                <text x={step.x + 31} y={step.y + 33} fontSize="13" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
                  {step.price}
                </text>
                <text x={step.x + 31} y={step.y + 48} fontSize="10" fill="#cbd5e1" textAnchor="middle">
                  {step.note}
                </text>
              </>
            ) : (
              <>
                <text x={step.x + 31} y={step.y + 34} fontSize="10" fill="#cbd5e1" textAnchor="middle">
                  работа
                </text>
                <text x={step.x + 31} y={step.y + 49} fontSize="10" fill="#cbd5e1" textAnchor="middle">
                  делится
                </text>
              </>
            )}
          </g>
        ))}

        <path d="M12 140 H308" stroke="#334155" strokeWidth="0.8" />
        <text x="160" y="153" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          себестоимость 370 → 230 ₽ · работа 200 → 60 ₽
        </text>
        <text x="160" y="167" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          остаток 529 → 377 ₽ · заказ 20 шт — 7 540 ₽
        </text>
      </svg>
    </VisualWrapper>
  );
}
