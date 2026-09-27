import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Пять способов соединить разрезанную модель — пять СТАТИЧНЫХ разрезов стыка в
 * два блока: у каждого слева видно, как устроено соединение, справа — название и
 * допуск из урока.
 *
 * Ровно по content урока: «Шип-паз — простой, прочный. Ласточкин хвост — для
 * сдвига. Резьба — для разборных. Магниты — для съёма. Штифты — для
 * выравнивания» и по числам из блока «Допуски»: шип-паз 0,2–0,3 мм, магниты
 * +0,1 мм, резьба M3 — отверстие 2,9 мм, штифты 0,1 мм.
 *
 * От «Модель распадается на слои» в базовом уроке 3 отличается тем, что это не
 * анимация и не слои: пять статичных стыков в разрезе. От «Разрезов первого
 * слоя» в уроке 5 — предметом: там линии пластика, здесь геометрия замков.
 */
const rows = [
  { y: 24, kind: "tongue", name: "Шип-паз", note: "зазор 0,2–0,3 мм" },
  { y: 54, kind: "dovetail", name: "Ласточкин хвост", note: "держит сдвиг" },
  { y: 84, kind: "thread", name: "Резьба", note: "M3 — 2,9 мм" },
  { y: 114, kind: "magnet", name: "Магниты", note: "отверстие +0,1 мм" },
  { y: 144, kind: "pin", name: "Штифты", note: "0,1 мм" },
];

/** Левый блок стыка — общий для всех пяти, отличается только выступ. */
function LeftHalf({ y }: { y: number }) {
  return <rect x="14" y={y} width="35" height="22" rx="2" fill="#475569" stroke="#94a3b8" />;
}

/** Разрез стыка: два блока и их замок между ними. */
function Joint({ kind, y }: { kind: string; y: number }) {
  if (kind === "tongue") {
    return (
      <g>
        <LeftHalf y={y} />
        <rect x="49" y={y + 6} width="10" height="10" fill="#64748b" stroke="#cbd5e1" />
        <polygon
          points={`59,${y} 86,${y} 86,${y + 22} 59,${y + 22} 59,${y + 16} 67,${y + 16} 67,${y + 6} 59,${y + 6}`}
          fill="#475569"
          stroke="#94a3b8"
        />
      </g>
    );
  }

  if (kind === "dovetail") {
    return (
      <g>
        <LeftHalf y={y} />
        <polygon
          points={`49,${y + 5} 59,${y + 2} 59,${y + 20} 49,${y + 17}`}
          fill="#64748b"
          stroke="#cbd5e1"
        />
        <polygon
          points={`59,${y} 86,${y} 86,${y + 22} 59,${y + 22} 59,${y + 20} 68,${y + 17} 68,${y + 5} 59,${y + 2}`}
          fill="#475569"
          stroke="#94a3b8"
        />
      </g>
    );
  }

  if (kind === "thread") {
    return (
      <g>
        <rect x="54" y={y} width="14" height="22" fill="#1e293b" />
        <LeftHalf y={y} />
        {[0, 1, 2].map((step) => (
          <polygon
            key={`thread-l-${step}`}
            points={`49,${y + 2 + step * 7} 55,${y + 5 + step * 7} 49,${y + 8 + step * 7}`}
            fill="#64748b"
            stroke="#cbd5e1"
          />
        ))}
        {[0, 1, 2].map((step) => (
          <polygon
            key={`thread-r-${step}`}
            points={`68,${y + 2 + step * 7} 62,${y + 5 + step * 7} 68,${y + 8 + step * 7}`}
            fill="#475569"
            stroke="#94a3b8"
          />
        ))}
        <rect x="68" y={y} width="18" height="22" rx="2" fill="#475569" stroke="#94a3b8" />
      </g>
    );
  }

  if (kind === "magnet") {
    // Магниты: в каждом блоке по магниту, между ними зазор.
    return (
      <g>
        <LeftHalf y={y} />
        <circle cx="44" cy={y + 11} r="4" fill="#f87171" stroke="#fecaca" />
        <rect x="55" y={y} width="31" height="22" rx="2" fill="#475569" stroke="#94a3b8" />
        <circle cx="60" cy={y + 11} r="4" fill="#60a5fa" stroke="#bfdbfe" />
      </g>
    );
  }

  // Штифты: два цилиндрика между блоками, они и выравнивают деталь.
  return (
    <g>
      <LeftHalf y={y} />
      <rect x="51" y={y + 3} width="3" height="16" rx="1" fill="#cbd5e1" />
      <rect x="57" y={y + 3} width="3" height="16" rx="1" fill="#cbd5e1" />
      <rect x="62" y={y} width="24" height="22" rx="2" fill="#475569" stroke="#94a3b8" />
    </g>
  );
}

/**
 * «Типы соединений» — пять статичных разрезов стыка: геометрия замка слева,
 * название и допуск справа.
 */
export function ProFF3Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Типы соединений: пять статичных разрезов стыка — шип-паз с зазором 0,2–0,3 мм, ласточкин хвост держит сдвиг, резьба M3 с отверстием 2,9 мм, магниты в отверстии +0,1 мм и штифты 0,1 мм для выравнивания"
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

        <text x="12" y="13" fontSize="10" fill="#94a3b8">
          пять способов соединить разрезанную модель
        </text>

        {rows.map((row) => (
          <g key={row.name}>
            <Joint kind={row.kind} y={row.y} />
            <text x="96" y={row.y + 13} fontSize="10" fontWeight="bold" fill="#e2e8f0">
              {row.name}
            </text>
            <text x="96" y={row.y + 28} fontSize="9" fill="#94a3b8">
              {row.note}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
