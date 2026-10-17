import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const ROWS = [
  { name: "амортизация", value: "10 ₽/ч", note: "принтер / 4 000 ч", color: "#3b82f6" },
  { name: "расходники", value: "2 ₽/ч", note: "8 ₽ за 4 часа", color: "#f59e0b" },
  { name: "электричество", value: "≈1 ₽/ч", note: "5 ₽ за 4 часа", color: "#22d3ee" },
  { name: "ремонт", value: "3 000 ₽", note: "апгрейд — из прибыли", color: "#f87171" },
];

/**
 * Кадр блока 10 урока Z2 «Расчёт стоимости и цены».
 *
 * Макет из описания `Z2_machine_hour.png`: из чего складывается час принтера.
 * Числа — блок 9 (0,8 кВт·ч и 5 ₽ за четыре часа), блок 11 (40 000 ₽ /
 * 4 000 ч = 10 ₽/ч; 8 ₽ расходников за четыре часа; итого 12 ₽/ч) и блок 12
 * (ремонт 3 000 ₽). Электричество в уроке считается отдельной строкой, поэтому
 * оно не входит в 12 ₽/ч; ремонт и апгрейд — резерв из прибыли, а не надбавка
 * к часу.
 */
export function ProfitZ2Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Час принтера 12 рублей: амортизация 10 рублей за час при цене принтера 40 000 рублей и сроке 4 000 часов, расходники 2 рубля за час, то есть 8 рублей за четыре часа. Электричество около рубля за час, 5 рублей за четыре часа, считается отдельно. Ремонт 3 000 рублей и апгрейд через три года — резерв из прибыли"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="10" fill="#e2e8f0">
          час принтера: амортизация и расходники
        </text>

        <rect x="12" y="24" width="132" height="140" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        <text x="22" y="50" fontSize="22" fontWeight="700" fill="#fcd34d">
          12 ₽/ч
        </text>
        <text x="22" y="68" fontSize="10" fill="#94a3b8">
          амортизация + расходники
        </text>

        <rect x="22" y="78" width="90" height="12" fill="#3b82f6" />
        <rect x="112" y="78" width="18" height="12" fill="#f59e0b" />
        <text x="67" y="87" fontSize="10" fill="#0f172a" textAnchor="middle">
          10 ₽
        </text>
        <text x="121" y="87" fontSize="10" fill="#0f172a" textAnchor="middle">
          2
        </text>

        <text x="22" y="108" fontSize="10" fill="#e2e8f0">
          40 000 ₽ / 4 000 ч
        </text>
        <text x="22" y="122" fontSize="10" fill="#94a3b8">
          = 10 ₽ за час
        </text>
        <text x="22" y="140" fontSize="10" fill="#e2e8f0">
          8 ₽ за 4 часа
        </text>
        <text x="22" y="154" fontSize="10" fill="#94a3b8">
          = 2 ₽ за час
        </text>

        <rect x="152" y="24" width="156" height="140" rx="7" fill="#0f172a" fillOpacity="0.55" stroke="#334155" />
        {ROWS.map((row, i) => {
          const y = 40 + i * 34;
          return (
            <g key={row.name}>
              {i > 0 ? <path d={`M162 ${y - 8} H298`} stroke="#334155" strokeWidth="0.7" /> : null}
              <circle cx="164" cy={y - 3.5} r="2.3" fill={row.color} />
              <text x="172" y={y} fontSize="10" fill="#e2e8f0">
                {row.name}
              </text>
              <text x="298" y={y} fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="end">
                {row.value}
              </text>
              <text x="172" y={y + 14} fontSize="10" fill="#94a3b8">
                {row.note}
              </text>
            </g>
          );
        })}

        <text x="160" y="172" fontSize="10" fill="#94a3b8" textAnchor="middle">
          электричество и ремонт — отдельными строками
        </text>
      </svg>
    </VisualWrapper>
  );
}
