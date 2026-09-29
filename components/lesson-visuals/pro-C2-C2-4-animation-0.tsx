import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Жилы левого и правого провода: макро, поэтому линия = одна жила. */
const STRANDS_LEFT = [79, 85, 91, 97, 103];
const STRANDS_RIGHT = [80, 86, 92, 98, 104];

/** Фронт затекания припоя вдоль жил (капилляр). */
const WICKS = [80, 86, 92, 98, 104];

/** Штриховая нарезка внутри изоляции: разрез. */
const HATCH_LEFT = [22, 30, 38];
const HATCH_RIGHT = [214, 222, 230];

/**
 * Пайка: макро-разрез одного соединения. Видно не сцену вокруг, а нутро стыка —
 * припой садится каплей, затекает по капилляру в жилы и сверху садится
 * термоусадка. Это единственный кадр курса про затекание припоя.
 *
 * От K-K2-image (оболочки поверх контура) отличается тем, что снаружи ничего не
 * появляется слоями на силуэте — весь кадр занимает разрез провода. От L-L4
 * (перетаскивание элементов) — тем, что процесс идёт сам, без перетаскивания.
 */
export function ProC2C24Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пайка в разрезе: два провода в изоляции сращены жилами. Капля припоя садится на стык, растекается и затекает по капилляру в жилы вдоль провода, затем сверху садится термоусадка и обжимает соединение."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
.v-c2d-solder { animation: v-c2d-solder 6s ease-in-out infinite; }
@keyframes v-c2d-solder {
  0% { transform: scale(0.22); opacity: 0.35; }
  18% { transform: scale(1.05, 1.18); opacity: 1; }
  42%, 78% { transform: scale(1.16, 0.86); opacity: 1; }
  92%, 100% { transform: scale(0.22); opacity: 0.35; }
}
.v-c2d-wick { animation: v-c2d-wick 6s ease-out infinite; }
@keyframes v-c2d-wick {
  0%, 20% { transform: scaleX(0); opacity: 0; }
  42%, 88% { transform: scaleX(1); opacity: 1; }
  100% { transform: scaleX(0); opacity: 0; }
}
.v-c2d-tube { animation: v-c2d-tube 6s ease-in-out infinite; }
@keyframes v-c2d-tube {
  0%, 52% { transform: scaleY(1); fill-opacity: 0.18; }
  74%, 100% { transform: scaleY(0.72); fill-opacity: 0.75; }
}
@media (prefers-reduced-motion: reduce) {
  .v-c2d-solder { animation: none; transform: scale(1.16, 0.86); opacity: 1; }
  .v-c2d-wick { animation: none; transform: scaleX(1); opacity: 1; }
  .v-c2d-tube { animation: none; transform: scaleY(0.72); fill-opacity: 0.75; }
}
        `}</style>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Пайка в разрезе: припой в жилах
        </text>

        {/* Изоляция левого и правого провода */}
        <rect x="12" y="76" width="104" height="30" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
        {HATCH_LEFT.map((x) => (
          <line key={`hatch-l-${x}`} x1={x} y1="80" x2={x + 10} y2="102" stroke="#475569" strokeWidth="1" />
        ))}
        <rect x="204" y="76" width="104" height="30" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="1.2" />
        {HATCH_RIGHT.map((x) => (
          <line key={`hatch-r-${x}`} x1={x} y1="80" x2={x + 10} y2="102" stroke="#475569" strokeWidth="1" />
        ))}

        {/* Жилы: слева и справа, в стыке переплетены */}
        {STRANDS_LEFT.map((y) => (
          <line
            key={`strand-l-${y}`}
            x1="96"
            y1={y}
            x2="168"
            y2={y}
            stroke="#b45309"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        ))}
        {STRANDS_RIGHT.map((y) => (
          <line
            key={`strand-r-${y}`}
            x1="148"
            y1={y}
            x2="224"
            y2={y}
            stroke="#b45309"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        ))}
        {/* Капля припоя на стыке: сначала садится, потом растекается по жилам */}
        <ellipse
          cx="158"
          cy="91"
          rx="24"
          ry="15"
          fill="#cbd5e1"
          stroke="#94a3b8"
          strokeWidth="1"
          className="v-c2d-solder"
          style={{ transformOrigin: "158px 91px" }}
        />

        {/* Капилляр: припой уходит в жилы вдоль провода */}
        <g className="v-c2d-wick" style={{ transformOrigin: "158px 91px" }}>
          {WICKS.map((y) => (
            <line
              key={`wick-${y}`}
              x1="110"
              y1={y}
              x2="206"
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Термоусадка: надета трубой и садится на стык */}
        <g className="v-c2d-tube" style={{ transformOrigin: "158px 92px" }}>
          <rect
            x="128"
            y="68"
            width="60"
            height="48"
            rx="8"
            fill="#334155"
            fillOpacity="0.18"
            stroke="#64748b"
            strokeWidth="1.2"
          />
        </g>

        <text x="124" y="54" fontSize="8" fill="#e2e8f0">
          жилы
        </text>
        <text x="16" y="122" fontSize="8" fill="#94a3b8">
          изоляция
        </text>
        <text x="16" y="152" fontSize="8" fill="#e2e8f0">
          припой затекает — капилляр
        </text>
        <text x="198" y="152" fontSize="8" fill="#e2e8f0">
          термоусадка села
        </text>
        <text x="16" y="170" fontSize="8" fill="#94a3b8">
          макро: разрез одного соединения
        </text>
      </svg>
    </VisualWrapper>
  );
}
