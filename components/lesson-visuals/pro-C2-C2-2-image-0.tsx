import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Круглый переключатель пределов: центр диска, радиус и вынос подписей. */
const DIAL = { cx: 76, cy: 124, radius: 32, labelRadius: 44 };

/** Четыре сектора переключателя — V, Ω, A и прозвонка. */
const MODES = [
  { id: "volt", angle: -45, label: "V", size: 9 },
  { id: "ohm", angle: 45, label: "Ω", size: 10 },
  { id: "amp", angle: 135, label: "A", size: 9 },
  { id: "buzz", angle: -135, label: "прозвонка", size: 7.5 },
];

const RADIANS = Math.PI / 180;

/** Точка на диске: угол в градусах, 0 — вправо, отсчёт по часовой стрелке. */
function polar(radius: number, angle: number) {
  return {
    x: DIAL.cx + radius * Math.cos(angle * RADIANS),
    y: DIAL.cy + radius * Math.sin(angle * RADIANS),
  };
}

/** Сектор круга: два радиуса и дуга между ними. */
function sector(angle: number): string {
  const start = polar(DIAL.radius, angle - 41);
  const end = polar(DIAL.radius, angle + 41);
  return `M${DIAL.cx},${DIAL.cy} L${start.x.toFixed(2)},${start.y.toFixed(2)} A${DIAL.radius},${DIAL.radius} 0 0 1 ${end.x.toFixed(2)},${end.y.toFixed(2)} Z`;
}

/** Стрелка наведена на Ω: линия от центра плюс наконечник. */
const POINTER_ANGLE = 45;
const POINTER_END = polar(20, POINTER_ANGLE);
const ARROW_POINTS = [
  polar(26, POINTER_ANGLE),
  { x: POINTER_END.x - Math.sin(POINTER_ANGLE * RADIANS) * 3.5, y: POINTER_END.y + Math.cos(POINTER_ANGLE * RADIANS) * 3.5 },
  { x: POINTER_END.x + Math.sin(POINTER_ANGLE * RADIANS) * 3.5, y: POINTER_END.y - Math.cos(POINTER_ANGLE * RADIANS) * 3.5 },
]
  .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
  .join(" ");

/**
 * Мультиметр в работе: один прибор, круглый переключатель на четырёх режимах,
 * стрелка на Ω, щупы стоят на контактах нагревателя, на дисплее «3,4 Ом».
 */
export function ProC2C22Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Мультиметр в работе: круглая ручка предела стоит на сопротивлении Ω, стрелка наведена на Ω, два щупа стоят на контактах нагревателя хотэнда, на дисплее — 3,4 Ом, то есть в норме для нагревателя."
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
        <rect x="0.5" y="0.5" width="319" height="179" rx="12" fill="#1e293b" fillOpacity="0.5" stroke="#475569" />
        <text x="12" y="14" fontSize="10" fill="#94a3b8">
          Мультиметр в работе: измеряем нагреватель
        </text>

        {/* Корпус прибора */}
        <rect x="16" y="24" width="150" height="148" rx="10" fill="#0f172a" stroke="#475569" strokeWidth="1.4" />

        {/* Дисплей: режим и показание */}
        <rect x="24" y="32" width="126" height="46" rx="4" fill="#1e293b" stroke="#475569" />
        <text x="34" y="45" fontSize="8" fill="#94a3b8">
          режим Ω
        </text>
        <text x="34" y="70" fontSize="16" fill="#34d399" fontWeight="600">
          3,4 Ом
        </text>

        {/* Круглый переключатель: четыре сектора, активный — Ω */}
        <circle cx={DIAL.cx} cy={DIAL.cy} r={DIAL.radius} fill="#0f172a" stroke="#475569" strokeWidth="1.4" />
        {MODES.map((mode) => (
          <path
            key={mode.id}
            d={sector(mode.angle)}
            fill="#334155"
            stroke={mode.id === "ohm" ? "#38bdf8" : "#475569"}
            strokeWidth={mode.id === "ohm" ? "1.8" : "1"}
          />
        ))}
        <circle cx={DIAL.cx} cy={DIAL.cy} r="6" fill="#475569" stroke="#94a3b8" />
        <line x1={DIAL.cx} y1={DIAL.cy} x2={POINTER_END.x.toFixed(2)} y2={POINTER_END.y.toFixed(2)} stroke="#38bdf8" strokeWidth="2.4" />
        <polygon points={ARROW_POINTS} fill="#38bdf8" />
        {MODES.map((mode) => {
          const point = polar(DIAL.labelRadius, mode.angle);
          return (
            <text
              key={`${mode.id}-label`}
              x={point.x.toFixed(2)}
              y={(point.y + mode.size * 0.35).toFixed(2)}
              fontSize={mode.size}
              fill={mode.id === "ohm" ? "#38bdf8" : "#94a3b8"}
              textAnchor="middle"
            >
              {mode.label}
            </text>
          );
        })}
        {/* Нагреватель хотэнда: два контакта, на них стоят щупы */}
        <text x="266" y="80" fontSize="8" fill="#94a3b8" textAnchor="middle">
          щупы на контактах
        </text>
        <rect x="232" y="92" width="68" height="52" rx="4" fill="#334155" stroke="#f87171" strokeWidth="1.3" />
        <rect x="242" y="106" width="48" height="10" rx="4" fill="#0f172a" stroke="#f87171" strokeWidth="1" />
        <rect x="220" y="98" width="12" height="12" rx="2" fill="#334155" stroke="#fbbf24" strokeWidth="1.1" />
        <rect x="220" y="118" width="12" height="12" rx="2" fill="#334155" stroke="#fbbf24" strokeWidth="1.1" />
        <line x1="168" y1="100" x2="222" y2="104" stroke="#e2e8f0" strokeWidth="2.4" />
        <line x1="168" y1="132" x2="222" y2="124" stroke="#e2e8f0" strokeWidth="2.4" />
        <text x="266" y="160" fontSize="9" fill="#f87171" textAnchor="middle">
          нагреватель
        </text>
      </svg>
    </VisualWrapper>
  );
}
