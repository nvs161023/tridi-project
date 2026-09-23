import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 12 · image «Твой путь» (Модуль 5: Финал).
 *
 * Из описания блока: дорога из пяти этапов — «включил», «выбрал пластик»,
 * «настроил слайсер», «откалибровал», «сделал модель»; в конце флаг «Ты здесь».
 */
const POINTS = [
  { x: 26, y: 152, n: 1, label: ["включил"], lx: 18, ly: 170 },
  { x: 86, y: 116, n: 2, label: ["выбрал", "пластик"], lx: 40, ly: 104 },
  { x: 150, y: 142, n: 3, label: ["настроил", "слайсер"], lx: 106, ly: 126 },
  { x: 214, y: 104, n: 4, label: ["откалибровал"], lx: 168, ly: 92 },
  { x: 284, y: 64, n: 5, label: ["сделал модель"], lx: 214, ly: 56 },
];

export function Basic12Journey({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Карта маршрута из пяти этапов: включил, выбрал пластик, настроил слайсер, откалибровал, сделал модель — с флагом «Ты здесь»"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="12" y="22" fontSize="9" fill="#cbd5e1">
          Дорога из пяти этапов
        </text>
        <path
          d="M26 152 C 50 140 66 128 86 116 C 112 101 130 128 150 142 C 170 155 190 118 214 104 C 236 92 260 80 284 64"
          fill="none"
          stroke="#1e293b"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M26 152 C 50 140 66 128 86 116 C 112 101 130 128 150 142 C 170 155 190 118 214 104 C 236 92 260 80 284 64"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeDasharray="7 7"
        />
        {POINTS.map((point) => (
          <g key={point.n}>
            <circle cx={point.x} cy={point.y} r="7" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="2" />
            <text
              x={point.x}
              y={point.y + 2.5}
              fontSize="6"
              fill="#e2e8f0"
              textAnchor="middle"
              fontWeight="bold"
            >
              {point.n}
            </text>
            {point.label.map((line, k) => (
              <text
                key={line}
                x={point.lx}
                y={point.ly + k * 10}
                fontSize="7.5"
                fill="#cbd5e1"
              >
                {line}
              </text>
            ))}
          </g>
        ))}
        <line x1="284" y1="64" x2="284" y2="28" stroke="#e2e8f0" strokeWidth="2" />
        <polygon points="284,28 312,36 284,44" fill="#ef4444" />
        <text x="234" y="26" fontSize="8" fill="#fca5a5">
          Ты здесь
        </text>
      </svg>
    </VisualWrapper>
  );
}
