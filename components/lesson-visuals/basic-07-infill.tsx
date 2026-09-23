import { VisualWrapper, type VisualProps } from "./_Wrapper";

/**
 * basic 7 · image «Заполнение: 15, 40 и 100%» (Модуль 2: Настройка печати).
 *
 * Из описания блока: четыре кубика в разрезе — 0% пустой, 15% Gyroid (лёгкая жёсткая
 * решётка для игрушек), 40% Cubic (работает на сжатие), 100% сплошной. При этом
 * 100% не значит прочнее: три стенки держат нагрузку лучше и печатаются быстрее.
 */
const CUBES = [
  { x: 10, percent: "0%", bottom: "пустой", kind: "empty" },
  { x: 84, percent: "15% Gyroid", bottom: "лёгкая решётка", kind: "gyroid" },
  { x: 158, percent: "40% Cubic", bottom: "работает на сжатие", kind: "cubic" },
  { x: 232, percent: "100%", bottom: "сплошной", kind: "solid" },
];

export function Basic07Infill({ title, animated = true }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Четыре куба в разрезе: 0% пустой, 15% Gyroid, 40% Cubic и 100% сплошной, по три стенки"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="h-full w-full">
        <text x="10" y="16" fontSize="8" fill="#cbd5e1">
          Разрез куба: заполнение и три стенки
        </text>
        {CUBES.map((cube) => (
          <g key={cube.percent}>
            <rect x={cube.x} y="26" width="78" height="86" rx="2" fill="#0b1220" stroke="#475569" />
            {cube.kind === "gyroid" && (
              <>
                {[42, 58, 74, 90].map((y) => (
                  <path
                    key={y}
                    d={`M${cube.x + 8} ${y} q9 -9 18 0 t18 0 t18 0`}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                  />
                ))}
              </>
            )}
            {cube.kind === "cubic" && (
              <>
                {[45, 67, 89].map((x) => (
                  <line
                    key={x}
                    x1={cube.x + x}
                    y1="34"
                    x2={cube.x + x}
                    y2="104"
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                  />
                ))}
                {[50, 70, 90].map((y) => (
                  <line
                    key={y}
                    x1={cube.x + 6}
                    y1={y}
                    x2={cube.x + 72}
                    y2={y}
                    stroke="#3b82f6"
                    strokeWidth="1.2"
                  />
                ))}
              </>
            )}
            {cube.kind === "solid" && (
              <rect x={cube.x + 6} y="32" width="66" height="74" fill="#1d4ed8" />
            )}
            {[3, 6, 9].map((inset) => (
              <rect
                key={inset}
                x={cube.x + inset}
                y={26 + inset}
                width={78 - inset * 2}
                height={86 - inset * 2}
                rx="1"
                fill="none"
                stroke="#93c5fd"
                strokeWidth="0.9"
              />
            ))}
            <text
              x={cube.x + 39}
              y="22"
              fontSize="8.5"
              fill="#e2e8f0"
              textAnchor="middle"
              fontWeight="bold"
            >
              {cube.percent}
            </text>
            <text x={cube.x + 39} y="124" fontSize="6.5" fill="#94a3b8" textAnchor="middle">
              {cube.bottom}
            </text>
          </g>
        ))}
        <text x="10" y="146" fontSize="7.5" fill="#cbd5e1">
          100% не значит прочнее: три стенки держат нагрузку лучше
        </text>
        <text x="10" y="158" fontSize="7.5" fill="#cbd5e1">
          сплошного заполнения, а печатаются быстрее
        </text>
        <text x="10" y="172" fontSize="7" fill="#93c5fd">
          15% Gyroid — для игрушек, 40% Cubic — для прочных деталей
        </text>
      </svg>
    </VisualWrapper>
  );
}
