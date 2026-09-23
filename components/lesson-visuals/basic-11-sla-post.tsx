import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 11 · image «Постобработка SLA» (Модуль 4: Знакомство со SLA).
 *
 * Из описания блока: промывка в изопропиле, UV-камера, снятие поддержек и готовая
 * миниатюра — под каждым шагом указано время.
 */
const STEPS = [
  { label: ["промывка в", "изопропиле"], time: "2–3 минуты", kind: "wash" },
  { label: ["сушка"], time: "30 минут", kind: "dry" },
  { label: ["UV-камера"], time: "2–5 минут на сторону", kind: "uv" },
  { label: ["снятие", "поддержек"], time: "", kind: "support" },
  { label: ["готовая", "миниатюра"], time: "покраска", kind: "done" },
];

function PostIcon({ kind }: { kind: string }) {
  return (
    <g>
      {kind === "wash" && (
        <>
          <path d="M2 10 V24 H30 V10" fill="none" stroke="#64748b" strokeWidth="2" />
          <rect x="3" y="14" width="26" height="10" fill="#3b82f6" opacity="0.3" />
          <circle cx="16" cy="18" r="4" fill="#93c5fd" />
        </>
      )}
      {kind === "dry" && (
        <>
          <rect x="6" y="14" width="20" height="12" fill="#3b82f6" opacity="0.5" />
          <path d="M4 10 q5 -5 10 0 t10 0" fill="none" stroke="#93c5fd" />
          <path d="M4 4 q5 -5 10 0 t10 0" fill="none" stroke="#93c5fd" opacity="0.6" />
        </>
      )}
      {kind === "uv" && (
        <>
          <rect x="2" y="4" width="28" height="24" rx="2" fill="none" stroke="#f59e0b" />
          {[8, 16, 24].map((x) => (
            <line key={x} x1={x} y1="8" x2={x} y2="20" stroke="#f59e0b" strokeDasharray="3 2" />
          ))}
          <rect x="10" y="20" width="12" height="6" fill="#3b82f6" opacity="0.6" />
        </>
      )}
      {kind === "support" && (
        <>
          <rect x="6" y="4" width="20" height="10" fill="#3b82f6" opacity="0.6" />
          <path d="M8 14 v12 M24 14 v12" stroke="#94a3b8" strokeWidth="2" />
          <path d="M2 6 L14 26 M28 6 L16 26" stroke="#93c5fd" strokeWidth="2" />
        </>
      )}
      {kind === "done" && (
        <>
          <circle cx="16" cy="10" r="6" fill="#93c5fd" />
          <rect x="9" y="16" width="14" height="12" rx="2" fill="#1d4ed8" stroke="#3b82f6" />
          <path d="M11 20 q5 -3 10 0" fill="none" stroke="#e0f2fe" />
        </>
      )}
    </g>
  );
}

export function Basic11SlaPost({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пять шагов постобработки SLA с временем: промывка в изопропиле, сушка, UV-камера, снятие поддержек, готовая миниатюра"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="8" y="22" fontSize="8.5" fill="#cbd5e1">
          Постобработка SLA: пять шагов
        </text>
        {STEPS.map((step, i) => {
          const x = 8 + i * 64;
          return (
            <g key={step.kind}>
              <rect x={x} y="34" width="52" height="66" rx="4" fill="#0f172a" stroke="#475569" />
              <g transform={`translate(${x + 10} ${38})`}>
                <PostIcon kind={step.kind} />
              </g>
              {step.label.map((line, k) => (
                <text
                  key={line}
                  x={x + 26}
                  y={112 + k * 10}
                  fontSize="6.5"
                  fill="#e2e8f0"
                  textAnchor="middle"
                >
                  {line}
                </text>
              ))}
              {step.time ? (
                <text
                  x={x + 26}
                  y={140 + (step.label.length > 2 ? 10 : 0)}
                  fontSize="6.5"
                  fill="#fcd34d"
                  textAnchor="middle"
                >
                  {step.time}
                </text>
              ) : null}
              {i < STEPS.length - 1 && (
                <path
                  d={`M${x + 53} 66 L${x + 60} 66 M${x + 57} 63 L${x + 61} 66 L${x + 57} 69`}
                  fill="none"
                  stroke="#64748b"
                />
              )}
            </g>
          );
        })}
        <text x="8" y="166" fontSize="7" fill="#94a3b8">
          сначала смываем остатки смолы, затем дозасветка UV и снятие поддержек
        </text>
      </svg>
    </VisualWrapper>
  );
}
