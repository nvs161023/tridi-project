import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Примеры на деталях из content урока: «кронштейн (40 % Gyroid), шестерня (60 %
 * Cubic), ваза (0 %), игрушка (15 % Gyroid)».
 *
 * Формат — четыре РАЗНЫХ предмета в сетке 2×2: у каждого свой силуэт слева и
 * срез-окно справа, где видно решётку заполнения сквозь стенку. Ряд из четырёх
 * плиток занят базовой схемой плотности (урок 7), поэтому здесь два ряда по две.
 *
 * От «кронштейна» в H3 отличается предметом: там ОДНА деталь крупно и цилиндр
 * модификатора в зоне крепления, здесь четыре разные детали и ни одного
 * модификатора. От вазы с рельефом в G1 — тем, что там текстура снаружи, а здесь
 * разрез: видно пустоту внутри при 0 % заполнения.
 */
const cells = [
  { x: 12, y: 26, part: "bracket", fill: "dense", name: "кронштейн — 40 % Gyroid", accent: "#34d399" },
  { x: 166, y: 26, part: "gear", fill: "cubic", name: "шестерня — 60 % Cubic", accent: "#38bdf8" },
  { x: 12, y: 100, part: "vase", fill: "empty", name: "ваза — 0 %, спиральный режим", accent: "#fbbf24" },
  { x: 166, y: 100, part: "toy", fill: "sparse", name: "игрушка — 15 % Gyroid", accent: "#a78bfa" },
];

/** Силуэт детали слева: у каждой свой, но все — в одной рамке. */
function Silhouette({ part, x, y }: { part: string; x: number; y: number }) {
  if (part === "gear") {
    return (
      <g>
        <circle cx={x + 36} cy={y + 26} r="15" fill="#475569" />
        <rect x={x + 33} y={y + 6} width="6" height="7" rx="2" fill="#475569" />
        <rect x={x + 33} y={y + 39} width="6" height="7" rx="2" fill="#475569" />
        <rect x={x + 16} y={y + 23} width="7" height="6" rx="2" fill="#475569" />
        <rect x={x + 49} y={y + 23} width="7" height="6" rx="2" fill="#475569" />
        <rect x={x + 21} y={y + 9} width="6" height="7" rx="2" fill="#475569" transform={`rotate(-45 ${x + 24} ${y + 12.5})`} />
        <rect x={x + 45} y={y + 9} width="6" height="7" rx="2" fill="#475569" transform={`rotate(45 ${x + 48} ${y + 12.5})`} />
        <rect x={x + 21} y={y + 38} width="6" height="7" rx="2" fill="#475569" transform={`rotate(45 ${x + 24} ${y + 41.5})`} />
        <rect x={x + 45} y={y + 38} width="6" height="7" rx="2" fill="#475569" transform={`rotate(-45 ${x + 48} ${y + 41.5})`} />
      </g>
    );
  }

  if (part === "vase") {
    return (
      <path
        d={`M${x + 22},${y + 40} L${x + 16},${y + 12} L${x + 54},${y + 12} L${x + 48},${y + 40} Z`}
        fill="#475569"
      />
    );
  }

  if (part === "toy") {
    return (
      <g>
        <rect x={x + 20} y={y + 34} width="34" height="8" rx="4" fill="#475569" />
        <rect x={x + 25} y={y + 24} width="24" height="8" rx="4" fill="#475569" />
        <rect x={x + 30} y={y + 14} width="14" height="8" rx="4" fill="#475569" />
      </g>
    );
  }

  return (
    <g>
      <rect x={x + 16} y={y + 10} width="11" height="32" rx="2" fill="#475569" />
      <rect x={x + 16} y={y + 34} width="40" height="8" rx="2" fill="#475569" />
    </g>
  );
}

/** Срез-окно: решётка заполнения, которую видно сквозь стенку детали. */
function Infill({ fill, x, y, accent }: { fill: string; x: number; y: number; accent: string }) {
  if (fill === "empty") {
    return (
      <g fill="#64748b">
        <rect x={x + 4} y={y + 3} width="5" height="26" />
        <rect x={x + 51} y={y + 3} width="5" height="26" />
      </g>
    );
  }

  if (fill === "cubic") {
    return (
      <g fill="none" stroke={accent} strokeWidth="1.4">
        {[12, 30, 48].map((offset) => (
          <rect key={`cb-${offset}`} x={x + offset} y={y + 5} width="12" height="10" />
        ))}
        {[21, 39].map((offset) => (
          <rect key={`cb2-${offset}`} x={x + offset} y={y + 17} width="12" height="10" />
        ))}
      </g>
    );
  }

  const rows = fill === "dense" ? [10, 17, 24] : [12, 22];

  return (
    <g fill="none" stroke={accent} strokeWidth="1.4">
      {rows.map((offset) => (
        <path
          key={`inf-${offset}`}
          d={`M${x + 8},${y + offset} q7,-5 14,0 q7,5 14,0 q7,-5 14,0`}
        />
      ))}
    </g>
  );
}

/**
 * «Примеры на деталях» — четыре детали в сетке 2×2: у каждой свой силуэт и своё
 * заполнение в срезе.
 */
export function ProII2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Примеры заполнения на четырёх деталях: кронштейн с 40 процентами Gyroid, шестерня с 60 процентами Cubic, ваза с нулевым заполнением в спиральном режиме и игрушка с 15 процентами Gyroid — в срезе каждой видно решётку"
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
          одна логика заполнения — четыре разные детали
        </text>

        {cells.map((cell) => (
          <g key={cell.part}>
            <rect
              x={cell.x}
              y={cell.y}
              width="142"
              height="62"
              rx="8"
              fill="#0f172a"
              stroke="#475569"
            />
            <Silhouette part={cell.part} x={cell.x} y={cell.y} />
            <rect
              x={cell.x + 72}
              y={cell.y + 8}
              width="60"
              height="32"
              rx="4"
              fill="#0f172a"
              stroke={cell.accent}
              strokeOpacity="0.7"
            />
            <Infill fill={cell.fill} x={cell.x + 72} y={cell.y + 8} accent={cell.accent} />
            <text
              x={cell.x + 71}
              y={cell.y + 56}
              fontSize="8.5"
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {cell.name}
            </text>
          </g>
        ))}

        <text x="12" y="175" fontSize="9.5" fill="#94a3b8">
          стенки держат нагрузку, заполнение поддерживает форму
        </text>
      </svg>
    </VisualWrapper>
  );
}
