import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

type Nozzle = {
  cx: number;
  name: string;
  color: string;
  worn: boolean;
  note: string[];
};

/** Блок 10: два сопла рядом — латунное и закалённое. */
const NOZZLES: Nozzle[] = [
  { cx: 85, name: "латунь", color: "#f59e0b", worn: true, note: ["стирается", "за катушку-две"] },
  { cx: 235, name: "закалённая сталь", color: "#3b82f6", worn: false, note: ["держит", "стальное сопло"] },
];

/**
 * Кадр блока 10 урока IN1 «Инженерные материалы и совместимость».
 *
 * Макет из описания кадра `IN1_abrasive.png`: углеродное волокно идёт через
 * сопло и работает как наждак. У латуни канал разбит у выхода — хватает
 * катушки-две. Закалённое сопло канал держит, поэтому под абразив ставят его.
 */
export function EngineerIN1Image2({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Абразивы против латуни: углеродное волокно в пластике стирает латунное сопло за катушку-две, канал разбивается у выхода. Закалённое стальное сопло канал держит — под абразив нужно стальное сопло"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          CF в пластике работает как наждак
        </text>

        {NOZZLES.map((nozzle) => (
          <g key={nozzle.name}>
            <rect
              x={nozzle.cx - 73}
              y="24"
              width="146"
              height="116"
              rx="8"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#475569"
            />
            <text x={nozzle.cx} y="38" fontSize="10" fontWeight="700" fill={nozzle.color} textAnchor="middle">
              {nozzle.name}
            </text>

            <rect x={nozzle.cx - 3} y="42" width="6" height="18" fill="#e2e8f0" fillOpacity="0.45" />
            {[47, 52, 57].map((cy) => (
              <circle key={cy} cx={nozzle.cx} cy={cy} r="2" fill="#f59e0b" />
            ))}

            <path
              d={`M${nozzle.cx - 26} 58 H${nozzle.cx + 26} L${nozzle.cx + 12} 94 L${nozzle.cx + 7} 108 H${
                nozzle.cx - 7
              } L${nozzle.cx - 12} 94 Z`}
              fill={nozzle.color}
              fillOpacity="0.22"
              stroke={nozzle.color}
            />

            {nozzle.worn ? (
              <path
                d={`M${nozzle.cx - 4} 58 V92 L${nozzle.cx - 10} 108 H${nozzle.cx + 10} L${nozzle.cx + 4} 92 V58 Z`}
                fill="#0f172a"
                stroke="#f59e0b"
                strokeOpacity="0.5"
              />
            ) : (
              <rect
                x={nozzle.cx - 4}
                y="58"
                width="8"
                height="50"
                fill="#0f172a"
                stroke="#3b82f6"
                strokeOpacity="0.5"
              />
            )}

            {[72, 84, 96].map((cy) => (
              <circle key={cy} cx={nozzle.cx} cy={cy} r="2" fill="#f59e0b" />
            ))}

            {nozzle.worn ? (
              <>
                <path d={`M${nozzle.cx - 16} 106 L${nozzle.cx - 22} 112`} stroke="#f87171" strokeWidth="2" />
                <path d={`M${nozzle.cx + 16} 106 L${nozzle.cx + 22} 112`} stroke="#f87171" strokeWidth="2" />
              </>
            ) : null}

            <text x={nozzle.cx} y="122" fontSize="10" fontWeight="700" fill={nozzle.color} textAnchor="middle">
              {nozzle.note[0]}
            </text>
            <text x={nozzle.cx} y="135" fontSize="10" fill="#cbd5e1" textAnchor="middle">
              {nozzle.note[1]}
            </text>
          </g>
        ))}
        <text x="12" y="160" fontSize="10" fill="#fcd34d">
          под абразив — стальное сопло
        </text>
      </svg>
    </VisualWrapper>
  );
}
