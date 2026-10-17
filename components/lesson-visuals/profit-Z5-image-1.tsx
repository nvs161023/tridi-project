import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

const SHOTS = [
  { label: "фронт", color: "#3b82f6", x: 12 },
  { label: "3/4", color: "#06b6d4", x: 72 },
  { label: "сверху", color: "#8b5cf6", x: 132 },
  { label: "крупно", color: "#f59e0b", x: 192 },
  { label: "масштаб", color: "#10b981", x: 252 },
];

const METRICS = [
  { value: "20–30 кадров", detail: "на деталь" },
  { value: "5–6 лучших", detail: "в карточку" },
  { value: "10 минут", detail: "на партию" },
];

/**
 * Кадр блока 9 урока Z5 «Фото, маркетинг, продвижение».
 *
 * Макет из описания `Z5_shot_list.png`: кадровый лист одной партии. Пять
 * ракурсов из блока 9, на деталь уходит 20–30 кадров, в карточку отбирают 5–6
 * лучших, весь заход занимает около десяти минут. Партия снимается одним
 * светом, одним фоном и одним набором ракурсов.
 */
export function ProfitZ5Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Кадровый лист партии: пять ракурсов — фронт, три четверти, сверху, крупный план и масштаб. На одну деталь 20–30 кадров, в карточку отбирают 5–6 лучших, на партию уходит около 10 минут. Партия снимается одним светом, одним фоном и одним набором ракурсов"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="15" fontSize="11" fontWeight="700" fill="#e2e8f0">
          кадровый лист партии
        </text>
        <text x="12" y="29" fontSize="10" fill="#94a3b8">
          пять ракурсов · один заход
        </text>

        {SHOTS.map((shot) => {
          const cx = shot.x + 28;
          return (
            <g key={shot.label}>
              <rect x={shot.x} y="38" width="56" height="64" rx="6" fill="#0f172a" stroke="#334155" />
              <rect x={shot.x} y="38" width="56" height="3" rx="1.5" fill={shot.color} />

              {shot.label === "фронт" ? (
                <g>
                  <rect x={cx - 10} y="61" width="20" height="25" rx="3" fill="#3b82f6" fillOpacity="0.16" stroke="#60a5fa" />
                  <path d={`M${cx + 10} 67 C${cx + 19} 67 ${cx + 19} 79 ${cx + 10} 79`} fill="none" stroke="#60a5fa" strokeWidth="1.4" />
                  <path d={`M${cx - 10} 64 H${cx + 10}`} stroke="#93c5fd" strokeWidth="0.8" />
                </g>
              ) : null}

              {shot.label === "3/4" ? (
                <g transform={`rotate(-14 ${cx} 73)`}>
                  <rect x={cx - 10} y="61" width="20" height="25" rx="3" fill="#06b6d4" fillOpacity="0.14" stroke="#22d3ee" />
                  <path d={`M${cx + 10} 67 C${cx + 18} 67 ${cx + 18} 79 ${cx + 10} 79`} fill="none" stroke="#22d3ee" strokeWidth="1.4" />
                </g>
              ) : null}

              {shot.label === "сверху" ? (
                <g>
                  <circle cx={cx} cy="73" r="12" fill="#8b5cf6" fillOpacity="0.14" stroke="#a78bfa" />
                  <circle cx={cx} cy="73" r="5" fill="#0f172a" stroke="#c4b5fd" />
                  <rect x={cx + 11} y="68" width="6" height="10" rx="2" fill="#8b5cf6" fillOpacity="0.2" stroke="#a78bfa" />
                </g>
              ) : null}

              {shot.label === "крупно" ? (
                <g>
                  <path d={`M${cx - 14} 88 Q${cx - 14} 58 ${cx + 2} 58 Q${cx + 14} 58 ${cx + 14} 68`} fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
                  <circle cx={cx + 8} cy="61" r="5" fill="#0f172a" stroke="#fbbf24" />
                  <path d={`M${cx + 12} 65 L${cx + 16} 69`} stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round" />
                </g>
              ) : null}

              {shot.label === "масштаб" ? (
                <g>
                  <rect x={cx - 17} y="66" width="34" height="14" rx="2" fill="#10b981" fillOpacity="0.12" stroke="#34d399" />
                  {[0, 1, 2, 3, 4].map((tick) => (
                    <path key={tick} d={`M${cx - 13 + tick * 7} 66 V${tick % 2 === 0 ? 74 : 71}`} stroke="#6ee7b7" strokeWidth="0.8" />
                  ))}
                  <rect x={cx + 13} y="58" width="8" height="8" rx="4" fill="#10b981" fillOpacity="0.2" stroke="#34d399" />
                </g>
              ) : null}

              <text x={cx} y="114" fontSize="10" fill="#e2e8f0" textAnchor="middle">
                {shot.label}
              </text>
            </g>
          );
        })}

        <rect x="12" y="120" width="296" height="18" rx="4" fill="#0f172a" stroke="#334155" />
        <text x="160" y="132.5" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          один свет · один фон · один набор ракурсов
        </text>

        {METRICS.map((metric, index) => {
          const x = 12 + index * 102;
          return (
            <g key={metric.value}>
              <rect x={x} y="142" width="92" height="28" rx="4" fill="#0f172a" stroke="#334155" />
              <text x={x + 46} y="152" fontSize="10" fontWeight="700" fill={index === 1 ? "#34d399" : "#e2e8f0"} textAnchor="middle">
                {metric.value}
              </text>
              <text x={x + 46} y="167" fontSize="10" fill="#94a3b8" textAnchor="middle">
                {metric.detail}
              </text>
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
