import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 9 · image «Карта дефектов» (Модуль 3: Проблемы и решения).
 *
 * Из описания блока: десять дефектов — «не прилипло», «паутинки», «слои не склеены»,
 * «свисает», «волны», «пропуски», «трещины», «неровные углы», «первый слой тонкий»,
 * «первый слой толстый». Сетка 5×2, у каждого дефекта своя схема.
 */
const DEFECTS = [
  { name: ["не прилипло"], kind: "lift" },
  { name: ["паутинки"], kind: "web" },
  { name: ["слои не", "склеены"], kind: "split" },
  { name: ["свисает"], kind: "droop" },
  { name: ["волны"], kind: "wave" },
  { name: ["пропуски"], kind: "skip" },
  { name: ["трещины"], kind: "crack" },
  { name: ["неровные", "углы"], kind: "corners" },
  { name: ["первый слой", "тонкий"], kind: "thin" },
  { name: ["первый слой", "толстый"], kind: "fat" },
];

function DefectIcon({ kind }: { kind: string }) {
  return (
    <g>
      {kind === "lift" && (
        <>
          <line x1="2" y1="30" x2="42" y2="30" stroke="#475569" strokeWidth="2" />
          <path d="M4 28 C 12 10 30 8 40 14" fill="none" stroke="#ef4444" strokeWidth="2" />
        </>
      )}
      {kind === "web" && (
        <>
          <rect x="2" y="18" width="10" height="14" fill="#3b82f6" />
          <rect x="32" y="18" width="10" height="14" fill="#3b82f6" />
          <path d="M12 22 C 22 14 24 26 32 20" fill="none" stroke="#f59e0b" />
          <path d="M12 27 C 22 32 24 22 32 27" fill="none" stroke="#f59e0b" />
        </>
      )}
      {kind === "split" && (
        <>
          {[8, 18, 28].map((y) => (
            <rect key={y} x="4" y={y} width="36" height="5" fill="#ef4444" />
          ))}
        </>
      )}
      {kind === "droop" && (
        <>
          <rect x="4" y="6" width="36" height="6" fill="#3b82f6" />
          <path d="M6 12 q6 16 12 0 q6 16 12 0" fill="none" stroke="#ef4444" strokeWidth="1.6" />
        </>
      )}
      {kind === "wave" && (
        <path d="M2 20 q7 -12 14 0 t14 0 t14 0" fill="none" stroke="#ef4444" strokeWidth="2" />
      )}
      {kind === "skip" && (
        <path d="M3 20 h10 M20 20 h6 M32 20 h8" fill="none" stroke="#ef4444" strokeWidth="3" />
      )}
      {kind === "crack" && (
        <>
          <rect x="4" y="6" width="36" height="28" fill="#1d4ed8" opacity="0.5" />
          <path d="M20 6 l6 9 l-4 8 l7 11" fill="none" stroke="#ef4444" strokeWidth="2" />
        </>
      )}
      {kind === "corners" && (
        <path
          d="M6 34 q-4 -14 6 -18 q12 -6 22 0 q10 4 6 18"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
        />
      )}
      {kind === "thin" && (
        <>
          <line x1="2" y1="28" x2="42" y2="28" stroke="#475569" strokeWidth="2" />
          <rect x="8" y="24" width="28" height="2" fill="#3b82f6" />
        </>
      )}
      {kind === "fat" && (
        <>
          <line x1="2" y1="30" x2="42" y2="30" stroke="#475569" strokeWidth="2" />
          <ellipse cx="22" cy="24" rx="16" ry="7" fill="#ef4444" />
        </>
      )}
    </g>
  );
}

export function Basic09Defects({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карта из десяти дефектов: не прилипло, паутинки, слои не склеены, свисает, волны, пропуски, трещины, неровные углы, тонкий и толстый первый слой"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="8" y="16" fontSize="8" fill="#cbd5e1">
          Карта дефектов: десять самых частых
        </text>
        {DEFECTS.map((defect, i) => {
          const x = 8 + (i % 5) * 62;
          const y = 24 + Math.floor(i / 5) * 74;
          return (
            <g key={defect.kind}>
              <rect x={x} y={y} width="56" height="70" rx="4" fill="#0f172a" stroke="#475569" />
              <g transform={`translate(${x + 7} ${y + 6})`}>
                <DefectIcon kind={defect.kind} />
              </g>
              {defect.name.map((line, k) => (
                <text
                  key={line}
                  x={x + 28}
                  y={y + 57 + k * 9}
                  fontSize="6.5"
                  fill="#e2e8f0"
                  textAnchor="middle"
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </VisualWrapper>
  );
}
