import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Шесть линий слоёв внутри детали: вдоль или поперёк нагрузки. */
const layers = [58, 66, 74, 82, 90, 98];
const columns = [222, 227, 232, 237, 242, 247, 252];

/**
 * Прочность по осям — одна и та же деталь в двух направлениях слоёв: слева слои
 * идут вдоль нагрузки (100 %), справа — поперёк, и по слоям проходит линия
 * разрыва (30–50 %).
 *
 * Ровно по content урока: «деталь, напечатанная вдоль и поперёк. Вдоль — 100 %,
 * поперёк — 30–50 %» и по правилам из списка: «разрыв — слои перпендикулярно
 * нагрузке», «сжатие — слои параллельно».
 *
 * От видов заполнения в базовом уроке 7 (0/15/40/100 %) отличается предметом:
 * там проценты заполнения внутри детали, здесь — направление слоёв и стрелка
 * нагрузки. От схем кинематики в модуле A — тем, что принтера в кадре нет
 * вовсе, а от «Разрезов первого слоя» в уроке 5 — масштабом: там линии первого
 * слоя, здесь слои всей детали.
 */
export function ProFF2Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Прочность по осям: одна деталь напечатана вдоль нагрузки — слои параллельны силе, прочность 100 процентов; та же деталь напечатана поперёк — нагрузка идёт по слоям, по границе слоёв проходит линия разрыва, прочность 30–50 процентов"
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

        <text x="12" y="16" fontSize="10" fill="#94a3b8">
          одна деталь — два направления слоёв
        </text>

        {/* Слои вдоль нагрузки: сила идёт в плоскости слоёв */}
        <rect x="14" y="26" width="140" height="92" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="84" y="40" fontSize="10" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
          слои вдоль нагрузки
        </text>
        <rect x="66" y="52" width="36" height="52" fill="#334155" stroke="#64748b" />
        {layers.map((y) => (
          <line key={`along-${y}`} x1="68" y1={y} x2="100" y2={y} stroke="#34d399" strokeOpacity="0.55" />
        ))}
        <line x1="84" y1="104" x2="84" y2="108" stroke="#6ee7b7" strokeWidth="1.4" />
        <polygon points="81,108 87,108 84,113" fill="#6ee7b7" />
        <rect x="46" y="124" width="76" height="18" rx="9" fill="#0f172a" stroke="#34d399" />
        <text x="84" y="137" fontSize="11" fontWeight="bold" fill="#6ee7b7" textAnchor="middle">
          100 %
        </text>
        <text x="84" y="155" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          сжатие и растяжение
        </text>

        {/* Слои поперёк нагрузки: сила рвёт деталь по границе слоёв */}
        <rect x="166" y="26" width="140" height="92" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="236" y="40" fontSize="10" fontWeight="bold" fill="#fdba74" textAnchor="middle">
          слои поперёк нагрузки
        </text>
        <rect x="218" y="52" width="36" height="52" fill="#334155" stroke="#64748b" />
        {columns.map((x) => (
          <line key={`across-${x}`} x1={x} y1="53" x2={x} y2="103" stroke="#fb923c" strokeOpacity="0.55" />
        ))}
        <line x1="218" y1="84" x2="254" y2="84" stroke="#f97316" strokeDasharray="4 3" />
        <line x1="236" y1="104" x2="236" y2="108" stroke="#fdba74" strokeWidth="1.4" />
        <polygon points="233,108 239,108 236,113" fill="#fdba74" />
        <rect x="198" y="124" width="76" height="18" rx="9" fill="#0f172a" stroke="#fb923c" />
        <text x="236" y="137" fontSize="11" fontWeight="bold" fill="#fdba74" textAnchor="middle">
          30–50 %
        </text>
        <text x="236" y="155" fontSize="10" fill="#cbd5e1" textAnchor="middle">
          разрыв по слоям
        </text>

        <text x="12" y="171" fontSize="9" fill="#94a3b8">
          ориентация важнее заполнения
        </text>
      </svg>
    </VisualWrapper>
  );
}
