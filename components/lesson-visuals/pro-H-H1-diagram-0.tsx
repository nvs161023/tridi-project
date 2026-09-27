import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Четыре колонки: центр, название и строка «плюс-минус» про каждый вид. */
const columns = [
  { cx: 48, name: "Lines", plus: "+ просто", minus: "− следы", kind: "lines" },
  { cx: 124, name: "Grid", plus: "+ прочно", minus: "− плотно", kind: "grid" },
  { cx: 200, name: "Tree", plus: "+ экономия", minus: "− время", kind: "tree" },
  { cx: 276, name: "PVA", plus: "+ без следов", minus: "− цена", kind: "soluble" },
];

/**
 * Четыре силуэта поддержки под одним и тем же нависанием 45°: балка детали и
 * её плечо, а под плечом — поддержка разной формы. Строка «+/−» под каждым
 * силуэтом — плюс и минус из урока.
 *
 * Ровно по content урока: «Lines — линейные, Grid — решётчатые, Tree —
 * древовидные, PVA — растворимые. Под каждой — плюсы и минусы».
 *
 * От «Примеров ориентации» в модуле F отличается предметом: там одна деталь в
 * трёх положениях и пересчитываются столбики поддержек у одной ориентации;
 * здесь четыре РАЗНЫХ вида поддержки под одинаковым нависанием, и сравниваются
 * их форма и характер, а не объём. От «До и после» в базовом уроке 11 — тем, что
 * там готовые детали и обработка, а здесь схема опоры в разрезе.
 */
export function ProHH1Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Четыре вида поддержек под нависанием 45 градусов: линейные Lines — просто, но остаются следы, решётчатые Grid — прочно, но плотно, древовидные Tree — экономия пластика, но время печати, растворимые PVA — без следов, но дорого"
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
          под нависанием 45°: четыре вида поддержек
        </text>

        {columns.map((column) => (
          <g key={column.name}>
            {/* Деталь: стойка и плечо, под которым стоит поддержка */}
            <rect
              x={column.cx - 26}
              y="46"
              width="52"
              height="8"
              fill="#475569"
              stroke="#94a3b8"
            />
            <rect
              x={column.cx - 26}
              y="46"
              width="8"
              height="40"
              fill="#475569"
              stroke="#94a3b8"
            />

            {/* Поддержка: форма зависит от вида */}
            {column.kind === "lines" &&
              [-22, -11, 0, 11, 22].map((offset) => (
                <line
                  key={`lines-${offset}`}
                  x1={column.cx + offset}
                  y1="54"
                  x2={column.cx + offset}
                  y2="120"
                  stroke="#64748b"
                  strokeWidth="2"
                />
              ))}
            {column.kind === "grid" && (
              <g>
                {[-18, -6, 6, 18].map((offset) => (
                  <line
                    key={`grid-v-${offset}`}
                    x1={column.cx + offset}
                    y1="54"
                    x2={column.cx + offset}
                    y2="120"
                    stroke="#64748b"
                    strokeWidth="2"
                  />
                ))}
                {[76, 96, 116].map((y) => (
                  <line
                    key={`grid-h-${y}`}
                    x1={column.cx - 26}
                    y1={y}
                    x2={column.cx + 26}
                    y2={y}
                    stroke="#64748b"
                    strokeWidth="2"
                  />
                ))}
              </g>
            )}
            {column.kind === "tree" && (
              <g stroke="#64748b" fill="none">
                <line x1={column.cx} y1="120" x2={column.cx} y2="80" strokeWidth="3" />
                <line x1={column.cx} y1="80" x2={column.cx - 20} y2="62" strokeWidth="2" />
                <line x1={column.cx} y1="80" x2={column.cx + 20} y2="62" strokeWidth="2" />
                <line x1={column.cx - 10} y1="71" x2={column.cx - 24} y2="58" strokeWidth="1.4" />
                <line x1={column.cx + 10} y1="71" x2={column.cx + 24} y2="58" strokeWidth="1.4" />
              </g>
            )}
            {column.kind === "soluble" &&
              [-22, -11, 0, 11, 22].map((offset) => (
                <line
                  key={`pva-${offset}`}
                  x1={column.cx + offset}
                  y1="54"
                  x2={column.cx + offset}
                  y2="120"
                  stroke="#7dd3fc"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
              ))}
            {column.kind === "soluble" && (
              <circle cx={column.cx + 22} cy="108" r="3" fill="#38bdf8" />
            )}

            <line x1={column.cx - 30} y1="120" x2={column.cx + 30} y2="120" stroke="#475569" />

            <text x={column.cx} y="136" fontSize="9" fontWeight="bold" fill="#e2e8f0" textAnchor="middle">
              {column.name}
            </text>
            <text x={column.cx} y="150" fontSize="9" fill="#6ee7b7" textAnchor="middle">
              {column.plus}
            </text>
            <text x={column.cx} y="164" fontSize="9" fill="#fca5a5" textAnchor="middle">
              {column.minus}
            </text>
          </g>
        ))}
      </svg>
    </VisualWrapper>
  );
}
