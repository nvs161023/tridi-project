import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Рёбра радиатора: четыре уровня, между ними корпус охлаждается. */
const fins = [28, 36, 44, 52];

/**
 * Разрез хотэнда — узлы из content урока: радиатор, heatbreak, нагревательный
 * блок и сопло. Цвет несёт смысл: синее — зона охлаждения, красное — зона
 * плавления, и она одна — только в сопле. Стрелки сверху и снизу показывают
 * вход холодного пластика и выход горячего.
 *
 * От «Ремня и шкива» из модуля A отличается приёмом: там технический чертёж с
 * размерными линиями, здесь разрез с цветовыми зонами и стрелками потока —
 * размеров в кадре нет вовсе.
 */
export function ProB1Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Разрез хотэнда: сверху холодный пластик входит в радиатор, дальше идёт heatbreak, затем нагревательный блок и сопло — синим показана зона охлаждения, красным только зона плавления в сопле, снизу выходит горячий пластик"
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

        {/* Радиатор: корпус и рёбра вправо-влево, зона охлаждения */}
        <rect x="136" y="24" width="28" height="32" fill="#1e3a5f" stroke="#38bdf8" />
        {fins.map((y) => (
          <g key={y}>
            <line x1="128" y1={y} x2="136" y2={y} stroke="#38bdf8" strokeWidth="1.2" />
            <line x1="164" y1={y} x2="172" y2={y} stroke="#38bdf8" strokeWidth="1.2" />
          </g>
        ))}

        {/* Heatbreak: узкая шейка между охлаждением и нагревом */}
        <rect x="146" y="56" width="8" height="22" fill="#334155" stroke="#94a3b8" />

        {/* Нагревательный блок и сопло */}
        <rect x="128" y="78" width="44" height="34" fill="#334155" stroke="#64748b" />
        <polygon
          points="136,112 164,112 158,134 152,140 148,140 142,134"
          fill="#334155"
          stroke="#94a3b8"
        />

        {/* Зона плавления: красная заливка в блоке и внутри сопла */}
        <rect x="138" y="98" width="24" height="14" fill="#dc2626" fillOpacity="0.55" />
        <polygon points="144,112 156,112 152,133 148,133" fill="#dc2626" fillOpacity="0.45" />

        {/* Пластик: сверху холодный, в сопле расплавленный */}
        <line x1="150" y1="16" x2="150" y2="98" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="150" y1="98" x2="150" y2="138" stroke="#fbbf24" strokeWidth="2.4" />

        {/* Стрелки: холодный входит сверху, горячий выходит снизу */}
        <polygon points="147,10 153,10 150,16" fill="#cbd5e1" />
        <polygon points="146,142 154,142 150,153" fill="#fbbf24" />

        <text x="14" y="16" fontSize="10" fill="#e2e8f0">
          холодный пластик входит
        </text>
        <text x="118" y="32" fontSize="10" fill="#cbd5e1" textAnchor="end">
          радиатор
        </text>
        <text x="118" y="52" fontSize="10" fill="#7dd3fc" textAnchor="end">
          охлаждение
        </text>
        <text x="118" y="72" fontSize="10" fill="#cbd5e1" textAnchor="end">
          heatbreak
        </text>
        <text x="186" y="90" fontSize="10" fill="#cbd5e1">
          нагревательный блок
        </text>
        <text x="186" y="110" fontSize="10" fill="#e2e8f0">
          сопло
        </text>
        <text x="186" y="130" fontSize="10" fill="#fca5a5">
          зона плавления
        </text>
        <text x="186" y="150" fontSize="10" fill="#fbbf24">
          горячий выходит
        </text>
        <text x="14" y="170" fontSize="10" fill="#94a3b8">
          красным — плавление, синим — охлаждение
        </text>
      </svg>
    </VisualWrapper>
  );
}
