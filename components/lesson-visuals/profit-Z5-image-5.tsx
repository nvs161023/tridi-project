import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const STAGES = [
  { value: "1000", label: "увидели", width: 190, y: 42, color: "#3b82f6" },
  { value: "100", label: "перешли", width: 150, y: 68, color: "#06b6d4" },
  { value: "10", label: "написали", width: 110, y: 94, color: "#f59e0b" },
  { value: "3", label: "купили", width: 70, y: 120, color: "#10b981" },
];

/**
 * Кадр блока 26 урока Z5 «Фото, маркетинг, продвижение».
 *
 * Макет из описания `Z5_funnel.png`: путь от зрителя до покупателя. Числа из
 * блока 26: 1000 увидели, 100 перешли, 10 написали и 3 купили. Десять
 * откликов из тысячи — это 1 % (норма отклика), три покупки — 0,3 % в этом
 * примере. Пять минут в день и десять постов уже дают картину.
 */
export function ProfitZ5Image5({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Воронка от зрителя до покупателя: 1000 увидели, 100 перешли, 10 написали — это 1 процент отклика, 3 купили — это 0,3 процента в примере. Пять минут в день и десять постов уже дают картину. Считать, а не надеяться"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          путь от зрителя до покупателя
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          1000 → 100 → 10 → 3
        </text>

        {STAGES.map((stage) => (
          <g key={stage.value}>
            <rect x="12" y={stage.y} width={stage.width} height="20" rx="4" fill={stage.color} fillOpacity="0.16" stroke={stage.color} />
            <text x="20" y={stage.y + 14} fontSize="10" fill="#e2e8f0">
              <tspan fontSize="12" fontWeight="700" fill={stage.color}>
                {stage.value}
              </tspan>{" "}
              {stage.label}
            </text>
          </g>
        ))}

        <text x="128" y="108" fontSize="10" fontWeight="700" fill="#fbbf24">
          = 1 % от 1000
        </text>

        <rect x="220" y="42" width="90" height="96" rx="7" fill="#0f172a" stroke="#334155" />
        <text x="265" y="64" fontSize="20" fontWeight="700" fill="#fbbf24" textAnchor="middle">
          1 %
        </text>
        <text x="265" y="81" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          норма отклика
        </text>
        <path d="M230 86 H300" stroke="#334155" strokeWidth="0.8" />
        <text x="265" y="102" fontSize="10" fontWeight="700" fill="#34d399" textAnchor="middle">
          0,3 % покупки
        </text>
        <text x="265" y="116" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          3 из 1000
        </text>
        <text x="265" y="132" fontSize="10" fill="#94a3b8" textAnchor="middle">
          это пример
        </text>

        <rect x="12" y="146" width="296" height="18" rx="4" fill="#0f172a" stroke="#334155" />
        <text x="160" y="158.5" fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
          5 минут в день · 10 постов — уже картина
        </text>

        <text x="160" y="172" fontSize="10" fill="#94a3b8" textAnchor="middle">
          считать, а не надеяться
        </text>
      </svg>
    </VisualWrapper>
  );
}
