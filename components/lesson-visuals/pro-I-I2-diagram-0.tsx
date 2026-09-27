import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/**
 * Шесть форм заполнения из content урока: Gyroid (волны), Cubic (кубы), Triangle
 * (треугольники), Grid (решётка), Lines (линии), Concentric (круги) — под каждой
 * применение из списка «Формы и применение».
 *
 * Формат — сетка 3×2, а не ряд из четырёх: у базовой схемы плотности (урок 7)
 * четыре квадрата 66×66 в одну линию и там меняется ПЛОТНОСТЬ одной и той же
 * решётки. Здесь плотность одинаковая, а формы РАЗНЫЕ — поэтому плиток шесть,
 * они вдвое ниже и стоят в два ряда, а подпись под каждой не процент, а
 * назначение: изотропность, сжатие, гибкость, универсальность, черновая и
 * круглые детали.
 */
const forms = [
  { x: 20, y: 26, kind: "gyroid", name: "Gyroid", note: "изотропный", accent: "#34d399" },
  { x: 117, y: 26, kind: "cubic", name: "Cubic", note: "на сжатие", accent: "#38bdf8" },
  { x: 214, y: 26, kind: "triangle", name: "Triangle", note: "гибкость", accent: "#fbbf24" },
  { x: 20, y: 104, kind: "grid", name: "Grid", note: "универсальный", accent: "#a78bfa" },
  { x: 117, y: 104, kind: "lines", name: "Lines", note: "быстро, черновая", accent: "#f87171" },
  { x: 214, y: 104, kind: "concentric", name: "Concentric", note: "круглые детали", accent: "#f472b6" },
];

/** Рисунок формы внутри плитки 86×44 (x, y — её левый верх). */
function Pattern({ kind, x, y, accent }: { kind: string; x: number; y: number; accent: string }) {
  if (kind === "gyroid") {
    return (
      <g fill="none" stroke={accent} strokeWidth="1.6">
        <path d={`M${x + 8},${y + 13} q7,-6 14,0 q7,6 14,0 q7,-6 14,0 q7,6 14,0`} />
        <path d={`M${x + 8},${y + 23} q7,6 14,0 q7,-6 14,0 q7,6 14,0 q7,-6 14,0`} />
        <path d={`M${x + 8},${y + 33} q7,-6 14,0 q7,6 14,0 q7,-6 14,0 q7,6 14,0`} />
      </g>
    );
  }

  if (kind === "cubic") {
    return (
      <g fill="none" stroke={accent} strokeWidth="1.5">
        <path d={`M${x + 10},${y + 24} h14 v10 h14 v-10 h14 v10 h14`} />
        <path d={`M${x + 10},${y + 34} h14 v-10 h14 v10 h14 v-10 h14`} />
        <line x1={x + 10} y1={y + 14} x2={x + 76} y2={y + 14} />
      </g>
    );
  }

  if (kind === "triangle") {
    return (
      <g fill="none" stroke={accent} strokeWidth="1.5">
        <path d={`M${x + 10},${y + 34} l14,-22 l14,22 l14,-22 l14,22 l14,-22`} />
        <line x1={x + 8} y1={y + 12} x2={x + 78} y2={y + 12} />
      </g>
    );
  }

  if (kind === "grid") {
    return (
      <g stroke={accent} strokeWidth="1.4">
        {[14, 26, 38, 50, 62].map((offset) => (
          <line key={`gv-${offset}`} x1={x + offset} y1={y + 8} x2={x + offset} y2={y + 36} />
        ))}
        {[14, 22, 30].map((offset) => (
          <line key={`gh-${offset}`} x1={x + 10} y1={y + offset} x2={x + 76} y2={y + offset} />
        ))}
      </g>
    );
  }

  if (kind === "lines") {
    return (
      <g stroke={accent} strokeWidth="1.6">
        {[8, 22, 36, 50, 64].map((offset) => (
          <line key={`ls-${offset}`} x1={x + offset} y1={y + 36} x2={x + offset + 14} y2={y + 10} />
        ))}
      </g>
    );
  }

  return (
    <g fill="none" stroke={accent} strokeWidth="1.5">
      <rect x={x + 10} y={y + 8} width="66" height="28" rx="12" />
      <rect x={x + 22} y={y + 14} width="42" height="16" rx="8" />
      <rect x={x + 36} y={y + 19} width="14" height="6" rx="3" />
    </g>
  );
}

/**
 * «Формы заполнения» — шесть плиток 3×2: у каждой свой рисунок решётки и
 * подпись с назначением.
 */
export function ProII2Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Шесть форм заполнения при одной плотности: волны Gyroid для изотропной прочности, кубы Cubic на сжатие, треугольники Triangle для гибкости, решётка Grid универсальна, линии Lines быстрые для черновых, Concentric для круглых деталей"
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
          одна плотность — шесть форм решётки
        </text>

        {forms.map((form) => (
          <g key={form.name}>
            <rect
              x={form.x}
              y={form.y}
              width="86"
              height="44"
              rx="8"
              fill="#0f172a"
              stroke={form.accent}
              strokeOpacity="0.6"
            />
            <Pattern kind={form.kind} x={form.x} y={form.y} accent={form.accent} />

            <text
              x={form.x + 43}
              y={form.y + 54}
              fontSize="9"
              fontWeight="bold"
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {form.name}
            </text>
            <text
              x={form.x + 43}
              y={form.y + 68}
              fontSize="8.5"
              fill="#94a3b8"
              textAnchor="middle"
            >
              {form.note}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
