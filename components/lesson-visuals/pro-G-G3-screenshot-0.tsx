import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Бороздки верхнего слоя справа от гладкой полосы. */
const grooves = [46, 52, 58, 64, 70, 76, 82, 88, 94];

/** Строки панели Ironing: подпись слева, значение справа. */
const settings = [
  { y: 60, label: "Flow", value: "10 %" },
  { y: 76, label: "Speed", value: "20 мм/с" },
  { y: 92, label: "Spacing", value: "0,1 мм" },
  { y: 108, label: "Inset", value: "внутрь" },
  { y: 124, label: "Top Surface Only", value: "вкл" },
];

/**
 * Ironing в Orca: слева макро-вид верха, по которому уже прошло сопло — гладкая
 * полоса с чёткой границей и бороздки справа от неё, справа узкая панель с
 * настройками Ironing (Flow 10 %, Speed 20 мм/с, Spacing 0,1 мм, Inset, Top
 * Surface Only).
 *
 * Ровно по content урока: «Скриншот: Ironing — Top Surface Only. Flow 10%.
 * Speed 20. Spacing 0,1» и по совету «начни с Flow 10%, Speed 20».
 *
 * От «Variable Layer Height в Orca» в этом же модуле отличается оптикой: там
 * разрез по Z с числовыми метками высот слоя и шкалой диапазона, здесь верхняя
 * поверхность крупным планом и список настроек проглаживания; от «Seam Position»
 * — тем, что там список положений шва и движущаяся деталь, а здесь статичная
 * панель без выбора положения.
 */
export function ProGG3Screenshot0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Ironing в Orca: слева верхняя поверхность детали крупным планом — гладкая полоса, которую оставило сопло, и бороздки слоёв справа от неё, справа панель настроек с Flow 10 процентов, Speed 20 миллиметров в секунду, Spacing 0,1 миллиметра, Inset и включённым Top Surface Only"
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
          Ironing: панель настроек и верх после прохода
        </text>

        <rect x="24" y="40" width="120" height="60" rx="4" fill="#334155" stroke="#64748b" />
        {grooves.map((y) => (
          <line key={`groove-${y}`} x1="70" y1={y} x2="140" y2={y} stroke="#94a3b8" strokeOpacity="0.55" />
        ))}
        <rect x="24" y="40" width="46" height="60" fill="#38bdf8" fillOpacity="0.22" />
        <line x1="70" y1="40" x2="70" y2="100" stroke="#38bdf8" />

        <text x="84" y="116" fontSize="9" fill="#94a3b8" textAnchor="middle">
          полоса после прохода сопла
        </text>

        <rect x="168" y="26" width="140" height="124" rx="6" fill="#0f172a" stroke="#475569" />
        <text x="176" y="42" fontSize="10" fontWeight="bold" fill="#93c5fd">
          Ironing
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
        <text x="176" y="142" fontSize="9" fill="#6ee7b7">
          проверь Flow и Speed
        </text>

        <text x="12" y="166" fontSize="9" fill="#94a3b8">
          Top Surface Only — проглаживает только верх
        </text>
      </svg>
    </VisualWrapper>
  );
}
