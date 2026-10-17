import { VisualWrapper, type VisualProps } from "./_Wrapper";

const FONT = "system-ui, -apple-system, sans-serif";

/** Пять плиток: 52 px шириной, шаг 60, поле 40…96. */
const TILE = { y: 40, w: 52, h: 56 };
const TILE_X = [12, 72, 132, 192, 252];
const LABEL_Y = 110;

type Shape = { name: string; color: string };

/** Пять форм из блока 9: гироид, cubic, triangle, grid и круги. */
const SHAPES: Shape[] = [
  { name: "гироид", color: "#10b981" },
  { name: "cubic", color: "#60a5fa" },
  { name: "треугольник", color: "#f59e0b" },
  { name: "сетка", color: "#94a3b8" },
  { name: "круги", color: "#a78bfa" },
];

/** Волна гироида: строка из четырёх волн по 11 px. */
function wave(y: number, x: number) {
  return `M${x} ${y} q5.5 -7 11 0 t11 0 t11 0 t11 0`;
}

/**
 * Кадр блока 5 урока C10 «Пять форм заполнения».
 *
 * Макет из описания кадра `C10_infill_shapes.png`: гироид, куб, треугольник,
 * сетка квадратами и концентрические круги — по одному образцу на плитку. Блок 9
 * объясняет, что выбрать: cubic держит сжатие, triangle даёт упругость, grid и
 * lines быстрее, а гироид работает во все стороны и потому стал стандартом.
 */
export function ConfidentC10Diagram0({ title, animated }: VisualProps) {
  return (
    <VisualWrapper
      title={title}
      ariaLabel="Пять форм заполнения: гироид с волнами по всем осям, cubic из кубической решётки, треугольники для упругости, сетка квадратами для скорости и концентрические круги для тел вращения. Форма отвечает за направление нагрузки, проценты — только за плотность. Гироид держит в любую сторону, cubic — на сжатие, grid быстрее, но на изгиб слабее"
      animated={animated}
    >
      <svg viewBox="0 0 320 180" className="w-full h-full" aria-hidden="true" fontFamily={FONT}>
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

        <text x="12" y="15" fontSize="10" fill="#94a3b8">
          пять форм заполнения
        </text>

        {TILE_X.map((x, index) => {
          const shape = SHAPES[index];
          return (
            <g key={shape.name}>
              <rect
                x={x}
                y={TILE.y}
                width={TILE.w}
                height={TILE.h}
                rx="5"
                fill="#0f172a"
                fillOpacity="0.35"
                stroke={shape.color}
                strokeOpacity="0.5"
              />

              {/* Гироид: волны, идущие под углом друг к другу */}
              {index === 0
                ? [10, 21, 32, 43].map((dy) => (
                    <path
                      key={dy}
                      d={wave(TILE.y + dy, x + 4)}
                      fill="none"
                      stroke={shape.color}
                      strokeOpacity="0.85"
                    />
                  ))
                : null}

              {/* Cubic: куб с рёбрами по трём осям */}
              {index === 1 ? (
                <g stroke={shape.color} fill="none">
                  <rect x={x + 9} y={TILE.y + 24} width="22" height="22" />
                  <polygon points={`${x + 9},${TILE.y + 24} ${x + 16},${TILE.y + 17} ${
                    x + 38
                  },${TILE.y + 17} ${x + 31},${TILE.y + 24}`} />
                  <polygon points={`${x + 31},${TILE.y + 24} ${x + 38},${TILE.y + 17} ${
                    x + 38
                  },${TILE.y + 39} ${x + 31},${TILE.y + 46}`} />
                  <line
                    x1={x + 20}
                    y1={TILE.y + 24}
                    x2={x + 20}
                    y2={TILE.y + 46}
                    strokeOpacity="0.5"
                  />
                  <line
                    x1={x + 9}
                    y1={TILE.y + 35}
                    x2={x + 31}
                    y2={TILE.y + 35}
                    strokeOpacity="0.5"
                  />
                </g>
              ) : null}

              {/* Triangle: вложенные треугольники */}
              {index === 2 ? (
                <g stroke={shape.color} fill="none">
                  <polygon
                    points={`${x + 26},${TILE.y + 10} ${x + 44},${TILE.y + 44} ${x + 8},${
                      TILE.y + 44
                    }`}
                  />
                  <polygon
                    points={`${x + 26},${TILE.y + 22} ${x + 36},${TILE.y + 39} ${x + 16},${
                      TILE.y + 39
                    }`}
                    strokeOpacity="0.6"
                  />
                </g>
              ) : null}

              {/* Grid: квадраты */}
              {index === 3 ? (
                <g stroke={shape.color} fill="none">
                  {[13, 26, 39].map((dx) => (
                    <line
                      key={dx}
                      x1={x + dx}
                      y1={TILE.y + 8}
                      x2={x + dx}
                      y2={TILE.y + 48}
                      strokeOpacity="0.8"
                    />
                  ))}
                  {[14, 28, 42].map((dy) => (
                    <line
                      key={dy}
                      x1={x + 6}
                      y1={TILE.y + dy}
                      x2={x + TILE.w - 6}
                      y2={TILE.y + dy}
                      strokeOpacity="0.8"
                    />
                  ))}
                </g>
              ) : null}

              {/* Concentric: круги, повторяющие контур */}
              {index === 4
                ? [20, 14, 8].map((r) => (
                    <circle
                      key={r}
                      cx={x + TILE.w / 2}
                      cy={TILE.y + TILE.h / 2}
                      r={r}
                      fill="none"
                      stroke={shape.color}
                      strokeOpacity="0.8"
                    />
                  ))
                : null}

              <text
                x={x + TILE.w / 2}
                y={LABEL_Y}
                fontSize="10"
                fontWeight="700"
                fill={shape.color}
                textAnchor="middle"
              >
                {shape.name}
              </text>
            </g>
          );
        })}

        <text x="12" y="126" fontSize="10" fill="#94a3b8">
          форма отвечает за направление, проценты — за плотность
        </text>
        <text x="12" y="142" fontSize="10" fontWeight="700" fill="#e2e8f0">
          Гироид держит в любую сторону
        </text>
        <text x="12" y="158" fontSize="10" fill="#94a3b8">
          Cubic — на сжатие, triangle — на упругость
        </text>
        <text x="12" y="172" fontSize="10" fill="#94a3b8">
          Grid быстрее гироида, но на изгиб слабее
        </text>
      </svg>
    </VisualWrapper>
  );
}
