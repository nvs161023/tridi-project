import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Как двигается CoreXY — четыре фазы движения из content урока: оба мотора тянут
 * одинаково — голова едет по X, в разные стороны — по Y, один мотор — по
 * диагонали. Справа три подписи, и они загораются по очереди вместе с движением
 * каретки: видно, какая фраза урока какой ход объясняет.
 *
 * От «Трёх схем кинематики» того же урока отличается задачей: там статичное
 * сравнение трёх машин, здесь одна машина и её ход во времени — поэтому и
 * композиция другая: крупная рама сверху слева плюс список фаз справа.
 *
 * Анимация 3 с, по кругу. При prefers-reduced-motion каретка стоит по центру и
 * подсвечена первая фаза.
 *
 * Классы с префиксом v-pa2a: <style> внутри SVG действует на всю страницу.
 */
export function ProAA2Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Анимация: два мотора тянут ремни CoreXY — тянут одинаково, и голова едет по X, тянут в разные стороны — по Y, тянет один — по диагонали; секрет в лёгкой голове, поэтому развороты быстрые"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
        <style>{`
          .v-pa2a-carriage { animation: v-pa2a-move 3s ease-in-out infinite; }
          .v-pa2a-one { animation: v-pa2a-hot 3s ease-in-out infinite; }
          .v-pa2a-two { animation: v-pa2a-hot 3s ease-in-out infinite; animation-delay: 1s; }
          .v-pa2a-three { animation: v-pa2a-hot 3s ease-in-out infinite; animation-delay: 2s; }
          @keyframes v-pa2a-move {
            0%, 4% { transform: translate(-26px, 0); }
            30% { transform: translate(26px, 0); }
            36% { transform: translate(0, -20px); }
            63% { transform: translate(0, 20px); }
            69% { transform: translate(-18px, -16px); }
            96% { transform: translate(18px, 16px); }
            100% { transform: translate(-26px, 0); }
          }
          @keyframes v-pa2a-hot {
            0%, 28% { fill: #fbbf24; stroke: #fbbf24; }
            34%, 100% { fill: #64748b; stroke: #64748b; }
          }
          @media (prefers-reduced-motion: reduce) {
            .v-pa2a-carriage { animation: none; }
            .v-pa2a-one, .v-pa2a-two, .v-pa2a-three {
              animation: none;
              fill: #fbbf24;
              stroke: #fbbf24;
            }
            .v-pa2a-two, .v-pa2a-three { fill: #64748b; stroke: #64748b; }
          }
        `}</style>

        <rect
          x="0.5"
          y="0.5"
          width="319"
          height="179"
          rx="12"
          fill="#1e293b"
          fillOpacity="0.5"
          stroke="#475569"
        />

        {/* Рама CoreXY сверху: четыре шкива по углам и ремни крест-накрест */}
        <rect x="28" y="44" width="176" height="100" fill="#1e293b" stroke="#475569" />
        <line x1="28" y1="44" x2="204" y2="144" stroke="#94a3b8" />
        <line x1="204" y1="44" x2="28" y2="144" stroke="#94a3b8" />
        <circle cx="28" cy="44" r="5" fill="#334155" />
        <circle cx="204" cy="44" r="5" fill="#334155" />
        <circle cx="28" cy="144" r="5" fill="#334155" />
        <circle cx="204" cy="144" r="5" fill="#334155" />

        {/* Два мотора: A и B */}
        <rect x="16" y="18" width="18" height="12" rx="2" fill="#334155" stroke="#94a3b8" />
        <text x="25" y="27" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          A
        </text>
        <rect x="198" y="18" width="18" height="12" rx="2" fill="#334155" stroke="#94a3b8" />
        <text x="207" y="27" fontSize="10" fill="#e2e8f0" textAnchor="middle">
          B
        </text>

        {/* Каретка с соплом — она и ходит по фазам */}
        <g className="v-pa2a-carriage">
          <rect x="104" y="85" width="24" height="18" rx="3" fill="#334155" stroke="#f59e0b" />
          <circle cx="116" cy="100" r="2.6" fill="#f59e0b" />
        </g>

        {/* Подписи фаз: загораются по очереди */}
        <line x1="226" y1="56" x2="238" y2="56" stroke="#64748b" strokeWidth="1.4" className="v-pa2a-one" />
        <polygon points="238,53 244,56 238,59" fill="#64748b" className="v-pa2a-one" />
        <text x="250" y="60" fontSize="10" fill="#64748b" className="v-pa2a-one">
          оба — по X
        </text>
        <line x1="232" y1="76" x2="232" y2="88" stroke="#64748b" strokeWidth="1.4" className="v-pa2a-two" />
        <polygon points="229,88 235,88 232,94" fill="#64748b" className="v-pa2a-two" />
        <text x="250" y="90" fontSize="10" fill="#64748b" className="v-pa2a-two">
          врозь — по Y
        </text>
        <line x1="226" y1="120" x2="236" y2="110" stroke="#64748b" strokeWidth="1.4" className="v-pa2a-three" />
        <polygon points="234,108 240,112 232,116" fill="#64748b" className="v-pa2a-three" />
        <text x="250" y="120" fontSize="10" fill="#64748b" className="v-pa2a-three">
          диагональ
        </text>

        <text x="28" y="166" fontSize="10" fill="#94a3b8">
          лёгкая голова — быстрые ходы
        </text>
      </svg>
    </VisualWrapper>
  );
}
