import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять покрытий из content урока: ширина образца и цвет подписи. */
type Surface = {
  x: number;
  name: string;
  kind: string;
  accent: string;
  texture: "glass" | "smooth" | "dots" | "rough" | "magnet";
};

const surfaces: Surface[] = [
  { x: 14, name: "стекло", kind: "гладкое", accent: "#38bdf8", texture: "glass" },
  { x: 74, name: "PEI", kind: "гладкий", accent: "#f59e0b", texture: "smooth" },
  { x: 134, name: "PEI", kind: "текстура", accent: "#f59e0b", texture: "dots" },
  { x: 194, name: "BuildTak", kind: "шершавый", accent: "#94a3b8", texture: "rough" },
  { x: 254, name: "магнитный", kind: "съёмный", accent: "#34d399", texture: "magnet" },
];

/** Точки текстурированного PEI: сетка 6×6 внутри образца. */
const dots = [0, 8, 16, 24, 32, 40];

/** Штрихи шершавой поверхности: короткие наклонные чёрточки. */
const dashes: [number, number, number, number][] = [
  [-18, -16, -8, -20],
  [-6, -10, 4, -14],
  [-20, -2, -10, -6],
  [-4, 4, 6, 0],
  [10, -2, 20, -6],
  [-16, 12, -6, 8],
  [4, 16, 14, 12],
];

/**
 * Виды столов — пять покрытий из content урока: стекло, гладкий PEI,
 * текстурированный PEI, BuildTak и магнитный. Показаны не списком и не
 * таблицей, а образцами: у каждого своя нарисованная фактура, а сверху лежит
 * напечатанная деталь и зелёная линия первого слоя.
 *
 * От диаграммы выбросов из модуля A-без отличается приёмом: там столбцы одного
 * параметра, здесь предметные образцы с фактурой — так видно, чем покрытия
 * отличаются на ощупь, а не только по названию.
 */
export function ProB2Image0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пять образцов покрытий стола: гладкое стекло, гладкий PEI, текстурированный PEI, шершавый BuildTak и съёмный магнитный — на каждом образце напечатана деталь и видна линия первого слоя"
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

        <text x="14" y="20" fontSize="10" fill="#e2e8f0">
          чем отличаются покрытия стола
        </text>

        {/* Образцы покрытий: рамка, фактура, деталь и линия первого слоя */}
        {surfaces.map((surface) => (
          <g key={`${surface.x}-${surface.name}`}>
            <rect
              x={surface.x}
              y="34"
              width="52"
              height="52"
              rx="6"
              fill="#0f172a"
              stroke={surface.accent}
            />

            {surface.texture === "glass" ? (
              <line
                x1={surface.x + 8}
                y1="78"
                x2={surface.x + 44}
                y2="42"
                stroke="#93c5fd"
                strokeWidth="3"
                strokeOpacity="0.45"
              />
            ) : null}

            {surface.texture === "smooth" ? (
              <g stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.55">
                <line x1={surface.x + 6} y1="44" x2={surface.x + 46} y2="44" />
                <line x1={surface.x + 6} y1="76" x2={surface.x + 46} y2="76" />
              </g>
            ) : null}

            {surface.texture === "dots" ? (
              <g fill={surface.accent} fillOpacity="0.75">
                {dots.map((dx) => (
                  <g key={dx}>
                    {dots.map((dy) => (
                      <circle key={dy} cx={surface.x + 6 + dx} cy={40 + dy} r="1" />
                    ))}
                  </g>
                ))}
              </g>
            ) : null}

            {surface.texture === "rough" ? (
              <g fill="none" stroke={surface.accent} strokeWidth="1" strokeOpacity="0.7">
                {dashes.map(([dx1, dy1, dx2, dy2]) => (
                  <line
                    key={`${dx1}-${dy1}`}
                    x1={surface.x + 26 + dx1}
                    y1={64 + dy1}
                    x2={surface.x + 26 + dx2}
                    y2={64 + dy2}
                  />
                ))}
              </g>
            ) : null}

            {surface.texture === "magnet" ? (
              <g>
                <line
                  x1={surface.x + 2}
                  y1="70"
                  x2={surface.x + 50}
                  y2="70"
                  stroke="#34d399"
                  strokeDasharray="4 3"
                />
                <line
                  x1={surface.x + 8}
                  y1="58"
                  x2={surface.x + 8}
                  y2="50"
                  stroke="#34d399"
                  strokeWidth="1.2"
                />
                <polygon
                  points={`${surface.x + 5},50 ${surface.x + 11},50 ${surface.x + 8},45`}
                  fill="#34d399"
                />
              </g>
            ) : null}

            {/* Деталь на покрытии и зелёная линия первого слоя */}
            <rect
              x={surface.x + 16}
              y="46"
              width="20"
              height="12"
              rx="2"
              fill="#93c5fd"
              fillOpacity="0.45"
              stroke="#93c5fd"
            />
            <line
              x1={surface.x + 14}
              y1="62"
              x2={surface.x + 38}
              y2="62"
              stroke="#34d399"
              strokeWidth="1.4"
            />

            <text
              x={surface.x + 26}
              y="102"
              fontSize="10"
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {surface.name}
            </text>
            <text
              x={surface.x + 26}
              y="118"
              fontSize="10"
              fill="#94a3b8"
              textAnchor="middle"
            >
              {surface.kind}
            </text>
          </g>
        ))}

        <text x="14" y="152" fontSize="10" fill="#94a3b8">
          на каждом образце печатают первый слой
        </text>
        <text x="14" y="168" fontSize="10" fill="#94a3b8">
          покрытие держит его и отдаёт модель
        </text>
      </svg>
    </VisualWrapper>
  );
}
