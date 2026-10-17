import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type Mark = {
  n: string;
  x: number;
  y: number;
  label: string;
  color: string;
};

/** Четыре узла принтера под инженерные пластики, цифры из блоков 11–12. */
const MARKS: Mark[] = [
  { n: "1", x: 122, y: 62, label: "хотэнд 300 °C", color: "#f87171" },
  { n: "2", x: 30, y: 42, label: "камера 80 °C", color: "#f59e0b" },
  { n: "3", x: 40, y: 120, label: "стол 120 °C", color: "#3b82f6" },
  { n: "4", x: 108, y: 94, label: "закалённое сопло", color: "#10b981" },
];

/**
 * Кадр блока 12 урока IN1 «Инженерные материалы и совместимость».
 *
 * Макет из описания кадра `IN1_ht_printer.png`: разрез принтера и четыре узла,
 * без которых PC и PA-CF не печатаются. Цифры кадра — из блоков 11 и 12:
 * хотэнд на 300 °C, камера 80 °C, стол 120 °C, закалённое сопло.
 */
export function EngineerIN1Image3({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Высокотемпературный принтер: разрез камеры с четырьмя узлами. Цельно-металлический хотэнд на 300 °C, закрытая камера 80 °C, стол 120 °C и закалённое сопло — без них PC и PA-CF не печатаются"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          что нужно для PC и PA-CF
        </text>

        {/* Камера принтера. */}
        <rect x="16" y="30" width="154" height="102" rx="6" fill="#0f172a" fillOpacity="0.35" stroke="#475569" />
        <line x1="16" y1="56" x2="170" y2="56" stroke="#475569" strokeOpacity="0.6" />
        <line x1="24" y1="56" x2="24" y2="126" stroke="#475569" strokeOpacity="0.6" />

        {/* Стол и деталь. */}
        <rect x="32" y="116" width="122" height="8" rx="2" fill="#475569" />
        <rect x="88" y="100" width="28" height="16" rx="2" fill="#3b82f6" fillOpacity="0.5" stroke="#3b82f6" />

        {/* Печатающая голова и сопло. */}
        <rect x="110" y="58" width="24" height="26" rx="3" fill="#334155" stroke="#64748b" />
        <path d="M116 84 H128 L124 96 H120 Z" fill="#f59e0b" />
        <path d="M120 96 H124 L122 100 Z" fill="#f59e0b" />

        {/* Номера узлов на рисунке. */}
        {MARKS.map((mark) => (
          <g key={mark.n}>
            <circle cx={mark.x} cy={mark.y} r="7" fill={mark.color} fillOpacity="0.25" stroke={mark.color} />
            <text x={mark.x} y={mark.y + 3.5} fontSize="10" fontWeight="700" fill="#e2e8f0" textAnchor="middle">
              {mark.n}
            </text>
          </g>
        ))}

        {/* Расшифровка узлов справа. */}
        {MARKS.map((mark, index) => {
          const y = 48 + index * 26;
          return (
            <g key={mark.label}>
              <circle cx="191" cy={y - 3.5} r="7" fill={mark.color} fillOpacity="0.25" stroke={mark.color} />
              <text x="191" y={y} fontSize="10" fontWeight="700" fill={mark.color} textAnchor="middle">
                {mark.n}
              </text>
              <text x="203" y={y} fontSize="10" fill="#e2e8f0">
                {mark.label}
              </text>
            </g>
          );
        })}

        <text x="12" y="152" fontSize="10" fill="#94a3b8">
          камера держит тепло вокруг детали
        </text>
        <text x="12" y="166" fontSize="10" fill="#fcd34d">
          иначе PC ведёт и отрывает от стола
        </text>
      </svg>
    </VisualWrapper>
  );
}
