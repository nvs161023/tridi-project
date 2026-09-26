import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Слои кубика на боковых гранях: 20 мм с шагом 0,2 мм — рисуем по шесть рисок. */
const layerRows = [102, 108, 114, 120];

/** Строки профиля из шага урока: «Профиль PLA: 0,2 мм, 20%, 3 стенки, 210/60 °C». */
const profileRows = [
  { y: 78, text: "PLA 0,2 мм", accent: "#60a5fa" },
  { y: 100, text: "Заполнение 20 %", accent: "#34d399" },
  { y: 122, text: "Стенки 3", accent: "#f59e0b" },
  { y: 144, text: "210/60 °C", accent: "#f87171" },
];

/**
 * Файл для печати — окно слайсера с открытым кубиком и панель профиля с числами.
 *
 * Ровно по content урока: «Скриншот слайсера с открытым файлом cube_20mm.stl.
 * Профиль PLA 0.2 мм, заполнение 20%, 3 стенки», а температуры (210/60 °C) — из
 * шагов того же урока.
 *
 * От схемы окна Orca (урок 3) отличается тем, что это не разбор зон интерфейса, а
 * конкретный файл и профиль: слева кубик на столе с именем файла, справа панель с
 * четырьмя значениями. От кадра результата (этот же урок) — тем, что там фото
 * готовой детали и галочки проверки, а здесь ещё ничего не напечатано.
 */
export function Basic9Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Файл для печати: в слайсере открыт cube_20mm.stl на столе, профиль PLA 0,2 мм, заполнение 20 %, три стенки, сопло 210 °C и стол 60 °C"
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

        {/* Окно слайсера с открытым файлом */}
        <rect x="14" y="36" width="176" height="112" rx="8" fill="#0f172a" stroke="#475569" />
        <rect x="14" y="36" width="176" height="20" rx="8" fill="#1e293b" />
        {[24, 32, 40].map((cx) => (
          <circle key={cx} cx={cx} cy="46" r="2.5" fill="#64748b" />
        ))}
        <text x="52" y="46" fontSize="10" fill="#e2e8f0">
          cube_20mm.stl
        </text>

        {/* Стол и кубик с рисками слоёв */}
        <rect x="30" y="124" width="144" height="10" rx="2" fill="#1e3a5f" stroke="#3b82f6" />
        <polygon points="62,84 100,72 138,84 100,96" fill="#334155" stroke="#475569" />
        <polygon points="62,84 100,96 100,124 62,112" fill="#1e293b" stroke="#475569" />
        <polygon points="100,96 138,84 138,112 100,124" fill="#0f172a" stroke="#475569" />
        {layerRows.map((y) => (
          <g key={y}>
            <line x1="62" y1={y} x2="100" y2={y + 12} stroke="#64748b" />
            <line x1="100" y1={y + 12} x2="138" y2={y} stroke="#64748b" />
          </g>
        ))}

        {/* Панель профиля */}
        <rect x="200" y="36" width="106" height="112" rx="8" fill="#1e293b" stroke="#334155" />
        <text x="212" y="56" fontSize="11" fontWeight="bold" fill="#e2e8f0">
          Профиль
        </text>
        {profileRows.map((row) => (
          <g key={row.text}>
            <circle cx="208" cy={row.y - 3} r="2.5" fill={row.accent} />
            <text x="218" y={row.y} fontSize="10" fill={row.accent}>
              {row.text}
            </text>
          </g>
        ))}

        <text x="14" y="166" fontSize="10" fill="#94a3b8">
          Дальше Slice — сохрани .gcode и запусти печать
        </text>
      </svg>
    </VisualWrapper>
  );
}
