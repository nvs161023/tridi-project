import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Шкивы: ведущий слева, натяжной справа. */
const PULLEYS = [
  { id: "motor", cx: 56 },
  { id: "tension", cx: 232 },
];

const CY = 98;
const R = 20;
/** Отверстия в диске шкива — чтобы шкив читался как шкив, а не как круг. */
const HOLES = 6;

/** Индикатор звука: короткие дуги над натянутым ремнём. */
const TICKS = [110, 126, 142];

/**
 * Натяжение ремня: винт натяжителя ослаблен — обе ветви ремня провисают дугой,
 * затянут — ремень идёт как струна и звенит. Сравнение «провис/струна» идёт в
 * одном кадре, без второго вида.
 *
 * От A2-image-1 (чертёж узла с размерами) отличается тем, что в кадре нет
 * размерных линий: состояние ремня показано провисом и индикатором звука. От
 * basic-14 (метка на узле) — тем, что ремень меняет форму на глазах.
 */
export function ProC2C25Animation0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Замена ремня: винт натяжителя ослаблен, и обе ветви ремня между шкивами провисают дугой. Когда винт затянут, ремень становится прямой как струна и звенит — над ним появляются метки звука."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <style>{`
.v-c2e-run-a, .v-c2e-run-b { animation: v-c2e-sag 6.4s ease-in-out infinite; }
@keyframes v-c2e-sag {
  0%, 12% { transform: scaleY(0); }
  38%, 62% { transform: scaleY(1); }
  88%, 100% { transform: scaleY(0); }
}
.v-c2e-nut { animation: v-c2e-nut 6.4s ease-in-out infinite; }
@keyframes v-c2e-nut {
  0%, 12% { transform: translateX(-10px); }
  38%, 62% { transform: translateX(0); }
  88%, 100% { transform: translateX(-10px); }
}
.v-c2e-tick { animation: v-c2e-tick 6.4s ease-in-out infinite; }
@keyframes v-c2e-tick {
  0%, 12% { opacity: 1; }
  38%, 62% { opacity: 0.2; }
  88%, 100% { opacity: 1; }
}
.v-c2e-state-a { animation: v-c2e-state-a 6.4s ease-in-out infinite; }
@keyframes v-c2e-state-a {
  0%, 12% { opacity: 1; fill: #34d399; }
  38%, 62% { opacity: 0.35; fill: #64748b; }
  88%, 100% { opacity: 1; fill: #34d399; }
}
.v-c2e-state-b { animation: v-c2e-state-b 6.4s ease-in-out infinite; }
@keyframes v-c2e-state-b {
  0%, 12% { opacity: 0.35; fill: #64748b; }
  38%, 62% { opacity: 1; fill: #f87171; }
  88%, 100% { opacity: 0.35; fill: #64748b; }
}
@media (prefers-reduced-motion: reduce) {
  .v-c2e-run-a, .v-c2e-run-b, .v-c2e-nut, .v-c2e-tick, .v-c2e-state-a, .v-c2e-state-b { animation: none; }
  .v-c2e-run-a, .v-c2e-run-b { transform: scaleY(0); }
  .v-c2e-nut { transform: translateX(-10px); }
  .v-c2e-tick { opacity: 1; }
  .v-c2e-state-a { opacity: 1; fill: #34d399; }
  .v-c2e-state-b { opacity: 0.35; fill: #64748b; }
}
        `}</style>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Натяжение ремня: провис или струна
        </text>
        <text x="12" y="44" fontSize="8" fill="#34d399" className="v-c2e-state-a">
          натянут — звенят как струна
        </text>

        {/* Метки звука над натянутым ремнём */}
        {TICKS.map((x) => (
          <path
            key={`tick-${x}`}
            d={`M${x},68 Q${x + 5},62 ${x},56`}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="v-c2e-tick"
          />
        ))}

        {/* Ремень: ветви и охваты шкивов */}
        <path
          d="M56,76 Q144,112 232,76"
          fill="none"
          stroke="#64748b"
          strokeWidth="4.5"
          className="v-c2e-run-a"
          style={{ transformOrigin: "144px 76px" }}
        />
        <path
          d="M56,120 Q144,148 232,120"
          fill="none"
          stroke="#64748b"
          strokeWidth="4.5"
          className="v-c2e-run-b"
          style={{ transformOrigin: "144px 120px" }}
        />
        <path d="M56,76 A22,22 0 0 0 56,120" fill="none" stroke="#64748b" strokeWidth="4.5" />
        <path d="M232,76 A22,22 0 0 1 232,120" fill="none" stroke="#64748b" strokeWidth="4.5" />
        {/* Шкивы с отверстиями в диске */}
        {PULLEYS.map((pulley) => (
          <g key={pulley.id}>
            <circle cx={pulley.cx} cy={CY} r={R} fill="#334155" stroke="#94a3b8" strokeWidth="1.4" />
            <circle cx={pulley.cx} cy={CY} r={R - 7} fill="#0f172a" stroke="#475569" strokeWidth="1" />
            <circle cx={pulley.cx} cy={CY} r="4.5" fill="#334155" stroke="#94a3b8" strokeWidth="1" />
            {Array.from({ length: HOLES }, (_, i) => {
              const a = (i * Math.PI) / 3;
              return (
                <circle
                  key={`hole-${pulley.id}-${i}`}
                  cx={pulley.cx + (R - 3.5) * Math.cos(a)}
                  cy={CY + (R - 3.5) * Math.sin(a)}
                  r="2.2"
                  fill="#0f172a"
                  stroke="#475569"
                  strokeWidth="0.8"
                />
              );
            })}
          </g>
        ))}

        {/* Натяжитель: кронштейн, винт с резьбой и гайка, которая едет по винту */}
        <line x1="248" y1={CY} x2="262" y2={CY} stroke="#94a3b8" strokeWidth="3" />
        <line x1="262" y1={CY} x2="312" y2={CY} stroke="#94a3b8" strokeWidth="1.6" />
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={`rod-${i}`}
            x1={266 + i * 6}
            y1={CY - 4}
            x2={269 + i * 6}
            y2={CY + 4}
            stroke="#64748b"
            strokeWidth="1"
          />
        ))}
        <rect
          x="284"
          y={CY - 8}
          width="12"
          height="16"
          rx="2"
          fill="#334155"
          stroke="#f59e0b"
          strokeWidth="1.2"
          className="v-c2e-nut"
        />

        <text x="266" y="128" fontSize="8" fill="#e2e8f0">
          винт
        </text>
        <text x="266" y="142" fontSize="8" fill="#e2e8f0">
          натяжителя
        </text>
        <text x="12" y="170" fontSize="8" fill="#64748b" className="v-c2e-state-b">
          ослаблен — ремень провис
        </text>
      </svg>
    </VisualWrapper>
  );
}
