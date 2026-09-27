import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Четыре ступени нависания: угол от вертикали, длина выступа и цвет нити.
 * Координаты стенки — x = 34, уровни 40 / 68 / 96 / 124.
 */
const STEPS = [
  { level: 40, angle: "30°", endX: 46, endY: 60.8, accent: "#34d399", verdict: "30° — держится" },
  { level: 68, angle: "45°", endX: 51, endY: 85, accent: "#fbbf24", verdict: "45° — предел" },
  { level: 96, angle: "60°", endX: 54.8, endY: 108, accent: "#fb923c", verdict: "60° — провисает" },
  { level: 124, angle: "80°", endX: 57.6, endY: 128.2, accent: "#f87171", verdict: "80° — поддержки" },
];

/** Столбики поддержки под выступом 80°: только он без опоры не держится. */
const SUPPORTS = [42, 50, 58];

/**
 * Углы нависаний — из content урока: «30° — ок, 45° — предел, 60° — провисает,
 * 80° — нужны поддержки», плюс настройки из списка «Overhang Speed 30–40 мм/с,
 * Cooling 100 % для PLA».
 *
 * Формат — одна стенка и ЛЕСТНИЦА из четырёх выступов под разными углами; главное
 * в кадре — форма провисающей нити: ровно, с натягом, дуга, дуга с петлёй. Серые
 * столбики поддержки стоят только под выступом 80°.
 *
 * От «Видов поддержек» в H1 отличается предметом: там четыре силуэта разных
 * поддержек под ОДНИМ нависанием 45° и плюсы-минусы каждой, здесь четыре РАЗНЫХ
 * угла и то, что делает нить. От «Примеров ориентации» в F2 — тем, что там одна
 * деталь поворачивается и считается объём поддержек, а не угол нависания.
 */
export function ProII5Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Четыре угла нависания на одной стенке: при 30 градусах нить ложится ровно, при 45 держится с натягом, при 60 провисает дугой, при 80 провисает дугой с петлёй и требует серых столбиков поддержки; порог — 45 градусов, настройки — охлаждение 100 процентов, минус 5 градусов, 20–30 мм/с"
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

        <text x="12" y="16" fontSize="9.5" fill="#94a3b8">
          углы нависаний: где держится, где провисает
        </text>

        {/* Стенка детали, от которой идут выступы */}
        <rect x="20" y="32" width="14" height="126" fill="#475569" stroke="#94a3b8" />

        {/* Четыре выступа под углами 30, 45, 60 и 80 градусов */}
        {STEPS.map((step) => (
          <line
            key={`step-${step.angle}`}
            x1="34"
            y1={step.level}
            x2={step.endX}
            y2={step.endY}
            stroke="#cbd5e1"
            strokeWidth="3"
          />
        ))}

        {/* Нить: ровно, с натягом, дуга, дуга с петлёй */}
        <path d="M34,46 L46,66" fill="none" stroke="#34d399" strokeWidth="2" />
        <path d="M34,74 L51,91" fill="none" stroke="#fbbf24" strokeWidth="2" />
        <path d="M34,102 Q46,116 55,107" fill="none" stroke="#fb923c" strokeWidth="2" />
        <path d="M34,130 Q46,144 58,132" fill="none" stroke="#f87171" strokeWidth="2" />
        <path d="M40,138 q5,-8 10,-1" fill="none" stroke="#f87171" strokeWidth="1.6" />

        {SUPPORTS.map((x) => (
          <rect key={`support-${x}`} x={x} y="138" width="3" height="12" fill="#475569" />
        ))}

        {/* Порог: до 45° деталь ещё печатается без поддержек */}
        <text x="76" y="78" fontSize="9" fill="#fbbf24">
          порог 45°
        </text>
        <line x1="70" y1="90" x2="112" y2="90" stroke="#fbbf24" strokeDasharray="5 4" />

        {STEPS.map((step) => (
          <text
            key={`verdict-${step.angle}`}
            x="124"
            y={step.level + 6}
            fontSize="9"
            fill={step.accent}
          >
            {step.verdict}
          </text>
        ))}

        <text x="12" y="172" fontSize="9" fill="#94a3b8">
          охлаждение 100 %, −5 °C, 20–30 мм/с
        </text>
      </svg>
    </VisualWrapper>
  );
}
