import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Волокна поддержки в разрезе под плечом детали. */
const supportLines = [48, 60, 72, 84, 96];

/** Строки панели Support: параметр слева, значение справа. */
const settings = [
  { y: 62, label: "Structure", value: "Tree" },
  { y: 82, label: "Overhang", value: "50°" },
  { y: 102, label: "Density", value: "10%" },
  { y: 122, label: "Z Distance", value: "0,2 мм" },
];

/**
 * Настройки поддержек: слева разрез нависания — стойка детали, её плечо и
 * поддержка под плечом, а между ними размерная линия зазора Z 0,2 мм; справа
 * узкая панель Support из четырёх строк.
 *
 * Ровно по content урока: «Support Structure — Tree. Support Overhang Angle —
 * 50°. Support Density — 10%. Z Distance — 0.2» и по списку настроек: «Support
 * Z Distance: 0,15–0,2 мм», «Support Density: 10–15%», «Support Angle: 50–55°».
 *
 * От десяти панелей слайсера в других модулях отличается тем, что окна в кадре
 * нет вовсе: слева разрез нависания с размерной линией зазора, справа только
 * четыре строки настроек. От «Настроек Ironing» в модуле G — предметом: там
 * верхняя поверхность и бороздки, здесь опора под плечом детали и её зазор.
 */
export function ProHH1Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Настройки поддержек в Orca: слева разрез нависания — плечо детали и поддержка под ним с размерной линией зазора Z 0,2 миллиметра, справа панель Support с параметрами Structure Tree, Overhang 50 градусов, Density 10 процентов и Z Distance 0,2 миллиметра"
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
          поддержка под нависанием: зазор и настройки
        </text>

        {/* Разрез: стойка, плечо и поддержка под ним */}
        <rect x="30" y="40" width="70" height="10" fill="#475569" stroke="#94a3b8" />
        <rect x="30" y="40" width="10" height="60" fill="#475569" stroke="#94a3b8" />
        {supportLines.map((x) => (
          <line key={`support-${x}`} x1={x} y1="62" x2={x} y2="100" stroke="#64748b" strokeWidth="2" />
        ))}

        {/* Размерная линия зазора */}
        <line x1="106" y1="50" x2="106" y2="62" stroke="#fbbf24" />
        <line x1="102" y1="50" x2="110" y2="50" stroke="#fbbf24" />
        <line x1="102" y1="62" x2="110" y2="62" stroke="#fbbf24" />
        <text x="116" y="60" fontSize="9" fill="#fbbf24">
          Z 0,2 мм
        </text>

        <text x="12" y="150" fontSize="10" fill="#e2e8f0">
          зазор Z 0,2 мм — снимается руками
        </text>
        <text x="12" y="168" fontSize="9" fill="#94a3b8">
          плотность 10–15% — оптимально
        </text>

        <rect x="168" y="26" width="140" height="114" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="176" y="42" fontSize="10" fontWeight="bold" fill="#93c5fd">
          Support
        </text>
        {settings.map((row) => (
          <g key={`setting-${row.label}`}>
            <text x="176" y={row.y} fontSize="10" fill="#94a3b8">
              {row.label}
            </text>
            <text x="300" y={row.y} fontSize="10" fill="#e2e8f0" textAnchor="end">
              {row.value}
            </text>
          </g>
        ))}
        <text x="176" y="136" fontSize="9" fill="#6ee7b7">
          Tree — экономия
        </text>
      </svg>
    </VisualWrapper>
  );
}
