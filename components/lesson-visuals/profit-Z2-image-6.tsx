import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const BARS = [
  { label: "старт", value: 0, x: 24, height: 0, color: "#64748b" },
  { label: "1 мес", value: 20000, x: 62, height: 29.3, color: "#3b82f6" },
  { label: "2 мес", value: 40000, x: 100, height: 58.7, color: "#3b82f6" },
  { label: "3 мес", value: 60000, x: 138, height: 88, color: "#10b981" },
];

/**
 * Кадр блока 31 урока Z2 «Расчёт стоимости и цены».
 *
 * Макет из описания `Z2_break_even.png`: вложения и остаток по месяцам. Числа —
 * блок 30: вложения 55 000 ₽ (принтер 40 000 + оснастка 15 000), средний
 * остаток 250 ₽ с детали, 220 деталей до нуля, 80 деталей в месяц дают около
 * 20 000 ₽ остатка; на третьем месяце накопленные 60 000 ₽ закрывают 55 000 ₽.
 * Внизу — второй способ: 55 000 / 12 ₽ за час = 4 600 часов, при трёх часах в
 * день это четыре года.
 */
export function ProfitZ2Image6({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Окупаемость принтера: вложения 55 000 рублей, из них принтер 40 000 и оснастка 15 000. Средний остаток 250 рублей с детали, до нуля нужно 220 деталей. При 80 деталях в месяц накапливается около 20 000 рублей: 20, 40 и 60 тысяч за три месяца, на третьем месяце вложения закрыты. Второй способ: 55 000 делить на 12 рублей за час — 4 600 часов, при трёх часах в день это четыре года"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          окупаемость: 55 000 ₽ вложений
        </text>

        <path d="M14 130 H170" stroke="#475569" strokeWidth="0.8" />
        <path d="M14 49 H170" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.75" />
        <text x="14" y="45" fontSize="10" fill="#fcd34d">
          55 000 ₽
        </text>

        {BARS.map((bar) => (
          <g key={bar.label}>
            {bar.height > 0 ? (
              <rect x={bar.x} y={130 - bar.height} width="28" height={bar.height} rx="2" fill={bar.color} />
            ) : (
              <rect x={bar.x} y="128" width="28" height="2" fill={bar.color} />
            )}
            <text x={bar.x + 14} y="145" fontSize="10" fill="#94a3b8" textAnchor="middle">
              {bar.label}
            </text>
          </g>
        ))}
        <text x="76" y="97" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          20 000
        </text>
        <text x="114" y="68" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          40 000
        </text>
        <text x="152" y="39" fontSize="10" fill="#6ee7b7" textAnchor="middle">
          60 000
        </text>

        <rect x="178" y="28" width="130" height="112" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="188" y="46" fontSize="12" fontWeight="700" fill="#e2e8f0">
          220 деталей
        </text>
        <text x="188" y="60" fontSize="10" fill="#94a3b8">
          до нуля
        </text>
        <text x="188" y="78" fontSize="10" fill="#e2e8f0">
          80 деталей/мес
        </text>
        <text x="188" y="92" fontSize="10" fill="#e2e8f0">
          250 ₽ с детали
        </text>
        <text x="188" y="106" fontSize="10" fill="#fcd34d">
          = 20 000 ₽/мес
        </text>
        <text x="188" y="126" fontSize="10" fontWeight="700" fill="#6ee7b7">
          третий месяц
        </text>

        <rect x="12" y="152" width="296" height="18" rx="5" fill="#f59e0b" fillOpacity="0.08" stroke="#f59e0b" strokeOpacity="0.3" />
        <text x="160" y="164" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          55 000 / 12 ₽ = 4 600 ч · при 3 ч/день — 4 года
        </text>
      </svg>
    </VisualWrapper>
  );
}
