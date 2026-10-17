import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const ROWS = [
  {
    name: "Кашпо",
    price: "450 ₽",
    cost: "176 ₽",
    margin: "274 ₽",
    time: "4 ч",
    hour: "68 ₽/ч",
    hourColor: "#fcd34d",
  },
  {
    name: "Брелок",
    price: "150 ₽",
    cost: "44 ₽",
    margin: "106 ₽",
    time: "20 мин",
    hour: "300 ₽/ч",
    hourColor: "#6ee7b7",
  },
  {
    name: "Крепление",
    price: "250 ₽",
    cost: "86 ₽",
    margin: "164 ₽",
    time: "1,5 ч",
    hour: "≈109 ₽/ч",
    hourColor: "#93c5fd",
  },
  {
    name: "Ваза",
    price: "500 ₽",
    cost: "—",
    margin: "≈300 ₽",
    time: "6 ч",
    hour: "50 ₽/ч",
    hourColor: "#f87171",
  },
];

/**
 * Кадр блока 17 урока Z1 «Что продавать: ниши и маржа».
 *
 * Макет из описания `Z1_margin_table.png`: четыре товара, цена, расходы, маржа,
 * время и остаток за час печати. Числа — блок 18 (кашпо, брелок, крепление)
 * и блок 19 (ваза). Итог расходов вазы в уроке не назван, поэтому в клетке
 * стоит прочерк, а состав расходов вынесен в сноску. Для крепления урок даёт
 * 66 % от цены, но колонка кадра — остаток за час, поэтому здесь стоит
 * расчётное 164 / 1,5 ≈ 109 ₽/ч; процент остаётся в тексте урока.
 */
export function ProfitZ1Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Таблица маржи по четырём товарам. Кашпо: цена 450 рублей, расходы 176, маржа 274, печать 4 часа, 68 рублей за час. Брелок: 150 рублей, расходы 44, маржа 106, 20 минут, 300 рублей за час. Крепление: 250 рублей, расходы 86, маржа 164, полтора часа, около 109 рублей за час. Ваза: 500 рублей, маржа около 300, 6 часов, 50 рублей за час, расходы — материал 120, комиссия 50 и налог 20 рублей. Брелок втрое дешевле кашпо, а за час приносит в пять раз больше"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          маржа: цена, расходы и остаток за час
        </text>

        <rect x="12" y="24" width="296" height="104" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />

        <text x="18" y="38" fontSize="10" fill="#94a3b8">
          товар
        </text>
        <text x="112" y="38" fontSize="10" fill="#94a3b8" textAnchor="end">
          цена
        </text>
        <text x="164" y="38" fontSize="10" fill="#94a3b8" textAnchor="end">
          расходы
        </text>
        <text x="208" y="38" fontSize="10" fill="#94a3b8" textAnchor="end">
          маржа
        </text>
        <text x="250" y="38" fontSize="10" fill="#94a3b8" textAnchor="end">
          время
        </text>
        <text x="304" y="38" fontSize="10" fill="#6ee7b7" textAnchor="end">
          за час
        </text>
        <path d="M18 44 H302" stroke="#334155" strokeWidth="0.8" />

        {ROWS.map((row, i) => {
          const y = 60 + i * 18;
          return (
            <g key={row.name}>
              {i > 0 ? <path d={`M18 ${y - 13} H302`} stroke="#334155" strokeWidth="0.7" /> : null}
              <text x="18" y={y} fontSize="11" fill="#e2e8f0">
                {row.name}
              </text>
              <text x="112" y={y} fontSize="11" fill="#e2e8f0" textAnchor="end">
                {row.price}
              </text>
              <text x="164" y={y} fontSize="11" fill="#94a3b8" textAnchor="end">
                {row.cost}
              </text>
              <text x="208" y={y} fontSize="11" fill="#e2e8f0" textAnchor="end">
                {row.margin}
              </text>
              <text x="250" y={y} fontSize="11" fill="#94a3b8" textAnchor="end">
                {row.time}
              </text>
              <text x="304" y={y} fontSize="11" fontWeight="700" fill={row.hourColor} textAnchor="end">
                {row.hour}
              </text>
            </g>
          );
        })}

        <text x="18" y="140" fontSize="10" fill="#94a3b8">
          ваза: материал 120 + комиссия 50 + налог 20 ₽
        </text>

        <rect x="12" y="146" width="296" height="26" rx="5" fill="#f59e0b" fillOpacity="0.08" stroke="#f59e0b" strokeOpacity="0.3" />
        <text x="22" y="156" fontSize="10" fill="#e2e8f0">
          брелок втрое дешевле кашпо,
        </text>
        <text x="22" y="168" fontSize="10" fill="#e2e8f0">
          а за час приносит в пять раз больше
        </text>
      </svg>
    </VisualWrapper>
  );
}
