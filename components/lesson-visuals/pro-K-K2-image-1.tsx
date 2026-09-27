import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Короткие штрихи сухой кисти на плоскости — текстура от drybrush. */
const DRYBRUSH = [
  [206, 82, 216, 76],
  [210, 92, 220, 86],
  [206, 102, 216, 96],
  [212, 112, 222, 106],
  [208, 122, 218, 116],
];

/** Три стрелки напыления сверху — приём zenithal. */
const ZENITHAL_ARROWS = [170, 190, 210];

/**
 * Четыре техники покраски на одной детали: сверху светлый градиент от zenithal,
 * слева светлая кромка от edge highlight, внизу справа углубление с подтёком от
 * wash, на плоскости штрихи сухой кисти от drybrush.
 *
 * Ровно по content урока: «Drybrush — сухая кисть для текстуры. Wash — разведённая
 * краска в углубления. Edge highlight — светлая кромка. Zenithal — грунт сверху
 * белым, снизу чёрным» и по подписи блока: «Фото: drybrush, wash, edge highlight,
 * zenithal. Под каждым — результат».
 *
 * От «четырёх плиток с результатом», от «крупного плана с лупой» (F-F2, G-G3,
 * basic-14-image-0) и от «карты обслуживания с метками на принтере» (C1-C1-2)
 * отличается тем, что приёмы показаны зонами на одном объекте и у каждой зоны
 * есть своё движение инструмента: стрелки напыления, светлая кромка, подтёк в
 * углубление, штрихи сухой кисти.
 */
export function ProKK2Image1({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Четыре техники покраски на одной детали: сверху светлее, чем снизу, — это zenithal со стрелками напыления; по левой кромке идёт светлая линия — edge highlight; в углубление стекает разведённая краска — wash; на плоскости короткие штрихи сухой кисти — drybrush, они дают текстуру"
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
          Четыре техники покраски миниатюры
        </text>

        {/* Деталь: фрагмент поверхности, на котором видны все четыре приёма */}
        <rect
          x="140"
          y="48"
          width="100"
          height="96"
          rx="10"
          fill="#334155"
          fillOpacity="0.45"
          stroke="#64748b"
          strokeWidth="1.6"
        />

        {/* Zenithal: светлый верх и стрелки напыления */}
        <rect x="146" y="48" width="88" height="8" fill="#e2e8f0" fillOpacity="0.3" />
        <rect x="146" y="56" width="88" height="8" fill="#e2e8f0" fillOpacity="0.18" />
        <rect x="146" y="64" width="88" height="6" fill="#e2e8f0" fillOpacity="0.08" />
        {ZENITHAL_ARROWS.map((x) => (
          <g key={`arrow-${x}`} stroke="#94a3b8" strokeWidth="1.2">
            <line x1={x} y1="52" x2={x} y2="63" />
            <polygon
              points={`${x - 2},62 ${x + 2},62 ${x},67`}
              fill="#94a3b8"
              stroke="none"
            />
          </g>
        ))}

        {/* Edge highlight: светлая линия по левой кромке */}
        <line x1="146" y1="60" x2="146" y2="138" stroke="#f8fafc" strokeWidth="2.5" />

        {/* Wash: подтёк стекает в углубление */}
        <line x1="186" y1="96" x2="186" y2="104" stroke="#64748b" strokeWidth="1.2" />
        <polygon points="183,103 189,103 186,108" fill="#64748b" />
        <circle cx="186" cy="118" r="13" fill="#0f172a" fillOpacity="0.55" />

        {/* Drybrush: короткие штрихи сухой кисти на плоскости */}
        {DRYBRUSH.map(([x1, y1, x2, y2]) => (
          <line
            key={`${x1}-${y1}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#cbd5e1"
            strokeWidth="1.6"
          />
        ))}

        <text x="123" y="32" fontSize="9" fill="#e2e8f0">
          zenithal: верх светлее низа
        </text>
        <text x="12" y="88" fontSize="7.5" fill="#e2e8f0">
          edge highlight
        </text>
        <text x="12" y="102" fontSize="7.5" fill="#94a3b8">
          светлые кромки
        </text>
        <text x="12" y="158" fontSize="7.5" fill="#e2e8f0">
          wash: краска
        </text>
        <text x="12" y="172" fontSize="7.5" fill="#94a3b8">
          стекает в углубления
        </text>
        <text x="150" y="158" fontSize="7.5" fill="#e2e8f0">
          drybrush: сухая
        </text>
        <text x="150" y="172" fontSize="7.5" fill="#94a3b8">
          текстура на кромках
        </text>
      </svg>
    </VisualWrapper>
  );
}
