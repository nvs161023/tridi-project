import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Узлы дуги — точки, где раньше кончалась прямая и начиналась следующая. */
const arcNodes = [
  [49, 79],
  [70, 76],
  [91, 79],
];

/** Строки панели Geometry: параметр слева, значение справа. */
const settings = [
  { y: 60, label: "Resolution", value: "0,01 мм" },
  { y: 78, label: "Arc Welding", value: "вкл" },
  { y: 96, label: "Arc Fitting", value: "вкл" },
  { y: 114, label: "Допуск", value: "0,012 мм" },
];

/**
 * Настройки сглаживания окружностей в Orca: слева маленькая дуга с узлами и
 * короткий индикатор «команд в G-коде — меньше», справа узкая панель Geometry с
 * Resolution 0,01 мм, включёнными Arc Welding и Arc Fitting и допуском.
 *
 * Ровно по content урока: «Скриншот: Resolution 0,01. Arc Welding включён» и по
 * совету «для круглых деталей — Resolution 0,01 + Arc Welding».
 *
 * От остальных панелей модуля отличается оптикой «геометрия и код»: в G1 —
 * разрез по Z и шкала высоты слоя, в G2 — список положений шва и деталь, в G3 —
 * верхняя поверхность и настройки Ironing, здесь — контур, собранный из дуг, и
 * индикатор объёма G-кода. Общего окна слайсера в кадре нет.
 */
export function ProGG4Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Настройки сглаживания окружностей в Orca: слева дуга контура с узлами и короткий индикатор объёма G-кода, справа панель Geometry с Resolution 0,01 миллиметра, включёнными Arc Welding и Arc Fitting и допуском 0,012 миллиметра"
      animated={animated}
    >
      <svg
        viewBox="0 0 320 180"
        className="w-full h-full"
        aria-hidden="true"
        fontFamily={FONT}
      >
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

        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Geometry: Resolution и Arc Welding
        </text>

        <path d="M28,104 Q70,58 112,104" fill="none" stroke="#38bdf8" strokeWidth="1.8" />
        {arcNodes.map(([cx, cy]) => (
          <circle key={`node-${cx}`} cx={cx} cy={cy} r="2" fill="#7dd3fc" />
        ))}
        <line x1="28" y1="126" x2="112" y2="126" stroke="#334155" strokeWidth="3" />
        <line x1="28" y1="126" x2="56" y2="126" stroke="#6ee7b7" strokeWidth="3" />

        <text x="70" y="146" fontSize="9" fill="#6ee7b7" textAnchor="middle">
          команд в G-коде — меньше
        </text>

        <rect x="152" y="26" width="156" height="124" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="160" y="42" fontSize="10" fontWeight="bold" fill="#93c5fd">
          Geometry
        </text>
        {settings.map((row) => (
          <g key={`setting-${row.label}`}>
            <text x="160" y={row.y} fontSize="10" fill="#94a3b8">
              {row.label}
            </text>
            <text x="300" y={row.y} fontSize="10" fill="#e2e8f0" textAnchor="end">
              {row.value}
            </text>
          </g>
        ))}
        <text x="160" y="136" fontSize="9" fill="#6ee7b7">
          Klipper и Marlin поддерживают
        </text>

        <text x="12" y="166" fontSize="9" fill="#94a3b8">
          для круглых деталей 0,01, для остальных 0,05
        </text>
      </svg>
    </VisualWrapper>
  );
}
