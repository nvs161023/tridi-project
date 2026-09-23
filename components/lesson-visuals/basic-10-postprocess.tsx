import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 10 · image «Три этапа доводки» (Модуль 3: Проблемы и решения).
 *
 * Из описания блока: сразу после печати — поддержки, заусенцы, нити; после обработки —
 * поддержки сняты кусачками, заусенцы срезаны ножом, шкурка P200 → P600 → P1000,
 * поверхность матовая; после акриловой краски и лака — гладко и глянцево.
 */
const STEPS = [
  { label: ["после печати"], kind: "raw", raw: true },
  { label: ["кусачки"], kind: "nippers" },
  { label: ["нож"], kind: "knife" },
  { label: ["шкурка", "P200"], kind: "paper", dots: 4 },
  { label: ["P600"], kind: "paper", dots: 7 },
  { label: ["P1000"], kind: "paper", dots: 10 },
  { label: ["акрил и лак"], kind: "painted", final: true },
];

function StepIcon({ kind, dots }: { kind: string; dots?: number }) {
  return (
    <g>
      {kind === "raw" && (
        <>
          <rect x="2" y="4" width="26" height="12" fill="#ef4444" opacity="0.55" />
          <path d="M6 16 v10 M24 16 v10" stroke="#94a3b8" strokeWidth="2" />
          <path d="M0 8 q4 -6 8 0 M22 6 q4 -5 8 1" fill="none" stroke="#f59e0b" />
        </>
      )}
      {kind === "nippers" && (
        <>
          <path d="M2 4 L26 24 M26 4 L2 24" stroke="#93c5fd" strokeWidth="2.5" />
          <rect x="11" y="14" width="6" height="12" fill="#94a3b8" />
        </>
      )}
      {kind === "knife" && (
        <>
          <path d="M2 24 L22 6 L26 10 L6 26 Z" fill="#93c5fd" />
          <rect x="6" y="20" width="22" height="5" fill="#475569" />
          <ellipse cx="14" cy="17" rx="4" ry="2.5" fill="#ef4444" />
        </>
      )}
      {kind === "paper" &&
        Array.from({ length: dots ?? 4 }, (_, i) => (
          <circle
            key={i}
            cx={5 + (i % 5) * 5.5}
            cy={6 + Math.floor(i / 5) * 6}
            r="1.6"
            fill="#93c5fd"
          />
        ))}
      {kind === "paper" && (
        <rect x="2" y="18" width="26" height="8" rx="2" fill="#334155" stroke="#475569" />
      )}
      {kind === "painted" && (
        <>
          <path d="M4 26 V12 q0 -8 12 -8 q12 0 12 8 V26 Z" fill="#1d4ed8" stroke="#3b82f6" />
          <path d="M8 10 q6 -4 14 0" fill="none" stroke="#e0f2fe" strokeWidth="2" opacity="0.8" />
          <circle cx="16" cy="18" r="2" fill="#bfdbfe" />
        </>
      )}
    </g>
  );
}

export function Basic10Postprocess({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Дорожка постобработки: после печати, кусачки, нож, шкурка P200, P600, P1000 и покрытие акрилом с лаком"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="4" y="20" fontSize="8.5" fill="#cbd5e1">
          Три этапа доводки детали
        </text>
        {STEPS.map((step, i) => {
          const x = 4 + i * 46;
          return (
            <g key={step.kind + i}>
              <rect
                x={x}
                y="32"
                width="38"
                height="62"
                rx="4"
                fill="#0f172a"
                stroke={step.raw ? "#f59e0b" : step.final ? "#3b82f6" : "#475569"}
              />
              <g transform={`translate(${x + 5} ${34})`}>
                <StepIcon kind={step.kind} dots={step.dots} />
              </g>
              {step.label.map((line, k) => (
                <text
                  key={line}
                  x={x + 19}
                  y={104 + k * 9}
                  fontSize="6"
                  fill={step.final ? "#93c5fd" : "#e2e8f0"}
                  textAnchor="middle"
                >
                  {line}
                </text>
              ))}
              {i < STEPS.length - 1 && (
                <path
                  d={`M${x + 39} 62 L${x + 44} 62 M${x + 42} 59 L${x + 45} 62 L${x + 42} 65`}
                  fill="none"
                  stroke="#64748b"
                />
              )}
            </g>
          );
        })}
        <text x="4" y="140" fontSize="7" fill="#fcd34d">
          сразу после печати: поддержки, заусенцы, нити
        </text>
        <text x="4" y="152" fontSize="7" fill="#94a3b8">
          после обработки: поддержки сняты кусачками, заусенцы срезаны ножом,
        </text>
        <text x="4" y="162" fontSize="7" fill="#94a3b8">
          шкурка P200 → P600 → P1000, поверхность матовая
        </text>
        <text x="4" y="176" fontSize="7" fill="#93c5fd">
          после акриловой краски и лака: гладко и глянцево, как из магазина
        </text>
      </svg>
    </VisualWrapper>
  );
}
